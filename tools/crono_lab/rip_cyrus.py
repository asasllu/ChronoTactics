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

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.virt = {}

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
        return Sheet.grab(self, fid, flip)

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
        return cv

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
# Canvas coords: the right-facing side stand (frame 15, 15x32) is pasted at (20, 24), so
# its face is at x 30-31, y 32-35, its shoulder about (29, 37), its feet on y 55.

SWORD_H = [            # level, pointing right; grip at cols 0-1 (under the hand)
    '....#.................',
    '...#g#................',
    '##.#G#################',
    'dd##g#wwwwwwwwwwwwwwww#',
    'dd##G#ssssssssssssss##.',
    '##.#g#################',
    '...#G#................',
    '....#.................',
]
SWORD_UP = [           # vertical, point up; grip at the bottom
    '..#...',
    '.#w#..',
    '.#ws#.',
] + ['.#ws#.'] * 13 + [
    '######',
    '#gGgG#',
    '##dd##',
    '.#dd#.',
    '..##..',
]
SWORD_UR = [           # 45 degrees up-forward; grip at the bottom-left
    '.............##',
    '............#w#',
    '...........#ws#',
    '..........#ws#.',
    '.........#ws#..',
    '........#ws#...',
    '.......#ws#....',
    '......#ws#.....',
    '.....#ws#......',
    '....#ws#.......',
    '..##ws#........',
    '.#gGs#.........',
    '#gG##..........',
    '#dg#...........',
    '#d#............',
    '.#.............',
]


def flipv(rows):
    return rows[::-1]


def fliph(rows):
    n = max(len(r) for r in rows)
    return [r.ljust(n, '.')[::-1] for r in rows]


SWORD_DR = [r.replace('w', 'S').replace('s', 'w').replace('S', 's') for r in flipv(SWORD_UR)]  # down-forward
SWORD_UL = fliph(SWORD_UR)       # raised back over the head

SMEAR_CUT = [          # overhead cut: arc from above the head round to the front, low
    '......kkww.......',
    '.........wkk.....',
    '...........wkk...',
    '.............wk..',
    '..............wk.',
    '...............wk',
    '...............wk',
    '...............wk',
    '..............wk.',
    '.............wk..',
    '............wk...',
]


def build(preview=None):
    s = VSheet('cyrus', w=80, h=72, ax=34, ay=68,
               credit='"Prototype Cyrus" ripped by the Chrono Compendium')
    ST, STEP, STEP2 = 15, 16, 18
    # Arms (armoured: outline, dark plate, steel highlight, gold cuff) and gauntlets.
    ARM_FWD = [            # level, from the shoulder to the hand (hand at x 36..38, y 36..38)
        '..######',
        '.#sssdd##',
        '#ddddgG#d#',
        '.####gGdd#',
        '.....####.',
    ]
    ARM_UP = [             # raised straight up (hand above the helmet)
        '.###.',
        '#dgd#',
        '#ddd#',
        '#sdG#',
        '#sd#.',
        '#sd#.',
        '#sd#.',
        '#sd#.',
        '.##..',
    ]
    ARM_DOWN = [           # reaching forward and down
        '###....',
        '#ssd#..',
        '.#sdd#.',
        '..#dgG#',
        '...#ddd#',
        '....####',
    ]
    ARM_BACK = [           # elbow bent, hand at the hip behind
        '..###.',
        '.#dsd#',
        '#ddsd#',
        '#Ggd#.',
        '#dd#..',
        '.##...',
    ]
    poses = {
        # ready: sword angled up-forward from the waist
        'ready': (ST, [('stamp', 31, 22, SWORD_UR), ('stamp', 28, 38, ARM_DOWN)]),
        # wind-up for a cut: arm raised, sword back over the helmet
        'windup': (ST, [('stamp', 17, 8, SWORD_UL), ('stamp', 28, 22, ARM_UP)]),
        # swing: arm forward-up, blade a smear arc
        'smear': (STEP, [('stamp', 22, 14, SMEAR_CUT), ('stamp', 28, 22, ARM_UP)]),
        # cut lands: arm forward and down, blade pointing down-forward
        'cut': (STEP, [('stamp', 33, 41, SWORD_DR), ('stamp', 29, 37, ARM_DOWN)]),
        # thrust drawn back: sword level at the waist, hand behind
        'draw': (ST, [('stamp', 24, 39, SWORD_H), ('stamp', 23, 37, ARM_BACK)]),
        # thrust: arm and sword level, full reach
        'thrust': (STEP, [('stamp', 37, 34, SWORD_H), ('stamp', 29, 35, ARM_FWD)]),
        # point: the same reach without the lunge (stand frame)
        'point': (ST, [('stamp', 37, 34, SWORD_H), ('stamp', 29, 35, ARM_FWD)]),
        # sword raised straight up (cast release, victory)
        'raise': (ST, [('stamp', 29, 0, SWORD_UP), ('stamp', 29, 20, ARM_UP)]),
        # salute: sword upright before the visor (cast charge)
        'salute': (ST, [('stamp', 32, 18, SWORD_UP), ('stamp', 29, 37, ARM_DOWN)]),
    }
    for name, (base, ops) in poses.items():
        s.compose(name, base, ops)
    if preview:
        s.preview(list(poses), os.path.join(preview, 'cyrus_poses.png'))
    return s


if __name__ == '__main__':
    pv = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    s = build(pv)
