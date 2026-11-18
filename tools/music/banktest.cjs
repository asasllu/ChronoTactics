// banktest.cjs — sanity-check every synthesized instrument sample of the music engine (no ears needed):
// pitch of the loop vs the nominal root, loop-wrap continuity, level of attack vs loop, brightness,
// NaNs, build time and memory.
//   PW=/opt/node22/lib/node_modules/playwright node tools/music/banktest.cjs [--audio FILE] [--drums]
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const AUDIO = path.resolve(process.argv.includes('--audio') ? process.argv[process.argv.indexOf('--audio') + 1] : path.join(__dirname, '../../public/js/audio.js'));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('about:blank');
  await p.addScriptTag({ path: AUDIO });
  const rows = await p.evaluate((wantDrums) => {
    const A = window.CT.audio, SR = 32000, out = [];
    const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -200);
    const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
    const centroid = (x, a, n) => {
      // crude: zero-crossing-free spectral centroid via DFT on up to 4096 samples
      const N = Math.min(1024, n);
      let num = 0, den = 0;
      for (let k = 1; k < N / 2; k += 3) {
        let r = 0, m = 0;
        const w = (2 * Math.PI * k) / N;
        for (let i = 0; i < N; i++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N); r += x[a + i] * h * Math.cos(w * i); m -= x[a + i] * h * Math.sin(w * i); }
        const pw = r * r + m * m;
        num += pw * ((k * SR) / N); den += pw;
      }
      return den ? Math.round(num / den) : 0;
    };
    for (const name of A._patches()) {
      if (name === 'drums') continue;
      for (const midi of [36, 48, 60, 72, 84]) {
        const t0 = performance.now();
        const z = A._zone(name, midi);
        const ms = performance.now() - t0;
        const x = z.data, a = Math.round(z.ls * SR), e = Math.round(z.le * SR), N = e - a;
        let nan = 0, pk = 0;
        for (let i = 0; i < x.length; i++) { if (x[i] !== x[i]) nan++; pk = Math.max(pk, Math.abs(x[i])); }
        // loop wrap: step from the last loop sample back to the first vs the largest step inside the loop
        let mx = 1e-12;
        for (let i = a + 1; i < e; i++) mx = Math.max(mx, Math.abs(x[i] - x[i - 1]));
        const wrap = Math.abs(x[a] - x[e - 1]) / mx;
        // pitch by autocorrelation around the nominal period
        const f0n = 440 * Math.pow(2, (midi - 69) / 12) * Math.pow(2, Math.round((Math.round(midi / 12) * 12 - midi)) / 12);
        const P0 = SR / z.f0;
        let best = 0, bl = P0;
        for (let lag = P0 * 0.97; lag <= P0 * 1.03; lag += P0 * 0.001) {
          let s = 0;
          const M = Math.min(N - Math.ceil(lag) - 2, 2500);
          for (let i = 0; i < M; i++) { const j = a + i + lag, j0 = Math.floor(j), fr = j - j0; s += x[a + i] * (x[j0] + (x[j0 + 1] - x[j0]) * fr); }
          if (s > best) { best = s; bl = lag; }
        }
        const cents = 1200 * Math.log2(P0 / bl);
        const nomCents = 1200 * Math.log2(z.f0 / (440 * Math.pow(2, (12 * Math.round(midi / 12) - 69) / 12)));
        out.push({ name, midi, ms: +ms.toFixed(1), kb: Math.round((x.length * 4) / 1024), nan, peak: +pk.toFixed(2), attDb: +dB(rms(x, 0, Math.min(a, 3200))).toFixed(1), loopDb: +dB(rms(x, a, e)).toFixed(1),
          wrap: +wrap.toFixed(2), cents: +cents.toFixed(1), tune: +nomCents.toFixed(2), cen: centroid(x, a, N), cenAtt: centroid(x, 0, a) });
      }
    }
    if (wantDrums) {
      for (let k = 35; k <= 92; k++) {
        try {
          const z = A._zone('drums', k), x = z.data;
          let nan = 0, pk = 0;
          for (let i = 0; i < x.length; i++) { if (x[i] !== x[i]) nan++; pk = Math.max(pk, Math.abs(x[i])); }
          out.push({ name: 'drum' + k, midi: k, ms: 0, kb: Math.round((x.length * 4) / 1024), nan, peak: +pk.toFixed(2), attDb: +dB(rms(x, 0, Math.min(x.length, 1600))).toFixed(1), loopDb: +dB(rms(x, 0, x.length)).toFixed(1), wrap: 0, cents: 0, tune: 0, cen: centroid(x, 0, x.length), cenAtt: 0 });
        } catch (e) { /* key not defined */ }
      }
    }
    return out;
  }, process.argv.includes('--drums'));
  console.log('patch        note  ms   kB nan peak  att dB loop dB wrap  cents  tune  centroid(loop) centroid(attack)');
  let tot = 0, kb = 0, bad = 0;
  for (const r of rows) {
    tot += r.ms; kb += r.kb;
    const flag = (r.nan || r.wrap > 1.5 || Math.abs(r.cents) > 60 || Math.abs(r.tune) > 3) ? '  <-- CHECK' : '';
    if (flag) bad++;
    console.log(r.name.padEnd(12), String(r.midi).padStart(3), String(r.ms).padStart(6), String(r.kb).padStart(5), String(r.nan).padStart(2), String(r.peak).padStart(5), String(r.attDb).padStart(7), String(r.loopDb).padStart(7),
      String(r.wrap).padStart(5), String(r.cents).padStart(6), String(r.tune).padStart(6), String(r.cen).padStart(7), String(r.cenAtt).padStart(7), flag);
  }
  console.log('zones', rows.length, 'build ms', tot.toFixed(0), 'MB', (kb / 1024).toFixed(1), 'flagged', bad, 'errors', errs);
  await b.close();
})();
