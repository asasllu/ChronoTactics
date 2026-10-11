"""Build public/js/sheets/cyrus.js (Sir Cyrus, the Warden) from the Chrono Trigger
"Prototype Cyrus" sheet ripped by the Chrono Compendium, supplied by the user.

    python3 tools/crono_lab/rip_cyrus.py [--preview DIR]

rip/cyrus_sheet.png is tools/crono_lab/rip/assets/cyrus.png (armoured rows) on magenta.
Frames 0-4 front (0 = stand, 1-4 walk), 5-9 back (5 = stand, 6-9 walk), 10-14 side facing
left, 15-19 side facing RIGHT (15 = stand, 16/18 = steps), 20 kneel (back), 21 kneel
(front), 22 lying (ko).

The sheet has no attack frames, so the battle poses are composed here: the right-facing
side frames get a hand-pixelled armoured arm and a straight sword (steel greys, dark
outline, gold guard; all colours from his own palette), plus dx/dy lunges. These edits
live in this script (POSES); the asset PNG is untouched. The helper classes (VSheet,
Canvas) are shared with rip_cyrus_human.py.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet

# Letters used in the hand-drawn overlays -> colours from Cyrus' own palette.
LEG = {
    '#': (40, 40, 40),      # outline
    'd': (48, 40, 48),      # dark armour / grip
    's': (80, 88, 104),     # dark steel
    'w': (184, 184, 184),   # light steel
    'g': (176, 176, 16),    # gold
    'G': (104, 96, 8),      # dark gold
    'p': (144, 104, 208),   # light purple (cape)
    'P': (80, 48, 112),     # dark purple
    'k': (208, 192, 144),   # pale (smear highlight)
    'K': (208, 128, 88),    # skin
    'b': (80, 40, 16),      # brown
}


class Canvas:
    """A small pixel grid (rows of RGB or None) for composing frames."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def paste(self, px, x0, y0):
        for y, row in enumerate(px):
            for x, p in enumerate(row):
                if p is not None and 0 <= x0 + x < self.w and 0 <= y0 + y < self.h:
                    self.px[y0 + y][x0 + x] = p

    def stamp(self, rows, x0, y0, leg=LEG):
        """Hand-drawn rows: '.' transparent, '_' erases, other letters from leg."""
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                X, Y = x0 + x, y0 + y
                if c == '.' or c == ' ' or not (0 <= X < self.w and 0 <= Y < self.h):
                    continue
                self.px[Y][X] = None if c == '_' else leg[c]

    def crop(self):
        ys = [y for y in range(self.h) if any(self.px[y])]
        xs = [x for x in range(self.w) if any(self.px[y][x] for y in range(self.h))]
        x0, y0 = min(xs), min(ys)
        return [row[x0:max(xs) + 1] for row in self.px[y0:max(ys) + 1]], x0, y0


class VSheet(Sheet):
    """Sheet with virtual frames: composed pixel grids with a fixed foot point."""

    def __init__(self, *a, shadow=None, shadow_rows=5, shadow_passes=2, **k):
        super().__init__(*a, **k)
        self.virt = {}
        self.shadow = shadow    # ground-shadow colour to strip from sheet frames (or None)
        self.shadow_rows, self.shadow_passes = shadow_rows, shadow_passes

    def strip_shadow(self, px):
        """Remove a ground shadow drawn in the outline colour: detached flat blobs at the
        bottom, then (twice) shadow pixels in the bottom rows that touch no other colour
        (the inside of a blob fused to the feet). Same method as rip_ayla.py."""
        S = self.shadow if isinstance(self.shadow, (set, frozenset)) else {self.shadow}
        h, w = len(px), len(px[0])
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
                    ys = [q[1] for q in pts]
                    if all(px[b][a] in S for a, b in pts) and max(ys) - min(ys) <= 4 and max(ys) >= h - 2:
                        for a, b in pts:
                            px[b][a] = None

        def other(x, y):
            return any(0 <= x + a < w and 0 <= y + b < h and px[y + b][x + a] and px[y + b][x + a] not in S
                       for a in (-1, 0, 1) for b in (-1, 0, 1))
        for _ in range(self.shadow_passes):
            gone = [(x, y) for y in range(max(0, h - self.shadow_rows), h) for x in range(w) if px[y][x] in S and not other(x, y)]
            for x, y in gone:
                px[y][x] = None
        while px and not any(px[-1]):
            px.pop()
        return px

    def gpt(self, fid, x, y, flip=False):
        """A point given in a sheet frame's box coords -> game sheet frame coords."""
        px, fx, fy = self.grab(fid, flip)
        if flip:
            x = len(px[0]) - 1 - x
        return [self.AX - fx + x, self.AY - fy + y]

    def raw(self, fid):
        """(px, fx, fy) of a sheet frame, unflipped."""
        return Sheet.grab(self, fid, False) if fid not in self.virt else self.grab(fid, False)

    def define(self, name, canvas, feet):
        px, x0, y0 = canvas.crop()
        self.virt[name] = (px, feet[0] - x0, feet[1] - y0)

    def grab(self, fid, flip):
        if fid in self.virt:
            px, fx, fy = self.virt[fid]
            px = [r[:] for r in px]
            if flip:
                px = [r[::-1] for r in px]
                fx = len(px[0]) - 1 - fx
            return px, fx, fy
        if not self.shadow:
            return Sheet.grab(self, fid, flip)
        x0, y0, x1, y1 = self.box(fid)
        px = [[self.im.getpixel((x, y)) for x in range(x0, x1 + 1)] for y in range(y0, y1 + 1)]
        px = self.strip_shadow([[None if p == self.bg else p for p in row] for row in px])
        if flip:
            px = [row[::-1] for row in px]
        body = [(x, y) for y in range(len(px)) for x in range(len(px[0])) if px[y][x] and px[y][x] not in self.weapon]
        fy = max(y for _, y in body)
        feet = [x for x, y in body if y >= fy - 3]
        return px, round((min(feet) + max(feet)) / 2), fy

    def compose(self, name, base, ops=(), canvas=(64, 64), at=(20, 24), flip=False):
        """New frame from a sheet frame: paste it at `at`, then apply ops:
        ('stamp', x, y, rows) | ('shift', y0, y1, dx, dy) rows y0..y1 of the body
        (frame coords) moved before pasting | ('erase', x, y, w, h) in canvas coords.
        Coordinates in stamps are canvas coords."""
        px, fx, fy = self.grab(base, flip)
        px = [r[:] for r in px]
        h, w = len(px), len(px[0])
        for op in ops:
            if op[0] == 'shift':
                _, y0, y1, dx, dy = op
                cut = [(x, y, px[y][x]) for y in range(y0, y1 + 1) for x in range(w) if px[y][x] is not None]
                for x, y, _p in cut:
                    px[y][x] = None
                for x, y, p in cut:
                    if 0 <= x + dx < w and 0 <= y + dy < h:
                        px[y + dy][x + dx] = p
        cv = Canvas(*canvas)
        cv.paste(px, at[0], at[1])
        for op in ops:
            if op[0] == 'stamp':
                cv.stamp(op[3], op[1], op[2])
            elif op[0] == 'erase':
                _, x0, y0, ww, hh = op
                for y in range(y0, y0 + hh):
                    for x in range(x0, x0 + ww):
                        cv.px[y][x] = None
        self.define(name, cv, (at[0] + fx, at[1] + fy))
        self.canv = getattr(self, 'canv', {})
        self.canv[name] = cv
        self.feetc = getattr(self, 'feetc', {})
        self.feetc[name] = (at[0] + fx, at[1] + fy)
        return cv

    def pt(self, name, p):
        """A canvas point of a composed frame -> game sheet frame coords (unflipped)."""
        fx, fy = self.feetc[name]
        return [self.AX + p[0] - fx, self.AY + p[1] - fy]

    def dissolve(self, base, steps, flip=False, prefix=None):
        """Ordered-dither fade: frame i keeps the pixels whose 4x4 Bayer rank is at least
        i/steps of the way up; survivors fade to lighter tones and drift up 0-3 px."""
        bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
        px, fx, fy = self.grab(base, flip)
        lighter = {(40, 40, 40): (80, 48, 112), (48, 40, 48): (80, 88, 104), (80, 48, 112): (144, 104, 208),
                   (80, 88, 104): (144, 104, 208), (104, 96, 8): (176, 176, 16), (80, 40, 16): (208, 128, 88)}
        names = []
        for i in range(1, steps + 1):
            cut = 16 * i / (steps + 1)
            h, w = len(px), len(px[0])
            out = [[None] * w for _ in range(h + 4)]
            for y in range(h):
                for x in range(w):
                    p = px[y][x]
                    if p is None or bayer[y % 4][x % 4] < cut:
                        continue
                    if i >= steps // 2:
                        p = lighter.get(p, p)
                    lift = (i * (h - y)) // (h * 2)   # the top drifts up first
                    out[y + 4 - min(3, lift)][x] = p
            name = f'{prefix or base}~dis{i}'
            self.virt[name] = (out, fx, fy + 4)
            names.append(name)
        return names

    def grid(self, names, path, S=10):
        """Canvases of composed frames at S x with a coordinate grid (lines every 10)."""
        from PIL import Image, ImageDraw
        cvs = [self.canv[n] for n in names]
        W = sum(c.w for c in cvs) * S + 8 * len(cvs)
        H = max(c.h for c in cvs) * S
        im = Image.new('RGB', (W, H), (0, 110, 0))
        d = ImageDraw.Draw(im)
        x0 = 0
        for c in cvs:
            for y in range(c.h):
                for x in range(c.w):
                    if c.px[y][x]:
                        d.rectangle([x0 + x * S, y * S, x0 + x * S + S - 1, y * S + S - 1], fill=c.px[y][x])
            for x in range(0, c.w + 1, 2):
                d.line([(x0 + x * S, 0), (x0 + x * S, H)], fill=(255, 255, 0) if x % 10 == 0 else (0, 80, 0))
            for y in range(0, c.h + 1, 2):
                d.line([(x0, y * S), (x0 + c.w * S, y * S)], fill=(255, 255, 0) if y % 10 == 0 else (0, 80, 0))
            x0 += c.w * S + 8
        im.save(path)

    def preview(self, names, path, scale=6):
        from PIL import Image
        tiles = [self.virt[n] for n in names]
        W = sum(len(t[0][0]) + 4 for t in tiles)
        H = max(len(t[0]) for t in tiles) + 4
        im = Image.new('RGB', (W, H), (0, 120, 0))
        x0 = 0
        for px, fx, fy in tiles:
            for y, row in enumerate(px):
                for x, p in enumerate(row):
                    if p:
                        im.putpixel((x0 + 2 + x, 2 + y), p)
            im.putpixel((x0 + 2 + fx, 2 + fy), (255, 0, 0))
            x0 += len(px[0]) + 4
        im.resize((W * scale, H * scale), Image.NEAREST).save(path)


# ---- Hand-drawn pieces (facing right) --------------------------------------------------
# Each piece is (rows, point(s)). Swords: the grip point (under the hand). Arms: the
# shoulder and the hand. Poses join them: arm shoulder on the body's shoulder, sword grip
# in the hand. The sword is stamped first and the arm (gauntlet) over its grip.


def fliph(rows):
    n = max(len(r) for r in rows)
    return [r.ljust(n, '.')[::-1] for r in rows]


def flipv(rows):
    return rows[::-1]


SWORD_H = ([           # level, pointing forward
    '...#..................',
    '..#g#.................',
    '#.#G##################',
    'd##g#wwwwwwwwwwwwwwwww#',
    'd##G#sssssssssssssss##.',
    '#.#g##################',
    '..#G#.................',
    '...#..................',
], (1, 3))
SWORD_UP = ([          # point up
    '..#...',
    '.#w#..',
    '.#ws#.',
] + ['.#ws#.'] * 12 + [
    '######',
    '#gGgG#',
    '.#dd#.',
    '..dd..',
], (2, 18))


def blade_ur(n):
    """A 45-degree blade pointing up-forward, n steps long above the guard (the same
    two-tone step every row), with its guard and grip at the bottom-left."""
    w = n + 7
    rows = ['.' * (w - 2) + '##', '.' * (w - 3) + '#w#']
    for x in range(w - 4, 2, -1):
        rows.append('.' * x + '#ws#')
    rows += ['..##ws#', '.#gGs#', '#gG##', '#dg#', '#d#', '.#']
    return [r.ljust(w, '.')[:w] for r in rows]


_UR = blade_ur(7)
_DR = blade_ur(4)
SWORD_UR = (_UR, (1, len(_UR) - 3))                           # 45 deg up-forward
SWORD_DR = ([r.replace('w', 'S').replace('s', 'w').replace('S', 's') for r in flipv(_DR)], (1, 2))  # down-forward
SWORD_UL = (fliph(_UR), (len(_UR[0]) - 2, len(_UR) - 3))      # up-back (wound up over the head)

ARM_FWD = ([           # level reach
    '..#####..',
    '.#sssss##',
    '#dddddgGd#',
    '.######dd#',
    '.......##.',
], (1, 2), (8, 2))
ARM_UP = ([            # straight up
    '.##.',
    '#dd#',
    '#gG#',
    '#sd#',
    '#sd#',
    '#sd#',
    '#sd#',
    '#sd#',
    '#sd#',
], (2, 8), (2, 1))
ARM_UF = ([            # up and forward
    '.....##.',
    '....#dd#',
    '...#gGd#',
    '..#sd##.',
    '.#sd#...',
    '#sd#....',
    '#d#.....',
], (1, 6), (6, 1))
ARM_UB = fliph(ARM_UF[0]), (6, 6), (1, 1)   # up and back (wind-up over the helmet)
ARM_DOWN = ([          # forward and down
    '#d#.....',
    '#sd#....',
    '.#sd#...',
    '..#sGg#.',
    '...#ddd#',
    '....###.',
], (1, 0), (5, 4))
ARM_BACK = ([          # elbow bent, hand at the hip behind
    '..#d#',
    '.#ds#',
    '.#ds#',
    '#Gg#.',
    '#dd#.',
    '.##..',
], (3, 0), (1, 4))
ARM_CHEST = ([         # forearm up before the chest
    '#d##..',
    '#sdd#.',
    '.#gGd#',
    '..###.',
], (1, 0), (4, 2))

# Motion trails (pale): the overhead cut sweeping from behind the helmet to the front.
TRAIL_CUT = [
    '..........kkkkk...........',
    '.......kkkwwwwwkkk........',
    '.....kkwww.....wwwkk......',
    '....kww...........wwkk....',
    '...kww..............wwk...',
    '..kw..................wk..',
    '..kw...................wk.',
    '.kw.....................wk',
    '.kw.......................',
    'kw........................',
    'kw........................',
    'k.........................',
]
GLINT = ['.k.', 'kwk', '.k.']

SHOULDER = (31, 38)    # canvas coords of the near shoulder (stand/step frames at (20, 24))


def pose(s, name, base, arm=None, sword=None, extra=(), shoulder=SHOULDER, body=()):
    ops = list(body)
    if arm:
        rows, (sx, sy), (hx, hy) = arm
        ax, ay = shoulder[0] - sx, shoulder[1] - sy
        hand = (ax + hx, ay + hy)
        if sword:
            srows, (gx, gy) = sword
            ops.append(('stamp', hand[0] - gx, hand[1] - gy, srows))
        ops.append(('stamp', ax, ay, rows))
    ops += list(extra)
    return s.compose(name, base, ops)


def build(preview=None):
    s = VSheet('cyrus', w=76, h=64, ax=28, ay=60,
               credit='"Prototype Cyrus" ripped by the Chrono Compendium')
    ST, STEP, STEP2 = 15, 16, 18
    LEAN_F = [('shift', 0, 14, 1, 0)]          # head and shoulders lean 1 px forward
    LEAN_B = [('shift', 0, 14, -1, 0)]
    CROUCH = [('shift', 0, 22, 0, 2)]          # upper body sinks 2 px (squash)
    RECOIL = [('shift', 0, 14, -1, 0), ('shift', 0, 9, -1, 0)]   # head snaps back
    BREATH = [('shift', 0, 13, 0, 1)]          # shoulders and helmet settle 1 px
    pose(s, 'ready', ST, ARM_DOWN, SWORD_UR)
    pose(s, 'windup', ST, ARM_UB, SWORD_UL, body=LEAN_B, shoulder=(30, 38))
    pose(s, 'raise', ST, ARM_UP, SWORD_UP, shoulder=(33, 38))
    pose(s, 'raise2', ST, ARM_UP, SWORD_UP, shoulder=(33, 38), extra=[('stamp', 32, 12, GLINT)])
    pose(s, 'swing', STEP, ARM_UF, SWORD_UR, body=LEAN_F, shoulder=(32, 38),
         extra=[('stamp', 22, 10, TRAIL_CUT)])
    pose(s, 'cut', STEP, ARM_DOWN, SWORD_DR, body=LEAN_F, shoulder=(32, 38))
    pose(s, 'draw', ST, ARM_BACK, SWORD_H, body=CROUCH, shoulder=(30, 40))
    pose(s, 'thrust', STEP, ARM_FWD, SWORD_H, body=LEAN_F, shoulder=(32, 38))
    pose(s, 'point', ST, ARM_FWD, SWORD_H)
    pose(s, 'salute', ST, ARM_CHEST, SWORD_UP)
    pose(s, 'salute2', ST, ARM_CHEST, SWORD_UP, extra=[('stamp', 33, 21, GLINT)])
    pose(s, 'crouch', ST, body=CROUCH)
    pose(s, 'recoil', ST, body=RECOIL)
    s.compose('breath', 0, BREATH)
    s.compose('breath_b', 5, BREATH)
    dis_f = s.dissolve(0, 6)
    dis_b = s.dissolve(5, 6)
    names = ['ready', 'windup', 'raise', 'swing', 'cut', 'draw', 'thrust', 'point', 'salute']
    if preview:
        s.grid(names[:5], os.path.join(preview, 'cyrus_grid1.png'), S=8)
        s.grid(names[5:], os.path.join(preview, 'cyrus_grid2.png'), S=8)
        s.preview(dis_f + dis_b, os.path.join(preview, 'cyrus_dis.png'))

    F = False
    tip_salute, tip_raise = s.pt('salute', (34, 22)), s.pt('raise', (33, 13))
    # Front view (se): standing, walking and story poses; battle moves in profile.
    s.add('se', 'idle', [(0, 520), ('breath', 300), (0, 420), ('breath', 300)], loop=True)
    s.add('se', 'walk', [(1, 120), (2, 120), (3, 120), (4, 120)], loop=True)
    s.add('se', 'kneel', [(21, 1000)], loop=True)
    s.add('se', 'ko', [(21, 180), (22, 1000)])
    s.add('se', 'dissolve', [(0, 200)] + [(n, 140) for n in dis_f])
    s.add('ne', 'idle', [(5, 520), ('breath_b', 300), (5, 420), ('breath_b', 300)], loop=True)
    s.add('ne', 'walk', [(6, 120), (7, 120), (8, 120), (9, 120)], loop=True)
    s.add('ne', 'kneel', [(20, 1000)], loop=True)
    s.add('ne', 'ko', [(20, 180), (22, 1000)])
    s.add('ne', 'dissolve', [(5, 200)] + [(n, 140) for n in dis_b])
    battle = {
        # basic attack: ready, wind up over the helmet, sweep, cut lands low, recover
        'attack': ([(ST, 110), ('ready', 120), ('windup', 160), ('swing', 60, F, 3), ('cut', 170, F, 6),
                    ('cut', 110, F, 5), ('ready', 120, F, 2), (ST, 140)], {'hit': 4}),
        # Ledger Strike: sink and draw the blade back, then a long lunging thrust
        'tech_ledger_strike': ([('draw', 240), ('draw', 60, F, 4), ('thrust', 70, F, 12), ('thrust', 220, F, 18),
                                ('thrust', 120, F, 16), ('ready', 130, F, 8), (STEP2, 110, F, 3), (ST, 150)],
                               {'hit': 3}),
        # Sever: blade raised overhead (rising onto the toes), one hard cut down
        'tech_sever': ([('ready', 110), ('raise', 200, F, 0, -1), ('windup', 120, F, 1, -1), ('swing', 50, F, 6),
                        ('cut', 190, F, 9), ('cut', 140, F, 8), ('ready', 140, F, 3), (ST, 150)], {'hit': 4}),
        'cast': ([('salute', 180), ('salute2', 180), ('raise2', 240, F, 0, -1), ('raise', 160), (ST, 170)],
                 {'charge': [0, 1], 'release': 2, 'rim': '#e0d0ff',
                  'glow': [tip_salute, tip_salute, tip_raise, tip_raise]}),
        'hurt': ([('recoil', 160, F, -3), (ST, 220, F, -1)], {}),
        'victory': ([('raise', 600), ('raise2', 140), ('raise', 300), ('raise2', 140)], {'loop': True}),
        'jump': ([('crouch', 120), (STEP, 80, F, 0, -5), (STEP2, 220, F, 0, -12), ('crouch', 140)], {}),
        'point': ([(ST, 140), ('ready', 90), ('point', 700)], {}),
    }
    for name, (frames, extra) in battle.items():
        s.add('se', name, frames, **extra)
        s.add('ne', name, frames, **extra)
    s.build(head=[28, 34])
    return s


if __name__ == '__main__':
    pv = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    s = build(pv)
