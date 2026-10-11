// Interactive battlefield spots: planted swords, shrines, springs, levers, kegs,
// boulders, chests… Each story battle lists its spots here (keyed by battle id),
// so story.js stays untouched. The rules live in CT.Interact; battlectl.js calls
// it after moves (step spots), from the Interact menu command (use spots) and on
// hover; render.js calls CT.Interact.drawMarker for the glowing tile markers.
//
// Spot schema:
//   { id, at: [x, y] | '@marker', kind, name, desc,
//     who: ['crono'] (heroes allowed; omitted = any hero),
//     mode: 'step' (triggers when an allowed hero ends a move on it)
//         | 'use'  (menu command "verb" while on it, or adjacent when range: 1; costs the action)
//         | 'tech' (placards: shattered by the battle rules when a tech is used on them),
//     range: 0 | 1, uses: 1, verb: 'Pull lever', decor: { kind, variant } (adds an object),
//     effect: { learn, heal: { hp, mp, radius, cure }, item: { id: n }, buff: [[status, turns]],
//               blast: { r, shape, pct, bossPct, status, offset }, roll: { dir, len, pct, status },
//               fill: { cells, terrain, h }, revive: pct, damage: { unit, pct } },
//     bonus: { who, effect, lines }   (extra effect for one hero, e.g. Magus at a Zeal font)
//     lines: [[speaker, emotion, text]], fx, sfx, color }
(function () {
  const CT = (window.CT = window.CT || {});
  const key = (x, y) => `${x},${y}`;
  const sfx = (id) => CT.audio && CT.audio.sfx(id);
  const wait = (ms) => (CT.FAST ? Promise.resolve() : CT.wait(ms));

  // ---- Per-battle spots ---------------------------------------------------------------
  CT.INTERACTIVES = {
    // Prologue — Leene Square at night: the fair's own props fight back.
    B0: [
      { id: 'b0_fountain', at: [5, 5], kind: 'spring', mode: 'use', range: 1, uses: 2, verb: 'Drink',
        name: "Leene's Fountain", desc: 'Any hero standing beside it: restores 40% HP and cures ailments for the drinker and allies next to them. 2 uses.',
        effect: { heal: { hp: 0.4, mp: 0.2, radius: 1, cure: true } },
        lines: [['frog', 'happy', `Sweet water, blessed by the Queen herself. Drink, and stand again.`]] },
      { id: 'b0_fireworks', at: [7, 3], kind: 'keg', mode: 'use', range: 1, verb: 'Light fuse', decor: { kind: 'crate', variant: 1 },
        name: 'Fireworks Crate', desc: "Tonight's finale. Light it from an adjacent tile: a 3×3 blast that burns everything around the crate — friend or foe (not the one who lit it).",
        effect: { blast: { r: 1, pct: 0.45, bossPct: 0.12, status: ['burn', 0.6, 3] } },
        lines: [['frog', 'surprised', `Crono! Those are the fair's rockets — mind the sparks!`]] },
      { id: 'b0_prize', at: [13, 7], kind: 'chest', mode: 'step',
        name: 'Silver Point Prize Box', desc: 'Unclaimed fair prizes. Any hero who steps here takes them (Mid Tonic, Tonic).',
        effect: { item: { mid_tonic: 1, tonic: 1 } },
        lines: [['frog', 'happy', `Prizes from the games, unclaimed. The fair would want them used.`]] },
    ],
    // Chapter 1 — Denadoro: a fallen knight's sword, the Masamune's spring, a loose boulder.
    B1: [
      { id: 'b1_sword', at: [9, 12], kind: 'sword', mode: 'step', who: ['crono'],
        name: "Fallen Knight's Sword", desc: 'Planted in the ford below the trail, where a knight fell. CRONO ONLY: touch it to learn the tech Confuse.',
        effect: { learn: 'confuse' },
        lines: [
          ['frog', 'sad', `A knight's blade, left where he fell. Cyrus's men climbed this trail and never came down.`],
          ['frog', 'determined', `Take it up, Crono. Its master would not begrudge thee — swing it the way he did.`],
        ] },
      { id: 'b1_pool', at: [8, 11], kind: 'spring', mode: 'step', who: ['frog'],
        name: "Masamune's Pool", desc: 'The cold river below the falls. FROG ONLY (it is deep water): fully restores his MP and 50% HP.',
        effect: { heal: { hp: 0.5, mp: 1, radius: 0, cure: true } },
        lines: [['frog', 'determined', `This water ran past the Masamune for a thousand years. It remembereth a frog.`]] },
      { id: 'b1_boulder', at: [14, 5], kind: 'boulder', mode: 'use', range: 1, verb: 'Push boulder', decor: { kind: 'rock' },
        name: 'Loose Boulder', desc: "Above the bearer's trail to the bridge. Any hero beside it can send it rolling WEST along the ledge path, crushing whatever stands in the way.",
        effect: { roll: { dir: [-1, 0], len: 5, pct: 0.35, bossPct: 0.1, status: ['stun', 0.5, 1] } },
        lines: [['frog', 'determined', `Put thy shoulder to it! The mountain fighteth for us!`]] },
    ],
    // Chapter 2 — the Tyrano crater: Ayla's Dreamstone, a tail fossil, a rim boulder.
    B2: [
      { id: 'b2_dreamstone', at: [12, 12], kind: 'dreamstone', mode: 'use', range: 1, who: ['ayla'], verb: 'Touch Dreamstone', decor: { kind: 'dreamstone' },
        name: 'Dreamstone Outcrop', desc: 'Red stone that sings to Ioka blood. AYLA ONLY, from an adjacent tile: Haste and Might (ATK +30%) for 4 turns.',
        effect: { buff: [['haste', 4], ['might', 4]] },
        lines: [['ayla', 'happy', `Red stone! Stone of dream! Ayla feel… BIG. Ayla feel FAST!`]] },
      { id: 'b2_fossil', at: [11, 11], kind: 'fossil', mode: 'use', range: 1, who: ['ayla'], verb: 'Study fossil',
        name: 'Tyrano Tail Fossil', desc: "A king tyrano's tail, turned to stone. AYLA ONLY, from an adjacent tile: learn the tech Dino Tail.",
        effect: { learn: 'dino_tail' },
        lines: [
          ['ayla', 'determined', `Big lizard tail. Big lizard swing tail like THIS — everything fall down.`],
          ['ayla', 'happy', `Ayla swing like big lizard now!`],
        ] },
      { id: 'b2_boulder', at: [14, 8], kind: 'boulder', mode: 'use', range: 1, verb: 'Push boulder', decor: { kind: 'rock' },
        name: 'Rim Boulder', desc: 'Perched on the crater rim. Any hero beside it can send it rolling WEST into the nest, crushing whatever stands in the way.',
        effect: { roll: { dir: [-1, 0], len: 6, pct: 0.35, bossPct: 0.1, status: ['stun', 0.5, 1] } },
        lines: [['ayla', 'angry', `Rock go DOWN! Egg-things go SQUISH!`]] },
    ],
    // Chapter 3 — the wreck of Zeal: a mana font Magus remembers, raw Dreamstone, a sunken cache.
    B3: [
      { id: 'b3_font', at: [8, 8], kind: 'font', mode: 'step', uses: 2,
        name: 'Zeal Mana Font', desc: 'Still humming with the Kingdom of Zeal\'s magic. Any hero: restores all MP. MAGUS learns Magic Wall here. 2 uses.',
        effect: { heal: { mp: 1, radius: 0 } },
        bonus: { who: 'magus', effect: { learn: 'magic_wall' },
          lines: [
            ['magus', 'neutral', `The fonts of the Palace. Schala taught me the ward-script on one of these.`],
            ['magus', 'determined', `…I had forgotten I remembered it.`],
          ] },
        lines: [['magus', 'neutral', `Drink from it, then. Zeal won't need it any longer.`]] },
      { id: 'b3_crystal', at: [7, 8], kind: 'crystal', mode: 'use', range: 1, verb: 'Shatter Dreamstone',
        name: 'Unstable Dreamstone', desc: 'Overcharged red crystal. Any hero beside it can shatter it: a blast hits everything within 2 tiles of the crystal (not the one who strikes it).',
        effect: { blast: { r: 2, shape: 'radius', pct: 0.3, bossPct: 0.08, status: ['slow', 0.5, 2] } },
        lines: [['ayla', 'surprised', `Red stone angry! Stand back!`]] },
      { id: 'b3_cache', at: [14, 11], kind: 'chest', mode: 'step',
        name: 'Sunken Zeal Coffer', desc: 'Out in the flooded aisle — only a swimmer (Frog) or a floater (Magus) can reach it. Holds Ethers and a Revive.',
        effect: { item: { ether: 2, revive: 1 } },
        lines: [['frog', 'happy', `A coffer of the sky-kingdom, sunk in the shallows. Its stores are ours now.`]] },
    ],
    // Chapter 4 — the Atrium: exhibits that are better used than looked at.
    B4A: [
      { id: 'b4a_medal', at: [4, 4], kind: 'shrine', mode: 'use', range: 1, who: ['frog'], verb: 'Take the Medal',
        name: 'Exhibit: The Hero Medal', desc: "Glenn's medal, catalogued and glassed. FROG ONLY, from an adjacent tile: the Masamune answers it — learn the tech Masamune Gale.",
        effect: { learn: 'masamune_gale' },
        lines: [
          ['frog', 'surprised', `My medal. Mine and Cyrus's. They put it behind glass…`],
          ['frog', 'determined', `Masa! Mune! If ye still hear me — RISE!`],
        ] },
      { id: 'b4a_shutter', at: [13, 3], kind: 'lever', mode: 'use', range: 0, verb: 'Pull lockdown lever',
        name: 'Gallery Lockdown Lever', desc: 'Right beside the exhibit floor. Stand on it and pull: the security shutter slams down on the Echo Avian Rex (15% of its HP, Slowed for 3 turns).',
        effect: { damage: { unit: 'tyrano', pct: 0.15, status: ['slow', 1, 3] } },
        lines: [['crono', 'neutral', `!`]] },
      { id: 'b4a_till', at: [2, 13], kind: 'chest', mode: 'step',
        name: 'Gift Shop Till', desc: "The museum's gift shop, long closed. Any hero who steps here: Mid Tonic ×2.",
        effect: { item: { mid_tonic: 2 } },
        lines: [['ayla', 'happy', `Shiny box! Ayla take. Museum not need.`]] },
    ],
    // Chapter 4 — the Archive: catwalk cranes across the chasm and a restoration font.
    B4B: [
      { id: 'b4b_crane_w', at: [7, 5], kind: 'lever', mode: 'use', range: 0, verb: 'Pull crane lever',
        name: 'Stack Crane (west)', desc: 'Stand on it and pull: lowers a catwalk across the chasm at this row, joining the two halves of the party.',
        effect: { fill: { cells: [[8, 5]], terrain: 'k', h: 0 } },
        lines: [['ayla', 'determined', `Ayla make bridge! Blue-hair, Frog-man — come!`]] },
      { id: 'b4b_crane_e', at: [9, 12], kind: 'lever', mode: 'use', range: 0, verb: 'Pull crane lever',
        name: 'Stack Crane (east)', desc: 'Stand on it and pull: lowers a catwalk across the chasm at this row, joining the two halves of the party.',
        effect: { fill: { cells: [[8, 12]], terrain: 'k', h: 0 } },
        lines: [['frog', 'determined', `A walkway! Hold fast, Crono — we come!`]] },
      { id: 'b4b_font', at: [1, 3], kind: 'spring', mode: 'step', uses: 2,
        name: 'Restoration Basin', desc: 'Where the archive cleans its exhibits. Any hero who steps here: heals 40% HP and cures ailments for them and adjacent allies. 2 uses.',
        effect: { heal: { hp: 0.4, mp: 0.15, radius: 1, cure: true } },
        lines: [['ayla', 'happy', `Water clean. Ayla feel new.`]] },
    ],
    // Finale — the Core: the placards (rules in battle.js) and a Time Egg.
    B5: [
      { id: 'b5_egg', at: [4, 9], kind: 'egg', mode: 'step',
        name: 'The Time Egg', desc: 'A Chrono Trigger, misfiled. Any hero who steps here: revives every fallen ally at 50% HP and heals the rest 30%. One use — save it!',
        effect: { revive: 0.5, heal: { hp: 0.3, radius: 99 } },
        lines: [
          ['frog', 'surprised', `The egg of time — here?`],
          ['magus', 'determined', `The machine catalogued a Chrono Trigger and never understood what it was. Use it.`],
        ] },
      { id: 'b5_conduit', at: [11, 4], kind: 'font', mode: 'step', uses: 2,
        name: 'Archive Power Conduit', desc: 'Raw time-energy feeding the exhibits. Any hero who steps here: restores 60% MP. 2 uses.',
        effect: { heal: { mp: 0.6, radius: 0 } },
        lines: [['magus', 'neutral', `Its power is ours to borrow.`]] },
    ],
  };

  // Spot appearance per kind: glow colour, floating icon, default sfx and effect sheet.
  const KIND = {
    sword: { color: '252,224,104', icon: 'sword', sfx: 'sfx_sword_swing', fx: 'fx_ia_learn' },
    shrine: { color: '252,224,104', icon: 'medal', sfx: 'sfx_glass_shatter', fx: 'fx_ia_learn' },
    fossil: { color: '252,224,104', icon: 'bone', sfx: 'sfx_kick', fx: 'fx_ia_learn' },
    dreamstone: { color: '255,96,120', icon: 'crystal', sfx: 'sfx_seed_pulse', fx: 'fx_ia_power' },
    crystal: { color: '255,120,80', icon: 'crystal', sfx: 'sfx_glass_shatter', fx: 'fx_ia_blast' },
    spring: { color: '120,240,170', icon: 'drop', sfx: 'sfx_heal_chime', fx: 'fx_ia_spring' },
    font: { color: '140,170,255', icon: 'rune', sfx: 'sfx_heal_chime', fx: 'fx_ia_spring' },
    keg: { color: '255,150,60', icon: 'flame', sfx: 'sfx_dark_bomb', fx: 'fx_ia_blast' },
    boulder: { color: '230,190,130', icon: 'rock', sfx: 'sfx_door', fx: 'fx_ia_dust' },
    lever: { color: '160,210,255', icon: 'lever', sfx: 'sfx_door', fx: 'fx_ia_dust' },
    chest: { color: '255,230,140', icon: 'chest', sfx: 'sfx_item_get', fx: 'fx_ia_spring' },
    egg: { color: '255,255,255', icon: 'egg', sfx: 'sfx_gate_open', fx: 'fx_ia_learn' },
    placard: { color: '200,160,255', icon: 'placard' },
  };

  // 7-px-wide pixel icons (letters → colours) floating over the tile.
  const IC = { W: '#ffffff', s: '#c8d0e8', S: '#7880a8', y: '#fce068', o: '#c87828', b: '#6a3a1c', r: '#e83850', R: '#8c1838',
    g: '#80f0a8', G: '#30a060', c: '#b8e8ff', B: '#4c78d8', k: '#20142c', e: '#f0e8d0', E: '#b0a080', p: '#d0b0ff', P: '#6040a0', f: '#ffb040', F: '#e04020' };
  const ICONS = {
    sword: ['...W...', '..WsW..', '..WsW..', '..WsW..', '..WsW..', '..WsS..', '.yoyoy.', '...b...', '...b...', '...y...'],
    medal: ['..B.r..', '...Br..', '...r...', '..yyy..', '.yyWyy.', '.yWyyy.', '.yyyyo.', '..yyo..'],
    bone: ['ee...ee', 'eEe.eEe', '.eEeEe.', '..eEe..', '.eEeEe.', 'eEe.eEe', 'ee...ee'],
    crystal: ['...W...', '..rWr..', '.rrWrr.', '.rRrWr.', '.rRrrr.', '..RrR..', '...R...'],
    drop: ['...c...', '..ccc..', '.ccWcc.', '.cWccB.', '.ccccB.', '..cBB..'],
    rune: ['..ppp..', '.p.W.p.', 'p.WWW.p', 'pWW.WWp', 'p.WWW.p', '.p.W.p.', '..ppp..'],
    flame: ['...y...', '..yfy..', '..fyf..', '.fFyFf.', '.fFfFf.', '..FFF..'],
    rock: ['..EEE..', '.EeeEE.', 'EeeEEEk', 'EeEEEEk', 'EEEEEkk', '.EkkEk.', '..kkk..'],
    lever: ['.....y.', '....y..', '...S...', '..S....', '.SSSSS.', '.SkkkS.'],
    chest: ['.ooooo.', 'oyyyyyo', 'obbybbo', 'oyyWyyo', 'obbbbbo', 'ooooooo'],
    egg: ['..eee..', '.eWWee.', 'eWWeeEe', 'eWeeeEe', 'eeeeeEe', '.eEEEe.', '..EEE..'],
    placard: ['ppppppp', 'pWWWWWp', 'pW.W.Wp', 'pWWWWWp', 'ppppppp', '...P...', '..PPP..'],
    used: ['.S.S.', 'S.S.S', '.S.S.'],
  };

  const Interact = {
    // Builds the live spot list for a battle (called once from BattleCtl.setup).
    setup(b, def) {
      const list = (def.spots || CT.INTERACTIVES[def.id] || []).map((s) => ({ uses: 1, mode: 'step', range: 0, ...s }));
      b.spots = [];
      for (const s of list) {
        const p = b.resolveAt(s.at);
        if (!p || !b.tile(p.x, p.y)) continue;
        const spot = { ...s, x: p.x, y: p.y, left: s.uses, spent: false };
        if (s.decor) {
          const d = { x: p.x, y: p.y, kind: s.decor.kind, variant: s.decor.variant || 0 };
          const old = b.map.decorAt.get(key(p.x, p.y));
          if (old) old.hidden = true;
          b.map.decor.push(d);
          b.map.decorAt.set(key(p.x, p.y), d);
          spot.decorRef = d;
        } else {
          const d = b.map.decorAt.get(key(p.x, p.y));
          if (d && !d.hidden) spot.decorRef = d;
        }
        b.spots.push(spot);
      }
      // The Core's placards are spots too (shattered by the battle rules in afterTech).
      if (b.placards)
        for (const z of b.placards.zones)
          for (const k of b.map.zones[z] || []) {
            const [x, y] = k.split(',').map(Number);
            b.spots.push({ id: 'placard_' + z + '_' + k, kind: 'placard', mode: 'tech', zone: z, x, y, left: 1, spent: false,
              name: 'Exhibit Placard', desc: `Stand on this pedestal and use any tech: the placard shatters and the Curator takes ${b.placards.damage || 150} damage.` });
          }
      Interact.sync(b);
    },
    // Refreshes derived state (placards broken, voided tiles) and the tile→spot map used for drawing.
    sync(b) {
      if (!b.spots) return;
      const m = new Map();
      for (const s of b.spots) {
        if (s.kind === 'placard' && b.placards && b.placards.broken.has(s.zone)) s.spent = true;
        const t = b.tile(s.x, s.y);
        s.gone = !t || CT.TERRAIN[t.t].void;
        if (!s.gone) m.set(key(s.x, s.y), s);
      }
      b.spotAt = m;
      // For drawing: also chevrons along each ready boulder's rolling path.
      const draw = new Map(m);
      for (const s of b.spots) {
        if (s.spent || s.gone || !s.effect || !s.effect.roll) continue;
        const [dx, dy] = s.effect.roll.dir;
        for (let i = 1; i <= s.effect.roll.len; i++) {
          const k = key(s.x + dx * i, s.y + dy * i);
          if (b.tile(s.x + dx * i, s.y + dy * i) && !draw.has(k)) draw.set(k, { trail: true, spot: s, i, x: s.x + dx * i, y: s.y + dy * i, dir: [dx, dy] });
        }
      }
      return draw;
    },
    at(b, x, y) {
      const s = b.spotAt && b.spotAt.get(key(x, y));
      return s && !s.spent && !s.gone ? s : null;
    },
    allowed(s, u) {
      return !!(u && u.hero && u.team === 0 && (!s.who || s.who.includes(u.id)));
    },
    whoText(s) {
      return s.who ? s.who.map((id) => (CT.HEROES[id] ? CT.HEROES[id].name : id)).join(' / ') + ' only' : 'Any hero';
    },
    inReach(s, x, y) {
      const d = Math.abs(s.x - x) + Math.abs(s.y - y);
      return s.range ? d <= s.range : d === 0;
    },
    // 'use' spots the active unit can work from where it stands.
    usableHere(b, u) {
      if (!b.spots) return [];
      return b.spots.filter((s) => s.mode === 'use' && !s.spent && !s.gone && Interact.allowed(s, u) && Interact.inReach(s, u.x, u.y));
    },
    // Text for the hover / inspect panel.
    panelHtml(b, x, y) {
      const s = b.spotAt && b.spotAt.get(key(x, y));
      if (!s || s.gone) return '';
      const how = s.mode === 'step' ? 'Step on it' : s.mode === 'tech' ? 'Use a tech on it' : s.range ? `Beside it: ${s.verb || 'Interact'}` : `On it: ${s.verb || 'Interact'}`;
      const state = s.spent ? '<i>Used up.</i>' : s.left > 1 ? `${s.left} uses left.` : '';
      return `<div class="preview ia" style="color:#fce068;white-space:normal">✦ ${s.name}</div><div class="stats" style="white-space:normal;color:#d0e0ff">${s.desc}</div><div class="stats">${Interact.whoText(s)} · ${how}${state ? ' · ' + state : ''}</div>`;
    },

    // ---- Triggering ---------------------------------------------------------------------
    // After a hero's own move: fires a step spot under them. Returns true if something fired.
    async onArrive(ctl, u) {
      const b = ctl.b;
      if (!b.spots || !u || !u.alive || !u.hero || u.team !== 0) return false;
      const s = Interact.at(b, u.x, u.y);
      if (!s || s.mode !== 'step') return false;
      if (!Interact.allowed(s, u)) {
        if (!s.warned) {
          s.warned = true;
          CT.UI.banner(`${s.name}: ${Interact.whoText(s)}.`, 1600);
          ctl.r.floatText(u, '?', '#fce068');
        }
        return false;
      }
      await Interact.trigger(ctl, s, u);
      return true;
    },
    // A use spot chosen from the menu (or by the AI). Costs the unit's action.
    async use(ctl, s, u) {
      await Interact.trigger(ctl, s, u);
      ctl.b.acted1 = true;
    },

    async trigger(ctl, s, u) {
      const b = ctl.b;
      const r = ctl.r;
      const UI = CT.UI;
      const k = KIND[s.kind] || KIND.chest;
      s.left -= 1;
      if (s.left <= 0) s.spent = true;
      if (s.mode === 'use' && (s.x !== u.x || s.y !== u.y)) u.face = CT.dirTo(u.x, u.y, s.x, s.y);
      const h = b.visH(b.tile(s.x, s.y));
      r.focus(s.x, s.y, b.tile(s.x, s.y).h);
      r.anim(u, s.mode === 'use' ? 'attack' : 'cast');
      sfx(s.sfx || k.sfx);
      r.flashScreen(k.color, 260);
      r.shake(4, 300);
      r.playFx(s.fx || k.fx, s.x, s.y, h, { noShake: true });
      UI.banner(`✦ ${u.name}: ${s.name}`, 1800, 'dual');
      if (b.game) (b.game.flags.ia_used = b.game.flags.ia_used || {})[s.id] = true;
      if (window.TEST_LOG) window.TEST_LOG.push({ interact: s.id, by: u.id });
      await wait(420);
      const lines = s.bonus && s.bonus.who === u.id && s.bonus.lines ? [...(s.lines || []), ...s.bonus.lines] : s.lines || [];
      if (lines.length) {
        if (lines[0][0] === 'crono') {
          // Crono doesn't talk: he reacts.
          u.emote = { text: lines[0][2] || '!', t0: performance.now() };
          await wait(500);
        } else await ctl.fire({ lines });
      }
      await Interact.apply(ctl, s, u, s.effect || {});
      if (s.bonus && s.bonus.who === u.id) await Interact.apply(ctl, s, u, s.bonus.effect || {});
      Interact.sync(b);
      ctl.refresh();
    },

    async apply(ctl, s, u, ef) {
      const b = ctl.b;
      const r = ctl.r;
      const g = ctl.game;
      const UI = CT.UI;
      const out = { results: [], moves: [], spawns: [], notes: [] };
      const team0 = () => b.living().filter((v) => v.team === 0);
      if (ef.learn) await Interact.learn(ctl, u, ef.learn);
      if (ef.revive) {
        for (const v of b.units.filter((v) => v.team === 0 && (v.hero || v.guest) && v.ko && !v.alive && !v.despawned)) {
          v.alive = true;
          v.ko = false;
          v.koPose = false;
          v.alpha = 1;
          v.hp = Math.max(1, Math.round(v.maxHp * ef.revive));
          r.floatText(v, 'REVIVED', '#80ff90');
          r.playFx('fx_ia_spring', v.x, v.y, v.rh, { noShake: true });
        }
        await wait(300);
      }
      if (ef.heal) {
        const hl = ef.heal;
        const near = team0().filter((v) => Math.abs(v.x - u.x) + Math.abs(v.y - u.y) <= (hl.radius || 0));
        for (const v of near) {
          if (hl.hp) {
            const amt = Math.min(v.maxHp - v.hp, Math.round(v.maxHp * hl.hp));
            if (amt > 0) out.results.push({ target: v, heal: amt });
            v.hp += amt;
          }
          if (hl.mp && v.maxMp < 999) {
            const amt = Math.min(v.maxMp - v.mp, Math.round(v.maxMp * hl.mp));
            v.mp += amt;
            if (amt > 0) r.floatText(v, `+${amt} MP`, '#80c0ff');
          }
          if (hl.cure) for (const st of ['burn', 'slow', 'stun', 'magdown', 'catalogued']) delete v.status[st];
          r.burst(v.x, v.y, v.rh, 'heal', { noShake: true });
        }
      }
      if (ef.item) {
        const got = [];
        for (const [id, n] of Object.entries(ef.item)) {
          if (g) g.addItem(id, n);
          got.push(`${CT.ITEMS[id] ? CT.ITEMS[id].name : id} ×${n}`);
        }
        sfx('sfx_item_get');
        r.floatText(u, 'GOT!', '#ffe080');
        UI.banner(`Found ${got.join(', ')}!`, 2000);
        await wait(500);
      }
      if (ef.buff) {
        for (const [st, turns] of ef.buff) if (b.addStatus(u, st, turns)) out.results.push({ target: u, status: st });
        r.playFx('fx_ia_power', u.x, u.y, u.rh, { noShake: true });
      }
      if (ef.damage) {
        const v = b.unitById(ef.damage.unit);
        if (v && v.alive) {
          r.focus(v.x, v.y, b.tile(v.x, v.y).h);
          r.playFx('fx_ia_shutter', v.x, v.y, v.rh, {});
          r.shake(10, 500);
          sfx('sfx_glass_shatter');
          await wait(350);
          b.damage(v, Math.max(1, Math.round(v.maxHp * ef.damage.pct)), out, {});
          if (ef.damage.status && v.alive) {
            const [st, ch, turns] = ef.damage.status;
            if (Math.random() < ch && b.addStatus(v, st, turns)) out.results.push({ target: v, status: st });
          }
        }
      }
      if (ef.blast) await Interact.blast(ctl, s, u, ef.blast, out);
      if (ef.roll) await Interact.roll(ctl, s, u, ef.roll, out);
      if (ef.fill) {
        b.fillTiles(ef.fill.cells, ef.fill.terrain || 'k', ef.fill.h);
        b.voided = b.voided.filter((v) => !ef.fill.cells.some(([x, y]) => x === v.x && y === v.y));
        r.invalidateTiles();
        r.shake(8, 500);
        sfx('sfx_door');
        for (const [x, y] of ef.fill.cells) {
          const t = b.tile(x, y);
          r.playFx('fx_ia_dust', x, y, b.visH(t), { noShake: true });
          r.focus(x, y, t.h);
        }
        UI.banner('A walkway lowers across the gap!', 1800);
        await wait(600);
      }
      if (out.results.length) await ctl.showResults(out, u);
    },

    async learn(ctl, u, id) {
      const b = ctl.b;
      const r = ctl.r;
      const g = ctl.game;
      const t = CT.TECHS[id];
      if (!t) return;
      const m = g && g.members[u.id];
      const already = u.techs.includes(id) || (m && m.learned && m.learned.includes(id));
      if (m) {
        m.learned = m.learned || [];
        if (!m.learned.includes(id)) m.learned.push(id);
        g.unlock(id);
      }
      if (!u.techs.includes(id)) u.techs.push(id);
      r.playFx('fx_ia_learn', u.x, u.y, u.rh, {});
      r.flashScreen('255,248,200', 500);
      r.shake(8, 500);
      sfx('sfx_level_up');
      u.flash = 1;
      CT.tween(CT.FAST ? 5 : 600, (k) => (u.flash = Math.floor(k * 8) % 2 ? 0 : 1 - k)).then(() => (u.flash = 0));
      if (already) {
        // Already known: the spot still restores the hero.
        u.mp = Math.min(u.maxMp, u.mp + Math.round(u.maxMp * 0.5));
        CT.UI.banner(`${u.name} already knows ${t.name}. MP restored!`, 2000, 'dual');
        await wait(600);
        return;
      }
      CT.UI.banner(`✦ ${u.name} learned ${t.name}! ✦`, 2400, 'dual');
      r.floatText(u, t.name.toUpperCase() + '!', '#fce068', true);
      await wait(700);
      await CT.UI.popup(`<b>${u.name} learned a new tech:</b><br><span style="color:#fce068">${t.name}</span> — ${t.mp} MP<br><small>${t.desc || ''}</small><br><small>It stays in ${u.name}'s Tech menu from now on.</small>`, { sfx: 'sfx_level_up' });
    },

    async blast(ctl, s, u, bl, out) {
      const b = ctl.b;
      const r = ctl.r;
      const c = { x: s.x + ((bl.offset && bl.offset[0]) || 0), y: s.y + ((bl.offset && bl.offset[1]) || 0) };
      const tiles = [];
      for (let dy = -bl.r; dy <= bl.r; dy++)
        for (let dx = -bl.r; dx <= bl.r; dx++) {
          if (bl.shape === 'radius' && Math.abs(dx) + Math.abs(dy) > bl.r) continue;
          const t = b.tile(c.x + dx, c.y + dy);
          if (t && !CT.TERRAIN[t.t].void) tiles.push(t);
        }
      if (s.decorRef) s.decorRef.hidden = true;
      r.flashScreen('255,200,120', 380);
      r.shake(12, 700);
      sfx('sfx_dark_bomb');
      tiles.forEach((t, i) => r.playFx('fx_ia_blast', t.x, t.y, b.visH(t), { delay: CT.FAST ? 0 : i * 18, noShake: i > 0 }));
      await wait(380);
      const set = new Set(tiles.map((t) => key(t.x, t.y)));
      for (const v of b.living()) {
        if (v === u || !set.has(key(v.x, v.y)) || v.team === 2) continue;
        const pct = v.boss || v.big ? bl.bossPct || 0.1 : bl.pct;
        b.damage(v, Math.max(1, Math.round(v.maxHp * pct)), out, {});
        if (bl.status && v.alive) {
          const [st, ch, turns] = bl.status;
          if (Math.random() < ch && b.addStatus(v, st, turns)) out.results.push({ target: v, status: st });
        }
      }
    },

    // Boulder: rolls from the spot in a fixed direction while the ground is level or
    // lower, crushing every unit it passes; it comes to rest at the end (or sinks).
    async roll(ctl, s, u, rl, out) {
      const b = ctl.b;
      const r = ctl.r;
      const [dx, dy] = rl.dir;
      let prev = b.tile(s.x, s.y);
      const path = [];
      let sank = false;
      for (let i = 1; i <= rl.len; i++) {
        const t = b.tile(s.x + dx * i, s.y + dy * i);
        if (!t || t.h > prev.h) break;
        const m = CT.TERRAIN[t.t];
        if (b.decorBlocks(t)) break;
        path.push(t);
        if (m.void || m.lava || m.swim) {
          sank = true;
          break;
        }
        prev = t;
      }
      if (!path.length) {
        CT.UI.banner("It won't budge.", 1200);
        return;
      }
      const d = s.decorRef;
      if (d) d.hidden = true;
      const end = path[path.length - 1];
      const h0 = b.visH(b.tile(s.x, s.y));
      const travel = CT.FAST ? 5 : 160 * path.length;
      sfx('sfx_door');
      r.playFx('fx_ia_boulder', end.x, end.y, b.visH(end), { from: [s.x, s.y, h0 + 0.6], travel });
      r.shake(6, travel + 200);
      for (const t of path) {
        await wait(160);
        r.playFx('fx_ia_dust', t.x, t.y, b.visH(t), { noShake: true });
        const v = b.unitAt(t.x, t.y);
        if (v && v !== u && v.team !== 2) {
          b.damage(v, Math.max(1, Math.round(v.maxHp * (v.boss || v.big ? rl.bossPct || 0.1 : rl.pct))), out, {});
          if (rl.status && v.alive) {
            const [st, ch, turns] = rl.status;
            if (Math.random() < ch && b.addStatus(v, st, turns)) out.results.push({ target: v, status: st });
          }
          sfx('sfx_kick');
        }
      }
      r.shake(10, 400);
      if (d && !sank && !b.unitAt(end.x, end.y) && !b.map.decorAt.get(key(end.x, end.y))) {
        // The boulder settles as a new obstacle.
        b.map.decorAt.delete(key(s.x, s.y));
        d.x = end.x;
        d.y = end.y;
        d.hidden = false;
        b.map.decorAt.set(key(end.x, end.y), d);
      } else if (sank) sfx('sfx_water_splash');
    },

    // ---- AI (autoplay / ?interact): heroes detour to spots worth taking -------------------
    aiValue(b, s, u) {
      const ef = s.effect || {};
      let v = 0;
      if (ef.learn) v += u.techs.includes(ef.learn) ? 0.2 : 3;
      if (s.bonus && s.bonus.who === u.id && s.bonus.effect && s.bonus.effect.learn && !u.techs.includes(s.bonus.effect.learn)) v += 3;
      if (ef.buff) v += 1.5;
      if (ef.item) v += 0.8;
      if (ef.fill) {
        // A bridge is worth an action once the party is split and one side is struggling.
        const allies = b.living().filter((w) => w.team === 0 && w !== u);
        const df = b.distanceField(u, [{ x: u.x, y: u.y }]);
        const cut = allies.filter((w) => !df.has(key(w.x, w.y)));
        const near = allies.length - cut.length;
        if (cut.length && (near === 0 || cut.some((w) => w.hp < w.maxHp * 0.5) || cut.length === allies.length)) v += 1.2;
      }
      if (ef.damage) {
        const t = b.unitById(ef.damage.unit);
        if (t && t.alive) v += 1.2;
      }
      if (ef.revive) {
        const down = b.units.filter((w) => w.team === 0 && w.hero && w.ko && !w.alive).length;
        v += down ? 2 + down : 0;
      }
      if (ef.heal) {
        const hurt = b.living().filter((w) => w.team === 0 && Math.abs(w.x - s.x) + Math.abs(w.y - s.y) <= (ef.heal.radius || 0) + 2);
        const need = hurt.reduce((a, w) => a + (ef.heal.hp ? Math.max(0, 0.7 - w.hp / w.maxHp) : 0) + (ef.heal.mp && w.maxMp < 999 ? Math.max(0, 0.5 - w.mp / w.maxMp) : 0), 0);
        v += need * 2;
      }
      if (ef.blast) {
        const c = { x: s.x, y: s.y };
        let n = 0;
        for (const w of b.living()) {
          const dx = Math.abs(w.x - c.x), dy = Math.abs(w.y - c.y);
          const inside = ef.blast.shape === 'radius' ? dx + dy <= ef.blast.r : Math.max(dx, dy) <= ef.blast.r;
          if (!inside || w === u) continue;
          n += w.team === 1 ? 1 : w.team === 0 ? -1.5 : 0;
        }
        v += n >= 1 ? n * 0.8 : -1;
      }
      if (ef.roll) {
        let n = 0;
        for (let i = 1; i <= ef.roll.len; i++) {
          const w = b.unitAt(s.x + ef.roll.dir[0] * i, s.y + ef.roll.dir[1] * i);
          if (w) n += w.team === 1 ? 1 : w.team === 0 ? -1.5 : 0;
        }
        v += n >= 1 ? n * 0.8 : -1;
      }
      // ?interact=all (test runs): visit every spot at least once.
      if (CT.AI_INTERACT_ALL) v = Math.max(v, 1);
      return v;
    },
    aiPlan(ctl, u) {
      const b = ctl.b;
      if (!b.spots || !u.hero || u.team !== 0) return null;
      const reach = b.moved ? new Map([[key(u.x, u.y), { x: u.x, y: u.y, d: 0, prev: null }]]) : b.reachable(u);
      let best = null;
      for (const s of b.spots) {
        if (s.spent || s.gone || s.mode === 'tech' || !Interact.allowed(s, u)) continue;
        const val = Interact.aiValue(b, s, u);
        if (val <= 0.5) continue;
        let node = null;
        for (const n of reach.values()) if ((s.mode === 'step' ? n.x === s.x && n.y === s.y : Interact.inReach(s, n.x, n.y)) && (!node || n.d < node.d)) node = n;
        if (node && (!best || val > best.val)) best = { spot: s, dest: node, val };
      }
      if (best || b.moved) return best;
      // Nothing in reach: a hero still walks toward a tech it could learn (multi-turn detour).
      for (const s of b.spots) {
        if (s.spent || s.gone || !Interact.allowed(s, u)) continue;
        const learn = (s.effect && s.effect.learn) || (s.bonus && s.bonus.who === u.id && s.bonus.effect && s.bonus.effect.learn);
        if (!learn || u.techs.includes(learn)) continue;
        const goal = s.mode === 'step' ? [{ x: s.x, y: s.y }] : CT.DIRS.map(([dx, dy]) => ({ x: s.x + dx, y: s.y + dy })).filter((p) => b.tile(p.x, p.y));
        const df = b.distanceField(u, goal);
        let node = null, dd = 99;
        for (const n of reach.values()) {
          const d = df.get(key(n.x, n.y)) ?? 99;
          if (d < dd || (d === dd && node && n.d < node.d)) (node = n), (dd = d);
        }
        if (node && dd < 99) return { spot: s, dest: node, val: 2, approach: true };
      }
      return null;
    },

    // ---- Drawing (called from Renderer.drawTile) --------------------------------------------
    // layer 'base': pulsing diamond + light pool on the tile; 'icon': the floating icon (after decor).
    drawMarker(R, ctx, s, sx, sy, now, lights, layer) {
      if (s.gone) return;
      const PXD = CT.PXD;
      if (s.trail) {
        // Boulder path: a chevron per tile pointing the way it will roll.
        if (layer !== 'base') return;
        const t = R.map && R.map.tiles[s.y] && R.map.tiles[s.y][s.x];
        const h = t ? R.tileHeight(t) : 0;
        const a = R.project(s.x, s.y, h), b2 = R.project(s.x + s.dir[0], s.y + s.dir[1], h);
        let vx = b2[0] - a[0], vy = b2[1] - a[1];
        const L = Math.hypot(vx, vy) || 1;
        vx /= L;
        vy /= L;
        const on = Math.floor(now / 140 - s.i) % 4 === 0;
        ctx.fillStyle = on ? '#fff0c0' : 'rgba(230,190,130,0.85)';
        for (let k = -3; k <= 3; k++) {
          const w = 3 - Math.abs(k);
          ctx.fillRect(Math.round(sx + vx * (2 - w * 1.4) - vy * k * 1.6), Math.round(sy + vy * (2 - w * 1.4) + vx * k * 1.6), 2, 1);
        }
        return;
      }
      const k = KIND[s.kind] || KIND.chest;
      const ph = (now / 600 + (s.x * 7 + s.y * 3) * 0.37) % (Math.PI * 2);
      const pulse = 0.5 + 0.5 * Math.sin(ph * 2);
      if (layer === 'base') {
        if (s.spent) {
          if (s.kind === 'lever' || s.kind === 'placard') return;
          ctx.fillStyle = 'rgba(120,120,140,0.35)';
          PXD.diamond(ctx, sx, sy, 8, true);
          return;
        }
        const [cr, cg, cb] = k.color.split(',').map(Number);
        const hi = `rgb(${Math.min(255, cr + 60)},${Math.min(255, cg + 60)},${Math.min(255, cb + 60)})`;
        ctx.fillStyle = `rgba(${k.color},${0.3 + 0.2 * pulse})`;
        PXD.diamond(ctx, sx, sy, 15, true);
        ctx.fillStyle = Math.floor(now / 260) % 2 ? hi : `rgb(${k.color})`;
        PXD.diamond(ctx, sx, sy, 15, false);
        PXD.diamond(ctx, sx, sy, 13, false);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        PXD.diamond(ctx, sx, sy, Math.round(4 + 9 * ((now / 1000 + s.x * 0.3) % 1)), false);
        // A shimmering shaft of light so the spot reads from across the map.
        for (let y = 0; y < 22; y++) {
          const a = (1 - y / 22) * (0.35 + 0.25 * pulse);
          ctx.fillStyle = `rgba(${k.color},${a.toFixed(2)})`;
          ctx.fillRect(sx - 2, sy - y, 5, 1);
          if ((y + Math.floor(now / 90)) % 7 === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx + ((y * 5) % 9) - 4, sy - y - 2, 1, 1);
          }
        }
        if (lights) lights.push({ x: sx, y: sy - 6, color: k.color, radius: 30 + 6 * pulse, flicker: false });
        return;
      }
      if (s.spent && s.kind !== 'lever') return;
      const rows = s.spent ? ICONS.lever : ICONS[k.icon] || ICONS.chest;
      const w = rows[0].length;
      const lift = s.decorRef && !s.decorRef.hidden ? 30 : s.kind === 'placard' ? 26 : 18;
      const bob = s.spent ? 0 : Math.round(Math.sin(now / 280 + s.x) * 1.5);
      const x0 = Math.round(sx - w / 2);
      const y0 = Math.round(sy - lift - rows.length + bob);
      // Dark outline then the icon.
      ctx.fillStyle = 'rgba(16,8,24,0.85)';
      rows.forEach((row, j) => [...row].forEach((c, i) => {
        if (c !== '.') ctx.fillRect(x0 + i - 1, y0 + j - 1, 3, 3);
      }));
      rows.forEach((row, j) => [...row].forEach((c, i) => {
        if (c === '.') return;
        ctx.fillStyle = IC[c] || '#ffffff';
        ctx.fillRect(x0 + (s.spent ? w - 1 - i : i), y0 + j, 1, 1);
      }));
      if (!s.spent && s.who) {
        // Character-specific spots get a tiny star.
        ctx.fillStyle = Math.floor(now / 200) % 2 ? '#fce068' : '#ffffff';
        ctx.fillRect(x0 + w + 1, y0, 1, 3);
        ctx.fillRect(x0 + w, y0 + 1, 3, 1);
      }
    },
  };

  // Floating icons for every spot, drawn after the colour grading.
  Interact.drawIcons = function (R, ctx, spotAt, now) {
    for (const s of spotAt.values()) {
      if (s.trail || s.gone) continue;
      const t = R.map && R.map.tiles[s.y] && R.map.tiles[s.y][s.x];
      if (!t) continue;
      const [sx, sy] = R.project(s.x, s.y, R.tileHeight(t));
      Interact.drawMarker(R, ctx, s, Math.round(sx), Math.round(sy), now, null, 'icon');
    }
  };

  // Shows the interactive-tile primer the first time a battle has spots.
  Interact.intro = async function (ctl) {
    const b = ctl.b;
    const g = ctl.game;
    if (!b.spots || !b.spots.some((s) => s.mode !== 'tech') || (g && g.flags.ia_intro)) return;
    if (g) g.flags.ia_intro = true;
    await CT.UI.popup('<b>Glowing tiles are interactive.</b><br>Hover one to see what it does and who can use it. Some trigger when a hero steps on them; others are used with the <b>Interact</b> command from on or beside them. A ★ marks a spot only one hero can use.');
  };

  CT.AI_INTERACT = CT.AI_INTERACT || /[?&]interact\b/.test(location.search);
  CT.AI_INTERACT_ALL = /[?&]interact=all\b/.test(location.search);
  CT.Interact = Interact;
})();
