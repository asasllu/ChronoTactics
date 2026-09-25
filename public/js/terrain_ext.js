// terrain_ext.js — story-map terrain materials and decorations.
// Contract: docs/ENGINE_SPEC.md §5. Built-ins (g d s b w f, tree, rock) live in
// terrain.js; this module adds every material and decor kind the story maps use.
(function () {
  const CT = (window.CT = window.CT || {});
  const { hash, vnoise, hex, ramp, pick, scale, mixc, R, FOAM, MORTAR } = CT.TX;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const fract = (v) => v - Math.floor(v);

  // ---- Texture helpers ----------------------------------------------------------
  // Jittered-grid Worley noise: nearest (f1) and second-nearest (f2) feature
  // distance, the nearest cell's id hash and the offset from its feature point.
  function worley(x, y, s = 0, jit = 0.7) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let f1 = 9, f2 = 9, id = 0, ox = 0, oy = 0, cx0 = 0, cy0 = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx;
        const cy = yi + dy;
        const px = cx + 0.5 + (hash(cx, cy, s) - 0.5) * jit;
        const py = cy + 0.5 + (hash(cx, cy, s + 1) - 0.5) * jit;
        const ddx = x - px;
        const ddy = y - py;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = hash(cx, cy, s + 2);
          ox = ddx;
          oy = ddy;
          cx0 = cx;
          cy0 = cy;
        } else if (d < f2) f2 = d;
      }
    return { f1, f2, id, ox, oy, cx: cx0, cy: cy0 };
  }
  // Fractal value noise.
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.5 + vnoise(x * 2.03, y * 2.03, s + 1) * 0.3 + vnoise(x * 4.1, y * 4.1, s + 2) * 0.2;
  // Thin ridged line where a noise field crosses 0.5 (cracks, veins).
  const ridge = (x, y, s) => Math.abs(fbm(x, y, s) - 0.5);
  // Position inside the current tile, 0..1.
  const local = (p) => [p.wx - p.t.x + 0.5, p.wy - p.t.y + 0.5];
  const sameAs = (p, dx, dy, codes) => {
    const n = p.nb(dx, dy);
    return !!n && codes.includes(n.t) && n.h === p.t.h;
  };

  const P = {
    cobble: ramp(['#4c4450', '#5c525c', '#6c6068', '#7c7076', '#8e8284', '#a29690']),
    cobbleCool: ramp(['#464a58', '#555a68', '#666a78', '#787c88']),
    carpet: ramp(['#5c0c14', '#74121c', '#8c1a24', '#a4242c']),
    gold: ramp(['#6c5418', '#9c7c24', '#c8a038', '#ecd070']),
    plank: ramp(['#6a4222', '#80532c', '#966436', '#aa7640', '#be8a4e']),
    rock: ramp(['#4e5058', '#5e6068', '#6e7078', '#80828a', '#94969c', '#a8aab0']),
    moss: ramp(['#46583a', '#566a42', '#687c4a']),
    snow: ramp(['#a8b8d8', '#bccae4', '#d0dcf0', '#e2eaf8', '#f2f6ff']),
    ice: ramp(['#6ca4c8', '#84bcdc', '#9cd0ec', '#b8e2f6', '#d8f2ff']),
    ash: ramp(['#18161c', '#221e26', '#2c2830', '#38323a', '#464048']),
    lava: ramp(['#5c0c04', '#9c2008', '#d8480c', '#f47c14', '#fcb830', '#fff08c']),
    marble: ramp(['#98a8c4', '#aebcd4', '#c4d0e2', '#d6e0ee', '#e8eef8']),
    tgold: ramp(['#5c4c24', '#7c6830', '#9c8440', '#b89c50']),
    dream: ramp(['#2890c0', '#48c8f0', '#90f0ff', '#e0ffff']),
    ceramic: ramp(['#c4c8d4', '#d4d8e2', '#e2e6ee', '#eef0f6', '#f8f9fc']),
    seam: hex('#9cb4dc'),
    vein: ramp(['#1c0408', '#3c0810', '#8c1020', '#e02838', '#ff7078']),
    sea: ramp(['#0c2c50', '#123a64', '#184a78', '#205a8c', '#3070a4']),
    slate: ramp(['#262a38', '#2e3444', '#363e50', '#40485c', '#4c566c']),
    sand: ramp(['#b8945c', '#c8a468', '#d6b478', '#e2c488', '#eed4a0']),
    earth: R.earth,
    shelf: ramp(['#3c3440', '#4c4250', '#5c5260']),
  };

  // Side face in horizontal rock strata.
  function strataSide(p, rampA, rampB, crack = 0.93) {
    const { v, wu } = p;
    const band = Math.floor((v + Math.sin(wu * 0.25) * 2.5 + hash(wu >> 3, 0, 301) * 2) / 6);
    let c = pick(band % 2 ? rampA : rampB, 0.2 + hash(band, wu >> 2, 302) * 0.5 + hash(wu, v, 303) * 0.2);
    if ((v + Math.floor(Math.sin(wu * 0.25) * 2.5)) % 6 === 0) c = scale(c, 0.7);
    if (hash(wu >> 1, band, 304) > crack && hash(wu, v >> 2, 305) > 0.3) c = scale(c, 0.55);
    return c;
  }
  function blockSide(p, rmp, bw = 16, bh = 8, mortar = MORTAR, s = 311) {
    const { v, wu } = p;
    const row = Math.floor(v / bh);
    const bx = (wu + (row % 2) * (bw >> 1)) % bw;
    if (v % bh === 0 || bx === 0) return mortar;
    const id = hash(Math.floor((wu + (row % 2) * (bw >> 1)) / bw), row, s);
    let c = pick(rmp, 0.3 + id * 0.5 + hash(wu, v, s + 1) * 0.15);
    if (v % bh === 1 || bx === 1) c = scale(c, 1.1);
    return c;
  }

  const T = CT.TERRAIN;

  // c — cobblestones (Leene Square): rounded setts of mixed warm/cool stone.
  T.c = {
    name: 'Cobblestones', walk: true,
    top(p) {
      const w = worley(p.wx * 4.6, p.wy * 4.6, 401, 0.75);
      const edge = w.f2 - w.f1;
      if (edge < 0.1) {
        const dirt = pick(P.cobble, 0.05 + p.grain * 0.15);
        return vnoise(p.wx * 3, p.wy * 3, 402) > 0.7 ? mixc(dirt, R.grass[1], 0.5) : scale(dirt, 0.75);
      }
      const cool = w.id > 0.72;
      let c = pick(cool ? P.cobbleCool : P.cobble, 0.25 + (w.id % 0.25) * 2.4 + (p.grain - 0.5) * 0.12);
      const lit = -(w.ox + w.oy) * 0.9 - w.f1 * 0.35;
      c = scale(c, 1 + lit * 0.5);
      if (edge < 0.16) c = scale(c, 0.85);
      if (w.f1 < 0.12 && -(w.ox + w.oy) > 0.03) c = mixc(c, [230, 220, 210], 0.25);
      return c;
    },
    side: (p) => p.fin(blockSide(p, P.cobble, 12, 6, MORTAR, 403)),
  };

  // j — castle flagstones: dressed, polished stone (no moss), warm grey.
  const CASTLE = ramp(['#5c5660', '#6a6470', '#78727e', '#86808c', '#948e98']);
  T.j = {
    name: 'Flagstones', walk: true,
    top(p) {
      const { wx, wy, grain } = p;
      const row = Math.floor(wy * 2);
      const col = Math.floor(wx * 2 + (row % 2) * 0.5);
      const fx = wx * 2 + (row % 2) * 0.5 - col;
      const fy = wy * 2 - row;
      if (fx < 0.05 || fy < 0.05) return hex('#2c2830');
      let c = pick(CASTLE, 0.25 + hash(col, row, 591) * 0.5 + (grain - 0.5) * 0.2 + (p.n - 0.5) * 0.2);
      if (fx < 0.12 || fy < 0.12) c = scale(c, 1.1);
      if (fx > 0.93 || fy > 0.93) c = scale(c, 0.85);
      if (ridge(wx * 2, wy * 2, 592) < 0.01) c = scale(c, 0.75);
      return c;
    },
    side: (p) => p.fin(blockSide(p, CASTLE, 16, 8, hex('#2c2830'), 593)),
  };

  // e — red carpet with a gold edge (castle). Edges appear where the carpet ends.
  T.e = {
    name: 'Carpet', walk: true,
    top(p) {
      const [lx, ly] = local(p);
      const d = [];
      if (!sameAs(p, -1, 0, 'e')) d.push(lx);
      if (!sameAs(p, 1, 0, 'e')) d.push(1 - lx);
      if (!sameAs(p, 0, -1, 'e')) d.push(ly);
      if (!sameAs(p, 0, 1, 'e')) d.push(1 - ly);
      const e = d.length ? Math.min(...d) : 9;
      if (e < 0.05) return pick(P.gold, 0.1);
      if (e < 0.13) return pick(P.gold, 0.45 + p.grain * 0.3 + (e < 0.08 ? 0.25 : 0));
      if (e < 0.16) return pick(P.carpet, 0.05);
      if (e < 0.21 && e > 0.185) return pick(P.gold, 0.3);
      // Woven diamond lattice with gold studs at the crossings.
      const a = fract((p.wx + p.wy) * 2);
      const b = fract((p.wx - p.wy) * 2);
      const da = Math.abs(a - 0.5);
      const db = Math.abs(b - 0.5);
      let c = pick(P.carpet, 0.4 + p.n * 0.35 + (p.grain - 0.5) * 0.35);
      if (da > 0.44 && db > 0.44) return pick(P.gold, 0.55 + p.grain * 0.4);
      if (Math.min(da, db) > 0.455) c = scale(c, 0.72);
      else if (da < 0.1 && db < 0.1) c = mixc(c, P.carpet[3], 0.6);
      if ((p.tx + p.ty) % 2 === 0) c = scale(c, 0.94);
      return c;
    },
    side(p) {
      if (p.v < 3) return p.fin(pick(P.carpet, 0.5));
      if (p.v === 3) return p.fin(pick(P.gold, 0.6 + (p.wu % 2) * 0.3));
      return p.fin(blockSide(p, CASTLE, 16, 8, hex('#2c2830'), 411));
    },
  };

  // h — wooden floorboards (huts, stages).
  T.h = {
    name: 'Wood Floor', walk: true,
    top(p) {
      const q = p.wx * 4;
      const plank = Math.floor(q);
      const fp = q - plank;
      const seg = Math.floor(p.wy * 1.5 + hash(plank, 0, 421) * 7);
      const fy = fract(p.wy * 1.5 + hash(plank, 0, 421) * 7);
      if (fp < 0.07) return hex('#3a2210');
      if (fy < 0.03) return hex('#4a2c16');
      const id = hash(plank, seg, 422);
      let c = pick(P.plank, 0.2 + id * 0.55 + (vnoise(plank * 5 + fp * 2, p.wy * 14, 423) - 0.5) * 0.35);
      if (fp < 0.14) c = scale(c, 1.12);
      if (fp > 0.9) c = scale(c, 0.85);
      if ((fy < 0.07 || fy > 0.95) && Math.abs(fp - 0.5) < 0.09) c = hex('#2c1c10');
      return c;
    },
    side(p) {
      const { v, wu } = p;
      if (v < 3) return p.fin(pick(P.plank, 0.7));
      const log = Math.floor((v - 3) / 7);
      const fv = (v - 3) % 7;
      if (fv === 0) return p.fin(hex('#2c1a0c'));
      let c = pick(P.plank, 0.15 + hash(log, wu >> 4, 424) * 0.4 + (fv < 2 ? 0.25 : 0) - (fv > 5 ? 0.12 : 0));
      if (hash(wu, v, 425) > 0.96) c = scale(c, 0.8);
      return p.fin(c);
    },
  };

  // p — grey mountain rock with lichen and cracks.
  T.p = {
    name: 'Rock', walk: true,
    top(p) {
      const { wx, wy, grain } = p;
      const w = worley(wx * 2.2, wy * 2.2, 431, 0.9);
      let c = pick(P.rock, 0.3 + fbm(wx * 1.5, wy * 1.5, 432) * 0.5 + (grain - 0.5) * 0.18 + (w.id - 0.5) * 0.15);
      const lit = -(w.ox + w.oy) * 0.4;
      c = scale(c, 1 + lit * 0.35);
      if (w.f2 - w.f1 < 0.05) c = scale(c, 0.62);
      else if (w.f2 - w.f1 < 0.09) c = scale(c, 0.85);
      if (ridge(wx * 1.2, wy * 1.2, 433) < 0.012) c = scale(c, 0.6);
      const moss = fbm(wx * 0.9, wy * 0.9, 434);
      if (moss > 0.62) c = mixc(c, pick(P.moss, grain), clamp((moss - 0.62) * 5));
      if (grain > 0.985) c = P.rock[5];
      return c;
    },
    side: (p) => {
      if (p.v < 2) return p.fin(pick(P.rock, 0.7));
      return p.fin(strataSide(p, P.rock, ramp(['#50525a', '#62646c', '#72747c'])));
    },
  };

  // n — snow with wind drifts.
  T.n = {
    name: 'Snow', walk: true,
    top(p) {
      const { wx, wy, grain } = p;
      const drift = Math.sin(wx * 4.2 + wy * 1.6 + fbm(wx * 0.8, wy * 0.8, 441) * 7);
      let c = pick(P.snow, 0.55 + drift * 0.22 + (p.n - 0.5) * 0.3);
      if (drift > 0.82) c = mixc(c, P.snow[1], 0.5);
      if (drift < -0.9) c = mixc(c, [255, 255, 255], 0.4);
      if (grain > 0.975) c = [255, 255, 255];
      if (hash(p.tx >> 2, p.ty >> 2, 442) > 0.985) c = mixc(c, P.rock[2], 0.55);
      return c;
    },
    side(p) {
      const { v, wu } = p;
      const lip = 3 + Math.floor(hash(wu >> 1, 0, 443) * 3);
      if (v < lip) return p.fin(pick(P.snow, 0.6 + hash(wu, v, 444) * 0.3));
      if (v < lip + 4 && hash(wu, 0, 445) > 0.8) return p.fin(pick(P.ice, 0.7)); // icicles
      const c = strataSide(p, ramp(['#5c6478', '#6c7488', '#7c849a']), ramp(['#4c5468', '#5c6478']));
      return p.fin(hash(wu, v, 446) > 0.97 ? P.snow[2] : c);
    },
  };

  // i — ice sheet with cracks and glossy streaks.
  T.i = {
    name: 'Ice', walk: true,
    top(p) {
      const { wx, wy, grain } = p;
      let c = pick(P.ice, 0.35 + fbm(wx * 1.2, wy * 1.2, 451) * 0.45);
      const streak = fract((wx - wy) * 1.6 + vnoise(wx, wy, 452) * 0.3);
      if (streak < 0.05) c = mixc(c, [255, 255, 255], 0.6);
      else if (streak < 0.1) c = mixc(c, [255, 255, 255], 0.25);
      const w = worley(wx * 1.8, wy * 1.8, 453, 0.9);
      if (w.f2 - w.f1 < 0.03) c = mixc(c, [255, 255, 255], 0.7);
      if (fbm(wx * 2, wy * 2, 454) < 0.3) c = mixc(c, P.ice[0], 0.4);
      if (grain > 0.99) c = [255, 255, 255];
      return c;
    },
    side(p) {
      const { v, wu } = p;
      let c = pick(P.ice, 0.3 + hash(wu >> 1, 0, 455) * 0.3 - v * 0.01);
      if (hash(wu, 0, 456) > 0.85) c = mixc(c, [255, 255, 255], 0.4);
      return p.fin(c);
    },
  };

  // a — black volcanic ash rock (basalt plates, grey ash, faint ember cracks).
  T.a = {
    name: 'Ash Rock', walk: true,
    top(p) {
      const { wx, wy, grain } = p;
      const w = worley(wx * 2.6, wy * 2.6, 461, 0.85);
      const edge = w.f2 - w.f1;
      let c = pick(P.ash, 0.3 + w.id * 0.45 + (grain - 0.5) * 0.2);
      c = scale(c, 1 - (w.ox + w.oy) * 0.35);
      if (edge < 0.045) {
        const hot = fbm(wx * 0.7, wy * 0.7, 462);
        c = hot > 0.6 ? mixc(P.lava[1], P.lava[3], clamp((hot - 0.6) * 4)) : P.ash[0];
      }
      const ashd = fbm(wx * 1.1, wy * 1.1, 463);
      if (ashd > 0.6) c = mixc(c, hex('#6c646c'), clamp((ashd - 0.6) * 3) * (0.5 + grain * 0.5));
      if (grain > 0.975) c = hex('#8c848c');
      return c;
    },
    side(p) {
      const { v, wu } = p;
      const col = Math.floor(wu / 6);
      const fu = wu % 6;
      const off = Math.floor(hash(col, 0, 464) * 8);
      if (fu === 0 || (v + off) % 11 === 0) return p.fin(hex('#0c0a10'));
      let c = pick(P.ash, 0.35 + hash(col, (v + off) / 11 | 0, 465) * 0.45 + (fu === 1 ? 0.2 : 0));
      if (v > p.depthPx - 6 && hash(wu, v, 466) > 0.7) c = mixc(c, P.lava[2], 0.35);
      return p.fin(c);
    },
  };

  // A — ashen scree: lighter volcanic gravel and tuff for crater rims and slopes.
  T.A = {
    name: 'Scree', walk: true,
    top(p) {
      const { wx, wy, grain } = p;
      const w = worley(wx * 5, wy * 5, 581, 0.9);
      let c = mixc(hex('#4c4448'), hex('#6c6064'), fbm(wx * 1.3, wy * 1.3, 582) * 0.8 + (grain - 0.5) * 0.3);
      if (w.f1 < 0.22 && w.id > 0.55) c = scale(mixc(hex('#2c2830'), hex('#5c5458'), w.id), 1 - (w.ox + w.oy) * 0.8);
      if (grain > 0.975) c = hex('#9c9094');
      if (fbm(wx * 0.8, wy * 0.8, 583) > 0.66) c = mixc(c, hex('#7c5c4c'), 0.35);
      return c;
    },
    side(p) {
      if (p.v < 2) return p.fin(hex('#5c5458'));
      return p.fin(strataSide(p, ramp(['#4c3c38', '#5c4a44', '#6c5850']), ramp(['#3c3438', '#4c4248']), 0.95));
    },
  };

  // l — lava: flowing crust plates over glowing melt (animated).
  T.l = {
    name: 'Lava', walk: false, lava: true, liquid: true, animated: true, noRim: true, depthOffset: 0.2,
    glow: '255,120,40',
    top(p) {
      const { wx, wy, ph, grain } = p;
      const fx = wx * 2.4 + Math.sin(ph + wy * 2.1) * 0.12;
      const fy = wy * 2.4 + Math.cos(ph + wx * 1.7) * 0.12;
      const w = worley(fx, fy, 471, 0.8);
      const edge = w.f2 - w.f1;
      const heat = 0.5 + 0.5 * Math.sin(ph * 1 + (wx + wy) * 3 + w.id * 6);
      let c;
      if (edge < 0.09 + heat * 0.05) c = pick(P.lava, 0.72 + (0.09 - edge) * 2 + heat * 0.15);
      else if (edge < 0.2) c = pick(P.lava, 0.48 + heat * 0.15);
      else c = pick(P.lava, 0.08 + w.id * 0.22 + heat * 0.1 + (grain - 0.5) * 0.1);
      // Crust darkening at the plate centre.
      if (edge > 0.3 && w.f1 < 0.18) c = scale(c, 0.75);
      if (grain > 0.985) c = P.lava[5];
      return c;
    },
    side(p) {
      const { v, wu } = p;
      const t = fract(v / 18 - hash(wu >> 2, 0, 472) + (p.t.x + p.t.y) * 0.1);
      const c = pick(P.lava, 0.45 + Math.sin(t * 6.28) * 0.25 + hash(wu, v, 473) * 0.15 - v * 0.004);
      return scale(c, p.face === 0 ? 0.85 : 1);
    },
  };

  // m — Zeal marble: blue-white slabs, veins, tarnished gold trim, rare dreamstone cracks.
  function marbleBase(p) {
    const { wx, wy, grain } = p;
    const vein = Math.abs(Math.sin((wx * 0.7 + wy * 0.4) * 5 + fbm(wx * 1.5, wy * 1.5, 481) * 6));
    let c = pick(P.marble, 0.45 + p.n * 0.35 + (grain - 0.5) * 0.12);
    if (vein < 0.07) c = mixc(c, hex('#7c8ca8'), 0.55);
    else if (vein < 0.14) c = mixc(c, hex('#8c9cb8'), 0.2);
    return c;
  }
  function marbleSlab(p, c) {
    // 2x2 slabs per tile, offset rows; gold trim along the slab joints.
    const sx = p.wx * 1.5 + 0.25;
    const sy = p.wy * 1.5 + 0.25;
    const row = Math.floor(sy);
    const fx = fract(sx + (row % 2) * 0.5);
    const fy = fract(sy);
    const e = Math.min(fx, 1 - fx, fy, 1 - fy);
    c = scale(c, 0.95 + hash(Math.floor(sx + (row % 2) * 0.5), row, 486) * 0.1);
    if (e < 0.03) {
      let g = pick(P.tgold, 0.35 + p.grain * 0.4);
      if (fbm(p.wx * 2, p.wy * 2, 482) > 0.6) g = mixc(g, hex('#4c7064'), 0.6); // verdigris
      return g;
    }
    if (e < 0.05) return scale(c, 0.84);
    if (fx < 0.09 || fy < 0.09) c = scale(c, 1.06);
    return c;
  }
  T.m = {
    name: 'Zeal Marble', walk: true,
    top(p) {
      let c = marbleSlab(p, marbleBase(p));
      if (vnoise(p.wx * 0.6, p.wy * 0.6, 483) > 0.78 && ridge(p.wx * 1.6, p.wy * 1.6, 484) < 0.012) c = P.dream[2];
      return c;
    },
    side(p) {
      const { v } = p;
      if (v === 2 || v === 3) return p.fin(pick(P.tgold, 0.5 + (v === 2 ? 0.3 : 0)));
      if (v < 2) return p.fin(P.marble[3]);
      return p.fin(blockSide(p, P.marble, 20, 10, hex('#6c7890'), 485));
    },
  };

  // y — dreamstone-cracked marble: glowing cyan crack network.
  T.y = {
    name: 'Dreamstone Marble', walk: true, glow: '120,230,255',
    top(p) {
      let c = marbleSlab(p, marbleBase(p));
      const w = worley(p.wx * 2.4, p.wy * 2.4, 491, 0.95);
      const e = w.f2 - w.f1;
      const zone = vnoise(p.wx * 0.9, p.wy * 0.9, 492);
      const r = ridge(p.wx * 1.4, p.wy * 1.4, 493);
      const crack = Math.min(e * (1.4 - zone * 0.8), r * 3);
      if (crack < 0.03) c = P.dream[3];
      else if (crack < 0.055) c = P.dream[2];
      else if (crack < 0.1) c = mixc(c, P.dream[1], 0.45);
      else if (crack < 0.16) c = mixc(c, P.dream[1], 0.15);
      return c;
    },
    side(p) {
      const base = T.m.side(p);
      if (hash(p.wu >> 1, p.v >> 2, 494) > 0.93) return P.dream[2];
      return base;
    },
  };

  // k — Hollow ceramic: glossy white tiles, faint blue seams.
  function ceramicTop(p) {
    const sx = p.wx * 2 + 0.5;
    const sy = p.wy * 2 + 0.5;
    const fx = fract(sx);
    const fy = fract(sy);
    const e = Math.min(fx, 1 - fx, fy, 1 - fy);
    if (e < 0.03) return P.seam;
    const chk = (Math.floor(sx) + Math.floor(sy)) & 1;
    let c = pick(P.ceramic, 0.5 - chk * 0.18 + (hash(Math.floor(sx), Math.floor(sy), 501) - 0.5) * 0.2 + (p.grain - 0.5) * 0.06 - (fx + fy) * 0.12);
    if (e < 0.06) c = mixc(c, P.seam, 0.3);
    // Glossy glint.
    const gl = Math.abs(fx - fy - 0.1);
    if (gl < 0.05 && fx > 0.2 && fx < 0.55) c = mixc(c, [255, 255, 255], 0.7);
    return c;
  }
  function ceramicSide(p) {
    const { v, wu } = p;
    if (v < 2) return p.fin(P.ceramic[4]);
    if (v % 12 === 2) return p.fin(P.seam);
    if (wu % 16 === 0) return p.fin(mixc(P.ceramic[1], P.seam, 0.5));
    return p.fin(pick(P.ceramic, 0.75 - (v % 12) * 0.03 + hash(wu, v, 502) * 0.05));
  }
  T.k = { name: 'Ceramic', walk: true, top: ceramicTop, side: ceramicSide };

  // K — ceramic split by red-black Lavos veins.
  function veinAt(wx, wy) {
    const r1 = ridge(wx * 0.9, wy * 0.9, 511);
    const r2 = ridge(wx * 1.9 + 3, wy * 1.9, 512);
    return Math.min(r1 * 1.2, r2 * 2.2 + 0.02);
  }
  T.K = {
    name: 'Veined Ceramic', walk: true, glow: '255,40,60',
    top(p) {
      let c = ceramicTop(p);
      const v = veinAt(p.wx, p.wy);
      if (v < 0.005) return P.vein[4];
      if (v < 0.011) return P.vein[3];
      if (v < 0.02) return P.vein[1 + (p.grain > 0.6 ? 1 : 0)];
      if (v < 0.03) return P.vein[0];
      if (v < 0.05) c = mixc(c, hex('#7c4858'), 0.3);
      return c;
    },
    side(p) {
      const v = veinAt(p.wu * 0.03, p.v * 0.03 + p.t.y);
      if (v < 0.012) return P.vein[3];
      if (v < 0.03) return p.fin(P.vein[1]);
      return ceramicSide(p);
    },
  };

  // O — Hollow inlay: graphite-blue glazed tiles set into the white floors.
  T.O = {
    name: 'Inlay', walk: true,
    top(p) {
      const sx = p.wx * 2 + 0.5;
      const sy = p.wy * 2 + 0.5;
      const fx = fract(sx);
      const fy = fract(sy);
      const e = Math.min(fx, 1 - fx, fy, 1 - fy);
      if (e < 0.04) return hex('#a8c0e0');
      const vein = Math.abs(Math.sin((p.wx * 0.6 + p.wy) * 4 + fbm(p.wx, p.wy, 561) * 5));
      let c = mixc(hex('#3c4660'), hex('#566282'), 0.35 + (hash(Math.floor(sx), Math.floor(sy), 562) - 0.5) * 0.4 - (fx + fy) * 0.15);
      if (vein < 0.08) c = mixc(c, hex('#8c9cc0'), 0.5);
      const gl = Math.abs(fx - fy - 0.1);
      if (gl < 0.04 && fx > 0.2 && fx < 0.5) c = mixc(c, [255, 255, 255], 0.45);
      return c;
    },
    side: (p) => ceramicSide(p),
  };

  // z — trodden snow path (packed snow, slush and footprints).
  T.z = {
    name: 'Snow Path', walk: true,
    top(p) {
      const { wx, wy, grain } = p;
      let c = mixc(pick(P.snow, 0.3 + p.n * 0.4), hex('#8c8494'), 0.25 + fbm(wx * 1.4, wy * 1.4, 571) * 0.3);
      const fp = worley(wx * 3.2, wy * 3.2, 572, 0.5);
      if (fp.f1 < 0.16 && hash(fp.cx, fp.cy, 573) > 0.45) c = scale(c, 0.82);
      if (grain > 0.97) c = [255, 255, 255];
      if (fbm(wx * 2, wy * 2, 574) > 0.68) c = mixc(c, hex('#6c5c50'), 0.4);
      return c;
    },
    side: (p) => T.n.side(p),
  };

  // v — void: nothing is drawn; only floaters cross.
  T.v = { name: 'Void', walk: false, void: true, top: () => [0, 0, 0], side: () => null };

  // W — deep sea.
  T.W = {
    name: 'Deep Sea', walk: false, swim: true, liquid: true, animated: true, depthOffset: 0.35,
    top(p) {
      const { wx, wy, ph, grain } = p;
      const swell = Math.sin(wx * 3 + wy * 5 + ph) * 0.5 + Math.sin(wy * 7 - wx * 2 - ph * 2) * 0.35;
      let c = pick(P.sea, 0.4 + p.n * 0.3 + swell * 0.2);
      if (swell > 0.72 && grain > 0.45) c = mixc(c, FOAM, 0.5);
      const land = (dx, dy) => {
        const n = p.nb(dx, dy);
        return n && !CT.TERRAIN[n.t].liquid && !CT.TERRAIN[n.t].void;
      };
      const [lx, ly] = local(p);
      const edge = Math.min(land(-1, 0) ? lx : 9, land(1, 0) ? 1 - lx : 9, land(0, -1) ? ly : 9, land(0, 1) ? 1 - ly : 9);
      const fw = 0.1 + 0.07 * Math.sin(ph + (wx + wy) * 8);
      if (edge < fw) c = mixc(c, FOAM, 0.85);
      else if (edge < fw + 0.1) c = mixc(c, FOAM, 0.3);
      return c;
    },
    side: (p) => p.fin(pick(P.sea, 0.15 + hash(p.wu, p.v, 521) * 0.2)),
  };

  // o — End of Time slate: dark flagstones on floating islands.
  T.o = {
    name: 'Slate', walk: true,
    top(p) {
      const { wx, wy, grain } = p;
      const w = worley(wx * 2.2, wy * 2.2, 531, 0.6);
      const e = w.f2 - w.f1;
      if (e < 0.06) return hex('#12141c');
      let c = pick(P.slate, 0.25 + w.id * 0.55 + (grain - 0.5) * 0.15);
      c = scale(c, 1 - (w.ox + w.oy) * 0.3);
      if (e < 0.1) c = mixc(c, hex('#5c6c90'), 0.35);
      if (grain > 0.99) c = hex('#8c9cc0');
      return c;
    },
    side(p) {
      const { v, wu, depthPx } = p;
      // Jagged, tapering underside: islands float in the void.
      const cut = depthPx * (0.55 + 0.45 * vnoise(wu * 0.25, 0, 532)) + 4;
      if (v > cut) return null;
      if (v < 3) return p.fin(pick(P.slate, 0.8));
      let c = strataSide(p, ramp(['#22252e', '#2a2e38', '#343844']), ramp(['#1c1e26', '#262a34']));
      if (v > cut - 3) c = scale(c, 0.7);
      return p.fin(c);
    },
  };

  // q — sand / beach.
  T.q = {
    name: 'Sand', walk: true,
    top(p) {
      const { wx, wy, grain } = p;
      const rip = Math.sin(wx * 9 + wy * 3 + fbm(wx, wy, 541) * 5);
      let c = pick(P.sand, 0.45 + rip * 0.15 + (p.n - 0.5) * 0.35 + (grain - 0.5) * 0.15);
      if (grain > 0.985) c = hex('#fff0d0');
      if (hash(p.tx >> 1, p.ty >> 1, 542) > 0.996) c = hex('#f0a0a0');
      return c;
    },
    side(p) {
      if (p.v < 3) return p.fin(pick(P.sand, 0.4 + hash(p.wu, p.v, 543) * 0.3));
      return p.fin(strataSide(p, ramp(['#8c6c44', '#9c7c50', '#ac8c5c']), ramp(['#7c5c3c', '#8c6c48'])));
    },
  };

  // S — archive stack: shelf-block walkway, sides full of porcelain tablets.
  T.S = {
    name: 'Archive Stack', walk: true,
    top(p) {
      const [lx, ly] = local(p);
      const rail = Math.min(lx, 1 - lx, ly, 1 - ly);
      if (rail < 0.06) return hex('#8c94a8');
      if (rail < 0.09) return hex('#5c6478');
      // Perforated walkway grating.
      const gx = fract(p.wx * 10);
      const gy = fract(p.wy * 10);
      let c = pick(P.ceramic, 0.3 + p.n * 0.25);
      if (gx < 0.3 && gy < 0.3) c = hex('#9ca4b8');
      return c;
    },
    side(p) {
      const { v, wu } = p;
      if (v < 3) return p.fin(P.ceramic[3]);
      const sv = (v - 3) % 12;
      if (sv === 0 || sv === 1) return p.fin(sv ? P.ceramic[1] : hex('#8c94a8'));
      if (wu % 32 < 2) return p.fin(P.ceramic[2]); // upright
      // Tablets of varied height/width.
      const slot = Math.floor(wu / 3);
      const hgt = 5 + Math.floor(hash(slot, (v - 3) / 12 | 0, 551) * 5);
      if (12 - sv > hgt || wu % 3 === 0) return p.fin(pick(P.shelf, 0.3));
      const id = hash(slot, (v - 3) / 12 | 0, 552);
      let c = id > 0.92 ? hex('#c83040') : id > 0.8 ? hex('#8cb0e0') : pick(P.ceramic, 0.3 + id * 0.6);
      if (sv === 12 - hgt + 2) c = scale(c, 0.8);
      return p.fin(c);
    },
  };
})();

// ================================================================================
// Decorations (CT.registerDecor). 48px-class pixel art built with CT.PX.Grid and
// shadeGrid(hi=true); light from the top-left. Glass, glow and light pillars are
// painted over the shaded art with the 2D context.
// ================================================================================
(function () {
  const CT = (window.CT = window.CT || {});
  const { Grid, shadeGrid, canvas } = CT.PX;
  const { hash } = CT.TX;
  const sg = (g, pal, detail = '') => shadeGrid(g, pal, detail, true);
  const reg = CT.registerDecor;

  // Iso box: top diamond + two side faces (letters for top, left, right).
  function isoBox(g, cx, top, hw, hh, depth, lt, ll, lr) {
    const mid = top + hh;
    const bot = top + hh * 2;
    g.tri(cx - hw, mid, cx, top, cx + hw, mid, lt);
    g.tri(cx - hw, mid, cx, bot, cx + hw, mid, lt);
    g.tri(cx - hw, mid, cx, bot, cx - hw, mid + depth, ll);
    g.tri(cx, bot, cx, bot + depth, cx - hw, mid + depth, ll);
    g.tri(cx + hw, mid, cx, bot, cx + hw, mid + depth, lr);
    g.tri(cx, bot, cx, bot + depth, cx + hw, mid + depth, lr);
  }
  // Pre-rendered animation frames, cached per variant.
  function frameSet(n, make) {
    const cache = {};
    return (v) => (cache[v] = cache[v] || Array.from({ length: n }, (_, i) => make(v, i)));
  }
  const cloneCv = (src, pad = 0) => canvas(src.width + pad * 2, src.height + pad * 2, (g) => g.drawImage(src, pad, pad));
  function px(g, x, y, col, a = 1) {
    g.fillStyle = a < 1 ? `rgba(${col},${a})` : `rgb(${col})`;
    g.fillRect(x, y, 1, 1);
  }
  // Soft glassy overlay for vitrines: pale fill, bright edges, diagonal glints.
  function glass(g, x0, y0, x1, y1, cracked = false) {
    g.fillStyle = 'rgba(190,230,255,0.22)';
    g.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(x0, y0, x1 - x0 + 1, 1);
    g.fillRect(x0, y0, 1, y1 - y0 + 1);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 3; i++) {
      const sx = x0 + 3 + i * 5;
      for (let k = 0; k < Math.min(y1 - y0, 40); k++) {
        const xx = sx + Math.floor(k * 0.5);
        if (xx <= x1 - 1 && i !== 1) g.fillRect(xx, y0 + 4 + k, 1, 1);
      }
    }
    if (cracked) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      const cx = (x0 + x1) / 2 + 3;
      const cy = (y0 + y1) / 2 - 6;
      for (let a = 0; a < 7; a++) {
        const ang = a * 0.9 + 0.3;
        let x = cx;
        let y = cy;
        const len = 8 + hash(a, 1, 7) * 14;
        for (let s = 0; s < len; s++) {
          x += Math.cos(ang + Math.sin(s * 0.7) * 0.3);
          y += Math.sin(ang + Math.sin(s * 0.7) * 0.3);
          if (x > x0 && x < x1 && y > y0 && y < y1) g.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      }
    }
  }

  // Tiny 3x5 font for placards.
  const FONT = {
    A: '010101111101101', C: '011100100100011', E: '111100110100111', G: '011100101101011', J: '001001001101010',
    L: '100100100100111', N: '101111111111101', O: '010101101101010', R: '110101110101101', S: '011100010001110',
    U: '101101101101111', Y: '101101010010010', Y2: '', I: '111010010010111', T: '111010010010010', D: '110101101101110',
    M: '101111111101101', H: '101101111101101', B: '110101110101110', V: '101101101101010', '0': '111101101101111',
    '-': '000000111000000', ' ': '000000000000000', '.': '000000000000010', K: '101101110101101', P: '110101110100100',
  };
  function text3(g, x, y, str, col) {
    for (const ch of str) {
      const f = FONT[ch] || FONT[' '];
      for (let i = 0; i < 15; i++) if (f[i] === '1') g.px(x + (i % 3), y + Math.floor(i / 3), col);
      x += 4;
    }
  }

  // ---- Trees & plants --------------------------------------------------------
  function pineGrid(variant, snowy) {
    const g = new Grid(36, 64);
    let s = variant * 7919 + 17;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    g.rect(16, 50, 19, 62, 't');
    g.rect(14, 60, 21, 62, 't');
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const top = 2 + i * 9;
      const base = top + 15 + (i === tiers - 1 ? 1 : 0);
      const hw = 5 + i * 3 + (variant ? 1 : 0);
      g.tri(17.5 - hw, base, 17.5 + hw, base, 17.5, top, i % 2 ? 'b' : 'a');
      for (let k = 0; k < hw; k += 3) {
        g.spike(17.5 - hw + k + 1, base - 1, 17.5 - hw + k - 1 + rnd() * 2, base + 2, 3, i % 2 ? 'b' : 'a');
        g.spike(17.5 + hw - k - 1, base - 1, 17.5 + hw - k + 1 - rnd() * 2, base + 2, 3, i % 2 ? 'b' : 'a');
      }
      g.line(17.5 - hw + 3, base - 1, 17.5 + hw - 3, base - 1, 'd');
      if (snowy) {
        g.tri(17.5 - hw * 0.55, top + 8, 17.5 + hw * 0.35, top + 8, 17.5, top, 'w');
        for (let k = -hw + 2; k < hw - 2; k += 2) if (rnd() > 0.35) g.px(17.5 + k, base - 2 - Math.floor(rnd() * 2), 'w');
      }
    }
    for (let i = 0; i < 10; i++) g.px(10 + rnd() * 12, 10 + rnd() * 40, 'L');
    return g;
  }
  reg('pine', {
    blocks: true, variants: 2, shadow: [15, 6], yOff: 4,
    build: (v) => sg(pineGrid(v, false), { t: '#6c4428', a: '#2c6848', b: '#347854', d: '#1c4434', L: '#5c9c6c' }, 'Ld'),
  });
  reg('snow_pine', {
    blocks: true, variants: 2, shadow: [15, 6], yOff: 4,
    build: (v) => sg(pineGrid(v, true), { t: '#5c4030', a: '#2c5c50', b: '#346858', d: '#1c3c38', w: '#eef4ff', L: '#e0ecff' }, 'Ld'),
  });
  reg('bush', {
    blocks: true, variants: 2, shadow: [14, 5], yOff: 4,
    build(v) {
      const g = new Grid(32, 24);
      g.ell(16, 15, 14, 8, 'a');
      g.ell(10, 11, 8, 6, 'b');
      g.ell(21, 10, 8, 6, 'c');
      g.ell(15, 7, 6, 5, 'b');
      for (let i = 0; i < 9; i++) g.px(5 + hash(i, v, 3) * 22, 5 + hash(i, v, 4) * 14, v ? 'F' : 'G');
      return sg(g, { a: '#2c6c34', b: '#3c8440', c: '#347c3c', F: '#f8a0c0', G: '#f8f0a0' }, 'FG');
    },
  });
  reg('fern', {
    blocks: false, variants: 2, yOff: 3,
    build(v) {
      const g = new Grid(56, 44);
      const fronds = v ? 9 : 8;
      for (let f = 0; f < fronds; f++) {
        const ang = Math.PI * (1.12 + (f / (fronds - 1)) * 0.76);
        const len = 21 + hash(f, v, 5) * 8 - Math.abs(f - (fronds - 1) / 2) * 0.8;
        const letter = 'abc'[f % 3];
        for (let s = 0; s <= len; s++) {
          const t = s / len;
          const x = 28 + Math.cos(ang) * s;
          const y = 40 + Math.sin(ang) * s * 1.35 + t * t * 16;
          g.px(x, y, 'r');
          if (s > 1) {
            const l = 5 * (1 - t) + 1.5;
            for (const side of [-1.25, 1.25]) g.line(x, y, x + Math.cos(ang + side) * l, y + Math.sin(ang + side) * l * 0.8 + 1, letter);
          }
        }
      }
      return sg(g, { a: '#3c9440', b: '#4ea848', c: '#62b850', r: '#2c6c30' }, 'r');
    },
  });
  reg('flowers', {
    blocks: false, variants: 3, flat: true,
    build(v) {
      return canvas(40, 22, (g) => {
        const cols = [['248,240,248', '248,216,80'], ['248,144,184', '255,255,255'], ['168,200,255', '248,224,96']][v];
        for (let i = 0; i < 14; i++) {
          const x = 4 + Math.floor(hash(i, v, 11) * 32);
          const y = 3 + Math.floor(hash(i, v, 12) * 16);
          px(g, x, y + 1, '40,100,40');
          px(g, x, y, cols[i % 2]);
          px(g, x + 1, y, cols[i % 2]);
          px(g, x, y - 1, cols[i % 2], 0.7);
        }
      });
    },
  });

  // ---- Leene Square -------------------------------------------------------------
  const TENT = [['#c83838', '#f4ece0'], ['#3868c8', '#f4ece0'], ['#38a050', '#f8e8a0'], ['#8848b8', '#f8d860']];
  reg('tent', {
    blocks: true, variants: 4, shadow: [26, 9], yOff: 5,
    build(v) {
      const g = new Grid(58, 62);
      const ax = 29;
      const ay = 7;
      // Walls.
      for (let y = 30; y <= 58; y++)
        for (let x = 7; x <= 51; x++) {
          const hw = 22 + (y - 30) * 0.05;
          if (Math.abs(x - 29) > hw) continue;
          g.px(x, y, Math.floor((x - 7) / 5) % 2 ? 'b' : 'a');
        }
      // Door flaps.
      g.tri(29, 33, 20, 58, 38, 58, 'o');
      g.line(29, 33, 20, 58, 'f', 2);
      g.line(29, 33, 37, 58, 'f', 2);
      // Roof: stripes radiating from the apex.
      for (let y = ay; y <= 32; y++)
        for (let x = 1; x <= 57; x++) {
          const t = (y - ay) / (32 - ay);
          const hw = t * 27 + 1;
          if (Math.abs(x - ax) > hw) continue;
          const ang = Math.atan2(x - ax, y - ay + 0.01);
          g.px(x, y, Math.floor((ang + 2) * 5) % 2 ? 'c' : 'd');
        }
      // Scalloped valance.
      for (let i = 0; i < 9; i++) g.ell(4 + i * 6.2, 32, 3, 2.5, i % 2 ? 'c' : 'd');
      g.line(ax, 0, ax, ay, 'p');
      g.tri(ax + 1, 0, ax + 9, 2, ax + 1, 5, 'g');
      return sg(g, { a: TENT[v][0], b: TENT[v][1], c: TENT[v][0], d: TENT[v][1], o: '#2c1c24', f: '#e8d8b0', p: '#8c7050', g: '#f8d040' });
    },
  });
  reg('bell_tower', {
    blocks: true, shadow: [30, 11], yOff: 8,
    light: { color: '255,200,120', radius: 50, dy: 70, flicker: true },
    build() {
      const W = 64;
      const g0 = new Grid(W, 196);
      const O = 28;
      const g = { rect: (x0, y0, x1, y1, c) => g0.rect(x0, y0 + O, x1, y1 + O, c), ell: (x, y, rx, ry, c) => g0.ell(x, y + O, rx, ry, c),
        line: (x0, y0, x1, y1, c, w) => g0.line(x0, y0 + O, x1, y1 + O, c, w), tri: (a, b, c2, d, e, f, c) => g0.tri(a, b + O, c2, d + O, e, f + O, c) };
      const c = 32;
      // Stepped plinth.
      g.rect(6, 150, 57, 166, 'p');
      g.rect(9, 142, 54, 150, 'q');
      // Shaft.
      g.rect(13, 64, 50, 142, 's');
      g.rect(11, 64, 14, 142, 'u');
      g.rect(49, 64, 52, 142, 'u');
      // Bricks.
      for (let y = 68; y < 140; y += 6) {
        g.line(15, y, 48, y, 'm');
        for (let x = 15 + ((y / 6) % 2) * 5; x < 48; x += 10) g.line(x, y, x, y + 5, 'm');
      }
      // Arched door & windows.
      g.rect(25, 118, 38, 142, 'o');
      g.ell(31.5, 118, 6.5, 6, 'o');
      g.rect(28, 90, 35, 102, 'o');
      g.ell(31.5, 90, 3.5, 3.5, 'o');
      g.rect(28, 92, 35, 93, 'y');
      // Cornice.
      g.rect(8, 58, 55, 64, 'q');
      g.rect(10, 54, 53, 58, 's');
      // Belfry: open arch with the bell.
      g.rect(12, 20, 51, 54, 's');
      g.rect(18, 26, 45, 54, 'o');
      g.ell(31.5, 26, 13.5, 8, 'o');
      g.rect(12, 20, 17, 54, 'u');
      g.rect(46, 20, 51, 54, 'u');
      // Bell.
      g.rect(30, 22, 33, 26, 'B');
      g.ell(31.5, 34, 8, 8, 'B');
      g.rect(23, 34, 40, 44, 'B');
      g.rect(21, 42, 42, 46, 'B');
      g.ell(31.5, 47, 3, 2, 'C');
      g.line(24, 40, 38, 40, 'e');
      g.rect(8, 16, 55, 20, 'q');
      // Spire roof.
      g.tri(6, 17, 57, 17, c, -26, 'r');
      g.tri(24, 4, 39, 4, c, -26, 'R');
      for (let y = -20; y < 17; y += 5) g.line(c - (y + 26) * 0.6 + 1, y, c + (y + 26) * 0.6 - 1, y, 'R');
      g.rect(29, 2, 34, 8, 'o');
      g.rect(30, 4, 33, 6, 'y');
      g.line(c, -28, c, -24, 'g');
      g.ell(c, -26, 2, 2, 'g');
      // Keep only the part of the spire inside the grid (tip clipped by tri bounds).
      return sg(g0, { p: '#6c6470', q: '#8c8494', s: '#a49c9c', u: '#8c8484', m: '#7c7474', o: '#1c1624', y: '#f8c860',
        B: '#c89038', C: '#8c5c20', e: '#f0c870', r: '#3c5c8c', R: '#2c4470', g: '#f8d060' }, 'meyR');
    },
  });
  reg('lantern', {
    blocks: true, variants: 2, shadow: [6, 3], yOff: 3,
    light: { color: '255,180,100', radius: 92, flicker: true, dy: 16 },
    build(v) {
      const g = new Grid(22, 50);
      g.rect(10, 12, 11, 47, 'p');
      g.rect(7, 45, 14, 48, 'b');
      g.line(10, 8, 16, 8, 'p');
      g.line(16, 8, 16, 10, 'p');
      g.ell(16, 17, 5, 6, 'L');
      g.rect(14, 10, 18, 11, 'c');
      g.rect(14, 23, 18, 24, 'c');
      g.line(12, 17, 20, 17, 'r');
      g.px(16, 13, 'H');
      g.px(15, 14, 'H');
      return sg(g, { p: '#3c3440', b: '#4c4450', c: '#2c2430', L: v ? '#f8c040' : '#f06040', r: v ? '#c89020' : '#b83820', H: '#fff8d0', x: '#3c3440' }, 'rH');
    },
  });
  const fountainFrames = frameSet(6, (v, f) => {
    const base = CT.getDecor('fountain', 0);
    return canvas(base.width, base.height, (g) => {
      g.drawImage(base, 0, 0);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + f * 0.35;
        const r = 5 + ((f + i) % 6) * 3;
        const x = 31 + Math.cos(a) * r;
        const y = 33 + Math.sin(a) * r * 0.35;
        px(g, Math.round(x), Math.round(y), '220,240,255', 0.8);
      }
      // Spout arcs.
      for (let s = 0; s < 4; s++) {
        const k = (f / 6 + s / 4) % 1;
        for (const dir of [-1, 1]) {
          const x = 31 + dir * k * 12;
          const y = 12 + (k * 2 - 1) * (k * 2 - 1) * 10 - 10 + 8;
          px(g, Math.round(x), Math.round(y), '230,245,255', 0.9);
        }
      }
    });
  });
  reg('fountain', {
    blocks: true, shadow: [28, 10], yOff: 6,
    build() {
      const g = new Grid(62, 48);
      g.ell(31, 34, 29, 11, 's');
      g.rect(2, 34, 60, 40, 't');
      g.ell(31, 40, 29, 6, 't');
      g.ell(31, 33, 24, 8, 'w');
      g.rect(28, 14, 34, 32, 'u');
      g.ell(31, 15, 10, 3.5, 'q');
      g.ell(31, 14, 7, 2, 'w');
      g.rect(30, 6, 32, 13, 'u');
      g.ell(31, 6, 2.5, 2.5, 'q');
      for (let i = 0; i < 6; i++) g.px(14 + i * 7, 33 + (i % 2), 'W');
      return sg(g, { s: '#a8a4ac', t: '#88828c', u: '#9c98a0', q: '#b8b4bc', w: '#4c8cc8', W: '#c8e8ff' }, 'W');
    },
    animate: (img, now) => fountainFrames(0)[Math.floor(now / 140) % 6],
  });
  reg('table', {
    blocks: true, variants: 2, shadow: [18, 6], yOff: 6,
    build(v) {
      const g = new Grid(40, 34);
      g.rect(4, 17, 6, 31, 'l');
      g.rect(33, 17, 35, 31, 'l');
      g.rect(19, 24, 21, 33, 'l');
      isoBox(g, 20, 6, 18, 9, 3, 'a', 'b', 'c');
      if (v === 0) {
        g.rect(12, 7, 16, 13, 'j');
        g.ell(14, 7, 2.5, 1, 'J');
        g.ell(24, 13, 4, 2.5, 'f');
        g.ell(26, 11, 2, 1.5, 'F');
      } else {
        g.rect(10, 9, 13, 14, 'j');
        g.rect(15, 8, 18, 13, 'm');
        g.ell(26, 12, 5, 2.5, 'f');
      }
      return sg(g, { l: '#6c4424', a: '#a8763c', b: '#80532c', c: '#6c4424', j: '#c8c8d0', J: '#8c6040', m: '#c85c3c', f: '#d8a048', F: '#c83838' });
    },
  });
  reg('crate', {
    blocks: true, variants: 2, shadow: [14, 5], yOff: 6,
    build(v) {
      const g = new Grid(30, 32);
      isoBox(g, 15, 2, 13, 6.5, 16, 'a', 'b', 'c');
      g.line(2, 9, 15, 15, 'd');
      g.line(2, 25, 15, 31, 'd');
      g.line(2, 9, 15, 31, 'e');
      g.line(15, 15, 28, 9, 'd');
      g.line(15, 31, 28, 25, 'd');
      g.line(15, 15, 28, 25, 'e');
      if (v) g.text(5, 3, ['..xx..', '.x..x.']);
      return sg(g, { a: '#b08448', b: '#8c6434', c: '#7c5428', d: '#5c3c1c', e: '#a07440', x: '#5c3c1c' }, 'dex');
    },
  });
  reg('barrel', {
    blocks: true, shadow: [10, 4], yOff: 5,
    build() {
      const g = new Grid(24, 30);
      for (let y = 4; y <= 28; y++) {
        const t = (y - 4) / 24;
        const hw = 8 + Math.sin(t * Math.PI) * 2.5;
        for (let x = Math.round(12 - hw); x <= Math.round(12 + hw); x++) g.px(x, y, (x + 1) % 4 === 0 ? 's' : 'a');
      }
      for (const y of [7, 8, 24, 25]) for (let x = 2; x <= 22; x++) if (g.a[y][x] !== '.') g.px(x, y, 'h');
      g.ell(12, 4, 8, 3, 'c');
      g.ell(12, 4, 6, 2, 'd');
      return sg(g, { a: '#946034', s: '#7c4c28', h: '#6c6c78', c: '#a87040', d: '#80542c' }, 's');
    },
  });
  const flameFrames = frameSet(6, (v, f) => {
    // Small flame sprite (14x18) for torches.
    return canvas(14, 18, (g) => {
      const sway = Math.sin(f * 1.05) * 1.2;
      for (let y = 0; y < 18; y++) {
        const t = y / 17;
        const hw = Math.sin(t * Math.PI * 0.9) * 5 * (0.8 + 0.2 * Math.sin(f + y));
        const cx = 7 + sway * (1 - t);
        for (let x = 0; x < 14; x++) {
          const d = Math.abs(x + 0.5 - cx) / Math.max(0.5, hw);
          if (d > 1) continue;
          const core = d < 0.45 && t > 0.35;
          const col = core ? '255,248,200' : d < 0.75 ? '255,190,60' : '230,90,30';
          px(g, x, y, col, t < 0.15 ? 0.6 : 1);
        }
      }
    });
  });
  reg('torch', {
    blocks: true, variants: 2, shadow: [6, 3], yOff: 3,
    light: { color: '255,160,70', radius: 84, flicker: true, dy: 6 },
    build(v) {
      const g = new Grid(20, 50);
      if (v === 0) {
        // Iron brazier stand.
        g.rect(9, 16, 10, 46, 'p');
        g.line(9, 44, 4, 48, 'p', 2);
        g.line(10, 44, 15, 48, 'p', 2);
        g.tri(3, 11, 16, 11, 10, 18, 'b');
        g.rect(4, 10, 15, 12, 'c');
      } else {
        // Wooden torch staff wrapped in cloth.
        g.rect(9, 14, 10, 47, 'w');
        g.rect(8, 11, 11, 16, 'r');
        g.rect(7, 44, 12, 48, 's');
      }
      g.px(8, 9, 'e');
      g.px(11, 8, 'e');
      return sg(g, { p: '#3c3848', b: '#4c4858', c: '#5c5868', w: '#7c5030', r: '#a08058', s: '#6c6c78', e: '#f8a040' }, 'e');
    },
    animate(img, now, d) {
      const v = d.variant || 0;
      const cache = (this._c = this._c || {});
      if (!cache[v]) cache[v] = flameFrames(0).map((f) => canvas(img.width, img.height + 12, (g) => {
        g.drawImage(img, 0, 12);
        g.drawImage(f, Math.round(img.width / 2 - 7), 3);
      }));
      return cache[v][Math.floor(now / 110 + (d.x || 0) * 3 + (d.y || 0)) % 6];
    },
  });

  // ---- Castle ----------------------------------------------------------------
  reg('throne', {
    blocks: false, shadow: [16, 5], yOff: -2,
    build() {
      const g = new Grid(40, 66);
      g.rect(6, 4, 33, 50, 'g');
      g.ell(20, 6, 14, 6, 'g');
      g.rect(9, 8, 30, 48, 'r');
      g.ell(20, 9, 11, 4, 'r');
      g.tri(15, 2, 25, 2, 20, -6, 'g');
      g.ell(20, 1, 3, 3, 'j');
      g.text(12, 14, ['...y...', '..yyy..', '.y.y.y.', '...y...', '..y.y..']);
      g.rect(2, 38, 37, 44, 'g');
      g.rect(4, 44, 35, 58, 'c');
      g.rect(8, 44, 31, 48, 'r');
      g.rect(3, 56, 7, 64, 'g');
      g.rect(32, 56, 36, 64, 'g');
      g.rect(2, 34, 5, 44, 'a');
      g.rect(34, 34, 37, 44, 'a');
      return sg(g, { g: '#d8a838', r: '#a82030', c: '#8c1c28', a: '#c89030', j: '#58c8f8', y: '#f8d860' }, 'y');
    },
  });
  reg('banner', {
    blocks: true, variants: 2, shadow: [7, 3], yOff: 3,
    build(v) {
      const g = new Grid(26, 72);
      g.rect(12, 6, 13, 70, 'p');
      g.rect(9, 67, 16, 70, 'p');
      g.ell(12.5, 4, 2.5, 3, 'g');
      g.rect(4, 10, 21, 11, 'p');
      g.rect(5, 12, 20, 44, 'b');
      g.tri(5, 44, 20, 44, 12.5, 52, 'b');
      g.rect(5, 12, 20, 14, 'g');
      g.line(5, 12, 5, 44, 'e');
      g.line(20, 12, 20, 44, 'e');
      // Crest.
      g.text(8, 20, ['..y..y..', '..yyyy..', '.yyyyyy.', '..yyyy..', '...yy...', '..y..y..', '.yy..yy.']);
      g.ell(12.5, 34, 3, 3, 'y');
      return sg(g, { p: '#5c4c3c', g: '#e0b040', b: v ? '#2c4ca0' : '#b02030', e: '#e0b040', y: '#f0c850' }, 'ye');
    },
  });
  reg('pillar', {
    blocks: true, variants: 3, shadow: [13, 5], yOff: 5,
    build(v) {
      if (v === 2) {
        // Hollow gallery column: seamless white ceramic, blue seams.
        const g = new Grid(26, 104);
        g.rect(1, 96, 24, 103, 'b');
        g.rect(4, 8, 21, 96, 's');
        for (let y = 20; y < 96; y += 19) g.line(4, y, 21, y, 'f');
        g.line(12, 8, 12, 96, 'f');
        g.rect(1, 0, 24, 8, 'b');
        return sg(g, { b: '#e8ecf4', s: '#f4f6fa', f: '#a8c0e0' }, 'f');
      }
      const g = new Grid(30, 96);
      g.rect(2, 86, 27, 95, 'b');
      g.rect(4, 82, 25, 86, 'c');
      g.rect(6, 14, 23, 82, 's');
      for (let x = 8; x < 23; x += 3) g.line(x, 16, x, 80, 'f');
      g.rect(4, 8, 25, 14, 'c');
      g.rect(2, 2, 27, 8, 'b');
      if (v === 1) {
        g.rect(6, 30, 23, 33, 'g');
        g.rect(6, 64, 23, 67, 'g');
      }
      return sg(g, { b: '#7c7888', c: '#8c889c', s: '#a09cae', f: '#8c889a', g: '#b89c50' }, 'f');
    },
  });
  reg('cairn', {
    blocks: true, shadow: [13, 5], yOff: 5,
    build() {
      const g = new Grid(32, 40);
      g.ell(16, 34, 14, 5, 'a');
      g.ell(15, 28, 11, 5, 'b');
      g.ell(17, 22, 9, 4, 'a');
      g.ell(15, 17, 7, 3.5, 'c');
      // Rusted helm.
      g.ell(16, 9, 7, 6, 'h');
      g.rect(9, 9, 23, 13, 'h');
      g.rect(10, 9, 22, 10, 'e');
      g.px(13, 11, 'k');
      g.px(19, 11, 'k');
      g.line(16, 3, 16, 12, 'r');
      g.px(9, 14, 'm');
      g.px(24, 30, 'm');
      return sg(g, { a: '#7c7c88', b: '#8c8c98', c: '#9c9ca8', h: '#8c5c38', e: '#5c3c28', r: '#a86c3c', m: '#5c8c4c' }, 'rm');
    },
  });

  // Waterfall: foam and falling streaks over a water drop of `variant` levels.
  const fallFrames = frameSet(6, (v, f) => {
    const drop = Math.max(1, v);
    const H = drop * 16 + 24;
    return canvas(30, H, (g) => {
      for (let y = 0; y < H - 8; y++) {
        const t = y / (H - 8);
        const hw = 6 + t * 5 + Math.sin(y * 0.7 + f) * 0.8;
        for (let x = Math.floor(15 - hw); x <= Math.ceil(15 + hw); x++) {
          const edge = hw - Math.abs(x + 0.5 - 15);
          if (edge < 0) continue;
          const k = (y - f * 4 + hash(x, 0, 3) * 20 + 60) % 12;
          const col = k < 2 ? '240,250,255' : k < 5 ? '180,220,248' : '110,165,220';
          const a = Math.min(1, t * 3 + 0.15) * (edge < 1.5 ? 0.45 : 0.85);
          px(g, x, y, col, a);
        }
      }
      // Splash & mist at the base.
      for (let i = 0; i < 44; i++) {
        const a = hash(i, f, 9) * Math.PI;
        const r = 4 + hash(i, f, 10) * 12;
        const x = 15 + Math.cos(a) * r * (hash(i, 0, 11) > 0.5 ? 1 : -1);
        const y = H - 9 + Math.sin(a) * r * 0.3 - hash(i, f, 12) * 7;
        px(g, Math.round(x), Math.round(y), '240,250,255', 0.5 + hash(i, f, 13) * 0.5);
      }
    });
  });
  reg('waterfall', {
    blocks: false, variants: 5,
    build: (v) => fallFrames(v)[0],
    yOff: 8,
    animate: (img, now, d) => fallFrames(d.variant || 0)[Math.floor(now / 90) % 6],
  });

  // ---- Prehistoric / volcanic --------------------------------------------------
  reg('hut', {
    blocks: true, variants: 2, shadow: [28, 10], yOff: 6,
    build(v) {
      const g = new Grid(64, 56);
      g.line(22, 2, 28, 16, 'p', 2);
      g.line(42, 2, 36, 16, 'p', 2);
      g.line(32, 0, 32, 14, 'p', 2);
      g.ell(32, 34, 29, 21, 'h');
      g.rect(2, 44, 62, 55, '.');
      g.rect(4, 40, 60, 48, 'h');
      // Thatch layers.
      for (let r = 0; r < 4; r++) {
        const y = 16 + r * 7;
        for (let x = 6 + (3 - r) * 4; x < 58 - (3 - r) * 4; x += 3) g.line(x, y, x - 1, y + 5, r % 2 ? 'l' : 'm');
      }
      g.ell(32, 16, 12, 5, 'l');
      // Doorway.
      g.rect(25, 34, 38, 48, 'o');
      g.ell(31.5, 34, 6.5, 6, 'o');
      g.rect(23, 32, 24, 48, 'b');
      g.rect(39, 32, 40, 48, 'b');
      // Bones / tusks.
      g.line(14, 40, 10, 30, 'x', 2);
      g.line(50, 40, 54, 30, 'x', 2);
      if (v) g.ell(32, 27, 4, 3, 'x');
      return sg(g, { p: '#8c6c48', h: '#a07850', l: '#8c9c48', m: '#b0a058', o: '#2c1810', b: '#6c4c2c', x: '#f0e8d0' }, 'lm');
    },
  });
  const fireFrames = frameSet(8, (v, f) => {
    return canvas(40, 40, (g) => {
      for (let t = 0; t < 3; t++) {
        const cx = 20 + (t - 1) * 5 + Math.sin(f * 0.8 + t * 2) * 1.5;
        const hgt = 22 - Math.abs(t - 1) * 6 + Math.sin(f * 1.3 + t) * 3;
        for (let y = 0; y < hgt; y++) {
          const k = y / hgt;
          const hw = (1 - k) * 5.5 * (0.7 + 0.3 * Math.sin(k * 3 + f));
          const yy = 30 - y;
          for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
            const d = Math.abs(x - cx) / Math.max(0.6, hw);
            const col = d < 0.4 && k < 0.6 ? '255,250,210' : d < 0.75 && k < 0.8 ? '255,196,64' : '240,96,32';
            px(g, x, yy, col, k > 0.85 ? 0.6 : 1);
          }
        }
      }
      for (let i = 0; i < 4; i++) {
        const k = ((f + i * 2) % 8) / 8;
        px(g, 12 + ((i * 7) % 17), Math.round(24 - k * 24), '255,200,90', 1 - k);
      }
    });
  });
  reg('bonfire', {
    blocks: true, shadow: [18, 6], yOff: 5,
    light: { color: '255,150,60', radius: 130, flicker: true, dy: 30 },
    build() {
      const g = new Grid(44, 26);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        g.ell(22 + Math.cos(a) * 17, 17 + Math.sin(a) * 6, 3.5, 3, i % 2 ? 's' : 't');
      }
      g.line(10, 20, 30, 10, 'w', 3);
      g.line(32, 20, 13, 10, 'w', 3);
      g.line(22, 22, 22, 8, 'v', 3);
      g.ell(22, 18, 7, 3, 'e');
      return sg(g, { s: '#7c7880', t: '#8c8890', w: '#6c4424', v: '#5c381c', e: '#f86020' });
    },
    animate(img, now) {
      const c = (this._c = this._c || fireFrames(0).map((f) => canvas(46, 54, (g) => {
        g.drawImage(img, 0, 26);
        g.drawImage(f, 3, 2);
      })));
      return c[Math.floor(now / 95) % 8];
    },
  });
  reg('fossil', {
    blocks: true, variants: 2, shadow: [14, 5], yOff: 5,
    build(v) {
      const g = new Grid(32, 24);
      g.ell(16, 14, 15, 9, 'a');
      g.ell(12, 11, 8, 5, 'b');
      if (v === 0) {
        // Ammonite spiral.
        for (let s = 0; s < 60; s++) {
          const a = s * 0.3;
          const r = 1 + s * 0.11;
          g.px(17 + Math.cos(a) * r, 13 + Math.sin(a) * r * 0.8, 'x');
        }
      } else {
        // Ribs and spine.
        g.line(6, 12, 26, 12, 'x');
        for (let x = 9; x < 25; x += 3) g.line(x, 8, x + 1, 17, 'x');
        g.ell(5, 12, 2, 2, 'x');
      }
      return sg(g, { a: '#8c7c64', b: '#a0907a', x: '#f0e4c8' }, 'x');
    },
  });
  reg('bone_pillar', {
    blocks: true, variants: 2, shadow: [11, 4], yOff: 5,
    build(v) {
      const g = new Grid(30, 84);
      if (v === 0) {
        // Great curved tusk rising from a rock.
        for (let s = 0; s < 70; s++) {
          const t = s / 70;
          const x = 10 + Math.sin(t * 2.2) * 9;
          const w = 5 * (1 - t) + 1.5;
          g.ell(x, 78 - s, w, 1.5, 'b');
        }
        for (let y = 20; y < 70; y += 11) g.line(6, y, 20, y - 2, 'c');
      } else {
        // Crossed ribs.
        for (let s = 0; s < 64; s++) {
          const t = s / 64;
          g.ell(5 + Math.sin(t * 1.6) * 16, 78 - s, 2.5 - t, 1.5, 'b');
          g.ell(25 - Math.sin(t * 1.6) * 16, 78 - s, 2.5 - t, 1.5, 'd');
        }
      }
      g.ell(15, 78, 13, 5, 'r');
      return sg(g, { b: '#e8dcc0', c: '#c8b898', d: '#d8ccb0', r: '#3c343c' }, 'c');
    },
  });
  reg('reptite_ruin', {
    blocks: true, variants: 2, shadow: [18, 6], yOff: 5,
    build(v) {
      const g = new Grid(40, 58);
      const top = v ? 22 : 6;
      g.rect(6, top, 33, 54, 'a');
      g.rect(4, 50, 35, 57, 'b');
      // Broken top edge.
      for (let x = 6; x <= 33; x++) {
        const cut = Math.floor(hash(x, v, 21) * 4 + (v ? Math.abs(x - 20) * 0.3 : 0));
        for (let y = top; y < top + cut; y++) g.px(x, y, '.');
      }
      // Carved reptite face.
      const fy = top + 12;
      g.rect(10, fy, 29, fy + 18, 'c');
      g.tri(11, fy + 4, 18, fy + 6, 11, fy + 7, 'e');
      g.tri(28, fy + 4, 21, fy + 6, 28, fy + 7, 'e');
      g.rect(13, fy + 12, 26, fy + 14, 'o');
      for (let x = 14; x < 26; x += 3) g.px(x, fy + 13, 'f');
      g.line(8, top + 6, 16, top + 36, 'x');
      g.line(31, top + 10, 27, top + 30, 'x');
      g.ell(30, top + 34, 3, 2, 'm');
      g.ell(8, 48, 4, 2, 'm');
      return sg(g, { a: '#6c7060', b: '#5c6050', c: '#7c806c', e: '#e05030', o: '#2c2c24', f: '#e8e0c8', x: '#3c3c34', m: '#5c7c3c' }, 'efx');
    },
  });

  // ---- Snow ------------------------------------------------------------------
  reg('snow_hut', {
    blocks: true, variants: 2, shadow: [27, 10], yOff: 6,
    light: { color: '255,190,110', radius: 44, flicker: true, dy: 40 },
    build(v) {
      const g = new Grid(62, 62);
      // Log walls (iso box).
      isoBox(g, 31, 22, 26, 12, 22, 'l', 'w', 'x');
      for (let y = 38; y < 58; y += 4) {
        g.line(5, y, 31, y + 12, 'd');
        g.line(31, y + 12, 57, y, 'e');
      }
      // Door & window.
      g.tri(12, 44, 20, 48, 12, 60, 'o');
      g.tri(20, 48, 20, 60, 12, 60, 'o');
      g.rect(41, 44, 47, 49, 'y');
      g.line(44, 44, 44, 49, 'd');
      // Roof with heavy snow.
      g.tri(1, 30, 31, 2, 31, 44, 'r');
      g.tri(1, 30, 31, 44, 31, 46, 'r');
      g.tri(31, 2, 61, 30, 31, 44, 's');
      g.tri(31, 44, 61, 30, 61, 32, 's');
      g.tri(3, 29, 31, 3, 26, 14, 'n');
      g.tri(31, 3, 59, 29, 36, 14, 'n');
      for (let x = 4; x < 58; x += 3) g.px(x, 31 + Math.abs(x - 31) * -0.5 + 14 + (x % 2), 'n');
      if (v) {
        g.rect(40, 0, 45, 12, 'c');
        g.rect(39, 0, 46, 2, 'n');
      }
      return sg(g, { l: '#8c6440', w: '#7c5434', x: '#6c4828', d: '#4c3020', e: '#5c3c24', o: '#2c1c14', y: '#f8c870',
        r: '#e8eef8', s: '#c8d4e8', n: '#ffffff', c: '#6c6070' }, 'de');
    },
  });

  // ---- Zeal ------------------------------------------------------------------
  reg('broken_column', {
    blocks: true, variants: 3, shadow: [12, 5], yOff: 5,
    light: null,
    build(v) {
      const g = new Grid(30, 80);
      const top = [10, 36, 56][v];
      g.rect(2, 72, 27, 79, 'b');
      g.rect(4, 68, 25, 72, 'g');
      g.rect(6, top, 23, 68, 's');
      for (let x = 8; x < 23; x += 3) g.line(x, top + 2, x, 66, 'f');
      g.rect(6, top + 10, 23, top + 12, 'g');
      if (v === 0) {
        g.rect(4, 4, 25, 10, 'g');
        g.rect(2, 0, 27, 4, 'b');
      }
      // Jagged break.
      for (let x = 6; x <= 23; x++) {
        const cut = Math.floor(hash(x, v, 31) * 6);
        for (let y = top; y < top + cut; y++) g.px(x, y, '.');
      }
      if (v) g.line(12, top + 14, 20, 66, 'y');
      if (v === 2) {
        g.ell(26, 76, 3, 2, 's');
        g.ell(4, 77, 3, 2, 's');
      }
      return sg(g, { b: '#8c9ab4', g: '#a08840', s: '#c8d4e6', f: '#aebcd4', y: '#80e8ff' }, 'fy');
    },
  });
  function statue(g, ox, oy, cracked) {
    // Porcelain girl with long hair in a Zeal robe (~20x46).
    g.ell(ox + 10, oy + 6, 5, 5.5, 'h');
    g.rect(ox + 5, oy + 6, ox + 15, oy + 26, 'h');
    g.ell(ox + 10, oy + 7, 3.5, 4, 'z');
    g.rect(ox + 7, oy + 11, ox + 13, oy + 12, 'z');
    if (cracked) {
      g.ell(ox + 9, oy + 7, 2.5, 3, 'o');
      g.px(ox + 11, oy + 5, 'o');
    } else {
      g.px(ox + 8, oy + 7, 'e');
      g.px(ox + 11, oy + 7, 'e');
    }
    g.rect(ox + 6, oy + 13, ox + 14, oy + 26, 'r');
    g.tri(ox + 6, oy + 24, ox + 14, oy + 24, ox + 18, oy + 45, 'r');
    g.tri(ox + 6, oy + 24, ox + 2, oy + 45, ox + 18, oy + 45, 'r');
    g.line(ox + 10, oy + 14, ox + 10, oy + 44, 'q');
    g.rect(ox + 6, oy + 20, ox + 14, oy + 21, 'q');
    g.rect(ox + 7, oy + 16, ox + 13, oy + 19, 'z');
    g.line(ox + 3, oy + 44, ox + 17, oy + 44, 'q');
  }
  reg('schala_vitrine', {
    blocks: true, variants: 2, shadow: [22, 8], yOff: 6,
    light: { color: '160,220,255', radius: 60, dy: 40 },
    build(v) {
      const g = new Grid(48, 88);
      g.rect(2, 74, 45, 87, 'p');
      g.rect(0, 72, 47, 75, 'g');
      g.rect(4, 82, 43, 83, 'g');
      g.rect(4, 8, 43, 11, 'f');
      g.rect(4, 8, 6, 72, 'f');
      g.rect(41, 8, 43, 72, 'f');
      g.rect(2, 4, 45, 8, 'g');
      g.rect(7, 12, 40, 71, 'i');
      statue(g, 14, 24, v === 1);
      const cv = sg(g, { p: '#b8c4d8', g: '#a08840', f: '#c8d4e4', i: '#1c2c44', h: '#dce4f0', z: '#f4f4f8', o: '#101018', e: '#8898b0',
        r: '#e8ecf4', q: '#9cb0d0' }, 'eq');
      const x = cv.getContext('2d');
      glass(x, 8, 13, 41, 72, v === 1);
      if (v === 1) {
        x.fillStyle = 'rgba(230,245,255,0.9)';
        for (let i = 0; i < 12; i++) x.fillRect(4 + Math.floor(hash(i, 5, 1) * 40), 80 + Math.floor(hash(i, 5, 2) * 6), 2, 1);
      }
      return cv;
    },
  });
  reg('dreamstone', {
    blocks: true, variants: 2, shadow: [12, 5], yOff: 5,
    light: { color: '120,230,255', radius: 70, flicker: true, dy: 20 },
    build(v) {
      const g = new Grid(32, 42);
      g.ell(16, 37, 13, 4, 'r');
      const spikes = v ? [[16, 38, 14, 4, 7, 'a'], [9, 38, 4, 16, 5, 'b'], [23, 38, 27, 14, 5, 'c'], [19, 38, 22, 20, 4, 'b']]
        : [[15, 38, 17, 2, 8, 'a'], [8, 38, 3, 18, 5, 'c'], [22, 38, 26, 12, 6, 'b']];
      for (const [x0, y0, x1, y1, w, c] of spikes) {
        g.spike(x0, y0, x1, y1, w, c);
        g.line(x0, y0 - 3, (x0 + x1 * 2) / 3, (y0 + y1 * 2) / 3, 'L');
      }
      return sg(g, { r: '#4c5c74', a: '#48c8f0', b: '#38a8e0', c: '#60d8f8', L: '#e0ffff' }, 'L');
    },
  });

  // ---- End of Time -------------------------------------------------------------
  reg('lamppost', {
    blocks: true, shadow: [8, 3], yOff: 4,
    light: { color: '255,220,150', radius: 140, flicker: false, dy: 12 },
    build() {
      const g = new Grid(26, 100);
      g.rect(8, 90, 17, 99, 'b');
      g.rect(10, 84, 15, 90, 'c');
      g.rect(11, 24, 14, 84, 'p');
      g.rect(10, 50, 15, 52, 'c');
      g.line(12, 24, 5, 28, 'p');
      g.line(13, 24, 20, 28, 'p');
      g.rect(6, 6, 19, 22, 'f');
      g.rect(8, 8, 17, 20, 'L');
      g.tri(4, 7, 21, 7, 12.5, 0, 'c');
      g.rect(6, 22, 19, 24, 'c');
      g.line(12, 8, 12, 20, 'f');
      return sg(g, { b: '#2c2c38', c: '#3c3c4c', p: '#34343c', f: '#2c2c34', L: '#fff0b0' });
    },
  });
  // Era doors: stone frames around a shimmering pillar of light.
  const DOORS = {
    door_600: { a: [110, 170, 255], b: [210, 235, 255], light: '110,170,255' },
    door_65m: { a: [120, 220, 90], b: [255, 200, 90], light: '200,210,90' },
    door_12k: { a: [170, 110, 255], b: [120, 240, 255], light: '160,150,255' },
    door_grey: { a: [150, 150, 158], b: [215, 215, 222], light: '200,60,70', scan: true },
  };
  function doorFrame(grey) {
    const g = new Grid(44, 82);
    g.rect(0, 74, 43, 81, 'b');
    g.rect(2, 70, 41, 74, 'c');
    g.rect(2, 10, 9, 70, 's');
    g.rect(34, 10, 41, 70, 's');
    for (let y = 16; y < 70; y += 9) {
      g.line(2, y, 9, y, 'm');
      g.line(34, y, 41, y, 'm');
    }
    g.rect(0, 2, 43, 10, 'c');
    g.tri(17, 2, 26, 2, 21.5, -4, 'c');
    g.rect(19, 3, 24, 9, 'k');
    g.rect(20, 4, 23, 8, 'y');
    g.rect(10, 11, 33, 70, 'o');
    return sg(g, { b: '#3c3c48', c: '#5c5c6c', s: '#6c6c7c', m: '#4c4c5c', o: '#06060c', y: grey ? '#c83040' : '#e8e0c0' }, 'm');
  }
  const doorFrames = {};
  function doorAnim(kind) {
    if (doorFrames[kind]) return doorFrames[kind];
    const D = DOORS[kind];
    const base = doorFrame(!!D.scan);
    doorFrames[kind] = Array.from({ length: 8 }, (_, f) => canvas(base.width, base.height, (g) => {
      g.drawImage(base, 0, 0);
      const x0 = 11;
      const x1 = 34;
      const y0 = 12;
      const y1 = 71;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const u = (x - x0) / (x1 - x0);
          const core = 1 - Math.abs(u - 0.5) * 2;
          const v = (y - y0) / (y1 - y0);
          const wave = 0.5 + 0.5 * Math.sin(v * 14 - f * 0.785 + u * 3);
          const t = Math.min(1, core * 1.2);
          const c = D.a.map((a, i) => Math.round(a + (D.b[i] - a) * (v * 0.6 + wave * 0.4) * t));
          let alpha = 0.35 + core * 0.6 + wave * 0.1;
          let col = c;
          if (D.scan && (y + f) % 4 === 0) {
            col = [220, 40, 60];
            alpha = 0.9;
          }
          if (core > 0.85) col = col.map((cc) => Math.min(255, cc + 60));
          g.fillStyle = `rgba(${col},${Math.min(1, alpha)})`;
          g.fillRect(x, y, 1, 1);
        }
      // Rising motes.
      for (let i = 0; i < 6; i++) {
        const k = ((f / 8 + i / 6) % 1);
        px(g, x0 + 3 + ((i * 7) % 18), Math.round(y1 - k * (y1 - y0)), '255,255,255', 1 - k);
      }
    }));
    return doorFrames[kind];
  }
  for (const kind of Object.keys(DOORS)) {
    reg(kind, {
      blocks: true, shadow: [20, 7], yOff: 6,
      light: { color: DOORS[kind].light, radius: 96, flicker: true, dy: 40 },
      build: () => doorAnim(kind)[0],
      animate: (img, now) => doorAnim(kind)[Math.floor(now / 110) % 8],
    });
  }
  reg('door_spekkio', {
    blocks: true, shadow: [20, 7], yOff: 6,
    light: { color: '255,190,120', radius: 70, flicker: true, dy: 44 },
    build() {
      const g = new Grid(44, 82);
      g.rect(0, 74, 43, 81, 'b');
      g.rect(2, 10, 41, 74, 's');
      g.rect(0, 2, 43, 10, 'c');
      g.rect(10, 26, 33, 72, 'd');
      g.ell(21.5, 26, 11.5, 11, 'd');
      for (let x = 13; x < 33; x += 5) g.line(x, 18, x, 72, 'e');
      g.rect(10, 44, 33, 45, 'i');
      g.rect(10, 60, 33, 61, 'i');
      g.ell(28, 52, 1.5, 1.5, 'y');
      g.ell(21.5, 24, 4, 4, 'w');
      g.line(21.5, 20, 21.5, 28, 'i');
      g.line(17.5, 24, 25.5, 24, 'i');
      // Tiny Nu-horn ornament.
      g.tri(15, 4, 18, 4, 16, -2, 'y');
      g.tri(26, 4, 29, 4, 28, -2, 'y');
      return sg(g, { b: '#3c3c48', c: '#5c5c6c', s: '#6c6c7c', d: '#8c4c2c', e: '#6c3820', i: '#3c3c44', y: '#f0c040', w: '#fff0b0' }, 'e');
    },
  });
  const saveFrames = frameSet(8, (v, f) => canvas(40, 56, (g) => {
    // Glowing ring on the floor with rising sparkles.
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      const x = 20 + Math.cos(ang) * 14;
      const y = 48 + Math.sin(ang) * 6;
      const tw = 0.5 + 0.5 * Math.sin(ang * 3 + f * 0.8);
      px(g, Math.round(x), Math.round(y), tw > 0.6 ? '255,255,255' : '130,200,255', 0.6 + tw * 0.4);
    }
    g.fillStyle = 'rgba(120,190,255,0.25)';
    g.beginPath();
    g.ellipse(20, 48, 12, 5, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 10; i++) {
      const k = (f / 8 + i / 10) % 1;
      const x = 20 + Math.cos(i * 2.4) * (4 + (i % 3) * 3);
      const y = 48 - k * 44;
      const a = Math.sin(k * Math.PI);
      px(g, Math.round(x), Math.round(y), '220,240,255', a);
      if (i % 3 === 0) {
        px(g, Math.round(x) - 1, Math.round(y), '160,210,255', a * 0.6);
        px(g, Math.round(x) + 1, Math.round(y), '160,210,255', a * 0.6);
        px(g, Math.round(x), Math.round(y) - 1, '160,210,255', a * 0.6);
        px(g, Math.round(x), Math.round(y) + 1, '160,210,255', a * 0.6);
      }
    }
  }));
  reg('save_point', {
    blocks: false, yOff: 8,
    light: { color: '140,200,255', radius: 60, flicker: true, dy: 44 },
    build: () => saveFrames(0)[0],
    animate: (img, now) => saveFrames(0)[Math.floor(now / 120) % 8],
  });
  reg('nu_stall', {
    blocks: true, shadow: [24, 8], yOff: 6,
    build() {
      const g = new Grid(54, 58);
      g.rect(6, 12, 8, 52, 'p');
      g.rect(45, 12, 47, 52, 'p');
      isoBox(g, 27, 28, 24, 8, 14, 'a', 'b', 'c');
      // Awning stripes.
      for (let x = 2; x <= 52; x++) {
        const y0 = 6 + Math.abs(x - 27) * 0.12;
        for (let y = Math.round(y0); y < y0 + 10; y++) g.px(x, y, Math.floor(x / 5) % 2 ? 's' : 't');
      }
      for (let i = 0; i < 9; i++) g.ell(4 + i * 6, 16, 3, 2, i % 2 ? 's' : 't');
      // Goods: tonics, bottles, a bag.
      g.rect(12, 26, 15, 32, 'r');
      g.rect(13, 24, 14, 25, 'x');
      g.rect(19, 25, 22, 32, 'u');
      g.rect(20, 23, 21, 24, 'x');
      g.ell(34, 30, 5, 4, 'v');
      g.rect(40, 27, 43, 32, 'g');
      g.rect(41, 25, 42, 26, 'x');
      return sg(g, { p: '#6c4c34', a: '#a87c50', b: '#8c6440', c: '#7c5434', s: '#f080b0', t: '#f8f0f8', r: '#e04848', u: '#4890e0', v: '#b08850', g: '#50c060', x: '#e8e0c8' });
    },
  });
  reg('rug', {
    blocks: false, variants: 2, flat: true,
    build(v) {
      return canvas(64, 32, (g) => {
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 64; x++) {
            const dx = Math.abs(x + 0.5 - 32) / 28;
            const dy = Math.abs(y + 0.5 - 16) / 14;
            const d = dx + dy;
            if (d > 1) continue;
            const col = d > 0.9 ? '200,160,60' : d > 0.8 ? (v ? '40,60,140' : '140,24,36') : d > 0.72 ? '200,160,60' : (Math.floor(d * 10) % 2 ? (v ? '60,90,170' : '170,40,48') : (v ? '50,76,156' : '150,30,40'));
            px(g, x, y, col);
          }
      });
    },
  });
  reg('rubble', {
    blocks: false, variants: 3, yOff: 3,
    build(v) {
      const g = new Grid(40, 20);
      for (let i = 0; i < 7; i++) {
        const x = 6 + hash(i, v, 41) * 28;
        const y = 8 + hash(i, v, 42) * 9;
        g.ell(x, y, 2 + hash(i, v, 43) * 3, 1.5 + hash(i, v, 44) * 2, 'abc'[i % 3]);
      }
      const pal = [{ a: '#c8d4e6', b: '#aebcd4', c: '#a08840' }, { a: '#8c8c98', b: '#9c9ca8', c: '#7c7c88' }, { a: '#e8ecf4', b: '#d4d8e2', c: '#c4c8d4' }][v];
      return sg(g, pal);
    },
  });


  reg('sword_altar', {
    blocks: true, shadow: [16, 6], yOff: 6,
    light: { color: '160,200,255', radius: 50, dy: 10 },
    build() {
      const g = new Grid(36, 60);
      isoBox(g, 18, 34, 15, 7, 12, 'a', 'b', 'c');
      g.rect(8, 50, 28, 52, 'm');
      // The Masamune, driven into the stone.
      g.rect(17, 6, 19, 38, 'S');
      g.line(18, 6, 18, 36, 'L');
      g.rect(12, 26, 24, 28, 'G');
      g.rect(17, 18, 19, 26, 'H');
      g.ell(18, 17, 2, 2, 'G');
      g.px(18, 27, 'j');
      return sg(g, { a: '#9c9ca8', b: '#7c7c88', c: '#6c6c78', m: '#5c8c4c', S: '#c8d4e8', L: '#f4f8ff', G: '#d8a838', H: '#6c3c8c', j: '#40c0f0' }, 'Lj');
    },
  });
  reg('cave', {
    blocks: true, shadow: [26, 8], yOff: 8,
    build() {
      const g = new Grid(62, 58);
      g.ell(31, 34, 30, 24, 'r');
      g.rect(1, 34, 61, 57, 'r');
      g.ell(18, 20, 14, 12, 'q');
      g.ell(44, 26, 13, 12, 's');
      g.ell(31, 42, 13, 13, 'o');
      g.rect(18, 42, 44, 57, 'o');
      g.ell(20, 12, 11, 5, 'w');
      g.ell(42, 17, 10, 4, 'w');
      g.ell(31, 9, 8, 4, 'w');
      for (let x = 20; x < 44; x += 4) g.spike(x, 30 + Math.abs(x - 31) * 0.3, x + 1, 36 + (x % 3), 3, 'i');
      return sg(g, { r: '#5c6478', q: '#6c7488', s: '#4c5468', o: '#0c0e18', w: '#f4f8ff', i: '#b8e2f6' }, 'i');
    },
  });


  // Floating chunks of rock over the void (non-blocking; place on void tiles).
  reg('float_rock', {
    blocks: false, variants: 3, yOff: -18,
    build(v) {
      const g = new Grid(34, 30);
      const w = [12, 8, 15][v];
      g.ell(17, 8, w, 5, 't');
      g.tri(17 - w, 9, 17 + w, 9, 16 + v, 26 - v * 3, 'r');
      g.tri(17 - w * 0.6, 9, 17, 9, 12, 22, 's');
      g.ell(15, 7, w * 0.6, 2.5, 'u');
      return sg(g, { t: '#40485c', u: '#4c566c', r: '#262a34', s: '#1c1e26' });
    },
  });

  // ---- The Hollow --------------------------------------------------------------
  function exhibit(g, kind, ox, oy) {
    // 18x18 exhibit miniatures inside vitrines.
    if (kind === 0) {
      // Fair: tiny striped tent.
      g.tri(ox + 1, oy + 10, ox + 17, oy + 10, ox + 9, oy + 1, 'R');
      for (let x = ox + 3; x < ox + 16; x += 4) g.line(x, oy + 10, ox + 9, oy + 2, 'W');
      g.rect(ox + 3, oy + 10, ox + 15, oy + 17, 'W');
      g.rect(ox + 7, oy + 12, ox + 11, oy + 17, 'D');
    } else if (kind === 1) {
      // Masamune on a plinth.
      g.rect(ox + 4, oy + 14, ox + 14, oy + 17, 'G');
      g.rect(ox + 8, oy + 0, ox + 10, oy + 11, 'S');
      g.rect(ox + 5, oy + 10, ox + 13, oy + 11, 'G');
      g.rect(ox + 8, oy + 12, ox + 10, oy + 14, 'D');
    } else if (kind === 2) {
      // Stuffed kilwala.
      g.ell(ox + 9, oy + 11, 6, 5, 'W');
      g.ell(ox + 9, oy + 5, 4.5, 4, 'W');
      g.ell(ox + 4, oy + 3, 2, 2, 'W');
      g.ell(ox + 14, oy + 3, 2, 2, 'W');
      g.px(ox + 7, oy + 5, 'D');
      g.px(ox + 11, oy + 5, 'D');
      g.rect(ox + 8, oy + 7, ox + 10, oy + 7, 'R');
      g.rect(ox + 4, oy + 16, ox + 14, oy + 17, 'G');
    } else if (kind === 3) {
      // Floating Zeal diorama.
      g.ell(ox + 9, oy + 9, 8, 3, 'B');
      g.tri(ox + 2, oy + 10, ox + 16, oy + 10, ox + 9, oy + 17, 'D');
      g.rect(ox + 7, oy + 2, ox + 11, oy + 8, 'W');
      g.tri(ox + 6, oy + 3, ox + 12, oy + 3, ox + 9, oy - 1, 'G');
      g.rect(ox + 3, oy + 5, ox + 5, oy + 8, 'W');
      g.rect(ox + 13, oy + 5, ox + 15, oy + 8, 'W');
    } else if (kind === 4) {
      // Epoch model.
      g.ell(ox + 9, oy + 9, 8, 3.5, 'S');
      g.ell(ox + 8, oy + 7, 4, 2.5, 'B');
      g.tri(ox + 13, oy + 8, ox + 18, oy + 4, ox + 17, oy + 10, 'R');
      g.rect(ox + 8, oy + 13, ox + 10, oy + 15, 'D');
      g.rect(ox + 4, oy + 16, ox + 14, oy + 17, 'G');
    } else {
      // Leene's bell.
      g.rect(ox + 8, oy + 0, ox + 10, oy + 2, 'G');
      g.ell(ox + 9, oy + 7, 5, 5, 'G');
      g.rect(ox + 4, oy + 7, ox + 14, oy + 13, 'G');
      g.rect(ox + 2, oy + 12, ox + 16, oy + 14, 'G');
      g.px(ox + 9, oy + 15, 'D');
      g.rect(ox + 4, oy + 16, ox + 14, oy + 17, 'S');
    }
  }
  const EXPAL = { R: '#d04040', W: '#f0ece4', D: '#3c3040', G: '#d8a838', S: '#c8d0e0', B: '#4878c0' };
  reg('vitrine', {
    blocks: true, variants: 6, shadow: [17, 6], yOff: 6,
    build(v) {
      const g = new Grid(38, 58);
      isoBox(g, 19, 36, 17, 7, 12, 'a', 'b', 'c');
      g.rect(3, 6, 35, 43, 'i');
      g.rect(2, 4, 36, 6, 'f');
      g.rect(2, 4, 3, 43, 'f');
      g.rect(35, 4, 36, 43, 'f');
      exhibit(g, v, 10, 22);
      g.rect(8, 40, 30, 42, 'q');
      const cv = sg(g, { a: '#f4f6fa', b: '#dce0ea', c: '#c8ccd8', i: '#d8e4f0', f: '#e8ecf4', q: '#b8c4d8', ...EXPAL });
      glass(cv.getContext('2d'), 4, 7, 35, 42);
      return cv;
    },
  });
  reg('archive_shelf', {
    blocks: true, variants: 2, shadow: [20, 8], yOff: 7,
    build(v) {
      const tall = v === 0;
      const H = tall ? 92 : 50;
      const g = new Grid(44, H + 2);
      const depth = H - 24;
      isoBox(g, 22, 0, 20, 10, depth, 'a', 'b', 'c');
      // Shelf boards and tablets on both faces.
      for (let y = 18; y < depth + 14; y += 12) {
        g.line(2, y, 22, y + 10, 'e');
        g.line(22, y + 10, 42, y, 'e');
        for (let x = 4; x < 21; x += 2) {
          const hgt = 5 + Math.floor(hash(x, y, 51) * 5);
          const yy = y + (x - 2) / 2;
          const col = hash(x, y, 52) > 0.9 ? 'r' : hash(x, y, 52) > 0.75 ? 'u' : 't';
          g.line(x, yy - hgt, x, yy - 1, col);
          const x2 = 44 - x;
          g.line(x2, yy - hgt, x2, yy - 1, hash(x2, y, 53) > 0.85 ? 'u' : 't');
        }
      }
      if (!tall) {
        g.rect(9, 20, 18, 25, 'l');
        text3(g, 10, 21, 'A', 'k');
      }
      return sg(g, { a: '#e8ecf4', b: '#b8bccc', c: '#a4a8b8', e: '#7c8094', t: '#f4f4f8', u: '#8cb0e0', r: '#c83040', l: '#d8a838' }, 'tur');
    },
  });
  reg('ladder', {
    blocks: false, ladder: true, yOff: 2, xOff: 0,
    build() {
      const g = new Grid(20, 44);
      g.line(4, 0, 4, 43, 'r');
      g.line(15, 0, 15, 43, 'r');
      for (let y = 3; y < 43; y += 5) g.line(5, y, 14, y, 's');
      return sg(g, { r: '#9ca4b8', s: '#c8ccd8' });
    },
  });
  reg('arch', {
    blocks: false, variants: 2, yOff: 10,
    build(v) {
      const g = new Grid(64, 92);
      g.rect(2, 20, 13, 91, 'a');
      g.rect(50, 20, 61, 91, 'a');
      g.rect(0, 14, 63, 22, 'c');
      g.ell(32, 30, 18, 14, 'o');
      g.rect(14, 30, 49, 91, 'o');
      g.rect(0, 8, 63, 14, 'b');
      for (let y = 30; y < 90; y += 12) {
        g.line(2, y, 13, y, 'd');
        g.line(50, y, 61, y, 'd');
      }
      g.ell(32, 12, 4, 4, v ? 'r' : 'g');
      const cv = sg(g, { a: '#e8ecf4', b: '#f4f6fa', c: '#d4d8e4', d: '#b8c0d4', o: '#20242c', g: '#9cb4dc', r: '#e02838' }, 'd');
      // Fade the passage into light.
      const x = cv.getContext('2d');
      const gr = x.createLinearGradient(0, 30, 0, 92);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(1, v ? 'rgba(200,40,60,0.35)' : 'rgba(200,220,255,0.35)');
      x.fillStyle = gr;
      x.fillRect(16, 30, 32, 62);
      return cv;
    },
  });
  const PLACARDS = ['CRONO', 'GLENN', 'AYLA', 'JANUS'];
  reg('pedestal_placard', {
    blocks: false, variants: 5, yOff: -2,
    light: { color: '255,220,160', radius: 34, dy: 8 },
    build(v) {
      const g = new Grid(30, 28);
      if (v < 4) {
        g.rect(13, 12, 16, 26, 's');
        g.rect(9, 24, 20, 27, 's');
        g.tri(1, 10, 28, 4, 28, 14, 'p');
        g.tri(1, 10, 1, 20, 28, 14, 'p');
        g.line(1, 10, 28, 4, 'g');
        g.line(1, 20, 28, 14, 'g');
        const word = PLACARDS[v];
        let x = 15 - word.length * 2 + 1;
        for (const ch of word) {
          const y = Math.round(10 - (x - 1) * 0.22 + 1.5);
          text3(g, x, y, ch, 'k');
          x += 4;
        }
      } else {
        g.rect(13, 18, 16, 26, 's');
        g.rect(9, 24, 20, 27, 's');
        g.tri(12, 18, 18, 18, 15, 12, 's');
        g.tri(1, 24, 9, 22, 6, 27, 'p');
        g.tri(20, 25, 28, 22, 26, 27, 'p');
        g.tri(4, 20, 8, 19, 6, 23, 'p');
      }
      return sg(g, { s: '#c8a038', p: '#f4f4f8', g: '#d8a838' });
    },
  });
  reg('core_vitrine', {
    blocks: false, shadow: [28, 10], yOff: 8,
    light: { color: '255,90,110', radius: 60, dy: 50 },
    build() {
      const g = new Grid(62, 96);
      isoBox(g, 31, 70, 28, 11, 6, 'a', 'b', 'c');
      g.rect(3, 6, 58, 80, 'i');
      g.rect(1, 2, 60, 6, 'f');
      g.rect(1, 2, 3, 82, 'f');
      g.rect(58, 2, 60, 82, 'f');
      g.rect(29, 6, 32, 80, 'f');
      g.rect(20, 0, 41, 2, 'f');
      g.rect(24, 84, 37, 86, 'r');
      const cv = sg(g, { a: '#f4f6fa', b: '#dce0ea', c: '#c8ccd8', i: '#2c1018', f: '#eef0f6', r: '#e02838' });
      glass(cv.getContext('2d'), 4, 7, 57, 79);
      return cv;
    },
  });
})();
