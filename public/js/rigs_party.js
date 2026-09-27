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
      width: 5,
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
  // Head stamps, anchored at column 7, row 5 (the head joint).
  // s skin, n lit skin, S shade (flat), w eye white, e pupil, m mouth, t pale jaw.
  const FROG_HEAD_SE = [
    '...sss....sss...',
    '..swwws..swwws..',
    '..swwes..swwes..',
    '.snnnnnnnnnnnns.',
    'Sssssssssssssssn',
    'Sssssssssssssssn',
    'SmmssssssssssmmS',
    '.SmmmmmmmmmmmmS.',
    '..Stttttttttt...',
    '...SStttttS.....',
  ];
  const FROG_HURT_SE = FROG_HEAD_SE.map((r, j) => (j === 1 ? r.replace(/www/g, 'wmw') : j === 2 ? r.replace(/wwe/g, 'wmw') : j === 7 ? r.replace(/mmmmmmmmmm/, 'mmmwwwwmmm') : r));
  const FROG_HEAD_NE = [
    '.sss....sss.....',
    'snnns..snnns....',
    'snsssssnssss....',
    'sssssssssssss...',
    'Ssssssssssssss..',
    'Sssssssssssssss.',
    'SSsssssssssssss.',
    '.SSSssssssssSS..',
    '...SSSSSSSSS....',
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
  // Lavender cape: in front view it hangs behind the body and flares back; from
  // behind it covers the back down to the calves.
  function frogCape(g, J, view, pose) {
    const c = J.chest, h = J.hip, sw = pose.bob ? 1 : 0;
    const lift = Math.min(5, Math.max(0, (pose.lean || 0) * 6 + (pose.x || 0) * 0.6)); // lunges throw the cape back
    const hem = J.root.y - 3 - lift * 0.4 + (pose.y || 0);
    if (view === 'se') {
      g.poly([[c.x - 4, c.y - 1], [c.x + 1, c.y - 1], [h.x + 1, hem], [h.x - 5 - lift, hem + 1 - sw], [h.x - 8 - lift * 1.3, hem - 2]], 'r');
      g.line(c.x - 3, c.y + 2, h.x - 6 - lift, hem - 1, 'R');
      g.line(c.x - 1, c.y + 3, h.x - 2 - lift * 0.6, hem, 'R');
    } else {
      g.poly([[c.x - 5, c.y - 1], [c.x + 4, c.y - 1], [h.x + 5, hem], [h.x - 1, hem + 1 - sw], [h.x - 7 - lift, hem - 1]], 'r');
      g.line(c.x - 2, c.y + 2, h.x - 3 - lift * 0.5, hem - 1, 'R');
      g.line(c.x + 2, c.y + 2, h.x + 2, hem - 1, 'R');
      // Gold-trimmed collar across the shoulders.
      g.capsule(c.x - 4, c.y - 1, c.x + 3, c.y - 1, 1, 'u');
    }
  }
  const FROG_IDLE = { crouch: 2, lean: 0.12, footF: [2, 0], footB: [-2, 0], armF: [0.6, 0.8], armB: [-0.2, 0.7], wpn: 0.5 };
  define('frog', {
    body: { leg: 10, torso: 7, neck: 0, headR: 4, shoulder: 3, upper: 4, fore: 4, hipW: 2, stance: 3 },
    pal: {
      s: '#74b43c', S: '#488c34', t: '#a8d45c', n: '#a8d45c', w: '#ffffff', e: '#1a1226', m: '#1c4428',
      A: '#74b43c', a: '#488c34', F: '#74b43c', f: '#488c34', p: '#74b43c', q: '#488c34',
      c: '#dcb468', C: '#94602e', d: '#dcb468', D: '#bc8844', y: '#f8bc3c', l: '#6e4222',
      b: '#6e4222', o: '#4a2a16', r: '#bc84e4', R: '#9450c0', u: '#9450c0',
      x: '#e4e8f0', X: '#9294b0', v: '#c4e4ff', g: '#6e4222', G: '#f8bc3c',
    },
    detail: 'wemCRvnSy',
    magic: '#8cc0f0', // water
    anims: {
      idle: { loop: true, frames: [{ ms: 480, ...FROG_IDLE }, { ms: 480, ...FROG_IDLE, bob: 1, armF: [0.55, 0.85], wpn: 0.55 }] },
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
          { ms: 150, crouch: 4, lean: 0.1, footF: [2, 0], footB: [-3, 0], armF: [2.2, 0.4], armB: [1.9, 0.5], wpn: -0.4, tilt: -1 },
          { ms: 100, y: -6, lean: -0.2, footF: [1, 4], footB: [-3, 2], armF: [2.9, 0.4], armB: [2.7, 0.5], wpn: -0.5, tilt: -1 },
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
      kneel: { frames: [{ ms: 1000, lean: 0.25, crouch: 4, footF: [3, 0], footB: [-4, 0], armF: [1.2, 0.2], armB: [0.4, 0.6], wpn: 3.14, nod: 1 }] },
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
        g.px(J.footB.x + 3, J.footB.y, 'o');
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip;
        g.capsule(h.x - 4, h.y, h.x + 3.5, h.y + J.lean * 3, 0.9, 'l');
        if (view === 'se') {
          g.px(h.x + 1, h.y, 'y');
          // Gold-trimmed breastplate edge and the cape knotted over the far shoulder.
          g.line(c.x - 3, c.y, c.x + 3, c.y + 1, 'y');
          g.line(c.x + 1, c.y + 2, h.x + 1, h.y - 2, 'C');
          g.ell(J.shB.x, J.shB.y - 0.5, 1.6, 1.2, 'r');
        }
      },
      hair(g, J, view, pose) {
        const H = J.head;
        if (view === 'se') g.stamp(H.x, H.y, 7, 5, pose.hurt ? FROG_HURT_SE : FROG_HEAD_SE);
        else g.stamp(H.x, H.y, 7, 5, FROG_HEAD_NE);
      },
      weapon(g, J) {
        frogSword(g, J, 15);
      },
      front(g, J, view, pose) {
        if (view === 'se') {
          // Gold pauldron on the near shoulder.
          g.ell(J.shF.x, J.shF.y - 0.5, 1.6, 1.1, 'y');
        } else {
          // From behind, the cape covers the back; the head sits on top of it.
          frogCape(g, J, view, pose);
          g.stamp(J.head.x, J.head.y, 7, 5, FROG_HEAD_NE);
        }
      },
    }),
  });

  // ---- Ayla ----------------------------------------------------------------------------
  // Cavewoman brawler: huge wild blonde mane, spotted fur top and skirt, bare arms
  // and legs, fur-wrapped feet, fists. Bouncy boxer's stance.
  function aylaMane(g, J, view, pose) {
    const H = J.head, x = H.x, y = H.y;
    const sw = pose.bob ? 1 : 0, fly = Math.min(3, Math.max(-1, (pose.x || 0) * 0.6 + (pose.lean || 0) * 5)); // hair trails when lunging
    const tip = y + 15 - sw;
    if (view === 'se') {
      g.poly([[x - 2, y - 6], [x - 7, y - 4], [x - 9 - fly, y + 3], [x - 10 - fly, y + 10], [x - 8 - fly, tip], [x - 4, y + 12], [x - 2, y + 7], [x - 1, y]], 'h');
      // Ragged ends.
      for (const [x0, y0, x1, y1, w] of [[-9, 8, -12, 12, 3], [-8, 12, -9, 17, 3], [-5, 11, -5, 16, 3], [-8, 0, -12, 1, 3], [-7, -4, -10, -7, 3]])
        g.spike(x + x0 - fly * (y0 > 4 ? 1 : 0.5), y + y0, x + x1 - fly, y + y1 - sw, w, 'h');
    } else {
      g.poly([[x - 5, y - 5], [x + 5, y - 5], [x + 7, y + 3], [x + 6, y + 11], [x + 2, tip], [x - 4, y + 14], [x - 8 - fly, tip - 1], [x - 8 - fly, y + 5], [x - 7, y - 2]], 'h');
      for (const [x0, y0, x1, y1, w] of [[-7, 10, -10 - fly, 16, 3], [-3, 12, -4, 17, 3], [2, 12, 3, 17, 3], [6, 8, 8, 13, 3], [-7, 1, -11 - fly, 2, 3]])
        g.spike(x + x0, y + y0, x + x1, y + y1 - sw, w, 'h');
    }
  }
  function aylaHairBack(g, J, pose) {
    const x = J.head.x, y = J.head.y;
    aylaMane(g, J, 'ne', pose);
    g.ell(x, y - 1, 5.6, 5.4, 'h');
    for (const [x0, y0, x1, y1] of [[-3, 0, -5, 10], [0, 1, 0, 12], [3, 0, 4, 9], [-6, 3, -7, 12]]) g.line(x + x0, y + y0, x + x1, y + y1, 'H');
    for (const [x0, y0, x1, y1] of [[-2, -5, 2, -5], [-4, -3, -4, 0]]) g.line(x + x0, y + y0, x + x1, y + y1, 'R');
    for (const [x0, y0, x1, y1, w] of [[-2, -6, -4, -9, 3], [1, -6, 2, -9, 3], [-5, -4, -8, -6, 3]]) g.spike(x + x0, y + y0, x + x1, y + y1, w, 'h');
  }
  const AYLA_FIST = { armF: [1.0, 1.55], armB: [0.85, 1.65] };
  const AYLA_IDLE = { crouch: 1, lean: 0.08, footF: [2, 0], footB: [-3, 0], ...AYLA_FIST };
  define('ayla', {
    body: { headR: 5, torso: 8, leg: 12 },
    pal: {
      h: '#f8bc3c', H: '#e88c28', R: '#fce068',
      // Skin is flat (detail letters) with hand-placed shade pixels: shaded thin
      // limbs otherwise snap to the grey stone ramp.
      s: '#f8d0a8', S: '#e0a878', A: '#f8d0a8', a: '#e0a878', F: '#f8d0a8', f: '#e0a878',
      d: '#f8d0a8', D: '#e0a878', p: '#f8d0a8', q: '#e0a878', M: '#f8d0a8', T: '#bc7a50',
      e: '#1c4428', E: '#ffffff', m: '#a02030', K: '#bc7a50',
      c: '#bc8844', z: '#bc8844', Z: '#94602e', v: '#6e4222', V: '#dcb468',
      b: '#94602e', o: '#6e4222',
    },
    detail: 'eEmHRvVKsSAaFfdDpqMT',
    magic: '#f8b0c8', // charm
    anims: {
      idle: { loop: true, frames: [{ ms: 360, ...AYLA_IDLE }, { ms: 360, ...AYLA_IDLE, bob: 1, armF: [0.95, 1.65], armB: [0.8, 1.7] }] },
      walk: {
        loop: true,
        frames: [
          { ms: 120, footF: [4, 0], footB: [-4, 0], armF: [0.4, 1.4], armB: [1.0, 1.4], lean: 0.1, bob: 0 },
          { ms: 120, footF: [0, 0], footB: [1, 3], armF: [0.7, 1.5], armB: [0.7, 1.5], lean: 0.1, bob: -1 },
          { ms: 120, footF: [-4, 0], footB: [4, 0], armF: [1.0, 1.4], armB: [0.4, 1.4], lean: 0.1, bob: 0 },
          { ms: 120, footF: [1, 3], footB: [0, 0], armF: [0.7, 1.5], armB: [0.7, 1.5], lean: 0.1, bob: -1 },
        ],
      },
      // Combo: coil, straight punch, high kick, settle.
      attack: {
        frames: [
          { ms: 120, crouch: 2, lean: -0.1, x: -1, armF: [0.2, 2.0], armB: [1.2, 1.4], footF: [1, 0], footB: [-3, 0], tilt: -1 },
          { ms: 90, crouch: 1, lean: 0.35, x: 3, armF: [1.6, 0], armB: [-0.5, 1.6], footF: [6, 0], footB: [-4, 0], tilt: 1 },
          { ms: 170, lean: -0.3, x: 2, armF: [0.6, 1.4], armB: [-0.9, 1.0], footF: [9, 8], footB: [-2, 0], tilt: -1 },
          { ms: 130, x: 1, ...AYLA_IDLE },
        ],
      },
      // Charm: hands clasped at the cheek with a hip sway, then a blown kiss.
      cast: {
        frames: [
          { ms: 170, crouch: 1, hipX: 1, lean: -0.08, armF: [1.3, 1.9], armB: [1.5, 1.7], tilt: 1, footF: [1, 0], footB: [-2, 1] },
          { ms: 170, crouch: 1, hipX: -1, lean: 0.08, armF: [1.4, 1.85], armB: [1.6, 1.65], tilt: 1, bob: -1, footF: [2, 0], footB: [-3, 2] },
          { ms: 260, lean: 0.2, armF: [1.75, -0.15], armB: [-0.5, 0.6], tilt: 1, footF: [3, 0], footB: [-3, 4] },
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      // Ranged: wind up and hurl a rock.
      shoot: {
        frames: [
          { ms: 150, lean: -0.2, x: -1, armF: [2.7, 0.9], armB: [1.3, 0.4], footF: [3, 0], footB: [-3, 0], tilt: -1 },
          { ms: 150, lean: 0.3, x: 2, armF: [1.3, -0.1], armB: [-0.6, 0.8], footF: [5, 0], footB: [-3, 2], tilt: 1 },
        ],
      },
      hurt: { frames: [{ ms: 300, lean: -0.35, x: -2, crouch: 1, armF: [-0.5, 1.3], armB: [0.9, 1.2], tilt: -1, nod: 1, footF: [1, 0], footB: [-3, 0], hurt: true }] },
      kneel: { frames: [{ ms: 1000, lean: 0.3, crouch: 5, footF: [3, 0], footB: [-5, 0], armF: [0.5, 1.0], armB: [0.3, 0.6], nod: 1 }] },
      // Fist pump.
      victory: {
        loop: true,
        frames: [
          { ms: 260, y: -2, armF: [2.3, 0.75], armB: [0.6, 1.8], tilt: -2, footF: [2, 0], footB: [-2, 3] },
          { ms: 260, crouch: 1, armF: [1.9, 1.7], armB: [0.7, 1.7], tilt: -1, footF: [2, 0], footB: [-2, 0] },
        ],
      },
    },
    draw: human({
      sleeves: 'bare',
      width: 4,
      boots: true,
      behind(g, J, view, pose) {
        if (view === 'se') aylaMane(g, J, view, pose);
      },
      legs(g, J, view) {
        const h = J.hip;
        // Hand-shaded near leg (skin is flat).
        g.capsule(J.hipF.x + 0.6, J.hipF.y, J.kneeF.x + 0.6, J.kneeF.y, 1.6, 'T');
        g.capsule(J.kneeF.x + 0.6, J.kneeF.y, J.footF.x + 0.6, J.footF.y - 1, 1.5, 'T');
        g.capsule(J.hipF.x, J.hipF.y, J.kneeF.x, J.kneeF.y, 1.3, 'p');
        g.capsule(J.kneeF.x, J.kneeF.y, J.footF.x, J.footF.y - 1, 1.1, 'p');
        // Fur wraps on the shins.
        for (const [k, f, L] of [[J.kneeB, J.footB, 'o'], [J.kneeF, J.footF, 'b']]) g.capsule(f.x + (k.x - f.x) * 0.35, f.y + (k.y - f.y) * 0.35, f.x, f.y - 1, 1.7, L);
        // Spotted fur skirt with a ragged hem.
        const L = J.lean * 2;
        g.poly([[h.x - 5, h.y - 1], [h.x + 5, h.y - 1 + L], [h.x + 6 + L, h.y + 5], [h.x + 3, h.y + 4], [h.x + 1, h.y + 6], [h.x - 2, h.y + 4], [h.x - 5, h.y + 6], [h.x - 6, h.y + 3]], 'z');
        for (const [dx, dy] of view === 'se' ? [[-3, 1], [1, 2], [3, 4], [-1, 4], [4, 0]] : [[-3, 2], [0, 1], [2, 3], [-4, 4]]) g.px(h.x + dx, h.y + dy, 'v');
        g.line(h.x - 4, h.y + 1, h.x + 4, h.y + 1 + L, 'Z');
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip, px = Math.cos(J.lean), py = Math.sin(J.lean);
        // Bare midriff between the fur top and the skirt.
        const m = { x: h.x + J.up.x * 3.5, y: h.y + J.up.y * 3.5 };
        g.poly([[m.x - px * 3.5, m.y - py * 3.5 - 1], [m.x + px * 3.5, m.y + py * 3.5 - 1], [h.x + px * 3, h.y + py * 3], [h.x - px * 3.5, h.y - py * 3.5]], 'M');
        if (view === 'se') {
          g.px(m.x + 1, m.y + 2, 'K'); // navel
          for (const [dx, dy] of [[-2, 1], [1, 3], [2, 0]]) g.px(c.x + dx, c.y + dy, 'v');
          // Fur strap over the near shoulder.
          g.line(J.shF.x, J.shF.y - 1, c.x, c.y + 2, 'V');
        } else for (const [dx, dy] of [[-2, 2], [1, 1], [2, 3]]) g.px(c.x + dx, c.y + dy, 'v');
      },
      face(g, J) {
        const x = Math.round(J.head.x), y = Math.round(J.head.y), pose = J.pose;
        g.rect(x - 4, y, x - 3, y + 1, 'S'); // ear
        g.px(x, y - 1, 'H'); g.px(x + 3, y - 1, 'H'); g.px(x + 4, y - 1, 'H'); // brows
        if (pose.hurt) {
          g.px(x, y + 1, 'e'); g.px(x + 1, y + 1, 'e'); g.px(x + 3, y + 1, 'e'); g.px(x + 4, y + 1, 'e');
        } else {
          g.rect(x, y, x + 1, y + 1, 'e'); g.px(x + 1, y, 'E');
          g.rect(x + 3, y, x + 4, y + 1, 'e'); g.px(x + 4, y, 'E');
        }
        g.px(x + 5, y + 2, 'S'); // nose
        g.px(x + 3, y + 3, 'm');
        g.px(x + 4, y + 3, pose.hurt ? 'm' : 'K');
      },
      hair(g, J, view, pose) {
        const H = J.head, x = H.x, y = H.y;
        // Skull cap, then bangs (front) or the full mane (back).
        g.ell(x - 1, y - 3, 5.6, 3.3, 'h');
        g.ell(x - 4, y - 1, 3, 4, 'h');
        if (view === 'se') {
          for (const [x0, y0, x1, y1, w] of [[0, -5, 0, -1, 3], [2, -5, 3, -1, 3], [4, -5, 6, -1, 2], [-2, -5, -3, 0, 3]]) g.spike(x + x0, y + y0, x + x1, y + y1, w, 'h');
          // Lock falling in front of the ear to the shoulder.
          g.spike(x - 2, y - 1, x - 1, y + 7, 3, 'h');
          for (const [x0, y0, x1, y1] of [[-3, -5, -7, -2], [-6, 1, -8, 8], [-4, 4, -5, 11], [-2, 1, -1, 6]]) g.line(x + x0, y + y0, x + x1, y + y1, 'H');
          for (const [x0, y0, x1, y1] of [[-1, -6, 2, -6], [-6, -3, -7, 0]]) g.line(x + x0, y + y0, x + x1, y + y1, 'R');
        } else aylaHairBack(g, J, pose);
        // Wild tufts on the crown.
        for (const [x0, y0, x1, y1, w] of [[-2, -6, -4, -9, 3], [1, -6, 2, -9, 3], [-5, -4, -8, -6, 3]]) g.spike(x + x0, y + y0, x + x1, y + y1, w, 'h');
      },
      front(g, J, view, pose) {
        // From behind, the mane hides the arms folded in front of her.
        if (view === 'ne') aylaHairBack(g, J, pose);
        // Re-draw the near arm with a hand-shaded underside, and a bigger fist.
        if (view !== 'se') return;
        const { shF: a, elF: b, handF: c } = J;
        g.capsule(a.x + 0.5, a.y + 0.6, b.x + 0.5, b.y + 0.6, 1.4, 'T');
        g.capsule(b.x + 0.5, b.y + 0.6, c.x + 0.5, c.y + 0.6, 1.2, 'T');
        g.capsule(a.x, a.y, b.x, b.y, 1.2, 'A');
        g.capsule(b.x, b.y, c.x, c.y, 1, 'A');
        g.ell(c.x + 0.4, c.y + 0.4, 1.5, 1.5, 'T');
        g.ell(c.x, c.y, 1.3, 1.3, 'F');
      },
    }),
  });

  // ---- Magus ---------------------------------------------------------------------------
  // Tall dark mage: pale blue-lavender skin, long blue hair swept back, pointed
  // ears, red eyes, a high-collared cape (dark purple outside, red lining) over a
  // dark tunic, and a long scythe with a big curved blade.
  function magusScythe(g, J) {
    const h = J.handF, d = J.wdir, n = perp(d);
    const top = { x: h.x + d.x * 15, y: h.y + d.y * 15 };
    // Haft through the hand, with a gold butt cap and a gold collar under the blade.
    g.capsule(h.x - d.x * 9, h.y - d.y * 9, top.x, top.y, 0.6, 'g');
    g.px(h.x - d.x * 10, h.y - d.y * 10, 'G');
    g.capsule(top.x - d.x * 1.5, top.y - d.y * 1.5, top.x - d.x * 0.5, top.y - d.y * 0.5, 0.9, 'G');
    // Curved blade: sweeps forward from the top and hooks down toward the haft.
    const L = 13;
    for (let i = 0; i <= L; i += 0.5) {
      const t = i / L, bend = t * t * 7;
      const bx = top.x + n.x * i - d.x * bend, by = top.y + n.y * i - d.y * bend;
      const w = Math.max(1, Math.round(4 * (1 - t) + 0.3));
      for (let k = 0; k < w; k++) g.px(bx + d.x * k, by + d.y * k, k === 0 ? 'v' : k === w - 1 && w > 2 ? 'X' : 'x');
    }
    g.px(top.x - d.x, top.y - d.y, 'G');
  }
  function magusCape(g, J, view, pose) {
    const c = J.chest, h = J.hip, sw = pose.bob ? 1 : 0;
    const lift = Math.min(6, Math.max(0, (pose.lean || 0) * 8 + (pose.x || 0) * 0.8));
    const hem = J.root.y - 1 + (pose.y || 0) - Math.round(lift * 0.5) - (pose.crouch || 0) * 0.5;
    if (view === 'se') {
      g.poly([[c.x - 4, c.y - 1], [c.x + 3, c.y - 1], [h.x + 4, hem - 1], [h.x - 1, hem + 1], [h.x - 7 - lift, hem - sw], [h.x - 10 - lift * 1.4, hem - 3], [c.x - 6, c.y + 3]], 'r');
      // Red lining seen between the body and the back edge.
      g.poly([[c.x - 2, c.y], [c.x + 2, c.y], [h.x + 2, hem - 1], [h.x - 3, hem], [h.x - 5 - lift * 0.6, hem - 2]], 'L');
      g.line(c.x - 5, c.y + 4, h.x - 8 - lift, hem - 3, 'P');
    } else {
      g.poly([[c.x - 5, c.y - 2], [c.x + 5, c.y - 2], [h.x + 7, hem - 1], [h.x + 2, hem + 1 - sw], [h.x - 5, hem], [h.x - 9 - lift, hem - 2]], 'r');
      g.line(c.x - 2, c.y + 1, h.x - 4 - lift * 0.5, hem - 1, 'P');
      g.line(c.x + 2, c.y + 1, h.x + 3, hem - 1, 'P');
      g.px(h.x + 6, hem - 1, 'L'); g.px(h.x - 8 - lift, hem - 2, 'L'); // lining peeks at the hem
    }
  }
  // Long hair flowing down the back, plus the pointed ear (drawn over the hair).
  function magusHair(g, J, view, pose) {
    const H = J.head, x = H.x, y = H.y;
    const fly = Math.min(3, Math.max(-1, (pose.x || 0) * 0.5 + (pose.lean || 0) * 4)), sw = pose.bob ? 1 : 0;
    if (view === 'se') {
      g.ell(x - 1, y - 4, 5.2, 2.4, 'h');
      g.ell(x - 4, y - 2, 2.6, 3.4, 'h');
      g.poly([[x - 1, y - 6], [x - 6, y - 4], [x - 8 - fly, y + 2], [x - 9 - fly, y + 10], [x - 7 - fly, y + 15 - sw], [x - 4, y + 9], [x - 2, y + 2]], 'h');
      for (const [x0, y0, x1, y1, w] of [[-8, 8, -11, 14, 3], [-6, 11, -7, 17, 2], [-7, 1, -11, 4, 3]]) g.spike(x + x0 - fly, y + y0, x + x1 - fly, y + y1 - sw, w, 'h');
      // Bangs swept to the side over the brow, one long lock by the face.
      for (const [x0, y0, x1, y1, w] of [[1, -5, 4, -3, 2], [3, -5, 6, -3, 2], [-2, -3, -2, 3, 2]]) g.spike(x + x0, y + y0, x + x1, y + y1, w, 'h');
      for (const [x0, y0, x1, y1] of [[-3, -5, -7, -1], [-5, 0, -8, 9], [-3, 3, -5, 10]]) g.line(x + x0, y + y0, x + x1 - fly, y + y1, 'H');
      for (const [x0, y0, x1, y1] of [[-2, -6, 2, -6], [-6, -2, -7, 3]]) g.line(x + x0, y + y0, x + x1, y + y1, 'R');
      // Long pointed ear sweeping back.
      g.spike(x - 2, y + 0.5, x - 7, y - 3, 2.5, 's');
      g.px(x - 3, y, 'S');
    } else {
      g.ell(x - 1, y - 3, 5.5, 3.2, 'h');
      g.ell(x, y - 1, 5.4, 5.3, 'h');
      g.poly([[x - 5, y - 2], [x + 5, y - 2], [x + 4, y + 10], [x + 1, y + 16 - sw], [x - 3, y + 12], [x - 7 - fly, y + 14 - sw], [x - 7 - fly, y + 4]], 'h');
      for (const [x0, y0, x1, y1, w] of [[-6, 10, -9 - fly, 15, 3], [0, 12, 0, 18, 3], [3, 9, 5, 14, 2]]) g.spike(x + x0, y + y0, x + x1, y + y1 - sw, w, 'h');
      for (const [x0, y0, x1, y1] of [[-3, -1, -5, 12], [0, 0, 0, 15], [3, -1, 3, 9]]) g.line(x + x0, y + y0, x + x1, y + y1, 'H');
      g.line(x - 2, y - 5, x + 2, y - 5, 'R');
      g.line(x - 4, y - 3, x - 4, y + 2, 'R');
      // Both ears poke out of the hair.
      g.spike(x + 4, y + 0.5, x + 8, y - 2, 2.2, 's');
      g.spike(x - 4, y + 0.5, x - 8, y - 2, 2.2, 'S');
    }
  }
  const MAGUS_IDLE = { armF: [0.35, 0.95], armB: [-0.05, 0.4], wpn: 0.1, footF: [1, 0], footB: [-2, 0] };
  define('magus', {
    body: { leg: 14, torso: 10, neck: 2, headR: 5, upper: 6, fore: 5, shoulder: 3, stance: 3 },
    pal: {
      s: '#bcc0d4', S: '#9294b0', A: '#bcc0d4', a: '#9294b0', F: '#bcc0d4', f: '#9294b0',
      e: '#d43c3c', E: '#f06c4c', m: '#6e7090', K: '#52526e',
      h: '#5c90dc', H: '#3c64b4', R: '#8cc0f0',
      c: '#52526e', C: '#3a3a52', d: '#6e7090', D: '#3a3a52', y: '#f8bc3c',
      p: '#52526e', q: '#3a3a52', b: '#3a3a52', o: '#2a2038',
      r: '#4a1c6c', P: '#6c3094', L: '#a02030',
      g: '#6e4222', G: '#f8bc3c', x: '#e4e8f0', X: '#9294b0', v: '#ffffff',
    },
    detail: 'eEmKHRPCyv',
    magic: '#bc84e4', // shadow
    anims: {
      idle: { loop: true, frames: [{ ms: 600, ...MAGUS_IDLE }, { ms: 600, ...MAGUS_IDLE, bob: 1, armF: [0.3, 1.0] }] },
      walk: {
        loop: true,
        frames: [
          { ms: 150, footF: [3, 0], footB: [-3, 0], armF: [0.25, 1.0], armB: [0.3, 0.4], wpn: 0.2 },
          { ms: 150, footF: [0, 0], footB: [1, 2], armF: [0.35, 0.95], armB: [0, 0.4], wpn: 0.12, bob: -1 },
          { ms: 150, footF: [-3, 0], footB: [3, 0], armF: [0.45, 0.9], armB: [-0.3, 0.4], wpn: 0.05 },
          { ms: 150, footF: [1, 2], footB: [0, 0], armF: [0.35, 0.95], armB: [0, 0.4], wpn: 0.12, bob: -1 },
        ],
      },
      // Two-handed scythe sweep: raise it behind, reap down in front, follow through.
      attack: {
        frames: [
          { ms: 160, lean: -0.15, crouch: 1, armF: [2.6, 0.2], armB: [2.3, 0.3], wpn: -1.1, footF: [1, 0], footB: [-3, 0], tilt: -1 },
          { ms: 80, lean: 0.25, crouch: 2, x: 3, armF: [1.7, 0.1], armB: [1.5, 0.3], wpn: 1.2, footF: [5, 0], footB: [-4, 0], tilt: 1 },
          { ms: 180, lean: 0.35, crouch: 3, x: 3, armF: [0.9, 0.3], armB: [0.7, 0.4], wpn: 2.3, footF: [5, 0], footB: [-4, 0], tilt: 1 },
          { ms: 150, x: 1, ...MAGUS_IDLE },
        ],
      },
      // Shadow magic: scythe held upright, free hand raised, then thrust forward.
      cast: {
        frames: [
          { ms: 180, lean: -0.1, armF: [0.4, 0.9], armB: [2.0, 0.5], wpn: 0.05, tilt: -1, nod: -1, footF: [1, 0], footB: [-2, 0] },
          { ms: 180, lean: -0.1, bob: -1, armF: [0.4, 0.9], armB: [2.2, 0.4], wpn: 0.05, tilt: -1, nod: -1, footF: [1, 0], footB: [-2, 0] },
          { ms: 280, lean: 0.2, armF: [1.45, -0.05], armB: [1.6, 0], wpn: 0.4, tilt: 1, footF: [3, 0], footB: [-3, 0] },
        ],
        charge: [0, 1], release: 2, rim: true,
      },
      // Ranged: level the scythe and loose a bolt from the blade.
      shoot: {
        frames: [
          { ms: 150, lean: -0.05, armF: [1.2, 0.3], armB: [1.0, 0.4], wpn: 1.2, footF: [2, 0], footB: [-3, 0] },
          { ms: 150, lean: -0.15, x: -1, armF: [1.4, 0.2], armB: [1.1, 0.4], wpn: 1.0, footF: [2, 0], footB: [-3, 0], tilt: -1 },
        ],
      },
      hurt: { frames: [{ ms: 300, lean: -0.3, x: -2, crouch: 1, armF: [0.1, 0.5], armB: [0.8, 0.5], wpn: 0.7, tilt: -1, nod: 1, footF: [1, 0], footB: [-3, 0], hurt: true }] },
      ko: { frames: [{ ms: 1000, lean: -0.2, crouch: 2, armF: [0.2, 0.2], armB: [0.2, 0.1], wpn: 2.6, nod: 1, ko: true }] },
      // Down on one knee, leaning on the upright scythe.
      kneel: { frames: [{ ms: 1000, lean: 0.25, crouch: 6, footF: [3, 0], footB: [-5, 0], armF: [0.9, 0.9], armB: [0.2, 0.5], wpn: 0.05, nod: 1 }] },
      // Scythe raised high, cape billowing.
      victory: {
        loop: true,
        frames: [
          { ms: 340, armF: [1.9, 0.8], armB: [-1.1, 0.3], wpn: 0.15, tilt: -1, footF: [1, 0], footB: [-2, 0] },
          { ms: 340, bob: 1, armF: [1.95, 0.8], armB: [-1.25, 0.3], wpn: 0.1, tilt: -1, footF: [1, 0], footB: [-2, 0] },
        ],
      },
    },
    draw: human({
      sleeves: 'long',
      width: 4,
      behind(g, J, view, pose) {
        if (view === 'se') magusCape(g, J, view, pose);
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip, H = J.head;
        // Sash, tunic seam and gold clasps.
        g.capsule(h.x - 4, h.y - 1, h.x + 3.5, h.y - 1 + J.lean * 3, 0.8, 'C');
        if (view === 'se') {
          g.line(c.x + 1, c.y + 1, h.x + 1, h.y - 2, 'C');
          // High collar: tall back flare (purple outside, red inside) and a short front flare.
          g.poly([[c.x - 2, c.y + 1], [c.x - 7, H.y - 5], [c.x - 5, H.y - 4], [c.x, c.y - 2]], 'r');
          g.poly([[c.x - 3, c.y], [c.x - 6, H.y - 3], [c.x - 1, c.y - 2]], 'L');
          g.poly([[c.x + 1, c.y + 1], [c.x + 6, H.y + 4], [c.x + 5, c.y]], 'r');
          g.px(c.x + 4, c.y - 1, 'L');
          g.px(c.x - 2, c.y, 'y'); g.px(c.x + 2, c.y, 'y');
        } else {
          g.poly([[c.x - 5, c.y + 1], [c.x - 7, H.y - 3], [c.x + 7, H.y - 3], [c.x + 5, c.y + 1]], 'r');
        }
      },
      face(g, J) {
        const x = Math.round(J.head.x), y = Math.round(J.head.y), hurt = J.pose.hurt;
        // Sharp brows, red eyes, narrow nose, thin mouth.
        g.line(x - 1, y - 2, x + 1, y - 1, 'H');
        g.line(x + 3, y - 1, x + 5, y - 2, 'H');
        if (hurt) { g.line(x, y, x + 1, y, 'K'); g.line(x + 3, y, x + 4, y, 'K'); }
        else { g.px(x, y, 'e'); g.px(x + 1, y, 'K'); g.px(x + 3, y, 'K'); g.px(x + 4, y, 'e'); g.px(x + 4, y + 1, 'K'); }
        g.px(x + 5, y + 1, 'S'); g.px(x + 5, y + 2, 'S');
        g.line(x + 2, y + 3, x + 4, y + 3, hurt ? 'K' : 'm');
      },
      hair: magusHair,
      weapon(g, J) {
        magusScythe(g, J);
      },
      front(g, J, view, pose) {
        if (view === 'ne') {
          // From behind the cape covers the back; hair falls over it, the scythe stays in view.
          magusCape(g, J, view, pose);
          magusHair(g, J, view, pose);
          magusScythe(g, J);
        }
      },
    }),
  });

  // @@PARTY@@
})();
