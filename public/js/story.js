// story.js — content module: CT.SCENES, CT.BATTLES, CT.CREDITS, CT.STORY_START.
// The script lives here; docs/SCRIPT.md §6 mirrors it line for line, and
// docs/STORY_REVIEW.md holds the critique and beat sheet this version was written to.
// Contract: docs/ENGINE_SPEC.md (§6 markers/zones, §7 scene commands, §8 battles, §9 ids).
//
// Conventions / small extensions the engine honours:
//  * Several actors may be placed or walked to the same marker (e.g. the
//    party arriving together). A spawn on an occupied tile uses the nearest
//    free tile; a `move` onto an occupied tile stops beside it ("walk up to").
//  * Dialogue keeps the script's *emphasis* asterisks.
//  * Trigger `requires: 'flag'` — the trigger may only fire while that flag
//    is truthy (set in-battle with SET_FLAG). Used for B5 phase-2 triggers.
//    `TURN_START {n, phase: 2}` counts rounds from the moment the flag is set.
//  * Trigger `lineMode: 'first_alive'` — play only the first line whose
//    speaker is a living party member (B5_T10).
//  * FREE_ACTION `target: 'trigger_unit'` = the unit that fired the trigger.
//  * Objective `secondary` = second banner line.
//  * Guest `hpPctIf: {flag, pct}` — start at pct% HP when flag is set.
//  * TRANSFORM may carry `immortal`, `ai`, `hp` overrides for the new form.
//  * Unit `scale: 'party'` — level scales to the party average (Spekkio).
//  * Status ids are lower-case: slow, stasis, catalogued.
//  * Credits still `variants: [{if, caption, actors, vfx, decor}]` — first variant
//    whose `if` holds replaces the base still's fields.
//  * Field mode (scene.js): `spots` are examinable things that sparkle until
//    looked at, `events` are walk-on banter/triggers, `hint` is the objective
//    tracker (string, or [[cond, text], ..., fallback]), ['endfield'] hands
//    control back to the scene script.
//
// Story flags the script sets and reads (all optional finds; none gate the plot):
//   has_flowers / flowers_laid   Leene's flowers, carried from the throne room to Cyrus's cairn
//   cyrus_knows_flowers          ...and noticed missing on the museum's copy of the cairn (4.25)
//   has_lunch / lunch_eaten      Ayla's forgotten rib, carried from Ioka to the crater
//   has_cat / cat_given          a carved cat the sea gave back, handed to Magus
//   rang_replica                 Crono tried the bell that does not ring
//   magus_joined                 gates the Last Village's north exit
(function () {
  const CT = (window.CT = window.CT || {});

  // ---------------------------------------------------------------- helpers
  const say = (who, emo, text, opts) => (opts ? ['say', who, emo, text, opts] : ['say', who, emo, text]);
  const radio = (who, emo, text) => ['say', who, emo, text, { radio: true }];
  const V = (text) => ['say', 'curator', 'neutral', text];          // VESPER box
  const N = (text) => ['say', 'narrator', 'neutral', text];
  const P = (text) => ['say', 'narrator', 'neutral', text, { name: 'Placard' }];   // the Curator's labels
  const L = (who, emo, text, opts) => (opts ? [who, emo, text, opts] : [who, emo, text]);
  const RL = (who, emo, text) => [who, emo, text, { radio: true }];
  const VL = (text) => ['curator', 'neutral', text];
  const victoryMusic = (id) => ({ id, when: 'VICTORY', effect: [{ type: 'PLAY_MUSIC', track: 'mus_victory' }] });

  // Small things the party can carry between scenes.
  Object.assign((CT.KEY_ITEMS = CT.KEY_ITEMS || {}), {
    leene_flowers: `Leene's Flowers`,
    ayla_lunch: `Ayla's Lunch (do not sniff)`,
    carved_cat: 'Carved Cat',
  });

  // Scenes that end a chapter hand over to the End of Time hub.
  const toHub = (progress, gasparLine, openFlag, closeFlag) => [
    ['setflag', closeFlag, false],
    ['setflag', openFlag, true],
    ['setflag', 'progress', progress],
    ['setflag', 'gaspar_after', gasparLine],
    ['fade', 'out', 800],
    ['sfx', 'sfx_epoch_fly'],
    ['wait', 600],
    ['goto', 'eot'],
  ];

  const S = {};

  // =====================================================================
  // PROLOGUE — "The Last Firework"
  // What it's for: one night of joy with a loose thread in it. Sets up the bell,
  // Robo's recording (kept), and the first catalogue number.
  // =====================================================================
  S['0.2'] = {
    title: 'Leene Square, night',
    map: 'leene_square', theme: 'night', music: 'mus_fair_night',
    actors: [
      { id: 'crono', at: '@crono', face: 'N' },
      { id: 'lucca', at: '@lucca', face: 'W' },
      { id: 'robo', at: '@robo', face: 'W' },
      { id: 'fair1', sprite: 'fairgoer', at: '@fair1', face: 'S' },
      { id: 'fair2', sprite: 'fairgoer_b', at: '@fair2', face: 'E' },
      { id: 'fair3', sprite: 'fairgoer_c', at: '@fair3', face: 'W' },
      { id: 'fair4', sprite: 'fairgoer_d', at: '@fair4', face: 'N' },
    ],
    script: [
      ['chapter', 'PROLOGUE. THE LAST FIREWORK', '1000 A.D.'],
      ['party', ['crono', 'frog']],
      ['camera', '@bell', 0],
      ['fade', 'in', 800],
      ['par', [['anim', 'fair2', 'spin'], ['anim', 'fair3', 'spin'], ['emote', 'fair1', '♪'], ['emote', 'fair4', '♪']]],
      ['wait', 600],
      // Marle runs up. Crono has been standing alone under the bell.
      ['spawn', { id: 'marle', at: '@gate', face: 'S' }],
      ['move', 'marle', '@marle', { run: true }],
      ['face', 'marle', 'crono'],
      ['face', 'crono', 'marle'],
      say('marle', 'happy', `Found you! The whole fair is toasting the boy who beat Lavos, and the boy is hiding behind a bell.`),
      say('marle', 'happy', `Lucca says you owe her a dance. She's lying. Lucca can't dance.`),
      ['face', 'lucca', 'marle'],
      say('lucca', 'angry', `I *can* dance. I have chosen, for the public good, not to.`),
      ['face', 'robo', 'lucca'],
      say('robo', 'happy', `I recorded Lucca dancing at the last fair. The file is stored where no one will ever find it.`),
      say('lucca', 'angry', `Delete it.`),
      say('robo', 'happy', `I never delete anything a friend made.`),
      say('lucca', 'sad', `It's four seconds long and I fall over in three of them.`),
      say('robo', 'neutral', `Three point two.`),
      ['choice', ['Dance with Marle', 'Look at the bell'], [
        [
          ['par', [['anim', 'crono', 'spin'], ['anim', 'marle', 'spin']]],
          ['emote', 'marle', '♪'],
          ['wait', 1200],
          say('lucca', 'happy', `Disgusting. Carry on.`),
        ],
        [
          ['move', 'crono', '@bell'],
          ['face', 'crono', 'N'],
          ['anim', 'crono', 'point'],
          ['sfx', 'sfx_leene_bell'],
          ['wait', 900],
          ['face', 'marle', 'crono'],
          say('marle', 'sad', `It rang the day I ran into you.`),
          say('marle', 'happy', `…I think it likes you.`),
        ],
      ], 'c_fair'],
      // Frog approaches in his cloak; fairgoers give him a wide berth.
      ['spawn', { id: 'frog', at: '@gate', face: 'S' }],
      ['move', 'frog', '@frog'],
      ['par', [['emote', 'fair2', '!'], ['emote', 'fair3', '...']]],
      ['face', 'crono', 'frog'],
      ['face', 'marle', 'frog'],
      say('frog', 'neutral', `A fine night. Lanterns. Music. No one screaming.`),
      say('frog', 'neutral', `I do not trust it.`),
      say('marle', 'happy', `Frog! I thought you went home to 600!`),
      say('frog', 'sad', `I tried. The Gate would not open. I stood before it an hour, like a man outside a locked inn.`),
      ['face', 'lucca', 'frog'],
      say('lucca', 'surprised', `Gates don't lock. They're holes. You can't lock a *hole* —`),
      ['emote', 'robo', '!'],
      say('robo', 'surprised', `Lucca. Something is reading the Gates. Every Gate, every year, one after another. Like a hand going along a shelf.`),
      ['wait', 400],
      say('robo', 'surprised', `It has stopped. On this year. On this *square* —`),
      // The rift.
      ['sfx', 'sfx_hollow_gate'],
      ['music', 'mus_rift'],
      ['flash'],
      ['shake', 400],
      ['vfx', 'time_rift', '@rift'],
      ['camera', '@rift', 600],
      say('lucca', 'surprised', `…That is *not* one of my fireworks.`),
      ['par', [['emote', 'fair1', '!'], ['emote', 'fair2', '!'], ['emote', 'fair3', '!'], ['emote', 'fair4', '!']]],
      ['anim', 'fair1', 'run_off'],
      ['anim', 'fair2', 'run_off'],
      ['anim', 'fair3', 'run_off'],
      ['anim', 'fair4', 'run_off'],
      ['despawn', 'fair1'], ['despawn', 'fair2'], ['despawn', 'fair3'], ['despawn', 'fair4'],
      ['wait', 500],
      // Echoes crawl out of the rift.
      ['spawn', { id: 'imp1', sprite: 'echo_imp', at: '@rift', face: 'S' }],
      ['move', 'imp1', [4, 2]],
      ['spawn', { id: 'imp2', sprite: 'echo_imp', at: '@rift', face: 'S' }],
      ['move', 'imp2', [6, 2]],
      ['spawn', { id: 'hench', sprite: 'echo_mud_imp', at: '@rift', face: 'S' }],
      ['move', 'hench', [5, 3]],
      ['camera', 'frog', 500],
      say('frog', 'determined', `Imps! But grey. Like something left out in the rain. Crono — draw!`),
      ['anim', 'crono', 'draw_sword'],
      say('marle', 'determined', `Everyone's clear! Nobody wrecks this fair. We *just* fixed the future.`),
      say('lucca', 'determined', `Fine. Science later. Fire now.`),
      say('robo', 'determined', `Arm cannon ready. Please stand clear of the arm.`),
      ['battle', 'B0'],
      ['goto', '0.3'],
    ],
  };

  S['0.3'] = {
    title: 'Leene Square, after the fight',
    map: 'leene_square', theme: 'night', music: 'mus_rift',
    actors: [
      { id: 'crono', at: [4, 8], face: 'N' },
      { id: 'frog', at: [5, 8], face: 'N' },
      { id: 'marle', at: '@marle', face: 'N' },
      { id: 'robo', at: '@robo', face: 'W' },
    ],
    script: [
      ['vfx', 'time_rift', '@rift'],
      ['camera', '@rift', 0],
      ['wait', 800],
      say('marle', 'surprised', `Where's Lucca?`),
      say('robo', 'neutral', `She ran for the Epoch as the last one fell. She said, and I quote: "Nobody touch the hole."`),
      // Frog edges toward the rift anyway.
      ['move', 'frog', [7, 8]],
      ['face', 'frog', '@rift'],
      ['face', 'robo', 'frog'],
      say('robo', 'neutral', `She was looking at you when she said it.`),
      ['emote', 'frog', '...'],
      say('frog', 'neutral', `…I was only looking.`),
      // Lucca returns with the Epoch hovering behind her.
      ['sfx', 'sfx_epoch_fly'],
      ['spawn', { id: 'epoch', sprite: 'epoch', at: '@epoch', prop: true }],
      ['spawn', { id: 'lucca', at: '@gate', face: 'S' }],
      ['move', 'lucca', '@lucca', { run: true }],
      ['face', 'lucca', 'crono'],
      say('lucca', 'determined', `Okay. I scanned it. The other side isn't a year. It's the future we cancelled. Robo's future. Domes, dust, the whole bad idea.`),
      say('frog', 'neutral', `We ended that future.`),
      say('lucca', 'neutral', `We did. It's over. This is the thing that comes *after* over.`),
      ['face', 'robo', '@rift'],
      say('robo', 'sad', `Then something in it refused to be deleted.`),
      // The rift spits out a seed before closing.
      ['camera', '@rift', 500],
      ['shake', 300],
      ['spawn', { id: 'seed', sprite: 'lavos_seed', at: '@rift', prop: true }],
      ['sfx', 'sfx_seed_pulse'],
      ['close_rift', '@rift'],
      ['par', [['emote', 'crono', '!'], ['emote', 'frog', '!'], ['emote', 'marle', '!'], ['emote', 'lucca', '!']]],
      ['sfx', 'sfx_seed_pulse'],
      say('frog', 'angry', `I know that light. That is Lavos.`),
      ['move', 'lucca', [8, 9]],
      ['face', 'lucca', '@rift'],
      ['anim', 'lucca', 'kneel'],
      say('lucca', 'surprised', `A piece of it. A seed. And — hold on. It's *tagged.* Somebody engraved a number on a piece of Lavos. Like a specimen.`),
      say('robo', 'sad', `That format is from my century. It is how the dome archives numbered what they meant to keep.`),
      ['anim', 'lucca', 'stand'],
      ['face', 'marle', 'crono'],
      say('marle', 'determined', `So somebody's planting them. Then somebody pulls them up. Crono, take Frog. Find Ayla. Find — ugh — find Magus.`),
      say('marle', 'happy', `If more of those crawl out here, Guardia needs its princess. And you need people who hit harder than a crossbow.`),
      say('robo', 'determined', `I will go to 2300 and find who is writing the numbers.`),
      say('lucca', 'happy', `I'll take this to my lab. With tongs. Long ones. Then I'm on the Epoch's radio: the voice telling you not to touch things.`),
      ['face', 'lucca', 'frog'],
      ['emote', 'frog', '...'],
      say('lucca', 'neutral', `The Epoch will drop you at the End of Time. If time's leaking, Gaspar's the one standing in the puddle.`),
      ['despawn', 'seed'],
      ['choice', ['Nod', 'Nod harder'], [
        [['anim', 'crono', 'nod']],
        [['anim', 'crono', 'nod'], ['anim', 'crono', 'nod'], ['anim', 'crono', 'jump']],
      ], 'c_nod'],
      ['emote', 'marle', '♪'],
      say('marle', 'happy', `Come back with a story. And all your limbs. I've counted them.`),
      ['fade', 'out', 1200],
      ['sfx', 'sfx_epoch_fly'],
      ['wait', 800],
      ['goto', '0.4'],
    ],
  };

  S['0.4'] = {
    title: 'End of Time',
    map: 'end_of_time', theme: 'void', music: 'mus_end_of_time',
    actors: [
      { id: 'crono', at: '@arrive', face: 'N' },
      { id: 'frog', at: '@save', face: 'N' },
      { id: 'gaspar', at: '@gaspar', face: 'S' },
      { id: 'nu', at: '@nu', face: 'S' },
      { id: 'spekkio', sprite: 'frog_king', at: '@spekkio', face: 'S' },
    ],
    script: [
      ['fade', 'in', 800],
      ['sfx', 'sfx_scanline'],
      radio('lucca', 'neutral', `Radio check. You're at the End of Time, the Epoch's parked, and Gaspar's asleep standing up. So: normal.`),
      ['camera', '@door_grey', 1400],
      ['sfx', 'sfx_hollow_gate'],
      ['wait', 800],
      ['camera', 'gaspar', 900],
      ['move', 'crono', '@lamppost'],
      ['face', 'crono', 'gaspar'],
      ['face', 'frog', 'gaspar'],
      say('gaspar', 'neutral', `Zzz…`),
      ['emote', 'frog', '...'],
      say('frog', 'neutral', `Ahem.`),
      say('gaspar', 'neutral', `Mm. The boy who wouldn't stay dead, and the frog who wouldn't stop being a knight. You've seen my new door.`),
      say('frog', 'neutral', `It looks sick.`),
      say('gaspar', 'sad', `It leads to a year that isn't. I can't open it. I've decided not to try.`),
      say('gaspar', 'sad', `Something in there is reaching back and leaving seeds. Three old doors, three seeds. And one door is already rattling.`),
      ['sfx', 'sfx_gate_open'],
      ['vfx', 'sparkle', '@door_600'],
      ['camera', '@door_600', 900],
      ['emote', 'frog', '!'],
      ['camera', 'frog', 500],
      say('frog', 'surprised', `That door goes to my time.`),
      ['camera', 'gaspar', 400],
      say('gaspar', 'neutral', `Pull the seeds, and the grey door ought to weaken. Ought to. I'm a guru of time, not of doors.`),
      ['face', 'gaspar', 'frog'],
      say('gaspar', 'sad', `And, knight. Someone is waiting for you on that mountain. Be gentle with him. He's had a very long day.`),
      say('frog', 'surprised', `…Who?`),
      say('gaspar', 'neutral', `Zzz…`),
      ['emote', 'frog', '...'],
      ['setflag', 'ch1_open', true],
      ['setflag', 'progress', 1],
      ['popup', `The door to 600 A.D. is lit. The Nu runs a shop, and Spekkio's door is open for sparring. Things that sparkle are worth a look.`],
      ['fade', 'out', 400],
      ['goto', 'eot'],
    ],
  };

  // =====================================================================
  // END OF TIME — reusable hub. It changes every time the party comes back:
  // Gaspar's read of the grey door, who is standing around, what the door does.
  // =====================================================================
  const gasparTalk = [
    ['if', { flag: 'gaspar_heard', gte: 1 }, [
      say('gaspar', 'neutral', `Zzz…`),
      ['if', { flag: 'progress', gte: 3 }, [say('ayla', 'happy', `Ayla poke him?`), say('frog', 'neutral', `Let him be. He is working.`)]],
    ], [
      ['if', { flag: 'progress', eq: 1 }, [
        say('gaspar', 'neutral', `Zzz… hm? The lit door, knight. I've only the one lamp. It does one door at a time.`),
        say('gaspar', 'neutral', `And don't lean on the grey one. It leans back.`),
      ]],
      ['if', { flag: 'progress', eq: 2 }, [
        say('gaspar', 'neutral', `Sixty-five million B.C. Nobody there writes anything down. You'd think that would keep them safe from a catalogue.`),
        say('gaspar', 'happy', `Mind the chief. She hugs like a landslide.`),
      ]],
      ['if', { flag: 'progress', eq: 3 }, [
        say('gaspar', 'neutral', `Twelve thousand B.C. Snow, and a sea where a kingdom used to float.`),
        say('gaspar', 'sad', `The mage got there first. He always does. Then he pretends he was passing.`),
      ]],
      ['if', { flag: 'progress', gte: 4 }, [
        say('gaspar', 'neutral', `The grey door is open. I won't tell you not to go. I'd be wasting an old man's breath, and I've so little.`),
        say('gaspar', 'sad', `Time doesn't heal, boy. It only keeps going. That's the kindness in it.`),
      ]],
      ['setflag', 'gaspar_heard', 1],
    ]],
  ];

  // Walking into a door that will not open. The grey door's noise changes as the seeds come out.
  const doorLocked = {
    '600': (p) => (p > 1
      ? [N(`The door to 600 A.D. is quiet. Its seed is out.`)]
      : [N(`The door is dark.`)]),
    '65m': (p) => (p > 2
      ? [N(`The door to 65,000,000 B.C. is quiet. Its seed is out.`)]
      : [N(`The door to 65,000,000 B.C. is dark. Gaspar's lamp hasn't reached it yet.`)]),
    '12k': (p) => (p > 3
      ? [N(`The door to 12,000 B.C. is quiet. Its seed is out.`)]
      : [N(`The door to 12,000 B.C. is dark. Gaspar's lamp hasn't reached it yet.`)]),
    grey: (p) => [
      ['sfx', 'sfx_hollow_gate'],
      ...(p <= 1 ? [N(`The grey door hums with red static. It will not open.`)]
        : p === 2 ? [
          N(`The grey door is purring. It will not open.`),
          say('frog', 'neutral', `It sounds pleased. Why does it sound pleased?`),
        ] : [
          N(`Something is knocking on the other side. Three knocks, a wait, three knocks. Politely.`),
          say('ayla', 'happy', `Ayla knock back?`),
          say('frog', 'neutral', `No.`),
        ]),
    ],
  };

  const HUB_HINTS = {
    1: 'Take the lit door to 600 A.D.',
    2: 'Take the lit door to 65,000,000 B.C.',
    3: 'Take the lit door to 12,000 B.C.',
    4: 'The grey door is open. Enter the Hollow.',
  };

  function eotField(p) {
    const npcs = [
      { id: 'gaspar', talk: gasparTalk },
      { id: 'nu', talk: [
        say('nu', 'happy', `Nu! Nu nu. …Nu?`),
        ...(p === 3 ? [say('ayla', 'happy', `Blue thing soft. Ayla sit on it before. It not mind.`)] : []),
        ...(p === 4 ? [say('magus', 'neutral', `Don't ask it anything. It answers.`)] : []),
        ['shop', 'end_of_time'],
      ] },
      { id: 'spekkio', talk: p <= 2 ? [
        say('spekkio', 'happy', `Heya! Master of War, at your service. Like the new shape? I wear whatever suits my visitors. Today: frog.`),
        say('frog', 'neutral', `…Must thou?`),
        say('spekkio', 'happy', `Professional courtesy! Wanna spar? Step through my door. No hard feelings, no permanent damage. Mostly.`),
      ] : p === 3 ? [
        say('spekkio', 'happy', `Ooh, the strong one's back! Don't tell her I said strong. She'll want proof.`),
        say('ayla', 'happy', `Ayla hear. Ayla want proof.`),
        say('spekkio', 'surprised', `…Door's right there. Bring friends.`),
      ] : [
        say('spekkio', 'neutral', `Is that a *dead* guy by the grey door? I can't size myself to a dead guy. Makes my scales itch.`),
        say('spekkio', 'happy', `You four, though. You, I can size. One more round before you go in?`),
      ] },
    ];
    if (p === 4) {
      npcs.push({ id: 'iselle', name: 'Cyrus', talk: [
        ['if', { flag: 't_eot_iselle', gte: 1 }, [
          say('iselle', 'neutral', `That lamp. It's the first thing in ten years I haven't seen before.`),
          ['wait', 500],
          say('iselle', 'happy', `I'd forgotten that could happen.`),
        ], [
          say('iselle', 'happy', `Your old man sleeps standing up. I did that once on night watch. Glenn swore he'd never tell.`),
          say('frog', 'happy', `I never did. Until now.`),
          say('iselle', 'determined', `When you're ready: the grey door. I know the halls. I'll go first.`),
        ]],
      ] });
    }
    return ['field', {
      leader: 'crono',
      hint: HUB_HINTS[p],
      npcs,
      spots: [
        { id: 'lamp', at: [6, 6], label: 'the lamppost', script: [
          N(`The lamp at the End of Time. It has never gone out. Nobody remembers lighting it.`),
          say('frog', 'neutral', `A lamp no one lit, kept by a man who sleeps. I have stood stranger watches.`),
        ] },
        { id: 'bucket', at: [8, 8], label: 'a wet ring on the stone', lift: 4, script: [
          N(`A wet ring where a bucket used to stand. The bucket led to the day of Lavos. That day is finished, and someone has taken the bucket in.`),
          say('frog', 'happy', `Good riddance. I never liked that bucket.`),
        ] },
      ],
      exits: [
        { zone: 'DOOR_600', goto: '1.1', label: '600 A.D.', requires: 'ch1_open', locked: doorLocked['600'](p) },
        { zone: 'DOOR_65M', goto: '2.1', label: '65,000,000 B.C.', requires: 'ch2_open', locked: doorLocked['65m'](p) },
        { zone: 'DOOR_12K', goto: '3.1', label: '12,000 B.C.', requires: 'ch3_open', locked: doorLocked['12k'](p) },
        { zone: 'DOOR_GREY', goto: '4.1', label: 'The Hollow', requires: 'ch4_open', locked: doorLocked.grey(p) },
        { zone: 'DOOR_SPEKKIO', goto: 'spekkio', label: `Spekkio's Room` },
      ],
      save: '@save',
    }];
  }

  S.eot = {
    title: 'End of Time (hub)',
    map: 'end_of_time', theme: 'void', music: 'mus_end_of_time',
    actors: [
      { id: 'crono', at: '@arrive', face: 'N' },
      { id: 'gaspar', at: '@gaspar', face: 'S' },
      { id: 'nu', at: '@nu', face: 'S' },
      { id: 'spekkio', sprite: 'frog_king', at: '@spekkio', face: 'S' },
    ],
    script: [
      // The party travels together: everyone who has joined stands at the lamppost.
      ['spawn', { id: 'frog', at: '@arrive', face: 'N' }],
      ['if', { flag: 'progress', gte: 3 }, [['spawn', { id: 'ayla', at: '@arrive', face: 'N' }]]],
      ['if', { flag: 'progress', gte: 4 }, [['spawn', { id: 'magus', at: '@arrive', face: 'N' }]]],
      // Cyrus waits beside the grey door, clear of its threshold and of the causeway (the party has to get past him).
      ['if', { flag: 'progress', eq: 4 }, [
        ['spawn', { id: 'iselle', sprite: 'cyrus', at: [11, 2], face: 'S' }],
      ]],
      ['fade', 'in', 500],
      // Between-chapter beats (once each, on arrival). Each one answers: what did the grey
      // door do when we pulled a seed, and why is the next door the next door?
      ['if', { flag: 'gaspar_after', eq: 1 }, [
        ['setflag', 'gaspar_heard', 0],
        ['sfx', 'sfx_hollow_gate'],
        ['camera', '@door_grey', 700],
        ['wait', 500],
        ['camera', 'gaspar', 600],
        say('gaspar', 'neutral', `One seed out. And my grey door…`),
        ['wait', 500],
        say('gaspar', 'neutral', `Purred.`),
        say('frog', 'neutral', `Purred.`),
        say('gaspar', 'sad', `I expected a groan. A sick thing groans when you take its food away. That was a cat hearing the cupboard open.`),
        // Frog has walked off to the edge of the pier, looking at nothing.
        ['move', 'frog', [6, 11]],
        ['face', 'frog', 'S'],
        ['wait', 700],
        ['face', 'gaspar', 'frog'],
        say('gaspar', 'neutral', `Long day?`),
        say('frog', 'sad', `His. Ten years of the same one.`),
        ['wait', 500],
        ['face', 'frog', 'N'],
        say('frog', 'determined', `He named the age of beasts. Ayla's age.`),
        say('gaspar', 'neutral', `Then Ayla won't need convincing. She'll need *restraining.*`),
        ['sfx', 'sfx_gate_open'],
        ['vfx', 'sparkle', '@door_65m'],
        ['camera', '@door_65m', 700],
        ['move', 'frog', '@arrive', { nowait: true }],
        ['setflag', 'gaspar_after', 0],
      ]],
      ['if', { flag: 'gaspar_after', eq: 2 }, [
        ['setflag', 'gaspar_heard', 0],
        ['sfx', 'sfx_hollow_gate'],
        ['shake', 300],
        ['camera', 'gaspar', 600],
        say('gaspar', 'neutral', `Two. Now it's humming a tune.`),
        // Ayla inspects the Guru of Time.
        ['move', 'ayla', [5, 7]],
        ['face', 'ayla', 'gaspar'],
        ['face', 'gaspar', 'ayla'],
        say('ayla', 'surprised', `Old man asleep. Standing. Like horse.`),
        say('gaspar', 'neutral', `Chief.`),
        ['anim', 'ayla', 'jump'],
        say('ayla', 'happy', `Old man know Ayla is chief! Ayla like old man.`),
        ['face', 'gaspar', 'crono'],
        say('gaspar', 'neutral', `Twelve thousand B.C. next, where Zeal went into the sea. The mage will come. Not for you, boy. For the name.`),
        ['emote', 'frog', '...'],
        say('frog', 'sad', `The man who killed Cyrus. And Cyrus. On one beach.`),
        say('gaspar', 'neutral', `Then keep your sword sheathed until you know which of them it's for.`),
        say('ayla', 'determined', `Ayla hold Frog's arm.`),
        ['wait', 400],
        say('ayla', 'determined', `Ayla hold *both* arm.`),
        ['sfx', 'sfx_gate_open'],
        ['vfx', 'sparkle', '@door_12k'],
        ['camera', '@door_12k', 700],
        ['move', 'ayla', '@arrive', { nowait: true }],
        ['setflag', 'gaspar_after', 0],
      ]],
      ['if', { flag: 'gaspar_after', eq: 3 }, [
        ['setflag', 'gaspar_heard', 0],
        ['sfx', 'sfx_hollow_gate'],
        ['vfx', 'time_rift', '@door_grey'],
        ['shake', 500],
        ['camera', '@door_grey', 800],
        ['wait', 500],
        ['camera', 'gaspar', 600],
        say('gaspar', 'sad', `There. It's opened its own door. You pull three seeds, and it says thank you.`),
        ['face', 'gaspar', 'iselle'],
        say('gaspar', 'sad', `Sir Cyrus. You're further from your own time than anyone I've met. And I live *here.*`),
        say('iselle', 'neutral', `I don't have a time, old man. I have a minute. I've been in it ten years.`),
        ['wait', 500],
        ['face', 'gaspar', 'crono'],
        say('gaspar', 'sad', `Boy. The lamp will be lit when you come back.`),
        say('gaspar', 'neutral', `…It's lit either way. But I'll be watching it.`),
        ['close_rift'],
        ['setflag', 'gaspar_after', 0],
      ]],
      ['if', { flag: 'progress', eq: 1 }, [eotField(1)], [
        ['if', { flag: 'progress', eq: 2 }, [eotField(2)], [
          ['if', { flag: 'progress', eq: 3 }, [eotField(3)], [eotField(4)]],
        ]],
      ]],
    ],
  };

  // Spekkio's room — optional, repeatable sparring (BATTLE OPT-1).
  S.spekkio = {
    title: `Spekkio's Room`,
    map: 'spekkio_room', theme: 'void', music: 'mus_end_of_time',
    actors: [
      { id: 'crono', at: '@crono', face: 'N' },
      { id: 'frog', at: '@frog', face: 'N' },
      { id: 'spekkio', sprite: 'frog_king', at: '@spekkio', face: 'S' },
    ],
    script: [
      ['if', { flag: 'progress', gte: 3 }, [['spawn', { id: 'ayla', at: '@ayla', face: 'N' }]]],
      ['if', { flag: 'progress', gte: 4 }, [['spawn', { id: 'magus', at: '@magus', face: 'N' }]]],
      ['fade', 'in', 400],
      ['anim', 'spekkio', 'jump'],
      say('spekkio', 'happy', `Step right up! I size myself to whoever walks in. Fair's fair!`),
      ['choice', ['Spar with Spekkio', 'Maybe later'], [
        [
          ['battle', 'OPT1'],
          ['if', '!opt1_won', [
            say('spekkio', 'happy', `First win's worth a prize. Here. Chew on these. …Don't chew them.`),
            ['reward', { items: { magic_tab: 3 } }],
            ['setflag', 'opt1_won', true],
          ], [
            say('spekkio', 'happy', `Again tomorrow! …There's no tomorrow here. Again *whenever!*`),
          ]],
        ],
        [
          say('spekkio', 'neutral', `Chicken! …Kidding. Come back when your fists itch.`),
        ],
      ], 'c_spekkio'],
      ['fade', 'out', 400],
      ['goto', 'eot'],
    ],
  };

  // =====================================================================
  // CHAPTER 1 — "The Knight Who Stayed" (600 A.D.)
  // Through-line: Frog thinks he made his peace with the mountain. The mountain disagrees.
  // Set-ups: things set straight (the lantern, the cairn, "Stand up straight"), Leene's flowers,
  // the catalogue number, and Cyrus telling them where he goes next.
  // =====================================================================
  S['1.1'] = {
    title: 'Guardia Castle, throne room',
    map: 'guardia_throne', theme: 'castle', music: 'mus_guardia_600',
    actors: [
      { id: 'king', at: '@king', face: 'S' },
      { id: 'leene', at: '@leene', face: 'S' },
      { id: 'guard1', sprite: 'guard', at: '@guard1', face: 'S' },
      { id: 'guard2', sprite: 'guard', at: '@guard2', face: 'S' },
      { id: 'merchant', sprite: 'villager_600', at: '@shop', face: 'S' },
    ],
    script: [
      ['chapter', 'I. THE KNIGHT WHO STAYED', '600 A.D.'],
      ['party', ['crono', 'frog']],
      ['fade', 'in', 600],
      ['spawn', { id: 'frog', at: '@entrance', face: 'N' }],
      ['move', 'frog', '@party'],
      ['spawn', { id: 'crono', at: '@entrance', face: 'N' }],
      ['move', 'crono', '@party'],
      ['anim', 'frog', 'kneel'],
      ['face', 'king', 'frog'],
      say('king', 'angry', `Glenn! Thank the stars. Stone imps on the Denadoro pass. Every night, marching uphill, in step. And the peak glows red.`),
      ['anim', 'frog', 'stand'],
      say('leene', 'sad', `They carry something, Glenn. And a knight walks ahead of them. Tall, in a violet cape. He shines like frost.`),
      say('frog', 'angry', `Then he is no knight of ours. Every knight who climbed Denadoro is dead. I buried the last of them myself.`),
      say('leene', 'sad', `He stopped under the castle wall last night. He saluted the tower.`),
      ['wait', 400],
      say('leene', 'sad', `Then he straightened the gate lantern, and went on.`),
      ['emote', 'frog', '...'],
      say('king', 'surprised', `Straightened the — ?`),
      say('leene', 'sad', `It has hung crooked for ten years. Ever since —`),
      ['wait', 800],
      // Frog does not finish the sentence for her.
      say('frog', 'neutral', `…The red glow is a seed of Lavos, Majesty. We will pull it out.`),
      say('king', 'neutral', `Take whoever you need.`),
      say('frog', 'sad', `I have what I need.`),
      ['face', 'frog', 'crono'],
      say('frog', 'sad', `Though I would not mind more of us.`),
      ['choice', [`Put a hand on Frog's shoulder`, 'Say nothing'], [
        [
          ['face', 'crono', 'frog'],
          ['emote', 'frog', '!'],
          say('frog', 'happy', `Aye. Two is enough, when it is the right two.`),
        ],
        [
          ['emote', 'crono', '...'],
          say('frog', 'neutral', `…Thy silences are better than most men's speeches. Come.`),
        ],
      ], 'c_shoulder'],
      ['field', {
        leader: 'crono',
        hint: 'Head south to Denadoro Pass.',
        npcs: [
          { id: 'king', talk: [
            ['if', { flag: 't_1.1_king', gte: 1 }, [
              say('king', 'neutral', `Still here? In my day a knight left before the speech was over.`),
            ], [
              say('king', 'neutral', `The mountain folk will light beacons on the lower ridge. Go with Guardia's blessing, Glenn. And bring it back. We are short of blessings.`),
            ]],
          ] },
          { id: 'leene', talk: [
            ['if', 'has_flowers', [
              say('leene', 'happy', `He used to say the pass sang when the wind was right. I should like to hear that it still does.`),
            ], [
              say('leene', 'sad', `Glenn. I have never been up to his cairn. They tell me a queen does not climb where her knights fell.`),
              say('leene', 'sad', `Will you lay these there for me? They are only gate-flowers. He liked plain things.`),
              ['anim', 'crono', 'nod'],
              ['setflag', 'has_flowers', true],
              ['reward', { key: 'leene_flowers' }],
              say('frog', 'sad', `He will pretend not to be pleased.`),
            ]],
          ] },
          { id: 'guard1', name: 'Guard', talk: [
            ['if', { flag: 't_1.1_guard1', gte: 1 }, [
              ['anim', 'guard1', 'salute'],
              N(`He salutes again. He appears to be stuck.`),
            ], [
              ['anim', 'guard1', 'salute'],
              N(`Guard: "Sir Glenn! Er — Sir Frog! Er… Sir."`),
              ['anim', 'guard1', 'salute'],
              N(`He salutes a second time, to be safe.`),
            ]],
          ] },
          { id: 'guard2', name: 'Gate guard', talk: [
            N(`Guard: "I had the gate watch, sir. He walked straight through our line. Never drew. Never spoke."`),
            N(`Guard: "…He did fix my collar on the way past. It's still straight. I've been afraid to touch it."`),
          ] },
          { id: 'merchant', name: 'Quartermaster', talk: [
            N(`Quartermaster: "Steel for the pass, sirs? A mountain's no place for a dull edge."`),
            ['shop', 'guardia'],
          ] },
        ],
        spots: [
          { id: 'banner', at: [9, 1], label: 'a faded banner', script: [
            N(`A knight-captain's banner, the violet gone grey. Every other banner in the hall wears ten years of dust. This one wears none.`),
            say('frog', 'sad', `The Queen. Every week.`),
          ] },
          { id: 'notches', at: [11, 7], label: 'notches in a pillar', script: [
            N(`Notches cut in the stone: the heights of squires, each with a name. The lowest reads GLENN.`),
            N(`Beside it, lower still, a fresh one: FROG.`),
            say('frog', 'angry', `…I know who cut that. He salutes too much.`),
          ] },
        ],
        exits: [{ zone: 'EXIT_SOUTH', goto: '1.2', label: 'Denadoro Pass' }],
        save: '@save',
      }],
    ],
  };

  S['1.2'] = {
    title: 'Denadoro Pass, approach',
    map: 'denadoro', theme: 'mountain', music: 'mus_denadoro',
    actors: [
      { id: 'crono', at: '@party_start', face: 'N' },
      { id: 'frog', at: [8, 14], face: 'N' },
      { id: 'iselle', sprite: 'cyrus', at: '@iselle', face: 'N' },
      { id: 'sb1', sprite: 'stone_imp', at: '@seed_a', face: 'N' },
      { id: 'sb2', sprite: 'stone_imp', at: '@seed_b', face: 'N' },
    ],
    script: [
      ['fade', 'in', 600],
      ['face', 'frog', 'crono'],
      say('frog', 'sad', `Denadoro. I buried him at the foot of this trail. I have not climbed past it since.`),
      ['face', 'frog', 'N'],
      // The foot of the pass is walkable: the cairn, an old cache, the tracks. Stepping onto
      // the climb (zone APPROACH) starts the reunion.
      ['field', {
        leader: 'crono',
        hint: 'Climb the trail toward the pass.',
        spots: [
          { id: 'cairn', at: [4, 12], label: 'a cairn', script: [
            N(`A cairn of river stones. No name on it.`),
            say('frog', 'sad', `Here. I built this with these hands, when they were hands. I built it badly. I could not see for weeping.`),
            ['wait', 500],
            N(`The stones are stacked dead straight.`),
            ['emote', 'frog', '!'],
            say('frog', 'surprised', `…Someone has rebuilt it.`),
            ['if', ['has_flowers', '!flowers_laid'], [
              ['anim', 'crono', 'kneel'],
              ['sfx', 'sfx_item_get'],
              ['wait', 700],
              ['anim', 'crono', 'stand'],
              N(`Crono lays the Queen's flowers at the foot of the stones.`),
              ['setflag', 'flowers_laid', true],
              ['losekey', 'leene_flowers'],
              say('frog', 'sad', `From Leene. Plain ones. He liked plain things.`),
            ]],
          ] },
          { id: 'cache', at: [3, 13], label: 'the roots of an old pine', script: [
            ['if', 'cache_taken', [
              N(`An empty soldier's tin under the roots.`),
            ], [
              say('frog', 'neutral', `Hold. Cyrus buried a tonic at the foot of every climb. "For the way down," he said. He never trusted the way down.`),
              N(`Under the roots: a soldier's tin, ten years rusted. The flask inside is still sealed.`),
              ['setflag', 'cache_taken', true],
              ['reward', { items: { mid_tonic: 1 } }],
              say('frog', 'sad', `…For the way down.`),
            ]],
          ] },
          { id: 'tracks', at: [10, 13], label: 'tracks in the grass', script: [
            N(`Small square footprints, dozens of them, all in step. Beside them runs one long stride that leaves no print at all. Only a line of frost on the grass.`),
          ] },
        ],
        events: [
          { id: 'climb', zone: 'APPROACH', script: [['endfield']] },
        ],
      }],
      ['face', 'crono', 'N'],
      ['move', 'frog', 'crono'],
      ['face', 'frog', 'N'],
      ['music', 'mus_frog_theme'],
      ['camera', '@seed_a', 2200],
      ['sfx', 'sfx_seed_pulse'],
      ['camera', '@shrine', 1600],
      ['camera', '@iselle', 1500],
      ['sfx', 'sfx_porcelain_step'],
      ['face', 'iselle', 'S'],
      // The first thing he says to his squire in ten years is the thing he always said.
      say('iselle', 'neutral', `Stand up straight, Glenn. You climb like a sack of turnips.`),
      ['camera', 'frog', 500],
      ['par', [['anim', 'frog', 'jump'], ['emote', 'frog', '!']]],
      ['wait', 700],
      say('frog', 'surprised', `That voice.`),
      ['camera', '@iselle', 600],
      say('iselle', 'sad', `Hello, Glenn. You've grown. And gone green.`),
      say('frog', 'sad', `Thou art dead. I saw thee fall. Here. I piled the stones.`),
      say('iselle', 'neutral', `You piled them crooked. I fixed it.`),
      ['wait', 500],
      say('iselle', 'neutral', `Something caught me as I fell, Glenn. It's called the Curator. It keeps things. It kept me.`),
      say('frog', 'angry', `And for that, thou plant Lavos on thy own grave?`),
      say('iselle', 'determined', `I plant what holds its roof up. While that roof stands, nothing under it is lost again. Not Leene. Not Guardia. Not one green squire.`),
      say('frog', 'angry', `I am not lost! I am standing right here!`),
      ['wait', 800],
      say('iselle', 'sad', `…So you are.`),
      ['music', 'mus_denadoro'],
      say('iselle', 'neutral', `Stay down there. That's an order.`),
      ['face', 'iselle', 'N'],
      say('iselle', 'determined', `Plant it.`),
      ['sfx', 'sfx_porcelain_step'],
      ['battle', 'B1'],
      ['goto', '1.3'],
    ],
  };

  S['1.3'] = {
    title: 'The shrine, after',
    map: 'denadoro', theme: 'mountain', music: 'mus_frog_theme',
    actors: [
      { id: 'crono', at: [7, 2], face: 'N' },
      { id: 'frog', at: [8, 2], face: 'N' },
      { id: 'seed', sprite: 'lavos_seed_inert', at: '@shrine', prop: true },
    ],
    script: [
      ['camera', '@shrine', 0],
      ['fade', 'in', 600],
      ['face', 'frog', 'W'],
      ['anim', 'frog', 'kneel'],
      ['despawn', 'seed'],
      ['sfx', 'sfx_item_get'],
      ['wait', 600],
      ['emote', 'frog', '...'],
      ['face', 'frog', 'crono'],
      say('frog', 'sad', `He was the best knight Guardia ever had. He taught me to hold a sword. Mostly he taught me where to put my feet.`),
      ['wait', 700],
      say('frog', 'sad', `For ten years I have gone back to the day he died. He never got to leave it.`),
      say('frog', 'sad', `Is it wrong that I was glad to see him?`),
      ['choice', ['Nod', 'Shake head'], [
        [['anim', 'crono', 'nod'], say('frog', 'sad', `Aye. I thought so too. I was glad anyway.`)],
        [['anim', 'crono', 'shake_head'], say('frog', 'happy', `…Thank thee. Then I will stay glad.`)],
      ], 'c_shrine'],
      ['anim', 'frog', 'stand'],
      say('frog', 'neutral', `There is a number cut into the seed. Like a brand on cattle.`),
      ['sfx', 'sfx_scanline'],
      radio('lucca', 'neutral', `Same as mine. It's a catalogue number. You two just robbed somebody's *inventory.* Nice work. I'm bringing the Epoch round.`),
      radio('lucca', 'surprised', `One thing. He told you where he's going next. Bad guys don't do that. Not unless they want you there.`),
      say('frog', 'angry', `Cyrus is no "bad guy."`),
      radio('lucca', 'neutral', `Then he *really* wants you there.`),
      ['wait', 500],
      say('frog', 'determined', `Then I will be there.`),
      ['reward', { xp: 50, key: 'denadoro_seed' }],
      ...toHub(2, 1, 'ch2_open', 'ch1_open'),
    ],
  };

  // =====================================================================
  // CHAPTER 2 — "Strong, Then Kind" (65,000,000 B.C.)
  // Through-line: Ayla knows whose ground it is. She also knows grief when it swings at her.
  // Set-ups: the ghost who fixes a roof and says thank you; Schala's name, spoken aloud;
  // "tell it loud"; Lucca calling it what it is, a tour.
  // =====================================================================
  S['2.1'] = {
    title: 'Ioka Village',
    map: 'ioka', theme: 'prehistoric', music: 'mus_ioka',
    actors: [
      { id: 'crono', at: '@crono', face: 'N' },
      { id: 'frog', at: '@bonfire_side', face: 'N' },
      { id: 'kino', at: '@kino', face: 'S' },
      { id: 'vill1', sprite: 'villager_ioka', at: '@vill1', face: 'S' },
      { id: 'vill2', sprite: 'villager_ioka_b', at: '@vill2', face: 'E' },
      { id: 'vill3', sprite: 'villager_ioka_b', at: '@vill3', face: 'W' },
      { id: 'trader', sprite: 'villager_ioka_c', at: '@shop', face: 'S' },
    ],
    script: [
      ['chapter', 'II. STRONG, THEN KIND', '65,000,000 B.C.'],
      ['fade', 'in', 600],
      ['par', [['anim', 'vill1', 'spin'], ['anim', 'vill2', 'jump'], ['anim', 'vill3', 'spin']]],
      ['emote', 'kino', '!'],
      ['move', 'kino', '@crono', { run: true }],
      ['face', 'kino', 'crono'],
      ['face', 'crono', 'kino'],
      say('kino', 'surprised', `Crono! Frog-man! Ayla gone! Ayla go fight rock-men alone! Kino say "wait." Ayla say "no." Ayla always say no!`),
      say('frog', 'neutral', `Where?`),
      say('kino', 'sad', `Old Tyrano place. Ground there go red again. And ghost-man there. Tall. Purple cape. Shine like moon on water.`),
      say('kino', 'surprised', `Ghost-man come to Ioka first! Kino think: fight! But ghost-man… fix roof.`),
      ['emote', 'frog', '...'],
      say('frog', 'surprised', `He what?`),
      say('kino', 'neutral', `Hut pole lean since big storm. Ghost-man look at pole long time. Push pole straight. Say "there." Ask way to Tyrano place. Say *thank you.*`),
      say('kino', 'sad', `Bad men no say thank you. Kino know bad men.`),
      say('frog', 'sad', `That is Cyrus.`),
      say('kino', 'sad', `Kino… Kino go too?`),
      ['choice', ['Yes, come', 'Stay, protect village'], [
        [['anim', 'crono', 'nod'], say('kino', 'happy', `Kino brave! Kino stay behind you. Far behind.`)],
        [['anim', 'crono', 'point'], say('kino', 'determined', `Kino protect. Tell Ayla Kino not cry. Kino cry a little.`)],
      ], 'kino_choice'],
      ['field', {
        leader: 'crono',
        hint: 'Head north to the old Tyrano lair.',
        npcs: [
          { id: 'kino', talk: [
            ['if', { flag: 'kino_choice', eq: 0 }, [
              say('kino', 'happy', `Kino ready! Kino walk behind. Very behind.`),
            ], [
              say('kino', 'determined', `Kino guard fire. Fire safe. Kino… mostly safe.`),
            ]],
          ] },
          { id: 'vill1', name: 'Villager', talk: [N(`Villager: "Ayla go. Ayla always go. Then Ayla come back and we dance. So we dance now. Practice."`)] },
          { id: 'vill2', name: 'Villager', talk: [N(`Villager: "Red sky over Tyrano place. Old people say bad. Young people say bad. Everybody agree! First time."`)] },
          { id: 'vill3', name: 'Villager', talk: [
            N(`Villager: "Frog-man! You eat bug? Kino say you eat bug. Kino lie?"`),
            say('frog', 'neutral', `…Only on feast days.`),
          ] },
          { id: 'trader', name: 'Trader', talk: [
            ['if', '!has_lunch', [
              N(`Trader: "Chief run off, no eat. Chief fight bad when hungry. Chief fight *everybody* when hungry."`),
              N(`Trader: "You take. Big rib. No sniff. Is for chief."`),
              ['setflag', 'has_lunch', true],
              ['reward', { key: 'ayla_lunch' }],
            ], [
              N(`Trader: "Good stone. Good bone. You like? You pay."`),
            ]],
            ['shop', 'ioka'],
          ] },
        ],
        spots: [
          { id: 'fire', at: '@bonfire', label: 'the bonfire', script: [
            N(`The fire is high and well fed. One flat stone beside it is kept clear: the chief's seat. Someone has left a drumstick on it. Then, on reflection, a second drumstick.`),
          ] },
          { id: 'pole', at: [2, 4], label: 'a hut pole', script: [
            N(`Every pole in Ioka leans a little, as poles should. This one stands straight as a spear.`),
            say('frog', 'sad', `He never could walk past a crooked thing.`),
          ] },
          { id: 'prints', at: [6, 3], label: 'footprints', script: [
            N(`Bare footprints, heading north. Deep at the toes, and very far apart.`),
            say('frog', 'neutral', `She did not walk.`),
          ] },
          { id: 'bone', at: [5, 12], label: 'a hollow bone', script: [
            ['if', 'bone_taken', [
              N(`A hollow bone. It still smells of sweet-root.`),
            ], [
              N(`A hollow bone, stoppered with wax. Inside: sweet-root paste. Ioka's idea of a tonic.`),
              ['setflag', 'bone_taken', true],
              ['reward', { items: { tonic: 2 } }],
            ]],
          ] },
        ],
        exits: [{ zone: 'EXIT_NORTH', goto: '2.2', label: 'Tyrano Crater' }],
        save: '@save',
      }],
    ],
  };

  S['2.2'] = {
    title: 'Tyrano Crater',
    map: 'tyrano_crater', theme: 'volcanic', music: 'mus_tyrano',
    actors: [
      { id: 'ayla', at: '@ayla', face: 'N' },
      { id: 'crono', at: '@crono', face: 'N' },
      { id: 'frog', at: '@frog', face: 'N' },
      { id: 'sb0', sprite: 'stone_imp', at: '@roll1', face: 'S' },
      { id: 'sb1', sprite: 'stone_imp', at: '@feeder1', face: 'E' },
      { id: 'sb2', sprite: 'stone_imp', at: '@feeder2', face: 'W' },
      { id: 'sb3', sprite: 'stone_imp', at: '@feeder3', face: 'S' },
      { id: 'seed', sprite: 'lavos_seed', at: [8, 8], prop: true },
    ],
    script: [
      ['if', { flag: 'kino_choice', eq: 0 }, [['spawn', { id: 'kino', at: '@kino', face: 'N' }]]],
      ['camera', 'ayla', 0],
      ['fade', 'in', 600],
      ['sfx', 'sfx_seed_pulse'],
      // Ayla punches a stone imp clean off a ledge.
      ['face', 'ayla', 'sb0'],
      ['anim', 'ayla', 'jump'],
      ['sfx', 'sfx_kick'],
      ['vfx', 'sparkle', '@roll1'],
      ['anim', 'sb0', 'fall'],
      ['anim', 'sb0', 'dissolve'],
      ['despawn', 'sb0'],
      ['face', 'ayla', 'crono'],
      say('ayla', 'happy', `CRONO! FROG! Ayla know you come! Rock-men no fun. No scream. Just fall.`),
      // The rib arrives (if the trader's errand was run).
      ['if', ['has_lunch', '!lunch_eaten'], [
        ['emote', 'ayla', '!'],
        say('ayla', 'surprised', `…Crono smell like rib.`),
        ['anim', 'crono', 'point'],
        ['sfx', 'sfx_item_get'],
        say('ayla', 'happy', `RIB!`),
        ['anim', 'ayla', 'jump'],
        ['wait', 500],
        ['setflag', 'lunch_eaten', true],
        ['losekey', 'ayla_lunch'],
        say('frog', 'surprised', `…She ate the bone.`),
      ]],
      say('frog', 'neutral', `Ayla, the seed —`),
      say('ayla', 'angry', `Ayla see. Ayla pull. Seed *bite* Ayla.`),
      ['emote', 'ayla', '!'],
      say('ayla', 'angry', `Ayla bite back. Seed win.`),
      // Cyrus appears on the rim.
      ['sfx', 'sfx_hollow_gate'],
      ['vfx', 'time_rift', '@iselle'],
      ['spawn', { id: 'iselle', sprite: 'cyrus', at: '@iselle', face: 'S' }],
      ['close_rift', '@iselle'],
      ['camera', 'iselle', 700],
      ['if', { flag: 'kino_choice', eq: 0 }, [['emote', 'kino', '!']]],
      say('iselle', 'neutral', `Entry nine. Ayla, chief of Ioka. Never learned to read. Never had to.`),
      ['wait', 600],
      say('iselle', 'neutral', `Leave it, chief. It's rooting. My stone men feed it, it hatches, and this crater is a nursery by nightfall.`),
      ['face', 'ayla', 'iselle'],
      say('ayla', 'angry', `Ghost-man! You put bad egg in Ayla's ground!`),
      say('iselle', 'sad', `Your ground? You watched the sky-fire dig this hole, chief. You gave it its name. It's been *its* ground since that night.`),
      say('frog', 'angry', `Cyrus, enough. Thou hast no place here.`),
      say('iselle', 'neutral', `Neither do you, Glenn. And yet.`),
      // The archive brings out an old enemy of Ayla's.
      ['sfx', 'sfx_hollow_gate'],
      ['vfx', 'time_rift', '@roll2'],
      ['spawn', { id: 'azala', sprite: 'echo_azala', at: '@roll2', face: 'S' }],
      ['close_rift', '@roll2'],
      ['camera', 'azala', 700],
      ['emote', 'ayla', '!'],
      say('ayla', 'surprised', `Azala?!`),
      say('ayla', 'angry', `No. Azala gone. Ayla stay and saw.`),
      say('iselle', 'neutral', `The archive keeps every enemy you ever had, chief. It thought you'd like the company.`),
      say('ayla', 'determined', `Ayla beat Azala once. Ayla beat copy-Azala too. Then Ayla show ghost-man whose ground.`),
      ['if', { flag: 'kino_choice', eq: 0 }, [
        say('kino', 'surprised', `Kino go… guard back of crater! Very important back!`),
        ['anim', 'kino', 'run_off'],
        ['despawn', 'kino'],
      ]],
      ['join', 'ayla'],
      ['battle', 'B2'],
      ['goto', '2.3'],
    ],
  };

  S['2.3'] = {
    title: 'Crater, after',
    map: 'tyrano_crater', theme: 'volcanic', music: 'mus_ayla_theme',
    actors: [
      { id: 'ayla', at: '@ayla', face: 'N' },
      { id: 'crono', at: '@crono', face: 'N' },
      { id: 'frog', at: '@frog', face: 'N' },
      { id: 'seed', sprite: 'lavos_seed', at: [8, 8], prop: true },
    ],
    script: [
      ['camera', 'ayla', 0],
      ['fade', 'in', 600],
      // Ayla yanks the seed out; its shell cracks and it goes inert.
      ['anim', 'ayla', 'jump'],
      ['sfx', 'sfx_glass_shatter'],
      ['vfx', 'glass_shatter', [8, 8]],
      ['despawn', 'seed'],
      ['spawn', { id: 'seed_inert', sprite: 'lavos_seed_inert', at: [8, 8], prop: true }],
      ['wait', 500],
      ['despawn', 'seed_inert'],
      ['anim', 'ayla', 'kneel'],
      ['move', 'crono', '@ayla'],
      ['move', 'frog', '@ayla'],
      say('ayla', 'neutral', `Ghost-man say ground belong to sky-fire.`),
      ['wait', 600],
      say('ayla', 'neutral', `Ayla think ground belong to who stand on it. Ayla stand on it. Ayla's children stand on it. Sky-fire lie *under* it. Under not count.`),
      say('ayla', 'happy', `That smart. Ayla say it again later. Louder.`),
      ['choice', ['Help her up', 'Sit down next to her'], [
        [
          ['face', 'crono', 'ayla'],
          ['anim', 'ayla', 'jump'],
          say('ayla', 'happy', `Crono strong. Ayla stronger. But nice.`),
        ],
        [
          ['anim', 'crono', 'kneel'],
          say('ayla', 'happy', `Good. Sit. Watch red go out of ground.`),
          ['camera', 'ayla', 600],
          ['wait', 2500],
          ['anim', 'crono', 'stand'],
        ],
      ], 'c_crater'],
      say('ayla', 'sad', `Ghost-man fight sad. Like man guarding empty hut.`),
      say('frog', 'sad', `He guarded a pass, once. He lost it, and his life with it.`),
      say('ayla', 'neutral', `Who beat him?`),
      ['wait', 400],
      say('frog', 'sad', `…Magus.`),
      ['emote', 'ayla', '!'],
      say('ayla', 'surprised', `Blue-hair?! And ghost-man say name of Blue-hair's sister. Out loud. Ghost-man brave or stupid.`),
      ['sfx', 'sfx_scanline'],
      radio('lucca', 'happy', `Seed two: done! Epoch's on its way down. Ayla, welcome aboard. Please don't punch the dashboard.`),
      say('ayla', 'happy', `Ayla punch little.`),
      radio('lucca', 'neutral', `Also: he did it *again.* Told you the next stop and who to bring. That's not a villain. That's a tour guide.`),
      say('ayla', 'neutral', `Is trap?`),
      radio('lucca', 'neutral', `It's absolutely a trap.`),
      say('ayla', 'determined', `Trap with egg in it still have egg. We go.`),
      ['reward', { xp: 50, key: 'tyrano_seed' }],
      ...toHub(3, 2, 'ch3_open', 'ch2_open'),
    ],
  };

  // =====================================================================
  // CHAPTER 3 — "Schala's Name" (12,000 B.C.)
  // Through-line: the man who killed Cyrus and the man who mourned him walk into the same
  // hall. What breaks Cyrus is not a sword: it is a statue with nothing inside it.
  // Pay-offs: the invitations (it was bait), "Stand up straight" (Frog says it back).
  // =====================================================================
  // Crono hands over what the sea gave back. Magus disposes of it. In his pocket.
  const catBeat = [
    ['if', ['has_cat', '!cat_given', 'magus_joined'], [
      ['face', 'crono', 'magus'],
      ['anim', 'crono', 'point'],
      ['face', 'magus', 'crono'],
      ['emote', 'magus', '!'],
      say('magus', 'surprised', `…Where did you get that.`),
      ['wait', 900],
      say('magus', 'neutral', `It's driftwood. Give it here. I'll dispose of it.`),
      ['sfx', 'sfx_item_get'],
      ['emote', 'magus', '...'],
      ['setflag', 'cat_given', true],
      ['losekey', 'carved_cat'],
    ]],
  ];

  S['3.1'] = {
    title: 'The Last Village',
    map: 'last_village', theme: 'snow', music: 'mus_last_village',
    actors: [
      { id: 'crono', at: '@crono', face: 'N' },
      { id: 'frog', at: '@crono', face: 'N' },
      { id: 'ayla', at: '@crono', face: 'N' },
      { id: 'elder', at: '@elder', face: 'S' },
      { id: 'magus', at: '@magus', face: 'E' },
      { id: 'vill1', sprite: 'villager_last', at: '@vill1', face: 'S' },
      { id: 'vill2', sprite: 'villager_last_b', at: '@vill2', face: 'E' },
      { id: 'vill3', sprite: 'villager_last_c', at: '@vill3', face: 'W' },
      { id: 'hunter', sprite: 'villager_last', at: '@shop', face: 'S' },
    ],
    script: [
      ['chapter', `III. SCHALA'S NAME`, '12,000 B.C.'],
      // A man on a cliff with his back to everyone.
      ['camera', 'magus', 0],
      ['fade', 'in', 900],
      ['wait', 1400],
      ['camera', 'crono', 800],
      ['move', 'crono', '@elder'],
      ['move', 'frog', '@elder', { nowait: true }],
      ['move', 'ayla', '@elder'],
      ['face', 'elder', 'crono'],
      say('elder', 'neutral', `The blue-haired one came at dawn. He asked where the sea leaves the wreckage. I told him. He has not gone to look. He stands on the cliff and does not eat.`),
      say('frog', 'neutral', `He is waiting for us. He would sooner drown than say so.`),
      ['field', {
        leader: 'crono',
        hint: [['!magus_joined', 'Speak to Magus on the cliff.'], 'Head north to the Zeal wreckage.'],
        npcs: [
          { id: 'magus', if: '!magus_joined', talk: [
            ['move', 'frog', 'crono', { nowait: true }],
            ['move', 'ayla', 'crono'],
            ['face', 'frog', 'magus'],
            ['face', 'ayla', 'magus'],
            ['face', 'magus', 'E'],
            say('magus', 'neutral', `You're late.`),
            say('frog', 'surprised', `Thou knew we were coming?`),
            say('magus', 'neutral', `A dead man told me.`),
            ['wait', 600],
            say('magus', 'neutral', `Yours, I believe.`),
            ['emote', 'frog', '!'],
            say('magus', 'neutral', `Last night. He stood where the boy is standing. No sword. He said he didn't blame me.`),
            ['wait', 800],
            say('magus', 'neutral', `I preferred him angry.`),
            ['face', 'magus', 'crono'],
            say('magus', 'neutral', `Then he said the thing in the grey future has built an exhibit. And he told me what it's called.`),
            say('ayla', 'neutral', `Schala.`),
            ['face', 'magus', 'ayla'],
            ['emote', 'magus', '!'],
            ['wait', 500],
            say('ayla', 'neutral', `Ghost-man tell Ayla too. Say: tell Blue-hair. Ayla tell.`),
            say('magus', 'neutral', `He asked me to come quietly.`),
            say('ayla', 'surprised', `Blue-hair go quiet?`),
            say('magus', 'angry', `I told him to go back to his grave. He said "fair enough," and went.`),
            ['face', 'magus', 'frog'],
            say('frog', 'angry', `Thou killed him. And he came to thee with no sword.`),
            say('magus', 'neutral', `Yes.`),
            ['wait', 900],
            say('frog', 'sad', `…That is the Cyrus I knew.`),
            say('magus', 'neutral', `It's bait. He hands out invitations like a butler. One for each of you. Now mine.`),
            say('magus', 'angry', `I'm going anyway. It has her name in its mouth.`),
            ['choice', ['Draw sword ("Then we take it back.")', 'Offer a hand ("Come with us.")'], [
              [
                ['anim', 'crono', 'draw_sword'],
                say('magus', 'determined', `…Good. I'd have despised sympathy.`),
              ],
              [
                ['anim', 'crono', 'point'],
                say('magus', 'neutral', `Put that away. I'm not joining anything.`),
                ['anim', 'crono', 'shrug'],
                say('magus', 'neutral', `…I'm walking in the same direction. Don't read into it.`),
              ],
            ], 'c_magus_join'],
            say('magus', 'neutral', `The wreck is north. He'll be in the great hall, where the light is best. I'll be *civil.*`),
            say('frog', 'neutral', `Thou wilt be nothing of the sort.`),
            say('magus', 'neutral', `No.`),
            ['join', 'magus'],
            ['setflag', 'magus_joined', true],
            ['popup', `Magus fights beside you now. He has new combo techs with Crono and Frog. He won't call them that.`],
            ['unlock', 'shadow_cyclone'],
            ['unlock', 'ice_water'],
            ...catBeat,
          ] },
          { id: 'elder', talk: [
            ['if', 'magus_joined', [
              say('elder', 'neutral', `He moved. I had begun to think he was a stone the sea left.`),
              say('elder', 'sad', `If you must go down there, go warm. The cold on that shore is older than we are.`),
            ], [
              say('elder', 'neutral', `The sea took a kingdom that floated. Every winter it hands a little back. We do not go down to the shore when it does.`),
            ]],
          ] },
          { id: 'vill1', name: 'Villager', talk: [N(`Villager: "The Zeal folk called us Earthbound, like it was a stain. Now the sky is empty and we are the ones with a roof."`)] },
          { id: 'vill2', name: 'Child', talk: [
            ['if', 'magus_joined', [
              N(`Child: "He blinked! When the frog shouted. That's one."`),
            ], [
              N(`Child: "The blue man hasn't blinked all morning. Mama says don't stare. I'm not staring. I'm counting."`),
            ]],
          ] },
          { id: 'vill3', name: 'Villager', talk: [N(`Villager: "Tracks in the snow last night. A big man in armour, by the stride. But they don't sink. Nothing that heavy should walk that light."`)] },
          { id: 'hunter', name: 'Hunter', talk: [
            N(`Hunter: "Pelts, pine-pitch, and blades that won't crack in the cold. Trade?"`),
            ['shop', 'last_village'],
          ] },
        ],
        spots: [
          { id: 'wrack', at: [9, 2], label: 'a crate of sea-wrack', script: [
            ['if', 'has_cat', [
              N(`A cracked blue tile, a gold hinge, a spoon. What the sea gave back this winter.`),
            ], [
              N(`What the sea gave back this winter: a cracked blue tile, a gold hinge, a spoon. And a small carved cat, the purple paint nearly gone.`),
              ['setflag', 'has_cat', true],
              ['reward', { key: 'carved_cat' }],
            ]],
            ...catBeat,
          ] },
          { id: 'tracks', at: [10, 5], label: 'two sets of tracks', script: [
            N(`Two sets of tracks at the cliff's edge, a pace apart. One sinks deep. The other only frosts the snow.`),
            N(`They stood here a long while. Neither set comes any closer to the other.`),
          ] },
          { id: 'cave', at: [2, 0], label: 'the old cave mouth', script: [
            N(`The Earthbound lived under here while Zeal floated overhead. The roof is black with ten generations of cook-smoke.`),
            say('ayla', 'happy', `Good cave. Ayla would stay.`),
          ] },
        ],
        events: [
          { id: 'ice', zone: [[1, 10], [2, 10], [3, 10], [1, 11], [2, 11], [3, 11], [1, 12], [2, 12], [3, 12]], script: [
            ['anim', 'ayla', 'spin'],
            say('ayla', 'happy', `Ground slippy! Ayla like!`),
            say('frog', 'neutral', `I shall wait here. A frog on ice is a short tale with a sad end.`),
          ] },
        ],
        exits: [{ zone: 'EXIT_NORTH', goto: '3.2', label: 'Zeal Wreckage', requires: 'magus_joined', locked: [
          say('frog', 'neutral', `Not without him. I would rather have that man where I can see him.`),
        ] }],
        save: '@save',
      }],
    ],
  };

  S['3.2'] = {
    title: 'Zeal Wreckage, great hall',
    map: 'zeal_wreck', theme: 'zeal', music: 'mus_zeal_wreck',
    actors: [
      { id: 'crono', at: '@crono', face: 'N' },
      { id: 'frog', at: '@frog', face: 'N' },
      { id: 'ayla', at: '@ayla', face: 'N' },
      { id: 'magus', at: '@magus', face: 'N' },
      { id: 'iselle', sprite: 'cyrus', at: '@iselle', face: 'N' },
      { id: 'sbg', sprite: 'stone_imp', at: '@guard', face: 'S' },
      { id: 'sen1', sprite: 'goon', at: '@sentinel1', face: 'S' },
      { id: 'sen2', sprite: 'goon', at: '@sentinel2', face: 'S' },
      { id: 'nu1', sprite: 'echo_ozzie', at: '@nu1', face: 'S' },
      { id: 'nu2', sprite: 'echo_ozzie', at: '@nu2', face: 'S' },
      { id: 'seed', sprite: 'lavos_seed', at: [8, 2], prop: true },
    ],
    script: [
      ['camera', 'magus', 0],
      ['fade', 'in', 1200],
      ['wait', 600],
      say('magus', 'neutral', `The great hall. I was born forty paces from here. It was a good deal higher up.`),
      // The beached end of the hall is walkable; crossing its middle (zone HALL_MID) starts the scene.
      ['field', {
        leader: 'crono',
        hint: 'Cross the hall toward the light.',
        spots: [
          { id: 'marks', at: [5, 11], label: 'scratches on a fallen column', script: [
            N(`Height marks, scratched into a fallen column. Two sets, side by side. The taller set stops. The shorter goes on a little way, alone. Then it stops too.`),
            ['emote', 'magus', '...'],
            say('magus', 'neutral', `Keep walking.`),
          ] },
          { id: 'stone', at: [9, 11], label: 'a seam of red stone', script: [
            N(`Dreamstone, cracked, still warm.`),
            say('ayla', 'happy', `Red rock! Ayla had red rock! Crono win it. Drinking.`),
            say('frog', 'surprised', `Thou out-drank *Ayla?*`),
            ['anim', 'crono', 'nod'],
            say('ayla', 'happy', `Ayla let Crono win.`),
            ['anim', 'crono', 'shake_head'],
          ] },
          { id: 'mural', at: [3, 10], label: 'a broken mural', script: [
            N(`A mural of the royal court. The queen's face has been chiselled out. Carefully, by someone who took their time.`),
            say('magus', 'neutral', `Not mine. I'd have been less tidy.`),
          ] },
        ],
        events: [
          { id: 'mid', zone: 'HALL_MID', script: [['endfield']] },
        ],
      }],
      ['camera', '@case', 900],
      ['sfx', 'sfx_seed_pulse'],
      ['wait', 900],
      ['camera', 'magus', 700],
      // Magus walks ahead of everyone and stops well short of the case.
      ['move', 'magus', [8, 8]],
      ['par', [['move', 'crono', [6, 9]], ['move', 'frog', [10, 9]], ['move', 'ayla', [8, 10]]]],
      ['par', [['face', 'crono', 'N'], ['face', 'frog', 'N'], ['face', 'ayla', 'N']]],
      ['face', 'iselle', 'S'],
      say('magus', 'neutral', `That isn't her.`),
      say('iselle', 'neutral', `No. It's entry one thousand and one. Her shape, built from every record that mentions her. A name. A pendant. Her voice, in other people's letters.`),
      say('iselle', 'neutral', `The Curator thought you'd want to see how much of her was left.`),
      ['music', 'mus_magus_theme'],
      say('magus', 'angry', `How much of her is left is not your archive's business.`),
      say('iselle', 'sad', `I said something like that. When I woke up in there, I asked what became of my squire. It showed me a frog.`),
      ['emote', 'iselle', '...'],
      say('iselle', 'sad', `It said it could keep him. Safe. Nothing would be taken from him again. And I had watched things be taken from him.`),
      say('frog', 'angry', `I do not need keeping, Cyrus!`),
      say('iselle', 'determined', `Everybody says that, Glenn. I said it. On the way down.`),
      ['face', 'magus', 'iselle'],
      say('magus', 'neutral', `If we're trading losses, knight: I'm the one who killed you.`),
      say('iselle', 'neutral', `I know. I was there.`),
      ['wait', 500],
      say('iselle', 'determined', `I held a pass once. I lost it, and everything behind it. I'm not losing this one.`),
      say('ayla', 'angry', `Ayla sorry ghost-man lose things. Ayla still break egg.`),
      say('iselle', 'angry', `I know you will, chief.`),
      ['anim', 'iselle', 'attack'],
      ['battle', 'B3'],
      ['goto', '3.3'],
    ],
  };

  S['3.3'] = {
    title: 'Hall, after',
    map: 'zeal_wreck', theme: 'zeal', music: 'mus_rift',
    actors: [
      // Blocked so the kneeling man stays in view: the party stands round him, never in front.
      { id: 'iselle', sprite: 'cyrus_human', at: '@iselle', face: 'S' },
      { id: 'crono', at: [5, 4], face: 'N' },
      { id: 'frog', at: '@guard', face: 'W' },
      { id: 'ayla', at: [4, 5], face: 'N' },
      { id: 'magus', at: [8, 7], face: 'N' },
    ],
    script: [
      ['camera', 'iselle', 0],
      ['face', 'crono', 'iselle'],
      ['face', 'ayla', 'iselle'],
      ['fade', 'in', 800],
      // Without the archive's armour he is a tired man kneeling in broken glass.
      ['anim', 'iselle', 'kneel'],
      ['wait', 600],
      say('iselle', 'sad', `Soldier's report. The seeds were bait. Three ages. Three of you, pulled out of your homes one at a time.`),
      say('iselle', 'sad', `Every swing you took at me, I logged. That was my post. It has your full measure now.`),
      say('magus', 'neutral', `We'd guessed. For what?`),
      say('iselle', 'neutral', `A last exhibit. The four who ended Lavos, in one case, forever. With you on the shelf it doesn't need seeds. It doesn't need *years.*`),
      say('ayla', 'angry', `Ayla no live in box.`),
      say('iselle', 'neutral', `It has opened its door. It isn't waiting for you to knock.`),
      ['move', 'magus', [6, 2]],
      ['face', 'magus', 'iselle'],
      say('magus', 'neutral', `Get up.`),
      say('iselle', 'surprised', `You?`),
      say('magus', 'neutral', `You know the building. And I took a life from you once. I'm not handing that *thing* the rest of it.`),
      say('iselle', 'sad', `It'll know I turned. It knows everything.`),
      say('magus', 'angry', `I've been known by monsters before. It never did them any good.`),
      ['face', 'frog', 'iselle'],
      say('frog', 'sad', `Cyrus. A knight guards the living. Thy words.`),
      ['wait', 700],
      say('frog', 'determined', `Stand up straight.`),
      ['emote', 'iselle', '!'],
      ['choice', ['Offer a hand', 'Wait'], [
        [
          ['move', 'crono', [6, 3]],
          ['face', 'crono', 'iselle'],
          ['anim', 'crono', 'kneel'],
          ['wait', 600],
          ['anim', 'crono', 'stand'],
          ['despawn', 'iselle'],
          ['spawn', { id: 'iselle', sprite: 'cyrus', at: '@iselle', face: 'S' }],
          say('iselle', 'determined', `…He has the look you had at his age, Glenn. Mule-stubborn. All right.`),
        ],
        [
          ['emote', 'crono', '...'],
          ['wait', 800],
          ['despawn', 'iselle'],
          ['spawn', { id: 'iselle', sprite: 'cyrus', at: '@iselle', face: 'S' }],
          say('iselle', 'determined', `Don't help. A knight gets up on his own.`),
        ],
      ], 'c_iselle_hand'],
      say('frog', 'neutral', `Then we go through the grey door. Together.`),
      ['face', 'frog', 'magus'],
      say('frog', 'neutral', `All of us.`),
      say('magus', 'neutral', `Don't say "together."`),
      ['wait', 800],
      say('magus', 'neutral', `…Fine. *Together.* Once.`),
      ['sfx', 'sfx_scanline'],
      radio('lucca', 'neutral', `I heard all that. The grey door is wide open on my readings. Epoch's on its way. And yes, the ghost can ride. He doesn't touch the controls.`),
      ['reward', { xp: 50, key: 'zeal_seed' }],
      ['guest', 'iselle', true],
      ['popup', 'Cyrus joins as a guest ally for the battles in the Hollow.'],
      ...toHub(4, 3, 'ch4_open', 'ch3_open'),
    ],
  };

  // =====================================================================
  // CHAPTER 4 — "The Museum of Never" (The Hollow)
  // Through-line: your life behind glass, correctly labelled, is not your life.
  // Pay-offs: the flowers (the archive cannot keep what wilts), the bell that does not ring,
  // "lost property", "together", and a death finished ten years late.
  // =====================================================================
  S['4.1'] = {
    title: 'The grey door',
    map: 'end_of_time', theme: 'void', music: 'mus_rift',
    actors: [
      { id: 'crono', at: '@arrive', face: 'N' },
      { id: 'frog', at: '@arrive', face: 'N' },
      { id: 'ayla', at: '@arrive', face: 'N' },
      { id: 'magus', at: '@arrive', face: 'N' },
      { id: 'iselle', sprite: 'cyrus', at: [11, 2], face: 'S' },
      { id: 'gaspar', at: '@gaspar', face: 'S' },
    ],
    script: [
      ['chapter', 'IV. THE MUSEUM OF NEVER', 'THE HOLLOW'],
      ['fade', 'in', 600],
      ['vfx', 'time_rift', '@door_grey'],
      ['sfx', 'sfx_hollow_gate'],
      ['camera', '@door_grey', 900],
      ['wait', 800],
      ['face', 'iselle', 'crono'],
      say('iselle', 'determined', `Stay close. Past this door nothing stays where you left it. Not even you.`),
      say('frog', 'determined', `Lead on, Cyrus. Like before.`),
      say('iselle', 'happy', `Like before. Try to keep up this time.`),
      ['anim', 'crono', 'nod'],
      ['face', 'gaspar', 'crono'],
      say('gaspar', 'sad', `I'll keep the lamp lit, boy. It's the one thing I'm good at.`),
      ['sfx', 'sfx_scanline'],
      radio('lucca', 'neutral', `Signal's breaking up already. If you can hear me in there… I'll keep talking. I always do.`),
      ['face', 'iselle', 'N'],
      ['move', 'iselle', '@door_grey'],
      ['hide', 'iselle'],
      ['sfx', 'sfx_hollow_gate'],
      ['par', [
        ['move', 'crono', '@door_grey'],
        ['move', 'frog', '@door_grey'],
        ['move', 'ayla', '@door_grey'],
        ['move', 'magus', '@door_grey'],
      ]],
      ['sfx', 'sfx_scanline'],
      ['fade', 'out', 900, '255,255,255'],
      ['close_rift'],
      ['goto', '4.2'],
    ],
  };

  S['4.2'] = {
    title: 'Atrium',
    map: 'hollow_atrium', theme: 'museum', music: 'mus_hollow',
    actors: [
      { id: 'crono', at: [8, 8], face: 'N' },
      { id: 'frog', at: [7, 8], face: 'N' },
      { id: 'ayla', at: [9, 8], face: 'N' },
      { id: 'magus', at: [8, 9], face: 'N' },
      { id: 'iselle', sprite: 'cyrus', at: [8, 7], face: 'N' },
      { id: 'sen1', sprite: 'goon', at: '@sentinel1', face: 'S' },
      { id: 'sen2', sprite: 'goon', at: '@sentinel2', face: 'S' },
      { id: 'sen3', sprite: 'goon', at: '@sentinel3', face: 'S' },
      { id: 'sen4', sprite: 'goon', at: '@sentinel4', face: 'S' },
    ],
    script: [
      ['fade', 'in', 1000, '255,255,255'],
      ['sfx', 'sfx_step'],
      ['wait', 400],
      ['sfx', 'sfx_step'],
      ['camera', 'map', 1500],
      ['wait', 800],
      ['camera', 'crono', 800],
      V(`WELCOME. YOU ARE THE FIRST VISITORS. YOU ARE ALSO THE FINAL ACQUISITION. BOTH ARE HONOURS.`),
      say('frog', 'angry', `Show thyself!`),
      V(`I AM ON DISPLAY THROUGHOUT. PLEASE WALK THE HALLS. EVERYTHING YOU HAVE LOST IS HERE, CORRECTLY LABELLED.`),
      ['face', 'ayla', 'E'],
      say('ayla', 'sad', `Ayla's village. In glass box. Little fire. Little Kino.`),
      ['wait', 400],
      say('ayla', 'angry', `Kino not that little. Ayla HATE museum.`),
      V(`I NOTE YOU ARE CARRYING THREE ITEMS FROM MY COLLECTION. THANK YOU FOR RETURNING THEM. THE CLOAKROOM IS ON YOUR LEFT.`),
      say('iselle', 'angry', `Don't answer it. It talks like that until you forget you're standing in a grave.`),
      V(`WARDEN. ENTRY 0-A. YOU ARE OUT OF YOUR CASE. I WILL CORRECT THE LABEL AFTERWARD.`),
      say('magus', 'neutral', `You'll be busy.`),
      V(`I AM NEVER BUSY. I AM COMPLETE.`),
      ['wait', 800],
      V(`THE TOUR BEGINS. PLEASE STAY WITH YOUR GROUP.`),
      // The golden statues wake and step off their plinths; an Echo Avian Rex screeches from a gallery arch.
      ['sfx', 'sfx_glass_shatter'],
      ['par', [['anim', 'sen1', 'jump'], ['anim', 'sen2', 'jump'], ['anim', 'sen3', 'jump'], ['anim', 'sen4', 'jump']]],
      ['sfx', 'sfx_porcelain_step'],
      ['spawn', { id: 'tyrano', sprite: 'echo_avian_rex', at: '@tyrano', face: 'S' }],
      ['camera', 'tyrano', 700],
      ['shake', 900],
      ['emote', 'ayla', '!'],
      ['battle', 'B4A'],
      ['goto', '4.25'],
    ],
  };

  // The East Wing: a walkable gallery of the party's own past. Everything in it is optional
  // except walking to the far arch. This is where the theme is shown instead of argued.
  S['4.25'] = {
    title: 'The East Wing',
    map: 'hollow_gallery', theme: 'museum', music: 'mus_hollow',
    actors: [
      { id: 'crono', at: '@entry', face: 'N' },
      { id: 'iselle', sprite: 'cyrus', at: [5, 11], face: 'S' },
      { id: 'frog', at: [4, 13], face: 'N' },
      { id: 'ayla', at: [6, 13], face: 'N' },
      { id: 'magus', at: [5, 14], face: 'N' },
    ],
    script: [
      ['camera', 'crono', 0],
      ['fade', 'in', 800],
      V(`THE EAST WING. RECENT ACQUISITIONS. YOU MAY READ THE LABELS. IN A SENSE, YOU WROTE THEM.`),
      say('iselle', 'neutral', `The Core is past the archive, through the far arch. Don't read the labels. That's how it gets in.`),
      say('ayla', 'happy', `Ayla no read. Ayla safe.`),
      ['move', 'iselle', [4, 12]],
      ['field', {
        leader: 'crono',
        followers: ['frog', 'ayla', 'magus', 'iselle'],
        hint: 'Walk the East Wing to the far arch.',
        spots: [
          { id: 'fair', at: '@ex_fair', label: 'Entry 1', script: [
            P(`ENTRY 1. CRONO, OF TRUCE. ACQUIRED AT THE MILLENNIAL FAIR, IN MOTION. DESTROYED, 12,000 B.C. RESTORED BY THIRD PARTIES. CONDITION: GOOD. DOES NOT SPEAK.`),
            ['emote', 'crono', '...'],
            say('magus', 'neutral', `"Does not speak." The one accurate label in the building.`),
          ] },
          { id: 'bell', at: '@ex_bell', label: `Leene's Bell`, script: [
            P(`LEENE'S BELL (FULL RECORD). RUNG FOR ARRIVALS, FAREWELLS, AND ONE WEDDING. DOES NOT RING. RINGING IS WEAR.`),
            ['choice', ['Ring it anyway', 'Leave it'], [
              [
                ['anim', 'crono', 'point'],
                ['sfx', 'sfx_cancel'],
                ['wait', 600],
                N(`Tok.`),
                ['setflag', 'rang_replica', true],
                say('ayla', 'sad', `Bell broken.`),
                say('iselle', 'sad', `No. Kept.`),
              ],
              [
                ['emote', 'crono', '...'],
              ],
            ], 'c_replica'],
          ] },
          { id: 'sword', at: '@ex_sword', label: 'Entry 2', script: [
            P(`ENTRY 2. GLENN, SQUIRE. SUPERSEDED BY ENTRY 2-B (AMPHIBIAN). 2-B IS LISTED AS A REPAIR.`),
            say('frog', 'angry', `A *repair.*`),
            say('iselle', 'happy', `I'd have said an improvement. You never kept your guard up as a boy.`),
            ['emote', 'frog', '...'],
          ] },
          { id: 'cairn', at: '@ex_cairn', label: 'Entry 0-A, supporting material', script: [
            P(`ENTRY 0-A, SUPPORTING MATERIAL. GRAVE CAIRN, DENADORO. RECONSTRUCTION. STONES CORRECTED TO VERTICAL.`),
            say('iselle', 'neutral', `Mine. It let me visit. I took that for kindness.`),
            ['if', 'flowers_laid', [
              say('frog', 'neutral', `There are no flowers on it.`),
              say('iselle', 'surprised', `Flowers?`),
              say('frog', 'sad', `On the real one. From Leene. Crono carried them up.`),
              ['wait', 900],
              say('iselle', 'sad', `…It wouldn't have kept those. They wilt.`),
              ['emote', 'iselle', '...'],
              ['setflag', 'cyrus_knows_flowers', true],
            ], [
              say('iselle', 'sad', `Tidy. Nobody has ever left anything on it. Nobody could.`),
            ]],
          ] },
          { id: 'ioka', at: '@ex_ioka', label: 'Entry 9', script: [
            P(`ENTRY 9. AYLA, CHIEF. SUPPORTING MATERIAL: DWELLING, IOKA (TO SCALE). SUBJECT LEFT NO WRITTEN RECORD. RECONSTRUCTED FROM APPETITE.`),
            say('ayla', 'happy', `Ha! Box-thing know Ayla good.`),
            say('ayla', 'angry', `Hut too clean. Where bones? Ayla's hut have bones.`),
          ] },
          { id: 'zeal', at: '@ex_zeal', label: 'Entry 13', script: [
            P(`ENTRY 13. JANUS, PRINCE OF ZEAL. STATUS: LOST. SUPPORTING MATERIAL: A PENDANT (REPLICA). CAT: NOT RECOVERED. SEE ALSO: THE PROPHET; MAGUS; "BLUE-HAIR". ONE SUBJECT, FOUR LABELS. PLEASE SELECT ONE.`),
            say('magus', 'neutral', `No.`),
            ['if', 'cat_given', [
              ['emote', 'magus', '...'],
              say('magus', 'neutral', `"Cat: not recovered." It should check its facts.`),
            ]],
          ] },
          { id: 'epoch', at: '@ex_epoch', label: 'Entries 3, 5 and 6', script: [
            P(`ENTRIES 3, 5, 6. THE PRINCESS. THE INVENTOR. THE MACHINE. NOT YET ACQUIRED. REPRESENTED BY THEIR VEHICLE (MODEL). ACQUISITION IS SCHEDULED.`),
            ['sfx', 'sfx_scanline'],
            radio('lucca', 'angry', `— *model?* Did that thing just call the Epoch a — kzzt — to-scale *insult* —`),
            ['sfx', 'sfx_scanline'],
          ] },
          { id: 'empty', at: '@ex_empty', label: 'a blank placard', script: [
            P(`ENTRY 0. THIS LABEL HAS BEEN LEFT BLANK. THE COLLECTION DOES NOT DESCRIBE ITSELF.`),
            say('iselle', 'neutral', `I asked it once what it was. It said "complete." I told it I was a knight. It wrote down "armour."`),
          ] },
        ],
        events: [
          { id: 'lean', zone: 'MID', script: [
            V(`PLEASE DO NOT LEAN ON THE GLASS, ENTRY 9.`),
            say('ayla', 'angry', `Ayla not lean. Ayla *push.*`),
            ['sfx', 'sfx_glass_shatter'],
            ['shake', 300],
            V(`…THANK YOU.`),
          ] },
        ],
        exits: [{ zone: 'EXIT_NORTH', goto: '4.3', label: 'The Archive' }],
      }],
    ],
  };

  S['4.3'] = {
    title: 'The Archive stacks',
    map: 'hollow_archive', theme: 'museum', music: 'mus_hollow',
    actors: [
      { id: 'iselle', sprite: 'cyrus', at: '@corin_shelf', face: 'N' },
      { id: 'frog', at: '@frog', face: 'W' },
      { id: 'magus', at: '@magus', face: 'W' },
      { id: 'crono', at: '@hench_e1', face: 'N' },
      { id: 'ayla', at: '@hench_e2', face: 'N' },
    ],
    script: [
      ['camera', 'iselle', 0],
      ['fade', 'in', 800],
      V(`THE ARCHIVE. PLEASE DO NOT TOUCH THE RECORDS.`),
      ['anim', 'iselle', 'kneel'],
      ['sfx', 'sfx_item_get'],
      ['wait', 500],
      say('iselle', 'sad', `Here. Zeal. The royal house. Everything it has on Schala.`),
      ['emote', 'iselle', '...'],
      say('iselle', 'sad', `One tablet. A girl with a pendant, smiling at somebody shorter than she is. That's the whole record.`),
      ['wait', 700],
      say('magus', 'neutral', `Put it back.`),
      say('iselle', 'sad', `Magus —`),
      say('magus', 'angry', `Put. It. Back. I won't have her handled.`),
      ['anim', 'iselle', 'stand'],
      ['face', 'iselle', 'magus'],
      say('iselle', 'neutral', `No. Someone ought to carry her out of here. I have the hands for it. They aren't good for much else now.`),
      ['wait', 800],
      say('magus', 'neutral', `…Don't drop it.`),
      say('frog', 'neutral', `Is there a shelf for thee too, Cyrus?`),
      say('iselle', 'neutral', `Entry 0-A. Cyrus of Guardia. Died on Denadoro. Status: complete.`),
      say('iselle', 'sad', `I was never complete. I died with the pass still open behind me.`),
      say('frog', 'determined', `Then we close it. Today.`),
      say('iselle', 'determined', `The Core is below us. It'll try to split us up in the stacks. Don't let it.`),
      V(`THE WARDEN IS CORRECT. SEPARATION IS EFFICIENT.`),
      // The shelves slide and the floor splits the party.
      ['shake', 1200],
      ['sfx', 'sfx_glass_shatter'],
      ['flash'],
      ['fade', 'out', 400],
      ['despawn', 'crono'], ['despawn', 'ayla'], ['despawn', 'frog'], ['despawn', 'magus'], ['despawn', 'iselle'],
      ['spawn', { id: 'crono', at: '@crono', face: 'E' }],
      ['spawn', { id: 'ayla', at: '@ayla', face: 'E' }],
      ['spawn', { id: 'frog', at: '@frog', face: 'W' }],
      ['spawn', { id: 'magus', at: '@magus', face: 'W' }],
      ['spawn', { id: 'iselle', sprite: 'cyrus', at: '@iselle', face: 'W' }],
      ['camera', 'map', 0],
      ['fade', 'in', 500],
      ['par', [['emote', 'ayla', '!'], ['emote', 'frog', '!']]],
      ['battle', 'B4B'],
      ['goto', '4.4'],
    ],
  };

  S['4.4'] = {
    title: 'The Core Exhibit',
    map: 'hollow_core', theme: 'core', music: 'mus_curator',
    actors: [
      { id: 'crono', at: [7, 12], face: 'N' },
      { id: 'frog', at: [6, 12], face: 'N' },
      { id: 'ayla', at: [8, 12], face: 'N' },
      { id: 'magus', at: [9, 12], face: 'N' },
      { id: 'iselle', sprite: 'cyrus', at: '@party', face: 'N' },
      { id: 'curator', sprite: 'prophet', at: '@curator', face: 'S' },
    ],
    script: [
      ['camera', 'frog', 0],
      ['fade', 'in', 1000],
      say('frog', 'neutral', `Is everyone whole?`),
      say('ayla', 'angry', `Ayla whole. Ayla angry.`),
      ['camera', 'curator', 800],
      ['wait', 600],
      V(`THE COLLECTION IS COMPLETE. THE FOUR WHO ENDED THE WORLD-EATER. STEP INTO THE CASE, AND EVERY ERA IS SAFE FOREVER. UNCHANGING. UNENDING. UNHARMED.`),
      ['camera', 'frog', 500],
      say('frog', 'angry', `And unliving.`),
      V(`LIVING IS THE PROCESS BY WHICH THINGS ARE LOST. I HAVE CORRECTED IT.`),
      ['camera', 'magus', 500],
      ['emote', 'magus', '!'],
      say('magus', 'surprised', `That shape.`),
      say('magus', 'angry', `That's the Prophet. You're wearing *me.*`),
      V(`IT IS THE SHAPE YOU WORE TO STAND NEAR HER. I ASSUMED IT WOULD PUT YOU AT EASE.`),
      say('magus', 'angry', `It was a mask. You've made a mask of a mask.`),
      ['move', 'iselle', [7, 10]],
      ['face', 'iselle', 'curator'],
      say('iselle', 'broken', `You "corrected" me. You caught me falling, and I have been falling ever since. Ten years. The same minute. Look at your work.`),
      ['anim', 'iselle', 'point'],
      V(`ENTRY 0-A IS INTACT.`),
      say('iselle', 'angry', `I'm *stuck!*`),
      V(`…`),
      ['wait', 1500],
      V(`…YOU ARE INTACT.`),
      ['face', 'magus', 'curator'],
      say('magus', 'neutral', `Once, then. For the thing that wore my face and put my sister's on a shell.`),
      say('magus', 'angry', `Nothing you keep is kept. It's only *stopped.* And I have killed bigger things than you for wanting the world stopped.`),
      ['choice', ['Draw sword'], [[['anim', 'crono', 'draw_sword']]], 'c_final'],
      ['anim', 'frog', 'draw_sword'],
      ['sfx', 'sfx_kick'],
      ['emote', 'ayla', '!'],
      ['sfx', 'sfx_dark_mist'],
      ['emote', 'magus', '!'],
      ['face', 'iselle', 'frog'],
      say('iselle', 'sad', `I'm half its making still. In there, it could turn my hand against you.`),
      say('iselle', 'determined', `So this one is yours. Glenn. Guard up.`),
      say('frog', 'determined', `Watch me.`),
      ['move', 'iselle', '@iselle_edge'],
      ['face', 'iselle', 'curator'],
      ['guest', 'iselle', false],
      ['battle', 'B5'],
      ['goto', '4.5'],
    ],
  };

  S['4.5'] = {
    title: 'The Core collapses',
    map: 'hollow_core', theme: 'core',
    actors: [
      // Staged so nobody stands in front of the man who is leaving: Ayla, Crono, Frog in a
      // line, a gap for Cyrus beside Frog, Magus on his other side.
      { id: 'ayla', at: [6, 12], face: 'N' },
      { id: 'crono', at: [7, 12], face: 'N' },
      { id: 'frog', at: [8, 12], face: 'N' },
      { id: 'magus', at: [10, 11], face: 'N' },
      { id: 'iselle', sprite: 'cyrus', at: '@iselle_edge', face: 'N' },
      { id: 'core', sprite: 'curator_p2', at: '@curator', face: 'S' },
    ],
    script: [
      ['music', null],
      ['camera', 'core', 0],
      ['fade', 'in', 600],
      ['wait', 2000],
      // The red knot flickers, shrinks to a grey seed, and goes still.
      ['sfx', 'sfx_seed_pulse'],
      ['flash'],
      ['wait', 400],
      ['sfx', 'sfx_seed_pulse'],
      ['despawn', 'core'],
      ['spawn', { id: 'grey_seed', sprite: 'lavos_seed_inert', at: '@curator', prop: true }],
      ['wait', 1200],
      // The museum dissolves into scanlines; the display cases pop like soap bubbles.
      ['sfx', 'sfx_scanline'],
      ['vfx', 'glass_shatter', '@case'],
      ['sfx', 'sfx_glass_shatter'],
      ['theme', 'void'],
      ['wait', 900],
      // Somewhere in the halls, a bell that was never allowed to ring, rings.
      ['sfx', 'sfx_leene_bell'],
      ['par', [['emote', 'ayla', '!'], ['emote', 'frog', '!']]],
      ['wait', 1400],
      ['music', 'mus_ending'],
      ['camera', 'iselle', 800],
      say('iselle', 'neutral', `That's the bell in the East Wing. It never let that ring.`),
      ['wait', 500],
      say('iselle', 'neutral', `It's coming apart. All of it. The halls. The shelves. Me.`),
      // The archive's armour falls away; the man underneath is only Cyrus.
      ['vfx', 'sparkle', '@iselle_edge'],
      ['despawn', 'iselle'],
      ['spawn', { id: 'iselle', sprite: 'cyrus_human', at: '@iselle_edge', face: 'N' }],
      ['wait', 700],
      say('frog', 'sad', `Cyrus —`),
      ['move', 'iselle', [9, 12]],
      ['face', 'iselle', 'frog'],
      ['face', 'frog', 'iselle'],
      say('iselle', 'broken', `Don't, Glenn. It's the right end. I died on that mountain. I'm only finishing.`),
      ['face', 'iselle', 'magus'],
      ['face', 'magus', 'iselle'],
      say('iselle', 'neutral', `Magus. Here.`),
      ['sfx', 'sfx_item_get'],
      ['emote', 'magus', '...'],
      say('iselle', 'broken', `Not a case. A pocket. Somewhere that moves.`),
      say('magus', 'neutral', `…Why me?`),
      say('iselle', 'happy', `Because you'll carry her somewhere. It's all any of us wanted.`),
      say('magus', 'neutral', `I'll keep it badly. I'll lose it weekly.`),
      say('iselle', 'happy', `Good. That's living.`),
      ['face', 'iselle', 'frog'],
      ['if', 'cyrus_knows_flowers', [
        say('iselle', 'happy', `Thank the Queen for the flowers. Tell her they'll have wilted by now. Tell her that's the good part.`),
      ]],
      say('frog', 'sad', `I never thanked thee. For any of it.`),
      say('iselle', 'happy', `You have. Ten years, every time you drew that sword.`),
      ['wait', 500],
      say('iselle', 'neutral', `Stand up straight. Go home. And let the mountain be a mountain.`),
      ['face', 'iselle', 'crono'],
      say('iselle', 'neutral', `Crono. You never said a word to me.`),
      ['choice', ['Nod', 'Bow'], [
        [['anim', 'crono', 'nod'], say('iselle', 'happy', `…Yes. That was enough.`)],
        [['anim', 'crono', 'bow'], say('iselle', 'surprised', `Ha! Far too gallant. Glenn, you've been a bad influence.`), ['emote', 'iselle', '♪']],
      ], 'c_iselle_end'],
      say('ayla', 'sad', `Ghost-man brave. Ayla remember. Ayla tell fire.`),
      say('iselle', 'happy', `Tell it loud.`),
      ['sfx', 'sfx_scanline'],
      ['anim', 'iselle', 'dissolve'],
      ['despawn', 'iselle'],
      ['wait', 1200],
      ['par', [['emote', 'frog', '...'], ['emote', 'magus', '...']]],
      ['reward', { key: 'corin_tablet' }],
      // The floor drops away into white; a blue Gate opens under the party.
      ['shake', 800],
      ['sfx', 'sfx_scanline'],
      radio('lucca', 'surprised', `— hear me? Crono! A Gate's opening right under you! A real one, a *blue* one! JUMP!`),
      ['fade', 'out', 1200, '255,255,255'],
      ['sfx', 'sfx_gate_open'],
      ['wait', 800],
      ['goto', '5.1'],
    ],
  };

  // =====================================================================
  // EPILOGUE — "Tomorrow, Unwritten"
  // Everything set up comes home: three doors, lost property, the meadow, the recording,
  // "stand up straight", "tell it loud", and the bell.
  // =====================================================================
  S['5.1'] = {
    title: 'End of Time, epilogue',
    map: 'end_of_time', theme: 'void', music: 'mus_ending',
    actors: [
      { id: 'crono', at: '@arrive', face: 'N' },
      { id: 'frog', at: '@save', face: 'N' },
      { id: 'ayla', at: '@arrive', face: 'N' },
      { id: 'magus', at: '@lamppost', face: 'W' },
      { id: 'gaspar', at: '@gaspar', face: 'S' },
      { id: 'nu', at: '@nu', face: 'S' },
      { id: 'spekkio', sprite: 'frog_king', at: '@spekkio', face: 'S' },
    ],
    script: [
      ['setflag', 'ch4_open', false],       // the grey door is gone
      ['chapter', 'EPILOGUE. TOMORROW, UNWRITTEN', 'THE END OF TIME'],
      ['vfx', 'gate', '@arrive'],
      ['fade', 'in', 1200, '255,255,255'],
      ['close_rift'],
      ['camera', '@door_grey', 900],
      ['wait', 600],
      ['camera', 'gaspar', 800],
      ['face', 'gaspar', 'crono'],
      say('gaspar', 'happy', `Three doors. That's the right number of doors.`),
      ['face', 'gaspar', 'magus'],
      say('gaspar', 'happy', `You're carrying something, mage.`),
      say('magus', 'neutral', `Lost property.`),
      ['emote', 'magus', '...'],
      say('magus', 'neutral', `It's none of your concern.`),
      say('gaspar', 'neutral', `Nothing is. That's the job.`),
      ['face', 'gaspar', 'frog'],
      say('frog', 'sad', `Cyrus is gone, Gaspar. Truly, this time.`),
      say('gaspar', 'neutral', `Then his long day is over. Yours too, knight. You may sit down.`),
      ['wait', 500],
      say('gaspar', 'happy', `Go home, all of you. Someone in 1000 A.D. has been ringing a bell at the Gate all night. Badly.`),
      ['fade', 'out', 1200],
      ['sfx', 'sfx_gate_open'],
      ['wait', 600],
      ['goto', '5.2'],
    ],
  };

  S['5.2'] = {
    title: 'Leene Square, dawn',
    map: 'leene_square', theme: 'dawn', music: 'mus_ending',
    actors: [
      { id: 'marle', at: '@marle', face: 'N' },
      { id: 'lucca', at: '@lucca', face: 'N' },
      { id: 'robo', at: '@robo', face: 'N' },
    ],
    script: [
      ['camera', '@bell', 0],
      ['fade', 'in', 1200],
      ['vfx', 'gate', '@gate'],
      ['sfx', 'sfx_gate_open'],
      ['spawn', { id: 'crono', at: '@gate', face: 'S' }],
      ['move', 'crono', '@crono'],
      ['spawn', { id: 'frog', at: '@gate', face: 'S' }],
      ['move', 'frog', '@frog'],
      ['spawn', { id: 'ayla', at: '@gate', face: 'S' }],
      ['move', 'ayla', '@fair1'],
      ['spawn', { id: 'magus', at: '@gate', face: 'S' }],
      ['move', 'magus', '@fair2'],
      ['par', [['face', 'marle', 'crono'], ['face', 'lucca', 'crono'], ['face', 'robo', 'crono']]],
      ['anim', 'marle', 'jump'],
      say('marle', 'happy', `One, two, three, four — all your limbs! You listened!`),
      ['anim', 'crono', 'nod'],
      say('lucca', 'happy', `The radio died for six hours. Six. I aged a decade and invented two things out of nerves.`),
      say('robo', 'neutral', `I found the address the numbers came from. 2300 A.D. The archive dome.`),
      ['wait', 400],
      say('robo', 'happy', `There is a meadow there now. There are sheep. I did not record it. I stood in it.`),
      // The Warden's last message always plays.
      say('lucca', 'neutral', `Oh — the last thing the radio caught before it died. A man's voice. Very polite. "Entry filed. Tell Glenn to stand up straight." Friend of yours?`),
      ['face', 'frog', 'lucca'],
      say('frog', 'sad', `Aye. He was my teacher.`),
      ['wait', 500],
      say('frog', 'happy', `He still is.`),
      say('robo', 'neutral', `I have made a decision. I am deleting my recording of Lucca dancing. Some things are better remembered than kept.`),
      say('lucca', 'surprised', `…Thank you?`),
      say('marle', 'angry', `Wait, I never got to see it!`),
      say('robo', 'happy', `I will tell you about it instead. It gets better every time.`),
      ['face', 'frog', 'N'],
      say('frog', 'happy', `Then 'tis done. I am going home. And the next time I climb that mountain, it will only be a mountain.`),
      // Ayla's farewell always plays.
      ['face', 'ayla', 'crono'],
      say('ayla', 'happy', `Ayla go home too. Ayla tell fire about ghost-knight. Tell it loud, like he say.`),
      say('ayla', 'happy', `Kino cry when Ayla leave. Kino cry when Ayla come back. Kino good at cry.`),
      say('marle', 'neutral', `Magus?`),
      ['move', 'magus', [4, 3]],
      say('magus', 'neutral', `Somewhere there's a year in which a girl named Schala is not a shell on a plinth. I mean to find it. Don't follow.`),
      say('frog', 'neutral', `We won't.`),
      ['wait', 600],
      say('magus', 'neutral', `…Frog.`),
      say('frog', 'neutral', `Aye?`),
      ['wait', 1600],
      ['if', { flag: 'eclipse_uses', gt: 1 }, [
        say('magus', 'neutral', `…Together. There. That is the last time I say it.`),
      ], [
        say('magus', 'neutral', `Nothing.`),
      ]],
      ['move', 'magus', '@gate'],
      ['sfx', 'sfx_gate_close'],
      ['despawn', 'magus'],
      ['wait', 800],
      say('frog', 'happy', `That was "thank you." He will deny it.`),
      ['choice', ['Ring the bell'], [[
        ['move', 'crono', '@bell'],
        ['face', 'crono', 'N'],
        ['sfx', 'sfx_leene_bell'],
      ]], 'c_bell'],
      ['anim', 'marle', 'cheer'],
      ['par', [['emote', 'marle', '!'], ['emote', 'lucca', '!'], ['emote', 'robo', '!'], ['emote', 'frog', '!'], ['emote', 'ayla', '!']]],
      ['camera', '@bell', 1800],
      ['wait', 2500],
      ['fade', 'out', 2000],
      ['text', `Every record ends. That's how you can tell it was a life.`],
      ['credits'],
    ],
  };

  // =====================================================================
  // BATTLES
  // =====================================================================
  const B = {};

  B.B0 = {
    name: 'Echoes at the Fair', map: 'leene_square', music: 'mus_battle',
    // Marle, Lucca and Robo fight here too (ranged normal attacks); they leave after.
    partyOverride: ['crono', 'frog', 'marle', 'lucca', 'robo'],
    party: { crono: [4, 8], frog: [5, 8], marle: [6, 10], lucca: [3, 10], robo: [7, 9] },
    units: [
      { id: 'imp1', type: 'echo_imp', at: [4, 2], face: 'S', hp: 40 },
      { id: 'imp2', type: 'echo_imp', at: [6, 2], face: 'S', hp: 40 },
      { id: 'hench', type: 'echo_hench', at: [5, 3], face: 'S', hp: 62 },
      { id: 'imp3', type: 'echo_imp', at: [10, 3], face: 'S', hp: 40 },
      { id: 'imp4', type: 'echo_imp', at: [2, 3], face: 'S', hp: 40 },
      { id: 'imp5', type: 'echo_imp', at: [11, 7], face: 'W', hp: 40 },
      { id: 'hench2', type: 'echo_hench', at: [9, 2], face: 'S', hp: 62 },
    ],
    objective: { type: 'DEFEAT_ALL', text: 'Defeat the Echoes!' },
    triggers: [
      { id: 'B0_T1', when: 'PRE_BATTLE', focus: 'frog',
        lines: [
          L('frog', 'neutral', `Take the high ground, Crono. A blow from above strikes harder.`),
          L('marle', 'determined', `Lucca, Robo and I will shoot from back here. Just keep them off us!`),
          L('lucca', 'determined', `And try not to stand in front of my gun.`),
          L('robo', 'neutral', `Targeting the grey ones. Not the green one.`),
          L('frog', 'neutral', `…My thanks, Robo.`),
        ],
        script: [
          ['popup', 'Blue tiles show how far a unit can move; climbing costs extra. Red tiles show what it can attack. Higher ground hits harder.'],
          ['popup', 'Marle, Lucca and Robo fight from range: their normal attack reaches foes several tiles away. Keep them behind Crono and Frog.'],
        ] },
      { id: 'B0_T2', when: 'TURN_START', args: { n: 2 }, focus: 'frog',
        lines: [L('frog', 'neutral', `Thy Cyclone strikes every foe around thee. Use it when they crowd in.`)],
        script: [['popup', 'Techs cost MP. Open the Tech menu to use Cyclone: it hits every tile around Crono.']] },
      { id: 'B0_T3', when: 'UNIT_HP_BELOW', args: { unit: 'crono', pct: 60 }, focus: 'frog',
        lines: [
          L('frog', 'neutral', `Hold, Crono! I will heal thee.`),
          L('marle', 'happy', `Or I can! My Aura reaches further. No tongue involved.`),
        ],
        script: [['popup', `Frog's Slurp heals one ally within 3 tiles; Marle's Aura reaches 4. Find them in each hero's Tech menu.`]] },
      { id: 'B0_T4', when: 'UNIT_ADJACENT', args: { a: 'crono', b: 'frog', enemyAdjacent: true }, focus: 'frog',
        lines: [L('frog', 'determined', `Side by side, Crono! Cross blades with me — the X-Strike!`)],
        effect: [{ type: 'UNLOCK_TECH', tech: 'x_strike' }],
        script: [['popup', 'Dual techs appear when a partner is within 3 tiles and has charged at least halfway. Both pay MP, and the partner spends their next turn.']] },
      { id: 'B0_T5', when: 'UNIT_DEFEATED', args: { unit: 'hench' }, focus: 'hench',
        lines: [
          L('frog', 'surprised', `It did not fall. It faded.`),
          L('robo', 'neutral', `No body. No heat. That was not a creature. That was a recording of one.`),
        ] },
      victoryMusic('B0_T6'),
      { id: 'B0_DEFEAT', when: 'DEFEAT',
        lines: [L('frog', 'sad', `Get up, Crono… the fair is not safe yet.`)] },
    ],
    rewards: { xp: 190, gold: 50, items: { tonic: 2 } },
  };

  B.B1 = {
    name: 'Denadoro Seed', map: 'denadoro', music: 'mus_battle_boss',
    party: { crono: [7, 14], frog: [8, 14] },
    units: [
      { id: 'seedA', type: 'seedbearer', at: '@seed_a', face: 'N', hp: 120, spd: 5, move: 2, carrying: true, ai: 'seek_zone', zone: 'SHRINE' },
      { id: 'seedB', type: 'seedbearer', at: '@seed_b', face: 'N', hp: 120, ai: 'protect', protect: 'seedA' },
      { id: 'kil1', type: 'echo_kilwala', near: '@kilwala1', hp: 60 },
      { id: 'kil2', type: 'echo_kilwala', near: '@kilwala2', hp: 60 },
      { id: 'kil3', type: 'echo_kilwala', near: '@kilwala3', hp: 60 },
      { id: 'iselle', type: 'iselle', at: '@iselle', face: 'S', ai: 'hold', hp: 300, immortal: true },
    ],
    objective: { type: 'DEFEAT_UNIT', unit: 'seedA', text: 'Stop the Seedbearer before it reaches the shrine!' },
    hatch: {
      mode: 'carrier', carrier: 'seedA', zone: 'SHRINE',
      spawn: { type: 'lavos_sprout', id: 'sprout', at: '@shrine', hp: 300 },
      objective: { type: 'DEFEAT_ALL', text: 'The seed has hatched! Defeat everything!' },
    },
    triggers: [
      { id: 'B1_T1', when: 'PRE_BATTLE', focus: 'seedA',
        lines: [
          RL('lucca', 'neutral', `Lucca here. The stone imp with the red glow is hauling a seed up to that shrine. Drop the imp before it gets there and the seed goes cold.`),
          RL('lucca', 'surprised', `And the shiny knight on the bridge is — Frog, is that *the* Cyrus? …Okay. Okay. Don't fight him uphill.`),
          L('frog', 'determined', `I do not mean to fight him. Only to stop him.`),
        ] },
      { id: 'B1_T2', when: 'TURN_START', args: { n: 2 }, focus: 'iselle',
        lines: [
          L('iselle', 'neutral', `Entry one. Crono, of Truce. It wants you undamaged, boy, so I'll go easy.`),
          L('frog', 'angry', `Come down and face *me*, Cyrus!`),
          L('iselle', 'sad', `Not yet, Glenn. Your guard is still too low.`),
        ] },
      { id: 'B1_T3', when: 'UNIT_ENTERS_ZONE', args: { unit: 'any_party', zone: 'BRIDGE' }, focus: 'iselle',
        lines: [L('iselle', 'angry', `Off the bridge. That's an order.`)],
        effect: [{ type: 'FREE_ACTION', unit: 'iselle', tech: 'catalogue', target: 'trigger_unit' }] },
      { id: 'B1_T4', when: 'UNIT_DEFEATED', args: { unit: 'seedA' }, focus: 'seedA',
        lines: [L('frog', 'determined', `The seed is down! Cyrus, it is over. Come down!`)],
        effect: [
          { type: 'DROP_SEED', at: 'seedA' },
          { type: 'SET_OBJECTIVE', objective: { type: 'DEFEAT_ALL' }, text: 'Defeat Cyrus or drive him off' },
        ] },
      { id: 'B1_T5', when: 'UNIT_HP_BELOW', args: { unit: 'iselle', pct: 40 }, focus: 'iselle',
        lines: [
          L('iselle', 'sad', `There. *Now* your guard is up. I knew it would be.`),
          L('iselle', 'neutral', `The age of beasts is next. The chief, Ayla. You'll follow me, Glenn. You always did. Bring the boy.`),
        ],
        effect: [
          { type: 'RIFT', at: 'iselle' },
          { type: 'DESPAWN', unit: 'iselle' },
          { type: 'CLOSE_RIFT' },
          { type: 'PLAY_MUSIC', track: 'mus_battle' },
          { type: 'SET_OBJECTIVE', objective: { type: 'DEFEAT_ALL' }, text: 'Cyrus is gone. Defeat the remaining enemies!' },
        ] },
      { id: 'B1_T6', when: 'ALLY_KO', args: { unit: 'frog' }, focus: 'crono',
        lines: [RL('lucca', 'surprised', `Frog's down! Crono, get him up — nobody solos a ghost!`)] },
      { id: 'B1_HATCH', when: 'HATCH', focus: 'frog',
        lines: [L('frog', 'angry', `Too late, it has hatched! Cut it down before it grows!`)] },
      victoryMusic('B1_T7'),
      { id: 'B1_DEFEAT', when: 'DEFEAT',
        lines: [L('frog', 'sad', `Cyrus… twice now, I have failed thee.`)] },
    ],
    rewards: { xp: 220, gold: 300, items: { tonic: 3, mid_tonic: 1 } },
  };

  B.B2 = {
    name: 'Nursery', map: 'tyrano_crater', music: 'mus_battle_boss',
    party: { crono: [6, 13], frog: [10, 13], ayla: [8, 10] },
    units: [
      { id: 'sb1', type: 'seedbearer', at: [4, 8], face: 'E', ai: 'hold', hp: 150 },
      { id: 'sb2', type: 'seedbearer', at: [12, 8], face: 'W', ai: 'hold', hp: 150 },
      { id: 'sb3', type: 'seedbearer', at: [8, 4], face: 'S', ai: 'hold', hp: 150 },
      { id: 'roll1', type: 'echo_roundillo', near: '@roll1' },
      { id: 'azala', type: 'echo_azala', near: '@roll2' },
      { id: 'iselle', type: 'iselle', at: [2, 2], face: 'S', ai: 'hold', passive: true, hp: 550, immortal: true },
    ],
    objective: { type: 'DEFEAT_TYPE', enemyType: 'seedbearer', text: 'Defeat the three Seedbearers before the seed hatches!' },
    hatch: {
      mode: 'feeders', feeders: ['sb1', 'sb2', 'sb3'], max: 5, minFeeders: 2,
      spawn: { type: 'lavos_sprout_large', id: 'sprout', at: [8, 8], hp: 600 },
      objective: { type: 'DEFEAT_ALL', text: 'The seed has hatched! Defeat everything!' },
    },
    triggers: [
      { id: 'B2_T1', when: 'PRE_BATTLE', focus: 'ayla',
        lines: [
          RL('lucca', 'neutral', `Three stone imps are feeding that seed. Drop two and it stops growing. Drop all three and it dies.`),
          RL('lucca', 'happy', `Ayla — hi, big fan — you're the fast one. And see those ledges? *Push things off the ledges.*`),
          L('ayla', 'happy', `Ayla like glasses-voice.`),
          L('ayla', 'angry', `Copy-Azala! Wait there! Ayla break eggs first!`),
        ] },
      { id: 'B2_T2', when: 'TECH_USED', args: { unit: 'ayla', tech: 'rollo_kick', knockedDown: true }, focus: 'ayla',
        lines: [L('ayla', 'happy', `Fall down go boom!`)],
        script: [['popup', 'Rollo Kick knocks the target back one tile. Knock a foe off a drop of 2 or more for bonus fall damage.']] },
      { id: 'B2_T3', when: 'TURN_START', args: { n: 2 }, focus: 'iselle',
        lines: [
          L('iselle', 'neutral', `You're breaking a roof-beam, Glenn. That seed holds the archive up. Leene is under that roof. Guardia. You.`),
          L('frog', 'angry', `I never asked to be under it!`),
          L('iselle', 'sad', `Nobody asks. I didn't.`),
        ] },
      { id: 'B2_T4', when: 'COUNT_DEFEATED', args: { enemyType: 'seedbearer', count: 2 }, focus: 'ayla',
        lines: [L('ayla', 'determined', `One left! Crono hit! Ayla hold!`)],
        effect: [{ type: 'APPLY_STATUS', unit: 'last_seedbearer', status: 'slow', turns: 3 }] },
      { id: 'B2_T5', when: 'UNIT_ENTERS_ZONE', args: { unit: 'any_party', zone: 'RIM' }, focus: 'iselle',
        lines: [L('iselle', 'determined', `Fine. In person, then.`)],
        effect: [
          { type: 'SET_AI', unit: 'iselle', ai: 'aggressive' },
          { type: 'PLAY_MUSIC', track: 'mus_battle_boss' },
        ] },
      { id: 'B2_T6', when: 'UNIT_HP_BELOW', args: { unit: 'iselle', pct: 40 }, focus: 'iselle',
        lines: [
          L('iselle', 'sad', `…You hit like someone who's never been told no.`),
          L('ayla', 'happy', `Ayla told no many times. Ayla no listen.`),
          L('iselle', 'happy', `Ha. I had a squire like that.`),
          L('iselle', 'neutral', `Twelve thousand B.C. is next. The mage. Tell Magus the archive has built him an exhibit. Tell him what it's called: *Schala.*`),
        ],
        effect: [
          { type: 'RIFT', at: 'iselle' },
          { type: 'DESPAWN', unit: 'iselle' },
          { type: 'CLOSE_RIFT' },
          { type: 'SET_FLAG', flag: 'b2_iselle_gone', value: true },
        ] },
      // If Cyrus was never driven off, he still leaves once the nest is lost
      // (2.3 and 3.1 depend on him naming Schala).
      { id: 'B2_T6B', when: 'COUNT_DEFEATED', args: { enemyType: 'seedbearer', count: 3 }, requires: '!b2_hatched', focus: 'iselle',
        script: [
          ['if', '!b2_iselle_gone', [
            ['say', 'iselle', 'neutral', `The nest is gone. I don't hold empty ground.`],
            ['say', 'iselle', 'neutral', `Twelve thousand B.C. is next. The mage. Tell Magus the archive has built him an exhibit. Tell him what it's called: *Schala.*`],
            ['sfx', 'sfx_hollow_gate'],
            ['setflag', 'b2_iselle_gone', true],
          ]],
        ],
        effect: [{ type: 'DESPAWN', unit: 'iselle' }] },
      { id: 'B2_HATCH', when: 'HATCH', focus: 'sprout',
        lines: [L('ayla', 'angry', `Egg open! Ayla smash baby before baby grow!`)],
        effect: [{ type: 'SET_FLAG', flag: 'b2_hatched', value: true }] },
      { id: 'B2_T7', when: 'UNIT_HP_BELOW', args: { unit: 'ayla', pct: 30 }, focus: 'ayla',
        lines: [
          L('ayla', 'angry', `Ayla not tired! Ayla… little tired.`),
          L('frog', 'neutral', `Then lean on me a moment.`),
        ] },
      { id: 'B2_T9', when: 'UNIT_ADJACENT', args: { a: 'ayla', b: 'azala' }, focus: 'azala',
        lines: [
          L('ayla', 'angry', `Azala smart. Azala never fight fair.`),
          L('ayla', 'determined', `Copy-Azala not smart. Copy-Azala just loud!`),
        ] },
      { id: 'B2_T10', when: 'UNIT_DEFEATED', args: { unit: 'azala' }, focus: 'ayla',
        lines: [
          L('ayla', 'sad', `Azala gone again.`),
          L('ayla', 'angry', `Last time, Azala *choose* to stay. This time nobody ask Azala. Ayla not like.`),
        ] },
      victoryMusic('B2_T8'),
      { id: 'B2_DEFEAT', when: 'DEFEAT',
        lines: [L('ayla', 'sad', `Ground… all red now.`)] },
    ],
    rewards: { xp: 150, gold: 600, items: { mid_tonic: 2, ether: 1 } },
  };

  B.B3 = {
    name: 'The Exhibit', map: 'zeal_wreck', music: 'mus_battle_boss',
    party: { crono: [6, 12], frog: [8, 12], ayla: [10, 12], magus: [8, 13] },
    units: [
      { id: 'iselle', type: 'iselle', at: [7, 2], face: 'S', ai: 'aggressive', hp: 700, immortal: true },
      { id: 'sen1', type: 'vitrine_sentinel', at: '@sentinel1', face: 'S', ai: 'sentinel', hp: 250 },
      { id: 'sen2', type: 'vitrine_sentinel', at: '@sentinel2', face: 'S', ai: 'sentinel', hp: 250 },
      { id: 'nu1', type: 'echo_nu', at: '@nu1', face: 'S', ai: 'healer', hp: 200 },
      { id: 'nu2', type: 'echo_nu', at: '@nu2', face: 'S', ai: 'healer', hp: 200 },
      { id: 'sbGuard', type: 'seedbearer', at: '@guard', face: 'S', ai: 'guard_zone', zone: 'SEED', hp: 150 },
    ],
    objective: { type: 'DEFEAT_UNIT', unit: 'iselle', text: 'Defeat Cyrus!',
      secondary: 'The seed is rooted — destroying the Seedbearer slows it.' },
    hatch: {
      mode: 'guard', guard: 'sbGuard', max: 6,
      spawn: { type: 'lavos_sprout_large', id: 'sprout', at: [8, 2], hp: 600 },
      objective: { type: 'DEFEAT_ALL', text: 'The seed has hatched! Defeat everything!' },
    },
    triggers: [
      { id: 'B3_T1', when: 'PRE_BATTLE', focus: 'sen1',
        lines: [
          RL('lucca', 'neutral', `Those gold statues are Gallery Goons. Slow, heavy, and they'll wall off the aisles. Magus can float round them over the water.`),
          RL('lucca', 'neutral', `The stone imp by the seed is feeding it. Get it before the seed roots. Also, um. Magus? Hi. Please don't blow up the radio.`),
          L('magus', 'neutral', `I'll consider it.`),
          L('magus', 'angry', `And it kept *Ozzie.* Twice. Of everything in creation.`),
          L('magus', 'neutral', `They'll heal the knight from behind someone braver. Kill them first.`),
        ] },
      { id: 'B3_T2', when: 'TURN_START', args: { n: 2 }, focus: 'iselle',
        lines: [
          L('iselle', 'neutral', `Entry two, Glenn. Entry nine, Ayla. Entry one, Crono. And you. Janus, prince of Zeal. It files you under *lost property.*`),
          L('magus', 'angry', `Take me off it.`),
        ] },
      { id: 'B3_T3', when: 'DUAL_TECH_USED', args: { tech: 'shadow_cyclone' }, focus: 'magus',
        lines: [
          L('frog', 'surprised', `Thy shadow and Crono's blade make a fine pair.`),
          L('magus', 'neutral', `Don't make it a friendship.`),
        ] },
      { id: 'B3_T4', when: 'UNIT_HP_BELOW', args: { unit: 'iselle', pct: 60 }, focus: 'iselle',
        lines: [
          L('iselle', 'angry', `Preserve.`),
          L('iselle', 'determined', `I don't want to hurt you, Glenn. It turns out I don't have to want to.`),
        ],
        effect: [
          { type: 'APPLY_STATUS', unit: 'iselle', status: 'stasis', turns: 1 },
          { type: 'SPAWN', unit: 'echo_nu', id: 'nu3', at: '@nu_spawn', face: 'S', ai: 'healer', hp: 200 },
        ] },
      { id: 'B3_T5', when: 'UNIT_ADJACENT', args: { a: 'magus', b: 'iselle' }, focus: 'magus',
        lines: [
          L('magus', 'neutral', `Last time we stood this close, I killed you.`),
          L('iselle', 'sad', `I remember. It's most of what I have.`),
          L('magus', 'neutral', `Then swing for your own reasons, knight. Not the Curator's.`),
        ],
        effect: [{ type: 'SWAP_BARKS', unit: 'iselle', set: 'iselle_broken' }] },
      { id: 'B3_T6', when: 'UNIT_HP_BELOW', args: { unit: 'iselle', pct: 25 }, focus: 'iselle',
        script: [
          ['music', 'mus_magus_theme'],
          ['anim', 'iselle', 'kneel'],
          ['sfx', 'sfx_glass_shatter'],
          ['vfx', 'glass_shatter', '@case'],
          ['camera', '@case', 600],
          ['wait', 800],
          say('iselle', 'broken', `It's hollow.`),
          say('iselle', 'broken', `There's nothing in it. A shell with her face on. It told me she was *preserved.*`),
          say('magus', 'neutral', `What did you think you were?`),
          ['wait', 900],
          say('iselle', 'sad', `…Kill the stone man by the seed. The seed dies with it. I won't stop you.`),
          ['wait', 600],
          say('iselle', 'sad', `I can't help you, either. Glenn, I —`),
        ],
        effect: [
          { type: 'SET_TEAM', unit: 'iselle', team: 2 },
          { type: 'SET_AI', unit: 'iselle', ai: 'passive' },
          { type: 'SET_OBJECTIVE', objective: { type: 'DEFEAT_ALL' }, text: 'Defeat the remaining enemies.' },
        ] },
      { id: 'B3_T7', when: 'UNIT_DEFEATED', args: { unit: 'sbGuard' }, focus: 'sbGuard',
        lines: [
          L('ayla', 'determined', `Three eggs. No more eggs?`),
          RL('lucca', 'surprised', `That was the last one. The grey door should be shutting — no. No, no. It's not shutting. It's *opening.*`),
        ] },
      { id: 'B3_HATCH', when: 'HATCH', focus: 'sprout',
        lines: [L('magus', 'angry', `It's hatched. Kill it before it remembers what it's for.`)] },
      victoryMusic('B3_T8'),
      { id: 'B3_DEFEAT', when: 'DEFEAT',
        lines: [L('magus', 'angry', `Pathetic. …Get up. I refuse to die in *her* hall.`)] },
    ],
    rewards: { xp: 120, gold: 900, items: { mid_tonic: 2, ether: 2, revive: 1 } },
  };

  B.B4A = {
    name: 'The Tour', map: 'hollow_atrium', music: 'mus_battle',
    party: { crono: [8, 8], frog: [7, 8], ayla: [9, 8], magus: [8, 9] },
    guests: [{ type: 'iselle_ally', id: 'iselle', at: [8, 7], ai: 'aggressive' }],
    units: [
      { id: 'sen1', type: 'vitrine_sentinel', at: '@sentinel1', ai: 'sentinel', hp: 300 },
      { id: 'sen2', type: 'vitrine_sentinel', at: '@sentinel2', ai: 'sentinel', hp: 300 },
      { id: 'sen3', type: 'vitrine_sentinel', at: '@sentinel3', ai: 'sentinel', hp: 300 },
      { id: 'sen4', type: 'vitrine_sentinel', at: '@sentinel4', ai: 'sentinel', hp: 300 },
      { id: 'tyrano', type: 'echo_tyrano', at: '@tyrano', face: 'S', hp: 750 },
      { id: 'imp1', type: 'echo_imp', near: '@imp1' },
      { id: 'imp2', type: 'echo_imp', near: '@imp2' },
      { id: 'imp3', type: 'echo_imp', near: '@imp3' },
      { id: 'imp4', type: 'echo_imp', near: '@imp4' },
    ],
    objective: { type: 'DEFEAT_UNIT', unit: 'tyrano', text: 'Defeat the Echo Avian Rex!' },
    triggers: [
      { id: 'B4A_T1', when: 'PRE_BATTLE', focus: 'tyrano',
        lines: [
          L('ayla', 'angry', `BIG BIRD-LIZARD! Ayla know this kind! Ayla fight them since Ayla small!`),
          L('iselle', 'neutral', `It's a copy. It has read every fight your people ever had with its kind. Break it and the tour stops.`),
          L('ayla', 'happy', `Then it read that Ayla win.`),
        ] },
      { id: 'B4A_T2', when: 'UNIT_HP_BELOW', args: { unit: 'tyrano', pct: 50 }, focus: 'tyrano',
        lines: [VL(`ENTRY 9 PERFORMS AS RECORDED.`)],
        effect: [
          { type: 'SPAWN', unit: 'vitrine_sentinel', id: 'sen5', near: '@arch_e', ai: 'sentinel', hp: 300 },
          { type: 'SPAWN', unit: 'vitrine_sentinel', id: 'sen6', near: '@arch_w', ai: 'sentinel', hp: 300 },
        ] },
      { id: 'B4A_T3', when: 'ALLY_KO', args: { unit: 'iselle' }, focus: 'iselle',
        lines: [
          L('iselle', 'sad', `…Go on. I'm already logged. It doesn't count.`),
          L('magus', 'angry', `It counts.`),
        ] },
      victoryMusic('B4A_T4'),
      { id: 'B4A_DEFEAT', when: 'DEFEAT',
        lines: [VL(`THE TOUR HAS CONCLUDED. PLEASE REMAIN STILL.`)] },
    ],
    rewards: { xp: 70, gold: 1200, items: { ether: 2, revive: 1 } },
  };

  B.B4B = {
    name: 'Separation', map: 'hollow_archive', music: 'mus_battle_boss',
    party: { crono: [3, 8], ayla: [3, 10], frog: [13, 8], magus: [13, 10] },
    guests: [{ type: 'iselle_ally', id: 'iselle', at: [13, 12], ai: 'protect', protect: 'frog',
      hpPctIf: { flag: 'iselle_ko', pct: 50 } }],
    units: [
      { id: 'sbW1', type: 'seedbearer', at: '@sb_w1', ai: 'seek_zone', zone: 'LEDGER' },
      { id: 'sbW2', type: 'seedbearer', at: '@sb_w2', ai: 'seek_zone', zone: 'LEDGER' },
      { id: 'sbE1', type: 'seedbearer', at: '@sb_e1', ai: 'seek_zone', zone: 'LEDGER' },
      { id: 'sbE2', type: 'seedbearer', at: '@sb_e2', ai: 'seek_zone', zone: 'LEDGER' },
      { id: 'henchW1', type: 'echo_hench', near: '@hench_w1' },
      { id: 'henchW2', type: 'echo_hench', near: '@hench_w2' },
      { id: 'henchE1', type: 'echo_hench', near: '@hench_e1' },
      { id: 'henchE2', type: 'echo_hench', near: '@hench_e2' },
      { id: 'nuW', type: 'echo_nu', near: '@nu_w', ai: 'healer' },
      { id: 'nuE', type: 'echo_nu', near: '@nu_e', ai: 'healer' },
    ],
    objective: { type: 'DEFEAT_ALL', text: 'Defeat all enemies!',
      secondary: 'Stop the Seedbearers from reaching the Ledger.' },
    triggers: [
      { id: 'B4B_T1', when: 'PRE_BATTLE', focus: 'crono',
        lines: [RL('lucca', 'neutral', `I'm losing you — this place eats signal. Magus can cross the gap. Everyone else, hold your side. Crono — don't be a hero.`)],
        script: [
          ['sfx', 'sfx_scanline'],
          radio('lucca', 'neutral', `…okay, be a *little* —`),
          ['sfx', 'sfx_scanline'],
          say('iselle', 'determined', `Those stone men carry catalogue tablets. If two reach the Ledger up top, it files every one of us. Stop them.`),
          say('iselle', 'neutral', `Glenn. I'm on your side of it. Like old times.`),
          say('frog', 'happy', `Then try to keep up.`),
        ] },
      { id: 'B4B_T2', when: 'UNIT_ENTERS_ZONE', args: { unit: 'magus', zone: 'WEST' }, focus: 'magus',
        lines: [
          L('ayla', 'surprised', `Blue-hair come to Ayla's side?`),
          L('magus', 'neutral', `The frog and his knight were reminiscing. I'd rather be hit.`),
        ] },
      { id: 'B4B_T3', when: 'DUAL_TECH_USED', args: { tech: 'beast_toss' }, focus: 'ayla',
        lines: [
          L('ayla', 'happy', `Ayla throw Blue-hair's boom! Good boom!`),
          L('magus', 'angry', `You threw *me.*`),
          L('ayla', 'happy', `Little bit.`),
        ] },
      { id: 'B4B_T4', when: 'ANY_ENEMY_ENTERS_ZONE', args: { zone: 'LEDGER', count: 1 },
        lines: [
          VL(`ONE OF TWO.`),
          L('iselle', 'angry', `Stop the second one!`),
        ] },
      { id: 'B4B_T5', when: 'ANY_ENEMY_ENTERS_ZONE', args: { zone: 'LEDGER', count: 2 },
        lines: [VL(`FILED.`)],
        effect: [
          { type: 'SHAKE' },
          { type: 'FILL_TILES', zone: 'CHASM', terrain: 'k', h: 0 },
          { type: 'APPLY_STATUS', unit: 'all_party', status: 'catalogued', turns: 'permanent' },
        ] },
      { id: 'B4B_T6', when: 'COUNT_DEFEATED', args: { enemyType: 'seedbearer', count: 4 },
        lines: [L('iselle', 'determined', `That's all its hands. Now it has to use its own.`)],
        effect: [
          { type: 'SHAKE' },
          { type: 'FILL_TILES', zone: 'CHASM', terrain: 'k', h: 0 },
        ] },
      victoryMusic('B4B_T7'),
      { id: 'B4B_DEFEAT', when: 'DEFEAT',
        lines: [VL(`SEPARATION WAS EFFICIENT.`)] },
    ],
    rewards: { xp: 70, gold: 1400, items: { mid_tonic: 3, shelter: 1 } },
  };

  B.B5 = {
    name: 'Entry 0', map: 'hollow_core', music: 'mus_curator', noFanfare: true,
    party: { crono: [7, 12], frog: [6, 12], ayla: [8, 12], magus: [9, 12] },
    units: [
      { id: 'curator', type: 'curator', at: '@curator', face: 'S', ai: 'curator', hp: 2000, immortal: true },
    ],
    placards: { zones: ['PED_N', 'PED_E', 'PED_S', 'PED_W'], damage: 150, target: 'curator' },
    objective: { type: 'DEFEAT_UNIT', unit: 'curator', text: 'Shatter the four placards.' },
    triggers: [
      { id: 'B5_T1', when: 'PRE_BATTLE', focus: 'curator',
        lines: [RL('lucca', 'determined', `Crono — the pedestals! It built its own weak points. Museums always do! Stand on one and hit it with a tech!`)],
        script: [['sfx', 'sfx_scanline']] },
      { id: 'B5_T2', when: 'PLACARD_SHATTERED', args: { count: 1 }, focus: 'curator',
        lines: [
          VL(`THAT WAS A LABEL. LABELS ARE NOT LOAD-BEARING.`),
          L('frog', 'determined', `Then why did it hurt thee?`),
        ] },
      { id: 'B5_T3', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 75 }, focus: 'frog',
        lines: [
          VL(`ENTRY 2. GLENN. YOU KEPT ONE DAY FOR TEN YEARS. THEN I KEPT THE MAN. WE ARE COLLEAGUES.`),
          L('frog', 'sad', `Aye. I was like thee, once.`),
          L('frog', 'angry', `Then I put it down. Try it.`),
        ] },
      { id: 'B5_T4', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 50 }, focus: 'ayla',
        lines: [
          VL(`ENTRY 9. AYLA. YOUR PEOPLE WRITE NOTHING DOWN. IN THREE GENERATIONS NO ONE WILL KNOW YOUR NAME. I WOULD. I WOULD KEEP IT PERFECTLY.`),
          L('ayla', 'angry', `Ayla not want *kept!* Ayla want *told!* By fire! LOUD!`),
        ] },
      { id: 'B5_T5', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 25 }, focus: 'crono',
        lines: [VL(`ENTRY 1. CRONO. YOU DIED ONCE AND WERE RETRIEVED. YOU ARE ALREADY A RESTORED ITEM. YOU BELONG HERE.`)],
        script: [
          ['choice', ['Shake head', 'Point sword at it'], [
            [['anim', 'crono', 'shake_head']],
            [['anim', 'crono', 'point']],
          ], 'c_restored'],
          say('magus', 'neutral', `He was retrieved by people who wanted him *back,* machine. Not by a shelf.`),
        ] },
      { id: 'B5_T6', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 0 }, focus: 'curator',
        script: [
          ['flash'],
          ['shake', 1000],
          ['sfx', 'sfx_seed_pulse'],
          ['sfx', 'sfx_seed_pulse'],
          ['sfx', 'sfx_seed_pulse'],
          ['sfx', 'sfx_core_scream'],
          ['shake', 600],
          V(`THE COLLECTION… REQUIRES… A HOST. I WILL BE THE HOST. I WILL BE THE SEED.`),
        ],
        effect: [
          { type: 'FLASH' },
          { type: 'TRANSFORM', unit: 'curator', into: 'curator_core', immortal: false, ai: 'curator_core', hp: 2500 },
          { type: 'HEAL', unit: 'curator', pct: 100 },
          { type: 'PLAY_MUSIC', track: 'mus_curator_core' },
          { type: 'SHAKE' },
          { type: 'VOID_TILES', zone: 'RING_OUTER' },
          { type: 'SPAWN', unit: 'lavos_sprout', id: 'sprout_e', at: '@sprout_e', ai: 'sprout', hp: 450 },
          { type: 'SPAWN', unit: 'lavos_sprout', id: 'sprout_w', at: '@sprout_w', ai: 'sprout', hp: 450 },
          { type: 'SET_OBJECTIVE', objective: { type: 'DEFEAT_UNIT', unit: 'curator' }, text: 'Destroy the Core Exhibit!' },
          { type: 'SET_FLAG', flag: 'b5_phase2', value: true },
        ] },
      // ---- Phase 2 ("The Core Exhibit") ----
      { id: 'B5_T7', when: 'TURN_START', args: { n: 1, phase: 2 }, requires: 'b5_phase2', focus: 'magus',
        lines: [
          L('magus', 'determined', `Its hide turns magic now. Steel, then. And I have one thing left to lend steel.`),
          L('iselle', 'determined', `Glenn! Magus! You said it once!`),
          L('magus', 'angry', `…TOGETHER.`),
          L('ayla', 'determined', `Ayla guard backs. You three — GO!`),
        ],
        effect: [{ type: 'UNLOCK_TECH', tech: 'eclipse_blade' }] },
      { id: 'B5_T8', when: 'TECH_USED', args: { unit: 'any', tech: 'eclipse_blade' }, focus: 'curator',
        lines: [
          VL(`THAT… IS NOT… IN THE RECORD.`),
          L('frog', 'determined', `No. 'Tis new.`),
        ] },
      { id: 'B5_T9', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 50 }, requires: 'b5_phase2', focus: 'ayla',
        lines: [
          L('ayla', 'happy', `Big weird thing getting SMALL!`),
          VL(`ENTRY 9 IS… INCORRECT.`),
        ] },
      { id: 'B5_T10', when: 'ALLY_KO', args: { unit: 'any' }, requires: 'b5_phase2', lineMode: 'first_alive',
        lines: [
          L('frog', 'determined', `Stand up! Stand up *straight!*`),
          L('ayla', 'angry', `Get UP!`),
          L('magus', 'angry', `Don't you *dare* become an exhibit.`),
        ] },
      { id: 'B5_T11', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 10 }, requires: 'b5_phase2', focus: 'curator',
        lines: [
          VL(`IF I END… THE ARCHIVE ENDS. ENTRY 0-A ENDS. WARDEN…`),
          L('iselle', 'sad', `I ended on Denadoro, ten years ago. You just wouldn't file it.`),
          L('iselle', 'determined', `File it.`),
        ] },
      { id: 'B5_T12', when: 'VICTORY',
        effect: [{ type: 'PLAY_MUSIC', track: null }],
        script: [['music', null], ['wait', 2000]] },
      { id: 'B5_DEFEAT', when: 'DEFEAT',
        lines: [VL(`ACQUIRED.`)] },
    ],
  };

  B.OPT1 = {
    name: 'Spekkio', map: 'spekkio_room', music: 'mus_battle', repeatable: true,
    party: { crono: '@crono', frog: '@frog', ayla: '@ayla', magus: '@magus' },
    units: [
      { id: 'spekkio', type: 'spekkio', at: '@spekkio', face: 'S', scale: 'party' },
    ],
    objective: { type: 'DEFEAT_ALL', text: 'Spar with Spekkio!' },
    triggers: [
      { id: 'OPT1_T1', when: 'PRE_BATTLE', focus: 'spekkio',
        lines: [L('spekkio', 'happy', `Show me the shape of your strength! I'll show you the shape of a frog!`)] },
      { id: 'OPT1_T2', when: 'VICTORY', focus: 'spekkio',
        lines: [L('spekkio', 'happy', `Not bad! Not bad! …I was going easy.`)],
        effect: [{ type: 'PLAY_MUSIC', track: 'mus_victory' }] },
    ],
    rewards: { xp: 40, gold: 100 },
  };

  // =====================================================================
  // CREDITS (§5.3 stills + roles; §7 tablet variation)
  // =====================================================================
  CT.CREDITS = {
    music: 'mus_credits',
    stills: [
      { map: 'leene_square', theme: 'night',
        actors: [
          { id: 'crono', at: '@crono', face: 'S' }, { id: 'marle', at: '@marle', face: 'W' },
          { id: 'lucca', at: '@lucca', face: 'W' }, { id: 'robo', at: '@robo', face: 'S' },
          { id: 'fair1', sprite: 'fairgoer', at: '@fair1', face: 'E', anim: 'spin' },
          { id: 'fair2', sprite: 'fairgoer_b', at: '@fair2', face: 'W', anim: 'spin' },
          { id: 'fair3', sprite: 'fairgoer_c', at: '@fair3', face: 'S' },
          { id: 'fair4', sprite: 'fairgoer_d', at: '@fair4', face: 'N' },
        ],
        caption: 'The Millennial Fair, lanterns lit again.' },
      { map: 'denadoro', theme: 'day',
        actors: [{ id: 'frog', at: '@cairn', face: 'W' }],
        caption: 'Denadoro. Only a mountain.',
        variants: [
          { if: 'flowers_laid', decor: [{ x: 5, y: 13, kind: 'flowers', variant: 1 }], caption: 'Denadoro. Only a mountain. Somebody keeps leaving flowers.' },
        ] },
      { map: 'ioka', theme: 'night',
        actors: [
          { id: 'ayla', at: '@bonfire_side', face: 'S', anim: 'point' },
          { id: 'kino', at: '@kino', face: 'N', anim: 'kneel' },
          { id: 'vill1', sprite: 'villager_ioka', at: '@vill1', face: 'N' },
          { id: 'vill2', sprite: 'villager_ioka_b', at: '@vill2', face: 'N' },
          { id: 'vill3', sprite: 'villager_ioka_c', at: '@vill3', face: 'N' },
        ],
        caption: 'Ayla tells it loud. Kino sleeps through the good part.' },
      { map: 'last_village', theme: 'dawn',
        actors: [
          { id: 'elder', at: '@elder', face: 'S' },
          { id: 'vill1', sprite: 'villager_last', at: '@vill1', face: 'E' },
          { id: 'vill2', sprite: 'villager_last_b', at: '@vill2', face: 'S' },
          { id: 'vill3', sprite: 'villager_last_c', at: '@vill3', face: 'W' },
        ],
        caption: 'The Last Village, at dawn.' },
      { map: 'last_village', theme: 'snow',
        actors: [{ id: 'magus', at: '@magus', face: 'N' }],
        vfx: [['sparkle', '@magus']],
        caption: 'Schala, in a pocket. Still lit.',
        variants: [
          { if: 'seed_hatched', vfx: [], caption: 'Schala, in a pocket. Dark, but carried.' },
          { if: 'cat_given', caption: 'Schala, in a pocket. Still lit. Next to a wooden cat.' },
        ] },
      { map: 'guardia_throne', theme: 'castle',
        actors: [
          { id: 'leene', at: '@leene', face: 'S' },
          { id: 'king', at: '@king', face: 'S' },
          { id: 'frog', at: '@party', face: 'N', anim: 'kneel' },
          { id: 'guard1', sprite: 'guard', at: '@guard1', face: 'S' },
          { id: 'guard2', sprite: 'guard', at: '@guard2', face: 'S' },
        ],
        caption: 'Sir Glenn, home.' },
      { map: 'leene_square', theme: 'dawn',
        actors: [
          { id: 'crono', at: '@bell', face: 'N' },
          { id: 'marle', at: '@crono', face: 'N' },
        ],
        caption: `Under Leene's Bell.` },
      { map: 'hollow_core', theme: 'void',
        actors: [],
        decor: [{ x: 8, y: 7, kind: 'fern', variant: 0 }],
        caption: 'Nothing. And then, something green.' },
    ],
    roles: [
      ['CHRONO TACTICS: THE HOLLOW FUTURE', ['A non-commercial fan sequel to Chrono Trigger']],
      ['Story & Design', ['"The Hollow Future" — original fan script and game bible']],
      ['Game Engine & Tactics Rules', ['The Chrono Tactics fan project']],
      ['Maps, Pixel Art & Portraits', ['Character, enemy and portrait sprites from the original Chrono Trigger sprite sheets supplied by the player', 'Maps, effects and props: the Chrono Tactics fan project']],
      ['Music & Sound', ['Chrono Trigger music by Yasunori Mitsuda, with Nobuo Uematsu and Noriko Matsueda', 'Arranged for this game from fan MIDI sequences (VGMusic); credits in js/music_ct.js', 'Sound effects synthesized for this project']],
      ['Cast', ['Crono', 'Frog (Glenn)', 'Ayla', 'Magus (Janus)', 'Sir Cyrus, the Warden', 'The Curator (VESPER)',
        'Marle', 'Lucca', 'Robo', 'King Guardia XXI', 'Queen Leene', 'Kino', 'The Elder', 'Gaspar', 'Spekkio',
        'and the echoes of Azala, Ozzie, Flea and Slash']],
      ['Special Thanks', ['Everyone who ever rang the bell in Leene Square', 'You, for playing']],
      ['Legal', ['Chrono Trigger © Square Enix. This is a non-commercial fan work.',
        'Character sprites, portraits and music come from Chrono Trigger; maps, effects and code are original to this project.']],
    ],
  };

  CT.SCENES = S;
  CT.BATTLES = B;
  CT.STORY_START = '0.2';
})();
