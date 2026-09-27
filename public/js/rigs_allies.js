// Rigged allies, guests and extra party members (see docs/ART_SPEC.md).
//   iselle, iselle_broken  - the Warden (glass halberd, half porcelain)
//   knight                 - Mystic Knight (plate, great helm, runed greatsword)
//   dave, mat              - Skirmish divers (harpoon guns)
//   spekkio                - Master of War (small pink horned spirit)
(function () {
  const CT = (window.CT = window.CT || {});
  const { define, human, RX, RY } = CT.RIG;

  // ---- Shared helpers -------------------------------------------------------------------
  const V = (x, y) => ({ x, y });
  // Two-bone IK for an arm: elbow bends down/back (away from the weapon side).
  function armIK(sh, tgt, L1, L2) {
    let dx = tgt.x - sh.x, dy = tgt.y - sh.y;
    let d = Math.hypot(dx, dy) || 0.001;
    const max = L1 + L2 - 0.05;
    if (d > max) { tgt = V(sh.x + (dx / d) * max, sh.y + (dy / d) * max); dx = tgt.x - sh.x; dy = tgt.y - sh.y; d = max; }
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const mx = sh.x + (dx * a) / d, my = sh.y + (dy * a) / d;
    // perpendicular choice: the one pointing more downward
    let px = -dy / d, py = dx / d;
    if (py < 0) { px = -px; py = -py; }
    return { el: V(mx + px * h, my + py * h), hand: tgt };
  }
  // Put the far hand on the weapon haft, `dist` px behind the near hand.
  function grip(J, dist) {
    const t = V(J.handF.x - J.wdir.x * dist, J.handF.y - J.wdir.y * dist);
    const r = armIK(J.shB, t, J.B.upper, J.B.fore);
    J.elB = r.el; J.handB = r.hand;
  }
  // Replace letters inside a box.
  function repl(g, x0, y0, x1, y1, from, to) {
    for (let y = Math.round(y0); y <= Math.round(y1); y++)
      for (let x = Math.round(x0); x <= Math.round(x1); x++)
        if (x >= 0 && y >= 0 && x < g.w && y < g.h && from.includes(g.a[y][x])) g.a[y][x] = to;
  }
  const at = (J, k, s = 0, h = J.handF) => [h.x + J.wdir.x * k - J.wdir.y * s, h.y + J.wdir.y * k + J.wdir.x * s];
  // Wrap a painter so that pose.two puts both hands on the weapon.
  const twoHanded = (paint, dist = 4) => (g, J, view, pose) => {
    if (pose.two) grip(J, pose.two === true ? dist : pose.two);
    paint(g, J, view, pose);
  };

  // Weapon hooks honouring pose.wback (weapon swung behind the head/body).
  const wFront = (fn) => (g, J, view, pose) => { if (!pose.wback) fn(g, J, view, pose); };
  const wBehind = (fn) => (g, J, view, pose) => { if (pose.wback) fn(g, J, view, pose); };

  // =====================================================================================
  // ISELLE, THE WARDEN
  // Short white bob, left half of the face and the left forearm porcelain with glowing
  // blue seams, long grey coat, glass halberd "Ledger" with scrolling text on the blade.
  // In SE the near (screen-right) side is her left; in NE the far (visible) arm is.
  // =====================================================================================
  const ISELLE_PAL = {
    h: '#e4e8f0', H: '#9294b0', R: '#ffffff',
    s: '#f8d0a8', S: '#e0a878', a: '#e0a878', A: '#f8d0a8', f: '#e0a878', F: '#f8d0a8',
    e: '#1a1226', E: '#ffffff', m: '#bc7a50', n: '#e0a878',
    P: '#ffffff', Q: '#bcc0d4', g: '#3c64b4', G: '#5c90dc', k: '#1a1226',
    c: '#52526e', d: '#6e7090', D: '#3a3a52', t: '#52526e', T: '#2a2038', C: '#2a2038', v: '#bcc0d4', i: '#1a1226',
    l: '#2a2038', y: '#bcc0d4',
    p: '#3a3a52', q: '#2a2038', b: '#3a3a52', o: '#2a2038',
    z: '#5c90dc', Z: '#8cc0f0', x: '#c4e4ff', X: '#ffffff', j: '#5c90dc',
  };

  function iselleDraw(broken) {
    function halberd(g, J) {
      const r = J.pose.reach || 0;
      const len = (broken ? 13 : 17) - r, butt = r ? -7 : -11;
      const A = (k, s) => at(J, k, s);
      // Glass shaft with a light core, dark binding under the head.
      g.capsule(...A(butt, 0), ...A(len, 0), 0.5, 'z');
      g.capsule(...A(butt + 2, -0.01), ...A(len - 9, -0.01), 0.5, 'z');
      if (!broken) {
        // Spear tip and crescent axe blade on the forward side, back spike.
        g.spike(...A(len - 1, 0), ...A(len + 5, 0), 3, 'x');
        g.poly([A(len - 1, 0.5), A(len + 1, 3), A(len, 5.5), A(len - 3, 5.5), A(len - 5, 4), A(len - 7, 5), A(len - 8, 0.5)], 'x');
        g.spike(...A(len - 4, 0), ...A(len - 3, -3.5), 2.5, 'x');
        g.line(...A(len + 1, 3), ...A(len, 5.5), 'X');
        g.line(...A(len, 5.5), ...A(len - 3, 5.5), 'X');
        // "Text" scrolling down the glass.
        const ph = Math.round((J.pose.bob || 0) + (J.pose.x || 0)) & 1;
        for (let k = len - 6 + ph; k < len - 1; k += 2) g.line(...A(k, 2), ...A(k, 3), 'j');
      } else {
        // Snapped: half a blade, jagged, no tip.
        g.poly([A(len - 1, 0.5), A(len - 2, 5), A(len - 4, 3.5), A(len - 6, 5.5), A(len - 8, 3), A(len - 7.5, 0.5)], 'x');
        g.px(...A(len - 5, 2), 'j');
        g.px(...A(len + 1, 0), 'z');
      }
      g.px(...A(len - 9, 0), 'y');
      g.px(...A(len - 10, 0), 'y');
    }
    function porcelainArm(g, el, hand) {
      g.capsule(el.x, el.y, hand.x, hand.y, 1.3, 'P');
      g.ell(hand.x, hand.y, 1.3, 1.3, 'P');
      const mx = (el.x + hand.x) / 2, my = (el.y + hand.y) / 2;
      g.px(el.x, el.y + 1, 'g');
      g.px(mx, my, 'g');
      if (broken) { g.px(mx + 1, my - 1, 'k'); g.px(hand.x, hand.y, 'k'); }
      else g.px(hand.x - 1, hand.y, 'G');
    }
    return twoHanded(human({
      sleeves: 'long',
      behind(g, J, view, pose) {
        if (pose.wback) halberd(g, J);
        // Coat tail flares behind the legs.
        const h = J.hip, lo = Math.max(J.kneeF.y, J.kneeB.y) + 3;
        const sw = (J.pose.x || 0) > 1 ? 2 : 0;
        g.poly([[h.x - 4, h.y], [h.x + 1, h.y], [h.x - 1, lo], [h.x - 6 - sw, lo - 1]], 'T');
      },
      legs(g, J, view) {
        // Long coat skirt to below the knee, opening at the front.
        const h = J.hip, lo = (J.kneeF.y + J.kneeB.y) / 2 + 2;
        const xl = Math.min(J.kneeB.x, h.x) - 3, xr = Math.min(J.kneeF.x, h.x + 3) + 1.5;
        g.poly([[h.x - 4.5, h.y - 1], [h.x + 4, h.y - 1], [xr, lo - 1], [xl, lo]], 't');
        if (view === 'se') {
          g.line(h.x - 1, h.y + 2, xl + 2, lo - 1, 'C');
        } else {
          g.line(h.x, h.y + 1, (xl + xr) / 2, lo, 'C');
        }
        g.line(xl, lo, xr, lo, 'T');
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip;
        g.capsule(h.x - 4, h.y - 1, h.x + 3.5, h.y - 1 + J.lean * 3, 0.9, 'l');
        if (view === 'se') {
          g.px(h.x + 2, h.y - 1, 'y');
          // Dark inner shirt, lapel edge, high collar.
          g.tri(c.x, c.y - 1, c.x + 3.5, c.y - 1, c.x + 1.5, c.y + 4, 'i');
          g.line(c.x + 2, c.y + 4, h.x + 2, h.y - 2, 'v');
          g.rect(Math.round(J.neck.x) - 3, Math.round(J.neck.y), Math.round(J.neck.x) - 2, Math.round(J.neck.y) + 2, 'C');
        } else {
          g.rect(Math.round(J.neck.x) - 3, Math.round(J.neck.y), Math.round(J.neck.x) + 2, Math.round(J.neck.y) + 1, 'C');
          g.line(c.x, c.y + 2, h.x, h.y - 2, 'C');
        }
      },
      face(g, J) {
        const x = Math.round(J.head.x), y = Math.round(J.head.y), hurt = J.pose.hurt;
        // Porcelain on the far (her left) half, blue seam where it meets the skin.
        repl(g, x + 2, y - 2, x + 6, y + 6, 's', 'P');
        repl(g, x + 1, y + 3, x + 1, y + 6, 's', 'P');
        g.px(x + 2, y + 1, 'g');
        g.px(x + 1, y + 3, 'g');
        g.px(x + 5, y + 2, 'Q');
        if (broken) { g.px(x + 4, y + 3, 'k'); g.px(x + 5, y + 3, 'k'); g.px(x + 3, y + 4, 'g'); }
        // Near eye human, far eye a glowing lens.
        if (hurt || J.pose.shut) {
          g.px(x - 1, y + 1, 'e'); g.px(x, y + 1, 'e');
          g.px(x + 3, y + 1, 'g');
        } else {
          g.px(x - 1, y - 1, 'H');
          g.rect(x, y, x, y + 1, 'e');
          g.px(x - 1, y, 'e');
          g.px(x, y, 'E');
          g.rect(x + 3, y, x + 3, y + 1, broken ? 'g' : 'G');
        }
        g.px(x + 2, y + 3, 'm');
      },
      hair(g, J, view) {
        const H = J.head, x = H.x, y = H.y;
        g.ell(x - 1, y - 3, 5.4, 3.2, 'h');
        if (view === 'se') {
          g.ell(x - 4, y + 0.5, 2.4, 4.2, 'h');
          g.spike(x - 5, y + 2, x - 5, y + 7, 3, 'h');
          g.spike(x - 2, y, x - 2, y + 5, 2, 'h');
          // Fringe swept toward the porcelain side.
          for (const [x0, y0, x1, y1, w] of [[-1, -4, -1, -1, 3], [1, -4, 3, -2, 3], [4, -4, 6, -1, 2]]) g.spike(x + x0, y + y0, x + x1, y + y1, w, 'h');
          g.line(x - 4, y - 3, x - 5, y + 3, 'H');
          g.line(x + 2, y - 3, x + 3, y - 1, 'H');
          g.line(x - 3, y - 6, x + 1, y - 7, 'R');
        } else {
          g.ell(x, y, 5.3, 5.3, 'h');
          g.ell(x - 0.5, y + 3, 5, 2.5, 'h');
          for (const [x0, x1] of [[-3, -4], [0, 0], [3, 4]]) g.spike(x + x0, y + 3, x + x1, y + 7, 2.5, 'h');
          g.line(x - 2, y - 3, x - 3, y + 4, 'H');
          g.line(x + 2, y - 2, x + 2, y + 5, 'H');
          g.line(x - 2, y - 6, x + 2, y - 6, 'R');
          // Porcelain nape on her left.
          g.px(x - 3, y + 7, 'P');
          g.px(x - 2, y + 7, 'g');
        }
      },
      weapon: wFront(halberd),
      front(g, J, view) {
        if (view === 'se') porcelainArm(g, J.elF, J.handF);
        else porcelainArm(g, J.elB, J.handB);
      },
    }));
  }

  // Halberd-wielder's animations. wpn = halberd axis (0 up, + forward).
  const HOLD = { armF: [0.45, 0.95], armB: [-0.15, 0.35] };
  const ISELLE_ANIMS = {
    idle: { loop: true, frames: [
      { ms: 560, ...HOLD, wpn: 0.06 },
      { ms: 560, bob: 1, ...HOLD, armF: [0.42, 1.0], armB: [-0.1, 0.4], wpn: 0.06 },
    ] },
    walk: { loop: true, frames: [
      { ms: 140, footF: [3, 0], footB: [-3, 0], armF: [0.35, 1.05], armB: [0.4, 0.4], wpn: 0.2 },
      { ms: 140, footF: [0, 0], footB: [1, 2], armF: [0.45, 1.0], armB: [0, 0.4], bob: -1, wpn: 0.16 },
      { ms: 140, footF: [-3, 0], footB: [3, 0], armF: [0.55, 0.95], armB: [-0.35, 0.4], wpn: 0.12 },
      { ms: 140, footF: [1, 2], footB: [0, 0], armF: [0.45, 1.0], armB: [0, 0.4], bob: -1, wpn: 0.16 },
    ] },
    // Overhead chop: raise behind, cleave forward and down, drag through, recover.
    attack: { frames: [
      { ms: 160, lean: -0.2, crouch: 1, armF: [2.5, 0.5], wpn: -1.0, two: 5, wback: true, footF: [1, 0], footB: [-3, 0], tilt: -1 },
      { ms: 70, lean: 0.35, crouch: 2, x: 2, armF: [1.7, -0.1], wpn: 1.9, two: 5, reach: 6, footF: [5, 0], footB: [-4, 0], tilt: 1 },
      { ms: 180, lean: 0.45, crouch: 3, x: 2, armF: [1.0, 0.1], wpn: 2.45, two: 5, reach: 5, footF: [6, 0], footB: [-4, 0], tilt: 1, nod: 1 },
      { ms: 150, lean: 0.1, crouch: 1, x: 1, ...HOLD, wpn: 0.3, footF: [2, 0], footB: [-2, 0] },
    ] },
    // Catalogue / Preserve: halberd held level, the porcelain palm raised; release thrusts.
    cast: { frames: [
      { ms: 170, lean: -0.12, crouch: 1, armF: [2.1, 0.5], wpn: 0.15, reach: 3, armB: [1.3, 0.1], tilt: -1, nod: -1, footF: [1, 0], footB: [-3, 0] },
      { ms: 170, lean: -0.12, crouch: 1, bob: -1, armF: [2.15, 0.45], wpn: 0.1, reach: 3, armB: [1.4, 0], tilt: -1, nod: -1, footF: [1, 0], footB: [-3, 0] },
      { ms: 260, lean: 0.25, x: 1, crouch: 1, armF: [1.3, 0.4], wpn: 1.2, reach: 7, armB: [1.7, -0.1], footF: [4, 0], footB: [-3, 0], tilt: 1 },
    ], charge: [0, 1], release: 2, rim: true },
    // Ledger Strike (reach 2): level the halberd, then lunge-thrust.
    shoot: { frames: [
      { ms: 150, lean: -0.05, crouch: 1, x: -2, armF: [0.9, 0.3], wpn: 1.45, two: 5, reach: 7, footF: [2, 0], footB: [-3, 0] },
      { ms: 170, lean: 0.3, x: 1, crouch: 2, armF: [1.45, 0], wpn: 1.6, two: 5, reach: 9, footF: [6, 0], footB: [-4, 0], tilt: 1 },
    ] },
    hurt: { frames: [{ ms: 300, lean: -0.35, x: -2, crouch: 1, armF: [0.3, 0.9], armB: [0.9, 0.5], wpn: -0.35, tilt: -1, nod: 1, footF: [1, 0], footB: [-3, 0], hurt: true }] },
    ko: { frames: [{ ms: 1000, lean: -0.2, crouch: 2, armF: [0.2, 0.2], armB: [0.2, 0.1], wpn: 1.6, nod: 1, ko: true, shut: true }] },
    kneel: { frames: [{ ms: 1000, lean: 0.3, crouch: 5, footF: [3, 0], footB: [-5, 0], armF: [0.75, 0.65], armB: [0.2, 0.5], wpn: 0.1, nod: 1 }] },
    victory: { loop: true, frames: [
      { ms: 320, armF: [2.2, 0.5], wpn: 0.35, reach: 2, armB: [-0.3, 0.9], tilt: -1, bob: -1 },
      { ms: 320, armF: [1.9, 0.6], wpn: 0.75, reach: 2, armB: [-0.35, 0.95], tilt: -1, nod: -1, y: -2 },
    ] },
  };

  define('iselle', {
    body: { headR: 5 },
    pal: ISELLE_PAL,
    detail: 'eEmHRCvgGjXyk',
    magic: '#8cc0f0',
    anims: ISELLE_ANIMS,
    draw: iselleDraw(false),
  });

  // Broken: the same Warden after the vitrine cracks. Seams dim, porcelain chipped,
  // the halberd snapped; every pose slumps and the head stays bowed.
  const slump = (fr) => Object.assign({}, fr, { lean: (fr.lean || 0) + 0.15, crouch: (fr.crouch || 0) + 1, nod: (fr.nod || 0) + 1 });
  const BROKEN_ANIMS = {};
  for (const k in ISELLE_ANIMS) BROKEN_ANIMS[k] = Object.assign({}, ISELLE_ANIMS[k], { frames: ISELLE_ANIMS[k].frames.map(slump) });
  Object.assign(BROKEN_ANIMS, {
    // Sitting slumped on her heels, the snapped halberd across the ground.
    idle: { loop: true, frames: [
      { ms: 700, lean: 0.45, crouch: 6, footF: [3, 0], footB: [-5, 0], armF: [0.35, 0.35], wpn: 1.75, armB: [0.45, 0.5], nod: 2, tilt: 1, shut: true },
      { ms: 700, lean: 0.5, crouch: 6, bob: 1, footF: [3, 0], footB: [-5, 0], armF: [0.35, 0.35], wpn: 1.75, armB: [0.45, 0.55], nod: 2, tilt: 1, shut: true },
    ] },
    // A limp, dragging the halberd behind her.
    walk: { loop: true, frames: [
      { ms: 170, lean: 0.3, crouch: 1, footF: [3, 0], footB: [-3, 0], armF: [-0.25, 0.1], wpn: -2.2, armB: [0.6, 0.6], nod: 1 },
      { ms: 170, lean: 0.35, crouch: 2, footF: [0, 0], footB: [1, 1], armF: [-0.2, 0.1], wpn: -2.2, armB: [0.6, 0.6], nod: 2 },
      { ms: 170, lean: 0.3, crouch: 1, footF: [-2, 0], footB: [2, 0], armF: [-0.3, 0.1], wpn: -2.25, armB: [0.5, 0.6], nod: 1 },
      { ms: 220, lean: 0.4, crouch: 3, footF: [1, 1], footB: [0, 0], armF: [-0.2, 0.1], wpn: -2.2, armB: [0.6, 0.6], nod: 2 },
    ] },
    kneel: { frames: [{ ms: 1000, lean: 0.5, crouch: 6, footF: [3, 0], footB: [-5, 0], armF: [0.8, 0.5], wpn: 0.25, armB: [0.9, 1.3], nod: 2, shut: true }] },
    // No triumph left: she straightens and lowers the blade.
    victory: { loop: true, frames: [
      { ms: 500, lean: 0.15, armF: [0.45, 0.95], wpn: 0.2, armB: [0.9, 1.5], nod: 1 },
      { ms: 500, lean: 0.15, bob: 1, armF: [0.45, 0.95], wpn: 0.2, armB: [0.9, 1.5], nod: 1, shut: true },
    ] },
  });
  define('iselle_broken', {
    body: { headR: 5 },
    pal: Object.assign({}, ISELLE_PAL, { g: '#3c64b4', G: '#5c90dc', z: '#3c64b4', x: '#8cc0f0', X: '#c4e4ff', j: '#2c4488', c: '#6e7090', t: '#52526e', T: '#3a3a52' }),
    detail: 'eEmHRCvgGjXyk',
    magic: '#5c90dc',
    anims: BROKEN_ANIMS,
    draw: iselleDraw(true),
  });

  // =====================================================================================
  // MYSTIC KNIGHT
  // Heavy steel plate with gold trim, closed great helm with a violet eye-glow behind
  // the visor slit and a dark plume, navy cape and tabard, a runed two-handed greatsword.
  // =====================================================================================
  const KNIGHT_PAL = {
    s: '#bcc0d4', S: '#3a3a52', e: '#0a0612', G: '#e0c0fc', C: '#2a2038', H: '#4a1c6c', h: '#9450c0', R: '#e0c0fc',
    c: '#bcc0d4', d: '#bcc0d4', M: '#6e7090', D: '#6e7090', A: '#bcc0d4', a: '#6e7090', F: '#52526e', f: '#3a3a52',
    P: '#e4e8f0', O: '#9294b0', K: '#e4e8f0',
    p: '#bcc0d4', q: '#6e7090', b: '#6e7090', o: '#3a3a52',
    y: '#f8bc3c', Y: '#e88c28', l: '#4a2a16',
    u: '#2c4488', U: '#10183a', t: '#3c64b4',
    x: '#e4e8f0', X: '#9294b0', r: '#9450c0', g: '#4a2a16',
  };
  function greatsword(g, J) {
    const A = (k, s) => at(J, k, s);
    g.capsule(...A(-4, 0), ...A(1, 0), 0.6, 'g');
    g.ell(...A(-4.5, 0), 0.9, 0.9, 'y');
    const L = 18;
    // Broad blade: bright face, darker back edge, violet runes down the fuller.
    g.poly([A(2, -1.4), A(2, 1.6), A(L - 2, 1.4), A(L + 1, 0), A(L - 2, -1.2)], 'x');
    g.line(...A(2, -1), ...A(L - 3, -1), 'X');
    for (let k = 4; k < L - 3; k += 3) g.px(...A(k, 0.3), 'r');
    // Winged gold crossguard.
    g.capsule(...A(1.5, -3.5), ...A(1.5, 3.5), 0.6, 'y');
    g.px(...A(2.5, -3.5), 'Y');
    g.px(...A(2.5, 3.5), 'Y');
  }
  function knightLeg(g, hip, knee, foot, L, cop, boot) {
    g.capsule(hip.x, hip.y, knee.x, knee.y, 2.1, L);
    g.capsule(knee.x, knee.y, foot.x, foot.y - 1, 1.9, L);
    g.ell(knee.x + 0.5, knee.y, 1.5, 1.2, cop);
    g.rect(Math.round(foot.x) - 2, Math.round(foot.y) - 2, Math.round(foot.x) + 2, Math.round(foot.y), boot);
    g.rect(Math.round(foot.x) + 3, Math.round(foot.y) - 1, Math.round(foot.x) + 3, Math.round(foot.y), boot);
  }
  function knightCape(g, J, view) {
    const sway = (J.pose.x || 0) > 1 || (J.pose.footF && J.pose.footF[0] > 2) ? 2 : (J.pose.bob ? 1 : 0);
    const low = Math.min(J.root.y - 2, J.hip.y + 11);
    if (view === 'se') {
      g.poly([[J.shB.x + 2, J.shB.y - 2], [J.shB.x - 3, J.shB.y], [J.hip.x - 8 - sway, low], [J.hip.x - 1, low + 1]], 'U');
      g.line(J.hip.x - 8 - sway, low, J.hip.x - 1, low + 1, 'y');
      g.line(J.shB.x - 2, J.shB.y + 3, J.hip.x - 6 - sway, low - 1, 'u');
    } else {
      g.poly([[J.shB.x - 2, J.shB.y - 1], [J.shF.x + 2, J.shF.y - 1], [J.hip.x + 6, low], [J.hip.x - 7 - sway, low + 1]], 'u');
      g.line(J.hip.x - 7 - sway, low + 1, J.hip.x + 6, low, 'y');
      g.line(J.chest.x - 1, J.chest.y + 2, J.hip.x - 2 - sway / 2, low - 1, 'U');
      g.line(J.chest.x + 2, J.chest.y + 3, J.hip.x + 3, low - 1, 'U');
      g.line(J.shB.x - 1, J.shB.y - 1, J.shF.x + 1, J.shF.y - 1, 'y');
    }
  }
  const knightDraw = twoHanded(human({
    width: 6,
    behind(g, J, view, pose) {
      if (pose.wback) greatsword(g, J);
      if (view === 'se') knightCape(g, J, view);
      knightLeg(g, J.hipB, J.kneeB, J.footB, 'q', 'O', 'o');
    },
    legs(g, J, view) {
      knightLeg(g, J.hipF, J.kneeF, J.footF, 'p', 'K', 'b');
      const h = J.hip;
      if (view === 'se') {
        // Tabard panel hanging between the legs, gold border.
        g.poly([[h.x - 1, h.y], [h.x + 4, h.y], [h.x + 3.5, h.y + 9], [h.x - 0.5, h.y + 9]], 't');
        g.line(h.x - 0.5, h.y + 9, h.x + 3.5, h.y + 9, 'y');
        g.line(h.x - 1, h.y + 1, h.x - 0.5, h.y + 8, 'y');
      }
      // Faulds: steel skirt plates over the hips.
      g.poly([[h.x - 6, h.y - 1], [h.x + 5.5, h.y - 1], [h.x + 6, h.y + 3], [h.x - 6.5, h.y + 3]], 'M');
    },
    torso(g, J, view) {
      const c = J.chest, h = J.hip;
      g.capsule(h.x - 5.5, h.y - 1, h.x + 5, h.y - 1 + J.lean * 3, 0.9, 'l');
      if (view === 'se') {
        g.rect(Math.round(h.x + 2), Math.round(h.y - 2), Math.round(h.x + 3), Math.round(h.y - 1), 'y');
        // Gold-trimmed plastron and a leather baldric.
        g.line(c.x + 2, c.y - 1, c.x + 2, h.y - 3, 'X');
        g.line(c.x - 5, c.y, c.x + 5, c.y, 'y');
        g.line(c.x - 4, c.y + 1, h.x + 4, h.y - 2, 'g');
        g.ell(J.shB.x, J.shB.y, 2.8, 2.2, 'O');
      } else {
        knightCape(g, J, view);
      }
      // Gorget.
      g.rect(Math.round(J.neck.x) - 3, Math.round(J.neck.y) - 1, Math.round(J.neck.x) + 3, Math.round(J.neck.y) + 1, 'S');
    },
    face(g, J) {
      const x = Math.round(J.head.x), y = Math.round(J.head.y);
      // Visor slit with glowing eyes, breaths, cheek plate edge.
      g.line(x - 1, y, x + 5, y, 'e');
      if (!J.pose.hurt) { g.px(x + 1, y, 'G'); g.px(x + 4, y, 'G'); }
      for (const [dx, dy] of [[3, 3], [5, 3], [4, 4]]) g.px(x + dx, y + dy, 'e');
      g.line(x + 2, y - 5, x + 2, y - 1, 'y');
      g.line(x + 2, y + 1, x + 2, y + 5, 'y');
    },
    hair(g, J, view) {
      const x = J.head.x, y = J.head.y;
      // Square the helm off: cheek guards to the jaw, flat crown band.
      g.rect(Math.round(x) - 4, Math.round(y) - 1, Math.round(x) + 5, Math.round(y) + 5, 's');
      if (view === 'se') {
        const X = Math.round(x), Y = Math.round(y);
        g.rect(X - 1, Y - 1, X + 5, Y + 1, 'C');
        g.line(X - 1, Y, X + 5, Y, 'e');
        if (!J.pose.hurt) { g.rect(X, Y, X + 1, Y, 'G'); g.rect(X + 4, Y, X + 5, Y, 'G'); }
        for (const [dx, dy] of [[3, 3], [5, 3], [4, 4]]) g.px(X + dx, Y + dy, 'e');
        g.line(X + 2, Y - 5, X + 2, Y - 1, 'y');
        g.line(X + 2, Y + 1, X + 2, Y + 5, 'y');
        g.line(X - 3, Y - 1, X - 3, Y + 4, 'S');
      } else {
        g.line(Math.round(x), Math.round(y) - 5, Math.round(x), Math.round(y) + 5, 'y');
      }
      // Dark plume streaming back from the crest.
      const f = J.pose.bob ? 1 : 0;
      g.spike(x - 1, y - 5, x - 8, y - 9 + f, 4, 'h');
      g.spike(x - 3, y - 4, x - 11, y - 4 + f, 4, 'h');
      g.spike(x - 4, y - 2, x - 9, y + 2 + f, 3, 'h');
      g.line(x - 2, y - 6, x - 7, y - 8 + f, 'R');
      g.line(x - 4, y - 3, x - 10, y - 3 + f, 'H');
    },
    weapon: wFront(greatsword),
    front(g, J, view) {
      if (view === 'se') {
        // Heavy arm plates over the base limb.
        g.capsule(J.shF.x, J.shF.y, J.elF.x, J.elF.y, 2, 'd');
        g.capsule(J.elF.x, J.elF.y, J.handF.x, J.handF.y, 1.8, 'A');
        g.ell(J.elF.x, J.elF.y, 1.3, 1.3, 'K');
        g.ell(J.handF.x, J.handF.y, 1.7, 1.6, 'F');
        // Near pauldron over the arm.
        g.ell(J.shF.x + 0.5, J.shF.y, 3.2, 2.6, 'P');
        g.line(J.shF.x - 2, J.shF.y + 2, J.shF.x + 3, J.shF.y + 2, 'y');
      } else {
        g.ell(J.shB.x - 0.5, J.shB.y, 3.2, 2.6, 'P');
        g.line(J.shB.x - 3, J.shB.y + 2, J.shB.x + 2, J.shB.y + 2, 'y');
      }
    },
  }), 4);

  const KGUARD = { armF: [0.9, 0.9], wpn: Math.PI, two: 3 };
  define('knight', {
    body: { leg: 13, torso: 10, headR: 5, shoulder: 4, upper: 5.5, fore: 5, hipW: 2.5, stance: 4 },
    size: 64,
    pal: KNIGHT_PAL,
    detail: 'eGyYrgRHXS',
    magic: '#bc84e4',
    anims: {
      // Greatsword planted point-down, both gauntlets on the pommel.
      idle: { loop: true, frames: [
        { ms: 600, ...KGUARD },
        { ms: 600, bob: 1, ...KGUARD, armF: [0.95, 0.85] },
      ] },
      // Heavy stride, blade shouldered.
      walk: { loop: true, frames: [
        { ms: 160, footF: [3, 0], footB: [-3, 0], armF: [0.35, 0.35], wpn: 2.3, armB: [0.35, 0.4], bob: 0 },
        { ms: 160, footF: [0, 0], footB: [1, 2], armF: [0.4, 0.35], wpn: 2.3, armB: [0, 0.4], bob: -1 },
        { ms: 160, footF: [-3, 0], footB: [3, 0], armF: [0.45, 0.35], wpn: 2.25, armB: [-0.35, 0.4], bob: 0 },
        { ms: 160, footF: [1, 2], footB: [0, 0], armF: [0.4, 0.35], wpn: 2.3, armB: [0, 0.4], bob: -1 },
      ] },
      // Two-handed overhead cleave: heave up, hang, crash down, bite the ground, recover.
      attack: { frames: [
        { ms: 150, lean: -0.2, crouch: 1, armF: [2.6, 0.4], wpn: -1.1, two: 4, wback: true, footF: [1, 0], footB: [-3, 0], tilt: -1 },
        { ms: 120, lean: -0.3, crouch: 0, x: -1, armF: [2.9, 0.3], wpn: -1.8, two: 4, wback: true, footF: [2, 0], footB: [-3, 0], tilt: -1 },
        { ms: 60, lean: 0.2, crouch: 1, x: 1, armF: [2.3, 0], wpn: 0.85, two: 4, footF: [5, 0], footB: [-4, 0], tilt: 1 },
        { ms: 220, lean: 0.45, crouch: 4, x: 1, armF: [0.9, 0.2], wpn: 2.45, two: 4, footF: [6, 0], footB: [-4, 0], tilt: 1, nod: 1 },
        { ms: 160, lean: 0.15, crouch: 1, x: 1, ...KGUARD, footF: [2, 0], footB: [-2, 0] },
      ] },
      // Dark Staff: blade raised before the visor, then driven into the ground.
      cast: { frames: [
        { ms: 170, lean: -0.1, crouch: 1, armF: [1.3, 1.3], wpn: 0.05, two: 3, tilt: -1 },
        { ms: 170, lean: -0.1, crouch: 1, bob: -1, armF: [1.35, 1.35], wpn: 0.0, two: 3, tilt: -1 },
        { ms: 280, lean: 0.3, crouch: 4, x: 1, armF: [1.0, 0.4], wpn: Math.PI - 0.2, two: 3, footF: [3, 0], footB: [-4, 0], nod: 1 },
      ], charge: [0, 1], release: 2, rim: true },
      // Levelled thrust.
      shoot: { frames: [
        { ms: 150, lean: -0.1, x: -3, armF: [1.0, 0.5], wpn: 1.3, two: 4, footF: [2, 0], footB: [-3, 0] },
        { ms: 160, lean: 0.3, x: -1, crouch: 2, armF: [1.3, 0], wpn: 1.85, two: 4, footF: [5, 0], footB: [-3, 0], tilt: 1 },
      ] },
      hurt: { frames: [{ ms: 300, lean: -0.3, x: -2, crouch: 1, armF: [0.4, 0.5], wpn: 2.7, armB: [0.8, 0.5], tilt: -1, nod: 1, footF: [1, 0], footB: [-3, 0], hurt: true }] },
      ko: { frames: [{ ms: 1000, lean: -0.2, crouch: 2, armF: [0.2, 0.2], wpn: 1.6, armB: [0.2, 0.1], nod: 1, ko: true, hurt: true }] },
      kneel: { frames: [{ ms: 1000, lean: 0.25, crouch: 5, footF: [3, 0], footB: [-5, 0], armF: [0.9, 0.9], wpn: Math.PI, two: 3, nod: 1 }] },
      victory: { loop: true, frames: [
        { ms: 320, armF: [2.2, 0.6], wpn: 0.15, armB: [-0.2, 0.5], tilt: -1 },
        { ms: 320, armF: [2.3, 0.5], wpn: 0.3, armB: [-0.4, 0.7], tilt: -1, bob: -1 },
      ] },
    },
    draw: knightDraw,
  });

  // =====================================================================================
  // DIVERS (Skirmish extras): bulky suits, round helmets with a front porthole, back
  // tanks with a hose, harpoon guns. Dave: olive camo suit, gunmetal helmet, masked
  // face, long speargun with a trident spear. Mat: red suit with silver plates, silver
  // helmet with a red crown, face visible through the glass, stubby grapnel launcher.
  // =====================================================================================
  const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  function camo(g, J, letters, dark, light) {
    const hx = Math.round(J.hip.x), hy = Math.round(J.hip.y);
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (!letters.includes(g.a[y][x])) continue;
        const u = Math.floor((x - hx + 64) / 3), v = Math.floor((y - hy + 64 + (u & 1)) / 2);
        const r = hash(u, v);
        if (r < 0.22) g.a[y][x] = dark;
        else if (r > 0.88) g.a[y][x] = light;
      }
  }
  function diverDraw(o) {
    function gun(g, J, view, pose) {
      const A = (k, s) => at(J, k, s);
      if (o.kind === 'spear') {
        // Speargun: wooden stock and pistol grip, dark barrel, loaded trident spear.
        g.capsule(...A(-6, 0.5), ...A(-1, 0.5), 1.1, 'W');
        g.capsule(...A(-1, 0), ...A(9, 0), 0.7, 'B');
        g.capsule(...A(0, 1), ...A(0.5, 3), 0.5, 'W');
        g.px(...A(4, 1), 'r');
        g.px(...A(6, 1), 'r');
        if (!pose.fired) {
          g.line(...A(-1, -1), ...A(12, -1), 'x');
          g.line(...A(12, -2.5), ...A(12, 0.5), 'x');
          for (const sd of [-2.5, -1, 0.5]) g.px(...A(13.5, sd), 'x');
          g.px(...A(14.5, -1), 'x');
        } else {
          g.line(...A(8, -1), ...A(11, -2), 'r');
        }
      } else {
        // Grapnel launcher: fat barrel with a coil of line, three-claw grapnel head.
        g.capsule(...A(-4, 0), ...A(6, 0), 1.2, 'B');
        g.capsule(...A(-1, 1.5), ...A(-0.5, 3.5), 0.6, 'B');
        g.ell(...A(-2, -2), 1.4, 1.4, 'r');
        g.px(...A(2, -1), 'y');
        g.px(...A(3, -1), 'y');
        if (!pose.fired) {
          g.line(...A(7, 0), ...A(9, 0), 'x');
          g.spike(...A(9, 0), ...A(12, 0), 2, 'x');
          g.line(...A(9, 0), ...A(11, 2.5), 'x');
          g.line(...A(9, 0), ...A(11, -2.5), 'x');
          g.px(...A(10, 3), 'x');
          g.px(...A(10, -3), 'x');
        } else {
          g.line(...A(6, 0), ...A(8, 1), 'r');
          g.line(...A(8, 1), ...A(10, 0), 'r');
        }
      }
      if (pose.fired === 1) {
        // Muzzle burst of bubbles.
        for (const [k, sd, r] of [[11, 0, 1.2], [13, -2, 0.8], [13, 2, 0.8], [15, 0, 0.6]]) g.ell(...A(k, sd), r, r, 'G');
      }
    }
    function tank(g, J, view) {
      const c = J.chest, h = J.hip;
      const bx = view === 'se' ? -4.5 : -1.5;
      const tops = o.tanks === 2 ? [bx - 1.2, bx + 2.2] : [bx];
      for (const t of tops) {
        const y0 = view === 'se' ? c.y - 3 : c.y + 1;
        g.capsule(c.x + t, y0, h.x + t - 0.5, h.y - 1, o.tanks === 2 ? 1.9 : 2.6, 'T');
        g.rect(Math.round(c.x + t) - 1, Math.round(y0 - 2), Math.round(c.x + t), Math.round(y0 - 1), 'B');
      }
      if (view === 'ne') g.line(c.x + bx - 3, c.y + 4, c.x + bx + 4, c.y + 4, 'B');
    }
    function helmet(g, J, view) {
      const H = J.head, x = Math.round(H.x), y = Math.round(H.y);
      g.ell(x, y, 6.2, 6, 'M');
      // Crown panel.
      g.ell(x - 0.5, y - 3.5, 5.2, 2.6, 'K');
      repl(g, x - 7, y - 1, x + 7, y + 1, 'K', 'M');
      // Collar ring and bolts.
      g.rect(x - 5, y + 5, x + 5, y + 6, 'N');
      if (view === 'se') {
        g.ell(x + 2, y + 0.5, 3.6, 3.3, 'N');
        g.ell(x + 2, y + 0.5, 2.5, 2.3, 'w');
        if (o.face) {
          g.ell(x + 2, y + 1, 1.7, 1.7, 's');
          if (J.pose.hurt) { g.line(x + 1, y + 0.5, x + 2, y + 0.5, 'e'); g.px(x + 4, y + 0.5, 'e'); }
          else { g.rect(x + 1, y, x + 1, y + 1, 'e'); g.rect(x + 3, y, x + 3, y + 1, 'e'); }
          g.line(x + 1, y + 2, x + 4, y + 2, 'h');
          g.px(x + 3, y - 1, 'E');
        } else {
          // Mask: two dark lenses and a regulator.
          g.rect(x, y - 1, x + 1, y + 1, 'e');
          g.rect(x + 3, y - 1, x + 4, y + 1, 'e');
          g.px(x + 1, y - 1, J.pose.hurt ? 'e' : 'E');
          g.rect(x + 1, y + 2, x + 3, y + 3, 'B');
        }
        g.px(x + 4, y - 2, 'G');
        for (const [dx, dy] of [[-1, -1], [-1, 3], [5, -3], [6, 3]]) g.px(x + dx, y + dy, 'y');
        // Side port.
        g.ell(x - 3, y + 1, 1.3, 1.3, 'N');
      } else {
        g.ell(x - 1, y + 1, 1.6, 1.6, 'N');
        g.px(x - 1, y + 1, 'B');
        for (const [dx, dy] of [[-5, 2], [4, 2], [-1, -4]]) g.px(x + dx, y + dy, 'y');
      }
      // Air hose from the tank to the back of the helmet.
      const tx = J.chest.x + (view === 'se' ? -5 : -2), ty = J.chest.y - 4;
      g.line(tx, ty, x - 5, y + 3, 'H');
      g.line(x - 5, y + 3, x - 5, y + 4, 'H');
    }
    return twoHanded(human({
      width: 5,
      behind(g, J, view) {
        if (view === 'se') tank(g, J, view);
        knightLeg(g, J.hipB, J.kneeB, J.footB, 'q', o.pads ? 'O' : 'q', 'o');
      },
      legs(g, J, view) {
        knightLeg(g, J.hipF, J.kneeF, J.footF, 'p', o.pads ? 'P' : 'p', 'b');
      },
      torso(g, J, view) {
        const c = J.chest, h = J.hip;
        // Weight belt with pouches.
        g.capsule(h.x - 5, h.y - 1, h.x + 4.5, h.y - 1 + J.lean * 3, 1, 'l');
        if (view === 'se') {
          g.rect(Math.round(h.x) + 2, Math.round(h.y) - 2, Math.round(h.x) + 3, Math.round(h.y), 'Y');
          g.rect(Math.round(h.x) - 3, Math.round(h.y) - 2, Math.round(h.x) - 2, Math.round(h.y), 'Y');
          if (o.stripe) g.line(c.x - 4, c.y + 3, c.x + 4, c.y + 3, 'P');
          // Harness straps.
          g.line(c.x - 3, c.y - 1, c.x + 1, h.y - 2, 'l');
          g.line(c.x + 3, c.y - 1, c.x + 3, h.y - 2, 'l');
        } else if (o.stripe) g.line(c.x - 4, c.y + 3, c.x + 4, c.y + 3, 'P');
        if (o.pads) {
          g.ell(J.shB.x, J.shB.y, 2.2, 1.8, 'O');
        }
      },
      face() {},
      hair: helmet,
      weapon: wFront(gun),
      front(g, J, view) {
        if (view === 'ne') tank(g, J, view);
        const sh = view === 'se' ? J.shF : J.shB, el = view === 'se' ? J.elF : J.elB, hd = view === 'se' ? J.handF : J.handB;
        const S1 = view === 'se' ? 'd' : 'D', S2 = view === 'se' ? 'A' : 'a', GL = view === 'se' ? 'F' : 'f';
        g.capsule(sh.x, sh.y, el.x, el.y, 1.9, S1);
        g.capsule(el.x, el.y, hd.x, hd.y, 1.7, S2);
        g.ell(hd.x, hd.y, 1.6, 1.6, GL);
        if (o.pads) { g.ell(sh.x + 0.5, sh.y, 2.4, 2, 'P'); g.ell(el.x, el.y, 1.2, 1.2, 'P'); }
        if (o.camo) camo(g, J, 'cdDpqAa', 'Z', 'z');
      },
    }), 5);
  }
  // Gun-handler animations (wpn = barrel axis; pi/2 = level, aimed forward).
  const PORT = { armF: [0.35, 0.55], wpn: 2.25, two: 5 };
  const DIVER_ANIMS = {
    idle: { loop: true, frames: [
      { ms: 560, ...PORT },
      { ms: 560, bob: 1, ...PORT, armF: [0.3, 0.6] },
    ] },
    walk: { loop: true, frames: [
      { ms: 150, footF: [3, 0], footB: [-3, 0], ...PORT, bob: 0 },
      { ms: 150, footF: [0, 0], footB: [1, 2], ...PORT, armF: [0.4, 0.55], bob: -1 },
      { ms: 150, footF: [-3, 0], footB: [3, 0], ...PORT, armF: [0.45, 0.5], bob: 0 },
      { ms: 150, footF: [1, 2], footB: [0, 0], ...PORT, armF: [0.4, 0.55], bob: -1 },
    ] },
    // Bayonet jab with the gun's business end.
    attack: { frames: [
      { ms: 150, lean: -0.15, x: -2, crouch: 1, armF: [0.5, 0.6], wpn: 1.7, two: 5, footF: [1, 0], footB: [-3, 0], tilt: -1 },
      { ms: 70, lean: 0.3, x: 1, crouch: 2, armF: [1.2, 0.1], wpn: 1.65, two: 5, footF: [5, 0], footB: [-4, 0], tilt: 1 },
      { ms: 170, lean: 0.35, x: 1, crouch: 2, armF: [1.0, 0.2], wpn: 1.85, two: 5, footF: [5, 0], footB: [-4, 0], tilt: 1 },
      { ms: 140, lean: 0.1, crouch: 1, ...PORT, footF: [2, 0], footB: [-2, 0] },
    ] },
    // Signal / tech: gun raised in the near hand, free hand thrown forward.
    cast: { frames: [
      { ms: 170, lean: -0.1, crouch: 1, armF: [2.0, 0.6], wpn: 0.2, armB: [1.3, 0.1], tilt: -1, nod: -1 },
      { ms: 170, lean: -0.1, crouch: 1, bob: -1, armF: [2.05, 0.55], wpn: 0.15, armB: [1.4, 0], tilt: -1, nod: -1 },
      { ms: 260, lean: 0.2, x: 1, armF: [1.2, 0.4], wpn: 1.3, armB: [1.7, -0.1], footF: [3, 0], footB: [-3, 0], tilt: 1 },
    ], charge: [0, 1], release: 2, rim: true },
    // Shoulder, aim, fire (bubble burst), recoil with the line paying out.
    shoot: { frames: [
      { ms: 200, lean: 0.05, x: -2, armF: [1.05, 0.55], wpn: 1.57, two: 5, footF: [2, 0], footB: [-3, 0], nod: 1 },
      { ms: 80, lean: 0.05, x: -2, armF: [1.05, 0.55], wpn: 1.57, two: 5, footF: [2, 0], footB: [-3, 0], nod: 1, fired: 1 },
      { ms: 220, lean: -0.2, x: -3, armF: [1.2, 0.6], wpn: 1.3, two: 5, footF: [2, 0], footB: [-3, 0], tilt: -1, fired: 2 },
    ] },
    hurt: { frames: [{ ms: 300, lean: -0.35, x: -2, crouch: 1, armF: [0.2, 0.8], wpn: 2.8, armB: [0.9, 0.5], tilt: -1, nod: 1, footF: [1, 0], footB: [-3, 0], hurt: true }] },
    ko: { frames: [{ ms: 1000, lean: -0.2, crouch: 2, armF: [0.2, 0.2], wpn: 1.6, armB: [0.2, 0.1], nod: 1, ko: true, hurt: true }] },
    kneel: { frames: [{ ms: 1000, lean: 0.3, crouch: 5, footF: [3, 0], footB: [-5, 0], armF: [0.7, 0.7], wpn: 0.3, armB: [0.3, 0.6], nod: 1 }] },
    victory: { loop: true, frames: [
      { ms: 300, armF: [2.8, 0.1], wpn: 1.5, armB: [-0.3, 0.5], tilt: -1, bob: -1 },
      { ms: 300, armF: [2.9, 0.05], wpn: 1.3, armB: [-0.3, 0.5], tilt: -1, y: -2 },
    ] },
  };
  const DIVER_BODY = { leg: 11, torso: 9, headR: 6, shoulder: 4, upper: 5, fore: 5, hipW: 2.5, stance: 3 };

  define('dave', {
    body: DIVER_BODY,
    pal: {
      c: '#7a665a', d: '#7a665a', D: '#5a4a44', A: '#7a665a', a: '#5a4a44', p: '#7a665a', q: '#5a4a44',
      Z: '#1c4428', z: '#9c8674', F: '#3a3a52', f: '#2a2038', b: '#3a3a52', o: '#2a2038',
      M: '#52526e', K: '#9c8674', N: '#6e7090', w: '#3c64b4', e: '#1a1226', E: '#c4e4ff', G: '#c4e4ff', s: '#e0a878', S: '#3a3a52', h: '#5a4a44',
      y: '#9294b0', Y: '#2c6430', l: '#2a2038', H: '#1a1226',
      T: '#48a894', B: '#2a2038', W: '#6e4222', x: '#e4e8f0', r: '#9294b0',
    },
    detail: 'eEGyHrZz',
    magic: '#8cc0f0',
    anims: DIVER_ANIMS,
    draw: diverDraw({ kind: 'spear', camo: true, tanks: 1 }),
  });
  define('mat', {
    body: DIVER_BODY,
    pal: {
      c: '#d43c3c', d: '#d43c3c', D: '#a02030', A: '#d43c3c', a: '#a02030', p: '#d43c3c', q: '#a02030',
      P: '#bcc0d4', O: '#9294b0', F: '#3a3a52', f: '#2a2038', b: '#3a3a52', o: '#2a2038',
      M: '#bcc0d4', K: '#d43c3c', N: '#6e7090', w: '#8cc0f0', e: '#1a1226', E: '#ffffff', G: '#c4e4ff', s: '#f8d0a8', S: '#3a3a52', h: '#6e4222',
      y: '#f8bc3c', Y: '#f8bc3c', l: '#3a3a52', H: '#1a1226',
      T: '#6e7090', B: '#3a3a52', x: '#8cc0f0', r: '#dcb468',
    },
    detail: 'eEGyHrhs',
    magic: '#8cc0f0',
    anims: DIVER_ANIMS,
    draw: diverDraw({ kind: 'grapnel', face: true, pads: true, stripe: true, tanks: 2 }),
  });

  // =====================================================================================
  // SPEKKIO, Master of War (the small form): a round pink spirit with cream horns,
  // floppy ears, a purple tuft, beady eyes, a cream belly and stubby arms and feet.
  // Hand-drawn from the pose: crouch squashes (negative stretches), y hops.
  // =====================================================================================
  function spekkioDraw(g, J, view, pose) {
    const c = pose.crouch || 0, lean = pose.lean || 0;
    const rx = 9.5 + c * 0.5, ry = 9 - c * 0.55;
    const bx = RX + (pose.x || 0), by = RY + (pose.y || 0) - 2 + (pose.bob || 0) * 0;
    const cx = bx + lean * 3, cy = by - ry + 1 + (pose.bob || 0);
    const fF = pose.footF || [0, 0], fB = pose.footB || [0, 0];
    const ex = lean * 3 + (pose.tilt || 0) * 0.5, ey = (pose.nod || 0);
    // Feet.
    g.ell(bx - 3.5 + fB[0] * 0.5, RY + (pose.y || 0) - 1 - fB[1], 2.6, 1.5, 'o');
    // Far arm and ear.
    const arm = (a, sx, sy, L) => { const ax = sx + Math.sin(a[0]) * 5.5, ay = sy + Math.cos(a[0]) * 5.5; g.capsule(sx, sy, ax, ay, 2.3, 'P'); g.capsule(sx, sy, ax, ay, 1.4, L); };
    const aF = pose.armF || [0.4, 0], aB = pose.armB || [-0.4, 0];
    g.spike(cx - rx + 3, cy - ry * 0.45 + ey * 0.5, cx - rx - 3, cy - ry * 0.2 + ey * 0.5 + (c > 1 ? 2 : 0), 4, 'u');
    if (view === 'se') arm(aB, cx - rx + 1, cy + 1, 'a');
    // Far horn behind.
    g.spike(cx - 3 + ex * 0.5, cy - ry + 2, cx - 7 + ex * 0.5, cy - ry - 6, 3.6, 'h');
    // Body: shadow crescent bottom-right, highlight top-left.
    g.ell(cx, cy, rx, ry, 'q');
    g.ell(cx - 1, cy - 1, rx - 1.2, ry - 1.2, 'p');
    g.ell(cx - rx * 0.4, cy - ry * 0.45, 2, 1.3, 'L');
    g.ell(bx + 3.5 + fF[0] * 0.5, RY + (pose.y || 0) - 1 - fF[1], 2.6, 1.5, 'b');
    if (view === 'se') {
      // Belly, face.
      g.ell(cx + 2 + ex * 0.4, cy + ry * 0.35, rx * 0.55, ry * 0.5, 'z');
      const x = Math.round(cx + 1 + ex), y = Math.round(cy - 3 + ey);
      if (pose.hurt) {
        g.line(x - 1, y, x + 1, y + 1, 'e'); g.line(x - 1, y + 2, x + 1, y + 1, 'e');
        g.line(x + 5, y, x + 4, y + 1, 'e'); g.line(x + 5, y + 2, x + 4, y + 1, 'e');
        g.ell(x + 2.5, y + 5, 1.2, 1, 'm');
      } else if (pose.shut) {
        g.line(x - 1, y + 1, x + 1, y + 1, 'e');
        g.line(x + 4, y + 1, x + 5, y + 1, 'e');
        g.line(x, y + 4, x + 4, y + 4, 'm');
      } else {
        g.rect(x, y - 1, x + 1, y + 2, 'e');
        g.rect(x + 4, y - 1, x + 4, y + 2, 'e');
        g.px(x, y - 1, 'E');
        g.px(x + 4, y - 1, 'E');
        // Wide grin.
        g.line(x, y + 4, x + 4, y + 4, 'm');
        g.px(x - 1, y + 3, 'm');
        g.px(x + 5, y + 3, 'm');
        if (pose.grin) g.line(x + 1, y + 5, x + 3, y + 5, 'm');
      }
      g.px(x - 2, y + 2, 'B');
      g.px(x + 6, y + 2, 'B');
    } else {
      // Back: a seam down the back and a little tail.
      g.line(cx - 1, cy - ry + 3, cx - 2, cy + ry - 2, 'P');
      g.ell(cx - 1, cy + ry - 3, 1.5, 1.2, 'z');
    }
    // Near ear, near horn, tuft.
    const e0 = [cx + rx - 3, cy - ry * 0.45 + ey * 0.5], e1 = [cx + rx + 3, cy - ry * 0.2 + ey * 0.5 + (c > 1 ? 2 : 0)];
    g.spike(e0[0] - 0.5, e0[1], e1[0] + 1, e1[1], 5.5, 'P');
    g.spike(...e0, ...e1, 4, 'U');
    g.line(cx + rx - 1, cy - ry * 0.35 + ey * 0.5, cx + rx + 1, cy - ry * 0.25 + ey * 0.5, 'I');
    g.spike(cx + 3 + ex * 0.5, cy - ry + 2, cx + 7 + ex * 0.5, cy - ry - 6, 3.6, 'n');
    for (const [dx, tx, ty] of [[-1, -2, -6], [0.5, 1, -7], [1.5, 3.5, -5]]) g.spike(cx + dx + ex * 0.5, cy - ry + 2, cx + tx + ex * 0.5, cy - ry + ty + 2, 2.4, 't');
    g.line(cx + ex * 0.5, cy - ry + 1, cx + 1 + ex * 0.5, cy - ry - 3, 'T');
    if (view === 'se') arm(aF, cx + rx - 1, cy + 1, 'A');
    else { arm(aB, cx - rx + 1, cy + 1, 'a'); arm(aF, cx + rx - 1, cy + 1, 'A'); }
  }
  define('spekkio', {
    pal: {
      p: '#f090b4', q: '#e0709c', L: '#f8b0c8', P: '#6c2048', z: '#f8b0c8', u: '#a83c74', U: '#f090b4', I: '#f8b0c8',
      a: '#a83c74', A: '#f090b4', o: '#a83c74', b: '#e0709c',
      h: '#dcb468', n: '#fff4b0', t: '#6c3094', T: '#bc84e4',
      e: '#1a1226', E: '#ffffff', m: '#6c2048', B: '#f06c4c',
    },
    detail: 'eEmBTIPzLpqAaUuob',
    hi: false,
    magic: '#fce068',
    anims: {
      idle: { loop: true, frames: [
        { ms: 420, armF: [0.5, 0], armB: [-0.5, 0] },
        { ms: 420, crouch: 1.5, armF: [0.7, 0], armB: [-0.7, 0] },
      ] },
      // Hops: squat, spring, float, land.
      walk: { loop: true, frames: [
        { ms: 110, crouch: 2, armF: [0.8, 0], armB: [-0.8, 0] },
        { ms: 130, crouch: -1.5, y: -4, footF: [1, 1], footB: [-1, 1], armF: [2.2, 0], armB: [-2.2, 0] },
        { ms: 130, crouch: -0.5, y: -5, footF: [1, 1], footB: [-1, 1], armF: [2.0, 0], armB: [-2.0, 0] },
        { ms: 110, crouch: 2.5, y: 0, armF: [1.2, 0], armB: [-1.2, 0] },
      ] },
      // Leap and belly-flop punch.
      attack: { frames: [
        { ms: 130, crouch: 3, x: -1, armF: [-0.6, 0], armB: [-1.2, 0], shut: true },
        { ms: 110, crouch: -2, y: -7, x: 2, lean: 0.3, armF: [2.6, 0], armB: [2.4, 0], footF: [1, 2], footB: [-1, 2] },
        { ms: 170, crouch: 3.5, x: 5, lean: 0.4, armF: [1.7, 0], armB: [1.2, 0], grin: true, nod: 1 },
        { ms: 140, crouch: 1, x: 2, armF: [0.5, 0], armB: [-0.5, 0] },
      ] },
      // Arms up, gathering; then a two-handed push.
      cast: { frames: [
        { ms: 160, crouch: -1, armF: [2.3, 0], armB: [-2.3, 0], shut: true, nod: -1 },
        { ms: 160, crouch: -1.5, y: -1, armF: [2.45, 0], armB: [-2.45, 0], shut: true, nod: -1 },
        { ms: 260, crouch: 1, x: 2, lean: 0.3, armF: [1.6, 0], armB: [1.5, 0], grin: true },
      ], charge: [0, 1], release: 2, rim: true },
      // Wind-up and throw.
      shoot: { frames: [
        { ms: 150, crouch: 1, x: -1, lean: -0.3, armF: [-2.2, 0], armB: [-0.6, 0] },
        { ms: 170, crouch: -0.5, x: 2, lean: 0.3, armF: [1.8, 0], armB: [-1.0, 0], grin: true },
      ] },
      hurt: { frames: [{ ms: 300, crouch: 2.5, x: -3, lean: -0.3, armF: [2.4, 0], armB: [-2.4, 0], hurt: true }] },
      ko: { frames: [{ ms: 1000, crouch: 3.5, armF: [1.5, 0], armB: [-1.5, 0], hurt: true, ko: true }] },
      kneel: { frames: [{ ms: 1000, crouch: 1.5, lean: 0.35, nod: 2, armF: [0.2, 0], armB: [-0.2, 0], shut: true }] },
      victory: { loop: true, frames: [
        { ms: 260, crouch: 2.5, armF: [2.4, 0], armB: [-2.4, 0], grin: true },
        { ms: 260, crouch: -1.5, y: -6, footF: [1, 2], footB: [-1, 2], armF: [2.5, 0], armB: [-2.5, 0], grin: true },
      ] },
    },
    draw: spekkioDraw,
  });
})();
