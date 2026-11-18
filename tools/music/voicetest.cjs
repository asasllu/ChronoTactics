// voicetest.cjs — per-instrument checks through the real voice path (envelope, loop, vibrato, tuning):
//   * click detector at note-on, during the sustain (loop wraps), at note-off and at the final stop
//   * tuning of the rendered note at several pitches (FFT peak vs equal temperament)
//   * vibrato: pitch wobble late in a long note vs early (delay)
//   * SFX over music: peak, clipping and how quickly the limiter lets the music back up
//   PW=/opt/node22/lib/node_modules/playwright node tools/music/voicetest.cjs [--music FILE]
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const arg = (k, d) => (process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d);
const ROOT = path.resolve(__dirname, '../..');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('about:blank');
  await p.addScriptTag({ path: path.join(ROOT, 'public/js/audio.js') });
  await p.addScriptTag({ path: path.resolve(arg('music', path.join(ROOT, 'public/js/music_ct.js'))) });
  const res = await p.evaluate(async () => {
    const A = window.CT.audio, SR = 44100, T0 = 0.02;
    const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -200);
    const mono = (buf) => { const l = buf.getChannelData(0), r = buf.getChannelData(1), m = new Float32Array(l.length); for (let i = 0; i < l.length; i++) m[i] = (l[i] + r[i]) / 2; return m; };
    // second difference = click detector
    const d2max = (x, a, b) => { let m = 0; for (let i = Math.max(2, a); i < Math.min(x.length, b); i++) m = Math.max(m, Math.abs(x[i] - 2 * x[i - 1] + x[i - 2])); return m; };
    const pctl = (x, a, b, q) => { const v = []; for (let i = Math.max(2, a); i < Math.min(x.length, b); i += 3) v.push(Math.abs(x[i] - 2 * x[i - 1] + x[i - 2])); v.sort((p, q2) => p - q2); return v[Math.floor(q * (v.length - 1))] || 1e-12; };
    const peakFreq = (x, a, n, f0) => {
      // refine around f0 with a zoomed DFT (Hann)
      let best = 0, bf = f0;
      for (let c = -80; c <= 80; c += 1) {
        const f = f0 * Math.pow(2, c / 1200), w = (2 * Math.PI * f) / SR;
        let re = 0, im = 0;
        for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); re += x[a + i] * h * Math.cos(w * i); im += x[a + i] * h * Math.sin(w * i); }
        const pw = re * re + im * im;
        if (pw > best) { best = pw; bf = f; }
      }
      return bf;
    };
    const out = { patches: [], tuning: [], sfx: null };
    const names = A._patches().filter((n) => n !== 'drums');
    const bpm = 60; // 1 beat = 1 s, 48 ticks
    for (const name of names) {
      const noteDur = 2.0;
      A.define('mus__t', { bpm, meter: [4, 4], bars: 2, loop: 0, oneShot: true, echo: [0.5, 0, 0], v: { a: [name, 'q8 o4 c2 r2 r1'] } });
      const buf = await A._renderOffline('mus__t', 8);
      const x = mono(buf);
      const on = Math.round(T0 * SR), off = Math.round((T0 + noteDur) * SR);
      let pk = 0;
      for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
      // reference: typical curvature of the sustained middle of the note
      const ref = pctl(x, on + Math.round(0.5 * SR), off - 2000, 0.999);
      const cOn = d2max(x, on - 20, on + Math.round(0.004 * SR)) / ref;
      const cSus = d2max(x, on + Math.round(0.6 * SR), off - 2000) / ref;
      const cOff = d2max(x, off - 200, off + Math.round(0.03 * SR)) / ref;
      // tail: from 30 ms after note-off to the end
      const cTail = d2max(x, off + Math.round(0.03 * SR), x.length) / ref;
      // when is it silent again
      let last = x.length - 1;
      while (last > off && Math.abs(x[last]) < pk * 0.001) last--;
      // vibrato: std of zero-crossing periods early vs late
      const zc = (a, bb) => { const t = []; for (let i = a + 1; i < bb; i++) if (x[i - 1] <= 0 && x[i] > 0) t.push(i - 1 + -x[i - 1] / (x[i] - x[i - 1])); const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]); const m = d.reduce((s, v) => s + v, 0) / Math.max(1, d.length); const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, d.length)); return m ? (1200 * sd) / m / Math.LN2 : 0; };
      out.patches.push({ name, peakDb: +dB(pk).toFixed(1), clickOn: +cOn.toFixed(1), clickSus: +cSus.toFixed(1), clickOff: +cOff.toFixed(1), clickTail: +cTail.toFixed(1),
        tailMs: Math.round(((last - off) / SR) * 1000), nan: x.some((v) => v !== v) ? 1 : 0 });
    }
    // tuning through the voice path
    for (const name of ['strings', 'brass', 'flute', 'piano', 'bass', 'organ', 'musicbox', 'choir', 'slap', 'steeldrum']) {
      const errsC = [];
      for (const midi of [31, 36, 43, 50, 57, 64, 71, 78, 85, 92]) {
        A.define('mus__t', { bpm, meter: [4, 4], bars: 1, loop: 0, oneShot: true, echo: [0.5, 0, 0], v: { a: [name, 'q8 l1 n' + midi] } });
        const buf = await A._renderOffline('mus__t', 1.6);
        const x = mono(buf);
        const f0 = 440 * Math.pow(2, (midi - 69) / 12);
        const f = peakFreq(x, Math.round(0.45 * SR), 16384, f0);
        errsC.push(Math.round(1200 * Math.log2(f / f0)));
      }
      out.tuning.push({ name, cents: errsC });
    }
    // SFX on top of the battle theme
    const sfxAt = [['sfx_battle_start', 3], ['sfx_thunder_big', 6], ['sfx_crit', 9], ['sfx_dark_bomb', 11]];
    const withS = mono(await A._renderOffline('mus_battle', 16, null, { sfxAt })), without = mono(await A._renderOffline('mus_battle', 16));
    const r = (x, a, bb) => { let s = 0; for (let i = Math.round(a * SR); i < Math.round(bb * SR); i++) s += x[i] * x[i]; return Math.sqrt(s / Math.round((bb - a) * SR)); };
    let pk = 0, clip = 0;
    for (let i = 0; i < withS.length; i++) { const v = Math.abs(withS[i]); if (v > pk) pk = v; if (v >= 0.999) clip++; }
    out.sfx = { peakDb: +dB(pk).toFixed(2), clipped: clip, musicRmsDb: +dB(r(without, 2, 14)).toFixed(1), mixRmsDb: +dB(r(withS, 2, 14)).toFixed(1),
      // music level in windows that start 1.5 s after an SFX began (thunder is still ringing) and 1 s before the next
      afterThunderDiffDb: +(dB(r(withS, 8.3, 8.9)) - dB(r(without, 8.3, 8.9))).toFixed(2), afterCritDiffDb: +(dB(r(withS, 10.4, 10.9)) - dB(r(without, 10.4, 10.9))).toFixed(2),
      endDiffDb: +(dB(r(withS, 14.5, 15.5)) - dB(r(without, 14.5, 15.5))).toFixed(2) };
    return out;
  });
  console.log('patch        peak  click@on  sustain  @off  tail  tail ms   (click = worst curvature / 99.9 % curvature of the held note; > 8 would be audible)');
  let bad = 0;
  for (const r of res.patches) {
    const flag = r.nan || r.clickOn > 8 || r.clickSus > 8 || r.clickOff > 8 || r.clickTail > 8 ? '  <-- CHECK' : '';
    if (flag) bad++;
    console.log(r.name.padEnd(12), String(r.peakDb).padStart(6), String(r.clickOn).padStart(8), String(r.clickSus).padStart(8), String(r.clickOff).padStart(6), String(r.clickTail).padStart(6), String(r.tailMs).padStart(7), flag);
  }
  console.log('\ntuning error in cents at MIDI 31 36 43 50 57 64 71 78 85 92');
  for (const t of res.tuning) console.log('  ' + t.name.padEnd(10) + t.cents.map((c) => String(c).padStart(5)).join(''));
  console.log('\nSFX over the battle theme:', JSON.stringify(res.sfx));
  console.log('flagged', bad, 'errors', errs);
  await b.close();
})();
