"""Build public/js/sheets/mud_imp.js (Mud Imp) from the Chrono Trigger imp sheet supplied by
the user. Same layout and frame ids as the Blue Imp: see rip_imp.py.

    python3 tools/crono_lab/rip_mud_imp.py [crop]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rip_imp import main  # noqa: E402

if __name__ == '__main__':
    main('mud_imp')
