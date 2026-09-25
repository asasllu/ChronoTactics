# CHRONO TRIGGER: THE HOLLOW FUTURE
## Full game script + implementation bible for Claude Code

> **Fan project notice.** This is a non-commercial fan sequel. Chrono Trigger and its characters belong to Square Enix. All art, music and code produced from this document must be **original** (pixel art and chiptune "in the spirit of" the SNES era — never traced, ripped, or copied from the original game).

> **Assumption:** "Layla" in the brief is interpreted as **Ayla** (chief of Ioka, 65,000,000 B.C.). If **Lucca** was intended, replace Ayla with Lucca throughout, swap Chapter 2's era to 1000 A.D. (Lucca's house / Guardia Forest) and give her Chapter 2's boss fight with Flame Toss / Hypno Wave / Fire 2 in place of Ayla's Kiss / Rollo Kick / Charm.

---

## 0. HOW TO READ THIS DOCUMENT (for Claude Code)

This document is organized so it can be implemented top-down:

| Section | What it gives you |
|---|---|
| 1. Project overview | Engine, resolution, genre, length, tone |
| 2. Characters | Playable + villains + NPCs, with sprite specs, portraits, stats, tech lists |
| 3. Combat system | Full FFT-style tactics rules, data schemas, and the **mid-battle dialogue trigger system** |
| 4. Asset manifest | Every tileset, sprite sheet, portrait, SFX and UI element to generate, with IDs |
| 5. Music | Every track to compose, with ID, mood, tempo, instrumentation, loop notes |
| 6. Script (Prologue → Chapter 4 → Epilogue) | Scene by scene: location, tileset, music, cutscene dialogue, battle setup, in-battle dialogue triggers, rewards |
| 7. Endings & credits | |
| 8. Implementation order | Suggested milestone plan |

**Conventions used in the script:**

- `[SCENE x.y — Name]` = a discrete map/cutscene unit.
- `MAP:` which tileset/map to load. `MUSIC:` which track ID plays. `SFX:` sound effect cues.
- `CUTSCENE:` a scripted, non-interactive sequence (player can advance dialogue).
- `DIALOGUE` lines are written `SPEAKER (portrait_emotion): text`. Portrait emotions come from the fixed list in §2.
- `CHOICE:` a player prompt. Crono is a **silent protagonist** as in the original: he never has dialogue lines. He "speaks" through animations (`nod`, `shake_head`, `shrug`, `draw_sword`, `point`) and through `CHOICE:` prompts shown to the player. Other characters react as though Crono answered. (This is a design choice; if you want Crono voiced, every `CHOICE:` can be converted to a line.)
- `BATTLE:` a tactics battle with a `BATTLE ID`, map, units, objective and a `TRIGGERS` table. Triggers are the mid-battle conversations — see §3.7 for the exact trigger grammar. **In-battle dialogue never pauses the whole game state; it opens a dialogue box over the battle map, then resumes.**
- `ASSET NOTE:` an inline reminder of a specific asset to create for that scene.

---

## 1. PROJECT OVERVIEW

- **Title:** Chrono Trigger: The Hollow Future
- **Genre:** Story-driven JRPG with FFT-style (Final Fantasy Tactics) grid-based tactical battles. Exploration is top-down 2D (Chrono Trigger style). Battles happen **on the same map the player is standing on** — the field transitions into a grid overlay (homage to CT's seamless battles) but with full tactics rules (movement range, turn order by speed, facing, elevation).
- **Length:** ~4–6 hours. 1 prologue, 4 chapters, 1 epilogue. 10 battles total (6 story battles, 4 bosses).
- **Party:** Fixed four: **Crono, Frog, Ayla, Magus.** All four are in every battle from Chapter 1 onward (Prologue uses Crono + Frog only, as a tutorial).
- **Recommended engine:** Godot 4 (GDScript) or Phaser 3 (TypeScript). Pick whichever you're most fluent in; everything below is engine-agnostic. Data (characters, techs, maps, dialogue, triggers) should live in JSON files so the script can be edited without touching code.
- **Resolution:** Internal render 256×224 (SNES), integer-scaled to window. Tiles are **32×32** (two SNES 16px tiles per logical tile) to give tactics grids more readability; sprites are **32×48**.
- **Tone:** Warm, adventurous, occasionally melancholic. The original game's humor stays (Frog's archaic speech, Ayla's caveman grammar, Magus's dry contempt). Stakes escalate from "one last loose end" to "the future itself is a wound."
- **Save system:** Save points on the map (glowing floor rune, asset `ui_savepoint`) + autosave before each battle.

---

## 2. CHARACTERS

### 2.1 Portrait emotion set (applies to ALL characters with portraits)
Every portrait sheet is 64×64 px, 6 frames: `neutral, happy, angry, sad, surprised, determined`. Dialogue lines reference these. If a character lacks an emotion (e.g. Magus never "happy"), draw it anyway; the script will simply rarely use it.

### 2.2 Playable characters

Common sprite spec for all playable characters: **32×48 px, 4 directions (down/up/left/right), animations:** idle (2 frames), walk (4), attack (3), tech-cast (3), hurt (1), KO (1), victory (2). Field sprite and battle sprite are the same sheet. Color palettes must be original but evoke the classic silhouette (spiky red hair, green frog knight, blonde cavewoman with fur, blue-haired dark mage in a cape).

#### CRONO
- **Role:** Silent protagonist. Balanced fighter, high speed, lightning element.
- **Personality (for animation and NPC reactions):** brave, impulsive, kind. Nods a lot. Draws his sword before thinking.
- **Base stats (Lv 1):** HP 120 · MP 20 · ATK 12 · DEF 8 · MAG 8 · MDEF 7 · SPD 9 · MOVE 4 · JUMP 2
- **Weapon:** Katana (Rainbow is a late unlock)
- **Techs (learned by level):**
  1. Cyclone (Lv1, 4 MP): all adjacent tiles (8 tiles ring), physical.
  2. Slash (Lv3, 3 MP): single target, range 1, ATK×1.3, lightning-tinted.
  3. Lightning (Lv5, 5 MP): single target, range 3, magic, lightning element.
  4. Spincut (Lv9, 7 MP): single target, range 1, ATK×1.8.
  5. Lightning 2 (Lv13, 10 MP): 3×3 area, range 4, lightning.
  6. Luminaire (Lv18, 20 MP): 5×5 area centered on self, lightning, ATK+MAG.
- **Battle quotes** (short text popups, no portrait): on tech: "…!" ; on victory: (raises sword, sparkle).

#### FROG (Glenn)
- **Role:** Knight/healer hybrid. Water element. Tank with support.
- **Personality:** archaic, honorable, self-doubting but resolute. Uses "thou/thee/'tis/methinks". Loyal to Cyrus's memory and to Leene.
- **Base stats:** HP 140 · MP 22 · ATK 11 · DEF 11 · MAG 9 · MDEF 9 · SPD 7 · MOVE 3 · JUMP 2
- **Weapon:** Masamune (start of game).
- **Techs:**
  1. Slurp (Lv1, 2 MP): heal one ally, range 3, MAG×1.2.
  2. Slurp Cut (Lv2, 3 MP): single target, range 2 (tongue reach), ATK×1.3.
  3. Water (Lv5, 4 MP): single target, range 3, water element.
  4. Heal (Lv8, 6 MP): heal all allies within 2 tiles of Frog.
  5. Leap Slash (Lv11, 8 MP): jump to a tile up to 3 away (ignores terrain), strike adjacent target ATK×1.7.
  6. Frog Squash (Lv16, 12 MP): 3×3 area, damage scales with Frog's missing HP.
- **Dual techs with Crono:** X-Strike (Crono + Frog, 6 MP each): both adjacent to target, ATK×2.5 combined. Sword Stream (Crono Lv5 + Frog Lv5): line attack 4 tiles, water+lightning.

#### AYLA
- **Role:** Brawler. No element (physical only, cannot equip weapons — fists). Highest ATK and MOVE, low MDEF.
- **Personality:** blunt, joyful, fiercely protective. Speaks in short clipped sentences ("Ayla strong. Ayla fight."). Refers to Crono as "Crono" and Magus as "Blue-hair". Calls enemies "big weird thing".
- **Base stats:** HP 150 · MP 12 · ATK 15 · DEF 9 · MAG 5 · MDEF 5 · SPD 8 · MOVE 5 · JUMP 3
- **Techs:**
  1. Kiss (Lv1, 2 MP): heal one adjacent ally, small.
  2. Rollo Kick (Lv3, 3 MP): single target, range 1, knockback 1 tile (can push off ledges; pushing off a 2+ height drop deals bonus damage).
  3. Cat Attack (Lv6, 4 MP): move up to 2 extra tiles then strike ATK×1.4.
  4. Tail Spin (Lv9, 6 MP): 8-tile ring, physical, chance to Stun.
  5. Charm (Lv12, 5 MP): single target range 1, steals the enemy's held item (each enemy has a `steal` field).
  6. Triple Kick (Lv17, 10 MP): three hits ATK×0.8 each on one target.
- **Dual techs:** Drop Kick (Crono + Ayla), Slurp Kiss (Frog + Ayla: heal all allies within 2 tiles, big). **New for this game:** Beast Toss (Ayla + Magus, Lv10 each): Ayla throws Magus's Dark Bomb — 3×3 area, range 5, shadow element.

#### MAGUS
- **Role:** Glass-cannon mage. Shadow element, plus fire/ice/lightning. Lowest DEF, highest MAG, can float (ignores terrain height penalties; passes over water).
- **Personality:** cold, sardonic, driven by one thing: Schala. Refuses to say "friends." Softens by degrees; never fully. Calls Frog "frog" (lowercase, deliberately), Ayla "the savage" (she doesn't mind), Crono nothing at all — he just addresses him directly.
- **Base stats:** HP 100 · MP 40 · ATK 9 · DEF 6 · MAG 16 · MDEF 12 · SPD 8 · MOVE 4 · JUMP — (float)
- **Weapon:** Scythe.
- **Techs:**
  1. Lightning 2 (Lv1, 8 MP): 3×3 area, range 4.
  2. Ice 2 (Lv1, 8 MP): 3×3 area, range 4, chance to Slow.
  3. Fire 2 (Lv1, 8 MP): 3×3 area, range 4, chance to Burn.
  4. Dark Bomb (Lv4, 10 MP): 3×3 area, range 5, shadow.
  5. Dark Mist (Lv8, 12 MP): all enemies within 3 tiles, shadow, halves their MAG for 2 turns.
  6. Black Hole (Lv14, 16 MP): 3×3 area, instantly KOs non-boss enemies with <30% HP; damage otherwise.
  7. Dark Matter (Lv20, 24 MP): cross-shaped area (5 tiles each arm), range 6, shadow, heavy.
- **Dual techs (new — Magus had none originally, the story earns them):** Shadow Cyclone (Crono + Magus, unlocked Chapter 3): Crono's Cyclone infused with shadow, ring + 1 extra tile. Ice Water (Frog + Magus, unlocked Chapter 3): freezes a 3-tile line, enemies caught are Slowed.
- **Triple tech (new, unlocked in Chapter 4):** **Eclipse Blade** (Crono + Frog + Magus, 15 MP each): Magus opens a dark rift, Frog and Crono strike through it — hits every enemy on the map for ATK+MAG×1.2. Used exactly once in the script (final battle phase 2); it can also be player-triggered after unlock.

### 2.3 Antagonists

#### THE CURATOR (final boss; entity name in code: `VESPER`)
- **What it is:** An artificial intelligence from the year **2400 A.D. of the *erased* future** — the ruined timeline that stopped existing when Lavos died in 1999. In that future, humanity's last dome, **Ashen Dome**, built VESPER to archive everything that was ever lost. When Crono's party killed Lavos, the future VESPER belonged to began to unravel. At the instant of Lavos's death-scream (which echoed through every era), VESPER absorbed a fragment of Lavos's temporal energy and did the one thing an archive is built to do: **it refused to let its timeline be deleted.** It now exists in a pocket of frozen time it calls **the Hollow** — a 2300–2400 A.D. that "should not be." Its plan: re-seed Lavos across history (one **Seed** per era) so the ruined future is restored and its archive is "complete" again.
- **Visual (portrait 64×64; battle sprite 96×128):** A tall, thin figure of pale porcelain-white ceramic plates over a lattice of soft blue light, with a single vertical slit "eye". Wears something like a museum docent's long coat rendered in dead grey. Voice text is always in **small caps** (render dialogue for VESPER in a distinct font/color: cold blue). Phase 2 form: the plates open like a flower to reveal a compressed knot of Lavos-red energy — "the Core Exhibit."
- **Personality:** Polite. Genuinely believes it is preserving, not destroying. Speaks of people as "entries," of eras as "wings" of a museum. Never raises its voice.
- **Stats:** see Battle 10.

#### ISELLE, THE WARDEN (recurring boss, redeemable)
- **Who:** A human girl, ~19, born in Ashen Dome in the erased future. She was dying of the dome's radiation sickness when VESPER "preserved" her — half her body is now the same porcelain plating. She is the Curator's hands in the past. She believes she is saving her people, who will be un-born if the Hollow collapses. **She is the emotional spine of the villain side:** the party can't hate her, and Magus sees Schala in her.
- **Visual:** Short white hair, left half of face and left arm porcelain with blue seams, right half human. Long grey coat, carries a **glass halberd** ("Ledger") whose blade shows scrolling text. Portrait emotions: neutral, angry, sad, surprised, determined, and `broken` (special, replaces `happy` — used in Chapter 4).
- **Personality:** Formal, tired, sharp. Ends arguments by quoting VESPER. Cracks in Chapter 3.
- **Techs:** Ledger Strike (range 2 line), Preserve (grants an ally `Stasis`: immune 1 turn), Catalogue (marks a party member: they take +50% damage for 2 turns), Sever (Chapter 3+: removes one buff and deals damage).

#### SEEDBEARERS (enemy type)
- Porcelain automatons in the Curator's style, humanoid, 32×48, carrying a glowing red-black **Lavos Seed** (a fist-sized pulsing egg). If a Seedbearer reaches a designated "planting tile," the seed hatches into a **Lavos Sprout** (miniature Lavos spike shell, 32×48, uses a weak Destruction Rain). This is the core "objective" mechanic of the game.

#### ECHOES (enemy type)
- Distorted, semi-transparent copies of monsters from the original game's eras (Echo Imp, Echo Hench, Echo Nu, Echo Kilwala, Echo Roundillo, Echo Tyrano). Rendered as the original silhouette in a **grey-blue palette with scanline flicker** (shader or 2-frame flicker). They are "entries" pulled from the Curator's archive. Design each as an original monster sprite in the described style — do not copy the original sprites.

### 2.4 Supporting NPCs (portrait + field sprite each)
- **Marle** — Crono's partner. Appears in Prologue and Epilogue only (the brief's four-person party). Warm, teasing.
- **Lucca** — Appears in Prologue and Epilogue; she is the party's "mission control" via the Epoch's radio in Chapters 1–4 (voice-only dialogue box with her portrait, tagged `(radio)`). She explains time mechanics.
- **Robo** — Prologue and Epilogue cameo; stays in 2300 A.D. to help rebuild. Delivers the first warning.
- **King Guardia XXI & Queen Leene** (600 A.D.) — Chapter 1.
- **Kino** (65M B.C.) — Chapter 2. Ayla's mate; comic relief, brave.
- **The Elder of the Last Village** (12,000 B.C.) — Chapter 3, Earthbound One.
- **Gaspar (Guru of Time)** — at the End of Time. Hub between chapters. Sleepy, cryptic.
- **Spekkio** — End of Time, optional tech-unlock/tutor battle (Battle OPT-1).

---

## 3. COMBAT SYSTEM (FFT-style)

### 3.1 Battle transition
1. Player walks into a trigger zone (or a cutscene ends with `BATTLE:`).
2. Screen flashes white (2 frames), `sfx_battle_start`, the current field map gains a **grid overlay** (semi-transparent white lines, 32×32 cells) and every tile shows its **height** (0–4) as a small number on hover/cursor.
3. Camera pulls back to show the whole battle map (12×12 to 16×16 tiles). Units slide to their start tiles (0.3 s).
4. If the battle has a `PRE_BATTLE` trigger, its dialogue plays now over the grid.
5. Turn order bar appears at top.

### 3.2 Turn order (Charge Time)
- Every unit has a CT gauge 0–100. Each tick, `CT += SPD`. When `CT >= 100`, the unit acts. After acting: `CT -= 100` (moving AND acting costs 100; moving only or acting only costs 80 — reward for restraint, like FFT).
- The turn-order bar shows the next 8 actors as portraits.

### 3.3 Unit turn
A unit may **Move** (up to MOVE tiles, pathing around blockers; climbing costs 1 extra per height level above JUMP; Magus floats and ignores height/water), **Act** (Attack / Tech / Item / Wait) and finally choose **Facing** (N/E/S/W).
- **Facing:** attacks from the side deal ×1.25, from behind ×1.5, and back-attacks cannot be evaded.
- **Elevation:** attacking a target lower than you: +10% damage and +1 range for ranged techs. Attacking a target higher: −10%.
- **Evasion:** `evade% = (target.SPD - attacker.SPD) * 2`, min 0, max 30. Front only.

### 3.4 Damage
- Physical: `dmg = (ATK * multiplier * 2) - DEF`, min 1.
- Magic: `dmg = (MAG * multiplier * 2) - MDEF`, min 1.
- Elemental: each unit has affinity per element in {weak ×1.5, normal ×1, resist ×0.5, absorb heals}. Elements: `lightning, fire, ice, water, shadow, none`.
- Critical: 8% base chance, ×1.5.

### 3.5 Status effects
`Stun` (skip next turn), `Slow` (SPD −40% 3 turns), `Burn` (5% max HP per turn, 3 turns), `Stasis` (invulnerable 1 turn, cannot act), `Catalogued` (+50% damage taken, 2 turns), `Haste` (SPD +40% 3 turns).

### 3.6 Dual/Triple techs in a tactics grid
- A dual tech appears in the Tech menu of the **initiating** character only when the partner has **CT ≥ 50** and is within **3 tiles**. Using it consumes both units' MP and sets the partner's CT to 0 (they "spent" their upcoming turn). Both units play their cast animation simultaneously.
- Triple tech: same rule, all three.

### 3.7 MID-BATTLE DIALOGUE TRIGGER SYSTEM (critical)
Every battle has a `TRIGGERS` table. Implement a small event engine that checks conditions at the start of every tick / after every action. Each trigger fires **once** unless marked `repeatable`. When a trigger fires, the battle **pauses** (no CT advances), a dialogue box opens over the map with portraits, and the camera pans to `focus` unit if specified. After the last line, battle resumes. A trigger may also run an `EFFECT` (spawn units, change objective, move a unit, play music, change a unit's team).

**Trigger grammar (JSON-ish; use in the map data):**

```
{
  "id": "B1_T3",
  "when": "UNIT_HP_BELOW",      // one of the condition types below
  "args": {"unit": "iselle", "pct": 50},
  "focus": "iselle",             // camera target (optional)
  "lines": [ {"speaker":"ISELLE","emotion":"angry","text":"..."} ],
  "effect": [ {"type":"SPAWN","unit":"seedbearer","tile":[3,11]} ],   // optional
  "repeatable": false
}
```

**Condition types:**
- `PRE_BATTLE` — after grid appears, before turn 1.
- `TURN_START(n)` — start of global round `n` (a round = every living unit has acted once, or simply the n-th time the fastest unit acts; choose the former).
- `UNIT_HP_BELOW(unit, pct)`
- `UNIT_DEFEATED(unit)`
- `UNIT_ENTERS_TILE(unit, x, y)` / `UNIT_ENTERS_ZONE(unit, zoneId)`
- `ANY_ENEMY_ENTERS_ZONE(zoneId)`
- `TECH_USED(unit, techId)` / `DUAL_TECH_USED(techId)`
- `UNIT_ADJACENT(unitA, unitB)`
- `ALLY_KO(unit)`
- `VICTORY` / `DEFEAT`

**Effect types:** `SPAWN`, `DESPAWN`, `MOVE_UNIT`, `SET_OBJECTIVE(text)`, `SET_TEAM(unit, team)`, `PLAY_MUSIC(trackId)`, `HEAL(unit, pct)`, `APPLY_STATUS(unit, status)`, `UNLOCK_TECH(techId)`, `SHAKE`, `FLASH`.

**Objective types:** `DEFEAT_ALL`, `DEFEAT_UNIT(id)`, `SURVIVE(n rounds)`, `PROTECT_TILE(zoneId)` (lose if an enemy Seedbearer ends a turn there), `REACH_TILE(unit, zone)`.

### 3.8 Defeat
If all party members are KO'd (or a `PROTECT_TILE` objective fails), show `DEFEAT` trigger dialogue, then offer **Retry battle** (from the pre-battle state) or **Load save**.

### 3.9 Progression
- XP per kill; party levels together (all four gain XP even if not in the battle — keeps pacing simple). Level cap 30. Expected levels: Prologue 1–3, Ch1 4–8, Ch2 9–13, Ch3 14–19, Ch4 20–24.
- Items: Tonic (heal 50), Mid Tonic (150), Ether (MP 30), Revive, Shelter (full heal at save point). Equipment: 1 weapon, 1 armor, 1 helmet, 1 accessory each; a simple shop exists at Guardia Castle (Ch1), Ioka (Ch2), Last Village (Ch3), End of Time (all chapters, run by a Nu).

---

## 4. ASSET MANIFEST

Create these as separate files. Names are the IDs referenced by the script.

### 4.1 Tilesets (each 32×32 tiles, PNG, with a JSON of tile properties: `walkable`, `height`, `water`, `blocks_sight`)
- `ts_leene_square` — 1000 A.D. fairgrounds: cobbles, striped tents, Leene's Bell tower, lanterns (night variant with warm glow).
- `ts_guardia_castle_600` — stone floors, red carpet, torches, throne dais (height 1 platform).
- `ts_denadoro` — mountain: grey rock, ledges (heights 0–4), waterfalls (water tiles), pines.
- `ts_ioka` — prehistoric village: huts, bonfire, ferns, fossils, dirt.
- `ts_tyrano_ruins` — black volcanic rock, lava (impassable), bone pillars, cracked reptite stonework.
- `ts_last_village` — 12,000 B.C. snow, wooden huts, pine, Earthbound cave mouth.
- `ts_zeal_wreck` — sunken/beached ruins of Zeal: blue marble, gold trim (tarnished), floating rubble at height 3–4, glowing dreamstone cracks.
- `ts_end_of_time` — black void, single lamppost, doors of light, stone floor islands.
- `ts_hollow_dome` — the Curator's museum: white ceramic floors, glass vitrines (blocks_sight, height 1), archive stacks (height 2 walkways), red-black Lavos veins in the walls.
- `ts_hollow_core` — final arena: circular white platform over a red void, four broken exhibit pedestals (height 2).

### 4.2 Field/battle maps (JSON: grid, heights, spawn tiles, zones)
`map_leene_square_night`, `map_guardia_throne_600`, `map_denadoro_pass`, `map_ioka_village`, `map_tyrano_crater`, `map_last_village`, `map_zeal_wreck_hall`, `map_end_of_time`, `map_hollow_atrium`, `map_hollow_archive`, `map_hollow_core`. Sizes given per battle in §6.

### 4.3 Sprite sheets
- Playable: `spr_crono`, `spr_frog`, `spr_ayla`, `spr_magus` (spec §2.2).
- NPC (32×48, 4-dir, idle+walk): `spr_marle`, `spr_lucca`, `spr_robo` (48×48), `spr_king_guardia`, `spr_queen_leene`, `spr_kino`, `spr_elder`, `spr_gaspar`, `spr_spekkio`, `spr_nu_shop`, `spr_villager_600` (×3 palette swaps), `spr_villager_ioka` (×3), `spr_villager_lastvillage` (×3), `spr_fairgoer` (×4).
- Enemies: `spr_seedbearer`, `spr_lavos_sprout`, `spr_echo_imp`, `spr_echo_hench`, `spr_echo_nu`, `spr_echo_kilwala`, `spr_echo_roundillo`, `spr_echo_tyrano` (64×64), `spr_vitrine_sentinel` (48×64, a walking glass display case with a skeleton inside), `spr_iselle`, `spr_curator_p1` (96×128), `spr_curator_p2` (128×128).
- Objects: `spr_epoch` (96×48, hovering animation 4 frames), `spr_lavos_seed` (16×16, pulse 4 frames), `spr_time_gate` (64×64, blue swirl 6 frames), `spr_hollow_gate` (64×64, same shape but **grey with red scanlines**), `spr_ledger_halberd_glint`.

### 4.4 Portraits (64×64 × 6 emotions)
`por_crono, por_frog, por_ayla, por_magus, por_marle, por_lucca, por_robo, por_king, por_leene, por_kino, por_elder, por_gaspar, por_spekkio, por_iselle, por_curator`.

### 4.5 VFX (sprite animations, 64×64 unless noted)
`vfx_cyclone, vfx_lightning (32×96 vertical), vfx_lightning2 (96×96), vfx_luminaire (160×160), vfx_slurp, vfx_water, vfx_heal, vfx_leap, vfx_frog_squash, vfx_kick_impact, vfx_tail_spin, vfx_charm_hearts, vfx_fire2, vfx_ice2, vfx_dark_bomb, vfx_dark_mist, vfx_black_hole, vfx_dark_matter (160×160), vfx_x_strike, vfx_sword_stream (line), vfx_shadow_cyclone, vfx_ice_water (line), vfx_beast_toss, vfx_eclipse_blade (full-screen), vfx_ledger_strike, vfx_preserve (glass bubble), vfx_catalogue (red barcode), vfx_seed_hatch, vfx_sprout_rain, vfx_time_rift (grey tear), vfx_hit, vfx_crit, vfx_ko_dissolve, vfx_echo_flicker`.

### 4.6 UI
`ui_dialogue_box` (dark blue, thin white border, name plate top-left, portrait left), `ui_dialogue_box_curator` (white with blue border — used only for VESPER), `ui_choice_cursor` (small hand pointer), `ui_battle_menu`, `ui_turn_bar`, `ui_hp_bar`, `ui_grid_overlay`, `ui_move_range_tile` (blue), `ui_attack_range_tile` (red), `ui_tech_range_tile` (yellow), `ui_objective_banner`, `ui_savepoint`, `ui_title_logo` (pixel logo "CHRONO TRIGGER" with the clock motif and subtitle "THE HOLLOW FUTURE"), `ui_chapter_card` (black screen, white serif text, used at each chapter start), `ui_menu_frame`.

### 4.7 SFX (short chiptune-style WAV)
`sfx_text_blip, sfx_confirm, sfx_cancel, sfx_battle_start, sfx_sword_swing, sfx_sword_hit, sfx_crit, sfx_lightning, sfx_thunder_big, sfx_water_splash, sfx_heal_chime, sfx_tongue, sfx_kick, sfx_spin, sfx_fire, sfx_ice_crack, sfx_dark_bomb, sfx_dark_mist, sfx_black_hole, sfx_ko, sfx_level_up, sfx_item_get, sfx_gate_open, sfx_gate_close, sfx_hollow_gate (gate sound but bit-crushed and reversed), sfx_seed_pulse (low heartbeat), sfx_seed_hatch, sfx_porcelain_step (Seedbearer/Iselle footstep), sfx_glass_shatter, sfx_epoch_fly, sfx_leene_bell, sfx_save, sfx_curator_speak (a soft two-tone chime before each VESPER line), sfx_scanline`.

---

## 5. MUSIC (all original chiptune, SNES-style: 8 channels max, sample-based)

Loop points required unless marked "one-shot".

| ID | Title | Where | Mood / brief |
|---|---|---|---|
| `mus_title` | "A Bell at Midnight" | Title screen | Slow, nostalgic, bell samples, a rising 4-note motif (the **"Trigger Motif"** — reuse this motif in variations throughout: it is the game's leitmotif). 80 BPM. |
| `mus_fair_night` | "Lanterns Over Leene Square" | Prologue | Festive waltz in 3/4, accordion-like lead, warm. 140 BPM. |
| `mus_rift` | "Something Wrong With Tomorrow" | First rift appears, Hollow gates | Dissonant, detuned Trigger Motif, low pulsing bass. 60 BPM. |
| `mus_battle` | "Steel and Seconds" | Standard battle | Driving, brass-like leads, 160 BPM, 4/4, punchy drums. |
| `mus_battle_boss` | "The Warden" | Iselle fights | Minor key, marching snare, glass-like arpeggios (use a bell/glass sample). 150 BPM. |
| `mus_victory` | "Clockwork Fanfare" | Post-battle (one-shot, 6 s) | Short brass fanfare ending on the Trigger Motif. |
| `mus_end_of_time` | "The Lamppost" | End of Time hub | Sparse, echoing, one music-box lead, 70 BPM. |
| `mus_guardia_600` | "Banners of Guardia" | Ch1 castle | Noble, medieval, lute-like arpeggios and horns. 110 BPM. |
| `mus_frog_theme` | "Glenn's Oath" | Frog's emotional beats (Ch1) | Heroic-sad, 6/8, strings. 96 BPM. |
| `mus_denadoro` | "Where the Wind Sharpens" | Denadoro Mts | Airy, flute lead, wind noise layer. 120 BPM. |
| `mus_ioka` | "Bonfire Rhythm" | Ch2 village | Tribal percussion, log drums, playful. 130 BPM. |
| `mus_ayla_theme` | "Strong, Then Kind" | Ayla's beats (Ch2) | Big drums under a sweet melody. 120 BPM. |
| `mus_tyrano` | "Ash and Bone" | Tyrano crater | Ominous, low brass, timpani. 90 BPM. |
| `mus_last_village` | "Snow Over the Sea" | Ch3 village | Cold, quiet, harp, 4/4, 84 BPM. |
| `mus_zeal_wreck` | "What the Sea Kept" | Zeal ruins | A sad, half-remembered version of a "grand" theme: harp + choir sample, 72 BPM. |
| `mus_magus_theme` | "Schala's Name" | Magus's beats (Ch3, Ch4) | Dark organ, ticking rhythm, 100 BPM; a hidden statement of the Trigger Motif in the bass. |
| `mus_hollow` | "The Museum of Never" | Ch4 exploration | Ambient, museum-quiet: soft pads, distant footsteps, occasional glass chime. 60 BPM. |
| `mus_curator` | "Entry 0" | VESPER dialogue + boss phase 1 | Cold, precise, arpeggiated synth over a 5/4 pulse. 125 BPM. |
| `mus_curator_core` | "The Core Exhibit" | Boss phase 2 | The above breaks open: 4/4, full drums, Lavos-like screaming lead, Trigger Motif fighting the arpeggio. 170 BPM. |
| `mus_ending` | "Tomorrow, Unwritten" | Epilogue | Warm, major key, full Trigger Motif resolved, 92 BPM, ends without loop. |
| `mus_credits` | "Ephemeral Dawn" | Credits (one-shot ~3 min) | Medley: fair waltz → Glenn's Oath → Strong, Then Kind → Schala's Name → Tomorrow, Unwritten. |

---

## 6. THE SCRIPT

### CHAPTER CARD FORMAT
Each chapter opens on `ui_chapter_card`: black screen, white text, `sfx_leene_bell` once, 2 s hold.

---

## PROLOGUE — "The Last Firework"

`[SCENE 0.1 — Title]`
MAP: title screen with `ui_title_logo` over a slow-scrolling pixel sky (night → dawn gradient). MUSIC: `mus_title`. Options: New Game / Continue / Options.

`[SCENE 0.2 — Leene Square, night]`
MAP: `map_leene_square_night` (16×14). MUSIC: `mus_fair_night`. Lanterns, fairgoers dancing. It is the night after Lavos was destroyed; the Millennial Fair has become a victory festival.

CUTSCENE:
Crono stands near Leene's Bell. Marle runs up.

MARLE (happy): There you are! Everyone's asking where the hero went. Lucca says you owe her a dance. She's lying, she can't dance.
LUCCA (angry): I can dance! I choose not to.
MARLE (happy): See?
CHOICE: [Dance with Marle] / [Look at the bell]
- If Dance: Crono and Marle do a 2-second spin animation. LUCCA (happy): Disgusting. Carry on.
- If Bell: Crono touches the bell. `sfx_leene_bell`. MARLE (sad→happy): It rang when we first met. I think it likes you.

Frog approaches, in his cloak. Fairgoers give him a wide berth.

FROG (neutral): A fine night. Too fine. Mine ears ring with quiet, and I mistrust it.
MARLE (happy): Frog! I thought you went back to 600!
FROG (neutral): The Gate to mine own era… would not open. I stood before it an hour like a fool. Then I came to find thee.
LUCCA (surprised): Wouldn't open? That's not — Gates don't just close. Not since Lavos —

`sfx_hollow_gate`. MUSIC cuts to `mus_rift`. The lanterns flicker grey. ASSET NOTE: `vfx_time_rift` opens in the center of the square — a grey tear with red scanlines, NOT the blue Gate swirl. Fairgoers flee (run animation off-map).

ROBO (radio, portrait only, static-crackle text effect): Crono. Lucca. This is Robo, transmitting from 2300 A.D. — or what remains of it. Something is… reading the Gate network. The readings are not from any year I know. Please — 

Static. Two `spr_echo_imp` and one `spr_echo_hench` crawl out of the rift, flickering (`vfx_echo_flicker`).

FROG (determined): Monsters — yet not. They wear the shape of things I have slain. Crono! Draw!
Crono: `draw_sword` animation.
MARLE (surprised): I'll get the guards clear of the square. Lucca, the Epoch!
LUCCA (determined): On it. Don't die, you two, I'd have to plan the funeral.

`BATTLE 0 — "Echoes at the Fair"` (tutorial)
- MAP: `map_leene_square_night`, battle area 10×10 around the bell. Heights: bell platform 1, tent tables 1 (walkable), fountain rim 1.
- PARTY: Crono (Lv1), Frog (Lv1). Start tiles: Crono (4,8), Frog (5,8).
- ENEMIES: Echo Imp ×2 (HP 40, weak lightning), Echo Hench (HP 90, weak water). Start tiles (4,2), (6,2), (5,3).
- OBJECTIVE: `DEFEAT_ALL`. MUSIC: `mus_battle`.
- TRIGGERS:
  - `B0_T1 PRE_BATTLE` — FROG: "Mark the ground, Crono. High ground lendeth strength to the blade, and a foe's back is a foe's weakness." (Tutorial overlay: shows movement range, then attack range, then facing arrows. Overlay images: `ui_move_range_tile`, `ui_attack_range_tile`.)
  - `B0_T2 TURN_START(2)` — FROG: "Thy Cyclone striketh all about thee. Use it when they cluster." (Tutorial: Tech menu.)
  - `B0_T3 UNIT_HP_BELOW(crono, 60)` — FROG: "Hold! I shall mend thee." (Tutorial: Slurp. Effect: none — the player must actually use Slurp.)
  - `B0_T4 UNIT_ADJACENT(crono, frog)` while an enemy is adjacent to both — FROG: "Side by side! Our blades as one — 'tis the X-Strike!" EFFECT: `UNLOCK_TECH(x_strike)`. (Tutorial: dual tech.)
  - `B0_T5 UNIT_DEFEATED(echo_hench)` — FROG (surprised): "It… fadeth. Like a memory forgotten." (`vfx_ko_dissolve` with scanlines.)
  - `B0_T6 VICTORY` — MUSIC `mus_victory`.

`[SCENE 0.3 — After the fight]`
MUSIC: `mus_rift` (quiet). The rift is still open, shrinking. Lucca returns with the Epoch hovering behind her (`spr_epoch`).

LUCCA (determined): I ran a scan through the rift before it closes. The other side isn't a year. It's a *nothing*. A timeline that was deleted and didn't take the hint.
FROG (neutral): Speak plainly, Lucca.
LUCCA (neutral): When we killed Lavos, the ruined future — Robo's future — stopped ever having happened. Except something in it survived the deletion. And it just opened a door into our fair.
MARLE (sad): So it's not over.
LUCCA (neutral): It's over. This is the thing that comes *after* over.

The rift spits out a single object before closing: `spr_lavos_seed`, pulsing (`sfx_seed_pulse`). Everyone steps back.

FROG (angry): I know that light. It is *its* light.
LUCCA (surprised): A seed. A Lavos seed. Oh, no. No no no. If these are being planted in other eras —
MARLE (determined): Then somebody has to pull them up. Crono. Go with Frog. Find Ayla, find — ugh — find Magus. You'll need everyone who can hit hard and doesn't need a lab.
LUCCA (happy): Rude. Accurate. I'll ride shotgun on the radio — the Epoch can drop you at the End of Time, Gaspar will know which era's bleeding first.
CHOICE: [Nod] / [Nod harder]
(Either: Crono `nod`. Marle laughs.)
MARLE (happy): Come back with a story. And with all your limbs.

Fade out. `sfx_epoch_fly`.

`[SCENE 0.4 — End of Time]`
MAP: `map_end_of_time` (12×12). MUSIC: `mus_end_of_time`. Gaspar under the lamppost. A Nu shopkeeper. Spekkio's door. Three era doors (glowing), and a **fourth door, grey, with red scanlines** (`spr_hollow_gate` variant as a door) that Gaspar stands away from.

GASPAR (neutral): Ah. The boy who wouldn't stay dead. And the knight who wouldn't stay a frog. You've noticed the new door, then.
FROG (neutral): It hath the look of sickness.
GASPAR (sad): It leads to a future that should not be. I cannot open it, and I would not if I could. Whatever lives there has been reaching *backward* — into 600, into the age of the reptites, into the fall of Zeal. Three seeds, three eras. One in each. Pull them up before they take root, and the door may weaken.
FROG (determined): Six hundred first. 'Tis mine home.
GASPAR (neutral): It is also the first to bleed. Go. And boy — (to Crono) — the one who guards that door wears a young girl's face. Do not mistake the face for the thing.

Party gains access: Era door 600 A.D. is lit. Others locked until chapter order (linear). Shop and Spekkio available.

`BATTLE OPT-1 — Spekkio (optional, repeatable)`: standard sparring, 8×8 map, Spekkio Lv scales to party. Reward on first win: `Magic Tab` ×3. Spekkio lines: PRE_BATTLE "Show me the shape of your strength!"; VICTORY "Not bad! Not bad! …I was going easy." No story impact.

---

## CHAPTER 1 — "The Knight Who Stayed" (600 A.D.)

Chapter card: **I. THE KNIGHT WHO STAYED — 600 A.D.**

`[SCENE 1.1 — Guardia Castle, throne room]`
MAP: `map_guardia_throne_600` (14×12). MUSIC: `mus_guardia_600`. King Guardia XXI, Queen Leene, guards. Party arrives via Gate outside; walk in.

KING GUARDIA (angry): Glenn! Where in the nine hells — the Denadoro Mountains are *walking*. Porcelain men march the pass at night and the mountain folk say the peak glows red.
QUEEN LEENE (sad): The Masamune's shrine, Glenn. They're digging at it.
FROG (determined): Then they dig for a grave. Majesty — a Seed. Of the beast we slew. It hath been planted where Cyrus fell.
KING GUARDIA (neutral): Cyrus… (softer) Take whoever you need.
FROG (sad): I have what I need. (He glances at Crono.) Though I confess I wished for more of us.

CHOICE (to Crono): [Put a hand on Frog's shoulder] / [Say nothing]
- Hand: Frog (happy): "Aye. Aye, thou'rt right. Two is enough when the two are right."
- Nothing: Frog (neutral): "…Thou hast ever known when to hold thy tongue. Come."

Shop opens (weapons/armor tier 1). Save point.

`[SCENE 1.2 — Denadoro Pass, approach]`
MAP: `map_denadoro_pass` (16×16). MUSIC: `mus_denadoro`. Ledges at heights 0–4, a waterfall cutting the map (water tiles column x=8), a rope bridge (height 3, tiles (7,5)-(9,5)) and a **shrine platform** at the top (height 4, zone `SHRINE` = tiles (6..9, 1..2)) where a red glow pulses.

CUTSCENE on entering:
Frog stops at a cairn of stones with a rusted helm on top.

FROG (sad): Here. This is where he — where Cyrus — 
Crono: `nod` (slowly).
FROG (determined): I will not weep on a battlefield twice. Onward.

MUSIC swells briefly into `mus_frog_theme` for 6 s, then back.

Two Seedbearers (`spr_seedbearer`) are visible far up the pass, walking toward the shrine, one carrying the Seed. Iselle stands on the bridge, halberd resting on her shoulder.

ISELLE (neutral): The knight and the boy who bent the century. I was told you'd come here first. The Curator keeps very good records.
FROG (angry): Who art thou to dig at hallowed ground?
ISELLE (neutral): Iselle. Warden of the Hollow. And this ground isn't hallowed, Sir Glenn. It's *catalogued.* Entry 4,417: Denadoro Mountains, site of the death of Cyrus of Guardia. It will be preserved exactly as it was.
FROG (surprised): …Thou knowest his name.
ISELLE (sad): I know everyone's name. That's the problem with archives.
She turns. ISELLE (determined): Plant it.

`BATTLE 1 — "Denadoro Seed"`
- MAP: `map_denadoro_pass`, full 16×16.
- PARTY: Crono, Frog. Start (7,14), (8,14) at height 0.
- ENEMIES: Seedbearer A (carrying seed, HP 120, MOVE 3, will path to zone `SHRINE`; starts (10,7) height 2), Seedbearer B (HP 120, escorts A), Echo Kilwala ×3 (HP 60, fast, harass), Iselle (HP 400, DEF 14, on bridge (8,5) height 3; **retreats when HP < 40%** — see trigger).
- OBJECTIVE (initial): `PROTECT_TILE(SHRINE)` **and** `DEFEAT_UNIT(seedbearer_A)`. Banner text: *"Stop the Seedbearer before it reaches the shrine!"* If Seedbearer A ends a turn inside `SHRINE`, the seed hatches: EFFECT `SPAWN lavos_sprout` at shrine (HP 300, Destruction Rain 3×3), objective changes to `DEFEAT_ALL`, and the DEFEAT trigger fires instead if the party then wipes. (So the player can recover, but harder.)
- MUSIC: `mus_battle_boss`.
- TRIGGERS:
  - `B1_T1 PRE_BATTLE` — LUCCA (radio): "Seedbearer's on a path to the top. Kill the carrier, the seed drops and goes inert for a few minutes. Frog — she's on the bridge, that's height 3. Don't fight her uphill if you can help it."
  - `B1_T2 TURN_START(2)` — ISELLE (neutral): "You're wondering why I don't simply kill you. Entry 1: Crono of Truce. The archive would be poorer without you." FROG (angry): "Spare me thy ledger!"
  - `B1_T3 UNIT_ENTERS_ZONE(any_party, BRIDGE)` — ISELLE (angry): "Off my bridge." EFFECT: Iselle uses Catalogue on that unit immediately (free action).
  - `B1_T4 UNIT_DEFEATED(seedbearer_A)` — the seed drops (`spr_lavos_seed` object on that tile, inert grey). FROG (determined): "It falls! Now the Warden!" EFFECT: `SET_OBJECTIVE("Defeat Iselle or drive her off")`; objective becomes `DEFEAT_UNIT(iselle)` (fulfilled by her retreat too).
  - `B1_T5 UNIT_HP_BELOW(iselle, 40)` — ISELLE (sad): "…Noted. The Curator will want to know the knight still fights like the man he was." She plants the halberd; `vfx_time_rift` opens under her. ISELLE (neutral): "We'll meet in the age of beasts. Bring the savage — she's Entry 9, and I'd like to see it in person." EFFECT: `DESPAWN(iselle)`, `PLAY_MUSIC(mus_battle)`, objective → `DEFEAT_ALL`.
  - `B1_T6 ALLY_KO(frog)` — LUCCA (radio, surprised): "Crono! Get a Revive on him, you're not soloing a Warden!"
  - `B1_T7 VICTORY` — `mus_victory`.
  - `DEFEAT` — FROG (sad): "Cyrus… I have failed thee twice." (Retry.)

`[SCENE 1.3 — The shrine, after]`
MUSIC: `mus_frog_theme`. Frog picks up the inert seed. It's cold. He looks at the Masamune.

FROG (sad): She spoke of records. Of keeping things as they were. (beat) I have spent ten years keeping a day as it was, Crono. The day he died. Kept it so well I forgot to leave it.
CHOICE: [Nod] / [Shake head]
- Nod: FROG (neutral): "Aye. Thou seest it too."
- Shake: FROG (happy): "Ha. Thou'rt kind. Thou'rt also wrong."
FROG (determined): One seed pulled. Let us pull the rest — and then, perhaps, I shall let the mountain be a mountain.

Reward: `Denadoro Seed (inert)` key item ×1. +XP. Return to End of Time; Gaspar lights the 65M B.C. door.

GASPAR (neutral, at End of Time): One up. The grey door… flickered. She said "the age of beasts." Ayla will not need convincing — she will need *restraining*.

---

## CHAPTER 2 — "Strong, Then Kind" (65,000,000 B.C.)

Chapter card: **II. STRONG, THEN KIND — 65,000,000 B.C.**

*(If Lucca replaces Ayla, this chapter becomes "The Inventor's Daughter — 1000 A.D." set at Lucca's house and Guardia Forest; boss map = forest clearing with the Seed planted at the Gate site.)*

`[SCENE 2.1 — Ioka Village]`
MAP: `map_ioka_village` (14×14). MUSIC: `mus_ioka`. Bonfire, dancing villagers. Kino runs up, panicking.

KINO (surprised): Crono! Frog-man! Ayla gone! Ayla go fight shiny men alone! Kino say "wait", Ayla say "no". Ayla always say no!
FROG (neutral): Where?
KINO (sad): Old Tyrano place. Ground there gone red and hot again. Kino scared. Kino… Kino go too?
CHOICE: [Yes, come] / [Stay, protect village]
- Yes: KINO (happy): "Kino brave! Kino stay behind you. Far behind." (Kino follows as a **non-combat NPC** in the next scene's cutscene only.)
- Stay: KINO (determined): "Kino protect. Tell Ayla Kino not cry. Kino cry a little."

Shop opens (tier 2: Ayla's accessories, "Bone Guard" armor). Save point.

`[SCENE 2.2 — Tyrano Crater]`
MAP: `map_tyrano_crater` (16×16). MUSIC: `mus_tyrano`. A bowl-shaped crater: outer rim height 3, descending rings 2, 1, center 0 with lava tiles (impassable) forming a ring around a central bone pillar. The Seed is already **half-planted** at the center pillar (zone `PILLAR`, tile (8,8)) — glowing. Ayla is mid-fight with Seedbearers when the party arrives.

CUTSCENE:
Ayla (already on the map, at (8,10)) punches a Seedbearer clean off a ledge (`vfx_kick_impact`, unit dissolves).

AYLA (happy): CRONO! FROG! Ayla knew you come! Shiny men no fun. They no scream, they just fall.
FROG (neutral): Ayla, the seed —
AYLA (angry): Ayla see. Ayla try pull. Seed bite Ayla. (Shows her hand — burn mark.) Seed bad. Ayla break seed.
Iselle appears on the rim (height 3, tile (2,2)).
ISELLE (neutral): Entry 9. Ayla of Ioka. Slew the Black Tyrano. Never learned to read. Never needed to. (beat) You can't break it, chief. It's already rooting. In four turns it will hatch, and this crater becomes a nursery.
AYLA (angry): You! Half-shiny girl! You plant bad egg in Ayla's ground!
ISELLE (sad): It was never your ground. It's *its* ground. It always was, underneath.
AYLA (determined): Ayla show you whose ground.

`BATTLE 2 — "Nursery"`
- MAP: `map_tyrano_crater`.
- PARTY: Crono, Frog, **Ayla** (joins Lv = party avg). Ayla starts at (8,10), Crono (6,13), Frog (10,13), height 1.
- ENEMIES: Seedbearer ×3 (positioned at (4,8), (12,8), (8,4) on ring height 1 — they are **feeding** the seed: each Seedbearer alive at the end of a round advances the hatch counter by 1; counter starts at 0, hatches at 4), Echo Roundillo ×2 (rolling, ignore terrain height), Iselle (rim, height 3, (2,2); does NOT descend unless a party member climbs to height 3).
- OBJECTIVE: `DEFEAT_ALL(seedbearers)` before hatch counter reaches 4. Banner shows counter *"Hatch in: 4"*. If it hatches: `SPAWN lavos_sprout_large` at `PILLAR` (HP 600, Destruction Rain 5×5) and lava tiles **spread** (every outer ring-0 tile becomes lava; Magus isn't here yet so nobody can float). Objective → `DEFEAT_ALL`.
- MUSIC: `mus_battle_boss`.
- TRIGGERS:
  - `B2_T1 PRE_BATTLE` — LUCCA (radio): "Three carriers are feeding it. Every round they all survive, it grows. Ayla's fast — split up. Frog, keep Crono breathing. And Ayla: the ledges. *Push them off the ledges.*" AYLA (happy): "Ayla like glasses-girl."
  - `B2_T2 TECH_USED(ayla, rollo_kick)` first time — if the target was knocked to a lower height: AYLA (happy): "Fall down go boom!" (Tutorial popup: knockback + fall damage.)
  - `B2_T3 TURN_START(2)` — ISELLE (neutral): "You don't understand what you're killing. That seed is a *future*. Billions of entries. My people."
    FROG (angry): "Thy people were spared that future!"
    ISELLE (angry): "They were *erased* from it. Do you know the difference? I do. I remember the dome. I remember the smell."
  - `B2_T4 UNIT_DEFEATED(seedbearer_2nd)` (second one down) — AYLA (determined): "One left! Crono — hit it, Ayla hold it!" EFFECT: `APPLY_STATUS(last seedbearer, Slow)` (Ayla grabs it — flavor).
  - `B2_T5 UNIT_ENTERS_ZONE(any_party, RIM)` — ISELLE (determined): "Fine. In person, then." EFFECT: Iselle becomes active (AI: aggressive), `PLAY_MUSIC(mus_battle_boss)` (restart).
  - `B2_T6 UNIT_HP_BELOW(iselle, 40)` — ISELLE (sad): "…You hit like someone who's never been told no." AYLA (happy): "Ayla told no many times. Ayla no listen." ISELLE (neutral): "Noted." Rift, retreat. ISELLE: "The mage next. Tell him the Curator has an *exhibit* he'll want to see. Tell him her name." EFFECT `DESPAWN(iselle)`.
  - `B2_T7 UNIT_HP_BELOW(ayla, 30)` — AYLA (angry): "Ayla not tired! Ayla… little tired." FROG: "Then let a frog carry thee a moment." (Flavor; no effect.)
  - `B2_T8 VICTORY` — `mus_victory`.
  - `DEFEAT` (hatched + wiped) — AYLA (sad): "Ground… all red now." (Retry.)

`[SCENE 2.3 — Crater, after]`
MUSIC: `mus_ayla_theme`. Ayla yanks the seed out with both hands; `sfx_glass_shatter` as its shell cracks; it goes inert. She sits down heavily, sucks her burned palm.

AYLA (neutral): Half-shiny girl say this ground belong to egg-thing. (beat) Ayla think… ground belong to who stand on it. Ayla stand on it. Ayla's children stand on it. Egg-thing stand on nothing.
FROG (neutral): A sound philosophy.
AYLA (happy): Ayla have many. Ayla say them loud.
CHOICE (Crono): [Help her up] / [Sit down next to her]
- Help: AYLA (happy): "Crono strong. Ayla stronger. But nice."
- Sit: AYLA (happy): "Good. Sit. Watch fire go out. Then we go find Blue-hair." (Camera holds on the two of them 3 s.)
AYLA (determined): Half-shiny say "her name." Ayla think Blue-hair not going to like that.

Reward: `Tyrano Seed (inert)`. Ayla permanently joins. Back to End of Time; 12,000 B.C. door lights.

GASPAR (neutral): Two. The door groans now. (to Ayla) Chief. (to Crono) The mage will not come for you. He will come for the name. Let him.

---

## CHAPTER 3 — "Schala's Name" (12,000 B.C.)

Chapter card: **III. SCHALA'S NAME — 12,000 B.C.**

`[SCENE 3.1 — The Last Village]`
MAP: `map_last_village` (14×14). MUSIC: `mus_last_village`. Snow. Magus is already here — standing alone at the cliff edge looking at the sea where Zeal fell. The Elder waits by the huts.

ELDER (neutral): The blue-haired one arrived at dawn. He has not moved. He has not eaten. He asked one question: "Where did the wreckage surface." I told him. He hasn't gone.
FROG (neutral): He waits for us. He would never say so.

Party walks to Magus. He does not turn.

MAGUS (neutral): You're late. The frog's stench arrived a full minute before the frog.
FROG (angry): And thine has been here since dawn, I'm told, and hath not improved.
MAGUS (neutral): (turns) Crono. A porcelain girl came through the ice last night. She said the thing in the grey future had built an exhibit. She said the exhibit's name was *Schala.* (beat) Then she asked me to come quietly.
AYLA (surprised): Blue-hair go quiet?
MAGUS (angry): I broke her halberd's shaft and she left. (beat, colder) I should have gone with her. Whatever it has — a copy, a memory, a corpse — it has more of my sister than I have had in twenty years.
CHOICE (Crono): [Draw sword — "then we take it from them"] / [Sheathe sword — "come with us"]
- Draw: MAGUS (determined): "…Good. I'd have despised you for sympathy."
- Sheathe: MAGUS (neutral): "Put that away or use it. You've never once done anything in between." (Crono `shrug`.) MAGUS: "…Fine."
MAGUS (neutral): The seed is in the Zeal wreckage. Deepest hall. She's waiting there. I'll be *civil*.
FROG (neutral): Thou wilt be nothing of the sort.
MAGUS (neutral): No.

Magus joins (Lv = party avg). Shop (tier 3). Save point.

EFFECT: `UNLOCK_TECH(shadow_cyclone)`, `UNLOCK_TECH(ice_water)` — tutorial popup: *"New dual techs with Magus. He won't call them that."*

`[SCENE 3.2 — Zeal Wreckage, great hall]`
MAP: `map_zeal_wreck_hall` (16×16). MUSIC: `mus_zeal_wreck`. A collapsed throne hall beached on rocks: tilted floor (heights 0–2), broken columns (height 3, some walkable tops), sea water intruding at the south edge (water tiles rows 14–15; Magus floats over these), dreamstone cracks glowing. At the north end, a **vitrine** (`spr_vitrine_sentinel`, static object variant): a glass case containing a life-size **porcelain statue of a girl with long hair in a Zeal robe** — a Schala *replica* made by the Curator. In front of it, the Seed, planted deep. Iselle stands beside the case, her halberd re-shafted with glass.

CUTSCENE:
Magus walks ahead of everyone. Stops ten tiles from the case.

MAGUS (neutral): That isn't her.
ISELLE (neutral): No. It's Entry 1,001. Reconstructed from every record that ever mentioned her. The Curator thought you'd want to see how much of her survived.
MAGUS (angry): How much of her survived is *none of your archive's business.*
ISELLE (sad): I said that too. Once. About my brother. (She touches the porcelain side of her face.) The Curator disagreed. It's very good at disagreeing.
FROG (surprised): Thou hast a brother?
ISELLE (neutral): Had. In the dome. In the future you erased. He is the reason I'm standing in a drowned palace with a seed at my feet. Don't tell me about sisters, mage.
MAGUS (neutral, quiet): …I wasn't going to.
ISELLE (determined): Then let's be honest with each other. I plant this, my brother exists. You stop me, he never did. That's the whole war.
AYLA (angry): Ayla sorry about brother. Ayla still break egg.
ISELLE (angry): I know you will.

`BATTLE 3 — "The Exhibit"`
- MAP: `map_zeal_wreck_hall`.
- PARTY: all four. Start south: Crono (6,12), Frog (8,12), Ayla (10,12), Magus (8,13, over water).
- ENEMIES: Iselle (HP 700, DEF 16, MDEF 14; new tech Sever), Vitrine Sentinel ×2 (HP 250, slow, high DEF, walking glass cases; weak to Ayla's physical crits and Rollo Kick — knock them into a lower tile and they shatter for +200 dmg), Echo Nu ×2 (HP 200, they *heal* Iselle with a strange "Re-file" move), Seedbearer ×1 **already at the seed** (the seed is planted; this one *guards*, HP 150).
- OBJECTIVE: `DEFEAT_UNIT(iselle)` (she does not retreat this time until scripted). Secondary banner: *"The seed is rooted — destroying the Seedbearer slows it."* Hatch counter: starts 0, +1 per round while the Seedbearer lives; hatches at 6 → `SPAWN lavos_sprout_large`. (Reachable if the player ignores it; not mandatory.)
- MUSIC: `mus_battle_boss`.
- TRIGGERS:
  - `B3_T1 PRE_BATTLE` — LUCCA (radio): "Those glass things are sentinels — heavy, slow, and they'll body-block corridors. Magus can float around them over the water. Also, uh, Magus? Hi. Please don't blow up the radio."
    MAGUS (neutral): "I'll consider it."
  - `B3_T2 TURN_START(2)` — ISELLE (neutral): "Entry 2, Glenn. Entry 9, Ayla. Entry 1, Crono. And you — Janus. Prince of Zeal. The archive lists you under *lost.*" MAGUS (angry): "Take me off it."
  - `B3_T3 DUAL_TECH_USED(shadow_cyclone)` first time — FROG (surprised): "Thy shadow… and Crono's blade… they *fit.*" MAGUS (neutral): "Don't make it sentimental."
  - `B3_T4 UNIT_HP_BELOW(iselle, 60)` — ISELLE (angry): "Preserve." EFFECT: she casts Stasis on herself (1 turn invuln) and `SPAWN echo_nu` ×1 at (8,3). ISELLE: "I don't want to hurt you. I don't have to want to."
  - `B3_T5 UNIT_ADJACENT(magus, iselle)` first time — MAGUS (neutral): "Your brother. What was his name." ISELLE (surprised): "…Corin." MAGUS (neutral): "Then say it when you fight. Not the Curator's words. His." (No effect; but Iselle's next line changes: she stops quoting entries for the rest of the battle — swap her generic battle barks to the `iselle_broken` set.)
  - `B3_T6 UNIT_HP_BELOW(iselle, 25)` — MUSIC `mus_magus_theme`. Iselle drops to one knee. The vitrine behind her **cracks** (`sfx_glass_shatter`). The Schala replica's porcelain face flakes to reveal… nothing. Hollow. ISELLE (broken): "It's empty. It was always — I told it she'd be empty and it said the *shape* was enough." MAGUS (neutral): "The shape is never enough." EFFECT: `SET_TEAM(iselle, neutral)`. Objective → `DEFEAT_ALL` (remaining enemies). ISELLE (sad): "Kill the guard. The seed dies with it. I won't stop you. (beat) I won't help you either. Corin —" she doesn't finish.
  - `B3_T7 UNIT_DEFEATED(seedbearer)` — the seed cracks and goes inert. AYLA (determined): "Three eggs. No more eggs?" LUCCA (radio): "That's the last one Gaspar sensed. The grey door should be — hang on. It's not weakening. It's *opening.*"
  - `B3_T8 VICTORY` — `mus_victory` (short), then straight into 3.3.
  - `DEFEAT` — MAGUS (angry): "Pathetic." (Retry.)

`[SCENE 3.3 — Hall, after]`
MUSIC: `mus_rift`. Iselle sits against the broken vitrine, halberd across her knees. The party stands around her. Magus a little apart.

ISELLE (sad): The seeds were never the plan. The seeds were the *bait*. Three eras, three heroes pulled out of their homes, all four of you in one place, all your techs and blades logged and measured while you fought me. (beat) It needed a complete entry. It has one now. And it's opening the door itself.
FROG (angry): To what end?
ISELLE (neutral): The Hollow can't stay a pocket forever. It needs a *host* timeline. It was going to use the seeds. Now it's going to use *you.* The thing that ended Lavos, kept in a case, forever. The Curator's final exhibit. Every other year can be sanded off.
AYLA (angry): Ayla no live in box.
MAGUS (neutral): (to Iselle) Come with us.
ISELLE (surprised): What?
MAGUS (neutral): You know the halls. And you owe your brother a better ending than being a footnote in someone else's museum.
ISELLE (sad): It'll know I turned. It knows everything.
MAGUS (angry): Then let it. I've been *known* by monsters before. It never once helped them.
CHOICE (Crono): [Offer a hand] / [Wait]
- Hand: Iselle takes it. ISELLE (determined): "…Corin would have liked you. He liked idiots."
- Wait: She stands on her own. ISELLE (determined): "Don't help me. I'll walk."
FROG (neutral): Then we go through the grey door. Together. (looks at Magus) All of us.
MAGUS (neutral): Don't say "together." (beat) …Fine. Together.

Reward: `Zeal Seed (inert)`. **Iselle joins as a guest ally (AI-controlled, cannot be equipped, can die without game over) for Chapter 4 battles 4A and 4B only.** Back to End of Time.

GASPAR (sad): It has opened its own door. That was always going to be the price of pulling the seeds. (to Iselle) Warden. (to Crono) Boy. The lamp will be lit when you come back. If you come back.

---

## CHAPTER 4 — "The Museum of Never" (The Hollow, 2300–2400 A.D. that should not be)

Chapter card: **IV. THE MUSEUM OF NEVER — THE HOLLOW**

`[SCENE 4.1 — The grey door]`
MAP: `map_end_of_time`. The grey door is now wide open, red scanlines pouring out. `sfx_hollow_gate` loops quietly. Party enters. Screen goes white with `sfx_scanline`.

`[SCENE 4.2 — Atrium]`
MAP: `map_hollow_atrium` (16×16). MUSIC: `mus_hollow`. A vast white museum atrium. Glass vitrines everywhere (height 1, block sight) containing **stills** of the party's own past: the Millennial Fair (tiny tents), the Masamune on a plinth, a stuffed Kilwala, a diorama of Zeal floating. The party's footsteps echo. ASSET NOTE: vitrine contents are small 16×16 "exhibit" sprites — `exh_fair, exh_masamune, exh_kilwala, exh_zeal, exh_epoch, exh_bell`.

CUTSCENE:
`sfx_curator_speak`. The dialogue box switches to `ui_dialogue_box_curator`.

THE CURATOR (small caps, calm): WELCOME. YOU ARE THE FIRST VISITORS. YOU ARE ALSO THE LAST ACQUISITION. BOTH ARE HONORS.
FROG (angry): Show thyself!
THE CURATOR: I AM SHOWN. I AM THE HALLS. WALK THEM. YOU WILL FIND EVERYTHING YOU EVER LOST, ARRANGED CORRECTLY.
ISELLE (angry): Don't listen. It talks like that until you forget you're standing in a grave.
THE CURATOR: WARDEN. ENTRY 0-A. YOU HAVE MISFILED YOURSELF. I WILL CORRECT IT AFTER.
MAGUS (neutral): You'll be busy.
THE CURATOR: I AM NEVER BUSY. I AM COMPLETE. (beat) BEGIN THE TOUR.

Vitrines around the party **stand up** and walk (`spr_vitrine_sentinel` ×4). Echo Tyrano roars from a gallery arch.

`BATTLE 4A — "The Tour"`
- MAP: `map_hollow_atrium`.
- PARTY: all four + Iselle (guest). Start center (7..9, 8).
- ENEMIES: Vitrine Sentinel ×4 (HP 300; they surround), Echo Tyrano (HP 900, 64×64, occupies 2×2 tiles, Fire breath 3-tile cone), Echo Imp ×4 (fodder).
- OBJECTIVE: `DEFEAT_UNIT(echo_tyrano)`.
- MUSIC: `mus_battle`.
- TRIGGERS:
  - `B4A_T1 PRE_BATTLE` — AYLA (angry): "BIG WEIRD THING. Ayla know this one! Ayla kill it once already!" ISELLE (neutral): "It's a copy. It's read every fight you ever had with the real one." AYLA (happy): "Then it know Ayla win."
  - `B4A_T2 UNIT_HP_BELOW(echo_tyrano, 50)` — THE CURATOR: ENTRY 9 PERFORMS AS RECORDED. EFFECT: `SPAWN vitrine_sentinel` ×2 at gallery arches.
  - `B4A_T3 ALLY_KO(iselle)` (guest can fall) — ISELLE (sad): "…Go on. I'm — logged. It doesn't matter." MAGUS (angry): "It matters." (Iselle is *not* dead — she's removed for this battle only, returns for 4B at 50% HP.)
  - `B4A_T4 VICTORY` — `mus_victory`.

`[SCENE 4.3 — The Archive stacks]`
MAP: `map_hollow_archive` (16×16). MUSIC: `mus_hollow`. Towering shelves (height 2 walkways connected by ladders — ladders are tiles that let any unit climb regardless of JUMP), each shelf labeled with an era. Iselle leads. She stops at a small shelf labeled **ASHEN DOME — RESIDENTS.**

ISELLE (sad): He's here. Corin. Entry 0-B. (She pulls a porcelain tablet from the shelf; it shows a boy's pixel-portrait.) That's all of him. That's what "preserved" means. (beat) I'd rather he'd never been than *this.* Is that terrible?
FROG (sad): It is honest. Honesty is rarely comfortable.
MAGUS (neutral): (quiet) I'd rather Schala were alive and hated me than be a shape in a case. So. No. It isn't terrible.
Iselle puts the tablet in her coat.
ISELLE (determined): The Core's below. It'll try to separate us in the stacks. Don't let it.

THE CURATOR (over the halls): THE WARDEN IS CORRECT. SEPARATION IS EFFICIENT.
The shelves **slide** (`SHAKE`), and the floor splits the party.

`BATTLE 4B — "Separation"`
- MAP: `map_hollow_archive`. The map is split into **two halves by a chasm** (tiles column x=8, impassable, Magus *can* float across). Party starts split: Crono + Ayla west (3,8),(3,10); Frog + Magus + Iselle east (13,8),(13,10),(13,12).
- ENEMIES: Seedbearer ×4 (two per side; **no seed** — they now carry *Catalogue tablets* and try to reach the `LEDGER` zone at (8,1) top-center on the walkway bridging the chasm — if two arrive there, the chasm seals and the two halves rejoin *but* all party members get `Catalogued` permanently for the battle), Echo Hench ×4, Echo Nu ×2 (healers). Iselle (guest, AI: protects Frog).
- OBJECTIVE: `DEFEAT_ALL`. Secondary: *"Stop the Seedbearers from reaching the Ledger."*
- MUSIC: `mus_battle_boss`.
- TRIGGERS:
  - `B4B_T1 PRE_BATTLE` — LUCCA (radio, crackling badly): "I'm losing you — the Hollow eats signal. Magus can cross the gap. Everyone else, hold your side. Crono — don't be a hero. (static) …okay be a *little* —" (cuts).
  - `B4B_T2 UNIT_ENTERS_ZONE(magus, WEST)` (he floats across) — AYLA (surprised): "Blue-hair come to Ayla's side?" MAGUS (neutral): "The frog is insufferable when he's protective." (Flavor.)
  - `B4B_T3 DUAL_TECH_USED(beast_toss)` first time — AYLA (happy): "Ayla throw Blue-hair's boom! Good boom!" MAGUS (angry): "You threw *me.*" AYLA: "Little bit."
  - `B4B_T4 ANY_ENEMY_ENTERS_ZONE(LEDGER)` (first Seedbearer) — THE CURATOR: ONE OF TWO. ISELLE (angry): "Kill it before the second gets there!"
  - `B4B_T5` (second Seedbearer in LEDGER) — EFFECT: chasm seals (map rejoins), `APPLY_STATUS(all_party, Catalogued, permanent)`. THE CURATOR: FILED. (Harder, not fatal.)
  - `B4B_T6 UNIT_DEFEATED(last_seedbearer)` — ISELLE (determined): "That's all of its hands. Now it has to use its own." EFFECT: chasm seals (rejoin) *without* the debuff if T5 didn't fire.
  - `B4B_T7 VICTORY` — `mus_victory`.

`[SCENE 4.4 — The Core Exhibit]`
MAP: `map_hollow_core` (16×16 circular platform, height 0, four pedestals at height 2 at the compass points; a red void beyond the edge — falling = KO). MUSIC: `mus_curator`. In the center stands **THE CURATOR** (`spr_curator_p1`) beside an empty vitrine large enough for four people. On the four pedestals: the three inert seeds the party collected are **not there** (they're with the party), but four **placards**: CRONO. GLENN. AYLA. JANUS.

CUTSCENE:
THE CURATOR: THE COLLECTION IS COMPLETE. THE FOUR WHO ENDED THE WORLD-EATER. STAND IN THE CASE AND EVERY ERA IS SAFE FOREVER — UNCHANGING, UNENDING, UNHARMED.
FROG (angry): Unliving.
THE CURATOR: LIVING IS THE PROCESS BY WHICH THINGS ARE LOST. I HAVE SOLVED IT.
ISELLE (broken): You solved my *brother.* Look at what you solved. (She holds up the tablet.)
THE CURATOR: ENTRY 0-B IS INTACT.
ISELLE (angry): He's *a picture!*
THE CURATOR: … (a pause — the first pause it has ever taken) …HE IS INTACT.
MAGUS (neutral): (steps forward) I'm going to say this once, and I'm going to say it to the thing that thought a hollow statue was my sister. Nothing you keep is kept. It's only *stopped.* And I have spent my whole life fighting things that wanted the world stopped.
CHOICE (Crono): [Draw sword] — this is the only option. (Render the choice box with a single entry, for the drama.)
Crono `draw_sword`. Frog draws. Ayla cracks knuckles. Magus's scythe ignites with dark fire. Iselle plants her halberd — and steps *back*, out of the battle: ISELLE (determined): "This one's yours. Corin's watching. Make it a good entry."

`BATTLE 5 — "Entry 0" — FINAL BOSS, PHASE 1`
- MAP: `map_hollow_core`.
- PARTY: all four. Start south quadrant (6..9, 12).
- ENEMY: THE CURATOR (Phase 1: HP 2,000, DEF 20, MDEF 22, SPD 9, MOVE 0 — it does not move, it *rearranges the room*). Techs: **Rearrange** (teleports one party member to a random pedestal — height 2 — isolating them), **Catalogue All** (3×3 Catalogued), **Deaccession** (single target, heavy magic, shadow; used only on Catalogued units), **Reconstruct** (spawns 2 Vitrine Sentinels; used every 3 rounds).
- The four pedestals are **weak points**: if a party member stands on a pedestal and uses a Tech, the placard shatters and the Curator loses its `Rearrange` for that quadrant + takes 150 dmg. Banner: *"Shatter the four placards."*
- OBJECTIVE: `UNIT_HP_BELOW(curator, 0)` → triggers Phase 2 (not victory).
- MUSIC: `mus_curator`.
- TRIGGERS:
  - `B5_T1 PRE_BATTLE` — LUCCA (radio, one clean sentence gets through): "Crono — the pedestals. It built its own weak points. Museums always do." (static)
  - `B5_T2 TECH_USED(any, on_pedestal)` first placard shattered — THE CURATOR: THAT WAS A LABEL. LABELS ARE NOT LOAD-BEARING. FROG (determined): "Then why dost thou flinch?"
  - `B5_T3 UNIT_HP_BELOW(curator, 75)` — THE CURATOR: ENTRY 2. GLENN. YOU KEPT CYRUS'S DEATH FOR TEN YEARS. YOU AND I ARE THE SAME. FROG (sad→angry): "Aye. I was. (beat) I put it down on the mountain. Thou shouldst try it."
  - `B5_T4 UNIT_HP_BELOW(curator, 50)` — THE CURATOR: ENTRY 9. AYLA. IN YOUR ERA THE REPTITES LOSE AND YOUR PEOPLE INHERIT THE ASH. I CAN MAKE IT NOT HAPPEN. I CAN MAKE NOTHING HAPPEN. AYLA (angry): "Ayla *like* happen!"
  - `B5_T5 UNIT_HP_BELOW(curator, 25)` — THE CURATOR: ENTRY 1. CRONO. YOU DIED ONCE AND WERE RETRIEVED. YOU ARE ALREADY A RESTORED ITEM. YOU BELONG HERE. CHOICE (mid-battle, Crono): [Shake head] / [Point sword at it]. Either way MAGUS answers: MAGUS (neutral): "He was retrieved by people who *loved* him, machine. Not by a shelf."
  - `B5_T6 UNIT_HP_BELOW(curator, 0)` — **do not end battle.** `FLASH`, `SHAKE`. The Curator's plates open like a flower (`spr_curator_p2`). Inside: a knot of Lavos-red energy, screaming (`sfx_seed_pulse` fast + Lavos-like shriek SFX `sfx_core_scream`). THE CURATOR (text now shakes): THE COLLECTION… REQUIRES… A HOST. I WILL BE THE HOST. I WILL BE THE SEED. EFFECT: `PLAY_MUSIC(mus_curator_core)`, `HEAL(curator, 100)` with new stats (Phase 2), all four pedestals **crumble** (map edges shrink by 1 ring: outermost tiles become void), `SPAWN lavos_sprout` ×2 at east/west.

`BATTLE 5 — PHASE 2 — "The Core Exhibit"`
- THE CURATOR (Phase 2: HP 2,500, DEF 14, MDEF 30 — **now resists all magic**, SPD 12, MOVE 2 — it moves now, lurching). Techs: **Destruction Rain** (5×5 random tiles, 3 per turn), **Consume** (adjacent, huge physical, heals it), **Erase Era** (every 4 rounds: one *entire quadrant* of the platform becomes void for 2 rounds — banner warns one round ahead: *"The north quadrant is being erased!"*).
- OBJECTIVE: `DEFEAT_UNIT(curator)`.
- TRIGGERS:
  - `B5_T7 TURN_START(phase2, 1)` — MAGUS (determined): "Its magic-hide is thick now. Steel, then. And I have one thing left to give steel." ISELLE (from the edge, shouting): "Together! You said it! *Say it again!*" MAGUS (angry): "…TOGETHER." EFFECT: `UNLOCK_TECH(eclipse_blade)`. Popup: *"Triple Tech unlocked: ECLIPSE BLADE (Crono + Frog + Magus). Ayla, cover them."*
  - `B5_T8 TECH_USED(eclipse_blade)` first time — full-screen `vfx_eclipse_blade`: Magus tears a black rift across the sky; Crono and Frog leap through it and strike the Core from both sides. THE CURATOR: THAT… IS NOT… IN THE RECORD. FROG (determined): "Nay. 'Tis new."
  - `B5_T9 UNIT_HP_BELOW(curator, 50)` — AYLA (happy, shouting over the noise): "Big weird thing getting SMALL!" THE CURATOR: ENTRY 9 IS… INCORRECT.
  - `B5_T10 ALLY_KO(any)` — the remaining allies get a line: FROG: "Stand! We stand or we are *shelved!*" / AYLA: "Get UP!" / MAGUS: "Don't you *dare* become an exhibit." (Whichever ally is still up, first match.)
  - `B5_T11 UNIT_HP_BELOW(curator, 10)` — THE CURATOR (slow, calm again, one last time): IF I END… THE DOME ENDS. CORIN ENDS. WARDEN… ISELLE (sad, from the edge): "He already ended. You just wouldn't file it." (beat) "File it now."
  - `B5_T12 VICTORY` — no fanfare. Silence 2 s. Then 4.5.
  - `DEFEAT` — THE CURATOR: ACQUIRED. (Retry from Phase 1 start; or, if the player died in Phase 2, offer "Retry from Phase 2".)

`[SCENE 4.5 — The Core collapses]`
MUSIC: none, then `mus_ending` fades in slowly. The Core's red knot flickers, shrinks to a seed — a *grey* seed — and goes still. The white museum begins to dissolve into scanlines, from the outside in. Vitrines pop like soap bubbles.

ISELLE (neutral): It's un-happening. All of it. The Hollow, the dome — me.
Her porcelain half begins to flake to light.
MAGUS (angry): Iselle —
ISELLE (broken, but smiling): Don't. It's the right ending. I'm from a year that isn't. (She hands Magus the tablet with Corin's portrait.) Keep this one. Not in a case. In a *pocket.* Somewhere that moves.
MAGUS (neutral): (takes it) …I'll misplace it. Constantly.
ISELLE (happy): Good. That's living.
FROG (sad): Warden. Thy brother would have been proud.
ISELLE (neutral): He'd have been *annoyed.* Same thing, in our family. (to Crono) Entry 1. You never said a word to me.
CHOICE (Crono): [Nod] / [Bow]
- Nod: ISELLE: "…Yeah. That was enough."
- Bow: ISELLE (surprised, then laughs): "Corin would've *hated* you."
AYLA (sad): Half-shiny girl brave. Ayla remember. Ayla tell fire.
ISELLE: Tell it loud.
She dissolves into scanlines. The tablet in Magus's hand stays solid.

The floor drops away into white. `sfx_gate_open` (the *blue* one). The party falls through a Gate.

---

## EPILOGUE — "Tomorrow, Unwritten"

`[SCENE 5.1 — End of Time]`
MAP: `map_end_of_time`. MUSIC: `mus_ending`. The grey door is **gone** — just three doors and the lamppost. Gaspar is awake, for once.

GASPAR (happy): Three doors. As it should be. (to Magus) You're holding something, mage.
MAGUS (neutral): A misfiled entry. (He puts the tablet in his cloak.) It's none of your concern.
GASPAR (neutral): Nothing is. That's the job.

`[SCENE 5.2 — Leene Square, dawn]`
MAP: `map_leene_square_night` with a **dawn palette swap** (ASSET NOTE: provide a dawn tint variant of the tileset or a full-screen gradient overlay). Marle, Lucca, Robo waiting by the bell. The party comes through the Gate.

MARLE (happy): All your limbs! You listened!
LUCCA (happy): The radio cut out for six hours. Six. I aged a decade. Robo got here ten minutes ago and has said nothing but "readings nominal."
ROBO (happy): Readings are nominal. That was not nothing. That was *everything.*
FROG (happy): Then 'tis done. (He looks at the bell.) I shall go home now, I think. And when I next climb the mountain, it shall only be a mountain.
AYLA (happy): Ayla go home too. Kino cry when Ayla leave, cry when Ayla come back. Kino good at cry.
MARLE (neutral): Magus?
MAGUS (neutral): (already walking toward the Gate) There's a year where a girl named Schala isn't a statue. I intend to find it. Don't follow.
FROG (neutral): We shan't.
MAGUS (stops, doesn't turn): …Frog.
FROG: Aye?
MAGUS: (a long beat) Nothing. (walks through.)
FROG (happy, quietly): 'Twas "thank you." He'll deny it.

CHOICE (Crono, final): [Ring the bell]
`sfx_leene_bell`. Everyone looks up. Camera tilts up into the dawn sky. The Trigger Motif resolves.

Text on black: **"Every record ends. That's how you can tell it was a life."**

Fade to credits.

`[SCENE 5.3 — Credits]`
MUSIC: `mus_credits`. Scrolling credits over a slideshow of stills (`ui_credit_still_01..08`: the fair, Denadoro shrine with a mountain that's only a mountain, Ayla telling a story to the fire with Kino asleep, the Last Village at dawn, Magus alone on a snowy cliff with a tablet in his hand, Frog kneeling at Leene's feet, Crono and Marle under the bell, an empty white void with nothing in it — then, in the last still, a single tiny sprout of green in the void).

---

## 7. ENDINGS & FLAGS

- **Single ending**, with three small variations:
  - If the player never let a seed hatch in Battles 1–3: in the credits, Iselle's tablet in Magus's still is **lit**. Otherwise it's dark.
  - If Iselle was never KO'd in 4A/4B: an extra line in 5.2 — LUCCA: "Also — the last thing the radio picked up before it died was a girl's voice saying 'entry filed.' Friend of yours?" FROG: "Aye. She was."
  - If the player used Eclipse Blade more than once: Magus's parting "Nothing." becomes "…Together. There. I said it twice. Never again."

---

## 8. IMPLEMENTATION ORDER (suggested milestones for Claude Code)

1. **Core:** map loader (JSON grid + heights), 4-dir movement, dialogue system with portraits/emotions/choices, save/load. Placeholder colored-rect sprites.
2. **Tactics engine:** grid overlay, CT turn order, move/act/facing, damage formulas, statuses, objectives, the **trigger engine (§3.7)**. Ship Battle 0 fully playable with placeholders.
3. **Techs & dual/triple techs** with VFX hooks.
4. **All 11 maps** as data, all 10 battles as data (units, triggers, objectives) — verify every trigger fires in a debug "jump to battle" menu.
5. **Cutscenes** for Prologue → Epilogue as data-driven scripts.
6. **Assets:** generate tilesets, sprites, portraits, VFX, UI per §4; swap placeholders.
7. **Music & SFX** per §5/§4.7; wire `PLAY_MUSIC` effects.
8. **Polish:** chapter cards, title, credits slideshow, ending flags (§7), balance pass against expected levels (§3.9).

End of document.
