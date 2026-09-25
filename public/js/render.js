// Isometric renderer. Each tile column is rasterised once per camera
// rotation into its own canvas, pixel by pixel, from world-space noise so
// textures flow seamlessly across tiles. Tiles and units are then drawn
// back-to-front so terrain correctly hides characters behind it.
(function () {
  const CT = (window.CT = window.CT || {});

  const TW = 64; // tile diamond width
  const TH = 32; // tile diamond height
  const HS = 16; // pixels per height level
  const BASE = 0.6; // extra column depth below height 0
  const WATER_FRAMES = 8;

  // ---- Noise ----------------------------------------------------------------------
  function hash(x, y, s = 0) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, s = 0) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s);
    const b = hash(xi + 1, yi, s);
    const c = hash(xi, yi + 1, s);
    const d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const ramp = (arr) => arr.map(hex);
  const pick = (r, t) => r[Math.max(0, Math.min(r.length - 1, Math.floor(t * r.length)))];
  const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  const R = {
    grass: ramp(['#285c2c', '#347434', '#43893a', '#579e42', '#6fb44c', '#8ec860']),
    dirt: ramp(['#6c4424', '#825430', '#98683c', '#ac7c48', '#c29058']),
    stone: ramp(['#5c5c6c', '#6c6c7c', '#7c7c8e', '#8e8ea0', '#a0a0b2']),
    wood: ramp(['#5a3418', '#704424', '#865630', '#9c683c']),
    water: ramp(['#183c7c', '#1f4e94', '#285ea8', '#3470bc', '#4888d0']),
    shallow: ramp(['#2c6ca0', '#3882b4', '#4898c4', '#5cacd4']),
    earth: ramp(['#4c2c1c', '#5c3822', '#6c442a', '#7c5032', '#8c5e3a']),
    earth2: ramp(['#5c4030', '#6c4c38', '#7c5840']),
    brick: ramp(['#4c4c5c', '#5c5c6c', '#6c6c7c', '#7c7c8c']),
    rockside: ramp(['#6c6c78', '#84848e', '#9c9ca6']),
  };
  const FOAM = hex('#e8f4ff');
  const MORTAR = hex('#34343f');
  const FLOWERS = ['#f8f8f8', '#f8e060', '#f890b8', '#a8c8ff'].map(hex);

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
      this.floaters = [];
      this.particles = [];
      this.flashes = [];
      this.bolts = [];
      this.shots = [];
      this.shakeT = 0;
      this.shakeAmt = 0;
      this.cache = new Map();
      this.bg = null;
      this.motes = Array.from({ length: 26 }, (_, i) => ({ x: hash(i, 1) * this.W, y: 120 + hash(i, 2) * 380, p: hash(i, 3) * 6.28, s: 0.3 + hash(i, 4) * 0.5 }));
    }

    get rot() {
      return this._rot;
    }
    set rot(v) {
      this._rot = v;
      this.cache.clear();
    }

    // ---- Projection ------------------------------------------------------------------
    view(x, y) {
      const n = CT.MAP.size - 1;
      switch (this._rot) {
        case 1: return [n - y, x];
        case 2: return [n - x, n - y];
        case 3: return [y, n - x];
        default: return [x, y];
      }
    }
    // Rotate a direction vector world → view, and back.
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
    project(x, y, h) {
      const [vx, vy] = this.view(x, y);
      return [this.ox + ((vx - vy) * TW) / 2, this.oy + ((vx + vy) * TH) / 2 - h * HS];
    }
    depth(x, y) {
      const [vx, vy] = this.view(x, y);
      return vx + vy;
    }
    screenDir(face) {
      const [fx, fy] = CT.DIRS[face];
      const [vx, vy] = this.vecToView(fx, fy);
      const sx = vx - vy;
      const sy = vx + vy;
      return (sy > 0 ? 'south-' : 'north-') + (sx > 0 ? 'east' : 'west');
    }
    tileHeight(t) {
      return t.t === 'w' ? t.h - 0.3 : t.t === 'f' ? t.h - 0.15 : t.h;
    }

    // ---- Picking ---------------------------------------------------------------------
    pick(battle, mx, my) {
      const order = this.tileOrder(battle).reverse();
      for (const t of order) {
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
    tileOrder(battle) {
      const all = [];
      for (const row of battle.tiles) for (const t of row) all.push(t);
      return all.sort((a, b) => this.depth(a.x, a.y) - this.depth(b.x, b.y) || this.view(a.x, a.y)[0] - this.view(b.x, b.y)[0]);
    }

    // ---- Tile rasterisation ------------------------------------------------------
    // Top-surface colour for a world-space point on tile t.
    topColor(battle, t, wx, wy, frame) {
      const tx = Math.floor(wx * 32);
      const ty = Math.floor(wy * 32);
      const grain = hash(tx, ty, 7);
      const n = vnoise(wx * 2.2, wy * 2.2, 1) * 0.55 + vnoise(wx * 7, wy * 7, 2) * 0.45;
      switch (t.t) {
        case 'g':
        case 't': {
          let c = pick(R.grass, n * 0.75 + grain * 0.3);
          if (grain > 0.965) c = R.grass[5];
          const f = hash(tx >> 1, ty >> 1, 11);
          if (f > 0.992 && t.t === 'g') c = FLOWERS[Math.floor(hash(tx >> 1, ty >> 1, 12) * 4)];
          // Worn dirt patches.
          const worn = vnoise(wx * 1.3, wy * 1.3, 5);
          if (worn > 0.74) c = mixc(c, pick(R.dirt, grain), Math.min(1, (worn - 0.74) * 6));
          return c;
        }
        case 'd':
        case 'r': {
          let c = pick(R.dirt, n * 0.7 + grain * 0.35);
          if (hash(tx, ty, 21) > 0.975) c = R.stone[3];
          const moss = vnoise(wx * 1.6, wy * 1.6, 9);
          if (moss > 0.72) c = mixc(c, R.grass[2], 0.6);
          return c;
        }
        case 's': {
          const row = Math.floor(wy * 3);
          const col = Math.floor(wx * 3 + (row % 2) * 0.5);
          const fx = wx * 3 + (row % 2) * 0.5 - col;
          const fy = wy * 3 - row;
          if (fx < 0.06 || fy < 0.06) return MORTAR;
          const tint = hash(col, row, 31);
          let c = pick(R.stone, 0.25 + tint * 0.5 + (grain - 0.5) * 0.25);
          if (fx < 0.14 || fy < 0.14) c = scale(c, 1.12);
          if (vnoise(wx * 2, wy * 2, 13) > 0.8) c = mixc(c, R.grass[1], 0.5);
          return c;
        }
        case 'b': {
          const p = wx * 5;
          const plank = Math.floor(p);
          const fp = p - plank;
          if (fp < 0.1) return hex('#2c1a0c');
          let c = pick(R.wood, 0.3 + hash(plank, 0, 41) * 0.5 + (vnoise(plank * 7, wy * 12, 42) - 0.5) * 0.5);
          if (fp > 0.1 && fp < 0.2 && Math.abs((wy % 1) - 0.18) < 0.05) c = hex('#c0c0c8');
          return c;
        }
        case 'w':
        case 'f': {
          const ph = (frame / WATER_FRAMES) * Math.PI * 2;
          const wave = Math.sin(wx * 9 + wy * 4 + ph) * 0.5 + Math.sin(wy * 13 - wx * 3 - ph) * 0.5;
          const base = t.t === 'f' ? R.shallow : R.water;
          let c = pick(base, 0.45 + n * 0.35 + wave * 0.12);
          if (wave > 0.82 && grain > 0.5) c = mixc(c, FOAM, 0.55);
          if (t.t === 'f' && hash(tx >> 1, ty >> 1, 51) > 0.93) c = mixc(c, R.dirt[3], 0.45);
          // Foam where water meets land.
          const x0 = t.x;
          const y0 = t.y;
          const land = (dx, dy) => {
            const n2 = battle.tile(x0 + dx, y0 + dy);
            return n2 && n2.t !== 'w' && n2.t !== 'f';
          };
          const fxl = wx - x0 + 0.5;
          const fyl = wy - y0 + 0.5;
          const edge = Math.min(land(-1, 0) ? fxl : 9, land(1, 0) ? 1 - fxl : 9, land(0, -1) ? fyl : 9, land(0, 1) ? 1 - fyl : 9);
          const foamW = 0.08 + 0.06 * Math.sin(ph + (wx + wy) * 10);
          if (edge < foamW) c = mixc(c, FOAM, 0.85);
          else if (edge < foamW + 0.07) c = mixc(c, FOAM, 0.3);
          return c;
        }
      }
      return [255, 0, 255];
    }

    // Side-face colour. u runs along the face (0..31), v downward from the
    // top edge, face 0 = left (darker), 1 = right.
    sideColor(t, u, v, depthPx, face, wu) {
      const k = face === 0 ? 0.72 : 0.88;
      const ao = 1 - Math.min(0.35, (v / Math.max(depthPx, 1)) * 0.35);
      let c;
      switch (t.t) {
        case 'g':
        case 't':
        case 'd':
        case 'r': {
          const lip = t.t === 'g' || t.t === 't' ? 2 + Math.floor(hash(wu, 0, 61) * 4) : 1;
          if (v < lip) {
            c = v === lip - 1 ? R.grass[0] : pick(R.grass, 0.4 + hash(wu, v, 62) * 0.4);
            if (t.t === 'd' || t.t === 'r') c = R.dirt[3];
            return scale(c, k + 0.05);
          }
          const band = Math.floor((v + Math.sin(wu * 0.35) * 2 + hash(wu >> 3, 0, 63) * 3) / 7);
          c = pick(band % 2 ? R.earth : R.earth2, hash(wu, v, 64) * 0.9);
          const cx = Math.floor(wu / 5);
          const cy = Math.floor((v + (cx % 2) * 2) / 4);
          if (hash(cx, cy, 65) > 0.9) c = pick(R.rockside, hash(wu, v, 66));
          if (hash(wu, v, 67) > 0.985) c = R.grass[1];
          break;
        }
        case 's': {
          const row = Math.floor(v / 6);
          const bx = (wu + (row % 2) * 6) % 12;
          if (v % 6 === 0 || bx === 0) c = MORTAR;
          else c = pick(R.brick, hash(Math.floor((wu + (row % 2) * 6) / 12), row, 71) * 0.7 + hash(wu, v, 72) * 0.3);
          break;
        }
        case 'b': {
          if (v < 5) c = pick(R.wood, v === 0 ? 0.9 : 0.2 + hash(wu, v, 81) * 0.3);
          else if (wu % 16 < 4) c = pick(R.wood, 0.1 + hash(wu, v, 82) * 0.2);
          else return null; // open under the bridge
          break;
        }
        default:
          c = pick(t.t === 'f' ? R.shallow : R.water, 0.2 + hash(wu, v, 91) * 0.2);
      }
      return scale(c, k * ao);
    }

    buildTile(battle, t, frame) {
      const h = this.tileHeight(t);
      const depthPx = Math.max(2, Math.round((h + BASE) * HS));
      const Wc = TW;
      const Hc = TH + depthPx + 1;
      const cv = document.createElement('canvas');
      cv.width = Wc;
      cv.height = Hc;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(Wc, Hc);
      const put = (x, y, c, a = 255) => {
        if (!c) return;
        const i = (y * Wc + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = a;
      };
      const light = 0.93 + t.h * 0.025;

      // Neighbour heights in view space (for rims / ambient occlusion).
      const nbH = (dvx, dvy) => {
        const [dx, dy] = this.vecToWorld(dvx, dvy);
        const n = battle.tile(t.x + dx, t.y + dy);
        return n ? this.tileHeight(n) : -99;
      };
      const hFront = { r: nbH(1, 0), l: nbH(0, 1) }; // view +x = lower-right edge, +y = lower-left
      const hBack = { r: nbH(0, -1), l: nbH(-1, 0) }; // upper-right, upper-left edges

      // Top diamond.
      for (let y = 0; y < TH; y++) {
        const hw = y < 16 ? 2 * (y + 1) : 2 * (TH - y);
        for (let x = 32 - hw; x < 32 + hw; x++) {
          const dx = x + 0.5 - 32;
          const dy = y + 0.5 - 16;
          const ovx = dx / TW + dy / TH;
          const ovy = dy / TH - dx / TW;
          const [owx, owy] = this.vecToWorld(ovx, ovy);
          let c = this.topColor(battle, t, t.x + owx, t.y + owy, frame);
          let k = light;
          // Ambient occlusion from higher neighbours behind.
          const dUL = 0.5 + ovx; // distance to the upper-left edge (view -x side)
          const dUR = 0.5 + ovy;
          if (hBack.l > h + 0.2) k *= 0.72 + 0.28 * Math.min(1, dUL / 0.3);
          if (hBack.r > h + 0.2) k *= 0.72 + 0.28 * Math.min(1, dUR / 0.3);
          c = scale(c, k);
          // Rim light where the ground drops away in front.
          const edgeR = x >= 32 && (x - 32 >= 2 * (TH - y) - 2 || y >= TH - 1) && y >= 15;
          const edgeL = x < 32 && (31 - x >= 2 * (TH - y) - 2 || y >= TH - 1) && y >= 15;
          if (t.t !== 'w' && t.t !== 'f') {
            if ((edgeR && hFront.r < h - 0.2) || (edgeL && hFront.l < h - 0.2)) c = mixc(c, [255, 250, 220], 0.28);
            // Back edges catch the light too.
            const backEdge = y <= 16 && ((x < 32 && x - (32 - 2 * (y + 1)) < 2) || (x >= 32 && 32 + 2 * (y + 1) - 1 - x < 2));
            if (backEdge && hBack.l <= h && hBack.r <= h) c = mixc(c, [255, 250, 220], 0.12);
          }
          put(x, y, c.map(Math.round));
        }
      }

      // Side faces.
      for (let face = 0; face < 2; face++) {
        for (let i = 0; i < 32; i++) {
          const x = face === 0 ? i : 63 - i;
          const yTop = 16 + Math.floor(i / 2) + 1;
          const wu = face === 0 ? i : 31 - i; // continuous along the face, left-to-right
          const seedU = wu + (face === 0 ? 0 : 97) + t.x * 31 + t.y * 57;
          for (let v = 0; v < depthPx && yTop + v < Hc; v++) {
            const c = this.sideColor(t, wu, v, depthPx, face, seedU);
            if (c) put(x, yTop + v, c.map(Math.round));
          }
        }
      }
      ctx.putImageData(img, 0, 0);

      // Hanging grass blades over the lip.
      if (t.t === 'g' || t.t === 't') {
        for (let i = 0; i < 64; i += 3) {
          if (hash(i, t.x * 13 + t.y, 99) > 0.5) continue;
          const yTop = 16 + Math.floor((i < 32 ? i : 63 - i) / 2) + 1;
          const len = 3 + Math.floor(hash(i, t.y, 98) * 4);
          ctx.fillStyle = i < 32 ? '#2c6c2c' : '#3a8436';
          ctx.fillRect(i, yTop, 1, len);
        }
      }
      return { cv, depthPx };
    }

    tileImage(battle, t, now) {
      const frame = t.t === 'w' || t.t === 'f' ? Math.floor(now / 160) % WATER_FRAMES : 0;
      const key = `${t.x},${t.y},${frame}`;
      let e = this.cache.get(key);
      if (!e) {
        e = this.buildTile(battle, t, frame);
        this.cache.set(key, e);
      }
      return e;
    }

    // ---- Background ---------------------------------------------------------------
    buildBackground() {
      const cv = document.createElement('canvas');
      cv.width = this.W;
      cv.height = this.H;
      const g = cv.getContext('2d');
      const sky = g.createLinearGradient(0, 0, 0, this.H);
      sky.addColorStop(0, '#141a3c');
      sky.addColorStop(0.35, '#3c3c78');
      sky.addColorStop(0.6, '#b0607c');
      sky.addColorStop(0.75, '#f0a070');
      sky.addColorStop(1, '#f8d090');
      g.fillStyle = sky;
      g.fillRect(0, 0, this.W, this.H);
      // Dither the gradient into bands for a 16-bit feel.
      const img = g.getImageData(0, 0, this.W, this.H);
      for (let y = 0; y < this.H; y++)
        for (let x = 0; x < this.W; x++) {
          const i = (y * this.W + x) * 4;
          const b = ((x + y) & 1) * 6 - 3;
          for (let k = 0; k < 3; k++) img.data[i + k] = Math.round((img.data[i + k] + b) / 10) * 10;
        }
      g.putImageData(img, 0, 0);
      // Stars.
      for (let i = 0; i < 90; i++) {
        const y = hash(i, 5) * this.H * 0.4;
        g.fillStyle = `rgba(255,255,255,${0.3 + hash(i, 6) * 0.6 * (1 - y / (this.H * 0.4))})`;
        g.fillRect(Math.floor(hash(i, 4) * this.W), Math.floor(y), 1, 1);
      }
      // Sun.
      const sun = g.createRadialGradient(760, 330, 4, 760, 330, 120);
      sun.addColorStop(0, 'rgba(255,240,200,0.9)');
      sun.addColorStop(0.15, 'rgba(255,220,160,0.5)');
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(0, 0, this.W, this.H);
      // Mountain ranges, far to near.
      const ranges = [
        { base: 330, amp: 90, col: '#5c4c80', s: 1, f: 0.006 },
        { base: 380, amp: 70, col: '#3c3464', s: 2, f: 0.01 },
        { base: 440, amp: 50, col: '#28244c', s: 3, f: 0.016 },
      ];
      for (const r of ranges) {
        g.fillStyle = r.col;
        for (let x = 0; x < this.W; x++) {
          const n = vnoise(x * r.f, 0, r.s) * 0.7 + vnoise(x * r.f * 4, 1, r.s) * 0.3;
          const top = Math.round(r.base - n * r.amp);
          g.fillRect(x, top, 1, this.H - top);
        }
        // Haze at the base of each range.
        const hz = g.createLinearGradient(0, r.base - 20, 0, r.base + 60);
        hz.addColorStop(0, 'rgba(240,160,140,0)');
        hz.addColorStop(1, 'rgba(240,160,140,0.25)');
        g.fillStyle = hz;
        g.fillRect(0, r.base - 20, this.W, 80);
      }
      // Forest line.
      g.fillStyle = '#18203a';
      for (let x = 0; x < this.W; x += 3) {
        const top = 470 - Math.floor(vnoise(x * 0.08, 3, 4) * 26) - (x % 6 === 0 ? 4 : 0);
        g.fillRect(x, top, 3, this.H - top);
      }
      this.bg = cv;

      // Vignette overlay.
      const vg = document.createElement('canvas');
      vg.width = this.W;
      vg.height = this.H;
      const v = vg.getContext('2d');
      const rg = v.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.45, this.W / 2, this.H / 2, this.H * 0.95);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(1, 'rgba(8,4,20,0.55)');
      v.fillStyle = rg;
      v.fillRect(0, 0, this.W, this.H);
      this.vignette = vg;

      // Clouds.
      this.clouds = [0, 1, 2, 3, 4].map((i) => {
        const w = 120 + Math.floor(hash(i, 8) * 100);
        const h = 34;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const cg = c.getContext('2d');
        for (let k = 0; k < 9; k++) {
          const cx = 16 + hash(i, k + 20) * (w - 32);
          const cy = 18 + hash(i, k + 40) * 8;
          const r = 8 + hash(i, k + 60) * 10;
          cg.fillStyle = '#e8a0a8';
          cg.beginPath();
          cg.arc(cx, cy, r, 0, 6.29);
          cg.fill();
          cg.fillStyle = '#fcd0c0';
          cg.beginPath();
          cg.arc(cx - 2, cy - 3, r * 0.75, 0, 6.29);
          cg.fill();
        }
        return { c, x: hash(i, 9) * this.W, y: 90 + i * 45 + hash(i, 10) * 20, v: 0.004 + hash(i, 11) * 0.006, a: 0.35 + hash(i, 12) * 0.3 };
      });
    }

    drawBackground(now) {
      if (!this.bg) this.buildBackground();
      const ctx = this.ctx;
      ctx.drawImage(this.bg, 0, 0);
      for (const cl of this.clouds) {
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
    }

    draw(battle, ui, now) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.drawBackground(now);
      if (!battle) return;

      if (now < this.shakeT) {
        const k = (this.shakeT - now) / 250;
        ctx.translate(Math.round((Math.random() - 0.5) * this.shakeAmt * k), Math.round((Math.random() - 0.5) * this.shakeAmt * k));
      }

      const drawables = [];
      for (const t of this.tileOrder(battle)) drawables.push({ z: this.depth(t.x, t.y), sub: 0, t });
      for (const u of battle.units) {
        if (!u.alive && u.alpha <= 0) continue;
        const z = Math.max(this.depth(Math.floor(u.rx), Math.floor(u.ry)), this.depth(Math.ceil(u.rx), Math.ceil(u.ry)));
        drawables.push({ z, sub: 1, u });
      }
      drawables.sort((a, b) => a.z - b.z || a.sub - b.sub);

      for (const d of drawables) {
        if (d.t) this.drawTile(battle, d.t, ui, now);
        else this.drawUnit(d.u, battle, now);
      }

      this.drawEffects(now);
      this.drawMotes(now);
      this.drawFloaters(now);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.vignette, 0, 0);
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

    drawTile(battle, t, ui, now) {
      const ctx = this.ctx;
      const h = this.tileHeight(t);
      const [sx, sy] = this.project(t.x, t.y, h);
      const { cv } = this.tileImage(battle, t, now);
      ctx.drawImage(cv, Math.round(sx - 32), Math.round(sy - 16));

      // Faint tactical grid.
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      ctx.lineWidth = 1;
      this.diamond(Math.round(sx) + 0.5, Math.round(sy) + 0.5);
      ctx.stroke();

      const key = `${t.x},${t.y}`;
      const hl = ui.highlights && ui.highlights.get(key);
      if (hl) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 200);
        const col = hl === 'move' ? [90, 170, 255] : hl === 'aoe' ? [255, 214, 70] : [255, 80, 80];
        ctx.fillStyle = `rgba(${col},${0.28 + 0.14 * pulse})`;
        this.diamond(sx, sy, 1);
        ctx.fill();
        ctx.strokeStyle = `rgba(${col.map((c) => Math.min(255, c + 90))},${0.75 + 0.25 * pulse})`;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.25 * pulse})`;
        this.diamond(sx, sy, 4);
        ctx.stroke();
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
        // Corner brackets hovering above the tile.
        const bob = Math.sin(now / 180) * 2;
        ctx.fillStyle = '#fff';
        ctx.fillRect(Math.round(sx) - 1, Math.round(sy - 26 + bob), 3, 6);
      }

      if (t.t === 't' || t.t === 'r') {
        const variant = Math.floor(hash(t.x, t.y, 5) * 3);
        const img = CT.getDecor(t.t === 't' ? 'tree' : 'rock', variant);
        ctx.fillStyle = 'rgba(10,20,10,0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 1, t.t === 't' ? 20 : 14, t.t === 't' ? 8 : 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(img, Math.round(sx - img.width / 2), Math.round(sy - img.height + (t.t === 't' ? 4 : 5)));
      }
    }

    unitScreenPos(u) {
      return this.project(u.rx + u.ox, u.ry + u.oy, u.rh);
    }

    drawUnit(u, battle, now) {
      const ctx = this.ctx;
      const spr = CT.getSprite(u.key);
      const f = spr.frames[this.screenDir(u.face)] || spr.frames['south-east'];
      const [sx0, sy0] = this.unitScreenPos(u);
      const sx = Math.round(sx0);
      const sy = Math.round(sy0);
      const isActive = battle.active === u;
      const bob = isActive ? Math.round(Math.sin(now / 160) * 1) : 0;

      ctx.save();
      ctx.globalAlpha = u.alpha;
      // Soft shadow and team ring.
      ctx.fillStyle = 'rgba(10,8,24,0.35)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1, 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(10,8,24,0.25)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      const ring = u.team === 0 ? '110,190,255' : '255,100,100';
      ctx.strokeStyle = `rgba(${ring},${isActive ? 0.6 + 0.4 * Math.sin(now / 150) : 0.75})`;
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1, 17, 7, 0, 0, Math.PI * 2);
      ctx.stroke();

      const dx = Math.round(sx - f.cx);
      const dy = Math.round(sy - f.footY + 3 + bob);
      ctx.drawImage(f.img, dx, dy);
      if (u.flash > 0) {
        ctx.globalAlpha = u.alpha * Math.min(1, u.flash);
        ctx.drawImage(f.flash, dx, dy);
      }
      ctx.restore();

      const headY = dy + f.top;
      if (u.alive) {
        const bw = 28;
        const bx = sx - bw / 2;
        const by = headY - 9;
        ctx.fillStyle = 'rgba(12,10,24,0.85)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
        const fr = u.hp / u.maxHp;
        ctx.fillStyle = fr > 0.5 ? '#58e878' : fr > 0.25 ? '#f8d848' : '#f85848';
        ctx.fillRect(bx, by, Math.max(1, Math.round(bw * fr)), 3);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(bx, by, Math.max(1, Math.round(bw * fr)), 1);
      }

      if (isActive && u.alive) {
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
        ctx.strokeStyle = '#101018';
        ctx.beginPath();
        ctx.moveTo(sx, ay + 14);
        ctx.lineTo(sx - 7, ay + 2);
        ctx.lineTo(sx, ay - 5);
        ctx.lineTo(sx + 7, ay + 2);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // ---- Effects -------------------------------------------------------------------
    floatText(u, text, color) {
      const [sx, sy] = this.project(u.x, u.y, u.rh);
      this.floaters.push({ x: sx, y: sy - 58, text, color, t0: performance.now() });
    }

    drawFloaters(now) {
      const ctx = this.ctx;
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      this.floaters = this.floaters.filter((f) => now - f.t0 < 1200);
      for (const f of this.floaters) {
        const k = (now - f.t0) / 1200;
        // Bounce up then settle, FF-style.
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

    burst(x, y, h, elem) {
      const [sx, sy] = this.project(x, y, h);
      const colors = {
        fire: ['#ff5020', '#ffa030', '#ffe060'],
        ice: ['#a0e8ff', '#e0f8ff', '#60b0f0'],
        bolt: ['#fff8a0', '#ffffff', '#f0e040'],
        dark: ['#a060f0', '#602090', '#e0a0ff'],
        water: ['#4090f0', '#a0d0ff', '#2060c0'],
        laser: ['#ff60c0', '#60f0ff', '#ffffff'],
        heal: ['#80ff90', '#e0ffe0', '#40d060'],
        slash: ['#ffffff', '#d0e0ff', '#a0b0ff'],
        hit: ['#ffffff', '#ffe0a0', '#ffb060'],
      }[elem] || ['#ffffff'];
      const now = performance.now();
      const n = elem === 'hit' ? 14 : 30;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.6 + Math.random() * 2.6;
        this.particles.push({
          x: sx,
          y: sy - 20,
          vx: Math.cos(a) * sp,
          vy: elem === 'heal' ? -0.8 - Math.random() * 1.4 : Math.sin(a) * sp * 0.7 - 1.3,
          g: elem === 'heal' ? -0.01 : 0.09,
          c: colors[i % colors.length],
          t0: now,
          life: 500 + Math.random() * 500,
          s: elem === 'hit' ? 2 : 2 + Math.floor(Math.random() * 2),
        });
      }
      const glow = { fire: '255,120,40', ice: '140,220,255', bolt: '255,250,160', dark: '170,90,255', water: '80,150,255', laser: '255,120,220', heal: '120,255,150', slash: '220,230,255', hit: '255,240,200' }[elem] || '255,255,255';
      this.flashes.push({ x: sx, y: sy - 18, c: glow, t0: now, r: elem === 'hit' ? 22 : 40 });
      if (elem === 'bolt') this.bolts.push({ x: sx, y: sy - 16, t0: now });
      if (elem !== 'heal') this.shake(elem === 'hit' ? 3 : 6);
    }

    projectile(from, to, kind, dur) {
      this.shots.push({ from, to, kind, t0: performance.now(), dur });
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
        ctx.fillRect(Math.round(x), Math.round(y), p.s, p.s);
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

      this.shots = this.shots.filter((s) => now - s.t0 < s.dur);
      for (const s of this.shots) {
        const k = (now - s.t0) / s.dur;
        const x = s.from[0] + (s.to[0] - s.from[0]) * k;
        const y = s.from[1] + (s.to[1] - s.from[1]) * k - Math.sin(k * Math.PI) * 24;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
        g.addColorStop(0, s.kind === 'shot' ? 'rgba(255,230,120,0.9)' : 'rgba(220,230,255,0.8)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 10, y - 10, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      }
      ctx.restore();
    }

    // Drifting fireflies.
    drawMotes(now) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const m of this.motes) {
        const x = (m.x + Math.sin(now / 2100 + m.p) * 30 + now * 0.004 * m.s) % this.W;
        const y = m.y + Math.sin(now / 1300 + m.p * 2) * 16;
        const a = 0.35 + 0.35 * Math.sin(now / 400 + m.p * 3);
        ctx.fillStyle = `rgba(255,240,150,${a * 0.35})`;
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4);
        ctx.fillStyle = `rgba(255,255,210,${a})`;
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
      ctx.restore();
    }
  }

  CT.Renderer = Renderer;
})();
