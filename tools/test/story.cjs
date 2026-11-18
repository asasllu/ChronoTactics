// Full-story autoplay: plays every scene and battle from a scene id and reports battle
// results, page errors and console warnings.
//   PW=/opt/node22/lib/node_modules/playwright node tools/test/story.cjs [scene=0.2] [maxMs=420000] [endShot.png] [extraQuery e.g. interact]
const { chromium } = require(process.env.PW); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  const errs = [], warns = new Set();
  p.on('pageerror', (e) => errs.push('PE ' + e.message));
  p.on('console', (m) => {
    if (m.type() === 'warning') warns.add(m.text().slice(0, 140));
    if (m.type() === 'error' && !/ERR_CERT|Failed to load/.test(m.text())) errs.push('CE ' + m.text().slice(0, 200));
  });
  const extra = process.argv[5] ? '&' + process.argv[5] : '';
  await p.goto('file://' + path.resolve(__dirname, '../../public/index.html') + '?test&autoplay' + extra + '&scene=' + (process.argv[2] || '0.2'));
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < +(process.argv[3] || 420000)) {
    await p.waitForTimeout(15000);
    const s = await p.evaluate(() => JSON.stringify((window.TEST_LOG || []).filter((x) => x.battle).map((x) => x.battle + ':' + x.result + (x.round ? '@' + x.round : ''))));
    if (s !== last) { console.log(Math.round((Date.now() - t0) / 1000) + 's', s); last = s; }
    if (errs.length) break;
    if (await p.evaluate(() => !!document.querySelector('#title.show') && (window.TEST_LOG || []).length > 5).catch(() => false)) break;
  }
  console.log('errors:', errs.slice(0, 10)); console.log('warnings:', [...warns].slice(0, 40));
  if (process.argv[4]) await p.screenshot({ path: process.argv[4] });
  await b.close();
})();
