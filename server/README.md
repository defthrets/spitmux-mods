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

A page for doing all of that with a mouse: `http://192.168.1.253:8712/admin`,
**on the house network only**. The service tells anything arriving through the
tunnel that there is nothing there -- not a login, not a 403, nothing to say
the admin half exists at all. The room is public; the keys to it are not.

The chat service serves the page itself, so it is the same origin as the API
it drives and CORS never comes into it, and there is nothing installed
anywhere to fall out of step.

It shows every line with its address and the country Cloudflare stamped on it,
filters on any of that, and per line: **hide** (off the public wall, still
here, reversible with **restore**), **delete** (gone for good), and three ways
to bar whoever said it. **delete hidden** clears out everything already taken
down; **wipe** empties the room. Both write the lot to
`/var/lib/bugchat/backups/` first and refuse to delete if they cannot -- undoing
a wipe should cost a copy and paste, not an apology. There is also an export to
JSON. It polls every five seconds. The token is asked for once and kept in
that browser; six wrong guesses and the address that made them waits five
minutes.

On Windows, `warden.cmd` opens it as a window with no browser furniture --
there is a shortcut on the desktop pointing at it. Off the house network it
says so rather than opening a window onto a 404.

To moderate from away, put the phone or laptop on the house network first --
a VPN home, or Tailscale, or anything that makes the LAN reachable. Opening
the admin half to the internet again is one line in `from_outside()`, and is
not recommended.

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

# one line, for good
curl -s -X POST "$H/api/admin/delete" -H "X-Admin-Token: $T"      -H 'Content-Type: application/json' -d '{"id":41}'

# everything already hidden, or the whole room -- a copy is kept either way
curl -s -X POST "$H/api/admin/delete" -H "X-Admin-Token: $T"      -H 'Content-Type: application/json' -d '{"what":"hidden"}'
curl -s -X POST "$H/api/admin/delete" -H "X-Admin-Token: $T"      -H 'Content-Type: application/json' -d '{"what":"all"}'

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

## The bot

    bot.py          reads the room, answers a little of it, shuts up a lot
    bot.service     the unit  (0600: it holds the same token bugchat does)
    setup-bot.sh    stands it up on the homelab; safe to run twice

A visitor asks "why does Fumes crash on startup?" in the room. The bot works
out that the question is about Fumes, hands the Fumes brief and the question
to a local Hermes profile, and posts the answer back as a threaded reply
wearing the `bot` badge. That is the whole of it.

The interesting half is everything it does not answer. A bot that replies to
every line turns a twenty-line-a-day room into a wall of bot, and the people
who were talking to each other leave. So the default is silence. A line gets
an answer only if it says `ratboy` or `bot`, or ends in a question mark and
either names a mod or sounds like a fault. It never answers a line with a
badge on it -- that is the house, or itself -- never one under its own name,
never the same line twice, and on a cold start never anything that was already
on the wall.

Beyond that it holds itself back on purpose: twenty seconds between answers,
twelve an hour, eighty a day, six a day for any one name, and a daily spend
ceiling. Hitting any of those means going quiet and saying so once in the log,
not crashing, and not apologising in the room. Every one of them is an
environment variable in the unit; the defaults are the constants at the top of
`bot.py`.

It answers in at most 200 characters, because that is what the chat stores,
and it would rather split across two lines at a full stop than be cut off
mid-word by the server. If a call times out, exits non-zero, comes back empty
or comes back as a provider error, it says nothing at all. An error message in
a chat room is noise nobody can act on, and whatever produced it will produce
it again in three seconds.

### Starting and stopping

```bash
sudo systemctl start spitmux-bot
sudo systemctl stop spitmux-bot
sudo systemctl status spitmux-bot
```

Stopping the bot does nothing to the room -- `bugchat` keeps running and people
keep talking. They are separate units, and the bot is only ever a client of
the chat, over loopback, like any other.

First time, on the homelab:

```bash
./setup-bot.sh --brain /path/to/spitmux-brain
sudo install -m 0600 bot.service /etc/systemd/system/spitmux-bot.service
sudo systemctl edit spitmux-bot        # Environment=BUGCHAT_TOKEN=...
sudo systemctl daemon-reload
sudo systemctl enable --now spitmux-bot
```

`setup-bot.sh` builds the isolated Hermes profile `spitmuxbot`, points it at
`deepseek-flash`, switches every toolset off, installs the standing orders as
that profile's `SOUL.md` so the Telegram side of the bot obeys the same rules
the chat side does, mirrors the knowledge pack into `/opt/bugchat/brain`, and
then prints which secrets are still missing and where they go. It changes
nothing that is already correct, so running it again is also how you update.

It will not touch the `default` Hermes profile, will not restart
`hermes-gateway.service` -- that is the owner's own agent, and unrelated to
this -- and will not start anything. It prints the last few commands and
stops.

Two secrets, in two places, neither of them in this repository:

    BUGCHAT_TOKEN       in the unit, the same value bugchat.service has
    DEEPSEEK_API_KEY    in ~/.hermes/profiles/spitmuxbot/.env, 0600

The bot process only ever holds the first. Hermes reads its own key out of the
profile's `.env`, so the key for the model never enters the bot's environment
and cannot come back out in its log.

`TELEGRAM_BOT_TOKEN` goes in the same `.env`, and is only needed if the bot is
wanted on Telegram as well. It has to be a brand-new bot from @BotFather: two
pollers on one token fight over `getUpdates`.

### Shutting it up in a hurry

Fastest, and the one to reach for:

```bash
sudo systemctl stop spitmux-bot
```

It is a client, not part of the room. Nothing else notices.

To keep it watching but stop it speaking -- useful when you want to see what it
*would* have said:

```bash
sudo systemctl edit spitmux-bot        # Environment=BOT_DRY_RUN=1
sudo systemctl restart spitmux-bot
journalctl -u spitmux-bot -f
```

To turn it down rather than off, set `BOT_PER_HOUR`, `BOT_COOLDOWN_S` or
`BOT_SPEND_DAY_USD` the same way.

It also shuts itself up in one case, on purpose. If a line it posted comes back
without the `bot` badge, the admin token was not accepted and it has just
spoken as an ordinary visitor. It stops posting entirely at that point and says
so in the log, rather than filling the wall with unbadged lines while nobody is
looking. That one needs a restart -- and a look at the token -- to clear.

If it has already said something it should not have, it is a line like any
other: hide it or delete it in the warden.

### Updating the knowledge pack after a mod changes

The briefs live in `spitmux-brain`, not here. Edit the brief, then re-run the
setup script from the homelab:

```bash
./setup-bot.sh --brain /path/to/spitmux-brain
```

That step is a mirror, so a brief that was renamed or withdrawn stops being
answered from. Nothing else in the profile changes if nothing else needs to.

The bot re-reads a brief on every question, so a brief edit takes effect on the
next one. `rules.md` and `index.md` are read once at startup, so those two want
a `systemctl restart spitmux-bot` after. Standing orders are installed into the
profile's `SOUL.md` as well, which is what the Telegram side reads, and that
is done by the same script for the same reason.

`index.md` is the routing table, and the only reason any of this fits. Ten
briefs at twenty to forty kilobytes each will not go in one prompt, so the bot
matches the question against the alias list in `index.md` and sends that one
brief. A new mod needs a `## Heading` there with `id`, `brief` and `aliases`
lines, or nothing will ever route to it. Aliases shorter than four characters
are ignored on purpose -- `VT`, `gas` and `5-0` are all real aliases in that
file, and each of them would drag a good part of an ordinary conversation to
the wrong brief.

### Checking what it has been saying, and spending

```bash
sudo journalctl -u spitmux-bot -f
sudo journalctl -u spitmux-bot --since today | grep -E 'hermes|answered|quiet'
```

Every answer leaves three lines: what it saw and why it decided to answer, how
long Hermes took with the token counts and the cost, and the id of the line it
posted. Ceilings log once each when they bite. There is no token in any of it
and no address in any of it -- `/api/room` does not serve addresses, so there
is nothing there to spill by accident.

Today's running total, and the counters behind it:

```bash
sudo cat /var/lib/spitmux-bot/state.json | python3 -m json.tool
```

`day_spend` is summed from Hermes' own `--usage-file`, which is
provider-reported rather than guessed at. Where a run reports nothing back a
flat figure is added instead, so a string of null costs cannot let the ceiling
sleep through an expensive day. Reasoning tokens are billed at the output rate
and cannot be switched off on this build, so the real spend runs above what
the input tokens alone would suggest.

That file is also the cursor, so deleting it makes the bot forget where it had
got to: on the next start it takes the cursor to the end of the wall and
answers nothing already on it.

The bot's own side of the room, straight out of the database:

```bash
sudo -u spitmux sqlite3 -header -column /var/lib/bugchat/chat.db \
  "SELECT datetime(ts/1000,'unixepoch','localtime') AS when_, name, reply, text
   FROM msg WHERE badge='bot' ORDER BY id DESC LIMIT 40;"
```

### Why the briefs are not in this repository

This repository is published by GitHub Pages. Everything in it is on the
internet at spitmux.me the moment it is pushed, and a brief is not a readme --
it is twenty to forty kilobytes of how a mod actually works, written for a
machine that has to answer questions about it without guessing.

Four of the ten mods are not released. Weapon Tweaks, Five0 Patrol, Bloody Mess
and Franklin RP have no public download, and their briefs describe the
settings, keys and behaviour of builds nobody outside has. Publishing those
would be handing out the documentation for something that does not exist yet.

So the pack lives in `spitmux-brain`, deploys to `/opt/bugchat/brain` on the
homelab, and is read there by the bot and nowhere else. The bot answers *from*
a brief and never reproduces one wholesale -- 200 characters does not leave
room to -- and its standing orders say plainly that an unreleased mod has no
download and no link.
