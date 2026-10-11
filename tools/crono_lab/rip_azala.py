"""Build public/js/sheets/azala.js from the Chrono Trigger Azala sprite sheet (ripped by Nemu,
The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_azala.py prep    # assets/azala.png -> rip/azala_sheet.png, then segment
    python3 tools/crono_lab/rip_azala.py         # build the sheet

Azala, the Reptite leader (Echo Azala in Chapter 2). Frame ids index rip/azala_frames.json:
  0-2 front walk (1 = standing)       3-5 doubled over, cape thrown up (collapse)
  6-8 back walk (7 = standing)        9-11 profile walk facing left
  12-14 profile walk facing right     15, 17 cape flared, arms raised (psychic gesture)
  16 profile lunge, jaws open (faces left)   18 front, eyes narrowed   19 front, jaws open
prep crops off the credits text and clears three stray pixels of the rip.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet, RIP, segment

KEY = 'azala'
BG = (153, 217, 234)


def prep():
    from PIL import Image
    im = Image.open(os.path.join(RIP, 'assets', 'azala.png')).convert('RGB').crop((0, 0, 220, 154))
    for p in ((23, 46), (23, 47), (135, 35)):  # stray dark-blue pixels next to frames 6 and 3
        im.putpixel(p, BG)
    im.save(os.path.join(RIP, KEY + '_sheet.png'))
    segment(KEY)


if len(sys.argv) > 1 and sys.argv[1] == 'prep':
    prep()
    sys.exit()

W, H, AX, AY = 52, 48, 26, 44
s = Sheet(KEY, w=W, h=H, ax=AX, ay=AY, credit='ripped by Nemu')
F, S = False, True  # as drawn / mirrored (left-facing profile frames face right when flipped)
PSY = '#e8b8ff'      # psychic rim light

# ---- front (se) --------------------------------------------------------------------------
s.add('se', 'idle', [(1, 800), (18, 180), (1, 600), (19, 160), (1, 300), (18, 180)], loop=True)
s.add('se', 'walk', [(1, 110), (0, 110), (1, 110), (2, 110)], loop=True)

# ---- battle moves (both views): the right-facing profile frames 12-14 as drawn ------------
# Attack: steps in, then lunges jaws-first (16, mirrored), and steps back.
attack = [(12, 150), (13, 90, F, 1), (16, 200, S, 5), (14, 120, F, 2), (12, 140)]
# Cast: eyes narrow, the cape flares as she raises her arms (charge loop 15/17), the wave
# goes out on the full flare, then she lowers her arms.
cast = [(18, 180), (15, 160), (17, 160), (15, 260, F, 0, -1), (1, 200)]
cast_x = dict(charge=[1, 2], release=3, rim=PSY, glow=[[AX, AY - 30]] * 5)
hurt = [(4, 220, F, -2), (1, 160, F, -1)]
ko = [(3, 200), (4, 200), (5, 1000)]

for v in ('se', 'ne'):
    s.add(v, 'attack', attack, hit=2)
    s.add(v, 'cast', cast, **cast_x)
    s.add(v, 'hurt', hurt)
    s.add(v, 'ko', ko)

# ---- back (ne) ---------------------------------------------------------------------------
s.add('ne', 'idle', [(7, 900), (7, 900)], loop=True)
s.add('ne', 'walk', [(7, 110), (6, 110), (7, 110), (8, 110)], loop=True)

s.build(head=[AX, AY - 24])
