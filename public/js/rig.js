// Pose-driven procedural sprites.
//
// Every character is drawn by code from a pose: a small set of parameters
// (hip bob, lean, feet, arm angles, weapon angle, head tilt...). The rig solves
// a skeleton from the pose (two-bone IK for legs, angles for arms), the
// character's draw() paints hand-authored parts attached to the joints onto a
// letter grid, and the frame is baked: outline + cel shading (CT.PX.shadeGrid),
// snapped to the master palette, optionally rim-lit by magic. Animations are
// short keyframe lists sampled like a 10 fps sprite sheet.
//
// See docs/ART_SPEC.md for the authoring contract.
(function () {
  const CT = (window.CT = window.CT || {});
  const { Grid, shadeGrid, flashOf, bbox } = CT.PX;

  const SIZE = 56; // frame canvas (before the 1px outline pad)
  const RX = 28; // root (ground point between the feet)
  const RY = 50;

  // ---- Grid extensions ---------------------------------------------------------------
  // Thick segment with rounded ends (limbs, hafts).
  Grid.prototype.capsule = function (x0, y0, x1, y1, r, c) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (r <= 0.5) this.px(x, y, c);
      else this.ell(x, y, r - 0.5, r - 0.5, c);
    }
  };
  // Filled polygon from [[x,y],...].
  Grid.prototype.poly = function (pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c);
    }
  };
  // Letter rows anchored so that (ax, ay) inside the rows lands on (x, y).
  Grid.prototype.stamp = function (x, y, ax, ay, rows, flip) {
    const X = Math.round(x), Y = Math.round(y);
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) {
        const c = r[i];
        if (c === '.' || c === ' ') continue;
        this.px(flip ? X + (ax - i) : X + (i - ax), Y + (j - ay), c);
      }
    });
  };

  // ---- Skeleton ------------------------------------------------------------------------
  // Body metrics (px): override per character with def.body.
  const BODY = { leg: 12, torso: 9, neck: 2, headR: 5, shoulder: 3, upper: 5, fore: 5, hipW: 2, stance: 3 };

  const V = (x, y) => ({ x, y });
  const add = (a, b, k = 1) => V(a.x + b.x * k, a.y + b.y * k);
  const dirA = (a) => V(Math.sin(a), Math.cos(a)); // angle from straight down; + swings forward (+x)

  function legIK(hip, foot, L1, L2) {
    let dx = foot.x - hip.x, dy = foot.y - hip.y;
    let d = Math.hypot(dx, dy) || 0.001;
    const max = L1 + L2 - 0.01;
    if (d > max) { foot = V(hip.x + (dx / d) * max, hip.y + (dy / d) * max); dx = foot.x - hip.x; dy = foot.y - hip.y; d = max; }
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const mx = hip.x + (dx * a) / d, my = hip.y + (dy * a) / d;
    // knee bends forward (+x)
    const px = dy / d, py = -dx / d;
    return { knee: V(mx + px * h, my + py * h), foot };
  }

  // pose -> joints (sprite-local coordinates, root at RX,RY)
  function solve(p, body) {
    const B = Object.assign({}, BODY, body);
    const root = V(RX + (p.x || 0), RY + (p.y || 0));
    const hip = V(root.x + (p.hipX || 0), root.y - B.leg + (p.crouch || 0) + (p.bob || 0));
    const lean = p.lean || 0;
    const up = V(Math.sin(lean), -Math.cos(lean));
    const chest = add(hip, up, B.torso);
    const neck = add(chest, up, B.neck);
    const head = V(neck.x + up.x * B.headR + (p.tilt || 0), neck.y + up.y * B.headR + (p.nod || 0));
    const ff = p.footF || [0, 0], fb = p.footB || [0, 0];
    const footF0 = V(root.x + B.stance + ff[0], root.y - (ff[1] || 0));
    const footB0 = V(root.x - B.stance + fb[0], root.y - (fb[1] || 0));
    const hipF = V(hip.x + B.hipW, hip.y), hipB = V(hip.x - B.hipW + 1, hip.y);
    const lf = legIK(hipF, footF0, B.leg / 2, B.leg / 2);
    const lb = legIK(hipB, footB0, B.leg / 2, B.leg / 2);
    const shF = add(chest, V(B.shoulder - 1, 1)), shB = add(chest, V(-B.shoulder, 1));
    const aF = p.armF || [0.15, 0.3], aB = p.armB || [-0.1, 0.25];
    const elF = add(shF, dirA(aF[0]), B.upper), elB = add(shB, dirA(aB[0]), B.upper);
    const handF = add(elF, dirA(aF[0] + aF[1]), B.fore), handB = add(elB, dirA(aB[0] + aB[1]), B.fore);
    const wa = p.wpn != null ? p.wpn : aF[0] + aF[1] + Math.PI / 2; // default: perpendicular to forearm
    return {
      B, root, hip, chest, neck, head, up, lean, hipF, hipB,
      kneeF: lf.knee, footF: lf.foot, kneeB: lb.knee, footB: lb.foot,
      shF, shB, elF, elB, handF, handB,
      wpn: wa, wdir: V(Math.sin(wa), -Math.cos(wa)), // weapon axis: 0 = pointing up, + tips forward
      pose: p,
    };
  }

  // ---- Standard animations -------------------------------------------------------------
  // Each: { loop, frames: [{ ms, ...pose }] }. Characters can override or add.
  const IDLE_ARMS = { armF: [0.2, 0.5], armB: [-0.15, 0.35] };
  const STD = {
    idle: { loop: true, frames: [{ ms: 520, ...IDLE_ARMS }, { ms: 520, bob: 1, ...IDLE_ARMS, armF: [0.15, 0.55], armB: [-0.1, 0.4] }] },
    walk: {
      loop: true,
      frames: [
        { ms: 130, footF: [3, 0], footB: [-3, 0], armF: [-0.35, 0.4], armB: [0.4, 0.4], bob: 0 },
        { ms: 130, footF: [0, 0], footB: [1, 2], armF: [0, 0.4], armB: [0, 0.4], bob: -1 },
        { ms: 130, footF: [-3, 0], footB: [3, 0], armF: [0.4, 0.4], armB: [-0.35, 0.4], bob: 0 },
        { ms: 130, footF: [1, 2], footB: [0, 0], armF: [0, 0.4], armB: [0, 0.4], bob: -1 },
      ],
    },
    // Melee: wind-up, strike (lunge), follow-through, settle.
    attack: {
      frames: [
        { ms: 140, lean: -0.15, crouch: 1, wpn: -1.2, armF: [2.7, 0.5], armB: [-0.6, 0.6], footF: [1, 0], footB: [-2, 0], tilt: -1 },
        { ms: 70, lean: 0.35, crouch: 2, x: 3, wpn: 1.7, armF: [1.25, 0.1], armB: [-0.9, 0.3], footF: [5, 0], footB: [-4, 0], tilt: 1 },
        { ms: 170, lean: 0.3, crouch: 2, x: 3, wpn: 2.3, armF: [0.5, 0.2], armB: [-0.7, 0.3], footF: [5, 0], footB: [-4, 0], tilt: 1 },
        { ms: 140, lean: 0.1, crouch: 1, x: 1, ...IDLE_ARMS, footF: [2, 0], footB: [-2, 0] },
      ],
    },
    // Spellcasting: gather (loopable pair), then release.
    cast: {
      frames: [
        { ms: 160, lean: -0.1, armF: [2.3, -0.4], armB: [2.0, -0.3], tilt: -1, nod: -1, crouch: 1 },
        { ms: 160, lean: -0.1, armF: [2.4, -0.5], armB: [2.1, -0.4], tilt: -1, nod: -1, crouch: 1, bob: -1 },
        { ms: 260, lean: 0.2, armF: [1.55, -0.05], armB: [1.4, 0], tilt: 1, footF: [2, 0], footB: [-3, 0] },
      ],
      charge: [0, 1], release: 2, rim: true,
    },
    // Ranged: aim, recoil.
    shoot: {
      frames: [
        { ms: 150, lean: 0.05, armF: [1.55, 0], armB: [1.35, 0.3], footF: [2, 0], footB: [-3, 0] },
        { ms: 150, lean: -0.15, x: -1, armF: [1.8, -0.1], armB: [1.5, 0.3], footF: [2, 0], footB: [-3, 0], tilt: -1 },
      ],
    },
    hurt: { frames: [{ ms: 300, lean: -0.35, x: -2, crouch: 1, armF: [-0.6, 0.6], armB: [0.9, 0.5], tilt: -1, nod: 1, footF: [1, 0], footB: [-3, 0], hurt: true }] },
    ko: { frames: [{ ms: 1000, lean: -0.2, crouch: 2, armF: [0.1, 0.1], armB: [0.2, 0.1], nod: 1, ko: true }] },
    kneel: { frames: [{ ms: 1000, lean: 0.35, crouch: 5, footF: [3, 0], footB: [-5, 0], armF: [0.6, 0.9], armB: [0.2, 0.5], nod: 1 }] },
    victory: {
      loop: true,
      frames: [
        { ms: 300, armF: [2.9, 0.1], armB: [-0.3, 0.4], tilt: -1, bob: -1 },
        { ms: 300, armF: [3.0, 0.05], armB: [-0.3, 0.4], tilt: -1, y: -2 },
      ],
    },
  };
  const ANIMS = Object.keys(STD);

  // ---- Baking --------------------------------------------------------------------------
  // Rim light: silhouette pixels facing (lx, ly) within radius pick up `color`.
  function rimLight(cv, lx, ly, color, radius) {
    const w = cv.width, h = cv.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const [cr, cg, cb] = CT.PAL.hex(color);
    const [or, og, ob] = CT.PX.OUTLINE;
    const solid = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const i = (y * w + x) * 4;
      return d[i + 3] > 0 && !(d[i] === or && d[i + 1] === og && d[i + 2] === ob);
    };
    const hits = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!solid(x, y)) continue;
        const dx = lx - x, dy = ly - y, d2 = dx * dx + dy * dy;
        if (d2 > radius * radius || d2 < 2) continue;
        const ax = Math.abs(dx), ay = Math.abs(dy);
        const sx = Math.sign(dx), sy = Math.sign(dy);
        if ((ax * 2 >= ay && !solid(x + sx, y)) || (ay * 2 >= ax && !solid(x, y + sy))) hits.push((y * w + x) * 4);
      }
    for (const i of hits) { d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; }
    g.putImageData(img, 0, 0);
    return cv;
  }
  CT.PX.rimLight = rimLight;

  function copyCanvas(src) {
    return CT.PX.canvas(src.width, src.height, (g) => g.drawImage(src, 0, 0));
  }

  // def: { body, pal, detail, draw(g, J, view, pose, def), anims, magic, hi }
  function bakeFrame(def, pose, view, animName, frameIdx) {
    const g = new Grid(SIZE, SIZE);
    const J = solve(pose, def.body);
    def.draw(g, J, view, pose, def);
    const cv = shadeGrid(g, def.pal, def.detail || '', def.hi !== false);
    CT.PAL.snapCanvas(cv);
    const f = CT.PX.frameOf(cv);
    // Anchor at the rig root, not the bbox: feet stay planted through lunges.
    f.footY = RY + 1 + 1; // +1 outline pad, +1 below the ground row
    f.cx = RX + 1;
    f.J = J;
    const a = def.anims[animName];
    if (a.rim && def.magic !== false) {
      // Magic rim light from the gathered hands.
      const hx = (J.handF.x + J.handB.x) / 2 + 1, hy = Math.min(J.handF.y, J.handB.y) - 1;
      const rim = rimLight(copyCanvas(cv), hx, hy, def.magic || '#e0c0fc', frameIdx === a.release ? 26 : 18);
      f.img = rim;
      f.flash = flashOf(rim);
      f.glow = { x: hx, y: hy, color: def.magic || '#e0c0fc' };
    }
    return f;
  }

  // Build every animation for both views. Returns { anims: { name: { se: [f], ne: [f], loop, ... } } }
  function bake(def) {
    def.anims = Object.assign({}, STD, def.anims || {});
    const out = {};
    for (const name of Object.keys(def.anims)) {
      const a = def.anims[name];
      const entry = { loop: !!a.loop, charge: a.charge, release: a.release, total: 0 };
      for (const view of ['se', 'ne']) {
        entry[view] = a.frames.map((fr, i) => {
          const f = bakeFrame(def, fr, view, name, i);
          f.ms = fr.ms || 120;
          return f;
        });
      }
      entry.total = a.frames.reduce((s, f) => s + (f.ms || 120), 0);
      out[name] = entry;
    }
    return out;
  }

  const mirrorFrame = (f) => {
    const img = CT.PX.mirror(f.img);
    return Object.assign({}, f, { img, flash: flashOf(img), cx: f.img.width - f.cx, glow: f.glow && Object.assign({}, f.glow, { x: f.img.width - f.glow.x }) });
  };

  // Rig sprite object: frame lookup by animation, screen direction and time.
  function makeSprite(def) {
    const baked = bake(def);
    const dirs = {};
    for (const name in baked) {
      const e = baked[name];
      dirs[name] = {
        loop: e.loop, charge: e.charge, release: e.release, total: e.total,
        'south-east': e.se, 'north-east': e.ne,
        'south-west': e.se.map(mirrorFrame), 'north-west': e.ne.map(mirrorFrame),
      };
      dirs[name].south = dirs[name]['south-east'];
    }
    const spr = {
      rig: true,
      anims: dirs,
      // t = ms since the animation started. Non-looping anims hold their last frame.
      frame(anim, dir, t = 0, opts = {}) {
        let a = dirs[anim] || dirs.idle;
        let list = a[dir] || a['south-east'];
        if (!list || !list.length) { a = dirs.idle; list = a[dir] || a['south-east']; }
        if (opts.charge && a.charge) {
          const idx = a.charge[Math.floor(t / (list[a.charge[0]].ms || 160)) % a.charge.length];
          return list[idx];
        }
        let tt = a.loop ? t % a.total : Math.min(t, a.total - 1);
        for (const f of list) {
          if (tt < f.ms) return f;
          tt -= f.ms;
        }
        return list[list.length - 1] || dirs.idle['south-east'][0];
      },
    };
    // Back-compat: static frames = first idle frame.
    spr.frames = {};
    for (const d of ['south-east', 'south-west', 'north-east', 'north-west', 'south']) spr.frames[d] = dirs.idle[d][0];
    return spr;
  }

  // ---- Standard humanoid painter ---------------------------------------------------------
  // Draws legs, boots, torso, arms, hands and a default head; characters add
  // their look through hooks, each called as hook(g, J, view, pose):
  //   behind  - before everything (capes, long hair, tails)
  //   legs    - after the legs (skirts, fur, knee pads)
  //   torso   - after the torso (collars, belts, emblems)
  //   face    - replaces the default face (front view only)
  //   hair    - after the head (hair, hats, helmets)  [both views]
  //   weapon  - before the near arm, so the hand grips it
  //   front   - after the near arm (shields, sleeves over hands, fx)
  // Materials: p/q near/far leg, b/o near/far boot, c torso, d near sleeve,
  // D far sleeve, A/a near/far forearm skin, F/f near/far hand, s head skin,
  // S skin shade, e eye, E eye light, m mouth, h hair.
  // o.sleeves: 'long' | 'short' | 'bare'; o.legs: 'pants' | 'bare'; o.boots: bool.
  function human(o = {}) {
    const sleeves = o.sleeves || 'long';
    const W = o.width || 4; // half-width of the chest
    function leg(g, hip, knee, foot, L, Bt, bare) {
      g.capsule(hip.x, hip.y, knee.x, knee.y, 1.6, L);
      g.capsule(knee.x, knee.y, foot.x, foot.y - 1, 1.5, bare ? L : L);
      if (o.boots !== false) {
        g.rect(Math.round(foot.x) - 1, Math.round(foot.y) - 2, Math.round(foot.x) + 1, Math.round(foot.y), Bt);
        g.px(foot.x + 2, foot.y, Bt);
        g.px(foot.x + 2, foot.y - 1, Bt);
      }
    }
    function arm(g, sh, el, hand, up, lo, hd) {
      g.capsule(sh.x, sh.y, el.x, el.y, 1.5, up);
      g.capsule(el.x, el.y, hand.x, hand.y, sleeves === 'long' ? 1.4 : 1.2, sleeves === 'long' ? up : lo);
      if (sleeves === 'short') g.capsule(sh.x, sh.y, (sh.x + el.x) / 2, (sh.y + el.y) / 2, 1.6, up);
      g.ell(hand.x, hand.y, 1.2, 1.2, hd);
    }
    function torso(g, J) {
      const px = Math.cos(J.lean), py = Math.sin(J.lean);
      const c = J.chest, h = J.hip;
      g.poly([
        [c.x - px * W, c.y - py * W - 0.5], [c.x + px * (W - 0.5), c.y + py * (W - 0.5) - 0.5],
        [h.x + px * (W - 0.5), h.y + py * (W - 0.5) + 1], [h.x - px * W, h.y - py * W + 1],
      ], 'c');
      // shoulders
      g.ell(J.shF.x, J.shF.y, 1.5, 1.5, 'c');
      g.ell(J.shB.x + 0.5, J.shB.y, 1.5, 1.5, 'c');
    }
    function head(g, J, view) {
      const H = J.head, r = J.B.headR;
      g.rect(Math.round(J.neck.x) - 1, Math.round(J.neck.y) - 1, Math.round(J.neck.x) + 1, Math.round(J.neck.y) + 1, 'S');
      g.ell(H.x, H.y, r - 0.3, r, 's');
      if (view === 'se') {
        if (o.face) o.face(g, J, view);
        else {
          const x = Math.round(H.x), y = Math.round(H.y);
          g.px(x - r + 1, y + 1, 'S'); // ear
          g.rect(x + 1, y, x + 1, y + 1, 'e');
          g.rect(x + 4, y, x + 4, y + 1, 'e');
          g.px(x + 1, y - 1, 'E');
          g.px(x + 3, y + 3, 'm');
        }
      }
    }
    return function draw(g, J, view, pose) {
      const hk = (n) => o[n] && o[n](g, J, view, pose);
      hk('behind');
      leg(g, J.hipB, J.kneeB, J.footB, 'q', 'o', o.legs === 'bare');
      if (view === 'se') {
        arm(g, J.shB, J.elB, J.handB, 'D', 'a', 'f');
        leg(g, J.hipF, J.kneeF, J.footF, 'p', 'b', o.legs === 'bare');
        hk('legs');
        torso(g, J);
        hk('torso');
        head(g, J, view);
        hk('hair');
        hk('weapon');
        arm(g, J.shF, J.elF, J.handF, 'd', 'A', 'F');
        hk('front');
      } else {
        // Seen from behind: the head and hair come after the torso, the near arm
        // is on the other side of the body so it is drawn before the torso.
        leg(g, J.hipF, J.kneeF, J.footF, 'p', 'b', o.legs === 'bare');
        hk('legs');
        hk('weapon');
        arm(g, J.shF, J.elF, J.handF, 'd', 'A', 'F');
        torso(g, J);
        hk('torso');
        head(g, J, view);
        hk('hair');
        arm(g, J.shB, J.elB, J.handB, 'D', 'a', 'f');
        hk('front');
      }
    };
  }

  CT.RIGS = CT.RIGS || {};
  CT.RIG = {
    SIZE, RX, RY, BODY, STD, ANIMS, solve, bake, makeSprite, rimLight, human,
    V, add, dirA,
    // Register a rigged character. def.draw(g, J, view, pose, def).
    define(key, def) {
      CT.RIGS[key] = def;
    },
  };
})();
