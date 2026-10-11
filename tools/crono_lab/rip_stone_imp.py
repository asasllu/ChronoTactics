"""Build public/js/sheets/stone_imp.js (Stone Imp; the Curator's seed-carrying statues) from
the Chrono Trigger imp sheet supplied by the user. Same layout and frame ids as the Blue Imp
(see rip_imp.py), plus 'fall' (the statue topples backwards) and 'dissolve' (it crumbles).
The toppling and crumbling frames are derived from front frame 0: turned 25/55/90 degrees,
then thinned in an ordered-dither pattern.

    python3 tools/crono_lab/rip_stone_imp.py [crop]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_imp import crop, imp_sheet, base_anims, F  # noqa: E402

KEY = 'stone_imp'

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'crop':
        crop(KEY)
        sys.exit()
    s = imp_sheet(KEY, {'tilt25': (0, 25, 1), 'tilt55': (0, 55, 1), 'down': (0, 90, 1),
                        'dust75': (0, 90, 0.75), 'dust50': (0, 90, 0.5), 'dust25': (0, 90, 0.25),
                        'dust10': (0, 90, 0.1)})
    base_anims(s)
    s.add('se', 'fall', [(18, 220), (0, 160, F, -1, 0), ('tilt25', 110, F, -3, 0), ('tilt55', 80, F, -6, 0),
                         ('down', 70, F, -9, 1), ('down', 400, F, -9, 0)])
    s.add('se', 'dissolve', [('down', 300, F, -9, 0), ('dust75', 160, F, -9, 0), ('dust50', 160, F, -9, 0),
                             ('dust25', 160, F, -9, 0), ('dust10', 160, F, -9, 0)])
    s.build(head=[28, 30])
