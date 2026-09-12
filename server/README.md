# The bug chat's server

The room on the right of spitmux.me. It runs on the homelab, not on Pages:
Pages serves files and nothing else, and a room needs somewhere to put what
people say.

    bugchat.py      the whole thing: an HTTP service and one SQLite file
    chat.db         every line ever said, and the ban list  (not in git)

Python's standard library only. No framework, no packages, nothing to keep
up to date but this file.

## Where it runs

    homelab (192.168.1.253), Debian 13
    /opt/bugchat/bugchat.py                  the service
    /var/lib/bugchat/chat.db                 the room
    /etc/systemd/system/bugchat.service      the unit  (0600: it holds the token)
    port 8712, LAN only

```bash
sudo systemctl status bugchat
sudo journalctl -u bugchat -f
```

The service never faces the internet directly. Cloudflare's tunnel dials out
from the homelab, so visitors reach `chat.spitmux.me` at Cloudflare's address
and the house's own address appears nowhere -- which is the point of doing it
this way rather than opening a port.

## Talking to it

The room, as anyone sees it:

    GET  /api/room?since=<id>     lines after that id, oldest first
    POST /api/say                 {name, text, cc} -> the line, or why not
    GET  /api/health              a word about the room

`/api/say` answers 403 if the address or the handle is barred (with the
reason), 429 if it is being hammered, 400 if there is nothing in it.

Only these three are public, and none of them return an address.

## The warden

A page for doing all of that with a mouse: `https://chat.spitmux.me/admin`, or
`http://192.168.1.253:8712/admin` from the house. The chat service serves it
itself, so it is the same origin as the API it drives and CORS never comes
into it, and there is nothing installed anywhere to fall out of step.

It shows every line with its address, filters on any of it, hides a line, bars
an address or a whole /24 or a handle, lifts a ban, and exports the lot as
JSON. It polls every five seconds. The token is asked for once and kept in
that browser; six wrong guesses and the address that made them waits five
minutes.

On Windows, `warden.cmd` opens it as a window with no browser furniture --
there is a shortcut on the desktop pointing at it. It prefers the homelab
directly when it can see it, so it keeps working with the tunnel down.

## Moderating it from a terminal

Everything below wants `X-Admin-Token`, which is `BUGCHAT_TOKEN` in the unit
file. It is not in this repository and must not be: the repository is public.

```bash
T=$(sudo grep -oP 'BUGCHAT_TOKEN=\K.*' /etc/systemd/system/bugchat.service)
H=http://127.0.0.1:8712

# who said what, addresses and all
curl -s -H "X-Admin-Token: $T" "$H/api/admin/log?limit=50" | python3 -m json.tool

# show somebody the door, and take down what they already said
curl -s -X POST "$H/api/admin/ban" -H "X-Admin-Token: $T" \
     -H 'Content-Type: application/json' \
     -d '{"ip":"203.0.113.44","reason":"spam","purge":1}'

# a whole /24, if they are hopping addresses -- note the trailing dot
curl -s -X POST "$H/api/admin/ban" -H "X-Admin-Token: $T" \
     -H 'Content-Type: application/json' -d '{"ip":"203.0.113.","reason":"spam"}'

# or a handle, whatever address it comes from
curl -s -X POST "$H/api/admin/ban" -H "X-Admin-Token: $T" \
     -H 'Content-Type: application/json' -d '{"name":"nuisance"}'

curl -s -X POST "$H/api/admin/unban" -H "X-Admin-Token: $T" \
     -H 'Content-Type: application/json' -d '{"ip":"203.0.113.44"}'

# one line off the wall
curl -s -X POST "$H/api/admin/hide" -H "X-Admin-Token: $T" \
     -H 'Content-Type: application/json' -d '{"id":41}'

curl -s -H "X-Admin-Token: $T" "$H/api/admin/bans" | python3 -m json.tool
curl -s -H "X-Admin-Token: $T" "$H/api/admin/export" > chat-backup.json
```

Or read the room straight out of the file, which is often faster:

```bash
sudo -u spitmux sqlite3 -header -column /var/lib/bugchat/chat.db \
  "SELECT datetime(ts/1000,'unixepoch','localtime') AS when_, name, ip, text
   FROM msg ORDER BY id DESC LIMIT 40;"
```

## On addresses

A line's address is written down, because banning is the point and you cannot
ban what you did not record. It never leaves the server: `/api/room` returns a
name, a country, a time and a line, and that is all the page ever sees. The
panel on the site says so plainly rather than pretending otherwise.

## Putting it somewhere else

Three environment variables, all optional:

    BUGCHAT_PORT     8712
    BUGCHAT_DB       ./chat.db
    BUGCHAT_TOKEN    unset -- and with it unset the admin half does not answer
    BUGCHAT_ORIGINS  who may ask, comma separated. Anything not on the list
                     gets no CORS header, so the room cannot be embedded in
                     somebody else's page.

The site finds the room through `<meta name="chat-api">` in index.html. Empty
means there is no room, and the panel says exactly that.
