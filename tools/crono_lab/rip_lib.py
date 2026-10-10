"""Shared tools for turning a ripped Chrono Trigger sprite sheet (The Spriters Resource)
into a game sheet (public/js/sheets/<key>.js). See rip_crono.py for a worked example.

    python3 tools/crono_lab/rip_lib.py segment <key>   # -> rip/<key>_frames.json + labelled previews
    python3 tools/crono_lab/rip_<key>.py               # build the sheet from a frame map

segment: finds every sprite (8-connected non-background blob, small blobs merged into
the sprite whose box contains them), numbers them in reading order, and writes
rip/<key>_frames.json plus rip/<key>_labels*.png (each frame boxed and numbered, 3x).

build(): each animation lists frames as (id, ms, flip, dx, dy). id indexes the frames
json, or is a name in extra boxes. Frames are anchored at the feet: the lowest row of
non-weapon pixels, centred on the bottom four rows. flip=True mirrors a frame (Chrono
Trigger profile sprites face left; the game's views face right).
"""
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
RIP = os.path.join(HERE, 'rip')


def background(im):
    from collections import Counter
    return Counter(im.convert('RGB').getdata()).most_common(1)[0][0]


def segment(key, min_px=20, exclude=()):
    im = Image.open(os.path.join(RIP, key + '_sheet.png')).convert('RGB')
    W, H = im.size
    bg = background(im)
    px = im.load()
    solid = [[px[x, y] != bg for x in range(W)] for y in range(H)]
    seen = [[False] * W for _ in range(H)]
    comps = []
    for y in range(H):
        for x in range(W):
            if solid[y][x] and not seen[y][x]:
                st = [(x, y)]
                seen[y][x] = True
                xs, ys = [], []
                while st:
                    a, b = st.pop()
                    xs.append(a)
                    ys.append(b)
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            X, Y = a + dx, b + dy
                            if 0 <= X < W and 0 <= Y < H and solid[Y][X] and not seen[Y][X]:
                                seen[Y][X] = True
                                st.append((X, Y))
                comps.append([min(xs), min(ys), max(xs), max(ys), len(xs)])
    comps = [c for c in comps if c[4] >= min_px and not any(c[0] >= e[0] and c[1] >= e[1] and c[2] <= e[2] and c[3] <= e[3] for e in exclude)]
    comps.sort(key=lambda c: -c[4])
    merged = []
    for c in comps:
        for m in merged:
            if c[0] >= m[0] - 3 and c[2] <= m[2] + 3 and c[1] >= m[1] - 3 and c[3] <= m[3] + 3:
                m[0], m[1], m[2], m[3] = min(m[0], c[0]), min(m[1], c[1]), max(m[2], c[2]), max(m[3], c[3])
                break
        else:
            merged.append(list(c))
    rows = []
    for c in sorted(merged, key=lambda c: (c[1] + c[3]) / 2):
        cy = (c[1] + c[3]) / 2
        if rows and abs(cy - rows[-1][0]) < 12:
            rows[-1][1].append(c)
        else:
            rows.append([cy, [c]])
    order = []
    for _, r in rows:
        order += sorted(r, key=lambda c: c[0])
    json.dump([c[:4] for c in order], open(os.path.join(RIP, key + '_frames.json'), 'w'))
    # Labelled previews, split into vertical bands so each stays readable.
    S = 3
    band = 220
    for i, y0 in enumerate(range(0, H, band)):
        y1 = min(H, y0 + band + 40)
        c = im.crop((0, y0, W, y1)).resize((W * S, (y1 - y0) * S), Image.NEAREST)
        d = ImageDraw.Draw(c)
        for n, f in enumerate(order):
            if f[1] >= y0 and f[1] < y0 + band:
                d.rectangle([f[0] * S, (f[1] - y0) * S, (f[2] + 1) * S, (f[3] - y0 + 1) * S], outline=(0, 255, 0))
                d.rectangle([f[0] * S, (f[1] - y0) * S - 1, f[0] * S + 22, (f[1] - y0) * S + 10], fill=(0, 0, 0))
                d.text((f[0] * S + 1, (f[1] - y0) * S - 1), str(n), fill=(255, 255, 0))
        c.save(os.path.join(RIP, f'{key}_labels{i}.png'))
    print(key, 'bg', bg, len(order), 'frames')
    return order


class Sheet:
    def __init__(self, key, w=72, h=72, ax=36, ay=66, weapon=(), extra=None, credit=''):
        self.key, self.W, self.H, self.AX, self.AY = key, w, h, ax, ay
        self.im = Image.open(os.path.join(RIP, key + '_sheet.png')).convert('RGB')
        self.bg = background(self.im)
        self.fr = json.load(open(os.path.join(RIP, key + '_frames.json')))
        self.extra = extra or {}
        self.weapon = set(weapon)
        self.credit = credit
        self.anims = {'se': {}, 'ne': {}}

    def box(self, fid):
        return self.extra[fid] if isinstance(fid, str) else self.fr[fid][:4]

    def grab(self, fid, flip):
        x0, y0, x1, y1 = self.box(fid)
        w, h = x1 - x0 + 1, y1 - y0 + 1
        px = [[self.im.getpixel((x0 + x, y0 + y)) for x in range(w)] for y in range(h)]
        px = [[None if p == self.bg else p for p in row] for row in px]
        if flip:
            px = [row[::-1] for row in px]
        body = [(x, y) for y in range(h) for x in range(w) if px[y][x] and px[y][x] not in self.weapon]
        fy = max(y for _, y in body)
        feet = [x for x, y in body if y >= fy - 3]
        fx = round((min(feet) + max(feet)) / 2)
        return px, fx, fy

    def add(self, view, name, frames, **extra):
        self.anims[view][name] = (frames, extra)

    def build(self, out=None, head=None):
        out = out or os.path.join(HERE, '..', '..', 'public', 'js', 'sheets', self.key + '.js')
        colours = {}
        letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        res = {'se': {}, 'ne': {}}
        for view, anims in self.anims.items():
            for name, (frames, extra) in anims.items():
                fl = []
                for f in frames:
                    fid, ms = f[0], f[1]
                    flip = f[2] if len(f) > 2 else False
                    dx = f[3] if len(f) > 3 else 0
                    dy = f[4] if len(f) > 4 else 0
                    px, fx, fy = self.grab(fid, flip)
                    rows = []
                    for row in px:
                        s = ''
                        for p in row:
                            if p is None:
                                s += '.'
                            else:
                                if p not in colours:
                                    colours[p] = letters[len(colours)]
                                s += colours[p]
                        rows.append(s.rstrip('.'))
                    fr = {'ms': ms, 'at': [self.AX - fx, self.AY - fy], 'rows': rows}
                    if dx:
                        fr['dx'] = dx
                    if dy:
                        fr['dy'] = dy
                    fl.append(fr)
                a = {'frames': fl}
                a.update(extra)
                res[view][name] = a
        pal = {v: '#%02x%02x%02x' % k for k, v in colours.items()}
        body = {'pal': pal, 'w': self.W, 'h': self.H, 'anchor': [self.AX, self.AY],
                'head': head or [self.AX, self.AY - 26], 'se': res['se'], 'ne': res['ne']}
        js = [f'// {self.key}: frames from the Chrono Trigger sprite sheet {self.credit} (The Spriters Resource),',
              f'// supplied by the user. Built by tools/crono_lab/rip_{self.key}.py.',
              f"CT.sheet('{self.key}', " + json.dumps(body, separators=(',', ':')) + ');', '']
        open(out, 'w').write('\n'.join(js))
        print('wrote', out, len(colours), 'colours')


if __name__ == '__main__' and sys.argv[1] == 'segment':
    segment(sys.argv[2])
