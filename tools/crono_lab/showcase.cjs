// Record a unit performing techs in a real battle, as an animated GIF.
//   PW=... node tools/crono_lab/showcase.cjs out.gif crono attack,cyclone,slash,lightning [battle=B1] [zoom=2] [walk=1]
// The unit is placed with a foe beside it; each tech (or 'attack', 'walk', 'hurt', 'victory')
// plays through BattleCtl.perform. Frames are screenshots of the canvas around the unit.
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
(async () => {
  const [out = 'showcase.gif', key = 'crono', list = 'attack', ...rest] = process.argv.slice(2);
  const opt = Object.fromEntries(rest.map((s) => s.split('=')));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_CERT|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.goto('file://' + path.resolve(__dirname, '../../public/index.html') + '?sim');
  await p.waitForFunction(() => window.SIM_READY);
  const box = await p.evaluate(async ({ key, battle }) => {
    const g = new CT.Game();
    for (const m of Object.keys(g.members)) g.members[m] = g.newMember(m, 20);
    const party = ['crono', 'frog', 'ayla', 'magus'];
    g.setParty(CT.HEROES[key] && !party.includes(key) ? [key, 'crono'] : party);
    CT.game = g;
    const base = CT.BATTLES[battle];
    const def = { ...base, id: battle, enemyLevel: 20, tune: {}, events: [], triggers: [] };
    const sc = new CT.Scene(CT.renderer, g);
    sc.loadMap(def.map);
    const ctl = new CT.BattleCtl(def, g, sc);
    ctl.setup();
    await ctl.transition();
    CT.UI.battleHud(false);
    const B = ctl.b;
    let u = B.units.find((v) => v.key === key || v.sprite === key || v.sprite === 'echo_' + key);
    // Not in this battle: a party member stands in wearing the sprite.
    if (!u) { u = B.units.find((v) => v.hero) || B.units[0]; u.sprite = key; }
    const foes = B.units.filter((v) => v !== u && B.hostile(u, v));
    // Put one foe on a free tile beside the unit, facing each other.
    const near = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy })).find((t) => B.tile(t.x, t.y) && !B.unitAt(t.x, t.y) && !CT.TERRAIN[B.tile(t.x, t.y).t].void);
    const foe = foes[0];
    if (near && foe) {
      B.moveUnit(foe, [{ x: foe.x, y: foe.y }, near]);
      foe.x = near.x; foe.y = near.y;
      foe.rx = near.x; foe.ry = near.y; foe.rh = B.visH(B.tile(near.x, near.y));
    }
    // Only the performer and its foe on stage.
    if (!/solo=0/.test(location.hash)) for (const v of B.units) if (v !== u && v !== foe) v.hidden = true;
    u.face = CT.dirTo(u.x, u.y, foe.x, foe.y);
    foe.face = CT.dirTo(foe.x, foe.y, u.x, u.y);
    ctl.r.focus(u.x, u.y, B.tile(u.x, u.y).h);
    window.SC = { ctl, u, foe };
    await new Promise((r) => setTimeout(r, 900));
    const cv = document.getElementById('cv').getBoundingClientRect();
    const [sx, sy] = ctl.r.project(u.x, u.y, u.rh);
    const k = cv.width / ctl.r.W;
    return { x: cv.left + sx * k, y: cv.top + sy * k, k };
  }, { key, battle: opt.battle || 'B1' });
  const W = +(opt.w || 360), H = +(opt.h || 240);
  const clip = { x: Math.max(0, Math.round(box.x - W / 2)), y: Math.max(0, Math.round(box.y - H * 0.62)), width: W, height: H };
  const frames = [];
  let recording = true;
  const rec = (async () => {
    let last = Date.now();
    while (recording) {
      const buf = await p.screenshot({ clip });
      const now = Date.now();
      frames.push({ buf, ms: now - last });
      last = now;
    }
  })();
  for (const name of list.split(',')) {
    await p.evaluate(async (name) => {
      const { ctl, u, foe } = window.SC;
      const B = ctl.b;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      u.mp = 999;
      foe.hp = foe.maxHp; foe.alive = true; foe.alpha = 1; foe.koPose = false;
      if (name === 'walk' || name === 'idle' || name === 'hurt' || name === 'victory' || name === 'kneel' || name === 'jump' || name.startsWith('tech_') || ['nod', 'point', 'shake_head', 'draw_sword'].includes(name)) {
        const spr = CT.getSprite(u.sprite || u.key);
        const a = spr.anims[name];
        u.anim = { name, t0: performance.now(), hold: false };
        await wait(Math.max(900, a ? (a.loop ? a.total * 2 : a.total + 400) : 900));
        u.anim = null;
        return;
      }
      const tech = name === 'attack' ? B.attackOf(u) : CT.TECHS[name];
      if (!tech) return;
      const self = tech.range[1] === 0;
      const center = self ? { x: u.x, y: u.y } : { x: foe.x, y: foe.y };
      if (tech.target === 'ally' && !self) { center.x = u.x; center.y = u.y; }
      try { await ctl.perform(u, tech, center); } catch (e) { console.error(name, e.stack); }
      for (const v of B.units) { v.anim = null; v.koPose = false; if (v.hidden) continue; if (!v.alive) { v.alive = true; v.hp = v.maxHp; v.alpha = 1; } }
      await wait(500);
    }, name);
  }
  recording = false;
  await rec;
  await b.close();
  if (errs.length) console.log('page errors:', errs.slice(0, 5));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'show-'));
  frames.forEach((f, i) => fs.writeFileSync(path.join(tmp, `f${String(i).padStart(4, '0')}.png`), f.buf));
  fs.writeFileSync(path.join(tmp, 'ms.json'), JSON.stringify(frames.map((f) => f.ms)));
  execFileSync('python3', ['-c', `
import json,glob,sys
from PIL import Image
d=sys.argv[1]; ms=json.load(open(d+'/ms.json')); fs=sorted(glob.glob(d+'/f*.png'))
z=float(sys.argv[3])
ims=[]
for f in fs:
  im=Image.open(f).convert('RGB')
  if z!=1: im=im.resize((int(im.width*z),int(im.height*z)),Image.NEAREST)
  ims.append(im.convert('P',palette=Image.ADAPTIVE,colors=255))
ms=[max(20,m) for m in ms]
ims[0].save(sys.argv[2],save_all=True,append_images=ims[1:],duration=ms,loop=0)
print('wrote',sys.argv[2],len(ims),'frames',sum(ms),'ms')
`, tmp, out, opt.zoom || '1'], { stdio: 'inherit' });
})();
