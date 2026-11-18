// Atmosphere: painted skies and backdrops, room walls behind interior maps, ambient
// life (birds, smoke, aurora, twinkling stars), weather and light pools.
//
// Everything here is authored in master-palette colours with hand-placed ordered
// dither, so `Renderer.present` passes it through untouched (palette pixels never
// re-dither). The renderer (render.js) calls in through CT.ATMOS:
//   background(r, name)      cached layers for a theme
//   drawBackground(r, now)   sky, far layers with parallax, animated sky life
//   drawWalls(r, ctx)        the far walls of a room (look.walls), behind the tiles
//   wallTex(style, ...)      wall texture lookup (used for floor reflections)
//   drawLights(r, g, lights, now)  stippled light pools into the scratch layer
//   drawWeather(r, now)      front particles: snow, embers, fireflies, butterflies...
(function () {
  const CT = (window.CT = window.CT || {});
  const { hash, vnoise } = CT.TX;
  const PXD = CT.PXD;
  const R = CT.PAL.RAMPS;
  const W = 480, H = 300;
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const le = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  const pk = (h) => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return (le ? (0xff000000 | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 0xff)) >>> 0;
  };
  const pkc = {};
  const P = (h) => pkc[h] || (pkc[h] = pk(h));
  const mod = (a, n) => ((a % n) + n) % n;

  // ---- Pixel buffer: packed palette colours, baked to a canvas with done() -----------
  class Buf {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.cv = CT.PX.canvas(w, h);
      this.g = this.cv.getContext('2d');
      this.img = this.g.createImageData(w, h);
      this.d = new Uint32Array(this.img.data.buffer);
    }
    set(x, y, c) {
      x |= 0; y |= 0;
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
    }
    get(x, y) {
      x |= 0; y |= 0;
      return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
    }
    rect(x, y, w, h, c) {
      for (let j = Math.max(0, y | 0); j < Math.min(this.h, (y | 0) + h); j++)
        for (let i = Math.max(0, x | 0); i < Math.min(this.w, (x | 0) + w); i++) this.d[j * this.w + i] = c;
    }
    // Filled ellipse; `dith` (0..1) keeps only that share of pixels (ordered).
    ell(cx, cy, rx, ry, c, dith) {
      for (let y = -ry; y <= ry; y++) {
        const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.5) * (ry + 0.5)))));
        for (let x = -hw; x <= hw; x++) if (dith == null || bayer(cx + x, cy + y) < dith) this.set(cx + x, cy + y, c);
      }
    }
    rows(x, y, rows, map) {
      rows.forEach((r, j) => [...r].forEach((ch, i) => map[ch] && this.set(x + i, y + j, P(map[ch]))));
    }
    done() {
      this.g.putImageData(this.img, 0, 0);
      return this.cv;
    }
  }

  // Vertical colour bands with an ordered-dither blend into the next band.
  // bands: [[hex, weight]...] top to bottom between y0 and y1.
  function bands(b, y0, y1, list, soft = 12) {
    const tot = list.reduce((a, [, w]) => a + w, 0);
    let acc = 0;
    const edges = list.map(([, w]) => (acc += w) / tot);
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / (y1 - y0);
      let i = 0;
      while (i < list.length - 1 && t >= edges[i]) i++;
      const end = y0 + edges[i] * (y1 - y0);
      const k = i < list.length - 1 ? Math.max(0, 1 - (end - y) / soft) : 0;
      const a = P(list[i][0]), n = i < list.length - 1 ? P(list[i + 1][0]) : a;
      for (let x = 0; x < b.w; x++) b.d[y * b.w + x] = k > bayer(x, y) ? n : a;
    }
  }

  // Mountain ridge: lit left flanks, shaded right flanks (the sun sits top-left), a mid
  // tone lower down. o: base amp f seed lit mid shade k peaks snow yEnd
  function ridge(b, o) {
    const tops = new Int16Array(b.w);
    for (let x = 0; x < b.w; x++) {
      const X = x + (o.off || 0);
      let n;
      if (o.peaks) {
        const r1 = 1 - Math.abs(2 * vnoise(X * o.f, 3, o.seed) - 1);
        n = r1 * r1 * 0.72 + vnoise(X * o.f * 3.1, 7, o.seed + 1) * 0.2 + vnoise(X * o.f * 9, 9, o.seed + 2) * 0.08;
      } else n = vnoise(X * o.f, 3, o.seed) * 0.62 + vnoise(X * o.f * 2.7, 7, o.seed + 1) * 0.28 + vnoise(X * o.f * 8, 9, o.seed + 2) * 0.1;
      tops[x] = Math.round(o.base - n * o.amp);
    }
    const lit = P(o.lit), mid = P(o.mid), shade = P(o.shade || o.mid);
    const snowL = o.snow && P(o.snow[0]), snowS = o.snow && P(o.snow[1]);
    let sh = 1e9;
    for (let x = 0; x < b.w; x++) {
      const top = tops[x];
      sh = Math.min(top, sh + (o.k || 0.8));
      const depth = 5 + Math.floor(vnoise((x + (o.off || 0)) * 0.07, 1, o.seed + 5) * (o.body || 16));
      const snowD = o.snow ? Math.round((o.base - top - o.amp * (o.snowLine || 0.5)) * 0.5 + (hash(x >> 1, 0, o.seed + 9) - 0.5) * 3) : 0;
      for (let y = Math.max(0, top); y < (o.yEnd || b.h); y++) {
        const d = y - top;
        const jag = (hash(x >> 1, y >> 1, o.seed + 7) - 0.5) * 2.4;
        const inShade = y + jag > sh + 1.5;
        let c;
        if (d < snowD) c = inShade ? snowS : snowL;
        else if (inShade) c = d < depth + 6 || bayer(x, y) > (d - depth - 6) / 8 ? shade : mid;
        else c = d < depth || bayer(x, y) > (d - depth) / 6 ? lit : mid;
        b.d[y * b.w + x] = c;
      }
    }
    return tops;
  }

  // Tree line silhouettes. kind: round | conifer | jungle. cols: [dark, mid, lit]
  function treeline(b, o) {
    const dark = P(o.cols[0]), midc = P(o.cols[1]), lit = P(o.cols[2]);
    let x = -6 - Math.floor(hash(1, 2, o.seed) * 6);
    let i = 0;
    b.rect(0, o.y + 2, b.w, b.h - o.y, dark);
    while (x < b.w + 10) {
      const h1 = hash(i, 1, o.seed), h2 = hash(i, 2, o.seed);
      if (o.kind === 'conifer') {
        const th = 10 + Math.floor(h1 * 14), hw = 3 + Math.floor(th / 6);
        const top = o.y - th + 4;
        for (let y = 0; y < th; y++) {
          const tier = y % 5;
          const w = Math.max(0, Math.round((y / th) * hw + tier * 0.45));
          for (let k = -w; k <= w; k++) b.set(x + k, top + y, k < -w + 1 + (tier === 0 ? 1 : 0) && w > 0 ? midc : dark);
          if (o.snow && tier === 0 && y > 0 && w > 1 && (i + y) % 2 === 0) for (let k = -w; k < -w + 2; k++) b.set(x + k, top + y, lit);
        }
        if (o.snow && h1 > 0.4) b.set(x, top, lit);
        x += 5 + Math.floor(h2 * 6);
      } else {
        const r = (o.kind === 'jungle' ? 5 : 4) + Math.floor(h1 * 5);
        const cy = o.y - Math.floor(h2 * 5);
        b.ell(x, cy, r, r - 1, dark);
        // top-left rim of leaves catching the light
        if (i % 2 === 0 || h1 > 0.7) {
          for (let a = 0; a < 7; a++) {
            const ang = Math.PI * (1.12 + a / 20);
            b.set(Math.round(x + Math.cos(ang) * (r - 1)), Math.round(cy + Math.sin(ang) * (r - 2)), midc);
          }
          if (h1 > 0.55) b.set(x - 2, cy - r + 2, lit);
        }
        if (o.kind === 'jungle' && h2 > 0.62) {
          // a palm rising above the canopy
          const ty = cy - r - 7;
          for (let y = ty; y < cy; y++) b.set(x + 2, y, dark);
          for (let k = 1; k <= 5; k++) {
            b.set(x + 2 - k, ty + (k >> 1) - 1, k < 3 ? midc : dark);
            b.set(x + 2 + k, ty + (k >> 1) - 1, dark);
            b.set(x + 2 - k, ty + k - 2, dark);
            b.set(x + 2 + k, ty + k - 2, dark);
          }
        }
        x += r + 2 + Math.floor(h2 * 4);
      }
      i++;
    }
  }

  // Cloud sprite: puffs on a flat base. cols: [shade, body, light]
  function cloudSprite(seed, w, cols) {
    const h = 20;
    const b = new Buf(w, h);
    const puffs = [];
    const n = 4 + Math.floor(w / 14);
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      const r = Math.round((3 + hash(seed, k, 71) * 4) * (0.6 + Math.sin(u * Math.PI) * 0.7));
      puffs.push([Math.round(6 + u * (w - 12)), 14 - Math.round(r * 0.6), r]);
    }
    for (const [x, y, r] of puffs) b.ell(x, y, r, r, P(cols[0]));
    for (const [x, y, r] of puffs) b.ell(x - 1, y - 1, Math.max(1, r - 1), Math.max(1, r - 1), P(cols[1]));
    for (const [x, y, r] of puffs) if (r > 3) b.ell(x - 1, y - 2, r - 3, Math.max(1, r - 3), P(cols[2]));
    // flat underside
    for (let y = 15; y < h; y++) for (let x = 0; x < w; x++) b.d[y * w + x] = 0;
    for (let x = 0; x < w; x++) if (b.d[14 * w + x]) b.d[14 * w + x] = P(cols[0]);
    return b.done();
  }

  // Celestial bodies.
  function moon(b, cx, cy, r, sky) {
    const halo = P(sky);
    for (let y = -r - 7; y <= r + 7; y++)
      for (let x = -r - 7; x <= r + 7; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > r && d <= r + 7 && bayer(cx + x, cy + y) < (r + 7 - d) / 9) b.set(cx + x, cy + y, halo);
      }
    b.ell(cx, cy, r, r, P(R.slate[4]));
    b.ell(cx - 1, cy - 1, r - 1, r - 1, P(R.skin[5]));
    for (const [x, y, w] of [[-4, -3, 3], [2, 1, 2], [-2, 4, 2], [3, -4, 1], [-6, 1, 1]]) {
      b.rect(cx + x, cy + y, w, 1, P(R.slate[4]));
      if (w > 1) b.rect(cx + x, cy + y + 1, w - 1, 1, P(R.slate[4]));
    }
  }
  function sun(b, cx, cy, r, cols, halo) {
    for (let y = -r - 14; y <= r + 14; y++)
      for (let x = -r - 14; x <= r + 14; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > r && d <= r + 14 && bayer(cx + x, cy + y) < ((r + 14 - d) / 14) * 0.8) b.set(cx + x, cy + y, P(d < r + 5 ? halo[0] : halo[1]));
      }
    b.ell(cx, cy, r, r, P(cols[1]));
    b.ell(cx, cy, r - 2, r - 2, P(cols[0]));
  }
  function stars(b, n, yMax, seed, cols) {
    for (let i = 0; i < n; i++) {
      const y = Math.floor(hash(i, 5, seed) * yMax);
      const x = Math.floor(hash(i, 4, seed) * b.w);
      const br = hash(i, 6, seed) * (1 - (y / yMax) * 0.7);
      b.set(x, y, P(cols[br > 0.62 ? 0 : br > 0.3 ? 1 : 2]));
    }
  }
  // A volcano cone with strata; glow: lava in the crater and down the flank.
  function volcano(b, cx, top, base, cols, glow) {
    for (let y = top; y <= base; y++) {
      const k = (y - top) / (base - top);
      const hwL = Math.round(9 + k * k * 46 + k * 30), hwR = Math.round(11 + k * k * 30 + k * 44);
      for (let x = cx - hwL; x <= cx + hwR; x++) {
        const u = (x - cx) / (x < cx ? hwL : hwR);
        const jag = hash(x >> 1, y >> 2, 811) * 0.24;
        let c = u < -0.25 + jag ? cols[2] : u > 0.35 - jag ? cols[0] : cols[1];
        if ((y + (x >> 2)) % 7 === 0 && hash(x >> 2, y, 812) > 0.4) c = cols[0];
        b.set(x, y, P(c));
      }
    }
    // crater lip
    b.rect(cx - 9, top - 1, 6, 1, P(cols[2]));
    b.rect(cx + 5, top - 1, 7, 1, P(cols[1]));
    if (glow) {
      b.rect(cx - 3, top - 1, 8, 2, P(R.gold[2]));
      b.rect(cx - 2, top - 2, 6, 1, P(R.gold[3]));
      let x = cx + 1;
      for (let y = top + 1; y < base; y++) {
        x += hash(y, 1, 813) > 0.62 ? 1 : hash(y, 2, 813) > 0.86 ? -1 : 0;
        b.set(x, y, P(y < top + 14 ? R.gold[2] : y < top + 40 ? R.gold[1] : R.red[3]));
        if (y % 3) b.set(x + 1, y, P(y < top + 22 ? R.gold[1] : R.red[2]));
      }
    }
  }

  // ---- Theme backdrops ----------------------------------------------------------------
  // Each returns { sky, far, near, clouds, extra } canvases; far/near are wider than
  // the screen and slide a little with the camera.
  const PADF = 16, PADN = 32;
  const SK = {
    dusk: {
      bands: [[R.blue[0], 2], [R.blue[1], 2], [R.blue[2], 1.6], [R.purple[2], 1.2], [R.pink[1], 1], [R.pink[2], 0.9], [R.skin[3], 0.8], [R.gold[3], 0.9]],
      stars: [50, 110], sun: [372, 204, 12, [R.gold[4], R.gold[3]], [R.gold[3], R.skin[3]]],
      mtn: [[R.pink[1], R.purple[2], R.purple[1]], [R.purple[2], R.purple[1], R.purple[0]], [R.purple[1], R.purple[0], R.ink[2]]],
      trees: ['round', [R.ink[1], R.ink[2], R.purple[1]]], clouds: [R.pink[1], R.pink[3], R.gold[4]], life: 'birds',
    },
    night: {
      bands: [[R.ink[0], 2.2], [R.ink[1], 1.4], [R.blue[0], 2.6], [R.blue[1], 1.6], [R.blue[2], 0.5]],
      stars: [170, 190], moon: [86, 46, 10, R.blue[1]],
      mtn: [[R.blue[2], R.blue[1], R.blue[0]], [R.blue[1], R.blue[0], R.ink[2]], [R.blue[0], R.ink[2], R.ink[1]]],
      trees: ['round', [R.ink[0], R.ink[1], R.blue[0]]], life: 'shooting',
    },
    dawn: {
      bands: [[R.blue[2], 1.6], [R.purple[3], 1.6], [R.pink[3], 1.5], [R.pink[4], 1.2], [R.skin[4], 1.2], [R.gold[4], 1.4]],
      stars: [16, 60], sun: [50, 204, 14, [R.white[0], R.gold[4]], [R.gold[4], R.gold[3]]],
      mtn: [[R.pink[3], R.purple[4], R.purple[3]], [R.purple[4], R.purple[3], R.purple[2]], [R.purple[3], R.purple[2], R.purple[1]]],
      trees: ['round', [R.purple[0], R.purple[1], R.pink[1]]], clouds: [R.pink[3], R.skin[5], R.white[0]], life: 'birds',
    },
    day: {
      bands: [[R.blue[3], 2], [R.blue[4], 2.4], [R.blue[5], 2], [R.blue[6], 1.4]],
      sun: [408, 40, 7, [R.white[0], R.gold[4]], [R.blue[6], R.blue[5]]],
      mtn: [[R.blue[6], R.blue[5], R.blue[4]], [R.blue[5], R.blue[4], R.blue[3]], [R.teal[2], R.teal[1], R.teal[0]]],
      trees: ['round', [R.green[1], R.green[2], R.green[4]]], clouds: [R.blue[6], R.white[0], R.white[0]], life: 'birds',
    },
    mountain: {
      bands: [[R.blue[3], 2.2], [R.blue[4], 2.2], [R.blue[5], 2], [R.blue[6], 1.6]],
      sun: [410, 44, 7, [R.white[0], R.gold[4]], [R.blue[6], R.blue[5]]],
      mtn: [[R.slate[4], R.slate[3], R.slate[2]], [R.blue[5], R.blue[4], R.blue[3]], [R.blue[3], R.blue[2], R.blue[1]]],
      peaks: true, snow: [R.white[0], R.slate[4]],
      trees: ['conifer', [R.green[0], R.green[1], R.green[2]]], clouds: [R.blue[6], R.white[0], R.white[0]], life: 'eagle',
    },
    prehistoric: {
      bands: [[R.teal[1], 1.6], [R.teal[2], 2], [R.teal[3], 2], [R.green[6], 1.6], [R.gold[4], 1.2]],
      sun: [58, 44, 11, [R.white[0], R.gold[4]], [R.gold[4], R.green[6]]],
      mtn: [[R.teal[3], R.teal[2], R.teal[1]], [R.green[4], R.green[3], R.green[2]], [R.green[3], R.green[2], R.green[1]]],
      volcano: [436, 78, 200, [R.teal[0], R.teal[1], R.teal[2]], false, [R.slate[3], R.slate[4], R.slate[5]]],
      trees: ['jungle', [R.green[0], R.green[1], R.green[3]]], clouds: [R.green[6], R.skin[5], R.white[0]], life: 'dactyls',
    },
    volcanic: {
      bands: [[R.ink[0], 1.6], [R.ink[1], 1.2], [R.red[0], 2], [R.red[1], 1.8], [R.red[2], 1.2], [R.gold[0], 0.8], [R.gold[1], 0.6]],
      stars: [30, 70],
      mtn: [[R.red[2], R.red[1], R.red[0]], [R.red[1], R.red[0], R.ink[1]], [R.red[0], R.ink[1], R.ink[0]]],
      volcano: [60, 40, 200, [R.ink[1], R.red[0], R.red[1]], true, [R.ink[2], R.red[0], R.red[1]]],
      peaks: true, life: 'ash',
    },
    snow: {
      bands: [[R.blue[0], 1.4], [R.blue[1], 2], [R.blue[2], 1.8], [R.slate[2], 1.4], [R.slate[3], 1.2], [R.slate[4], 1]],
      stars: [70, 120],
      mtn: [[R.slate[5], R.slate[3], R.slate[2]], [R.slate[4], R.slate[2], R.slate[1]], [R.slate[3], R.slate[1], R.slate[0]]],
      peaks: true, snow: [R.white[0], R.slate[4]],
      trees: ['conifer', [R.blue[0], R.blue[1], R.slate[5]], true], aurora: [[R.teal[3], R.teal[2], R.green[5]], 58], life: 'none',
    },
    zeal: {
      bands: [[R.ink[1], 1.2], [R.blue[0], 2], [R.blue[1], 2.2], [R.blue[2], 1.6], [R.blue[3], 0.9], [R.blue[5], 0.35]],
      stars: [120, 150], sea: [206, R.blue[1], R.blue[0], [R.blue[3], R.blue[5]]],
      aurora: [[R.purple[3], R.purple[2], R.purple[4]], 34], islets: true, life: 'meteors',
    },
    void: { fill: R.ink[0], stars: [110, 300], nebula: [[R.purple[0], R.blue[0]], 0.6], life: 'shooting' },
    castle: { interior: 'castle' },
    museum: { interior: 'museum' },
    core: { interior: 'core' },
  };

  function paintSky(name) {
    const o = SK[name] || SK.dusk;
    const sky = new Buf(W, H);
    if (o.interior) return paintInterior(o.interior, sky);
    if (o.bands) bands(sky, 0, 236, o.bands);
    else sky.rect(0, 0, W, H, P(o.fill));
    if (o.bands) sky.rect(0, 236, W, H - 236, P(o.bands[o.bands.length - 1][0]));
    if (o.nebula) {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const n = vnoise(x * 0.012, y * 0.02, 31) * 0.6 + vnoise(x * 0.04, y * 0.05, 32) * 0.4;
          const m = vnoise(x * 0.01 + 40, y * 0.016, 33);
          if (n > o.nebula[1] && bayer(x, y) < (n - o.nebula[1]) * 3.2) sky.d[y * W + x] = P(o.nebula[0][m > 0.5 ? 0 : 1]);
        }
    }
    if (o.stars) stars(sky, o.stars[0], o.stars[1], 9, [R.white[0], R.slate[4], R.slate[2]]);
    if (o.moon) moon(sky, o.moon[0], o.moon[1], o.moon[2], o.moon[3]);
    if (o.sun) sun(sky, o.sun[0], o.sun[1], o.sun[2], o.sun[3], o.sun[4]);
    const out = { sky: sky.done(), o, tw: [] };
    // Twinkling stars are drawn live on top of the baked ones.
    if (o.stars) for (let i = 0; i < Math.min(26, o.stars[0] / 4); i++) out.tw.push([Math.floor(hash(i, 11, 77) * W), Math.floor(hash(i, 12, 77) * o.stars[1] * 0.8), hash(i, 13, 77) * 6.28, hash(i, 14, 77) > 0.7]);

    if (o.mtn) {
      const far = new Buf(W + PADF * 2, H);
      const pk = !!o.peaks;
      ridge(far, { base: 196, amp: pk ? 96 : 52, f: pk ? 0.011 : 0.013, seed: 3, lit: o.mtn[0][0], mid: o.mtn[0][1], shade: o.mtn[0][2], k: pk ? 0.9 : 0.5, peaks: pk, snow: o.snow, snowLine: 0.42, body: 22 });
      if (o.volcano) volcano(far, o.volcano[0] + PADF, o.volcano[1], o.volcano[2], o.volcano[3], o.volcano[4]);
      ridge(far, { base: 216, amp: pk ? 60 : 40, f: pk ? 0.019 : 0.021, seed: 13, off: 300, lit: o.mtn[1][0], mid: o.mtn[1][1], shade: o.mtn[1][2], k: pk ? 0.8 : 0.5, peaks: pk, body: 14 });
      out.far = far.done();
      const near = new Buf(W + PADN * 2, H);
      ridge(near, { base: 236, amp: 30, f: 0.03, seed: 23, off: 700, lit: o.mtn[2][0], mid: o.mtn[2][1], shade: o.mtn[2][2], k: 0.5, body: 9 });
      if (o.trees) treeline(near, { y: 244, kind: o.trees[0], cols: o.trees[1], seed: 5, snow: o.trees[2] });
      out.near = near.done();
    }
    if (o.sea) {
      const far = new Buf(W + PADF * 2, H);
      const [y0, c0, c1, gl] = o.sea;
      for (let y = y0; y < H; y++)
        for (let x = 0; x < far.w; x++) far.d[y * far.w + x] = P(bayer(x, y) < (y - y0) / 70 ? c1 : c0);
      far.rect(0, y0, far.w, 1, P(gl[0]));
      for (let i = 0; i < 90; i++) {
        const y = y0 + 2 + Math.floor(hash(i, 31, 5) * hash(i, 33, 5) * 80);
        far.rect(Math.floor(hash(i, 30, 5) * far.w), y, 2 + Math.floor(hash(i, 32, 5) * (2 + (y - y0) / 8)), 1, P(gl[0]));
      }
      out.far = far.done();
      out.sea = { y0, gl };
    }
    if (o.islets) out.islets = [isletSprite(0), isletSprite(1), isletSprite(2)];
    if (o.clouds) {
      out.clouds = [0, 1, 2, 3, 4].map((i) => ({
        c: cloudSprite(i + 1, 44 + Math.floor(hash(i, 8, 1) * 40), o.clouds),
        x: hash(i, 9, 1) * (W + 100), y: 18 + i * 21 + Math.floor(hash(i, 10, 1) * 10), v: 0.0016 + hash(i, 11, 1) * 0.0022,
      }));
    }
    return out;
  }

  // Fallen Zeal: far islets still hanging in the sky, waterfalls pouring off them.
  function isletSprite(v) {
    const w = [58, 36, 46][v], h = 34;
    const b = new Buf(w, h);
    const cx = w >> 1;
    for (let x = 0; x < w; x++) {
      const u = (x - cx) / (w / 2);
      const top = 12 + Math.round(Math.abs(u) * 2 + hash(x >> 2, v, 91) * 1.5);
      const dep = Math.round((1 - u * u) * (12 + v * 2) * (0.6 + hash(x >> 1, v, 92) * 0.6));
      for (let y = top; y < top + dep + 2; y++) {
        const c = y === top ? R.slate[5] : y < top + 3 ? R.blue[5] : (x + y) % 5 === 0 ? R.blue[3] : R.blue[4];
        b.set(x, y, P(u > 0.3 && y > top + 1 ? R.blue[3] : c));
      }
    }
    // ruined colonnade and a dome
    const tx = cx - 8 + v * 3;
    for (let k = 0; k < 4; k++) {
      const hgt = [7, 9, 4, 8][(k + v) % 4];
      b.rect(tx + k * 5, 12 - hgt, 2, hgt, P(R.slate[4]));
      b.set(tx + k * 5, 12 - hgt, P(R.white[0]));
    }
    if (v !== 1) { b.ell(cx + 12, 10, 5, 4, P(R.blue[4])); b.ell(cx + 11, 9, 3, 2, P(R.slate[5])); b.rect(cx + 7, 11, 11, 2, P(R.blue[4])); }
    return b.done();
  }

  // ---- Interiors ----------------------------------------------------------------------
  function paintInterior(kind, sky) {
    const out = { sky: null, o: SK[kind], tw: [] };
    if (kind === 'castle') {
      // The dark above and below a torch-lit hall.
      bands(sky, 0, H, [[R.ink[0], 3.2], [R.ink[1], 2.6], [R.ink[2], 0.6]], 14);
    } else if (kind === 'museum') {
      // White on white: the galleries go on into a cold haze.
      bands(sky, 0, H, [[R.slate[3], 0.5], [R.slate[4], 1.8], [R.slate[5], 3], [R.white[0], 3]], 30);
      // faint ribs of far vaulting high overhead
      for (let k = 0; k < 5; k++) {
        const cx = 40 + k * 100, col = P(R.slate[4]);
        for (let a = 0; a <= 120; a++) {
          const t = a / 120;
          const x = cx - 60 + Math.round(t * 120), y = 70 - Math.round(Math.sin(t * Math.PI) * 34);
          if ((a >> 1) & 1) sky.set(x, y, col);
        }
      }
    } else if (kind === 'core') {
      // The wound: a red throat behind the platform, drawn in three pulse phases.
      out.frames = [0, 1, 2].map((f) => {
        const b = new Buf(W, H);
        const cx = 240, cy = 150;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const dx = (x - cx) / 2, dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            const ang = Math.atan2(dy, dx);
            const wob = vnoise(ang * 3.1 + 10, d * 0.04, 51) * 26 + vnoise(ang * 9 + 4, d * 0.1, 52) * 8;
            const ring = mod(d + wob - f * 5, 46);
            const crack = Math.abs(vnoise(ang * 7 + 3, d * 0.015, 53) - 0.5);
            let c = R.ink[0];
            const depth = Math.max(0, 1 - d / 190);
            if (ring < 3) c = depth > 0.45 ? R.red[3] : depth > 0.2 ? R.red[2] : R.red[1];
            else if (ring < 9) c = depth > 0.45 ? R.red[2] : depth > 0.15 ? R.red[1] : R.red[0];
            else if (ring < 20) c = bayer(x, y) < depth * 1.1 ? R.red[1] : R.red[0];
            else c = bayer(x, y) < depth * 0.9 ? R.red[0] : R.ink[0];
            if (crack < 0.012 + depth * 0.02) c = depth > 0.5 ? R.gold[1] : depth > 0.22 ? R.red[3] : R.red[2];
            else if (crack < 0.03 + depth * 0.03 && bayer(x, y) < 0.5) c = R.red[2];
            b.d[y * W + x] = P(c);
          }
        return b.done();
      });
      sky = null;
    }
    out.sky = sky ? sky.done() : out.frames[0];
    return out;
  }

  const bgCache = new Map();
  function background(r, name) {
    if (!bgCache.has(name)) bgCache.set(name, paintSky(SK[name] ? name : 'dusk'));
    return bgCache.get(name);
  }

  // Aurora: curtains re-rendered a few times a second into their own layer.
  let aur = null;
  function aurora(cols, yBase, now) {
    const f = Math.floor(now / 180);
    if (!aur) aur = { cv: CT.PX.canvas(W, 150), f: -1 };
    if (aur.f === f && aur.cols === cols) return aur.cv;
    aur.f = f; aur.cols = cols;
    const g = aur.cv.getContext('2d');
    g.clearRect(0, 0, W, 150);
    const t = f * 0.045;
    for (let k = 0; k < 2; k++) {
      for (let x = 0; x < W; x++) {
        const u = x * 0.014 + k * 2.1;
        const y = yBase + k * 26 + Math.sin(u + t) * 12 + Math.sin(u * 2.7 - t * 1.6) * 5;
        const str = 0.5 + 0.5 * Math.sin(u * 3.3 + t * 2.2 + k);
        const len = Math.round(10 + str * 26);
        if (str < 0.12) continue;
        const yb = Math.round(y);
        g.fillStyle = cols[0];
        g.fillRect(x, yb - 1, 1, 2);
        g.fillStyle = cols[1];
        for (let j = 2; j < len; j++) {
          const a = 1 - j / len;
          if (bayer(x, yb - j) < a * 0.85) g.fillRect(x, yb - j, 1, 1);
        }
        if (k === 0 && str > 0.7) { g.fillStyle = cols[2]; for (let j = len >> 1; j < len; j += 2) if ((x + j) & 1) g.fillRect(x, yb - j, 1, 1); }
      }
    }
    return aur.cv;
  }

  const BIRD = [['x...x', '.x.x.', '..x..'], ['.....', 'xx.xx', '..x..'], ['..x..', '.x.x.', 'x...x']];
  const DACTYL = [
    ['xx.......xx', '.xxx...xxx.', '...xxxxx...', '....xxxo...', '.....x.....'],
    ['...........', '...........', 'xxxxxxxxxxx', '.xx.xxxo.x.', '.....x.....'],
    ['...........', '....xxxo...', '..xxxxxxx..', '.xx..x..xx.', 'x.........x'],
  ];
  function sprite(ctx, rows, x, y, col, eye) {
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const ch = rows[j][i];
        if (ch === '.') continue;
        ctx.fillStyle = ch === 'o' ? eye || col : col;
        ctx.fillRect(x + i, y + j, 1, 1);
      }
  }

  function drawBackground(r, now) {
    const name = (r.map && r.map.theme) || 'dusk';
    const bg = background(r, name);
    const o = bg.o;
    const ctx = r.ctx;
    const cam = r.cam || [0, 0];
    const par = (k, pad) => Math.max(-pad, Math.min(pad, Math.round(-cam[0] * k)));
    if (bg.frames) ctx.drawImage(bg.frames[[0, 1, 2, 1][Math.floor(now / 420) % 4]], 0, 0);
    else ctx.drawImage(bg.sky, 0, 0);
    // twinkle
    for (const [x, y, p, big] of bg.tw) {
      const a = Math.sin(now / 520 + p * 3) * Math.sin(now / 1370 + p);
      if (a > 0.35) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, 1, 1);
        if (big && a > 0.6) { ctx.fillStyle = R.slate[3]; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
      } else if (a < -0.5) { ctx.fillStyle = R.ink[1]; ctx.fillRect(x, y, 1, 1); }
    }
    if (o.aurora) ctx.drawImage(aurora(o.aurora[0], o.aurora[1], now), 0, 0);
    if (o.life === 'shooting' || o.life === 'meteors') {
      // one streak now and then
      const per = o.life === 'meteors' ? 5200 : 9000;
      const k = Math.floor(now / per), t = (now % per) / 700;
      if (t < 1) {
        const x0 = 60 + hash(k, 1, 61) * 340, y0 = 10 + hash(k, 2, 61) * 60;
        const dir = hash(k, 3, 61) > 0.5 ? 1 : -1;
        for (let i = 0; i < 9; i++) {
          const q = t * 70 - i * 2.2;
          if (q < 0) continue;
          ctx.fillStyle = i < 2 ? '#ffffff' : i < 5 ? R.blue[5] : R.blue[3];
          ctx.fillRect(Math.round(x0 + dir * q), Math.round(y0 + q * 0.45), 1, 1);
        }
      }
    }
    if (bg.clouds) {
      for (const cl of bg.clouds) {
        const x = ((cl.x + now * cl.v) % (W + cl.c.width + 40)) - cl.c.width - 20;
        ctx.drawImage(cl.c, Math.round(x), cl.y);
      }
    }
    if (bg.far) ctx.drawImage(bg.far, -PADF + par(0.03, PADF), 0);
    if (bg.islets) {
      const spots = [[4, 96], [196, 4], [416, 84]];
      bg.islets.forEach((s, i) => {
        const x = spots[i][0] + par(0.05, 20), y = spots[i][1] + Math.round(Math.sin(now / 2600 + i * 2) * 1.5);
        ctx.drawImage(s, x, y);
        // waterfalls: dashed threads falling to the sea
        for (let k = 0; k < 2 + (i === 0 ? 1 : 0); k++) {
          const fx = x + 8 + k * 13 + i * 3, fy = y + 22 + k * 3;
          for (let yy = fy; yy < bg.sea.y0 + 2; yy++) {
            const ph = mod(yy - Math.floor(now / 50) + k * 3, 7);
            ctx.fillStyle = ph < 2 ? R.blue[6] : ph < 5 ? R.blue[4] : R.blue[3];
            if (ph !== 6) ctx.fillRect(fx, yy, 1, 1);
          }
          ctx.fillStyle = Math.floor(now / 160 + k) % 2 ? R.blue[6] : R.blue[5];
          ctx.fillRect(fx - 2, bg.sea.y0, 5, 1);
        }
      });
    }
    if (bg.sea) {
      // moving glints
      for (let i = 0; i < 26; i++) {
        const y = bg.sea.y0 + 3 + Math.floor(hash(i, 41, 7) * hash(i, 44, 7) * 90);
        const x = Math.floor(hash(i, 40, 7) * W + Math.sin(now / 900 + i) * 3);
        if (Math.floor(now / 300 + hash(i, 42, 7) * 5) % 3 === 0) continue;
        ctx.fillStyle = bg.sea.gl[i % 5 === 0 ? 1 : 0];
        ctx.fillRect(x, y, 2 + (i % 3), 1);
      }
    }
    if (o.volcano) {
      // smoke column from the crater
      const [vx, vy, , , glow, sm] = o.volcano;
      const cx = vx + par(0.03, PADF) + 2;
      for (let i = 9; i >= 0; i--) {
        const age = mod(now / 5200 + i / 10, 1);
        const x = cx + age * 46 + Math.sin(age * 5 + i) * 4;
        const y = vy - 4 - age * 78;
        const rad = Math.round(3 + age * 9);
        ctx.fillStyle = sm[age < 0.3 ? 0 : age < 0.65 ? 1 : 2];
        if (age > 0.88) { if (i & 1) PXD.disc(ctx, x, y, rad - 3); } else PXD.disc(ctx, x, y, rad);
        if (age < 0.7) { ctx.fillStyle = sm[age < 0.3 ? 1 : 2]; PXD.disc(ctx, x - 2, y - 2, Math.max(1, rad - 3)); }
      }
      if (glow) {
        ctx.fillStyle = Math.floor(now / 140) % 3 ? R.gold[3] : R.gold[4];
        ctx.fillRect(cx - 4, vy - 2, 6, 1);
        for (let i = 0; i < 4; i++) {
          const age = mod(now / 900 + i / 4, 1);
          ctx.fillStyle = age < 0.5 ? R.gold[3] : R.gold[1];
          ctx.fillRect(Math.round(cx - 2 + (hash(i, Math.floor(now / 900 + i / 4), 3) - 0.5) * 14 * age), Math.round(vy - 3 - Math.sin(age * Math.PI) * 14), 1, 1);
        }
      }
    }
    if (bg.near) ctx.drawImage(bg.near, -PADN + par(0.07, PADN), 0);
    if (o.life === 'birds' || o.life === 'eagle' || o.life === 'dactyls') {
      const dact = o.life === 'dactyls';
      const n = o.life === 'eagle' ? 1 : dact ? 2 : 4;
      const per = dact ? 26000 : 19000;
      const k = Math.floor(now / per), t = (now % per) / per;
      const dir = hash(k, 1, 83) > 0.5 ? 1 : -1;
      const y0 = 24 + hash(k, 2, 83) * 70;
      for (let i = 0; i < n; i++) {
        const tt = t * 1.5 - i * 0.03;
        if (tt < 0 || tt > 1) continue;
        let x = (dir > 0 ? -20 : W + 20) + dir * tt * (W + 40), y = y0 + i * (i & 1 ? 7 : -5) + Math.sin(tt * 9 + i) * 5;
        if (o.life === 'eagle') { x = 250 + Math.cos(now / 4200) * 150; y = 44 + Math.sin(now / 4200) * 22; }
        const fr = o.life === 'eagle' ? (Math.floor(now / 900) % 4 === 0 ? 1 : 0) : Math.floor(now / (dact ? 260 : 150) + i) % 4;
        sprite(ctx, (dact ? DACTYL : BIRD)[[0, 1, 2, 1][fr]], Math.round(x), Math.round(y), dact ? R.teal[0] : name === 'dusk' ? R.purple[0] : R.ink[2], R.gold[3]);
      }
    }
    if (o.interior === 'core') drawDebris(r, ctx, now);
  }

  // White tiles torn off the Hollow, drifting into the wound.
  function drawDebris(r, ctx, now) {
    for (let i = 0; i < 16; i++) {
      const a = hash(i, 1, 97) * 6.28 + now / (30000 + i * 900);
      const rad = 150 + hash(i, 2, 97) * 110 + Math.sin(now / 3000 + i) * 4;
      const x = Math.round(240 + Math.cos(a) * rad), y = Math.round(150 + Math.sin(a) * rad * 0.55);
      const s = 2 + Math.floor(hash(i, 3, 97) * 4);
      ctx.fillStyle = R.slate[5];
      PXD.diamond(ctx, x, y, s, true);
      ctx.fillStyle = R.slate[3];
      ctx.fillRect(x - s + 1, y + 1, s * 2 - 1, 1);
      ctx.fillStyle = R.red[2];
      if (i % 3 === 0) ctx.fillRect(x, y, 1, 1);
    }
  }

  // ---- Room walls ---------------------------------------------------------------------
  // look.walls = { style, h }. Texture lookup: side 0 = left wall (in shade), 1 = right
  // wall (lit); u = px along the wall from the far corner; v = px down from the top.
  const PAINTINGS = [
    // the fair at night
    ['bbbbbbbbbbbbbb', 'bbwbbbbbbybbbb', 'bbbbbrbbbbbbwb', 'bbbbrwrbbbsbbb', 'bbbrwrwrbsssbb', 'bbbrwrwrbsysbb', 'gggrwkwrgsssgg', 'gggggggggsksgg', 'gggggggggggggg'],
    // Guardia castle
    ['cccccccccccccc', 'ccccrrcccccccc', 'ccccscccccwwcc', 'ccscscsccccccc', 'ccsssssccscscc', 'ccsksksccssscc', 'ccssssssssksgg', 'ggsskssssssggg', 'gggggggggggggg'],
    // the crater
    ['kkkkkkkkkkkkkk', 'kkkkkdkkkkkkkk', 'ddkkyoykkkkddk', 'dddkdodkkkdddd', 'ddddoddkkddddd', 'ddddodddddddod', 'eeedoeeeeeeoee', 'eeeoeeeeeoeeee', 'eeeeeeeeeeeeee'],
    // the last village
    ['llllllllllllll', 'lllllllllwllll', 'llwwllllllllll', 'lllllllwwwllll', 'llllllwsssswll', 'wwllllwsyyswww', 'wwwwwwwsssswww', 'wwwwlwwwwwwwww', 'wwwwwwwwlwwwww'],
    // Zeal
    ['bbbbbbbbbbbbbb', 'bbbbbwbbbbbbbb', 'bbmbbbbbmbbbbb', 'bbmbtbbbmbbmbb', 'bbmbtbbbmbbmbb', 'bbmttttbmbbmbb', 'mmmmmmmmmmmmmm', 'ttmttmttmttmtt', 'bbbbbbbbbbbbbb'],
    // the End of Time
    ['kkkkkkkkkkkkkk', 'kkwkkkkkkkkwkk', 'kkkkkkykkkkkkk', 'kkkkkyyykkkkkk', 'kwkkkksskkkkkk', 'kkkkkkskkkkwkk', 'kkksssssssskkk', 'kkkkssssssskkk', 'kkkkkkkkkkkkkk'],
  ];
  const PMAP = { b: R.blue[1], w: R.white[0], y: R.gold[3], r: R.red[3], s: R.slate[3], k: R.ink[1], g: R.green[2], c: R.blue[5], d: R.red[1], o: R.gold[1], e: R.stone[1], l: R.slate[2], m: R.slate[5], t: R.teal[2] };
  function wallTex(style, side, u, v, WH) {
    const lit = side === 1;
    const vb = WH - 1 - v; // px above the floor
    if (style === 'museum') {
      const T = lit ? [R.slate[4], R.slate[5], R.white[0]] : [R.slate[3], R.slate[4], R.slate[5]];
      if (v < 28 && bayer(u, v) > v / 28) return null; // dissolves into the light above
      if (vb < 2) return R.slate[2];
      if (vb < 9) return vb === 8 ? T[2] : vb === 7 ? T[0] : T[1] === R.slate[5] ? R.slate[4] : R.slate[3];
      const bay = Math.floor(u / 32), bu = mod(u, 32);
      if (bu < 5) return bu === 0 ? T[2] : bu === 4 ? R.slate[lit ? 3 : 2] : vb === 9 || vb === 10 || mod(vb, 16) === 0 ? T[0] : T[1]; // pilaster
      if (vb > 64 && vb < 68) return vb === 67 ? T[2] : T[0]; // cornice line
      const x = bu - 5, kind = mod(bay * 3 + side * 2, 5); // 27 px bay
      if (kind === 0 || kind === 3) {
        // tall cold window
        const wx = x - 6, wy = vb - 14;
        if (wx >= 0 && wx < 15 && wy >= 0 && wy < 46) {
          const arch = wy > 38 ? Math.abs(wx - 7) > 7 - (wy - 38) : false;
          if (!arch) {
            if (wx === 0 || wx === 14 || wy === 0 || wx === 7 || mod(wy, 12) === 0) return R.slate[3];
            return bayer(u, v) < 0.25 + wy / 80 ? R.white[0] : R.blue[6];
          }
        }
      } else if (kind === 1 || kind === 4) {
        // a framed still from the eras
        const fx = x - 4, fy = 47 - vb;
        if (fx >= 0 && fx < 18 && fy >= 0 && fy < 13) {
          if (fx === 0 || fx === 17 || fy === 0 || fy === 12) return (fx + fy) % 5 === 0 ? R.gold[3] : R.gold[1];
          if (fx === 1 || fx === 16 || fy === 1 || fy === 11) return R.wood[1];
          return PMAP[PAINTINGS[mod(bay + side * 3, 6)][fy - 2][fx - 2]];
        }
        if (fy === 13 && fx >= 1 && fx < 18) return T[0];
        // brass caption plate
        if (vb >= 28 && vb <= 29 && x >= 9 && x <= 16) return vb === 29 ? R.gold[2] : R.gold[0];
      } else {
        // the Hollow's banner: a red field, a white hollow ring
        const bx = x - 8, by = 58 - vb;
        if (by >= -2 && by < 0 && bx >= -2 && bx < 13) return R.gold[1];
        if (bx >= 0 && bx < 11 && by >= 0 && by < 34 - Math.abs(bx - 5)) {
          const dx = bx - 5, dy = by - 12, d = dx * dx + dy * dy;
          if (d <= 17 && d >= 6) return R.white[0];
          if (by > 26 - Math.abs(bx - 5) * 0 && by > 24 && mod(bx, 2) === 0) return R.red[1];
          return bx < 2 ? R.red[3] : bx > 8 ? R.red[1] : R.red[2];
        }
      }
      return mod(vb, 16) === 0 && vb < 64 ? T[0] : T[1];
    }
    if (style === 'archive') {
      if (v < 36 && bayer(u, v) > v / 36) return null;
      const T = lit ? [R.slate[3], R.slate[4], R.slate[5]] : [R.slate[2], R.slate[3], R.slate[4]];
      if (vb < 2) return R.slate[1];
      if (vb < 6) return T[0];
      const su = mod(u, 24), sv = mod(vb - 6, 11), shelf = Math.floor((vb - 6) / 11), col = Math.floor(u / 24);
      if (su < 2) return su === 0 ? T[2] : T[0]; // upright
      // a rolling ladder leans on some bays
      if (mod(col * 5 + side * 3, 7) === 0 && vb < 60) {
        if (su === 9 || su === 15) return R.wood[3];
        if (su > 9 && su < 15 && mod(vb, 5) === 0) return R.wood[2];
      }
      if (sv === 0) return T[2];
      if (sv === 10) return R.slate[lit ? 2 : 1];
      const slot = Math.floor((su - 2) / 2), hv = hash(col * 11 + slot, shelf * 7 + side, 601);
      const hgt = 5 + Math.floor(hash(col * 11 + slot, shelf, 602) * 4);
      if (hv < 0.12 || sv > hgt || (mod(su, 2) === 1 && hv > 0.6)) return R.slate[lit ? 1 : 0];
      const c = hv > 0.95 ? R.red[2] : hv > 0.86 ? R.blue[4] : hv > 0.8 ? R.stone[3] : hv > 0.45 ? R.slate[5] : R.slate[4];
      return sv === hgt && c === R.slate[5] ? R.white[0] : !lit && c === R.slate[5] ? R.slate[4] : c;
    }
    if (style === 'castle') {
      const T = lit ? [R.slate[0], R.slate[1], R.slate[2]] : [R.ink[2], R.slate[0], R.slate[1]];
      if (v < 30 && bayer(u, v) > v / 30) return null; // lost in the dark above
      if (vb < 2) return R.ink[1];
      const bay = Math.floor(u / 48), bu = mod(u, 48);
      // stained glass lancet
      const wx = bu - 17, wy = vb - 16;
      if (wx >= 0 && wx < 14 && wy >= 0 && wy < 40) {
        const inArch = wy <= 30 || Math.abs(wx - 6.5) <= 6.5 - (wy - 30) * 0.7;
        if (inArch) {
          const edge = wx === 0 || wx === 13 || wy === 0 || (wy > 30 && Math.abs(wx - 6.5) > 5.5 - (wy - 30) * 0.7);
          if (edge) return R.ink[1];
          if (wx === 6 || wx === 7 || mod(wy, 9) === 0) return R.ink[2];
          const pane = Math.floor(wy / 9) + (wx > 6 ? 3 : 0) + bay;
          const set = [[R.blue[3], R.blue[4]], [R.red[2], R.red[3]], [R.gold[1], R.gold[2]], [R.purple[2], R.purple[3]], [R.teal[1], R.teal[2]]][mod(pane * 3 + side, 5)];
          // a small crest in the middle panes
          const cy = wy - 18, cx = wx - 6.5;
          if (Math.abs(cx) + Math.abs(cy) < 4) return Math.abs(cx) + Math.abs(cy) < 2 ? R.gold[4] : R.gold[2];
          return (wx + wy) % 3 === 0 ? set[1] : set[0];
        }
      }
      if (wx >= -2 && wx < 16 && wy >= -3 && wy < 0) return wy === -1 ? T[2] : T[0]; // sill
      // banner between the windows
      const bx = bu - 39, by = 56 - vb;
      if (by >= -2 && by < 0 && bx >= -2 && bx < 12) return R.gold[0];
      if (bx >= 0 && bx < 10 && by >= 0 && by < 30 - Math.abs(bx - 4.5) * 1.2) {
        const blue = mod(bay + side, 2) === 0;
        const f = blue ? R.blue : R.red;
        if (bx === 0 || bx === 9) return R.gold[1];
        const dx = Math.abs(bx - 4.5), dy = by - 12;
        if ((dx < 1 && dy > -5 && dy < 6) || (dy > -1 && dy < 1 && dx < 3.6) || (dx < 2 && dy === -4)) return R.gold[3];
        return bx > 6 ? f[1] : f[2];
      }
      // dressed stone courses
      const row = Math.floor(vb / 6), cu = mod(u + (row & 1) * 7, 14);
      if (mod(vb, 6) === 0 || cu === 0) return R.ink[lit ? 2 : 1];
      const id = hash(Math.floor((u + (row & 1) * 7) / 14) + side * 31, row, 611);
      if (vb < 12) return id > 0.5 ? T[1] : T[0];
      return mod(vb, 6) === 5 ? T[2] : id > 0.78 ? T[2] : id < 0.25 ? T[0] : T[1];
    }
    return null;
  }

  const wallCache = new Map();
  function wallLayers(r, look) {
    const m = r.map;
    const key = m.id + ':' + r.rot + ':' + m.w + 'x' + m.h;
    if (wallCache.has(key)) return wallCache.get(key);
    const wl = look.walls;
    const vw = r.rot & 1 ? m.h : m.w, vh = r.rot & 1 ? m.w : m.h;
    const out = [];
    for (let side = 0; side < 2; side++) {
      const n = side ? vw : vh;
      const b = new Buf(n * 16, wl.h + n * 8 + 2);
      for (let u = 0; u < n * 16; u++)
        for (let v = 0; v < wl.h + 2; v++) {
          const c = wallTex(wl.style, side, u, Math.min(v, wl.h - 1), wl.h);
          if (c) b.set(side ? u : n * 16 - 1 - u, v + (u >> 1), P(c));
        }
      out.push({ cv: b.done(), n });
    }
    // base height: the lowest tile along each far edge, so no gap opens under the wall
    const inv = (vx, vy) => {
      switch (r.rot) {
        case 1: return [vy, m.h - 1 - vx];
        case 2: return [m.w - 1 - vx, m.h - 1 - vy];
        case 3: return [m.w - 1 - vy, vx];
        default: return [vx, vy];
      }
    };
    let base = 99;
    for (let i = 0; i < vw; i++) { const [x, y] = inv(i, 0); const t = m.tiles[y][x]; if (!CT.TERRAIN[t.t].void) base = Math.min(base, r.tileHeight(t)); }
    for (let i = 0; i < vh; i++) { const [x, y] = inv(0, i); const t = m.tiles[y][x]; if (!CT.TERRAIN[t.t].void) base = Math.min(base, r.tileHeight(t)); }
    const res = { layers: out, base: base === 99 ? 0 : base, corner: inv(0, 0) };
    if (wallCache.size > 24) wallCache.clear();
    wallCache.set(key, res);
    return res;
  }
  function wallsOn(r) {
    const look = r.look;
    if (!look || !look.walls || !r.map) return null;
    if (look.walls.theme && !look.walls.theme.includes(r.map.theme)) return null;
    return look;
  }
  function drawWalls(r, ctx) {
    const look = wallsOn(r);
    if (!look) return;
    const wl = wallLayers(r, look);
    const [cx, cy] = wl.corner;
    const [sx0, sy0] = r.project(cx, cy, wl.base);
    const sx = Math.round(sx0), sy = Math.round(sy0) - 8;
    ctx.drawImage(wl.layers[1].cv, sx, sy - look.walls.h);
    ctx.drawImage(wl.layers[0].cv, sx - wl.layers[0].n * 16, sy - look.walls.h);
  }
  // Reflection of the far walls in a glossy floor: colour to blend at a tile-top pixel,
  // given its position in view space (tile units). Returns [hex, alpha] or null.
  function wallReflection(r, fvx, fvy) {
    const look = wallsOn(r);
    if (!look) return null;
    const WH = look.walls.h;
    const dR = fvy + 0.5, dL = fvx + 0.5;
    const side = dR < dL ? 1 : 0;
    const d = side ? dR : dL;
    if (d > 2.6) return null;
    const u = Math.floor(((side ? fvx : fvy) + 0.5) * 16), v = WH - 1 - Math.floor(d * 16);
    if (v < 0) return null;
    const c = wallTex(look.walls.style, side, u, v, WH);
    return c ? [c, 0.42 * (1 - d / 2.6)] : null;
  }

  // ---- Light pools --------------------------------------------------------------------
  // Stepped pools with ordered-dither edges; the renderer masks them to the world.
  const lightSprites = new Map();
  function lightSprite(color, rad) {
    const key = color + '|' + rad;
    let s = lightSprites.get(key);
    if (s) return s;
    const rx = rad, ry = Math.max(2, Math.round(rad * 0.62));
    s = CT.PX.canvas(rx * 2 + 1, ry * 2 + 1, (g) => {
      const [cr, cg, cb] = color.split(',').map(Number);
      const img = g.createImageData(rx * 2 + 1, ry * 2 + 1);
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) {
          const d = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry));
          if (d >= 1) continue;
          const f = Math.pow(1 - d, 1.15) * 5; // 0..5 levels
          const lv = Math.floor(f) + (f - Math.floor(f) > bayer(x + 512, y + 512) ? 1 : 0);
          if (!lv) continue;
          const i = ((y + ry) * (rx * 2 + 1) + (x + rx)) * 4;
          img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb;
          img.data[i + 3] = Math.min(255, lv * 24);
        }
      g.putImageData(img, 0, 0);
    });
    if (lightSprites.size > 120) lightSprites.clear();
    lightSprites.set(key, s);
    return s;
  }
  function drawLights(r, g, lights, now) {
    g.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const fl = l.flicker ? 0.84 + 0.16 * Math.sin(now / 90 + l.x * 7) * Math.sin(now / 53 + l.y) : 1;
      const rad = Math.max(4, Math.round(l.radius) - (l.flicker && Math.floor(now / 130 + l.x) % 3 === 0 ? 1 : 0));
      const s = lightSprite(l.color, rad);
      g.globalAlpha = fl;
      g.drawImage(s, Math.round(l.x) - rad, Math.round(l.y) - ((s.height - 1) >> 1));
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  // The small unmasked glow around each source, so lamps and fires bloom against the sky.
  function drawGlows(r, ctx, lights, now) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (l.noGlow) continue;
      const rad = Math.max(4, Math.round(l.radius * 0.3));
      const s = lightSprite(l.color, rad);
      ctx.globalAlpha = l.flicker ? 0.8 + 0.2 * Math.sin(now / 70 + l.x * 3) : 0.9;
      ctx.drawImage(s, Math.round(l.x) - rad, Math.round(l.y) - ((s.height - 1) >> 1));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- Shadows ------------------------------------------------------------------------
  // Soft-edged (ordered dither) ground shadow, cached per size.
  const shadowSprites = new Map();
  function shadowSprite(rx, ry) {
    const key = rx + 'x' + ry;
    let s = shadowSprites.get(key);
    if (s) return s;
    s = CT.PX.canvas(rx * 2 + 3, ry * 2 + 3, (g) => {
      g.fillStyle = '#0a0612';
      for (let y = -ry - 1; y <= ry + 1; y++)
        for (let x = -rx - 1; x <= rx + 1; x++) {
          const d = Math.sqrt((x * x) / ((rx + 0.5) * (rx + 0.5)) + (y * y) / ((ry + 0.5) * (ry + 0.5)));
          if (d < 0.72 || (d < 1.08 && bayer(x + 64, y + 64) < (1.08 - d) / 0.36)) g.fillRect(x + rx + 1, y + ry + 1, 1, 1);
        }
    });
    shadowSprites.set(key, s);
    return s;
  }
  function drawShadow(ctx, x, y, rx, ry, a = 0.34) {
    const s = shadowSprite(Math.max(1, rx | 0), Math.max(1, ry | 0));
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * a;
    ctx.drawImage(s, Math.round(x) - ((s.width - 1) >> 1), Math.round(y) - ((s.height - 1) >> 1));
    ctx.globalAlpha = ga;
  }

  // ---- Weather and near life ----------------------------------------------------------
  const BFLY = [['x.x', 'xxx', 'x.x'], ['.x.', '.x.', '.x.']];
  function drawWeather(r, now) {
    const ctx = r.ctx;
    const th = r.theme;
    const kind = th.particles;
    const M = r.motes;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (kind === 'snow') {
      for (const m of M) {
        const x = mod(m.x + Math.sin(now / 1600 + m.p) * 12 + now * 0.005 * m.s, W);
        const y = mod(m.y + now * 0.015 * (0.5 + m.s), H);
        const s = m.s > 0.72 ? 2 : 1;
        ctx.fillStyle = m.s > 0.4 ? '#ffffff' : R.slate[4];
        ctx.fillRect(Math.round(x), Math.round(y), s, s);
      }
    } else if (kind === 'embers') {
      for (const m of M) {
        const x = mod(m.x + Math.sin(now / 900 + m.p) * 10, W);
        const y = H - mod(m.y + now * 0.015 * (0.4 + m.s), H);
        const k = 0.5 + 0.5 * Math.sin(now / 200 + m.p);
        ctx.fillStyle = k > 0.66 ? R.gold[3] : k > 0.33 ? R.gold[1] : R.red[2];
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        if (m.s > 0.8 && k > 0.5) { ctx.fillStyle = R.red[2]; ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, 1); }
      }
    } else if (kind === 'fireflies' || kind === 'motes' || kind === 'sparkle') {
      const ramp = kind === 'fireflies' ? [R.gold[4], R.gold[3], R.green[5]] : kind === 'sparkle' ? ['#ffffff', R.blue[6], R.blue[5]] : [R.skin[5], R.stone[4], R.stone[2]];
      const n = kind === 'fireflies' ? 26 : 40;
      for (let i = 0; i < n; i++) {
        const m = M[i];
        const x = Math.round(mod(m.x + Math.sin(now / 2100 + m.p) * 15 + now * 0.002 * m.s, W));
        const y = Math.round(mod(m.y * 0.8 + 30 + Math.sin(now / 1300 + m.p * 2) * 8, H));
        const a = 0.5 + 0.5 * Math.sin(now / 400 + m.p * 3);
        if (a < 0.2) continue;
        ctx.fillStyle = ramp[a > 0.75 ? 0 : a > 0.45 ? 1 : 2];
        ctx.fillRect(x, y, 1, 1);
        if (a > 0.85 && kind !== 'motes') {
          ctx.fillStyle = ramp[2];
          ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
        }
      }
    } else if (kind === 'dust') {
      for (let i = 0; i < 30; i++) {
        const m = M[i];
        if (m.s < 0.5) continue;
        const x = mod(m.x + now * 0.003 * m.s, W);
        const y = mod(m.y + Math.sin(now / 1500 + m.p) * 5, H);
        ctx.fillStyle = th.interior && r.map.theme === 'museum' ? R.slate[3] : R.stone[4];
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    } else if (kind === 'wind') {
      ctx.fillStyle = R.slate[5];
      for (let i = 0; i < 14; i++) {
        const m = M[i];
        const x = mod(m.x + now * 0.12 * (0.5 + m.s), W + 100) - 50;
        const y = m.y * 0.7 + Math.sin(now / 700 + m.p) * 4;
        const len = 10 + Math.floor(m.s * 16);
        for (let k = 0; k < len; k += 2) ctx.fillRect(Math.round(x) + k, Math.round(y + Math.sin((x + k) / 20)), 1, 1);
      }
    }
    // Small life near the ground.
    const life = th.life;
    if (life === 'butterflies' || life === 'leaves') {
      for (let i = 0; i < (life === 'leaves' ? 9 : 4); i++) {
        const m = M[i + 40];
        if (life === 'leaves') {
          const y = mod(m.y + now * 0.012 * (0.6 + m.s), H + 20) - 10;
          const x = mod(m.x + Math.sin(now / 700 + m.p) * 14 + now * 0.006, W);
          const f = Math.floor(now / 160 + m.p * 3) % 4;
          ctx.fillStyle = [R.gold[1], R.gold[2], R.red[3], R.green[4]][i % 4];
          ctx.fillRect(Math.round(x), Math.round(y), f < 2 ? 2 : 1, f % 2 ? 1 : 2);
        } else {
          const x = Math.round(80 + m.x * 0.66 + Math.sin(now / 1500 + m.p) * 26 + Math.sin(now / 300 + m.p * 2) * 3);
          const y = Math.round(120 + m.y * 0.5 + Math.sin(now / 1100 + m.p * 3) * 14 + Math.sin(now / 240 + m.p) * 2);
          sprite(ctx, BFLY[Math.floor(now / 130 + i) % 2], x, y, [R.gold[3], R.white[0], R.pink[3], R.blue[5]][i % 4]);
        }
      }
    }
    if (th.fog) {
      // slow bands of mist: long thin lenses, stippled
      ctx.fillStyle = th.fog[0];
      for (let k = 0; k < 7; k++) {
        const len = 70 + hash(k, 1, 73) * 90;
        const x0 = mod(hash(k, 2, 73) * (W + 200) + now * (0.003 + hash(k, 3, 73) * 0.004), W + 200) - 100;
        const y0 = th.fog[1] + Math.round(hash(k, 4, 73) * 52);
        for (let x = 0; x < len; x++) {
          const u = x / len, hgt = Math.round(Math.sin(u * Math.PI) * (3 + hash(k, 5, 73) * 4));
          for (let j = -hgt; j <= hgt; j++) if (((Math.round(x0) + x + j) & 1) === 0 || Math.abs(j) < hgt - 2) ctx.fillRect(Math.round(x0) + x, y0 + j, 1, 1);
        }
      }
    }
    if (th.scan) {
      ctx.fillStyle = `rgba(0,0,0,${th.scan})`;
      const off = Math.floor(now / 60) % 3;
      for (let y = off; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();
  }

  // Stippled corner vignette (interiors and night only).
  const vigCache = new Map();
  function vignette(amount) {
    const key = String(amount);
    if (vigCache.has(key)) return vigCache.get(key);
    const cv = CT.PX.canvas(W, H, (g) => {
      g.fillStyle = '#0a0612';
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
          const d = Math.sqrt(dx * dx * 0.8 + dy * dy);
          const k = (d - 0.92) * 2.2 * amount * 2.5;
          if (k > 0 && bayer(x, y) < k) g.fillRect(x, y, 1, 1);
        }
    });
    vigCache.set(key, cv);
    return cv;
  }

  CT.ATMOS = { background, drawBackground, drawWalls, wallTex, wallReflection, drawLights, drawGlows, drawShadow, drawWeather, vignette, Buf, P, bayer, SK };
})();
