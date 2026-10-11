"""Build public/js/sheets/cyrus_human.js (Sir Cyrus without his armour: the broken /
redeemed Warden) from the Chrono Trigger "Prototype Cyrus" sheet ripped by the Chrono
Compendium, supplied by the user.

    python3 tools/crono_lab/rip_cyrus_human.py

rip/cyrus_human_sheet.png holds the three unarmoured frames from assets/cyrus.png (the
fourth figure on that row is someone else and is left out): 0 and 1 standing with the head
hung (hair tufts differ), 2 the head bowed lower. Only these exist, so the rest is built
here from them (rip_cyrus.VSheet): breathing and step frames shift the shoulders or lift one
leg, the kneel drops the body over the feet, the ko frame lies him down (frame 2 turned on
its side), and the dissolve dithers him away. No new pixels are drawn.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_cyrus import VSheet, Canvas


def lift(s, name, base, x0, x1, y0, y1, dy, extra=()):
    """Copy of `base` with the box x0..x1, y0..y1 (frame coords) raised by dy, plus
    other ('shift', ...) ops; the feet stay where the base's feet were."""
    px, fx, fy = s.grab(base, False)
    px = [r[:] for r in px]
    h = len(px)
    cut = [(x, y, px[y][x]) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if px[y][x] is not None]
    for x, y, _ in cut:
        px[y][x] = None
    for x, y, p in cut:
        if 0 <= y - dy < h:
            px[y - dy][x] = p
    s.virt[name] = (px, fx, fy)
    if extra:
        s.compose(name, name, list(extra))


def build():
    s = VSheet('cyrus_human', w=48, h=48, ax=24, ay=44,
               credit='"Prototype Cyrus" ripped by the Chrono Compendium')
    # Frame 0/1/2 coords: legs are columns 3-9 (his right) and 11-17 (his left), rows ~24-35;
    # the hanging arms are columns 0-4 and 15-20, rows 14-23.
    s.compose('breath', 0, [('shift', 0, 13, 0, 1)])
    s.compose('breath1', 1, [('shift', 0, 13, 0, 1)])
    # Steps: one foot lifted 2 px, the body up 1, the other arm swung a pixel down; the
    # walk sways 1 px side to side (dx) as the weight shifts.
    lift(s, 'stepL', 0, 0, 9, 24, 35, 2)
    lift(s, 'stepR', 1, 11, 20, 24, 35, 2)
    lift(s, 'stepL', 'stepL', 0, 20, 0, 23, 1)        # the body rides up 1 over the planted leg
    lift(s, 'stepR', 'stepR', 0, 20, 0, 23, 1)
    lift(s, 'stepL_a', 'stepL', 15, 20, 14, 23, -1)   # far arm swings back (down 1)
    lift(s, 'stepR_a', 'stepR', 0, 4, 14, 23, -1)
    # Hurt: the head and shoulders snap back.
    s.compose('recoil', 2, [('shift', 0, 13, -1, 0), ('shift', 0, 8, -1, 0)])
    # Kneel: the body sinks 5 px over the feet (the thighs fold away), head bowed (frame 2).
    s.compose('kneel', 2, [('shift', 0, 26, 0, 5)])
    s.compose('kneel2', 2, [('shift', 0, 26, 0, 5), ('shift', 0, 8, 0, 1)])
    # KO: frame 2 laid on its side, head to the left.
    px, fx, fy = s.grab(2, False)
    h, w = len(px), len(px[0])
    rot = [[px[x][w - 1 - y] for x in range(h)] for y in range(w)]   # 90 deg anticlockwise
    cv = Canvas(h + 2, w + 2)
    cv.paste(rot, 1, 1)
    s.define('lying', cv, (1 + h // 2, w))  # bottom row of the turned frame
    dis = s.dissolve(2, 6)

    F = False
    for view in ('se', 'ne'):
        s.add(view, 'idle', [(0, 520), ('breath', 320), (1, 480), ('breath1', 320)], loop=True)
        s.add(view, 'walk', [(0, 120), ('stepL_a', 130), (0, 110, F, 1),
                             (1, 120, F, 1), ('stepR_a', 130, F, 1), (1, 110)], loop=True)
        s.add(view, 'hurt', [('recoil', 200, F, -2), (2, 220, F, -1)])
        s.add(view, 'kneel', [('kneel', 900), ('kneel2', 700)], loop=True)
        s.add(view, 'ko', [('kneel', 200), ('lying', 1000)])
    s.add('se', 'talk', [(0, 260), (1, 200), ('breath', 160), (1, 220)], loop=True)
    s.add('se', 'dissolve', [(2, 200)] + [(n, 150) for n in dis])
    s.build(head=[24, 18])
    return s


if __name__ == '__main__':
    build()
