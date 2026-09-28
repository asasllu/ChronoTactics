"""Build public/js/sheets/crono.js from the Chrono Trigger Crono sprite sheet
(ripped by Tonberry2k, The Spriters Resource), supplied by the user.

    python3 tools/crono_lab/rip_crono.py <sheet.png>

Frames are cut from the sheet by their positions (FRAMES), anchored at the feet (the
lowest non-sword row, centred on the feet), and laid into one sheet canvas. The game's
views: 'se' (facing screen-right, towards the viewer) uses the front sprites for standing
and walking and the side sprites (which face left on the sheet, so they are mirrored) for
battle moves; 'ne' (facing away) uses the back sprites and the same mirrored side moves.
"""
import json, sys
from PIL import Image

SHEET = sys.argv[1]
OUT = 'public/js/sheets/crono.js'
BG = (255, 0, 255)
SWORD = {(80, 248, 184), (8, 57, 57), (248, 248, 248)}
W, H, AX, AY = 72, 72, 36, 66  # canvas and anchor (ground point between the feet)

# Sprite boxes on the sheet (x0, y0, x1, y1), inclusive; found by connected components.
FR = json.load(open('tools/crono_lab/rip/crono_frames.json'))
EXTRA = {'F0': [59, 14, 74, 48], 'S0': [59, 98, 72, 131]}

im = Image.open(SHEET).convert('RGB')


def box(fid):
    return EXTRA[fid] if isinstance(fid, str) else FR[fid][:4]


def grab(fid, flip):
    x0, y0, x1, y1 = box(fid)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    px = [[im.getpixel((x0 + x, y0 + y)) for x in range(w)] for y in range(h)]
    px = [[None if p == BG else p for p in row] for row in px]
    if flip:
        px = [row[::-1] for row in px]
    # Feet: lowest row holding body pixels; centre on the body pixels of the bottom 4 rows.
    body = [(x, y) for y in range(h) for x in range(w) if px[y][x] and px[y][x] not in SWORD]
    fy = max(y for _, y in body)
    feet = [x for x, y in body if y >= fy - 3]
    fx = round((min(feet) + max(feet)) / 2)
    return px, fx, fy


# Animation map: name -> (view, [(frame, ms, flip, dx, dy)], extras). Frame ids index
# frames.json (sheet order) or EXTRA. Side frames face left on the sheet: flip=True.
F, B, S = False, False, True  # readability: front/back frames unflipped, side flipped
ANIMS = {}


def anim(view, name, frames, **extra):
    ANIMS.setdefault(view, {})[name] = (frames, extra)


def build(mapping):
    for view, name, frames, extra in mapping:
        anim(view, name, frames, **extra)
    colours = {}
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    out = {'se': {}, 'ne': {}}
    for view, anims in ANIMS.items():
        for name, (frames, extra) in anims.items():
            fl = []
            for f in frames:
                fid, ms = f[0], f[1]
                flip = f[2] if len(f) > 2 else False
                dx = f[3] if len(f) > 3 else 0
                dy = f[4] if len(f) > 4 else 0
                px, fx, fy = grab(fid, flip)
                at = [AX - fx, AY - fy]
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
                fr = {'ms': ms, 'at': at, 'rows': rows}
                if dx: fr['dx'] = dx
                if dy: fr['dy'] = dy
                fl.append(fr)
            a = {'frames': fl}
            a.update(extra)
            out[view][name] = a
    pal = {v: '#%02x%02x%02x' % k for k, v in colours.items()}
    js = ['// Crono: frames from the Chrono Trigger sprite sheet ripped by Tonberry2k',
          '// (The Spriters Resource), supplied by the user. Built by tools/crono_lab/rip_crono.py.',
          'CT.sheet(\'crono\', ' + json.dumps({'pal': pal, 'w': W, 'h': H, 'anchor': [AX, AY], 'head': [AX, AY - 26],
                                             'se': out['se'], 'ne': out['ne']}, separators=(',', ':')) + ');', '']
    open(OUT, 'w').write('\n'.join(js))
    print('wrote', OUT, len(colours), 'colours')


# ---- The map -----------------------------------------------------------------------------
A = S  # side frame, mirrored to face right
M = [
    # front view (se)
    ('se', 'idle', [('F0', 420), (0, 260), (1, 420), (0, 260)], {'loop': True}),
    ('se', 'walk', [(i, 110) for i in (2, 3, 4, 5, 6, 7)], {'loop': True}),
    ('se', 'attack', [(21, 120, A), (47, 130, A), (50, 60, A), (51, 170, A), (48, 120, A), (21, 140, A)], {'hit': 3}),
    ('se', 'cast', [(136, 160), (137, 160), (145, 220), (0, 200)],
     {'charge': [0, 1], 'release': 2, 'rim': '#fff4b0', 'glow': [[AX, AY - 40]] * 3}),
    ('se', 'hurt', [(82, 220, A), (21, 160, A)], {}),
    ('se', 'ko', [(82, 160, A), (157, 1000, A)], {}),
    ('se', 'kneel', [(115, 1000, A)], {'loop': True}),
    ('se', 'victory', [(98, 300), (99, 300), (100, 300), (99, 300)], {'loop': True}),
    ('se', 'jump', [(41, 120), (43, 140, F, 0, -8), (44, 160, F, 0, -14), (41, 140)], {}),
    ('se', 'tech_cyclone', [(21, 90, A), (104, 70, A), (105, 70, A), (106, 70, A), (94, 70, A), (95, 70, A),
                            (104, 70, A), (105, 70, A), (106, 90, A), (21, 150, A)], {'hit': 3}),
    ('se', 'tech_slash', [(58, 150, A), (59, 60, A), (60, 170, A), (61, 100, A), (62, 140, A), (21, 120, A)], {'hit': 2}),
    ('se', 'tech_spincut', [(21, 120, A), (80, 110, A, 2, -10), (96, 100, A, 4, -20), (97, 100, A, 8, -14),
                            (108, 190, A, 10, 0), (21, 150, A)], {'hit': 4}),
    ('se', 'tech_luminaire', [(0, 160), (124, 160), (124, 160), (125, 260), (0, 200)],
     {'charge': [1, 2], 'release': 3, 'hit': 3, 'rim': '#fff4b0', 'glow': [[AX, AY - 44]] * 4}),
    ('se', 'draw_sword', [(35, 140, A), (36, 120, A), (37, 200, A), (21, 200, A)], {}),
    ('se', 'nod', [(0, 150), (52, 200), (0, 200)], {}),
    ('se', 'shake_head', [(0, 120), (56, 120, A), (0, 100), (56, 120), (0, 150)], {}),
    ('se', 'point', [(128, 300, A), (129, 500, A)], {}),
    # back view (ne)
    ('ne', 'idle', [(14, 420), (14, 420)], {'loop': True}),
    ('ne', 'walk', [(i, 110) for i in (15, 16, 17, 18, 19, 20)], {'loop': True}),
    ('ne', 'victory', [(101, 300), (102, 300), (103, 300), (102, 300)], {'loop': True}),
    ('ne', 'cast', [(138, 160), (139, 160), (147, 220), (14, 200)],
     {'charge': [0, 1], 'release': 2, 'rim': '#fff4b0', 'glow': [[AX, AY - 40]] * 3}),
    ('ne', 'tech_luminaire', [(14, 160), (126, 160), (126, 160), (127, 260), (14, 200)],
     {'charge': [1, 2], 'release': 3, 'hit': 3, 'rim': '#fff4b0', 'glow': [[AX, AY - 44]] * 4}),
    ('ne', 'nod', [(14, 150), (54, 200), (14, 200)], {}),
]
# Battle moves drawn in profile read the same from behind: reuse them in ne.
for view, name, frames, extra in list(M):
    if view == 'se' and name not in ('idle', 'walk', 'victory', 'cast', 'tech_luminaire', 'nod', 'shake_head', 'point'):
        M.append(('ne', name, frames, extra))
build(M)
