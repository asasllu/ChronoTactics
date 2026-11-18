// automix.cjs — turn measurements into a mix. Reads a measure.cjs result (run with --voices) and the
// converter report (roles per voice), and writes tools/music/mix.json: a multiplier per voice and a
// gain per track. midi2ct.py applies them on top of the levels found in the MIDI.
//
//   node tools/music/automix.cjs --measure result.json --report report.json [--mix tools/music/mix.json] [--gainonly]
//
// Targets, relative to the melody (lead) voice while it plays:
//   counter melody -3 dB(A) · accompaniment -6 dB(A) · pads -8 dB(A)      (A-weighted: how loud they sound)
//   bass -2 dB · timpani / pitched percussion -5 dB                       (unweighted RMS: low end)
//   drum kit: halfway between -6 dB unweighted (kick) and -9 dB(A) (snare, hats)
//   several voices in one role share it (each drops by 5 log10 n); no voice's peak may exceed the
//   melody's by more than 4 dB (bass 3, drums 1); role 'fx' is left at the sequence's level.
// The track gain then puts the full mix at the track's target RMS (see TRACKS in midi2ct.py).
const fs = require('fs');
const path = require('path');
const args = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) { const nx = process.argv[i + 1]; if (nx == null || nx.startsWith('--')) args[process.argv[i].slice(2)] = true; else args[process.argv[i].slice(2)] = process.argv[++i]; }
const mixFile = args.mix || path.join(__dirname, 'mix.json');
const meas = JSON.parse(fs.readFileSync(args.measure, 'utf8'));
const report = JSON.parse(fs.readFileSync(args.report, 'utf8'));
const mix = fs.existsSync(mixFile) ? JSON.parse(fs.readFileSync(mixFile, 'utf8')) : {};
const A_REL = { counter: -3, acc: -6, pad: -8 };
const U_REL = { bass: -2, perc: -5, drums: -6 };
const DRUMS_A = -9;   // the kit is judged half by its low end (kick) and half by how loud snare / hats sound
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
for (const rep of report) {
  const t = meas.tracks[rep.id];
  if (!t || t.error) continue;
  const m = mix[rep.id] || (mix[rep.id] = { gain: 1, v: {} });
  m.v = m.v || {};
  const vs = t.voicesSolo;
  let predicted = 0;
  if (vs && !args.gainonly) {
    const act = (v) => 10 * Math.log10(Math.max(1, v.activePct) / 100);
    const lead = rep.voices.find((v) => v.role === 'lead' && vs[v.name]);
    if (lead) {
      const L = vs[lead.name], LdBA = L.dBA - act(L), Lrms = L.activeRmsDb;
      const count = {};
      for (const v of rep.voices) count[v.role] = (count[v.role] || 0) + 1;
      for (const v of rep.voices) {
        const s = vs[v.name];
        if (!s || v.role === 'lead' || v.role === 'fx' || s.activePct < 1) continue;   // 'fx': keep the sequence's own level
        const share = -5 * Math.log10(count[v.role]);
        let diff;
        if (A_REL[v.role] != null) diff = LdBA + A_REL[v.role] + share - (s.dBA - act(s));
        else if (v.role === 'drums') diff = 0.5 * (Lrms + U_REL.drums - s.activeRmsDb) + 0.5 * (LdBA + DRUMS_A - (s.dBA - act(s)));
        else diff = Lrms + U_REL[v.role] + share - s.activeRmsDb;
        // peaks: nothing may tower over the melody (percussive parts get some room)
        const cap = L.peakDb + (v.role === 'drums' ? 1 : v.role === 'bass' || v.role === 'perc' ? 3 : 4);
        if (s.peakDb + diff > cap) diff = cap - s.peakDb;
        const old = m.v[v.name] || 1;
        // stay within about +-9 dB of the level the sequence asked for
        m.v[v.name] = +clamp(old * Math.pow(10, diff / 20), 0.3, 2.8).toFixed(3);
      }
    }
  }
  // track gain: full-mix RMS -> target (re-measure and run again with --gainonly to converge)
  const target = rep.target != null ? rep.target : -20.5;
  if (!vs || args.gainonly) m.gain = +clamp(m.gain * Math.pow(10, (target - t.rmsDb) / 20), 0.1, 6).toFixed(3);
  void predicted;
}
fs.writeFileSync(mixFile, JSON.stringify(mix, null, 1) + '\n');
console.log('wrote', mixFile);
