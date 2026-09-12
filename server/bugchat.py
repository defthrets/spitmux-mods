"""The bug chat's server: a room, a week of history, and a ban list.

Runs on the homelab. Python's standard library and one SQLite file -- no
framework, no package to install, nothing to keep up to date but this.

    python3 bugchat.py                    # port 8712, ./chat.db
    BUGCHAT_PORT=9000 python3 bugchat.py

What it does

    GET  /api/room?since=<id>   the lines after that id, oldest first
    POST /api/say               {name, text} -> the line, or why not
    GET  /api/health            a word about the room

    GET  /api/admin/log?limit=  every line, addresses included
    GET  /api/admin/bans        who is barred
    POST /api/admin/ban         {ip|name, reason} -- ip may be a /24 prefix
    POST /api/admin/unban       {ip|name}
    POST /api/admin/hide        {id} -- takes one line off the wall
    GET  /api/admin/export      the lot, as JSON
    GET  /admin                 the warden: a page to do all of that from

The warden is served from here rather than from the site, so it is the same
origin as the API it drives and CORS never enters into it. It is public in the
sense that anyone may load the HTML; it is inert without the token, and a
handful of wrong guesses puts that address in the corner for a while.

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

# Who may ask. The room is for spitmux.me; anything else gets a flat no rather
# than a wildcard, so the room cannot be embedded in somebody else's page.
ORIGINS = set(filter(None, os.environ.get(
    "BUGCHAT_ORIGINS",
    "https://spitmux.me,https://www.spitmux.me,http://localhost:8788,http://127.0.0.1:8788"
).split(",")))

MAX_TEXT = 200
MAX_NAME = 16
ROOM_LINES = 60           # how much of the wall a new arrival is handed
COOLDOWN_S = 3.0          # per address
BURST_PER_MIN = 12        # per address

SCHEMA = """
CREATE TABLE IF NOT EXISTS msg (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,
  name    TEXT    NOT NULL,
  text    TEXT    NOT NULL,
  ip      TEXT    NOT NULL,
  cc      TEXT    NOT NULL DEFAULT '',
  hidden  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS msg_ts ON msg (ts);
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
    c.close()


def clean(s, n):
    """One line of it, no control characters, trimmed to length."""
    s = re.sub(r"[\x00-\x1f\x7f]", " ", str(s or "")).strip()
    return re.sub(r"\s{2,}", " ", s)[:n]


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

        if path in ("/admin", "/admin/"):
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
                    "SELECT id, ts, name, text, cc FROM msg WHERE hidden=0 AND id>? "
                    "ORDER BY id LIMIT 200", (since,)).fetchall()
            else:
                rows = c.execute(
                    "SELECT id, ts, name, text, cc FROM msg WHERE hidden=0 "
                    "ORDER BY id DESC LIMIT ?", (ROOM_LINES,)).fetchall()
                rows = list(reversed(rows))
            c.close()
            return self.reply(200, {"lines": [dict(r) for r in rows]})

        if path.startswith("/api/admin/"):
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

            c = db()
            why = banned(c, ip, name)
            if why is not None:
                c.close()
                return self.reply(403, {"error": why or "you are not welcome here"})
            slow = too_fast(ip)
            if slow:
                c.close()
                return self.reply(429, {"error": slow})

            ts = int(time.time() * 1000)
            with c:
                cur = c.execute(
                    "INSERT INTO msg (ts, name, text, ip, cc) VALUES (?,?,?,?,?)",
                    (ts, name, text, ip, cc))
            rid = cur.lastrowid
            c.close()
            return self.reply(200, {"line": {"id": rid, "ts": ts, "name": name,
                                             "text": text, "cc": cc}})

        if path.startswith("/api/admin/"):
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
                with c:
                    c.execute("UPDATE msg SET hidden=1 WHERE id=?", (int(d.get("id") or 0),))
                c.close()
                return self.reply(200, {"hidden": d.get("id")})

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
