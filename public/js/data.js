// Game data: characters & growth, techs (incl. dual/triple), enemy types,
// items, equipment and shops. Numbers follow docs/SCRIPT.md §2–3.
(function () {
  const CT = (window.CT = window.CT || {});

  // ---- Playable characters -------------------------------------------------------
  // base = Lv1 stats; growth = gain per level (fractional, rounded at use).
  CT.HEROES = {
    crono: {
      name: 'Crono', weapon: 'Katana', elem: 'lightning',
      base: { hp: 120, mp: 20, atk: 12, def: 8, mag: 8, mdef: 7, spd: 9, move: 4, jump: 2 },
      growth: { hp: 17.6, mp: 2.2, atk: 1.35, def: 0.9, mag: 0.85, mdef: 0.75, spd: 0.12 },
      techs: [['cyclone', 1], ['slash', 3], ['lightning', 5], ['spincut', 9], ['lightning2', 13], ['luminaire', 18]],
      affinity: { lightning: 0.5 },
    },
    frog: {
      name: 'Frog', weapon: 'Masamune', elem: 'water',
      base: { hp: 140, mp: 22, atk: 11, def: 11, mag: 9, mdef: 9, spd: 7, move: 3, jump: 2 },
      growth: { hp: 18.9, mp: 2.2, atk: 1.2, def: 1.1, mag: 0.95, mdef: 0.9, spd: 0.1 },
      techs: [['slurp', 1], ['slurp_cut', 2], ['water', 5], ['heal', 8], ['leap_slash', 11], ['frog_squash', 16]],
      affinity: { water: 0.5 }, swim: true,
    },
    ayla: {
      name: 'Ayla', weapon: 'Fists', elem: 'none',
      base: { hp: 150, mp: 12, atk: 15, def: 9, mag: 5, mdef: 5, spd: 8, move: 5, jump: 3 },
      growth: { hp: 20.2, mp: 1.4, atk: 1.55, def: 0.95, mag: 0.4, mdef: 0.55, spd: 0.12 },
      techs: [['kiss', 1], ['rollo_kick', 3], ['cat_attack', 6], ['tail_spin', 9], ['charm', 12], ['triple_kick', 17]],
    },
    magus: {
      name: 'Magus', weapon: 'Scythe', elem: 'shadow',
      base: { hp: 100, mp: 40, atk: 9, def: 6, mag: 16, mdef: 12, spd: 8, move: 4, jump: 2 },
      growth: { hp: 13.5, mp: 3.4, atk: 0.8, def: 0.6, mag: 1.55, mdef: 1.1, spd: 0.12 },
      techs: [['m_lightning2', 1], ['ice2', 1], ['fire2', 1], ['dark_bomb', 4], ['dark_mist', 8], ['black_hole', 14], ['dark_matter', 20]],
      affinity: { shadow: 0.5 }, float: true,
    },
  };

  // Guest heroes for the Skirmish extra mode (PixelLab divers).
  CT.HEROES.dave = {
    name: 'Dave', weapon: 'Harpoon Gun', elem: 'water', extra: true, swim: true, range: [1, 3],
    base: { hp: 110, mp: 16, atk: 11, def: 8, mag: 7, mdef: 7, spd: 8, move: 4, jump: 2 },
    growth: { hp: 16.2, mp: 1.6, atk: 1.2, def: 0.9, mag: 0.6, mdef: 0.7, spd: 0.1 },
    techs: [['spear_gun', 1], ['sushi', 1]],
  };
  CT.HEROES.mat = {
    name: 'Mat', weapon: 'Harpoon', elem: 'water', extra: true, swim: true, range: [1, 3],
    base: { hp: 105, mp: 22, atk: 10, def: 7, mag: 11, mdef: 9, spd: 9, move: 4, jump: 2 },
    growth: { hp: 14.9, mp: 2.2, atk: 1.0, def: 0.8, mag: 1.1, mdef: 0.9, spd: 0.1 },
    techs: [['bubble_jet', 1], ['depth_charge', 1]],
  };

  // XP needed to go from level L to L+1.
  CT.xpToNext = (L) => Math.round(10 * Math.pow(L, 1.5));
  // Intended party level per story battle (§3.9); enemies scale to it.
  CT.BATTLE_LEVEL = { B0: 1, B1: 5, B2: 9, B3: 14, B4A: 20, B4B: 22, B5: 23 };
  // Per-battle difficulty knobs, tuned with batch simulations (tools/balance).
  CT.BATTLE_TUNE = {
    B0: { atk: 0.75 },
    B1: { atk: 0.72, def: 0.55, hp: 0.9 },
    B4A: { hp: 1.6, atk: 0.75 },
    B2: { atk: 0.82 },
    B5: { atk: 0.8, hp: 0.85 },
    B4B: { atk: 1.7, hp: 1.6 },
  };
  CT.LEVEL_CAP = 30;

  // ---- Techs ------------------------------------------------------------------------
  // shape: single | square (Chebyshev r) | radius (Manhattan r) | ring (around caster)
  //        | line (from caster toward target, length r) | cross (arms r) | cone
  //        | aura (all targets within r of caster) | map (every enemy)
  // kind: phys | mag | heal | status | special. target: enemy | ally | self | any.
  // stat: which attacker stat powers it ('atk', 'mag', 'atkmag' = ATK+MAG).
  const T = (o) => ({ shape: 'single', r: 0, range: [1, 1], target: 'enemy', kind: 'phys', stat: 'atk', mult: 1, elem: 'none', ...o });
  CT.TECHS = {
    // Crono
    cyclone: T({ name: 'Cyclone', mp: 4, range: [0, 0], shape: 'ring', target: 'enemy', mult: 1.0, vfx: 'slash', sfx: 'sfx_spin', desc: 'Strikes every adjacent tile (8-tile ring).' }),
    slash: T({ name: 'Slash', mp: 3, mult: 1.3, elem: 'lightning', vfx: 'lightning', sfx: 'sfx_sword_hit', desc: 'A lightning-tinted cut. ATK×1.3.' }),
    lightning: T({ name: 'Lightning', mp: 5, range: [1, 3], kind: 'mag', stat: 'mag', mult: 1.6, elem: 'lightning', vfx: 'lightning', sfx: 'sfx_lightning', desc: 'Calls lightning on one foe.' }),
    spincut: T({ name: 'Spincut', mp: 7, mult: 1.8, vfx: 'slash', sfx: 'sfx_spin', desc: 'A leaping spin cut. ATK×1.8.' }),
    lightning2: T({ name: 'Lightning 2', mp: 10, range: [1, 4], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.6, elem: 'lightning', vfx: 'lightning', sfx: 'sfx_thunder_big', desc: '3×3 storm of lightning.' }),
    luminaire: T({ name: 'Luminaire', mp: 20, range: [0, 0], shape: 'square', r: 2, stat: 'atkmag', mult: 1.1, elem: 'lightning', vfx: 'lightning', big: 'luminaire', sfx: 'sfx_thunder_big', desc: '5×5 burst of holy light around Crono.' }),
    // Frog
    slurp: T({ name: 'Slurp', mp: 2, range: [0, 3], kind: 'heal', stat: 'mag', mult: 1.2, target: 'ally', vfx: 'heal', sfx: 'sfx_tongue', desc: 'Heals one ally.' }),
    slurp_cut: T({ name: 'Slurp Cut', mp: 3, range: [1, 2], mult: 1.3, vfx: 'slash', sfx: 'sfx_tongue', desc: 'Tongue-reach strike, range 2.' }),
    water: T({ name: 'Water', mp: 4, range: [1, 3], kind: 'mag', stat: 'mag', mult: 1.6, elem: 'water', vfx: 'water', sfx: 'sfx_water_splash', desc: 'Water magic on one foe.' }),
    heal: T({ name: 'Heal', mp: 6, range: [0, 0], shape: 'aura', r: 2, kind: 'heal', stat: 'mag', mult: 1.0, target: 'ally', vfx: 'heal', sfx: 'sfx_heal_chime', desc: 'Heals all allies within 2 tiles.' }),
    leap_slash: T({ name: 'Leap Slash', mp: 8, range: [1, 4], mult: 1.7, special: 'leap', vfx: 'slash', sfx: 'sfx_sword_swing', desc: 'Leaps beside a foe (ignoring terrain) and strikes. ATK×1.7.' }),
    frog_squash: T({ name: 'Frog Squash', mp: 12, range: [1, 3], shape: 'square', r: 1, mult: 1.0, special: 'squash', elem: 'water', vfx: 'water', sfx: 'sfx_water_splash', desc: '3×3 crush; stronger the more HP Frog has lost.' }),
    // Ayla
    kiss: T({ name: 'Kiss', mp: 2, range: [0, 1], kind: 'heal', stat: 'atk', mult: 0.9, target: 'ally', vfx: 'charm', sfx: 'sfx_heal_chime', desc: 'Heals an adjacent ally (or herself).' }),
    rollo_kick: T({ name: 'Rollo Kick', mp: 3, mult: 1.2, special: 'knockback', vfx: 'hit', sfx: 'sfx_kick', desc: 'Kicks a foe back 1 tile. Push them off ledges!' }),
    cat_attack: T({ name: 'Cat Attack', mp: 4, range: [1, 3], mult: 1.4, special: 'dash', vfx: 'slash', sfx: 'sfx_kick', desc: 'Dashes up to 2 extra tiles, then strikes. ATK×1.4.' }),
    tail_spin: T({ name: 'Tail Spin', mp: 6, range: [0, 0], shape: 'ring', mult: 1.1, status: ['stun', 0.35, 1], vfx: 'hit', sfx: 'sfx_spin', desc: '8-tile ring; may Stun.' }),
    charm: T({ name: 'Charm', mp: 5, kind: 'special', special: 'steal', vfx: 'charm', sfx: 'sfx_item_get', desc: 'Steals the foe\'s held item.' }),
    triple_kick: T({ name: 'Triple Kick', mp: 10, mult: 0.8, hits: 3, vfx: 'hit', sfx: 'sfx_kick', desc: 'Three kicks, ATK×0.8 each.' }),
    // Magus
    m_lightning2: T({ name: 'Lightning 2', mp: 8, range: [1, 4], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.3, elem: 'lightning', vfx: 'lightning', sfx: 'sfx_thunder_big', desc: '3×3 lightning.' }),
    ice2: T({ name: 'Ice 2', mp: 8, range: [1, 4], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.3, elem: 'ice', status: ['slow', 0.35, 3], vfx: 'ice', sfx: 'sfx_ice_crack', desc: '3×3 ice; may Slow.' }),
    fire2: T({ name: 'Fire 2', mp: 8, range: [1, 4], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.3, elem: 'fire', status: ['burn', 0.35, 3], vfx: 'fire', sfx: 'sfx_fire', desc: '3×3 fire; may Burn.' }),
    dark_bomb: T({ name: 'Dark Bomb', mp: 10, range: [1, 5], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.6, elem: 'shadow', vfx: 'shadow', sfx: 'sfx_dark_bomb', desc: '3×3 shadow blast, range 5.' }),
    dark_mist: T({ name: 'Dark Mist', mp: 12, range: [0, 0], shape: 'aura', r: 3, kind: 'mag', stat: 'mag', mult: 1.2, elem: 'shadow', status: ['magdown', 1, 2], vfx: 'shadow', sfx: 'sfx_dark_mist', desc: 'All foes within 3 tiles; halves their MAG for 2 turns.' }),
    black_hole: T({ name: 'Black Hole', mp: 16, range: [1, 4], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.5, elem: 'shadow', special: 'blackhole', vfx: 'shadow', big: 'blackhole', sfx: 'sfx_black_hole', desc: '3×3; erases weakened (<30% HP) non-bosses.' }),
    dark_matter: T({ name: 'Dark Matter', mp: 24, range: [1, 6], shape: 'cross', r: 5, kind: 'mag', stat: 'mag', mult: 2.1, elem: 'shadow', vfx: 'shadow', big: 'darkmatter', sfx: 'sfx_black_hole', desc: 'Cross-shaped annihilation, 5 tiles each arm.' }),
    // Dual & triple techs (listed in the initiator's menu). `members` = [initiator, partners...].
    x_strike: T({ name: 'X-Strike', dual: ['crono', 'frog'], mp: 6, mult: 1.25, stat: 'pair_atk', unlock: true, vfx: 'slash', sfx: 'sfx_sword_hit', desc: 'Crono & Frog cross blades. Combined ATK×2.5.' }),
    sword_stream: T({ name: 'Sword Stream', dual: ['crono', 'frog'], mp: 5, lv: 5, range: [1, 1], shape: 'line', r: 4, kind: 'mag', stat: 'pair_mag', mult: 1.0, elem: 'water', vfx: 'water', sfx: 'sfx_water_splash', desc: 'A 4-tile line of water and lightning.' }),
    drop_kick: T({ name: 'Drop Kick', dual: ['crono', 'ayla'], mp: 5, range: [1, 2], stat: 'pair_atk', mult: 1.1, elem: 'lightning', vfx: 'lightning', sfx: 'sfx_kick', desc: 'Crono launches Ayla into a lightning kick.' }),
    slurp_kiss: T({ name: 'Slurp Kiss', dual: ['frog', 'ayla'], mp: 5, range: [0, 0], shape: 'aura', r: 2, kind: 'heal', stat: 'pair_mag', mult: 1.3, target: 'ally', vfx: 'heal', sfx: 'sfx_heal_chime', desc: 'Big heal for all allies within 2 tiles.' }),
    beast_toss: T({ name: 'Beast Toss', dual: ['ayla', 'magus'], mp: 8, lv: 10, range: [1, 5], shape: 'square', r: 1, kind: 'mag', stat: 'pair_both', mult: 1.2, elem: 'shadow', vfx: 'shadow', sfx: 'sfx_dark_bomb', desc: 'Ayla hurls Magus\'s Dark Bomb. 3×3, range 5.' }),
    shadow_cyclone: T({ name: 'Shadow Cyclone', dual: ['crono', 'magus'], mp: 8, unlock: true, range: [0, 0], shape: 'square', r: 2, stat: 'pair_both', mult: 0.95, elem: 'shadow', vfx: 'shadow', sfx: 'sfx_spin', desc: 'Cyclone infused with shadow — ring plus one tile.' }),
    ice_water: T({ name: 'Ice Water', dual: ['frog', 'magus'], mp: 7, unlock: true, range: [1, 1], shape: 'line', r: 3, kind: 'mag', stat: 'pair_mag', mult: 1.1, elem: 'ice', status: ['slow', 1, 3], vfx: 'ice', sfx: 'sfx_ice_crack', desc: 'Freezes a 3-tile line; Slows all caught.' }),
    eclipse_blade: T({ name: 'Eclipse Blade', dual: ['crono', 'frog', 'magus'], mp: 15, unlock: true, range: [0, 0], shape: 'map', stat: 'triple', mult: 1.2, elem: 'shadow', vfx: 'shadow', big: 'eclipse', sfx: 'sfx_black_hole', desc: 'Magus opens a rift; Crono & Frog strike through it. Hits every foe.' }),

    // Skirmish guests
    spear_gun: T({ name: 'Spear Gun', mp: 3, range: [2, 5], mult: 1.3, vfx: 'slash', sfx: 'sfx_sword_swing', desc: 'Long-range harpoon shot.' }),
    sushi: T({ name: 'Sushi', mp: 3, range: [0, 1], kind: 'heal', stat: 'atk', mult: 1.1, target: 'ally', vfx: 'heal', sfx: 'sfx_heal_chime', desc: 'Fresh from the bar. Heals an adjacent ally.' }),
    bubble_jet: T({ name: 'Bubble Jet', mp: 5, range: [2, 4], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.2, elem: 'water', vfx: 'water', sfx: 'sfx_water_splash', desc: '3×3 burst of bubbles.' }),
    depth_charge: T({ name: 'Depth Charge', mp: 8, range: [1, 3], shape: 'square', r: 1, mult: 0.9, elem: 'fire', vfx: 'fire', sfx: 'sfx_dark_bomb', desc: '3×3 explosive charge.' }),
    dark_staff: T({ name: 'Dark Staff', mp: 0, range: [1, 3], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.3, elem: 'shadow', vfx: 'shadow', sfx: 'sfx_dark_bomb' }),

    // ---- Enemy techs ----
    claw: T({ name: 'Claw', mp: 0, mult: 1.0, vfx: 'hit', sfx: 'sfx_sword_hit' }),
    imp_jab: T({ name: 'Echo Jab', mp: 0, range: [1, 2], mult: 1.1, vfx: 'hit', sfx: 'sfx_kick' }),
    hench_axe: T({ name: 'Hollow Axe', mp: 0, mult: 1.3, vfx: 'slash', sfx: 'sfx_sword_hit' }),
    re_file: T({ name: 'Re-file', mp: 0, range: [0, 3], kind: 'heal', stat: 'mag', mult: 0.8, target: 'ally', vfx: 'heal', sfx: 'sfx_heal_chime', desc: 'Restores an archived ally.' }),
    rock_toss: T({ name: 'Rock Toss', mp: 0, range: [2, 3], mult: 0.9, vfx: 'hit', sfx: 'sfx_kick' }),
    roll: T({ name: 'Roll', mp: 0, range: [1, 1], mult: 1.3, vfx: 'hit', sfx: 'sfx_kick' }),
    fire_breath: T({ name: 'Fire Breath', mp: 0, range: [1, 1], shape: 'cone', r: 3, kind: 'mag', stat: 'mag', mult: 1.5, elem: 'fire', status: ['burn', 0.4, 3], vfx: 'fire', sfx: 'sfx_fire' }),
    porcelain_strike: T({ name: 'Porcelain Strike', mp: 0, mult: 1.1, vfx: 'porcelain', sfx: 'sfx_glass_shatter' }),
    destruction_rain: T({ name: 'Destruction Rain', mp: 0, range: [1, 4], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.2, elem: 'shadow', vfx: 'lavos', special: 'rain', sfx: 'sfx_seed_hatch' }),
    destruction_rain_l: T({ name: 'Destruction Rain', mp: 0, range: [1, 5], shape: 'square', r: 2, kind: 'mag', stat: 'mag', mult: 1.1, elem: 'shadow', vfx: 'lavos', special: 'rain', sfx: 'sfx_seed_hatch' }),
    glass_bash: T({ name: 'Glass Bash', mp: 0, mult: 1.4, vfx: 'glass', sfx: 'sfx_glass_shatter' }),
    ledger_strike: T({ name: 'Ledger Strike', mp: 0, range: [1, 1], shape: 'line', r: 2, mult: 1.3, vfx: 'porcelain', sfx: 'sfx_sword_swing' }),
    preserve: T({ name: 'Preserve', mp: 0, range: [0, 3], kind: 'status', target: 'ally', status: ['stasis', 1, 1], vfx: 'glass', sfx: 'sfx_ice_crack' }),
    catalogue: T({ name: 'Catalogue', mp: 0, range: [1, 3], kind: 'status', status: ['catalogued', 1, 2], vfx: 'porcelain', sfx: 'sfx_scanline' }),
    sever: T({ name: 'Sever', mp: 0, range: [1, 2], mult: 1.4, special: 'dispel', vfx: 'porcelain', sfx: 'sfx_glass_shatter' }),
    rearrange: T({ name: 'Rearrange', mp: 0, range: [1, 12], kind: 'special', special: 'rearrange', vfx: 'porcelain', sfx: 'sfx_scanline' }),
    catalogue_all: T({ name: 'Catalogue All', mp: 0, range: [1, 6], shape: 'square', r: 1, kind: 'status', status: ['catalogued', 1, 2], vfx: 'porcelain', sfx: 'sfx_scanline' }),
    deaccession: T({ name: 'Deaccession', mp: 0, range: [1, 8], kind: 'mag', stat: 'mag', mult: 2.4, elem: 'shadow', special: 'needs_catalogued', vfx: 'shadow', sfx: 'sfx_dark_bomb' }),
    reconstruct: T({ name: 'Reconstruct', mp: 0, range: [0, 0], kind: 'special', special: 'reconstruct', vfx: 'glass', sfx: 'sfx_glass_shatter' }),
    core_rain: T({ name: 'Destruction Rain', mp: 0, range: [0, 0], kind: 'special', special: 'core_rain', vfx: 'lavos', sfx: 'sfx_seed_hatch' }),
    consume: T({ name: 'Consume', mp: 0, mult: 2.2, special: 'drain', vfx: 'lavos', sfx: 'sfx_core_scream' }),
    erase_era: T({ name: 'Erase Era', mp: 0, range: [0, 0], kind: 'special', special: 'erase', vfx: 'porcelain', sfx: 'sfx_hollow_gate' }),
    spekkio_magic: T({ name: 'Spekkio\'s Lesson', mp: 0, range: [1, 4], shape: 'square', r: 1, kind: 'mag', stat: 'mag', mult: 1.2, elem: 'fire', vfx: 'fire', sfx: 'sfx_fire' }),
  };
  for (const [id, t] of Object.entries(CT.TECHS)) t.id = id;

  // ---- Enemy & guest types ---------------------------------------------------------
  // lvl-independent stats. affinity: element -> multiplier (0.5 resist, 1.5 weak, -1 absorb).
  const E = (o) => ({ mp: 0, move: 4, jump: 2, range: [1, 1], techs: [], xp: 10, gold: 10, affinity: {}, ...o });
  CT.ENEMIES = {
    echo_imp: E({ name: 'Echo Imp', sprite: 'echo_imp', hp: 40, atk: 9, def: 3, mag: 4, mdef: 3, spd: 8, move: 4, techs: ['imp_jab'], affinity: { lightning: 1.5 }, xp: 18, gold: 12, flicker: true, steal: 'tonic' }),
    echo_hench: E({ name: 'Echo Hench', sprite: 'echo_hench', hp: 90, atk: 12, def: 6, mag: 5, mdef: 4, spd: 6, move: 3, techs: ['hench_axe'], affinity: { water: 1.5 }, xp: 30, gold: 20, flicker: true, steal: 'tonic' }),
    echo_nu: E({ name: 'Echo Nu', sprite: 'echo_nu', hp: 200, atk: 14, def: 16, mag: 20, mdef: 14, spd: 7, move: 3, techs: ['re_file'], ai: 'healer', xp: 80, gold: 60, flicker: true, steal: 'ether' }),
    echo_kilwala: E({ name: 'Echo Kilwala', sprite: 'echo_kilwala', hp: 60, atk: 14, def: 6, mag: 6, mdef: 5, spd: 12, move: 5, jump: 3, techs: ['rock_toss'], affinity: { fire: 1.5 }, xp: 30, gold: 18, flicker: true, steal: 'tonic' }),
    echo_roundillo: E({ name: 'Echo Roundillo', sprite: 'echo_roundillo', hp: 130, atk: 24, def: 14, mag: 8, mdef: 8, spd: 10, move: 5, jump: 9, techs: ['roll'], affinity: { ice: 1.5 }, xp: 60, gold: 40, flicker: true, steal: 'mid_tonic' }),
    echo_tyrano: E({ name: 'Echo Tyrano', sprite: 'echo_tyrano', hp: 900, atk: 46, def: 22, mag: 38, mdef: 16, spd: 8, move: 3, jump: 2, techs: ['fire_breath'], affinity: { ice: 1.5, fire: 0.5 }, xp: 600, gold: 400, big: true, boss: true, flicker: true }),
    seedbearer: E({ name: 'Seedbearer', sprite: 'seedbearer', hp: 120, atk: 15, def: 8, mag: 10, mdef: 10, spd: 8, move: 3, techs: ['porcelain_strike'], affinity: { lightning: 1.5, shadow: 0.5 }, xp: 45, gold: 30, steal: 'ether' }),
    lavos_sprout: E({ name: 'Lavos Sprout', sprite: 'lavos_sprout', hp: 300, atk: 16, def: 12, mag: 22, mdef: 12, spd: 7, move: 0, jump: 0, techs: ['destruction_rain'], ai: 'sprout', affinity: { shadow: 0.5, ice: 1.5 }, xp: 150, gold: 80 }),
    lavos_sprout_large: E({ name: 'Lavos Sprout', sprite: 'lavos_sprout_large', hp: 600, atk: 26, def: 16, mag: 30, mdef: 16, spd: 8, move: 0, jump: 0, techs: ['destruction_rain_l'], ai: 'sprout', affinity: { shadow: 0.5, ice: 1.5 }, xp: 320, gold: 160, big: true }),
    vitrine_sentinel: E({ name: 'Vitrine Sentinel', sprite: 'vitrine', hp: 250, atk: 30, def: 30, mag: 10, mdef: 12, spd: 5, move: 2, jump: 1, techs: ['glass_bash'], ai: 'sentinel', shatter: 200, xp: 120, gold: 70, steal: 'mid_tonic' }),
    iselle: E({ name: 'Iselle', sprite: 'iselle', hp: 400, atk: 20, def: 14, mag: 18, mdef: 12, spd: 10, move: 4, jump: 3, range: [1, 2], techs: ['ledger_strike', 'catalogue', 'preserve'], xp: 200, gold: 150, boss: true, steal: 'ether' }),
    iselle_ally: E({ fixed: true, name: 'Iselle', sprite: 'iselle', hp: 420, atk: 36, def: 22, mag: 26, mdef: 20, spd: 11, move: 4, jump: 3, range: [1, 2], techs: ['ledger_strike', 'preserve', 'sever'], ai: 'protect', guest: true }),
    curator: E({ fixed: true, name: 'The Curator', sprite: 'curator_p1', hp: 2000, atk: 34, def: 20, mag: 40, mdef: 22, spd: 9, move: 0, jump: 0, range: [1, 1], techs: ['rearrange', 'catalogue_all', 'deaccession', 'reconstruct'], ai: 'curator', affinity: { shadow: 0.5 }, boss: true, big: true, xp: 0 }),
    curator_core: E({ fixed: true, name: 'The Core Exhibit', sprite: 'curator_p2', hp: 2500, atk: 52, def: 14, mag: 44, mdef: 30, spd: 12, move: 2, jump: 9, techs: ['core_rain', 'consume', 'erase_era'], ai: 'curator_core', affinity: { fire: 0.5, ice: 0.5, lightning: 0.5, water: 0.5, shadow: 0.5 }, boss: true, big: true, xp: 3000, gold: 2000 }),
    knight: E({ name: 'Mystic Knight', sprite: 'knight', hp: 260, atk: 30, def: 18, mag: 22, mdef: 14, spd: 9, move: 3, techs: ['dark_staff'], xp: 120, gold: 80, steal: 'ether' }),
    spekkio: E({ name: 'Spekkio', sprite: 'spekkio', hp: 500, atk: 18, def: 12, mag: 22, mdef: 16, spd: 10, move: 3, techs: ['spekkio_magic'], xp: 150, gold: 100, scales: true }),
  };
  // Level scaling for types without fixed story stats: stat * (1 + 0.09*(lv-1)).
  // HP grows fastest so higher-level fights stay tactical rather than lethal.
  CT.scaleEnemy = (base, lv) => {
    const L = lv - 1;
    const k = { hp: 1 + 0.12 * L, atk: 1 + 0.065 * L, mag: 1 + 0.065 * L, def: 1 + 0.07 * L, mdef: 1 + 0.07 * L };
    const out = { ...base };
    for (const s of Object.keys(k)) out[s] = Math.round(base[s] * k[s]);
    return out;
  };

  // ---- Items, equipment, shops -----------------------------------------------------
  CT.ITEMS = {
    tonic: { name: 'Tonic', price: 20, battle: true, heal: 50, desc: 'Restores 50 HP.' },
    mid_tonic: { name: 'Mid Tonic', price: 90, battle: true, heal: 150, desc: 'Restores 150 HP.' },
    ether: { name: 'Ether', price: 120, battle: true, mpHeal: 30, desc: 'Restores 30 MP.' },
    revive: { name: 'Revive', price: 200, battle: true, revive: 0.3, desc: 'Revives a fallen ally with 30% HP.' },
    shelter: { name: 'Shelter', price: 150, field: true, desc: 'Fully restores the party at a save point.' },
    magic_tab: { name: 'Magic Tab', price: 0, field: true, desc: 'Permanently raises a member\'s MAG by 1.' },
  };
  CT.KEY_ITEMS = {
    denadoro_seed: 'Denadoro Seed (inert)',
    tyrano_seed: 'Tyrano Seed (inert)',
    zeal_seed: 'Zeal Seed (inert)',
    corin_tablet: 'Corin\'s Tablet',
  };
  // Equipment auto-equips to its owner when bought if it's an upgrade.
  const EQ = (who, slot, name, stats, price) => ({ who, slot, name, stats, price });
  CT.EQUIPMENT = {
    // Tier 1 — Guardia
    steel_saber: EQ('crono', 'weapon', 'Steel Saber', { atk: 4 }, 180),
    iron_sword: EQ('frog', 'weapon', 'Masamune (whetted)', { atk: 3 }, 160),
    bronze_mail: EQ('all', 'armor', 'Bronze Mail', { def: 3 }, 150),
    iron_helm: EQ('all', 'helmet', 'Iron Helm', { def: 1, mdef: 1 }, 120),
    power_glove: EQ('crono', 'accessory', 'Power Glove', { atk: 2 }, 200),
    // Tier 2 — Ioka
    bone_guard: EQ('all', 'armor', 'Bone Guard', { def: 6 }, 420),
    fang_helm: EQ('all', 'helmet', 'Fang Helm', { def: 3, mdef: 2 }, 360),
    fist_2: EQ('ayla', 'weapon', 'Iron Fist', { atk: 6 }, 450),
    ruby_vest: EQ('ayla', 'accessory', 'Ruby Vest', { mdef: 4, def: 2 }, 400),
    doomsickle: EQ('magus', 'weapon', 'Hurricane Scythe', { atk: 4, mag: 3 }, 520),
    // Tier 3 — Last Village
    lumin_robe: EQ('all', 'armor', 'Lumin Robe', { def: 10, mdef: 6 }, 900),
    beret: EQ('all', 'helmet', 'Rock Helm', { def: 5, mdef: 4 }, 780),
    rainbow: EQ('crono', 'weapon', 'Rainbow', { atk: 14 }, 1600),
    brave_sword: EQ('frog', 'weapon', 'Brave Sword', { atk: 10 }, 1300),
    giants_hand: EQ('ayla', 'weapon', 'Giant\'s Hand', { atk: 12 }, 1400),
    dark_scythe: EQ('magus', 'weapon', 'Doom Sickle', { atk: 6, mag: 8 }, 1500),
    speed_belt: EQ('all', 'accessory', 'Speed Belt', { spd: 1 }, 1200),
  };
  CT.SHOPS = {
    guardia: { name: 'Guardia Armory', items: ['tonic', 'mid_tonic', 'ether', 'revive', 'shelter'], gear: ['steel_saber', 'iron_sword', 'bronze_mail', 'iron_helm', 'power_glove'] },
    ioka: { name: 'Ioka Trading Hut', items: ['tonic', 'mid_tonic', 'ether', 'revive', 'shelter'], gear: ['bone_guard', 'fang_helm', 'fist_2', 'ruby_vest', 'doomsickle'] },
    last_village: { name: 'Last Village Stores', items: ['tonic', 'mid_tonic', 'ether', 'revive', 'shelter'], gear: ['lumin_robe', 'beret', 'rainbow', 'brave_sword', 'giants_hand', 'dark_scythe', 'speed_belt'] },
    end_of_time: { name: 'Nu\'s Wares', items: ['tonic', 'mid_tonic', 'ether', 'revive', 'shelter'], gear: [] },
  };

  // Display names for dialogue speakers.
  CT.SPEAKERS = {
    crono: 'Crono', frog: 'Frog', ayla: 'Ayla', magus: 'Magus', marle: 'Marle', lucca: 'Lucca', robo: 'Robo',
    king: 'King Guardia', leene: 'Queen Leene', kino: 'Kino', elder: 'Elder', gaspar: 'Gaspar', spekkio: 'Spekkio',
    iselle: 'Iselle', curator: 'The Curator', nu: 'Nu', corin: 'Corin', narrator: '', guard: 'Guard',
    villager: 'Villager', fairgoer: 'Fairgoer',
  };

  // ---- Extra mode: the original Zenan skirmish ------------------------------------
  CT.SKIRMISH = {
    name: 'Zenan Skirmish', map: 'zenan', music: 'mus_battle', level: 12,
    partyOverride: ['crono', 'frog', 'ayla', 'magus', 'dave', 'mat'],
    party: { crono: [2, 5], frog: [3, 7], ayla: [3, 2], magus: [1, 3], dave: [3, 9], mat: [0, 4] },
    partyFace: 'E',
    units: [
      { type: 'iselle', at: [11, 1], hp: 520, face: 'W' },
      { type: 'knight', at: [10, 6], face: 'W' },
      { type: 'knight', at: [11, 4], face: 'W' },
      { type: 'seedbearer', at: [9, 5], face: 'W' },
      { type: 'echo_nu', at: [10, 0], face: 'W' },
      { type: 'echo_hench', at: [9, 8], face: 'W' },
      { type: 'echo_hench', at: [9, 2], face: 'W' },
      { type: 'echo_kilwala', at: [10, 3], face: 'W' },
    ],
    objective: { type: 'DEFEAT_ALL', text: 'Rout the Hollow\'s vanguard' },
  };

  // Facing: 0 = +x (east), 1 = +y (south), 2 = -x (west), 3 = -y (north).
  CT.DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  CT.FACE = { E: 0, S: 1, W: 2, N: 3 };
  CT.dirTo = (ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
    return dy >= 0 ? 1 : 3;
  };
})();
