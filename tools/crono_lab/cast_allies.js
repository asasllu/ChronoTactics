// Hand-pixelled cast sprites (allies). See CAST_SPEC.md.
(function () {
  const CAST = (window.CAST = window.CAST || {});

  // ---- ISELLE, the Warden ------------------------------------------------------------
  const ISELLE_PAL = {
    // white bob: outline, dark, mid, light, highlight
    H: '#46466c', h: '#7e82a8', R: '#b8bcd6', W: '#eceef8', X: '#ffffff',
    // skin
    F: '#ffd4a8', S: '#f0a47c', s: '#b0604c', j: '#2a1010',
    // human eye iris, lit iris
    k: '#1c2a5c', i: '#4c7cd0', e: '#d8dce8',
    // porcelain: light, mid, shade, outline
    P: '#f6f6fa', Q: '#cfd2e2', q: '#9a9eb8', a: '#2c3c78',
    // glowing seam / lens / glass
    g: '#48b8ff', G: '#b8ecff', z: '#5c90dc', Z: '#9ccaf4', x: '#d4f0ff',
    // coat: outline, dark, mid, light, highlight
    p: '#1c1828', c: '#3e3e58', C: '#62647e', L: '#8e90aa', l: '#b6b8cc',
    // inner shirt, belt, buckle
    d: '#2a2038', n: '#4a4262', b: '#2a1c24', o: '#4e3446', v: '#dfe4f0',
    // trousers
    t: '#2a2a44', T: '#4a4a6e',
    // legs/boots
    K: '#0c0810', B: '#3a2c3c', m: '#5e4a5e', M: '#8a7088',
  };
  CAST.iselle = {
    name: 'Iselle', group: 'allies', w: 28, h: 47, pal: ISELLE_PAL,
    rows: [
      '...a',
      '..aXa',
      '..axa..........HH',
      '..aZa.........HWH',
      '.aapaa.......HHWHH',
      'aXxZa......HHWWXXWHH',
      'aXxZzaa...HWWXXhWWRRHH',
      'axZZZZa..HWXWXhWWhRRhRH',
      'aZxZaa..HWXWWhWWRhRRhhhH',
      'azaZa..HWWXWhWWRhRRRhhRhH',
      '.aZza.HWWWWhWWRhRRRhRhhhH',
      '..aza.HWXWhWRRhRRhRRhRhhH',
      '..apa.HWWhWRRhFhRhQhRRhhH',
      '..aza.HWRhFFFFFFgPPPQHRhH',
      '..aza.HWRhFFjekFgaxaQHRhH',
      '..aZa.HXRhFFjWiFgGXaqHRhH',
      '..aza.HWRhFSFFFsgPPQqHhRH',
      '..aza.HWRHjSFFsjgaPqaHRhH',
      '..aza.HWH.HjSSSSgQqaHhRhH',
      '..aZa.HRH....jssgqa..HhRH',
      '..aza..H...plLpddpCcp.HhH',
      '..aZa....pLlLLpndpCCccpH',
      '..aza...pLlLClpdnpCCcccp',
      '..aza..pCLpLClpdnpCccpCcp',
      '..aza.pLCppLClpdnpCccppCcp',
      '..aza.pLCp.pLClpdnpCcp.pCcp',
      '..azpcCp...pClpdnpCcp..pCcp',
      '.pFFSsp...poooovooop..pccp',
      '.pSFSsp...pbbbbvbbbp..aPga',
      '..pSsp...pLLCCpdnpCcccpagQa',
      '..aza...pLlLCCpddpCCccpaPqa',
      '..aZa...pLLCcpTtKTtpCcpaPQqa',
      '..aza...plLCcpTtKTtpCccpaqa',
      '..aza..pLLCCcpTtKTtpCccp',
      '..aza..plLCccpTtKTtpCCccp',
      '..aza..pLLCCcpTtKTtpCcccp',
      '..aZa..pppppppTtKTtpppppp',
      '..aza........KTtKTtK',
      '..aza........KMMKMmK',
      '..aza........KmBKmBK',
      '..aza........KMBKmBK',
      '..aza.......KmMBKmMBK',
      '..aZa......KMmBBKmMBBK',
      '..aza......KKKKKKKKKKK',
      '..aza',
      '...a',
    ],
  };

  // Broken: after the vitrine cracks. Head bowed, seams dimmed, porcelain chipped,
  // the halberd snapped (the glass head lies shattered by her boot).
  CAST.iselle_broken = {
    name: 'Iselle (broken)', group: 'allies', w: 28, h: 47,
    pal: Object.assign({}, ISELLE_PAL, { g: '#3a6cb0', G: '#6c9ad4', X: '#e8f0fa', x: '#a8c8e8', Z: '#7aa6d8', z: '#4a78b8' }),
    rows: [
      '',
      '',
      '',
      '',
      '...............HH',
      '..............HWH',
      '.............HHWHH',
      '...........HHWWXXWHH',
      '..........HWWXXhWWRRHH',
      '.........HWXWXhWWhRRhRH',
      '........HWXWWhWWRhRRhhhH',
      '.......HWWXWhWWRhRRRhhRhH',
      '......HWWWWhWWRhRRRhRhhhH',
      '......HWXWhWRRhRRhRRhRhhH',
      '....a.HWWhWRRhRRhRhhRRhhH',
      '...aXaHWRhWhFFhFgPhQQHRhH',
      '..axZaHWRhFFjjjFgajaQHRhH',
      '..aZa.HXRhFSFFFsgPaKaHRhH',
      '..aZa.HWRHjSFFsjgaPKaHhRH',
      '..aza.HWH.HjSSSSgjqaHRhH',
      '..aza.HRH..pjssgqap.HhRH',
      '..aza..H..pLlLpddpCcpHhH',
      '..aZa....pLlLLpndpCCccpH',
      '..aza...pLlLClpdnpCCcccp',
      '..aza..pCLpLClpdnpCccpCcp',
      '..aza.pLCppLClpdnpCccppCcp',
      '..aza.pLCp.pLClpdnpCcp.pCcp',
      '..azpcCp...pClpdnpCcp..pCcp',
      '.pFFSsp...poooovooop..pccp',
      '.pSFSsp...pbbbbvbbbp..aPja',
      '..pSsp...pLLCCpdnpCcccpagQa',
      '..aza...pLlLCCpddpCCccpaKqa',
      '..aZa...pLLCcpTtKTtpCcpaPQja',
      '..aza...plLCcpTtKTtpCccpaqa',
      '..aza..pLLCCcpTtKTtpCccp',
      '..aza..plLCccpTtKTtpCCccp',
      '..aza..pLLCCcpTtKTtpCcccp',
      '..aZa..pp.pppppTtKTtpp.ppp',
      '..aza........KMMKMmK',
      '..aza........KmBKmBK...aa',
      '..aza........KMBKmBK..aXxa',
      '..aza.......KmMBKmMBKaxZaaa',
      '..aZa......KMmBBKmMBBaZzZxXa',
      '..aza......KKKKKKKKKKaaaaaaa',
      '..aza',
      '...a',
    ],
  };

  // ---- MYSTIC KNIGHT -----------------------------------------------------------------
  // Steel plate with gold trim, closed great helm with a violet glow behind the visor,
  // dark plume, navy cape and tabard, runed greatsword planted point-down.
  CAST.knight = {
    name: 'Mystic Knight', group: 'allies', w: 30, h: 48,
    pal: {
      // steel: outline, dark, mid, light, highlight
      K: '#0e0e1c', D: '#3a3e5a', M: '#6c7290', L: '#a8aec8', W: '#e8ecf8',
      // gold trim: dark, mid, light
      o: '#5e3410', Y: '#c07a22', y: '#f8c440',
      // visor glow
      v: '#b070f0', V: '#f4dcff',
      // plume
      P: '#1e0c2c', u: '#46186a', U: '#7a3aa8',
      // cape / tabard navy
      n: '#0a1030', N: '#1a2658', b: '#2c4088', B: '#4666b4',
      // blade, runes, grip
      e: '#f0f4fc', E: '#b4bad2', F: '#7c82a0', r: '#c070ff', g: '#5a3018', G: '#8a5028',
    },
    rows: [
      '...............PP',
      '..............PUuP',
      '.............PUuuuP',
      '............KKUuuKuP',
      '..........KKLW.UuKKuUuP',
      '.........KLWWLLyMMMDDKuP',
      '.........KLWLLLyMMMDDKuP',
      '.........KWLLLMyMMMDDKuuP',
      '.........KyyyyyyYYYYoKuuP',
      '.........KLLMMMyMMDDDKUuP',
      '.........KLKvVKKKVvKDKuuP',
      '.........KLMMMMKMMMDDKKuP',
      '.........KLMKMKyKMKDDKKP',
      '.........KLMMMMyMMMDDKP',
      '.........KLLMMMyMMDDDK',
      '..........KyyyyyYYYoK',
      '.....KKKK..KLMMMMDDK..KKKK',
      '....KLWWLK.KMyyyyYDK.KMMDDK',
      '...KLWLLMDKKLWLMMMDKKMMMDDDK',
      '...KyyyyYoKKLWLMMMDKKyYYYooK',
      '...KLLMMDDKKLLMMMMDKKMMDDDDK',
      '...nKKKKKKKLyyyyyYDKKKKKKKn',
      '...nNKLMDKKLWLMMMMDDKKMDDKn',
      '...nNKLMDKKLLMMMMMDDKKMDDKn',
      '...nNKyYoKKLMMMyMMDDKKYYoKn',
      '...nNKLMMDKKLMyWyMDKKMMDDKn',
      '...nNBKLWLMDKKyYoKKMMDDDKNn',
      '..nNBbbKyyyYoKKGKKyYYooKbNNn',
      '..nNBbbbKLWLLMKgKLMMDDKbbNNn',
      '..nNBbbbKWLMLMKgKMLMDDKbbNNn',
      '..nNNbbKKKKKKKKgKKKKKKKKbNNn',
      '..nNNbbKoYyyyyyyyyyyYYoKbNNn',
      '..nNNbKLLMKLMKeEFKKMMDDKbNNn',
      '..nNNbKLMMKbbKeEFKKMDDDKbNNn',
      '..nNNbKyyYKbbKeErKKYYooKbnNn',
      '..nNNbbKLMMDKKeEFbKMMDDKbnNn',
      '..nNNbbKLMMDKKeEFbKMMDDKbnNn',
      '..nNNbKLWyLDKKeErKKLMyDDKnNn',
      '.nNNbbKLLMMDKKeEFKKMMMDDKbnNn',
      '.nNNbbbKKLMDKKeEFbKKMDDKbBnNn',
      '.nNNbbbKLWMDKKeErbKLMDDKbbnNn',
      '.nNNbbbKLWMDKKeEFbKLMDDKbBnNn',
      '.nNNbbKLWLMDKKeEFKKLMMDDKbnNn',
      '.nNNbKLWLMDDKKeErKKLMMDDDKnNn',
      '.nNNKLWLMMDDKbKeKKKLMMDDDDKNn',
      '.n.nKKKKKKKKKbbKbKKKKKKKKKK.n',
    ],
  };

  // ---- DIVERS (Skirmish allies) --------------------------------------------------------
  // Dave: olive camo suit, gunmetal helmet with a brass-rimmed porthole, masked face
  // (dark goggles and a regulator behind the glass), teal back tanks, long speargun.
  CAST.dave = {
    name: 'Dave', group: 'allies', w: 30, h: 44,
    pal: {
      // outline, gunmetal dark/mid/light/highlight
      K: '#0e1014', D: '#343c4c', M: '#56627a', L: '#8c98ae', W: '#d4dce8',
      // brass rim / bolts
      o: '#5a3a14', r: '#a86e24', R: '#e8b048',
      // porthole glass, mask lenses, regulator
      q: '#1c4452', X: '#e8fcff', E: '#86d8f0', e: '#2a6a80', m: '#3a3e48', 
      // camo suit: khaki, light khaki, dark green, shade
      c: '#6e6a3c', C: '#96905a', y: '#4c4a28', Z: '#2c4424', z: '#46603a',
      // tanks, hose
      t: '#2c8a78', T: '#5cc4a8', s: '#18564c', h: '#2a2a30',
      // gloves (black rubber), belt
      b: '#1e1e24', B: '#3a3a48', A: '#5a5a6c', k: '#26221e',
      // speargun: steel spear, wood stock
      g: '#5a3418', G: '#8a5a2c',
    },
    rows: [
      '',
      '',
      '............KKKKKKK',
      '..........KKWWLLMMMKK',
      '.........KWWLLLMMMMDDK',
      '........KWLLKKKKKKKMMDK',
      '........KWLKrRRRRrrKMDKhh',
      '....K..KLWKrRXqqqqrrKDDKhhK',
      '...KhK.KLLKRqEEqEEqrKDDK.KhK',
      '..KKKKKKLLKRqEeqEeqrKMDKKKKKK',
      '..KTtsKKLLKrqqmMmqqrKMDKKttsK',
      '..KWtsKKLLKrqqmmmqqrKDDKKTssK',
      '..KTtsKKLLLKrqqqqqrKMDDKKttsK',
      '..KkkkK.KLLMKrrrrrKMMDK.KkkkK',
      '..KTtsK.KMLMMKKKKKMMDDK.KttsK',
      '..KTtsK..KMMMMMMMMMDDK..KttsK',
      '......KKKLWLLMMMMMMMDDDKK',
      '.....KrRLrLLMMrMMMMrMDrDoK',
      '.....KLLMMMMMMMMMMMMMDDDDK',
      '....KKKKKKKKKKKKKKKKKKKKKKK',
      '...KCczKKCczzcCCcZZyyyKKZyZK',
      '...KCZzKKCzzZccCcZZZyyKKZZyK',
      '...KczcKKCczccZZccZyyZKKyZZK',
      '...KZccKKccCcZZzcccyZZKKyZZK',
      'LKL.KCczKKZcCcczcZZyK.KzZyK',
      'K.KKKKKbBBbKKKKKKKKKbBBbKK',
      'WLWLLLKBAABKLLLLLLLKBAAbKGK',
      'K.KKKKKbBBbKKKKKKKKKbBbbKgK',
      'LKL....KKKKKcZcCcZKKgKKgGgK',
      '........KCcZZcczZZyyZKKKKKK',
      '.......KkkAkkkkRrkkkkAkK',
      '.......KkkBkkkkrRkkkkBkK',
      '........KcZZcczKzcZZyZK',
      '........KCcZzccKccZZyZK',
      '........KCczcczKZZyyZZK',
      '........KZcCcZZKcZyyZZK',
      '........KZZccCcKzcZZyZK',
      '.......KrRrrrrrKrrrrRoK',
      '.......KLWLLMMMKLMMMDDK',
      '.......KLWLMMMDKLMMDDDK',
      '......KrRrrrrroKrrrrRooK',
      '......KLWLMMMDDKLMMMDDDK',
      '......KKKKKKKKKKKKKKKKKK',
    ],
  };

  // Mat: red suit with silver pads, polished steel helmet with a red crown, face visible
  // behind the glass, one big yellow tank, stubby grapnel launcher (muzzle toward us).
  CAST.mat = {
    name: 'Mat', group: 'allies', w: 30, h: 44,
    pal: {
      // outline, steel dark/mid/light/highlight
      K: '#12141e', D: '#4c5670', M: '#8892ac', L: '#c4ccdc', W: '#f4f8ff',
      // red: shade, mid, light, highlight (crown, rim, suit)
      x: '#6a1020', c: '#a82030', C: '#d83c3c', Q: '#ff7a64', r: '#8c1828', R: '#e04438', P: '#ff9c84',
      // glass tint, face
      q: '#9cd4f4', X: '#ffffff', h: '#7a4a22', F: '#ffd0a8', S: '#e89878', s: '#c07058', j: '#2a1008', i: '#2c5cb0',
      // tank
      t: '#e8b030', T: '#ffe070', y: '#a86810', o: '#5a3408', H: '#2a2a30',
      // gloves, belt
      b: '#1e1e24', B: '#3a3a48', A: '#5a5a6c',
      // launcher
      g: '#3a3e4a', G: '#6a7084',
    },
    rows: [
      '.............KKKKK',
      '............KPRRrK',
      '...........KKPRRrrKK',
      '..........KKWKKKKKLKK',
      '.........KWWLLLLLMMDDK..KK',
      '........KWLLKKKKKKKMMDKKTtK',
      '........KWLKxRRRRxxKMDKKTtK',
      '.......KLWKxRXhhhhxxKDDKKKKK',
      '.......KLLKRqhFFFhqxKDDKttyK',
      '.......KLLKRqjFFFjqxKMDKttyK',
      '.......KLLKxqiFsFiqxKMDKttyK',
      '.......KLLKxqSFFFSqxKDDKoooK',
      '.......KLLLKxqjjjqxKMDDKttyK',
      '........KLLMKxxxxxKMMDKTttyK',
      '........KMLMMKKKKKMMDDKTttyK',
      '.........KMMMMMMMMMDDKKTttyK',
      '......KKKLWLLMMMMMMMDDDKK',
      '.....KxRLRLLMMRMMMMRMDRDxK',
      '.....KLLMMMMMMMMMMMMMDDDDK',
      '....KKKKKKKKKKKKKKKKKKKKKKK',
      '...KWLMKKCCLCccccccMxxKKLMDK',
      '...KLMDKKQCCLcccccMcxxKKMDDK',
      '.W.KCcxKKCCCcLcccMccxxKKccxK',
      '.W.KQcxKKCQCKLWMDKcxcxKKCcxK',
      'W.KKKKxKKCCcKMLMDKccxxKKCcxK',
      'WKGgggKKKCCccKKKKKccxxKKCcxK',
      'KGKKKKKbBKCcccccccccxK.KCcxK',
      'KgKWLLKBAbKCcccccccxK..KxxxK',
      'KgKLDDKBBbKQCcccccxxK..KBAbK',
      'KGKKKKKbbKKCccccccxxK..KBBbK',
      'WKggggK.KbbbbbbWLbbbbbKKbbbK',
      'W.KKKK..KbbbbbbLDbbbbbK.KKK',
      '.W......KCCccxxKCcccxxK',
      '........KQCccxxKCcccxxK',
      '........KWLMMDKKLMMDDKK',
      '........KLMMDDKKMMDDDKK',
      '........KCcccxxKCcccxxK',
      '.......KLWLMMDDKLMMMDDK',
      '.......KxRRRRxxKxRRRRxK',
      '.......KLWLMMMDKLMMMDDK',
      '......KLWLLMMMDKLMMMDDDK',
      '......KKKKKKKKKKKKKKKKKK',
    ],
  };

  // ---- SPEKKIO, Master of War (small form) ------------------------------------------------
  // Round pink spirit: cream horns, purple tuft, floppy ears, beady eyes, wide grin,
  // cream belly, stubby arms and feet.
  CAST.spekkio = {
    name: 'Spekkio', group: 'allies', w: 27, h: 28,
    pal: {
      // pink: outline, dark shade, shade, mid, light, highlight
      P: '#5a1a40', u: '#a8386e', q: '#dc6e9c', p: '#f294bc', L: '#fcbcd4', W: '#fff0f6',
      // blush
      r: '#ff6c8c',
      // horns: outline, mid, light
      H: '#6a4418', h: '#d8b060', n: '#fff2b8',
      // tuft: outline, dark, light
      V: '#2c0c44', t: '#6c3094', T: '#b67ce6',
      // eyes, mouth, tongue, teeth
      e: '#1a1226', E: '#ffffff', m: '#3a0c24', B: '#f06c6c', Z: '#ffffff',
      // belly
      c: '#fff0d4', C: '#f0c4a0',
    },
    rows: [
      '..H.........V.V.........H',
      '.HnH.......VTVTV.......HhH',
      '.HnhH.....VTtTtTV.....HnhH',
      '.HnhH.....VtTtTtV.....HnhH',
      '..HnhH....VttTttV....HnhH',
      '...HnhHH.PPVtVtVPP.HHnhH',
      '.....HnPPLLpppppqqPPh',
      '......PLWLppppppppqP',
      '...PPPLWLpppppppppquP.PP',
      '..PLpLLLppppppppppqquPpuP',
      '.PLpPLLppppppppppppqquPquP',
      'PLqPLLpppEeppppppEeppquPquP',
      'PqPPLppppeeppppppeepqquuPuP',
      'PP.PLprrppppppppppprrqquPPP',
      '...PpppppmppppppmpppqquuP',
      '...PppppppmZZZZZmppqqquuP',
      '.PPPppppppcmBBBmcpqqquuPPP',
      'PLpPpppppccmmmccpqqqquuPquP',
      'PpqPpppcccccccccccCqquuPquP',
      '.PP.PpcccccccccccccCquuPPP',
      '....PpcccccccccccccCquP',
      '.....PpcccccccccccCCuuP',
      '......PuCCcccccccCCCuuP',
      '.....PPPPuuuuuuuuuuuPP',
      '....PLpuPPPPPPPPPPPquP',
      '....PLppqP.......PpqquP',
      '....PPPPPP.......PPPPPP',
    ],
  };
})();
