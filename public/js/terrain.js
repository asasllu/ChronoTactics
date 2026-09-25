// Terrain materials and map decorations.
//
// CT.TERRAIN[code] describes one tile material:
//   name, walk (can stand), swim (only swimmers/floaters may stand),
//   void (no tile drawn, only floaters pass, falling in = KO),
//   lava (impassable, floaters may pass but not stop),
//   animated (top re-rendered per water frame),
//   top(p)  -> [r,g,b]          colour of a top-surface pixel
//   side(p) -> [r,g,b] | null   colour of a side-face pixel (null = transparent)
//   depthOffset                 visual sink of the top (water sits lower)
//
// See docs/ENGINE_SPEC.md for the `p` parameter objects.
//
// CT.DECOR[kind] describes an object standing on a tile (trees, tents...):
//   build(variant) -> canvas, variants, blocks, shadow [rx, ry], yOff,
//   light { color: 'r,g,b', radius, flicker }
(function () {
  const CT = (window.CT = window.CT || {});

  // ---- Noise & colour helpers (exported as CT.TX for other modules) -------------
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

  CT.TX = { hash, vnoise, hex, ramp, pick, scale, mixc, R, FOAM, MORTAR };

  // Shared side-face materials.
  function earthSide(p, lipRamp) {
    const { v, wu } = p;
    const lip = lipRamp ? 2 + Math.floor(hash(wu, 0, 61) * 4) : 1;
    if (v < lip) {
      const c = lipRamp ? (v === lip - 1 ? lipRamp[0] : pick(lipRamp, 0.4 + hash(wu, v, 62) * 0.4)) : R.dirt[3];
      return scale(c, p.k + 0.05);
    }
    const band = Math.floor((v + Math.sin(wu * 0.35) * 2 + hash(wu >> 3, 0, 63) * 3) / 7);
    let c = pick(band % 2 ? R.earth : R.earth2, hash(wu, v, 64) * 0.9);
    const cx = Math.floor(wu / 5);
    const cy = Math.floor((v + (cx % 2) * 2) / 4);
    if (hash(cx, cy, 65) > 0.9) c = pick(R.rockside, hash(wu, v, 66));
    if (lipRamp && hash(wu, v, 67) > 0.985) c = lipRamp[1];
    return p.fin(c);
  }
  function brickSide(p, ramp_, mortar = MORTAR) {
    const { v, wu } = p;
    const row = Math.floor(v / 6);
    const bx = (wu + (row % 2) * 6) % 12;
    if (v % 6 === 0 || bx === 0) return p.fin(mortar);
    return p.fin(pick(ramp_, hash(Math.floor((wu + (row % 2) * 6) / 12), row, 71) * 0.7 + hash(wu, v, 72) * 0.3));
  }
  function waterTop(p, base) {
    const { wx, wy, n, grain, ph, t } = p;
    const wave = Math.sin(wx * 9 + wy * 4 + ph) * 0.5 + Math.sin(wy * 13 - wx * 3 - ph) * 0.5;
    let c = pick(base, 0.45 + n * 0.35 + wave * 0.12);
    if (wave > 0.82 && grain > 0.5) c = mixc(c, FOAM, 0.55);
    // Foam where water meets land.
    const land = (dx, dy) => {
      const n2 = p.nb(dx, dy);
      return n2 && !CT.TERRAIN[n2.t].liquid && !CT.TERRAIN[n2.t].void;
    };
    const fxl = wx - t.x + 0.5;
    const fyl = wy - t.y + 0.5;
    const edge = Math.min(land(-1, 0) ? fxl : 9, land(1, 0) ? 1 - fxl : 9, land(0, -1) ? fyl : 9, land(0, 1) ? 1 - fyl : 9);
    const foamW = 0.08 + 0.06 * Math.sin(ph + (wx + wy) * 10);
    if (edge < foamW) c = mixc(c, FOAM, 0.85);
    else if (edge < foamW + 0.07) c = mixc(c, FOAM, 0.3);
    return c;
  }

  CT.TERRAIN = {
    g: {
      name: 'Grass', walk: true,
      top(p) {
        const { wx, wy, tx, ty, n, grain } = p;
        let c = pick(R.grass, n * 0.75 + grain * 0.3);
        if (grain > 0.965) c = R.grass[5];
        if (hash(tx >> 1, ty >> 1, 11) > 0.992) c = FLOWERS[Math.floor(hash(tx >> 1, ty >> 1, 12) * 4)];
        const worn = vnoise(wx * 1.3, wy * 1.3, 5);
        if (worn > 0.74) c = mixc(c, pick(R.dirt, grain), Math.min(1, (worn - 0.74) * 6));
        return c;
      },
      side: (p) => earthSide(p, R.grass),
      blades: '#2c6c2c',
    },
    d: {
      name: 'Dirt', walk: true,
      top(p) {
        const { wx, wy, tx, ty, n, grain } = p;
        let c = pick(R.dirt, n * 0.7 + grain * 0.35);
        if (hash(tx, ty, 21) > 0.975) c = R.stone[3];
        if (vnoise(wx * 1.6, wy * 1.6, 9) > 0.72) c = mixc(c, R.grass[2], 0.6);
        return c;
      },
      side: (p) => earthSide(p, null),
    },
    s: {
      name: 'Stone', walk: true,
      top(p) {
        const { wx, wy, grain } = p;
        const row = Math.floor(wy * 3);
        const col = Math.floor(wx * 3 + (row % 2) * 0.5);
        const fx = wx * 3 + (row % 2) * 0.5 - col;
        const fy = wy * 3 - row;
        if (fx < 0.06 || fy < 0.06) return MORTAR;
        let c = pick(R.stone, 0.25 + hash(col, row, 31) * 0.5 + (grain - 0.5) * 0.25);
        if (fx < 0.14 || fy < 0.14) c = scale(c, 1.12);
        if (vnoise(wx * 2, wy * 2, 13) > 0.8) c = mixc(c, R.grass[1], 0.5);
        return c;
      },
      side: (p) => brickSide(p, R.brick),
    },
    b: {
      name: 'Bridge', walk: true,
      top(p) {
        const { wx, wy } = p;
        const q = wx * 5;
        const plank = Math.floor(q);
        const fp = q - plank;
        if (fp < 0.1) return hex('#2c1a0c');
        let c = pick(R.wood, 0.3 + hash(plank, 0, 41) * 0.5 + (vnoise(plank * 7, wy * 12, 42) - 0.5) * 0.5);
        if (fp > 0.1 && fp < 0.2 && Math.abs((((wy % 1) + 1) % 1) - 0.18) < 0.05) c = hex('#c0c0c8');
        return c;
      },
      side(p) {
        const { v, wu } = p;
        if (v < 5) return p.fin(pick(R.wood, v === 0 ? 0.9 : 0.2 + hash(wu, v, 81) * 0.3));
        if (wu % 16 < 4) return p.fin(pick(R.wood, 0.1 + hash(wu, v, 82) * 0.2));
        return null; // open under the bridge
      },
    },
    w: {
      name: 'River', walk: false, swim: true, liquid: true, animated: true, depthOffset: 0.3,
      top: (p) => waterTop(p, R.water),
      side: (p) => p.fin(pick(R.water, 0.2 + hash(p.wu, p.v, 91) * 0.2)),
    },
    f: {
      name: 'Shallows', walk: true, liquid: true, animated: true, depthOffset: 0.15,
      top(p) {
        let c = waterTop(p, R.shallow);
        if (hash(p.tx >> 1, p.ty >> 1, 51) > 0.93) c = mixc(c, R.dirt[3], 0.45);
        return c;
      },
      side: (p) => p.fin(pick(R.shallow, 0.2 + hash(p.wu, p.v, 91) * 0.2)),
    },
  };

  // ---- Decorations ------------------------------------------------------------------
  const decorCache = {};
  CT.DECOR = CT.DECOR || {};
  CT.registerDecor = (kind, def) => {
    CT.DECOR[kind] = def;
  };
  CT.getDecor = function (kind, variant = 0) {
    const def = CT.DECOR[kind];
    if (!def) {
      console.warn('missing decor', kind);
      return CT.PX.canvas(8, 8);
    }
    const v = variant % (def.variants || 1);
    const k = kind + ':' + v;
    if (!decorCache[k]) decorCache[k] = def.build(v);
    return decorCache[k];
  };

  const { Grid, shadeGrid } = CT.PX;
  CT.registerDecor('tree', {
    blocks: true, variants: 3, shadow: [20, 8], yOff: 4,
    build(variant) {
      const seed = variant + 1;
      const g = new Grid(44, 58);
      let s = seed * 9301 + 49297;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
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
    },
  });
  CT.registerDecor('rock', {
    blocks: true, shadow: [14, 6], yOff: 5,
    build() {
      const g = new Grid(28, 18);
      g.ell(13, 10, 12, 7, 'r');
      g.ell(9, 8, 6, 4, 'q');
      g.ell(19, 11, 6, 5, 's');
      g.px(12, 6, 'L');
      g.px(7, 7, 'L');
      return shadeGrid(g, { r: '#9c9ca8', q: '#b4b4c0', s: '#8c8c98', L: '#e0e0e8' }, 'L');
    },
  });

  // ---- Map preparation ----------------------------------------------------------------
  // Turns a CT.MAPS entry into tiles + decor lookup used by the engine & renderer.
  // Legacy terrain codes 't' (tree) and 'r' (rock) become grass/dirt + decor.
  CT.prepareMap = function (def) {
    const H = def.terrain.length;
    const W = def.terrain[0].length;
    const decor = (def.decor || []).map((d) => ({ variant: 0, ...d }));
    const tiles = def.terrain.map((row, y) =>
      [...row].map((code, x) => {
        let t = code;
        if (t === 't') {
          t = 'g';
          decor.push({ x, y, kind: 'tree', variant: Math.floor(hash(x, y, 5) * 3) });
        } else if (t === 'r') {
          t = 'd';
          decor.push({ x, y, kind: 'rock' });
        }
        if (!CT.TERRAIN[t]) console.warn('unknown terrain', code, 'in', def.id);
        const hc = def.height[y][x];
        return { x, y, t, h: parseInt(hc, 36) || 0 };
      })
    );
    const decorAt = new Map();
    for (const d of decor) decorAt.set(`${d.x},${d.y}`, d);
    const zones = {};
    for (const [name, z] of Object.entries(def.zones || {})) {
      // A zone is [x0,y0,x1,y1] or a list of [x,y] tiles.
      const cells = [];
      if (typeof z[0] === 'number') {
        for (let y = z[1]; y <= z[3]; y++) for (let x = z[0]; x <= z[2]; x++) cells.push([x, y]);
      } else cells.push(...z);
      zones[name] = new Set(cells.map(([x, y]) => `${x},${y}`));
    }
    return { ...def, w: W, h: H, size: Math.max(W, H), tiles, decor, decorAt, zones };
  };
})();
