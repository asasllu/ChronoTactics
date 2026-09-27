// Rigged NPCs, villagers and props (see docs/ART_SPEC.md).
//
// Townsfolk share one parametric painter, person(spec), built on CT.RIG.human
// hooks: a spec picks a hair style, face, outfit pieces, a lower garment, an
// optional carried prop and a palette, so every villager variant is its own
// silhouette while sharing one drawing path. Story NPCs (king, Leene, Kino,
// the elder, Gaspar, the guard) are richer specs of the same painter. Props
// (Epoch, Lavos seeds, gates) have their own draw() and pose-driven loops.
(function () {
  const CT = (window.CT = window.CT || {});
  const { define, human, STD } = CT.RIG;
  const R = Math.round;

  // ---- Shared palette pieces (all hex values from CT.PAL ramps) ------------------------
  const SKIN = {
    // [s, S, lit]: thin bare limbs use the lit tone, since shading darkens narrow regions a lot.
    fair: ['#fff0dc', '#f8d0a8', '#fff0dc'],
    light: ['#f8d0a8', '#e0a878', '#fff0dc'],
    mid: ['#e0a878', '#bc7a50', '#f8d0a8'],
    tan: ['#bc7a50', '#8c5034', '#e0a878'],
  };
  const BASE = { e: '#1a1226', E: '#ffffff', m: '#a02030', P: '#e0709c', k: '#1a1226' };
  const DETAIL = 'eEmHRCPYJTWMNUISKFfAa';

  // ---- Faces (SE only) -------------------------------------------------------------------
  // eyes: 'open' | 'lash' (female) | 'closed' (old, sleepy) | 'kid' (big round)
  function face(g, J, o) {
    const x = R(J.head.x), y = R(J.head.y), hurt = J.pose.hurt;
    g.rect(x - 4, y, x - 3, y + 1, 'S'); // ear
    const eyes = o.eyes || 'open';
    if (eyes === 'closed' && !hurt) {
      g.rect(x - 1, y + 1, x, y + 1, 'e');
      g.rect(x + 3, y + 1, x + 4, y + 1, 'e');
      g.rect(x - 1, y - 1, x, y - 1, o.brow || 'H');
      g.rect(x + 3, y - 1, x + 5, y - 1, o.brow || 'H');
    } else if (eyes === 'lash') {
      g.rect(x, y, x, y + 1, 'e');
      g.rect(x + 3, y, x + 3, y + 1, 'e');
      g.px(x + 4, y, 'E');
      g.px(x - 1, y - 1, 'e'); g.px(x + 4, y - 1, 'e'); // lashes
      if (o.blush !== false) { g.px(x + 1, y + 2, 'P'); g.px(x + 4, y + 2, 'P'); }
    } else {
      g.px(x, y - 1, o.brow || 'H'); g.px(x + 3, y - 1, o.brow || 'H'); g.px(x + 4, y - 1, o.brow || 'H');
      g.rect(x, y, x, y + 1, 'e');
      g.rect(x + 3, y, x + 3, y + 1, 'e');
      g.px(x + 4, y, 'E');
      if (o.blush) { g.px(x + 1, y + 2, 'P'); }
    }
    g.px(x + 5, y + 2, 'S'); // nose
    if (o.beard) {
      // Jaw beard from the ear round the chin; long beards spill onto the chest.
      g.ell(x + 1.5, y + 4.5, 3.6, 1.5, 'w');
      g.rect(x - 2, y + 1, x - 1, y + 4, 'w');
      if (o.beard === 'long') { g.spike(x + 1, y + 5, x + 2, y + 11, 6, 'w'); g.line(x + 1, y + 6, x + 2, y + 9, 'W'); }
      g.rect(x + 2, y + 2, x + 5, y + 2, 'W'); // moustache
      g.px(x + 3, y + 3, hurt ? 'e' : 'm');
    } else if (o.moustache) {
      g.rect(x + 2, y + 2, x + 5, y + 2, 'w');
      g.px(x + 1, y + 3, 'w'); g.px(x + 6, y + 3, 'w');
      g.px(x + 3, y + 3, hurt ? 'e' : 'm');
    } else g.px(x + 3, y + 3, hurt ? 'e' : 'm');
  }

  // ---- Hair / headwear -------------------------------------------------------------------
  // Each style draws both views; (x, y) is the head centre. Letters: h hair, H strand
  // (detail), R highlight (detail); headwear uses v/V (cap, scarf, hat), u (hood),
  // I (fur trim), x/X (helmet), y/J (crown, tiara).
  function cap(g, x, y, view) {
    g.ell(x - 1, y - 3.4, 5.5, 2.8, 'h');
    g.ell(x - 4, y - 1, 3.2, 4.2, 'h');
    if (view === 'ne') g.ell(x, y - 1, 5.3, 5.3, 'h');
  }
  const HAIR = {
    short(g, x, y, view) {
      cap(g, x, y, view);
      if (view === 'se') {
        for (const [a, b, c, d] of [[1, -5, 3, -1], [3, -5, 5, -2], [-1, -5, 0, -1]]) g.spike(x + a, y + b, x + c, y + d, 3, 'h');
        g.line(x - 4, y - 3, x - 1, y - 5, 'H');
        g.line(x, y - 6, x + 2, y - 6, 'R');
      } else {
        g.spike(x - 2, y + 3, x - 2, y + 6, 3, 'h'); g.spike(x + 2, y + 3, x + 2, y + 6, 3, 'h');
        g.line(x - 2, y - 4, x - 3, y + 2, 'H'); g.line(x + 2, y - 4, x + 2, y + 2, 'H');
        g.line(x - 1, y - 5, x + 1, y - 5, 'R');
      }
    },
    cap(g, x, y, view) {
      cap(g, x, y, view);
      if (view === 'se') g.spike(x - 3, y - 2, x - 3, y + 2, 3, 'h');
      g.ell(x - 0.5, y - 4, 5.6, 2.6, 'v');
      g.line(x - 5, y - 3, x + 4, y - 3, 'V');
      if (view === 'se') { g.rect(x + 3, y - 3, x + 7, y - 2, 'V'); g.px(x + 1, y - 6, 'v'); }
      else { g.px(x + 5, y - 3, 'V'); g.line(x - 2, y - 6, x + 1, y - 6, 'R'); }
      g.px(x - 1, y - 7, 'V'); // button
    },
    scarf(g, x, y, view) {
      // Kerchief over the crown, knotted at the nape; hair shows at the back and brow.
      cap(g, x, y, view);
      if (view === 'se') {
        g.ell(x - 4, y + 2, 2.6, 3.4, 'h');
        g.ell(x - 0.5, y - 3.5, 5.8, 2.9, 'v');
        g.spike(x + 2, y - 2, x + 4, y + 0, 3, 'h');
        g.ell(x - 5.5, y - 1, 1.4, 1.4, 'V');
        g.spike(x - 6, y - 1, x - 9, y + 2, 3, 'V');
        g.spike(x - 6, y, x - 8, y + 4, 2.5, 'V');
        g.line(x - 3, y - 5, x + 2, y - 6, 'R');
      } else {
        g.ell(x, y + 1, 5.4, 4.4, 'h');
        g.ell(x, y - 3, 6, 3.4, 'v');
        g.ell(x, y, 1.4, 1.2, 'V');
        g.spike(x - 1, y, x - 3, y + 5, 3, 'V');
        g.spike(x + 1, y, x + 2, y + 5, 3, 'V');
        g.line(x - 2, y + 2, x - 2, y + 4, 'H'); g.line(x + 2, y + 2, x + 3, y + 4, 'H');
        g.line(x - 3, y - 5, x + 2, y - 6, 'R');
      }
    },
    bald(g, x, y, view) {
      if (view === 'se') {
        g.poly([[x - 5.5, y - 2], [x - 2, y - 1], [x - 2, y + 3], [x - 5, y + 3]], 'h');
        g.px(x - 1, y - 4, 'R'); g.px(x, y - 4, 'R'); // shiny pate
      } else {
        g.poly([[x - 5.5, y - 1], [x - 2, y + 0.5], [x + 2, y + 0.5], [x + 5.5, y - 1], [x + 4.5, y + 4], [x - 4.5, y + 4]], 'h');
        g.line(x - 2, y + 2, x - 2, y + 3, 'H'); g.line(x + 2, y + 2, x + 2, y + 3, 'H');
        g.px(x - 1, y - 3, 'R'); g.px(x, y - 3, 'R');
      }
    },
    wild(g, x, y, view) {
      const sp = [[-3, -5, -6, -11], [0, -6, 0, -12], [3, -5, 6, -10], [-5, -2, -11, -5], [-5, 1, -11, 3], [-4, 4, -8, 8]];
      g.ell(x - 1.5, y - 3, 5.6, 3.2, 'h');
      g.ell(x - 4.5, y, 3.2, 4.8, 'h');
      if (view === 'ne') { g.ell(x, y - 1, 6, 6, 'h'); sp.push([2, 4, 4, 9], [-1, 4, -1, 9]); }
      for (const [a, b, c, d] of sp) g.spike(x + a, y + b, x + c, y + d, 4, 'h');
      if (view === 'se') for (const [a, b, c, d] of [[0, -4, 1, -2], [2, -4, 3, -2], [4, -4, 6, -2]]) g.spike(x + a, y + b, x + c, y + d, 3, 'h');
      g.line(x - 2, y - 6, x - 5, y - 10, 'H'); g.line(x - 5, y - 1, x - 10, y - 4, 'H');
      g.line(x, y - 7, x + 1, y - 10, 'R'); g.line(x + 2, y - 6, x + 4, y - 8, 'R');
    },
    long(g, x, y, view) {
      cap(g, x, y, view);
      if (view === 'se') {
        g.ell(x - 3.5, y + 3, 3, 5, 'h'); // falls behind the ear
        for (const [a, b, c, d] of [[0, -5, 1, -1], [2, -5, 4, -1], [4, -4, 6, 0]]) g.spike(x + a, y + b, x + c, y + d, 3, 'h');
        g.line(x - 3, y - 4, x - 5, y + 5, 'H');
        g.line(x - 1, y - 6, x + 2, y - 6, 'R');
      } else {
        g.ell(x, y + 3, 5.5, 5.5, 'h');
        g.spike(x - 4, y + 5, x - 5, y + 11, 4, 'h'); g.spike(x, y + 6, x, y + 12, 5, 'h'); g.spike(x + 4, y + 5, x + 5, y + 11, 4, 'h');
        g.line(x - 2, y - 4, x - 3, y + 8, 'H'); g.line(x + 2, y - 4, x + 2, y + 9, 'H');
        g.line(x - 1, y - 5, x + 1, y - 5, 'R');
      }
    },
    bun(g, x, y, view) {
      cap(g, x, y, view);
      if (view === 'se') {
        g.ell(x - 4, y - 5, 2.6, 2.6, 'h');
        g.spike(x + 1, y - 5, x + 4, y - 2, 3, 'h');
        g.line(x - 4, y - 3, x, y - 5, 'H'); g.px(x - 5, y - 6, 'R'); g.px(x + 1, y - 6, 'R');
      } else {
        g.ell(x - 0.5, y - 5.5, 2.8, 2.6, 'h');
        g.line(x - 3, y - 2, x - 2, y + 3, 'H'); g.line(x + 3, y - 2, x + 2, y + 3, 'H');
        g.px(x - 1, y - 7, 'R');
      }
    },
    pony(g, x, y, view) {
      HAIR.short(g, x, y, view);
      const s = J_SWAY;
      if (view === 'se') { g.spike(x - 5, y - 1, x - 9 - s, y + 8, 4, 'h'); g.px(x - 5, y - 1, 'J'); }
      else { g.spike(x, y + 2, x - 1 - s, y + 10, 4, 'h'); g.px(x, y + 2, 'J'); }
    },
    hood(g, x, y, view, o) {
      // Fur-trimmed hood with a mantle over the shoulders.
      const c = J_CUR.chest;
      g.poly([[x - 5, y + 2], [x + 4, y + 2], [c.x + 6, c.y + 3], [c.x - 6, c.y + 3]], 'u');
      g.ell(x - 0.5, y - 0.5, 6.3, 6.3, 'u');
      if (view === 'se') {
        g.spike(x - 5, y - 4, x - 9, y - 1, 4, 'u'); // hood point falls back
        g.ell(x + 2, y + 1, 3.6, 4.3, 's');
        face(g, J_CUR, o);
        // Fur trim around the face opening.
        for (let a = -1.9; a <= 1.9; a += 0.18) g.px(x + 2 + Math.sin(a) * 4.8 - 1.4, y + 1 - Math.cos(a) * 5.4, 'I');
        g.line(x - 3, y + 6, x + 4, y + 6, 'I');
        g.line(x - 3, y - 4, x - 5, y + 3, 'U');
      } else {
        g.spike(x - 1, y - 5, x - 4, y - 9, 4, 'u');
        g.line(x, y - 5, x, y + 5, 'U');
        g.line(c.x - 6, c.y + 3, c.x + 6, c.y + 3, 'I');
      }
    },
    boater(g, x, y, view) {
      // Straw boater: flat crown, wide brim, red band.
      HAIR.short(g, x, y, view);
      g.rect(x - 4, y - 8, x + 3, y - 5, 'g');
      g.rect(x - 7, y - 4, x + 6, y - 4, 'G');
      if (view === 'se') g.rect(x - 6, y - 3, x + 7, y - 3, 'G');
      else g.rect(x - 7, y - 3, x + 6, y - 3, 'G');
      g.line(x - 4, y - 5, x + 3, y - 5, 'J');
      g.line(x - 3, y - 8, x + 1, y - 8, 'R');
    },
    beanie(g, x, y, view, o, pose) {
      // Kid's propeller beanie; the prop turns with the idle bob.
      cap(g, x, y, view);
      if (view === 'se') for (const [a, b, c, d] of [[1, -3, 3, 0], [3, -3, 5, -1], [-3, 1, -6, 4]]) g.spike(x + a, y + b, x + c, y + d, 3, 'h');
      else for (const [a, b, c, d] of [[-3, 3, -4, 6], [0, 4, 0, 7], [3, 3, 4, 6]]) g.spike(x + a, y + b, x + c, y + d, 3, 'h');
      g.ell(x - 0.5, y - 4, 5.4, 2.8, 'v');
      g.line(x - 5, y - 3, x + 4, y - 3, 'V');
      g.line(x - 2, y - 6, x + 1, y - 6, 'J');
      g.line(x - 0.5, y - 7, x - 0.5, y - 8, 'M');
      if (J_SWAY) g.line(x - 3.5, y - 9, x + 2.5, y - 9, 'y');
      else { g.line(x - 1.5, y - 9, x + 0.5, y - 9, 'y'); }
    },
    bowler(g, x, y, view) {
      // Gaspar: white tufts under a small bowler.
      if (view === 'se') { g.ell(x - 4, y + 0.5, 2.4, 2.8, 'h'); g.line(x - 5, y, x - 4, y + 2, 'H'); }
      else { g.ell(x, y + 2, 5.2, 2.4, 'h'); g.line(x - 2, y + 1, x - 2, y + 3, 'H'); g.line(x + 2, y + 1, x + 2, y + 3, 'H'); }
      g.ell(x - 0.5, y - 5.5, 4.4, 3.2, 'v');
      g.rect(x - 7, y - 3, x + 6, y - 3, 'V');
      g.rect(x - 6, y - 2, x + 5, y - 2, 'V');
      g.line(x - 4, y - 4, x + 3, y - 4, 'y');
      g.px(x - 2, y - 8, 'R');
    },
    crown(g, x, y, view) {
      HAIR.short(g, x, y, view);
      g.rect(x - 5, y - 6, x + 4, y - 5, 'y');
      for (const d of [-5, -2, 1, 4]) g.rect(x + d, y - 8, x + d, y - 7, 'y');
      g.px(x - 1, y - 8, 'y'); g.px(x + 2, y - 8, 'y');
      g.px(x - 1, y - 6, 'J'); g.px(x + 2, y - 6, 'J');
      if (view === 'se') g.px(x + 4, y - 6, 'J');
      else g.px(x - 4, y - 6, 'J');
    },
    tiara(g, x, y, view) {
      // Leene: swept up-do, side locks, bun and tiara.
      cap(g, x, y, view);
      if (view === 'se') {
        g.ell(x - 4, y - 6, 2.8, 2.6, 'h');
        g.spike(x - 3, y + 1, x - 4, y + 8, 3, 'h'); // lock behind the ear
        g.spike(x + 5, y - 3, x + 6, y + 2, 2, 'h'); // lock framing the face
        g.line(x - 3, y - 4, x + 2, y - 6, 'H');
        g.px(x - 5, y - 7, 'R');
        g.line(x - 2, y - 5, x + 4, y - 5, 'y');
        g.px(x + 1, y - 6, 'y'); g.px(x + 1, y - 7, 'J');
      } else {
        g.ell(x - 0.5, y - 6, 3.4, 3, 'h');
        g.spike(x - 5, y + 1, x - 5, y + 7, 3, 'h'); g.spike(x + 5, y + 1, x + 5, y + 7, 3, 'h');
        g.ell(x, y + 2, 4.6, 3.6, 'h');
        g.line(x - 2, y - 2, x - 2, y + 4, 'H'); g.line(x + 2, y - 2, x + 2, y + 4, 'H');
        g.line(x - 2, y - 7, x, y - 8, 'R');
        g.px(x - 3, y - 5, 'y'); g.px(x + 3, y - 5, 'y'); // hairpins
      }
    },
    helmet(g, x, y, view) {
      // Guardia kettle helm: steel dome, brow band, nasal, red crest.
      g.spike(x - 1, y - 6, x - 7, y - 9, 3, 'r');
      g.spike(x - 2, y - 5, x - 8, y - 5, 3, 'r');
      g.ell(x - 0.5, y - 3, 6, 3.4, 'x');
      if (view === 'se') {
        g.rect(x - 4, y - 1, x - 2, y + 3, 'x'); // cheek guard over the ear
        g.rect(x - 6, y - 1, x - 4, y + 3, 'x'); // neck guard
        g.line(x - 6, y - 1, x + 5, y - 1, 'X');
        g.rect(x + 5, y - 1, x + 5, y + 1, 'x'); // nasal
        g.line(x - 2, y - 6, x + 1, y - 6, 'R');
      } else {
        g.rect(x - 6, y - 1, x + 5, y + 3, 'x');
        g.line(x - 6, y - 1, x + 5, y - 1, 'X');
        g.line(x - 1, y - 6, x + 1, y - 6, 'R');
      }
    },
  };
  // Hair styles that need the joints read these (set per draw).
  let J_CUR = null, J_SWAY = 0;

  // ---- Lower garments (legs hook) --------------------------------------------------------
  // Skirt from the waist to `hemY`, flaring out to follow the feet.
  function skirt(g, J, hemUp, flare, fold) {
    const h = J.hip, top = h.y - 1;
    const hem = Math.max(top + 4, J.root.y - hemUp);
    const fx0 = Math.min(J.footB.x, J.footF.x), fx1 = Math.max(J.footB.x, J.footF.x);
    const x0 = Math.min(h.x - 4 - flare, fx0 - 1), x1 = Math.max(h.x + 4 + flare, fx1 + 1);
    g.poly([[h.x - 4, top], [h.x + 4, top], [x1 + 0.5, hem + 1], [x0, hem + 1]], 't');
    if (fold) {
      g.line(h.x - 1, top + 3, (x0 + h.x) / 2, hem, 'T');
      g.line(h.x + 2, top + 3, (x1 + h.x) / 2 + 1, hem, 'T');
    }
  }
  function furShorts(g, J) {
    const h = J.hip;
    g.poly([[h.x - 4.5, h.y - 1], [h.x + 4.5, h.y - 1], [h.x + 5, h.y + 4], [h.x - 5, h.y + 4]], 't');
    for (let x = R(h.x) - 4; x <= R(h.x) + 4; x += 2) g.px(x, R(h.y) + 5, 't');
    g.px(h.x - 2, h.y + 1, 'C'); g.px(h.x + 2, h.y + 2, 'C');
  }
  function furBoots(g, J) {
    for (const [f, c] of [[J.footB, 'o'], [J.footF, 'b']]) {
      g.ell(f.x, f.y - 1.5, 2, 1.8, c);
      g.px(f.x + 2, f.y, c);
    }
  }

  // ---- Upper garments (torso hook) -------------------------------------------------------
  function torsoPoly(g, J, w, y0, y1, c) {
    const px = Math.cos(J.lean), py = Math.sin(J.lean), ch = J.chest, h = J.hip;
    const a = (t) => ({ x: ch.x + (h.x - ch.x) * t, y: ch.y + (h.y - ch.y) * t });
    const A = a(y0), B = a(y1);
    g.poly([[A.x - px * w, A.y - py * w], [A.x + px * w, A.y + py * w], [B.x + px * w, B.y + py * w], [B.x - px * w, B.y - py * w]], c);
  }
  function belt(g, J, c = 'l') {
    const h = J.hip;
    g.capsule(h.x - 4, h.y, h.x + 3.5, h.y + J.lean * 3, 0.9, c);
  }

  // ---- Props (weapon hook) ---------------------------------------------------------------
  const PROPS = {
    // Tall walking staff planted on the ground; knot at the top.
    staff(g, J, view, o) {
      const h = J.handF, top = h.y - (o.staffUp || 10);
      const foot = J.root.y;
      g.line(h.x + 1, foot, h.x, top, 'x');
      g.line(h.x + 2, foot - 1, h.x + 1, top + 1, 'x');
      g.ell(h.x + 0.5, top - 1, 1.8, 1.8, 'X');
      if (o.staffTop === 'bone') { g.ell(h.x - 1, top - 2, 1.2, 1.2, 'X'); g.ell(h.x + 2, top - 2, 1.2, 1.2, 'X'); }
    },
    spear(g, J, view, o, pose) {
      const h = J.handF;
      let d = { x: 0, y: -1 };
      if (pose.wpn != null) d = J.wdir;
      const back = 12, fwd = 14;
      g.capsule(h.x - d.x * back, h.y - d.y * back, h.x + d.x * fwd, h.y + d.y * fwd, 0.7, 'x');
      const tx = h.x + d.x * fwd, ty = h.y + d.y * fwd;
      g.spike(tx, ty, tx + d.x * 5, ty + d.y * 5, 3.5, 'z');
      g.capsule(tx - d.y * 1.5, ty + d.x * 1.5, tx + d.y * 1.5, ty - d.x * 1.5, 0.5, 'y');
    },
    cane(g, J) {
      const h = J.handF;
      g.line(h.x + 1, h.y, h.x + 2, J.root.y, 'x');
      g.line(h.x + 1, h.y - 1, h.x - 1, h.y - 2, 'x');
      g.px(h.x - 2, h.y - 1, 'x');
    },
    club(g, J) {
      // Heavy club along the weapon axis (hanging forward at rest).
      const h = J.handF, d = J.wdir;
      g.capsule(h.x - d.x * 2, h.y - d.y * 2, h.x + d.x * 8, h.y + d.y * 8, 1, 'x');
      g.ell(h.x + d.x * 10, h.y + d.y * 10, 2.6, 2.6, 'x');
      g.px(h.x + d.x * 10 - 1, h.y + d.y * 10 - 1, 'X');
      g.px(h.x + d.x * 7 + 1, h.y + d.y * 7, 'X');
    },
    sceptre(g, J) {
      const h = J.handF;
      g.line(h.x, h.y + 3, h.x + 1, h.y - 8, 'y');
      g.ell(h.x + 1, h.y - 9.5, 1.7, 1.7, 'y');
      g.px(h.x + 1, h.y - 10, 'J');
    },
    balloon(g, J, view, o, pose) {
      const h = J.handF, s = pose.bob ? 1 : 0;
      const bx = h.x + 3 + s, by = Math.max(6, h.y - 19);
      if (by > h.y - 6) return; // hand raised high: the balloon has floated off the frame edge
      g.line(h.x, h.y, bx, by + 4, 'M');
      g.ell(bx, by, 3.6, 4.2, 'j');
      g.px(bx, by + 5, 'j');
      g.px(bx - 1, by - 2, 'N');
    },
    basket(g, J) {
      const h = J.handF;
      g.rect(h.x - 3, h.y + 1, h.x + 3, h.y + 4, 'x');
      g.ell(h.x - 1, h.y, 1.5, 1.2, 'j'); g.ell(h.x + 1.5, h.y, 1.3, 1.1, 'n');
      g.line(h.x - 3, h.y + 1, h.x + 3, h.y + 1, 'X');
      g.line(h.x - 2, h.y + 3, h.x + 2, h.y + 3, 'X');
    },
  };

  // Arm poses for carriers: the near hand stays on the prop while walking.
  function holdAnims(armF, extra = {}) {
    const W = STD.walk.frames;
    const sway = [0.06, 0, -0.06, 0];
    return Object.assign({
      idle: { loop: true, frames: [{ ms: 560, armF, armB: [-0.15, 0.35] }, { ms: 560, bob: 1, armF: [armF[0], armF[1] + 0.05], armB: [-0.1, 0.4] }] },
      walk: { loop: true, frames: W.map((f, i) => Object.assign({}, f, { armF: [armF[0] + sway[i], armF[1]] })) },
    }, extra);
  }

  // ---- The parametric person -------------------------------------------------------------
  // spec: { body, width, skin, sleeves, legs, boots, hair, eyes, brow, blush, beard,
  //   moustache, lower: pants|shorts|skirt|dress|robe|gown, flare, top: [..pieces],
  //   cape, prop, pal, anims, hunch }
  function person(spec) {
    const sk = SKIN[spec.skin || 'light'];
    const pal = Object.assign({}, BASE, { s: sk[0], S: sk[1], A: sk[0], F: sk[0], L: sk[0], a: sk[1], f: sk[1] });
    if (spec.sleeves === 'bare') Object.assign(pal, { d: sk[0], D: sk[1], A: sk[0], a: sk[1], L: sk[0] });
    if (spec.legs === 'bare') Object.assign(pal, { p: sk[0], q: sk[1] });
    Object.assign(pal, spec.pal);
    const top = spec.top || [];
    const lower = spec.lower || 'pants';
    const hem = { skirt: 9, dress: 4, robe: 2, gown: 0 }[lower];

    const hooks = {
      sleeves: spec.sleeves === 'bare' ? 'bare' : spec.sleeves || 'long',
      width: spec.width || 4,
      boots: spec.boots !== false && !spec.furBoots,
      behind(g, J, view, pose) {
        J_CUR = J;
        J_SWAY = pose.bob ? 1 : 0;
        if (spec.cape && view === 'se') cape(g, J, pose, spec.cape);
        if (spec.behind) spec.behind(g, J, view, pose);
      },
      legs(g, J, view) {
        if (spec.furBoots) furBoots(g, J);
        if (lower === 'shorts') furShorts(g, J);
        else if (hem != null) skirt(g, J, hem, spec.flare || 0, spec.fold !== false);
      },
      torso(g, J, view, pose) {
        const c = J.chest, h = J.hip, fx = view === 'se';
        for (const t of top) {
          if (t === 'vest') {
            torsoPoly(g, J, spec.width || 4, 0, 1, 'v');
            if (fx) { g.line(c.x + 1, c.y, h.x + 1, h.y - 1, 'c'); g.line(c.x + 2, c.y, h.x + 2, h.y - 1, 'c'); }
            else g.line(c.x - 1, c.y + 1, h.x - 1, h.y - 1, 'V');
          } else if (t === 'apron' && fx) {
            g.rect(R(c.x) - 1, R(c.y) + 3, R(c.x) + 3, R(h.y) + 7, 'n');
            g.line(c.x - 1, c.y + 3, c.x - 3, c.y, 'n');
          } else if (t === 'apron') {
            g.line(h.x - 4, h.y - 1, h.x + 4, h.y - 1, 'n');
            g.px(h.x, h.y, 'n'); g.px(h.x - 1, h.y + 1, 'n'); g.px(h.x + 1, h.y + 1, 'n');
          } else if (t === 'shawl') {
            g.poly([[c.x - 5, c.y - 1], [c.x + 5, c.y - 1], [c.x + 4.5, c.y + 3], [c.x + (fx ? 1.5 : -0.5), c.y + 6], [c.x - 5, c.y + 3]], 'i');
            g.line(c.x - 4, c.y + 3, c.x + 4, c.y + 3, 'M');
          } else if (t === 'stripes') {
            const w = (spec.width || 4) - 0.5, px = Math.cos(J.lean), py = Math.sin(J.lean);
            for (let k = 2; k <= 8; k += 3) {
              const x = c.x + (h.x - c.x) * k / 9, y = c.y + (h.y - c.y) * k / 9;
              g.line(x - px * w, y - py * w, x + px * w, y + py * w, 'C');
            }
          } else if (t === 'buttons' && fx) {
            for (let k = 1; k < 8; k += 2) g.px(c.x + 2 + (h.x - c.x) * k / 8, c.y + (h.y - c.y) * k / 8, 'Y');
          } else if (t === 'fur') {
            // Pelt slung over the far shoulder, bare near shoulder, ragged hem.
            if (fx) g.tri(c.x - 0.5, c.y - 1.5, c.x + 5, c.y - 1.5, c.x + 5, c.y + 4, 'L');
            else g.tri(c.x - 5, c.y - 1.5, c.x + 0.5, c.y - 1.5, c.x - 5, c.y + 4, 'L');
            for (let x = R(h.x) - 4; x <= R(h.x) + 3; x += 2) g.px(x, R(h.y) + 2, 'c');
            for (const [dx, dy] of [[-2, 3], [1, 5], [-3, 7], [2, 8]]) g.px(c.x + dx, c.y + dy, 'C');
          } else if (t === 'strap') {
            // Bare chest with a hide strap across it.
            g.line(c.x - 3, c.y - 1, h.x + 3, h.y - 1, 'v');
            g.line(c.x - 2, c.y - 1, h.x + 4, h.y - 1, 'v');
            if (fx) { g.px(c.x + 2, c.y + 2, 'S'); g.px(c.x - 1, c.y + 3, 'S'); }
          } else if (t === 'tabard') {
            torsoPoly(g, J, 3, 0.05, 1.45, 't');
            if (fx) {
              g.line(c.x + 0.5, c.y + 1.5, c.x + 0.5, c.y + 6, 'y');
              g.line(c.x - 1.5, c.y + 3, c.x + 2.5, c.y + 3, 'y');
            } else g.line(c.x, c.y + 1, h.x, h.y + 3, 'T');
            g.line(c.x - 5, c.y - 1, c.x + 4, c.y - 1, 'M'); // mail collar
          } else if (t === 'collar') {
            g.line(c.x - 3, c.y - 1, c.x + 3, c.y - 1, 'M');
          } else if (t === 'sash') {
            g.line(c.x - 3, c.y - 1, h.x + 3, h.y - 1, 'y');
            g.line(c.x - 2, c.y - 1, h.x + 4, h.y - 1, 'y');
          } else if (t === 'bodice') {
            if (fx) { g.line(c.x - 1, c.y, c.x + 2, c.y + 3, 'M'); g.line(c.x + 4, c.y, c.x + 2, c.y + 3, 'M'); }
          } else if (t === 'belt') belt(g, J, 'l');
          else if (t === 'sashbelt') { belt(g, J, 'l'); if (fx) g.px(h.x + 2, h.y, 'Y'); }
        }
        if (spec.torso) spec.torso(g, J, view, pose);
      },
      face(g, J) {
        if (spec.hair !== 'hood') face(g, J, spec);
      },
      hair(g, J, view, pose) {
        HAIR[spec.hair || 'short'](g, J.head.x, J.head.y, view, spec);
        if (spec.beard && view === 'ne') {
          const x = J.head.x, y = J.head.y;
          g.rect(x - 5, y + 3, x - 4, y + 4, 'w'); g.rect(x + 4, y + 3, x + 5, y + 4, 'w');
        }
      },
      weapon(g, J, view, pose) {
        if (spec.prop) PROPS[spec.prop](g, J, view, spec, pose);
      },
      front(g, J, view, pose) {
        if (spec.cape && view === 'ne') cape(g, J, pose, spec.cape);
        if (spec.front) spec.front(g, J, view, pose);
      },
    };
    let anims = spec.anims || {};
    if (spec.hold) anims = Object.assign(holdAnims(spec.hold), anims);
    if (spec.hunch) {
      // Bent old folk: add a forward lean to every frame.
      const src = Object.assign({}, STD, anims), out = {};
      for (const k in src) out[k] = Object.assign({}, src[k], { frames: src[k].frames.map((f) => Object.assign({}, f, { lean: (f.lean || 0) + spec.hunch })) });
      anims = out;
    }
    return {
      body: spec.body || {},
      pal,
      // Bare limbs are drawn flat: the cel pass would shade thin skin into the stone ramp.
      detail: DETAIL + (spec.detail || '') + (spec.sleeves === 'bare' ? 'dDAaLFf' : '') + (spec.legs === 'bare' ? 'pq' : ''),
      magic: spec.magic || '#c4e4ff',
      anims,
      draw: human(hooks),
    };
  }

  // Royal / elder cape: hangs from the shoulders, flares back, sways with the walk.
  function cape(g, J, pose, kind) {
    const c = J.chest, rt = J.root;
    const sway = (pose.footF ? pose.footF[0] : 0) * 0.4 - (pose.x || 0);
    const hemY = rt.y - (kind === 'short' ? 8 : 1);
    g.poly([[c.x - 5, c.y - 1.5], [c.x + 4, c.y - 1.5], [J.hip.x + 4, hemY], [J.hip.x - 8 - sway, hemY + 0.5]], 'r');
    g.line(J.hip.x - 8 - sway, hemY, J.hip.x + 4, hemY, 'I');
    g.line(c.x - 2, c.y + 2, J.hip.x - 4 - sway / 2, hemY - 1, 'K');
  }

  // =========================================================================================
  // Story NPCs
  // =========================================================================================

  // Guardia castle soldier: kettle helm with a red crest, blue tabard over mail, spear.
  define('guard', person({
    hair: 'helmet', skin: 'light', brow: 'e',
    top: ['tabard', 'belt'],
    width: 4.2,
    prop: 'spear', hold: [0.55, 0.9],
    pal: {
      x: '#9294b0', X: '#e4e8f0', R: '#ffffff', r: '#d43c3c', H: '#5a4a44',
      c: '#6e7090', d: '#6e7090', D: '#52526e', M: '#3a3a52',
      t: '#3c64b4', T: '#2c4488', y: '#f8bc3c', l: '#6e4222',
      p: '#5a4a44', q: '#3e3230', b: '#4a2a16', o: '#2a160e', z: '#e4e8f0',
    },
    detail: 'y',
    anims: {
      victory: {
        loop: true,
        frames: [
          { ms: 300, armF: [2.0, 0.3], armB: [-0.3, 0.4], tilt: -1, bob: -1 },
          { ms: 300, armF: [2.1, 0.25], armB: [-0.3, 0.4], tilt: -1, y: -2 },
        ],
      },
      // Spear thrust instead of a sword swing.
      attack: {
        frames: [
          { ms: 140, lean: -0.1, crouch: 1, wpn: 1.3, armF: [0.9, 0.9], armB: [0.6, 0.8], footF: [1, 0], footB: [-2, 0] },
          { ms: 80, lean: 0.3, crouch: 2, x: 3, wpn: 1.5, armF: [1.5, 0.05], armB: [1.2, 0.3], footF: [5, 0], footB: [-4, 0] },
          { ms: 170, lean: 0.25, crouch: 2, x: 3, wpn: 1.55, armF: [1.45, 0.1], armB: [1.1, 0.3], footF: [5, 0], footB: [-4, 0] },
          { ms: 140, lean: 0.05, crouch: 1, x: 1, armF: [0.55, 0.9], armB: [-0.15, 0.35], footF: [2, 0], footB: [-2, 0] },
        ],
      },
    },
  }));

  // King Guardia XXXIII: crown, brown beard, crimson ermine cape, blue robe, sceptre.
  define('king', person({
    hair: 'crown', beard: true, skin: 'light', lower: 'robe', flare: 1,
    top: ['sash', 'sashbelt'],
    width: 4.5,
    cape: 'long',
    prop: 'sceptre', hold: [0.45, 1.2],
    pal: {
      h: '#6e4222', H: '#4a2a16', R: '#94602e', w: '#94602e', W: '#6e4222',
      y: '#f8bc3c', J: '#d43c3c', r: '#a02030', I: '#e4e8f0', T: '#1c2c5c', K: '#6c1422',
      c: '#2c4488', d: '#2c4488', D: '#1c2c5c', t: '#2c4488', l: '#f8bc3c', Y: '#fff4b0',
      p: '#1c2c5c', q: '#10183a', b: '#6e4222', o: '#4a2a16', M: '#3c64b4',
    },
    anims: { idle: { loop: true, frames: [{ ms: 700, lean: -0.05, armF: [0.45, 1.2], armB: [-0.1, 0.3] }, { ms: 700, lean: -0.05, bob: 1, armF: [0.45, 1.25], armB: [-0.05, 0.35] }] } },
  }));

  // Queen Leene: auburn up-do with tiara, lilac gown with puffed sleeves.
  define('leene', person({
    hair: 'tiara', eyes: 'lash', skin: 'fair', lower: 'gown', flare: 2, width: 3.5,
    top: ['bodice', 'belt'],
    sleeves: 'short',
    pal: {
      h: '#d43c3c', H: '#a02030', R: '#f06c4c', y: '#fce068', J: '#5c90dc',
      c: '#bc84e4', d: '#e0c0fc', D: '#bc84e4', t: '#bc84e4', T: '#9450c0', M: '#fff4b0', l: '#fce068',
      A: '#fff0dc', F: '#fff0dc', p: '#fff0dc', q: '#f8d0a8', b: '#6c3094', o: '#4a1c6c', m: '#d43c3c',
    },
    front(g, J, view) {
      // Puffed sleeve over the near shoulder.
      if (view === 'se') g.ell(J.shF.x + 0.5, J.shF.y + 0.5, 2.2, 2, 'd');
    },
    anims: {
      idle: { loop: true, frames: [{ ms: 620, armF: [0.5, 1.3], armB: [0.3, 1.2] }, { ms: 620, bob: 1, armF: [0.5, 1.35], armB: [0.3, 1.25] }] },
    },
  }));

  // Kino: shaggy brown mane, fur tunic over one shoulder, bare arms and legs, club.
  define('kino', person({
    hair: 'wild', skin: 'mid', sleeves: 'bare', legs: 'bare', furBoots: true,
    top: ['fur', 'belt'], lower: 'shorts',
    body: { leg: 11, torso: 9 },
    prop: 'club',
    pal: {
      h: '#6e4222', H: '#4a2a16', R: '#94602e', c: '#94602e', t: '#94602e', C: '#dcb468', l: '#4a2a16',
      x: '#bc8844', X: '#dcb468', b: '#94602e', o: '#6e4222',
    },
    anims: {
      idle: {
        loop: true,
        frames: [
          { ms: 480, wpn: 2.5, armF: [0.3, 0.3], armB: [-0.2, 0.4], footF: [1, 0], footB: [-1, 0] },
          { ms: 480, bob: 1, wpn: 2.45, armF: [0.25, 0.35], armB: [-0.15, 0.45], footF: [1, 0], footB: [-1, 0], tilt: 1 },
        ],
      },
      walk: { loop: true, frames: STD.walk.frames.map((f) => Object.assign({}, f, { wpn: 2.4 + f.armF[0] })) },
    },
  }));

  // Elder of the Last Village: grey fur-trimmed hood and cloak, long white beard, staff.
  define('elder', person({
    hair: 'hood', beard: 'long', eyes: 'closed', brow: 'w', skin: 'light', lower: 'robe', flare: 1,
    top: ['belt'], width: 4.2, hunch: 0.14,
    body: { leg: 11, torso: 8 },
    cape: 'long',
    prop: 'staff', staffUp: 11, hold: [0.6, 0.6],
    pal: {
      u: '#7a665a', U: '#5a4a44', I: '#c0aa92', w: '#e4e8f0', W: '#bcc0d4', h: '#e4e8f0', H: '#bcc0d4',
      r: '#5a4a44', K: '#3e3230', T: '#52526e',
      c: '#6e7090', d: '#6e7090', D: '#52526e', t: '#6e7090', l: '#94602e',
      x: '#94602e', X: '#c4e4ff', b: '#4a2a16', o: '#2a160e',
    },
  }));

  // Gaspar, Guru of Time: bowler hat, white moustache, mustard coat, cane, sleepy eyes.
  define('gaspar', person({
    hair: 'bowler', moustache: true, eyes: 'closed', brow: 'w', skin: 'light', lower: 'robe', flare: 0,
    top: ['buttons', 'collar'], width: 4.3, hunch: 0.12,
    body: { leg: 11, torso: 8 },
    prop: 'cane', hold: [0.4, 0.2],
    pal: {
      h: '#e4e8f0', H: '#bcc0d4', R: '#9294b0', w: '#ffffff', v: '#3e3230', V: '#2a2038', y: '#a02030',
      c: '#dcb468', d: '#dcb468', D: '#bc8844', t: '#bc8844', T: '#94602e', Y: '#6e4222', M: '#fff0dc',
      x: '#6e4222', b: '#4a2a16', o: '#2a160e',
    },
    anims: {
      // Dozes: the head nods.
      idle: { loop: true, frames: [{ ms: 900, armF: [0.4, 0.2], armB: [-0.1, 0.5] }, { ms: 900, nod: 1, bob: 1, armF: [0.4, 0.25], armB: [-0.1, 0.55] }] },
    },
  }));

  // =========================================================================================
  // Townsfolk: one painter, per-key specs
  // =========================================================================================
  const TOWN = {
    // ---- 600 A.D. (Truce, Guardia) ----
    // Farmer: green cap, brown jerkin vest over a linen shirt, belt.
    villager_600: {
      hair: 'cap', top: ['vest', 'belt'], skin: 'mid',
      pal: {
        h: '#6e4222', H: '#4a2a16', R: '#bc8844', v: '#488c34', V: '#2c6430',
        c: '#c0aa92', d: '#c0aa92', D: '#9c8674', l: '#4a2a16',
        p: '#7a665a', q: '#5a4a44', b: '#4a2a16', o: '#2a160e',
      },
      anims: { idle: { loop: true, frames: [{ ms: 540, armF: [0.1, 0.3], armB: [-0.1, 0.3] }, { ms: 540, bob: 1, armF: [0.1, 0.35], armB: [-0.1, 0.35], tilt: 1 }] } },
    },
    // Market wife: headscarf, red dress, white apron, basket.
    villager_600_b: {
      hair: 'scarf', eyes: 'lash', lower: 'dress', top: ['apron'], width: 3.6, skin: 'light',
      prop: 'basket', hold: [0.25, 1.35],
      pal: {
        h: '#6e4222', H: '#4a2a16', v: '#dcb468', V: '#bc8844', R: '#fff4b0',
        c: '#a02030', d: '#a02030', D: '#6c1422', t: '#a02030', T: '#6c1422', n: '#e4e8f0',
        x: '#bc8844', X: '#94602e', j: '#d43c3c', M: '#6c1422',
        p: '#e0a878', q: '#bc7a50', b: '#4a2a16', o: '#2a160e',
      },
    },
    // Old man: bald with a grey fringe and moustache, blue tunic, brown vest.
    villager_600_c: {
      hair: 'bald', moustache: true, eyes: 'closed', brow: 'w', top: ['vest', 'belt'], skin: 'light', hunch: 0.08,
      body: { leg: 11, torso: 9 },
      pal: {
        h: '#9294b0', H: '#6e7090', R: '#fff0dc', w: '#e4e8f0',
        v: '#6e4222', V: '#4a2a16', c: '#5c90dc', d: '#5c90dc', D: '#3c64b4', l: '#2a160e',
        p: '#7a665a', q: '#5a4a44', b: '#4a2a16', o: '#2a160e',
      },
    },

    // ---- 65,000,000 B.C. (Ioka) ----
    // Hunter: wild black mane, bare chest with a hide strap, fur shorts and boots.
    villager_ioka: {
      hair: 'wild', skin: 'tan', sleeves: 'bare', legs: 'bare', furBoots: true, lower: 'shorts', top: ['strap'],
      pal: {
        h: '#2a2038', H: '#0a0612', R: '#52526e', c: '#8c5034', v: '#4a2a16',
        t: '#dcb468', C: '#94602e', b: '#dcb468', o: '#bc8844',
      },
      anims: { idle: { loop: true, frames: [{ ms: 440, armF: [0.3, 0.3], armB: [-0.25, 0.3], footF: [1, 0], footB: [-1, 0] }, { ms: 440, bob: 1, armF: [0.25, 0.35], armB: [-0.2, 0.35], footF: [1, 0], footB: [-1, 0] }] } },
    },
    // Woman: long auburn hair, fur top and skirt, bone necklace.
    villager_ioka_b: {
      hair: 'long', eyes: 'lash', skin: 'mid', sleeves: 'bare', legs: 'bare', furBoots: true, lower: 'skirt', flare: 1, fold: false,
      top: ['fur'], width: 3.6,
      pal: {
        h: '#a02030', H: '#6c1422', R: '#d43c3c', c: '#dcb468', t: '#dcb468', C: '#94602e', l: '#94602e',
        M: '#fff0dc', b: '#bc8844', o: '#94602e',
      },
      torso(g, J, view) {
        if (view !== 'se') return;
        const c = J.chest;
        for (const dx of [0, 2, 4]) g.px(c.x + dx - 1, c.y + (dx === 2 ? 1 : 0), 'M'); // bone beads
      },
    },
    // Old man: grey mane, long beard, dark pelt, bone staff.
    villager_ioka_c: {
      hair: 'wild', beard: true, eyes: 'closed', brow: 'w', skin: 'mid', sleeves: 'bare', legs: 'bare', furBoots: true,
      lower: 'shorts', top: ['fur', 'belt'], hunch: 0.1,
      body: { leg: 11, torso: 9 },
      prop: 'staff', staffTop: 'bone', staffUp: 9, hold: [0.55, 0.6],
      pal: {
        h: '#9294b0', H: '#6e7090', R: '#e4e8f0', w: '#bcc0d4', W: '#9294b0',
        c: '#7a665a', t: '#7a665a', C: '#3e3230', l: '#3e3230',
        x: '#94602e', X: '#fff0dc', b: '#7a665a', o: '#5a4a44',
      },
    },

    // ---- 12,000 B.C. (Last Village: snow, fur-lined hoods) ----
    villager_last: {
      hair: 'hood', skin: 'light', lower: 'robe', top: ['belt'], width: 4.2,
      pal: {
        u: '#52526e', U: '#3a3a52', I: '#e4e8f0', H: '#6e4222',
        c: '#6e7090', d: '#6e7090', D: '#52526e', t: '#6e7090', T: '#52526e', l: '#4a2a16',
        b: '#4a2a16', o: '#2a160e',
      },
    },
    villager_last_b: {
      hair: 'hood', eyes: 'lash', skin: 'fair', lower: 'dress', top: ['shawl'], width: 3.6,
      pal: {
        u: '#e4e8f0', U: '#bcc0d4', I: '#c0aa92', H: '#6e4222',
        c: '#7a665a', d: '#7a665a', D: '#5a4a44', t: '#7a665a', T: '#5a4a44', i: '#2a7470', M: '#1a4a4e',
        p: '#5a4a44', q: '#3e3230', b: '#4a2a16', o: '#2a160e',
      },
    },
    villager_last_c: {
      hair: 'hood', skin: 'mid', top: ['belt'], furBoots: true,
      prop: 'spear', hold: [0.55, 0.9],
      pal: {
        u: '#2a7470', U: '#1a4a4e', I: '#e4e8f0', H: '#4a2a16',
        c: '#48a894', d: '#48a894', D: '#2a7470', l: '#4a2a16',
        p: '#52526e', q: '#3a3a52', b: '#c0aa92', o: '#9c8674',
        x: '#94602e', z: '#c4e4ff', y: '#9c8674',
      },
    },

    // ---- 1000 A.D. (Millennial Fair) ----
    // Showman: red vest, white shirt, blue trousers, brown cap.
    fairgoer: {
      hair: 'boater', top: ['vest', 'belt'], skin: 'light', blush: true,
      pal: {
        h: '#94602e', H: '#6e4222', R: '#fff4b0', v: '#d43c3c', V: '#a02030', J: '#2c4488', g: '#dcb468', G: '#bc8844',
        c: '#e4e8f0', d: '#e4e8f0', D: '#bcc0d4', l: '#2a160e',
        p: '#3c64b4', q: '#2c4488', b: '#6e4222', o: '#4a2a16',
      },
      anims: { idle: { loop: true, frames: [{ ms: 400, armF: [0.3, 0.4], armB: [-0.3, 0.3] }, { ms: 400, bob: 1, y: -1, armF: [0.35, 0.5], armB: [-0.35, 0.35], tilt: 1 }] } },
    },
    // Girl in a pink dress with a blonde ponytail and a balloon.
    fairgoer_b: {
      hair: 'pony', eyes: 'lash', lower: 'dress', flare: 1, sleeves: 'short', top: ['belt'], width: 3.5, skin: 'fair',
      prop: 'balloon', hold: [0.45, 1.6],
      pal: {
        h: '#fce068', H: '#e88c28', R: '#fff4b0', J: '#e0709c',
        c: '#e0709c', d: '#e0709c', D: '#a83c74', t: '#e0709c', T: '#a83c74', l: '#ffffff',
        j: '#5c90dc', N: '#c4e4ff', M: '#e4e8f0',
        p: '#fff0dc', q: '#f8d0a8', b: '#a83c74', o: '#6c2048',
      },
    },
    // Kid: shaggy black hair, striped yellow shirt, shorts, sneakers.
    fairgoer_c: {
      hair: 'beanie', sleeves: 'short', top: ['stripes'], skin: 'mid', blush: true,
      body: { leg: 9, torso: 7, headR: 5 },
      pal: {
        h: '#2a2038', H: '#0a0612', R: '#52526e', v: '#d43c3c', V: '#a02030', J: '#fce068', M: '#6e7090', y: '#5c90dc',
        c: '#fce068', d: '#fce068', D: '#f8bc3c', C: '#488c34',
        p: '#5c90dc', q: '#3c64b4', b: '#e4e8f0', o: '#bcc0d4',
      },
      anims: {
        // Bouncy kid: hops on the spot.
        idle: { loop: true, frames: [{ ms: 280, armF: [0.3, 0.6], armB: [-0.3, 0.5] }, { ms: 200, crouch: 1, armF: [0.2, 0.8], armB: [-0.2, 0.7] }, { ms: 280, y: -2, bob: -1, armF: [0.5, 0.3], armB: [-0.5, 0.3], footF: [0, 1], footB: [0, 1] }, { ms: 200, crouch: 1, armF: [0.2, 0.8], armB: [-0.2, 0.7] }] },
      },
    },
    // Grandmother: silver bun, purple shawl, teal dress with buttons.
    fairgoer_d: {
      hair: 'bun', eyes: 'closed', brow: 'H', lower: 'dress', top: ['shawl', 'buttons'], width: 3.8, skin: 'light', hunch: 0.08,
      body: { leg: 11, torso: 8 },
      pal: {
        h: '#bcc0d4', H: '#9294b0', R: '#ffffff', i: '#9450c0', M: '#6c3094',
        c: '#2a7470', d: '#2a7470', D: '#1a4a4e', t: '#2a7470', T: '#1a4a4e', Y: '#fce068',
        p: '#7a665a', q: '#5a4a44', b: '#3e3230', o: '#2a2038',
      },
    },
  };
  for (const [key, spec] of Object.entries(TOWN)) define(key, person(spec));

  // =========================================================================================
  // Props
  // =========================================================================================
  // Every standard animation plays the prop's own loop (hurt: a small jolt).
  function propAnims(frames) {
    const loop = { loop: true, frames };
    return {
      idle: loop, walk: loop, victory: loop, kneel: loop, shoot: loop, attack: { frames },
      cast: { frames: frames.length >= 3 ? frames : frames.concat(frames).concat(frames), charge: [0, 1], release: 2 },
      hurt: { frames: [Object.assign({}, frames[0], { ms: 300, x: -1, hurt: true })] },
      ko: { frames: [Object.assign({}, frames[0], { ms: 1000, ko: true })] },
    };
  }

  // ---- Epoch ----------------------------------------------------------------------------
  // Winged time machine in 3/4 view, hovering: the hull is authored in a local frame
  // (u along the axis to the nose, v down) and tilted per view.
  function epochDraw(g, J, view, pose) {
    const se = view === 'se';
    const ang = se ? 0.12 : -0.22;
    const cx = 28 + (pose.x || 0), cy = 32 + (pose.bob || 0);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (u, v) => { u *= 0.88; return [cx + u * ca - v * sa, cy + u * sa + v * ca]; };
    const poly = (pts, c) => g.poly(pts.map(([u, v]) => P(u, v)), c);
    const line = (u0, v0, u1, v1, c) => { const a = P(u0, v0), b = P(u1, v1); g.line(a[0], a[1], b[0], b[1], c); };
    const ell = (u, v, rx, ry, c) => { const a = P(u, v); g.ell(a[0], a[1], rx, ry, c); };
    const f = pose.f || 0;
    // Far wing and tail fin (behind the hull).
    poly([[-2, -2], [-15, -2], [-19, -12], [-15, -12]], 'f');
    line(-15, -11, -5, -3, 'M');
    poly([[-14, -3], [-22, -3], [-23, -11], [-20, -11]], 'f');
    line(-21, -10, -18, -4, 'r');
    // Hull: rounded body tapering to a sharp nose.
    const hull = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      let u = Math.cos(t) * 22, v = Math.sin(t) * 5.5;
      if (u > 6) v *= 1 - ((u - 6) / 18) * 0.75;
      hull.push([u + (u > 0 ? u * 0.12 : 0), v]);
    }
    poly(hull, 'a');
    // Belly.
    poly([[-18, 2.5], [18, 2.5], [22, 1.2], [14, 5], [-16, 5]], 'c');
    // Red speed stripe and gold trim.
    line(-20, 1, 24, 0.5, 'r');
    line(-17, -2, 10, -3, 'y');
    // Canopy (a pilot's silhouette shows only from the side).
    poly([[-2, -4], [12, -4], [9, -8], [3, -9.5], [-1, -8]], 'G');
    line(0, -8, 5, -9, 'N');
    line(1, -7, 3, -7.5, 'N');
    if (se) line(8, -7, 10, -5, 'M');
    // Rear thruster nozzle and flame (flickers with pose.f).
    ell(-22, 0, 2.2, 3, 'C');
    const fl = [[-24, 0], [-26 - f, 0]];
    line(fl[0][0], -1, fl[1][0], 0, 'e');
    line(fl[0][0], 1, fl[1][0] + 1, 0, 'e');
    const tip = P(-27 - f, 0); g.px(tip[0], tip[1], 'E');
    const core = P(-23, 0); g.px(core[0], core[1], 'E');
    // Near wing (in front of the hull).
    poly([[4, 3], [-12, 3], [-20, 13], [-15, 13]], 'b');
    line(-15, 12, 3, 4, 'r');
    line(-11, 4, -18, 12, 'M');
    // Nose light.
    const n = P(23, 0); g.px(n[0], n[1], f ? 'E' : 'y');
  }
  define('epoch', {
    pal: {
      a: '#e4e8f0', b: '#bcc0d4', f: '#9294b0', c: '#52526e', C: '#3a3a52', r: '#d43c3c', y: '#f8bc3c',
      G: '#5c90dc', N: '#c4e4ff', M: '#6e7090', e: '#8cc0f0', E: '#ffffff',
    },
    detail: 'rMNyeE',
    magic: false,
    anims: propAnims([
      { ms: 180, bob: 0, f: 0 }, { ms: 180, bob: -1, f: 1 }, { ms: 180, bob: -2, f: 0 }, { ms: 180, bob: -1, f: 1 },
    ]),
    draw: epochDraw,
  });

  // ---- Lavos seed -----------------------------------------------------------------------
  // A spiked shell egg whose veins pulse (inert: grey, cracked, a dying flicker).
  function seedDraw(inert) {
    return function (g, J, view, pose) {
      const p = pose.p || 0, cx = 28 + (pose.x || 0), cy = 42 - (inert ? 0 : p * 0.5);
      const rx = 6 + (inert ? 0 : p * 0.25), ry = 7.5 + (inert ? 0 : p * 0.5);
      // Shell nubs (Lavos carapace).
      const nubs = [[-4, -5, -7, -9], [0, -7, 0, -11], [4, -5, 7, -9], [-6, 0, -10, -1], [6, 0, 10, -1], [-5, 4, -8, 6], [5, 4, 8, 6]];
      for (const [a, b, c, d] of nubs) g.spike(cx + a, cy + b, cx + c, cy + d, 3, 'n');
      g.ell(cx, cy, rx, ry, 'a');
      // Veins / cracks (flat detail letters).
      const vein = inert ? (p ? 'V' : 'v') : p >= 2 ? 'V' : 'v';
      const back = view === 'ne';
      const s = back ? -1 : 1;
      for (const [x0, y0, x1, y1] of [[0, -6, s * -2, -1], [s * -2, -1, 0, 4], [0, 4, s * -1, 7], [s * 2, -4, s * 3, 1], [s * 3, 1, s * 1, 5], [s * -3, 2, s * -5, 5]]) g.line(cx + x0, cy + y0, cx + x1, cy + y1, vein);
      if (!inert) {
        // Glowing core; brightest on the pulse peak.
        g.ell(cx - s * 0.5, cy + 0.5, p >= 1 ? 1.4 : 0.6, p >= 1 ? 1.8 : 0.8, p >= 2 ? 'O' : 'V');
        if (p >= 2) { g.px(cx - s * 0.5, cy, 'W'); }
      } else g.px(cx - s * 1, cy + 1, p ? 'V' : 'v');
    };
  }
  const seedPulse = [{ ms: 420, p: 0 }, { ms: 140, p: 1 }, { ms: 200, p: 2 }, { ms: 160, p: 1 }];
  define('lavos_seed', {
    pal: { a: '#6c1422', n: '#a02030', v: '#d43c3c', V: '#f06c4c', O: '#fce068', W: '#fff4b0' },
    detail: 'vVOW',
    magic: false,
    anims: propAnims(seedPulse),
    draw: seedDraw(false),
  });
  define('lavos_seed_inert', {
    pal: { a: '#52526e', n: '#6e7090', v: '#2a2038', V: '#6c1422' },
    detail: 'vV',
    magic: false,
    anims: propAnims([{ ms: 1400, p: 0 }, { ms: 160, p: 1 }, { ms: 900, p: 0 }, { ms: 120, p: 1 }]),
    draw: seedDraw(true),
  });

  // ---- Gates ----------------------------------------------------------------------------
  // Standing elliptical portal; a spiral of bands turns with pose.ph (0..5).
  function gateDraw(hollow) {
    return function (g, J, view, pose) {
      const ph = pose.ph || 0;
      const cx = 28, cy = 30 + (pose.bob || 0), rx = 12.5, ry = 18.5;
      const bands = ['a', 'b', 'c', 'b'];
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
        // Hollow gate: rows glitch sideways.
        const jx = hollow && (y * 7 + ph * 5) % 11 === 0 ? (ph % 2 ? 1 : -1) : 0;
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
          const nx = (x + 0.5 - cx - jx) / rx, ny = (y + 0.5 - cy) / ry;
          const r = Math.hypot(nx, ny);
          if (r > 1) continue;
          let c;
          if (r > 0.86) c = 'g';
          else {
            const a = Math.atan2(ny, nx);
            const v = a / (Math.PI * 2) * 3 + r * 3.2 - ph / 6 * (view === 'se' ? 1 : -1);
            c = bands[((Math.floor(v * 2) % 4) + 4) % 4];
            if (r < 0.22) c = 'e';
            else if (r < 0.4 && c !== 'c') c = 'd';
          }
          if (hollow && r <= 0.86 && (y + ph) % 4 === 0 && (x * 5 + y * 3 + ph * 2) % 9 > 1) c = r < 0.4 ? 'x' : 'r';
          if (hollow && r < 0.14) c = 'r';
          g.px(x, y, c);
        }
      }
      // Sparks orbit the rim.
      for (let k = 0; k < 3; k++) {
        const a = (ph / 6 + k / 3) * Math.PI * 2;
        g.px(cx + Math.cos(a) * (rx + 0.5), cy + Math.sin(a) * (ry + 0.5), 'x');
        g.px(cx + Math.cos(a - 0.12) * (rx + 0.5), cy + Math.sin(a - 0.12) * (ry + 0.5), 'x');
      }
    };
  }
  const gateLoop = [0, 1, 2, 3, 4, 5].map((ph) => ({ ms: 110, ph, bob: ph === 2 || ph === 3 ? -1 : 0 }));
  define('time_gate', {
    pal: { g: '#8cc0f0', a: '#1c2c5c', b: '#3c64b4', c: '#5c90dc', d: '#8cc0f0', e: '#ffffff', x: '#c4e4ff' },
    detail: 'abcdex',
    magic: false,
    anims: propAnims(gateLoop),
    draw: gateDraw(false),
  });
  define('hollow_gate', {
    pal: { g: '#9294b0', a: '#2a2038', b: '#52526e', c: '#6e7090', d: '#bcc0d4', e: '#e4e8f0', r: '#d43c3c', x: '#f06c4c' },
    detail: 'abcderx',
    magic: false,
    anims: propAnims(gateLoop),
    draw: gateDraw(true),
  });
})();
