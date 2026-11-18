#!/usr/bin/env python3
"""midi2ct.py — convert fan-sequenced Chrono Trigger MIDIs into CT.audio track defs.

Usage:
  python3 -I tools/music/midi2ct.py [--src tools/music/midi] [--out public/js/music_ct.js]
                                    [--report report.json] [--only id,id] [--mix tools/music/mix.json]

Every track in TRACKS (bottom of this file) is converted from <src>/<file> into one
`CT.audio.define(id, def)` call (see public/js/audio.js for the def format):

  * tempo map -> bpm (+ `tempo` changes) x the track's `slow` factor
  * notes are quantized to the engine's 48-PPQ grid (nearest 1/32 or 1/16-triplet by default)
  * one voice per MIDI channel; a channel's polyphony becomes extra "lanes" (MML strings) of that
    voice, so no note is dropped or merged away (the report counts what is missing: it must be 0)
  * dynamics: note velocity -> v, CC7 x CC11 automation -> x/X expression ramps, pitch bend -> y/Y,
    CC10 -> pan (auto-spread when the sequence has no panning)
  * GM program -> engine patch (INSTRUMENTS in audio.js); GM percussion -> the 'drums' kit, one
    note per hit with its own velocity, simultaneous hits as chords
  * loop: per-track config, loopStart/loopEnd markers, or an auto-detected repeat
  * the per-voice mix and the track gain come from mix.json (written by automix.cjs from
    measurements of the rendered audio), on top of the levels in the MIDI

Pure Python 3, no dependencies (reads MIDI with midiparse.py next to this file).
"""
import argparse
import json
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import midiparse  # noqa: E402

PPQ = 48
HERE = os.path.dirname(os.path.abspath(__file__))

# ----------------------------------------------------------------------------------------
# GM program -> engine patch (PATCH keys in audio.js). None = drop the notes.
# ----------------------------------------------------------------------------------------
GM = {}
for p in range(0, 4): GM[p] = 'piano'
for p in (4, 5): GM[p] = 'epiano'
for p in (6, 7): GM[p] = 'harpsi'
GM.update({8: 'celesta', 9: 'glock', 10: 'musicbox', 11: 'vibes', 12: 'marimba', 13: 'xylo', 14: 'bell', 15: 'harp'})
for p in (16, 17, 18): GM[p] = 'organ'
GM.update({19: 'pipe', 20: 'pipe', 21: 'accordion', 22: 'accordion', 23: 'accordion'})
for p in (24, 25, 26, 27, 28): GM[p] = 'guitar'
GM.update({29: 'odguitar', 30: 'odguitar', 31: 'crystal'})
GM.update({32: 'bass', 33: 'bass', 34: 'pbass', 35: 'fretless', 36: 'slap', 37: 'slap', 38: 'sbass', 39: 'sbass'})
for p in (40, 41, 42, 43, 44): GM[p] = 'strings'
GM.update({45: 'pizz', 46: 'harp', 47: 'timp'})
GM.update({48: 'strings', 49: 'slowstr', 50: 'strings', 51: 'slowstr', 52: 'choir', 53: 'ooh', 54: 'ooh', 55: 'orchhit'})
GM.update({56: 'trumpet', 57: 'lowbrass', 58: 'tuba', 59: 'trumpet', 60: 'horn', 61: 'brass', 62: 'brass', 63: 'brass'})
GM.update({64: 'sax', 65: 'sax', 66: 'sax', 67: 'sax', 68: 'oboe', 69: 'oboe', 70: 'clarinet', 71: 'clarinet'})
GM.update({72: 'flute', 73: 'flute', 74: 'ocarina', 75: 'panflute', 76: 'panflute', 77: 'panflute', 78: 'ocarina', 79: 'ocarina'})
GM.update({80: 'lead', 81: 'sawlead', 82: 'panflute', 83: 'panflute', 84: 'odguitar', 85: 'ooh', 86: 'sawlead', 87: 'sbass'})
GM.update({88: 'crystal', 89: 'pad', 90: 'pad', 91: 'choir', 92: 'pad', 93: 'crystal', 94: 'choir', 95: 'pad'})
GM.update({96: 'crystal', 97: 'pad', 98: 'crystal', 99: 'crystal', 100: 'crystal', 101: 'pad', 102: 'pad', 103: 'pad'})
GM.update({104: 'sitar', 105: 'guitar', 106: 'guitar', 107: 'harp', 108: 'kalimba', 109: 'accordion', 110: 'strings', 111: 'oboe'})
GM.update({112: 'glock', 113: 'steeldrum', 114: 'steeldrum', 115: 'log', 116: 'taiko', 117: 'taiko', 118: 'taiko', 119: None})
GM.update({120: None, 121: 'wind', 122: 'wind', 123: None, 124: None, 125: None, 126: None, 127: None})
BASSLIKE = {'bass', 'pbass', 'slap', 'fretless', 'sbass', 'tuba', 'sub', 'timp', 'taiko'}

# note value (ticks) -> MML length token
LENTOK = {192: '1', 288: '1.', 144: '2.', 168: '2..', 96: '2', 72: '4.', 84: '4..', 64: '3', 48: '4', 36: '8.', 32: '6',
          24: '8', 18: '16.', 16: '12', 12: '16', 9: '32.', 8: '24', 6: '32', 4: '48', 3: '64', 2: '96'}
NAMES = ['c', 'c+', 'd', 'd+', 'e', 'f', 'f+', 'g', 'g+', 'a', 'a+', 'b']


def velc(v):
    """MIDI velocity -> amplitude"""
    return (max(1, v) / 127.0) ** 1.3


def volc(c):
    """MIDI volume / expression controller -> amplitude"""
    return (max(0, c) / 127.0) ** 1.5


# ----------------------------------------------------------------------------------------
def main_tempo(s):
    acc = Counter()
    end = max([n.tick + n.dur for n in s.notes] + [s.end])
    for k, (t0, us, *_r) in enumerate(s.tempos):
        t1 = s.tempos[k + 1][0] if k + 1 < len(s.tempos) else end
        acc[round(60e6 / us, 2)] += max(0, t1 - t0)
    if not acc:
        return 120.0
    return acc.most_common(1)[0][0]


def at_time(lst, tick, default):
    """value of the last (tick, value) event at or before tick (first value if none before)."""
    if not lst:
        return default
    v = lst[0][1]
    for t, x, *_r in lst:
        if t <= tick:
            v = x
        else:
            break
    return v


def snap(x, grids):
    best = None
    for g in grids:
        c = round(x / g) * g
        if best is None or abs(c - x) < abs(best - x) - 1e-9:
            best = c
    return int(best)


class N:
    __slots__ = ('s', 'e', 'p', 'v', 'ch', 'inst', 'trk', 'src')

    def __init__(self, s, e, p, v, ch, inst, trk, src=None):
        self.s, self.e, self.p, self.v, self.ch, self.inst, self.trk, self.src = s, e, p, v, ch, inst, trk, src


class N:  # noqa: F811  (one note; replaces the minimal class above)
    __slots__ = ('s', 'e', 'p', 'v', 'ch', 'inst', 'trk', 'amp', 'pan')

    def __init__(self, s, e, p, v, ch, inst, trk):
        self.s, self.e, self.p, self.v, self.ch, self.inst, self.trk = s, e, p, v, ch, inst, trk
        self.amp, self.pan = velc(v), None


# ----------------------------------------------------------------------------------------
# controller automation -> a few breakpoints
# ----------------------------------------------------------------------------------------
def rdp(pts, eps):
    """Ramer-Douglas-Peucker on [(t, v)] using the vertical distance."""
    if len(pts) < 3:
        return pts[:]
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (t0, v0), (t1, v1) = pts[a], pts[b]
        worst, wi = 0, None
        for i in range(a + 1, b):
            t, v = pts[i]
            d = abs(v - (v0 + (v1 - v0) * (t - t0) / max(1e-9, t1 - t0)))
            if d > worst:
                worst, wi = d, i
        if wi is not None and worst > eps:
            keep[wi] = True
            stack.append((a, wi))
            stack.append((wi, b))
    return [p for p, k in zip(pts, keep) if k]


def automation(steps, eps, maxgap, grid=6):
    """Stepped controller values [(tick, value)] -> [(tick, value, ramp)].

    Steps closer than `maxgap` ticks are read as one continuous sweep (ramp), anything else as a
    jump. Ticks are snapped to `grid`."""
    if not steps:
        return []
    runs, cur = [], [steps[0]]
    for (t, v) in steps[1:]:
        if t - cur[-1][0] > maxgap:
            runs.append(cur)
            cur = [(t, v)]
        elif t == cur[-1][0]:
            cur[-1] = (t, v)
        else:
            cur.append((t, v))
    runs.append(cur)
    out = []
    for run in runs:
        pts = rdp(run, eps)
        for i, (t, v) in enumerate(pts):
            t = int(round(t / grid)) * grid
            ramp = i > 0
            if out and out[-1][0] == t:
                out[-1] = (t, v, out[-1][2])
            elif out and abs(out[-1][1] - v) < eps * 0.5 and not ramp:
                continue
            else:
                out.append((t, v, ramp))
    return out


def value_at(auto, tick, default):
    """value of an automation list [(tick, value, ramp)] at `tick`"""
    v = default
    for i, (t, x, ramp) in enumerate(auto):
        if t <= tick:
            v = x
        else:
            if ramp and i > 0:
                t0, v0 = auto[i - 1][0], auto[i - 1][1]
                v = v0 + (x - v0) * (tick - t0) / max(1, t - t0)
            break
    return v


# ----------------------------------------------------------------------------------------
def load(path, cfg):
    s = midiparse.read(path)
    scale = cfg.get('scale', 1.0)
    f = lambda t: t * PPQ / s.ppq * scale  # noqa: E731
    grids = cfg.get('grid', [6, 8])
    drop = set(c - 1 for c in cfg.get('drop', []))
    notes, drums = [], []
    instov = {k - 1: v for k, v in cfg.get('inst', {}).items()}
    tr = {k - 1: v for k, v in cfg.get('transpose', {}).items()}
    drumch = set(c - 1 for c in cfg.get('drumch', [10]))
    tokit = {k - 1: v for k, v in cfg.get('tokit', {}).items()}
    dmap = cfg.get('drummap', {})
    for n in s.notes:
        if n.ch in drop or (cfg.get('droptrk') and n.track in cfg['droptrk']):
            continue
        st = f(n.tick)
        if st < -1:
            continue
        st = max(0, snap(st, grids))
        if n.ch in tokit:
            drums.append(N(st, st + 6, tokit[n.ch], n.vel, n.ch, 'drums', n.track))
            continue
        if n.ch in drumch:
            key = dmap.get(n.pitch, n.pitch)
            if key:
                drums.append(N(st, st + 6, key, n.vel, n.ch, 'drums', n.track))
            continue
        en = snap(f(n.tick + n.dur), grids)
        if en <= st:
            en = st + min(grids)
        prog = at_time(s.programs.get(n.ch, []), n.tick, 0)
        inst = instov.get(n.ch)
        if isinstance(inst, dict):
            inst = inst.get(prog, inst.get('*'))
        if inst is None:
            inst = GM.get(prog, 'lead')
        if inst is None or inst == 'drop':
            continue
        notes.append(N(st, en, n.pitch + tr.get(n.ch, 0), n.vel, n.ch, inst, n.track))
    # tempo map in output ticks (tempo changes smaller than 2 % are folded away)
    tempos = []
    for t, us, *_r in s.tempos:
        bpm = 60e6 / us * scale
        ot = int(round(f(t)))
        if tempos and tempos[-1][0] == ot:
            tempos[-1] = (ot, bpm)
        elif not tempos or abs(bpm / tempos[-1][1] - 1) > 0.02:
            tempos.append((ot, bpm))
    markers = {}
    for t, m in s.markers:
        ml = m.strip().lower()
        if ml in ('loopstart', 'loopend'):
            markers[ml] = round(f(t))
    # controller automation per channel
    vol, bend, pan = {}, {}, {}
    chans = set(n.ch for n in notes) | set(x.ch for x in drums)
    for ch in chans:
        cc = s.cc.get(ch, {})
        ev = sorted([(t, 7, v) for t, v in cc.get(7, [])] + [(t, 11, v) for t, v in cc.get(11, [])])
        c7, c11, steps = 100, 127, []
        for t, k, v in ev:
            if k == 7:
                c7 = v
            else:
                c11 = v
            steps.append((f(t), volc(c7) * volc(c11)))
        vol[ch] = steps or [(0, volc(100))]
        rng = cfg.get('bendrange', {}).get(ch + 1, s.bend_range.get(ch, 2))
        b = [(f(t), v / 8192.0 * rng * 100) for t, v in s.bends.get(ch, [])]
        if any(abs(v) > 4 for _, v in b):
            bend[ch] = b
        if cc.get(10):
            pan[ch] = [(f(t), (v - 64) / 64.0) for t, v in cc[10]]
    ts = (s.timesigs[0][1], s.timesigs[0][2]) if s.timesigs else (4, 4)
    return dict(song=s, notes=notes, drums=drums, tempos=tempos, markers=markers, vol=vol, bend=bend, pan=pan, ts=ts,
                texts=s.texts)


def dedupe_channels(notes, cfg, log):
    """Drop channels that just echo/double another channel (same pitches within 1/2 beat)."""
    bych = defaultdict(list)
    for n in notes:
        bych[n.ch].append(n)
    keep = set(c - 1 for c in cfg.get('keep', []))
    chans = sorted(bych, key=lambda c: (-sum(n.v for n in bych[c]) / len(bych[c]), min(n.s for n in bych[c])))
    dropped = set()
    for i, a in enumerate(chans):
        if a in dropped:
            continue
        idx = defaultdict(list)
        for n in bych[a]:
            idx[n.p].append(n.s)
        for b in chans[i + 1:]:
            if b in dropped or b in keep:
                continue
            nb = bych[b]
            if not (0.7 <= len(nb) / len(bych[a]) <= 1.3):
                continue
            hit = sum(1 for n in nb if any(abs(n.s - t) <= 24 for t in idx.get(n.p, ())))
            if hit / len(nb) >= 0.85:
                dropped.add(b)
                log.append(f'ch{b + 1} doubles ch{a + 1} ({hit}/{len(nb)}) -> dropped')
    return [n for n in notes if n.ch not in dropped], dropped


def make_lanes(chnotes, maxchord=4):
    """Split one channel's notes into non-overlapping lanes of single notes / chords."""
    groups = defaultdict(list)
    for n in chnotes:
        groups[(n.s, n.e)].append(n)
    gl = []
    for (s, e), ns in groups.items():
        ns = sorted(ns, key=lambda n: -n.p)
        seen, uniq = set(), []
        for n in ns:
            if n.p not in seen:
                seen.add(n.p)
                uniq.append(n)
        if len(uniq) > maxchord:  # keep top, bottom and the inner notes nearest the top
            uniq = uniq[:maxchord - 1] + [uniq[-1]]
        gl.append({'s': s, 'e': e, 'n': uniq})
    gl.sort(key=lambda g: (g['s'], -(g['e'] - g['s']), -g['n'][0].p))
    lanes = []
    for g in gl:
        best = None
        if lanes and lanes[0][-1]['e'] <= g['s']:
            best = (0, lanes[0], False)  # keep the primary line contiguous
        for L in lanes[1:] if best is None else ():
            last = L[-1]
            if last['e'] <= g['s']:
                d = abs(last['n'][0].p - g['n'][0].p)
                if best is None or d < best[0]:
                    best = (d, L, False)
        if best is None:
            for L in lanes:
                last = L[-1]
                ov = last['e'] - g['s']
                if last['s'] < g['s'] and ov <= max(6, 0.25 * (last['e'] - last['s'])):
                    best = (0, L, True)
                    break
        if best is None:
            lanes.append([g])
        else:
            if best[2]:
                best[1][-1]['e'] = g['s']
            best[1].append(g)
    return lanes


def chordify(groups_a, groups_b, maxchord=4):
    """Merge two lanes into one: notes starting together become chords, sustains are cut at the next onset."""
    by = defaultdict(list)
    for g in groups_a + groups_b:
        by[g['s']].append(g)
    starts = sorted(by)
    out = []
    for i, s in enumerate(starts):
        gs = by[s]
        e = max(g['e'] for g in gs)
        if i + 1 < len(starts):
            e = min(e, starts[i + 1])
        ns = sorted({n.p: n for g in gs for n in g['n']}.values(), key=lambda n: -n.p)
        if len(ns) > maxchord:
            ns = ns[:maxchord - 1] + [ns[-1]]
        out.append({'s': s, 'e': e, 'n': ns})
    return out


def lane_stats(L):
    ns = [n for g in L for n in g['n']]
    cov = sum(g['e'] - g['s'] for g in L)
    return {
        'notes': len(ns), 'cov': cov, 'pitch': sum(n.p for n in ns) / max(1, len(ns)),
        'vel': sum(n.v for n in ns) / max(1, len(ns)), 'inst': Counter(n.inst for n in ns).most_common(1)[0][0],
        'ch': L[0]['n'][0].ch,
    }


# ----------------------------------------------------------------------------------------
def fingerprint(notes, drums, barT, nbars):
    fp = [set() for _ in range(nbars)]
    for n in notes:
        b = n.s // barT
        if 0 <= b < nbars:
            fp[b].add((n.s - b * barT, n.p, n.ch))
    for d in drums:
        b = d.s // barT
        if 0 <= b < nbars:
            fp[b].add((d.s - b * barT, d.inst, -1))
    return fp


def bar_eq(a, b):
    if not a and not b:
        return True
    u = len(a | b)
    return u and len(a & b) / u >= 0.8


def detect_loop(fp, tail=4, minP=8):
    nb = len(fp)
    best = None
    for P in range(minP, nb):
        for S in range(0, nb - P):
            if not fp[S] and S > 0:
                pass
            m = 0
            while S + P + m < nb and bar_eq(fp[S + m], fp[S + P + m]):
                m += 1
            if S + P + m >= nb - tail and m >= max(4, 0.75 * P) and any(fp[S:S + P]):
                cand = (S + P, S, P, m)
                if best is None or cand < best:
                    best = cand
                break  # smallest S for this P that works is enough; keep scanning other P
    return best


# ----------------------------------------------------------------------------------------
def len_tok(L, dflt):
    if L == dflt:
        return ''
    return LENTOK.get(L, '%' + str(L))


def lane_tokens(groups, endT, dflt, inst0, ctl=()):
    """One lane (non-overlapping notes / chords) -> MML tokens. `ctl` = [(tick, cmd, value)] channel
    automation to weave in: notes and rests are split (tied) where a command falls inside them."""
    toks = []
    ctl = sorted(ctl)
    st = {'ci': 0}

    def span(s, e, head):
        cur, first = s, True
        while True:
            while st['ci'] < len(ctl) and ctl[st['ci']][0] <= cur:
                toks.append(ctl[st['ci']][1] + str(ctl[st['ci']][2]))
                st['ci'] += 1
            nxt = e
            if st['ci'] < len(ctl) and ctl[st['ci']][0] < e:
                nxt = ctl[st['ci']][0]
            toks.append((head if first else ('^' if head != 'r' else 'r')) + len_tok(nxt - cur, dflt))
            first = False
            cur = nxt
            if cur >= e:
                break

    pos, oct_, vel, inst, pan = 0, 4, None, inst0, None
    for g in groups:
        if g['s'] > pos:
            span(pos, g['s'], 'r')
        lead = g['n'][0]
        pre = ''
        if lead.inst != inst:
            pre += '@' + lead.inst + ' '
            inst = lead.inst
        if g['v'] != vel:
            pre += 'v%d ' % g['v']
            vel = g['v']
        if g.get('pan') is not None and g['pan'] != pan:
            pre += 'p%d ' % g['pan']
            pan = g['pan']
        if len(g['n']) == 1:
            p = lead.p
            o = p // 12 - 1
            if o != oct_:
                pre += ('>' if o == oct_ + 1 else '<' if o == oct_ - 1 else 'o%d' % o)
                oct_ = o
            head = pre + NAMES[p % 12]
        else:
            head = pre + '(' + ''.join('n%d' % n.p for n in sorted(g['n'], key=lambda n: n.p)) + ')'
        span(g['s'], g['e'], head)
        pos = g['e']
    if endT > pos:
        span(pos, endT, 'r')
    return toks


def compress(toks, max_groups=300, maxk=48):
    """Collapse tandem repeats of token blocks into [block]n (textually identical => exact)."""
    out, i, n, groups = [], 0, len(toks), 0
    while i < n:
        best = None
        for k in range(1, min(maxk, (n - i) // 2) + 1):
            blk = toks[i:i + k]
            r = 1
            while i + (r + 1) * k <= n and toks[i + r * k:i + (r + 1) * k] == blk:
                r += 1
            if r >= 2:
                txt = len(' '.join(blk))
                saved = (r - 1) * (txt + 1) - 4
                if saved > 8 and (best is None or saved > best[0]):
                    best = (saved, k, r)
        if best and groups < max_groups:
            _, k, r = best
            out.append('[' + ' '.join(toks[i:i + k]) + ']' + (str(r) if r != 2 else ''))
            groups += 1
            i += k * r
        else:
            out.append(toks[i])
            i += 1
    return ' '.join(out)


# ----------------------------------------------------------------------------------------
PADLIKE = {'strings', 'slowstr', 'choir', 'ooh', 'pad', 'pipe', 'organ', 'accordion'}
# drum lanes: hits of one family share a lane (and a velocity when they fall on the same tick)
FAMILY = [set([35, 36, 37, 38, 39, 40, 41, 43, 45, 47, 48, 50, 86, 87]), set([42, 44, 46, 49, 51, 52, 53, 55, 57, 59])]
AUTO_PAN = [-0.3, 0.3, -0.5, 0.5, -0.15, 0.15, -0.4, 0.4]


def step_at(steps, tick, default):
    v = steps[0][1] if steps else default
    for t, x in steps:
        if t <= tick:
            v = x
        else:
            break
    return v


def convert(src_dir, cfg, mix):
    log = []
    d = load(os.path.join(src_dir, cfg['file']), cfg)
    notes, drums = d['notes'], d['drums']
    meter = cfg.get('meter') or list(d['ts'])
    if meter[1] not in (2, 4, 8, 16) or meter[0] < 2:
        meter = [4, 4]
    barT = meter[0] * 192 // meter[1]
    notes, dropped = dedupe_channels(notes, cfg, log)

    # ---- timeline: trim leading empty bars, align loop start to a bar line --------------
    allstart = min([n.s for n in notes] + [x.s for x in drums])
    shift = -(allstart // barT) * barT
    mk = d['markers']
    loop_bar, end_t = None, None
    if 'loopstart' in mk and 'loopend' in mk and not cfg.get('nomarkers'):
        ls, le = mk['loopstart'] + shift, mk['loopend'] + shift  # noqa
        pad = (-ls) % barT
        if pad and cfg.get('pickup') == 'trim':  # drop the pickup instead of opening with silence
            pad -= barT
            log.append(f'pickup: trimmed the first {-pad} ticks so the loop starts on a bar line')
        elif pad:
            log.append(f'pickup: padded {pad} ticks so the loop starts on a bar line')
        shift += pad
        ls += pad
        le += pad
        loop_bar = ls // barT
        end_t = le
        if (le - ls) % barT:
            log.append(f'WARNING loop length {le - ls} ticks is not a whole number of bars')
    shift += cfg.get('pad', 0)
    for x in notes + drums:
        x.s += shift
        x.e += shift
    trimmed = sum(1 for x in notes + drums if x.s < 0)
    if trimmed:
        log.append(f'{trimmed} notes/hits before the trimmed start dropped')
    notes = [x for x in notes if x.s >= 0]
    drums = [x for x in drums if x.s >= 0]
    last = max([n.e for n in notes] + [x.s + 6 for x in drums])
    nbars = -(-last // barT)
    if loop_bar is None:
        if 'loop' in cfg:
            loop_bar = cfg['loop']
            end_t = cfg.get('end', nbars) * barT
            log.append(f'loop from config: bar {loop_bar}, end bar {end_t // barT}')
        elif cfg.get('oneShot'):
            loop_bar, end_t = 0, nbars * barT
        else:
            fp = fingerprint(notes, drums, barT, nbars)
            r = detect_loop(fp, tail=cfg.get('tail', 4))
            if r:
                endb, S, P, m = r
                loop_bar, end_t = S, endb * barT
                log.append(f'auto loop: bars {S}..{endb} (period {P}, verified {m} bars of repeat; MIDI had {nbars})')
            else:
                loop_bar, end_t = 0, nbars * barT
                log.append(f'no repeat found: whole song loops ({nbars} bars)')
    if 'end' in cfg:
        end_t = cfg['end'] * barT
    bars = -(-end_t // barT)
    endT = bars * barT
    notes = [n for n in notes if n.s < endT]
    for n in notes:
        n.e = min(n.e, endT)
    drums = [x for x in drums if x.s < endT]
    first_sound = min([n.s for n in notes] + [x.s for x in drums])
    skip = (first_sound // 6) * 6 if first_sound >= 12 and cfg.get('skip', True) else 0

    # exact duplicates (same channel, tick and pitch) are one note
    seen, uniq = set(), []
    for n in notes:
        k = (n.ch, n.s, n.p)
        if k not in seen:
            seen.add(k)
            uniq.append(n)
    notes = uniq
    seen, uniq = set(), []
    for x in drums:
        k = (x.s, x.p)
        if k not in seen:
            seen.add(k)
            uniq.append(x)
    drums = uniq

    # ---- tempo ---------------------------------------------------------------------------
    slow = cfg['slow']
    tp = [(max(0, t + shift), bpm) for t, bpm in d['tempos']]
    tp = [x for i, x in enumerate(tp) if i + 1 >= len(tp) or tp[i + 1][0] > x[0]]  # last one wins at a tick
    tp = [x for x in tp if x[0] < endT] or [(0, 120.0)]
    tp[0] = (0, tp[0][1])
    if cfg.get('tempo') == 'main':  # one tempo: the one that covers the most ticks
        acc = Counter()
        for i, (t, bpm) in enumerate(tp):
            acc[bpm] += (tp[i + 1][0] if i + 1 < len(tp) else endT) - t
        tp = [(0, acc.most_common(1)[0][0])]
    main_bpm = Counter()
    for i, (t, bpm) in enumerate(tp):
        main_bpm[bpm] += (tp[i + 1][0] if i + 1 < len(tp) else endT) - max(t, loop_bar * barT)
    bpm_src = main_bpm.most_common(1)[0][0]

    # ---- voices: one per channel, lanes inside --------------------------------------------
    bych = defaultdict(list)
    for n in notes:
        bych[n.ch].append(n)
    lead_ch = cfg.get('lead', 0) - 1
    roles_cfg = {k - 1: v for k, v in cfg.get('roles', {}).items()}
    gvol = cfg.get('vol', {})
    gpan = cfg.get('pan', {})
    gsend = cfg.get('send', {})
    has_pan = any(any(abs(p) > 0.02 for _, p in v) for v in d['pan'].values())
    voices = []
    for ch, ns in sorted(bych.items()):
        lanes = make_lanes(ns, cfg.get('maxchord', 8))
        if ch + 1 in cfg.get('mono', []):
            while len(lanes) > 1:
                lanes[0] = chordify(lanes[0], lanes.pop(1), cfg.get('maxchord', 8))
        inst0 = Counter(n.inst for n in ns).most_common(1)[0][0]
        pitch = sum(n.p for n in ns) / len(ns)
        mdur = sum(n.e - n.s for n in ns) / len(ns)
        role = roles_cfg.get(ch)
        if role is None:
            if ch == lead_ch:
                role = 'lead'
            elif inst0 in ('timp', 'taiko', 'log'):
                role = 'perc'
            elif pitch < 50 and (inst0 in BASSLIKE or len(lanes) == 1):
                role = 'bass'
            elif inst0 in PADLIKE and mdur >= 60:
                role = 'pad'
            else:
                role = 'acc'
        # dynamics
        amps = sorted(n.amp for n in ns)
        vref = amps[min(len(amps) - 1, int(0.9 * len(amps)))]
        vs = d['vol'].get(ch, [(0, volc(100))])
        vs = sorted((t + shift, v) for t, v in vs)
        on_vols = [step_at(vs, n.s, volc(100)) for n in ns]
        vol_ref = max(on_vols) or volc(100)
        # expression automation, only when the channel volume really moves while it plays
        ctl = []
        lo_t, hi_t = min(n.s for n in ns) - 48, max(n.e for n in ns) + 48
        if not cfg.get('noexpr') and (max(on_vols) - min(on_vols) > 0.06 * vol_ref or
                                      any(lo_t <= t <= hi_t and abs(v - vol_ref) > 0.12 * vol_ref for t, v in vs)):
            steps = [(t, min(127, 100 * v / vol_ref)) for t, v in vs]
            auto = automation(steps, 4, 30)
            # start state, then only what falls inside the track
            x0 = value_at(auto, 0, steps[0][1])
            ctl.append((0, 'x', int(round(x0))))
            for t, v, ramp in auto:
                if 0 < t < endT:
                    ctl.append((t, 'X' if ramp else 'x', int(round(v))))
        if ch in d['bend']:
            auto = automation(sorted((t + shift, v) for t, v in d['bend'][ch]), 5, 14, 3)
            for t, v, ramp in auto:
                if 0 <= t < endT:
                    ctl.append((t, 'Y' if ramp else 'y', int(round(v))))
            log.append(f'ch{ch + 1}: pitch bend -> {sum(1 for c in ctl if c[1] in "yY")} points')
        # pan: explicit config > the sequence's CC10 (per note when it moves) > automatic spread
        pan = gpan.get(ch + 1)
        pan_steps = sorted((t + shift, p) for t, p in d['pan'].get(ch, []))
        moving = False
        if pan is None and has_pan and pan_steps:
            pn = [step_at(pan_steps, n.s, 0) for n in ns]
            moving = max(pn) - min(pn) > 0.25
            # SNES-style moderate panning; the melody and the bass stay near the middle
            pan = round((0.25 if role in ('lead', 'bass') else 0.6) * sum(pn) / len(pn), 2)
        for L in lanes:
            for g in L:
                g['v'] = max(1, min(15, int(round(12 * max(n.amp for n in g['n']) / vref))))
                if moving:
                    g['pan'] = int(round((2.5 if role in ('lead', 'bass') else 6) * step_at(pan_steps, g['s'], 0)))
        if cfg.get('dyn') and not any(c[1] in 'xX' for c in ctl):
            ctl.append((0, 'x', 100))
            for bar, pc in cfg['dyn']:
                ctl.append((bar * barT, 'x', pc))
        voices.append(dict(ch=ch, inst=inst0, lanes=lanes, role=role, pitch=pitch, level=vref * vol_ref, ctl=ctl, pan=pan,
                           moving=moving, notes=len(ns)))
        log.append(f"  ch{ch + 1:<2} {inst0:9s} {role:5s} notes {len(ns):4d} lanes {len(lanes)} pitch {pitch:.0f} level {vref * vol_ref:.2f}"
                   f"{' expr ' + str(len(ctl)) if ctl else ''}{' autopan' if moving else ''}")
    # automatic stereo spread for sequences without panning: lead, bass and drums stay in the middle
    if not has_pan:
        k = 0
        for v in voices:
            if v['pan'] is None:
                if v['role'] in ('lead', 'bass'):
                    v['pan'] = 0
                else:
                    v['pan'] = AUTO_PAN[k % len(AUTO_PAN)]
                    k += 1
    # drums
    kit = None
    if drums:
        fam = [[], [], []]
        for x in drums:
            fam[0 if x.p in FAMILY[0] else 1 if x.p in FAMILY[1] else 2].append(x)
        amps = sorted(x.amp for x in drums)
        vref = amps[min(len(amps) - 1, int(0.9 * len(amps)))]
        dch = drums[0].ch
        vs = sorted((t + shift, v) for t, v in d['vol'].get(dch, [(0, volc(100))]))
        vol_ref = max(step_at(vs, x.s, volc(100)) for x in drums) or volc(100)
        ctl = []
        if cfg.get('dyn'):
            ctl.append((0, 'x', 100))
            for bar, pc in cfg['dyn']:
                ctl.append((bar * barT, 'x', pc))
        elif cfg.get('drumexpr'):
            steps = [(t, min(127, 100 * v / vol_ref)) for t, v in vs]
            auto = automation(steps, 4, 30)
            ctl.append((0, 'x', int(round(value_at(auto, 0, steps[0][1])))))
            for t, v, ramp in auto:
                if 0 < t < endT:
                    ctl.append((t, 'X' if ramp else 'x', int(round(v))))
        lanes = []
        for hits in fam:
            if not hits:
                continue
            by = defaultdict(list)
            for x in hits:
                by[x.s].append(x)
            starts = sorted(by)
            L = []
            for i, s_ in enumerate(starts):
                e_ = starts[i + 1] if i + 1 < len(starts) else min(endT, s_ + 48)
                g = {'s': s_, 'e': e_, 'n': sorted(by[s_], key=lambda n: -n.p)}
                g['v'] = max(1, min(15, int(round(12 * max(n.amp for n in g['n']) / vref))))
                L.append(g)
            lanes.append(L)
        kit = dict(ch=dch, inst='drums', lanes=lanes, role=roles_cfg.get(dch, 'drums'), pitch=0, level=vref * vol_ref, ctl=ctl, pan=0, moving=False,
                   notes=len(drums))
        voices.append(kit)
        log.append(f"  drums     notes {len(drums):4d} lanes {len(lanes)} level {vref * vol_ref:.2f}")

    # ---- emit ---------------------------------------------------------------------------
    top = max(v['level'] for v in voices)
    mx = mix.get(cfg['id'], {})
    v = {}
    vinfo = []
    used = Counter()
    lead_name = None
    for vc in voices:
        name = vc['inst']
        used[name] += 1
        if used[name] > 1:
            name = f"{vc['inst']}{used[name]}"
        if vc['ch'] == lead_ch and vc['role'] == 'lead':
            lead_name = name
        mmls = []
        for li, L in enumerate(vc['lanes']):
            lens = Counter(g['e'] - g['s'] for g in L)
            dflt = next((x for x, _ in lens.most_common() if x in LENTOK), 48)
            toks = lane_tokens(L, endT, dflt, vc['inst'], vc['ctl'] if li == 0 else ())
            mmls.append('q8 l' + LENTOK[dflt] + ' ' + compress(toks))
        vol = max(0.25, (vc['level'] / top) ** 0.75) * gvol.get(vc['ch'] + 1, 1.0) * mx.get('v', {}).get(name, 1.0)
        opts = {'vol': round(vol, 3)}
        if vc['pan']:
            opts['pan'] = vc['pan']
        if vc['ch'] + 1 in gsend:
            opts['echo'] = gsend[vc['ch'] + 1]
        v[name] = [vc['inst'], mmls if len(mmls) > 1 else mmls[0], opts]
        vinfo.append({'name': name, 'inst': vc['inst'], 'ch': vc['ch'] + 1, 'role': vc['role'], 'notes': vc['notes'], 'lanes': len(vc['lanes']),
                      'pitch': round(vc['pitch'], 1), 'vol': opts['vol'], 'pan': vc['pan'] or 0, 'expr': len(vc['ctl'])})
    df = {'bpm': round(tp[0][1] * slow, 2), 'meter': meter, 'bars': bars, 'loop': loop_bar, 'echo': cfg.get('echo', [0.75, 0.35, 0.3])}
    if len(tp) > 1:
        df['tempo'] = [[t, round(bpm * slow, 2)] for t, bpm in tp[1:]]
    if cfg.get('oneShot'):
        df['oneShot'] = True
    if cfg.get('kind'):
        df['kind'] = cfg['kind']
    if cfg.get('maxLoops'):
        df['maxLoops'] = cfg['maxLoops']
    if skip:
        df['skip'] = skip
    if lead_name:
        df['lead'] = lead_name
    df['gain'] = round(cfg.get('gain', 1.0) * mx.get('gain', 1.0), 3)
    df['v'] = v
    expect = {'mel': sorted([n.s, n.p] for n in notes), 'drum': sorted([x.s, x.p] for x in drums)}
    src_notes = len(d['song'].notes)
    spb = 60.0 / (bpm_src * slow)
    rep = {'expect': expect, 'id': cfg['id'], 'file': cfg['file'], 'title': cfg['title'], 'seq': cfg.get('seq', ''),
           'bpm_src': round(bpm_src, 1), 'bpm': round(bpm_src * slow, 1), 'slow': slow, 'meter': meter, 'bars': bars, 'loop': loop_bar,
           'sec': round(endT / PPQ * spb, 1), 'voices': vinfo, 'log': log, 'kind': cfg.get('kind', 'field'),
           'midi_notes': src_notes, 'kept_notes': len(notes), 'drum_hits': len(drums),
           'dropped_channels': sorted(c + 1 for c in dropped), 'config_dropped_channels': cfg.get('drop', []),
           'target': cfg.get('target')}
    return df, rep


# ----------------------------------------------------------------------------------------
def js_def(df):
    lines = ['{']
    for k in ('bpm', 'meter', 'bars', 'loop', 'echo', 'tempo', 'oneShot', 'kind', 'maxLoops', 'skip', 'lead', 'gain'):
        if k in df:
            lines.append(f'    {k}: {json.dumps(df[k])},')
    lines.append('    v: {')
    for name, (inst, mml, opts) in df['v'].items():
        if isinstance(mml, list):
            lines.append(f'      {name}: [{json.dumps(inst)}, [')
            for m in mml:
                lines.append(f'        {json.dumps(m)},')
            lines.append(f'      ], {json.dumps(opts)}],')
        else:
            lines.append(f'      {name}: [{json.dumps(inst)}, {json.dumps(mml)}, {json.dumps(opts)}],')
    lines.append('    },')
    lines.append('  }')
    return '\n'.join(lines)


HEADER = """// music_ct.js — GENERATED by tools/music/midi2ct.py from fan-made MIDI sequences. Do not edit by hand;
// change TRACKS in the converter (or tools/music/mix.json) and re-run it.
//
// Chrono Trigger music by Yasunori Mitsuda (Square) (Boss Battle 1: Noriko Matsueda; some pieces with Nobuo Uematsu).
// MIDI sequences from VGMusic (vgmusic.com) by their sequencers, credited per track below; the files are in tools/music/midi/.
// Arranged for ChronoTactics: slower tempos for turn-based play, SNES-style patches, per-track echo and mix.
//
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(HERE, 'midi'))
    ap.add_argument('--out', default=None)
    ap.add_argument('--report', default=None)
    ap.add_argument('--only', default='')
    ap.add_argument('--mix', default=os.path.join(HERE, 'mix.json'))
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()
    only = set(x for x in a.only.split(',') if x)
    mix = {}
    if a.mix and os.path.exists(a.mix):
        with open(a.mix) as fh:
            mix = json.load(fh)
    defs, reps = [], []
    for cfg in TRACKS:
        if only and cfg['id'] not in only:
            continue
        df, rep = convert(a.src, cfg, mix)
        defs.append((cfg, df))
        reps.append(rep)
        print(f"{cfg['id']:18s} {cfg['file'][:28]:28s} bpm {rep['bpm_src']:>6} -> {rep['bpm']:>5}  {rep['meter']}  bars {rep['bars']:>3} "
              f"loop {rep['loop']:>2}  {rep['sec']:>6}s  voices {len(df['v'])}")
        if not a.quiet:
            for line in rep['log']:
                print('      ' + line)
    if a.out:
        out = [HEADER]
        for cfg, df in defs:
            out.append(f"// {cfg['id']}: \"{cfg['title']}\" — {cfg['file']}" + (f", sequenced by {cfg['seq']}" if cfg.get('seq') else '') + '\n')
        out.append("(function () {\n  'use strict';\n  const A = window.CT && window.CT.audio;\n  if (!A || !A.define) return;\n")
        for cfg, df in defs:
            out.append(f"  // {cfg['title']} ({cfg['file']}{', ' + cfg['seq'] if cfg.get('seq') else ''})\n")
            out.append(f"  A.define('{cfg['id']}', {js_def(df)});\n")
        out.append('})();\n')
        with open(a.out, 'w') as fh:
            fh.write(''.join(out))
        print('wrote', a.out, os.path.getsize(a.out), 'bytes')
    if a.report:
        with open(a.report, 'w') as fh:
            json.dump(reps, fh, indent=1)


# ----------------------------------------------------------------------------------------
# Track table. Channel numbers are 1-based. Per track:
#   slow      tempo factor vs. the sequence (the game wants a slower, tactics pace)
#   lead      the melody channel (kept on top by automix.cjs, reported by measure.cjs)
#   inst      {channel: patch | {gm_program: patch}} overrides of the GM table
#   drop      channels left out on purpose (the sequencers' hand-made echo copies: the engine has a real echo)
#   drummap   GM percussion key -> kit key, where the sequence uses a stand-in sound
#   loop/end  loop start bar / first bar after the loop (when there are no markers and no repeat in the file)
#   echo      [beats, feedback, wet, low-pass Hz, stereo spread]
#   roles     {channel: 'lead' | 'counter' | 'acc' | 'pad' | 'bass' | 'perc' | 'drums' | 'fx'} where the guess is wrong
#   kind      'battle' / 'jingle': these interrupt a field track, which resumes afterwards
#   target    RMS (dBFS) automix.cjs aims the finished mix at
# ----------------------------------------------------------------------------------------
FIELD = [0.75, 0.32, 0.26, 3000, 0.6]
BATTLE = [0.5, 0.2, 0.13, 3200, 0.5]       # dry and punchy
AMBIENT = [1, 0.5, 0.4, 2600, 0.7]
CATHEDRAL = [1, 0.62, 0.52, 2400, 0.8]     # long, dark, wide: Corridors of Time, the End of Time
TRACKS = [
    dict(id='mus_title', title='Chrono Trigger', file='ct_chrono1.mid', seq='Quietust', slow=0.72, lead=1, pad=144, loop=9, end=80,
         inst={1: {48: 'strings', 66: 'brass'}, 2: 'pbass', 7: {46: 'harp', 66: 'horn'}}, echo=[0.75, 0.36, 0.3, 3000, 0.6], target=-20.5),
    dict(id='mus_fair_night', title='Leene Square', file='millenialfair.mid', seq='Alex Jarvis', slow=0.85, lead=5,
         drumch=[4], inst={1: 'marimba', 2: 'pizz', 3: 'tuba', 5: 'panflute', 6: 'accordion', 7: 'flute'}, echo=FIELD, target=-20.5),
    dict(id='mus_rift', title="Lavos's Theme", file='lavos.mid', seq='Valius (Chris Hatfield)', slow=0.85, lead=2,
         inst={1: 'piano', 3: 'pipe'}, drumexpr=True, echo=AMBIENT, target=-21.5),
    dict(id='mus_battle', title='Battle', file='chrono_trigger_battle1.mid', seq='Bregalad', pickup='trim', slow=0.9, lead=7, kind='battle',
         inst={1: 'slap', 6: 'marimba'}, roles={8: 'counter'}, echo=BATTLE, target=-19.5),
    dict(id='mus_battle_boss', title='Boss Battle 1', file='CB_CTBoss1.mid', seq='Corlen Belspar', slow=0.9, scale=4 / 3, meter=[4, 4], lead=1, kind='battle',
         drop=[9, 11, 12, 13], inst={5: 'pbass'}, roles={3: 'acc', 4: 'acc'}, echo=BATTLE, target=-19.5),
    dict(id='mus_victory', title='Fanfare 1 (victory)', file='ctlucca3.mid', seq='Andrew Thompson', slow=0.92, meter=[6, 8], lead=1, kind='jingle',
         loop=6, end=22, maxLoops=2, dyn=[(6, 72)], inst={1: 'brass', 3: 'strings', 4: 'epiano'}, echo=[0.5, 0.28, 0.22, 3000, 0.6], target=-19.5),
    dict(id='mus_end_of_time', title='End of Time', file='EndOfTime.mid', seq='Asa Lothario', slow=0.85, lead=3,
         inst={2: 'piano', 3: 'vibes', 6: 'celesta'}, loop=0, end=53, echo=CATHEDRAL, target=-22),
    dict(id='mus_guardia_600', title='Guardia Castle', file='guardia.mid', seq='Valius, modified by Noah Sp.', slow=0.85, lead=2, loop=4, end=54,
         inst={2: 'brass'}, echo=FIELD, target=-20.5),
    dict(id='mus_frog_theme', title="Frog's Theme", file='FROGct.mid', seq='Magnius', slow=0.85, lead=1,
         inst={2: 'brass', 5: 'brass'}, echo=FIELD, target=-20.5),
    dict(id='mus_denadoro', title='Middle Ages: World Map ("Wind Scene")', file='ctwndscene.mid', seq='Jaroban', slow=0.85, lead=3,
         keep=[2], tokit={6: 76}, loop=0, end=64, echo=[0.75, 0.36, 0.3, 3000, 0.6], target=-20.5),
    dict(id='mus_ioka', title='Prehistoric World Map ("Rhythm of Earth, Wind and Sky")',
         file='Chrono_Trigger_-_20_-_Rhythm_of_Earth_Wind_and_Sky.mid', seq='Wotan', slow=0.85, echo=[0.75, 0.3, 0.22, 3200, 0.7], target=-20.5),
    dict(id='mus_ayla_theme', title="Ayla's Theme", file='cavegirl_song.mid', seq='Teck', slow=0.85, lead=1, loop=2, end=50,
         transpose={5: 12}, inst={1: 'brass', 5: 'slap', 6: 'lowbrass', 7: 'lowbrass'}, drummap={59: 70, 53: 62, 51: 63}, echo=FIELD, target=-20),
    dict(id='mus_tyrano', title='Tyrano Lair', file='cttyrano.mid', seq='Mark Jansen', slow=0.85, lead=1, echo=FIELD, target=-20.5),
    dict(id='mus_last_village', title='Silent Light', file='CT-SilentLight.mid', seq='Powerlord', slow=0.85, lead=2,
         inst={7: 'fretless'}, echo=[0.75, 0.4, 0.34, 2800, 0.7], target=-21),
    dict(id='mus_zeal_wreck', title='Zeal ("Corridors of Time")', file='ctzeal.mid', seq='', slow=0.85, lead=4,
         inst={4: 'panflute'}, roles={1: 'counter', 2: 'counter'}, drummap={36: 64, 37: 62, 45: 63}, echo=CATHEDRAL, target=-21),
    dict(id='mus_magus_theme', title="Magus's Theme", file='Magus1.mid', seq='Akane', slow=0.85, lead=3, loop=5, end=40,
         inst={3: 'flute', 4: 'pbass', 7: 'brass'}, roles={1: 'pad'}, echo=FIELD, target=-20.5),
    dict(id='mus_hollow', title='Future: World Map ("Ruined World")', file='ct2300ad.mid', seq='KDS', slow=0.9, lead=1,
         inst={2: 'wind', 3: 'wind', 9: 'wind', 4: 'wind', 5: 'wind'}, transpose={2: 48, 3: 48, 9: 48, 4: 24, 5: 24},
         keep=[7, 8], echo=AMBIENT, target=-22),
    dict(id='mus_curator', title='Boss Battle 2', file='ct_bossbattle2.mid', seq='Quietust', slow=0.88, meter=[6, 8], lead=1, kind='battle',
         inst={1: 'brass', 6: {89: 'sbass', 35: 'pbass'}}, echo=BATTLE, target=-19.5),
    dict(id='mus_curator_core', title='Lavos ("World Revolution")', file='CB_WorldRevolution.mid', seq='Corlen Belspar', pickup='trim', slow=0.9,
         meter=[4, 4], lead=1, kind='battle', drop=[12, 13, 14, 15, 16], inst={5: 'sbass'}, drummap={28: 36, 31: 37},
         echo=[0.5, 0.24, 0.16, 3200, 0.5], target=-19.5),
    dict(id='mus_ending', title='Epilogue ("To Good Friends")', file='ctmarle1.mid', seq='Masashi Ito', slow=0.9, lead=1,
         drop=[3, 4, 5, 6, 14, 15], inst={1: 'musicbox', 2: 'musicbox'}, oneShot=True, echo=[0.75, 0.4, 0.34, 2800, 0.7], target=-21),
    dict(id='mus_credits', title='To Far Away Times', file='ct_tofarawaytimes.mid', seq='Quietust', slow=0.9, lead=3,
         inst={7: {26: 'bass', 46: 'harp'}}, roles={10: 'fx'}, oneShot=True, echo=FIELD, target=-20.5),
]

if __name__ == '__main__':
    main()
