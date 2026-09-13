#!/usr/bin/env bash
#
# Stand up the bug chat's bot on the homelab. Run it as spitmux, on the box.
#
#     ./setup-bot.sh [--brain /path/to/spitmux-brain]
#
# It builds the one thing the bot needs that is not in this repository: an
# isolated Hermes profile with a cheap model, no tools, and the standing
# orders in its SOUL.md so the Telegram side of the bot obeys the same rules
# the chat side does. Then it puts the knowledge pack where the bot expects to
# find it and tells the operator which two secrets are still missing.
#
# It exists as a script rather than a page of instructions because the
# dangerous parts are the ones that are easy to do by hand and hard to undo:
# editing the wrong profile, restarting the wrong gateway, or leaving
# platform_toolsets holding a YAML null that silently means "all seventeen
# toolsets on". Every one of those is a step in here, done the same way every
# time, with a guard in front of it.
#
# What it will not do, ever:
#
#   - touch the default profile, ~/.hermes/config.yaml, ~/.hermes/.env or
#     anything else at the root of ~/.hermes. It reads that directory and
#     writes only inside profiles/spitmuxbot.
#   - start, stop, restart or reconfigure hermes-gateway.service, which is the
#     owner's own agent. It notes that service's PID before and after so the
#     run can be seen not to have disturbed it.
#   - run `hermes update`.
#   - start anything. It prints the commands and stops; deciding when the bot
#     starts talking is the operator's.
#   - write a secret value anywhere, print one, or pass one on a command line
#     where ps can see it. Secrets are referred to by name and by the line
#     they belong on.
#
# It is safe to run twice. Every step checks the state it wants before
# changing anything, and says "already correct" when there is nothing to do.

set -euo pipefail

PROFILE="${BOT_PROFILE:-spitmuxbot}"
HERMES_ROOT="${HERMES_ROOT:-$HOME/.hermes}"
PROFILE_HOME="$HERMES_ROOT/profiles/$PROFILE"
HERMES_BIN="${BOT_HERMES:-$HOME/.local/bin/hermes}"
VENV_PY="$HERMES_ROOT/hermes-agent/venv/bin/python"

SERVE_DIR="${BOT_SERVE_DIR:-/opt/bugchat}"
BRAIN_DST="$SERVE_DIR/brain"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_SRC="${BOT_BRAIN_SRC:-$HERE/../../spitmux-brain}"

GATEWAY="hermes-gateway.service"
STAMP="$(date +%Y%m%d-%H%M%S)"

while [ $# -gt 0 ]; do
  case "$1" in
    --brain) BRAIN_SRC="$2"; shift 2 ;;
    -h|--help) sed -n '2,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "setup-bot: unknown argument: $1" >&2; exit 2 ;;
  esac
done

say()  { printf '\n== %s\n' "$*"; }
did()  { printf '   %s\n' "$*"; }
die()  { printf '\nsetup-bot: %s\n' "$*" >&2; exit 1; }

# ── guards ───────────────────────────────────────────────────────────────
# All of these are about one thing: never being pointed at the default
# profile. A typo in BOT_PROFILE, an inherited HERMES_HOME, or a profile path
# that resolves somewhere unexpected would each end with this script editing
# the owner's own agent.

say "checking where this is about to write"
[ "$PROFILE" != "default" ] || die "refusing to touch the default profile"
[ -n "$PROFILE" ] || die "BOT_PROFILE is empty"
case "$PROFILE" in */*|.*) die "'$PROFILE' is not a plain profile name" ;; esac
[ "$PROFILE_HOME" != "$HERMES_ROOT" ] || die "the profile path resolved to the hermes root"
case "$PROFILE_HOME" in
  "$HERMES_ROOT"/profiles/*) ;;
  *) die "the profile path is outside $HERMES_ROOT/profiles" ;;
esac
if [ -n "${HERMES_HOME:-}" ] && [ "$HERMES_HOME" != "$PROFILE_HOME" ]; then
  die "HERMES_HOME is set to $HERMES_HOME -- unset it and run this again"
fi
[ -x "$HERMES_BIN" ] || die "no hermes at $HERMES_BIN"
[ -x "$VENV_PY" ] || die "no hermes python at $VENV_PY"
did "profile        $PROFILE"
did "profile home   $PROFILE_HOME"
did "knowledge pack $BRAIN_SRC  ->  $BRAIN_DST"
did "hermes         $HERMES_BIN"

# The owner's gateway, before. Printed, never touched. `systemctl show` reads
# state and starts nothing.
GW_BEFORE="$(systemctl show -p MainPID -p ActiveEnterTimestamp --value "$GATEWAY" 2>/dev/null | tr '\n' ' ')"
did "owner's gateway (untouched)  $GATEWAY  $GW_BEFORE"

# ── the profile ──────────────────────────────────────────────────────────

say "the $PROFILE profile"
if [ -d "$PROFILE_HOME" ]; then
  did "already there, leaving it alone"
else
  did "creating it"
  # --no-skills still seeds one "essentials" skill; harmless, and with every
  # toolset disabled below there is nothing for a skill to reach anyway.
  "$HERMES_BIN" profile create "$PROFILE" --no-skills \
      --description "Answers questions about spitmux GTA V mods." >/dev/null
  did "created $PROFILE_HOME"
  # `hermes profile create` also drops a ~/.local/bin/$PROFILE wrapper that is
  # `exec hermes -p $PROFILE "$@"`. It dies 127 under systemd, where
  # ~/.local/bin is not on the path. Nothing here or in bot.py uses it.
fi
[ -d "$PROFILE_HOME" ] || die "the profile directory is still not there"

# ── the model, and the tools ─────────────────────────────────────────────
# Both live in the profile's config.yaml, and both have a failure mode that
# looks like success:
#
#   - `-t ""` normalises to None and quietly falls back to whatever the config
#     says, and `-t none` is not a toolset and aborts. Neither flag can
#     express "no tools"; only these config keys can.
#   - a bare `cli:` with no value is YAML null, which silently means the full
#     default set, and any platform not named keeps its full default. So every
#     platform is named, each with an empty LIST.
#   - agent.disabled_toolsets is applied last and globally, so it is the one
#     that actually settles it. It is filled from the running Hermes' own
#     toolset registry rather than a list typed in here, so an upgrade that
#     adds a toolset does not quietly hand this profile a new tool.

say "config.yaml: deepseek-flash, and every toolset off"
"$VENV_PY" - "$PROFILE_HOME/config.yaml" "$STAMP" <<'PY'
import os, sys, shutil, yaml

path, stamp = sys.argv[1], sys.argv[2]

# Every platform Hermes knows how to speak on. One not named here keeps the
# full seventeen-toolset default, which is the whole trap.
PLATFORMS = ["cli", "telegram", "discord", "slack", "whatsapp", "signal",
             "teams", "google_chat", "qqbot", "homeassistant", "yuanbao"]

try:
    import toolsets
    # get_toolset_names() is the registry; TOOLSETS is only the static half of
    # it. Reading the static dict left anything a plugin had registered out of
    # the disable list, and therefore enabled -- on this box that was `a2a`,
    # silently. Having to name the two composites by hand below was the clue
    # that the dict was the wrong source all along.
    names = set(toolsets.get_toolset_names())
except AttributeError:
    names = set(toolsets.TOOLSETS) | {"hermes-teams", "hermes-google_chat"}
    sys.stderr.write("setup-bot: no get_toolset_names() in this Hermes; fell "
                     "back to the static table, so check afterwards for a "
                     "toolset still enabled\n")
except Exception as e:                       # pragma: no cover -- see below
    sys.stderr.write("setup-bot: cannot read the toolset registry (%s)\n" % e)
    sys.exit(1)

cfg = {}
if os.path.exists(path):
    with open(path, "r", encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh.read()) or {}
was = yaml.safe_dump(cfg, sort_keys=True, default_flow_style=False)

cfg.setdefault("model", {}).update({
    "provider": "deepseek",
    "base_url": "https://api.deepseek.com/v1",
    # An alias: on the wire the model field is deepseek-v4-flash. Priced the
    # same either way in the box's own models_dev_cache.json.
    "default": "deepseek-flash",
})
cfg["plugins"] = {"enabled": []}
cfg["platform_toolsets"] = dict((p, []) for p in PLATFORMS)
cfg.setdefault("agent", {})["disabled_toolsets"] = sorted(names)
# Hermes' own API timeout defaults to 1800 seconds. A daemon calling this
# every few seconds cannot afford a request that blocks for half an hour.
cfg.setdefault("providers", {}).setdefault("deepseek", {}).update({
    "request_timeout_seconds": 60,
    "stale_timeout_seconds": 60,
})

now = yaml.safe_dump(cfg, sort_keys=True, default_flow_style=False)
if now == was:
    print("   already correct (%d toolsets disabled, %d platforms empty)"
          % (len(names), len(PLATFORMS)))
    sys.exit(0)

if os.path.exists(path):
    keep = "%s.bak-%s" % (path, stamp)
    shutil.copy2(path, keep)
    print("   kept the old one at %s" % keep)
    print("   note: rewriting this file drops Hermes' seeded comments; the")
    print("   backup above still has them")

head = ("# Written by setup-bot.sh. Edit that script rather than this file:\n"
        "# a re-run rewrites everything below.\n"
        "#\n"
        "# platform_toolsets must hold empty LISTS, never a bare key -- a bare\n"
        "# key is YAML null and silently means the full default toolset.\n"
        "# agent.disabled_toolsets is applied last and globally, and is what\n"
        "# actually leaves the model with no tools on the wire.\n\n")
tmp = path + ".tmp"
with open(tmp, "w", encoding="utf-8") as fh:
    fh.write(head + now)
os.replace(tmp, path)
os.chmod(path, 0o600)
print("   wrote it: model deepseek-flash, %d toolsets disabled, %d platforms empty"
      % (len(names), len(PLATFORMS)))
PY

# ── the standing orders ──────────────────────────────────────────────────
# SOUL.md is the only file in a profile that reaches the model on both the
# one-shot path and the gateway path. IDENTITY.md, AGENTS.md and DREAMS.md do
# not: two have no loader at all in the runtime path, and AGENTS.md is a
# project file read from the working directory, not from a profile. Leaving
# them in a profile is a trap for whoever reads it next, so any that turn up
# get moved aside.

say "SOUL.md: the standing orders, from the knowledge pack's rules.md"
RULES="$BRAIN_SRC/rules.md"
[ -f "$RULES" ] || die "no rules.md at $RULES -- point --brain at the knowledge pack"
SOUL="$PROFILE_HOME/SOUL.md"
NEW_SOUL="$(mktemp)"
trap 'rm -f "$NEW_SOUL"' EXIT
{
  printf '%s\n' "<!-- Installed by setup-bot.sh from the knowledge pack's rules.md."
  printf '%s\n' "     Edit rules.md and run setup-bot.sh again. Changes made here are"
  printf '%s\n' "     overwritten, and an empty SOUL.md silently falls back to a generic"
  printf '%s\n\n' "     built-in identity, so it must never be blank. -->"
  cat "$RULES"
} > "$NEW_SOUL"
if [ -f "$SOUL" ] && cmp -s "$NEW_SOUL" "$SOUL"; then
  did "already correct"
else
  if [ -f "$SOUL" ]; then
    cp -p "$SOUL" "$SOUL.bak-$STAMP"
    did "kept the old one at $SOUL.bak-$STAMP"
  fi
  install -m 0644 "$NEW_SOUL" "$SOUL"
  did "wrote $(wc -c < "$SOUL") bytes to $SOUL"
fi
[ -s "$SOUL" ] || die "SOUL.md came out empty, which would fall back to a generic identity"

for stray in IDENTITY.md AGENTS.md DREAMS.md; do
  if [ -f "$PROFILE_HOME/$stray" ]; then
    mv "$PROFILE_HOME/$stray" "$PROFILE_HOME/$stray.unused-$STAMP"
    did "moved $stray aside: nothing in the runtime path ever reads it here"
  fi
done

# ── the knowledge pack ───────────────────────────────────────────────────
# Checked before it is copied, because the copy is a mirror: a --delete onto
# the wrong source directory would empty the brain the bot answers from.

say "knowledge pack -> $BRAIN_DST"
[ -d "$BRAIN_SRC" ] || die "no knowledge pack at $BRAIN_SRC"
for want in rules.md index.md; do
  [ -f "$BRAIN_SRC/$want" ] || die "$BRAIN_SRC has no $want -- that is not the knowledge pack"
done
BRIEFS="$(find "$BRAIN_SRC/mods" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)"
[ "$BRIEFS" -gt 0 ] || die "$BRAIN_SRC/mods holds no briefs"
did "found rules.md, index.md and $BRIEFS briefs"
sudo install -d -m 0755 -o root -g root "$BRAIN_DST"
# A mirror, not a copy: --delete so a brief that was renamed or withdrawn
# stops being answered from, and --delete-excluded so nothing else lingers
# there either. That is why the source is checked first -- with --delete, the
# wrong source directory empties the brain. -rlt rather than -a, so ownership
# comes from --chown and a second run has nothing left to change.
sudo rsync -rlt --delete --delete-excluded --chmod=D0755,F0644 --chown=root:root \
     --include='rules.md' --include='index.md' \
     --include='mods/' --include='mods/*.md' --exclude='*' \
     "$BRAIN_SRC/" "$BRAIN_DST/"
did "mirrored: $(sudo find "$BRAIN_DST" -type f | wc -l) files, $(sudo du -sh "$BRAIN_DST" | cut -f1)"
did "root-owned and world-readable: the bot only ever reads it"

# ── the bot itself ───────────────────────────────────────────────────────

say "bot.py -> $SERVE_DIR/bot.py"
if [ -f "$HERE/bot.py" ]; then
  if cmp -s "$HERE/bot.py" "$SERVE_DIR/bot.py" 2>/dev/null; then
    did "already the same file"
  else
    sudo install -m 0644 "$HERE/bot.py" "$SERVE_DIR/bot.py"
    did "installed $(wc -c < "$HERE/bot.py") bytes"
    did "a running spitmux-bot will not pick this up until it is restarted"
  fi
  /usr/bin/python3 -c "import ast,io,sys; ast.parse(io.open(sys.argv[1],encoding='utf-8').read())" \
      "$SERVE_DIR/bot.py" 2>/dev/null && did "it parses" || die "$SERVE_DIR/bot.py does not parse"
else
  did "not beside this script -- skipping"
fi

# ── the .env, by name only ───────────────────────────────────────────────
# Created with placeholders if it is not there, and never rewritten if it is:
# by the second run it may hold the real values, and nothing in this script is
# worth overwriting those for.

say "the profile's .env"
ENVF="$PROFILE_HOME/.env"
if [ -f "$ENVF" ]; then
  did "already there, not touching it"
else
  umask 077
  cat > "$ENVF" <<'ENVEOF'
# Per-profile secrets for the spitmuxbot Hermes profile. This file is 0600 and
# is read by Hermes itself; nothing else on the box reads it, and neither
# bot.py nor setup-bot.sh ever opens it for its values.
#
# No quotes. No spaces around the "=".

# DeepSeek inference key for deepseek-flash (deepseek-v4-flash on the wire).
DEEPSEEK_API_KEY=FILL_ME

# Telegram bot token from @BotFather. It MUST be a brand-new bot, not the one
# the default profile uses -- two pollers on one token fight over getUpdates.
# Leave it as FILL_ME if the bot is only wanted in the chat room.
TELEGRAM_BOT_TOKEN=FILL_ME

# Who may talk to it on Telegram: comma-separated numeric user IDs, or * for
# everybody. Empty or unset is fail-closed and denies all.
TELEGRAM_ALLOWED_USERS=
ENVEOF
  chmod 600 "$ENVF"
  did "created it with placeholders, 0600"
fi

# ── what is left for the operator ────────────────────────────────────────

say "what is still missing"
printf '\n   %s\n' "$ENVF"
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/ {
    name = $1
    v = $0; sub(/^[^=]*=/, "", v)
    if (v == "" || v == "FILL_ME")
        printf "     line %-3d %-24s NOT SET\n", NR, name
    else
        printf "     line %-3d %-24s set (%d characters)\n", NR, name, length(v)
  }' "$ENVF"
printf '   %s\n' "(lengths only -- this script never reads or prints a value)"

cat <<TXT

   Put the two values in with an editor, on the box:

     DEEPSEEK_API_KEY      from the DeepSeek console. Required: with it unset
                           every run exits 1 with "No usable credentials".
     TELEGRAM_BOT_TOKEN    from @BotFather, a NEW bot. Only needed for the
                           Telegram side. Leave it at FILL_ME otherwise.
     TELEGRAM_ALLOWED_USERS  numeric Telegram user IDs, comma separated, or *
                           for anyone. Empty denies everyone.

   And one more, in the unit rather than in a file:

     BUGCHAT_TOKEN         the chat's admin token, the same value already in
                           /etc/systemd/system/bugchat.service. Copy it across
                           with 'sudo systemctl edit spitmux-bot' so it lands
                           in a 0600 drop-in and never in this repository.

TXT

say "next, when you want it talking"
cat <<TXT
   sudo install -m 0600 $HERE/bot.service /etc/systemd/system/spitmux-bot.service
   sudo systemctl edit spitmux-bot          # [Service] Environment=BUGCHAT_TOKEN=...
   sudo systemctl daemon-reload
   sudo systemctl enable --now spitmux-bot
   journalctl -u spitmux-bot -f

   To watch it decide without letting it speak, set BOT_DRY_RUN=1 in the unit
   first. To try the model on its own, without the chat:

   $HERMES_BIN -p $PROFILE -z "say hello in five words" --usage-file /tmp/u.json
   cat /tmp/u.json     # trust 'completed', not the exit code: a 401 exits 0

   For the Telegram side, once TELEGRAM_BOT_TOKEN is in:

   $HERMES_BIN -p $PROFILE gateway install
   $HERMES_BIN -p $PROFILE gateway start

   That installs a user unit called hermes-gateway-$PROFILE. The owner's is a
   system unit called hermes-gateway -- different name, different scope,
   different socket. Neither one sees the other.
TXT

GW_AFTER="$(systemctl show -p MainPID -p ActiveEnterTimestamp --value "$GATEWAY" 2>/dev/null | tr '\n' ' ')"
say "the owner's gateway, checked either side of all that"
did "before  $GW_BEFORE"
did "after   $GW_AFTER"
if [ "$GW_BEFORE" = "$GW_AFTER" ]; then
  did "unchanged, as it should be"
else
  did "CHANGED -- nothing here restarts it, so look at what else did"
fi

say "done. Running this again changes nothing that is already correct."
