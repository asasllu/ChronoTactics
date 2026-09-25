// Shared pixel-art toolkit: a letter-grid canvas with drawing primitives,
// the automatic outline + cel-shading pass, and sprite frame helpers. Every
// art module (sprites, portraits, decor) builds on this.
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

  // Grey-blue, scanlined "Echo" variant of any sprite canvas (Curator's archive copies).
  function echoify(src) {
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const g = cv.getContext('2d');
    g.drawImage(src, 0, 0);
    const img = g.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const y = Math.floor(i / 4 / cv.width);
      const l = d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15;
      const k = y % 3 === 0 ? 0.72 : 1;
      d[i] = Math.min(255, (l * 0.62 + 30) * k);
      d[i + 1] = Math.min(255, (l * 0.78 + 44) * k);
      d[i + 2] = Math.min(255, (l * 0.95 + 70) * k);
      d[i + 3] = Math.round(d[i + 3] * 0.86);
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  // Draw into a fresh canvas with a 2D-context callback.
  function canvas(w, h, fn) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (fn) fn(g, cv);
    return cv;
  }

  CT.PX = { Grid, shadeGrid, hex, mix, OUTLINE, SHADOW, LIGHT, flashOf, mirror, bbox, frameOf, echoify, canvas };
})();
