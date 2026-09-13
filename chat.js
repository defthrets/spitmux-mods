// ─── The bug chat ───────────────────────────────────────────────────────────
// Anonymous, and ours.
//
// It talks to a small service on the homelab (server/bugchat.py): one SQLite
// file holding every line ever said, a ban list, and nothing else. That is
// what a public broker could not do -- keep a week of chat, and shut the door
// on somebody.
//
// The address of the room is in a meta tag rather than in here, so the site
// can be pointed somewhere else without a code change. Nothing is loaded and
// nothing is asked of the network until the panel is opened.
//
// A name sticks to whoever had it first. This browser makes one secret, keeps
// it, and sends it with every line; the server holds the name against that
// secret and turns away anybody else who tries to wear it. The secret says
// "the same one as last time" and nothing more -- it is not a login, there is
// nothing to recover, and clearing this browser's storage means starting again
// under a new name.
//
// What the page can see: a name, a country, a time, a line, and what it was
// answering. Addresses are the server's business and never come back here.

window.BUGCHAT = (function () {
  "use strict";

  var POLL_MS = 2500;
  var MAX_TEXT = 200;
  var MAX_NAME = 16;
  var KEEP = 120;                 // lines held in the panel
  var GROUP_MS = 4 * 60 * 1000;   // one person's lines, close together, join up

  var base = "", host = null, cb = null, lines = [], last = 0, timer = null;
  var stopped = false, answering = null;

  /* The site's own pixel art, small enough to sit in a sentence. A fixed list,
     not a path anyone can type: the code is a key here, never part of a URL,
     so the worst a stranger can put in a message is a colon. */
  var EMO = {
    bag: "hoodrich", burger: "bare-minimum", can: "fumes", paint: "overspray",
    cop: "five0patrol", wheel: "vehicle-tweaks", blood: "bloodymess",
    bandana: "franklin-rp", gun: "weapon-tweaks", golf: "streetgolf",
    demon: "demon", spook: "bubble"
  };
  var EMO_RE = new RegExp(":(" + Object.keys(EMO).join("|") + "):", "g");
  var ART = (document.querySelector('meta[name="art-v"]') || {}).content || "";

  /* The same list the server keeps, so the answer comes back before a whole
     message has been typed rather than after. The server decides; this is
     only manners. */
  var RESERVED = ["spitmux", "defthrets", "ratboy", "admin", "moderator",
                  "owner", "operator", "warden", "official", "staff", "system"];
  var LOOKALIKE = { "0":"o","1":"i","3":"e","4":"a","5":"s","6":"g","7":"t",
                    "8":"b","9":"g","$":"s","@":"a","!":"i","|":"i","+":"t" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function T(k, v) { return window.I18N ? window.I18N.t(k, v) : k; }
  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function reserved(name) {
    var flat = "";
    String(name).toLowerCase().split("").forEach(function (ch) {
      ch = LOOKALIKE[ch] || ch;
      if (ch >= "a" && ch <= "z") flat += ch;
    });
    for (var i = 0; i < RESERVED.length; i++) {
      if (flat.indexOf(RESERVED[i]) > -1) return RESERVED[i];
    }
    return null;
  }

  function handle() {
    var n = get("chat:name", "");
    // A browser that had one of the reserved names before they were reserved
    // would be refused every line it tried to send, with no obvious way out.
    // Give it a fresh one instead of a dead end.
    if (!n || reserved(n)) {
      n = "anon-" + Math.random().toString(16).slice(2, 6);
      put("chat:name", n);
    }
    return n.slice(0, MAX_NAME);
  }

  // the secret that makes the name yours. Made once, kept, never shown.
  function secret() {
    var k = get("chat:key", "");
    if (!k) {
      for (var i = 0; i < 4; i++) k += Math.random().toString(36).slice(2, 10);
      put("chat:key", k.slice(0, 32));
    }
    return get("chat:key", k);
  }

  function clock(t) {
    var d = new Date(t);
    try {
      return d.toLocaleTimeString(document.documentElement.lang || "en",
                                  { hour: "numeric", minute: "2-digit", hour12: true })
              .replace(/\bAM\b/, "am").replace(/\bPM\b/, "pm");
    } catch (e) { return d.getHours() + ":" + d.getMinutes(); }
  }

  // run over ESCAPED text, so the only markup here is the markup put here
  function emoji(safe) {
    return safe.replace(EMO_RE, function (whole, code) {
      return '<img class="emo" alt="' + whole + '" title="' + whole + '" src="' +
             icon(EMO[code]) + '">';
    });
  }
  function icon(name) { return "icons/" + name + ".gif" + (ART ? "?v=" + ART : ""); }

  function flagOf(cc) {
    return /^[A-Z]{2}$/.test(cc || "")
      ? '<img class="flag" alt="" width="14" height="10" src="https://flagcdn.com/' +
        cc.toLowerCase() + '.svg">' : "";
  }

  /* The house, and the thing it runs. Only the server puts these on a line --
     nothing a visitor can type produces one. */
  function badgeOf(b) {
    if (b !== "op" && b !== "bot") return "";
    return '<span class="tag ' + b + '">' + (b === "op" ? T("chat.op") : T("chat.bot")) + "</span>";
  }

  function state(k, live) { if (cb) cb(T(k), live); }

  /* Consecutive lines from one person, close together, are a single turn of
     speaking: only the first carries a name and a time. It reads as a
     conversation rather than a log, and a 300px column gets its width back. */
  function paint() {
    var log = host && host.querySelector(".chat-log");
    if (!log) return;
    var stuck = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
    if (!lines.length) {
      log.innerHTML = '<div class="chat-empty">' + esc(T("chat.empty")) + "</div>";
      return;
    }
    var out = [], prev = null;
    lines.forEach(function (x) {
      var joined = prev && prev.name === x.name && !x.reply && (x.ts - prev.ts) < GROUP_MS;
      out.push('<div class="chat-line' + (joined ? " joined" : "") + '">');
      if (!joined) {
        out.push('<div class="chat-head"><span class="who">' + flagOf(x.cc) + esc(x.name) +
                 badgeOf(x.badge) + '</span><span class="t">' + esc(clock(x.ts)) +
                 "</span></div>");
      }
      if (x.reply && x.re_name) {
        out.push('<div class="chat-re"><span class="who">' + esc(x.re_name) + "</span>" +
                 '<span class="what">' + emoji(esc(x.re_text || "")) + "</span></div>");
      }
      out.push('<div class="say">' + emoji(esc(x.text)) +
               '<button type="button" class="reply" data-reply="' + x.id +
               '" aria-label="' + esc(T("chat.reply")) + '" title="' +
               esc(T("chat.reply")) + '">&#8617;</button></div>');
      out.push("</div>");
      prev = x;
    });
    log.innerHTML = out.join("");
    if (stuck) log.scrollTop = log.scrollHeight;
  }

  function note(msg, bad) {
    var el = host && host.querySelector(".chat-said");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("bad", !!bad);
  }

  function showAnswering() {
    var box = host && host.querySelector(".chat-answering");
    if (!box) return;
    if (!answering) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = '<span class="who">' + esc(answering.name) + "</span>" +
                    '<span class="what">' + emoji(esc(answering.text)) + "</span>" +
                    '<button type="button" class="drop" aria-label="' +
                    esc(T("chat.unreply")) + '">&#215;</button>';
  }

  function add(rows) {
    if (!rows || !rows.length) return;
    rows.forEach(function (r) {
      if (r.id > last) last = r.id;
      lines.push(r);
    });
    if (lines.length > KEEP) lines = lines.slice(-KEEP);
    paint();
  }

  function poll(first) {
    if (stopped) return;
    // A hidden tab is not watching, so it is not asked on anybody's behalf --
    // except the very first time, because a panel opened and then left behind
    // should still have the room in it when you come back to the tab.
    if (document.hidden && !first) { timer = setTimeout(poll, POLL_MS * 2); return; }
    fetch(base + "/api/room" + (last ? "?since=" + last : ""), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) throw new Error("bad reply");
        state("chat.live", true);
        add(d.lines);
        // an empty room should say it is empty, not sit on "joining" for ever
        if (!lines.length) paint();
      })
      .catch(function () { state("chat.offline", false); })
      .then(function () { if (!stopped) timer = setTimeout(poll, POLL_MS); });
  }

  function say(text) {
    var body = { name: handle(), text: text.slice(0, MAX_TEXT), key: secret(),
                 cc: window.VISITOR_CC || get("cc", "") };
    if (answering) body.reply = answering.id;
    fetch(base + "/api/say", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (d) { return [r.status, d]; }); })
      .then(function (pair) {
        var code = pair[0], d = pair[1];
        if (code === 200 && d.line) {
          note("");
          answering = null;
          showAnswering();
          add([d.line]);
          return;
        }
        note(d && d.error ? d.error : T("chat.offline"), true);
      })
      .catch(function () { note(T("chat.offline"), true); });
  }

  function wire() {
    var form = host.querySelector(".chat-form");
    var input = host.querySelector(".chat-say");
    var name = host.querySelector(".chat-name");

    name.value = handle();
    name.addEventListener("change", function () {
      var v = name.value.trim().slice(0, MAX_NAME) || "anon";
      var mine = reserved(v);
      if (mine) {
        note(T("chat.reserved", { name: mine }), true);
        name.value = handle();
        return;
      }
      note("");
      name.value = v;
      put("chat:name", v);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      input.value = "";
      say(v);
    });

    // the tray: click a picture, get its code where the cursor was
    var tray = host.querySelector(".chat-tray");
    host.querySelector(".chat-emo").addEventListener("click", function () {
      tray.hidden = !tray.hidden;
    });
    tray.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-emo]");
      if (!b) return;
      var code = ":" + b.dataset.emo + ":";
      var at = input.selectionStart == null ? input.value.length : input.selectionStart;
      var before = input.value.slice(0, at), after = input.value.slice(at);
      if (before && !/\s$/.test(before)) code = " " + code;
      input.value = (before + code + after).slice(0, MAX_TEXT);
      input.focus();
      var pos = Math.min((before + code).length, MAX_TEXT);
      input.setSelectionRange(pos, pos);
    });

    // answering somebody: the arrow on their line, the cross on the stub
    host.querySelector(".chat-log").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-reply]");
      if (!b) return;
      var id = +b.dataset.reply, line = null;
      lines.forEach(function (x) { if (x.id === id) line = x; });
      if (!line) return;
      answering = { id: id, name: line.name, text: line.text };
      showAnswering();
      input.focus();
    });
    host.querySelector(".chat-answering").addEventListener("click", function (e) {
      if (!e.target.closest(".drop")) return;
      answering = null;
      showAnswering();
    });
  }

  function mount(el, onState) {
    host = el;
    cb = onState;
    stopped = false;
    answering = null;

    base = (document.querySelector('meta[name="chat-api"]') || {}).content || "";
    if (!base) {
      state("chat.offline", false);
      host.innerHTML = '<p class="chat-note" style="display:block">' +
                       esc(T("chat.nowhere")) + "</p>";
      return;
    }

    host.innerHTML =
      '<div class="chat-log"><div class="chat-empty">' + esc(T("chat.joining")) + "</div></div>" +
      '<p class="chat-said"></p>' +
      '<div class="chat-answering" hidden></div>' +
      '<form class="chat-form">' +
      '<input class="chat-name" type="text" maxlength="' + MAX_NAME + '" spellcheck="false" ' +
      'aria-label="' + esc(T("chat.name")) + '" title="' + esc(T("chat.name")) + '">' +
      '<input class="chat-say" type="text" maxlength="' + MAX_TEXT + '" autocomplete="off" ' +
      'placeholder="' + esc(T("chat.placeholder")) + '" aria-label="' +
      esc(T("chat.placeholder")) + '">' +
      '<button type="button" class="chat-emo" aria-label="' + esc(T("chat.emoji")) + '">&#9786;</button>' +
      '<button type="submit" aria-label="' + esc(T("chat.send")) + '">&#8629;</button>' +
      "</form>" +
      '<div class="chat-tray" hidden>' +
      Object.keys(EMO).map(function (code) {
        return '<button type="button" data-emo="' + code + '" title=":' + code + ':">' +
               '<img alt=":' + code + ':" src="' + icon(EMO[code]) + '"></button>';
      }).join("") + "</div>";
    wire();
    state("chat.connecting", false);
    poll(true);
  }

  function relabel() { paint(); showAnswering(); }

  return { mount: mount, relabel: relabel };
})();
