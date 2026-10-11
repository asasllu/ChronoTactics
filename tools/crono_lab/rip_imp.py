"""Build public/js/sheets/imp.js (Blue Imp) from the Chrono Trigger imp sheet supplied by
the user (tools/crono_lab/rip/assets/blue_imp_green_imp_mud_imp_stone_imp.png, The
Spriters Resource). The same sheet holds the Mud, Stone and Green Imps as palette swaps in
the same layout, so rip_mud_imp.py, rip_stone_imp.py and rip_green_imp.py reuse this file.

    python3 tools/crono_lab/rip_imp.py crop      # re-cut rip/<imp key>_sheet.png from the asset
    python3 tools/crono_lab/rip_lib.py segment imp
    python3 tools/crono_lab/rip_imp.py

Frame ids (identical for all four imps; see rip/imp_labels*.png):
  0 front stand, 1-2 front steps          6 back stand, 7-8 back steps
  3-5, 9-14 profile (faces left) stand/steps
  15 head bowed, 16 head bowed + tongue (taunt), 17 knocked back (airborne, mouth open),
  18 dazed (wide eyes, sparkles)
  19-20 front jump kick (swoosh), 21 front airborne; 24-25 profile jump kick, 26 profile airborne;
  29-30 back jump kick, 31 back airborne; 32-33 profile spin kick, 34 profile airborne
  22, 23, 27, 28, 35, 36 are ground shadows (unused)
The sheet has no lying-down pose, so 'ko' ends on frame 17 turned 90 degrees (lossless).
"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from rip_lib import Sheet, RIP  # noqa: E402

ASSET = os.path.join(RIP, 'assets', 'blue_imp_green_imp_mud_imp_stone_imp.png')
# Top-left corner of each labelled quadrant (inside the black frame, below the title bar).
QUAD = {'imp': (1, 16), 'mud_imp': (192, 16), 'stone_imp': (1, 356), 'green_imp': (192, 356)}
# Each imp's lightest trouser colour, which the kick swoosh shares (white is the other).
SWOOSH = {'imp': (240, 168, 248), 'mud_imp': (136, 168, 128), 'stone_imp': (224, 128, 136),
          'green_imp': (120, 144, 120)}
CREDIT = '(blue/mud/stone/green imps, ripper not credited on the sheet)'


def crop(key):
    """Cut one quadrant, flatten it onto magenta and blank the 'Colors' label, the palette
    swatch and the reference sprite beside it."""
    src = Image.open(ASSET).convert('RGBA')
    x, y = QUAD[key]
    q = src.crop((x, y, x + 190, y + 324))
    flat = Image.new('RGBA', q.size, (255, 0, 255, 255))
    flat.alpha_composite(q)
    out = flat.convert('RGB')
    px = out.load()
    for yy in range(0, 42):
        for xx in range(105, 190):
            px[xx, yy] = (255, 0, 255)
    out.save(os.path.join(RIP, key + '_sheet.png'))
    print('wrote', key + '_sheet.png')


class DerivedSheet(Sheet):
    """Sheet with derived frames: DERIVED[name] = (frame id, degrees CCW, keep fraction).
    90/180/270 turns are lossless; other angles use nearest neighbour. keep < 1 drops
    pixels in an ordered-dither pattern (crumbling to dust)."""

    def __init__(self, *a, derived=None, **k):
        super().__init__(*a, **k)
        self.derived = derived or {}

    def grab(self, fid, flip):
        if not (isinstance(fid, str) and fid in self.derived):
            return super().grab(fid, flip)
        base, deg, keep = self.derived[fid]
        x0, y0, x1, y1 = self.box(base)
        img = self.im.crop((x0, y0, x1 + 1, y1 + 1))
        if deg % 360:
            img = img.rotate(deg, Image.NEAREST, expand=True, fillcolor=self.bg)
        w, h = img.size
        px = [[img.getpixel((x, y)) for x in range(w)] for y in range(h)]
        px = [[None if p == self.bg else p for p in row] for row in px]
        if flip:
            px = [row[::-1] for row in px]
        body = [(x, y) for y in range(h) for x in range(w) if px[y][x] and px[y][x] not in self.weapon]
        fy = max(y for _, y in body)
        feet = [x for x, y in body if y >= fy - 3]
        fx = round((min(feet) + max(feet)) / 2)
        if keep < 1:  # thin after anchoring, so the crumbling frames stay in place
            bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
            px = [[p if bayer[y % 4][x % 4] < keep * 16 else None for x, p in enumerate(row)] for y, row in enumerate(px)]
        return px, fx, fy


A, F = True, False  # profile frames face left on the sheet: mirror them to face right


def imp_sheet(key, extra_derived=None):
    derived = {'lie': (17, 90, 1)}  # knocked flat on its back, head to the left (thrown backwards)
    derived.update(extra_derived or {})
    return DerivedSheet(key, w=56, h=48, ax=28, ay=44, weapon={(248, 248, 248), SWOOSH[key]},
                        derived=derived, credit=CREDIT)


def base_anims(s):
    # ---- se: front view for standing and walking, mirrored profile for the kick ----
    s.add('se', 'idle', [(0, 420), (1, 220), (0, 420), (2, 220)], loop=True)
    s.add('se', 'walk', [(1, 110), (0, 110), (2, 110), (0, 110)], loop=True)
    # The CT imp attack: a hop and a flying kick (the swoosh frame lands the blow).
    s.add('se', 'attack', [(3, 140, A), (26, 90, A, 2, -3), (24, 160, A, 7, -6), (25, 90, A, 6, -5),
                           (26, 90, A, 3, -2), (3, 150, A)], hit=2)
    s.add('se', 'hurt', [(17, 170, F, -2, -3), (18, 230, F, -1, 0)])
    s.add('se', 'ko', [(17, 150, F, -2, -4), (18, 200, F, -2, 0), ('lie', 1000, F, -4, 0)])
    # ---- ne: back view; the kick has its own back frames ----
    s.add('ne', 'idle', [(6, 420), (7, 220), (6, 420), (8, 220)], loop=True)
    s.add('ne', 'walk', [(7, 110), (6, 110), (8, 110), (6, 110)], loop=True)
    s.add('ne', 'attack', [(6, 140), (31, 90, F, 2, -3), (29, 160, F, 7, -6), (30, 90, F, 6, -5),
                           (31, 90, F, 3, -2), (6, 150)], hit=2)
    s.add('ne', 'hurt', [(31, 170, F, -2, -3), (6, 230, F, -1, 0)])
    s.add('ne', 'ko', [(17, 150, F, -2, -4), (18, 200, F, -2, 0), ('lie', 1000, F, -4, 0)])


def main(key):
    if len(sys.argv) > 1 and sys.argv[1] == 'crop':
        crop(key)
        return
    s = imp_sheet(key)
    base_anims(s)
    s.build(head=[28, 30])


if __name__ == '__main__':
    main('imp')
