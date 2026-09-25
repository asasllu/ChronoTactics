// All maps. Schema: docs/ENGINE_SPEC.md §6.
//
// Story maps are painted with a tiny builder (fill / rect / literal rows) so
// the contract coordinates (markers, zones) stay exact; each map still ends
// up as plain `terrain` / `height` string rows.
(function () {
  const CT = (window.CT = window.CT || {});
  CT.MAPS = CT.MAPS || {};

  // Extra-mode skirmish map (the original prototype battlefield).
  CT.MAPS.zenan = {
    id: 'zenan', name: 'Zenan Riverbank', theme: 'dusk', music: 'mus_battle',
    terrain: [
      'gggggwwwssss',
      'gtgggwwwssss',
      'ggggdwwwdsss',
      'ggdddwwwdrss',
      'ggdddbbbddss',
      'gggddbbbddss',
      'gtggdwwwddds',
      'ggrggwwwggts',
      'gggggwwwgggg',
      'tggggfffgggg',
      'ggggdwwwggtg',
      'gtggdwwwgggg',
    ],
    height: [
      '111220002334',
      '111120002334',
      '111110001233',
      '011110001223',
      '001111111122',
      '001111111122',
      '001110001112',
      '101110001111',
      '211110001111',
      '221110001111',
      '321110001112',
      '332110001122',
    ],
    decor: [],
    zones: {},
    markers: { center: [6, 5] },
  };

  // ---- Builder ----------------------------------------------------------------
  const h36 = (v) => Math.max(0, Math.min(35, v | 0)).toString(36);
  function grid(w, h, t, z) {
    const T = Array.from({ length: h }, () => Array(w).fill(t));
    const Z = Array.from({ length: h }, () => Array(w).fill(z));
    const g = {
      w, h, T, Z,
      in: (x, y) => x >= 0 && y >= 0 && x < w && y < h,
      t: (x, y) => T[y][x],
      z: (x, y) => Z[y][x],
      set(x, y, t, z) {
        if (!g.in(x, y)) return g;
        if (t != null) T[y][x] = t;
        if (z != null) Z[y][x] = z;
        return g;
      },
      rect(x0, y0, x1, y1, t, z) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.set(x, y, t, z);
        return g;
      },
      tiles(list, t, z) {
        for (const [x, y] of list) g.set(x, y, t, z);
        return g;
      },
      // Literal overlays: terrain rows ('.' keeps) and/or height rows (base-36, '.' keeps).
      rows(tRows, zRows) {
        if (tRows) tRows.forEach((r, y) => [...r].forEach((c, x) => c !== '.' && g.set(x, y, c, null)));
        if (zRows) zRows.forEach((r, y) => [...r].forEach((c, x) => c !== '.' && g.set(x, y, null, parseInt(c, 36))));
        return g;
      },
      each(fn) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(x, y);
        return g;
      },
      out: () => ({ terrain: T.map((r) => r.join('')), height: Z.map((r) => r.map(h36).join('')) }),
    };
    return g;
  }
  // Decor list helper: D('pine', [[x,y],[x,y,variant]], defaultVariant)
  const D = (kind, list, v = 0) => list.map(([x, y, vv]) => ({ x, y, kind, variant: vv != null ? vv : v }));
  const R = (x0, y0, x1, y1) => [x0, y0, x1, y1];
  const tileList = (fn, w, h) => {
    const out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (fn(x, y)) out.push([x, y]);
    return out;
  };
  function def(id, name, theme, music, g, decor, zones, markers) {
    CT.MAPS[id] = { id, name, theme, music, ...g.out(), decor, zones, markers };
  }

  // ==============================================================================
  // PROLOGUE — Leene Square, the night after Lavos (16×14)
  // ==============================================================================
  {
    const g = grid(16, 14, 'c', 0);
    g.rect(0, 0, 15, 0, 'g', 1).rect(0, 0, 0, 13, 'g', 1); // raised garden bank (back)
    g.rect(15, 1, 15, 13, 'g', 0).rect(1, 13, 15, 13, 'g', 0);
    g.rect(1, 1, 3, 2, 'g', 1); // Gate lawn
    g.rect(9, 1, 12, 4, 's', 1).set(11, 2, 's', 2); // bell platform + tower plinth
    g.rect(4, 4, 6, 6, 's', 1); // fountain rim
    g.rect(1, 6, 2, 7, 'h', 1); // west stall stage
    g.rect(13, 7, 14, 8, 'h', 1); // east stall stage
    g.rect(1, 11, 4, 12, 'g', 0); // Epoch lawn
    g.rect(11, 11, 14, 12, 'g', 0).rect(12, 10, 14, 10, 'g', 0);
    g.rect(6, 12, 8, 13, 'd', 0); // road south
    g.tiles([[5, 12], [9, 12]], 'c', 0);
    def('leene_square', "Leene Square", 'night', 'mus_fair_night', g, [
      ...D('bell_tower', [[11, 2]]),
      ...D('fountain', [[5, 5]]),
      ...D('tent', [[1, 4, 0], [1, 9, 1], [14, 5, 2], [14, 10, 3], [13, 12, 0]]),
      ...D('lantern', [[8, 1, 0], [13, 1, 1], [3, 3, 1], [3, 7, 0], [12, 6, 1], [9, 11, 0], [5, 11, 1], [13, 9, 0], [7, 5, 0]]),
      ...D('table', [[2, 5, 0], [2, 10, 1], [14, 6, 1]]),
      ...D('barrel', [[2, 8], [14, 11]]),
      ...D('crate', [[13, 4, 0], [14, 4, 1], [1, 10, 0]]),
      ...D('tree', [[0, 0, 0], [2, 0, 1], [4, 0, 2], [6, 0, 0], [14, 0, 1], [0, 3, 2], [0, 6, 1], [0, 9, 0], [0, 12, 2], [15, 2, 0], [15, 7, 1], [15, 12, 2], [12, 11, 1]]),
      ...D('bush', [[8, 0, 1], [10, 0], [12, 0, 1], [15, 4], [15, 9, 1], [1, 13], [4, 13, 1], [11, 13], [15, 13, 1]]),
      ...D('flowers', [[1, 1, 0], [3, 1, 1], [2, 12, 2], [4, 11, 0], [12, 12, 1], [14, 12, 2], [3, 13, 1], [13, 13, 0]]),
    ], {
      EXIT: [[6, 13], [7, 13], [8, 13]],
    }, {
      bell: [11, 3], crono: [10, 5], marle: [9, 7], lucca: [7, 9], frog: [3, 8], rift: [8, 7],
      epoch: [3, 12], gate: [2, 1], robo: [12, 5],
      fair1: [7, 3], fair2: [10, 9], fair3: [12, 8], fair4: [6, 10],
    });
  }

  // ==============================================================================
  // CHAPTER 1 — Guardia Castle throne room, 600 A.D. (14×12)
  // ==============================================================================
  {
    const g = grid(14, 12, 'j', 0);
    g.rect(0, 0, 13, 0, 'j', 3).rect(0, 0, 0, 11, 'j', 3); // back walls
    g.rect(3, 1, 10, 3, 'j', 1); // dais
    g.rect(5, 1, 8, 3, 'e', 1); // dais carpet
    g.rect(6, 4, 7, 11, 'e', 0); // runner to the doors
    g.rect(1, 5, 2, 6, 'h', 0); // merchant's corner boards (west)
    def('guardia_throne', 'Guardia Castle', 'castle', 'mus_guardia_600', g, [
      ...D('throne', [[6, 1], [7, 1]]),
      ...D('banner', [[2, 1, 0], [11, 1, 0], [4, 1, 1], [9, 1, 1]]),
      ...D('pillar', [[2, 4], [2, 7], [2, 10], [11, 4], [11, 7], [11, 10]]),
      ...D('torch', [[3, 1], [10, 1], [1, 9], [12, 9], [1, 3], [12, 3]]),
      ...D('table', [[1, 5, 1]]),
      ...D('barrel', [[1, 7]]),
      ...D('crate', [[13, 1, 0], [13, 2, 1], [12, 1, 0]]),
      ...D('save_point', [[12, 6]]),
    ], {
      EXIT_SOUTH: [[6, 11], [7, 11]],
    }, {
      king: [6, 1], leene: [7, 1], guard1: [4, 4], guard2: [9, 4], entrance: [7, 10], party: [6, 5],
      shop: [1, 6], save: [12, 6],
    });
  }

  // ==============================================================================
  // CHAPTER 1 — Denadoro Pass (16×16): waterfall column x=8, bridge (7..9,5) h3,
  // shrine platform (6..9,1..2) h4.
  // ==============================================================================
  {
    const g = grid(16, 16, 'g', 0);
    g.rows(null, [
      '4444444444444444',
      '4444334444444444',
      '4433344444433444',
      '4333333434433344',
      '3332333323333234',
      '3322233333222223',
      '4422223322221122',
      '4442112322221122',
      '4432111212211112',
      '3331101111210011',
      '3331000101110001',
      '3331000000110000',
      '2100000000000000',
      '1000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]);
    // Terrain from height: bare rock high up, grass below, snow on the crags.
    g.each((x, y) => {
      const z = g.z(x, y);
      g.set(x, y, z >= 4 ? 'p' : z === 3 ? 'p' : z === 2 ? ((x * 7 + y * 3) % 5 === 0 ? 'p' : 'g') : 'g');
      if (z >= 4 && (x <= 3 || x >= 12) && y <= 1) g.set(x, y, 'n');
    });
    g.rect(6, 0, 9, 2, 's', 4); // shrine (row 0 = back)
    g.set(6, 3, 's', 4); // shrine stair landing
    // Winding dirt trail (west).
    g.tiles([[7, 15], [7, 14], [6, 14], [6, 13], [5, 13], [5, 12], [5, 11], [4, 11], [4, 10], [4, 9], [4, 8], [3, 8], [3, 7], [3, 6], [3, 5], [4, 5], [4, 4], [5, 4], [6, 4]], 'd');
    // East climb.
    g.tiles([[9, 14], [10, 13], [10, 12], [11, 12], [11, 11], [11, 10], [11, 9], [11, 8], [12, 7], [13, 7], [13, 6], [13, 5], [13, 4], [12, 3]], 'd');
    // River x=8 (bridge at y5).
    const river = [[3, 3], [4, 2], [6, 2], [7, 2], [8, 1], [9, 1], [10, 0], [11, 0], [12, 0]];
    for (const [y, z] of river) g.set(8, y, 'w', z);
    g.set(8, 5, 'b', 3);
    g.tiles([[7, 5], [9, 5]], 'b', 3);
    g.tiles([[8, 13], [8, 14], [8, 15], [9, 15], [7, 13]], 'f', 0);
    g.set(9, 12, 'f', 0);
    def('denadoro', 'Denadoro Pass', 'mountain', 'mus_denadoro', g, [
      ...D('waterfall', [[8, 3, 1], [8, 4, 1], [8, 8, 1], [8, 10, 1]]),
      ...D('cairn', [[4, 12]]),
      ...D('broken_column', [[6, 0, 0], [9, 0, 0]]),
      ...D('sword_altar', [[7, 0]]),
      ...D('rock', [[9, 6], [10, 6], [11, 6], [12, 6], [1, 9], [14, 12], [2, 3]]),
      ...D('pine', [[0, 5, 0], [1, 6, 1], [0, 8, 1], [2, 10, 0], [0, 11, 1], [1, 12, 0], [5, 7, 0], [6, 8, 1], [14, 8, 0], [15, 7, 1],
        [13, 9, 1], [15, 10, 0], [12, 13, 1], [14, 14, 0], [0, 14, 1], [2, 15, 0], [10, 3, 1], [15, 5, 0], [3, 13, 0], [11, 14, 0]]),
      ...D('snow_pine', [[1, 0, 0], [3, 1, 1], [13, 1, 0], [15, 2, 1], [0, 2, 1], [14, 3, 0], [5, 0, 1], [11, 1, 1]]),
      ...D('bush', [[6, 11], [10, 10, 1], [5, 15, 1], [13, 15]]),
      ...D('flowers', [[1, 14, 0], [3, 15, 2], [12, 15, 1], [6, 12, 1]]),
    ], {
      SHRINE: R(6, 1, 9, 2),
      BRIDGE: [[7, 5], [8, 5], [9, 5]],
      EXIT_SOUTH: [[5, 15], [6, 15], [7, 15]],
    }, {
      cairn: [5, 12], party_start: [7, 14], iselle: [8, 5], seed_a: [10, 7], seed_b: [11, 8],
      kilwala1: [3, 8], kilwala2: [13, 10], kilwala3: [5, 5], shrine: [7, 1],
    });
  }

  // ==============================================================================
  // CHAPTER 2 — Ioka Village, 65,000,000 B.C. (14×14)
  // ==============================================================================
  {
    const g = grid(14, 14, 'g', 0);
    g.rect(0, 0, 13, 1, 'g', 2).rect(0, 2, 13, 2, 'g', 1); // northern bank
    g.rect(0, 0, 3, 0, 'p', 3).rect(10, 0, 13, 0, 'p', 3).tiles([[0, 1], [13, 1], [12, 0]], 'p', 3);
    g.rect(6, 0, 7, 1, 'd', 2).rect(6, 2, 7, 2, 'd', 1); // trail to the crater
    g.rect(0, 3, 2, 8, 'g', 1).tiles([[0, 9], [0, 10], [1, 9]], 'g', 1); // west rise
    g.rect(11, 3, 13, 6, 'g', 1); // trader's rise (east)
    g.rect(4, 4, 10, 10, 'd', 0); // dancing ground
    g.tiles([[3, 6], [3, 7], [11, 7], [11, 8], [7, 3], [6, 3], [7, 11], [7, 12], [7, 13], [6, 11]], 'd', 0);
    g.tiles([[4, 4], [10, 4], [4, 10], [10, 10]], 'g', 0);
    g.rect(10, 11, 12, 12, 'w', 0).tiles([[9, 11], [9, 12], [10, 13], [11, 13], [12, 13], [13, 11], [13, 12], [11, 10], [12, 10]], 'f', 0);
    def('ioka', 'Ioka Village', 'prehistoric', 'mus_ioka', g, [
      ...D('bonfire', [[7, 7]]),
      ...D('hut', [[2, 4, 1], [12, 4, 0], [2, 11, 0], [10, 2, 1], [4, 2, 0]]),
      ...D('bone_pillar', [[5, 1, 0], [8, 1, 1]]),
      ...D('fossil', [[12, 2, 0], [1, 2, 1], [5, 12, 1]]),
      ...D('tree', [[0, 12, 1], [13, 9, 0], [1, 13, 2], [0, 5, 0], [13, 3, 2], [3, 0, 1], [11, 0, 0]]),
      ...D('fern', [[1, 8, 0], [3, 9, 1], [5, 13, 0], [9, 13, 1], [12, 8, 0], [13, 7, 1], [11, 1, 0], [2, 1, 1], [0, 11, 0], [4, 12, 1], [12, 9, 1], [8, 13, 0], [3, 3, 0], [9, 3, 1]]),
      ...D('bush', [[13, 13, 0], [0, 7, 1], [9, 0, 0]]),
      ...D('rock', [[13, 10], [2, 13], [4, 0]]),
      ...D('table', [[11, 5, 1]]),
      ...D('save_point', [[4, 6]]),
    ], {
      EXIT_NORTH: [[6, 0], [7, 0]],
    }, {
      bonfire: [7, 7], bonfire_side: [7, 8], kino: [8, 5], crono: [7, 12],
      vill1: [5, 7], vill2: [9, 7], vill3: [6, 9], shop: [11, 6], save: [4, 6],
    });
  }

  // ==============================================================================
  // CHAPTER 2 — Tyrano Crater (16×16): bowl with rim h3, rings 2 and 1, a lava
  // ring around the bone pillar (8,8). One ash causeway (8,9) reaches the pillar.
  // ==============================================================================
  {
    const g = grid(16, 16, 'a', 0);
    const cx = 8;
    const cy = 8;
    const heightAt = (x, y) => {
      const d = Math.hypot(x - cx, y - cy) + (((x * 13 + y * 7) % 5) - 2) * 0.12;
      if (d > 9.7) return 1;
      if (d > 8.9) return 2;
      if (d > 6.6) return 3;
      if (d > 5.6) return 2;
      if (d > 2.95) return 1;
      return 0;
    };
    g.each((x, y) => g.set(x, y, heightAt(x, y) >= 2 ? 'A' : 'a', heightAt(x, y)));
    // Lava ring (Chebyshev distance 1) except the causeway at (8,9).
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (x !== cx || y !== cy) g.set(x, y, 'l', 0);
    g.set(8, 9, 'a', 0);
    // The south lip (where Ayla fights) is a raised ledge.
    g.rect(6, 10, 10, 10, null, 1);
    // Lava pools & a flow down the west slope.
    g.tiles([[3, 11], [2, 11], [12, 4], [13, 4], [11, 12]], 'l', 1);
    g.tiles([[13, 3]], 'l', 2);
    // Contract heights.
    for (const [x, y, z] of [[8, 10, 1], [6, 13, 1], [10, 13, 1], [4, 8, 1], [12, 8, 1], [8, 4, 1], [8, 8, 0]]) g.set(x, y, 'a', z);
    g.set(2, 2, 'A', 3);
    const rim = tileList((x, y) => g.z(x, y) === 3 && g.t(x, y) !== 'l', 16, 16);
    const ring0 = tileList((x, y) => g.z(x, y) === 0 && g.t(x, y) === 'a' && !(x === 8 && y === 8), 16, 16);
    def('tyrano_crater', 'Tyrano Crater', 'volcanic', 'mus_tyrano', g, [
      ...D('bone_pillar', [[7, 7, 0], [9, 7, 1], [7, 9, 1], [9, 9, 0], [1, 5, 0], [14, 10, 1], [5, 14, 0]]),
      ...D('reptite_ruin', [[0, 3, 0], [3, 0, 1], [15, 6, 0], [12, 1, 1], [0, 12, 1], [13, 14, 0], [15, 14, 1]]),
      ...D('fossil', [[5, 3, 1], [11, 11, 0], [3, 9, 0], [12, 6, 1]]),
      ...D('rock', [[1, 8], [14, 3], [9, 14], [6, 1], [2, 14], [15, 9]]),
    ], {
      PILLAR: [[8, 8]],
      RIM: rim,
      RING0: ring0,
    }, {
      ayla: [8, 10], crono: [6, 13], frog: [10, 13], iselle: [2, 2],
      feeder1: [4, 8], feeder2: [12, 8], feeder3: [8, 4], roll1: [11, 10], roll2: [5, 5], kino: [8, 15],
    });
  }

  // ==============================================================================
  // CHAPTER 3 — The Last Village, 12,000 B.C. (14×14). Magus stands on the
  // eastern promontory above the sea where Zeal fell.
  // ==============================================================================
  {
    const g = grid(14, 14, 'n', 2);
    g.rect(0, 0, 13, 0, 'p', 4).rect(0, 1, 13, 1, 'n', 3); // northern ridge
    g.rect(0, 0, 3, 1, 'p', 4).tiles([[1, 1], [2, 1]], 'n', 4);
    g.rect(5, 0, 6, 1, 'z', 3);
    g.tiles([[5, 2], [6, 2], [5, 3], [6, 3], [6, 4], [6, 5], [7, 5], [7, 6], [7, 7], [7, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [4, 5], [3, 4], [8, 6], [9, 6], [10, 6]], 'z', null);
    g.rect(9, 3, 11, 9, 'n', 3); // promontory
    g.rect(12, 0, 13, 13, 'W', 0); // the sea
    g.rect(10, 11, 13, 13, 'W', 0).rect(11, 10, 11, 10, 'W', 0);
    g.tiles([[12, 2], [12, 7], [13, 5]], 'p', 1); // sea stacks
    g.tiles([[10, 10], [9, 10], [9, 11]], 'p', 1);
    g.tiles([[11, 1], [11, 2], [10, 1]], 'p', 3);
    g.rect(1, 10, 3, 12, 'i', 2); // frozen pond
    g.rect(0, 13, 5, 13, 'n', 1).rect(7, 13, 9, 13, 'n', 1).set(6, 13, 'z', 1);
    def('last_village', 'The Last Village', 'snow', 'mus_last_village', g, [
      ...D('bonfire', [[5, 6]]),
      ...D('snow_hut', [[2, 3, 1], [8, 2, 0], [2, 7, 0], [8, 11, 1]]),
      ...D('cave', [[2, 0]]),
      ...D('snow_pine', [[0, 2, 0], [0, 5, 1], [0, 9, 0], [0, 12, 1], [3, 13, 0], [9, 0, 1], [7, 0, 0], [4, 1, 1], [10, 12, 0], [8, 13, 1], [4, 10, 1], [0, 7, 1]]),
      ...D('rock', [[11, 3], [10, 9], [12, 1]]),
      ...D('crate', [[9, 2, 0], [4, 8, 1]]),
      ...D('barrel', [[3, 5]]),
      ...D('save_point', [[4, 9]]),
    ], {
      EXIT_NORTH: [[5, 0], [6, 0]],
    }, {
      magus: [11, 6], elder: [4, 3], crono: [6, 12], vill1: [4, 6], vill2: [6, 7], vill3: [3, 8],
      shop: [7, 3], save: [4, 9],
    });
  }

  // ==============================================================================
  // CHAPTER 3 — Zeal wreckage, the great hall (16×16). Tilted floor 2→0 toward the
  // sea; column tops h3; flooded side aisles; the Schala vitrine at the north end.
  // ==============================================================================
  {
    const g = grid(16, 16, 'm', 1);
    g.rect(0, 0, 15, 0, 'm', 4); // broken back wall
    g.tiles([[3, 0], [12, 0], [13, 0]], 'm', 3);
    g.rect(2, 1, 13, 4, 'm', 2); // dais
    g.rect(2, 5, 13, 9, 'm', 1);
    g.rect(2, 10, 13, 13, 'm', 0);
    // Rocks the hall ran aground on.
    g.rect(0, 1, 1, 8, 'p', 3).rect(14, 1, 15, 8, 'p', 3);
    g.tiles([[0, 4], [15, 5], [1, 7]], 'p', 2).tiles([[1, 2], [14, 3]], 'm', 4);
    // Sand and the intruding sea.
    g.rect(0, 9, 1, 13, 'W', 0).rect(14, 9, 15, 13, 'W', 0);
    g.tiles([[2, 10], [2, 11], [13, 10], [13, 11], [2, 12], [13, 12], [2, 13], [13, 13], [3, 13], [12, 13]], 'q', 0);
    g.tiles([[0, 9], [15, 9]], 'q', 1);
    g.rect(0, 14, 15, 15, 'W', 0).rect(7, 13, 9, 13, 'W', 0);
    g.tiles([[4, 14], [11, 14]], 'p', 1);
    g.tiles([[4, 11], [11, 11], [12, 12]], 'W', 0); // the sea breaking through the floor
    // Column tops (walkable) and the dreamstone crack running from the seed.
    g.tiles([[11, 3], [4, 6], [11, 9]], 'm', 3);
    g.tiles([[7, 1], [9, 1], [8, 2], [7, 3], [8, 3], [10, 3], [8, 4], [5, 2], [7, 5], [8, 6], [9, 7], [8, 8], [7, 9], [6, 10], [9, 10], [3, 5], [12, 7]], 'y');
    def('zeal_wreck', 'Zeal Wreckage', 'zeal', 'mus_zeal_wreck', g, [
      ...D('schala_vitrine', [[8, 1, 0]]),
      ...D('broken_column', [[4, 3, 0], [11, 6, 1], [4, 9, 2], [2, 1, 0], [13, 1, 1], [6, 0, 1], [10, 0, 0]]),
      ...D('dreamstone', [[0, 2, 0], [15, 2, 1], [1, 5, 1], [14, 6, 0], [3, 14, 0], [12, 14, 1]]),
      ...D('rubble', [[6, 5, 0], [10, 9, 0], [3, 7, 0], [12, 4, 0], [5, 11, 1], [11, 12, 0], [9, 5, 0], [6, 8, 0], [3, 11, 0], [12, 10, 1], [5, 3, 0], [11, 2, 0]]),
      ...D('broken_column', [[3, 10, 2], [12, 11, 2], [13, 8, 1], [2, 4, 2]]),
      ...D('dreamstone', [[7, 8, 1], [9, 11, 0]]),
      ...D('rock', [[0, 7], [15, 8], [4, 15], [11, 15]]),
    ], {
      SEED: [[8, 2]],
    }, {
      crono: [6, 12], frog: [8, 12], ayla: [10, 12], magus: [8, 13], iselle: [7, 2], guard: [9, 2], case: [8, 1],
      sentinel1: [6, 7], sentinel2: [10, 7], nu1: [6, 4], nu2: [10, 4], nu_spawn: [8, 3], magus_stop: [8, 11],
    });
  }

  // ==============================================================================
  // End of Time (12×12): stone islands in the void, the lamppost, the era doors.
  // ==============================================================================
  {
    const g = grid(12, 12, 'v', 0);
    // Central island (h1).
    g.rect(4, 5, 8, 7, 'o', 1).rect(5, 4, 7, 8, 'o', 1);
    // South landing & pier.
    g.rect(5, 9, 7, 10, 'o', 0).set(6, 11, 'o', 0);
    // West landing with the three era doors.
    g.rect(1, 3, 2, 7, 'o', 0).tiles([[3, 5], [3, 6]], 'o', 0).tiles([[0, 3], [0, 5], [0, 7]], 'o', 0);
    // Spekkio's door (north).
    g.rect(6, 1, 6, 3, 'o', 0).rect(5, 0, 7, 0, 'o', 0).set(5, 1, 'o', 0);
    // The grey door's islet (north-east), reached by a thin causeway.
    g.rect(9, 1, 11, 2, 'o', 0).set(10, 0, 'o', 0).tiles([[9, 3], [9, 4], [8, 4]], 'o', 0);
    // Nu's shop ledge (east).
    g.rect(9, 6, 10, 7, 'o', 1);
    def('end_of_time', 'End of Time', 'void', 'mus_end_of_time', g, [
      ...D('lamppost', [[6, 6]]),
      ...D('door_600', [[0, 3]]),
      ...D('door_65m', [[0, 5]]),
      ...D('door_12k', [[0, 7]]),
      ...D('door_grey', [[10, 0]]),
      ...D('door_spekkio', [[6, 0]]),
      ...D('nu_stall', [[10, 6]]),
      ...D('save_point', [[4, 7]]),
      ...D('rubble', [[1, 4, 1], [8, 8, 1]]),
      ...D('float_rock', [[3, 9, 0], [10, 9, 1], [2, 1, 2], [9, 10, 2], [1, 10, 1], [11, 4, 0], [3, 2, 1], [4, 11, 2]]),
    ], {
      DOOR_600: [[1, 3]], DOOR_65M: [[1, 5]], DOOR_12K: [[1, 7]], DOOR_GREY: [[10, 1]], DOOR_SPEKKIO: [[6, 1]],
    }, {
      arrive: [6, 10], lamppost: [7, 6], gaspar: [6, 7], nu: [9, 6], save: [4, 7],
      door_600: [1, 3], door_65m: [1, 5], door_12k: [1, 7], door_grey: [10, 1], spekkio: [6, 1],
    });
  }

  // ==============================================================================
  // Spekkio's room (8×8): a small sparring hall floating in the void.
  // ==============================================================================
  {
    const g = grid(8, 8, 'h', 0);
    g.rect(0, 0, 7, 0, 'o', 1).rect(0, 0, 0, 7, 'o', 1).rect(7, 0, 7, 7, 'o', 1).rect(0, 7, 7, 7, 'o', 1);
    g.tiles([[0, 0], [7, 0], [0, 7], [7, 7]], 'o', 2);
    g.rect(3, 1, 4, 2, 'e', 1); // Spekkio's dais
    g.rect(2, 3, 5, 5, 'e', 0); // sparring carpet
    def('spekkio_room', "Spekkio's Room", 'void', 'mus_end_of_time', g, [
      ...D('torch', [[0, 0, 0], [7, 0, 0], [0, 7, 0], [7, 7, 0]]),
      ...D('pillar', [[1, 2, 0], [6, 2, 0]]),
      ...D('barrel', [[1, 6]]),
      ...D('crate', [[6, 6, 1]]),
    ], {}, {
      spekkio: [4, 2], crono: [3, 6], frog: [4, 6], ayla: [2, 5], magus: [5, 5],
    });
  }

  // ==============================================================================
  // CHAPTER 4 — The Hollow: atrium (16×16). White galleries, vitrines of stills.
  // ==============================================================================
  {
    const g = grid(16, 16, 'k', 0);
    g.rect(0, 0, 15, 1, 'k', 1).rect(0, 0, 1, 15, 'k', 1).rect(14, 0, 15, 15, 'k', 1).rect(0, 14, 15, 15, 'k', 1);
    g.rect(0, 0, 15, 0, 'k', 2).rect(0, 0, 0, 15, 'k', 2);
    g.tiles([[8, 0], [0, 8]], 'k', 1);
    g.rect(3, 3, 12, 3, 'O').rect(3, 12, 12, 12, 'O').rect(3, 3, 3, 12, 'O').rect(12, 3, 12, 12, 'O');
    g.rect(8, 4, 8, 11, 'O').rect(4, 8, 11, 8, 'O').tiles([[7, 7], [9, 7], [7, 9], [9, 9]], 'O');
    g.tiles([[7, 1], [8, 1], [9, 1], [1, 7], [1, 8], [1, 9], [14, 7], [14, 8], [14, 9]], 'K');
    g.tiles([[3, 2], [12, 13], [2, 12]], 'K');
    def('hollow_atrium', 'The Hollow — Atrium', 'museum', 'mus_hollow', g, [
      ...D('arch', [[8, 0, 0], [15, 8, 0], [0, 8, 0], [4, 0, 1], [12, 0, 1], [0, 4, 1], [0, 12, 1]]),
      ...D('pillar', [[1, 1, 2], [14, 1, 2], [1, 14, 2], [14, 14, 2], [1, 5, 2], [1, 11, 2], [14, 5, 2], [14, 11, 2], [5, 1, 2], [11, 1, 2], [5, 14, 2], [11, 14, 2]]),
      ...D('vitrine', [[4, 4, 0], [11, 4, 1], [4, 11, 2], [11, 11, 3], [8, 12, 4], [3, 8, 5], [12, 8, 1], [6, 13, 3], [10, 13, 0], [13, 2, 2]]),
    ], {}, {
      party: [8, 8], arch_n: [8, 0], arch_e: [15, 8], arch_w: [0, 8], tyrano: [8, 3],
      sentinel1: [6, 6], sentinel2: [10, 6], sentinel3: [6, 10], sentinel4: [10, 10],
      imp1: [3, 5], imp2: [12, 5], imp3: [3, 12], imp4: [12, 11],
    });
  }

  // ==============================================================================
  // CHAPTER 4 — The Hollow: archive stacks (16×16). Void chasm x=8 (y 2–15),
  // bridged only by the Ledger walkway (8,1) at height 2.
  // ==============================================================================
  {
    const g = grid(16, 16, 'k', 0);
    g.rect(0, 0, 15, 0, 'S', 3).set(8, 0, 'v', 0);
    g.rect(5, 1, 11, 1, 'S', 2);
    g.rect(1, 4, 3, 4, 'S', 2).rect(13, 4, 15, 4, 'S', 2);
    g.rect(5, 7, 7, 7, 'S', 2).rect(9, 7, 11, 7, 'S', 2);
    g.rect(0, 13, 3, 13, 'S', 2).rect(12, 13, 15, 13, 'S', 2);
    g.rect(8, 2, 8, 15, 'v', 0);
    g.rect(0, 10, 7, 10, 'O').rect(9, 10, 15, 10, 'O').rect(4, 2, 4, 15, 'O').rect(12, 2, 12, 15, 'O');
    g.tiles([[6, 11], [10, 11], [2, 2], [13, 2], [7, 15], [9, 15]], 'K');
    def('hollow_archive', 'The Hollow — Archive', 'museum', 'mus_hollow', g, [
      ...D('archive_shelf', [[1, 1, 1], [5, 3, 0], [11, 3, 0], [0, 9, 0], [15, 9, 0], [6, 13, 0], [10, 13, 0], [14, 1, 0]]),
      ...D('ladder', [[4, 1], [12, 1], [4, 4], [12, 4], [4, 7], [12, 7], [4, 13], [11, 13]]),
      ...D('vitrine', [[1, 6, 1], [14, 6, 4]]),
    ], {
      WEST: R(0, 0, 7, 15), EAST: R(9, 0, 15, 15), LEDGER: [[8, 1]], CHASM: R(8, 2, 8, 15),
    }, {
      crono: [3, 8], ayla: [3, 10], frog: [13, 8], magus: [13, 10], iselle: [13, 12], corin_shelf: [2, 1],
      sb_w1: [2, 15], sb_w2: [6, 14], sb_e1: [14, 15], sb_e2: [10, 14],
      hench_w1: [6, 10], hench_w2: [1, 8], hench_e1: [10, 10], hench_e2: [15, 8], nu_w: [2, 5], nu_e: [14, 5],
    });
  }

  // ==============================================================================
  // CHAPTER 4 — The Core Exhibit (16×16): circular platform over the red void,
  // four placard pedestals (h2) at the compass points.
  // ==============================================================================
  {
    const g = grid(16, 16, 'v', 0);
    const c = 7.5;
    const inDisc = (x, y) => (x - c) ** 2 + (y - c) ** 2 <= 7.9 * 7.9;
    g.each((x, y) => inDisc(x, y) && g.set(x, y, 'k', 0));
    // Inlaid rings, and Lavos veins crawling out from the centre along the diagonals.
    g.each((x, y) => {
      if (!inDisc(x, y)) return;
      const d = Math.hypot(x - c, y - c);
      if (d > 5.2 && d < 6.1) g.set(x, y, 'O');
      if (d < 1.3) g.set(x, y, 'O');
      const diag = Math.abs(Math.abs(x - c) - Math.abs(y - c)) < 1.1;
      if (diag && d > 1.3 && d < 5.2) g.set(x, y, 'K');
      if (d > 1.9 && d < 2.9 && (x + y) % 3 === 0) g.set(x, y, 'K');
    });
    const PED = { PED_N: [[7, 1], [8, 1]], PED_E: [[14, 7], [14, 8]], PED_S: [[7, 14], [8, 14]], PED_W: [[1, 7], [1, 8]] };
    for (const t of Object.values(PED)) g.tiles(t, 'k', 2);
    const quad = (x, y) => {
      const dx = x - c;
      const dy = y - c;
      if (!inDisc(x, y) || Math.hypot(dx, dy) < 2.6) return null;
      if (Math.abs(dy) > Math.abs(dx) || (Math.abs(dy) === Math.abs(dx) && dx * dy > 0)) return dy < 0 ? 'Q_N' : 'Q_S';
      return dx > 0 ? 'Q_E' : 'Q_W';
    };
    const Q = { Q_N: [], Q_E: [], Q_S: [], Q_W: [] };
    g.each((x, y) => {
      const q = quad(x, y);
      if (q) Q[q].push([x, y]);
    });
    const ring = tileList((x, y) => inDisc(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inDisc(x + dx, y + dy)), 16, 16);
    def('hollow_core', 'The Core Exhibit', 'core', 'mus_curator', g, [
      ...D('core_vitrine', [[8, 5]]),
      ...D('pedestal_placard', [[8, 1, 0], [14, 8, 1], [7, 14, 2], [1, 7, 3]]),
    ], {
      ...PED, ...Q, RING_OUTER: ring,
    }, {
      curator: [8, 7], case: [8, 5], party: [7, 12], iselle_edge: [2, 13], sprout_e: [12, 8], sprout_w: [3, 7],
    });
  }
})();
