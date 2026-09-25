// Character & decoration sprites.
//
// Two sources:
//  1. PixelLab exports baked into CT.ASSETS (see tools/build-assets.mjs) —
//     8-directional, used whenever a character has one.
//  2. Built-in sprites composed here from shape primitives and hand-placed
//     detail on a letter grid, then run through an automatic outline + cel
//     shading pass (light from the top-left) so flat colour regions read as
//     volume, in the style of the reference art.
(function () {
  const CT = (window.CT = window.CT || {});

  const OUTLINE = [28, 16, 36];
  const SHADOW = [42, 24, 64];
  const LIGHT = [255, 244, 216];

  // ---- Colour helpers --------------------------------------------------------
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  // ---- Letter grid -----------------------------------------------------------
  class Grid {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.a = Array.from({ length: h }, () => Array(w).fill('.'));
    }
    px(x, y, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y][x] = c;
    }
    rect(x0, y0, x1, y1, c) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, c);
    }
    ell(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / (rx + 0.35);
          const dy = (y - cy) / (ry + 0.35);
          if (dx * dx + dy * dy <= 1) this.px(x, y, c);
        }
    }
    line(x0, y0, x1, y1, c, w = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = y0 + ((y1 - y0) * i) / n;
        for (let k = 0; k < w; k++) this.px(x + k, y, c);
      }
    }
    tri(ax, ay, bx, by, cx, cy, c) {
      const side = (x0, y0, x1, y1, x, y) => (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
      for (let y = Math.floor(Math.min(ay, by, cy)); y <= Math.ceil(Math.max(ay, by, cy)); y++)
        for (let x = Math.floor(Math.min(ax, bx, cx)); x <= Math.ceil(Math.max(ax, bx, cx)); x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const d1 = side(ax, ay, bx, by, px, py);
          const d2 = side(bx, by, cx, cy, px, py);
          const d3 = side(cx, cy, ax, ay, px, py);
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.px(x, y, c);
        }
    }
    // Tapered spike from a base centred on (x0,y0), w wide, to a tip (x1,y1).
    spike(x0, y0, x1, y1, w, c) {
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const px = (-(y1 - y0) / len) * (w / 2);
      const py = ((x1 - x0) / len) * (w / 2);
      this.tri(x0 + px, y0 + py, x0 - px, y0 - py, x1, y1, c);
    }
    // Overlay text rows; '.' and ' ' are transparent.
    text(ox, oy, rows) {
      rows.forEach((r, y) => [...r].forEach((c, x) => c !== '.' && c !== ' ' && this.px(ox + x, oy + y, c)));
    }
  }

  // Outline + cel shading. `detail` letters (eyes, strands) are drawn flat and
  // don't split the region they sit in.
  function shadeGrid(g, pal, detail = '', hi = false) {
    const P = 1; // padding for the outline
    const W = g.w + P * 2;
    const H = g.h + P * 2;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const at = (x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? '.' : g.a[y][x]);
    const isDetail = (c) => detail.includes(c);
    const same = (x, y, c) => {
      const d = at(x, y);
      return d === c || (d !== '.' && isDetail(d));
    };
    const cols = {};
    for (const k in pal) cols[k] = hex(pal[k]);
    const put = (x, y, rgb) => {
      const i = ((y + P) * W + (x + P)) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    };
    // Per-letter bounding boxes, for a top-left-lit gradient across regions.
    const boxes = {};
    if (hi)
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          const c = g.a[y][x];
          const b = (boxes[c] = boxes[c] || [x, y, x, y]);
          b[0] = Math.min(b[0], x);
          b[1] = Math.min(b[1], y);
          b[2] = Math.max(b[2], x);
          b[3] = Math.max(b[3], y);
        }
    for (let y = -P; y < g.h + P; y++)
      for (let x = -P; x < g.w + P; x++) {
        const c = at(x, y);
        if (c === '.') {
          if (at(x + 1, y) !== '.' || at(x - 1, y) !== '.' || at(x, y + 1) !== '.' || at(x, y - 1) !== '.') put(x, y, OUTLINE);
          continue;
        }
        const base = c === 'k' ? OUTLINE : cols[c] || OUTLINE;
        if (c === 'k' || isDetail(c)) {
          put(x, y, base);
          continue;
        }
        const r1 = !same(x + 1, y, c) || !same(x, y + 1, c);
        const r2 = !same(x + 2, y, c) || !same(x, y + 2, c) || !same(x + 1, y + 1, c);
        const l1 = !same(x - 1, y, c) || !same(x, y - 1, c);
        let rgb = base;
        if (hi) {
          // Three shade bands + two highlight bands for 48px art.
          const r3 = !same(x + 3, y, c) || !same(x, y + 3, c) || !same(x + 2, y + 2, c);
          const l2 = !same(x - 2, y, c) || !same(x, y - 2, c);
          const seam = [[1, 0], [0, 1]].some(([dx, dy]) => {
            const d = at(x + dx, y + dy);
            return d !== '.' && d !== c && !isDetail(d);
          });
          const b = boxes[c];
          const gx = (x - b[0]) / Math.max(1, b[2] - b[0]);
          const gy = (y - b[1]) / Math.max(1, b[3] - b[1]);
          const grad = 0.16 * gx + 0.12 * gy - 0.1;
          const lit = grad > 0 ? mix(base, SHADOW, grad) : mix(base, LIGHT, -grad);
          rgb = lit;
          if (seam) rgb = mix(base, OUTLINE, 0.55);
          else if (r1) rgb = mix(lit, SHADOW, 0.42);
          else if (r2) rgb = mix(lit, SHADOW, 0.24);
          else if (r3) rgb = mix(lit, SHADOW, 0.1);
          else if (l1) rgb = mix(lit, LIGHT, 0.34);
          else if (l2) rgb = mix(lit, LIGHT, 0.14);
        } else if (r1) rgb = mix(base, SHADOW, 0.34);
        else if (r2) rgb = mix(base, SHADOW, 0.15);
        else if (l1) rgb = mix(base, LIGHT, 0.24);
        put(x, y, rgb);
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // ---- Humanoid template (3/4 view facing screen-right) ------------------------
  // 32x44 grid. Letters: s head skin, A arm skin, n neck, t torso skin,
  // c torso, d sleeves, l belt, p/q legs, b/o boots, e/E eyes, m mouth.
  const W = 32;
  const H = 44;
  function humanBase(o = {}) {
    const g = new Grid(W, H);
    // Back arm first so the torso overlaps it.
    g.rect(7, 24, 9, 33, o.sleeves === 'long' ? 'd' : 'A');
    if (o.sleeves === 'short') g.rect(7, 24, 9, 26, 'd');
    g.rect(7, 33, 9, 34, 'A');
    // Legs & boots.
    g.rect(10, 33, 21, 34, 'p');
    g.rect(10, 35, 14, 39, 'p');
    g.rect(17, 35, 21, 39, 'q');
    g.rect(9, 40, 14, 42, 'b');
    g.rect(17, 40, 22, 42, 'o');
    // Torso.
    g.rect(10, 24, 21, 31, 'c');
    g.rect(11, 23, 20, 23, 'c');
    g.rect(10, 31, 21, 32, 'l');
    // Front arm.
    g.rect(22, 24, 24, 33, o.sleeves === 'long' ? 'd' : 'A');
    if (o.sleeves === 'short') g.rect(22, 24, 24, 26, 'd');
    g.rect(22, 33, 24, 34, 'A');
    // Neck & head.
    g.rect(13, 21, 18, 23, 'n');
    const head = [[8, 11, 20], [9, 9, 22], [10, 8, 23], [20, 8, 23], [21, 9, 22], [22, 11, 20]];
    for (let y = 8; y <= 22; y++) {
      const r = head.find((h) => h[0] === y) || [y, 8, 23];
      g.rect(r[1], y, r[2], y, 's');
    }
    // Ear on the far (left) side.
    g.rect(9, 15, 10, 17, 'S');
    // Eyes: 2x3, near eye larger.
    g.text(14, 14, ['ee', 'eE', 'ee']);
    g.text(19, 14, ['ee', 'eE', 'ee']);
    g.px(21, 17, 'S');
    g.rect(17, 19, 19, 19, 'm');
    return g;
  }

  const SKIN = { s: '#f4c49a', A: '#f4c49a', n: '#d8a078', t: '#f4c49a', S: '#d89870', e: '#1c1830', E: '#f0f0ff', m: '#a04848' };

  const BUILDERS = {
    // Crono gets the full 48x48 treatment with front and back views, to sit
    // alongside the PixelLab exports.
    crono() {
      const pal = {
        h: '#dc4430', H: '#8c2014', R: '#ff8a50', w: '#f4f0e8', s: '#f6c9a0', S: '#d99a74', n: '#dca07c',
        A: '#f6c9a0', F: '#f6c9a0', e: '#1c1830', E: '#ffffff', m: '#9c4040', c: '#2f6fc0', d: '#2f6fc0',
        D: '#2f6fc0', C: '#1c4a8c', v: '#8cc0f0', l: '#c08c40', y: '#f0d060', W: '#c08c40', p: '#e2d6b8',
        q: '#e2d6b8', P: '#b8a888', b: '#6c3c20', o: '#6c3c20', B: '#3c2010', z: '#5c3418', x: '#eef4ff', X: '#9aa8c4', g: '#3c2c28',
      };
      const spikes = [
        [21, 6, 17, 0, 5], [25, 5, 25, 0, 5], [28, 6, 32, 1, 5], [30, 9, 36, 6, 4], [19, 8, 11, 4, 5],
        [18, 11, 10, 11, 5], [18, 14, 11, 18, 5], [20, 16, 16, 21, 4], [31, 11, 35, 12, 3],
      ];
      const figure = (back) => {
        const g = new Grid(48, 48);
        g.line(19, 29, 12, 39, 'z', 2); // scabbard on the far hip
        // Far arm, half hidden behind the body.
        g.rect(15, 20, 17, 24, 'd');
        g.rect(15, 25, 17, 28, 'A');
        g.rect(15, 27, 17, 27, 'W');
        g.ell(16, 29.5, 1.5, 1.3, 'A');
        // Legs: far leg planted back, near leg stepping forward.
        g.rect(18, 32, 30, 33, 'p');
        g.rect(18, 34, 22, 39, 'p');
        g.rect(25, 34, 29, 37, 'q');
        g.rect(26, 38, 30, 41, 'q');
        g.line(20, 35, 20, 38, 'P');
        g.line(27, 35, 28, 40, 'P');
        g.rect(17, 40, 22, 43, 'b');
        g.rect(17, 44, 22, 44, 'B');
        g.rect(25, 42, 31, 45, 'o');
        g.rect(31, 44, 32, 45, 'o');
        g.rect(25, 46, 32, 46, 'B');
        // Tunic.
        g.rect(17, 19, 30, 20, 'c');
        g.px(17, 19, '.');
        g.rect(18, 20, 30, 28, 'c');
        g.rect(17, 29, 31, 31, 'c');
        g.rect(17, 27, 31, 28, 'l');
        if (!back) {
          g.rect(26, 27, 27, 28, 'y');
          g.line(24, 19, 26, 22, 'v');
          g.line(28, 19, 26, 22, 'v');
          g.line(26, 23, 26, 26, 'C');
          g.line(21, 29, 21, 31, 'C');
        } else {
          g.line(23, 21, 23, 26, 'C');
        }
        // Near arm, bent forward to grip the katana.
        g.rect(30, 19, 33, 23, 'D');
        g.line(31, 24, 34, 28, 'F', 3);
        g.line(32, 26, 35, 26, 'W');
        g.ell(35.5, 29, 1.8, 1.6, 'F');
        // Neck & head.
        g.rect(22, 17, 25, 19, 'n');
        g.ell(24, 12, 5.5, 6, 's');
        // Hair.
        g.ell(20, 11, 6.5, 6.5, 'h'); // mane sweeping back
        if (back) g.ell(24, 11, 6.5, 7, 'h');
        else g.ell(23, 8, 7.5, 5, 'h');
        for (const [x0, y0, x1, y1, w] of spikes) g.spike(x0, y0, x1, y1, w, 'h');
        if (back) for (const [x0, y0, x1, y1, w] of [[21, 16, 19, 21, 4], [25, 17, 25, 22, 4], [28, 16, 30, 20, 4]]) g.spike(x0, y0, x1, y1, w, 'h');
        for (const [x0, y0, x1, y1] of [[21, 5, 18, 1], [25, 4, 25, 1], [28, 5, 31, 2], [18, 9, 13, 6], [18, 12, 12, 11], [19, 15, 14, 18]]) g.line(x0, y0, x1, y1, 'H');
        for (const [x0, y0, x1, y1] of [[23, 5, 20, 2], [26, 5, 27, 2], [29, 8, 33, 6]]) g.line(x0, y0, x1, y1, 'R');
        if (!back) {
          // Face.
          for (const [y, x0, x1] of [[10, 21, 29], [11, 21, 29], [12, 21, 30], [13, 21, 30], [14, 21, 30], [15, 21, 29], [16, 22, 29], [17, 22, 28], [18, 23, 27]])
            g.rect(x0, y, x1, y, 's');
          for (const [x0, y0, x1, y1, w] of [[22, 8, 21, 12, 4], [25, 8, 25, 12, 4], [28, 8, 29, 12, 4], [20, 9, 19, 14, 3]]) g.spike(x0, y0, x1, y1, w, 'h');
          g.rect(20, 12, 21, 14, 'S');
          g.text(23, 12, ['k...kk', 'e...eE']);
          g.px(29, 14, 'S');
          g.rect(26, 16, 27, 16, 'm');
        }
        // Headband, knotted at the back with two tails.
        g.line(18, 8, 30, 7, 'w');
        g.line(18, 9, 30, 8, 'w');
        g.tri(18, 8, 19, 10, 12, 16, 'w');
        g.tri(18, 9, 20, 10, 15, 19, 'w');
        // Katana raised in the near hand.
        g.line(36, 27, 44, 4, 'x');
        g.line(37, 27, 45, 5, 'X');
        g.rect(34, 26, 38, 27, 'y');
        g.line(35, 30, 34, 33, 'g', 2);
        return shadeGrid(g, pal, 'eEmHRkCvXP', true);
      };
      return { se: figure(false), ne: figure(true) };
    },
    marle() {
      const g = humanBase({ sleeves: 'short' });
      // Ponytail behind (left) first.
      g.ell(6, 16, 3, 4, 'y');
      g.ell(5, 23, 2.5, 5, 'y');
      g.ell(6, 29, 2, 3, 'y');
      g.rect(6, 11, 8, 12, 'r');
      g.text(0, 0, [
        '................................',
        '................................',
        '................................',
        '...........hhhhhhhhhh...........',
        '.........hhhhhhhhhhhhhh.........',
        '........hhhhhhhhhhhhhhhh........',
        '.......hhhhHhhhhhhhhhhhhh.......',
        '......hhhhhHhhhhhhHhhhhhhh......',
        '......hhhhhhhhhhhhhhhhhhhhh.....',
        '......hhhhhhhhhhhhhhhhhhhhhh....',
        '......hhhhhhhhhhhhhhhhhhhhhh....',
        '......hhhhhhhhhhhh.hhhhhhhhh....',
        '.......hhhhhhhhh....hhh.hhhh....',
        '.......hhhhhh..h.....h....hh....',
        '.......hhhh...............h.....',
        '.......hhh......................',
        '.......hhh......................',
        '........h.......................',
      ]);
      g.rect(13, 23, 18, 24, 'a');
      g.rect(14, 25, 17, 26, 'a');
      // Crossbow held forward.
      g.rect(20, 31, 30, 32, 'w');
      g.line(28, 26, 28, 37, 'x');
      g.line(29, 27, 29, 36, 'X');
      g.line(28, 26, 21, 31, 'X');
      g.line(28, 37, 21, 32, 'X');
      return shadeGrid(g, { ...SKIN, h: '#f8d858', y: '#f8d858', H: '#c89830', r: '#f06080', c: '#f4f4fc', d: '#f4f4fc', a: '#3c78e0', l: '#3c78e0', p: '#f0f0f8', q: '#f0f0f8', b: '#8c5cc8', o: '#8c5cc8', w: '#9c6030', x: '#b0b8c8', X: '#e0e0e0' }, 'eEmH');
    },
    lucca() {
      const g = humanBase({ sleeves: 'short' });
      g.text(0, 0, [
        '................................',
        '................................',
        '................................',
        '...........vvvvvvvvvv...........',
        '.........vvvvvvvvvvvvvv.........',
        '........vvvvvLvvvvvvvvvv........',
        '.......vvvvvLvvvvvvvvvvvv.......',
        '.......vvvvLvvvvvvvvvvvvv.......',
        '......vvvvvvvvvvvvvvvvvvvvv.....',
        '.....GGGGGGGGGGGGGGGGGGGGGGG....',
        '......hhhhhhhhhhhhhhhhhhhhh.....',
        '......hhhhhhhhhhh.hhhhhhhh......',
        '.......hhhhhhh......hh..hh......',
        '.......hhhh.....................',
        '.......hhh......................',
        '.......hhh......................',
        '.......hhh......................',
        '........hh......................',
      ]);
      // Round glasses over the eyes.
      g.text(13, 13, ['kkkk.kkkk', 'kggk.kggk', 'kgEkkkgEk', 'kggk.kggk', 'kkkk.kkkk']);
      g.px(15, 15, 'g');
      g.px(20, 15, 'g');
      g.rect(10, 31, 21, 32, 'l');
      // Air gun.
      g.rect(23, 30, 30, 32, 'x');
      g.rect(28, 29, 30, 29, 'X');
      g.rect(23, 33, 24, 35, 'w');
      return shadeGrid(g, { ...SKIN, v: '#3c9c48', L: '#84d070', G: '#26682e', h: '#8c5cc8', c: '#ec8c34', d: '#ec8c34', l: '#6c4020', p: '#3c9c48', q: '#3c9c48', b: '#7c4c2c', o: '#7c4c2c', g: '#a8e0f8', x: '#a8a8b8', X: '#686878', w: '#6c4020' }, 'eEmLkg');
    },
    ayla() {
      const g = humanBase({});
      // Big wild mane behind the body.
      g.ell(6, 20, 5, 10, 'h');
      g.text(0, 0, [
        '..........h....h..h.............',
        '.........hh...hh.hh...h.........',
        '......h.hhhh.hhhhhh..hh.........',
        '.....hhhhhhhhhhhhhhhhhhh.h......',
        '....hhhhhhhhhhhhhhhhhhhhhhh.....',
        '...hhhhhhHhhhhhhhHhhhhhhhhhh....',
        '..hhhhhhhhhHhhhhhhhhhhhhhhhhh...',
        '.hhhhhhhhhhhhhhhhhHhhhhhhhhhhh..',
        '..hhhhhhhhhhhhhhhhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhhhhhhhhhhhhhhhh..',
        '..hhhhhhhhhhhhhhhhhhhhhhhhhhh...',
        '.hhhhhhhhhhhhhh.hhhhhh.hhhhhh...',
        '..hhhhhhhhh.h.....hh.....hhh....',
        '.hhhhhhhh.................hh....',
        '..hhhhhhh..................h....',
        '.hhhhhhh........................',
        '..hhhhhhh.......................',
        '.hhhhhhh........................',
        '..hhhhhh........................',
        '.hhhhhhh........................',
        '..hhhhhh........................',
        '...hhhh.........................',
      ]);
      // Fur top, bare midriff, fur skirt, bare legs.
      g.rect(10, 29, 21, 30, 't');
      g.text(10, 33, ['pppppppppppp', 'pppppppppppp', 'pppppppppppp', 'p.pp.p.pp.p.']);
      g.rect(10, 37, 14, 39, 'L');
      g.rect(17, 37, 21, 39, 'M');
      g.rect(10, 31, 21, 32, 'p');
      for (const [x, y] of [[12, 25], [16, 27], [19, 24], [14, 33], [18, 34], [11, 35], [20, 33]]) g.px(x, y, 'D');
      return shadeGrid(g, { ...SKIN, h: '#f8dc60', H: '#c89c30', c: '#e8a040', l: '#e8a040', p: '#e8a040', q: '#e8a040', D: '#7c4818', L: '#f4c49a', M: '#f4c49a', b: '#c07838', o: '#c07838' }, 'eEmHD');
    },
    slash() {
      const g = humanBase({ sleeves: 'long' });
      g.text(0, 0, [
        '................................',
        '................................',
        '................................',
        '..............hhhhh.............',
        '...........hhhhhhhhhhh..........',
        '.........hhhhhhhhhhhhhhh........',
        '.......hhhhhHhhhhhhHhhhhh.......',
        '.....hhhhhhhhHhhhhhhhhhhhh......',
        '...hhhhhhhhhhhhhhhhhhhhhhhh.....',
        '..hhhhhhhhhhhhhhhhhhhhhhhhhh....',
        '...hhhhhhhhhhhhhhhhhhhhhhhhh....',
        '....hhhhhhhhhhhhhhhhhhhhhhh.....',
        '...hhhhhhhhhhh..................',
        '....hhhhhhhh....................',
        '...hhhhhhhh.....................',
        '....hhhhhhh.....................',
        '.....hhhhhh.....................',
        '......hhhhh.....................',
        '.......hhhh.....................',
        '........hh......................',
      ]);
      g.text(14, 13, ['eee.eee']);
      // White coat with red sash.
      g.rect(14, 24, 17, 31, 'a');
      g.rect(10, 31, 21, 32, 'a');
      // Long sword raised high.
      g.line(24, 32, 31, 3, 'x');
      g.line(25, 32, 31, 6, 'X');
      g.rect(21, 31, 27, 32, 'g');
      return shadeGrid(g, { ...SKIN, s: '#6c98d4', A: '#6c98d4', n: '#4c70a8', S: '#4c70a8', e: '#f8e040', E: '#201830', h: '#f0f0f8', H: '#b0b8d0', c: '#e8e8f0', d: '#e8e8f0', a: '#d03444', l: '#d03444', p: '#34344c', q: '#34344c', b: '#5c3420', o: '#5c3420', x: '#e8f0ff', X: '#98a8c0', g: '#e8c040' }, 'eEmHX');
    },
    magus() {
      const g = humanBase({ sleeves: 'long' });
      // Long hair down the back.
      g.ell(8, 20, 4, 11, 'h');
      g.ell(7, 30, 3, 5, 'h');
      // Cape swallows the body.
      g.text(3, 22, [
        '....ccccccccccccccccc....',
        '...cccvvvvvvvvvvvvvvcc...',
        '..cccvvvccccccccccvvvcc..',
        '..ccvvcccccccccccccvvccc.',
        '.cccvcccccccccccccccvccc.',
        '.ccvvccccccCccccccccvvcc.',
        '.ccvcccccccCcccccccccvcc.',
        'cccvccccccCccccccccccvccc',
        'ccvvcccccCccccccccccccvcc',
        'ccvccccccCccccccccccccvcc',
        'ccvcccccCcccccccccccccvvc',
        'cvvcccccCccccccccccccccvc',
        'cvccccccCccccccccccccccvc',
        'cvcccccCcccccccccccccccvc',
        'cvcccccCccccccccccccccvvc',
        'cvvccccccccccccccccccvvcc',
        'ccvvvvvvvvvvvvvvvvvvvvcc.',
        '.cccccccccccccccccccccc..',
        '..bbbbb.......ooooo......',
        '..bbbbb.......ooooo......',
      ]);
      g.text(0, 2, [
        '................................',
        '..........hhhhhhhhhh............',
        '........hhhhhhhhhhhhhh..........',
        '.......hhhhhHhhhhhhhhhhh........',
        '......hhhhhHhhhhhhhHhhhhh.......',
        '......hhhhhhhhhhhhhhhhhhhh......',
        '......hhhhhhhhhhhhhhhhhhhhh.....',
        '......hhhhhhhhhhhhhhhhhhhhh.....',
        '......hhhhhhhhhhhhh.hhhhhhh.....',
        '......hhhhhhhhhhh....hh..hh.....',
        '......hhhhhhhh.h.....h....h.....',
        '......hhhhhhh...................',
        '......hhhhhh....................',
        '......hhhhhh....................',
      ]);
      // Scythe: long haft with a curved blade at the top.
      g.line(27, 43, 28, 5, 'w');
      g.text(12, 2, ['..xxxxxxxxxxxxxxX', '.xxXXXXXXXXXXXXxX', 'xxX...........Xk.', 'xX..............', 'x...............']);
      g.rect(24, 30, 27, 32, 'A');
      return shadeGrid(g, { ...SKIN, s: '#ecdcf4', A: '#ecdcf4', n: '#c0acd0', S: '#c0acd0', e: '#d02838', h: '#7c9cec', H: '#4c64b8', c: '#2c2440', C: '#1a1428', v: '#8448c0', b: '#3c3050', o: '#3c3050', w: '#6c4c34', x: '#e0e0ec', X: '#8c8ca4' }, 'eEmHCX');
    },
    flea() {
      const g = humanBase({ sleeves: 'long' });
      g.ell(9, 22, 5, 10, 'h');
      g.text(0, 1, [
        '................................',
        '..........hhhhhhhhhh............',
        '........hhhhhhhhhhhhhh..........',
        '.......hhhhhHhhhhhhhhhhh........',
        '......hhhhhHhhhhhhhHhhhhh.......',
        '......hhhhhhhhhhhhhhhhhhhh......',
        '.....hhhhhhhhhhhhhhhhhhhhhh.....',
        '.....hhhhhhhhhhhhhhhhhhhhhh.....',
        '.....hhhhhhhhhhhhhhhhhhhhhhh....',
        '.....hhhhhhhhhhhh..hhhhhhhhh....',
        '.....hhhhhhhhhh.....h....hhh....',
        '.....hhhhhhhh.............hh....',
        '.....hhhhhhh...............h....',
      ]);
      g.rect(21, 7, 23, 9, 'r');
      // Long flared dress.
      g.text(8, 30, [
        '..cccccccccccc..',
        '..cccccccccccc..',
        '.ccccccCcccccccc',
        '.cccccCccccccccc',
        '.ccccCcccccCcccc',
        'cccccCcccccCccccc',
        'ccccCccccccCccccc',
        'ccccCcccccccCcccc',
        'ccccccccccccccccc',
        'rrrrrrrrrrrrrrrrr',
      ]);
      g.rect(13, 23, 18, 25, 'r');
      g.rect(10, 40, 13, 42, 'b');
      g.rect(18, 40, 21, 42, 'o');
      g.px(15, 16, 'm');
      return shadeGrid(g, { ...SKIN, s: '#f8d4c4', A: '#f8d4c4', h: '#f888c4', H: '#c8488c', e: '#6824a8', c: '#9c4cd0', C: '#6c2c98', d: '#9c4cd0', l: '#9c4cd0', r: '#f8e060', b: '#6c2c98', o: '#6c2c98' }, 'eEmHC');
    },
    robo() {
      const g = new Grid(W, H);
      // Back arm, legs, torso, head, front arm.
      g.rect(4, 22, 8, 33, 'u');
      g.rect(3, 33, 8, 37, 'j');
      g.rect(10, 34, 14, 39, 'p');
      g.rect(17, 34, 21, 39, 'q');
      g.rect(8, 40, 14, 43, 'b');
      g.rect(17, 40, 23, 43, 'o');
      g.ell(15.5, 27, 8, 8, 'c');
      g.rect(11, 25, 20, 29, 'm');
      g.rect(12, 26, 13, 28, 'e');
      g.rect(18, 26, 19, 28, 'a');
      g.rect(9, 33, 22, 34, 'l');
      g.rect(13, 16, 18, 19, 'n');
      g.ell(15.5, 10, 8, 7, 'h');
      g.rect(9, 9, 23, 13, 'v');
      g.text(15, 10, ['ee...ee', 'ee...ee']);
      g.rect(15, 1, 16, 3, 'm');
      g.ell(15.5, 1, 1.5, 1.2, 'a');
      g.rect(23, 22, 27, 33, 'w');
      g.rect(23, 33, 28, 37, 'z');
      g.rect(24, 21, 26, 22, 'm');
      return shadeGrid(g, { h: '#e8b040', c: '#e8b040', u: '#c89030', w: '#e8b040', j: '#9ca4b0', z: '#9ca4b0', v: '#34344c', e: '#f83c28', a: '#60d0f8', m: '#9ca4b0', n: '#6c7480', l: '#6c7480', p: '#c89030', q: '#c89030', b: '#6c7480', o: '#6c7480' }, 'ea');
    },
    ozzie() {
      const g = new Grid(W, H);
      // Cape behind.
      g.ell(15.5, 29, 14, 12, 'v');
      g.rect(5, 29, 26, 42, 'v');
      g.ell(15.5, 28, 11.5, 11, 'c');
      g.ell(16.5, 31, 7, 7, 'y');
      g.ell(15.5, 13, 9, 8, 'c');
      // Face.
      g.text(11, 9, ['EEE..EEE', 'EeE..EeE', 'EEE..EEE']);
      g.text(12, 15, ['mmmmmmm', 'mwmwmwm', '.mmmmm.']);
      g.rect(8, 20, 23, 21, 'r');
      g.rect(10, 39, 14, 42, 'b');
      g.rect(17, 39, 21, 42, 'o');
      g.ell(4, 30, 2.5, 3, 'A');
      g.ell(27, 30, 2.5, 3, 'B');
      return shadeGrid(g, { c: '#8cbc54', y: '#c8e088', v: '#6444a4', E: '#f8f8f8', e: '#181818', m: '#6c1c24', w: '#f8f8f8', r: '#f0c848', b: '#7c5ca8', o: '#7c5ca8', A: '#8cbc54', B: '#8cbc54' }, 'Eemw');
    },
    hench() {
      const g = new Grid(W, H);
      // Horns, head, body.
      g.line(9, 5, 11, 11, 'w', 2);
      g.line(22, 5, 20, 11, 'w', 2);
      g.rect(7, 25, 9, 33, 'A');
      g.rect(11, 34, 14, 39, 'p');
      g.rect(17, 34, 20, 39, 'q');
      g.rect(10, 40, 14, 42, 'b');
      g.rect(17, 40, 21, 42, 'o');
      g.ell(15.5, 29, 6, 6, 'c');
      g.rect(10, 32, 21, 35, 'l');
      g.ell(15.5, 17, 9, 8, 's');
      g.text(10, 13, ['EEE...EEE', 'EeE...EeE']);
      g.text(11, 20, ['mmmmmmmmm', 'mwm.m.mwm']);
      g.rect(22, 25, 24, 33, 'B');
      // Axe.
      g.line(26, 38, 26, 14, 'x');
      g.text(26, 13, ['.zzzz', 'zzzzzz', 'zzzzzz', '.zzzz']);
      g.rect(23, 30, 27, 31, 'B');
      return shadeGrid(g, { s: '#5480cc', A: '#5480cc', B: '#5480cc', c: '#5480cc', w: '#ece4c8', E: '#f8e020', e: '#e02020', m: '#301838', l: '#8c4cac', p: '#4868b0', q: '#4868b0', b: '#34304c', o: '#34304c', x: '#7c5434', z: '#b8c0cc' }, 'Eemw');
    },
  };

  // ---- Sprite registry ------------------------------------------------------------
  function flashOf(src) {
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const g = cv.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }
  function mirror(src) {
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const g = cv.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return cv;
  }
  // Opaque bounding box, used to anchor sprites by their feet.
  function bbox(cv) {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++)
        if (d[(y * cv.width + x) * 4 + 3] > 20) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    return { x0, y0, x1, y1 };
  }
  function frameOf(cv) {
    const b = bbox(cv);
    return { img: cv, flash: flashOf(cv), footY: b.y1 + 1, top: b.y0, cx: cv.width / 2, box: b };
  }

  const cache = {};
  const DIRS = ['south-east', 'south-west', 'north-east', 'north-west', 'south'];

  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = im.width;
        cv.height = im.height;
        cv.getContext('2d').drawImage(im, 0, 0);
        res(cv);
      };
      im.onerror = rej;
      im.src = src;
    });
  }

  // Load baked PixelLab exports. Resolves once every image is decoded.
  CT.loadAssets = async function () {
    const assets = CT.ASSETS || {};
    for (const key of Object.keys(assets)) {
      const frames = {};
      for (const dir of DIRS) {
        const src = assets[key].rotations[dir];
        if (src) frames[dir] = frameOf(await loadImage(src));
      }
      cache[key] = { frames, hiRes: true };
    }
  };

  CT.getSprite = function (key) {
    if (!cache[key]) {
      const built = BUILDERS[key]();
      // Builders return one front-facing canvas, or { se, ne } front & back views.
      const se = built.se || built;
      const ne = built.ne || se;
      const r = frameOf(se);
      const br = frameOf(ne);
      cache[key] = {
        frames: { 'south-east': r, 'south-west': frameOf(mirror(se)), 'north-east': br, 'north-west': frameOf(mirror(ne)), south: r },
      };
    }
    return cache[key];
  };

  // Head-and-shoulders portrait for the HUD, as a data URL.
  const portraitCache = {};
  CT.portrait = function (key) {
    if (!portraitCache[key]) {
      const f = CT.getSprite(key).frames.south || CT.getSprite(key).frames['south-east'];
      const size = 30;
      const scale = 4;
      const cv = document.createElement('canvas');
      cv.width = size * scale;
      cv.height = size * scale;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      if (CT.getSprite(key).hiRes) {
        // Detailed art: frame the whole figure rather than cropping the head.
        const b = f.box;
        const side = Math.max(b.x1 - b.x0, b.y1 - b.y0) + 3;
        const cx = (b.x0 + b.x1 + 1) / 2;
        const cy = (b.y0 + b.y1 + 1) / 2;
        g.drawImage(f.img, Math.round(cx - side / 2), Math.round(cy - side / 2), side, side, 0, 0, size * scale, size * scale);
      } else {
        const sx = Math.round(f.cx - size / 2);
        const sy = Math.max(0, f.top - 1);
        g.drawImage(f.img, sx, sy, size, size, 0, 0, size * scale, size * scale);
      }
      portraitCache[key] = cv.toDataURL();
    }
    return portraitCache[key];
  };

  // ---- Decorations -------------------------------------------------------------------
  function buildTree(seed) {
    const g = new Grid(44, 58);
    const rnd = (() => {
      let s = seed * 9301 + 49297;
      return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    })();
    g.rect(19, 38, 24, 55, 't');
    g.rect(16, 53, 27, 56, 't');
    g.line(21, 42, 13, 34, 't', 2);
    g.line(23, 40, 30, 33, 't', 2);
    const blobs = [[22, 22, 15, 14, 'a']];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd();
      blobs.push([22 + Math.cos(a) * 11, 22 + Math.sin(a) * 10 - 2, 6 + rnd() * 4, 5 + rnd() * 3, 'abcd'[i % 4]]);
    }
    blobs.push([18, 13, 7, 6, 'b'], [26, 12, 6, 5, 'c']);
    for (const [x, y, rx, ry, c] of blobs) g.ell(x, y, rx, ry, c);
    for (let i = 0; i < 14; i++) g.px(10 + rnd() * 24, 8 + rnd() * 26, 'L');
    return shadeGrid(g, { t: '#7c5030', a: '#3c8c3c', b: '#46a044', c: '#3c8c3c', d: '#347c38', L: '#8cd070' }, 'L');
  }
  function buildRock() {
    const g = new Grid(28, 18);
    g.ell(13, 10, 12, 7, 'r');
    g.ell(9, 8, 6, 4, 'q');
    g.ell(19, 11, 6, 5, 's');
    g.px(12, 6, 'L');
    g.px(7, 7, 'L');
    return shadeGrid(g, { r: '#9c9ca8', q: '#b4b4c0', s: '#8c8c98', L: '#e0e0e8' }, 'L');
  }
  const decorCache = {};
  CT.getDecor = function (key, variant = 0) {
    const k = key + variant;
    if (!decorCache[k]) decorCache[k] = key === 'tree' ? buildTree(variant + 1) : buildRock();
    return decorCache[k];
  };
})();
