// ─── spitmux mods — index, dossier and spec panel ───────────────────────────
(function () {
  "use strict";

  var MODS = window.MODS || [];
  var listEl   = document.getElementById("index-list");
  var outEl    = document.getElementById("out");
  var specEl   = document.getElementById("spec-body");
  var specId   = document.getElementById("spec-id");
  var filterEl = document.getElementById("filter");

  var current = null;   // selected mod id
  var shown   = MODS.slice();

  // ── helpers ───────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function num(n) { return n.toLocaleString("en-GB"); }

  // scrambleEl runs on requestAnimationFrame, which a hidden or throttled tab
  // can stop dead — and it only writes the real text back on the final frame.
  // So every scramble gets a timer that puts the words back regardless.
  function scramble(el, ms) {
    if (!el || !window.scrambleEl) return;
    window.scrambleEl(el, ms);
    var real = el.dataset.realText;
    setTimeout(function () {
      if (real && el.textContent !== real) el.textContent = real;
    }, ms + 500);
  }
  function byId(id) { for (var i = 0; i < MODS.length; i++) if (MODS[i].id === id) return MODS[i]; return null; }

  var TOTAL_LINES = MODS.reduce(function (a, m) { return a + m.lines; }, 0);
  var TOTAL_FILES = MODS.reduce(function (a, m) { return a + m.files; }, 0);
  var MAX_LINES   = MODS.reduce(function (a, m) { return Math.max(a, m.lines); }, 1);

  // ── clock ─────────────────────────────────────────────────────────────
  (function tick() {
    var t = new Date();
    var z = function (n) { return String(n).padStart(2, "0"); };
    var el = document.getElementById("clock");
    if (el) el.innerHTML = "<b>" + z(t.getHours()) + ":" + z(t.getMinutes()) + ":" + z(t.getSeconds()) + "</b>";
    setTimeout(tick, 1000);
  })();

  document.getElementById("stat-mods").textContent  = MODS.length;
  document.getElementById("stat-lines").textContent = num(TOTAL_LINES);
  document.getElementById("node-count").textContent = MODS.length + " nodes";

  // ── the index ─────────────────────────────────────────────────────────
  function renderList() {
    listEl.innerHTML = "";

    if (!shown.length) {
      var empty = document.createElement("div");
      empty.className = "index-empty";
      empty.textContent = "» no match";
      listEl.appendChild(empty);
      return;
    }

    shown.forEach(function (m, i) {
      var b = document.createElement("button");
      b.className = "mod-btn" + (m.id === current ? " active" : "");
      b.type = "button";
      b.dataset.id = m.id;
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", m.id === current ? "true" : "false");
      b.innerHTML =
        '<span class="marker"></span>' +
        '<span class="grain-overlay"></span>' +
        '<span class="hover-sweep"></span>' +
        '<span class="status-tag' + (m.repo ? " ready" : "") + '">' + esc(m.repo ? "public" : "local") + "</span>" +
        '<span class="name">' + esc(m.name) + "</span>" +
        '<span class="desc">' + esc(m.tag) + "</span>" +
        '<span class="row"><span class="cat">' + esc(m.cat) + '</span>' +
        '<span class="loc">' + num(m.lines) + " loc</span></span>";
      b.style.animationDelay = (i * 45) + "ms";
      b.addEventListener("click", function () { select(m.id); });
      listEl.appendChild(b);
      // next frame so the animation actually plays on a re-render
      requestAnimationFrame(function () { b.classList.add("in"); });
    });
  }

  // ── the dossier ───────────────────────────────────────────────────────
  function renderDossier(m) {
    var h = [];

    h.push('<div class="dossier-head">');
    h.push('<div class="crumb">archive <span class="sep">/</span> <span class="cat">' + esc(m.cat) +
           '</span> <span class="sep">/</span> ' + esc(m.id) + "</div>");
    h.push('<h1 class="dossier-title" id="dossier-title">' + esc(m.name) + "</h1>");
    h.push('<div class="dossier-tag">' + esc(m.tag) + "</div>");

    h.push('<div class="chips">');
    h.push('<span class="chip">' + num(m.lines) + " <b>loc</b></span>");
    h.push('<span class="chip">' + m.files + " <b>files</b></span>");
    if (m.key && m.key !== "—") h.push('<span class="chip">menu <b>' + esc(m.key) + "</b></span>");
    h.push('<span class="chip">c<b>#</b> · shvdn 3</span>');
    if (m.repo) {
      h.push('<a class="chip link" href="' + esc(m.repo) + '" target="_blank" rel="noopener">source ↗</a>');
    } else {
      h.push('<span class="chip mute">source · private</span>');
    }
    h.push("</div>");
    h.push("</div>");

    h.push('<p class="blurb">' + esc(m.blurb) + "</p>");

    // Footage, where there is some. The frame is not loaded until somebody
    // asks for it: no YouTube script on a page nobody clicked, nothing to
    // block on, and the link underneath still works if the frame cannot load
    // at all — which is the case in a sandbox that refuses third-party frames.
    if (m.video && m.video.id) {
      var vid = esc(m.video.id);
      h.push('<figure class="vid">');
      // The player mounts with the page rather than behind a click. It is the
      // only frame on screen at a time — one dossier is open — so there is
      // nothing to be gained by making somebody ask for it twice. No autoplay:
      // sound starting on its own is a different thing from the video being
      // ready, and browsers block it unmuted anyway.
      h.push('<iframe class="frame" data-vid="' + vid + '" loading="lazy" ' +
             'src="https://www.youtube-nocookie.com/embed/' + vid + '?rel=0" ' +
             'title="' + esc(m.video.label) + '" allowfullscreen ' +
             'allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" ' +
             'referrerpolicy="strict-origin-when-cross-origin"></iframe>');
      h.push('<figcaption><span class="drawn">footage</span>' +
             '<a href="https://www.youtube.com/watch?v=' + vid + '" ' +
             'target="_blank" rel="noopener">watch on youtube &#8599;</a></figcaption>');
      h.push("</figure>");
    }

    // Real captures, where there are any. These sit above the diagram: a
    // photograph of the thing beats a drawing of it, and the diagram stays
    // because it can label what a capture cannot.
    if (m.shots && m.shots.length) {
      h.push('<div class="shots">');
      m.shots.forEach(function (sh) {
        var src = typeof sh === "string" ? sh : sh.src;
        var cap = typeof sh === "string" ? "" : (sh.cap || "");
        h.push('<figure class="shot">' +
               '<img src="' + esc(src) + '" loading="lazy" ' +
               'alt="' + esc(cap || (m.name + " in game")) + '">' +
               (cap ? '<figcaption>' + esc(cap) + "</figcaption>" : "") +
               "</figure>");
      });
      h.push("</div>");
    }

    // A drawing of what the mod puts on screen, where there is one. These are
    // built from the mod's own ini and readme, so the layout and the meaning
    // are right — but they are drawings, and the caption says so rather than
    // letting anyone take them for screenshots.
    // One figure or several — a mod that draws three separate screens gets
    // three, rather than one drawing trying to be all of them at once.
    var hud = (window.HUDS || {})[m.id];
    if (hud) {
      (Array.isArray(hud) ? hud : [hud]).forEach(function (fig) {
        h.push('<figure class="hud-fig">');
        h.push('<svg viewBox="0 0 ' + fig.w + ' ' + fig.h + '" role="img" ' +
               'aria-label="' + esc(fig.cap) + '">' + fig.svg + '</svg>');
        h.push('<figcaption>' + esc(fig.cap) +
               '<span class="drawn">drawn to the spec — not a screenshot</span></figcaption>');
        h.push("</figure>");
      });
    }

    (m.points || []).forEach(function (p) {
      h.push('<div class="point"><h3>' + esc(p.h) + "</h3><p>" + esc(p.t) + "</p></div>");
    });

    if (m.ctrl && m.ctrl.length) {
      h.push('<div class="sec-rule">controls</div>');
      h.push('<table class="ctrl-table"><tbody>');
      m.ctrl.forEach(function (r) {
        h.push('<tr><td class="k"><kbd>' + esc(r[0]) + '</kbd></td><td class="v">' + esc(r[1]) + "</td></tr>");
      });
      h.push("</tbody></table>");
    }

    h.push('<div class="sec-rule">install</div>');
    h.push('<div class="codeblock">');
    h.push('<span class="c">; requires ScriptHookV + ScriptHookVDotNet 3</span>\n');
    if (m.install && m.install.length) {
      h.push(m.install.map(function (f) { return '<span class="f">' + esc(f) + "</span>"; }).join("\n"));
    } else {
      h.push('<span class="f">scripts\\' + esc(m.name.replace(/[^A-Za-z0-9]/g, "")) + ".dll</span>\n" +
             '<span class="f">scripts\\' + esc(m.name.replace(/[^A-Za-z0-9]/g, "")) + ".ini</span>");
    }
    h.push('\n<span class="c">; one build, GTA V Legacy and Enhanced</span>');
    h.push("</div>");

    h.push('<div class="foot-note">');
    h.push("<span>no asset replacement · no RPF edits · no gameconfig</span>");
    h.push(m.repo
      ? '<a href="' + esc(m.repo) + '" target="_blank" rel="noopener">' + esc(m.repo.replace("https://", "")) + "</a>"
      : "<span>not yet published</span>");
    h.push("</div>");

    outEl.innerHTML = h.join("");

    var imgs = outEl.querySelectorAll(".shot img");
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener("load", function () {
        this.parentNode.parentNode.classList.add("ready");
      }, { once: true });
      imgs[i].addEventListener("error", function () {
        var fig = this.parentNode;
        var wrap = fig && fig.parentNode;
        if (fig) fig.parentNode.removeChild(fig);
        if (wrap && !wrap.querySelector(".shot")) wrap.parentNode.removeChild(wrap);
      }, { once: true });
      // A cached image can be complete before the listener is attached, in
      // which case neither event will ever fire.
      if (imgs[i].complete && imgs[i].naturalWidth) {
        imgs[i].parentNode.parentNode.classList.add("ready");
      }
    }

    // Nothing reports a blocked frame — a sandbox that refuses third-party
    // embeds does it silently — so the only signal available is that the load
    // event never came. If it has not fired by then, swap in something that
    // opens on YouTube instead of leaving a black rectangle.
    var frame = outEl.querySelector(".vid .frame");
    if (frame) {
      var landed = false;
      frame.addEventListener("load", function () { landed = true; }, { once: true });
      setTimeout(function () {
        if (landed || !frame.parentNode) return;
        var a = document.createElement("a");
        a.className = "box";
        a.href = "https://www.youtube.com/watch?v=" + frame.dataset.vid;
        a.target = "_blank";
        a.rel = "noopener";
        a.innerHTML = '<span class="play">&#9654;</span>' +
                      '<span class="cue">can&rsquo;t play here &mdash; ' +
                      'opens on youtube</span>';
        frame.parentNode.replaceChild(a, frame);
      }, 4000);
    }
    outEl.parentElement.scrollTop = 0;
    flash("frame-flash", window.crtFlashFrame);
  }

  // The flash overlays sit at opacity 0 and are painted by a 0.25s animation.
  // Drop the class on a timer too, so a paused animation cannot leave a panel
  // washed amber.
  function flash(id, fn) {
    if (!fn) return;
    fn();
    var el = document.getElementById(id) || document.querySelector("." + id);
    if (el) setTimeout(function () { el.classList.remove("go"); }, 400);
  }

  // ── the spec panel ────────────────────────────────────────────────────
  function renderSpec(m) {
    var idx = MODS.indexOf(m);
    specId.textContent = "ID-" + String(idx + 1).padStart(2, "0") + "/" + MODS.length;

    var rows = [
      ["MOD", m.name],
      ["CLASS", m.cat],
      ["STATUS", m.repo ? "PUBLIC" : "LOCAL BUILD"],
      ["LANGUAGE", "C#"],
      ["RUNTIME", "SHVDN 3"],
      ["EDITIONS", "LEGACY + ENH"],
      ["ASSETS", "NONE"],
      ["MENU", m.key || "—"],
      ["SOURCE", num(m.lines) + " LOC"],
      ["FILES", m.files]
    ];

    var h = [];
    h.push('<div class="id-card">');
    h.push('<div class="id-title">ID//BUILD</div>');
    h.push('<div class="id-num">── ' + esc(m.id.toUpperCase()) + " ────────────────</div>");
    rows.forEach(function (r) {
      var cls = r[0] === "STATUS" && !m.repo ? " mute" : (r[0] === "STATUS" ? " on" : "");
      h.push('<div class="id-row"><span class="k">' + esc(r[0]) + '</span><span class="v' + cls + '">' + esc(r[1]) + "</span></div>");
    });
    h.push('<div class="id-barcode">┃┃│┃│ │┃│┃│ │┃┃│ ┃│┃ │┃│┃</div>');
    h.push("</div>");

    // size chart across the whole archive
    h.push('<div class="spec-header" style="border:0;background:none;padding:0 2px;"><span class="title">SIZE // ARCHIVE</span><span>LOC</span></div>');
    h.push('<div class="size-list">');
    MODS.slice().sort(function (a, b) { return b.lines - a.lines; }).forEach(function (x) {
      var pct = Math.max(4, Math.round(Math.pow(x.lines / MAX_LINES, 0.55) * 100));
      var k = x.lines >= 1000 ? Math.round(x.lines / 1000) + "k" : x.lines;
      h.push('<div class="size-row' + (x.id === m.id ? " on" : "") + '" data-id="' + esc(x.id) + '">' +
             '<span class="n">' + esc(x.name) + "</span>" +
             '<span class="bar"><i style="inset:0 ' + (100 - pct) + '% 0 0"></i></span>' +
             '<span class="v">' + k + "</span></div>");
    });
    h.push("</div>");

    h.push('<div class="spec-note">' + num(TOTAL_LINES) + " lines of C# across " + MODS.length +
           " mods and " + num(TOTAL_FILES) + " files. Counted from src, excluding build, tools and release.</div>");

    specEl.innerHTML = h.join("");

    specEl.querySelectorAll(".size-row").forEach(function (row) {
      row.addEventListener("click", function () { select(row.dataset.id); });
    });
  }

  // ── selection ─────────────────────────────────────────────────────────
  function select(id, quiet) {
    var m = byId(id);
    if (!m) return;
    current = id;

    listEl.querySelectorAll(".mod-btn").forEach(function (b) {
      var on = b.dataset.id === id;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      if (on) b.scrollIntoView({ block: "nearest" });
    });

    renderDossier(m);
    renderSpec(m);
    if (!quiet && window.spitmuxAudio) window.spitmuxAudio.beep(660, 40);
    if (history.replaceState) history.replaceState(null, "", "#" + id);
  }

  // ── filtering ─────────────────────────────────────────────────────────
  function applyFilter() {
    var q = filterEl.value.trim().toLowerCase();
    shown = !q ? MODS.slice() : MODS.filter(function (m) {
      return (m.name + " " + m.id + " " + m.tag + " " + m.cat + " " + m.blurb).toLowerCase().indexOf(q) > -1;
    });
    document.getElementById("node-count").textContent =
      shown.length === MODS.length ? MODS.length + " nodes" : shown.length + " / " + MODS.length + " nodes";
    renderList();
  }
  filterEl.addEventListener("input", applyFilter);

  // ── keyboard ──────────────────────────────────────────────────────────
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== filterEl) {
      e.preventDefault();
      filterEl.focus();
      filterEl.select();
      return;
    }
    if (e.key === "Escape") {
      filterEl.value = "";
      applyFilter();
      filterEl.blur();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!shown.length) return;
      e.preventDefault();
      var i = shown.findIndex(function (m) { return m.id === current; });
      if (i === -1) i = e.key === "ArrowDown" ? -1 : 0;
      var next = e.key === "ArrowDown" ? (i + 1) % shown.length : (i - 1 + shown.length) % shown.length;
      select(shown[next].id);
    }
  });

  // ── boot ──────────────────────────────────────────────────────────────
  var BOOT = [
    ["» mount", "archive://defthrets/gta5", "ok"],
    ["» scan", MODS.length + " mods · " + num(TOTAL_FILES) + " source files", "ok"],
    ["» count", num(TOTAL_LINES) + " lines of C#", "ok"],
    ["» runtime", "scripthookvdotnet 3", "req"],
    ["» assets", "no replacement · no rpf edits", "none"],
    ["» editions", "legacy + enhanced, one build", "ok"]
  ];

  function boot(done) {
    var i = 0;
    outEl.innerHTML = "";
    (function step() {
      if (i >= BOOT.length) { setTimeout(done, 260); return; }
      var b = BOOT[i++];
      var line = document.createElement("div");
      line.className = "line";
      line.innerHTML = '<span class="head">' + esc(b[0]) + '</span> <span class="dim">' + esc(b[1]) +
                       '</span> <span class="ok">[' + esc(b[2]) + "]</span>";
      outEl.appendChild(line);
      setTimeout(step, 130);
    })();
  }

  // ── go ────────────────────────────────────────────────────────────────
  var wanted = (location.hash || "").replace("#", "");
  var first = byId(wanted) ? wanted : MODS[0].id;

  renderList();

  // The cold open covers the page on load, so hold the boot lines back rather
  // than typing them out behind a black screen. The timeout is the guarantee:
  // if intro.js never reports in, the site starts anyway.
  var started = false;
  function start() {
    if (started) return;
    started = true;
    boot(function () { select(first, true); });
  }
  if (window.crtIntro && window.crtIntro.pending) {
    window.addEventListener("crt-intro-done", start, { once: true });
    setTimeout(start, 9000);
  } else {
    start();
  }

  // ascii glitch, same as the parent site
  var asciiWrap = document.getElementById("ascii-wrap");
  if (asciiWrap) {
    asciiWrap.addEventListener("click", function () {
      flash("flash", window.crtFlash);
      scramble(document.getElementById("wordmark"), 700);
    });
  }
  var tag = document.getElementById("tagline");
  if (tag) tag.addEventListener("click", function () { scramble(tag, 600); });

  // The wordmark drops out on its own now and then. Irregular, not a cycle —
  // a metronome reads as an animation, an uneven one reads as a fault. Short
  // enough to be a flicker rather than something to sit through.
  (function idleGlitch() {
    var mark = document.getElementById("wordmark");
    if (!mark) return;
    if (window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    (function tick() {
      setTimeout(function () {
        scramble(mark, 200 + Math.random() * 240);
        tick();
      }, 6500 + Math.random() * 12000);
    })();
  })();

  window.addEventListener("konami", function () {
    document.body.classList.toggle("unlocked");
    flash("flash", window.crtFlash);
  });
})();
