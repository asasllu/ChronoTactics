// audio.js — CT.audio: live-synthesized SNES-style chiptune music + SFX (see docs/ENGINE_SPEC.md §4).
// No audio files: every sound is built from WebAudio oscillators / noise at runtime.
//
// NOTE FORMAT (MML-style, one string per channel; ≤ 8 channels per track):
//   o4 octave · > < octave up/down · l8 default length · c d e f g a b notes (+/# sharp, - flat)
//   length = note value (4 quarter, 8 eighth, 12 triplet-eighth, 2. dotted half) or %ticks (48/quarter)
//   r rest · ^ tie · (c e g) chord · n60 raw MIDI · v0-15 velocity · k±n transpose · q1-8 gate
//   p±n pan · @inst switch instrument · [ ... ]n repeat · $NAME macro · | and spaces ignored.
//   Drum channels ('kit') are step strings: l16 sets the step, k kick s snare h hat o open-hat c crash
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
  // type: osc (default) | fm | add (additive partials [ratio, amp, decayScale]) | noise (band-passed)
  const INST = {
    lead: { w: 'sq25', a: 0.01, d: 0.15, s: 0.7, r: 0.12, vol: 0.12, vib: [5.5, 14, 0.18], echo: 0.25 },
    sq12: { w: 'sq12', a: 0.004, d: 0.1, s: 0.45, r: 0.06, vol: 0.07, echo: 0.2 },
    brass: { w: 'saw', layers: [-5, 5], a: 0.035, d: 0.25, s: 0.72, r: 0.1, vol: 0.11, lp: 1900, lpEnv: [500, 3400, 0.06, 0.2], q: 1.5, vib: [5.5, 12, 0.25], glide: [-0.35, 0.05], echo: 0.18 },
    horn: { w: 'saw', layers: [-4, 4], a: 0.07, d: 0.3, s: 0.8, r: 0.2, vol: 0.1, lp: 1100, lpEnv: [300, 1600, 0.1, 0.25], vib: [5, 8, 0.3], echo: 0.25 },
    strings: { w: 'saw', layers: [-9, 0, 9], a: 0.13, d: 0.3, s: 0.9, r: 0.35, vol: 0.07, lp: 2600, vib: [5.2, 14, 0.3], echo: 0.3 },
    choir: { w: 'saw', layers: [-12, -3, 7, 14], a: 0.45, d: 0.5, s: 0.9, r: 0.9, vol: 0.036, lp: 1300, q: 3, vib: [4.6, 10, 0.4], echo: 0.4 },
    vox: { w: 'saw', layers: [-8, 8], a: 0.18, d: 0.4, s: 0.9, r: 0.5, vol: 0.085, lp: 1500, q: 5, vib: [5, 18, 0.3], echo: 0.45 },
    pad: { w: 'saw', layers: [-10, 10], a: 0.7, d: 0.8, s: 0.85, r: 1.3, vol: 0.03, lp: 1000, echo: 0.3 },
    organ: { w: 'organ', a: 0.012, d: 0.1, s: 0.95, r: 0.1, vol: 0.07, vib: [6.2, 7, 0], echo: 0.3 },
    obass: { w: 'organ', a: 0.01, d: 0.1, s: 0.9, r: 0.08, vol: 0.13, lp: 900 },
    accordion: { w: 'reed', layers: [-7, 7], a: 0.03, d: 0.15, s: 0.85, r: 0.08, vol: 0.11, trem: [6, 0.18], lp: 3800, echo: 0.2 },
    flute: { w: 'flute', a: 0.06, d: 0.2, s: 0.85, r: 0.12, vol: 0.15, vib: [5, 16, 0.22], echo: 0.3 },
    ocarina: { w: 'tri', a: 0.02, d: 0.15, s: 0.8, r: 0.08, vol: 0.19, vib: [5.5, 12, 0.2], echo: 0.25 },
    harp: { w: 'pluck', a: 0.002, d: 1.0, s: 0, r: 0.35, vol: 0.12, lp: 1000, lpEnv: [4200, 4200, 0.002, 0.25], echo: 0.3 },
    lute: { w: 'pluck', a: 0.002, d: 0.6, s: 0, r: 0.2, vol: 0.11, lp: 1300, lpEnv: [4000, 4000, 0.002, 0.12], echo: 0.2 },
    comp: { w: 'sq50', a: 0.004, d: 0.12, s: 0.25, r: 0.05, vol: 0.045, lp: 2200, gate: 0.5 },
    bass: { w: 'bassw', a: 0.005, d: 0.25, s: 0.6, r: 0.06, vol: 0.19, lp: 1100 },
    sbass: { w: 'saw', a: 0.004, d: 0.18, s: 0.45, r: 0.05, vol: 0.14, lp: 520, lpEnv: [2600, 2600, 0.003, 0.08], q: 3 },
    tuba: { w: 'soft', a: 0.02, d: 0.2, s: 0.6, r: 0.08, vol: 0.2, gate: 0.6 },
    sub: { w: 'soft', a: 0.02, d: 0.3, s: 0.7, r: 0.12, vol: 0.22 },
    bell: { type: 'add', parts: [[1, 1, 1], [2, 0.5, 0.55], [3.01, 0.25, 0.35], [4.18, 0.16, 0.22], [5.43, 0.09, 0.14]], a: 0.002, d: 2.2, r: 0.8, vol: 0.13, echo: 0.35 },
    toll: { type: 'add', parts: [[0.5, 0.6, 1.3], [1, 1, 1], [1.2, 0.5, 0.7], [1.5, 0.35, 0.6], [2, 0.45, 0.5], [2.51, 0.2, 0.3], [3, 0.18, 0.25], [4.07, 0.1, 0.15]], a: 0.003, d: 5, r: 1.5, vol: 0.11, echo: 0.4 },
    glock: { type: 'add', parts: [[1, 1, 1], [2.76, 0.35, 0.3], [5.4, 0.2, 0.15], [8.93, 0.08, 0.08]], a: 0.002, d: 1.2, r: 0.4, vol: 0.085, echo: 0.3 },
    mbox: { type: 'fm', fm: [4, 1.2, 0.12, 0], a: 0.002, d: 1.3, s: 0, r: 0.5, vol: 0.18, echo: 0.5 },
    glass: { type: 'fm', fm: [3.5, 1.6, 0.25, 0.05], a: 0.002, d: 0.9, s: 0, r: 0.4, vol: 0.075, echo: 0.45 },
    kalimba: { type: 'fm', fm: [7, 0.8, 0.05, 0], a: 0.002, d: 0.6, s: 0, r: 0.2, vol: 0.14, echo: 0.3 },
    synth: { w: 'sq12', a: 0.002, d: 0.14, s: 0.2, r: 0.05, vol: 0.068, echo: 0.35 },
    cold: { type: 'fm', fm: [2, 0.4, 1, 0.3], a: 0.08, d: 0.5, s: 0.8, r: 0.4, vol: 0.14, vib: [4, 10, 0.5], echo: 0.45 },
    scream: { w: 'saw', layers: [-18, 18], a: 0.03, d: 0.3, s: 0.9, r: 0.2, vol: 0.075, lp: 3000, q: 4, vib: [7.5, 45, 0.15], glide: [-4, 0.12], echo: 0.3 },
    detuned: { w: 'sq25', layers: [-38, 31], a: 0.4, d: 0.5, s: 0.9, r: 1, vol: 0.075, vib: [0.35, 30, 0], echo: 0.45 },
    wind: { type: 'noise', q: 5, a: 1.2, d: 1, s: 1, r: 1.6, vol: 0.22 },
    timp: { type: 'add', parts: [[1, 1, 1], [1.5, 0.5, 0.6], [1.98, 0.3, 0.45], [2.44, 0.15, 0.3]], a: 0.003, d: 1.2, r: 0.5, vol: 0.26, glide: [0.5, 0.08], hit: 0.25 },
    log: { type: 'add', parts: [[1, 1, 1], [2.3, 0.35, 0.3]], a: 0.002, d: 0.3, r: 0.1, vol: 0.26, glide: [2, 0.03] },
  };

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
  function compile(id) {
    if (compiled[id]) return compiled[id];
    if (id === 'mus_credits') return (compiled[id] = compileCredits());
    const def = DEFS[id];
    if (!def) return null;
    const barT = (def.meter[0] * WHOLE) / def.meter[1];
    const spt = 60 / (def.bpm * PPQ);
    const lenT = def.bars * barT;
    const events = [], lens = {};
    for (const name of Object.keys(def.v)) {
      const [instName, src, opt] = def.v[name];
      const o = opt || {};
      const r = instName === 'kit' ? parseDrums(src, def.m) : parseMML(src, def.m, instName);
      lens[name] = r.ticks;
      for (const e of r.events) {
        if (e.tk >= lenT) continue;
        const inst = e.drum ? null : INST[e.inst] || INST.lead;
        const gate = e.gate != null ? e.gate : inst && inst.gate != null ? inst.gate : 0.94;
        events.push({
          t: e.tk * spt, d: Math.max(0.02, e.dur * spt * gate), notes: e.notes, drum: e.drum,
          vel: e.vel * (o.vol || 1), inst, vn: name, pan: e.pan != null ? e.pan : o.pan != null ? o.pan : 0,
        });
      }
    }
    events.sort((a, b) => a.t - b.t);
    const len = lenT * spt, loopStart = (def.loop || 0) * barT * spt;
    let loopIdx = events.findIndex((e) => e.t >= loopStart - 1e-9);
    if (loopIdx < 0) loopIdx = events.length;
    return (compiled[id] = {
      id, bpm: def.bpm, meter: def.meter, bars: def.bars, barSec: barT * spt, len, loopStart, loopIdx,
      oneShot: !!def.oneShot, events, voices: Object.keys(def.v).length, lens, expectTicks: lenT,
      echo: { time: Math.min(1.5, (def.echo ? def.echo[0] : 0.75) * 60 / def.bpm), fb: def.echo ? def.echo[1] : 0.3, wet: def.echo ? def.echo[2] : 0.25 },
    });
  }
  function compileCredits() {
    const events = [];
    let off = 0, voices = 0;
    for (const [id, from, to] of CREDITS.segments) {
      const tr = compile(id);
      if (!tr) continue;
      voices = Math.max(voices, tr.voices);
      const t0 = from * tr.barSec, t1 = to * tr.barSec;
      for (const e of tr.events) {
        if (e.t < t0 - 1e-9 || e.t >= t1 - 1e-9) continue;
        events.push(Object.assign({}, e, { t: e.t - t0 + off, d: Math.min(e.d, t1 - e.t) }));
      }
      off += t1 - t0 + CREDITS.gap;
    }
    const len = off - CREDITS.gap + 1;
    return {
      id: 'mus_credits', bpm: 0, meter: null, bars: 0, barSec: 0, len, loopStart: 0, loopIdx: 0, oneShot: true,
      events, voices, lens: {}, expectTicks: 0,
      echo: { time: CREDITS.echo[0], fb: CREDITS.echo[1], wet: CREDITS.echo[2] },
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

  // One melodic voice. bus = {dry, send}
  function voice(ac, bus, I, midi, t, dur, vel, pan) {
    const f = mtof(midi);
    const peak = I.vol * vel;
    const a = I.a || 0.005, r = I.r || 0.1;
    const tEnd = t + dur, stopAt = tEnd + r + 0.05;
    const g = ac.createGain();
    const srcs = [], detuneParams = [];
    const type = I.type || 'osc';
    if (type === 'add') {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + Math.min(a, dur));
      g.gain.setValueAtTime(peak, tEnd);
      g.gain.linearRampToValueAtTime(0, tEnd + r);
      for (const [ratio, amp, dsc] of I.parts) {
        if (f * ratio > 16000) continue;
        const o = ac.createOscillator();
        o.frequency.value = f * ratio;
        const pg = ac.createGain();
        pg.gain.setValueAtTime(amp, t);
        pg.gain.setTargetAtTime(0, t + a, Math.max(0.01, I.d * dsc * 0.35));
        o.connect(pg); pg.connect(g);
        srcs.push(o); detuneParams.push(o.detune);
      }
      if (I.hit) {
        const n = ac.createBufferSource();
        n.buffer = noiseBuf(ac);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        const ng = ac.createGain();
        ng.gain.setValueAtTime(I.hit, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        n.connect(lp); lp.connect(ng); ng.connect(g);
        n.start(t, Math.random()); n.stop(t + 0.1);
      }
    } else {
      // ADSR
      const d = I.d || 0.1, s = I.s != null ? I.s : 0.8;
      const aEff = Math.min(a, dur);
      const P = peak * (aEff / a);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(P, t + aEff);
      const tau = Math.max(0.005, d / 3);
      let vEnd = P;
      if (dur > aEff) {
        g.gain.setTargetAtTime(peak * s, t + aEff, tau);
        vEnd = peak * s + (P - peak * s) * Math.exp(-(dur - aEff) / tau);
      }
      g.gain.setValueAtTime(vEnd, tEnd);
      g.gain.linearRampToValueAtTime(0, tEnd + r);
      if (type === 'fm') {
        const [ratio, index, fdec, fsus] = I.fm;
        const car = ac.createOscillator();
        car.frequency.value = f;
        const mod = ac.createOscillator();
        mod.frequency.value = f * ratio;
        const mg = ac.createGain();
        const dev = index * f * ratio;
        mg.gain.setValueAtTime(dev, t);
        mg.gain.setTargetAtTime(dev * (fsus || 0), t, Math.max(0.005, fdec / 3));
        mod.connect(mg); mg.connect(car.frequency);
        car.connect(g);
        srcs.push(car, mod); detuneParams.push(car.detune, mod.detune);
      } else if (type === 'noise') {
        const n = ac.createBufferSource();
        n.buffer = noiseBuf(ac); n.loop = true;
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = I.q || 4;
        n.connect(bp); bp.connect(g);
        n.__offset = Math.random() * 1.5;
        srcs.push(n);
      } else {
        const layers = I.layers || [0];
        const lg = ac.createGain();
        lg.gain.value = 1 / Math.sqrt(layers.length);
        let head = lg;
        if (I.lp) {
          const flt = ac.createBiquadFilter();
          flt.type = 'lowpass'; flt.Q.value = I.q || 0.7;
          if (I.lpEnv) {
            const [st, pk, at, dt] = I.lpEnv;
            flt.frequency.setValueAtTime(st, t);
            flt.frequency.linearRampToValueAtTime(pk, t + at);
            flt.frequency.setTargetAtTime(I.lp, t + at, Math.max(0.01, dt));
          } else flt.frequency.value = I.lp;
          lg.connect(flt); head = flt;
        }
        if (I.trem) {
          const tg = ac.createGain();
          tg.gain.value = 1 - I.trem[1];
          const lfo = ac.createOscillator(); lfo.frequency.value = I.trem[0];
          const lg2 = ac.createGain(); lg2.gain.value = I.trem[1];
          lfo.connect(lg2); lg2.connect(tg.gain);
          lfo.start(t); lfo.stop(stopAt);
          head.connect(tg); head = tg;
        }
        head.connect(g);
        for (const c of layers) {
          const o = ac.createOscillator();
          setWave(ac, o, I.w || 'sq50');
          o.frequency.value = f;
          o.detune.value = c;
          o.connect(lg);
          srcs.push(o); detuneParams.push(o.detune);
        }
      }
    }
    // pitch glide & vibrato
    if (I.glide && detuneParams.length) {
      for (const p of detuneParams) {
        const base = p.value;
        p.setValueAtTime(base + I.glide[0] * 100, t);
        p.linearRampToValueAtTime(base, t + I.glide[1]);
      }
    }
    if (I.vib && detuneParams.length && dur > 0.25) {
      const lfo = ac.createOscillator(); lfo.frequency.value = I.vib[0];
      const dg = ac.createGain();
      const vd = t + (I.vib[2] || 0);
      dg.gain.setValueAtTime(0, t);
      dg.gain.setValueAtTime(0, vd);
      dg.gain.linearRampToValueAtTime(I.vib[1], vd + 0.25);
      lfo.connect(dg);
      for (const p of detuneParams) dg.connect(p);
      lfo.start(t); lfo.stop(stopAt);
    }
    busOut(ac, bus, g, pan, I.echo);
    for (const s of srcs) {
      if (s.__offset != null) s.start(t, s.__offset); else s.start(t);
      s.stop(stopAt);
    }
    srcs[0] && (srcs[0].onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } });
  }

  // Envelope helper: returns a gain node with an attack/exp-decay envelope.
  function envGain(ac, t, peak, a, dec) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    return g;
  }
  function oscSweep(ac, dest, t, type, f0, f1, sweep, peak, a, dec) {
    const o = ac.createOscillator();
    setWave(ac, o, type);
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + sweep);
    const g = envGain(ac, t, peak, a, dec);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + a + dec + 0.02);
    return o;
  }
  function noiseHit(ac, dest, t, ftype, f0, f1, q, peak, a, dec) {
    const n = ac.createBufferSource();
    n.buffer = noiseBuf(ac);
    n.loop = true;
    const fl = ac.createBiquadFilter();
    fl.type = ftype; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + a + dec);
    const g = envGain(ac, t, peak, a, dec);
    n.connect(fl); fl.connect(g); g.connect(dest);
    n.start(t, Math.random() * 1.5); n.stop(t + a + dec + 0.02);
    return fl;
  }

  // Drum kit (music)
  function drum(ac, bus, type, t, v, pan) {
    const g = ac.createGain();
    g.gain.value = v;
    busOut(ac, bus, g, pan, 0);
    const d = g;
    switch (type) {
      case 'k':
        oscSweep(ac, d, t, 'sine', 150, 42, 0.1, 0.9, 0.002, 0.28);
        noiseHit(ac, d, t, 'highpass', 3000, 3000, 0.7, 0.12, 0.001, 0.012);
        break;
      case 's':
        noiseHit(ac, d, t, 'bandpass', 1800, 1400, 0.6, 0.5, 0.001, 0.16);
        oscSweep(ac, d, t, 'tri', 200, 150, 0.08, 0.35, 0.001, 0.09);
        break;
      case 'h': noiseHit(ac, d, t, 'highpass', 7500, 7500, 0.7, 0.2, 0.001, 0.045); break;
      case 'o': noiseHit(ac, d, t, 'highpass', 6500, 6500, 0.7, 0.18, 0.002, 0.28); break;
      case 'c':
        noiseHit(ac, d, t, 'highpass', 3500, 3000, 0.7, 0.26, 0.002, 1.4);
        noiseHit(ac, d, t, 'bandpass', 8000, 6000, 1, 0.1, 0.002, 0.9);
        break;
      case 't': case 'm': case 'u': {
        const f = type === 't' ? 105 : type === 'm' ? 145 : 195;
        oscSweep(ac, d, t, 'sine', f, f * 0.6, 0.25, 0.6, 0.002, 0.35);
        noiseHit(ac, d, t, 'bandpass', f * 4, f * 3, 1, 0.12, 0.001, 0.05);
        break;
      }
      case 'x':
        for (let k = 0; k < 3; k++) noiseHit(ac, d, t + k * 0.011, 'bandpass', 1100, 1100, 1.2, 0.35, 0.001, 0.012);
        noiseHit(ac, d, t + 0.033, 'bandpass', 1100, 900, 1.2, 0.35, 0.001, 0.12);
        break;
      case 'r':
        oscSweep(ac, d, t, 'tri', 1700, 1500, 0.02, 0.25, 0.001, 0.03);
        noiseHit(ac, d, t, 'highpass', 2500, 2500, 0.7, 0.12, 0.001, 0.015);
        break;
      case 'q':
        oscSweep(ac, d, t, 'tri', 1100, 1000, 0.02, 0.22, 0.001, 0.035);
        break;
      case 'i':
        oscSweep(ac, d, t, 'sine', 640, 560, 0.04, 0.45, 0.001, 0.14);
        oscSweep(ac, d, t, 'sine', 1470, 1300, 0.03, 0.1, 0.001, 0.05);
        break;
      case 'j':
        oscSweep(ac, d, t, 'sine', 400, 340, 0.05, 0.5, 0.001, 0.18);
        oscSweep(ac, d, t, 'sine', 920, 800, 0.03, 0.1, 0.001, 0.05);
        break;
      case 'g': noiseHit(ac, d, t, 'highpass', 5500, 5500, 0.7, 0.13, 0.012, 0.06); break;
      case 'f':
        noiseHit(ac, d, t, 'lowpass', 500, 300, 0.7, 0.4, 0.004, 0.07);
        oscSweep(ac, d, t, 'sine', 95, 60, 0.05, 0.3, 0.002, 0.06);
        break;
      default: break;
    }
  }

  function playEvent(ac, bus, e, t) {
    if (e.drum) { drum(ac, bus, e.drum, t, e.vel, e.pan); return; }
    for (const n of e.notes) voice(ac, bus, e.inst, n, t, e.d, e.vel, e.pan);
  }

  // ---------------------------------------------------------------------------
  // Mixer graph
  // ---------------------------------------------------------------------------
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
  function softClipCurve() {
    const n = 4096, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
      c[i] = ax < 0.7 ? x : Math.sign(x) * (0.7 + 0.29 * Math.tanh((ax - 0.7) / 0.29));
    }
    return c;
  }
  function buildMaster(ac, vols) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.25;
    const clip = ac.createWaveShaper();
    clip.curve = softClipCurve();
    const out = ac.createGain(); out.gain.value = 0.9;
    comp.connect(out); out.connect(clip); clip.connect(ac.destination);
    const music = ac.createGain(); music.gain.value = vols.music; music.connect(comp);
    const sfx = ac.createGain(); sfx.gain.value = vols.sfx; sfx.connect(comp);
    const sfxDry = ac.createGain(); sfxDry.connect(sfx);
    const sfxSend = makeEcho(ac, sfx, 0.16, 0.3, 0.35);
    return { comp, music, sfx, sfxBus: { dry: sfxDry, send: sfxSend } };
  }
  function makeTrackBus(ac, dest, tr) {
    const out = ac.createGain(); out.connect(dest);
    const dry = ac.createGain(); dry.connect(out);
    const send = makeEcho(ac, out, tr.echo.time, tr.echo.fb, tr.echo.wet);
    return { out, dry, send };
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
  };

  // ---------------------------------------------------------------------------
  // Runtime state & scheduler
  // ---------------------------------------------------------------------------
  const st = {
    ac: null, master: null, unlocked: false, timer: null,
    current: null, pending: null, song: null, old: [],
    vol: { music: DEFAULT_VOL.music, sfx: DEFAULT_VOL.sfx },
    lastBlip: 0,
  };

  function scheduleSong(ac, S, horizon, now) {
    const tr = S.trk, evs = tr.events;
    let guard = 0;
    while (!S.done && guard++ < 5000) {
      if (S.idx >= evs.length) {
        if (tr.oneShot || tr.loopIdx >= evs.length || tr.len - tr.loopStart <= 0.05) { S.done = true; break; }
        S.idx = tr.loopIdx;
        S.off += tr.len - tr.loopStart;
        continue;
      }
      const e = evs[S.idx];
      const at = S.t0 + S.off + e.t;
      if (at > horizon) break;
      if (at >= now - 0.03) playEvent(ac, S.bus, e, Math.max(at, now));
      S.idx++;
    }
  }
  function pump() {
    try {
      const ac = st.ac, S = st.song;
      if (!ac || !S) return;
      const now = ac.currentTime;
      const hidden = typeof document !== 'undefined' && document.hidden;
      scheduleSong(ac, S, now + (hidden ? 1.5 : 0.22), now);
      if (S.done && now > S.t0 + S.trk.len + 2.5) {
        if (st.current === S.trk.id) st.current = null;
        try { S.bus.out.disconnect(); } catch (e) { /* ignore */ }
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
    setTimeout(() => { try { S.bus.out.disconnect(); } catch (e) { /* ignore */ } }, dur * 1000 + 400);
  }
  function startSong(id, fadeMs) {
    const ac = st.ac;
    const tr = compile(id);
    if (!ac || !st.master || !tr) return;
    if (st.song) { fadeOutSong(st.song, fadeMs || 40); st.song = null; }
    const bus = makeTrackBus(ac, st.master.music, tr);
    const t0 = ac.currentTime + 0.06;
    if (fadeMs > 0) {
      bus.out.gain.setValueAtTime(0, t0);
      bus.out.gain.linearRampToValueAtTime(1, t0 + fadeMs / 1000);
    }
    st.song = { trk: tr, bus, t0, idx: 0, off: 0, done: false };
    pump();
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
    } catch (e) { /* audio unavailable: stay silent */ }
  }
  function playMusic(id, opts) {
    try {
      if (!DEFS[id] && id !== 'mus_credits') return;
      if (id === st.current && (st.song || st.pending === id)) return;
      st.current = id;
      const fade = opts && opts.fade ? +opts.fade : 0;
      if (!st.ac || !st.unlocked) { st.pending = id; return; }
      startSong(id, fade);
    } catch (e) { /* ignore */ }
  }
  function stopMusic(fadeMs) {
    try {
      st.pending = null;
      st.current = null;
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

  // Offline render (dev/test helper): Promise<AudioBuffer|null>
  function renderOffline(id, seconds, only) {
    try {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const isSfx = !!SFX[id];
      const tr = isSfx ? null : compile(id);
      if (!OAC || (!isSfx && !tr)) return Promise.resolve(null);
      if (seconds == null) seconds = isSfx ? 3 : tr.oneShot ? tr.len + 3 : tr.len + 1;
      const sr = 44100;
      const ac = new OAC(2, Math.max(1, Math.ceil(sr * seconds)), sr);
      const M = buildMaster(ac, st.vol);
      if (isSfx) SFX[id](ac, M.sfxBus, 0.02);
      else {
        const trk = only ? Object.assign({}, tr, { events: tr.events.filter((e) => only.indexOf(e.vn) >= 0) }) : tr;
        if (only) trk.loopIdx = trk.events.findIndex((e) => e.t >= tr.loopStart - 1e-9);
        const S = { trk, bus: makeTrackBus(ac, M.music, tr), t0: 0.02, idx: 0, off: 0, done: false };
        scheduleSong(ac, S, seconds, 0);
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
    };
  }

  const api = {
    unlock, playMusic, stopMusic, sfx, setVolume,
    tracks: () => TRACK_IDS.slice(),
    sfxList: () => Object.keys(SFX),
    _renderOffline: renderOffline,
    _info: info,
    _gen: { arp, bass, pad, parseMML, parseDrums },
  };
  Object.defineProperty(api, 'current', { get: () => st.current, enumerable: true });
  Object.defineProperty(api, 'volume', { get: () => ({ music: st.vol.music, sfx: st.vol.sfx }), enumerable: false });
  CT.audio = api;
})();
