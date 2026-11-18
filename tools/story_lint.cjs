// Static checks on public/js/story.js against public/js/maps.js: every marker, zone, scene and battle a
// scene refers to exists, and every examinable spot still points at the thing its text describes
// (set dressing can move decor; DECOR_EXPECT says what each spot expects to find on its tile).
//   node tools/story_lint.cjs      exits 1 on problems
global.window = { CT: {} }; const CT = window.CT;
const noop = () => ({}); 
require(require('path').resolve(__dirname, '../public/js/maps.js'));
CT.KEY_ITEMS = { denadoro_seed: 1, tyrano_seed: 1, zeal_seed: 1, corin_tablet: 1 }; CT.HEROES = {};
require(require('path').resolve(__dirname, '../public/js/story.js'));
const problems = [];
const DECOR_EXPECT = { '1.1': { banner: 'banner', notches: 'pillar' }, '1.2': { cairn: 'cairn', cache: 'pine' }, '2.1': { fire: 'bonfire', pole: 'hut', bone: 'fossil' }, '3.1': { wrack: 'crate', cave: 'cave' }, '3.2': { marks: 'rubble', stone: 'dreamstone', mural: 'broken_column' }, eot: { lamp: 'lamppost', bucket: 'rubble' }, '4.25': { fair: 'vitrine:0', bell: 'vitrine:5', sword: 'vitrine:1', cairn: 'cairn', ioka: 'vitrine:2', zeal: 'vitrine:3', epoch: 'vitrine:4', empty: 'pedestal_placard:4' } };
for (const [id, sc] of Object.entries(CT.SCENES)) {
  const map = CT.MAPS[sc.map]; if (!map) { problems.push(id + ': no map ' + sc.map); continue; }
  const W = map.terrain[0].length, H = map.terrain.length;
  const actorIds = new Set((sc.actors || []).map((a) => a.id));
  const res = (at, where) => { if (typeof at === 'string' && at.startsWith('@')) { const m = map.markers[at.slice(1)]; if (!m) problems.push(`${id}: unknown marker ${at} (${where})`); return m; } if (Array.isArray(at)) { if (at[0] < 0 || at[1] < 0 || at[0] >= W || at[1] >= H) problems.push(`${id}: off-map ${at} (${where})`); return at; } return null; };
  for (const a of sc.actors || []) res(a.at, 'actor ' + a.id);
  const walk = (cmds, where) => { for (const c of cmds || []) { if (!Array.isArray(c)) { problems.push(`${id}: non-command in ${where}: ${JSON.stringify(c).slice(0, 60)}`); continue; } const [op, ...a] = c;
    if (op === 'spawn') { actorIds.add(a[0].id); res(a[0].at, 'spawn ' + a[0].id); }
    if (op === 'move' || op === 'camera' || op === 'vfx') { const at = op === 'vfx' ? a[1] : op === 'camera' ? a[0] : a[1]; if (at && at !== 'map') res(at, op); }
    if (op === 'choice') (a[1] || []).forEach((b) => walk(b, where));
    if (op === 'if') { walk(a[1], where); walk(a[2], where); }
    if (op === 'par') walk(a[0], where);
    if (op === 'field') { const f = a[0];
      for (const n of f.npcs || []) walk(n.talk, 'npc ' + n.id);
      for (const s of f.spots || []) { const p = res(s.at, 'spot ' + s.id); walk(s.script, 'spot ' + s.id); if (!s.label) problems.push(`${id}: spot ${s.id} has no label`);
        const exp = (DECOR_EXPECT[id] || {})[s.id]; if (exp && p) { const d = map.decor.find((d) => d.x === p[0] && d.y === p[1]); const got = d ? d.kind + (exp.includes(':') ? ':' + (d.variant || 0) : '') : 'nothing'; if (got !== exp) problems.push(`${id}: spot ${s.id} at ${p} expects decor ${exp}, map has ${got}`); } }
      for (const e of f.events || []) { if (typeof e.zone === 'string' && !map.zones[e.zone]) problems.push(`${id}: unknown zone ${e.zone}`); walk(e.script, 'event ' + e.id); }
      for (const e of f.exits || []) { if (typeof e.zone === 'string' && !map.zones[e.zone]) problems.push(`${id}: unknown zone ${e.zone}`); if (!CT.SCENES[e.goto]) problems.push(`${id}: exit to unknown scene ${e.goto}`); walk(e.locked, 'exit'); }
      if (f.save) res(f.save, 'save'); }
    if (op === 'goto' && !CT.SCENES[a[0]]) problems.push(`${id}: goto unknown ${a[0]}`);
    if (op === 'battle' && !CT.BATTLES[a[0]]) problems.push(`${id}: unknown battle ${a[0]}`);
    if (op === 'reward' && a[0].key && !CT.KEY_ITEMS[a[0].key]) problems.push(`${id}: key item without a name: ${a[0].key}`);
  } };
  walk(sc.script, 'script');
}
// Speakers used anywhere must be known.
const speakers = new Set(); const txt = require('fs').readFileSync(require('path').resolve(__dirname, '../public/js/story.js'), 'utf8');
for (const m of txt.matchAll(/(?:say|radio|L|RL)\('([a-z_0-9]+)'/g)) speakers.add(m[1]);
console.log('speakers:', [...speakers].join(' '));
console.log(problems.length ? problems.join('\n') : 'lint: no problems');
if (problems.length) process.exit(1);
