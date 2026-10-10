"""Build public/js/sheets/magus.js from the Chrono Trigger Magus sprite sheet
(ripped by Ryan914, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_magus.py

Frame ids index tools/crono_lab/rip/magus_frames.json (see rip/magus_labels*.png).
What the sheet holds, by id:
  0 front stand, 3 front blink, 2 back stand
  34-37 front flying (cape spread like wings, legs tucked, baked shadow)
  88-91 back flying (cape spread, legs dangling, baked shadow)
  92-104 front 3/4 facing left: 92 point, 94-96 fist raised, 97-99 stance,
         100-104 hand flick with the cape billowing
  115-128 back 3/4 facing left: 117/120 point, 118-119 fist raised, 115/121 stand,
          123-125 hand flick with cape
  107-110 front: 107 one arm up, 108/109 both arms up, 110 arms spread low
  111-114 back: 111/112 one arm up, 113 both up, 114 arms low
  135 front 3/4 recoil, 137 back 3/4 recoil, 138-143 kneels, 144 lying
  150-162 scythe frames (3/4, facing left): 158 crouch, 161 scythe raised behind,
          159 slash forward-low, 162 follow-through
  163-168 wrapped in the cape: 163 front, 166 front hovering (feet dangling)

Magus floats in this game: standing poses hover a few px (negative dy) with a slow bob;
walking uses the flying frames (the baked shadow is stripped, but the frame is anchored
where the shadow lay, so the body glides at the same height as the hovering stand).
3/4 battle frames face left on the sheet and are mirrored (flip=True) to face right.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet  # noqa: E402

SCYTHE = {(64, 56, 64), (128, 112, 128), (192, 192, 192)}
SHADOW = {(40, 24, 32), (48, 32, 40)}
GLOVE = {(208, 136, 56), (168, 72, 48)}
# Frames with a baked ground shadow: the first sheet row (inside the box) of the shadow.
SHADOW_FROM = {34: 24, 35: 24, 36: 24, 37: 24, 88: 25, 89: 25, 90: 25, 91: 25}


class MagusSheet(Sheet):
    def grab(self, fid, flip):
        px, fx, fy = super().grab(fid, flip)
        if fid in SHADOW_FROM:
            # Anchored on the shadow (fx, fy found with it); now erase it. Shadow-coloured
            # pixels touching another colour are the legs' own outline: keep those.
            h, w = len(px), len(px[0])
            y0 = SHADOW_FROM[fid]

            def body(x, y):
                return 0 <= x < w and 0 <= y < h and px[y][x] and px[y][x] not in SHADOW

            drop = [(x, y) for y in range(y0, h) for x in range(w)
                    if px[y][x] in SHADOW and not any(body(x + a, y + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
            px = [row[:] for row in px]
            for x, y in drop:
                px[y][x] = None
        return px, fx, fy

    def hand(self, fid, flip, where='top'):
        """Canvas point of the hand: the topmost glove pixels ('top') or the glove pixel
        furthest forward (screen-right) in the upper body ('front')."""
        px, fx, fy = self.grab(fid, flip)
        h = len(px)
        g = [(x, y) for y in range(int(h * 0.6)) for x, p in enumerate(px[y]) if p in GLOVE]
        if where == 'top':
            ty = min(y for _, y in g)
            xs = [x for x, y in g if y <= ty + 2]
            x, y = (min(xs) + max(xs)) / 2, ty
        elif where == 'both':  # midpoint between two raised hands
            ty = min(y for _, y in g)
            xs = [x for x, y in g if y <= ty + 3]
            x, y = (min(xs) + max(xs)) / 2, ty - 2
        else:
            x = max(x for x, _ in g)
            y = round(sum(yy for xx, yy in g if xx >= x - 1) / len([1 for xx, _ in g if xx >= x - 1]))
            x += 1
        return [round(self.AX - fx + x), round(self.AY - fy + y)]


W, H, AX, AY = 80, 60, 40, 54
s = MagusSheet('magus', w=W, h=H, ax=AX, ay=AY, weapon=SCYTHE, credit='ripped by Ryan914')
F, T = False, True  # front/back frames as drawn; 3/4 battle frames mirrored to face right
HV = -3             # hover height of the standing poses


def hover(frames, bob=(0, -1)):
    """Add the hover lift (plus a gentle bob, cycling) to (id, ms[, flip, dx, dy]) frames."""
    out = []
    for i, f in enumerate(frames):
        f = list(f) + [F, 0, 0][len(f) - 2:]
        f[4] += HV + bob[i % len(bob)]
        out.append(tuple(f))
    return out


def glows(frames, kinds):
    return [s.hand(f[0], f[2] if len(f) > 2 else F, k) for f, k in zip(frames, kinds)]


RIM = '#b070ff'

# ---- se: facing screen-right, towards the viewer -------------------------------------
s.add('se', 'idle', hover([(0, 300), (0, 260), (3, 110), (0, 260)], bob=(0, -1, -1, 0)), loop=True)
s.add('se', 'walk', [(34, 110, F, 0, 0), (35, 110, F, 0, -1), (36, 110, F, 0, -1), (37, 110, F, 0, 0)], loop=True)

atk = hover([(97, 120, T), (158, 130, T), (161, 160, T), (159, 70, T, 3), (159, 150, T, 4), (162, 140, T, 2), (97, 140, T)],
            bob=(0, 1, 0, 0, 0, 0, 0))
s.add('se', 'attack', atk, hit=4)

cast = hover([(95, 170, T), (96, 170, T), (92, 230, T), (97, 160, T)], bob=(-1, -2, -1, 0))
s.add('se', 'cast', cast, charge=[0, 1], release=2, rim=RIM, glow=glows(cast, ['top', 'top', 'front', 'front']))

s.add('se', 'hurt', hover([(135, 220, T), (97, 170, T)], bob=(1, 0)))
s.add('se', 'ko', [(135, 180, T, 0, -2), (144, 1000, T)])
s.add('se', 'kneel', [(140, 600, T), (141, 700, T)], loop=True)
s.add('se', 'victory', hover([(100, 300, T), (101, 150, T), (102, 320, T), (101, 150, T)], bob=(0, -1, -1, 0)), loop=True)
s.add('se', 'jump', [(163, 130, F, 0, HV + 1), (166, 110, F, 0, -9), (166, 180, F, 0, -16), (163, 130, F, 0, HV)])

dm = hover([(110, 150), (107, 110), (109, 180), (109, 180), (110, 260), (0, 180)], bob=(0, -1, -2, -3, -1, 0))
s.add('se', 'tech_dark_matter', dm, charge=[2, 3], release=4, hit=4, rim=RIM,
      glow=glows(dm[:5], ['top', 'top', 'both', 'both', 'top']))

# ---- ne: facing screen-right, away from the viewer ------------------------------------
s.add('ne', 'idle', hover([(2, 300), (2, 260), (2, 300), (2, 260)], bob=(0, -1, -1, 0)), loop=True)
s.add('ne', 'walk', [(88, 110, F, 0, 0), (89, 110, F, 0, -1), (90, 110, F, 0, -1), (91, 110, F, 0, 0)], loop=True)
s.add('ne', 'attack', atk, hit=4)
ncast = hover([(118, 170, T), (119, 170, T), (117, 230, T), (121, 160, T)], bob=(-1, -2, -1, 0))
s.add('ne', 'cast', ncast, charge=[0, 1], release=2, rim=RIM, glow=glows(ncast, ['top', 'top', 'front', 'front']))
s.add('ne', 'hurt', hover([(137, 220, T), (121, 170, T)], bob=(1, 0)))
s.add('ne', 'ko', [(137, 180, T, 0, -2), (144, 1000, T)])
s.add('ne', 'kneel', [(142, 600), (143, 700)], loop=True)
s.add('ne', 'victory', hover([(123, 300, T), (124, 150, T), (125, 320, T), (124, 150, T)], bob=(0, -1, -1, 0)), loop=True)
s.add('ne', 'jump', [(165, 130, T, 0, HV + 1), (168, 110, T, 0, -9), (168, 180, T, 0, -16), (165, 130, T, 0, HV)])
ndm = hover([(114, 150), (112, 110), (113, 180), (113, 180), (114, 260), (2, 180)], bob=(0, -1, -2, -3, -1, 0))
s.add('ne', 'tech_dark_matter', ndm, charge=[2, 3], release=4, hit=4, rim=RIM,
      glow=glows(ndm[:5], ['top', 'top', 'both', 'both', 'top']))

s.build(head=[AX, AY - 27])
