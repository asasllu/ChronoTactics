# Hand-pixelled animation: method and quality bar

The user approved the front-view cast in `tools/crono_lab/cast_*.js` and `crono_r2.js`
(Crono is `CRONO_R2.rowsB()`). Now every character needs **hand-crafted animation**: every
movement, every weapon and every spell must look natural and hand-made, like SNES Chrono
Trigger. **Every pixel of every frame is placed deliberately.** Procedural or rig-based
posing was rejected as "broken", so don't generate frames from maths.

Read `tools/crono_lab/CAST_SPEC.md` first. Its construction rules still apply to every
frame: tinted outlines, 3–4 tones, light from the top-left, strand hair, rounded shoulders,
thin arms, and a tapered torso.

## What you produce

`public/js/sheets/<key>.js`, one file per character, with sprite key = cast key:

```js
CT.sheet('crono', {
  pal: { ... },                     // copy the approved palette; add letters only if needed
  w: 56, h: 60, anchor: [28, 57],   // frame canvas; anchor = ground point between the feet
  at: [16, 12],                     // where rows are placed by default (optional)
  parts: { name: [rows] },          // optional reusable pieces (heads, weapons...)
  se: { idle: {...}, walk: {...}, ... },   // FRONT 3/4 view
  ne: { idle: {...}, walk: {...}, ... },   // BACK 3/4 view
});
```

Effects go in `public/js/sheets/fx_<key>.js` using `CT.fxSheet(...)` and `CT.techFx(...)`
(see below).

The runtime is `public/js/sheet.js`, and its header documents the format. Here's a
summary:

- **An animation** is `{ loop, frames: [...], charge: [i, j], release: i, hit: i, rim: '#hex' }`.
- **A frame** takes one of two forms:
  - `{ ms, rows: [...] }`: a full hand-drawn frame.
  - `{ ms, base: 'idle.0', draw: [ops] }`: a copy of another frame, then hand edits. The
    ops are `part`, `rows`, `erase`, `move`, `px` and `recolor`, and `'_'` in rows erases.
    Use this for small changes such as a blink, a breathing bob, or one arm that moves
    while the rest stays still.

  Don't use `move` on big regions as a shortcut for real posing: a shifted torso isn't a
  new pose. Redraw what changes.
- **Frame extras:**
  - `dx, dy` shift the whole frame in game px, for lunges and hops, so the canvas can stay
    small.
  - `glow: [x, y]` is where the charge sparks gather (the hands or the weapon tip).

## Views and facing (the game is isometric)

- **`se` is the front ¾ view.** The character faces **screen-right and towards the
  viewer**, turned about 45° from the approved straight-front sprite.
  - We see the face and chest, with the body turned so the character's **right side is
    nearer the viewer** (on screen-left and a little in front).
  - The far (left) arm and leg are partly hidden and darker.
  - The weapon hand is the near hand for right-handers.
  - The eyes shift towards screen-right. The far eye is narrower or partly hidden.
- **`ne` is the back ¾ view.** The character faces screen-right and away up the screen.
  - We see the back of the head and hair, and the back of the clothes, cape or armour.
    There is no face; at most an ear or cheek edge on the right.
  - The near side is again the character's right side (on screen-left).
- **West-facing frames are mirrored automatically, so draw facing right.**
- Keep the approved design exactly: same palette, proportions, head size, costume details
  and weapon. The ¾ turn changes the drawing, not the character.

## Animations each character needs

The runtime aliases missing ones, but **every one listed for your character must be
authored in both views** unless noted.

| name | frames | notes |
|---|---|---|
| `idle` | 4, loop | Breathing: shoulders and chest rise 1 px, hair and cape settle a beat later, and one blink frame. Subtle; nothing jitters. About 180–300 ms per frame. |
| `walk` | 6–8, loop | Contact, down, passing, up, and so on. Arms counter-swing, the head bobs 1 px, hair and capes lag behind. Feet never slide. Total about 600–800 ms. |
| `attack` | 5–7 | Weapon-specific: anticipation, wind-up, a smear frame (the blade drawn as a motion arc), impact, follow-through and recover. Mark `hit`. Lunge with `dx`. |
| `cast` | 4–5 | 0–1: a charge loop (`charge: [0, 1]`), hands gathering power, hair lifting. Then `release: 2` (the thrust), then recover. Give each frame a `glow: [x, y]` at the hands. |
| `hurt` | 2 | Flinch back, eyes shut or teeth gritted, then half-recovered. |
| `ko` | 1–2 | Lying on the ground, drawn as authored (not rotated). The sheet sets this automatically when `ko` exists. |
| `kneel` | 1–2 | Down on one knee, head bowed (story beats and low HP). |
| `victory` | 3–4, loop | A character-specific pose: sword raised, a cheer, a smug hair flick. |
| `jump` | 4 | Crouch, take-off, airborne (`dy` up), land. Used for leaps and height changes. |
| `tech_<id>` | varies | One per **physical** tech that is its own move (see the table below). Mark `hit`, plus `release` if it follows a charge. |
| story extras | varies | Listed per character below (`nod`, `point`, `shake_head`, `spin`, `draw_sword`, `talk`, and so on). |

Monsters (`hench`, `imp`, `nu`, `kilwala`, `roundillo`, `seedbearer`, the bosses) need
`idle`, `walk` (hop, slither, roll or float, whatever fits the body), `attack` (their basic
attack tech), `cast` (only if they have a magic tech), `hurt` and `ko` (death: collapse,
shatter or crumble, 2–4 frames and not looping), plus a `tech_<id>` for each signature
move.

NPCs and villagers need `idle` (4 frames, loop) and `walk` (6 frames, loop) in both
views, `talk` (2–3 frames, loop, se only: mouth and a hand gesture), and any story
extras listed.

Props need an `idle` loop (hover, swirl, pulse) in `se` only.

## Timing and motion (what makes it read as natural)

- **Motion principles:**
  - Anticipation before every action.
  - Overlapping action: hair, capes, scarves and tails trail 1–2 frames behind the body.
  - Squash on landing.
  - Arcs, not straight lines.
- **Hold key poses longer** (strike impact about 120–180 ms), and keep in-betweens short
  (40–80 ms).
- **Smear frames:** the blade or limb becomes a 2–4 px wide arc in lighter tones, drawn
  by hand.
- **Silhouettes** must differ clearly frame to frame. Check them at 2× (in-game size).
- **Volume stays constant.** Heads don't change size, and limbs keep their length.
- **The anchor (the ground point) stays put** unless the move travels. Use `dx`/`dy` for
  travel and hops.

## Effects (one per tech, plus each weapon's hit)

`public/js/sheets/fx_<key>.js`:

```js
CT.fxSheet('fx_lightning', { pal, w: 48, h: 96, anchor: [24, 90], layer: 'front',
  frames: [{ ms: 50, rows: [...] }, ...] });
CT.techFx('lightning', { anim: 'cast', fx: 'fx_lightning' });
CT.techFx('attack_crono', { anim: 'attack', fx: 'fx_hit_katana' });   // basic attack
```

- **Placement:** the `anchor` lands on the ground centre of the target tile. A tile is a
  32×16 diamond, and a standing human is about 44 px tall.
- **Area techs** play `fx` once on every tile, staggered by `stagger` ms, so the effect for
  one tile should fit about 32×16 at its base.
- **Caster effects:** `casterFx` plays on the caster (Cyclone's spin trail, Luminaire's
  burst).
- **Projectiles:** `proj` is a small looping sheet that flies from the caster to the
  target.
- **Look:** hand-drawn SNES-style frames, 6–14 frames at 40–80 ms.
  - Bright cores, a 2–3 tone ramp and dark tinted edges.
  - Dithering is allowed as a deliberate pattern.
  - They should read like Chrono Trigger's tech effects: bold shapes, a strong impact
    frame, a clean dissipation.
  - No soft gradients or alpha: every pixel is a palette letter.
- **Weapon hits:** the basic attack gets a weapon-specific hit (a katana slash arc,
  Masamune water slash, Ayla's punch star, scythe crescent, harpoon spark). Enemies get
  claw, bite, axe and other hits to match.

## Preview and review

```
PW=/opt/node22/lib/node_modules/playwright node tools/crono_lab/shot.cjs anim /tmp/a.png keys=crono scale=4
  [anims=idle,walk] [views=se] [fx=fx_crono]
```

This renders filmstrips, with every frame aligned on the anchor and a white ground line.
**Look at every strip with Read**, compare the frames against each other and against the
approved front sprite, and iterate. Also look at 2× (`scale=2`) for in-game readability.
There must be zero console errors.
Check the flow by eye: does each frame lead into the next? Does anything pop, swim, or
change size? Is the hit frame strong?

**Author with helper scripts that produce rows.** A Python file that holds hand-drawn part
grids, composes them and writes the `.js` is fine. What matters is that each pose is
drawn by hand, not computed.
