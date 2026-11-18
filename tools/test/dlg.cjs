// Dialogue screenshots: opens a scene (not autoplay), presses Enter n times, one PNG per step.
//   PW=... node tools/test/dlg.cjs <scene> <steps> <outPrefix>
const { chromium } = require(process.env.PW); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../../public/index.html') + '?scene=' + process.argv[2]);
  await p.waitForTimeout(2500);
  for (let i = 0; i < +process.argv[3]; i++) { await p.screenshot({ path: process.argv[4] + i + '.png' }); await p.keyboard.press('Enter'); await p.waitForTimeout(900); }
  console.log('errors', errs); await b.close();
})();
