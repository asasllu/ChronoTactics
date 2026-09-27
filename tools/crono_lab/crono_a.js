// Crono, alternative A: hand-pixelled, SNES-proportioned. Every pixel is placed by
// hand; only the silhouette outline is automatic.
(function () {
  const A = (window.CRONO_A = {});
  A.pal = {
    k: '#1c1024',
    R: '#e2402f', r: '#a3202c', L: '#ff8d5a', D: '#6e1422',
    W: '#f6f4ee', w: '#d6cfd2',
    S: '#f8c9a0', s: '#d99670', t: '#a8603f', e: '#24182e', E: '#ffffff', i: '#6a3a2a', m: '#a04040',
    B: '#3968d2', b: '#244696', n: '#6f9df2',
    Y: '#f2c43e', y: '#b8841c',
    P: '#efe6cc', p: '#c5b393',
    O: '#7c4a28', o: '#4c2a16',
    X: '#eef4ff', x: '#8e9cba', G: '#f2c43e', H: '#2a1e30',
  };

  // Field / battle sprite, facing down-right. 24 x 35.
  A.sprite = [
    '.........R....R',
    '........RR...RR',
    '...R....RLR.RRR...R',
    '...RR..RRLRRRLR.RR',
    '....RRRRLRRRRLRRRR',
    'R....RRLRRRRLRRRRRR',
    'RRR.RRRrRRRRrRRRRRRR',
    '.RRRRRrRRRRrRRRRRRRR',
    '..RRRRrRRRRRRRRRRRRr',
    'RRRRRrWWWWWWWWWWWRRr',
    '.WWRrWwwwwwwwwwwwWRr',
    'WWw.RRRRRSRSSRSSSS',
    '.w..RRRRSSkSSSkkSS',
    '....RRRSSSeSSSeESS',
    '....RRrsSSeSSSeeSSS',
    '....RRRRsSSSSSSSSS',
    '.....RRRssSSSSmSS',
    '......RR.sssSSSS',
    '...........ssss',
    '........nBBBBsBBBBBB',
    '......bbnBBBBBBBBbBBb',
    '......bbnBBBBBBBBbBBb',
    '......bbnnBBBBBBBbBBb',
    '......bbnBBBBBBBbbBBb',
    '......bbYYYYYYYYYYBBb',
    '......ssyyyyYyyyyyBBb',
    '......ss.nBBBBBBBbssG',
    '.........nBBBbBBBbssGG',
    '.........pppPPPP....XG',
    '.........pppPPPP.....Xx',
    '.........pppPPPPP....Xx',
    '.........ppp.PPPP.....Xx',
    '.........ppp.PPPP.....X',
    '........oooo.OOOOO.....X',
    '........oooo.OOOOOO',
  ];

  // Dialogue portrait, 40 x 40, head turned slightly right.
  A.portrait = [
    '................R........R',
    '...............RR.......RRR',
    '......R........RLR......RLR',
    '.......RR.....RRLR.....RRLR......R',
    '........RRR...RLRRR...RRLRR....RR',
    '.........RRRRRRLRRRRRRRLRRRR..RRR',
    '..........RRRRLRRRRRRRLRRRRRRRRR',
    '...RRR....RRRRRRRRRRRRRRRRRRRRRRR',
    '.RRRRRRRRRRRRrRRRRRRRRRrRRRRRRRRRR',
    '...RRRRRRRRRrRRRRRRRRRrRRRRRRRRRRRR',
    '.....RRRRRRrRRRRRRRRRrRRRRRRRRRRRRRR',
    '..RRRRRRRRRWWWWWWWWWWWWWWWWWWWWWRRRRr',
    'RRRRRRRRRWWWwwwwwwwwwwwwwwwwwwwwWRRRr',
    '..RRRRRWWwRRRSSRRRSSSRRRSSSSSSSSRRr',
    '.WWRRRRRwRRRRSSRRSSSSRRSSSSSSSSSSRr',
    'WWw.RRRRRRRRSSSSRSSSSSRSSSSSSSSSSr',
    'Ww..RRRRRRRSSSSSSSSSSSSSSSSSSSSSS',
    'w....RRRRRRSSSkkkkSSSSSkkkkkkSSSS',
    '.....RRRRRSSSSSSSSSSSSSSSSSSSSSSS',
    '.....RRRRSSSSkkkkkSSSSkkkkkkkSSSS',
    '.....RRRSSSSEEeekSSSSEEEeeEkSSSSS',
    '.....RRRSsSSEeiekSSSSEEEeiekSSSSSS',
    '.....RRRSsSSsEEssSSSSsEEEsssSSSSSS',
    '.....RRRSsSSSSsSSSSSSSSsssSSSSSSSs',
    '.....RRRRsSSSSSSSSSSSSSSSSSSSSSSSs',
    '......RRRsSSSSSSSSSSSSSSSSSSSSSss',
    '......RRRsssSSSSSSSSSSSSSSSSSSSs',
    '.......RRRssSSSSSSSSSSSSmmmmSSSs',
    '........RRsssSSSSSSSSSSSSssSSSs',
    '.........RsssssSSSSSSSSSSSSSSs',
    '..........sssssSSSSSSSSSSSSss',
    '...........ssssssSSSSSSSsss',
    '..............sssssssssss',
    '...............sssssssss',
    '..........BBBBBBsssssssBBBBBB',
    '......BBBBBBBBBBnsssssnBBBBBBBBB',
    '...BBBBBBBBBBBBBnnsssnnBBBBBBBBBBBB',
    '..bBBBBBBBBBBBBBBnnsnnBBBBBBBBBBBBBB',
    '.bbBBBBBBBBBBBBBBBnnnBBBBBBBBBBBBBBBb',
    'bbbBBBBBBBBBBBBBBBBnBBBBBBBBBBBBBBBbb',
  ];

  A.build = () => {
    const K = window.KIT;
    return {
      sprite: K.outline(K.fromRows(A.sprite, 24, 35)),
      portrait: K.outline(K.fromRows(A.portrait, 40, 40)),
      pal: A.pal,
    };
  };
})();
