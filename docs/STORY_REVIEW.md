# Story review and beat sheet

Narrative pass on *Chrono Trigger: The Hollow Future*. Part 1 is the critique of the script as it
stood (read line by line in `story.js` and played through with screenshots). Part 2 is the plan the
rewrite follows. The script itself is in `public/js/story.js`, mirrored in `docs/SCRIPT.md` §6.

---

## Part 1. Review of the previous script

**What already worked.** The premise (an archive that refuses to be deleted), Cyrus as the spine of
the villain side, Robo's "I never delete anything a friend made", Ayla's "ground belong to who stand
on it", the Curator's "LABELS ARE NOT LOAD-BEARING", Magus's "Don't say together", the final card.
These are kept.

### The ten biggest problems

1. **The theme was argued out loud, early and often.** "Kept versus gone" was debated in the same
   words in B2 ("Those things are not kept, they are trapped!" / "Trapped is better than gone"), in
   3.2 ("That's the whole war"), and again in 4.4. By the time Magus says "Nothing you keep is kept.
   It's only stopped", three people had already said it for him.
2. **Cyrus spoke in thesis statements.** "I failed all three of you once. I won't do it again." "So
   let's be honest. I plant this, and nothing any of us lost is ever lost again." A soldier who
   explains his own motivation every time he appears.
3. **Interludes only shuttled the party.** Throne room: the King names the mission, Frog already
   knows it is a Lavos seed and where it is. Ioka: Kino says where Ayla went. Last Village: a
   cutscene, then a field whose only purpose was the exit. Every NPC had one static line and
   nothing in any field could be looked at. Nothing found in one scene mattered in another.
4. **Chapter 4 had no breath.** Three battles in a row with one cutscene each. The best idea in the
   setting (a museum of the party's own past) was one line of Ayla's.
5. **The big reveal was unearned.** Cyrus twice announces where he is going next and whom to bring;
   nobody notices. Then 3.3 delivers "the seeds were never the plan, they were bait" as a
   five-line lecture from a kneeling man.
6. **The turn of the villain's lieutenant happened in a muddled battle trigger.** In 3.2 the Schala
   exhibit is "built from every record"; in B3 "her case is empty"; the player cannot tell what
   Cyrus saw that broke him. Then Magus, who told him to go back to his grave one scene earlier,
   offers him "a better use for what's left of your life".
7. **Hub arrivals were recaps.** Gaspar: "One seed pulled. The grey door flickered. Good. You met a
   face you buried." He told the party what had just happened and which door was next. He also
   spoiled the Cyrus reveal in the Prologue ("that future keeps even the dead").
8. **"Stand up straight" paid off twice and was never set up.** It appeared only in Cyrus's
   farewell and the epilogue radio message.
9. **Voice drift.**
   - Frog: stacked archaisms the brief forbids ("Thou always knowest", "why didst thou flinch",
     "Thou shouldst try it", "What dost thou mean"), and he slid between *thou* and *you*.
   - Magus: narrated his own feelings for five consecutive lines in 3.1 ("it's more of my sister
     than I've had since I was a child"; "I'd rather Schala were alive somewhere and hated me").
   - Gaspar: an explainer rather than a sleepy man who says things sideways.
   - Lucca: tactical read-outs, few jokes; the Curator: sometimes generic ("I HAVE SOLVED IT").
10. **Dropped threads and soft spots.** Lucca's seed in the lab and Robo's trip to 2300 never came
    back. Filler lines ("See?", "Well said.", "Nice work, you two. Next stop: the End of Time.").
    Scenes were talked, not staged: characters stood in a row and took turns.

### By scene

| Scene | Problem |
|---|---|
| 0.2 Fair | Good. Robo's "signal getting closer" is generic; Marle's "See?" is filler. |
| 0.3 After | "Speak plainly, Lucca" followed by a second explanation of the first. The seed is just "a piece of Lavos": nothing to follow up. |
| 0.4 End of Time | Gaspar explains the whole plan, then spoils Chapter 1's reveal. No reason given for why 600 A.D. is first. |
| 1.1 Throne | Frog explains the plot to the King. Leene describes Cyrus so exactly there is nothing left to discover. Field: five one-line NPCs. |
| 1.2 Pass | The reunion is the best scene, but Cyrus states his motive in full. The cairn is a two-line stop. |
| 1.3 Shrine | Frog states his arc ("we bring him home or lay him to rest"). Lucca's line is a taxi announcement. |
| Hub ×3 | Recap, pointer to the next door, door lights. Identical shape each time. |
| 2.1 Ioka | Pure hand-off. The villagers have the best jokes in the game and nothing to do with the story. |
| 2.2 Crater | Works. "It was never your ground, it's *its* ground" is vague when CT gives a concrete reason (Ayla watched Lavos fall and named it). |
| 2.3 After | Good core. "Well said." Lore dump about Schala that Ayla already knows. |
| 3.1 Village | Magus monologues. The field after it is dead time. |
| 3.2 Hall | Cyrus: "That's the whole war." |
| 3.3 After | Exposition, then an unearned invitation. The strongest image (a man on his knees without his armour) is hidden behind the party sprites. |
| 4.1–4.4 | No walking. The Schala tablet scene is good but Magus explains himself. Cyrus's "I'm *stuck!*" and the Curator's pause are the best beat in the chapter; kept. |
| 4.5 | Good. "Stand up straight" lands softly because it is new. Cyrus is hidden behind Ayla. |
| 5.2 | Good. Robo's 2300 thread is a joke about "readings nominal" instead of a pay-off. |

Also found while walking the fields for real: in Chapter 4's hub Cyrus stood **on** the grey
door's tile, so a human player could not enter the Hollow at all (the autoplay teleports, so it
never showed). Fixed.

---

## Part 2. Beat sheet for the rewrite

**Rule of the rewrite:** nobody argues the theme. It is carried by objects and habits, and each
object is seen at least twice. Length: mandatory path about the same as before; everything added
is optional and short.

### Through-line per chapter

| Chapter | Emotional through-line | The turn | The image |
|---|---|---|---|
| Prologue | One night of joy with a loose thread in it. | The seed has a catalogue number: someone is keeping inventory. | A grey rift opening in the middle of a dance. |
| 1. The Knight Who Stayed | Frog thinks he made his peace with the mountain. | The first thing the "ghost" says is what Cyrus always said: "Stand up straight, Glenn." | A cairn somebody has rebuilt dead straight. |
| 2. Strong, Then Kind | Ayla knows whose ground it is, and knows grief when it swings at her. | The enemy fixed a roof and said thank you. | Ayla pulling the seed out with her hands, then sitting to watch the red go out of the ground. |
| 3. Schala's Name | The man who killed Cyrus and the man who mourned him enter one hall. | The exhibit is hollow: "What did you think you were?" | A man without his armour kneeling in broken glass; Frog telling *him* to stand up straight. |
| 4. The Museum of Never | Your life behind glass, correctly labelled, is not your life. | The Curator pauses for the first time ("…YOU ARE INTACT"). | A bell that was never allowed to ring, ringing once as the halls come apart. |
| Epilogue | Everything set up comes home. | Robo deletes the recording on purpose. | Crono ringing the real bell at dawn. |

### Set-ups and pay-offs

| Set-up | Where | Pay-off | Where |
|---|---|---|---|
| "I never delete anything a friend made" | 0.2 | "Some things are better remembered than kept" / "I will tell you about it instead. It gets better every time." | 5.2 |
| A number engraved on the seed | 0.3, 1.3 | "Entry nine", the placards, "It files you under lost property", "Lost property." | 2.2, B3, 4.25, 5.1 |
| Robo goes to find who writes the numbers | 0.3 | "There is a meadow there now. I did not record it. I stood in it." | 5.2 |
| "He's had a very long day" (Gaspar) | 0.4 | "His. Ten years of the same one." / "I have a minute. I've been in it ten years." / "Then his long day is over." | hub, hub, 5.1 |
| The gate lantern set straight; the collar; the hut pole | 1.1, 2.1 | "You piled them crooked. I fixed it." / "STONES CORRECTED TO VERTICAL" | 1.2, 4.25 |
| "Stand up straight, Glenn" | 1.2 | Frog to Cyrus on his knees; Frog in B5 ("Stand up *straight!*"); Cyrus's last words; the radio | 3.3, B5, 4.5, 5.2 |
| "Your guard is still too low" | B1 | "*Now* your guard is up." / "You never kept your guard up as a boy." / "Glenn. Guard up." | B1, 4.25, 4.4 |
| Leene's flowers (optional) | 1.1 → 1.2 | The museum's cairn has none: "It wouldn't have kept those. They wilt." / "Tell her that's the good part." / credits still | 4.25, 4.5, credits |
| Cyrus names the next era, twice | B1, B2 | Lucca: "That's not a villain. That's a tour guide." Magus: "invitations like a butler." Cyrus: "Soldier's report. The seeds were bait." The Curator: "THE TOUR BEGINS." | 1.3, 2.3, 3.1, 3.3, 4.2 |
| The grey door's noise (hum, purr, tune, knocking) | hub | It opens its own door: "You pull three seeds, and it says thank you." | hub after Ch. 3 |
| "Never learned to read. Never had to." | 2.2 | "Ayla no read. Ayla safe." / "I WOULD KEEP IT PERFECTLY." – "Ayla not want *kept!* Ayla want *told!*" / "Tell it loud." | 4.25, B5, 4.5, 5.2 |
| Azala "stay and saw" | 2.2 | "Last time, Azala *choose* to stay. This time nobody ask Azala." | B2 |
| A carved cat (optional) | 3.1 | "CAT: NOT RECOVERED." – "It should check its facts." / credits caption | 4.25, credits |
| Height marks (squires on a pillar; two children on a column) | 1.1, 3.2 | "Keep walking." | 3.2 |
| "Don't say together." – "…Fine. *Together.* Once." | 3.3 | "You said it once!" – "…TOGETHER." / "That is the last time I say it." | B5, 5.2 |
| "DESTROYED, 12,000 B.C. RESTORED BY THIRD PARTIES." | 4.25 | "YOU ARE ALREADY A RESTORED ITEM." – "by people who wanted him *back,* machine." | B5 |
| The bell (rings; hangs behind glass, "RINGING IS WEAR"; "No. Kept.") | 0.2, 4.25 | Rings once in the collapse; Crono rings the real one | 4.5, 5.2 |
| "All your limbs. I've counted them." | 0.3 | "One, two, three, four — all your limbs!" | 5.2 |

### Motifs

- **The bell.** Arrivals and farewells. The museum's copy cannot ring.
- **Entries and labels.** The Curator's way of seeing: numbers, placards, "condition: good". People
  answer it by mislabelling on purpose ("Lost property." "No.").
- **Standing up straight.** Cyrus sets things straight wherever he goes. It is his kindness and his
  flaw: he could not leave a crooked thing, including a death.
- **Kept versus remembered.** Kept things do not wilt, ring, blink or get better in the telling.

### What each interlude is for

| Interlude | Why we go | What the player can do (all optional except the way on) | What changes |
|---|---|---|---|
| End of Time, after Prologue | One door is already rattling; Gaspar has one lamp. | Gaspar, Nu (shop), Spekkio; look at the lamp and the place where the bucket was. | Learn the rule: pull the seeds and the door "ought to" weaken. |
| Throne room (1.1) | The pass, the red glow, a knight who set the lantern straight. | Leene gives **flowers for the cairn**; a banner with no dust; squires' height notches; the gate guard's collar. | We know who is on the mountain before Frog will say it. |
| Foot of Denadoro (1.2) | — | Walk to the climb. The cairn (rebuilt straight; lay the flowers), Cyrus's old cache ("for the way down", a Mid Tonic), tracks that only frost the grass. | Stepping onto the climb starts the reunion. |
| Hub after Ch. 1 | Cyrus named Ayla's age. | Gaspar's new read; the grey door now *purrs*. | The door reacted the wrong way. First doubt. |
| Ioka (2.1) | Ayla went alone; the ghost fixed a roof. | The trader's errand (**Ayla's lunch**), the straight pole, her running footprints, a hollow bone of tonic, the bug joke. | The enemy is decent. Lucca will call it a tour. |
| Hub after Ch. 2 | Cyrus named Schala for Magus. | Ayla meets Gaspar; knocking behind the grey door. | Frog's hand is on his sword. |
| Last Village (3.1) | Magus is waiting and will not say so. | **Walk to Magus** (he joins on the cliff), sea-wrack with a **carved cat**, two sets of tracks, the cave, the ice. NPCs change once he has moved. | The party says "bait" aloud and goes anyway. |
| Zeal wreck (3.2) | — | Walk the beached end of the hall: height marks, dreamstone (the drinking contest), a defaced mural. | Crossing the hall starts the confrontation. |
| Hub after Ch. 3 | The door has opened itself. | Cyrus by the door (two conversations), Spekkio and the Nu react. | Cyrus is with us. |
| East Wing (4.25) | The only way to the Core. | **Eight exhibits of the party's own past**, each a placard and a reaction; try the bell; Ayla and the glass. | The theme is shown, not argued. Sets up the collapse and B5. |

### Staging rules used

Silences are scripted (`wait`), not written. Characters move before they speak: Frog edges toward
the rift, snaps to attention at Cyrus's voice, walks to the end of the pier; Magus does not turn;
Ayla walks up and inspects the Guru of Time. Nobody stands in front of the person the scene is
about (3.3 and 4.5 were re-blocked after screenshots showed Cyrus hidden behind the party).
