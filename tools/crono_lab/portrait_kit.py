"""Painting kit for the recast dialogue portraits (see portraits_recast.py, which draws the
characters with it).

How a portrait is made
----------------------
Like the SNES menu portraits, each one is a 48x48 opaque tile with a pale backdrop, a dark
outline, ~16 colours on hand-picked ramps and soft (dithered) cel shading.

* Shapes are painted at 4x (192x192) into two maps: a material map (which ramp a pixel uses)
  and a tone map (how many ramp steps lighter or darker than the material's base tone).
  `fill` lays a material, `shade` moves the tone of chosen materials inside a shape: that is
  how the artist-placed shadow and highlight shapes are made.
* The maps are reduced to 48x48: the majority material of each 4x4 block wins and its tone is
  the block's average, so the edge of a shadow shape lands between two steps and comes out
  as a 2x2 ordered dither (the soft CT transitions).
* Edges: a material with `edge` gets a 1px dark line where it lies in front of a lower-z
  material or the backdrop.
* Last, 1x details (eyes, mouths, glints) are stamped straight onto the 48x48 tile from small
  letter templates, so the features stay crisp.
"""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageChops

S = 4            # paint scale
N = 48           # tile size
W = N * S
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_JS = os.path.join(HERE, '..', '..', 'public', 'js', 'sheets', 'portraits_recast.js')
BAYER = [[0.125, 0.625], [0.875, 0.375]]
EMOS = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'determined']


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---- curves -----------------------------------------------------------------------------
def catmull(pts, closed=True, n=10):
    """Smooth curve through pts (Catmull-Rom), as a dense list of points."""
    P = list(pts)
    m = len(P)
    out = []
    segs = m if closed else m - 1
    for i in range(segs):
        p0 = P[(i - 1) % m] if closed else P[max(i - 1, 0)]
        p1 = P[i % m]
        p2 = P[(i + 1) % m] if closed else P[min(i + 1, m - 1)]
        p3 = P[(i + 2) % m] if closed else P[min(i + 2, m - 1)]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    if not closed:
        out.append(tuple(P[-1]))
    return out


class Pic:
    def __init__(self, bg, ink):
        self.mats = {}          # name -> dict(id, ramp, base, z, edge)
        self.byid = {}
        self.mat = Image.new('L', (W, W), 0)
        self.tone = Image.new('L', (W, W), 128)
        self.bg = bg
        self.ink = ink
        self.post = []          # 1x stamps applied after reduction
        self.material('bg', [bg], 0, z=-1)

    # -- materials --
    def material(self, name, ramp, base, z=0, edge=False, edgecol=None, auto=0.0):
        mid = len(self.mats)
        m = dict(id=mid, name=name, ramp=ramp, base=base, z=z, edge=edge, edgecol=edgecol, auto=auto)
        self.mats[name] = m
        self.byid[mid] = m
        return m

    # -- masks at 4x --
    def mask(self, kind, *a, **k):
        im = Image.new('L', (W, W), 0)
        d = ImageDraw.Draw(im)
        if kind == 'poly':
            d.polygon([(x * S, y * S) for x, y in a[0]], fill=255)
        elif kind == 'blob':
            d.polygon([(x * S, y * S) for x, y in catmull(a[0])], fill=255)
        elif kind == 'ell':
            cx, cy, rx, ry = a
            d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], fill=255)
        elif kind == 'stroke':
            pts = catmull(a[0], closed=False) if len(a[0]) > 2 else a[0]
            wd = max(1, int(round(a[1] * S)))
            d.line([(x * S, y * S) for x, y in pts], fill=255, width=wd, joint='curve')
            r = wd / 2
            for x, y in (pts[0], pts[-1]):
                d.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=255)
        elif kind == 'lock':
            # A tapered hair lock: root edge a-b, sharp tip, bowed by `bend` (perpendicular).
            a, b, tip, bend = a[0], a[1], a[2], (a[3] if len(a) > 3 else 0)
            pts = []
            for (r, side) in ((a, 1), (b, -1)):
                mx, my = (r[0] + tip[0]) / 2, (r[1] + tip[1]) / 2
                dx, dy = tip[0] - r[0], tip[1] - r[1]
                L = math.hypot(dx, dy) or 1
                cx, cy = mx - dy / L * bend, my + dx / L * bend
                seg = [((1 - t) ** 2 * r[0] + 2 * (1 - t) * t * cx + t * t * tip[0],
                        (1 - t) ** 2 * r[1] + 2 * (1 - t) * t * cy + t * t * tip[1]) for t in [i / 12 for i in range(13)]]
                pts += seg if side == 1 else seg[::-1]
            d.polygon([(x * S, y * S) for x, y in pts], fill=255)
        elif kind == 'rect':
            x0, y0, x1, y1 = a
            d.rectangle([x0 * S, y0 * S, x1 * S - 1, y1 * S - 1], fill=255)
        return im

    def onmask(self, names):
        ids = {self.mats[n]['id'] for n in names}
        return self.mat.point(lambda v: 255 if v in ids else 0)

    def fill(self, name, shape, tone=0.0, on=None, off=None):
        m = self.mats[name]
        mk = shape
        if on:
            mk = ImageChops.multiply(mk, self.onmask(on))
        if off:
            mk = ImageChops.subtract(mk, self.onmask(off))
        self.mat.paste(m['id'], (0, 0), mk)
        self.tone.paste(int(128 + tone * 16), (0, 0), mk)

    def shade(self, delta, shape, on=None, off=None):
        mk = shape
        if on:
            mk = ImageChops.multiply(mk, self.onmask(on))
        if off:
            mk = ImageChops.subtract(mk, self.onmask(off))
        v = int(round(abs(delta) * 16))
        layer = Image.new('L', (W, W), 0)
        layer.paste(v, (0, 0), mk)
        self.tone = ImageChops.add(self.tone, layer) if delta > 0 else ImageChops.subtract(self.tone, layer)

    def settone(self, tone, shape, on=None):
        mk = shape if not on else ImageChops.multiply(shape, self.onmask(on))
        self.tone.paste(int(128 + tone * 16), (0, 0), mk)

    # -- reduction --
    def reduce(self):
        M = self.mat.load()
        T = self.tone.load()
        mat = [[0] * N for _ in range(N)]
        ton = [[0.0] * N for _ in range(N)]
        for y in range(N):
            for x in range(N):
                cnt = {}
                acc = {}
                for dy in range(S):
                    for dx in range(S):
                        v = M[x * S + dx, y * S + dy]
                        cnt[v] = cnt.get(v, 0) + 1
                        acc[v] = acc.get(v, 0) + T[x * S + dx, y * S + dy]
                best = max(cnt, key=lambda k: (cnt[k], self.byid[k]['z']))
                mat[y][x] = best
                t = (acc[best] / cnt[best] - 128) / 16
                # Snap to whole steps, keeping only clear half steps (they become a 2x2
                # checker dither): avoids speckle where shading shapes overlap a block.
                f = t - math.floor(t)
                t = math.floor(t) + (0.5 if 0.3 <= f <= 0.7 else (1 if f > 0.7 else 0))
                ton[y][x] = t
        self.m1, self.t1 = mat, ton

    def autoshade(self):
        """Edge-band shading for materials with auto>0: dark toward bottom-right edges,
        light toward top-left edges (light from the upper left, as in the CT portraits)."""
        mat, ton = self.m1, self.t1
        add = [[0.0] * N for _ in range(N)]
        for y in range(N):
            for x in range(N):
                m = self.byid[mat[y][x]]
                a = m['auto']
                if not a:
                    continue
                same = lambda xx, yy: 0 <= xx < N and 0 <= yy < N and mat[yy][xx] == mat[y][x]
                d = 0.0
                if not same(x + 1, y) or not same(x, y + 1):
                    d -= 1.0
                elif not same(x + 2, y) or not same(x, y + 2) or not same(x + 1, y + 1):
                    d -= 0.5
                elif not same(x - 1, y) or not same(x, y - 1):
                    d += 0.75
                add[y][x] = d * a
        for y in range(N):
            for x in range(N):
                ton[y][x] += add[y][x]

    def grad1(self, on, p0, p1, d0, d1):
        """Linear tone gradient at 1x along p0->p1 (from d0 to d1) on materials `on`."""
        ids = {self.mats[n]['id'] for n in on}
        vx, vy = p1[0] - p0[0], p1[1] - p0[1]
        L2 = vx * vx + vy * vy
        for y in range(N):
            for x in range(N):
                if self.m1[y][x] in ids:
                    t = max(0, min(1, ((x + 0.5 - p0[0]) * vx + (y + 0.5 - p0[1]) * vy) / L2))
                    self.t1[y][x] += d0 + (d1 - d0) * t

    def render(self):
        mat, ton = self.m1, self.t1
        out = [[None] * N for _ in range(N)]
        for y in range(N):
            for x in range(N):
                m = self.byid[mat[y][x]]
                r = m['ramp']
                t = ton[y][x]
                k = m['base'] + math.floor(t + BAYER[y & 1][x & 1])
                out[y][x] = r[max(0, min(len(r) - 1, k))]
        # outlines
        for y in range(N):
            for x in range(N):
                m = self.byid[mat[y][x]]
                if not m['edge']:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if not (0 <= xx < N and 0 <= yy < N):
                        continue
                    o = self.byid[mat[yy][xx]]
                    if o['z'] < m['z'] and (m['edge'] is True or o['name'] == 'bg' or (isinstance(m['edge'], (set, list, tuple)) and o['name'] in m['edge'])):
                        out[y][x] = m['edgecol'] or self.ink
                        break
        self.px = out
        return out

    # -- 1x drawing on the rendered tile --
    def put(self, x, y, col):
        if 0 <= x < N and 0 <= y < N and col:
            self.px[y][x] = col

    def stamp(self, x0, y0, rows, cmap):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch in '. ':
                    continue
                self.put(x0 + i, y0 + j, cmap[ch])

    def line(self, pts, col, closed=False):
        pts = catmull(pts, closed=closed, n=12) if len(pts) > 2 else pts
        last = None
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
            for i in range(n + 1):
                x = int(math.floor(x0 + (x1 - x0) * i / n))
                y = int(math.floor(y0 + (y1 - y0) * i / n))
                if (x, y) != last:
                    self.put(x, y, col)
                    last = (x, y)

    def get(self, x, y):
        return self.px[y][x]

    def rows(self):
        return [''.join(c.lstrip('#') for c in r) for r in self.px]

    def image(self):
        im = Image.new('RGB', (N, N))
        for y in range(N):
            for x in range(N):
                im.putpixel((x, y), hexrgb(self.px[y][x]))
        return im


# =========================================================================================
# Character art lives below; each builder returns a finished Pic for (emotion).
# =========================================================================================
BUILDERS = {}


def portrait(pid, emos):
    def deco(fn):
        BUILDERS.setdefault(pid, []).append((fn, emos))
        return fn
    return deco


def build_all():
    out = {}
    for pid, lst in BUILDERS.items():
        out[pid] = {}
        for fn, emos in lst:
            for e in emos:
                out[pid][e] = fn(e)
    return out


def write_js(pics):
    data = {pid: {e: p.rows() for e, p in d.items()} for pid, d in pics.items()}
    js = ['// Dialogue portraits for the recast cast (Sir Cyrus, the Curator in the Prophet\'s shape,',
          '// the Frog King, story NPCs), drawn to match the CT menu portraits in portraits_ct.js.',
          '// Built by tools/crono_lab/portraits_recast.py: 48x48, one hex colour per pixel,',
          '// CT.RECAST_PORTRAITS[id][emotion] = rows.',
          'window.CT = window.CT || {};',
          'CT.RECAST_PORTRAITS = ' + json.dumps(data, separators=(',', ':')) + ';',
          '(function () {',
          '  const set = new Set();',
          '  for (const set_ of Object.values(CT.RECAST_PORTRAITS)) for (const rows of Object.values(set_)) for (const r of rows) for (let i = 0; i < r.length; i += 6) set.add(\'#\' + r.slice(i, i + 6));',
          '  if (CT.PAL && CT.PAL.extend) CT.PAL.extend([...set]);',
          '})();', '']
    open(OUT_JS, 'w').write('\n'.join(js))


def sheet(pics, path, z=4):
    ids = list(pics)
    cols = max(len(d) for d in pics.values())
    im = Image.new('RGB', (cols * (N * z + 6) + 6, len(ids) * (N * z + 6) + 6), (40, 40, 56))
    for r, pid in enumerate(ids):
        for c, (e, p) in enumerate(pics[pid].items()):
            im.paste(p.image().resize((N * z, N * z), Image.NEAREST), (6 + c * (N * z + 6), 6 + r * (N * z + 6)))
    im.save(path)
