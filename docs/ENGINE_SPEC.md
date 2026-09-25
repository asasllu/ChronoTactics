# Chrono Tactics: The Hollow Future — Engine Spec

This is the contract between the engine and the content modules. The game
design, script and asset list live in `docs/SCRIPT.md` (the "bible"). Read
both before changing content.

Everything is plain browser JavaScript (no build step, no modules, no external
libraries). Files attach to a global `window.CT` namespace and load in the
order listed in `public/index.html`:

```
assets.js        generated PixelLab sprites (tools/build-assets.mjs)
pixel.js         CT.PX  — pixel-art toolkit (Grid, shadeGrid, echoify, canvas...)
sprites.js       CT.getSprite / CT.registerSprite, built-in cast art
sprites_cast.js  story cast sprites (enemies, NPCs, props)          [content]
portraits.js     CT.getPortrait(id, emotion)                         [content]
terrain.js       CT.TERRAIN, CT.DECOR, CT.prepareMap, CT.TX (noise)
terrain_ext.js   extra materials + decor for the story maps          [content]
maps.js          CT.MAPS — all maps                                  [content]
audio.js         CT.audio — synthesized chiptune music + SFX         [content]
data.js          characters, enemies, techs, items, shops, growth
story.js         CT.SCENES, CT.BATTLES, CT.CREDITS                   [content]
battle.js        tactics rules engine
render.js        isometric renderer
scene.js         cutscene runner, dialogue, field exploration
ui.js            menus, title, shop, save/load, HUD
main.js          boot + top-level state machine
```

The canvas is **960×600**, scaled to fit the window with `image-rendering:
pixelated`. Iso tiles are 64×32 with 16px per height level. Characters are
drawn **1:1** (no scaling). The reference character sprite is **48×48 with
the figure ~40px tall** (see `assets/characters/*/Idle/rotations/*.png`).

---

## 1. Pixel toolkit (`CT.PX`)

```js
const { Grid, shadeGrid, canvas, echoify, hex, mix } = CT.PX;
const g = new Grid(48, 48);           // letter grid, '.' = transparent
g.rect(x0,y0,x1,y1,'c'); g.ell(cx,cy,rx,ry,'c'); g.line(x0,y0,x1,y1,'c',w);
g.tri(ax,ay,bx,by,cx,cy,'c'); g.spike(baseX,baseY,tipX,tipY,width,'c');
g.px(x,y,'c'); g.text(ox,oy,['..ab..','.abba.']);   // text rows overlay
const cv = shadeGrid(g, { c:'#2f6fc0', ... }, 'eEm', true);
//  pal: letter -> colour. 'k' is always the dark outline colour.
//  detail letters (3rd arg) are drawn flat and don't split regions (eyes, strands).
//  hi=true: region gradients, 3 shade + 2 highlight bands, dark seams between
//  materials. ALWAYS use hi=true for 48px art. A 1px outline is added around
//  the silhouette automatically (canvas grows by 2px each way).
```

Lighting convention: light comes from the **top-left**. Put distinct materials
on distinct letters (even if same colour) so seams/shading separate them.

## 2. Sprites (`CT.registerSprite`)

```js
CT.registerSprite('iselle', () => ({ se: canvasFront, ne: canvasBack }));
```

* Return a canvas (front view only) or `{ se, ne }` (front 3/4 facing
  screen-right-down, back 3/4 facing screen-right-up). Left views are mirrored
  automatically. `{ se, sw, ne, nw }` is also accepted.
* Sprites are anchored by the bottom of their opaque bounding box (feet) and
  centred horizontally on the canvas centre.
* `echo_<key>` sprites are derived automatically (grey-blue + scanlines) —
  just register the base monster (`imp`, `hench`, `nu`, `kilwala`,
  `roundillo`, `tyrano`).

### Required sprite keys

| key | notes |
|---|---|
| `crono` `frog` `ayla` `magus` | exist (crono built-in, others PixelLab) |
| `iselle` | ~19yo, short white hair; left half of face + left arm porcelain with blue seams; long grey coat; glass halberd with glowing text blade. 48×48, se+ne |
| `iselle_broken` | kneeling/slumped variant, se only |
| `seedbearer` | porcelain automaton, humanoid, smooth white plates, blue seam glow, faceless head with slit; holds nothing (engine draws seed glow when carrying) |
| `lavos_sprout` | miniature Lavos spike-shell (dome shell covered in spikes, red-orange beak/mouth), 48×48 |
| `lavos_sprout_large` | same, ~72×64 |
| `imp` `hench` `nu` `kilwala` `roundillo` | original monster designs in the spirit of the classic silhouettes (imp: small blue-green goblin; hench: horned blue brute — built-in exists, redo at 48px; nu: round blue blob-creature with small eyes & tuft; kilwala: small white/grey ape; roundillo: armored rolling armadillo-ball) |
| `tyrano` | big tyrannosaur, ~80×72 (engine marks it `big`) |
| `vitrine` | walking glass display case (tall rectangle of glass with a bone skeleton inside, stubby porcelain legs), ~40×60 |
| `curator_p1` | tall thin figure: porcelain plates over blue-lit lattice, single vertical slit eye, long dead-grey docent's coat, ~64×100 |
| `curator_p2` | plates opened like a flower revealing a knot of Lavos-red energy, ~96×96 |
| `marle` `lucca` `robo` | redo at 48px quality (built-ins are 32px). Marle: blonde ponytail, white top, crossbow. Lucca: purple hair, green helmet w/ goggles, orange top. Robo: rounded gold/copper robot, 48×48 |
| `king` `leene` | King Guardia XXI (crown, red cape, beard), Queen Leene (gown, tiara) |
| `kino` | caveman, brown hair, fur tunic, club |
| `elder` | Last Village elder, hooded old man, fur cloak, snow tones |
| `gaspar` | old sleepy man, bowler-ish hat, cane, yellowish robes |
| `spekkio` | small pink round creature form (Nu-like with horns/ears) |
| `guard` | Guardia soldier 600AD (helmet, blue tabard, spear) |
| `villager_600` `villager_ioka` `villager_last` `fairgoer` | +`_b`, `_c` (and `fairgoer_d`) palette variants |
| `epoch` | the time machine, hovering, ~96×48 (prop) |
| `lavos_seed` | fist-sized red-black pulsing egg, 16×16 on a 24×24 canvas (prop) |
| `lavos_seed_inert` | same, grey and cracked |
| `time_gate` | blue swirl portal 48×48 (prop) |
| `hollow_gate` | same shape, grey with red scanlines (prop) |

## 3. Portraits (`CT.getPortrait`)

```js
CT.getPortrait(id, emotion) -> HTMLCanvasElement 64×64 (cached)
```

ids: `crono frog ayla magus marle lucca robo king leene kino elder gaspar
spekkio iselle curator nu corin`. Emotions: `neutral happy angry sad surprised
determined`, plus `broken` for iselle (falls back to `sad` for others).
Unknown ids must return a neutral silhouette, never throw. Faces must match
the in-game sprites' colours (frog/ayla/magus: look at the PixelLab PNGs;
note this Magus has very long **dark** hair with a blue sheen and pale skin).

## 4. Audio (`CT.audio`)

```js
CT.audio.unlock()                 // call on first user gesture (engine does)
CT.audio.playMusic(id, {fade:ms}) // loops unless the track is one-shot; same id = no-op
CT.audio.stopMusic(fadeMs)
CT.audio.sfx(id)
CT.audio.setVolume({ music: 0..1, sfx: 0..1 })
CT.audio.current                  // current track id
```

All `mus_*` and `sfx_*` ids from the bible §5 and §4.7 (+ `sfx_core_scream`,
`sfx_step`, `sfx_menu_move`, `sfx_miss`, `sfx_buy`, `sfx_door`). Unknown ids
are ignored silently.

## 5. Terrain & decor

### Terrain codes (`CT.TERRAIN[code]`)

Built-in: `g` grass, `d` dirt, `s` stone flagstones, `b` wood bridge/planks,
`w` deep water (swim only), `f` shallow water (walkable). Legacy `t`/`r` in map
rows become grass+tree / dirt+rock decor.

`terrain_ext.js` must add at least:

| code | material | flags |
|---|---|---|
| `c` | cobblestones (Leene Square) | walk |
| `e` | red carpet (castle) | walk |
| `h` | wooden floor / hut boards | walk |
| `p` | grey mountain rock | walk |
| `n` | snow | walk |
| `i` | ice | walk |
| `a` | black volcanic ash rock | walk |
| `l` | lava (animated, glows) | `lava: true, glow: '255,120,40'` |
| `m` | Zeal marble (blue-white, tarnished gold trim, dreamstone cracks) | walk |
| `y` | dreamstone-cracked marble (glowing cyan cracks) | walk, `glow` |
| `k` | Hollow ceramic floor (white tiles, faint blue seams) | walk |
| `K` | ceramic with red-black Lavos veins | walk, `glow: '255,40,60'` |
| `v` | void (not drawn; chasms / the Hollow edge) | `void: true` |
| `W` | deep sea water | `swim: true, liquid, animated` |
| `o` | End of Time stone floor (dark slate) | walk |
| `q` | sand / beach | walk |

Material object API — see `terrain.js` for the built-ins:

```js
CT.TERRAIN.n = {
  name: 'Snow', walk: true,            // flags: walk swim void lava liquid animated glow noRim depthOffset blades
  top(p)  { return [r,g,b]; },          // p: {wx, wy, tx, ty, n, grain, frame, ph, t, nb(dx,dy)}
  side(p) { return p.fin([r,g,b]); },   // p: {u, v, wu, depthPx, face, k, fin(c)}; return null = transparent
};
```

`wx, wy` are continuous world coords (seamless across tiles), `n` smooth noise
0..1, `grain` per-texel hash, `ph` water phase. `CT.TX` exports
`hash, vnoise, hex, ramp, pick, scale, mixc, R` helpers.

### Decor (`CT.registerDecor(kind, def)`)

```js
CT.registerDecor('lantern', {
  build(variant) -> canvas, variants: 1,
  blocks: true,            // tile can't be entered
  shadow: [rx, ry],        // optional ground shadow
  yOff: 4,                 // push down (px) so the base sits on the tile centre
  xOff: 0,
  flat: false,             // true: drawn centred flat on the tile (runes, rugs)
  light: { color: '255,200,120', radius: 70, flicker: true, dy: 10 },  // optional
  animate(img, now, d) -> canvas | null,   // optional per-frame variant
});
```

Required kinds: `tree pine snow_pine rock bush fern tent(variants=colours)
bell_tower lantern fountain table crate barrel torch throne banner pillar
cairn waterfall hut bonfire fossil bone_pillar reptite_ruin snow_hut
broken_column schala_vitrine(variant 0 intact, 1 cracked) dreamstone lamppost
door_600 door_65m door_12k door_grey door_spekkio save_point vitrine
(variants: fair, masamune, kilwala, zeal, epoch, bell) archive_shelf ladder
arch pedestal_placard(variants: 0 CRONO, 1 GLENN, 2 AYLA, 3 JANUS, 4 shattered)
core_vitrine nu_stall`.

## 6. Maps (`CT.MAPS[id]`)

```js
CT.MAPS.denadoro = {
  id: 'denadoro', name: 'Denadoro Pass', theme: 'mountain', music: 'mus_denadoro',
  terrain: ['pppp...', ...],   // one char per tile, rows = y, cols = x
  height:  ['0000...', ...],   // base-36 digit per tile (0–9 used)
  decor:   [{ x, y, kind: 'pine', variant: 0 }, ...],
  zones:   { SHRINE: [6,1,9,2], BRIDGE: [[7,5],[8,5],[9,5]] },   // rect or tile list
  markers: { cairn: [7,12], party_start: [7,14], ... },
};
```

Themes (renderer): `dusk night dawn day mountain castle prehistoric volcanic
snow zeal void museum core`.

### Required maps, zones and markers

Coordinates written `(x,y)`. All listed markers must be on walkable, unblocked
tiles unless noted. Every map needs walkable space for 4 party members plus
the listed enemies.

| map id | size | theme | zones | markers |
|---|---|---|---|---|
| `leene_square` | 16×14 | night | `EXIT` | `bell` (tile in front of the bell tower), `crono`, `marle`, `lucca`, `frog`, `rift` (square centre), `epoch`, `gate`, `robo`, `fair1..fair4`. Battle 0 uses (4,8),(5,8) party and (4,2),(6,2),(5,3) enemies — open, walkable, heights 0–1. |
| `guardia_throne` | 14×12 | castle | `EXIT_SOUTH` | `king` (on throne, height 1 dais), `leene`, `guard1`, `guard2`, `entrance`, `party` (below dais), `shop`, `save` |
| `denadoro` | 16×16 | mountain | `SHRINE` (6..9,1..2, h4), `BRIDGE` (7..9,5, h3, wood), `EXIT_SOUTH` | `cairn`, `party_start` (7,14), `iselle` (8,5), `seed_a` (10,7, h2), `seed_b`, `kilwala1..3`, `shrine` (7,1). Waterfall/water column x=8 (except bridge). Heights 0–4. |
| `ioka` | 14×14 | prehistoric | `EXIT_NORTH` | `bonfire` (blocked decor tile; use `bonfire_side` for standing), `bonfire_side`, `kino`, `crono`, `vill1..3`, `shop`, `save` |
| `tyrano_crater` | 16×16 | volcanic | `PILLAR` (8,8), `RIM` (all height-3 tiles) | `ayla` (8,10), `crono` (6,13), `frog` (10,13) — h1; `iselle` (2,2) h3; `feeder1` (4,8), `feeder2` (12,8), `feeder3` (8,4) — h1 ring; `roll1`, `roll2`; `kino`. Lava ring around the pillar; centre pillar (8,8) walkable h0. |
| `last_village` | 14×14 | snow | `EXIT_NORTH` | `magus` (cliff edge), `elder`, `crono`, `vill1..3`, `shop`, `save` |
| `zeal_wreck` | 16×16 | zeal | `SEED` (8,2) | `crono` (6,12), `frog` (8,12), `ayla` (10,12), `magus` (8,13, over water — sea rows 14–15 use `W`), `iselle` (7,2), `guard` (9,2), `case` (8,1; the `schala_vitrine` decor tile), `sentinel1`, `sentinel2`, `nu1`, `nu2`, `nu_spawn` (8,3), `magus_stop` (8,11) |
| `end_of_time` | 12×12 | void | `DOOR_600`, `DOOR_65M`, `DOOR_12K`, `DOOR_GREY`, `DOOR_SPEKKIO` (each the tile in front of its door decor) | `arrive`, `lamppost`, `gaspar`, `nu` (shop), `save`, `door_600`, `door_65m`, `door_12k`, `door_grey`, `spekkio` |
| `spekkio_room` | 8×8 | void | — | `spekkio`, `crono`, `frog`, `ayla`, `magus` |
| `hollow_atrium` | 16×16 | museum | — | `party` (8,8) (with (7..9,8) open), `arch_n`, `arch_e`, `arch_w`, `tyrano`, `sentinel1..4`, `imp1..4` |
| `hollow_archive` | 16×16 | museum | `WEST` (x 0–7), `EAST` (x 9–15), `LEDGER` (8,1), `CHASM` (x=8, y 2–15 — terrain `v`) | `crono` (3,8), `ayla` (3,10), `frog` (13,8), `magus` (13,10), `iselle` (13,12), `corin_shelf`, `sb_w1`, `sb_w2`, `sb_e1`, `sb_e2`, `hench_w1..2`, `hench_e1..2`, `nu_w`, `nu_e` |
| `hollow_core` | 16×16 | core | `PED_N`, `PED_E`, `PED_S`, `PED_W` (pedestal tops, h2), `Q_N`, `Q_E`, `Q_S`, `Q_W` (quadrants), `RING_OUTER` (outermost ring of the circular platform) | `curator` (8,7), `case` (8,5), `party` (7,12) (with (6..9,12) open), `iselle_edge`, `sprout_e`, `sprout_w` |
| `zenan` | 12×12 | dusk | — | (existing skirmish map — keep as is) |

## 7. Scenes (`CT.SCENES[id]`)

```js
CT.SCENES['1.2'] = {
  title: 'Denadoro Pass, approach',        // shown in the debug menu
  map: 'denadoro', theme: 'mountain',      // theme optional (overrides map theme)
  music: 'mus_denadoro',                   // optional, else map.music
  actors: [                                // placed when the scene starts
    { id: 'crono', at: '@party_start', face: 'N' },
    { id: 'frog',  at: [8,14], face: 'N' },
    { id: 'iselle', at: '@iselle', face: 'S' },
    { id: 'sb1', sprite: 'seedbearer', at: '@seed_a', face: 'N' },
    { id: 'seed', sprite: 'lavos_seed', at: [9,9], prop: true },
  ],
  script: [ ...commands ],
};
```

Positions: `'@marker'` or `[x, y]`. Facing: `'N' 'E' 'S' 'W'` (world axes:
E = +x, S = +y). An actor's sprite defaults to its id.

### Commands

| command | meaning |
|---|---|
| `['say', who, emotion, text, opts?]` | dialogue line. `who`: portrait id (see §3) or `'narrator'`. `opts.radio` = radio static style (Lucca/Robo remote). `curator` lines automatically use the white VESPER box + small caps. |
| `['choice', ['A','B'], [[...cmdsA], [...cmdsB]], flag?]` | player choice; runs the matching branch; stores the index in `flag` if given. A single-option choice is allowed. |
| `['move', id, at, opts?]` | walk (pathfinding) to a tile; `opts.speed` ms/tile, `opts.run`, `opts.nowait` |
| `['face', id, dir \| otherId]` | turn |
| `['anim', id, name]` | `nod shake_head shrug draw_sword point bow spin jump kneel fall run_off dissolve` |
| `['emote', id, text]` | speech-bubble emote, e.g. `'!'`, `'...'`, `'?'`, `'♪'` |
| `['spawn', {id, sprite?, at, face?, prop?}]` / `['despawn', id]` | add/remove actors |
| `['music', trackId]` / `['music', null]` | change or stop music |
| `['sfx', id]` | play a sound |
| `['wait', ms]` | pause |
| `['fade', 'out'\|'in', ms?, color?]` | fade to/from black (or `'255,255,255'`) |
| `['flash']` / `['shake', ms?]` | screen effects |
| `['vfx', kind, at]` | `time_rift` (grey tear, persists until `close_rift`), `gate` (blue), `seed_hatch`, `glass_shatter`, `sparkle`, `heal` |
| `['close_rift', at?]` | remove rifts |
| `['camera', at \| id \| 'map', ms?]` | pan camera |
| `['theme', name]` | change the colour/weather theme (e.g. `'dawn'`) |
| `['chapter', 'I. THE KNIGHT WHO STAYED', '600 A.D.']` | chapter card (black, bell sfx) |
| `['text', 'Every record ends...']` | white text on black |
| `['battle', 'B1']` | run a battle (see §8). Continues on victory; defeat offers retry. |
| `['party', ['crono','frog']]` | set the playable party |
| `['join', 'ayla']` | add a member (level = party average) |
| `['guest', 'iselle', true\|false]` | guest ally for following battles |
| `['unlock', techId]` | unlock a dual/triple tech (popup) |
| `['popup', text]` | tutorial/info popup the player dismisses |
| `['reward', {xp, gold, items: {tonic: 2}, key: 'denadoro_seed'}]` | rewards with a banner |
| `['setflag', name, value?]` | story flags (value default true) |
| `['if', cond, [...then], [...else]?]` | `cond`: `'flag'`, `'!flag'`, `{flag, gt\|gte\|lt\|eq: n}` |
| `['shop', shopId]` | `guardia ioka last_village end_of_time` |
| `['save_prompt']` | offer to save (save points) |
| `['field', {...}]` | free exploration until an exit is taken (below) |
| `['goto', sceneId]` | continue with another scene |
| `['credits']` | roll credits (`CT.CREDITS`) then return to title |
| `['title']` | back to title |

### Field exploration

```js
['field', {
  leader: 'crono',                       // player-controlled actor (others follow)
  hint: 'Speak with the King.',           // objective text in the corner
  npcs: [ { id: 'king', talk: [...cmds] }, { id: 'nu', talk: [['shop','end_of_time']] } ],
  events: [ { zone: 'BRIDGE' | [[x,y],...], once: true, script: [...cmds] } ],
  exits: [ { zone: 'EXIT_SOUTH', goto: '1.2', label: 'Denadoro Pass',
             requires: 'flag' (optional), locked: [...cmds shown if locked] } ],
  save: '@save',                         // save point tile (optional)
}]
```

Talking: walk next to an NPC and click it (or press Enter facing it). The
field ends when an exit's zone is entered (after an optional confirm) and the
exit's `goto` scene starts.

## 8. Battles (`CT.BATTLES[id]`)

```js
CT.BATTLES.B1 = {
  name: 'Denadoro Seed', map: 'denadoro', music: 'mus_battle_boss',
  party: { crono: [7,14], frog: [8,14] },           // start tiles (or '@marker')
  guests: [ { type: 'iselle_ally', id: 'iselle', at: '@iselle' } ],   // optional
  units: [                                             // enemies / neutrals
    { id: 'seedA', type: 'seedbearer', at: [10,7], face: 'S', carrying: true,
      ai: 'seek_zone', zone: 'SHRINE' },
    { id: 'iselle', type: 'iselle', at: [8,5], ai: 'hold', hp: 400, immortal: true },
    { id: 'kil1', type: 'echo_kilwala', near: '@kilwala1' },   // near = nearest free tile
  ],
  objective: { type: 'DEFEAT_UNIT', unit: 'seedA', text: 'Stop the Seedbearer before it reaches the shrine!' },
  hatch: { mode: 'carrier', carrier: 'seedA', zone: 'SHRINE',
           spawn: { type: 'lavos_sprout', id: 'sprout', at: '@shrine' },
           objective: { type: 'DEFEAT_ALL', text: 'The seed has hatched! Defeat everything!' } },
  triggers: [ ... ],
  rewards: { xp: 300, gold: 200, items: { tonic: 2 } },
};
```

Unit fields: `id, type` (enemy type from `data.js`), `at` or `near`, `face`,
`ai`, `hp` (override max HP), `level`, `name`, `immortal` (HP floors at 1;
`UNIT_HP_BELOW pct 0` then fires), `carrying` (seed glow), `team` (1 enemy
default, 2 neutral), `zone` (for `seek_zone`/`guard_zone`), `protect` (id, for
guests), `passive` (doesn't act until triggered via SET_AI).

AI kinds: `aggressive` (default), `hold` (doesn't move, attacks in reach),
`seek_zone` (paths to `zone`), `guard_zone` (stays within 2 of `zone`),
`healer`, `ranged`, `protect` (guest: sticks to `protect` unit),
`curator`, `curator_core`, `sprout`, `sentinel`, `passive`.

`hatch.mode`: `carrier` (hatches when the carrier ends a turn in `zone`),
`feeders` (`{feeders: [ids], max: 4}`: +1 per round while any feeder lives),
`guard` (`{guard: id, max: 6}`: +1 per round while the guard lives). The HUD
shows "Hatch in: N". When the carrier/feeders/guard all die, the seed goes
inert. On hatch: spawn, set objective, fire `HATCH` triggers, set flag
`seed_hatched`.

Special battle mechanics: `placards: { zones: ['PED_N','PED_E','PED_S','PED_W'], damage: 150, target: 'curator' }`
(tech used while standing on an intact pedestal shatters it).

### Objectives

`{type:'DEFEAT_ALL'}`, `{type:'DEFEAT_UNIT', unit}`, `{type:'DEFEAT_UNITS', units:[...]}`,
`{type:'DEFEAT_TYPE', enemyType:'seedbearer'}`, `{type:'SURVIVE', rounds}`,
`{type:'NONE'}` (battle ends only via `END_BATTLE`). All take `text`.
Defeat = all party members KO'd (guests don't count).

### Triggers

```js
{ id: 'B1_T5', when: 'UNIT_HP_BELOW', args: { unit: 'iselle', pct: 40 }, focus: 'iselle',
  lines: [ ['iselle','sad','…Noted.'], ['iselle','neutral','We\'ll meet in the age of beasts.'] ],
  script: [ ...scene commands, incl. choice ],   // optional, runs after lines
  effect: [ { type: 'RIFT', at: 'iselle' }, { type: 'DESPAWN', unit: 'iselle' } ],
  repeatable: false }
```

`lines` entries are `[who, emotion, text, opts?]` (same as `say`).

`when` + `args`:
`PRE_BATTLE` · `TURN_START {n}` (round n) · `UNIT_HP_BELOW {unit, pct}` ·
`UNIT_DEFEATED {unit}` · `UNIT_ENTERS_TILE {unit, x, y}` ·
`UNIT_ENTERS_ZONE {unit | 'any_party', zone}` · `ANY_ENEMY_ENTERS_ZONE {zone, count?}` ·
`TECH_USED {unit | 'any', tech, knockedDown?}` · `DUAL_TECH_USED {tech}` ·
`UNIT_ADJACENT {a, b, enemyAdjacent?}` · `ALLY_KO {unit | 'any'}` ·
`COUNT_DEFEATED {enemyType, count}` · `HATCH` · `PLACARD_SHATTERED {count}` ·
`VICTORY` · `DEFEAT`.

Effects: `SPAWN {unit: <enemy type>, id, at|near, face, ai, team, hp, count}` (as in the script grammar, the enemy type goes in `unit`) · `DESPAWN {unit}` ·
`MOVE_UNIT {unit, at}` · `SET_OBJECTIVE {objective:{...}, text}` ·
`SET_TEAM {unit, team}` · `SET_AI {unit, ai}` · `PLAY_MUSIC {track}` ·
`HEAL {unit, pct}` · `APPLY_STATUS {unit | 'all_party' | 'last_seedbearer', status, turns | 'permanent'}` ·
`UNLOCK_TECH {tech}` · `SHAKE` · `FLASH` · `RIFT {at}` · `CLOSE_RIFT` ·
`DROP_SEED {at}` · `VOID_TILES {zone}` · `FILL_TILES {zone, terrain, h}` ·
`TRANSFORM {unit, into}` (boss phase change: new type stats, full HP) ·
`FREE_ACTION {unit, tech, target}` · `SET_FLAG {flag, value}` ·
`END_BATTLE {result: 'victory'|'defeat'}` · `SWAP_BARKS {unit, set}`.

## 9. Data ids (from `data.js`)

Party: `crono frog ayla magus`. Guest type: `iselle_ally`.

Techs — crono: `cyclone slash lightning spincut lightning2 luminaire` ·
frog: `slurp slurp_cut water heal leap_slash frog_squash` ·
ayla: `kiss rollo_kick cat_attack tail_spin charm triple_kick` ·
magus: `m_lightning2 ice2 fire2 dark_bomb dark_mist black_hole dark_matter` ·
duals: `x_strike sword_stream drop_kick slurp_kiss beast_toss shadow_cyclone ice_water` ·
triple: `eclipse_blade`.

Enemy types: `echo_imp echo_hench echo_nu echo_kilwala echo_roundillo
echo_tyrano seedbearer lavos_sprout lavos_sprout_large vitrine_sentinel
iselle curator curator_core spekkio`.

Items: `tonic mid_tonic ether revive shelter magic_tab`. Key items:
`denadoro_seed tyrano_seed zeal_seed corin_tablet`.

Flags set by the engine: `seed_hatched` (any seed hatched in B1–B3),
`iselle_ko` (Iselle KO'd in B4A/B4B), `eclipse_uses` (number).
