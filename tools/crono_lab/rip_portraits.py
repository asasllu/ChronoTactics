"""Dialogue portraits from the Chrono Trigger sprite sheets supplied by the user.

    python3 tools/crono_lab/rip_portraits.py   # -> public/js/sheets/portraits_ct.js

Each sheet carries the character's 48x48 menu portrait; CT.getPortrait uses it (for every
emotion: the original game has one portrait per character).
"""
import json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BOXES = {  # sheet key -> (x0, y0) of the 48x48 portrait
    'crono': (1, 2), 'frog': (442, 3), 'ayla': (1, 2), 'magus': (718, 110),
    'marle': (1, 2), 'lucca': (1, 2), 'robo': (663, 8),
}
out = {}
for key, (x0, y0) in BOXES.items():
    im = Image.open(os.path.join(HERE, 'rip', key + '_sheet.png')).convert('RGB')
    rows = []
    for y in range(48):
        rows.append(''.join('%02x%02x%02x' % im.getpixel((x0 + x, y0 + y)) for x in range(48)))
    out[key] = rows
js = ['// Dialogue portraits from the Chrono Trigger sprite sheets supplied by the user',
      '// (The Spriters Resource). Built by tools/crono_lab/rip_portraits.py. 48x48, one hex',
      '// colour per pixel.',
      'window.CT = window.CT || {};',
      'CT.RIP_PORTRAITS = ' + json.dumps(out, separators=(',', ':')) + ';',
      '(function () {',
      '  const set = new Set();',
      "  for (const rows of Object.values(CT.RIP_PORTRAITS)) for (const r of rows) for (let i = 0; i < r.length; i += 6) set.add('#' + r.slice(i, i + 6));",
      '  if (CT.PAL && CT.PAL.extend) CT.PAL.extend([...set]);',
      '})();', '']
open(os.path.join(HERE, '..', '..', 'public', 'js', 'sheets', 'portraits_ct.js'), 'w').write('\n'.join(js))
print('wrote portraits for', ', '.join(out))
