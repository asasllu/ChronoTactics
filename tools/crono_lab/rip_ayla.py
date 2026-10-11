"""Build public/js/sheets/ayla.js from the Chrono Trigger Ayla sprite sheet (captured by
Tonberry2k, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_ayla.py

Frame ids index tools/crono_lab/rip/ayla_frames.json (see rip/ayla_labels*.png).
Unlike the other sheets, Ayla's side (3/4) battle sprites already face RIGHT on this sheet,
so they are used as drawn (no mirroring). What the sheet holds, by id:
  1 front stand, 2 blink, 3-8 front walk, 16 back stand, 17-22 back walk
  23 3/4 stance, 24/25 jabs, 140 punch wound up, 141 punch thrown (the fist combo)
  35-40, 43, 72-73 tail spin: crouched with a leg sweeping round (front/3/4/back), 43 split
  46 mid-air flip, 47/87 crouch with a leg cocked, 48/86 cat crouch, 49/50 pounce, 51 dive
  74 kiss (puckered, sparkles), 75 wink with a sparkle, 172 crouched wink
  82-85 claw dash (one arm cocked high, lunging), 68-71 back claw flurry
  96 rising knee kick, 97 back kick, 98 flying kick (leg driven down-forward)
  99/101 something hoisted overhead (front / 3/4), 100 the same from behind
  108-113 rolled into a ball, 115 front crouch, 120-123 tail-spin whirlwind
  124 3/4 stand, 126 hand behind the head, 136 front guard, 137 3/4 crouch
  62/63 back stand (hair swayed), 138/139 back wide stance, 142/143 front cheer, 144/145 back cheer, 154/155 front cheer hop,
  156/157 back cheer hop, 150/151 back point, 152 3/4 point, 160-162 recoil (front, back, 3/4)
  163/164 crouch (front/back), 167-170 kneels, 173 lying down, 174/176 back flex, 175 front flex

The sheet's comment says Ayla reuses her "being attacked" poses before magic: the cast
(power-up) starts from her crouch/guard poses before the flex.

Most frames carry a ground shadow fused to the feet (outline colour (40,24,32)); the game
draws its own shadow, so it is stripped before anchoring.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet  # noqa: E402

SHADOW = (40, 24, 32)
SKIN = {(248, 176, 144), (216, 128, 72), (152, 96, 80)}


class AylaSheet(Sheet):
    def grab(self, fid, flip):
        x0, y0, x1, y1 = self.box(fid)
        w, h = x1 - x0 + 1, y1 - y0 + 1
        px = [[self.im.getpixel((x0 + x, y0 + y)) for x in range(w)] for y in range(h)]
        px = [[None if p == self.bg else p for p in row] for row in px]

        def other(x, y):  # a non-shadow body colour in the 8-neighbourhood
            return any(0 <= x + a < w and 0 <= y + b < h and px[y + b][x + a]
                       and px[y + b][x + a] != SHADOW
                       for a in (-1, 0, 1) for b in (-1, 0, 1))

        # Detached shadow blobs: connected, shadow-only, flat, at the bottom.
        seen = [[False] * w for _ in range(h)]
        for y in range(h):
            for x in range(w):
                if px[y][x] and not seen[y][x]:
                    st, pts = [(x, y)], []
                    seen[y][x] = True
                    while st:
                        a, b = st.pop()
                        pts.append((a, b))
                        for dx in (-1, 0, 1):
                            for dy in (-1, 0, 1):
                                X, Y = a + dx, b + dy
                                if 0 <= X < w and 0 <= Y < h and px[Y][X] and not seen[Y][X]:
                                    seen[Y][X] = True
                                    st.append((X, Y))
                    ys = [p[1] for p in pts]
                    if all(px[b][a] == SHADOW for a, b in pts) and max(ys) - min(ys) <= 4 and max(ys) >= h - 2:
                        for a, b in pts:
                            px[b][a] = None
        # Fused shadow: in the bottom rows, shadow pixels that touch no other colour are
        # the blob's inside (the ones that do are the boots' outline). Twice, to eat the
        # fringe left over.
        for _ in range(2):
            gone = [(x, y) for y in range(max(0, h - 5), h) for x in range(w)
                    if px[y][x] == SHADOW and not other(x, y)]
            for x, y in gone:
                px[y][x] = None
        while px and not any(px[-1]):
            px.pop()
        if flip:
            px = [row[::-1] for row in px]
        h = len(px)
        body = [(x, y) for y in range(h) for x in range(w) if px[y][x]]
        fy = max(y for _, y in body)
        feet = [x for x, y in body if y >= fy - 3]
        fx = round((min(feet) + max(feet)) / 2)
        return px, fx, fy

    def hands(self, fid, flip=False, where='top'):
        """Canvas point near the hands: the highest skin pixels in the upper body ('top')
        or the skin pixel furthest forward (screen-right) in it ('front')."""
        px, fx, fy = self.grab(fid, flip)
        g = [(x, y) for y in range(len(px)) for x, p in enumerate(px[y]) if p in SKIN]
        if where == 'top':
            ty = min(y for _, y in g)
            xs = [x for x, y in g if y <= ty + 2]
            x, y = (min(xs) + max(xs)) / 2, ty
        else:
            up = [(x, y) for x, y in g if y < len(px) * 0.6]
            x = max(x for x, _ in up)
            y = min(yy for xx, yy in up if xx == x)
        return [round(self.AX - fx + x), round(self.AY - fy + y)]


W, H, AX, AY = 64, 56, 32, 52
s = AylaSheet('ayla', w=W, h=H, ax=AX, ay=AY, credit='captured by Tonberry2k')
F = False  # every frame is used as drawn (side frames already face right)
RIM = '#fff0a0'

# ---- se: facing screen-right, towards the viewer ---------------------------------------
s.add('se', 'idle', [(1, 800), (2, 130), (1, 600), (61, 400)], loop=True)
s.add('se', 'walk', [(i, 110) for i in (3, 4, 5, 6, 7, 8)], loop=True)
# Fist combo: stance, wind-up, punch, two jabs, wind-up, the big punch, recover.
s.add('se', 'attack', [(23, 100), (140, 90, F, 2), (141, 70, F, 4), (24, 70, F, 4), (25, 90, F, 5),
                       (140, 70, F, 5), (141, 170, F, 6), (23, 130, F, 1)], hit=6)
# Power-up: "being attacked" crouch and guard (charge loop), then the flex.
cast = [(163, 170), (136, 170), (175, 260), (175, 140), (1, 200)]
s.add('se', 'cast', cast, charge=[0, 1], release=2, rim=RIM,
      glow=[s.hands(163, F, 'top'), s.hands(136, F, 'top'), s.hands(175, F, 'top'),
            s.hands(175, F, 'top'), s.hands(1, F, 'front')])
s.add('se', 'hurt', [(162, 200, F, -3), (137, 200, F, -1)])
s.add('se', 'ko', [(162, 160, F, -2), (173, 1000)])
s.add('se', 'kneel', [(168, 1000), (167, 700)], loop=True)
s.add('se', 'victory', [(142, 300), (154, 160, F, 0, -4), (143, 300), (155, 160, F, 0, -4)], loop=True)
s.add('se', 'jump', [(115, 120), (154, 80, F, 0, -5), (154, 220, F, 0, -12), (115, 130)])
s.add('se', 'point', [(124, 120), (152, 600)])
# Kiss: hand behind the head, then the puckered kiss with sparkles.
s.add('se', 'tech_kiss', [(124, 160), (126, 200), (74, 300, F, 1), (74, 200, F, 1), (1, 160)], hit=2)
# Charm: a wink with a sparkle, then a cute crouch.
s.add('se', 'tech_charm', [(124, 150), (75, 320), (172, 260), (75, 180), (124, 140)], hit=1)
# Cat Attack: cat crouch, pounce, dash in, claw flurry, spring back.
s.add('se', 'tech_cat_attack', [(48, 130), (49, 70, F, 7, -3), (50, 60, F, 13), (83, 70, F, 15),
                                (84, 60, F, 15), (85, 60, F, 15), (82, 80, F, 15), (83, 60, F, 15),
                                (84, 60, F, 15), (49, 100, F, 8, -4), (48, 110, F, 1), (23, 120)], hit=3)
# Triple Kick: crouch, then three kicks climbing into the air, flip down, land.
s.add('se', 'tech_triple_kick', [(115, 110), (96, 90, F, 3, -4), (98, 70, F, 5, -8), (97, 70, F, 6, -12),
                                 (96, 70, F, 7, -18), (98, 70, F, 8, -22), (46, 60, F, 8, -28),
                                 (98, 170, F, 9, -30), (46, 80, F, 6, -16), (115, 110, F, 2), (23, 120)], hit=7)
# Rollo Kick: crouch, roll up into a ball and roll in, burst out in a flying kick.
s.add('se', 'tech_rollo_kick', [(115, 120), (109, 60, F, 0, -3), (112, 50, F, 2), (110, 50, F, 6),
                                (113, 50, F, 10), (109, 50, F, 14, -2), (98, 180, F, 17, -5),
                                (46, 100, F, 13, -8), (115, 100, F, 6), (23, 110)], hit=6)
# Tail Spin: crouch, legs sweep round (front, 3/4, back), whirlwind, split, recover.
spin = [35, 36, 40, 38, 39, 73, 72]
s.add('se', 'tech_tail_spin', [(115, 110)] + [(i, 55) for i in spin] +
      [(i, 55) for i in (120, 121, 122, 123, 120, 121, 122, 123)] +
      [(43, 90), (115, 110), (1, 120)], hit=2)
# Drop Kick: crouch, leap, flip at the top, dive feet first, rebound, land.
s.add('se', 'tech_drop_kick', [(115, 140), (96, 80, F, 0, -10), (46, 150, F, 3, -24), (98, 70, F, 9, -16),
                               (98, 50, F, 14, -7), (98, 170, F, 16, -2), (46, 100, F, 10, -8),
                               (115, 110, F, 3), (23, 120)], hit=5)
# Beast Toss: grab low, hoist overhead (charge loop), hurl it (release), follow through.
toss = [(163, 160), (99, 180), (101, 180), (82, 170, F, 2), (141, 150, F, 2), (23, 150)]
s.add('se', 'tech_beast_toss', toss, charge=[1, 2], release=3, hit=3, rim=RIM,
      glow=[s.hands(163), s.hands(99), s.hands(101), s.hands(82, F, 'front'), s.hands(141, F, 'front'),
            s.hands(23, F, 'front')])

# ---- ne: facing screen-right, away from the viewer --------------------------------------
s.add('ne', 'idle', [(16, 700), (62, 250), (16, 500), (63, 250)], loop=True)
s.add('ne', 'walk', [(i, 110) for i in (17, 18, 19, 20, 21, 22)], loop=True)
ncast = [(164, 170), (138, 170), (174, 260), (174, 140), (16, 200)]
s.add('ne', 'cast', ncast, charge=[0, 1], release=2, rim=RIM,
      glow=[s.hands(164), s.hands(138), s.hands(174), s.hands(174), s.hands(16)])
s.add('ne', 'hurt', [(161, 200, F, -3), (139, 200, F, -1)])
s.add('ne', 'ko', [(161, 160, F, -2), (173, 1000)])
s.add('ne', 'kneel', [(169, 1000)], loop=True)
s.add('ne', 'victory', [(144, 300), (156, 160, F, 0, -4), (145, 300), (157, 160, F, 0, -4)], loop=True)
s.add('ne', 'jump', [(139, 120), (156, 80, F, 0, -5), (156, 220, F, 0, -12), (139, 130)])
s.add('ne', 'point', [(16, 120), (151, 600)])
# Side battle moves read the same from behind: reuse them.
for name in ('attack', 'tech_kiss', 'tech_charm', 'tech_cat_attack', 'tech_triple_kick',
             'tech_rollo_kick', 'tech_tail_spin', 'tech_drop_kick', 'tech_beast_toss'):
    s.anims['ne'][name] = s.anims['se'][name]

s.build(head=[AX, AY - 26])
