// portraits.js — dialogue portraits, see docs/ENGINE_SPEC.md §3.
//
// CT.getPortrait(id, emotion) -> 64×64 canvas (cached).
//
// Every portrait is a 62×62 letter grid run through CT.PX.shadeGrid (which
// adds the 1px outline -> 64×64), then a small 2D-context effects pass
// (blush, sweat drop, anger vein, tears, glows).
//
// Face system
// -----------
// Human characters share one construction (`human`): back layer (long hair,
// capes) -> shoulders/clothes -> neck -> head (3/4 view facing screen-right,
// ear on the left) -> front hair -> accessories -> features. Features are
// drawn with *detail* letters so they never split the skin region, and come
// from an emotion descriptor (EMO) that sets eye shape, lid height and slant,
// brow angle, mouth template and effects. Characters tweak it through a spec
// (palette, hair/clothes builders, eye colour, lashes, per-emotion overrides).
// Non-human faces (Frog, Robo, Spekkio, Nu, the Curator) have their own
// builders but read the same EMO descriptors.
(function () {
  const CT = (window.CT = window.CT || {});
  const N = 62; // grid size; shadeGrid pads to 64

  // ---- Grid helpers ------------------------------------------------------------
  function poly(g, pts, c) {
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) g.px(x, y, c);
      }
  }
  const at = (g, x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? '.' : g.a[y][x]);
  // Draw only over pixels whose current letter is in `on`.
  function lineOn(g, x0, y0, x1, y1, c, on) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      if (on.includes(at(g, x, y))) g.px(x, y, c);
    }
  }
  function pxOn(g, x, y, c, on) {
    if (on.includes(at(g, x, y))) g.px(x, y, c);
  }
  // Recolour every pixel of letters `from` for which fn(x,y) is true.
  function recolor(g, from, c, fn = () => true) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (from.includes(g.a[y][x]) && fn(x, y)) g.a[y][x] = c;
  }
  // Text template with a colour remap (letters in rows are keys of `map`, or literal).
  function stamp(g, x0, y0, rows, map = {}) {
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      g.px(x0 + x, y0 + y, map[ch] || ch);
    }));
  }
  const mirrorRows = (rows) => rows.map((r) => [...r].reverse().join(''));

  // ---- Emotions ------------------------------------------------------------------
  // eye: open | wide | arc (closed happy) | closed (downward) | teary
  // lid: rows the upper lid drops; slant >0 inner corner lower (anger), <0 outer lower (sorrow)
  // brow: [outer, inner] offsets from the resting line (negative = up); arch: raise middle
  const EMO = {
    neutral: { eye: 'open', lid: 0, slant: 0, brow: [0, 0], arch: 1, mouth: 'line', fx: [] },
    happy: { eye: 'arc', lid: 0, slant: 0, brow: [-1, -1], arch: 1, mouth: 'grin', fx: ['blush'] },
    angry: { eye: 'open', lid: 1, slant: 2, brow: [-2, 2], arch: 0, mouth: 'shout', fx: ['vein'] },
    sad: { eye: 'open', lid: 1, slant: -2, brow: [1, -2], arch: 0, mouth: 'frown', fx: ['tear'] },
    surprised: { eye: 'wide', lid: 0, slant: 0, brow: [-3, -3], arch: 1, mouth: 'o', fx: ['sweat'] },
    determined: { eye: 'open', lid: 1, slant: 1, brow: [-1, 1], arch: 0, mouth: 'firm', fx: [] },
    broken: { eye: 'teary', lid: 2, slant: -1, brow: [1, -2], arch: 0, mouth: 'weak', fx: ['tears'] },
  };

  // Mouth templates: k outline, M inside, t teeth, T tongue, m soft lip line.
  const MOUTH = {
    line: ['mmm'],
    smile: ['m...m', '.mmm.'],
    grin: ['kkkkkk', 'kMMMMk', '.kTTk.', '..kk..'],
    fang: ['kkkkkk', 'ktMMMk', '.kTTk.', '..kk..'],
    shout: ['kkkkkk', 'kttttk', 'kMMMMk', '.kkkk.'],
    grit: ['kkkkkk', 'ktttt.', 'kkkkkk'],
    frown: ['.mmm.', 'm...m'],
    o: ['.kk.', 'kMMk', 'kMMk', '.kk.'],
    firm: ['kkkkk'],
    smirk: ['....m', 'mmmm.'],
    weak: ['m...m', '.mmm.'],
    flat: ['mmm'],
  };

  // ---- Features ------------------------------------------------------------------
  // Eye in a w×h box at (x0,y0). side 'near' (screen-left, outer corner on the
  // left) or 'far' (screen-right, outer corner on the right). Irises look right.
  function drawEye(g, x0, y0, w, h, side, e, o) {
    const inner = (c) => (side === 'near' ? c / (w - 1) : 1 - c / (w - 1));
    const outerX = side === 'near' ? x0 - 1 : x0 + w;
    const lash = o.lashes;
    if (e.eye === 'arc') {
      const rows = w >= 6 ? ['.kkkk.', 'kk..kk', 'k....k'] : w === 5 ? ['.kkk.', 'kk.kk', 'k...k'] : ['.kk.', 'k..k', 'k..k'];
      const rr = rows.map((r) => (r.length === w ? r : r.slice(0, w)));
      stamp(g, x0, y0 + 1, rr);
      if (lash) g.px(outerX, y0 + 3, 'k');
      return;
    }
    if (e.eye === 'closed') {
      const rows = w >= 5 ? ['k' + '.'.repeat(w - 2) + 'k', '.' + 'k'.repeat(w - 2) + '.'] : ['k..k', '.kk.'];
      stamp(g, x0, y0 + 2, rows);
      if (lash) g.px(outerX, y0 + 2, 'k');
      return;
    }
    const wide = e.eye === 'wide';
    const top = wide ? y0 - 1 : y0;
    const ht = wide ? h + 1 : h;
    const baseLid = (o.lid || 0) + (e.lid || 0);
    const lidAt = (c) => {
      const t = inner(c);
      let l = wide ? 0 : baseLid;
      if (!wide && e.slant > 0) l += Math.round(e.slant * t);
      if (!wide && e.slant < 0) l += Math.round(-e.slant * (1 - t));
      return Math.min(l, ht - 3);
    };
    const irisW = Math.min(w - 1, wide ? Math.max(2, (o.irisW || w - 2) - 1) : o.irisW || w - 2);
    const ia = wide ? w - irisW - 1 : w - irisW;
    const ib = ia + irisW - 1;
    const bottom = top + ht - 1;
    for (let c = 0; c < w; c++) {
      const x = x0 + c;
      const lt = top + lidAt(c);
      for (let y = lt + 1; y < bottom; y++) {
        let ch = 'W';
        if (c >= ia && c <= ib) {
          ch = 'i';
          if (y === lt + 1) ch = 'j';
          else if (y === bottom - 1) ch = 'I';
          const mid = ia + Math.floor((irisW - 1) / 2);
          if ((c === mid || (irisW >= 4 && c === mid + 1)) && y > lt + 1 && y < bottom - 1) ch = 'j';
        }
        g.px(x, y, ch);
      }
      g.px(x, lt, 'k');
      if (side === 'near' && c < w - 1 && o.thickLid !== false) g.px(x, lt - 1, 'k');
      if (c !== (side === 'near' ? 0 : w - 1)) g.px(x, bottom, 'L');
    }
    // Highlight at the iris' top-left (light from the top-left).
    const lt0 = top + lidAt(ia);
    if (lt0 + 1 < bottom - 1) g.px(x0 + ia, lt0 + 1, 'w');
    else if (lt0 + 1 < bottom) g.px(x0 + ia, lt0 + 1, 'w');
    if (wide) g.px(x0 + ia + 1, top + 2, 'w');
    if (e.eye === 'teary') {
      g.px(x0 + ib, bottom - 1, 'w');
      for (let c = 1; c < w; c++) g.px(x0 + c, bottom, 'Q');
    }
    // Outer-corner lash flick.
    const lo = top + lidAt(side === 'near' ? 0 : w - 1);
    g.px(outerX, lo, 'k');
    if (lash) {
      g.px(outerX, lo + 1, 'k');
      g.px(side === 'near' ? outerX - 1 : outerX + 1, lo - 1, 'k');
    }
  }

  function drawBrow(g, x0, x1, y, side, e, o) {
    if (o.noBrows) return;
    const outer = y + e.brow[0];
    const inner = y + e.brow[1];
    const [ly, ry] = side === 'near' ? [outer, inner] : [inner, outer];
    const mid = Math.round((x0 + x1) / 2);
    const my = Math.round((ly + ry) / 2) - (e.arch && Math.abs(ly - ry) < 2 ? 1 : 0);
    const c = o.browLetter || 'b';
    g.line(x0, ly, mid, my, c);
    g.line(mid, my, x1, ry, c);
    if ((o.browThick || 1) > 1) {
      // Thicken, tapering toward the outer end.
      const a = side === 'near' ? x0 + 1 : x0;
      const b = side === 'near' ? x1 : x1 - 1;
      for (let x = a; x <= b; x++) {
        const t = (x - x0) / Math.max(1, x1 - x0);
        const yy = x <= mid ? ly + (my - ly) * ((x - x0) / Math.max(1, mid - x0)) : my + (ry - my) * ((x - mid) / Math.max(1, x1 - mid));
        g.px(x, Math.round(yy) + 1, c);
        if ((o.browThick || 1) > 2 && t > 0.2 && t < 0.8) g.px(x, Math.round(yy) - 1, c);
      }
    }
  }

  function drawMouth(g, mx, my, kind, o) {
    const rows = (o.mouths && o.mouths[kind]) || MOUTH[kind] || MOUTH.line;
    const w = rows[0].length;
    stamp(g, Math.round(mx - w / 2), my, rows);
  }

  // Standard pair of eyes + brows + mouth + nose for the default head.
  const FACE = {
    near: [22, 27, 6, 6],
    far: [35, 27, 4, 6],
    browY: 24,
    mouth: [37, 39],
  };
  function features(g, o, e) {
    const F = Object.assign({}, FACE, o.face || {});
    const [nx, ny, nw, nh] = F.near;
    const [fx, fy, fw, fh] = F.far;
    const eo = Object.assign({}, o);
    drawBrow(g, nx - 1, nx + nw, F.browY, 'near', e, o);
    drawBrow(g, fx, fx + fw, F.browY, 'far', e, o);
    drawEye(g, nx, ny, nw, nh, 'near', e, eo);
    drawEye(g, fx, fy, fw, fh, 'far', e, Object.assign({}, eo, { irisW: Math.max(2, (o.irisW || nw - 2) - 1) }));
    if (o.nose !== false) (o.nose || defaultNose)(g, e);
    if (e.mouth && o.mouth !== false) drawMouth(g, F.mouth[0], F.mouth[1] + (e.mouthDy || 0), e.mouth, o);
  }
  function defaultNose(g) {
    g.px(43, 33, 'N');
    g.px(43, 34, 'N');
    g.px(44, 35, 'N');
  }

  // ---- Human base ----------------------------------------------------------------
  const HEAD = [
    [14, 22], [17, 14], [24, 9], [34, 8], [41, 12], [44, 19], [44, 28], [45, 30], [47, 33], [47, 34],
    [45, 35], [44, 37], [44, 38], [42, 41], [39, 44], [35, 46], [30, 45], [24, 42], [19, 38], [15, 32],
  ];
  const NECK = [[22, 38], [36, 42], [36, 55], [21, 55]];
  const SHOULDERS = [[0, 62], [1, 55], [8, 51], [18, 49], [40, 49], [52, 52], [60, 57], [62, 62]];

  const SKIN_LIGHT = { f: '#f6c9a0', n: '#d89c78', e: '#eab690', E: '#c07a58', N: '#d4926c' };
  const FEAT = {
    W: '#fbf8f2', w: '#ffffff', L: '#7a4a4a', m: '#8a3a38', M: '#5a1624', t: '#fbf8f0', T: '#e0707c', Q: '#a8e0ff',
  };
  const DETAIL = 'NEWwiIjLbmMtTQHRCDGKXYVU';

  function human(o, e) {
    const g = new N_Grid();
    if (o.back) o.back(g, e);
    poly(g, o.shoulders || SHOULDERS, 'c');
    if (o.body) o.body(g, e);
    poly(g, o.neck || NECK, 'n');
    if (o.collar) o.collar(g, e);
    poly(g, o.head || HEAD, 'f');
    if (o.ear !== false) {
      g.ell(16, 31, 2.5, 4, 'e');
      g.line(16, 29, 16, 33, 'E');
      g.px(17, 29, 'E');
    }
    if (o.jaw) o.jaw(g, e);
    if (o.hair) o.hair(g, e);
    if (o.acc) o.acc(g, e);
    features(g, o, e);
    if (o.post) o.post(g, e);
    return g;
  }
  function N_Grid() {
    return new CT.PX.Grid(N, N);
  }

  // ---- Effects (canvas coordinates = grid + 1) ------------------------------------
  function putPx(ctx, x, y, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  }
  function tpl(ctx, x0, y0, rows, cols) {
    rows.forEach((r, y) => [...r].forEach((ch, x) => cols[ch] && putPx(ctx, x0 + x, y0 + y, cols[ch])));
  }
  const FX = {
    blush(ctx, o) {
      for (const [x, y, w] of o.blush || [[20, 35, 7], [40, 35, 3]]) {
        ctx.fillStyle = 'rgba(255,90,120,0.42)';
        ctx.fillRect(x + 1, y + 1, w, 2);
        for (let i = 0; i + 1 < w; i += 2) {
          putPx(ctx, x + 2 + i, y + 1, 'rgba(222,52,88,0.9)');
          putPx(ctx, x + 1 + i, y + 2, 'rgba(222,52,88,0.9)');
        }
      }
    },
    sweat(ctx, o) {
      const [x, y] = o.sweatAt || [47, 14];
      tpl(ctx, x, y, ['...o...', '..oLo..', '.oLLLo.', 'oLWLLlo', 'oLWLLlo', 'oLLLllo', '.olllo.', '..ooo..'], {
        o: '#1c2c58', L: '#8cd0ff', l: '#4c9ce0', W: '#ffffff',
      });
    },
    vein(ctx, o) {
      const [x, y] = o.veinAt || [46, 5];
      tpl(ctx, x, y, ['..kR.Rk..', '.kRR.RRk.', 'kRRk.kRRk', 'RRk...kRR', '.........', 'RRk...kRR', 'kRRk.kRRk', '.kRR.RRk.', '..kR.Rk..'], {
        R: '#f0283c', k: '#6a0c1c',
      });
    },
    tear(ctx, o) {
      const [x, y] = o.tearAt || [21, 33];
      tpl(ctx, x, y, ['L', 'L', 'LL', 'LW', 'll'], { L: '#9ad8ff', l: '#4c9ce0', W: '#ffffff' });
    },
    tears(ctx, o) {
      for (const [x, y, n] of o.tearsAt || [[22, 33, 7], [38, 33, 5]]) {
        for (let i = 0; i < n; i++) {
          const xx = x + (i > n / 2 ? 1 : 0);
          putPx(ctx, xx, y + i, i % 3 === 1 ? '#ffffff' : '#8ad0ff');
          putPx(ctx, xx + 1, y + i, '#4c9ce0');
        }
        putPx(ctx, x + 1, y + n, '#4c9ce0');
      }
    },
    sparkle(ctx, o) {
      const [x, y] = o.sparkleAt || [48, 8];
      tpl(ctx, x, y, ['..y..', '..Y..', 'yYWYy', '..Y..', '..y..'], { y: '#f0c040', Y: '#fff0a0', W: '#ffffff' });
    },
    shock(ctx, o) {
      const [x, y] = o.shockAt || [46, 6];
      for (const [dx, dy, ex, ey] of [[0, 4, 2, 6], [3, 0, 4, 3], [7, 2, 5, 4]]) {
        ctx.strokeStyle = '#1c1030';
        ctx.beginPath();
        ctx.moveTo(x + dx + 0.5, y + dy + 0.5);
        ctx.lineTo(x + ex + 0.5, y + ey + 0.5);
        ctx.stroke();
      }
    },
  };
  // Soft glow around pixels of a given colour (for seams, visors, slit eyes).
  function glow(ctx, rgbTest, color, radius = 1, alpha = 0.35) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const d = ctx.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] && rgbTest(d[i], d[i + 1], d[i + 2])) pts.push([x, y]);
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    const seen = new Set();
    for (const [x, y] of pts)
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        if (!dx && !dy) continue;
        if (Math.abs(dx) + Math.abs(dy) > radius + 0) continue;
        const k = (x + dx) + ',' + (y + dy);
        if (seen.has(k)) continue;
        const j = ((y + dy) * W + (x + dx)) * 4;
        if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) continue;
        if (!d[j + 3]) continue; // only over the figure
        if (rgbTest(d[j], d[j + 1], d[j + 2])) continue;
        seen.add(k);
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
    ctx.globalAlpha = 1;
  }
  function desaturate(ctx, amt, tint = [0, 0, 0]) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, d[i + k] + (l - d[i + k]) * amt + tint[k]));
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- Hair helpers ----------------------------------------------------------------
  // A lock: tapered polygon from a base (bx,by) of width w to a tip, bending via (cx,cy).
  function lock(g, bx, by, cx, cy, tx, ty, w, c) {
    const pts = [];
    const n = 8;
    const L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * tx;
      const y = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * ty;
      const dx = 2 * (1 - t) * (cx - bx) + 2 * t * (tx - cx);
      const dy = 2 * (1 - t) * (cy - by) + 2 * t * (ty - cy);
      const len = Math.hypot(dx, dy) || 1;
      const hw = (w / 2) * (1 - t * 0.92);
      L.push([x - (dy / len) * hw, y + (dx / len) * hw]);
      R.push([x + (dy / len) * hw, y - (dx / len) * hw]);
    }
    poly(g, [...L, ...R.reverse()], c);
    void pts;
  }
  // Curved strand line (quadratic) drawn only over the given letters.
  function strand(g, bx, by, cx, cy, tx, ty, c, on) {
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * tx;
      const y = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * ty;
      pxOn(g, Math.round(x), Math.round(y), c, on);
    }
  }

  // ---- Characters ------------------------------------------------------------------
  const SPECS = {};

  // CRONO — spiky red hair, white headband with tails, blue tunic.
  SPECS.crono = {
    pal: Object.assign({}, SKIN_LIGHT, {
      h: '#dc4430', H: '#8c2014', R: '#ff9a60', b: '#8c2014', i: '#8a4020', I: '#d08040', j: '#2a1008',
      x: '#f4f0e8', X: '#b8aca0', c: '#2f6fc0', C: '#1c4a8c', v: '#8cc0f0', l: '#8a5a2c', a: '#e0b050',
    }),
    browThick: 2,
    back(g) {
      g.ell(27, 18, 17, 12, 'h');
      const sp = [
        [31, 9, 35, -2, 10], [24, 9, 17, -3, 10], [18, 12, 4, 1, 10], [15, 18, -1, 12, 9], [14, 24, 0, 28, 8],
        [16, 29, 5, 38, 7], [37, 9, 46, 0, 8], [41, 13, 51, 9, 6],
      ];
      for (const [a, b, c, d, w] of sp) g.spike(a, b, c, d, w, 'h');
      // Headband tails streaming back.
      g.tri(15, 19, 16, 23, 0, 31, 'x');
      g.tri(15, 22, 17, 24, 4, 39, 'x');
    },
    body(g) {
      poly(g, [[24, 48], [37, 48], [31, 58]], 'v');
      g.line(24, 48, 31, 58, 'C');
      g.line(37, 48, 31, 58, 'C');
      g.line(41, 49, 29, 62, 'l', 3);
      g.px(44, 51, 'a');
    },
    hair(g) {
      g.ell(30, 12, 13, 5, 'h');
      poly(g, [[14, 23], [16, 14], [24, 9], [40, 9], [44, 16], [44, 18], [15, 22]], 'h');
      // Bangs spilling from under the band.
      for (const [a, b, c, d, w] of [[23, 19, 22, 26, 5], [30, 18, 31, 25, 5], [37, 17, 40, 23, 4], [19, 20, 17, 27, 4], [42, 16, 45, 21, 3]])
        g.spike(a, b, c, d, w, 'h');
      for (const [a, b, c, d] of [[31, 9, 34, 0], [24, 9, 18, -1], [18, 12, 6, 3], [15, 18, 2, 13], [15, 24, 2, 28], [37, 9, 45, 2], [23, 20, 22, 25], [30, 19, 31, 24], [37, 18, 39, 22]])
        lineOn(g, a, b, c, d, 'H', 'h');
      for (const [a, b, c, d] of [[27, 8, 22, 1], [22, 11, 12, 5], [33, 8, 35, 2], [18, 16, 7, 12]]) lineOn(g, a, b, c, d, 'R', 'h');
      // Headband across the brow, knotted behind the ear.
      for (let d = 0; d < 3; d++) lineOn(g, 13, 17 + d, 46, 13 + d, 'x', 'hf');
      lineOn(g, 13, 19, 46, 15, 'X', 'x');
      g.ell(13, 19, 2, 2, 'x');
      g.px(13, 20, 'X');
      // A couple of spikes falling over the band.
      g.spike(27, 12, 29, 20, 4, 'h');
      g.spike(35, 11, 37, 18, 4, 'h');
      lineOn(g, 27, 13, 28, 19, 'H', 'h');
    },
  };

  // MARLE — blonde high ponytail, blue eyes, white top, pendant.
  SPECS.marle = {
    pal: Object.assign({}, SKIN_LIGHT, {
      f: '#fad4b0', h: '#f4cc58', g: '#e0b040', H: '#b0802a', R: '#fff0a8', b: '#b0802a', i: '#2f6ad0', I: '#7ab8ff', j: '#141a48',
      c: '#f4f2ec', C: '#b8c0d8', d: '#3a68c0', a: '#f0c040', o: '#7ad0ff', x: '#ffffff', X: '#c8c8d8', p: '#f07a50',
    }),
    lashes: true,
    back(g) {
      // Ponytail: gathered high at the back, cascading down behind the shoulder.
      lock(g, 17, 9, 0, 12, 3, 48, 15, 'g');
      lock(g, 14, 12, 6, 30, 11, 54, 10, 'g');
      lock(g, 16, 8, 8, 2, 2, 8, 7, 'g');
      g.ell(27, 20, 15, 13, 'h');
    },
    body(g) {
      poly(g, [[22, 49], [38, 49], [36, 54], [24, 54]], 'd');
      poly(g, [[23, 49], [37, 49], [35, 52], [25, 52]], 'c');
      g.line(10, 55, 20, 51, 'C');
      g.line(44, 51, 52, 55, 'C');
    },
    collar(g) {
      // Pendant on a chain.
      g.line(23, 44, 30, 51, 'a');
      g.line(36, 45, 31, 51, 'a');
      g.ell(30.5, 52.5, 2, 2, 'o');
      g.px(30, 52, 'x');
    },
    hair(g) {
      poly(g, [[13, 26], [14, 15], [22, 8], [34, 7], [42, 11], [46, 20], [45, 24], [40, 18], [33, 22], [28, 18], [22, 22], [18, 20], [17, 30]], 'h');
      // Side lock framing the face (far side) and near side.
      lock(g, 44, 18, 47, 28, 45, 38, 5, 'h');
      lock(g, 17, 20, 13, 30, 15, 40, 6, 'h');
      // Scrunchie.
      g.ell(16, 10, 3, 2.5, 'p');
      g.spike(15, 9, 11, 5, 3, 'p');
      g.spike(15, 11, 11, 14, 3, 'p');
      for (const [a, b, c, d, e, f] of [[20, 10, 26, 14, 30, 21], [30, 8, 37, 12, 40, 18], [18, 14, 17, 22, 15, 34], [44, 20, 46, 28, 45, 36], [12, 16, 4, 24, 5, 44]])
        strand(g, a, b, c, d, e, f, 'H', 'hg');
      for (const [a, b, c, d, e, f] of [[24, 9, 30, 10, 33, 14], [16, 14, 10, 20, 8, 34]]) strand(g, a, b, c, d, e, f, 'R', 'hg');
    },
    acc(g) {
      g.ell(19, 38, 1, 1, 'a');
    },
  };

  // LUCCA — purple hair, green helmet with goggles, round glasses, orange top.
  SPECS.lucca = {
    pal: Object.assign({}, SKIN_LIGHT, {
      h: '#8a64c8', H: '#4c3478', R: '#bca0f0', b: '#4c3478', i: '#6a4a3a', I: '#b0806a', j: '#1c1010',
      c: '#e8782c', C: '#a04818', d: '#3c9c50', D: '#1c5a2c', a: '#c8ccd8', o: '#ffb040', O: '#fff0b0', F: '#3a2c50', x: '#dfe8f0',
    }),
    lashes: true,
    face: { browY: 22 },
    back(g) {
      g.ell(26, 24, 17, 15, 'h');
      lock(g, 16, 22, 9, 32, 12, 44, 10, 'h');
    },
    body(g) {
      poly(g, [[22, 49], [38, 49], [35, 53], [25, 53]], 'd');
      g.line(12, 54, 20, 51, 'C');
      g.line(44, 51, 52, 56, 'C');
    },
    hair(g) {
      // Helmet dome with a brim and goggles strapped on.
      g.ell(28, 12, 17, 10, 'd');
      poly(g, [[10, 16], [46, 14], [48, 17], [11, 20]], 'd');
      for (let d = 0; d < 1; d++) g.line(10, 18 + d, 47, 16 + d, 'D');
      // Goggles on the helmet front.
      g.ell(30, 11, 4, 3.5, 'a');
      g.ell(39, 11, 3.5, 3.5, 'a');
      g.ell(30, 11, 2.5, 2, 'o');
      g.ell(39, 11, 2, 2, 'o');
      g.px(29, 10, 'O');
      g.px(38, 10, 'O');
      g.line(12, 12, 25, 11, 'D');
      // Bangs peeking from under the brim.
      poly(g, [[15, 19], [45, 17], [44, 22], [39, 20], [35, 23], [30, 20], [24, 23], [20, 21], [16, 27]], 'h');
      lock(g, 43, 18, 47, 27, 45, 36, 6, 'h');
      lock(g, 17, 19, 12, 30, 15, 42, 9, 'h');
      for (const [a, b, c, d, e, f] of [[24, 20, 23, 22, 22, 24], [34, 19, 34, 21, 35, 23], [16, 22, 12, 30, 14, 40], [44, 20, 46, 27, 45, 34], [10, 26, 8, 34, 11, 42]]) strand(g, a, b, c, d, e, f, 'H', 'h');
      strand(g, 14, 22, 11, 28, 11, 34, 'R', 'h');
    },
    post(g, e) {
      // Round glasses over both eyes.
      const ring = (cx, cy, rx, ry) => {
        for (let a = 0; a < 64; a++) {
          const t = (a / 64) * Math.PI * 2;
          g.px(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), 'F');
        }
      };
      ring(24.5, 30, 5, 4.5);
      ring(37, 30, 3.5, 4.5);
      g.line(30, 29, 33, 29, 'F');
      g.line(14, 28, 19, 29, 'F');
      if (e.glare) {
        g.ell(24.5, 30, 4, 3.5, 'x');
        g.ell(37, 30, 2.5, 3.5, 'x');
        g.line(21, 31, 25, 27, 'w');
        g.line(36, 31, 38, 28, 'w');
      } else {
        g.px(21, 27, 'x');
        g.px(20, 28, 'x');
      }
    },
    emo: { determined: { glare: true } },
  };

  // AYLA — wild blonde-brown mane, tan skin, fur top, blue eyes.
  SPECS.ayla = {
    pal: {
      f: '#dc9a66', n: '#c07c4c', e: '#d08c5a', E: '#9a5c34', N: '#b87448', s: '#d89460',
      h: '#c8984e', g: '#a8783a', H: '#7a5024', R: '#f0d088', b: '#7a5024', i: '#2a78d0', I: '#7ac0ff', j: '#101838',
      c: '#a86e3c', C: '#e8bc84', D: '#6a3e1c', z: '#ecd6a8', o: '#3ab0c0', L: '#6a3a2a',
    },
    lashes: true,
    mouths: { line: ['m...m', '.mmm.'] },
    shoulders: [[0, 62], [1, 55], [8, 51], [18, 49], [40, 49], [52, 52], [60, 57], [62, 62]],
    back(g) {
      // Big wild mane: a mass behind the head with thick wavy locks fanning out.
      g.ell(28, 28, 19, 21, 'g');
      for (const [bx, by, cx, cy, tx, ty, w] of [
        [16, 12, 4, 14, 0, 26, 11], [12, 24, 1, 32, 2, 46, 11], [13, 36, 4, 46, 6, 60, 11], [20, 42, 14, 52, 16, 62, 10],
        [40, 12, 52, 12, 56, 24, 9], [45, 24, 55, 32, 54, 46, 9], [44, 36, 52, 46, 50, 58, 9],
        [24, 8, 22, 1, 15, -1, 9], [34, 7, 40, 0, 47, 2, 9], [20, 10, 10, 4, 4, 8, 8],
      ]) lock(g, bx, by, cx, cy, tx, ty, w, 'g');
      g.ell(28, 18, 16, 12, 'h');
    },
    body(g) {
      recolor(g, 'c', 's');
      // Fur top slung over the far shoulder, bare near shoulder.
      poly(g, [[6, 62], [9, 58], [14, 59], [19, 56], [24, 57], [29, 55], [34, 55], [38, 52], [42, 50], [47, 51], [52, 52], [58, 56], [62, 62]], 'c');
      for (const [x, y] of [[12, 60], [18, 59], [24, 60], [30, 58], [36, 57], [41, 54], [47, 55], [53, 57], [21, 61], [33, 61], [45, 59], [56, 60]]) {
        g.px(x, y, 'C');
        g.px(x + 1, y - 1, 'C');
      }
      for (const [x, y] of [[15, 61], [27, 60], [39, 59], [50, 60]]) g.px(x, y, 'D');
    },
    hair(g) {
      poly(g, [[13, 28], [14, 15], [22, 7], [36, 6], [44, 11], [47, 18], [44, 18], [15, 22]], 'h');
      // Messy bangs.
      for (const [bx, by, cx, cy, tx, ty, w] of [
        [19, 12, 16, 20, 17, 28, 8], [27, 10, 25, 18, 27, 25, 8], [35, 10, 37, 17, 39, 24, 7], [42, 12, 46, 17, 47, 24, 6],
        [44, 18, 49, 30, 47, 42, 6], [16, 20, 11, 32, 13, 46, 7],
      ]) lock(g, bx, by, cx, cy, tx, ty, w, 'h');
      for (const [a, b, c, d, e, f] of [[19, 13, 17, 20, 17, 26], [27, 11, 26, 18, 27, 23], [35, 11, 37, 17, 38, 22], [45, 20, 48, 30, 47, 40], [15, 24, 12, 34, 13, 44],
        [8, 16, 3, 24, 2, 34], [8, 32, 4, 42, 6, 54], [48, 20, 53, 28, 53, 40], [26, 6, 22, 2, 17, 1], [38, 6, 42, 2, 46, 3]])
        strand(g, a, b, c, d, e, f, 'H', 'hg');
      for (const [a, b, c, d, e, f] of [[23, 8, 20, 11, 19, 17], [31, 7, 30, 12, 30, 17], [10, 20, 6, 28, 6, 38], [13, 12, 8, 12, 4, 16]]) strand(g, a, b, c, d, e, f, 'R', 'hg');
      // Beads braided into the side locks.
      g.rect(46, 41, 47, 42, 'o');
      g.rect(13, 45, 14, 46, 'o');
    },
    emo: { happy: { mouth: 'fang' }, determined: { mouth: 'smirk', fx: [] } },
  };

  // MAGUS — long dark hair with a blue sheen, pale, pointed ears, high dark collar, red eyes.
  SPECS.magus = {
    pal: {
      f: '#f2dcd6', n: '#d4b4b6', e: '#ecd2cc', E: '#b08a90', N: '#c8a0a4',
      h: '#262c42', g: '#1a1e2e', H: '#0c0e18', R: '#5a78b8', b: '#10141e', i: '#c01c3c', I: '#ff5a78', j: '#2a0410', L: '#5a3040',
      c: '#2c2c3c', C: '#16161f', d: '#8a1c30', a: '#a8acc0', A: '#6a6e84', m: '#8a5058',
    },
    irisW: 3,
    lid: 1,
    browThick: 2,
    ear: false,
    head: [
      [15, 22], [17, 14], [24, 9], [34, 8], [41, 12], [44, 19], [44, 28], [45, 30], [47, 33], [47, 34],
      [45, 35], [44, 37], [44, 38], [42, 41], [38, 45], [35, 48], [30, 45], [24, 41], [19, 37], [16, 32],
    ],
    face: { near: [22, 27, 6, 6], far: [35, 27, 4, 6], browY: 24, mouth: [38, 40] },
    mouths: { line: ['mmm'], grin: ['....m', 'mmmm.'] },
    back(g) {
      // Hair falling down the back, then the cape's standing collar around it.
      poly(g, [[18, 8], [34, 4], [46, 10], [52, 28], [54, 50], [56, 62], [4, 62], [6, 46], [9, 26]], 'g');
      poly(g, [[2, 62], [3, 44], [7, 30], [12, 40], [18, 52], [20, 62]], 'd');
      poly(g, [[2, 62], [3, 46], [5, 34], [9, 44], [15, 54], [16, 62]], 'c');
      poly(g, [[60, 62], [59, 44], [55, 30], [50, 40], [44, 52], [42, 62]], 'd');
      poly(g, [[60, 62], [59, 46], [57, 34], [53, 44], [47, 54], [46, 62]], 'c');
    },
    shoulders: [[4, 62], [6, 55], [12, 51], [20, 50], [40, 50], [50, 52], [56, 56], [58, 62]],
    body(g) {
      // Armoured shoulders with silver trim, dark gorget at the throat.
      g.ell(12, 57, 8, 5, 'A');
      g.ell(49, 57, 8, 5, 'A');
      g.line(5, 58, 18, 53, 'a');
      g.line(43, 53, 56, 58, 'a');
      poly(g, [[20, 50], [42, 50], [38, 62], [24, 62]], 'C');
      g.ell(31, 55, 2, 1.5, 'd');
    },
    collar(g) {
      poly(g, [[21, 45], [36, 47], [40, 45], [41, 52], [31, 55], [20, 52]], 'c');
      g.line(21, 51, 31, 54, 'a');
      g.line(31, 54, 41, 51, 'a');
    },
    hair(g) {
      // Centre-parted fringe.
      poly(g, [[13, 30], [14, 15], [22, 7], [36, 6], [44, 11], [47, 20], [46, 30], [43, 21], [37, 14], [32, 12], [27, 14], [20, 21], [17, 32]], 'h');
      lock(g, 30, 12, 27, 19, 28, 28, 3, 'h');
      lock(g, 44, 16, 50, 32, 48, 58, 7, 'h');
      lock(g, 18, 16, 11, 34, 11, 60, 9, 'h');
      for (const [a, b, c, d, e, f] of [[24, 8, 20, 14, 18, 24], [31, 7, 28, 10, 26, 14], [38, 8, 42, 12, 44, 20], [46, 22, 49, 36, 48, 54], [15, 20, 11, 36, 11, 56], [8, 20, 5, 36, 6, 56], [50, 16, 53, 30, 53, 50]])
        strand(g, a, b, c, d, e, f, 'H', 'hg');
      for (const [a, b, c, d, e, f] of [[26, 8, 22, 11, 20, 17], [33, 7, 36, 9, 39, 13], [15, 18, 12, 30, 12, 44], [47, 24, 49, 34, 49, 44], [10, 16, 7, 26, 7, 40]])
        strand(g, a, b, c, d, e, f, 'R', 'hg');
      // Pointed ear poking through.
      poly(g, [[16, 28], [7, 21], [10, 27], [17, 35]], 'e');
      g.line(10, 24, 15, 31, 'E');
    },
    emo: {
      neutral: { brow: [-1, 1], arch: 0 },
      happy: { eye: 'open', lid: 1, slant: 0, brow: [-1, 0], arch: 0, mouth: 'smirk', fx: [] },
      angry: { mouth: 'grit', brow: [-2, 3] },
      sad: { fx: [], mouth: 'flat', lid: 1, slant: -1 },
      surprised: { fx: [], mouth: 'flat', brow: [-2, -2], arch: 0 },
      determined: { mouth: 'flat', brow: [-1, 2] },
    },
  };

  // Default emotional tuning for stoic characters is handled through `emo`.

  // KING GUARDIA XXI — crown, brown beard, red cape with ermine.
  SPECS.king = {
    pal: Object.assign({}, SKIN_LIGHT, {
      f: '#f0c0a0', h: '#8a6040', H: '#5a3a24', R: '#b8906a', B: '#9a7050', b: '#5a3a24', i: '#5a3a24', I: '#9a6a44', j: '#1c1008',
      c: '#b8283a', C: '#781828', z: '#f4f0e8', D: '#1c1820', a: '#f0c040', A: '#b88a20', o: '#e02838', O: '#3a8ae0',
    }),
    irisW: 3,
    lid: 1,
    browThick: 3,
    face: { mouth: [38, 40] },
    mouths: { line: ['kkkk'], grin: ['kkkkk', 'kMMMk', '.kkk.'], shout: ['kkkkk', 'ktttk', 'kMMMk', '.kkk.'], smile: ['k...k', '.kkk.'] },
    back(g) {
      g.ell(26, 22, 15, 14, 'h');
    },
    body(g) {
      // Ermine collar.
      poly(g, [[4, 60], [8, 52], [18, 48], [42, 48], [52, 52], [58, 60], [48, 58], [40, 55], [22, 55], [12, 58]], 'z');
      for (const [x, y] of [[10, 55], [17, 51], [26, 53], [34, 53], [43, 51], [50, 55]]) {
        g.px(x, y, 'D');
        g.px(x, y + 1, 'D');
      }
      g.line(24, 58, 31, 61, 'a');
      g.line(38, 58, 31, 61, 'a');
    },
    jaw(g) {
      // Beard along the jaw and chin, moustache above the mouth.
      poly(g, [[17, 33], [21, 38], [26, 41], [30, 42], [36, 40], [44, 37], [44, 39], [42, 43], [38, 48], [33, 51], [27, 49], [21, 45], [16, 38]], 'B');
      poly(g, [[31, 38], [36, 36], [41, 36], [45, 38], [44, 40], [40, 39], [34, 40], [31, 40]], 'B');
      for (const [a, b, c, d] of [[20, 40, 25, 47], [26, 43, 29, 49], [33, 43, 34, 50], [38, 42, 38, 47], [36, 38, 41, 38]]) lineOn(g, a, b, c, d, 'H', 'B');
    },
    hair(g) {
      poly(g, [[13, 30], [14, 16], [22, 10], [38, 9], [44, 14], [45, 20], [40, 16], [30, 15], [22, 17], [18, 22], [17, 32]], 'h');
      // Crown.
      poly(g, [[16, 14], [42, 11], [43, 4], [39, 8], [36, 1], [32, 7], [28, 0], [24, 7], [20, 2], [18, 9], [15, 5]], 'a');
      g.line(16, 13, 42, 10, 'A');
      g.px(28, 3, 'o');
      g.px(36, 4, 'o');
      g.ell(29, 11, 1.5, 1.5, 'O');
      g.px(21, 12, 'o');
      g.px(38, 10, 'o');
      for (const [a, b, c, d, e, f] of [[18, 18, 15, 24, 15, 30], [30, 16, 36, 16, 42, 18]]) strand(g, a, b, c, d, e, f, 'H', 'h');
    },
    emo: { happy: { mouth: 'grin' }, sad: { mouth: 'line', fx: [] }, determined: { mouth: 'line' } },
  };

  // QUEEN LEENE — auburn updo, tiara, green eyes, cream gown with gold trim.
  SPECS.leene = {
    pal: Object.assign({}, SKIN_LIGHT, {
      f: '#fad8bc', h: '#b04a2c', g: '#8a3420', H: '#6a2414', R: '#e07a50', b: '#7a2c18', i: '#2a8a5a', I: '#70d0a0', j: '#0c2818',
      c: '#f2ecdc', C: '#c8b890', a: '#f0c448', A: '#b08a28', o: '#3a8ae0', p: '#fff8f0', m: '#b04a4a',
    }),
    lashes: true,
    mouths: { line: ['.mm.'], grin: ['m....m', '.mMMm.', '..mm..'] },
    back(g) {
      g.ell(18, 13, 9, 8, 'g');
      g.ell(26, 20, 15, 13, 'h');
      lock(g, 16, 24, 11, 36, 13, 48, 6, 'h');
    },
    body(g) {
      poly(g, [[14, 50], [20, 48], [40, 48], [48, 50], [44, 54], [31, 58], [18, 54]], 'C');
      poly(g, [[16, 50], [20, 49], [40, 49], [46, 50], [43, 53], [31, 57], [19, 53]], 'a');
      poly(g, [[18, 50], [22, 49], [38, 49], [44, 50], [42, 52], [31, 55], [20, 52]], 'c');
    },
    collar(g) {
      // Pearl choker with a sapphire drop.
      lineOn(g, 21, 44, 37, 47, 'a', 'n');
      lineOn(g, 21, 45, 37, 48, 'a', 'n');
      g.ell(30, 47.5, 1.2, 1.2, 'o');
    },
    hair(g) {
      poly(g, [[14, 28], [14, 16], [22, 9], [36, 8], [43, 12], [46, 19], [44, 20], [38, 15], [30, 14], [24, 17], [18, 22], [17, 32]], 'h');
      lock(g, 44, 18, 47, 28, 44, 38, 4, 'h');
      // Tiara.
      poly(g, [[18, 16], [24, 12], [30, 10], [36, 9], [42, 11], [42, 13], [36, 11], [30, 12], [24, 14], [19, 18]], 'a');
      poly(g, [[30, 11], [32, 5], [34, 11]], 'a');
      g.px(32, 9, 'o');
      g.px(32, 8, 'o');
      for (const [a, b, c, d, e, f] of [[22, 11, 26, 9, 32, 9], [18, 20, 15, 26, 14, 34], [12, 8, 16, 6, 22, 10]]) strand(g, a, b, c, d, e, f, 'H', 'hg');
      for (const [a, b, c, d, e, f] of [[24, 10, 28, 8, 34, 8], [14, 10, 17, 8, 20, 9]]) strand(g, a, b, c, d, e, f, 'R', 'hg');
      g.ell(19, 39, 1, 1.5, 'o');
    },
    emo: { happy: { mouth: 'smile' }, angry: { mouth: 'frown' } },
  };

  // KINO — caveman, shaggy dark-brown hair, simple fur strap.
  SPECS.kino = {
    pal: {
      f: '#d8986a', n: '#b87a4c', e: '#c88858', E: '#8a5430', N: '#a86a40', s: '#d09060',
      h: '#5a3a22', H: '#321e10', R: '#8a6040', b: '#321e10', i: '#3a2418', I: '#7a5038', j: '#0c0804', L: '#5a3020',
      c: '#b08050', C: '#6a4a28',
    },
    irisW: 3,
    browThick: 3,
    head: [
      [14, 22], [17, 14], [24, 9], [34, 8], [41, 12], [44, 19], [44, 29], [47, 31], [47, 35],
      [45, 37], [45, 39], [44, 42], [40, 46], [34, 47], [28, 46], [22, 42], [18, 38], [15, 32],
    ],
    nose(g) {
      g.px(43, 32, 'N');
      g.px(42, 34, 'N');
      g.px(43, 35, 'N');
      g.px(44, 35, 'N');
    },
    face: { mouth: [38, 40] },
    body(g) {
      recolor(g, 'c', 's');
      poly(g, [[10, 52], [18, 49], [48, 62], [30, 62]], 'c');
      for (const [x, y] of [[16, 52], [24, 55], [32, 58], [40, 61]]) g.px(x, y, 'C');
    },
    hair(g) {
      g.ell(28, 14, 17, 9, 'h');
      for (const [a, b, c, d, w] of [[16, 12, 6, 6, 8], [22, 8, 18, 0, 8], [30, 7, 32, -1, 8], [38, 9, 46, 3, 7], [14, 20, 6, 24, 7], [15, 26, 9, 34, 6]])
        g.spike(a, b, c, d, w, 'h');
      poly(g, [[13, 30], [14, 18], [44, 15], [46, 22], [43, 21], [41, 25], [37, 20], [34, 25], [30, 20], [26, 25], [22, 20], [19, 26], [17, 33]], 'h');
      for (const [a, b, c, d] of [[22, 9, 19, 2], [30, 8, 31, 1], [38, 10, 44, 5], [16, 14, 8, 8], [34, 18, 34, 24], [26, 18, 26, 24], [15, 22, 9, 25]]) lineOn(g, a, b, c, d, 'H', 'h');
      lineOn(g, 26, 10, 20, 5, 'R', 'h');
      lineOn(g, 18, 14, 11, 10, 'R', 'h');
    },
    mouths: { grin: ['kkkkkkk', 'kMMMMMk', '.kTTTk.', '..kkk..'] },
  };

  // ELDER — hooded old man, white beard, fur hood, snow tones.
  SPECS.elder = {
    pal: {
      f: '#ecc0a0', n: '#c89a80', e: '#dcae90', E: '#a87860', N: '#c89478',
      z: '#e8eef4', D: '#9aa8bc', y: '#7a5a44', Y: '#4a3424', B: '#f4f6fa', H: '#a8b4c8', b: '#f4f6fa', i: '#4a5a6a', I: '#8a9aaa', j: '#101418', L: '#7a5a50',
      c: '#5a6a8a', C: '#34405a',
    },
    irisW: 3,
    lid: 2,
    browThick: 3,
    ear: false,
    face: { browY: 24, mouth: [38, 40] },
    mouths: { line: ['kkkk'], grin: ['k...k', '.kkk.'], shout: ['kkkkk', 'kMMMk', '.kkk.'], o: ['.k.', 'kMk', '.k.'], frown: ['.kk.', 'k..k'], firm: ['kkkk'] },
    back(g) {
      // Hood: leather outer shell with a thick fur rim.
      poly(g, [[2, 62], [4, 30], [10, 10], [22, 2], [38, 2], [50, 10], [56, 28], [58, 62]], 'y');
    },
    body(g) {
      poly(g, [[6, 62], [8, 54], [16, 50], [44, 50], [52, 54], [54, 62]], 'c');
    },
    jaw(g) {
      poly(g, [[16, 34], [20, 40], [26, 42], [32, 43], [38, 40], [44, 36], [45, 40], [43, 48], [38, 58], [32, 62], [26, 60], [20, 52], [15, 42]], 'B');
      poly(g, [[31, 38], [36, 36], [42, 36], [46, 39], [44, 41], [40, 40], [34, 41], [30, 40]], 'B');
      for (const [a, b, c, d] of [[20, 42, 24, 54], [26, 44, 28, 58], [32, 45, 32, 60], [38, 44, 36, 56], [42, 42, 40, 50]]) lineOn(g, a, b, c, d, 'H', 'B');
    },
    hair(g) {
      // Fur rim around the face opening.
      const rim = [[8, 50], [7, 32], [11, 16], [20, 7], [34, 6], [44, 11], [50, 22], [51, 40], [48, 54], [44, 50], [46, 38], [45, 22], [40, 14], [32, 11], [22, 12], [16, 18], [13, 30], [14, 44], [12, 52]];
      poly(g, rim, 'z');
      for (let i = 0; i < rim.length - 1; i += 1) {
        const [x, y] = rim[i];
        g.px(x + 1, y + 1, 'D');
      }
      for (const [a, b, c, d] of [[10, 20, 14, 22], [18, 10, 20, 14], [30, 7, 30, 11], [42, 12, 40, 15], [48, 26, 45, 26], [9, 36, 12, 36], [10, 46, 13, 44], [48, 44, 46, 44]]) lineOn(g, a, b, c, d, 'D', 'z');
      // Sparse white hair on the brow.
      poly(g, [[16, 20], [22, 14], [34, 13], [42, 16], [44, 21], [38, 18], [30, 17], [22, 19], [17, 24]], 'B');
    },
    emo: { happy: { eye: 'arc', mouth: 'grin' }, sad: { mouth: 'frown' } },
  };

  // GASPAR — sleepy old man, bowler-ish hat, droopy eyes, grey moustache, yellowish robes.
  SPECS.gaspar = {
    pal: Object.assign({}, SKIN_LIGHT, {
      f: '#f0c4a4', a: '#5a4a3a', A: '#342a20', q: '#8a2c2c', h: '#d8d8d4', H: '#9a9a98', B: '#e0e0dc', b: '#c8c8c4',
      i: '#4a3a2a', I: '#8a6a4a', j: '#100804', c: '#d8b848', C: '#9a7a20', d: '#8a5a28', N: '#d0907a',
    }),
    irisW: 2,
    lid: 2,
    browThick: 2,
    face: { mouth: [38, 41] },
    mouths: { line: ['kkk'], grin: ['k...k', '.kkk.'], shout: ['kkkk', 'kMMk', '.kk.'], frown: ['.kk.', 'k..k'], firm: ['kkk'] },
    nose(g) {
      g.ell(46, 33.5, 3, 2.5, 'f');
      g.px(45, 36, 'N');
      g.px(46, 36, 'N');
      g.px(43, 35, 'N');
    },
    body(g) {
      recolor(g, 'c', 'c');
      poly(g, [[20, 48], [40, 48], [34, 60], [26, 60]], 'd');
      g.line(26, 49, 30, 60, 'C');
      g.line(12, 55, 20, 50, 'C');
    },
    jaw(g) {
      poly(g, [[33, 37], [38, 36], [44, 37], [48, 40], [45, 41], [40, 39], [36, 40], [31, 41]], 'B');
      g.line(36, 39, 44, 39, 'H');
    },
    hair(g) {
      // Grey tufts at the sides and a round hat.
      g.ell(15, 26, 5, 6, 'h');
      for (const [a, b, c, d, w] of [[13, 24, 8, 22, 4], [13, 28, 8, 30, 4], [15, 31, 11, 35, 4]]) g.spike(a, b, c, d, w, 'h');
      lineOn(g, 15, 22, 12, 26, 'H', 'h');
      g.ell(30, 12, 15, 10, 'a');
      poly(g, [[8, 20], [14, 16], [46, 13], [52, 15], [48, 19], [12, 22]], 'a');
      g.line(14, 17, 45, 14, 'q');
      g.line(14, 18, 45, 15, 'q');
      lineOn(g, 24, 5, 20, 12, 'A', 'a');
      g.line(10, 21, 48, 18, 'A');
    },
    emo: {
      happy: { eye: 'arc', mouth: 'grin', fx: [] },
      neutral: { eye: 'closed', fx: [] },
    },
  };

  // CORIN — a boy from the ruined future dome; shown desaturated (tablet photo).
  SPECS.corin = {
    pal: Object.assign({}, SKIN_LIGHT, {
      f: '#f0c4a0', h: '#5a4030', H: '#34241a', R: '#8a6a50', b: '#34241a', i: '#5a4a3a', I: '#9a8068', j: '#140c08',
      c: '#6a7a6a', C: '#3a4a3a', d: '#a85a3a', D: '#6a3420', p: '#8a8a6a', u: '#f0e0c0', U: '#c8a888',
    }),
    irisW: 4,
    head: [
      [14, 23], [17, 15], [24, 10], [34, 9], [41, 13], [44, 20], [44, 30], [46, 33], [45, 35],
      [44, 37], [44, 39], [42, 42], [38, 44], [33, 45], [27, 44], [21, 41], [17, 37], [15, 32],
    ],
    neck: [[23, 40], [35, 42], [35, 55], [22, 55]],
    shoulders: [[4, 62], [6, 56], [12, 52], [22, 50], [38, 50], [48, 52], [56, 57], [58, 62]],
    face: { near: [22, 27, 6, 7], far: [35, 27, 4, 7], mouth: [37, 39] },
    acc(g) {
      // Sticking plaster on the near cheek.
      g.rect(18, 35, 22, 36, 'u');
      g.px(20, 35, 'U');
      g.px(20, 36, 'U');
    },
    body(g) {
      // Oversized patched jacket and a scarf.
      poly(g, [[16, 47], [42, 46], [46, 51], [40, 55], [22, 55], [14, 51]], 'd');
      g.line(18, 51, 42, 50, 'D');
      g.rect(46, 56, 50, 59, 'p');
      g.line(26, 55, 20, 62, 'C');
    },
    hair(g) {
      g.ell(28, 16, 16, 10, 'h');
      poly(g, [[13, 28], [14, 18], [44, 16], [46, 24], [42, 21], [40, 25], [36, 20], [33, 25], [29, 20], [25, 24], [22, 20], [18, 26], [17, 32]], 'h');
      for (const [a, b, c, d, w] of [[20, 9, 14, 3, 6], [30, 7, 33, 1, 6], [16, 16, 8, 14, 6]]) g.spike(a, b, c, d, w, 'h');
      for (const [a, b, c, d] of [[20, 10, 16, 5], [31, 8, 32, 3], [34, 18, 35, 24], [28, 18, 28, 23], [16, 20, 12, 22]]) lineOn(g, a, b, c, d, 'H', 'h');
      lineOn(g, 26, 10, 22, 7, 'R', 'h');
    },
    postCanvas(ctx) {
      desaturate(ctx, 0.5, [4, 6, 10]);
    },
  };

  // ISELLE — short white hair; left half of her face porcelain with glowing seams.
  SPECS.iselle = {
    fxo: { tearsAt: [[21, 33, 6], [38, 33, 9]] },
    pal: Object.assign({}, SKIN_LIGHT, {
      f: '#f4cdb4', n: '#dcae98', h: '#e4e8f2', H: '#9aa2bc', R: '#ffffff', b: '#8a90a8', i: '#5a7890', I: '#9ab8d0', j: '#141c28',
      P: '#f2eee4', G: '#5ae0ff', K: '#2a5a80', c: '#7c808a', C: '#4a4e58', d: '#626670', D: '#3c4048', Y: '#8af0ff', V: '#e8fcff',
    }),
    lashes: true,
    back(g) {
      g.ell(27, 21, 16, 15, 'h');
    },
    body(g) {
      // Long grey coat with a tall open collar.
      poly(g, [[4, 62], [6, 50], [12, 38], [20, 44], [24, 56], [28, 62]], 'd');
      poly(g, [[56, 62], [54, 50], [48, 38], [42, 46], [38, 56], [34, 62]], 'd');
      g.line(12, 40, 22, 60, 'D');
      g.line(48, 40, 40, 60, 'D');
    },
    hair(g) {
      poly(g, [[13, 32], [13, 16], [21, 8], [36, 7], [44, 12], [47, 22], [46, 30], [43, 24], [41, 27], [39, 20], [35, 24], [32, 19], [28, 24], [25, 19], [21, 25], [18, 21], [16, 36]], 'h');
      lock(g, 45, 22, 48, 30, 45, 38, 4, 'h');
      for (const [a, b, c, d, e, f] of [[20, 9, 16, 14, 14, 26], [28, 8, 30, 14, 32, 19], [37, 8, 41, 14, 43, 22], [15, 24, 14, 30, 15, 34]]) strand(g, a, b, c, d, e, f, 'H', 'h');
      for (const [a, b, c, d, e, f] of [[24, 9, 20, 12, 18, 18], [30, 8, 27, 10, 25, 14]]) strand(g, a, b, c, d, e, f, 'R', 'h');
    },
    jaw(g, e) {
      // Porcelain over the left half of the face and neck.
      const split = (x, y) => x < 31 - (y - 26) * 0.12;
      recolor(g, 'fne', 'P', split);
      const seams = [
        [[15, 27], [19, 31], [23, 30], [28, 32]],
        [[19, 38], [23, 37], [26, 40], [30, 39]],
        [[25, 43], [24, 48], [27, 52]],
        [[30, 20], [28, 23], [30, 25]],
      ];
      if (e.cracked)
        seams.push([[20, 26], [18, 29], [21, 33], [19, 36]], [[26, 34], [29, 36], [28, 38]], [[31, 29], [33, 31], [32, 33]], [[23, 22], [26, 24], [25, 26]]);
      for (const s of seams) for (let i = 0; i < s.length - 1; i++) lineOn(g, s[i][0], s[i][1], s[i + 1][0], s[i + 1][1], 'G', 'Pf');
    },
    post(g, e) {
      // Porcelain near eye glows instead of being human.
      recolor(g, 'iI', 'Y', (x) => x < 30);
      recolor(g, 'j', 'K', (x) => x < 30);
      if (e.cracked) for (const [x, y] of [[18, 30], [21, 34], [28, 37], [25, 25]]) g.px(x, y, 'K');
    },
    emo: {
      happy: { eye: 'open', lid: 1, slant: -1, brow: [0, -1], mouth: 'weak', fx: [] },
      angry: { mouth: 'grit' },
      broken: { cracked: true },
    },
    postCanvas(ctx) {
      glow(ctx, (r, g, b) => b > 230 && g > 200 && r < 150, '#7ae8ff', 1, 0.18);
    },
  };

  // ---- Non-human builders ----------------------------------------------------------
  // FROG — green frog knight: bulging yellow eyes, wide mouth, cream throat, maroon cape.
  function frog(e) {
    const g = N_Grid();
    const pal = {
      f: '#6aa84a', D: '#3a6a2c', z: '#ece0a8', y: '#f0d040', j: '#1a1408', w: '#ffffff', l: '#4e8a36',
      c: '#6a3a7a', C: '#3a1c4a', d: '#8a2438', a: '#e09a40', A: '#a8b4c8', M: '#5a1624', T: '#e0707c',
    };
    // Cape collar and armour.
    poly(g, [[0, 62], [2, 52], [10, 46], [20, 46], [40, 46], [52, 48], [60, 56], [62, 62]], 'd');
    poly(g, [[6, 62], [10, 54], [20, 50], [42, 50], [52, 54], [56, 62]], 'c');
    poly(g, [[22, 50], [40, 50], [36, 62], [26, 62]], 'A');
    g.line(12, 56, 20, 52, 'C');
    g.line(44, 52, 52, 58, 'C');
    g.ell(22, 51, 2, 2, 'a');
    g.ell(41, 51, 2, 2, 'a');
    // Head: broad and flat, snout to the right.
    g.ell(30, 34, 19, 12, 'f');
    g.ell(38, 35, 14, 10, 'f');
    // Throat / lower jaw.
    poly(g, [[16, 40], [24, 43], [36, 44], [48, 40], [50, 42], [44, 47], [34, 50], [24, 49], [16, 45]], 'z');
    // Eye domes.
    g.ell(22, 22, 9, 8.5, 'f');
    g.ell(42, 21, 7, 7, 'f');
    // Spots.
    for (const [x, y] of [[14, 30], [15, 31], [26, 31], [27, 31], [33, 29], [11, 36], [20, 36], [21, 37], [46, 29]]) g.px(x, y, 'D');
    // Eyeballs (shaded region), lids by emotion.
    const eyes = [[22, 21, 6.5, 6], [42.5, 20, 4.8, 5.2]];
    for (const [cx, cy, rx, ry] of eyes) g.ell(cx, cy, rx, ry, 'y');
    eyes.forEach(([cx, cy, rx, ry], k) => {
      const side = k === 0 ? 'near' : 'far';
      const x0 = Math.round(cx - rx), x1 = Math.round(cx + rx);
      const top = Math.round(cy - ry);
      const inner = (x) => (side === 'near' ? (x - x0) / (x1 - x0) : (x1 - x) / (x1 - x0));
      // Pupil: horizontal bar, looking right.
      const px = Math.round(cx + rx * 0.25);
      const py = Math.round(cy + 0.5);
      if (e.eye === 'arc' || e.eye === 'closed') {
        // Lid shut: fill with lid and draw the closed line.
        recolor(g, 'y', 'l', (x, y) => Math.hypot((x - cx) / (rx + 0.4), (y - cy) / (ry + 0.4)) <= 1);
        const dir = e.eye === 'arc' ? -1 : 1;
        for (let x = x0; x <= x1; x++) {
          const t = (x - cx) / rx;
          g.px(x, Math.round(cy + 1 + dir * -(1 - t * t) * 2), 'k');
        }
        return;
      }
      const wide = e.eye === 'wide';
      const pw = wide ? 1 : side === 'near' ? 3 : 2;
      g.rect(px - Math.floor(pw / 2) - (wide ? 0 : 1), py - (wide ? 1 : 0), px + Math.floor(pw / 2), py + (wide ? 0 : 1), 'j');
      if (wide) g.rect(px, py - 1, px, py, 'j');
      g.px(Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.4), 'w');
      if (!wide) {
        let lid = 2 + (e.lid || 0);
        for (let x = x0; x <= x1; x++) {
          const t = inner(x);
          let l = lid;
          if (e.slant > 0) l += Math.round(e.slant * t * 1.5);
          if (e.slant < 0) l += Math.round(-e.slant * (1 - t) * 1.5);
          for (let y = top - 1; y < top + l; y++) pxOn(g, x, y, 'l', 'yjw');
          // lid edge
          for (let y = top + l; y <= top + l; y++) pxOn(g, x, y, 'k', 'yjw');
        }
      }
    });
    // Brow ridges above the domes (emotion).
    const bro = (x0, x1, y, side) => {
      const outer = y + e.brow[0];
      const inn = y + e.brow[1];
      const [ly, ry] = side === 'near' ? [outer, inn] : [inn, outer];
      g.line(x0, ly, x1, ry, 'D');
    };
    bro(16, 27, 14, 'near');
    bro(38, 46, 13, 'far');
    // Nostrils.
    g.px(49, 29, 'k');
    g.px(51, 30, 'k');
    // Mouth: a long line across the face.
    const m = e.mouth;
    const mouthY = (x) => {
      const t = (x - 20) / 30;
      let y = 38 - t * 2;
      if (m === 'grin' || m === 'smirk' || m === 'fang' || m === 'smile') y -= Math.sin(t * Math.PI) * -1 + (t > 0.85 ? (t - 0.85) * 12 : 0);
      if (m === 'frown' || m === 'weak') y += Math.sin(t * Math.PI) * -2 + (t > 0.8 ? (t - 0.8) * 10 : 0);
      return Math.round(y);
    };
    if (m === 'o' || m === 'shout' || m === 'grin' || m === 'fang') {
      const open = m === 'o' ? 3 : m === 'shout' ? 4 : 3;
      const xa = m === 'o' ? 34 : 24, xb = m === 'o' ? 44 : 50;
      for (let x = xa; x <= xb; x++) {
        const t = (x - xa) / (xb - xa);
        const d = Math.round(Math.sin(t * Math.PI) * open);
        const y0 = mouthY(x);
        for (let y = y0; y <= y0 + d; y++) g.px(x, y, y === y0 + d && d > 1 ? 'T' : 'M');
        g.px(x, y0, 'k');
        g.px(x, y0 + d + 1, 'k');
      }
    } else {
      for (let x = 20; x <= 50; x++) g.px(x, mouthY(x), 'k');
    }
    return { g, pal, detail: 'DjwkMT', fxo: { sweatAt: [52, 12], veinAt: [50, 4], tearAt: [15, 27], blush: [[16, 38, 6], [44, 36, 4]] } };
  }

  // ROBO — gold dome head, dark visor with glowing eye shapes.
  function robo(e) {
    const g = N_Grid();
    const col = { neutral: '#ff4a3a', happy: '#ffc040', angry: '#ff2020', sad: '#58a8ff', surprised: '#ffe070', determined: '#ff6a2a' }[e.key] || '#ff4a3a';
    const pal = {
      f: '#e2aa3c', d: '#b86a30', v: '#262838', V: '#3a3e56', a: '#9aa0b4', A: '#6a7088', o: '#6ad8ff', n: '#7a8098', C: '#4a5068',
      c: '#e2aa3c', s: '#c8902c', G: col, w: '#fff8e8', k: '#1c1024',
    };
    // Chest and ball shoulders.
    poly(g, [[14, 62], [16, 52], [46, 52], [48, 62]], 's');
    g.rect(22, 55, 40, 59, 'V');
    g.rect(24, 56, 28, 58, 'G');
    g.rect(31, 57, 38, 57, 'C');
    g.ell(9, 58, 6, 5, 'a');
    g.ell(53, 58, 6, 5, 'a');
    g.ell(8, 56, 8, 6.5, 'c');
    g.ell(54, 56, 8, 6.5, 'c');
    // Neck joint.
    g.rect(24, 44, 38, 52, 'n');
    for (let y = 46; y <= 51; y += 2) g.line(24, y, 38, y, 'C');
    // Antenna.
    g.rect(30, 3, 31, 9, 'a');
    g.ell(30.5, 2.5, 2.5, 2.5, 'o');
    // Dome + jaw.
    g.ell(31, 25, 18, 18, 'f');
    poly(g, [[16, 34], [46, 34], [44, 42], [38, 46], [24, 46], [18, 42]], 'd');
    // Ear discs.
    g.ell(12, 27, 3, 6, 'a');
    g.ell(12, 27, 1.2, 3, 'A');
    g.ell(50, 26, 2, 5, 'a');
    // Visor band.
    poly(g, [[14, 20], [30, 18], [48, 19], [49, 31], [30, 33], [14, 31]], 'v');
    g.line(15, 21, 29, 19, 'V');
    // Mouth grille.
    for (let x = 26; x <= 38; x += 3) g.line(x, 38, x, 42, 'C');
    // Eyes.
    const T = {
      neutral: ['GGGGG', 'GwwwG', 'GGGGG'],
      happy: ['.GGG.', 'GwwwG', 'Gw.wG', 'G...G'],
      angry: ['GG....', 'GwGG..', '.GwwGG', '...GwG', '....GG'],
      sad: ['....GG', '..GGwG', 'GGwwG.', 'GwGG..', 'GG....'],
      surprised: ['.GGG.', 'GwwwG', 'Gw.wG', 'GwwwG', '.GGG.'],
      determined: ['GGGGGG', 'wwwwww'],
    };
    const t = T[e.key] || T.neutral;
    const h = t.length;
    const y0 = 25 - Math.floor(h / 2);
    stamp(g, 18, y0, t);
    stamp(g, 36, y0, e.key === 'angry' || e.key === 'sad' ? mirrorRows(t) : t);
    return {
      g, pal, detail: 'GwCVk',
      fxo: { sweatAt: [50, 10], veinAt: [46, 4] },
      post(ctx) {
        const c = CT.PX.hex(col);
        glow(ctx, (r, gg, b) => Math.abs(r - c[0]) < 6 && Math.abs(gg - c[1]) < 6 && Math.abs(b - c[2]) < 6, col, 1, 0.45);
      },
    };
  }

  // SPEKKIO — small pink round creature with little horns and ears.
  function spekkio(e) {
    const g = N_Grid();
    const pal = {
      f: '#f4a0c4', z: '#ffe0ee', a: '#fff4dc', e: '#e888b0', E: '#c05a8a', W: '#ffffff', i: '#6a2a8a', I: '#b070d8', j: '#1c0a28', w: '#ffffff', L: '#a04a7a',
      b: '#b04a80', m: '#8a2a50', M: '#6a1636', t: '#ffffff', T: '#ff7090', Q: '#a8e0ff',
    };
    // Horns and ears.
    g.spike(20, 14, 14, 2, 6, 'a');
    g.spike(40, 13, 46, 1, 6, 'a');
    g.ell(8, 30, 5, 7, 'e');
    g.ell(54, 30, 5, 7, 'e');
    g.ell(8, 30, 2, 4, 'E');
    // Round body.
    g.ell(31, 36, 25, 24, 'f');
    g.ell(33, 48, 14, 10, 'z');
    // Little arms.
    g.ell(10, 52, 4, 3, 'f');
    g.ell(52, 52, 4, 3, 'f');
    const o = { lashes: false, irisW: 4, thickLid: true };
    const f = {
      near: [19, 26, 7, 8], far: [36, 26, 6, 8], browY: 22, mouth: [32, 38],
    };
    const ee = Object.assign({}, e, { fx: e.fx });
    features(g, Object.assign({}, o, { face: f, nose: false, mouths: { line: ['m...m', '.mmm.'] } }), ee);
    return { g, pal, detail: DETAIL, fxo: { blush: [[14, 36, 6], [42, 36, 6]], sweatAt: [50, 8], veinAt: [46, 6], tearAt: [18, 34] }, alwaysBlush: true };
  }

  // NU — round blue blob with small eyes and a tuft.
  function nu(e) {
    const g = N_Grid();
    const pal = {
      f: '#5a8ce0', h: '#3a6ac0', H: '#244a90', z: '#c8e0ff', j: '#0c1030', w: '#ffffff', b: '#1c2c60', m: '#1c1840', M: '#3a1030', T: '#e0607a', t: '#ffffff', Q: '#a8e0ff',
      W: '#ffffff', i: '#0c1030', I: '#0c1030', L: '#244a90',
    };
    // Tuft.
    for (const [a, b, c, d, w] of [[30, 16, 24, 2, 6], [33, 15, 36, 1, 6], [36, 17, 44, 6, 5]]) g.spike(a, b, c, d, w, 'h');
    lineOn(g, 30, 14, 25, 4, 'H', 'h');
    g.ell(31, 40, 28, 22, 'f');
    g.rect(15, 24, 17, 24, 'z');
    g.rect(14, 25, 15, 26, 'z');
    // Small eyes (dots) with brows for emotion.
    const eyeAt = [[25, 32], [39, 32]];
    eyeAt.forEach(([x, y], k) => {
      const side = k === 0 ? 'near' : 'far';
      if (e.eye === 'arc') stamp(g, x - 1, y, ['.k.', 'k.k']);
      else if (e.eye === 'closed') stamp(g, x - 1, y, ['k.k', '.k.']);
      else if (e.eye === 'wide') {
        stamp(g, x - 1, y - 1, ['.j.', 'jjj', 'jwj', '.j.']);
      } else {
        stamp(g, x, y - 1, ['jj', 'jj', 'jj', 'jj']);
        g.px(x, y - 1, 'w');
        if (e.lid) {
          const inner = side === 'near' ? x + 1 : x;
          if (e.slant > 0) g.px(inner, y, 'f');
          if (e.slant < 0) g.px(side === 'near' ? x : x + 1, y, 'f');
        }
      }
      const by = y - 4;
      const o = by + e.brow[0], i = by + e.brow[1];
      if (side === 'near') g.line(x - 2, o, x + 2, i, 'b');
      else g.line(x - 1, i, x + 3, o, 'b');
    });
    const mouths = {
      line: ['m.......m', '.mmmmmmm.'], grin: ['kkkkkkkkk', 'kMMMMMMMk', '.kMTTTMk.', '..kkkkk..'], shout: ['kkkkkkk', 'ktttttk', 'kMMMMMk', '.kkkkk.'],
      frown: ['.mmmmm.', 'm.....m'], o: ['.kkk.', 'kMMMk', 'kMTMk', '.kkk.'], firm: ['mmmmmmm'], smirk: ['......m', 'mmmmmm.'], weak: ['m...m', '.mmm.'], flat: ['mmmmm'], grit: ['kkkkkk', 'ktttt.', 'kkkkkk'],
    };
    const rows = mouths[e.mouth] || mouths.line;
    stamp(g, 33 - Math.floor(rows[0].length / 2), 40, rows);
    return { g, pal, detail: 'HjwbmMTtkz', fxo: { sweatAt: [52, 16], veinAt: [48, 10], tearAt: [23, 35], blush: [[16, 36, 5], [43, 36, 5]] } };
  }

  // THE CURATOR (VESPER) — porcelain plates, single vertical slit eye, grey docent coat.
  function curator(e) {
    const g = N_Grid();
    const moods = {
      neutral: { glow: '#7ad8ff', core: '#e8faff', w: 1, len: 12, dy: 0 },
      happy: { glow: '#8af0e0', core: '#f0fffa', w: 1, len: 10, dy: -1, curve: 1 },
      angry: { glow: '#ff4a4a', core: '#ffd0c0', w: 0, len: 12, dy: 0 },
      sad: { glow: '#3a70c8', core: '#9ac0f0', w: 1, len: 8, dy: 2 },
      surprised: { glow: '#9ae8ff', core: '#ffffff', w: 2, len: 14, dy: -1 },
      determined: { glow: '#b0f0ff', core: '#ffffff', w: 0, len: 14, dy: 0 },
    };
    const md = moods[e.key] || moods.neutral;
    const pal = {
      f: '#f0ece2', p: '#e2ddd0', l: '#1c2c48', G: md.glow, w: md.core, c: '#5c5e64', C: '#34363c', d: '#484a50', a: '#a8a080', K: '#2c3a54',
    };
    // Coat with tall collar.
    poly(g, [[0, 62], [2, 54], [12, 48], [22, 46], [40, 46], [50, 48], [60, 54], [62, 62]], 'c');
    poly(g, [[10, 62], [12, 44], [20, 36], [24, 50], [28, 62]], 'd');
    poly(g, [[52, 62], [50, 44], [44, 36], [40, 50], [36, 62]], 'd');
    g.line(12, 46, 18, 60, 'C');
    g.line(50, 46, 44, 60, 'C');
    g.rect(44, 52, 46, 54, 'a');
    // Lattice neck.
    g.rect(25, 40, 37, 50, 'l');
    for (let y = 41; y <= 50; y += 3) g.line(25, y, 37, y, 'G');
    for (let x = 27; x <= 37; x += 4) g.line(x, 40, x, 50, 'G');
    // Head: tall smooth ovoid mask of porcelain plates over blue light.
    g.ell(31, 25, 14, 20, 'f');
    // Far-side plate a touch darker for the 3/4 turn.
    recolor(g, 'f', 'p', (x, y) => x > 39 + (y - 24) * 0.1);
    const seam = (pts, c = 'K') => { for (let i = 0; i < pts.length - 1; i++) lineOn(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, 'fp'); };
    // Brow plate: its lower edge tilts with the mood, like a brow would.
    const bt = { angry: [13, 18], sad: [17, 12], surprised: [11, 11], determined: [14, 16], happy: [13, 13] }[e.key] || [14, 14];
    seam([[18, bt[0] + 3], [25, bt[0] + 1], [32, bt[1]]]);
    seam([[36, bt[1]], [40, bt[0]], [44, bt[0] + 2]]);
    // Cheek plates meeting under the slit, and a chin plate.
    seam([[18, 33], [25, 35], [32, 38]]);
    seam([[36, 38], [41, 36], [44, 33]]);
    seam([[25, 35], [28, 41], [33, 44]]);
    // Blue light leaking through where the plates meet.
    for (const [x, y] of [[25, bt[0] + 1], [25, 35], [41, 36]]) g.px(x, y, 'G');
    // Slit eye on the face's centre line (right of centre in 3/4 view).
    const cx = 34;
    const cy = 25 + md.dy;
    const half = Math.floor(md.len / 2);
    for (let y = cy - half; y <= cy + half; y++) {
      const t = (y - cy) / half;
      const ww = md.w - (Math.abs(t) > 0.7 ? 1 : 0);
      const dx = md.curve ? Math.round(t * t * 1.5) : 0;
      for (let x = cx - Math.max(0, ww) - 1; x <= cx + Math.max(0, ww) + 1; x++) g.px(x - dx, y, 'G');
      for (let x = cx - Math.max(0, ww); x <= cx + Math.max(0, ww); x++) if (Math.abs(t) < 0.9) g.px(x - dx, y, 'w');
    }
    g.px(cx, cy - half - 1, 'G');
    g.px(cx, cy + half + 1, 'G');
    // The centre seam continues above and below the slit.
    seam([[cx, 6], [cx, cy - half - 2]]);
    seam([[cx, cy + half + 2], [cx - 1, 44]]);
    return {
      g, pal, detail: 'GwKC',
      noFx: true,
      post(ctx) {
        const c = CT.PX.hex(md.glow);
        glow(ctx, (r, gg, b) => Math.abs(r - c[0]) < 8 && Math.abs(gg - c[1]) < 8 && Math.abs(b - c[2]) < 8, md.glow, 2, e.key === 'sad' ? 0.2 : 0.35);
      },
    };
  }

  const CUSTOM = { frog, robo, spekkio, nu, curator };

  // ---- Assembly ----------------------------------------------------------------------
  function emotionFor(id, emotion, spec) {
    let key = EMO[emotion] ? emotion : 'neutral';
    if (key === 'broken' && id !== 'iselle') key = 'sad';
    const base = Object.assign({ key }, EMO[key]);
    const over = spec && spec.emo && spec.emo[key];
    return Object.assign(base, over || {}, { key });
  }

  function render(g, pal, detail) {
    return CT.PX.shadeGrid(g, pal, detail, true);
  }

  function applyFx(cv, e, fxo, spec) {
    const ctx = cv.getContext('2d');
    for (const f of e.fx || []) if (FX[f]) FX[f](ctx, fxo);
    if (spec && spec.postCanvas) spec.postCanvas(ctx, e);
  }

  function build(id, emotion) {
    if (CUSTOM[id]) {
      const e = emotionFor(id, emotion, null);
      const r = CUSTOM[id](e);
      const cv = render(r.g, r.pal, r.detail);
      const ctx = cv.getContext('2d');
      if (r.post) r.post(ctx);
      if (!r.noFx) applyFx(cv, e, r.fxo || {}, null);
      if (r.alwaysBlush && !(e.fx || []).includes('blush')) FX.blush(ctx, r.fxo || {});
      return cv;
    }
    const spec = SPECS[id];
    if (!spec) return silhouette();
    const e = emotionFor(id, emotion, spec);
    const g = human(spec, e);
    const pal = Object.assign({}, FEAT, spec.pal);
    const cv = render(g, pal, DETAIL + (spec.detail || ''));
    applyFx(cv, e, spec.fxo || {}, spec);
    return cv;
  }

  function silhouette() {
    const g = N_Grid();
    poly(g, SHOULDERS, 'c');
    poly(g, NECK, 'c');
    g.ell(30, 26, 14, 17, 'c');
    return render(g, { c: '#6a6a78' }, '');
  }

  const cache = {};
  CT.getPortrait = function (id, emotion) {
    const k = id + '|' + emotion;
    if (!cache[k]) {
      try {
        cache[k] = build(String(id), String(emotion || 'neutral'));
      } catch (err) {
        console.warn('portrait ' + k + ' failed: ' + err.message);
        cache[k] = silhouette();
      }
    }
    return cache[k];
  };
})();
