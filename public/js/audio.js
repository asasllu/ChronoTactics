// audio.js — CT.audio: SNES-style music + SFX, synthesized at runtime (see docs/ENGINE_SPEC.md §4).
// No audio files. Music works like the SPC700: every instrument is a short sample with a loop
// (synthesized once from the PATCH table, one zone per octave at 32 kHz), each note is that sample
// pitched through a gain envelope, each voice has a channel strip (volume, pan, echo send) and the
// track bus has a stereo feedback echo with a low-pass. SFX are built from oscillators and noise.
//
// TRACK DEF: {bpm, meter:[n,d], bars, loop (bar where the loop restarts), echo:[beats, feedback, wet, lowpassHz, spread],
//   oneShot, kind ('field' | 'battle' | 'jingle'), maxLoops, gain, tempo:[[tick, bpm], ...], lead, m:{macros},
//   v:{name:[instrument, mml | [mml, mml, ...], {vol, pan, echo}]}}  — several strings = polyphonic lanes of one voice.
//
// NOTE FORMAT (MML-style):
//   o4 octave · > < octave up/down · l8 default length · c d e f g a b notes (+/# sharp, - flat)
//   length = note value (4 quarter, 8 eighth, 12 triplet-eighth, 2. dotted half) or %ticks (48/quarter)
//   r rest · ^ tie · (c e g) chord · n60 raw MIDI · v0-15 velocity · k±n transpose · q1-8 gate
//   p±n pan · @inst switch instrument · [ ... ]n repeat · $NAME macro · | and spaces ignored.
//   x0-127 channel expression (100 = unity), y±cents pitch bend; X / Y ramp there from the previous point.
//   The 'drums' instrument is the kit: notes are GM percussion keys (n36 kick, n38 snare, n42 hat ...),
//   chords are simultaneous hits, v is the hit strength.
//   Old-style 'kit' channels are step strings: l16 sets the step, k kick s snare h hat o open-hat c crash
//   t/m/u toms x clap r rim q tock i/j log drums g shaker f footstep, '.' rest, UPPERCASE = accent.
//   arp()/bass()/pad() expand chord progressions ("Am F:2 C:2 G") into MML for accompaniment.
(function () {
  'use strict';
  const CT = (window.CT = window.CT || {});

  const PPQ = 48;
  const WHOLE = PPQ * 4;
  const DEFAULT_VOL = { music: 0.55, sfx: 0.7 };

  // ---------------------------------------------------------------------------
  // Chords & accompaniment generators
  // ---------------------------------------------------------------------------
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
    dim: [0, 3, 6], dim7: [0, 3, 6, 9], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7],
    add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
    '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m7b5: [0, 3, 6, 10],
    '7sus4': [0, 5, 7, 10], '5': [0, 7], 'maj7#11': [0, 4, 7, 11, 18],
  };
  function pcOf(s) {
    let p = PC[s[0]];
    for (let i = 1; i < s.length; i++) p += s[i] === '#' ? 1 : s[i] === 'b' ? -1 : 0;
    return (p + 12) % 12;
  }
  function parseChord(sym) {
    const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym);
    if (!m) return { root: 0, tones: [0, 4, 7], bass: 0 };
    const root = pcOf(m[1]);
    const tones = (QUAL[m[2]] || QUAL['']).slice();
    return { root, tones, bass: m[3] ? pcOf(m[3]) : root, q: m[2] };
  }
  // "Am F:2 C*2" -> [{chord, beats}] ; beats = quarter notes (default b)
  function parseProg(prog, b) {
    const out = [];
    for (const tok of prog.trim().split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const m = /^([^:*]+)(?::([\d.]+))?(?:\*(\d+))?$/.exec(tok);
      if (!m) continue;
      const c = parseChord(m[1]);
      const beats = m[2] ? +m[2] : b;
      for (let k = 0; k < (m[3] ? +m[3] : 1); k++) out.push(Object.assign({ beats }, c));
    }
    return out;
  }
  function placeAbove(pc, lo) {
    let n = lo - ((((lo % 12) - pc) % 12) + 12) % 12;
    if (n < lo) n += 12;
    return n;
  }
  function ser(list) {
    return list.map((e) => (e.r ? 'r' : e.ch ? '(' + e.ch.map((n) => 'n' + n).join('') + ')' : 'n' + e.n) + '%' + e.L).join(' ') + ' ';
  }
  function pushStep(out, ch, L, make) {
    const last = out[out.length - 1];
    if (ch === '.') out.push({ r: 1, L });
    else if (ch === '-') {
      if (last) last.L += L;
      else out.push({ r: 1, L });
    } else out.push(Object.assign({ L }, make(ch)));
  }
  // Arpeggio: pattern chars index chord tones (0..9, a..f), '.' rest, '-' tie.
  function arp(prog, pat, o) {
    o = o || {};
    const st = o.st || 12, b = o.b || 4, lo = o.lo != null ? o.lo : 12 * ((o.oct != null ? o.oct : 4) + 1) - 5;
    const out = [];
    let g = 0;
    for (const c of parseProg(prog, b)) {
      const tones = c.tones.slice().sort((x, y) => x - y);
      const base = placeAbove(c.root, lo);
      let rem = Math.round(c.beats * PPQ), k = 0;
      while (rem > 0) {
        const L = Math.min(st, rem);
        const ch = pat[(o.g ? g : k) % pat.length];
        pushStep(out, ch, L, (x) => {
          const idx = parseInt(x, 36) || 0;
          return { n: base + tones[idx % tones.length] + 12 * Math.floor(idx / tones.length) };
        });
        rem -= L; k++; g++;
      }
    }
    return ser(out);
  }
  // Bass: 1 root(slash bass) 3 third 5 fifth 7 seventh 8 octave 2 ninth 4 fourth 6 sixth 0 low root
  function bass(prog, pat, o) {
    o = o || {};
    const st = o.st || 24, b = o.b || 4, lo = o.lo != null ? o.lo : 12 * ((o.oct != null ? o.oct : 2) + 1) - 3;
    const out = [];
    let g = 0;
    for (const c of parseProg(prog, b)) {
      const r = placeAbove(c.bass, lo);
      const cr = r + ((c.root - c.bass + 12) % 12);
      const fifth = c.tones.find((t) => t === 7 || t === 6 || t === 8);
      const sev = c.tones.find((t) => t === 10 || t === 11 || t === 9);
      const map = { 1: r, 8: r + 12, 0: r - 12, 5: cr + (fifth != null ? fifth : 7), 3: cr + (c.tones[1] || 4),
        7: cr + (sev != null ? sev : 10), 2: cr + 2, 4: cr + 5, 6: cr + 9 };
      let rem = Math.round(c.beats * PPQ), k = 0;
      while (rem > 0) {
        const L = Math.min(st, rem);
        const ch = pat[(o.g ? g : k) % pat.length];
        pushStep(out, ch, L, (x) => ({ n: map[x] != null ? map[x] : r }));
        rem -= L; k++; g++;
      }
    }
    return ser(out);
  }
  // Pad / comping: voice-led chords. pat 'x' hit, '-' tie, '.' rest; default = sustain each chord.
  function pad(prog, o) {
    o = o || {};
    const b = o.b || 4, lo = o.lo || 55, pat = o.pat || 'x';
    const out = [];
    let prev = null;
    for (const c of parseProg(prog, b)) {
      let pcs = [];
      for (const t of c.tones) { const p = (c.root + t) % 12; if (pcs.indexOf(p) < 0) pcs.push(p); }
      if (pcs.length > 4) pcs = pcs.filter((p, i) => i !== 2);
      let best = null, bestScore = 1e9;
      for (let rot = 0; rot < pcs.length; rot++) {
        const order = pcs.slice(rot).concat(pcs.slice(0, rot));
        const v = [];
        let cur = lo;
        for (const p of order) { const n = placeAbove(p, cur); v.push(n); cur = n + 1; }
        const cen = v.reduce((s, x) => s + x, 0) / v.length;
        let score;
        if (prev && prev.length === v.length) score = v.reduce((s, x, i) => s + Math.abs(x - prev[i]), 0);
        else if (prev) score = Math.abs(cen - prev.reduce((s, x) => s + x, 0) / prev.length) * v.length;
        else score = Math.abs(cen - (lo + 7));
        score += Math.max(0, v[v.length - 1] - (lo + 17)) * 3;
        if (score < bestScore) { bestScore = score; best = v; }
      }
      prev = best;
      const total = Math.round(c.beats * PPQ);
      const st = o.st || total;
      let rem = total, k = 0;
      while (rem > 0) {
        const L = Math.min(st, rem);
        pushStep(out, pat[k % pat.length], L, () => ({ ch: best }));
        rem -= L; k++;
      }
    }
    return ser(out);
  }

  // ---------------------------------------------------------------------------
  // MML parser
  // ---------------------------------------------------------------------------
  function expand(src, macros) {
    let s = ' ' + src + ' ', guard = 0;
    while (s.indexOf('$') >= 0 && guard++ < 40) {
      s = s.replace(/\$(\w+)/g, (m, k) => (macros && macros[k] != null ? ' ' + macros[k] + ' ' : ' '));
    }
    guard = 0;
    while (s.indexOf('[') >= 0 && guard++ < 400) {
      const before = s;
      s = s.replace(/\[([^\[\]]*)\](\d*)/, (m, body, n) => (' ' + body + ' ').repeat(n ? +n : 2));
      if (s === before) break;
    }
    return s;
  }
  const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function parseMML(src, macros, inst) {
    const s = expand(src, macros);
    let i = 0, oct = 4, len = 48, vel = 12, tr = 0, gate = null, pan = null, tick = 0, last = null, cur = inst;
    const ev = [];
    const num = () => {
      const m = /^-?\d+/.exec(s.substr(i, 12));
      if (!m) return null;
      i += m[0].length;
      return +m[0];
    };
    const readLen = () => {
      let L;
      if (s[i] === '%') { i++; L = num() || 0; } else { const n = num(); L = n ? WHOLE / n : len; }
      let add = L;
      while (s[i] === '.') { i++; add /= 2; L += add; }
      return L;
    };
    const pitch = (ch) => {
      let p = NOTE[ch];
      while (s[i] === '+' || s[i] === '#' || s[i] === '-') { p += s[i] === '-' ? -1 : 1; i++; }
      return 12 * (oct + 1) + p + tr;
    };
    while (i < s.length) {
      const ch = s[i++];
      if (NOTE[ch] != null || ch === 'n' || ch === '(') {
        let notes;
        if (ch === '(') {
          notes = [];
          while (i < s.length && s[i] !== ')') {
            const c2 = s[i++];
            if (NOTE[c2] != null) notes.push(pitch(c2));
            else if (c2 === 'n') notes.push((num() || 60) + tr);
            else if (c2 === '>') oct++;
            else if (c2 === '<') oct--;
            else if (c2 === 'o') oct = num();
          }
          i++;
        } else if (ch === 'n') notes = [(num() || 60) + tr];
        else notes = [pitch(ch)];
        const L = readLen();
        last = { tk: tick, dur: L, notes, vel: vel / 12, inst: cur, gate, pan };
        ev.push(last);
        tick += L;
      } else if (ch === 'r') { tick += readLen(); last = null; }
      else if (ch === '^') { const L = readLen(); if (last) last.dur += L; tick += L; }
      else if (ch === 'o') oct = num();
      else if (ch === '>') oct++;
      else if (ch === '<') oct--;
      else if (ch === 'l') len = readLen();
      else if (ch === 'v') vel = num();
      else if (ch === 'k') tr = num() || 0;
      else if (ch === 'q') { const q = num(); gate = q ? q / 8 : null; }
      else if (ch === 'p') { const p = num(); pan = p == null ? null : p / 10; }
      else if (ch === '@') { const m = /^\w+/.exec(s.substr(i, 24)); if (m) { cur = m[0]; i += m[0].length; } }
      else if (ch === 'x' || ch === 'X' || ch === 'y' || ch === 'Y') {
        // channel automation: x/X expression 0-127 (100 = unity), y/Y pitch bend in cents; capitals ramp from the previous point
        ev.push({ tk: tick, ctl: ch === 'x' || ch === 'X' ? 'x' : 'y', val: num() || 0, ramp: ch === 'X' || ch === 'Y' });
      }
    }
    return { events: ev, ticks: tick };
  }
  const DRUMS = 'kshocmtuxrqijgf';
  function parseDrums(src, macros) {
    const s = expand(src, macros);
    let i = 0, step = 12, tick = 0;
    const ev = [];
    while (i < s.length) {
      const ch = s[i++];
      if (ch === 'l') {
        const m = /^\d+/.exec(s.substr(i, 4));
        if (m) { i += m[0].length; step = WHOLE / +m[0]; }
      } else if (ch === '.' || ch === '-') tick += step;
      else if (DRUMS.indexOf(ch.toLowerCase()) >= 0 && /[a-zA-Z]/.test(ch)) {
        ev.push({ tk: tick, dur: step, drum: ch.toLowerCase(), vel: ch === ch.toUpperCase() ? 1 : 0.72 });
        tick += step;
      }
    }
    return { events: ev, ticks: tick };
  }

  // ---------------------------------------------------------------------------
  // Instruments
  // ---------------------------------------------------------------------------
  // SNES-style sample set. Nothing is loaded: every instrument is a short sample that is
  // synthesized once (attack section + seamless loop, one zone per octave, 32 kHz like the
  // S-DSP) and then played back pitched through a gain envelope, exactly as the SPC700 did.
  //
  // Patch fields (all optional):
  //   h(k, f, f0)   steady harmonic amplitudes (k = harmonic number, f = its frequency in Hz)
  //   hb, be        transient "bright" table and its level over time [start, tau, end]
  //   v             detuned copies [[cents, amp], ...] (chorus / section / octave stacks)
  //   rp            random harmonic phases (ensembles)
  //   pt            inharmonic partials [[ratio, amp, tau, floor, dbins], ...] (bells, mallets, drums)
  //   nz            breath / bow noise {a, f | rel, q, t, b:[burst, tau]}
  //   ck            onset click / thump [amp, tau, lowpassHz]
  //   rise, scoop   in-sample fade-in (s) and pitch scoop [cents, tau]
  //   A, L          attack-section and loop length in seconds
  //   e             envelope [attack s, decay tau s, sustain 0..1, release tau s]; kd = key scaling of
  //                 the decay; ring = note-off does not damp
  //   vib           delayed vibrato [Hz, cents, delay s];  vol, echo (send), lo/hi (zone clamp), gate
  const lpf = (fc, n) => (f) => 1 / Math.sqrt(1 + Math.pow(f / fc, 2 * (n || 2)));
  const pk = (F, bw, g) => (f) => (g == null ? 1 : g) / (1 + ((f - F) / bw) * ((f - F) / bw));
  const arr = (a) => (k) => a[k - 1] || 0;
  const pulse = (duty, fc) => (k, f) => (Math.abs(Math.sin(Math.PI * k * duty)) / k) * lpf(fc || 7000, 2)(f);
  const PATCH = {
    // ---- strings ----------------------------------------------------------------------------
    strings: { h: (k, f) => (1 / k) * lpf(3000, 2)(f) * (1 + 0.6 * pk(450, 250)(f) + 0.5 * pk(2300, 800)(f)), v: [[-9, 1], [0, 1], [8, 1], [15, 0.5]], rp: 1,
      nz: { a: 0.035, f: 3200, q: 0.6, b: [3, 0.05] }, A: 0.14, L: 0.9, e: [0.07, 0.5, 0.85, 0.2], vib: [5.3, 5, 0.5], echo: 0.45 },
    slowstr: { like: 'strings', e: [0.3, 0.6, 0.9, 0.45], vib: null, echo: 0.55 },
    pizz: { h: (k, f) => Math.pow(k, -1.3) * lpf(2400, 2)(f), hb: (k, f) => Math.pow(k, -0.7) * lpf(5200, 2)(f), be: [1.6, 0.03, 0], ck: [0.3, 0.004, 3000],
      A: 0.2, L: 0.25, e: [0.002, 0.2, 0, 0.14], kd: 0.4, echo: 0.4 },
    harp: { h: (k) => Math.pow(k, -1.7), hb: (k, f) => Math.pow(k, -0.8) * lpf(5200, 2)(f), be: [1.2, 0.07, 0.03], ck: [0.12, 0.003, 4000],
      A: 0.36, L: 0.25, e: [0.002, 1.1, 0, 0.45], kd: 0.55, echo: 0.45 },
    guitar: { h: (k, f) => Math.pow(k, -1.5) * lpf(2300, 2)(f) * (1 + 0.6 * pk(220, 120)(f) + 0.4 * pk(450, 200)(f)), hb: (k, f) => Math.pow(k, -0.8) * lpf(5000, 2)(f),
      be: [1.3, 0.05, 0.05], ck: [0.2, 0.003, 4000], A: 0.3, L: 0.25, e: [0.002, 0.75, 0, 0.22], kd: 0.5, echo: 0.3 },
    harpsi: { h: (k, f) => Math.pow(k, -0.75) * lpf(4800, 2)(f), hb: (k, f) => Math.pow(k, -0.4) * lpf(7000, 2)(f), be: [0.8, 0.05, 0.1], ck: [0.25, 0.002, 6000],
      A: 0.3, L: 0.25, e: [0.002, 0.6, 0, 0.1], kd: 0.4, echo: 0.3 },
    sitar: { h: (k, f) => Math.pow(k, -0.9) * lpf(2600, 2)(f), hb: (k, f) => Math.pow(k, -0.3) * lpf(6000, 2)(f) * (1 + pk(3000, 1500)(f)), be: [1.6, 0.22, 0.25],
      scoop: [18, 0.08], ck: [0.2, 0.003, 5000], A: 0.6, L: 0.3, e: [0.002, 1.0, 0, 0.25], kd: 0.4, echo: 0.45 },
    odguitar: { h: (k, f) => (k % 2 ? 1 : 0.6) * Math.pow(k, -0.75) * lpf(3200, 3)(f) * (1 + pk(1200, 600)(f)), v: [[-6, 1], [6, 1]], rp: 1, ck: [0.2, 0.004, 3000],
      A: 0.12, L: 0.6, e: [0.006, 0.5, 0.8, 0.07], vib: [5.5, 6, 0.5], echo: 0.25 },
    // ---- brass ------------------------------------------------------------------------------
    brass: { h: (k, f) => Math.pow(k, -0.4) * lpf(1500, 3)(f) * (1 + 0.8 * pk(1250, 500)(f)), hb: (k, f) => Math.pow(k, -0.2) * lpf(3800, 3)(f), be: [0, 0.04, 0.55],
      v: [[-5, 1], [4, 1], [0, 0.7]], rp: 1, scoop: [-28, 0.03], A: 0.24, L: 0.6, e: [0.022, 0.35, 0.8, 0.08], vib: [5.5, 6, 0.4], echo: 0.3 },
    trumpet: { h: (k, f) => Math.pow(k, -0.35) * lpf(1700, 3)(f) * (1 + 0.8 * pk(1350, 500)(f)), hb: (k, f) => Math.pow(k, -0.2) * lpf(4200, 3)(f), be: [0, 0.035, 0.6],
      scoop: [-30, 0.03], A: 0.22, L: 0.3, e: [0.018, 0.35, 0.82, 0.07], vib: [5.6, 11, 0.3], echo: 0.3 },
    horn: { h: (k, f) => Math.pow(k, -0.9) * lpf(950, 3)(f) * (1 + pk(450, 200)(f)), hb: (k, f) => Math.pow(k, -0.5) * lpf(2100, 3)(f), be: [0, 0.06, 0.28],
      v: [[-4, 1], [4, 1]], scoop: [-20, 0.04], A: 0.3, L: 0.6, e: [0.045, 0.4, 0.85, 0.13], vib: [5, 5, 0.5], echo: 0.4 },
    lowbrass: { h: (k, f) => Math.pow(k, -0.6) * lpf(1100, 3)(f) * (1 + 0.6 * pk(600, 300)(f)), hb: (k, f) => Math.pow(k, -0.3) * lpf(2600, 3)(f), be: [0, 0.05, 0.4],
      v: [[-4, 1], [4, 1]], scoop: [-22, 0.035], A: 0.26, L: 0.6, e: [0.03, 0.35, 0.82, 0.1], echo: 0.3 },
    tuba: { h: (k, f) => Math.pow(k, -1) * lpf(480, 3)(f), hb: (k, f) => Math.pow(k, -0.6) * lpf(1200, 3)(f), be: [0, 0.05, 0.3], A: 0.25, L: 0.4,
      e: [0.03, 0.3, 0.8, 0.09], echo: 0.15 },
    orchhit: { h: (k, f) => Math.pow(k, -0.7) * lpf(4200, 2)(f), v: [[-1200, 0.8], [0, 1], [1200, 0.6], [-9, 0.8], [8, 0.8], [1902, 0.3]], rp: 1, nz: { a: 0.02, f: 2000, q: 0.5, b: [14, 0.03] },
      ck: [0.6, 0.02, 700], A: 0.3, L: 0.4, e: [0.004, 0.4, 0, 0.25], echo: 0.5 },
    // ---- woodwinds / reeds ---------------------------------------------------------------------
    flute: { h: (k, f) => arr([1, 0.36, 0.17, 0.07, 0.035, 0.018, 0.01])(k) * lpf(4500, 2)(f), nz: { a: 0.055, f: 3600, q: 0.8, b: [4, 0.03] }, rise: 0.03,
      A: 0.16, L: 0.4, e: [0.02, 0.3, 0.9, 0.09], vib: [5.1, 11, 0.28], echo: 0.4 },
    panflute: { h: arr([1, 0.12, 0.3, 0.05, 0.1, 0.02, 0.04, 0.01]), nz: { a: 0.15, f: 2900, q: 0.7, b: [5, 0.04] }, rise: 0.02, scoop: [-35, 0.045],
      A: 0.2, L: 0.4, e: [0.015, 0.3, 0.85, 0.13], vib: [5, 9, 0.35], echo: 0.5 },
    ocarina: { h: arr([1, 0.08, 0.12, 0.02, 0.02]), nz: { a: 0.03, f: 3000, q: 0.8, b: [3, 0.03] }, rise: 0.02, A: 0.12, L: 0.3, e: [0.015, 0.2, 0.9, 0.08],
      vib: [5.5, 10, 0.25], echo: 0.4 },
    oboe: { h: (k, f) => (k === 1 ? 0.5 : 1) * Math.pow(k, -0.5) * (pk(1150, 350)(f) + 0.7 * pk(2900, 600)(f) + 0.15) * lpf(4500, 3)(f), rise: 0.012,
      A: 0.14, L: 0.3, e: [0.015, 0.3, 0.85, 0.08], vib: [5.5, 8, 0.3], echo: 0.35 },
    clarinet: { h: (k, f) => (k % 2 ? 1 : 0.08) * (1 / k) * lpf(3000, 2)(f), rise: 0.02, A: 0.14, L: 0.3, e: [0.02, 0.3, 0.88, 0.09], vib: [5, 5, 0.4], echo: 0.35 },
    sax: { h: (k, f) => Math.pow(k, -0.6) * (pk(650, 350)(f) + 0.6 * pk(1700, 600)(f) + 0.2) * lpf(3800, 2)(f), nz: { a: 0.03, f: 2500, q: 0.6, b: [3, 0.03] }, rise: 0.015,
      scoop: [-22, 0.03], A: 0.16, L: 0.3, e: [0.018, 0.3, 0.85, 0.09], vib: [5.3, 12, 0.3], echo: 0.3 },
    accordion: { h: (k, f) => Math.pow(k, -0.7) * lpf(4500, 2)(f) * (1 + 0.5 * pk(1500, 800)(f)), v: [[-8, 1], [0, 1], [9, 0.8]], rp: 1, A: 0.1, L: 0.6,
      e: [0.02, 0.2, 0.9, 0.07], echo: 0.3 },
    // ---- keyboards --------------------------------------------------------------------------
    organ: { h: arr([1, 0.8, 0.6, 0.45, 0.08, 0.32, 0.04, 0.22, 0.02, 0.06, 0, 0.08]), v: [[-3, 1], [3, 1]], ck: [0.18, 0.004, 3500], A: 0.08, L: 0.5,
      e: [0.005, 0.1, 1, 0.045], vib: [6.4, 5, 0.05], echo: 0.3 },
    pipe: { h: arr([1, 0.9, 0.7, 0.6, 0.3, 0.45, 0.15, 0.35, 0.1, 0.12, 0.05, 0.15, 0.03, 0.03, 0.02, 0.06]), v: [[-2, 1], [2, 1]], nz: { a: 0.035, f: 1800, q: 0.6, b: [4, 0.05] },
      rise: 0.02, A: 0.16, L: 0.6, e: [0.02, 0.2, 1, 0.16], echo: 0.6 },
    piano: { h: (k, f) => Math.pow(k, -1.25) * lpf(2800, 1.5)(f) * (1 + 0.3 * pk(1800, 900)(f)), hb: (k, f) => Math.pow(k, -0.6) * lpf(5500, 2)(f), be: [1.0, 0.11, 0.06],
      ck: [0.25, 0.006, 2500], v: [[0, 1], [2.5, 0.35]], A: 0.5, L: 0.4, e: [0.002, 1.5, 0, 0.13], kd: 0.7, echo: 0.35 },
    epiano: { h: arr([1, 0.25, 0.08, 0.03]), hb: (k) => (k >= 5 && k <= 9 ? 1 / (1 + Math.abs(k - 7)) : 0), be: [0.9, 0.07, 0], v: [[-2, 1], [2, 1]], A: 0.4, L: 0.5,
      e: [0.003, 1.6, 0, 0.12], kd: 0.5, echo: 0.35 },
    celesta: { pt: [[1, 1, 0], [2, 0.12, 0.25, 0.3], [4.02, 0.4, 0.12, 0.2], [6.3, 0.12, 0.05, 0.1]], A: 0.6, L: 0.2, e: [0.002, 0.9, 0, 0.6], ring: 1, kd: 0.5, echo: 0.5 },
    musicbox: { pt: [[1, 1, 0], [3, 0.18, 0.3, 0.35], [5.42, 0.35, 0.09, 0.15], [8.6, 0.2, 0.04, 0.05], [11.3, 0.1, 0.025]], A: 0.7, L: 0.2, e: [0.001, 0.85, 0, 0.7], ring: 1, kd: 0.4, echo: 0.55 },
    glock: { pt: [[1, 1, 0], [2.76, 0.3, 0.25, 0.3], [5.4, 0.2, 0.08, 0.1], [8.93, 0.1, 0.04]], A: 0.6, L: 0.2, e: [0.001, 1.0, 0, 0.8], ring: 1, kd: 0.4, echo: 0.5 },
    vibes: { pt: [[1, 1, 0], [4, 0.25, 0.4, 0.3], [10, 0.08, 0.06, 0.05]], A: 0.9, L: 0.2, e: [0.003, 2.0, 0, 0.5], kd: 0.3, echo: 0.5 },
    marimba: { pt: [[1, 1, 0], [3.9, 0.3, 0.05, 0.15], [9.2, 0.1, 0.015]], ck: [0.3, 0.004, 1500], A: 0.2, L: 0.2, e: [0.002, 0.38, 0, 0.25], kd: 0.7, echo: 0.35 },
    xylo: { pt: [[1, 1, 0], [3, 0.45, 0.08, 0.25], [6.2, 0.2, 0.03, 0.05], [10, 0.08, 0.012]], ck: [0.4, 0.003, 5000], A: 0.25, L: 0.2, e: [0.001, 0.2, 0, 0.15], kd: 0.5, echo: 0.35 },
    steeldrum: { pt: [[1, 1, 0], [1, 0.6, 0, 1, 1], [2, 0.55, 0.35, 0.5], [3, 0.3, 0.2, 0.3], [4.05, 0.2, 0.1, 0.15], [5.3, 0.1, 0.05]], ck: [0.15, 0.003, 4000], A: 0.8, L: 0.5,
      e: [0.002, 0.6, 0, 0.35], kd: 0.5, echo: 0.55 },
    kalimba: { pt: [[1, 1, 0], [2, 0.1, 0.2, 0.4], [5.8, 0.25, 0.04, 0.05]], ck: [0.25, 0.003, 3000], A: 0.4, L: 0.2, e: [0.002, 0.45, 0, 0.3], kd: 0.5, echo: 0.4 },
    bell: { pt: [[0.5, 0.25, 0], [1, 1, 0], [1.19, 0.45, 1.2, 0.2], [1.56, 0.3, 0.9, 0.15], [2, 0.6, 0.8, 0.3], [2.51, 0.3, 0.5, 0.1], [2.66, 0.25, 0.45], [3.01, 0.2, 0.35], [4.1, 0.14, 0.25], [5.43, 0.1, 0.15]],
      A: 1.6, L: 0.4, e: [0.002, 2.5, 0, 1.5], ring: 1, kd: 0.3, echo: 0.55 },
    chime: { pt: [[1, 1, 0], [2, 0.5, 0.6, 0.35], [3.01, 0.25, 0.4, 0.2], [4.18, 0.16, 0.25, 0.1], [5.43, 0.09, 0.15]], A: 1.0, L: 0.3, e: [0.002, 2.0, 0, 0.9], ring: 1, kd: 0.3, echo: 0.5 },
    crystal: { pt: [[1, 1, 0], [1, 0.5, 0, 1, 1], [2, 0.3, 0.5, 0.4], [3.5, 0.35, 0.3, 0.25], [7.1, 0.15, 0.1, 0.05]], A: 0.8, L: 0.5, e: [0.003, 1.1, 0, 0.6], ring: 1, kd: 0.3, echo: 0.6 },
    // ---- voices / pads ----------------------------------------------------------------------
    choir: { h: (k, f) => Math.pow(k, -0.9) * (pk(650, 130)(f) + 0.7 * pk(1100, 160)(f) + 0.35 * pk(2700, 300)(f) + 0.25 * pk(3400, 350)(f) + 0.04) * lpf(5000, 2)(f),
      v: [[-11, 1], [-4, 1], [5, 1], [12, 0.8]], rp: 1, nz: { a: 0.03, f: 2500, q: 0.5 }, A: 0.15, L: 1.0, e: [0.16, 0.5, 0.9, 0.32], echo: 0.6 },
    ooh: { h: (k, f) => Math.pow(k, -1) * (pk(380, 120)(f) + 0.5 * pk(850, 150)(f) + 0.12 * pk(2500, 300)(f) + 0.02) * lpf(3500, 2)(f), v: [[-7, 1], [6, 1], [0, 0.8]], rp: 1,
      nz: { a: 0.04, f: 2200, q: 0.5, b: [2, 0.06] }, A: 0.15, L: 0.9, e: [0.09, 0.4, 0.9, 0.28], vib: [5, 8, 0.5], echo: 0.6 },
    pad: { h: (k, f) => (1 / k) * lpf(1400, 2)(f), v: [[-12, 1], [-3, 1], [4, 1], [11, 1]], rp: 1, A: 0.1, L: 1.0, e: [0.5, 0.8, 0.9, 0.8], echo: 0.5 },
    cold: { like: 'crystal', e: [0.08, 1.4, 0.5, 0.5], ring: 0, vib: [4, 8, 0.5] },
    wind: { nz: { a: 1, rel: 1, q: 2.2, t: 'bp' }, A: 0.05, L: 1.6, e: [0.9, 1, 1, 1.1], echo: 0.5, vol: 0.8 },
    // ---- basses -----------------------------------------------------------------------------
    bass: { h: (k, f) => Math.pow(k, -1.4) * lpf(750, 2)(f) * (1 + 0.5 * pk(180, 120)(f)), hb: (k, f) => Math.pow(k, -0.7) * lpf(2500, 2)(f), be: [1.2, 0.04, 0.08],
      ck: [0.15, 0.004, 1200], A: 0.25, L: 0.2, e: [0.003, 1.4, 0, 0.09], kd: 0.3, echo: 0.06 },
    pbass: { h: (k, f) => Math.pow(k, -1.2) * lpf(950, 2)(f) * (1 + 0.6 * pk(220, 140)(f)), hb: (k, f) => Math.pow(k, -0.5) * lpf(3200, 2)(f), be: [1.3, 0.035, 0.1],
      ck: [0.3, 0.003, 3000], A: 0.22, L: 0.2, e: [0.002, 0.9, 0, 0.08], kd: 0.3, echo: 0.06 },
    slap: { h: (k, f) => Math.pow(k, -1.1) * lpf(1100, 2)(f) * (1 + 0.8 * pk(250, 150)(f)), hb: (k, f) => Math.pow(k, -0.4) * lpf(4200, 2)(f) * (1 + pk(2500, 800)(f)), be: [1.8, 0.03, 0.1],
      ck: [0.5, 0.003, 5000], A: 0.2, L: 0.2, e: [0.002, 0.7, 0, 0.07], kd: 0.3, echo: 0.08 },
    fretless: { h: (k, f) => Math.pow(k, -1.3) * lpf(900, 2)(f) * (1 + 0.9 * pk(700, 250)(f)), hb: (k, f) => Math.pow(k, -0.8) * lpf(1900, 2)(f), be: [0, 0.09, 0.4],
      A: 0.4, L: 0.3, e: [0.012, 2.6, 0, 0.12], kd: 0.2, vib: [5, 9, 0.35], echo: 0.1 },
    sbass: { h: (k, f) => (1 / k) * lpf(900, 2)(f), hb: (k, f) => (1 / k) * lpf(3500, 2)(f), be: [1.5, 0.05, 0.1], A: 0.3, L: 0.2, e: [0.003, 0.5, 0.5, 0.06], echo: 0.06 },
    sub: { h: arr([1, 0.3, 0.1]), A: 0.05, L: 0.2, e: [0.02, 0.3, 0.7, 0.12], echo: 0.05 },
    // ---- pitched percussion -------------------------------------------------------------------
    timp: { pt: [[1, 1, 0], [1.5, 0.6, 0.45], [1.99, 0.4, 0.3], [2.44, 0.25, 0.2], [2.89, 0.15, 0.15]], ck: [0.7, 0.012, 500], scoop: [30, 0.05], A: 0.7, L: 0.3,
      e: [0.002, 1.0, 0, 0.8], ring: 1, echo: 0.3 },
    taiko: { pt: [[1, 1, 0], [1.6, 0.5, 0.1], [2.3, 0.3, 0.06]], ck: [0.8, 0.01, 900], scoop: [180, 0.04], A: 0.3, L: 0.2, e: [0.002, 0.4, 0, 0.3], ring: 1, echo: 0.25 },
    log: { pt: [[1, 1, 0], [2.3, 0.35, 0.03], [4.6, 0.12, 0.012]], ck: [0.3, 0.003, 2500], A: 0.12, L: 0.15, e: [0.002, 0.14, 0, 0.09], echo: 0.3 },
    // ---- synth leads (the old chiptune voices) ------------------------------------------------
    lead: { h: pulse(0.25), A: 0.05, L: 0.3, e: [0.01, 0.15, 0.7, 0.1], vib: [5.5, 14, 0.18], echo: 0.25 },
    sq12: { h: pulse(0.125), A: 0.05, L: 0.3, e: [0.004, 0.1, 0.45, 0.06], echo: 0.2 },
    synth: { h: pulse(0.125), A: 0.05, L: 0.3, e: [0.002, 0.14, 0.2, 0.05], echo: 0.35 },
    comp: { h: pulse(0.5, 2200), A: 0.05, L: 0.3, e: [0.004, 0.12, 0.25, 0.05], gate: 0.5, echo: 0.2 },
    sawlead: { h: (k, f) => (1 / k) * lpf(5000, 2)(f), v: [[-10, 1], [10, 1]], A: 0.08, L: 0.5, e: [0.02, 0.3, 0.85, 0.15], vib: [6, 12, 0.2], echo: 0.3 },
    detuned: { h: pulse(0.25), v: [[-38, 1], [31, 1]], A: 0.08, L: 0.6, e: [0.4, 0.5, 0.9, 0.8], vib: [0.35, 30, 0], echo: 0.45 },
    // ---- the drum kit: notes are GM percussion keys, see KITDEF below ----------------------------
    drums: { kit: 1, echo: 0.14 },
  };
  // names used by older track defs -> patches
  const ALIAS = { horn2: 'horn', vox: 'ooh', lute: 'guitar', mbox: 'musicbox', glass: 'crystal', toll: 'bell', obass: 'bass', scream: 'sawlead', kit: 'drums' };
  for (const k of Object.keys(PATCH)) {
    const p = PATCH[k];
    if (p.like) PATCH[k] = Object.assign({}, PATCH[p.like], p);
    PATCH[k].name = k;
  }
  const patchOf = (name) => PATCH[name] || PATCH[ALIAS[name]] || PATCH.lead;

  // ---------------------------------------------------------------------------
  // Tracks
  // ---------------------------------------------------------------------------
  // def: {bpm, meter:[n,d], bars, loop (bar index where the loop restarts), echo:[beats, feedback, wet], oneShot, m:{macros}, v:{name:[inst, src, opts]}}
  const DEFS = {};

  // Trigger Motif = scale degrees 1-3-6-9 rising (+4, +5, +5 semitones): C E A D' in C.

  // ---- mus_title: "A Bell at Midnight" — 80 BPM, C major, bells --------------------------
  {
    const A = 'C Am7 Fmaj7 Gsus4:2 G:2 C Em F G';
    const B = 'Am F C G Am Dm7 Fmaj7 Gsus4:2 G:2';
    DEFS.mus_title = {
      bpm: 80, meter: [4, 4], bars: 26, loop: 2, echo: [0.75, 0.38, 0.32],
      m: {
        MA: 'o5 c4. e8 a4 >d4< | >e2 d4 c4< | a2. g8 f8 | g1 | c4. e8 a4 >d4< | >g2. e4< | >d4 c4< a4 >c4< | b2 >d2<',
        MB: 'o5 >e2 d8 c8< a4 | >c2< a4 f4 | g2. e4 | d4 e4 g2 | >e2 f8 e8 d4< | >d2 c4< a4 | >c4 d4 e2< | >d1<',
        MH: 'o4 e2 g2 | e2 c2 | c2. d4 | d1 | e2 g2 | g2 e2 | f2 a2 | g1',
      },
      v: {
        toll: ['toll', 'o3 c2 c2 c2 c2 [r1]16 c1 [r1]7'],
        bell: ['bell', '[r1]2 $MA [r1]8 $MA'],
        flute: ['flute', '[r1]10 $MB v9 $MH'],
        pad: ['choir', pad('Cadd9:8 ' + A + ' ' + B + ' ' + A, { lo: 55 })],
        bass: ['bass', 'o2 c1 c1 ' + bass(A, '1-------') + bass(B, '1---5---') + bass(A, '1--5--8-'), { vol: 0.8 }],
        harp: ['harp', '[r1]2 ' + arp(A, '0.2.4.2.', { st: 24 }) + arp(B, '01232123', { st: 24 }) + arp(A, '01234321', { st: 24 }), { pan: -0.3 }],
      },
    };
  }

  // ---- mus_fair_night: "Lanterns Over Leene Square" — 3/4 waltz, 140 BPM, F major ----------
  {
    const IN = 'F F C7 C7';
    const A = 'F Am Bb C7 F Dm G7 C7 F F7 Bb Bbm F D7 Gm7 C7';
    const B = 'Bb Bb F F Gm C7 F F Bb Bbm F Dm Gm C7 F C7';
    const ALL = IN + ' ' + A + ' ' + B;
    DEFS.mus_fair_night = {
      bpm: 140, meter: [3, 4], bars: 36, loop: 4, echo: [1, 0.3, 0.22],
      m: {
        FA: 'o5 a2 g4 | e4 a4 >c4< | >d2 c4< | b-4 g4 e4 | f2 a4 | >d4 c4< a4 | b4 >d4 f4< | >e2.< |' +
          ' >f2 e4< | >e-4 d4 c4< | >d4 f4 d4< | >d-2 c4< | a4 >c4 f4< | a2 f+4 | g4 b-4 >d4< | >c2.<',
        // B opens with the Trigger Motif in waltz time (F A D G)
        FB: 'o5 f4 a4 >d4< | >g2.< | >f4 e4 c4< | a2. | b-4 a4 g4 | g4 >c4 e4< | >f2.< | >c4< a4 f4 |' +
          ' f4 a4 >d4< | >g4 f4 d-4< | >c2< a4 | >d4 c4< a4 | b-2 >d4< | >c4< b-4 g4 | a2 >c4< | >e4 d4 c4<',
        GI: 'o5 >c8< a8 f8 a8 >c4< | a8 f8 c8 f8 a4 | b-8 g8 e8 g8 b-4 | >c4< b-4 g4',
      },
      v: {
        lead: ['accordion', '[r2.]4 $FA $FB'],
        glock: ['glock', '$GI [r2.]16 v9 $FB', { pan: 0.35 }],
        bass: ['tuba', bass(ALL, '1..5..', { b: 3, st: 48, g: 1 })],
        comp: ['comp', pad(ALL, { b: 3, pat: '.xx', st: 48, lo: 57 }), { pan: -0.25 }],
        pad: ['pad', '[r2.]20 ' + pad(B, { b: 3, lo: 53 })],
        drums: ['kit', 'l8 [k.g.g.]3 k.g.xx [k.g.g.]15 k.g.x. [k.g.G.]7 k.x.x. [k.g.G.]7 k.xxx.', { vol: 1 }],
      },
    };
  }

  // ---- mus_rift: "Something Wrong With Tomorrow" — 60 BPM, detuned motif --------------------
  DEFS.mus_rift = {
    bpm: 60, meter: [4, 4], bars: 16, loop: 0, echo: [0.75, 0.5, 0.45],
    v: {
      pulse: ['sub', 'o2 q5 [c8]64 [d-8]32 [c8]16 [f+8]16'],
      drone: ['choir', 'o3 (c g >d-<)1^1^1^1 (c e- b)1^1^1^1 (d- a- >d<)1^1^1^1 (c f+ b)1^1^1^1'],
      motif: ['detuned', '[r1]4 o4 c2 e2 a2 >d2^1< r1 o4 f+2 a+2 >d+2 g+2^1< r1 o4 c2 e2 a2 a-2 g1 r1'],
      glass: ['glass', 'o6 [r1]2 r2 d-4 r4 | r1 | r4 b4 r2 | r1 | r2. f4 | r1 | r1 | r4 >c4< r2 | r1 | r2 g4 r4 | r1 | r1 | r4 f+4 r2 | r1', { pan: 0.4 }],
      wind: ['wind', 'o5 [e1^1 r1^1]4', { vol: 0.8 }],
      heart: ['kit', 'l16 [................]4 [k..k............]12', { vol: 0.55 }],
    },
  };

  // ---- mus_battle: "Steel and Seconds" — 160 BPM, D minor, brass ---------------------------
  {
    const IN = 'Dm Dm Bb:2 C:2 A';
    const A = 'Dm Dm Bb C Dm Dm Gm A7';
    const B = 'F C Dm Bb F C Gm A';
    const BR = 'Bb C Dm A7';
    const ALL = [IN, A, A, B, BR].join(' ');
    DEFS.mus_battle = {
      bpm: 160, meter: [4, 4], bars: 32, loop: 4, echo: [0.75, 0.25, 0.18],
      m: {
        AH: 'o5 a4. g8 a8 >c8 d4< | >e8 f8 e8 d8 c4< a4 | b-4. a8 b-8 >d8 f4< | >e4 d8 c8< g2',
        AT1: 'o5 a4. g8 a8 >c8 d4< | >f8 g8 a8 g8 f4 d4< | >d4. c8< b-4 g4 | a2 c+4 e4',
        AT2: 'o5 >d4. e8 f8 e8 d4< | >c4 d8 c8< a4 f4 | g4 b-4 >d4 g4< | >e2 c+4 e4<',
        // B: brass states the Trigger Motif in F (F A D G)
        BB: 'o5 f4. a8 >d4 g4< | >g4. e8 c2< | >d4. c8< a4 f4 | g2 b-4 >d4< | f4. a8 >d4 g4< | >a4. g8 e4 c4< | >d4 c4< b-4 >d4< | >c+2 e2<',
        BR: 'o5 r8 a8 r8 a8 b-4 a4 | r8 >c8 r8 c8 d4 c4< | d8 d8 r8 d8 f8 e8 d8 c8 | c+2 e2',
        G: 'K.h.S.hkk.h.S.h.',
        F: 'K.h.S.hkS.SSuumt',
        CR: 'C.h.S.hkk.h.S.h.',
      },
      v: {
        lead: ['brass', '[r1]2 o4 d4 d4 d8 e8 f8 g8 | a1 $AH $AT1 $AH $AT2 $BB $BR'],
        horn: ['horn', '[r1]12 ' + pad(A, { pat: 'x..x..x.', st: 24, lo: 55 }) + pad(B, { pat: 'x.x...x.', st: 24, lo: 55 }) + pad(BR, { pat: 'x.x.x.xx', st: 24, lo: 55 })],
        strings: ['strings', '[r1]20 ' + pad(B, { lo: 62 }) + '[r1]4', { vol: 0.8 }],
        bass: ['sbass', bass(ALL, '11815181')],
        arp: ['sq12', arp(ALL, '012321', { st: 12 }), { pan: -0.35 }],
        drums: ['kit', 'l16 k...k...k...k.k. k...k...k...k.k. K.h.S.hkk.h.S.h. S.ss.s.suummtttt ' +
          '$CR [$G]6 $F $CR [$G]6 $F $CR [$G]6 $F K..K..K.K..K..K. K..K..K.K..K..K. K.hKS.hKK.hKS.S. SSSSuuuummmmtttt'],
      },
    };
  }

  // ---- mus_battle_boss: "The Warden" — 150 BPM, C minor, march + glass arps ---------------
  {
    const IN = 'Cm Cm Cm G';
    const A = 'Cm Ab Fm G Cm Ab Db G';
    const B = 'Fm Cm Ab G Fm Cm Db G';
    const C = 'Cm Cm Ab Ab Fm Fm G G';
    const ALL = [IN, A, B, C].join(' ');
    DEFS.mus_battle_boss = {
      bpm: 150, meter: [4, 4], bars: 28, loop: 4, echo: [0.5, 0.3, 0.25],
      m: {
        LA: 'o5 g2 >c4. d8< | >e-2. d8 c8< | >c2< a-4 f4 | g2. b4 | g2 >c4. d8< | >e-4. f8 g4 e-4< | >f2 d-4 c4< | b2 >d2<',
        LB: 'o5 >c4 f4 a-4 g8 f8< | >g2 e-2< | >e-4 c4< a-4 >c4< | >d2.< b4 | >c4 f4 a-4 b-8 a-8< | >g4 c4 e-4 g4< | >a-2 f4 d-4< | >d2< b4 g4',
        LC: 'o4 g1 | a-2 g2 | a-1 | e-1 | f1 | a-2 >c2< | b1 | >d1<',
        M: 'K.ss.s.sK.ss.sss',
        MF: 'K.ss.s.sssssuumt',
      },
      v: {
        glass: ['glass', arp(ALL, '01234321', { st: 12, oct: 5 }), { pan: 0.3, vol: 0.9 }],
        lead: ['strings', '[r1]4 $LA @brass $LB [r1]8'],
        horn: ['horn', '[r1]20 $LC'],
        choir: ['choir', '[r1]12 ' + pad(B + ' ' + C, { lo: 55 })],
        bass: ['sbass', bass(ALL, '11811518')],
        drums: ['kit', 'l16 [S.ss.s.sS.ss.sss]3 SSSSssssSSSSssss C.ss.s.sK.ss.sss [$M]6 $MF C.ss.s.sK.ss.sss [$M]6 $MF [K.......s.......]7 ssssssssSSSSSSSS'],
      },
    };
  }

  // ---- mus_victory: "Clockwork Fanfare" — one-shot, ends on the Trigger Motif -------------
  DEFS.mus_victory = {
    bpm: 120, meter: [4, 4], bars: 3, loop: 0, oneShot: true, echo: [0.5, 0.3, 0.25],
    v: {
      lead: ['brass', 'o5 g12 g12 g12 >c4.< g8 a4 | a8 >c8 f4< g8 b8 >d4< | c8 e8 a8 >d8^2<'],
      brass2: ['brass', 'o4 e12 e12 e12 g4. e8 f4 | f8 a8 >c4< d8 g8 b4 | r4 g4 >e2<', { vol: 0.75, pan: -0.2 }],
      bass: ['bass', 'o2 c4. c8 c4 c4 | f4 f4 g4 g4 | c1'],
      timp: ['timp', 'o2 c8 r8 c8 r8 g8 r8 c4 | f4 r4 g8 g8 g8 g8 | c1'],
      glock: ['glock', '[r1]2 o6 c8 e8 a8 >d8^2<', { pan: 0.35 }],
      drums: ['kit', 'l16 C...s.s.s...S... k...k...ssssSSSS C...............'],
    },
  };

  // ---- mus_end_of_time: "The Lamppost" — 70 BPM, music box, D major ----------------------
  {
    const ALL = 'Dmaj7 Bm7 Gmaj7 Asus4:2 A:2 Dmaj7 F#m7 Gmaj7 A Bm G Em7 A7 D Bm G A';
    DEFS.mus_end_of_time = {
      bpm: 70, meter: [4, 4], bars: 16, loop: 0, echo: [1, 0.5, 0.45],
      m: {
        EM: 'o5 f+4 a4 >c+2< | >d4 c+4< a2 | b4. a8 f+2 | e1 | f+4 a4 >e2< | >c+4< a4 >e4 d8 c+8< | b2 >d4 f+4< | >e1< |' +
          ' >d4< f+4 b2 | >d4 c+4< b4 a4 | g4 b4 >d2< | >c+1< | d4 f+4 b4 >e4< | >e2 d2< | d4 f+4 b4 >e4< | >f+2 e2<',
      },
      v: {
        mbox: ['mbox', '$EM'],
        pad: ['pad', pad(ALL, { lo: 57 }), { vol: 0.8 }],
        bass: ['sub', bass(ALL, '1---5---'), { vol: 0.6 }],
        tick: ['kit', 'l4 [rqrq]16', { vol: 0.35 }],
      },
    };
  }

  // ---- mus_guardia_600: "Banners of Guardia" — 110 BPM, lute + horns ----------------------
  {
    const IN = 'D A', A = 'D G D A Bm G Em A', B = 'G D C D G D Em A';
    const ALL = [IN, A, B, A].join(' ');
    DEFS.mus_guardia_600 = {
      bpm: 110, meter: [4, 4], bars: 26, loop: 2, echo: [0.75, 0.3, 0.25],
      m: {
        GA: 'o5 f+4. e8 d4 a4 | b4 a4 g4 b4 | a4. g8 f+4 d4 | e2. c+4 | d4. e8 f+4 b4 | >d4 c4< b4 g4 | a4 g4 f+4 e4 | e4 f+8 g8 a2',
        GB: 'o4 d2 g4. a8 | f+2 d2 | e4 g4 >c4. d8< | >d1< | d2 g4. b8 | a2 f+4 d4 | e4 g4 b4 >e4< | >c+2< a2',
        GF: 'o5 b1 | a1 | g1 | f+1 | b1 | a1 | g1 | e1',
      },
      v: {
        flute: ['flute', '[r1]2 $GA v9 $GF v12 $GA'],
        horn: ['horn', 'o4 a4. a8 >d2< | >c+4. d8 e2< [r1]8 $GB k-12 $GA'],
        lute: ['lute', arp(ALL, '01213121', { st: 24 }), { pan: -0.3 }],
        strings: ['strings', '[r1]10 ' + pad(B, { lo: 55 }) + '[r1]8', { vol: 0.7 }],
        bass: ['bass', bass(ALL, '1.5.', { st: 48 })],
        drums: ['kit', 'l16 [k.......k.......]2 [k.g.s.g.k.kgs.gg]23 k.g.s.g.s.ssuumt', { vol: 0.8 }],
      },
    };
  }

  // ---- mus_frog_theme: "Glenn's Oath" — 6/8, quarter = 96, E minor, strings -------------
  {
    const IN = 'Em Cmaj7', A = 'Em C G D Em Am B7 B7', B = 'C D G Em Am D G B7';
    const ALL = [IN, A, B, A].join(' ');
    DEFS.mus_frog_theme = {
      bpm: 96, meter: [6, 8], bars: 26, loop: 2, echo: [0.75, 0.35, 0.3],
      m: {
        FA: 'o5 b4. e8 f+8 g8 | a4 g8 e4. | d4. g8 a8 b8 | a4. f+4. | b4. >e8 d8 c8< | >c4< b8 a4. | f+4. a4 f+8 | d+2.',
        // bar 7 of B: Trigger Motif in G (G B E A)
        FB: 'o5 g4. >c4 d8< | >d4.< a4. | b4 >c8 d4.< | >e4.< b4. | >c4. e8 d8 c8< | >d4.< a8 b8 >c8< | g8 b8 >e8 a4.< | f+2.',
        HB: 'o4 e2. | f+2. | d2. | e2. | e2. | f+2. | d2. | d+2.',
        HA: 'o4 g2. | g2. | g2. | f+2. | g2. | e2. | f+2. | f+2.',
      },
      v: {
        lead: ['strings', '[r2.]2 $FA $FB $FA', { vol: 1.2 }],
        harp: ['harp', arp(ALL, '012321', { st: 24, b: 3 }), { pan: -0.3 }],
        bass: ['bass', bass(ALL, '1..5..', { b: 3 })],
        horn: ['horn', '[r2.]10 $HB $HA'],
        timp: ['timp', '[r2.]18 o2 e4. r4. | c4. r4. | g4. r4. | d4. r4. | e4. r4. | a4. r4. | b4. b8 b8 b8 | b2.'],
        pad: ['pad', pad(ALL, { b: 3, lo: 52 }), { vol: 0.8 }],
      },
    };
  }

  // ---- mus_denadoro: "Where the Wind Sharpens" — 120 BPM, A dorian, flute + wind ---------
  {
    const IN = 'Am Am', A = 'Am G D/F# Am Am G D E', B = 'F G Am Am F G E E';
    const ALL = [IN, A, B, A].join(' ');
    DEFS.mus_denadoro = {
      bpm: 120, meter: [4, 4], bars: 26, loop: 2, echo: [0.75, 0.35, 0.3],
      m: {
        DA: 'o5 e4 a8 b8 >c4< b8 a8 | g4. d8 g4 b4 | a4 f+8 a8 >d4 c8< a8 | a2. e4 | e4 a8 b8 >c4 d8 e8< | >d4. c8< b4 g4 | a4 >d4 f+4 e8 d8< | e2 < b2 >',
        DB: 'o5 >c2< a4 >c4< | >d2< b4 g4 | a4. b8 >c4 e4< | >e2. d4< | >c4< a4 f4 a4 | b4 g4 d4 g4 | g+2 b2 | >e2 d4< b4',
      },
      v: {
        flute: ['flute', '[r1]2 $DA $DB $DA'],
        ocarina: ['ocarina', '[r1]18 k-12 $DA', { vol: 0.7 }],
        wind: ['wind', 'o5 [a1^1 r1^1 e1^1 r1^1]3 a1^1'],
        harp: ['harp', arp(ALL, '01213121', { st: 24 }), { pan: 0.3 }],
        bass: ['bass', bass(ALL, '1..5..8.')],
        drums: ['kit', 'l16 [g.g.g.g.g.g.g.g.]2 [k..t..g.k..t..gg]23 k..t..g.k.uumttt', { vol: 0.8 }],
      },
    };
  }

  // ---- mus_ioka: "Bonfire Rhythm" — 130 BPM, D minor pentatonic, log drums -----------------
  {
    const IN = 'Dm Dm Dm Dm', A = 'Dm Dm C C Bb C Dm Dm', B = 'Bb C Dm Dm Bb C Dm Dm';
    const ALL = [IN, A, B, A].join(' ');
    DEFS.mus_ioka = {
      bpm: 130, meter: [4, 4], bars: 28, loop: 4, echo: [0.5, 0.25, 0.2],
      m: {
        IA: 'o5 d8 f8 g8 a8 r8 a8 g8 f8 | g8 a8 >c8 d8< a4 r4 | c8 d8 f8 g8 r8 g8 f8 d8 | c4 a8 g8 a4 r4 |' +
          ' f8 g8 a8 >c8 d4 c8< a8 | g4 e8 g8 >c4< r4 | a8 >c8 d8 f8 e8 d8 c8< a8 | d2 r2',
        IB: 'o5 r2 d8 f8 g8 a8 | b-4 a8 g8 f4 r4 | r2 e8 g8 a8 >c8< | >d4 c8< a8 g4 r4 | r2 f8 g8 a8 >c8< | >d4 f4 e8 d8 c8 d8< | a2 >c4 d4< | d1',
        LOG: 'o3 d8 r8 d8 a8 r8 d8 >c8< a8 | d8 r8 d8 a8 >c8 d8 r4<',
        T1: 'K.iji.jik.ij.tm.',
        T2: 'K.iji.jiK.xjtmut',
      },
      v: {
        lead: ['ocarina', '[r1]4 $IA $IB $IA'],
        log: ['log', '[$LOG]14', { pan: -0.25 }],
        bass: ['bass', bass(ALL, '1..1..5.')],
        kalimba: ['kalimba', '[r1]12 ' + arp(B, '0.2.1.3.', { st: 24, oct: 5 }) + '[r1]8', { pan: 0.3 }],
        drums: ['kit', 'l16 k...k...k...k... k..jk..jk..jk.ij $T1 $T2 [$T1 $T1 $T1 $T2]2 [$T1 $T2]4 [$T1 $T1 $T1 $T2]2'],
      },
    };
  }

  // ---- mus_ayla_theme: "Strong, Then Kind" — 120 BPM, F major, big drums ------------------
  {
    const IN = 'F F Bb C', A = 'F C/E Dm Bb F C Bb C', B = 'Dm Bb F C Dm Bb Gm C';
    const ALL = [IN, A, B, A].join(' ');
    DEFS.mus_ayla_theme = {
      bpm: 120, meter: [4, 4], bars: 28, loop: 4, echo: [0.75, 0.3, 0.22],
      m: {
        YA: 'o5 c4 f4 a4. g8 | g2 e4 c4 | d4 f4 a4 >c4< | b-4. a8 g4 f4 | c4 f4 a4 >c4< | >d2 c4< g4 | a4. g8 f4 d4 | e2 g2',
        YB: 'o5 a4 >d4 f4. e8< | >d4 c4< b-2 | a4 >c4 f4 e8 d8< | >e2 c2< | a4 >d4 f4 g8 a8< | >b-2 a4 g4< | >f4 d4< b-4 >d4< | >c2< b-4 g4',
        BIG: 'K..k..T.K.k.T.t.',
        BF: 'K..k..T.K.k.tmut',
      },
      v: {
        lead: ['flute', '[r1]4 $YA $YB @lead $YA'],
        horn: ['horn', 'o3 f2. c4 | f2. a4 | b-2 >d2< | c1 [r1]8 ' + pad(B, { lo: 53 }) + '[r1]8'],
        bass: ['bass', bass(ALL, '1.5.8.5.')],
        harp: ['harp', '[r1]4 ' + arp([A, B, A].join(' '), '01232123', { st: 24 }), { pan: -0.3 }],
        strings: ['strings', '[r1]20 ' + pad(A, { lo: 57 }), { vol: 0.8 }],
        drums: ['kit', 'l16 [$BIG]3 TTttMMmmUUuuSSSS [$BIG]7 $BF [$BIG]7 $BF [$BIG]7 $BF'],
      },
    };
  }

  // ---- mus_tyrano: "Ash and Bone" — 90 BPM, C# minor, low brass + timpani ------------------
  {
    const A = 'C#m D C#m D Bm C#m A G#7', B = 'A G#7 C#m C#m A B G#7 G#7';
    const ALL = A + ' ' + B;
    DEFS.mus_tyrano = {
      bpm: 90, meter: [4, 4], bars: 16, loop: 0, echo: [0.75, 0.35, 0.3],
      m: {
        TA: 'o3 c+2. d+8 e8 | f+2 e4 d4 | e4 d+4 c+2 | d1 | f+4. e8 d4 f+4 | e2 g+4 e4 | a4 g+4 f+4 e4 | g+1',
        TB: 'o4 c+2 e4. d+8 | c+2 < b+2 > | e2. d+4 | c+1 | c+4 e4 a4 g+4 | f+2 d+2 | f+4 e4 d+4 < b+4 > | < g+1 >',
      },
      v: {
        horn: ['horn', '$TA $TB', { vol: 1.3 }],
        timp: ['timp', bass(ALL, '1.....51')],
        choir: ['choir', pad(ALL, { lo: 60 })],
        bass: ['bass', bass(ALL, '1-----1-')],
        drums: ['kit', 'l16 [K.......k.....g.]7 K.....t.t.m.u.T. C.......k.....g. [K.......k.....g.]6 K.....t.t.m.u.T.', { vol: 0.8 }],
      },
    };
  }

  // ---- mus_last_village: "Snow Over the Sea" — 84 BPM, D minor, harp -------------------
  {
    const IN = 'Dm Bbmaj7', A = 'Dm Bbmaj7 Gm7 A Dm Bbmaj7 Gm6 A', B = 'Fmaj7 C Dm Bb Gm Dm/F Em7b5 A';
    const ALL = [IN, A, B].join(' ');
    DEFS.mus_last_village = {
      bpm: 84, meter: [4, 4], bars: 18, loop: 2, echo: [0.75, 0.4, 0.35],
      m: {
        VA: 'o5 a4. e8 f4 a4 | a4. g8 f4 d4 | e4 f4 g4 b-4 | a1 | a4. >d8 e4 f4< | >d2 c4< a4 | g4 b-4 a4 g4 | e2. c+4',
        VB: 'o5 a4. b-8 >c4< a4 | g2 e4 c4 | d4 f4 a4 >d4< | >d2< b-2 | b-4. a8 g4 d4 | f2 a4 >c4< | b-4 a4 g4 e4 | e2 c+2',
      },
      v: {
        flute: ['flute', '[r1]2 $VA $VB', { vol: 0.9 }],
        harp: ['harp', arp(ALL, '01234321', { st: 24, oct: 3 }), { pan: -0.25 }],
        glock: ['glock', 'o6 [r1]2 [r2 a16 r8. r4 | r1 | r4 e16 r8. r2 | r1]4', { pan: 0.4, vol: 0.8 }],
        bass: ['sub', bass(ALL, '1---5---'), { vol: 0.8 }],
        pad: ['pad', pad(ALL, { lo: 57 })],
        wind: ['wind', 'o6 [d1^1 r1^1]4 d1^1', { vol: 0.55 }],
      },
    };
  }

  // ---- mus_zeal_wreck: "What the Sea Kept" — 72 BPM, F minor, harp + choir -----------------
  {
    const A = 'Fm Db Ab Eb Fm Db Bbm C', B = 'Db Eb Cm Fm Bbm Eb Ab C';
    const ALL = A + ' ' + B;
    DEFS.mus_zeal_wreck = {
      bpm: 72, meter: [4, 4], bars: 16, loop: 0, echo: [1, 0.45, 0.4],
      m: {
        ZA: 'o5 c2 f4. g8 | a-2. r4 | c4 e-4 a-4. g8 | g2 r2 | c2 f4. g8 | a-4 b-4 >c4 d-4< | >c2.< b-4 | >c2< r2',
        ZB: 'o5 f2 a-4. b-8 | g2 r4 e-4 | g4 e-4 c4 e-4 | f2. r4 | f4 a-4 >d-4 c4< | b-2 g2 | a-4. >c8 e-4 d-4< | >c1<',
      },
      v: {
        vox: ['vox', '$ZA $ZB'],
        harp: ['harp', arp(ALL, '0124.2..', { st: 24 }), { pan: -0.3 }],
        choir: ['choir', pad(ALL, { lo: 53 })],
        bass: ['sub', bass(ALL, '1-------'), { vol: 0.7 }],
        toll: ['toll', 'o3 [f1 r1 r1 r1]4', { vol: 0.7 }],
      },
    };
  }

  // ---- mus_magus_theme: "Schala's Name" — 100 BPM, D minor organ; motif hidden in bass ---
  {
    const IN = 'Dm Dm', A = 'Dm Dm Bb A Dm Dm Gm A', B = 'Bbmaj7 Dm Gm C Bbmaj7 Dm/A Gm A7';
    const ALL = [IN, A, B].join(' ');
    DEFS.mus_magus_theme = {
      bpm: 100, meter: [4, 4], bars: 18, loop: 2, echo: [0.75, 0.35, 0.3],
      m: {
        GA: 'o5 a2 >d4. c8< | a4 f4 e4 d4 | f2 b-4. a8 | g4 f4 e2 | a2 >d4. e8< | >f4 e4 d4 c4< | b-4 >d4 c4< b-4 | a2 c+4 e4',
        GB: 'o5 >d2 f4. e8< | >d4 c4< a2 | b-4 >d4 g4. f8< | >e2 c2< | >d2 f4. g8< | >a4 g4 f4 e4< | >d4< b-4 >d4 g4< | >c+2 e2<',
        BA: 'o2 d2. d4 | d2 c2 | < b-2. b-4 | a1 > | d2. d4 | d2 c2 | < g2 a4 b-4 | a1 >',
        // Bb1 D2 G2 C3: the Trigger Motif (+4 +5 +5) spelled out by the bass roots
        BB: 'o1 b-1 | >d1 | g1 | >c1 | <<b-1 | a1 | g1 | a1',
      },
      v: {
        lead: ['organ', '[r1]2 $GA $GB', { vol: 1.2 }],
        organ: ['organ', pad(ALL, { lo: 50 }), { vol: 0.6 }],
        bass: ['obass', 'o2 d1 d1 $BA $BB'],
        choir: ['choir', '[r1]10 ' + pad(B, { lo: 57 })],
        schala: ['mbox', '[r1]14 o5 f2 a2 | a2 f2 | g2 d2 | e2 c+2', { vol: 0.7, pan: 0.35 }],
        tick: ['kit', 'l16 [r...r...r...r...]2 [k.h.r.h.r.h.r.h.]15 k.h.r.h.r.h.rrrr', { vol: 0.7 }],
      },
    };
  }

  // ---- mus_hollow: "The Museum of Never" — 60 BPM ambient -----------------------------
  {
    const ALL = 'Cmaj7 Am9 Fmaj7 Em7 Cmaj7 Am9 Dm9 G6 Cmaj7 Am9 Fmaj7 Em7 Cmaj7 Am9 Dm9 G6';
    DEFS.mus_hollow = {
      bpm: 60, meter: [4, 4], bars: 16, loop: 0, echo: [1, 0.5, 0.45],
      v: {
        pad: ['pad', pad(ALL, { lo: 55 })],
        // a glass chime spells the Trigger Motif once, like an exhibit label half-read
        glass: ['glass', 'o6 [r1]2 r2 e4 r4 | r1 | r1 | r4 b4 r2 | r1 | r1 | c2 e2 | a2 >d2< | r1 | r1 | r2. g4 | r1 | r1 | r1', { pan: 0.4 }],
        steps: ['kit', 'l8 [[........]3 f.f.f.f.]4', { vol: 0.5, pan: -0.4 }],
        sub: ['sub', bass(ALL, '1-------'), { vol: 0.6 }],
        air: ['wind', 'o5 [c1^1 r1^1]4', { vol: 0.4 }],
      },
    };
  }

  // ---- mus_curator: "Entry 0" — 5/4, 125 BPM, E minor, cold arpeggios -------------------
  {
    const IN = 'Em Em Fmaj7 Fmaj7', A = 'Em Em Fmaj7 Fmaj7 Am Am B7sus4 B', B = 'Cmaj7 Cmaj7 Am Am Fmaj7 Fmaj7 B B';
    const ALL = [IN, A, B].join(' ');
    const O5 = { b: 5 };
    DEFS.mus_curator = {
      bpm: 125, meter: [5, 4], bars: 20, loop: 4, echo: [0.75, 0.35, 0.3],
      m: {
        CA: 'o5 b2. >e4 d4< | b1 r4 | >c2.< a4 b4 | >e1 r4< | >c2. d4 e4< | >e2. d4 c4< | b2. >c+4 e4< | d+1 r4',
        CB: 'o5 g2. b4 >e4< | >d1 r4< | >c2.< b4 a4 | e1 r4 | f2. a4 >c4< | >e1 r4< | f+2. b4 >d+4< | >f+1 r4<',
      },
      v: {
        arp: ['synth', arp(ALL, '01201231231242314321', Object.assign({ st: 12 }, O5)), { pan: -0.2 }],
        lead: ['cold', '[r1 r4]4 $CA $CB'],
        bass: ['sbass', bass(ALL, '1..1..1.8.', O5)],
        pad: ['pad', pad(ALL, { b: 5, lo: 60 }), { vol: 0.7 }],
        glass: ['glass', '[r1 r4]12 ' + arp(B, '0....2....4....3....', { st: 12, b: 5, oct: 6 }), { pan: 0.4 }],
        drums: ['kit', 'l16 [k...........k.......]2 [K.h.h.h.r.h.k.h.r.h.]18', { vol: 0.85 }],
      },
    };
  }

  // ---- mus_curator_core: "The Core Exhibit" — 170 BPM, the motif fights the arpeggio ------
  {
    const IN = 'Em Em Em B', A = 'Em C Am B Em C F B', B = 'Em Em C B Em Em C B', C = 'C D Em Em C D B B', BR = 'C C B B';
    const ALL = [IN, A, B, C, BR].join(' ');
    DEFS.mus_curator_core = {
      bpm: 170, meter: [4, 4], bars: 32, loop: 4, echo: [0.75, 0.25, 0.2],
      m: {
        SA: 'o5 b2. a8 g8 | e1 | >c2.< b8 a8 | d+2 f+2 | b2. >c8 d8< | >e2 g2< | >f2 e4 c4< | b1',
        SB: 'o5 r1 | r2 >g4 e4< | r1 | b2 a+2 | r1 | r2 >g4 e4< | r1 | b1',
        SC: 'o5 >e2. d8 c8< | >d2 f+2< | b1 | g2 b2 | >e2. d8 c8< | >d2 a2< | b1 | >d+1<',
        // Trigger Motif in E major (G#) against the E-minor arpeggio (G natural)
        KB: 'o4 e4 g+4 >c+4 f+4< | >f+1< | c4 e4 a4 >d4< | >d+2< b2 | e4 g+4 >c+4 f+4< | >f+2 g2< | c4 e4 a4 >d4< | >d+1<',
        KC: 'o4 c2 e2 | a2 >d2< | >d1^1< | c2 e2 | a2 >d2< | >d+1< | >f+1<',
        G: 'K.h.S.hKK.h.S.hS',
        F: 'K.h.S.hKS.SSuumt',
      },
      v: {
        arp: ['synth', arp(ALL, '0123212301232124', { st: 12 }), { pan: -0.3 }],
        scream: ['scream', '[r1]2 o4 e1^1 $SA $SB $SC o5 >c1^1 < b1^1'],
        brass: ['brass', '[r1]12 $KB $KC o4 c1 | e1 | d+1 | f+1', { pan: 0.2 }],
        bass: ['sbass', bass(ALL, '11811181')],
        choir: ['choir', '[r1]20 ' + pad(C, { lo: 60 }) + '[r1]4'],
        drums: ['kit', 'l16 K...K...K...K... K...K...K...K... K.h.S.h.K.h.S.h. SSSSSSSSuuuummtt ' +
          '[C.h.S.hKK.h.S.h. [$G]6 $F]3 [K.K.S.K.K.K.S.KS]3 SSSSSSSSSSSSSSSS'],
      },
    };
  }

  // ---- mus_ending: "Tomorrow, Unwritten" — 92 BPM, C major, motif fully resolved, one-shot ---
  {
    const IN = 'Cadd9 G', A = 'C G/B Am F C/E F Dm7 G', B = 'F G Em Am Dm7 G C C7', CO = 'Fmaj7 G C Am F G C:8';
    const ALL = [IN, A, B, CO].join(' ');
    DEFS.mus_ending = {
      bpm: 92, meter: [4, 4], bars: 26, loop: 0, oneShot: true, echo: [0.75, 0.35, 0.3],
      m: {
        EA: 'o5 c4 e4 a4. g8 | g2. d4 | e4 a4 >c4.< b8 | a2 g4 f4 | e4 g4 >c4. d8< | >c2< a2 | f4 a4 >c4 d4< | >d2< b2',
        EB: 'o5 a4. >c8 f4 e4< | >d2< b4 g4 | g4. b8 >e4 d4< | >c2< a2 | f4. a8 >d4 c4< | b2 >d2< | >e2. d4< | >c2< b-2',
        // coda: C E A D ... and the D finally resolves up to E over C
        EC: 'o5 c4 e4 a4 >d4< | >d1< | >e1< | >e2 d4 c4< | >c2< a4 >d4< | >d2< b2 | >c1^1<',
        HB: 'o4 c1 | d1 | e1 | e1 | f1 | f1 | e2 g2 | g1',
        HC: 'o4 a1 | b1 | >c1 | c1 | < a1 | b1 | >c1^1<',
      },
      v: {
        lead: ['flute', '[r1]2 $EA @strings $EB $EC'],
        bell: ['bell', 'o5 c4. e8 a4 >d4< | >d1< [r1]16 o6 c4 e4 a4 >d4< | >d1< | >e1< | r1 | r1 | r1 | c1 | r1', { pan: 0.3 }],
        harp: ['harp', arp(ALL, '01234321', { st: 24 }), { pan: -0.3 }],
        bass: ['bass', bass(ALL, '1---5---')],
        pad: ['pad', pad(ALL, { lo: 55 })],
        horn: ['horn', '[r1]10 $HB $HC'],
        drums: ['kit', 'l16 [................]10 [k...g...k.g.g...]7 k...g...k.g.x.x. [k...g...k.g.g...]2 C...g...k.g.g... [k...g...k.g.g...]3 C............... ................', { vol: 0.6 }],
      },
    };
  }

  // ---- mus_credits: "Ephemeral Dawn" — medley, one-shot ~3 min ----------------------------
  const CREDITS = {
    segments: [
      ['mus_fair_night', 4, 20],
      ['mus_frog_theme', 2, 18],
      ['mus_ayla_theme', 4, 20],
      ['mus_magus_theme', 2, 18],
      ['mus_ending', 0, 26],
    ],
    gap: 0.5,
    echo: [0.3, 0.3, 0.25],
  };

  const TRACK_IDS = Object.keys(DEFS).concat(['mus_credits']);

  // ---------------------------------------------------------------------------
  // Compilation (lazy, cached)
  // ---------------------------------------------------------------------------
  const compiled = {};
  // step-string kit letters -> drum-kit keys (GM percussion numbers; 90+ are extras)
  const KIT_KEY = { k: 36, s: 38, h: 42, o: 46, c: 49, t: 43, m: 47, u: 50, x: 39, r: 37, q: 76, i: 90, j: 91, g: 70, f: 92 };
  // def.tempo = [[tick, bpm], ...] (optional tempo changes) -> tick -> seconds
  function tempoMap(def) {
    const pts = [[0, def.bpm]];
    for (const p of def.tempo || []) { if (p[0] <= 0) pts[0][1] = p[1]; else pts.push([p[0], p[1]]); }
    pts.sort((a, b) => a[0] - b[0]);
    const seg = [];
    let t = 0;
    for (let i = 0; i < pts.length; i++) {
      seg.push({ tk: pts[i][0], t, spt: 60 / (pts[i][1] * PPQ) });
      if (i + 1 < pts.length) t += (pts[i + 1][0] - pts[i][0]) * seg[i].spt;
    }
    return (tk) => { let s = seg[0]; for (let i = 1; i < seg.length && seg[i].tk <= tk; i++) s = seg[i]; return s.t + (tk - s.tk) * s.spt; };
  }
  const ORD = { x: 0, y: 1, n: 2 };
  function compile(id) {
    if (compiled[id]) return compiled[id];
    if (id === 'mus_credits' && !DEFS[id]) return (compiled[id] = compileCredits());
    const def = DEFS[id];
    if (!def) return null;
    const barT = (def.meter[0] * WHOLE) / def.meter[1];
    const sec = tempoMap(def);
    const lenT = def.bars * barT, loopT = (def.loop || 0) * barT;
    const events = [], lens = {}, vdef = {}, bends = {};
    for (const name of Object.keys(def.v)) {
      const [instName, src, opt] = def.v[name];
      const o = opt || {};
      const isKit = instName === 'kit';
      const P0 = patchOf(instName);
      vdef[name] = { vol: o.vol != null ? o.vol : 1, pan: o.pan || 0, echo: o.echo != null ? o.echo : P0.echo != null ? P0.echo : 0.3, kit: !!P0.kit };
      const lanes = Array.isArray(src) ? src : [src];
      let ticks = 0;
      for (const lane of lanes) {
        const r = isKit ? parseDrums(lane, def.m) : parseMML(lane, def.m, instName);
        ticks = Math.max(ticks, r.ticks);
        for (const e of r.events) {
          if (e.tk >= lenT) continue;
          const t = sec(e.tk);
          if (e.ctl) {
            const c = { t, tk: e.tk, k: e.ctl, val: e.val, ramp: e.ramp, vn: name };
            if (e.ctl === 'y') (bends[name] || (bends[name] = [])).push(c); else events.push(c);
            continue;
          }
          if (e.drum) {
            events.push({ t, tk: e.tk, k: 'n', d: 0.1, notes: [KIT_KEY[e.drum] || 37], vel: e.vel, P: PATCH.drums, vn: name, pan: null });
            continue;
          }
          const P = patchOf(e.inst);
          const gate = e.gate != null ? e.gate : P.gate != null ? P.gate : 0.94;
          const tEnd = sec(Math.min(lenT + barT, e.tk + e.dur * gate));
          events.push({ t, tk: e.tk, k: 'n', d: Math.max(0.02, tEnd - t), notes: e.notes, vel: e.vel, P, vn: name, pan: e.pan });
        }
      }
      lens[name] = ticks;
    }
    // state to restore when the loop wraps: the expression in force at the loop point
    const tLoop = sec(loopT);
    if (!def.oneShot && loopT > 0) {
      const last = {};
      for (const e of events) if (e.k === 'x' && e.tk <= loopT) { if (!last[e.vn] || e.tk >= last[e.vn].tk) last[e.vn] = e; }
      const has = {};
      for (const e of events) if (e.k === 'x') has[e.vn] = 1;
      for (const vn of Object.keys(has)) events.push({ t: tLoop, tk: loopT, k: 'x', val: last[vn] ? last[vn].val : 100, ramp: false, vn, wrapOnly: true });
    }
    events.sort((a, b) => a.t - b.t || (b.wrapOnly ? 1 : 0) - (a.wrapOnly ? 1 : 0) || ORD[a.k] - ORD[b.k]);
    for (const vn of Object.keys(bends)) bends[vn].sort((a, b) => a.t - b.t);
    const len = sec(lenT);
    let loopIdx = events.findIndex((e) => e.t >= tLoop - 1e-9);
    if (loopIdx < 0) loopIdx = events.length;
    const ec = def.echo || [0.75, 0.3, 0.25];
    const spb = 60 / def.bpm;
    return (compiled[id] = {
      id, bpm: def.bpm, meter: def.meter, bars: def.bars, barSec: (barT / PPQ) * spb, len, loopStart: tLoop, loopIdx,
      oneShot: !!def.oneShot, events, voices: Object.keys(def.v).length, lens, expectTicks: lenT, vdef, bends,
      kind: def.kind || 'field', maxLoops: def.maxLoops || 0, skip: sec(def.skip || 0), gain: def.gain != null ? def.gain : 1, lead: def.lead || null,
      barAt: (t) => { let b = 0; while (b < def.bars && sec((b + 1) * barT) <= t + 1e-6) b++; return sec(b * barT); },
      echo: { time: Math.min(1.5, Math.max(0.03, ec[0] * spb)), fb: ec[1], wet: ec[2], lp: ec[3] || 2800, spread: ec[4] != null ? ec[4] : 0.6 },
    });
  }
  // legacy medley (only used when no 'mus_credits' def is registered)
  function compileCredits() {
    const events = [], vdef = {}, bends = {};
    let off = 0, voices = 0;
    for (const [id, from, to] of CREDITS.segments) {
      const tr = compile(id);
      if (!tr) continue;
      voices = Math.max(voices, tr.voices);
      const t0 = from * tr.barSec, t1 = to * tr.barSec;
      for (const vn of Object.keys(tr.vdef)) vdef[id + ':' + vn] = tr.vdef[vn];
      for (const e of tr.events) {
        if (e.wrapOnly || e.t < t0 - 1e-9 || e.t >= t1 - 1e-9) continue;
        events.push(Object.assign({}, e, { t: e.t - t0 + off, d: e.d != null ? Math.min(e.d, t1 - e.t) : e.d, vn: id + ':' + e.vn }));
      }
      off += t1 - t0 + CREDITS.gap;
    }
    const len = off - CREDITS.gap + 1;
    return {
      id: 'mus_credits', bpm: 0, meter: null, bars: 0, barSec: 0, len, loopStart: 0, loopIdx: 0, oneShot: true,
      events, voices, lens: {}, expectTicks: 0, vdef, bends, kind: 'field', maxLoops: 0, skip: 0, gain: 1, lead: null, barAt: (t) => t,
      echo: { time: CREDITS.echo[0], fb: CREDITS.echo[1], wet: CREDITS.echo[2], lp: 2800, spread: 0.6 },
    };
  }

  // ---------------------------------------------------------------------------
  // Synthesis primitives
  // ---------------------------------------------------------------------------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function ctxCache(ac) {
    if (!ac.__ct) ac.__ct = { waves: {}, noise: null };
    return ac.__ct;
  }
  function noiseBuf(ac) {
    const c = ctxCache(ac);
    if (!c.noise) {
      const n = ac.sampleRate * 2;
      const b = ac.createBuffer(1, n, ac.sampleRate);
      const d = b.getChannelData(0);
      let seed = 22222;
      for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
      c.noise = b;
    }
    return c.noise;
  }
  const HARM = {
    organ: [0, 1, 0.8, 0.6, 0.5, 0, 0.35, 0, 0.3, 0, 0, 0, 0.12],
    reed: [0, 1, 0.7, 0.9, 0.35, 0.55, 0.2, 0.3, 0.12, 0.18, 0.08, 0.1, 0.05],
    flute: [0, 1, 0.25, 0.08, 0.03],
    soft: [0, 1, 0.3, 0.1],
    bassw: [0, 1, 0.55, 0.35, 0.2, 0.12, 0.08, 0.05],
  };
  function makeWave(ac, name) {
    const H = 48;
    let re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    if (HARM[name]) {
      const h = HARM[name];
      im = new Float32Array(h.length);
      for (let i = 0; i < h.length; i++) im[i] = h[i];
      re = new Float32Array(h.length);
    } else if (name === 'pluck') {
      for (let n = 1; n <= 24; n++) im[n] = 1 / Math.pow(n, 1.25);
    } else {
      const duty = name === 'sq12' ? 0.125 : name === 'sq25' ? 0.25 : 0.5;
      for (let n = 1; n <= H; n++) {
        // Fourier series of a pulse wave with the given duty cycle
        im[n] = (2 / (n * Math.PI)) * (1 - Math.cos(2 * Math.PI * n * duty));
        re[n] = (2 / (n * Math.PI)) * Math.sin(2 * Math.PI * n * duty);
      }
    }
    return ac.createPeriodicWave(re, im);
  }
  function setWave(ac, osc, name) {
    if (name === 'sine' || name === 'triangle' || name === 'sawtooth' || name === 'square') { osc.type = name; return; }
    if (name === 'tri') { osc.type = 'triangle'; return; }
    if (name === 'saw') { osc.type = 'sawtooth'; return; }
    const c = ctxCache(ac);
    if (!c.waves[name]) c.waves[name] = makeWave(ac, name);
    osc.setPeriodicWave(c.waves[name]);
  }
  // Per-bus cached panners / echo sends (saves two nodes per note).
  function busOut(ac, bus, node, pan, echo) {
    if (!pan || !ac.createStereoPanner) node.connect(bus.dry);
    else {
      const pc = bus.pans || (bus.pans = {});
      const k = Math.round(pan * 20);
      if (!pc[k]) { pc[k] = ac.createStereoPanner(); pc[k].pan.value = Math.max(-1, Math.min(1, k / 20)); pc[k].connect(bus.dry); }
      node.connect(pc[k]);
    }
    if (echo && bus.send) {
      const ec = bus.sends || (bus.sends = {});
      const k = Math.round(echo * 20);
      if (!ec[k]) { ec[k] = ac.createGain(); ec[k].gain.value = k / 20; ec[k].connect(bus.send); }
      node.connect(ec[k]);
    }
  }

  // ===== MUSIC ENGINE: sample bank, voices, drum kit, mixer =====
  // ---------------------------------------------------------------------------
  // Sample bank: PATCH specs -> looped samples (built lazily, one zone per octave)
  // ---------------------------------------------------------------------------
  const BSR = 32000, TL = 2048, GUARD = 8;
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  // RBJ biquad coefficients at the bank rate; 'bp' has unity peak gain
  function biquad(type, f, q) {
    const w = 2 * Math.PI * Math.min(0.46, Math.max(10, f) / BSR), cs = Math.cos(w), al = Math.sin(w) / (2 * (q || 0.7));
    let b0, b1, b2;
    if (type === 'lp') { b1 = 1 - cs; b0 = b2 = b1 / 2; } else if (type === 'hp') { b1 = -(1 + cs); b0 = b2 = (1 + cs) / 2; } else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    return [b0 / a0, b1 / a0, b2 / a0, (-2 * cs) / a0, (1 - al) / a0];
  }
  // in-place filter; passes = 2 runs the buffer once to settle, so a looped (periodic) buffer stays periodic
  function filt(x, c, passes) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let p = (passes || 1) - 1; p >= 0; p--) {
      for (let i = 0; i < x.length; i++) {
        const xi = x[i], y = c[0] * xi + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
        x2 = x1; x1 = xi; y2 = y1; y1 = y;
        if (!p) x[i] = y;
      }
    }
    return x;
  }
  function rmsOf(x, a, b) {
    let s = 0;
    for (let i = a; i < b; i++) s += x[i] * x[i];
    return Math.sqrt(s / Math.max(1, b - a));
  }
  const SINT = new Float32Array(TL);
  for (let i = 0; i < TL; i++) SINT[i] = Math.sin((2 * Math.PI * i) / TL);
  function waveTable(spec, f0, hmax, rnd) {
    const t = new Float32Array(TL + 1), H = Math.min(hmax, 128), amps = new Float32Array(H + 1);
    let mx = 0;
    for (let k = 1; k <= H; k++) { const a = spec(k, k * f0, f0) || 0; amps[k] = a; if (a > mx) mx = a; }
    if (!(mx > 0)) return null;
    for (let k = 1; k <= H; k++) {
      const a = amps[k];
      if (a < mx * 1.5e-3) continue;
      let idx = rnd ? (rnd() * TL) | 0 : 0;
      for (let i = 0; i < TL; i++) { t[i] += a * SINT[idx]; idx = (idx + k) & (TL - 1); }
    }
    const g = 1 / (rmsOf(t, 0, TL) || 1);
    for (let i = 0; i < TL; i++) t[i] *= g;
    t[TL] = t[0];
    return t;
  }
  function buildZone(P, root) {
    const rnd = rng(hashStr(P.name) + root * 7919);
    const f0n = 440 * Math.pow(2, (root - 69) / 12);
    const K = Math.max(4, Math.round(f0n * (P.L || 0.4))), N = Math.round((K * BSR) / f0n), f0 = (K * BSR) / N;
    const A = Math.max(64, Math.round((P.A != null ? P.A : 0.2) * BSR)), n = A + N + GUARD, Asec = A / BSR;
    const out = new Float32Array(n);
    if (P.h) {
      const be = P.be || [0, 1, 0], beA = be[2] + (be[0] - be[2]) * Math.exp(-Asec / be[1]);
      const sc = P.scoop, scA = sc ? Math.exp(-Asec / sc[1]) : 0;
      const riseA = P.rise ? 1 - Math.exp(-Asec / P.rise) : 1;
      const tabs = {};
      for (const [cents, amp] of P.v || [[0, 1]]) {
        const ratio = Math.pow(2, cents / 1200);
        let cyc = Math.round(K * ratio);
        if (cents !== 0 && cyc === K) cyc += cents > 0 ? 1 : -1;
        if (cyc < 1) continue;
        // detuned copies share one table; octave-stacked copies get their own (band limit)
        const oc = Math.round(cents / 400), fv = f0 * Math.pow(2, oc / 3), hmax = Math.floor(13500 / fv);
        const tb = tabs[oc] || (tabs[oc] = [waveTable(P.h, fv, hmax, P.rp ? rnd : null), P.hb ? waveTable(P.hb, fv, hmax, P.rp ? rnd : null) : null]);
        const T = tb[0], TB = tb[1];
        if (!T) continue;
        const inc0 = (TL * cyc) / N;
        let ph = P.rp ? rnd() * TL : 0;
        for (let i = 0; i < n; i++) {
          let inc = inc0, b = beA, r = 1;
          if (i < A) {
            const t = i / BSR;
            if (TB) b = be[2] + (be[0] - be[2]) * Math.exp(-t / be[1]);
            if (sc) inc = inc0 * Math.pow(2, (sc[0] * (Math.exp(-t / sc[1]) - scA)) / 1200);
            if (P.rise) r = (1 - Math.exp(-t / P.rise)) / riseA;
          }
          const j = ph | 0, fr = ph - j;
          let s = T[j] + (T[j + 1] - T[j]) * fr;
          if (TB) s += b * (TB[j] + (TB[j + 1] - TB[j]) * fr);
          out[i] += amp * r * s;
          ph += inc;
          if (ph >= TL) ph -= TL;
        }
      }
    }
    for (const [ratio, amp, tau, floor, db] of P.pt || []) {
      const cyc = Math.max(1, Math.round(K * ratio) + (db || 0));
      if ((cyc * BSR) / N > 14000) continue;
      const w = (2 * Math.PI * cyc) / N, cw = Math.cos(w), sw = Math.sin(w), fl = floor || 0;
      const aA = tau ? fl + (1 - fl) * Math.exp(-Asec / tau) : 1;
      let s = 0, c = 1;
      for (let i = 0; i < n; i++) {
        const a = tau && i < A ? fl + (1 - fl) * Math.exp(-i / BSR / tau) : aA;
        out[i] += amp * a * s;
        const ns = s * cw + c * sw;
        c = c * cw - s * sw; s = ns;
      }
    }
    const tone = P.h || P.pt ? rmsOf(out, A, A + N) || rmsOf(out, 0, A) || 1 : 1;
    if (P.nz) {
      const z = P.nz, nb = new Float32Array(N);
      for (let i = 0; i < N; i++) nb[i] = rnd() * 2 - 1;
      filt(nb, biquad(z.t || 'bp', Math.min(z.rel ? z.rel * f0 : z.f, 14000), z.q || 1), 2);
      const g = (z.a * tone) / (rmsOf(nb, 0, N) || 1), b = z.b, bA = b ? Math.exp(-Asec / b[1]) : 0;
      for (let i = 0; i < n; i++) {
        let m = 1;
        if (b && i < A) m += b[0] * (Math.exp(-i / BSR / b[1]) - bA);
        if (i < 96) m *= i / 96;
        out[i] += g * m * nb[(((i - A) % N) + N) % N];
      }
    }
    if (P.ck) {
      const [amp, tau, lpHz] = P.ck, len = Math.min(A, Math.round(tau * 7 * BSR)), cb = new Float32Array(len);
      for (let i = 0; i < len; i++) cb[i] = (rnd() * 2 - 1) * Math.exp(-i / BSR / tau) * (1 - i / len);
      filt(cb, biquad('lp', lpHz, 0.7), 1);
      let pkv = 1e-9;
      for (let i = 0; i < len; i++) pkv = Math.max(pkv, Math.abs(cb[i]));
      const g = (amp * tone * 3) / pkv;
      for (let i = 0; i < len; i++) out[i] += g * cb[i];
    }
    for (let j = 0; j < GUARD; j++) out[A + N + j] = out[A + j];
    // level: the louder of the onset (first 0.3 s) and the loop is the reference
    const g = 0.22 / (Math.max(rmsOf(out, 0, Math.min(n, Math.round(0.3 * BSR))), rmsOf(out, A, A + N)) || 1);
    for (let i = 0; i < n; i++) out[i] *= g;
    return { data: out, f0, ls: A / BSR, le: (A + N) / BSR };
  }

  // ---------------------------------------------------------------------------
  // Drum kit: one-shot samples per GM percussion key (layered tone + noise + metal)
  // ---------------------------------------------------------------------------
  function dTone(o, f0, f1, tp, amp, tau, at) {
    let ph = 0;
    for (let i = 0; i < o.length; i++) {
      const t = i / BSR, f = f0 + (f1 - f0) * Math.exp(-t / tp);
      ph += (2 * Math.PI * f) / BSR;
      o[i] += amp * Math.sin(ph) * Math.exp(-t / tau) * (at ? Math.min(1, t / at) : 1);
    }
  }
  function dNoise(o, rnd, type, f, q, amp, tau, at, start) {
    const s0 = Math.round((start || 0) * BSR), n = o.length - s0;
    if (n <= 0) return;
    const tmp = new Float32Array(n);
    for (let i = 0; i < n; i++) tmp[i] = rnd() * 2 - 1;
    filt(tmp, biquad(type, f, q), 1);
    const g = amp / ((rmsOf(tmp, 0, n) || 1) * 2.5);
    for (let i = 0; i < n; i++) { const t = i / BSR; o[s0 + i] += g * tmp[i] * Math.exp(-t / tau) * (at ? Math.min(1, t / at) : 1); }
  }
  // cluster of inharmonic partials between lo and hi Hz (cymbals, hats, jingles)
  function dMetal(o, rnd, cnt, lo, hi, amp, tau, tilt) {
    for (let p = 0; p < cnt; p++) {
      const f = lo * Math.pow(hi / lo, (p + rnd()) / cnt), w = (2 * Math.PI * f) / BSR, cw = Math.cos(w), sw = Math.sin(w);
      const a = (amp * (0.5 + 0.5 * rnd()) * Math.pow(f / lo, -(tilt || 0))) / Math.sqrt(cnt), tp = tau * (0.5 + rnd()) * Math.pow(f / lo, -0.35);
      let s = Math.sin(rnd() * 6.28), c = Math.sqrt(1 - s * s);
      const dec = Math.exp(-1 / (BSR * tp));
      let e = a;
      for (let i = 0; i < o.length; i++) { o[i] += e * s; const ns = s * cw + c * sw; c = c * cw - s * sw; s = ns; e *= dec; }
    }
  }
  function dPart(o, list, tau) { for (const [f, a, tm] of list) dTone(o, f, f, 1, a, tau * (tm || 1)); }
  const tom = (f, tau) => (o, r) => { dTone(o, f, f * 1.7, 0.03, 1, tau); dTone(o, f * 1.52, f * 2, 0.02, 0.25, tau * 0.5); dNoise(o, r, 'bp', f * 5, 0.8, 0.35, 0.03); };
  const hand = (f, tau, slap) => (o, r) => { dTone(o, f, f * 1.3, 0.012, 1, tau); dTone(o, f * 1.59, f * 1.59, 1, 0.3, tau * 0.5); dNoise(o, r, 'bp', f * 4, 0.9, slap, 0.012); };
  const block = (f, tau) => (o, r) => { dTone(o, f, f, 1, 1, tau); dTone(o, f * 2.42, f * 2.42, 1, 0.3, tau * 0.4); dNoise(o, r, 'hp', 3000, 0.7, 0.3, 0.003); };
  const shake = (f, at, tau, type) => (o, r) => dNoise(o, r, type || 'hp', f, 0.7, 1, tau, at);
  const cym = (cnt, lo, hi, tau, nz, burst) => (o, r) => { dMetal(o, r, cnt, lo, hi, 1, tau, 0.25); dNoise(o, r, 'bp', 6500, 0.4, nz, tau * 0.55); dNoise(o, r, 'hp', 3000, 0.7, burst, 0.03); };
  // key: [seconds, peak, group (l c r), fn]  — group = stereo position of the piece
  const KITDEF = {
    35: [0.5, 0.85, 'c', (o, r) => { dTone(o, 43, 150, 0.04, 1, 0.15); dNoise(o, r, 'lp', 220, 0.7, 0.5, 0.035); dNoise(o, r, 'hp', 2200, 0.7, 0.18, 0.004); }],
    36: [0.4, 0.85, 'c', (o, r) => { dTone(o, 52, 175, 0.03, 1, 0.11); dNoise(o, r, 'lp', 260, 0.7, 0.4, 0.03); dNoise(o, r, 'hp', 2600, 0.7, 0.28, 0.004); }],
    37: [0.12, 0.5, 'c', (o, r) => { dTone(o, 1650, 1650, 1, 0.6, 0.012); dTone(o, 480, 480, 1, 0.5, 0.02); dNoise(o, r, 'hp', 3000, 0.7, 0.5, 0.006); }],
    38: [0.42, 0.85, 'c', (o, r) => { dTone(o, 185, 330, 0.012, 0.7, 0.07); dTone(o, 330, 480, 0.01, 0.3, 0.045); dNoise(o, r, 'bp', 2200, 0.5, 1, 0.12); dNoise(o, r, 'hp', 5000, 0.7, 0.4, 0.09); }],
    39: [0.36, 0.6, 'c', (o, r) => { for (const s of [0, 0.011, 0.022]) dNoise(o, r, 'bp', 1200, 1.2, 0.8, 0.006, 0, s); dNoise(o, r, 'bp', 1150, 0.9, 1, 0.09, 0, 0.033); }],
    40: [0.36, 0.82, 'c', (o, r) => { dTone(o, 210, 360, 0.01, 0.6, 0.055); dNoise(o, r, 'bp', 2800, 0.5, 1, 0.09); dNoise(o, r, 'hp', 6000, 0.7, 0.5, 0.07); }],
    41: [0.7, 0.8, 'r', tom(80, 0.26)], 43: [0.65, 0.8, 'r', tom(98, 0.24)], 45: [0.6, 0.78, 'c', tom(122, 0.21)],
    47: [0.55, 0.78, 'c', tom(147, 0.19)], 48: [0.5, 0.76, 'l', tom(176, 0.17)], 50: [0.45, 0.76, 'l', tom(208, 0.15)],
    42: [0.12, 0.36, 'r', (o, r) => { dMetal(o, r, 22, 4200, 13000, 1, 0.03); dNoise(o, r, 'hp', 7000, 0.7, 0.6, 0.025); }, 'choke'],
    44: [0.1, 0.3, 'r', (o, r) => { dMetal(o, r, 22, 4200, 13000, 1, 0.018); dNoise(o, r, 'hp', 6500, 0.7, 0.5, 0.016); }, 'choke'],
    46: [0.7, 0.38, 'r', (o, r) => { dMetal(o, r, 26, 3800, 13000, 1, 0.24); dNoise(o, r, 'hp', 6000, 0.7, 0.6, 0.2); }, 'open'],
    49: [2.2, 0.5, 'l', cym(56, 1700, 13000, 0.85, 0.6, 0.8)], 57: [2.0, 0.48, 'r', cym(56, 1500, 12500, 0.75, 0.6, 0.8)],
    52: [1.2, 0.48, 'r', cym(40, 1200, 11000, 0.4, 0.8, 1)], 55: [0.9, 0.42, 'l', cym(36, 3200, 13500, 0.3, 0.5, 0.7)],
    51: [1.3, 0.36, 'r', (o, r) => { dMetal(o, r, 30, 3000, 12000, 0.7, 0.5, 0.3); dPart(o, [[2910, 0.25], [4120, 0.2], [5340, 0.12]], 0.2); dNoise(o, r, 'hp', 8000, 0.7, 0.2, 0.05); }],
    59: [1.3, 0.34, 'l', (o, r) => { dMetal(o, r, 30, 2600, 11500, 0.7, 0.55, 0.3); dPart(o, [[2540, 0.25], [3730, 0.2], [4960, 0.12]], 0.2); dNoise(o, r, 'hp', 8000, 0.7, 0.2, 0.05); }],
    53: [1.0, 0.36, 'r', (o) => dPart(o, [[900, 1], [1340, 0.7, 0.8], [2110, 0.5, 0.6], [2890, 0.35, 0.4], [3760, 0.2, 0.3]], 0.4)],
    54: [0.3, 0.34, 'r', (o, r) => { dMetal(o, r, 18, 5500, 13500, 1, 0.08); dNoise(o, r, 'hp', 6000, 0.7, 0.6, 0.06); dNoise(o, r, 'hp', 7000, 0.7, 0.35, 0.05, 0, 0.026); }],
    83: [0.5, 0.3, 'r', (o, r) => { dMetal(o, r, 18, 6000, 13500, 1, 0.18); dNoise(o, r, 'hp', 7000, 0.7, 0.3, 0.1); }],
    56: [0.36, 0.45, 'r', (o) => dPart(o, [[587, 1], [845, 0.8], [1761, 0.25, 0.5], [2535, 0.2, 0.4]], 0.09)],
    58: [0.9, 0.32, 'l', (o, r) => { dNoise(o, r, 'bp', 2600, 0.8, 1, 0.3); for (let i = 0; i < o.length; i++) o[i] *= 0.5 + 0.5 * Math.sign(Math.sin((2 * Math.PI * 31 * i) / BSR)); }],
    60: [0.3, 0.6, 'l', hand(400, 0.085, 0.4)], 61: [0.34, 0.62, 'l', hand(285, 0.11, 0.35)],
    62: [0.2, 0.55, 'r', hand(335, 0.04, 0.8)], 63: [0.4, 0.62, 'r', hand(300, 0.15, 0.35)], 64: [0.45, 0.66, 'l', hand(205, 0.19, 0.3)],
    65: [0.5, 0.58, 'r', (o, r) => { dPart(o, [[520, 1], [780, 0.4, 0.7], [1090, 0.2, 0.5]], 0.16); dNoise(o, r, 'bp', 3000, 0.8, 0.5, 0.012); }],
    66: [0.55, 0.6, 'l', (o, r) => { dPart(o, [[340, 1], [510, 0.4, 0.7], [715, 0.2, 0.5]], 0.2); dNoise(o, r, 'bp', 2500, 0.8, 0.5, 0.012); }],
    67: [0.4, 0.4, 'r', (o) => dPart(o, [[900, 1], [1332, 0.6, 0.8], [2340, 0.3, 0.5]], 0.13)],
    68: [0.45, 0.4, 'r', (o) => dPart(o, [[680, 1], [1006, 0.6, 0.8], [1768, 0.3, 0.5]], 0.15)],
    69: [0.2, 0.3, 'l', shake(6500, 0.014, 0.045)], 70: [0.16, 0.3, 'l', shake(5500, 0.008, 0.035)], 82: [0.2, 0.28, 'r', shake(7000, 0.01, 0.05, 'bp')],
    71: [0.14, 0.3, 'c', (o) => dTone(o, 2300, 2100, 0.05, 1, 0.08, 0.01)], 72: [0.45, 0.3, 'c', (o) => dTone(o, 2300, 2000, 0.2, 1, 0.3, 0.02)],
    73: [0.14, 0.3, 'r', (o, r) => { dNoise(o, r, 'bp', 3500, 2, 1, 0.07, 0.01); for (let i = 0; i < o.length; i++) o[i] *= 0.4 + 0.6 * Math.abs(Math.sin((Math.PI * 75 * i) / BSR)); }],
    74: [0.42, 0.3, 'r', (o, r) => { dNoise(o, r, 'bp', 3300, 2, 1, 0.25, 0.03); for (let i = 0; i < o.length; i++) o[i] *= 0.4 + 0.6 * Math.abs(Math.sin((Math.PI * 60 * i) / BSR)); }],
    75: [0.12, 0.45, 'r', (o) => dTone(o, 2500, 2500, 1, 1, 0.03)],
    76: [0.16, 0.5, 'r', block(1050, 0.035)], 77: [0.2, 0.5, 'l', block(700, 0.045)],
    78: [0.25, 0.35, 'l', (o) => dTone(o, 700, 500, 0.06, 1, 0.09, 0.01)], 79: [0.3, 0.35, 'l', (o) => dTone(o, 450, 700, 0.08, 1, 0.12, 0.01)],
    80: [0.2, 0.26, 'l', (o) => dPart(o, [[4420, 1], [6190, 0.6], [8870, 0.4], [11200, 0.2]], 0.05)],
    81: [1.4, 0.26, 'l', (o) => dPart(o, [[4420, 1], [6190, 0.6, 0.8], [8870, 0.4, 0.6], [11200, 0.2, 0.4]], 0.5)],
    86: [0.4, 0.8, 'c', tom(68, 0.13)], 87: [0.8, 0.8, 'c', tom(64, 0.32)],
    90: [0.4, 0.6, 'l', (o) => { dTone(o, 560, 640, 0.04, 1, 0.1); dTone(o, 1300, 1470, 0.03, 0.22, 0.04); }],
    91: [0.45, 0.62, 'r', (o) => { dTone(o, 340, 400, 0.05, 1, 0.13); dTone(o, 800, 920, 0.03, 0.2, 0.04); }],
    92: [0.2, 0.4, 'c', (o, r) => { dNoise(o, r, 'lp', 450, 0.7, 1, 0.05, 0.004); dTone(o, 60, 95, 0.05, 0.5, 0.05); }],
  };
  const DRUM_ALIAS = { 27: 76, 28: 39, 29: 73, 30: 74, 31: 37, 32: 37, 33: 76, 34: 75, 84: 81, 85: 76, 88: 42, 89: 46 };
  const KIT_PAN = { l: -0.35, c: 0, r: 0.35 };
  function buildDrum(key) {
    const d = KITDEF[key];
    const o = new Float32Array(Math.round(d[0] * BSR));
    d[3](o, rng(key * 2654435761));
    let pkv = 1e-9;
    for (let i = 0; i < o.length; i++) pkv = Math.max(pkv, Math.abs(o[i]));
    const g = d[1] / pkv, fo = Math.min(o.length, 640);
    for (let i = 0; i < o.length; i++) o[i] *= g;
    for (let i = 0; i < 16; i++) o[i] *= i / 16;                               // click-free start
    for (let i = 0; i < fo; i++) o[o.length - 1 - i] *= i / fo;               // and end
    return { data: o, grp: d[2], dur: d[0], choke: d[4] === 'choke', open: d[4] === 'open' };
  }

  const BANK = {};
  function mkBuffer(ac, data) {
    let b;
    try { b = new AudioBuffer({ length: data.length, sampleRate: BSR, numberOfChannels: 1 }); } catch (e) { b = ac.createBuffer(1, data.length, BSR); }
    if (b.copyToChannel) b.copyToChannel(data, 0); else b.getChannelData(0).set(data);
    return b;
  }
  const rootOf = (P, midi) => Math.max(P.lo || 24, Math.min(P.hi || 96, 12 * Math.round(midi / 12)));
  // Background warm-up: build the samples a track needs a few milliseconds at a time, so that
  // starting it later does not stall a frame. Anything not ready yet is simply built on demand.
  const warmQ = [];
  let warmTimer = null;
  function warm(ac, tr) {
    if (!tr || tr.warmed) return;
    tr.warmed = true;
    const seen = {};
    for (const e of tr.events) {
      if (e.k !== 'n') continue;
      for (const n of e.notes) {
        const key = e.P.kit ? 'd' + n : e.P.name + ':' + rootOf(e.P, n);
        if (!seen[key] && !BANK[key]) { seen[key] = 1; warmQ.push([e.P, n]); }
      }
    }
    const tick = () => {
      warmTimer = null;
      const t0 = performance.now();
      try {
        while (warmQ.length && performance.now() - t0 < 4) { const [P, n] = warmQ.shift(); if (P.kit) drumZone(ac, n); else zoneFor(ac, P, n); }
      } catch (e) { warmQ.length = 0; }
      if (warmQ.length) warmTimer = setTimeout(tick, 40);
    };
    if (!warmTimer && warmQ.length) warmTimer = setTimeout(tick, 40);
  }
  function zoneFor(ac, P, midi) {
    const root = rootOf(P, midi), key = P.name + ':' + root;
    let z = BANK[key];
    if (!z) { z = BANK[key] = buildZone(P, root); z.buf = mkBuffer(ac, z.data); }
    return z;
  }
  function drumZone(ac, key) {
    let k = KITDEF[key] ? key : DRUM_ALIAS[key];
    if (!k) { k = 37; let best = 99; for (const c of Object.keys(KITDEF)) { const dd = Math.abs(+c - key); if (dd < best) { best = dd; k = +c; } } }
    let z = BANK['d' + k];
    if (!z) { z = BANK['d' + k] = buildDrum(k); z.buf = mkBuffer(ac, z.data); }
    return z;
  }

  // ---------------------------------------------------------------------------
  // Voices: one BufferSource + one Gain per note (the SPC700 way)
  // ---------------------------------------------------------------------------
  function lfoFor(ac, bus, rate) {
    const m = bus.lfos || (bus.lfos = {});
    if (!m[rate]) { const o = ac.createOscillator(); o.frequency.value = rate; o.start(); m[rate] = o; }
    return m[rate];
  }
  // pitch-bend timeline (cents) -> automation on one note's detune param. ts/te = note span in song time.
  function applyBend(param, list, ts, te, base) {
    let i = 0;
    while (i < list.length && list[i].t <= ts) i++;
    const prev = i > 0 ? list[i - 1] : { t: 0, val: 0 };
    let v = prev.val;
    if (i < list.length && list[i].ramp) v = prev.val + ((list[i].val - prev.val) * (ts - prev.t)) / Math.max(1e-6, list[i].t - prev.t);
    if (v === 0 && (i >= list.length || list[i].t >= te)) return;
    param.setValueAtTime(v, base + ts);
    for (; i < list.length && list[i].t < te; i++) {
      const q = list[i];
      if (q.ramp) param.linearRampToValueAtTime(q.val, base + q.t); else param.setValueAtTime(q.val, base + q.t);
    }
  }
  function note(ac, S, strip, P, midi, t, dur, vel, e) {
    const z = zoneFor(ac, P, midi);
    const src = ac.createBufferSource();
    src.buffer = z.buf; src.loop = true; src.loopStart = z.ls; src.loopEnd = z.le;
    src.playbackRate.value = mtof(midi) / z.f0;
    const E = P.e || [0.005, 0.2, 0.8, 0.1];
    const a = Math.max(0.002, E[0]), dk = P.kd ? Math.pow(2, ((60 - midi) / 12) * P.kd) : 1;
    const d = Math.max(0.01, E[1] * dk), s = E[2], r = Math.max(0.012, E[3] * (s === 0 ? Math.min(1.6, Math.max(0.5, dk)) : 1));
    const peak = (P.vol != null ? P.vol : 1) * vel;
    const hold = P.ring ? Math.max(dur, 3.5 * d) : dur;
    const aEff = Math.min(a, Math.max(0.002, hold)), Pk = peak * Math.pow(aEff / a, 0.6);
    const g = ac.createGain(), gp = g.gain, tEnd = t + hold;
    gp.setValueAtTime(0, t);
    gp.linearRampToValueAtTime(Pk, t + aEff);
    let vEnd = Pk;
    if (hold > aEff) {
      gp.setTargetAtTime(peak * s, t + aEff, d);
      vEnd = peak * s + (Pk - peak * s) * Math.exp(-(hold - aEff) / d);
    }
    gp.setValueAtTime(vEnd, tEnd);
    gp.setTargetAtTime(0, tEnd, r);
    const tStop = tEnd + Math.min(4.6 * r, 5);
    gp.setValueAtTime(vEnd * Math.exp(-(tStop - tEnd) / r), tStop);
    gp.linearRampToValueAtTime(0, tStop + 0.012);
    const dt = src.detune;
    let dg = null;
    if (dt) {
      const bl = S.trk.bends[e.vn];
      if (bl) applyBend(dt, bl, e.t, e.t + (tStop - t), t - e.t);
      if (P.vib && dur > P.vib[2] + 0.14) {
        dg = ac.createGain();
        dg.gain.value = 0;
        dg.gain.setValueAtTime(0, t + P.vib[2]);
        dg.gain.linearRampToValueAtTime(P.vib[1], t + P.vib[2] + 0.22);
        lfoFor(ac, S.bus, P.vib[0]).connect(dg);
        dg.connect(dt);
      }
    }
    src.connect(g); g.connect(strip.inp);
    src.start(t); src.stop(tStop + 0.03);
    src.onended = () => { try { g.disconnect(); if (dg) dg.disconnect(); } catch (err) { /* ignore */ } };
  }
  function drumHit(ac, strip, key, t, vel) {
    const z = drumZone(ac, key);
    const src = ac.createBufferSource();
    src.buffer = z.buf;
    const g = ac.createGain();
    g.gain.value = vel;
    const kg = strip.kg || (strip.kg = {});
    let out = kg[z.grp];
    if (!out) {
      out = kg[z.grp] = ac.createGain();
      if (ac.createStereoPanner && KIT_PAN[z.grp]) { const p = ac.createStereoPanner(); p.pan.value = KIT_PAN[z.grp]; out.connect(p); p.connect(strip.inp); } else out.connect(strip.inp);
    }
    if (z.choke && strip.oh) { if (strip.oh.end > t) strip.oh.g.gain.setTargetAtTime(0, t, 0.012); strip.oh = null; }
    if (z.open) strip.oh = { g, end: t + z.dur };
    src.connect(g); g.connect(out);
    src.start(t);
    src.onended = () => { try { g.disconnect(); } catch (err) { /* ignore */ } };
  }
  function playEvent(ac, S, e, t) {
    const strip = S.strips[e.vn];
    if (!strip) return;
    if (e.pan != null && strip.pan && e.pan !== strip.curPan) { strip.pan.pan.setValueAtTime(Math.max(-1, Math.min(1, e.pan)), t); strip.curPan = e.pan; }
    if (e.P.kit) { for (const k of e.notes) drumHit(ac, strip, k, t, e.vel); return; }
    for (const n of e.notes) note(ac, S, strip, e.P, n, t, e.d, e.vel, e);
  }
  // expression (channel volume) automation: 'x' jumps, 'X' ramps from the previous point
  function ctlEvent(S, e, t) {
    const strip = S.strips[e.vn];
    if (!strip) return;
    const v = (strip.vol * e.val) / 100;
    if (e.ramp) strip.inp.gain.linearRampToValueAtTime(v, t); else strip.inp.gain.setValueAtTime(v, t);
  }

  // ---------------------------------------------------------------------------
  // Mixer graph
  // ---------------------------------------------------------------------------
  // SFX echo (mono feedback delay)
  function makeEcho(ac, dest, time, fb, wet) {
    const send = ac.createGain();
    const dl = ac.createDelay(2);
    dl.delayTime.value = time;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
    const fbg = ac.createGain(); fbg.gain.value = fb;
    const wg = ac.createGain(); wg.gain.value = wet;
    send.connect(dl); dl.connect(lp); lp.connect(hp); hp.connect(fbg); fbg.connect(dl);
    hp.connect(wg); wg.connect(dest);
    return send;
  }
  // Music echo, after the S-DSP: a stereo feedback delay with a low-pass in the loop. The two
  // sides feed each other a little (spread), so repeats drift across the image and thicken into a wash.
  function makeEchoStereo(ac, dest, ec) {
    const send = ac.createGain();
    send.channelCount = 2; send.channelCountMode = 'explicit';
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 170; hp.Q.value = 0.5;
    const sp = ac.createChannelSplitter(2), mg = ac.createChannelMerger(2);
    send.connect(hp); hp.connect(sp);
    const x = Math.max(0, Math.min(0.5, ec.spread * 0.5));
    const side = (ch, time) => {
      const d = ac.createDelay(2); d.delayTime.value = time;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = ec.lp; lp.Q.value = 0.5;
      const fb = ac.createGain(); fb.gain.value = ec.fb * (1 - x);
      const xf = ac.createGain(); xf.gain.value = ec.fb * x;
      sp.connect(d, ch); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(xf); lp.connect(mg, 0, ch);
      return { d, xf };
    };
    const L = side(0, ec.time), R = side(1, ec.time + 0.011);
    L.xf.connect(R.d); R.xf.connect(L.d);
    const wg = ac.createGain(); wg.gain.value = ec.wet;
    mg.connect(wg); wg.connect(dest);
    return send;
  }
  function softClipCurve() {
    const n = 4096, c = new Float32Array(n), k = 0.82, m = 0.985 - k;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
      c[i] = ax < k ? x : Math.sign(x) * (k + m * Math.tanh((ax - k) / m));
    }
    return c;
  }
  // music + sfx -> gentle limiter -> soft clip. With these settings the compressor node passes
  // everything below about -10 dBFS at a constant +2.5 dB (its built-in make-up gain), reaches
  // 0.84 for a full-scale input and the soft clip takes over above 0.82: nothing can hit 1.0.
  const LIM_COMP = 1;
  const MUSIC_TRIM = 1;       // overall music level into the mixer
  function buildMaster(ac, vols) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 8; comp.ratio.value = 8;
    comp.attack.value = 0.004; comp.release.value = 0.16;
    const clip = ac.createWaveShaper();
    clip.curve = softClipCurve();
    const out = ac.createGain(); out.gain.value = LIM_COMP;
    comp.connect(out); out.connect(clip); clip.connect(ac.destination);
    const music = ac.createGain(); music.gain.value = vols.music; music.connect(comp);
    const sfx = ac.createGain(); sfx.gain.value = vols.sfx; sfx.connect(comp);
    const sfxDry = ac.createGain(); sfxDry.connect(sfx);
    const sfxSend = makeEcho(ac, sfx, 0.16, 0.3, 0.35);
    return { comp, music, sfx, sfxBus: { dry: sfxDry, send: sfxSend } };
  }
  // per-track bus: strips -> dry / echo send -> out (fade) -> track gain -> music
  function makeTrackBus(ac, dest, tr) {
    const tg = ac.createGain(); tg.gain.value = tr.gain * MUSIC_TRIM; tg.connect(dest);
    const out = ac.createGain(); out.connect(tg);
    const dry = ac.createGain(); dry.connect(out);
    const send = makeEchoStereo(ac, out, tr.echo);
    return { out, dry, send, tg };
  }
  // one channel strip per voice: expression/volume -> pan -> dry + echo send
  function makeStrip(ac, bus, vd) {
    const inp = ac.createGain(); inp.gain.value = vd.vol;
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    const send = ac.createGain(); send.gain.value = vd.echo;
    if (pan) { pan.pan.value = Math.max(-1, Math.min(1, vd.pan)); inp.connect(pan); pan.connect(bus.dry); pan.connect(send); } else { inp.connect(bus.dry); inp.connect(send); }
    send.connect(bus.send);
    return { inp, pan, send, vol: vd.vol, curPan: vd.pan, kg: null, oh: null };
  }
  function closeBus(bus) {
    try { bus.tg.disconnect(); } catch (e) { /* ignore */ }
    for (const k of Object.keys(bus.lfos || {})) { try { bus.lfos[k].stop(); bus.lfos[k].disconnect(); } catch (e) { /* ignore */ } }
  }

  // ---------------------------------------------------------------------------
  // SFX
  // ---------------------------------------------------------------------------
  function sT(ac, S, t, o) {
    // tone: {w, f, f1, sweep, v, a, d, vib:[rate,cents], echo, lin}
    const osc = ac.createOscillator();
    setWave(ac, osc, o.w || 'sq50');
    const d = o.d || 0.1, a = o.a || 0.003, f1 = o.f1 != null ? o.f1 : o.f;
    osc.frequency.setValueAtTime(o.f, t);
    if (f1 !== o.f) {
      if (o.lin) osc.frequency.linearRampToValueAtTime(f1, t + (o.sweep || d));
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + (o.sweep || d));
    }
    if (o.f2 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + d);
    const g = ac.createGain();
    const v = o.v != null ? o.v : 0.2;
    if (o.rev) {
      g.gain.setValueAtTime(0.0005, t);
      g.gain.exponentialRampToValueAtTime(v, t + d - 0.02);
      g.gain.linearRampToValueAtTime(0, t + d);
    } else {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + a);
      g.gain.exponentialRampToValueAtTime(0.0005, t + d);
    }
    if (o.vib) {
      const l = ac.createOscillator(); l.frequency.value = o.vib[0];
      const lg = ac.createGain(); lg.gain.value = o.vib[1];
      l.connect(lg); lg.connect(osc.detune);
      l.start(t); l.stop(t + d + 0.05);
    }
    if (o.detune) osc.detune.value = o.detune;
    osc.connect(g);
    route(ac, g, S, o);
    osc.start(t); osc.stop(t + d + 0.05);
    return g;
  }
  function sN(ac, S, t, o) {
    // noise: {type, f, f1, q, v, a, d, echo, rev}
    const n = ac.createBufferSource();
    n.buffer = noiseBuf(ac); n.loop = true;
    const fl = ac.createBiquadFilter();
    fl.type = o.type || 'bandpass'; fl.Q.value = o.q || 1;
    const d = o.d || 0.2, a = o.a || 0.003;
    fl.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f1 != null) fl.frequency.exponentialRampToValueAtTime(o.f1, t + d);
    const g = ac.createGain();
    const v = o.v != null ? o.v : 0.3;
    if (o.rev) {
      g.gain.setValueAtTime(0.0005, t);
      g.gain.exponentialRampToValueAtTime(v, t + d - 0.02);
      g.gain.linearRampToValueAtTime(0, t + d);
    } else {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + a);
      g.gain.exponentialRampToValueAtTime(0.0005, t + d);
    }
    if (o.lfo) {
      const l = ac.createOscillator(); l.frequency.value = o.lfo[0];
      const lg = ac.createGain(); lg.gain.value = o.lfo[1];
      l.connect(lg); lg.connect(fl.frequency);
      l.start(t); l.stop(t + d + 0.05);
    }
    n.connect(fl); fl.connect(g);
    route(ac, g, S, o);
    n.start(t, Math.random() * 1.5); n.stop(t + d + 0.05);
    return g;
  }
  function route(ac, g, S, o) {
    busOut(ac, S, g, o.pan || 0, o.echo || 0);
  }
  function sBell(ac, S, t, f, parts, v, dec, echo) {
    for (const [ratio, amp, ds] of parts) {
      if (f * ratio > 15000) continue;
      sT(ac, S, t, { w: 'sine', f: f * ratio, v: v * amp, a: 0.002, d: dec * ds, echo });
    }
  }
  const TINE = [[1, 1, 1], [2, 0.3, 0.5], [4.1, 0.12, 0.2]];
  function crusher(ac, dest, levels) {
    const ws = ac.createWaveShaper();
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * levels) / levels; }
    ws.curve = c;
    ws.connect(dest);
    return ws;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  const SFX = {
    sfx_text_blip: (ac, S, t) => sT(ac, S, t, { w: 'sq50', f: 1320, v: 0.045, d: 0.028 }),
    sfx_menu_move: (ac, S, t) => sT(ac, S, t, { w: 'sq25', f: 1760, v: 0.07, d: 0.035 }),
    sfx_confirm: (ac, S, t) => {
      sT(ac, S, t, { w: 'sq25', f: 1318, v: 0.13, d: 0.06 });
      sT(ac, S, t + 0.06, { w: 'sq25', f: 1976, v: 0.13, d: 0.14, echo: 0.3 });
    },
    sfx_cancel: (ac, S, t) => {
      sT(ac, S, t, { w: 'sq25', f: 880, v: 0.13, d: 0.06 });
      sT(ac, S, t + 0.06, { w: 'sq25', f: 587, v: 0.13, d: 0.14 });
    },
    sfx_battle_start: (ac, S, t) => {
      sN(ac, S, t, { type: 'bandpass', f: 200, f1: 5000, q: 2, v: 0.35, a: 0.2, d: 0.5 });
      for (let i = 0; i < 8; i++) sT(ac, S, t + 0.25 + i * 0.035, { w: 'sq25', f: 2093 * Math.pow(2, -i / 3), v: 0.1, d: 0.07 });
      sT(ac, S, t + 0.55, { w: 'sine', f: 150, f1: 38, sweep: 0.3, v: 0.6, d: 0.5 });
      sN(ac, S, t + 0.55, { type: 'lowpass', f: 900, f1: 120, v: 0.35, d: 0.6 });
      sN(ac, S, t + 0.55, { type: 'highpass', f: 4000, v: 0.18, d: 1.1, echo: 0.3 });
    },
    sfx_sword_swing: (ac, S, t) => sN(ac, S, t, { type: 'bandpass', f: 3200, f1: 700, q: 1.2, v: 0.75, a: 0.03, d: 0.17 }),
    sfx_sword_hit: (ac, S, t) => {
      sN(ac, S, t, { type: 'bandpass', f: 2500, f1: 800, q: 0.8, v: 0.45, d: 0.13 });
      sT(ac, S, t, { w: 'sq50', f: 220, f1: 60, v: 0.22, d: 0.13 });
      sT(ac, S, t, { w: 'tri', f: 1250, f1: 900, v: 0.12, d: 0.07 });
    },
    sfx_crit: (ac, S, t) => {
      SFX.sfx_sword_hit(ac, S, t);
      SFX.sfx_sword_hit(ac, S, t + 0.07);
      sT(ac, S, t + 0.07, { w: 'sq25', f: 2093, v: 0.1, d: 0.45, vib: [18, 40], echo: 0.3 });
      sN(ac, S, t + 0.07, { type: 'highpass', f: 5000, v: 0.14, d: 0.5 });
    },
    sfx_lightning: (ac, S, t) => {
      for (let i = 0; i < 7; i++) sN(ac, S, t + i * rnd(0.02, 0.06), { type: 'highpass', f: 3000, v: rnd(0.2, 0.4), d: 0.05 });
      sT(ac, S, t, { w: 'sq50', f: 2500, f1: 140, v: 0.14, d: 0.45 });
      sN(ac, S, t + 0.05, { type: 'lowpass', f: 1800, f1: 200, v: 0.3, d: 0.5 });
    },
    sfx_thunder_big: (ac, S, t) => {
      SFX.sfx_lightning(ac, S, t);
      sN(ac, S, t + 0.08, { type: 'lowpass', f: 420, f1: 70, v: 0.6, a: 0.06, d: 2.2 });
      sT(ac, S, t + 0.08, { w: 'sine', f: 62, f1: 32, v: 0.5, a: 0.02, d: 1.6 });
    },
    sfx_water_splash: (ac, S, t) => {
      sN(ac, S, t, { type: 'bandpass', f: 2600, f1: 400, q: 0.8, v: 0.75, a: 0.01, d: 0.38 });
      for (let i = 0; i < 6; i++) { const f = rnd(420, 900); sT(ac, S, t + 0.1 + i * 0.05, { w: 'sine', f, f1: f * 1.8, v: 0.09, d: 0.06 }); }
    },
    sfx_heal_chime: (ac, S, t) => {
      [72, 76, 79, 84, 88].forEach((m, i) => sBell(ac, S, t + i * 0.07, mtof(m), TINE, 0.1, 0.7, 0.45));
    },
    sfx_tongue: (ac, S, t) => {
      sT(ac, S, t, { w: 'sine', f: 180, f1: 900, lin: 1, v: 0.35, d: 0.12 });
      sT(ac, S, t + 0.12, { w: 'sine', f: 900, f1: 300, v: 0.3, d: 0.1 });
      sN(ac, S, t, { type: 'bandpass', f: 1200, q: 2, v: 0.12, d: 0.16 });
    },
    sfx_kick: (ac, S, t) => {
      sT(ac, S, t, { w: 'sine', f: 160, f1: 45, v: 0.7, d: 0.2 });
      sN(ac, S, t, { type: 'lowpass', f: 1200, v: 0.35, d: 0.06 });
      sN(ac, S, t, { type: 'bandpass', f: 2200, q: 1, v: 0.2, d: 0.05 });
    },
    sfx_spin: (ac, S, t) => {
      sN(ac, S, t, { type: 'bandpass', f: 1000, q: 2, v: 0.7, a: 0.05, d: 0.6, lfo: [11, 700] });
      sT(ac, S, t, { w: 'sq25', f: 500, v: 0.12, a: 0.05, d: 0.55, vib: [11, 600] });
    },
    sfx_fire: (ac, S, t) => {
      sN(ac, S, t, { type: 'lowpass', f: 500, f1: 3200, q: 1.5, v: 0.4, a: 0.1, d: 0.65, lfo: [7, 300] });
      for (let i = 0; i < 10; i++) sN(ac, S, t + rnd(0, 0.55), { type: 'highpass', f: 2500, v: rnd(0.08, 0.2), d: 0.02 });
    },
    sfx_ice_crack: (ac, S, t) => {
      for (let i = 0; i < 6; i++) sN(ac, S, t + rnd(0, 0.22), { type: 'highpass', f: 4000, v: rnd(0.15, 0.3), d: 0.025 });
      for (let i = 0; i < 4; i++) sBell(ac, S, t + 0.05 + i * 0.06, 3600 - i * 450, [[1, 1, 1], [2.76, 0.4, 0.4]], 0.08, 0.35, 0.3);
      sT(ac, S, t, { w: 'tri', f: 1800, f1: 600, v: 0.1, d: 0.2 });
    },
    sfx_dark_bomb: (ac, S, t) => {
      sT(ac, S, t, { w: 'sine', f: 140, f1: 28, v: 0.7, d: 1.1 });
      sN(ac, S, t, { type: 'lowpass', f: 900, f1: 90, v: 0.5, d: 1.2 });
      sT(ac, S, t, { w: 'saw', f: 300, f1: 55, v: 0.1, d: 0.8 });
    },
    sfx_dark_mist: (ac, S, t) => {
      sN(ac, S, t, { type: 'bandpass', f: 500, q: 2, v: 0.7, a: 0.4, d: 1.4, lfo: [3, 250] });
      sT(ac, S, t, { w: 'saw', f: 110, v: 0.06, a: 0.4, d: 1.3 });
      sT(ac, S, t, { w: 'saw', f: 116.5, v: 0.06, a: 0.4, d: 1.3 });
    },
    sfx_black_hole: (ac, S, t) => {
      sT(ac, S, t, { w: 'saw', f: 900, f1: 40, v: 0.12, d: 1.6, vib: [6, 80] });
      sN(ac, S, t, { type: 'lowpass', f: 3000, f1: 60, q: 3, v: 0.4, d: 1.6 });
      sT(ac, S, t, { w: 'sine', f: 60, f1: 25, v: 0.45, a: 0.3, d: 1.6 });
    },
    sfx_ko: (ac, S, t) => {
      sT(ac, S, t, { w: 'sq50', f: 880, f1: 110, v: 0.18, d: 0.55, vib: [14, 60] });
      sT(ac, S, t + 0.45, { w: 'sine', f: 90, f1: 40, v: 0.4, d: 0.22 });
    },
    sfx_level_up: (ac, S, t) => {
      [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => sT(ac, S, t + i * 0.055, { w: 'sq25', f: mtof(m), v: 0.1, d: 0.1 }));
      [84, 88, 91].forEach((m) => sT(ac, S, t + 0.42, { w: 'tri', f: mtof(m), v: 0.14, a: 0.01, d: 0.7, echo: 0.35 }));
    },
    sfx_item_get: (ac, S, t) => {
      [79, 84, 88].forEach((m, i) => { sT(ac, S, t + i * 0.08, { w: 'sq25', f: mtof(m), v: 0.1, d: 0.09 }); });
      sT(ac, S, t + 0.24, { w: 'sq25', f: mtof(91), v: 0.1, d: 0.5, vib: [6, 12], echo: 0.3 });
      sT(ac, S, t + 0.24, { w: 'tri', f: mtof(79), v: 0.15, d: 0.5 });
    },
    sfx_gate_open: (ac, S, t) => {
      sT(ac, S, t, { w: 'sq25', f: 180, f1: 1400, v: 0.2, a: 0.1, d: 1.1, vib: [9, 60], echo: 0.3 });
      sN(ac, S, t, { type: 'bandpass', f: 400, f1: 3000, q: 1.2, v: 0.5, a: 0.5, d: 1.2 });
      for (let i = 0; i < 6; i++) sBell(ac, S, t + 0.5 + i * 0.1, 1200 + i * 300, [[1, 1, 1], [3.5, 0.3, 0.4]], 0.05, 0.4, 0.4);
    },
    sfx_gate_close: (ac, S, t) => {
      sT(ac, S, t, { w: 'sq25', f: 1400, f1: 150, v: 0.13, d: 0.9, vib: [9, 60] });
      sN(ac, S, t, { type: 'bandpass', f: 3000, f1: 300, q: 1.5, v: 0.25, d: 0.9 });
      sT(ac, S, t + 0.85, { w: 'sine', f: 100, f1: 40, v: 0.45, d: 0.25 });
    },
    // the gate sound, bit-crushed and reversed: it swells in, pitch falls, then cuts dead
    sfx_hollow_gate: (ac, S, t) => {
      const cr = crusher(ac, S.dry, 5);
      const R = { dry: cr, send: S.send };
      sT(ac, R, t, { w: 'sq25', f: 1400, f1: 160, v: 0.2, d: 1.2, vib: [9, 60], rev: 1, echo: 0.3 });
      sN(ac, R, t, { type: 'bandpass', f: 3000, f1: 400, q: 1.5, v: 0.3, d: 1.2, rev: 1 });
      sT(ac, R, t, { w: 'sq50', f: 55, v: 0.12, d: 1.2, rev: 1 });
    },
    sfx_seed_pulse: (ac, S, t) => {
      sT(ac, S, t, { w: 'sine', f: 62, f1: 42, v: 0.7, d: 0.2 });
      sT(ac, S, t + 0.22, { w: 'sine', f: 56, f1: 40, v: 0.5, d: 0.22 });
      sN(ac, S, t, { type: 'lowpass', f: 220, v: 0.2, d: 0.12 });
    },
    sfx_seed_hatch: (ac, S, t) => {
      for (let i = 0; i < 3; i++) sN(ac, S, t + i * 0.04, { type: 'highpass', f: 2500, v: 0.35, d: 0.04 });
      sN(ac, S, t + 0.1, { type: 'bandpass', f: 800, f1: 300, q: 4, v: 0.35, d: 0.3 });
      [0.25, 0.35, 0.45].forEach((dt, i) => sT(ac, S, t + dt, { w: 'sq25', f: 600 + i * 150, f1: 1400 + i * 200, v: 0.1, d: 0.08 }));
    },
    sfx_porcelain_step: (ac, S, t) => {
      sT(ac, S, t, { w: 'sine', f: 2600, v: 0.2, d: 0.08 });
      sT(ac, S, t, { w: 'sine', f: 7176, v: 0.05, d: 0.05 });
      sN(ac, S, t, { type: 'highpass', f: 5000, v: 0.08, d: 0.02 });
    },
    sfx_glass_shatter: (ac, S, t) => {
      sN(ac, S, t, { type: 'highpass', f: 3000, v: 0.35, d: 0.6 });
      for (let i = 0; i < 14; i++) sT(ac, S, t + rnd(0, 0.4), { w: 'sine', f: rnd(2500, 6000), v: 0.06, d: rnd(0.15, 0.3), echo: 0.2 });
      sT(ac, S, t, { w: 'tri', f: 900, f1: 300, v: 0.12, d: 0.12 });
    },
    sfx_epoch_fly: (ac, S, t) => {
      sT(ac, S, t, { w: 'saw', f: 70, f1: 95, v: 0.1, a: 0.3, d: 1.5 });
      sT(ac, S, t, { w: 'saw', f: 70.8, f1: 96, v: 0.1, a: 0.3, d: 1.5 });
      sN(ac, S, t, { type: 'bandpass', f: 300, f1: 2400, q: 1.2, v: 0.55, a: 0.6, d: 1.5 });
    },
    // church bell: strongly inharmonic partial set (hum, prime, minor tierce, quint, nominal...)
    sfx_leene_bell: (ac, S, t) => {
      sBell(ac, S, t, 392, [[0.5, 0.5, 1.2], [1, 1, 1], [1.19, 0.55, 0.75], [1.5, 0.4, 0.6], [2, 0.5, 0.55], [2.51, 0.25, 0.4],
        [2.66, 0.2, 0.35], [3.01, 0.18, 0.3], [4.07, 0.12, 0.2], [5.2, 0.08, 0.14]], 0.16, 3.2, 0.4);
    },
    sfx_save: (ac, S, t) => {
      [79, 84, 88, 91, 96].forEach((m, i) => sBell(ac, S, t + i * 0.06, mtof(m), TINE, 0.08, 0.6, 0.4));
      [72, 76, 79].forEach((m) => sT(ac, S, t + 0.3, { w: 'tri', f: mtof(m), v: 0.07, a: 0.05, d: 0.9, echo: 0.3 }));
    },
    sfx_curator_speak: (ac, S, t) => {
      sBell(ac, S, t, 1318.5, [[1, 1, 1], [2, 0.2, 0.5], [3.5, 0.06, 0.2]], 0.07, 0.6, 0.45);
      sBell(ac, S, t + 0.14, 987.8, [[1, 1, 1], [2, 0.2, 0.5], [3.5, 0.06, 0.2]], 0.065, 0.8, 0.45);
    },
    sfx_scanline: (ac, S, t) => {
      sT(ac, S, t, { w: 'sine', f: 1800, f1: 5200, v: 0.08, d: 0.32 });
      sT(ac, S, t, { w: 'sq12', f: 120, v: 0.04, d: 0.3 });
      sN(ac, S, t, { type: 'highpass', f: 6000, v: 0.04, d: 0.3 });
    },
    sfx_core_scream: (ac, S, t) => {
      for (const dt of [-25, 25]) {
        sT(ac, S, t, { w: 'saw', f: 180, f1: 620, sweep: 0.55, f2: 240, v: 0.2, a: 0.08, d: 1.5, vib: [8, 70], detune: dt, echo: 0.3 });
      }
      sT(ac, S, t, { w: 'sq25', f: 360, f1: 1240, sweep: 0.55, f2: 480, v: 0.09, a: 0.08, d: 1.5, vib: [8, 70] });
      sN(ac, S, t, { type: 'bandpass', f: 1500, q: 2, v: 0.14, a: 0.1, d: 1.4 });
    },
    sfx_step: (ac, S, t) => {
      sN(ac, S, t, { type: 'lowpass', f: 500, v: 0.35, d: 0.06 });
      sT(ac, S, t, { w: 'sine', f: 110, f1: 70, v: 0.3, d: 0.05 });
    },
    sfx_miss: (ac, S, t) => {
      sN(ac, S, t, { type: 'bandpass', f: 1800, f1: 600, q: 1, v: 0.5, a: 0.03, d: 0.18 });
      sT(ac, S, t + 0.03, { w: 'sine', f: 700, f1: 300, v: 0.1, d: 0.2 });
    },
    sfx_buy: (ac, S, t) => {
      sT(ac, S, t, { w: 'sq25', f: 987.8, v: 0.13, d: 0.07 });
      sT(ac, S, t + 0.07, { w: 'sq25', f: 1318.5, v: 0.13, d: 0.3, echo: 0.25 });
    },
    sfx_door: (ac, S, t) => {
      sT(ac, S, t, { w: 'saw', f: 90, f1: 118, v: 0.08, a: 0.03, d: 0.35, vib: [22, 80] });
      sT(ac, S, t + 0.35, { w: 'sine', f: 110, f1: 50, v: 0.45, d: 0.2 });
      sN(ac, S, t + 0.35, { type: 'lowpass', f: 400, v: 0.28, d: 0.1 });
    },
    // ---- Game-feel beats (js/feel.js, battle staging). Short, dry and well under the music. ----
    // A blow that glances off armour or a resistance: a dull metallic clank.
    sfx_clank: (ac, S, t) => {
      sT(ac, S, t, { w: 'sq25', f: 620, f1: 540, v: 0.12, d: 0.07 });
      sT(ac, S, t, { w: 'tri', f: 1240, f1: 1160, v: 0.1, d: 0.12, echo: 0.15 });
      sN(ac, S, t, { type: 'bandpass', f: 3800, q: 3, v: 0.22, d: 0.05 });
    },
    // Struck on a weakness: two rising chimes over the hit.
    sfx_weak: (ac, S, t) => {
      sT(ac, S, t, { w: 'sq25', f: 1568, v: 0.09, d: 0.06 });
      sT(ac, S, t + 0.05, { w: 'sq25', f: 2349, v: 0.1, d: 0.16, echo: 0.25 });
    },
    // Turn start: a soft tick for the party, a lower one for the enemy.
    sfx_turn: (ac, S, t) => {
      sT(ac, S, t, { w: 'tri', f: 1047, v: 0.1, d: 0.05 });
      sT(ac, S, t + 0.045, { w: 'tri', f: 1568, v: 0.1, d: 0.12, echo: 0.2 });
    },
    sfx_turn_foe: (ac, S, t) => {
      sT(ac, S, t, { w: 'tri', f: 392, v: 0.11, d: 0.06 });
      sT(ac, S, t + 0.05, { w: 'tri', f: 311, v: 0.11, d: 0.14 });
    },
    // The archive files a creature away: paper hiss under a falling glassy arpeggio.
    sfx_archive: (ac, S, t) => {
      sN(ac, S, t, { type: 'highpass', f: 5200, v: 0.14, a: 0.02, d: 0.55 });
      for (let i = 0; i < 6; i++) sT(ac, S, t + i * 0.07, { w: 'sq25', f: 1976 * Math.pow(2, -i / 4), v: 0.06, d: 0.09, echo: 0.2 });
      sT(ac, S, t + 0.45, { w: 'sine', f: 196, f1: 98, v: 0.2, d: 0.25 });
    },
    // An echo loses its signal: a set being switched off.
    sfx_echo_out: (ac, S, t) => {
      sN(ac, S, t, { type: 'bandpass', f: 2600, f1: 500, q: 2, v: 0.2, d: 0.22 });
      sT(ac, S, t, { w: 'saw', f: 880, f1: 55, sweep: 0.3, v: 0.12, d: 0.32 });
      sT(ac, S, t + 0.34, { w: 'sine', f: 3136, v: 0.08, d: 0.14, echo: 0.3 });
    },
    // A boss falls: a long growl that drops away; `sfx_boss_pop` are the small bursts over it.
    sfx_boss_die: (ac, S, t) => {
      for (const dt of [-18, 18]) sT(ac, S, t, { w: 'saw', f: 220, f1: 52, sweep: 1.3, v: 0.15, a: 0.03, d: 1.5, vib: [11, 60], detune: dt });
      sN(ac, S, t, { type: 'lowpass', f: 900, f1: 160, v: 0.28, a: 0.05, d: 1.4 });
    },
    sfx_boss_pop: (ac, S, t) => {
      sN(ac, S, t, { type: 'lowpass', f: rnd(900, 1800), f1: 200, v: 0.34, d: 0.16 });
      sT(ac, S, t, { w: 'sine', f: rnd(170, 240), f1: 60, v: 0.34, d: 0.14 });
    },
    // Feet coming down after a hop; a step through shallow water.
    sfx_land: (ac, S, t) => {
      sN(ac, S, t, { type: 'lowpass', f: 420, v: 0.38, d: 0.08 });
      sT(ac, S, t, { w: 'sine', f: 96, f1: 52, v: 0.4, d: 0.09 });
    },
    sfx_step_water: (ac, S, t) => {
      sN(ac, S, t, { type: 'bandpass', f: rnd(1600, 2400), f1: 700, q: 1.5, v: 0.22, a: 0.01, d: 0.14 });
      sT(ac, S, t + 0.02, { w: 'sine', f: rnd(520, 700), f1: 1100, sweep: 0.06, v: 0.06, d: 0.07 });
    },
    // Magic gathering before a spell (and a softer one for healing).
    sfx_charge: (ac, S, t) => {
      sT(ac, S, t, { w: 'tri', f: 196, f1: 784, sweep: 0.5, v: 0.1, a: 0.08, d: 0.52, vib: [14, 40] });
      sN(ac, S, t, { type: 'bandpass', f: 600, f1: 4200, q: 4, v: 0.08, a: 0.2, d: 0.52 });
    },
    sfx_charge_soft: (ac, S, t) => {
      for (let i = 0; i < 4; i++) sT(ac, S, t + i * 0.11, { w: 'sine', f: 784 * Math.pow(2, i / 6), v: 0.07, d: 0.18, echo: 0.3 });
    },
    // Objective card, counting ticks, a tech learned, the victory sparkle (sits over the fanfare).
    sfx_card: (ac, S, t) => {
      sN(ac, S, t, { type: 'bandpass', f: 400, f1: 3000, q: 2, v: 0.16, a: 0.08, d: 0.24 });
      sT(ac, S, t + 0.22, { w: 'sq25', f: 784, v: 0.1, d: 0.07 });
      sT(ac, S, t + 0.29, { w: 'sq25', f: 1175, v: 0.1, d: 0.22, echo: 0.3 });
    },
    sfx_tick: (ac, S, t) => sT(ac, S, t, { w: 'sq25', f: 2093, v: 0.045, d: 0.025 }),
    sfx_learn: (ac, S, t) => {
      for (let i = 0; i < 5; i++) sT(ac, S, t + i * 0.06, { w: 'sq25', f: 1047 * Math.pow(2, [0, 4, 7, 12, 16][i] / 12), v: 0.1, d: 0.12, echo: 0.3 });
      sBell(ac, S, t + 0.32, 2093, TINE, 0.1, 0.9, 0.35);
    },
    sfx_victory: (ac, S, t) => {
      for (let i = 0; i < 7; i++) sT(ac, S, t + i * 0.045, { w: 'sine', f: 1568 * Math.pow(2, i / 6), v: 0.05, d: 0.1, echo: 0.3 });
    },
    // An interactive spot fires: a bright strike with a low body.
    sfx_spot: (ac, S, t) => {
      sT(ac, S, t, { w: 'sq25', f: 523, f1: 1047, sweep: 0.08, v: 0.12, d: 0.12 });
      sBell(ac, S, t + 0.07, 1568, TINE, 0.12, 0.7, 0.3);
      sT(ac, S, t, { w: 'sine', f: 130, f1: 65, v: 0.3, d: 0.16 });
    },
    // Time travel: the picture ripples away in a rising, wobbling tone.
    sfx_warp: (ac, S, t) => {
      for (const dt of [-12, 12]) sT(ac, S, t, { w: 'tri', f: 220, f1: 1320, sweep: 0.9, v: 0.09, a: 0.1, d: 1.0, vib: [9, 90], detune: dt, echo: 0.3 });
      sN(ac, S, t, { type: 'bandpass', f: 500, f1: 5000, q: 5, v: 0.08, a: 0.3, d: 0.95, lfo: [12, 600] });
    },
    // Heavy magic landing: a low thud under the element's own sound.
    sfx_impact: (ac, S, t) => {
      sT(ac, S, t, { w: 'sine', f: 140, f1: 36, sweep: 0.2, v: 0.5, d: 0.3 });
      sN(ac, S, t, { type: 'lowpass', f: 700, f1: 120, v: 0.3, d: 0.25 });
    },
  };

  // ---------------------------------------------------------------------------
  // Runtime state & scheduler
  // ---------------------------------------------------------------------------
  const st = {
    ac: null, master: null, unlocked: false, timer: null,
    current: null, pending: null, song: null,
    memo: null,             // {id, pos, at}: the field track a battle / jingle interrupted
    warmed: false,
    vol: { music: DEFAULT_VOL.music, sfx: DEFAULT_VOL.sfx },
    lastBlip: 0,
  };
  const XFADE = 350;        // ms: default fade-out of the old track when the game switches music
  const RESUME_FADE = 900;  // ms: fade-in when a field track picks up where it was interrupted

  function scheduleSong(ac, S, horizon, now) {
    const tr = S.trk, evs = tr.events;
    let guard = 0;
    while (!S.done && guard++ < 8000) {
      if (S.idx >= evs.length) {
        const loopLen = tr.len - tr.loopStart;
        if (tr.oneShot || tr.loopIdx >= evs.length || loopLen <= 0.05 || (tr.maxLoops && S.pass + 1 >= tr.maxLoops)) {
          S.done = true; S.endAt = S.t0 + S.off + tr.len;
          break;
        }
        S.idx = tr.loopIdx;
        S.off += loopLen;
        S.pass++;
        continue;
      }
      const e = evs[S.idx];
      if (e.wrapOnly && !S.pass) { S.idx++; continue; }
      const at = S.t0 + S.off + e.t;
      if (at > horizon) break;
      if (!S.only || S.only[e.vn]) {
        if (e.k !== 'n') ctlEvent(S, e, Math.max(at, now));
        else if (at >= now - 0.03) playEvent(ac, S, e, Math.max(at, now));
      }
      S.idx++;
    }
  }
  // where in the track the song is at context time `now` (loop-aware)
  function songPos(S, now) {
    const tr = S.trk, ll = tr.len - tr.loopStart;
    let p = now - S.t0;
    if (p <= 0) return 0;
    if (p > tr.len) {
      if (tr.oneShot || ll <= 0.05) return tr.len;
      p = tr.loopStart + ((p - tr.loopStart) % ll);
    }
    return p;
  }
  function makeSong(ac, dest, tr, t0, pos, only) {
    const bus = makeTrackBus(ac, dest, tr);
    const S = { trk: tr, bus, t0, idx: 0, off: 0, pass: 0, done: false, endAt: 0, strips: {}, only: null };
    for (const vn of Object.keys(tr.vdef)) S.strips[vn] = makeStrip(ac, bus, tr.vdef[vn]);
    if (only) { S.only = {}; for (const n of only) S.only[n] = 1; }
    // start after the leading rest (def.skip), or resume on the bar line at or before `pos`
    // with the channel volumes that were in force there
    const pb = pos > 0 ? tr.barAt(Math.min(pos, tr.len - 0.01)) : tr.skip;
    if (pb > 0) {
      S.t0 = t0 - pb;
      const last = {};
      while (S.idx < tr.events.length && tr.events[S.idx].t < pb - 1e-6) {
        const e = tr.events[S.idx++];
        if (e.k === 'x' && !e.wrapOnly) last[e.vn] = e.val;
      }
      for (const vn of Object.keys(last)) if (S.strips[vn]) S.strips[vn].inp.gain.value = (S.strips[vn].vol * last[vn]) / 100;
    }
    return S;
  }
  function pump() {
    try {
      const ac = st.ac, S = st.song;
      if (!ac || !S) return;
      const now = ac.currentTime;
      const hidden = typeof document !== 'undefined' && document.hidden;
      scheduleSong(ac, S, now + (hidden ? 1.5 : 0.22), now);
      if (!S.done) return;
      // a finished jingle hands back to the field track it interrupted
      if (S.trk.kind === 'jingle' && st.memo && st.current === S.trk.id && now > S.endAt + 0.5) {
        const m = st.memo;
        st.memo = null;
        st.current = m.id;
        startSong(m.id, RESUME_FADE, m.pos, 1200);
        return;
      }
      if (now > S.endAt + 3) {
        if (st.current === S.trk.id) st.current = null;
        closeBus(S.bus);
        st.song = null;
      }
    } catch (e) { /* never throw from the scheduler */ }
  }
  function fadeOutSong(S, ms) {
    const ac = st.ac;
    if (!S || !ac) return;
    const now = ac.currentTime, dur = Math.max(0.03, (ms || 0) / 1000);
    const g = S.bus.out.gain;
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + dur);
    } catch (e) { /* ignore */ }
    S.done = true;
    setTimeout(() => closeBus(S.bus), dur * 1000 + 400);
  }
  // fadeMs: fade-in of the new track; pos: resume position (s); outMs: fade-out of the old track
  function startSong(id, fadeMs, pos, outMs) {
    const ac = st.ac;
    const tr = compile(id);
    if (!ac || !st.master || !tr) return;
    if (st.song) { fadeOutSong(st.song, outMs != null ? outMs : Math.max(fadeMs || 0, tr.kind === 'jingle' ? 120 : XFADE)); st.song = null; }
    const t0 = ac.currentTime + 0.06;
    const S = makeSong(ac, st.master.music, tr, t0, pos || 0, null);
    if (fadeMs > 0) {
      S.bus.out.gain.setValueAtTime(0, t0);
      S.bus.out.gain.linearRampToValueAtTime(1, t0 + fadeMs / 1000);
    }
    st.song = S;
    pump();
    warm(ac, tr);
  }

  function unlock() {
    try {
      if (!st.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        st.ac = new AC();
        st.master = buildMaster(st.ac, st.vol);
      }
      if (st.ac.state === 'suspended' && st.ac.resume) {
        const p = st.ac.resume();
        if (p && p.catch) p.catch(() => {});
      }
      st.unlocked = true;
      if (!st.timer) st.timer = setInterval(pump, 25);
      if (st.pending) {
        const id = st.pending;
        st.pending = null;
        startSong(id, 0);
      }
      // then get every other track ready in the background, a few ms at a time
      if (!st.warmed) {
        st.warmed = true;
        let i = 0;
        const next = () => {
          if (i >= TRACK_IDS.length) return;
          try { warm(st.ac, compile(TRACK_IDS[i++])); } catch (e) { /* ignore */ }
          setTimeout(next, 300);
        };
        setTimeout(next, 1500);
      }
    } catch (e) { /* audio unavailable: stay silent */ }
  }
  const kindOf = (id) => (DEFS[id] && DEFS[id].kind) || 'field';
  function playMusic(id, opts) {
    try {
      if (!DEFS[id] && id !== 'mus_credits') return;
      if (id === st.current && (st.song || st.pending === id)) return;
      const fade = opts && opts.fade ? +opts.fade : 0;
      const kNew = kindOf(id), cur = st.song && !st.song.done ? st.song : null;
      // Like the SNES game: a battle (and its fanfare) interrupts the field music, which then
      // picks up where it left off instead of starting over.
      if (cur && cur.trk.id !== id && kNew !== 'field' && cur.trk.kind === 'field' && !cur.trk.oneShot) {
        st.memo = { id: cur.trk.id, pos: songPos(cur, st.ac.currentTime), at: Date.now() };
      }
      let pos = 0;
      if (kNew === 'field') {
        const m = st.memo;
        if (m && m.id === id && Date.now() - m.at < 15 * 60000 && !(opts && opts.restart)) pos = m.pos;
        st.memo = null;
      }
      st.current = id;
      if (!st.ac || !st.unlocked) { st.pending = id; return; }
      if (pos > 0) startSong(id, Math.max(fade, RESUME_FADE), pos);
      else startSong(id, fade);
    } catch (e) { /* ignore */ }
  }
  function stopMusic(fadeMs) {
    try {
      st.pending = null;
      st.current = null;
      // silence after a lost battle keeps the memory (the retry starts the battle music again);
      // any other explicit stop means the scene wants silence, so nothing should resume by itself
      if (!(st.song && st.song.trk.kind === 'battle')) st.memo = null;
      if (st.song) { fadeOutSong(st.song, fadeMs || 0); st.song = null; }
    } catch (e) { /* ignore */ }
  }
  function sfx(id) {
    try {
      const fn = SFX[id];
      if (!fn || !st.ac || !st.unlocked || !st.master) return;
      const now = st.ac.currentTime;
      if (id === 'sfx_text_blip') {
        if (now - st.lastBlip < 0.03) return;
        st.lastBlip = now;
      }
      fn(st.ac, st.master.sfxBus, now + 0.005);
    } catch (e) { /* ignore */ }
  }
  function setVolume(v) {
    try {
      if (!v) return;
      const c = (x) => Math.max(0, Math.min(1, +x));
      if (v.music != null && !isNaN(+v.music)) st.vol.music = c(v.music);
      if (v.sfx != null && !isNaN(+v.sfx)) st.vol.sfx = c(v.sfx);
      if (st.ac && st.master) {
        const now = st.ac.currentTime;
        st.master.music.gain.setTargetAtTime(st.vol.music, now, 0.03);
        st.master.sfx.gain.setTargetAtTime(st.vol.sfx, now, 0.03);
      }
    } catch (e) { /* ignore */ }
  }

  // Offline render (dev/test helper): Promise<AudioBuffer|null>. `only` = voice names to solo.
  // opts: {pos: resume position in s, sfxAt: [[id, t], ...] to mix SFX over the music, sr}
  // Notes are scheduled in 0.25 s chunks exactly like the live pump, so the render cost is the live cost.
  function renderOffline(id, seconds, only, opts) {
    try {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const isSfx = !!SFX[id];
      const tr = isSfx ? null : compile(id);
      if (!OAC || (!isSfx && !tr)) return Promise.resolve(null);
      if (seconds == null) seconds = isSfx ? 3 : tr.oneShot ? tr.len + 3 : tr.len + 1;
      const o = opts || {};
      const sr = o.sr || 44100;
      const ac = new OAC(2, Math.max(1, Math.ceil(sr * seconds)), sr);
      const M = buildMaster(ac, st.vol);
      if (isSfx) SFX[id](ac, M.sfxBus, 0.02);
      else {
        const S = makeSong(ac, M.music, tr, 0.02, o.pos || 0, only);
        for (const [sid, t] of o.sfxAt || []) if (SFX[sid]) SFX[sid](ac, M.sfxBus, t);
        const step = 0.25;
        scheduleSong(ac, S, step + 0.05, 0);
        if (ac.suspend) {
          for (let t = step; t < seconds; t += step) ac.suspend(t).then(() => { scheduleSong(ac, S, t + step + 0.05, t); ac.resume(); }).catch(() => {});
        } else scheduleSong(ac, S, seconds, 0);
      }
      return ac.startRendering();
    } catch (e) {
      return Promise.resolve(null);
    }
  }
  function info(id) {
    const tr = compile(id);
    if (!tr) return null;
    return {
      id, bpm: tr.bpm, meter: tr.meter, bars: tr.bars, barSec: tr.barSec, len: tr.len, loopStart: tr.loopStart,
      oneShot: tr.oneShot, voices: tr.voices, events: tr.events.length, lens: tr.lens, expectTicks: tr.expectTicks,
      kind: tr.kind, lead: tr.lead, maxLoops: tr.maxLoops, skip: tr.skip,
    };
  }

  // Register / replace a track def at load time (e.g. js/music_ct.js). The credits medley is
  // rebuilt from its segments, so it is invalidated too.
  function define(id, def) {
    if (!id || !def || !def.v) return;
    DEFS[id] = def;
    delete compiled[id];
    delete compiled.mus_credits;
    if (TRACK_IDS.indexOf(id) < 0) TRACK_IDS.push(id);
  }
  const api = {
    unlock, playMusic, stopMusic, sfx, setVolume, define,
    tracks: () => TRACK_IDS.slice(),
    sfxList: () => Object.keys(SFX),
    _renderOffline: renderOffline,
    _info: info,
    _gen: { arp, bass, pad, parseMML, parseDrums },
    // test hooks
    _patches: () => Object.keys(PATCH),
    _zone: (name, midi) => { const P = patchOf(name); return P.kit ? buildDrum(KITDEF[midi] ? midi : 38) : buildZone(P, rootOf(P, midi)); },
    _state: () => ({ current: st.current, memo: st.memo && Object.assign({}, st.memo), playing: st.song ? st.song.trk.id : null, pos: st.song && st.ac ? songPos(st.song, st.ac.currentTime) : 0 }),
  };
  Object.defineProperty(api, 'current', { get: () => st.current, enumerable: true });
  Object.defineProperty(api, 'volume', { get: () => ({ music: st.vol.music, sfx: st.vol.sfx }), enumerable: false });
  CT.audio = api;
})();
