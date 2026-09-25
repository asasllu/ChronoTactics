// sprites_cast.js — content module (see docs/ENGINE_SPEC.md §2).
// Story cast sprites: antagonists, enemies, NPCs, villagers and props, all
// composed on CT.PX letter grids and run through the hi-res outline + cel
// shading pass so they sit alongside the 48×48 PixelLab exports.
//
// Grid conventions for 48×48 humanoids (3/4 view, light from the top-left):
//   head centre ~(25,11), feet on rows 45-46, figure ~41px tall.
//   `se` = front 3/4 facing screen-right-down, `ne` = back 3/4 facing
//   screen-right-up. Left-facing views are mirrored by the engine.
(function () {
  const CT = (window.CT = window.CT || {});
  const { Grid, shadeGrid, hex, mix } = CT.PX;
  const reg = (key, fn) => CT.registerSprite(key, fn);

  // ---- Helpers ------------------------------------------------------------------
  // Horizontal spans: [[y, x0, x1], ...]
  const spans = (g, list, c) => list.forEach(([y, x0, x1]) => g.rect(x0, y, x1, y, c));
  // Tapering vertical shape: from y0 (x0a..x1a) to y1 (x0b..x1b).
  function taper(g, y0, y1, x0a, x1a, x0b, x1b, c) {
    for (let y = y0; y <= y1; y++) {
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      g.rect(Math.round(x0a + (x0b - x0a) * t), y, Math.round(x1a + (x1b - x1a) * t), y, c);
    }
  }
  const at = (g, x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? '.' : g.a[y][x]);
  // Post-process: tint the pixels around every cell of `letters` towards a glow
  // colour (only where the sprite is already opaque, so the anchor is unchanged).
  function glow(cv, g, letters, color, strength = 0.45, radius = 2) {
    const ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    const col = hex(color);
    const W = cv.width;
    const add = new Float32Array(W * cv.height);
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (!letters.includes(g.a[y][x])) continue;
        for (let dy = -radius; dy <= radius; dy++)
          for (let dx = -radius; dx <= radius; dx++) {
            const dist = Math.hypot(dx, dy);
            if (dist === 0 || dist > radius + 0.3) continue;
            const X = x + 1 + dx;
            const Y = y + 1 + dy;
            if (X < 0 || Y < 0 || X >= W || Y >= cv.height) continue;
            const k = strength * (1 - (dist - 1) / (radius + 0.5));
            const i = Y * W + X;
            add[i] = Math.max(add[i], k);
          }
      }
    for (let i = 0; i < add.length; i++) {
      if (!add[i] || !d[i * 4 + 3]) continue;
      const gx = i % W - 1;
      const gy = Math.floor(i / W) - 1;
      if (letters.includes(at(g, gx, gy))) continue;
      const m = mix([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], col, Math.min(0.85, add[i]));
      d[i * 4] = m[0];
      d[i * 4 + 1] = m[1];
      d[i * 4 + 2] = m[2];
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  // Post-process: paint pixels of grid cells (letters) with fn(x, y, rgba) -> rgba|null.
  function paint(cv, g, letters, fn) {
    const ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (!letters.includes(g.a[y][x])) continue;
        const i = ((y + 1) * cv.width + (x + 1)) * 4;
        const r = fn(x, y, [d[i], d[i + 1], d[i + 2], d[i + 3]]);
        if (r) for (let k = 0; k < 4; k++) d[i + k] = r[k] === undefined ? d[i + k] : r[k];
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  // Deterministic hash noise.
  const rnd = (x, y, s = 0) => {
    let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // shadeGrid + a stronger ink line on material seams (closer to the dark
  // internal linework of the PixelLab references).
  function shade(g, pal, detail = '', ink = 0.4) {
    const cv = shadeGrid(g, pal, detail, true);
    if (!ink) return cv;
    const isD = (c) => c === '.' || detail.includes(c);
    return paint(cv, g, Object.keys(pal).join('') + 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', (x, y, c) => {
      const a = g.a[y][x];
      if (isD(a) || a === 'k') return null;
      const r = at(g, x + 1, y);
      const d = at(g, x, y + 1);
      if ((!isD(r) && r !== a) || (!isD(d) && d !== a)) return [...mix(c.slice(0, 3), CT.PX.OUTLINE, ink), 255];
      return null;
    });
  }

  // Skin tones used across the cast.
  const SKIN = { s: '#f4c9a4', S: '#d59a78', n: '#d9a584', A: '#f4c9a4', F: '#f4c9a4', e: '#221a30', E: '#ffffff', m: '#a0504c', k: '#1c1024' };

  // ---- Standard humanoid body (48×48) ---------------------------------------------
  // Parts can be switched off / restyled through `o`:
  //   o.farArm / o.nearArm: 'long' | 'short' | 'bare' | false
  //   o.legs: 'pants' | 'bare' | false ; o.boots: true/false
  //   o.nearHand: [x, y] hand position (arm bends towards it)
  function figure(g, o = {}) {
    const back = !!o.back;
    // Far arm (screen-left), behind the torso.
    if (o.farArm !== false) {
      const fa = o.farArm || 'long';
      g.rect(17, 19, 19, 25, fa === 'bare' ? 'A' : 'd');
      g.rect(17, 25, 19, 28, fa === 'long' ? 'd' : 'A');
      if (fa === 'long') g.rect(17, 28, 19, 28, 'd');
      g.ell(18, 29.6, 1.5, 1.3, 'A');
    }
    // Legs.
    if (o.legs !== false) {
      const bare = o.legs === 'bare';
      g.rect(20, 29, 29, 31, 'p');
      g.rect(20, 32, 23, 41, 'p');
      g.rect(25, 32, 28, 41, 'q');
      if (bare) {
        g.rect(20, 33, 23, 41, 'L');
        g.rect(25, 33, 28, 41, 'M');
      }
      if (o.boots !== false) {
        g.rect(19, 41, 23, 44, 'b');
        g.rect(19, 45, 23, 45, 'B');
        g.rect(25, 41, 29, 45, 'o');
        g.rect(29, 43, 30, 45, 'o');
        g.rect(25, 46, 30, 46, 'B');
      }
    }
    // Torso.
    spans(g, [[18, 21, 28], [19, 20, 29], [20, 20, 29], [21, 20, 29], [22, 20, 29], [23, 20, 29], [24, 21, 28], [25, 21, 28], [26, 21, 28], [27, 20, 29], [28, 20, 29]], 'c');
    if (o.belt !== false) g.rect(20, 27, 29, 28, 'l');
    // Near arm (screen-right).
    if (o.nearArm !== false) {
      const na = o.nearArm || 'long';
      const [hx, hy] = o.nearHand || [31.5, 29.6];
      g.rect(30, 19, 32, 24, na === 'bare' ? 'F' : 'D');
      g.line(31, 24, hx, hy - 1.5, na === 'long' ? 'D' : 'F', 2);
      g.line(30.5, 24, hx - 1, hy - 1.5, na === 'long' ? 'D' : 'F', 2);
      g.ell(hx, hy, 1.6, 1.4, 'F');
    }
    // Neck & head.
    g.rect(23, 15, 26, 18, 'n');
    g.ell(25, 11, 5, 5.5, 's');
    if (!back) {
      // Jaw towards the facing side.
      g.rect(24, 16, 28, 16, 's');
    }
  }
  // Standard face (se): eyes, brows, ear, mouth. style: {eyes:'e'|..., brow:'k'}
  function face(g, o = {}) {
    if (o.ear !== false) g.rect(21, 11, 21, 13, 'S'); // ear
    const brow = o.brow || 'k';
    if (o.closed) {
      g.rect(23, 12, 24, 12, 'e');
      g.rect(27, 12, 29, 12, 'e');
    } else {
      g.px(23, 10, brow);
      g.px(24, 10, brow);
      g.rect(27, 10, 29, 10, brow);
      g.rect(23, 11, 24, 12, 'e');
      g.rect(28, 11, 29, 12, 'e');
      g.px(24, 11, o.eyeHi || 'E');
      g.px(29, 11, o.eyeHi || 'E');
      if (o.iris) {
        g.px(23, 12, o.iris);
        g.px(28, 12, o.iris);
      }
    }
    g.px(30, 13, 'S'); // nose shade
    g.rect(27, 15, 28, 15, 'm');
  }

  // =================================================================================
  // ISELLE, THE WARDEN
  // =================================================================================
  const ISELLE_PAL = {
    ...SKIN,
    s: '#f2d6c4', A: '#f2d6c4', F: '#eef2f8', S: '#d4a894', n: '#dcb8a6',
    h: '#dde2ec', H: '#8490aa', R: '#ffffff', J: '#aeb8cc',
    Q: '#f6f8fc', P: '#eef2f8', g: '#4cc4ff', G: '#b4f4ff',
    e: '#2c2438', m: '#b8707a',
    c: '#6a707e', d: '#6a707e', D: '#6a707e', t: '#656b79', T: '#4c5260', C: '#565c6a', v: '#aab2c0', i: '#262a38', f: '#434856', L: '#2a2632',
    l: '#3a3444', y: '#c8d2e0', p: '#302c3a', q: '#302c3a', b: '#23212c', o: '#23212c', B: '#15131b',
    z: '#8fcfe6', Z: '#dcf6ff', x: '#bdeefc', X: '#ffffff', j: '#46505e',
  };
  function halberd(g, top = 0) {
    // Glass halberd "Ledger": spear tip, crescent axe blade (facing side), back spike.
    g.spike(37, 5 + top, 37, top, 3, 'x');
    spans(g, [[2, 44, 44], [3, 43, 44], [4, 42, 44], [5, 41, 45], [6, 40, 45], [7, 38, 45], [8, 38, 45], [9, 38, 45], [10, 38, 45], [11, 40, 45], [12, 41, 45], [13, 42, 44], [14, 43, 44], [15, 44, 44]].map(([y, a, b]) => [y + top, a, b]), 'x');
    g.line(44, 3 + top, 45, 6 + top, 'X');
    g.line(45, 7 + top, 45, 11 + top, 'X');
    g.line(45, 12 + top, 44, 14 + top, 'X');
    g.spike(36, 9 + top, 33, 7 + top, 3, 'x');
    g.rect(36, 4 + top, 37, 16 + top, 'j');
  }
  function bladeText(cv, g) {
    // Faint lines of "text" scrolling down the glass blade.
    return paint(cv, g, 'x', (x, y, c) => {
      if (x > 38 && x < 44 && y > 5 && y < 13 && y % 2 === 0 && rnd(x, y, 7) < 0.6) return [...mix(c.slice(0, 3), [150, 240, 255], 0.7), 255];
      return null;
    });
  }
  function iselleFig(back) {
    const g = new Grid(48, 48);
    const P = ISELLE_PAL;
    // Glass halberd shaft (behind the hand).
    g.line(31, 45, 37, 3, 'z');
    g.line(32, 45, 38, 3, 'Z');
    // Far arm: screen-left. Front view = her right (human, sleeved); back view = her left (porcelain).
    g.rect(17, 19, 19, 26, 'd');
    if (!back) {
      g.rect(17, 27, 19, 27, 'v');
      g.ell(18, 29, 1.5, 1.5, 'A');
    } else {
      g.rect(17, 23, 19, 27, 'P');
      g.ell(18, 29, 1.5, 1.5, 'P');
      g.px(18, 23, 'g');
      g.px(19, 25, 'g');
      g.px(17, 27, 'g');
    }
    // Long coat skirt with folds and a front split.
    for (let y = 28; y <= 42; y++) {
      const t = y - 28;
      g.rect(Math.round(20 - t * 0.28), y, Math.round(29 + t * 0.22), y, 't');
    }
    // Boots below the hem.
    g.rect(20, 43, 23, 45, 'b');
    g.rect(19, 45, 23, 45, 'B');
    g.rect(26, 43, 29, 45, 'o');
    g.rect(30, 44, 30, 45, 'o');
    g.rect(26, 46, 30, 46, 'B');
    g.rect(16, 42, 32, 42, 'T');
    if (!back) {
      for (let y = 29; y <= 42; y++) g.rect(27 + Math.round((y - 29) / 8), y, 27 + Math.round((y - 29) / 4), y, 'i');
      g.line(22, 31, 20, 41, 'f');
      g.line(24, 33, 24, 41, 'f');
    } else {
      g.line(24, 29, 24, 42, 'f');
      g.line(21, 32, 19, 41, 'f');
      g.line(27, 32, 29, 41, 'f');
    }
    // Torso (coat).
    spans(g, [[18, 21, 28], [19, 19, 30], [20, 19, 30], [21, 19, 30], [22, 19, 30], [23, 20, 29], [24, 20, 29], [25, 20, 29], [26, 20, 29], [27, 21, 28]], 'c');
    g.rect(20, 27, 29, 28, 'l');
    if (!back) {
      g.tri(25, 18, 29, 18, 27, 25, 'i');
      g.line(26, 19, 27, 25, 'v');
      g.rect(26, 27, 27, 28, 'y');
      g.line(29, 19, 21, 27, 'L');
      g.rect(21, 16, 22, 19, 'C');
      g.rect(28, 16, 30, 19, 'C');
      // Near arm (her left): porcelain below a short coat cap.
      g.rect(30, 19, 32, 21, 'D');
      g.rect(30, 22, 32, 24, 'P');
      g.line(31, 25, 32, 27, 'P', 2);
      g.ell(32.5, 29, 1.6, 1.5, 'P');
      g.px(30, 22, 'g');
      g.px(31, 22, 'g');
      g.px(32, 24, 'g');
      g.px(31, 26, 'g');
      g.px(33, 28, 'g');
      g.rect(30, 21, 32, 21, 'v');
    } else {
      g.rect(21, 16, 29, 19, 'C');
      g.line(24, 20, 24, 26, 'f');
      g.rect(22, 27, 22, 28, 'y');
      g.rect(26, 27, 26, 28, 'y');
      g.rect(30, 19, 32, 26, 'D');
      g.rect(30, 27, 32, 27, 'v');
      g.ell(32.5, 29, 1.6, 1.5, 'F');
    }
    // Head.
    if (!back) {
      g.text(18, 2, [
        '....hhhh......',
        '..hhhhhhhhh...',
        '.hhhhhhhRRhhh.',
        '.hhhhhhRRhhhhh',
        'hhhhhHhhhhhhhh',
        'hhhhHhhhhhHhhh',
        'hhhHhhhhhHhhhh',
        'hhHhhhhhHhhhHh',
        'JHhhshhshQhQhh',
        'JHhhskksgQkkQh',
        'JJHhseEsgQGXQh',
        'JJHhsssssgQQQJ',
        'JJJHssssgQQQQJ',
        '.JJhsssmgQQQ.J',
        '.J.J.sssgQQ...',
        '......nnnn....',
      ]);
    } else {
      g.text(18, 2, [
        '....hhhh......',
        '..hhhhhhhhh...',
        '.hhhhRRhhhhh..',
        '.hhhRRhhhhhhh.',
        'hhhhhhhhHhhhhh',
        'hhHhhhhHhhhHhh',
        'hHhhhhHhhhhHhh',
        'hHhhhhHhhhhhHh',
        'JHhhhhHhhhhhHJ',
        'JhHhhhHhhhHhhJ',
        'JJHhhhhHhhHhJJ',
        'JJHJhhhHhhHJJJ',
        '.JHJJhHJJHJJJ.',
        '.J.JHJJ.JHJ.J.',
        '...h.QgnnQ....',
        '......nnnn....',
      ]);
    }
    halberd(g);
    // Near hand grips the shaft.
    g.ell(32.5, 29, 1.6, 1.5, back ? 'F' : 'P');
    const cv = shade(g, { ...P, F: back ? '#f2d6c4' : P.F }, 'eEmHRkgGXvyjfJL');
    glow(cv, g, 'gG', '#7ad8ff', 0.32, 1);
    bladeText(cv, g);
    paint(cv, g, 'zZ', (x, y, c) => [c[0], c[1], c[2], 225]);
    return cv;
  }
  reg('iselle', () => ({ se: iselleFig(false), ne: iselleFig(true) }));

  // =================================================================================
  // SEEDBEARER — faceless porcelain automaton
  // =================================================================================
  const SEED_PAL = {
    w: '#f2f4f8', W: '#e8ecf2', u: '#e2e6ee', a: '#eceff5', f: '#e6eaf0', T: '#e9ecf2', U: '#e2e6ec',
    r: '#dfe3ea', R: '#e6e9ef', j: '#3a4254', g: '#4cc4ff', G: '#c4f6ff', k: '#1c1024', s: '#9aa4b8',
  };
  function seedFig(back) {
    const g = new Grid(48, 48);
    // Far arm (thin, jointed), reaching slightly forward.
    g.rect(18, 19, 19, 24, 'r');
    g.ell(18.5, 25, 1.2, 1, 'j');
    g.line(19, 26, 21, 29, 'r', 2);
    g.ell(21.5, 30, 1.4, 1.2, 'r');
    // Legs: long thin segments with glowing joints.
    g.rect(21, 30, 28, 31, 'u');
    g.rect(21, 32, 23, 37, 'T');
    g.rect(25, 32, 27, 37, 'T');
    g.ell(22, 38, 1.3, 1, 'j');
    g.ell(26, 38, 1.3, 1, 'j');
    g.rect(21, 39, 23, 44, 'U');
    g.rect(25, 39, 27, 45, 'U');
    g.rect(20, 45, 23, 45, 's');
    g.rect(25, 46, 29, 46, 's');
    g.rect(28, 45, 29, 45, 'U');
    // Torso: sculpted chest plate, narrow waist, pelvis plate.
    spans(g, [[18, 21, 28], [19, 20, 29], [20, 20, 29], [21, 20, 29], [22, 21, 29], [23, 21, 28], [24, 22, 28]], 'W');
    spans(g, [[25, 22, 27], [26, 22, 27], [27, 23, 27]], 'j');
    spans(g, [[28, 21, 28], [29, 21, 28]], 'u');
    // Near arm: shoulder cap, upper arm, glowing elbow, forearm forward, cupped hand.
    g.ell(30, 20, 2, 1.8, 'a');
    g.rect(30, 21, 31, 24, 'a');
    g.ell(30.5, 25, 1.2, 1, 'j');
    g.line(30, 26, 29, 29, 'f', 2);
    g.ell(28.5, 30, 1.5, 1.2, 'f');
    // Neck & head: smooth egg, featureless but for a lit slit.
    g.rect(24, 15, 25, 17, 'j');
    g.ell(25, 10, 4.2, 5.5, 'w');
    if (!back) {
      g.rect(25, 10, 29, 10, 'g');
      g.px(29, 10, 'G');
      g.line(27, 12, 28, 14, 'r');
    } else {
      g.line(24, 6, 24, 14, 'j');
    }
    // Seam light lines across the plates.
    if (!back) {
      g.line(24, 19, 24, 24, 'g');
      g.px(21, 22, 'g');
      g.px(27, 22, 'g');
      g.px(24, 29, 'g');
    } else {
      g.line(25, 19, 25, 26, 'g');
      g.px(22, 21, 'g');
      g.px(27, 21, 'g');
    }
    for (const [x, y] of [[18, 25], [30, 25], [22, 38], [26, 38], [24, 16], [25, 26]]) g.px(x, y, 'g');
    const cv = shade(g, SEED_PAL, 'gGk');
    glow(cv, g, 'gG', '#6fd4ff', 0.3, 1);
    return cv;
  }
  reg('seedbearer', () => ({ se: seedFig(false), ne: seedFig(true) }));

  // =================================================================================
  // SUPPORTING CAST (48×48, se + ne)
  // =================================================================================
  // Draws a character from a spec. o.pre / o.post / o.hair(g, back) are hooks.
  function person(o, back) {
    const g = new Grid(48, 48);
    if (o.pre) o.pre(g, back);
    figure(g, { back, ...o.body });
    if (o.outfit) o.outfit(g, back);
    if (o.hair) o.hair(g, back);
    if (!back && o.face !== false) {
      // Re-stamp the face over the hair mass, then features and fringe.
      spans(g, o.mask || FACE_MASK, 's');
      face(g, o.faceOpts || {});
    }
    if (o.fringe) o.fringe(g, back);
    if (o.post) o.post(g, back);
    const cv = shade(g, { ...SKIN, ...o.pal }, 'eEmkHRK' + (o.detail || ''), o.ink === undefined ? 0.4 : o.ink);
    if (o.fx) o.fx(cv, g, back);
    return cv;
  }
  const FACE_MASK = [[10, 22, 30], [11, 22, 30], [12, 22, 30], [13, 22, 31], [14, 22, 30], [15, 23, 29], [16, 24, 28]];
  const personSprite = (o) => () => ({ se: person(o, false), ne: person(o, true) });

  // ---- Marle ----------------------------------------------------------------------
  const MARLE = {
    pal: {
      h: '#f6d45c', H: '#c8962c', R: '#fff6b8', r: '#f07048',
      c: '#f6f3ec', d: '#f6f3ec', D: '#f6f3ec', a: '#3c74dc', l: '#3c74dc', y: '#f8d860', K: '#b88a3c',
      p: '#ebe2cf', q: '#ebe2cf', b: '#8c5a8c', o: '#8c5a8c', B: '#4c2c4c', P: '#c8bca4',
      w: '#8c5a34', W: '#6a4024', x: '#c8ccd8', X: '#eef0f8', e: '#1c3c8c',
    },
    body: { farArm: 'short', nearArm: 'short', nearHand: [32, 29] },
    faceOpts: { brow: 'K', ear: false },
    detail: 'PyX',
    pre(g, back) {
      // High ponytail swinging behind the head.
      g.ell(17, 8, 2.5, 2.5, 'h');
      g.spike(17, 9, 13, 24, 5, 'h');
      g.spike(16, 12, 15, 26, 3, 'h');
      g.line(15, 13, 13, 22, 'H');
    },
    outfit(g, back) {
      // Baggy trousers, white top with a blue sailor collar and sash.
      g.rect(19, 36, 23, 41, 'p');
      g.rect(25, 36, 29, 41, 'q');
      g.line(21, 33, 21, 40, 'P');
      g.line(27, 33, 27, 40, 'P');
      g.rect(20, 27, 29, 28, 'l');
      if (!back) {
        g.tri(22, 18, 28, 18, 25, 23, 'a');
        g.tri(23, 18, 27, 18, 25, 21, 'n');
        g.px(25, 23, 'y');
        g.rect(29, 27, 30, 30, 'l');
      } else {
        g.rect(20, 18, 29, 21, 'a');
      }
    },
    fringe(g, back) {
      if (!back) {
        g.text(18, 2, [
          '.....hhhhh....',
          '...hhhhhhhhh..',
          '..hhhhhRRhhhh.',
          '.hhhhhRRhhhhhh',
          '.hhhhRhhhhhhhh',
          'hhhhhhhhhhhhhh',
          'hhhhhhhHhhhhhh',
          'hhhhhhHhhhHhhh',
          'hhhh.hh.hhh.hh',
          'hhh......h...h',
          'hhh..........h',
          'hh............',
          'hh............',
          '.h............',
        ]);
        g.line(20, 7, 19, 14, 'H');
      } else {
        g.text(18, 2, [
          '.....hhhhh....',
          '...hhhhhhhhh..',
          '..hhhhRRhhhhh.',
          '.hhhhRRhhhhhhh',
          '.hhhRhhhhhhhhh',
          'hhhhhhhHhhhhhh',
          'hhhhhHhhhhHhhh',
          'hhhhhhhhhhhHhh',
          'hhhHhhhhhhhhHh',
          'hhHhhhhhHhhhhh',
          'hhhhhhhhHhhhhh',
          '.hhhhhhHhhhhh.',
          '.hhhhhhhhhhh..',
          '..hhhhhhhhh...',
        ]);
      }
      g.rect(17, 7, 18, 9, 'r');
    },
    post(g, back) {
      // Crossbow held across the body in the near hand.
      g.rect(28, 28, 37, 29, 'w');
      g.rect(25, 29, 28, 30, 'W');
      g.line(36, 24, 36, 33, 'x');
      g.line(37, 25, 37, 32, 'x');
      g.px(36, 24, 'X');
      g.px(36, 33, 'X');
      g.ell(32, 29, 1.6, 1.4, 'F');
    },
  };
  reg('marle', personSprite(MARLE));

  // Generic back-of-head hair mass with strands (for ne views).
  function hairBack(g, o = {}) {
    const cx = o.cx || 25;
    g.ell(cx, o.cy || 10, o.rx || 5.8, o.ry || 5.8, 'h');
    if (o.long) {
      taper(g, 13, o.long, cx - 5, cx + 5, cx - 5 + (o.flare || 0) * -1, cx + 5 + (o.flare || 0), 'h');
    } else spans(g, [[15, cx - 5, cx + 4], [16, cx - 4, cx + 3]], 'h');
    const bottom = o.long || 16;
    for (const i of [-2, 0, 1.5]) g.line(cx + i * 2, 8 + Math.abs(i), cx + i * 2.4, bottom - 1, 'H');
    g.line(cx - 2, 5, cx - 3, 8, 'R');
    g.line(cx - 1, 5, cx, 6, 'R');
  }

  // ---- Lucca ----------------------------------------------------------------------
  const LUCCA = {
    pal: {
      h: '#8e5ccc', H: '#5a3494', R: '#c09cf0', v: '#3f9a4c', V: '#2a6634', L: '#92dc82', G: '#5c4c3c', g: '#f4b848',
      j: '#c4e8f8', K: '#4a3c5c', c: '#ee8a34', d: '#ee8a34', D: '#ee8a34', C: '#b85a1c', l: '#6a4020', y: '#e8c050',
      p: '#3c7a48', q: '#3c7a48', b: '#7a4a2a', o: '#7a4a2a', B: '#40240f', x: '#aab2c2', X: '#e0e6f0', z: '#5c6474', u: '#d0843c',
    },
    body: { farArm: 'short', nearArm: 'short', nearHand: [31.5, 28.5] },
    detail: 'gLCyX',
    outfit(g, back) {
      if (!back) {
        g.line(25, 19, 25, 26, 'C');
        g.rect(24, 18, 26, 18, 'n');
      }
      g.rect(20, 27, 29, 28, 'l');
      if (!back) g.px(25, 27, 'y');
    },
    hair(g, back) {
      // Purple bob under a green helmet with goggles on its brow.
      if (!back) {
        spans(g, [[9, 19, 22], [10, 19, 22], [11, 19, 21], [12, 19, 21], [13, 19, 21], [14, 19, 21], [15, 20, 21], [9, 29, 31], [10, 30, 31], [11, 30, 31]], 'h');
        g.px(20, 11, 'H');
        g.px(20, 13, 'H');
        g.ell(25, 6.5, 6, 4, 'v');
        g.rect(19, 8, 31, 9, 'V');
        g.line(21, 4, 23, 3, 'L');
        g.rect(26, 5, 31, 7, 'G');
        g.rect(27, 5, 28, 6, 'g');
        g.rect(30, 5, 31, 6, 'g');
      } else {
        g.ell(25, 11, 5.5, 4, 'h');
        for (const x of [21, 24, 27]) g.line(x, 11, x, 14, 'H');
        g.ell(25, 7, 6, 4.3, 'v');
        g.rect(19, 9, 31, 10, 'V');
        g.rect(19, 7, 31, 8, 'G');
        g.line(22, 4, 24, 3, 'L');
      }
    },
    fringe(g, back) {
      if (back) return;
      g.px(29, 10, 'h');
      g.px(30, 10, 'h');
      g.px(22, 10, 'h');
      // Round glasses.
      for (const [x, y] of [[22, 11], [22, 12], [25, 11], [25, 12], [23, 13], [24, 13], [27, 11], [27, 12], [30, 11], [30, 12], [28, 13], [29, 13], [26, 11]]) g.px(x, y, 'K');
    },
    post(g, back) {
      // Chunky air gun.
      g.rect(29, 25, 37, 28, 'z');
      g.rect(37, 26, 40, 27, 'x');
      g.rect(40, 25, 41, 28, 'z');
      g.ell(32.5, 23.5, 2.5, 1.6, 'u');
      g.rect(30, 29, 31, 31, 'z');
      g.line(30, 25, 36, 25, 'x');
      g.ell(31.5, 28.5, 1.6, 1.4, 'F');
    },
  };
  reg('lucca', personSprite(LUCCA));

  // ---- Robo -------------------------------------------------------------------------
  function roboFig(back) {
    const g = new Grid(48, 48);
    const P = {
      h: '#e2a842', c: '#e2a842', C: '#c87a34', w: '#e2a842', j: '#d89a3c', b: '#d49a3a', o: '#e2a842', B: '#8a5a24',
      m: '#9ca6b4', n: '#6c7482', l: '#7c8492', p: '#8c96a4', q: '#9ca6b4', u: '#b4bcc8', U: '#b4bcc8',
      v: '#2a2e3e', e: '#ff3c28', a: '#60d0f8', A: '#e0fbff', k: '#1c1024', x: '#5a6070',
    };
    // Far arm.
    g.ell(16, 21.5, 2.8, 2.8, 'u');
    g.rect(15, 24, 17, 27, 'p');
    g.rect(13, 28, 18, 33, 'j');
    g.ell(15.5, 35, 2.8, 2.2, 'j');
    // Legs & big feet.
    g.rect(20, 35, 23, 40, 'p');
    g.rect(27, 35, 30, 40, 'q');
    g.rect(18, 41, 24, 44, 'b');
    g.rect(18, 45, 24, 45, 'B');
    g.rect(26, 42, 33, 45, 'o');
    g.rect(26, 46, 33, 46, 'B');
    // Round body.
    g.ell(25, 26, 9.5, 8.5, 'c');
    g.rect(19, 33, 31, 34, 'l');
    if (!back) {
      g.rect(24, 22, 31, 29, 'm');
      g.rect(25, 23, 26, 24, 'e');
      g.rect(28, 23, 30, 24, 'a');
      g.line(25, 26, 30, 26, 'x');
      g.line(25, 28, 30, 28, 'x');
      g.line(20, 20, 22, 30, 'C');
    } else {
      // Back: exhaust vents.
      for (const x of [21, 25, 29]) g.rect(x, 22, x + 1, 29, 'v');
      g.line(19, 31, 31, 31, 'C');
    }
    // Neck & head: dome with a dark visor band.
    g.rect(22, 16, 28, 18, 'n');
    g.ell(25, 10, 7.5, 6.5, 'h');
    g.ell(17.5, 10.5, 1.8, 2.5, 'U');
    g.line(25, 3, 25, 1, 'x');
    g.ell(25, 1, 1.3, 1, 'a');
    if (!back) {
      spans(g, [[9, 21, 32], [10, 21, 32], [11, 21, 32], [12, 22, 31]], 'v');
      g.rect(25, 10, 26, 11, 'e');
      g.rect(29, 10, 30, 11, 'e');
      g.px(22, 9, 'A');
      g.line(21, 14, 30, 14, 'C');
    } else {
      spans(g, [[10, 18, 26], [11, 18, 26]], 'v');
      g.line(20, 7, 30, 7, 'C');
    }
    // Near arm: shoulder ball, gauntlet, fist.
    g.ell(34.5, 21.5, 2.8, 2.8, 'U');
    g.rect(33, 24, 35, 27, 'q');
    g.rect(32, 28, 37, 33, 'w');
    g.ell(34.5, 35, 2.8, 2.2, 'w');
    g.line(32, 30, 37, 30, 'C');
    const cv = shade(g, P, 'eaAkxC');
    glow(cv, g, 'ea', '#ff9080', 0.2, 1);
    return cv;
  }
  reg('robo', () => ({ se: roboFig(false), ne: roboFig(true) }));

  // ---- King Guardia XXI -----------------------------------------------------------
  const KING = {
    pal: {
      h: '#6c5a50', H: '#443630', R: '#9c8a7c', w: '#eeebe4', W: '#bcb6ac', y: '#f2c84a', Y: '#e02c48', Z: '#f6d870',
      r: '#c43444', T: '#8c1c2c', c: '#46408e', d: '#46408e', D: '#46408e', t: '#403a86', u: '#f4f2ee', K: '#26202c',
      l: '#f2c84a', o: '#5a3c2c', b: '#5a3c2c', B: '#2c1c14', x: '#f2c84a', X: '#fff4c0', j: '#e02c48',
    },
    body: { legs: false, nearHand: [31.5, 27.5] },
    detail: 'YZKXj',
    pre(g) {
      // Red royal cape behind.
      taper(g, 18, 45, 19, 30, 15, 33, 'r');
      g.line(16, 44, 32, 44, 'T');
    },
    outfit(g, back) {
      // Long robe with gold trim, ermine collar.
      taper(g, 27, 45, 20, 29, 18, 31, 't');
      g.rect(21, 46, 24, 46, 'b');
      g.rect(26, 46, 29, 46, 'o');
      g.line(18, 45, 31, 45, 'Z');
      if (!back) {
        g.line(26, 19, 27, 45, 'Z');
        g.rect(20, 27, 29, 27, 'l');
      } else {
        taper(g, 18, 45, 19, 30, 16, 32, 'r');
        g.line(24, 20, 23, 44, 'T');
        g.line(28, 22, 29, 44, 'T');
      }
      spans(g, [[17, 21, 29], [18, 20, 30], [19, 20, 30]], 'u');
      for (const [x, y] of [[22, 18], [25, 19], [28, 18], [20, 19]]) g.px(x, y, 'K');
    },
    hair(g, back) {
      if (!back) {
        g.ell(23, 9, 5, 4.5, 'h');
        spans(g, [[10, 19, 21], [11, 19, 21], [12, 19, 21], [13, 19, 21], [14, 20, 21]], 'h');
        g.line(20, 9, 20, 13, 'H');
      } else {
        hairBack(g, { cy: 10 });
        spans(g, [[15, 19, 30], [16, 20, 29]], 'h');
      }
      // Crown.
      spans(g, [[5, 20, 30], [6, 20, 30], [7, 20, 30]], 'y');
      for (const x of [20, 23, 26, 29]) g.rect(x, 3, x + 1, 4, 'y');
      g.px(25, 6, 'Y');
      g.px(21, 6, 'Y');
      g.px(29, 6, 'Y');
      g.line(21, 5, 29, 5, 'Z');
    },
    fringe(g, back) {
      if (!back) {
        // Full beard and moustache.
        spans(g, [[14, 22, 30], [15, 22, 30], [16, 22, 29], [17, 23, 28], [18, 24, 27]], 'w');
        g.rect(26, 14, 30, 14, 'W');
        g.rect(22, 12, 22, 14, 'w');
        g.px(27, 15, 'm');
        g.px(28, 15, 'm');
        g.line(24, 16, 26, 18, 'W');
        g.rect(27, 10, 29, 10, 'W');
        g.px(23, 10, 'W');
        g.px(24, 10, 'W');
      }
    },
    post(g, back) {
      // Sceptre.
      g.line(33, 40, 33, 12, 'x');
      g.ell(33, 10, 1.8, 1.8, 'x');
      g.px(33, 10, 'j');
      g.px(32, 9, 'X');
      g.ell(31.8, 27.5, 1.6, 1.4, 'F');
    },
  };
  reg('king', personSprite(KING));

  // ---- Queen Leene ----------------------------------------------------------------
  const LEENE = {
    pal: {
      h: '#c85e38', H: '#8a3620', R: '#f0a070', y: '#f4d060', Y: '#58b0f8', Z: '#f4d878',
      c: '#b69ae0', t: '#aa8cd8', T: '#8a6cc0', d: '#f6f0fa', D: '#f6f0fa', u: '#f6f0fa', l: '#f4d060',
      o: '#6a4c8c', b: '#6a4c8c',
    },
    body: { legs: false, nearHand: [27.5, 27.5] },
    detail: 'YZ',
    outfit(g, back) {
      // Floor-length gown, puffed sleeves.
      for (let y = 27; y <= 46; y++) {
        const t = (y - 27) / 19;
        g.rect(Math.round(20 - t * 3.5), y, Math.round(29 + t * 3.5), y, 't');
      }
      g.line(17, 46, 32, 46, 'T');
      g.line(22, 30, 19, 45, 'T');
      g.line(26, 30, 26, 45, 'T');
      g.line(29, 30, 31, 45, 'T');
      g.rect(20, 27, 29, 27, 'l');
      g.ell(18.5, 20.5, 2, 2.2, 'd');
      g.ell(31, 20.5, 2, 2.2, 'D');
      if (!back) {
        g.rect(22, 18, 27, 19, 'u');
        g.line(22, 20, 25, 23, 'Z');
        g.line(27, 20, 25, 23, 'Z');
        g.ell(26.5, 27.5, 1.6, 1.4, 'F');
        g.ell(28, 27.5, 1.6, 1.4, 'F');
      }
    },
    hair(g, back) {
      // Up-do with a bun and a tiara.
      g.ell(20, 5.5, 3, 3, 'h');
      g.line(19, 4, 21, 3, 'R');
      if (!back) {
        g.ell(24, 8.5, 5.5, 4, 'h');
        spans(g, [[10, 19, 21], [11, 19, 21], [12, 19, 21], [13, 19, 21], [14, 19, 20], [15, 19, 20], [16, 20, 20], [9, 29, 30], [10, 30, 30]], 'h');
        g.line(21, 7, 19, 13, 'H');
        g.line(24, 6, 27, 8, 'H');
        g.line(22, 6, 23, 5, 'R');
        g.line(23, 5, 29, 6, 'y');
        g.px(26, 4, 'y');
        g.px(26, 5, 'Y');
      } else {
        hairBack(g, { cy: 10 });
        g.ell(22, 6, 3.5, 3, 'h');
        g.line(21, 4, 23, 3, 'R');
        g.line(24, 5, 30, 6, 'y');
      }
    },
  };
  reg('leene', personSprite(LEENE));

  // ---- Kino -------------------------------------------------------------------------
  const KINO = {
    pal: {
      s: '#e4a878', A: '#e4a878', F: '#e4a878', L: '#e4a878', M: '#e4a878', S: '#b87a50', n: '#c88c60',
      h: '#6a3c1c', H: '#3c1e0a', R: '#a4683a', c: '#cc944e', C: '#7a4a1c', l: '#7a5a34', p: '#cc944e',
      b: '#9a6a3a', o: '#9a6a3a', B: '#4c2c14', w: '#8c5a2c', W: '#5a3414',
    },
    body: { farArm: 'bare', nearArm: 'bare', legs: 'bare', nearHand: [32, 28] },
    detail: 'C',
    outfit(g, back) {
      // Fur tunic slung over one shoulder, ragged hem.
      spans(g, [[18, 20, 23], [19, 20, 24], [20, 20, 26], [21, 20, 29]], 'c');
      spans(g, [[18, 24, 28], [19, 25, 29], [20, 27, 29]], 'A');
      if (back) spans(g, [[18, 26, 29], [19, 25, 29], [20, 24, 29]], 'c');
      g.rect(19, 29, 30, 33, 'c');
      for (let x = 19; x <= 30; x += 2) g.px(x, 34, 'c');
      for (const [x, y] of [[22, 22], [26, 24], [21, 26], [28, 29], [23, 31], [26, 32], [20, 30], [27, 21]]) g.px(x, y, 'C');
      g.rect(20, 27, 29, 28, 'l');
      g.rect(19, 40, 23, 42, 'b');
      g.rect(25, 40, 29, 42, 'o');
    },
    hair(g, back) {
      g.ell(24.5, 8, 6, 4.5, 'h');
      const spikes = back
        ? [[20, 6, 16, 2], [24, 5, 23, 0], [28, 5, 31, 1], [30, 8, 34, 6], [19, 10, 14, 10], [20, 13, 16, 17], [25, 14, 25, 18], [29, 13, 31, 17]]
        : [[20, 6, 16, 2], [24, 5, 23, 0], [28, 5, 31, 1], [30, 8, 34, 6], [19, 10, 14, 10], [20, 13, 17, 17]];
      for (const [a, b, c, d] of spikes) g.spike(a, b, c, d, 4, 'h');
      if (back) g.ell(25, 11, 5.5, 5, 'h');
      else spans(g, [[10, 19, 21], [11, 19, 21], [12, 19, 20], [13, 19, 20]], 'h');
      g.line(21, 5, 17, 3, 'H');
      g.line(27, 4, 30, 2, 'R');
      g.line(24, 4, 23, 1, 'R');
    },
    fringe(g, back) {
      if (back) return;
      g.spike(23, 8, 22, 11, 3, 'h');
      g.spike(26, 8, 26, 10, 3, 'h');
      g.spike(29, 8, 31, 10, 3, 'h');
    },
    post(g) {
      // Heavy wooden club over the shoulder.
      g.line(32, 28, 37, 12, 'w', 2);
      g.ell(38, 10, 2.8, 3.5, 'w');
      g.px(37, 9, 'W');
      g.px(39, 12, 'W');
      g.ell(32, 28, 1.6, 1.4, 'F');
    },
  };
  reg('kino', personSprite(KINO));

  // ---- Guardia soldier (600 A.D.) -------------------------------------------------
  const GUARD = {
    pal: {
      x: '#a8b2c4', X: '#eef2f8', c: '#2e5cb4', C: '#f0c848', t: '#2a54a8', d: '#8a92a4', D: '#8a92a4', M: '#5c6474',
      l: '#6a4424', y: '#f0c848', p: '#4c4450', q: '#4c4450', b: '#6a4428', o: '#6a4428', B: '#2c1a0c', w: '#8a5a30', z: '#c8d0dc',
    },
    body: { nearHand: [32, 28] },
    detail: 'CMXy',
    pre(g) {
      // Spear shaft (behind the body).
      g.line(33, 45, 33, 5, 'w');
    },
    outfit(g, back) {
      // Blue tabard over mail, belted.
      taper(g, 28, 36, 21, 28, 21, 28, 't');
      g.line(21, 36, 28, 36, 'C');
      for (const [x, y] of [[17, 21], [18, 23], [17, 25], [31, 21], [30, 23], [32, 25], [20, 30], [29, 31]]) g.px(x, y, 'M');
      if (!back) {
        g.line(25, 20, 25, 25, 'C');
        g.line(23, 22, 27, 22, 'C');
        g.rect(25, 27, 26, 28, 'y');
      }
      g.rect(20, 18, 29, 18, 'M');
    },
    hair(g, back) {
      // Nasal helm with cheek guards.
      g.ell(25, 8, 6, 4.8, 'x');
      g.rect(19, 9, 31, 10, 'x');
      if (!back) {
        g.rect(19, 10, 21, 14, 'x');
        g.line(21, 5, 24, 4, 'X');
        g.line(19, 10, 31, 10, 'M');
      } else {
        g.rect(19, 10, 31, 15, 'x');
        g.line(21, 5, 23, 4, 'X');
        g.line(19, 12, 31, 12, 'M');
      }
    },
    fringe(g, back) {
      if (!back) {
        g.rect(26, 10, 26, 12, 'x');
        g.rect(20, 10, 21, 14, 'x');
      }
    },
    post(g, back) {
      g.spike(33, 5, 33, 0, 4, 'z');
      g.rect(32, 5, 34, 5, 'y');
      g.ell(32, 28, 1.6, 1.4, 'F');
    },
  };
  reg('guard', personSprite(GUARD));

  // =================================================================================
  // MONSTERS (Echo variants are derived automatically by the engine)
  // =================================================================================

  // ---- Imp: small blue-green goblin -------------------------------------------------
  function impFig(back) {
    const g = new Grid(48, 48);
    const P = {
      s: '#4fb09a', S: '#2f7c6c', b: '#9ed8c0', a: '#4fb09a', A: '#4fb09a', L: '#46a08c', M: '#4fb09a',
      i: '#e88a9c', e: '#1c1024', E: '#ffe040', m: '#3c1424', w: '#fff8e8', r: '#a8402c', R: '#c86440',
      c: '#d8d0bc', x: '#b8c0cc', X: '#eef2f8', t: '#46a08c', k: '#1c1024',
    };
    // Tail (back view shows it best).
    g.line(20, 40, 14, 37, 't', 2);
    g.ell(13, 36, 1.5, 1.5, 't');
    // Far arm & legs.
    g.line(19, 32, 16, 38, 'a', 2);
    g.ell(16, 39, 1.6, 1.4, 'a');
    g.rect(20, 40, 22, 44, 'L');
    g.rect(26, 40, 28, 44, 'M');
    g.rect(18, 45, 23, 45, 'L');
    g.rect(26, 46, 31, 46, 'M');
    g.rect(26, 45, 30, 45, 'M');
    // Pot belly & loincloth.
    g.ell(24.5, 35, 5.5, 5.5, 's');
    if (!back) g.ell(26, 36, 3.5, 3.5, 'b');
    spans(g, [[38, 20, 29], [39, 20, 29], [40, 21, 28], [41, 22, 27]], 'r');
    g.line(21, 38, 28, 38, 'R');
    // Near arm with a crude knife.
    g.line(29, 31, 32, 36, 'A', 2);
    g.ell(32.5, 37, 1.6, 1.5, 'A');
    // Big head with long pointed ears.
    g.spike(18, 22, 9, 17, 5, 's');
    g.spike(31, 22, 40, 17, 5, 's');
    if (!back) {
      g.spike(18, 22, 11, 18, 2, 'i');
      g.spike(31, 22, 38, 18, 2, 'i');
    }
    g.ell(24.5, 23, 7, 6.5, 's');
    g.spike(22, 17, 21, 13, 3, 'c');
    g.spike(27, 17, 28, 13, 3, 'c');
    if (!back) {
      // Face: glaring yellow eyes, wide jagged grin.
      g.text(21, 20, [
        'kk...kk.',
        'EEe..EEe',
        'EEe..EEe',
      ]);
      g.text(20, 25, [
        '.mmmmmmmmm',
        'mwmwmwmwmm',
        '.mmmmmmmm.',
      ]);
      g.px(26, 23, 'S');
      g.px(27, 23, 'S');
    } else {
      g.line(21, 18, 21, 27, 'S');
      g.line(25, 17, 25, 28, 'S');
      g.line(28, 18, 28, 27, 'S');
    }
    // Knife.
    g.line(33, 36, 38, 30, 'x', 1);
    g.line(34, 36, 39, 30, 'X', 1);
    g.rect(32, 36, 34, 37, 'R');
    g.ell(32.5, 37, 1.6, 1.5, 'A');
    return shade(g, P, 'eEmwkiSR');
  }
  reg('imp', () => ({ se: impFig(false), ne: impFig(true) }));

  // ---- Hench: horned blue brute ----------------------------------------------------
  function henchFig(back) {
    const g = new Grid(48, 48);
    const P = {
      s: '#4f7ed0', S: '#2c4c94', b: '#8cb0ec', a: '#4a76c8', A: '#4f7ed0', L: '#4674c4', M: '#4f7ed0',
      h: '#ece2c4', H: '#b0a07c', e: '#e02828', E: '#ffe020', m: '#2a1030', w: '#fffbe8',
      l: '#8a4cae', y: '#e0b040', c: '#5a3c7c', x: '#6c4a2c', z: '#b4bccc', Z: '#e8ecf4', k: '#1c1024', n: '#4674c4',
    };
    // Far arm (thick, hanging).
    g.ell(16, 24, 3.5, 3.5, 'a');
    g.line(15, 26, 14, 34, 'a', 3);
    g.ell(15, 36, 2.5, 2.2, 'a');
    // Legs: stocky.
    g.rect(18, 37, 23, 43, 'L');
    g.rect(26, 37, 31, 43, 'M');
    g.rect(17, 44, 23, 45, 'L');
    g.rect(26, 45, 32, 46, 'M');
    g.rect(26, 44, 31, 44, 'M');
    // Barrel torso.
    g.ell(24.5, 28, 9, 8.5, 's');
    if (!back) {
      g.ell(26.5, 30, 5, 5.5, 'b');
      g.line(26, 25, 26, 34, 'S');
    } else g.line(24, 22, 24, 34, 'S');
    // Loincloth & belt.
    spans(g, [[34, 17, 32], [35, 17, 32]], 'l');
    spans(g, [[36, 19, 30], [37, 20, 29], [38, 21, 28], [39, 22, 27]], 'c');
    if (!back) g.rect(24, 34, 26, 35, 'y');
    // Head sunk between the shoulders.
    g.ell(25, 16, 6.5, 6, 's');
    // Curved horns.
    g.spike(20, 12, 15, 4, 4, 'h');
    g.spike(15.5, 4.5, 17, 1, 2, 'h');
    g.spike(30, 12, 35, 4, 4, 'h');
    g.spike(34.5, 4.5, 33, 1, 2, 'h');
    g.line(19, 11, 16, 6, 'H');
    g.line(31, 11, 34, 6, 'H');
    if (!back) {
      g.text(21, 13, [
        'kkk.kkk',
        'EEe.EEe',
      ]);
      g.text(21, 18, [
        'mmmmmmmm',
        'mwmmmmwm',
        '.mmmmmm.',
      ]);
      g.px(22, 18, 'w');
      g.px(28, 18, 'w');
      g.px(26, 16, 'S');
    }
    // Near arm gripping a spiked club.
    g.line(38, 30, 42, 8, 'x', 2);
    g.ell(42, 9, 2.8, 5, 'x');
    for (const [x, y] of [[39, 5], [45, 7], [39, 11], [45, 12], [42, 3]]) g.px(x, y, 'z');
    g.px(41, 7, 'Z');
    g.ell(33, 23, 3.5, 3.5, 'A');
    g.line(34, 25, 37, 31, 'A', 3);
    g.ell(38.5, 31, 2.5, 2.2, 'A');
    return shade(g, P, 'eEmwkHSZ');
  }
  reg('hench', () => ({ se: henchFig(false), ne: henchFig(true) }));

  // ---- Nu: round blue blob-creature ------------------------------------------------
  function nuFig(back, pal, horns) {
    const g = new Grid(48, 48);
    const P = {
      s: '#5e8ee0', S: '#34569c', b: '#a8c4f0', t: '#2c3c8c', T: '#4c64b8', e: '#1c1024', E: '#ffffff', m: '#1c1024',
      a: '#5586d8', A: '#5e8ee0', f: '#4c7cd0', F: '#5e8ee0', k: '#1c1024', h: '#f0a8c8', H: '#c86c98', ...pal,
    };
    // Stubby feet.
    g.ell(19, 44, 3.5, 2, 'f');
    g.ell(29, 45, 3.5, 2, 'F');
    // Body: a squat pear.
    g.ell(24.5, 34, 11, 10.5, 's');
    g.ell(24.5, 27, 8.5, 8, 's');
    if (!back) g.ell(27, 37, 6.5, 6.5, 'b');
    // Tiny arms.
    g.ell(13.5, 34, 2.2, 3, 'a');
    g.ell(35.5, 34, 2.2, 3, 'A');
    // Tuft on top.
    g.spike(23, 20, 21, 13, 3, 't');
    g.spike(25, 20, 26, 12, 3, 't');
    g.spike(27, 20, 30, 14, 3, 't');
    if (horns) {
      g.spike(18, 24, 14, 17, 4, 'h');
      g.spike(31, 24, 35, 17, 4, 'h');
    }
    if (!back) {
      // Beady eyes and a wide, calm mouth.
      g.text(24, 27, ['e...e', 'e...e']);
      g.px(24, 27, 'E');
      g.px(28, 27, 'E');
      g.line(23, 32, 31, 32, 'm');
      g.px(22, 31, 'm');
      g.px(32, 31, 'm');
    } else {
      g.line(24, 24, 22, 40, 'S');
    }
    return shade(g, P, 'eEmkS');
  }
  reg('nu', () => ({ se: nuFig(false), ne: nuFig(true) }));

  // ---- Kilwala: small white ape ----------------------------------------------------
  function kilwalaFig(back) {
    const g = new Grid(48, 48);
    const P = {
      w: '#ebe8f0', W: '#d8d4e0', a: '#e2dfe8', A: '#ebe8f0', L: '#dcd8e4', M: '#e6e3ec', H: '#a8a4b8',
      s: '#eaa4a0', S: '#c07878', i: '#f0b8b4', e: '#1c1024', E: '#ffffff', m: '#6c2830', k: '#1c1024', t: '#34303c',
    };
    // Long far arm reaching the ground.
    g.line(17, 26, 13, 40, 'a', 3);
    g.ell(14, 42, 2.2, 1.8, 't');
    // Bowed legs.
    g.line(21, 37, 19, 44, 'L', 3);
    g.line(28, 37, 30, 44, 'M', 3);
    g.ell(19, 45, 2.5, 1.4, 't');
    g.ell(30.5, 46, 2.5, 1.2, 't');
    // Shaggy body.
    g.ell(24.5, 31, 8, 8, 'W');
    for (const [x0, y0, x1, y1] of [[18, 36, 17, 40], [22, 38, 22, 41], [27, 38, 28, 41], [31, 35, 32, 39]]) g.spike(x0, y0, x1, y1, 3, 'W');
    if (!back) g.ell(26.5, 32, 4, 5, 'i');
    // Near arm.
    g.line(32, 26, 36, 39, 'A', 3);
    g.ell(37, 41, 2.2, 1.8, 't');
    // Head: big round ears, pink face.
    g.ell(16.5, 15, 3.5, 3.5, 'w');
    g.ell(33, 15, 3.5, 3.5, 'w');
    if (!back) {
      g.ell(16.5, 15, 1.8, 1.8, 'i');
      g.ell(33, 15, 1.8, 1.8, 'i');
    }
    g.ell(24.5, 17, 7.5, 7, 'w');
    g.spike(22, 11, 20, 7, 3, 'w');
    g.spike(25, 10, 26, 6, 3, 'w');
    for (const [x0, y0, x1, y1] of [[20, 13, 19, 18], [25, 12, 23, 16], [29, 13, 30, 17]]) g.line(x0, y0, x1, y1, 'H');
    if (!back) {
      spans(g, [[15, 22, 30], [16, 21, 31], [17, 21, 31], [18, 21, 31], [19, 22, 30], [20, 22, 30], [21, 23, 29], [22, 24, 28]], 's');
      g.text(23, 16, ['ee..ee', 'eE..eE']);
      g.px(26, 19, 'S');
      g.px(27, 19, 'S');
      g.line(24, 21, 29, 21, 'm');
    } else {
      for (const [x0, y0, x1, y1] of [[21, 16, 20, 22], [28, 16, 29, 22], [24, 26, 24, 34]]) g.line(x0, y0, x1, y1, 'H');
    }
    return shade(g, P, 'eEmkHS');
  }
  reg('kilwala', () => ({ se: kilwalaFig(false), ne: kilwalaFig(true) }));

  // ---- Roundillo: armoured rolling ball --------------------------------------------
  function roundilloFig(back) {
    const g = new Grid(48, 48);
    const P = {
      a: '#c08a48', b: '#b07c3e', c: '#c89452', d: '#a87238', u: '#e8d4a4', s: '#d8b484', S: '#a07448', e: '#1c1024', E: '#ffffff',
      f: '#8a5c30', n: '#f08c90', x: '#f4ead0', k: '#1c1024', r: '#6c4424',
    };
    // Little feet.
    g.ell(18, 44.5, 2.5, 1.8, 'f');
    g.ell(29, 45.5, 2.5, 1.5, 'f');
    // Ball of overlapping armour bands (distinct letters give dark seams).
    g.ell(23.5, 32, 12, 12, 'a');
    const bands = 'abcdabcd';
    const [px0, py0] = back ? [8, 36] : [40, 36];
    for (let y = 19; y <= 45; y++)
      for (let x = 10; x <= 37; x++) {
        if (g.a[y][x] === '.') continue;
        const d = Math.hypot(x - px0, (y - py0) * 1.1);
        g.a[y][x] = bands[Math.floor(d / 3.6) % 8];
      }
    if (!back) {
      // Head tucked on the facing side: snout, ears, beady eye.
      g.ell(34, 36, 4.5, 4, 'u');
      g.ell(38, 38, 2.5, 2, 's');
      g.px(40, 38, 'n');
      g.ell(31.5, 31.5, 1.8, 2.5, 's');
      g.px(34, 35, 'e');
      g.px(35, 35, 'e');
      g.px(35, 34, 'E');
      g.line(35, 40, 38, 40, 'S');
    } else {
      // Tail tip.
      g.spike(13, 38, 7, 41, 4, 'd');
      g.line(12, 38, 9, 40, 'r');
    }
    return shade(g, P, 'eEkxnrS');
  }
  reg('roundillo', () => ({ se: roundilloFig(false), ne: roundilloFig(true) }));

  // ---- Tyrano: big tyrannosaur (~80×72) --------------------------------------------
  function tyranoFig(back) {
    const g = new Grid(78, 70);
    const P = {
      a: '#b8582e', b: '#b0522a', c: '#a84c28', d: '#c0602f', u: '#ecc890', U: '#e0b87c', t: '#b4562c',
      s: '#7c2e1a', e: '#1c1024', E: '#ffd030', w: '#fff8e4', m: '#5a1420', r: '#c83040', x: '#e8dcc0', k: '#1c1024',
      f: '#a24c26', F: '#b8582e',
    };
    // Tail sweeping back to the left.
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const x = 30 - t * 28;
      const y = 40 - Math.sin(t * 2.2) * 8 - t * 4;
      g.ell(x, y, 7 * (1 - t) + 1, 6 * (1 - t) + 1, 't');
    }
    // Far leg.
    g.ell(30, 50, 6, 7, 'f');
    g.line(30, 54, 28, 64, 'f', 4);
    spans(g, [[65, 22, 33], [66, 22, 33]], 'f');
    g.px(21, 66, 'x');
    // Body.
    g.ell(39, 40, 16, 12, 'a');
    // Neck up to the head.
    g.line(44, 36, 54, 20, 'b', 11);
    // Belly plates.
    if (!back) {
      g.line(57, 22, 50, 36, 'u', 4);
      g.ell(47, 42, 6, 7, 'u');
      for (let y = 28; y <= 46; y += 4) g.line(44 + (46 - y) / 3, y, 48 + (46 - y) / 2.5, y - 1, 'U');
    }
    // Stripes along the back.
    for (const [x0, y0, x1, y1] of [[22, 33, 24, 40], [28, 29, 30, 37], [35, 28, 36, 35], [42, 28, 42, 34], [49, 24, 50, 29], [12, 30, 14, 35]]) g.line(x0, y0, x1, y1, 's');
    // Tiny arms.
    if (!back) {
      g.line(58, 34, 62, 38, 'd', 2);
      g.px(63, 39, 'x');
      g.px(62, 40, 'x');
    }
    // Near leg: huge thigh, digitigrade shin, clawed foot.
    g.ell(44, 48, 9, 9, 'c');
    g.line(46, 54, 49, 60, 'c', 5);
    g.line(50, 58, 48, 65, 'c', 4);
    spans(g, [[65, 42, 57], [66, 41, 58], [67, 41, 58]], 'c');
    for (const x of [41, 50, 58]) g.px(x, 68, 'x');
    // Head: heavy skull, open jaws.
    g.ell(60, 14, 10, 7.5, 'd');
    g.tri(58, 8, 76, 11, 68, 19, 'd');
    if (!back) {
      spans(g, [[18, 56, 75], [19, 56, 75]], 'm');
      g.tri(54, 20, 74, 22, 58, 27, 'b');
      spans(g, [[20, 57, 72], [21, 56, 70]], 'm');
      g.px(73, 20, 'r');
      for (let x = 58; x <= 74; x += 2) {
        g.px(x, 18, 'w');
        g.px(x + 1, 21, 'w');
      }
      // Eye under a brow ridge.
      g.line(58, 9, 63, 9, 's');
      g.text(60, 10, ['EEe', 'Eee']);
      g.px(73, 13, 's');
      g.px(71, 13, 's');
    } else {
      g.ell(58, 17, 8, 6, 'b');
      g.line(56, 9, 62, 10, 's');
    }
    // Spiky ridge.
    for (const [x, y] of [[50, 8], [44, 20], [37, 27], [30, 28], [23, 30], [16, 29]]) g.spike(x + 1, y + 2, x - 1, y - 1, 3, 's');
    return shade(g, P, 'eEwkrsUx');
  }
  reg('tyrano', () => ({ se: tyranoFig(false), ne: tyranoFig(true) }));

  // ---- Lavos Sprout: miniature spike-shell -------------------------------------------
  function sproutFig(W, H, k) {
    const g = new Grid(W, H);
    const P = {
      a: '#74403a', b: '#84503e', c: '#5a2c2a', d: '#6a3834', x: '#e6dac2', X: '#b8a88c', r: '#e05a2c', R: '#ff9a4c', m: '#3c0c14',
      e: '#ffd040', l: '#4c2420', k: '#1c1024', g: '#ff5030', s: '#3c1a1c',
    };
    const cx = W / 2 - 0.5;
    const base = H - 2;
    const rx = 16 * k;
    const ry = 25 * k;
    // Dome with concentric shell plates (letters alternate so seams show).
    for (let y = Math.floor(base - ry); y <= base; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - base) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        g.px(x, y, d < 0.5 ? 'b' : 'a');
      }
    // Flared rim.
    g.rect(Math.round(cx - rx - 1), base - 1, Math.round(cx + rx + 1), base, 'c');
    g.line(Math.round(cx - rx + 1), base - 2, Math.round(cx + rx - 1), base - 2, 's');
    // Radiating spikes in rings, bigger towards the crown.
    // Ridges between the shell plates.
    for (let i = 1; i < 6; i++) {
      const t = (Math.PI * i) / 6;
      g.line(cx - Math.cos(t) * rx * 0.3, base - Math.sin(t) * ry * 0.3, cx - Math.cos(t) * rx * 0.95, base - Math.sin(t) * ry * 0.95, 's');
    }
    const rings = [[1.0, 9, 5, 4], [0.62, 6, 5, 3.5], [0.3, 2, 4, 3]];
    rings.forEach(([r, n, len, w]) => {
      for (let i = 0; i < n; i++) {
        const t = Math.PI * (0.08 + (0.84 * i) / (n - 1));
        const ox = cx - Math.cos(t) * rx * r * 0.96;
        const oy = base - Math.sin(t) * ry * r * 0.96;
        const tx = ox - Math.cos(t) * len * k;
        const ty = oy - Math.sin(t) * len * k;
        g.spike(ox, oy, tx, ty, w * k, 'x');
      }
    });
    g.spike(cx, base - ry * 0.9, cx, base - ry - 8 * k, 4.5 * k, 'x');
    // Hooked beak on the facing side, with small glowing eyes above it.
    const bx = cx + 6 * k;
    const by = base - 5 * k;
    g.ell(bx, by, 4.5 * k, 3.5 * k, 'r');
    g.tri(bx + 1 * k, by - 3 * k, bx + 9 * k, by + 2 * k, bx + 2 * k, by + 1 * k, 'r');
    g.tri(bx - 1 * k, by + 1 * k, bx + 7 * k, by + 2.5 * k, bx + 1 * k, by + 4 * k, 'R');
    g.line(bx - 3 * k, by + 1 * k, bx + 8 * k, by + 2 * k, 'm');
    g.px(bx - 1 * k, by - 5 * k, 'e');
    g.px(bx + 3 * k, by - 5 * k, 'e');
    g.px(bx - 5 * k, by - 4 * k, 'e');
    const cv = shade(g, P, 'eXmkg');
    glow(cv, g, 'e', '#ffb040', 0.45, 1);
    return cv;
  }
  reg('lavos_sprout', () => sproutFig(46, 46, 0.95));
  reg('lavos_sprout_large', () => sproutFig(70, 62, 1.35));

  // =================================================================================
  // THE HOLLOW: Vitrine Sentinel, the Curator, Iselle broken
  // =================================================================================

  // ---- Vitrine: walking glass display case with a skeleton inside (~40×60) -----------
  function vitrineFig(back) {
    const g = new Grid(38, 58);
    const P = {
      G: '#9ed6e8', H: '#8cc4da', f: '#c8a050', F: '#a07c34', c: '#5a3c2c', C: '#6c4a34', b: '#4a3024', B: '#5c3c2c',
      w: '#ece4cc', W: '#c4b89c', k: '#1c1024', X: '#f4ffff', P: '#eef1f6', p: '#dfe3ea', g: '#4cc4ff', y: '#e8d8a0', j: '#2c3444',
    };
    const x0 = 3;
    const x1 = 25;
    const y0 = 11;
    const y1 = 46;
    const sx = 7; // side depth
    const sk = 0.5; // side skew
    // Stubby porcelain legs (mid-stride) with ball feet.
    for (const [lx, ly, l] of [[6, 49, 'p'], [21, 50, 'P'], [30, 47, 'p']]) {
      g.rect(lx, ly, lx + 2, ly + 4, l);
      g.ell(lx + 1, ly + 5, 1.8, 1.3, l);
      g.px(lx + 1, ly + 1, 'g');
    }
    // Plinth.
    g.rect(x0 - 1, y1, x1 + 1, y1 + 3, 'b');
    for (let x = x1 + 2; x <= x1 + sx + 1; x++) g.rect(x, Math.round(y1 - (x - x1) * sk), x, Math.round(y1 + 3 - (x - x1) * sk), 'B');
    // Glass: front face, side face, top.
    g.rect(x0, y0, x1, y1 - 1, 'G');
    for (let x = x1 + 1; x <= x1 + sx; x++) g.rect(x, Math.round(y0 - (x - x1) * sk), x, Math.round(y1 - 1 - (x - x1) * sk), 'H');
    // Brass frame edges.
    g.rect(x0, y0, x0, y1 - 1, 'f');
    g.rect(x1, y0, x1, y1 - 1, 'f');
    g.line(x1 + sx, y0 - sx * sk, x1 + sx, y1 - 1 - sx * sk, 'F');
    // Cornice.
    g.rect(x0 - 1, y0 - 3, x1 + 1, y0 - 1, 'c');
    for (let x = x1 + 2; x <= x1 + sx + 1; x++) g.rect(x, Math.round(y0 - 3 - (x - x1) * sk), x, Math.round(y0 - 1 - (x - x1) * sk), 'C');
    for (let i = 0; i <= sx; i++) g.line(x0 - 1 + i, y0 - 4 - i * sk, x1 + 1 + i, y0 - 4 - i * sk, 'C');
    // Skeleton inside (hunched, peering out).
    const bx = 14;
    if (!back) {
      g.ell(bx + 1, 17, 3.5, 3.5, 'w');
      g.rect(bx, 20, bx + 3, 22, 'w');
      g.px(bx, 16, 'j');
      g.px(bx + 2, 16, 'j');
      g.px(bx + 1, 17, 'j');
      g.px(bx + 3, 17, 'j');
      g.line(bx + 1, 21, bx + 3, 21, 'W');
    } else {
      g.ell(bx + 1, 17, 3.5, 3.5, 'w');
      g.line(bx - 1, 15, bx + 2, 15, 'W');
    }
    g.line(bx, 23, bx - 1, 34, 'w', 2);
    for (let y = 25; y <= 31; y += 2) {
      g.line(bx - 5, y + 1, bx + 5, y, 'w');
    }
    g.line(bx - 5, 26, bx - 8, 34, 'w');
    g.line(bx + 5, 25, bx + 8, 33, 'w');
    g.line(bx - 8, 34, bx - 7, 38, 'W');
    g.line(bx + 8, 33, bx + 9, 37, 'W');
    g.ell(bx - 1, 35, 4, 1.8, 'w');
    g.line(bx - 3, 36, bx - 4, 45, 'w', 2);
    g.line(bx + 1, 36, bx + 3, 45, 'w', 2);
    // Reflection streaks and a brass plaque.
    for (const [a, b2, c2, d] of [[x0 + 2, y0 + 12, x0 + 8, y0 + 2], [x0 + 4, y0 + 13, x0 + 10, y0 + 3], [x1 - 6, y1 - 3, x1 - 1, y1 - 10]]) g.line(a, b2, c2, d, 'X');
    if (!back) g.rect(11, y1 + 1, 17, y1 + 2, 'y');
    g.line(x0, y1 - 1, x1, y1 - 1, 'g');
    const cv = shade(g, P, 'kXjgyW', 0.35);
    // Glass is semi-transparent so the scene shows through.
    paint(cv, g, 'GH', (x, y, c) => [c[0], c[1], c[2], 150]);
    glow(cv, g, 'g', '#6fd4ff', 0.3, 1);
    return cv;
  }
  reg('vitrine', () => ({ se: vitrineFig(false), ne: vitrineFig(true) }));

  // ---- The Curator (VESPER), phase 1 (~64×100) -----------------------------------------
  const CURATOR_PAL = {
    Q: '#f2f4f8', P: '#e8ecf2', R: '#dde2ea', c: '#7a7d84', C: '#62656c', d: '#74777e', D: '#7a7d84', t: '#72757c', T: '#5a5d64',
    j: '#1e2a40', L: '#3c8cd8', g: '#6fd8ff', G: '#e0fbff', k: '#1c1024', y: '#d8dce4', Y: '#9aa0aa', f: '#4c5058',
  };
  function curatorP1(back) {
    const g = new Grid(62, 98);
    // Coat: long, narrow at the shoulders, falling to the floor.
    for (let y = 28; y <= 92; y++) {
      const t = (y - 28) / 64;
      g.rect(Math.round(24 - t * 6), y, Math.round(40 + t * 5), y, 't');
    }
    g.rect(17, 92, 45, 93, 'T');
    // Far sleeve & long porcelain fingers.
    g.line(23, 28, 18, 58, 'd', 5);
    g.rect(17, 58, 21, 59, 'C');
    for (let i = 0; i < 3; i++) g.line(18 + i, 60, 17 + i * 1.5, 67 - i, 'P');
    // Porcelain feet under the hem.
    g.rect(26, 94, 29, 96, 'R');
    g.rect(34, 94, 38, 96, 'R');
    // Torso: coat open over a porcelain-plated lattice chest.
    spans(g, [[24, 25, 40], [25, 24, 41], [26, 24, 41], [27, 24, 41]], 'c');
    g.rect(24, 28, 41, 44, 'c');
    if (!back) {
      for (let y = 26; y <= 60; y++) {
        const w = y < 44 ? 3 + (y - 26) / 6 : 6 - (y - 44) / 5;
        if (w <= 0) continue;
        g.rect(Math.round(34 - w / 2), y, Math.round(34 + w / 2), y, 'j');
      }
      // Plates on the lattice.
      g.ell(34, 32, 2.5, 3, 'Q');
      g.ell(34, 40, 3, 3, 'P');
      g.ell(34, 48, 2.5, 3, 'Q');
      for (let y = 27; y <= 58; y += 2) g.px(y % 4 ? 32 : 36, y, 'L');
      for (const y of [29, 36, 44, 52]) g.line(31, y, 37, y, 'L');
      // Lapels and a docent's badge.
      g.line(31, 25, 32, 50, 'C');
      g.line(38, 25, 37, 50, 'C');
      g.rect(26, 34, 29, 36, 'y');
      g.line(26, 35, 29, 35, 'Y');
      g.line(34, 60, 36, 92, 'f');
    } else {
      g.line(32, 28, 32, 92, 'f');
      g.line(26, 50, 23, 90, 'T');
      g.line(38, 50, 41, 90, 'T');
    }
    // Porcelain shoulder plates over the coat.
    g.ell(25, 26, 3.5, 2.5, 'R');
    g.ell(41, 26, 3.5, 2.5, 'P');
    g.line(23, 27, 27, 25, 'L');
    g.line(39, 25, 43, 27, 'L');
    // Lattice at the wrists.
    g.rect(18, 57, 20, 57, 'L');
    g.rect(45, 45, 47, 45, 'L');
    // High collar.
    spans(g, [[21, 27, 29], [22, 27, 29], [23, 26, 29], [21, 36, 38], [22, 36, 38], [23, 36, 39]], 'C');
    // Neck: bare lattice.
    g.rect(31, 19, 35, 24, 'j');
    g.line(31, 20, 35, 23, 'L');
    g.line(35, 20, 31, 23, 'L');
    // Near arm: sleeve, then a long porcelain hand raised in a docent's gesture.
    g.line(41, 27, 45, 44, 'D', 5);
    g.rect(44, 44, 48, 45, 'C');
    g.line(46, 46, 49, 51, 'P', 2);
    for (let i = 0; i < 4; i++) g.line(49, 51, 52 + i, 44 + i * 1.5, 'P');
    g.line(50, 51, 55, 53, 'P');
    // Head: a tall porcelain ovoid split by a seam, with one vertical slit eye.
    g.ell(33, 11, 5.5, 9, 'Q');
    g.rect(28, 15, 38, 20, 'Q');
    g.ell(33, 19, 4.5, 2, 'Q');
    if (!back) {
      g.line(35, 3, 34, 20, 'j');
      g.rect(36, 7, 36, 15, 'g');
      g.px(36, 10, 'G');
      g.px(36, 11, 'G');
      g.line(29, 8, 30, 16, 'R');
    } else {
      g.line(33, 3, 33, 20, 'j');
      g.line(30, 7, 30, 16, 'R');
      g.line(31, 12, 35, 12, 'L');
    }
    const cv = shade(g, CURATOR_PAL, 'kLgGYf', 0.4);
    glow(cv, g, 'gGL', '#6fd4ff', 0.35, 1);
    return cv;
  }
  reg('curator_p1', () => ({ se: curatorP1(false), ne: curatorP1(true) }));

  // ---- The Curator, phase 2: the Core Exhibit (~96×96) -----------------------------------
  function curatorP2() {
    const g = new Grid(94, 94);
    const cx = 47;
    const cy = 42;
    // Tattered coat hanging below the bloom.
    for (let y = 50; y <= 89; y++) {
      const t = (y - 50) / 39;
      g.rect(Math.round(36 - t * 8), y, Math.round(58 + t * 8), y, 't');
    }
    for (let x = 29; x <= 65; x += 3) g.spike(x + 1, 88, x + (x % 2 ? 0 : 2), 92 - (x % 3), 3, 't');
    g.line(47, 62, 47, 89, 'f');
    g.line(40, 60, 35, 88, 'T');
    g.line(54, 60, 59, 88, 'T');
    // Long arms flung wide, sleeves then porcelain hands with splayed fingers.
    g.line(34, 50, 16, 66, 'd', 5);
    g.line(60, 50, 78, 66, 'D', 5);
    g.rect(14, 66, 19, 67, 'C');
    g.rect(76, 66, 81, 67, 'C');
    for (let i = 0; i < 4; i++) {
      g.line(16, 68, 11 + i * 2, 75 + (i % 2) * 2, 'P');
      g.line(79, 68, 76 + i * 2, 75 + ((i + 1) % 2) * 2, 'P');
    }
    // Lattice spine linking head, bloom and coat.
    g.rect(45, 12, 49, 30, 'j');
    for (let y = 13; y <= 29; y += 3) g.line(45, y, 49, y + 2, 'L');
    // Ring of blue lattice behind the petals.
    for (let a = 0; a < 48; a++) {
      const t = (a / 48) * Math.PI * 2;
      g.px(cx + Math.cos(t) * 27, cy + Math.sin(t) * 22, a % 2 ? 'L' : 'j');
      g.px(cx + Math.cos(t) * 26, cy + Math.sin(t) * 21, 'j');
    }
    // Porcelain plates opened outward like petals.
    const petals = 8;
    for (let i = 0; i < petals; i++) {
      const t = -Math.PI / 2 + (i / petals) * Math.PI * 2 + Math.PI / petals;
      const letter = 'QPR'[i % 3];
      const r0 = 11;
      const r1 = 28;
      const ex = Math.cos(t);
      const ey = Math.sin(t) * 0.82;
      g.ell(cx + ex * 19, cy + ey * 19, 6.5 - Math.abs(ey) * 1.5, 6.5 - Math.abs(ex) * 1.5, letter);
      g.spike(cx + ex * r0, cy + ey * r0, cx + ex * r1, cy + ey * r1, 11, letter);
      g.line(cx + ex * (r0 + 2), cy + ey * (r0 + 2), cx + ex * (r1 - 4), cy + ey * (r1 - 4), 'L');
    }
    // Split head riding above the bloom, halves leaning apart; the slit eye burns between.
    g.ell(cx - 4, 8, 3.5, 6.5, 'Q');
    g.ell(cx + 4, 8, 3.5, 6.5, 'P');
    g.rect(cx - 1, 1, cx + 1, 15, '.');
    g.rect(cx, 3, cx, 13, 'g');
    g.px(cx, 7, 'G');
    g.px(cx, 8, 'G');
    // The knot of Lavos-red energy, screaming outward.
    for (let i = 0; i < 14; i++) {
      const t = (i / 14) * Math.PI * 2 + 0.2;
      const L = i % 2 ? 22 : 16;
      g.spike(cx + Math.cos(t) * 8, cy + Math.sin(t) * 7, cx + Math.cos(t) * L, cy + Math.sin(t) * L * 0.85, 3, 'r');
    }
    g.ell(cx, cy, 11, 9.5, 'r');
    g.ell(cx, cy, 8, 7, 'o');
    g.ell(cx, cy, 4.5, 4, 'O');
    g.ell(cx, cy, 1.8, 1.8, 'W');
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2;
      g.line(cx + Math.cos(t) * 2.5, cy + Math.sin(t) * 2.5, cx + Math.cos(t + 1.1) * 9, cy + Math.sin(t + 1.1) * 8, 'm');
    }
    const cv = shade(g, { ...CURATOR_PAL, r: '#b01828', o: '#f04020', O: '#ff9030', W: '#fff4c0', m: '#6c0c1c' }, 'kLgGmf', 0.4);
    glow(cv, g, 'rOW', '#ff5030', 0.3, 2);
    glow(cv, g, 'gGL', '#6fd4ff', 0.3, 1);
    return cv;
  }
  reg('curator_p2', () => curatorP2());

  // ---- Iselle, broken: kneeling, halberd fallen --------------------------------------------
  function iselleBroken() {
    const g = new Grid(48, 48);
    // Fallen halberd along the ground, blade cracked and dim.
    g.line(12, 44, 44, 46, 'z');
    g.line(12, 45, 44, 47, 'Z');
    spans(g, [[37, 3, 4], [38, 3, 6], [39, 4, 8], [40, 5, 10], [41, 6, 11], [42, 8, 12], [43, 10, 12]], 'x');
    g.spike(10, 44, 2, 45, 3, 'x');
    g.line(5, 38, 9, 42, 'j');
    g.px(7, 41, 'j');
    g.rect(11, 43, 13, 45, 'j');
    // Porcelain shards scattered on the ground.
    g.px(40, 44, 'Q');
    g.px(41, 44, 'Q');
    g.px(44, 43, 'Q');
    // Coat pooled around her.
    for (let y = 32; y <= 45; y++) {
      const t = (y - 32) / 13;
      g.rect(Math.round(20 - t * 6), y, Math.round(30 + t * 6), y, 't');
    }
    g.line(22, 34, 17, 44, 'f');
    g.line(26, 35, 25, 45, 'f');
    g.line(30, 34, 33, 44, 'f');
    // Near boot folded under.
    g.rect(31, 42, 37, 45, 'o');
    g.rect(31, 46, 37, 46, 'B');
    // Torso slumped forward.
    spans(g, [[22, 22, 29], [23, 21, 30], [24, 21, 31], [25, 21, 31], [26, 21, 31], [27, 21, 31], [28, 21, 31], [29, 21, 30], [30, 21, 30], [31, 21, 30], [32, 21, 30]], 'c');
    g.rect(21, 31, 30, 32, 'l');
    g.line(26, 23, 27, 30, 'v');
    // Far arm: human hand resting on the knee.
    g.line(21, 24, 19, 32, 'd', 3);
    g.ell(20, 34, 1.6, 1.4, 'A');
    // Near arm: porcelain, limp, fingertips on the ground. Seams dim, one flickering.
    g.rect(30, 22, 33, 25, 'D');
    g.line(32, 26, 34, 36, 'P', 3);
    g.ell(35, 38, 1.8, 1.6, 'P');
    g.px(32, 28, 'g');
    g.px(34, 33, 'q');
    g.px(33, 30, 'q');
    // Bowed head: hair hides the face; porcelain cheek and a dim eye glint beneath.
    g.ell(28, 17, 5.5, 5, 'h');
    spans(g, [[20, 24, 33], [21, 25, 30], [22, 26, 29], [23, 27, 28]], 'h');
    // Porcelain cheek and chin beneath the fringe, one dim eye.
    spans(g, [[19, 31, 34], [20, 31, 34], [21, 31, 34], [22, 30, 33], [23, 29, 32]], 'Q');
    g.px(31, 21, 'q');
    g.px(32, 23, 'q');
    g.px(32, 20, 'G');
    g.px(33, 20, 'k');
    g.spike(33, 14, 34, 21, 3, 'h');
    g.line(24, 14, 27, 22, 'H');
    g.line(28, 13, 30, 20, 'H');
    g.line(31, 14, 33, 19, 'H');
    g.line(25, 13, 28, 12, 'R');
    const cv = shade(g, { ...ISELLE_PAL, q: '#3a7aa8', x: '#9cc4d0' }, 'eEmHRkgGXvyjfq');
    glow(cv, g, 'gG', '#5ab8e8', 0.22, 1);
    paint(cv, g, 'x', (x, y, c) => [c[0], c[1], c[2], 210]);
    return cv;
  }
  reg('iselle_broken', () => iselleBroken());

  // =================================================================================
  // NPCs
  // =================================================================================

  // Hair/headwear pieces shared by the NPC builders (drawn after figure(), before the face mask).
  const HAIR = {
    short(g, back) {
      g.ell(24.5, 8.5, 5.8, 4.6, 'h');
      spans(g, [[10, 19, 21], [11, 19, 21], [12, 19, 21], [13, 20, 21]], 'h');
      if (back) g.ell(25, 11, 5.5, 5, 'h');
      g.line(21, 6, 20, 11, 'H');
      g.line(24, 4, 26, 4, 'R');
    },
    long(g, back) {
      HAIR.short(g, back);
      spans(g, [[14, 19, 21], [15, 19, 21], [16, 19, 21], [17, 19, 21]], 'h');
      if (back) taper(g, 12, 25, 20, 30, 20, 29, 'h');
      if (back) for (const x of [22, 25, 28]) g.line(x, 13, x, 24, 'H');
    },
    wild(g, back) {
      g.ell(24.5, 8.5, 6, 4.8, 'h');
      for (const [a, b, c, d] of [[20, 6, 16, 3], [24, 5, 23, 1], [28, 5, 31, 2], [19, 10, 15, 11], [20, 13, 17, 17]]) g.spike(a, b, c, d, 4, 'h');
      spans(g, [[10, 19, 21], [11, 19, 21], [12, 19, 21]], 'h');
      if (back) {
        g.ell(25, 11, 5.8, 5.5, 'h');
        g.spike(25, 14, 25, 19, 4, 'h');
        g.spike(29, 13, 31, 18, 4, 'h');
      }
      g.line(21, 5, 18, 3, 'H');
      g.line(26, 4, 28, 2, 'R');
    },
    bun(g, back) {
      HAIR.short(g, back);
      g.ell(20, 5.5, 3, 2.8, 'h');
      g.line(19, 4, 21, 4, 'R');
    },
    bald(g, back) {
      spans(g, [[9, 19, 21], [10, 19, 21], [11, 19, 21], [12, 20, 21]], 'h');
      if (back) spans(g, [[11, 20, 30], [12, 20, 30], [13, 20, 29]], 'h');
    },
    cap(g, back) {
      HAIR.short(g, back);
      g.ell(24.5, 6.5, 6, 3.5, 'v');
      if (!back) g.rect(24, 9, 32, 9, 'V');
      else g.rect(19, 9, 30, 9, 'V');
    },
    scarf(g, back) {
      g.ell(24.5, 8, 6.3, 5, 'v');
      spans(g, [[10, 19, 21], [11, 19, 21], [12, 19, 21], [13, 19, 21], [14, 20, 21]], 'v');
      if (back) g.ell(25, 11, 6, 5, 'v');
      g.spike(20, 12, 16, 17, 3, 'v');
      g.line(20, 5, 29, 5, 'V');
      g.line(19, 9, 31, 9, 'V');
    },
    hood(g, back) {
      g.ell(24.5, 10, 7, 7.5, 'u');
      if (back) g.spike(22, 8, 16, 14, 5, 'u');
      g.line(22, 5, 20, 12, 'U');
    },
    straw(g, back) {
      HAIR.short(g, back);
      g.ell(24.5, 5.5, 4.5, 3, 'v');
      g.ell(24.5, 8, 10, 2, 'v');
      g.line(15, 8, 34, 8, 'V');
      g.line(20, 7, 29, 7, 'y');
    },
  };
  // Fringes drawn after the face mask (se only).
  const FRINGE = {
    short(g) {
      g.spike(23, 8, 22, 11, 3, 'h');
      g.spike(26, 8, 26, 10, 3, 'h');
      g.spike(29, 8, 30, 10, 3, 'h');
    },
    long(g) {
      FRINGE.short(g);
    },
    wild(g) {
      g.spike(23, 8, 22, 11, 3, 'h');
      g.spike(27, 8, 27, 11, 3, 'h');
      g.spike(30, 8, 31, 10, 3, 'h');
    },
    bun(g) {
      g.line(22, 9, 30, 9, 'h');
      g.spike(24, 8, 23, 10, 3, 'h');
    },
    bald() {},
    cap(g) {
      g.spike(23, 9, 22, 11, 3, 'h');
    },
    scarf(g) {
      g.rect(22, 9, 31, 9, 'v');
      g.px(22, 10, 'h');
      g.px(23, 10, 'h');
    },
    hood(g) {
      // Fur-trimmed hood rim framing the face.
      g.line(21, 9, 31, 9, 'W');
      g.line(21, 9, 21, 16, 'W');
      g.line(21, 16, 23, 18, 'W');
      g.px(31, 10, 'W');
    },
    straw(g) {
      g.spike(23, 9, 22, 11, 3, 'h');
    },
  };

  // Generic townsperson. spec: { pal, hair, lower: 'pants'|'dress'|'skirt'|'robe', apron, shawl, beard, vest, fur, prop }
  function townsfolk(spec) {
    return personSprite({
      pal: spec.pal,
      body: { farArm: spec.sleeves || 'long', nearArm: spec.sleeves || 'long', legs: !spec.lower || spec.lower === 'pants' || spec.lower === 'skirt' ? (spec.bareLegs ? 'bare' : 'pants') : false, nearHand: spec.nearHand },
      faceOpts: { ear: !['hood', 'scarf', 'long'].includes(spec.hair), closed: spec.closed, brow: spec.brow },
      detail: 'CYZ',
      pre(g, back) {
        if (spec.hair === 'long' && !back) {
          taper(g, 12, 24, 18, 22, 17, 21, 'h');
          g.line(19, 14, 18, 23, 'H');
        }
        if (spec.cloak) taper(g, 18, 45, 19, 30, 16, 33, 'r');
      },
      outfit(g, back) {
        const lower = spec.lower || 'pants';
        if (lower === 'dress' || lower === 'robe') {
          for (let y = 27; y <= 46; y++) {
            const t = (y - 27) / 19;
            g.rect(Math.round(20 - t * (lower === 'robe' ? 2 : 3.5)), y, Math.round(29 + t * (lower === 'robe' ? 2 : 3.5)), y, 't');
          }
          g.line(22, 31, 20, 45, 'T');
          g.line(27, 31, 29, 45, 'T');
          g.rect(21, 46, 23, 46, 'b');
          g.rect(26, 46, 29, 46, 'o');
        }
        if (lower === 'skirt') {
          taper(g, 27, 36, 20, 29, 18, 31, 't');
          g.line(22, 30, 21, 36, 'T');
          g.line(27, 30, 28, 36, 'T');
        }
        if (spec.fur) {
          for (let x = 19; x <= 30; x += 2) g.px(x, 33, 'p');
          for (const [x, y] of [[22, 21], [26, 24], [21, 25], [28, 20], [24, 30], [27, 31]]) g.px(x, y, 'C');
        }
        if (spec.apron && !back) {
          taper(g, 25, 40, 23, 29, 22, 30, 'a');
          g.rect(20, 26, 29, 26, 'a');
        }
        if (spec.vest) {
          spans(g, [[19, 20, 23], [20, 20, 23], [21, 20, 23], [22, 20, 23], [23, 20, 23], [24, 21, 23], [25, 21, 23], [26, 21, 23]], 'a');
          if (!back) spans(g, [[19, 28, 29], [20, 28, 29], [21, 28, 29], [22, 28, 29], [23, 28, 29], [24, 28, 28], [25, 28, 28], [26, 28, 28]], 'a');
          else spans(g, [[19, 24, 29], [20, 24, 29], [21, 24, 29], [22, 24, 29], [23, 24, 29], [24, 24, 28], [25, 24, 28], [26, 24, 28]], 'a');
        }
        if (spec.shawl) {
          spans(g, [[18, 19, 30], [19, 18, 31], [20, 18, 31], [21, 19, 30], [22, 20, 29]], 'w');
          if (!back) g.tri(22, 22, 28, 22, 25, 26, 'w');
          g.line(19, 20, 30, 20, 'W');
        }
        if (spec.stripes) for (let y = 20; y <= 26; y += 2) g.line(20, y, 29, y, 'C');
        if (spec.cloak && back) {
          taper(g, 18, 45, 19, 30, 16, 33, 'r');
          g.line(24, 20, 23, 44, 'R');
        }
        if (!back && spec.buttons) for (let y = 20; y <= 26; y += 2) g.px(26, y, 'Y');
      },
      hair: (g, back) => HAIR[spec.hair || 'short'](g, back),
      fringe(g, back) {
        if (back) return;
        FRINGE[spec.hair || 'short'](g);
        if (spec.beard) {
          spans(g, [[14, 23, 30], [15, 22, 30], [16, 22, 29], [17, 23, 28], [18, 24, 27]], 'w');
          g.rect(26, 14, 30, 14, 'W');
          g.px(27, 15, 'm');
          g.rect(27, 10, 29, 10, 'w');
          g.rect(23, 10, 24, 10, 'w');
        }
        if (spec.moustache) {
          g.rect(25, 14, 30, 14, 'w');
          g.px(24, 15, 'w');
          g.px(31, 15, 'w');
          g.rect(27, 10, 29, 10, 'w');
          g.rect(23, 10, 24, 10, 'w');
        }
      },
      post(g, back) {
        if (spec.prop) spec.prop(g, back);
      },
    });
  }

  // ---- Elder of the Last Village --------------------------------------------------------
  reg('elder', townsfolk({
    pal: { s: '#e8bc98', A: '#e8bc98', F: '#e8bc98', u: '#8c7a6a', U: '#6c5c4c', W: '#f2eee8', w: '#f4f2ee', c: '#7a8aa4', d: '#7a8aa4', D: '#7a8aa4', t: '#6e7e98', T: '#56647c', l: '#5a4a3c', b: '#5a4a3c', o: '#5a4a3c', x: '#9a7a54', X: '#e8e0cc', r: '#8c7a6a', R: '#6c5c4c' },
    hair: 'hood', lower: 'robe', beard: true, cloak: true, closed: true, nearHand: [32, 28],
    prop(g) {
      g.line(33, 45, 34, 8, 'x');
      g.ell(34, 7, 2, 2, 'X');
      g.line(33, 9, 31, 13, 'X');
      g.ell(32, 28, 1.6, 1.4, 'F');
    },
  }));

  // ---- Gaspar, Guru of Time: bowler hat, cane, mustard robes ----------------------------
  HAIR.bowler = (g, back) => {
    spans(g, [[9, 19, 21], [10, 19, 21], [11, 19, 21], [12, 20, 21]], 'h');
    if (back) spans(g, [[9, 20, 30], [10, 20, 30], [11, 21, 29]], 'H');
    g.ell(24.5, 5.5, 5.5, 4, 'v');
    g.rect(18, 8, 31, 8, 'V');
    g.line(20, 7, 29, 7, 'y');
  };
  FRINGE.bowler = () => {};
  reg('gaspar', townsfolk({
    pal: { s: '#f0c8a8', A: '#f0c8a8', F: '#f0c8a8', h: '#e8e4dc', H: '#b0aaa0', R: '#ffffff', v: '#4a3a30', V: '#2e2420', y: '#8a6a4a', w: '#f4f2ee', W: '#c8c4bc', c: '#d8b448', d: '#d8b448', D: '#d8b448', t: '#ceaa40', T: '#a88420', l: '#8a5c2c', b: '#6a4a2c', o: '#6a4a2c', x: '#7a5634' },
    hair: 'bowler', lower: 'robe', moustache: true, closed: true, nearHand: [32, 29],
    prop(g) {
      g.line(33, 30, 34, 46, 'x');
      g.line(33, 30, 34, 27, 'x');
      g.line(34, 27, 36, 28, 'x');
      g.ell(32, 29, 1.6, 1.4, 'F');
    },
  }));

  // ---- Spekkio: small pink horned Nu-like form --------------------------------------------
  reg('spekkio', () => ({
    se: nuFig(false, { s: '#f08cb8', S: '#b8507c', b: '#ffc8dc', t: '#7a3c9c', T: '#9c5cc0', a: '#e880b0', A: '#f08cb8', f: '#e070a0', F: '#f08cb8', h: '#f4e8c8', H: '#c8b890' }, true),
    ne: nuFig(true, { s: '#f08cb8', S: '#b8507c', b: '#ffc8dc', t: '#7a3c9c', T: '#9c5cc0', a: '#e880b0', A: '#f08cb8', f: '#e070a0', F: '#f08cb8', h: '#f4e8c8', H: '#c8b890' }, true),
  }));

  // ---- Villagers ----------------------------------------------------------------------------
  const TOWN = {
    // 600 A.D. (Truce / Guardia)
    villager_600: { hair: 'cap', pal: { h: '#6a4428', H: '#402814', R: '#9a6c44', v: '#4c7a3c', V: '#345a28', c: '#a0643c', d: '#a0643c', D: '#a0643c', l: '#5a3a1c', p: '#6c5c48', q: '#6c5c48', b: '#4a3020', o: '#4a3020' } },
    villager_600_b: { hair: 'scarf', lower: 'dress', apron: true, pal: { s: '#f0c4a0', h: '#8a4c2c', v: '#c8b890', V: '#a09068', c: '#9c3c3c', d: '#9c3c3c', D: '#9c3c3c', t: '#8c3434', T: '#6c2424', a: '#f0ece0', l: '#5a3a1c', b: '#4a3020', o: '#4a3020' } },
    villager_600_c: { hair: 'bald', beard: false, moustache: true, lower: 'pants', vest: true, pal: { s: '#eab894', h: '#c8c0b4', H: '#9a9488', w: '#e8e4dc', W: '#b8b4ac', c: '#e8e0cc', d: '#e8e0cc', D: '#e8e0cc', a: '#3c5a8c', l: '#4a3020', p: '#5a4c3c', q: '#5a4c3c', b: '#3a2818', o: '#3a2818' } },
    // 65,000,000 B.C. (Ioka)
    villager_ioka: { hair: 'wild', fur: true, sleeves: 'bare', bareLegs: true, lower: 'pants', pal: { s: '#dca070', A: '#dca070', F: '#dca070', L: '#dca070', M: '#dca070', S: '#b07448', n: '#c08858', h: '#3c2414', H: '#200e04', R: '#6a4428', c: '#b88448', C: '#6a4018', l: '#6a4a2c', p: '#b88448', b: '#8a5a30', o: '#8a5a30' } },
    villager_ioka_b: { hair: 'long', fur: true, sleeves: 'bare', lower: 'skirt', bareLegs: true, pal: { s: '#e4a878', A: '#e4a878', F: '#e4a878', L: '#e4a878', M: '#e4a878', S: '#b87a50', n: '#c88c60', h: '#a0542c', H: '#6a3014', R: '#d08050', c: '#d8b070', C: '#8a6030', t: '#c89c5c', T: '#8a6030', l: '#6a4a2c', p: '#e4a878', b: '#9a6a3a', o: '#9a6a3a' } },
    villager_ioka_c: { hair: 'wild', fur: true, sleeves: 'bare', bareLegs: true, lower: 'pants', beard: true, pal: { s: '#d09868', A: '#d09868', F: '#d09868', L: '#d09868', M: '#d09868', S: '#a06c44', n: '#b88050', h: '#9a948c', H: '#6a645c', R: '#c8c2b8', w: '#b8b2a8', W: '#8a847c', c: '#8a6a4a', C: '#4a3420', l: '#4a3420', p: '#8a6a4a', b: '#6a4a2c', o: '#6a4a2c' } },
    // 12,000 B.C. (Last Village, snow)
    villager_last: { hair: 'hood', lower: 'robe', pal: { u: '#6c7c94', U: '#4c5a70', W: '#eef0f4', c: '#7c8ca4', d: '#7c8ca4', D: '#7c8ca4', t: '#6c7c94', T: '#52607a', l: '#4a3c30', b: '#4a3c30', o: '#4a3c30' } },
    villager_last_b: { hair: 'hood', lower: 'robe', shawl: true, pal: { s: '#f0cdb4', u: '#e8e4dc', U: '#b8b2a8', W: '#ffffff', w: '#a07c5c', c: '#8a6c54', d: '#8a6c54', D: '#8a6c54', t: '#7c604a', T: '#5c4434', l: '#4a3c30', b: '#4a3c30', o: '#4a3c30' } },
    villager_last_c: { hair: 'hood', lower: 'pants', pal: { s: '#e4b898', u: '#5c7c6c', U: '#3c5a4c', W: '#e4ece8', c: '#6c8c7c', d: '#6c8c7c', D: '#6c8c7c', l: '#3c3024', p: '#4c4c58', q: '#4c4c58', b: '#3c3024', o: '#3c3024' } },
    // 1000 A.D. Millennial Fair
    fairgoer: { hair: 'cap', vest: true, pal: { h: '#5a3a24', H: '#382010', R: '#8a5c3c', v: '#d83c3c', V: '#a02828', c: '#f4f0e4', d: '#f4f0e4', D: '#f4f0e4', a: '#c83838', l: '#3c3024', p: '#3c5ca8', q: '#3c5ca8', b: '#5a3a24', o: '#5a3a24' } },
    fairgoer_b: { hair: 'long', lower: 'dress', sleeves: 'short', pal: { h: '#f0c858', H: '#b88a28', R: '#fff0a0', c: '#f07ca8', d: '#f07ca8', D: '#f07ca8', t: '#ea6c9c', T: '#b84874', l: '#ffffff', b: '#c84874', o: '#c84874' } },
    fairgoer_c: { hair: 'wild', sleeves: 'short', stripes: true, lower: 'pants', pal: { h: '#2c2c44', H: '#14142a', R: '#5c5c80', c: '#f0d048', d: '#f0d048', D: '#f0d048', C: '#3c8c4c', l: '#6a4020', p: '#6a8cc8', q: '#6a8cc8', b: '#e8e4dc', o: '#e8e4dc', B: '#8a8478' } },
    fairgoer_d: { hair: 'bun', lower: 'dress', shawl: true, buttons: true, pal: { s: '#f0c8a8', h: '#b4aec0', H: '#8a8498', R: '#e8e4f0', w: '#8c4cb0', W: '#6a3490', c: '#4c7c8c', d: '#4c7c8c', D: '#4c7c8c', Y: '#f0d060', t: '#3c6c7c', T: '#2c5460', l: '#2c5460', b: '#3c2c24', o: '#3c2c24' } },
  };
  for (const [key, spec] of Object.entries(TOWN)) reg(key, townsfolk(spec));

  // =================================================================================
  // PROPS
  // =================================================================================

  // ---- Epoch: the time machine, hovering (~96×48) ------------------------------------------
  reg('epoch', () => {
    const g = new Grid(94, 46);
    const P = {
      a: '#e6eaf0', b: '#d4dae4', c: '#58607a', C: '#3c4258', r: '#d8403c', R: '#ff8060', y: '#f0c848', G: '#5cc4f0', X: '#ffffff',
      f: '#c8ceda', e: '#4cc4ff', E: '#e0fbff', w: '#7a8298', k: '#1c1024', h: '#9ad8ff',
    };
    // Far wing (up-left) behind the hull.
    g.tri(30, 22, 58, 22, 40, 10, 'f');
    g.line(40, 11, 56, 21, 'w');
    // Tail fin.
    g.tri(8, 22, 22, 22, 11, 5, 'f');
    g.line(11, 7, 14, 20, 'r');
    // Hull: long rounded body, sharp nose to the facing side.
    g.ell(46, 25, 40, 7.5, 'a');
    g.tri(76, 18, 76, 32, 93, 27, 'a');
    // Underside.
    for (let x = 8; x <= 88; x++) {
      const t = Math.abs(x - 46) / 42;
      const h = Math.round(3 * (1 - t * t));
      g.rect(x, 29, x, 29 + h, 'c');
    }
    g.tri(76, 29, 76, 32, 92, 28, 'c');
    // Red speed stripe and gold trim.
    g.line(12, 26, 90, 27, 'r');
    g.line(12, 27, 88, 28, 'R');
    g.line(18, 24, 70, 24, 'y');
    // Canopy.
    g.ell(54, 18, 13, 6, 'G');
    g.rect(41, 21, 67, 22, 'b');
    g.line(46, 15, 52, 13, 'X');
    g.line(47, 16, 50, 15, 'h');
    g.line(58, 13, 64, 16, 'k');
    // Near wing (down-right), in front of the hull.
    g.tri(38, 30, 68, 30, 36, 42, 'b');
    g.line(42, 31, 38, 40, 'w');
    g.line(37, 42, 68, 30, 'r');
    // Rear thrusters.
    g.ell(6, 25, 3, 4, 'C');
    g.ell(5, 25, 1.5, 2.5, 'e');
    g.px(5, 25, 'E');
    // Hover glow on the ground (drawn separately so the craft floats above it).
    g.ell(48, 45, 22, 0.8, 'h');
    const cv = shade(g, P, 'kXwyeER', 0.35);
    glow(cv, g, 'eE', '#8fe0ff', 0.4, 1);
    paint(cv, g, 'h', (x, y, c) => (y > 43 ? [120, 200, 255, 70] : null));
    // The outline pass also rings the glow: soften it.
    const ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    for (let y = 43; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        if (img.data[i + 3] === 255 && img.data[i] < 60) img.data[i + 3] = 0;
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  });

  // ---- Lavos Seed (16×16 egg on a 24×24 canvas) -------------------------------------------
  function seedEgg(inert) {
    const g = new Grid(22, 22);
    const P = inert
      ? { a: '#6c6a72', b: '#8a8890', c: '#4c4a52', v: '#2c2a30', V: '#3c3a40', k: '#1c1024', n: '#7a7880' }
      : { a: '#4a0c18', b: '#7a1824', c: '#2c0610', v: '#ff4030', V: '#ffb060', k: '#1c1024', n: '#8a2030' };
    g.ell(11, 13, 6.3, 7.6, 'a');
    g.ell(9.5, 10.5, 3, 3.5, 'b');
    g.ell(12.5, 16.5, 4, 3, 'c');
    // Little shell nubs, like a Lavos carapace.
    for (const [x, y, tx, ty] of [[7, 8, 5, 5], [11, 6, 11, 3], [15, 8, 17, 5], [5, 13, 3, 12], [17, 13, 19, 12]]) g.spike(x, y, tx, ty, 2.5, 'n');
    // Veins (glowing) or cracks (inert).
    for (const [x0, y0, x1, y1] of [[11, 7, 9, 12], [9, 12, 11, 17], [11, 17, 10, 20], [13, 9, 14, 14], [14, 14, 12, 18], [8, 14, 6, 17]]) g.line(x0, y0, x1, y1, 'v');
    if (!inert) {
      g.px(11, 13, 'V');
      g.px(12, 14, 'V');
      g.px(11, 12, 'V');
    } else {
      g.line(14, 7, 16, 11, 'V');
      g.px(6, 11, 'V');
    }
    const cv = shade(g, P, 'vVk', 0.3);
    if (!inert) glow(cv, g, 'vV', '#ff5a30', 0.45, 1);
    return cv;
  }
  reg('lavos_seed', () => seedEgg(false));
  reg('lavos_seed_inert', () => seedEgg(true));

  // ---- Time gates (48×48): a standing swirl portal -------------------------------------------
  function gate(hollow) {
    return CT.PX.canvas(48, 48, (ctx, cv) => {
      const img = ctx.createImageData(48, 48);
      const d = img.data;
      const cx = 23.5;
      const cy = 25;
      const rx = 15;
      const ry = 21;
      const pal = hollow
        ? [[40, 40, 48], [86, 86, 96], [130, 130, 140], [180, 180, 188], [230, 230, 236]]
        : [[20, 36, 110], [36, 84, 200], [70, 150, 240], [140, 214, 255], [236, 252, 255]];
      for (let y = 0; y < 48; y++)
        for (let x = 0; x < 48; x++) {
          const nx = (x + 0.5 - cx) / rx;
          const ny = (y + 0.5 - cy) / ry;
          const r = Math.sqrt(nx * nx + ny * ny);
          if (r > 1.08) continue;
          const i = (y * 48 + x) * 4;
          let c;
          let a = 255;
          if (r > 1.0) {
            c = [28, 16, 36]; // outline
          } else if (r > 0.9) {
            c = pal[3]; // bright rim
            if (r > 0.95) c = pal[2];
          } else {
            const ang = Math.atan2(ny, nx);
            const v = (ang / (Math.PI * 2)) * 3 + r * 3.2;
            const band = ((Math.floor(v * 2) % 4) + 4) % 4;
            let idx = [0, 1, 2, 1][band];
            if (r < 0.28) idx = 4;
            else if (r < 0.45) idx = Math.max(idx, 3);
            else if (r < 0.6) idx = Math.max(idx, 2);
            c = pal[idx];
            a = r > 0.7 ? 225 : 255;
          }
          if (hollow && y % 3 === 0 && r <= 1.0) c = mix(c, [220, 40, 50], 0.6);
          d[i] = c[0];
          d[i + 1] = c[1];
          d[i + 2] = c[2];
          d[i + 3] = a;
        }
      // Sparkles orbiting the rim.
      for (const [x, y] of [[9, 12], [38, 16], [10, 38], [37, 40], [23, 3], [24, 46]]) {
        if (y > 46) continue;
        const i = (y * 48 + x) * 4;
        const c = hollow ? [240, 80, 80] : [230, 250, 255];
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
        d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
  }
  reg('time_gate', () => gate(false));
  reg('hollow_gate', () => gate(true));
})();
