// Master palette, frame quantiser and hard-edged pixel primitives.
//
// The game renders at a 480x300 logical resolution. Every finished frame is
// mapped onto the fixed master palette below (with a light 4x4 ordered dither
// for in-between tones such as light pools and fades), so every pixel on
// screen comes from these colours. Art is snapped to the palette when baked.
// Nothing here anti-aliases: shapes are filled row by row with fillRect.
(function () {
  const CT = (window.CT = window.CT || {});

  // ---- Master palette: hue-shifted ramps, dark -> light --------------------------
  const RAMPS = {
    ink: ['#0a0612', '#1a1226', '#2a2038'],
    slate: ['#3a3a52', '#52526e', '#6e7090', '#9294b0', '#bcc0d4', '#e4e8f0'],
    stone: ['#3e3230', '#5a4a44', '#7a665a', '#9c8674', '#c0aa92'],
    blue: ['#10183a', '#1c2c5c', '#2c4488', '#3c64b4', '#5c90dc', '#8cc0f0', '#c4e4ff'],
    green: ['#0e2a1e', '#1c4428', '#2c6430', '#488c34', '#74b43c', '#a8d45c', '#d4ec94'],
    teal: ['#1a4a4e', '#2a7470', '#48a894', '#7cd4b8'],
    wood: ['#2a160e', '#4a2a16', '#6e4222', '#94602e', '#bc8844', '#dcb468'],
    skin: ['#5c3020', '#8c5034', '#bc7a50', '#e0a878', '#f8d0a8', '#fff0dc'],
    red: ['#3c0a14', '#6c1422', '#a02030', '#d43c3c', '#f06c4c'],
    gold: ['#c05c1c', '#e88c28', '#f8bc3c', '#fce068', '#fff4b0'],
    purple: ['#2a1040', '#4a1c6c', '#6c3094', '#9450c0', '#bc84e4', '#e0c0fc'],
    pink: ['#6c2048', '#a83c74', '#e0709c', '#f8b0c8'],
    white: ['#ffffff'],
  };
  const PAL = [];
  for (const k in RAMPS) for (const h of RAMPS[k]) PAL.push(h);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const RGB = PAL.map(hex);
  const N = PAL.length;

  const le = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  const pack = ([r, g, b]) => (le ? (0xff000000 | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 0xff)) >>> 0;
  const PAL32 = new Uint32Array(RGB.map(pack));

  // Perceptual-ish nearest colour (weighted RGB, weights follow luma).
  function nearest(r, g, b) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < N; i++) {
      const c = RGB[i];
      const dr = r - c[0], dg = g - c[1], db = b - c[2];
      const d = 3 * dr * dr + 5 * dg * dg + 2 * db * db;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  // RGB555 lookup (built once) + exact-match table so palette pixels never dither.
  const LUT = new Uint8Array(32768);
  for (let k = 0; k < 32768; k++) LUT[k] = nearest(((k >> 10) << 3) + 4, (((k >> 5) & 31) << 3) + 4, ((k & 31) << 3) + 4);
  const EXACT = new Int16Array(32768).fill(-1);
  RGB.forEach(([r, g, b], i) => (EXACT[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)] = i));
  const RGB24 = new Int32Array(RGB.map(([r, g, b]) => (r << 16) | (g << 8) | b));

  // 4x4 Bayer thresholds centred on zero.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

  // Quantise an RGBA ImageData into a Uint32 view of the output (can be the same).
  function quantize(src, out32, w, h, amp = 12) {
    const d = src.data;
    const dith = new Int8Array(16);
    for (let i = 0; i < 16; i++) dith[i] = Math.round(BAYER[i] * amp * 2);
    for (let y = 0; y < h; y++) {
      const row = (y & 3) << 2;
      for (let x = 0; x < w; x++) {
        const p = y * w + x, i = p << 2;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const k0 = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        const e = EXACT[k0];
        if (e >= 0 && RGB24[e] === ((r << 16) | (g << 8) | b)) { out32[p] = PAL32[e]; continue; }
        const o = dith[row | (x & 3)];
        let rr = r + o, gg = g + o, bb = b + o;
        rr = rr < 0 ? 0 : rr > 255 ? 255 : rr;
        gg = gg < 0 ? 0 : gg > 255 ? 255 : gg;
        bb = bb < 0 ? 0 : bb > 255 ? 255 : bb;
        out32[p] = PAL32[LUT[((rr >> 3) << 10) | ((gg >> 3) << 5) | (bb >> 3)]];
      }
    }
  }

  // Snap a canvas to the palette in place (no dither; alpha becomes 0 or 255).
  function snapCanvas(cv) {
    const g = cv.getContext('2d', { willReadFrequently: true });
    const img = g.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; }
      const c = RGB[nearest(d[i], d[i + 1], d[i + 2])];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  const snapHex = (h) => PAL[nearest(...hex(h))];

  // ---- Hard-edged primitives (all integer, no anti-aliasing) ----------------------
  // Filled ellipse, row by row.
  function ellipse(ctx, cx, cy, rx, ry) {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let y = -ry; y <= ry; y++) {
      const t = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (t <= 0) continue;
      const hw = Math.round(rx * Math.sqrt(t));
      ctx.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
    }
  }
  // 1px ellipse outline: the filled ellipse's boundary pixels.
  function ellipseRing(ctx, cx, cy, rx, ry) {
    cx = Math.round(cx); cy = Math.round(cy);
    const hw = (y) => {
      if (y < -ry || y > ry) return -1;
      const t = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      return t > 0 ? Math.round(rx * Math.sqrt(t)) : -1;
    };
    for (let y = -ry; y <= ry; y++) {
      const w = hw(y);
      if (w < 0) continue;
      const inner = Math.min(hw(y - 1), hw(y + 1));
      const from = Math.min(w, inner + 1);
      ctx.fillRect(cx - w, cy + y, w - from + 1, 1);
      ctx.fillRect(cx + from, cy + y, w - from + 1, 1);
    }
  }
  function disc(ctx, cx, cy, r) { ellipse(ctx, cx, cy, r, r); }
  // Bresenham line of width w.
  function line(ctx, x0, y0, x1, y1, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const o = (w - 1) >> 1;
    for (;;) {
      ctx.fillRect(x0 - o, y0 - o, w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // Isometric diamond (2:1) centred on (cx, cy) with half-width hw: filled or outline.
  function diamond(ctx, cx, cy, hw, fill = true) {
    cx = Math.round(cx); cy = Math.round(cy);
    const hh = hw >> 1;
    for (let y = -hh; y < hh; y++) {
      const k = y < 0 ? y + hh : hh - 1 - y; // 0 at the tips
      const half = 2 * k + 2;
      if (fill) ctx.fillRect(cx - half, cy + y, half * 2, 1);
      else {
        ctx.fillRect(cx - half, cy + y, 2, 1);
        ctx.fillRect(cx + half - 2, cy + y, 2, 1);
        if (k === 0) ctx.fillRect(cx - half, cy + y, half * 2, 1);
      }
    }
  }

  // ---- 5x7 bitmap font --------------------------------------------------------------
  const G = {
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
    4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
    8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
    E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
    I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
    '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
    '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], ':': [0, 12, 12, 0, 12, 12, 0], '/': [1, 2, 2, 4, 8, 8, 16],
    "'": [4, 4, 8, 0, 0, 0, 0], '*': [0, 21, 14, 31, 14, 21, 0], '%': [25, 26, 2, 4, 11, 11, 19], '∎': [0, 31, 31, 31, 31, 31, 0],
    ' ': [0, 0, 0, 0, 0, 0, 0],
  };
  // Draw text with a 1px dark outline. align: 'left' | 'center'. s = integer scale.
  function text(ctx, str, x, y, color, opts = {}) {
    const s = opts.scale || 1;
    str = String(str).toUpperCase().replace(/…/g, '...');
    const adv = 6 * s;
    const w = str.length * adv - s;
    let x0 = Math.round(opts.align === 'center' ? x - w / 2 : x);
    const y0 = Math.round(y);
    const pass = (col, ox, oy) => {
      ctx.fillStyle = col;
      for (let i = 0; i < str.length; i++) {
        const g = G[str[i]] || G['?'];
        for (let r = 0; r < 7; r++) {
          const bits = g[r];
          if (!bits) continue;
          for (let c = 0; c < 5; c++) if (bits & (16 >> c)) ctx.fillRect(x0 + i * adv + c * s + ox, y0 + r * s + oy, s, s);
        }
      }
    };
    if (opts.outline !== false) {
      const oc = opts.outline || '#0a0612';
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) pass(oc, ox, oy);
      if (opts.shadow !== false) pass(oc, 0, 2);
    }
    pass(color, 0, 0);
    return w;
  }

  CT.PAL = { PAL, RGB, RAMPS, PAL32, nearest, quantize, snapCanvas, snapHex, hex, N };
  CT.PXD = { ellipse, ellipseRing, disc, line, diamond, text };
})();
