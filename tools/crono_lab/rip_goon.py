"""Build public/js/sheets/goon.js from the Chrono Trigger Goon sprite sheet (ripped and
arranged by Dazz and Tonberry2k, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_goon.py prep    # assets/goon.png -> rip/goon_sheet.png, then segment
    python3 tools/crono_lab/rip_goon.py         # build the sheet

The Gallery Goon: a golden statue sentinel (it replaces the old vitrine sentinel). The sheet
only has front sprites, so both views use them. Frame ids index rip/goon_frames.json:
  0-2 standing (breathing)          3 wings raised, airborne         4 wings flung wide
  5 wings swept down (the lunge)    6, 8 head turned, roaring         7 head bowed, claws up
  9 knocked back (shocked, feet off the ground)
prep crops off the credits box and erases the drawn ground shadows (the game draws its own).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet, RIP, segment

KEY = 'goon'
BG = (255, 0, 255)


def deshadow(im, box, bg, fill=(40, 40, 16), edge=(56, 56, 40), rows=8):
    """Erase a drawn ground shadow: flood the shadow colour from the bottom row of the box
    (within the bottom `rows` rows), then drop shadow-rim pixels left dangling beside it."""
    x0, y0, x1, y1 = box[:4]
    top = y1 - rows + 1
    px = im.load()
    st = [(x, y1) for x in range(x0, x1 + 1) if px[x, y1] == fill]
    gone = set()
    while st:
        x, y = st.pop()
        if (x, y) in gone:
            continue
        gone.add((x, y))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                X, Y = x + dx, y + dy
                if x0 <= X <= x1 and top <= Y <= y1 and px[X, Y] == fill and (X, Y) not in gone:
                    st.append((X, Y))
    for p in gone:
        px[p] = bg
    for _ in range(2):
        drop = []
        for y in range(top, y1 + 1):
            for x in range(x0, x1 + 1):
                if px[x, y] != edge:
                    continue
                n4 = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
                n8 = n4 + [(x + 1, y + 1), (x - 1, y + 1), (x + 1, y - 1), (x - 1, y - 1)]
                if not any(q in gone for q in n8):
                    continue
                if sum(1 for q in n4 if x0 <= q[0] <= x1 and y0 <= q[1] <= y1 and px[q] != bg) <= 1:
                    drop.append((x, y))
        for p in drop:
            px[p] = bg
            gone.add(p)


def prep():
    import json
    from PIL import Image
    im = Image.open(os.path.join(RIP, 'assets', 'goon.png')).convert('RGB').crop((0, 0, 264, 226))
    im.save(os.path.join(RIP, KEY + '_sheet.png'))
    fr = segment(KEY)
    for i in (0, 1, 2, 6, 7, 8):  # the standing frames have a shadow under the claws
        deshadow(im, fr[i], BG)
    im.save(os.path.join(RIP, KEY + '_sheet.png'))
    segment(KEY)


if len(sys.argv) > 1 and sys.argv[1] == 'prep':
    prep()
    sys.exit()

W, H, AX, AY = 88, 84, 44, 78
s = Sheet(KEY, w=W, h=H, ax=AX, ay=AY, credit='ripped and arranged by Dazz and Tonberry2k')
# The wing frames (3-5) have no claws showing; their lowest row is the loincloth, ~9 px above
# the claws of the standing frames, so they are lifted by LIFT to stand at the same height.
LIFT = -9

for v in ('se', 'ne'):
    # Idle: a slow breath, the wings settling (0 -> 1 -> 2).
    s.add(v, 'idle', [(0, 320), (1, 280), (2, 320), (1, 280)], loop=True)
    # Walk: a heavy stomp, the body dipping on each step.
    s.add(v, 'walk', [(0, 130), (1, 110, False, 0, -1), (2, 130), (1, 110, False, 0, -1)], loop=True)
    # Attack: head down, wings up and off the ground, flung wide, then a swooping lunge with the
    # wings swept forward (the blow), a roar, and back to its post.
    s.add(v, 'attack', [(7, 170), (3, 110, False, -1, LIFT - 4), (4, 90, False, 3, LIFT - 7),
                        (5, 180, False, 8, LIFT - 1), (6, 150, False, 4), (0, 160)], hit=3)
    # Hurt: knocked back off its feet, then settles.
    s.add(v, 'hurt', [(9, 200, False, -2, -2), (0, 180, False, -1)])
    # KO: knocked back, a last roar, then it bows its head and goes still (the shatter is an effect).
    s.add(v, 'ko', [(9, 180, False, -2, -2), (8, 220), (7, 1000)])

s.build(head=[AX, AY - 40])
