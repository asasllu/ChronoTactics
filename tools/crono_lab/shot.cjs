// Screenshot the lab pages.
//   PW=$(npm root -g)/playwright node tools/crono_lab/shot.cjs cast out.png [only=frog,ayla] [scale=6] [game=1]
//   PW=... node tools/crono_lab/shot.cjs compare out.png          (Crono vs the reference)
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const [page = 'cast', out = 'cast.png', ...rest] = process.argv.slice(2);
  const params = new URLSearchParams(rest.join('&'));
  const url = 'file://' + path.resolve(__dirname, page + '.html') + '?' + params.toString();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text()) && errs.push(m.text()));
  await p.goto(url);
  await p.waitForFunction(() => window.READY, null, { timeout: 15000 }).catch(() => errs.push('page never became READY'));
  await p.screenshot({ path: out, fullPage: true });
  console.log('wrote', out, errs.length ? errs : '');
  await b.close();
})();
