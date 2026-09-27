// Hand-pixelled cast sprites (party). See CAST_SPEC.md.
(function () {
  const CAST = (window.CAST = window.CAST || {});

  // ---- Frog ------------------------------------------------------------------------
  CAST.frog = {
    name: 'Frog', group: 'party', w: 26, h: 38,
    pal: {
      // frog skin: outline, dark, mid, light, highlight; mouth; jaw light/shade
      O: '#10301a', D: '#2f6a2a', G: '#4f9a34', g: '#7cc23c', h: '#b8e870', m: '#0c2412',
      t: '#f0e8a8', T: '#c8b868',
      // eyes
      W: '#ffffff', v: '#b8c8d8', k: '#101010',
      // armour: outline, light, mid, dark; gold trim
      a: '#3a2410', A: '#f4dc98', B: '#d4a858', C: '#9a6634', c: '#6a3c1c', Y: '#ffd23a', y: '#c0801c',
      // cape: outline, light, mid, dark
      q: '#2a1440', L: '#d8b0f8', P: '#a878d8', V: '#6c40a0',
      // belt
      b: '#3a1c0c', n: '#6a3a1a',
      // boots
      Z: '#1b0f07', E: '#3a2010', M: '#6a3c1c', I: '#9a5e2e', J: '#d09060',
      // sword: outline, light, mid, dark, grip
      K: '#0c1428', x: '#f4f8ff', X: '#a8b8d8', u: '#58688c', r: '#5a2a18',
    },
    rows: [
      '....OOOO......OOOO',
      '...OhhgGO....OhgGDO',
      '...OGGGDO....OGGDDO',
      '...OWWkWOOOOOOWkWvO',
      '..OhOWkWOhhggOWkvOGO',
      '.OhhgOOOghhgggOOOGGDO',
      '.OhhgggggggggGggGGGDO',
      '.OhmgggGgggggggggGmDO',
      '..OGmmmmmmmmmmmmmmDO',
      '..OggtttttttttTTTGDO',
      '.qqOgttttttttTTTGDOqq',
      'qLLqOOTTTTTTTTTTOOqVVq',
      'qLPqaaOOOOOOOOOOaaqVVq',
      'qLqaBCayYYYYYyyaCCaqVq',
      'qLaBCCanbAABBCCaCCcaVq',
      'qPaCcaaAnbABBCCaaccaVq',
      'qPOgGOaAAnbBBCCaOGDOVq',
      'qPOhGOaABAnbBCCaOGDOVq',
      'qOgGOVaABBBnbCCaVOGDOq',
      'qOhGOVVaABBBnbaVVOGDOq',
      'qOgGOVabnbYybbbaVVOGDO',
      'OhgGOVaABABBBCCaVVOhggGO',
      'OgGDOaABBCBBCCCCaVOgGGDO',
      'qOOOVaCBCaCBCaCCaVqOrrO',
      'qVVVVqaaaaaaaaaaqKYYYYYyK',
      '.qqVVqOhgGO.OgGDOqKWXXuK',
      '....qqOhgGO.OgGDO.KxXXuK',
      '.....ZIJIMZ.ZIMMEZKxXXuK',
      '.....ZEEEEZ.ZEEEEZKxXXuK',
      '......ZIMEZ.ZIMEZ.KxXXuK',
      '......ZJMEZ.ZIMEZ.KxXXuK',
      '......ZIMEZ.ZIMEZ.KxXXuK',
      '......ZIMEZ.ZIMEZ.KxXXuK',
      '.....ZIJMEZ.ZIMMEZ.KxXuK',
      '....ZIJIMEZ.ZIIMEEZKXuK',
      '....ZMMMMEZ.ZMMMEEZ.KK',
      '....ZZZZZZZ.ZZZZZZZ',
    ],
  };
})();
(function () {
  const CAST = window.CAST;
  // ---- Ayla ------------------------------------------------------------------------
  CAST.ayla = {
    name: 'Ayla', group: 'party', w: 28, h: 43,
    pal: {
      // mane: outline, dark, mid, light, glint
      H: '#5a2604', d: '#9a4a0e', r: '#e09a2c', R: '#f6c440', o: '#fde47a', y: '#fffad0',
      // skin: light, mid, shade, lines/outline
      F: '#ffd4a4', S: '#f49a70', s: '#b85c48', j: '#4a1a0c',
      // eyes / teeth
      W: '#ffffff', e: '#d8d0b0', k: '#0c432f', g: '#1fab77',
      // fur: outline, light, mid, dark, spots
      p: '#3a1a08', A: '#fae6a8', B: '#e4b464', C: '#b47a34', n: '#6e3c14',
    },
    rows: [
      '...........H.....H',
      '......H...HoH...HoH',
      '......HoH.HoRH.HoRrH.H',
      '..H..HoRHHoRRdHoRRdHHrH',
      '...HHyRRdoRRRdoRRRrrdRrH',
      '...HrdoRRRRRdoRRRRrrdRrrH',
      '..HordoRRRRdoRRyRRRRrdRrrH',
      '.HordodoRRdoRRRRRRRRRrdRrrH',
      'HoordodoRdoRRRRdoRRRdRrdRrrH',
      '.HHHrdoRRyRRRRdoRRRRdRrdRrrH',
      '..HordoRdRRRdoRRdoRRRdRrdRrH',
      '.HordordoRdoRRdoRRdoRrdRHHH',
      'HoordodoRHFFdFSdSsHdRRrdRrH',
      '.HHHrrdoHSjekSSkejsHdRRdRrrH',
      '..HordoRHSjWgSSgWjsHrdRrdRrH',
      '.HoRrdodHSFFSFFSSSsHrdRrHHH',
      'HoordordHSSjWWWWjssHRrdRrdH',
      '.HHHrrdoRHsSjjjjSsHRrdRrdrH',
      '..HoRrdoRdHjSSSsjHrHrRrdRdrH',
      '.HoRrdoRHRHjFSSsjHRRrrdRHH',
      'HoorrdoHdjFFSSSSSsjrHdrrrH',
      '.HHHrdHjFFFFSSSSSSssjHrrH',
      '..HodjFFjpAABBBBCCpjSsjHrH',
      '..HrHjFSjpABnBBnBCpjSsjHrH',
      '...H.jFSjpCBpBCCpCpjSsjH',
      '....jSFj.jFFSSSSssj.jSsj',
      '....jSSj.jFFSjSSssj.jssj',
      '....pABp.pAABBBBCCp.pBCp',
      '...jFFSjpABnBBBCnCCpjSSsj',
      '...jFSsjpABBBnBBCCCpjSssj',
      '....jjjpABnBBBBBCnCCpjjj',
      '......pBBCBBCBCCCCCCCp',
      '......pCpBCpCCpCpCCpCp',
      '.......p.pp.pp.p.pp.p',
      '........jFFSj..jSSsj',
      '........jFFSSj.jSSssj',
      '........jFSSj..jSSsj',
      '........jFSsj..jSssj',
      '........jFFSj..jSSsj',
      '.......pAABCp..pBBCCp',
      '.......pABnBCp.pBnCCp',
      '......pABBBCCp.pBCCCCp',
      '......pppppppp.pppppppp',
    ],
  };
})();
(function () {
  const CAST = window.CAST;
  // ---- Magus -----------------------------------------------------------------------
  CAST.magus = {
    name: 'Magus', group: 'party', w: 38, h: 50,
    pal: {
      // hair: outline, dark, mid, light, glint
      H: '#0e1440', b: '#26449a', B: '#4574cc', c: '#78aaee', C: '#c4e2ff',
      // skin: light, mid, shade, lines
      F: '#e2dcf6', S: '#b4aadc', s: '#7a6eae', j: '#241844',
      // eyes
      W: '#ffffff', e: '#e0202c',
      // cape outside: outline, dark, mid, light; lining: dark, mid, light
      q: '#10061c', v: '#2a1240', V: '#482266', P: '#6e3c96', l: '#7a1426', L: '#c42c3c', M: '#f0645a',
      // robe: dark, mid, light; gloves/boots
      d: '#26223c', D: '#433e62', G: '#686488', k: '#140e20', K: '#34304a',
      // scythe: outline, light, mid, dark, haft, gold
      O: '#080c18', x: '#f2f6ff', X: '#aebad6', u: '#667494', n: '#7a4c2a', Y: '#ffd23a', y: '#b8801c',
    },
    rows: [
      '.........HHHHHH..........OOOOOO',
      '.......HHcccBBBHH.......OxxxxXXOOO',
      '......HcCccBBBBbbH......OxXXXXXXuuOO',
      '.....HcCcBHcBBHBbbH.....OYYOOOuuuXXXO',
      '....HccBBHcBBbHBbbbH....OyYO..OOOuXXO',
      '....HcBBHcBBbbHBBbbH.....OnO.....OuXXO',
      '...HcBBHcBBbHcBbHBbbH....OnO......OuXO',
      '...HBBHcBbHcBbHcBbHbbH...OnO......OuXO',
      '...HBbHcBHcBbHcBbHbbbH...OnO.......OXO',
      '.j.HBbHBbFcBbScbbHbbH.j..OnO.......OuO',
      'jFjHBbHFbFSbSSSbsHbbHjSj.OnO........O',
      '.jFFSjHSjjSSSSjjsHjSsSj..OnO',
      '..jSsjHSWejSSjeWsHjssj...OnO',
      'q..HBbHsFFSSsSSSsHbbH..q.OnO',
      'qLqHBbHssSjjjSssHbbbHqlq.OnO',
      'qLLHBbbHjSSSsssjHbbbHllq.OnO',
      'qLLlHbbbHjjjjjjHbbbHllVq.OnO',
      'qPLLlHbbbHqdGDqHbbbHllVq.OnO',
      'qPLLLlHbbHqdGGDDqHbHlllVvOnO',
      'qPPLLLlHHqdDGGGDDqHHllVVvOnO',
      'qPVVLLlqqdDGGGDDDdqlVVVvvOnO',
      'qPVVVLqdDGGGGDDDdqDdqVVvvOnO',
      'qPVVVLqdGGGDDDDDdqGDdqVvvOnO',
      'qPVVVLqdGGDDDdDDdlqGDdqvvOnO',
      'qPVVVLqdGDDDDdDddlLqGDdqvOnO',
      'qPVvVLqdGDDDDdDddlLVqGDdqOnO',
      'qPVvVLqdGDDDDdDddlLVvqDqKGKkq',
      'qPVvVLqdGDDDDdDddlLVvvqKGKKkq',
      'qPVvVLqkkYykkkkkqlLVvVqKKkKkkq',
      'qPVvVLqdGDDDDdDDdqLVvVvqkkkkq',
      'qPVVvLqdGDDDDdDDddqLVvVvqOnO',
      'qPVVvLqdGDDDqdDDddqLVvVvqOnO',
      'qPVVvLqqqqqqqqqqqqqLVvVvqOnO',
      'qPVVvLq.qGDdqqDddq.LVVvvqOnO',
      'qPVVvLq.qGDdqqDddq.LVVvvqOnO',
      'qPVVVLq.qGDdqqDddq.LVVvvqOnO',
      'qPVVVLq.qGDDdqDdddqLVVvvqOnO',
      'qPVVVLq.qGDdqqDddq.LVVvvqOnO',
      'qPVVVLq.qGDdqqDddq.LVVvvqOnO',
      '.qPVVLq.qGDdqqDddq.LVVvq.OnO',
      '.qPVVLq.qGDdqqDddq.LVVvq.OnO',
      '..qPVLq.qGDdqqDddq.LVvq..OnO',
      '..qqPLqkKKkq.kKKkq.LVvqq.OnO',
      '...qqqqkGKkq.kKKkqqqqq...OnO',
      '.......kKKkq.kKKkq.......OnO',
      '.......kGKKkq.kKKKk......OnO',
      '......kKKKKkq.kKKKKk.....OnO',
      '......kkkkkkq.kkkkkk.....OnO',
      '.........................OnO',
      '..........................O',
    ],
  };
})();
