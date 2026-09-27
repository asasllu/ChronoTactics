// Hand-pixelled sprite sheets and effect sheets.
//
// Every frame is authored by hand as letter rows (see tools/crono_lab/ANIM_SPEC.md).
// A sheet replaces the procedural rig for its key: CT.getSprite() returns a sprite
// object with the same interface as a rig sprite (anims per screen direction,
// frame(anim, dir, t, opts), charge/release markers), so the battle and scene code
// plays it unchanged.
//
//   CT.sheet('crono', {
//     pal: { H: '#580000', ... },        // letter -> colour, shared by every frame
//     w: 40, h: 52, anchor: [20, 48],    // frame canvas and the ground point between the feet
//     parts: { head_se: [...rows] },     // optional reusable hand-drawn pieces
//     se: { idle: { loop: true, frames: [{ ms: 400, rows: [...] }, ...] }, walk: {...}, ... },
//     ne: { ... },                       // back view; falls back to se
//   });
//
// A frame is { ms, rows } (a full hand-drawn frame placed at frame.at || def.at || [0, 0]),
// or { ms, base: 'idle.0', draw: [ops] }
// (a copy of another frame of the same view, 'view:anim.i' for another view, then edits):
//   ['part', name, x, y, 'h']   stamp a named part (optionally mirrored)
//   ['rows', x, y, [rows]]      stamp inline rows ('.' transparent, '_' erases)
//   ['erase', x, y, w, h]       clear a rectangle
//   ['move', x, y, w, h, dx, dy] cut a rectangle and paste it shifted
//   ['px', x, y, c]             one pixel
//   ['recolor', from, to]       swap one letter for another everywhere
// Optional frame fields: dx, dy (shift the whole frame in game px: lunges, hops),
// glow: [x, y] (where charge sparks gather), sfx (played when the frame starts).
// Animation fields: loop, charge: [i, j] (frames looped while charging), release: i,
// hit: i (the frame where the blow lands), rim: '#hex' (magic rim light on glow frames).
(function () {
  const CT = (window.CT = window.CT || {});
  CT.SHEETS = CT.SHEETS || {};
  CT.FXS = CT.FXS || {};
  CT.sheet = (key, def) => { CT.SHEETS[key] = def; };
  CT.fxSheet = (key, def) => { CT.FXS[key] = def; };
  // How a tech (or 'attack_<unitKey>' for a unit's basic attack) is staged:
  //   { anim: 'tech_cyclone',  caster animation (default: cast for magic, attack for blows)
  //     fx: 'fx_lightning',    played on the target tile, or on every tile of an area
  //     casterFx: 'fx_...',    played on the caster when the blow lands / the spell releases
  //     proj: 'fx_...',        flies from caster to target (looping frames) before fx
  //     stagger: 40,           ms between tiles of an area
  //     charge: false }        skip the charge-up (instant techs)
  CT.TECH_FX = CT.TECH_FX || {};
  CT.techFx = (id, spec) => { CT.TECH_FX[id] = spec; };

  const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  // ---- Letter grids --------------------------------------------------------------
  function blank(w, h) { return { w, h, a: new Array(w * h).fill('') }; }
  function stamp(g, x0, y0, rows, flip) {
    const wmax = Math.max(0, ...rows.map((r) => r.length));
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) {
        const c = r[i];
        if (c === '.' || c === ' ') continue;
        const x = x0 + (flip ? wmax - 1 - i : i), y = y0 + j;
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
        g.a[y * g.w + x] = c === '_' ? '' : c;
      }
    });
  }
  function applyOps(g, ops, parts, where) {
    for (const op of ops || []) {
      const [k] = op;
      if (k === 'part') {
        const rows = parts && parts[op[1]];
        if (!rows) { console.warn('sheet: missing part', op[1], where); continue; }
        stamp(g, op[2], op[3], rows, op[4] === 'h');
      } else if (k === 'rows') stamp(g, op[1], op[2], op[3]);
      else if (k === 'erase') {
        for (let y = op[2]; y < op[2] + op[4]; y++) for (let x = op[1]; x < op[1] + op[3]; x++) if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.a[y * g.w + x] = '';
      } else if (k === 'move') {
        const [, x0, y0, w, h, dx, dy] = op;
        const cut = [];
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
          if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
          const c = g.a[y * g.w + x];
          if (c) cut.push([x + dx, y + dy, c]);
          g.a[y * g.w + x] = '';
        }
        for (const [x, y, c] of cut) if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.a[y * g.w + x] = c;
      } else if (k === 'px') {
        const [, x, y, c] = op;
        if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.a[y * g.w + x] = c === '_' ? '' : c;
      } else if (k === 'recolor') {
        for (let i = 0; i < g.a.length; i++) if (g.a[i] === op[1]) g.a[i] = op[2];
      } else console.warn('sheet: unknown op', k, where);
    }
  }

  // Resolve every frame of a sheet (or fx sheet) to letter grids. Returns
  // { view: { anim: [grid...] } }. Frames may copy other frames ('idle.0', 'ne:walk.2').
  function resolveGrids(def, views) {
    const W = def.w, H = def.h;
    const memo = {};
    const get = (view, anim, i, depth) => {
      const id = `${view}:${anim}.${i}`;
      if (memo[id]) return memo[id];
      if (depth > 20) throw new Error('sheet: base cycle at ' + id);
      const a = (def[view] || {})[anim];
      const fr = a && a.frames[i];
      if (!fr) throw new Error(`sheet ${def.key}: no frame ${id}`);
      let g;
      if (fr.base) {
        const m = /^(?:(\w+):)?(\w+)\.(\d+)$/.exec(fr.base);
        if (!m) throw new Error(`sheet ${def.key}: bad base '${fr.base}' at ${id}`);
        const src = get(m[1] || view, m[2], +m[3], depth + 1);
        g = { w: W, h: H, a: src.a.slice() };
      } else g = blank(W, H);
      const at = fr.at || def.at || [0, 0];
      if (fr.rows) stamp(g, at[0], at[1], fr.rows);
      applyOps(g, fr.draw, def.parts, id);
      return (memo[id] = g);
    };
    const out = {};
    for (const view of views) {
      if (!def[view]) continue;
      out[view] = {};
      for (const anim of Object.keys(def[view])) out[view][anim] = def[view][anim].frames.map((_, i) => get(view, anim, i, 0));
    }
    return out;
  }

  function toCanvas(g, pal, key) {
    const cv = document.createElement('canvas');
    cv.width = g.w;
    cv.height = g.h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const img = ctx.createImageData(g.w, g.h);
    const cache = {};
    const missing = new Set();
    for (let i = 0; i < g.a.length; i++) {
      const c = g.a[i];
      if (!c) continue;
      const hex = pal[c];
      if (!hex) { missing.add(c); continue; }
      const rgb = cache[c] || (cache[c] = hexRGB(hex));
      img.data[i * 4] = rgb[0];
      img.data[i * 4 + 1] = rgb[1];
      img.data[i * 4 + 2] = rgb[2];
      img.data[i * 4 + 3] = 255;
    }
    if (missing.size) console.warn(`sheet ${key}: letters without colour: ${[...missing].join('')}`);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  CT.SHEET_UTIL = { resolveGrids, toCanvas, stamp, applyOps };

  // ---- Character sheets -> sprite objects ----------------------------------------------
  const DIRS = ['south-east', 'south-west', 'north-east', 'north-west', 'south'];

  function makeFrame(def, g, fr, anchor, anim, i, key) {
    const img = toCanvas(g, def.pal, key);
    const f = CT.PX.frameOf(img);
    // The renderer anchors frames at (cx, footY); dx/dy shift the whole frame.
    f.cx = anchor[0] - (fr.dx || 0);
    f.footY = anchor[1] + 1 - (fr.dy || 0);
    f.ms = fr.ms || 120;
    if (fr.sfx) f.sfx = fr.sfx;
    // Portrait crop centre: def.head, else the face of a ~44 px human.
    const head = def.head || [anchor[0], Math.max(4, anchor[1] - 34)];
    f.J = { head: { x: head[0], y: head[1] } };
    const glow = fr.glow || (anim.glow && anim.glow[i]);
    if (glow) {
      const col = anim.rim || def.magic;
      f.glow = { x: glow[0], y: glow[1], color: col || '#e0c0fc' };
      if (anim.rim && CT.PX.rimLight) {
        const cv = CT.PX.canvas(img.width, img.height, (c) => c.drawImage(img, 0, 0));
        f.img = CT.PX.rimLight(cv, glow[0], glow[1], anim.rim, i === anim.release ? 22 : 15);
        f.flash = CT.PX.flashOf(f.img);
      }
    }
    return f;
  }
  const mirrorFrame = (f) => {
    const img = CT.PX.mirror(f.img);
    return Object.assign({}, f, { img, flash: CT.PX.flashOf(img), cx: f.img.width - f.cx, glow: f.glow && Object.assign({}, f.glow, { x: f.img.width - f.glow.x }) });
  };

  // Every authored colour joins the master palette once, so the screen quantiser
  // shows it exactly.
  let palDone = 0;
  function ensurePalette() {
    const n = Object.keys(CT.SHEETS).length + Object.keys(CT.FXS).length;
    if (palDone === n || !CT.PAL || !CT.PAL.extend) return;
    palDone = n;
    const all = [];
    for (const d of [...Object.values(CT.SHEETS), ...Object.values(CT.FXS)]) all.push(...Object.values(d.pal || {}));
    for (const a of Object.values(CT.SHEETS)) if (a.magic) all.push(a.magic);
    CT.PAL.extend(all);
  }
  CT.ensureSheetPalette = ensurePalette;

  CT.makeSheetSprite = function (key) {
    ensurePalette();
    const def = CT.SHEETS[key];
    def.key = key;
    const grids = resolveGrids(def, ['se', 'ne']);
    const anchorOf = (view) => (def[view + 'Anchor'] || def.anchor);
    const dirs = {};
    const names = new Set([...Object.keys(def.se || {}), ...Object.keys(def.ne || {})]);
    for (const name of names) {
      const aSe = (def.se || {})[name] || (def.ne || {})[name];
      const aNe = (def.ne || {})[name] || aSe;
      const vSe = (def.se || {})[name] ? 'se' : 'ne';
      const vNe = (def.ne || {})[name] ? 'ne' : vSe;
      const se = aSe.frames.map((fr, i) => makeFrame(def, grids[vSe][name][i], fr, anchorOf(vSe), aSe, i, key));
      const ne = vNe === vSe ? se : aNe.frames.map((fr, i) => makeFrame(def, grids[vNe][name][i], fr, anchorOf(vNe), aNe, i, key));
      const total = aSe.frames.reduce((s, f) => s + (f.ms || 120), 0);
      dirs[name] = {
        loop: !!aSe.loop, charge: aSe.charge, release: aSe.release, hit: aSe.hit, total,
        'south-east': se, 'north-east': ne, 'south-west': se.map(mirrorFrame), 'north-west': ne.map(mirrorFrame),
      };
      dirs[name].south = dirs[name]['south-east'];
    }
    if (!dirs.idle) throw new Error(`sheet ${key}: needs an idle animation`);
    // Missing standard animations fall back to something sensible.
    const alias = { walk: 'idle', attack: 'idle', cast: 'attack', shoot: 'attack', hurt: 'idle', ko: 'hurt', kneel: 'idle', victory: 'idle' };
    for (const n of Object.keys(alias)) if (!dirs[n]) dirs[n] = dirs[alias[n]] || dirs.idle;
    const spr = {
      rig: true, sheet: true, def,
      koRotate: !(def.se && def.se.ko),
      anims: dirs,
      frame(anim, dir, t = 0, opts = {}) {
        let a = dirs[anim] || dirs.idle;
        let list = a[dir] || a['south-east'];
        if (opts.charge && a.charge) {
          const idx = a.charge[Math.floor(t / (list[a.charge[0]].ms || 160)) % a.charge.length];
          return list[idx];
        }
        let tt = a.loop ? t % a.total : Math.min(t, a.total - 1);
        for (const f of list) {
          if (tt < f.ms) return f;
          tt -= f.ms;
        }
        return list[list.length - 1];
      },
      // ms from the start of an animation to the start of frame i.
      at(anim, i) {
        const a = dirs[anim];
        return a ? a['south-east'].slice(0, i).reduce((s, f) => s + f.ms, 0) : 0;
      },
    };
    spr.frames = {};
    for (const d of DIRS) spr.frames[d] = dirs.idle[d][0];
    return spr;
  };

  // ---- Effect sheets ---------------------------------------------------------------------
  //   CT.fxSheet('fx_lightning', {
  //     pal, w, h, anchor: [x, y],     // anchor lands on the target tile's centre (ground)
  //     frames: [{ ms, rows | base/draw, dx, dy }],
  //     layer: 'front' | 'back',       // drawn over or under units (default front)
  //     loop: false, shake: 0..8, flash: '#hex' (screen flash on frame `flashAt`)
  //   });
  const fxCache = {};
  CT.getFx = function (key) {
    if (fxCache[key]) return fxCache[key];
    const def = CT.FXS[key];
    if (!def) return null;
    ensurePalette();
    def.key = key;
    const wrap = { w: def.w, h: def.h, at: def.at, parts: def.parts, key, fx: { a: { frames: def.frames } } };
    const grids = resolveGrids(wrap, ['fx']).fx.a;
    const frames = def.frames.map((fr, i) => ({ img: toCanvas(grids[i], def.pal, key), ms: fr.ms || 70, dx: fr.dx || 0, dy: fr.dy || 0 }));
    const total = frames.reduce((s, f) => s + f.ms, 0);
    return (fxCache[key] = { def, frames, total, anchor: def.anchor || [def.w >> 1, def.h - 1] });
  };
  CT.fxFrame = function (fx, t) {
    let tt = fx.def.loop ? t % fx.total : t;
    if (tt >= fx.total) return null;
    for (const f of fx.frames) {
      if (tt < f.ms) return f;
      tt -= f.ms;
    }
    return null;
  };

  // ---- Loading ------------------------------------------------------------------------
  // Sheet files live in js/sheets/. The list is public/js/sheets/manifest.js
  // (CT.SHEET_FILES); `?nosheets` in the URL keeps the old rigs for comparison.
  CT.loadSheets = async function () {
    if (/[?&]nosheets\b/.test(location.search)) return;
    const files = CT.SHEET_FILES || [];
    await Promise.all(files.map((f) => new Promise((res) => {
      const s = document.createElement('script');
      s.src = `js/sheets/${f}.js`;
      s.onload = res;
      s.onerror = () => { console.warn('sheet file not found (not authored yet?)', f); res(); };
      document.head.appendChild(s);
    })));
    ensurePalette();
  };
})();
