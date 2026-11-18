// Visual tour: autoplays the story and saves a screenshot every N ms, for reviewing how
// scenes, transitions and battles look.  PW=... node tools/test/tour.cjs <scene> <outDir> [everyMs=4000] [maxMs=300000]
const { chromium } = require(process.env.PW); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
  await p.goto('file://' + path.resolve(__dirname, '../../public/index.html') + '?test&autoplay&scene=' + (process.argv[2] || '0.2'));
  const every = +(process.argv[4] || 4000), max = +(process.argv[5] || 300000); const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < max) { await p.waitForTimeout(every); await p.screenshot({ path: path.join(out, String(i++).padStart(3, '0') + '.png') }); if (errs.length) break; }
  console.log('shots', i, 'errors', errs); await b.close();
})();
