// Regenerates the scene-by-scene script in docs/SCRIPT.md (between the SCRIPT:BEGIN / SCRIPT:END
// markers) from public/js/story.js, so the document always matches the game.
//   node tools/script_doc.cjs          rewrite docs/SCRIPT.md in place
//   node tools/script_doc.cjs --check  exit 1 if the document is out of date
// Dialogue is copied verbatim; `// comments` inside scene scripts become stage directions;
// battle trigger tables are rendered from the battle data.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const srcPath = path.join(root, 'public/js/story.js');
const docPath = path.join(root, 'docs/SCRIPT.md');
const src = fs.readFileSync(srcPath, 'utf8');

global.window = { CT: { KEY_ITEMS: {}, HEROES: {} } };
require(srcPath);
const CT = global.window.CT;

const NAMES = { crono: 'CRONO', frog: 'FROG', ayla: 'AYLA', magus: 'MAGUS', marle: 'MARLE', lucca: 'LUCCA', robo: 'ROBO', king: 'KING', leene: 'LEENE',
  kino: 'KINO', elder: 'ELDER', gaspar: 'GASPAR', spekkio: 'SPEKKIO', iselle: 'CYRUS', curator: 'THE CURATOR', nu: 'NU', narrator: '' };
const who = (id) => (NAMES[id] != null ? NAMES[id] : id.toUpperCase());
const line = (id, emo, text, tag) => {
  if (id === 'narrator') return tag === 'placard' ? `PLACARD: ${text}` : `*${text}*`;
  if (id === 'curator') return `THE CURATOR: ${text.toUpperCase()}`;
  return `${who(id)} (${tag ? tag + ', ' : ''}${emo}): ${text}`;
};
const condText = (c) => {
  if (Array.isArray(c)) return c.map(condText).join(' and ');
  if (typeof c === 'string') return c.startsWith('!') ? `not ${c.slice(1)}` : c;
  const op = c.eq != null ? `= ${c.eq}` : c.gt != null ? `> ${c.gt}` : c.gte != null ? `>= ${c.gte}` : c.lt != null ? `< ${c.lt}` : '';
  return `${c.flag} ${op}`.trim();
};
const itemName = (k) => ({ tonic: 'Tonic', mid_tonic: 'Mid Tonic', ether: 'Ether', revive: 'Revive', shelter: 'Shelter', magic_tab: 'Magic Tab' }[k] || k);
const KEY_NAMES = { denadoro_seed: 'Denadoro Seed (inert)', tyrano_seed: 'Tyrano Seed (inert)', zeal_seed: 'Zeal Seed (inert)', corin_tablet: `Schala's Record`, ...CT.KEY_ITEMS };

// Stage directions written as comments in story.js, keyed by the text of the command that follows them.
// (Scripts are data; comments only survive in the source, so they are picked up from there.)
const cmdKey = (c) => JSON.stringify(c).slice(0, 90);
function commentsFor(sceneId) {
  const start = src.indexOf(`S${/^[a-z]/.test(sceneId) ? '.' + sceneId : `['${sceneId}']`} = {`);
  if (start < 0) return [];
  const rest = src.slice(start);
  const end = rest.search(/\n  };\n/);
  const out = [];
  let pending = [];
  for (const l of rest.slice(0, end).split('\n')) {
    const t = l.trim();
    if (t.startsWith('//')) pending.push(t.replace(/^\/\/\s?/, ''));
    else if (pending.length && t) {
      // Only comments that sit in front of a script command are stage directions.
      if (/^(\['|say\(|radio\(|V\(|N\(|P\()/.test(t)) out.push({ before: t.slice(0, 40), text: pending.join(' ') });
      pending = [];
    }
  }
  return out;
}

function renderBattle(id, out, ind) {
  const b = CT.BATTLES[id];
  out.push('');
  out.push(`${ind}\`BATTLE ${id} — "${b.name}"\``);
  const party = b.partyOverride || Object.keys(b.party || {});
  const types = {};
  for (const u of b.units || []) types[u.type] = (types[u.type] || 0) + 1;
  out.push(`${ind}- MAP: \`${b.map}\`. MUSIC: \`${b.music}\`. PARTY: ${party.map(who).join(', ')}${(b.guests || []).length ? ` + ${b.guests.map((g) => who(g.id)).join(', ')} (guest)` : ''}.`);
  out.push(`${ind}- ENEMIES: ${Object.entries(types).map(([t, n]) => `${t}${n > 1 ? ' ×' + n : ''}`).join(', ')}.`);
  out.push(`${ind}- OBJECTIVE: ${b.objective.text}${b.objective.secondary ? ` (${b.objective.secondary})` : ''}${b.hatch ? ` If the seed hatches: "${b.hatch.objective.text}"` : ''}`);
  out.push(`${ind}- TRIGGERS:`);
  for (const t of b.triggers || []) {
    const args = t.args ? `(${Object.entries(t.args).map(([k, v]) => `${k}: ${v}`).join(', ')})` : '';
    const parts = [];
    for (const l of t.lines || []) parts.push(line(l[0], l[1], l[2], l[3] && l[3].radio ? 'radio' : ''));
    const walk = (cmds) => {
      for (const c of cmds || []) {
        if (c[0] === 'say') parts.push(line(c[1], c[2], c[3], c[4] && c[4].radio ? 'radio' : ''));
        else if (c[0] === 'popup') parts.push(`[Popup: ${String(c[1]).replace(/<[^>]+>/g, ' ').trim()}]`);
        else if (c[0] === 'choice') { parts.push(`CHOICE: ${c[1].map((o) => `[${o}]`).join(' / ')}`); (c[2] || []).forEach(walk); }
        else if (c[0] === 'if') { parts.push(`(if ${condText(c[1])}:)`); walk(c[2]); if (c[3]) { parts.push('(otherwise:)'); walk(c[3]); } }
        else if (c[0] === 'wait' && c[1] >= 800) parts.push('(beat)');
      }
    };
    walk(t.script);
    const fx = (t.effect || []).map((e) => e.type + (e.tech ? `(${e.tech})` : e.track ? `(${e.track})` : e.unit && typeof e.unit === 'string' ? `(${e.unit})` : '')).join(', ');
    const mode = t.lineMode === 'first_alive' ? ' — first living speaker only' : '';
    out.push(`${ind}  - \`${t.id} ${t.when}${args}\`${t.requires ? ` [requires ${t.requires}]` : ''}${mode}${parts.length ? ' — ' + parts.join(' / ') : ''}${fx ? `${parts.length ? ' ' : ' — '}EFFECT: ${fx}.` : ''}`);
  }
  if (b.rewards) out.push(`${ind}- REWARDS: ${[b.rewards.xp && `EXP ${b.rewards.xp}`, b.rewards.gold && `${b.rewards.gold}G`, ...Object.entries(b.rewards.items || {}).map(([k, n]) => `${itemName(k)} ×${n}`)].filter(Boolean).join(', ')}.`);
  out.push('');
}

function renderScene(id) {
  const sc = CT.SCENES[id];
  const out = [];
  const notes = commentsFor(id);
  // Comments are matched to commands strictly in source order.
  const note = (c, ind) => {
    if (!notes.length) return;
    const k = cmdText(c);
    const n = Math.min(24, notes[0].before.length, k.length);
    if (k.slice(0, n) === notes[0].before.slice(0, n)) out.push(`${ind}*(${notes.shift().text})*`);
  };
  // How a command looks at the start of its source line (enough to match a comment to it).
  const fmt = (x) => (typeof x === 'string' ? `'${x}'` : Array.isArray(x) ? `[${x.map(fmt).join(', ')}]`
    : x && typeof x === 'object' ? `{ ${Object.entries(x).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ')} }` : String(x));
  const cmdText = (c) => {
    if (c[0] === 'say') {
      if (c[1] === 'curator') return 'V(`' + c[3];
      if (c[1] === 'narrator') return (c[4] && c[4].name ? 'P(`' : 'N(`') + c[3];
      return `${c[4] && c[4].radio ? 'radio' : 'say'}('${c[1]}', '${c[2]}', \`${c[3]}`;
    }
    if (c[0] === 'field') return `['field', {`;
    return fmt(c);
  };
  const walk = (cmds, ind) => {
    for (const c of cmds || []) {
      note(c, ind);
      const [op, ...a] = c;
      if (op === 'say') out.push(ind + line(a[0], a[1], a[2], a[3] && a[3].radio ? 'radio' : a[3] && a[3].name ? 'placard' : ''));
      else if (op === 'chapter') out.push(`${ind}Chapter card: **${a[0]}** — ${a[1]}`);
      else if (op === 'text') out.push(`${ind}Text on black: **"${a[0]}"**`);
      else if (op === 'music') out.push(`${ind}MUSIC → ${a[0] ? '`' + a[0] + '`' : 'silence'}.`);
      else if (op === 'popup') out.push(`${ind}[Popup: ${String(a[0]).replace(/<[^>]+>/g, ' ').trim()}]`);
      else if (op === 'join') out.push(`${ind}**${who(a[0])} joins the party.**`);
      else if (op === 'unlock') out.push(`${ind}[Combo tech unlocked: \`${a[0]}\`]`);
      else if (op === 'guest') out.push(`${ind}[${who(a[0])} ${a[1] === false ? 'leaves the guest slot' : 'becomes a guest ally'}.]`);
      else if (op === 'reward') out.push(`${ind}Reward: ${[a[0].xp && `EXP +${a[0].xp}`, a[0].gold && `${a[0].gold}G`, ...Object.entries(a[0].items || {}).map(([k, n]) => `${itemName(k)} ×${n}`), a[0].key && `key item **${KEY_NAMES[a[0].key] || a[0].key}**`].filter(Boolean).join(', ')}.`);
      else if (op === 'shop') out.push(`${ind}[Shop: \`${a[0]}\`]`);
      else if (op === 'wait' && a[0] >= 800) out.push(`${ind}*(beat)*`);
      else if (op === 'choice') {
        out.push(`${ind}CHOICE: ${a[0].map((o) => `[${o}]`).join(' / ')}`);
        (a[1] || []).forEach((br, i) => { const n = out.length; walk(br, ind + '  '); if (out.length > n) out.splice(n, 0, `${ind}- ${a[0][i]}:`); });
      } else if (op === 'if') {
        const n = out.length;
        walk(a[1], ind + '  ');
        const m = out.length;
        if (m > n) out.splice(n, 0, `${ind}- *(if ${condText(a[0])})*`);
        const n2 = out.length;
        walk(a[2], ind + '  ');
        if (out.length > n2) out.splice(n2, 0, `${ind}- *(otherwise)*`);
      } else if (op === 'par') walk(a[0], ind);
      else if (op === 'battle') renderBattle(a[0], out, ind);
      else if (op === 'goto') out.push(`${ind}→ scene \`${a[0]}\``);
      else if (op === 'credits') out.push(`${ind}→ credits`);
      else if (op === 'field') {
        const f = a[0];
        out.push('');
        out.push(`${ind}**FIELD** — the player walks. Objective: ${Array.isArray(f.hint) ? f.hint.map((h) => (typeof h === 'string' ? `"${h}"` : `"${h[1]}" (while ${condText(h[0])})`)).join('; then ') : `"${f.hint}"`}${f.save ? '. Save point' : ''}.`);
        for (const n of f.npcs || []) { out.push(`${ind}- TALK — ${n.name || who(n.id)}${n.if ? ` *(while ${condText(n.if)})*` : ''}:`); walk(n.talk, ind + '  '); }
        for (const s of f.spots || []) { out.push(`${ind}- LOOK (sparkle) — ${s.label}${s.if ? ` *(while ${condText(s.if)})*` : ''}:`); walk(s.script, ind + '  '); }
        for (const e of f.events || []) {
          const ends = JSON.stringify(e.script).includes('"endfield"');
          out.push(`${ind}- WALK-ON — zone \`${Array.isArray(e.zone) ? e.id : e.zone}\`${ends ? ': the field ends and the scene continues.' : ':'}`);
          walk((e.script || []).filter((x) => x[0] !== 'endfield'), ind + '  ');
        }
        for (const e of f.exits || []) {
          out.push(`${ind}- EXIT — \`${e.zone}\` → scene \`${e.goto}\`${e.requires ? ` (needs ${condText(e.requires)}; otherwise:)` : ''}`);
          walk(e.locked, ind + '  ');
        }
        out.push('');
      }
    }
  };
  out.push(`\`[SCENE ${id} — ${sc.title}]\``);
  out.push(`MAP: \`${sc.map}\`${sc.theme ? ` (${sc.theme})` : ''}. MUSIC: \`${sc.music || CT.MAPS_MUSIC || 'none'}\`.`);
  out.push('');
  walk(sc.script, '');
  if (notes.length) console.warn(`scene ${id}: ${notes.length} stage direction(s) not placed, first: "${notes[0].text.slice(0, 50)}"`);
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

const CHAPTERS = [
  ['PROLOGUE — "The Last Firework"', ['0.2', '0.3', '0.4']],
  ['THE END OF TIME (hub, between every chapter)', ['eot', 'spekkio']],
  ['CHAPTER 1 — "The Knight Who Stayed" (600 A.D.)', ['1.1', '1.2', '1.3']],
  ['CHAPTER 2 — "Strong, Then Kind" (65,000,000 B.C.)', ['2.1', '2.2', '2.3']],
  ['CHAPTER 3 — "Schala\'s Name" (12,000 B.C.)', ['3.1', '3.2', '3.3']],
  ['CHAPTER 4 — "The Museum of Never" (The Hollow)', ['4.1', '4.2', '4.25', '4.3', '4.4', '4.5']],
  ['EPILOGUE — "Tomorrow, Unwritten"', ['5.1', '5.2']],
];
const missing = Object.keys(CT.SCENES).filter((id) => !CHAPTERS.some(([, ids]) => ids.includes(id)));
if (missing.length) throw new Error('scenes missing from tools/script_doc.cjs CHAPTERS: ' + missing.join(', '));

let body = '';
for (const [title, ids] of CHAPTERS) {
  body += `## ${title}\n\n`;
  for (const id of ids) body += renderScene(id) + '\n\n';
  body += '---\n\n';
}
const stills = (CT.CREDITS.stills || []).map((s) => `- ${s.caption}${(s.variants || []).map((v) => ` *(if ${condText(v.if)}: "${v.caption}")*`).join('')}`).join('\n');
body += `\`[SCENE 5.3 — Credits]\`\nMUSIC: \`mus_credits\`. Stills, in order:\n${stills}\n`;

const BEGIN = '<!-- SCRIPT:BEGIN (generated by tools/script_doc.cjs from public/js/story.js; do not edit by hand) -->';
const END = '<!-- SCRIPT:END -->';
const doc = fs.readFileSync(docPath, 'utf8');
const i = doc.indexOf(BEGIN);
const j = doc.indexOf(END);
if (i < 0 || j < 0) throw new Error('docs/SCRIPT.md is missing the SCRIPT:BEGIN / SCRIPT:END markers');
const next = doc.slice(0, i + BEGIN.length) + '\n\n' + body + '\n' + doc.slice(j);
if (process.argv.includes('--check')) {
  if (next !== doc) { console.error('docs/SCRIPT.md is out of date: run node tools/script_doc.cjs'); process.exit(1); }
  console.log('docs/SCRIPT.md matches public/js/story.js');
} else {
  fs.writeFileSync(docPath, next);
  console.log(`docs/SCRIPT.md: script section regenerated (${body.split('\n').length} lines)`);
}
