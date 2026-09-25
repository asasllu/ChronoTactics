// Static game data: the battle map, characters and their techs.
(function () {
  const CT = (window.CT = window.CT || {});

  // Terrain: g grass, d dirt, s stone, w deep water, f shallow ford,
  // b wooden bridge, t tree (blocks), r rock (blocks).
  const TERRAIN = [
    'gggggwwwssss',
    'gtgggwwwssss',
    'ggggdwwwdsss',
    'ggdddwwwdrss',
    'ggdddbbbddss',
    'gggddbbbddss',
    'gtggdwwwddds',
    'ggrggwwwggts',
    'gggggwwwgggg',
    'tggggfffgggg',
    'ggggdwwwggtg',
    'gtggdwwwgggg',
  ];
  const HEIGHT = [
    '111220002334',
    '111120002334',
    '111110001233',
    '011110001223',
    '001111111122',
    '001111111122',
    '001110001112',
    '101110001111',
    '211110001111',
    '221110001111',
    '321110001112',
    '332110001122',
  ];

  CT.MAP = {
    name: 'Zenan Riverbank',
    size: 12,
    tiles: TERRAIN.map((row, y) =>
      [...row].map((t, x) => ({
        x,
        y,
        t,
        h: +HEIGHT[y][x],
      }))
    ),
  };

  CT.TERRAIN_INFO = {
    g: { name: 'Grass', walk: true },
    d: { name: 'Dirt', walk: true },
    s: { name: 'Stone', walk: true },
    b: { name: 'Bridge', walk: true },
    f: { name: 'Shallows', walk: true },
    w: { name: 'River', walk: false, swim: true },
    t: { name: 'Tree', walk: false },
    r: { name: 'Rock', walk: false },
  };

  // Tech fields:
  //   range [min,max] (Manhattan), aoe radius, kind 'dmg'|'heal',
  //   stat 'atk' (physical: facing & evasion matter) or 'mag',
  //   power multiplier, elem (drives the visual effect).
  CT.TECHS = {
    cyclone:   { name: 'Cyclone',     mp: 4, range: [0, 0], aoe: 1, kind: 'dmg',  stat: 'atk', power: 1.1, elem: 'slash' },
    lightning: { name: 'Lightning',   mp: 5, range: [2, 4], aoe: 0, kind: 'dmg',  stat: 'mag', power: 3.0, elem: 'bolt' },
    aura:      { name: 'Aura',        mp: 3, range: [0, 4], aoe: 0, kind: 'heal', stat: 'mag', power: 2.6, elem: 'heal' },
    ice:       { name: 'Ice',         mp: 5, range: [2, 4], aoe: 0, kind: 'dmg',  stat: 'mag', power: 2.8, elem: 'ice' },
    flametoss: { name: 'Flame Toss',  mp: 3, range: [1, 2], aoe: 1, kind: 'dmg',  stat: 'mag', power: 1.8, elem: 'fire' },
    fire:      { name: 'Fire',        mp: 6, range: [2, 5], aoe: 1, kind: 'dmg',  stat: 'mag', power: 2.4, elem: 'fire' },
    slurp:     { name: 'Slurp',       mp: 2, range: [0, 1], aoe: 0, kind: 'heal', stat: 'mag', power: 2.6, elem: 'heal' },
    water:     { name: 'Water',       mp: 3, range: [2, 4], aoe: 0, kind: 'dmg',  stat: 'mag', power: 2.6, elem: 'water' },
    laserspin: { name: 'Laser Spin',  mp: 4, range: [0, 0], aoe: 2, kind: 'dmg',  stat: 'mag', power: 3.2, elem: 'laser' },
    curebeam:  { name: 'Cure Beam',   mp: 3, range: [1, 3], aoe: 0, kind: 'heal', stat: 'mag', power: 5.0, elem: 'heal' },
    kiss:      { name: 'Kiss',        mp: 2, range: [0, 1], aoe: 0, kind: 'heal', stat: 'mag', power: 6.0, elem: 'heal' },
    rollokick: { name: 'Rollo Kick',  mp: 2, range: [1, 2], aoe: 0, kind: 'dmg',  stat: 'atk', power: 1.3, elem: 'slash' },
    darkbomb:  { name: 'Dark Bomb',   mp: 10, range: [2, 5], aoe: 1, kind: 'dmg',  stat: 'mag', power: 1.8, elem: 'dark' },
    lightning2:{ name: 'Lightning 2', mp: 6, range: [2, 5], aoe: 0, kind: 'dmg',  stat: 'mag', power: 3.0, elem: 'bolt' },
    flame:     { name: 'Flame',       mp: 5, range: [1, 3], aoe: 1, kind: 'dmg',  stat: 'mag', power: 2.0, elem: 'fire' },
    slashwave: { name: 'Slash Wave',  mp: 4, range: [1, 3], aoe: 0, kind: 'dmg',  stat: 'atk', power: 1.2, elem: 'slash' },
    prism:     { name: 'Prism Beam',  mp: 5, range: [2, 4], aoe: 0, kind: 'dmg',  stat: 'mag', power: 2.6, elem: 'laser' },
    healwave:  { name: 'Heal Wave',   mp: 8, range: [0, 3], aoe: 1, kind: 'heal', stat: 'mag', power: 1.5, elem: 'heal' },
  };

  // Base attack: range [min,max]; 'proj' marks ranged shots.
  CT.CHARACTERS = {
    crono: { name: 'Crono', hp: 180, mp: 20, atk: 32, def: 14, mag: 12, mdef: 10, spd: 12, move: 4, jump: 2, range: [1, 1], weapon: 'Katana', techs: ['cyclone', 'lightning'] },
    marle: { name: 'Marle', hp: 140, mp: 30, atk: 22, def: 10, mag: 20, mdef: 18, spd: 11, move: 4, jump: 2, range: [1, 4], proj: 'bolt', weapon: 'Crossbow', techs: ['aura', 'ice'] },
    lucca: { name: 'Lucca', hp: 130, mp: 30, atk: 20, def: 10, mag: 22, mdef: 16, spd: 10, move: 4, jump: 2, range: [1, 3], proj: 'shot', weapon: 'Air Gun', techs: ['flametoss', 'fire'] },
    frog:  { name: 'Frog',  hp: 170, mp: 20, atk: 28, def: 16, mag: 14, mdef: 12, spd: 11, move: 4, jump: 3, range: [1, 1], weapon: 'Broadsword', swim: true, techs: ['slurp', 'water'] },
    robo:  { name: 'Robo',  hp: 230, mp: 15, atk: 32, def: 24, mag: 8,  mdef: 8,  spd: 8,  move: 3, jump: 1, range: [1, 1], weapon: 'Tin Arm', techs: ['laserspin', 'curebeam'] },
    ayla:  { name: 'Ayla',  hp: 175, mp: 12, atk: 36, def: 12, mag: 6,  mdef: 8,  spd: 13, move: 5, jump: 3, range: [1, 1], weapon: 'Fist', techs: ['rollokick', 'kiss'] },

    magus: { name: 'Magus', hp: 300, mp: 40, atk: 28, def: 18, mag: 24, mdef: 26, spd: 12, move: 4, jump: 3, range: [1, 1], weapon: 'Doomsickle', techs: ['darkbomb', 'lightning2'] },
    ozzie: { name: 'Ozzie', hp: 260, mp: 30, atk: 22, def: 24, mag: 20, mdef: 20, spd: 7,  move: 3, jump: 1, range: [1, 1], weapon: 'Belly', techs: ['flame'] },
    slash: { name: 'Slash', hp: 220, mp: 20, atk: 32, def: 16, mag: 10, mdef: 10, spd: 12, move: 4, jump: 3, range: [1, 1], weapon: 'Slasher', techs: ['slashwave'] },
    flea:  { name: 'Flea',  hp: 180, mp: 40, atk: 16, def: 10, mag: 24, mdef: 22, spd: 11, move: 4, jump: 2, range: [1, 1], weapon: 'Whip', techs: ['prism', 'healwave'] },
    hench: { name: 'Hench', hp: 100, mp: 0,  atk: 22, def: 12, mag: 6,  mdef: 8,  spd: 9,  move: 4, jump: 2, range: [1, 1], weapon: 'Axe', techs: [] },
  };

  // Facing: 0 = +x (east), 1 = +y (south), 2 = -x (west), 3 = -y (north).
  CT.ROSTER = [
    { key: 'crono', team: 0, x: 2, y: 5, face: 0 },
    { key: 'marle', team: 0, x: 0, y: 5, face: 0 },
    { key: 'lucca', team: 0, x: 1, y: 3, face: 0 },
    { key: 'frog',  team: 0, x: 3, y: 7, face: 0 },
    { key: 'robo',  team: 0, x: 2, y: 8, face: 0 },
    { key: 'ayla',  team: 0, x: 3, y: 2, face: 0 },

    { key: 'magus', team: 1, x: 11, y: 1, face: 2 },
    { key: 'ozzie', team: 1, x: 10, y: 3, face: 2 },
    { key: 'slash', team: 1, x: 9,  y: 5, face: 2 },
    { key: 'flea',  team: 1, x: 10, y: 0, face: 2 },
    { key: 'hench', team: 1, x: 9,  y: 8, face: 2 },
    { key: 'hench', team: 1, x: 9,  y: 2, face: 2 },
  ];
})();
