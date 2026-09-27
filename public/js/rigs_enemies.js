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
  const { define, human, RX, RY } = CT.RIG;
  const PI = Math.PI;

  // ---- helpers ---------------------------------------------------------------------------
  const R = Math.round;
  // Monster pose basics: root offset, hip drop, lean, squash.
  function base(p) {
    return {
      x: RX + (p.x || 0),
      y: RY + (p.y || 0),
      dip: (p.bob || 0) + (p.crouch || 0),
      lean: p.lean || 0,
      sq: p.sq || 0,
      hurt: !!p.hurt,
      ko: !!p.ko,
    };
  }
  const dir = (a) => ({ x: Math.sin(a), y: Math.cos(a) }); // angle from straight down, + forward
  // Frame list helper: every frame gets ms.
  const F = (ms, o) => Object.assign({ ms }, o);
  // Fill in anything missing with a gentle default so every standard name exists.
  function anims(o) {
    return o;
  }

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
      front(g, J) {
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
      ko: { frames: [F(1000, { sq: 4, armF: [0.2, 0], armB: [-0.2, 0], ko: true })] },
      kneel: { frames: [F(1000, { sq: 3, lean: 0.15, armF: [0.3, 0], armB: [-0.3, 0] })] },
      victory: {
        loop: true,
        frames: [F(220, { sq: 2, armF: [2.6, 0], armB: [-2.6, 0] }), F(220, { sq: -2, y: -6, armF: [2.9, 0], armB: [-2.9, 0], jaw: 1, footF: [1, 1], footB: [-1, 1] })],
      },
    },
    draw(g, J, view, p) {
      const b = base(p);
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

  //@@MORE
  void anims;
})();
