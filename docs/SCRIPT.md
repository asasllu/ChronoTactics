# CHRONO TRIGGER: THE HOLLOW FUTURE
## Full game script + implementation bible for Claude Code

> **Fan project notice.** This is a non-commercial fan sequel. Chrono Trigger and its characters belong to Square Enix. At the player's request, the character, enemy and NPC sprites and the dialogue portraits now come from the original game's sprite sheets (supplied by the player), and the music is arranged from Chrono Trigger themes. Maps, effects, props and code are original to this project.

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
- **Genre:** Story-driven JRPG with FFT-style (Final Fantasy Tactics) grid-based tactical battles. Exploration is top-down 2D (Chrono Trigger style). Battles happen **on the same map the player is standing on** — the field transitions into a grid overlay (homage to CT's seamless battles) but with full tactics rules (movement range, turn order by speed, elevation, ranged attacks).
- **Length:** ~4–6 hours. 1 prologue, 4 chapters, 1 epilogue. 10 battles total (6 story battles, 4 bosses).
- **Party:** The core four: **Crono, Frog, Ayla, Magus.** Crono and Frog from the start; Ayla joins in Chapter 2, Magus in Chapter 3. Guests: Marle, Lucca and Robo fight beside Crono and Frog in the Prologue tutorial battle; Sir Cyrus fights beside the party in Chapter 4.
- **Recommended engine:** Godot 4 (GDScript) or Phaser 3 (TypeScript). Pick whichever you're most fluent in; everything below is engine-agnostic. Data (characters, techs, maps, dialogue, triggers) should live in JSON files so the script can be edited without touching code.
- **Resolution:** Internal render 256×224 (SNES), integer-scaled to window. Tiles are **32×32** (two SNES 16px tiles per logical tile) to give tactics grids more readability; sprites are **32×48**.
- **Tone:** Warm, adventurous, occasionally melancholic. The original game's humor stays (Frog's archaic speech, Ayla's caveman grammar, Magus's dry contempt). Stakes escalate from "one last loose end" to "the future itself is a wound."
- **Save system:** Save points on the map (glowing floor rune, asset `ui_savepoint`) + autosave before each battle.

---

## 2. CHARACTERS

### 2.1 Portrait emotion set (applies to ALL characters with portraits)
Every portrait sheet is 64×64 px, 6 frames: `neutral, happy, angry, sad, surprised, determined`. Dialogue lines reference these. If a character lacks an emotion (e.g. Magus never "happy"), draw it anyway; the script will simply rarely use it.

### 2.2 Playable characters

Common sprite spec for all playable characters: **32×48 px, 4 directions (down/up/left/right), animations:** idle (2 frames), walk (4), attack (3), tech-cast (3), hurt (1), KO (1), victory (2). Field sprite and battle sprite are the same sheet, built from the original game's sprite sheets (`public/js/sheets/<key>.js`).

#### CRONO
- **Role:** Silent protagonist. Balanced fighter, high speed, lightning element.
- **Personality (for animation and NPC reactions):** brave, impulsive, kind. Nods a lot. Draws his sword before thinking.
- **Base stats (Lv 1):** HP 120 · MP 20 · ATK 12 · DEF 8 · MAG 8 · MDEF 7 · SPD 9 · MOVE 4 · JUMP 2
- **Weapon:** Katana (Rainbow is a late unlock)
- **Techs (learned by level):**
  1. Cyclone (Lv1, 4 MP): all adjacent tiles (8 tiles ring), physical.
  2. Slash (Lv3, 3 MP): single target, range 1, ATK×1.3, lightning-tinted.
  3. Lightning (Lv5, 5 MP): single target, range 3, magic, lightning element.
  4. Spincut (Lv7, 7 MP): single target, range 1, ATK×1.8.
  5. Lightning 2 (Lv9, 10 MP): 3×3 area, range 4, lightning.
  6. Luminaire (Lv11, 20 MP): 5×5 area centered on self, lightning, ATK+MAG.
- **Battle quotes** (short text popups, no portrait): on tech: "…!" ; on victory: (raises sword, sparkle).

#### FROG (Glenn)
- **Role:** Knight/healer hybrid. Water element. Tank with support.
- **Personality:** archaic, honorable, self-doubting but resolute. Uses "thou/thee/'tis/methinks". Loyal to Cyrus's memory and to Leene.
- **Base stats:** HP 140 · MP 22 · ATK 11 · DEF 11 · MAG 9 · MDEF 9 · SPD 7 · MOVE 3 · JUMP 2
- **Weapon:** Masamune (start of game).
- **Techs:**
  1. Slurp (Lv1, 2 MP): heal one ally, range 3, MAG×1.2.
  2. Slurp Cut (Lv3, 3 MP): single target, range 2 (tongue reach), ATK×1.3.
  3. Water (Lv5, 4 MP): single target, range 3, water element.
  4. Heal (Lv7, 6 MP): heal all allies within 2 tiles of Frog.
  5. Leap Slash (Lv9, 8 MP): jump to a tile up to 3 away (ignores terrain), strike adjacent target ATK×1.7.
  6. Frog Squash (Lv11, 12 MP): 3×3 area, damage scales with Frog's missing HP.
- **Dual techs with Crono:** X-Strike (Crono + Frog, 6 MP each): both adjacent to target, ATK×2.5 combined. Sword Stream (Crono Lv5 + Frog Lv5): line attack 4 tiles, water+lightning.

#### AYLA
- **Role:** Brawler. No element (physical only, cannot equip weapons — fists). Highest ATK and MOVE, low MDEF.
- **Personality:** blunt, joyful, fiercely protective. Speaks in short clipped sentences ("Ayla strong. Ayla fight."). Refers to Crono as "Crono" and Magus as "Blue-hair". Calls enemies "big weird thing".
- **Base stats:** HP 150 · MP 12 · ATK 15 · DEF 9 · MAG 5 · MDEF 5 · SPD 8 · MOVE 5 · JUMP 3
- **Techs:**
  1. Kiss (Lv1, 2 MP): heal one adjacent ally, small.
  2. Rollo Kick (Lv3, 3 MP): single target, range 1, knockback 1 tile (can push off ledges; pushing off a 2+ height drop deals bonus damage).
  3. Cat Attack (Lv5, 4 MP): move up to 2 extra tiles then strike ATK×1.4.
  4. Tail Spin (Lv7, 6 MP): 8-tile ring, physical, chance to Stun.
  5. Charm (Lv9, 5 MP): single target range 1, steals the enemy's held item (each enemy has a `steal` field).
  6. Triple Kick (Lv11, 10 MP): three hits ATK×0.8 each on one target.
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
  4. Dark Bomb (Lv5, 10 MP): 3×3 area, range 5, shadow.
  5. Dark Mist (Lv9, 12 MP): all enemies within 3 tiles, shadow, halves their MAG for 2 turns.
  6. Black Hole (Lv11, 16 MP): 3×3 area, instantly KOs non-boss enemies with <30% HP; damage otherwise.
  7. Dark Matter (Lv12, 24 MP): cross-shaped area (5 tiles each arm), range 6, shadow, heavy.
- **Dual techs (new — Magus had none originally, the story earns them):** Shadow Cyclone (Crono + Magus, unlocked Chapter 3): Crono's Cyclone infused with shadow, ring + 1 extra tile. Ice Water (Frog + Magus, unlocked Chapter 3): freezes a 3-tile line, enemies caught are Slowed.
- **Triple tech (new, unlocked in Chapter 4):** **Eclipse Blade** (Crono + Frog + Magus, 15 MP each): Magus opens a dark rift, Frog and Crono strike through it — hits every enemy on the map for ATK+MAG×1.2. Used exactly once in the script (final battle phase 2); it can also be player-triggered after unlock.

### 2.2b Guest heroes: Marle, Lucca, Robo
Playable only in Battle 0 (as guests beside Crono and Frog) and in the Zenan Skirmish. All three attack from range with their normal attack.
- **Marle** — Crossbow, range 1–4, ice. Techs: Aura (`marle_aura`, heal one ally within 4) and Ice (`marle_ice`, may Slow).
- **Lucca** — Air gun, range 1–3, fire. Techs: Flame Toss (`lucca_flame`, 3-tile fire line, may Burn) and Napalm (`lucca_napalm`, 3×3 fire bomb).
- **Robo** — Arm cannon, range 1–3, sturdy. Techs: Laser Spin (`robo_laser`, 4-tile lightning beam) and Cure Beam (`robo_cure`, heal one ally within 3).

### 2.3 Antagonists

#### THE CURATOR (final boss; entity name in code: `VESPER`)
- **What it is:** An artificial intelligence from the year **2400 A.D. of the *erased* future** — the ruined timeline that stopped existing when Lavos died in 1999. Humanity's last dome built VESPER to archive everything that was ever lost. When Crono's party killed Lavos, VESPER's future began to unravel. At the instant of Lavos's death-scream, VESPER absorbed a fragment of Lavos's temporal energy and did the one thing an archive is built to do: **it refused to let its timeline be deleted.** It now exists in a pocket of frozen time it calls **the Hollow** — a 2300–2400 A.D. that "should not be." Its plan: re-seed Lavos across history (one **Seed** per era) so the Hollow has a real timeline to live in. The seeds are also bait: they draw the four heroes out so the archive can record them completely and make them its final exhibit.
- **Visual:** Phase 1, the docent the party meets in the Core, **wears the Prophet's shape** (sprite `prophet`: the hooded, purple-robed figure from the original game) — the mask Magus wore in Zeal, chosen "to put him at ease". Phase 2 (`curator_p2`, "the Core Exhibit"): the mask splits open on a compressed knot of Lavos-red energy. Its dialogue uses its own box and always reads in capitals, cold and calm.
- **Personality:** Polite. Genuinely believes it is preserving, not destroying. Speaks of people as "entries" and of eras as "wings" of a museum. Never raises its voice.

#### SIR CYRUS, THE WARDEN (recurring boss, redeemable; data and speaker id `iselle`)
- **Who:** Glenn's mentor, the Guardia knight Magus killed on the Denadoro Mountains. At the instant of his death the Curator caught him and "preserved" him. He serves the archive because he believes that if history is kept, nothing he failed to protect — Queen Leene, his squire Glenn, Guardia itself — can ever be lost again. He is the Curator's hands in the past and the emotional spine of the villain side: Frog has to face the teacher he mourned for ten years, and Magus has to face the man he killed.
- **Arc:** Chapter 1, the reunion on the mountain where he died. Chapter 2, he plants the second seed and names Schala for Magus. Chapter 3, he visits Magus without a sword; in the Zeal wreckage the hollow Schala statue breaks his faith, Magus asks him to come with them, and he joins. Chapter 4, guest ally; he carries Schala's record out of the archive, cannot fight the Curator directly, and at the end hands Schala's record to Magus before fading. Last words to Frog: "Stand up straight. Go home. And let the mountain be a mountain."
- **Visual:** Sprite `cyrus`, an armoured knight with a purple cape who glows faintly like a ghost (the archive's form). Sprite `cyrus_human`: the unarmoured, brown-haired man, used when the archive's hold breaks (3.3 before he stands, and 4.5). Portrait emotions include `broken`.
- **Voice:** Plain, warm, a little dry; a knight's dignity without old-fashioned grammar. Calls Frog "Glenn".
- **Techs:** Hero's Ledger (`ledger_strike`, range-2 line), Preserve (an ally gets `Stasis`), Catalogue (target takes +50% damage), Severing Cut (`sever`, Chapter 3+: removes a buff and deals damage).

#### SEEDBEARERS (enemy type)
- Stone imps (sprite `stone_imp`): catalogued Mystic statues the Curator animates to carry a glowing red-black **Lavos Seed**. If a Seedbearer reaches a planting tile, or feeds a planted seed long enough, it hatches into a **Lavos Sprout** (uses Destruction Rain). This is the core objective mechanic of the game. When knocked off a ledge they fall and crumble.

#### ECHOES (enemy type)
- Grey-blue, flickering copies of monsters the archive recorded: Echo Imp (blue imp), Echo Mud Imp, Echo Green Imp, Echo Lizardactyl, Echo Avian Rex (the big one in the Hollow's atrium), Echo Ozzie (healer), Echo Azala (Ayla's old enemy, Chapter 2) and, in the Skirmish, Echo Flea. The `echo_<key>` sprite is derived from the base sprite automatically (tint + flicker). They are "entries" pulled from the Curator's archive; Robo calls them "recordings".

#### GALLERY GOONS (enemy type)
- Golden statue sentinels (sprite `goon`) that guard the Curator's galleries: slow, heavy, they wall off aisles; knock one down a level and it shatters. The Curator's Reconstruct summons more.

#### SLASH (Skirmish only)
- One of Magus's old generals, fighting with Echo Ozzie and Echo Flea in the Zenan Skirmish.

### 2.4 Supporting NPCs (portrait + field sprite each)
- **Marle** — Crono's partner. Prologue (playable guest in Battle 0, crossbow) and Epilogue. Warm, teasing.
- **Lucca** — Prologue (playable guest in Battle 0, gun) and Epilogue; the party's "mission control" via the Epoch's radio in Chapters 1–4 (voice-only box with her portrait, tagged `(radio)`). Her radio calls also carry the travel between eras.
- **Robo** — At the fair in the Prologue (playable guest in Battle 0, arm cannon); senses the Hollow's signal first, then goes back to 2300 A.D. to trace it. Returns in the Epilogue. His "I never delete anything a friend made" is paid off at the end.
- **King Guardia XXI & Queen Leene** (600 A.D.) — Chapter 1.
- **Kino** (65M B.C.) — Chapter 2. Ayla's mate; comic relief, brave.
- **The Elder of the Last Village** (12,000 B.C.) — Chapter 3, Earthbound One.
- **Gaspar (Guru of Time)** — at the End of Time. Hub between chapters. Sleepy, cryptic; warns Frog in the Prologue that the Hollow "keeps even the dead".
- **Spekkio** — End of Time, optional sparring battle (OPT-1). Appears in his **Frog King** shape (sprite `frog_king`) and jokes that he wears whatever suits his visitors.
- **Marle, Lucca and Robo in the Skirmish** — all seven heroes fight in the Zenan Skirmish extra mode.

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
A unit may **Move** (up to MOVE tiles, pathing around blockers; climbing costs 1 extra per height level above JUMP; Magus floats and ignores height/water), **Act** (Attack / Tech / Item / Wait). There is no facing step: units turn toward whatever they act on, and side or back attacks deal no extra damage.
- **Range:** most melee fighters attack adjacent tiles; Marle (crossbow, 1–4), Lucca (gun, 1–3) and Robo (arm cannon, 1–3) attack from range with their normal attack.
- **Elevation:** attacking a target lower than you: +10% damage and +1 range for ranged techs. Attacking a target higher: −10%.
- **Evasion:** `evade% = (target.SPD - attacker.SPD) * 2`, min 0, max 30.

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
  "lines": [ {"speaker":"iselle","emotion":"angry","text":"..."} ],
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
- A flat 100 EXP per level (as in Final Fantasy Tactics): a little per kill (5, or 20 for bosses) plus a victory reward and each Lavos seed. The party levels together (everyone gains EXP even if not in the battle). Level cap 15. About one or two levels and one new tech per hero per story battle. Party level going into each battle: B0 1, B1 3, B2 6, B3 8, B4A 10, B4B 11, B5 12. Stats grow with a power level of 2L−1, so enemy scaling (`CT.BATTLE_LEVEL`) stays on its original scale.
- After every victory the whole party is restored to full HP and MP, including anyone knocked out.
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
Sheet keys as listed in `public/js/sheets/manifest.js`. Most come from the original game's sprite sheets; `echo_<key>` variants are derived automatically.
- Heroes and guests: `crono`, `frog`, `ayla`, `magus`, `marle`, `lucca`, `robo`.
- Story allies: `cyrus` (Sir Cyrus, armoured), `cyrus_human` (unarmoured), `frog_king` (Spekkio).
- Story NPCs: `king`, `leene`, `guard`, `kino`, `elder`, `gaspar`, `nu` (End of Time shop), `villager_600` (×3), `villager_ioka` (×3), `villager_last` (×3), `fairgoer` (×4).
- Enemies: `imp`, `mud_imp`, `green_imp`, `stone_imp` (Seedbearers), `lizardactyl`, `avian_rex`, `azala`, `ozzie`, `flea`, `slash`, `goon` (Gallery Goons), `prophet` (the Curator, phase 1); hand-drawn: `curator_p2` (the Core Exhibit), `lavos_sprout`, `lavos_sprout_large`.
- Objects (hand-drawn): `epoch`, `lavos_seed`, `lavos_seed_inert`, `time_gate`, `hollow_gate` (grey with red scanlines).

### 4.4 Portraits (64×64 × 6 emotions)
`por_crono, por_frog, por_ayla, por_magus, por_marle, por_lucca, por_robo, por_king, por_leene, por_kino, por_elder, por_gaspar, por_spekkio, por_iselle` (Sir Cyrus; speaker id stays `iselle`), `por_curator`. The original game's portraits are used where they exist (`portraits_ct`); the recast cast (Cyrus, the Curator in the Prophet's shape, the Frog King) has matching portraits in `portraits_recast`.

### 4.5 VFX (sprite animations, 64×64 unless noted)
`vfx_cyclone, vfx_lightning (32×96 vertical), vfx_lightning2 (96×96), vfx_luminaire (160×160), vfx_slurp, vfx_water, vfx_heal, vfx_leap, vfx_frog_squash, vfx_kick_impact, vfx_tail_spin, vfx_charm_hearts, vfx_fire2, vfx_ice2, vfx_dark_bomb, vfx_dark_mist, vfx_black_hole, vfx_dark_matter (160×160), vfx_x_strike, vfx_sword_stream (line), vfx_shadow_cyclone, vfx_ice_water (line), vfx_beast_toss, vfx_eclipse_blade (full-screen), vfx_ledger_strike, vfx_preserve (glass bubble), vfx_catalogue (red barcode), vfx_seed_hatch, vfx_sprout_rain, vfx_time_rift (grey tear), vfx_hit, vfx_crit, vfx_ko_dissolve, vfx_echo_flicker`.

### 4.6 UI
`ui_dialogue_box` (dark blue, thin white border, name plate top-left, portrait left), `ui_dialogue_box_curator` (white with blue border — used only for VESPER), `ui_choice_cursor` (small hand pointer), `ui_battle_menu`, `ui_turn_bar`, `ui_hp_bar`, `ui_grid_overlay`, `ui_move_range_tile` (blue), `ui_attack_range_tile` (red), `ui_tech_range_tile` (yellow), `ui_objective_banner`, `ui_savepoint`, `ui_title_logo` (pixel logo "CHRONO TRIGGER" with the clock motif and subtitle "THE HOLLOW FUTURE"), `ui_chapter_card` (black screen, white serif text, used at each chapter start), `ui_menu_frame`.

### 4.7 SFX (short chiptune-style WAV)
`sfx_text_blip, sfx_confirm, sfx_cancel, sfx_battle_start, sfx_sword_swing, sfx_sword_hit, sfx_crit, sfx_lightning, sfx_thunder_big, sfx_water_splash, sfx_heal_chime, sfx_tongue, sfx_kick, sfx_spin, sfx_fire, sfx_ice_crack, sfx_dark_bomb, sfx_dark_mist, sfx_black_hole, sfx_ko, sfx_level_up, sfx_item_get, sfx_gate_open, sfx_gate_close, sfx_hollow_gate (gate sound but bit-crushed and reversed), sfx_seed_pulse (low heartbeat), sfx_seed_hatch, sfx_porcelain_step (Seedbearer/Cyrus footstep), sfx_glass_shatter, sfx_epoch_fly, sfx_leene_bell, sfx_save, sfx_curator_speak (a soft two-tone chime before each VESPER line), sfx_scanline`.

---

## 5. MUSIC (8 channels max; the tracks are now arranged from Chrono Trigger themes in `js/music_ct.js`, the table below is the original brief for each slot)

Loop points required unless marked "one-shot".

| ID | Title | Where | Mood / brief |
|---|---|---|---|
| `mus_title` | "A Bell at Midnight" | Title screen | Slow, nostalgic, bell samples, a rising 4-note motif (the **"Trigger Motif"** — reuse this motif in variations throughout: it is the game's leitmotif). 80 BPM. |
| `mus_fair_night` | "Lanterns Over Leene Square" | Prologue | Festive waltz in 3/4, accordion-like lead, warm. 140 BPM. |
| `mus_rift` | "Something Wrong With Tomorrow" | First rift appears, Hollow gates | Dissonant, detuned Trigger Motif, low pulsing bass. 60 BPM. |
| `mus_battle` | "Steel and Seconds" | Standard battle | Driving, brass-like leads, 160 BPM, 4/4, punchy drums. |
| `mus_battle_boss` | "The Warden" | Cyrus fights | Minor key, marching snare, glass-like arpeggios (use a bell/glass sample). 150 BPM. |
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

This section mirrors `public/js/story.js`, which is the source of truth for the exact lines. Battle numbers (HP, positions, tuning) are owned by the battle data and `CT.BATTLE_TUNE`; the figures below are the design intent.

### CHAPTER CARD FORMAT
Each chapter opens on `ui_chapter_card`: black screen, white text, `sfx_leene_bell` once, 2 s hold.

### WRITING NOTES
- **Frog and Cyrus share a knightly voice, kept light.** Frog may use an occasional "thou", "thee" or "'tis"; Cyrus speaks plainly. No riddles, no stacked old English, no metaphors that need a second read. One clear thought per line.
- **Every hand-off is motivated.** Lucca's radio covers travel (the Epoch picks the party up after each chapter and drops them at the End of Time); Gaspar's arrival lines say why the next door lights; scenes open with a line that says where we are and why.
- **The theme is keeping versus remembering.** Robo's "I never delete anything a friend made" (Prologue) is paid off by his choice to delete it in the Epilogue: "Some things are better remembered than kept."

---

## PROLOGUE — "The Last Firework"

`[SCENE 0.1 — Title]`
MAP: title screen with `ui_title_logo` over a slow-scrolling pixel sky (night → dawn gradient). MUSIC: `mus_title`. Options: New Game / Continue / Options.

`[SCENE 0.2 — Leene Square, night]`
MAP: `leene_square` (night). MUSIC: `mus_fair_night`. The night after Lavos was destroyed; the Millennial Fair has become a victory festival. Lucca and Robo are at the fair.

MARLE (happy): There you are! The whole fair is toasting the boy who beat Lavos, and he's hiding by the bell.
MARLE (happy): Lucca says you owe her a dance. She's lying. She can't dance.
LUCCA (angry): I can dance! I choose not to.
ROBO (happy): I recorded Lucca dancing at the last fair. The file is stored where no one will ever find it.
LUCCA (angry): Delete it.
ROBO (happy): I never delete anything a friend made.
MARLE (happy): See?
CHOICE: [Dance with Marle] / [Look at the bell]
- Dance: Crono and Marle spin. LUCCA (happy): "Disgusting. Carry on."
- Bell: `sfx_leene_bell`. MARLE (sad): "It rang when we first met." MARLE (happy): "I think it likes you."

Frog arrives in his cloak; fairgoers give him a wide berth.

FROG (neutral): A fine night. Too quiet, though. I do not trust it.
MARLE (happy): Frog! I thought you went back to 600!
FROG (neutral): I tried. The Gate to my time would not open. I waited an hour, then came to find thee.
LUCCA (surprised): Wouldn't open? Gates don't just close on their own. Not since Lavos —
ROBO (surprised): Lucca. My sensors. Something is reading the Gate network. Every Gate, every year, all at once.
ROBO (surprised): The signal comes from no year I know. And it is getting closer. It is coming *here* —

`sfx_hollow_gate`, MUSIC → `mus_rift`. A grey rift with red scanlines (NOT the blue Gate swirl) tears open in the square.

LUCCA (surprised): …That is *not* one of my fireworks.

Fairgoers flee. Two Echo Imps and an Echo Mud Imp crawl out, flickering.

FROG (determined): Imps, like the ones from my time. But grey, like ghosts. Crono! Draw!
MARLE (determined): The fairgoers are clear. Nobody wrecks this fair. Not tonight.
LUCCA (determined): Fine. Epoch later. Fire now.
ROBO (determined): Arm cannon ready. Please stand clear of the arm.

`BATTLE 0 — "Echoes at the Fair"` (tutorial)
- PARTY: Crono and Frog, with **Marle, Lucca and Robo** as playable guests for this battle only. All three fight from range: Marle's crossbow (range 1–4; Ice, Aura), Lucca's gun (range 1–3; Flame Toss, Napalm), Robo's arm cannon (range 1–3; Laser Spin, Cure Beam).
- ENEMIES: Echo Imps and an Echo Mud Imp (`hench`), plus whatever extra echoes the battle data adds. OBJECTIVE: `DEFEAT_ALL`. MUSIC: `mus_battle`.
- TRIGGERS:
  - `B0_T1 PRE_BATTLE` — FROG: "Take the high ground, Crono. A blow from above strikes harder." MARLE: "Lucca, Robo and I will shoot from back here. Just keep them off us!" LUCCA: "And try not to stand in front of my gun." ROBO: "Targeting the grey ones. Not the green one." FROG: "…My thanks, Robo." Popups: movement/attack tiles and height; *"Marle, Lucca and Robo fight from range: their normal attack reaches foes several tiles away. Keep them behind Crono and Frog."*
  - `B0_T2 TURN_START(2)` — FROG: "Thy Cyclone hits every foe around thee. Use it when they bunch up." (Tech menu popup.)
  - `B0_T3 UNIT_HP_BELOW(crono, 60)` — FROG: "Hold, Crono! I will heal thee." MARLE: "Or I can! My Aura reaches further." (Healing popup.)
  - `B0_T4 UNIT_ADJACENT(crono, frog)` with an enemy adjacent — FROG: "Side by side, Crono! Cross blades with me — the X-Strike!" EFFECT `UNLOCK_TECH(x_strike)`.
  - `B0_T5 UNIT_DEFEATED(hench)` — FROG (surprised): "It faded away. Like a memory." ROBO: "No body. No heat. Those were not alive. They were… recordings."
  - `B0_T6 VICTORY` — `mus_victory`. `DEFEAT` — FROG: "Get up, Crono… the fair is not safe yet."

`[SCENE 0.3 — After the fight]`
MUSIC: `mus_rift`. The rift is still open. Lucca is missing.

MARLE (surprised): Where's Lucca?
ROBO (neutral): She ran for the Epoch the moment the last one fell. She said, and I quote: "Nobody touch the hole."

Lucca returns with the Epoch hovering behind her.

LUCCA (determined): I scanned the rift from the Epoch. The other side isn't a year. It's a *nothing*. A future that was deleted and didn't take the hint.
FROG (neutral): Speak plainly, Lucca.
LUCCA (neutral): When we beat Lavos, the ruined future — Robo's future — stopped ever happening. But something in it survived. And it just opened a door into our fair.
ROBO (sad): My future. The domes, the hunger, the dust. If something still lives there, it is something that should not.
MARLE (sad): So it's not over.
LUCCA (neutral): It's over. This is the thing that comes *after* over.

The rift spits out a pulsing `lavos_seed` and closes.

FROG (angry): I know that light. That is Lavos.
LUCCA (surprised): A piece of Lavos. A *seed*. Oh, no. No no no. If something's planting these through history —
MARLE (determined): Then somebody has to pull them up. Crono, go with Frog. Find Ayla. Find — ugh — find Magus.
MARLE (determined): If more of these crawl out here, Guardia needs its princess home. You need people who hit hard.
ROBO (determined): And I will go back to 2300 and trace that signal. If it moves again, I will hear it first.
LUCCA (happy): I'll lock this seed in my lab. With very long tongs. Then I'm on the Epoch's radio, talking you through it.
LUCCA (neutral): The Epoch can drop you at the End of Time. Gaspar will know which era is bleeding first.
CHOICE: [Nod] / [Nod harder]
MARLE (happy): Come back with a story. And with all your limbs.

Fade out, `sfx_epoch_fly`.

`[SCENE 0.4 — End of Time]`
MAP: `end_of_time`. MUSIC: `mus_end_of_time`. Gaspar under the lamppost, the Nu's shop, Spekkio's door, three era doors and a **fourth door, grey, with red scanlines**.

LUCCA (radio): Radio check. You're at the End of Time, the Epoch's parked, and Gaspar is asleep standing up. All normal.
GASPAR (neutral): Ah. The boy who wouldn't stay dead. And the frog who wouldn't stop being a knight. You've noticed the new door, then.
FROG (neutral): That door looks sick.
GASPAR (sad): It leads to a future that should not exist. I cannot open it, and I would not if I could.
GASPAR (sad): Whatever lives there is reaching back. Into 600 A.D. Into the age of beasts. Into the fall of Zeal. One seed in each.
GASPAR (neutral): Pull them up before they take root, and that door may weaken.
FROG (determined): 600 A.D. first. It is my home.
GASPAR (neutral): It is also the first to bleed. Go. And Frog — that future keeps everything it touches. Even the dead. If you meet a face you buried, remember who sent it.
FROG (surprised): …What dost thou mean?
GASPAR (neutral): Zzz…

The 600 A.D. door lights. Popup: shop and Spekkio available.

**Hub (`eot`).** On each return the party stands at the lamppost (everyone who has joined). Gaspar has one arrival speech per chapter (below), then the field opens: talk to Gaspar (a hint per chapter), the Nu (shop), Spekkio (sparring) and, in Chapter 4, Cyrus by the grey door.
- SPEKKIO (in his Frog King shape): "Heya! Master of War, at your service. Like the new shape? I wear whatever suits my visitors. Today: frog." FROG: "…Must thou?" SPEKKIO: "Professional courtesy! Wanna spar? Step through my door. No hard feelings, no permanent damage. Mostly."

`BATTLE OPT-1 — Spekkio (optional, repeatable)`: Spekkio in his Frog King form scales to the party. First win: `Magic Tab` ×3. PRE_BATTLE "Show me the shape of your strength!"; VICTORY "Not bad! Not bad! …I was going easy."

---

## CHAPTER 1 — "The Knight Who Stayed" (600 A.D.)

`[SCENE 1.1 — Guardia Castle, throne room]`
MUSIC: `mus_guardia_600`. King Guardia XXI, Queen Leene, guards, quartermaster.

KING (angry): Glenn! Thank the stars. Something walks the Denadoro Mountains. Little stone imps march up the pass every night, and the peak glows red.
LEENE (sad): And Glenn… the mountain folk say a knight leads them. A tall knight in a violet cape, who shines in the dark like a ghost.
FROG (angry): Then he is no knight. Every knight who fought on Denadoro is dead. I buried the last of them myself.
FROG (determined): The red glow is a seed of Lavos, Majesty. They mean to plant it on the mountain where Cyrus fell. I will stop them.
KING (neutral): Cyrus… (beat) Take whoever you need.
FROG (sad): I have what I need. (to Crono) Though I wish there were more of us.
CHOICE: [Put a hand on Frog's shoulder] / [Say nothing]
- Hand: FROG (happy): "Aye. Thou art right. Two is enough, when it is the right two."
- Nothing: FROG (neutral): "…Thou always knowest when to stay quiet. Come."

Field: shop (tier 1), save point. Leene: "Cyrus used to say the pass sang when the wind was right. … Bring the song home, Glenn." A guard: "The stone imps don't bleed. Don't sleep, either. Just walk up the pass all night, with that shining knight in front."

`[SCENE 1.2 — Denadoro Pass, approach]`
MAP: `denadoro`. Ledges, a waterfall, a rope bridge (zone `BRIDGE`) and the shrine platform (zone `SHRINE`).

Frog stops at the cairn.
FROG (sad): Here. This is where Cyrus died.
Crono nods.
FROG (determined): I wept here once. Not today. Come.

MUSIC swells into `mus_frog_theme`. The camera finds the stone imps carrying the seed, the shrine, and a knight in a violet cape on the bridge.

CYRUS (neutral): You came. The Curator said you would come here first. It keeps very good records.
FROG (surprised): That voice… Cyrus?
CYRUS (sad): Hello, Glenn. You've grown. And you've… gone green.
FROG (sad): Thou art dead. I saw thee fall. Right here.
CYRUS (neutral): I did fall. And in the moment I died, something caught me. The Curator. It keeps everything, Glenn. It kept me.
FROG (angry): So now you plant Lavos on your own grave?
CYRUS (determined): The seed holds the archive up. While the archive stands, nothing in it is ever lost. Not Leene. Not Guardia. Not you.
CYRUS (sad): I failed all three of you once. I won't do it again.
FROG (angry): Thou art failing me now!
CYRUS (neutral): Stay down there, Glenn. I don't want to hurt you. (turns) Plant it.

`BATTLE 1 — "Denadoro Seed"`
- PARTY: Crono, Frog. ENEMIES: Seedbearer A (stone imp carrying the seed; paths to `SHRINE`), Seedbearer B (escort), Echo Green Imp ×3, Cyrus on the bridge (immortal; retreats below 40% HP).
- OBJECTIVE: stop Seedbearer A before it reaches the shrine; if it does, the seed hatches into a Lavos Sprout and the objective becomes `DEFEAT_ALL`. MUSIC: `mus_battle_boss`.
- TRIGGERS:
  - `B1_T1 PRE_BATTLE` — LUCCA (radio): "Lucca here. That stone imp is hauling the seed up to the shrine. Drop it before it gets there and the seed goes cold." / "And Frog… that's *the* Cyrus? Okay. He's up on the bridge. Don't fight him uphill if you can help it." FROG: "I do not want to fight him at all. Only to stop him."
  - `B1_T2 TURN_START(2)` — CYRUS: "I won't kill you, boy. Entry 1, Crono of Truce. The archive needs you whole." FROG (angry): "Then come down and face *me*, Cyrus!" CYRUS (sad): "Not yet, Glenn."
  - `B1_T3 UNIT_ENTERS_ZONE(any_party, BRIDGE)` — CYRUS: "Off the bridge. That's an order." EFFECT: free Catalogue on that unit.
  - `B1_T4 UNIT_DEFEATED(seedA)` — FROG: "The seed is down! Now, Cyrus!" Seed drops inert; objective "Defeat Cyrus or drive him off".
  - `B1_T5 UNIT_HP_BELOW(iselle, 40)` — CYRUS (sad): "You fight like a knight now, Glenn. I always knew you would." CYRUS: "I'm going to the age of beasts next. Ayla's age. If you follow me, come ready." Rift; he leaves; `mus_battle`; objective "Cyrus is gone. Defeat the remaining enemies!"
  - `B1_T6 ALLY_KO(frog)` — LUCCA: "Frog's down! Crono, get him back up — nobody takes on Cyrus alone!"
  - `B1_HATCH` — FROG: "Too late, it hatched! Cut it down before it grows!"
  - `DEFEAT` — FROG (sad): "Cyrus… I have failed thee twice."

`[SCENE 1.3 — The shrine, after]`
MUSIC: `mus_frog_theme`. Frog kneels and takes the cold seed.

FROG (sad): He was my teacher, Crono. The best knight Guardia ever had.
FROG (sad): For ten years I have lived in the day he died. And all that time, he was stuck in it too.
FROG (sad): Is it wrong that part of me was glad to see him?
CHOICE: [Nod] / [Shake head]
- Nod: FROG (sad): "Aye. I think so too. I was glad anyway."
- Shake: FROG (happy): "Thank thee. Then I will stay glad."
FROG (determined): I will not leave him dying on this mountain forever. We pull the seeds, and we bring him home. Or we lay him to rest.
LUCCA (radio): Nice work, you two. I'm bringing the Epoch round. Next stop: the End of Time.

Reward: `Denadoro Seed (inert)`, EXP. The Epoch flies them to the hub.

GASPAR (neutral): One seed pulled. And the grey door… flickered. Good. (to Frog, sad) You met a face you buried.
FROG (sad): Cyrus. My teacher. He serves that door now, and he believes he is right.
FROG (determined): He said he would go to the age of beasts next. To Ayla.
GASPAR (neutral): Then Ayla will not need convincing. She will need *restraining*.
The 65,000,000 B.C. door lights.

---

## CHAPTER 2 — "Strong, Then Kind" (65,000,000 B.C.)

`[SCENE 2.1 — Ioka Village]`
MUSIC: `mus_ioka`. Bonfire, dancing villagers. Kino runs up.

KINO (surprised): Crono! Frog-man! Ayla gone! Ayla go fight rock-men alone! Kino say "wait", Ayla say "no". Ayla always say no!
FROG (neutral): Where did she go?
KINO (sad): Old Tyrano place. Ground there gone red and hot again. And shiny ghost-man in purple cape. Kino scared. Kino… Kino go too?
FROG (sad): Cyrus. He kept his word.
CHOICE: [Yes, come] / [Stay, protect village]
- Yes: KINO (happy): "Kino brave! Kino stay behind you. Far behind." (Kino appears in 2.2's cutscene, then runs off.)
- Stay: KINO (determined): "Kino protect. Tell Ayla Kino not cry. Kino cry a little."

Field: shop (tier 2), save point. A villager: "Frog-man! You eat bug? Kino say you eat bug. Kino lie?" FROG: "…Only on feast days."

`[SCENE 2.2 — Tyrano Crater]`
MUSIC: `mus_tyrano`. Ayla is mid-fight with stone imps; the seed is half-planted at the central pillar.

Ayla knocks a stone imp off a ledge; it falls and crumbles.
AYLA (happy): CRONO! FROG! Ayla knew you come! Rock-men no fun. They no scream, they just fall.
FROG (neutral): Ayla, the seed —
AYLA (angry): Ayla see. Ayla try pull. Seed bite Ayla. (beat) Seed bad. Ayla break seed.
Cyrus steps out of a grey rift on the rim.
CYRUS (neutral): Entry 9. Ayla, chief of Ioka. Never learned to read. Never needed to.
CYRUS (neutral): You can't break it, chief. It's already rooting. My stone imps feed it, it hatches, and this crater becomes a nursery.
AYLA (angry): Ghost-man! You plant bad egg in Ayla's ground!
CYRUS (sad): It was never your ground. It's *its* ground. It always was, underneath.
FROG (angry): Cyrus, enough! Thou hast no place here!
CYRUS (neutral): Neither do you, Glenn. Yet here we both are.
A second rift: an echo of **Azala**, Ayla's old enemy.
AYLA (surprised): Azala?! (angry) No. Azala gone. Ayla saw.
CYRUS (neutral): The archive keeps every enemy you ever had, chief. It kept this one for you.
AYLA (determined): Ayla beat Azala once. Ayla beat copy-Azala too. Then Ayla show ghost-man whose ground.
(If Kino came:) KINO (surprised): "Kino go… guard back of crater! Very important back!" (runs off)
Ayla joins.

`BATTLE 2 — "Nursery"`
- PARTY: Crono, Frog, Ayla. ENEMIES: Seedbearer ×3 feeding the seed (hatch counter), Echo Lizardactyl, **Echo Azala** (unit `azala`, Psychic Wave), Cyrus on the rim (passive until someone climbs to it).
- OBJECTIVE: defeat the three Seedbearers before the seed hatches. If it hatches: a large Lavos Sprout and `DEFEAT_ALL`. MUSIC: `mus_battle_boss`.
- TRIGGERS:
  - `B2_T1 PRE_BATTLE` — LUCCA (radio): "Three stone imps are feeding that seed. Drop two and it stops growing. Drop all three and it dies." / "Ayla, you're the fast one. And the ledges — *push them off the ledges.*" AYLA: "Ayla like glasses-girl." AYLA (angry): "Copy-Azala! Ayla come for you after eggs!"
  - `B2_T2 TECH_USED(ayla, rollo_kick)` knocking a foe down — AYLA: "Fall down go boom!" (knockback popup)
  - `B2_T3 TURN_START(2)` — CYRUS: "You don't understand what you're breaking. That seed holds the archive up. If it falls, everything it keeps falls with it. Guardia. Leene. You." FROG (angry): "Those things are not kept, Cyrus. They are trapped!" CYRUS (angry): "Trapped is better than gone. I was gone once, Glenn. Only for a moment. I won't let it happen to you."
  - `B2_T4` two Seedbearers down — AYLA: "One left! Crono — hit it, Ayla hold it!" (Slow on the last one.)
  - `B2_T5 UNIT_ENTERS_ZONE(any_party, RIM)` — CYRUS: "Fine. In person, then." (He turns aggressive.)
  - `B2_T6 UNIT_HP_BELOW(iselle, 40)` — CYRUS (sad): "…You hit like someone who's never been told no." AYLA: "Ayla told no many times. Ayla no listen." CYRUS (happy): "Ha. Glenn was the same." CYRUS: "The mage is next. Tell Magus the archive has built an *exhibit* for him. Tell him it's called Schala." Rift, retreat, `b2_iselle_gone`.
  - `B2_T6B` all three Seedbearers down and T6 never fired — CYRUS: "The nest is gone. I won't fight over an empty crater." + the Schala line; he leaves. (Guarantees the hand-off 2.3 and 3.1 depend on.)
  - `B2_T9 UNIT_ADJACENT(ayla, azala)` — AYLA: "Azala smart. Azala never fight fair." / "Copy-Azala not smart. Copy-Azala just loud!"
  - `B2_T10 UNIT_DEFEATED(azala)` — AYLA (sad): "Azala gone again." AYLA (angry): "Ayla not like. Nobody get kept like that. Not even Azala."
  - `B2_HATCH` — AYLA: "Egg open! Ayla smash baby thing before it grow!"
  - `B2_T7 UNIT_HP_BELOW(ayla, 30)` — AYLA: "Ayla not tired! Ayla… little tired." FROG: "Then lean on me a moment."
  - `DEFEAT` — AYLA (sad): "Ground… all red now."

`[SCENE 2.3 — Crater, after]`
MUSIC: `mus_ayla_theme`. Ayla yanks the seed out; its shell cracks and goes inert.

AYLA (neutral): Ghost-man say this ground belong to egg-thing. (beat) Ayla think… ground belong to who stand on it. Ayla stand on it. Ayla's children stand on it. Egg-thing stand on nothing.
FROG (neutral): Well said.
AYLA (happy): Ayla say many smart things. Ayla say them loud.
CHOICE: [Help her up] / [Sit down next to her]
- Help: AYLA (happy): "Crono strong. Ayla stronger. But nice."
- Sit: AYLA (happy): "Good. Sit. Watch fire go out." (Camera holds 3 s.)
AYLA (sad): Ghost-man fight like man who lose everything once. Ayla know that fight.
FROG (sad): He did lose everything. On a mountain, ten years ago.
AYLA (neutral): Who beat him?
FROG (sad): …Magus.
AYLA (surprised): Blue-hair?! And ghost-man say "Schala" too. Ayla think Blue-hair not going to like any of this.
FROG (neutral): Schala was his sister. She was lost when Zeal fell into the sea.
LUCCA (radio, happy): Seed number two: done! I'm bringing the Epoch down. Ayla, welcome aboard. Please don't punch the dashboard.
AYLA (happy): Ayla punch little.

Reward: `Tyrano Seed (inert)`. Ayla stays in the party. At the hub:

GASPAR (neutral): Two. The door groans now. (to Ayla) Chief. (to Crono) Twelve thousand B.C. is next, where Zeal fell into the sea. The mage will not come for you, boy. He will come for the name. Let him.
FROG (sad): Magus is the man who killed Cyrus. Now both of them will be in one place.
GASPAR (neutral): Then keep your sword sheathed until you know which one you need it for.
AYLA (determined): Ayla hold Frog's arm. Ayla strong.
The 12,000 B.C. door lights.

---

## CHAPTER 3 — "Schala's Name" (12,000 B.C.)

`[SCENE 3.1 — The Last Village]`
MUSIC: `mus_last_village`. Snow. Magus stands alone at the cliff edge, looking at the sea where Zeal fell.

ELDER (neutral): The blue-haired one arrived at dawn. He has not moved. He has not eaten. He asked one question: where the wreckage came ashore. I told him. He has not gone.
FROG (neutral): He is waiting for us. He would never say so.
MAGUS (neutral): You're late. The frog's stench arrived a full minute before the frog.
FROG (angry): And thine has been here since dawn, I hear. It has not improved.
MAGUS (neutral): A dead man came to me last night, frog. Your knight.
FROG (surprised): Cyrus?
MAGUS (neutral): He stood in the snow where I could see him, and he never drew his sword. He said he didn't blame me. He said the archive keeps everything — even what I did to him.
MAGUS (neutral): Then he said the thing in the grey future has built an exhibit. And the exhibit is called *Schala.* (beat) He asked me to come quietly.
AYLA (surprised): Blue-hair go quiet?
MAGUS (angry): I told him to go back to his grave. He went. (beat) Perhaps I should have followed him. Whatever it has — a copy, a memory, a corpse — it's more of my sister than I've had since I was a child.
FROG (angry): Thou didst kill him. And he came to thee without a sword.
MAGUS (neutral): Yes. I didn't enjoy it either.
FROG (sad): …That is the Cyrus I knew.
CHOICE: [Draw sword ("Then we take it back.")] / [Offer a hand ("Come with us.")]
- Draw: MAGUS (determined): "…Good. I'd have despised you for sympathy."
- Hand: MAGUS: "Keep your hand. I'm not joining anything." (Crono shrugs.) "…But I'm coming."
MAGUS (neutral): The seed is in the Zeal wreckage. Deepest hall. The knight is waiting there. I'll be *civil*.
FROG (neutral): Thou wilt be nothing of the sort.
MAGUS (neutral): No.

Magus joins; `UNLOCK_TECH(shadow_cyclone)`, `UNLOCK_TECH(ice_water)` (popup: "He won't call them that."). Field: shop (tier 3), save point. A villager: "Footprints in the snow last night. A big man in armour, by the size. But they didn't sink."

`[SCENE 3.2 — Zeal Wreckage, great hall]`
MUSIC: `mus_zeal_wreck`. At the north end, a display case holds a life-size statue of a girl in a Zeal robe — a Schala replica. The seed is planted in front of it. Cyrus stands beside the case. Gallery Goons (golden statues) and two Echo Ozzies wait in the hall.

MAGUS (neutral): That isn't her.
CYRUS (neutral): No. It's Entry 1,001. Built from every record that ever mentioned her: her name, her pendant, her voice in other people's letters. The Curator thought you'd want to see how much of her survived.
MUSIC → `mus_magus_theme`.
MAGUS (angry): How much of her survived is *none of your archive's business.*
CYRUS (sad): I said that too, once. When I woke up in the archive, I asked what became of my squire. It showed me a frog.
CYRUS (sad): Then it told me it could keep him. Safe, forever. Nothing would ever be taken from him again.
FROG (angry): I do not need keeping, Cyrus!
CYRUS (determined): Everyone says that, Glenn. Right up until they're lost.
MAGUS (neutral): You want to talk about loss, knight? I'm the one who killed you.
CYRUS (neutral): I know. I was there.
CYRUS (determined): So let's be honest. I plant this, and nothing any of us lost is ever lost again. You stop me, and it all goes back to being gone. That's the whole war.
AYLA (angry): Ayla sorry ghost-man lose things. Ayla still break egg.
CYRUS (angry): I know you will.

`BATTLE 3 — "The Exhibit"`
- PARTY: all four. ENEMIES: Cyrus (immortal; Hero's Ledger, Severing Cut, Preserve, Catalogue), Gallery Goon ×2 (slow, heavy; knock them down a level and they shatter), Echo Ozzie ×2 (healers, "Re-file"), one Seedbearer guarding the rooted seed (hatch counter while it lives).
- OBJECTIVE: "Defeat Cyrus!" Secondary: destroying the Seedbearer slows the seed. MUSIC: `mus_battle_boss`.
- TRIGGERS:
  - `B3_T1 PRE_BATTLE` — LUCCA (radio): "Those gold statues are Gallery Goons — slow, heavy, and they'll wall off the aisles. Magus can float around them over the water." / "The stone imp by the seed is feeding it. Take it out before it roots. Also, uh — Magus? Hi. Please don't blow up the radio." MAGUS: "I'll consider it." MAGUS (angry): "And those are copies of Ozzie. Of course the archive kept *Ozzie*." MAGUS: "They'll heal the knight. Ozzie was always good at hiding behind someone else. Kill them first."
  - `B3_T2 TURN_START(2)` — CYRUS: "Entry 2, Glenn. Entry 9, Ayla. Entry 1, Crono. And you — Janus, Prince of Zeal. The archive lists you under *lost.*" MAGUS (angry): "Take me off it."
  - `B3_T3 DUAL_TECH_USED(shadow_cyclone)` — FROG (surprised): "Thy shadow and Crono's blade work well together." MAGUS: "Don't make it sentimental."
  - `B3_T4 UNIT_HP_BELOW(iselle, 60)` — CYRUS: "Preserve." / "I don't want to hurt you, Glenn. I don't have to want to." EFFECT: Stasis on himself, another Echo Ozzie.
  - `B3_T5 UNIT_ADJACENT(magus, iselle)` — MAGUS: "The last time we stood this close, I killed you." CYRUS (sad): "I remember. I've had a long time to remember it." MAGUS: "Then fight me for your own reasons, knight. Not the Curator's."
  - `B3_T6 UNIT_HP_BELOW(iselle, 25)` — `mus_magus_theme`. Cyrus kneels; the case cracks and the statue's face flakes away: it is hollow. CYRUS (broken): "It's empty. Her case is empty. I told it the shape wouldn't be enough, and it said the *shape* was all anyone needs." MAGUS: "The shape is never enough." CYRUS (sad): "Kill the guard. The seed dies with it. I won't stop you." / "I won't help you either. Glenn, I —" EFFECT: Cyrus turns neutral; objective → `DEFEAT_ALL`.
  - `B3_T7 UNIT_DEFEATED(sbGuard)` — AYLA: "Three eggs. No more eggs?" LUCCA (radio): "That's the last one Gaspar sensed. The grey door should be — hang on. It's not weakening. It's *opening.*"
  - `B3_HATCH` — MAGUS: "It hatched. Kill it before it remembers what it's supposed to become."
  - `DEFEAT` — MAGUS: "Pathetic."

`[SCENE 3.3 — Hall, after]`
MUSIC: `mus_rift`. Cyrus kneels by the broken case. The archive's armour is gone: he is only a man (sprite `cyrus_human`).

CYRUS (sad): The seeds were never the plan. They were *bait*. Three eras. Three heroes pulled out of their homes.
CYRUS (sad): All four of you in one place, every blade and spell logged while you fought me. I logged them myself.
CYRUS (sad): It needed a complete record of you. It has one now. And it's opening the door itself.
FROG (angry): Why? What does it want?
CYRUS (neutral): The Hollow can't stay a pocket forever. It needs a real timeline to live in. It was going to use the seeds.
CYRUS (neutral): Now it's going to use *you.* The four who ended Lavos, kept in a case. Its final exhibit. Every other year can be sanded off.
AYLA (angry): Ayla no live in box.
MAGUS (neutral): Come with us.
CYRUS (surprised): You? You're asking *me*?
MAGUS (neutral): I took your life. I can't give it back. I can give you a better use for what's left of it.
CYRUS (sad): It'll know I turned. It knows everything.
MAGUS (angry): Then let it. I've been *known* by monsters before. It never once helped them.
FROG (sad): Cyrus. You taught me that a knight guards the living. Help us guard them.
CHOICE: [Offer a hand] / [Wait]
- Hand: Crono kneels beside him; Cyrus stands, armoured again. CYRUS (determined): "…You have the same look Glenn had at your age. Stubborn. All right."
- Wait: CYRUS (determined): "Don't help me. A knight stands up on his own."
FROG (neutral): Then we go through the grey door. Together. (to Magus) All of us.
MAGUS (neutral): Don't say "together." (beat) …Fine. Together.
LUCCA (radio): I heard all that. The grey door's wide open on my readings. Epoch's on its way — and yes, the ghost can ride. Just don't let him touch anything.

Reward: `Zeal Seed (inert)`. **Cyrus joins as a guest ally (AI-controlled) for battles 4A and 4B.** At the hub:

GASPAR (sad): It has opened its own door. That was always going to be the price of pulling the seeds. (to Cyrus) Sir Cyrus. You are further from your own time than any of them.
CYRUS (neutral): I don't have a time, old man. That's the trouble.
GASPAR (sad, to Crono): Boy. The lamp will be lit when you come back. If you come back.
Hub talk with Cyrus: "Your old man sleeps standing up. I did that once on night watch. Glenn swore he'd never tell." FROG: "I never did. Until now." CYRUS: "When you're ready: the grey door. I know the halls. I'll go first."

---

## CHAPTER 4 — "The Museum of Never" (The Hollow, 2300–2400 A.D. that should not be)

`[SCENE 4.1 — The grey door]`
MAP: `end_of_time`. The grey door is wide open.

CYRUS (determined): Stay close. Past this door, nothing stays where you left it. Not even you.
FROG (determined): Lead on, Cyrus. Like before.
CYRUS (happy): Like before. Try to keep up this time.
GASPAR (sad): Mind the lamp, boy. I'll keep it lit.
LUCCA (radio): Signal's already breaking up. If you can still hear me in there… I'll keep talking anyway.
The party walks through; white-out with `sfx_scanline`.

`[SCENE 4.2 — Atrium]`
MUSIC: `mus_hollow`. A vast white museum atrium. Display cases hold stills of the party's own past. Golden statues — Gallery Goons — stand on plinths.

THE CURATOR: WELCOME. YOU ARE THE FIRST VISITORS. YOU ARE ALSO THE LAST ACQUISITION. BOTH ARE HONORS.
FROG (angry): Show thyself!
THE CURATOR: I AM SHOWN. I AM THE HALLS. WALK THEM. YOU WILL FIND EVERYTHING YOU EVER LOST, ARRANGED CORRECTLY.
AYLA (sad): Ayla's village in glass box. Little fire. Little Kino.
AYLA (angry): Ayla HATE museum.
CYRUS (angry): Don't listen to it. It talks like that until you forget you're standing in a grave.
THE CURATOR: WARDEN. ENTRY 0-A. YOU HAVE MISFILED YOURSELF. I WILL CORRECT IT AFTER.
MAGUS (neutral): You'll be busy.
THE CURATOR: I AM NEVER BUSY. I AM COMPLETE. (beat) BEGIN THE TOUR.
The Goons step off their plinths; an Echo Avian Rex screeches from a gallery arch.

`BATTLE 4A — "The Tour"`
- PARTY: all four + Cyrus (guest). ENEMIES: Gallery Goon ×4, Echo Avian Rex (big, fire-breath cone; unit `tyrano`), Echo Imp ×4.
- OBJECTIVE: "Defeat the Echo Avian Rex!" MUSIC: `mus_battle`.
- TRIGGERS:
  - `B4A_T1 PRE_BATTLE` — AYLA (angry): "BIG BIRD-LIZARD! Ayla know this kind! Ayla fight them since Ayla little!" CYRUS: "It's a copy. It's read every fight your people ever had with its kind. Break it and the tour ends." AYLA (happy): "Then it know Ayla win."
  - `B4A_T2 UNIT_HP_BELOW(tyrano, 50)` — THE CURATOR: ENTRY 9 PERFORMS AS RECORDED. EFFECT: two more Goons at the arches.
  - `B4A_T3 ALLY_KO(iselle)` — CYRUS (sad): "…Go on. I'm — logged. It doesn't matter." MAGUS (angry): "It matters." (He returns for 4B at 50% HP.)
  - `DEFEAT` — THE CURATOR: THE TOUR IS OVER. PLEASE REMAIN STILL.

`[SCENE 4.3 — The Archive stacks]`
MUSIC: `mus_hollow`. Towering shelves, each labelled with an era.

THE CURATOR: THE TOUR CONTINUES IN THE ARCHIVE. PLEASE DO NOT TOUCH THE RECORDS.
Cyrus kneels at a shelf.
CYRUS (sad): Here. Zeal, the royal family. Every record of Schala the archive could find.
CYRUS (sad): One tablet. A girl with a pendant, smiling at her little brother. That's all of her. That's what "preserved" means.
MAGUS (neutral): Put it back.
CYRUS (sad): Magus —
MAGUS (angry): I'd rather Schala were alive somewhere and hated me than be a shape on a shelf. Put. It. Back.
CYRUS (neutral): No. I'll carry it. Someone should carry her out of here.
MAGUS (neutral): …Do as you like.
FROG (neutral): Is there a shelf for thee too, Cyrus?
CYRUS (neutral): Entry 0-A. Cyrus of Guardia. Died on Denadoro. Status: complete.
CYRUS (sad): I was never complete. I died with the job half done.
FROG (determined): Then we finish it. Today.
CYRUS (determined): The Core's below. It'll try to split us up in the stacks. Don't let it.
THE CURATOR: THE WARDEN IS CORRECT. SEPARATION IS EFFICIENT.
The shelves slide and the floor splits the party.

`BATTLE 4B — "Separation"`
- MAP: `hollow_archive`, split by a chasm (Magus can float across). Crono + Ayla west; Frog + Magus + Cyrus east (Cyrus protects Frog).
- ENEMIES: Seedbearer ×4 carrying catalogue tablets toward the `LEDGER` (two arrivals seal the chasm and Catalogue the whole party for the battle), Echo Mud Imp ×4, Echo Ozzie ×2 (healers).
- OBJECTIVE: `DEFEAT_ALL`; secondary "Stop the Seedbearers from reaching the Ledger." MUSIC: `mus_battle_boss`.
- TRIGGERS:
  - `B4B_T1 PRE_BATTLE` — LUCCA (radio, breaking up): "I'm losing you — the Hollow eats signal. Magus can cross the gap. Everyone else, hold your side. Crono — don't be a hero. …okay, be a *little* —" CYRUS: "Those stone imps carry catalogue tablets. If two reach the Ledger up top, it files every one of us. Stop them." CYRUS: "Glenn, I'm with you. Like old times." FROG (happy): "Then try to keep up."
  - `B4B_T2 UNIT_ENTERS_ZONE(magus, WEST)` — AYLA: "Blue-hair come to Ayla's side?" MAGUS: "The frog and his knight were reminiscing. I couldn't bear it."
  - `B4B_T3 DUAL_TECH_USED(beast_toss)` — AYLA: "Ayla throw Blue-hair's boom! Good boom!" MAGUS: "You threw *me.*" AYLA: "Little bit."
  - `B4B_T4` first Seedbearer at the Ledger — THE CURATOR: ONE OF TWO. CYRUS: "Stop it before the second one gets there!"
  - `B4B_T5` second — THE CURATOR: FILED. (Chasm seals; whole party Catalogued.)
  - `B4B_T6` all four Seedbearers down — CYRUS: "That's all of its hands. Now it has to use its own." (Chasm seals without the debuff.)
  - `DEFEAT` — THE CURATOR: SEPARATION WAS EFFICIENT.

`[SCENE 4.4 — The Core Exhibit]`
MAP: `hollow_core`. MUSIC: `mus_curator`. The party regroups. In the centre stands THE CURATOR, wearing **the Prophet's shape** — the hooded mask Magus wore in Zeal — beside an empty case large enough for four. Four placards on the pedestals: CRONO. GLENN. AYLA. JANUS.

FROG (neutral): Is everyone whole?
AYLA (angry): Ayla whole. Ayla angry.
THE CURATOR: THE COLLECTION IS COMPLETE. THE FOUR WHO ENDED THE WORLD-EATER. STAND IN THE CASE AND EVERY ERA IS SAFE FOREVER — UNCHANGING, UNENDING, UNHARMED.
FROG (angry): And unliving.
THE CURATOR: LIVING IS THE PROCESS BY WHICH THINGS ARE LOST. I HAVE SOLVED IT.
MAGUS (surprised): That shape…
MAGUS (angry): You're wearing the Prophet. You're wearing *me*.
THE CURATOR: IT IS THE SHAPE YOU WORE TO STAND NEAR HER. I ASSUMED IT WOULD PUT YOU AT EASE.
MAGUS (angry): It was a mask. You've made a mask of a mask.
CYRUS (broken): You "solved" me. You caught me as I died, and I've been dying ever since. Look at what you solved.
THE CURATOR: ENTRY 0-A IS INTACT.
CYRUS (angry): I'm *stuck!*
THE CURATOR: … (the first pause it has ever taken) …YOU ARE INTACT.
MAGUS (neutral): I'll say this once, to the thing that wore my mask and called a hollow statue my sister.
MAGUS (angry): Nothing you keep is kept. It's only *stopped.* And I have spent my whole life killing things that wanted the world stopped.
CHOICE: [Draw sword] — the only option.
Frog draws. Ayla cracks her knuckles. Magus's scythe flares.
CYRUS (sad): I'm still half its making. In there, it could turn me against you.
CYRUS (determined): So this one's yours. Glenn — make me proud. You always did.
FROG (determined): Then watch.
Cyrus steps back to the platform's edge and leaves the party for this battle.

`BATTLE 5 — "Entry 0" — FINAL BOSS`
- PHASE 1: THE CURATOR (Prophet's shape; does not move, rearranges the room). Techs: Rearrange, Catalogue All, Deaccession, Reconstruct (summons Gallery Goons). The four pedestals are weak points: stand on one and use a Tech to shatter its placard. Banner: "Shatter the four placards."
- PHASE 2 ("The Core Exhibit"): the mask splits open on a knot of Lavos-red energy. It moves, resists magic, and uses Destruction Rain, Consume and Erase Era. Objective: "Destroy the Core Exhibit!"
- TRIGGERS:
  - `B5_T1 PRE_BATTLE` — LUCCA (radio): "Crono — the pedestals! It built its own weak points; museums always do. Stand on one and hit it with a tech!"
  - `B5_T2` first placard — THE CURATOR: THAT WAS A LABEL. LABELS ARE NOT LOAD-BEARING. FROG: "Then why didst thou flinch?"
  - `B5_T3 UNIT_HP_BELOW(curator, 75)` — THE CURATOR: ENTRY 2. GLENN. YOU KEPT CYRUS'S DEATH FOR TEN YEARS. THEN I KEPT CYRUS. YOU AND I ARE THE SAME. FROG (sad): "Aye. Once, I was like thee." FROG (angry): "Then I let go. Thou shouldst try it."
  - `B5_T4 UNIT_HP_BELOW(curator, 50)` — THE CURATOR: ENTRY 9. AYLA. IN YOUR ERA THE REPTITES LOSE AND YOUR PEOPLE INHERIT THE ASH. I CAN MAKE IT NOT HAPPEN. I CAN MAKE NOTHING HAPPEN. AYLA (angry): "Ayla *like* happen!"
  - `B5_T5 UNIT_HP_BELOW(curator, 25)` — THE CURATOR: ENTRY 1. CRONO. YOU DIED ONCE AND WERE RETRIEVED. YOU ARE ALREADY A RESTORED ITEM. YOU BELONG HERE. CHOICE [Shake head] / [Point sword at it]. MAGUS: "He was retrieved by people who *loved* him, machine. Not by a shelf."
  - `B5_T6 UNIT_HP_BELOW(curator, 0)` — the transformation. THE CURATOR: THE COLLECTION… REQUIRES… A HOST. I WILL BE THE HOST. I WILL BE THE SEED. (Phase 2: full heal, `mus_curator_core`, outer ring voided, two Lavos Sprouts.)
  - `B5_T7` phase 2, round 1 — MAGUS: "Its magic-hide is thick now. Steel, then. And I have one thing left to give steel." CYRUS (from the edge): "Glenn! Magus! You said it once — *say it again!*" MAGUS (angry): "…TOGETHER." AYLA: "Ayla guard your backs. You three — go!" EFFECT: `UNLOCK_TECH(eclipse_blade)`.
  - `B5_T8 TECH_USED(eclipse_blade)` — THE CURATOR: THAT… IS NOT… IN THE RECORD. FROG: "Nay. 'Tis new."
  - `B5_T9` phase 2, 50% — AYLA: "Big weird thing getting SMALL!" THE CURATOR: ENTRY 9 IS… INCORRECT.
  - `B5_T10 ALLY_KO(any)` phase 2 — first living of: FROG "Stand up! Or we all end up on a shelf!" / AYLA "Get UP!" / MAGUS "Don't you *dare* become an exhibit."
  - `B5_T11` phase 2, 10% — THE CURATOR: IF I END… THE ARCHIVE ENDS. ENTRY 0-A ENDS. WARDEN… CYRUS (sad): "I ended on Denadoro, ten years ago. You just wouldn't file it." / "File it now."
  - `B5_T12 VICTORY` — no fanfare; 2 s of silence. `DEFEAT` — THE CURATOR: ACQUIRED.

`[SCENE 4.5 — The Core collapses]`
MUSIC: silence, then `mus_ending`. The red knot shrinks to a grey seed and goes still. The museum dissolves into scanlines; the cases pop like soap bubbles.

CYRUS (neutral): It's un-happening. All of it. The Hollow. The archive. Me.
His armour falls away in sparks; the man underneath is only Cyrus (`cyrus_human`).
FROG (sad): Cyrus —
CYRUS (broken): Don't, Glenn. It's the right ending. I died on that mountain. I'm only finishing it.
CYRUS (neutral, to Magus): Magus. Here. (He gives Magus Schala's tablet.) Take her. Not in a case — in a *pocket.* Somewhere that moves.
MAGUS (neutral): …Why give her to *me*?
CYRUS (happy): Because you'll carry her somewhere. That's all any of us ever wanted.
MAGUS (neutral): …I'll keep it badly. I'll misplace it constantly.
CYRUS (happy): Good. That's living.
FROG (sad): I never thanked you, Cyrus. For everything.
CYRUS (happy): You just did. You've done it for ten years, Glenn. Every time you drew that sword.
CYRUS (neutral): Stand up straight. Go home. And let the mountain be a mountain.
CYRUS (neutral, to Crono): Crono. You never said a word to me.
CHOICE: [Nod] / [Bow]
- Nod: CYRUS (happy): "…Yes. That was enough."
- Bow: CYRUS (surprised): "Ha! Far too gallant. Glenn, you've been a bad influence."
AYLA (sad): Ghost-man brave. Ayla remember. Ayla tell fire.
CYRUS (happy): Tell it loud.
He dissolves into light. Key item: `Schala's Record` (id `corin_tablet`).
LUCCA (radio, surprised): — hear me? Crono! A Gate's opening right under you. A real one, a *blue* one! JUMP!
The floor drops away into white; `sfx_gate_open`.

---

## EPILOGUE — "Tomorrow, Unwritten"

`[SCENE 5.1 — End of Time]`
MUSIC: `mus_ending`. The grey door is gone.

GASPAR (happy): Three doors. As it should be. (to Magus) You're holding something, mage.
MAGUS (neutral): A misfiled entry. (beat) It's none of your concern.
GASPAR (neutral): Nothing is. That's the job.
FROG (sad): Cyrus is gone, Gaspar. Truly, this time.
GASPAR (neutral): Then for the first time in ten years, he's resting. And so can you.
GASPAR (happy): Go home, all of you. Someone in 1000 A.D. has been ringing a bell at the Gate all night.

`[SCENE 5.2 — Leene Square, dawn]`
MAP: `leene_square`, dawn. Marle, Lucca and Robo wait by the bell. The party comes through a Gate.

MARLE (happy): All your limbs! You listened!
LUCCA (happy): The radio cut out for six hours. Six. I aged a decade. Robo came back from 2300 an hour ago and has said nothing but "readings nominal."
ROBO (happy): Because they are. Nothing is reading the Gates anymore. Every year is just… a year again. That is not nothing, Lucca. That is *everything.*
LUCCA (neutral): Also — the last thing the radio picked up was a man's voice. Very polite. He said: "Entry filed. Tell Glenn to stand up straight." Friend of yours?
FROG (sad): Aye. He was my teacher. (happy) He still is.
ROBO (neutral): I have made a decision. I am deleting my recording of Lucca dancing. Some things are better remembered than kept.
LUCCA (surprised): …Thank you?
MARLE (angry): Wait, I never got to see it!
FROG (happy): Then 'tis done. I shall go home now. And when I next climb the mountain, it will only be a mountain.
AYLA (happy): Ayla go home too. Ayla tell fire about ghost-knight. Tell it loud, like he say. Kino cry when Ayla leave, cry when Ayla come back. Kino good at cry.
MARLE (neutral): Magus?
MAGUS (neutral, walking to the Gate): There's a year where a girl named Schala isn't a statue. I intend to find it. Don't follow.
FROG (neutral): We won't.
MAGUS (stops, doesn't turn): …Frog.
FROG: Aye?
MAGUS: (a long beat) Nothing. (walks through)
FROG (happy): That meant "thank you." He'll deny it.

CHOICE (Crono, final): [Ring the bell]. `sfx_leene_bell`. Everyone looks up.

Text on black: **"Every record ends. That's how you can tell it was a life."**

`[SCENE 5.3 — Credits]`
MUSIC: `mus_credits`. Stills: the fair; Denadoro, only a mountain; Ayla telling the story at the fire while Kino sleeps; the Last Village at dawn; Magus alone on a snowy cliff with Schala's tablet in his pocket; Frog kneeling before Leene; Crono and Marle under the bell; an empty white void — and then a single sprout of green in it.

---

## 7. ENDINGS & FLAGS

- **Single ending.** These lines always play: Lucca's radio message from Cyrus ("Entry filed. Tell Glenn to stand up straight.") with Frog's answer, and Ayla's farewell.
- If the player never let a seed hatch in Battles 1–3, the credits still of Magus shows Schala's tablet **lit** ("Schala, in a pocket. Still lit."); otherwise it is dark ("Dark, but carried.").
- If the player used Eclipse Blade more than once, Magus's parting "Nothing." becomes "…Together. There. I said it twice. Never again."

---

## 8. IMPLEMENTATION ORDER (suggested milestones for Claude Code)

1. **Core:** map loader (JSON grid + heights), 4-dir movement, dialogue system with portraits/emotions/choices, save/load. Placeholder colored-rect sprites.
2. **Tactics engine:** grid overlay, CT turn order, move/act, damage formulas, statuses, objectives, the **trigger engine (§3.7)**. Ship Battle 0 fully playable with placeholders.
3. **Techs & dual/triple techs** with VFX hooks.
4. **All 11 maps** as data, all 10 battles as data (units, triggers, objectives) — verify every trigger fires in a debug "jump to battle" menu.
5. **Cutscenes** for Prologue → Epilogue as data-driven scripts.
6. **Assets:** generate tilesets, sprites, portraits, VFX, UI per §4; swap placeholders.
7. **Music & SFX** per §5/§4.7; wire `PLAY_MUSIC` effects.
8. **Polish:** chapter cards, title, credits slideshow, ending flags (§7), balance pass against expected levels (§3.9).

End of document.
