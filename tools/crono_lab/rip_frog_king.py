"""Build public/js/sheets/frog_king.js from the Chrono Trigger Frog King sprite sheet (ripped
by Nemu, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_frog_king.py prep    # assets/frog_king.png -> rip/frog_king_sheet.png, then segment
    python3 tools/crono_lab/rip_frog_king.py         # build the sheet

Spekkio in his Frog King form (End of Time NPC and optional battle). The sheet only has
front sprites, so both views use them. Frame ids index rip/frog_king_frames.json:
  0-2 squatting, eyes rolling        3 squatting, mouth open        4 the crown, knocked off
  5 crownless and dazed (with 4 = 'crown_off')                      6 smug, eyes half shut
  7 sitting up                       8 sitting up, mouth open       9 crouched to hop
  10 airborne, legs trailing         12, 13 airborne, highest, looking up
  16 mouth open with sparkles (magic)   (11, 14, 15 are the hop shadows, unused)
prep paints over the credits text and erases the drawn shadows under 7-9 (the game draws
its own); airborne frames are lifted with negative dy.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet, RIP, segment

KEY = 'frog_king'
BG = (153, 217, 234)


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
    from PIL import Image, ImageDraw
    im = Image.open(os.path.join(RIP, 'assets', 'frog_king.png')).convert('RGB')
    ImageDraw.Draw(im).rectangle([80, 160, 161, 236], fill=BG)  # the credits text
    im.save(os.path.join(RIP, KEY + '_sheet.png'))
    fr = segment(KEY)
    for i in (7, 8, 9):
        deshadow(im, fr[i], BG, rows=6)
    im.save(os.path.join(RIP, KEY + '_sheet.png'))
    segment(KEY)


if len(sys.argv) > 1 and sys.argv[1] == 'prep':
    prep()
    sys.exit()

W, H, AX, AY = 48, 56, 24, 52
# The crown flying off his head (frame 4) above the dazed frog (5), as one frame.
s = Sheet(KEY, w=W, h=H, ax=AX, ay=AY, credit='ripped by Nemu', extra={'crown_off': [1, 43, 31, 90]})
F = False
GOLD = '#fff0a0'

hop = [(7, 110), (9, 80), (10, 110, F, 0, -5), (10, 80, F, 0, -3), (9, 80)]
for v in ('se', 'ne'):
    s.add(v, 'idle', [(0, 700), (1, 180), (2, 260), (1, 180)], loop=True)
    # Walk: he hops - sit up, crouch, airborne, crouch.
    s.add(v, 'walk', hop, loop=True)
    s.add(v, 'talk', [(0, 180), (3, 200), (0, 140), (3, 240)], loop=True)
    s.add(v, 'jump', [(7, 120), (9, 140), (10, 110, F, 0, -9), (12, 160, F, 0, -16), (13, 140, F, 0, -13),
                      (10, 100, F, 0, -6), (9, 130), (7, 140)])
    # Attack: a belly-flop - crouch, leap up and over, and come down on the target.
    s.add(v, 'attack', [(7, 140), (9, 130), (10, 100, F, 3, -9), (12, 130, F, 6, -14), (9, 180, F, 8),
                        (7, 150, F, 3), (0, 140)], hit=4)
    # Cast: eyes roll up, sparkles gather (charge loop), a great croak (release).
    s.add(v, 'cast', [(2, 200), (16, 160), (1, 140), (16, 260, F, 0, -1), (0, 200)],
          charge=[1, 2], release=3, rim=GOLD, glow=[[AX, AY - 38]] * 5)
    s.add(v, 'hurt', [('crown_off', 240, F, -2), (0, 160, F, -1)])
    s.add(v, 'ko', [('crown_off', 220, F, -2), (5, 1000, F, -2)])
    # Victory: a smug grin, a croak of laughter and a little hop.
    s.add(v, 'victory', [(6, 520), (3, 200), (6, 300), (9, 90), (10, 150, F, 0, -6), (9, 90), (8, 260), (7, 160)],
          loop=True)

s.build(head=[AX, AY - 22])
