// Set dressing: everything on a map that is there to be looked at, not played on.
//
// CT.LOOKS[mapId] = {
//   walls:  { style, h, theme? }        far walls of a room (painted by js/atmos.js)
//   floor(p, t, mat, c) -> [r,g,b]|null art baked into tile tops (inlays, light, stains)
//   under:  [{ kind, x, y, variant }]   flat decals, drawn on the tile before its decor
//   front:  [{ kind | fx, p:[x,y], own:[tx,ty] }]  props at tile corners and effects,
//                                       drawn after the units of the tiles behind them
//   spans:  [{ a, b, style, h, sag }]   ropes, railings and bunting between two points
//   pit / underside                     painted under the map (chasms, floating slabs)
// }
// Nothing here touches walkability, heights, decor or zones: the rules never see it.
// Positions are world tile coordinates; a tile spans [x-0.5, x+0.5], so x+0.5 is a corner.
(function () {
  const CT = (window.CT = window.CT || {});
  const R = CT.PAL.RAMPS;
  const { paint, r3, r2, dot, memo } = CT.DPX;
  const { Grid, canvas } = CT.PX;
  const { hash, vnoise } = CT.TX;
  const T = CT.TERRAIN;
  const PXD = CT.PXD;
  const hx = memo((h) => CT.PAL.hex(h));
  const mod = (a, n) => ((a % n) + n) % n;
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

  // Glossy floors mirror walls, decor and units (see Renderer.drawReflection).
  for (const [k, v] of Object.entries({ k: 0.3, O: 0.34, K: 0.26, i: 0.28, m: 0.15, y: 0.15 })) if (T[k]) T[k].reflect = v;

  // ---- Props ---------------------------------------------------------------------------
  const reg = (kind, def) => CT.registerDecor(kind, { native: true, ...def });

  // Brass stanchion (velvet ropes) / iron fence post / fair pole.
  reg('rope_post', {
    yOff: 0,
    build() {
      const g = new Grid(5, 13);
      g.rect(2, 2, 2, 11, 'p');
      g.rect(1, 11, 3, 12, 'b');
      g.rect(0, 12, 4, 12, 'b');
      g.rect(1, 0, 3, 2, 'g');
      return paint(g, { p: [R.gold[0], R.gold[2]], b: r3('gold', 1), g: [R.gold[1], R.gold[3], R.gold[4]] });
    },
  });
  reg('rail_post', {
    yOff: 0,
    build() {
      const g = new Grid(3, 15);
      g.rect(1, 2, 1, 14, 'p');
      g.rect(0, 13, 2, 14, 'b');
      g.rect(0, 1, 2, 2, 'g');
      g.px(1, 0, 'g');
      return paint(g, { p: [R.slate[0], R.slate[2]], b: [R.slate[0], R.slate[1], R.slate[2]], g: [R.slate[1], R.slate[2], R.slate[4]] }, { ol: R.ink[0] });
    },
  });
  reg('fair_pole', {
    yOff: 0, variants: 2,
    build(v) {
      const g = new Grid(5, 42);
      g.rect(2, 3, 2, 41, 'p');
      g.rect(1, 39, 3, 41, 'p');
      g.rect(1, 0, 3, 2, 'g');
      for (let y = 8; y < 38; y += 8) g.rect(2, y, 2, y + 3, 's'); // candy stripes
      return paint(g, { p: [R.wood[2], R.wood[4]], s: v ? R.blue[4] : R.red[3], g: r3('gold', 2) });
    },
  });

  // A bunch of fair balloons on strings, bobbing.
  const balloonFrames = memo((v, f) =>
    canvas(23, 34, (g) => {
      const sway = [0, 1, 0, -1][f];
      const cols = [['red', 3], ['gold', 3], ['blue', 4], ['green', 4], ['pink', 2]];
      const set = [[0, 1, 2], [3, 4, 1], [2, 0, 4]][v % 3];
      const pos = [[6, 8], [16, 6], [11, 13]];
      // strings first
      for (let i = 0; i < 3; i++) {
        const [bx, by] = pos[i];
        PXD.line(g, bx + sway, by + 5, 11, 33, 1);
      }
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = R.slate[3];
      g.fillRect(0, 0, 23, 34);
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        const [bx0, by] = pos[i];
        const bx = bx0 + sway * (i === 2 ? 1 : i ? 1 : 0);
        const [rn, ri] = cols[set[i]];
        g.fillStyle = R.ink[1];
        PXD.ellipse(g, bx, by, 5, 6);
        g.fillStyle = R[rn][ri - 1];
        PXD.ellipse(g, bx, by, 4, 5);
        g.fillStyle = R[rn][ri];
        PXD.ellipse(g, bx - 1, by - 1, 3, 4);
        g.fillStyle = R[rn][Math.min(R[rn].length - 1, ri + 1)];
        g.fillRect(bx - 3, by - 3, 2, 2);
        dot(g, bx - 2, by - 4, R.white[0]);
        dot(g, bx, by + 6, R[rn][ri - 1]);
      }
    })
  );
  reg('balloons', {
    yOff: 0, variants: 3, noReflect: true,
    build: (v) => balloonFrames(v, 0),
    animate: (img, now, d) => balloonFrames((d.variant || 0) % 3, Math.floor(now / 380 + (d.p ? d.p[0] * 3 : 0)) % 4),
  });

  // Flat decals (drawn centred on the tile top).
  const flat = (w, h, fn) => canvas(w, h, fn);
  reg('plaque', {
    flat: true, variants: 3,
    build(v) {
      // a brass plate let into the floor, two lines of engraving
      return flat(12, 6, (g) => {
        g.fillStyle = R.gold[0];
        PXD.diamond(g, 6, 3, 5, true);
        g.fillStyle = R.gold[3];
        PXD.diamond(g, 6, 2, 4, true);
        g.fillStyle = R.gold[4];
        g.fillRect(4, 1, 2, 1);
        g.fillStyle = R.gold[0];
        g.fillRect(4, 2, 3 + (v & 1), 1);
        g.fillRect(5, 3, 2 + (v >> 1), 1);
      });
    },
  });
  reg('drain', {
    flat: true,
    build: () =>
      flat(10, 5, (g) => {
        g.fillStyle = R.slate[2];
        PXD.diamond(g, 5, 2, 4, true);
        g.fillStyle = R.ink[2];
        for (let x = 2; x < 9; x += 2) g.fillRect(x, 2, 1, 1);
        g.fillRect(4, 1, 2, 1); g.fillRect(4, 3, 2, 1);
      }),
  });
  reg('puddle', {
    flat: true, variants: 2,
    build(v) {
      return flat(22, 10, (g) => {
        g.fillStyle = R.blue[4];
        PXD.ellipse(g, 11, 5, 8 - v * 2, 3);
        PXD.ellipse(g, 15 - v * 3, 4, 4, 2);
        g.fillStyle = R.blue[5];
        PXD.ellipse(g, 10, 5, 6 - v * 2, 2);
        PXD.ellipse(g, 15 - v * 3, 4, 2, 1);
        g.fillStyle = R.white[0];
        g.fillRect(7, 4, 3, 1);
        g.fillRect(14 - v * 3, 3, 2, 1);
      });
    },
  });
  reg('bones', {
    flat: true, variants: 3,
    build(v) {
      return flat(16, 9, (g) => {
        const B = R.skin[5], S = R.skin[3], K = R.ink[2];
        const bone = (x, y, len, d) => {
          for (let i = 0; i < len; i++) { dot(g, x + i, y + Math.round(i * d) + 1, K); dot(g, x + i, y + Math.round(i * d), i === 0 || i === len - 1 ? B : i & 1 ? B : S); }
          dot(g, x - 1, y - 1, B); dot(g, x + len, y + Math.round(len * d) - 1 + (d ? 1 : 0), B);
        };
        if (v === 0) { bone(3, 2, 8, 0.25); bone(6, 5, 6, -0.25); }
        else if (v === 1) {
          // a small skull
          g.fillStyle = K; g.fillRect(5, 1, 7, 7);
          g.fillStyle = B; g.fillRect(6, 1, 5, 4); g.fillRect(5, 2, 7, 3); g.fillRect(7, 5, 3, 2);
          g.fillStyle = S; g.fillRect(10, 3, 2, 2); g.fillRect(9, 6, 1, 1);
          g.fillStyle = K; g.fillRect(6, 3, 2, 2); g.fillRect(9, 3, 1, 2); g.fillRect(8, 6, 1, 1);
        } else { bone(2, 3, 5, 0); bone(8, 2, 5, 0.5); bone(5, 6, 7, 0); }
      });
    },
  });
  reg('footprints', {
    flat: true, variants: 2,
    build(v) {
      return flat(20, 10, (g) => {
        g.fillStyle = v ? R.slate[3] : R.wood[2];
        for (let i = 0; i < 4; i++) { const x = 2 + i * 4 + (v ? 0 : 1), y = (i & 1 ? 5 : 2) + (i >> 1); g.fillRect(x, y, 2, 1); g.fillRect(x + 1, y + 1, 2, 1); }
      });
    },
  });
  // Small standing props for tile corners.
  reg('bucket', {
    yOff: 0, shadow: [4, 1],
    build() {
      const g = new Grid(8, 9);
      g.rect(1, 3, 6, 8, 'w');
      g.rect(0, 2, 7, 3, 'r');
      g.rect(2, 5, 5, 5, 'r');
      g.line(1, 2, 3, 0, 'h'); g.line(4, 0, 6, 2, 'h');
      return paint(g, { w: r3('wood', 3), r: [R.slate[1], R.slate[2]], h: R.slate[2] });
    },
  });
  reg('drum', {
    yOff: 0, shadow: [5, 2], variants: 2,
    build(v) {
      const g = new Grid(10, 10 + v * 2);
      const b = 9 + v * 2;
      g.rect(1, 2, 8, b, 'w');
      g.ell(4.5, 2, 4.5, 1.6, 's');
      for (let x = 1; x < 9; x += 2) g.line(x, 3, x + 1, b - 1, 'c');
      g.rect(1, b, 8, b, 'd');
      return paint(g, { w: r3('wood', 3), s: [R.skin[3], R.skin[4], R.skin[5]], c: R.red[2], d: R.wood[1] });
    },
  });
  reg('hide_rack', {
    yOff: 0, shadow: [8, 2],
    build() {
      const g = new Grid(19, 17);
      g.rect(1, 2, 1, 16, 'p'); g.rect(17, 2, 17, 16, 'p');
      g.rect(0, 2, 18, 2, 'p');
      g.rect(3, 3, 8, 11, 'h'); g.rect(4, 12, 7, 12, 'h'); g.px(2, 4, 'h'); g.px(9, 4, 'h');
      g.rect(11, 3, 15, 9, 'f'); g.rect(12, 10, 14, 10, 'f');
      g.px(5, 6, 's'); g.px(6, 8, 's'); g.px(13, 5, 's');
      return paint(g, { p: r3('wood', 2), h: r3('skin', 2), f: r3('stone', 3), s: R.wood[1] });
    },
  });
  reg('fish_rack', {
    yOff: 0, shadow: [7, 2],
    build() {
      const g = new Grid(17, 14);
      g.rect(1, 1, 1, 13, 'p'); g.rect(15, 1, 15, 13, 'p');
      g.rect(0, 2, 16, 2, 'p');
      for (const x of [3, 6, 9, 12]) { g.rect(x, 3, x + 1, 7, 'f'); g.px(x, 8, 'f'); g.px(x + 1, 3, 'e'); }
      return paint(g, { p: r3('wood', 2), f: [R.slate[2], R.slate[4], R.slate[5]], e: R.ink[1] });
    },
  });
  reg('snow_drift', {
    flat: true, variants: 2,
    build(v) {
      return flat(24, 9, (g) => {
        g.fillStyle = R.slate[4];
        PXD.ellipse(g, 12, 5, 10 - v * 3, 3);
        g.fillStyle = R.white[0];
        PXD.ellipse(g, 11, 4, 8 - v * 3, 2);
        g.fillStyle = R.slate[5];
        g.fillRect(8, 6, 7, 1);
      });
    },
  });
  // A candle sconce standing by the wall (castle).
  const candleFrames = memo((f) =>
    canvas(9, 26, (g) => {
      const gr = new Grid(7, 22);
      gr.rect(3, 6, 3, 20, 'p'); gr.rect(1, 20, 5, 21, 'b'); gr.rect(1, 5, 5, 6, 'b');
      for (const x of [1, 3, 5]) gr.rect(x, 2, x, 4, 'c');
      g.drawImage(paint(gr, { p: [R.gold[0], R.gold[2]], b: r3('gold', 1), c: [R.skin[4], R.skin[5]] }), 0, 3);
      for (const [x, k] of [[2, 0], [4, 1], [6, 2]]) {
        dot(g, x, 4, R.gold[2]);
        dot(g, x, 3, (f + k) % 3 ? R.gold[4] : R.gold[3]);
        if ((f + k) % 3 === 0) dot(g, x, 2, R.gold[3]);
      }
    })
  );
  reg('candles', {
    yOff: 0, shadow: [3, 1],
    light: { color: '255,200,120', radius: 26, flicker: true, dy: 4 },
    build: () => candleFrames(0),
    animate: (img, now) => candleFrames(Math.floor(now / 130) % 3),
  });
  // The orrery's brass centrepiece is drawn into the floor; this is its glint.
  reg('floor_glint', {
    flat: true,
    build: () => canvas(5, 5, (g) => { dot(g, 2, 2, R.white[0]); }),
    animate: (img, now) => (Math.floor(now / 300) % 5 === 0 ? glintOn : img),
  });
  const glintOn = canvas(5, 5, (g) => {
    g.fillStyle = R.white[0];
    g.fillRect(2, 0, 1, 5);
    g.fillRect(0, 2, 5, 1);
  });

  // The Hollow's vitrines, redrawn so each exhibit can be recognised at a glance: the
  // fair tent, the Masamune, an Ioka hut, the pendant, the Epoch, Leene's bell. Same
  // footprint and rules as before (variants 0-5), deep-blue velvet behind the glass.
  const EXHIBITS = [
    ['.....y.....', '.....k.....', '....rwr....', '...rwrwr...', '..rwrwrwr..', '.rwrwrwrwr.', 'rwrwrwrwrwr', 'kkkkkkkkkkk', '.rwrkkkrwr.', '.rwrkkkrwr.', '.rwrkkkrwr.', '.rwrkkkrwr.', 'ggggggggggg'],
    ['.....w.....', '....wSw....', '....wSs....', '....wSs....', '....wSs....', '....wSs....', '....wSs....', '....wSs....', '..GGGGGGG..', '..G.pPp.G..', '....pPp....', '....GYG....', '...ddddd...'],
    ['.....b.....', '....tTt....', '...tTtTt...', '..tTtTtTt..', '.tTtTtTtTt.', 'tTtTtTtTtTt', '.bkkkkkkkb.', '.tTtkkktTt.', '.tTtkkktTt.', '.tTtkkktTt.', '.tTtkkktTt.', 'ggggggggggg', '...........'],
    ['..c.....c..', '.c.......c.', '.c.......c.', '..c.....c..', '...c...c...', '....c.c....', '....GGG....', '...GeEeG...', '..GeEwEeG..', '..GeEEEeG..', '...GeEeG...', '....GGG....', '...........'],
    ['...........', '........r..', '.......rr..', '......rrR..', '..wwwwSSSu.', '.wSSSSSuUuw', 'wSSSSSSSSSS', '.sSSSSSSSs.', '..sssrRss..', '....rrR....', '...rr......', '...........', '..ddddddd..'],
    ['....ddd....', '...d...d...', '....YYY....', '...YGGGY...', '..YGGGGGY..', '..YGwGGGY..', '..YGwGGGY..', '.YGGwGGGGY.', '.YGGGGGGGY.', 'YYYYYYYYYYY', '....kYk....', '.....Y.....', '...........'],
  ];
  const EXMAP = {
    y: R.gold[3], k: R.ink[0], r: R.red[3], R: R.red[2], w: R.white[0], g: R.green[3], S: R.slate[5], s: R.slate[3], G: R.gold[2], Y: R.gold[1],
    p: R.purple[1], P: R.purple[3], d: R.wood[3], b: R.skin[5], t: R.wood[3], T: R.wood[5], c: R.gold[2], e: R.teal[1], E: R.teal[3], u: R.blue[3], U: R.blue[5],
  };
  if (CT.DECOR.vitrine) {
    const old = CT.DECOR.vitrine;
    CT.registerDecor('vitrine', {
      ...old,
      build(v) {
        const g = new Grid(19, 30);
        CT.DPX.isoBox(g, 9, 19, 9, 6, 'a', 'b', 'c');
        g.rect(1, 2, 17, 23, 'i');
        g.rect(0, 0, 18, 2, 'f');
        g.rect(0, 2, 0, 23, 'f');
        g.rect(18, 2, 18, 23, 'f');
        g.rect(3, 20, 15, 21, 'q'); // the cushion the exhibit rests on
        g.rect(2, 22, 16, 22, 'm');
        const cv = paint(g, {
          a: [R.slate[4], R.slate[5], R.white[0]], b: r3('slate', 4), c: r2('slate', 3), f: [R.slate[3], R.slate[5], R.white[0]],
          i: [R.ink[1], R.blue[0], R.blue[1]], q: [R.red[1], R.red[2]], m: R.gold[1],
        });
        const ctx = cv.getContext('2d');
        // the exhibit, with one px of dark around it so it stands off the velvet
        const rows = EXHIBITS[v % EXHIBITS.length];
        const ox = 5, oy = 8;
        rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(ctx, ox + i + dx, oy + j + dy, R.ink[0]); }));
        rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && dot(ctx, ox + i, oy + j, EXMAP[ch])));
        // lamp strip under the lid, glass glints
        for (let x = 3; x < 17; x++) dot(ctx, x, 4, x % 4 === 3 ? R.gold[4] : R.blue[2]);
        for (let k = 0; k < 7; k++) dot(ctx, 3 + (k >> 1), 6 + k, k % 3 === 2 ? R.blue[5] : R.white[0]);
        for (let k = 0; k < 4; k++) dot(ctx, 15 + (k >> 1), 15 + k, R.blue[5]);
        for (let y = 4; y < 23; y++) dot(ctx, 2, y, R.blue[3]);
        return cv;
      },
    });
  }

  // ---- Spans: ropes, railings, bunting -----------------------------------------------
  // Drawn from point a to point b at `h` px above the ground with `sag` px of droop.
  const PENNANTS = [R.red[3], R.gold[3], R.blue[4], R.green[4], R.white[0], R.pink[2]];
  function drawSpan(g, st, x0, y0, x1, y1, gy0, gy1, sag, ph, seed) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    const at = (i) => {
      const t = i / n;
      return [Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)), Math.round(gy0 + (gy1 - gy0) * t)];
    };
    let lx = null;
    for (let i = 0; i <= n; i++) {
      const [x, y, gy] = at(i);
      if (x === lx && st !== 'rope') continue;
      lx = x;
      if (st === 'rope') {
        dot(g, x, y, i % 5 === 2 ? R.red[4] : R.red[3]);
        dot(g, x, y + 1, R.red[1]);
      } else if (st === 'rail') {
        dot(g, x, y, R.slate[3]);
        dot(g, x, y + 1, R.slate[0]);
        dot(g, x, y + 6, R.slate[1]);
        if (i % 3 === 1) {
          for (let yy = y + 2; yy < gy; yy++) dot(g, x, yy, yy === y + 6 ? R.slate[2] : R.slate[0]);
          dot(g, x, y - 1, R.slate[2]);
        }
      } else if (st === 'bunting') {
        dot(g, x, y, R.wood[1]);
        const k = Math.floor((i + 2) / 6);
        const c = PENNANTS[mod(k + seed, PENNANTS.length)];
        const j = mod(i + 2, 6);
        if (j < 5 && i > 1 && i < n - 1) {
          const len = [1, 3, 4, 3, 1][j] - ((ph + k) % 2 && j === 2 ? 1 : 0);
          for (let q = 1; q <= len; q++) dot(g, x + (((ph + k) % 2) && q > 2 ? 1 : 0), y + q, q === 1 && j !== 2 ? c : c);
          if (j === 1) dot(g, x, y + 1, R.white[0] === c ? R.slate[4] : c);
        }
      } else if (st === 'lights') {
        dot(g, x, y, R.ink[2]);
        if (i % 7 === 3) {
          const on = (Math.floor(i / 7) + ph + seed) % 3 !== 0;
          const c = [R.gold[4], R.pink[3], R.blue[6], R.green[6]][mod(Math.floor(i / 7) + seed, 4)];
          dot(g, x, y + 1, on ? c : R.slate[2]);
          dot(g, x, y + 2, on ? c : R.slate[1]);
          if (on) { dot(g, x - 1, y + 1, R.gold[1]); dot(g, x + 1, y + 2, R.gold[1]); }
        }
      }
    }
  }
  function spanSprite(r, sp, ph) {
    if (sp._map !== r.map) { sp._map = r.map; sp._s = {}; }
    const key = r.rot * 4 + ph;
    if (sp._s[key]) return sp._s[key];
    const ha = sp.ha != null ? sp.ha : heightAt(r, sp.a), hb = sp.hb != null ? sp.hb : heightAt(r, sp.b);
    const A = r.base(sp.a[0], sp.a[1], ha).map(Math.round), B = r.base(sp.b[0], sp.b[1], hb).map(Math.round);
    const minx = Math.min(A[0], B[0]) - 3, top = Math.min(A[1], B[1]) - sp.h - 3;
    const w = Math.abs(A[0] - B[0]) + 7, h = Math.max(A[1], B[1]) - top + (sp.sag || 0) + 6;
    const cv = canvas(w, h, (g) => drawSpan(g, sp.style, A[0] - minx, A[1] - sp.h - top, B[0] - minx, B[1] - sp.h - top, A[1] - top, B[1] - top, sp.sag || 0, ph, sp.seed || 0));
    return (sp._s[key] = { cv, dx: minx - A[0], dy: top - A[1], ha });
  }
  function heightAt(r, p) {
    const t = r.tileAt(Math.round(p[0] - 0.001), Math.round(p[1] - 0.001));
    return t ? r.tileHeight(t) : 0;
  }

  // ---- Effects ---------------------------------------------------------------------------
  const FX = {
    // Chimney / vent smoke: soft discs rising, lighter as they thin.
    smoke(r, ctx, x, y, it, now) {
      const cols = it.cols || [R.slate[4], R.slate[3], R.slate[2]];
      const n = it.n || 5, rise = it.rise || 26;
      for (let i = 0; i < n; i++) {
        const age = mod(now / (it.ms || 3600) + i / n + it.p[0] * 0.37, 1);
        const px = x + Math.round(age * (it.drift != null ? it.drift : 7) + Math.sin(age * 6 + i * 2 + it.p[1]) * 2);
        const py = y - Math.round(age * rise);
        const rad = age < 0.15 ? 1 : age < 0.5 ? 2 : age < 0.8 ? 3 : 2;
        ctx.fillStyle = cols[age < 0.35 ? 0 : age < 0.7 ? 1 : 2];
        if (age > 0.8) { if ((i + Math.floor(now / 120)) & 1) PXD.disc(ctx, px, py, rad); } else PXD.disc(ctx, px, py, rad);
      }
    },
    // Heat off the lava: short bright threads wavering upward.
    heat(r, ctx, x, y, it, now) {
      for (let i = 0; i < 3; i++) {
        const age = mod(now / 1500 + i / 3 + it.p[0] * 0.61 + it.p[1] * 0.23, 1);
        const px = x + Math.round((hash(i, it.p[0] * 7 + it.p[1], 5) - 0.5) * 20 + Math.sin(age * 7 + i) * 1.5);
        const py = y - 2 - Math.round(age * 16);
        ctx.fillStyle = age < 0.3 ? R.gold[3] : age < 0.6 ? R.gold[1] : R.red[2];
        ctx.fillRect(px, py, 1, age < 0.6 ? 2 : 1);
      }
    },
    // Spray where a waterfall lands.
    mist(r, ctx, x, y, it, now) {
      for (let i = 0; i < 6; i++) {
        const age = mod(now / 900 + i / 6 + it.p[1] * 0.3, 1);
        const a = (i / 6) * Math.PI + 0.3;
        const px = x + Math.round(Math.cos(a) * age * 9), py = y - Math.round(Math.sin(a) * age * 6 * (1 - age) * 3) + 2;
        ctx.fillStyle = age < 0.5 ? R.white[0] : R.blue[6];
        ctx.fillRect(px, py, 1, 1);
      }
    },
    // A slow pulse of red light from the floor (the core seeping through).
    pulse(r, ctx, x, y, it, now, lights) {
      const k = 0.5 + 0.5 * Math.sin(now / 700 + it.p[0]);
      lights.push({ x, y, color: it.color || '255,60,70', radius: Math.round((it.radius || 34) * (0.8 + 0.2 * k)), noGlow: true });
    },
  };

  // ---- Front list & drawing (called by the renderer) ----------------------------------
  const EMPTY = [];
  function frontList(r) {
    const look = r.look;
    if (!look.front && !look.spans) return EMPTY;
    if (look._fm === r.map && look._fr === r.rot) return look._fl;
    const out = [];
    for (const it of look.front || []) {
      const own = it.own || [Math.round(it.p[0] - 0.001), Math.round(it.p[1] - 0.001)];
      const t = r.tileAt(own[0], own[1]);
      it.h = (t ? r.tileHeight(t) : 0) + (it.lift || 0);
      out.push({ z: Math.round(r.depth(it.p[0], it.p[1]) * 2) / 2 + (it.zo || 0), sub: 2, fr: it });
    }
    for (const sp of look.spans || []) {
      const za = r.depth(sp.a[0], sp.a[1]), zb = r.depth(sp.b[0], sp.b[1]);
      out.push({ z: (sp.high ? Math.max(za, zb) : Math.min(za, zb)) + 0.5, sub: 2, fr: sp });
    }
    look._fm = r.map; look._fr = r.rot; look._fl = out;
    return out;
  }
  function drawFront(r, it, now, lights) {
    if (it.theme && !it.theme.includes(r.map.theme)) return;
    const ctx = r.ctx;
    if (it.style) {
      const ph = it.style === 'bunting' || it.style === 'lights' ? Math.floor(now / (it.style === 'lights' ? 420 : 260)) % 2 : 0;
      const s = spanSprite(r, it, ph);
      const [sx, sy] = r.project(it.a[0], it.a[1], s.ha);
      ctx.drawImage(s.cv, Math.round(sx) + s.dx, Math.round(sy) + s.dy);
      if (it.style === 'lights' && lights) {
        const [bx, by] = r.project(it.b[0], it.b[1], s.ha);
        lights.push({ x: (sx + bx) / 2, y: (sy + by) / 2 - it.h + (it.sag || 0), color: '255,210,140', radius: 16, noGlow: true });
      }
      return;
    }
    const [sx0, sy0] = r.project(it.p[0], it.p[1], it.h);
    const sx = Math.round(sx0) + (it.dx || 0), sy = Math.round(sy0) + (it.dy || 0);
    if (it.fx) return FX[it.fx](r, ctx, sx, sy, it, now, lights);
    r.drawDecor(it, sx, sy, now, lights);
  }

  // ---- Under-map painting: chasms and the broken undersides of floating floors ---------
  const underCache = new Map();
  function drawUnder(r, ctx) {
    const look = r.look, m = r.map;
    if (!look.pit && !look.underside) return;
    if (look.underTheme && !look.underTheme.includes(m.theme)) return;
    const key = m.id + ':' + r.rot;
    let e = underCache.get(key);
    if (!e || e.map !== m) {
      // base-space bounding box of the map
      const ext = (m.w + m.h) * 16 + 40;
      const ox = ext / 2, oy = 120;
      const cv = canvas(ext, (m.w + m.h) * 8 + 220, (g) => {
        const isVoid = (x, y) => { const t = r.tileAt(x, y); return !t || CT.TERRAIN[t.t].void; };
        for (const t of r.tileOrder()) {
          const v = CT.TERRAIN[t.t].void;
          const [bx0, by0] = r.base(t.x, t.y, v ? 0 : r.tileHeight(t));
          const bx = Math.round(bx0) + ox, by = Math.round(by0) + oy;
          if (v && look.pit) {
            // a chasm: only where solid floor stands somewhere behind it
            const [ax, ay] = r.vecToWorld(-1, 0), [cx, cy] = r.vecToWorld(0, -1);
            const wallL = !isVoid(t.x + ax, t.y + ay), wallR = !isVoid(t.x + cx, t.y + cy);
            let inside = false;
            for (let k = 1; k < 20 && !inside; k++) inside = !isVoid(t.x + ax * k, t.y + ay * k) || !isVoid(t.x + cx * k, t.y + cy * k);
            if (!inside) continue;
            for (let y = 0; y < 16; y++) {
              const hw = y < 8 ? 2 * (y + 1) : 2 * (16 - y);
              for (let x = -hw; x < hw; x++) {
                // px below the back edge above this column = how far down the chasm wall we are
                const d = x < 0 ? (wallL ? y - (7 - ((x + 16) >> 1)) : 99) : wallR ? y - (x >> 1) : 99;
                let c = R.ink[0];
                if (d < 4) c = look.pit[0];
                else if (d < 9) c = bayer(bx + x, by + y) < (9 - d) / 6 ? look.pit[0] : look.pit[1];
                else if (d < 18) c = bayer(bx + x, by + y) < (18 - d) / 12 ? look.pit[1] : R.ink[0];
                if (look.pit[2] && hash(bx + x >> 1, by + y, 77) > 0.985 && d > 6) c = look.pit[2];
                dot(g, bx + x, by + 5 + y - 8, c);
              }
            }
          } else if (!v && look.underside) {
            const [fx, fy] = r.vecToWorld(1, 0), [gx, gy] = r.vecToWorld(0, 1);
            const openR = isVoid(t.x + fx, t.y + fy), openL = isVoid(t.x + gx, t.y + gy);
            if (!openR && !openL) continue;
            const U = look.underside;
            const dep = Math.round((r.tileHeight(t) + 0.6) * 8);
            for (let i = 0; i < 32; i++) {
              const left = i < 16;
              if (left ? !openL : !openR) continue;
              const x = bx - 16 + i, y0 = by + (left ? i >> 1 : (31 - i) >> 1) + 1 + dep;
              const n = vnoise((t.x * 16 + (left ? i : 40 + i) + t.y * 7) * 0.16, 1, 91);
              const len = Math.round(U.len * (0.25 + n * n * 1.5));
              for (let k = 0; k < len; k++) {
                let c = k < 2 ? U.cols[0] : k > len - 3 ? U.cols[2] : U.cols[1];
                if (left && k >= 2) c = U.cols[2];
                if (U.vein && hash(x >> 1, k >> 1, 93) > 0.9) c = U.vein;
                dot(g, x, y0 + k, c);
              }
            }
          }
        }
      });
      e = { cv, ox, oy, map: m };
      if (underCache.size > 12) underCache.clear();
      underCache.set(key, e);
    }
    ctx.drawImage(e.cv, r.ox - e.ox, r.oy - e.oy);
  }

  // ---- Looks -------------------------------------------------------------------------------
  CT.LOOKS = CT.LOOKS || {};
  function look(id, L) {
    if (!CT.MAPS[id]) return;
    L.dressAt = new Map();
    for (const d of L.under || []) {
      const k = `${d.x},${d.y}`;
      if (!L.dressAt.has(k)) L.dressAt.set(k, []);
      L.dressAt.get(k).push({ variant: 0, ...d });
    }
    for (const f of L.front || []) if (f.variant == null) f.variant = 0;
    CT.LOOKS[id] = L;
  }
  const U = (kind, list) => list.map(([x, y, variant = 0]) => ({ kind, x, y, variant }));
  const F = (kind, list, o = {}) => list.map(([x, y, variant = 0]) => ({ kind, p: [x, y], variant, ...o }));
  const FXL = (fx, list, o = {}) => list.map(([x, y]) => ({ fx, p: [x, y], ...o }));
  // A run of posts and spans along a path of corner points.
  function run(style, pts, o = {}) {
    const spans = [];
    for (let i = 0; i + 1 < pts.length; i++) spans.push({ a: pts[i], b: pts[i + 1], style, h: o.h || 9, sag: o.sag != null ? o.sag : 2, high: o.high, seed: (o.seed || 0) + i, theme: o.theme, ha: o.ha, hb: o.ha });
    return spans;
  }
  const C = {
    gold: [R.gold[0], R.gold[1], R.gold[2], R.gold[3], R.gold[4]].map(hx), wood: R.wood.map(hx), red: R.red.map(hx), blue: R.blue.map(hx),
    slate: R.slate.map(hx), teal: R.teal.map(hx), purple: R.purple.map(hx), ink: R.ink.map(hx), stone: R.stone.map(hx), pink: R.pink.map(hx),
    green: R.green.map(hx), skin: R.skin.map(hx), white: hx(R.white[0]),
  };

  // ---- The Hollow: atrium -----------------------------------------------------------------
  // The great orrery let into the floor: brass orbits, one jewel per era, the Hollow's
  // empty ring at the centre.
  const ORBITS = [[13, 0.7, C.red[3], C.red[4]], [21, 2.5, C.teal[2], C.teal[3]], [29, 4.1, C.purple[3], C.purple[4]], [37, 5.6, C.gold[2], C.gold[4]]];
  function orrery(p, t) {
    if ((t.t !== 'k' && t.t !== 'O') || t.h !== 0) return null;
    const dx = p.tx + 0.5 - 128, dy = p.ty + 0.5 - 128;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 50) return null;
    const dark = t.t === 'O';
    const a = Math.atan2(dy, dx);
    // outer bezel with hour ticks
    if (Math.abs(d - 47.5) < 0.8) return C.gold[2];
    if (Math.abs(d - 49.3) < 0.6) return C.gold[0];
    if (d > 42.5 && d < 46.5) {
      const k = mod(a / (Math.PI / 6) + 0.5, 1) - 0.5;
      if (Math.abs(k) * d * (Math.PI / 6) < 0.8) return C.gold[1];
      if (d > 44.5 && Math.abs(mod(a / (Math.PI / 30) + 0.5, 1) - 0.5) * d * (Math.PI / 30) < 0.55) return dark ? C.blue[4] : C.slate[3];
    }
    for (const [rad, ang, c0, c1] of ORBITS) {
      const ex = Math.cos(ang) * rad, ey = Math.sin(ang) * rad;
      const pd = Math.hypot(dx - ex, dy - ey);
      if (pd < 2.6) return dx - ex + dy - ey < -1.2 ? c1 : pd > 1.9 ? C.ink[2] : c0;
      if (pd < 3.5) return C.gold[1];
      if (Math.abs(d - rad) < 0.55) return mod(Math.round(a * rad), 5) < 3 ? (dark ? C.gold[1] : C.wood[4]) : null;
    }
    // the hollow ring
    if (d < 6.5) return d > 4.6 ? C.gold[3] : d > 3.6 ? C.gold[0] : dark ? C.ink[1] : C.blue[1];
    // the hand of the clock that stopped
    const ha = -1.92, hd = dx * Math.cos(ha) + dy * Math.sin(ha), ho = Math.abs(-dx * Math.sin(ha) + dy * Math.cos(ha));
    if (hd > 6 && hd < 41 && ho < (hd > 36 ? 1.6 - (hd - 36) * 0.3 : 0.7)) return C.red[2];
    return null;
  }
  // Rope a vitrine off on its two open sides (corner posts + velvet).
  const roped = (x, y) => {
    const c = [[x - 0.5, y - 0.5], [x + 0.5, y - 0.5], [x + 0.5, y + 0.5], [x - 0.5, y + 0.5]];
    return { posts: c.map(([px, py]) => [px, py]), spans: run('rope', [...c, c[0]], { h: 9, sag: 3 }) };
  };
  {
    const ropes = [[4, 4], [11, 4], [4, 11], [11, 11]].map(([x, y]) => roped(x, y));
    look('hollow_atrium', {
      walls: { style: 'museum', h: 86, theme: ['museum'] },
      floor: orrery,
      under: [
        ...U('plaque', [[4, 5, 0], [11, 5, 1], [4, 10, 2], [11, 10, 0], [8, 13, 1], [4, 8, 2], [11, 8, 0], [7, 13, 1], [9, 13, 2], [13, 3, 0]]),
        ...U('floor_glint', [[8, 8]]),
      ],
      front: [
        ...F('rope_post', ropes.flatMap((q) => q.posts)),
      ],
      spans: ropes.flatMap((q) => q.spans),
    });
  }

  // ---- The Hollow: archive -----------------------------------------------------------------
  look('hollow_archive', {
    walls: { style: 'archive', h: 100, theme: ['museum'] },
    pit: [R.slate[1], R.ink[2], R.red[2]], underTheme: ['museum'],
    floor(p, t) {
      // index lines: thin brass guide rails in the floor, running along the stacks
      if (t.t !== 'k' || t.h !== 0) return null;
      const j = mod(p.ty, 16), i = mod(p.tx, 16);
      if ((t.y === 5 || t.y === 8 || t.y === 12) && j === 8 && t.x !== 4 && t.x !== 12) return i % 4 === 3 ? null : C.gold[1];
      // a few hairline cracks seeping red near the chasm
      if (Math.abs(t.x - 8) === 1) {
        const v = Math.abs(vnoise(p.tx * 0.11, p.ty * 0.05, 311) - 0.5);
        if (v < 0.012) return (t.x < 8 ? 15 - i : i) < 6 ? C.red[2] : C.slate[3];
      }
      return null;
    },
    under: U('plaque', [[1, 7, 0], [14, 7, 1], [6, 4, 2], [10, 4, 0], [2, 9, 1], [13, 9, 2]]),
    front: [
      ...F('rail_post', [[7.5, 1.5], [8.5, 1.5], [7.5, 0.5], [8.5, 0.5]], { own: [8, 1] }),
      ...FXL('pulse', [[8, 6], [8, 11]], { radius: 26, color: '255,40,60' }),
    ],
    spans: [...run('rail', [[7.5, 1.5], [8.5, 1.5]], { h: 10, sag: 0, ha: 2 }), ...run('rail', [[7.5, 0.5], [8.5, 0.5]], { h: 10, sag: 0, ha: 2 })],
  });

  // ---- The Hollow: the east wing (a walk past one exhibit per hero) --------------------------
  look('hollow_gallery', {
    walls: { style: 'museum', h: 86, theme: ['museum'] },
    under: U('plaque', [[2, 11, 0], [8, 11, 1], [2, 8, 2], [8, 8, 0], [2, 5, 1], [8, 5, 2], [2, 2, 0], [8, 2, 1]]),
  });

  // ---- The Hollow: the core ----------------------------------------------------------------
  look('hollow_core', {
    underside: { len: 26, cols: [R.slate[3], R.slate[1], R.ink[2]], vein: R.red[2] }, underTheme: ['core'],
    floor(p, t) {
      if (t.t !== 'k' || t.h !== 0) return null;
      const dx = p.tx + 0.5 - 120, dy = p.ty + 0.5 - 120;
      const d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
      // a broken brass seal round the exhibit
      if (Math.abs(d - 64) < 0.7 || Math.abs(d - 67) < 0.5) return vnoise(a * 4, 2, 321) > 0.36 ? (Math.abs(d - 64) < 0.7 ? C.gold[2] : C.gold[0]) : null;
      if (d > 58 && d < 62 && Math.abs(mod(a / (Math.PI / 12) + 0.5, 1) - 0.5) * d * (Math.PI / 12) < 0.7 && vnoise(a * 4, 2, 321) > 0.4) return C.gold[1];
      // cracks running out from the wound
      const cr = Math.abs(vnoise(a * 5.5 + 3, d * 0.022, 322) - 0.5);
      const w = 0.016 * Math.max(0.25, 1 - d / 120);
      if (cr < w) return d < 60 ? C.red[2] : d < 84 ? C.red[1] : C.slate[3];
      if (cr < w * 2.2 && d < 46 && ((p.px + p.py) & 1)) return C.pink[3];
      return null;
    },
    front: FXL('pulse', [[7.5, 7.5]], { radius: 70 }),
  });

  // ---- Guardia throne room ------------------------------------------------------------------
  // Coloured light thrown across the flags by the lancets in the far (right) wall.
  function stainedLight(p) {
    // The lancets sit high (the wall stands on a 3-level ledge), so the light lands well
    // out on the floor. Each pane throws one flat patch of its own colour.
    const d = p.vy + 0.5;
    if (d < 1.8 || d > 5.2) return null;
    const wy = ((d - 0.6) / 0.62) * 16 - 40;
    const u = (p.vx + 0.5) * 16 - d * 5;
    const wx = mod(Math.floor(u), 48) - 17;
    if (wx < 0 || wx >= 14 || wy < 0 || wy >= 40) return null;
    if (wy > 30 && Math.abs(wx - 6.5) > 6.5 - (wy - 30) * 0.7) return null;
    const pane = Math.floor(wy / 9) + (wx > 6 ? 3 : 0) + Math.floor(u / 48);
    return [R.blue[2], R.red[1], R.gold[0], R.purple[1], R.teal[0]][mod(pane * 3 + 1, 5)];
  }
  look('guardia_throne', {
    walls: { style: 'castle', h: 78, theme: ['castle'] },
    floor(p, t, mat, c) {
      if (t.t !== 'j' || t.h > 1) return null;
      const g = ((p.px + p.py) & 1) && stainedLight(p);
      if (g) return hx(g);
      return null;
    },
    front: [
      ...F('candles', [[4.5, 1.5], [8.5, 1.5]], { own: [5, 1] }),
      ...F('rope_post', [[2.5, 3.5], [4.5, 3.5], [8.5, 3.5], [10.5, 3.5]], { own: [6, 4] }),
    ],
    spans: [
      // a rope keeps petitioners off the dais steps
      ...run('rope', [[2.5, 3.5], [4.5, 3.5]], { h: 9, sag: 3, ha: 0 }), ...run('rope', [[8.5, 3.5], [10.5, 3.5]], { h: 9, sag: 3, ha: 0 }),
    ],
  });

  // ---- Leene Square: the Millennial Fair ------------------------------------------------------
  {
    // strings of pennants from lamp to lamp, lights over the stalls, a gate on the road
    const lamp = (x, y) => [x, y];
    const B = (a, b, seed, style = 'bunting') => ({ a, b, style, h: 26, sag: 5, high: true, seed });
    look('leene_square', {
      floor(p, t) {
        // confetti and streamers trodden into the cobbles
        if (t.t !== 'c') return null;
        const cl = vnoise(p.wx * 0.9, p.wy * 0.9, 401);
        if (cl < 0.55) return null;
        const h = hash(p.tx, p.ty, 402);
        if (h > 0.972) return [C.pink[3], C.gold[3], C.blue[5], C.white, C.green[5], C.red[4]][Math.floor(hash(p.tx, p.ty, 403) * 6)];
        return null;
      },
      under: [...U('drain', [[8, 9], [5, 8]])],
      front: [
        ...F('fair_pole', [[5.5, 12.5, 0], [8.5, 12.5, 1]]),
        ...F('balloons', [[1, 4, 0], [14, 5, 1], [1, 9, 2], [14, 10, 0], [13, 12, 1]], { lift: 3.4, dx: 5 }),
      ],
      spans: [
        B(lamp(3, 3), lamp(8, 1), 0), B(lamp(8, 1), lamp(13, 1), 2), B(lamp(3, 3), lamp(3, 7), 1), B(lamp(3, 7), lamp(5, 11), 3),
        B(lamp(12, 6), lamp(13, 9), 4), B(lamp(9, 11), lamp(13, 9), 5), B(lamp(7, 5), lamp(12, 6), 1, 'lights'), B(lamp(5, 11), lamp(9, 11), 2, 'lights'),
        { a: [5.5, 12.5], b: [8.5, 12.5], style: 'bunting', h: 38, sag: 4, high: true, seed: 3 },
        { a: [5.5, 12.5], b: [8.5, 12.5], style: 'lights', h: 34, sag: 6, high: true, seed: 1 },
      ],
    });
  }

  // ---- Ioka -------------------------------------------------------------------------------------
  look('ioka', {
    floor(p, t) {
      if (t.t !== 'd' || t.h !== 0) return null;
      const dx = p.tx + 0.5 - 112, dy = p.ty + 0.5 - 112;
      const d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
      // ash and char round the fire, then the ring the dancers have beaten into the earth
      if (d < 13) return d < 8 ? (hash(p.tx, p.ty, 411) > 0.5 ? C.stone[0] : C.ink[2]) : bayer(p.px, p.py) < (13 - d) / 5 ? C.stone[1] : null;
      if (d > 36 && d < 44) {
        const k = mod(a * 7.2, 1), q = (d - 36) / 8;
        if (k < 0.34 && q > 0.2 && q < 0.8) return Math.floor(a * 7.2) & 1 ? C.wood[1] : C.wood[2];
      }
      return null;
    },
    under: [...U('bones', [[5, 5, 0], [9, 9, 2], [3, 10, 1], [10, 5, 0]]), ...U('footprints', [[7, 11, 0], [7, 12, 0], [6, 3, 0]])],
    front: [
      ...F('drum', [[5.5, 6.5, 0], [5.5, 7.5, 1], [8.5, 8.5, 0]]),
      ...F('hide_rack', [[10.5, 3.5], [2.5, 9.5]]),
      ...F('fish_rack', [[9.5, 10.5]]),
      ...FXL('smoke', [[2, 4], [12, 4], [10, 2], [4, 2], [2, 11]], { lift: 3.2, rise: 22, ms: 4200, cols: [R.stone[4], R.stone[3], R.stone[2]], zo: 1 }),
      ...FXL('smoke', [[7, 7]], { lift: 2.4, rise: 40, ms: 3000, n: 7, cols: [R.stone[2], R.stone[3], R.stone[4]], zo: 1 }),
    ],
  });

  // ---- Tyrano crater -----------------------------------------------------------------------------
  {
    const m = CT.MAPS.tyrano_crater;
    const lava = [];
    if (m) m.terrain.forEach((row, y) => [...row].forEach((c, x) => c === 'l' && lava.push([x, y])));
    look('tyrano_crater', {
      under: U('bones', [[4, 6, 0], [11, 5, 1], [5, 11, 2], [10, 11, 0], [6, 4, 1], [12, 9, 2], [3, 6, 2]]),
      front: [
        ...FXL('heat', lava, { zo: 0.5 }),
        ...FXL('smoke', [[13, 3], [3, 11], [11, 12]], { rise: 34, ms: 3800, n: 6, cols: [R.red[1], R.stone[1], R.stone[0]], zo: 1 }),
      ],
    });
  }

  // ---- The Last Village ------------------------------------------------------------------------
  look('last_village', {
    floor(p, t) {
      if ((t.t !== 'n' && t.t !== 'z') || t.h !== 2) return null;
      const dx = p.tx + 0.5 - 80, dy = p.ty + 0.5 - 96;
      const d = Math.sqrt(dx * dx + dy * dy);
      // the fire has thawed a ring of wet earth
      if (d < 20 && d > 9) return bayer(p.px, p.py) < (20 - d) / 8 ? (hash(p.tx >> 1, p.ty >> 1, 421) > 0.6 ? C.stone[1] : C.stone[2]) : null;
      return null;
    },
    under: [...U('snow_drift', [[1, 4, 0], [7, 9, 1], [3, 6, 1], [9, 5, 0], [5, 10, 0], [8, 8, 1], [1, 8, 0]]), ...U('footprints', [[6, 8, 1], [5, 4, 1], [4, 7, 1], [8, 5, 1]])],
    front: [
      ...F('fish_rack', [[6.5, 6.5], [3.5, 9.5]]),
      ...FXL('smoke', [[2, 3], [8, 2], [2, 7], [8, 11]], { lift: 3.4, rise: 28, ms: 4600, dx: 5, cols: [R.slate[5], R.slate[4], R.slate[3]], zo: 1 }),
      ...FXL('smoke', [[5, 6]], { lift: 2.2, rise: 36, ms: 3200, n: 6, cols: [R.slate[3], R.slate[4], R.slate[5]], zo: 1 }),
    ],
  });

  // ---- Zeal wreckage ----------------------------------------------------------------------------
  // The sun sigil of Zeal in the hall floor, worn through where the sea got in.
  look('zeal_wreck', {
    floor(p, t) {
      if (t.t !== 'm' || t.h > 2) return null;
      const dx = p.tx + 0.5 - 124, dy = p.ty + 0.5 - 116;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 58) return null;
      if (vnoise(p.wx * 1.1, p.wy * 1.1, 431) > 0.6) return null; // worn away
      const a = Math.atan2(dy, dx);
      if (Math.abs(d - 54) < 0.9) return C.gold[1];
      if (Math.abs(d - 50.5) < 0.6) return C.wood[4];
      if (Math.abs(d - 22) < 0.8) return C.gold[2];
      // sixteen rays, long and short
      const k = a / (Math.PI / 8), f = Math.abs(mod(k + 0.5, 1) - 0.5), long = mod(Math.round(k), 2) === 0;
      const tip = long ? 48 : 38;
      if (d > 24 && d < tip && f * d * (Math.PI / 8) < (tip - d) * 0.16) return f * d * (Math.PI / 8) < (tip - d) * 0.07 ? C.gold[3] : C.gold[1];
      if (d < 20 && d > 16.5) return C.teal[2];
      if (d < 7) return d > 5 ? C.gold[2] : C.blue[5];
      return null;
    },
    under: [...U('puddle', [[5, 12, 0], [10, 12, 1], [3, 9, 1], [12, 9, 0]])],
    front: [...FXL('mist', [[4, 11], [11, 11], [12, 12], [8, 13]])],
  });

  // ---- End of Time -----------------------------------------------------------------------------
  // The iron railings of the old square, and the bucket.
  {
    // [corner points, floor level, a tile that stands at that level]
    const rails = [
      [[[3.5, 4.5], [4.5, 4.5], [4.5, 3.5]], 1, [5, 5]], [[[7.5, 3.5], [7.5, 4.5], [8.5, 4.5]], 1, [5, 5]],
      [[[3.5, 7.5], [4.5, 7.5], [4.5, 8.5]], 1, [5, 5]], [[[7.5, 8.5], [7.5, 7.5], [8.5, 7.5]], 1, [5, 5]],
      [[[0.5, 2.5], [2.5, 2.5]], 0, [1, 3]], [[[0.5, 7.5], [2.5, 7.5]], 0, [1, 7]], [[[4.5, 10.5], [4.5, 9.5]], 0, [5, 10]], [[[7.5, 9.5], [7.5, 10.5]], 0, [7, 10]],
    ];
    look('end_of_time', {
      front: [...rails.flatMap(([pts, , own]) => F('rail_post', pts, { own })), ...F('bucket', [[7.3, 10.3]], { own: [7, 10] })],
      spans: rails.flatMap(([pts, ha]) => run('rail', pts, { h: 11, sag: 0, ha })),
    });
  }

  // ---- Denadoro ----------------------------------------------------------------------------------
  look('denadoro', {
    front: [...FXL('mist', [[8, 5], [8, 9], [8, 11], [8, 13]], { zo: 1 })],
  });

  CT.DRESS = { frontList, drawFront, drawUnder, look, FX };
})();
