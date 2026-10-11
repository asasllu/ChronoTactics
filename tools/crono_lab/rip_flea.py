"""Build public/js/sheets/flea.js (Flea, Magus' magician general) from the Chrono Trigger
Flea sheet ripped by Tonberry2k (The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_flea.py

rip/flea_sheet.png is assets/flea.png without the text box. Frame ids index
rip/flea_frames.json:
  0 narrow stand (half turned), 1 cape thrown open, 2-4 levitating with the cape billowing
  (ground shadow below), 5 wand flourish with a star (facing left), 6-8 profile facing left
  (6 with a heart blown beside it: extra box 'kiss'; 'six' is 6 without the heart's edge), 9-12 front walk.
The sheet has no back view, no hurt and no fallen frame ("He doesn't have many sprites"):
  - ne uses the profile frames mirrored to face right;
  - hurt is the front stand with the head snapped back (a shifted copy of 9);
  - the ko frame is the front stand laid on its side.
Ground shadows are drawn in the outline colour and are stripped (the game draws its own).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_cyrus import VSheet
from rip_slash import lie

OUTLINE = {(40, 40, 16), (56, 56, 40)}   # the shadow mixes both outline tones
RIM = '#ffc0e0'


def build():
    s = VSheet('flea', w=60, h=64, ax=30, ay=60, shadow=OUTLINE, shadow_rows=6, shadow_passes=3,
               extra={'kiss': [32, 61, 53, 95], 'six': [37, 61, 53, 95]}, credit='ripped by Tonberry2k')
    F, T = False, True
    s.compose('breath9', 9, [('shift', 0, 14, 0, 1)], canvas=(60, 70), at=(20, 10))
    s.compose('recoil', 9, [('shift', 0, 16, -1, 0), ('shift', 0, 9, -1, 0)], canvas=(60, 70), at=(20, 10))
    lie(s, 'lying', 9)
    chest = [s.gpt(2, 12, 20), s.gpt(3, 12, 20), s.gpt(4, 12, 20)]
    wand = s.gpt(5, 9, 1, T)

    for view in ('se', 'ne'):
        if view == 'se':
            s.add(view, 'idle', [(9, 560), ('breath9', 300), (9, 480), ('breath9', 300)], loop=True)
            s.add(view, 'walk', [(9, 120), (10, 120), (11, 120), (12, 120)], loop=True)
        else:
            s.add(view, 'idle', [('six', 600, T), ('six', 600, T)], loop=True)
            s.add(view, 'walk', [('six', 120, T), (7, 120, T), ('six', 120, T), (8, 120, T)], loop=True)
        # Wand flourish: a star snapped out in front.
        s.add(view, 'attack', [('six', 120, T), ('six', 80, T, 1, -1), (5, 200, T, 3), (5, 100, T, 3), ('six', 140, T, 1)],
              hit=2, rim=RIM, glow=[None, None, wand, wand, None])
        # Spell: the cape thrown open, rising on the billowing cape, a held glow.
        s.add(view, 'cast', [(2, 170, F, 0, -3), (3, 170, F, 0, -4), (4, 280, F, 0, -6), (2, 160, F, 0, -3),
                             (1, 160), (9, 160)],
              charge=[0, 1], release=2, rim=RIM, glow=[chest[0], chest[1], chest[2], chest[0]])
        s.add(view, 'hurt', [('recoil', 200, F, -3), (9, 220, F, -1)])
        s.add(view, 'ko', [('recoil', 180, F, -2), ('lying', 1000)])
        # Victory: a blown kiss (the heart), then a little hop on the cape.
        s.add(view, 'victory', [(9, 260), ('kiss', 520, T), (1, 240), (2, 240, F, 0, -2)], loop=True)
    s.build(head=[30, 34])
    return s


if __name__ == '__main__':
    build()
