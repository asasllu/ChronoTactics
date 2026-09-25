# Chrono Trigger: The Hollow Future

A fan-made sequel to Chrono Trigger, played as a story-driven isometric tactics RPG
in the style of Final Fantasy Tactics. Everything is original: the pixel art, the
chiptune soundtrack, the code and the story script (`docs/SCRIPT.md`).
It is plain HTML5 canvas and JavaScript, with no build step and no dependencies.

> Non-commercial fan project. Chrono Trigger and its characters belong to Square Enix.

## The game

When Lavos died, the ruined future of 2300 A.D. should have stopped existing. Something
in it refused. **The Curator**, an archive AI from the erased timeline, has opened grey
rifts into history and is planting Lavos Seeds in three eras. Its Warden, **Iselle**, is
a girl who is half porcelain. Crono, Frog, Ayla and Magus must pull the seeds up before
they take root, and then walk into the Museum of Never itself.

- **Prologue, then four chapters, then an epilogue:** Leene Square (1000 A.D.), Denadoro
  (600 A.D.), the Tyrano crater (65,000,000 B.C.), the wreck of Zeal (12,000 B.C.), and the
  Hollow. The End of Time is the hub between chapters, with Gaspar, a Nu shop and Spekkio.
- **Seven story battles plus an optional one.** Each has its own objectives:
  - stop a seed carrier before it reaches the shrine;
  - kill the feeders before the seed hatches;
  - fight across a chasm that only Magus can float over;
  - shatter a boss's own placards.
- **Battles trigger dialogue as they unfold:** retreats, betrayals, reinforcements, tech
  unlocks and choices.
- **Cutscenes play on the same maps you explore and fight on.** The field turns into the
  battle grid as the fight starts, just like Chrono Trigger.
- **A single ending with three variations,** depending on how you played.

## Play

Open `public/index.html` in a browser (it works from the file system), or serve `public/`.
Controls:

- **Mouse**: click tiles, units, menu entries. Right-click cancels in battle.
- **Keyboard**: arrows / WASD to walk and navigate menus, Enter to talk or confirm,
  Esc for the menu or to cancel, **Q / E to rotate the camera**.

The title screen also offers **Skirmish (Extra)**, a free battle on the Zenan
riverbank with guest divers Dave and Mat.

## Rules

The rules follow `docs/SCRIPT.md` §3.

- **Charge Time turn order:** CT goes up by SPD each tick, and a unit acts at 100. Moving
  and acting costs 100, doing only one of them costs 80, and waiting costs 60. The next 8
  turns are shown at the top of the screen.
- **On your turn:** Move, then act (Attack, Tech or Item), then **choose your facing**.
  You can undo a move until you act.
- **Damage:** `ATK × mult × 2 − DEF`. Attacks from the side do ×1.25 and from behind
  ×1.5. Attacking from higher ground adds 10%, and ranged techs get +1 range from above.
  There is evasion from the front, 8% critical hits, and elemental weaknesses and
  resistances.
- **Statuses:** Stun, Slow, Burn, Haste, Stasis, Catalogued (+50% damage taken) and
  MAG↓.
- **Combo techs:** dual techs (X-Strike, Beast Toss, Shadow Cyclone, …) and the triple
  tech **Eclipse Blade** appear when your partners have at least 50 CT and are within
  3 tiles.
- **Terrain:** Rollo Kick can push enemies off ledges or into the void. Magus floats
  over water and chasms, and Frog swims.
- **Progression:** the party shares XP and learns techs as it levels. There are shops
  in every era, equipment that auto-equips, save points and an autosave before every
  battle.

## Project layout

| Path | What it is |
| --- | --- |
| `docs/SCRIPT.md` | The game bible: story, characters, rules, every scene and battle. |
| `docs/ENGINE_SPEC.md` | The data contract between the engine and the content modules. |
| `public/js/pixel.js` | Pixel-art toolkit: letter grids, outline and cel-shading pass, Echo effect. |
| `public/js/sprites.js`, `sprites_cast.js` | Character, enemy, NPC and prop sprites (plus PixelLab exports). |
| `public/js/portraits.js` | 64×64 dialogue portraits for 17 characters, with 6 emotions each. |
| `public/js/terrain.js`, `terrain_ext.js` | Terrain materials (pixel-shaded per tile) and decoration art. |
| `public/js/maps.js` | All maps: heights, terrain, decor, zones and markers. |
| `public/js/audio.js` | WebAudio chiptune synth: 21 original tracks and 40 sound effects. |
| `public/js/data.js` | Heroes, growth, techs, enemies, items, equipment, shops and balance knobs. |
| `public/js/story.js` | Every scene, battle, trigger and the credits, as data. |
| `public/js/battle.js` | Tactics rules: pathfinding, CT, damage, statuses, special techs, AI. |
| `public/js/battlectl.js` | Battle flow: input, animation and the mid-battle trigger engine. |
| `public/js/scene.js` | Cutscene runner and field exploration. |
| `public/js/render.js` | Isometric renderer: themes, lighting, weather, effects and camera. |
| `public/js/ui.js`, `main.js` | Dialogue, menus, HUD, title and credits; boot and input. |
| `tools/dev.html` | Previews maps, sprites, portraits, decor and audio in isolation. |
| `tools/balance.js` | Batch battle simulator used to tune difficulty. |
| `tools/build-assets.mjs` | Bakes PixelLab exports from `assets/characters/` into `public/js/assets.js`. |

### Testing hooks

`index.html?test&autoplay&scene=0.2` plays the whole story by itself: the AI controls the
party, dialogue auto-advances, and in fields it talks to every NPC, buys gear and takes
the exits. `?debug` adds a "jump to scene or battle" entry on the title screen.
`PW=$(npm root -g)/playwright node tools/balance.js B1,B2 6 3` runs each battle 6 times,
3 at a time, and reports win rates.

## Deploy

The game is the static files in `public/`, deployed as a Cloudflare Worker with static
assets (see `wrangler.jsonc`): run `npm install && npx wrangler login && npm run deploy`, or
connect the repo in the Cloudflare dashboard so every push to `main` redeploys.

## Character art (PixelLab exports)

Frog, Ayla, Magus, Dave, Mat and the Mystic Knight use 48×48, 8-direction PixelLab
exports. To replace any other character, unzip an export into `assets/characters/<id>/`
and run `npm run assets`.
