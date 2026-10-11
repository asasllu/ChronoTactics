"""Build public/js/sheets/lizardactyl.js from the Chrono Trigger Avian Rex / Lizardactyl
sheet (ripped by Nemu, The Spriters Resource) supplied by the user
(tools/crono_lab/rip/assets/avian_rex_lizardactyl.png). The Avian Rex is the same sprite in
gold; rip_avian_rex.py reuses this file.

    python3 tools/crono_lab/rip_lizardactyl.py crop   # re-cut rip/{lizardactyl,avian_rex}_sheet.png
    python3 tools/crono_lab/rip_lib.py segment lizardactyl
    python3 tools/crono_lab/rip_lizardactyl.py

Frame ids (rip/lizardactyl_labels0.png):
  0-2 facing left, front 3/4: wings up, level, down    3-5 the same facing right
  6-8 back 3/4 facing left-away                         9-11 the same facing right-away
  12 hurt: tumbling, dazed (sparkles)
The wings of neighbouring sprites reach into each other's boxes, so a frame keeps only the
connected blobs that lie mostly inside its box. Fliers are anchored on the body (the centre
of the body-coloured pixels) and hover HOVER px above the ground point.
"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from rip_lib import Sheet, RIP  # noqa: E402

ASSET = os.path.join(RIP, 'assets', 'avian_rex_lizardactyl.png')
CREDIT = 'ripped by Nemu'
# Body (not wing membrane) colours: the anchor is the centre of these pixels.
BODY = {'lizardactyl': {(112, 56, 152), (128, 88, 200), (152, 128, 248), (184, 184, 248)},
        'avian_rex': {(128, 96, 16), (168, 136, 32), (216, 184, 48), (248, 232, 104)}}
W, H, AX, AY = 96, 96, 48, 90
# Flap frames registered on the wings-level frame of the same facing.
ALIGN = {3: 4, 5: 4, 9: 10, 11: 10, 0: 1, 2: 1, 6: 7, 8: 7}
LIFT = 34  # body centre this many px above the ground point (tail tip ~6 px off the ground)


def crop():
    src = Image.open(ASSET).convert('RGB')
    for key, (y0, y1), (bx0, by0, bx1, by1) in (('avian_rex', (0, 164), (52, 122, 140, 141)),
                                                 ('lizardactyl', (164, 340), (50, 292, 266, 340))):
        q = src.crop((0, y0, src.width, y1)).copy()
        px = q.load()
        for y in range(by0 - y0, by1 - y0):  # name label (and the ripper's credit line)
            for x in range(bx0, bx1):
                px[x, y] = (255, 0, 255)
        q.save(os.path.join(RIP, key + '_sheet.png'))
        print('wrote', key + '_sheet.png')


def components(im, bg):
    """8-connected blobs of non-background pixels: list of pixel lists."""
    W_, H_ = im.size
    px = im.load()
    seen = set()
    out = []
    for y in range(H_):
        for x in range(W_):
            if px[x, y] != bg and (x, y) not in seen:
                st, pts = [(x, y)], []
                seen.add((x, y))
                while st:
                    a, b = st.pop()
                    pts.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            X, Y = a + dx, b + dy
                            if 0 <= X < W_ and 0 <= Y < H_ and px[X, Y] != bg and (X, Y) not in seen:
                                seen.add((X, Y))
                                st.append((X, Y))
                out.append(pts)
    return out


def masks(key):
    """Per frame id: the set of sheet pixels that belong to it (blobs mostly inside its box)."""
    import json
    im = Image.open(os.path.join(RIP, key + '_sheet.png')).convert('RGB')
    fr = json.load(open(os.path.join(RIP, key + '_frames.json')))
    comps = components(im, (255, 0, 255))
    res = []
    for x0, y0, x1, y1 in fr:
        m = set()
        for c in comps:
            inside = sum(1 for x, y in c if x0 <= x <= x1 and y0 <= y <= y1)
            if inside * 2 > len(c):
                m.update(c)
        res.append(m)
    return res


class FlierSheet(Sheet):
    def __init__(self, key, frame_masks, **k):
        self.masks = frame_masks  # per id: set of (x, y) on this key's sheet
        super().__init__(key, w=W, h=H, ax=AX, ay=AY, **k)
        self.body = BODY[key]

    def grab(self, fid, flip):
        m = self.masks[fid]
        x0 = min(x for x, _ in m); y0 = min(y for _, y in m)
        x1 = max(x for x, _ in m); y1 = max(y for _, y in m)
        w, h = x1 - x0 + 1, y1 - y0 + 1
        px = [[self.im.getpixel((x0 + x, y0 + y)) if (x0 + x, y0 + y) in m else None for x in range(w)] for y in range(h)]
        px = [[None if p == self.bg else p for p in row] for row in px]
        if flip:
            px = [row[::-1] for row in px]
        cx, cy = self.centre(fid, px)
        # build() places the frame at [AX - fx, AY - fy]: put the body centre LIFT px up.
        return px, cx, cy + LIFT

    def centre(self, fid, px):
        """Body centre. Flap frames are registered on their reference frame (ALIGN) by the
        shift that best overlaps their body pixels, so the torso holds still while the wings
        move; other frames use the centre of their body-coloured pixels."""
        h, w = len(px), len(px[0])
        body = {(x, y): px[y][x] for y in range(h) for x in range(w) if px[y][x] in self.body}
        ref = ALIGN.get(fid)
        if ref is None or ref == fid:
            return (round(sum(x for x, _ in body) / len(body)), round(sum(y for _, y in body) / len(body)))
        rpx = self.grab(ref, False)[0]
        rcx, rcy = self.centre(ref, rpx)
        rbody = {(x, y): rpx[y][x] for y in range(len(rpx)) for x in range(len(rpx[0])) if rpx[y][x] in self.body}
        best = max(((sum(1 for (x, y), c in body.items() if rbody.get((x + sx, y + sy)) == c), -abs(sx) - abs(sy), sx, sy)
                    for sx in range(-16, 17) for sy in range(-16, 17)))
        _, _, sx, sy = best
        return rcx - sx, rcy - sy


def anims(s, fire=False):
    """Shared flier moves. se = facing right (frames 3-5), ne = right-away (9-11)."""
    for view, (up, mid, down) in (('se', (3, 4, 5)), ('ne', (9, 10, 11))):
        # Hover: a slow flap; the down-stroke lifts the body.
        s.add(view, 'idle', [(up, 200, False, 0, -1), (mid, 150, False, 0, 0), (down, 200, False, 0, -2),
                             (mid, 150, False, 0, -1)], loop=True)
        s.add(view, 'walk', [(up, 110, False, 0, 0), (mid, 90, False, 1, -1), (down, 110, False, 1, -2),
                             (mid, 90, False, 0, -1)], loop=True)
        # Rear up, then a diving bite/claw.
        s.add(view, 'attack', [(up, 160, False, -2, -4), (mid, 80, False, 2, -2), (down, 160, False, 9, 2),
                               (mid, 100, False, 6, 0), (up, 140, False, 1, -2)], hit=2)
        s.add(view, 'hurt', [(12, 180, False, -3, -2), (mid, 220, False, -1, 0)])
        # Knocked out of the air: tumble and drop to the ground, holding the dazed frame.
        s.add(view, 'ko', [(12, 180, False, -2, -3), (12, 110, False, -3, 3), (12, 100, False, -4, 7),
                           (12, 900, False, -4, 9)])
        if fire:
            # Rear back with the wings raised, then lunge open-winged, jaws forward (fire leaves here).
            s.add(view, 'tech_fire_breath', [(up, 160, False, 0, -2), (up, 220, False, -4, -7), (mid, 120, False, -2, -4),
                                             (mid, 240, False, 5, 1), (down, 220, False, 6, 2), (up, 180, False, 1, -1)],
                  hit=3, release=3)
        else:
            # Swoop dive: climb, fold the wings and dive forward and down, strike, pull up.
            s.add(view, 'tech_roll', [(mid, 150, False, 0, 0), (down, 100, False, -2, -6), (up, 120, False, -4, -14),
                                      (mid, 80, False, -3, -16), (down, 60, False, 2, -10), (down, 60, False, 8, -3),
                                      (mid, 160, False, 14, 3), (up, 80, False, 12, -3), (mid, 80, False, 8, -6),
                                      (down, 90, False, 4, -4), (mid, 140, False, 0, 0)], hit=6)


def build(key, frame_masks, fire):
    s = FlierSheet(key, frame_masks, credit=CREDIT)
    anims(s, fire)
    s.build(head=[AX, AY - LIFT - 8])


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'crop':
        crop()
    else:
        build('lizardactyl', masks('lizardactyl'), fire=False)
