// measure.cjs — objective review of the music engine: renders every track offline in headless
// Chromium (CT.audio._renderOffline) and measures loudness, spectrum, stereo width, loop seams,
// per-voice balance, note density, dropped source notes and CPU cost. Nobody has to listen.
//
//   PW=/opt/node22/lib/node_modules/playwright node tools/music/measure.cjs [options]
//     --audio FILE     engine to test            (default public/js/audio.js)
//     --music FILE     track defs                (default public/js/music_ct.js)
//     --out FILE       write the full JSON result
//     --ids a,b        only these track ids
//     --voices         also render every voice solo (balance / "is the melody on top" check)
//     --report FILE    converter report (midi2ct.py --report) for the dropped-note check
//     --leads FILE     JSON {trackId: voiceName} when the defs carry no `lead`
//     --sfx            also measure every SFX
//     --wav DIR        write 22.05 kHz mono 16-bit WAVs of --wavids (default: all ids) to DIR
//     --wavids a,b  --wavsec N (default 75)
//     --jobs N         parallel pages (default 3)
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const fs = require('fs');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const nx = process.argv[i + 1];
    if (nx == null || nx.startsWith('--')) args[k] = true; else { args[k] = nx; i++; }
  }
}
const ROOT = path.resolve(__dirname, '../..');
const AUDIO = path.resolve(args.audio || path.join(ROOT, 'public/js/audio.js'));
const MUSIC = path.resolve(args.music || path.join(ROOT, 'public/js/music_ct.js'));

// ------------------------------------------------------------------------------------------
// Everything below `pageLib` runs inside the page.
// ------------------------------------------------------------------------------------------
function pageLib() {
  const M = (window.__M = {});
  const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -200);
  const dBp = (x) => (x > 0 ? 10 * Math.log10(x) : -200);
  const r1 = (x) => Math.round(x * 10) / 10;
  M.t0 = 0.02; // renderOffline starts the song 20 ms in

  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  const N = 4096;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const aw = (f) => {
    const f2 = f * f;
    const ra = (12194 * 12194 * f2 * f2) / ((f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194));
    return ra * 1.2589; // +2 dB
  };
  const BANDS = [0, 60, 250, 1000, 4000, 10000, 1e9]; // sub, bass, lowmid, mid, treble, air
  const OCT = [44, 88, 177, 354, 707, 1414, 2828, 5657, 11314];

  // Average power spectrum features + per-frame octave-band powers (hop 8192).
  function spectral(mono, sr, wantFrames) {
    const hop = 8192, nf = Math.max(0, Math.floor((mono.length - N) / hop) + 1);
    const re = new Float64Array(N), im = new Float64Array(N);
    const acc = new Float64Array(N / 2);
    const frames = wantFrames ? new Float32Array(nf * (OCT.length - 1)) : null;
    const octIdx = new Int16Array(N / 2).fill(-1);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * sr) / N;
      for (let b = 0; b < OCT.length - 1; b++) if (f >= OCT[b] && f < OCT[b + 1]) octIdx[k] = b;
    }
    for (let fi = 0; fi < nf; fi++) {
      const o = fi * hop;
      for (let i = 0; i < N; i++) { re[i] = mono[o + i] * win[i]; im[i] = 0; }
      fft(re, im);
      for (let k = 1; k < N / 2; k++) {
        const p = re[k] * re[k] + im[k] * im[k];
        acc[k] += p;
        if (frames && octIdx[k] >= 0) frames[fi * (OCT.length - 1) + octIdx[k]] += p;
      }
    }
    let tot = 0, cen = 0, awp = 0;
    const band = new Float64Array(BANDS.length - 1);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * sr) / N, p = acc[k];
      tot += p; cen += p * f;
      const a = aw(f); awp += p * a * a;
      for (let b = 0; b < band.length; b++) if (f >= BANDS[b] && f < BANDS[b + 1]) band[b] += p;
    }
    // rolloff 85 %
    let run = 0, roll = 0;
    for (let k = 1; k < N / 2; k++) { run += acc[k]; if (run >= 0.85 * tot) { roll = (k * sr) / N; break; } }
    const norm = nf * N * N * 0.375 / 2; // Hann power gain, one-sided
    return {
      centroid: tot ? Math.round(cen / tot) : 0, rolloff85: Math.round(roll),
      bandPct: Array.from(band, (p) => (tot ? r1((100 * p) / tot) : 0)),
      dBA: r1(dBp(awp / Math.max(1, norm))), frames, nf,
    };
  }

  function basic(L, R) {
    const n = L.length;
    let pk = 0, sq = 0, sqS = 0, clip = 0, nan = 0, first = -1, dc = 0;
    for (let i = 0; i < n; i++) {
      const l = L[i], r = R[i];
      if (l !== l || r !== r) { nan++; continue; }
      const al = Math.abs(l), ar = Math.abs(r);
      if (al > pk) pk = al;
      if (ar > pk) pk = ar;
      if (al >= 0.999 || ar >= 0.999) clip++;
      const m = (l + r) / 2, s = (l - r) / 2;
      sq += m * m; sqS += s * s; dc += m;
      if (first < 0 && (al > 0.003 || ar > 0.003)) first = i;
    }
    return { pk, rms: Math.sqrt(sq / n), side: Math.sqrt(sqS / n), clip, nan, first, dc: dc / n };
  }
  // RMS envelope, hop h samples, window w samples
  function env(mono, a, b, w, h) {
    const out = [];
    for (let o = Math.max(0, a); o + w <= Math.min(mono.length, b); o += h) {
      let s = 0;
      for (let i = 0; i < w; i++) s += mono[o + i] * mono[o + i];
      out.push(Math.sqrt(s / w));
    }
    return out;
  }
  const median = (a) => { const s = Array.from(a).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  const pct = (a, p) => { const s = Array.from(a).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };

  // dip (dB below local median) and click (dB above the track's 99.9 % sample-difference) at time t
  function seamAt(mono, sr, t, d999) {
    const c = Math.round(t * sr);
    const e = env(mono, c - Math.round(1.5 * sr), c + Math.round(1.5 * sr), Math.round(0.02 * sr), Math.round(0.005 * sr));
    const med = median(e);
    const mid = e.length >> 1, span = Math.round(0.12 / 0.005);
    let mn = 1e9;
    for (let i = Math.max(0, mid - span); i < Math.min(e.length, mid + span); i++) mn = Math.min(mn, e[i]);
    let mx = 0;
    for (let i = Math.max(1, c - Math.round(0.03 * sr)); i < Math.min(mono.length, c + Math.round(0.03 * sr)); i++) mx = Math.max(mx, Math.abs(mono[i] - mono[i - 1]));
    // level step across the seam: 250 ms before vs after
    const w = Math.round(0.25 * sr);
    let a = 0, b = 0;
    for (let i = 0; i < w; i++) { const x = mono[c - 1 - i] || 0, y = mono[c + i] || 0; a += x * x; b += y * y; }
    return { dip: r1(dB(mn) - dB(med)), click: r1(dB(mx) - dB(d999)), step: r1(dBp(b / Math.max(1e-12, a))) };
  }

  M.captureDefs = function () {
    window.__defs = {};
    const A = window.CT.audio, d = A.define;
    A.define = function (id, def) { window.__defs[id] = def; return d.apply(A, arguments); };
  };

  // note list from the captured def (works for the legacy step-string kit and for MML drums)
  M.events = function (id) {
    const def = window.__defs[id], G = window.CT.audio._gen;
    if (!def) return null;
    const out = { mel: [], drum: [], voices: {} };
    for (const name of Object.keys(def.v)) {
      const [inst, src] = def.v[name];
      const isKit = inst === 'kit';
      let n = 0, ticks = 0;
      for (const lane of Array.isArray(src) ? src : [src]) {
        const r = isKit ? G.parseDrums(lane, def.m) : G.parseMML(lane, def.m, inst);
        ticks = Math.max(ticks, r.ticks);
        for (const e of r.events) {
          if (e.drum) { out.drum.push([e.tk, e.drum]); n++; continue; }
          if (!e.notes) continue;
          for (const p of e.notes) {
            if (inst === 'drums' || e.inst === 'drums') out.drum.push([e.tk, p]); else out.mel.push([e.tk, p, e.dur]);
            n++;
          }
        }
      }
      out.voices[name] = { inst, notes: n, ticks };
    }
    return out;
  };
  M.density = function (id) {
    const def = window.__defs[id], ev = M.events(id);
    if (!ev) return null;
    const spt = 60 / (def.bpm * 48), barT = (def.meter[0] * 192) / def.meter[1], lenT = def.bars * barT;
    const pts = [];
    let n = 0;
    for (const [tk, , dur] of ev.mel) { if (tk >= lenT) continue; n++; pts.push([tk, 1], [tk + Math.max(1, dur), -1]); }
    for (const [tk] of ev.drum) { if (tk >= lenT) continue; n++; pts.push([tk, 1], [tk + 12, -1]); }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0, mx = 0;
    for (const p of pts) { cur += p[1]; if (cur > mx) mx = cur; }
    const sec = lenT * spt;
    return { notes: n, melNotes: ev.mel.length, drumHits: ev.drum.length, sec: r1(sec), notesPerSec: r1(n / sec), maxPoly: mx, voices: Object.keys(def.v).length };
  };
  // compare the def against the converter's list of source notes
  M.dropped = function (id, expect) {
    const ev = M.events(id);
    if (!ev || !expect) return null;
    const cnt = (list) => { const m = new Map(); for (const x of list) { const k = x[0] + ':' + x[1]; m.set(k, (m.get(k) || 0) + 1); } return m; };
    const miss = (exp, got) => { const g = cnt(got); let lost = 0; for (const x of exp) { const k = x[0] + ':' + x[1]; const c = g.get(k) || 0; if (c > 0) g.set(k, c - 1); else lost++; } return lost; };
    return { melSrc: expect.mel.length, melLost: miss(expect.mel, ev.mel), drumSrc: expect.drum.length, drumLost: miss(expect.drum, ev.drum) };
  };

  let schedMark = 0;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const sr0 = OAC.prototype.startRendering;
  OAC.prototype.startRendering = function () { schedMark = performance.now(); return sr0.apply(this, arguments); };

  M.render = async function (id, seconds, only) {
    const tA = performance.now();
    schedMark = 0;
    const buf = await window.CT.audio._renderOffline(id, seconds, only);
    const tB = performance.now();
    if (!buf) return null;
    return { buf, schedMs: schedMark ? schedMark - tA : 0, renderMs: schedMark ? tB - schedMark : tB - tA };
  };

  M.track = async function (id, opt) {
    const A = window.CT.audio, info = A._info(id);
    if (!info) return { id, error: 'no such track' };
    const loopLen = info.len - info.loopStart;
    const looping = !info.oneShot && loopLen > 0.05;
    const T0 = M.t0 - (info.skip || 0);   // context time of song position 0
    const T = (looping ? info.len + Math.min(loopLen, 12) + 1 : info.len + 3) - (info.skip || 0);
    const r = await M.render(id, T);
    if (!r) return { id, error: 'render failed' };
    const sr = r.buf.sampleRate, L = r.buf.getChannelData(0), R = r.buf.numberOfChannels > 1 ? r.buf.getChannelData(1) : L;
    const n = L.length, mono = new Float32Array(n);
    for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) / 2;
    const b = basic(L, R);
    // body = first pass only (so before/after compare the same music)
    const bodyEnd = Math.min(n, Math.round((T0 + info.len) * sr));
    const body = mono.subarray(0, bodyEnd);
    const bb = basic(L.subarray(0, bodyEnd), R.subarray(0, bodyEnd));
    const sp = spectral(body, sr, false);
    const st = env(body, 0, body.length, Math.round(0.4 * sr), Math.round(0.2 * sr)).map(dB);
    // longest near-silent stretch after the music starts
    const e50 = env(body, Math.max(0, b.first), body.length, Math.round(0.05 * sr), Math.round(0.05 * sr));
    let run = 0, gap = 0;
    for (const x of e50) { if (x < 0.0018) { run++; if (run > gap) gap = run; } else run = 0; }
    const out = {
      id, sec: r1(info.len), bpm: info.bpm, bars: info.bars, loopStartSec: r1(info.loopStart), oneShot: !!info.oneShot,
      peakDb: r1(dB(b.pk)), rmsDb: r1(dB(bb.rms)), dBA: sp.dBA, crest: r1(dB(bb.pk) - dB(bb.rms)),
      clipped: b.clip, nan: b.nan, dc: +b.dc.toFixed(5),
      leadSilenceMs: b.first < 0 ? -1 : Math.round((b.first / sr - M.t0) * 1000), skipSec: r1(info.skip || 0),
      longestGapMs: gap * 50,
      sideDb: r1(dB(bb.side) - dB(bb.rms)),
      centroid: sp.centroid, rolloff85: sp.rolloff85, bandPct: sp.bandPct,
      stLoud: { p10: r1(pct(st, 0.1)), p50: r1(pct(st, 0.5)), p95: r1(pct(st, 0.95)), max: r1(Math.max.apply(null, st)) },
      rtf: r1((T * 1000) / Math.max(1, r.schedMs + r.renderMs)), schedMsPerSec: r1(r.schedMs / T), renderMsPerSec: r1(r.renderMs / T),
      density: M.density(id),
    };
    if (looping) {
      // 99.9th percentile of |x[n]-x[n-1]| over the body
      const step = Math.max(1, Math.floor(body.length / 400000)), d = [];
      for (let i = 1; i < body.length; i += step) d.push(Math.abs(body[i] - body[i - 1]));
      const d999 = pct(d, 0.999) || 1e-9;
      const seam = seamAt(mono, sr, T0 + info.len, d999);
      // the same statistic at every bar line inside the loop, for reference
      const dips = [], clicks = [];
      if (info.barSec > 0) {
        for (let t = info.loopStart + info.barSec; t < info.len - 0.01; t += info.barSec) {
          const s = seamAt(mono, sr, T0 + t, d999);
          dips.push(s.dip); clicks.push(s.click);
        }
      }
      // does the second pass sound like the first? compare 50 ms envelopes of the first 4 s of the loop
      const w = Math.round(0.05 * sr), span = Math.round(Math.min(4, loopLen, T - info.len - T0 - 0.2) * sr);
      const a0 = Math.round((T0 + Math.max(info.loopStart, info.skip || 0)) * sr), b0 = Math.round((T0 + info.len + Math.max(0, (info.skip || 0) - info.loopStart)) * sr);
      const ea = env(mono, a0, a0 + span, w, w), eb = env(mono, b0, b0 + span, w, w);
      let df = 0, c = 0;
      for (let i = 0; i < Math.min(ea.length, eb.length); i++) { if (ea[i] > 0.002 || eb[i] > 0.002) { df += Math.abs(dB(ea[i] + 1e-5) - dB(eb[i] + 1e-5)); c++; } }
      out.loop = {
        seamDipDb: seam.dip, seamClickDb: seam.click, seamStepDb: seam.step,
        barDipMedian: dips.length ? r1(median(dips)) : null, barDipWorst: dips.length ? r1(Math.min.apply(null, dips)) : null,
        barClickMedian: clicks.length ? r1(median(clicks)) : null, barClickWorst: clicks.length ? r1(Math.max.apply(null, clicks)) : null,
        pass2EnvDiffDb: c ? r1(df / c) : null,
      };
    }
    if (opt && opt.expect) out.dropped = M.dropped(id, opt.expect);
    if (opt && opt.voices && window.__defs[id]) {
      const names = Object.keys(window.__defs[id].v);
      const vs = {};
      const Tv = info.len + 1 - (info.skip || 0);
      const NB = OCT.length - 1;
      for (const name of names) {
        const rv = await M.render(id, Tv, [name]);
        if (!rv) continue;
        const l = rv.buf.getChannelData(0), rr = rv.buf.numberOfChannels > 1 ? rv.buf.getChannelData(1) : l;
        const m = new Float32Array(l.length);
        for (let i = 0; i < l.length; i++) m[i] = (l[i] + rr[i]) / 2;
        const vb = basic(l, rr), vsp = spectral(m, sr, true);
        const e = env(m, 0, m.length, Math.round(0.1 * sr), Math.round(0.1 * sr));
        let act = 0, sq = 0;
        for (const x of e) if (x > 0.001) { act++; sq += x * x; }
        vs[name] = {
          inst: window.__defs[id].v[name][0], rmsDb: r1(dB(vb.rms)), peakDb: r1(dB(vb.pk)), dBA: vsp.dBA,
          activeRmsDb: act ? r1(dB(Math.sqrt(sq / act))) : -200, activePct: Math.round((100 * act) / Math.max(1, e.length)),
          centroid: vsp.centroid, pan: r1(dB(basic(l, l).rms + 1e-9) - dB(basic(rr, rr).rms + 1e-9)), frames: vsp.frames, nf: vsp.nf,
        };
      }
      // melody check
      const lead = (opt.lead && vs[opt.lead]) ? opt.lead : (window.__defs[id].lead && vs[window.__defs[id].lead] ? window.__defs[id].lead : null);
      if (lead) {
        const F = vs[lead].frames, nf = vs[lead].nf;
        const tot = new Float64Array(NB);
        let mxF = 0;
        const fp = new Float64Array(nf);
        for (let f = 0; f < nf; f++) { let s = 0; for (let k = 0; k < NB; k++) s += F[f * NB + k]; fp[f] = s; if (s > mxF) mxF = s; }
        const active = [];
        for (let f = 0; f < nf; f++) if (fp[f] > mxF * 1e-4) active.push(f);
        for (const f of active) for (let k = 0; k < NB; k++) tot[k] += F[f * NB + k];
        let reg = 0;
        for (let k = 1; k < NB; k++) if (tot[k] > tot[reg]) reg = k;
        const inReg = {};
        let others = 0, best = null, bestP = 0;
        for (const name of Object.keys(vs)) {
          let p = 0;
          for (const f of active) p += vs[name].frames[f * NB + reg] || 0;
          inReg[name] = p;
          if (name !== lead) { others += p; if (p > bestP) { bestP = p; best = name; } }
        }
        out.melody = {
          lead, register: OCT[reg] + '-' + OCT[reg + 1] + ' Hz', leadActivePct: Math.round((100 * active.length) / Math.max(1, nf)),
          vsLoudestOtherDb: r1(dBp(inReg[lead] / Math.max(1e-20, bestP))), loudestOther: best,
          vsAllOthersDb: r1(dBp(inReg[lead] / Math.max(1e-20, others))),
        };
      }
      for (const k of Object.keys(vs)) { delete vs[k].frames; delete vs[k].nf; }
      out.voicesSolo = vs;
    }
    return out;
  };

  M.sfx = async function (id) {
    const r = await M.render(id, 3);
    if (!r) return null;
    const L = r.buf.getChannelData(0), R = r.buf.numberOfChannels > 1 ? r.buf.getChannelData(1) : L;
    const b = basic(L, R), sr = r.buf.sampleRate, m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = (L[i] + R[i]) / 2;
    const e = env(m, 0, m.length, Math.round(0.05 * sr), Math.round(0.025 * sr));
    return { id, peakDb: r1(dB(b.pk)), loud50msDb: r1(dB(Math.max.apply(null, e))), nan: b.nan, clipped: b.clip };
  };

  // 22.05 kHz mono 16-bit PCM (base64) of the first `seconds`
  M.wav = async function (id, seconds) {
    const r = await M.render(id, seconds);
    if (!r) return null;
    const sr = r.buf.sampleRate, L = r.buf.getChannelData(0), R = r.buf.numberOfChannels > 1 ? r.buf.getChannelData(1) : L;
    const dec = Math.round(sr / 22050), taps = 63, fc = 0.45 / dec, h = new Float64Array(taps);
    let hs = 0;
    for (let i = 0; i < taps; i++) {
      const x = i - (taps - 1) / 2;
      const s = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
      h[i] = s * (0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1)));
      hs += h[i];
    }
    const n = Math.floor(L.length / dec), pcm = new Int16Array(n);
    let pk = 0;
    for (let i = 0; i < n; i++) {
      let acc = 0;
      const c = i * dec;
      for (let k = 0; k < taps; k++) { const j = c + k - (taps >> 1); if (j >= 0 && j < L.length) acc += h[k] * (L[j] + R[j]) * 0.5; }
      acc /= hs;
      if (Math.abs(acc) > pk) pk = Math.abs(acc);
      pcm[i] = Math.max(-32767, Math.min(32767, Math.round(acc * 32767)));
    }
    const u8 = new Uint8Array(pcm.buffer);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(s), sr: Math.round(sr / dec), peak: pk };
  };
}

function wavFile(pcm, sr) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const mkPage = async () => {
    const p = await browser.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('about:blank');
    await p.addScriptTag({ path: AUDIO });
    await p.evaluate('(' + pageLib.toString() + ')()');
    await p.evaluate(() => window.__M.captureDefs());
    await p.addScriptTag({ path: MUSIC });
    p.__errs = errs;
    return p;
  };
  const p0 = await mkPage();
  let ids = await p0.evaluate(() => window.CT.audio.tracks());
  if (args.ids) ids = String(args.ids).split(',').filter((x) => ids.includes(x));
  const report = args.report ? JSON.parse(fs.readFileSync(args.report, 'utf8')) : [];
  const expect = {};
  for (const r of report) expect[r.id] = r.expect;
  const leads = args.leads ? JSON.parse(fs.readFileSync(args.leads, 'utf8')) : {};
  const result = { audio: AUDIO, music: MUSIC, tracks: {}, errors: [] };

  if (!args.wavonly) {
    const jobs = Math.max(1, +(args.jobs || 3));
    const pages = [p0];
    for (let i = 1; i < Math.min(jobs, ids.length); i++) pages.push(await mkPage());
    const queue = ids.slice();
    await Promise.all(pages.map(async (p) => {
      for (;;) {
        const id = queue.shift();
        if (!id) break;
        const t = Date.now();
        try {
          result.tracks[id] = await p.evaluate(([i, o]) => window.__M.track(i, o), [id, { voices: !!args.voices, expect: expect[id] || null, lead: leads[id] || null }]);
        } catch (e) { result.tracks[id] = { id, error: String(e).slice(0, 300) }; }
        process.stderr.write(id + ' ' + ((Date.now() - t) / 1000).toFixed(1) + 's\n');
      }
    }));
    for (const p of pages) for (const e of p.__errs) result.errors.push(e);
    if (args.sfx) {
      result.sfx = {};
      const sids = await p0.evaluate(() => window.CT.audio.sfxList());
      for (const s of sids) result.sfx[s] = await p0.evaluate((i) => window.__M.sfx(i), s);
    }
    const ordered = {};
    for (const id of ids) ordered[id] = result.tracks[id];
    result.tracks = ordered;
    if (args.out) fs.writeFileSync(args.out, JSON.stringify(result, null, 1));
    // console summary
    const f = (x, w) => String(x == null ? '-' : x).padStart(w);
    console.log('id                  sec  peak   rms   dBA crest clip nan lead-ms gap-ms side  cen  bands% sub/bass/lowmid/mid/treb/air   n/s poly  rtf');
    for (const id of ids) {
      const t = result.tracks[id];
      if (!t || t.error) { console.log(id, 'ERROR', t && t.error); continue; }
      console.log(id.padEnd(18) + f(t.sec, 6) + f(t.peakDb, 6) + f(t.rmsDb, 6) + f(t.dBA, 6) + f(t.crest, 6) + f(t.clipped, 5) + f(t.nan, 4) + f(t.leadSilenceMs, 8) +
        f(t.longestGapMs, 7) + f(Math.max(-99, t.sideDb), 7) + f(t.centroid, 5) + '  ' + t.bandPct.map((x) => f(x, 5)).join('') + f(t.density ? t.density.notesPerSec : '-', 7) + f(t.density ? t.density.maxPoly : '-', 5) + f(t.rtf, 6));
    }
    console.log('\nloop seams (dip: dB below local level; click: dB above the 99.9% sample step; bars = same statistic at the other bar lines)');
    for (const id of ids) {
      const t = result.tracks[id];
      if (!t || !t.loop) continue;
      const l = t.loop;
      console.log(id.padEnd(18) + ' loopStart ' + f(t.loopStartSec, 6) + 's  seam dip ' + f(l.seamDipDb, 6) + ' (bars med ' + f(l.barDipMedian, 6) + ' worst ' + f(l.barDipWorst, 6) + ')  click ' + f(l.seamClickDb, 6) +
        ' (bars med ' + f(l.barClickMedian, 6) + ' worst ' + f(l.barClickWorst, 6) + ')  step ' + f(l.seamStepDb, 6) + '  pass2 diff ' + f(l.pass2EnvDiffDb, 5));
    }
    if (report.length) {
      console.log('\nsource notes missing from the arrangement');
      for (const id of ids) { const d = result.tracks[id] && result.tracks[id].dropped; if (d) console.log(id.padEnd(18) + ' melodic ' + f(d.melLost, 5) + ' / ' + f(d.melSrc, 5) + '   drums ' + f(d.drumLost, 5) + ' / ' + f(d.drumSrc, 5)); }
    }
    if (args.voices) {
      console.log('\nmelody on top? (power inside the lead voice\'s strongest octave, while the lead plays)');
      for (const id of ids) { const m = result.tracks[id] && result.tracks[id].melody; if (m) console.log(id.padEnd(18) + ' lead ' + m.lead.padEnd(10) + ' ' + m.register.padEnd(13) + ' vs loudest other (' + m.loudestOther + ') ' + f(m.vsLoudestOtherDb, 6) + ' dB   vs all others ' + f(m.vsAllOthersDb, 6) + ' dB'); }
    }
    if (result.errors.length) console.log('\npage errors:', result.errors.slice(0, 10));
  }
  if (args.wav) {
    fs.mkdirSync(args.wav, { recursive: true });
    const wid = args.wavids ? String(args.wavids).split(',') : ids;
    for (const id of wid) {
      const w = await p0.evaluate(([i, s]) => window.__M.wav(i, s), [id, +(args.wavsec || 75)]);
      if (!w) { console.log('wav failed', id); continue; }
      const file = path.join(args.wav, id + (args.wavtag ? '_' + args.wavtag : '') + '.wav');
      fs.writeFileSync(file, wavFile(Buffer.from(w.b64, 'base64'), w.sr));
      console.log('wrote', file, fs.statSync(file).size, 'bytes peak', w.peak.toFixed(3));
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
