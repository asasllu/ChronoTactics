// Batch battle balancer: runs each story battle N times with the AI playing the
// party at the intended level/gear, and reports win rates and rounds.
// usage: PW=$(npm root -g)/playwright node tools/balance.js [B1,B2,...] [runs] [parallel] [tuneJSON]
// INTERACT=1: the AI heroes also use the interactive spots (js/interactives.js) and carry
// the techs a good player would have learned from earlier battles' spots.
const { chromium } = require(process.env.PW);
const path = require('path');
// Techs taught by earlier battles' spots (kept by a player who took them).
const LEARNED = { B2: { crono: ['confuse'] }, B3: { crono: ['confuse'], ayla: ['dino_tail'] }, B4A: { crono: ['confuse'], ayla: ['dino_tail'], magus: ['magic_wall'] } };
LEARNED.B4B = { ...LEARNED.B4A, frog: ['masamune_gale'] };
LEARNED.B5 = LEARNED.B4B;
const INTERACT = !!process.env.INTERACT;
const url = 'file://' + path.resolve(__dirname, '../public/index.html') + '?sim&test&autoplay';
// Gear a player can actually afford: the story's gold buys roughly one piece per shop
// (Guardia before B1, Ioka before B2, Last Village before B3; no gear shop after that).
// Each listed piece is bought once (for its best candidate).
const G3 = ['steel_saber', 'bone_guard', 'beret'];
const SETUP = {
  B0: { level: 1, party: ['crono', 'frog', 'marle', 'lucca', 'robo'], gear: [] },
  B1: { level: 3, party: ['crono', 'frog'], gear: ['steel_saber'] },
  B2: { level: 6, party: ['crono', 'frog', 'ayla'], gear: ['steel_saber', 'bone_guard'] },
  B3: { level: 8, party: ['crono', 'frog', 'ayla', 'magus'], gear: G3 },
  B4A: { level: 10, party: ['crono', 'frog', 'ayla', 'magus'], gear: G3, guests: ['iselle'] },
  B4B: { level: 11, party: ['crono', 'frog', 'ayla', 'magus'], gear: G3, guests: ['iselle'] },
  B5: { level: 12, party: ['crono', 'frog', 'ayla', 'magus'], gear: G3 },
  OPT1: { level: 5, party: ['crono', 'frog', 'ayla', 'magus'], gear: [] },
};
async function runOne(browser, id, tune) {
  const p = await browser.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.SIM_READY, null, { timeout: 30000 });
  const res = await p.evaluate(async ([id, S, tune, interact, learned]) => {
    const g = new CT.Game();
    for (const m of Object.keys(g.members)) g.members[m] = g.newMember(m, S.level);
    CT.AI_INTERACT = interact;
    if (interact) for (const [m, ts] of Object.entries(learned || {})) g.members[m].learned = ts.slice();
    g.setParty(S.party);
    g.gold = 1e6;
    for (const gear of S.gear) g.buyGear(gear);
    g.inventory = { tonic: 4, mid_tonic: S.level > 3 ? 3 : 0, ether: 2, revive: 1 };
    g.unlock('x_strike');
    if (S.level >= 7) { g.unlock('shadow_cyclone'); g.unlock('ice_water'); }
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
    const used = window.TEST_LOG.filter((e) => e.interact).map((e) => e.interact);
    return { r, left, info: window.OUTCOME_INFO, round: log.round, hp: log.hp, used, secs: Math.round((performance.now() - t0) / 1000), hatched: !!g.flags.seed_hatched };
  }, [id, SETUP[id], tune, INTERACT, LEARNED[id]]);
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
    const safe = async () => {
      for (let i = 0; i < 3; i++) {
        try {
          return await runOne(browser, id, tune);
        } catch (e) {
          if (i === 2) return { r: 'error', errs: [String(e.message).slice(0, 120)] };
        }
      }
    };
    const jobs = Array.from({ length: runs }, () => safe);
    const out = [];
    while (jobs.length) out.push(...(await Promise.all(jobs.splice(0, par).map((f) => f()))));
    const wins = out.filter((o) => o.r === 'victory').length;
    if (verbose) out.forEach((o) => console.log('  ', o.r, o.info));
    const errs = [...new Set(out.flatMap((o) => o.errs))];
    const kos = out.filter((o) => o.hp).map((o) => o.hp.filter((h) => h === 0).length);
    const used = {};
    for (const o of out) for (const u of o.used || []) used[u] = (used[u] || 0) + 1;
    console.log(`${id}${INTERACT ? '+spots' : ''}: ${wins}/${runs} wins | KOs ${kos.join(',')} | spots ${JSON.stringify(used)} | rounds ${out.map((o) => o.round).join(',')} | hatched ${out.filter((o) => o.hatched).length} | secs ${out.map((o) => o.secs).join(',')} | hp% ${out.filter((o) => o.hp).map((o) => o.hp.join('/')).join(' ')} | left ${out.filter((o) => o.r !== 'victory').map((o) => '[' + o.left + ']').join(' ')}${errs.length ? ' | ERR ' + errs.slice(0, 3).join(' ; ') : ''}`);
  }
  await browser.close();
})();
