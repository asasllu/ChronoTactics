// Hand-pixelled cast sprites (npcs). See CAST_SPEC.md.
// Front view, idle. Each sprite is a hand-authored grid; props (spear, sceptre, staff...)
// are authored as a separate hand-drawn layer and stamped over the body at a fixed spot.
(function () {
  const CAST = (window.CAST = window.CAST || {});

  // Stamp hand-drawn layers onto a base grid ('.' in a layer = leave the base pixel).
  function compose(w, h, base, layers) {
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
    const stamp = (rows, ox, oy) => rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const c = r[x];
        if (c === '.' || !g[y + oy] || x + ox < 0 || x + ox >= w) continue;
        g[y + oy][x + ox] = c === '_' ? '.' : c; // '_' erases
      }
    });
    stamp(base.rows, base.x || 0, base.y || 0);
    for (const l of layers || []) stamp(l.rows, l.x || 0, l.y || 0);
    return g.map((r) => r.join(''));
  }

  // Shared ramps
  const SKIN = { F: '#ffcc9c', S: '#ff8468', s: '#af584a', j: '#230c08' };
  const EYE = { W: '#ffffff', e: '#c7c7a3' };
  const BOOT = { Z: '#1b0f07', M: '#4d2c17', I: '#cb7b4b', J: '#e1b397' };

  // ---------------------------------------------------------------------------------------
  // Guardia soldier: steel kettle helm with a red crest, blue tabard with gold trim over
  // mail, steel pauldrons, brown gloves and boots, spear held upright in his left hand.
  // ---------------------------------------------------------------------------------------
  const GUARD_BODY = [
    '.......HH..HH',
    '......HoRHHRrH',
    '......HyoRHRrH',
    '.......AHoRrHA',
    '.....AAXHoRrHaAA',
    '....AXXzHRRrHxamA',
    '...AXXzXxHrHxxaamA',
    '...AXXXxxxaxxxaamA',
    '...AXXxxxxaxxaaamA',
    '.AXXXXXXXxxxxxxxaaaA',
    '.AAmmmmmmmmmmmmmmmAA',
    '...Axa' + 'ssSSSSSSss' + 'aaA',
    '...Axa' + 'Sjeksskejs' + 'aaA',
    '...Axa' + 'SjWgSSgWjs' + 'aaA',
    '...AxA' + 'SFFFsFFSSs' + 'AaA',
    '....AA' + 'jSSSjjSSj' + 'aAA',
    '......AjSsssjaA',
    '.....pAxaxaxaAp',
    '....pXxAYTUUUnAaap',
    '...pXXxAYTUYUUnAaaap',
    '...pAxxAYTYGYUnAaAp',
    '...paxApYTUnUUnpAaap',
    '..paxp.pYTUQUUnp.paxp',
    '..pxap.pBBBGBBBp.paap',
    '..pvvp.pbbbGbbbp.pvVp',
    '..pFFp.pYTUQUUnp.pFSp',
    '..pSSp.pYTUQUUnp.pSSp',
    '...pp.AxpYTUQUnpaA',
    '......AxapYUUnpaaA',
    '......AmaxpnnpxamA',
    '......KllLK.KLLdK',
    '......KXxaK.KxxaK',
    '.....KllLdK.KLlLdK',
    '.....KdlLdK.KdLLdK',
    '......KddkK.KddkK',
    '.....ZMIMMZ.ZMMIMZ',
    '.....ZMJIMZ.ZMIMMZ',
    '....ZMIMMMZ.ZMMIMMZ',
    '....ZIJIMMZ.ZMIIMMZ',
    '....ZZZZZZZ.ZZZZZZZ',
  ];
  // Spear: leaf blade, gold collar, wooden shaft; stamped at x=18..22.
  const GUARD_SPEAR = [
    '..A',
    '.AzA',
    '.AXA',
    'AXxaA',
    'AXxaA',
    'AXxaA',
    '.AxA',
    '.AaA',
    'AnYnA',
    ...Array(36).fill('.qwq'),
    '.AxA', '.AAA',
  ];
  // Right fist wrapped round the shaft (drawn over the spear).
  const GUARD_FIST = [
    'pvvVp',
    'pFFSp',
    'pSSsp',
    '.ppp',
  ];
  CAST.guard = {
    name: 'Guard', group: 'npcs', w: 24, h: 48,
    pal: Object.assign({}, SKIN, EYE, BOOT, {
      k: '#2a2010', g: '#6e4a22',
      // steel: outline, darkest, dark, mid, light, glint
      A: '#1e1e34', m: '#3a3a58', a: '#6e7090', x: '#a4a8c4', X: '#dce0ee', z: '#ffffff',
      // red crest
      H: '#4a0010', r: '#a02030', R: '#d43c3c', o: '#ff8c5c', y: '#ffc8a0',
      // tabard: outline, light, mid, dark; gold trim
      p: '#1a1430', T: '#6c9ce4', U: '#3c64b4', Q: '#24387a', Y: '#f8bc3c', n: '#b87818',
      // belt / gloves
      b: '#3a2010', B: '#6e4222', G: '#ffe070', v: '#8a5a2e', V: '#5e3a1c',
      // legs: dark hose
      K: '#0a0a14', l: '#8c8ca8', L: '#62627e', d: '#3e3e56',
      // spear shaft
      q: '#2a160e', w: '#a8743e',
    }),
    rows: compose(24, 48, { rows: GUARD_BODY, x: 0, y: 8 }, [
      { rows: GUARD_SPEAR, x: 18, y: 0 },
      { rows: GUARD_FIST, x: 17, y: 32 },
    ]),
  };

  // ---------------------------------------------------------------------------------------
  // King Guardia XXXIII: gold crown, brown hair and beard, ermine collar over a crimson
  // cape, blue robe with a gold sash, sceptre in his left hand.
  // ---------------------------------------------------------------------------------------
  const KING_BODY = [
  // 0123456789012345678901234567
    '........O...OO...O..........',
    '.......OLO.OLYO.OyO.........',
    '.......OLYOLYYyOYyO.........',
    '.......OLYYYEEYYyyO.........',
    '......HOLLYYYYYYyyOH........',
    '.....HHOOOOOOOOOOOOHH.......',
    '....H' + 'RhoRhoRhRRHRhHRh' + 'H......',
    '...HoRhH' + 'ShhhSShhhs' + 'HRhH......',
    '...HoRhH' + 'SjeksskejS' + 'HRhH......',
    '...HoRhH' + 'SjWgSSgWjs' + 'HRhH......',
    '...HoRhH' + 'SFFFsSFFSs' + 'HRhH......',
    '...HoRhR' + 'ooRRHhRRhh' + 'RhhH......',
    '....HRho' + 'RhojSSjHRh' + 'HRhH......',
    '.....H' + 'hoRhoRhRRHRhHR' + 'H.......',
    '..CIIH' + 'hoRhoRhRRHRhHR' + 'HIIC....',
    '.CIIKIH' + 'oRhoRhRRHRhH' + 'HIiKiC...',
    '.CIIIKiH' + 'RhoRhRRHRh' + 'HIiKiiC...',
    '.CqIKIIiH' + 'hoRhRRHR' + 'HiIIKiiC...',
    '.CqciiiiCH' + 'oRhRRH' + 'HCiiiiccC...',
    '.CqrcpTTp.pHRhHUQp.pUQpcrC..',
    '.CqrpTTUp.pTUYUQUp.pUQQprC..',
    '.CqrpTUUp.pTUUYQUp.pUUQprcC.',
    '.CqrpTUUp.pTUUQYUp.pUUQprcC.',
    '.CqrpIiip.pTUUQUYp.piiiprcC.',
    '.CqrpFFSp.pTUUQUUYpSSFprcC..',
    '.CqrpSSsp.pTUUQUUQpsSSprcC..',
    '.CqrcpppppTUIIiUQUQpppcrcC..',
    '.Cqrrcp' + 'TTUUTIIiUQUUQ' + 'pcrrcC..',
    '.Cqrrcp' + 'TTUUTIKiUQUUQ' + 'pcrrcC..',
    '.Cqrrcp' + 'TTUTUIIiUUQUQ' + 'pcrrcC..',
    '.Cqrrcp' + 'TTUTUIIiUUQUQ' + 'pcrrcC..',
    '.Cqrrcp' + 'TTUTUIIKUUQUQ' + 'pcrrccC.',
    'Cqqrrcp' + 'TUTUUIIiUUQUQ' + 'pcrrccC.',
    'Cqrrrcp' + 'TUTUUKIiUUQQQ' + 'pcrrccC.',
    'Cqrrrcp' + 'TUTUUIIiUQUUQ' + 'pcrrccC.',
    'Cqrrrcp' + 'TTUUUIIiUQUQQ' + 'pcrrccC.',
    'Cqrrccp' + 'YLYYYIIiYYyyy' + 'pccrrcC.',
    'CCccccppZMMZppZMMZppcccccCC.',
    '.CCCCCCCZZZZCCZZZZCCCCCCCC..',
  ];
  // Sceptre: gold orb with a sapphire, gold rod; stamped at x=18.
  const KING_SCEPTRE = [
    '.OOO.',
    'OLYyO',
    'OYBnO',
    'OyyyO',
    '.OYO.',
    '..O..',
    '.OyO.', '.OyO.', '.OYO.', '.OyO.', '.OYO.', '.OyO.', '.OyO.', '.OYO.',
    '.OyO.', '.OyO.', '.OYO.', '.OyO.', '.OyO.', '.OyO.',
  ];
  const KING_FIST = [
    'pSSFp',
    'pSFFp',
    'psSSp',
    '.ppp.',
  ];
  CAST.king = {
    name: 'King Guardia', group: 'npcs', w: 28, h: 45,
    pal: Object.assign({}, SKIN, EYE, BOOT, {
      k: '#2e1608', g: '#6e4222',
      // crown: outline, dark, mid, light; ruby
      O: '#5a2c00', y: '#c07818', Y: '#f8bc3c', L: '#fff4b0', E: '#e02838',
      // brown hair + beard: outline, dark, mid, light
      H: '#2e1608', h: '#5c3418', R: '#94602e', o: '#c8904c',
      // crimson cape: outline, dark, mid, light
      C: '#2c0410', c: '#6c1422', r: '#a02030', q: '#d4404a',
      // ermine: white, shade, tail spots
      I: '#ffffff', i: '#c4c4dc', K: '#1a1226', B: '#3c7ce0', n: '#bce0ff',
      // blue robe: outline, light, mid, dark
      p: '#10183a', T: '#5c90dc', U: '#2c4488', Q: '#1c2c5c',
    }),
    rows: compose(28, 45, { rows: KING_BODY, x: 0, y: 6 }, [
      { rows: KING_SCEPTRE, x: 20, y: 4 },
      { rows: KING_FIST, x: 19, y: 28 },
    ]),
  };

  // ---------------------------------------------------------------------------------------
  // Queen Leene: auburn up-do (bun) with a gold tiara, side locks, lilac gown with puffed
  // sleeves, gold bodice trim and a long flared skirt. Hands folded in front.
  // ---------------------------------------------------------------------------------------
  const LEENE_BODY = [
  // 012345678901234567890123
    '.........HHHHH..........',
    '........HoyRRhH.........',
    '.......HoyRRRhhH........',
    '.......HoRRRhhhH........',
    '........HHhhhHH.........',
    '.....HHHoRRRRhhHHH......',
    '....HoRROOLLYGOORhhH....',
    '...HoRROLYYBBYGGORRhH...',
    '...HoRoRRHOOOOOHhRRhH...',
    '..HoRRoRhoRRhoRRhRRhhH..',
    '..HoRHoRhRRhSRRhhRhHhH..',
    '..HoRHh' + 'SSSSSSSSSs' + 'hHRhH..',
    '..HoRHh' + 'jjeksskejj' + 'hHRhH..',
    '..HoRHh' + 'SjWgSSgWjs' + 'hHRhH..',
    '..HoRhh' + 'SFFFsSFFSs' + 'hhRhH..',
    '..HoRhH' + 'jSSSsjSSj' + 'hHhRhH..',
    '...HoRhHp' + 'jSSSsj' + 'pHhRhH...',
    '....HoRHHpsSSspHHRhH....',
    '...ppppp' + 'dFSSSscp' + 'ppppp...',
    '..pMMddp' + 'MdFSsccT' + 'pdcTTp..',
    '..pMdddp' + 'dMdYYcTT' + 'pcccTp..',
    '..pddccp' + 'ddcYLcTT' + 'pcTTDp..',
    '...pccTp' + 'dcdYYcTT' + 'pTTDp...',
    '....pppp' + 'dcddYcTT' + 'pppp....',
    '....pFSp' + 'dcdYYcTT' + 'pSFp....',
    '.....pFSp' + 'dcYYcT' + 'pSFp.....',
    '......pFSp' + 'cYYc' + 'pSFp......',
    '.......pSFFSsSSp........',
    '......pdcpsSsspTTp......',
    '.....pddcYYYYYYGTTTp....',
    '.....pdMdcdMMdcTcTDp....',
    '....pddMdcdMMdcTcTDTp...',
    '....pdMddcdMMddcTcTDp...',
    '...pddMdcddMMddcTcTDDp..',
    '...pdMddcdMMMddcTcTDDp..',
    '..pddMdcddMMMddcTcTTDDp.',
    '..pdMddcddMMMddcTTcTDDp.',
    '.pddMddcdMMMdddcTTcTDDDp',
    '.pdMdddcdMMMdddcTTcTDDDp',
    '.pYYYYYYYYYYYYYYYYGGGGGp',
    '..pppppppppppppppppppp..',
  ];
  CAST.leene = {
    name: 'Queen Leene', group: 'npcs', w: 24, h: 41,
    pal: Object.assign({}, EYE, {
      F: '#ffe4c4', S: '#f8b090', s: '#c47060', j: '#3a0c14',
      k: '#1c2c6c', g: '#5c90dc',
      // auburn hair: outline, dark, mid, light, glint
      H: '#4a0a18', h: '#a02030', R: '#d43c3c', o: '#f06c4c', y: '#ffb070',
      // tiara
      O: '#7a4a00', Y: '#f8bc3c', L: '#fff4b0', B: '#5c90dc', G: '#c08818',
      // gown: outline, highlight, light, mid, dark
      p: '#3a1850', M: '#fbeaff', d: '#e0c0fc', c: '#bc84e4', T: '#9058c0', D: '#643090',
    }),
    rows: LEENE_BODY,
  };

  // ---------------------------------------------------------------------------------------
  // Kino: shaggy brown mane, tan skin, fur tunic over one shoulder with a rope belt, bare
  // arms and legs, fur foot-wraps; a knobbly club held upright in his left hand.
  // ---------------------------------------------------------------------------------------
  const KINO_BODY = [
  // 012345678901234567890123
    '........H...............',
    '.......HyH....H.........',
    '..H....HyRH..HRH...H....',
    '..HyH..HoRhHHyRH..HRH...',
    '...HoH.HoRhHoRhH.HRhH...',
    '.H.HyRHHyRhHoRhHHyRhH...',
    'HoH.HoRHoRhHoRhHoRhhHH..',
    '.HoHHoRhHoRhHoRhHoRhHRH.',
    '..HoRHoRhHyRhHyRhHRhHRhH',
    '.HoRHoRhHoRhHoRhHoRhHhhH',
    '..HoRHoRhHRhHoRhHRhhHhH.',
    '..HoRHh' + 'SShSSSShSs' + 'hRhH...',
    '..HoRHh' + 'SjeksskejS' + 'hRhH...',
    '...HoRh' + 'SjWgSSgWjs' + 'hRH....',
    '...HRhH' + 'sSFFsSFFSs' + 'HhH....',
    '....HHH' + 'jSSSjjSSj' + 'HH.....',
    '.......HjSSsssjH........',
    '........jsSSsj..........',
    '.....ppjSSSSSsjpTp......',
    '....pSFFSSSSSSpTUUp.....',
    '...pSFFSSSSSSpTUUQQp....',
    '...pFFSpSSSSpTUKUQQp....',
    '..pFFSppTTSpTUUUQQpSp...',
    '..pFSp.pTUpTUKUUQQpSSp..',
    '..pFSp.pTUTUUUQKUQpSFp..',
    '..pSSp.pTUUKUUQUQQpSSp..',
    '..pFFp.pTUUUQUKUQQpFSp..',
    '..pSSp.pbBbbBbbBbbpSSp..',
    '..pFFp.pTUKUUQUUKQpFFp..',
    '...pp.pTUUQTUUQUUQQpp...',
    '......pTpUQpTUQpUQp.....',
    '......ppSFSp.pFSSpp.....',
    '.......pSFSp.pFSSp......',
    '.......pSFSp.pFSsp......',
    '......pSFFSp.pFSSsp.....',
    '......pSSFsp.pSSssp.....',
    '.......psSsp.psSsp......',
    '......pTTUQp.pTUQQp.....',
    '.....pTUKUQp.pTUKUQp....',
    '.....pTTUUQp.pTUUQQp....',
    '....pTUUQUQQppTUUQUQp...',
    '....ppppppppp.pppppppp..',
  ];
  // Club: fat knobbly head, tapering wooden handle; stamped at x=17.
  const KINO_CLUB = [
    '..qqq..',
    '.qLwwq.',
    'qLwwWWq',
    'qwwWwWq',
    'qLwWWWq',
    'qwwWWqq',
    '.qwWWq.',
    '.qwWq..',
    '.qwWq..',
    '..qWq..',
    '..qwq..',
    '..qWq..',
    '..qwq..',
    '..qWq..',
    '..qwq..',
    '..qWq..',
    '..qwq..',
    '..qWq..',
  ];
  const KINO_FIST = [
    'pSFFp',
    'pSSFp',
    'psSSp',
    '.ppp.',
  ];

  CAST.kino = {
    name: 'Kino', group: 'npcs', w: 24, h: 44,
    pal: Object.assign({}, EYE, {
      F: '#f4b884', S: '#d48858', s: '#9a5434', j: '#2a0e06',
      k: '#3a1c08', g: '#b06a28',
      // brown mane: outline, dark, mid, light, glint
      H: '#2a1006', h: '#5a3418', R: '#8a5a2e', o: '#b8844a', y: '#e0b070',
      // fur: outline, light, mid, dark, spots
      p: '#3a2010', T: '#ecd08a', U: '#c89c50', Q: '#8a6428', K: '#5a3a18',
      // rope belt
      b: '#6e4a22', B: '#c8a060',
      // club wood: outline, light, mid, dark
      q: '#2a1408', L: '#d8a868', w: '#a8743e', W: '#6e4a22',
    }),
    rows: compose(24, 44, { rows: KINO_BODY, x: 0, y: 2 }, [
      { rows: KINO_CLUB, x: 17, y: 12 },
      { rows: KINO_FIST, x: 17, y: 28 },
    ]),
  };

  // ---------------------------------------------------------------------------------------
  // Elder of the Last Village: peaked grey-brown hood with a fur rim, bushy white brows,
  // closed eyes, long white beard spilling over the chest, hunched cloak, gnarled staff
  // with a blue crystal held in his right hand.
  // ---------------------------------------------------------------------------------------
  const ELDER_BODY = [
  // 012345678901234567890123
    '..........pp............',
    '.........puUp...........',
    '........puuUQp..........',
    '.......puuUUUQp.........',
    '......puuUUUUQQp........',
    '.....puuUUUUUUQQp.......',
    '....puuUUUUUUUUQQp......',
    '....puIIiIIiIIiiIQp.....',
    '...puIi' + 'WWVSSWWV' + 'iIQp.....',
    '...puIS' + 'jjSSSjjs' + 'SiQp.....',
    '...puIF' + 'FFSssSFs' + 'SiQp.....',
    '...pUIw' + 'wWWjjWWV' + 'wiQp.....',
    '..puUiw' + 'wWVWWVWV' + 'VHQQp....',
    '.puuUUHw' + 'wWVWWVV' + 'HpQQQp...',
    'puuUUUpHw' + 'wVWWVV' + 'HpUQQDp..',
    'puIIUUUpHw' + 'wWWVH' + 'pUUQDDp..',
    'pIiiUUUUpHw' + 'WWVH' + 'pUUQQDDp.',
    'puiiUUUUUpHwWVHpUUUQQDDp',
    '.puUUUUUUUpHWHpUUUQQQDDp',
    '.puUUUUUUUUpHpUUUUQQDDp.',
    '..puUUUQuUUUUQuUUUQQDDp.',
    '..puUUQuUUUUUQuUUUQQDDp.',
    '..puuUQuUUUUQuUUUQQQDDp.',
    '..puUUQuUUUUQuUUUQQDDDp.',
    '..puuQuUUUUUQuUUQQQDDDp.',
    '..puUQuUUUUQuUUUQQQDDDp.',
    '..puuQuUUUUQuUUQQQDDDDp.',
    '..puUQuUUUUQuUUUQQDDDDp.',
    '..pIIiIIiIIiIIiIIiiiiip.',
    '...ppppcdpppppcdpppppp..',
    '......pZMMZ..pZMMZ......',
    '......ZZZZZZ.ZZZZZZ.....',
  ];
  // Staff: blue crystal lashed to a gnarled branch; stamped at x=0.
  const ELDER_STAFF = [
    '..qq.',
    '.qXxq',
    '.qXxq',
    '.qxxq',
    '.qnq.',
    'qLnq.',
    'qlq..',
    'qLlq.',
    '.qlq.',
    '.qLlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qlq',
    '..qnq',
  ];
  const ELDER_HAND = [
    'pSFFp',
    'pFFSp',
    '.pSsp',
    '..pp.',
  ];

  CAST.elder = {
    name: 'Elder', group: 'npcs', w: 24, h: 40,
    pal: Object.assign({}, SKIN, BOOT, {
      // hood + cloak: outline, light, mid, dark, darkest; fur rim
      p: '#241a22', u: '#a8927e', U: '#7e6a5c', Q: '#5a4a44', D: '#3a2e2c', I: '#f0e6d0', i: '#bcae96',
      // white beard + brows: line, white, light, shade
      H: '#5a5a78', w: '#ffffff', W: '#dce0ee', V: '#a4a8c4',
      // under-robe
      c: '#6e7090', d: '#3e3e56',
      // staff: outline, light, mid, dark knot; crystal
      q: '#2a160e', L: '#c89858', l: '#94602e', n: '#5a3818', X: '#e4f4ff', x: '#6ca0e0',
    }),
    rows: compose(24, 40, { rows: ELDER_BODY, x: 0, y: 8 }, [
      { rows: ELDER_STAFF, x: 0, y: 6 },
      { rows: ELDER_HAND, x: 1, y: 22 },
    ]),
  };

  // ---------------------------------------------------------------------------------------
  // Gaspar, the Guru of Time: dark bowler with a red band, white side tufts and a big
  // curled moustache, dozing eyes, mustard coat with a white collar, brown trousers,
  // leaning on a crook cane.
  // ---------------------------------------------------------------------------------------
  const GASPAR_BODY = [
  // 0123456789012345678901
    '.......AAAAAA.........',
    '.....AAvLLvvVAA.......',
    '....AvLLvvvvvVVA......',
    '....AvLvvvvvvVVA......',
    '....ArRRRRRRrrrA......',
    '..AAvvvvvvvvvvVVAA....',
    '..AVVVVVVVVVVVVVVA....',
    '...AhhwWWSSwWWshHA....',
    '...hhHSsjjSSjjssHhH...',
    '...AhHSSSSFSSSSsHhA...',
    '....HSFFFSsSSFFsSH....',
    '...wwwwWWwssWWwwWWm...',
    '..wmwWWWWmSSmWWWWmWm..',
    '...m..jSSSjjSSj.m.....',
    '.......jSSsssj........',
    '........jsSsj.........',
    '......pIIjsjIIp.......',
    '....ppTIIIpIIIUQpp....',
    '...pTTUpIIpIIpUUQQp...',
    '..pTTUUUpIYIpUUUQQDp..',
    '..pTUUpUTpIpTUQpQQDp..',
    '..pTUp.pTUnUUQp.pQDp..',
    '..pUUp.pTUUUUQp.pQDp..',
    '..pTUp.pTUnUUQp.pQDp..',
    '..pUUp.pTUUUUQp.pDDp..',
    '..pFFp.pTUnUUQp.pSSp..',
    '..pSSp.pTUUUUQp.pSsp..',
    '...pp.pTTUUUUQQp.pp...',
    '......pTUUQpUUQp......',
    '......pTUUpppQQp......',
    '......KllLK.KLdK......',
    '......KlLdK.KLdK......',
    '......KLLdK.KLdK......',
    '.....ZMIMMZ.ZMIMZ.....',
    '....ZMJIMMZ.ZMMIMZ....',
    '....ZZZZZZZ.ZZZZZZ....',
  ];
  // Crook cane in his left hand; stamped at x=15.
  const GASPAR_CANE = [
    '.qqqq.',
    'qCcccq',
    'qcqqCq',
    '.q.qcq',
    '...qCq',
    '...qcq', '...qCq', '...qcq', '...qCq', '...qcq', '...qCq', '...qcq',
    '...qqq',
  ];
  const GASPAR_HAND = [
    'pFFp',
    'pSsp',
    '.pp.',
  ];
  CAST.gaspar = {
    name: 'Gaspar', group: 'npcs', w: 22, h: 40,
    pal: Object.assign({}, SKIN, BOOT, {
      // bowler: outline, dark, mid, light; red band
      A: '#140c1c', V: '#241a30', v: '#3e3048', L: '#686088', r: '#8a1828', R: '#d43c3c',
      // white hair / moustache: line, shade, white
      H: '#8a8ca8', h: '#e4e8f0', m: '#6e7090', W: '#c8cce0', w: '#ffffff',
      // collar
      I: '#fff8e8',
      // mustard coat: outline, light, mid, dark, darkest; buttons
      p: '#3a2410', T: '#f4d888', U: '#dcb060', Q: '#b88440', D: '#8a5a28', n: '#6e4222', Y: '#a02030',
      // trousers
      K: '#1a0e08', l: '#8a6a4a', L: '#6a4a30', d: '#4a3020',
      // cane
      q: '#1e0e06', C: '#a86c3a', c: '#6e4222',
    }),
    rows: compose(22, 40, { rows: GASPAR_BODY, x: 0, y: 4 }, [
      { rows: GASPAR_CANE, x: 15, y: 27 },
      { rows: GASPAR_HAND, x: 17, y: 28 },
    ]),
  };

  // ---------------------------------------------------------------------------------------
  // Millennial Fair showman: straw boater with a navy band, brown hair, rosy cheeks,
  // navy bow tie, red vest with gold buttons over a white shirt, blue trousers.
  // ---------------------------------------------------------------------------------------
  const FAIR_A_BODY = [
  // 0123456789012345678901
    '......OOOOOOOOO.......',
    '.....OLLLyyyynnO......',
    '.....OLyyyyyynnO......',
    '.....OJJJJJJJJJO......',
    '..OOOLLyyyyyyynnnOO...',
    '.OLLLyyyyyyyyyynnnnO..',
    '..OOOOOOOOOOOOOOOOO...',
    '....HRhHhhhhhhhHhRH...',
    '....HRH' + 'sSSsSSsS' + 'HRhH...',
    '....HRH' + 'jeksskej' + 'HRH....',
    '.....HS' + 'jWgSSgWj' + 'SH.....',
    '.....Hs' + 'PFFsFFPs' + 'H......',
    '......j' + 'SSSjjSS' + 'j.......',
    '......p' + 'IjsssjI' + 'p.......',
    '.....pVIBBjBBIVp......',
    '....piVVIBBBIVVXip....',
    '...pIivvVIIIVVXXiip...',
    '...pIipvVIYIVXXpiip...',
    '...pIIppvVIIVXXppiIp..',
    '..pIIp.pvVIYIVXp.piIp.',
    '..pIip.pvvVIVXXp.piip.',
    '..pIip.pvvVYVXXp.piip.',
    '..pSFp.pbbbYbbbp.pFSp.',
    '..pSSp.puttuTtTp.pSSp.',
    '...pp.putttTttTTp.pp..',
    '......puttTptTTTp.....',
    '......puttTptTTTp.....',
    '......putTTptTTTp.....',
    '......puttTptTTTp.....',
    '......puttTptTTTp.....',
    '......putTTptTTTp.....',
    '......puttTptTTTp.....',
    '......pttTppptTTp.....',
    '.....ZMIMMZ.ZMMIMZ....',
    '....ZMJIMMZ.ZMIMMMZ...',
    '....ZZZZZZZ.ZZZZZZZ...',
  ];

  CAST.fairgoer = {
    name: 'Showman', group: 'npcs', w: 22, h: 37,
    pal: Object.assign({}, SKIN, EYE, BOOT, {
      k: '#1c2c6c', g: '#5c90dc', P: '#ff6a6a',
      // straw boater: outline, light, mid, dark; navy band
      O: '#5a3a10', L: '#fff0b0', y: '#e8c060', n: '#b0803c', J: '#2c4488',
      // brown hair
      H: '#2e1608', h: '#6e4222', R: '#94602e',
      // shirt: white, shade; bow tie
      I: '#f8f8ff', i: '#b8bcd4', B: '#2c4488',
      // red vest: light, mid, dark; gold buttons
      v: '#f06050', V: '#c02838', X: '#781828', Y: '#f8bc3c',
      // body outline, belt
      p: '#1c1024', b: '#3a2010',
      // blue trousers: light, mid, dark
      u: '#6c9ce4', t: '#3c64b4', T: '#24387a',
    }),
    rows: compose(22, 37, { rows: FAIR_A_BODY, x: 0, y: 1 }, []),
  };

  // ---------------------------------------------------------------------------------------
  // Fair girl: blonde ponytail with a red ribbon, pink dress with puff sleeves and a white
  // collar, white socks and red shoes; her raised hand holds a blue balloon on a string.
  // ---------------------------------------------------------------------------------------
  const FAIR_B_BODY = [
  // 0123456789012345678901
    '........HHHHH.........',
    '......HHoRRRRhHH......',
    '.....HoRoRRRRRhhH.....',
    '..HHHoRRoRRRRRhhhH....',
    '.HrrHoRoRRoRRRhRhhH...',
    '.HrRrHoRHoRRhoRhhRhH..',
    '..HrHRHoRhHRRhhRHhRH..',
    '..HoRHRh' + 'SSSSSSSSs' + 'HRhH.',
    '..HoRHh' + 'jjeksskejj' + 'hRH..',
    '..HoRHh' + 'SjWgSSgWjs' + 'hRH..',
    '..HRhHH' + 'SPFFsFFPSs' + 'HhH..',
    '...HhH.' + 'jSSSsjSSj' + 'HH....',
    '...HH...' + 'jSSSsj' + '........',
    '........pIIsSIIp......',
    '.....ppdMIIIIIIcpp....',
    '....pMMdpcIIIcTpTTp...',
    '....pMddpdccccTpTDp...',
    '.....pppdcdcccTTppFp..',
    '....pFSpdMdcccTTpSSp..',
    '....pSSpddcccTTTppp...',
    '....pSsprrrrrrrrp.....',
    '.....ppdMdcccccTTp....',
    '.....pdMddcccTcTTp....',
    '....pdMdddcccTcTTDp...',
    '....pdMddcccTTcTTDp...',
    '...pdMddcccTTcTTTDDp..',
    '...pIIIIIIIIIIIIIIIp..',
    '....ppppIIpppIIpppp...',
    '.......pIIp.pIIp......',
    '.......pIip.pIip......',
    '......ZrrrZ.ZrrrZ.....',
    '......ZZZZZ.ZZZZZ.....',
  ];
  // Balloon on a string, tied to her raised right hand; stamped at x=13.
  const FAIR_B_BALLOON = [
    '...AAAA..',
    '..AXxxxA.',
    '.AXXxxxaA',
    '.AXxxxxaA',
    '.AxxxxxaA',
    '.AxxxxaaA',
    '..AxxaaA.',
    '...AaaA..',
    '....AA...',
    '....l....',
    '....l....',
    '...l.....',
    '...l.....',
    '...l.....',
    '....l....',
    '....l....',
    '.....l...',
    '.....l...',
    '.....l...',
    '....l....',
    '....l....',
    '....l....',
    '.....l...',
    '.....l...',
    '.....l...',
    '.....l...',
    '.....l...',
    '.....l...',
    '.....l...',
  ];

  CAST.fairgoer_b = {
    name: 'Fair girl', group: 'npcs', w: 22, h: 44,
    pal: Object.assign({}, EYE, {
      F: '#ffe0c0', S: '#f8a888', s: '#c06858', j: '#3a0c14', P: '#ff7a8a',
      k: '#1c3a7c', g: '#5c9cec',
      // blonde hair: outline, dark, mid, light; red ribbon
      H: '#6a3008', h: '#d88420', R: '#fcd058', o: '#fff4b0', r: '#d43c3c',
      // pink dress: outline, light, mid, shade, dark
      p: '#4a1030', M: '#ffd4e8', d: '#f4a0c4', c: '#e0709c', T: '#b04880', D: '#7a2858',
      // socks, shoes
      I: '#ffffff', i: '#c8c8e0', Z: '#3a0810',
      // balloon: outline, highlight, mid, shade; string
      A: '#102050', X: '#c4e4ff', x: '#5c90dc', a: '#2c4488', l: '#e4e8f0',
    }),
    rows: compose(22, 44, { rows: FAIR_B_BODY, x: 0, y: 12 }, [
      { rows: FAIR_B_BALLOON, x: 13, y: 0 },
    ]),
  };

  // ---------------------------------------------------------------------------------------
  // Fair kid: red/yellow/blue propeller beanie, black hair, freckled grin, yellow shirt
  // with green stripes, blue shorts, white socks and red sneakers.
  // ---------------------------------------------------------------------------------------
  const FAIR_C_BODY = [
  // 01234567890123456789
    '..AAAAA..AAAA.......',
    '.AYYYYnAmAYYYnA.....',
    '..AAAAAAmAAAAA......',
    '.......AmA..........',
    '.....AAvYYyAA.......',
    '....AvvvYYyyyA......',
    '...AvLvvYLYyyaA.....',
    '...AvvvvYYYyyaA.....',
    '..AvvvvvYYYyyyaA....',
    '..AVVVVVnnnaaaaA....',
    '..HhRH' + 'SSSSSSSS' + 'HhH...',
    '..HRH' + 'jeksSSkej' + 'hH....',
    '..HRH' + 'jWggSSgWj' + 'HH....',
    '..HhH' + 'sFFFsSFFs' + 'H.....',
    '...HH' + 'SPsSSSSPs' + 'H.....',
    '.....j' + 'SjWWWjS' + 'j......',
    '......j' + 'SSsss' + 'j.......',
    '.......pSSsp........',
    '....ppcccCccDpp.....',
    '...pcccccCcDDDDp....',
    '...pCCpCCCCCpCCp....',
    '..pccp.pcccDp.pDDp..',
    '..pCCp.pCCCCp.pCCp..',
    '..pFFp.pccDDp.pFSp..',
    '..pSSp.pCCCCp.pSSp..',
    '...pp.pbbbbbbbp.pp..',
    '......puttTtTTp.....',
    '......putTptTTp.....',
    '......ppp...ppp.....',
    '.......pSp..pSp.....',
    '.......pSp..psp.....',
    '.......pIp..pIp.....',
    '......prIIp.prIp....',
    '.....prrIrrprrIrp...',
    '.....pIIIIIpIIIIp...',
    '.....ppppppppppppp..',
  ];

  CAST.fairgoer_c = {
    name: 'Fair kid', group: 'npcs', w: 20, h: 36,
    pal: Object.assign({}, SKIN, EYE, {
      k: '#2a1a08', g: '#7a4a22', P: '#e8705c',
      // beanie: outline, red light/mid/dark, yellow, blue, blue dark; propeller
      A: '#1a1226', L: '#fff4b0', v: '#e84c4c', V: '#8a1c28', Y: '#fce068', n: '#c89828',
      y: '#5c90dc', a: '#2c4488', m: '#9294b0',
      // black hair
      H: '#0a0612', h: '#2a2038', R: '#52526e',
      // striped shirt: outline, yellow, yellow dark, green stripe
      p: '#1c1024', c: '#fce068', D: '#d0a030', C: '#48a040',
      // belt, shorts
      b: '#3a2010', u: '#6c9ce4', t: '#3c64b4', T: '#24387a',
      // socks, sneakers
      I: '#ffffff', r: '#d43c3c',
    }),
    rows: compose(20, 36, { rows: FAIR_C_BODY, x: 0, y: 0 }, []),
  };

  // ---------------------------------------------------------------------------------------
  // Fair grandmother: silver hair in a bun, smiling closed eyes, rosy cheeks, purple shawl
  // with a gold brooch, teal dress with buttons, hands folded, a little stooped.
  // ---------------------------------------------------------------------------------------
  const FAIR_D_BODY = [
  // 0123456789012345678901
    '........HHHH..........',
    '.......HoRRhH.........',
    '.......HRoRhH.........',
    '......HHhhhhHH........',
    '.....HHoRRhRhhHH......',
    '....HoRRhoRRhRRhH.....',
    '...HoRhoRRhRRRhRhH....',
    '..HoRhoRRhRRRhRRhhH...',
    '..HRh' + 'SFFFFFFFFs' + 'hhH....',
    '..HRh' + 'FhhFFFFhhs' + 'hhH....',
    '..HRh' + 'FsjjFFjjss' + 'hhH....',
    '...HH' + 'SPFFsSFFPs' + 'HH.....',
    '....H' + 'jSSSjjSSj' + 'H......',
    '......jSSsssj.........',
    '....pppmsSSsmpp.......',
    '...pMMmmpYYpmmiip.....',
    '..pMMmmMmpYpmmiiiXp...',
    '..pMmmMmmmimmmiiiXp...',
    '..pMmMmmmmmmmiiiXXp...',
    '..pmMmmpmmmmmiipXXp...',
    '..pmmmp.pmmmiip.pXp...',
    '...pFFSp.pmip.pSFp....',
    '....pFFSSppppSSFFp....',
    '....pdpSSSSSSSSpDp....',
    '....pLdcpcYcpcdDp.....',
    '....pLdcccccccdDp.....',
    '...pLLdcccYcccdDDp....',
    '...pLdcccccccdcDDp....',
    '...pLdccccYcccdDDp....',
    '..pLLdcccccccdcDDDp...',
    '..pLdccccccYccdcDDp...',
    '..pLLdccccccccdcDDDp..',
    '..pLddddddddddddDDDp..',
    '...pppppZZZpZZZpppp...',
    '.......ZZZZ.ZZZZ......',
  ];

  CAST.fairgoer_d = {
    name: 'Grandmother', group: 'npcs', w: 22, h: 38,
    pal: Object.assign({}, SKIN, {
      P: '#f07878',
      // silver hair: outline, dark, mid, light
      H: '#4e4e6c', h: '#8e90ac', R: '#c4c8dc', o: '#ffffff',
      // purple shawl: outline, light, mid, dark, darkest; brooch
      p: '#241034', M: '#d0a0f4', m: '#9a5cc8', i: '#6c3094', X: '#44185e', Y: '#fce068',
      // teal dress: light, mid, shade, dark
      L: '#6ccac0', c: '#3a9490', d: '#2a7470', D: '#1a4a4e',
      // shoes
      Z: '#2a2038',
    }),
    rows: compose(22, 38, { rows: FAIR_D_BODY, x: 0, y: 3 }, []),
  };
})();