// Rigged enemies and bosses (see docs/ART_SPEC.md).
//
// Humanoids (hench, imp, kilwala, seedbearer) use CT.RIG.human with hooks.
// Everything else paints its own body from the pose. Beyond the standard pose
// fields, monster animations use a few extra ones of their own:
//   sq    squash (+) / stretch (-) of a soft body
//   jaw   how far a mouth is open (0..1)
//   roll  rotation phase of a rolling shell (radians)
//   open  how far plates / spikes are flared (0..1)
//   glow  core / eye brightness step (0..2)
(function () {
  const CT = (window.CT = window.CT || {});
  const { define, human } = CT.RIG;
  const PI = Math.PI;

  // ---- helpers ---------------------------------------------------------------------------
  const R = Math.round;
  // Monster pose basics: root offset, hip drop, lean, squash.
  function base(p, J) {
    return {
      x: J.root.x,
      y: J.root.y,
      dip: (p.bob || 0) + (p.crouch || 0),
      lean: p.lean || 0,
      sq: p.sq || 0,
      hurt: !!p.hurt,
      ko: !!p.ko,
    };
  }
  // A Grid proxy that magnifies 1x geometry by k around (ox, oy): big rigs keep their
  // hand-tuned proportions and simply draw larger. Radii and widths scale; 1px lines stay 1px.
  function scaled(g, ox, oy, k) {
    const T = (x, y) => [ox + (x - ox) * k, oy + (y - oy) * k];
    return {
      T, w: g.w, h: g.h, a: g.a,
      px: (x, y, c) => g.px(...T(x, y), c),
      rect: (x0, y0, x1, y1, c) => { const a = T(x0, y0), b = T(x1, y1); g.rect(R(a[0]), R(a[1]), R(b[0]), R(b[1]), c); },
      ell: (x, y, rx, ry, c) => g.ell(...T(x, y), rx * k, ry * k, c),
      line: (x0, y0, x1, y1, c) => g.line(...T(x0, y0), ...T(x1, y1), c),
      capsule: (x0, y0, x1, y1, r, c) => g.capsule(...T(x0, y0), ...T(x1, y1), r * k, c),
      poly: (pts, c) => g.poly(pts.map((q) => T(q[0], q[1])), c),
      spike: (x0, y0, x1, y1, w, c) => g.spike(...T(x0, y0), ...T(x1, y1), w * k, c),
      tri: (ax, ay, bx, by, cx, cy, c) => g.tri(...T(ax, ay), ...T(bx, by), ...T(cx, cy), c),
    };
  }
  // Custom-drawn monsters record their cast light origin (mouth, core, crown) in J.rim.
  const rimAt = (J) => J.rim || [J.head.x, J.head.y];
  const dir = (a) => ({ x: Math.sin(a), y: Math.cos(a) }); // angle from straight down, + forward
  // Frame list helper: every frame gets ms.
  const F = (ms, o) => Object.assign({ ms }, o);

  // =========================================================================================
  // HENCH — blue horned brute of Magus's army, with a hand axe
  // =========================================================================================
  define('hench', {
    body: { leg: 11, torso: 10, neck: 1, headR: 6, shoulder: 4, upper: 6, fore: 5, hipW: 3, stance: 4 },
    pal: {
      s: '#5c90dc', S: '#3c64b4', c: '#5c90dc', u: '#8cc0f0', b: '#4a2a16',
      d: '#5c90dc', D: '#3c64b4', A: '#5c90dc', a: '#3c64b4', F: '#5c90dc', f: '#2c4488',
      p: '#3c64b4', q: '#2c4488', o: '#2a160e',
      e: '#fce068', E: '#fff4b0', m: '#1a1226', w: '#fff0dc', K: '#a02030',
      h: '#fff0dc', H: '#c0aa92', l: '#6c3094', L: '#4a1c6c', y: '#f8bc3c',
      x: '#6e4222', z: '#bcc0d4', Z: '#e4e8f0', n: '#6e7090',
    },
    detail: 'eEmwKHZ',
    magic: '#8cc0f0',
    anims: {
      idle: {
        loop: true,
        frames: [
          F(520, { armF: [0.5, 0.9], armB: [-0.2, 0.3], wpn: 1.0, crouch: 1 }),
          F(520, { armF: [0.45, 0.95], armB: [-0.15, 0.35], wpn: 1.0, crouch: 1, bob: 1 }),
        ],
      },
      walk: {
        loop: true,
        frames: [
          F(150, { footF: [3, 0], footB: [-3, 0], armF: [0.3, 1.0], armB: [0.4, 0.4], wpn: 0.9, crouch: 1 }),
          F(150, { footF: [0, 0], footB: [1, 2], armF: [0.45, 0.95], armB: [0, 0.4], wpn: 1.0 }),
          F(150, { footF: [-3, 0], footB: [3, 0], armF: [0.6, 0.9], armB: [-0.35, 0.4], wpn: 1.1, crouch: 1 }),
          F(150, { footF: [1, 2], footB: [0, 0], armF: [0.45, 0.95], armB: [0, 0.4], wpn: 1.0 }),
        ],
      },
      victory: {
        loop: true,
        frames: [
          F(300, { armF: [2.5, 0.4], armB: [-0.3, 0.4], wpn: 0.4, tilt: -1 }),
          F(300, { armF: [2.6, 0.3], armB: [-0.3, 0.4], wpn: 0.3, tilt: -1, bob: -1 }),
        ],
      },
      attack: {
        frames: [
          F(160, { lean: -0.2, crouch: 1, wpn: -0.8, armF: [2.8, 0.4], armB: [-0.7, 0.5], footF: [1, 0], footB: [-2, 0], tilt: -1 }),
          F(70, { lean: 0.35, crouch: 3, x: 3, wpn: 2.0, armF: [1.35, 0.2], armB: [-0.9, 0.3], footF: [5, 0], footB: [-4, 0], tilt: 1, nod: 1 }),
          F(180, { lean: 0.35, crouch: 3, x: 3, wpn: 2.6, armF: [0.7, 0.2], armB: [-0.7, 0.3], footF: [5, 0], footB: [-4, 0], tilt: 1, nod: 1 }),
          F(140, { lean: 0.1, crouch: 1, x: 1, armF: [0.5, 0.9], armB: [-0.2, 0.3], wpn: 1.0, footF: [2, 0], footB: [-2, 0] }),
        ],
      },
    },
    draw: human({
      sleeves: 'bare',
      width: 6,
      behind(g, J, view) {
        // Tail stub on the loincloth at the back.
        if (view === 'ne') g.capsule(J.hip.x - 3, J.hip.y + 1, J.hip.x - 6, J.hip.y + 5, 1.2, 'L');
      },
      legs(g, J) {
        // Loincloth flaps between the legs.
        const h = J.hip;
        g.poly([[h.x - 4, h.y], [h.x + 4, h.y], [h.x + 3, h.y + 6], [h.x - 2, h.y + 6]], 'l');
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip, L = J.lean;
        if (view === 'se') {
          // Pale belly and a pectoral crease.
          g.ell(c.x + 1.5 + L * 4, (c.y + h.y) / 2 + 1, 3, 4, 'u');
          g.line(c.x - 1, c.y + 1, c.x + 3, c.y + 2, 'S');
        } else g.line(c.x - 1, c.y + 1, h.x - 1, h.y - 2, 'S');
        // Belt with a gold buckle.
        g.capsule(h.x - 6, h.y, h.x + 5.5, h.y + L * 4, 1, 'L');
        if (view === 'se') g.rect(R(h.x + 2), R(h.y - 1), R(h.x + 3), R(h.y + 1), 'y');
        // Spiked shoulder pad on the near shoulder.
        g.ell(J.shF.x, J.shF.y - 1, 2.5, 2, 'n');
        g.px(J.shF.x, J.shF.y - 4, 'Z');
        g.px(J.shF.x, J.shF.y - 3, 'z');
      },
      face(g, J) {
        const pose = J.pose;
        const x = R(J.head.x), y = R(J.head.y);
        // Heavy brow, glaring eyes, fanged grimace.
        g.line(x - 1, y - 2, x + 5, y - 1, 'S');
        if (pose.hurt) {
          g.line(x, y - 1, x + 1, y, 'm');
          g.line(x + 4, y, x + 5, y - 1, 'm');
        } else {
          g.rect(x, y - 1, x + 1, y, 'e');
          g.rect(x + 4, y - 1, x + 5, y, 'e');
          g.px(x + 1, y, 'K');
          g.px(x + 5, y, 'K');
        }
        g.px(x + 6, y + 1, 'S'); // snout
        g.rect(x, y + 3, x + 5, y + 4, 'm');
        g.px(x + 1, y + 3, 'w');
        g.px(x + 4, y + 3, 'w');
        g.px(x + 2, y + 4, pose.hurt ? 'K' : 'm');
      },
      hair(g, J, view) {
        const H = J.head, x = H.x, y = H.y;
        // Two curved ivory horns sweeping up and out.
        const horn = (sx, dx) => {
          g.spike(x + sx, y - 4, x + sx + dx * 3, y - 9, 3.5, 'h');
          g.spike(x + sx + dx * 3, y - 9, x + sx + dx * 2, y - 13, 2.2, 'h');
          g.line(x + sx + dx * 0.5, y - 5, x + sx + dx * 2.5, y - 9, 'H');
        };
        horn(-4, -1);
        horn(3, 1);
        if (view === 'ne') {
          // Back of the head: a dark crest down the skull.
          g.line(x, y - 4, x, y + 3, 'S');
        }
      },
      weapon(g, J) {
        const h = J.handF, d = J.wdir, n = { x: -d.y, y: d.x };
        const at = (a, b) => [h.x + d.x * a + n.x * b, h.y + d.y * a + n.y * b];
        g.capsule(...at(-3, 0), ...at(11, 0), 0.9, 'x');
        // Crescent blade on the leading side, back spike behind.
        g.poly([at(6, 0.5), at(11, 0.5), at(13, 5), at(8.5, 6), at(4, 5)], 'z');
        g.line(...at(4, 5), ...at(8.5, 6), 'Z');
        g.line(...at(8.5, 6), ...at(13, 5), 'Z');
        g.spike(...at(9, -0.5), ...at(9, -3.5), 2.5, 'n');
        g.px(...at(11.5, 0), 'n');
      },
      front(g, J, view) {
        if (view !== 'se') return;
        // Brute's bicep over the near upper arm.
        g.ell((J.shF.x * 2 + J.elF.x) / 3, (J.shF.y * 2 + J.elF.y) / 3, 2, 2, 'd');
      },
    }),
  });

  // =========================================================================================
  // IMP — small teal goblin with big ears, yellow eyes and a knife
  // =========================================================================================
  define('imp', {
    body: { leg: 7, torso: 6, neck: 1, headR: 6, shoulder: 3, upper: 4, fore: 4, hipW: 2, stance: 3 },
    pal: {
      s: '#48a894', S: '#2a7470', c: '#48a894', u: '#7cd4b8', b: '#2a7470',
      d: '#48a894', D: '#2a7470', A: '#48a894', a: '#2a7470', F: '#48a894', f: '#2a7470',
      p: '#48a894', q: '#2a7470', o: '#1a4a4e',
      i: '#e0709c', e: '#1a1226', E: '#fce068', m: '#3c0a14', w: '#fff0dc',
      r: '#a02030', R: '#6c1422', x: '#bcc0d4', X: '#e4e8f0', g: '#6e4222', t: '#2a7470', n: '#c0aa92',
    },
    detail: 'eEmwiX',
    magic: '#a8d45c',
    anims: {
      idle: {
        loop: true,
        frames: [
          F(420, { armF: [0.5, 0.8], armB: [-0.3, 0.4], crouch: 1, lean: 0.1 }),
          F(420, { armF: [0.45, 0.85], armB: [-0.25, 0.45], crouch: 2, lean: 0.1 }),
        ],
      },
      walk: {
        loop: true,
        frames: [
          F(110, { footF: [3, 0], footB: [-3, 0], armF: [-0.4, 0.6], armB: [0.5, 0.5], lean: 0.15, crouch: 1 }),
          F(110, { footF: [0, 0], footB: [1, 3], armF: [0.2, 0.6], armB: [0, 0.5], lean: 0.15, y: -2 }),
          F(110, { footF: [-3, 0], footB: [3, 0], armF: [0.6, 0.6], armB: [-0.4, 0.5], lean: 0.15, crouch: 1 }),
          F(110, { footF: [1, 3], footB: [0, 0], armF: [0.2, 0.6], armB: [0, 0.5], lean: 0.15, y: -2 }),
        ],
      },
      attack: {
        frames: [
          F(150, { lean: -0.1, crouch: 3, armF: [2.2, 0.8], armB: [-0.6, 0.6], footF: [1, 0], footB: [-2, 0], wpn: -0.4 }),
          F(80, { lean: 0.45, y: -3, x: 4, armF: [1.5, 0.05], armB: [-1.0, 0.3], footF: [4, 2], footB: [-3, 3], wpn: 1.6, tilt: 1 }),
          F(170, { lean: 0.4, crouch: 2, x: 5, armF: [1.2, 0.1], armB: [-0.8, 0.3], footF: [5, 0], footB: [-3, 0], wpn: 1.7, tilt: 1 }),
          F(140, { lean: 0.15, crouch: 1, x: 2, armF: [0.5, 0.8], armB: [-0.3, 0.4], footF: [2, 0], footB: [-2, 0] }),
        ],
      },
      victory: {
        loop: true,
        frames: [
          F(200, { armF: [2.8, 0.2], armB: [2.6, 0.2], crouch: 2 }),
          F(200, { armF: [2.9, 0.1], armB: [2.8, 0.1], y: -4, footF: [0, 2], footB: [0, 2] }),
        ],
      },
    },
    draw: human({
      sleeves: 'bare',
      width: 3,
      behind(g, J) {
        // Thin tail with an arrow tip.
        const h = J.hip, s = J.pose.bob ? 1 : 0;
        g.capsule(h.x - 2, h.y + 1, h.x - 6, h.y - 1 + s, 0.6, 't');
        g.capsule(h.x - 6, h.y - 1 + s, h.x - 8, h.y - 4 + s, 0.6, 't');
        g.spike(h.x - 8, h.y - 4 + s, h.x - 9, h.y - 7 + s, 3, 't');
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip;
        // Pot belly and a ragged loincloth.
        g.ell(h.x + 0.5, h.y - 2.5, 3.5, 3.5, 'c');
        if (view === 'se') g.ell(h.x + 1.5, h.y - 2, 2, 2.5, 'u');
        g.poly([[h.x - 3.5, h.y - 0.5], [h.x + 4, h.y - 0.5], [h.x + 3, h.y + 3], [h.x + 1, h.y + 2], [h.x - 1, h.y + 3], [h.x - 3, h.y + 2]], 'r');
        g.line(h.x - 3, h.y, h.x + 3.5, h.y, 'R');
        void c;
      },
      face(g, J) {
        const pose = J.pose;
        const x = R(J.head.x), y = R(J.head.y);
        if (pose.hurt) {
          g.line(x - 1, y - 1, x + 1, y, 'e');
          g.line(x + 3, y, x + 5, y - 1, 'e');
        } else {
          // Big yellow eyes, slanted.
          g.rect(x - 1, y - 1, x + 1, y + 1, 'E');
          g.rect(x + 3, y - 1, x + 5, y + 1, 'E');
          g.px(x + 1, y, 'e');
          g.px(x + 5, y, 'e');
          g.line(x - 1, y - 2, x + 1, y - 1, 'e');
          g.line(x + 3, y - 1, x + 5, y - 2, 'e');
        }
        // Wide jagged grin.
        g.rect(x - 1, y + 3, x + 5, y + 4, 'm');
        g.px(x, y + 3, 'w');
        g.px(x + 2, y + 3, 'w');
        g.px(x + 4, y + 3, 'w');
        g.px(x + 1, y + 4, 'w');
        g.px(x + 3, y + 4, 'w');
        g.px(x + 3, y + 2, 'S');
      },
      hair(g, J, view) {
        const x = J.head.x, y = J.head.y, fl = J.pose.hurt ? 2 : 0;
        // Long pointed ears and two horn nubs.
        g.spike(x - 4, y, x - 12, y - 4 + fl, 4, 's');
        g.spike(x + 4, y - 1, x + 11, y - 6 + fl, 4, view === 'se' ? 's' : 'S');
        if (view === 'se') {
          g.spike(x - 5, y, x - 10, y - 3 + fl, 1.5, 'i');
          g.spike(x + 5, y - 1, x + 9, y - 5 + fl, 1.5, 'i');
        }
        g.spike(x - 2, y - 5, x - 3, y - 8, 2.5, 'n');
        g.spike(x + 2, y - 5, x + 3, y - 8, 2.5, 'n');
        if (view === 'ne') {
          g.line(x, y - 3, x, y + 3, 'S');
        }
      },
      weapon(g, J) {
        const h = J.handF, d = J.wdir;
        g.capsule(h.x - d.x * 2, h.y - d.y * 2, h.x, h.y, 0.6, 'g');
        g.spike(h.x + d.x, h.y + d.y, h.x + d.x * 7, h.y + d.y * 7, 2.5, 'x');
        g.line(h.x + d.x * 1.5, h.y + d.y * 1.5, h.x + d.x * 5, h.y + d.y * 5, 'X');
      },
    }),
  });

  // =========================================================================================
  // NU — big round blue blob with a tuft, beady eyes and stubby limbs
  // =========================================================================================
  define('nu', {
    portrait: { x: 30, y: 31, side: 24 },
    rimAt,
    koRotate: false,
    pal: {
      s: '#5c90dc', b: '#8cc0f0', f: '#2c4488', F: '#3c64b4', a: '#3c64b4', A: '#5c90dc',
      t: '#2c4488', T: '#3c64b4', e: '#1a1226', E: '#ffffff', m: '#1a1226', M: '#a02030', S: '#3c64b4', P: '#e0709c',
    },
    detail: 'eEmMSP',
    magic: '#c4e4ff',
    anims: {
      idle: { loop: true, frames: [F(560, { sq: 0, armF: [0.6, 0], armB: [-0.6, 0] }), F(560, { sq: 1, armF: [0.7, 0], armB: [-0.7, 0] })] },
      walk: {
        loop: true,
        frames: [
          F(120, { sq: 2, armF: [0.8, 0], armB: [-0.8, 0] }),
          F(120, { sq: -1, y: -3, armF: [1.4, 0], armB: [-1.4, 0], footF: [1, 1], footB: [-1, 1] }),
          F(120, { sq: -1, y: -5, armF: [1.7, 0], armB: [-1.7, 0], footF: [1, 1], footB: [-1, 1] }),
          F(120, { sq: 0, y: -2, armF: [1.2, 0], armB: [-1.2, 0] }),
        ],
      },
      attack: {
        frames: [
          F(170, { sq: 3, x: -2, lean: -0.2, armF: [2.6, 0], armB: [-2.2, 0] }),
          F(80, { sq: -2, x: 4, y: -4, lean: 0.35, armF: [1.8, 0], armB: [-1.6, 0], footF: [2, 2], footB: [0, 2] }),
          F(190, { sq: 4, x: 6, lean: 0.2, armF: [0.9, 0], armB: [-0.9, 0], jaw: 1 }),
          F(150, { sq: 1, x: 2, armF: [0.6, 0], armB: [-0.6, 0] }),
        ],
      },
      cast: {
        frames: [
          F(170, { sq: 1, armF: [2.9, 0], armB: [2.9, 0], glow: 1 }),
          F(170, { sq: 0, y: -1, armF: [3.0, 0], armB: [3.0, 0], glow: 2 }),
          F(260, { sq: -2, y: -2, armF: [2.2, 0], armB: [-2.2, 0], jaw: 1 }),
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      shoot: { frames: [F(150, { sq: 2, lean: -0.1, armF: [1.2, 0], armB: [-1, 0] }), F(150, { sq: -1, x: 1, lean: 0.15, armF: [1.8, 0], armB: [-1.2, 0], jaw: 1 })] },
      hurt: { frames: [F(300, { sq: -1, x: -3, lean: -0.3, armF: [2.2, 0], armB: [-2.2, 0], hurt: true, jaw: 1 })] },
      ko: { frames: [F(1000, { sq: 5, armF: [1.5, 0], armB: [-1.5, 0], hurt: true, ko: true })] },
      kneel: { frames: [F(1000, { sq: 3, lean: 0.15, armF: [0.3, 0], armB: [-0.3, 0] })] },
      victory: {
        loop: true,
        frames: [F(220, { sq: 2, armF: [2.6, 0], armB: [-2.6, 0] }), F(220, { sq: -2, y: -6, armF: [2.9, 0], armB: [-2.9, 0], jaw: 1, footF: [1, 1], footB: [-1, 1] })],
      },
    },
    draw(g, J, view, p) {
      const b = base(p, J);
      const sq = b.sq;
      // Pear body: squash widens and lowers it, the bottom stays on the ground.
      const rx = 12 + sq * 0.7, ry = 10 - sq * 0.8;
      const cx = b.x - 0.5, cy = b.y - 3 - ry;
      const tl = b.lean * 9; // top shift for lean
      const hx = cx + tl * 0.7, hry = 8 - sq * 0.6, hy = cy - ry * 0.55 - hry * 0.3;
      const ff = p.footF || [0, 0], fb = p.footB || [0, 0];
      // Far foot and far arm behind.
      g.ell(cx - 6 + fb[0], b.y - 1.5 - (fb[1] || 0), 3.5, 2, 'f');
      const aB = p.armB || [-0.6, 0], aF = p.armF || [0.6, 0];
      const [bx, by] = [cx - (rx - 2) + tl * 0.4 + Math.sin(aB[0]) * 4, cy + 1 + Math.cos(aB[0]) * 4];
      g.ell(bx, by, 2.4, 3, 'a');
      // Body.
      g.ell(cx, cy, rx, ry, 's');
      g.ell(hx, hy, 9 + sq * 0.4, hry, 's');
      // Tuft of dark fur on top.
      const top = hy - hry + 1, tf = p.hurt ? 2 : 0;
      J.rim = [hx, top - 3];
      g.spike(hx - 3, top + 2, hx - 6 - tf, top - 5, 3.5, 't');
      g.spike(hx, top + 1, hx + 1 - tf, top - 7, 4, 'T');
      g.spike(hx + 3, top + 2, hx + 6 - tf, top - 5, 3.5, 't');
      if (view === 'se') {
        // Pale belly, eyes and mouth offset toward the facing side.
        g.ell(cx + 3, cy + 2, rx - 5, ry - 3, 'b');
        const ex = R(hx + 1), ey = R(hy + 1);
        if (p.hurt) {
          g.line(ex - 1, ey - 1, ex + 1, ey, 'e');
          g.line(ex + 5, ey, ex + 7, ey - 1, 'e');
        } else {
          g.rect(ex, ey - 1, ex, ey + 1, 'e');
          g.rect(ex + 5, ey - 1, ex + 5, ey + 1, 'e');
          g.px(ex, ey - 1, 'E');
          g.px(ex + 5, ey - 1, 'E');
        }
        g.px(ex - 3, ey + 3, 'P');
        g.px(ex + 8, ey + 3, 'P');
        const my = R(cy - ry * 0.25 + 3);
        if (p.jaw) {
          g.ell(ex + 2.5, my + 1, 3.5, 1.5, 'm');
          g.rect(ex + 1, my + 1, ex + 4, my + 1, 'M');
        } else {
          g.line(ex - 1, my, ex + 6, my, 'm');
          g.px(ex - 2, my - 1, 'm');
          g.px(ex + 7, my - 1, 'm');
        }
      } else {
        // Back: a crease down the fur.
        g.line(hx - 1, top + 2, cx - 2, cy + ry - 3, 'S');
      }
      // Near foot and near arm in front.
      g.ell(cx + 6 + ff[0], b.y - 1 - (ff[1] || 0), 3.5, 2, 'F');
      g.ell(cx + (rx - 2) + tl * 0.4 + Math.sin(aF[0]) * 4, cy + 1 + Math.cos(aF[0]) * 4, 2.4, 3, 'A');
    },
  });

  // =========================================================================================
  // KILWALA — small white ape: hunched, long knuckle-dragging arms, pink face, big ears
  // =========================================================================================
  const KIL_ARMS = { armF: [0.25, 0.15], armB: [0.05, 0.1] };
  define('kilwala', {
    body: { leg: 7, torso: 8, neck: 0, headR: 6, shoulder: 4, upper: 6, fore: 6, hipW: 2, stance: 3 },
    pal: {
      s: '#e4e8f0', S: '#bcc0d4', c: '#e4e8f0', C: '#bcc0d4', d: '#e4e8f0', D: '#bcc0d4',
      A: '#e4e8f0', a: '#bcc0d4', F: '#52526e', f: '#3a3a52', p: '#e4e8f0', q: '#bcc0d4', b: '#52526e', o: '#3a3a52',
      i: '#f8b0c8', I: '#e0709c', e: '#1a1226', E: '#ffffff', m: '#6c1422', H: '#9294b0', r: '#7a665a', w: '#fff0dc',
    },
    detail: 'eEmHIw',
    magic: '#f8b0c8',
    anims: {
      idle: {
        loop: true,
        frames: [F(420, { lean: 0.3, crouch: 1, ...KIL_ARMS }), F(420, { lean: 0.35, crouch: 2, armF: [0.3, 0.1], armB: [0.1, 0.1], nod: 1 })],
      },
      walk: {
        loop: true,
        frames: [
          F(110, { lean: 0.4, crouch: 1, footF: [3, 0], footB: [-3, 0], armF: [-0.2, 0.1], armB: [0.6, 0.1] }),
          F(110, { lean: 0.4, y: -2, footF: [0, 1], footB: [1, 3], armF: [0.3, 0.3], armB: [0.2, 0.3] }),
          F(110, { lean: 0.4, crouch: 1, footF: [-3, 0], footB: [3, 0], armF: [0.6, 0.1], armB: [-0.2, 0.1] }),
          F(110, { lean: 0.4, y: -2, footF: [1, 3], footB: [0, 1], armF: [0.3, 0.3], armB: [0.2, 0.3] }),
        ],
      },
      attack: {
        frames: [
          F(150, { lean: 0.1, crouch: 3, armF: [2.8, 0.3], armB: [2.5, 0.3], footF: [1, 0], footB: [-2, 0], tilt: -1, jaw: 1 }),
          F(80, { lean: 0.5, y: -4, x: 4, armF: [1.9, -0.3], armB: [1.6, -0.2], footF: [3, 3], footB: [-3, 4], tilt: 1, jaw: 1 }),
          F(170, { lean: 0.55, crouch: 2, x: 5, armF: [0.9, 0.2], armB: [0.7, 0.2], footF: [5, 0], footB: [-3, 0], tilt: 1, jaw: 1 }),
          F(140, { lean: 0.35, crouch: 1, x: 2, ...KIL_ARMS, footF: [2, 0], footB: [-2, 0] }),
        ],
      },
      // Rock toss: heave the rock overhead, then hurl it.
      shoot: {
        frames: [
          F(170, { lean: -0.2, crouch: 1, armF: [2.9, 0.4], armB: [2.6, 0.5], rock: 1, tilt: -1 }),
          F(170, { lean: 0.45, x: 2, armF: [1.3, 0.1], armB: [0.5, 0.2], footF: [3, 0], footB: [-3, 0], jaw: 1 }),
        ],
      },
      cast: {
        frames: [
          F(160, { lean: 0.1, crouch: 2, armF: [2.5, -0.3], armB: [2.3, -0.3], jaw: 1 }),
          F(160, { lean: 0.1, crouch: 1, y: -1, armF: [2.7, -0.4], armB: [2.5, -0.4], jaw: 1 }),
          F(260, { lean: 0.35, armF: [1.6, 0], armB: [1.4, 0], footF: [2, 0], footB: [-3, 0], jaw: 1 }),
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      hurt: { frames: [F(300, { lean: -0.2, x: -2, crouch: 2, armF: [-0.5, 0.5], armB: [1.0, 0.6], tilt: -1, nod: 1, footF: [1, 0], footB: [-3, 0], hurt: true })] },
      ko: { frames: [F(1000, { lean: 0.1, crouch: 3, armF: [0.2, 0.1], armB: [0.3, 0.1], nod: 1, ko: true })] },
      kneel: { frames: [F(1000, { lean: 0.5, crouch: 4, footF: [3, 0], footB: [-4, 0], armF: [0.5, 0.4], armB: [0.3, 0.3], nod: 1 })] },
      victory: {
        loop: true,
        frames: [F(200, { lean: 0.1, crouch: 2, armF: [2.9, 0.2], armB: [2.7, 0.2], jaw: 1 }), F(200, { lean: 0, y: -4, armF: [3.0, 0.1], armB: [2.9, 0.1], footF: [0, 2], footB: [0, 2], jaw: 1 })],
      },
    },
    draw: human({
      sleeves: 'long',
      width: 5,
      behind(g, J, view) {
        // Shaggy far-side fur hanging off the back.
        const c = J.chest, h = J.hip;
        g.ell((c.x + h.x) / 2 - 2, (c.y + h.y) / 2 + 1, 4.5, 5, 'C');
        void view;
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip;
        // Round shaggy body with fringe spikes at the hem.
        g.ell((c.x + h.x) / 2, (c.y + h.y) / 2 + 0.5, 5.5, 6, 'c');
        for (const [dx, len] of [[-4, 3], [-1, 4], [2, 3], [4, 2]]) g.spike(h.x + dx, h.y + 1, h.x + dx - 1, h.y + 1 + len, 2.5, 'c');
        if (view === 'se') g.ell((c.x + h.x) / 2 + 2, (c.y + h.y) / 2 + 1.5, 2.5, 3.5, 'i');
        else g.line(c.x - 1, c.y + 1, h.x - 1, h.y - 1, 'H');
        // Fur strands.
        g.line(c.x - 3, c.y + 2, c.x - 4, c.y + 5, 'H');
      },
      face(g, J) {
        const p = J.pose, x = R(J.head.x), y = R(J.head.y);
        // Pink heart-shaped face mask on the facing side.
        g.ell(x + 2, y + 1, 3.6, 3.8, 'i');
        g.ell(x + 0.5, y - 1, 2, 2, 'i');
        g.ell(x + 3.5, y - 1, 2, 2, 'i');
        if (p.hurt) {
          g.line(x, y - 1, x + 1, y, 'e');
          g.line(x + 3, y, x + 4, y - 1, 'e');
        } else {
          g.rect(x, y - 1, x + 1, y, 'e');
          g.rect(x + 3, y - 1, x + 4, y, 'e');
          g.px(x, y - 1, 'E');
          g.px(x + 3, y - 1, 'E');
        }
        g.px(x + 2, y + 1, 'I');
        g.px(x + 3, y + 1, 'I');
        if (p.jaw || p.hurt) {
          g.rect(x + 1, y + 3, x + 4, y + 4, 'm');
          g.px(x + 1, y + 3, 'w');
          g.px(x + 4, y + 3, 'w');
        } else g.line(x + 1, y + 3, x + 4, y + 3, 'm');
      },
      hair(g, J, view) {
        const x = J.head.x, y = J.head.y;
        // Big round ears, a tuft on the crown.
        g.ell(x - 5, y - 3, 2.8, 2.8, 's');
        g.ell(x + 5.5, y - 4, 2.6, 2.6, 'S');
        if (view === 'se') g.ell(x - 5, y - 3, 1.4, 1.4, 'I');
        g.spike(x - 2, y - 5, x - 3, y - 9, 3, 's');
        g.spike(x + 1, y - 5, x + 2, y - 9, 3, 's');
        g.line(x - 2, y - 6, x - 3, y - 8, 'H');
        if (view === 'ne') {
          g.line(x - 1, y - 2, x - 2, y + 3, 'H');
          g.line(x + 2, y - 2, x + 3, y + 3, 'H');
        }
      },
      weapon(g, J) {
        if (!J.pose.rock) return;
        const h = J.handF;
        g.ell(h.x + 1, h.y - 3, 3, 2.6, 'r');
      },
    }),
  });

  // =========================================================================================
  // SEEDBEARER — faceless porcelain automaton on a lattice of blue light, carrying a Lavos Seed
  // =========================================================================================
  const SEED_ARMS = { armF: [0.9, 1.35], armB: [-0.15, 0.3] };
  define('seedbearer', {
    body: { leg: 14, torso: 9, neck: 3, headR: 4, shoulder: 3, upper: 6, fore: 5, hipW: 2, stance: 3 },
    pal: {
      s: '#e4e8f0', S: '#1c2c5c', c: '#e4e8f0', C: '#bcc0d4', d: '#e4e8f0', D: '#bcc0d4', A: '#e4e8f0', a: '#bcc0d4',
      F: '#e4e8f0', f: '#bcc0d4', p: '#e4e8f0', q: '#bcc0d4', b: '#bcc0d4', o: '#9294b0',
      j: '#1c2c5c', g: '#8cc0f0', G: '#c4e4ff', w: '#ffffff', l: '#9294b0',
      r: '#3c0a14', R: '#a02030', O: '#f06c4c', Y: '#fce068',
    },
    detail: 'gGlRY',
    magic: '#8cc0f0',
    anims: {
      idle: { loop: true, frames: [F(560, { ...SEED_ARMS }), F(560, { ...SEED_ARMS, bob: 1, glow: 1 })] },
      walk: {
        loop: true,
        frames: [
          F(150, { footF: [3, 0], footB: [-3, 0], ...SEED_ARMS, armB: [0.35, 0.3] }),
          F(150, { footF: [0, 0], footB: [1, 2], ...SEED_ARMS, bob: -1, glow: 1 }),
          F(150, { footF: [-3, 0], footB: [3, 0], ...SEED_ARMS, armB: [-0.4, 0.3] }),
          F(150, { footF: [1, 2], footB: [0, 0], ...SEED_ARMS, bob: -1, glow: 1 }),
        ],
      },
      // Porcelain strike: a stiff backhand with the far arm, the seed kept safe.
      attack: {
        frames: [
          F(160, { lean: -0.1, crouch: 1, armF: [0.9, 1.35], armB: [2.4, 0.3], footF: [1, 0], footB: [-2, 0], tilt: -1 }),
          F(70, { lean: 0.3, crouch: 2, x: 3, armF: [0.7, 1.4], armB: [1.6, 0], footF: [5, 0], footB: [-4, 0], glow: 2 }),
          F(170, { lean: 0.3, crouch: 2, x: 3, armF: [0.7, 1.4], armB: [1.0, 0], footF: [5, 0], footB: [-4, 0], glow: 1 }),
          F(140, { lean: 0.1, crouch: 1, x: 1, ...SEED_ARMS, footF: [2, 0], footB: [-2, 0] }),
        ],
      },
      cast: {
        frames: [
          F(160, { lean: -0.05, armF: [2.0, 0.4], armB: [2.2, 0.2], crouch: 1, glow: 1 }),
          F(160, { lean: -0.05, armF: [2.1, 0.4], armB: [2.3, 0.2], crouch: 1, bob: -1, glow: 2 }),
          F(260, { lean: 0.2, armF: [1.6, 0.1], armB: [1.5, 0], footF: [2, 0], footB: [-3, 0], glow: 2 }),
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      hurt: { frames: [F(300, { lean: -0.3, x: -2, crouch: 1, armF: [0.6, 1.5], armB: [1.0, 0.5], tilt: -1, footF: [1, 0], footB: [-3, 0], hurt: true })] },
      ko: { frames: [F(1000, { lean: -0.2, crouch: 2, armF: [0.2, 0.1], armB: [0.2, 0.1], nod: 1, ko: true })] },
      victory: { loop: true, frames: [F(400, { ...SEED_ARMS, armF: [1.8, 1.0], glow: 2 }), F(400, { ...SEED_ARMS, armF: [2.0, 0.9], y: -1, glow: 1 })] },
    },
    draw: human({
      sleeves: 'long',
      width: 3.5,
      legs(g, J) {
        // Glowing knee joints.
        g.px(J.kneeB.x, J.kneeB.y, 'j');
        g.px(J.kneeF.x, J.kneeF.y, 'g');
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip, L = J.lean;
        // Sculpted chest plate over an open lattice waist.
        g.poly([[c.x - 4, c.y - 1], [c.x + 4, c.y - 1 + L * 4], [c.x + 3, c.y + 4], [c.x - 3, c.y + 4]], 'c');
        g.rect(R(h.x - 2), R(h.y - 4), R(h.x + 2), R(h.y - 2), 'j');
        g.poly([[h.x - 3.5, h.y - 2], [h.x + 3.5, h.y - 2 + L * 3], [h.x + 3, h.y + 1.5], [h.x - 3, h.y + 1.5]], 'C');
        const gl = J.pose.glow ? 'G' : 'g';
        if (view === 'se') g.line(c.x + 1, c.y, c.x + 1, c.y + 3, gl);
        else g.line(c.x - 1, c.y, c.x - 1, c.y + 3, gl);
        g.px(h.x, h.y - 3, gl);
        g.line(h.x - 1, h.y - 4, h.x + 1, h.y - 2, 'g');
        // Shoulder caps.
        g.ell(J.shB.x, J.shB.y, 1.8, 1.5, 'C');
      },
      face(g, J) {
        // Featureless egg: a single lit slit.
        const x = R(J.head.x), y = R(J.head.y);
        const gl = J.pose.glow > 1 ? 'G' : 'g';
        g.rect(x + 1, y, x + 4, y, gl);
        g.px(x + 4, y, 'G');
        g.line(x - 2, y - 4, x - 2, y + 3, 'C');
      },
      hair(g, J, view) {
        const x = J.head.x, y = J.head.y;
        // Taller egg dome and the neck lattice.
        g.ell(x, y - 2, 3.8, 3.5, 's');
        if (view === 'se') {
          const gl = J.pose.glow > 1 ? 'G' : 'g';
          g.rect(R(x) + 1, R(y), R(x) + 4, R(y), gl);
          g.px(R(x) + 4, R(y), 'G');
          g.line(x - 2, y - 5, x - 2, y + 2, 'C');
        } else g.line(x, y - 5, x, y + 3, 'j');
        g.rect(R(J.neck.x) - 1, R(J.neck.y) - 1, R(J.neck.x), R(J.neck.y) + 1, 'j');
        g.px(J.neck.x, J.neck.y, 'g');
      },
      weapon(g, J, view) {
        // The seed, cradled at the near hand: a black-red egg with a glowing crack.
        const h = J.handF, x = h.x + 1, y = h.y - 2.5;
        if (view === 'ne') return;
        g.ell(x, y, 2.6, 3.2, 'r');
        g.ell(x - 0.5, y - 1, 1.2, 1.5, 'R');
        g.line(x, y - 2, x + 1, y + 2, J.pose.glow ? 'Y' : 'O');
      },
      front(g, J, view) {
        // Elbow joints glow.
        g.px(J.elF.x, J.elF.y, view === 'se' ? 'g' : 'j');
        if (view === 'ne') {
          // Seed peeking past the body on the far side.
          const h = J.handF;
          g.ell(h.x + 1, h.y - 2.5, 2.3, 2.8, 'r');
          g.px(h.x + 1, h.y - 3, 'O');
        }
      },
    }),
  });

  // Rotate (dx, dy) by a radians (screen coordinates, + = clockwise).
  const rot = (dx, dy, a) => [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];

  // =========================================================================================
  // ROUNDILLO — banded armadillo; walks and attacks curled into a rolling ball
  // =========================================================================================
  define('roundillo', {
    portrait: { x: 31, y: 40, side: 24 },
    rimAt,
    koRotate: false,
    pal: {
      a: '#bc8844', c: '#94602e', s: '#6e4222', u: '#dcb468', h: '#e0a878', H: '#bc7a50',
      f: '#6e4222', F: '#94602e', e: '#1a1226', E: '#ffffff', n: '#e0709c', t: '#94602e', w: '#fff0dc',
    },
    detail: 'eEnw',
    magic: '#dcb468',
    anims: {
      idle: { loop: true, frames: [F(500, { sq: 0 }), F(500, { sq: 1, nod: 1 })] },
      walk: {
        loop: true,
        frames: [0, 1, 2, 3].map((i) => F(90, { ball: 1, roll: (i * PI) / 4.5, y: i % 2 ? -1 : 0 })),
      },
      attack: {
        frames: [
          F(140, { ball: 1, roll: 0, x: -2, sq: 1 }),
          F(70, { ball: 1, roll: 0.8, x: 5, y: -3 }),
          F(160, { ball: 1, roll: 1.6, x: 7, sq: 1 }),
          F(150, { x: 2, sq: 1 }),
        ],
      },
      cast: {
        frames: [F(140, { ball: 1, roll: 0, sq: 1 }), F(140, { ball: 1, roll: 0.7, y: -1 }), F(260, { ball: 1, roll: 1.4, y: -5, sq: -1 })],
        charge: [0, 1], release: 2, rim: true,
      },
      shoot: { frames: [F(150, { sq: 1, lean: -0.2 }), F(150, { x: 1, lean: 0.2, jaw: 1 })] },
      hurt: { frames: [F(300, { x: -3, lean: -0.3, hurt: true, jaw: 1 })] },
      ko: { frames: [F(1000, { sq: 3, nod: 3, lean: 0.3, hurt: true, footF: [2, 0], footB: [-2, 0], ko: true })] },
      kneel: { frames: [F(1000, { sq: 2, nod: 2 })] },
      victory: { loop: true, frames: [F(200, { ball: 1, roll: 0, y: -4 }), F(200, { ball: 1, roll: 1.2, y: 0, sq: 1 })] },
    },
    draw(g, J, view, p) {
      const b = base(p, J);
      const se = view === 'se';
      const bands = (cx, cy, rx, ry, phase, clipY) => {
        // Radial wedges from a hub: rolling rotates them.
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35);
            if (dx * dx + dy * dy > 1 || y > clipY) continue;
            const t = Math.atan2(y - cy, x - cx) + phase;
            const k = Math.floor(((t % (2 * PI)) + 2 * PI) / (PI / 5)) % 2;
            g.px(x, y, k ? 'a' : 'c');
          }
      };
      if (p.ball) {
        const sq = b.sq;
        const r = 9.5, cx = b.x - 0.5, cy = b.y - 1 - r + sq;
        J.rim = [cx, cy - r];
        bands(cx, cy, r + sq * 0.6, r - sq * 0.5, p.roll || 0, 99);
        // Hub where the head and tail tuck in.
        g.ell(cx + (se ? 1 : -1), cy + 1, 2.5, 2.5, 'u');
        g.px(cx + (se ? 2 : -2), cy, 'H');
        return;
      }
      const cx = b.x - 2, gy = b.y, sq = b.sq, L = b.lean;
      J.rim = [cx, gy - 16];
      const ff = p.footF || [0, 0], fb = p.footB || [0, 0];
      // Far feet.
      g.rect(R(cx - 7 + fb[0]), gy - 3, R(cx - 5 + fb[0]), gy, 'f');
      g.rect(R(cx + 4 + fb[0]), gy - 3, R(cx + 6 + fb[0]), gy, 'f');
      // Tail.
      g.spike(cx - 10, gy - 4, cx - 16, gy - 1, 3.5, 't');
      // Domed banded shell, belly skirt underneath.
      g.ell(cx, gy - 4, 11.5 + sq * 0.4, 3.2, 'u');
      bands(cx, gy - 4 + sq, 12 + sq * 0.5, 13 - sq * 0.8, PI / 10 + L, gy - 4);
      for (let i = 1; i < 10; i += 2) {
        const t = PI + (i * PI) / 10 + L;
        g.px(cx + Math.cos(t) * 11.5, gy - 4 + sq + Math.sin(t) * 12.5, 's');
      }
      // Head on the facing side (hidden in back view except the ears).
      const hx = cx + 12 + L * 4, hy = gy - 7 + sq + (p.nod || 0) + L * 3;
      if (se) {
        g.ell(hx, hy, 4.5, 4, 'h');
        g.poly([[hx + 1, hy - 2], [hx + 7, hy + 1], [hx + 6, hy + 3.5], [hx, hy + 3.5]], 'h');
        g.px(hx + 7, hy + 1, 'n');
        g.spike(hx - 2, hy - 2, hx - 3, hy - 7, 2.5, 'H');
        g.spike(hx, hy - 2, hx + 1, hy - 6, 2.5, 'H');
        if (p.hurt) g.line(hx, hy - 1, hx + 2, hy, 'e');
        else {
          g.rect(R(hx + 1), R(hy - 1), R(hx + 1), R(hy), 'e');
          g.px(hx + 1, hy - 1, 'E');
        }
        if (p.jaw) g.line(hx + 1, hy + 2, hx + 5, hy + 2, 'e');
      } else {
        g.spike(hx - 3, hy - 2, hx - 4, hy - 7, 2.5, 'H');
        g.spike(hx - 1, hy - 2, hx, hy - 6, 2.5, 'H');
      }
      // Near feet.
      g.rect(R(cx - 5 + ff[0]), gy - 2 - (ff[1] || 0), R(cx - 3 + ff[0]), gy - (ff[1] || 0), 'F');
      g.rect(R(cx + 6 + ff[0]), gy - 2 - (ff[1] || 0), R(cx + 8 + ff[0]), gy - (ff[1] || 0), 'F');
      g.px(cx + 9 + ff[0], gy - (ff[1] || 0), 'w');
    },
  });

  // =========================================================================================
  // TYRANO — rust-red tyrannosaur filling the frame: tail left, jaws right
  // =========================================================================================
  const TY_WALK = [
    { footF: [6, 0], footB: [-6, 0] },
    { footF: [1, 0], footB: [0, 5], bob: -1 },
    { footF: [-6, 0], footB: [6, 0] },
    { footF: [0, 5], footB: [1, 0], bob: -1 },
  ];
  define('tyrano', {
    size: 84,
    portrait: { x: 59, y: 26, side: 26 },
    rimAt,
    koRotate: false,
    pal: {
      a: '#c05c1c', h: '#c05c1c', c: '#c05c1c', f: '#8c5034', t: '#bc7a50', T: '#8c5034', u: '#dcb468', U: '#bc8844',
      s: '#5c3020', e: '#1a1226', E: '#fce068', w: '#fff0dc', m: '#3c0a14', r: '#d43c3c', j: '#bc7a50', x: '#fff0dc', d: '#e88c28',
    },
    detail: 'eEwmrsx',
    magic: '#f8bc3c',
    anims: {
      idle: { loop: true, frames: [F(600, { tail: 0 }), F(600, { bob: 1, tail: 1, lean: 0.04 })] },
      walk: { loop: true, frames: TY_WALK.map((f, i) => F(170, { ...f, tail: i % 2 ? 1 : -1, lean: i % 2 ? 0.05 : 0 })) },
      attack: {
        frames: [
          F(180, { lean: -0.3, crouch: 1, jaw: 0.6, footF: [2, 0], footB: [-3, 0], tail: 1 }),
          F(80, { lean: 0.45, crouch: 2, x: 2, jaw: 1, footF: [5, 0], footB: [-4, 0], tail: -1 }),
          F(180, { lean: 0.5, crouch: 3, x: 2, jaw: 0, footF: [5, 0], footB: [-4, 0], tail: -1 }),
          F(160, { lean: 0.1, crouch: 1, x: 1, footF: [2, 0], footB: [-2, 0] }),
        ],
      },
      // Fire breath: rear back with a glowing throat, then roar forward.
      cast: {
        frames: [
          F(170, { lean: -0.35, crouch: 1, jaw: 0.3, glow: 1, tail: 1 }),
          F(170, { lean: -0.4, bob: -1, jaw: 0.4, glow: 2, tail: 1 }),
          F(300, { lean: 0.3, crouch: 1, x: 1, jaw: 1, glow: 2, footF: [3, 0], footB: [-3, 0], tail: -1 }),
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      shoot: { frames: [F(160, { lean: -0.3, jaw: 0.4, glow: 1 }), F(160, { lean: 0.25, x: 1, jaw: 1, glow: 2 })] },
      hurt: { frames: [F(320, { lean: -0.45, x: -2, jaw: 0.7, hurt: true, footF: [1, 0], footB: [-3, 0], tail: 1 })] },
      ko: { frames: [F(1000, { lean: 0.75, crouch: 8, jaw: 0.35, hurt: true, tail: 1, footF: [4, 0], footB: [-4, 0], ko: true })] },
      kneel: { frames: [F(1000, { lean: 0.35, crouch: 4, footF: [3, 0], footB: [-4, 0] })] },
      victory: { loop: true, frames: [F(300, { lean: -0.45, jaw: 1, tail: 1 }), F(300, { lean: -0.5, jaw: 0.8, bob: -1, tail: -1 })] },
    },
    draw(g0, J, view, p) {
      const b = base(p, J);
      const g = scaled(g0, b.x, b.y, 1.35);
      const se = view === 'se';
      const L = b.lean, dip = b.dip, tw = p.tail || 0;
      const X = b.x, Y = b.y;
      const ff = p.footF || [0, 0], fb = p.footB || [0, 0];
      // Hip and body centre.
      const hx = X - 7, hy = Y - 16 + dip;
      // Tail sweeping back and down to the left, swaying with `tail`.
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const x = hx - 4 - t * 16;
        const y = hy - 2 + t * 4 - Math.sin(t * PI) * 5 + t * t * tw * 3;
        g.ell(x, y, 5.5 * (1 - t) + 0.6, 4.5 * (1 - t) + 0.6, 't');
      }
      // Far leg.
      const leg = (sx, sy, fx, lift, T) => {
        const kx = sx + 3, ky = sy + 7;
        const ax = X + fx - 1, ay = Y - 3 - lift;
        g.ell(sx, sy, 5, 6, T);
        g.capsule(sx + 1, sy + 3, kx, ky, 3, T);
        g.capsule(kx, ky, ax, ay, 2.2, T);
        g.rect(R(ax - 3), R(ay + 1), R(ax + 4), R(ay + 3), T);
        g.px(ax + 5, ay + 3, 'x');
        g.px(ax + 2, ay + 3, 'x');
      };
      leg(hx - 3, hy + 2, fb[0] - 5, fb[1] || 0, 'f');
      // Body: a heavy barrel tilting up toward the chest.
      const [nx, ny] = [hx + 10 + L * 3, hy - 7 + L * 4]; // neck base
      g.ell(hx + 2, hy - 1, 11, 8.5, 'a');
      g.ell(nx - 3, ny + 2, 6.5, 6.5, 'a');
      // Neck + head, rotating with lean around the neck base.
      const P = (dx, dy) => { const [rx, ry] = rot(dx, dy, L * 0.9); return [nx + rx, ny + ry]; };
      g.capsule(...P(0, 0), ...P(5, -9), 4.2, 'a');
      if (se) {
        // Belly plates from throat to groin.
        g.capsule(...P(3, -6), ...P(2, 2), 2.2, 'u');
        g.ell(hx + 5, hy + 1, 5, 5, 'u');
        for (let k = 0; k < 4; k++) g.line(hx + 1 + k * 2.5, hy + 4 - k * 2.2, hx + 6 + k * 2.5, hy + 2 - k * 2.2, 'U');
      }
      // Back stripes and ridge spikes.
      for (const [dx, dy] of [[-7, -7], [-2, -8], [3, -8]]) g.line(hx + dx, hy + dy, hx + dx + 1, hy + dy + 5, 's');
      for (const [dx, dy] of [[-12, -5], [-7, -8], [-2, -9], [3, -9]]) g.spike(hx + dx, hy + dy + 1, hx + dx - 1, hy + dy - 3, 3, 's');
      // Head: heavy skull; the lower jaw hinges open with `jaw`.
      const jaw = p.jaw || 0;
      const hing = P(7, -12);
      const ja = -jaw * 0.7; // jaw drops (rotates clockwise from the head axis)
      const J2 = (dx, dy) => { const [rx, ry] = rot(dx, dy, L * 0.9 - ja); return [hing[0] + rx, hing[1] + ry]; };
      const H = (dx, dy) => { const [rx, ry] = rot(dx, dy, L * 0.9); return [hing[0] + rx, hing[1] + ry]; };
      J.rim = g.T(...H(15, 0));
      // Mouth interior (visible when open).
      if (jaw > 0.1) g.poly([H(0, 0), H(14, 0), J2(14, 1), J2(0, 1)], 'm');
      g.poly([J2(-1, -1), J2(13, 0), J2(13, 2.5), J2(3, 4), J2(-2, 2)], 'j');
      if (jaw > 0.1) for (let i = 3; i <= 12; i += 3) g.px(...J2(i, -0.5), 'w');
      if (jaw > 0.5) g.capsule(...J2(3, 0.5), ...J2(9, 0), 0.8, 'r');
      // Upper skull.
      g.poly([H(-4, -7), H(4, -9), H(12, -6), H(16, -3), H(16, 0), H(0, 1), H(-4, 0)], 'h');
      g.ell(...H(1, -4), 5, 4.5, 'h');
      if (se) {
        for (let i = 4; i <= 14; i += 3) g.px(...H(i, 1), 'w');
        // Eye under a heavy brow, nostril.
        const [ex, ey] = H(4, -5);
        g.line(ex - 2, ey - 2, ex + 2, ey - 2, 's');
        if (p.hurt) g.line(ex - 1, ey, ex + 1, ey - 1, 'e');
        else {
          g.rect(R(ex - 1), R(ey - 1), R(ex), R(ey), 'E');
          g.px(ex, ey, 'e');
        }
        g.px(...H(14, -4), 's');
        // Glowing throat for the fire breath.
        if (p.glow) g.ell(...P(3, -6), 1.5 + p.glow * 0.5, 1.5 + p.glow * 0.5, 'd');
      } else {
        g.line(...H(-3, -6), ...H(8, -8), 's');
      }
      // Tiny arm.
      if (se) {
        const [ax, ay] = P(5, -3);
        g.capsule(ax, ay, ax + 3, ay + 3, 1, 'c');
        g.px(ax + 4, ay + 4, 'x');
      }
      // Near leg: huge thigh.
      leg(hx + 3, hy + 3, ff[0] + 4, ff[1] || 0, 'c');
    },
  });

  // =========================================================================================
  // LAVOS SPROUTS — miniature Lavos: domed shell bristling with bone spikes, red beak
  // =========================================================================================
  function sprout(k) {
    const W = 12 * k, H = 17 * k;
    return {
      portrait: k > 1 ? { x: 32, y: 34, side: 30 } : { x: 32, y: 40, side: 22 },
      rimAt,
      koRotate: false,
      pal: {
        a: '#5a4a44', b: '#7a665a', c: '#3e3230', s: '#3e3230', x: '#fff0dc', X: '#c0aa92', Y: '#fce068',
        r: '#d43c3c', R: '#f06c4c', m: '#1a1226', e: '#fce068', l: '#2a2038',
      },
      detail: 'emsY',
      magic: '#f06c4c',
      anims: {
        idle: { loop: true, frames: [F(520, { open: 0.3 }), F(520, { open: 0.5, sq: 1, glow: 1 })] },
        walk: {
          loop: true,
          frames: [F(130, { sq: 2, open: 0.2 }), F(130, { sq: -1, y: -2, open: 0.6 }), F(130, { sq: -1, y: -3, open: 0.7 }), F(130, { sq: 0, y: -1, open: 0.4 })],
        },
        attack: {
          frames: [
            F(170, { sq: 2, lean: -0.15, open: 0.1, glow: 1 }),
            F(80, { sq: -2, lean: 0.3, x: 3, y: -2, open: 1, jaw: 1, glow: 2 }),
            F(180, { sq: 2, lean: 0.25, x: 4, open: 0.9, jaw: 1 }),
            F(150, { sq: 0, x: 1, open: 0.4 }),
          ],
        },
        cast: {
          frames: [
            F(170, { sq: 2, open: 0, glow: 1 }),
            F(170, { sq: 1, open: 0.2, glow: 2 }),
            F(300, { sq: -2, y: -2, open: 1, glow: 2, jaw: 1 }),
          ],
          charge: [0, 1], release: 2, rim: true,
        },
        shoot: { frames: [F(150, { sq: 2, open: 0.2, glow: 1 }), F(150, { sq: -1, open: 1, jaw: 1, glow: 2 })] },
        hurt: { frames: [F(300, { sq: -1, lean: -0.25, x: -2, open: 0.9, hurt: true, jaw: 1 })] },
        ko: { frames: [F(1000, { sq: 4, open: 0, lean: 0.1, hurt: true, ko: true })] },
        kneel: { frames: [F(1000, { sq: 3, open: 0 })] },
        victory: { loop: true, frames: [F(260, { sq: -1, open: 1, glow: 2 }), F(260, { sq: 1, open: 0.5, glow: 1 })] },
      },
      draw(g, J, view, p) {
        const b = base(p, J);
        const se = view === 'se';
        const sq = b.sq * k * 0.8, L = b.lean;
        const rx = W + sq * 0.6, ry = H - sq;
        const cx = b.x - 0.5, by = b.y - 2;
        const open = p.open || 0;
        // Shear with lean: higher points shift further.
        const sh = (x, y) => x + (by - y) * L * 0.6;
        // Dome, two plate tones.
        for (let y = Math.floor(by - ry); y <= by; y++)
          for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
            const x0 = x - (by - y) * L * 0.6;
            const dx = (x0 - cx) / rx, dy = (y - by) / ry;
            const d = dx * dx + dy * dy;
            if (d > 1) continue;
            g.px(x, y, d < 0.45 ? 'b' : 'a');
          }
        // Plate ridges.
        for (let i = 1; i < 6; i++) {
          const t = (PI * i) / 6;
          const x0 = cx - Math.cos(t) * rx * 0.35, y0 = by - Math.sin(t) * ry * 0.35;
          const x1 = cx - Math.cos(t) * rx * 0.92, y1 = by - Math.sin(t) * ry * 0.92;
          g.line(sh(x0, y0), y0, sh(x1, y1), y1, 's');
        }
        // Spikes in rings, larger toward the crown; `open` extends them.
        const len0 = (p.ko ? 2 : 4) * k + open * 3 * k;
        const rings = k > 1.2 ? [[1.0, 7, 1, 2.8], [0.55, 2, 0.9, 2.6]] : [[1.0, 5, 1, 3.2]];
        const tip = p.glow > 1 ? 'Y' : 'x';
        for (const [r, n, lm, w] of rings)
          for (let i = 0; i < n; i++) {
            const t = PI * (0.1 + (0.8 * i) / Math.max(1, n - 1)) + (se ? 0 : 0.05);
            const ox = cx - Math.cos(t) * rx * r * 0.95, oy = by - Math.sin(t) * ry * r * 0.95;
            const nx = -Math.cos(t) * (rx / ry), ny = -Math.sin(t);
            const nl = Math.hypot(nx, ny);
            const len = len0 * lm;
            const tx = ox + (nx / nl) * len, ty = oy + (ny / nl) * len;
            g.spike(sh(ox, oy), oy, sh(tx, ty), ty, w * k, r > 0.9 ? 'X' : 'x');
            if (p.glow > 1) g.px(sh(tx, ty), ty, tip);
          }
        // Crown spike.
        const ct = by - ry + 1, cl = (p.ko ? 2 : 5 + open * 3) * k;
        J.rim = [sh(cx, ct - cl), ct - cl];
        g.spike(sh(cx, ct), ct, sh(cx, ct - cl), ct - cl, 3.5 * k, 'x');
        if (p.glow > 1) g.px(sh(cx, ct - cl), ct - cl, 'Y');
        // Flared base rim.
        g.rect(R(cx - rx), by - 1, R(cx + rx), by + 1, 'c');
        if (p.ko) {
          // Dead shell: split by jagged cracks.
          const ty = by - ry;
          g.line(sh(cx - 1, ty + 2), ty + 2, sh(cx + 2, ty + ry * 0.4), ty + ry * 0.4, 'm');
          g.line(sh(cx + 2, ty + ry * 0.4), ty + ry * 0.4, sh(cx - 2, by - 3), by - 3, 'm');
          g.line(sh(cx + 2, ty + ry * 0.4), ty + ry * 0.4, sh(cx + rx * 0.6, by - ry * 0.3), by - ry * 0.3, 'm');
        }
        if (se) {
          const kb = Math.max(k, 1.25); // the small sprout's beak stays chunky enough to read
          // Hooked red beak on the facing side; eyes above it glow.
          const bx = sh(cx + rx * 0.45, by - 4 * kb), bY = by - 4 * kb;
          const jaw = p.jaw ? 1.5 * kb : 0;
          g.poly([[bx - 1 * kb, bY + 1 * kb + jaw], [bx + 5 * kb, bY + 2 * kb + jaw], [bx + 1 * kb, bY + 3.5 * kb + jaw]], 'R');
          g.poly([[bx - 3 * kb, bY - 2 * kb], [bx + 3 * kb, bY - 3 * kb], [bx + 7 * kb, bY - 0.5 * kb], [bx + 7 * kb, bY + 3 * kb], [bx + 5 * kb, bY + 1.5 * kb], [bx - 3 * kb, bY + 1.5 * kb]], 'r');
          if (jaw) g.line(bx - 1 * kb, bY + 1.5 * kb, bx + 4.5 * kb, bY + 2 * kb + jaw * 0.5, 'm');
          else g.line(bx - 2 * kb, bY + 1 * kb, bx + 5 * kb, bY + 2 * kb, 'm');
          const ey = bY - 5 * kb, eyeC = p.hurt ? 'm' : 'e';
          for (const dx of [-2, 1.5, 5]) g.rect(R(bx + dx * kb), R(ey), R(bx + dx * kb), R(ey + (p.glow ? 1 : 0)), eyeC);
        } else {
          // Back: a central ridge.
          g.line(sh(cx, by - ry + 2), by - ry + 2, cx, by - 2, 's');
        }
      },
    };
  }
  define('lavos_sprout', sprout(1));
  define('lavos_sprout_large', sprout(1.55));

  // =========================================================================================
  // VITRINE SENTINEL — a walking glass display case on porcelain legs, a skeleton inside
  // =========================================================================================
  // Drawn as a true isometric box: SE shows the front (right) and left side, NE the back
  // (left) and right side. The skeleton is painted only onto glass pixels, so it stays inside.
  define('vitrine', {
    portrait: { x: 30, y: 25, side: 24 },
    rimAt,
    koRotate: false,
    pal: {
      G: '#3c64b4', H: '#2c4488', w: '#6e4222', W: '#4a2a16', c: '#94602e', C: '#6e4222', t: '#bc8844',
      y: '#f8bc3c', Y: '#c05c1c', X: '#c4e4ff', x: '#ffffff', b: '#e4e8f0', B: '#9294b0', j: '#1a1226',
      p: '#bcc0d4', P: '#e4e8f0', g: '#8cc0f0', n: '#fce068',
    },
    detail: 'XxBjgnyY',
    magic: '#8cc0f0',
    anims: {
      idle: { loop: true, frames: [F(620, { armF: [0.2, 0], armB: [-0.2, 0] }), F(620, { bob: 1, nod: 1, armF: [0.25, 0], armB: [-0.25, 0] })] },
      walk: {
        loop: true,
        frames: [
          F(180, { footF: [2, 0], footB: [-1, 2], lean: -0.05, y: -1 }),
          F(180, { footF: [1, 0], footB: [0, 0], bob: 1 }),
          F(180, { footF: [-1, 2], footB: [2, 0], lean: 0.05, y: -1 }),
          F(180, { footF: [0, 0], footB: [1, 0], bob: 1 }),
        ],
      },
      attack: {
        frames: [
          F(200, { lean: -0.12, crouch: 1, x: -1, armF: [2.6, 0], armB: [2.4, 0], footF: [0, 0], footB: [-1, 0] }),
          F(80, { lean: 0.3, x: 3, y: -1, armF: [1.7, 0], armB: [1.5, 0], footF: [2, 0], footB: [-1, 2], jaw: 1 }),
          F(200, { lean: 0.35, x: 4, crouch: 2, armF: [1.5, 0], armB: [1.4, 0], footF: [3, 0], footB: [0, 0], jaw: 1 }),
          F(160, { lean: 0.08, x: 1, armF: [0.3, 0], armB: [-0.3, 0] }),
        ],
      },
      cast: {
        frames: [
          F(170, { armF: [2.8, 0], armB: [2.7, 0], crouch: 1 }),
          F(170, { armF: [2.9, 0], armB: [2.8, 0], y: -1 }),
          F(260, { lean: 0.1, armF: [1.8, 0], armB: [1.7, 0], jaw: 1 }),
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      shoot: { frames: [F(150, { lean: -0.05, armF: [1.6, 0], armB: [1.4, 0] }), F(150, { lean: -0.1, x: -1, armF: [1.9, 0], armB: [1.6, 0], jaw: 1 })] },
      hurt: { frames: [F(320, { lean: -0.18, x: -2, armF: [2.4, 0], armB: [-0.4, 0], nod: 2, hurt: true })] },
      ko: { frames: [F(1000, { crouch: 3, lean: 0.14, nod: 5, armF: [0.1, 0], armB: [-0.1, 0], hurt: true, ko: true })] },
      kneel: { frames: [F(1000, { crouch: 3, nod: 2 })] },
      victory: { loop: true, frames: [F(300, { armF: [2.9, 0], armB: [-0.2, 0], y: -2 }), F(300, { armF: [2.6, 0], armB: [-0.2, 0], bob: 1 })] },
    },
    draw(g, J, view, p) {
      const b = base(p, J);
      const se = view === 'se';
      const L = b.lean;
      const U = se ? [1, -0.5] : [-1, -0.5], V = se ? [-1, -0.5] : [1, -0.5];
      const wu = 16, wv = 9, Hh = 27;
      const legH = 3 - Math.min(2, b.dip);
      const C0 = [b.x + (se ? -4 : 4), b.y - legH];
      const P = (u, v, h) => [C0[0] + U[0] * u + V[0] * v + L * h, C0[1] + U[1] * u + V[1] * v - h];
      const quad = (a, c, d, e, l) => g.poly([a, c, d, e], l);
      const faceU = (h0, h1, l) => quad(P(0, 0, h0), P(wu, 0, h0), P(wu, 0, h1), P(0, 0, h1), l); // wide face
      const faceV = (h0, h1, l) => quad(P(0, 0, h0), P(0, wv, h0), P(0, wv, h1), P(0, 0, h1), l); // narrow face
      const ff = p.footF || [0, 0], fb = p.footB || [0, 0];
      // Stubby porcelain legs with ball feet (far one first).
      const leg = (u, v, f, l) => {
        const [x, y] = P(u, v, 0);
        const fx = x + f[0], fy = b.y - (f[1] || 0);
        g.capsule(x, y, fx, fy - 1, 2, l);
        g.ell(fx + 0.5, fy - 0.5, 2.5, 1.5, l);
        g.px(x, y + 1, 'g');
      };
      leg(wu - 3, wv - 1, fb, 'p');
      leg(2, wv - 2, fb, 'p');
      leg(wu - 3, 1, ff, 'P');
      leg(2, 1, ff, 'P');
      // Plinth, glass, cornice and top.
      faceU(0, 5, 'w');
      faceV(0, 5, 'W');
      faceU(5, Hh - 3, 'G');
      faceV(5, Hh - 3, 'H');
      faceU(Hh - 3, Hh, 'c');
      faceV(Hh - 3, Hh, 'C');
      g.poly([P(0, 0, Hh), P(wu, 0, Hh), P(wu, wv, Hh), P(0, wv, Hh)], 't');
      J.rim = P(wu / 2, wv / 2, Hh + 2);
      // Skeleton, masked to the glass.
      const sk = new CT.PX.Grid(g.w, g.h);
      const [sx0, sy0] = P(wu / 2, wv / 2, 5);
      const sx = sx0, sy = sy0 + 1;
      const tilt = L * 14, nod = p.nod || 0;
      const hx = sx + tilt + (se ? 1 : 0), hy = sy - 19 + nod;
      // Legs, pelvis, spine, ribs.
      sk.line(sx - 2, sy - 6, sx - 3, sy, 'b');
      sk.line(sx + 2, sy - 6, sx + 3, sy, 'b');
      sk.ell(sx + tilt * 0.3, sy - 7, 3, 1.3, 'b');
      sk.line(sx + tilt * 0.35, sy - 8, hx - (se ? 1 : 0), hy + 3, 'B');
      for (let i = 0; i < 4; i++) {
        const ry = sy - 14 + i * 2 + nod * 0.5, rx = sx + tilt * (0.6 - i * 0.08);
        sk.line(rx - 3.5 + i * 0.3, ry, rx + 3.5 - i * 0.3, ry, 'b');
      }
      // Arms from the shoulders, driven by armF / armB.
      const aF = p.armF || [0.2, 0], aB = p.armB || [-0.2, 0];
      const arm = (side, a) => {
        const shx = sx + tilt * 0.7 + side * 4, shy = sy - 15 + nod * 0.5;
        const d = dir(a[0]);
        const ex = shx + d.x * 4 * (se ? 1 : -1) * (side > 0 ? 1 : 1), ey = shy + d.y * 4;
        const hx2 = ex + d.x * 4 * (se ? 1 : -1), hy2 = ey + d.y * 4;
        sk.line(shx, shy, ex, ey, 'b');
        sk.line(ex, ey, hx2, hy2, 'B');
        sk.px(hx2, hy2, 'b');
      };
      arm(-1, aB);
      arm(1, aF);
      // Skull.
      sk.ell(hx, hy, 3.2, 3, 'b');
      sk.rect(R(hx - 1), R(hy + 2), R(hx + 2), R(hy + 3 + (p.jaw ? 1 : 0)), 'b');
      if (se) {
        sk.px(hx, hy, 'j');
        sk.px(hx + 2, hy, 'j');
        sk.px(hx + 1, hy + 1, 'B');
        if (p.jaw) sk.line(hx - 1, hy + 3, hx + 2, hy + 3, 'j');
      } else sk.line(hx - 1, hy - 2, hx + 1, hy - 2, 'B');
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          const c = sk.a[y][x];
          if (c !== '.' && (g.a[y][x] === 'G' || g.a[y][x] === 'H')) g.a[y][x] = c;
        }
      // Brass frame on the glass edges.
      g.line(...P(0, 0, 5), ...P(0, 0, Hh - 3), 'y');
      g.line(...P(wu, 0, 5), ...P(wu, 0, Hh - 3), 'Y');
      g.line(...P(0, wv, 5), ...P(0, wv, Hh - 3), 'Y');
      // Reflection streaks across the wide pane (drawn in its plane).
      for (const [u0, h0, u1, h1] of [[2, 10, 6, 20], [3, 8, 8, 18], [10, 7, 12, 11]]) g.line(...P(u0, 0, h0), ...P(u1, 0, h1), 'X');
      if (p.ko) {
        // Shattered: a starburst across both panes, shards on the floor.
        for (const [u1, h1] of [[4, 22], [15, 20], [14, 8], [2, 9], [8, 24]]) g.line(...P(9, 0, 15), ...P(u1, 0, h1), 'x');
        g.line(...P(0, 3, 8), ...P(0, 6, 20), 'x');
        for (const [dx, c] of [[-9, 'X'], [-6, 'x'], [9, 'X'], [12, 'x'], [5, 'X']]) g.px(b.x + dx, b.y, c);
      }
      if (p.hurt) {
        // Cracks.
        g.line(...P(9, 0, 16), ...P(11, 0, 20), 'x');
        g.line(...P(9, 0, 16), ...P(12, 0, 13), 'x');
        g.line(...P(9, 0, 16), ...P(7, 0, 12), 'x');
      }
      // Brass plaque on the plinth front, a glow seam along the base.
      if (se) g.line(...P(5, 0, 2.5), ...P(9, 0, 2.5), 'n');
      g.line(...P(0, 0, 5), ...P(wu, 0, 5), 'g');
    },
  });

  // =========================================================================================
  // THE CURATOR (VESPER), phase 1 — tall porcelain docent in a dead-grey long coat,
  // a lattice of blue light where the coat hangs open, one vertical slit eye
  // =========================================================================================
  const CUR_PAL = {
    Q: '#e4e8f0', P: '#e4e8f0', R: '#bcc0d4', t: '#52526e', T: '#3a3a52', C: '#6e7090', d: '#6e7090', D: '#52526e',
    j: '#1c2c5c', L: '#5c90dc', g: '#8cc0f0', G: '#c4e4ff', y: '#bcc0d4', Y: '#9294b0', f: '#2a2038',
    r: '#a02030', o: '#f06c4c', O: '#fce068', W: '#fff4b0', m: '#6c1422', k: '#3c0a14',
  };
  const CUR_ARMS = { armF: [1.0, 1.0], armB: [-0.1, 0.2] };
  define('curator_p1', {
    // Solved at 1x proportions and drawn magnified (see scaled()).
    body: { leg: 17, torso: 12, neck: 3, headR: 5, shoulder: 5, upper: 8, fore: 7, hipW: 2, stance: 3 },
    size: 76,
    portrait: { x: 38, y: 19, side: 26 },
    rimAt,
    pal: CUR_PAL,
    detail: 'LgGYfj',
    magic: '#8cc0f0',
    anims: {
      idle: { loop: true, frames: [F(700, { ...CUR_ARMS }), F(700, { ...CUR_ARMS, armF: [1.05, 0.9], bob: 1, tilt: 1 })] },
      walk: {
        loop: true,
        frames: [
          F(180, { ...CUR_ARMS, footF: [2, 0], footB: [-2, 0] }),
          F(180, { ...CUR_ARMS, footF: [0, 0], footB: [1, 1], bob: -1 }),
          F(180, { ...CUR_ARMS, footF: [-2, 0], footB: [2, 0] }),
          F(180, { ...CUR_ARMS, footF: [1, 1], footB: [0, 0], bob: -1 }),
        ],
      },
      attack: {
        frames: [
          F(180, { lean: -0.1, armF: [2.7, 0.3], armB: [-0.3, 0.3], tilt: -1 }),
          F(80, { lean: 0.25, x: 3, armF: [1.3, -0.3], armB: [-0.5, 0.3], footF: [3, 0], footB: [-2, 0], tilt: 1 }),
          F(200, { lean: 0.25, x: 3, armF: [0.6, -0.1], armB: [-0.5, 0.3], footF: [3, 0], footB: [-2, 0], tilt: 1 }),
          F(160, { lean: 0.05, x: 1, ...CUR_ARMS }),
        ],
      },
      cast: {
        frames: [
          F(180, { armF: [2.6, -0.3], armB: [2.4, -0.3], tilt: -1, nod: -1, glow: 1 }),
          F(180, { armF: [2.7, -0.4], armB: [2.5, -0.4], tilt: -1, nod: -1, y: -1, glow: 2 }),
          F(300, { lean: 0.1, armF: [1.7, -0.1], armB: [1.5, 0], tilt: 1, glow: 2 }),
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      shoot: { frames: [F(160, { armF: [1.6, 0], armB: [-0.1, 0.2], glow: 1 }), F(160, { lean: -0.1, armF: [1.75, -0.1], armB: [-0.1, 0.2], glow: 2 })] },
      hurt: { frames: [F(320, { lean: -0.25, x: -2, armF: [-0.4, 0.4], armB: [0.8, 0.5], tilt: -1, nod: 1, hurt: true })] },
      ko: { frames: [F(1000, { lean: -0.1, crouch: 4, armF: [0.1, 0.1], armB: [0.1, 0.1], nod: 2, hurt: true, ko: true })] },
      kneel: { frames: [F(1000, { lean: 0.3, crouch: 6, footF: [3, 0], footB: [-4, 0], armF: [0.5, 0.6], armB: [0.2, 0.4], nod: 1 })] },
      victory: { loop: true, frames: [F(400, { armF: [2.0, -0.2], armB: [-1.2, 0.2], glow: 2 }), F(400, { armF: [2.1, -0.2], armB: [-1.3, 0.2], y: -1, glow: 1 })] },
    },
    draw(g0, J, view, p) {
      const g = scaled(g0, J.root.x, J.root.y, 1.35);
      const se = view === 'se';
      const c = J.chest, h = J.hip, rt = J.root, L = J.lean;
      J.rim = g.T((J.handF.x + J.handB.x) / 2, Math.min(J.handF.y, J.handB.y) - 1);
      const eye = p.hurt ? 'j' : p.glow > 1 ? 'G' : 'g';
      const ff = p.footF || [0, 0], fb = p.footB || [0, 0];
      // Long porcelain fingers fanning from a hand along the forearm.
      const fingers = (el, hd, n) => {
        const dx = hd.x - el.x, dy = hd.y - el.y, l = Math.hypot(dx, dy) || 1;
        const ux = dx / l, uy = dy / l;
        for (let i = 0; i < n; i++) {
          const s = (i - (n - 1) / 2) * 0.35;
          const fx = ux * Math.cos(s) - uy * Math.sin(s), fy = ux * Math.sin(s) + uy * Math.cos(s);
          g.line(hd.x, hd.y, hd.x + fx * 5, hd.y + fy * 5, 'P');
        }
        g.ell(hd.x, hd.y, 1.3, 1.3, 'P');
      };
      const arm = (sh, el, hd, S) => {
        g.capsule(sh.x, sh.y, el.x, el.y, 2, S);
        g.capsule(el.x, el.y, hd.x - (hd.x - el.x) * 0.2, hd.y - (hd.y - el.y) * 0.2, 1.8, S);
      };
      // Porcelain feet under the hem.
      g.rect(R(J.footB.x - 1), rt.y - 2 - (fb[1] || 0), R(J.footB.x + 2), rt.y - (fb[1] || 0), 'R');
      g.rect(R(J.footF.x - 1), rt.y - 2 - (ff[1] || 0), R(J.footF.x + 2), rt.y - (ff[1] || 0), 'R');
      // Far arm.
      if (se) {
        arm(J.shB, J.elB, J.handB, 'D');
        fingers(J.elB, J.handB, 3);
      } else {
        arm(J.shF, J.elF, J.handF, 'd');
        fingers(J.elF, J.handF, 3);
      }
      // Coat: narrow shoulders falling to a wide hem that sways with the steps.
      const sway = ((ff[0] || 0) + (fb[0] || 0)) * 0.4 + (p.x || 0) * -0.3;
      const hemY = rt.y - 2;
      g.poly([[c.x - 4.5, c.y - 1], [c.x + 4.5, c.y - 1 + L * 4], [rt.x + 9 + sway, hemY], [rt.x - 9 + sway, hemY]], 'T');
      g.poly([[c.x - 1, c.y - 1], [c.x + 4.5, c.y - 1 + L * 4], [rt.x + 9 + sway, hemY], [rt.x + 1 + sway, hemY]], 't');
      if (se) {
        // Open front: a porcelain-plated lattice chest.
        g.poly([[c.x, c.y], [c.x + 4, c.y + L * 3], [h.x + 3, h.y + 5], [h.x + 1, h.y + 5]], 'j');
        for (let i = 0; i < 3; i++) {
          const t = (i + 0.5) / 3.3;
          g.ell(c.x + 2 + (h.x - c.x) * t, c.y + 1 + (h.y + 4 - c.y) * t, 1.4, 1.6, 'Q');
        }
        for (let i = 1; i < 6; i++) {
          const t = i / 6;
          g.px(c.x + 1 + (h.x - c.x) * t, c.y + (h.y + 4 - c.y) * t, 'L');
          g.px(c.x + 3 + (h.x - c.x) * t, c.y + 1 + (h.y + 4 - c.y) * t, i % 2 ? 'L' : 'j');
        }
        g.line(c.x - 1, c.y, h.x, h.y + 6, 'C');
        g.line(h.x + 2, h.y + 6, rt.x + 3 + sway, hemY - 1, 'f');
        // Docent's badge.
        g.rect(R(c.x - 3), R(c.y + 3), R(c.x - 2), R(c.y + 4), 'y');
      } else {
        g.line(c.x - 0.5, c.y, rt.x - 0.5 + sway, hemY - 1, 'f');
        g.line(h.x - 3, h.y + 2, rt.x - 6 + sway, hemY - 1, 'C');
      }
      // Shoulder plates.
      g.ell(J.shB.x, J.shB.y - 0.5, 2.3, 1.6, 'R');
      g.ell(J.shF.x, J.shF.y - 0.5, 2.3, 1.6, 'Q');
      g.px(J.shF.x, J.shF.y - 0.5, 'L');
      // High collar and lattice neck.
      const n = J.neck;
      g.rect(R(n.x - 1), R(n.y - 1), R(n.x + 1), R(n.y + 2), 'j');
      g.px(n.x, n.y, 'L');
      g.spike(n.x - 3, c.y, n.x - 3.5, n.y - 3, 2.5, 'C');
      g.spike(n.x + 3, c.y + L * 3, n.x + 3.5, n.y - 3, 2.5, 'C');
      // Head: a tall porcelain ovoid split by a seam, one vertical slit eye.
      const H = J.head;
      g.ell(H.x, H.y - 2, 4.2, 7, 'Q');
      if (se) {
        g.line(H.x + 0.5, H.y - 9, H.x, H.y + 4, 'R');
        g.line(H.x + 2, H.y - 5, H.x + 2, H.y + 1, eye);
        g.px(H.x + 2, H.y - 2, p.hurt ? 'j' : 'G');
      } else {
        g.line(H.x, H.y - 9, H.x, H.y + 4, 'j');
        g.line(H.x - 3, H.y - 2, H.x + 3, H.y - 2, 'L');
      }
      // Near arm last, over the coat.
      if (se) {
        arm(J.shF, J.elF, J.handF, 'd');
        fingers(J.elF, J.handF, 4);
      } else {
        arm(J.shB, J.elB, J.handB, 'D');
        fingers(J.elB, J.handB, 4);
      }
    },
  });

  // =========================================================================================
  // THE CURATOR, phase 2 — the Core Exhibit: plates opened like a flower around a
  // screaming knot of Lavos-red energy; split head above, tattered coat below, arms flung
  // =========================================================================================
  // `fl` = [near, far] arm fling angles (0 = hanging, PI/2 = straight out).
  define('curator_p2', {
    size: 76,
    portrait: { x: 38, y: 27, side: 34 },
    rimAt,
    koRotate: false,
    pal: CUR_PAL,
    detail: 'LgGmfk',
    magic: '#f06c4c',
    anims: {
      idle: { loop: true, frames: [F(420, { open: 0.75, glow: 1, fl: [1.1, 1.1] }), F(420, { open: 0.85, glow: 2, y: -1, fl: [1.2, 1.2] })] },
      walk: {
        loop: true,
        frames: [
          F(150, { open: 0.7, y: -1, fl: [1.0, 1.3], glow: 1 }),
          F(150, { open: 0.75, y: -2, fl: [1.2, 1.2], glow: 2 }),
          F(150, { open: 0.7, y: -1, fl: [1.3, 1.0], glow: 1 }),
          F(150, { open: 0.8, y: 0, fl: [1.2, 1.2], glow: 2 }),
        ],
      },
      attack: {
        frames: [
          F(180, { open: 0.35, x: -2, glow: 1, fl: [0.6, 0.6] }),
          F(80, { open: 1, x: 3, y: -1, glow: 2, lean: 0.2, fl: [1.9, 1.5] }),
          F(200, { open: 1, x: 4, glow: 2, lean: 0.2, fl: [1.6, 1.3] }),
          F(160, { open: 0.8, x: 1, glow: 1, fl: [1.2, 1.2] }),
        ],
      },
      cast: {
        frames: [
          F(160, { open: 0.25, glow: 2, fl: [2.4, 2.4] }),
          F(160, { open: 0.35, glow: 1, y: -1, fl: [2.5, 2.5] }),
          F(300, { open: 1, glow: 2, y: -2, fl: [1.5, 1.5] }),
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      shoot: { frames: [F(150, { open: 0.5, glow: 1, fl: [1.2, 1.2] }), F(150, { open: 1, glow: 2, x: -1, fl: [1.6, 1.4] })] },
      hurt: { frames: [F(320, { open: 0.5, x: -2, lean: -0.2, glow: 0, hurt: true, fl: [2.2, 0.6] })] },
      ko: { frames: [F(1000, { open: 0.05, crouch: 5, glow: 0, hurt: true, fl: [0.15, 0.15], ko: true })] },
      kneel: { frames: [F(1000, { open: 0.4, crouch: 3, glow: 0, fl: [0.3, 0.3] })] },
      victory: { loop: true, frames: [F(300, { open: 1, glow: 2, fl: [2.3, 2.3], y: -2 }), F(300, { open: 0.9, glow: 1, fl: [2.1, 2.1], y: -1 })] },
    },
    draw(g0, J, view, p) {
      const b = base(p, J);
      const g = scaled(g0, b.x, b.y, 1.35);
      const se = view === 'se';
      const o = p.open == null ? 0.8 : p.open, gl = p.glow || 0, L = b.lean;
      const cx = b.x + L * 8, cy = b.y - 23 + b.dip;
      const fl = p.fl || [1.2, 1.2];
      J.rim = g.T(cx, cy);
      // Tattered coat hanging below the bloom, hem torn into points.
      const hemY = b.y - (p.y || 0) - 3;
      g.poly([[cx - 6, cy + 6], [cx + 6, cy + 6], [b.x + 11, hemY], [b.x - 11, hemY]], 'T');
      g.poly([[cx, cy + 6], [cx + 6, cy + 6], [b.x + 11, hemY], [b.x + 1, hemY]], 't');
      for (let i = -10; i <= 10; i += 3) g.spike(b.x + i, hemY - 1, b.x + i + (i % 2 ? 1 : -1), hemY + 2 + ((i + 10) % 3 === 0 ? 1 : 0), 2.5, i > 0 ? 't' : 'T');
      g.line(cx - 3, cy + 9, b.x - 5, hemY - 1, 'f');
      g.line(cx + 3, cy + 9, b.x + 5, hemY - 1, 'f');
      // Arms flung wide: sleeves, then porcelain hands with splayed fingers.
      const arm = (side, a, S, n) => {
        const sx = cx + side * 7, sy = cy + 3;
        const d = dir(a);
        const ex = sx + side * d.x * 7, ey = sy + d.y * 7;
        const hx = ex + side * Math.sin(a + 0.3) * 6, hy = ey + Math.cos(a + 0.3) * 6;
        g.capsule(sx, sy, ex, ey, 1.8, S);
        g.capsule(ex, ey, hx, hy, 1.5, S);
        const u = Math.atan2(hy - ey, hx - ex);
        for (let i = 0; i < n; i++) {
          const s = u + (i - (n - 1) / 2) * 0.4;
          g.line(hx, hy, hx + Math.cos(s) * 4.5, hy + Math.sin(s) * 4.5, 'P');
        }
      };
      arm(se ? -1 : 1, fl[1], 'D', 3);
      // Lattice ring behind the petals.
      const rr = 13 + o * 4;
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * PI * 2;
        g.px(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * 0.85, i % 2 ? 'L' : 'j');
      }
      // Porcelain plates opened outward like petals.
      for (let i = 0; i < 8; i++) {
        const t = -PI / 2 + (i / 8) * PI * 2 + PI / 8 + (se ? 0 : 0.2);
        const ex = Math.cos(t), ey = Math.sin(t) * 0.85;
        const r0 = 5, r1 = 11 + o * 8, rm = 7 + o * 5;
        const l = 'QRP'[i % 3];
        g.ell(cx + ex * rm, cy + ey * rm, 4 - Math.abs(ey) * 0.8, 4 - Math.abs(ex) * 0.8, l);
        g.spike(cx + ex * r0, cy + ey * r0, cx + ex * r1, cy + ey * r1, 7, l);
        g.line(cx + ex * (r0 + 3), cy + ey * (r0 + 3), cx + ex * (r1 - 3), cy + ey * (r1 - 3), 'L');
      }
      // Split head riding above the bloom, halves leaning apart, the slit eye burning between.
      const hy = cy - 17 - o * 2, sp = 1.5 + o * 1.5;
      g.rect(R(cx - 1), R(hy + 3), R(cx + 1), R(cy - 8), 'j');
      g.ell(cx - sp, hy, 2.3, 4.2, 'Q');
      g.ell(cx + sp, hy, 2.3, 4.2, 'R');
      g.line(cx, hy - 3, cx, hy + 3, p.hurt ? 'j' : 'g');
      if (!p.hurt) g.px(cx, hy, 'G');
      // The knot of Lavos-red energy, screaming outward.
      const kr = 5 + gl * 0.6;
      if (se || o > 0.3)
        for (let i = 0; i < 12; i++) {
          const t = (i / 12) * PI * 2 + 0.2 + gl * 0.15;
          const len = (i % 2 ? 9 : 7) + gl * 1.2;
          g.spike(cx + Math.cos(t) * 3, cy + Math.sin(t) * 3, cx + Math.cos(t) * len, cy + Math.sin(t) * len * 0.85, 2, 'r');
        }
      if (se) {
        g.ell(cx, cy, kr, kr * 0.9, 'r');
        g.ell(cx, cy, kr - 1.5, kr * 0.9 - 1.5, 'o');
        g.ell(cx, cy, kr - 3, kr * 0.9 - 3, 'O');
        if (gl) g.ell(cx, cy, 1, 1, 'W');
        // Short straight cracks in the outer shell of the knot.
        for (let i = 0; i < 6; i++) {
          const t = (i / 6) * PI * 2 + 0.5;
          g.line(cx + Math.cos(t) * (kr - 1.5), cy + Math.sin(t) * (kr - 1.5) * 0.9, cx + Math.cos(t) * kr, cy + Math.sin(t) * kr * 0.9, 'm');
        }
      } else {
        // From behind: the closed back plates and the lattice spine, the glow leaking round.
        g.ell(cx, cy, 6, 5.5, 'R');
        g.line(cx, cy - 6, cx, cy + 6, 'j');
        g.line(cx - 5, cy, cx + 5, cy, 'L');
      }
      arm(se ? 1 : -1, fl[0], 'd', 4);
    },
  });

})();
