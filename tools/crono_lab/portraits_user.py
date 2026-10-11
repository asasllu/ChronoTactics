"""Build public/js/sheets/portraits_recast.js from the improved portrait sheet the user
supplied (tools/crono_lab/rip/assets/portraits_improved.webp): a grid of characters (rows)
by emotions (columns). Each cell is cropped square, reduced to the 48x48 CT menu-portrait
size and quantised to a small per-character palette so it stays crisp pixel art.

    python3 tools/crono_lab/portraits_user.py [preview-dir]

(Supersedes the hand-drawn output of portraits_recast.py, kept for reference.)
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'rip', 'assets', 'portraits_improved.webp')
OUT = os.path.join(HERE, '..', '..', 'public', 'js', 'sheets', 'portraits_recast.js')
SIZE = 48
COLOURS = 96  # per character

EMOTIONS = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'determined', 'broken']
# (speaker id, number of emotion columns); rows top to bottom as on the sheet.
ROWS = [('iselle', 7), ('curator', 6), ('spekkio', 6), ('king', 6), ('leene', 6),
        ('gaspar', 6), ('kino', 6), ('elder', 6), ('guard', 6)]
BG = (32, 34, 47)


def runs(v, th, minlen):
    out, s = [], None
    for i, c in enumerate(v):
        if c > th and s is None:
            s = i
        if c <= th and s is not None:
            out.append((s, i - 1))
            s = None
    if s is not None:
        out.append((s, len(v) - 1))
    return [r for r in out if r[1] - r[0] > minlen]


def cells(im):
    W, H = im.size
    px = im.load()
    nb = lambda p: sum(abs(a - b) for a, b in zip(p, BG)) > 40
    ys = runs([sum(nb(px[x, y]) for x in range(79, 217)) for y in range(H)], 100, 40)
    y0, y1 = ys[0]
    xs = runs([sum(nb(px[x, y]) for y in range(y0, y1)) for x in range(W)], 100, 40)
    return xs, ys


def main():
    im = Image.open(SRC).convert('RGB')
    xs, ys = cells(im)
    assert len(ys) == len(ROWS) and len(xs) >= 7, (xs, ys)
    data, previews = {}, []
    for (pid, n), (y0, y1) in zip(ROWS, ys):
        tiles = []
        for (x0, x1) in xs[:n]:
            x0, x1, ya, yb = x0 + 1, x1 - 1, y0 + 1, y1 - 1
            w, h = x1 - x0 + 1, yb - ya + 1
            side = min(w, h)
            top = ya + int((h - side) * 0.3)   # keep crowns/helmets; trim mostly at the shoulders
            left = x0 + (w - side) // 2
            cell = im.crop((left, top, left + side, top + side))
            tiles.append(cell.resize((SIZE, SIZE), Image.LANCZOS))
        # One palette per character so its emotions share colours.
        strip = Image.new('RGB', (SIZE * len(tiles), SIZE))
        for i, t in enumerate(tiles):
            strip.paste(t, (i * SIZE, 0))
        q = strip.quantize(COLOURS, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
        data[pid] = {}
        for i in range(len(tiles)):
            t = q.crop((i * SIZE, 0, (i + 1) * SIZE, SIZE))
            data[pid][EMOTIONS[i]] = [''.join('%02x%02x%02x' % t.getpixel((x, y)) for x in range(SIZE)) for y in range(SIZE)]
        previews.append(q)
    js = ['// Dialogue portraits for the recast cast (Sir Cyrus, the Curator in the Prophet\'s shape,',
          '// the Frog King, story NPCs), from the improved portrait sheet supplied by the user.',
          '// Built by tools/crono_lab/portraits_user.py: 48x48, one hex colour per pixel,',
          '// CT.RECAST_PORTRAITS[id][emotion] = rows.',
          'window.CT = window.CT || {};',
          'CT.RECAST_PORTRAITS = ' + json.dumps(data, separators=(',', ':')) + ';',
          '(function () {',
          '  const set = new Set();',
          '  for (const set_ of Object.values(CT.RECAST_PORTRAITS)) for (const rows of Object.values(set_)) for (const r of rows) for (let i = 0; i < r.length; i += 6) set.add(\'#\' + r.slice(i, i + 6));',
          '  if (CT.PAL && CT.PAL.extend) CT.PAL.extend([...set]);',
          '})();', '']
    open(OUT, 'w').write('\n'.join(js))
    print('wrote', OUT, sum(len(v) for v in data.values()), 'portraits')
    if len(sys.argv) > 1:
        d = sys.argv[1]
        os.makedirs(d, exist_ok=True)
        sheet = Image.new('RGB', (SIZE * 7 * 4, SIZE * len(previews) * 4), (32, 34, 47))
        for r, q in enumerate(previews):
            sheet.paste(q.resize((q.width * 4, q.height * 4), Image.NEAREST), (0, r * SIZE * 4))
        sheet.save(os.path.join(d, 'portraits_user_contact.png'))


main()
