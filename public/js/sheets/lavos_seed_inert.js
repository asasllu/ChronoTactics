// Lavos seed (inert): hand-pixelled animation sheet (se = front 3/4, ne = back 3/4).
// Every pose is a hand-drawn letter grid composed from hand-drawn parts (scratchpad anim_villagers);
// frames below are full grids or a copy of the previous frame plus a small patch.
CT.sheet('lavos_seed_inert', {
  pal: {
    K: '#16161f', a: '#3a3a4a', A: '#565668', n: '#78788c', N: '#a4a4b8', k: '#8e8ea2',
    s: '#2a2a38', t: '#9898aa', v: '#2c2632', V: '#4c2c34', W: '#7a343c', X: '#9a4448',
    Y: '#3a2630',
  },
  w: 24, h: 26, anchor: [12, 24],
  se: {
    idle: { loop: true, frames: [
      { ms: 1300, at: [2, 2], rows: [
          '.........K',
          '........KtK',
          '.......KKssK',
          '...KK.KnnnaKK',
          '..KtsKnNNAAKkKKK',
          '...KsnNNAAKkaassK',
          '....KNNAAAKkvaKK',
          '...KnNAvAAAKkaaK',
          '...KnnAAvAKkAaaK',
          '...KnnAAvKkAAaaK',
          '.KKnnAvvvKkAvvaaKK',
          'KtsnnAAvKYKkAAaassK',
          '.KsnnAKKAYYKkAaasstK',
          '..KnnAAAAVVYKkaaKKK',
          '...KnnAvYVVAKkaK',
          '...KnvvAAYYAAKaK',
          '...KAAAAAAvAAaKK',
          '....KAAaavaaaaKK',
          '...KsAAaavaaaassK',
          '..KtsKAAaavaaKKstK',
          '...KK.KAAaaaK..KK',
          '.......KKssK',
          '........KttK',
        ] },
      { ms: 220, base: 'idle.0', draw: [['rows', 10, 13, [
          '.V',
          '.VV',
          '.WWV',
          'VWW',
          '.VV',
        ]]] },
      { ms: 260, base: 'idle.1', draw: [['rows', 11, 15, [
          'XX',
          'XX',
        ]]] },
      { ms: 700, base: 'idle.1' },
    ] },
  },
});
