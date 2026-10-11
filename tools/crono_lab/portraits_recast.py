"""Dialogue portraits for the recast: Sir Cyrus (speaker id `iselle`), the Curator in the
Prophet's shape (`curator`), Spekkio in his Frog King form (`spekkio`) and the story NPCs,
drawn to sit next to the original Chrono Trigger menu portraits (portraits_ct.js).

    python3 tools/crono_lab/portraits_recast.py [preview-dir]
        -> public/js/sheets/portraits_recast.js   (CT.RECAST_PORTRAITS[id][emotion] = 48 hex rows)
        -> preview-dir/<id>.png and recast_sheet.png at 4x, when a directory is given

The painting kit (materials, 4x shapes, dithered reduction, outlines, 1x stamps) is
tools/crono_lab/portrait_kit.py.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from portrait_kit import Pic, BUILDERS, portrait, build_all, write_js, sheet  # noqa: E402

EMO6 = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'determined']

# ---- shared ramps (dark -> light) ------------------------------------------------------------
INK = '#140c1c'
SKIN = ['#401810', '#80402c', '#b8684c', '#e09c74', '#f8c8a0', '#fff0dc']
STEEL = ['#100c18', '#24222e', '#3a3848', '#565468', '#7c7a90', '#aeacc0', '#e4e2f0']
GOLD = ['#3c2408', '#704810', '#a87418', '#d8a828', '#f4d860', '#fff8c8']
PURPLE = ['#1c0c30', '#38205c', '#563490', '#7650b8', '#9c78d8', '#c8acf0']
BROWN = ['#1c0a04', '#40200c', '#683814', '#945820', '#bc8034', '#dcac60']


def eyes(p, spec, e, cmap):
    """Stamp the near (screen-left) and far eye templates for emotion e."""
    for (x, y, tab) in spec:
        rows = tab.get(e) or tab['neutral']
        p.stamp(x, y, rows, cmap)


# =========================================================================================
# SIR CYRUS, the Warden (speaker id `iselle`): the Prototype Cyrus knight, helmeted.
# =========================================================================================
CY_NEAR = {  # near eye, 6 wide; k ink, w white, i iris, I iris dark, h glint, s lid shadow
    'neutral': ['.kkkkk', 'kwhiIk', '.wiIIk', '..ss..'],
    'happy': ['......', '.kkkk.', 'k....k', '......'],
    'angry': ['kk....', '.kkkkk', '.whiIk', '..sss.'],
    'sad': ['....kk', '.kkkk.', 'kwhiIk', '.ssss.'],
    'surprised': ['.kkkk.', 'kwhiIk', 'kwiIIk', '.kkkk.'],
    'determined': ['.kkkkk', 'kkhiIk', '.wiIIk', '..ss..'],
}
CY_FAR = {
    'neutral': ['kkkk.', 'hiIwk', 'iIIw.', '.ss..'],
    'happy': ['.....', '.kkk.', 'k...k', '.....'],
    'angry': ['...kk', 'kkkk.', 'hiIw.', '.ss..'],
    'sad': ['kk...', '.kkk.', 'hiIwk', '.ss..'],
    'surprised': ['.kkk.', 'khiwk', 'kiIwk', '.kkk.'],
    'determined': ['kkkkk', 'hiIkk', 'iIIw.', '.ss..'],
}
CY_BROW_N = {'neutral': [(18, 17), (23, 16)], 'happy': [(18, 16), (23, 15)], 'angry': [(18, 15), (24, 17)],
             'sad': [(18, 17), (23, 15)], 'surprised': [(18, 15), (23, 14)], 'determined': [(18, 16), (24, 17)]}
CY_BROW_F = {'neutral': [(30, 16), (34, 17)], 'happy': [(30, 15), (34, 16)], 'angry': [(30, 17), (35, 15)],
             'sad': [(30, 15), (34, 17)], 'surprised': [(30, 14), (34, 15)], 'determined': [(30, 17), (35, 16)]}
CY_MOUTH = {
    'neutral': (24, 33, ['kkkkk']),
    'happy': (23, 32, ['k.....k', '.kkkkk.', '.kwwwk.', '..kkk..']),
    'angry': (23, 32, ['kkkkkkk', 'kwwwwwk', 'kmmmmmk', '.kkkkk.']),
    'sad': (24, 33, ['.kkk.', 'k...k']),
    'surprised': (25, 32, ['.kk.', 'kmmk', 'kmmk', '.kk.']),
    'determined': (23, 33, ['kkkkkk']),
}


def cyrus_armour(p, e):
    """Shoulders, the purple cape collar and the helmet shell shared by the helmeted set."""
    p.material('cape', PURPLE, 3, z=1, edge=True)
    p.material('plate', STEEL, 3, z=2, edge=True)
    p.material('collar', PURPLE, 3, z=3, edge=True)
    p.material('gorget', STEEL, 3, z=4, edge=True)
    p.material('beard', BROWN, 2, z=6, edge=True)
    p.material('skin', SKIN, 3, z=5, edge=True)
    p.material('helm', STEEL, 2, z=7, edge=True)
    p.material('crest', STEEL, 5, z=8, edge=True)
    p.material('gold', GOLD, 3, z=9, edge=('bg',))
    m = p.mask
    # Cape standing high behind the head and flaring over the shoulders.
    p.fill('cape', m('blob', [(2, 48), (1, 36), (5, 25), (12, 19), (24, 17), (37, 19), (44, 26), (47, 36), (48, 48)]))
    p.shade(-1, m('blob', [(30, 22), (40, 22), (46, 32), (48, 48), (36, 48)]), on=['cape'])
    p.shade(+1, m('blob', [(3, 34), (7, 26), (13, 22), (11, 30), (6, 40)]), on=['cape'])
    # Pauldrons.
    p.fill('plate', m('blob', [(-2, 48), (-1, 39), (5, 35), (14, 36), (19, 41), (20, 48)]))
    p.fill('plate', m('blob', [(30, 48), (31, 41), (37, 36), (45, 36), (50, 40), (50, 48)]))
    p.shade(+1, m('blob', [(1, 41), (6, 37), (13, 37.5), (8, 41.5)]), on=['plate'])
    p.shade(+1, m('blob', [(3, 39.5), (6, 38), (9, 38.4), (6, 39.6)]), on=['plate'])
    p.shade(+1, m('blob', [(34, 41), (38, 37.5), (45, 37.6), (40, 41.5)]), on=['plate'])
    p.shade(-1, m('blob', [(13, 44), (19, 42), (20, 48), (12, 48)]), on=['plate'])
    p.shade(-1, m('blob', [(42, 44), (48, 41), (49, 48), (40, 48)]), on=['plate'])
    # Gold rims of the pauldrons and a rivet each.
    p.fill('gold', m('stroke', [(0, 40), (5, 36.2), (13, 37), (18.5, 42)], 1.6))
    p.fill('gold', m('stroke', [(31.5, 42), (37, 37), (45, 37), (49, 40)], 1.6))
    p.fill('gold', m('ell', 9, 44, 1.6, 1.6))
    p.fill('gold', m('ell', 40, 44, 1.6, 1.6))
    # Purple collar wrapping the neck.
    p.fill('collar', m('blob', [(12, 46), (13, 37), (19, 33), (32, 33), (37, 37), (37, 46), (25, 48)]))
    p.shade(-1, m('blob', [(28, 34), (36, 37), (37, 46), (30, 47)]), on=['collar'])
    p.shade(+1, m('blob', [(14, 39), (18, 35), (20, 40), (16, 45)]), on=['collar'])
    # Gorget below the chin.
    p.fill('gorget', m('blob', [(18, 47), (17, 38), (24, 36), (32, 37), (33, 47)]))
    p.shade(-1, m('blob', [(27, 38), (33, 38), (33, 47), (28, 47)]), on=['gorget'])
    p.fill('gold', m('stroke', [(17.6, 43), (25, 41.5), (32.5, 43)], 1.3))
    p.fill('gold', m('ell', 25.3, 45.5, 1.4, 1.4))


def cyrus_helm(p, e):
    m = p.mask
    helm = [(24, 1.5), (31, 2.5), (37, 7), (40, 15), (40, 24), (38.5, 32), (35.5, 37), (31, 39.5),
            (19, 39.5), (13.5, 36), (10.5, 29), (9.5, 19), (11.5, 10), (17, 4)]
    p.fill('helm', m('blob', helm))
    # Face opening: eyes and the bearded lower face show.
    face = [(16.5, 15.5), (22, 13.8), (27, 14.2), (32, 13.8), (36.2, 15.5), (36.4, 23), (35.2, 30.5),
            (31.5, 37.6), (25.5, 39), (20, 37.6), (17, 31), (16.2, 23)]
    p.fill('skin', m('blob', face))
    # Helmet shading: lit upper-left, dark right side and under the brim.
    p.shade(+1, m('blob', [(13, 13), (16, 6), (23, 3), (22, 8), (17, 12), (14, 19)]), on=['helm'])
    p.shade(+2, m('blob', [(15, 9), (19, 5), (21, 6), (16, 10)]), on=['helm'])
    p.shade(-1, m('blob', [(33, 6), (39, 13), (40, 26), (36, 36), (33, 37), (36, 24), (36, 13)]), on=['helm'])
    p.shade(-1, m('blob', [(10, 26), (13, 33), (17, 37), (14, 37), (10.5, 31)]), on=['helm'])
    # The face under the brim is in shadow; cheekbones catch a little light.
    p.shade(-2, m('blob', [(16, 15), (36.5, 15), (36.5, 19.5), (27, 18.6), (16.5, 19.5)]), on=['skin'])
    p.shade(-1, m('blob', [(16, 18.6), (36.5, 18.6), (36.5, 24), (30, 24.5), (27, 22), (22, 24), (16.2, 24)]), on=['skin'])
    p.shade(-1, m('blob', [(31, 24), (36, 22), (35.5, 31), (32, 31)]), on=['skin'])
    p.shade(+1, m('blob', [(19, 24.3), (23, 23.8), (24.5, 26.5), (20, 27)]), on=['skin'])
    # Nose guard / crest plate: the long silver spike down the front of the sprite's helmet.
    crest = [(25.4, 1.6), (27.6, 1.8), (30.2, 8), (30.2, 17), (29.2, 24.2), (27.4, 26.8), (25.8, 24.2), (25, 17), (24.5, 8)]
    p.fill('crest', m('blob', crest))
    p.shade(-2, m('blob', [(28.3, 3), (31, 9), (30.5, 20), (28.4, 26), (28.3, 14)]), on=['crest'])
    p.shade(+1, m('blob', [(25.4, 4), (26.7, 4), (26.6, 14), (25.8, 14)]), on=['crest'])
    # Gold trim: around the face opening, along the crest, and the brow band.
    p.fill('gold', m('stroke', [(16.2, 30), (15.6, 22), (16, 15.2), (21, 13.4), (24.6, 13.4)], 1.4))
    p.fill('gold', m('stroke', [(30.8, 13.4), (33, 13.4), (37, 15), (37.2, 23), (36, 31), (32.3, 38.4)], 1.4))
    p.fill('gold', m('stroke', [(24.2, 4), (24.4, 10), (24.9, 17), (26.2, 24.6), (27.5, 27.4), (28.8, 24.6), (30.3, 17), (30.8, 10), (29.6, 4.5)], 1.0))
    p.fill('gold', m('stroke', [(11.5, 13), (16, 11.6), (21, 11.2)], 1.2))
    p.fill('gold', m('stroke', [(10.6, 31), (13.5, 35.5), (19, 39.4)], 1.2))
    p.fill('gold', m('ell', 13, 22.5, 1.5, 1.5))


def cyrus_beard(p, e):
    m = p.mask
    beard = [(17.6, 30), (20, 29.4), (23, 30.8), (25.4, 29.8), (28, 30.6), (31.5, 29.2), (35, 29.6),
             (33, 36.2), (29, 39.6), (25.4, 41.2), (21.4, 39.4), (18.6, 35)]
    p.fill('beard', m('blob', beard), on=['skin', 'helm', 'gold'])
    p.shade(-1, m('blob', [(28, 34), (34, 31), (32.5, 37), (27, 40.6)]), on=['beard'])
    p.shade(+1, m('blob', [(19, 31), (22.5, 31), (22, 34), (19.5, 34.5)]), on=['beard'])
    # Moustache over the mouth.
    p.fill('beard', m('blob', [(20.6, 30.6), (23.4, 28.8), (26.5, 29.4), (30.5, 28.8), (33.4, 30), (30, 31.4), (26.6, 30.8), (23.4, 31.6)]))
    p.shade(+1, m('blob', [(21.5, 29.8), (24.4, 29.2), (25, 30.4), (22.5, 30.8)]), on=['beard'])


def cyrus_face(p, e):
    """1x features through the visor: eyes, brows, nose, mouth."""
    cm = {'k': INK, 'w': '#e8e0e8', 'i': '#4a6ab0', 'I': '#24346c', 'h': '#fff8f0', 's': SKIN[1], 'm': '#5c1810'}
    eyes(p, [(18, 19, CY_NEAR), (30, 19, CY_FAR)], e, cm)
    for (a, b) in (CY_BROW_N[e], CY_BROW_F[e]):
        p.line([a, b], BROWN[0])
    # Nose: the tip below the nose guard, shadowed on the far side.
    p.stamp(26, 27, ['.s', 'ss', 'k.'], {'s': SKIN[2], 'k': SKIN[1]})
    mx, my, rows = CY_MOUTH[e]
    p.stamp(mx, my, rows, {'k': '#280c08', 'w': '#f0e4dc', 'm': '#802c20'})


@portrait('iselle', EMO6)
def cyrus(e):
    p = Pic('#e8e2ec', INK)
    cyrus_armour(p, e)
    cyrus_helm(p, e)
    cyrus_beard(p, e)
    p.reduce()
    p.render()
    cyrus_face(p, e)
    return p


if __name__ == '__main__':
    pics = build_all()
    write_js(pics)
    if len(sys.argv) > 1:
        os.makedirs(sys.argv[1], exist_ok=True)
        sheet(pics, os.path.join(sys.argv[1], 'recast_sheet.png'))
        for pid in pics:
            sheet({pid: pics[pid]}, os.path.join(sys.argv[1], pid + '.png'))
    print('wrote', ', '.join('%s(%d)' % (k, len(v)) for k, v in pics.items()))
