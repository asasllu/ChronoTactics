"""Build public/js/sheets/slash.js (Slash, Magus' swordsman general) from the Chrono
Trigger Slash sheet ripped by Tonberry2k (The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_slash.py

rip/slash_sheet.png is assets/slash.png without the text box. Frame ids index
rip/slash_frames.json (see rip/slash_labels*.png). What the sheet holds, by id:
  0 front sword stance, 1 back sword stance, 2/3 sword held upright
  4 front wind-up (sword cocked behind), 5 front lunge (sword level, right), 6 the same with a
  low sweeping arc; 11/12/13 the same three from behind (sword to the left)
  18/19/20 profile slash facing right (wind-up, crescent arc, follow-through); 25-27 mirrored
  7-10 / 14-17 unarmed stands (front, back, 3/4); 72-74 front walk (arms crossed), 75 front scared
  63-65 back walk, 66-71 side walk (facing left), 52-55 hovering (with detached shadows)
  21/22 front fighting crouches, 29/30 back crouches, 31/32 wide stances
  23/28 airborne arms flung out (front/back), 36/44 airborne profile, 56 sword raised overhead,
  57 plunging down sword-first
  40-43, 47-48, 50-51 scared poses (sweat drops), 82/83 caught in ice, 84/86 charging (orbs in
  the hands), 87/88 casting a blast to the right (front), 89/90 the same from behind.
Ground shadows are drawn in the outline colour and are stripped (the game draws its own).
There is no lying frame: the ko frame is the scared front pose (75) laid on its side.
There is no kneel either: the winded front crouch (21) / back crouch (29) stand in.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_cyrus import VSheet, Canvas

OUTLINE = (48, 48, 24)
BLADE = {(248, 248, 248), (168, 208, 248), (128, 144, 240)}   # blade / arc tones (not used for feet)
RIM = '#c0e0ff'


def lie(s, name, base):
    """`base` turned 90 degrees anticlockwise (head to the left), resting on the ground."""
    px, fx, fy = s.grab(base, False)
    h, w = len(px), len(px[0])
    rot = [[px[x][w - 1 - y] for x in range(h)] for y in range(w)]
    cv = Canvas(h + 2, w + 2)
    cv.paste(rot, 1, 1)
    px2, x0, y0 = cv.crop()
    s.virt[name] = (px2, (h + 2) // 2 - x0, len(px2) - 1)


def build():
    s = VSheet('slash', w=88, h=72, ax=40, ay=66, weapon=BLADE, shadow=OUTLINE,
               credit='ripped by Tonberry2k')
    F, T = False, True
    s.compose('breath72', 72, [('shift', 0, 17, 0, 1)], canvas=(60, 70), at=(20, 10))
    s.compose('breath63', 63, [('shift', 0, 17, 0, 1)], canvas=(60, 70), at=(20, 10))
    lie(s, 'lying', 75)

    # ---- se: front for standing/walking, front and profile battle sprites (face right)
    s.add('se', 'idle', [(72, 600), ('breath72', 320), (72, 500), ('breath72', 320)], loop=True)
    s.add('se', 'walk', [(72, 120), (73, 120), (72, 120), (74, 120)], loop=True)
    # Sword lunge: stance, wind-up, lunge, low sweeping arc (hit), lunge held, stance.
    s.add('se', 'attack', [(0, 120), (4, 160), (5, 70, F, 4), (6, 170, F, 6), (5, 110, F, 5),
                           (0, 140, F, 2), (0, 120)], hit=3)
    s.add('se', 'cast', [(84, 170), (86, 170), (87, 240), (88, 160), (72, 180)],
          charge=[0, 1], release=2, rim=RIM,
          glow=[s.gpt(84, 18, 8), s.gpt(86, 19, 8), s.gpt(87, 30, 14), s.gpt(88, 30, 14)])
    s.add('se', 'hurt', [(51, 220, F, -3), (21, 180, F, -1)])
    s.add('se', 'kneel', [(21, 1000)], loop=True)
    s.add('se', 'ko', [(51, 180, F, -2), ('lying', 1000)])
    s.add('se', 'victory', [(0, 240), (56, 700), (56, 260, F, 0, -1), (56, 500)], loop=True)
    # Extra: the profile slash with its crescent (a second sword move for scenes / techs).
    s.add('se', 'slash', [(18, 160), (19, 180, F, 4), (20, 160, F, 4), (20, 120)], hit=1)

    # ---- ne: back sprites; the back sword set is mirrored so the blade points right
    s.add('ne', 'idle', [(63, 600), ('breath63', 320), (63, 500), ('breath63', 320)], loop=True)
    s.add('ne', 'walk', [(63, 120), (64, 120), (63, 120), (65, 120)], loop=True)
    s.add('ne', 'attack', [(1, 120, T), (11, 160, T), (12, 70, T, 4), (13, 170, T, 6), (12, 110, T, 5),
                           (1, 140, T, 2), (1, 120, T)], hit=3)
    s.add('ne', 'cast', [(30, 170), (30, 170, F, 0, -1), (89, 240, T), (90, 160, T), (63, 180)],
          charge=[0, 1], release=2, rim=RIM,
          glow=[s.gpt(30, 26, 12), s.gpt(30, 26, 11), s.gpt(89, 9, 14, T), s.gpt(90, 9, 14, T)])
    s.add('ne', 'hurt', [(51, 220, F, -3), (29, 180, F, -1)])
    s.add('ne', 'kneel', [(29, 1000)], loop=True)
    s.add('ne', 'ko', [(51, 180, F, -2), ('lying', 1000)])
    s.add('ne', 'victory', [(1, 240), (56, 700), (56, 260, F, 0, -1), (56, 500)], loop=True)
    s.add('ne', 'slash', [(18, 160), (19, 180, F, 4), (20, 160, F, 4), (20, 120)], hit=1)
    s.build(head=[40, 38])
    return s


if __name__ == '__main__':
    build()
