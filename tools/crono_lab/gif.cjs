// Export animated GIF previews of sheets.
//   PW=... node tools/crono_lab/gif.cjs out.gif keys=crono [anims=idle,walk] [views=se,ne] [scale=3] [fx=fx_crono] [cols=6]
// Every animation plays in its own cell (non-looping ones hold 400 ms, then restart).
// Needs python3 with Pillow.
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
(async () => {
  const [out = 'anim.gif', ...rest] = process.argv.slice(2);
  const params = new URLSearchParams(rest.join('&'));
  const url = 'file://' + path.resolve(__dirname, 'anim.html') + '?' + params.toString();
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url);
  await p.waitForFunction(() => window.READY, null, { timeout: 30000 });
  const data = await p.evaluate(({ anims, views }) => {
    const cells = [];
    const only = anims ? anims.split(',') : null;
    const vs = (views || 'se,ne').split(',');
    for (const key of Object.keys(CT.SHEETS)) {
      const spr = CT.makeSheetSprite(key);
      const def = spr.def;
      for (const view of vs) {
        if (!def[view]) continue;
        const dir = view === 'se' ? 'south-east' : 'north-east';
        for (const name of Object.keys(def[view])) {
          if (only && !only.includes(name)) continue;
          const a = spr.anims[name];
          cells.push({
            label: `${key} ${view} ${name}`, loop: a.loop, w: def.w, h: def.h, ax: def.anchor[0], ay: def.anchor[1],
            frames: a[dir].map((f) => ({ png: f.img.toDataURL(), ms: f.ms, cx: f.cx, fy: f.footY })),
          });
        }
      }
    }
    for (const key of Object.keys(CT.FXS)) {
      const fx = CT.getFx(key);
      cells.push({ label: key, fx: true, loop: !!fx.def.loop, w: fx.def.w, h: fx.def.h, ax: fx.anchor[0], ay: fx.anchor[1],
        frames: fx.frames.map((f) => ({ png: f.img.toDataURL(), ms: f.ms, dx: f.dx, dy: f.dy })) });
    }
    return cells;
  }, { anims: params.get('anims'), views: params.get('views') });
  await b.close();
  if (errs.length) console.log('page errors:', errs);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gif-'));
  fs.writeFileSync(path.join(tmp, 'cells.json'), JSON.stringify(data));
  execFileSync('python3', [path.join(__dirname, 'gif.py'), path.join(tmp, 'cells.json'), out, params.get('scale') || '3', params.get('cols') || '6'], { stdio: 'inherit' });
})();
