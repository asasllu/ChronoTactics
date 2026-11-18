// Game feel: the small things that make a hit land. Damage numbers, hit sparks and dust,
// afterimages and tints on units, ground residue left by spells, KO dissolves, status
// icons and auras, the turn banner, battle cards and screen transitions.
//
// Everything here extends CT.Renderer (js/render.js calls the hooks) and is drawn as hard
// palette pixels on the 33 ms step clock, like the rest of the effects. Nothing in this
// file changes a battle rule or a number: it only shows them.
(function () {
  const CT = window.CT;
  const PXD = CT.PXD;
  const RAMPS = CT.FX_RAMPS;
  const P = CT.Renderer.prototype;
  const TAU = Math.PI * 2;
  const STEP = 33;
  const INK = '#0a0612';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hashI = (a, b, c = 0) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const sfx = (id) => CT.audio && CT.audio.sfx(id);
  const FEEL = (CT.FEEL = CT.FEEL || {});
  FEEL.hashI = hashI;

  // Letter rows -> canvas ('.' transparent).
  function mk(rows, pal) {
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    return CT.PX.canvas(w, h, (g) => {
      rows.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) {
          const c = pal[r[x]];
          if (!c) continue;
          g.fillStyle = c;
          g.fillRect(x, y, 1, 1);
        }
      });
    });
  }
  FEEL.mk = mk;
  // A sprite recoloured flat (silhouette) or mapped to a grey ramp; cached per source image.
  const tintCache = new WeakMap();
  function tintOf(img, hex) {
    let m = tintCache.get(img);
    if (!m) tintCache.set(img, (m = {}));
    if (!m[hex]) {
      m[hex] = CT.PX.canvas(img.width, img.height, (g) => {
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = hex;
        g.fillRect(0, 0, img.width, img.height);
      });
    }
    return m[hex];
  }
  function rampOf(img, ramp, key) {
    let m = tintCache.get(img);
    if (!m) tintCache.set(img, (m = {}));
    if (!m[key]) {
      const rgb = ramp.map((h) => CT.PAL.hex(h));
      m[key] = CT.PX.canvas(img.width, img.height, (g) => {
        g.drawImage(img, 0, 0);
        const im = g.getImageData(0, 0, img.width, img.height);
        const d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue;
          const l = (d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 2) / 2550; // 0..1
          const c = rgb[clamp(Math.floor((1 - l) * rgb.length), 0, rgb.length - 1)];
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        }
        g.putImageData(im, 0, 0);
      });
    }
    return m[key];
  }
  FEEL.tintOf = tintOf;
  FEEL.rampOf = rampOf;

  // ---- Damage / heal numbers ---------------------------------------------------------
  // Colour language (top / middle / bottom of each glyph):
  //   damage white, critical gold-to-red and double size, weak yellow, resisted grey,
  //   heal green, MP blue, miss pale slate, status pink, buff light green, KO red.
  const NUM = {
    dmg: ['#ffffff', '#ffffff', '#bcc0d4'],
    crit: ['#fff4b0', '#f8bc3c', '#f06c4c'],
    weak: ['#fff4b0', '#fce068', '#f8bc3c'],
    resist: ['#bcc0d4', '#9294b0', '#6e7090'],
    burn: ['#fce068', '#e88c28', '#c05c1c'],
    heal: ['#d4ec94', '#a8d45c', '#74b43c'],
    mp: ['#c4e4ff', '#8cc0f0', '#5c90dc'],
    miss: ['#e4e8f0', '#bcc0d4', '#9294b0'],
    status: ['#f8b0c8', '#f090b4', '#e0709c'],
    buff: ['#d4ec94', '#d4ec94', '#a8d45c'],
    ko: ['#f06c4c', '#d43c3c', '#a02030'],
    immune: ['#ffffff', '#c4e4ff', '#8cc0f0'],
    learn: ['#fff4b0', '#fce068', '#f8bc3c'],
    info: ['#ffffff', '#ffffff', '#e4e8f0'],
    flash: ['#ffffff', '#ffffff', '#ffffff'],
  };
  const LIFE = { crit: 1150, learn: 1500, ko: 1200 };
  // Old call sites pass a colour: map it onto the language above.
  const LEGACY = {
    '#80ff90': 'heal', '#80c0ff': 'mp', '#ffe080': 'learn', '#fce068': 'learn', '#ff6060': 'ko', '#c0c8ff': 'miss',
    '#ffd0f0': 'status', '#ff9040': 'burn', '#c0f0ff': 'immune', '#ff6040': 'crit', '#ffe040': 'weak',
  };
  const glyphs = new Map();
  function glyph(ch, kind, s) {
    const k = ch + '|' + kind + '|' + s;
    let cv = glyphs.get(k);
    if (cv) return cv;
    const cols = (NUM[kind] || NUM.info).map((h) => CT.PAL.hex(h));
    cv = CT.PX.canvas(5 * s + 2, 7 * s + 3, (g) => {
      PXD.text(g, ch, 1, 1, '#ffffff', { scale: s });
      const im = g.getImageData(0, 0, 5 * s + 2, 7 * s + 3);
      const d = im.data;
      for (let y = 0; y < im.height; y++) {
        const row = Math.floor((y - 1) / s);
        const c = cols[row < 3 ? 0 : row < 5 ? 1 : 2];
        for (let x = 0; x < im.width; x++) {
          const i = (y * im.width + x) * 4;
          if (d[i + 3] && d[i] === 255) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
        }
      }
      g.putImageData(im, 0, 0);
    });
    glyphs.set(k, cv);
    return cv;
  }

  // Pop a number or word over a unit. kind: see NUM. o: { big, delay, tag (a small
  // call-out stacked above it, e.g. 'WEAK!') }.
  P.pop = function (u, text, kind = 'info', o = {}) {
    const now = performance.now();
    text = String(text).toUpperCase();
    const s = o.big || kind === 'crit' ? 2 : 1;
    const w = text.length * 6 * s - s, h = 7 * s;
    const [px, py] = this.project(u.x != null ? u.x : u.rx, u.y != null ? u.y : u.ry, u.rh || 0);
    const tall = u._sy != null && u._headY != null ? clamp(u._sy - u._headY, 20, 80) : 38;
    let x = clamp(Math.round(px), (w >> 1) + 3, this.W - (w >> 1) - 3);
    let y = Math.round(py) - tall - 8 - h;
    // Never on top of another fresh number: climb until clear.
    for (let guard = 0; guard < 12; guard++) {
      const hit = this.floaters.find((f) => now - f.t0 < 620 && Math.abs(f.x - x) < (f.w + w) / 2 + 2 && y < f.y + f.h + 2 && y + h + 2 > f.y);
      if (!hit) break;
      y = hit.y - h - 3;
    }
    if (y < 34) y = 34 + ((this.floaters.length * 5) % 9); // stay clear of the turn bar
    const f = { x, y, w, h, s, text, kind, t0: now + (o.delay || 0), life: LIFE[kind] || 980 };
    this.floaters.push(f);
    if (o.tag) this.pop(u, o.tag, o.tagKind || kind, { delay: (o.delay || 0) + 70 });
    return f;
  };
  // Legacy signature (colour, big) kept for scene and spot code.
  P.floatText = function (u, text, color, big) {
    const kind = NUM[color] ? color : LEGACY[String(color || '').toLowerCase()] || 'info';
    return this.pop(u, text, kind, { big: !!big && String(text).length < 8 });
  };
  P.drawFloaters = function (now) {
    const ctx = this.ctx;
    this.floaters = this.floaters.filter((f) => now - f.t0 < f.life);
    for (const f of this.floaters) {
      const t = now - f.t0;
      if (t < 0) continue;
      const left = f.life - t;
      if (left < 170 && Math.floor(now / 40) % 2) continue; // blink out
      const rise = Math.round((t / f.life) * 3) + (left < 170 ? Math.round((170 - left) / 28) : 0);
      const adv = 6 * f.s;
      let x0 = Math.round(f.x - f.w / 2);
      if (f.kind === 'crit') {
        if (t < 190) x0 += Math.floor(t / STEP) % 2 ? 1 : -1;
        if (t < 150) {
          // A spiked burst behind a critical number.
          const st = Math.floor(t / STEP), r = 7 + st * 3;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.39;
            ctx.fillStyle = i % 2 ? '#f8bc3c' : '#fff4b0';
            PXD.line(ctx, f.x + Math.cos(a) * r * 0.5, f.y + 6 + Math.sin(a) * r * 0.35, f.x + Math.cos(a) * (r + 5), f.y + 6 + Math.sin(a) * (r + 5) * 0.6, st < 2 ? 2 : 1);
          }
        }
      }
      for (let i = 0; i < f.text.length; i++) {
        const tc = t - i * 26;
        if (tc < 0) break;
        const ch = f.text[i];
        if (ch === ' ') continue;
        const k = Math.min(1, tc / 300);
        const hop = k < 0.55 ? Math.sin((k / 0.55) * Math.PI) : 0.3 * Math.sin(((k - 0.55) / 0.45) * Math.PI);
        const oy = Math.round(hop * (4 + 3 * f.s));
        ctx.drawImage(glyph(ch, tc < 50 && f.kind !== 'miss' ? 'flash' : f.kind, f.s), x0 + i * adv - 1, f.y - rise - oy - 1);
      }
    }
  };

  // ---- Camera follow for effects -------------------------------------------------------
  // Particles, rings, bolts and numbers live in screen space; when the camera glides they
  // are carried along, so nothing drifts off its tile.
  P.shiftFx = function (dx, dy) {
    for (const f of this.floaters) { f.x += dx; f.y += dy; }
    for (const p of this.parts) { p.x += dx; p.y += dy; }
    for (const r of this.rings) { r.x += dx; r.y += dy; }
    for (const b of this.bolts) { b.x += dx; b.y += dy; }
    for (const s of this.shots) { s.from = [s.from[0] + dx, s.from[1] + dy]; s.to = [s.to[0] + dx, s.to[1] + dy]; }
    for (const r of this.rains) { r.x += dx; r.y += dy; }
    for (const b of this.bits || []) {
      b.x += dx; b.y += dy; b.x0 += dx; b.y0 += dy;
      if (b.cx != null) { b.cx += dx; b.cy += dy; }
      if (b.floor != null) b.floor += dy;
    }
    for (const b of this.big) if (b.c) b.c = [b.c[0] + dx, b.c[1] + dy];
    for (const m of this.mids || []) if (m.sx != null) { m.sx += dx; m.sy += dy; }
    for (const p of this.posts || []) if (p.sx != null) { p.sx += dx; p.sy += dy; }
  };

  // ---- Hit-stop and zoom punch ---------------------------------------------------------
  // Freeze unit animations and effect sheets for a few frames on a heavy blow.
  P.hitStop = function (ms) {
    const now = performance.now();
    const until = now + ms;
    if (this.world) {
      for (const u of this.world.units) {
        if (!u.anim) continue;
        u._freeze = { until, t: now - u.anim.t0 };
        u.anim.t0 += ms;
      }
    }
    for (const e of this.sheetFx) {
      if (now < e.t0) continue;
      e._freeze = { until, t: now - e.t0 };
      e.t0 += ms;
    }
    return ms;
  };
  // A quick push-in on a point of the screen (critical hits, boss deaths).
  P.zoomPunch = function (sx, sy, amt = 0.07, ms = 170) {
    this._zoom = { sx, sy, amt, ms, t0: performance.now() };
  };
  P.drawZoom = function (now) {
    const z = this._zoom;
    if (!z) return;
    const k = (now - z.t0) / z.ms;
    if (k >= 1) { this._zoom = null; return; }
    const e = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
    const s = 1 + z.amt * Math.round(e * 4) / 4;
    if (s <= 1.001) return;
    const ctx = this.ctx;
    const w = this.W / s, h = this.H / s;
    const x = clamp(z.sx - w / 2, 0, this.W - w), y = clamp(z.sy - h / 2, 0, this.H - h);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.cv, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, this.W, this.H);
    ctx.restore();
  };

  // ---- Extra impact bits ---------------------------------------------------------------
  const PUFF = [
    ['.aa.', 'abbc', '.bc.'],
    ['.aab..', 'aabbbc', 'abbbcc', '.bcc..'],
    ['..aab...', '.aabbbc.', 'aabbbbcc', 'abbbbccc', '.bbccc..'],
    ['..a.b...', '.a.b.b..', 'a.b.b.c.', '.b.b.c..', '..b.c...'],
    ['..a.....', '.....b..', '.b......', '....c...'],
  ];
  const DUSTS = {
    dirt: { a: '#c0aa92', b: '#9c8674', c: '#7a665a' },
    stone: { a: '#e4e8f0', b: '#bcc0d4', c: '#9294b0' },
    snow: { a: '#ffffff', b: '#e4e8f0', c: '#bcc0d4' },
    smoke: { a: '#6e7090', b: '#52526e', c: '#3a3a52' },
    dark: { a: '#6c3094', b: '#4a1c6c', c: '#2a1040' },
    steam: { a: '#ffffff', b: '#c4e4ff', c: '#8cc0f0' },
  };
  const puffCv = {};
  const puffs = (tone) => puffCv[tone] || (puffCv[tone] = PUFF.map((r) => mk(r, DUSTS[tone] || DUSTS.dirt)));
  const HITSTAR = [
    ['....w....', '....w....', '.y..w..y.', '..y.w.y..', 'wwwwwwwww', '..y.w.y..', '.y..w..y.', '....w....', '....w....'],
    ['....y....', '...ywy...', '..ywwwy..', '.ywwwwwy.', 'ywwwwwwwy', '.ywwwwwy.', '..ywwwy..', '...ywy...', '....y....'],
    ['....y....', '...y.y...', '..y...y..', '.y.....y.', 'y.......y', '.y.....y.', '..y...y..', '...y.y...', '....y....'],
    ['....y....', '.........', '.........', '.........', 'y.......y', '.........', '.........', '.........', '....y....'],
  ];
  const starCv = {};
  const hitStars = (ramp) => {
    const k = ramp[1] + ramp[2];
    return starCv[k] || (starCv[k] = HITSTAR.map((r) => mk(r, { w: '#ffffff', y: ramp[1] })));
  };
  const WISP = [
    ['.a.', 'a..', '.a.', '..a', '.a.'],
    ['..a', '.a.', 'a..', '.a.', '..a'],
    ['a..', '.a.', '..a', '.a.', 'a..'],
  ];
  let wispCv = null;

  // Called by Renderer.scatter for the kinds below.
  P.bitInit = function (k, d, a, sp, x, y, gy, opts) {
    const rnd = Math.random;
    if (k === 'puff') Object.assign(d, { x: x + (rnd() - 0.5) * (opts.spread || 8), y: gy - rnd() * 2, vx: Math.cos(a) * 0.35 * (opts.speed || 1) + (opts.vx || 0), vy: -0.12 - rnd() * 0.18, life: 380 + rnd() * 200, tone: opts.tone || 'dirt' });
    else if (k === 'flake') Object.assign(d, { vx: (rnd() - 0.5) * 0.5, vy: -0.5 - rnd() * 0.7, g: -0.006, life: 520 + rnd() * 420, drag: 0.985 });
    else if (k === 'orb') Object.assign(d, { x: x + (rnd() - 0.5) * (opts.spread || 18), y: y + (rnd() - 0.2) * 16, vx: 0, vy: -0.22 - rnd() * 0.2, life: 800 + rnd() * 600 });
    else if (k === 'flash') Object.assign(d, { x, y, life: 150 });
    else if (k === 'wisp') Object.assign(d, { x: x + (rnd() - 0.5) * 8, y: gy - 2, vx: 0, vy: -0.16 - rnd() * 0.1, life: 700 + rnd() * 500 });
    else if (k === 'ripple') Object.assign(d, { x, y: gy, life: 520, r: opts.r || 9 });
    else if (k === 'chip') Object.assign(d, { vx: Math.cos(a) * sp * 1.2, vy: -1.3 - rnd() * 1.2, g: 0.12, life: 600 + rnd() * 250, floor: gy + rnd() * 5 - 1, tone: opts.tone });
  };
  // Called by Renderer.drawBits for kinds it does not know.
  P.drawBitX = function (b, x, y, k, st, R, t) {
    const ctx = this.ctx;
    switch (b.k) {
      case 'puff': {
        const fr = puffs(b.tone)[Math.min(4, Math.floor(k * 5))];
        ctx.drawImage(fr, x - (fr.width >> 1), y - fr.height);
        break;
      }
      case 'flake': {
        // A square of the archive's paper: it turns over as it rises.
        if (k > 0.8 && st % 2) break;
        const o = (st + Math.floor(b.ph)) % 4;
        ctx.fillStyle = R[Math.min(5, 1 + Math.floor(k * 4))];
        if (o === 0) ctx.fillRect(x, y, 2, 2);
        else if (o === 1) ctx.fillRect(x, y, 2, 1);
        else if (o === 2) ctx.fillRect(x, y, 1, 1);
        else ctx.fillRect(x, y, 1, 2);
        if (o === 0 && k < 0.5) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); }
        break;
      }
      case 'orb': {
        // A soft mote of light that sways as it climbs.
        if (k > 0.82 && st % 2) break;
        const sx = x + Math.round(Math.sin(t / 210 + b.ph) * 2);
        const big = k > 0.12 && k < 0.7;
        ctx.fillStyle = R[2];
        if (big) { ctx.fillRect(sx - 1, y, 3, 1); ctx.fillRect(sx, y - 1, 1, 3); }
        ctx.fillStyle = k < 0.5 ? '#ffffff' : R[1];
        ctx.fillRect(sx, y, 1, 1);
        break;
      }
      case 'flash': {
        const fr = hitStars(R)[Math.min(3, Math.floor(k * 4))];
        ctx.drawImage(fr, x - 4, y - 4);
        break;
      }
      case 'wisp': {
        if (!wispCv) wispCv = WISP.map((r) => [mk(r, { a: '#52526e' }), mk(r, { a: '#3a3a52' })]);
        if (k > 0.7 && st % 2) break;
        const fr = wispCv[(st >> 2) % 3][k < 0.5 ? 0 : 1];
        ctx.drawImage(fr, x - 1, y - 5);
        break;
      }
      case 'ripple': {
        const rr = Math.max(1, Math.round(b.r * (0.25 + 0.75 * k)));
        ctx.fillStyle = k < 0.4 ? '#ffffff' : k < 0.75 ? R[1] : R[3];
        PXD.ellipseRing(ctx, x, y, rr, Math.max(1, rr >> 1));
        break;
      }
      case 'chip': {
        if (k > 0.75 && st % 2) break;
        const tone = DUSTS[b.tone] || DUSTS.stone;
        ctx.fillStyle = tone.c; ctx.fillRect(x, y, 2, 2);
        ctx.fillStyle = tone.a; ctx.fillRect(x, y, 1, 1);
        break;
      }
    }
  };

  // Sparks thrown out of a hit, away from the attacker; a flash star on the contact point.
  P.hitSpark = function (v, from, o = {}) {
    const [tx, ty] = this.unitScreenPos(v);
    let dx = 0, dy = -1;
    if (from) {
      const [fx, fy] = this.unitScreenPos(from);
      const d = Math.hypot(tx - fx, ty - fy);
      if (d > 2) { dx = (tx - fx) / d; dy = (ty - fy) / d; }
    }
    const ramp = RAMPS[o.elem] || RAMPS.hit;
    const cx = tx - dx * 4, cy = ty - 15 - dy * 3;
    const n = o.n || (o.heavy ? 12 : 6);
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * 1.5;
      const sp = (o.heavy ? 2.6 : 1.9) * (0.5 + Math.random());
      this.addBit({ k: 'spark', x: cx, y: cy + (Math.random() - 0.5) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 0.5, g: 0.06, life: 170 + Math.random() * 170, drag: 0.93, ramp, ph: Math.random() * 100 });
    }
    this.addBit({ k: 'flash', x: cx, y: cy, life: o.heavy ? 180 : 130, ramp });
    if (o.heavy) this.dust(v, 4, { vx: dx * 0.4 });
  };
  // Dust kicked up at a unit's feet (or at a screen point [x, y]).
  P.dust = function (at, n = 2, o = {}) {
    let sx, sy, tone = o.tone;
    if (Array.isArray(at)) [sx, sy] = at;
    else {
      [sx, sy] = this.unitScreenPos(at);
      if (!tone) tone = this.groundTone(Math.round(at.rx), Math.round(at.ry));
    }
    this.scatter('puff', n, sx, sy, sy + 2, RAMPS.slash, { spread: o.spread || 8, tone: tone || 'dirt', vx: o.vx || 0, speed: o.speed || 1, jitter: 40 });
  };
  // What a footfall kicks up on this tile.
  P.groundTone = function (x, y) {
    const m = this.map;
    const t = m && m.tiles[y] && m.tiles[y][x];
    const mat = t && CT.TERRAIN[t.t];
    if (!mat) return 'dirt';
    if (mat.liquid && !mat.lava) return 'water';
    const n = (mat.name || '').toLowerCase();
    if (/snow|ice|frost/.test(n)) return 'snow';
    if (/stone|rock|marble|tile|brick|floor|porcelain|glass|metal|road|cobble|plaza|pave/.test(n)) return 'stone';
    return 'dirt';
  };
  // One footstep: dust, or a splash in water.
  P.footstep = function (u) {
    const tone = this.groundTone(Math.round(u.rx), Math.round(u.ry));
    const [sx, sy] = this.unitScreenPos(u);
    if (tone === 'water') {
      this.scatter('drop', 3, sx, sy - 2, sy + 2, RAMPS.water, { spread: 6, speed: 0.45 });
      this.scatter('ripple', 1, sx, sy, sy + 1, RAMPS.water, { r: 8 });
      return 'water';
    }
    this.scatter('puff', 1, sx, sy, sy + 2, RAMPS.slash, { spread: 5, tone, speed: 0.6 });
    return tone;
  };
  // Landing from a jump or a knockback: squash, a ring of dust (or a splash).
  P.land = function (u, heavy) {
    const tone = this.groundTone(Math.round(u.rx), Math.round(u.ry));
    const [sx, sy] = this.unitScreenPos(u);
    u._squash = { t0: performance.now(), ms: heavy ? 200 : 140, n: heavy ? 3 : 2 };
    if (tone === 'water') {
      this.scatter('drop', heavy ? 8 : 5, sx, sy - 2, sy + 2, RAMPS.water, { spread: 8, speed: 0.7 });
      this.scatter('ripple', 1, sx, sy, sy + 1, RAMPS.water, { r: 12 });
    } else {
      for (const d of [-1, 1]) this.scatter('puff', heavy ? 3 : 2, sx + d * 5, sy, sy + 2, RAMPS.slash, { spread: 4, tone, vx: d * 0.5, speed: 0.4 });
    }
    return tone;
  };

  // ---- Unit overlays: afterimages, tints, float bob, squash ---------------------------------
  // A fading copy of the unit left where it stood (dodges, dashes, shadow magic).
  P.ghost = function (u, o = {}) {
    if (!u._f || u._sx == null) return;
    const f = u._f;
    (u._ghosts || (u._ghosts = [])).push({
      img: o.hex ? tintOf(f.img, o.hex) : f.img, x: Math.round(u._sx - f.cx) - this.ox + (o.dx || 0), y: Math.round(u._sy - f.footY + 2) - this.oy + (o.dy || 0),
      t0: performance.now() + (o.delay || 0), ms: o.ms || 220, a: o.alpha || 0.6,
    });
  };
  P.drawGhosts = function (u, now) {
    const ctx = this.ctx;
    u._ghosts = u._ghosts.filter((g) => now - g.t0 < g.ms);
    for (const g of u._ghosts) {
      const k = (now - g.t0) / g.ms;
      if (k < 0 || (k > 0.5 && Math.floor(now / STEP) % 2)) continue;
      ctx.globalAlpha = g.a * (k < 0.5 ? 1 : 0.6);
      ctx.drawImage(g.img, g.x + this.ox, g.y + this.oy);
    }
    ctx.globalAlpha = 1;
    if (!u._ghosts.length) u._ghosts = null;
  };
  // Wash a unit in a colour for a moment (heal warmth, shadow, frost).
  P.tint = function (u, hex, ms = 500, peak = 0.6) {
    u._tint = { hex, t0: performance.now(), ms, peak };
  };
  P.drawTint = function (u, f, dx, dy, now) {
    const t = u._tint;
    const k = (now - t.t0) / t.ms;
    if (k >= 1) { u._tint = null; return; }
    if (k < 0) return;
    const e = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    const a = Math.round(e * 4) / 4 * t.peak;
    if (a <= 0) return;
    const ctx = this.ctx;
    ctx.globalAlpha = a * (u.alpha == null ? 1 : u.alpha);
    ctx.drawImage(tintOf(f.img, t.hex), dx, dy);
    ctx.globalAlpha = 1;
  };
  // Floaters (Magus) hover: two pixels of slow bob, never while down.
  P.unitBob = function (u, now) {
    if (u.koPose || !u.alive && u.alive !== undefined) return 0;
    const fl = u.float || (CT.HEROES && (CT.HEROES[u.key] || CT.HEROES[u.id] || {}).float);
    if (!fl || (u.status && u.status.stasis)) return 0;
    return 1 + Math.round(Math.sin(now / 420 + (u.id ? String(u.id).length : 0)) * 1.2);
  };
  // Pixel squash: the upper part of the sprite sinks a row or two onto the legs.
  P.drawSquash = function (u, f, dx, dy, now) {
    const s = u._squash;
    const k = (now - s.t0) / s.ms;
    if (k >= 1 || k < 0) { u._squash = null; return false; }
    const n = Math.max(1, Math.round(s.n * (1 - k)));
    const img = f.img;
    const cut = Math.round(f.footY - 9); // knees
    const ctx = this.ctx;
    if (cut <= 4 || cut >= img.height) return false;
    ctx.drawImage(img, 0, cut, img.width, img.height - cut, dx, dy + cut, img.width, img.height - cut);
    ctx.drawImage(img, 0, 0, img.width, cut, dx, dy + n, img.width, cut);
    return true;
  };

  // ---- Ground residue ------------------------------------------------------------------
  // What a spell leaves on the tile: scorch marks, frost, puddles, shadow stains, cracks.
  // Drawn on the tile under the units, fading out over a few seconds.
  const DECAL = {
    scorch: { life: 7000, cols: ['#1a1226', '#2a160e', '#4a2a16'], ember: ['#fce068', '#e88c28', '#c05c1c'], emberMs: 2600, rx: 9, ry: 4 },
    ash: { life: 7000, cols: ['#1a1226', '#2a160e', '#3c0a14'], ember: ['#fff4b0', '#f8bc3c', '#d43c3c'], emberMs: 3600, wisp: 2200, rx: 10, ry: 4 },
    frost: { life: 6000, cols: ['#ffffff', '#c4e4ff', '#8cc0f0'], glint: true, sparse: 0.55, rx: 10, ry: 4 },
    puddle: { life: 6000, cols: ['#5c90dc', '#3c64b4', '#2c4488'], water: true, rx: 9, ry: 4 },
    stain: { life: 4200, cols: ['#0a0612', '#2a1040', '#4a1c6c'], shrink: true, rx: 9, ry: 4 },
    crack: { life: 8000, cols: ['#1a1226', '#2a2038', '#3e3230'], crack: true, rx: 10, ry: 4 },
    glow: { life: 1500, cols: ['#d4ec94', '#a8d45c', '#74b43c'], ringOnly: true, rx: 10, ry: 4 },
    light: { life: 2600, cols: ['#ffffff', '#fff4b0', '#fce068'], sparse: 0.4, glint: true, rx: 10, ry: 4 },
    lavos: { life: 6000, cols: ['#3c0a14', '#6c1422', '#a02030'], ember: ['#fff4b0', '#f06c4c', '#d43c3c'], emberMs: 3000, rx: 9, ry: 4 },
    paper: { life: 5000, cols: ['#e4e8f0', '#bcc0d4', '#9294b0'], sparse: 0.35, rx: 10, ry: 4 },
  };
  const decalCv = new Map();
  function decalSprite(kind, seed) {
    const key = kind + seed;
    let cv = decalCv.get(key);
    if (cv) return cv;
    const D = DECAL[kind];
    const rx = D.rx, ry = D.ry;
    cv = CT.PX.canvas(rx * 2 + 3, ry * 2 + 3, (g) => {
      const cx = rx + 1, cy = ry + 1;
      if (D.crack) {
        // Fracture lines running out from the centre.
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + hashI(seed, i) * 0.9;
          let x = cx, y = cy;
          const len = 4 + hashI(seed, i, 2) * 6;
          for (let s = 0; s < len; s++) {
            const na = a + (hashI(seed, i, s + 9) - 0.5) * 1.1;
            x += Math.cos(na); y += Math.sin(na) * 0.5;
            if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) break;
            g.fillStyle = D.cols[s < 2 ? 0 : 1];
            g.fillRect(Math.round(x), Math.round(y), 1, 1);
            if (s < 3) { g.fillStyle = D.cols[2]; g.fillRect(Math.round(x), Math.round(y) + 1, 1, 1); }
          }
        }
        g.fillStyle = D.cols[0];
        g.fillRect(cx - 1, cy, 3, 1);
        return;
      }
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) {
          const d = (x / rx) ** 2 + (y / ry) ** 2 + (hashI(x + 40, y + 40, seed) - 0.5) * 0.55;
          if (d >= 1) continue;
          if (D.ringOnly && d < 0.55) continue;
          if (D.sparse && hashI(x + 7, y + 3, seed + 5) > D.sparse * (1.25 - d)) continue;
          if (D.water) {
            g.fillStyle = d > 0.72 ? D.cols[0] : y < -1 && x < 0 && d > 0.3 ? D.cols[0] : D.cols[1];
          } else g.fillStyle = D.cols[d < 0.35 ? 0 : d < 0.7 ? 1 : 2];
          if (!D.water && d > 0.7 && ((x + y) & 1)) continue; // ragged, dithered rim
          g.fillRect(cx + x, cy + y, 1, 1);
        }
    });
    decalCv.set(key, cv);
    return cv;
  }
  P.decal = function (x, y, kind, o = {}) {
    if (!DECAL[kind] || !this.map) return;
    const tx = Math.round(x), ty = Math.round(y);
    const t = this.map.tiles[ty] && this.map.tiles[ty][tx];
    if (!t) return;
    const mat = CT.TERRAIN[t.t];
    if (!mat || mat.void || mat.liquid) return; // nothing sticks to water, lava or the void
    const key = `${tx},${ty}`;
    const m = this.decals || (this.decals = new Map());
    let list = m.get(key);
    if (!list) m.set(key, (list = []));
    const now = performance.now();
    const same = list.find((d) => d.kind === kind);
    if (same) { same.t0 = now + (o.delay || 0); return; }
    if (list.length >= 2) list.shift();
    list.push({ kind, t0: now + (o.delay || 0), seed: (hashI(tx, ty, list.length) * 5) | 0, life: o.life || DECAL[kind].life });
    if (m.size > 60) m.delete(m.keys().next().value);
  };
  P.drawDecals = function (t, sx, sy, now) {
    const list = this.decals.get(`${t.x},${t.y}`);
    if (!list) return;
    const ctx = this.ctx;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      const age = now - d.t0;
      if (age < 0) continue;
      if (age >= d.life) { list.splice(i, 1); continue; }
      const D = DECAL[d.kind];
      const cv = decalSprite(d.kind, d.seed);
      const k = age / d.life;
      const st = Math.floor(now / 100);
      let a = k > 0.7 ? Math.max(0.25, Math.round((1 - (k - 0.7) / 0.3) * 4) / 4) : age < 120 ? 0.5 : 1;
      if (d.kind === 'glow') a = Math.floor(now / 66) % 2 ? a : a * 0.5;
      ctx.globalAlpha = a * (D.water ? 0.8 : D.sparse ? 1 : 0.85);
      if (D.shrink || D.water) {
        // Stains draw themselves in; puddles dry up.
        const s = D.shrink ? 1 - k * 0.7 : k > 0.5 ? 1 - (k - 0.5) * 1.2 : 1;
        const w = Math.max(2, Math.round(cv.width * s)), h = Math.max(1, Math.round(cv.height * s));
        ctx.drawImage(cv, sx - (w >> 1), sy - (h >> 1), w, h);
      } else ctx.drawImage(cv, sx - (cv.width >> 1), sy - (cv.height >> 1));
      ctx.globalAlpha = 1;
      if (D.ember && age < D.emberMs) {
        // Embers that wink out one by one.
        const n = 4;
        for (let e = 0; e < n; e++) {
          if (age > D.emberMs * (0.4 + 0.6 * hashI(d.seed, e, 3))) continue;
          const ex = sx + Math.round((hashI(d.seed, e, 1) - 0.5) * D.rx * 1.3), ey = sy + Math.round((hashI(d.seed, e, 2) - 0.5) * D.ry * 1.2);
          ctx.fillStyle = D.ember[(st + e) % 3 === 0 ? 0 : (st + e) % 3 === 1 ? 1 : 2];
          ctx.fillRect(ex, ey, 1, 1);
        }
      }
      if (D.wisp && age < D.wisp && (d._w || 0) < now) {
        d._w = now + 260 + hashI(d.seed, st) * 300;
        this.scatter('wisp', 1, sx, sy - 2, sy, RAMPS.slash, { jitter: 1 });
      }
      if (D.glint && k < 0.8) {
        const gi = (st >> 1) % 7;
        if (gi < 3) {
          const gx = sx + Math.round((hashI(d.seed, st >> 4, 1) - 0.5) * D.rx * 1.4), gy = sy + Math.round((hashI(d.seed, st >> 4, 2) - 0.5) * D.ry);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(gx, gy, 1, 1);
          if (gi === 1) { ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3); }
        }
      }
      if (D.water && age < 500) {
        const rr = 3 + Math.round((age / 500) * 7);
        ctx.fillStyle = age < 250 ? '#c4e4ff' : '#8cc0f0';
        PXD.ellipseRing(ctx, sx, sy, rr, Math.max(1, rr >> 1));
      }
    }
    if (!list.length) this.decals.delete(`${t.x},${t.y}`);
  };
  // What each element leaves behind.
  FEEL.RESIDUE = { lightning: 'scorch', fire: 'ash', ice: 'frost', water: 'puddle', shadow: 'stain', dark: 'stain', psy: 'stain', lavos: 'lavos', heal: 'glow', holy: 'light', porcelain: 'paper', glass: 'frost', laser: 'scorch' };

  // ---- Thick shock rings ------------------------------------------------------------------
  // An elliptical band: bright leading edge, coloured body, dithered trailing edge.
  FEEL.bandRing = function (ctx, cx, cy, rx, ry, th, cLead, cBody, cTrail, par = 0) {
    cx = Math.round(cx); cy = Math.round(cy);
    const hw = (y, RX, RY) => {
      if (RY <= 0 || y < -RY || y > RY) return -1;
      const t = 1 - (y * y) / ((RY + 0.5) * (RY + 0.5));
      return t > 0 ? Math.round(RX * Math.sqrt(t)) : -1;
    };
    const irx = rx - th, iry = Math.round(ry - th * (ry / Math.max(1, rx)) - 0.5);
    for (let y = -ry; y <= ry; y++) {
      const w = hw(y, rx, ry);
      if (w < 0) continue;
      const wi = irx > 0 ? hw(y, irx, iry) : -1;
      const from = wi < 0 ? 0 : wi + 1;
      const len = w - from + 1;
      if (len <= 0) continue;
      const wn = Math.min(hw(y - 1, rx, ry), hw(y + 1, rx, ry)); // -1 at the caps
      const lead = Math.min(len, Math.max(1, w - Math.max(wn, from - 1)));
      ctx.fillStyle = cBody;
      if (wi < 0) ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
      else { ctx.fillRect(cx - w, cy + y, len, 1); ctx.fillRect(cx + from, cy + y, len, 1); }
      ctx.fillStyle = cLead;
      ctx.fillRect(cx - w, cy + y, lead, 1);
      ctx.fillRect(cx + w - lead + 1, cy + y, lead, 1);
      if (cTrail && wi >= 0 && len > 2) {
        // Dithered inner (trailing) edge.
        ctx.fillStyle = cTrail;
        for (let i = 0; i < Math.min(2, len - 1); i++) {
          if (((y + i + par) & 1) === 0) continue;
          ctx.fillRect(cx - from - i, cy + y, 1, 1);
          ctx.fillRect(cx + from + i, cy + y, 1, 1);
        }
      }
    }
  };
})();

// ---- KO dissolves, status icons and auras, turn banner, path trail ---------------------------
(function () {
  const CT = window.CT;
  const PXD = CT.PXD;
  const RAMPS = CT.FX_RAMPS;
  const P = CT.Renderer.prototype;
  const FEEL = CT.FEEL;
  const { mk, tintOf, rampOf, hashI } = FEEL;
  const TAU = Math.PI * 2;
  const STEP = 33;
  const INK = '#0a0612';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---- KO ---------------------------------------------------------------------------------
  // style 'archive': the Curator files the unit away. It bleaches to plaster from the head
  //   down behind a white scan line, the bleached slices slide apart and flake upward.
  // style 'crt': an echo loses its signal: scanlines, a sideways tear, then the picture
  //   collapses to a bright line and a dot, like a set being switched off.
  // Returns the duration; the unit's alpha is set to 0 by the caller when it ends.
  P.dissolve = function (u, style = 'archive', ms = 700) {
    u.fxKo = { style, t0: performance.now(), ms, last: -1 };
    return ms;
  };
  P.drawKo = function (u, f, dx, dy, now) {
    const ko = u.fxKo;
    const k = (now - ko.t0) / ko.ms;
    const ctx = this.ctx;
    const img = f.img, w = img.width, h = img.height;
    const st = Math.floor((now - ko.t0) / STEP);
    if (k >= 1) return;
    if (k < 0) { ctx.drawImage(img, dx, dy); return; }
    const top = f.box ? f.box.y0 : f.top || 0;
    const bot = Math.min(h, Math.round(f.footY) + 2);
    const span = Math.max(4, bot - top);
    const bx0 = f.box ? Math.max(0, f.box.x0 - 1) : 0, bx1 = f.box ? Math.min(w, f.box.x1 + 2) : w; // opaque columns
    if (ko.style === 'crt') {
      const cy = dy + top + (span >> 1);
      if (k < 0.5) {
        // Signal loss: every other line drops, bands tear sideways, the picture ghosts cyan.
        const q = k / 0.5;
        const ghost = tintOf(img, st % 3 === 0 ? '#c4e4ff' : '#8cc0f0');
        for (let y = top; y < bot; y += 2) {
          const band = y >> 3;
          const off = Math.round((hashI(band, st >> 1, 5) - 0.5) * 10 * q * q);
          if (hashI(y, st, 9) < q * 0.45) continue;
          ctx.drawImage(st % 2 && hashI(band, st, 2) < 0.5 ? ghost : img, 0, y, w, 1, dx + off, dy + y, w, 1);
          if (q < 0.5 || (y + st) % 4) ctx.drawImage(img, 0, y + 1, w, 1, dx + off, dy + y + 1, w, 1);
        }
      } else if (k < 0.8) {
        // The picture folds onto its middle line.
        const q = (k - 0.5) / 0.3;
        const hh = Math.max(1, Math.round(span * (1 - q) * (1 - q)));
        ctx.drawImage(q > 0.4 ? f.flash : tintOf(img, '#c4e4ff'), 0, top, w, span, dx, cy - (hh >> 1), w, hh);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dx + bx0, cy, bx1 - bx0, 1);
      } else {
        // ...and the line shrinks to a dot.
        const q = (k - 0.8) / 0.2;
        const ww = Math.max(1, Math.round((bx1 - bx0) * (1 - q)));
        const mx = dx + ((bx0 + bx1) >> 1);
        ctx.fillStyle = '#c4e4ff';
        ctx.fillRect(mx - (ww >> 1) - 1, cy, ww + 2, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx - (ww >> 1), cy, ww, 1);
        if (q > 0.5) { ctx.fillRect(mx, cy - 2, 1, 5); ctx.fillRect(mx - 2, cy, 5, 1); }
      }
      return;
    }
    // Archive: the scan line walks down the body.
    const grey = rampOf(img, RAMPS.porcelain, 'plaster');
    const front = top + Math.round(span * Math.min(1, k / 0.72));
    const big = ko.style === 'boss' ? 1.6 : 1;
    for (let y = top; y < bot; y += 2) {
      if (y >= front) {
        // Not reached yet: the living sprite, already flickering to plaster.
        ctx.drawImage(st % 4 === 3 ? grey : img, 0, y, w, Math.min(2, bot - y), dx, dy + y, w, Math.min(2, bot - y));
        continue;
      }
      const age = (front - y) / span; // 0 at the line, 1 long gone
      const gone = age * 1.15 + Math.max(0, k - 0.72) * 3;
      if (hashI(y, 3, 1) < gone - 0.15) continue;
      const dir = (y >> 1) % 2 ? 1 : -1;
      const off = Math.round(dir * age * age * 16 * big);
      ctx.drawImage(grey, 0, y, w, 2, dx + off, dy + y - Math.round(age * 3), w, 2);
    }
    if (k < 0.72) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx + bx0 - 1, dy + front, bx1 - bx0 + 2, 1);
      ctx.fillStyle = '#bcc0d4';
      ctx.fillRect(dx + bx0 + 1, dy + front + 1, bx1 - bx0 - 2, 1);
      if (st !== ko.last) {
        ko.last = st;
        // Flakes of paper lift off the scan line.
        const n = ko.style === 'boss' ? 3 : 1;
        for (let i = 0; i < n; i++) this.addBit({ k: 'flake', x: dx + bx0 + Math.random() * (bx1 - bx0), y: dy + front, vx: (Math.random() - 0.5) * 0.6, vy: -0.5 - Math.random() * 0.8, g: -0.006, drag: 0.985, life: 500 + Math.random() * 450, ramp: RAMPS.porcelain, ph: Math.random() * 100 });
      }
    }
  };

  // ---- Status icons (7x7, two frames each) and auras -------------------------------------------
  const ICON = {
    burn: { pal: { o: '#e88c28', y: '#fce068', w: '#fff4b0', r: '#d43c3c' }, f: [
      ['...o...', '..oo...', '..oyo..', '.oyyo..', '.oywyo.', '.rywyr.', '..rrr..'],
      ['..o....', '..oo...', '.oyoo..', '.oyyo..', 'oywwyo.', 'rywwyr.', '.rrrr..'],
    ] },
    slow: { pal: { b: '#8cc0f0', w: '#ffffff', d: '#3c64b4' }, f: [
      ['bbbbbbb', '.bwwwb.', '..bwb..', '...b...', '..b.b..', '.b...b.', 'bbbbbbb'],
      ['bbbbbbb', '.b...b.', '..bwb..', '...w...', '..bwb..', '.bwwwb.', 'bbbbbbb'],
    ] },
    haste: { pal: { g: '#a8d45c', w: '#d4ec94' }, f: [
      ['.......', 'w..g...', '.w..g..', '..w..g.', '.w..g..', 'w..g...', '.......'],
      ['.......', '.w..g..', '..w..g.', '...w..g', '..w..g.', '.w..g..', '.......'],
    ] },
    stun: { pal: { y: '#fce068', w: '#ffffff' }, f: [
      ['...y...', '...y...', '..ywy..', 'yywwwyy', '..ywy..', '...y...', '...y...'],
      ['y.....y', '.y...y.', '..ywy..', '..www..', '..ywy..', '.y...y.', 'y.....y'],
    ] },
    catalogued: { pal: { p: '#e0709c', w: '#f8b0c8', k: '#ffffff' }, f: [
      ['.ppppp.', 'p.....p', 'p.www.p', 'p.....p', 'p.ww..p', 'p.....p', '.ppppp.'],
      ['.ppppp.', 'p.....p', 'p.kkk.p', 'p.....p', 'p.ww..p', 'p.....p', '.ppppp.'],
    ] },
    stasis: { pal: { c: '#8cc0f0', w: '#ffffff', l: '#c4e4ff' }, f: [
      ['...c...', '..cwc..', '.cwlcc.', 'cwllccc', '.clccc.', '..ccc..', '...c...'],
      ['...c...', '..clc..', '.cllwc.', 'cllcwcc', '.clccc.', '..ccc..', '...c...'],
    ] },
    magdown: { pal: { v: '#bc84e4', w: '#e0c0fc' }, f: [
      ['..wvv..', '..wvv..', '..wvv..', 'wvvvvvv', '.wvvvv.', '..wvv..', '...v...'],
      ['.......', '..wvv..', '..wvv..', '..wvv..', 'wvvvvvv', '.wvvvv.', '..wvv..'],
    ] },
    might: { pal: { r: '#f06c4c', w: '#fff4b0' }, f: [
      ['...r...', '..wrr..', '.wrrrr.', 'wrrrrrr', '..wrr..', '..wrr..', '..wrr..'],
      ['..wrr..', '.wrrrr.', 'wrrrrrr', '..wrr..', '..wrr..', '..wrr..', '.......'],
    ] },
    barrier: { pal: { v: '#bc84e4', w: '#ffffff', l: '#e0c0fc' }, f: [
      ['vvvvvvv', 'vwlllvv', 'vwllvvv', 'vllvvvv', '.vvvvv.', '..vvv..', '...v...'],
      ['vvvvvvv', 'vllllvv', 'vllwvvv', 'vlwvvvv', '.vvvvv.', '..vvv..', '...v...'],
    ] },
  };
  let iconCv = null;
  const icons = () => iconCv || (iconCv = Object.fromEntries(Object.entries(ICON).map(([k, d]) => [k, d.f.map((r) => mk(r, d.pal))])));
  P.drawStatusIcons = function (u, bx, by, bw, now) {
    const ctx = this.ctx;
    const I = icons();
    let n = 0;
    for (const k in u.status) if (u.status[k] && I[k]) n++;
    if (!n) return;
    let x = Math.round(bx + bw / 2 - (n * 9 - 1) / 2);
    let i = 0;
    for (const k in u.status) {
      if (!u.status[k] || !I[k]) continue;
      const born = (u._stT || (u._stT = {}))[k] || (u._stT[k] = now);
      const age = now - born;
      // A new status pops in from above with a white frame.
      const y = by - 10 - (age < 180 ? Math.round((1 - age / 180) * 5) : (Math.floor(now / 400) + i) % 4 === 0 ? 1 : 0);
      ctx.fillStyle = age < 100 ? '#ffffff' : INK;
      ctx.fillRect(x - 1, y - 1, 9, 9);
      ctx.fillStyle = INK;
      ctx.fillRect(x, y + 8, 7, 1);
      ctx.drawImage(I[k][Math.floor(now / 260 + i) % 2], x, y);
      x += 9;
      i++;
    }
    for (const k in u._stT || {}) if (!u.status[k]) delete u._stT[k];
  };
  // Looping auras on the body itself, so a status can be read without the icon row.
  P.drawAuras = function (u, sx, headY, now) {
    const s = u.status;
    const ctx = this.ctx;
    const feet = u._sy, mid = Math.round((headY + feet) / 2), tall = feet - headY;
    const st = Math.floor(now / STEP);
    const tick = (key, every) => {
      const A = u._aura || (u._aura = {});
      if ((A[key] || 0) > now) return false;
      A[key] = now + every * (0.7 + Math.random() * 0.6);
      return true;
    };
    if (s.stasis) {
      // Sealed in a crystal case: a faceted outline with glints sliding down its faces.
      const rx = 11, ry = (tall >> 1) + 4;
      ctx.fillStyle = '#8cc0f0';
      PXD.ellipseRing(ctx, sx, mid, rx, ry);
      ctx.fillStyle = '#c4e4ff';
      PXD.ellipseRing(ctx, sx, mid, rx - 1, ry - 1);
      const g = (st >> 1) % (ry * 2 + 10);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) ctx.fillRect(sx - rx + 3 + i, mid - ry + g - i, 1, 1);
      for (let i = 0; i < 3; i++) ctx.fillRect(sx + 3 + i, mid - ry + ((g + ry) % (ry * 2 + 10)) - i, 1, 1);
    }
    if (s.barrier) {
      // Ward runes turning around the body.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + st * 0.05;
        const front = Math.sin(a) > 0;
        if (!front && i % 2) continue;
        ctx.fillStyle = front ? (i % 5 === 0 ? '#ffffff' : '#e0c0fc') : '#9450c0';
        ctx.fillRect(Math.round(sx + Math.cos(a) * 11), Math.round(mid + Math.sin(a) * 4 - 2), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
      }
    }
    if (s.stun) {
      // Three stars circling the head.
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + now / 170;
        const x = Math.round(sx + Math.cos(a) * 8), y = Math.round(headY - 1 + Math.sin(a) * 3);
        ctx.fillStyle = Math.sin(a) > 0 ? '#fce068' : '#e88c28';
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
        if (Math.sin(a) > 0.5) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); }
      }
    }
    if (s.catalogued) {
      // Tagged for the archive: bracket corners and a scan line travelling down.
      const x0 = sx - 9, x1 = sx + 9, y0 = headY - 1, y1 = feet + 1;
      ctx.fillStyle = Math.floor(now / 300) % 2 ? '#f090b4' : '#e0709c';
      for (const [x, y, hx, vy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        ctx.fillRect(Math.min(x, x + hx * 3), y, 4, 1);
        ctx.fillRect(x, Math.min(y, y + vy * 3), 1, 4);
      }
      const ly = y0 + 2 + (Math.floor(now / 60) % Math.max(4, y1 - y0 - 2));
      ctx.fillStyle = '#f8b0c8';
      for (let x = x0 + 2; x < x1 - 1; x += 2) ctx.fillRect(x + (st & 1), ly, 1, 1);
    }
    if (s.haste) {
      // Speed lines streaming off the heels.
      ctx.fillStyle = '#d4ec94';
      for (let i = 0; i < 3; i++) {
        const p = (st * 2 + i * 7) % 14;
        ctx.fillRect(sx - 12 - p + (i & 1) * 20 + ((i & 1) ? p * 2 - 14 : 0), feet - 2 - i * 5, 4 - (p >> 2), 1);
      }
      if (tick('haste', 240)) this.scatter('sparkle', 1, sx, feet - 4, feet, RAMPS.heal, { spread: 14, jitter: 1 });
    }
    if (s.might && tick('might', 420)) {
      this.addBit({ k: 'orb', x: sx + (Math.random() - 0.5) * 14, y: feet - 2, vx: 0, vy: -0.7, life: 520, ramp: RAMPS.lavos, ph: Math.random() * 9 });
    }
    if (s.burn && tick('burn', 170)) {
      this.addBit({ k: 'ember', x: sx + (Math.random() - 0.5) * 12, y: mid + (Math.random() - 0.3) * tall * 0.6, vx: 0, vy: -0.45 - Math.random() * 0.3, g: -0.004, life: 520 + Math.random() * 300, ramp: RAMPS.fire, ph: Math.random() * 100, drag: 0.98 });
    }
    if (s.slow && tick('slow', 380)) {
      this.addBit({ k: 'drop', x: sx + (Math.random() - 0.5) * 12, y: headY + 4 + Math.random() * 8, vx: 0, vy: 0.1, g: 0.012, life: 900, ramp: RAMPS.ice, floor: feet + 1 });
    }
    if (s.magdown && tick('magdown', 460)) {
      this.addBit({ k: 'mote', x: sx + (Math.random() - 0.5) * 20, y: headY - 6, cx: sx, cy: mid, life: 520, ramp: RAMPS.shadow, ph: Math.random() * 6 });
    }
  };

  // ---- Turn banner ------------------------------------------------------------------------
  // "Who is up": the unit's face and name slide in from the left under the objective.
  const TEAMCOL = {
    0: { body: '#1c2c5c', edge: '#5c90dc', hi: '#c4e4ff', dark: '#10183a' },
    1: { body: '#6c1422', edge: '#d43c3c', hi: '#f8b0c8', dark: '#3c0a14' },
    g: { body: '#1c4428', edge: '#74b43c', hi: '#d4ec94', dark: '#0e2a1e' },
    n: { body: '#3a3a52', edge: '#9294b0', hi: '#e4e8f0', dark: '#1a1226' },
  };
  const faceCache = new Map();
  function faceOf(u) {
    const key = u.sprite || u.key;
    if (faceCache.has(key)) return faceCache.get(key);
    let cv = null;
    try {
      const spr = CT.getSprite(key);
      const f = spr.frames['south-east'] || Object.values(spr.frames)[0];
      const hx = f.J && f.J.head ? f.J.head.x : f.cx, hy = f.J && f.J.head ? f.J.head.y : (f.box ? f.box.y0 : f.top || 0) + 8;
      cv = CT.PX.canvas(16, 16, (g) => {
        g.fillStyle = '#1a1226';
        g.fillRect(0, 0, 16, 16);
        g.drawImage(f.img, Math.round(hx - 8), Math.round(hy - 8), 16, 16, 0, 0, 16, 16);
      });
    } catch (e) { cv = null; }
    faceCache.set(key, cv);
    return cv;
  }
  P.turnBanner = function (u, sub) {
    this._banner = { u, name: String(u.name || '').toUpperCase(), sub: sub || '', t0: performance.now(), ms: 1150, col: TEAMCOL[u.guest ? 'g' : u.team === 0 ? 0 : u.team === 1 ? 1 : 'n'], face: faceOf(u) };
  };
  P.drawBanner = function (now) {
    const b = this._banner;
    if (!b) return;
    const t = now - b.t0;
    if (t >= b.ms) { this._banner = null; return; }
    const ctx = this.ctx;
    const w = Math.max(64, 26 + b.name.length * 6 + 14), h = 18;
    const inK = Math.min(1, t / 150), outK = Math.max(0, (t - (b.ms - 170)) / 170);
    // Slides in with a two-pixel overshoot, slides back out the way it came.
    const ease = inK < 1 ? 1 - (1 - inK) * (1 - inK) : 1;
    let x = Math.round(-w + (w + 6) * ease - (w + 6) * outK * outK);
    if (t > 150 && t < 230) x += 2;
    const y = 40;
    const C = b.col;
    ctx.fillStyle = INK;
    ctx.fillRect(x - 2, y - 1, w + 2, h + 2);
    ctx.fillStyle = C.body;
    ctx.fillRect(x - 2, y, w, h);
    ctx.fillStyle = C.dark;
    ctx.fillRect(x - 2, y + h - 4, w, 4);
    ctx.fillStyle = C.edge;
    ctx.fillRect(x - 2, y, w, 1);
    ctx.fillRect(x + w - 2, y, 1, h);
    // Stepped tail.
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = INK;
      ctx.fillRect(x + w + i * 2, y + i * 2 - 1, 3, h + 2 - i * 4);
      ctx.fillStyle = i % 2 ? C.body : C.edge;
      ctx.fillRect(x + w - 1 + i * 2, y + i * 2, 2, h - i * 4);
    }
    if (b.face) {
      ctx.fillStyle = C.hi;
      ctx.fillRect(x + 1, y + 1, 18, 16);
      ctx.drawImage(b.face, x + 2, y + 1, 16, 16);
      ctx.fillStyle = INK;
      ctx.fillRect(x + 19, y + 1, 1, 16);
    }
    PXD.text(ctx, b.name, x + 23, y + 5, t < 210 && Math.floor(t / 50) % 2 ? '#ffffff' : C.hi);
    // Marching chevrons at the tail.
    const o = Math.floor(t / 120) % 3;
    ctx.fillStyle = C.hi;
    for (let i = 0; i < 2; i++) {
      const cx = x + w - 10 + i * 4 + o;
      ctx.fillRect(cx, y + 6, 1, 1); ctx.fillRect(cx + 1, y + 7, 1, 1); ctx.fillRect(cx + 2, y + 8, 1, 2); ctx.fillRect(cx + 1, y + 10, 1, 1); ctx.fillRect(cx, y + 11, 1, 1);
    }
  };

  // ---- Move preview: a trail of steps from the unit to the cursor --------------------------------
  P.drawPathStep = function (ui, t, sx, sy, now) {
    const ctx = this.ctx;
    let info = ui._pathInfo;
    if (!info || info.src !== ui.path) {
      const keys = [...ui.path];
      info = ui._pathInfo = { src: ui.path, idx: new Map(keys.map((k, i) => [k, i])), keys };
    }
    const i = info.idx.get(`${t.x},${t.y}`);
    const n = info.keys.length;
    const at = (j) => {
      const [x, y] = info.keys[j].split(',').map(Number);
      const tt = this.tileAt ? this.tileAt(x, y) : this.map.tiles[y][x];
      const [px, py] = this.project(x, y, tt ? this.tileHeight(tt) : 0);
      return [Math.round(px), Math.round(py)];
    };
    const run = Math.floor(now / 70) % (n * 4 + 6); // a bright bead runs the trail
    const dot = (x, y, lit) => {
      // A white stud with a dark rim, readable on any tile; the running bead is gold and larger.
      const s = lit ? 2 : 1;
      ctx.fillStyle = INK;
      ctx.fillRect(x - s - 1, y - s, s * 2 + 3, s * 2 + 1);
      ctx.fillRect(x - s, y - s - 1, s * 2 + 1, s * 2 + 3);
      ctx.fillStyle = lit ? '#fce068' : '#ffffff';
      ctx.fillRect(x - s, y - s, s * 2 + 1, s * 2 + 1);
      if (lit) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2); }
    };
    // Half a segment toward each neighbour, so the trail is never cut by the next tile.
    for (const [j, half] of [[i - 1, 0], [i + 1, 1]]) {
      if (j < 0 || j >= n) continue;
      const [ax, ay] = at(j);
      for (let s = 1; s <= 2; s++) {
        const q = s / 5;
        const pos = half ? i * 4 + s : i * 4 - s;
        dot(Math.round(sx + (ax - sx) * q), Math.round(sy + (ay - sy) * q), pos === run || pos === run - 1);
      }
    }
    if (i === n - 1) {
      // The goal: a flag-like marker that bobs.
      const o = Math.floor(now / 200) % 2;
      ctx.fillStyle = INK;
      PXD.diamond(ctx, sx, sy + 1, 5, true);
      ctx.fillStyle = o ? '#ffffff' : '#c4e4ff';
      PXD.diamond(ctx, sx, sy, 5, true);
      ctx.fillStyle = '#3c64b4';
      PXD.diamond(ctx, sx, sy, 3, true);
    } else dot(sx, sy, i * 4 === run || i * 4 === run - 1);
  };

  // ---- HUD-layer effects (drawn over the world, under flashes and fades) -----------------------
  P.drawHudFx = function (now) {
    if (this.fade <= 0 && this._fadeOn) {
      // The picture is clear again: the next fade chooses its own shape.
      this._fadeOn = false;
      this._fadeAuto = null;
      if (this._fadeOnce) this.fadeStyle = this._fadeOnce = null;
    }
    if (this._banner) this.drawBanner(now);
    if (this._card) this.drawCard(now);
    if (this._victory) this.drawVictory(now);
  };
})();

// ---- Small feedback beats: heal glow, status pops, guard sparks, turn pulse ----------------------
(function () {
  const CT = window.CT;
  const RAMPS = CT.FX_RAMPS;
  const P = CT.Renderer.prototype;
  const now = () => performance.now();

  // Healing: a warm wash over the body, soft motes climbing, a ring of light on the ground.
  P.healGlow = function (v, o = {}) {
    const [sx, sy] = this.unitScreenPos(v);
    this.tint(v, o.hex || '#d4ec94', 620, 0.55);
    this.scatter('orb', o.n || 9, sx, sy - 12, sy, RAMPS.heal, { spread: 20, jitter: 260 });
    this.scatter('sparkle', 3, sx, sy - 10, sy, RAMPS.heal, { spread: 18, jitter: 300 });
    this.rings.push({ x: Math.round(sx), y: Math.round(sy), t0: now(), ms: 420, r: 15, ramp: RAMPS.heal, flat: true, th: 3 });
    this.decal(v.x, v.y, 'glow');
  };
  // A status takes hold: the body flashes its colour and throws a few telltale bits.
  const STATUS_FX = {
    burn: ['#f8bc3c', 'ember', 6, 'fire'], slow: ['#8cc0f0', 'drop', 4, 'ice'], stun: ['#fce068', 'spark', 6, 'lightning'],
    catalogued: ['#f090b4', 'flake', 6, 'charm'], stasis: ['#c4e4ff', 'shard', 5, 'glass'], magdown: ['#9450c0', 'mote', 6, 'shadow'],
    haste: ['#d4ec94', 'sparkle', 6, 'heal'], might: ['#f06c4c', 'orb', 6, 'lavos'], barrier: ['#e0c0fc', 'sparkle', 6, 'shadow'],
  };
  P.statusPop = function (v, status) {
    const S = STATUS_FX[status];
    if (!S) return;
    const [sx, sy] = this.unitScreenPos(v);
    this.tint(v, S[0], 420, 0.6);
    this.scatter(S[1], S[2], sx, sy - 14, sy, RAMPS[S[3]], { spread: 14, speed: 0.6 });
    if (status === 'barrier' || status === 'stasis') this.rings.push({ x: Math.round(sx), y: Math.round(sy) - 14, t0: now(), ms: 320, r: 16, ramp: RAMPS[S[3]], th: 2 });
  };
  // A blow that glances off: a steel-blue flash and sparks thrown back at the attacker.
  P.guardSpark = function (v, from) {
    const [tx, ty] = this.unitScreenPos(v);
    let dx = 0, dy = 0;
    if (from) {
      const [fx, fy] = this.unitScreenPos(from);
      const d = Math.hypot(fx - tx, fy - ty) || 1;
      dx = (fx - tx) / d; dy = (fy - ty) / d;
    }
    const cx = tx + dx * 7, cy = ty - 15 + dy * 4;
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < 6; i++) {
      const a = base + (Math.random() - 0.5) * 1.8;
      const sp = 1.4 + Math.random() * 1.4;
      this.addBit({ k: 'spark', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 0.4, g: 0.07, life: 200 + Math.random() * 120, drag: 0.93, ramp: RAMPS.slash, ph: Math.random() * 100 });
    }
    this.addBit({ k: 'flash', x: cx, y: cy, life: 130, ramp: RAMPS.ice });
    this.rings.push({ x: Math.round(cx), y: Math.round(cy), t0: now(), ms: 200, r: 9, ramp: RAMPS.slash, th: 2 });
  };
  // Turn start: two rings roll out from the unit's feet in its team colour.
  P.pulseRing = function (u) {
    const [sx, sy] = this.unitScreenPos(u);
    const ramp = u.guest ? RAMPS.heal : u.team === 0 ? RAMPS.water : u.team === 1 ? RAMPS.lavos : RAMPS.slash;
    for (let i = 0; i < 2; i++) this.rings.push({ x: Math.round(sx), y: Math.round(sy) + 1, t0: now() + i * 150, ms: 460, r: u.big ? 30 : 20, ramp, flat: true, th: 2 });
  };
})();

// ---- Screen transitions, battle cards, the victory banner, the results panel ---------------------
(function () {
  const CT = window.CT;
  const PXD = CT.PXD;
  const RAMPS = CT.FX_RAMPS;
  const P = CT.Renderer.prototype;
  const FEEL = CT.FEEL;
  const { hashI } = FEEL;
  const TAU = Math.PI * 2;
  const STEP = 33;
  const INK = '#0a0612';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sfx = (id) => CT.audio && CT.audio.sfx(id);

  // ---- Wipes: the last picture breaks up over the new one ------------------------------------
  // 'shatter' (into battle): the picture cracks along white lines and the shards fall away.
  P.wipe = function (kind, ms = 600) {
    const snap = CT.PX.canvas(this.W, this.H, (g) => g.drawImage(this.screen, 0, 0));
    const w = { kind, ms, t0: performance.now(), snap, seed: (Math.random() * 999) | 0 };
    if (kind === 'shatter') {
      // A jittered grid cut into triangles; pieces near the impact point leave first.
      const cols = 8, rows = 5;
      const px = (i, j) => (i === 0 ? 0 : i === cols ? this.W : Math.round((i / cols) * this.W + (hashI(i, j, w.seed) - 0.5) * 34));
      const py = (i, j) => (j === 0 ? 0 : j === rows ? this.H : Math.round((j / rows) * this.H + (hashI(i, j, w.seed + 1) - 0.5) * 30));
      const cx = this.W / 2, cy = this.H * 0.45;
      w.tris = [];
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const a = [px(i, j), py(i, j)], b = [px(i + 1, j), py(i + 1, j)], c = [px(i + 1, j + 1), py(i + 1, j + 1)], d = [px(i, j + 1), py(i, j + 1)];
          for (const tri of (i + j) % 2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]) {
            const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
            const dist = Math.hypot(mx - cx, my - cy);
            w.tris.push({ p: tri, mx, my, delay: 0.16 + (dist / 320) * 0.32 + hashI(i, j, 7) * 0.08, vx: ((mx - cx) / (dist || 1)) * (0.6 + hashI(i, j, 8)), vy: -0.6 - hashI(i, j, 9) * 1.2 });
          }
        }
    }
    this._wipe = w;
    return ms;
  };
  P.drawWipe = function (now) {
    const w = this._wipe;
    if (!w) return;
    const k = (now - w.t0) / w.ms;
    if (k >= 1) { this._wipe = null; return; }
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    if (w.kind === 'shatter') {
      for (const t of w.tris) {
        const q = (k - t.delay) / (1 - t.delay);
        let ox = 0, oy = 0;
        if (q > 0) {
          const f = q * 26;
          ox = Math.round(t.vx * f * 3);
          oy = Math.round(t.vy * f * 2 + 0.5 * 0.9 * f * f);
          if (t.my + oy > H + 40) continue;
        }
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(t.p[0][0] + ox, t.p[0][1] + oy);
        ctx.lineTo(t.p[1][0] + ox, t.p[1][1] + oy);
        ctx.lineTo(t.p[2][0] + ox, t.p[2][1] + oy);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(w.snap, ox, oy);
        if (q > 0) { ctx.fillStyle = q < 0.12 ? 'rgba(255,255,255,0.75)' : 'rgba(10,6,18,0.3)'; ctx.fillRect(0, 0, W, H); }
        ctx.restore();
        if (q <= 0.1) {
          // The cracks: white first, then dark as the glass parts.
          ctx.fillStyle = k < 0.1 || q > 0 ? '#ffffff' : k < 0.2 ? '#c4e4ff' : '#3a3a52';
          for (let e = 0; e < 3; e++) PXD.line(ctx, t.p[e][0] + ox, t.p[e][1] + oy, t.p[(e + 1) % 3][0] + ox, t.p[(e + 1) % 3][1] + oy, 1);
        }
      }
    }
  };

  // ---- Fades with a shape ---------------------------------------------------------------------
  // r.fadeStyle: 'iris' closes a circle on r.fadeAt (a screen point); 'gate' is the blue
  // tunnel of a time Gate; 'blinds' closes in strips. null is the plain stepped palette fade.
  // With no style set, the context picks one when a fade begins (and keeps it until the
  // picture is clear again): a fade with a rift or Gate on screen irises onto it, and
  // every way in or out of the End of Time goes through the blue tunnel.
  P.autoFade = function () {
    if (this.fadeColor !== '0,0,0') return null; // white-outs are story beats: leave them plain
    if (this.rifts.length) return 'iris';
    if (this.map && this.map.id === 'end_of_time') return 'gate';
    return null;
  };
  P.drawFade = function (now) {
    if (!this._fadeOn) {
      this._fadeOn = true;
      this._fadeAuto = this.fadeStyle ? null : this.autoFade();
    }
    const s = this.fadeStyle || this._fadeAuto;
    if (!s) return false;
    if (s === 'iris' && this.rifts.length) {
      const r = this.rifts[this.rifts.length - 1];
      const [x, y] = this.project(r.x, r.y, r.h);
      this.fadeAt = [Math.round(x), Math.round(y) - 17];
    }
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const f = clamp(this.fade, 0, 1);
    const col = `rgb(${this.fadeColor})`;
    if (s === 'iris') {
      const [cx, cy] = this.fadeAt || [W >> 1, H >> 1];
      const far = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 4;
      const r = Math.round(far * (1 - f) * (1 - f) / 4) * 4; // steps of 4 px
      ctx.fillStyle = col;
      for (let y = 0; y < H; y++) {
        const d = y - cy;
        const hw = Math.abs(d) < r ? Math.round(Math.sqrt(r * r - d * d)) : -1;
        if (hw < 0) ctx.fillRect(0, y, W, 1);
        else { ctx.fillRect(0, y, Math.max(0, cx - hw), 1); ctx.fillRect(cx + hw, y, W - cx - hw, 1); }
      }
      if (r > 6 && f > 0.02) FEEL.bandRing(ctx, cx, cy, r, r, 2, '#ffffff', '#8cc0f0', '#3c64b4', Math.floor(now / STEP)); // the lip of the iris
      return true;
    }
    if (s === 'gate') {
      // Concentric blue rings rush inward as the dark closes; the heart of the Gate glows.
      const cx = W >> 1, cy = H >> 1;
      const st = Math.floor(now / STEP);
      // Time travel: the picture itself sways in waves, harder as the tunnel closes.
      if (f > 0.04 && f < 0.97 && FEEL.POST) FEEL.POST.wave.call(this, { amp: f * 12, len: 13, speed: 70, a: 0, r: 0 }, 0.5, now);
      ctx.fillStyle = `rgba(16,24,58,${Math.min(1, Math.ceil(f * 6) / 6)})`;
      ctx.fillRect(0, 0, W, H);
      const B = ['#c4e4ff', '#8cc0f0', '#5c90dc', '#3c64b4', '#2c4488'];
      for (let i = 0; i < 9; i++) {
        const p = ((st * 0.035 + i / 9) % 1);
        const rr = Math.round((1 - p) * 300);
        if (rr < 3 || p > f * 1.4) continue;
        FEEL.bandRing(ctx, cx, cy, rr, Math.round(rr * 0.62), 1 + Math.round((1 - p) * 4), B[Math.min(4, Math.floor((1 - p) * 5))], B[Math.min(4, 1 + Math.floor((1 - p) * 4))], null);
      }
      for (let i = 0; i < 36; i++) {
        const p = ((st * 0.05 + hashI(i, 5)) % 1);
        const a = hashI(i, 6) * TAU + p * 2.5;
        const rr = (1 - p) * 280;
        if (p > f * 1.3) continue;
        ctx.fillStyle = p > 0.6 ? '#ffffff' : '#8cc0f0';
        ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.62), p > 0.5 ? 2 : 1, 1);
      }
      if (f > 0.85) { ctx.fillStyle = `rgba(${this.fadeColor},${Math.ceil(((f - 0.85) / 0.15) * 4) / 4})`; ctx.fillRect(0, 0, W, H); }
      return true;
    }
    if (s === 'blinds') {
      const n = 10, hh = Math.ceil(H / n);
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const q = clamp(f * 1.6 - (i / n) * 0.6, 0, 1);
        const h = Math.round(hh * q);
        if (h > 0) ctx.fillRect(0, i * hh + ((hh - h) >> 1), W, h);
      }
      return true;
    }
    return false;
  };

  // ---- Battle card ----------------------------------------------------------------------------
  // A title between two gold rules, with a line under it: objectives, phase changes.
  P.card = function (title, sub, ms = 1500) {
    const lines = [];
    let cur = '';
    for (const wd of String(sub || '').split(/\s+/)) {
      if ((cur + ' ' + wd).trim().length > 44) { lines.push(cur.trim()); cur = wd; } else cur += ' ' + wd;
    }
    if (cur.trim()) lines.push(cur.trim());
    this._card = { title: String(title).toUpperCase(), lines: lines.slice(0, 3), t0: performance.now(), ms };
    return ms;
  };
  P.drawCard = function (now) {
    const c = this._card;
    const t = now - c.t0;
    if (t >= c.ms) { this._card = null; return; }
    const ctx = this.ctx;
    const W = this.W;
    const inK = clamp(t / 260, 0, 1), outK = clamp((t - (c.ms - 240)) / 240, 0, 1);
    const cy = 112;
    const hh = Math.round((14 + c.lines.length * 6) * (inK < 1 ? inK : 1 - outK));
    if (hh < 1) return;
    // A dark band opens across the screen.
    ctx.fillStyle = 'rgba(10,6,18,0.78)';
    ctx.fillRect(0, cy - hh, W, hh * 2);
    const e = 1 - (1 - inK) * (1 - inK);
    const half = Math.round(150 * e * (1 - outK));
    for (const [y, a, b2] of [[cy - hh, '#f8bc3c', '#c05c1c'], [cy + hh - 2, '#f8bc3c', '#c05c1c']]) {
      ctx.fillStyle = b2;
      ctx.fillRect((W >> 1) - half, y + 1, half * 2, 1);
      ctx.fillStyle = a;
      ctx.fillRect((W >> 1) - half, y, half * 2, 1);
      ctx.fillStyle = '#fff4b0';
      ctx.fillRect((W >> 1) - half, y, 3, 1);
      ctx.fillRect((W >> 1) + half - 3, y, 3, 1);
    }
    if (inK < 1 || outK > 0.4) return;
    // The title types on; a glint runs across it once.
    const shown = Math.min(c.title.length, Math.floor((t - 260) / 28));
    const tw = c.title.length * 12 - 2;
    const x0 = (W >> 1) - (tw >> 1);
    const ty = cy - (c.lines.length ? 7 + c.lines.length * 3 : 7);
    PXD.text(ctx, c.title.slice(0, shown), x0, ty, '#fce068', { scale: 2 });
    const gl = Math.floor((t - 500) / 22);
    if (gl >= 0 && gl < c.title.length && c.title[gl] !== ' ') PXD.text(ctx, c.title[gl], x0 + gl * 12, ty, '#ffffff', { scale: 2 });
    c.lines.forEach((ln, i) => {
      if (t > 520 + i * 90) PXD.text(ctx, ln, W >> 1, ty + 19 + i * 10, '#e4e8f0', { align: 'center' });
    });
  };

  // ---- Victory --------------------------------------------------------------------------------
  const VIC = 'VICTORY';
  P.victory = function (on) {
    this._victory = on ? { t0: performance.now(), seed: (Math.random() * 999) | 0 } : null;
  };
  P.drawVictory = function (now) {
    const v = this._victory;
    const t = now - v.t0;
    const ctx = this.ctx;
    const W = this.W;
    const s = 4, adv = 6 * s;
    const tw = VIC.length * adv - s;
    // Once the results panel opens, the word slides up out of its way.
    const up = v.up ? Math.min(1, (now - v.up) / 220) : 0;
    const x0 = (W >> 1) - (tw >> 1), y0 = 46 - Math.round(up * up * 40);
    const st = Math.floor(t / STEP);
    // Rays fan out behind the word.
    if (t > 240) {
      const q = clamp((t - 240) / 400, 0, 1);
      for (let i = 0; i < 14; i++) {
        const a = Math.PI + (i / 13) * Math.PI;
        const L = (40 + (i % 3) * 16) * q + ((st + i * 3) % 6 < 3 ? 4 : 0);
        ctx.fillStyle = i % 2 ? '#f8bc3c' : '#e88c28';
        PXD.line(ctx, (W >> 1) + Math.cos(a) * 60, y0 + 20 + Math.sin(a) * 14, (W >> 1) + Math.cos(a) * (60 + L), y0 + 20 + Math.sin(a) * (14 + L * 0.5), i % 2 ? 2 : 1);
      }
    }
    // Letters drop in one by one and bounce.
    for (let i = 0; i < VIC.length; i++) {
      const tc = t - i * 70;
      if (tc < 0) break;
      const k = clamp(tc / 320, 0, 1);
      const drop = k < 0.5 ? (1 - k / 0.5) * -60 : -Math.abs(Math.sin(((k - 0.5) / 0.5) * Math.PI)) * 6 * (1 - k);
      const x = x0 + i * adv, y = y0 + Math.round(drop);
      PXD.text(ctx, VIC[i], x + 2, y + 2, '#3c0a14', { scale: s, outline: false });
      PXD.text(ctx, VIC[i], x, y, tc < 380 && tc > 300 ? '#ffffff' : '#fce068', { scale: s });
      // Lower half of each letter in deeper gold.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 2, y + 4 * s, adv + 4, 3 * s + 2);
      ctx.clip();
      PXD.text(ctx, VIC[i], x, y, '#e88c28', { scale: s, outline: false });
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 2, y, adv + 4, s);
      ctx.clip();
      PXD.text(ctx, VIC[i], x, y, '#fff4b0', { scale: s, outline: false });
      ctx.restore();
    }
    // A shine sweeps the word, then sparkles keep twinkling around it.
    const sw = (t - 760) / 420;
    if (sw > 0 && sw < 1) {
      const sx = x0 + Math.round(sw * (tw + 30)) - 15;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#b0a060';
      for (let y = 0; y < 7 * s; y++) ctx.fillRect(sx - (y >> 1), y0 + y, 6, 1);
      ctx.restore();
    }
    if (t > 700) {
      for (let i = 0; i < 10; i++) {
        const p = (st + i * 5) % 14;
        if (p > 5) continue;
        const sxx = x0 - 8 + Math.round(hashI(i, (st / 14) | 0, v.seed) * (tw + 16)), syy = y0 - 5 + Math.round(hashI(i, 2 + ((st / 14) | 0), v.seed) * 38);
        const r = [0, 1, 2, 3, 2, 1][p];
        ctx.fillStyle = '#fff4b0';
        ctx.fillRect(sxx - r, syy, r * 2 + 1, 1);
        ctx.fillRect(sxx, syy - r, 1, r * 2 + 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sxx, syy, 1, 1);
      }
    }
  };

  // ---- Results panel: lines arrive one by one, EXP counts up, level-ups ring ----------------------
  FEEL.results = async function (r) {
    const UI = CT.UI;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const lines = [];
    if (!CT.renderer || !CT.renderer._victory) lines.push('<div class="res-title">VICTORY</div>');
    lines.push(`<div class="fl-line">EXP <b class="fl-xp" data-n="${r.xp}">${r.xp}</b> · Gold <b class="fl-gold" data-n="${r.gold}">${r.gold}</b></div>`);
    if (r.items && Object.keys(r.items).length) lines.push(`<div class="fl-line">Items: ${Object.entries(r.items).map(([k, n]) => `${CT.ITEMS[k] ? CT.ITEMS[k].name : k} ×${n}`).join(', ')}</div>`);
    if (r.key) lines.push(`<div class="fl-line">Key item: ${esc(CT.KEY_ITEMS[r.key] || r.key)}</div>`);
    for (const up of r.ups) {
      lines.push(`<div class="lvup fl-line fl-up">▲ ${esc(CT.HEROES[up.id].name)} reached Lv ${up.level}!</div>`);
      for (const t of up.learned) lines.push(`<div class="lvup fl-line fl-tech">✦ ${esc(CT.HEROES[up.id].name)} learned <b>${esc(CT.TECHS[t].name)}</b>! ✦</div>`);
    }
    if (CT.renderer && CT.renderer._victory) CT.renderer._victory.up = performance.now();
    const done = UI.popup(lines.join(''), { cls: 'results', sfx: 'sfx_item_get' });
    const panel = document.querySelector('#menu-layer .popup.results');
    if (panel && !UI.autoAdvance && panel.animate) {
      const rows = [...panel.querySelectorAll('.fl-line')];
      rows.forEach((el) => (el.style.visibility = 'hidden'));
      let at = 180;
      const timers = [];
      const later = (ms, fn) => timers.push(setTimeout(() => panel.isConnected && fn(), ms));
      for (const el of rows) {
        const up = el.classList.contains('fl-up'), tech = el.classList.contains('fl-tech');
        later(at, () => {
          el.style.visibility = '';
          // Each line steps in from the side; level-ups punch in larger.
          el.animate(up || tech ? [{ transform: 'scale(1.6)', filter: 'brightness(3)' }, { transform: 'scale(0.92)', filter: 'brightness(1.4)' }, { transform: 'scale(1)', filter: 'none' }] : [{ transform: 'translateX(-24px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: up || tech ? 320 : 180, easing: 'steps(5, end)' });
          if (tech) {
            sfx('sfx_learn');
            el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 900, iterations: 3, easing: 'steps(6, end)' });
          } else if (up) sfx('sfx_level_up');
          else sfx('sfx_tick');
          // Numbers count up.
          for (const b of el.querySelectorAll('[data-n]')) {
            const n = +b.dataset.n;
            const t0 = performance.now();
            const step = () => {
              if (!panel.isConnected) return;
              const k = Math.min(1, (performance.now() - t0) / 520);
              b.textContent = Math.round(n * k);
              if (k < 1) { if (Math.floor(k * 9) !== Math.floor((k - 0.03) * 9)) sfx('sfx_tick'); requestAnimationFrame(step); }
            };
            if (n > 0) step();
          }
        });
        at += up ? 520 : tech ? 700 : 260;
      }
    } else if (r.ups.length) sfx('sfx_level_up');
    await done;
  };
  // [length of the moment, ms before the tile effects and the damage] for tech.big (battlectl).
  FEEL.BIG_TIME = FEEL.BIG_TIME || {};
})();

// ---- Spell craft: element beats, screen warps, beams, domes ---------------------------------------
(function () {
  const CT = window.CT;
  const PXD = CT.PXD;
  const RAMPS = CT.FX_RAMPS;
  const P = CT.Renderer.prototype;
  const FEEL = CT.FEEL;
  const { hashI, mk, bandRing } = FEEL;
  const TAU = Math.PI * 2;
  const STEP = 33;
  const INK = '#0a0612';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sfx = (id) => CT.audio && CT.audio.sfx(id);

  // ---- Screen warps (run on the finished picture, like SNES HDMA tricks) ---------------------------
  // shimmer: heat haze over a region; wave: the whole picture sways; pinch: a lens that drags
  // the picture toward a point; mosaic: blocks; cut: the picture parts along a blade stroke;
  // invert: one negative frame.
  P.post = function (kind, o = {}) {
    const p = Object.assign({ kind, t0: performance.now() + (o.delay || 0), ms: 400 }, o);
    (this.posts || (this.posts = [])).push(p);
    return p;
  };
  const env = (k, a = 0.2, r = 0.4) => (k < a ? k / a : k > 1 - r ? (1 - k) / r : 1);
  const region = (R, x, y, w, h) => {
    x = clamp(Math.round(x), 0, R.W - 1); y = clamp(Math.round(y), 0, R.H - 1);
    w = clamp(Math.round(w), 1, R.W - x); h = clamp(Math.round(h), 1, R.H - y);
    return [x, y, w, h];
  };
  const shiftRow = (d, row, w, off, tmp) => {
    // Shift one row of a Uint32 picture sideways, repeating the edge pixel.
    if (!off) return;
    const a = row * w;
    tmp.set(d.subarray(a, a + w));
    if (off > 0) { d.set(tmp.subarray(0, w - off), a + off); d.fill(tmp[0], a, a + off); }
    else { d.set(tmp.subarray(-off), a); d.fill(tmp[w - 1], a + w + off, a + w); }
  };
  const POST = (FEEL.POST = {
    shimmer(p, k, now) {
      const [x, y, w, h] = region(this, p.sx - p.w / 2, p.sy - p.h, p.w, p.h);
      const im = this.ctx.getImageData(x, y, w, h);
      const d = new Uint32Array(im.data.buffer), tmp = new Uint32Array(w);
      const e = env(k, 0.15, 0.5);
      const st = Math.floor(now / STEP);
      for (let r = 0; r < h; r++) {
        if ((r + st) % 3 === 0) continue;
        // Stronger toward the top, where the hot air rises.
        const amp = e * (p.amp || 1.6) * (0.4 + 0.6 * (1 - r / h));
        shiftRow(d, r, w, Math.round(Math.sin(r * 0.8 - now / 60) * amp), tmp);
      }
      this.ctx.putImageData(im, x, y);
    },
    wave(p, k, now) {
      const y0 = p.y0 != null ? clamp(Math.round(p.y0), 0, this.H - 1) : 0, h = p.h != null ? clamp(Math.round(p.h), 1, this.H - y0) : this.H - y0;
      const im = this.ctx.getImageData(0, y0, this.W, h);
      const d = new Uint32Array(im.data.buffer), tmp = new Uint32Array(this.W);
      const amp = env(k, p.a != null ? p.a : 0.2, p.r != null ? p.r : 0.5) * (p.amp || 4);
      for (let r = 0; r < h; r++) shiftRow(d, r, this.W, Math.round(Math.sin((r + y0) / (p.len || 11) + now / (p.speed || 80)) * amp), tmp);
      this.ctx.putImageData(im, 0, y0);
    },
    pinch(p, k) {
      const R = p.r || 70;
      const [x, y, w, h] = region(this, p.sx - R, p.sy - R / 2, R * 2, R);
      const im = this.ctx.getImageData(x, y, w, h);
      const s = new Uint32Array(im.data.buffer.slice(0)), d = new Uint32Array(im.data.buffer);
      const amt = (p.amt || 0.5) * (p.env ? p.env(k) : env(k, 0.3, 0.2));
      const cx = p.sx - x, cy = p.sy - y;
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const dx = i - cx, dy = (j - cy) * 2;
          const q = Math.hypot(dx, dy) / R;
          if (q >= 1) continue;
          const sc = 1 + amt * (1 - q) * (1 - q) * 2.2;
          const sx = Math.round(cx + dx * sc), sy = Math.round(cy + (dy * sc) / 2);
          d[j * w + i] = sx >= 0 && sy >= 0 && sx < w && sy < h ? s[sy * w + sx] : 0xff12060a;
        }
      this.ctx.putImageData(im, x, y);
    },
    mosaic(p, k) {
      const n = Math.max(1, Math.round(p.size ? p.size(k) : 2 + env(k, 0.5, 0.5) * 14));
      if (n < 2) return;
      const [x, y, w, h] = p.w ? region(this, p.sx - p.w / 2, p.sy - p.h / 2, p.w, p.h) : [0, 0, this.W, this.H];
      const im = this.ctx.getImageData(x, y, w, h);
      const d = new Uint32Array(im.data.buffer);
      for (let j = 0; j < h; j += n)
        for (let i = 0; i < w; i += n) {
          const c = d[Math.min(h - 1, j + (n >> 1)) * w + Math.min(w - 1, i + (n >> 1))];
          for (let b = j; b < Math.min(h, j + n); b++) d.fill(c, b * w + i, b * w + Math.min(w, i + n));
        }
      this.ctx.putImageData(im, x, y);
    },
    cut(p, k) {
      // The picture parts along each stroke: left of the line slides left, right slides right.
      const gap = Math.round((p.gap || 5) * (1 - k) * (1 - k));
      if (gap < 1) return;
      const y0 = clamp(Math.round(p.y0 != null ? p.y0 : 0), 0, this.H - 1), h = clamp(Math.round(p.h != null ? p.h : this.H), 1, this.H - y0);
      const im = this.ctx.getImageData(0, y0, this.W, h);
      const d = new Uint32Array(im.data.buffer), tmp = new Uint32Array(this.W);
      const W = this.W;
      const white = 0xffffffff, pale = p.pale || 0xfffce0c0;
      for (const [ax, ay, bx, by] of p.lines) {
        for (let r = 0; r < h; r++) {
          const yy = r + y0;
          if ((yy - ay) * (yy - by) > 0) continue;
          const lx = Math.round(ax + ((yy - ay) / (by - ay || 1)) * (bx - ax));
          if (lx < gap + 1 || lx > W - gap - 2) continue;
          const a = r * W;
          tmp.set(d.subarray(a, a + W));
          d.set(tmp.subarray(gap, lx), a);                 // left part slides left
          d.set(tmp.subarray(lx, W - gap), a + lx + gap);  // right part slides right
          d.fill(pale, a + lx - gap, a + lx + gap);
          d.fill(white, a + lx - Math.max(1, gap - 2), a + lx + Math.max(1, gap - 2));
        }
      }
      this.ctx.putImageData(im, 0, y0);
    },
    invert() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    },
  });
  P.drawPost = function (now) {
    if (this.posts && this.posts.length) {
      this.posts = this.posts.filter((p) => now - p.t0 < p.ms);
      for (const p of this.posts) {
        if (now < p.t0) continue;
        POST[p.kind].call(this, p, (now - p.t0) / p.ms, now);
      }
    }
    this.drawZoom(now);
  };

  // ---- Mid layer: over the world, under the effect sheets ----------------------------------------
  P.mid = function (kind, o = {}) {
    const m = Object.assign({ kind, t0: performance.now() + (o.delay || 0), ms: 500 }, o);
    (this.mids || (this.mids = [])).push(m);
    return m;
  };
  // Darkness that eats the light around a point: solid at the heart, dithering out to the rim.
  const darkCv = {};
  function darkDisc(rx) {
    if (darkCv[rx]) return darkCv[rx];
    const ry = rx >> 1;
    return (darkCv[rx] = CT.PX.canvas(rx * 2 + 1, ry * 2 + 1, (g) => {
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) {
          const q = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2);
          if (q >= 1) continue;
          const keep = q < 0.45 ? true : q < 0.7 ? ((x + y) & 1) === 0 : q < 0.88 ? (x & 1) === 0 && (y & 1) === 0 : (x & 3) === 0 && (y & 3) === 0;
          if (!keep) continue;
          g.fillStyle = q > 0.8 ? '#4a1c6c' : q > 0.6 ? '#2a1040' : INK;
          g.fillRect(x + rx, y + ry, 1, 1);
        }
    }));
  }
  // Luminaire's dome of light, baked once: a bright shell that thins toward the heart so the
  // units inside stay readable; later frames break up into dither as it spends itself.
  let domeCv = null;
  const DOME_R = 86;
  function domeFrames() {
    if (domeCv) return domeCv;
    const G = ['#ffffff', '#fff4b0', '#fce068', '#f8bc3c', '#e88c28'].map((h) => CT.PAL.hex(h));
    const E = [0.16, 0.36, 0.58, 0.78, 0.92, 1.0, 1.03, 1.05, 1.06, 1.07];
    const F = [1, 1, 1, 1, 0.9, 0.75, 0.55, 0.38, 0.22, 0.1];
    domeCv = E.map((e, fi) => {
      const rx = Math.round(DOME_R * e), ry = rx >> 1, rz = Math.round(rx * 0.68);
      const w = rx * 2 + 3, h = ry + rz + 3;
      const cv = CT.PX.canvas(w, h);
      const g = cv.getContext('2d');
      const im = g.createImageData(w, h);
      const d = im.data;
      const f = F[fi];
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const x = i - rx - 1, y = j - rz - 1;
          const q = (x / rx) ** 2 + (y / (y < 0 ? rz : ry)) ** 2;
          if (q > 1) continue;
          const edge = 1 - Math.sqrt(q); // 0 on the shell, 1 at the heart
          const b = (i & 1) + ((j & 1) << 1); // 2x2 Bayer cell
          const th = [0, 2, 3, 1][b] / 4;
          let c = -1;
          if (edge < 0.03 * f + 0.008) c = f > 0.5 || th < f * 2 ? 0 : -1;
          else if (edge < 0.08 * f) c = th < f + 0.2 ? 1 : -1;
          else if (edge < 0.18 * f) c = th < 0.75 * f ? 2 : -1;
          else if (edge < 0.34 * f) c = th < 0.5 * f ? 3 : -1;
          else if (edge < 0.55 * f) c = th < 0.25 * f && ((i + j) & 3) === 0 ? 3 : -1;
          // A specular arc high on the left shoulder of the dome.
          if (y < 0 && x < 0 && edge > 0.2 && edge < 0.26 && Math.atan2(-y / rz, -x / rx) > 0.5 && Math.atan2(-y / rz, -x / rx) < 1.15 && f > 0.4) c = 0;
          if (c < 0) continue;
          const o = (j * w + i) * 4;
          d[o] = G[c][0]; d[o + 1] = G[c][1]; d[o + 2] = G[c][2]; d[o + 3] = 255;
        }
      g.putImageData(im, 0, 0);
      return { cv, rx, ry, rz };
    });
    return domeCv;
  }
  const RAINBOW = ['#d43c3c', '#e88c28', '#fce068', '#74b43c', '#48a894', '#5c90dc', '#9450c0'];
  const MID = {
    dark(m, k) {
      const e = env(k, 0.25, 0.35);
      const rx = [8, 12, 16, 20][Math.min(3, Math.floor(e * 4))] * (m.big ? 2 : 1);
      const cv = darkDisc(rx);
      this.ctx.drawImage(cv, Math.round(m.sx - rx), Math.round(m.sy - (rx >> 1)));
    },
    dome(m, k, now) {
      const fr = domeFrames();
      const t = now - m.t0;
      // Out fast in six steps, hang breathing, then break up.
      const grow = Math.min(5, Math.floor(t / 50));
      let i = grow;
      if (t > 300) i = k > 0.62 ? Math.min(9, 6 + Math.floor(((k - 0.62) / 0.38) * 4)) : 5 + (Math.floor(t / 100) % 2 ? 0 : 0);
      const f = fr[i];
      const ctx = this.ctx;
      ctx.drawImage(f.cv, Math.round(m.sx - f.rx - 1), Math.round(m.sy - f.rz - 1));
      if (i >= 3 && k < 0.7) {
        // Lightning crawls down the shell from the crown.
        const st = Math.floor(now / STEP);
        for (let a = 0; a < 4; a++) {
          const ang = ((a + hashI(a, st >> 2, 3)) / 4) * TAU;
          const pts = [];
          for (let s = 0; s <= 7; s++) {
            const u = s / 7; // 0 crown -> 1 rim
            const el = (1 - u) * (Math.PI / 2);
            const rr = Math.cos(el);
            const jx = (hashI(a, s, st >> 1) - 0.5) * 7, jy = (hashI(a, s + 20, st >> 1) - 0.5) * 4;
            pts.push([m.sx + Math.cos(ang) * rr * f.rx + jx, m.sy + Math.sin(ang) * rr * f.ry - Math.sin(el) * f.rz + jy]);
          }
          ctx.fillStyle = '#f8bc3c';
          for (let s = 1; s < pts.length; s++) PXD.line(ctx, pts[s - 1][0], pts[s - 1][1], pts[s][0], pts[s][1], 2);
          ctx.fillStyle = '#ffffff';
          for (let s = 1; s < pts.length; s++) PXD.line(ctx, pts[s - 1][0], pts[s - 1][1], pts[s][0], pts[s][1], 1);
        }
      }
    },
    beam(m, k, now) {
      const ctx = this.ctx;
      const [ax, ay] = m.unit ? [m.unit._sx + (m.dx || 0), m.unit._sy - 20] : [m.ax, m.ay];
      const grow = Math.min(1, k / 0.14);
      const bx = ax + (m.sx - ax) * grow, by = ay + (m.sy - ay) * grow;
      const st = Math.floor(now / STEP);
      const thin = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
      if (m.style === 'prism') {
        // Seven bands of colour around a white core; the bands shuffle as the prism turns.
        const hw = Math.max(0, Math.round(4 * thin));
        for (let o = -hw - 1; o <= hw + 1; o++) {
          ctx.fillStyle = Math.abs(o) > hw ? '#2a1040' : RAINBOW[(o + 14 + (st >> 1)) % 7];
          PXD.line(ctx, ax, ay + o, bx, by + o, 1);
        }
        if (k < 0.55) { ctx.fillStyle = '#ffffff'; PXD.line(ctx, ax, ay, bx, by, k < 0.3 ? 3 : 1); }
        // Glints run down the beam.
        for (let i = 0; i < 5; i++) {
          const u = ((st * 0.07 + i / 5) % 1) * grow;
          const gx = Math.round(ax + (m.sx - ax) * u), gy = Math.round(ay + (m.sy - ay) * u) + ((i % 3) - 1) * 3;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3);
        }
      } else {
        // Laser: white core in a pink sheath with teal fringes that flicker.
        const L = RAMPS.laser;
        const w = Math.max(1, Math.round(5 * thin));
        ctx.fillStyle = st % 2 ? L[4] : L[3];
        PXD.line(ctx, ax, ay, bx, by, w + 4);
        ctx.fillStyle = L[2];
        PXD.line(ctx, ax, ay, bx, by, w + 2);
        ctx.fillStyle = L[1];
        PXD.line(ctx, ax, ay, bx, by, w);
        ctx.fillStyle = '#ffffff';
        PXD.line(ctx, ax, ay, bx, by, Math.max(1, w - 2));
      }
      // Muzzle and tip flares.
      const fl = [3, 5, 4][st % 3] * (thin > 0.5 ? 1 : 0.5);
      for (const [x, y] of [[ax, ay], [bx, by]]) {
        ctx.fillStyle = m.style === 'prism' ? '#f8b0c8' : RAMPS.laser[1];
        ctx.fillRect(Math.round(x - fl), Math.round(y), Math.round(fl * 2 + 1), 1);
        ctx.fillRect(Math.round(x), Math.round(y - fl), 1, Math.round(fl * 2 + 1));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      }
    },
  };
  FEEL.MID = MID;
  P.drawMid = function (now) {
    if (!this.mids || !this.mids.length) return;
    this.mids = this.mids.filter((m) => now - m.t0 < m.ms);
    for (const m of this.mids) {
      if (now < m.t0) continue;
      MID[m.kind].call(this, m, (now - m.t0) / m.ms, now);
    }
  };
  // One beam from a caster through a line of tiles (Prism Beam, Laser Spin).
  P.beam = function (style, u, tile, ms = 620) {
    const [sx, sy] = this.project(tile.x, tile.y, this.tileHeight(tile));
    // Run a little past the last tile so the beam clearly crosses it.
    const [ux, uy] = this.unitScreenPos(u);
    const d = Math.hypot(sx - ux, sy - uy) || 1;
    this.mid('beam', { style, unit: u, sx: Math.round(sx + ((sx - ux) / d) * 14), sy: Math.round(sy - 12 + ((sy - uy) / d) * 7), ms });
    sfx('sfx_scanline');
  };

  // ---- What an element does to the tile it lands on --------------------------------------------
  // Called by Renderer.stageFx on the impact frame of a spell-sized effect.
  P.elemBeat = function (elem, x, y, h, first, unit) {
    const [sx, sy] = unit ? this.unitScreenPos(unit) : this.project(x, y, h);
    const tx = unit ? Math.round(unit.rx) : x, ty = unit ? Math.round(unit.ry) : y;
    const res = FEEL.RESIDUE[elem];
    if (res) this.decal(tx, ty, res, { delay: 120 });
    // The unit standing there wears the element for a moment.
    const v = this.world && this.world.units.find((q) => q.alive !== false && !q.hidden && !q.prop && Math.round(q.rx) === tx && Math.round(q.ry) === ty);
    switch (elem) {
      case 'lightning':
      case 'laser':
        if (v) this.tint(v, '#fff4b0', 260, 0.9);
        if (first) this.scatter('crackle', 3, sx, sy - 4, sy, RAMPS.lightning, { jitter: 300 });
        break;
      case 'fire':
        if (v) this.tint(v, '#f8bc3c', 420, 0.5);
        if (first) this.post('shimmer', { sx, sy: sy + 2, w: 76, h: 62, ms: 950, amp: 1.8 });
        this.scatter('puff', first ? 3 : 1, sx, sy - 14, sy - 10, RAMPS.slash, { tone: 'smoke', spread: 12, speed: 0.4, delay: 320, jitter: 300 });
        break;
      case 'ice':
      case 'glass':
        if (v) this.tint(v, '#c4e4ff', 620, 0.6);
        this.scatter('puff', first ? 3 : 1, sx, sy, sy + 2, RAMPS.slash, { tone: 'steam', spread: 16, speed: 0.6, jitter: 200 });
        break;
      case 'water':
        if (v) this.tint(v, '#8cc0f0', 360, 0.45);
        this.scatter('ripple', 1, sx, sy, sy + 1, RAMPS.water, { r: 14, delay: 200 });
        break;
      case 'shadow':
      case 'dark':
      case 'psy':
        // Shadow eats the light: a pool of dark, and the victim's afterimages torn off it.
        this.mid('dark', { sx, sy, ms: 560 });
        if (v) {
          this.tint(v, '#6c3094', 520, 0.6);
          this.ghost(v, { hex: '#6c3094', dx: -4, dy: -1, ms: 320, alpha: 0.55 });
          this.ghost(v, { hex: '#9450c0', dx: 5, dy: -2, ms: 420, alpha: 0.45, delay: 60 });
        }
        break;
      case 'lavos':
        if (v) this.tint(v, '#f06c4c', 320, 0.5);
        break;
      case 'heal':
        this.scatter('orb', first ? 6 : 3, sx, sy - 10, sy, RAMPS.heal, { spread: 18, jitter: 300 });
        break;
      case 'porcelain':
        this.scatter('flake', first ? 5 : 2, sx, sy - 10, sy, RAMPS.porcelain, { spread: 14 });
        break;
    }
  };
})();

// ---- Signature moments ----------------------------------------------------------------------------
// Each full-screen tech gets one beat to remember it by:
//   Luminaire      a dome of light blows out from Crono's blade, lightning crawling over it
//   Black Hole     the picture itself is dragged into the singularity
//   Dark Matter    triangles of dark close on a black sun; one negative frame; a cross of annihilation
//   Eclipse Blade  the moon takes the sun; at totality two blades part the screen
//   X-Strike       two crescents cross and the picture splits along them
//   Core Rain      the core screams (the screen sways) and the sky fills with needles
//   Erase Era      the era is deleted: the picture breaks into blocks behind a scan bar
// Renderer.drawBig dispatches here: fn.call(renderer, b, ctx, t, k, st, cx, cy, once).
(function () {
  const CT = window.CT;
  const PXD = CT.PXD;
  const RAMPS = CT.FX_RAMPS;
  const P = CT.Renderer.prototype;
  const FEEL = CT.FEEL;
  const { hashI, mk, bandRing } = FEEL;
  const TAU = Math.PI * 2;
  const STEP = 33;
  const INK = '#0a0612';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sfx = (id) => CT.audio && CT.audio.sfx(id);
  const G = RAMPS.lightning, V = RAMPS.shadow;

  // Target tile of a moment started by the battle (falls back to its centre).
  const tgt = (R, b, cx, cy) => {
    const a = b.at;
    if (a && a.x != null && a.h != null) { const [x, y] = R.project(a.x, a.y, a.h); return [Math.round(x), Math.round(y) - 12]; }
    return [cx, cy];
  };
  // Four-point star with arms `w` thick.
  function star(ctx, x, y, s, w, core, arm) {
    x = Math.round(x); y = Math.round(y); s = Math.round(s);
    const o = w >> 1;
    ctx.fillStyle = arm;
    ctx.fillRect(x - s, y - o, s * 2 + 1, w);
    ctx.fillRect(x - o, y - s, w, s * 2 + 1);
    ctx.fillStyle = core;
    const c = Math.max(1, Math.round(s * 0.45));
    ctx.fillRect(x - c, y - Math.max(0, o - 1), c * 2 + 1, Math.max(1, w - 2));
    ctx.fillRect(x - Math.max(0, o - 1), y - c, Math.max(1, w - 2), c * 2 + 1);
    ctx.fillRect(x - o - 1, y - o - 1, w + 2, w + 2);
  }
  // A blade stroke: a crescent swept along a bowed path from A to B. Drawn from u0 to u1
  // (0..1), fat in the middle, with a white core inside a coloured sheath.
  function slash(ctx, ax, ay, bx, by, bow, u0, u1, cols, maxW) {
    const nx = -(by - ay), ny = bx - ax;
    const len = Math.hypot(nx, ny) || 1;
    const N = 28;
    const pt = (u) => {
      const o = Math.sin(u * Math.PI) * bow;
      return [ax + (bx - ax) * u + (nx / len) * o, ay + (by - ay) * u + (ny / len) * o];
    };
    for (const [ci, shrink] of [[0, 0], [1, 2], [2, 4]]) {
      ctx.fillStyle = cols[ci];
      for (let i = Math.floor(u0 * N); i < Math.ceil(u1 * N); i++) {
        const ua = i / N, ub = (i + 1) / N;
        const w = Math.round(Math.sin(((ua + ub) / 2) * Math.PI) * maxW) - shrink;
        if (w < 1) continue;
        const [x0, y0] = pt(ua), [x1, y1] = pt(ub);
        PXD.line(ctx, x0, y0, x1, y1, w);
      }
    }
  }
  FEEL.slash = slash;

  const BIG = (FEEL.BIG = {});

  // ---- Luminaire ------------------------------------------------------------------------------
  BIG.luminaire = function (b, ctx, t, k, st, cx, cy, once) {
    const W = this.W, H = this.H;
    const tg = 460;
    if (t < tg) {
      // Light is pulled out of the whole field into the blade.
      const q = t / tg;
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU + hashI(i, b.seed) * 0.4;
        const p = (q * 1.7 + hashI(i, 2, b.seed)) % 1;
        const r0 = (1 - p) * (150 + hashI(i, 3, b.seed) * 120) + 9, r1 = r0 + 10 + p * 18;
        const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0 * 0.6;
        const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1 * 0.6;
        ctx.fillStyle = i % 2 ? G[2] : G[3];
        PXD.line(ctx, x1, y1, x0, y0, 2);
        ctx.fillStyle = '#ffffff';
        PXD.line(ctx, x0 + (x1 - x0) * 0.4, y0 + (y1 - y0) * 0.4, x0, y0, 1);
      }
      // The gathered light: a hard white core in a gold corona that keeps swelling.
      const r = 2 + Math.floor(q * 7) + (st % 2);
      bandRing(ctx, cx, cy, r + 5, r + 5, 2, G[1], G[2], G[4], st);
      ctx.fillStyle = '#ffffff';
      PXD.disc(ctx, cx, cy, r);
      star(ctx, cx, cy, 7 + Math.floor(q * 20), q > 0.5 ? 3 : 1, '#ffffff', G[1]);
      return;
    }
    const caster = b.at && b.at.caster;
    const [gx, gy] = caster ? this.unitScreenPos(caster) : [cx, cy + 18];
    once('dome', () => {
      this.mid('dome', { sx: Math.round(gx), sy: Math.round(gy), ms: b.ms - tg + 80 });
      this.post('wave', { ms: 300, amp: 3, len: 7, speed: 40, a: 0.05, r: 0.8 });
      this.rings.push({ x: Math.round(gx), y: Math.round(gy), t0: performance.now(), ms: 520, r: 150, ramp: G, flat: true, th: 6 });
      // Glitter is all that is left when the dome lets go.
      for (let i = 0; i < 34; i++) {
        const a = (i / 34) * TAU;
        this.addBit({ k: 'sparkle', x: gx + Math.cos(a) * 80 * (0.5 + Math.random() * 0.5), y: gy + Math.sin(a) * 40 * (0.5 + Math.random() * 0.5) - 20 - Math.random() * 30, vx: 0, vy: 0.2 + Math.random() * 0.25, life: 700 + Math.random() * 500, ramp: G, ph: Math.random() * 100, t0: performance.now() + 620 + Math.random() * 300 });
      }
    });
    const d = t - tg;
    if (d < 130) {
      // Impact frames: the core blows out white.
      const rr = 10 + (d / 130) * 46;
      ctx.fillStyle = d < 66 ? '#ffffff' : G[0];
      PXD.ellipse(ctx, cx, cy + 6, Math.round(rr), Math.round(rr * 0.72));
      star(ctx, cx, cy + 6, rr + 30, 5, '#ffffff', G[0]);
    }
    // Stars come out over the darkened field while the dome hangs.
    const s = d / (b.ms - tg);
    for (let i = 0; i < 44; i++) {
      const p = (st + i * 3) % 10;
      if (p > 5 || hashI(i, b.seed) * 1.2 > s + 0.3 || s > 0.85) continue;
      const x = Math.round(hashI(i, 1, b.seed) * W), y = Math.round(hashI(i, 2, b.seed) * H * 0.9), r = [0, 1, 2, 3, 2, 1][p];
      ctx.fillStyle = G[2];
      ctx.fillRect(x - r, y, r * 2 + 1, 1);
      ctx.fillRect(x, y - r, 1, r * 2 + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    }
  };

  // ---- Black Hole -------------------------------------------------------------------------------
  // Build-up (from the battle): the light of the field bleeds into one point over the target.
  BIG.blackhole = function (b, ctx, t, k, st, cx, cy, once) {
    const [tx, ty] = tgt(this, b, cx, cy);
    once('lens', () => this.post('pinch', { sx: tx, sy: ty, r: 64, amt: 0.3, ms: b.ms, env: (q) => q }));
    for (let i = 0; i < 56; i++) {
      const p = (t / 560 + hashI(i, b.seed)) % 1;
      const a = hashI(i, 3, b.seed) * TAU + p * 2.6;
      const r = (1 - p * p) * (190 + hashI(i, 4) * 130), r2 = (1 - (p - 0.05) * (p - 0.05)) * (190 + hashI(i, 4) * 130);
      const x = tx + Math.cos(a) * r, y = ty + Math.sin(a) * r * 0.62;
      const x2 = tx + Math.cos(a - 0.13) * r2, y2 = ty + Math.sin(a - 0.13) * r2 * 0.62;
      ctx.fillStyle = V[Math.min(5, Math.floor(p * 4))];
      PXD.line(ctx, x2, y2, x, y, p < 0.6 ? 2 : 1);
      ctx.fillStyle = p > 0.75 ? INK : V[0];
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    const r = Math.min(9, 1 + (st >> 1));
    bandRing(ctx, tx, ty, r + 3, Math.round((r + 3) * 0.62), 2, V[0], V[2], V[4], st);
    ctx.fillStyle = INK;
    PXD.ellipse(ctx, tx, ty, r, Math.round(r * 0.62));
  };
  // The singularity itself (staged by fx_black_hole): accretion disc, lens, collapse.
  BIG.singularity = function (b, ctx, t, k, st, cx, cy, once) {
    once('lens', () => this.post('pinch', { sx: cx, sy: cy, r: 86, amt: 0.6, ms: b.ms * 0.88, env: (q) => (q < 0.15 ? 0.5 + (q / 0.15) * 0.5 : q > 0.8 ? (1 - q) / 0.2 : 1) }));
    const e = k < 0.15 ? k / 0.15 : k > 0.82 ? Math.max(0, (1 - k) / 0.18) : 1;
    const R0 = 44 * e;
    // Matter torn off the field spirals in along three arms.
    for (let arm = 0; arm < 3; arm++)
      for (let j = 0; j < 30; j++) {
        const u = j / 30;
        const a = (arm * TAU) / 3 + st * 0.24 + u * 4.4;
        const r = R0 * (1.2 - u) + 3;
        const x = Math.round(cx + Math.cos(a) * r * 1.35), y = Math.round(cy + Math.sin(a) * r * 0.55);
        ctx.fillStyle = (j + st) % 7 === 0 ? '#ffffff' : V[Math.max(0, 3 - Math.floor(u * 4))];
        ctx.fillRect(x, y, u < 0.5 ? 3 : 2, u < 0.3 ? 2 : 1);
      }
    // The disc: a thick violet band with hot knots racing round it.
    const drx = Math.round(R0 * 1.2) + 5, dry = Math.round(R0 * 0.44) + 2;
    bandRing(ctx, cx, cy, drx, dry, 3, V[0], V[2], V[4], st);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + st * 0.21;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(cx + Math.cos(a) * (drx - 1)) - 1, Math.round(cy + Math.sin(a) * (dry - 1)), 3, 2);
    }
    // Event horizon.
    const hr = Math.max(1, Math.round(R0 * 0.36)), hry = Math.max(1, Math.round(hr * 0.7));
    bandRing(ctx, cx, cy, hr + 2, hry + 2, 2, '#ffffff', V[0], V[2], st);
    ctx.fillStyle = INK;
    PXD.ellipse(ctx, cx, cy, hr, hry);
    if (k > 0.86) {
      // Collapse: everything folds to a point and lets go.
      star(ctx, cx, cy, Math.round(((1 - k) / 0.14) * 50) + 5, 3, '#ffffff', V[0]);
      once('boom', () => {
        this.rings.push({ x: cx, y: cy + 8, t0: performance.now(), ms: 460, r: 120, ramp: V, flat: true, th: 6 });
        sfx('sfx_impact');
      });
    }
  };

  // ---- Dark Matter --------------------------------------------------------------------------------
  BIG.darkmatter = function (b, ctx, t, k, st, cx, cy) {
    const [tx, ty] = tgt(this, b, cx, cy);
    const q = Math.min(1, t / 620);
    // Three triangles of dark close on the point, turning against each other.
    for (let j = 0; j < 3; j++) {
      const rr = (1 - q) * (160 - j * 36) + 18 + j * 6;
      const rot = (j % 2 ? -1 : 1) * (t / 260) + j * 0.7;
      const pts = [0, 1, 2].map((i) => [tx + Math.cos(rot + (i * TAU) / 3) * rr * 1.25, ty + Math.sin(rot + (i * TAU) / 3) * rr * 0.62]);
      for (let i = 0; i < 3; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 3];
        ctx.fillStyle = V[4];
        PXD.line(ctx, x0, y0, x1, y1, 5 - j);
        ctx.fillStyle = V[2 - Math.min(2, j)];
        PXD.line(ctx, x0, y0, x1, y1, 3 - Math.min(2, j));
        if (j === 0) { ctx.fillStyle = '#ffffff'; PXD.line(ctx, x0, y0, x1, y1, 1); }
      }
    }
    // A black sun forms over the target and falls onto it.
    const fall = t > 620 ? Math.min(1, (t - 620) / 140) : 0;
    if (fall >= 1) return;
    const sy = ty - 34 + Math.round(fall * 34);
    const r = Math.round(4 + q * 13);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + st * 0.05;
      const L = 5 + ((i * 5 + st) % 4) * 3;
      ctx.fillStyle = V[2];
      PXD.line(ctx, tx + Math.cos(a) * r, sy + Math.sin(a) * r, tx + Math.cos(a) * (r + L), sy + Math.sin(a) * (r + L), 2);
      ctx.fillStyle = V[0];
      PXD.line(ctx, tx + Math.cos(a) * r, sy + Math.sin(a) * r, tx + Math.cos(a) * (r + L * 0.5), sy + Math.sin(a) * (r + L * 0.5), 1);
    }
    bandRing(ctx, tx, sy, r + 2, r + 2, 2, V[0], V[1], V[3], st);
    ctx.fillStyle = INK;
    PXD.disc(ctx, tx, sy, r);
    ctx.fillStyle = V[1];
    ctx.fillRect(tx - (r >> 1), sy - (r >> 1), 2, 1);
    // The field's light spirals into it.
    for (let i = 0; i < 40; i++) {
      const p = (t / 620 + hashI(i, b.seed)) % 1;
      const a = hashI(i, 3, b.seed) * TAU - p * 1.8;
      const rr = (1 - p * p) * (170 + hashI(i, 4) * 110);
      const x = Math.round(tx + Math.cos(a) * rr), y = Math.round(sy + Math.sin(a) * rr * 0.62);
      ctx.fillStyle = V[Math.min(5, Math.floor(p * 4))];
      ctx.fillRect(x, y, p < 0.5 ? 2 : 1, 1);
    }
  };
  // The burst (staged by fx_dark_matter): one negative frame, then four arms of annihilation
  // run out along the tile grid from a core that swells and implodes.
  BIG.dm_burst = function (b, ctx, t, k, st, cx, cy, once) {
    once('neg', () => {
      this.post('invert', { ms: 70 });
      this.post('invert', { ms: 40, delay: 140 });
      this.post('wave', { ms: 420, amp: 3, len: 5, speed: 30, a: 0.02, r: 0.9 });
    });
    const gy = cy + 12;
    const reach = Math.min(1, k / 0.2) * 5.5;
    const fade = k > 0.55 ? (k - 0.55) / 0.45 : 0;
    const w = Math.max(1, Math.round(11 * (1 - fade)));
    for (const [ax, ay] of [[1, 0.5], [-1, 0.5], [1, -0.5], [-1, -0.5]]) {
      const ex = cx + ax * 16 * reach, ey = gy + ay * 16 * reach;
      if (fade > 0.5 && st % 2) continue;
      // Each arm tapers to its tip; a ragged violet fringe boils along its edges.
      for (const [col, grow] of [[V[3], 4], [V[1], 2], [INK, 0]]) {
        ctx.fillStyle = col;
        for (let s = 0; s < 6; s++) {
          const ua = s / 6, ub = (s + 1) / 6;
          const ww = Math.max(1, Math.round(w * (1 - ua * 0.6))) + grow + (grow === 4 ? Math.round(hashI(s, st >> 1, ax * 3 + ay * 7) * 3) : 0);
          PXD.line(ctx, cx + (ex - cx) * ua, gy + (ey - gy) * ua, cx + (ex - cx) * ub, gy + (ey - gy) * ub, ww);
        }
      }
      if (fade < 0.6) {
        // White cracks racing along each arm.
        ctx.fillStyle = st % 2 ? '#ffffff' : V[0];
        let px = cx, py = gy;
        for (let s = 1; s <= 6; s++) {
          const u = s / 6;
          const nx = cx + (ex - cx) * u + (hashI(s, st >> 1, ax + 3) - 0.5) * w, ny = gy + (ey - gy) * u + (hashI(s, st >> 1, ay * 2 + 9) - 0.5) * w * 0.6;
          PXD.line(ctx, px, py, nx, ny, 1);
          px = nx; py = ny;
        }
      }
    }
    const cr = k < 0.22 ? 6 + (k / 0.22) * 24 : Math.max(0, 30 * (1 - (k - 0.22) / 0.5));
    if (cr > 1) {
      bandRing(ctx, cx, cy + 2, Math.round(cr) + 3, Math.round(cr * 0.8) + 3, 3, '#ffffff', V[0], V[2], st);
      ctx.fillStyle = INK;
      PXD.ellipse(ctx, cx, cy + 2, Math.round(cr), Math.round(cr * 0.8));
    }
    if (k > 0.2) once('wave', () => this.rings.push({ x: cx, y: gy, t0: performance.now(), ms: 560, r: 160, ramp: V, flat: true, th: 7 }));
  };

  // ---- Eclipse Blade ------------------------------------------------------------------------------
  const BLADE = ['#6c3094', '#e0c0fc', '#ffffff'];
  BIG.eclipse = function (b, ctx, t, k, st, cx, cy, once) {
    const W = this.W, H = this.H;
    const sx = W >> 1, sy = 60, SR = 20;
    const TOT = 900, CUT = 1250, OUT = 1560;
    const q = clamp(t / TOT, 0, 1);
    const e = q * q * (3 - 2 * q);
    const off = t < OUT ? Math.round((1 - e) * -66) : Math.round(clamp((t - OUT) / (b.ms - OUT), 0, 1) ** 2 * 70);
    const total = Math.abs(off) < 3;
    // Corona: short flickering rays that leap out at totality.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + st * 0.03;
      const L = (total ? 15 : 6) + ((i * 7 + st) % 4) * (total ? 5 : 2);
      ctx.fillStyle = total ? (i % 2 ? '#ffffff' : G[0]) : i % 2 ? G[1] : G[2];
      PXD.line(ctx, sx + Math.cos(a) * (SR + 1), sy + Math.sin(a) * (SR + 1), sx + Math.cos(a) * (SR + L), sy + Math.sin(a) * (SR + L), i % 3 === 0 ? 2 : 1);
    }
    // The sun: gold rim, pale body, white heart.
    ctx.fillStyle = G[3];
    PXD.disc(ctx, sx, sy, SR + 1);
    ctx.fillStyle = G[1];
    PXD.disc(ctx, sx, sy, SR - 1);
    ctx.fillStyle = G[0];
    PXD.disc(ctx, sx - 2, sy - 2, SR - 6);
    ctx.fillStyle = '#ffffff';
    PXD.disc(ctx, sx - 4, sy - 4, SR - 12);
    // The moon: a black disc with violet seas, sliding across.
    const mx = sx + off;
    ctx.fillStyle = INK;
    PXD.disc(ctx, mx, sy, SR + 1);
    ctx.fillStyle = '#1a1226';
    PXD.disc(ctx, mx - 6, sy - 5, 5);
    PXD.disc(ctx, mx + 7, sy + 4, 4);
    PXD.disc(ctx, mx - 2, sy + 9, 3);
    ctx.fillStyle = V[4];
    PXD.ellipseRing(ctx, mx, sy, SR + 1, SR + 1);
    if (total) {
      // Diamond ring.
      bandRing(ctx, sx, sy, SR + 4, SR + 4, 2, '#ffffff', G[0], G[2], st);
      star(ctx, sx + 15, sy - 15, 9 + (st % 3) * 3, 3, '#ffffff', G[0]);
    }
    // At totality the two blades part the screen.
    const A = [W * 0.06, H * 0.12, W * 0.94, H * 0.9], B2 = [W * 0.94, H * 0.12, W * 0.06, H * 0.9];
    for (const [L, t0] of [[A, 1090], [B2, 1160]]) {
      const u = (t - t0) / 150;
      if (u <= 0) continue;
      if (u < 1.6) slash(ctx, L[0], L[1], L[2], L[3], 26, Math.max(0, u - 0.9), Math.min(1, u), BLADE, 13);
      else if (t < 1900 && st % 2 === 0) { ctx.fillStyle = V[1]; PXD.line(ctx, L[0], L[1], L[2], L[3], 1); }
    }
    if (t >= CUT) once('cut', () => {
      this.post('cut', { lines: [A, B2], gap: 7, ms: 420 });
      sfx('sfx_sword_hit');
    });
  };

  // ---- X-Strike --------------------------------------------------------------------------------
  const STEEL = ['#3c64b4', '#c4e4ff', '#ffffff'];
  BIG.xslash = function (b, ctx, t, k, st, cx, cy, once) {
    const A = [cx - 96, cy - 56, cx + 96, cy + 56], B2 = [cx + 96, cy - 56, cx - 96, cy + 56];
    for (const [L, k0] of [[A, 0], [B2, 0.15]]) {
      const u = (k - k0) / 0.16;
      if (u <= 0) continue;
      if (u < 1.7) slash(ctx, L[0], L[1], L[2], L[3], 16, Math.max(0, u - 0.85), Math.min(1, u), STEEL, 9);
      else if (k < 0.75 && st % 2 === 0) { ctx.fillStyle = RAMPS.slash[2]; PXD.line(ctx, L[0], L[1], L[2], L[3], 1); }
    }
    if (k > 0.3) once('cut', () => this.post('cut', { lines: [A, B2], gap: 4, ms: 300, y0: cy - 58, h: 116 }));
    if (k > 0.28 && k < 0.5) star(ctx, cx, cy, 16 - (st % 3) * 3, 3, '#ffffff', '#c4e4ff');
  };

  // ---- Core Rain -------------------------------------------------------------------------------
  BIG.corerain = function (b, ctx, t, k, st, cx, cy, once) {
    const W = this.W, H = this.H;
    const L = RAMPS.lavos;
    once('scream', () => {
      this.post('wave', { ms: 620, amp: 4, len: 9, speed: 50 });
      for (let i = 0; i < 3; i++) this.rings.push({ x: cx, y: cy + 10, t0: performance.now() + i * 120, ms: 560, r: 130 + i * 40, ramp: L, flat: true, th: 6 });
      this.flashScreen('160,32,48', 240, 0.7);
    });
    // A far curtain of needles behind the ones that matter.
    for (let i = 0; i < 46; i++) {
      const p = (t / 430 + hashI(i, b.seed)) % 1;
      if (k > 0.85 && hashI(i, 9) > (1 - k) / 0.15) continue;
      const x = Math.round(hashI(i, 1, b.seed) * W), y = Math.round(p * (H + 40) - 20);
      ctx.fillStyle = L[4];
      ctx.fillRect(x, y - 12, 1, 12);
      ctx.fillStyle = L[3];
      ctx.fillRect(x, y - 3, 1, 3);
    }
  };
  // The needles that land on tiles (battle `rain`): authored needle, impact burst, a glowing scar.
  const NEEDLE = mk([
    '..d..', '..d..', '..d..', '..r..', '..r..', '.drd.', '.drd.', '.rod.', '.ror.', '.ror.', '.ror.', 'droyd', 'droyd', 'droyd', 'dryyd', 'droyd',
    '.ryo.', '.ryo.', '.oyo.', '.oyo.', '..y..', '..w..', '..w..',
  ], { d: '#6c1422', r: '#d43c3c', o: '#f06c4c', y: '#fff4b0', w: '#ffffff' });
  P.rain = function (tiles) {
    const now = performance.now();
    tiles.forEach((t, ti) => {
      const [sx, sy] = this.project(t.x, t.y, this.tileHeight(t));
      for (let i = 0; i < 3; i++) this.mid('needle', { sx: Math.round(sx + (i - 1) * 6 + (Math.random() - 0.5) * 4), sy: Math.round(sy + (Math.random() - 0.5) * 4), tx: t.x, ty: t.y, delay: i * 90 + Math.random() * 200 + (ti % 3) * 40, ms: 400, first: ti === 0 && i === 0 });
    });
  };
  Object.assign(FEEL.MID, {
    needle(m, k) {
      const ctx = this.ctx;
      if (k < 0.72) {
        const y = Math.round(m.sy - 170 * (1 - k / 0.72));
        ctx.drawImage(NEEDLE, m.sx - 2, y - 22);
        return;
      }
      if (!m.hit) {
        m.hit = 1;
        this.scatter('flash', 1, m.sx, m.sy - 3, m.sy, RAMPS.lavos);
        this.scatter('ember', 3, m.sx, m.sy - 3, m.sy, RAMPS.lavos, { spread: 6 });
        this.scatter('chip', 2, m.sx, m.sy - 2, m.sy, RAMPS.slash, { tone: 'stone' });
        this.rings.push({ x: m.sx, y: m.sy, t0: performance.now(), ms: 240, r: 10, ramp: RAMPS.lavos, flat: true, th: 2 });
        this.decal(m.tx, m.ty, 'lavos');
        if (m.first) this.shake(4, 300);
      }
      // The needle stands in the ground a moment, then burns away.
      const q = (k - 0.72) / 0.28;
      const h = Math.round(22 * (1 - q));
      if (h > 0 && !(q > 0.5 && Math.floor(k * 40) % 2)) ctx.drawImage(NEEDLE, 0, 0, 5, h, m.sx - 2, m.sy - h, 5, h);
    },
  });

  // ---- Erase Era --------------------------------------------------------------------------------
  BIG.erase = function (b, ctx, t, k, st, cx, cy, once) {
    const W = this.W, H = this.H;
    const S = RAMPS.slash;
    const local = b.at && b.at.key === 'fx_deaccession';
    if (local) {
      // Deaccession: one exhibit struck from the record.
      once('mos', () => this.post('mosaic', { sx: cx, sy: cy - 6, w: 60, h: 76, ms: b.ms, size: (q) => 1 + Math.round(Math.sin(q * Math.PI) * 7) }));
      const y = cy - 44 + Math.round(k * 80);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 32, y, 64, 2);
      ctx.fillStyle = S[2];
      ctx.fillRect(cx - 32, y + 3, 64, 1);
      ctx.fillStyle = S[1];
      for (const dx of [-32, 31]) ctx.fillRect(cx + dx, cy - 44, 1, 80);
      return;
    }
    // The picture breaks into blocks behind a scan bar and burns out; `erase_out` resolves it.
    once('mos', () => this.post('mosaic', { ms: b.ms + 80, size: (q) => 1 + Math.round(Math.min(1, q * 1.1) ** 2 * 15) }));
    for (let i = 0; i < 60; i++) {
      // Flakes of the record lifting off the whole field.
      const p = (t / 800 + hashI(i, b.seed)) % 1;
      const x = Math.round(hashI(i, 1, b.seed) * W + Math.sin(t / 200 + i) * 3), y = Math.round(H * (1 - p));
      ctx.fillStyle = i % 3 ? S[1] : '#ffffff';
      ctx.fillRect(x, y, 2 + (i % 2), 2 + ((i >> 1) % 2));
    }
    {
      const y = Math.round(k * H);
      ctx.fillStyle = S[1];
      ctx.fillRect(0, y - 7, W, 1);
      ctx.fillRect(0, y + 5, W, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y - 1, W, 4);
      // Rows already read are struck through.
      ctx.fillStyle = S[3];
      for (let yy = (st % 4) * 2; yy < y - 8; yy += 8) ctx.fillRect(0, yy, W, 1);
    }
  };

  BIG.erase_out = function (b, ctx, t, k, st, cx, cy, once) {
    const W = this.W, H = this.H;
    const S = RAMPS.slash;
    once('mos', () => {
      this.post('mosaic', { ms: b.ms, size: (q) => 1 + Math.round((1 - q) ** 2 * 15) });
      this.flashScreen('255,255,255', 260, 0.9);
      this.shake(8, 420);
    });
    for (let i = 0; i < 40; i++) {
      const p = (t / 700 + hashI(i, b.seed)) % 1;
      if (hashI(i, 4) < k) continue;
      ctx.fillStyle = i % 3 ? S[1] : '#ffffff';
      ctx.fillRect(Math.round(hashI(i, 1, b.seed) * W), Math.round(H * (1 - p)), 2 + (i % 2), 2);
    }
  };

  // Timings: [length of the moment, ms before the tile effects and the damage].
  Object.assign(FEEL.BIG_TIME, { luminaire: [1700, 520], blackhole: [900, 420], darkmatter: [1500, 660], eclipse: [2300, 1250] });
  // Flash / shake cues follow the new beats.
  const T = CT.BIG_FX;
  if (T) {
    T.luminaire.flash = ['255,250,220', 180, 0.27];
    T.luminaire.shake = [7, 460, 0.28];
    T.luminaire.dim = ['#4a2a16', 0.6, 500];
    T.eclipse.flash = ['255,255,255', 180, 0.545];
    T.eclipse.shake = [7, 520, 0.55];
    T.eclipse.dim = ['#0a0612', 0.78, 300];
    T.dm_burst.shake = [10, 700, 0.02];
    T.dm_burst.flash = ['240,220,255', 160, 0.14];
    T.singularity.flash = ['224,192,252', 160, 0.88];
    T.singularity.shake = [8, 420, 0.87];
    T.corerain.shake = [6, 900, 0.02];
    delete T.erase.flash; // the burn-out belongs to erase_out, once the ground has gone
    delete T.erase.shake;
    T.erase.dim = ['#3a3a52', 0.45, 700];
    T.xslash.flash = ['216,240,255', 120, 0.3];
  }
})();

// ---- Interactive spots: the trigger burst and the tech-learned flourish ----------------------------
(function () {
  const CT = window.CT;
  const PXD = CT.PXD;
  const RAMPS = CT.FX_RAMPS;
  const P = CT.Renderer.prototype;
  const FEEL = CT.FEEL;
  const TAU = Math.PI * 2;
  const STEP = 33;

  // A ramp, light to dark, around an 'r,g,b' colour.
  const rampFrom = (rgb) => {
    const c = String(rgb).split(',').map(Number);
    const mix = (k, to) => '#' + c.map((v) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0')).join('');
    return ['#ffffff', mix(0.6, 255), mix(0.25, 255), mix(0, 0), mix(0.35, 0), mix(0.65, 0)];
  };
  Object.assign(FEEL.MID, {
    // A pillar of light standing on a tile: opens wide, then narrows to a thread.
    pillar(m, k, now) {
      const ctx = this.ctx;
      const R = m.ramp;
      const w = k < 0.15 ? Math.round((k / 0.15) * 7) : Math.max(0, Math.round(7 * (1 - (k - 0.15) / 0.85)));
      const top = m.sy - 150;
      const st = Math.floor(now / STEP);
      for (const [hw, col] of [[w + 2, R[3]], [w, R[1]], [Math.max(0, w - 2), '#ffffff']]) {
        if (hw <= 0 && col !== '#ffffff') continue;
        ctx.fillStyle = col;
        ctx.fillRect(m.sx - hw, top, hw * 2 + 1, m.sy - top);
      }
      // Dithered shoulders so the pillar has a soft edge.
      ctx.fillStyle = R[2];
      for (let y = top + (st & 1); y < m.sy; y += 2) {
        ctx.fillRect(m.sx - w - 3, y, 1, 1);
        ctx.fillRect(m.sx + w + 3, y, 1, 1);
      }
      // Where it meets the ground.
      FEEL.bandRing(ctx, m.sx, m.sy, w + 8, (w + 8) >> 1, 2, '#ffffff', R[1], R[3], st);
    },
    // Gold rays turning behind a hero who has just learned something.
    rays(m, k, now) {
      const ctx = this.ctx;
      const [sx, sy] = m.unit ? this.unitScreenPos(m.unit) : [m.sx, m.sy];
      const cx = Math.round(sx), cy = Math.round(sy) - 16;
      const e = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      const G = RAMPS.lightning;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + now / 700;
        const r0 = 15, r1 = 15 + (i % 2 ? 26 : 38) * e;
        ctx.fillStyle = i % 2 ? G[2] : G[1];
        PXD.line(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8, i % 2 ? 1 : 2);
        if (i % 2 === 0) { ctx.fillStyle = '#ffffff'; PXD.line(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8, cx + Math.cos(a) * (r0 + (r1 - r0) * 0.5), cy + Math.sin(a) * (r0 + (r1 - r0) * 0.5) * 0.8, 1); }
      }
    },
  });
  P.spotBurst = function (x, y, h, rgb) {
    const [sx0, sy0] = this.project(x, y, h);
    const sx = Math.round(sx0), sy = Math.round(sy0);
    const ramp = rampFrom(rgb);
    const now = performance.now();
    this.mid('pillar', { sx, sy, ramp, ms: 520 });
    for (let i = 0; i < 2; i++) this.rings.push({ x: sx, y: sy, t0: now + i * 130, ms: 480, r: 34 + i * 16, ramp, flat: true, th: 4 });
    // Sparks wind up the pillar.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU * 2;
      this.addBit({ k: 'sparkle', x: sx + Math.cos(a) * (4 + (i % 4) * 3), y: sy - i * 5, vx: Math.cos(a) * 0.25, vy: -0.5 - (i % 3) * 0.2, life: 520 + i * 30, ramp, ph: i, t0: now + i * 22 });
    }
    this.scatter('puff', 4, sx, sy, sy + 2, RAMPS.slash, { tone: this.groundTone(x, y) === 'water' ? 'steam' : this.groundTone(x, y), spread: 16, speed: 1.2 });
  };
  P.learnBurst = function (u) {
    const [sx, sy] = this.unitScreenPos(u);
    const now = performance.now();
    this.mid('rays', { unit: u, ms: 1300 });
    this.tint(u, '#fff4b0', 700, 0.7);
    for (let i = 0; i < 14; i++) {
      this.addBit({ k: 'sparkle', x: sx + (Math.random() - 0.5) * 34, y: sy - 4 - Math.random() * 10, vx: 0, vy: -0.5 - Math.random() * 0.5, life: 800 + Math.random() * 500, ramp: RAMPS.lightning, ph: Math.random() * 100, t0: now + i * 60 });
    }
    for (let i = 0; i < 2; i++) this.rings.push({ x: Math.round(sx), y: Math.round(sy), t0: now + i * 180, ms: 520, r: 30, ramp: RAMPS.lightning, flat: true, th: 3 });
    // A little hop of joy.
    CT.tween(420, (k) => (u.oz = Math.abs(Math.sin(k * Math.PI * 2)) * 8 * (1 - k * 0.5))).then(() => (u.oz = 0));
  };
})();

// ---- Chapter cards with motion --------------------------------------------------------------------
// ui.js builds the card; this wraps it (no change to ui.js): the rules draw out from the
// centre, the title's letters drop in one at a time, the era line settles from wide to
// tight, and the scene that follows arrives through the blue Gate tunnel.
(function () {
  const CT = window.CT;
  const install = () => {
    const UI = CT.UI;
    if (!UI || !UI.chapterCard || UI.chapterCard._feel) return;
    const base = UI.chapterCard;
    const card = async function (title, sub) {
      const p = base.call(UI, title, sub);
      try {
        const c = document.getElementById('card');
        if (c && c.animate && !UI.autoAdvance) {
          if (CT.audio) CT.audio.sfx('sfx_warp');
          for (const r of c.querySelectorAll('.card-rule')) r.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 520, easing: 'steps(13, end)', fill: 'backwards' });
          const t = c.querySelector('.card-title');
          if (t) {
            const text = t.textContent;
            t.textContent = '';
            [...text].forEach((ch, i) => {
              const s = document.createElement('span');
              s.textContent = ch;
              s.style.display = 'inline-block';
              s.style.whiteSpace = 'pre';
              t.appendChild(s);
              s.animate([{ transform: 'translateY(-28px)', opacity: 0 }, { transform: 'translateY(4px)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, delay: 260 + i * 38, easing: 'steps(6, end)', fill: 'backwards' });
            });
          }
          const s = c.querySelector('.card-sub');
          if (s) s.animate([{ letterSpacing: '22px', opacity: 0 }, { letterSpacing: '4px', opacity: 1 }], { duration: 520, delay: 1100, easing: 'steps(8, end)', fill: 'backwards' });
        }
        // Whatever fades in behind the card arrives through the Gate.
        const r = CT.renderer;
        if (r && !r.fadeStyle && r.fade > 0) { r.fadeStyle = 'gate'; r._fadeOnce = 'gate'; }
      } catch (e) { /* the plain card still shows */ }
      return p;
    };
    card._feel = true;
    UI.chapterCard = card;
  };
  // ui.js loads after this file.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.addEventListener('load', install);
})();
