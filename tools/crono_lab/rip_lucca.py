"""Build public/js/sheets/lucca.js from the Chrono Trigger Lucca sprite sheet (captured by
Tonberry2k, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_lucca.py

Lucca is a story NPC here: idle/walk in both views and a lively talk loop (gesturing, then
reaching up to fix her goggles), plus hurt, kneel and victory. Frame ids index
rip/lucca_frames.json.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet

W, H, AX, AY = 64, 64, 32, 58
s = Sheet('lucca', w=W, h=H, ax=AX, ay=AY, credit='captured by Tonberry2k')
F, S = False, True  # front/back frames as drawn; side frames that face left get flipped

# ---- front (se) --------------------------------------------------------------------------
s.add('se', 'idle', [(1, 900), (64, 140), (1, 700), (65, 400)], loop=True)
s.add('se', 'walk', [(i, 110) for i in (2, 3, 4, 5, 6, 7)], loop=True)
# Talk: explaining with her hands, a nod, then both hands up to set her goggles straight.
s.add('se', 'talk', [(1, 200), (166, 260), (167, 320), (1, 160), (82, 160), (1, 180),
                     (99, 200), (100, 160), (101, 320)], loop=True)
s.add('se', 'hurt', [(112, 240), (1, 140)])
s.add('se', 'kneel', [(189, 1000, S)], loop=True)
s.add('se', 'victory', [(172, 220), (173, 200), (174, 260), (175, 220), (174, 200)], loop=True)

# ---- back (ne) ---------------------------------------------------------------------------
s.add('ne', 'idle', [(15, 900), (15, 900)], loop=True)
s.add('ne', 'walk', [(i, 110) for i in (16, 17, 18, 19, 20, 21)], loop=True)

s.build()
