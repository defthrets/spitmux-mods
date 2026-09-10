// Matrix rain — amber, matched to the page ladder
(function () {
  const canvas = document.getElementById("matrix");
  const ctx = canvas.getContext("2d");

  const charset = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=<>?/[]{}|".split("");

  let cols, drops, fontSize, w, h;
  const INTENSITY = 0.22;

  /* The rain is decoration, and decoration should not cost a phone its
     battery. Two things it must never do:

       run at devicePixelRatio on a handset -- a DPR-3 screen means a canvas
       with nine times the pixels you can actually see, repainted forever

       run at all for somebody who has asked for less motion

     So the backing store is capped at 1.5x whatever the device claims, and on
     a narrow screen the whole thing bows out and leaves an empty canvas. The
     page is built to read against the plain background anyway -- the rain only
     ever sat behind it. */
  const REDUCED = window.matchMedia &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SMALL = window.matchMedia && window.matchMedia("(max-width: 820px)").matches;
  if (REDUCED || SMALL) return;

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  function resize() {
    w = canvas.width = window.innerWidth * DPR;
    h = canvas.height = window.innerHeight * DPR;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    fontSize = 16 * DPR;
    cols = Math.floor(w / fontSize);
    drops = Array(cols).fill(0).map(() => Math.random() * -50);
  }
  window.addEventListener("resize", resize);
  resize();

  let last = 0;
  function draw(t) {
    if (t - last < 60) {
      requestAnimationFrame(draw);
      return;
    }
    last = t;

    // dim fade
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(0, 0, w, h);

    ctx.font = fontSize + "px VT323, monospace";

    for (let i = 0; i < cols; i++) {
      if (Math.random() > INTENSITY && drops[i] < 0) continue;

      const ch = charset[(Math.random() * charset.length) | 0];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      // head — bright
      if (drops[i] > 0) {
        ctx.fillStyle = "rgba(255, 205, 145, 0.55)";
        ctx.fillText(ch, x, y);

        // trail glow
        ctx.fillStyle = "rgba(255, 148, 24, 0.36)";
        ctx.fillText(ch, x, y - fontSize);
        ctx.fillStyle = "rgba(191, 114, 36, 0.22)";
        ctx.fillText(ch, x, y - fontSize * 2);
        ctx.fillStyle = "rgba(96, 54, 20, 0.12)";
        ctx.fillText(ch, x, y - fontSize * 3);
      }

      drops[i]++;
      if (drops[i] * fontSize > h && Math.random() > 0.975) {
        drops[i] = Math.random() * -20;
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
