// Pixel-art sprites, drawn as character grids and rasterised to canvases at load.
// Each grid is read left-to-right, top-to-bottom; '.' is transparent and every
// other character indexes the sprite's palette ('k' is the shared outline).
(function () {
  const CT = (window.CT = window.CT || {});
  const OUTLINE = '#181020';

  const DEFS = {
    crono: {
      pal: {
        h: '#e04020', H: '#982010', s: '#f8c898', S: '#c88858', e: '#203050',
        w: '#f0f0f0', c: '#2878c0', C: '#185088', a: '#f8d038', A: '#a86828',
        p: '#e0d8b8', P: '#a89878', b: '#704020', m: '#e8f0f8', M: '#90a0b8', g: '#604020',
      },
      rows: [
        '......k...k.......',
        '.....khk.khk.k....',
        '....khhhkhhhkhk...',
        '...khhhhhhhhhhhk..',
        '..khhhhhhhhhhhhhk.',
        '.khhhhhhhhhhhhHHk.',
        '..kwwwwwwwwwwwwk..',
        '..khHssssssssHhk..',
        '..kHssesssssessk..',
        '..kSssesssssessk..',
        '...kSsssssssssk...',
        '....kkSsssssSkk...',
        '...kaaakkkkkaaak..',
        '..kccaaaaaaaaacck.',
        '.kscCcccaaacccCskM',
        '.ksCCcccccccccCsmM',
        '.kskCcccccccccCkmk',
        '..k.kAAAAAAAAAkm..',
        '....kppppPppppkg..',
        '....kpppPkPpppk...',
        '....kppPk.kPppk...',
        '...kbbbbk.kbbbbk..',
        '...kbbbbk.kbbbbk..',
        '....kkkk...kkkk...',
      ],
    },
    marle: {
      pal: {
        h: '#f8d850', H: '#c89828', s: '#f8c8a0', S: '#c88860', e: '#2050a0',
        w: '#f8f8f8', c: '#f0f0f8', C: '#a8b0d0', a: '#3070d8', A: '#1c48a0',
        p: '#f0f0f8', P: '#a8b0d0', b: '#8858c0', m: '#b07030', M: '#704018', r: '#f06070',
      },
      rows: [
        '.....kkkkkk.......',
        '....khhhhhhkk.....',
        '...khhhhhhhhhkkk..',
        '..khhhhhhhhhhhhhk.',
        '..khhhhhhhhhhhhHhk',
        '..khhhhhhhhhhhkHhk',
        '..khHhhhhhhhHhkhHk',
        '..khHssssssssHhkhk',
        '..kHssesssssesskHk',
        '..kSssesssssessk.k',
        '...kSsssssssssk...',
        '....kkSsrrssSkk...',
        '...kaakkkkkkkaak..',
        '..kcccaaaaaaacccMk',
        '.kscCccccccccccmMk',
        '.ksCCccccccccccsmk.',
        '.kskCccccccccccCk..',
        '..k.kAAAAAAAAAk....',
        '...kppppPppppppk...',
        '...kppppPkPppppk...',
        '....kppPk.kPppk....',
        '...kbbbbk.kbbbbk...',
        '...kbbbbk.kbbbbk...',
        '....kkkk...kkkk....',
      ],
    },
    lucca: {
      pal: {
        h: '#9060c8', H: '#603890', s: '#f8c8a0', S: '#c88860', e: '#203050',
        w: '#f8f8f8', g: '#68c0e8', c: '#e88830', C: '#a85818', a: '#48a048', A: '#2c6830',
        p: '#48a048', P: '#2c6830', b: '#805030', m: '#a0a8b8', M: '#606878',
      },
      rows: [
        '.....kkkkkkk......',
        '....kaaaaaaaak....',
        '...kaaaaaaaaaak...',
        '..kaaaAAAAAAaaak..',
        '..kkkkkkkkkkkkkk..',
        '..khhhhhhhhhhhhk..',
        '.khhHhhhhhhhhHhhk.',
        '.khHwwwwsswwwwHhk.',
        '.khkwggwkkwggwkhk.',
        '.khswwwwsswwwwshk.',
        '..kSsssssssssSk...',
        '...kkSsssssSkk....',
        '...kcckkkkkcck....',
        '..kcccccccccccck..',
        '.kscCcccccccccCsk.',
        '.ksCCccccccccCCmMk',
        '.kskCccccccccCkmMk',
        '..k.kAAAAAAAAAkk..',
        '....kpppppPpppk...',
        '....kppppPkPppk...',
        '....kpppPk.kPpk...',
        '...kbbbbk.kbbbbk..',
        '...kbbbbk.kbbbbk..',
        '....kkkk...kkkk...',
      ],
    },
    frog: {
      pal: {
        s: '#68b848', S: '#3c7c2c', w: '#f8f8e0', e: '#181818', y: '#e8d890',
        c: '#6048b0', C: '#3c2c78', a: '#e8c040', m: '#d8e0e8', M: '#8890a0',
        p: '#806040', P: '#584028', A: '#a07030',
      },
      rows: [
        '..................',
        '...kkk.....kkk....',
        '..kwwwk...kwwwk...',
        '..kwekk...kkewk...',
        '..kwwwkkkkkwwwk...',
        '.ksssssssssssssk..',
        '.ksssssssssssssk..',
        '.kssssssssssssSk..',
        '.kSkkkkkkkkkkkSk..',
        '..kyyyyyyyyyyyk...',
        '...kkSSSSSSSkk....',
        '..kacckkkkkccak...',
        '.kccmmmmmmmmmcck..',
        'kccCmmmmmmmmmCcck.',
        'kcCsMmmmmmmmMsCckm',
        'kcCskmmmmmmmkskckm',
        'kcC.kAAAAAAAk.Cckm',
        'kcC.kpppppppk.Cck.',
        'kcC.kpppkpppk.CCk.',
        '.kC.kppk.kppk.Ck..',
        '..kkkssk.kssk.kk..',
        '...ksssk.ksssk....',
        '...kkkkk.kkkkk....',
      ],
    },
    robo: {
      pal: {
        c: '#e0a838', C: '#a06820', D: '#704010', m: '#b8c0c8', M: '#707880',
        e: '#f83020', a: '#58c8f0',
      },
      rows: [
        '.......kk.........',
        '......kaak........',
        '.....kkmmkk.......',
        '....kcccccck......',
        '...kcccccccCk.....',
        '...kcmmmmmmCk.....',
        '...kcmeeemeMk.....',
        '...kcmmmmmmCk.....',
        '....kCCCCCCk......',
        '..kkkkmmmmkkkkk...',
        '.kcccckmmkcccCck..',
        'kcCcccccccccccCck.',
        'kcCkccccccccCkCck.',
        'kmmkcCccccCCCkmmk.',
        'kmmk.kccccCCk.kmmk',
        '.kk..kMMMMMMk..kk.',
        '.....kcck.kcck....',
        '....kcccCk.kccCk..',
        '....kcCCk..kcCCk..',
        '...kmmmmk..kmmmmk.',
        '...kMMMMk..kMMMMk.',
        '...kkkkk...kkkkk..',
      ],
    },
    ayla: {
      pal: {
        h: '#f8e068', H: '#d0a030', s: '#f0b080', S: '#b87848', e: '#306020',
        c: '#e0a040', C: '#906020', d: '#603810', p: '#e0a040', b: '#b87848', r: '#e05050',
      },
      rows: [
        '...k.kkk.k.k......',
        '..khkhhhkhkhk.....',
        '.khhhhhhhhhhhk....',
        'khhhhhhhhhhhhhk...',
        '.khhhhhhhhhhhhhk..',
        'khhhhhhhhhhhhHHk..',
        'khHhHssssssHhHhk..',
        '.kHhsseSsseSsHhk..',
        'khHsssesssesshHk..',
        'kHhSsssssssssHhk..',
        '.kHHkSsrrssSkHHk..',
        '..kHkkSsssSkkHk...',
        '...kccdccdcck.....',
        '..kcdcccccdcck....',
        '.kscccdcccccCsk...',
        '.kssSsssssssSsk...',
        '.kskSsssssssSkk...',
        '..k.kccdccdcck....',
        '...kcdcccccdcck...',
        '...kkCkccCkcCkk...',
        '....kssk.kssk.....',
        '...kbssk.kssbk....',
        '...kbbbk.kbbbk....',
        '....kkk...kkk.....',
      ],
    },
    magus: {
      pal: {
        h: '#7898e8', H: '#4860b0', s: '#e8d8f0', S: '#a898c0', e: '#c02030',
        c: '#383050', C: '#201830', a: '#8048b8', A: '#582888', m: '#d8d8e8', M: '#8888a0',
        g: '#604030', w: '#f0f0f0',
      },
      rows: [
        '..........MMMMm...',
        '...kkkkk.Mk...kmm.',
        '..khhhhhkk......km',
        '.khhhhhhhhk......k',
        'khhhhhhhhhhk.....k',
        'khhhHhhhhHhhk....g',
        'khhHsssssssHhk...g',
        'khHssesssessHhk.g.',
        'khHsseSssseSshk.g.',
        'khhSsssssssSHhk.g.',
        'khhkkSssssSkkhkg..',
        'khakCkkkkkkCkakg..',
        'kaaCcccaacccCaag..',
        'kaCcccccaacccCsk..',
        'kaCcCcccaaccCsgk..',
        'kaCccCccccccCkk...',
        'kaCcccCcccccCak...',
        'kaCccccCcccccak...',
        'kaCcccccCccccCak..',
        'kaCccccccCcccCak..',
        'kAaCcccccccccCAak.',
        'kAaCCCCCCCCCCCaAk.',
        '.kkkkkkkkkkkkkkk..',
      ],
    },
    ozzie: {
      pal: {
        s: '#88b850', S: '#587830', e: '#f8f8f8', E: '#202020', c: '#6040a0', C: '#402870',
        a: '#e8c040', w: '#f8f8f8', r: '#c83040',
      },
      rows: [
        '......kkkkkkk.......',
        '....kksssssssk......',
        '...ksssssssssssk....',
        '..ksssssssssssssk...',
        '..kssekEsssekEssk...',
        '..ksseeEsssseeEsk...',
        '..kssssssssssssSk...',
        '..kSsskrrrrrksSSk...',
        '...kSsskkkkksSSk....',
        '..kkkSSSSSSSSSkkk...',
        '.kcckaaaaaaaaakcck..',
        'kccCsssssssssssCcck.',
        'kcCssssssssssssSCck.',
        'kcCssssssssssssSCck.',
        'kcCsSssssssssssSCck.',
        'kcCkSSsssssssSSkCck.',
        'kcC.kSSSSSSSSSk.Cck.',
        'kcC.kcccccccCCk.Cck.',
        'kcC.kccCk.kcCCk.Cck.',
        '.kC.kssSk.ksSSk.Ck..',
        '..k.ksssk.ksssk.k...',
        '....kkkkk.kkkkk.....',
      ],
    },
    slash: {
      pal: {
        h: '#f0f0f8', H: '#a0a8c0', s: '#6898d0', S: '#3c6098', e: '#f8e040',
        c: '#e8e8f0', C: '#9098b0', a: '#d03040', A: '#881828', p: '#303048', P: '#1c1c30',
        b: '#503020', m: '#e8f0f8', M: '#90a0b8', g: '#e8c040',
      },
      rows: [
        '.......kkkk..........',
        '.....kkhhhhk.........',
        '....khhhhhhhk......m.',
        '...khhhhhhhhhk....mk.',
        '..khhhhHhhhhHk...mk..',
        '..khHssssssHhk..mk...',
        '..khssesssessk.mk....',
        '...kssesssessk.mk....',
        '...kSssssssSk.mk.....',
        '....kkSsssSkk.mk.....',
        '...kaackkkkcaamk.....',
        '..kcccaaaaacccgk.....',
        '.kscCcccaaacccsgk....',
        '.ksCCcccaaacCCsk.....',
        '.kskCcccccccCCkk.....',
        '..k.kAAAAAAAAk.......',
        '....kpppPppppk.......',
        '....kppPkPpppk.......',
        '....kpPk.kPppk.......',
        '...kbbbk.kbbbbk......',
        '...kbbbk.kbbbbk......',
        '....kkk...kkkk.......',
      ],
    },
    flea: {
      pal: {
        h: '#f880c0', H: '#c04888', s: '#f8d0c0', S: '#c89080', e: '#6020a0',
        c: '#9848c8', C: '#602890', a: '#f8e060', r: '#e03060', b: '#602890', w: '#f8f8f8',
      },
      rows: [
        '....kkkkkkk.......',
        '...khhhhhhhkk.....',
        '..khhhhhhhhhhk....',
        '.khhhhhhhhhhhhk...',
        '.khhHhhhhhhhHhhk..',
        'khhHssssssssHhhk..',
        'khHsseesseessHhk..',
        'khhssekssekssHhk..',
        'khhSssssssssShhk..',
        '.khkkSsrrssSkkhk..',
        '.kHhkkSSSSSkkhHk..',
        '..kHcckaaakcckHk..',
        '..kccccaaacccck...',
        '.kscCccccccccCsk..',
        '.ksCCcccwcccccsk..',
        '..kkCcccccccccCk..',
        '...kCccccccccCCk..',
        '..kCcccccccccCCCk.',
        '..kCCccccccccCCCk.',
        '.kCCCcccccccCCCCCk',
        '..kkkkksk.skkkkk..',
        '.....kbbk.bbk.....',
        '.....kkkk.kkk.....',
      ],
    },
    hench: {
      pal: {
        s: '#5078c8', S: '#304c90', e: '#f8e020', E: '#e02020', w: '#f8f8f8', h: '#e8e0c0',
        c: '#8848a8', C: '#582878', m: '#b0b8c8', M: '#687080', g: '#806040',
      },
      rows: [
        '..kk.......kk.....',
        '..khk.....khk.....',
        '...khkkkkkhk......',
        '...kssssssssk.....',
        '..kssssssssssk....',
        '..ksseEssseEsk....',
        '..ksseessseesk....',
        '..kSssssssssSk....',
        '..kSskwkwkwkSk..m.',
        '...kSSkkkkkSk..mMk',
        '...kcckkkkcck..mk.',
        '..kcccccccccCk.gk.',
        '.kscCcccccccCskg..',
        '.ksCCcccccccCsgk..',
        '.kskCcccccccCkg...',
        '..k.kSSSSSSSk.....',
        '....kssSkSssk.....',
        '....kssk.kssk.....',
        '...ksssk.ksssk....',
        '...kkkkk.kkkkk....',
      ],
    },
  };

  function rasterise(def) {
    const w = Math.max(...def.rows.map((r) => r.length));
    const h = def.rows.length;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    def.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        g.fillStyle = ch === 'k' ? OUTLINE : def.pal[ch] || OUTLINE;
        g.fillRect(x, y, 1, 1);
      }
    });
    return cv;
  }

  function mirrored(src) {
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const g = cv.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return cv;
  }

  function silhouette(src, color) {
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const g = cv.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }

  const cache = {};
  CT.getSprite = function (key) {
    if (!cache[key]) {
      const right = rasterise(DEFS[key]);
      const left = mirrored(right);
      cache[key] = {
        w: right.width,
        h: right.height,
        right,
        left,
        flashRight: silhouette(right, '#ffffff'),
        flashLeft: silhouette(left, '#ffffff'),
      };
    }
    return cache[key];
  };

  // Portrait data-URL for HTML panels (upscaled so CSS pixelation stays crisp).
  const portraitCache = {};
  CT.portrait = function (key) {
    if (!portraitCache[key]) {
      const s = CT.getSprite(key);
      const scale = 4;
      const cv = document.createElement('canvas');
      cv.width = 26 * scale;
      cv.height = 26 * scale;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      const dx = Math.floor((26 - s.w) / 2) * scale;
      g.drawImage(s.right, dx, 1 * scale, s.w * scale, s.h * scale);
      portraitCache[key] = cv.toDataURL();
    }
    return portraitCache[key];
  };

  // Map decorations (trees, rocks) share the same grid format.
  const DECOR = {
    tree: {
      pal: { g: '#3c9040', G: '#246028', l: '#68c058', t: '#805028', T: '#583418' },
      rows: [
        '.......kkkk.........',
        '.....kkllggkk.......',
        '....klllgggggk......',
        '...kllgggggGggk.....',
        '..klllggggggGGgk....',
        '..kllgggglgggGGk....',
        '.klgggglllggGGGGk...',
        '.klggggggggGGGGGk...',
        'kllgggglgggggGGGGk..',
        'klgggglllgggGGGGGk..',
        'kgggggggggGGGGGGGk..',
        '.kGgggggGGGGGGGGk...',
        '..kGGGGGGGGGGGGk....',
        '...kkkkTtTkkkkk.....',
        '.......kTtTk........',
        '.......kTtTk........',
        '......kTTtTTk.......',
        '......kkkkkkk.......',
      ],
    },
    rock: {
      pal: { r: '#a8a8b0', R: '#707080', l: '#d0d0d8' },
      rows: [
        '....kkkkk.....',
        '..kkllrrrkk...',
        '.klllrrrrRRk..',
        'klrrrrrrrRRRk.',
        'krrrrrrRRRRRk.',
        '.kRRRRRRRRRk..',
        '..kkkkkkkkk...',
      ],
    },
  };
  const decorCache = {};
  CT.getDecor = function (key) {
    if (!decorCache[key]) decorCache[key] = rasterise(DECOR[key]);
    return decorCache[key];
  };
})();
