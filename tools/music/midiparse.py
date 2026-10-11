"""Tiny standard-MIDI-file reader (format 0/1) used by midi2ct.py.

Returns a Song with:
  ppq, tempos [(tick, us_per_quarter)], timesigs [(tick, num, den)],
  notes [Note(tick, dur, pitch, vel, ch, track)], programs {(ch): [(tick, prog)]},
  texts [str] (track names / copyright / text meta, for credits), end tick.
Pure Python, no dependencies; defensive against malformed input.
"""
import struct
from dataclasses import dataclass, field


@dataclass
class Note:
    tick: int
    dur: int
    pitch: int
    vel: int
    ch: int
    track: int


@dataclass
class Song:
    ppq: int = 96
    tempos: list = field(default_factory=list)
    timesigs: list = field(default_factory=list)
    notes: list = field(default_factory=list)
    programs: dict = field(default_factory=dict)
    volumes: dict = field(default_factory=dict)
    pans: dict = field(default_factory=dict)
    texts: list = field(default_factory=list)
    track_names: dict = field(default_factory=dict)
    end: int = 0
    markers: list = field(default_factory=list)


def _vlq(b, i):
    v = 0
    for _ in range(4):
        if i >= len(b):
            break
        c = b[i]
        i += 1
        v = (v << 7) | (c & 0x7F)
        if not c & 0x80:
            break
    return v, i


def read(path):
    with open(path, 'rb') as fh:
        data = fh.read()
    i = data.find(b'MThd')
    if i < 0:
        raise ValueError('not a MIDI file')
    hlen, fmt, ntrk, div = struct.unpack('>IHHH', data[i + 4:i + 14])
    if div & 0x8000:
        raise ValueError('SMPTE timing unsupported')
    s = Song(ppq=div)
    i += 8 + hlen
    for tn in range(ntrk):
        j = data.find(b'MTrk', i)
        if j < 0:
            break
        (tlen,) = struct.unpack('>I', data[j + 4:j + 8])
        trk = data[j + 8:j + 8 + tlen]
        i = j + 8 + tlen
        _track(s, trk, tn)
    s.notes.sort(key=lambda n: (n.tick, n.ch, -n.pitch))
    s.tempos.sort(key=lambda x: x[0])  # stable: same-tick events keep track order
    s.timesigs.sort(key=lambda x: x[0])
    if not s.tempos or s.tempos[0][0] > 0:
        s.tempos.insert(0, (0, 500000, -1))
    return s


def _track(s, b, tn):
    i, tick, run = 0, 0, 0
    on = {}  # (ch,pitch) -> [(tick, vel)]
    while i < len(b):
        dt, i = _vlq(b, i)
        tick += dt
        if i >= len(b):
            break
        st = b[i]
        if st & 0x80:
            i += 1
            if st < 0xF0:
                run = st
        else:
            st = run
        if st == 0xFF:
            if i >= len(b):
                break
            typ = b[i]
            ln, i = _vlq(b, i + 1)
            body = b[i:i + ln]
            i += ln
            if typ == 0x51 and ln == 3:
                s.tempos.append((tick, (body[0] << 16) | (body[1] << 8) | body[2], tn))
            elif typ == 0x58 and ln >= 2:
                s.timesigs.append((tick, body[0], 2 ** body[1]))
            elif typ in (1, 2, 3, 6):
                t = body.decode('latin-1', 'replace').strip()
                if t:
                    if typ == 3:
                        s.track_names.setdefault(tn, t)
                    if typ == 6:
                        s.markers.append((tick, t))
                    s.texts.append(t)
            elif typ == 0x2F:
                break
            continue
        if st in (0xF0, 0xF7):
            ln, i = _vlq(b, i)
            i += ln
            continue
        hi, ch = st & 0xF0, st & 0x0F
        if hi in (0xC0, 0xD0):
            d1 = b[i] if i < len(b) else 0
            i += 1
            if hi == 0xC0:
                s.programs.setdefault(ch, []).append((tick, d1))
            continue
        if i + 1 >= len(b) + 1:
            break
        d1 = b[i] if i < len(b) else 0
        d2 = b[i + 1] if i + 1 < len(b) else 0
        i += 2
        if hi == 0x90 and d2 > 0:
            on.setdefault((ch, d1), []).append((tick, d2))
        elif hi == 0x80 or (hi == 0x90 and d2 == 0):
            q = on.get((ch, d1))
            if q:
                t0, v = q.pop(0)
                s.notes.append(Note(t0, max(1, tick - t0), d1, v, ch, tn))
        elif hi == 0xB0 and d1 == 7:
            s.volumes.setdefault(ch, []).append((tick, d2))
        elif hi == 0xB0 and d1 == 10:
            s.pans.setdefault(ch, []).append((tick, d2))
    for (ch, p), q in on.items():
        for t0, v in q:
            s.notes.append(Note(t0, max(1, min(tick - t0, s.ppq * 4)), p, v, ch, tn))
    s.end = max(s.end, tick)
