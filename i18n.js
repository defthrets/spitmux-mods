// ─── Languages ──────────────────────────────────────────────────────────────
// English is the page as written: the chrome strings ride along in
// i18n/en.js and the prose sits in mods.js. Every other language is one file,
// i18n/<code>.json, the same shape as i18n/source.json with the values
// translated, fetched only when somebody picks it.
//
// The chrome is translated in two ways. Static text in the markup carries a
// data-i18n key and is swapped in place; anything a script builds asks t()
// at build time and is rebuilt when the language changes (the "i18n" event).
// Mod prose goes through mod(): the mod's own fields, overlaid with the
// translation where there is one, so a language that has not caught up with
// a new mod falls back to English a field at a time rather than all at once.
//
// The choice is remembered per browser. First visit: the browser's own
// languages, if one of them is here; else English.

window.I18N = (function () {
  "use strict";

  var LANGS = [
    { code: "en", flag: "au", name: "English" },
    { code: "ko", flag: "kr", name: "한국어" },
    { code: "pt", flag: "br", name: "Português" },
    { code: "zh", flag: "cn", name: "中文" },
    { code: "ja", flag: "jp", name: "日本語" },
    { code: "es", flag: "es", name: "Español" },
    { code: "de", flag: "de", name: "Deutsch" },
    { code: "fr", flag: "fr", name: "Français" }
  ];
  var KEY = "lang";
  var EN = window.I18N_EN || {};
  var packs = { en: { ui: EN, mods: {} } };
  var lang = "en";

  function byCode(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
    return null;
  }

  function fill(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (_, k) {
      return vars.hasOwnProperty(k) ? String(vars[k]) : "{" + k + "}";
    });
  }

  function t(key, vars) {
    var pack = packs[lang];
    var s = (pack && pack.ui && pack.ui[key] != null) ? pack.ui[key]
          : (EN[key] != null ? EN[key] : key);
    return fill(s, vars);
  }

  // the mod, with its prose in the current language where that exists
  function mod(m) {
    var pack = packs[lang];
    var p = pack && pack.mods && pack.mods[m.id];
    if (!p) return m;
    var out = {};
    for (var k in m) if (m.hasOwnProperty(k)) out[k] = m[k];
    if (p.tag) out.tag = p.tag;
    if (p.blurb) out.blurb = p.blurb;
    if (p.points && m.points) {
      out.points = m.points.map(function (x, i) {
        var y = p.points[i] || {};
        return { h: y.h || x.h, t: y.t || x.t };
      });
    }
    if (p.shots && m.shots) {
      out.shots = m.shots.map(function (s, i) {
        if (typeof s === "string") return s;
        var o = {};
        for (var k2 in s) if (s.hasOwnProperty(k2)) o[k2] = s[k2];
        if (p.shots[i]) o.cap = p.shots[i];
        return o;
      });
    }
    if (p.video && m.video) {
      out.video = { id: m.video.id, label: p.video };
    }
    if (p.ctrl && m.ctrl) {
      out.ctrl = m.ctrl.map(function (r, i) { return [r[0], p.ctrl[i] || r[1]]; });
    }
    return out;
  }

  // static text: data-i18n on the element, plus -title / -placeholder / -aria
  function applyStatic() {
    var all = document.querySelectorAll("[data-i18n],[data-i18n-title],[data-i18n-placeholder],[data-i18n-aria]");
    for (var i = 0; i < all.length; i++) {
      var e = all[i], k;
      if ((k = e.getAttribute("data-i18n")))             e.textContent = t(k);
      if ((k = e.getAttribute("data-i18n-title")))       e.title = t(k);
      if ((k = e.getAttribute("data-i18n-placeholder"))) e.placeholder = t(k);
      if ((k = e.getAttribute("data-i18n-aria")))        e.setAttribute("aria-label", t(k));
    }
    document.documentElement.lang = lang === "pt" ? "pt-BR" : lang === "zh" ? "zh-CN" : lang;
  }

  function apply() {
    applyStatic();
    paintSwitch();
    window.dispatchEvent(new CustomEvent("i18n", { detail: { lang: lang } }));
  }

  function load(code) {
    if (packs[code]) return Promise.resolve(packs[code]);
    return fetch("i18n/" + code + ".json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (p) {
        if (p && p.ui) packs[code] = p;
        return packs[code] || null;
      })
      .catch(function () { return null; });
  }

  function set(code, remember) {
    if (!byCode(code)) code = "en";
    return load(code).then(function (p) {
      if (!p) code = "en";            // the file is missing or broken: stay readable
      lang = code;
      if (remember !== false) { try { localStorage.setItem(KEY, code); } catch (e) {} }
      apply();
      return code;
    });
  }

  function pick() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved && byCode(saved)) return saved;
    var want = navigator.languages || [navigator.language || "en"];
    for (var i = 0; i < want.length; i++) {
      var c = String(want[i]).slice(0, 2).toLowerCase();
      if (byCode(c)) return c;
    }
    return "en";
  }

  // ── the flag in the title bar ──────────────────────────────────────────
  var host = null;

  function flagImg(l, w, h) {
    return '<img class="flag" alt="" width="' + w + '" height="' + h + '" ' +
           'src="https://flagcdn.com/' + l.flag + '.svg">';
  }

  function paintSwitch() {
    if (!host) return;
    var cur = byCode(lang) || LANGS[0];
    var h = [];
    h.push('<button type="button" class="lang-btn" aria-haspopup="listbox" aria-expanded="false" ' +
           'title="' + t("lang.label") + '">' + flagImg(cur, 18, 12) +
           '<span class="lang-code">' + cur.code + '</span><span class="lang-caret">▾</span></button>');
    h.push('<div class="lang-menu" role="listbox" hidden>');
    LANGS.forEach(function (l) {
      h.push('<button type="button" role="option" class="lang-opt' + (l.code === lang ? " on" : "") +
             '" data-lang="' + l.code + '" aria-selected="' + (l.code === lang) + '">' +
             flagImg(l, 20, 13) + '<span class="lang-name">' + l.name + '</span>' +
             '<span class="lang-code">' + l.code + '</span></button>');
    });
    h.push('</div>');
    host.innerHTML = h.join("");

    var btn = host.querySelector(".lang-btn");
    var menu = host.querySelector(".lang-menu");
    function open(on) {
      menu.hidden = !on;
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      host.classList.toggle("open", on);
    }
    btn.addEventListener("click", function (e) { e.stopPropagation(); open(menu.hidden); });
    menu.addEventListener("click", function (e) {
      var o = e.target.closest(".lang-opt");
      if (!o) return;
      e.stopPropagation();
      open(false);
      set(o.dataset.lang);
    });
    document.addEventListener("click", function () { if (!menu.hidden) open(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) open(false); });
    var imgs = host.querySelectorAll("img.flag");
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener("error", function () { this.style.visibility = "hidden"; });
    }
  }

  function mount(el) {
    host = el;
    paintSwitch();
  }

  // pick and apply before the first paint the scripts do; apply() also runs
  // once here so the static markup is right even when the language is English
  var ready = set(pick(), false);

  return { t: t, mod: mod, set: set, mount: mount, ready: ready,
           langs: LANGS, current: function () { return lang; } };
})();
