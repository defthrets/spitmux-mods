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
  /* A mod's pixel icon, resolved from its id rather than declared anywhere.
     Drop icons/<id>.png in and it appears in the list, at the head of its
     dossier and in the spec panel at once; take it away and all three vanish.
     There is no manifest to keep in step with the folder.

     Absent files remove themselves rather than leaving a broken glyph -- see
     the error handler where the dossier is wired up. */
  /* Icons are addressed by convention, so most of them do not exist until the
     art does. A missing one takes itself out and the layout closes up behind
     it -- the grid columns are on :has(), so removing the image is enough.
     Called after both renderers, since either can put new ones on the page. */
  /* The latest release for a mod, as a download chip.

     Asked of the GitHub API from the visitor's own browser rather than baked
     into mods.js, because a version number written into a file is a version
     number that goes stale the next time a release is cut. The API is
     CORS-open and needs no token for a public repo.

     Anonymous callers get 60 requests an hour per address, so this asks once
     per mod and remembers the answer for the session -- including the answer
     "there is no release", which is most of them today and would otherwise be
     re-asked on every click.

     A mod with no release shows nothing at all. There is no broken chip and
     no "coming soon": the slot simply stays hidden, the same way a missing
     icon or screenshot does. */
  var RELEASES = {};

  function wireDownload(m) {
    if (!m.repo) return;
    var slot = outEl.querySelector(".chip.dl");
    if (!slot) return;

    var slug = m.repo.replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");
    var key = "rel:" + slug;

    function paint(rel) {
      if (!rel || !rel.url) return;
      slot.href = rel.url;
      slot.innerHTML = "&#8595; " + esc(rel.tag) +
        (rel.size ? ' <b>' + Math.round(rel.size / 1024) + " kb</b>" : "") +
        (rel.downloads ? ' <span class="dl-n">' + num(rel.downloads) + "</span>" : "");
      slot.hidden = false;
    }

    if (RELEASES[slug]) { paint(RELEASES[slug]); return; }
    try {
      var cached = sessionStorage.getItem(key);
      if (cached !== null) {
        RELEASES[slug] = JSON.parse(cached);
        paint(RELEASES[slug]);
        return;
      }
    } catch (e) { /* private mode; just ask the network */ }

    fetch("https://api.github.com/repos/" + slug + "/releases/latest")
      .then(function (r) {
        // 404 is the ordinary case: public repo, no release cut yet.
        if (r.status === 404) return null;
        // 403 is the rate limit. Do NOT cache that as "no release", or the
        // whole session goes quiet over one bad minute.
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (d) {
        var asset = d && d.assets && d.assets.filter(function (a) {
          return /\.zip$/i.test(a.name);
        })[0];
        var rel = asset ? { tag: d.tag_name, url: asset.browser_download_url,
                            size: asset.size, downloads: asset.download_count } : {};
        RELEASES[slug] = rel;
        try { sessionStorage.setItem(key, JSON.stringify(rel)); } catch (e) {}
        // Guard against a slow reply landing after the reader has moved
        // on: paint only if this is still the mod on screen.
        if (current === m.id) paint(rel);
      })
      .catch(function () { /* offline, or rate limited: show nothing */ });
  }

  function sweepIcons() {
    var px = document.querySelectorAll("img.px");
    for (var n = 0; n < px.length; n++) {
      if (px[n].dataset.checked) continue;
      px[n].dataset.checked = "1";
      if (px[n].complete && !px[n].naturalWidth) {
        px[n].parentNode.removeChild(px[n]);
        continue;
      }
      px[n].addEventListener("error", function () {
        // gif first, png second, then give up and take the slot away.
        var alt = this.dataset.alt;
        if (alt) { this.dataset.alt = ""; this.src = alt; return; }
        if (this.parentNode) this.parentNode.removeChild(this);
      });
    }
  }

  function icon(id, cls) {
    return '<img class="px ' + cls + '" src="icons/' + esc(id) + '.gif" ' +
           'data-alt="icons/' + esc(id) + '.png" alt="" aria-hidden="true">';
  }

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
        '<span class="idx">' + (i + 1 < 10 ? "0" : "") + (i + 1) + "</span>" +
        icon(m.id, "row-icon") +
        '<span class="txt">' +
        '<span class="name">' + esc(m.name) + "</span>" +
        '<span class="desc">' + esc(m.tag) + "</span>" +
        '<span class="row"><span class="cat">' + esc(m.cat) + '</span>' +
        '<span class="loc">' + num(m.lines) + " loc</span></span></span>";
      b.style.animationDelay = (i * 45) + "ms";
      b.addEventListener("click", function () { select(m.id); });
      listEl.appendChild(b);
      // next frame so the animation actually plays on a re-render
      requestAnimationFrame(function () { b.classList.add("in"); });
    });

    sweepIcons();
  }

  // ── the dossier ───────────────────────────────────────────────────────
  function renderDossier(m) {
    var h = [];

    h.push('<div class="dossier-head">');
    h.push(icon(m.id, "head-icon"));
    h.push('<div class="head-text">');
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
      h.push('<a class="chip dl" hidden target="_blank" rel="noopener"></a>');
      h.push('<a class="chip link" href="' + esc(m.repo) + '" target="_blank" rel="noopener">source ↗</a>');
    } else {
      h.push('<span class="chip mute">source · private</span>');
    }
    h.push("</div>");   // chips
    h.push("</div>");   // head-text
    h.push("</div>");   // dossier-head

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
      h.push('<iframe class="player" data-vid="' + vid + '" loading="lazy" ' +
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
               // NOT lazy. The block is display:none until an image decodes,
               // and a lazy image inside a hidden element is never in the
               // viewport, so it never loads, so the block never shows: the
               // two rules deadlock each other.
               '<img src="' + esc(src) + '" ' +
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

    sweepIcons();
    wireDownload(m);

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
    var frame = outEl.querySelector(".vid .player");
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

    // One block, not two. The build rows and the size chart were separate
    // panels saying the same kind of thing about the same mod, with the
    // operator card now taking the top of the column.
    var h = [];
    h.push('<div class="id-card">');
    h.push('<div class="spec-header" style="border:0;background:none;padding:0 2px;">' +
           '<span class="title">' + icon(m.id, "spec-icon") + 'BUILD // ARCHIVE</span>' +
           '<span>' + esc(m.id.toUpperCase()) + '</span></div>');
    rows.forEach(function (r) {
      var cls = r[0] === "STATUS" && !m.repo ? " mute" : (r[0] === "STATUS" ? " on" : "");
      h.push('<div class="id-row"><span class="k">' + esc(r[0]) + '</span><span class="v' + cls + '">' + esc(r[1]) + "</span></div>");
    });
    h.push('<div class="id-barcode">┃┃│┃│ │┃│┃│ │┃┃│ ┃│┃ │┃│┃</div>');

    h.push('<div class="size-head"><span>size across the archive</span><span>loc</span></div>');
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
    h.push("</div>");   // id-card

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
    // After the spec panel too -- it renders last, so a sweep before it runs
    // leaves its own icon behind as a broken glyph.
    sweepIcons();
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

  /* The visitor count, in the status bar.

     A static site cannot count its own visitors, so this is somebody else's
     counter -- counterapi.com, which needs no key and sends the CORS header
     that every other free counter does not. countapi.xyz and abacus are both
     dead, hits.sh answers but blocks reads so its number can only be shown as
     their badge, and every open CORS proxy over it is blocked as well.

     It counts UNIQUE visitors, not page loads: the service dedupes by address,
     so a reload does not move it. That is the number worth showing anyway.

     The slot stays hidden until a number arrives. A counter that renders a
     dash, a zero or NaN when the service is down is worse than one that is not
     there -- and this one is free and unaccountable, so assume it will be down
     one day.  */
  (function visitors() {
    var el = document.getElementById("stat-visitors");
    if (!el) return;
    fetch("https://counterapi.com/api/spitmux/site/up")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || typeof d.value !== "number") return;
        el.querySelector("b").textContent = num(d.value);
        el.hidden = false;
      })
      .catch(function () { /* stays hidden */ });
  })();

  window.addEventListener("konami", function () {
    document.body.classList.toggle("unlocked");
    flash("flash", window.crtFlash);
  });
})();
