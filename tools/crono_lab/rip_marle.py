"""Build public/js/sheets/marle.js from the Chrono Trigger Marle sprite sheet (captured by
Tonberry2k, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_marle.py

Marle: idle/walk in both views, a talk loop, her story extras (jump, spin, cheer), and the
battle set for the Skirmish guest hero: attack (crossbow shot), cast, hurt, ko, kneel and
victory in both views. Frame ids index rip/marle_frames.json. Battle frames used:
  43 crossbow ready (profile, faces left: mirrored)   105, 106 doubled over (faces right)
  63 / 62 aiming / loosing a bolt (3/4 front facing right, as drawn)
  61 / 60 aiming / loosing a bolt (back view facing right, as drawn)
  131-133 arms raised over her head (front)   134-136 the same from behind
  130 lying flat (KO, mirrored)   157 down on one knee (faces right)   141-143 cheering jump
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_lib import Sheet

W, H, AX, AY = 64, 64, 32, 58
s = Sheet('marle', w=W, h=H, ax=AX, ay=AY, credit='captured by Tonberry2k')
F, S = False, True  # front/back frames as drawn; side frames that face left get flipped

# ---- front (se) --------------------------------------------------------------------------
# Idle: standing, with a blink (3) now and then.
s.add('se', 'idle', [(1, 900), (3, 120), (1, 700), (2, 400)], loop=True)
s.add('se', 'walk', [(i, 110) for i in (4, 5, 6, 7, 8, 9)], loop=True)
# Talk: chatting with her hands - fists on hips mid-sentence, then a giggle behind her hand.
s.add('se', 'talk', [(1, 220), (159, 300), (1, 180), (126, 260)], loop=True)
# Jump: crouch, airborne (legs tucked), land.
s.add('se', 'jump', [(214, 120), (208, 150, F, 0, -12), (209, 140, F, 0, -10), (214, 120), (1, 140)])
# Spin: a dance twirl with her arms out - front, right, back, left, twice round.
spin = [(198, 100), (202, 100), (200, 100), (202, 100, S)]
s.add('se', 'spin', spin + spin + [(198, 160), (1, 120)])
# Cheer: two quick hops with her arms flung up, then a laugh with her fists on her hips.
s.add('se', 'cheer', [(140, 120), (141, 100, F, 0, -6), (142, 120, F, 0, -10), (143, 110, F, 0, -6),
                      (140, 110), (141, 100, F, 0, -6), (144, 140, F, 0, -10), (143, 100, F, 0, -6),
                      (140, 140), (159, 480)], loop=True)
# Victory: the jump-for-joy from her battle wins.
s.add('se', 'victory', [(140, 200), (141, 120, F, 0, -6), (142, 140, F, 0, -10), (143, 160, F, 0, -10),
                        (141, 120, F, 0, -6), (140, 200)], loop=True)

# ---- back (ne) ---------------------------------------------------------------------------
s.add('ne', 'idle', [(19, 900), (19, 900)], loop=True)
s.add('ne', 'walk', [(i, 110) for i in (20, 21, 22, 23, 24, 25)], loop=True)
s.add('ne', 'jump', [(215, 120), (210, 150, F, 0, -12), (211, 140, F, 0, -10), (215, 120), (19, 140)])
s.add('ne', 'spin', [(200, 100), (202, 100, S), (198, 100), (202, 100)] * 2 + [(200, 160), (19, 120)])

# ---- battle (Skirmish guest hero) --------------------------------------------------------
ICE = '#c8f0ff'
# Attack: crossbow up, aim, loose the bolt (the hit: the bolt flies as an effect) with a small
# kick back, then settle.
s.add('se', 'attack', [(43, 140, S), (63, 170), (62, 150, F, -1), (63, 110, F, -1), (43, 150, S)], hit=2)
s.add('ne', 'attack', [(19, 120), (61, 170), (60, 150, F, -1), (61, 110, F, -1), (19, 150)], hit=2)
# Cast: hands clasped high (charge loop), then flung open as the spell goes off.
s.add('se', 'cast', [(131, 160), (132, 160), (133, 240), (1, 200)],
      charge=[0, 1], release=2, rim=ICE, glow=[[AX, AY - 40]] * 4)
s.add('ne', 'cast', [(134, 160), (135, 160), (136, 240), (19, 200)],
      charge=[0, 1], release=2, rim=ICE, glow=[[AX, AY - 40]] * 4)
s.add('ne', 'victory', [(134, 220), (135, 160, F, 0, -4), (134, 160, F, 0, -6), (135, 160, F, 0, -4),
                        (134, 220), (19, 200)], loop=True)
for v in ('se', 'ne'):
    s.add(v, 'hurt', [(105, 220, F, -2), (106, 140, F, -1), (43, 140, S)])
    s.add(v, 'ko', [(105, 160, F, -2), (130, 1000, S, -2)])
    s.add(v, 'kneel', [(157, 1000)], loop=True)

s.build()
