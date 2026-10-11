"""Build public/js/sheets/robo.js from the Chrono Trigger Robo sprite sheet (ripped by Ryan914
and Tonberry2k, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_robo.py

Robo: idle/walk in both views and a talk loop, plus the battle set for the Skirmish guest
hero: attack (rocket punch), cast, hurt, ko, kneel and victory in both views. Frame ids
index rip/robo_frames.json. Battle frames (profile ones face left and are mirrored):
  44 standing (profile)   108 fist drawn back   45 crouched   91 arm fired out   107 arm out, low
  36/37 front, claws raised   38 chest lens open (laser)   96/99/117 arms raised, from behind
  40 knocked back (profile)   151-153 blown over (face right as drawn)   160 lying flat
  154 slumped (front)   158 slumped (from behind) His walk on the sheet is the SNES 4-step
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
# Kneel: slumped down low (his powered-down crouch).
s.add('se', 'kneel', [(154, 1000)], loop=True)
# Victory: both arms thrown up, a shrug of the shoulders, then a double flex of his claws.
s.add('se', 'victory', [(94, 260), (115, 200), (94, 200), (36, 220), (37, 200), (36, 200), (37, 240)], loop=True)

# ---- back (ne) ---------------------------------------------------------------------------
s.add('ne', 'idle', [(2, 900), (2, 900)], loop=True)
s.add('ne', 'walk', [(9, 140), (2, 110), (10, 140), (2, 110)], loop=True)

# ---- battle (Skirmish guest hero) --------------------------------------------------------
LASER = '#b8fff0'
# Attack: rocket punch - fist drawn back, a crouch, then the arm fires out (the hit; the fist
# flies as an effect) with a little kick back, and he straightens up.
attack = [(44, 140, S), (108, 140, S), (45, 80, S), (91, 170, S, 3), (107, 110, S, 2), (44, 150, S)]
# Cast: claws raised to charge (loop), then the chest lens opens and fires.
s.add('se', 'cast', [(36, 160), (37, 160), (38, 260), (0, 200)],
      charge=[0, 1], release=2, rim=LASER, glow=[[AX, AY - 30], [AX, AY - 30], [AX, AY - 18], [AX, AY - 18]])
s.add('ne', 'cast', [(96, 160), (99, 160), (117, 260), (2, 200)],
      charge=[0, 1], release=2, rim=LASER, glow=[[AX, AY - 34]] * 4)
s.add('ne', 'victory', [(96, 260), (99, 200), (117, 260), (99, 200)], loop=True)
s.add('ne', 'kneel', [(158, 1000)], loop=True)
for v in ('se', 'ne'):
    s.add(v, 'attack', attack, hit=3)
    s.add(v, 'hurt', [(40, 220, S, -2), (44, 160, S, -1)])
    s.add(v, 'ko', [(151, 140, F, -1), (152, 140, F, -3), (153, 160, F, -4), (160, 1000, F, -4)])

s.build(head=[AX, AY - 22])
