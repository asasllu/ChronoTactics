// Screenshot helper for art work. Renders through the real game pipeline.
//   node tools/shot.cjs map <mapId> [rot] [out.png]        whole map, 960x600 (2x)
//   node tools/shot.cjs battle <B0..B5|OPT1|SKIRMISH> [ms] [out.png] battle after ms (AI plays)
//   node tools/shot.cjs rig <key[,key]> [anims] [out.png]    animation sheet (tools/rig.html)
//   node tools/shot.cjs dev <hash> [out.png]                 tools/dev.html#<hash> (sprites, portraits, decor)
// Add ZOOM=x,y,w,h to crop (in 960x600 page px). Needs PW=<playwright path>, e.g.
//   PW=$(npm root -g)/playwright node tools/shot.cjs map zenan
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const root = 'file://' + path.resolve(__dirname, '..');
(async () => {
  const [mode, a, b, outArg] = process.argv.slice(2);
  const b0 = await chromium.launch();
  const p = await b0.newPage({ viewport: { width: mode === 'rig' || mode === 'dev' ? 1800 : 960, height: mode === 'rig' || mode === 'dev' ? 1200 : 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !/willReadFrequently|ERR_CERT|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  let out = outArg || `${mode}_${a}.png`;
  if (mode === 'map') {
    await p.goto(`${root}/public/index.html?sim`);
    await p.waitForFunction(() => window.SIM_READY);
    await p.evaluate(([id, rot]) => {
      const sc = new CT.Scene(CT.renderer, new CT.Game());
      sc.loadMap(id);
      CT.renderer.rot = +rot || 0;
      CT.renderer.focusMap(true);
    }, [a, b]);
    await p.waitForTimeout(1200);
  } else if (mode === 'battle') {
    await p.goto(`${root}/public/index.html?sim&autoplay&test`);
    await p.waitForFunction(() => window.SIM_READY);
    p.evaluate((id) => {
      const g = new CT.Game();
      const lv = { B0: 1, B1: 5, B2: 9, B3: 14, B4A: 20, B4B: 22, B5: 23, OPT1: 10 }[id] || 10;
      for (const m of Object.keys(g.members)) g.members[m] = g.newMember(m, lv);
      g.setParty(lv >= 14 ? ['crono', 'frog', 'ayla', 'magus'] : lv >= 9 ? ['crono', 'frog', 'ayla'] : ['crono', 'frog']);
      if (/^B4/.test(id)) g.guests = ['iselle'];
      if (id === 'SKIRMISH') {
        for (const m of CT.SKIRMISH.partyOverride) g.members[m] = g.newMember(m, CT.SKIRMISH.level);
        g.setParty(CT.SKIRMISH.partyOverride);
      }
      CT.game = g;
      const sc = new CT.Scene(CT.renderer, g);
      const def = id === 'SKIRMISH' ? CT.SKIRMISH : CT.BATTLES[id];
      sc.loadMap(def.map);
      CT.runBattle(id === 'SKIRMISH' ? CT.SKIRMISH : id, sc, { game: g, noRetry: true, noRewards: true });
    }, a);
    await p.waitForTimeout(+(b || 5000));
  } else if (mode === 'rig') {
    await p.goto(`${root}/tools/rig.html?key=${a}&scale=6${b ? '&only=' + b : ''}`);
    await p.waitForTimeout(300);
    await (await p.$('canvas')).screenshot({ path: out });
    console.log('wrote', out, errs.length ? errs : '');
    return b0.close();
  } else if (mode === 'dev') {
    out = b || `dev_${a}.png`;
    await p.goto(`${root}/tools/dev.html#${a}`);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: out, fullPage: true });
    console.log('wrote', out, errs.length ? errs : '');
    return b0.close();
  }
  const z = process.env.ZOOM && process.env.ZOOM.split(',').map(Number);
  await p.screenshot({ path: out, clip: z ? { x: z[0], y: z[1], width: z[2], height: z[3] } : undefined });
  console.log('wrote', out, errs.length ? errs : '');
  await b0.close();
})();
