// Pixel-art lab kit: hand grids, vector->pixel conversion, outlines, cleanup.
(function () {
  const K = (window.KIT = {});
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  K.hex = hex;

  // A pixel buffer: w*h array of palette keys ('' = transparent).
  K.buf = (w, h) => ({ w, h, a: new Array(w * h).fill('') });
  K.get = (b, x, y) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? '' : b.a[y * b.w + x]);
  K.set = (b, x, y, c) => { if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.a[y * b.w + x] = c; };

  // Hand grid: rows of characters, '.' or ' ' transparent. Rows may be ragged.
  K.fromRows = (rows, w, h) => {
    w = w || Math.max(...rows.map((r) => r.length));
    h = h || rows.length;
    const b = K.buf(w, h);
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.' && r[x] !== ' ') K.set(b, x, y, r[x]); });
    return b;
  };

  // Pad a buffer by n pixels on every side.
  K.pad = (b, n = 1) => {
    const o = K.buf(b.w + n * 2, b.h + n * 2);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) K.set(o, x + n, y + n, K.get(b, x, y));
    return o;
  };

  // Outer outline: transparent pixels touching the figure (4-neighbourhood) become `key`.
  K.outline = (b, key = 'k') => {
    const o = K.pad(b, 1);
    const src = o.a.slice();
    for (let y = 0; y < o.h; y++)
      for (let x = 0; x < o.w; x++) {
        if (src[y * o.w + x]) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const X = x + dx, Y = y + dy;
          return X >= 0 && Y >= 0 && X < o.w && Y < o.h && src[Y * o.w + X] && src[Y * o.w + X] !== key;
        });
        if (n) o.a[y * o.w + x] = key;
      }
    return o;
  };

  // Selective inner outline ("selout"): where group A meets a *different group* below or
  // to the right, darken A's edge pixel with its line colour. groups: key -> group name,
  // lines: key -> key of the darker line colour to use.
  K.selout = (b, groups, lines) => {
    const src = b.a.slice();
    const g = (c) => groups[c] || c;
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const c = src[y * b.w + x];
        if (!c || !lines[c]) continue;
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          const d = X >= 0 && Y >= 0 && X < b.w && Y < b.h ? src[Y * b.w + X] : '';
          // Only draw the line on the *front* layer: the one listed as over the other.
          if (d && g(d) !== g(c) && (lines.over || []).some(([a, z]) => a === g(c) && z === g(d))) {
            b.a[y * b.w + x] = lines[c];
            break;
          }
        }
      }
    return b;
  };

  // Remove orphans: a pixel whose 4 neighbours are all different from it, and where 3+
  // neighbours agree, takes the neighbours' value. Keeps `keep` keys (eyes, glints).
  K.cleanup = (b, keep = '') => {
    const src = b.a.slice();
    for (let y = 1; y < b.h - 1; y++)
      for (let x = 1; x < b.w - 1; x++) {
        const c = src[y * b.w + x];
        if (keep.includes(c)) continue;
        const n = [src[y * b.w + x - 1], src[y * b.w + x + 1], src[(y - 1) * b.w + x], src[(y + 1) * b.w + x]];
        if (n.includes(c)) continue;
        const count = {};
        for (const v of n) count[v] = (count[v] || 0) + 1;
        const [best, k] = Object.entries(count).sort((p, q) => q[1] - p[1])[0];
        if (k >= 3) b.a[y * b.w + x] = best;
      }
    return b;
  };

  // Vector -> pixel: draw(ctx) paints flat colours in *target pixel units*; it is rendered
  // at `ss`x supersampling and each target pixel takes the most common opaque colour of its
  // block (if at least half the block is covered). Colours map back to keys via `pal`.
  K.pixelize = (w, h, ss, pal, draw) => {
    const cv = document.createElement('canvas');
    cv.width = w * ss;
    cv.height = h * ss;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = false;
    g.scale(ss, ss);
    draw(g);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    const rev = {};
    const cols = Object.entries(pal).map(([k, v]) => [k, hex(v)]);
    const keyOf = (r, gg, bb) => {
      const id = (r << 16) | (gg << 8) | bb;
      if (rev[id] !== undefined) return rev[id];
      let best = '', bd = 1e9;
      for (const [k, c] of cols) {
        const e = (c[0] - r) ** 2 + (c[1] - gg) ** 2 + (c[2] - bb) ** 2;
        if (e < bd) { bd = e; best = k; }
      }
      return (rev[id] = best);
    };
    const b = K.buf(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const count = {};
        let cov = 0;
        for (let j = 0; j < ss; j++)
          for (let i = 0; i < ss; i++) {
            const p = ((y * ss + j) * cv.width + (x * ss + i)) * 4;
            if (d[p + 3] < 128) continue;
            cov++;
            const k = keyOf(d[p], d[p + 1], d[p + 2]);
            count[k] = (count[k] || 0) + 1;
          }
        if (cov * 2 < ss * ss) continue;
        // Small high-priority details (eyes, glints) win if they cover a quarter of the block.
        let best = '', bn = -1;
        for (const k in count) {
          const pri = (pal.__detail || '').includes(k) && count[k] * 4 >= ss * ss ? 1e6 : 0;
          if (count[k] + pri > bn) { bn = count[k] + pri; best = k; }
        }
        K.set(b, x, y, best);
      }
    return b;
  };

  // Paint a buffer to a canvas at `scale`.
  K.toCanvas = (b, pal, scale = 1) => {
    const cv = document.createElement('canvas');
    cv.width = b.w * scale;
    cv.height = b.h * scale;
    const g = cv.getContext('2d');
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const c = b.a[y * b.w + x];
        if (!c) continue;
        g.fillStyle = pal[c] || '#ff00ff';
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    return cv;
  };
})();
