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
- **Arc:** Chapter 1, the reunion on the mountain where he died; his first words to his squire in ten years are "Stand up straight, Glenn." Wherever he goes he sets crooked things straight (a gate lantern, a guard's collar, a hut pole, his own cairn), and at the end of each fight he names the next era himself: he is delivering invitations. Chapter 2, he plants the second seed and names Schala for Magus. Chapter 3, he visits Magus without a sword; in the Zeal wreckage the Schala exhibit breaks open and is hollow ("What did you think you were?"); Magus tells him to get up, Frog tells him to stand up straight, and he joins. Chapter 4, guest ally; he carries Schala's record out of the archive, cannot fight the Curator directly, and at the end hands the record to Magus before fading. Last words to Frog: "Stand up straight. Go home. And let the mountain be a mountain."
- **Visual:** Sprite `cyrus`, an armoured knight with a purple cape who glows faintly like a ghost (the archive's form). Sprite `cyrus_human`: the unarmoured, brown-haired man, used when the archive's hold breaks (3.3 before he stands, and 4.5). Portrait emotions include `broken`.
- **Voice:** A plain-spoken soldier: orders, reports ("Soldier's report."), dry asides. No old-fashioned grammar, no speeches about his motives. Calls Frog "Glenn".
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
- **Robo** — At the fair in the Prologue (playable guest in Battle 0, arm cannon); senses something reading the Gates "like a hand going along a shelf", recognises the catalogue number on the first seed, and goes to 2300 A.D. to find who writes the numbers. Returns in the Epilogue ("There is a meadow there now. I did not record it. I stood in it."). His "I never delete anything a friend made" is paid off at the end.
- **King Guardia XXI & Queen Leene** (600 A.D.) — Chapter 1. Leene dusts Cyrus's banner every week and can send flowers to his cairn with the party.
- **Kino** (65M B.C.) — Chapter 2. Ayla's mate; comic relief, brave.
- **The Elder of the Last Village** (12,000 B.C.) — Chapter 3, Earthbound One.
- **Gaspar (Guru of Time)** — at the End of Time. Hub between chapters. Sleepy, sideways; tells Frog in the Prologue that someone on the mountain "has had a very long day", and on each return reports what the grey door did when a seed came out (it purrs, hums, knocks, then opens itself).
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
`map_leene_square_night`, `map_guardia_throne_600`, `map_denadoro_pass`, `map_ioka_village`, `map_tyrano_crater`, `map_last_village`, `map_zeal_wreck_hall`, `map_end_of_time`, `map_hollow_atrium`, `map_hollow_gallery` (the East Wing: a walkable gallery of the party's own past, no battle), `map_hollow_archive`, `map_hollow_core`. Sizes given per battle in §6.

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

Everything between the two markers below is **generated from `public/js/story.js`** by `node tools/script_doc.cjs`
(`--check` verifies it is current), so the document and the game cannot drift apart. Dialogue is verbatim; the
italic stage directions are the comments in the scene scripts; battle tables come from the battle data. Battle
numbers (HP, positions, tuning) are owned by the battle data and `CT.BATTLE_TUNE`.
The critique this version answers, and its beat sheet (through-lines, set-ups and pay-offs, motifs, what each
interlude is for), are in `docs/STORY_REVIEW.md`.

### CHAPTER CARD FORMAT
Each chapter opens on `ui_chapter_card`: black screen, white text, `sfx_leene_bell` once, 2 s hold.

### WRITING NOTES
- **Voices.** Frog: simple and clear, a light "thee / thy / aye / 'tis", never stacked old English. Ayla: short, concrete,
  warm, funny. Magus: dry, clipped, proud; he never explains a feeling. Lucca: quick, nerdy, self-mocking. Marle: warm,
  teasing. Robo: gentle, literal. Cyrus: a plain-spoken soldier (orders, reports, dry asides), calls Frog "Glenn".
  The Curator: capitals, polite, museum vocabulary (acquisition, label, condition, on loan). Gaspar: sleepy, sideways.
- **Subtext over statement.** Nobody argues the theme. It is carried by things: a lantern set straight, a cairn rebuilt,
  flowers that wilt, a bell that is not allowed to ring, a recording deleted on purpose.
- **Crono is silent.** He acts (nods, kneels, draws, hands things over) and the others read him.
- **Every hand-off has a cause.** Cyrus names the next era himself, and Lucca notices that he does ("That's not a
  villain. That's a tour guide."). The grey door reacts to every seed pulled, in the wrong direction. By the time the
  seeds are revealed as bait, the party has already guessed; what they learn is what the bait was *for*.
- **Running motifs.** *Stand up straight* (Cyrus's first words to Glenn, Frog's words to Cyrus on his knees, Cyrus's
  last words, the last thing the radio catches). *Entries / labels* (the catalogue numbers on the seeds, "Entry nine",
  the placards, "lost property", "File it."). *Kept versus remembered* (Robo's recording, the flowers, the bell,
  "Ayla want *told*"). *The bell* (it rings in the Prologue, hangs silent behind glass in the East Wing, rings once as
  the Hollow comes apart, and Crono rings it at dawn).

### BETWEEN BATTLES: FIELD MODE
Scenes hand control to the player with a `field` block. Everything in it is short and optional except the way on.
- **Objective tracker** (top-left): always says what to do next, and how many things are left to look at.
- **Sparkles** mark things worth examining (`LOOK`). They go out once looked at. Stand next to one and press Enter, or click it.
- **People** (`TALK`) say different things depending on what has happened.
- **Walk-on** beats fire when the leader steps into a zone: banter, or the trigger that starts the next scene.
- **Optional finds that pay off later** (none gate the plot):
  - *Leene's flowers* (throne room → Cyrus's cairn on Denadoro) → the museum's copy of the cairn has none; Cyrus's farewell; a credits still.
  - *Ayla's lunch* (Ioka's trader → the crater) → Ayla eats it, bone and all, before Battle 2.
  - *A carved cat* (Last Village sea-wrack → Magus) → the Entry 13 placard; a credits caption.
  - *The replica bell* (East Wing) → "No. Kept."
  - Cyrus's old cache at the foot of the pass (Mid Tonic) and a hollow bone in Ioka (Tonics).

<!-- SCRIPT:BEGIN (generated by tools/script_doc.cjs from public/js/story.js; do not edit by hand) -->

## PROLOGUE — "The Last Firework"

`[SCENE 0.2 — Leene Square, night]`
MAP: `leene_square` (night). MUSIC: `mus_fair_night`.

Chapter card: **PROLOGUE. THE LAST FIREWORK** — 1000 A.D.
*(Marle runs up. Crono has been standing alone under the bell.)*
MARLE (happy): Found you! The whole fair is toasting the boy who beat Lavos, and the boy is hiding behind a bell.
MARLE (happy): Lucca says you owe her a dance. She's lying. Lucca can't dance.
LUCCA (angry): I *can* dance. I have chosen, for the public good, not to.
ROBO (happy): I recorded Lucca dancing at the last fair. The file is stored where no one will ever find it.
LUCCA (angry): Delete it.
ROBO (happy): I never delete anything a friend made.
LUCCA (sad): It's four seconds long and I fall over in three of them.
ROBO (neutral): Three point two.
CHOICE: [Dance with Marle] / [Look at the bell]
- Dance with Marle:
  *(beat)*
  LUCCA (happy): Disgusting. Carry on.
- Look at the bell:
  *(beat)*
  MARLE (sad): It rang the day I ran into you.
  MARLE (happy): …I think it likes you.
*(Frog approaches in his cloak; fairgoers give him a wide berth.)*
FROG (neutral): A fine night. Lanterns. Music. No one screaming.
FROG (neutral): I do not trust it.
MARLE (happy): Frog! I thought you went home to 600!
FROG (sad): I tried. The Gate would not open. I stood before it an hour, like a man outside a locked inn.
LUCCA (surprised): Gates don't lock. They're holes. You can't lock a *hole* —
ROBO (surprised): Lucca. Something is reading the Gates. Every Gate, every year, one after another. Like a hand going along a shelf.
ROBO (surprised): It has stopped. On this year. On this *square* —
*(The rift.)*
MUSIC → `mus_rift`.
LUCCA (surprised): …That is *not* one of my fireworks.
*(Echoes crawl out of the rift.)*
FROG (determined): Imps! But grey. Like something left out in the rain. Crono — draw!
MARLE (determined): Everyone's clear! Nobody wrecks this fair. We *just* fixed the future.
LUCCA (determined): Fine. Science later. Fire now.
ROBO (determined): Arm cannon ready. Please stand clear of the arm.

`BATTLE B0 — "Echoes at the Fair"`
- MAP: `leene_square`. MUSIC: `mus_battle`. PARTY: CRONO, FROG, MARLE, LUCCA, ROBO.
- ENEMIES: echo_imp ×5, echo_hench ×2.
- OBJECTIVE: Defeat the Echoes!
- TRIGGERS:
  - `B0_T1 PRE_BATTLE` — FROG (neutral): Take the high ground, Crono. A blow from above strikes harder. / MARLE (determined): Lucca, Robo and I will shoot from back here. Just keep them off us! / LUCCA (determined): And try not to stand in front of my gun. / ROBO (neutral): Targeting the grey ones. Not the green one. / FROG (neutral): …My thanks, Robo. / [Popup: Blue tiles show how far a unit can move; climbing costs extra. Red tiles show what it can attack. Higher ground hits harder.] / [Popup: Marle, Lucca and Robo fight from range: their normal attack reaches foes several tiles away. Keep them behind Crono and Frog.]
  - `B0_T2 TURN_START(n: 2)` — FROG (neutral): Thy Cyclone strikes every foe around thee. Use it when they crowd in. / [Popup: Techs cost MP. Open the Tech menu to use Cyclone: it hits every tile around Crono.]
  - `B0_T3 UNIT_HP_BELOW(unit: crono, pct: 60)` — FROG (neutral): Hold, Crono! I will heal thee. / MARLE (happy): Or I can! My Aura reaches further. No tongue involved. / [Popup: Frog's Slurp heals one ally within 3 tiles; Marle's Aura reaches 4. Find them in each hero's Tech menu.]
  - `B0_T4 UNIT_ADJACENT(a: crono, b: frog, enemyAdjacent: true)` — FROG (determined): Side by side, Crono! Cross blades with me — the X-Strike! / [Popup: Dual techs appear when a partner is within 3 tiles and has charged at least halfway. Both pay MP, and the partner spends their next turn.] EFFECT: UNLOCK_TECH(x_strike).
  - `B0_T5 UNIT_DEFEATED(unit: hench)` — FROG (surprised): It did not fall. It faded. / ROBO (neutral): No body. No heat. That was not a creature. That was a recording of one.
  - `B0_T6 VICTORY` — EFFECT: PLAY_MUSIC(mus_victory).
  - `B0_DEFEAT DEFEAT` — FROG (sad): Get up, Crono… the fair is not safe yet.
- REWARDS: EXP 190, 50G, Tonic ×2.

→ scene `0.3`

`[SCENE 0.3 — Leene Square, after the fight]`
MAP: `leene_square` (night). MUSIC: `mus_rift`.

*(beat)*
MARLE (surprised): Where's Lucca?
ROBO (neutral): She ran for the Epoch as the last one fell. She said, and I quote: "Nobody touch the hole."
*(Frog edges toward the rift anyway.)*
ROBO (neutral): She was looking at you when she said it.
FROG (neutral): …I was only looking.
*(Lucca returns with the Epoch hovering behind her.)*
LUCCA (determined): Okay. I scanned it. The other side isn't a year. It's the future we cancelled. Robo's future. Domes, dust, the whole bad idea.
FROG (neutral): We ended that future.
LUCCA (neutral): We did. It's over. This is the thing that comes *after* over.
ROBO (sad): Then something in it refused to be deleted.
*(The rift spits out a seed before closing.)*
FROG (angry): I know that light. That is Lavos.
LUCCA (surprised): A piece of it. A seed. And — hold on. It's *tagged.* Somebody engraved a number on a piece of Lavos. Like a specimen.
ROBO (sad): That format is from my century. It is how the dome archives numbered what they meant to keep.
MARLE (determined): So somebody's planting them. Then somebody pulls them up. Crono, take Frog. Find Ayla. Find — ugh — find Magus.
MARLE (happy): If more of those crawl out here, Guardia needs its princess. And you need people who hit harder than a crossbow.
ROBO (determined): I will go to 2300 and find who is writing the numbers.
LUCCA (happy): I'll take this to my lab. With tongs. Long ones. Then I'm on the Epoch's radio: the voice telling you not to touch things.
LUCCA (neutral): The Epoch will drop you at the End of Time. If time's leaking, Gaspar's the one standing in the puddle.
CHOICE: [Nod] / [Nod harder]
MARLE (happy): Come back with a story. And all your limbs. I've counted them.
*(beat)*
→ scene `0.4`

`[SCENE 0.4 — End of Time]`
MAP: `end_of_time` (void). MUSIC: `mus_end_of_time`.

LUCCA (radio, neutral): Radio check. You're at the End of Time, the Epoch's parked, and Gaspar's asleep standing up. So: normal.
*(beat)*
GASPAR (neutral): Zzz…
FROG (neutral): Ahem.
GASPAR (neutral): Mm. The boy who wouldn't stay dead, and the frog who wouldn't stop being a knight. You've seen my new door.
FROG (neutral): It looks sick.
GASPAR (sad): It leads to a year that isn't. I can't open it. I've decided not to try.
GASPAR (sad): Something in there is reaching back and leaving seeds. Three old doors, three seeds. And one door is already rattling.
FROG (surprised): That door goes to my time.
GASPAR (neutral): Pull the seeds, and the grey door ought to weaken. Ought to. I'm a guru of time, not of doors.
GASPAR (sad): And, knight. Someone is waiting for you on that mountain. Be gentle with him. He's had a very long day.
FROG (surprised): …Who?
GASPAR (neutral): Zzz…
[Popup: The door to 600 A.D. is lit. The Nu runs a shop, and Spekkio's door is open for sparring. Things that sparkle are worth a look.]
→ scene `eot`

---

## THE END OF TIME (hub, between every chapter)

`[SCENE eot — End of Time (hub)]`
MAP: `end_of_time` (void). MUSIC: `mus_end_of_time`.

*(Everyone who has joined arrives together at the lamppost.)*
*(In Chapter 4, Cyrus waits beside the grey door.)*
*(On each return, once: what the grey door did when a seed came out, and why the next door lights.)*
- *(if gaspar_after = 1)*
  GASPAR (neutral): One seed out. And my grey door…
  GASPAR (neutral): Purred.
  FROG (neutral): Purred.
  GASPAR (sad): I expected a groan. A sick thing groans when you take its food away. That was a cat hearing the cupboard open.
  *(Frog has walked off to the edge of the pier, looking at nothing.)*
  GASPAR (neutral): Long day?
  FROG (sad): His. Ten years of the same one.
  FROG (determined): He named the age of beasts. Ayla's age.
  GASPAR (neutral): Then Ayla won't need convincing. She'll need *restraining.*
- *(if gaspar_after = 2)*
  GASPAR (neutral): Two. Now it's humming a tune.
  *(Ayla inspects the Guru of Time.)*
  AYLA (surprised): Old man asleep. Standing. Like horse.
  GASPAR (neutral): Chief.
  AYLA (happy): Old man know Ayla is chief! Ayla like old man.
  GASPAR (neutral): Twelve thousand B.C. next, where Zeal went into the sea. The mage will come. Not for you, boy. For the name.
  FROG (sad): The man who killed Cyrus. And Cyrus. On one beach.
  GASPAR (neutral): Then keep your sword sheathed until you know which of them it's for.
  AYLA (determined): Ayla hold Frog's arm.
  AYLA (determined): Ayla hold *both* arm.
- *(if gaspar_after = 3)*
  GASPAR (sad): There. It's opened its own door. You pull three seeds, and it says thank you.
  GASPAR (sad): Sir Cyrus. You're further from your own time than anyone I've met. And I live *here.*
  CYRUS (neutral): I don't have a time, old man. I have a minute. I've been in it ten years.
  GASPAR (sad): Boy. The lamp will be lit when you come back.
  GASPAR (neutral): …It's lit either way. But I'll be watching it.

**FIELD** — the player walks. Objective: "Take the lit door to 600 A.D." (while progress = 1); then "Take the lit door to 65,000,000 B.C." (while progress = 2); then "Take the lit door to 12,000 B.C." (while progress = 3); then "The grey door is open. Enter the Hollow.". Save point.
- TALK — GASPAR:
  - *(if gaspar_heard >= 1)*
    GASPAR (neutral): Zzz…
    - *(if progress >= 3)*
      AYLA (happy): Ayla poke him?
      FROG (neutral): Let him be. He is working.
  - *(otherwise)*
    - *(if progress = 1)*
      GASPAR (neutral): Zzz… hm? The lit door, knight. I've only the one lamp. It does one door at a time.
      GASPAR (neutral): And don't lean on the grey one. It leans back.
    - *(if progress = 2)*
      GASPAR (neutral): Sixty-five million B.C. Nobody there writes anything down. You'd think that would keep them safe from a catalogue.
      GASPAR (happy): Mind the chief. She hugs like a landslide.
    - *(if progress = 3)*
      GASPAR (neutral): Twelve thousand B.C. Snow, and a sea where a kingdom used to float.
      GASPAR (sad): The mage got there first. He always does. Then he pretends he was passing.
    - *(if progress >= 4)*
      GASPAR (neutral): The grey door is open. I won't tell you not to go. I'd be wasting an old man's breath, and I've so little.
      GASPAR (sad): Time doesn't heal, boy. It only keeps going. That's the kindness in it.
- TALK — NU:
  NU (happy): Nu! Nu nu. …Nu?
  - *(if progress = 3)*
    AYLA (happy): Blue thing soft. Ayla sit on it before. It not mind.
  - *(if progress = 4)*
    MAGUS (neutral): Don't ask it anything. It answers.
  [Shop: `end_of_time`]
- TALK — SPEKKIO:
  - *(if progress < 3)*
    SPEKKIO (happy): Heya! Master of War, at your service. Like the new shape? I wear whatever suits my visitors. Today: frog.
    FROG (neutral): …Must thou?
    SPEKKIO (happy): Professional courtesy! Wanna spar? Step through my door. No hard feelings, no permanent damage. Mostly.
  - *(if progress = 3)*
    SPEKKIO (happy): Ooh, the strong one's back! Don't tell her I said strong. She'll want proof.
    AYLA (happy): Ayla hear. Ayla want proof.
    SPEKKIO (surprised): …Door's right there. Bring friends.
  - *(if progress > 3)*
    SPEKKIO (neutral): Is that a *dead* guy by the grey door? I can't size myself to a dead guy. Makes my scales itch.
    SPEKKIO (happy): You four, though. You, I can size. One more round before you go in?
- TALK — Cyrus *(while progress = 4)*:
  - *(if t_eot_iselle >= 1)*
    CYRUS (neutral): That lamp. It's the first thing in ten years I haven't seen before.
    CYRUS (happy): I'd forgotten that could happen.
  - *(otherwise)*
    CYRUS (happy): Your old man sleeps standing up. I did that once on night watch. Glenn swore he'd never tell.
    FROG (happy): I never did. Until now.
    CYRUS (determined): When you're ready: the grey door. I know the halls. I'll go first.
- LOOK (sparkle) — the lamppost:
  *The lamp at the End of Time. It has never gone out. Nobody remembers lighting it.*
  FROG (neutral): A lamp no one lit, kept by a man who sleeps. I have stood stranger watches.
- LOOK (sparkle) — a wet ring on the stone:
  *A wet ring where a bucket used to stand. The bucket led to the day of Lavos. That day is finished, and someone has taken the bucket in.*
  FROG (happy): Good riddance. I never liked that bucket.
- EXIT — `DOOR_600` → scene `1.1` (needs ch1_open; otherwise:)
  - *(if progress > 1)*
    *The door to 600 A.D. is quiet. Its seed is out.*
  - *(otherwise)*
    *The door is dark.*
- EXIT — `DOOR_65M` → scene `2.1` (needs ch2_open; otherwise:)
  - *(if progress > 2)*
    *The door to 65,000,000 B.C. is quiet. Its seed is out.*
  - *(otherwise)*
    *The door to 65,000,000 B.C. is dark. Gaspar's lamp hasn't reached it yet.*
- EXIT — `DOOR_12K` → scene `3.1` (needs ch3_open; otherwise:)
  - *(if progress > 3)*
    *The door to 12,000 B.C. is quiet. Its seed is out.*
  - *(otherwise)*
    *The door to 12,000 B.C. is dark. Gaspar's lamp hasn't reached it yet.*
- EXIT — `DOOR_GREY` → scene `4.1` (needs ch4_open; otherwise:)
  - *(if progress = 1)*
    *The grey door hums with red static. It will not open.*
  - *(if progress = 2)*
    *The grey door is purring. It will not open.*
    FROG (neutral): It sounds pleased. Why does it sound pleased?
  - *(if progress = 3)*
    *Something is knocking on the other side. Three knocks, a wait, three knocks. Politely.*
    AYLA (happy): Ayla knock back?
    FROG (neutral): No.
- EXIT — `DOOR_SPEKKIO` → scene `spekkio`


`[SCENE spekkio — Spekkio's Room]`
MAP: `spekkio_room` (void). MUSIC: `mus_end_of_time`.

SPEKKIO (happy): Step right up! I size myself to whoever walks in. Fair's fair!
CHOICE: [Spar with Spekkio] / [Maybe later]
- Spar with Spekkio:

  `BATTLE OPT1 — "Spekkio"`
  - MAP: `spekkio_room`. MUSIC: `mus_battle`. PARTY: CRONO, FROG, AYLA, MAGUS.
  - ENEMIES: spekkio.
  - OBJECTIVE: Spar with Spekkio!
  - TRIGGERS:
    - `OPT1_T1 PRE_BATTLE` — SPEKKIO (happy): Show me the shape of your strength! I'll show you the shape of a frog!
    - `OPT1_T2 VICTORY` — SPEKKIO (happy): Not bad! Not bad! …I was going easy. EFFECT: PLAY_MUSIC(mus_victory).
  - REWARDS: EXP 40, 100G.

  - *(if not opt1_won)*
    SPEKKIO (happy): First win's worth a prize. Here. Chew on these. …Don't chew them.
    Reward: Magic Tab ×3.
  - *(otherwise)*
    SPEKKIO (happy): Again tomorrow! …There's no tomorrow here. Again *whenever!*
- Maybe later:
  SPEKKIO (neutral): Chicken! …Kidding. Come back when your fists itch.
→ scene `eot`

---

## CHAPTER 1 — "The Knight Who Stayed" (600 A.D.)

`[SCENE 1.1 — Guardia Castle, throne room]`
MAP: `guardia_throne` (castle). MUSIC: `mus_guardia_600`.

Chapter card: **I. THE KNIGHT WHO STAYED** — 600 A.D.
KING (angry): Glenn! Thank the stars. Stone imps on the Denadoro pass. Every night, marching uphill, in step. And the peak glows red.
LEENE (sad): They carry something, Glenn. And a knight walks ahead of them. Tall, in a violet cape. He shines like frost.
FROG (angry): Then he is no knight of ours. Every knight who climbed Denadoro is dead. I buried the last of them myself.
LEENE (sad): He stopped under the castle wall last night. He saluted the tower.
LEENE (sad): Then he straightened the gate lantern, and went on.
KING (surprised): Straightened the — ?
LEENE (sad): It has hung crooked for ten years. Ever since —
*(beat)*
*(Frog does not finish the sentence for her.)*
FROG (neutral): …The red glow is a seed of Lavos, Majesty. We will pull it out.
KING (neutral): Take whoever you need.
FROG (sad): I have what I need.
FROG (sad): Though I would not mind more of us.
CHOICE: [Put a hand on Frog's shoulder] / [Say nothing]
- Put a hand on Frog's shoulder:
  FROG (happy): Aye. Two is enough, when it is the right two.
- Say nothing:
  FROG (neutral): …Thy silences are better than most men's speeches. Come.

**FIELD** — the player walks. Objective: "Head south to Denadoro Pass.". Save point.
- TALK — KING:
  - *(if t_1.1_king >= 1)*
    KING (neutral): Still here? In my day a knight left before the speech was over.
  - *(otherwise)*
    KING (neutral): The mountain folk will light beacons on the lower ridge. Go with Guardia's blessing, Glenn. And bring it back. We are short of blessings.
- TALK — LEENE:
  - *(if has_flowers)*
    LEENE (happy): He used to say the pass sang when the wind was right. I should like to hear that it still does.
  - *(otherwise)*
    LEENE (sad): Glenn. I have never been up to his cairn. They tell me a queen does not climb where her knights fell.
    LEENE (sad): Will you lay these there for me? They are only gate-flowers. He liked plain things.
    Reward: key item **Leene's Flowers**.
    FROG (sad): He will pretend not to be pleased.
- TALK — Guard:
  - *(if t_1.1_guard1 >= 1)*
    *He salutes again. He appears to be stuck.*
  - *(otherwise)*
    *Guard: "Sir Glenn! Er — Sir Frog! Er… Sir."*
    *He salutes a second time, to be safe.*
- TALK — Gate guard:
  *Guard: "I had the gate watch, sir. He walked straight through our line. Never drew. Never spoke."*
  *Guard: "…He did fix my collar on the way past. It's still straight. I've been afraid to touch it."*
- TALK — Quartermaster:
  *Quartermaster: "Steel for the pass, sirs? A mountain's no place for a dull edge."*
  [Shop: `guardia`]
- LOOK (sparkle) — a faded banner:
  *A knight-captain's banner, the violet gone grey. Every other banner in the hall wears ten years of dust. This one wears none.*
  FROG (sad): The Queen. Every week.
- LOOK (sparkle) — notches in a pillar:
  *Notches cut in the stone: the heights of squires, each with a name. The lowest reads GLENN.*
  *Beside it, lower still, a fresh one: FROG.*
  FROG (angry): …I know who cut that. He salutes too much.
- EXIT — `EXIT_SOUTH` → scene `1.2`


`[SCENE 1.2 — Denadoro Pass, approach]`
MAP: `denadoro` (mountain). MUSIC: `mus_denadoro`.

FROG (sad): Denadoro. I buried him at the foot of this trail. I have not climbed past it since.
*(The foot of the pass can be walked: the cairn, an old cache, tracks. Stepping onto the climb starts the reunion.)*

**FIELD** — the player walks. Objective: "Climb the trail toward the pass.".
- LOOK (sparkle) — a cairn:
  *A cairn of river stones. No name on it.*
  FROG (sad): Here. I built this with these hands, when they were hands. I built it badly. I could not see for weeping.
  *The stones are stacked dead straight.*
  FROG (surprised): …Someone has rebuilt it.
  - *(if has_flowers and not flowers_laid)*
    *Crono lays the Queen's flowers at the foot of the stones.*
    FROG (sad): From Leene. She could not make the climb. Now she has.
- LOOK (sparkle) — the roots of an old pine:
  - *(if cache_taken)*
    *An empty soldier's tin under the roots.*
  - *(otherwise)*
    FROG (neutral): Hold. Cyrus buried a tonic at the foot of every climb. "For the way down," he said. He never trusted the way down.
    *Under the roots: a soldier's tin, ten years rusted. The flask inside is still sealed.*
    Reward: Mid Tonic ×1.
    FROG (sad): …For the way down.
- LOOK (sparkle) — tracks in the grass:
  *Small square footprints, dozens of them, all in step. Beside them runs one long stride that leaves no print at all. Only a line of frost on the grass.*
- WALK-ON — zone `APPROACH`: the field ends and the scene continues.

MUSIC → `mus_frog_theme`.
*(The first thing he says to his squire in ten years is the thing he always said.)*
CYRUS (neutral): Stand up straight, Glenn. You climb like a sack of turnips.
FROG (surprised): That voice.
CYRUS (sad): Hello, Glenn. You've grown. And gone green.
FROG (sad): Thou art dead. I saw thee fall. Here. I piled the stones.
CYRUS (neutral): You piled them crooked. I fixed it.
CYRUS (neutral): Something caught me as I fell, Glenn. It's called the Curator. It keeps things. It kept me.
FROG (angry): And for that, thou plant Lavos on thy own grave?
CYRUS (determined): I plant what holds its roof up. While that roof stands, nothing under it is lost again. Not Leene. Not Guardia. Not one green squire.
FROG (angry): I am not lost! I am standing right here!
*(beat)*
CYRUS (sad): …So you are.
MUSIC → `mus_denadoro`.
CYRUS (neutral): Stay down there. That's an order.
CYRUS (determined): Plant it.

`BATTLE B1 — "Denadoro Seed"`
- MAP: `denadoro`. MUSIC: `mus_battle_boss`. PARTY: CRONO, FROG.
- ENEMIES: seedbearer ×2, echo_kilwala ×3, iselle.
- OBJECTIVE: Stop the Seedbearer before it reaches the shrine! If the seed hatches: "The seed has hatched! Defeat everything!"
- TRIGGERS:
  - `B1_T1 PRE_BATTLE` — LUCCA (radio, neutral): Lucca here. The stone imp with the red glow is hauling a seed up to that shrine. Drop the imp before it gets there and the seed goes cold. / LUCCA (radio, surprised): And the shiny knight on the bridge is — Frog, is that *the* Cyrus? …Okay. Okay. Don't fight him uphill. / FROG (determined): I do not mean to fight him. Only to stop him.
  - `B1_T2 TURN_START(n: 2)` — CYRUS (neutral): Entry one. Crono, of Truce. It wants you undamaged, boy, so I'll go easy. / FROG (angry): Come down and face *me*, Cyrus! / CYRUS (sad): Not yet, Glenn. Your guard is still too low.
  - `B1_T3 UNIT_ENTERS_ZONE(unit: any_party, zone: BRIDGE)` — CYRUS (angry): Off the bridge. That's an order. EFFECT: FREE_ACTION(catalogue).
  - `B1_T4 UNIT_DEFEATED(unit: seedA)` — FROG (determined): The seed is down! Cyrus, it is over. Come down! EFFECT: DROP_SEED, SET_OBJECTIVE.
  - `B1_T5 UNIT_HP_BELOW(unit: iselle, pct: 40)` — CYRUS (sad): There. *Now* your guard is up. I knew it would be. / CYRUS (neutral): The age of beasts is next. The chief, Ayla. You'll follow me, Glenn. You always did. Bring the boy. EFFECT: RIFT, DESPAWN(iselle), CLOSE_RIFT, PLAY_MUSIC(mus_battle), SET_OBJECTIVE.
  - `B1_T6 ALLY_KO(unit: frog)` — LUCCA (radio, surprised): Frog's down! Crono, get him up — nobody solos a ghost!
  - `B1_HATCH HATCH` — FROG (angry): Too late, it has hatched! Cut it down before it grows!
  - `B1_T7 VICTORY` — EFFECT: PLAY_MUSIC(mus_victory).
  - `B1_DEFEAT DEFEAT` — FROG (sad): Cyrus… twice now, I have failed thee.
- REWARDS: EXP 220, 300G, Tonic ×3, Mid Tonic ×1.

→ scene `1.3`

`[SCENE 1.3 — The shrine, after]`
MAP: `denadoro` (mountain). MUSIC: `mus_frog_theme`.

FROG (sad): He was the best knight Guardia ever had. He taught me to hold a sword. Mostly he taught me where to put my feet.
FROG (sad): For ten years I have gone back to the day he died. He never got to leave it.
FROG (sad): Is it wrong that I was glad to see him?
CHOICE: [Nod] / [Shake head]
- Nod:
  FROG (sad): Aye. I thought so too. I was glad anyway.
- Shake head:
  FROG (happy): …Thank thee. Then I will stay glad.
FROG (neutral): There is a number cut into the seed. Like a brand on cattle.
LUCCA (radio, neutral): Same as mine. It's a catalogue number. You two just robbed somebody's *inventory.* Nice work. I'm bringing the Epoch round.
LUCCA (radio, surprised): One thing. He told you where he's going next. Bad guys don't do that. Not unless they want you there.
FROG (angry): Cyrus is no "bad guy."
LUCCA (radio, neutral): Then he *really* wants you there.
FROG (determined): Then I will be there.
Reward: EXP +50, key item **Denadoro Seed (inert)**.
→ scene `eot`

---

## CHAPTER 2 — "Strong, Then Kind" (65,000,000 B.C.)

`[SCENE 2.1 — Ioka Village]`
MAP: `ioka` (prehistoric). MUSIC: `mus_ioka`.

Chapter card: **II. STRONG, THEN KIND** — 65,000,000 B.C.
KINO (surprised): Crono! Frog-man! Ayla gone! Ayla go fight rock-men alone! Kino say "wait." Ayla say "no." Ayla always say no!
FROG (neutral): Where?
KINO (sad): Old Tyrano place. Ground there go red again. And ghost-man there. Tall. Purple cape. Shine like moon on water.
KINO (surprised): Ghost-man come to Ioka first! Kino think: fight! But ghost-man… fix roof.
FROG (surprised): He what?
KINO (neutral): Hut pole lean since big storm. Ghost-man look at pole long time. Push pole straight. Say "there." Ask way to Tyrano place. Say *thank you.*
KINO (sad): Bad men no say thank you. Kino know bad men.
FROG (sad): That is Cyrus.
KINO (sad): Kino… Kino go too?
CHOICE: [Yes, come] / [Stay, protect village]
- Yes, come:
  KINO (happy): Kino brave! Kino stay behind you. Far behind.
- Stay, protect village:
  KINO (determined): Kino protect. Tell Ayla Kino not cry. Kino cry a little.

**FIELD** — the player walks. Objective: "Head north to the old Tyrano lair.". Save point.
- TALK — KINO:
  - *(if kino_choice = 0)*
    KINO (happy): Kino ready! Kino walk behind. Very behind.
  - *(otherwise)*
    KINO (determined): Kino guard fire. Fire safe. Kino… mostly safe.
- TALK — Villager:
  *Villager: "Ayla go. Ayla always go. Then Ayla come back and we dance. So we dance now. Practice."*
- TALK — Villager:
  *Villager: "Red sky over Tyrano place. Old people say bad. Young people say bad. Everybody agree! First time."*
- TALK — Villager:
  *Villager: "Frog-man! You eat bug? Kino say you eat bug. Kino lie?"*
  FROG (neutral): …Only on feast days.
- TALK — Trader:
  - *(if not has_lunch)*
    *Trader: "Chief run off, no eat. Chief fight bad when hungry. Chief fight *everybody* when hungry."*
    *Trader: "You take. Big rib. No sniff. Is for chief."*
    Reward: key item **Ayla's Lunch (do not sniff)**.
  - *(otherwise)*
    *Trader: "Good stone. Good bone. You like? You pay."*
  [Shop: `ioka`]
- LOOK (sparkle) — the bonfire:
  *The fire is high and well fed. One flat stone beside it is kept clear: the chief's seat. Someone has left a drumstick on it. Then, on reflection, a second drumstick.*
- LOOK (sparkle) — a hut pole:
  *Every pole in Ioka leans a little, as poles should. This one stands straight as a spear.*
  FROG (sad): He never could walk past a crooked thing.
- LOOK (sparkle) — footprints:
  *Bare footprints, heading north. Deep at the toes, and very far apart.*
  FROG (neutral): She did not walk.
- LOOK (sparkle) — a hollow bone:
  - *(if bone_taken)*
    *A hollow bone. It still smells of sweet-root.*
  - *(otherwise)*
    *A hollow bone, stoppered with wax. Inside: sweet-root paste. Ioka's idea of a tonic.*
    Reward: Tonic ×2.
- EXIT — `EXIT_NORTH` → scene `2.2`


`[SCENE 2.2 — Tyrano Crater]`
MAP: `tyrano_crater` (volcanic). MUSIC: `mus_tyrano`.

*(Ayla punches a stone imp clean off a ledge.)*
AYLA (happy): CRONO! FROG! Ayla know you come! Rock-men no fun. No scream. Just fall.
*(The rib arrives (if the trader's errand was run).)*
- *(if has_lunch and not lunch_eaten)*
  AYLA (surprised): …Crono smell like rib.
  AYLA (happy): RIB!
  FROG (surprised): …She ate the bone.
FROG (neutral): Ayla, the seed —
AYLA (angry): Ayla see. Ayla pull. Seed *bite* Ayla.
AYLA (angry): Ayla bite back. Seed win.
*(Cyrus appears on the rim.)*
CYRUS (neutral): Entry nine. Ayla, chief of Ioka. Never learned to read. Never had to.
CYRUS (neutral): Leave it, chief. It's rooting. My stone men feed it, it hatches, and this crater is a nursery by nightfall.
AYLA (angry): Ghost-man! You put bad egg in Ayla's ground!
CYRUS (sad): Your ground? You watched the sky-fire dig this hole, chief. You gave it its name. It's been *its* ground since that night.
FROG (angry): Cyrus, enough. Thou hast no place here.
CYRUS (neutral): Neither do you, Glenn. And yet.
*(The archive brings out an old enemy of Ayla's.)*
AYLA (surprised): Azala?!
AYLA (angry): No. Azala gone. Ayla stay and saw.
CYRUS (neutral): The archive keeps every enemy you ever had, chief. It thought you'd like the company.
AYLA (determined): Ayla beat Azala once. Ayla beat copy-Azala too. Then Ayla show ghost-man whose ground.
- *(if kino_choice = 0)*
  KINO (surprised): Kino go… guard back of crater! Very important back!
**AYLA joins the party.**

`BATTLE B2 — "Nursery"`
- MAP: `tyrano_crater`. MUSIC: `mus_battle_boss`. PARTY: CRONO, FROG, AYLA.
- ENEMIES: seedbearer ×3, echo_roundillo, echo_azala, iselle.
- OBJECTIVE: Defeat the three Seedbearers before the seed hatches! If the seed hatches: "The seed has hatched! Defeat everything!"
- TRIGGERS:
  - `B2_T1 PRE_BATTLE` — LUCCA (radio, neutral): Three stone imps are feeding that seed. Drop two and it stops growing. Drop all three and it dies. / LUCCA (radio, happy): Ayla — hi, big fan — you're the fast one. And see those ledges? *Push things off the ledges.* / AYLA (happy): Ayla like glasses-voice. / AYLA (angry): Copy-Azala! Wait there! Ayla break eggs first!
  - `B2_T2 TECH_USED(unit: ayla, tech: rollo_kick, knockedDown: true)` — AYLA (happy): Fall down go boom! / [Popup: Rollo Kick knocks the target back one tile. Knock a foe off a drop of 2 or more for bonus fall damage.]
  - `B2_T3 TURN_START(n: 2)` — CYRUS (neutral): You're breaking a roof-beam, Glenn. That seed holds the archive up. Leene is under that roof. Guardia. You. / FROG (angry): I never asked to be under it! / CYRUS (sad): Nobody asks. I didn't.
  - `B2_T4 COUNT_DEFEATED(enemyType: seedbearer, count: 2)` — AYLA (determined): One left! Crono hit! Ayla hold! EFFECT: APPLY_STATUS(last_seedbearer).
  - `B2_T5 UNIT_ENTERS_ZONE(unit: any_party, zone: RIM)` — CYRUS (determined): Fine. In person, then. EFFECT: SET_AI(iselle), PLAY_MUSIC(mus_battle_boss).
  - `B2_T6 UNIT_HP_BELOW(unit: iselle, pct: 40)` — CYRUS (sad): …You hit like someone who's never been told no. / AYLA (happy): Ayla told no many times. Ayla no listen. / CYRUS (happy): Ha. I had a squire like that. / CYRUS (neutral): Twelve thousand B.C. is next. The mage. Tell Magus the archive has built him an exhibit. Tell him what it's called: *Schala.* EFFECT: RIFT, DESPAWN(iselle), CLOSE_RIFT, SET_FLAG.
  - `B2_T6B COUNT_DEFEATED(enemyType: seedbearer, count: 3)` [requires !b2_hatched] — (if not b2_iselle_gone:) / CYRUS (neutral): The nest is gone. I don't hold empty ground. / CYRUS (neutral): Twelve thousand B.C. is next. The mage. Tell Magus the archive has built him an exhibit. Tell him what it's called: *Schala.* EFFECT: DESPAWN(iselle).
  - `B2_HATCH HATCH` — AYLA (angry): Egg open! Ayla smash baby before baby grow! EFFECT: SET_FLAG.
  - `B2_T7 UNIT_HP_BELOW(unit: ayla, pct: 30)` — AYLA (angry): Ayla not tired! Ayla… little tired. / FROG (neutral): Then lean on me a moment.
  - `B2_T9 UNIT_ADJACENT(a: ayla, b: azala)` — AYLA (angry): Azala smart. Azala never fight fair. / AYLA (determined): Copy-Azala not smart. Copy-Azala just loud!
  - `B2_T10 UNIT_DEFEATED(unit: azala)` — AYLA (sad): Azala gone again. / AYLA (angry): Last time, Azala *choose* to stay. This time nobody ask Azala. Ayla not like.
  - `B2_T8 VICTORY` — EFFECT: PLAY_MUSIC(mus_victory).
  - `B2_DEFEAT DEFEAT` — AYLA (sad): Ground… all red now.
- REWARDS: EXP 150, 600G, Mid Tonic ×2, Ether ×1.

→ scene `2.3`

`[SCENE 2.3 — Crater, after]`
MAP: `tyrano_crater` (volcanic). MUSIC: `mus_ayla_theme`.

*(Ayla yanks the seed out; its shell cracks and it goes inert.)*
AYLA (neutral): Ghost-man say ground belong to sky-fire.
AYLA (neutral): Ayla think ground belong to who stand on it. Ayla stand on it. Ayla's children stand on it. Sky-fire lie *under* it. Under not count.
AYLA (happy): That smart. Ayla say it again later. Louder.
CHOICE: [Help her up] / [Sit down next to her]
- Help her up:
  AYLA (happy): Crono strong. Ayla stronger. But nice.
- Sit down next to her:
  AYLA (happy): Good. Sit. Watch red go out of ground.
  *(beat)*
AYLA (sad): Ghost-man fight sad. Like man guarding empty hut.
FROG (sad): He guarded a pass, once. He lost it, and his life with it.
AYLA (neutral): Who beat him?
FROG (sad): …Magus.
AYLA (surprised): Blue-hair?! And ghost-man say name of Blue-hair's sister. Out loud. Ghost-man brave or stupid.
LUCCA (radio, happy): Seed two: done! Epoch's on its way down. Ayla, welcome aboard. Please don't punch the dashboard.
AYLA (happy): Ayla punch little.
LUCCA (radio, neutral): Also: he did it *again.* Told you the next stop and who to bring. That's not a villain. That's a tour guide.
AYLA (neutral): Is trap?
LUCCA (radio, neutral): It's absolutely a trap.
AYLA (determined): Trap with egg in it still have egg. We go.
Reward: EXP +50, key item **Tyrano Seed (inert)**.
→ scene `eot`

---

## CHAPTER 3 — "Schala's Name" (12,000 B.C.)

`[SCENE 3.1 — The Last Village]`
MAP: `last_village` (snow). MUSIC: `mus_last_village`.

Chapter card: **III. SCHALA'S NAME** — 12,000 B.C.
*(A man on a cliff with his back to everyone.)*
*(beat)*
ELDER (neutral): The blue-haired one came at dawn. He asked where the sea leaves the wreckage. I told him. He has not gone to look. He stands on the cliff and does not eat.
FROG (neutral): He is waiting for us. He would sooner drown than say so.

**FIELD** — the player walks. Objective: "Speak to Magus on the cliff." (while not magus_joined); then "Head north to the Zeal wreckage.". Save point.
- TALK — MAGUS *(while not magus_joined)*:
  MAGUS (neutral): You're late.
  FROG (surprised): Thou knew we were coming?
  MAGUS (neutral): A dead man told me.
  MAGUS (neutral): Yours, I believe.
  MAGUS (neutral): Last night. He stood where the boy is standing. No sword. He said he didn't blame me.
  *(beat)*
  MAGUS (neutral): I preferred him angry.
  MAGUS (neutral): Then he said the thing in the grey future has built an exhibit. And he told me what it's called.
  AYLA (neutral): Schala.
  AYLA (neutral): Ghost-man tell Ayla too. Say: tell Blue-hair. Ayla tell.
  MAGUS (neutral): He asked me to come quietly.
  AYLA (surprised): Blue-hair go quiet?
  MAGUS (angry): I told him to go back to his grave. He said "fair enough," and went.
  FROG (angry): Thou killed him. And he came to thee with no sword.
  MAGUS (neutral): Yes.
  *(beat)*
  FROG (sad): …That is the Cyrus I knew.
  MAGUS (neutral): It's bait. He hands out invitations like a butler. One for each of you. Now mine.
  MAGUS (angry): I'm going anyway. It has her name in its mouth.
  CHOICE: [Draw sword ("Then we take it back.")] / [Offer a hand ("Come with us.")]
  - Draw sword ("Then we take it back."):
    MAGUS (determined): …Good. I'd have despised sympathy.
  - Offer a hand ("Come with us."):
    MAGUS (neutral): Put that away. I'm not joining anything.
    MAGUS (neutral): …I'm walking in the same direction. Don't read into it.
  MAGUS (neutral): The wreck is north. He'll be in the great hall, where the light is best. I'll be *civil.*
  FROG (neutral): Thou wilt be nothing of the sort.
  MAGUS (neutral): No.
  **MAGUS joins the party.**
  [Popup: Magus fights beside you now. He has new combo techs with Crono and Frog. He won't call them that.]
  [Combo tech unlocked: `shadow_cyclone`]
  [Combo tech unlocked: `ice_water`]
  - *(if has_cat and not cat_given and magus_joined)*
    MAGUS (surprised): …Where did you get that.
    *(beat)*
    MAGUS (neutral): It's driftwood. Give it here. I'll dispose of it.
- TALK — ELDER:
  - *(if magus_joined)*
    ELDER (neutral): He moved. I had begun to think he was a stone the sea left.
    ELDER (sad): If you must go down there, go warm. The cold on that shore is older than we are.
  - *(otherwise)*
    ELDER (neutral): The sea took a kingdom that floated. Every winter it hands a little back. We do not go down to the shore when it does.
- TALK — Villager:
  *Villager: "The Zeal folk called us Earthbound, like it was a stain. Now the sky is empty and we are the ones with a roof."*
- TALK — Child:
  - *(if magus_joined)*
    *Child: "He blinked! When the frog shouted. That's one."*
  - *(otherwise)*
    *Child: "The blue man hasn't blinked all morning. Mama says don't stare. I'm not staring. I'm counting."*
- TALK — Villager:
  *Villager: "Tracks in the snow last night. A big man in armour, by the stride. But they don't sink. Nothing that heavy should walk that light."*
- TALK — Hunter:
  *Hunter: "Pelts, pine-pitch, and blades that won't crack in the cold. Trade?"*
  [Shop: `last_village`]
- LOOK (sparkle) — a crate of sea-wrack:
  - *(if has_cat)*
    *A cracked blue tile, a gold hinge, a spoon. What the sea gave back this winter.*
  - *(otherwise)*
    *What the sea gave back this winter: a cracked blue tile, a gold hinge, a spoon. And a small carved cat, the purple paint nearly gone.*
    Reward: key item **Carved Cat**.
  - *(if has_cat and not cat_given and magus_joined)*
    MAGUS (surprised): …Where did you get that.
    *(beat)*
    MAGUS (neutral): It's driftwood. Give it here. I'll dispose of it.
- LOOK (sparkle) — two sets of tracks:
  *Two sets of tracks at the cliff's edge, a pace apart. One sinks deep. The other only frosts the snow.*
  *They stood here a long while. Neither set comes any closer to the other.*
- LOOK (sparkle) — the old cave mouth:
  *The Earthbound lived under here while Zeal floated overhead. The roof is black with ten generations of cook-smoke.*
  AYLA (happy): Good cave. Ayla would stay.
- WALK-ON — zone `ice`:
  AYLA (happy): Ground slippy! Ayla like!
  FROG (neutral): I shall wait here. A frog on ice is a short tale with a sad end.
- EXIT — `EXIT_NORTH` → scene `3.2` (needs magus_joined; otherwise:)
  FROG (neutral): Not without him. I would rather have that man where I can see him.


`[SCENE 3.2 — Zeal Wreckage, great hall]`
MAP: `zeal_wreck` (zeal). MUSIC: `mus_zeal_wreck`.

MAGUS (neutral): The great hall. I was born forty paces from here. It was a good deal higher up.
*(The beached end of the hall can be walked. Crossing the middle of the hall starts the confrontation.)*

**FIELD** — the player walks. Objective: "Cross the hall toward the light.".
- LOOK (sparkle) — scratches on a fallen column:
  *Height marks, scratched into a fallen column. Two sets, side by side. The taller set stops. The shorter goes on a little way, alone. Then it stops too.*
  MAGUS (neutral): Keep walking.
- LOOK (sparkle) — a seam of red stone:
  *Dreamstone, cracked, still warm.*
  AYLA (happy): Red rock! Ayla had red rock! Crono win it. Drinking.
  FROG (surprised): Thou out-drank *Ayla?*
  AYLA (happy): Ayla let Crono win.
- LOOK (sparkle) — a broken mural:
  *A mural of the royal court. The queen's face has been chiselled out. Carefully, by someone who took their time.*
  MAGUS (neutral): Not mine. I'd have been less tidy.
- WALK-ON — zone `HALL_MID`: the field ends and the scene continues.

*(beat)*
*(Magus walks ahead of everyone and stops well short of the case.)*
MAGUS (neutral): That isn't her.
CYRUS (neutral): No. It's entry one thousand and one. Her shape, built from every record that mentions her. A name. A pendant. Her voice, in other people's letters.
CYRUS (neutral): The Curator thought you'd want to see how much of her was left.
MUSIC → `mus_magus_theme`.
MAGUS (angry): How much of her is left is not your archive's business.
CYRUS (sad): I said something like that. When I woke up in there, I asked what became of my squire. It showed me a frog.
CYRUS (sad): It said it could keep him. Safe. Nothing would be taken from him again. And I had watched things be taken from him.
FROG (angry): I do not need keeping, Cyrus!
CYRUS (determined): Everybody says that, Glenn. I said it. On the way down.
MAGUS (neutral): If we're trading losses, knight: I'm the one who killed you.
CYRUS (neutral): I know. I was there.
CYRUS (determined): I held a pass once. I lost it, and everything behind it. I'm not losing this one.
AYLA (angry): Ayla sorry ghost-man lose things. Ayla still break egg.
CYRUS (angry): I know you will, chief.

`BATTLE B3 — "The Exhibit"`
- MAP: `zeal_wreck`. MUSIC: `mus_battle_boss`. PARTY: CRONO, FROG, AYLA, MAGUS.
- ENEMIES: iselle, vitrine_sentinel ×2, echo_nu ×2, seedbearer.
- OBJECTIVE: Defeat Cyrus! (The seed is rooted — destroying the Seedbearer slows it.) If the seed hatches: "The seed has hatched! Defeat everything!"
- TRIGGERS:
  - `B3_T1 PRE_BATTLE` — LUCCA (radio, neutral): Those gold statues are Gallery Goons. Slow, heavy, and they'll wall off the aisles. Magus can float round them over the water. / LUCCA (radio, neutral): The stone imp by the seed is feeding it. Get it before the seed roots. Also, um. Magus? Hi. Please don't blow up the radio. / MAGUS (neutral): I'll consider it. / MAGUS (angry): And it kept *Ozzie.* Twice. Of everything in creation. / MAGUS (neutral): They'll heal the knight from behind someone braver. Kill them first.
  - `B3_T2 TURN_START(n: 2)` — CYRUS (neutral): Entry two, Glenn. Entry nine, Ayla. Entry one, Crono. And you. Janus, prince of Zeal. It files you under *lost property.* / MAGUS (angry): Take me off it.
  - `B3_T3 DUAL_TECH_USED(tech: shadow_cyclone)` — FROG (surprised): Thy shadow and Crono's blade make a fine pair. / MAGUS (neutral): Don't make it a friendship.
  - `B3_T4 UNIT_HP_BELOW(unit: iselle, pct: 60)` — CYRUS (angry): Preserve. / CYRUS (determined): I don't want to hurt you, Glenn. It turns out I don't have to want to. EFFECT: APPLY_STATUS(iselle), SPAWN(echo_nu).
  - `B3_T5 UNIT_ADJACENT(a: magus, b: iselle)` — MAGUS (neutral): Last time we stood this close, I killed you. / CYRUS (sad): I remember. It's most of what I have. / MAGUS (neutral): Then swing for your own reasons, knight. Not the Curator's. EFFECT: SWAP_BARKS(iselle).
  - `B3_T6 UNIT_HP_BELOW(unit: iselle, pct: 25)` — (beat) / CYRUS (broken): It's hollow. / CYRUS (broken): There's nothing in it. A shell with her face on. It told me she was *preserved.* / MAGUS (neutral): What did you think you were? / (beat) / CYRUS (sad): …Kill the stone man by the seed. The seed dies with it. I won't stop you. / CYRUS (sad): I can't help you, either. Glenn, I — EFFECT: SET_TEAM(iselle), SET_AI(iselle), SET_OBJECTIVE.
  - `B3_T7 UNIT_DEFEATED(unit: sbGuard)` — AYLA (determined): Three eggs. No more eggs? / LUCCA (radio, surprised): That was the last one. The grey door should be shutting — no. No, no. It's not shutting. It's *opening.*
  - `B3_HATCH HATCH` — MAGUS (angry): It's hatched. Kill it before it remembers what it's for.
  - `B3_T8 VICTORY` — EFFECT: PLAY_MUSIC(mus_victory).
  - `B3_DEFEAT DEFEAT` — MAGUS (angry): Pathetic. …Get up. I refuse to die in *her* hall.
- REWARDS: EXP 120, 900G, Mid Tonic ×2, Ether ×2, Revive ×1.

→ scene `3.3`

`[SCENE 3.3 — Hall, after]`
MAP: `zeal_wreck` (zeal). MUSIC: `mus_rift`.

*(Without the archive's armour he is a tired man kneeling in broken glass.)*
CYRUS (sad): Soldier's report. The seeds were bait. Three ages. Three of you, pulled out of your homes one at a time.
CYRUS (sad): Every swing you took at me, I logged. That was my post. It has your full measure now.
MAGUS (neutral): We'd guessed. For what?
CYRUS (neutral): A last exhibit. The four who ended Lavos, in one case, forever. With you on the shelf it doesn't need seeds. It doesn't need *years.*
AYLA (angry): Ayla no live in box.
CYRUS (neutral): It has opened its door. It isn't waiting for you to knock.
MAGUS (neutral): Get up.
CYRUS (surprised): You?
MAGUS (neutral): You know the building. And I took a life from you once. I'm not handing that *thing* the rest of it.
CYRUS (sad): It'll know I turned. It knows everything.
MAGUS (angry): I've been known by monsters before. It never did them any good.
FROG (sad): Cyrus. A knight guards the living. Thy words.
FROG (determined): Stand up straight.
CHOICE: [Offer a hand] / [Wait]
- Offer a hand:
  CYRUS (determined): …He has the look you had at his age, Glenn. Mule-stubborn. All right.
- Wait:
  *(beat)*
  CYRUS (determined): Don't help. A knight gets up on his own.
FROG (neutral): Then we go through the grey door. Together.
FROG (neutral): All of us.
MAGUS (neutral): Don't say "together."
*(beat)*
MAGUS (neutral): …Fine. *Together.* Once.
LUCCA (radio, neutral): I heard all that. The grey door is wide open on my readings. Epoch's on its way. And yes, the ghost can ride. He doesn't touch the controls.
Reward: EXP +50, key item **Zeal Seed (inert)**.
[CYRUS becomes a guest ally.]
[Popup: Cyrus joins as a guest ally for the battles in the Hollow.]
→ scene `eot`

---

## CHAPTER 4 — "The Museum of Never" (The Hollow)

`[SCENE 4.1 — The grey door]`
MAP: `end_of_time` (void). MUSIC: `mus_rift`.

Chapter card: **IV. THE MUSEUM OF NEVER** — THE HOLLOW
*(beat)*
CYRUS (determined): Stay close. Past this door nothing stays where you left it. Not even you.
FROG (determined): Lead on, Cyrus. Like before.
CYRUS (happy): Like before. Try to keep up this time.
GASPAR (sad): I'll keep the lamp lit, boy. It's the one thing I'm good at.
LUCCA (radio, neutral): Signal's breaking up already. If you can hear me in there… I'll keep talking. I always do.
→ scene `4.2`

`[SCENE 4.2 — Atrium]`
MAP: `hollow_atrium` (museum). MUSIC: `mus_hollow`.

*(beat)*
THE CURATOR: WELCOME. YOU ARE THE FIRST VISITORS. YOU ARE ALSO THE FINAL ACQUISITION. BOTH ARE HONOURS.
FROG (angry): Show thyself!
THE CURATOR: I AM ON DISPLAY THROUGHOUT. PLEASE WALK THE HALLS. EVERYTHING YOU HAVE LOST IS HERE, CORRECTLY LABELLED.
AYLA (sad): Ayla's village. In glass box. Little fire. Little Kino.
AYLA (angry): Kino not that little. Ayla HATE museum.
THE CURATOR: I NOTE YOU ARE CARRYING THREE ITEMS FROM MY COLLECTION. THANK YOU FOR RETURNING THEM. THE CLOAKROOM IS ON YOUR LEFT.
CYRUS (angry): Don't answer it. It talks like that until you forget you're standing in a grave.
THE CURATOR: WARDEN. ENTRY 0-A. YOU ARE OUT OF YOUR CASE. I WILL CORRECT THE LABEL AFTERWARD.
MAGUS (neutral): You'll be busy.
THE CURATOR: I AM NEVER BUSY. I AM COMPLETE.
*(beat)*
THE CURATOR: THE TOUR BEGINS. PLEASE STAY WITH YOUR GROUP.
*(The golden statues wake and step off their plinths; an Echo Avian Rex screeches from a gallery arch.)*

`BATTLE B4A — "The Tour"`
- MAP: `hollow_atrium`. MUSIC: `mus_battle`. PARTY: CRONO, FROG, AYLA, MAGUS + CYRUS (guest).
- ENEMIES: vitrine_sentinel ×4, echo_tyrano, echo_imp ×4.
- OBJECTIVE: Defeat the Echo Avian Rex!
- TRIGGERS:
  - `B4A_T1 PRE_BATTLE` — AYLA (angry): BIG BIRD-LIZARD! Ayla know this kind! Ayla fight them since Ayla small! / CYRUS (neutral): It's a copy. It has read every fight your people ever had with its kind. Break it and the tour stops. / AYLA (happy): Then it read that Ayla win.
  - `B4A_T2 UNIT_HP_BELOW(unit: tyrano, pct: 50)` — THE CURATOR: ENTRY 9 PERFORMS AS RECORDED. EFFECT: SPAWN(vitrine_sentinel), SPAWN(vitrine_sentinel).
  - `B4A_T3 ALLY_KO(unit: iselle)` — CYRUS (sad): …Go on. I'm already logged. It doesn't count. / MAGUS (angry): It counts.
  - `B4A_T4 VICTORY` — EFFECT: PLAY_MUSIC(mus_victory).
  - `B4A_DEFEAT DEFEAT` — THE CURATOR: THE TOUR HAS CONCLUDED. PLEASE REMAIN STILL.
- REWARDS: EXP 70, 1200G, Ether ×2, Revive ×1.

→ scene `4.25`

`[SCENE 4.25 — The East Wing]`
MAP: `hollow_gallery` (museum). MUSIC: `mus_hollow`.

THE CURATOR: THE EAST WING. RECENT ACQUISITIONS. YOU MAY READ THE LABELS. IN A SENSE, YOU WROTE THEM.
CYRUS (neutral): The Core is past the archive, through the far arch. Don't read the labels. That's how it gets in.
AYLA (happy): Ayla no read. Ayla safe.

**FIELD** — the player walks. Objective: "Walk the East Wing to the far arch.".
- LOOK (sparkle) — Entry 1:
  PLACARD: ENTRY 1. CRONO, OF TRUCE. ACQUIRED AT THE MILLENNIAL FAIR, IN MOTION. DESTROYED, 12,000 B.C. RESTORED BY THIRD PARTIES. CONDITION: GOOD. DOES NOT SPEAK.
  MAGUS (neutral): "Does not speak." The one accurate label in the building.
- LOOK (sparkle) — Leene's Bell:
  PLACARD: LEENE'S BELL (FULL RECORD). RUNG FOR ARRIVALS, FAREWELLS, AND ONE WEDDING. DOES NOT RING. RINGING IS WEAR.
  CHOICE: [Ring it anyway] / [Leave it]
  - Ring it anyway:
    *Tok.*
    AYLA (sad): Bell broken.
    CYRUS (sad): No. Kept.
- LOOK (sparkle) — Entry 2:
  PLACARD: ENTRY 2. GLENN, SQUIRE. SUPERSEDED BY ENTRY 2-B (AMPHIBIAN). 2-B IS LISTED AS A REPAIR.
  FROG (angry): A *repair.*
  CYRUS (happy): I'd have said an improvement. You never kept your guard up as a boy.
- LOOK (sparkle) — Entry 0-A, supporting material:
  PLACARD: ENTRY 0-A, SUPPORTING MATERIAL. GRAVE CAIRN, DENADORO. RECONSTRUCTION. STONES CORRECTED TO VERTICAL.
  CYRUS (neutral): Mine. It let me visit. I took that for kindness.
  - *(if flowers_laid)*
    FROG (neutral): There are no flowers on it.
    CYRUS (surprised): Flowers?
    FROG (sad): On the real one. From Leene. Crono carried them up.
    *(beat)*
    CYRUS (sad): …It wouldn't have kept those. They wilt.
  - *(otherwise)*
    CYRUS (sad): Tidy. Nobody has ever left anything on it. Nobody could.
- LOOK (sparkle) — Entry 9:
  PLACARD: ENTRY 9. AYLA, CHIEF. SUPPORTING MATERIAL: DWELLING, IOKA (TO SCALE). SUBJECT LEFT NO WRITTEN RECORD. RECONSTRUCTED FROM APPETITE.
  AYLA (happy): Ha! Box-thing know Ayla good.
  AYLA (angry): Hut too clean. Where bones? Ayla's hut have bones.
- LOOK (sparkle) — Entry 13:
  PLACARD: ENTRY 13. JANUS, PRINCE OF ZEAL. STATUS: LOST. SUPPORTING MATERIAL: A PENDANT (REPLICA). CAT: NOT RECOVERED. SEE ALSO: THE PROPHET; MAGUS; "BLUE-HAIR". ONE SUBJECT, FOUR LABELS. PLEASE SELECT ONE.
  MAGUS (neutral): No.
  - *(if cat_given)*
    MAGUS (neutral): "Cat: not recovered." It should check its facts.
- LOOK (sparkle) — Entries 3, 5 and 6:
  PLACARD: ENTRIES 3, 5, 6. THE PRINCESS. THE INVENTOR. THE MACHINE. NOT YET ACQUIRED. REPRESENTED BY THEIR VEHICLE (MODEL). ACQUISITION IS SCHEDULED.
  LUCCA (radio, angry): — *model?* Did that thing just call the Epoch a — kzzt — to-scale *insult* —
- LOOK (sparkle) — a blank placard:
  PLACARD: ENTRY 0. THIS LABEL HAS BEEN LEFT BLANK. THE COLLECTION DOES NOT DESCRIBE ITSELF.
  CYRUS (neutral): I asked it once what it was. It said "complete." I told it I was a knight. It wrote down "armour."
- WALK-ON — zone `MID`:
  THE CURATOR: PLEASE DO NOT LEAN ON THE GLASS, ENTRY 9.
  AYLA (angry): Ayla not lean. Ayla *push.*
  THE CURATOR: …YOUR FEEDBACK HAS BEEN RECORDED.
- EXIT — `EXIT_NORTH` → scene `4.3`


`[SCENE 4.3 — The Archive stacks]`
MAP: `hollow_archive` (museum). MUSIC: `mus_hollow`.

THE CURATOR: THE ARCHIVE. PLEASE DO NOT TOUCH THE RECORDS.
CYRUS (sad): Here. Zeal. The royal house. Everything it has on Schala.
CYRUS (sad): One tablet. A girl with a pendant, smiling at somebody shorter than she is. That's the whole record.
MAGUS (neutral): Put it back.
CYRUS (sad): Magus —
MAGUS (angry): Put. It. Back. I won't have her handled.
CYRUS (neutral): No. Someone ought to carry her out of here. I have the hands for it. They aren't good for much else now.
*(beat)*
MAGUS (neutral): …Don't drop it.
FROG (neutral): Is there a shelf for thee too, Cyrus?
CYRUS (neutral): Entry 0-A. Cyrus of Guardia. Died on Denadoro. Status: complete.
CYRUS (sad): I was never complete. I died with the pass still open behind me.
FROG (determined): Then we close it. Today.
CYRUS (determined): The Core is below us. It'll try to split us up in the stacks. Don't let it.
THE CURATOR: THE WARDEN IS CORRECT. SEPARATION IS EFFICIENT.
*(The shelves slide and the floor splits the party.)*

`BATTLE B4B — "Separation"`
- MAP: `hollow_archive`. MUSIC: `mus_battle_boss`. PARTY: CRONO, AYLA, FROG, MAGUS + CYRUS (guest).
- ENEMIES: seedbearer ×4, echo_hench ×4, echo_nu ×2.
- OBJECTIVE: Defeat all enemies! (Stop the Seedbearers from reaching the Ledger.)
- TRIGGERS:
  - `B4B_T1 PRE_BATTLE` — LUCCA (radio, neutral): I'm losing you — this place eats signal. Magus can cross the gap. Everyone else, hold your side. Crono — don't be a hero. / LUCCA (radio, neutral): …okay, be a *little* — / CYRUS (determined): Those stone men carry catalogue tablets. If two reach the Ledger up top, it files every one of us. Stop them. / CYRUS (neutral): Glenn. I'm on your side of it. Like old times. / FROG (happy): Then try to keep up.
  - `B4B_T2 UNIT_ENTERS_ZONE(unit: magus, zone: WEST)` — AYLA (surprised): Blue-hair come to Ayla's side? / MAGUS (neutral): The frog and his knight were reminiscing. I'd rather be hit.
  - `B4B_T3 DUAL_TECH_USED(tech: beast_toss)` — AYLA (happy): Ayla throw Blue-hair's boom! Good boom! / MAGUS (angry): You threw *me.* / AYLA (happy): Little bit.
  - `B4B_T4 ANY_ENEMY_ENTERS_ZONE(zone: LEDGER, count: 1)` — THE CURATOR: ONE OF TWO. / CYRUS (angry): Stop the second one!
  - `B4B_T5 ANY_ENEMY_ENTERS_ZONE(zone: LEDGER, count: 2)` — THE CURATOR: FILED. EFFECT: SHAKE, FILL_TILES, APPLY_STATUS(all_party).
  - `B4B_T6 COUNT_DEFEATED(enemyType: seedbearer, count: 4)` — CYRUS (determined): That's all its hands. Now it has to use its own. EFFECT: SHAKE, FILL_TILES.
  - `B4B_T7 VICTORY` — EFFECT: PLAY_MUSIC(mus_victory).
  - `B4B_DEFEAT DEFEAT` — THE CURATOR: SEPARATION WAS EFFICIENT.
- REWARDS: EXP 70, 1400G, Mid Tonic ×3, Shelter ×1.

→ scene `4.4`

`[SCENE 4.4 — The Core Exhibit]`
MAP: `hollow_core` (core). MUSIC: `mus_curator`.

FROG (neutral): Is everyone whole?
AYLA (angry): Ayla whole. Ayla angry.
THE CURATOR: THE COLLECTION IS COMPLETE. THE FOUR WHO ENDED THE WORLD-EATER. STEP INTO THE CASE, AND EVERY ERA IS SAFE FOREVER. UNCHANGING. UNENDING. UNHARMED.
FROG (angry): And unliving.
THE CURATOR: LIVING IS THE PROCESS BY WHICH THINGS ARE LOST. I HAVE CORRECTED IT.
MAGUS (surprised): That shape.
MAGUS (angry): That's the Prophet. You're wearing *me.*
THE CURATOR: IT IS THE SHAPE YOU WORE TO STAND NEAR HER. I ASSUMED IT WOULD PUT YOU AT EASE.
MAGUS (angry): It was a mask. You've made a mask of a mask.
CYRUS (broken): You "corrected" me. You caught me falling, and I have been falling ever since. Ten years. The same minute. Look at your work.
THE CURATOR: ENTRY 0-A IS INTACT.
CYRUS (angry): I'm *stuck!*
THE CURATOR: …
*(beat)*
THE CURATOR: …YOU ARE INTACT.
MAGUS (neutral): Once, then. For the thing that wore my face and put my sister's on a shell.
MAGUS (angry): Nothing you keep is kept. It's only *stopped.* And I have killed bigger things than you for wanting the world stopped.
CHOICE: [Draw sword]
CYRUS (sad): I'm half its making still. In there, it could turn my hand against you.
CYRUS (determined): So this one is yours. Glenn. Guard up.
FROG (determined): Watch me.
[CYRUS leaves the guest slot.]

`BATTLE B5 — "Entry 0"`
- MAP: `hollow_core`. MUSIC: `mus_curator`. PARTY: CRONO, FROG, AYLA, MAGUS.
- ENEMIES: curator.
- OBJECTIVE: Shatter the four placards.
- TRIGGERS:
  - `B5_T1 PRE_BATTLE` — LUCCA (radio, determined): Crono — the pedestals! It built its own weak points. Museums always do! Stand on one and hit it with a tech!
  - `B5_T2 PLACARD_SHATTERED(count: 1)` — THE CURATOR: THAT WAS A LABEL. LABELS ARE NOT LOAD-BEARING. / FROG (determined): Then why did it hurt thee?
  - `B5_T3 UNIT_HP_BELOW(unit: curator, pct: 75)` — THE CURATOR: ENTRY 2. GLENN. YOU KEPT ONE DAY FOR TEN YEARS. THEN I KEPT THE MAN. WE ARE COLLEAGUES. / FROG (sad): Aye. I was like thee, once. / FROG (angry): Then I put it down. Try it.
  - `B5_T4 UNIT_HP_BELOW(unit: curator, pct: 50)` — THE CURATOR: ENTRY 9. AYLA. YOUR PEOPLE WRITE NOTHING DOWN. IN THREE GENERATIONS NO ONE WILL KNOW YOUR NAME. I WOULD. I WOULD KEEP IT PERFECTLY. / AYLA (angry): Ayla not want *kept!* Ayla want *told!* By fire! LOUD!
  - `B5_T5 UNIT_HP_BELOW(unit: curator, pct: 25)` — THE CURATOR: ENTRY 1. CRONO. YOU DIED ONCE AND WERE RETRIEVED. YOU ARE ALREADY A RESTORED ITEM. YOU BELONG HERE. / CHOICE: [Shake head] / [Point sword at it] / MAGUS (neutral): He was retrieved by people who wanted him *back,* machine. Not by a shelf.
  - `B5_T6 UNIT_HP_BELOW(unit: curator, pct: 0)` — THE CURATOR: THE COLLECTION… REQUIRES… A HOST. I WILL BE THE HOST. I WILL BE THE SEED. EFFECT: FLASH, TRANSFORM(curator), HEAL(curator), PLAY_MUSIC(mus_curator_core), SHAKE, VOID_TILES, SPAWN(lavos_sprout), SPAWN(lavos_sprout), SET_OBJECTIVE, SET_FLAG.
  - `B5_T7 TURN_START(n: 1, phase: 2)` [requires b5_phase2] — MAGUS (determined): Its hide turns magic now. Steel, then. And I have one thing left to lend steel. / CYRUS (determined): Glenn! Magus! You said it once! / MAGUS (angry): …TOGETHER. / AYLA (determined): Ayla guard backs. You three — GO! EFFECT: UNLOCK_TECH(eclipse_blade).
  - `B5_T8 TECH_USED(unit: any, tech: eclipse_blade)` — THE CURATOR: THAT… IS NOT… IN THE RECORD. / FROG (determined): No. 'Tis new.
  - `B5_T9 UNIT_HP_BELOW(unit: curator, pct: 50)` [requires b5_phase2] — AYLA (happy): Big weird thing getting SMALL! / THE CURATOR: ENTRY 9 IS… INCORRECT.
  - `B5_T10 ALLY_KO(unit: any)` [requires b5_phase2] — first living speaker only — FROG (determined): Stand up! Stand up *straight!* / AYLA (angry): Get UP! / MAGUS (angry): Don't you *dare* become an exhibit.
  - `B5_T11 UNIT_HP_BELOW(unit: curator, pct: 10)` [requires b5_phase2] — THE CURATOR: IF I END… THE ARCHIVE ENDS. ENTRY 0-A ENDS. WARDEN… / CYRUS (sad): I ended on Denadoro, ten years ago. You just wouldn't file it. / CYRUS (determined): File it.
  - `B5_T12 VICTORY` — (beat) EFFECT: PLAY_MUSIC.
  - `B5_DEFEAT DEFEAT` — THE CURATOR: ACQUIRED.

→ scene `4.5`

`[SCENE 4.5 — The Core collapses]`
MAP: `hollow_core` (core). MUSIC: `none`.

MUSIC → silence.
*(beat)*
*(The red knot flickers, shrinks to a grey seed, and goes still.)*
*(beat)*
*(The museum dissolves into scanlines; the display cases pop like soap bubbles.)*
*(beat)*
*(Somewhere in the halls, a bell that was never allowed to ring, rings.)*
*(beat)*
MUSIC → `mus_ending`.
CYRUS (neutral): That's the bell in the East Wing. It never let that ring.
CYRUS (neutral): It's coming apart. All of it. The halls. The shelves. Me.
*(The archive's armour falls away; the man underneath is only Cyrus.)*
FROG (sad): Cyrus —
CYRUS (broken): Don't, Glenn. It's the right end. I died on that mountain. I'm only finishing.
CYRUS (neutral): Magus. Here.
CYRUS (broken): Not a case. A pocket. Somewhere that moves.
MAGUS (neutral): …Why me?
CYRUS (happy): Because you'll carry her somewhere. It's all any of us wanted.
MAGUS (neutral): I'll keep it badly. I'll lose it weekly.
CYRUS (happy): Good. That's living.
- *(if cyrus_knows_flowers)*
  CYRUS (happy): Thank the Queen for the flowers. Tell her they'll have wilted by now. Tell her that's the good part.
FROG (sad): I never thanked thee. For any of it.
CYRUS (happy): You have. Ten years, every time you drew that sword.
CYRUS (neutral): Stand up straight. Go home. And let the mountain be a mountain.
CYRUS (neutral): Crono. You never said a word to me.
CHOICE: [Nod] / [Bow]
- Nod:
  CYRUS (happy): …Yes. That was enough.
- Bow:
  CYRUS (surprised): Ha! Far too gallant. Glenn, you've been a bad influence.
AYLA (sad): Ghost-man brave. Ayla remember. Ayla tell fire.
CYRUS (happy): Tell it loud.
*(beat)*
Reward: key item **Schala's Record**.
*(The floor drops away into white; a blue Gate opens under the party.)*
LUCCA (radio, surprised): — hear me? Crono! A Gate's opening right under you! A real one, a *blue* one! JUMP!
*(beat)*
→ scene `5.1`

---

## EPILOGUE — "Tomorrow, Unwritten"

`[SCENE 5.1 — End of Time, epilogue]`
MAP: `end_of_time` (void). MUSIC: `mus_ending`.

Chapter card: **EPILOGUE. TOMORROW, UNWRITTEN** — THE END OF TIME
GASPAR (happy): Three doors. That's the right number of doors.
GASPAR (happy): You're carrying something, mage.
MAGUS (neutral): Lost property.
MAGUS (neutral): It's none of your concern.
GASPAR (neutral): Nothing is. That's the job.
FROG (sad): Cyrus is gone, Gaspar. Truly, this time.
GASPAR (neutral): Then his long day is over. Yours too, knight. You may sit down.
GASPAR (happy): Go home, all of you. Someone in 1000 A.D. has been ringing a bell at the Gate all night. Badly.
→ scene `5.2`

`[SCENE 5.2 — Leene Square, dawn]`
MAP: `leene_square` (dawn). MUSIC: `mus_ending`.

MARLE (happy): One, two, three, four — all your limbs! You listened!
LUCCA (happy): The radio died for six hours. Six. I aged a decade and invented two things out of nerves.
ROBO (neutral): I found the address the numbers came from. 2300 A.D. The archive dome.
ROBO (happy): There is a meadow there now. There are sheep. I did not record it. I stood in it.
*(The Warden's last message always plays.)*
LUCCA (neutral): Oh — the last thing the radio caught before it died. A man's voice. Very polite. "Entry filed. Tell Glenn to stand up straight." Friend of yours?
FROG (sad): Aye. He was my teacher.
FROG (happy): He still is.
ROBO (neutral): I have made a decision. I am deleting my recording of Lucca dancing. Some things are better remembered than kept.
LUCCA (surprised): …Thank you?
MARLE (angry): Wait, I never got to see it!
ROBO (happy): I will tell you about it instead. It gets better every time.
FROG (happy): Then 'tis done. I am going home. And the next time I climb that mountain, it will only be a mountain.
*(Ayla's farewell always plays.)*
AYLA (happy): Ayla go home too. Ayla tell fire about ghost-knight. Tell it loud, like he say.
AYLA (happy): Kino cry when Ayla leave. Kino cry when Ayla come back. Kino good at cry.
MARLE (neutral): Magus?
MAGUS (neutral): Somewhere there's a year in which a girl named Schala is not a shell on a plinth. I mean to find it. Don't follow.
FROG (neutral): We won't.
MAGUS (neutral): …Frog.
FROG (neutral): Aye?
*(beat)*
- *(if eclipse_uses > 1)*
  MAGUS (neutral): …Together. There. That is the last time I say it.
- *(otherwise)*
  MAGUS (neutral): Nothing.
*(beat)*
FROG (happy): That was "thank you." He will deny it.
CHOICE: [Ring the bell]
*(beat)*
Text on black: **"Every record ends. That's how you can tell it was a life."**
→ credits

---

`[SCENE 5.3 — Credits]`
MUSIC: `mus_credits`. Stills, in order:
- The Millennial Fair, lanterns lit again.
- Denadoro. Only a mountain. *(if flowers_laid: "Denadoro. Only a mountain. Somebody keeps leaving flowers.")*
- Ayla tells it loud. Kino sleeps through the good part.
- The Last Village, at dawn.
- Schala, in a pocket. Still lit. *(if seed_hatched: "Schala, in a pocket. Dark, but carried.")* *(if cat_given: "Schala, in a pocket. Still lit. Next to a wooden cat.")*
- Sir Glenn, home.
- Under Leene's Bell.
- Nothing. And then, something green.

<!-- SCRIPT:END -->

---

## 7. ENDINGS & FLAGS

- **Single ending.** These always play: Lucca's last radio message ("Entry filed. Tell Glenn to stand up straight.") with Frog's answer, Cyrus's farewell to Frog in 4.5, and Ayla's farewell.
- `seed_hatched` — if no seed hatched in Battles 1–3, the credits still of Magus shows Schala's record **lit** ("Schala, in a pocket. Still lit."); otherwise "Dark, but carried."
- `eclipse_uses > 1` — Magus's parting "Nothing." becomes "…Together. There. That is the last time I say it."
- `kino_choice` — Kino comes to the crater (and runs for it) or stays to guard the fire.
- Optional finds (see §6, *Between battles*):
  `has_flowers` → `flowers_laid` → `cyrus_knows_flowers` (the cairn exhibit, Cyrus's "Thank the Queen for the flowers", the Denadoro credits still);
  `has_lunch` → `lunch_eaten` (the rib); `has_cat` → `cat_given` (the carved cat; Entry 13; a credits caption);
  `rang_replica` (the bell that does not ring); `cache_taken`, `bone_taken` (items).
- `magus_joined` — set when the player speaks to Magus on the cliff; the Last Village's north exit needs it.
- Field bookkeeping: `seen_<scene>_<spot>` (a sparkle looked at), `ev_<scene>_<event>` (walk-on beat fired), `t_<scene>_<npc>` (times talked to), `gaspar_heard` (Gaspar has said his piece for this visit).

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
