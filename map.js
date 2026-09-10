// ─── Where from ─────────────────────────────────────────────────────────────
// Draws the coastline from map-data.js, then asks the counter what each
// country's tally is and puts a pin on the ones above zero.
//
// Every read is ?readonly=true. The plain endpoint is a HIT counter: reading a
// key counts as a visit to it, so a page that polled 174 countries the ordinary
// way would add one to every country on earth each time somebody opened it,
// and the map would slowly fill in with people who had never been.
//
// Nothing here knows an address. The visitor's own country is looked up on the
// archive page and turned into a single +1 against a two-letter code; what is
// stored is "N from GB", never who.
//

(function () {
  var API = "https://counterapi.com/api/spitmux/geo/";
  var CACHE = "geo:v1";
  var CACHE_MS = 10 * 60 * 1000;
  var LANES = 8;                       // parallel reads; it is a free service

  var M = window.MAP;
  var svg = document.getElementById("map");
  var note = document.getElementById("note");
  var tally = document.getElementById("tally");
  var total = document.getElementById("tally-total");
  var seen = document.querySelector("#stat-seen b");

  if (!M || !svg) return;

  // ── the map itself ──────────────────────────────────────────────────────
  var NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  svg.setAttribute("viewBox", "0 0 " + M.w + " " + M.h);

  // graticule every 30 degrees, so the projection is legible as one
  var grat = el("g", { "class": "grat" });
  for (var lon = -180; lon <= 180; lon += 30) {
    var x = (lon + 180) / 360 * M.w;
    grat.appendChild(el("line", { x1: x, y1: 0, x2: x, y2: M.h }));
  }
  for (var lat = -60; lat <= 60; lat += 30) {
    var y = (90 - lat) / 180 * M.h;
    grat.appendChild(el("line", { x1: 0, y1: y, x2: M.w, y2: y }));
  }
  svg.appendChild(grat);
  svg.appendChild(el("path", { "class": "coast", d: M.land }));

  var pinLayer = el("g", {});
  svg.appendChild(pinLayer);

  // ── reading the tallies ─────────────────────────────────────────────────
  function readOne(cc) {
    return fetch(API + cc + "?readonly=true")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return [cc, (d && +d.value) || 0]; })
      .catch(function () { return [cc, 0]; });
  }

  function readAll(codes, onProgress) {
    var out = [];
    var i = 0;
    var done = 0;

    function lane() {
      if (i >= codes.length) return Promise.resolve();
      var cc = codes[i++];
      return readOne(cc).then(function (pair) {
        out.push(pair);
        onProgress(++done, codes.length);
        return lane();
      });
    }

    var lanes = [];
    for (var n = 0; n < Math.min(LANES, codes.length); n++) lanes.push(lane());
    return Promise.all(lanes).then(function () { return out; });
  }

  function cached() {
    try {
      var raw = sessionStorage.getItem(CACHE);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (Date.now() - o.at < CACHE_MS) ? o.rows : null;
    } catch (e) { return null; }
  }

  function keep(rows) {
    try {
      sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), rows: rows }));
    } catch (e) { /* private mode */ }
  }

  // ── drawing what came back ──────────────────────────────────────────────
  function render(rows) {
    var hits = rows.filter(function (r) { return r[1] > 0 && M.pins[r[0]]; });
    hits.sort(function (a, b) { return b[1] - a[1]; });

    var sum = hits.reduce(function (a, r) { return a + r[1]; }, 0);
    var max = hits.length ? hits[0][1] : 1;

    pinLayer.textContent = "";
    hits.forEach(function (r) {
      var p = M.pins[r[0]];
      // Area with the count, not radius -- a country with ten visits should
      // look ten times as much, and radius-scaling would make it a hundred.
      var rad = 2.6 + 9 * Math.sqrt(r[1] / max);
      var g = el("g", {});
      g.appendChild(el("circle", { "class": "pin-ring", cx: p[0], cy: p[1], r: rad + 2.5 }));
      g.appendChild(el("circle", { "class": "pin", cx: p[0], cy: p[1], r: rad }));
      var t = el("title", {});
      t.textContent = p[2] + " — " + r[1];
      g.appendChild(t);
      pinLayer.appendChild(g);
    });

    total.textContent = sum;
    seen.textContent = hits.length;

    if (!hits.length) {
      tally.innerHTML = '<div class="tally-empty">nobody yet</div>';
      note.textContent = "no countries recorded yet";
      return;
    }

    tally.innerHTML = hits.map(function (r) {
      var p = M.pins[r[0]];
      return '<div class="tally-row"><span class="cc">' + r[0] + "</span>" +
             "<span>" + p[2] + "</span>" +
             '<span class="n">' + r[1] + "</span></div>";
    }).join("");

    note.textContent = sum + (sum === 1 ? " visit" : " visits") + " from " +
      hits.length + (hits.length === 1 ? " country" : " countries");
  }

  var have = cached();
  if (have) {
    render(have);
    note.textContent += "  ·  cached";
  } else {
    var codes = Object.keys(M.pins);
    readAll(codes, function (d, n) {
      note.textContent = "scanning " + d + "/" + n + "…";
    }).then(function (rows) {
      keep(rows);
      render(rows);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") location.href = "./";
  });
})();
