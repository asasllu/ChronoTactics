"""Build the NPC sheets (public/js/sheets/<key>.js) from the Chrono Trigger NPC sprite sheet
supplied by the user (tools/crono_lab/rip/assets/npcs.png, The Spriters Resource).

    python3 tools/crono_lab/rip_npcs.py [key ...]      # default: every NPC below

Frame ids below are the GLOBAL ids of the whole sheet, as numbered by
`python3 tools/crono_lab/rip_lib.py segment npc_all` on rip/npc_all_sheet.png (a copy of
npcs.png; see rip/npc_all_labels*.png). For each NPC the script:
  1. pastes its chosen frames (front row, back row, side row, extras) onto a green sheet,
     rip/npc_<key>_sheet.png, and segments it (rip/npc_<key>_frames.json + labels);
  2. maps the global ids onto that sheet's frames and builds the game sheet with rip_lib.Sheet,
     registered as CT.sheet('<key>') with the same animation names as the old hand-drawn sheet.

Views: se = the FRONT (down-facing) sprites, ne = the BACK sprites. CT NPC rows are
[stand, step, step] (or stand + 4 steps); walk cycles the steps through the stand pose.
Talk, idle breathing and bows use a 'move' op on a copy of the stand frame (the head or
the upper body drops a pixel or two), so the frames stay the original CT pixels.
"""
import json, os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rip_lib
from rip_lib import Sheet, segment, RIP, HERE

ALL = 'npc_all'
SRC = os.path.join(RIP, 'assets', 'npcs.png')
CREDIT = '(NPCs)'

# who: which CT sprite; f/b/s: front, back, side frame ids (first = stand); x: extra frames.
# neck: rows from the top of the sprite that bob for talk; chest: rows that drop when breathing.
NPCS = {
    # ---- 600 A.D. Guardia -------------------------------------------------------------
    'king': dict(who='gold-armoured, red-caped Guardia knight (no King Guardia sprite on the sheet)',
                 f=[373, 374, 375, 376, 377], b=[404, 405, 406, 407, 408], s=[434, 435, 436, 437], x=[461],
                 neck=11, chest=16, size=(48, 60, 24, 57)),
    'leene': dict(who='red-haired court lady in the gold gown (closest regal woman; no Queen Leene sprite)',
                  f=[279, 280, 281], b=[317, 318, 319], s=[349, 350, 351], neck=10, chest=14, size=(48, 60, 24, 57)),
    'guard': dict(who='Guardia soldier, teal helmet', f=[383, 384, 385], b=[414, 415, 416], s=[442, 443, 444],
                  x=[495, 467], neck=11, chest=15, size=(48, 60, 24, 57)),
    'villager_600': dict(who='capped townsman, orange shirt, arms folded', f=[514, 515, 516], b=[544, 545, 546],
                         s=[563, 564, 565], neck=11, chest=15, size=(48, 58, 24, 54)),
    'villager_600_b': dict(who='maid, blue hair, pink dress and apron', f=[395, 396, 397], b=[425, 426, 427],
                           s=[452, 453, 454], x=[477, 496, 497], neck=11, chest=15, size=(48, 58, 24, 54)),
    'villager_600_c': dict(who='bald old man with a white beard and cane, green coat', f=[505, 506, 507],
                           b=[535, 536, 537], s=[554, 555, 556], neck=11, chest=15, size=(48, 58, 24, 54)),
    # ---- End of Time ------------------------------------------------------------------
    'gaspar': dict(who='bald old man with a white beard and cane, brown coat over a blue robe',
                   f=[508, 509, 510], b=[538, 539, 540], s=[557, 558, 559], neck=11, chest=15,
                   size=(48, 60, 24, 57)),
    # ---- 65,000,000 B.C. ----------------------------------------------------------------
    'kino': dict(who='red-haired caveman with a club (Kino)', f=[4, 5, 6, 7], b=[41, 42, 43, 44],
                 s=[64, 65, 66, 67], x=[114, 115, 116], steps=4, neck=12, chest=16, size=(48, 60, 24, 57)),
    'villager_ioka': dict(who='purple-haired caveman with a club', f=[0, 1, 2, 3], b=[37, 38, 39, 40],
                          s=[60, 61, 62, 63], x=[111, 112, 113], steps=4, neck=12, chest=16, size=(48, 58, 24, 54)),
    'villager_ioka_b': dict(who='purple-haired cave woman', f=[8, 9, 10, 11, 12], b=[45, 46, 47, 48],
                            s=[68, 69, 70, 71, 72], x=[117, 118], neck=11, chest=15, size=(48, 58, 24, 54)),
    'villager_ioka_c': dict(who='feather-crowned, white-bearded cave elder', f=[24, 25, 26], b=[34, 35, 36],
                            s=[78, 79, 80], neck=12, chest=15, size=(48, 58, 24, 54)),
    # ---- 12,000 B.C. (Earthbound Ones) ------------------------------------------------------
    'elder': dict(who='white-haired Earthbound elder with a cane', f=[694, 695, 696], b=[719, 720, 721],
                  s=[745, 746, 747], x=[697], neck=10, chest=14, size=(48, 60, 24, 57)),
    'villager_last': dict(who='Earthbound man in a brown cloak and green scarf', f=[681, 682, 683],
                          b=[709, 710, 711], s=[736, 737, 738], x=[684], neck=11, chest=15, size=(48, 58, 24, 54)),
    'villager_last_b': dict(who='long-haired Earthbound woman in a brown cloak', f=[685, 686, 687, 688, 689],
                            b=[712, 713, 714, 715, 716], s=[739, 740, 741, 744, 742], neck=11, chest=15,
                            size=(48, 58, 24, 54)),
    'villager_last_c': dict(who='spiky-haired, bearded Earthbound commoner (Zeal undercity)', f=[150, 151, 152],
                            b=[185, 186, 187], s=[214, 215, 216], neck=11, chest=15, size=(48, 58, 24, 54)),
    # ---- 1000 A.D. Millennial Fair ----------------------------------------------------------
    'fairgoer': dict(who='Taban (big man with the arm cannon)', f=[524, 525, 526], b=[591, 592, 593],
                     s=[573, 574, 575], x=[621, 622, 623, 651, 652], neck=12, chest=16, size=(48, 60, 24, 57)),
    'fairgoer_b': dict(who='orange-haired girl with a green bow', f=[613, 614, 615, 616], b=[643, 644, 645, 646],
                       s=[671, 672, 673, 674], x=[617, 618, 619, 620], steps=4, neck=11, chest=14,
                       size=(48, 60, 24, 57)),
    'fairgoer_c': dict(who='orange-haired boy', f=[609, 610, 611, 612], b=[639, 640, 641, 642],
                       s=[667, 668, 669, 670], x=[676], steps=4, neck=11, chest=14, size=(48, 60, 24, 57)),
    'fairgoer_d': dict(who='white-haired woman in a long blue robe', f=[282, 283], b=[320, 321], s=[352, 353],
                       neck=10, chest=14, size=(48, 60, 24, 57)),
}


def compose(key, spec, frames):
    """Paste the chosen frames, one row per group, bottom-aligned, onto a green sheet."""
    src = Image.open(SRC).convert('RGB')
    bg = rip_lib.background(src)
    groups = [g for g in (spec['f'], spec['b'], spec['s'], spec.get('x', [])) if g]
    gap = 8
    W = gap + max(sum(frames[i][2] - frames[i][0] + 1 + gap for i in g) for g in groups)
    rowh = [max(frames[i][3] - frames[i][1] + 1 for i in g) for g in groups]
    H = gap + sum(h + gap for h in rowh)
    out = Image.new('RGB', (W, H), bg)
    where = {}
    y = gap
    for g, h in zip(groups, rowh):
        x = gap
        for i in g:
            x0, y0, x1, y1 = frames[i]
            w, hh = x1 - x0 + 1, y1 - y0 + 1
            out.paste(src.crop((x0, y0, x1 + 1, y1 + 1)), (x, y + h - hh))
            where[i] = [x, y + h - hh, x + w - 1, y + h - 1]
            x += w + gap
        y += h + gap
    out.save(os.path.join(RIP, f'npc_{key}_sheet.png'))
    return where


def overlap(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]) + 1)
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]) + 1)
    ar = lambda r: (r[2] - r[0] + 1) * (r[3] - r[1] + 1)
    return ix * iy / float(ar(a) + ar(b) - ix * iy)


class NpcSheet(Sheet):
    """rip_lib.Sheet with: global ids, frames that copy another frame and move rows
    ('bob' frames), and a sheet key that differs from the rip file key."""

    def __init__(self, key, spec, where):
        W, H, AX, AY = spec['size']
        super().__init__('npc_' + key, w=W, h=H, ax=AX, ay=AY, credit=CREDIT)
        self.game_key = key
        self.spec = spec
        # global id -> local frame id (or an extra box when segmentation disagrees)
        self.g2l = {}
        for gid, box in where.items():
            best = max(range(len(self.fr)), key=lambda n: overlap(self.fr[n], box))
            if overlap(self.fr[best], box) > 0.97:
                self.g2l[gid] = best
            else:
                print(f'  {key}: frame {gid} re-segmented as {self.fr[best]}, using box {box}')
                self.extra[f'g{gid}'] = box
                self.g2l[gid] = f'g{gid}'

    def grab(self, fid, flip):
        """Feet row as in rip_lib, but x centred on the median of the upper body: CT walk
        cycles keep the head and torso still while the feet step out to either side."""
        px, fx, fy = super().grab(fid, flip)
        xs = sorted(x for y, row in enumerate(px[:max(1, int(len(px) * 0.6))]) for x, p in enumerate(row) if p)
        return px, (xs[len(xs) // 2] if xs else fx), fy

    def build(self):
        out = os.path.join(HERE, '..', '..', 'public', 'js', 'sheets', self.game_key + '.js')
        colours = {}
        letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        res = {'se': {}, 'ne': {}}
        tops = {}
        stand_h = None
        for view, anims in self.anims.items():
            for name, (frames, extra) in anims.items():
                fl = []
                for n, f in enumerate(frames):
                    if isinstance(f, dict):  # copy of another frame with rows moved down
                        bv, ba, bi = f['base']
                        top = tops[(bv, ba, bi)]
                        fr = {'ms': f['ms'], 'base': (f'{bv}:' if bv != view else '') + f'{ba}.{bi}',
                              'draw': [['move', 0, 0, self.W, top + f['rows'], 0, f['by']]]}
                        for k in ('dx', 'dy'):
                            if f.get(k):
                                fr[k] = f[k]
                        tops[(view, name, n)] = top
                        fl.append(fr)
                        continue
                    gid, ms = f[0], f[1]
                    flip = f[2] if len(f) > 2 else False
                    dx = f[3] if len(f) > 3 else 0
                    dy = f[4] if len(f) > 4 else 0
                    px, fx, fy = self.grab(self.g2l[gid], flip)
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
                    at = [self.AX - fx, self.AY - fy]
                    tops[(view, name, n)] = at[1]
                    if gid == self.spec['f'][0] and stand_h is None:
                        stand_h = fy + 1
                    fr = {'ms': ms, 'at': at, 'rows': rows}
                    if dx:
                        fr['dx'] = dx
                    if dy:
                        fr['dy'] = dy
                    fl.append(fr)
                a = {'frames': fl}
                a.update(extra)
                res[view][name] = a
        pal = {v: '#%02x%02x%02x' % k for k, v in colours.items()}
        head = [self.AX, self.AY - (stand_h or 32) + 8]
        body = {'pal': pal, 'w': self.W, 'h': self.H, 'anchor': [self.AX, self.AY],
                'head': head, 'se': res['se'], 'ne': res['ne']}
        js = [f'// {self.game_key}: {self.spec["who"]}. Frames from the Chrono Trigger NPC sprite sheet',
              '// (The Spriters Resource), supplied by the user. Built by tools/crono_lab/rip_npcs.py.',
              f"CT.sheet('{self.game_key}', " + json.dumps(body, separators=(',', ':')) + ');', '']
        open(out, 'w').write('\n'.join(js))
        print('wrote', os.path.normpath(out), len(colours), 'colours')


def bob(view, anim, i, rows, by, ms, **kw):
    """A copy of frame i of view/anim with its top `rows` rows moved down `by` pixels."""
    return dict(base=(view, anim, i), rows=rows, by=by, ms=ms, **kw)


def base_anims(s, spec):
    """idle, walk, talk in both views (talk se only) from the stand + step frames."""
    for view, row in (('se', spec['f']), ('ne', spec['b'])):
        st = row[0]
        steps = spec.get('steps', 0)
        if steps == 4 or len(row) == 4:      # stand + 3 / 4 steps in order
            walk = [(i, 110) for i in row]
        elif len(row) == 5:                  # stand + 4 steps
            walk = [(i, 110) for i in row[1:]]
        elif len(row) == 3:                  # stand, step, step
            walk = [(row[1], 120), (st, 100), (row[2], 120), (st, 100)]
        else:                                # stand, step
            walk = [(row[1], 150), (st, 150)]
        s.add(view, 'idle', [(st, 1500), bob(view, 'idle', 0, spec['chest'], 1, 380),
                             (st, 1300), bob(view, 'idle', 0, spec['chest'], 1, 380)], loop=True)
        s.add(view, 'walk', walk, loop=True)
    st = spec['f'][0]
    s.add('se', 'talk', [(st, 200), bob('se', 'talk', 0, spec['neck'], 1, 170), (st, 150),
                         bob('se', 'talk', 0, spec['neck'], 1, 190)], loop=True)


def spin(spec):
    """Turn on the spot (front, side, back, mirrored side) twice with a little hop."""
    F, B, S = spec['f'][0], spec['b'][0], spec['s'][0]
    seq = [(F, 0), (S, 0), (B, 0), (S, 1), (F, 0), (S, 0), (B, 0), (S, 1), (F, 0)]
    dys = [0, -2, -3, -4, -3, -2, -1, 0, 0]
    ms = [90, 70, 70, 70, 70, 70, 80, 90, 240]
    return [(i, m, bool(fl), 0, d) for (i, fl), m, d in zip(seq, ms, dys)]


def jump(spec, peak=None):
    st = spec['f'][0]
    pk = peak if peak is not None else st
    return [(st, 90), (pk, 130, False, 0, -7), (pk, 110, False, 0, -4), (st, 110)]


def build(key):
    spec = NPCS[key]
    frames = json.load(open(os.path.join(RIP, ALL + '_frames.json')))
    where = compose(key, spec, frames)
    segment('npc_' + key)
    s = NpcSheet(key, spec, where)
    base_anims(s, spec)
    F, B = spec['f'][0], spec['b'][0]
    x = spec.get('x', [])
    if key in ('king', 'leene'):   # a bow of the head (no bow frames on the sheet)
        for view, st in (('se', F), ('ne', B)):
            s.add(view, 'bow', [(st, 160), bob(view, 'bow', 0, spec['neck'] + 2, 2, 520),
                                bob(view, 'bow', 0, spec['neck'], 1, 200)])
    elif key == 'guard':           # 495: the soldier's head bowed under the helmet
        s.add('se', 'salute', [(F, 90), (495, 140), (495, 520), (495, 160), (F, 100)])
    elif key == 'kino':            # 114 arms up, 115 crouched, 116 curled up
        s.add('se', 'talk', [(F, 220), bob('se', 'talk', 0, spec['neck'], 1, 170), (F, 160), (114, 200)], loop=True)
        for view in ('se', 'ne'):
            s.add(view, 'kneel', [(115, 420), bob(view, 'kneel', 0, 10, 1, 360)], loop=True)
    elif key.startswith('villager'):
        peak = {'villager_ioka': 111, 'villager_ioka_b': 117, 'villager_600_b': 497}.get(key)
        s.add('se', 'jump', jump(spec, peak))
        if key in ('villager_ioka', 'villager_ioka_c'):   # story.js plays 'spin' on them
            s.add('se', 'spin', spin(spec))
    elif key.startswith('fairgoer'):
        s.add('se', 'spin', spin(spec))
        cheer = {
            'fairgoer': [(621, 150), (622, 170, False, 0, -3), (623, 150)],
            'fairgoer_b': [(617, 110), (620, 170, False, 0, -4), (618, 110)],
            'fairgoer_c': [(F, 110), (676, 170, False, 0, -4), (F, 110)],
            'fairgoer_d': [(F, 110), (F, 170, False, 0, -3), (F, 110)],
        }[key]
        s.add('se', 'cheer', cheer, loop=True)
        if key == 'fairgoer':      # Taban talks with his hands
            s.add('se', 'talk', [(F, 200), (651, 220), (F, 160), (652, 220)], loop=True)
    s.build()


if __name__ == '__main__':
    if not os.path.exists(os.path.join(RIP, ALL + '_frames.json')):
        Image.open(SRC).save(os.path.join(RIP, ALL + '_sheet.png'))
        segment(ALL)
    for k in sys.argv[1:] or NPCS:
        build(k)
