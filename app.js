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

  /* Which country the reader is in -- the only thing about them this site
     ever holds, and it is two letters. Kept as a promise rather than a
     variable: a download clicked in the first second of a visit was landing
     before the lookup answered, and the line came out with no country on it.
     Whoever wants it waits for it.

     Two services, because one of them is blocked often enough to matter, and
     the answer is remembered so a second visit knows it at once. Neither
     address is read, kept, or sent anywhere. */
  var VISITOR_CC = null;
  var CC_READY = (function () {
    try {
      var seen = localStorage.getItem("cc");
      if (seen && /^[A-Z]{2}$/.test(seen)) { VISITOR_CC = seen; return Promise.resolve(seen); }
    } catch (e) { /* private mode */ }

    function ask(url, pick) {
      return fetch(url)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          var cc = d && pick(d);
          return (cc && /^[A-Z]{2}$/.test(cc)) ? cc : null;
        })
        .catch(function () { return null; });
    }

    return ask("https://api.country.is/", function (d) { return d.country; })
      .then(function (cc) {
        return cc || ask("https://get.geojs.io/v1/ip/country.json", function (d) { return d.country; });
      })
      .then(function (cc) {
        VISITOR_CC = cc;
        if (cc) { try { localStorage.setItem("cc", cc); } catch (e) {} }
        return cc;
      });
  })();

  /* Dates in the reader's own clock, and in their own language: the browser
     knows both, and "10 Sep, 15:32" is worth more than "2 days ago" on its
     own. The distance stays in front of it -- that is the part you read at a
     glance -- and the exact instant goes in the title. */
  function tag() { return document.documentElement.lang || "en"; }

  function clockOf(d) {
    try {
      // Twelve-hour, and lowercase where the language uses am/pm at all --
      // the page is lowercase and a shouted PM sits badly in it.
      return d.toLocaleTimeString(tag(), { hour: "numeric", minute: "2-digit", hour12: true })
              .replace(/\bAM\b/, "am").replace(/\bPM\b/, "pm");
    } catch (e) {
      var h = d.getHours();
      return ((h % 12) || 12) + ":" + z2(d.getMinutes()) + (h < 12 ? " am" : " pm");
    }
  }
  function z2(n) { return (n < 10 ? "0" : "") + n; }

  function dateOf(d) {
    var opts = { day: "numeric", month: "short" };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    try { return d.toLocaleDateString(tag(), opts); }
    catch (e) { return d.toDateString(); }
  }

  // whole days between that instant and now, by the reader's calendar, so a
  // stamp just after midnight does not read as yesterday
  function dayGap(d) {
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var b = new Date();
    return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - a) / 864e5);
  }

  function gapWords(n) {
    if (n <= 0) return T("time.today");
    if (n === 1) return T("time.yesterday");
    if (n < 14) return T("time.days", { n: n });
    if (n < 60) return T("time.weeks", { n: Math.round(n / 7) });
    if (n < 365) return T("time.months", { n: Math.round(n / 30) });
    var y = Math.round(n / 365);
    return y === 1 ? T("time.year") : T("time.years", { n: y });
  }

  // "2 days ago · 10 Sep, 15:32" -- within the week the date is dropped, it
  // says nothing the words have not already said
  function when(d, withTime) {
    var n = dayGap(d);
    var words = gapWords(n);
    var exact = (n < 7 ? "" : dateOf(d) + (withTime ? ", " : ""));
    if (withTime) exact += clockOf(d);
    return exact ? words + " \u00b7 " + exact : words;
  }

  function since(iso) { return when(new Date(iso), true); }

  function wireDownload(m) {
    if (!m.repo) return;
    var slot = outEl.querySelector(".chip.dl");
    var count = outEl.querySelector(".chip.dl-count");
    if (!slot) return;

    var slug = m.repo.replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");
    var key = "rel:" + slug;
    var FRESH = 10 * 60 * 1000;      // how long a release answer is worth keeping

    function paint(rel) {
      if (!rel || !rel.url) return;
      slot.href = rel.url;
      slot.innerHTML = "&#8595; " + esc(rel.tag) +
        (rel.size ? ' <b>' + Math.round(rel.size / 1024) + " kb</b>" : "");
      slot.hidden = false;

      // Shown even at zero. Hidden-when-empty reads as "there is no counter"
      // rather than "nobody has taken it yet", and the second is the useful
      // fact -- a release that has just gone up SHOULD say 0.
      if (count) {
        var n = rel.downloads || 0;
        count.innerHTML = num(n) + " <b>" + esc(n === 1 ? T("chip.download") : T("chip.downloads")) + "</b>";
        count.title = T("chip.count_title");
        count.hidden = false;
      }

      var meta = outEl.querySelector(".dl-meta");
      if (meta && rel.at) {
        var up = meta.querySelector(".up");
        up.textContent = T("meta.updated", { when: since(rel.at) });
        up.title = new Date(rel.at).toUTCString();
        meta.hidden = false;
      }
      slot.onclick = function () { grab(slug); bubble(); };   // assigned, so never twice
      wireLastGrab(m, slug);
    }

    /* A release cut ten minutes ago should show. The answer is kept, but not
       for the life of the tab: somebody who leaves this open all day was
       being told about a version that had since been replaced. Ten minutes
       is short enough to be current and long enough that clicking down the
       index does not spend the hour's sixty anonymous API calls. */
    if (RELEASES[slug] && Date.now() - RELEASES[slug].at < FRESH) {
      paint(RELEASES[slug].rel);
      return;
    }
    try {
      var cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (cached && Date.now() - cached.at < FRESH) {
        RELEASES[slug] = cached;
        paint(cached.rel);
        return;
      }
      // stale, but better than an empty slot while the network answers
      if (cached) paint(cached.rel);
    } catch (e) { /* private mode; just ask the network */ }

    /* The whole list rather than /releases/latest, which costs the same one
       request and answers a better question. Downloads live on the ASSET, so
       asking only about the newest release reports zero the moment a new
       version goes up and throws away everything the old ones earned -- fumes
       had four releases and a download, and read as none. */
    fetch("https://api.github.com/repos/" + slug + "/releases?per_page=100")
      .then(function (r) {
        if (r.status === 404) return null;
        // 403 is the rate limit. Do NOT cache that as "no release", or the
        // whole session goes quiet over one bad minute.
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (list) {
        var zips = function (rel) {
          return (rel.assets || []).filter(function (a) { return /\.zip$/i.test(a.name); });
        };
        var newest = (list && list.length) ? list[0] : null;
        var asset = newest ? zips(newest)[0] : null;
        var total = 0;
        (list || []).forEach(function (r2) {
          zips(r2).forEach(function (a) { total += a.download_count || 0; });
        });
        var rel = asset ? { tag: newest.tag_name, url: asset.browser_download_url,
                            size: asset.size, downloads: total,
                            at: newest.published_at || null } : {};
        var box = { at: Date.now(), rel: rel };
        RELEASES[slug] = box;
        try { sessionStorage.setItem(key, JSON.stringify(box)); } catch (e) {}
        // Guard against a slow reply landing after the reader has moved
        // on: paint only if this is still the mod on screen.
        if (current === m.id) paint(rel);
      })
      .catch(function () { /* offline, or rate limited: show nothing */ });
  }

  /* When it was last taken from here, and from where.

     GitHub counts downloads but never says when or from where, so the button
     records its own clicks in the same counter the map uses: one key per mod
     per UTC day, and one per mod per day per country. The service dedupes by
     address on its side, so a reader who clicks twice is one. Reads are
     ?readonly=true throughout, so looking never counts as taking.

     What is stored is a day and a two-letter code. Nothing about who. */
  var COUNTER = "https://counterapi.com/api/spitmux/";
  var GRABS = {};

  function dayKey(d) { return d.toISOString().slice(0, 10).replace(/-/g, ""); }
  function slugKey(slug) { return slug.replace(/[^a-z0-9]+/gi, "-").toLowerCase(); }

  /* A counter key is a name and a number, so the time has to live in the
     name: one key for the day, one for the hour inside it, one for the ten
     minutes inside that. Reading back is then a coarse-to-fine search --
     fourteen days, then twenty-four hours, then six buckets -- rather than
     the two thousand reads a minute-resolution key would need. Everything is
     UTC in the key and the reader's own clock on the screen. */
  function grab(slug) {
    var now = new Date();
    var s = slugKey(slug), day = dayKey(now);
    var hh = z2(now.getUTCHours());
    var m6 = String(Math.floor(now.getUTCMinutes() / 10));

    // spaced, not fired as one burst: four writes landing in the same
    // millisecond is the shape of a thing being hammered, and a free service
    // is within its rights to answer only the first
    var keys = ["dl/" + s + "-" + day,
                "dlh/" + s + "-" + day + hh,
                "dlm/" + s + "-" + day + hh + m6];
    keys.forEach(function (k, i) {
      setTimeout(function () {
        fetch(COUNTER + k, { keepalive: true }).catch(function () {});
      }, i * 180);
    });

    // and show it at once, without waiting on the counter
    GRABS[s] = { day: day, hh: hh, m6: m6, cc: VISITOR_CC };
    remember(s);
    paintGrab(s);

    // the country lands whenever it lands; the line fills in then
    CC_READY.then(function (cc) {
      if (!cc) return;
      setTimeout(function () {
        fetch(COUNTER + "dlat/" + s + "-" + day + "-" + cc, { keepalive: true }).catch(function () {});
      }, 540);
      if (GRABS[s] && !GRABS[s].cc) {
        GRABS[s].cc = cc;
        remember(s);
        paintGrab(s);
      }
    });
  }

  /* Your own downloads are kept in this browser, not just this tab: the
     counter's readback lags a good while behind its writes, so without this
     the line forgets what you did the moment you close the tab and does not
     hear about it again for hours. */
  function remember(s) {
    try { localStorage.setItem("grab:" + s, JSON.stringify(GRABS[s])); } catch (e) {}
  }

  function stampOf(g) {           // sortable: 20260912 09 3
    return g && g.day ? g.day + (g.hh || "00") + (g.m6 || "0") : "";
  }

  function mine(s) {
    try {
      var raw = localStorage.getItem("grab:" + s) || sessionStorage.getItem("grab:" + s);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* The bubble. The file opens in a new tab, so the page is still here when
     the click lands -- a moment to say two things: it is coming, and it is
     not finished. Spoken by the little sprite in icons/bubble.gif, above
     the button; goes on its own after a few seconds, or on a click. */
  var bubbleTimer = null;
  function bubble() {
    var row = outEl.querySelector(".chips.actions");
    if (!row) return;
    var old = row.querySelector(".bubble");
    if (old) old.parentNode.removeChild(old);
    clearTimeout(bubbleTimer);

    var b = document.createElement("div");
    b.className = "bubble";
    b.setAttribute("role", "status");
    b.innerHTML =
      '<img class="bubble-head" src="' + art("icons/bubble.gif") + '" alt="" aria-hidden="true">' +
      '<span class="bubble-text"><b>' + esc(T("bubble.start")) + '</b>' +
      '<span>' + esc(T("bubble.wip")) + '</span></span>';
    row.appendChild(b);

    function go() {
      clearTimeout(bubbleTimer);
      b.classList.add("out");
      setTimeout(function () { b.parentNode && b.parentNode.removeChild(b); }, 320);
    }
    b.addEventListener("click", go);
    bubbleTimer = setTimeout(go, 6000);
  }

  function readCount(path) {
    return fetch(COUNTER + path + "?readonly=true")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && d.value != null) ? +d.value : null; })
      .catch(function () { return null; });
  }

  // the countries anyone has ever visited from: small, and bounded
  function visitedFrom() {
    return fetch("geo.json").then(function (r) { return r.ok ? r.json() : null; })
      .then(function (o) { return (o && o.rows) ? o.rows.map(function (r) { return r[0]; }) : []; })
      .catch(function () { return []; });
  }

  // the instant a grab record stands for. Midday when only the day is known,
  // so which side of midnight the reader is on cannot flip the wording.
  function grabAt(g) {
    var hh = (g.hh == null) ? 12 : +g.hh;
    var mm = (g.m6 == null) ? 0 : +g.m6 * 10;
    return new Date(Date.UTC(+g.day.slice(0, 4), +g.day.slice(4, 6) - 1, +g.day.slice(6, 8), hh, mm));
  }

  function paintGrab(s) {
    var g = GRABS[s];
    var meta = outEl.querySelector(".dl-meta");
    var el = meta && meta.querySelector(".last");
    if (!el || !g || !g.day) return;
    var at = grabAt(g);
    el.innerHTML = T("meta.grabbed", { when: "<b>" + esc(when(at, g.hh != null)) + "</b>" }) +
      (g.cc ? " " + esc(T("meta.from")) + ' <img class="flag" alt="" width="18" height="12" ' +
              'src="https://flagcdn.com/' + esc(g.cc.toLowerCase()) + '.svg"> ' + esc(g.cc) : "");
    var f = el.querySelector(".flag");
    if (f) f.addEventListener("error", function () { f.parentNode && f.parentNode.removeChild(f); });
    el.title = at.toUTCString() + (g.m6 != null ? " (to the nearest ten minutes)" : "");
    meta.hidden = false;
  }

  function wireLastGrab(m, slug) {
    var s = slugKey(slug);
    if (GRABS[s]) { paintGrab(s); return; }

    // what this browser did, shown at once; the counter is asked anyway, in
    // case somebody else has been more recent
    var own = mine(s);
    if (own) { GRABS[s] = own; paintGrab(s); }

    // Walk back a day at a time until one answers. Two weeks is far enough:
    // past that the line is not news, and the slot just says when it went up.
    var days = [];
    for (var i = 0; i < 14; i++) days.push(dayKey(new Date(Date.now() - i * 864e5)));

    function done(g) {
      var have = mine(s);
      if (have && stampOf(have) >= stampOf(g)) return;   // yours is the later one
      GRABS[s] = g;
      try { sessionStorage.setItem("grab:" + s, JSON.stringify(g)); } catch (e) {}
      if (current === m.id) paintGrab(s);
    }
    // the last of a run of keys that answered -- Promise.all keeps the order,
    // so the last non-zero is the latest
    function latest(keys, make) {
      return Promise.all(keys.map(function (k) {
        return readCount(make(k)).then(function (n) { return [k, n || 0]; });
      })).then(function (rows) {
        var hit = null;
        rows.forEach(function (r) { if (r[1] > 0) hit = r[0]; });
        return hit;
      });
    }

    function whereFrom(day) {
      var hours = [], i;
      for (i = 0; i < 24; i++) hours.push(z2(i));

      var out = { day: day, cc: null, hh: null, m6: null };

      // the hour, then the ten minutes inside it. A record from before these
      // keys existed answers nothing and the line simply keeps the day.
      var clock = latest(hours, function (h) { return "dlh/" + s + "-" + day + h; })
        .then(function (h) {
          if (!h) return;
          out.hh = h;
          var six = ["0", "1", "2", "3", "4", "5"];
          return latest(six, function (m) { return "dlm/" + s + "-" + day + h + m; })
            .then(function (m) { if (m) out.m6 = m; });
        });

      var where = visitedFrom().then(function (ccs) {
        return Promise.all(ccs.map(function (cc) {
          return readCount("dlat/" + s + "-" + day + "-" + cc)
            .then(function (n) { return [cc, n || 0]; });
        }));
      }).then(function (pairs) {
        pairs.sort(function (a, b) { return b[1] - a[1]; });
        if (pairs.length && pairs[0][1] > 0) out.cc = pairs[0][0];
      });

      Promise.all([clock, where]).then(function () { done(out); });
    }
    (function step(i) {
      if (current !== m.id && !GRABS[s]) { /* reader moved on; finish quietly */ }
      if (i >= days.length) { done({}); return; }
      readCount("dl/" + s + "-" + days[i]).then(function (n) {
        if (n > 0) whereFrom(days[i]); else step(i + 1);
      });
    })(0);
  }

  /* Load an image once it is nearly in view, and not before.

     loading="lazy" does the deferring -- the browser's own, which cannot fail
     to fire. An IntersectionObserver was tried first and is the wrong tool:
     it is invisible to verify (it does not fire at all in a pane that is not
     compositing) and if it ever failed to run, nothing on the page would load
     at all. Native lazy loading degrades to "load it now", which is the right
     way round.

     The reason it was avoided originally is gone: lazy never fires inside a
     display:none container, and the gallery used to hide itself until an
     image decoded, so a missing file could never error and its empty frame
     sat open forever. The gallery reserves space instead now. */
  function watchImage(img) {
    if (img.dataset.watched) return;
    img.dataset.watched = "1";

    img.addEventListener("load", function () {
      var fig = this.parentNode;
      var wrap = fig && fig.parentNode;
      if (wrap && wrap.classList && wrap.classList.contains("shots")) {
        wrap.classList.add("ready");
      }
    });

    img.addEventListener("error", function () {
      // A still that is not there falls back to the gif, and vice versa,
      // before the slot is given up on entirely.
      var alt = this.dataset.alt;
      if (alt) { this.removeAttribute("data-alt"); this.src = alt; return; }
      var fig = this.parentNode;
      var isShot = fig && fig.classList && fig.classList.contains("shot");
      var gone = isShot ? fig : this;
      var wrap = gone.parentNode;
      if (wrap) wrap.removeChild(gone);
      if (wrap && wrap.classList && wrap.classList.contains("shots") &&
          !wrap.querySelector(".shot") && wrap.parentNode) {
        wrap.parentNode.removeChild(wrap);
      }
    });

    // A cached image can already be complete before these listeners attach,
    // in which case neither event will ever fire for it.
    if (img.complete && img.naturalWidth) {
      var fig = img.parentNode, wrap = fig && fig.parentNode;
      if (wrap && wrap.classList && wrap.classList.contains("shots")) {
        wrap.classList.add("ready");
      }
    }
  }

  function sweepIcons() {
    var all = document.querySelectorAll("img.px, .shot img, .vid .poster");
    for (var n = 0; n < all.length; n++) watchImage(all[n]);
  }

  var STILL = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function icon(id, cls) {
    // The index rows and the dossier head animate; the spec panel takes a
    // still. Rows sit in the amber until they are hovered or chosen, and
    // then show in colour. Somebody who asked for less motion gets stills
    // everywhere -- a gif cannot be paused from a stylesheet.
    var moving = !STILL && (cls === "head-icon" || cls === "row-icon");
    var a = art("icons/" + esc(id) + (moving ? ".gif" : ".still.png"));
    var b = art("icons/" + esc(id) + (moving ? ".still.png" : ".gif"));
    return '<img class="px ' + cls + '" src="' + a + '" loading="lazy" ' +
           'data-alt="' + b + '" alt="" aria-hidden="true">';
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function num(n) { return n.toLocaleString("en-GB"); }
  // the language layer; identity when i18n.js is not there
  function T(k, v) { return window.I18N ? window.I18N.t(k, v) : k; }
  function TM(m) { return window.I18N ? window.I18N.mod(m) : m; }

  // Art is addressed by name, never by hash, so a browser that has seen an
  // icon keeps it for the ten minutes Pages allows -- a replaced sprite went
  // unseen for that long. stamp.py hashes everything in icons/ and shots/
  // into a meta tag, and that rides along as a query, so the new file shows
  // the moment the page does. A data: URI (the single-file build) is left be.
  var ART_V = (document.querySelector('meta[name="art-v"]') || {}).content || "";
  function art(path) { return (ART_V && !/^data:/.test(path)) ? path + "?v=" + ART_V : path; }

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
  document.getElementById("node-count").textContent = T("index.nodes", { n: MODS.length });

  // ── the index ─────────────────────────────────────────────────────────
  function renderList() {
    listEl.innerHTML = "";

    if (!shown.length) {
      var empty = document.createElement("div");
      empty.className = "index-empty";
      empty.textContent = T("index.nomatch");
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
        '<span class="status-tag' + (m.repo ? " ready" : "") + '">' + esc(m.repo ? T("index.public") : T("index.local")) + "</span>" +
        '<span class="idx">' + (i + 1 < 10 ? "0" : "") + (i + 1) + "</span>" +
        icon(m.id, "row-icon") +
        '<span class="txt">' +
        '<span class="name">' + esc(m.name) + "</span>" +
        '<span class="desc">' + esc(TM(m).tag) + "</span>" +
        '<span class="row"><span class="cat">' + esc(m.cat) + '</span>' +
        '<span class="loc">' + num(m.lines) + " " + esc(T("index.loc")) + "</span></span></span>";
      b.style.animationDelay = (i * 45) + "ms";
      b.addEventListener("click", function () { select(m.id); });
      listEl.appendChild(b);
    });

    sweepIcons();
  }

  // ── the dossier ───────────────────────────────────────────────────────
  function renderDossier(m) {
    m = TM(m);                       // the prose in the reader's language
    var h = [];

    h.push('<div class="dossier-head">');
    h.push(icon(m.id, "head-icon"));
    h.push('<div class="head-text">');
    h.push('<div class="crumb">' + esc(T("crumb.archive")) + ' <span class="sep">/</span> <span class="cat">' + esc(m.cat) +
           '</span> <span class="sep">/</span> ' + esc(m.id) + "</div>");
    h.push('<h1 class="dossier-title" id="dossier-title">' + esc(m.name) + "</h1>");
    h.push('<div class="dossier-tag">' + esc(m.tag) + "</div>");

    h.push('<div class="chips">');
    h.push('<span class="chip">' + num(m.lines) + " <b>" + esc(T("chip.loc")) + "</b></span>");
    h.push('<span class="chip">' + m.files + " <b>" + esc(T("chip.files")) + "</b></span>");
    if (m.key && m.key !== "—") h.push('<span class="chip">' + esc(T("chip.menu")) + ' <b>' + esc(m.key) + "</b></span>");
    h.push('<span class="chip">c<b>#</b> · shvdn 3</span>');
    h.push("</div>");   // chips: the facts
    h.push('<div class="chips actions">');
    if (m.repo) {
      h.push('<a class="chip dl" hidden target="_blank" rel="noopener"></a>');
      h.push('<span class="chip dl-count" hidden></span>');
      h.push('<a class="chip link" href="' + esc(m.repo) + '" target="_blank" rel="noopener">' + esc(T("chip.source")) + '</a>');
    } else {
      h.push('<span class="chip mute">' + esc(T("chip.private")) + '</span>');
    }
    h.push("</div>");   // chips
    if (m.repo) h.push('<div class="dl-meta" hidden><span class="up"></span><span class="last"></span></div>');
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
      // A YouTube embed pulls in about a megabyte of player before anybody
      // has asked to watch anything, which on a phone is most of the page for
      // a thing many visitors scroll straight past. So: YouTube's own still,
      // around fifteen kilobytes, and the player only once it is clicked --
      // which is a user gesture, so autoplay is allowed and the tap is not
      // spent twice.
      h.push('<button type="button" class="box" data-vid="' + vid + '" ' +
             'aria-label="' + esc(T("video.play")) + ' ' + esc(m.video.label) + '">' +
             '<img class="poster" alt="" loading="lazy" ' +
             'src="https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg">' +
             '<span class="play">&#9654;</span>' +
             '<span class="cue">' + esc(m.video.label) + '</span></button>');
      h.push('<figcaption><span class="drawn">' + esc(T("video.footage")) + '</span>' +
             '<a href="https://www.youtube.com/watch?v=' + vid + '" ' +
             'target="_blank" rel="noopener">' + esc(T("video.watch")) + '</a></figcaption>');
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
               '<img src="' + esc(art(src)) + '" loading="lazy" ' +
               'alt="' + esc(cap || (m.name + " in game")) + '">' +
               (cap ? '<figcaption>' + esc(cap) + "</figcaption>" : "") +
               "</figure>");
      });
      h.push("</div>");
    }

    // The mod's own pixel art, where it has some worth showing: what Posted
    // Up sells, what Bare Minimum serves. Small tiles, in the amber until
    // hovered, each with its name under it.
    if (m.strip && m.strip.items && m.strip.items.length) {
      h.push('<div class="strip">');
      h.push('<div class="sec-rule">' + esc(T("strip." + (m.strip.kind || "product"))) + '</div>');
      h.push('<div class="strip-grid">');
      m.strip.items.forEach(function (it) {
        h.push('<figure class="tile">' +
               '<img class="px" src="' + esc(art(it[0])) + '" loading="lazy" alt="' + esc(it[1]) + '">' +
               '<figcaption>' + esc(it[1]) + '</figcaption></figure>');
      });
      h.push('</div></div>');
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
      h.push('<div class="sec-rule">' + esc(T("sec.controls")) + '</div>');
      h.push('<table class="ctrl-table"><tbody>');
      m.ctrl.forEach(function (r) {
        h.push('<tr><td class="k"><kbd>' + esc(r[0]) + '</kbd></td><td class="v">' + esc(r[1]) + "</td></tr>");
      });
      h.push("</tbody></table>");
    }

    h.push('<div class="sec-rule">' + esc(T("sec.install")) + '</div>');
    h.push('<div class="codeblock">');
    h.push('<span class="c">' + esc(T("install.requires")) + '</span>\n');
    if (m.install && m.install.length) {
      h.push(m.install.map(function (f) { return '<span class="f">' + esc(f) + "</span>"; }).join("\n"));
    } else {
      h.push('<span class="f">scripts\\' + esc(m.name.replace(/[^A-Za-z0-9]/g, "")) + ".dll</span>\n" +
             '<span class="f">scripts\\' + esc(m.name.replace(/[^A-Za-z0-9]/g, "")) + ".ini</span>");
    }
    h.push('\n<span class="c">' + esc(T("install.onebuild")) + '</span>');
    h.push("</div>");

    h.push('<div class="foot-note">');
    h.push("<span>" + esc(T("foot.none")) + "</span>");
    h.push(m.repo
      ? '<a href="' + esc(m.repo) + '" target="_blank" rel="noopener">' + esc(m.repo.replace("https://", "")) + "</a>"
      : "<span>" + esc(T("foot.unpublished")) + "</span>");
    h.push("</div>");

    outEl.innerHTML = h.join("");

    sweepIcons();
    wireDownload(m);


    // The still is swapped for the real player on click. That click is a
    // user gesture, so autoplay is allowed and the tap is not spent twice.
    var box = outEl.querySelector(".vid .box");
    if (box) {
      box.addEventListener("click", function () {
        var f = document.createElement("iframe");
        f.className = "player";
        f.src = "https://www.youtube-nocookie.com/embed/" + box.dataset.vid +
                "?rel=0&autoplay=1";
        f.title = "Video";
        f.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen";
        f.allowFullscreen = true;
        f.referrerPolicy = "strict-origin-when-cross-origin";

        // Nothing reports a blocked embed -- a sandbox that refuses third
        // party frames does it silently -- so a load event that never arrives
        // is still the only signal there is.
        var landed = false;
        f.addEventListener("load", function () { landed = true; }, { once: true });
        box.parentNode.replaceChild(f, box);
        setTimeout(function () {
          if (landed || !f.parentNode) return;
          var a = document.createElement("a");
          a.className = "box";
          a.href = "https://www.youtube.com/watch?v=" + box.dataset.vid;
          a.target = "_blank";
          a.rel = "noopener";
          a.innerHTML = '<span class="play">&#9654;</span>' +
                        '<span class="cue">' + esc(T("video.blocked")) + '</span>';
          f.parentNode.replaceChild(a, f);
        }, 4000);
      }, { once: true });
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
      [T("spec.mod"), m.name],
      [T("spec.class"), m.cat],
      [T("spec.status"), m.repo ? T("spec.public") : T("spec.localbuild"), "status"],
      [T("spec.language"), "C#"],
      [T("spec.runtime"), "SHVDN 3"],
      [T("spec.editions"), "LEGACY + ENH"],
      [T("spec.assets"), T("spec.none")],
      [T("spec.menu"), m.key || "—"],
      [T("spec.source"), num(m.lines) + " LOC"],
      [T("spec.files"), m.files]
    ];

    // One block, not two. The build rows and the size chart were separate
    // panels saying the same kind of thing about the same mod, with the
    // operator card now taking the top of the column.
    var h = [];
    h.push('<div class="id-card">');
    h.push('<div class="spec-header" style="border:0;background:none;padding:0 2px;">' +
           '<span class="title">' + icon(m.id, "spec-icon") + esc(T("spec.archive")) + '</span>' +
           '<span>' + esc(m.id.toUpperCase()) + '</span></div>');
    rows.forEach(function (r) {
      var cls = r[2] === "status" ? (m.repo ? " on" : " mute") : "";
      h.push('<div class="id-row"><span class="k">' + esc(r[0]) + '</span><span class="v' + cls + '">' + esc(r[1]) + "</span></div>");
    });
    h.push('<div class="id-barcode">┃┃│┃│ │┃│┃│ │┃┃│ ┃│┃ │┃│┃</div>');

    h.push('<div class="size-head"><span>' + esc(T("spec.size")) + '</span><span>' + esc(T("chip.loc")) + '</span></div>');
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

    h.push('<div class="spec-note">' + esc(T("spec.note", {
      lines: num(TOTAL_LINES), mods: MODS.length, files: num(TOTAL_FILES) })) + "</div>");

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
      T("index.nodes", { n: shown.length === MODS.length ? MODS.length : shown.length + " / " + MODS.length });
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
    // The cold open prints the boot itself now; typing it again into the
    // panel would say the same thing twice. Without a cold open it is the
    // panel's job as before.
    if (window.crtIntro && window.crtIntro.logged) select(first, true);
    else boot(function () { select(first, true); });
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

    /* And which country, so the map has something to pin. The lookup is the
       one above; what gets stored anywhere is a single +1 against "GB", and
       no part of this site ever learns, keeps or publishes who anybody is.
       That is also why it is a country and not a city: a pin on a town is a
       pin on a person, near enough. */
    CC_READY.then(function (cc) {
      if (cc) fetch("https://counterapi.com/api/spitmux/geo/" + cc).catch(function () {});
    });
  })();

  // ── language ──────────────────────────────────────────────────────────
  // The flag in the title bar. When the language changes, everything a
  // script built is built again; the static text swaps itself.
  if (window.I18N) {
    window.I18N.mount(document.getElementById("lang"));
    window.addEventListener("i18n", function () {
      var tg = document.getElementById("tagline");
      if (tg) delete tg.dataset.realText;        // so the scrambler re-reads it
      applyFilter();
      if (current) {
        var m = byId(current);
        renderDossier(m);
        renderSpec(m);
        sweepIcons();
        wireDownload(m);
      }
    });
  }

  window.addEventListener("konami", function () {
    document.body.classList.toggle("unlocked");
    flash("flash", window.crtFlash);
  });
})();
