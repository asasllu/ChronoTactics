// Effects for the interactive battlefield spots (js/interactives.js) and the techs
// they teach: Confuse (Crono), Masamune Gale (Frog), Dino Tail (Ayla), Magic Wall (Magus).
// Frames are letter rows like every other effect sheet; here they are laid out by
// small drawing helpers (lines, rings, stars, glyphs) when the file loads.
(function () {
  const P = {
    W: '#ffffff', Y: '#fff8c8', y: '#f8e070', o: '#f0a838', O: '#c86020', r: '#e83850', R: '#8c1838',
    c: '#d8f0ff', b: '#88b8f8', B: '#4c78d8', N: '#26398a', i: '#a8ecf4',
    p: '#d0b8f8', v: '#7048c0', V: '#2c1c68', m: '#c850b8',
    g: '#d0f8a8', G: '#58d060', s: '#d0d8f0', S: '#9098c8', d: '#4c5490',
    e: '#e0c8a0', E: '#a07850', k: '#4a3428', K: '#10060c',
  };

  // ---- Tiny raster helpers (letter grids) -------------------------------------------
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grid = (w, h) => ({ w, h, a: Array.from({ length: h }, () => new Array(w).fill('.')) });
  const px = (g, x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.a[y][x] = c;
  };
  const disk = (g, cx, cy, r, c, sq = 1) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + (y * y) / (sq * sq || 1) <= r * r && Math.abs(y) <= r * sq + 0.5) px(g, cx + x, cy + y, c);
  };
  const line = (g, x0, y0, x1, y1, c, t = 0) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      if (t) disk(g, x, y, t, c);
      else px(g, x, y, c);
    }
  };
  // A blade of light: coloured body with a white core.
  const streak = (g, x0, y0, x1, y1, body, core = 'W', t = 1) => {
    line(g, x0, y0, x1, y1, body, t);
    line(g, x0, y0, x1, y1, core, 0);
  };
  // Ellipse outline (iso ground ring when sq ~ 0.4), optionally dashed and phased.
  const ring = (g, cx, cy, r, c, sq = 0.4, dash = 0, phase = 0, from = 0, to = Math.PI * 2) => {
    const n = Math.max(24, Math.round(r * 7));
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      if (dash && Math.floor((i + phase) / dash) % 2) continue;
      px(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * sq, c);
    }
  };
  const star = (g, cx, cy, r, c, core = 'W') => {
    line(g, cx - r, cy, cx + r, cy, c);
    line(g, cx, cy - r, cx, cy + r, c);
    const d = Math.max(1, Math.round(r * 0.45));
    line(g, cx - d, cy - d, cx + d, cy + d, c);
    line(g, cx - d, cy + d, cx + d, cy - d, c);
    px(g, cx, cy, core);
  };
  const rays = (g, cx, cy, r0, r1, n, c, rot = 0, sq = 1) => {
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      line(g, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * sq, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * sq, c);
    }
  };
  const sparkles = (g, n, x0, y0, x1, y1, cols) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
      const c = cols[Math.floor(rnd() * cols.length)];
      px(g, x, y, c);
      if (rnd() < 0.3) {
        px(g, x - 1, y, c);
        px(g, x + 1, y, c);
        px(g, x, y - 1, c);
        px(g, x, y + 1, c);
      }
    }
  };
  const rowsOf = (g) => g.a.map((r) => r.join(''));
  // Builds an fx sheet from per-frame draw callbacks.
  const sheet = (key, o, frames) => {
    CT.fxSheet(key, {
      pal: P, w: o.w, h: o.h, anchor: o.anchor, layer: o.layer || 'front',
      impact: o.impact, shake: o.shake, shakeAt: o.shakeAt, flash: o.flash, flashAt: o.flashAt, loop: o.loop, arc: o.arc,
      frames: frames.map(([ms, draw], i) => {
        const g = grid(o.w, o.h);
        draw(g, i);
        return { ms, rows: rowsOf(g) };
      }),
    });
  };

  // ---- Confuse: four dizzying cuts, an X-burst, then stars circling the victim -------
  {
    const cx = 40, cy = 42;
    const cuts = [[16, 20, 64, 62], [64, 20, 16, 62], [10, 40, 70, 46], [37, 12, 43, 68]];
    const fr = [];
    cuts.forEach((cut, n) => fr.push([n === 0 ? 50 : 40, (g) => {
      for (let j = 0; j < n; j++) line(g, ...cuts[j], 'S');
      streak(g, ...cut, n % 2 ? 'c' : 'y', 'W', 1);
      star(g, cut[2], cut[3], 4, 'Y');
    }]));
    fr.push([70, (g) => {
      rays(g, cx, cy, 6, 30, 8, 'y', Math.PI / 8);
      rays(g, cx, cy, 4, 22, 8, 'W');
      ring(g, cx, cy, 18, 'Y', 0.6);
      disk(g, cx, cy, 5, 'W');
    }]);
    fr.push([70, (g) => {
      rays(g, cx, cy, 16, 34, 8, 'o', Math.PI / 8);
      ring(g, cx, cy, 26, 'y', 0.6, 3);
      ring(g, cx, cy, 20, 'c', 0.6, 2, 1);
      disk(g, cx, cy, 3, 'Y');
    }]);
    for (let k = 0; k < 6; k++) fr.push([80, (g) => {
      for (let s = 0; s < 4; s++) {
        const a = (k / 6) * Math.PI * 2 + (s * Math.PI) / 2;
        star(g, cx + Math.cos(a) * 15, 26 + Math.sin(a) * 5, s % 2 ? 2 : 3, ['y', 'c', 'Y', 'p'][s]);
      }
      if (k < 2) ring(g, cx, cy, 30 + k * 4, 'S', 0.6, 4);
    }]);
    sheet('fx_confuse', { w: 80, h: 72, anchor: [40, 62], impact: 4, shake: 5, shakeAt: 4, flash: '#fff8c8', flashAt: 4 }, fr);
  }

  // ---- Masamune Gale: crossed spirit blades over Frog, then tornadoes down the line ----
  {
    const fr = [];
    for (let k = 0; k < 6; k++) fr.push([k < 2 ? 70 : 90, (g) => {
      const grow = Math.min(1, (k + 1) / 3);
      const L = 34 * grow;
      const c0 = [48, 46];
      // Masa (blue) and Mune (gold): two great blades crossing.
      const bl = (dx, col) => {
        streak(g, c0[0] - dx * L, c0[1] - L, c0[0] + dx * L, c0[1] + L, col, 'W', 2);
        line(g, c0[0] + dx * L * 0.72 - 6, c0[1] + L * 0.72 + dx * 6 * 0, c0[0] + dx * L * 0.72 + 6, c0[1] + L * 0.72, 'y', 1);
      };
      if (k < 5) {
        bl(1, 'b');
        bl(-1, 'o');
        star(g, c0[0], c0[1], 6 + k * 2, 'Y');
      }
      ring(g, 48, 86, 22 + k * 5, k % 2 ? 'g' : 'c', 0.32, 3, k);
      ring(g, 48, 86, 14 + k * 4, 'W', 0.32, 2, k + 1);
      if (k > 1) sparkles(g, 14, 10, 10, 86, 80, ['c', 'g', 'W']);
    }]);
    sheet('fx_gale_glyph', { w: 96, h: 96, anchor: [48, 86], shake: 3, shakeAt: 2, flash: '#d8f0ff', flashAt: 2 }, fr);

    const tf = [];
    for (let k = 0; k < 7; k++) tf.push([60, (g) => {
      const levels = Math.min(10, 3 + k * 3);
      for (let j = 0; j < levels; j++) {
        const y = 62 - j * 6;
        const rx = 5 + j * 1.6 + (k === 6 ? -2 : 0);
        ring(g, 24 + Math.sin(j * 0.9 + k) * 2, y, rx, k > 4 ? 'S' : j % 3 ? 'c' : 'W', 0.35, 3, k * 2 + j);
        if (j % 2) ring(g, 24, y + 2, rx - 2, 'g', 0.35, 4, k + j);
      }
      if (k > 0 && k < 6) sparkles(g, 10, 4, 4, 44, 64, ['g', 'G', 'W']);
    }]);
    sheet('fx_masamune_gale', { w: 48, h: 72, anchor: [24, 64], impact: 2 }, tf);
  }

  // ---- Dino Tail: a huge tail sweep around Ayla, shockwaves where it lands --------------
  {
    const fr = [];
    for (let k = 0; k < 6; k++) fr.push([70, (g) => {
      const a0 = Math.PI * 0.95;
      const a1 = a0 - Math.min(1, (k + 1) / 4) * Math.PI * 1.9;
      for (let t = 0; t < 5; t++) ring(g, 56, 44, 40 + t, t < 2 ? 'o' : t < 4 ? 'y' : 'Y', 0.42, 0, 0, a1, a0);
      ring(g, 56, 44, 46, 'E', 0.42, 2, k, a1, a0);
      if (k >= 3) {
        ring(g, 56, 46, 30 + (k - 3) * 9, 'e', 0.4, 3, k);
        ring(g, 56, 46, 24 + (k - 3) * 9, 'E', 0.4, 2, k);
        sparkles(g, 18, 8, 24, 104, 62, ['E', 'e', 'k']);
      }
      if (k === 3) rays(g, 56, 44, 10, 30, 12, 'Y', 0, 0.45);
    }]);
    sheet('fx_dino_sweep', { w: 112, h: 64, anchor: [56, 46], shake: 7, shakeAt: 3, flash: '#f0a838', flashAt: 3 }, fr);

    const tf = [];
    for (let k = 0; k < 5; k++) tf.push([70, (g) => {
      ring(g, 24, 30, 6 + k * 4, k < 2 ? 'Y' : 'e', 0.45);
      ring(g, 24, 30, 3 + k * 4, 'E', 0.45, 2);
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2 + 0.4;
        const r = 4 + k * 5;
        disk(g, 24 + Math.cos(a) * r, 26 - k * 3 + Math.sin(a) * r * 0.4 + (k > 2 ? (k - 2) * 4 : 0), s % 2 ? 1 : 2, s % 3 ? 'E' : 'k');
      }
      if (k < 2) star(g, 24, 22, 7, 'y');
    }]);
    sheet('fx_dino_tail', { w: 48, h: 40, anchor: [24, 32], impact: 1 }, tf);
  }

  // ---- Magic Wall: a Zeal rune circle under Magus, ward panels on every ally ------------
  {
    const glyph = (g, cx, cy, s, c) => {
      // A small Zeal rune: a diamond with a cross-bar and a tail.
      line(g, cx, cy - s, cx + s, cy, c);
      line(g, cx + s, cy, cx, cy + s, c);
      line(g, cx, cy + s, cx - s, cy, c);
      line(g, cx - s, cy, cx, cy - s, c);
      line(g, cx - s + 1, cy, cx + s - 1, cy, c);
      px(g, cx, cy + s + 1, c);
    };
    const fr = [];
    for (let k = 0; k < 9; k++) fr.push([80, (g) => {
      const R = Math.min(52, 14 + k * 12);
      ring(g, 60, 64, R, 'p', 0.36);
      ring(g, 60, 64, R - 5, 'v', 0.36, 3, k);
      if (k >= 2) for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2 + k * 0.2;
        glyph(g, 60 + Math.cos(a) * (R - 2.5), 64 + Math.sin(a) * (R - 2.5) * 0.36, 2, s % 2 ? 'W' : 'p');
      }
      if (k >= 3 && k <= 7) {
        // Pillars of light rise from the circle.
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2 + 0.5;
          const x = 60 + Math.cos(a) * 40, y = 64 + Math.sin(a) * 40 * 0.36;
          const hgt = Math.min(48, (k - 2) * 12);
          line(g, x, y, x, y - hgt, s % 2 ? 'p' : 'c');
          px(g, x, y - hgt, 'W');
        }
        // The great ward-sigil above.
        const S = 10 + (k - 3) * 2;
        ring(g, 60, 22, S, 'p', 1);
        ring(g, 60, 22, S - 3, 'W', 1, 2, k);
        for (let t = 0; t < 2; t++) {
          const rot = t * Math.PI / 3 + k * 0.1;
          for (let s = 0; s < 3; s++) {
            const a = rot + (s / 3) * Math.PI * 2, b = rot + ((s + 1) / 3) * Math.PI * 2;
            line(g, 60 + Math.cos(a) * S, 22 + Math.sin(a) * S, 60 + Math.cos(b) * S, 22 + Math.sin(b) * S, t ? 'c' : 'p');
          }
        }
        glyph(g, 60, 22, 3, 'W');
      }
      if (k === 8) sparkles(g, 20, 10, 6, 110, 72, ['p', 'c', 'W']);
    }]);
    sheet('fx_magic_wall_circle', { w: 120, h: 80, anchor: [60, 64], layer: 'back', flash: '#d0b8f8', flashAt: 3, shake: 2, shakeAt: 3 }, fr);

    const tf = [];
    for (let k = 0; k < 6; k++) tf.push([70, (g) => {
      const top = 58 - Math.min(50, (k + 1) * 12);
      for (const x of [4, 36]) line(g, x, 54, x, top + 6, k > 4 ? 'S' : 'p');
      line(g, 4, top + 6, 20, top, 'p');
      line(g, 20, top, 36, top + 6, 'p');
      line(g, 4, 54, 20, 60, 'v');
      line(g, 20, 60, 36, 54, 'v');
      for (let y = top + 10; y < 54; y += 8) {
        line(g, 6, y + 2, 20, y - 2 + 6, (y + k * 4) % 16 < 8 ? 'c' : 'v');
        line(g, 20, y + 4, 34, y, (y + k * 4) % 16 < 8 ? 'v' : 'c');
      }
      if (k === 2) star(g, 20, top + 4, 5, 'W');
    }]);
    sheet('fx_magic_wall', { w: 40, h: 64, anchor: [20, 58], impact: 2 }, tf);
  }

  // ---- Spot effects -----------------------------------------------------------------------
  // Learning a tech: a column of light, a great star, expanding rings and rising motes.
  sheet('fx_ia_learn', { w: 96, h: 120, anchor: [48, 108], shake: 5, shakeAt: 3, flash: '#fff8c8', flashAt: 3 }, [
    [60, (g) => streak(g, 48, 0, 48, 40, 'Y', 'W', 1)],
    [60, (g) => streak(g, 48, 0, 48, 80, 'y', 'W', 2)],
    [60, (g) => { streak(g, 48, 0, 48, 106, 'y', 'W', 4); ring(g, 48, 106, 12, 'Y', 0.36); }],
    [90, (g) => {
      for (let x = 42; x <= 54; x++) line(g, x, 0, x, 104, x === 48 ? 'W' : Math.abs(x - 48) < 4 ? 'Y' : 'y');
      star(g, 48, 78, 30, 'Y');
      rays(g, 48, 78, 8, 26, 16, 'y', 0.2);
      ring(g, 48, 106, 26, 'Y', 0.36);
      disk(g, 48, 78, 6, 'W');
    }],
    [90, (g) => {
      for (let x = 45; x <= 51; x++) line(g, x, 0, x, 104, x === 48 ? 'W' : 'y');
      star(g, 48, 78, 24, 'y', 'Y');
      ring(g, 48, 78, 20, 'c', 1, 3);
      ring(g, 48, 106, 36, 'y', 0.36, 3);
      ring(g, 48, 106, 28, 'W', 0.36, 2, 1);
    }],
    ...[0, 1, 2, 3].map((k) => [90, (g) => {
      line(g, 48, 0, 48, 100 - k * 20, k < 2 ? 'Y' : 'S');
      ring(g, 48, 106, 40 + k * 2, k < 2 ? 'o' : 'S', 0.36, 3, k);
      ring(g, 48, 78, 24 + k * 6, 'c', 1, 4, k);
      sparkles(g, 26 - k * 4, 6, 10, 90, 100 - k * 10, ['Y', 'y', 'W', 'c']);
    }]),
  ]);
  // Dreamstone power-up: red flames lick up around the hero.
  sheet('fx_ia_power', { w: 48, h: 72, anchor: [24, 64], shake: 3, shakeAt: 1, flash: '#e83850', flashAt: 1 }, [0, 1, 2, 3, 4, 5, 6].map((k) => [70, (g) => {
    ring(g, 24, 62, 14 + (k % 3) * 2, k < 5 ? 'r' : 'R', 0.4);
    for (let s = 0; s < 7; s++) {
      const x = 6 + s * 6;
      const hgt = 18 + ((s * 7 + k * 5) % 13) * 2 - (k > 4 ? (k - 4) * 10 : 0);
      if (hgt <= 0) continue;
      line(g, x, 62, x + Math.sin(s + k) * 3, 62 - hgt, s % 2 ? 'r' : 'R');
      px(g, x + Math.sin(s + k) * 3, 62 - hgt, 'y');
    }
    sparkles(g, 10, 4, 4, 44, 60, ['r', 'y', 'W']);
  }]));
  // Springs, fonts and chests: a ripple and rising sparkles.
  sheet('fx_ia_spring', { w: 48, h: 64, anchor: [24, 56] }, [0, 1, 2, 3, 4, 5, 6].map((k) => [70, (g) => {
    ring(g, 24, 56, 4 + k * 3, k < 4 ? 'c' : 'b', 0.4);
    if (k > 1) ring(g, 24, 56, k * 3 - 2, 'W', 0.4, 2);
    for (let s = 0; s < 5; s++) {
      const x = 8 + s * 8, y = 52 - ((k * 7 + s * 11) % 40);
      star(g, x, y, s % 2 ? 1 : 2, s % 2 ? 'g' : 'c');
    }
  }]));
  // Kegs and crystals: a fireball per tile.
  sheet('fx_ia_blast', { w: 48, h: 56, anchor: [24, 48], impact: 1, shake: 6, shakeAt: 1 }, [
    [50, (g) => disk(g, 24, 38, 4, 'W')],
    [60, (g) => { disk(g, 24, 36, 10, 'y', 0.9); disk(g, 24, 36, 5, 'W'); rays(g, 24, 36, 10, 18, 8, 'Y'); }],
    [60, (g) => { disk(g, 24, 32, 14, 'o', 0.9); disk(g, 24, 32, 9, 'y'); disk(g, 24, 30, 4, 'Y'); rays(g, 24, 32, 15, 22, 10, 'o', 0.3); }],
    [70, (g) => { ring(g, 24, 44, 18, 'r', 0.4); disk(g, 24, 28, 13, 'r', 0.9); disk(g, 24, 26, 8, 'o'); disk(g, 24, 24, 3, 'y'); }],
    [80, (g) => { disk(g, 20, 22, 8, 'd'); disk(g, 30, 18, 7, 'S'); disk(g, 24, 28, 6, 'R'); }],
    [90, (g) => { disk(g, 18, 14, 6, 'S'); disk(g, 30, 10, 5, 'd'); }],
  ]);
  // Dust from boulders and levers.
  sheet('fx_ia_dust', { w: 40, h: 24, anchor: [20, 20] }, [0, 1, 2, 3].map((k) => [80, (g) => {
    for (let s = 0; s < 5; s++) disk(g, 6 + s * 7, 18 - k * 2 - (s % 2) * 3, 2 + k, k > 2 ? 'S' : s % 2 ? 'e' : 'E', 0.8);
  }]));
  // A rolling boulder (projectile).
  sheet('fx_ia_boulder', { w: 24, h: 24, anchor: [12, 20], loop: true }, [0, 1, 2, 3].map((k) => [60, (g) => {
    disk(g, 12, 12, 9, 'E');
    disk(g, 10, 9, 5, 'e');
    const a = (k / 4) * Math.PI;
    line(g, 12 - Math.cos(a) * 8, 12 - Math.sin(a) * 8, 12 + Math.cos(a) * 8, 12 + Math.sin(a) * 8, 'k');
    ring(g, 12, 12, 9, 'k', 1);
  }]));
  // The Atrium's lockdown shutter slamming down.
  sheet('fx_ia_shutter', { w: 56, h: 80, anchor: [28, 70], shake: 8, shakeAt: 4, flash: '#ffffff', flashAt: 4 }, [0, 1, 2, 3, 4, 5, 6].map((k) => [k < 4 ? 50 : 90, (g) => {
    const bottom = Math.min(70, 10 + k * 15);
    for (let x = 4; x <= 52; x += 6) line(g, x, 0, x, bottom, x % 12 === 4 ? 's' : 'S');
    for (let y = 4; y < bottom; y += 14) line(g, 4, y, 52, y, 'd');
    line(g, 2, bottom, 54, bottom, 'W');
    if (k >= 4) {
      rays(g, 28, 70, 4, 20 + (k - 4) * 6, 10, 'y', 0, 0.4);
      sparkles(g, 12, 2, 56, 54, 78, ['y', 'W', 'S']);
    }
  }]));

  // ---- Tech staging -------------------------------------------------------------------------
  CT.techFx('confuse', { anim: 'tech_spincut', fx: 'fx_confuse', charge: false });
  CT.techFx('masamune_gale', { anim: 'attack', casterFx: 'fx_gale_glyph', fx: 'fx_masamune_gale', stagger: 70, charge: false });
  CT.techFx('dino_tail', { anim: 'tech_tail_spin', casterFx: 'fx_dino_sweep', fx: 'fx_dino_tail', stagger: 40, charge: false });
  CT.techFx('magic_wall', { anim: 'cast', casterFx: 'fx_magic_wall_circle', fx: 'fx_magic_wall', stagger: 50 });
})();
