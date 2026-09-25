// Isometric renderer, shared by field exploration and battles.
//
// A "world" is anything with { map, units, active? } where map comes from
// CT.prepareMap (tiles, decor, zones, theme). Each tile column is rasterised
// once per camera rotation, pixel by pixel from the terrain material
// (CT.TERRAIN), then tiles, decor and units are drawn back-to-front.
(function () {
  const CT = (window.CT = window.CT || {});
  const { hash, vnoise } = CT.TX;

  const TW = 64; // tile diamond width
  const TH = 32; // tile diamond height
  const HS = 16; // pixels per height level
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
      tint: '#8090d0', dark: 0.35,
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

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.W = canvas.width;
      this.H = canvas.height;
      this._rot = 0;
      this.ox = this.W / 2;
      this.oy = 150;
      this.cam = null; // camera centre in base (origin-free) screen coords
      this.camTarget = null;
      this.world = null;
      this.floaters = [];
      this.particles = [];
      this.flashes = [];
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
    // Focus on a tile (smoothly unless instant). With no argument, frame the whole map.
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
      // While a dialogue box covers the bottom, frame the action higher up.
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
    buildTile(t, frame) {
      const mat = CT.TERRAIN[t.t];
      const h = this.tileHeight(t);
      const depthPx = Math.max(2, Math.round((h + BASE) * HS));
      const Wc = TW;
      const Hc = TH + depthPx + 1;
      const cv = document.createElement('canvas');
      cv.width = Wc;
      cv.height = Hc;
      const ctx = cv.getContext('2d');
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

      // Top diamond.
      const p = { t, nb, frame, ph };
      for (let y = 0; y < TH; y++) {
        const hw = y < 16 ? 2 * (y + 1) : 2 * (TH - y);
        for (let x = 32 - hw; x < 32 + hw; x++) {
          const dx = x + 0.5 - 32;
          const dy = y + 0.5 - 16;
          const ovx = dx / TW + dy / TH;
          const ovy = dy / TH - dx / TW;
          const [owx, owy] = this.vecToWorld(ovx, ovy);
          p.wx = t.x + owx;
          p.wy = t.y + owy;
          p.tx = Math.floor(p.wx * 32);
          p.ty = Math.floor(p.wy * 32);
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
            const edgeR = x >= 32 && (x - 32 >= 2 * (TH - y) - 2 || y >= TH - 1) && y >= 15;
            const edgeL = x < 32 && (31 - x >= 2 * (TH - y) - 2 || y >= TH - 1) && y >= 15;
            if ((edgeR && hFront.r < h - 0.2) || (edgeL && hFront.l < h - 0.2)) c = CT.TX.mixc(c, [255, 250, 220], 0.28);
            const backEdge = y <= 16 && ((x < 32 && x - (32 - 2 * (y + 1)) < 2) || (x >= 32 && 32 + 2 * (y + 1) - 1 - x < 2));
            if (backEdge && hBack.l <= h && hBack.r <= h) c = CT.TX.mixc(c, [255, 250, 220], 0.12);
          }
          put(x, y, c.map(Math.round));
        }
      }

      // Side faces.
      const sp = { t, depthPx };
      for (let face = 0; face < 2; face++) {
        sp.face = face;
        sp.k = face === 0 ? 0.72 : 0.88;
        for (let i = 0; i < 32; i++) {
          const x = face === 0 ? i : 63 - i;
          const yTop = 16 + Math.floor(i / 2) + 1;
          sp.u = face === 0 ? i : 31 - i;
          sp.wu = sp.u + (face === 0 ? 0 : 97) + t.x * 31 + t.y * 57;
          for (let v = 0; v < depthPx && yTop + v < Hc; v++) {
            sp.v = v;
            const ao = 1 - Math.min(0.35, (v / Math.max(depthPx, 1)) * 0.35);
            sp.fin = (c) => [c[0] * sp.k * ao, c[1] * sp.k * ao, c[2] * sp.k * ao];
            const c = mat.side(sp);
            if (c) put(x, yTop + v, c.map(Math.round));
          }
        }
      }
      ctx.putImageData(img, 0, 0);

      // Hanging blades over the lip (grassy materials).
      if (mat.blades) {
        for (let i = 0; i < 64; i += 3) {
          if (hash(i, t.x * 13 + t.y, 99) > 0.5) continue;
          const yTop = 16 + Math.floor((i < 32 ? i : 63 - i) / 2) + 1;
          const len = 3 + Math.floor(hash(i, t.y, 98) * 4);
          ctx.fillStyle = mat.blades;
          if (i >= 32) ctx.globalAlpha = 0.85;
          ctx.fillRect(i, yTop, 1, len);
          ctx.globalAlpha = 1;
        }
      }
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
      // Dither into bands for a 16-bit feel.
      const img = g.getImageData(0, 0, W, H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const b = ((x + y) & 1) * 6 - 3;
          for (let k = 0; k < 3; k++) img.data[i + k] = Math.max(0, Math.min(255, Math.round((img.data[i + k] + b) / 8) * 8));
        }
      g.putImageData(img, 0, 0);
      for (let i = 0; i < (th.stars || 0); i++) {
        const y = hash(i, 5) * H * 0.55;
        g.fillStyle = `rgba(255,255,255,${0.25 + hash(i, 6) * 0.7 * (1 - y / (H * 0.55))})`;
        const s = hash(i, 13) > 0.93 ? 2 : 1;
        g.fillRect(Math.floor(hash(i, 4) * W), Math.floor(y), s, s);
      }
      if (th.moon) {
        const [mx, my] = th.moon;
        const glow = g.createRadialGradient(mx, my, 10, mx, my, 90);
        glow.addColorStop(0, 'rgba(220,230,255,0.35)');
        glow.addColorStop(1, 'rgba(220,230,255,0)');
        g.fillStyle = glow;
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#f0f0e0';
        g.beginPath();
        g.arc(mx, my, 18, 0, 6.29);
        g.fill();
        g.fillStyle = '#d0d0c4';
        g.fillRect(mx - 6, my - 4, 5, 4);
        g.fillRect(mx + 4, my + 5, 4, 3);
      }
      if (th.sun) {
        const [sx, sy, col] = th.sun;
        const sun = g.createRadialGradient(sx, sy, 4, sx, sy, 130);
        sun.addColorStop(0, `rgba(${col},0.9)`);
        sun.addColorStop(0.15, `rgba(${col},0.45)`);
        sun.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = sun;
        g.fillRect(0, 0, W, H);
      }
      if (th.volcano) {
        g.fillStyle = th.mountains[0];
        g.beginPath();
        g.moveTo(560, 400);
        g.lineTo(700, 190);
        g.lineTo(740, 190);
        g.lineTo(900, 400);
        g.fill();
        const smoke = g.createRadialGradient(720, 170, 5, 720, 150, 90);
        smoke.addColorStop(0, 'rgba(90,70,70,0.6)');
        smoke.addColorStop(1, 'rgba(90,70,70,0)');
        g.fillStyle = smoke;
        g.fillRect(600, 40, 240, 200);
      }
      (th.mountains || []).forEach((col, li) => {
        const base = 330 + li * 55;
        const amp = (th.peaks ? 150 : 90) - li * 20;
        const f = [0.006, 0.01, 0.016][li];
        g.fillStyle = col;
        for (let x = 0; x < W; x++) {
          let n = vnoise(x * f, 0, li + 1) * 0.7 + vnoise(x * f * 4, 1, li + 1) * 0.3;
          if (th.peaks) n = Math.pow(n, 0.7);
          const top = Math.round(base - n * amp);
          g.fillRect(x, top, 1, H - top);
          if (th.peaks && li === 0 && n > 0.55) {
            g.fillStyle = '#f4f8ff';
            g.fillRect(x, top, 1, Math.round((n - 0.55) * 60));
            g.fillStyle = col;
          }
        }
        const hz = g.createLinearGradient(0, base - 20, 0, base + 60);
        hz.addColorStop(0, 'rgba(255,255,255,0)');
        hz.addColorStop(1, 'rgba(255,230,220,0.12)');
        g.fillStyle = hz;
        g.fillRect(0, base - 20, W, 80);
      });
      if (th.sea) {
        g.fillStyle = th.sea;
        g.fillRect(0, 440, W, H - 440);
        for (let i = 0; i < 80; i++) {
          g.fillStyle = 'rgba(200,230,255,0.25)';
          g.fillRect(Math.floor(hash(i, 30) * W), 444 + Math.floor(hash(i, 31) * 150), 6 + Math.floor(hash(i, 32) * 14), 1);
        }
      }
      if (th.forest) {
        g.fillStyle = th.forest;
        for (let x = 0; x < W; x += 3) {
          const top = 470 - Math.floor(vnoise(x * 0.08, 3, 4) * 26) - (x % 6 === 0 ? 4 : 0);
          g.fillRect(x, top, 3, H - top);
        }
      }
      if (th.interior) {
        // Soft pillars of light / distant architecture.
        for (let i = 0; i < 7; i++) {
          const x = 60 + i * 140 + hash(i, 40) * 40;
          const gr = g.createLinearGradient(x, 0, x + 50, 0);
          gr.addColorStop(0, 'rgba(255,255,255,0)');
          gr.addColorStop(0.5, `rgba(255,255,255,${name === 'museum' ? 0.35 : 0.04})`);
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr;
          g.fillRect(x, 0, 50, H);
        }
      }
      const clouds = th.clouds
        ? [0, 1, 2, 3, 4].map((i) => {
            const w = 120 + Math.floor(hash(i, 8) * 100);
            const c = CT.PX.canvas(w, 34, (cg) => {
              for (let k = 0; k < 9; k++) {
                const cx = 16 + hash(i, k + 20) * (w - 32);
                const cy = 18 + hash(i, k + 40) * 8;
                const r = 8 + hash(i, k + 60) * 10;
                cg.fillStyle = th.clouds[0];
                cg.beginPath();
                cg.arc(cx, cy, r, 0, 6.29);
                cg.fill();
                cg.fillStyle = th.clouds[1];
                cg.beginPath();
                cg.arc(cx - 2, cy - 3, r * 0.75, 0, 6.29);
                cg.fill();
              }
            });
            return { c, x: hash(i, 9) * W, y: 60 + i * 45 + hash(i, 10) * 20, v: 0.004 + hash(i, 11) * 0.006, a: 0.35 + hash(i, 12) * 0.3 };
          })
        : [];
      const vg = CT.PX.canvas(W, H, (v) => {
        const rg = v.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
        rg.addColorStop(0, 'rgba(0,0,0,0)');
        rg.addColorStop(1, `rgba(8,4,20,${th.vignette != null ? th.vignette : 0.55})`);
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
      this.shakeAmt = amount;
      this.shakeT = performance.now() + ms;
      this.shakeMs = ms;
    }
    flashScreen(color = '255,255,255', ms = 200) {
      this.screenFlash = { color, t0: performance.now(), ms };
    }

    draw(ui, now) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const world = this.world;
      if (!world || !world.map) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.W, this.H);
        this.drawOverlays(now);
        return;
      }
      this.updateCamera();
      this.drawBackground(now);

      if (now < this.shakeT) {
        const k = (this.shakeT - now) / (this.shakeMs || 250);
        ctx.translate(Math.round((Math.random() - 0.5) * this.shakeAmt * k), Math.round((Math.random() - 0.5) * this.shakeAmt * k));
      }

      const drawables = [];
      for (const t of this.tileOrder()) drawables.push({ z: this.depth(t.x, t.y), sub: 0, t });
      for (const u of world.units) {
        if (u.hidden || (!u.alive && u.alpha <= 0)) continue;
        const z = Math.max(this.depth(Math.floor(u.rx), Math.floor(u.ry)), this.depth(Math.ceil(u.rx), Math.ceil(u.ry)));
        drawables.push({ z, sub: 1 + (u.prop ? 0 : 0.5), u });
      }
      drawables.sort((a, b) => a.z - b.z || a.sub - b.sub);

      const lights = [];
      for (const d of drawables) {
        if (d.t) this.drawTile(d.t, ui, now, lights);
        else this.drawUnit(d.u, world, ui, now);
      }
      for (const r of this.rifts) this.drawRift(r, now);

      this.drawEffects(now);
      this.drawGrading(lights, now);
      this.drawWeather(now);
      this.drawFloaters(now);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.background(this.map.theme || 'dusk').vignette, 0, 0);
      this.drawOverlays(now);
    }

    // Colour grading, darkness and light sources.
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
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        const fl = l.flicker ? 0.85 + 0.15 * Math.sin(now / 90 + l.x * 7) * Math.sin(now / 53 + l.y) : 1;
        const r = l.radius * (0.95 + 0.05 * fl);
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
        g.addColorStop(0, `rgba(${l.color},${0.42 * fl})`);
        g.addColorStop(0.4, `rgba(${l.color},${0.16 * fl})`);
        g.addColorStop(1, `rgba(${l.color},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    drawWeather(now) {
      const ctx = this.ctx;
      const th = this.theme;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const kind = th.particles;
      if (kind === 'snow') {
        for (const m of this.motes) {
          const x = (m.x + Math.sin(now / 1600 + m.p) * 24 + now * 0.01 * m.s) % this.W;
          const y = (m.y + now * 0.03 * (0.5 + m.s)) % this.H;
          ctx.fillStyle = `rgba(255,255,255,${0.5 + m.s * 0.4})`;
          ctx.fillRect(Math.round(x), Math.round(y), m.s > 0.7 ? 3 : 2, m.s > 0.7 ? 3 : 2);
        }
      } else if (kind === 'embers') {
        ctx.globalCompositeOperation = 'lighter';
        for (const m of this.motes) {
          const x = (m.x + Math.sin(now / 900 + m.p) * 20) % this.W;
          const y = (this.H - ((m.y + now * 0.03 * (0.4 + m.s)) % this.H));
          ctx.fillStyle = `rgba(255,${120 + Math.floor(m.s * 100)},40,${0.4 + 0.4 * Math.sin(now / 200 + m.p)})`;
          ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
      } else if (kind === 'fireflies' || kind === 'motes' || kind === 'sparkle') {
        ctx.globalCompositeOperation = 'lighter';
        const col = kind === 'fireflies' ? '255,240,150' : kind === 'sparkle' ? '150,220,255' : '255,255,230';
        const n = kind === 'fireflies' ? 26 : 40;
        for (let i = 0; i < n; i++) {
          const m = this.motes[i];
          const x = (m.x + Math.sin(now / 2100 + m.p) * 30 + now * 0.004 * m.s) % this.W;
          const y = (m.y * 0.8 + 60 + Math.sin(now / 1300 + m.p * 2) * 16) % this.H;
          const a = 0.35 + 0.35 * Math.sin(now / 400 + m.p * 3);
          ctx.fillStyle = `rgba(${col},${a * 0.35})`;
          ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4);
          ctx.fillStyle = `rgba(${col},${a})`;
          ctx.fillRect(Math.round(x), Math.round(y), kind === 'motes' ? 1 : 2, kind === 'motes' ? 1 : 2);
        }
      } else if (kind === 'dust') {
        for (let i = 0; i < 30; i++) {
          const m = this.motes[i];
          const x = (m.x + now * 0.006 * m.s) % this.W;
          const y = (m.y + Math.sin(now / 1500 + m.p) * 10) % this.H;
          ctx.fillStyle = `rgba(255,250,235,${0.15 + 0.2 * m.s})`;
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      } else if (kind === 'wind') {
        for (let i = 0; i < 18; i++) {
          const m = this.motes[i];
          const x = (m.x + now * 0.25 * (0.5 + m.s)) % (this.W + 200) - 100;
          const y = m.y * 0.7 + Math.sin(now / 700 + m.p) * 8;
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(Math.round(x), Math.round(y), 30 + Math.floor(m.s * 40), 1);
        }
      }
      if (th.scan) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(0,0,0,${th.scan})`;
        const off = Math.floor(now / 60) % 4;
        for (let y = off; y < this.H; y += 4) ctx.fillRect(0, y, this.W, 1);
      }
      ctx.restore();
    }

    // Full-screen fades & flashes, drawn over everything.
    drawOverlays(now) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const b of this.big) this.drawBig(b, now);
      this.big = this.big.filter((b) => now - b.t0 < b.ms);
      if (this.screenFlash) {
        const k = (now - this.screenFlash.t0) / this.screenFlash.ms;
        if (k >= 1) this.screenFlash = null;
        else {
          ctx.fillStyle = `rgba(${this.screenFlash.color},${1 - k})`;
          ctx.fillRect(0, 0, this.W, this.H);
        }
      }
      if (this.fade > 0) {
        ctx.fillStyle = `rgba(${this.fadeColor},${this.fade})`;
        ctx.fillRect(0, 0, this.W, this.H);
      }
      ctx.restore();
    }

    diamond(sx, sy, inset = 0) {
      const ctx = this.ctx;
      const hw = TW / 2 - inset * 2;
      const hh = TH / 2 - inset;
      ctx.beginPath();
      ctx.moveTo(sx, sy - hh);
      ctx.lineTo(sx + hw, sy);
      ctx.lineTo(sx, sy + hh);
      ctx.lineTo(sx - hw, sy);
      ctx.closePath();
    }

    drawTile(t, ui, now, lights) {
      const ctx = this.ctx;
      const mat = CT.TERRAIN[t.t];
      const h = this.tileHeight(t);
      const [sx, sy] = this.project(t.x, t.y, h);
      const key = `${t.x},${t.y}`;
      if (!mat.void) {
        const { cv } = this.tileImage(t, now);
        ctx.drawImage(cv, Math.round(sx - 32), Math.round(sy - 16));
        if (mat.glow) lights.push({ x: sx, y: sy, color: mat.glow, radius: 46, flicker: true });
      }

      if (ui.grid && !mat.void) {
        ctx.strokeStyle = 'rgba(255,255,255,0.13)';
        ctx.lineWidth = 1;
        this.diamond(Math.round(sx) + 0.5, Math.round(sy) + 0.5);
        ctx.stroke();
      }

      const hl = ui.highlights && ui.highlights.get(key);
      if (hl) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 200);
        const col = { move: [90, 170, 255], aoe: [255, 214, 70], tech: [255, 214, 70], range: [255, 80, 80], zone: [255, 60, 140], danger: [255, 40, 40] }[hl] || [255, 255, 255];
        ctx.fillStyle = `rgba(${col},${(hl === 'zone' ? 0.18 : 0.28) + 0.14 * pulse})`;
        this.diamond(sx, sy, 1);
        ctx.fill();
        ctx.strokeStyle = `rgba(${col.map((c) => Math.min(255, c + 90))},${0.75 + 0.25 * pulse})`;
        ctx.stroke();
        if (hl !== 'zone') {
          ctx.strokeStyle = `rgba(255,255,255,${0.25 * pulse})`;
          this.diamond(sx, sy, 4);
          ctx.stroke();
        }
      }
      if (ui.path && ui.path.has(key)) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        this.diamond(sx, sy, 11);
        ctx.fill();
      }
      if (ui.hover && ui.hover.x === t.x && ui.hover.y === t.y) {
        const a = 0.6 + 0.4 * Math.sin(now / 120);
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 2;
        this.diamond(sx, sy, 1);
        ctx.stroke();
        ctx.lineWidth = 1;
        if (ui.grid) {
          ctx.font = '8px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#101018';
          ctx.fillText(String(t.h), sx + 1, sy + 4);
          ctx.fillStyle = '#fff';
          ctx.fillText(String(t.h), sx, sy + 3);
        }
      }

      const d = this.map.decorAt.get(key);
      if (d && !d.hidden) this.drawDecor(d, sx, sy, now, lights);
    }

    drawDecor(d, sx, sy, now, lights) {
      const ctx = this.ctx;
      const def = CT.DECOR[d.kind];
      if (!def) return;
      const img = CT.getDecor(d.kind, d.variant || 0);
      if (def.shadow) {
        ctx.fillStyle = 'rgba(10,12,20,0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 1, def.shadow[0], def.shadow[1], 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const frameImg = def.animate ? def.animate(img, now, d) || img : img;
      const flat = def.flat; // drawn flat on the tile top (runes, rugs)
      const dx = Math.round(sx - frameImg.width / 2 + (def.xOff || 0));
      const dy = flat ? Math.round(sy - frameImg.height / 2) : Math.round(sy - frameImg.height + (def.yOff || 0));
      ctx.drawImage(frameImg, dx, dy);
      if (def.light) {
        const l = def.light;
        lights.push({ x: sx + (l.dx || 0), y: dy + (l.dy != null ? l.dy : frameImg.height * 0.3), color: l.color, radius: l.radius || 60, flicker: l.flicker });
      }
    }

    unitScreenPos(u) {
      return this.project(u.rx + u.ox, u.ry + u.oy, u.rh);
    }

    drawUnit(u, world, ui, now) {
      const ctx = this.ctx;
      const spr = CT.getSprite(u.sprite || u.key);
      const f = spr.frames[this.screenDir(u.face)] || spr.frames['south-east'];
      const [sx0, sy0] = this.unitScreenPos(u);
      const sx = Math.round(sx0);
      const sy = Math.round(sy0 - (u.oz || 0));
      const isActive = world.active === u;
      const bob = isActive ? Math.round(Math.sin(now / 160) * 1) : 0;
      const showRing = ui.grid && !u.prop && u.team != null;

      ctx.save();
      ctx.globalAlpha = u.alpha;
      if (!u.noShadow) {
        const sh = u.big ? 1.8 : 1;
        ctx.fillStyle = 'rgba(10,8,24,0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, Math.round(sy0) + 1, 15 * sh, 6 * sh, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (showRing) {
        const ring = u.guest ? '110,230,140' : u.team === 0 ? '110,190,255' : u.team === 1 ? '255,100,100' : '200,200,210';
        ctx.strokeStyle = `rgba(${ring},${isActive ? 0.6 + 0.4 * Math.sin(now / 150) : 0.75})`;
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.beginPath();
        ctx.ellipse(sx, Math.round(sy0) + 1, u.big ? 30 : 17, u.big ? 12 : 7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      let img = f.img;
      const dx = Math.round(sx - f.cx);
      const dy = Math.round(sy - f.footY + 3 + bob);
      if (u.flicker && Math.floor(now / 70 + u.id * 3) % 7 === 0) ctx.globalAlpha = u.alpha * 0.45;
      if (u.status && u.status.stasis) ctx.globalAlpha *= 0.85;
      if (u.koPose) {
        // Lying down: rotate the sprite onto its side.
        ctx.translate(sx, sy - 6);
        ctx.rotate(Math.PI / 2 * (this.screenDir(u.face).endsWith('west') ? -1 : 1));
        ctx.drawImage(img, -f.cx, -f.footY + 6);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else ctx.drawImage(img, dx, dy);
      if (u.flash > 0) {
        ctx.globalAlpha = u.alpha * Math.min(1, u.flash);
        ctx.drawImage(f.flash, dx, dy);
      }
      if (u.tintColor) {
        ctx.globalAlpha = u.alpha * (u.tintAmt || 0.4);
        ctx.globalCompositeOperation = 'source-atop';
      }
      ctx.restore();

      const headY = dy + f.top;
      if (u.status && u.status.stasis) {
        ctx.save();
        ctx.strokeStyle = `rgba(190,240,255,${0.6 + 0.3 * Math.sin(now / 200)})`;
        ctx.fillStyle = 'rgba(190,240,255,0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sx, (headY + sy) / 2, 20, (sy - headY) / 2 + 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (ui.grid && u.alive && !u.prop && u.maxHp) {
        const bw = u.big ? 44 : 28;
        const bx = sx - bw / 2;
        const by = headY - 9;
        ctx.fillStyle = 'rgba(12,10,24,0.85)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
        const fr = Math.max(0, u.hp / u.maxHp);
        ctx.fillStyle = fr > 0.5 ? '#58e878' : fr > 0.25 ? '#f8d848' : '#f85848';
        ctx.fillRect(bx, by, Math.max(1, Math.round(bw * fr)), 3);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(bx, by, Math.max(1, Math.round(bw * fr)), 1);
        // Status badges.
        if (u.status) {
          const badges = [];
          const S = { burn: ['B', '#ff7030'], slow: ['S', '#80a0ff'], haste: ['H', '#60ff90'], stun: ['*', '#ffe040'], catalogued: ['C', '#ff4060'], stasis: ['∎', '#c0f0ff'], magdown: ['M', '#c080ff'] };
          for (const k in u.status) if (u.status[k] && S[k]) badges.push(S[k]);
          ctx.font = '7px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          badges.forEach(([ch, col], i) => {
            const x = bx + 4 + i * 9;
            ctx.fillStyle = '#101018';
            ctx.fillRect(x - 4, by - 11, 9, 9);
            ctx.fillStyle = col;
            ctx.fillText(ch, x + 1, by - 3);
          });
        }
        if (u.carrying) {
          // The seed they carry, pulsing.
          const p = 0.6 + 0.4 * Math.sin(now / 150);
          ctx.fillStyle = `rgba(255,40,60,${p * 0.5})`;
          ctx.beginPath();
          ctx.arc(sx + 12, headY + 16, 7, 0, 6.29);
          ctx.fill();
        }
      }

      if (u.emote) {
        const age = now - u.emote.t0;
        if (age > (u.emote.ms || 1400)) u.emote = null;
        else {
          const ey = headY - 18 - Math.min(6, age / 30);
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#101018';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(sx + 10, ey, 13, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.font = '10px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = u.emote.color || '#101018';
          ctx.fillText(u.emote.text, sx + 10, ey + 5);
        }
      }

      if (isActive && u.alive && ui.grid) {
        const ay = headY - 30 + Math.sin(now / 200) * 4;
        const col = u.team === 0 ? ['#a8e8ff', '#48a8f0', '#2060b0'] : ['#ffc0c0', '#f05858', '#a02020'];
        ctx.fillStyle = col[1];
        ctx.beginPath();
        ctx.moveTo(sx, ay + 14);
        ctx.lineTo(sx - 7, ay + 2);
        ctx.lineTo(sx, ay - 5);
        ctx.lineTo(sx + 7, ay + 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = col[2];
        ctx.beginPath();
        ctx.moveTo(sx, ay + 14);
        ctx.lineTo(sx + 7, ay + 2);
        ctx.lineTo(sx, ay + 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = col[0];
        ctx.fillRect(sx - 3, ay - 1, 2, 4);
      }
      if (ui.facingFor === u) this.drawFacingArrows(u, sx, Math.round(sy0), now);
    }

    drawFacingArrows(u, sx, sy, now) {
      const ctx = this.ctx;
      for (let f = 0; f < 4; f++) {
        const [fx, fy] = CT.DIRS[f];
        const [vx, vy] = this.vecToView(fx, fy);
        const ax = sx + (vx - vy) * 26;
        const ay = sy + (vx + vy) * 13;
        const on = u.face === f;
        ctx.fillStyle = on ? `rgba(255,230,90,${0.8 + 0.2 * Math.sin(now / 120)})` : 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(ax + (vx - vy) * 8, ay + (vx + vy) * 4);
        ctx.lineTo(ax - (vx + vy) * 6, ay + (vx - vy) * 3);
        ctx.lineTo(ax + (vx + vy) * 6, ay - (vx - vy) * 3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#101018';
        ctx.stroke();
      }
    }

    // ---- Effects -------------------------------------------------------------------
    floatText(u, text, color, big) {
      const [sx, sy] = this.project(u.x, u.y, u.rh);
      this.floaters.push({ x: sx, y: sy - 58 - this.floaters.filter((f) => performance.now() - f.t0 < 300).length * 12, text, color, t0: performance.now(), big });
    }

    drawFloaters(now) {
      const ctx = this.ctx;
      ctx.textAlign = 'center';
      this.floaters = this.floaters.filter((f) => now - f.t0 < 1300);
      for (const f of this.floaters) {
        ctx.font = `${f.big ? 22 : 16}px "Press Start 2P", monospace`;
        const k = (now - f.t0) / 1300;
        const y = f.y - (k < 0.2 ? Math.sin((k / 0.2) * Math.PI) * 14 : 0) - k * 10;
        ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) * 4 : 1;
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#100818';
        ctx.strokeText(f.text, f.x, y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, y);
        ctx.globalAlpha = 1;
      }
    }

    burst(x, y, h, elem, opts = {}) {
      const [sx, sy] = this.project(x, y, h);
      const colors = {
        fire: ['#ff5020', '#ffa030', '#ffe060'],
        ice: ['#a0e8ff', '#e0f8ff', '#60b0f0'],
        lightning: ['#fff8a0', '#ffffff', '#f0e040'],
        shadow: ['#a060f0', '#602090', '#e0a0ff'],
        water: ['#4090f0', '#a0d0ff', '#2060c0'],
        laser: ['#ff60c0', '#60f0ff', '#ffffff'],
        heal: ['#80ff90', '#e0ffe0', '#40d060'],
        slash: ['#ffffff', '#d0e0ff', '#a0b0ff'],
        hit: ['#ffffff', '#ffe0a0', '#ffb060'],
        porcelain: ['#ffffff', '#d8e8ff', '#80a0ff'],
        lavos: ['#ff2040', '#ff8040', '#400010'],
        charm: ['#ff80c0', '#ffc0e0', '#ff4090'],
        glass: ['#e0f8ff', '#ffffff', '#a0d0f0'],
      }[elem] || ['#ffffff'];
      const now = performance.now();
      const n = opts.n || (elem === 'hit' ? 14 : 30);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.6 + Math.random() * 2.6;
        this.particles.push({
          x: sx,
          y: sy - 20,
          vx: Math.cos(a) * sp,
          vy: elem === 'heal' || elem === 'charm' ? -0.8 - Math.random() * 1.4 : Math.sin(a) * sp * 0.7 - 1.3,
          g: elem === 'heal' || elem === 'charm' ? -0.01 : 0.09,
          c: colors[i % colors.length],
          t0: now,
          life: 500 + Math.random() * 500,
          s: elem === 'hit' ? 2 : 2 + Math.floor(Math.random() * 2),
          heart: elem === 'charm',
        });
      }
      const glow = { fire: '255,120,40', ice: '140,220,255', lightning: '255,250,160', shadow: '170,90,255', water: '80,150,255', laser: '255,120,220', heal: '120,255,150', slash: '220,230,255', hit: '255,240,200', lavos: '255,40,60', porcelain: '200,220,255', charm: '255,120,200', glass: '220,245,255' }[elem] || '255,255,255';
      this.flashes.push({ x: sx, y: sy - 18, c: glow, t0: now, r: elem === 'hit' ? 22 : opts.r || 40 });
      if (elem === 'lightning') this.bolts.push({ x: sx, y: sy - 16, t0: now });
      if (elem !== 'heal' && elem !== 'charm' && !opts.noShake) this.shake(elem === 'hit' ? 3 : 6);
    }

    projectile(from, to, kind, dur) {
      this.shots.push({ from, to, kind, t0: performance.now(), dur });
    }

    // Grey time-tear with red scanlines (or a blue gate when grey=false).
    addRift(x, y, h, opts = {}) {
      const r = { x, y, h, t0: performance.now(), grey: opts.grey !== false, size: opts.size || 1, id: opts.id || 'rift' };
      this.rifts.push(r);
      return r;
    }
    removeRift(id) {
      this.rifts = this.rifts.filter((r) => r.id !== id);
    }
    drawRift(r, now) {
      const ctx = this.ctx;
      const [sx, sy] = this.project(r.x, r.y, r.h);
      const grow = Math.max(0.05, Math.min(1, (now - r.t0) / 600)) * r.size;
      const w = 22 * grow;
      const hgt = Math.max(3, 46 * grow);
      const cy = sy - 34;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(sx, cy, 2, sx, cy, hgt);
      g.addColorStop(0, r.grey ? 'rgba(255,60,80,0.45)' : 'rgba(80,160,255,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - hgt, cy - hgt, hgt * 2, hgt * 2);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const yy = cy - hgt + t * hgt * 2;
        const xx = sx + Math.sin(t * Math.PI) * w * (0.8 + 0.2 * Math.sin(now / 90 + i));
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      for (let i = 20; i >= 0; i--) {
        const t = i / 20;
        const yy = cy - hgt + t * hgt * 2;
        ctx.lineTo(sx - Math.sin(t * Math.PI) * w * (0.8 + 0.2 * Math.cos(now / 80 + i)), yy);
      }
      ctx.closePath();
      ctx.fillStyle = r.grey ? '#8c8c98' : '#2040a0';
      ctx.fill();
      ctx.clip();
      for (let yy = Math.floor(cy - hgt); yy < cy + hgt; yy += 3) {
        ctx.fillStyle = r.grey ? ((yy + Math.floor(now / 40)) % 6 < 3 ? 'rgba(255,40,60,0.7)' : 'rgba(40,40,50,0.6)') : `rgba(140,220,255,${0.3 + 0.3 * Math.sin(yy / 4 + now / 100)})`;
        ctx.fillRect(sx - w - 2, yy, w * 2 + 4, 1);
      }
      ctx.restore();
    }

    // Destruction Rain: needles falling onto a set of tiles.
    rain(tiles) {
      const now = performance.now();
      for (const t of tiles) {
        const [sx, sy] = this.project(t.x, t.y, this.tileHeight(t));
        for (let i = 0; i < 3; i++) this.rains.push({ x: sx + (Math.random() - 0.5) * 30, y: sy, t0: now + i * 90 + Math.random() * 200, ms: 380 });
      }
    }

    // Full-screen tech spectacles: 'eclipse', 'luminaire', 'blackhole', 'darkmatter'.
    bigFx(kind, ms = 1400) {
      this.big.push({ kind, t0: performance.now(), ms });
    }
    drawBig(b, now) {
      const ctx = this.ctx;
      const k = (now - b.t0) / b.ms;
      if (k < 0 || k > 1) return;
      const W = this.W;
      const H = this.H;
      if (b.kind === 'eclipse') {
        ctx.fillStyle = `rgba(0,0,0,${Math.sin(k * Math.PI) * 0.7})`;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#000';
        const rw = W * Math.min(1, k * 2.2);
        ctx.fillRect(W / 2 - rw / 2, H * 0.3 - 6, rw, 12);
        ctx.fillStyle = 'rgba(160,80,255,0.8)';
        ctx.fillRect(W / 2 - rw / 2, H * 0.3 - 8, rw, 2);
        if (k > 0.35) {
          const s = (k - 0.35) / 0.65;
          ctx.strokeStyle = `rgba(255,255,255,${1 - s})`;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(W * 0.1 + s * W * 0.4, H * 0.1);
          ctx.lineTo(W * 0.5 + s * W * 0.3, H * 0.9);
          ctx.moveTo(W * 0.9 - s * W * 0.4, H * 0.1);
          ctx.lineTo(W * 0.5 - s * W * 0.3, H * 0.9);
          ctx.stroke();
        }
      } else if (b.kind === 'luminaire') {
        const r = k * W;
        const g = ctx.createRadialGradient(W / 2, H / 2, r * 0.6, W / 2, H / 2, r);
        g.addColorStop(0, 'rgba(255,255,200,0)');
        g.addColorStop(0.8, `rgba(255,255,220,${0.7 * (1 - k)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      } else if (b.kind === 'blackhole' || b.kind === 'darkmatter') {
        ctx.fillStyle = `rgba(20,0,40,${Math.sin(k * Math.PI) * 0.5})`;
        ctx.fillRect(0, 0, W, H);
      } else if (b.kind === 'erase') {
        ctx.fillStyle = `rgba(255,255,255,${Math.sin(k * Math.PI) * 0.6})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    drawEffects(now) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.flashes = this.flashes.filter((f) => now - f.t0 < 450);
      for (const f of this.flashes) {
        const k = (now - f.t0) / 450;
        const r = f.r * (0.4 + k * 0.8);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, `rgba(${f.c},${0.8 * (1 - k)})`);
        g.addColorStop(1, `rgba(${f.c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
      }

      this.particles = this.particles.filter((p) => now - p.t0 < p.life);
      for (const p of this.particles) {
        const t = (now - p.t0) / 16;
        const x = p.x + p.vx * t;
        const y = p.y + p.vy * t + 0.5 * p.g * t * t;
        ctx.globalAlpha = 1 - (now - p.t0) / p.life;
        ctx.fillStyle = p.c;
        if (p.heart) {
          ctx.fillRect(Math.round(x) - 2, Math.round(y), 2, 2);
          ctx.fillRect(Math.round(x) + 1, Math.round(y), 2, 2);
          ctx.fillRect(Math.round(x) - 1, Math.round(y) + 2, 3, 2);
        } else ctx.fillRect(Math.round(x), Math.round(y), p.s, p.s);
      }
      ctx.globalAlpha = 1;

      this.bolts = this.bolts.filter((b) => now - b.t0 < 320);
      for (const b of this.bolts) {
        for (const [w, col] of [[7, 'rgba(255,240,120,0.35)'], [3, '#ffffff']]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.beginPath();
          let x = b.x;
          ctx.moveTo(x + 20, 0);
          for (let y = 0; y < b.y; y += 22) {
            x = b.x + (hash(Math.floor(now / 50), y, 3) - 0.5) * 28;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      this.rains = this.rains.filter((r) => now - r.t0 < r.ms);
      for (const r of this.rains) {
        const k = (now - r.t0) / r.ms;
        if (k < 0) continue;
        const y = r.y - 260 * (1 - k);
        ctx.strokeStyle = 'rgba(255,60,80,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r.x, y - 26);
        ctx.lineTo(r.x, y);
        ctx.stroke();
        if (k > 0.9) {
          ctx.fillStyle = 'rgba(255,120,90,0.8)';
          ctx.fillRect(r.x - 6, r.y - 4, 12, 4);
        }
      }

      this.shots = this.shots.filter((s) => now - s.t0 < s.dur);
      for (const s of this.shots) {
        const k = (now - s.t0) / s.dur;
        const x = s.from[0] + (s.to[0] - s.from[0]) * k;
        const y = s.from[1] + (s.to[1] - s.from[1]) * k - Math.sin(k * Math.PI) * 24;
        const col = { shot: '255,230,120', harpoon: '220,230,255', bolt: '220,230,255', dark: '170,90,255', seed: '255,40,60' }[s.kind] || '255,255,255';
        const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
        g.addColorStop(0, `rgba(${col},0.9)`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 10, y - 10, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      }
      ctx.restore();
    }
  }

  CT.Renderer = Renderer;
  CT.ISO = { TW, TH, HS };
})();
