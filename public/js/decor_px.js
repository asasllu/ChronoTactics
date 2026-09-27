// Native-resolution decorations (see docs/ART_SPEC.md). Overrides CT.DECOR kinds.
//
// Every kind registered by terrain.js / terrain_ext.js is re-registered here with
// `native: true`: art is drawn 1:1 at the 480x300 logical resolution (iso tile 32x16,
// 8 px per level), and offsets (xOff yOff shadow light.radius light.dy light.dx) are in
// logical px. Gameplay fields (blocks, ladder, flat, variants) are copied from the old
// def so maps and rules keep working.
//
// Art is built on a letter Grid and painted by `paint()`: each letter maps to a palette
// ramp [shade, base, light] (or a flat hex for details), and the painter adds a 1px dark
// outline plus top-left-lit cel shading. All colours come from CT.PAL.RAMPS.
(function () {
  const CT = (window.CT = window.CT || {});
  const { Grid, canvas } = CT.PX;
  const R = CT.PAL.RAMPS;
  const OUT = R.ink[1];

  // ---- Helpers ---------------------------------------------------------------------
  // Three-tone ramp around R[name][i]: [darker, base, lighter].
  const r3 = (n, i) => [R[n][Math.max(0, i - 1)], R[n][i], R[n][Math.min(R[n].length - 1, i + 1)]];
  // Two-tone (no highlight) ramp.
  const r2 = (n, i) => [R[n][Math.max(0, i - 1)], R[n][i]];
  const hexRGB = CT.PAL.hex;
  let seedState = 1;
  const seed = (s) => (seedState = (s * 7919 + 104729) % 233280 || 1);
  const rnd = () => ((seedState = (seedState * 9301 + 49297) % 233280) / 233280);
  const hash = CT.TX ? CT.TX.hash : (x, y, s) => (Math.abs(Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453) % 1);

  // Paint a letter grid. mats[letter] = [shade, base, light] | [shade, base] | [base] |
  // '#hex' (flat detail: drawn as-is, doesn't split the region it sits in).
  // 'k' is the outline colour. opt.bare: letters that get no outline around them.
  // opt.ol: outline colour. Output is padded by 1 px on every side.
  function paint(g, mats, opt = {}) {
    const P = 1;
    const W = g.w + P * 2;
    const H = g.h + P * 2;
    const cv = canvas(W, H);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const bare = opt.bare || '';
    const ol = hexRGB(opt.ol || OUT);
    const at = (x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? '.' : g.a[y][x]);
    const flat = (c) => typeof mats[c] === 'string';
    const same = (x, y, c) => {
      const d = at(x, y);
      return d === c || (d !== '.' && d !== 'k' && flat(d));
    };
    const cache = {};
    const col = (h) => (cache[h] = cache[h] || hexRGB(h));
    const put = (x, y, rgb) => {
      const i = ((y + P) * W + (x + P)) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    };
    for (let y = -P; y < g.h + P; y++)
      for (let x = -P; x < g.w + P; x++) {
        const c = at(x, y);
        if (c === '.') {
          const n = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
          if (n.some((d) => d !== '.' && !bare.includes(d))) put(x, y, ol);
          continue;
        }
        if (c === 'k') {
          put(x, y, ol);
          continue;
        }
        const m = mats[c];
        if (m == null) {
          put(x, y, [255, 0, 255]);
          continue;
        }
        if (typeof m === 'string') {
          put(x, y, col(m));
          continue;
        }
        if (m.length === 1) {
          put(x, y, col(m[0]));
          continue;
        }
        const r1 = !same(x + 1, y, c) || !same(x, y + 1, c);
        const l1 = !same(x - 1, y, c) || !same(x, y - 1, c);
        let h = m[1];
        if (r1) h = m[0];
        else if (l1 && m[2]) h = m[2];
        put(x, y, col(h));
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  // Put one palette pixel on a 2D context.
  function dot(ctx, x, y, h) {
    ctx.fillStyle = h;
    ctx.fillRect(x, y, 1, 1);
  }
  const memo = (fn) => {
    const c = {};
    return (...a) => {
      const k = a.join(':');
      return c[k] || (c[k] = fn(...a));
    };
  };

  // Iso box on a grid: a 2:1 top diamond 2*hw wide and hw tall whose left half ends at
  // column cx-1, plus left/right side faces `depth` px tall.
  function isoBox(g, cx, top, hw, depth, lt, ll, lr) {
    const hh = hw >> 1;
    for (let r = 0; r < hh; r++) {
      const half = 2 * r + 2;
      g.rect(cx - half, top + r, cx + half - 1, top + r, lt);
      g.rect(cx - half, top + hw - 1 - r, cx + half - 1, top + hw - 1 - r, lt);
    }
    for (let x = cx - hw; x < cx + hw; x++) {
      const k = x < cx ? cx - 1 - x : x - cx;
      const yb = top + hw - 1 - (k >> 1);
      for (let y = yb + 1; y <= yb + depth; y++) g.px(x, y, x < cx ? ll : lr);
    }
  }
  // y of the bottom edge of an isoBox top at column x (for drawing on side faces).
  const isoEdge = (cx, top, hw, x) => top + hw - 1 - ((x < cx ? cx - 1 - x : x - cx) >> 1);

  // Flame: bottom centre (cx, by), height h, half-width w, animation frame f.
  function flame(ctx, cx, by, h, w, f, ph = 0) {
    const shape = (k, colr) => {
      for (let y = 0; y < h * k; y++) {
        const t = y / Math.max(1, h * k - 1);
        const hw = w * k * (t < 0.3 ? 0.75 + t * 0.8 : (1 - t) / 0.7) * (0.85 + 0.15 * Math.sin(f * 1.7 + y + ph));
        const sway = Math.sin(f * 1.05 + ph + t * 2.5) * t * 1.6;
        const x0 = Math.round(cx + sway - hw);
        const x1 = Math.round(cx + sway + hw);
        if (x1 < x0) continue;
        ctx.fillStyle = colr;
        ctx.fillRect(x0, by - y, x1 - x0 + 1, 1);
      }
    };
    shape(1, R.red[3]);
    shape(0.82, R.gold[1]);
    shape(0.6, R.gold[2]);
    shape(0.34, R.gold[4]);
  }

  // Tiny 3x5 font for placards.
  const FONT = {
    A: '010101111101101', C: '011100100100011', E: '111100110100111', G: '011100101101011', J: '001001001101010',
    L: '100100100100111', N: '101111111111101', O: '010101101101010', R: '110101110101101', S: '011100010001110',
    U: '101101101101111', Y: '101101010010010', ' ': '000000000000000',
  };
  function text3(g, x, y, str, c) {
    for (const ch of str) {
      const f = FONT[ch] || FONT[' '];
      for (let i = 0; i < 15; i++) if (f[i] === '1') g.px(x + (i % 3), y + Math.floor(i / 3), c);
      x += 4;
    }
  }

  // ---- Registration ----------------------------------------------------------------
  const KEEP = ['blocks', 'ladder', 'flat', 'variants'];
  const done = new Set();
  function redo(kind, def) {
    const old = CT.DECOR[kind] || {};
    const d = { native: true, ...def };
    for (const k of KEEP) if (k in old) d[k] = old[k];
    CT.registerDecor(kind, d);
    done.add(kind);
  }

  // Shared materials.
  const LEAF = r3('green', 3);
  const LEAF_L = r3('green', 4);
  const LEAF_D = r2('green', 2);
  const BARK = r3('wood', 2);
  const WOOD = r3('wood', 3);
  const WOOD_L = r3('wood', 4);
  const WOOD_D = r3('wood', 2);
  const IRON = r3('slate', 1);
  const GOLD = r3('gold', 2);
  const STONE = r3('slate', 2);
  const STONE_L = r3('slate', 3);
  const STONE_D = r3('slate', 1);
  const MARBLE = r3('slate', 4);
  const SNOW = [R.slate[4], R.slate[5], R.white[0]];

  // ==================================================================================
  // Trees & plants
  // ==================================================================================
  redo('tree', {
    shadow: [10, 4], yOff: 2,
    build(v) {
      const g = new Grid(26, 34);
      seed(v + 3);
      g.rect(11, 20, 14, 33, 't');
      g.rect(9, 31, 16, 33, 't');
      g.px(8, 33, 't');
      g.px(17, 33, 't');
      g.line(12, 24, 7, 18, 't', 2);
      g.line(13, 23, 18, 17, 't', 2);
      const cy = v === 1 ? 12 : 13;
      const rx = v === 2 ? 12 : 11;
      g.ell(13, cy, rx, 9, 'a');
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rnd() * 0.5;
        g.ell(13 + Math.cos(a) * (rx - 2), cy + Math.sin(a) * 7, 3 + rnd() * 1.6, 2.6 + rnd() * 1.2, 'a');
      }
      // Shadowed lower clumps, lit upper clumps.
      g.ell(18, cy + 6, 5, 3, 'd');
      g.ell(9, cy + 7, 4, 2.5, 'd');
      g.ell(14, cy + 8, 3, 2, 'd');
      g.ell(9, cy - 3, 5, 4, 'b');
      g.ell(15, cy - 5, 4, 3, 'b');
      g.ell(5, cy + 2, 2.5, 2, 'b');
      g.ell(19, cy - 1, 3, 2.5, 'b');
      for (let i = 0; i < 10; i++) {
        const x = 5 + rnd() * 16;
        const y = cy - 7 + rnd() * 12;
        if (g.a[Math.round(y)] && 'ab'.includes(g.a[Math.round(y)][Math.round(x)])) g.px(x, y, 'L');
      }
      for (let i = 0; i < 6; i++) {
        const x = 8 + rnd() * 12;
        const y = cy + 3 + rnd() * 5;
        if (g.a[Math.round(y)] && g.a[Math.round(y)][Math.round(x)] === 'a') g.px(x, y, 'o');
      }
      if (v === 2) for (const [x, y] of [[8, 9], [17, 6], [12, 15], [20, 13], [6, 14]]) g.px(x, y, 'F');
      return paint(g, { t: BARK, a: LEAF, b: LEAF_L, d: LEAF_D, L: R.green[5], o: R.green[1], F: R.red[3] });
    },
  });

  redo('rock', {
    shadow: [7, 3], yOff: 2,
    build() {
      const g = new Grid(16, 11);
      g.ell(8, 6, 7, 4.3, 'r');
      g.ell(11, 7, 4, 3, 's');
      g.ell(6, 4, 4, 2.5, 'q');
      g.px(5, 3, 'L');
      g.px(4, 4, 'L');
      g.line(9, 5, 10, 8, 'c');
      return paint(g, { r: STONE, q: STONE_L, s: STONE_D, L: R.slate[5], c: R.slate[0] });
    },
  });

  function pineGrid(v, snowy) {
    const g = new Grid(19, 38);
    seed(v * 5 + (snowy ? 11 : 1));
    g.rect(8, 30, 10, 37, 't');
    g.rect(7, 36, 11, 37, 't');
    const tiers = 4;
    const tops = [];
    // Bottom tier first so upper tiers overlap it.
    for (let i = tiers - 1; i >= 0; i--) {
      const top = 1 + i * 7;
      const base = top + 11 + (i === tiers - 1 ? 1 : 0);
      const hw = 3.5 + i * 1.9 + (v ? 0.6 : 0);
      const L = i % 2 ? 'b' : 'a';
      g.tri(9 - hw, base, 9 + hw + 1, base, 9.5, top, L);
      // Saw-tooth hem.
      for (let x = Math.round(9 - hw); x <= Math.round(9 + hw); x += 2) g.px(x, base + 1, L);
      tops.push([top, base, hw, L]);
    }
    // Shadow under each tier's hem.
    for (let y = 1; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const c = g.a[y][x];
        const u = g.a[y - 1][x];
        if ((c === 'a' || c === 'b') && (u === 'a' || u === 'b') && u !== c) g.px(x, y, 'd');
      }
    if (snowy) {
      // Snow settles on every exposed upper surface (2 px deep) and on the hems.
      const src = g.a.map((r) => r.slice());
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          const c = src[y][x];
          if (c !== 'a' && c !== 'b') continue;
          const up = y > 0 ? src[y - 1][x] : '.';
          const up2 = y > 1 ? src[y - 2][x] : '.';
          if (up === '.' || (up2 === '.' && rnd() > 0.3) || up === 'd') g.px(x, y, 'w');
        }
      for (const [top] of tops) g.rect(9, top, 10, top + 2, 'w');
    } else {
      for (const [top, , hw] of tops) {
        g.px(9 - hw * 0.5, top + 5, 'L');
        g.px(9 - hw * 0.3, top + 3, 'L');
      }
    }
    return g;
  }
  redo('pine', {
    shadow: [8, 3], yOff: 2,
    build: (v) => paint(pineGrid(v, false), { t: BARK, a: r3('green', 2), b: [R.green[1], R.teal[0], R.green[2]], d: R.green[0], L: R.green[4] }),
  });
  redo('snow_pine', {
    shadow: [8, 3], yOff: 2,
    build: (v) => paint(pineGrid(v, true), { t: BARK, a: [R.green[0], R.teal[0], R.teal[1]], b: [R.green[0], R.green[1], R.teal[0]], d: R.ink[2], w: SNOW }),
  });

  redo('bush', {
    shadow: [7, 3], yOff: 2,
    build(v) {
      const g = new Grid(17, 11);
      g.ell(8, 7, 7.5, 3.5, 'a');
      g.ell(5, 5, 4, 3, 'b');
      g.ell(11, 4, 4, 3, 'c');
      g.ell(8, 3, 3, 2, 'b');
      for (let i = 0; i < 6; i++) g.px(2 + hash(i, v, 3) * 13, 2 + hash(i, v, 4) * 6, v ? 'F' : 'G');
      return paint(g, { a: LEAF_D.concat(R.green[3]), b: LEAF, c: r3('green', 3), F: R.pink[3], G: R.gold[3] });
    },
  });

  redo('fern', {
    yOff: 2,
    build(v) {
      const g = new Grid(28, 20);
      const n = v ? 7 : 6;
      for (let f = 0; f < n; f++) {
        const ang = Math.PI * (1.06 + (f / (n - 1)) * 0.88);
        const len = 11 + hash(f, v, 5) * 3 - Math.abs(f - (n - 1) / 2) * 0.7;
        const L = 'abc'[f % 3];
        let px0 = 14;
        let py0 = 19;
        for (let s = 1; s <= len; s++) {
          const t = s / len;
          const x = 14 + Math.cos(ang) * s * 1.05;
          const y = 19 + Math.sin(ang) * s * 1.35 + t * t * 6;
          g.line(px0, py0, x, y, L, s < len * 0.6 ? 2 : 1);
          if (s > 2 && s < len - 1 && s % 2 === 1) {
            const side = Math.cos(ang) < 0 ? -1 : 1;
            g.px(x + side * 0.5, y - 1.5, L);
            g.px(x - side * 0.5, y + 1.5, L);
          }
          px0 = x;
          py0 = y;
        }
      }
      return paint(g, { a: r3('green', 3), b: r3('green', 4), c: r2('green', 3) });
    },
  });

  redo('flowers', {
    build(v) {
      const cols = [[R.white[0], R.gold[3]], [R.pink[2], R.pink[3]], [R.blue[5], R.gold[3]]][v];
      return canvas(24, 12, (g) => {
        for (let i = 0; i < 9; i++) {
          const x = 3 + Math.floor(hash(i, v, 11) * 18);
          const y = 2 + Math.floor(hash(i, v, 12) * 8);
          if (Math.abs(x - 12) / 12 + Math.abs(y - 6) / 6 > 0.95) continue;
          dot(g, x, y + 1, R.green[1]);
          const c = cols[i % 2];
          dot(g, x - 1, y, c);
          dot(g, x + 1, y, c);
          dot(g, x, y - 1, c);
          dot(g, x, y, i % 2 ? R.gold[2] : R.white[0]);
        }
      });
    },
  });

  // ==================================================================================
  // Leene Square
  // ==================================================================================
  const TENTS = [
    [r3('red', 3), [R.skin[3], R.skin[4], R.skin[5]]],
    [r3('blue', 3), [R.skin[3], R.skin[4], R.skin[5]]],
    [r3('green', 3), r3('gold', 3)],
    [r3('purple', 3), r3('gold', 2)],
  ];
  redo('tent', {
    shadow: [15, 5], yOff: 3,
    build(v) {
      const g = new Grid(31, 32);
      const ax = 15;
      const ay = 4;
      const tone = (x, y) => (x < ax - 7 - (y - ay) * 0.25 ? 0 : x > ax + 4 + (y - ay) * 0.2 ? 2 : 1);
      const L = ['efg', 'hij'];
      // Walls: vertical stripes.
      for (let y = 17; y <= 31; y++)
        for (let x = 3; x <= 27; x++) g.px(x, y, L[Math.floor((x - 3) / 3) % 2][x < 7 ? 0 : x > 20 ? 2 : 1]);
      // Door opening + tied-back flaps.
      for (let y = 19; y <= 31; y++) {
        const w = Math.round((y - 19) * 0.38);
        g.rect(ax - w, y, ax + w, y, 'o');
        g.px(ax - w - 1, y, 'p');
        g.px(ax + w + 1, y, 'p');
      }
      // Roof: stripes fanning out from the apex.
      for (let y = ay; y <= 17; y++) {
        const hw = ((y - ay) / (17 - ay)) * 15 + 0.5;
        for (let x = Math.round(ax - hw); x <= Math.round(ax + hw); x++) {
          const ang = Math.atan2(x - ax, y - ay + 0.5);
          g.px(x, y, L[(Math.floor(ang * 4.2 + 10) % 2)][tone(x, y)]);
        }
      }
      // Scalloped valance.
      for (let i = 0; i < 8; i++) {
        const x = 1 + i * 4;
        g.rect(x, 17, x + 3, 18, L[i % 2][i < 2 ? 0 : i > 5 ? 2 : 1]);
        g.rect(x + 1, 19, x + 2, 19, L[i % 2][i < 2 ? 0 : i > 5 ? 2 : 1]);
      }
      // Pole, pennant and apex ball.
      g.rect(ax, 0, ax, ay, 'q');
      g.text(ax + 1, 0, ['yyy', 'yy.', 'y..']);
      g.px(ax, ay, 'y');
      const [A, B] = TENTS[v];
      return paint(g, {
        e: [A[2]], f: [A[1]], g: [A[0]], h: [B[2]], i: [B[1]], j: [B[0]],
        o: [R.ink[1]], p: [B[0]], q: [R.wood[2]], y: GOLD,
      });
    },
  });

  redo('bell_tower', {
    shadow: [16, 6], yOff: 4,
    light: { color: '255,200,120', radius: 26, dy: 36, flicker: true },
    build() {
      const g = new Grid(32, 98);
      // Spire roof (lit left half, shaded right half) with shingle courses.
      g.tri(2, 23, 16, 23, 15.5, 3, 'r');
      g.tri(16, 23, 30, 23, 16, 3, 'R');
      for (let y = 7; y < 23; y += 4)
        for (let x = 0; x < 32; x++) if (g.a[y][x] === 'r' || g.a[y][x] === 'R') g.px(x, y, 'n');
      g.rect(15, 0, 16, 3, 'g');
      g.px(14, 1, 'g');
      g.px(17, 1, 'g');
      // Dormer with a lit window.
      g.rect(13, 14, 18, 20, 'q');
      g.rect(14, 16, 17, 19, 'o');
      g.rect(15, 17, 16, 19, 'y');
      // Eaves.
      g.rect(1, 23, 30, 25, 'q');
      // Belfry.
      g.rect(3, 26, 28, 44, 's');
      g.rect(24, 26, 28, 44, 'S');
      g.rect(8, 31, 23, 44, 'o');
      g.ell(15.5, 31, 7.5, 3.5, 'o');
      // Bell.
      g.rect(14, 29, 17, 31, 'B');
      g.ell(15.5, 34, 4, 3.5, 'B');
      g.rect(11, 34, 20, 39, 'B');
      g.rect(10, 39, 21, 41, 'B');
      g.rect(15, 42, 16, 42, 'C');
      g.line(12, 37, 19, 37, 'e');
      // Cornice.
      g.rect(1, 44, 30, 47, 'q');
      g.rect(1, 47, 30, 47, 'm');
      // Shaft with 4 px brick courses.
      g.rect(4, 48, 27, 88, 's');
      g.rect(22, 48, 27, 88, 'S');
      for (let y = 51; y < 88; y += 4) {
        g.rect(4, y, 27, y, 'm');
        const off = (y / 4) % 2 ? 0 : 3;
        for (let x = 5 + off; x < 27; x += 6) g.rect(x, y + 1, x, y + 3, 'm');
      }
      // Arched window with warm light, and the door.
      g.rect(13, 58, 18, 66, 'o');
      g.ell(15.5, 58, 2.5, 2, 'o');
      g.rect(14, 62, 17, 66, 'y');
      g.rect(11, 76, 20, 88, 'o');
      g.ell(15.5, 76, 4.5, 3.5, 'o');
      g.rect(15, 78, 16, 88, 'd');
      // Step and plinth.
      g.rect(2, 88, 29, 90, 'q');
      g.rect(0, 91, 31, 97, 'p');
      g.rect(0, 94, 31, 94, 'm');
      return paint(g, {
        r: r3('blue', 3), R: r2('blue', 2), n: R.blue[1], g: GOLD, q: MARBLE, s: r3('slate', 3), S: r2('slate', 2),
        o: [R.ink[1]], y: [R.gold[3]], B: r3('gold', 2), C: R.gold[0], e: R.gold[4], m: R.slate[1], d: R.ink[0], p: STONE_L,
      });
    },
  });

  redo('lantern', {
    shadow: [4, 2], yOff: 2,
    light: { color: '255,180,100', radius: 46, flicker: true, dy: 10, dx: 3 },
    build(v) {
      const g = new Grid(13, 27);
      g.rect(5, 4, 6, 24, 'p');
      g.rect(3, 23, 8, 26, 'b');
      g.rect(5, 12, 6, 12, 'c');
      g.line(5, 3, 10, 3, 'p');
      g.px(10, 4, 'p');
      // Paper lantern.
      g.rect(8, 5, 12, 5, 'c');
      g.ell(10, 9, 2.5, 3, 'L');
      g.rect(8, 7, 12, 11, 'L');
      g.rect(8, 13, 12, 13, 'c');
      g.rect(8, 9, 12, 9, 'r');
      g.px(9, 7, 'H');
      g.px(10, 14, 'c');
      return paint(g, { p: IRON, b: STONE_D, c: [R.ink[2]], L: v ? r3('gold', 3) : r3('red', 4).map((c, i) => (i === 2 ? R.gold[3] : c)), r: v ? R.gold[1] : R.red[2], H: R.gold[4] });
    },
  });

  const fountainBase = memo(() => {
    const g = new Grid(32, 23);
    g.ell(16, 14, 15, 6, 's');
    g.rect(1, 14, 31, 19, 't');
    g.ell(16, 19, 15, 3.5, 't');
    for (let x = 3; x < 30; x += 5) g.rect(x, 16, x, 20, 'm');
    g.ell(16, 13, 12, 4, 'w');
    g.rect(14, 5, 17, 13, 'u');
    g.ell(16, 6, 6, 2, 'q');
    g.ell(16, 5, 4, 1, 'w');
    g.rect(15, 1, 16, 4, 'u');
    g.ell(15.5, 1, 1.5, 1, 'q');
    return paint(g, { s: MARBLE, t: STONE_L, m: R.slate[2], u: STONE_L, q: MARBLE, w: [R.blue[3], R.blue[4], R.blue[5]] });
  });
  const fountainFrames = memo((f) =>
    canvas(34, 25, (g) => {
      g.drawImage(fountainBase(), 0, 0);
      // Ripple rings in the basin.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + f * 0.45;
        const r = 3 + ((f + i) % 6) * 1.6;
        dot(g, Math.round(17 + Math.cos(a) * r), Math.round(14 + Math.sin(a) * r * 0.33), i % 3 ? R.blue[5] : R.blue[6]);
      }
      // Spout arcs.
      for (let s = 0; s < 4; s++) {
        const k = (f / 6 + s / 4) % 1;
        for (const dir of [-1, 1]) {
          const x = 16.5 + dir * (1 + k * 7);
          const y = 2 + (k * 2 - 0.4) * (k * 2 - 0.4) * 3 + k * 4;
          dot(g, Math.round(x), Math.round(y), s % 2 ? R.blue[6] : R.white[0]);
        }
      }
      dot(g, 16, 1 + (f % 2), R.white[0]);
    })
  );
  redo('fountain', {
    shadow: [16, 6], yOff: 3,
    build: () => fountainFrames(0),
    animate: (img, now) => fountainFrames(Math.floor(now / 140) % 6),
  });

  redo('table', {
    shadow: [10, 4], yOff: 3,
    build(v) {
      const g = new Grid(22, 17);
      g.rect(2, 9, 3, 16, 'l');
      g.rect(18, 9, 19, 16, 'l');
      g.rect(10, 12, 11, 16, 'l');
      isoBox(g, 11, 3, 10, 2, 'a', 'b', 'c');
      if (v === 0) {
        g.rect(6, 1, 8, 6, 'j');
        g.px(6, 0, 'j');
        g.px(9, 3, 'j');
        g.ell(13, 7, 3, 1, 'f');
        g.rect(12, 6, 14, 6, 'F');
      } else {
        g.rect(5, 2, 6, 7, 'm');
        g.px(5, 1, 'm');
        g.rect(8, 3, 9, 7, 'u');
        g.px(8, 2, 'u');
        g.ell(14, 7, 3, 1, 'f');
      }
      return paint(g, { l: WOOD_D, a: WOOD_L, b: WOOD, c: WOOD_D, j: MARBLE, m: r3('red', 2), u: r3('green', 2), f: r3('wood', 4), F: R.red[3] });
    },
  });

  redo('crate', {
    shadow: [8, 3], yOff: 3,
    build(v) {
      const g = new Grid(16, 17);
      isoBox(g, 8, 0, 8, 9, 'a', 'b', 'c');
      // Plank seams and frames on the faces.
      for (let x = 0; x < 16; x++) {
        const e = isoEdge(8, 0, 8, x);
        g.px(x, e + 5, x < 8 ? 'd' : 'e');
        g.px(x, e + 1, x < 8 ? 'd' : 'e');
        g.px(x, e + 9, x < 8 ? 'd' : 'e');
      }
      for (let y = 0; y < 17; y++) {
        if (g.a[y][0] !== '.') g.px(0, y, 'd');
        if (g.a[y][7] !== '.' && y > 7) g.px(7, y, 'd');
        if (g.a[y][8] !== '.' && y > 7) g.px(8, y, 'e');
        if (g.a[y][15] !== '.') g.px(15, y, 'e');
      }
      g.line(6, 5, 10, 3, 'd');
      if (v) g.text(3, 10, ['.x.', 'xxx', '.x.']);
      return paint(g, { a: WOOD_L, b: WOOD, c: WOOD_D, d: R.wood[1], e: R.wood[0], x: R.red[2] });
    },
  });

  redo('barrel', {
    shadow: [6, 3], yOff: 2,
    build() {
      const g = new Grid(13, 16);
      for (let y = 2; y <= 15; y++) {
        const t = (y - 2) / 13;
        const hw = 5 + Math.sin(t * Math.PI) * 1.2;
        for (let x = Math.round(6 - hw); x <= Math.round(6 + hw); x++) g.px(x, y, x > 8 ? 'A' : 'a');
      }
      for (const y of [4, 12]) for (let x = 0; x < 13; x++) if (g.a[y][x] !== '.') g.px(x, y, x > 8 ? 'H' : 'h');
      for (let y = 5; y < 15; y++) for (const x of [3, 6]) if (g.a[y][x] === 'a') g.px(x, y, 's');
      g.ell(6, 2, 5, 1.6, 'c');
      g.ell(6, 2, 3.5, 0.8, 'd');
      return paint(g, { a: WOOD, A: r2('wood', 2), s: R.wood[2], h: r3('slate', 2), H: [R.slate[1]], c: WOOD_L, d: [R.wood[2]] });
    },
  });

  // Torch: base art plus a looping flame on top.
  const torchBase = (v) => {
    const g = new Grid(10, 22);
    if (v === 0) {
      g.rect(4, 7, 5, 20, 'p');
      g.line(4, 18, 1, 21, 'p');
      g.line(5, 18, 8, 21, 'p');
      g.rect(4, 19, 5, 21, 'p');
      g.rect(1, 3, 8, 4, 'c');
      g.rect(2, 5, 7, 5, 'b');
      g.rect(3, 6, 6, 6, 'b');
    } else {
      g.rect(4, 5, 5, 21, 'w');
      g.rect(3, 3, 6, 7, 'r');
      g.rect(3, 5, 6, 5, 'R');
      g.rect(3, 20, 6, 21, 's');
    }
    g.px(3, 2, 'e');
    g.px(6, 2, 'e');
    return paint(g, { p: IRON, b: [R.slate[1]], c: r3('slate', 2), w: WOOD, r: r3('stone', 3), R: R.stone[1], s: STONE, e: R.gold[1] });
  };
  const torchFrames = memo((v, f) => {
    const base = torchBase(v);
    return canvas(base.width, base.height + 9, (g) => {
      g.drawImage(base, 0, 9);
      flame(g, 5.5, 12, 11, 2.6, f, v);
    });
  });
  redo('torch', {
    shadow: [4, 2], yOff: 2,
    light: { color: '255,160,70', radius: 42, flicker: true, dy: 7 },
    build: (v) => torchFrames(v, 0),
    animate: (img, now, d) => torchFrames(d.variant || 0, Math.floor(now / 110 + (d.x || 0) * 3 + (d.y || 0)) % 6),
  });

  // ==================================================================================
  // Castle
  // ==================================================================================
  redo('throne', {
    shadow: [9, 3], yOff: -1,
    build() {
      const g = new Grid(21, 33);
      // Tall gilded back with a velvet panel.
      g.rect(3, 4, 17, 24, 'g');
      g.ell(10, 5, 7, 3, 'g');
      g.tri(7, 2, 14, 2, 10.5, -2, 'g');
      g.rect(5, 6, 15, 23, 'r');
      g.ell(10, 7, 5, 2, 'r');
      g.px(10, 1, 'j');
      g.text(8, 9, ['..y..', '.yyy.', 'y.y.y', '..y..', '.y.y.']);
      // Seat, arms, legs.
      g.rect(1, 20, 19, 22, 'a');
      g.rect(2, 23, 18, 28, 'c');
      g.rect(4, 23, 16, 24, 'r');
      g.rect(1, 17, 3, 22, 'a');
      g.rect(17, 17, 19, 22, 'a');
      g.rect(2, 28, 4, 32, 'g');
      g.rect(16, 28, 18, 32, 'g');
      g.rect(9, 29, 11, 31, 'g');
      return paint(g, { g: r3('gold', 2), a: r3('gold', 1), r: r3('red', 2), c: r2('red', 1), j: R.blue[5], y: R.gold[3] });
    },
  });

  redo('banner', {
    shadow: [4, 2], yOff: 2,
    build(v) {
      const g = new Grid(13, 37);
      g.rect(6, 2, 6, 36, 'p');
      g.rect(4, 33, 8, 36, 'p');
      g.ell(6, 1, 1.2, 1.2, 'g');
      g.rect(1, 4, 11, 4, 'p');
      g.rect(2, 5, 10, 21, 'b');
      for (let y = 22; y <= 25; y++) {
        g.rect(2, y, 6 - (y - 21), y, 'b');
        g.rect(6 + (y - 21), y, 10, y, 'b');
      }
      g.rect(2, 5, 10, 6, 'e');
      g.rect(2, 7, 2, 21, 'e');
      g.rect(10, 7, 10, 21, 'e');
      g.text(4, 10, ['..y..', '.yyy.', 'yy.yy', '.yyy.', '..y..']);
      g.text(4, 17, ['y.y.y']);
      return paint(g, { p: WOOD_D, g: GOLD, b: v ? r3('blue', 2) : r3('red', 2), e: R.gold[2], y: R.gold[3] });
    },
  });

  redo('pillar', {
    shadow: [7, 3], yOff: 2,
    build(v) {
      if (v === 2) {
        // Gallery column: seamless white ceramic, blue seams.
        const g = new Grid(13, 50);
        g.rect(0, 45, 12, 49, 'b');
        g.rect(2, 4, 10, 45, 's');
        g.rect(2, 4, 3, 45, 'l');
        g.rect(9, 4, 10, 45, 'd');
        for (let y = 12; y < 45; y += 10) g.rect(2, y, 10, y, 'f');
        g.rect(6, 4, 6, 45, 'f');
        g.rect(0, 0, 12, 4, 'b');
        return paint(g, { b: [R.slate[3], R.slate[5], R.white[0]], s: [R.slate[5]], l: [R.white[0]], d: [R.slate[4]], f: R.blue[5] });
      }
      const g = new Grid(15, 44);
      g.rect(0, 39, 14, 43, 'b');
      g.rect(1, 36, 13, 38, 'c');
      // Fluted shaft with cylinder shading.
      for (let x = 2; x <= 12; x++) g.rect(x, 7, x, 35, x <= 3 ? 'l' : x >= 10 ? 'd' : x >= 8 ? 'm' : 's');
      for (const x of [4, 7, 10]) g.rect(x, 8, x, 34, 'f');
      g.rect(1, 4, 13, 6, 'c');
      g.rect(0, 0, 14, 3, 'b');
      if (v === 1) {
        g.rect(2, 13, 12, 14, 'G');
        g.rect(2, 28, 12, 29, 'G');
      }
      return paint(g, {
        b: STONE_L, c: STONE, l: [R.slate[4]], s: [R.slate[3]], m: [R.slate[2]], d: [R.slate[1]], f: R.slate[1], G: r3('gold', 2),
      });
    },
  });

  redo('cairn', {
    shadow: [8, 3], yOff: 2,
    build() {
      const g = new Grid(17, 21);
      g.ell(8, 17, 7.5, 2.8, 'a');
      g.ell(8, 14, 6, 2.5, 'b');
      g.ell(9, 11, 5, 2.2, 'a');
      g.ell(8, 9, 3.5, 1.8, 'c');
      // Rusted helm with a crest spike.
      g.ell(8, 5, 4, 3.5, 'h');
      g.rect(4, 5, 12, 7, 'h');
      g.rect(5, 5, 11, 5, 'e');
      g.px(6, 6, 'k');
      g.px(10, 6, 'k');
      g.rect(8, 0, 8, 2, 'r');
      g.px(4, 8, 'm');
      g.px(13, 16, 'm');
      g.px(12, 16, 'm');
      return paint(g, { a: STONE, b: STONE_L, c: STONE_D, h: r3('wood', 3), e: R.wood[1], r: r3('wood', 4), m: R.green[3] });
    },
  });

  // Waterfall: falling streaks + foam over a drop of `variant` levels (8 px each).
  const fallFrames = memo((v, f) => {
    const drop = Math.max(1, v);
    const H = drop * 8 + 12;
    return canvas(17, H, (g) => {
      const C = [R.blue[3], R.blue[4], R.blue[5], R.blue[6], R.white[0]];
      for (let y = 0; y < H - 4; y++) {
        const t = y / (H - 4);
        const hw = 4 + t * 2.5;
        for (let x = Math.floor(8.5 - hw); x <= Math.ceil(8.5 + hw); x++) {
          const e = hw - Math.abs(x + 0.5 - 8.5);
          if (e < 0) continue;
          const k = (y - f * 3 + Math.floor(hash(x, 0, 3) * 12) + 60) % 9;
          let c = k < 1 ? 4 : k < 3 ? 3 : k < 6 ? 2 : 1;
          if (e < 1) {
            if ((x + y + f) % 2) continue;
            c = 1;
          }
          if (y < 2) c = Math.min(c, 2);
          dot(g, x, y, C[c]);
        }
      }
      // Foam at the base.
      for (let i = 0; i < 18; i++) {
        const a = hash(i, f, 9) * Math.PI;
        const r = 2 + hash(i, f, 10) * 6;
        const x = 8.5 + Math.cos(a) * r * (hash(i, 0, 11) > 0.5 ? 1 : -1);
        const y = H - 4 + Math.sin(a) * r * 0.35 - hash(i, f, 12) * 3;
        dot(g, Math.round(x), Math.round(y), i % 3 ? R.white[0] : R.blue[6]);
      }
    });
  });
  redo('waterfall', {
    yOff: 4,
    build: (v) => fallFrames(v, 0),
    animate: (img, now, d) => fallFrames(d.variant || 0, Math.floor(now / 90) % 6),
  });

  // ==================================================================================
  // Prehistoric / volcanic
  // ==================================================================================
  redo('hut', {
    shadow: [15, 5], yOff: 3,
    build(v) {
      const g = new Grid(32, 29);
      g.line(11, 0, 13, 6, 'p');
      g.line(20, 0, 18, 6, 'p');
      g.line(16, 0, 16, 5, 'p');
      g.ell(16, 17, 15, 11, 'h');
      g.rect(0, 23, 31, 28, '.');
      g.rect(2, 22, 29, 27, 'w');
      g.ell(16, 17, 15, 11, '.');
      // Thatch dome in overlapping courses.
      for (let r = 0; r < 4; r++) {
        const cy = 7 + r * 4;
        const rx = 8 + r * 2.4;
        g.ell(16, cy + 4, rx, 5.5, 'hijh'[r]);
      }
      g.ell(16, 7, 6, 3, 'j');
      for (let r = 0; r < 4; r++) {
        const y = 12 + r * 4;
        const rx = 9 + r * 2.4;
        for (let x = Math.round(16 - rx); x <= Math.round(16 + rx); x += 2) if (g.a[y] && g.a[y][x] !== '.') g.px(x, y, 'n');
      }
      // Hide-wall, doorway, tusks.
      g.rect(12, 17, 19, 27, 'o');
      g.ell(15.5, 17, 3.5, 3, 'o');
      g.rect(11, 16, 11, 27, 'b');
      g.rect(20, 16, 20, 27, 'b');
      g.line(6, 26, 3, 19, 'x');
      g.line(7, 26, 4, 19, 'x');
      g.line(25, 26, 28, 19, 'x');
      g.line(24, 26, 27, 19, 'x');
      if (v) {
        g.ell(15.5, 12, 2.5, 2, 'x');
        g.px(14, 12, 'k');
        g.px(17, 12, 'k');
      }
      return paint(g, {
        p: WOOD_D, h: r3('wood', 4), i: [R.wood[3], R.wood[4], R.wood[5]], j: r3('wood', 4), n: R.wood[2],
        w: r3('skin', 2), o: [R.ink[1]], b: WOOD_D, x: [R.stone[4], R.skin[5], R.white[0]],
      });
    },
  });

  const bonfireBase = memo(() => {
    const g = new Grid(22, 12);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      g.ell(11 + Math.cos(a) * 8.5, 7 + Math.sin(a) * 3, 2, 1.5, i % 2 ? 's' : 't');
    }
    g.line(5, 8, 15, 3, 'w', 2);
    g.line(16, 8, 6, 3, 'v', 2);
    g.ell(11, 7, 3.5, 1.5, 'e');
    return paint(g, { s: STONE, t: STONE_L, w: WOOD, v: WOOD_D, e: [R.gold[0], R.gold[1], R.gold[2]] });
  });
  const bonfireFrames = memo((f) =>
    canvas(24, 28, (g) => {
      g.drawImage(bonfireBase(), 0, 14);
      flame(g, 9.5, 21, 12, 2.6, f, 1);
      flame(g, 14.5, 21, 11, 2.4, f + 3, 2);
      flame(g, 12, 21, 16, 3.2, f, 0);
      for (let i = 0; i < 3; i++) {
        const k = ((f + i * 3) % 8) / 8;
        dot(g, 8 + ((i * 5) % 9), Math.round(12 - k * 12), k < 0.5 ? R.gold[3] : R.gold[1]);
      }
    })
  );
  redo('bonfire', {
    shadow: [10, 4], yOff: 2,
    light: { color: '255,150,60', radius: 65, flicker: true, dy: 15 },
    build: () => bonfireFrames(0),
    animate: (img, now) => bonfireFrames(Math.floor(now / 95) % 8),
  });

  redo('fossil', {
    shadow: [8, 3], yOff: 2,
    build(v) {
      const g = new Grid(17, 12);
      g.ell(8, 7, 8, 4.5, 'a');
      g.ell(6, 5, 4.5, 2.5, 'b');
      if (v === 0) {
        for (let s = 0; s < 34; s++) {
          const a = s * 0.42;
          const r = 0.6 + s * 0.1;
          g.px(9 + Math.cos(a) * r * 1.2, 6.5 + Math.sin(a) * r * 0.85, 'x');
        }
      } else {
        g.rect(3, 6, 13, 6, 'x');
        for (let x = 5; x < 13; x += 2) g.line(x, 4, x + 1, 8, 'x');
        g.ell(2.5, 6, 1, 1, 'x');
      }
      return paint(g, { a: r3('stone', 2), b: r3('stone', 3), x: R.skin[5] });
    },
  });

  redo('bone_pillar', {
    shadow: [7, 3], yOff: 2,
    build(v) {
      const g = new Grid(16, 42);
      if (v === 0) {
        for (let s = 0; s < 36; s++) {
          const t = s / 36;
          const x = 5 + Math.sin(t * 2.2) * 5;
          const w = 2.6 * (1 - t) + 0.7;
          g.rect(Math.round(x - w), 38 - s, Math.round(x + w), 38 - s, 'b');
        }
        for (let y = 10; y < 36; y += 6) {
          const t = (38 - y) / 36;
          const x = 5 + Math.sin(t * 2.2) * 5;
          g.rect(Math.round(x - 2), y, Math.round(x + 2), y, 'c');
        }
      } else {
        for (let s = 0; s < 34; s++) {
          const t = s / 34;
          g.rect(Math.round(2 + Math.sin(t * 1.6) * 9), 38 - s, Math.round(3 + Math.sin(t * 1.6) * 9 + (1 - t) * 1.5), 38 - s, 'b');
        }
        for (let s = 0; s < 34; s++) {
          const t = s / 34;
          g.rect(Math.round(12 - Math.sin(t * 1.6) * 9 - (1 - t) * 1.5), 38 - s, Math.round(13 - Math.sin(t * 1.6) * 9), 38 - s, 'd');
        }
      }
      g.ell(7.5, 38, 7, 3, 'r');
      g.ell(5, 37, 3, 1.5, 'q');
      return paint(g, { b: [R.stone[3], R.skin[4], R.skin[5]], d: [R.stone[3], R.stone[4], R.skin[4]], c: R.stone[3], r: r3('stone', 1), q: r3('stone', 2) });
    },
  });

  redo('reptite_ruin', {
    shadow: [10, 4], yOff: 2,
    build(v) {
      const g = new Grid(20, 29);
      const top = v ? 10 : 2;
      g.rect(3, top, 16, 27, 'a');
      g.rect(14, top, 16, 27, 'A');
      g.rect(1, 25, 18, 28, 'b');
      for (let x = 3; x <= 16; x++) {
        const cut = Math.floor(hash(x, v, 21) * 3 + (v ? Math.abs(x - 10) * 0.2 : 0));
        for (let y = top; y < top + cut; y++) g.px(x, y, '.');
      }
      // Carved reptite face.
      const fy = top + 5;
      g.rect(5, fy, 14, fy + 9, 'c');
      g.text(5, fy + 2, ['kee....eek', '.kk....kk.']);
      g.rect(7, fy + 6, 12, fy + 7, 'o');
      g.px(8, fy + 6, 'f');
      g.px(10, fy + 6, 'f');
      g.px(11, fy + 7, 'f');
      g.line(4, top + 3, 7, top + 14, 'x');
      g.ell(15, top + 16, 1.5, 1, 'm');
      g.ell(4, 24, 2, 1, 'm');
      return paint(g, { a: r3('stone', 2), A: r2('stone', 1), b: r3('stone', 1), c: r3('stone', 3), e: R.red[4], o: [R.ink[1]], f: R.skin[5], x: R.stone[0], m: R.green[3] });
    },
  });

  // ==================================================================================
  // Snow
  // ==================================================================================
  redo('snow_hut', {
    shadow: [15, 5], yOff: 3,
    light: { color: '255,190,110', radius: 22, flicker: true, dy: 24, dx: 5 },
    build(v) {
      const g = new Grid(31, 32);
      isoBox(g, 15, 10, 13, 12, 'l', 'w', 'x');
      // Log courses.
      for (let x = 2; x < 28; x++) {
        const e = isoEdge(15, 10, 13, x);
        for (let y = e + 3; y <= e + 12; y += 3) g.px(x, y, x < 15 ? 'd' : 'e');
      }
      // Door on the left face, lit window on the right.
      for (let x = 5; x <= 8; x++) {
        const e = isoEdge(15, 10, 13, x);
        g.rect(x, e + 4, x, e + 12, 'o');
      }
      for (let x = 19; x <= 23; x++) {
        const e = isoEdge(15, 10, 13, x);
        g.rect(x, e + 4, x, e + 7, 'y');
      }
      // Snow-laden roof.
      g.tri(-1, 17, 15, 1, 15, 26, 'r');
      g.tri(15, 1, 31, 17, 15, 26, 's');
      g.rect(0, 17, 1, 19, 'r');
      g.rect(29, 17, 30, 19, 's');
      for (let x = 1; x < 30; x += 3) g.px(x, 18 + (x < 15 ? (x >> 1) * 0 : 0) + Math.round(Math.abs(x - 15) * -0) + 2, 'n');
      for (let y = 3; y < 17; y += 4) g.px(15 - (y - 1) * 0.7, y + 1, 'n');
      if (v) {
        g.rect(20, 0, 23, 7, 'c');
        g.rect(19, 0, 24, 1, 'n');
      }
      return paint(g, {
        l: WOOD, w: WOOD, x: WOOD_D, d: R.wood[1], e: R.wood[0], o: [R.ink[1]], y: [R.gold[3]],
        r: SNOW, s: [R.slate[3], R.slate[4]], n: R.white[0], c: r3('stone', 2),
      });
    },
  });

  // ==================================================================================
  // Zeal
  // ==================================================================================
  const ZEAL = { b: r3('slate', 3), g: r3('gold', 2), l: [R.white[0]], s: [R.slate[5]], m: [R.slate[4]], d: [R.slate[3]], f: R.slate[3], y: R.blue[5] };
  redo('broken_column', {
    shadow: [7, 3], yOff: 2,
    build(v) {
      const g = new Grid(15, 40);
      const top = [3, 17, 27][v];
      g.rect(0, 36, 14, 39, 'b');
      g.rect(1, 34, 13, 35, 'g');
      for (let x = 2; x <= 12; x++) g.rect(x, top, x, 33, x <= 3 ? 'l' : x >= 10 ? 'd' : x >= 8 ? 'm' : 's');
      for (const x of [5, 8, 11]) g.rect(x, top + 1, x, 32, 'f');
      g.rect(2, top + 5, 12, top + 6, 'g');
      if (v === 0) {
        g.rect(1, 1, 13, 3, 'g');
        g.rect(0, 0, 14, 0, 'b');
      }
      for (let x = 2; x <= 12; x++) {
        const cut = Math.floor(hash(x, v, 31) * 4);
        if (v || x > 9) for (let y = v ? top : 0; y < (v ? top : 0) + cut; y++) g.px(x, y, '.');
      }
      if (v) g.line(6, top + 8, 9, 33, 'y');
      if (v === 2) {
        g.ell(13, 38, 1.5, 1, 'b');
        g.ell(1, 38, 1.5, 1, 'b');
      }
      return paint(g, ZEAL);
    },
  });

  const STATUE = [
    '...kkkk...',
    '..khhhhk..',
    '.khzzzzhk.',
    '.khzezehk.',
    '.khzzzzhk.',
    '.khhzzhhk.',
    '.khkzzkhk.',
    '.khrrrrhk.',
    '.khrqqrhk.',
    '..krrrrk..',
    '..krqqrk..',
    '..krrrrk..',
    '..krqrrk..',
    '.krrqrrrk.',
    '.krrqrrrk.',
    'krrrqrrrrk',
    'krrrqrrrrk',
    'kqqqqqqqqk',
  ];
  // Opaque glass: glints and a bright rim over a case interior (grid coords + 1).
  function glass(ctx, x0, y0, x1, y1, cracked) {
    for (let y = y0; y <= y1; y++) dot(ctx, x0, y, R.blue[6]);
    for (let x = x0; x <= x1; x++) dot(ctx, x, y0, R.blue[6]);
    for (const [sx, len] of [[x0 + 2, 9], [x0 + 5, 5]])
      for (let k = 0; k < len; k++) {
        const x = sx + (k >> 1);
        const y = y0 + 2 + k;
        if (x < x1 && y < y1) dot(ctx, x, y, k % 3 === 2 ? R.blue[5] : R.white[0]);
      }
    if (cracked) {
      const cx = Math.round((x0 + x1) / 2 + 2);
      const cy = Math.round((y0 + y1) / 2 - 4);
      for (let a = 0; a < 6; a++) {
        const ang = a * 1.05 + 0.3;
        let x = cx;
        let y = cy;
        const len = 4 + hash(a, 1, 7) * 8;
        for (let s = 0; s < len; s++) {
          x += Math.cos(ang + Math.sin(s * 0.9) * 0.4);
          y += Math.sin(ang + Math.sin(s * 0.9) * 0.4);
          if (x > x0 && x < x1 && y > y0 && y < y1) dot(ctx, Math.round(x), Math.round(y), R.white[0]);
        }
      }
    }
  }
  redo('schala_vitrine', {
    shadow: [12, 4], yOff: 3,
    light: { color: '160,220,255', radius: 30, dy: 20 },
    build(v) {
      const g = new Grid(25, 45);
      g.rect(1, 37, 23, 44, 'p');
      g.rect(0, 36, 24, 37, 'g');
      g.rect(2, 41, 22, 41, 'g');
      g.rect(1, 2, 23, 4, 'g');
      g.rect(2, 4, 3, 36, 'f');
      g.rect(21, 4, 22, 36, 'f');
      g.rect(4, 5, 20, 35, 'i');
      g.text(7, 17, STATUE);
      if (v === 1) {
        g.ell(11, 20, 1.6, 1.6, 'o');
        g.px(13, 19, 'o');
      }
      const cv = paint(g, {
        p: r3('slate', 3), g: GOLD, f: MARBLE, i: [R.blue[1], R.blue[1], R.blue[2]], h: r3('slate', 4), z: [R.white[0]],
        e: R.slate[2], o: R.ink[0], r: r3('slate', 4), q: R.slate[3],
      });
      const x = cv.getContext('2d');
      glass(x, 5, 6, 21, 36, v === 1);
      if (v === 1) for (let i = 0; i < 8; i++) dot(x, 3 + Math.floor(hash(i, 5, 1) * 20), 40 + Math.floor(hash(i, 5, 2) * 4), R.blue[6]);
      return cv;
    },
  });

  redo('dreamstone', {
    shadow: [7, 3], yOff: 2,
    light: { color: '120,230,255', radius: 35, flicker: true, dy: 10 },
    build(v) {
      const g = new Grid(17, 22);
      g.ell(8, 19, 7, 2, 'r');
      const spikes = v
        ? [[8, 20, 7, 2, 5, 'a'], [4, 20, 1, 8, 3.5, 'b'], [12, 20, 15, 7, 3.5, 'c'], [10, 20, 11, 11, 3, 'b']]
        : [[8, 20, 9, 0, 6, 'a'], [4, 20, 1, 9, 3.5, 'c'], [12, 20, 14, 6, 4, 'b']];
      for (const [x0, y0, x1, y1, w, c] of spikes) {
        g.spike(x0, y0, x1, y1, w, c);
        g.line(x0 - 1, y0 - 3, (x0 + x1 * 2) / 3 - 0.5, (y0 + y1 * 2) / 3, 'L');
      }
      return paint(g, { r: r3('slate', 1), a: r3('blue', 5), b: r3('teal', 2), c: [R.blue[4], R.blue[5], R.blue[6]], L: R.white[0] });
    },
  });

  // ==================================================================================
  // End of Time
  // ==================================================================================
  redo('lamppost', {
    shadow: [5, 2], yOff: 2,
    light: { color: '255,220,150', radius: 70, flicker: false, dy: 8 },
    build() {
      const g = new Grid(13, 50);
      g.rect(2, 45, 10, 49, 'b');
      g.rect(3, 42, 9, 44, 'c');
      g.rect(5, 13, 7, 41, 'p');
      g.rect(4, 25, 8, 26, 'c');
      g.line(5, 13, 2, 15, 'p');
      g.line(7, 13, 10, 15, 'p');
      g.rect(2, 4, 10, 11, 'f');
      g.rect(3, 5, 9, 10, 'L');
      g.rect(6, 5, 6, 10, 'f');
      g.tri(0, 4, 13, 4, 6.5, -1, 'c');
      g.rect(2, 11, 10, 12, 'c');
      g.px(6, 0, 'c');
      return paint(g, { b: r3('slate', 1), c: r3('slate', 1), p: [R.ink[2], R.slate[0], R.slate[1]], f: [R.ink[2]], L: [R.gold[3], R.gold[4], R.white[0]] });
    },
  });

  // Era doors: stone frame around a shimmering pillar of light.
  const DOORS = {
    door_600: { c: [R.blue[3], R.blue[4], R.blue[5], R.blue[6]], light: '110,170,255', gem: R.slate[5] },
    door_65m: { c: [R.green[3], R.green[4], R.gold[2], R.gold[4]], light: '200,210,90', gem: R.slate[5] },
    door_12k: { c: [R.purple[3], R.purple[4], R.blue[5], R.blue[6]], light: '160,150,255', gem: R.slate[5] },
    door_grey: { c: [R.slate[2], R.slate[3], R.slate[4], R.slate[5]], light: '200,60,70', scan: true, gem: R.red[3] },
  };
  const doorFrame = memo((gem) => {
    const g = new Grid(22, 41);
    g.rect(0, 37, 21, 40, 'b');
    g.rect(1, 35, 20, 36, 'c');
    g.rect(1, 5, 4, 35, 's');
    g.rect(17, 5, 20, 35, 'S');
    for (let y = 9; y < 35; y += 4) {
      g.rect(1, y, 4, y, 'm');
      g.rect(17, y, 20, y, 'm');
    }
    g.rect(0, 1, 21, 5, 'c');
    g.tri(8, 1, 14, 1, 11, -3, 'c');
    g.rect(9, 1, 12, 4, 'k');
    g.rect(10, 2, 11, 3, 'y');
    g.rect(5, 6, 16, 34, 'o');
    return paint(g, { b: r3('slate', 1), c: r3('slate', 2), s: r3('slate', 2), S: r2('slate', 1), m: R.slate[0], o: [R.ink[0]], y: gem });
  });
  const doorFrames = memo((kind, f) => {
    const D = DOORS[kind];
    const base = doorFrame(D.gem);
    return canvas(base.width, base.height, (g) => {
      g.drawImage(base, 0, 0);
      const x0 = 6;
      const x1 = 17;
      const y0 = 7;
      const y1 = 35;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const u = (x - x0) / (x1 - x0);
          const core = 1 - Math.abs(u - 0.5) * 2;
          const v = (y - y0) / (y1 - y0);
          const wave = 0.5 + 0.5 * Math.sin(v * 12 - f * 0.785 + u * 3);
          let k = core * 2.6 + wave * 0.9 - 0.5 + v * 0.3;
          if ((x + y) % 2) k += 0.35;
          let c = D.c[Math.max(0, Math.min(3, Math.floor(k)))];
          if (core < 0.2 && (x + y + f) % 2) c = R.ink[1];
          if (D.scan && (y + f) % 4 === 0) c = R.red[3];
          dot(g, x, y, c);
        }
      for (let i = 0; i < 5; i++) {
        const k = (f / 8 + i / 5) % 1;
        dot(g, x0 + 2 + ((i * 5) % 9), Math.round(y1 - k * (y1 - y0)), R.white[0]);
      }
    });
  });
  for (const kind of Object.keys(DOORS)) {
    redo(kind, {
      shadow: [11, 4], yOff: 3,
      light: { color: DOORS[kind].light, radius: 48, flicker: true, dy: 20 },
      build: () => doorFrames(kind, 0),
      animate: (img, now) => doorFrames(kind, Math.floor(now / 110) % 8),
    });
  }
  redo('door_spekkio', {
    shadow: [11, 4], yOff: 3,
    light: { color: '255,190,120', radius: 35, flicker: true, dy: 22 },
    build() {
      const g = new Grid(22, 41);
      g.rect(0, 37, 21, 40, 'b');
      g.rect(1, 5, 20, 36, 's');
      g.rect(17, 5, 20, 36, 'S');
      g.rect(0, 1, 21, 5, 'c');
      g.rect(5, 13, 16, 36, 'd');
      g.ell(10.5, 13, 5.5, 5, 'd');
      for (const x of [7, 10, 13]) g.rect(x, 10, x, 36, 'e');
      g.rect(5, 22, 16, 22, 'i');
      g.rect(5, 30, 16, 30, 'i');
      g.px(14, 26, 'y');
      g.ell(10.5, 12, 2, 2, 'w');
      g.rect(10, 10, 11, 14, 'i');
      g.rect(9, 12, 12, 12, 'i');
      g.text(7, -1, ['y......y', 'y......y', 'yy....yy']);
      return paint(g, { b: r3('slate', 1), c: r3('slate', 2), s: r3('slate', 2), S: r2('slate', 1), d: r3('wood', 3), e: R.wood[1], i: R.slate[0], y: R.gold[2], w: R.gold[4] });
    },
  });

  const saveFrames = memo((f) =>
    canvas(20, 28, (g) => {
      // Glowing ring on the floor with rising sparkles.
      for (let a = 0; a < 40; a++) {
        const ang = (a / 40) * Math.PI * 2;
        const x = Math.round(10 + Math.cos(ang) * 7);
        const y = Math.round(23 + Math.sin(ang) * 3);
        const tw = 0.5 + 0.5 * Math.sin(ang * 3 + f * 0.8);
        dot(g, x, y, tw > 0.7 ? R.white[0] : tw > 0.3 ? R.blue[5] : R.blue[4]);
      }
      for (let y = -1; y <= 1; y++) for (let x = -4; x <= 4; x++) if ((x + y + f) % 2 === 0 && Math.abs(x) + Math.abs(y) * 3 < 5) dot(g, 10 + x, 23 + y, R.blue[4]);
      for (let i = 0; i < 7; i++) {
        const k = (f / 8 + i / 7) % 1;
        const x = Math.round(10 + Math.cos(i * 2.4) * (2 + (i % 3) * 2));
        const y = Math.round(23 - k * 22);
        dot(g, x, y, k < 0.6 ? R.white[0] : R.blue[5]);
        if (i % 3 === 0 && k < 0.7) {
          dot(g, x - 1, y, R.blue[5]);
          dot(g, x + 1, y, R.blue[5]);
          dot(g, x, y - 1, R.blue[5]);
          dot(g, x, y + 1, R.blue[5]);
        }
      }
    })
  );
  redo('save_point', {
    yOff: 4,
    light: { color: '140,200,255', radius: 30, flicker: true, dy: 22 },
    build: () => saveFrames(0),
    animate: (img, now) => saveFrames(Math.floor(now / 120) % 8),
  });

  redo('nu_stall', {
    shadow: [13, 5], yOff: 3,
    build() {
      const g = new Grid(28, 30);
      g.rect(2, 6, 3, 27, 'p');
      g.rect(24, 6, 25, 27, 'p');
      isoBox(g, 14, 13, 12, 8, 'a', 'b', 'c');
      // Awning stripes and valance.
      for (let x = 0; x <= 27; x++) {
        const y0 = 2 + Math.round(Math.abs(x - 13.5) * 0.12);
        g.rect(x, y0, x, y0 + 4, Math.floor(x / 3) % 2 ? (x > 19 ? 'S' : 's') : x > 19 ? 'T' : 't');
      }
      for (let i = 0; i < 7; i++) g.rect(i * 4, 7 + (i === 0 || i === 6 ? 0 : 1), i * 4 + 2, 8 + (i === 0 || i === 6 ? 0 : 1), i % 2 ? 's' : 't');
      // Goods: tonics, bottles, a sack.
      g.rect(6, 14, 7, 17, 'r');
      g.px(6, 13, 'x');
      g.rect(9, 13, 10, 17, 'u');
      g.px(9, 12, 'x');
      g.ell(17, 16, 2.5, 2, 'v');
      g.rect(20, 14, 21, 17, 'g');
      g.px(20, 13, 'x');
      return paint(g, {
        p: WOOD_D, a: WOOD_L, b: WOOD, c: WOOD_D, s: [R.pink[2]], S: [R.pink[1]], t: [R.white[0]], T: [R.slate[4]],
        r: r3('red', 3), u: r3('blue', 3), v: r3('wood', 4), g: r3('green', 3), x: R.skin[5],
      });
    },
  });

  redo('rug', {
    build(v) {
      return canvas(32, 16, (g) => {
        const [a, b, c] = v ? [R.blue[2], R.blue[3], R.blue[1]] : [R.red[2], R.red[3], R.red[1]];
        g.fillStyle = R.gold[1];
        CT.PXD.diamond(g, 16, 8, 15, true);
        g.fillStyle = c;
        CT.PXD.diamond(g, 16, 8, 13, true);
        g.fillStyle = R.gold[2];
        CT.PXD.diamond(g, 16, 8, 11, true);
        g.fillStyle = a;
        CT.PXD.diamond(g, 16, 8, 10, true);
        g.fillStyle = b;
        CT.PXD.diamond(g, 16, 8, 6, true);
        g.fillStyle = R.gold[3];
        CT.PXD.diamond(g, 16, 8, 2, true);
        g.fillStyle = R.gold[2];
        CT.PXD.diamond(g, 16, 8, 6, false);
      });
    },
  });

  redo('rubble', {
    yOff: 2,
    build(v) {
      const g = new Grid(22, 11);
      for (let i = 0; i < 6; i++) {
        const x = 4 + hash(i, v, 41) * 14;
        const y = 5 + hash(i, v, 42) * 3;
        g.ell(x, y, 1.6 + hash(i, v, 43) * 1.8, 1 + hash(i, v, 44) * 1.2, 'abc'[i % 3]);
      }
      if (v === 0) {
        g.px(6, 5, 'g');
        g.px(14, 6, 'g');
      }
      const pal = [
        { a: MARBLE, b: r3('slate', 3), c: [R.slate[3], R.slate[5], R.white[0]], g: R.gold[2] },
        { a: STONE, b: STONE_L, c: STONE_D },
        { a: MARBLE, b: [R.slate[4], R.slate[5], R.white[0]], c: r3('slate', 3) },
      ][v];
      return paint(g, pal);
    },
  });

  redo('sword_altar', {
    shadow: [9, 3], yOff: 3,
    light: { color: '160,200,255', radius: 25, dy: 5 },
    build() {
      const g = new Grid(18, 30);
      isoBox(g, 9, 17, 8, 6, 'a', 'b', 'c');
      g.rect(3, 27, 5, 27, 'm');
      g.px(14, 26, 'm');
      // The Masamune driven into the stone.
      g.rect(8, 3, 9, 20, 'S');
      g.rect(8, 3, 8, 20, 'L');
      g.rect(5, 13, 12, 14, 'G');
      g.rect(8, 8, 9, 12, 'H');
      g.rect(8, 6, 9, 7, 'G');
      g.px(8, 13, 'j');
      return paint(g, { a: STONE_L, b: STONE, c: STONE_D, m: R.green[3], S: r3('slate', 4), L: R.white[0], G: GOLD, H: r3('purple', 2), j: R.blue[5] });
    },
  });

  redo('cave', {
    shadow: [15, 5], yOff: 4,
    build() {
      const g = new Grid(31, 29);
      g.ell(15, 17, 15, 12, 'r');
      g.rect(0, 17, 30, 28, 'r');
      g.ell(9, 10, 7, 6, 'q');
      g.ell(22, 13, 6.5, 6, 's');
      g.ell(15, 21, 6.5, 6.5, 'o');
      g.rect(9, 21, 21, 28, 'o');
      g.ell(10, 6, 5.5, 2.5, 'w');
      g.ell(21, 8, 5, 2, 'w');
      g.ell(15, 4, 4, 2, 'w');
      for (let x = 10; x <= 20; x += 2) g.rect(x, 16 + Math.round(Math.abs(x - 15) * 0.3), x, 17 + ((x >> 1) % 2) + Math.round(Math.abs(x - 15) * 0.3), 'i');
      return paint(g, { r: r3('slate', 1), q: r3('slate', 2), s: r2('slate', 1), o: [R.ink[0]], w: SNOW, i: R.blue[6] });
    },
  });

  redo('float_rock', {
    yOff: -9,
    build(v) {
      const g = new Grid(17, 15);
      const w = [6, 4, 7.5][v];
      g.tri(8.5 - w, 4, 8.5 + w, 4, 8 + v * 0.5, 14 - v * 1.5, 'r');
      g.tri(8.5 - w * 0.6, 4, 8.5, 4, 6, 11, 's');
      g.ell(8.5, 4, w, 2.5, 't');
      g.ell(7.5, 3.5, w * 0.6, 1.2, 'u');
      return paint(g, { t: r3('slate', 1), u: [R.slate[2]], r: [R.ink[2], R.slate[0]], s: [R.ink[1], R.ink[2]] }, { ol: R.ink[0] });
    },
  });

  // ==================================================================================
  // The Hollow
  // ==================================================================================
  const EXHIBITS = [
    ['....G....', '...kRk...', '..kRWRk..', '.kRWRWRk.', 'kRWRWRWRk', '.kWWDWWk.', '.kWWDWWk.', '.kWDDDWk.', '.kkkkkkk.'],
    ['....k....', '...kSk...', '...kSk...', '...kSk...', '...kSk...', '.kkGGGkk.', '...kDk...', '..kGGGk..', '.kGGGGGk.'],
    ['.kk...kk.', 'kWWkkkWWk', '.kWWWWWk.', '.kWDWDWk.', '.kWWRWWk.', '..kWWWk..', '.kWWWWWk.', '.kWkkkWk.', '.kGGGGGk.'],
    ['....G....', '...kWk...', '.k.kWk.k.', 'kWkkWkkWk', 'kBBBBBBBk', '.kDDDDDk.', '..kDDDk..', '...kDk...', '....k....'],
    ['.........', '....kkk..', '..kkBBBk.', '.kSSBBBSk', 'kSSSSSSRk', '.kSSSSSk.', '..kkDkk..', '..kGGGk..', '.kGGGGGk.'],
    ['....G....', '...kGk...', '..kGGGk..', '..kGGGk..', '..kGGGk..', '.kGGGGGk.', 'kGGGGGGGk', '.kkkDkkk.', '.kSSSSSk.'],
  ];
  const EXPAL = { R: R.red[3], W: R.slate[5], D: R.ink[2], G: R.gold[2], S: R.slate[4], B: R.blue[4] };
  const HOLLOW = { a: [R.slate[4], R.slate[5], R.white[0]], b: r3('slate', 4), c: r2('slate', 3), f: [R.slate[3], R.slate[5], R.white[0]] };
  redo('vitrine', {
    shadow: [9, 3], yOff: 3,
    build(v) {
      const g = new Grid(19, 30);
      isoBox(g, 9, 19, 9, 6, 'a', 'b', 'c');
      g.rect(1, 2, 17, 23, 'i');
      g.rect(0, 0, 18, 2, 'f');
      g.rect(0, 2, 0, 23, 'f');
      g.rect(18, 2, 18, 23, 'f');
      g.text(5, 12, EXHIBITS[v]);
      g.rect(4, 21, 14, 22, 'q');
      const cv = paint(g, { ...HOLLOW, i: [R.slate[1], R.slate[2], R.slate[3]], q: r2('slate', 3), ...EXPAL });
      glass(cv.getContext('2d'), 2, 4, 18, 23);
      return cv;
    },
  });

  redo('archive_shelf', {
    shadow: [11, 4], yOff: 3,
    build(v) {
      const tall = v === 0;
      const H = tall ? 46 : 25;
      const g = new Grid(22, H);
      const depth = H - 11;
      isoBox(g, 11, 0, 11, depth, 'a', 'b', 'c');
      // Recessed shelves with standing tablets on both faces.
      for (let row = 0; row * 6 + 6 < depth; row++) {
        for (let x = 1; x < 21; x++) {
          if (x === 10 || x === 11) continue;
          const e = isoEdge(11, 0, 11, x);
          const yb = e + 6 + row * 6;
          g.rect(x, yb - 4, x, yb - 1, x < 11 ? 'n' : 'N');
          const hgt = 2 + Math.floor(hash(x, row, 51 + v) * 3);
          const hv = hash(x, row, 52);
          const col = hv > 0.9 ? 'r' : hv > 0.72 ? 'u' : x < 11 ? 't' : 'T';
          if (hash(x, row, 53) > 0.2) g.rect(x, yb - hgt, x, yb - 1, col);
        }
      }
      if (!tall) {
        g.rect(4, 12, 8, 18, 'l');
        text3(g, 5, 13, 'A', 'x');
      }
      return paint(g, {
        a: HOLLOW.a, b: [R.slate[4]], c: [R.slate[3]], n: R.slate[1], N: R.slate[0], t: R.white[0], T: R.slate[5], u: R.blue[5], r: R.red[3], l: [R.gold[2]], x: R.ink[1],
      });
    },
  });

  redo('ladder', {
    yOff: 1, xOff: 0,
    build() {
      const g = new Grid(10, 22);
      g.rect(1, 0, 2, 21, 'r');
      g.rect(7, 0, 8, 21, 'r');
      for (let y = 2; y < 22; y += 4) g.rect(3, y, 6, y, 's');
      return paint(g, { r: r2('slate', 3), s: [R.slate[4]] });
    },
  });

  redo('arch', {
    yOff: 5,
    build(v) {
      const g = new Grid(32, 46);
      g.rect(1, 10, 6, 45, 'a');
      g.rect(25, 10, 30, 45, 'A');
      g.rect(0, 7, 31, 11, 'c');
      g.rect(0, 4, 31, 6, 'b');
      g.ell(15.5, 15, 9, 7, 'o');
      g.rect(7, 15, 24, 45, 'o');
      for (let y = 15; y < 45; y += 6) {
        g.rect(1, y, 6, y, 'd');
        g.rect(25, y, 30, y, 'd');
      }
      // The passage fades into light (dithered bands).
      for (let y = 26; y <= 45; y++)
        for (let x = 7; x <= 24; x++) {
          const t = (y - 26) / 19;
          if (g.a[y][x] === 'o' && ((x + y) % 2 === 0 ? t > 0.25 : t > 0.7)) g.px(x, y, 'P');
        }
      g.ell(15.5, 5, 2, 2, 'g');
      return paint(g, {
        a: [R.slate[4], R.slate[5], R.white[0]], A: [R.slate[3], R.slate[4]], b: [R.slate[4], R.white[0], R.white[0]], c: r3('slate', 4), d: R.slate[3],
        o: [R.ink[1]], P: v ? R.red[1] : R.slate[1], g: v ? r3('red', 3) : r3('blue', 4),
      });
    },
  });

  const PLACARDS = ['CRONO', 'GLENN', 'AYLA', 'JANUS'];
  redo('pedestal_placard', {
    yOff: -1,
    light: { color: '255,220,160', radius: 17, dy: 4 },
    build(v) {
      const g = new Grid(22, 16);
      if (v < 4) {
        g.rect(10, 10, 11, 14, 's');
        g.rect(7, 14, 14, 15, 's');
        // Slanted plaque.
        for (let x = 0; x < 22; x++) {
          const y0 = Math.round(5 - x * 0.2);
          g.rect(x, y0, x, y0 + 8, x === 0 || x === 21 ? 'g' : 'p');
          g.px(x, y0, 'g');
          g.px(x, y0 + 8, 'g');
        }
        const word = PLACARDS[v];
        let x = 11 - word.length * 2 + 1;
        for (const ch of word) {
          text3(g, x, Math.round(5 - (x + 2) * 0.2) + 2, ch, 'x');
          x += 4;
        }
      } else {
        g.rect(10, 9, 11, 13, 's');
        g.rect(7, 13, 14, 14, 's');
        g.tri(9, 9, 13, 9, 11, 6, 's');
        g.tri(1, 13, 6, 11, 5, 14, 'p');
        g.tri(15, 13, 20, 11, 19, 14, 'p');
        g.tri(3, 10, 6, 9, 5, 12, 'p');
      }
      return paint(g, { s: r3('gold', 1), p: [R.slate[5]], g: R.gold[2], x: R.ink[1] });
    },
  });

  redo('core_vitrine', {
    shadow: [16, 6], yOff: 4,
    light: { color: '255,90,110', radius: 30, dy: 25 },
    build() {
      const g = new Grid(31, 48);
      isoBox(g, 15, 35, 14, 5, 'a', 'b', 'c');
      g.rect(1, 3, 29, 41, 'i');
      g.rect(0, 1, 30, 3, 'f');
      g.rect(0, 3, 1, 41, 'f');
      g.rect(29, 3, 30, 41, 'f');
      g.rect(15, 3, 15, 41, 'f');
      g.rect(10, 0, 20, 1, 'f');
      g.rect(12, 44, 18, 45, 'r');
      const cv = paint(g, { ...HOLLOW, i: [R.red[0], R.red[0], R.red[1]], r: r3('red', 3) });
      glass(cv.getContext('2d'), 3, 5, 15, 42);
      glass(cv.getContext('2d'), 17, 5, 29, 42);
      return cv;
    },
  });

  // Anything registered earlier but not redrawn here stays legacy (auto-halved).
  CT.DECOR_NATIVE = done;
})();
