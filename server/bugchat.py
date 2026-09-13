"""The bug chat's server: a room, a week of history, and a ban list.

Runs on the homelab. Python's standard library and one SQLite file -- no
framework, no package to install, nothing to keep up to date but this.

    python3 bugchat.py                    # port 8712, ./chat.db
    BUGCHAT_PORT=9000 python3 bugchat.py

What it does

    GET  /api/room?since=<id>   the lines after that id, oldest first
    POST /api/say               {name, text, key, reply} -> the line, or why not
    GET  /api/health            a word about the room

    GET  /api/admin/log?limit=  every line, addresses included
    GET  /api/admin/bans        who is barred
    POST /api/admin/ban         {ip|name, reason} -- ip may be a /24 prefix
    POST /api/admin/unban       {ip|name}
    POST /api/admin/hide        {id, hidden} -- off the wall, or back on it
    POST /api/admin/delete      {id} or {what:"hidden"|"all"} -- gone for good
    GET  /api/admin/export      the lot, as JSON
    GET  /admin                 the warden: a page to do all of that from

The warden and everything under /api/admin answer on the house network only.
A request that arrives through the tunnel -- which is every request from the
internet -- is told there is nothing there, because as far as the internet is
concerned there is not. The room is public; the keys to it are not, and an
admin page nobody outside can load is one nobody outside can grind at.

Everything under /api/admin wants the token in `X-Admin-Token`, which comes
from BUGCHAT_TOKEN in the environment. Without that variable the admin half
does not answer at all, so a misconfigured box is a mute box rather than an
open one.

On addresses: a line's address is kept, because banning is the point and you
cannot ban what you did not write down. It is never served to the public room
-- /api/room returns a name, a country and a time, the same as the old broker
did. Only the admin endpoints, behind the token, can see who said what.
"""

import io
import json
import os
import re
import sqlite3
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("BUGCHAT_DB", os.path.join(HERE, "chat.db"))
PORT = int(os.environ.get("BUGCHAT_PORT", "8712"))
TOKEN = os.environ.get("BUGCHAT_TOKEN", "")
# Beside the database, because that is the one place the unit is allowed to
# write: ProtectHome=true means a home directory is not.
BACKUPS = os.environ.get(
    "BUGCHAT_BACKUPS", os.path.join(os.path.dirname(os.path.abspath(
        DB_PATH)), "backups"))

# Who may ask. The room is for spitmux.me; anything else gets a flat no rather
# than a wildcard, so the room cannot be embedded in somebody else's page.
ORIGINS = set(filter(None, os.environ.get(
    "BUGCHAT_ORIGINS",
    "https://spitmux.me,https://www.spitmux.me,http://localhost:8788,http://127.0.0.1:8788"
).split(",")))

# Names nobody else gets to wear. The check is on what a name LOOKS like once
# the tricks are taken off it, not on the letters as typed -- sp1tmux, 5PITMUX,
# spit-mux, xXspitmuxXx and defthr3ts are all the same attempt at the same lie.
RESERVED = ["spitmux", "defthrets", "ratboy", "admin", "moderator", "owner",
            "operator", "warden", "official", "staff", "system"]
LOOKALIKE = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "6": "g",
             "7": "t", "8": "b", "9": "g", "$": "s", "@": "a", "!": "i",
             "|": "i", "+": "t"}

MAX_TEXT = 200
MAX_NAME = 16
ROOM_LINES = 60           # how much of the wall a new arrival is handed
ROOM = ("SELECT m.id, m.ts, m.name, m.text, m.reply, m.badge, "
        "CASE WHEN m.geo <> '' THEN m.geo ELSE m.cc END AS cc, "
        "r.name AS re_name, substr(r.text, 1, 70) AS re_text "
        "FROM msg m LEFT JOIN msg r ON r.id = m.reply ")
COOLDOWN_S = 3.0          # per address
BURST_PER_MIN = 12        # per address

SCHEMA = """
CREATE TABLE IF NOT EXISTS msg (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,
  name    TEXT    NOT NULL,
  text    TEXT    NOT NULL,
  ip      TEXT    NOT NULL,
  cc      TEXT    NOT NULL DEFAULT '',   -- what the page said, and can lie
  geo     TEXT    NOT NULL DEFAULT '',   -- what Cloudflare said, and cannot
  hidden  INTEGER NOT NULL DEFAULT 0,
  reply   INTEGER NOT NULL DEFAULT 0,   -- the line this one answers, or 0
  badge   TEXT    NOT NULL DEFAULT ''   -- 'op' or 'bot'; only the token sets it
);
CREATE INDEX IF NOT EXISTS msg_ts ON msg (ts);
-- A name belongs to whoever said it first, and keeps belonging to them. The
-- browser makes a secret once and sends it with every line; the name is held
-- against that secret. Nothing here identifies a person -- it is a random
-- string that says "the same one as last time".
CREATE TABLE IF NOT EXISTS owner (
  name    TEXT PRIMARY KEY,     -- lowercased
  key     TEXT NOT NULL,
  ts      INTEGER NOT NULL,
  seen    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ban (
  what    TEXT PRIMARY KEY,     -- 'ip:1.2.3.4', 'ip:1.2.3.' or 'name:someone'
  reason  TEXT NOT NULL DEFAULT '',
  ts      INTEGER NOT NULL
);
"""

_lock = threading.Lock()
_last_said = {}           # ip -> [last time, [times this minute]]
_wrong = {}               # ip -> [failed guesses, when the lockout lifts]

WARDEN = os.path.join(HERE, "admin.html")
GUESSES = 6               # wrong tokens before that address waits
LOCKOUT_S = 300


def db():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c


def setup():
    c = db()
    with c:
        c.executescript(SCHEMA)
        # a room that predates the geo column keeps its lines
        have = [r["name"] for r in c.execute("PRAGMA table_info(msg)")]
        if "geo" not in have:
            c.execute("ALTER TABLE msg ADD COLUMN geo TEXT NOT NULL DEFAULT ''")
        if "reply" not in have:
            c.execute("ALTER TABLE msg ADD COLUMN reply INTEGER NOT NULL DEFAULT 0")
        if "badge" not in have:
            c.execute("ALTER TABLE msg ADD COLUMN badge TEXT NOT NULL DEFAULT ''")
    c.close()


def clean(s, n):
    """One line of it, no control characters, trimmed to length."""
    s = re.sub(r"[\x00-\x1f\x7f]", " ", str(s or "")).strip()
    return re.sub(r"\s{2,}", " ", s)[:n]


def flatten(name):
    """A name with its disguises removed: case, spacing, punctuation and the
    digits that stand in for letters."""
    out = []
    for ch in name.lower():
        ch = LOOKALIKE.get(ch, ch)
        if ch.isalpha():
            out.append(ch)
    return "".join(out)


def taken(name):
    """The reserved name it is pretending to be, or None."""
    flat = flatten(name)
    for r in RESERVED:
        if r in flat:
            return r
    return None


def banned(c, ip, name):
    """A ban on an address, on the /24 it sits in, or on a handle."""
    keys = ["ip:" + ip, "name:" + name.lower()]
    if ip.count(".") == 3:
        keys.append("ip:" + ip.rsplit(".", 1)[0] + ".")
    rows = c.execute(
        "SELECT what, reason FROM ban WHERE what IN (%s)" % ",".join("?" * len(keys)),
        keys).fetchall()
    return rows[0]["reason"] if rows else None


def too_fast(ip):
    """Three seconds between lines, a dozen a minute. Kept in memory: a
    restart forgives everyone, which is the right way round for a chat."""
    now = time.time()
    with _lock:
        last, recent = _last_said.get(ip, (0.0, []))
        recent = [t for t in recent if now - t < 60]
        if now - last < COOLDOWN_S:
            return "one line at a time"
        if len(recent) >= BURST_PER_MIN:
            return "slow down"
        recent.append(now)
        _last_said[ip] = (now, recent)
    return None


class Handler(BaseHTTPRequestHandler):
    server_version = "bugchat/1.0"
    protocol_version = "HTTP/1.1"

    # ── plumbing ─────────────────────────────────────────────────────────
    def log_message(self, fmt, *args):
        sys.stderr.write("%s  %s  %s\n" % (
            time.strftime("%Y-%m-%d %H:%M:%S"), self.client_ip(), fmt % args))

    def client_country(self):
        """Where Cloudflare says the request came from.

        The page sends a country too, but the page is a stranger's browser and
        can say whatever it likes. This one is added by the proxy the request
        actually came through, so it is the one worth moderating on. Empty when
        somebody reaches the service directly on the LAN, which is fine -- the
        page's own guess is kept as well and stands in."""
        cc = (self.headers.get("CF-IPCountry", "") or "").strip().upper()
        return cc if re.match(r"^[A-Z]{2}$", cc) else ""

    def client_ip(self):
        """The address the reverse proxy saw, not the proxy's own."""
        fwd = self.headers.get("X-Forwarded-For", "")
        if fwd:
            return fwd.split(",")[0].strip()
        real = self.headers.get("X-Real-IP", "")
        return real.strip() or self.client_address[0]

    def cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def reply(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > 8192:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception:
            return {}

    def from_outside(self):
        """Did this come in through the tunnel?

        cloudflared sets these on everything it forwards, and nothing on the
        house network sets them, so their presence is a reliable "this came
        from the internet". Anything that did is not shown the admin half at
        all -- not a login, not a 403, nothing to tell it is there."""
        h = self.headers
        return bool(h.get("CF-Connecting-IP") or h.get("CF-Ray") or h.get("CF-IPCountry"))

    def admin_ok(self):
        """The token, and patience. Six wrong guesses and that address waits
        five minutes -- enough to make grinding at it pointless, not enough to
        matter to somebody who fat-fingered it."""
        if not TOKEN:
            return False
        ip = self.client_ip()
        now = time.time()
        with _lock:
            bad, until = _wrong.get(ip, (0, 0.0))
            if now < until:
                return False
        if self.headers.get("X-Admin-Token", "") == TOKEN:
            with _lock:
                _wrong.pop(ip, None)
            return True
        with _lock:
            bad += 1
            _wrong[ip] = (bad, now + LOCKOUT_S if bad >= GUESSES else 0.0)
        self.log_message("admin: wrong token (%d)", bad)
        return False

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ── the room ─────────────────────────────────────────────────────────
    def do_GET(self):
        path, _, query = self.path.partition("?")
        q = dict(p.split("=", 1) for p in query.split("&") if "=" in p)

        if path in ("", "/"):
            # Somebody has typed the host into a phone. From the house that
            # means they want the warden; from outside there is nothing here
            # to point at.
            if self.from_outside():
                return self.reply(404, {"error": "no such thing"})
            self.send_response(302)
            self.send_header("Location", "/admin")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        if path in ("/admin", "/admin/"):
            if self.from_outside():
                return self.reply(404, {"error": "no such thing"})
            try:
                body = io.open(WARDEN, "rb").read()
            except Exception:
                return self.reply(404, {"error": "no warden here"})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Robots-Tag", "noindex")
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/health":
            c = db()
            n = c.execute("SELECT COUNT(*) n FROM msg WHERE hidden=0").fetchone()["n"]
            c.close()
            return self.reply(200, {"ok": True, "lines": n, "admin": bool(TOKEN)})

        if path == "/api/room":
            since = int(q.get("since") or 0)
            c = db()
            if since:
                rows = c.execute(
                    "%sWHERE m.hidden=0 AND m.id>? ORDER BY m.id LIMIT 200" % ROOM,
                    (since,)).fetchall()
            else:
                rows = c.execute(
                    "%sWHERE m.hidden=0 ORDER BY m.id DESC LIMIT ?" % ROOM,
                    (ROOM_LINES,)).fetchall()
                rows = list(reversed(rows))
            c.close()
            return self.reply(200, {"lines": [dict(r) for r in rows]})

        if path.startswith("/api/admin/"):
            if self.from_outside():
                return self.reply(404, {"error": "no such thing"})
            if not self.admin_ok():
                return self.reply(403, {"error": "no"})
            c = db()
            if path == "/api/admin/log" or path == "/api/admin/export":
                limit = int(q.get("limit") or 500)
                rows = c.execute(
                    "SELECT * FROM msg ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
                c.close()
                return self.reply(200, {"lines": [dict(r) for r in rows]})
            if path == "/api/admin/stats":
                row = c.execute(
                    "SELECT COUNT(*) lines, SUM(hidden) hidden, COUNT(DISTINCT ip) ips "
                    "FROM msg").fetchone()
                bans = c.execute("SELECT COUNT(*) n FROM ban").fetchone()["n"]
                c.close()
                return self.reply(200, {"lines": row["lines"], "hidden": row["hidden"] or 0,
                                        "addresses": row["ips"], "bans": bans})
            if path == "/api/admin/bans":
                rows = c.execute("SELECT * FROM ban ORDER BY ts DESC").fetchall()
                c.close()
                return self.reply(200, {"bans": [dict(r) for r in rows]})
            c.close()

        return self.reply(404, {"error": "no such thing"})

    def do_POST(self):
        path = self.path.partition("?")[0]
        ip = self.client_ip()

        if path == "/api/say":
            d = self.body()
            name = clean(d.get("name"), MAX_NAME) or "anon"
            text = clean(d.get("text"), MAX_TEXT)
            cc = clean(d.get("cc"), 2).upper()
            if not re.match(r"^[A-Z]{2}$", cc or ""):
                cc = ""
            if not text:
                return self.reply(400, {"error": "say something"})

            # the house's own names, unless the house is the one asking
            house = self.admin_ok()
            if not house:
                mine = taken(name)
                if mine:
                    return self.reply(403, {"error": '"%s" is spoken for -- pick another name' % mine})

            c = db()
            why = banned(c, ip, name)
            if why is not None:
                c.close()
                return self.reply(403, {"error": why or "you are not welcome here"})
            # The pacing is there to stop one address flooding the wall. The
            # house is one address and will be answering several people at
            # once once the bot is behind it, so it is not held to that.
            slow = None if house else too_fast(ip)
            if slow:
                c.close()
                return self.reply(429, {"error": slow})

            # a name belongs to whoever had it first
            key = clean(d.get("key"), 64)
            ts = int(time.time() * 1000)
            if not house:
                held = c.execute("SELECT key FROM owner WHERE name=?", (name.lower(),)).fetchone()
                if held and key != held["key"]:
                    c.close()
                    return self.reply(409, {"error": '"%s" belongs to somebody else' % name})
                if not held and key:
                    with c:
                        c.execute("INSERT OR IGNORE INTO owner (name, key, ts, seen) "
                                  "VALUES (?,?,?,?)", (name.lower(), key, ts, ts))
                elif held:
                    with c:
                        c.execute("UPDATE owner SET seen=? WHERE name=?", (ts, name.lower()))

            # the line this one answers, if it is still on the wall
            reply = int(d.get("reply") or 0)
            if reply and not c.execute(
                    "SELECT 1 FROM msg WHERE id=? AND hidden=0", (reply,)).fetchone():
                reply = 0

            # A badge is a claim about who is speaking, so only something
            # holding the token may make one -- the house, or the bot it runs.
            badge = clean(d.get("badge"), 3).lower() if house else ""
            if badge not in ("op", "bot"):
                badge = "op" if house else ""

            geo = self.client_country()
            with c:
                cur = c.execute(
                    "INSERT INTO msg (ts, name, text, ip, cc, geo, reply, badge) "
                    "VALUES (?,?,?,?,?,?,?,?)",
                    (ts, name, text, ip, cc, geo, reply, badge))
            rid = cur.lastrowid
            out = {"id": rid, "ts": ts, "name": name, "text": text,
                   "cc": geo or cc, "reply": reply, "badge": badge}
            if reply:
                r = c.execute("SELECT name, text FROM msg WHERE id=?", (reply,)).fetchone()
                if r:
                    out["re_name"] = r["name"]
                    out["re_text"] = r["text"][:70]
            c.close()
            return self.reply(200, {"line": out})

        if path.startswith("/api/admin/"):
            if self.from_outside():
                return self.reply(404, {"error": "no such thing"})
            if not self.admin_ok():
                return self.reply(403, {"error": "no"})
            d = self.body()
            c = db()
            now = int(time.time() * 1000)

            if path == "/api/admin/ban":
                what = ("ip:" + clean(d.get("ip"), 45)) if d.get("ip") \
                    else ("name:" + clean(d.get("name"), MAX_NAME).lower())
                if what in ("ip:", "name:"):
                    c.close()
                    return self.reply(400, {"error": "ban what?"})
                with c:
                    c.execute("INSERT OR REPLACE INTO ban (what, reason, ts) VALUES (?,?,?)",
                              (what, clean(d.get("reason"), 120), now))
                    # and take down what they already said, if asked
                    if d.get("purge"):
                        if what.startswith("ip:"):
                            c.execute("UPDATE msg SET hidden=1 WHERE ip LIKE ?",
                                      (what[3:] + "%",))
                        else:
                            c.execute("UPDATE msg SET hidden=1 WHERE lower(name)=?",
                                      (what[5:],))
                c.close()
                return self.reply(200, {"banned": what})

            if path == "/api/admin/unban":
                what = ("ip:" + clean(d.get("ip"), 45)) if d.get("ip") \
                    else ("name:" + clean(d.get("name"), MAX_NAME).lower())
                with c:
                    c.execute("DELETE FROM ban WHERE what=?", (what,))
                c.close()
                return self.reply(200, {"unbanned": what})

            if path == "/api/admin/hide":
                # hidden defaults to 1, so an old caller keeps working; pass 0
                # to put a line back on the wall
                on = 0 if str(d.get("hidden", 1)) in ("0", "false", "False") else 1
                with c:
                    c.execute("UPDATE msg SET hidden=? WHERE id=?", (on, int(d.get("id") or 0)))
                c.close()
                return self.reply(200, {"id": d.get("id"), "hidden": on})

            if path == "/api/admin/delete":
                """Gone for good -- so anything that takes more than one line
                with it writes the lot to a file first. Undoing a wipe should
                cost a copy and paste, not an apology."""
                what = d.get("what")
                if what in ("all", "hidden"):
                    where = "" if what == "all" else " WHERE hidden=1"
                    rows = [dict(r) for r in c.execute("SELECT * FROM msg" + where)]
                    kept = None
                    if rows:
                        try:
                            os.makedirs(BACKUPS, exist_ok=True)
                            kept = os.path.join(BACKUPS, "%s-%s.json" % (
                                what, time.strftime("%Y%m%d-%H%M%S")))
                            io.open(kept, "w", encoding="utf-8").write(
                                json.dumps(rows, ensure_ascii=False, indent=1))
                        except Exception as e:
                            c.close()
                            return self.reply(500, {"error": "could not keep a copy: %s" % e})
                    with c:
                        c.execute("DELETE FROM msg" + where)
                    c.close()
                    return self.reply(200, {"deleted": len(rows), "kept": kept})

                rid = int(d.get("id") or 0)
                with c:
                    cur = c.execute("DELETE FROM msg WHERE id=?", (rid,))
                n = cur.rowcount
                c.close()
                return self.reply(200, {"deleted": n, "id": rid})

            c.close()

        return self.reply(404, {"error": "no such thing"})


def main():
    setup()
    if not TOKEN:
        sys.stderr.write("bugchat: no BUGCHAT_TOKEN set -- the admin half is off\n")
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    sys.stderr.write("bugchat: listening on :%d, keeping %s\n" % (PORT, DB_PATH))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
