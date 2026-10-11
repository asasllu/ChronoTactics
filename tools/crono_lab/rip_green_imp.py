"""Build public/js/sheets/green_imp.js (Green Imp) from the Chrono Trigger imp sheet supplied
by the user. Same layout and frame ids as the Blue Imp (see rip_imp.py), plus a rock toss.

    python3 tools/crono_lab/rip_green_imp.py [crop]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_imp import crop, imp_sheet, base_anims, A, F  # noqa: E402

KEY = 'green_imp'

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'crop':
        crop(KEY)
        sys.exit()
    s = imp_sheet(KEY)
    base_anims(s)
    # Rock toss (the sheet has no throw pose): lean back, then a hopping spin whose swoosh is
    # the throwing arc; the rock (fx_rock) leaves on the swoosh frame.
    s.add('se', 'tech_rock_toss', [(3, 140, A), (14, 180, A, -2, 0), (12, 80, A, 0, -1), (32, 170, A, 3, -4),
                                   (33, 100, A, 2, -3), (34, 90, A, 1, -1), (3, 160, A)], hit=3, release=3)
    s.add('ne', 'tech_rock_toss', [(6, 140), (8, 180, F, -2, 0), (31, 80, F, 0, -2), (29, 170, F, 3, -5),
                                   (30, 100, F, 2, -3), (31, 90, F, 1, -1), (6, 160)], hit=3, release=3)
    s.build(head=[28, 30])
