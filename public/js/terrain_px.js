// Native-resolution terrain materials (see docs/ART_SPEC.md). Overrides CT.TERRAIN codes.
//
// Every material is redrawn for the 32x16 top / 8 px-per-level side raster. Only
// `top` and `side` are replaced: all rule flags (walk, swim, void, lava, liquid,
// animated, depthOffset, glow, blades, noRim...) stay as terrain.js/terrain_ext.js set them.
//
// Conventions
// - Colours are palette entries (CT.PAL.RAMPS). Tops are pre-divided by the renderer's
//   height light so the baked pixel lands exactly on the chosen palette colour; sides
//   are returned unscaled (we do our own face shading: left face darker, right face mid).
// - Tops are authored on the world lattice: one lattice cell = 1/16 tile = one pixel
//   (p.tx, p.ty). Lines along lattice axes rasterise as clean 2:1 iso staircases, and
//   patterns flow across tiles. Bevels are lit from the screen's top-left whatever the
//   camera rotation (neighbour cells are sampled along view directions).
// - Screen-aligned details (tufts, glints, ripples) use GX/GY: global screen pixel coords
//   that are continuous across tiles of the same height.
(function () {
  const CT = (window.CT = window.CT || {});
  const { hash, vnoise } = CT.TX;
  const T = CT.TERRAIN;
  const hx = CT.PAL.hex;
  const RP = {};
  for (const k in CT.PAL.RAMPS) RP[k] = CT.PAL.RAMPS[k].map(hx);
  const IN = RP.ink, SL = RP.slate, ST = RP.stone, BL = RP.blue, GR = RP.green, TE = RP.teal;
  const WD = RP.wood, SK = RP.skin, RD = RP.red, GD = RP.gold, PU = RP.purple, PK = RP.pink;
  const WH = RP.white[0];

  // ---- Per-tile frame --------------------------------------------------------------
  // The renderer reuses one `p` object per tile, so per-tile data is cached on it.
  // rot: world = W(view) with W one of the 4 renderer rotations.
  const ROTS = [
    (a, b) => [a, b],
    (a, b) => [b, -a],
    (a, b) => [-a, -b],
    (a, b) => [-b, a],
  ];
  const INV = [
    (x, y) => [x, y],
    (x, y) => [-y, x],
    (x, y) => [-x, -y],
    (x, y) => [y, -x],
  ];
  function setup(p) {
    const t = p.t;
    if (p._t === t) return;
    p._t = t;
    const dx = p.px + 0.5 - 16, dy = p.py + 0.5 - 8;
    const ovx = dx / 32 + dy / 16, ovy = dy / 16 - dx / 32;
    const owx = p.wx - t.x, owy = p.wy - t.y;
    let best = 0, be = 1e9;
    for (let r = 0; r < 4; r++) {
      const [a, b] = ROTS[r](ovx, ovy);
      const e = Math.abs(a - owx) + Math.abs(b - owy);
      if (e < be) { be = e; best = r; }
    }
    p._r = best;
    const [vx, vy] = INV[best](t.x, t.y);
    p._sx = (vx - vy) * 16 - 16;
    p._sy = (vx + vy) * 8 - 8;
    // World lattice steps for view directions: A = screen down-right, B = screen down-left.
    p._A = ROTS[best](1, 0);
    p._B = ROTS[best](0, 1);
    p._L = 1 / (0.93 + t.h * 0.025);
  }
  // Per-pixel derived coords.
  function px(p) {
    setup(p);
    p.GX = p._sx + p.px;
    p.GY = p._sy + p.py;
    p.li = p.tx - p.t.x * 16 + 8; // 0..15 inside the tile (world lattice)
    p.lj = p.ty - p.t.y * 16 + 8;
  }
  const out = (p, c) => [c[0] * p._L, c[1] * p._L, c[2] * p._L];

  // Bevel: run pattern `pat(i,j)` (id >= 0, or < 0 for joints) and classify the pixel.
  // Returns [id, edge] with edge 1 = lit (top-left facing), -1 = shaded, 0 = inside.
  function bevel(p, pat) {
    const i = p.tx, j = p.ty, A = p._A, B = p._B;
    const id = pat(i, j);
    if (id < 0) return [id, 0];
    if (pat(i - A[0], j - A[1]) !== id || pat(i - B[0], j - B[1]) !== id) return [id, 1];
    if (pat(i + A[0], j + A[1]) !== id || pat(i + B[0], j + B[1]) !== id) return [id, -1];
    return [id, 0];
  }
  const mod = (a, n) => ((a % n) + n) % n;
  // Running-bond slabs on the lattice: rows of `rh` cells along j, slabs `sw` long along i.
  function bond(sw, rh, seed) {
    return (i, j) => {
      const row = Math.floor(j / rh);
      const ii = i + (row & 1) * (sw >> 1);
      if (mod(j, rh) === 0 || mod(ii, sw) === 0) return -1;
      return Math.floor(hash(Math.floor(ii / sw), row, seed) * 1e6);
    };
  }
  // Is the neighbour in world direction (dx,dy) "land" (solid, non-liquid)?
  function landAt(p, dx, dy) {
    const n = p.nb(dx, dy);
    return !!n && !T[n.t].liquid && !T[n.t].void;
  }
  function sameAt(p, dx, dy, code) {
    const n = p.nb(dx, dy);
    return !!n && n.t === code && n.h === p.t.h;
  }
  // Screen-space scatter cell: returns [cx, cy, id] local coords in a staggered grid.
  function cell(p, w, h, seed) {
    const row = Math.floor(p.GY / h);
    const gx = p.GX + (row & 1) * (w >> 1);
    const col = Math.floor(gx / w);
    return [gx - col * w, p.GY - row * h, hash(col, row, seed), col, row];
  }

  // ---- Side helpers -----------------------------------------------------------------
  const L = (sp) => sp.face === 0;
  // Face tone from a ramp: base index for the right face, one darker for the left.
  const fc = (sp, r, i) => r[Math.max(0, L(sp) ? i - 1 : i)];
  // Staggered block courses: blocks bw wide (divides 16), courses ch tall (divides 8).
  function blocks(sp, bw, ch, off) {
    const row = Math.floor((sp.pv - off) / ch);
    const u = sp.pu + (row & 1) * (bw >> 1);
    return { row, bu: mod(u, bw), bv: mod(sp.pv - off, ch), id: hash(Math.floor(u / bw) + sp.t.x * 7 + sp.t.y * 13 + sp.face * 3, row, 777) };
  }
  const bottom = (sp) => sp.pv === sp.pdepth - 1;

  // Earth under a turf/crust: warm soil with strata and embedded pebbles.
  function soil(sp, dark) {
    const { pv, pwu } = sp;
    const band = Math.floor((pv + Math.floor(hash(pwu >> 2, 3, 901) * 2)) / 5);
    let c = band % 3 === 2 ? fc(sp, WD, 1) : fc(sp, WD, 2);
    if (dark) c = fc(sp, ST, 1);
    // Pebbles: 2x2 stones on a jittered 5x4 grid.
    const cx = Math.floor(pwu / 5), cy = Math.floor((pv + (cx & 1) * 2) / 4);
    if (hash(cx, cy, 902) > 0.8) {
      const ox = Math.floor(hash(cx, cy, 903) * 3), oy = 1;
      const lx = mod(pwu, 5) - ox, ly = mod(pv + (cx & 1) * 2, 4) - oy;
      if (lx >= 0 && lx < 2 && ly >= 0 && ly < 2) return lx + ly === 0 ? fc(sp, ST, 3) : fc(sp, ST, 2);
      if (lx >= 0 && lx < 2 && ly === 2) return fc(sp, WD, 1);
    }
    return c;
  }

  // ======================================================================================
  // g — Grass
  // ======================================================================================
  function grassTop(p) {
    px(p);
    const { wx, wy } = p;
    const worn = vnoise(wx * 1.3, wy * 1.3, 5);
    if (worn > 0.75) return out(p, dirtColor(p));
    if (worn > 0.72) return out(p, GR[2]);
    const n = vnoise(wx * 1.6, wy * 1.6, 17) * 0.7 + vnoise(wx * 4, wy * 4, 18) * 0.3;
    let c = n > 0.56 ? GR[4] : n > 0.52 ? (((p.GX + p.GY) & 1) ? GR[4] : GR[3]) : GR[3];
    // Tufts: a dark "v" with a lit tip, on a staggered 6x4 screen grid.
    const [cx, cy, id] = cell(p, 6, 4, 19);
    if (id < 0.6) {
      const ox = Math.floor(id * 5) % 3;
      const x = cx - ox;
      if (cy === 1 && (x === 0 || x === 2)) c = GR[2];
      else if (cy === 2 && x === 1) c = GR[2];
      else if (cy === 0 && x === 0 && id < 0.25) c = GR[5];
    }
    // Rare flowers: a 3x3 plus.
    const [fx, fy, fid, fc_, fr] = cell(p, 14, 8, 23);
    if (fid > 0.93) {
      const x = fx - 5, y = fy - 3;
      const petal = [WH, GD[3], PK[3], BL[5]][Math.floor(hash(fc_, fr, 24) * 4)];
      if (x === 0 && y === 0) return out(p, GD[2]);
      if (Math.abs(x) + Math.abs(y) === 1) return out(p, petal);
    }
    return out(p, c);
  }
  function turfSide(sp, turf, soilFn) {
    const lip = 2 + Math.floor(hash(sp.pwu >> 1, 0, 911) * 3);
    if (sp.pv === 0) return fc(sp, turf, 4);
    if (sp.pv < lip) return fc(sp, turf, 3);
    if (sp.pv === lip) return fc(sp, WD, 1);
    if (bottom(sp)) return WD[0];
    return soilFn(sp);
  }
  T.g.top = grassTop;
  T.g.side = (sp) => turfSide(sp, GR, soil);

  // ======================================================================================
  // d — Dirt
  // ======================================================================================
  function dirtColor(p) {
    let c = WD[3];
    const n = vnoise(p.wx * 2.2, p.wy * 2.2, 29);
    if (n < 0.35) c = WD[2];
    // Clods / pebbles: 2x2 lattice stones lit top-left.
    const ci = Math.floor(p.tx / 3), cj = Math.floor(p.ty / 3);
    const h = hash(ci, cj, 31);
    if (h > 0.88) {
      const li = mod(p.tx, 3), lj = mod(p.ty, 3);
      if (li < 2 && lj < 2) {
        const stone = h > 0.95;
        const [id, e] = bevel(p, (i, j) => (mod(i, 3) < 2 && mod(j, 3) < 2 && Math.floor(i / 3) === ci && Math.floor(j / 3) === cj ? 1 : 0));
        void id;
        if (stone) return e > 0 ? ST[4] : e < 0 ? ST[2] : ST[3];
        return e > 0 ? WD[4] : WD[2];
      }
    }
    // Light speckle band along ruts.
    const r = vnoise(p.wx * 3, p.wy * 3, 33);
    if (r > 0.72) c = WD[4];
    return c;
  }
  T.d.top = (p) => {
    px(p);
    const { wx, wy } = p;
    // Grass creeping in.
    const g = vnoise(wx * 1.6, wy * 1.6, 9);
    if (g > 0.74) return out(p, g > 0.8 ? GR[3] : GR[2]);
    return out(p, dirtColor(p));
  };
  T.d.side = (sp) => {
    if (sp.pv === 0) return fc(sp, WD, 4);
    if (bottom(sp)) return WD[0];
    return soil(sp);
  };

  // ======================================================================================
  // s — Stone (Zenan): grey paving courses with mossy joints.
  // ======================================================================================
  const sPat = bond(7, 5, 41);
  T.s.top = (p) => {
    px(p);
    const [id, e] = bevel(p, sPat);
    const moss = vnoise(p.wx * 1.4, p.wy * 1.4, 13);
    if (id < 0) return out(p, moss > 0.66 ? GR[2] : SL[0]);
    const k = (id % 97) / 97;
    let c = k < 0.45 ? SL[2] : k < 0.85 ? SL[3] : ST[3];
    if (e > 0) c = k < 0.45 ? SL[3] : k < 0.85 ? SL[4] : ST[4];
    else if (e < 0) c = k < 0.45 ? SL[1] : k < 0.85 ? SL[2] : ST[2];
    if (moss > 0.74 && e !== 0) c = GR[3];
    return out(p, c);
  };
  function brickSide(sp, r, i0, mortar, bw = 8, ch = 4, cap = 1) {
    if (sp.pv < cap) return fc(sp, r, i0 + 2);
    if (bottom(sp)) return mortar;
    const b = blocks(sp, bw, ch, cap);
    if (b.bv === ch - 1 || b.bu === bw - 1) return mortar;
    const i = i0 + (b.id > 0.7 ? 1 : 0) - (b.id < 0.2 ? 1 : 0);
    if (b.bv === 0) return fc(sp, r, Math.min(r.length - 1, i + 1));
    return fc(sp, r, i);
  }
  T.s.side = (sp) => brickSide(sp, SL, 2, IN[2]);

  // ======================================================================================
  // b — Bridge: planks with dark gaps and nail heads; open underneath with posts.
  // ======================================================================================
  T.b.top = (p) => {
    px(p);
    const pi = mod(p.tx, 6);
    const plank = Math.floor(p.tx / 6);
    if (pi === 5) return out(p, WD[0]);
    const k = hash(plank, p.t.y, 51);
    let c = k > 0.6 ? WD[4] : WD[3];
    if (pi === 0) c = k > 0.6 ? WD[5] : WD[4];
    else if (pi === 4) c = WD[2];
    const lj = mod(p.ty, 16);
    if ((lj === 2 || lj === 13) && pi === 2) c = SL[4]; // nails
    // Grain streaks.
    if ((pi === 2 || pi === 3) && hash(plank * 2 + (pi & 1), Math.floor(p.ty / 5), 52) > 0.8) c = WD[2];
    return out(p, c);
  };
  T.b.side = (sp) => {
    const { pv, pu } = sp;
    if (pv === 0) return fc(sp, WD, 5);
    if (pv < 3) return fc(sp, WD, 3);
    if (pv === 3) return WD[1];
    const post = mod(pu, 8);
    if (post === 1 || post === 2) return post === 1 ? fc(sp, WD, 3) : fc(sp, WD, 2);
    if (post === 3 && pv < sp.pdepth) return WD[0];
    return null;
  };

  // ======================================================================================
  // Water family (animated over 8 frames).
  // ======================================================================================
  // opts: base, deep, lite, glint, foam
  // Sides get no frame number; tops are rasterised first, so remember it here.
  let curFrame = 0;
  function waterTop(p, o) {
    px(p);
    const f = (curFrame = p.frame | 0);
    // Static depth variance (two tones, clean boundaries).
    const n = vnoise(p.wx * 0.9, p.wy * 0.9, 61) * 0.7 + vnoise(p.wx * 2.3, p.wy * 2.3, 62) * 0.3;
    let c = n < 0.42 ? o.deep : o.base;
    const bed = o.bed && o.bed(p);
    if (bed) c = bed;
    // Slow swell bands: thin lighter crests drifting down the screen.
    const sw = mod(p.GY * 2 + p.GX + Math.floor(n * 10) * 2 - f * 3, 24);
    if (sw < 2 && n > 0.36) c = o.lite;
    // Glints: short horizontal dashes that grow and shrink.
    const [cx, cy, id] = cell(p, 12, 6, 63);
    const ph = Math.floor(id * 8);
    const len = [0, 1, 2, 3, 4, 3, 2, 1][(f + ph) & 7];
    const x0 = 1 + Math.floor(hash(id * 1e4, 1, 64) * 5), y0 = 1 + Math.floor(id * 3.99);
    if (len && cy === y0 && cx >= x0 && cx < x0 + len) c = o.glint;
    else if (len > 1 && cy === y0 + 1 && cx > x0 && cx <= x0 + len) c = o.deep;
    // Foam where the water meets land (world lattice distance to the shore edge).
    if (o.foam) {
      const { li, lj } = p;
      let d = 99, along = 0;
      if (landAt(p, -1, 0) && li < d) { d = li; along = p.ty; }
      if (landAt(p, 1, 0) && 15 - li < d) { d = 15 - li; along = p.ty; }
      if (landAt(p, 0, -1) && lj < d) { d = lj; along = p.tx; }
      if (landAt(p, 0, 1) && 15 - lj < d) { d = 15 - lj; along = p.tx; }
      if (d < 4) {
        const lap = Math.sin((f / 8) * Math.PI * 2 + along * 0.55) > 0 ? 1 : 0;
        if (d <= lap) return out(p, o.foam[0]);
        if (d === lap + 1) return out(p, mod(along + f, 3) === 0 ? o.foam[0] : o.foam[1]);
        if (d === lap + 2 && mod(along - f, 4) === 0) return out(p, o.foam[1]);
      }
    }
    return out(p, c);
  }
  function waterSide(sp, o) {
    if (sp.pv === 0) return o.lite;
    if (bottom(sp)) return o.edge;
    const streak = mod(sp.pwu * 3, 7) === 0 && mod(sp.pv - curFrame, 8) < 5;
    const c = L(sp) ? o.deep : o.base;
    if (streak && sp.pv > 1) return L(sp) ? o.edge : o.deep;
    return c;
  }
  const RIVER = { base: BL[3], deep: BL[2], lite: BL[4], glint: BL[5], foam: [BL[6], BL[5]], edge: BL[1] };
  T.w.top = (p) => waterTop(p, RIVER);
  T.w.side = (sp) => waterSide(sp, RIVER);

  // f — Shallows: lighter water over a sandy/pebbly bed.
  const SHALLOW = { base: BL[4], deep: BL[3], lite: BL[5], glint: BL[6], foam: [WH, BL[6]], edge: BL[2] };
  SHALLOW.bed = (p) => {
    // Bed stones seen through the water (static, on the lattice).
    const ci = Math.floor(p.tx / 4), cj = Math.floor(p.ty / 4);
    const h = hash(ci, cj, 71);
    if (h < 0.82) return null;
    const li = mod(p.tx, 4), lj = mod(p.ty, 4);
    return li > 0 && lj > 0 && li + lj < 6 ? (h > 0.92 ? TE[2] : SL[3]) : null;
  };
  T.f.top = (p) => waterTop(p, SHALLOW);
  T.f.side = (sp) => waterSide(sp, SHALLOW);

  // W — Deep sea.
  const SEA = { base: BL[2], deep: BL[1], lite: BL[3], glint: BL[5], foam: [BL[6], BL[4]], edge: BL[0] };
  T.W.top = (p) => waterTop(p, SEA);
  T.W.side = (sp) => waterSide(sp, SEA);

  // ======================================================================================
  // c — Cobblestones (Leene Square): rounded setts, mixed warm and cool.
  // ======================================================================================
  // Setts 4x4 on a period of 5 (rows staggered), corners knocked off so they read round.
  const cPat = (i, j) => {
    const row = Math.floor(j / 5);
    const ii = i + (row & 1) * 2 + (row % 3);
    const a = mod(ii, 5), b = mod(j, 5);
    if (a === 4 || b === 4) return -1;
    if (a === 3 && b === 3) return -1;
    return Math.floor(ii / 5) * 1000 + row;
  };
  T.c.top = (p) => {
    px(p);
    const [id, e] = bevel(p, cPat);
    if (id < 0) {
      const moss = vnoise(p.wx * 3, p.wy * 3, 402) > 0.7;
      return out(p, moss ? GR[2] : ST[0]);
    }
    const k = hash(id, 7, 403);
    const cool = k > 0.84;
    const r = cool ? SL : ST;
    let i = cool ? 2 : k < 0.3 ? 3 : 2;
    if (e > 0) i += 1;
    return out(p, r[Math.min(r.length - 1, i)]);
  };
  T.c.side = (sp) => brickSide(sp, ST, 2, ST[0], 8, 4, 1);

  // ======================================================================================
  // j — Castle flagstones: large dressed slabs with a bevel.
  // ======================================================================================
  const jPat = bond(8, 8, 591);
  T.j.top = (p) => {
    px(p);
    const [id, e] = bevel(p, jPat);
    if (id < 0) return out(p, IN[2]);
    const k = (id % 89) / 89;
    let i = k < 0.5 ? 2 : 3;
    if (e > 0) i += 1;
    else if (e < 0) i -= 1;
    let c = SL[i];
    // A few hairline cracks.
    if (e === 0 && hash(id, 1, 592) > 0.8) {
      const ci = mod(p.tx, 8), cj = mod(p.ty, 8);
      if (ci === cj + 1 && ci > 2 && ci < 6) c = SL[i - 1];
    }
    return out(p, c);
  };
  const jSide = (sp) => brickSide(sp, SL, 2, IN[2], 8, 4, 1);
  T.j.side = jSide;

  // ======================================================================================
  // e — Red carpet with a gold border where it ends.
  // ======================================================================================
  T.e.top = (p) => {
    px(p);
    const { li, lj } = p;
    const code = p.t.t;
    let d = 99;
    if (!sameAt(p, -1, 0, code)) d = Math.min(d, li);
    if (!sameAt(p, 1, 0, code)) d = Math.min(d, 15 - li);
    if (!sameAt(p, 0, -1, code)) d = Math.min(d, lj);
    if (!sameAt(p, 0, 1, code)) d = Math.min(d, 15 - lj);
    if (d === 0) return out(p, GD[0]);
    if (d === 1) return out(p, GD[2]);
    if (d === 2) return out(p, RD[1]);
    // Field: iso diamond lattice of dark lines with gold studs at the crossings.
    const a = mod(p.tx + 4, 8), b = mod(p.ty + 4, 8);
    if ((a === 0 && (b === 0)) ) return out(p, GD[3]);
    if (a === 0 || b === 0) return out(p, RD[1]);
    if ((a === 4 && b === 4)) return out(p, RD[3]);
    if ((a === 1 || b === 1) && (a !== 0 && b !== 0)) return out(p, RD[2]);
    return out(p, (a >= 3 && a <= 5 && b >= 3 && b <= 5) ? RD[3] : RD[2]);
  };
  T.e.side = (sp) => {
    if (sp.pv === 0) return fc(sp, RD, 3);
    if (sp.pv === 1) return fc(sp, RD, 2);
    if (sp.pv === 2) return fc(sp, GD, 2);
    return jSide({ ...sp, pv: sp.pv - 3 + 1, pdepth: sp.pdepth - 2, face: sp.face, pu: sp.pu, t: sp.t });
  };

  // ======================================================================================
  // h — Wood floor: long boards with staggered butt joints.
  // ======================================================================================
  T.h.top = (p) => {
    px(p);
    const pi = mod(p.ty, 4);
    const board = Math.floor(p.ty / 4);
    if (pi === 3) return out(p, WD[1]);
    const off = Math.floor(hash(board, 0, 421) * 16);
    const seg = Math.floor((p.tx + off) / 16);
    const sj = mod(p.tx + off, 16);
    if (sj === 0) return out(p, WD[1]);
    const k = hash(board, seg, 422);
    let i = k < 0.25 ? 2 : 3;
    if (pi === 0) i += 1;
    let c = WD[i];
    // Grain: short dark streaks along the board.
    if (pi === 1 && hash(Math.floor((p.tx + off) / 3), board, 423) > 0.82) c = WD[i - 1];
    // Nail pair next to the joint.
    if ((sj === 1 || sj === 15) && pi === 1) c = WD[1];
    return out(p, c);
  };
  T.h.side = (sp) => {
    const { pv } = sp;
    if (pv === 0) return fc(sp, WD, 5);
    if (bottom(sp)) return WD[0];
    const bv = mod(pv - 1, 4);
    if (bv === 3) return WD[1];
    const id = hash(Math.floor(pv / 4), sp.t.x + sp.t.y * 5 + sp.face, 424);
    const i = id > 0.6 ? 3 : 2;
    if (bv === 0) return fc(sp, WD, i + 1);
    if (mod(sp.pu + Math.floor(id * 8), 12) === 0) return WD[1];
    return fc(sp, WD, i);
  };

  // ======================================================================================
  // p — Mountain rock: big lit facets, dark cracks, lichen.
  // ======================================================================================
  function worley(x, y, s, jit = 0.8) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let f1 = 9, f2 = 9, id = 0, ox = 0, oy = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx, cy = yi + dy;
        const fx = cx + 0.5 + (hash(cx, cy, s) - 0.5) * jit;
        const fy = cy + 0.5 + (hash(cx, cy, s + 1) - 0.5) * jit;
        const ddx = x - fx, ddy = y - fy;
        const d = ddx * ddx + ddy * ddy;
        if (d < f1) { f2 = f1; f1 = d; id = hash(cx, cy, s + 2); ox = ddx; oy = ddy; }
        else if (d < f2) f2 = d;
      }
    return { f1: Math.sqrt(f1), f2: Math.sqrt(f2), id, ox, oy };
  }
  // Facet shading lit from the screen's top-left: project the offset onto view axes.
  function facetLit(p, w) {
    // world offset -> view offset
    const [va, vb] = INV[p._r](w.ox, w.oy);
    return -(va * 1.0 + vb * 0.4);
  }
  // Worley on the pixel lattice (cells centred), so edges are crisp.
  const wl = (p, scale, s, jit) => worley((p.tx + 0.5) / scale, (p.ty + 0.5) / scale, s, jit);
  T.p.top = (p) => {
    px(p);
    const w = wl(p, 7, 431, 0.9);
    const e = w.f2 - w.f1;
    if (e < 0.09) return out(p, SL[0]);
    const lit = facetLit(p, w);
    let i = 2 + (w.id > 0.66 ? 1 : 0) - (w.id < 0.2 ? 1 : 0);
    if (lit > 0.18) i += 1;
    else if (lit < -0.22) i -= 1;
    if (e < 0.18 && lit < 0) i -= 1;
    i = Math.max(1, Math.min(4, i));
    let c = SL[i];
    const moss = vnoise(p.wx * 0.9, p.wy * 0.9, 434);
    if (moss > 0.64) c = lit > 0.1 ? GR[3] : GR[2];
    return out(p, c);
  };
  function strata(sp, r, i0, seed) {
    const { pv, pwu } = sp;
    const wob = Math.floor(hash(pwu >> 2, 0, seed) * 2);
    const band = Math.floor((pv + wob) / 4);
    const bv = mod(pv + wob, 4);
    const k = hash(band, pwu >> 3, seed + 1);
    let i = i0 + (k > 0.65 ? 1 : 0) - (k < 0.15 ? 1 : 0);
    if (bv === 3) i -= 1;
    else if (bv === 0) i += 1;
    // Vertical cracks.
    if (mod(pwu + band * 3, 9) === 0 && k > 0.4) i -= 1;
    return fc(sp, r, Math.max(1, Math.min(r.length - 1, i)));
  }
  T.p.side = (sp) => {
    if (sp.pv === 0) return fc(sp, SL, 4);
    if (bottom(sp)) return SL[0];
    return strata(sp, SL, 2, 301);
  };

  // ======================================================================================
  // n — Snow with wind drifts; z — trodden snow path.
  // ======================================================================================
  T.n.top = (p) => {
    px(p);
    const d = vnoise(p.wx * 1.4, p.wy * 1.4, 441) * 0.7 + vnoise(p.wx * 3.5, p.wy * 3.5, 442) * 0.3;
    let c = SL[5];
    if (d < 0.38) c = SL[4];
    else if (d > 0.62) c = WH;
    // Drift shadows: short screen-horizontal shadow crescents.
    const [cx, cy, id] = cell(p, 10, 5, 443);
    if (id < 0.45 && cy === 2) {
      const x0 = Math.floor(id * 8);
      if (cx >= x0 && cx < x0 + 4) c = SL[4];
      if (cx >= x0 + 1 && cx < x0 + 3 && d > 0.3) c = cx === x0 + 1 ? SL[4] : SL[4];
    } else if (id < 0.45 && cy === 1) {
      const x0 = Math.floor(id * 8);
      if (cx >= x0 + 1 && cx < x0 + 3) c = WH;
    }
    // Sparkles.
    if (id > 0.93 && cx === 3 && cy === 3) c = BL[6];
    return out(p, c);
  };
  function snowSide(sp) {
    const lip = 2 + Math.floor(hash(sp.pwu >> 1, 0, 444) * 3);
    if (sp.pv === 0) return WH;
    if (sp.pv < lip) return fc(sp, SL, 5);
    const icicle = hash(sp.pwu, 0, 445);
    if (icicle > 0.78 && sp.pv < lip + 1 + Math.floor(icicle * 10 - 7.8) * 2) return L(sp) ? BL[5] : BL[6];
    if (sp.pv === lip) return fc(sp, SL, 2);
    if (bottom(sp)) return SL[0];
    return strata(sp, SL, 2, 446);
  }
  T.n.side = snowSide;
  T.z.top = (p) => {
    px(p);
    const d = vnoise(p.wx * 1.4, p.wy * 1.4, 571);
    let c = d > 0.45 ? SL[4] : SL[3];
    const mud = vnoise(p.wx * 2, p.wy * 2, 574);
    if (mud > 0.72) c = mud > 0.77 ? ST[2] : ST[3];
    // Footprints: little dark ovals (2x1 lattice) on a jittered grid.
    const ci = Math.floor(p.tx / 4), cj = Math.floor(p.ty / 4);
    const h = hash(ci, cj, 572);
    if (h > 0.55) {
      const a = mod(p.tx, 4), b = mod(p.ty, 4);
      if ((a === 1 && (b === 1 || b === 2)) ) c = mud > 0.72 ? ST[1] : SL[2];
    }
    if (d > 0.7 && mud < 0.6) c = SL[5];
    return out(p, c);
  };
  T.z.side = snowSide;

  // ======================================================================================
  // i — Ice sheet: glossy pale blue, diagonal sheen, white cracks.
  // ======================================================================================
  T.i.top = (p) => {
    px(p);
    const n = vnoise(p.wx * 1.2, p.wy * 1.2, 451);
    let c = n < 0.4 ? BL[5] : BL[6];
    // Screen-diagonal sheen streaks (the classic ice gloss).
    const s = mod(p.GX - p.GY * 2, 29);
    if (s < 2) c = WH;
    else if (s < 4 && n > 0.35) c = BL[6];
    else if (s === 5) c = BL[5];
    // Cracks: worley cell borders.
    const w = wl(p, 9, 453, 0.9);
    if (w.f2 - w.f1 < 0.06) c = n < 0.4 ? BL[4] : WH;
    return out(p, c);
  };
  T.i.side = (sp) => {
    if (sp.pv === 0) return WH;
    if (bottom(sp)) return BL[3];
    const s = mod(sp.pu * 2 - sp.pv, 13);
    if (s < 2) return L(sp) ? BL[5] : BL[6];
    const c = sp.pv < 3 ? fc(sp, BL, 6) : fc(sp, BL, 5);
    if (mod(sp.pwu, 7) === 0 && sp.pv > 3) return fc(sp, BL, 4);
    return c;
  };

  // ======================================================================================
  // a — Ash rock: black basalt plates, ember cracks; A — scree.
  // ======================================================================================
  T.a.top = (p) => {
    px(p);
    const w = wl(p, 8, 461, 0.85);
    const e = w.f2 - w.f1;
    if (e < 0.1) {
      const hot = vnoise(p.wx * 0.8, p.wy * 0.8, 462);
      return out(p, hot > 0.66 ? (hot > 0.76 ? GD[1] : hot > 0.7 ? RD[2] : RD[1]) : IN[0]);
    }
    const lit = facetLit(p, w);
    let c = w.id > 0.5 ? IN[2] : SL[0];
    if (lit > 0.2) c = w.id > 0.5 ? SL[0] : SL[1];
    else if (lit < -0.25) c = IN[1];
    const ash = vnoise(p.wx * 1.1, p.wy * 1.1, 463);
    if (ash > 0.66) c = lit > 0 ? ST[2] : ST[1];
    return out(p, c);
  };
  T.a.side = (sp) => {
    // Columnar basalt: 4 px columns, lit left edge.
    const col = Math.floor(sp.pu / 4) + sp.t.x * 5 + sp.t.y * 3 + sp.face * 7;
    const cu = mod(sp.pu, 4);
    const off = Math.floor(hash(col, 0, 464) * 8);
    if (sp.pv === 0) return fc(sp, SL, 1);
    if (cu === 3 || mod(sp.pv + off, 12) === 0) return IN[0];
    if (bottom(sp)) return RD[1];
    let c = cu === 0 ? fc(sp, SL, 1) : L(sp) ? IN[1] : IN[2];
    if (sp.pv > sp.pdepth - 5 && hash(col, sp.pv, 466) > 0.6) c = RD[1];
    return c;
  };
  T.A.top = (p) => {
    px(p);
    const n = vnoise(p.wx * 1.3, p.wy * 1.3, 582);
    let c = n > 0.5 ? ST[2] : ST[1];
    // Gravel: small lit stones on the lattice.
    const ci = Math.floor(p.tx / 3), cj = Math.floor(p.ty / 3);
    const h = hash(ci, cj, 581);
    if (h > 0.6 && mod(p.tx, 3) < 2 && mod(p.ty, 3) < 2) {
      const [, e] = bevel(p, (i, j) => (mod(i, 3) < 2 && mod(j, 3) < 2 && hash(Math.floor(i / 3), Math.floor(j / 3), 581) > 0.6 ? Math.floor(i / 3) * 999 + Math.floor(j / 3) : -1));
      c = e > 0 ? ST[3] : h > 0.85 ? SL[1] : ST[2];
      if (e < 0) c = ST[0];
    }
    if (vnoise(p.wx * 0.8, p.wy * 0.8, 583) > 0.7 && c === ST[1]) c = WD[2];
    return out(p, c);
  };
  T.A.side = (sp) => {
    if (sp.pv === 0) return fc(sp, ST, 3);
    if (bottom(sp)) return ST[0];
    return strata(sp, ST, 2, 585);
  };

  // ======================================================================================
  // l — Lava: dark crust plates drifting on a pulsing melt (animated).
  // ======================================================================================
  T.l.top = (p) => {
    px(p);
    const f = (curFrame = p.frame | 0);
    const ph = (f / 8) * Math.PI * 2;
    // Plates bob a pixel back and forth; the melt between them pulses.
    const dx = Math.round(Math.sin(ph) * 1.1), dy = Math.round(Math.cos(ph) * 1.1);
    const w = worley((p.tx + 0.5 + dx) / 9, (p.ty + 0.5 + dy) / 9, 471, 0.8);
    const e = w.f2 - w.f1;
    const heat = Math.sin(ph + w.id * 6.28 + (p.tx - p.ty) * 0.2);
    if (w.id > 0.72) {
      // Open molten pool: bright core with a pulsing ring.
      if (w.f1 < 0.18) return out(p, heat > 0 ? GD[4] : GD[3]);
      if (w.f1 < 0.3) return out(p, GD[2]);
      return out(p, e < 0.12 ? GD[1] : GD[1]);
    }
    if (e < 0.1) return out(p, heat > 0.2 ? GD[3] : GD[2]);
    if (e < 0.19) return out(p, heat > -0.4 ? GD[1] : GD[0]);
    if (e < 0.25) return out(p, RD[3]);
    // Crust plate: near-black body, lit top-left rim.
    const lit = facetLit(p, w);
    if (e < 0.34 && lit > 0) return out(p, RD[2]);
    if (e < 0.34) return out(p, RD[1]);
    if (lit < -0.2) return out(p, IN[1]);
    return out(p, w.id < 0.4 ? IN[2] : ST[0]);
  };
  T.l.side = (sp) => {
    const s = mod(sp.pv - curFrame + Math.floor(hash(sp.pwu >> 1, 0, 472) * 8), 8);
    if (sp.pv === 0) return GD[3];
    const i = s < 2 ? 3 : s < 5 ? 2 : 1;
    const c = [RD[2], GD[0], GD[1], GD[2]][i - (L(sp) ? 1 : 0)];
    return c;
  };

  // ======================================================================================
  // m — Zeal marble: white-blue slabs, soft veins, tarnished gold joints.
  // ======================================================================================
  const mPat = (i, j) => (mod(i, 8) === 0 || mod(j, 8) === 0 ? -1 : Math.floor(i / 8) * 1000 + Math.floor(j / 8));
  function marble(p) {
    const [id, e] = bevel(p, mPat);
    if (id < 0) {
      // Gold trim on every other course line, plain seams elsewhere.
      if (mod(p.ty, 16) === 0 || mod(p.tx, 16) === 0) return vnoise(p.wx * 2, p.wy * 2, 482) > 0.7 ? TE[1] : WD[4];
      return SL[3];
    }
    const light = hash(id, 3, 486) >= 0.35;
    let c = light ? SL[5] : SL[4];
    const v = Math.abs(Math.sin((p.wx * 0.7 + p.wy * 0.4) * 5 + vnoise(p.wx * 1.5, p.wy * 1.5, 481) * 6));
    if (v < 0.08) c = light ? SL[4] : SL[3];
    if (e > 0) c = light ? WH : SL[5];
    else if (e < 0) c = SL[3];
    return c;
  }
  T.m.top = (p) => {
    px(p);
    return out(p, marble(p));
  };
  function marbleSide(sp) {
    if (sp.pv === 0) return fc(sp, SL, 5);
    if (sp.pv === 1) return fc(sp, GD, 2);
    if (sp.pv === 2) return fc(sp, WD, 4);
    return brickSide({ pu: sp.pu, pv: sp.pv - 2, pdepth: sp.pdepth - 2, face: sp.face, t: sp.t, pwu: sp.pwu }, SL, 4, SL[2], 8, 4, 0);
  }
  T.m.side = marbleSide;

  // y — Dreamstone marble: glowing cyan crack network.
  T.y.top = (p) => {
    px(p);
    let c = marble(p);
    const w = wl(p, 10, 491, 0.95);
    const e = w.f2 - w.f1;
    const zone = vnoise(p.wx * 0.9, p.wy * 0.9, 492);
    if (zone > 0.38) {
      if (e < 0.06) c = BL[6];
      else if (e < 0.13) c = TE[2];
      else if (e < 0.19 && zone > 0.55) c = TE[3];
    }
    return out(p, c);
  };
  T.y.side = (sp) => {
    const c = marbleSide(sp);
    if (sp.pv > 3 && hash(sp.pwu >> 1, sp.pv >> 2, 494) > 0.9) return mod(sp.pv, 4) === 1 ? BL[6] : TE[3];
    return c;
  };

  // ======================================================================================
  // k — Hollow ceramic: glossy white tiles; K — split by red Lavos veins; O — inlay.
  // ======================================================================================
  // Tiles 8x8 lattice (2x2 per tile), seams on the lattice.
  const kPat8 = (i, j) => (mod(i + 4, 8) === 0 || mod(j + 4, 8) === 0 ? -1 : Math.floor((i + 4) / 8) * 1000 + Math.floor((j + 4) / 8));
  const kPat16 = (i, j) => (mod(i + 8, 16) === 0 || mod(j + 8, 16) === 0 ? -1 : Math.floor((i + 8) / 16) * 1000 + Math.floor((j + 8) / 16));
  // White glazed tiles, one per map tile (k/K), or small dark-blue inlay tiles (O).
  function ceramic(p, dark) {
    const n = dark ? 8 : 16, o = n >> 1;
    const [id, e] = bevel(p, dark ? kPat8 : kPat16);
    if (id < 0) return dark ? BL[4] : SL[3];
    const chk = (Math.floor((p.tx + o) / n) + Math.floor((p.ty + o) / n)) & 1;
    const R = dark ? [IN[2], BL[1], BL[1], BL[2]] : [SL[4], SL[4], SL[5], WH];
    let i = dark ? (chk ? 1 : 2) : 2;
    if (e > 0) i = 3;
    else if (e < 0) i = 0;
    // Glossy glint: a short diagonal streak near the lit corner (view space).
    const a = mod(p.tx + o, n) - o, b = mod(p.ty + o, n) - o;
    const [va, vb] = INV[p._r](a, b);
    if (e === 0) {
      if (dark ? va === -2 && vb >= -2 && vb <= 0 : (va === -4 || va === -5) && vb >= -5 && vb <= -1) i = 3;
      else if (!dark && va + vb > 3 && (chk || va + vb > 6)) i = 1;
    }
    return R[i];
  }
  T.k.top = (p) => {
    px(p);
    return out(p, ceramic(p, false));
  };
  function ceramicSide(sp) {
    if (sp.pv === 0) return WH;
    if (bottom(sp)) return SL[2];
    const pv = sp.pv - 1;
    if (mod(pv, 8) === 7) return SL[3];
    if (mod(sp.pu, 8) === 0) return fc(sp, SL, 3);
    if (mod(pv, 8) === 0) return fc(sp, SL, 5);
    return fc(sp, SL, 5 - (mod(pv, 8) > 4 ? 1 : 0));
  }
  T.k.side = ceramicSide;

  function veinAt(wx, wy) {
    const r1 = Math.abs(vnoise(wx * 0.9, wy * 0.9, 511) - 0.5);
    const r2 = Math.abs(vnoise(wx * 1.9 + 3, wy * 1.9, 512) - 0.5);
    return Math.min(r1 * 1.2, r2 * 2.2 + 0.02);
  }
  T.K.top = (p) => {
    px(p);
    // Sample the vein field on the lattice centre so strokes stay 1-2 px wide.
    const v = veinAt((p.tx + 0.5) / 16, (p.ty + 0.5) / 16);
    if (v < 0.018) return out(p, RD[4]);
    if (v < 0.034) return out(p, RD[2]);
    if (v < 0.05) return out(p, RD[0]);
    if (v < 0.06) return out(p, PK[3]);
    return out(p, ceramic(p, false));
  };
  T.K.side = (sp) => {
    const v = veinAt(sp.pwu * 0.06, sp.pv * 0.06 + sp.t.y);
    if (v < 0.025) return RD[3];
    if (v < 0.05) return RD[1];
    return ceramicSide(sp);
  };
  T.O.top = (p) => {
    px(p);
    return out(p, ceramic(p, true));
  };
  T.O.side = ceramicSide;

  // ======================================================================================
  // o — End of Time slate: dark irregular flagstones; jagged floating underside.
  // ======================================================================================
  T.o.top = (p) => {
    px(p);
    const w = wl(p, 7, 531, 0.6);
    const e = w.f2 - w.f1;
    if (e < 0.1) return out(p, IN[0]);
    const lit = facetLit(p, w);
    const hi = w.id > 0.5;
    let c = hi ? SL[1] : SL[0];
    if (e < 0.2 && lit > 0) c = hi ? SL[2] : SL[1];
    else if (e < 0.2 && lit < 0) c = IN[2];
    else if (hash(p.tx >> 1, p.ty >> 1, 534) > 0.97) c = hi ? SL[2] : SL[1];
    return out(p, c);
  };
  T.o.side = (sp) => {
    const cut = Math.floor(sp.pdepth * (0.55 + 0.45 * vnoise(sp.pwu * 0.25, 0, 532))) + 3;
    if (sp.pv > cut) return null;
    if (sp.pv === 0) return fc(sp, SL, 2);
    if (sp.pv >= cut - 1) return IN[0];
    const band = Math.floor(sp.pv / 4);
    const k = hash(band, sp.pwu >> 2, 533);
    if (mod(sp.pv, 4) === 3) return IN[0];
    return L(sp) ? (k > 0.5 ? IN[1] : IN[2]) : k > 0.5 ? IN[2] : SL[0];
  };

  // ======================================================================================
  // q — Sand / beach: warm sand with wind ripples.
  // ======================================================================================
  T.q.top = (p) => {
    px(p);
    const n = vnoise(p.wx * 1.2, p.wy * 1.2, 541);
    let c = n > 0.62 ? SK[4] : SK[3];
    // Ripples: wavy screen-horizontal lines, shadow below a lit crest.
    const wob = Math.floor(vnoise(p.GX * 0.08, p.GY * 0.03, 543) * 6);
    const r = mod(p.GY + wob, 6);
    const seg = vnoise(p.GX * 0.12, (p.GY + wob) * 0.05, 544) > 0.42;
    if (seg && r === 0) c = SK[2];
    else if (seg && r === 5) c = SK[4];
    const [cx, cy, id] = cell(p, 16, 10, 542);
    if (id > 0.95 && cy === 4 && (cx === 7 || cx === 8)) c = cx === 7 ? PK[3] : PK[2];
    return out(p, c);
  };
  T.q.side = (sp) => {
    if (sp.pv === 0) return fc(sp, SK, 4);
    if (sp.pv < 3) return fc(sp, SK, 3);
    if (bottom(sp)) return SK[0];
    return strata(sp, SK, 2, 545);
  };

  // ======================================================================================
  // S — Archive stack: grated walkway on shelf blocks full of porcelain tablets.
  // ======================================================================================
  T.S.top = (p) => {
    px(p);
    const { li, lj } = p;
    const rail = Math.min(li, 15 - li, lj, 15 - lj);
    if (rail === 0) return out(p, SL[3]);
    if (rail === 1) return out(p, SL[1]);
    const gi = mod(p.tx, 3), gj = mod(p.ty, 3);
    if (gi === 0 && gj === 0) return out(p, SL[2]);
    if (gi === 0 || gj === 0) return out(p, SL[4]);
    return out(p, SL[5]);
  };
  T.S.side = (sp) => {
    const { pv, pu } = sp;
    if (pv === 0) return WH;
    if (pv < 3) return fc(sp, SL, 4);
    if (bottom(sp)) return IN[1];
    const sv = mod(pv - 3, 8);
    if (sv === 0) return fc(sp, SL, 4);
    if (sv === 1) return SL[1];
    if (mod(pu, 16) === 15) return fc(sp, SL, 3); // upright
    const shelf = Math.floor((pv - 3) / 8);
    const slot = Math.floor(pu / 2) + sp.face * 11 + sp.t.x * 3 + sp.t.y * 5;
    const hgt = 3 + Math.floor(hash(slot, shelf, 551) * 4);
    if (8 - sv > hgt || mod(pu, 2) === 1 && hash(slot, shelf, 553) > 0.5) return IN[1];
    const id = hash(slot, shelf, 552);
    const c = id > 0.9 ? RD[2] : id > 0.75 ? BL[4] : id > 0.35 ? SL[5] : SL[4];
    if (8 - sv === hgt) return c === SL[5] ? WH : c;
    return L(sp) && c === SL[5] ? SL[4] : c;
  };

  // v — Void: nothing is drawn.
  T.v.top = () => IN[0];
  T.v.side = () => null;
})();
