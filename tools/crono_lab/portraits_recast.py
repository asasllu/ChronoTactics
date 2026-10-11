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
        for (dx_, dy_, col) in ((-4, -2, GLOW[5]), (-3, -1, GLOW[6]), (-2, 0, GLOW[5]),
                                (4, -2, GLOW[5]), (3, -1, GLOW[6]), (2, 0, GLOW[5])):
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



# =========================================================================================
# SPEKKIO as the FROG KING (frog_king.png): a big green frog in a jewelled crown.
# =========================================================================================
FROGG = ['#0c1a04', '#1e3a0c', '#346414', '#4e8c1c', '#74b42c', '#a4d850', '#d4f090']
CREAM = ['#5c4418', '#a08040', '#d8c078', '#f4e8b0', '#fffcec']
IRISB = ['#0a1438', '#1c3480', '#3460c0', '#5c90e8', '#a0c8ff']
VELVET = ['#2c0408', '#5c0c14', '#901c1c', '#c03424', '#e86848']
GEMB = ['#081040', '#1834a0', '#3c6ce0', '#90c0ff', '#ffffff']
FK = {  # lids: (top lid drop 0..1 of the eye, slant + = inner corner lower), crown lift, iris scale
    'neutral': dict(lid=0.38, slant=0.0, lift=0, iris=1.0, mouth='smile'),
    'happy': dict(lid=None, slant=0, lift=-1, iris=1.0, mouth='grin', blush=True),
    'angry': dict(lid=0.42, slant=0.5, lift=1, iris=0.85, mouth='roar', vein=True),
    'sad': dict(lid=0.45, slant=-0.45, lift=1.5, iris=1.0, mouth='frown', tear=True),
    'surprised': dict(lid=0.0, slant=0, lift=-4, iris=0.6, mouth='o', sweat=True),
    'determined': dict(lid=0.5, slant=0.25, lift=0, iris=1.0, mouth='firm', gleam=True),
}


@portrait('spekkio', EMO6)
def frog_king(e):
    c = FK[e]
    p = Pic('#e6eef0', '#0a1404')
    m = p.mask
    p.material('body', FROGG, 3, z=1, edge=True, edgecol=FROGG[0])
    p.material('throat', CREAM, 3, z=2, edge=True, edgecol=CREAM[0])
    p.material('mouthin', ['#300808', '#701820', '#b03848', '#e07080', '#f8a8b0'], 1, z=3, edge=True, edgecol=FROGG[0])
    p.material('tongue', ['#601020', '#a02838', '#d85868', '#f490a0', '#ffc8d0'], 2, z=4, edge=True, edgecol='#401018')
    p.material('bulge', FROGG, 3, z=5, edge=True, edgecol=FROGG[0])
    p.material('eye', CREAM, 3, z=6, edge=False)
    p.material('iris', IRISB, 2, z=7, edge=True, edgecol=IRISB[0])
    p.material('pupil', ['#04040c'], 0, z=8)
    p.material('lid', FROGG, 4, z=9, edge=True, edgecol=FROGG[0])
    p.material('velvet', VELVET, 3, z=10, edge=True, edgecol='#200000')
    p.material('crown', GOLD, 3, z=11, edge=True, edgecol=GOLD[0])
    p.material('gem', GEMB, 2, z=12, edge=True, edgecol=GEMB[0])
    p.material('ruby', VELVET, 3, z=12, edge=True, edgecol='#200000')
    # Body: a squat, wide dome.
    body = [(-4, 50), (-3, 36), (1, 26), (6, 20), (14, 14), (24, 11), (34, 14), (42, 20), (47, 26), (51, 36), (52, 50)]
    p.fill('body', m('blob', body))
    p.shade(+1, m('blob', [(2, 30), (6, 22), (13, 18), (10, 25), (5, 34)]), on=['body'])
    p.shade(-1, m('blob', [(36, 26), (46, 26), (50, 38), (50, 50), (40, 50), (42, 38)]), on=['body'])
    p.shade(-1, m('blob', [(-2, 40), (6, 40), (8, 50), (-2, 50)]), on=['body'])
    # Throat / belly, the big cream circle of the sprite.
    p.fill('throat', m('ell', 24, 47, 15.5, 10.5))
    p.shade(-1, m('blob', [(31, 39), (40, 44), (40, 50), (30, 50)]), on=['throat'])
    p.shade(+1, m('blob', [(14, 41), (20, 38), (22, 41), (15, 44)]), on=['throat'])
    # Mouth.
    mo = c['mouth']
    if mo in ('grin', 'roar', 'o'):
        if mo == 'grin':
            hole = [(7, 29), (16, 31), (24, 31.6), (32, 31), (41, 29), (37, 35.6), (24, 39), (11, 35.6)]
        elif mo == 'roar':
            hole = [(8, 31), (16, 29.6), (24, 29.2), (32, 29.6), (40, 31), (37, 38), (24, 40.6), (11, 38)]
        else:
            hole = [(19, 30.4), (24, 29.6), (29, 30.4), (30, 34.6), (24, 37), (18, 34.6)]
        p.fill('mouthin', m('blob', hole))
        if mo != 'o':
            p.fill('tongue', m('ell', 24, 38.6, 7.5, 3.6), on=['mouthin'])
    # Warts: paler spots scattered over the hide.
    for (wx, wy, r) in [(5, 28, 1.2), (9, 24, 0.9), (40, 24, 1.0), (44, 30, 1.2), (4, 36, 1.0), (45, 38, 0.9),
                        (16, 24, 0.8), (33, 23.6, 0.8)]:
        p.shade(+1, m('ell', wx, wy, r, r), on=['body'])
    # Eye bulges and eyes (sitting high, like the sprite).
    for (ex, ey) in ((14, 17.5), (34, 17.5)):
        p.fill('bulge', m('ell', ex, ey, 8.6, 8.0))
        p.shade(+1, m('ell', ex - 3, ey - 3.4, 3.6, 2.4), on=['bulge'])
        p.shade(-1, m('blob', [(ex + 2, ey + 6), (ex + 8, ey + 1), (ex + 8.6, ey + 5), (ex + 4, ey + 8)]), on=['bulge'])
        p.fill('eye', m('ell', ex + 0.4, ey + 0.2, 6.0, 5.6))
        p.shade(-1, m('blob', [(ex - 5.6, ey + 1.4), (ex + 6.4, ey + 1.4), (ex + 4, ey + 5.6), (ex - 3, ey + 5.6)]), on=['eye'])
        ir = 3.6 * c['iris']
        ix = ex + (0.9 if ex < 24 else 0.0)
        p.fill('iris', m('ell', ix, ey + 0.6, ir, ir * 1.05), on=['eye'])
        p.shade(+1, m('ell', ix + 0.6, ey + 1.6, ir * 0.6, ir * 0.5), on=['iris'])
        p.fill('pupil', m('ell', ix, ey + 0.6, ir * 0.42, ir * 0.62), on=['iris'])
        # Lids.
        if c['lid'] is None:      # happy: lids shut (the smiling arcs are drawn at 1x)
            p.fill('bulge', m('ell', ex + 0.4, ey + 0.2, 6.4, 6.0), on=['eye', 'iris', 'pupil'])
            p.shade(+1, m('ell', ex - 1, ey - 1.6, 4.0, 2.4), on=['bulge'])
        elif c['lid'] > 0:
            inner = 1 if ex < 24 else -1          # +x toward the face centre for the left eye
            drop = c['lid'] * 11.2
            sl = c['slant'] * 6
            yo = ey - 5.8 + drop - sl / 2          # outer corner
            yi = ey - 5.8 + drop + sl / 2          # inner corner
            xo, xi = (ex - 7, ex + 7.4) if inner == 1 else (ex + 7.4, ex - 7)
            p.fill('lid', m('poly', [(xo, ey - 9), (xi, ey - 9), (xi, yi), (xo, yo)]), on=['eye', 'iris', 'pupil'])
    p.shade(-1, m('rect', 0, 0, 48, 48), on=['lid'])
    # Crown: red velvet cap, gold band and points, a blue jewel in front, rubies on the band.
    L = c['lift'] - 1.5
    p.fill('velvet', m('blob', [(16.4, 9.4 + L), (18.4, 4 + L), (24, 1.6 + L), (29.6, 4 + L), (31.6, 9.4 + L), (24, 10.6 + L)]))
    p.shade(-1, m('blob', [(25, 2 + L), (30, 4 + L), (31.6, 9.6 + L), (26.6, 9.6 + L)]), on=['velvet'])
    p.shade(+1, m('ell', 20.6, 5.4 + L, 1.6, 1.4), on=['velvet'])
    pts = [(14.6, 13 + L), (14.4, 7.4 + L), (17, 10 + L), (19.4, 5.2 + L), (21.8, 9.4 + L), (24, 3.6 + L),
           (26.2, 9.4 + L), (28.6, 5.2 + L), (31, 10 + L), (33.6, 7.4 + L), (33.4, 13 + L), (24, 14.2 + L)]
    p.fill('crown', m('poly', pts))
    p.fill('crown', m('blob', [(14.4, 11 + L), (24, 11.8 + L), (33.6, 11 + L), (33.4, 14 + L), (24, 15.2 + L), (14.6, 14 + L)]))
    p.shade(-1, m('blob', [(26, 9 + L), (34, 7 + L), (34, 14 + L), (26, 15 + L)]), on=['crown'])
    p.shade(+1, m('blob', [(14.6, 11.4 + L), (20, 11.6 + L), (20, 12.6 + L), (14.6, 12.6 + L)]), on=['crown'])
    p.fill('gem', m('poly', [(24, 9 + L), (26.4, 12 + L), (24, 15 + L), (21.6, 12 + L)]))
    p.shade(+1, m('poly', [(24, 9.4 + L), (24, 12 + L), (22.2, 12 + L)]), on=['gem'])
    for gx in (17.4, 30.6):
        p.fill('ruby', m('ell', gx, 12.8 + L, 1.4, 1.3))
    p.reduce()
    p.render()
    ink = FROGG[0]
    # Pearls on the crown's points.
    Li = int(round(L))
    for (qx, qy) in ((14, 7), (19, 4), (24, 2), (28, 4), (33, 7)):
        p.put(qx, qy + Li, '#fffcec')
    # Mouth line for the closed mouths.
    if mo == 'smile':
        p.line([(6, 29), (14, 31.4), (24, 32), (34, 31.4), (42, 29)], ink)
        p.put(5, 28, ink); p.put(42, 28, ink)
    elif mo == 'frown':
        p.line([(7, 33), (14, 31), (24, 30.4), (34, 31), (41, 33)], ink)
    elif mo == 'firm':
        p.line([(6, 30.4), (14, 31.4), (24, 31.6), (34, 31.4), (42, 30.4)], ink)
    # Nostrils.
    p.put(21, 25, ink); p.put(27, 25, ink)
    # Eye glints.
    if c['lid'] is None:
        for ex in (14, 34):
            p.stamp(ex - 4, 16, ['..kkkkk..', '.k.....k.', 'k.......k'], {'k': ink})
    else:
        for ex in (14, 34):
            gx = int(ex + (0.9 if ex < 24 else 0) - 1.5 * c['iris'])
            gy = int(17.5 + 0.6 - 1.5 * c['iris'])
            if not (c['lid'] and c['lid'] > 0.45):
                p.put(gx, gy, '#ffffff')
    if c.get('blush'):
        for bx in (6, 37):
            p.stamp(bx, 26, ['p.p.p', '.p.p.'], {'p': '#f08080'})
    if c.get('vein'):
        p.stamp(39, 3, ['.r.r.', 'rr.rr', '.....', 'rr.rr', '.r.r.'], {'r': '#e02828'})
    if c.get('tear'):
        p.stamp(6, 22, ['w', 'b', 'b', 'bb', '.b'], {'w': '#ffffff', 'b': '#90c8f8'})
    if c.get('sweat'):
        p.stamp(41, 6, ['.w.', 'wbb', 'bbb', '.b.'], {'w': '#ffffff', 'b': '#90c8f8'})
    if c.get('gleam'):
        p.stamp(25, 4 + c['lift'], ['..w..', '..w..', 'wwWww', '..w..', '..w..'], {'w': GOLD[4], 'W': '#ffffff'})
    return p



# =========================================================================================
# Shared 3/4 human head (facing screen-right) for the NPCs.
# =========================================================================================
FACE3Q = [(16.4, 15.2), (21.4, 11.8), (29, 11.6), (34.4, 14.6), (36.6, 21), (36, 27.6), (33.6, 33.8),
          (28.4, 37.8), (23, 37.2), (18.8, 33.2), (17, 27), (16.4, 21)]
NEAR = dict(CY_NEAR, broken=['......', '.kkkkk', 'kwhiIk', '.ssss.'])
FAR = dict(CY_FAR, broken=['.....', 'kkkk.', 'hiIwk', '.sss.'])
# Lashed variants (Leene): a flick at the outer corner.
NEAR_L = {k: (['k' + r[1:] if i == 1 and k not in ('happy',) else r for i, r in enumerate(v)]) for k, v in NEAR.items()}
BROW_N = {k: [(a[0] - 18, a[1] - 19), (b[0] - 18, b[1] - 19)] for k, (a, b) in CY_BROW_N.items()}
BROW_F = {k: [(a[0] - 30, a[1] - 19), (b[0] - 30, b[1] - 19)] for k, (a, b) in CY_BROW_F.items()}
BROW_N['broken'] = [(0, -2), (6, -3)]
BROW_F['broken'] = [(-1, -3), (5, -2)]
MOUTHS = {
    'neutral': ['kkkk'],
    'happy': ['k.....k', '.kkkkk.', '.kwwwk.', '..kkk..'],
    'angry': ['kkkkkkk', 'kwwwwwk', 'kmmmmmk', '.kkkkk.'],
    'sad': ['.kkk.', 'k...k'],
    'surprised': ['.kk.', 'kmmk', 'kmmk', '.kk.'],
    'determined': ['kkkkk'],
    'broken': ['k...k', '.kkk.'],
}
SOFT_MOUTHS = dict(MOUTHS, neutral=['.kk.'], happy=['k....k', '.kkkk.'], determined=['kkk'],
                   angry=['.kkkk.', 'kwwwwk', '.kkkk.'], sad=['.kk.', 'k..k'])


def face3q(p, skin='skin', ear=True, shade=True, pts=FACE3Q):
    m = p.mask
    if ear:
        p.fill('ear', m('ell', 15.2, 24.2, 2.3, 3.4))
        p.shade(-1, m('ell', 15.6, 24.6, 1.0, 2.0), on=['ear'])
    p.fill(skin, m('blob', pts))
    if shade:
        p.shade(+1, m('blob', [(19, 13.6), (25, 12.2), (23, 15), (19.2, 17.2)]), on=[skin])
        p.shade(-1, m('blob', [(30, 14), (35, 15.4), (36.8, 22), (35.6, 29), (32, 31.6), (32.6, 24), (31, 18)]), on=[skin])
        p.shade(-1, m('blob', [(21, 35), (27, 36.4), (31, 35), (28, 37.6), (23, 37.4)]), on=[skin])


def features3q(p, e, iris=('#4a6ab0', '#24346c'), brow=None, lips='#2a0c06', near=NEAR, far=FAR,
               mouths=MOUTHS, dy=0, mouth_dy=0, skin=SKIN, nose=True, brows=True, fx=None):
    cm = {'k': INK, 'w': '#ece4ea', 'i': iris[0], 'I': iris[1], 'h': '#fff8f0', 's': skin[2], 'm': '#802c20'}
    eyes(p, [(18, 19 + dy, near), (29, 19 + dy, far)], e, cm)
    if brows:
        for (ox, oy), tab in (((18, 19 + dy), BROW_N), ((29, 19 + dy), BROW_F)):
            (a, b) = tab.get(e, tab['neutral'])
            p.line([(ox + a[0], oy + a[1]), (ox + b[0], oy + b[1])], brow or INK)
    if nose:
        p.stamp(26, 25 + dy, ['.s', 'ss', 'k.'], {'s': skin[2], 'k': skin[1]})
    rows = mouths.get(e, mouths['neutral'])
    p.stamp(int(round(26.5 - len(rows[0]) / 2)), 32 + dy + mouth_dy, rows, {'k': lips, 'w': '#f4ece4', 'm': '#902c28'})
    fx = fx or {}
    if e == 'angry' and fx.get('vein', True):
        p.stamp(36, 9 + dy, ['.r.r.', 'rr.rr', '.....', 'rr.rr', '.r.r.'], {'r': '#e02828'})
    if e == 'sad' and fx.get('tear', True):
        p.stamp(19, 23 + dy, ['w', 'b', 'b'], {'w': '#ffffff', 'b': '#90c8f8'})
    if e == 'surprised' and fx.get('sweat', True):
        p.stamp(38, 12 + dy, ['.w.', 'wbb', 'bbb', '.b.'], {'w': '#ffffff', 'b': '#90c8f8'})
    if e == 'happy' and fx.get('blush', True):
        p.stamp(18, 27 + dy, ['p.p.p'], {'p': '#f07878'})
        p.stamp(31, 27 + dy, ['p.p'], {'p': '#f07878'})



# =========================================================================================
# KING GUARDIA: the npc_king sprite is a gold-armoured knight-king in a red cape, so the
# portrait is a warrior king: gold crown-helm with a white crest, red cape, brown beard.
# =========================================================================================
REDC = ['#2c0408', '#600c18', '#981028', '#c82840', '#e85868', '#f8a0a0']
KGOLD = ['#3c2008', '#784010', '#a87018', '#d0a010', '#e8cc28', '#fcf080', '#fffcd8']


@portrait('king', EMO6)
def king(e):
    p = Pic('#ece6e0', INK)
    m = p.mask
    p.material('cape', REDC, 2, z=1, edge=True)
    p.material('plate', KGOLD, 3, z=2, edge=True, edgecol=KGOLD[0])
    p.material('collar', REDC, 3, z=3, edge=True)
    p.material('chest', KGOLD, 2, z=4, edge=True, edgecol=KGOLD[0])
    p.material('ear', SKIN, 3, z=5, edge=True)
    p.material('skin', SKIN, 3, z=6, edge=True)
    p.material('beard', BROWN, 2, z=7, edge=True)
    p.material('helm', KGOLD, 3, z=8, edge=True, edgecol=KGOLD[0])
    p.material('crown', KGOLD, 4, z=8.5, edge=True, edgecol=KGOLD[1])
    p.material('crest', ['#606070', '#9090a8', '#c8c8d8', '#f0f0f8', '#ffffff'], 3, z=9, edge=True, edgecol=KGOLD[0])
    p.material('jewel', REDC, 3, z=10, edge=True, edgecol=REDC[0])
    # Cape and the high red collar of the sprite.
    p.fill('cape', m('blob', [(1, 48), (0, 36), (4, 27), (12, 22), (24, 21), (37, 22), (45, 28), (48, 37), (48, 48)]))
    p.shade(-1, m('blob', [(32, 24), (44, 27), (48, 40), (48, 48), (36, 48)]), on=['cape'])
    p.shade(+1, m('blob', [(2, 36), (5, 28), (12, 24), (8, 32)]), on=['cape'])
    # Gold pauldrons.
    p.fill('plate', m('blob', [(-2, 48), (-1, 40), (5, 36), (14, 37), (18, 42), (19, 48)]))
    p.fill('plate', m('blob', [(31, 48), (32, 41), (37, 36.6), (45, 36.6), (50, 40), (50, 48)]))
    p.shade(+1, m('blob', [(1, 41), (6, 37.4), (13, 38), (8, 41.4)]), on=['plate'])
    p.shade(+2, m('blob', [(3, 40), (6, 38.4), (9, 38.6), (6, 39.8)]), on=['plate'])
    p.shade(-1, m('blob', [(12, 44), (19, 42), (19, 48), (11, 48)]), on=['plate'])
    p.shade(-1, m('blob', [(41, 43), (49, 41), (49, 48), (39, 48)]), on=['plate'])
    p.shade(+1, m('blob', [(34, 40.6), (38, 37.4), (44, 37.6), (40, 41)]), on=['plate'])
    p.fill('jewel', m('ell', 9, 43.4, 1.6, 1.6))
    p.fill('jewel', m('ell', 40, 43.4, 1.6, 1.6))
    p.fill('collar', m('blob', [(12, 47), (13, 37), (18, 33), (33, 33), (37, 37), (37, 47), (25, 48.6)]))
    p.shade(-1, m('blob', [(28, 34), (36, 37), (37, 47), (30, 47)]), on=['collar'])
    p.shade(+1, m('blob', [(14, 39), (18, 35), (20, 40), (16, 45)]), on=['collar'])
    # Gold breastplate under the beard.
    p.fill('chest', m('blob', [(17, 49), (16.6, 40), (24, 37.4), (33, 40), (33, 49)]))
    p.shade(-1, m('blob', [(27, 39), (33, 40), (33, 49), (28, 49)]), on=['chest'])
    p.shade(+1, m('blob', [(18, 41), (22, 39.4), (21, 44), (18, 45)]), on=['chest'])
    p.fill('jewel', m('ell', 24.6, 45.4, 1.6, 1.6))
    # Head.
    face3q(p)
    beard = [(17, 23), (18.6, 23), (19.6, 29), (22.6, 31.6), (25.4, 30.6), (28.4, 31.6), (33, 29), (35, 26),
             (36.4, 27), (35, 34.6), (30, 40.6), (24.6, 42), (19.4, 38.4), (17.4, 31)]
    p.fill('beard', m('blob', beard), on=['skin', 'ear', 'collar', 'cape'])
    p.fill('beard', m('blob', [(21.4, 30), (24.6, 28.6), (27, 29.2), (30.6, 28.4), (33, 29.6), (30, 30.8), (27, 30.4), (24, 31.2)]))
    p.shade(-1, m('blob', [(27, 35), (35, 30), (34, 36), (28, 41.4)]), on=['beard'])
    p.shade(+1, m('blob', [(18.4, 26), (19.6, 29), (21.6, 33), (19.4, 33)]), on=['beard'])
    p.shade(+1, m('stroke', [(22, 30), (25, 29.4)], 0.9), on=['beard'])
    # Crown-helm: a gold dome down to the brow with cheek guards, open face.
    p.fill('helm', m('blob', [(10.6, 26), (9.6, 16), (12, 10.6), (17.6, 7.6), (25, 6.6), (32, 7.6), (37.6, 10.6),
                              (40, 16), (39.6, 24), (37.4, 22), (36.6, 16.2), (31, 14.6), (24, 15), (18.4, 16.6),
                              (16.4, 22), (15.6, 30), (12.6, 31)]))
    p.shade(+1, m('blob', [(11, 20), (11.6, 13), (14, 16), (13, 22)]), on=['helm'])
    p.material('velvet', REDC, 3, z=7.5, edge=True)
    p.fill('velvet', m('blob', [(14, 12), (17, 6.4), (24.6, 3.6), (32, 6), (36, 11), (24.6, 12)]), on=['bg', 'helm'])
    p.shade(+1, m('ell', 19, 7.6, 2.2, 1.4), on=['velvet'])
    p.shade(-1, m('blob', [(31, 5), (38, 10), (40, 18), (39.4, 24), (37, 21), (35.6, 13)]), on=['helm'])
    # Crown band with points across the brow.
    p.fill('crown', m('poly', [(12.4, 16.4), (11.6, 7.4), (15.6, 11.6), (18.4, 4.4), (21.4, 10.4), (24.6, 1.6), (27.8, 10.2),
                               (31, 4.2), (33.4, 10.6), (37.6, 6.6), (38, 16.4), (31, 14.6), (24, 15), (17.6, 16.6)]))
    p.shade(-1, m('blob', [(29, 9), (38, 6), (38.4, 16.6), (29, 15)]), on=['crown'])
    p.shade(+1, m('stroke', [(13, 14.6), (18, 13.8), (24, 13), (30, 12.8)], 1.0), on=['crown'])
    # White crest spike up the front (the sprite's white streak).
    p.fill('jewel', m('poly', [(24.6, 9.6), (26.4, 12), (24.6, 14.4), (22.8, 12)]))
    p.fill('jewel', m('ell', 16.4, 14.2, 1.1, 1.1))
    p.fill('jewel', m('ell', 33, 13.4, 1.1, 1.1))
    p.reduce()
    p.render()
    features3q(p, e, iris=('#6a4a30', '#3a2414'), brow=BROWN[0], fx={'blush': False}, lips='#2a0c06')
    return p



# =========================================================================================
# QUEEN LEENE (npc_leene): a red-haired court lady in a white-and-lavender headdress and a
# gold gown with a lavender bodice.
# =========================================================================================
REDH = ['#2c0606', '#5c1412', '#a0302f', '#c84e40', '#e87860', '#ffb090']
LAV = ['#1c1838', '#3c3870', '#6068a0', '#8090c0', '#a8b8e0', '#d8e0f8']
WHITE = ['#585870', '#9090a8', '#c4c4d4', '#dfdfe8', '#f4f4fa', '#ffffff']
GOWN = ['#401404', '#7c2c08', '#bf500f', '#df8f30', '#f4c060', '#fff0b0']
FACE_F = [(16.6, 15), (21.4, 11.8), (29, 11.6), (34.4, 14.6), (36.4, 21), (35.6, 27), (32.6, 32.4), (28.4, 35.6),
          (24.4, 35.8), (20, 32.6), (17.6, 27), (16.6, 21)]


@portrait('leene', EMO6)
def leene(e):
    p = Pic('#f0e6ec', INK)
    m = p.mask
    p.material('hairback', REDH, 2, z=1, edge=True, edgecol=REDH[0])
    p.material('ear', SKIN, 3, z=5.5, edge=True)
    p.material('gown', GOWN, 3, z=2, edge=True, edgecol=GOWN[0])
    p.material('bodice', LAV, 3, z=3, edge=True)
    p.material('neck', SKIN, 3, z=4, edge=True)
    p.material('ruff', WHITE, 3, z=5, edge=True, edgecol=WHITE[0])
    p.material('skin', SKIN, 4, z=6, edge=True, edgecol='#602818')
    p.material('hair', REDH, 2, z=7, edge=True, edgecol=REDH[0])
    p.material('veil', WHITE, 3, z=8, edge=True, edgecol=WHITE[0])
    p.material('trim', LAV, 3, z=9, edge=True)
    p.material('gold', GOLD, 4, z=10, edge=True, edgecol=GOLD[1])
    p.material('gem', GEMB, 2, z=11, edge=True, edgecol=GEMB[0])
    # Long red hair falling behind the shoulders.
    p.fill('hairback', m('blob', [(4, 48), (4, 34), (6, 20), (10, 10), (18, 5), (29, 4.6), (37, 8), (41.6, 17), (42, 31), (45, 48)]))
    p.shade(-1, m('blob', [(34, 14), (42, 20), (43, 34), (45, 48), (36, 48), (37, 30)]), on=['hairback'])
    p.shade(+1, m('blob', [(6, 26), (8, 16), (12, 11), (10, 22), (8, 34)]), on=['hairback'])
    for st in ([(8, 46), (7, 34), (9, 22)], [(39, 46), (39.6, 32), (38, 20)], [(11, 46), (10, 36)]):
        p.shade(-1, m('stroke', st, 0.9), on=['hairback'])
    # Gown: gold shoulders, lavender bodice, white ruffed collar.
    p.fill('gown', m('blob', [(-2, 49), (0, 42), (8, 38.4), (18, 37), (30, 37), (40, 38.4), (48, 42), (50, 49)]))
    p.shade(-1, m('blob', [(30, 39), (42, 39), (50, 44), (50, 49), (32, 49)]), on=['gown'])
    p.shade(+1, m('blob', [(1, 43), (6, 39.6), (12, 39), (6, 43)]), on=['gown'])
    p.fill('bodice', m('blob', [(14, 49), (15, 41), (24.4, 39.4), (34, 41), (35, 49)]))
    p.shade(-1, m('blob', [(27, 41), (35, 42), (35, 49), (28, 49)]), on=['bodice'])
    p.fill('neck', m('blob', [(21.6, 30), (29.6, 30), (30, 39), (25, 41), (21.2, 39)]))
    p.shade(-1, m('blob', [(20, 30), (31, 30), (31, 35), (25, 36.4), (20, 34.4)]), on=['neck'])
    p.fill('ruff', m('blob', [(14.4, 42), (17, 38), (21, 39.6), (25, 41.4), (29.4, 39.6), (33.4, 38), (36, 42), (31, 44), (25, 44.6), (19, 44)]))
    p.shade(-1, m('blob', [(27, 41), (36, 41.4), (31, 44), (26, 44.6)]), on=['ruff'])
    p.fill('gold', m('stroke', [(19, 37.6), (22, 39.6), (25, 40.4), (28, 39.6), (31, 37.6)], 0.9))
    p.fill('gem', m('poly', [(25, 39.6), (26.4, 41.2), (25, 42.8), (23.6, 41.2)]))
    face3q(p, ear=False, pts=FACE_F)
    # Bangs and the side lock that frames the near cheek.
    p.fill('hair', m('blob', [(14.4, 22), (14.6, 14), (19, 9), (26, 7.6), (33, 9), (37.6, 14), (38, 21), (35.4, 15.6),
                              (31, 13.6), (28.4, 16.4), (26, 13.6), (22, 17), (19.4, 15.4), (17.4, 21), (17, 30), (15, 34), (13.6, 28)]))
    p.shade(+1, m('blob', [(15, 18), (17, 12), (22, 9.4), (19.6, 13), (16.6, 19)]), on=['hair'])
    p.shade(-1, m('blob', [(31, 10), (37, 13), (38, 21), (35, 15)]), on=['hair'])
    p.shade(-1, m('stroke', [(26.4, 9), (26, 13)], 0.9), on=['hair'])
    p.shade(-1, m('stroke', [(15.6, 32), (16, 24)], 0.9), on=['hair'])
    # The white headdress band over the crown, lavender trim, gold diadem with a sapphire.
    p.fill('veil', m('blob', [(9.6, 14), (11.6, 7.4), (17.6, 3.4), (26, 2), (33.6, 3.6), (38.4, 7.6), (40, 12.6),
                              (36, 10.4), (26, 8.6), (16, 10), (11.6, 14.6)]))
    p.shade(-1, m('blob', [(30, 3.4), (38, 7), (40, 12.6), (34, 9.4)]), on=['veil'])
    p.shade(+1, m('blob', [(13, 8.4), (18, 4.6), (24, 3.2), (18, 6.4)]), on=['veil'])
    p.fill('trim', m('stroke', [(10.6, 14.6), (16, 10.4), (26, 9), (36, 10.6), (40, 13.4)], 1.4))
    p.fill('gold', m('stroke', [(13, 11.2), (18, 9.2), (26, 8.2), (34, 9.4)], 0.9))
    p.fill('gem', m('ell', 26, 8.2, 1.4, 1.3))
    p.reduce()
    p.render()
    near = {'neutral': ['kkkkkk', 'kwhiIk', '.wiIIk', '..sss.'], 'happy': ['......', 'kkkkk.', 'k....k', '......'],
            'angry': ['kk....', '.kkkkk', '.whiIk', '..wII.'], 'sad': ['....kk', 'kkkkk.', 'kwhiIk', '.wiII.'],
            'surprised': ['.kkkk.', 'kwhiIk', 'kwiIIk', '.kkkk.'], 'determined': ['kkkkkk', 'kkhiIk', '.wiIIk', '..ss..']}
    features3q(p, e, iris=('#3c8c6c', '#1c4838'), brow=REDH[0], lips='#8c2c2c', near=near,
               mouths=SOFT_MOUTHS, mouth_dy=0, skin=SKIN, fx={'vein': False})
    # A touch of lip colour.
    if e in ('neutral', 'determined', 'sad'):
        p.put(26, 33, '#e07070')
    return p



def bushy_brows(p, e, mat, dy=0, big=1.0):
    """Thick brows painted at 4x (white for the old men), angled by emotion."""
    m = p.mask
    for (ox, oy), tab, sgn in (((18, 19 + dy), BROW_N, 1), ((29, 19 + dy), BROW_F, -1)):
        (a, b) = tab.get(e, tab['neutral'])
        x0, y0 = ox + a[0] - (1 if sgn == 1 else -0.6), oy + a[1]
        x1, y1 = ox + b[0] + (1 if sgn == -1 else -0.6), oy + b[1]
        t = 1.7 * big
        p.fill(mat, m('poly', [(x0, y0 - t * 0.6), (x1, y1 - t * 0.6), (x1, y1 + t * 0.5), (x0, y0 + t * 0.9)]))
        # Tufts hanging off the outer end.
        ex_, ey_ = (x0, y0) if sgn == 1 else (x1, y1)
        p.fill(mat, m('poly', [(ex_ + 2 * sgn, ey_ - 0.6), (ex_ - 2.6 * sgn, ey_ + 2.4), (ex_ + 0.6 * sgn, ey_ + 1.4)]))


# =========================================================================================
# GASPAR (npc_gaspar): a bald old man with a white beard and a cane, a brown coat over a
# blue robe.
# =========================================================================================
COAT = ['#2c1408', '#5a3010', '#86501c', '#b06c20', '#cc8a3c', '#e8b070']
ROBEB = ['#141430', '#282860', '#3c3c88', '#5050a0', '#8080d0', '#b0b0f0']
BALD = [(16, 20), (15.6, 13), (18.6, 7.6), (24.6, 4.6), (31, 5.4), (35.6, 9.6), (37, 16.6), (36.6, 23), (36, 27.6),
        (33.6, 33.8), (28.4, 37.8), (23, 37.2), (18.8, 33.2), (17, 27)]


@portrait('gaspar', EMO6)
def gaspar(e):
    p = Pic('#ebe7dc', INK)
    m = p.mask
    p.material('robe', ROBEB, 3, z=1, edge=True)
    p.material('coat', COAT, 3, z=2, edge=True, edgecol=COAT[0])
    p.material('tuft', WHITE, 3, z=3, edge=True, edgecol=WHITE[0])
    p.material('ear', SKIN, 3, z=4, edge=True)
    p.material('skin', SKIN, 3, z=5, edge=True)
    p.material('beard', WHITE, 3, z=6, edge=True, edgecol=WHITE[0])
    p.material('mous', WHITE, 4, z=7, edge=True, edgecol=WHITE[0])
    p.material('brow', WHITE, 4, z=8, edge=True, edgecol=WHITE[0])
    # Blue robe and the brown coat's broad collar.
    p.fill('robe', m('blob', [(-2, 49), (0, 42), (8, 38), (18, 36.4), (31, 36.4), (41, 38), (49, 42), (50, 49)]))
    p.fill('coat', m('blob', [(-2, 49), (-1, 41), (6, 37), (13, 36.6), (19, 42), (18, 49)]))
    p.fill('coat', m('blob', [(31, 49), (30, 42), (36, 36.6), (43, 37), (50, 41), (50, 49)]))
    p.shade(+1, m('blob', [(1, 42), (6, 38.4), (12, 38.4), (7, 42)]), on=['coat'])
    p.shade(-1, m('blob', [(38, 39), (50, 41), (50, 49), (36, 49)]), on=['coat'])
    p.shade(-1, m('blob', [(14, 41), (19, 42), (18, 49), (13, 49)]), on=['coat'])
    p.shade(-1, m('blob', [(27, 38), (34, 38), (32, 49), (26, 49)]), on=['robe'])
    # White tufts at the back of the head.
    p.fill('tuft', m('blob', [(10.4, 27), (9.6, 21), (11, 15.6), (14.6, 13), (17, 17), (17.4, 26), (14, 30)]))
    p.shade(-1, m('blob', [(10, 24), (14, 26), (13.6, 30), (10.6, 28)]), on=['tuft'])
    p.fill('ear', m('ell', 15.6, 24.2, 2.3, 3.4))
    p.shade(-1, m('ell', 16, 24.6, 1.0, 2.0), on=['ear'])
    face3q(p, ear=False, pts=BALD)
    # The shine on the pate (yellow-white, like the sprite).
    p.shade(+1, m('blob', [(18, 9.6), (23, 6), (30, 6.4), (26, 9), (21, 12)]), on=['skin'])
    p.shade(+2, m('ell', 22.6, 8.2, 2.4, 1.2), on=['skin'])
    # Long white beard and drooping moustache.
    p.fill('beard', m('blob', [(17.4, 24), (19, 24), (20, 30), (24, 32.6), (29, 32.6), (33.4, 29.6), (35.6, 25),
                               (37, 27), (36, 35), (32.6, 42), (28, 48), (25, 49), (21, 46), (18.6, 38)]))
    p.shade(-1, m('blob', [(28, 34), (36, 30), (34.6, 40), (29, 49), (27, 44)]), on=['beard'])
    p.shade(+1, m('blob', [(18.4, 28), (20, 32), (22, 38), (20, 40), (18.6, 34)]), on=['beard'])
    for st in ([(22.6, 36), (23.4, 44)], [(26.4, 37), (27, 46)], [(30.4, 36), (30, 42)]):
        p.shade(-1, m('stroke', st, 0.8), on=['beard'])
    p.fill('mous', m('blob', [(19.6, 32.4), (22, 29.2), (26.6, 28.4), (31, 28.6), (35, 31.4), (33, 33), (29.4, 31.4),
                              (26.6, 31), (23.6, 31.6), (21, 34.6)]))
    p.shade(-1, m('blob', [(28, 30.4), (35, 31.4), (33, 33), (29, 31.6)]), on=['mous'])
    bushy_brows(p, e, 'brow', dy=0, big=1.0)
    p.shade(-1, m('rect', 30, 0, 48, 48), on=['brow'])
    p.reduce()
    p.render()
    mouths = {'neutral': [''], 'happy': ['kwwwk', '.kkk.'], 'angry': ['kwwwwk', 'kmmmmk'], 'sad': ['.kkk.'],
              'surprised': ['.kk.', 'kmmk', '.kk.'], 'determined': ['']}
    features3q(p, e, iris=('#5a5070', '#2c2438'), brows=False, lips='#401810',
               mouths={k: [r for r in v if r] or ['....'] for k, v in mouths.items()}, mouth_dy=1,
               fx={'blush': True, 'vein': True})
    return p


# =========================================================================================
# KINO (npc_kino): the red-haired caveman.
# =========================================================================================
KHAIR = ['#3c1008', '#7c2c1c', '#b85434', '#e8805c', '#f8a47c', '#ffd0b0']
KSKIN = ['#4a1c0c', '#884424', '#bc6e3c', '#dc9a64', '#f2c48e', '#fff0d4']
FUR = ['#241808', '#4c3418', '#785a30', '#a48450', '#c8ac78']


@portrait('kino', EMO6)
def kino(e):
    p = Pic('#ece6dc', INK)
    m = p.mask
    p.material('body', KSKIN, 3, z=1, edge=True)
    p.material('fur', FUR, 2, z=2, edge=True)
    p.material('hairback', KHAIR, 2, z=3, edge=True, edgecol=KHAIR[0])
    p.material('ear', KSKIN, 3, z=4, edge=True)
    p.material('skin', KSKIN, 3, z=5, edge=True)
    p.material('tooth', ['#806850', '#c8b490', '#f0e8d0', '#ffffff'], 2, z=6, edge=True)
    # Bare shoulders and chest, a fur strap over one shoulder.
    p.fill('body', m('blob', [(-2, 49), (-1, 41), (7, 37), (17, 35), (32, 35), (42, 37), (50, 41), (50, 49)]))
    p.shade(-1, m('blob', [(31, 37), (43, 38), (50, 43), (50, 49), (34, 49)]), on=['body'])
    p.shade(+1, m('blob', [(2, 41), (8, 38), (14, 38.4), (8, 41.6)]), on=['body'])
    p.shade(-1, m('stroke', [(19, 46), (24, 47), (29, 46)], 0.9), on=['body'])
    p.fill('fur', m('blob', [(5, 49), (8, 42), (14, 37), (19, 36.6), (17, 41), (12, 46), (11, 49)]))
    p.shade(+1, m('blob', [(8, 43), (12, 39), (15, 38.6), (11, 42)]), on=['fur'])
    # Neck.
    p.fill('body', m('blob', [(19.6, 30), (31, 30), (32, 38), (25, 40), (19, 38)]))
    p.shade(-1, m('blob', [(19, 30), (32, 30), (31.6, 35), (25, 37), (19, 35)]), on=['body'])
    # Wild hair mass behind.
    p.fill('hairback', m('blob', [(7, 32), (5, 22), (6.6, 12), (11.6, 5), (19, 1.6), (29, 1.6), (37, 5), (41.6, 12),
                                  (42.4, 22), (40, 30), (37, 22), (33, 14), (24, 12), (17, 15), (15, 24), (12, 33)]))
    p.shade(-1, m('blob', [(36, 10), (42, 16), (42, 28), (39, 28), (37, 18)]), on=['hairback'])
    face3q(p, pts=[(16.4, 15.2), (21.4, 11.8), (29, 11.6), (34.4, 14.6), (36.6, 21), (36.4, 27.6), (34.4, 33.4),
                   (29, 37.4), (23, 37.2), (18.8, 33.2), (17, 27), (16.4, 21)])
    # A fang on a thong.
    p.fill('fur', m('stroke', [(19, 37.6), (22, 40.6), (25, 41.4), (28, 40.6), (31, 37.6)], 0.9))
    p.fill('tooth', m('poly', [(23.6, 40.6), (26.4, 40.6), (25.2, 45.4)]))
    # Spiky locks: up and outward, a few falling over the brow.
    locks = [((10, 22), (13, 30), (3, 33), -1), ((9, 14), (13, 22), (1.6, 18), 0.6), ((12, 8), (17, 13), (4.4, 5), 1),
             ((18, 5), (22, 11), (13, -1), 1), ((24, 4), (27.6, 10.6), (24, -2.6), 0.4), ((30, 5), (32.6, 11.6), (35.6, -1.4), -1),
             ((34, 9), (36.6, 15), (44.4, 5.4), -1), ((36.4, 14), (38.4, 21), (46, 17), -0.6), ((38, 21), (39, 28), (45.4, 30), 0.6),
             ((19, 10.4), (25.4, 10.4), (20, 18.6), 1.2), ((25.4, 10.4), (31.6, 11), (29.4, 18.4), -1), ((31.4, 11), (36, 13.6), (35.6, 19.4), -0.6)]
    for i, (ra, rb, tip, bend) in enumerate(locks):
        nm = 'klock%d' % i
        p.material(nm, KHAIR, 3, z=10 + i, edge=True, edgecol=KHAIR[0])
        p.fill(nm, m('lock', ra, rb, tip, bend))
        mid = ((ra[0] + rb[0]) / 2, (ra[1] + rb[1]) / 2)
        p.shade(-1, m('lock', mid, rb, tip, bend), on=[nm])
    lk = ['klock%d' % i for i in range(len(locks))]
    p.shade(+1, m('stroke', [(5, 16), (10, 7.6), (18, 3.6), (27, 2.6)], 2.2), on=lk)
    p.shade(-1, m('blob', [(32, 0), (48, 0), (48, 32), (38, 30), (36, 12)]), on=lk)
    p.reduce()
    p.render()
    near = dict(NEAR, happy=['......', '.kkkk.', 'k....k', '......'])
    mouths = dict(MOUTHS, neutral=['kkkk.', '....k'], happy=['k......k', '.kwwwwk.', '..kkkk..'],
                  determined=['kkkkk.', '.....k'])
    features3q(p, e, iris=('#5a3020', '#2c140c'), brow=KHAIR[0], lips='#3c1008', near=near,
               mouths=mouths, skin=KSKIN, fx={'blush': False})
    # Thick brows: double the brow line.
    for (ox, oy), tab in (((18, 19), BROW_N), ((29, 19), BROW_F)):
        (a, b) = tab.get(e, tab['neutral'])
        p.line([(ox + a[0], oy + a[1] - 1), (ox + b[0], oy + b[1] - 1)], KHAIR[0])
    return p


# =========================================================================================
# THE ELDER (npc_elder): the white-haired Earthbound elder with a cane, olive robe.
# =========================================================================================
OLIVE = ['#1c1c10', '#3a3a24', '#585838', '#707050', '#929270', '#b8b898']
ESKIN = ['#3c1c08', '#7c4418', '#b06828', '#e09850', '#f8b870', '#ffe0b0']


@portrait('elder', EMO6)
def elder(e):
    p = Pic('#e6e6dc', INK)
    m = p.mask
    p.material('robe', OLIVE, 3, z=1, edge=True)
    p.material('cord', COAT, 3, z=2, edge=True, edgecol=COAT[0])
    p.material('hairback', WHITE, 3, z=3, edge=True, edgecol=WHITE[0])
    p.material('ear', ESKIN, 3, z=4, edge=True)
    p.material('skin', ESKIN, 3, z=5, edge=True)
    p.material('beard', WHITE, 3, z=6, edge=True, edgecol=WHITE[0])
    p.material('mous', WHITE, 4, z=7, edge=True, edgecol=WHITE[0])
    p.material('brow', WHITE, 4, z=8, edge=True, edgecol=WHITE[0])
    # Robe with a hood bunched around the shoulders, a brown cord.
    p.fill('robe', m('blob', [(-2, 49), (-1, 39), (6, 33), (16, 31), (34, 31), (43, 34), (50, 40), (50, 49)]))
    p.shade(-1, m('blob', [(30, 33), (44, 35), (50, 42), (50, 49), (34, 49)]), on=['robe'])
    p.shade(+1, m('blob', [(1, 40), (6, 35), (13, 33), (8, 39)]), on=['robe'])
    for st in ([(8, 49), (10, 41), (14, 35)], [(40, 49), (39, 42), (36, 36)]):
        p.shade(-1, m('stroke', st, 1.0), on=['robe'])
    p.fill('cord', m('stroke', [(12, 37), (18, 41), (25, 42.4), (32, 41), (38, 37)], 1.3))
    # Wild white hair.
    p.fill('hairback', m('blob', [(10, 30), (8.6, 22), (9.6, 14), (13, 8.4), (19, 5.4), (28, 5.2), (34.6, 7.6), (38.6, 12.6),
                                  (39, 19), (37, 17), (33, 12.4), (25, 10.6), (18, 13), (15.6, 22), (13.4, 31)]))
    p.shade(-1, m('blob', [(8, 24), (13, 26), (12.6, 31), (9, 30)]), on=['hairback'])
    p.shade(-1, m('blob', [(34, 6), (41, 12), (41, 20), (37, 15)]), on=['hairback'])
    for st in ([(11, 26), (11, 17), (14.6, 10.6)], [(17, 8), (22, 6.6)], [(28, 7), (33.6, 9.6)], [(13.6, 21), (15.6, 14)]):
        p.shade(-1, m('stroke', st, 0.9), on=['hairback'])
    # Spiky tufts sticking out of the mane.
    for (ra, rb, tip, bend) in [((9.4, 16), (10, 22), (4.6, 17.6), 0.6), ((13, 9), (17, 6.4), (10, 3.6), 0.6),
                                ((22, 5.4), (27, 5.2), (25.4, 1.4), -0.6), ((34, 7.4), (37.6, 11), (41.4, 6.4), -0.6),
                                ((38.4, 14), (39, 19), (43, 16.4), 0.4)]:
        p.fill('hairback', m('lock', ra, rb, tip, bend))
    face3q(p, pts=[(16.4, 15.2), (21.4, 11.8), (29, 11.6), (34.4, 14.6), (36.6, 21), (36, 27.6), (33.6, 33.8),
                   (28.4, 37.8), (23, 37.2), (18.8, 33.2), (17, 27), (16.4, 21)])
    # Wrinkles: forehead lines and the cheek crease.
    for st in ([(20, 14.4), (26, 13.6), (31, 14.2)], [(21.4, 16), (25.6, 15.4)]):
        p.shade(-1, m('stroke', st, 0.8), on=['skin'])
    p.shade(-1, m('stroke', [(30.6, 24), (31.6, 27.6)], 0.8), on=['skin'])
    p.fill('beard', m('blob', [(17.4, 24), (19, 24), (20, 30), (24, 32.6), (29, 32.6), (33.4, 29.6), (35.6, 25),
                               (37, 27), (36.6, 35), (34, 41), (29, 46), (24, 47), (20, 43), (18.4, 35)]))
    p.shade(-1, m('blob', [(28, 34), (36.6, 30), (35, 40), (29, 46.6), (27, 41)]), on=['beard'])
    for st in ([(22, 36), (23, 43)], [(26, 37), (26.6, 45)], [(30.4, 36), (30, 42)]):
        p.shade(-1, m('stroke', st, 0.8), on=['beard'])
    p.fill('mous', m('blob', [(19.6, 32.4), (22, 29.2), (26.6, 28.4), (31, 28.6), (35, 31.4), (33, 33), (29.4, 31.4),
                              (26.6, 31), (23.6, 31.6), (21, 34.6)]))
    p.shade(-1, m('blob', [(28, 30.4), (35, 31.4), (33, 33), (29, 31.6)]), on=['mous'])
    bushy_brows(p, e, 'brow', dy=0, big=1.1)
    p.shade(-1, m('rect', 30, 0, 48, 48), on=['brow'])
    p.reduce()
    p.render()
    near = dict(NEAR, neutral=['......', '.kkkkk', 'kwhiIk', '..ss..'], determined=['......', 'kkkkkk', 'kkhiIk', '..ss..'])
    far = dict(FAR, neutral=['.....', 'kkkk.', 'hiIwk', '.ss..'], determined=['.....', 'kkkkk', 'hiIkk', '.ss..'])
    mouths = {'neutral': ['....'], 'happy': ['kwwwk', '.kkk.'], 'angry': ['kwwwwk', 'kmmmmk'], 'sad': ['.kkk.'],
              'surprised': ['.kk.', 'kmmk', '.kk.'], 'determined': ['....']}
    features3q(p, e, iris=('#4c3c30', '#241a14'), brows=False, lips='#401810', near=near, far=far,
               mouths=mouths, mouth_dy=1, skin=ESKIN, fx={'blush': False})
    return p


# =========================================================================================
# GUARDIA SOLDIER (npc_guard): teal helmet and armour, green underlayer.
# =========================================================================================
TEAL = ['#101820', '#202c40', '#384060', '#3c5c78', '#387890', '#68a8c0', '#a8d8e8']
TGREEN = ['#1c2410', '#383c1c', '#505828', '#688838', '#78a848', '#a8d070']


@portrait('guard', EMO6)
def guard(e):
    p = Pic('#e4e6ea', INK)
    m = p.mask
    p.material('armour', TEAL, 3, z=1, edge=True)
    p.material('under', TGREEN, 3, z=2, edge=True)
    p.material('ear', SKIN, 3, z=3, edge=True)
    p.material('skin', SKIN, 3, z=4, edge=True)
    p.material('hair', BROWN, 2, z=5, edge=True)
    p.material('helm', TEAL, 4, z=6, edge=True)
    p.material('brim', TEAL, 3, z=7, edge=True)
    p.fill('armour', m('blob', [(-2, 49), (-1, 40), (6, 35.6), (16, 35.4), (24, 37), (33, 35.4), (43, 35.6), (50, 40), (50, 49)]))
    p.shade(+1, m('blob', [(1, 40.6), (6, 37), (13, 37), (8, 40.6)]), on=['armour'])
    p.shade(+2, m('blob', [(3, 39.4), (6, 37.8), (9, 38), (6, 39.2)]), on=['armour'])
    p.shade(-1, m('blob', [(30, 40), (50, 41), (50, 49), (28, 49)]), on=['armour'])
    p.fill('under', m('blob', [(16.6, 49), (16.4, 39), (21, 35), (30, 35), (33.6, 39), (33.4, 49)]))
    p.shade(-1, m('blob', [(27, 36), (33.6, 39), (33.4, 49), (27, 49)]), on=['under'])
    p.fill('skin', m('blob', [(19.6, 30), (31, 30), (31.6, 38.6), (25, 40), (19.4, 38)]))
    p.shade(-1, m('blob', [(19, 30), (32, 30), (31.6, 35), (25, 37), (19, 35)]), on=['skin'])
    face3q(p)
    # Short brown hair at the temple.
    p.fill('hair', m('blob', [(14.6, 20), (15, 14), (18, 13), (19.6, 18), (17.6, 24)]))
    # Helmet: a teal kettle helm with a ridge and a wide brim shading the eyes.
    p.fill('helm', m('blob', [(12.4, 18), (13, 11), (16.6, 5.4), (22, 1.6), (25, -0.6), (28, 1.6), (33.6, 5.6),
                              (37, 11), (37.6, 18), (24, 16.6)]))
    p.shade(+1, m('blob', [(13, 15), (15, 9), (20, 4), (19, 9), (15.6, 16)]), on=['helm'])
    p.shade(+2, m('blob', [(15.6, 9), (18.6, 5), (20, 5.4), (17, 9.4)]), on=['helm'])
    p.shade(-1, m('blob', [(28, 2), (34, 6), (37.6, 15), (31, 15)]), on=['helm'])
    p.shade(-2, m('blob', [(32, 6.4), (37, 11), (37.6, 16), (34.6, 15.4)]), on=['helm'])
    p.shade(-1, m('stroke', [(25.6, 0), (26.4, 8), (26.4, 15)], 1.0), on=['helm'])
    p.shade(+1, m('stroke', [(24.4, 0.4), (25, 8), (25, 15)], 0.8), on=['helm'])
    p.fill('brim', m('blob', [(10.6, 19), (13, 15.6), (24, 14.6), (36, 14.8), (39.4, 17.6), (36.4, 19.4), (24, 18.6), (13, 19.8)]))
    p.shade(+1, m('blob', [(11, 18.6), (13.4, 16), (20, 15.4), (14, 18)]), on=['brim'])
    p.shade(-1, m('blob', [(28, 17.4), (39.4, 17.4), (36.4, 19.6), (28, 19.4)]), on=['brim'])
    # The brim's shadow over the eyes.
    p.shade(-1, m('blob', [(16, 18.6), (37, 18.6), (36.8, 21.4), (16.4, 21.6)]), on=['skin', 'hair', 'ear'])
    # Cheek straps.
    p.fill('brim', m('stroke', [(17.2, 20), (17.6, 27), (19.6, 33)], 1.4))
    p.fill('brim', m('stroke', [(35.8, 19.6), (35.4, 26), (33.6, 32)], 1.2))
    p.reduce()
    p.render()
    features3q(p, e, iris=('#5a3c28', '#2c1c10'), brow=BROWN[0], dy=1, mouth_dy=0, lips='#3c1810',
               mouths=dict(MOUTHS, neutral=['kkk']), fx={'blush': False})
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
