# Hand-pixelled cast: method and quality bar

We are redrawing every character of the game as **hand-placed pixel art** in the style of
SNES Chrono Trigger sprites. Procedural or auto-shaded art was rejected by the user as
"broken". **Every pixel is placed by hand, deliberately.**

## The quality bar

- **The user's reference:**
  `/tmp/claude-0/-home-user-ChronoTactics/3fb071b6-40c9-5b63-8bf8-573639d40780/scratchpad/ref/reference_4x.png`.
  It shows six front-view Crono sprites at 4×. Open it with the Read tool and study it
  closely. The native file (a 2× upscale) is `ref.png` in the same folder.
- **Our approved Crono:** `tools/crono_lab/crono_r2.js`, `C.ROWS` plus `rowsB()`. It took
  four rounds of user feedback to get here. Read it row by row: it shows the construction
  you must follow.

## Format

- **Front view, idle, facing the camera,** like the reference. Other views come later.
- **Your file** is `tools/crono_lab/cast_<group>.js`, and it is the only file you edit.
  Register each sprite like this:

  ```js
  CAST.frog = { name: 'Frog', group: 'party', w: 22, h: 40, pal: { H: '#…', ... }, rows: ['...', ...] };
  ```

  `rows` are strings in which `.` means transparent and each other character is a key into
  `pal`. Rows may be ragged, and they are padded to `w`. There is **no automatic outline**:
  you draw the outline yourself, like the reference does.
- **Preview:** `PW=$(npm root -g)/playwright node tools/crono_lab/shot.cjs cast /tmp/x.png only=frog scale=8`.
  Add `game=1` to also see 2× (in-game size). Crono always renders first as the bar.
  **Look at every render with the Read tool** and compare it against the reference and
  Crono. Iterate many times; the first draft is never good enough.

## Construction rules (learned the hard way on Crono)

1. **Proportions.** Humans are about 20–24 px wide and 40–46 px tall.
   - The head and hair take the top ~17 rows. The face is small, about 10 px wide.
   - The eyes are 3×2: an outline pixel, a white pixel and a coloured iris, with 2 px of
     skin between the eyes.
   - Big heads and small faces are the Chrono Trigger look.
2. **Tinted outlines, not black everywhere.**
   - Each material has its own dark outline colour: maroon for red hair, near-black purple
     for the body, black for the legs.
   - The outline is part of the art. It separates the arms from the torso and one lock of
     hair from the next.
3. **3–4 tones per material.**
   - Use outline, dark, mid, light and at most one highlight.
   - The light comes from the top-left: lit edges on the left and top, darker on the right.
   - Don't mirror a whole sprite. Symmetric sprites look stiff; hand-shade the right side
     darker.
4. **Hair is made of strands.**
   - Strands are 2–3 px wide, separated by outline-colour pixels.
   - Each strand has a lit left edge and occasional highlight glints (orange or yellow on red
     hair).
   - Strands must fan out from the part. A flat mass of one colour reads as a blob.
5. **Shoulders are rounded caps** that slope down from the collar in two steps, shaded with
   a darker cloth colour.
   - **Arms are thin:** 2 px of skin or sleeve plus outline.
   - They emerge under the shoulder cap and hang close to the body, angling out slightly,
     with the fists by the hips.
   - Leave a 1 px dark gap between the arm and the torso from the elbow down.
   - Never draw arms as square tubes or wings.
6. **The torso tapers** from the chest (~11 px) to the waist (~9 px). A belt sits only across
   the waist, never arm to arm, and the clothes flare out again below it.
7. **No collar or scarf block right under the mouth,** because it reads as a beard. Show the
   chin, then the collar below it.
8. **Legs sit centred under the hips,** with a 1 px split between them. Wraps and boots get a
   bulge at the knee, a highlight, and darker shins and toes.
9. **Details:** 1–2 px accents (a buckle, a glint, a wristband) make it read as hand-made.
   Keep them sparse and purposeful.
10. **Big monsters** may be larger: up to about 48×56 for normal monsters and about 64×72 for
    bosses. Apply the same rules: tinted outlines, 3–4 tones, top-left light, and deliberate
    texture instead of flat fills.

## Palettes

- Use the reference's colours where they fit.
- Otherwise choose rich, SNES-like ramps:
  - hue-shift the shadows (cooler and more saturated);
  - make the outlines dark and tinted;
  - keep highlights sparing.

Who the characters are is in `docs/SCRIPT.md`, and the character descriptions are near
the top. The old rigs in `public/js/rigs_*.js` show each character's intended design and
colours. Take the *design* from them, not the drawing.
