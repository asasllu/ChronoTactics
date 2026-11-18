// livetest.cjs — drive the real (non-offline) music engine in headless Chromium:
//   * track switching, the battle -> fanfare -> "field theme resumes where it was" logic, stopMusic
//   * main-thread cost of the scheduler per track (ms of JS per second of music, worst single tick)
//   PW=/opt/node22/lib/node_modules/playwright node tools/music/livetest.cjs [--music FILE] [--sec 5] [--ids a,b]
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const arg = (k, d) => (process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d);
const ROOT = path.resolve(__dirname, '../..');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PE ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 200)); });
  await p.goto('about:blank');
  await p.evaluate(() => {
    window.__perf = { ms: 0, n: 0, max: 0 };
    const si = window.setInterval;
    window.setInterval = (fn, ms) => si(() => { const t = performance.now(); fn(); const d = performance.now() - t; window.__perf.ms += d; window.__perf.n++; if (d > window.__perf.max) window.__perf.max = d; }, ms);
  });
  await p.addScriptTag({ path: path.join(ROOT, 'public/js/audio.js') });
  await p.addScriptTag({ path: path.resolve(arg('music', path.join(ROOT, 'public/js/music_ct.js'))) });
  const A = (fn, a) => p.evaluate(fn, a);
  const wait = (ms) => p.waitForTimeout(ms);
  const st = () => A(() => window.CT.audio._state());
  const log = [], check = (name, ok, extra) => { log.push((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };

  await A(() => {
    const a = window.CT.audio;
    a.define('mus_testjingle', { bpm: 240, meter: [4, 4], bars: 1, loop: 0, oneShot: true, kind: 'jingle', v: { a: ['brass', 'o4 c4 e4 g4 >c4'] } });
    a.unlock();
    a.playMusic('mus_denadoro');
  });
  await wait(4000);
  let s = await st();
  check('field track plays and advances', s.current === 'mus_denadoro' && s.pos > 3, JSON.stringify(s));
  await A(() => window.CT.audio.playMusic('mus_battle'));
  await wait(1500);
  s = await st();
  check('battle interrupts, field position remembered', s.current === 'mus_battle' && s.memo && s.memo.id === 'mus_denadoro' && s.memo.pos > 3, JSON.stringify(s.memo));
  const saved = s.memo ? s.memo.pos : 0;
  await A(() => window.CT.audio.playMusic('mus_testjingle'));
  await wait(600);
  s = await st();
  check('fanfare keeps the memory', s.current === 'mus_testjingle' && s.memo && s.memo.id === 'mus_denadoro');
  await wait(2600);
  s = await st();
  check('after the fanfare the field theme resumes by itself, near where it was', s.current === 'mus_denadoro' && s.playing === 'mus_denadoro' && s.pos > saved - 3.5 && s.pos < saved + 4 && !s.memo, 'saved ' + saved.toFixed(2) + ' now ' + s.pos.toFixed(2));
  // defeat -> silence -> retry -> victory -> next scene asks for the same field theme
  await wait(1500);
  const before = (await st()).pos;
  await A(() => window.CT.audio.playMusic('mus_battle'));
  await wait(700);
  await A(() => window.CT.audio.stopMusic(300));
  await wait(600);
  s = await st();
  check('stopMusic after a lost battle: silent, memory kept', s.current === null && s.playing === null && s.memo && s.memo.id === 'mus_denadoro');
  await A(() => { window.CT.audio.playMusic('mus_battle'); });
  await wait(500);
  await A(() => { window.CT.audio.playMusic('mus_victory'); });
  await wait(1200);
  s = await st();
  check('victory fanfare playing', s.current === 'mus_victory' && s.playing === 'mus_victory');
  await A(() => window.CT.audio.playMusic('mus_denadoro'));
  await wait(500);
  s = await st();
  check('explicit playMusic(field) resumes instead of restarting', s.current === 'mus_denadoro' && s.pos > before - 3.5, 'before ' + before.toFixed(2) + ' now ' + s.pos.toFixed(2));
  await A(() => window.CT.audio.playMusic('mus_guardia_600'));
  await wait(400);
  await A(() => window.CT.audio.playMusic('mus_denadoro'));
  await wait(400);
  s = await st();
  check('field -> other field -> back starts from the top', s.current === 'mus_denadoro' && s.pos < 1.5, 'pos ' + s.pos.toFixed(2));
  await A(() => window.CT.audio.playMusic('mus_battle'));
  await wait(300);
  await A(() => window.CT.audio.playMusic('mus_victory'));
  await wait(300);
  await A(() => window.CT.audio.stopMusic(200));
  await wait(500);
  s = await st();
  check('stopMusic during the fanfare forgets the field theme (the scene wants silence)', s.current === null && !s.memo);
  await A(() => { window.CT.audio.playMusic('nope'); window.CT.audio.sfx('sfx_confirm'); window.CT.audio.setVolume({ music: 0.4, sfx: 0.5 }); window.CT.audio.setVolume({ music: 0.55, sfx: 0.7 }); });
  check('unknown ids ignored, sfx + setVolume do not throw', true);

  // scheduler cost per track
  let ids = await A(() => window.CT.audio.tracks().filter((x) => x !== 'mus_testjingle'));
  if (arg('ids')) ids = arg('ids').split(',');
  const sec = +arg('sec', 5);
  const rows = [];
  for (const id of ids) {
    await A((i) => { window.CT.audio.stopMusic(0); window.__perf.ms = 0; window.__perf.n = 0; window.__perf.max = 0; window.__t0 = performance.now(); window.CT.audio.playMusic(i); }, id);
    await wait(sec * 1000);
    rows.push(await A((i) => ({ id: i, msPerSec: window.__perf.ms / ((performance.now() - window.__t0) / 1000), max: window.__perf.max, ticks: window.__perf.n }), id));
  }
  await A(() => window.CT.audio.stopMusic(0));
  console.log(log.join('\n'));
  console.log('\nscheduler (main thread) cost, first ' + sec + ' s of each track (includes building its samples):');
  for (const r of rows) console.log('  ' + r.id.padEnd(18) + ' ' + r.msPerSec.toFixed(2).padStart(6) + ' ms/s   worst tick ' + r.max.toFixed(1).padStart(5) + ' ms');
  const mean = rows.reduce((a, r) => a + r.msPerSec, 0) / Math.max(1, rows.length);
  console.log('  mean ' + mean.toFixed(2) + ' ms/s = ' + (mean / 10).toFixed(2) + ' % of one core');
  console.log('errors:', errs);
  await b.close();
  process.exit(log.some((l) => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
