// story.js — content module: CT.SCENES, CT.BATTLES, CT.CREDITS, CT.STORY_START.
// Transcribed from docs/SCRIPT.md against the contract in docs/ENGINE_SPEC.md
// (§6 markers/zones, §7 scene commands, §8 battles, §9 ids).
//
// Conventions / small extensions the engine should honour (all optional —
// ignoring them degrades gracefully):
//  * Several actors may be placed or walked to the same marker (e.g. the
//    party arriving together). A spawn on an occupied tile should use the
//    nearest free tile; a `move` onto an occupied tile should stop on the
//    nearest free tile of the path ("walk up to").
//  * Dialogue keeps the script's *emphasis* asterisks; render them as
//    emphasis (or strip them).
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
//  * Credits still `variants: [{if, caption, actors, vfx}]` — first variant
//    whose `if` holds replaces the base still's fields.
(function () {
  const CT = (window.CT = window.CT || {});

  // ---------------------------------------------------------------- helpers
  const say = (who, emo, text, opts) => (opts ? ['say', who, emo, text, opts] : ['say', who, emo, text]);
  const radio = (who, emo, text) => ['say', who, emo, text, { radio: true }];
  const V = (text) => ['say', 'curator', 'neutral', text];          // VESPER box
  const N = (text) => ['say', 'narrator', 'neutral', text];
  const L = (who, emo, text, opts) => (opts ? [who, emo, text, opts] : [who, emo, text]);
  const RL = (who, emo, text) => [who, emo, text, { radio: true }];
  const VL = (text) => ['curator', 'neutral', text];
  const victoryMusic = (id) => ({ id, when: 'VICTORY', effect: [{ type: 'PLAY_MUSIC', track: 'mus_victory' }] });

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
  // =====================================================================
  S['0.2'] = {
    title: 'Leene Square, night',
    map: 'leene_square', theme: 'night', music: 'mus_fair_night',
    actors: [
      { id: 'crono', at: '@crono', face: 'N' },
      { id: 'lucca', at: '@lucca', face: 'W' },
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
      ['anim', 'fair2', 'spin'],
      ['anim', 'fair3', 'spin'],
      ['emote', 'fair1', '♪'],
      ['emote', 'fair4', '♪'],
      ['wait', 600],
      // Marle runs up.
      ['spawn', { id: 'marle', at: '@gate', face: 'S' }],
      ['move', 'marle', '@marle', { run: true }],
      ['face', 'marle', 'crono'],
      ['face', 'crono', 'marle'],
      say('marle', 'happy', `There you are! Everyone's asking where the hero went. Lucca says you owe her a dance. She's lying, she can't dance.`),
      ['face', 'lucca', 'marle'],
      say('lucca', 'angry', `I can dance! I choose not to.`),
      say('marle', 'happy', `See?`),
      ['choice', ['Dance with Marle', 'Look at the bell'], [
        [
          ['anim', 'crono', 'spin'],
          ['anim', 'marle', 'spin'],
          ['wait', 2000],
          say('lucca', 'happy', `Disgusting. Carry on.`),
        ],
        [
          ['move', 'crono', '@bell'],
          ['face', 'crono', 'N'],
          ['anim', 'crono', 'point'],
          ['sfx', 'sfx_leene_bell'],
          ['wait', 800],
          ['face', 'marle', 'crono'],
          say('marle', 'sad', `It rang when we first met.`),
          say('marle', 'happy', `I think it likes you.`),
        ],
      ], 'c_fair'],
      // Frog approaches in his cloak; fairgoers give him a wide berth.
      ['spawn', { id: 'frog', at: '@gate', face: 'S' }],
      ['move', 'frog', '@frog'],
      ['emote', 'fair2', '!'],
      ['emote', 'fair3', '...'],
      ['face', 'crono', 'frog'],
      ['face', 'marle', 'frog'],
      say('frog', 'neutral', `A fine night. Too fine. Mine ears ring with quiet, and I mistrust it.`),
      say('marle', 'happy', `Frog! I thought you went back to 600!`),
      say('frog', 'neutral', `The Gate to mine own era… would not open. I stood before it an hour like a fool. Then I came to find thee.`),
      ['face', 'lucca', 'frog'],
      say('lucca', 'surprised', `Wouldn't open? That's not — Gates don't just close. Not since Lavos —`),
      // The rift.
      ['sfx', 'sfx_hollow_gate'],
      ['music', 'mus_rift'],
      ['flash'],
      ['shake', 400],
      ['vfx', 'time_rift', '@rift'],
      ['camera', '@rift', 600],
      ['emote', 'fair1', '!'],
      ['emote', 'fair2', '!'],
      ['anim', 'fair1', 'run_off'],
      ['anim', 'fair2', 'run_off'],
      ['anim', 'fair3', 'run_off'],
      ['anim', 'fair4', 'run_off'],
      ['despawn', 'fair1'], ['despawn', 'fair2'], ['despawn', 'fair3'], ['despawn', 'fair4'],
      ['sfx', 'sfx_scanline'],
      radio('robo', 'neutral', `Crono. Lucca. This is Robo, transmitting from 2300 A.D. — or what remains of it. Something is… reading the Gate network. The readings are not from any year I know. Please —`),
      ['sfx', 'sfx_scanline'],
      ['wait', 500],
      // Echoes crawl out of the rift.
      ['spawn', { id: 'imp1', sprite: 'echo_imp', at: '@rift', face: 'S' }],
      ['move', 'imp1', [4, 2]],
      ['spawn', { id: 'imp2', sprite: 'echo_imp', at: '@rift', face: 'S' }],
      ['move', 'imp2', [6, 2]],
      ['spawn', { id: 'hench', sprite: 'echo_hench', at: '@rift', face: 'S' }],
      ['move', 'hench', [5, 3]],
      ['camera', 'frog', 500],
      say('frog', 'determined', `Monsters — yet not. They wear the shape of things I have slain. Crono! Draw!`),
      ['anim', 'crono', 'draw_sword'],
      say('marle', 'surprised', `I'll get the guards clear of the square. Lucca, the Epoch!`),
      say('lucca', 'determined', `On it. Don't die, you two, I'd have to plan the funeral.`),
      ['anim', 'marle', 'run_off'],
      ['anim', 'lucca', 'run_off'],
      ['despawn', 'marle'],
      ['despawn', 'lucca'],
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
    ],
    script: [
      ['vfx', 'time_rift', '@rift'],
      ['camera', '@rift', 0],
      ['wait', 800],
      // Lucca returns with the Epoch hovering behind her.
      ['sfx', 'sfx_epoch_fly'],
      ['spawn', { id: 'epoch', sprite: 'epoch', at: '@epoch', prop: true }],
      ['spawn', { id: 'lucca', at: '@gate', face: 'S' }],
      ['move', 'lucca', '@lucca'],
      ['face', 'lucca', 'crono'],
      say('lucca', 'determined', `I ran a scan through the rift before it closes. The other side isn't a year. It's a *nothing*. A timeline that was deleted and didn't take the hint.`),
      say('frog', 'neutral', `Speak plainly, Lucca.`),
      say('lucca', 'neutral', `When we killed Lavos, the ruined future — Robo's future — stopped ever having happened. Except something in it survived the deletion. And it just opened a door into our fair.`),
      say('marle', 'sad', `So it's not over.`),
      say('lucca', 'neutral', `It's over. This is the thing that comes *after* over.`),
      // The rift spits out a seed before closing.
      ['camera', '@rift', 500],
      ['shake', 300],
      ['spawn', { id: 'seed', sprite: 'lavos_seed', at: '@rift', prop: true }],
      ['sfx', 'sfx_seed_pulse'],
      ['close_rift', '@rift'],
      ['emote', 'crono', '!'],
      ['emote', 'frog', '!'],
      ['emote', 'marle', '!'],
      ['emote', 'lucca', '!'],
      ['sfx', 'sfx_seed_pulse'],
      say('frog', 'angry', `I know that light. It is *its* light.`),
      say('lucca', 'surprised', `A seed. A Lavos seed. Oh, no. No no no. If these are being planted in other eras —`),
      ['face', 'marle', 'crono'],
      say('marle', 'determined', `Then somebody has to pull them up. Crono. Go with Frog. Find Ayla, find — ugh — find Magus. You'll need everyone who can hit hard and doesn't need a lab.`),
      say('lucca', 'happy', `Rude. Accurate. I'll ride shotgun on the radio — the Epoch can drop you at the End of Time, Gaspar will know which era's bleeding first.`),
      ['choice', ['Nod', 'Nod harder'], [
        [['anim', 'crono', 'nod']],
        [['anim', 'crono', 'nod'], ['anim', 'crono', 'nod'], ['anim', 'crono', 'jump']],
      ], 'c_nod'],
      ['emote', 'marle', '♪'],
      say('marle', 'happy', `Come back with a story. And with all your limbs.`),
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
      { id: 'spekkio', at: '@spekkio', face: 'S' },
    ],
    script: [
      ['fade', 'in', 800],
      ['camera', '@door_grey', 1400],
      ['sfx', 'sfx_hollow_gate'],
      ['wait', 800],
      ['camera', 'gaspar', 900],
      ['move', 'crono', '@lamppost'],
      ['face', 'crono', 'gaspar'],
      ['face', 'frog', 'gaspar'],
      say('gaspar', 'neutral', `Ah. The boy who wouldn't stay dead. And the knight who wouldn't stay a frog. You've noticed the new door, then.`),
      say('frog', 'neutral', `It hath the look of sickness.`),
      say('gaspar', 'sad', `It leads to a future that should not be. I cannot open it, and I would not if I could. Whatever lives there has been reaching *backward* — into 600, into the age of the reptites, into the fall of Zeal. Three seeds, three eras. One in each. Pull them up before they take root, and the door may weaken.`),
      say('frog', 'determined', `Six hundred first. 'Tis mine home.`),
      say('gaspar', 'neutral', `It is also the first to bleed. Go. And boy —`),
      ['face', 'gaspar', 'crono'],
      say('gaspar', 'neutral', `the one who guards that door wears a young girl's face. Do not mistake the face for the thing.`),
      ['setflag', 'ch1_open', true],
      ['setflag', 'progress', 1],
      ['sfx', 'sfx_gate_open'],
      ['vfx', 'sparkle', '@door_600'],
      ['camera', '@door_600', 800],
      ['popup', `The door to 600 A.D. is lit. The Nu runs a shop, and Spekkio's door is open for sparring.`],
      ['fade', 'out', 400],
      ['goto', 'eot'],
    ],
  };

  // =====================================================================
  // END OF TIME — reusable hub
  // =====================================================================
  const gasparTalk = [
    ['if', { flag: 'progress', eq: 1 }, [
      say('gaspar', 'neutral', `Zzz… hm? Still here? Six hundred A.D. is bleeding, and knights make poor patients. Go.`),
      say('gaspar', 'neutral', `And don't lean on the grey door. It leans back.`),
    ]],
    ['if', { flag: 'progress', eq: 2 }, [
      say('gaspar', 'neutral', `The age of beasts. Sixty-five million years before anyone thought to write anything down. Nothing there to catalogue… yet.`),
      say('gaspar', 'happy', `Mind the chief. She hugs like a landslide.`),
    ]],
    ['if', { flag: 'progress', eq: 3 }, [
      say('gaspar', 'neutral', `Twelve thousand B.C. Snow, and a sea where a kingdom used to float.`),
      say('gaspar', 'sad', `The mage is already there. He always gets there first, and then pretends he didn't.`),
    ]],
    ['if', { flag: 'progress', eq: 4 }, [
      say('gaspar', 'neutral', `The grey door is open. I won't tell you not to go. I'd only be wasting an old man's breath.`),
      say('gaspar', 'sad', `Time doesn't heal, boy. It only keeps going. That's the kindness in it.`),
    ]],
  ];

  const doorLocked = {
    '600': (p) => (p > 1
      ? [N(`The door to 600 A.D. is quiet now. Its seed has been pulled.`)]
      : [N(`The door is dark.`)]),
    '65m': (p) => (p > 2
      ? [N(`The door to 65,000,000 B.C. is quiet now. Its seed has been pulled.`)]
      : [N(`The door to 65,000,000 B.C. is dark. Gaspar's lamp hasn't reached it yet.`)]),
    '12k': (p) => (p > 3
      ? [N(`The door to 12,000 B.C. is quiet now. Its seed has been pulled.`)]
      : [N(`The door to 12,000 B.C. is dark. Gaspar's lamp hasn't reached it yet.`)]),
    grey: () => [
      ['sfx', 'sfx_hollow_gate'],
      N(`The grey door hums with red static. It will not open.`),
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
      { id: 'nu', talk: [say('nu', 'happy', `Nu! Nu nu. …Nu?`), ['shop', 'end_of_time']] },
      { id: 'spekkio', talk: [
        say('spekkio', 'happy', `Heya! Master of War, at your service. Wanna spar? Step through my door!`),
        say('spekkio', 'neutral', `No hard feelings, no permanent damage. Mostly.`),
      ] },
    ];
    if (p === 4) {
      npcs.push({ id: 'iselle', talk: [
        say('iselle', 'neutral', `Your old man sleeps standing up. The Curator would have loved him. Entry… no. I'm done numbering people.`),
        say('iselle', 'determined', `When you're ready: the grey door. I'll walk in front. I know the halls.`),
      ] });
    }
    return ['field', {
      leader: 'crono',
      hint: HUB_HINTS[p],
      npcs,
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
      { id: 'spekkio', at: '@spekkio', face: 'S' },
    ],
    script: [
      ['if', { flag: 'progress', eq: 4 }, [
        ['spawn', { id: 'iselle', at: '@door_grey', face: 'S' }],
      ]],
      ['fade', 'in', 500],
      // Between-chapter lines (once each, on arrival).
      ['if', { flag: 'gaspar_after', eq: 1 }, [
        ['sfx', 'sfx_hollow_gate'],
        ['camera', '@door_grey', 700],
        ['wait', 400],
        ['camera', 'gaspar', 600],
        say('gaspar', 'neutral', `One up. The grey door… flickered. She said "the age of beasts." Ayla will not need convincing — she will need *restraining*.`),
        ['sfx', 'sfx_gate_open'],
        ['vfx', 'sparkle', '@door_65m'],
        ['setflag', 'gaspar_after', 0],
      ]],
      ['if', { flag: 'gaspar_after', eq: 2 }, [
        ['sfx', 'sfx_hollow_gate'],
        ['shake', 300],
        ['camera', 'gaspar', 600],
        say('gaspar', 'neutral', `Two. The door groans now.`),
        say('gaspar', 'neutral', `Chief.`),
        ['face', 'gaspar', 'crono'],
        say('gaspar', 'neutral', `The mage will not come for you. He will come for the name. Let him.`),
        ['sfx', 'sfx_gate_open'],
        ['vfx', 'sparkle', '@door_12k'],
        ['setflag', 'gaspar_after', 0],
      ]],
      ['if', { flag: 'gaspar_after', eq: 3 }, [
        ['sfx', 'sfx_hollow_gate'],
        ['vfx', 'time_rift', '@door_grey'],
        ['shake', 500],
        ['camera', 'gaspar', 600],
        say('gaspar', 'sad', `It has opened its own door. That was always going to be the price of pulling the seeds.`),
        ['face', 'gaspar', 'iselle'],
        say('gaspar', 'sad', `Warden.`),
        ['face', 'gaspar', 'crono'],
        say('gaspar', 'sad', `Boy. The lamp will be lit when you come back. If you come back.`),
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
      { id: 'spekkio', at: '@spekkio', face: 'S' },
    ],
    script: [
      ['if', { flag: 'progress', gte: 3 }, [['spawn', { id: 'ayla', at: '@ayla', face: 'N' }]]],
      ['if', { flag: 'progress', gte: 4 }, [['spawn', { id: 'magus', at: '@magus', face: 'N' }]]],
      ['fade', 'in', 400],
      ['anim', 'spekkio', 'jump'],
      say('spekkio', 'happy', `Heya! Wanna spar? I'll size myself to you. Fair's fair!`),
      ['choice', ['Spar with Spekkio', 'Maybe later'], [
        [
          ['battle', 'OPT1'],
          ['if', '!opt1_won', [
            say('spekkio', 'happy', `First win's worth a prize. Here — chew on these. Well, don't chew them.`),
            ['reward', { items: { magic_tab: 3 } }],
            ['setflag', 'opt1_won', true],
          ], [
            say('spekkio', 'happy', `Again, again! …Tomorrow. There's no tomorrow here. Whenever!`),
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
      ['face', 'king', 'frog'],
      say('king', 'angry', `Glenn! Where in the nine hells — the Denadoro Mountains are *walking*. Porcelain men march the pass at night and the mountain folk say the peak glows red.`),
      say('leene', 'sad', `The Masamune's shrine, Glenn. They're digging at it.`),
      say('frog', 'determined', `Then they dig for a grave. Majesty — a Seed. Of the beast we slew. It hath been planted where Cyrus fell.`),
      say('king', 'neutral', `Cyrus…`),
      ['wait', 500],
      say('king', 'neutral', `Take whoever you need.`),
      say('frog', 'sad', `I have what I need.`),
      ['face', 'frog', 'crono'],
      say('frog', 'sad', `Though I confess I wished for more of us.`),
      ['choice', [`Put a hand on Frog's shoulder`, 'Say nothing'], [
        [
          ['face', 'crono', 'frog'],
          ['emote', 'frog', '!'],
          say('frog', 'happy', `Aye. Aye, thou'rt right. Two is enough when the two are right.`),
        ],
        [
          ['emote', 'crono', '...'],
          say('frog', 'neutral', `…Thou hast ever known when to hold thy tongue. Come.`),
        ],
      ], 'c_shoulder'],
      ['field', {
        leader: 'crono',
        hint: 'Head south to Denadoro Pass.',
        npcs: [
          { id: 'king', talk: [
            say('king', 'neutral', `The mountain folk will light beacons on the lower ridges for you. Go with Guardia's blessing, Glenn — and come back with it.`),
          ] },
          { id: 'leene', talk: [
            say('leene', 'sad', `Cyrus used to say the pass sang when the wind was right.`),
            say('leene', 'happy', `I should like to hear it sing again. Bring the song home, Glenn.`),
          ] },
          { id: 'guard1', talk: [
            N(`Guard: "Sir Glenn! Er — Sir Frog! Er… Sir." He salutes twice to be safe.`),
          ] },
          { id: 'guard2', talk: [
            N(`Guard: "They say the porcelain men don't bleed. Don't sleep, either. Just walk, all night, up the pass."`),
          ] },
          { id: 'merchant', talk: [
            N(`Quartermaster: "Steel for the pass, sirs? The mountain's no place for a dull edge."`),
            ['shop', 'guardia'],
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
      { id: 'iselle', at: '@iselle', face: 'S' },
      { id: 'sb1', sprite: 'seedbearer', at: '@seed_a', face: 'N' },
      { id: 'sb2', sprite: 'seedbearer', at: '@seed_b', face: 'N' },
    ],
    script: [
      ['fade', 'in', 600],
      ['move', 'frog', '@cairn'],
      ['move', 'crono', '@cairn'],
      ['face', 'crono', 'frog'],
      say('frog', 'sad', `Here. This is where he — where Cyrus —`),
      ['wait', 600],
      ['anim', 'crono', 'nod'],
      say('frog', 'determined', `I will not weep on a battlefield twice. Onward.`),
      ['music', 'mus_frog_theme'],
      ['camera', '@seed_a', 2500],
      ['sfx', 'sfx_seed_pulse'],
      ['camera', '@shrine', 1800],
      ['camera', '@iselle', 1700],
      ['music', 'mus_denadoro'],
      ['sfx', 'sfx_porcelain_step'],
      say('iselle', 'neutral', `The knight and the boy who bent the century. I was told you'd come here first. The Curator keeps very good records.`),
      say('frog', 'angry', `Who art thou to dig at hallowed ground?`),
      say('iselle', 'neutral', `Iselle. Warden of the Hollow. And this ground isn't hallowed, Sir Glenn. It's *catalogued.* Entry 4,417: Denadoro Mountains, site of the death of Cyrus of Guardia. It will be preserved exactly as it was.`),
      say('frog', 'surprised', `…Thou knowest his name.`),
      say('iselle', 'sad', `I know everyone's name. That's the problem with archives.`),
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
      say('frog', 'sad', `She spoke of records. Of keeping things as they were.`),
      ['wait', 700],
      say('frog', 'sad', `I have spent ten years keeping a day as it was, Crono. The day he died. Kept it so well I forgot to leave it.`),
      ['choice', ['Nod', 'Shake head'], [
        [['anim', 'crono', 'nod'], say('frog', 'neutral', `Aye. Thou seest it too.`)],
        [['anim', 'crono', 'shake_head'], say('frog', 'happy', `Ha. Thou'rt kind. Thou'rt also wrong.`)],
      ], 'c_shrine'],
      say('frog', 'determined', `One seed pulled. Let us pull the rest — and then, perhaps, I shall let the mountain be a mountain.`),
      ['reward', { xp: 150, key: 'denadoro_seed' }],
      ...toHub(2, 1, 'ch2_open', 'ch1_open'),
    ],
  };

  // =====================================================================
  // CHAPTER 2 — "Strong, Then Kind" (65,000,000 B.C.)
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
      { id: 'vill3', sprite: 'villager_ioka_c', at: '@vill3', face: 'W' },
      { id: 'trader', sprite: 'villager_ioka', at: '@shop', face: 'S' },
    ],
    script: [
      ['chapter', 'II. STRONG, THEN KIND', '65,000,000 B.C.'],
      ['fade', 'in', 600],
      ['anim', 'vill1', 'spin'],
      ['anim', 'vill2', 'jump'],
      ['anim', 'vill3', 'spin'],
      ['emote', 'kino', '!'],
      ['move', 'kino', '@crono', { run: true }],
      ['face', 'kino', 'crono'],
      ['face', 'crono', 'kino'],
      say('kino', 'surprised', `Crono! Frog-man! Ayla gone! Ayla go fight shiny men alone! Kino say "wait", Ayla say "no". Ayla always say no!`),
      say('frog', 'neutral', `Where?`),
      say('kino', 'sad', `Old Tyrano place. Ground there gone red and hot again. Kino scared. Kino… Kino go too?`),
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
          { id: 'vill1', talk: [N(`Villager: "Ayla go. Ayla always go. Then Ayla come back and we dance. So we dance now. Practice."`)] },
          { id: 'vill2', talk: [N(`Villager: "Red sky over Tyrano place. Old people say bad. Young people say bad. Everybody agree! First time."`)] },
          { id: 'vill3', talk: [N(`Villager: "Frog-man! You eat bug? Kino say you eat bug. Kino lie?"`)] },
          { id: 'trader', talk: [
            N(`Trader: "Good stone. Good bone. Ayla like bone armor. You like? You pay."`),
            ['shop', 'ioka'],
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
      { id: 'sb0', sprite: 'seedbearer', at: '@roll1', face: 'S' },
      { id: 'sb1', sprite: 'seedbearer', at: '@feeder1', face: 'E' },
      { id: 'sb2', sprite: 'seedbearer', at: '@feeder2', face: 'W' },
      { id: 'sb3', sprite: 'seedbearer', at: '@feeder3', face: 'S' },
      { id: 'seed', sprite: 'lavos_seed', at: [8, 8], prop: true },
    ],
    script: [
      ['if', { flag: 'kino_choice', eq: 0 }, [['spawn', { id: 'kino', at: '@kino', face: 'N' }]]],
      ['camera', 'ayla', 0],
      ['fade', 'in', 600],
      ['sfx', 'sfx_seed_pulse'],
      // Ayla punches a Seedbearer clean off a ledge.
      ['face', 'ayla', 'sb0'],
      ['anim', 'ayla', 'jump'],
      ['sfx', 'sfx_kick'],
      ['vfx', 'sparkle', '@roll1'],
      ['anim', 'sb0', 'fall'],
      ['anim', 'sb0', 'dissolve'],
      ['despawn', 'sb0'],
      ['face', 'ayla', 'crono'],
      say('ayla', 'happy', `CRONO! FROG! Ayla knew you come! Shiny men no fun. They no scream, they just fall.`),
      say('frog', 'neutral', `Ayla, the seed —`),
      say('ayla', 'angry', `Ayla see. Ayla try pull. Seed bite Ayla.`),
      ['emote', 'ayla', '!'],
      say('ayla', 'angry', `Seed bad. Ayla break seed.`),
      // Iselle appears on the rim.
      ['sfx', 'sfx_hollow_gate'],
      ['vfx', 'time_rift', '@iselle'],
      ['spawn', { id: 'iselle', at: '@iselle', face: 'S' }],
      ['close_rift', '@iselle'],
      ['camera', 'iselle', 700],
      ['if', { flag: 'kino_choice', eq: 0 }, [['emote', 'kino', '!']]],
      say('iselle', 'neutral', `Entry 9. Ayla of Ioka. Slew the Black Tyrano. Never learned to read. Never needed to.`),
      ['wait', 600],
      say('iselle', 'neutral', `You can't break it, chief. It's already rooting. In four turns it will hatch, and this crater becomes a nursery.`),
      ['face', 'ayla', 'iselle'],
      say('ayla', 'angry', `You! Half-shiny girl! You plant bad egg in Ayla's ground!`),
      say('iselle', 'sad', `It was never your ground. It's *its* ground. It always was, underneath.`),
      say('ayla', 'determined', `Ayla show you whose ground.`),
      ['if', { flag: 'kino_choice', eq: 0 }, [
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
      say('ayla', 'neutral', `Half-shiny girl say this ground belong to egg-thing.`),
      ['wait', 600],
      say('ayla', 'neutral', `Ayla think… ground belong to who stand on it. Ayla stand on it. Ayla's children stand on it. Egg-thing stand on nothing.`),
      say('frog', 'neutral', `A sound philosophy.`),
      say('ayla', 'happy', `Ayla have many. Ayla say them loud.`),
      ['choice', ['Help her up', 'Sit down next to her'], [
        [
          ['face', 'crono', 'ayla'],
          ['anim', 'ayla', 'jump'],
          say('ayla', 'happy', `Crono strong. Ayla stronger. But nice.`),
        ],
        [
          ['anim', 'crono', 'kneel'],
          say('ayla', 'happy', `Good. Sit. Watch fire go out. Then we go find Blue-hair.`),
          ['camera', 'ayla', 600],
          ['wait', 3000],
        ],
      ], 'c_crater'],
      say('ayla', 'determined', `Half-shiny say "her name." Ayla think Blue-hair not going to like that.`),
      ['reward', { xp: 300, key: 'tyrano_seed' }],
      ...toHub(3, 2, 'ch3_open', 'ch2_open'),
    ],
  };

  // =====================================================================
  // CHAPTER 3 — "Schala's Name" (12,000 B.C.)
  // =====================================================================
  S['3.1'] = {
    title: 'The Last Village',
    map: 'last_village', theme: 'snow', music: 'mus_last_village',
    actors: [
      { id: 'crono', at: '@crono', face: 'N' },
      { id: 'frog', at: '@crono', face: 'N' },
      { id: 'ayla', at: '@crono', face: 'N' },
      { id: 'elder', at: '@elder', face: 'S' },
      { id: 'magus', at: '@magus', face: 'N' },
      { id: 'vill1', sprite: 'villager_last', at: '@vill1', face: 'S' },
      { id: 'vill2', sprite: 'villager_last_b', at: '@vill2', face: 'E' },
      { id: 'vill3', sprite: 'villager_last_c', at: '@vill3', face: 'W' },
      { id: 'hunter', sprite: 'villager_last', at: '@shop', face: 'S' },
    ],
    script: [
      ['chapter', `III. SCHALA'S NAME`, '12,000 B.C.'],
      ['camera', 'magus', 0],
      ['fade', 'in', 900],
      ['wait', 1200],
      ['camera', 'crono', 800],
      ['move', 'crono', '@elder'],
      ['move', 'frog', '@elder', { nowait: true }],
      ['move', 'ayla', '@elder'],
      ['face', 'elder', 'crono'],
      say('elder', 'neutral', `The blue-haired one arrived at dawn. He has not moved. He has not eaten. He asked one question: "Where did the wreckage surface." I told him. He hasn't gone.`),
      say('frog', 'neutral', `He waits for us. He would never say so.`),
      // The party walks to Magus. He does not turn.
      ['move', 'crono', '@magus'],
      ['move', 'frog', '@magus', { nowait: true }],
      ['move', 'ayla', '@magus'],
      say('magus', 'neutral', `You're late. The frog's stench arrived a full minute before the frog.`),
      say('frog', 'angry', `And thine has been here since dawn, I'm told, and hath not improved.`),
      ['face', 'magus', 'crono'],
      say('magus', 'neutral', `Crono. A porcelain girl came through the ice last night. She said the thing in the grey future had built an exhibit. She said the exhibit's name was *Schala.*`),
      ['wait', 700],
      say('magus', 'neutral', `Then she asked me to come quietly.`),
      say('ayla', 'surprised', `Blue-hair go quiet?`),
      say('magus', 'angry', `I broke her halberd's shaft and she left.`),
      ['wait', 700],
      say('magus', 'angry', `I should have gone with her. Whatever it has — a copy, a memory, a corpse — it has more of my sister than I have had in twenty years.`),
      ['choice', ['Draw sword — "then we take it from them"', 'Sheathe sword — "come with us"'], [
        [
          ['anim', 'crono', 'draw_sword'],
          say('magus', 'determined', `…Good. I'd have despised you for sympathy.`),
        ],
        [
          say('magus', 'neutral', `Put that away or use it. You've never once done anything in between.`),
          ['anim', 'crono', 'shrug'],
          say('magus', 'neutral', `…Fine.`),
        ],
      ], 'c_magus_join'],
      say('magus', 'neutral', `The seed is in the Zeal wreckage. Deepest hall. She's waiting there. I'll be *civil*.`),
      say('frog', 'neutral', `Thou wilt be nothing of the sort.`),
      say('magus', 'neutral', `No.`),
      ['join', 'magus'],
      ['unlock', 'shadow_cyclone'],
      ['unlock', 'ice_water'],
      ['popup', `New dual techs with Magus. He won't call them that.`],
      ['field', {
        leader: 'crono',
        hint: 'Head north to the Zeal wreckage.',
        npcs: [
          { id: 'elder', talk: [
            say('elder', 'neutral', `The sea took a kingdom that floated. Every winter it gives back pieces. We do not go down to the shore when it does.`),
            say('elder', 'sad', `If you must go, go warm. The cold down there is older than we are.`),
          ] },
          { id: 'vill1', talk: [N(`Villager: "The Zeal folk called us Earthbound like it was an insult. Now the sky's empty and we're the ones still standing."`)] },
          { id: 'vill2', talk: [N(`Child: "The blue man didn't blink all morning. Mama says don't stare. I'm not staring. I'm counting."`)] },
          { id: 'vill3', talk: [N(`Villager: "Porcelain footprints in the snow last night. They didn't sink. Nothing that walks should be that light."`)] },
          { id: 'hunter', talk: [
            N(`Hunter: "Pelts, pine-pitch, and blades that won't crack in the cold. Trade?"`),
            ['shop', 'last_village'],
          ] },
        ],
        exits: [{ zone: 'EXIT_NORTH', goto: '3.2', label: 'Zeal Wreckage' }],
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
      { id: 'iselle', at: '@iselle', face: 'S' },
      { id: 'sbg', sprite: 'seedbearer', at: '@guard', face: 'S' },
      { id: 'sen1', sprite: 'vitrine', at: '@sentinel1', face: 'S' },
      { id: 'sen2', sprite: 'vitrine', at: '@sentinel2', face: 'S' },
      { id: 'nu1', sprite: 'echo_nu', at: '@nu1', face: 'S' },
      { id: 'nu2', sprite: 'echo_nu', at: '@nu2', face: 'S' },
      { id: 'seed', sprite: 'lavos_seed', at: [8, 2], prop: true },
    ],
    script: [
      ['camera', '@case', 0],
      ['fade', 'in', 1200],
      ['sfx', 'sfx_seed_pulse'],
      ['wait', 1200],
      ['camera', 'magus', 900],
      // Magus walks ahead of everyone and stops ten tiles from the case.
      ['move', 'magus', '@magus_stop'],
      say('magus', 'neutral', `That isn't her.`),
      say('iselle', 'neutral', `No. It's Entry 1,001. Reconstructed from every record that ever mentioned her. The Curator thought you'd want to see how much of her survived.`),
      ['music', 'mus_magus_theme'],
      say('magus', 'angry', `How much of her survived is *none of your archive's business.*`),
      say('iselle', 'sad', `I said that too. Once. About my brother.`),
      ['emote', 'iselle', '...'],
      say('iselle', 'sad', `The Curator disagreed. It's very good at disagreeing.`),
      say('frog', 'surprised', `Thou hast a brother?`),
      say('iselle', 'neutral', `Had. In the dome. In the future you erased. He is the reason I'm standing in a drowned palace with a seed at my feet. Don't tell me about sisters, mage.`),
      say('magus', 'neutral', `…I wasn't going to.`),
      say('iselle', 'determined', `Then let's be honest with each other. I plant this, my brother exists. You stop me, he never did. That's the whole war.`),
      say('ayla', 'angry', `Ayla sorry about brother. Ayla still break egg.`),
      say('iselle', 'angry', `I know you will.`),
      ['battle', 'B3'],
      ['goto', '3.3'],
    ],
  };

  S['3.3'] = {
    title: 'Hall, after',
    map: 'zeal_wreck', theme: 'zeal', music: 'mus_rift',
    actors: [
      { id: 'iselle', sprite: 'iselle_broken', at: '@iselle', face: 'S' },
      { id: 'crono', at: '@nu_spawn', face: 'N' },
      { id: 'frog', at: '@guard', face: 'W' },
      { id: 'ayla', at: '@nu_spawn', face: 'N' },
      { id: 'magus', at: '@magus_stop', face: 'N' },
    ],
    script: [
      ['camera', 'iselle', 0],
      ['fade', 'in', 800],
      say('iselle', 'sad', `The seeds were never the plan. The seeds were the *bait*. Three eras, three heroes pulled out of their homes, all four of you in one place, all your techs and blades logged and measured while you fought me.`),
      ['wait', 700],
      say('iselle', 'sad', `It needed a complete entry. It has one now. And it's opening the door itself.`),
      say('frog', 'angry', `To what end?`),
      say('iselle', 'neutral', `The Hollow can't stay a pocket forever. It needs a *host* timeline. It was going to use the seeds. Now it's going to use *you.* The thing that ended Lavos, kept in a case, forever. The Curator's final exhibit. Every other year can be sanded off.`),
      say('ayla', 'angry', `Ayla no live in box.`),
      ['move', 'magus', '@iselle'],
      ['face', 'magus', 'iselle'],
      say('magus', 'neutral', `Come with us.`),
      say('iselle', 'surprised', `What?`),
      say('magus', 'neutral', `You know the halls. And you owe your brother a better ending than being a footnote in someone else's museum.`),
      say('iselle', 'sad', `It'll know I turned. It knows everything.`),
      say('magus', 'angry', `Then let it. I've been *known* by monsters before. It never once helped them.`),
      ['choice', ['Offer a hand', 'Wait'], [
        [
          ['face', 'crono', 'iselle'],
          ['anim', 'crono', 'point'],
          ['despawn', 'iselle'],
          ['spawn', { id: 'iselle', at: '@iselle', face: 'S' }],
          say('iselle', 'determined', `…Corin would have liked you. He liked idiots.`),
        ],
        [
          ['emote', 'crono', '...'],
          ['wait', 800],
          ['despawn', 'iselle'],
          ['spawn', { id: 'iselle', at: '@iselle', face: 'S' }],
          say('iselle', 'determined', `Don't help me. I'll walk.`),
        ],
      ], 'c_iselle_hand'],
      say('frog', 'neutral', `Then we go through the grey door. Together.`),
      ['face', 'frog', 'magus'],
      say('frog', 'neutral', `All of us.`),
      say('magus', 'neutral', `Don't say "together."`),
      ['wait', 800],
      say('magus', 'neutral', `…Fine. Together.`),
      ['reward', { xp: 500, key: 'zeal_seed' }],
      ['guest', 'iselle', true],
      ['popup', 'Iselle joins as a guest ally for the battles in the Hollow.'],
      ...toHub(4, 3, 'ch4_open', 'ch3_open'),
    ],
  };

  // =====================================================================
  // CHAPTER 4 — "The Museum of Never" (The Hollow)
  // =====================================================================
  S['4.1'] = {
    title: 'The grey door',
    map: 'end_of_time', theme: 'void', music: 'mus_rift',
    actors: [
      { id: 'crono', at: '@arrive', face: 'N' },
      { id: 'frog', at: '@arrive', face: 'N' },
      { id: 'ayla', at: '@arrive', face: 'N' },
      { id: 'magus', at: '@arrive', face: 'N' },
      { id: 'iselle', at: '@door_grey', face: 'S' },
      { id: 'gaspar', at: '@gaspar', face: 'S' },
    ],
    script: [
      ['chapter', 'IV. THE MUSEUM OF NEVER', 'THE HOLLOW'],
      ['fade', 'in', 600],
      ['vfx', 'time_rift', '@door_grey'],
      ['sfx', 'sfx_hollow_gate'],
      ['camera', '@door_grey', 900],
      ['wait', 800],
      ['sfx', 'sfx_hollow_gate'],
      ['face', 'iselle', 'N'],
      ['move', 'crono', '@door_grey', { nowait: true }],
      ['move', 'frog', '@door_grey', { nowait: true }],
      ['move', 'ayla', '@door_grey', { nowait: true }],
      ['move', 'magus', '@door_grey'],
      ['sfx', 'sfx_hollow_gate'],
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
      { id: 'iselle', at: [8, 7], face: 'N' },
      { id: 'sen1', sprite: 'vitrine', at: '@sentinel1', face: 'S' },
      { id: 'sen2', sprite: 'vitrine', at: '@sentinel2', face: 'S' },
      { id: 'sen3', sprite: 'vitrine', at: '@sentinel3', face: 'S' },
      { id: 'sen4', sprite: 'vitrine', at: '@sentinel4', face: 'S' },
    ],
    script: [
      ['fade', 'in', 1000, '255,255,255'],
      ['sfx', 'sfx_step'],
      ['wait', 400],
      ['sfx', 'sfx_step'],
      ['camera', 'map', 1500],
      ['wait', 800],
      ['camera', 'crono', 800],
      ['sfx', 'sfx_curator_speak'],
      V(`WELCOME. YOU ARE THE FIRST VISITORS. YOU ARE ALSO THE LAST ACQUISITION. BOTH ARE HONORS.`),
      say('frog', 'angry', `Show thyself!`),
      V(`I AM SHOWN. I AM THE HALLS. WALK THEM. YOU WILL FIND EVERYTHING YOU EVER LOST, ARRANGED CORRECTLY.`),
      say('iselle', 'angry', `Don't listen. It talks like that until you forget you're standing in a grave.`),
      V(`WARDEN. ENTRY 0-A. YOU HAVE MISFILED YOURSELF. I WILL CORRECT IT AFTER.`),
      say('magus', 'neutral', `You'll be busy.`),
      V(`I AM NEVER BUSY. I AM COMPLETE.`),
      ['wait', 800],
      V(`BEGIN THE TOUR.`),
      // The vitrines stand up and walk; an Echo Tyrano roars from a gallery arch.
      ['sfx', 'sfx_glass_shatter'],
      ['anim', 'sen1', 'jump'],
      ['anim', 'sen2', 'jump'],
      ['anim', 'sen3', 'jump'],
      ['anim', 'sen4', 'jump'],
      ['sfx', 'sfx_porcelain_step'],
      ['spawn', { id: 'tyrano', sprite: 'echo_tyrano', at: '@tyrano', face: 'S' }],
      ['camera', 'tyrano', 700],
      ['shake', 900],
      ['emote', 'ayla', '!'],
      ['battle', 'B4A'],
      ['goto', '4.3'],
    ],
  };

  S['4.3'] = {
    title: 'The Archive stacks',
    map: 'hollow_archive', theme: 'museum', music: 'mus_hollow',
    actors: [
      { id: 'iselle', at: '@corin_shelf', face: 'N' },
      { id: 'frog', at: '@frog', face: 'W' },
      { id: 'magus', at: '@magus', face: 'W' },
      { id: 'crono', at: '@hench_e1', face: 'N' },
      { id: 'ayla', at: '@hench_e2', face: 'N' },
    ],
    script: [
      ['camera', 'iselle', 0],
      ['fade', 'in', 800],
      ['anim', 'iselle', 'kneel'],
      ['sfx', 'sfx_item_get'],
      say('iselle', 'sad', `He's here. Corin. Entry 0-B.`),
      ['emote', 'iselle', '...'],
      say('iselle', 'sad', `That's all of him. That's what "preserved" means.`),
      ['wait', 700],
      say('iselle', 'sad', `I'd rather he'd never been than *this.* Is that terrible?`),
      say('frog', 'sad', `It is honest. Honesty is rarely comfortable.`),
      say('magus', 'neutral', `I'd rather Schala were alive and hated me than be a shape in a case. So. No. It isn't terrible.`),
      ['wait', 600],
      say('iselle', 'determined', `The Core's below. It'll try to separate us in the stacks. Don't let it.`),
      ['sfx', 'sfx_curator_speak'],
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
      ['spawn', { id: 'iselle', at: '@iselle', face: 'W' }],
      ['camera', 'map', 0],
      ['fade', 'in', 500],
      ['emote', 'ayla', '!'],
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
      { id: 'iselle', at: '@party', face: 'N' },
      { id: 'curator', sprite: 'curator_p1', at: '@curator', face: 'S' },
    ],
    script: [
      ['camera', 'curator', 0],
      ['fade', 'in', 1000],
      ['wait', 600],
      ['sfx', 'sfx_curator_speak'],
      V(`THE COLLECTION IS COMPLETE. THE FOUR WHO ENDED THE WORLD-EATER. STAND IN THE CASE AND EVERY ERA IS SAFE FOREVER — UNCHANGING, UNENDING, UNHARMED.`),
      ['camera', 'frog', 500],
      say('frog', 'angry', `Unliving.`),
      V(`LIVING IS THE PROCESS BY WHICH THINGS ARE LOST. I HAVE SOLVED IT.`),
      say('iselle', 'broken', `You solved my *brother.* Look at what you solved.`),
      ['anim', 'iselle', 'point'],
      V(`ENTRY 0-B IS INTACT.`),
      say('iselle', 'angry', `He's *a picture!*`),
      V(`…`),
      ['wait', 1500],
      V(`…HE IS INTACT.`),
      ['face', 'magus', 'curator'],
      say('magus', 'neutral', `I'm going to say this once, and I'm going to say it to the thing that thought a hollow statue was my sister. Nothing you keep is kept. It's only *stopped.* And I have spent my whole life fighting things that wanted the world stopped.`),
      ['choice', ['Draw sword'], [[['anim', 'crono', 'draw_sword']]], 'c_final'],
      ['anim', 'frog', 'draw_sword'],
      ['sfx', 'sfx_kick'],
      ['emote', 'ayla', '!'],
      ['sfx', 'sfx_dark_mist'],
      ['emote', 'magus', '!'],
      ['sfx', 'sfx_sword_hit'],
      say('iselle', 'determined', `This one's yours. Corin's watching. Make it a good entry.`),
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
      { id: 'crono', at: [7, 12], face: 'N' },
      { id: 'frog', at: [6, 12], face: 'N' },
      { id: 'ayla', at: [8, 12], face: 'N' },
      { id: 'magus', at: [9, 12], face: 'N' },
      { id: 'iselle', at: '@iselle_edge', face: 'N' },
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
      ['wait', 800],
      ['music', 'mus_ending'],
      // The museum dissolves into scanlines; vitrines pop like soap bubbles.
      ['sfx', 'sfx_scanline'],
      ['vfx', 'glass_shatter', '@case'],
      ['sfx', 'sfx_glass_shatter'],
      ['theme', 'void'],
      ['camera', 'iselle', 800],
      say('iselle', 'neutral', `It's un-happening. All of it. The Hollow, the dome — me.`),
      ['vfx', 'sparkle', '@iselle_edge'],
      ['wait', 700],
      say('magus', 'angry', `Iselle —`),
      ['move', 'iselle', [9, 12]],
      ['face', 'iselle', 'magus'],
      ['face', 'magus', 'iselle'],
      say('iselle', 'broken', `Don't. It's the right ending. I'm from a year that isn't.`),
      ['emote', 'iselle', '...'],
      say('iselle', 'broken', `Keep this one. Not in a case. In a *pocket.* Somewhere that moves.`),
      say('magus', 'neutral', `…I'll misplace it. Constantly.`),
      say('iselle', 'happy', `Good. That's living.`),
      say('frog', 'sad', `Warden. Thy brother would have been proud.`),
      say('iselle', 'neutral', `He'd have been *annoyed.* Same thing, in our family.`),
      ['face', 'iselle', 'crono'],
      say('iselle', 'neutral', `Entry 1. You never said a word to me.`),
      ['choice', ['Nod', 'Bow'], [
        [['anim', 'crono', 'nod'], say('iselle', 'happy', `…Yeah. That was enough.`)],
        [['anim', 'crono', 'bow'], say('iselle', 'surprised', `Corin would've *hated* you.`), ['emote', 'iselle', '♪']],
      ], 'c_iselle_end'],
      say('ayla', 'sad', `Half-shiny girl brave. Ayla remember. Ayla tell fire.`),
      say('iselle', 'happy', `Tell it loud.`),
      ['sfx', 'sfx_scanline'],
      ['anim', 'iselle', 'dissolve'],
      ['despawn', 'iselle'],
      ['wait', 1200],
      ['emote', 'magus', '...'],
      ['reward', { key: 'corin_tablet' }],
      // The floor drops away into white; the party falls through a (blue) Gate.
      ['shake', 800],
      ['fade', 'out', 1200, '255,255,255'],
      ['sfx', 'sfx_gate_open'],
      ['wait', 800],
      ['goto', '5.1'],
    ],
  };

  // =====================================================================
  // EPILOGUE — "Tomorrow, Unwritten"
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
      { id: 'spekkio', at: '@spekkio', face: 'S' },
    ],
    script: [
      ['setflag', 'hollow_closed', true],   // the grey door is gone
      ['setflag', 'ch4_open', false],
      ['chapter', 'EPILOGUE. TOMORROW, UNWRITTEN', 'THE END OF TIME'],
      ['vfx', 'gate', '@arrive'],
      ['fade', 'in', 1200, '255,255,255'],
      ['close_rift'],
      ['camera', 'gaspar', 800],
      ['face', 'gaspar', 'crono'],
      say('gaspar', 'happy', `Three doors. As it should be.`),
      ['face', 'gaspar', 'magus'],
      say('gaspar', 'happy', `You're holding something, mage.`),
      say('magus', 'neutral', `A misfiled entry.`),
      ['emote', 'magus', '...'],
      say('magus', 'neutral', `It's none of your concern.`),
      say('gaspar', 'neutral', `Nothing is. That's the job.`),
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
      ['face', 'marle', 'crono'],
      ['face', 'lucca', 'crono'],
      ['face', 'robo', 'crono'],
      ['anim', 'marle', 'jump'],
      say('marle', 'happy', `All your limbs! You listened!`),
      say('lucca', 'happy', `The radio cut out for six hours. Six. I aged a decade. Robo got here ten minutes ago and has said nothing but "readings nominal."`),
      say('robo', 'happy', `Readings are nominal. That was not nothing. That was *everything.*`),
      ['if', '!iselle_ko', [
        say('lucca', 'neutral', `Also — the last thing the radio picked up before it died was a girl's voice saying 'entry filed.' Friend of yours?`),
        say('frog', 'sad', `Aye. She was.`),
      ]],
      say('frog', 'happy', `Then 'tis done.`),
      ['face', 'frog', 'N'],
      say('frog', 'happy', `I shall go home now, I think. And when I next climb the mountain, it shall only be a mountain.`),
      say('ayla', 'happy', `Ayla go home too. Kino cry when Ayla leave, cry when Ayla come back. Kino good at cry.`),
      say('marle', 'neutral', `Magus?`),
      ['move', 'magus', '@gate', { nowait: true }],
      say('magus', 'neutral', `There's a year where a girl named Schala isn't a statue. I intend to find it. Don't follow.`),
      say('frog', 'neutral', `We shan't.`),
      ['wait', 600],
      say('magus', 'neutral', `…Frog.`),
      say('frog', 'neutral', `Aye?`),
      ['wait', 1600],
      ['if', { flag: 'eclipse_uses', gt: 1 }, [
        say('magus', 'neutral', `…Together. There. I said it twice. Never again.`),
      ], [
        say('magus', 'neutral', `Nothing.`),
      ]],
      ['move', 'magus', '@gate'],
      ['sfx', 'sfx_gate_close'],
      ['despawn', 'magus'],
      ['wait', 800],
      say('frog', 'happy', `'Twas "thank you." He'll deny it.`),
      ['choice', ['Ring the bell'], [[
        ['move', 'crono', '@bell'],
        ['face', 'crono', 'N'],
        ['sfx', 'sfx_leene_bell'],
      ]], 'c_bell'],
      ['emote', 'marle', '!'],
      ['emote', 'lucca', '!'],
      ['emote', 'robo', '!'],
      ['emote', 'frog', '!'],
      ['emote', 'ayla', '!'],
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
    party: { crono: [4, 8], frog: [5, 8] },
    units: [
      { id: 'imp1', type: 'echo_imp', at: [4, 2], face: 'S', hp: 40 },
      { id: 'imp2', type: 'echo_imp', at: [6, 2], face: 'S', hp: 40 },
      { id: 'hench', type: 'echo_hench', at: [5, 3], face: 'S', hp: 90 },
    ],
    objective: { type: 'DEFEAT_ALL', text: 'Defeat the Echoes!' },
    triggers: [
      { id: 'B0_T1', when: 'PRE_BATTLE', focus: 'frog',
        lines: [L('frog', 'neutral', `Mark the ground, Crono. High ground lendeth strength to the blade, and a foe's back is a foe's weakness.`)],
        script: [
          ['popup', 'Blue tiles show how far a unit can move. Climbing costs extra movement.'],
          ['popup', 'Red tiles show what a unit can attack. Hitting from higher ground deals more damage.'],
          ['popup', 'After acting, choose a facing. Attacks from the side hit harder; attacks from behind hit hardest and never miss.'],
        ] },
      { id: 'B0_T2', when: 'TURN_START', args: { n: 2 }, focus: 'frog',
        lines: [L('frog', 'neutral', `Thy Cyclone striketh all about thee. Use it when they cluster.`)],
        script: [['popup', 'Techs cost MP. Open the Tech menu to use Cyclone: it hits every tile around Crono.']] },
      { id: 'B0_T3', when: 'UNIT_HP_BELOW', args: { unit: 'crono', pct: 60 }, focus: 'frog',
        lines: [L('frog', 'neutral', `Hold! I shall mend thee.`)],
        script: [['popup', `Frog's Slurp heals one ally within 3 tiles. Use it from Frog's Tech menu.`]] },
      { id: 'B0_T4', when: 'UNIT_ADJACENT', args: { a: 'crono', b: 'frog', enemyAdjacent: true }, focus: 'frog',
        lines: [L('frog', 'determined', `Side by side! Our blades as one — 'tis the X-Strike!`)],
        effect: [{ type: 'UNLOCK_TECH', tech: 'x_strike' }],
        script: [['popup', 'Dual techs appear when a partner is within 3 tiles and has charged at least halfway. Both pay MP, and the partner spends their next turn.']] },
      { id: 'B0_T5', when: 'UNIT_DEFEATED', args: { unit: 'hench' }, focus: 'hench',
        lines: [L('frog', 'surprised', `It… fadeth. Like a memory forgotten.`)] },
      victoryMusic('B0_T6'),
    ],
    rewards: { xp: 110, gold: 50, items: { tonic: 2 } },
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
      { id: 'iselle', type: 'iselle', at: '@iselle', face: 'S', ai: 'hold', hp: 400, immortal: true },
    ],
    objective: { type: 'DEFEAT_UNIT', unit: 'seedA', text: 'Stop the Seedbearer before it reaches the shrine!' },
    hatch: {
      mode: 'carrier', carrier: 'seedA', zone: 'SHRINE',
      spawn: { type: 'lavos_sprout', id: 'sprout', at: '@shrine', hp: 300 },
      objective: { type: 'DEFEAT_ALL', text: 'The seed has hatched! Defeat everything!' },
    },
    triggers: [
      { id: 'B1_T1', when: 'PRE_BATTLE', focus: 'seedA',
        lines: [RL('lucca', 'neutral', `Seedbearer's on a path to the top. Kill the carrier, the seed drops and goes inert for a few minutes. Frog — she's on the bridge, that's height 3. Don't fight her uphill if you can help it.`)] },
      { id: 'B1_T2', when: 'TURN_START', args: { n: 2 }, focus: 'iselle',
        lines: [
          L('iselle', 'neutral', `You're wondering why I don't simply kill you. Entry 1: Crono of Truce. The archive would be poorer without you.`),
          L('frog', 'angry', `Spare me thy ledger!`),
        ] },
      { id: 'B1_T3', when: 'UNIT_ENTERS_ZONE', args: { unit: 'any_party', zone: 'BRIDGE' }, focus: 'iselle',
        lines: [L('iselle', 'angry', `Off my bridge.`)],
        effect: [{ type: 'FREE_ACTION', unit: 'iselle', tech: 'catalogue', target: 'trigger_unit' }] },
      { id: 'B1_T4', when: 'UNIT_DEFEATED', args: { unit: 'seedA' }, focus: 'seedA',
        lines: [L('frog', 'determined', `It falls! Now the Warden!`)],
        effect: [
          { type: 'DROP_SEED', at: 'seedA' },
          { type: 'SET_OBJECTIVE', objective: { type: 'DEFEAT_ALL' }, text: 'Defeat Iselle or drive her off' },
        ] },
      { id: 'B1_T5', when: 'UNIT_HP_BELOW', args: { unit: 'iselle', pct: 40 }, focus: 'iselle',
        lines: [
          L('iselle', 'sad', `…Noted. The Curator will want to know the knight still fights like the man he was.`),
          L('iselle', 'neutral', `We'll meet in the age of beasts. Bring the savage — she's Entry 9, and I'd like to see it in person.`),
        ],
        effect: [
          { type: 'RIFT', at: 'iselle' },
          { type: 'DESPAWN', unit: 'iselle' },
          { type: 'CLOSE_RIFT' },
          { type: 'PLAY_MUSIC', track: 'mus_battle' },
          { type: 'SET_OBJECTIVE', objective: { type: 'DEFEAT_ALL' }, text: 'The Warden is gone. Defeat the remaining enemies!' },
        ] },
      { id: 'B1_T6', when: 'ALLY_KO', args: { unit: 'frog' }, focus: 'crono',
        lines: [RL('lucca', 'surprised', `Crono! Get a Revive on him, you're not soloing a Warden!`)] },
      victoryMusic('B1_T7'),
      { id: 'B1_DEFEAT', when: 'DEFEAT',
        lines: [L('frog', 'sad', `Cyrus… I have failed thee twice.`)] },
    ],
    rewards: { xp: 500, gold: 300, items: { tonic: 3, mid_tonic: 1 } },
  };

  B.B2 = {
    name: 'Nursery', map: 'tyrano_crater', music: 'mus_battle_boss',
    party: { crono: [6, 13], frog: [10, 13], ayla: [8, 10] },
    units: [
      { id: 'sb1', type: 'seedbearer', at: [4, 8], face: 'E', ai: 'hold', hp: 150 },
      { id: 'sb2', type: 'seedbearer', at: [12, 8], face: 'W', ai: 'hold', hp: 150 },
      { id: 'sb3', type: 'seedbearer', at: [8, 4], face: 'S', ai: 'hold', hp: 150 },
      { id: 'roll1', type: 'echo_roundillo', near: '@roll1' },
      { id: 'roll2', type: 'echo_roundillo', near: '@roll2' },
      { id: 'iselle', type: 'iselle', at: [2, 2], face: 'S', ai: 'hold', passive: true, hp: 550, immortal: true },
    ],
    objective: { type: 'DEFEAT_TYPE', enemyType: 'seedbearer', text: 'Defeat the three Seedbearers before the seed hatches!' },
    hatch: {
      mode: 'feeders', feeders: ['sb1', 'sb2', 'sb3'], max: 4, minFeeders: 2,
      spawn: { type: 'lavos_sprout_large', id: 'sprout', at: [8, 8], hp: 600 },
      objective: { type: 'DEFEAT_ALL', text: 'The seed has hatched! Defeat everything!' },
    },
    triggers: [
      { id: 'B2_T1', when: 'PRE_BATTLE', focus: 'ayla',
        lines: [
          RL('lucca', 'neutral', `Three carriers are feeding it. Every round they all survive, it grows. Ayla's fast — split up. Frog, keep Crono breathing. And Ayla: the ledges. *Push them off the ledges.*`),
          L('ayla', 'happy', `Ayla like glasses-girl.`),
        ] },
      { id: 'B2_T2', when: 'TECH_USED', args: { unit: 'ayla', tech: 'rollo_kick', knockedDown: true }, focus: 'ayla',
        lines: [L('ayla', 'happy', `Fall down go boom!`)],
        script: [['popup', 'Rollo Kick knocks the target back one tile. Knock a foe off a drop of 2 or more for bonus fall damage.']] },
      { id: 'B2_T3', when: 'TURN_START', args: { n: 2 }, focus: 'iselle',
        lines: [
          L('iselle', 'neutral', `You don't understand what you're killing. That seed is a *future*. Billions of entries. My people.`),
          L('frog', 'angry', `Thy people were spared that future!`),
          L('iselle', 'angry', `They were *erased* from it. Do you know the difference? I do. I remember the dome. I remember the smell.`),
        ] },
      { id: 'B2_T4', when: 'COUNT_DEFEATED', args: { enemyType: 'seedbearer', count: 2 }, focus: 'ayla',
        lines: [L('ayla', 'determined', `One left! Crono — hit it, Ayla hold it!`)],
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
          L('iselle', 'neutral', `Noted.`),
          L('iselle', 'neutral', `The mage next. Tell him the Curator has an *exhibit* he'll want to see. Tell him her name.`),
        ],
        effect: [
          { type: 'RIFT', at: 'iselle' },
          { type: 'DESPAWN', unit: 'iselle' },
          { type: 'CLOSE_RIFT' },
        ] },
      { id: 'B2_T7', when: 'UNIT_HP_BELOW', args: { unit: 'ayla', pct: 30 }, focus: 'ayla',
        lines: [
          L('ayla', 'angry', `Ayla not tired! Ayla… little tired.`),
          L('frog', 'neutral', `Then let a frog carry thee a moment.`),
        ] },
      victoryMusic('B2_T8'),
      { id: 'B2_DEFEAT', when: 'DEFEAT',
        lines: [L('ayla', 'sad', `Ground… all red now.`)] },
    ],
    rewards: { xp: 1600, gold: 600, items: { mid_tonic: 2, ether: 1 } },
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
    objective: { type: 'DEFEAT_UNIT', unit: 'iselle', text: 'Defeat Iselle!',
      secondary: 'The seed is rooted — destroying the Seedbearer slows it.' },
    hatch: {
      mode: 'guard', guard: 'sbGuard', max: 6,
      spawn: { type: 'lavos_sprout_large', id: 'sprout', at: [8, 2], hp: 600 },
      objective: { type: 'DEFEAT_ALL', text: 'The seed has hatched! Defeat everything!' },
    },
    triggers: [
      { id: 'B3_T1', when: 'PRE_BATTLE', focus: 'sen1',
        lines: [
          RL('lucca', 'neutral', `Those glass things are sentinels — heavy, slow, and they'll body-block corridors. Magus can float around them over the water. Also, uh, Magus? Hi. Please don't blow up the radio.`),
          L('magus', 'neutral', `I'll consider it.`),
        ] },
      { id: 'B3_T2', when: 'TURN_START', args: { n: 2 }, focus: 'iselle',
        lines: [
          L('iselle', 'neutral', `Entry 2, Glenn. Entry 9, Ayla. Entry 1, Crono. And you — Janus. Prince of Zeal. The archive lists you under *lost.*`),
          L('magus', 'angry', `Take me off it.`),
        ] },
      { id: 'B3_T3', when: 'DUAL_TECH_USED', args: { tech: 'shadow_cyclone' }, focus: 'magus',
        lines: [
          L('frog', 'surprised', `Thy shadow… and Crono's blade… they *fit.*`),
          L('magus', 'neutral', `Don't make it sentimental.`),
        ] },
      { id: 'B3_T4', when: 'UNIT_HP_BELOW', args: { unit: 'iselle', pct: 60 }, focus: 'iselle',
        lines: [
          L('iselle', 'angry', `Preserve.`),
          L('iselle', 'determined', `I don't want to hurt you. I don't have to want to.`),
        ],
        effect: [
          { type: 'APPLY_STATUS', unit: 'iselle', status: 'stasis', turns: 1 },
          { type: 'SPAWN', unit: 'echo_nu', id: 'nu3', at: '@nu_spawn', face: 'S', ai: 'healer', hp: 200 },
        ] },
      { id: 'B3_T5', when: 'UNIT_ADJACENT', args: { a: 'magus', b: 'iselle' }, focus: 'magus',
        lines: [
          L('magus', 'neutral', `Your brother. What was his name.`),
          L('iselle', 'surprised', `…Corin.`),
          L('magus', 'neutral', `Then say it when you fight. Not the Curator's words. His.`),
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
          say('iselle', 'broken', `It's empty. It was always — I told it she'd be empty and it said the *shape* was enough.`),
          say('magus', 'neutral', `The shape is never enough.`),
          say('iselle', 'sad', `Kill the guard. The seed dies with it. I won't stop you.`),
          ['wait', 600],
          say('iselle', 'sad', `I won't help you either. Corin —`),
        ],
        effect: [
          { type: 'SET_TEAM', unit: 'iselle', team: 2 },
          { type: 'SET_AI', unit: 'iselle', ai: 'passive' },
          { type: 'SET_OBJECTIVE', objective: { type: 'DEFEAT_ALL' }, text: 'Defeat the remaining enemies.' },
        ] },
      { id: 'B3_T7', when: 'UNIT_DEFEATED', args: { unit: 'sbGuard' }, focus: 'sbGuard',
        lines: [
          L('ayla', 'determined', `Three eggs. No more eggs?`),
          RL('lucca', 'surprised', `That's the last one Gaspar sensed. The grey door should be — hang on. It's not weakening. It's *opening.*`),
        ] },
      victoryMusic('B3_T8'),
      { id: 'B3_DEFEAT', when: 'DEFEAT',
        lines: [L('magus', 'angry', `Pathetic.`)] },
    ],
    rewards: { xp: 3500, gold: 900, items: { mid_tonic: 2, ether: 2, revive: 1 } },
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
      { id: 'tyrano', type: 'echo_tyrano', at: '@tyrano', face: 'S', hp: 900 },
      { id: 'imp1', type: 'echo_imp', near: '@imp1' },
      { id: 'imp2', type: 'echo_imp', near: '@imp2' },
      { id: 'imp3', type: 'echo_imp', near: '@imp3' },
      { id: 'imp4', type: 'echo_imp', near: '@imp4' },
    ],
    objective: { type: 'DEFEAT_UNIT', unit: 'tyrano', text: 'Defeat the Echo Tyrano!' },
    triggers: [
      { id: 'B4A_T1', when: 'PRE_BATTLE', focus: 'tyrano',
        lines: [
          L('ayla', 'angry', `BIG WEIRD THING. Ayla know this one! Ayla kill it once already!`),
          L('iselle', 'neutral', `It's a copy. It's read every fight you ever had with the real one.`),
          L('ayla', 'happy', `Then it know Ayla win.`),
        ] },
      { id: 'B4A_T2', when: 'UNIT_HP_BELOW', args: { unit: 'tyrano', pct: 50 }, focus: 'tyrano',
        lines: [VL(`ENTRY 9 PERFORMS AS RECORDED.`)],
        effect: [
          { type: 'SPAWN', unit: 'vitrine_sentinel', id: 'sen5', near: '@arch_e', ai: 'sentinel', hp: 300 },
          { type: 'SPAWN', unit: 'vitrine_sentinel', id: 'sen6', near: '@arch_w', ai: 'sentinel', hp: 300 },
        ] },
      { id: 'B4A_T3', when: 'ALLY_KO', args: { unit: 'iselle' }, focus: 'iselle',
        lines: [
          L('iselle', 'sad', `…Go on. I'm — logged. It doesn't matter.`),
          L('magus', 'angry', `It matters.`),
        ] },
      victoryMusic('B4A_T4'),
    ],
    rewards: { xp: 500, gold: 1200, items: { ether: 2, revive: 1 } },
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
        lines: [RL('lucca', 'neutral', `I'm losing you — the Hollow eats signal. Magus can cross the gap. Everyone else, hold your side. Crono — don't be a hero.`)],
        script: [
          ['sfx', 'sfx_scanline'],
          radio('lucca', 'neutral', `…okay be a *little* —`),
          ['sfx', 'sfx_scanline'],
        ] },
      { id: 'B4B_T2', when: 'UNIT_ENTERS_ZONE', args: { unit: 'magus', zone: 'WEST' }, focus: 'magus',
        lines: [
          L('ayla', 'surprised', `Blue-hair come to Ayla's side?`),
          L('magus', 'neutral', `The frog is insufferable when he's protective.`),
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
          L('iselle', 'angry', `Kill it before the second gets there!`),
        ] },
      { id: 'B4B_T5', when: 'ANY_ENEMY_ENTERS_ZONE', args: { zone: 'LEDGER', count: 2 },
        lines: [VL(`FILED.`)],
        effect: [
          { type: 'SHAKE' },
          { type: 'FILL_TILES', zone: 'CHASM', terrain: 'k', h: 0 },
          { type: 'APPLY_STATUS', unit: 'all_party', status: 'catalogued', turns: 'permanent' },
        ] },
      { id: 'B4B_T6', when: 'COUNT_DEFEATED', args: { enemyType: 'seedbearer', count: 4 },
        lines: [L('iselle', 'determined', `That's all of its hands. Now it has to use its own.`)],
        effect: [
          { type: 'SHAKE' },
          { type: 'FILL_TILES', zone: 'CHASM', terrain: 'k', h: 0 },
        ] },
      victoryMusic('B4B_T7'),
    ],
    rewards: { xp: 1000, gold: 1400, items: { mid_tonic: 3, shelter: 1 } },
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
        lines: [RL('lucca', 'determined', `Crono — the pedestals. It built its own weak points. Museums always do.`)],
        script: [['sfx', 'sfx_scanline']] },
      { id: 'B5_T2', when: 'PLACARD_SHATTERED', args: { count: 1 }, focus: 'curator',
        lines: [
          VL(`THAT WAS A LABEL. LABELS ARE NOT LOAD-BEARING.`),
          L('frog', 'determined', `Then why dost thou flinch?`),
        ] },
      { id: 'B5_T3', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 75 }, focus: 'frog',
        lines: [
          VL(`ENTRY 2. GLENN. YOU KEPT CYRUS'S DEATH FOR TEN YEARS. YOU AND I ARE THE SAME.`),
          L('frog', 'sad', `Aye. I was.`),
          L('frog', 'angry', `I put it down on the mountain. Thou shouldst try it.`),
        ] },
      { id: 'B5_T4', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 50 }, focus: 'ayla',
        lines: [
          VL(`ENTRY 9. AYLA. IN YOUR ERA THE REPTITES LOSE AND YOUR PEOPLE INHERIT THE ASH. I CAN MAKE IT NOT HAPPEN. I CAN MAKE NOTHING HAPPEN.`),
          L('ayla', 'angry', `Ayla *like* happen!`),
        ] },
      { id: 'B5_T5', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 25 }, focus: 'crono',
        lines: [VL(`ENTRY 1. CRONO. YOU DIED ONCE AND WERE RETRIEVED. YOU ARE ALREADY A RESTORED ITEM. YOU BELONG HERE.`)],
        script: [
          ['choice', ['Shake head', 'Point sword at it'], [
            [['anim', 'crono', 'shake_head']],
            [['anim', 'crono', 'point']],
          ], 'c_restored'],
          say('magus', 'neutral', `He was retrieved by people who *loved* him, machine. Not by a shelf.`),
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
          L('magus', 'determined', `Its magic-hide is thick now. Steel, then. And I have one thing left to give steel.`),
          L('iselle', 'determined', `Together! You said it! *Say it again!*`),
          L('magus', 'angry', `…TOGETHER.`),
        ],
        effect: [{ type: 'UNLOCK_TECH', tech: 'eclipse_blade' }],
        script: [['popup', 'Triple Tech unlocked: ECLIPSE BLADE (Crono + Frog + Magus). Ayla, cover them.']] },
      { id: 'B5_T8', when: 'TECH_USED', args: { unit: 'any', tech: 'eclipse_blade' }, focus: 'curator',
        lines: [
          VL(`THAT… IS NOT… IN THE RECORD.`),
          L('frog', 'determined', `Nay. 'Tis new.`),
        ] },
      { id: 'B5_T9', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 50 }, requires: 'b5_phase2', focus: 'ayla',
        lines: [
          L('ayla', 'happy', `Big weird thing getting SMALL!`),
          VL(`ENTRY 9 IS… INCORRECT.`),
        ] },
      { id: 'B5_T10', when: 'ALLY_KO', args: { unit: 'any' }, requires: 'b5_phase2', lineMode: 'first_alive',
        lines: [
          L('frog', 'determined', `Stand! We stand or we are *shelved!*`),
          L('ayla', 'angry', `Get UP!`),
          L('magus', 'angry', `Don't you *dare* become an exhibit.`),
        ] },
      { id: 'B5_T11', when: 'UNIT_HP_BELOW', args: { unit: 'curator', pct: 10 }, requires: 'b5_phase2', focus: 'curator',
        lines: [
          VL(`IF I END… THE DOME ENDS. CORIN ENDS. WARDEN…`),
          L('iselle', 'sad', `He already ended. You just wouldn't file it.`),
          L('iselle', 'sad', `File it now.`),
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
        lines: [L('spekkio', 'happy', `Show me the shape of your strength!`)] },
      { id: 'OPT1_T2', when: 'VICTORY', focus: 'spekkio',
        lines: [L('spekkio', 'happy', `Not bad! Not bad! …I was going easy.`)],
        effect: [{ type: 'PLAY_MUSIC', track: 'mus_victory' }] },
    ],
    rewards: { xp: 150, gold: 100 },
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
        actors: [{ id: 'frog', at: '@cairn', face: 'N' }],
        caption: 'Denadoro. Only a mountain.' },
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
        caption: 'A tablet, in a pocket. Still lit.',
        variants: [
          { if: 'seed_hatched', vfx: [], caption: 'A tablet, in a pocket. Dark, but kept.' },
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
      ['Maps, Pixel Art & Portraits', ['The Chrono Tactics fan project', 'PixelLab-assisted sprites, hand-built pixel toolkit']],
      ['Music & Sound', ['Original synthesized chiptune, composed in the spirit of the SNES era']],
      ['Cast', ['Crono', 'Frog (Glenn)', 'Ayla', 'Magus (Janus)', 'Iselle, the Warden', 'The Curator (VESPER)',
        'Marle', 'Lucca', 'Robo', 'King Guardia XXI', 'Queen Leene', 'Kino', 'The Elder', 'Gaspar', 'Spekkio', 'Corin']],
      ['Special Thanks', ['Everyone who ever rang the bell in Leene Square', 'You, for playing']],
      ['Legal', ['Chrono Trigger © Square Enix. This is a non-commercial fan work.',
        'All art, music and code in this project are original.']],
    ],
  };

  CT.SCENES = S;
  CT.BATTLES = B;
  CT.STORY_START = '0.2';
})();
