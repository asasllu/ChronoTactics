// Rigged party sprites. Crono is the reference implementation of the
// authoring contract in docs/ART_SPEC.md.
(function () {
  const CT = (window.CT = window.CT || {});
  const { define, human } = CT.RIG;

  // ---- Crono ---------------------------------------------------------------------------
  // Wild red spikes swept back, white headband with trailing tails, blue gi with
  // short sleeves, gold-buckled belt, khaki trousers, katana.
  const CRONO_SPIKES = [
    // [x0, y0, x1, y1, width] relative to the head centre, sweeping up and back
    [-3, -5, -6, -11, 4], [0, -6, 0, -11, 4], [3, -5, 6, -10, 4], [5, -3, 10, -5, 3],
    [-4, -3, -11, -7, 4], [-5, -1, -12, -1, 4], [-5, 2, -11, 5, 4], [-3, 3, -7, 8, 3],
  ];
  define('crono', {
    body: { headR: 5 },
    pal: {
      h: '#d43c3c', H: '#a02030', R: '#f06c4c',
      s: '#f8d0a8', S: '#e0a878', A: '#f8d0a8', a: '#e0a878', F: '#f8d0a8', f: '#e0a878',
      e: '#1a1226', E: '#ffffff', m: '#a02030',
      c: '#3c64b4', C: '#2c4488', v: '#8cc0f0', d: '#3c64b4', D: '#2c4488',
      l: '#6e4222', y: '#f8bc3c', p: '#c0aa92', q: '#9c8674', b: '#6e4222', o: '#4a2a16',
      w: '#e4e8f0', W: '#bcc0d4', x: '#e4e8f0', X: '#9294b0', g: '#2a2038', G: '#f8bc3c',
    },
    detail: 'eEmHRCvX',
    magic: '#fce068', // Crono's lightning
    draw: human({
      sleeves: 'short',
      behind(g, J, view) {
        const H = J.head;
        // Headband tails flutter behind the head.
        const sway = J.pose.bob ? 1 : 0;
        g.capsule(H.x - 5, H.y - 3, H.x - 11, H.y + 2 + sway, 0.9, 'w');
        g.capsule(H.x - 5, H.y - 2, H.x - 9, H.y + 5 + sway, 0.9, 'W');
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip;
        // Belt with a gold buckle, gi lapels on the front.
        g.capsule(h.x - 4, h.y, h.x + 3.5, h.y + J.lean * 3, 0.9, 'l');
        if (view === 'se') {
          g.px(h.x + 2, h.y, 'y');
          g.line(c.x + 1, c.y, c.x + 3, c.y + 3, 'v');
          g.line(c.x + 3, c.y + 3, c.x + 3, h.y - 2, 'C');
        } else g.line(c.x - 1, c.y + 1, h.x - 1, h.y - 2, 'C');
        // Wristband on the near arm.
        g.px(J.handF.x - (J.handF.x - J.elF.x) * 0.35, J.handF.y - (J.handF.y - J.elF.y) * 0.35, 'w');
      },
      face(g, J) {
        const x = Math.round(J.head.x), y = Math.round(J.head.y);
        g.rect(x - 4, y, x - 3, y + 1, 'S'); // ear
        g.px(x, y - 1, 'H'); g.px(x + 3, y - 1, 'H'); g.px(x + 4, y - 1, 'H'); // brows
        g.rect(x, y, x, y + 1, 'e');
        g.rect(x + 3, y, x + 3, y + 1, 'e');
        g.px(x + 4, y, 'E');
        g.px(x + 5, y + 2, 'S'); // nose
        g.px(x + 3, y + 3, J.pose.hurt ? 'e' : 'm');
      },
      hair(g, J, view) {
        const H = J.head, x = H.x, y = H.y;
        // Skull cap and mane: covers the top and back of the head, leaves the face clear.
        g.ell(x - 1, y - 3, 5.5, 3.2, 'h');
        g.ell(x - 4, y - 1, 3.2, 4.2, 'h');
        if (view === 'ne') g.ell(x, y - 1, 5.3, 5.3, 'h');
        for (const [x0, y0, x1, y1, w] of CRONO_SPIKES) g.spike(x + x0, y + y0, x + x1, y + y1, w, 'h');
        if (view === 'se') {
          // Short bangs over the brow.
          for (const [x0, y0, x1, y1, w] of [[0, -4, 0, -2, 2], [2, -4, 3, -2, 2], [4, -4, 5, -2, 2]]) g.spike(x + x0, y + y0, x + x1, y + y1, w, 'h');
        } else {
          for (const [x0, y0, x1, y1, w] of [[-2, 3, -3, 7, 3], [1, 3, 1, 7, 3], [3, 2, 5, 6, 3]]) g.spike(x + x0, y + y0, x + x1, y + y1, w, 'h');
        }
        // Strands and highlights.
        for (const [x0, y0, x1, y1] of [[-3, -5, -5, -9], [0, -6, 0, -9], [-5, -2, -10, -5], [-5, 1, -10, 1]]) g.line(x + x0, y + y0, x + x1, y + y1, 'H');
        for (const [x0, y0, x1, y1] of [[-1, -6, -3, -9], [2, -6, 4, -8]]) g.line(x + x0, y + y0, x + x1, y + y1, 'R');
        // Headband.
        g.line(x - 5, y - 3, x + 4, y - 4, 'w');
        if (view === 'se') g.px(x + 5, y - 3, 'W');
      },
      weapon(g, J) {
        const h = J.handF, d = J.wdir;
        // Hilt behind the hand, gold guard, curved blade along the weapon axis.
        g.capsule(h.x - d.x * 3, h.y - d.y * 3, h.x, h.y, 0.9, 'g');
        g.capsule(h.x + d.x * 1 - d.y * 1.5, h.y + d.y * 1 + d.x * 1.5, h.x + d.x * 1 + d.y * 1.5, h.y + d.y * 1 - d.x * 1.5, 0.6, 'G');
        const L = 14;
        for (let i = 2; i <= L; i++) {
          const bend = (i / L) * (i / L) * 1.2; // slight curve toward the back of the blade
          const bx = h.x + d.x * i - d.y * bend, by = h.y + d.y * i + d.x * bend;
          g.px(bx, by, 'x');
          if (i < L - 1) g.px(bx - d.y, by + d.x, 'X');
        }
      },
    }),
  });
  // ---- Shared helpers ------------------------------------------------------------------
  const perp = (d) => ({ x: -d.y, y: d.x }); // weapon-axis normal (points forward when the axis points up)
  const R = Math.round;

  // ---- Frog ----------------------------------------------------------------------------
  // Amphibian knight: big green frog head with eyes on top and a wide mouth, tan
  // armour with gold trim, lavender cape, green limbs, brown boots, the Masamune.
  // Shorter than the humans and always in a crouched, ready stance.
  const FROG_HEAD_SE = [
    '...sss..sss...',
    '..swwws.swwws.',
    '..swwes.swwes.',
    '.ssssssssssssn',
    'sssssssssssssn',
    'Sssssssssssnm.',
    'Smmmmmmmmmmm..',
    '.Sttttttttt...',
    '..StttttttS...',
  ];
  const FROG_HEAD_NE = [
    '.sss...sss....',
    'sssss.sssss...',
    'sssssssssss...',
    'ssssssssssssS.',
    'sssssssssssss.',
    'Sssssssssssss.',
    '.SSssssssssS..',
    '...SSSSSSS....',
  ];
  function frogSword(g, J, L) {
    const h = J.handF, d = J.wdir, n = perp(d);
    // Grip, pommel, broad gold guard, then a wide blade with a darker edge and a fuller.
    g.capsule(h.x - d.x * 3, h.y - d.y * 3, h.x, h.y, 0.9, 'g');
    g.px(h.x - d.x * 4, h.y - d.y * 4, 'G');
    for (let k = -2; k <= 2; k++) g.px(h.x + d.x * 1.5 + n.x * k, h.y + d.y * 1.5 + n.y * k, 'G');
    for (let i = 2; i <= L; i++) {
      const bx = h.x + d.x * i, by = h.y + d.y * i;
      g.px(bx, by, 'x');
      if (i < L) g.px(bx + n.x, by + n.y, 'X');
      if (i < L - 1) g.px(bx - n.x, by - n.y, 'x');
    }
    for (let i = 3; i < L - 2; i++) g.px(h.x + d.x * i, h.y + d.y * i, 'v'); // fuller
  }
  function frogCape(g, J, view, pose) {
    const c = J.chest, h = J.hip, sw = pose.bob ? 1 : 0;
    const lift = (pose.lean || 0) * 6 + (pose.x || 0) * 0.6; // lunges throw the cape back
    const knee = Math.max(J.kneeB.y, J.kneeF.y) + 1;
    if (view === 'se') {
      g.poly([[c.x - 3, c.y - 1], [c.x + 2, c.y - 1], [h.x - 1, knee], [h.x - 6 - lift, knee + 1 - sw], [h.x - 8 - lift, knee - 3]], 'r');
      g.line(c.x - 2, c.y + 2, h.x - 5 - lift, knee - 1, 'R');
      g.line(c.x - 1, c.y + 3, h.x - 2 - lift * 0.5, knee, 'R');
    } else {
      g.poly([[c.x - 5, c.y - 1], [c.x + 4, c.y - 1], [h.x + 5, knee], [h.x - 2, knee + 1 - sw], [h.x - 7 - lift, knee - 1]], 'r');
      g.line(c.x - 1, c.y + 2, h.x - 2, knee - 1, 'R');
      g.line(c.x + 2, c.y + 2, h.x + 3, knee - 1, 'R');
    }
  }
  const FROG_IDLE = { crouch: 2, lean: 0.12, footF: [2, 0], footB: [-2, 0], armF: [1.0, 0.7], armB: [-0.2, 0.7], wpn: 0.45 };
  define('frog', {
    body: { leg: 9, torso: 7, neck: 0, headR: 4, shoulder: 3, upper: 4, fore: 4, hipW: 2, stance: 3 },
    pal: {
      s: '#74b43c', S: '#488c34', t: '#d4ec94', n: '#a8d45c', w: '#ffffff', e: '#1a1226', m: '#1c4428',
      A: '#74b43c', a: '#488c34', F: '#74b43c', f: '#488c34', p: '#74b43c', q: '#488c34',
      c: '#dcb468', C: '#94602e', d: '#dcb468', D: '#bc8844', y: '#f8bc3c', l: '#6e4222',
      b: '#6e4222', o: '#4a2a16', r: '#bc84e4', R: '#9450c0', u: '#9450c0',
      x: '#e4e8f0', X: '#9294b0', v: '#c4e4ff', g: '#6e4222', G: '#f8bc3c',
    },
    detail: 'wemCRvn',
    magic: '#8cc0f0', // water
    anims: {
      idle: { loop: true, frames: [{ ms: 480, ...FROG_IDLE }, { ms: 480, ...FROG_IDLE, bob: 1, armF: [0.95, 0.75], wpn: 0.5 }] },
      walk: {
        loop: true,
        frames: [
          { ms: 130, crouch: 2, lean: 0.15, footF: [3, 0], footB: [-3, 0], armF: [0.8, 0.8], armB: [0.3, 0.5], wpn: 0.6 },
          { ms: 130, crouch: 1, lean: 0.15, footF: [0, 0], footB: [1, 3], armF: [1.0, 0.7], armB: [0, 0.5], wpn: 0.5, bob: -1 },
          { ms: 130, crouch: 2, lean: 0.15, footF: [-3, 0], footB: [3, 0], armF: [1.2, 0.6], armB: [-0.3, 0.5], wpn: 0.4 },
          { ms: 130, crouch: 1, lean: 0.15, footF: [1, 3], footB: [0, 0], armF: [1.0, 0.7], armB: [0, 0.5], wpn: 0.5, bob: -1 },
        ],
      },
      // Leap up with the Masamune raised overhead, then a big downward cleave.
      attack: {
        frames: [
          { ms: 150, crouch: 3, lean: -0.1, footF: [2, 0], footB: [-3, 0], armF: [2.8, 0.3], armB: [2.4, 0.4], wpn: -0.9, tilt: -1 },
          { ms: 90, y: -5, lean: -0.2, footF: [2, 3], footB: [-2, 2], armF: [3.1, 0.1], armB: [2.8, 0.2], wpn: -0.2, tilt: -1 },
          { ms: 80, x: 4, crouch: 3, lean: 0.45, footF: [5, 0], footB: [-4, 0], armF: [1.4, 0.1], armB: [1.1, 0.3], wpn: 1.6, tilt: 1 },
          { ms: 170, x: 4, crouch: 4, lean: 0.5, footF: [5, 0], footB: [-4, 0], armF: [0.8, 0.2], armB: [0.5, 0.4], wpn: 2.5, tilt: 1 },
          { ms: 140, x: 1, ...FROG_IDLE },
        ],
      },
      // Water magic: Masamune held upright before the face, then the free hand sweeps out.
      cast: {
        frames: [
          { ms: 160, crouch: 2, lean: -0.05, armF: [1.2, 1.3], armB: [2.2, -0.2], wpn: 0, nod: -1, footF: [2, 0], footB: [-2, 0] },
          { ms: 160, crouch: 1, bob: -1, lean: -0.05, armF: [1.2, 1.35], armB: [2.4, -0.3], wpn: -0.05, nod: -1, footF: [2, 0], footB: [-2, 0] },
          { ms: 260, crouch: 3, lean: 0.3, armF: [0.6, 0.4], armB: [1.6, 0], wpn: 1.2, tilt: 1, footF: [4, 0], footB: [-3, 0] },
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      // Ranged: a straight Masamune thrust (the blade throws the energy).
      shoot: {
        frames: [
          { ms: 150, crouch: 2, lean: -0.1, x: -1, armF: [0.9, 0.9], armB: [-0.5, 0.5], wpn: 1.5, footF: [2, 0], footB: [-3, 0] },
          { ms: 150, crouch: 2, lean: 0.35, x: 2, armF: [1.55, 0], armB: [-0.8, 0.4], wpn: 1.57, footF: [5, 0], footB: [-3, 0], tilt: 1 },
        ],
      },
      hurt: { frames: [{ ms: 300, crouch: 2, lean: -0.4, x: -2, armF: [-0.4, 0.8], armB: [1.0, 0.5], wpn: -0.4, tilt: -1, nod: 1, footF: [1, 0], footB: [-3, 1], hurt: true }] },
      ko: { frames: [{ ms: 1000, lean: -0.2, crouch: 2, armF: [0.2, 0.1], armB: [0.3, 0.1], wpn: 2.4, nod: 1, ko: true }] },
      // One knee down, blade planted point-first in front.
      kneel: { frames: [{ ms: 1000, lean: 0.25, crouch: 4, footF: [3, 0], footB: [-4, 0], armF: [0.9, 0.5], armB: [0.4, 0.6], wpn: 3.14, nod: 1 }] },
      // Masamune thrust to the sky.
      victory: {
        loop: true,
        frames: [
          { ms: 320, crouch: 1, armF: [2.9, 0.15], armB: [-0.3, 0.6], wpn: 0.05, tilt: -1, footF: [2, 0], footB: [-2, 0] },
          { ms: 320, crouch: 0, y: -2, armF: [3.05, 0.05], armB: [-0.4, 0.6], wpn: 0, tilt: -1, footF: [2, 1], footB: [-2, 1] },
        ],
      },
    },
    draw: human({
      sleeves: 'short',
      width: 4,
      face() {},
      behind(g, J, view, pose) {
        if (view === 'se') frogCape(g, J, view, pose);
      },
      legs(g, J) {
        // Webbed toes poke out of the boots.
        g.px(J.footF.x + 3, J.footF.y, 'o');
      },
      torso(g, J, view, pose) {
        const c = J.chest, h = J.hip;
        g.capsule(h.x - 4, h.y, h.x + 3.5, h.y + J.lean * 3, 0.9, 'l');
        if (view === 'se') {
          g.px(h.x + 1, h.y, 'y');
          g.line(c.x + 2, c.y + 1, h.x + 2, h.y - 2, 'C');
          g.line(c.x - 2, c.y + 1, h.x - 2, h.y - 2, 'C');
          // Gold pauldron on the far shoulder.
          g.ell(J.shB.x, J.shB.y, 1.4, 1, 'y');
        } else frogCape(g, J, view, pose);
        // Lavender cape clasp / collar around the neck.
        g.capsule(c.x - 3, c.y - 1, c.x + 3, c.y - 1, 1, 'u');
      },
      hair(g, J, view, pose) {
        const H = J.head;
        if (view === 'se') {
          const rows = pose.hurt ? FROG_HEAD_SE.map((r, j) => (j === 2 ? r.replace(/e/g, 'w') : j === 1 ? r.replace(/www/g, 'wew') : r)) : FROG_HEAD_SE;
          g.stamp(H.x, H.y, 6, 5, rows);
        } else g.stamp(H.x, H.y, 6, 5, FROG_HEAD_NE);
      },
      weapon(g, J) {
        frogSword(g, J, 15);
      },
      front(g, J, view) {
        // Gold pauldron on the near shoulder.
        if (view === 'se') g.ell(J.shF.x, J.shF.y - 0.5, 1.6, 1.1, 'y');
      },
    }),
  });

  // @@PARTY@@
})();
