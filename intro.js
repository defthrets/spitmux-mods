// ─── Cold open: the set is broken into, then switched off ───────────────────
//
// The overlay div is in the markup so the page starts black rather than
// flashing the site before this runs. Everything inside it is built here.
//
// Under the seal a terminal runs the break-in — nmap, metasploit, ssh, then
// the archive is mounted and the executable started — while a bar fills
// above it. All of it is theatre: fixed strings on a fixed schedule, aimed at
// this site's own name. Nothing in here talks to anything.
//
// Nothing the reader needs is behind this. If this file throws, never loads,
// or the browser is mid-throttle, three separate things still clear the way:
// the failsafe animation on .crt-intro in the stylesheet, app.js's own start
// timeout, and the click/key skip below.

(function () {
  "use strict";

  var root = document.getElementById("crt-intro");
  if (!root) return;

  window.crtIntro = { pending: true, logged: false };

  var rain = null, rainHome = null;

  var BROKEN_MS = 5000;      // how long the signal stays bad
  var done = false;

  function finish() {
    if (done) return;
    done = true;
    window.crtIntro.pending = false;
    if (rain && rainHome) {                 // put the rain back behind the page
      rain.classList.remove("in-crt");
      rain.style.transform = "";
      rainHome.insertBefore(rain, rainHome.firstChild);
    }
    root.parentNode && root.parentNode.removeChild(root);
    window.dispatchEvent(new CustomEvent("crt-intro-done"));
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ── build the set ───────────────────────────────────────────────────────
  var source = document.querySelector(".seal-peek svg");
  if (!source) { finish(); return; }

  var inner = el("div", "crt-inner");
  var set = el("div", "crt-set");         // seal + terminal, centred as one
  var stage = el("div", "crt-stage");

  // One seal, plus two clones that get torn into bands. Cloning keeps the
  // geometry in exactly one place — reshape the mark and this follows.
  var layers = [];
  for (var i = 0; i < 3; i++) {
    var wrap = el("div", "crt-seal l" + i);
    var svg = source.cloneNode(true);
    svg.removeAttribute("class");
    // the clone would otherwise duplicate the ring path's id
    var defsPath = svg.querySelector("defs path");
    var tp = svg.querySelector("textPath");
    if (defsPath && tp) {
      var id = "crt-ring-" + i;
      defsPath.setAttribute("id", id);
      tp.setAttribute("href", "#" + id);
    }
    wrap.appendChild(svg);
    stage.appendChild(wrap);
    layers.push(wrap);
  }

  // ── the terminal ────────────────────────────────────────────────────────
  var term = el("div", "crt-term");
  var head = el("div", "crt-head");
  head.appendChild(el("span", "crt-name", "spitmux.exe"));
  head.appendChild(el("span", "crt-stamp", "CRT-1991 · DEFTHRETS"));
  var barRow = el("div", "crt-barrow");
  var track = el("div", "crt-track");
  var fill = el("div", "crt-fill");
  track.appendChild(fill);
  var pct = el("span", "crt-pct", "00%");
  barRow.appendChild(track);
  barRow.appendChild(pct);
  var log = el("div", "crt-log");
  term.appendChild(head);
  term.appendChild(barRow);
  term.appendChild(log);

  set.appendChild(stage);
  set.appendChild(term);

  var MODS = window.MODS || [];
  var files = 0, lines = 0;
  MODS.forEach(function (m) { files += m.files || 0; lines += m.lines || 0; });
  function num(n) { return n.toLocaleString("en-GB"); }
  function pad(s, n) { while (s.length < n) s += " "; return s; }

  // What the terminal prints, on the millisecond. "cmd" types the text out
  // after a prompt; "port" is one nmap row; "line" is [class, text] pairs.
  // A line scheduled while a command is still typing waits its turn.
  var SCRIPT = [
    [150,  "cmd",  "nmap -sV -p- spitmux.me"],
    [560,  "line", ["info", "Nmap scan report for spitmux.me"], ["dim", " (185.199.108.153)"]],
    [640,  "line", ["dim", "PORT       STATE  SERVICE  VERSION"]],
    [700,  "port", "22/tcp",    "ssh",    "OpenSSH 9.6"],
    [760,  "port", "443/tcp",   "https",  "nginx 1.27 (TLS 1.3)"],
    [820,  "port", "1337/tcp",  "poison", "nightshade v0.3.4"],
    [880,  "port", "31337/tcp", "elite",  "spitmux/1.0"],
    [1000, "line", ["ok", "Nmap done"], ["dim", ": 1 host up · 4 ports · 0.84s"]],
    [1200, "cmd",  "msfconsole -q"],
    [1480, "line", ["dim", "msf6 > "], ["info", "use exploit/unix/nightshade_bypass"]],
    [1580, "line", ["dim", "msf6 > "], ["info", "set RHOSTS spitmux.me"]],
    [1680, "line", ["dim", "msf6 > "], ["info", "set PAYLOAD cmd/unix/reverse_amber"]],
    [1780, "line", ["dim", "msf6 > "], ["info", "exploit"]],
    [1900, "line", ["dim", "[*] Started reverse handler on 127.0.0.1:4444"]],
    [2020, "line", ["dim", "[*] 185.199.108.153:1337 - Probing nightshade v0.3.4 ..."]],
    [2160, "line", ["warn", "[+] "], ["dim", "Target is vulnerable · CVE-1991-1337"]],
    [2300, "line", ["dim", "[*] Sending stage (1991 bytes) to 185.199.108.153"]],
    [2460, "line", ["ok", "[*] Command shell session 1 opened"], ["dim", " · 4444 → 31337"]],
    [2700, "cmd",  "ssh spitmux@spitmux.me"],
    [3080, "line", ["dim", "spitmux@spitmux.me's password: "], ["info", "••••••••••••"]],
    [3180, "line", ["dim", "Last login: never · Linux spitmux.me 5.0 x86_64"]],
    [3300, "cmd",  "mount archive://defthrets/gta5"],
    [3700, "line", ["info", MODS.length + " mods"], ["dim", " · "],
                   ["info", num(files) + " source files"], ["dim", " · "],
                   ["info", num(lines) + " lines of C#"]],
    [3800, "line", ["dim", "scripthookvdotnet 3 · legacy + enhanced · no rpf edits"]],
    [3980, "cmd",  "./spitmux.exe"],
    [4300, "line", ["core", "[ ACCESS GRANTED ]"]]
  ];

  // The bar follows the script rather than the clock alone: quick through
  // the scan, a crawl while the exploit lands, a stall at 94 the way every
  // real one does, then full just before the set goes.
  var CURVE = [[0, 0], [560, 0.08], [1000, 0.22], [1480, 0.26], [2460, 0.58],
               [3080, 0.70], [3800, 0.88], [4300, 0.94], [4600, 1]];
  function curve(t) {
    for (var i = 1; i < CURVE.length; i++) {
      if (t <= CURVE[i][0]) {
        var a = CURVE[i - 1], b = CURVE[i];
        return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
      }
    }
    return 1;
  }

  var CHAR_MS = 12;
  var openedAt = Date.now();
  var next = 0;          // first script step not yet on screen
  var typing = null;     // { span, text, at } while a command is being typed

  function emit(s) {
    var row = el("div", "crt-tl");
    if (s[1] === "cmd") {
      row.appendChild(el("span", "crt-ps", "$ "));
      var span = el("span", "crt-cmd", "");
      row.appendChild(span);
      typing = { span: span, text: s[2], at: s[0] };
    } else if (s[1] === "port") {
      row.appendChild(el("span", "hl", pad(s[2], 11)));
      row.appendChild(el("span", "ok", pad("open", 7)));
      row.appendChild(el("span", "info", pad(s[3], 9)));
      row.appendChild(el("span", "dim", s[4]));
    } else {
      for (var i = 2; i < s.length; i++) row.appendChild(el("span", s[i][0], s[i][1]));
    }
    log.appendChild(row);
    // the window shows the last rows; anything scrolled off can go
    while (log.children.length > 14) log.removeChild(log.firstChild);
  }

  function tick() {
    var t = Date.now() - openedAt;
    if (typing) {
      var n = Math.min(typing.text.length, Math.floor((t - typing.at) / CHAR_MS));
      typing.span.textContent = typing.text.slice(0, n);
      if (n >= typing.text.length) typing = null;
    }
    while (!typing && next < SCRIPT.length && SCRIPT[next][0] <= t) emit(SCRIPT[next++]);

    var p = curve(t);
    fill.style.width = (p * 100).toFixed(1) + "%";
    var n2 = String(Math.floor(p * 100));
    pct.textContent = (n2.length < 2 ? "0" + n2 : n2) + "%";
    if (p >= 1) term.classList.add("done");
  }
  tick();
  var tickTimer = setInterval(tick, 40);
  window.crtIntro.logged = true;         // app.js need not type the boot again

  var roll = el("div", "crt-roll");
  var scan = el("div", "crt-scan");

  // The switch-off line is a sibling of .crt-inner, not a child: .crt-inner is
  // the thing that collapses, and anything inside it collapses with it.
  var line = el("div", "crt-line");

  // Borrow the page's own rain canvas instead of running a second copy of the
  // effect — same code, same look, and it goes home in finish().
  rain = document.getElementById("matrix");
  rainHome = rain && rain.parentNode;
  if (rain) { rain.classList.add("in-crt"); inner.appendChild(rain); }

  inner.appendChild(set);
  inner.appendChild(roll);
  inner.appendChild(scan);
  root.appendChild(inner);
  root.appendChild(line);
  root.classList.add("live");            // cancels the stylesheet failsafe


  // ── the fault itself ────────────────────────────────────────────────────
  // Re-rolled on a random interval rather than run off a keyframe loop: a
  // fixed cycle reads as an animation, an irregular one reads as a fault.
  var glitchTimer = null;

  function clear(l) {
    l.style.clipPath = "";
    l.style.transform = "";
    l.style.opacity = "";
  }

  function band() {
    var top = Math.random() * 78;
    var h = 4 + Math.random() * 20;
    return "inset(" + top.toFixed(1) + "% 0 " + Math.max(0, 100 - top - h).toFixed(1) + "% 0)";
  }

  function roll_() {
    var r = Math.random();

    clear(layers[1]);
    clear(layers[2]);
    term.classList.remove("tear");

    if (r < 0.10) {
      // dropout — the picture all but disappears for a beat
      layers[0].style.opacity = 0.08;
      layers[0].style.transform = "translateX(" + (Math.random() * 20 - 10).toFixed(0) + "px)";
    } else if (r < 0.22) {
      // clean frame. The pauses are what sell the rest of it.
      clear(layers[0]);
      if (rain) rain.style.transform = "";
    } else if (r < 0.42) {
      // whole picture shifted, as if the line has slipped
      clear(layers[0]);
      layers[0].style.transform =
        "translate(" + (Math.random() * 34 - 17).toFixed(0) + "px," +
                       (Math.random() * 14 - 7).toFixed(0) + "px)";
    } else {
      // torn bands displaced against the base picture — and the bar tears
      // on the same beat; a loader on a broken signal should not be the one
      // thing on screen that is behaving
      clear(layers[0]);
      layers[0].style.transform = "translateX(" + (Math.random() * 8 - 4).toFixed(0) + "px)";
      if (rain) rain.style.transform =
        "translateX(" + (Math.random() * 46 - 23).toFixed(0) + "px)";
      layers[1].style.opacity = 0.95;
      layers[1].style.clipPath = band();
      layers[1].style.transform = "translateX(" + (Math.random() * 60 - 30).toFixed(0) + "px)";
      if (Math.random() > 0.4) {
        layers[2].style.opacity = 0.95;
        layers[2].style.clipPath = band();
        layers[2].style.transform = "translateX(" + (Math.random() * 60 - 30).toFixed(0) + "px)";
      }
      if (Math.random() < 0.6) term.classList.add("tear");
    }

    inner.style.filter = "brightness(" + (0.72 + Math.random() * 0.62).toFixed(2) + ")";
    glitchTimer = setTimeout(roll_, 55 + Math.random() * 130);
  }
  roll_();

  // ── switch off ──────────────────────────────────────────────────────────
  function powerOff() {
    if (done) return;
    clearTimeout(glitchTimer);
    clearInterval(tickTimer);
    layers.forEach(clear);
    term.classList.remove("tear");
    inner.style.filter = "";

    root.classList.add("off");
    // animationend can be missed on a throttled tab, so time it out as well
    var fired = false;
    inner.addEventListener("animationend", function () {
      if (fired) return;
      fired = true;
      root.classList.add("gone");
      setTimeout(finish, 340);
    }, { once: true });
    setTimeout(function () {
      if (fired) return;
      fired = true;
      root.classList.add("gone");
      setTimeout(finish, 340);
    }, 900);
  }

  var offTimer = setTimeout(powerOff, BROKEN_MS);

  // skip
  function skip() { clearTimeout(offTimer); powerOff(); }
  root.addEventListener("click", skip);
  window.addEventListener("keydown", skip, { once: true });

  // Someone who asked for less motion gets the mark, the finished log and
  // the switch-off, without five seconds of tearing.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    clearTimeout(glitchTimer);
    layers.forEach(clear);
    inner.style.filter = "";
    openedAt = Date.now() - BROKEN_MS;    // the whole script, already printed
    tick();
    clearTimeout(offTimer);
    offTimer = setTimeout(powerOff, 1200);
  }
})();
