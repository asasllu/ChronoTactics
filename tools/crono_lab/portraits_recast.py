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
    p.shade(-1, m('blob', [(31, 41), (40, 36), (50, 39), (50, 48), (30, 48)]), on=['gold'])
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
    # Shade the trim with the helmet: bright on the lit upper left, dull on the far side.
    p.shade(-1, m('blob', [(30, 14), (38, 13), (39, 30), (33, 39), (30, 38), (35, 30)]), on=['gold'])
    p.shade(-1, m('blob', [(28.4, 3), (31.4, 9), (31, 20), (28.6, 27.6), (29, 14)]), on=['gold'])
    p.shade(+1, m('blob', [(10, 12), (16, 10), (22, 10.4), (17, 13), (15, 20), (13, 20)]), on=['gold'])
    p.shade(-1, m('blob', [(10, 29), (14, 33), (20, 38), (20, 41), (12, 37)]), on=['gold'])
    # Rim light along the near edge of the dome.
    p.shade(+2, m('stroke', [(11.4, 26), (10.8, 18), (12.6, 11), (16, 6.5)], 1.1), on=['helm'])
    # The crest throws a shadow across the far cheek.
    p.shade(-1, m('blob', [(29, 19), (31.5, 19), (31, 26), (29, 29), (28, 25)]), on=['skin'])


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


# Helmet off: the man under the armour (the unarmoured Cyrus at the bottom of cyrus.png),
# brown swept-back hair and beard, tired and redeemed.
LEATHER = ['#2c1408', '#583014', '#86521e', '#b07c34', '#d8aa58', '#f4d898']


@portrait('iselle', ['broken'])
def cyrus_broken(e):
    p = Pic('#e8e2ec', INK)
    m = p.mask
    p.material('plate', STEEL, 3, z=2, edge=True)
    p.material('strap', LEATHER, 3, z=3, edge=True)
    p.material('neck', SKIN, 3, z=4, edge=True)
    p.material('hair', BROWN, 1, z=5, edge=True)
    p.material('ear', SKIN, 3, z=6, edge=True)
    p.material('skin', SKIN, 3, z=7, edge=True)
    p.material('beard', BROWN, 2, z=8, edge=True)
    p.material('fringe', BROWN, 3, z=9, edge=True)
    # Shoulders: dark plate with the leather harness of the sprite.
    p.fill('plate', m('blob', [(-2, 48), (-1, 40), (6, 36), (16, 36.5), (24, 38), (33, 36.5), (43, 36), (50, 40), (50, 48)]))
    p.shade(+1, m('blob', [(1, 41), (6, 37.4), (13, 37.6), (8, 41.4)]), on=['plate'])
    p.shade(+1, m('blob', [(35, 40.5), (40, 37.4), (46, 38), (41, 41.5)]), on=['plate'])
    p.shade(-1, m('blob', [(26, 44), (36, 41), (50, 43), (50, 48), (26, 48)]), on=['plate'])
    p.fill('strap', m('stroke', [(8, 48), (16, 41), (24, 38.5)], 3.2))
    p.fill('strap', m('stroke', [(22, 48), (30, 41.5), (38, 37.5)], 3.0))
    p.fill('strap', m('blob', [(18, 41), (30, 40), (31, 44), (18, 45)]))
    p.shade(-1, m('blob', [(27, 40), (40, 37), (40, 48), (25, 48)]), on=['strap'])
    p.shade(+1, m('stroke', [(9, 46.6), (16, 40.4), (22, 38.6)], 1.0), on=['strap'])
    # Neck.
    p.fill('neck', m('blob', [(19, 30), (31, 30), (32, 40), (25, 42), (18.5, 40)]))
    p.shade(-1, m('blob', [(18, 30), (33, 30), (32, 36), (25, 38), (18, 35)]), on=['neck'])
    # Hair: a dark mass, then tapered locks swept up and back (the sprite's spiky brown crown),
    # each its own material so a dark line separates it from the lock behind.
    p.fill('hair', m('blob', [(8, 32), (6.5, 22), (8, 12), (13, 6), (21, 3.5), (30, 4), (36, 7.5), (39, 13),
                              (38, 18), (34, 13), (28, 11.2), (21, 12), (17, 15), (15.5, 22), (13, 29), (10.5, 34)]))
    p.shade(-1, m('blob', [(6, 24), (12, 26), (11, 34), (7, 33)]), on=['hair'])
    locks = [((13, 20), (15, 30), (7, 34), -1), ((12, 13), (15, 23), (4, 23.5), 0.5),
             ((14, 8), (17, 17), (4.2, 11.6), 1.5), ((19, 6), (20, 14), (8, 3.4), 1.5),
             ((24.5, 5), (24, 12.4), (15.4, 0.6), 1.5), ((29.5, 6), (28, 12), (25, 0.2), 1),
             ((33.5, 7.6), (31, 12.6), (34, 1.2), -1), ((35.4, 10.6), (33.6, 15), (40.4, 6.2), -1),
             ((36.4, 14.4), (37.4, 19.4), (41.2, 13.6), -0.5)]
    for i, (ra, rb, tip, bend) in enumerate(locks):
        nm = 'lock%d' % i
        p.material(nm, BROWN, 2, z=10 + i, edge=True, edgecol=BROWN[0])
        p.fill(nm, m('lock', ra, rb, tip, bend))
        mid = ((ra[0] + rb[0]) / 2, (ra[1] + rb[1]) / 2)
        p.shade(-1, m('lock', mid, rb, tip, bend), on=[nm])
    lk = ['lock%d' % i for i in range(len(locks))]
    # The anime shine band across the crown, and the dark nape.
    p.shade(+1, m('stroke', [(5, 16), (9, 8.6), (17, 4), (26, 3), (34, 5.4)], 2.6), on=lk)
    p.shade(+1, m('stroke', [(7.4, 12), (12, 6.6), (18, 4.4)], 1.0), on=lk)
    p.shade(-1, m('blob', [(4, 26), (12, 25), (14, 33), (6, 36)]), on=lk)
    # Ear (near side) and face.
    p.fill('ear', m('ell', 15.2, 24.2, 2.3, 3.4))
    p.shade(-1, m('ell', 15.6, 24.6, 1.0, 2.0), on=['ear'])
    face = [(16.4, 15.2), (21.4, 11.8), (29, 11.6), (34.4, 14.6), (36.6, 21), (36, 27.6), (33.6, 33.8),
            (28.4, 37.8), (23, 37.2), (18.8, 33.2), (17, 27), (16.4, 21)]
    p.fill('skin', m('blob', face))
    p.shade(+1, m('blob', [(19, 13.6), (25, 12.2), (23, 15), (19.2, 17.2)]), on=['skin'])
    p.shade(-1, m('blob', [(30, 14), (35, 15.4), (36.8, 22), (35.6, 29), (32, 31.6), (32.6, 24), (31, 18)]), on=['skin'])
    p.shade(-1, m('blob', [(16.6, 18.6), (24.6, 18.4), (24.6, 20.4), (17, 20.8)]), on=['skin'])
    p.shade(-1, m('blob', [(29, 18.2), (35.6, 18.6), (35.6, 20.8), (29, 20.6)]), on=['skin'])
    p.shade(-1, m('blob', [(26.6, 21), (28.6, 20.6), (29.4, 26.6), (27, 27.2)]), on=['skin'])
    # Tired: hollows under the eyes.
    p.shade(-1, m('blob', [(19, 24.2), (24, 24), (23.6, 25.4), (19.6, 25.4)]), on=['skin'])
    # Beard: short, along the jaw from the sideburn to the chin, with the moustache.
    beard = [(17, 23), (18.6, 23), (19.6, 29), (22.6, 31.6), (25.4, 30.6), (28.4, 31.6), (33, 29), (35, 26),
             (36.4, 27), (34.4, 33.8), (29, 38.6), (24.6, 39.4), (20.4, 36.6), (17.6, 31)]
    p.fill('beard', m('blob', beard), on=['skin', 'ear', 'neck'])
    p.fill('beard', m('blob', [(21.4, 30), (24.6, 28.6), (27, 29.2), (30.6, 28.4), (33, 29.6), (30, 30.8), (27, 30.4), (24, 31.2)]))
    p.shade(-1, m('blob', [(27, 34), (35, 29), (33.6, 34.6), (28, 39.4)]), on=['beard'])
    p.shade(+1, m('blob', [(18.4, 26), (19.6, 29), (21.6, 32), (19.4, 32)]), on=['beard'])
    p.reduce()
    p.render()
    cm = {'k': INK, 'w': '#e8e0e8', 'i': '#6a5038', 'I': '#38241a', 'h': '#fff8f0', 's': SKIN[2], 'm': '#5c1810'}
    near = {'broken': ['.kkkkk', 'kkkkkk', 'kwhiIk', '.wiII.', '..ss..']}
    far = {'broken': ['kkkk.', 'kkkkk', 'hiIwk', 'iIIw.', '.ss..']}
    eyes(p, [(18, 19, near), (29, 19, far)], 'broken', cm)
    p.line([(18, 17), (21, 17), (24, 16)], BROWN[0])     # brows lifted at the inner ends: weary
    p.line([(29, 16), (32, 17), (35, 17)], BROWN[0])
    p.stamp(26, 25, ['.s', 'ss', 'k.'], {'s': SKIN[2], 'k': SKIN[1]})
    p.stamp(24, 32, ['k....k', '.kkkk.'], {'k': '#2a0c06'})   # a small, spent smile
    # One tear on the near cheek.
    p.stamp(19, 24, ['w', 'b', 'b', '.b'], {'w': '#ffffff', 'b': '#a8d0f0'})
    return p



# =========================================================================================
# THE CURATOR (VESPER) in the Prophet's shape: deep purple hood, gold trim, the face a void
# with one vertical slit of cold-blue light. Emotion = slit glow + hood tilt + intensity.
# =========================================================================================
HOOD = ['#0a0716', '#18123a', '#282060', '#3a3088', '#5246ac', '#7466cc', '#a49ae6']
GLOW = ['#06050e', '#0e1430', '#16285c', '#1e4690', '#2c70c0', '#5ca4e8', '#a4d8ff', '#e8f8ff']
# angle (deg, + leans right), dy (px, + lower), slit (x, y0, y1, width), peak, sigma, extra
CUR = {
    'neutral': dict(rot=0, dy=0, slit=(24.5, 20, 32, 1), peak=6.4, sig=1.25),
    'happy': dict(rot=7, dy=0, slit=(24.5, 19, 32, 1), peak=7.0, sig=1.9, motes=True),
    'angry': dict(rot=-3, dy=2.2, slit=(24.5, 23, 30, 1), peak=7.6, sig=1.0, spikes=True),
    'sad': dict(rot=-9, dy=2.4, slit=(24.5, 24, 32, 1), peak=4.6, sig=0.9, drip=True),
    'surprised': dict(rot=0, dy=-1.2, slit=(24.5, 17, 34, 2), peak=7.8, sig=1.9, flare=True),
    'determined': dict(rot=0, dy=0.4, slit=(24.5, 18, 33, 1), peak=7.2, sig=1.1, gleam=True),
}


@portrait('curator', EMO6)
def curator(e):
    import math
    c = CUR[e]
    p = Pic('#e0dee8', '#0a0614')
    m = p.mask
    piv = (24.5, 46)
    ang = math.radians(c['rot'])

    def T(pts):
        out = []
        for x, y in pts:
            k = min(1.0, max(0.0, (46 - y) / 34))      # the hood tilts; the cloak barely moves
            dx, dy = x - piv[0], y - piv[1]
            a = ang * k
            out.append((piv[0] + dx * math.cos(a) - dy * math.sin(a), piv[1] + dx * math.sin(a) + dy * math.cos(a) + c['dy'] * k))
        return out

    p.material('cloak', HOOD, 3, z=1, edge=True)
    p.material('hood', HOOD, 3, z=2, edge=True)
    p.material('lining', HOOD, 1, z=3, edge=False)
    p.material('void', GLOW, 0, z=4)
    p.material('gold', GOLD, 3, z=6, edge=('bg', 'hood', 'cloak'), edgecol=GOLD[0])
    p.material('bead', ['#401008', '#802010', '#c04018', '#f07030', '#ffb070'], 3, z=7, edge=True, edgecol='#300808')
    # Cloak over the shoulders.
    p.fill('cloak', m('blob', [(-3, 50), (-1, 40), (5, 33), (14, 29), (35, 29), (44, 33), (50, 40), (51, 50)]))
    p.shade(-1, m('blob', [(30, 33), (44, 34), (50, 42), (50, 50), (32, 50)]), on=['cloak'])
    p.shade(+1, m('blob', [(1, 41), (6, 35), (12, 32), (8, 40), (3, 46)]), on=['cloak'])
    for fold in ([(6, 48), (8, 41)], [(41, 48), (40, 43)], [(46, 48), (45.6, 44)]):
        p.shade(-1, m('stroke', fold, 1.1), on=['cloak'])
    # The hood: tall, pointed, its tip leaning right like the Prophet's.
    hood = [(31, 0.4), (34.2, 4.4), (37, 10.6), (39.6, 18), (41.2, 26), (42, 33), (40, 40.4), (33, 43),
            (16, 43), (9, 40.4), (7.4, 33), (8.4, 25), (11, 17.4), (15.4, 10.4), (21, 5.4), (26.4, 2.6)]
    p.fill('hood', m('blob', T(hood)))
    p.shade(+1, m('blob', T([(10, 30), (11, 21), (15, 13), (21, 7), (27, 3.6), (22, 10), (17, 18), (14, 28)])), on=['hood'])
    p.shade(+1, m('blob', T([(13, 18), (17, 11.6), (22, 7.4), (18.4, 13)])), on=['hood'])
    p.shade(-1, m('blob', T([(31, 3), (36, 9), (40, 18), (42, 30), (40, 40), (35, 41), (37, 30), (36, 18), (33, 9)])), on=['hood'])
    p.shade(-1, m('stroke', T([(29.4, 2.4), (28.4, 7), (27, 10)]), 1.0), on=['hood'])
    p.shade(-1, m('stroke', T([(11, 38), (12.4, 31), (14.4, 25)]), 1.0), on=['hood'])
    p.shade(-1, m('stroke', T([(38.6, 38), (38.4, 28), (36.4, 19)]), 1.0), on=['hood'])
    p.shade(+1, m('stroke', T([(9.6, 37), (9.8, 30), (11.6, 23)]), 0.9), on=['hood'])
    # Lining (the inside of the hood) and the face void.
    p.fill('lining', m('blob', T([(24.5, 9.4), (31, 13), (34.6, 21), (35, 30), (32, 37.4), (24.5, 40.4),
                                  (17, 37.4), (14, 30), (14.6, 21), (18.2, 13)])))
    p.shade(+1, m('blob', T([(15, 29), (15.4, 21), (18.4, 14), (21, 13), (18, 21), (17, 30)])), on=['lining'])
    void = [(24.5, 12.6), (29.4, 15.6), (32.2, 22), (32.4, 30), (29.8, 36), (24.5, 38.4), (19.2, 36),
            (16.6, 30), (16.8, 22), (19.6, 15.6)]
    p.fill('void', m('blob', T(void)))
    # Gold: the band around the face, the brow ornament, the front edges of the cloak.
    band = [(24.5, 9.6), (31, 12.8), (34.8, 21), (35.2, 30), (32.4, 37.6), (24.5, 40.8), (16.6, 37.6),
            (13.8, 30), (14.2, 21), (18, 12.8)]
    p.fill('gold', m('stroke', T(band + band[:2]), 1.5))
    p.fill('gold', m('poly', T([(24.5, 5.4), (27, 8.6), (24.5, 11.6), (22, 8.6)])))
    p.fill('gold', m('stroke', [(10, 41.6), (17, 44.6), (24.5, 45.6), (32, 44.6), (39, 41.6)], 1.5))
    p.shade(-1, m('blob', T([(28, 11), (36, 18), (36, 34), (30, 41), (33, 30), (33, 19)])), on=['gold'])
    p.shade(+1, m('blob', T([(13, 26), (15, 16), (20, 11), (17, 18)])), on=['gold'])
    p.shade(-1, m('blob', [(30, 40), (36, 40), (36, 50), (30, 50)]), on=['gold'])
    # Beads (the orange baubles along the Prophet's trim).
    for (bx, by) in [(24.5, 8.6), (14.2, 26), (34.8, 26), (16, 44.2), (24.5, 45.6), (33, 44.2)]:
        q = T([(bx, by)])[0] if by < 40 else (bx, by)
        p.fill('bead', m('ell', q[0], q[1], 1.3, 1.3))
    p.reduce()
    # The slit and its light: intensity falls off from the slit's centre line.
    sx, y0, y1, sw = c['slit']
    (ax, ay), (bx2, by2) = T([(sx, y0), (sx, y1)])
    ax = bx2 = (ax + bx2) / 2        # the slit stays vertical however the hood leans
    vid = p.mats['void']['id']
    gid, lid = p.mats['gold']['id'], p.mats['lining']['id']
    peak, sig = c['peak'], c['sig']
    for y in range(48):
        for x in range(48):
            mid = p.m1[y][x]
            if mid not in (vid, gid, lid):
                continue
            px_, py_ = x + 0.5, y + 0.5
            vx, vy = bx2 - ax, by2 - ay
            t = max(0, min(1, ((px_ - ax) * vx + (py_ - ay) * vy) / (vx * vx + vy * vy)))
            dxl = px_ - (ax + vx * t)
            dyl = py_ - (ay + vy * t)
            d = math.hypot(dxl * 1.0, dyl * 2.2)
            I = peak * math.exp(-(max(0, d - (sw - 1) * 0.5) ** 2) / (2 * sig * sig))
            if mid == vid:
                p.t1[y][x] = I
            elif I > 2.2:
                p.t1[y][x] += 1 if I < 4 else 2   # the light catches the inner rim
    p.render()
    # The slit core: crisp, 1-2 px wide.
    w = [sx] if sw == 1 else [sx - 0.5, sx + 0.5]
    n = int(abs(by2 - ay)) + 1
    for i in range(n + 1):
        t = i / n
        for xx in w:
            X = int(math.floor(ax + (bx2 - ax) * t + (xx - sx)))
            Y = int(math.floor(ay + (by2 - ay) * t))
            edge = i in (0, n)
            p.put(X, Y, GLOW[6] if edge else GLOW[7])
    if c.get('spikes'):      # anger: hard shards of light knit into a frown above the slit
        cx = int(ax)
        cy = int(ay)
        for (dx_, dy_, col) in ((-3, -3, GLOW[5]), (-2, -2, GLOW[6]), (-1, -1, GLOW[7]),
                                (3, -3, GLOW[5]), (2, -2, GLOW[6]), (1, -1, GLOW[7])):
            p.put(cx + dx_, cy + dy_, col)
    if c.get('flare'):       # surprise: a cross-flare
        cy = int((ay + by2) / 2)
        cx = int((ax + bx2) / 2)
        for dx_ in (-5, -4, -3, -2, 2, 3, 4, 5):
            p.put(cx + (dx_ if dx_ < 0 else dx_ + 1), cy, GLOW[7] if abs(dx_) < 4 else GLOW[6])
    if c.get('drip'):        # sorrow: the light leaks down like a tear
        bxx, byy = int(bx2), int(by2)
        for k, col in enumerate([GLOW[5], GLOW[4], GLOW[4], GLOW[3]]):
            p.put(bxx, byy + 2 + k, col)
    if c.get('motes'):       # pleasure: little motes of light drift up
        for (dx_, dy_, col) in ((-4, -2, GLOW[6]), (4, -5, GLOW[5]), (-3, -8, GLOW[5]), (3, 2, GLOW[6])):
            p.put(int(ax) + dx_, int(ay) + dy_ + 4, col)
    if c.get('gleam'):       # resolve: a glint on the brow ornament
        gx, gy = T([(24.5, 8.6)])[0]
        p.stamp(int(gx) - 2, int(gy) - 2, ['..w..', '..w..', 'wwWww', '..w..', '..w..'], {'w': GOLD[4], 'W': '#ffffff'})
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
