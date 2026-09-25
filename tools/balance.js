// Batch battle balancer: runs each story battle N times with the AI playing the
// party at the intended level/gear, and reports win rates and rounds.
// usage: PW=$(npm root -g)/playwright node tools/balance.js [B1,B2,...] [runs] [parallel]
const { chromium } = require(process.env.PW);
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '../public/index.html') + '?sim&test&autoplay';
const SETUP = {
  B0: { level: 1, party: ['crono', 'frog'], gear: [] },
  B1: { level: 5, party: ['crono', 'frog'], gear: [] },
  B2: { level: 9, party: ['crono', 'frog', 'ayla'], gear: ['steel_saber', 'iron_sword'] },
  B3: { level: 14, party: ['crono', 'frog', 'ayla', 'magus'], gear: ['steel_saber', 'iron_sword', 'bone_guard', 'fist_2'] },
  B4A: { level: 20, party: ['crono', 'frog', 'ayla', 'magus'], gear: ['rainbow', 'brave_sword', 'giants_hand', 'dark_scythe', 'lumin_robe', 'beret'], guests: ['iselle'] },
  B4B: { level: 22, party: ['crono', 'frog', 'ayla', 'magus'], gear: ['steel_saber', 'iron_sword', 'bone_guard', 'fist_2', 'rainbow', 'lumin_robe', 'brave_sword'], guests: ['iselle'] },
  B5: { level: 23, party: ['crono', 'frog', 'ayla', 'magus'], gear: ['steel_saber', 'iron_sword', 'bone_guard', 'fist_2', 'rainbow', 'lumin_robe', 'brave_sword', 'dark_scythe'] },
  OPT1: { level: 10, party: ['crono', 'frog', 'ayla', 'magus'], gear: [] },
};
async function runOne(browser, id, tune) {
  const p = await browser.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.SIM_READY, null, { timeout: 30000 });
  const res = await p.evaluate(async ([id, S, tune]) => {
    const g = new CT.Game();
    for (const m of Object.keys(g.members)) g.members[m] = g.newMember(m, S.level);
    g.setParty(S.party);
    g.gold = 1e6;
    for (const gear of S.gear) for (let i = 0; i < 4; i++) g.buyGear(gear);
    g.inventory = { tonic: 4, mid_tonic: S.level > 6 ? 3 : 0, ether: 2, revive: 1 };
    g.unlock('x_strike');
    if (S.level >= 12) { g.unlock('shadow_cyclone'); g.unlock('ice_water'); }
    g.guests = S.guests || [];
    CT.game = g;
    if (tune) CT.BATTLE_TUNE[id] = tune;
    const sc = new CT.Scene(CT.renderer, g);
    sc.loadMap(CT.BATTLES[id].map);
    const t0 = performance.now();
    if (!CT.Battle.prototype.__hooked) {
      CT.Battle.prototype.__hooked = true;
      const orig = CT.Battle.prototype.outcome;
      CT.Battle.prototype.outcome = function () { const o = orig.call(this); if (o) window.OUTCOME_INFO = 'round ' + this.round + ' obj ' + JSON.stringify(this.objective) + ' ' + this.units.map((u) => u.id + ':' + u.team + ':' + (u.alive ? 'A' : 'D') + ':' + u.hp).join(' '); return o; };
    }
    const r = await CT.runBattle(id, sc, { game: g, noRetry: true, noRewards: true });
    const log = window.TEST_LOG.filter((e) => e.battle).pop() || {};
    const b = window.LAST_BATTLE;
    const left = b ? b.units.filter((u) => u.alive && u.team === 1).map((u) => `${u.id}:${u.hp}`).join(' ') : '';
    return { r, left, info: window.OUTCOME_INFO, round: log.round, hp: log.hp, secs: Math.round((performance.now() - t0) / 1000), hatched: !!g.flags.seed_hatched };
  }, [id, SETUP[id], tune]);
  await p.close();
  return { ...res, errs };
}
(async () => {
  const ids = (process.argv[2] || 'B0,B1,B2,B3,B4A,B4B,B5').split(',');
  const runs = +(process.argv[3] || 4);
  const par = +(process.argv[4] || 4);
  const tune = process.argv[5] ? JSON.parse(process.argv[5]) : null;
  const browser = await chromium.launch();
  const verbose = process.env.VERBOSE;
  for (const id of ids) {
    const jobs = Array.from({ length: runs }, () => () => runOne(browser, id, tune));
    const out = [];
    while (jobs.length) out.push(...(await Promise.all(jobs.splice(0, par).map((f) => f()))));
    const wins = out.filter((o) => o.r === 'victory').length;
    if (verbose) out.forEach((o) => console.log('  ', o.r, o.info));
    const errs = [...new Set(out.flatMap((o) => o.errs))];
    console.log(`${id}: ${wins}/${runs} wins | rounds ${out.map((o) => o.round).join(',')} | hatched ${out.filter((o) => o.hatched).length} | secs ${out.map((o) => o.secs).join(',')} | hp% ${out.filter((o) => o.hp).map((o) => o.hp.join('/')).join(' ')} | left ${out.filter((o) => o.r !== 'victory').map((o) => '[' + o.left + ']').join(' ')}${errs.length ? ' | ERR ' + errs.slice(0, 3).join(' ; ') : ''}`);
  }
  await browser.close();
})();
