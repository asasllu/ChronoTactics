#!/usr/bin/env python3
"""midi2ct.py — convert fan-sequenced Chrono Trigger MIDIs into CT.audio track defs.

Usage:
  python3 -I tools/music/midi2ct.py --src DIR [--out public/js/music_ct.js] [--report report.json] [--only id,id]

Every track in TRACKS (bottom of this file) is converted from DIR/<file> into one
`CT.audio.define(id, def)` call (see public/js/audio.js for the def format):

  * tempo map -> one bpm (the tempo that covers the most ticks) x the track's `slow` factor
  * notes are quantized to the engine's 48-PPQ grid (nearest 1/32 or 1/16-triplet by default)
  * each MIDI channel is split into monophonic / chord "lanes"; lanes are ranked and
    merged (same instrument -> chords) or dropped until <= 8 voices remain
  * GM program -> nearest engine instrument; GM drums (channel 10) -> 'kit' step strings
  * loop: loopStart/loopEnd markers if present, else an auto-detected repeat, else bar 0
  * output MML uses note names, a default length, and [..]n repeats to stay compact

Pure Python 3, no dependencies (reads MIDI with midiparse.py next to this file).
"""
import argparse
import json
import math
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import midiparse  # noqa: E402

PPQ = 48
MAX_VOICES = 8

# ----------------------------------------------------------------------------------------
# GM program -> engine instrument (INST keys in audio.js). None = drop the notes.
# ----------------------------------------------------------------------------------------
GM = {}
for p in range(0, 4): GM[p] = 'harp'          # pianos
for p in (4, 5): GM[p] = 'glass'               # electric pianos
for p in (6, 7): GM[p] = 'lute'                # harpsichord, clav
GM.update({8: 'mbox', 9: 'glock', 10: 'mbox', 11: 'glock', 12: 'kalimba', 13: 'kalimba', 14: 'bell', 15: 'lute'})
for p in (16, 17, 18, 19): GM[p] = 'organ'
for p in (20, 21, 22, 23): GM[p] = 'accordion'
for p in (24, 25, 26, 27, 28): GM[p] = 'lute'
GM.update({29: 'lead', 30: 'lead', 31: 'glass'})
for p in (32, 33, 34, 35): GM[p] = 'bass'
for p in (36, 37, 38, 39): GM[p] = 'sbass'
for p in (40, 41, 42, 43, 44): GM[p] = 'strings'
GM.update({45: 'lute', 46: 'harp', 47: 'timp'})
GM.update({48: 'strings', 49: 'strings', 50: 'strings', 51: 'strings', 52: 'choir', 53: 'vox', 54: 'vox', 55: 'brass'})
GM.update({56: 'brass', 57: 'horn', 58: 'tuba', 59: 'brass', 60: 'horn', 61: 'brass', 62: 'brass', 63: 'brass'})
GM.update({64: 'horn', 65: 'horn', 66: 'horn', 67: 'horn', 68: 'lead', 69: 'lead', 70: 'horn', 71: 'ocarina'})
for p in (72, 73, 74, 75): GM[p] = 'flute'
for p in (76, 77, 78, 79): GM[p] = 'ocarina'
GM.update({80: 'lead', 81: 'brass', 82: 'flute', 83: 'flute', 84: 'lead', 85: 'vox', 86: 'lead', 87: 'sbass'})
GM.update({88: 'pad', 89: 'pad', 90: 'pad', 91: 'choir', 92: 'strings', 93: 'glass', 94: 'choir', 95: 'pad'})
GM.update({96: 'glass', 97: 'pad', 98: 'glass', 99: 'pad', 100: 'glass', 101: 'detuned', 102: 'detuned', 103: 'cold'})
GM.update({104: 'lute', 105: 'lute', 106: 'lute', 107: 'harp', 108: 'kalimba', 109: 'accordion', 110: 'strings', 111: 'lead'})
GM.update({112: 'glock', 113: 'kalimba', 114: 'kalimba', 115: 'log', 116: 'timp', 117: 'timp', 118: 'timp', 119: 'wind'})
GM.update({120: None, 121: 'wind', 122: 'wind', 123: 'glass', 124: None, 125: 'wind', 126: None, 127: None})
BASSLIKE = {'bass', 'sbass', 'tuba', 'sub', 'obass', 'timp'}

# GM percussion key -> kit letter (see parseDrums in audio.js)
DRUM = {35: 'k', 36: 'k', 37: 'r', 38: 's', 39: 'x', 40: 's', 41: 't', 43: 't', 45: 'm', 47: 'm', 48: 'u', 50: 'u',
        42: 'h', 44: 'h', 46: 'o', 49: 'c', 52: 'c', 55: 'c', 57: 'c', 51: 'h', 53: 'h', 59: 'h', 54: 'g', 56: 'q',
        58: 'g', 60: 'i', 61: 'j', 62: 'i', 63: 'i', 64: 'j', 65: 'u', 66: 'm', 67: 'q', 68: 'q', 69: 'g', 70: 'g',
        73: 'g', 74: 'g', 75: 'r', 76: 'q', 77: 'q', 78: 'j', 79: 'j', 82: 'g', 83: 'g', 85: 'r', 86: 'k', 87: 't', 31: 'r'}
DRUM_PRIO = 'skcxtmuijoqrhgf'      # who wins a step when one kit lane has two hits at once
KIT_SPLIT = ['ksxrtmuijf', 'hocgq']  # lane groups when a track gets two kit voices

# note value (ticks) -> MML length token
LENTOK = {192: '1', 288: '1.', 144: '2.', 168: '2..', 96: '2', 72: '4.', 84: '4..', 64: '3', 48: '4', 36: '8.', 32: '6',
          24: '8', 18: '16.', 16: '12', 12: '16', 9: '32.', 8: '24', 6: '32', 4: '48', 3: '64', 2: '96'}
NAMES = ['c', 'c+', 'd', 'd+', 'e', 'f', 'f+', 'g', 'g+', 'a', 'a+', 'b']
DRUM_STEPS = [24, 16, 12, 8, 6, 4, 3, 2]   # l8 l12 l16 l24 l32 l48 l64 l96


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
    for t, x in lst:
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


# ----------------------------------------------------------------------------------------
def load(path, cfg):
    s = midiparse.read(path)
    scale = cfg.get('scale', 1.0)
    rb = cfg.get('rebeat')  # (t0_src_ticks, src_ticks_per_beat): re-time a free-time recording
    if rb:
        f = lambda t: (t - rb[0]) / rb[1] * PPQ  # noqa: E731
    else:
        f = lambda t: t * PPQ / s.ppq * scale  # noqa: E731
    grids = cfg.get('grid', [6, 8])
    drop = set(c - 1 for c in cfg.get('drop', []))
    notes, drums = [], []
    instov = {k - 1: v for k, v in cfg.get('inst', {}).items()}
    tr = {k - 1: v for k, v in cfg.get('transpose', {}).items()}
    drumch = set(c - 1 for c in cfg.get('drumch', [10]))
    for n in s.notes:
        if n.ch in drop or (cfg.get('droptrk') and n.track in cfg['droptrk']):
            continue
        st = f(n.tick)
        if st < -1:
            continue
        st = max(0, snap(st, grids))
        if n.ch in drumch:
            letter = cfg.get('drummap', {}).get(n.pitch, DRUM.get(n.pitch))
            if letter:
                drums.append(N(st, st + 6, n.pitch, n.vel, n.ch, letter, n.track))
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
    bpm0 = main_tempo(s)
    if rb:
        bpm0 = 60e6 / at_time(s.tempos, 0, 500000) * s.ppq / rb[1]
    bpm0 *= scale
    markers = {}
    for t, m in s.markers:
        ml = m.strip().lower()
        if ml in ('loopstart', 'loopend'):
            markers[ml] = round(f(t))
    vols = {ch: at_time(v, 0, 100) for ch, v in s.volumes.items()}
    pans = {ch: at_time(v, 0, 64) for ch, v in s.pans.items()}
    ts = (s.timesigs[0][1], s.timesigs[0][2]) if s.timesigs else (4, 4)
    return dict(song=s, notes=notes, drums=drums, bpm0=bpm0, markers=markers, vols=vols, pans=pans, ts=ts,
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


def detect_loop(fp, tail=4, minP=4):
    nb = len(fp)
    best = None
    for P in range(minP, nb):
        for S in range(0, nb - P):
            if not fp[S] and S > 0:
                pass
            m = 0
            while S + P + m < nb and bar_eq(fp[S + m], fp[S + P + m]):
                m += 1
            if S + P + m >= nb - tail and m >= min(P, max(4, P // 2)) and any(fp[S:S + P]):
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


def lane_tokens(groups, endT, dflt):
    toks = []
    pos, oct_, vel, inst = 0, 4, None, None
    for g in groups:
        if g['s'] > pos:
            toks.append('r' + len_tok(g['s'] - pos, dflt))
        L = g['e'] - g['s']
        lead = g['n'][0]
        pre = ''
        if lead.inst != inst and inst is not None:
            pre += '@' + lead.inst + ' '
        inst = lead.inst
        v = g['v']
        if v != vel:
            pre += 'v%d ' % v
            vel = v
        if len(g['n']) == 1:
            p = lead.p
            o = p // 12 - 1
            if o != oct_:
                pre += ('>' if o == oct_ + 1 else '<' if o == oct_ - 1 else 'o%d' % o)
                oct_ = o
            toks.append(pre + NAMES[p % 12] + len_tok(L, dflt))
        else:
            toks.append(pre + '(' + ''.join('n%d' % n.p for n in sorted(g['n'], key=lambda n: n.p)) + ')' +
                        len_tok(L, dflt))
        pos = g['e']
    if endT > pos:
        toks.append('r' + len_tok(endT - pos, dflt))
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


def drum_tokens(hits, endT, barT):
    """hits: {tick: (letter, accent)} for one kit lane -> per-bar step strings."""
    toks, step = [], None
    nb = endT // barT
    for b in range(nb):
        t0 = b * barT
        offs = [t - t0 for t in hits if t0 <= t < t0 + barT]
        st = next(s for s in DRUM_STEPS if barT % s == 0 and all(o % s == 0 for o in offs))
        txt = ''
        if st != step:
            txt = 'l%d ' % (192 // st)
            step = st
        for k in range(barT // st):
            h = hits.get(t0 + k * st)
            txt += '.' if not h else (h[0].upper() if h[1] else h[0])
        toks.append(txt)
    return toks


# ----------------------------------------------------------------------------------------
def convert(src_dir, cfg):
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
        ls, le = mk['loopstart'] + shift, mk['loopend'] + shift
        pad = (-ls) % barT
        if pad:
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
        if 'end' in cfg and 'loop' not in cfg:
            end_t = cfg['end'] * barT
    if 'end' in cfg:
        end_t = cfg['end'] * barT
    bars = -(-end_t // barT)
    endT = bars * barT
    notes = [n for n in notes if n.s < endT]
    for n in notes:
        n.e = min(n.e, endT)
    drums = [x for x in drums if x.s < endT]

    # ---- lanes -------------------------------------------------------------------------
    bych = defaultdict(list)
    for n in notes:
        bych[n.ch].append(n)
    lanes = []
    for ch, ns in sorted(bych.items()):
        for L in make_lanes(ns, cfg.get('maxchord', 4)):
            lanes.append(L)
    # lanes of the same instrument with identical rhythm -> one chord lane (lossless)
    i = 0
    while i < len(lanes):
        j = i + 1
        while j < len(lanes):
            a, b = lanes[i], lanes[j]
            if (len(a) == len(b) and lane_stats(a)['inst'] == lane_stats(b)['inst'] and
                    all(x['s'] == y['s'] and x['e'] == y['e'] for x, y in zip(a, b))):
                lanes[i] = chordify(a, b, cfg.get('maxchord', 4))
                log.append(f"unison-rhythm lanes ch{lane_stats(b)['ch'] + 1} + ch{lane_stats(a)['ch'] + 1} -> one chord voice")
                del lanes[j]
            else:
                j += 1
        i += 1
    # tiny side lanes (a few overlapping notes) fold into their channel's first lane
    first = {}
    keep = []
    for L in lanes:
        ch = lane_stats(L)['ch']
        if ch in first and lane_stats(L)['notes'] < max(6, 0.03 * lane_stats(first[ch])['notes']):
            idx = keep.index(first[ch])
            keep[idx] = chordify(first[ch], L, cfg.get('maxchord', 4))
            first[ch] = keep[idx]
            continue
        first.setdefault(ch, L)
        keep.append(L)
    lanes = keep
    for L in lanes:
        s_ = lane_stats(L)
        log.append(f"  lane ch{s_['ch'] + 1:<2} {s_['inst']:9s} notes {s_['notes']:4d} groups {len(L):4d} pitch {s_['pitch']:.0f} vel {s_['vel']:.0f}")
    # drum lanes: two kit voices when the melodic lanes leave room and one would lose hits
    nkit = 0
    if drums:
        nkit = cfg.get('kits')
        if nkit is None:
            steps = Counter(x.s for x in drums)
            clash = sum(c - 1 for c in steps.values()) / len(drums)
            nkit = 2 if (len(lanes) <= MAX_VOICES - 2 and clash > 0.1) else 1
    kit_groups = cfg.get('kit_groups') or (KIT_SPLIT if nkit == 2 else [DRUM_PRIO])
    nkit = len(kit_groups) if drums else 0
    budget = MAX_VOICES - nkit
    prio = {k - 1: v for k, v in cfg.get('prio', {}).items()}
    st = [lane_stats(L) for L in lanes]
    lo_pitch = min((s['pitch'] for s in st), default=60)

    def score(s):
        w = prio.get(s['ch'], 1.0)
        bonus = 1.6 if s['pitch'] == lo_pitch else 1.0
        return s['cov'] * (0.5 + s['vel'] / 127) * w * bonus

    order = sorted(range(len(lanes)), key=lambda i: -score(st[i]))
    alive = {i: lanes[i] for i in order}
    merged_into = {}
    while len(alive) > budget:
        victim = min(alive, key=lambda i: score(lane_stats(alive[i])))
        vs = lane_stats(alive[victim])
        cands = [i for i in alive if i != victim and lane_stats(alive[i])['inst'] == vs['inst']]
        same_ch = [i for i in cands if lane_stats(alive[i])['ch'] == vs['ch']]
        pool = same_ch or [i for i in cands if abs(lane_stats(alive[i])['pitch'] - vs['pitch']) <= 14]
        if pool:
            tgt = min(pool, key=lambda i: abs(lane_stats(alive[i])['pitch'] - vs['pitch']))
            alive[tgt] = chordify(alive[tgt], alive[victim], cfg.get('maxchord', 4))
            log.append(f"merged lane ch{vs['ch'] + 1}/{vs['inst']} ({vs['notes']} notes) into ch{lane_stats(alive[tgt])['ch'] + 1}")
            merged_into[victim] = tgt
        else:
            log.append(f"DROPPED lane ch{vs['ch'] + 1}/{vs['inst']} ({vs['notes']} notes, pitch {vs['pitch']:.0f})")
        del alive[victim]

    # ---- emit voices ---------------------------------------------------------------------
    v = {}
    vinfo = []
    used = Counter()
    keep_order = sorted(alive, key=lambda i: (lane_stats(alive[i])['ch'], i))
    loud = max((lane_stats(alive[i])['vel'] * (d['vols'].get(lane_stats(alive[i])['ch'], 100) / 100.0)) for i in alive) if alive else 100
    gvol = cfg.get('vol', {})
    gpan = cfg.get('pan', {})
    for i in keep_order:
        L = alive[i]
        s = lane_stats(L)
        ch = s['ch']
        inst0 = L[0]['n'][0].inst
        if s['pitch'] < 45 and inst0 not in BASSLIKE and not cfg.get('nobassfix'):
            for g in L:
                for n in g['n']:
                    if n.inst not in BASSLIKE:
                        n.inst = 'bass'
            inst0 = L[0]['n'][0].inst
            log.append(f'ch{ch + 1}: low register lane -> bass instrument')
        avgv = s['vel']
        for g in L:
            gv = max(n.v for n in g['n'])
            g['v'] = max(3, min(15, round(12 * gv / max(1, avgv))))
        lens = Counter(g['e'] - g['s'] for g in L)
        dflt = next((x for x, _ in lens.most_common() if x in LENTOK), 48)
        toks = lane_tokens(L, endT, dflt)
        mml = 'q8 l' + LENTOK[dflt] + ' ' + compress(toks)
        cc7 = d['vols'].get(ch, 100)
        vol = (avgv / loud) ** 0.8 * (cc7 / 100.0) ** 0.8
        vol = max(0.3, min(1.2, vol)) * gvol.get(ch + 1, 1.0) * cfg.get('mvol', 1.0)
        name = inst0
        used[name] += 1
        if used[name] > 1:
            name = f'{inst0}{used[name]}'
        opts = {'vol': round(vol, 2)}
        pan = gpan.get(ch + 1)
        if pan is None and ch in d['pans']:
            pan = round((d['pans'][ch] - 64) / 64 * 0.5, 2)
        if pan:
            opts['pan'] = pan
        v[name] = [inst0, mml, opts]
        vinfo.append({'name': name, 'inst': inst0, 'ch': ch + 1, 'notes': s['notes'], 'groups': len(L),
                      'chords': sum(1 for g in L if len(g['n']) > 1), 'ticks': endT,
                      'sound': sum(g['e'] - g['s'] for g in L), 'pitch': round(s['pitch'], 1)})
    # drums
    lost = 0
    for gi, letters in enumerate(kit_groups[:nkit]):
        hits = {}
        dv = [x.v for x in drums]
        mean = sum(dv) / max(1, len(dv))
        for x in sorted(drums, key=lambda x: x.s):
            if x.inst not in letters:
                continue
            acc = x.v >= max(mean + 12, 96)
            cur = hits.get(x.s)
            if cur is None or DRUM_PRIO.index(x.inst) < DRUM_PRIO.index(cur[0]):
                if cur is not None:
                    lost += 1
                hits[x.s] = (x.inst, acc)
            else:
                lost += 1
        toks = drum_tokens(hits, endT, barT)
        name = 'kit' if gi == 0 else f'kit{gi + 1}'
        kv = cfg.get('kitvol', 0.7)
        if isinstance(kv, list):
            kv = kv[gi]
        v[name] = ['kit', compress(toks, maxk=16), {'vol': kv}]
        vinfo.append({'name': name, 'inst': 'kit', 'ch': 10, 'notes': len(hits), 'ticks': endT})
    used_hits = sum(1 for x in drums if any(x.inst in g for g in kit_groups[:nkit]))
    if lost:
        log.append(f'drums: {lost} simultaneous hits collapsed (of {used_hits})')
    unmapped = len(d['song'].notes) - len(notes) - len(drums)
    bpm = round(d['bpm0'] * cfg['slow'])
    df = {'bpm': bpm, 'meter': meter, 'bars': bars, 'loop': loop_bar, 'echo': cfg.get('echo', [0.75, 0.35, 0.3])}
    if cfg.get('oneShot'):
        df['oneShot'] = True
    df['v'] = v
    rep = {'id': cfg['id'], 'file': cfg['file'], 'title': cfg['title'], 'seq': cfg.get('seq', ''),
           'bpm_src': round(d['bpm0'], 1), 'bpm': bpm, 'meter': meter, 'bars': bars, 'loop': loop_bar,
           'sec': round(bars * barT / PPQ * 60 / bpm, 1), 'voices': vinfo, 'log': log,
           'midi_notes': len(d['song'].notes), 'kept_notes': len(notes), 'drum_hits': len(drums),
           'dropped_channels': sorted(c + 1 for c in dropped), 'outside_or_unmapped': unmapped}
    return df, rep


# ----------------------------------------------------------------------------------------
def js_def(df):
    lines = ['{']
    for k in ('bpm', 'meter', 'bars', 'loop', 'echo', 'oneShot'):
        if k in df:
            lines.append(f'    {k}: {json.dumps(df[k])},')
    lines.append('    v: {')
    for name, (inst, mml, opts) in df['v'].items():
        lines.append(f'      {name}: [{json.dumps(inst)}, {json.dumps(mml)}, {json.dumps(opts)}],')
    lines.append('    },')
    lines.append('  }')
    return '\n'.join(lines)


HEADER = """// music_ct.js — GENERATED by tools/music/midi2ct.py from fan-made MIDI sequences. Do not edit by hand;
// change TRACKS in the converter and re-run it.
//
// Chrono Trigger music by Yasunori Mitsuda (Square) (Boss Battle 1: Noriko Matsueda; others: Mitsuda/Uematsu).
// MIDI sequences from VGMusic (vgmusic.com) by their sequencers, credited per track below.
// Arranged for ChronoTactics: slower tempos for turn-based play, voices reduced to the engine's 8 channels.
//
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--out', default=None)
    ap.add_argument('--report', default=None)
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    only = set(x for x in a.only.split(',') if x)
    defs, reps = [], []
    for cfg in TRACKS:
        if only and cfg['id'] not in only:
            continue
        df, rep = convert(a.src, cfg)
        defs.append((cfg, df))
        reps.append(rep)
        print(f"{cfg['id']:18s} {cfg['file']:28s} bpm {rep['bpm_src']:>6} -> {rep['bpm']:>3}  {rep['meter']}  bars {rep['bars']:>3} "
              f"loop {rep['loop']:>2}  {rep['sec']:>6}s  voices {len(df['v'])}")
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
# Track table. slow = tempo factor vs. the sequence's main tempo. Channel numbers are 1-based.
# ----------------------------------------------------------------------------------------
FIELD = [0.75, 0.35, 0.3]
BATTLE = [0.5, 0.25, 0.2]
AMBIENT = [1, 0.5, 0.45]
TRACKS = [
    dict(id='mus_title', title='Chrono Trigger', file='ct_chrono1.mid', seq='Quietust', slow=0.7, echo=[0.75, 0.4, 0.35]),
    dict(id='mus_battle', title='Battle', file='chrono_trigger_battle1.mid', seq='', slow=0.85, echo=BATTLE),
]

if __name__ == '__main__':
    main()
