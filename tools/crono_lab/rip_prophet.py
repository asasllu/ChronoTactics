"""Build public/js/sheets/prophet.js (the Prophet's hooded shape, worn by the Curator's
phase-1 docent body) from the Chrono Trigger Prophet sheet supplied by the user.

    python3 tools/crono_lab/rip_prophet.py

rip/prophet_sheet.png is assets/the_prophet.png (RGBA on a purple ground) flattened onto
magenta. Frame ids index rip/prophet_frames.json:
  0-3 front walk (0/2 hem swayed left/right, 1/3 near-still), 16 front with the face lit
  4-7 back walk (the blue-gloved hands show), 8-11 side facing right (8 = 10 stand,
  9/11 steps), 12-15 side facing left (12 = 14 stand).
There are no attack or spell frames, so they are built here from these (no new pixels):
  - flare(): the cloak hem spreads outward, more towards the bottom (left half pushed left,
    right half right, the centre column repeated), as if a wind lifts it;
  - shift(): head and shoulders lean or settle;
  - the casts and the attack rise off the ground (negative dy) and hold a glow near the
    hands (rim light); the ko is the empty cloak sinking and then dithering away.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_cyrus import VSheet

GLOVE = (104, 168, 248)
RIM = '#b8a0ff'


def flare(px, y0, k, fx):
    """Spread the rows below y0 apart around the column fx: 0 px at y0, k px at the hem."""
    h, w = len(px), len(px[0])
    out = [[None] * (w + 2 * k) for _ in range(h)]
    for y in range(h):
        kk = 0 if y < y0 else round(k * (y - y0) / max(1, h - 1 - y0))
        row = px[y]
        for x in range(w):
            p = row[x]
            if p is None:
                continue
            if x < fx:
                out[y][x + k - kk] = p
            else:
                out[y][x + k + kk] = p
        if kk:   # fill the opened seam with the centre pixels
            for x in range(fx - kk, fx + kk):
                src = row[fx - 1] if x < fx else row[fx]
                if src is not None and out[y][x + k] is None:
                    out[y][x + k] = src
    return out


def shift(px, y0, y1, dx, dy):
    h, w = len(px), len(px[0])
    px = [r[:] for r in px]
    cut = [(x, y, px[y][x]) for y in range(y0, y1 + 1) for x in range(w) if px[y][x] is not None]
    for x, y, _ in cut:
        px[y][x] = None
    for x, y, p in cut:
        if 0 <= x + dx < w and 0 <= y + dy < h:
            px[y + dy][x + dx] = p
    return px


def make(s, name, base, k=0, y0=None, lean=None, sink=0):
    """Virtual frame from `base`: optional lean (y0, y1, dx, dy), cloak flare k, and a
    sink (the top rows pressed down `sink` px, rows dropped from the middle)."""
    px, fx, fy = s.grab(base, False)
    px = [r[:] for r in px]
    if lean:
        px = shift(px, *lean)
    if sink:
        h = len(px)
        mid = h // 3
        px = [[None] * len(px[0]) for _ in range(sink)] + px[:mid] + px[mid + sink:]
    if k:
        px = flare(px, y0 if y0 is not None else len(px) // 2, k, fx)
        fx += k
    s.virt[name] = (px, fx, fy)


def centroid(s, fid, col, flip=False):
    px, fx, fy = s.grab(fid, flip)
    pts = [(x, y) for y, r in enumerate(px) for x, p in enumerate(r) if p == col]
    x = sum(p[0] for p in pts) / len(pts)
    y = sum(p[1] for p in pts) / len(pts)
    return [round(s.AX - fx + x), round(s.AY - fy + y)]


def build():
    s = VSheet('prophet', w=60, h=60, ax=30, ay=56, credit='(the Prophet)')
    F = False
    # Breathing / talking variants.
    make(s, 'breath1', 1, lean=(0, 16, 0, 1))
    make(s, 'breath4', 4, lean=(0, 16, 0, 1))
    # Spell: the face lit (16), the cloak lifting in three steps.
    make(s, 'lit_f1', 16, k=1, y0=14)
    make(s, 'lit_f2', 16, k=2, y0=12)
    make(s, 'lit_f4', 16, k=4, y0=10)
    make(s, 'back_f1', 4, k=1, y0=14)
    make(s, 'back_f2', 4, k=2, y0=12)
    make(s, 'back_f4', 4, k=4, y0=10)
    # Attack in profile: draw back, then surge forward with the hem flung out.
    make(s, 'side_back', 8, lean=(0, 18, -1, 0))
    make(s, 'side_surge', 8, k=3, y0=14, lean=(0, 18, 2, 0))
    make(s, 'side_surge2', 8, k=2, y0=16, lean=(0, 18, 1, 0))
    # Hurt: the hood snaps back.
    make(s, 'recoil', 1, lean=(0, 16, -1, 0))
    # KO: the cloak empties and sinks.
    make(s, 'sink3', 'recoil', k=1, y0=20, sink=3)
    make(s, 'sink7', 1, k=2, y0=18, sink=7)
    make(s, 'sink12', 1, k=3, y0=14, sink=12)
    dis = s.dissolve('sink12', 3)

    glow_f = [s.AX, s.AY - 22]                       # before the chest (front)
    glow_b = centroid(s, 4, GLOVE)                   # the gloved hands (back)
    hit_side = s.gpt('side_surge', 18, 17)           # just before the hood

    # ---- se: front
    s.add('se', 'idle', [(1, 640), ('breath1', 320), (3, 560), ('breath1', 320)], loop=True)
    s.add('se', 'walk', [(0, 130), (1, 130), (2, 130), (3, 130)], loop=True)
    s.add('se', 'talk', [(1, 260), (16, 320), (1, 200), ('breath1', 220)], loop=True)
    s.add('se', 'attack', [(8, 140), ('side_back', 160, F, -1, 0), ('side_surge', 80, F, 3, -2),
                           ('side_surge', 200, F, 6, -3), ('side_surge2', 140, F, 4, -2), (8, 160)],
          hit=3, rim=RIM, glow=[None, None, hit_side, hit_side, None, None])
    s.add('se', 'cast', [('lit_f1', 180, F, 0, -2), ('lit_f2', 180, F, 0, -3), ('lit_f4', 300, F, 0, -5),
                         ('lit_f2', 180, F, 0, -3), (1, 200)],
          charge=[0, 1], release=2, rim=RIM, glow=[glow_f, glow_f, glow_f, glow_f])
    s.add('se', 'hurt', [('recoil', 200, F, -3), (1, 220, F, -1)])
    s.add('se', 'ko', [('recoil', 160, F, -2), ('sink3', 140), ('sink7', 140), ('sink12', 220)]
          + [(n, 140) for n in dis])
    # ---- ne: back
    s.add('ne', 'idle', [(4, 640), ('breath4', 320), (4, 560), ('breath4', 320)], loop=True)
    s.add('ne', 'walk', [(4, 130), (5, 130), (6, 130), (7, 130)], loop=True)
    s.add('ne', 'attack', s.anims['se']['attack'][0], **s.anims['se']['attack'][1])
    s.add('ne', 'cast', [('back_f1', 180, F, 0, -2), ('back_f2', 180, F, 0, -3), ('back_f4', 300, F, 0, -5),
                         ('back_f2', 180, F, 0, -3), (4, 200)],
          charge=[0, 1], release=2, rim=RIM, glow=[glow_b, glow_b, glow_b, glow_b])
    s.add('ne', 'hurt', [('recoil', 200, F, -3), (4, 220, F, -1)])
    s.add('ne', 'ko', s.anims['se']['ko'][0])
    s.build(head=[30, 32])
    return s


if __name__ == '__main__':
    build()
