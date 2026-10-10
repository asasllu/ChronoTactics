"""Build public/js/sheets/robo.js from the Chrono Trigger Robo sprite sheet (ripped by Ryan914
and Tonberry2k, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_robo.py

Robo is a story NPC here: idle/walk in both views and a talk loop, plus hurt, kneel and
victory. Frame ids index rip/robo_frames.json. His walk on the sheet is the SNES 4-step
(stand, left, stand, right), so it is played as such.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet

W, H, AX, AY = 64, 64, 32, 58
s = Sheet('robo', w=W, h=H, ax=AX, ay=AY, credit='ripped by Ryan914 and Tonberry2k')
F, S = False, True  # front/back frames as drawn; side frames that face left get flipped

# ---- front (se) --------------------------------------------------------------------------
# Idle: standing; 3 dims the eye lenses (a blink).
s.add('se', 'idle', [(0, 900), (3, 140), (0, 600), (3, 120), (0, 300)], loop=True)
s.add('se', 'walk', [(5, 140), (0, 110), (6, 140), (3, 110)], loop=True)
# Talk: lifting one hand then the other as he explains.
s.add('se', 'talk', [(0, 200), (100, 260), (0, 140), (101, 260), (102, 200)], loop=True)
s.add('se', 'hurt', [(39, 240), (0, 140)])
# Kneel: slumped down low (his powered-down crouch).
s.add('se', 'kneel', [(154, 1000)], loop=True)
# Victory: both arms thrown up, a shrug of the shoulders, then a double flex of his claws.
s.add('se', 'victory', [(94, 260), (115, 200), (94, 200), (36, 220), (37, 200), (36, 200), (37, 240)], loop=True)

# ---- back (ne) ---------------------------------------------------------------------------
s.add('ne', 'idle', [(2, 900), (2, 900)], loop=True)
s.add('ne', 'walk', [(9, 140), (2, 110), (10, 140), (2, 110)], loop=True)

s.build(head=[AX, AY - 22])
