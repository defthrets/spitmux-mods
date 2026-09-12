// ─── The bug chat ───────────────────────────────────────────────────────────
// An anonymous room on a site with no server behind it.
//
// It talks MQTT over a websocket to one of the free public brokers -- no
// account, no key, nothing to sign in to. Everyone on the page is subscribed
// to the same topic, so a line typed here appears on every other open copy of
// the site within a second.
//
// The awkward part of a broker is that it forgets: it relays what is said
// while you are listening and keeps nothing, so somebody arriving at a quiet
// hour would find an empty room. What it does keep is the LAST message on a
// topic, if that message is marked retained. So the room is not one topic but
// twenty-four of them -- msg/00 to msg/23 -- each holding one line, and a new
// arrival subscribing to msg/+ is handed all twenty-four at once. A ring
// buffer, built out of the one thing the broker will remember.
//
// What this is not: private, or moderated. A public broker is public -- anyone
// who knows the topic can read the room or write to it, and nothing here can
// stop them. It is a shoutbox on a mod site, and it is treated as one.

window.BUGCHAT = (function () {
  "use strict";

  var BROKERS = [
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://test.mosquitto.org:8081/mqtt"
  ];
  var MQTT_JS = "https://cdnjs.cloudflare.com/ajax/libs/mqtt/5.10.1/mqtt.min.js";
  var BASE = "spitmux/bugchat/";
  var SLOTS = 24;             // how many lines the room remembers
  var MAX_MSG = 200;
  var MAX_NAME = 16;
  var COOLDOWN = 3000;        // one line every three seconds, per browser

  var client = null, lines = [], seen = {}, lastSent = 0, host = null, cb = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function T(k, v) { return window.I18N ? window.I18N.t(k, v) : k; }
  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // a handle this browser keeps, so the room is not all called the same thing
  function handle() {
    var n = get("chat:name", "");
    if (!n) {
      n = "anon-" + Math.random().toString(16).slice(2, 6);
      put("chat:name", n);
    }
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

  function paint() {
    var log = host.querySelector(".chat-log");
    if (!log) return;
    var stuck = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;

    lines.sort(function (a, b) { return a.t - b.t; });
    if (!lines.length) {
      log.innerHTML = '<div class="chat-empty">' + esc(T("chat.empty")) + "</div>";
      return;
    }
    log.innerHTML = lines.map(function (x) {
      var flag = /^[A-Z]{2}$/.test(x.c || "")
        ? '<img class="flag" alt="" width="14" height="10" src="https://flagcdn.com/' +
          x.c.toLowerCase() + '.svg">' : "";
      return '<div class="chat-line"><span class="t">' + esc(clock(x.t)) + "</span>" +
             '<span class="who">' + flag + esc(x.n) + "</span>" +
             '<span class="say">' + esc(x.m) + "</span></div>";
    }).join("");
    if (stuck) log.scrollTop = log.scrollHeight;
  }

  function state(key, on) {
    if (cb) cb(T(key), on);
  }

  // The slot to write into: an empty one if there is one, else the one holding
  // the oldest line. Every client sees the same retained set, so they mostly
  // agree; when two pick the same slot at the same moment one line is lost,
  // which is a fair price for having no server at all.
  function slotFor() {
    var used = {}, oldest = null, oldestSlot = 0;
    lines.forEach(function (x) {
      if (x.slot == null) return;
      used[x.slot] = true;
      if (oldest === null || x.t < oldest) { oldest = x.t; oldestSlot = x.slot; }
    });
    for (var i = 0; i < SLOTS; i++) if (!used[i]) return i;
    return oldestSlot;
  }

  function topicOf(slot) { return BASE + "msg/" + (slot < 10 ? "0" : "") + slot; }

  function send(text) {
    if (!client || !client.connected) return;
    var now = Date.now();
    if (now - lastSent < COOLDOWN) { state("chat.slow", true); return; }
    lastSent = now;

    if (text === "/clear") {
      for (var i = 0; i < SLOTS; i++) client.publish(topicOf(i), "", { retain: true, qos: 0 });
      lines = []; seen = {}; paint();
      return;
    }

    var msg = {
      id: Math.random().toString(16).slice(2) + now.toString(36),
      t: now,
      n: handle(),
      m: text.slice(0, MAX_MSG),
      c: (window.VISITOR_CC || get("cc", "") || "").slice(0, 2)
    };
    client.publish(topicOf(slotFor()), JSON.stringify(msg), { retain: true, qos: 0 });
  }

  function take(topic, payload) {
    var raw = payload && payload.toString();
    var slot = parseInt(topic.slice(topic.lastIndexOf("/") + 1), 10);
    if (!raw) {                                   // a cleared slot
      lines = lines.filter(function (x) { return x.slot !== slot; });
      paint();
      return;
    }
    var m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || !m.m || !m.id || seen[m.id]) return;
    seen[m.id] = true;
    m.slot = slot;
    m.n = String(m.n || "anon").slice(0, MAX_NAME);
    m.m = String(m.m).slice(0, MAX_MSG);
    m.t = +m.t || Date.now();
    lines.push(m);
    if (lines.length > SLOTS * 2) lines = lines.slice(-SLOTS * 2);
    paint();
  }

  function connect(which) {
    if (which >= BROKERS.length) { state("chat.offline", false); return; }
    state("chat.connecting", false);
    var c;
    try {
      c = window.mqtt.connect(BROKERS[which], {
        connectTimeout: 8000,
        reconnectPeriod: 0,
        clean: true,
        clientId: "spitmux_" + Math.random().toString(16).slice(2, 10)
      });
    } catch (e) { return connect(which + 1); }

    var settled = false;
    setTimeout(function () { if (!settled) { settled = true; try { c.end(true); } catch (e) {} connect(which + 1); } }, 9000);

    c.on("connect", function () {
      settled = true;
      client = c;
      state("chat.live", true);
      c.subscribe(BASE + "msg/+", { qos: 0 });
    });
    c.on("message", take);
    c.on("error", function () {
      if (settled) { state("chat.offline", false); return; }
      settled = true;
      try { c.end(true); } catch (e) {}
      connect(which + 1);
    });
    c.on("close", function () { if (settled && client === c) state("chat.offline", false); });
  }

  function wire() {
    var form = host.querySelector(".chat-form");
    var input = host.querySelector(".chat-say");
    var name = host.querySelector(".chat-name");
    if (!form) return;
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
      send(v);
    });
  }

  /* The library is a hundred kilobytes and the room is behind a button, so it
     is fetched at the moment somebody asks for the room and not before. */
  function mount(el, onState) {
    host = el;
    cb = onState;
    host.innerHTML =
      '<div class="chat-log"><div class="chat-empty">' + esc(T("chat.joining")) + "</div></div>" +
      '<form class="chat-form">' +
      '<input class="chat-name" type="text" maxlength="' + MAX_NAME + '" spellcheck="false" ' +
      'aria-label="' + esc(T("chat.name")) + '">' +
      '<input class="chat-say" type="text" maxlength="' + MAX_MSG + '" autocomplete="off" ' +
      'placeholder="' + esc(T("chat.placeholder")) + '" aria-label="' + esc(T("chat.placeholder")) + '">' +
      '<button type="submit" aria-label="' + esc(T("chat.send")) + '">&#8629;</button>' +
      "</form>";
    wire();

    if (window.mqtt) { connect(0); return; }
    var s = document.createElement("script");
    s.src = MQTT_JS;
    s.async = true;
    s.onload = function () { connect(0); };
    s.onerror = function () { state("chat.offline", false); };
    document.head.appendChild(s);
  }

  function relabel() { paint(); }

  return { mount: mount, relabel: relabel };
})();
