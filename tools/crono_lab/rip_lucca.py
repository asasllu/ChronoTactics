"""Build public/js/sheets/lucca.js from the Chrono Trigger Lucca sprite sheet (captured by
Tonberry2k, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_lucca.py

Lucca: idle/walk in both views and a lively talk loop (gesturing, then reaching up to fix her
goggles), plus the battle set for the Skirmish guest hero: attack (a gun shot), cast, hurt,
ko, kneel and victory in both views. Frame ids index rip/lucca_frames.json. Battle frames:
  74 gun raised, 73 gun levelled and fired (profile, facing right as drawn)
  133/134, 99 arms raised (front)   135/136, 102-104 arms raised (from behind)
  131 doubled over (faces left: mirrored)   112 hand to her head   124 knocked down, sitting
  129 lying flat (mirrored)   189 down on one knee (mirrored)
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
s.add('se', 'victory', [(172, 220), (173, 200), (174, 260), (175, 220), (174, 200)], loop=True)

# ---- back (ne) ---------------------------------------------------------------------------
s.add('ne', 'idle', [(15, 900), (15, 900)], loop=True)
s.add('ne', 'walk', [(i, 110) for i in (16, 17, 18, 19, 20, 21)], loop=True)

# ---- battle (Skirmish guest hero) --------------------------------------------------------
FIRE = '#ffc070'
# Attack: gun up, level it, fire (the hit: the shot is an effect) with a kick back, settle.
attack = [(74, 150), (73, 160), (73, 140, F, -2), (73, 100, F, -1), (74, 150)]
s.add('se', 'cast', [(133, 160), (134, 160), (99, 240), (1, 200)],
      charge=[0, 1], release=2, rim=FIRE, glow=[[AX, AY - 40]] * 4)
s.add('ne', 'cast', [(135, 160), (136, 160), (102, 240), (15, 200)],
      charge=[0, 1], release=2, rim=FIRE, glow=[[AX, AY - 40]] * 4)
s.add('ne', 'victory', [(102, 220), (103, 200), (104, 260), (103, 200)], loop=True)
for v in ('se', 'ne'):
    s.add(v, 'attack', attack, hit=2)
    s.add(v, 'hurt', [(131, 220, S, -2), (112, 180, F, -1)])
    s.add(v, 'ko', [(124, 180, F, -2), (129, 1000, S, -2)])
    s.add(v, 'kneel', [(189, 1000, S)], loop=True)

s.build()
