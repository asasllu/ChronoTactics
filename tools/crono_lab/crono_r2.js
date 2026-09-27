// Crono, round 2: hand-pixelled in the construction of the SNES-style reference
// (24x44 front view, tinted outlines, 3-4 tones per material, light from top-left).
// The left half is authored, mirrored, then the right side is re-shaded darker.
(function () {
  const C = (window.CRONO_R2 = {});
  C.pal = {
    // hair: outline, dark, mid, orange, yellow
    H: '#580000', r: '#bc0038', R: '#e23229', o: '#ff8c00', y: '#ffc90e',
    // headband / eye whites
    W: '#ffffff', w: '#c7c7a3',
    // skin: light, mid, shade, lines
    F: '#ffcc9c', S: '#ff8468', s: '#af584a', j: '#230c08',
    // eyes
    k: '#0c432f', g: '#1fab77',
    // scarf
    Y: '#f2be36', n: '#d57a1f', N: '#882e13',
    // body outline, tunic light/mid/dark
    p: '#281820', T: '#74b5c3', U: '#468fa5', Q: '#1e3a3f',
    // belt, buckle
    b: '#402038', B: '#553344', G: '#ffc90e', z: '#8f5673',
    // leg outline, wraps light/mid/dark
    K: '#000000', l: '#c7c7a3', L: '#a8a870', d: '#6f6f44',
    // boots
    Z: '#1b0f07', M: '#4d2c17', I: '#cb7b4b', J: '#e1b397',
  };

  // Full-width hand-authored grid, 22 x 45 (no mirroring: light from the top-left).
  C.ROWS = [
    '..........H',
    '.........HoH......H',
    '....HH..HyRH.....HH',
    '.....HoHHoRrH...HrH',
    '.....HyRHoRrHH.HRrH',
    '..HH.HoRrHRrHoHRrHH',
    '...HHHRrHoRrHyRrHRrH',
    '..H.HoRrHoRrHoRrHRrH',
    '.HHoRrHoRrHRrHRrHRrHH',
    '..HRrHoRrHRrHoRrHRrrH',
    '..HHRHRrHoRrHRrHRrHrH',
    '...HRrHRrHRrHRrHRrHH',
    '...HRHRrHWWWwHrRHrRH',
    '....HrHsSSsSSsSHRrH',
    '....HRHjwksskwjHRH',
    '.....HSjWgSSgWjSj',
    '.....HsSFFsFFSsH',
    '......jSSSjjSSj',
    '.....pYYjsssjYYp',
    '....pQnYYYYYYYYnQp',
    '...pSpQUTnYYnQUUQpSp',
    '...pSpQUTTUQQUTUUQpSp',
    '..pSSpQUTUUQUQUTUQpSSp',
    '..pSFppQUUUUQUUUUQpFSp',
    '..pSFpbBBBBGBBBBbpFSp',
    '..prrpQbbbbbbbbbQprrp',
    '..prrpQUUUTQUUUUQprrp',
    '..pFFpQUTTUQUTUUQpFFp',
    '...ppQUUTUUQUUTUUQpp',
    '.....pQUUUUQUUUUQp',
    '.....pQUTUQpQUTUQp',
    '.....pQQUQp.pQUQQp',
    '......KllLdK.KLLdK',
    '......KlWlLK.KLlLdK',
    '.....KllLLdK.KLlLddK',
    '.....KdlLddK.KdLLddK',
    '......KddkK..KddkKK',
    '......KkdkK..KkdkK',
    '.....ZMIMMZ.ZMMIMZ',
    '.....ZMJIMZ.ZMIMMZ',
    '....ZMIMMMZ.ZMMIMMZ',
    '....ZIJIMMZ.ZMIIMMZ',
    '....ZZZZZZZ.ZZZZZZZ',
  ];
  C.rows = () => C.ROWS;

  // ---- Alternative B: same construction, own touches -------------------------------
  // Radiating hair, katana sheathed across the back, trailing scarf ends, belt pouch.
  C.HAIR_B = [
    '..........H',
    '.........HoH......H',
    '...HH...HyRH.....HrH',
    '....HoH.HoRrH...HRrH',
    '..H..HoHHoRrHH.HRrHH',
    '..HoH.HoRHRrHoHRrHRH',
    '...HoRHRoRrHyRHRrRrHH',
    'HH..HoRrHoRrHRrRHRrRH',
    '.HoRHRoRrHRrHRrRrHRrH',
    '..HRoRrHoRrHRrHRrRrrHH',
    '..HHRHRrHoRrHRrHRrHrRH',
    '...HRrHRrHRrHRrHRrHH',
  ];
  C.rowsB = () => {
    const g = C.ROWS.map((r) => r.padEnd(24, '.').split(''));
    C.HAIR_B.forEach((r, y) => { g[y] = r.padEnd(24, '.').split(''); });
    const put = (x, y, c) => { if (g[y] && x >= 0 && x < 24) g[y][x] = c; };
    // katana hilt over the right shoulder: gold pommel, purple-wrapped grip, gold guard
    const hilt = [];
    for (let y = 8; y <= 13; y++) {
      const x = 21 - Math.floor((y - 8) / 2);
      hilt.push([x - 1, y, 'p'], [x + 1, y, 'p'], [x, y, (y & 1) ? 'j' : 'z']);
    }
    hilt.push([21, 6, 'p'], [20, 7, 'p'], [22, 7, 'p'], [21, 7, 'G'], [16, 14, 'p'], [17, 14, 'G'], [18, 14, 'G'], [19, 14, 'G'], [20, 14, 'p'], [17, 15, 'p'], [18, 15, 'N'], [19, 15, 'p']);
    for (const [x, y, c] of hilt) put(x, y, c);
    // scarf ends trailing to the right
    for (const [x, y, c] of [[16, 17, 'n'], [17, 17, 'Y'], [17, 18, 'Y'], [18, 18, 'N'], [18, 19, 'n'], [19, 19, 'p'], [17, 16, 'p'], [18, 17, 'p'], [19, 18, 'p']]) put(x, y, c);
    // belt pouch on the right hip
    for (const [x, y, c] of [[14, 24, 'p'], [15, 24, 'p'], [16, 24, 'p'], [14, 25, 'B'], [15, 25, 'z'], [16, 25, 'p'], [14, 26, 'b'], [15, 26, 'B'], [16, 26, 'p'], [14, 27, 'p'], [15, 27, 'p']]) put(x, y, c);
    return g.map((r) => r.join(''));
  };

  C.build = () => {
    const K = window.KIT;
    return { sprite: K.fromRows(C.rows(), 22, 44), spriteB: K.fromRows(C.rowsB(), 24, 44), pal: C.pal };
  };
})();
