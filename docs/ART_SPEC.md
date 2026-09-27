# Art spec: the pixel pipeline (v2)

The quality bar is `public/magus-wizard.html`: a fixed palette, crisp integer pixels,
1px dark outlines, 2–3 tone cel shading, a rim light from magic, and posed animation
that reads like a hand-drawn 10 fps sprite sheet. Nothing is anti-aliased, and there are
no gradients or soft alpha in the art itself.

## The pipeline (already built; do not change these files unless you are told to)

- **Logical resolution: 480×300.** `#cv` is 480×300. The DOM stage is 960×600 CSS px, so
  **one game pixel = 2 stage px**. `main.js` scales the stage so each game pixel is a
  whole number of device pixels.
- **Master palette: 65 colours** in `public/js/pal.js` (`CT.PAL.RAMPS`: ink, slate, stone, blue,
  green, teal, wood, skin, red, gold, purple, pink, white). Every finished frame is
  quantised onto it (`Renderer.present`) with a light 4×4 ordered dither for in-between
  tones. Baked art is snapped to it with `CT.PAL.snapCanvas`, which rounds to the nearest
  colour with no dither. **Author with palette hex values**: pick them from the ramps and
  look at `CT.PAL.PAL`. Off-palette colours get rounded, and the rounding may surprise you.
- **Isometric tiles: 32×16 diamond, 8 px per height level** (`CT.ISO`).
- **Pixel primitives** (`CT.PXD`): `ellipse`, `ellipseRing`, `disc`, `line`, `diamond`, and
  `text` (a 5×7 bitmap font with outline). Use these instead of `arc`, `stroke`,
  `createRadialGradient` or `fillText`.
- **Screenshots**: `PW=$(npm root -g)/playwright node tools/shot.cjs …` (see the header of
  `tools/shot.cjs`). The modes are `map <id> [rot]`, `battle <id> [ms]`, `rig <keys> [anims]` and
  `dev <sprites|portraits|decor>`. Use `ZOOM=x,y,w,h` to crop. **Look at your work at zoom**
  (use the Read tool on the PNG) and iterate until it clearly reads.

## Characters: rigs (`public/js/rig.js`)

Characters are **drawn by code from a pose**. The reference implementation is Crono in
`public/js/rigs_party.js`; read it first, then `rig.js`.

```js
CT.RIG.define('key', {
  body: { headR: 5 },            // optional overrides of CT.RIG.BODY (leg, torso, headR, upper, fore...)
  pal: { letter: '#hex', ... },  // materials -> palette colours
  detail: 'eEmH',                // letters drawn flat (eyes, strands) that don't split shading regions
  magic: '#fce068',              // rim-light colour during cast (false = none)
  hi: true,                      // shading mode for CT.PX.shadeGrid (default true)
  anims: { attack: {...} },      // optional per-character overrides/additions of CT.RIG.STD
  draw(g, J, view, pose) { ... } // or draw: CT.RIG.human({ hooks })
});
```

- The frame is a 56×56 letter `Grid` (`CT.PX.Grid`). The root (the ground point between
  the feet) is at (28, 50). A standard human is about **34 px tall**: feet at y 50, top of
  the head about y 16, plus hair. Big monsters can use the whole frame. Set
  `body.leg`/`torso` for tall or short folk.
- `J` (joints, from `CT.RIG.solve`): `root hip chest neck head hipF hipB kneeF kneeB footF
  footB shF shB elF elB handF handB` are points `{x,y}`. `lean` is the torso angle in radians.
  `up` is the torso axis. `wpn`/`wdir` give the weapon angle and unit axis (0 = up; positive
  tips forward, toward screen-right). `pose` is the raw pose object. `F` means the near
  limb (in front of the body) and `B` the far limb.
- `view` is `'se'` (front ¾, facing screen-right/down) or `'ne'` (back ¾, facing
  away and up-right). West-facing frames are mirrored automatically, so **draw facing right**.
- Grid primitives: `px rect ell line tri spike text capsule(x0,y0,x1,y1,r,c)
  poly([[x,y]…],c) stamp(x,y,ax,ay,rows)`. `stamp` places hand-authored letter rows with
  the anchor pixel `(ax,ay)` on `(x,y)`. It's the best way to draw faces, hair, helmets,
  emblems and weapons as real pixel art that moves with a joint.
- Shading comes from `CT.PX.shadeGrid`: a 1px dark outline, a darker band on the
  bottom/right edges of each letter region, and a lighter band on the top/left edges. So
  **use different letters for parts that must read as separate volumes** (near leg `p` and far
  leg `q`, near sleeve `d` and far sleeve `D`), even when they share a colour. Put the
  near-side letter in a slightly brighter colour than the far side.
- `CT.RIG.human(hooks)` draws a full humanoid (legs, boots, torso, arms, hands, head,
  default face). Characters add their look through hooks: `behind legs torso face hair
  weapon front`. Materials and draw order are documented above `human()` in `rig.js`.
  Non-humanoids (monsters, robots, props) write their own `draw` and interpret the same
  pose fields in their own way (see below).
- **Pose fields** (all optional): `x y` (whole-body offset), `bob crouch` (hip drop),
  `lean`, `hipX`, `footF footB` (`[dx, lift]`), `armF armB` (`[shoulderAngle,
  elbowBend]`; the angle is measured from straight down, positive swings forward; π/2 is
  straight forward and π straight up), `wpn` (weapon angle), `tilt nod` (head offset),
  and the flags `hurt ko`.
- **Standard animations** (`CT.RIG.STD`), all present on every rig. The engine plays them:
  - `idle`: 2 frames, loops.
  - `walk`: 4 frames, loops.
  - `attack`: wind-up, strike, follow-through, settle. It plays on melee hits.
  - `cast`: frames 0–1 loop while charging, frame 2 is the release. It plays for techs,
    with a magic rim light from the hands.
  - `shoot`: aim, recoil. It plays for ranged attacks.
  - `hurt`: when damaged.
  - `ko`: drawn rotated 90° when KO'd.
  - `kneel`: story beats.
  - `victory`.

  Override any of them per character: `anims: { attack: { frames: [...] } }`. For cast,
  keep `charge: [0,1], release: 2, rim: true`. A frame is a pose object plus `ms`. Monsters
  should override to suit their body (a biting lunge, a slam, a pulse) while keeping the
  same names.
- Optional per-rig fields:
  - `size`: the frame edge. The default is 56; bosses can use 72–96. The root sits 6 px
    above the bottom, centred.
  - `rimAt(J, pose, view) -> [x, y]`: where the cast rim light comes from. The default is
    the hands.
  - `portrait: {x, y, side}`: the turn-bar icon crop in frame coordinates. The default is
    around `J.head`.
  - `koRotate: false`: draw the `ko` animation as authored instead of rotating the sprite
    90°. Use it for blobs, boxes and domes.
- In `shadeGrid` the letter `k` is always drawn in the outline colour, whatever the
  palette says.
- A non-humanoid `draw(g, J, view, pose)` should still move with the pose. Use
  `pose.bob`/`crouch` (squash), `pose.lean`/`x` (lunge), `pose.hurt` (recoil and wince),
  and `J.head`/`J.chest`/`J.hip` as anchors, or compute its own anchors from `CT.RIG.RX/RY`.
- Quality checklist for every character:
  - a readable silhouette at 1×;
  - a face that reads (eyes!) in the SE view, and a proper back view in NE (no face;
    hair, cape or back of the armour instead);
  - near and far limbs separated;
  - 2–3 tones per material;
  - a weapon or prop that reads as the character's;
  - every animation frame shows a distinct, readable pose;
  - nothing clipped at the 56×56 frame edge.

  Echo variants (`echo_<key>`) are derived automatically; don't author them.
- Sprite keys are resolved as rig first (`CT.RIGS[key]`), then the legacy builders, which
  get halved. **When you define a rig for a key, it replaces the old art.**

## Terrain and decor

- Terrain materials (`CT.TERRAIN[code]`) keep the same API (`top(p)`, `side(sp)`,
  `blades`, `liquid`, `animated`…). They are now rasterised into a 32×16 top plus 8 px per
  level of side. `p` also carries `px py` (the pixel inside the 32×16 top) and `native:
  true`. `sp` carries `pu pv` (native side-face pixel coords), `pwu` (a native
  world-varying u) and `pdepth` (native face height). `u v wu depthPx` remain at the old
  double scale for legacy materials. Design for chunky 16-bit legibility: bold 2–3 tone
  patterns, 2×2 to 4×4 features, a clear top edge, and brick courses 4 px tall.
- Decor defs gain `native: true`. Native decor is drawn 1:1, and offsets (`xOff yOff shadow
  light.radius light.dx light.dy`, where `dx`/`dy` place the light source relative to the sprite) are in logical px. Decor without `native` is legacy: it is
  halved automatically and its offsets are halved.

## Rules for parallel work

- Only edit the files you own. Never rewrite other files. If you need an engine change,
  describe it in your final report instead.
- Test by loading the real game (`tools/shot.cjs`). Zero console errors are required.
