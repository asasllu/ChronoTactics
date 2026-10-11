"""Build public/js/sheets/avian_rex.js from the Chrono Trigger Avian Rex / Lizardactyl sheet
(ripped by Nemu, The Spriters Resource) supplied by the user. The Avian Rex is the gold
palette swap of the Lizardactyl with the same frames (ids as in rip_lizardactyl.py), but on
its rows some wings touch, so the segmenter merges sprites. Each frame is therefore found by
matching the Lizardactyl frame's exact silhouette on the Avian Rex sheet.

    python3 tools/crono_lab/rip_lizardactyl.py crop   # cuts both sheets
    python3 tools/crono_lab/rip_lib.py segment lizardactyl
    python3 tools/crono_lab/rip_lib.py segment avian_rex
    python3 tools/crono_lab/rip_avian_rex.py
"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from rip_lizardactyl import masks, build, RIP  # noqa: E402


def avian_masks():
    im = Image.open(os.path.join(RIP, 'avian_rex_sheet.png')).convert('RGB')
    px = im.load()
    Wd, Hd = im.size
    out = []
    for n, m in enumerate(masks('lizardactyl')):
        x0 = min(x for x, _ in m); y0 = min(y for _, y in m)
        rel = [(x - x0, y - y0) for x, y in m]
        best = None
        for oy in range(max(0, y0 - 14), y0 + 2):
            for ox in range(max(0, x0 - 14), x0 + 6):
                if any(not (0 <= ox + x < Wd and 0 <= oy + y < Hd) for x, y in rel):
                    continue
                sc = sum(1 for x, y in rel if px[ox + x, oy + y] != (255, 0, 255))
                if best is None or sc > best[0]:
                    best = (sc, ox, oy)
        sc, ox, oy = best
        print('frame', n, 'matched', sc, '/', len(rel), 'at', ox, oy)
        out.append({(ox + x, oy + y) for x, y in rel})
    return out


if __name__ == '__main__':
    build('avian_rex', avian_masks(), fire=True)
