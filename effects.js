// Sound effects + Konami code + glitch helpers
(function () {
  // ---- Audio: keystroke clicks via WebAudio ----
  let actx = null;
  let soundOn = true;
  function ensure() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (actx && actx.state === "suspended") actx.resume();
    return actx;
  }
  window.spitmuxAudio = {
    click() {
      if (!soundOn) return;
      const a = ensure();
      if (!a) return;
      const t = a.currentTime;
      // short noise burst
      const buf = a.createBuffer(1, 256, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = a.createBufferSource();
      src.buffer = buf;
      const filt = a.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 1800 + Math.random() * 400;
      filt.Q.value = 0.9;
      const g = a.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(filt).connect(g).connect(a.destination);
      src.start(t);
      src.stop(t + 0.06);
    },
    beep(freq = 880, ms = 90) {
      if (!soundOn) return;
      const a = ensure();
      if (!a) return;
      const t = a.currentTime;
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(g).connect(a.destination);
      osc.start(t);
      osc.stop(t + ms / 1000);
    },
    toggle() { soundOn = !soundOn; return soundOn; },
    isOn() { return soundOn; },
  };

  // ---- Konami ----
  const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
  let idx = 0;
  window.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === seq[idx]) {
      idx++;
      if (idx === seq.length) {
        idx = 0;
        window.dispatchEvent(new CustomEvent("konami"));
      }
    } else {
      idx = (k === seq[0]) ? 1 : 0;
    }
  });

  // ---- glitch helpers ----
  // restricted to ASCII chars so width never shifts in monospace fonts
  const glitchChars = "@#%&$!?*/+=-_<>".split("");
  window.scrambleEl = function (el, ms = 600) {
    const txt = el.dataset.realText || el.textContent;
    el.dataset.realText = txt;
    const start = performance.now();
    function tick(now) {
      const t = (now - start) / ms;
      if (t >= 1) { el.textContent = txt; return; }
      let out = "";
      for (let i = 0; i < txt.length; i++) {
        const c = txt[i];
        // never substitute whitespace or newlines — preserves layout exactly
        if (i < txt.length * t)         out += c;
        else if (c === " " || c === "\n" || c === "\t") out += c;
        else                            out += glitchChars[(Math.random() * glitchChars.length) | 0];
      }
      el.textContent = out;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };

  // ---- crt flash helper ----
  window.crtFlash = function () {
    const f = document.querySelector(".flash");
    if (!f) return;
    f.classList.remove("go");
    void f.offsetWidth;
    f.classList.add("go");
  };

  // scoped flash that fires only inside the terminal frame
  window.crtFlashFrame = function () {
    const f = document.getElementById("frame-flash");
    if (!f) return;
    f.classList.remove("go");
    void f.offsetWidth;
    f.classList.add("go");
  };
})();
