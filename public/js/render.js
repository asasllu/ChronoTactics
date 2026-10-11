// Isometric renderer, shared by field exploration and battles.
//
// A "world" is anything with { map, units, active? } where map comes from
// CT.prepareMap (tiles, decor, zones, theme). Each tile column is rasterised
// once per camera rotation, pixel by pixel from the terrain material
// (CT.TERRAIN), then tiles, decor and units are drawn back-to-front.
(function () {
  const CT = (window.CT = window.CT || {});
  const { hash, vnoise } = CT.TX;

  const TW = 32; // tile diamond width (logical px)
  const TH = 16; // tile diamond height
  const HS = 8; // pixels per height level
  const BASE = 0.6; // extra column depth below height 0
  const WATER_FRAMES = 8;

  // ---- Themes: sky, weather and colour grading per location ------------------------
  // sky: gradient stops; mountains: far→near colours; particles: weather kind;
  // tint: multiplied over the world; dark: 0..1 darkness that lights cut through.
  const THEMES = {
    dusk: {
      sky: [[0, '#141a3c'], [0.35, '#3c3c78'], [0.6, '#b0607c'], [0.75, '#f0a070'], [1, '#f8d090']],
      stars: 90, sun: [760, 330, '255,220,160'], mountains: ['#5c4c80', '#3c3464', '#28244c'], forest: '#18203a',
      clouds: ['#e8a0a8', '#fcd0c0'], particles: 'fireflies',
    },
    night: {
      sky: [[0, '#05071a'], [0.5, '#101a40'], [1, '#243060']], stars: 180, moon: [180, 90],
      mountains: ['#1c2448', '#151c3c', '#0e1430'], forest: '#080c1c', particles: 'fireflies',
      // Kept light: units must stay readable at night (lamps and the fair still glow).
      tint: '#c4ccf0', dark: 0.1, vignette: 0.25,
    },
    dawn: {
      sky: [[0, '#2c3470'], [0.4, '#8c6ca8'], [0.65, '#f4a0a0'], [0.85, '#fcd49c'], [1, '#fff0c0']],
      stars: 30, sun: [480, 420, '255,230,170'], mountains: ['#8c78b0', '#6c5c94', '#4c4478'], forest: '#302c58',
      clouds: ['#f8b8b8', '#fff0e0'], particles: 'motes', tint: '#fff0e8',
    },
    day: {
      sky: [[0, '#3c78d8'], [0.6, '#88c0f0'], [1, '#d8f0ff']], sun: [820, 80, '255,250,220'],
      mountains: ['#8cacd8', '#6c90c0', '#4c74a8'], forest: '#2c5c48', clouds: ['#c8dcf0', '#ffffff'],
    },
    mountain: {
      sky: [[0, '#4c80d0'], [0.55, '#a8d0f0'], [1, '#e8f4ff']], sun: [820, 90, '255,250,220'],
      mountains: ['#c8d8f0', '#98acd0', '#6c80a8'], peaks: true, forest: '#2c4c3c', clouds: ['#d8e4f4', '#ffffff'],
      particles: 'wind',
    },
    castle: {
      sky: [[0, '#0c0810'], [0.6, '#1c1418'], [1, '#2c1c18']], particles: 'dust', tint: '#f0c8a0', dark: 0.3,
      interior: true,
    },
    prehistoric: {
      sky: [[0, '#3c5c48'], [0.5, '#a8a860'], [0.8, '#f0c070'], [1, '#f8e0a0']], sun: [700, 300, '255,210,140'],
      mountains: ['#6c7c58', '#4c5c40', '#34442c'], volcano: true, forest: '#1c3020', clouds: ['#d0c8a0', '#f0e8c0'],
      particles: 'motes',
    },
    volcanic: {
      sky: [[0, '#1c0808'], [0.5, '#5c1810'], [0.8, '#c84018'], [1, '#f88030']], mountains: ['#3c1810', '#2c100c', '#1c0806'],
      volcano: true, particles: 'embers', tint: '#ffc0a0', dark: 0.15,
    },
    snow: {
      sky: [[0, '#5c6c8c'], [0.5, '#98a8c0'], [1, '#d8e0ec']], mountains: ['#c8d0e0', '#a8b4cc', '#8494b0'], peaks: true,
      forest: '#3c4c5c', clouds: ['#b8c0d0', '#e8ecf4'], particles: 'snow', tint: '#e0e8ff',
    },
    zeal: {
      sky: [[0, '#1c2c44'], [0.5, '#3c5c78'], [0.8, '#789cb0'], [1, '#b0c8d4']], mountains: ['#4c6480', '#34485c', '#243444'],
      sea: '#1c3c5c', clouds: ['#6c8098', '#a0b4c4'], particles: 'sparkle', tint: '#c8e0ff',
    },
    void: {
      sky: [[0, '#000000'], [0.6, '#06060e'], [1, '#0c0c1c']], stars: 60, particles: 'motes', interior: true, dark: 0.35,
    },
    museum: {
      sky: [[0, '#b8bcc8'], [0.5, '#d8dce4'], [1, '#f0f0f4']], particles: 'dust', interior: true, tint: '#f4f6ff', scan: 0.04,
    },
    core: {
      sky: [[0, '#0c0204'], [0.5, '#3c0810'], [1, '#8c1018']], stars: 0, particles: 'embers', interior: true, scan: 0.08,
      tint: '#ffd0d0',
    },
  };
  CT.THEMES = THEMES;

  const PXD = CT.PXD;
  // Palette ramps for effects, light -> dark. Particles walk down their ramp as they age.
  const RAMPS = {
    fire: ['#fff4b0', '#fce068', '#f8bc3c', '#e88c28', '#c05c1c', '#6c1422'],
    ice: ['#ffffff', '#c4e4ff', '#8cc0f0', '#5c90dc', '#3c64b4', '#1c2c5c'],
    lightning: ['#ffffff', '#fff4b0', '#fce068', '#f8bc3c', '#e88c28', '#c05c1c'],
    shadow: ['#e0c0fc', '#bc84e4', '#9450c0', '#6c3094', '#4a1c6c', '#2a1040'],
    dark: ['#e0c0fc', '#bc84e4', '#9450c0', '#6c3094', '#4a1c6c', '#2a1040'],
    water: ['#ffffff', '#c4e4ff', '#8cc0f0', '#5c90dc', '#3c64b4', '#1c2c5c'],
    laser: ['#ffffff', '#f8b0c8', '#e0709c', '#7cd4b8', '#48a894', '#2a7470'],
    heal: ['#ffffff', '#d4ec94', '#a8d45c', '#74b43c', '#488c34', '#2c6430'],
    slash: ['#ffffff', '#e4e8f0', '#bcc0d4', '#9294b0', '#6e7090', '#3a3a52'],
    hit: ['#ffffff', '#fff0dc', '#fce068', '#f8bc3c', '#e88c28', '#6c1422'],
    porcelain: ['#ffffff', '#e4e8f0', '#bcc0d4', '#9294b0', '#6e7090', '#3a3a52'],
    glass: ['#ffffff', '#c4e4ff', '#e4e8f0', '#8cc0f0', '#9294b0', '#52526e'],
    lavos: ['#fff4b0', '#f06c4c', '#d43c3c', '#a02030', '#6c1422', '#3c0a14'],
    charm: ['#ffffff', '#f8b0c8', '#e0709c', '#a83c74', '#6c2048', '#2a1040'],
    shot: ['#ffffff', '#fff4b0', '#fce068', '#f8bc3c', '#e88c28', '#c05c1c'],
    seed: ['#fff4b0', '#f06c4c', '#d43c3c', '#a02030', '#6c1422', '#3c0a14'],
  };
  CT.FX_RAMPS = RAMPS;
  const rampOf = (k) => RAMPS[k] || RAMPS.hit;
  const rampAt = (r, k) => r[Math.max(0, Math.min(r.length - 1, Math.floor(k * r.length)))];

  // ---- Spectacle helpers (charge circles, impact bits, sky bolts, full-screen moments) ----
  // All drawn as hard palette pixels on a 33 ms step clock, like SNES sprite/colour-math work.
  const TAU = Math.PI * 2;
  const STEP = 33;
  const hashI = (a, b, c = 0) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // Hand-drawn 3x5 runes that stand on the casting circle.
  const RUNES = [
    ['xxx', 'x..', 'xx.', 'x..', 'x..'],
    ['.x.', 'x.x', '.x.', 'x.x', '.x.'],
    ['x.x', 'x.x', '.x.', '.x.', '.x.'],
    ['xxx', '..x', '.x.', 'x..', 'xxx'],
    ['x..', 'xx.', 'x.x', 'xx.', 'x..'],
    ['.x.', '.x.', 'xxx', '.x.', '.x.'],
    ['x.x', '.x.', 'x.x', '.x.', 'x.x'],
    ['xx.', 'x.x', 'xx.', 'x..', 'xxx'],
  ];
  function glyph(ctx, g, x, y, col, shade) {
    for (let j = 0; j < g.length; j++)
      for (let i = 0; i < 3; i++)
        if (g[j][i] === 'x') {
          if (shade) { ctx.fillStyle = shade; ctx.fillRect(x + i, y + j + 1, 1, 1); }
          ctx.fillStyle = col;
          ctx.fillRect(x + i, y + j, 1, 1);
        }
  }
  // Half of a 1px ellipse ring: half < 0 the back (upper) arc, > 0 the front arc, 0 both.
  function ringArc(ctx, cx, cy, rx, ry, half) {
    cx = Math.round(cx); cy = Math.round(cy);
    const hw = (y) => {
      if (y < -ry || y > ry) return -1;
      const t = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      return t > 0 ? Math.round(rx * Math.sqrt(t)) : -1;
    };
    for (let y = -ry; y <= ry; y++) {
      if ((half < 0 && y > 0) || (half > 0 && y <= 0)) continue;
      const w = hw(y);
      if (w < 0) continue;
      const inner = Math.min(hw(y - 1), hw(y + 1));
      const from = Math.min(w, inner + 1);
      ctx.fillRect(cx - w, cy + y, w - from + 1, 1);
      ctx.fillRect(cx + from, cy + y, w - from + 1, 1);
    }
  }
  // Dashed ellipse: n marks, `on` of every `per` lit, rotating with `ph`.
  function dashRing(ctx, cx, cy, rx, ry, n, ph, half, on, per) {
    for (let i = 0; i < n; i++) {
      if ((i + ph) % per >= on) continue;
      const a = (i / n) * TAU;
      const s = Math.sin(a);
      if ((half < 0 && s > 0) || (half > 0 && s <= 0)) continue;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + s * ry), 1, 1);
    }
  }
  // 4-point star of arm length s (0 = single pixel).
  function star(ctx, x, y, s, core, arm) {
    ctx.fillStyle = arm;
    if (s > 0) {
      ctx.fillRect(x - s, y, s * 2 + 1, 1);
      ctx.fillRect(x, y - s, 1, s * 2 + 1);
    }
    ctx.fillStyle = core;
    ctx.fillRect(x, y, 1, 1);
    if (s > 1) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
  // Jagged polyline from a hashed seed: [[x, y]...] from (x0, y0) to (x1, y1).
  function zig(seed, ph, x0, y0, x1, y1, seg, amp) {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / seg));
    const pts = [[x0, y0]];
    for (let i = 1; i < n; i++) {
      const k = i / n;
      pts.push([x0 + (x1 - x0) * k + (hashI(seed, ph, i) - 0.5) * amp * 2, y0 + (y1 - y0) * k + (hashI(seed, ph, i + 50) - 0.5) * amp * 0.6]);
    }
    pts.push([x1, y1]);
    return pts;
  }
  function poly(ctx, pts, w, upto = 1) {
    const n = Math.max(1, Math.ceil((pts.length - 1) * upto));
    for (let i = 1; i <= n && i < pts.length; i++) PXD.line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w);
  }
  // Which bits an element leaves behind when it lands.
  const ELEM_BITS = {
    lightning: 'spark', fire: 'ember', ice: 'shard', water: 'drop', shadow: 'mote', dark: 'mote', heal: 'sparkle',
    charm: 'sparkle', holy: 'sparkle', glass: 'shard', porcelain: 'shard', lavos: 'ember', hit: 'spark', slash: 'spark', laser: 'spark', psy: 'mote',
  };
  // Full-screen moments: field dim [colour, amount, extra ms], letterbox, shake, flash.
  // shake/flash: [amount|colour, ms, at (fraction of the moment)].
  const BIG = {
    luminaire: { dim: ['#4a2a16', 0.55, 900], lb: 1, flash: ['255,250,220', 160, 0.33], shake: [6, 420, 0.36] },
    blackhole: { dim: ['#0a0612', 0.72, 600], lb: 1 },
    singularity: { dim: ['#0a0612', 0.6, 300], shake: [5, 500, 0.15], flash: ['255,255,255', 120, 0.9] },
    darkmatter: { dim: ['#2a1040', 0.8, 600], lb: 1, shake: [4, 900, 0.1] },
    dm_burst: { dim: ['#0a0612', 0.6, 300], shake: [10, 700, 0.5], flash: ['240,220,255', 180, 0.5] },
    eclipse: { dim: ['#0a0612', 0.72, 900], lb: 1, flash: ['255,255,255', 160, 0.48], shake: [6, 500, 0.5] },
    erase: { dim: ['#3a3a52', 0.45, 300], lb: 1, flash: ['255,255,255', 260, 0.55], shake: [8, 600, 0.55] },
    corerain: { dim: ['#3c0a14', 0.62, 500], lb: 1, shake: [5, 1200, 0.2] },
    xslash: { flash: ['216,240,255', 120, 0.3], shake: [7, 380, 0.3] },
    storm: { dim: ['#10183a', 0.55, 500] },
    frost: { dim: ['#1c2c5c', 0.45, 400] },
    bloom: { dim: ['#2c6430', 0.25, 300] },
    gale: { dim: ['#2a1040', 0.5, 300] },
    shock: { dim: ['#2a1040', 0.4, 200] },
    inferno: { dim: ['#3c0a14', 0.45, 300] },
    psy: { dim: ['#4a1c6c', 0.45, 300] },
    prism: { dim: ['#10183a', 0.5, 300] },
    laser: { dim: ['#10183a', 0.45, 300] },
  };
  CT.BIG_FX = BIG;

  // Legacy (960-scale) art is halved until it is redrawn natively: each 2x2 block
  // takes its most common opaque colour (darkest on ties), then snaps to the palette.
  function halve(src) {
    const w = Math.ceil(src.width / 2), h = Math.ceil(src.height / 2);
    const s = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, src.width, src.height).data;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const img = g.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const cand = [];
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) {
            const X = x * 2 + i, Y = y * 2 + j;
            if (X >= src.width || Y >= src.height) continue;
            const k = (Y * src.width + X) * 4;
            if (s[k + 3] > 100) cand.push([s[k], s[k + 1], s[k + 2]]);
          }
        if (cand.length < 2) continue;
        let best = cand[0], bn = 0;
        for (const c of cand) {
          const n = cand.filter((o) => o[0] === c[0] && o[1] === c[1] && o[2] === c[2]).length;
          if (n > bn || (n === bn && c[0] + c[1] + c[2] < best[0] + best[1] + best[2])) { best = c; bn = n; }
        }
        const k = (y * w + x) * 4;
        d[k] = best[0]; d[k + 1] = best[1]; d[k + 2] = best[2]; d[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    return CT.PAL.snapCanvas(cv);
  }
  CT.PX.halve = halve;

  class Renderer {
    constructor(canvas) {
      // `canvas` is the on-screen 480x300 canvas; the frame is composed on a CPU
      // back buffer, then quantised to the master palette into the screen canvas.
      this.screen = canvas;
      this.sctx = canvas.getContext('2d', { alpha: false });
      this.W = canvas.width;
      this.H = canvas.height;
      this.cv = document.createElement('canvas');
      this.cv.width = this.W;
      this.cv.height = this.H;
      this.ctx = this.cv.getContext('2d', { willReadFrequently: true, alpha: false });
      this.ctx.imageSmoothingEnabled = false;
      this.outImg = this.sctx.createImageData(this.W, this.H);
      this.out32 = new Uint32Array(this.outImg.data.buffer);
      this.dither = 6;
      this._rot = 0;
      this.ox = this.W / 2;
      this.oy = 75;
      this.cam = null; // camera centre in base (origin-free) screen coords
      this.camTarget = null;
      this.world = null;
      this.floaters = [];
      this.parts = [];
      this.rings = [];
      this.sheetFx = []; // hand-pixelled effect sheets in flight (playFx)
      this.orbits = [];
      this.bolts = [];
      this.shots = [];
      this.rifts = [];
      this.rains = [];
      this.big = [];
      this.shakeT = 0;
      this.shakeAmt = 0;
      this.fade = 0; // 0..1 black overlay, driven by scenes
      this.fadeColor = '0,0,0';
      this.screenFlashT = 0;
      this.cache = new Map();
      this.bgCache = new Map();
      this.decorHalf = new Map();
      this.motes = Array.from({ length: 60 }, (_, i) => ({ x: hash(i, 1) * this.W, y: hash(i, 2) * this.H, p: hash(i, 3) * 6.28, s: 0.3 + hash(i, 4) * 0.7 }));
    }

    get rot() {
      return this._rot;
    }
    set rot(v) {
      this._rot = ((v % 4) + 4) % 4;
      this.cache.clear();
      if (this.camTarget) this.cam = null;
    }

    setWorld(world) {
      if (this.world && world && this.world.map !== world.map) {
        this.cache.clear();
        this.cam = null;
        this.rifts = [];
      }
      this.world = world;
    }

    get map() {
      return this.world && this.world.map;
    }
    get theme() {
      return THEMES[(this.map && this.map.theme) || 'dusk'] || THEMES.dusk;
    }

    // ---- Projection ------------------------------------------------------------------
    view(x, y) {
      const m = this.map;
      const w = m ? m.w : 12;
      const h = m ? m.h : 12;
      switch (this._rot) {
        case 1: return [h - 1 - y, x];
        case 2: return [w - 1 - x, h - 1 - y];
        case 3: return [y, w - 1 - x];
        default: return [x, y];
      }
    }
    vecToView(x, y) {
      switch (this._rot) {
        case 1: return [-y, x];
        case 2: return [-x, -y];
        case 3: return [y, -x];
        default: return [x, y];
      }
    }
    vecToWorld(a, b) {
      switch (this._rot) {
        case 1: return [b, -a];
        case 2: return [-a, -b];
        case 3: return [-b, a];
        default: return [a, b];
      }
    }
    base(x, y, h) {
      const [vx, vy] = this.view(x, y);
      return [((vx - vy) * TW) / 2, ((vx + vy) * TH) / 2 - h * HS];
    }
    project(x, y, h) {
      const [bx, by] = this.base(x, y, h);
      return [this.ox + bx, this.oy + by];
    }
    depth(x, y) {
      const [vx, vy] = this.view(x, y);
      return vx + vy;
    }
    screenDir(face) {
      const [fx, fy] = CT.DIRS[face];
      const [vx, vy] = this.vecToView(fx, fy);
      return (vx + vy > 0 ? 'south-' : 'north-') + (vx - vy > 0 ? 'east' : 'west');
    }
    // World facing that points toward a screen quadrant (for facing arrows).
    faceForScreen(sx, sy) {
      for (let f = 0; f < 4; f++) {
        const [fx, fy] = CT.DIRS[f];
        const [vx, vy] = this.vecToView(fx, fy);
        if (Math.sign(vx - vy) === Math.sign(sx) && Math.sign(vx + vy) === Math.sign(sy)) return f;
      }
      return 0;
    }
    tileHeight(t) {
      const m = CT.TERRAIN[t.t];
      return t.h - ((m && m.depthOffset) || 0);
    }

    // ---- Camera ------------------------------------------------------------------------
    focus(x, y, h = 0, instant = false) {
      this.camTarget = this.base(x, y, h + 1);
      if (instant || !this.cam) this.cam = [...this.camTarget];
    }
    focusMap(instant = true) {
      const m = this.map;
      if (!m) return;
      let avg = 0;
      for (const row of m.tiles) for (const t of row) avg += t.h;
      avg /= m.w * m.h;
      this.focus((m.w - 1) / 2, (m.h - 1) / 2, avg - 0.5, instant);
    }
    updateCamera() {
      if (!this.camTarget) this.focusMap(true);
      if (!this.cam) this.cam = [...this.camTarget];
      this.cam[0] += (this.camTarget[0] - this.cam[0]) * 0.12;
      this.cam[1] += (this.camTarget[1] - this.cam[1]) * 0.12;
      const bias = this.dialogueBias || 0;
      this.biasNow = (this.biasNow || 0) + (bias - (this.biasNow || 0)) * 0.1;
      this.ox = Math.round(this.W / 2 - this.cam[0]);
      this.oy = Math.round(this.H * 0.46 - this.cam[1] + this.biasNow);
    }

    // ---- Picking ---------------------------------------------------------------------
    pick(mx, my) {
      const m = this.map;
      if (!m) return null;
      const order = this.tileOrder();
      for (let i = order.length - 1; i >= 0; i--) {
        const t = order[i];
        if (CT.TERRAIN[t.t].void) continue;
        const [sx, sy] = this.project(t.x, t.y, this.tileHeight(t));
        const dx = Math.abs(mx - sx) / (TW / 2);
        const dy = Math.abs(my - sy) / (TH / 2);
        if (dx + dy <= 1) return t;
        if (dx <= 1) {
          const top = sy + (TH / 2) * (1 - dx);
          if (my >= top && my <= top + (this.tileHeight(t) + BASE) * HS) return t;
        }
      }
      return null;
    }
    tileOrder() {
      const m = this.map;
      if (!this._order || this._orderRot !== this._rot || this._orderMap !== m) {
        const all = [];
        for (const row of m.tiles) for (const t of row) all.push(t);
        this._order = all.sort((a, b) => this.depth(a.x, a.y) - this.depth(b.x, b.y) || this.view(a.x, a.y)[0] - this.view(b.x, b.y)[0]);
        this._orderRot = this._rot;
        this._orderMap = m;
      }
      return this._order;
    }
    tileAt(x, y) {
      const m = this.map;
      if (!m || x < 0 || y < 0 || x >= m.w || y >= m.h) return null;
      return m.tiles[y][x];
    }

    // ---- Tile rasterisation ------------------------------------------------------
    // Top diamond TW x TH, then the two side faces HS px per height level.
    // Material callbacks get world coordinates (scale-free) plus, for side faces,
    // both native pixel coords (pu, pv) and legacy double-scale ones (u, v).
    buildTile(t, frame) {
      const mat = CT.TERRAIN[t.t];
      const h = this.tileHeight(t);
      const depthPx = Math.max(1, Math.round((h + BASE) * HS));
      const Wc = TW;
      const HW = TW / 2, HH = TH / 2;
      const Hc = TH + depthPx + 1;
      const cv = document.createElement('canvas');
      cv.width = Wc;
      cv.height = Hc;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const img = ctx.createImageData(Wc, Hc);
      const put = (x, y, c) => {
        if (!c) return;
        const i = (y * Wc + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      };
      const light = 0.93 + t.h * 0.025;
      const nb = (dx, dy) => this.tileAt(t.x + dx, t.y + dy);
      const nbH = (dvx, dvy) => {
        const [dx, dy] = this.vecToWorld(dvx, dvy);
        const n = nb(dx, dy);
        return n && !CT.TERRAIN[n.t].void ? this.tileHeight(n) : -99;
      };
      const hFront = { r: nbH(1, 0), l: nbH(0, 1) };
      const hBack = { r: nbH(0, -1), l: nbH(-1, 0) };
      const liquid = mat.liquid;
      const ph = (frame / WATER_FRAMES) * Math.PI * 2;

      const p = { t, nb, frame, ph, native: true, rot: this._rot };
      for (let y = 0; y < TH; y++) {
        const hw = y < HH ? 2 * (y + 1) : 2 * (TH - y);
        for (let x = HW - hw; x < HW + hw; x++) {
          const dx = x + 0.5 - HW;
          const dy = y + 0.5 - HH;
          const ovx = dx / TW + dy / TH;
          const ovy = dy / TH - dx / TW;
          const [owx, owy] = this.vecToWorld(ovx, ovy);
          p.wx = t.x + owx;
          p.wy = t.y + owy;
          p.px = x;
          p.py = y;
          p.tx = Math.floor(p.wx * 16);
          p.ty = Math.floor(p.wy * 16);
          p.grain = hash(p.tx, p.ty, 7);
          p.n = vnoise(p.wx * 2.2, p.wy * 2.2, 1) * 0.55 + vnoise(p.wx * 7, p.wy * 7, 2) * 0.45;
          let c = mat.top(p);
          let k = light;
          const dUL = 0.5 + ovx;
          const dUR = 0.5 + ovy;
          if (hBack.l > h + 0.2) k *= 0.72 + 0.28 * Math.min(1, dUL / 0.3);
          if (hBack.r > h + 0.2) k *= 0.72 + 0.28 * Math.min(1, dUR / 0.3);
          c = [c[0] * k, c[1] * k, c[2] * k];
          if (!liquid && !mat.noRim) {
            // 1px lit lip on edges that drop away, faint highlight on the back edges.
            const edgeR = x >= HW && x - HW >= 2 * (TH - y) - 2 && y >= HH;
            const edgeL = x < HW && HW - 1 - x >= 2 * (TH - y) - 2 && y >= HH;
            if ((edgeR && hFront.r < h - 0.2) || (edgeL && hFront.l < h - 0.2)) c = CT.TX.mixc(c, [255, 250, 220], 0.3);
            const backEdge = y < HH && ((x < HW && x - (HW - 2 * (y + 1)) < 2) || (x >= HW && HW + 2 * (y + 1) - 1 - x < 2));
            if (backEdge && hBack.l <= h && hBack.r <= h) c = CT.TX.mixc(c, [255, 250, 220], 0.14);
          }
          put(x, y, c.map(Math.round));
        }
      }

      const sp = { t, depthPx: depthPx * 2, pdepth: depthPx, native: true, frame, ph, rot: this._rot };
      for (let face = 0; face < 2; face++) {
        sp.face = face;
        sp.k = face === 0 ? 0.72 : 0.88;
        for (let i = 0; i < HW; i++) {
          const x = face === 0 ? i : TW - 1 - i;
          const yTop = HH + Math.floor(i / 2) + 1;
          sp.pu = face === 0 ? i : HW - 1 - i;
          sp.u = sp.pu * 2;
          sp.wu = sp.u + (face === 0 ? 0 : 97) + t.x * 31 + t.y * 57;
          sp.pwu = sp.pu + (face === 0 ? 0 : 53) + t.x * 16 + t.y * 29;
          for (let v = 0; v < depthPx && yTop + v < Hc; v++) {
            sp.pv = v;
            sp.v = v * 2;
            const ao = 1 - Math.min(0.35, (v / Math.max(depthPx, 1)) * 0.35);
            sp.fin = (c) => [c[0] * sp.k * ao, c[1] * sp.k * ao, c[2] * sp.k * ao];
            const c = mat.side(sp);
            if (c) put(x, yTop + v, c.map(Math.round));
          }
        }
      }
      ctx.putImageData(img, 0, 0);

      if (mat.blades) {
        ctx.fillStyle = mat.blades;
        for (let i = 0; i < TW; i += 2) {
          if (hash(i, t.x * 13 + t.y, 99) > 0.45) continue;
          const yTop = HH + Math.floor((i < HW ? i : TW - 1 - i) / 2) + 1;
          ctx.fillRect(i, yTop, 1, 1 + Math.floor(hash(i, t.y, 98) * 3));
        }
      }
      CT.PAL.snapCanvas(cv);
      return { cv, depthPx };
    }

    tileImage(t, now) {
      const mat = CT.TERRAIN[t.t];
      const frame = mat.animated ? Math.floor(now / 160) % WATER_FRAMES : 0;
      const key = `${t.x},${t.y},${frame},${t.t},${t.h}`;
      let e = this.cache.get(key);
      if (!e) {
        e = this.buildTile(t, frame);
        this.cache.set(key, e);
      }
      return e;
    }
    invalidateTiles() {
      this.cache.clear();
      this._order = null;
    }

    // ---- Background -----------------------------------------------------------------
    // Painted at full logical size; theme coordinates are authored at 960x600 and halved.
    buildBackground(name) {
      const th = THEMES[name] || THEMES.dusk;
      const W = this.W;
      const H = this.H;
      const cv = CT.PX.canvas(W, H);
      const g = cv.getContext('2d');
      const sky = g.createLinearGradient(0, 0, 0, H);
      for (const [s, c] of th.sky) sky.addColorStop(s, c);
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < (th.stars || 0); i++) {
        const y = hash(i, 5) * H * 0.55;
        const bright = hash(i, 6) * (1 - y / (H * 0.55));
        g.fillStyle = bright > 0.55 ? '#ffffff' : bright > 0.25 ? '#bcc0d4' : '#6e7090';
        g.fillRect(Math.floor(hash(i, 4) * W), Math.floor(y), 1, 1);
      }
      if (th.moon) {
        const mx = Math.round(th.moon[0] / 2), my = Math.round(th.moon[1] / 2);
        for (let r = 16; r > 9; r -= 3) {
          // stepped halo rings, checker-dithered
          for (let y = -r; y <= r; y++)
            for (let x = -r; x <= r; x++)
              if (x * x + y * y <= r * r && ((x + y) & 1) === 0) {
                g.fillStyle = 'rgba(200,210,255,0.18)';
                g.fillRect(mx + x, my + y, 1, 1);
              }
        }
        g.fillStyle = '#fff0dc';
        PXD.disc(g, mx, my, 9);
        g.fillStyle = '#bcc0d4';
        g.fillRect(mx - 4, my - 2, 3, 2);
        g.fillRect(mx + 2, my + 3, 2, 2);
        g.fillRect(mx - 1, my + 5, 2, 1);
      }
      if (th.sun) {
        const [sx, sy, col] = th.sun;
        const X = Math.round(sx / 2), Y = Math.round(sy / 2);
        const sun = g.createRadialGradient(X, Y, 2, X, Y, 65);
        sun.addColorStop(0, `rgba(${col},0.9)`);
        sun.addColorStop(0.15, `rgba(${col},0.45)`);
        sun.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = sun;
        g.fillRect(0, 0, W, H);
        g.fillStyle = `rgb(${col})`;
        PXD.disc(g, X, Y, 5);
      }
      if (th.volcano) {
        g.fillStyle = th.mountains[0];
        const pts = [[280, 200], [350, 95], [370, 95], [450, 200]];
        for (let y = 95; y <= 200; y++) {
          const k = (y - 95) / 105;
          g.fillRect(Math.round(350 - k * 70), y, Math.round(20 + k * 150), 1);
        }
        void pts;
        for (let i = 0; i < 40; i++) {
          g.fillStyle = 'rgba(90,70,70,0.35)';
          PXD.disc(g, 360 + (hash(i, 50) - 0.5) * 60, 80 - hash(i, 51) * 60, 3 + Math.floor(hash(i, 52) * 6));
        }
      }
      (th.mountains || []).forEach((col, li) => {
        const base = 165 + li * 27;
        const amp = (th.peaks ? 75 : 45) - li * 10;
        const f = [0.012, 0.02, 0.032][li];
        for (let x = 0; x < W; x++) {
          let n = vnoise(x * f, 0, li + 1) * 0.7 + vnoise(x * f * 4, 1, li + 1) * 0.3;
          if (th.peaks) n = Math.pow(n, 0.7);
          const top = Math.round(base - n * amp);
          g.fillStyle = col;
          g.fillRect(x, top, 1, H - top);
          if (th.peaks && li === 0 && n > 0.55) {
            g.fillStyle = '#e4e8f0';
            g.fillRect(x, top, 1, Math.round((n - 0.55) * 30));
          }
          // 1px lighter ridge line on the nearest layer
          if (li === (th.mountains.length - 1)) {
            g.fillStyle = 'rgba(255,255,255,0.12)';
            g.fillRect(x, top, 1, 1);
          }
        }
      });
      if (th.sea) {
        g.fillStyle = th.sea;
        g.fillRect(0, 220, W, H - 220);
        g.fillStyle = '#8cc0f0';
        for (let i = 0; i < 60; i++) g.fillRect(Math.floor(hash(i, 30) * W), 222 + Math.floor(hash(i, 31) * 75), 3 + Math.floor(hash(i, 32) * 7), 1);
      }
      if (th.forest) {
        g.fillStyle = th.forest;
        for (let x = 0; x < W; x += 2) {
          const top = 235 - Math.floor(vnoise(x * 0.16, 3, 4) * 13) - (x % 6 === 0 ? 2 : 0);
          g.fillRect(x, top, 2, H - top);
        }
      }
      if (th.interior) {
        for (let i = 0; i < 7; i++) {
          const x = Math.round(30 + i * 70 + hash(i, 40) * 20);
          for (let k = 0; k < 25; k++) {
            const a = (name === 'museum' ? 0.3 : 0.05) * Math.sin((k / 25) * Math.PI);
            g.fillStyle = `rgba(255,255,255,${a})`;
            g.fillRect(x + k, 0, 1, H);
          }
        }
      }
      const clouds = th.clouds
        ? [0, 1, 2, 3, 4].map((i) => {
            const w = 60 + Math.floor(hash(i, 8) * 50);
            const c = CT.PX.canvas(w, 18, (cg) => {
              for (let k = 0; k < 8; k++) {
                const cx = 8 + hash(i, k + 20) * (w - 16);
                const cy = 10 + hash(i, k + 40) * 4;
                const r = 4 + Math.floor(hash(i, k + 60) * 5);
                cg.fillStyle = th.clouds[0];
                PXD.disc(cg, cx, cy, r);
              }
              for (let k = 0; k < 8; k++) {
                const cx = 8 + hash(i, k + 20) * (w - 16);
                const cy = 10 + hash(i, k + 40) * 4;
                const r = 4 + Math.floor(hash(i, k + 60) * 5);
                cg.fillStyle = th.clouds[1];
                PXD.disc(cg, cx - 1, cy - 2, Math.max(1, r - 2));
              }
            });
            return { c, x: hash(i, 9) * W, y: 30 + i * 22 + hash(i, 10) * 10, v: 0.002 + hash(i, 11) * 0.003, a: 0.5 + hash(i, 12) * 0.3 };
          })
        : [];
      const vg = CT.PX.canvas(W, H, (v) => {
        const rg = v.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 0.95);
        rg.addColorStop(0, 'rgba(0,0,0,0)');
        rg.addColorStop(1, `rgba(8,4,20,${th.vignette != null ? th.vignette : 0.4})`);
        v.fillStyle = rg;
        v.fillRect(0, 0, W, H);
      });
      return { cv, clouds, vignette: vg };
    }

    background(name) {
      if (!this.bgCache.has(name)) this.bgCache.set(name, this.buildBackground(name));
      return this.bgCache.get(name);
    }

    drawBackground(now) {
      const name = (this.map && this.map.theme) || 'dusk';
      const bg = this.background(name);
      const ctx = this.ctx;
      ctx.drawImage(bg.cv, 0, 0);
      for (const cl of bg.clouds) {
        const x = ((cl.x + now * cl.v) % (this.W + cl.c.width)) - cl.c.width;
        ctx.globalAlpha = cl.a;
        ctx.drawImage(cl.c, Math.round(x), Math.round(cl.y));
      }
      ctx.globalAlpha = 1;
    }

    // ---- Frame -------------------------------------------------------------------
    shake(amount, ms = 250) {
      this.shakeAmt = Math.max(1, Math.round(amount / 2));
      this.shakeT = performance.now() + ms;
      this.shakeMs = ms;
    }
    flashScreen(color = '255,255,255', ms = 200, peak = 1) {
      this.screenFlash = { color, t0: performance.now(), ms, peak };
    }

    // Quantise the composed frame onto the master palette and show it.
    present() {
      const src = this.ctx.getImageData(0, 0, this.W, this.H);
      CT.PAL.quantize(src, this.out32, this.W, this.H, this.dither);
      this.sctx.putImageData(this.outImg, 0, 0);
    }

    draw(ui, now) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const world = this.world;
      if (!world || !world.map) {
        ctx.fillStyle = '#0a0612';
        ctx.fillRect(0, 0, this.W, this.H);
        this.drawOverlays(now);
        this.present();
        return;
      }
      this.updateCamera();
      this.drawBackground(now);

      if (now < this.shakeT) {
        // Whole-pixel shake that decays; alternates so it never drifts.
        const k = (this.shakeT - now) / (this.shakeMs || 250);
        const a = Math.max(1, Math.round(this.shakeAmt * k));
        const ph = Math.floor(now / 33) % 4;
        ctx.translate([a, -a, a, -a][ph], [0, a, -a, 0][ph] >> (k < 0.5 ? 1 : 0));
      }

      const drawables = [];
      for (const t of this.tileOrder()) drawables.push({ z: this.depth(t.x, t.y), sub: 0, t });
      for (const u of world.units) {
        if (u.hidden || (!u.alive && u.alpha <= 0)) continue;
        const z = Math.max(this.depth(Math.floor(u.rx), Math.floor(u.ry)), this.depth(Math.ceil(u.rx), Math.ceil(u.ry)));
        drawables.push({ z, sub: 1 + (u.prop ? 0 : 0.5), u });
      }
      this.sheetFx = this.sheetFx.filter((e) => now - e.t0 < e.until);
      for (const e of this.sheetFx) if (e.fx.def.layer === 'back') drawables.push({ z: this.depth(Math.round(e.u ? e.u.rx : e.x), Math.round(e.u ? e.u.ry : e.y)), sub: 0.9, e });
      if (this.casts) {
        this.casts = this.casts.filter((c) => now - c.t0 < c.ms);
        for (const c of this.casts) drawables.push({ z: Math.max(this.depth(Math.floor(c.u.rx), Math.floor(c.u.ry)), this.depth(Math.ceil(c.u.rx), Math.ceil(c.u.ry))), sub: 1.4, c });
      }
      drawables.sort((a, b) => a.z - b.z || a.sub - b.sub);

      const lights = [];
      for (const d of drawables) {
        if (d.t) this.drawTile(d.t, ui, now, lights);
        else if (d.e) this.drawSheetFx(d.e, now);
        else if (d.c) this.drawCast(d.c, now, -1);
        else this.drawUnit(d.u, world, ui, now, lights);
      }
      for (const r of this.rifts) this.drawRift(r, now);

      this.drawGrading(lights, now);
      if (ui.spotAt && CT.Interact) CT.Interact.drawIcons(this, ctx, ui.spotAt, now); // spot icons stay bright at night
      this.drawDim(now);
      for (const b of this.big) this.drawBig(b, now);
      for (const e of this.sheetFx) if (e.fx.def.layer !== 'back') this.drawSheetFx(e, now);
      if (this.casts) for (const c of this.casts) this.drawCast(c, now, 1);
      this.drawEffects(now);
      this.drawWeather(now);
      this.drawUnitHud(world, ui, now);
      this.drawFloaters(now);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.background(this.map.theme || 'dusk').vignette, 0, 0);
      this.drawOverlays(now);
      this.present();
    }

    // Colour grading, darkness and light sources (stepped pools).
    drawGrading(lights, now) {
      const ctx = this.ctx;
      const th = this.theme;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (th.tint) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = th.tint;
        ctx.fillRect(0, 0, this.W, this.H);
      }
      if (th.dark) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(4,6,20,${th.dark})`;
        ctx.fillRect(0, 0, this.W, this.H);
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        const fl = l.flicker ? 0.85 + 0.15 * Math.sin(now / 90 + l.x * 7) * Math.sin(now / 53 + l.y) : 1;
        const r = Math.round(l.radius * (0.95 + 0.05 * fl));
        // Three concentric steps, brightest in the middle.
        for (const [kr, a] of [[1, 0.1], [0.62, 0.12], [0.3, 0.16]]) {
          ctx.fillStyle = `rgba(${l.color},${a * fl})`;
          PXD.ellipse(ctx, l.x, l.y, Math.round(r * kr), Math.round(r * kr * 0.7));
        }
      }
      ctx.restore();
    }

    drawWeather(now) {
      const ctx = this.ctx;
      const th = this.theme;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const kind = th.particles;
      const W = this.W, H = this.H;
      if (kind === 'snow') {
        ctx.fillStyle = '#ffffff';
        for (const m of this.motes) {
          const x = (m.x + Math.sin(now / 1600 + m.p) * 12 + now * 0.005 * m.s) % W;
          const y = (m.y + now * 0.015 * (0.5 + m.s)) % H;
          const s = m.s > 0.7 ? 2 : 1;
          ctx.fillRect(Math.round(x), Math.round(y), s, s);
        }
      } else if (kind === 'embers') {
        for (const m of this.motes) {
          const x = (m.x + Math.sin(now / 900 + m.p) * 10) % W;
          const y = H - ((m.y + now * 0.015 * (0.4 + m.s)) % H);
          const k = 0.5 + 0.5 * Math.sin(now / 200 + m.p);
          ctx.fillStyle = k > 0.66 ? '#fce068' : k > 0.33 ? '#e88c28' : '#a02030';
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      } else if (kind === 'fireflies' || kind === 'motes' || kind === 'sparkle') {
        const ramp = kind === 'fireflies' ? ['#fff4b0', '#fce068', '#a8d45c'] : kind === 'sparkle' ? ['#ffffff', '#c4e4ff', '#8cc0f0'] : ['#fff0dc', '#c0aa92', '#7a665a'];
        const n = kind === 'fireflies' ? 26 : 40;
        for (let i = 0; i < n; i++) {
          const m = this.motes[i];
          const x = Math.round((m.x + Math.sin(now / 2100 + m.p) * 15 + now * 0.002 * m.s) % W);
          const y = Math.round((m.y * 0.8 + 30 + Math.sin(now / 1300 + m.p * 2) * 8) % H);
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
        ctx.fillStyle = '#c0aa92';
        for (let i = 0; i < 30; i++) {
          const m = this.motes[i];
          if (m.s < 0.5) continue;
          const x = (m.x + now * 0.003 * m.s) % W;
          const y = (m.y + Math.sin(now / 1500 + m.p) * 5) % H;
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      } else if (kind === 'wind') {
        ctx.fillStyle = '#e4e8f0';
        for (let i = 0; i < 18; i++) {
          const m = this.motes[i];
          const x = ((m.x + now * 0.12 * (0.5 + m.s)) % (W + 100)) - 50;
          const y = m.y * 0.7 + Math.sin(now / 700 + m.p) * 4;
          const len = 12 + Math.floor(m.s * 18);
          for (let k = 0; k < len; k += 2) ctx.fillRect(Math.round(x) + k, Math.round(y + Math.sin((x + k) / 20) * 1), 1, 1);
        }
      }
      if (th.scan) {
        ctx.fillStyle = `rgba(0,0,0,${th.scan})`;
        const off = Math.floor(now / 60) % 3;
        for (let y = off; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      }
      ctx.restore();
    }

    // Full-screen fades & flashes, drawn over everything.
    drawOverlays(now) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.world || !this.world.map) for (const b of this.big) this.drawBig(b, now);
      this.drawLetterbox(now);
      this.big = this.big.filter((b) => now - b.t0 < b.ms);
      if (this.screenFlash) {
        const k = (now - this.screenFlash.t0) / this.screenFlash.ms;
        if (k >= 1) this.screenFlash = null;
        else {
          ctx.fillStyle = `rgba(${this.screenFlash.color},${(Math.round((1 - k) * 4) / 4) * (this.screenFlash.peak || 1)})`;
          ctx.fillRect(0, 0, this.W, this.H);
        }
      }
      if (this.fade > 0) {
        // Stepped fade (8 levels) so it reads as a palette fade.
        ctx.fillStyle = `rgba(${this.fadeColor},${Math.min(1, Math.ceil(this.fade * 8) / 8)})`;
        ctx.fillRect(0, 0, this.W, this.H);
      }
      ctx.restore();
    }

    drawTile(t, ui, now, lights) {
      const ctx = this.ctx;
      const mat = CT.TERRAIN[t.t];
      const h = this.tileHeight(t);
      const [sx0, sy0] = this.project(t.x, t.y, h);
      const sx = Math.round(sx0), sy = Math.round(sy0);
      const key = `${t.x},${t.y}`;
      if (!mat.void) {
        const { cv } = this.tileImage(t, now);
        ctx.drawImage(cv, sx - TW / 2, sy - TH / 2);
        if (mat.glow && ((t.x + t.y) & 1) === 0) lights.push({ x: sx, y: sy, color: mat.glow, radius: 20, flicker: true }); // every other tile, so clusters don't flood
      }

      if (ui.grid && !mat.void) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        PXD.diamond(ctx, sx, sy, TW / 2, false);
      }

      const hl = ui.highlights && ui.highlights.get(key);
      if (hl) {
        const pulse = Math.floor(now / 220) % 2;
        const col = { move: [92, 144, 220], aoe: [252, 224, 104], tech: [252, 224, 104], range: [212, 60, 60], zone: [224, 112, 156], danger: [240, 108, 76] }[hl] || [255, 255, 255];
        ctx.fillStyle = `rgba(${col},${hl === 'zone' ? 0.22 : 0.34 + pulse * 0.08})`;
        PXD.diamond(ctx, sx, sy, TW / 2 - 1, true);
        ctx.fillStyle = `rgb(${col.map((c) => Math.min(255, c + 70))})`;
        PXD.diamond(ctx, sx, sy, TW / 2 - 1, false);
      }
      if (ui.path && ui.path.has(key)) {
        ctx.fillStyle = '#ffffff';
        PXD.diamond(ctx, sx, sy, 4, true);
      }
      if (ui.hover && ui.hover.x === t.x && ui.hover.y === t.y) {
        ctx.fillStyle = Math.floor(now / 160) % 2 ? '#ffffff' : '#fce068';
        PXD.diamond(ctx, sx, sy, TW / 2, false);
        PXD.diamond(ctx, sx, sy - 1, TW / 2, false);
        if (ui.grid) PXD.text(ctx, String(t.h), sx, sy - 3, '#ffffff', { align: 'center' });
      }

      // Interactive spots (js/interactives.js): glow on the tile, icon above any decor.
      const spot = ui.spotAt && CT.Interact && ui.spotAt.get(key);
      if (spot) CT.Interact.drawMarker(this, ctx, spot, sx, sy, now, lights, 'base');
      const d = this.map.decorAt.get(key);
      if (d && !d.hidden) this.drawDecor(d, sx, sy, now, lights);
    }

    drawDecor(d, sx, sy, now, lights) {
      const ctx = this.ctx;
      const def = CT.DECOR[d.kind];
      if (!def) return;
      const native = !!def.native; // drawn at the logical resolution; legacy art is halved
      const k = native ? 1 : 0.5;
      let img = CT.getDecor(d.kind, d.variant || 0);
      let frameImg = def.animate ? def.animate(img, now, d) || img : img;
      if (!native) {
        let h = this.decorHalf.get(frameImg);
        if (!h) {
          h = halve(frameImg);
          if (this.decorHalf.size > 400) this.decorHalf.clear();
          this.decorHalf.set(frameImg, h);
        }
        frameImg = h;
      }
      if (def.shadow) {
        ctx.fillStyle = 'rgba(10,6,18,0.3)';
        PXD.ellipse(ctx, sx, sy + 1, Math.round(def.shadow[0] * k), Math.max(1, Math.round(def.shadow[1] * k)));
      }
      const flat = def.flat;
      const dx = Math.round(sx - frameImg.width / 2 + (def.xOff || 0) * k);
      const dy = flat ? Math.round(sy - frameImg.height / 2) : Math.round(sy - frameImg.height + (def.yOff || 0) * k);
      ctx.drawImage(frameImg, dx, dy);
      if (def.light) {
        const l = def.light;
        lights.push({ x: sx + (l.dx || 0) * k, y: dy + (l.dy != null ? l.dy * k : frameImg.height * 0.3), color: l.color, radius: (l.radius || 60) * k, flicker: l.flicker });
      }
    }

    unitScreenPos(u) {
      return this.project(u.rx + u.ox, u.ry + u.oy, u.rh);
    }

    // Which animation a unit is in right now: explicit u.anim (set by battle and
    // scene code), walking while its render position moves, else idle.
    unitAnim(u, spr, now) {
      if (u.koPose) return { name: 'ko', t: 0 };
      if (u.anim) {
        const a = spr.anims[u.anim.name];
        const t = now - u.anim.t0;
        if (a && (u.anim.hold || u.anim.charge || a.loop || t < a.total)) return { name: u.anim.name, t, charge: u.anim.charge };
        if (!u.anim.hold) u.anim = null;
      }
      const moved = u._lx !== undefined && (Math.abs(u._lx - u.rx) > 0.001 || Math.abs(u._ly - u.ry) > 0.001);
      u._lx = u.rx;
      u._ly = u.ry;
      if (moved) u._walkUntil = now + 120;
      if (u._walkUntil > now) return { name: 'walk', t: now };
      if (u.status && u.status.stasis) return { name: 'idle', t: 0 };
      return { name: 'idle', t: now + (u.id || 0) * 377 };
    }

    spriteFrame(u, now) {
      const spr = CT.getSprite(u.sprite || u.key);
      const dir = this.screenDir(u.face);
      if (spr.rig) {
        const a = this.unitAnim(u, spr, now);
        const f = spr.frame(a.name, dir, a.t, a);
        if (f && f !== u._lastFrame) {
          u._lastFrame = f;
          if (f.sfx && CT.audio) CT.audio.sfx(f.sfx);
        }
        if (f) return f;
      }
      return spr.frames[dir] || spr.frames['south-east'] || Object.values(spr.frames)[0];
    }

    drawUnit(u, world, ui, now, lights) {
      const ctx = this.ctx;
      const f = this.spriteFrame(u, now);
      const [sx0, sy0] = this.unitScreenPos(u);
      const sx = Math.round(sx0);
      const sy = Math.round(sy0 - (u.oz || 0) / 2);
      const isActive = world.active === u;
      const showRing = ui.grid && !u.prop && u.team != null;
      u._f = f;
      u._sx = sx;
      u._sy = sy;

      ctx.save();
      ctx.globalAlpha = u.alpha;
      if (!u.noShadow) {
        const big = u.big ? 1.8 : 1;
        ctx.fillStyle = 'rgba(10,6,18,0.35)';
        PXD.ellipse(ctx, sx, Math.round(sy0) + 1, Math.round(8 * big), Math.round(3 * big));
      }
      if (showRing) {
        const ring = u.guest ? '#a8d45c' : u.team === 0 ? '#8cc0f0' : u.team === 1 ? '#f06c4c' : '#bcc0d4';
        ctx.fillStyle = ring;
        if (!isActive || Math.floor(now / 200) % 2) PXD.ellipseRing(ctx, sx, Math.round(sy0) + 1, u.big ? 16 : 10, u.big ? 6 : 4);
      }

      const img = f.img;
      const dx = Math.round(sx - f.cx);
      const dy = Math.round(sy - f.footY + 2);
      if (u.flicker && Math.floor(now / 70 + u.id * 3) % 9 === 0) ctx.globalAlpha = u.alpha * 0.75;
      if (u.status && u.status.stasis) ctx.globalAlpha *= 0.85;
      const spr = CT.getSprite(u.sprite || u.key);
      if (u.koPose && spr.koRotate !== false) {
        // Lying down: an exact quarter turn of the sprite (lossless for pixel art).
        const west = this.screenDir(u.face).endsWith('west');
        ctx.translate(sx, sy - 3);
        ctx.rotate((Math.PI / 2) * (west ? -1 : 1));
        ctx.drawImage(img, -Math.round(f.cx), -f.footY + 4);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else ctx.drawImage(img, dx, dy);
      if (u.flash > 0) {
        ctx.globalAlpha = u.alpha * (u.flash > 0.5 ? 1 : 0.5);
        ctx.drawImage(f.flash, dx, dy);
      }
      ctx.restore();
      if (f.glow && lights) lights.push({ x: dx + f.glow.x, y: dy + f.glow.y, color: CT.PAL.hex(f.glow.color).join(','), radius: 14, flicker: true });
      const top = f.box ? f.box.y0 : f.top;
      u._headY = dy + top;
    }

    // HP bars, badges, emotes and the active marker: drawn after grading so they stay legible.
    drawUnitHud(world, ui, now) {
      const ctx = this.ctx;
      for (const u of world.units) {
        if (u.hidden || u._headY == null || (!u.alive && u.alpha <= 0)) continue;
        const sx = u._sx, headY = u._headY;
        if (u.status && u.status.stasis) {
          ctx.fillStyle = Math.floor(now / 150) % 2 ? '#c4e4ff' : '#8cc0f0';
          PXD.ellipseRing(ctx, sx, Math.round((headY + u._sy) / 2), 11, Math.round((u._sy - headY) / 2) + 3);
        }
        if (ui.grid && u.alive && !u.prop && u.maxHp) {
          const bw = u.big ? 24 : 16;
          const bx = Math.round(sx - bw / 2);
          const by = headY - 5;
          ctx.fillStyle = '#0a0612';
          ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
          const fr = Math.max(0, u.hp / u.maxHp);
          const w = Math.max(1, Math.round(bw * fr));
          ctx.fillStyle = fr > 0.5 ? '#488c34' : fr > 0.25 ? '#e88c28' : '#a02030';
          ctx.fillRect(bx, by, w, 2);
          ctx.fillStyle = fr > 0.5 ? '#a8d45c' : fr > 0.25 ? '#fce068' : '#f06c4c';
          ctx.fillRect(bx, by, w, 1);
          if (u.status) {
            const S = { burn: ['B', '#f06c4c'], slow: ['S', '#8cc0f0'], haste: ['H', '#a8d45c'], stun: ['*', '#fce068'], catalogued: ['C', '#e0709c'], stasis: ['∎', '#c4e4ff'], magdown: ['M', '#bc84e4'], might: ['A', '#f06c4c'], barrier: ['W', '#d0b8f8'] };
            let i = 0;
            for (const k in u.status) {
              if (!u.status[k] || !S[k]) continue;
              const x = bx + i * 8;
              ctx.fillStyle = '#0a0612';
              ctx.fillRect(x - 1, by - 10, 7, 9);
              PXD.text(ctx, S[k][0], x, by - 9, S[k][1], { outline: false });
              i++;
            }
          }
          if (u.carrying) {
            ctx.fillStyle = Math.floor(now / 150) % 2 ? '#f06c4c' : '#a02030';
            PXD.disc(ctx, sx + 7, headY + 9, 2);
          }
        }
        if (u.emote) {
          const age = now - u.emote.t0;
          if (age > (u.emote.ms || 1400)) u.emote = null;
          else {
            const ey = Math.round(headY - 9 - Math.min(3, age / 60));
            const w = Math.max(7, u.emote.text.length * 6 + 3);
            ctx.fillStyle = '#0a0612';
            PXD.ellipse(ctx, sx + 6, ey, Math.ceil(w / 2) + 1, 6);
            ctx.fillStyle = '#ffffff';
            PXD.ellipse(ctx, sx + 6, ey, Math.ceil(w / 2), 5);
            ctx.fillRect(sx + 2, ey + 5, 2, 2);
            PXD.text(ctx, u.emote.text, sx + 6, ey - 3, u.emote.color || '#1a1226', { align: 'center', outline: false });
          }
        }
        if (world.active === u && u.alive && ui.grid) {
          const ay = headY - 16 + (Math.floor(now / 250) % 2);
          const col = u.team === 0 ? ['#c4e4ff', '#5c90dc', '#2c4488'] : ['#f8b0c8', '#d43c3c', '#6c1422'];
          for (let r = 0; r < 6; r++) {
            const hw = 5 - r;
            ctx.fillStyle = '#0a0612';
            ctx.fillRect(sx - hw - 1, ay + r, hw * 2 + 3, 1);
          }
          for (let r = 0; r < 5; r++) {
            const hw = 4 - r;
            ctx.fillStyle = col[1];
            ctx.fillRect(sx - hw, ay + r, hw + 1, 1);
            ctx.fillStyle = col[2];
            ctx.fillRect(sx + 1, ay + r, hw, 1);
          }
          ctx.fillStyle = col[0];
          ctx.fillRect(sx - 3, ay, 2, 1);
        }
        if (ui.facingFor === u) this.drawFacingArrows(u, sx, Math.round(this.unitScreenPos(u)[1]), now);
      }
    }

    drawFacingArrows(u, sx, sy, now) {
      const ctx = this.ctx;
      for (let f = 0; f < 4; f++) {
        const [fx, fy] = CT.DIRS[f];
        const [vx, vy] = this.vecToView(fx, fy);
        const ax = sx + (vx - vy) * 13;
        const ay = sy + (vx + vy) * 6;
        const on = u.face === f;
        const col = on ? (Math.floor(now / 150) % 2 ? '#fce068' : '#f8bc3c') : '#e4e8f0';
        // small arrow head pointing outward along the iso direction
        const px = vx - vy, py = (vx + vy) / 2;
        for (let s = 0; s < 4; s++) {
          ctx.fillStyle = '#0a0612';
          ctx.fillRect(Math.round(ax + px * s - py * (4 - s) * 2) - 1, Math.round(ay + py * s + px * (4 - s) / 2) - 1, 3, 3);
          ctx.fillRect(Math.round(ax + px * s + py * (4 - s) * 2) - 1, Math.round(ay + py * s - px * (4 - s) / 2) - 1, 3, 3);
        }
        ctx.fillStyle = col;
        for (let s = 0; s < 4; s++) {
          ctx.fillRect(Math.round(ax + px * s - py * (4 - s) * 2), Math.round(ay + py * s + px * (4 - s) / 2), 1, 1);
          ctx.fillRect(Math.round(ax + px * s + py * (4 - s) * 2), Math.round(ay + py * s - px * (4 - s) / 2), 1, 1);
        }
      }
    }

    // ---- Unit animation helpers (called by battle & scene code) ---------------------------
    // Play a one-shot animation; resolves when it ends. opts.hold keeps the last frame.
    anim(u, name, opts = {}) {
      u.anim = { name, t0: performance.now(), hold: !!opts.hold, charge: !!opts.charge };
      const spr = CT.getSprite(u.sprite || u.key);
      const a = spr.rig && spr.anims[name];
      return a && !opts.charge && !a.loop ? a.total : 0;
    }
    stopAnim(u) {
      u.anim = null;
    }

    // ---- Effects -------------------------------------------------------------------
    floatText(u, text, color, big) {
      const [sx, sy] = this.project(u.x, u.y, u.rh);
      const now = performance.now();
      // Stack above any recent text on the same unit.
      let y = Math.round(sy - 38);
      for (const f of this.floaters) if (now - f.t0 < 700 && Math.abs(f.x - sx) < 14) y = Math.min(y, f.y - (big ? 17 : 10));
      this.floaters.push({ x: Math.round(sx), y, text, color, t0: now, big });
    }

    drawFloaters(now) {
      const ctx = this.ctx;
      this.floaters = this.floaters.filter((f) => now - f.t0 < 1300);
      for (const f of this.floaters) {
        const k = (now - f.t0) / 1300;
        if (k > 0.8 && Math.floor(now / 50) % 2) continue; // blink out
        const y = f.y - (k < 0.2 ? Math.round(Math.sin((k / 0.2) * Math.PI) * 7) : 0) - Math.round(k * 5);
        PXD.text(ctx, f.text, f.x, y, f.color, { align: 'center', scale: f.big ? 2 : 1 });
      }
    }

    // Pooled pixel particles. p: { x, y, vx, vy, g, t0, life, ramp, s, heart, drag }
    spawn(p) {
      if (this.parts.length > 900) this.parts.shift();
      this.parts.push(p);
    }

    burst(x, y, h, elem, opts = {}) {
      const [sx0, sy0] = this.project(x, y, h);
      const sx = Math.round(sx0), sy = Math.round(sy0) - 12;
      const ramp = rampOf(elem);
      const now = performance.now();
      const up = elem === 'heal' || elem === 'charm';
      const n = opts.n || (elem === 'hit' ? 12 : 26);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.35 + Math.random() * 1.3;
        this.spawn({
          x: sx, y: sy,
          vx: Math.cos(a) * sp,
          vy: up ? -0.4 - Math.random() * 0.7 : Math.sin(a) * sp * 0.7 - 0.7,
          g: up ? -0.004 : 0.045,
          t0: now + (elem === 'ice' || elem === 'heal' ? Math.random() * 120 : 0),
          life: 380 + Math.random() * 460,
          ramp, heart: elem === 'charm', drag: 0.985,
        });
      }
      this.rings.push({ x: sx, y: sy, t0: now, ms: elem === 'hit' ? 180 : 320, r: Math.round((opts.r || (elem === 'hit' ? 22 : 40)) / 2), ramp });
      if (elem === 'lightning') this.skyBolt(sx, sy + 4);
      if (!up && !opts.noShake) this.shake(elem === 'hit' ? 3 : 6);
    }

    // Charge-up: sparks spiral in to a unit's hands (or its middle) for `ms`, over a
    // rune circle that opens at its feet (drawn in two halves so the caster stands inside it).
    charge(u, elem = 'shadow', ms = 700) {
      const now = performance.now();
      const ramp = rampOf(elem);
      for (let i = 0; i < 22; i++) {
        this.orbits.push({ u, t0: now + (i / 22) * ms * 0.7, life: 300 + Math.random() * 220, a0: Math.random() * Math.PI * 2, r0: 9 + Math.random() * 8, w: (0.012 + Math.random() * 0.008) * (i % 2 ? 1 : -1), ramp });
      }
      if (ms > 50) {
        this.casts = (this.casts || []).filter((c) => c.u !== u);
        this.casts.push({ u, elem, ramp, t0: now, ms: ms + 260, last: -1, crack: null, n: [...String(u.id || u.key || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 0) });
      }
    }
    drawCast(c, now, half) {
      const t = now - c.t0;
      const u = c.u;
      if (t < 0 || t > c.ms || u.hidden) return;
      const ctx = this.ctx, R = c.ramp;
      const st = Math.floor(t / STEP);
      const [sx0, sy0] = this.unitScreenPos(u);
      const cx = Math.round(sx0), cy = Math.round(sy0) + 1;
      const sz = u.big ? 1.5 : 1;
      const open = Math.min(1, (st + 1) / 5);
      const out = Math.max(0, (t - (c.ms - 220)) / 220);
      const ci = Math.min(3, Math.floor(out * 4));
      const dark = c.elem === 'shadow' || c.elem === 'dark' || c.elem === 'psy';
      const rx = Math.round(19 * sz * (0.35 + 0.65 * open)), ry = Math.max(3, Math.round(rx * 0.45));
      // Outer ring with a dark under-line, an inner dashed ring turning the other way.
      ctx.fillStyle = dark ? '#0a0612' : R[Math.min(5, 4 + (ci >> 1))];
      ringArc(ctx, cx, cy + 1, rx, ry, half);
      ctx.fillStyle = R[Math.min(5, (dark ? 2 : 1) + ci)];
      ringArc(ctx, cx, cy, rx, ry, half);
      if (open >= 0.6) {
        ctx.fillStyle = R[Math.min(5, 2 + ci)];
        dashRing(ctx, cx, cy, rx - 5, Math.max(2, ry - 2), 28, st, half, 2, 3);
        ctx.fillStyle = R[Math.min(5, 3 + ci)];
        dashRing(ctx, cx, cy, rx + 3, ry + 1, 36, 1000 - st, half, 1, 4);
      }
      if (open >= 1 && out < 0.75) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + st * 0.07 * (dark ? -1 : 1);
          const s = Math.sin(a);
          if ((half < 0 && s > 0) || (half > 0 && s <= 0)) continue;
          const gx = Math.round(cx + Math.cos(a) * (rx - 2.5)), gy = Math.round(cy + s * (ry - 1));
          // Runes lift off the circle as the charge builds.
          const lift = Math.min(4, st >> 3);
          glyph(ctx, RUNES[(i + c.n) % RUNES.length], gx - 1, gy - 5 - lift, R[ci], dark ? '#0a0612' : R[Math.min(5, 4)]);
        }
      }
      if (half <= 0 || st === c.last) {
        if (half > 0 && c.crack && c.crack.st === st) { ctx.fillStyle = R[2]; poly(ctx, c.crack.pts, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(c.crack.pts[0][0], c.crack.pts[0][1], 1, 1); }
        return;
      }
      c.last = st;
      if (out > 0) return;
      // Elemental gathering, one beat per step.
      const a = hashI(st, c.n, 7) * TAU;
      const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
      const e = c.elem;
      if (e === 'lightning' || e === 'laser') {
        if (st % 2 === 0) {
          const b = a + 1 + hashI(st, 3) * 2;
          c.crack = { st, pts: zig(st + c.n * 31, 0, px, py - 2, cx + Math.cos(b) * rx * 0.7, cy - 10 - hashI(st, 9) * 18, 5, 3) };
        }
        this.addBit({ k: 'spark', x: px, y: py, vx: (cx - px) * 0.03, vy: -1.2, g: 0, life: 200, ramp: R });
      } else if (e === 'fire' || e === 'lavos') {
        this.addBit({ k: 'ember', x: px, y: py, vx: 0, vy: -0.55 - hashI(st, 4) * 0.4, g: 0, life: 520, ramp: R, ph: st });
      } else if (e === 'ice' || e === 'glass' || e === 'porcelain') {
        this.addBit({ k: 'sparkle', x: px, y: py - 2, vx: (cx - px) * 0.02, vy: -0.35, g: 0, life: 360, ramp: R, ph: st });
      } else if (e === 'water') {
        this.addBit({ k: 'drop', x: px, y: py, vx: (cx - px) * 0.015, vy: -1.4 - hashI(st, 5) * 0.6, g: 0.08, life: 600, ramp: R, floor: py });
      } else if (dark) {
        this.addBit({ k: 'mote', x: cx + Math.cos(a) * rx * 2.4, y: cy - 14 + Math.sin(a) * ry * 3, cx, cy: cy - 18, life: 420, ramp: R, ph: a });
      } else {
        this.addBit({ k: 'sparkle', x: px, y: py, vx: 0, vy: -0.6, g: 0, life: 520, ramp: R, ph: st });
      }
    }

    // ---- Impact bits: embers, shards, debris, droplets, sparks, motes, sparkles -------------
    addBit(b) {
      const bits = this.bits || (this.bits = []);
      if (bits.length > 600) bits.shift();
      b.t0 = b.t0 || performance.now();
      b.lt = b.t0;
      b.vx = b.vx || 0; b.vy = b.vy || 0; b.g = b.g || 0;
      b.x0 = b.x; b.y0 = b.y;
      bits.push(b);
    }
    // Scatter `n` bits of kind k from (x, y); `gy` is the ground line under them.
    scatter(k, n, x, y, gy, ramp, opts = {}) {
      const now = performance.now();
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const sp = (opts.speed || 1) * (0.5 + Math.random());
        const d = { k, x: x + (Math.random() - 0.5) * (opts.spread || 10), y: y + (Math.random() - 0.5) * (opts.spread || 10) * 0.5, ramp, t0: now + (opts.delay || 0) + Math.random() * (opts.jitter || 60), ph: Math.random() * 100 };
        if (k === 'ember') Object.assign(d, { vx: Math.cos(a) * sp * 0.8, vy: -0.4 - Math.random() * 0.8, g: -0.004, life: 700 + Math.random() * 700, drag: 0.97 });
        else if (k === 'shard') Object.assign(d, { vx: Math.cos(a) * sp * 1.6, vy: -1.4 - Math.random() * 1.4, g: 0.11, life: 650 + Math.random() * 350, floor: gy + Math.random() * 6 });
        else if (k === 'debris') Object.assign(d, { vx: Math.cos(a) * sp * 1.3, vy: -1.6 - Math.random() * 1.6, g: 0.13, life: 800 + Math.random() * 300, floor: gy + Math.random() * 6 - 2 });
        else if (k === 'drop') Object.assign(d, { vx: Math.cos(a) * sp * 1.2, vy: -1.8 - Math.random() * 1.6, g: 0.12, life: 900, floor: gy + Math.random() * 6 - 2 });
        else if (k === 'spark') Object.assign(d, { vx: Math.cos(a) * sp * 2.6, vy: Math.sin(a) * sp * 1.8 - 0.6, g: 0.05, life: 200 + Math.random() * 160, drag: 0.93 });
        else if (k === 'mote') Object.assign(d, { x: x + Math.cos(a) * (18 + Math.random() * 16), y: y + Math.sin(a) * (10 + Math.random() * 8), cx: x, cy: y, life: 420 + Math.random() * 300, ph: a });
        else if (k === 'sparkle') Object.assign(d, { x: x + (Math.random() - 0.5) * (opts.spread || 26), y: y - Math.random() * 22, vx: 0, vy: -0.15 - Math.random() * 0.25, life: 600 + Math.random() * 600 });
        else if (k === 'smoke') Object.assign(d, { vx: (Math.random() - 0.5) * 0.25, vy: -0.12 - Math.random() * 0.1, life: 360 + Math.random() * 240 });
        else if (k === 'crackle') Object.assign(d, { x: x + (Math.random() - 0.5) * 22, y: gy + (Math.random() - 0.5) * 8, life: 380 + Math.random() * 300 });
        this.addBit(d);
      }
    }
    drawBits(now) {
      if (!this.bits || !this.bits.length) return;
      const ctx = this.ctx;
      this.bits = this.bits.filter((b) => now - b.t0 < b.life);
      for (const b of this.bits) {
        const t = now - b.t0;
        if (t < 0) { b.lt = now; continue; }
        const dt = Math.min(3, (now - b.lt) / 16);
        b.lt = now;
        const k = t / b.life, R = b.ramp, st = Math.floor(t / STEP);
        if (b.k !== 'mote') {
          b.vy += b.g * dt;
          if (b.drag) { const f = Math.pow(b.drag, dt); b.vx *= f; b.vy *= f; }
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.floor != null && b.y >= b.floor && b.vy > 0) {
            if (b.k === 'drop') { b.k = 'splash'; b.t0 = now; b.life = 140; b.y = b.floor; continue; }
            b.y = b.floor; b.vy *= -0.35; b.vx *= 0.5; b.bounce = (b.bounce || 0) + 1;
            if (b.bounce > 2) { b.vy = 0; b.g = 0; b.vx = 0; }
          }
        }
        const x = Math.round(b.x), y = Math.round(b.y);
        const col = (o = 0) => R[Math.max(0, Math.min(R.length - 1, Math.floor(k * 4) + o))];
        switch (b.k) {
          case 'ember': {
            // A licking flame that shrinks to a fleck and blinks out.
            if (k > 0.6 && (st + Math.floor(b.ph)) % 3 === 0) break;
            const sx = x + Math.round(Math.sin(t / 130 + b.ph) * 2);
            if (k < 0.3) {
              ctx.fillStyle = R[3]; ctx.fillRect(sx, y, 2, 1);
              ctx.fillStyle = R[1]; ctx.fillRect(sx, y - 1, 2, 1);
              ctx.fillStyle = R[0]; ctx.fillRect(sx + (st & 1), y - 2, 1, 1);
            } else if (k < 0.6) {
              ctx.fillStyle = R[3]; ctx.fillRect(sx, y, 2, 1);
              ctx.fillStyle = R[2]; ctx.fillRect(sx, y - 1, 1, 1);
            } else { ctx.fillStyle = col(1); ctx.fillRect(sx, y, 1, 1); }
            break;
          }
          case 'shard': {
            // A tumbling crystal splinter: dark edge, bright body, white tip that glints.
            const o = (st + Math.floor(b.ph)) % 4;
            const [dx, dy] = [[1, -1], [1, 0], [1, 1], [0, 1]][o];
            if (k > 0.75 && st % 2) break;
            ctx.fillStyle = R[4]; ctx.fillRect(x - 2 * dx + (dy ? 1 : 0), y - 2 * dy + (dx ? 1 : 0), 1, 1);
            ctx.fillStyle = R[3]; ctx.fillRect(x - 2 * dx, y - 2 * dy, 1, 1); ctx.fillRect(x - dx + (dy ? 1 : 0), y - dy + (dx ? 1 : 0), 1, 1);
            ctx.fillStyle = R[1]; ctx.fillRect(x - dx, y - dy, 1, 1); ctx.fillRect(x, y, 1, 1);
            ctx.fillStyle = o === 0 || k < 0.15 ? '#ffffff' : R[1]; ctx.fillRect(x + dx, y + dy, 1, 1);
            break;
          }
          case 'debris': {
            if (k > 0.75 && st % 2) break;
            const big = (b.ph | 0) % 3 === 0;
            ctx.fillStyle = '#3e3230'; ctx.fillRect(x, y, big ? 3 : 2, 2);
            ctx.fillStyle = b.bounce ? '#7a665a' : '#9c8674'; ctx.fillRect(x, y, big ? 2 : 1, 1);
            break;
          }
          case 'drop': {
            ctx.fillStyle = R[3]; ctx.fillRect(x, y, 2, 2);
            ctx.fillStyle = R[1]; ctx.fillRect(x, y - 1, 1, 2);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
            break;
          }
          case 'splash': {
            ctx.fillStyle = R[1];
            ctx.fillRect(x - 3, y - 2, 1, 1); ctx.fillRect(x + 3, y - 2, 1, 1);
            ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1);
            ctx.fillStyle = R[3]; ctx.fillRect(x - 2, y, 5, 1);
            break;
          }
          case 'spark': {
            ctx.fillStyle = col(1);
            PXD.line(ctx, x - b.vx * 2.5, y - b.vy * 2.5, x, y, 1);
            ctx.fillStyle = k < 0.5 ? '#ffffff' : col(0);
            ctx.fillRect(x, y, k < 0.3 ? 2 : 1, k < 0.3 ? 2 : 1);
            break;
          }
          case 'mote': {
            // Light swallowed: a speck spirals into the centre and goes out.
            const e = k * k;
            const a = b.ph + k * 2.2;
            const r = 1 - e;
            const mx = Math.round(b.cx + (b.x0 - b.cx) * r * Math.cos(k * 1.4) - (b.y0 - b.cy) * r * Math.sin(k * 1.4) * 0.5);
            const my = Math.round(b.cy + (b.y0 - b.cy) * r + Math.sin(a) * r * 2);
            ctx.fillStyle = '#0a0612';
            ctx.fillRect(mx, my, 2, 2);
            ctx.fillStyle = R[Math.min(5, Math.floor(k * 4))];
            ctx.fillRect(mx, my, 1, 1);
            if (k < 0.5) { ctx.fillStyle = R[3]; ctx.fillRect(mx + 2, my, 1, 1); }
            break;
          }
          case 'sparkle': {
            const s = [0, 1, 2, 3, 2, 1, 0, 1][(st + Math.floor(b.ph)) % 8];
            if (k > 0.8 && st % 2) break;
            star(ctx, x, y, s, '#ffffff', col(1));
            break;
          }
          case 'smoke': {
            // A puff that swells and greys out.
            if (k > 0.7 && st % 2) break;
            const S = RAMPS.slash;
            if (k < 0.3) { ctx.fillStyle = S[2]; ctx.fillRect(x, y, 2, 2); ctx.fillStyle = S[0]; ctx.fillRect(x, y, 1, 1); }
            else { ctx.fillStyle = k < 0.65 ? S[3] : S[4]; ctx.fillRect(x - 1, y, 3, 2); ctx.fillRect(x, y - 1, 1, 1); ctx.fillStyle = k < 0.65 ? S[2] : S[3]; ctx.fillRect(x - 1, y, 1, 1); }
            break;
          }
          case 'crackle': {
            if (st % 3 === 2) break;
            ctx.fillStyle = col(1);
            poly(ctx, zig(Math.floor(b.ph * 10), st >> 1, x - 4, y, x + 4, y - 1, 3, 2), 1);
            break;
          }
        }
      }
    }

    // Field dim: colour-math darkening of everything under the effects (stepped like a palette fade).
    dimField(color = '#2a1040', amt = 0.5, ms = 900, fin = 140, fout = 320, delay = 0) {
      (this.dims || (this.dims = [])).push({ rgb: CT.PAL.hex(color), amt, t0: performance.now() + delay, ms, fin, fout });
    }
    drawDim(now) {
      if (!this.dims || !this.dims.length) return;
      this.dims = this.dims.filter((d) => now - d.t0 < d.ms);
      let best = null, lv = 0;
      for (const d of this.dims) {
        const t = now - d.t0;
        if (t < 0) continue;
        const l = d.amt * Math.max(0, Math.min(1, t / d.fin, (d.ms - t) / d.fout));
        if (l > lv) { lv = l; best = d; }
      }
      if (!best || lv < 0.06) return;
      const s = Math.round(lv * 8) / 8;
      const c = (v) => Math.round(255 + (v - 255) * s);
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${c(best.rgb[0])},${c(best.rgb[1])},${c(best.rgb[2])})`;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }

    // Lightning from the sky: a forked channel that re-forms every other step.
    skyBolt(x, y, opts = {}) {
      this.bolts.push({ x: Math.round(x), y: Math.round(y), t0: performance.now() + (opts.delay || 0), ms: opts.ms || 300, seed: (Math.random() * 9999) | 0, w: opts.w || 3, ramp: opts.ramp || RAMPS.lightning, top: opts.top != null ? opts.top : -8 });
    }
    drawBolt(b, now) {
      const t = now - b.t0;
      if (t < 0) return;
      const st = Math.floor(t / STEP);
      if (st % 4 === 3 && st > 2) return; // strobe
      const ctx = this.ctx, R = b.ramp;
      const ph = st >> 1;
      const x0 = b.x + (hashI(b.seed, 0, 1) - 0.5) * 50;
      const pts = zig(b.seed, ph, x0, b.top, b.x, b.y, 11, 7);
      const forks = [];
      for (let f = 0; f < 2; f++) {
        const j = 1 + Math.floor(hashI(b.seed, ph, 90 + f) * Math.max(1, pts.length - 3));
        const [fx, fy] = pts[j];
        const dir = f ? 1 : -1;
        forks.push(zig(b.seed + 7 * f, ph, fx, fy, fx + dir * (14 + hashI(b.seed, f) * 16), fy + 18 + hashI(b.seed, f, 3) * 14, 6, 4));
      }
      const fat = st < 2;
      ctx.fillStyle = R[3];
      poly(ctx, pts, fat ? b.w + 2 : b.w);
      ctx.fillStyle = R[2];
      for (const f of forks) poly(ctx, f, 1);
      ctx.fillStyle = R[1];
      poly(ctx, pts, fat ? 3 : 1);
      ctx.fillStyle = '#ffffff';
      poly(ctx, pts, 1);
      if (st < 5) {
        // Strike point: a hot cross and a ground ring.
        star(ctx, b.x, b.y, st < 2 ? 4 : 2, '#ffffff', R[1]);
        ctx.fillStyle = R[2];
        PXD.ellipseRing(ctx, b.x, b.y + 1, 4 + st * 3, 2 + Math.round(st * 1.5));
      }
    }

    // Spectacle staging for an effect sheet (CT.FX_STAGE[key], see public/js/sheets/fx_*.js):
    //   at: frame the bits fire on (default the sheet's impact frame), elem: palette ramp,
    //   y: height above ground of the burst centre, ring / wave: impact ring radius (chest /
    //   ground), bits: { ember|shard|debris|drop|spark|mote|sparkle|crackle: n },
    //   bolt: n sky bolts (boltAt), dim: [colour, amount, ms], big: full-screen moment
    //   (bigAt, bigMs), all: true to run dim/big on every tile instead of once per area,
    //   spawn: [{ fx, at, all }] (another sheet on the same spot from frame `at`; first tile only
    //   unless all), also: [more stages] (later beats: a shatter, a second burst), trail (on a proj sheet:
    //   the bit kind it sheds in flight).
    stageFx(key, st, fx, x, y, h, opts) {
      const first = !opts.noShake;
      const d0 = opts.delay || 0;
      const at = (i) => d0 + fx.frames.slice(0, Math.max(0, i)).reduce((a, f) => a + f.ms, 0);
      const imp = st.at != null ? st.at : fx.def.impact != null ? fx.def.impact : 0;
      const pos = () => {
        if (opts.unit) { const [sx, sy] = this.unitScreenPos(opts.unit); return [sx, sy]; }
        return this.project(x, y, h);
      };
      const R = rampOf(st.elem || 'hit');
      if (st.dim && (first || st.all)) this.dimField(st.dim[0], st.dim[1], st.dim[2] || 900, st.dim[3] || 140, 320, d0 + (st.dimAt != null ? at(st.dimAt) : 0));
      if (st.big && first) setTimeout(() => this.bigFx(st.big, st.bigMs || 1000, { key, x, y, h, unit: opts.unit }), at(st.bigAt != null ? st.bigAt : 0));
      if (st.bolt) {
        const n = first ? st.bolt : Math.max(0, st.bolt - 1);
        setTimeout(() => { const [sx, sy] = pos(); for (let i = 0; i < n; i++) this.skyBolt(sx + (i ? (Math.random() - 0.5) * 16 : 0), sy - (st.boltY || 0), { delay: i * 70, ramp: R, ms: st.boltMs || 300 }); }, at(st.boltAt != null ? st.boltAt : imp) - (st.lead || 0));
      }
      for (const s2 of st.also || []) this.stageFx(key, Object.assign({ elem: st.elem, y: st.y }, s2), fx, x, y, h, opts);
      // Follow-up hand-drawn sheets on the same spot (a geyser after the splash, a shatter after the freeze).
      for (const sp of st.spawn || []) if (first || sp.all) setTimeout(() => this.playFx(sp.fx, x, y, h, { flip: opts.flip, noShake: !first, unit: opts.unit }), at(sp.at || 0));
      setTimeout(() => {
        const [sx, gy] = pos();
        const cy = gy - (st.y != null ? st.y : 12);
        const now = performance.now();
        if (st.ring) this.rings.push({ x: Math.round(sx), y: Math.round(cy), t0: now, ms: st.ringMs || 300, r: Math.round(st.ring / (first ? 1 : 1.5)), ramp: R, two: true });
        if (st.wave && (first || st.all)) this.rings.push({ x: Math.round(sx), y: Math.round(gy), t0: now, ms: st.waveMs || 420, r: st.wave, ramp: R, flat: true, two: true });
        for (const [k, n0] of Object.entries(st.bits || {})) {
          const n = first ? n0 : Math.ceil(n0 * 0.5);
          this.scatter(k, n, sx, k === 'mote' ? cy - 4 : cy, gy, k === 'debris' ? RAMPS.slash : R, { spread: st.spread, speed: st.speed });
        }
      }, at(imp));
    }

    // Hand-pixelled effect sheet (CT.fxSheet). At a tile (x, y, h), or following a unit
    // (opts.unit). opts: { flip, delay, from: [x, y, h] (projectile start: the sheet
    // travels from there to the tile over opts.travel ms) }. Resolves when it ends.
    playFx(key, x, y, h, opts = {}) {
      const fx = CT.getFx && CT.getFx(key);
      if (!fx) return 0;
      const e = { fx, x, y, h, u: opts.unit || null, flip: !!opts.flip, t0: performance.now() + (opts.delay || 0), from: opts.from, travel: opts.travel || 0 };
      e.until = e.travel || opts.ms || fx.total;
      this.sheetFx.push(e);
      const d = fx.def;
      if (d.shake && !opts.noShake) setTimeout(() => this.shake(d.shake), (opts.delay || 0) + (d.shakeAt != null ? fx.frames.slice(0, d.shakeAt).reduce((a, f) => a + f.ms, 0) : 0));
      if (d.flash && !opts.noShake) setTimeout(() => this.flashScreen(CT.PAL.hex(d.flash).join(','), 140, 0.6), (opts.delay || 0) + (d.flashAt != null ? fx.frames.slice(0, d.flashAt).reduce((a, f) => a + f.ms, 0) : 0));
      const st = CT.FX_STAGE && CT.FX_STAGE[key];
      if (st && !e.travel) this.stageFx(key, st, fx, x, y, h, opts);
      else if (st && e.travel && st.trail) e.trail = st;
      return (opts.delay || 0) + e.until;
    }
    drawSheetFx(e, now) {
      const t = now - e.t0;
      if (t < 0) return;
      const fr = CT.fxFrame(e.fx, e.fx.def.loop || e.travel || e.until > e.fx.total ? t % e.fx.total : t);
      if (!fr) return;
      let sx, sy;
      if (e.u) {
        [sx, sy] = this.unitScreenPos(e.u);
      } else if (e.from && e.travel) {
        const k = Math.min(1, t / e.travel);
        const a = this.project(e.from[0], e.from[1], e.from[2]);
        const b = this.project(e.x, e.y, e.h);
        sx = a[0] + (b[0] - a[0]) * k;
        sy = a[1] + (b[1] - a[1]) * k - Math.sin(k * Math.PI) * (e.fx.def.arc || 0);
      } else [sx, sy] = this.project(e.x, e.y, e.h);
      let img = fr.img;
      const [ax, ay] = e.fx.anchor;
      let ox = ax;
      if (e.flip) {
        img = fr.mirror || (fr.mirror = CT.PX.mirror(fr.img));
        ox = img.width - 1 - ax;
      }
      this.ctx.drawImage(img, Math.round(sx - ox + (e.flip ? -fr.dx : fr.dx)), Math.round(sy - ay + fr.dy));
      if (e.trail) {
        // Projectile trail: one puff / glint / ember per step along the flight.
        const st = Math.floor(t / STEP);
        if (st !== e.tst) {
          e.tst = st;
          const tr = e.trail;
          this.scatter(tr.trail, tr.trailN || 1, sx, sy - (tr.trailY || 0), sy + 12, rampOf(tr.elem || 'hit'), { spread: 3, speed: 0.3, jitter: 1 });
        }
      }
    }

    projectile(from, to, kind, dur) {
      this.shots.push({ from, to, kind, t0: performance.now(), dur, ramp: rampOf(kind), last: 0 });
    }

    addRift(x, y, h, opts = {}) {
      const r = { x, y, h, t0: performance.now(), grey: opts.grey !== false, size: opts.size || 1, id: opts.id || 'rift' };
      this.rifts.push(r);
      return r;
    }
    removeRift(id) {
      this.rifts = this.rifts.filter((r) => r.id !== id);
    }
    // Time tear: a pixel lens of grey static with red scanlines (or a blue gate).
    drawRift(r, now) {
      const ctx = this.ctx;
      const [sx0, sy0] = this.project(r.x, r.y, r.h);
      const sx = Math.round(sx0);
      const grow = Math.max(0.05, Math.min(1, (now - r.t0) / 600)) * r.size;
      const w = 11 * grow;
      const hgt = Math.max(2, Math.round(23 * grow));
      const cy = Math.round(sy0) - 17;
      const par = Math.floor(now / 90) % 2;
      // dithered glow
      ctx.fillStyle = r.grey ? '#a02030' : '#3c64b4';
      for (let y = -hgt - 4; y <= hgt + 4; y++)
        for (let x = -Math.round(w) - 5; x <= Math.round(w) + 5; x++)
          if (((x + y + par) & 1) === 0 && (x * x) / ((w + 5) * (w + 5)) + (y * y) / ((hgt + 4) * (hgt + 4)) < 1) ctx.fillRect(sx + x, cy + y, 1, 1);
      for (let y = -hgt; y <= hgt; y++) {
        const t = (y + hgt) / (hgt * 2);
        const hw = Math.round(Math.sin(t * Math.PI) * w * (0.85 + 0.15 * Math.sin(now / 90 + y)));
        if (hw <= 0) continue;
        ctx.fillStyle = '#0a0612';
        ctx.fillRect(sx - hw - 1, cy + y, hw * 2 + 2, 1);
        const band = (y + Math.floor(now / 40)) % 4;
        ctx.fillStyle = r.grey ? (band < 2 ? '#d43c3c' : '#6e7090') : band < 2 ? '#8cc0f0' : '#2c4488';
        ctx.fillRect(sx - hw, cy + y, hw * 2, 1);
        if ((y & 1) === 0) {
          ctx.fillStyle = r.grey ? '#bcc0d4' : '#c4e4ff';
          ctx.fillRect(sx - hw + Math.floor(hash(y, Math.floor(now / 70), 3) * hw * 2), cy + y, 2, 1);
        }
      }
    }

    // Destruction Rain: needles falling onto a set of tiles.
    rain(tiles) {
      const now = performance.now();
      for (const t of tiles) {
        const [sx, sy] = this.project(t.x, t.y, this.tileHeight(t));
        for (let i = 0; i < 3; i++) this.rains.push({ x: Math.round(sx + (Math.random() - 0.5) * 15), y: Math.round(sy), t0: now + i * 90 + Math.random() * 200, ms: 380 });
      }
    }

    // Full-screen tech spectacles (see BIG): 'luminaire', 'blackhole', 'darkmatter', 'eclipse',
    // 'erase', and the positioned moments the effect stages call ('singularity', 'dm_burst',
    // 'corerain', 'xslash', 'storm', 'frost', 'bloom', 'gale', 'shock', 'inferno', 'psy', 'prism', 'laser').
    // `at` ({ key, x, y, h, unit }) centres it on that effect; otherwise on the acting unit.
    bigFx(kind, ms = 1400, at = null) {
      const now = performance.now();
      const b = { kind, t0: now, ms, at, seed: (Math.random() * 9999) | 0, fired: {} };
      if (!at) {
        const a = this.world && this.world.active;
        if (a && a._sx != null) b.c = [a._sx, a._sy - 18];
      }
      this.big.push(b);
      const P = BIG[kind];
      if (!P) return;
      if (P.dim) this.dimField(P.dim[0], P.dim[1], ms + (P.dim[2] || 600), 160, 420);
      if (P.lb) b.lb = 1;
      if (P.shake) setTimeout(() => this.shake(P.shake[0], P.shake[1]), P.shake[2] * ms);
      if (P.flash) setTimeout(() => this.flashScreen(P.flash[0], P.flash[1], 0.8), P.flash[2] * ms);
    }
    bigCentre(b) {
      const a = b.at;
      if (a && a.unit) { const [x, y] = this.unitScreenPos(a.unit); return [Math.round(x), Math.round(y) - 16]; }
      if (a && a.key) {
        let n = 0, sx = 0, sy = 0;
        for (const e of this.sheetFx) if (e.fx.def.key === a.key && !e.u) { const [x, y] = this.project(e.x, e.y, e.h); sx += x; sy += y; n++; }
        if (n) return (b.last = [Math.round(sx / n), Math.round(sy / n) - 12]);
        if (b.last) return b.last;
        const [x, y] = this.project(a.x, a.y, a.h);
        return [Math.round(x), Math.round(y) - 12];
      }
      return b.c || [this.W >> 1, (this.H >> 1) - 10];
    }
    drawBig(b, now) {
      const ctx = this.ctx;
      const t = now - b.t0;
      const k = t / b.ms;
      if (k < 0 || k > 1) return;
      const W = this.W, H = this.H;
      const st = Math.floor(t / STEP);
      const [cx, cy] = this.bigCentre(b);
      const once = (id, fn) => { if (!b.fired[id]) { b.fired[id] = 1; fn(); } };
      const G = RAMPS.lightning, V = RAMPS.shadow;
      switch (b.kind) {
        case 'luminaire': {
          const g = 0.33;
          if (k < g) {
            // Needles of light rush in from the whole screen to Crono's sword.
            const q = k / g;
            for (let i = 0; i < 16; i++) {
              const a = (i / 16) * TAU + 0.2;
              const r0 = 230 * (1 - q) * (0.7 + 0.3 * hashI(i, 5)) + 6;
              ctx.fillStyle = i % 2 ? G[2] : G[3];
              PXD.line(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6, cx + Math.cos(a) * (r0 + 8 + q * 10), cy + Math.sin(a) * (r0 + 8 + q * 10) * 0.6, 1);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(Math.round(cx + Math.cos(a) * r0), Math.round(cy + Math.sin(a) * r0 * 0.6), 1, 1);
            }
            const r = 1 + Math.floor(q * 5);
            ctx.fillStyle = G[2];
            PXD.ellipseRing(ctx, cx, cy, r + 2, r + 2);
            ctx.fillStyle = '#ffffff';
            PXD.disc(ctx, cx, cy, r);
            star(ctx, cx, cy, 3 + Math.floor(q * 12), '#ffffff', G[1]);
          } else {
            const s = (k - g) / (1 - g);
            for (let j = 0; j < 3; j++) {
              const rr = s * 1.25 - j * 0.2;
              if (rr <= 0 || rr > 1) continue;
              const rx = Math.round(16 + rr * 320), ry = Math.round(rx * 0.5);
              ctx.fillStyle = G[Math.min(4, Math.floor(rr * 5))];
              PXD.ellipseRing(ctx, cx, cy + 14, rx, ry);
              PXD.ellipseRing(ctx, cx, cy + 14, rx - 1, ry - 1);
              ctx.fillStyle = '#ffffff';
              if (rr < 0.4) PXD.ellipseRing(ctx, cx, cy + 14, rx - 3, ry - 2);
            }
            if (s < 0.75) {
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * TAU + s * 0.6;
                const L = 30 + s * 300;
                const x1 = cx + Math.cos(a) * L, y1 = cy + Math.sin(a) * L * 0.62;
                ctx.fillStyle = G[2];
                PXD.line(ctx, cx + Math.cos(a) * 10, cy + Math.sin(a) * 6, x1, y1, s < 0.4 ? 3 : 1);
                if (s < 0.5) { ctx.fillStyle = '#ffffff'; PXD.line(ctx, cx + Math.cos(a) * 10, cy + Math.sin(a) * 6, x1, y1, 1); }
              }
            }
            for (let i = 0; i < 40; i++) {
              const p = (st + i * 3) % 10;
              if (p > 5 || hashI(i, b.seed) * 1.2 > s + 0.3) continue;
              star(ctx, Math.round(hashI(i, 1, b.seed) * W), Math.round(hashI(i, 2, b.seed) * H * 0.9), [0, 1, 2, 3, 2, 1][p], '#ffffff', G[2]);
            }
          }
          break;
        }
        case 'blackhole':
        case 'darkmatter': {
          // Light drains toward the caster: specks of the field streak in and go out.
          for (let i = 0; i < 44; i++) {
            const p = ((t / 700 + hashI(i, b.seed)) % 1);
            const a = hashI(i, 3, b.seed) * TAU + p * (b.kind === 'blackhole' ? 2.4 : -1.6);
            const r = (1 - p * p) * (170 + hashI(i, 4) * 120);
            const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.62);
            ctx.fillStyle = V[Math.min(5, Math.floor(p * 4))];
            ctx.fillRect(x, y, p < 0.5 ? 2 : 1, 1);
            ctx.fillStyle = p > 0.7 ? '#0a0612' : V[0];
            ctx.fillRect(x, y, 1, 1);
          }
          if (b.kind === 'darkmatter') {
            // A dark sun forms over Magus, cracking with violet light.
            const r = Math.min(14, 2 + st);
            ctx.fillStyle = V[2];
            PXD.ellipseRing(ctx, cx, cy - 26, r + 2, r + 2);
            ctx.fillStyle = '#0a0612';
            PXD.disc(ctx, cx, cy - 26, r);
            ctx.fillStyle = V[0];
            ctx.fillRect(cx - (r >> 1), cy - 26 - (r >> 1), 2, 1);
            if (st % 2 === 0) {
              ctx.fillStyle = V[1];
              for (let i = 0; i < 3; i++) { const a = hashI(st, i, b.seed) * TAU; poly(ctx, zig(b.seed + i, st, cx + Math.cos(a) * r, cy - 26 + Math.sin(a) * r, cx + Math.cos(a) * (r + 14), cy - 26 + Math.sin(a) * (r + 14), 4, 3), 1); }
            }
          } else {
            const r = Math.min(8, 1 + (st >> 1));
            ctx.fillStyle = V[1];
            PXD.ellipseRing(ctx, cx, cy, r + 1, r + 1);
            ctx.fillStyle = '#0a0612';
            PXD.disc(ctx, cx, cy, r);
          }
          break;
        }
        case 'singularity': {
          // Accretion spiral around a black core, collapsing to a point at the end.
          const env = k < 0.2 ? k / 0.2 : k > 0.82 ? Math.max(0, (1 - k) / 0.18) : 1;
          const R0 = 40 * env;
          for (let arm = 0; arm < 3; arm++)
            for (let j = 0; j < 28; j++) {
              const u = j / 28;
              const a = (arm * TAU) / 3 + st * 0.24 + u * 4.4;
              const r = R0 * (1.15 - u) + 3;
              const x = Math.round(cx + Math.cos(a) * r * 1.35), y = Math.round(cy + Math.sin(a) * r * 0.55);
              ctx.fillStyle = (j + st) % 7 === 0 ? '#ffffff' : V[Math.max(0, 3 - Math.floor(u * 4))];
              ctx.fillRect(x, y, u < 0.45 ? 2 : 1, u < 0.25 ? 2 : 1);
            }
          // Accretion disc: two dashed rings turning against each other.
          ctx.fillStyle = V[1];
          dashRing(ctx, cx, cy, Math.round(R0 * 1.1) + 4, Math.round(R0 * 0.4) + 2, 64, st, 0, 3, 4);
          ctx.fillStyle = V[3];
          dashRing(ctx, cx, cy, Math.round(R0 * 0.75) + 3, Math.round(R0 * 0.28) + 2, 48, 1000 - st, 0, 2, 3);
          const hr = Math.max(1, Math.round(R0 * 0.32));
          ctx.fillStyle = V[0];
          PXD.ellipseRing(ctx, cx, cy, hr + 1, Math.round(hr * 0.7) + 1);
          ctx.fillStyle = '#0a0612';
          PXD.ellipse(ctx, cx, cy, hr, Math.round(hr * 0.7));
          if (st % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - (hr >> 1), cy - (hr >> 1), 1, 1); }
          if (k > 0.9) star(ctx, cx, cy, Math.round((1 - k) * 60), '#ffffff', V[0]);
          break;
        }
        case 'dm_burst': {
          // A sphere of dark matter swells over the cross, then breaks into a ring of light.
          if (k < 0.5) {
            const q = k / 0.5;
            const rx = Math.round(10 + q * 64), ry = Math.round(rx * 0.62);
            ctx.fillStyle = '#0a0612';
            PXD.ellipse(ctx, cx, cy, rx, ry);
            ctx.fillStyle = V[3];
            PXD.ellipseRing(ctx, cx, cy, rx, ry);
            ctx.fillStyle = V[1];
            PXD.ellipseRing(ctx, cx, cy, rx + 2, ry + 1);
            ctx.fillStyle = V[3];
            dashRing(ctx, cx, cy, Math.round(rx * 0.7), Math.round(ry * 0.7), 40, st, 0, 4, 6);
            ctx.fillStyle = V[2];
            dashRing(ctx, cx, cy, Math.round(rx * 0.45), Math.round(ry * 0.45), 28, 1000 - st, 0, 3, 5);
            ctx.fillStyle = V[0];
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * TAU + st * 0.3;
              poly(ctx, zig(b.seed + i, st >> 1, cx, cy, cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9, 5, 3), 1);
            }
          } else {
            const q = (k - 0.5) / 0.5;
            for (let j = 0; j < 2; j++) {
              const rr = q * 1.2 - j * 0.25;
              if (rr <= 0 || rr > 1) continue;
              const rx = Math.round(70 + rr * 240), ry = Math.round(rx * 0.5);
              ctx.fillStyle = j ? V[2] : rr < 0.3 ? '#ffffff' : V[0];
              PXD.ellipseRing(ctx, cx, cy, rx, ry);
              PXD.ellipseRing(ctx, cx, cy, rx - 1, ry - 1);
            }
            const r2 = Math.round(64 * (1 - q));
            if (r2 > 2) { ctx.fillStyle = '#0a0612'; PXD.ellipseRing(ctx, cx, cy, r2, Math.round(r2 * 0.62)); }
          }
          break;
        }
        case 'eclipse': {
          // The moon slides over the sun; a diamond ring flares; Crono and Frog cut through.
          const sx = W >> 1, sy = 56;
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU + st * 0.05;
            const L = 18 + ((i + st) % 3) * 3;
            ctx.fillStyle = G[i % 2 ? 2 : 3];
            PXD.line(ctx, sx + Math.cos(a) * 15, sy + Math.sin(a) * 15, sx + Math.cos(a) * L, sy + Math.sin(a) * L, 1);
          }
          ctx.fillStyle = G[1];
          PXD.disc(ctx, sx, sy, 14);
          const mx = Math.round(sx - 60 + Math.min(1, k / 0.42) * 60);
          ctx.fillStyle = '#0a0612';
          PXD.disc(ctx, mx, sy, 14);
          ctx.fillStyle = V[2];
          ringArc(ctx, mx, sy, 14, 14, 0);
          if (k > 0.42 && k < 0.6) star(ctx, sx + 10, sy - 10, 6 + (st % 2) * 3, '#ffffff', G[0]);
          const rw = Math.round(W * Math.min(1, k * 2.2));
          ctx.fillStyle = '#0a0612';
          ctx.fillRect(Math.round(W / 2 - rw / 2), Math.round(H * 0.3) - 3, rw, 6);
          ctx.fillStyle = V[3];
          ctx.fillRect(Math.round(W / 2 - rw / 2), Math.round(H * 0.3) - 4, rw, 1);
          if (k > 0.45) {
            const s = Math.min(1, (k - 0.45) / 0.3);
            const fade = k > 0.85;
            for (const [w, col] of fade ? [[1, V[1]]] : [[5, V[2]], [3, V[0]], [1, '#ffffff']]) {
              ctx.fillStyle = col;
              PXD.line(ctx, W * 0.1, H * 0.08, W * 0.1 + s * W * 0.75, H * 0.08 + s * H * 0.86, w);
              PXD.line(ctx, W * 0.9, H * 0.08, W * 0.9 - s * W * 0.75, H * 0.08 + s * H * 0.86, w);
            }
          }
          break;
        }
        case 'erase': {
          // The archive deletes the era: white scan-tears sweep the screen, glyphs flake away.
          const S = RAMPS.slash;
          for (let y = 0; y < H; y += 3) {
            const p = hashI(y, b.seed);
            const len = Math.round(Math.max(0, k * 1.6 - p * 0.6) * W);
            if (len <= 0) continue;
            const dir = hashI(y, 7) < 0.5;
            ctx.fillStyle = (y + st) % 6 < 3 ? '#ffffff' : S[1];
            ctx.fillRect(dir ? 0 : W - len, y, len, (y / 3 + st) % 4 === 0 ? 2 : 1);
          }
          for (let i = 0; i < 40; i++) {
            const p = (t / 900 + hashI(i, b.seed)) % 1;
            const x = Math.round(hashI(i, 1, b.seed) * W), y = Math.round(H * (1 - p) - 10);
            glyph(ctx, RUNES[i % RUNES.length], x, y, i % 3 ? S[3] : S[4], null);
          }
          if (k < 0.3) { ctx.fillStyle = S[4]; PXD.line(ctx, 0, cy, W, cy, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, cy - 1, Math.round(W * k / 0.3), 3); }
          break;
        }
        case 'corerain': {
          // The core screams: red needles rain diagonally across the whole field.
          const L = RAMPS.lavos;
          for (let i = 0; i < 46; i++) {
            const p = (t / 520 + hashI(i, b.seed)) % 1;
            if (k > 0.85 && hashI(i, 9) > (1 - k) / 0.15) continue;
            const gx = hashI(i, 1, b.seed) * (W + 120);
            const gyy = 60 + hashI(i, 2, b.seed) * (H - 70);
            const y = Math.round(-20 + (gyy + 20) * p), x = Math.round(gx - (gyy - y) * 0.35);
            if (p > 0.92) { star(ctx, Math.round(gx - 0), Math.round(gyy), 2, L[0], L[1]); continue; }
            ctx.fillStyle = L[3];
            PXD.line(ctx, x + 5, y - 14, x, y, 3);
            ctx.fillStyle = L[1];
            PXD.line(ctx, x + 5, y - 14, x, y, 1);
            ctx.fillStyle = L[0];
            ctx.fillRect(x, y, 1, 1);
          }
          break;
        }
        case 'xslash': {
          // Two giant blade cuts cross over the target.
          const S = RAMPS.slash;
          const cut = (x0, y0, x1, y1, s0) => {
            const s = Math.max(0, Math.min(1, (k - s0) / 0.12));
            if (s <= 0) return;
            const x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s;
            const thin = k > 0.62;
            for (const [w, col] of thin ? [[1, S[2]]] : [[7, S[3]], [5, S[1]], [3, '#ffffff']]) {
              ctx.fillStyle = col;
              PXD.line(ctx, x0, y0, x, y, w);
            }
          };
          cut(cx - 110, cy - 70, cx + 110, cy + 70, 0);
          cut(cx + 110, cy - 70, cx - 110, cy + 70, 0.16);
          if (k > 0.28 && k < 0.5) star(ctx, cx, cy, 12 - (st % 3) * 3, '#ffffff', S[1]);
          break;
        }
        case 'storm': {
          // Rain lashes the field and lightning walks across it.
          const B = RAMPS.water;
          ctx.fillStyle = B[2];
          for (let i = 0; i < 70; i++) {
            const p = (t / 300 + hashI(i, b.seed)) % 1;
            const x = Math.round(hashI(i, 1, b.seed) * (W + 60) - p * 40), y = Math.round(p * (H + 20) - 10);
            ctx.fillRect(x, y, 1, 4);
          }
          for (let i = 0; i < 3; i++) {
            const at = 0.1 + i * 0.22;
            if (k > at) once('bolt' + i, () => this.skyBolt(cx + (hashI(i, b.seed) - 0.5) * 220, cy + (hashI(i, 2, b.seed) - 0.3) * 60, { ms: 260 }));
          }
          break;
        }
        case 'frost': {
          // Frost ferns creep in from the screen edges, then shatter.
          const I = RAMPS.ice;
          const grow = Math.min(1, k / 0.55);
          const brk = k > 0.8;
          for (let i = 0; i < 16; i++) {
            const side = i % 4;
            const p = hashI(i, b.seed);
            const [x0, y0, a] = side === 0 ? [p * W, 0, Math.PI / 2] : side === 1 ? [p * W, H, -Math.PI / 2] : side === 2 ? [0, p * H, 0] : [W, p * H, Math.PI];
            const L = (24 + hashI(i, 3) * 40) * grow;
            const a2 = a + (hashI(i, 4) - 0.5) * 0.6;
            const x1 = x0 + Math.cos(a2) * L, y1 = y0 + Math.sin(a2) * L;
            ctx.fillStyle = brk && st % 2 ? I[3] : I[1];
            PXD.line(ctx, x0, y0, x1, y1, brk ? 1 : 2);
            ctx.fillStyle = I[2];
            for (let s = 6; s < L; s += 6) {
              const bx = x0 + Math.cos(a2) * s, by = y0 + Math.sin(a2) * s;
              const bl = Math.min(8, (L - s) * 0.5);
              PXD.line(ctx, bx, by, bx + Math.cos(a2 + 1.05) * bl, by + Math.sin(a2 + 1.05) * bl, 1);
              PXD.line(ctx, bx, by, bx + Math.cos(a2 - 1.05) * bl, by + Math.sin(a2 - 1.05) * bl, 1);
            }
            if (!brk) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x1), Math.round(y1), 1, 1); }
          }
          for (let i = 0; i < 26; i++) {
            const p = (t / 1400 + hashI(i, b.seed, 5)) % 1;
            star(ctx, Math.round(hashI(i, 6, b.seed) * W + Math.sin(t / 300 + i) * 3), Math.round(p * H), (st + i) % 6 === 0 ? 1 : 0, '#ffffff', I[1]);
          }
          break;
        }
        case 'bloom': {
          // Shafts of green-gold light fall on the party; petals of light drift down.
          const Hh = RAMPS.heal;
          for (let i = 0; i < 5; i++) {
            const on = (st + i * 2) % 10 < 7 && k < 0.85;
            if (!on) continue;
            const x = Math.round(cx + (i - 2) * 26 + (hashI(i, b.seed) - 0.5) * 10);
            ctx.fillStyle = Hh[2];
            ctx.fillRect(x - 3, 0, 1, cy + 20);
            ctx.fillRect(x + 3, 0, 1, cy + 20);
            ctx.fillStyle = Hh[1];
            ctx.fillRect(x - 1, 0, 3, cy + 22);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, 0, 1, cy + 22);
          }
          for (let i = 0; i < 30; i++) {
            const p = (t / 1200 + hashI(i, b.seed)) % 1;
            star(ctx, Math.round(cx + (hashI(i, 1, b.seed) - 0.5) * 200 + Math.sin(t / 200 + i) * 4), Math.round(p * (cy + 30)), (st + i) % 5 === 0 ? 2 : 1, '#ffffff', Hh[i % 2 ? 1 : 2]);
          }
          break;
        }
        case 'gale':
        case 'shock':
        case 'psy':
        case 'inferno':
        case 'prism':
        case 'laser': {
          // Shockwave rings rolling out over the field (colours per element), plus a swirl for gale.
          const RR = b.kind === 'inferno' ? RAMPS.fire : b.kind === 'psy' ? RAMPS.charm : b.kind === 'prism' || b.kind === 'laser' ? RAMPS.laser : V;
          for (let j = 0; j < 3; j++) {
            const rr = k * 1.4 - j * 0.22;
            if (rr <= 0 || rr > 1) continue;
            const rx = Math.round(12 + rr * 200), ry = Math.round(rx * 0.5);
            ctx.fillStyle = RR[Math.min(5, Math.floor(rr * 5))];
            PXD.ellipseRing(ctx, cx, cy + 12, rx, ry);
            if (rr < 0.5) PXD.ellipseRing(ctx, cx, cy + 12, rx - 1, ry);
          }
          if (b.kind === 'gale')
            for (let arm = 0; arm < 4; arm++)
              for (let j = 0; j < 20; j++) {
                const u = j / 20;
                const a = (arm * TAU) / 4 - st * 0.3 + u * 3;
                const r = 14 + u * 90 * Math.min(1, k * 3);
                ctx.fillStyle = (j + st) % 6 === 0 ? '#ffffff' : V[Math.min(3, Math.floor(u * 4))];
                ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.5), u < 0.5 ? 3 : 2, u < 0.3 ? 2 : 1);
              }
          if (b.kind === 'prism' || b.kind === 'laser')
            for (let i = 0; i < 24; i++) {
              const p = (st + i * 2) % 8;
              if (p > 4) continue;
              star(ctx, Math.round(cx + (hashI(i, 1, b.seed) - 0.5) * 220), Math.round(cy + (hashI(i, 2, b.seed) - 0.5) * 120), [0, 1, 2, 1, 0][p], '#ffffff', RR[1 + (i % 3)]);
            }
          break;
        }
      }
    }
    // Cinematic letterbox for the biggest moments (stepped in and out).
    drawLetterbox(now) {
      let lv = 0;
      for (const b of this.big) {
        if (!b.lb) continue;
        const t = now - b.t0;
        lv = Math.max(lv, Math.min(1, t / 160, (b.ms - t) / 240));
      }
      if (lv <= 0) return;
      const h = Math.round(Math.ceil(lv * 6) / 6 * 22);
      this.ctx.fillStyle = '#0a0612';
      this.ctx.fillRect(0, 0, this.W, h);
      this.ctx.fillRect(0, this.H - h, this.W, h);
    }

    drawEffects(now) {
      const ctx = this.ctx;
      ctx.save();
      // Impact rings: expanding pixel rings walking down their ramp; `two` adds a trailing
      // inner ring, `flat` lies on the ground (a shockwave rolling over the tiles).
      this.rings = this.rings.filter((r) => now - r.t0 < r.ms);
      for (const r of this.rings) {
        const k = (now - r.t0) / r.ms;
        const rad = Math.max(1, Math.round(r.r * (0.3 + k * 0.7)));
        const sq = r.flat ? 0.5 : 0.75;
        ctx.fillStyle = rampAt(r.ramp, k);
        PXD.ellipseRing(ctx, r.x, r.y, rad, Math.max(1, Math.round(rad * sq)));
        if (r.two && k < 0.7) {
          if (k < 0.35) PXD.ellipseRing(ctx, r.x, r.y, rad + 1, Math.max(1, Math.round((rad + 1) * sq)));
          ctx.fillStyle = rampAt(r.ramp, Math.min(0.99, k + 0.35));
          const r2 = Math.max(1, Math.round(rad * 0.72));
          PXD.ellipseRing(ctx, r.x, r.y, r2, Math.max(1, Math.round(r2 * sq)));
        }
        if (k < 0.25 && !r.flat) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(r.x - 1, r.y - 1, 3, 3);
          ctx.fillRect(r.x - 3, r.y, 7, 1);
          ctx.fillRect(r.x, r.y - 3, 1, 7);
        }
      }

      // Charge spirals.
      this.orbits = this.orbits.filter((o) => now - o.t0 < o.life);
      for (const o of this.orbits) {
        const t = now - o.t0;
        if (t < 0) continue;
        const u = o.u, f = u._f;
        if (!f) continue;
        const k = t / o.life;
        const cx = u._sx - f.cx + (f.glow ? f.glow.x : f.cx);
        const cy = u._sy - f.footY + 2 + (f.glow ? f.glow.y : f.footY - 18);
        const rad = o.r0 * (1 - k);
        const a = o.a0 + o.w * t;
        ctx.fillStyle = rampAt(o.ramp, k * 0.8);
        ctx.fillRect(Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad * 0.7), 1, 1);
      }

      // Particles (analytic motion, colour by age along the ramp).
      this.parts = this.parts.filter((p) => now - p.t0 < p.life);
      for (const p of this.parts) {
        const age = now - p.t0;
        if (age < 0) continue;
        const t = age / 16;
        const x = Math.round(p.x + p.vx * t);
        const y = Math.round(p.y + p.vy * t + 0.5 * p.g * t * t);
        const k = age / p.life;
        ctx.fillStyle = rampAt(p.ramp, k);
        if (p.heart) {
          ctx.fillRect(x - 1, y, 1, 1);
          ctx.fillRect(x + 1, y, 1, 1);
          ctx.fillRect(x - 1, y + 1, 3, 1);
          ctx.fillRect(x, y + 2, 1, 1);
        } else {
          ctx.fillRect(x, y, 1, 1);
          if (k < 0.3) {
            // short streak behind fast particles
            const tx = Math.round(p.x + p.vx * (t - 1.5)), ty = Math.round(p.y + p.vy * (t - 1.5) + 0.5 * p.g * (t - 1.5) * (t - 1.5));
            if (tx !== x || ty !== y) {
              ctx.fillStyle = rampAt(p.ramp, k + 0.3);
              ctx.fillRect(tx, ty, 1, 1);
            }
          }
        }
      }

      // Lightning from the sky (forked, see drawBolt), impact bits and the front half of casting circles.
      this.bolts = this.bolts.filter((b) => now - b.t0 < (b.ms || 320));
      for (const b of this.bolts) this.drawBolt(b, now);
      this.drawBits(now);

      this.rains = this.rains.filter((r) => now - r.t0 < r.ms);
      for (const r of this.rains) {
        const k = (now - r.t0) / r.ms;
        if (k < 0) continue;
        const y = Math.round(r.y - 130 * (1 - k));
        ctx.fillStyle = '#6c1422';
        ctx.fillRect(r.x - 1, y - 13, 3, 13);
        ctx.fillStyle = '#f06c4c';
        ctx.fillRect(r.x, y - 13, 1, 13);
        if (k > 0.9) {
          ctx.fillStyle = '#f06c4c';
          ctx.fillRect(r.x - 3, r.y - 2, 7, 2);
        }
      }

      // Projectiles: glowing pixel orb with a sparkling trail.
      this.shots = this.shots.filter((s) => now - s.t0 < s.dur);
      for (const s of this.shots) {
        const k = (now - s.t0) / s.dur;
        const x = Math.round(s.from[0] + (s.to[0] - s.from[0]) * k);
        const y = Math.round(s.from[1] + (s.to[1] - s.from[1]) * k - Math.sin(k * Math.PI) * 12);
        if (now - s.last > 30) {
          s.last = now;
          this.spawn({ x, y, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, g: 0, t0: now, life: 220 + Math.random() * 160, ramp: s.ramp });
        }
        const r = s.ramp, f = Math.floor(now / 60) % 2;
        ctx.fillStyle = r[3];
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) ctx.fillRect(x + dx, y + dy, 1, 1);
        ctx.fillStyle = r[1];
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
        ctx.fillStyle = f ? r[0] : r[1];
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.restore();
    }
  }

  CT.Renderer = Renderer;
  CT.ISO = { TW, TH, HS };
})();
