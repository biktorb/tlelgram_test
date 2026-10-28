"""Дремучий лес: creatures face right, each in its square box (r * 2.3 px)."""
from pix import Spr, eye


def bat():
    s = Spr(25, 25)
    # wings: two jagged membranes, then the body on top
    s.poly([(1, 8), (6, 6), (10, 10), (11, 15), (8, 13), (6, 15), (4, 12), (1, 13)], 'purple')
    s.poly([(23, 8), (18, 6), (14, 10), (13, 15), (16, 13), (18, 15), (20, 12), (23, 13)], 'purple')
    s.ellipse(12.5, 12.5, 3.6, 4.6, 'dark')
    s.poly([(9.5, 9), (10.5, 5.5), (12, 8.5)], 'dark')
    s.poly([(13, 8.5), (14.5, 5.5), (15.5, 9)], 'dark')
    s.px(11, 11, '#ff4a4a').px(14, 11, '#ff4a4a')
    s.px(12, 14, '#f4f4f4').px(13, 14, '#f4f4f4')
    return s


def stump():
    s = Spr(30, 30)
    # roots, the trunk, a cut top with rings, a mossy cap, angry eyes
    for x0, x1 in ((7, 3), (11, 9), (19, 21), (23, 27)):
        s.line(x0, 23, x1, 27, 'bark', 1, 2)
    s.poly([(7, 9), (23, 9), (24, 25), (6, 25)], 'bark')
    s.ellipse(15, 9, 8, 3, 'wood')
    s.ellipse(15, 9, 4.5, 1.6, 'wood', lv=3, edge=False)
    s.px(15, 9, ('wood', 1))
    s.ellipse(9, 7.5, 3, 1.8, 'moss')
    s.line(10, 14, 13, 15, 'black', 0, 1)
    s.line(17, 15, 20, 14, 'black', 0, 1)
    s.px(12, 16, '#ffd23a').px(18, 16, '#ffd23a')
    s.line(12, 20, 18, 20, 'black', 0)
    s.ellipse(22, 17, 2.2, 1.4, 'leaf')
    return s


def kikimora():
    s = Spr(30, 30)
    # a hunched swamp hag: green skin, tangled moss hair, long fingers
    s.poly([(8, 27), (11, 14), (20, 13), (23, 27)], 'swamp')
    s.poly([(10, 27), (12, 18), (19, 18), (21, 27)], 'moss', bias=-.1)
    s.ellipse(16, 10, 6.5, 6, 'swamp')
    s.poly([(8, 9), (10, 3), (15, 2), (22, 4), (24, 9), (23, 15), (20, 9), (12, 8), (9, 17)], 'moss')
    eye(s, 17, 10, pupil='#c81e1e')
    eye(s, 20, 10, pupil='#c81e1e')
    s.px(23, 12, ('swamp', 1)).px(24, 13, ('swamp', 1))
    s.line(18, 14, 21, 14, 'black', 0)
    for i, (x, y) in enumerate(((23, 18), (25, 20), (24, 22))):
        s.line(20, 18, x, y, 'swamp', 2, 1)
    s.ellipse(13, 4, 2, 1.2, 'leaf')
    return s


def wisp():
    s = Spr(25, 25)
    # a will-o'-the-wisp: a teardrop of pale fire with a tail
    s.poly([(4, 20), (8, 14), (12, 6), (14, 3), (16, 7), (20, 13), (19, 19), (14, 22), (9, 22)], 'ghost')
    s.ellipse(13.5, 16, 4.5, 4.5, 'ghost', bias=.35, edge=False)
    s.ellipse(12.5, 16.5, 2.4, 2.4, 'white', bias=.6, edge=False)
    s.px(12, 15, '#1c2450').px(15, 15, '#1c2450')
    return s


def boar():
    s = Spr(41, 41)
    # a heavy boar with a bristled ridge and white tusks
    s.poly([(9, 31), (13, 31), (13, 36), (9, 36)], 'brown')
    s.poly([(26, 31), (30, 31), (30, 36), (26, 36)], 'brown')
    s.ellipse(19, 23, 15, 10, 'brown')
    s.poly([(25, 14), (35, 18), (39, 25), (36, 29), (26, 30)], 'brown', bias=.1)
    s.ellipse(37, 25.5, 2.5, 3, 'pink')
    for x in range(8, 28, 2):
        s.line(x, 13 + abs(x - 17) // 4, x - 1, 10 + abs(x - 17) // 4, 'black', 1)
    s.poly([(26, 13), (29, 9), (30, 15)], 'brown')
    eye(s, 31, 19, pupil='#d0201a', white=False)
    s.line(33, 28, 36, 24, 'bone', 3, 1)
    s.px(36, 23, ('bone', 4))
    s.poly([(10, 35), (14, 35), (14, 38), (10, 38)], 'black')
    s.poly([(25, 35), (29, 35), (29, 38), (25, 38)], 'black')
    s.line(4, 18, 2, 23, 'brown', 1)
    return s


def bear():
    s = Spr(46, 46)
    # a shambling bear on its hind legs, claws out
    s.ellipse(15, 40, 5, 4, 'brown')
    s.ellipse(29, 40, 5, 4, 'brown')
    s.ellipse(22, 27, 13, 14, 'brown')
    s.ellipse(23, 30, 7, 8, 'brown', bias=.4, edge=False)
    s.ellipse(24, 12, 9, 8, 'brown')
    s.ellipse(17, 5, 3, 3, 'brown')
    s.ellipse(30, 5, 3, 3, 'brown')
    s.ellipse(30, 15, 4.5, 3.2, 'wood')
    s.px(34, 13, 'k').px(33, 13, 'k')
    eye(s, 23, 9)
    eye(s, 28, 9)
    s.line(29, 18, 33, 18, 'red', 2)
    s.ellipse(36, 24, 4, 5, 'brown')
    s.ellipse(9, 25, 4, 5, 'brown')
    for i in range(3):
        s.px(39 + (i == 1), 21 + i * 2, ('bone', 4))
    return s


def wolf():
    s = Spr(46, 46)
    # a grey wolf mid-stride, head low, bristling
    s.poly([(2, 15), (6, 15), (13, 22), (10, 25)], 'fur')
    s.poly([(10, 30), (14, 30), (12, 40), (8, 40)], 'fur', bias=-.3)
    s.poly([(28, 30), (32, 30), (35, 40), (31, 40)], 'fur', bias=-.3)
    s.ellipse(20, 24, 13, 8, 'fur')
    s.ellipse(21, 28, 8, 3.5, 'white', bias=.2, edge=False)
    s.poly([(14, 31), (18, 31), (19, 41), (15, 41)], 'fur')
    s.poly([(26, 30), (31, 30), (28, 41), (24, 41)], 'fur')
    s.poly([(28, 15), (37, 14), (44, 20), (43, 24), (34, 26), (28, 26)], 'fur', bias=.1)
    s.poly([(29, 15), (31, 8), (34, 14)], 'fur')
    s.poly([(34, 14), (36, 8), (38, 15)], 'fur')
    s.line(37, 24, 43, 23, 'red', 2)
    s.px(41, 22, ('white', 4)).px(38, 22, ('white', 4))
    s.px(44, 20, 'k')
    eye(s, 36, 17, pupil='#ffd23a', white=False)
    s.px(36, 17, ('fur', 0))
    for x in range(10, 30, 3):
        s.px(x, 16 + (x % 2), ('fur', 1)).px(x + 1, 15, ('fur', 1))
    return s


def leshy():
    s = Spr(64, 64)
    # the forest master: a walking tree with antler branches and moss beard
    s.poly([(17, 50), (23, 50), (21, 61), (13, 61)], 'bark')
    s.poly([(38, 50), (44, 50), (48, 61), (40, 61)], 'bark')
    s.poly([(18, 22), (44, 22), (48, 52), (14, 52)], 'bark')
    for x in range(19, 46, 5):
        s.line(x, 26, x - 1, 50, 'bark', 1)
    s.ellipse(31, 18, 12, 10, 'bark')
    # antlers
    s.line(24, 10, 16, 2, 'bark', 2, 2).line(19, 5, 13, 6, 'bark', 2, 2)
    s.line(38, 10, 46, 2, 'bark', 2, 2).line(43, 5, 50, 6, 'bark', 2, 2)
    for x, y in ((14, 3), (48, 3), (12, 7), (51, 7)):
        s.ellipse(x, y, 3.5, 2.5, 'leaf')
    # mossy beard
    s.poly([(22, 22), (42, 22), (40, 38), (34, 44), (28, 44), (24, 36)], 'moss')
    s.ellipse(27, 16, 2.5, 2, 'black', lv=1)
    s.ellipse(36, 16, 2.5, 2, 'black', lv=1)
    s.px(27, 16, '#9dff6a').px(36, 16, '#9dff6a')
    # arms like branches
    s.line(16, 26, 6, 38, 'bark', 2, 3).line(6, 38, 2, 36, 'bark', 2, 2).line(6, 38, 5, 43, 'bark', 2, 2)
    s.line(46, 26, 56, 34, 'bark', 2, 3).line(56, 34, 61, 32, 'bark', 2, 2).line(56, 34, 58, 40, 'bark', 2, 2)
    s.ellipse(21, 23, 3, 2, 'leaf')
    s.ellipse(43, 28, 2.5, 2, 'leaf')
    return s


def hut():
    s = Spr(69, 69)
    # the hut on chicken legs, stalking: log walls, a thatched roof
    for (x0, x1) in ((24, 18), (42, 48)):
        s.line(x0, 44, x0 + (x1 - x0) // 2, 54, 'gold', 2, 3)
        s.line(x0 + (x1 - x0) // 2, 54, x1, 63, 'gold', 2, 3)
        for d in (-4, 0, 4):
            s.line(x1, 63, x1 + d + 2, 66, 'gold', 1, 1)
    s.rect(12, 22, 44, 24, 'wood')
    for y in range(24, 46, 4):
        s.line(13, y, 55, y, 'wood', 1)
        s.px(12, y, ('wood', 3)).px(55, y, ('wood', 3))
    s.poly([(6, 24), (34, 4), (62, 24)], 'straw')
    for x in range(10, 60, 4):
        s.line(x, 23, 34 + (x - 34) // 3, 8, 'straw', 1)
    s.rect(28, 29, 12, 10, 'black', lv=1)
    s.px(31, 33, '#ffd23a').px(36, 33, '#ffd23a')
    s.line(34, 29, 34, 39, 'wood', 1)
    s.line(28, 34, 40, 34, 'wood', 1)
    s.rect(46, 14, 5, 8, 'stone')
    s.ellipse(48, 10, 3, 2, 'white', lv=2)
    return s


def yaga():
    s = Spr(87, 87)
    # Baba Yaga flying in her mortar, pestle raised, broom sweeping behind
    s.line(12, 70, 26, 64, 'wood', 2, 2)
    for d in range(-6, 7, 2):
        s.line(12, 70, 3, 70 + d, 'straw', 2, 1)
    s.poly([(20, 52), (64, 52), (58, 80), (26, 80)], 'wood')
    for x in range(26, 60, 6):
        s.line(x, 54, x + 2, 78, 'wood', 1)
    s.ellipse(42, 52, 22, 4, 'wood', bias=.2)
    s.ellipse(42, 52, 18, 2.4, 'bark', lv=0, edge=False)
    # her body: a ragged dark-red dress, headscarf
    s.poly([(30, 52), (32, 34), (52, 34), (56, 52)], 'red')
    s.ellipse(44, 26, 9, 9, 'skin')
    s.poly([(34, 26), (40, 14), (52, 16), (56, 26), (54, 34), (50, 24), (38, 24), (34, 34)], 'purple')
    s.poly([(46, 24), (56, 27), (54, 30), (47, 30)], 'skin', bias=.1)  # hooked nose
    s.px(57, 28, ('skin', 1))
    eye(s, 46, 24, pupil='#3a8a1a')
    s.line(46, 31, 51, 31, 'black', 0)
    s.px(48, 32, ('bone', 4))
    s.ellipse(40, 30, 3, 6, 'white', lv=2, edge=False)  # grey hair strands
    # arm and pestle
    s.line(54, 40, 64, 30, 'red', 2, 3)
    s.ellipse(65, 29, 2.5, 2.5, 'skin')
    s.line(66, 44, 70, 8, 'bone', 2, 3)
    s.ellipse(70, 8, 4, 5, 'bone')
    return s


ALL = [bat, stump, kikimora, wisp, boar, bear, wolf, leshy, hut, yaga]
