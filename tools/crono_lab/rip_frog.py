"""Build public/js/sheets/frog.js from the Chrono Trigger Frog sprite sheet (Frog captured
by Toadkarter; human Frog/Glenn by Tonberry2k, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_frog.py

Frame ids index tools/crono_lab/rip/frog_frames.json (see rip/frog_labels*.png). The human
Glenn frames (207, 208, 245, 246) are not used. Conventions as in rip_crono.py: 'se' uses the
front sprites for standing/walking/story gestures and the profile sprites (which face LEFT
on the sheet, so they are mirrored) for battle moves; 'ne' uses the back sprites.

Some frames on this sheet carry a ground shadow (a flat blob of outline colours under the
sprite). The game draws its own shadow, so those blobs are removed before anchoring.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet

SHADOW = {(40, 32, 40), (64, 32, 56)}
FUSED_SHADOW = {158, 243, 92, 82, 81, 105, 106, 97, 141}
MASAMUNE = {(88, 192, 216), (248, 248, 248), (248, 120, 0)}  # blade, edge glint, hilt


class FrogSheet(Sheet):
    def grab(self, fid, flip):
        x0, y0, x1, y1 = self.box(fid)
        w, h = x1 - x0 + 1, y1 - y0 + 1
        px = [[self.im.getpixel((x0 + x, y0 + y)) for x in range(w)] for y in range(h)]
        px = [[None if p == self.bg else p for p in row] for row in px]
        # Drop detached ground shadows: 8-connected blobs made only of shadow colours that
        # are wide and flat and sit below the rest of the sprite.
        seen = [[False] * w for _ in range(h)]
        blobs = []
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
                    blobs.append(pts)
        for pts in blobs:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            if (all(px[y][x] in SHADOW for x, y in pts) and max(ys) - min(ys) <= 4
                    and max(xs) - min(xs) >= 6 and max(ys) >= h - 2):
                for x, y in pts:
                    px[y][x] = None
        # Frames whose shadow is fused to the body: drop shadow-coloured pixels that touch
        # no other colour (the blob's inside), then the stray shadow bits left over.
        if fid in FUSED_SHADOW:
            def touches(x, y):
                return any(0 <= x + dx < w and 0 <= y + dy < h and px[y + dy][x + dx]
                           and px[y + dy][x + dx] not in SHADOW
                           for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            gone = [(x, y) for y in range(h) for x in range(w)
                    if px[y][x] in SHADOW and not touches(x, y)]
            for x, y in gone:
                px[y][x] = None
            for y in range(h):
                for x in range(w):
                    if px[y][x] in SHADOW and not any(
                            0 <= x + dx < w and 0 <= y + dy < h and px[y + dy][x + dx]
                            and (dx or dy) and px[y + dy][x + dx] not in SHADOW
                            for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                        px[y][x] = None
        # Trim emptied rows at the bottom so the frame box stays tight.
        while px and not any(px[-1]):
            px.pop()
        if flip:
            px = [row[::-1] for row in px]
        h = len(px)
        body = [(x, y) for y in range(h) for x in range(w) if px[y][x] and px[y][x] not in self.weapon]
        fy = max(y for _, y in body)
        feet = [x for x, y in body if y >= fy - 3]
        fx = round((min(feet) + max(feet)) / 2)
        return px, fx, fy


AX, AY = 40, 74
s = FrogSheet('frog', w=80, h=80, ax=AX, ay=AY, weapon=MASAMUNE,
              credit='(Frog captured by Toadkarter; human Frog by Tonberry2k)')
A, F = True, False  # A: profile frame mirrored to face right; F: front/back frame as is
WATER = '#8cc4f0'

# ---- front view (se) -----------------------------------------------------------------
# 0 front stand, 16 blink, 11/12 glance left/right, 1-6 walk cycle.
s.add('se', 'idle', [(0, 800), (16, 130), (0, 600), (12, 400)], loop=True)
s.add('se', 'walk', [(i, 110) for i in (1, 2, 3, 4, 5, 6)], loop=True)
# Masamune: crouch, spring (114), airborne wind-up, downward cut (137), low follow-through.
s.add('se', 'attack', [(37, 100, A), (128, 110, A), (114, 80, A, 4, -8), (137, 70, A, 8, -4),
                       (158, 170, A, 10), (47, 110, A, 7), (37, 140, A, 3)], hit=4)
# Water / Heal: arms spread and raised (109/110 loop), both hands thrust up (225).
s.add('se', 'cast', [(109, 170), (110, 170), (225, 240), (225, 120), (0, 200)],
      charge=[0, 1], release=2, rim=WATER, glow=None)
s.add('se', 'hurt', [(141, 200, A, -3), (49, 200, A, -1)])
s.add('se', 'ko', [(49, 160, A), (55, 1000, A)])
s.add('se', 'kneel', [(14, 1000)], loop=True)
s.add('se', 'victory', [(225, 320), (223, 260), (225, 320), (224, 260)], loop=True)
s.add('se', 'jump', [(243, 120), (82, 90, F, 0, -8), (165, 200, F, 0, -16), (92, 140)])
# Slurp: head back (135), tongue lashes out (136).
s.add('se', 'tech_slurp', [(37, 160, A), (135, 120, A), (136, 220, A), (136, 100, A), (135, 80, A),
                           (37, 160, A)], hit=2)
# Slurp Cut: tongue grabs (136), then a Masamune cut (138) and follow-through (158).
s.add('se', 'tech_slurp_cut', [(135, 110, A), (136, 200, A), (44, 70, A, 2), (138, 170, A, 4),
                               (158, 130, A, 4), (37, 150, A)], hit=3)
# Leap Slash: crouch, spring, sword raised high in the air (184), dive cut (137), land low.
s.add('se', 'tech_leap_slash', [(128, 160, A), (114, 80, A, 2, -14), (184, 180, A, 5, -30),
                                (137, 60, A, 8, -12), (158, 200, A, 9), (158, 130, A, 9),
                                (128, 140, A, 5), (37, 120, A)], hit=4)
# Frog Squash: crouch, spring up out of view, drop back down and slam flat.
s.add('se', 'tech_frog_squash', [(243, 180), (82, 70, F, 0, -18), (165, 90, F, 0, -56),
                                 (165, 260, F, 0, -120), (82, 60, F, 0, -30), (81, 220),
                                 (92, 150), (0, 140)], hit=5)
# X Strike: Masamune raised (98), flat dash (187), cut (138), low follow-through.
s.add('se', 'tech_x_strike', [(98, 90, A), (187, 90, A, 4, -2), (187, 50, A, 10, -2),
                              (138, 170, A, 12), (158, 120, A, 8), (37, 120, A)], hit=3)
s.add('se', 'draw_sword', [(0, 200), (7, 180), (8, 120), (9, 90), (10, 500)])

# ---- back view (ne) ------------------------------------------------------------------
s.add('ne', 'idle', [(19, 900), (30, 350), (19, 700), (31, 350)], loop=True)
s.add('ne', 'walk', [(i, 110) for i in (20, 21, 22, 23, 24, 25)], loop=True)
s.add('ne', 'cast', [(124, 170), (125, 170), (230, 240), (230, 120), (19, 200)],
      charge=[0, 1], release=2, rim=WATER, glow=None)
s.add('ne', 'kneel', [(33, 1000)], loop=True)
s.add('ne', 'victory', [(230, 320), (228, 260), (230, 320), (229, 260)], loop=True)
s.add('ne', 'jump', [(105, 120), (106, 90, F, 0, -8), (166, 200, F, 0, -16), (97, 140)])
s.add('ne', 'tech_frog_squash', [(105, 180), (106, 70, F, 0, -18), (166, 90, F, 0, -56),
                                 (166, 260, F, 0, -120), (106, 60, F, 0, -30), (105, 220),
                                 (97, 150), (19, 140)], hit=5)
s.add('ne', 'draw_sword', [(19, 200), (26, 180, A), (27, 120, A), (28, 90, A), (29, 500, A)])
# Profile battle moves read the same from behind: reuse them.
for name in ('attack', 'hurt', 'ko', 'tech_slurp', 'tech_slurp_cut', 'tech_leap_slash',
             'tech_x_strike'):
    s.anims['ne'][name] = s.anims['se'][name]


# Glow points near the hands for the cast frames (in canvas coords, after anchoring).
def hands(view, name, ys):
    frames, extra = s.anims[view][name]
    extra['glow'] = [[AX, AY - y] for y in ys]


hands('se', 'cast', [28, 28, 30, 30])
hands('ne', 'cast', [28, 28, 30, 30])
s.build(head=[AX, AY - 22])
