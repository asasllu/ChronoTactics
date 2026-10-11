"""Build public/js/sheets/ozzie.js (Ozzie, the green one; as the enemy Echo Ozzie) from the
Chrono Trigger Ozzie sheet ripped by Tonberry2k (The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_ozzie.py

rip/ozzie_sheet.png is the LEFT half of assets/ozzie.png (green Ozzie; the purple Ozzie VIII
and the text boxes are left out). Frame ids index rip/ozzie_frames.json:
  0/1 front laughing, 2 front squat, 3 front both arms raised, 4/5 back
  6 front stand, 7/8 front steps, 9 front flailing (cape flung), 10 crumpled heap
  13-15 profile facing right (13 stand), 16-18 profile facing left
  23-25 front with his staff (25 one hand flung up), 26-28 the same sweating, 29/30 panicking
  (spiral eyes), 31 head down, 32 frozen in a block of ice, 33 the ice melting from the feet,
  34 only the top of the ice left, 35 free again (arms raised)
  11, 12, 19-22 are detached ground shadows (unused).
'frozen' loops the ice block (the "preserved" pose) with a glint (a recoloured diagonal of
32) and a wriggle of his feet (33); 'thaw' plays him breaking out.
Ground shadows are drawn in the outline colour and are stripped (the game draws its own).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_cyrus import VSheet

OUTLINE = (40, 40, 16)
RIM = '#a0ffb0'


def build():
    s = VSheet('ozzie', w=64, h=60, ax=32, ay=56, shadow=OUTLINE, shadow_rows=6, shadow_passes=3,
               credit='ripped by Tonberry2k')
    F = False
    s.compose('breath6', 6, [('shift', 0, 14, 0, 1)], canvas=(64, 64), at=(16, 10))
    # A glint sweeping across the ice: the light blue on one diagonal turns white.
    px, fx, fy = s.grab(32, False)
    px = [[(248, 248, 248) if p == (64, 176, 248) and x - y in (12, 13) else p for x, p in enumerate(r)]
          for y, r in enumerate(px)]
    s.virt['ice_glint'] = (px, fx, fy)
    up = s.gpt(3, 16, 0)           # above his raised hands
    flung = s.gpt(25, 3, 5, True)  # the hand flung up (mirrored: towards the target)

    battle = {
        # Belly charge: sway back, hop forward, bump (hit), waddle back.
        'attack': ([(13, 120), (14, 110, F, -2), (15, 70, F, 3, -3), (13, 180, F, 7), (14, 140, F, 4),
                    (15, 110, F, 2), (13, 120)], {'hit': 3}),
        'hurt': ([(9, 220, F, -3), (6, 180, F, -1)], {}),
        'ko': ([(9, 160, F, -2), (29, 160, F, -1), (10, 1000, F, -1)], {}),
        'frozen': ([(32, 1200), ('ice_glint', 140), (32, 900), (33, 180)], {'loop': True}),
        'thaw': ([(32, 300), (33, 200), (34, 250), (35, 500), (6, 300)], {}),
    }
    for view in ('se', 'ne'):
        for name, (frames, extra) in battle.items():
            s.add(view, name, frames, **extra)
    s.add('se', 'idle', [(6, 600), ('breath6', 300), (6, 500), ('breath6', 300)], loop=True)
    s.add('se', 'walk', [(6, 120), (7, 120), (6, 120), (8, 120)], loop=True)
    s.add('se', 'talk', [(0, 220), (1, 220), (0, 220), (6, 200)], loop=True)
    s.add('se', 'cast', [(3, 170), (3, 170, F, 0, -1), (25, 260, True), (25, 140, True), (6, 180)],
          charge=[0, 1], release=2, rim=RIM, glow=[up, up, flung, flung])
    s.add('ne', 'idle', [(4, 600), (5, 600)], loop=True)
    s.add('ne', 'walk', [(4, 140), (5, 140)], loop=True)
    back_up = s.gpt(4, 13, 2)
    s.add('ne', 'cast', [(4, 170), (4, 170, F, 0, -1), (5, 260, F, 0, -2), (5, 140), (4, 180)],
          charge=[0, 1], release=2, rim=RIM, glow=[back_up] * 4)
    s.build(head=[32, 32])
    return s


if __name__ == '__main__':
    build()
