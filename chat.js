// ─── The bug chat ───────────────────────────────────────────────────────────
// Anonymous, and ours.
//
// It talks to a small service on the homelab (server/bugchat.py): one SQLite
// file holding every line ever said, a ban list, and nothing else. That is
// what the public broker could not do -- keep a week of chat, and shut the
// door on somebody.
//
// The address of the room is in a meta tag rather than in here, so the site
// can be pointed somewhere else without a code change. Nothing is loaded and
// nothing is asked of the network until the panel is opened.
//
// What the page can see: a name, a country, a time, a line. Addresses are the
// server's business and never come back over this wire.

window.BUGCHAT = (function () {
  "use strict";

  var POLL_MS = 2500;
  var MAX_TEXT = 200;
  var MAX_NAME = 16;
  var KEEP = 120;              // lines held in the panel

  var base = "", host = null, cb = null, lines = [], last = 0, timer = null, stopped = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function T(k, v) { return window.I18N ? window.I18N.t(k, v) : k; }
  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function handle() {
    var n = get("chat:name", "");
    if (!n) { n = "anon-" + Math.random().toString(16).slice(2, 6); put("chat:name", n); }
    return n.slice(0, MAX_NAME);
  }

  function clock(t) {
    var d = new Date(t);
    try {
      return d.toLocaleTimeString(document.documentElement.lang || "en",
                                  { hour: "numeric", minute: "2-digit", hour12: true })
              .replace(/\bAM\b/, "am").replace(/\bPM\b/, "pm");
    } catch (e) { return d.getHours() + ":" + d.getMinutes(); }
  }

  function state(key, live) { if (cb) cb(T(key), live); }

  function paint() {
    var log = host && host.querySelector(".chat-log");
    if (!log) return;
    var stuck = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
    if (!lines.length) {
      log.innerHTML = '<div class="chat-empty">' + esc(T("chat.empty")) + "</div>";
      return;
    }
    log.innerHTML = lines.map(function (x) {
      var flag = /^[A-Z]{2}$/.test(x.cc || "")
        ? '<img class="flag" alt="" width="14" height="10" src="https://flagcdn.com/' +
          x.cc.toLowerCase() + '.svg">' : "";
      return '<div class="chat-line"><span class="t">' + esc(clock(x.ts)) + "</span>" +
             '<span class="who">' + flag + esc(x.name) + "</span>" +
             '<span class="say">' + esc(x.text) + "</span></div>";
    }).join("");
    if (stuck) log.scrollTop = log.scrollHeight;
  }

  function note(msg) {
    var el = host && host.querySelector(".chat-said");
    if (el) el.textContent = msg || "";
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
    fetch(base + "/api/say", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: handle(), text: text.slice(0, MAX_TEXT),
                             cc: window.VISITOR_CC || get("cc", "") })
    })
      .then(function (r) { return r.json().then(function (d) { return [r.status, d]; }); })
      .then(function (pair) {
        var code = pair[0], d = pair[1];
        if (code === 200 && d.line) { note(""); add([d.line]); return; }
        note(d && d.error ? d.error : T("chat.offline"));
      })
      .catch(function () { note(T("chat.offline")); });
  }

  function wire() {
    var form = host.querySelector(".chat-form");
    var input = host.querySelector(".chat-say");
    var name = host.querySelector(".chat-name");
    name.value = handle();
    name.addEventListener("change", function () {
      var v = name.value.trim().slice(0, MAX_NAME) || "anon";
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
  }

  function mount(el, onState) {
    host = el;
    cb = onState;
    stopped = false;

    base = (document.querySelector('meta[name="chat-api"]') || {}).content || "";
    if (!base) { state("chat.offline", false); host.innerHTML =
      '<p class="chat-note" style="display:block">' + esc(T("chat.nowhere")) + "</p>"; return; }

    host.innerHTML =
      '<div class="chat-log"><div class="chat-empty">' + esc(T("chat.joining")) + "</div></div>" +
      '<p class="chat-said"></p>' +
      '<form class="chat-form">' +
      '<input class="chat-name" type="text" maxlength="' + MAX_NAME + '" spellcheck="false" ' +
      'aria-label="' + esc(T("chat.name")) + '">' +
      '<input class="chat-say" type="text" maxlength="' + MAX_TEXT + '" autocomplete="off" ' +
      'placeholder="' + esc(T("chat.placeholder")) + '" aria-label="' + esc(T("chat.placeholder")) + '">' +
      '<button type="submit" aria-label="' + esc(T("chat.send")) + '">&#8629;</button>' +
      "</form>";
    wire();
    state("chat.connecting", false);
    poll(true);
  }

  function relabel() { paint(); }

  return { mount: mount, relabel: relabel };
})();
