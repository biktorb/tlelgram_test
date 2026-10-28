"""Кощеево царство, plus the creatures found everywhere."""
from pix import Spr, eye
from people import person


def skull(s, cx, cy, r, mat='bone', glow='#ff3a2a'):
    s.ellipse(cx, cy, r, r * .9, mat)
    s.rect(cx - r * .5, cy + r * .5, r * 1.1, r * .6, mat)
    s.px(int(cx - r * .3), int(cy), 'k').px(int(cx + r * .35), int(cy), 'k')
    s.px(int(cx - r * .3) + 1, int(cy), glow).px(int(cx + r * .35) + 1, int(cy), glow)


def bones():
    s = Spr(21, 21)
    # a little rattling skeleton, all skull
    s.line(7, 14, 6, 19, 'bone', 2, 1).line(12, 14, 13, 19, 'bone', 2, 1)
    s.rect(7, 11, 6, 5, 'bone')
    for y in (12, 14):
        s.line(7, y, 12, y, 'bone', 1)
    skull(s, 10.5, 7, 5)
    return s


def snake():
    s = Spr(28, 28)
    # a golden-green serpent coiled, head raised
    s.ellipse(12, 21, 10, 4.5, 'jade')
    s.ellipse(12, 17, 7, 3.5, 'jade', bias=.2)
    s.poly([(14, 16), (19, 8), (22, 9), (19, 17)], 'jade', bias=.2)
    s.ellipse(22, 7, 4, 3, 'jade')
    for x in range(4, 22, 3):
        s.px(x, 21, ('gold', 3))
    s.px(23, 6, '#ffd23a')
    s.line(26, 8, 27, 9, 'red', 2)
    return s


def guard():
    s = Spr(37, 37)
    p = person(s, 15, 3, 32, 'dark', legs='black', skin='bone', boots='black', sash='red')
    # a dead man in black mail with a spear and a pointed helmet
    s.poly([(p['hx'] - p['hr'], p['hy'] - 1), (p['hx'], p['hy'] - p['hr'] - 5), (p['hx'] + p['hr'], p['hy'] - 1)], 'steel')
    s.line(27, 2, 25, 34, 'wood', 2, 1)
    s.poly([(26, 0), (29, 4), (27, 7), (25, 4)], 'steel')
    s.px(int(p['hx']) + 1, int(p['hy']), '#ff3a2a').px(int(p['hx']) + 4, int(p['hy']), '#ff3a2a')
    return s


def dragonling():
    s = Spr(23, 23)
    # a little green dragon flapping
    s.poly([(4, 4), (11, 8), (8, 13), (3, 11)], 'red', bias=.3)
    s.ellipse(10, 13, 6, 4, 'green')
    s.poly([(4, 13), (0, 17), (5, 16)], 'green')
    s.ellipse(16, 9, 4, 3.5, 'green')
    s.poly([(18, 9), (22, 10), (19, 12)], 'green')
    s.poly([(10, 9), (15, 2), (16, 8)], 'red', bias=.3)
    eye(s, 16, 8, pupil='#ffd23a', white=False)
    s.px(22, 10, ('fire', 3))
    return s


def sorcerer():
    s = Spr(46, 46)
    p = person(s, 20, 9, 35, 'purple', legs='black', skin='pale', boots='black', sash='gold')
    # a tall pointed hood, a white beard, a staff with a green flame
    s.poly([(p['hx'] - p['hr'] - 1, p['hy'] + 1), (p['hx'] - 2, 0), (p['hx'] + p['hr'] + 1, p['hy'] + 1)], 'purple')
    s.poly([(p['hx'] - 3, p['hy'] + 2), (p['hx'] + 5, p['hy'] + 2), (p['hx'] + 1, p['hy'] + 13)], 'white')
    s.line(33, 8, 31, 44, 'bark', 2, 2)
    s.ellipse(33, 6, 3.5, 4.5, 'green', bias=.4)
    s.px(33, 5, ('green', 4))
    return s


def bonehorse():
    s = Spr(55, 55)
    # the skeleton horse: ribs, a skull head, ghostly green mane
    for x in (10, 16, 34, 40):
        s.line(x, 32, x + (2 if x > 25 else -1), 50, 'bone', 2, 2)
    s.ellipse(25, 28, 16, 8, 'dark', bias=-.2)
    for x in range(13, 38, 4):
        s.line(x, 22, x + 1, 34, 'bone', 3, 1)
    s.line(10, 24, 40, 22, 'bone', 3, 2)
    s.poly([(38, 22), (46, 10), (50, 12), (44, 26)], 'bone')
    s.poly([(44, 9), (54, 14), (52, 19), (46, 17)], 'bone')
    s.px(48, 12, 'k').px(49, 12, '#7aff6a')
    s.poly([(38, 18), (44, 6), (42, 18)], 'ghost', bias=.2)
    s.line(10, 24, 3, 36, 'ghost', 2, 2)
    return s


def chudo():
    s = Spr(37, 37)
    # the miracle-beast: a toad-fish with spines and a wide grin
    s.ellipse(17, 22, 14, 11, 'jade')
    s.ellipse(18, 26, 9, 6, 'bone', bias=.3, edge=False)
    for x in range(6, 28, 4):
        s.poly([(x, 13 + abs(x - 17) // 3), (x + 2, 5 + abs(x - 17) // 3), (x + 4, 13 + abs(x - 17) // 3)], 'red')
    s.ellipse(25, 14, 4, 4, 'jade')
    eye(s, 24, 13, pupil='#d0201a', big=True)
    s.line(20, 24, 31, 22, 'black', 0, 1)
    for x in (22, 25, 28):
        s.px(x, 23, ('bone', 4))
    s.ellipse(8, 32, 4, 2.5, 'jade').ellipse(26, 33, 4, 2.5, 'jade')
    return s


def knight():
    s = Spr(46, 46)
    p = person(s, 19, 3, 41, 'black', legs='black', skin='dark', boots='black', sash='red', eyes=False, nose=False)
    # a black armoured knight: closed helmet with an eye slit, a long sword
    s.ellipse(p['hx'], p['hy'], p['hr'] + 1, p['hr'] + 1, 'dark')
    s.line(p['hx'] - 2, p['hy'], p['hx'] + p['hr'], p['hy'], 'black', 0, 1)
    s.px(int(p['hx']) + 2, int(p['hy']), '#ff3a2a').px(int(p['hx']) + 5, int(p['hy']), '#ff3a2a')
    s.poly([(p['hx'] - 2, p['hy'] - p['hr'] - 6), (p['hx'] + 2, p['hy'] - p['hr'] - 1), (p['hx'] - 3, p['hy'] - p['hr'])], 'red')
    s.line(31, 4, 31, 30, 'steel', 3, 2)
    s.rect(27, 30, 9, 2, 'gold')
    s.rect(30, 32, 3, 5, 'bark')
    s.poly([(3, 14), (11, 14), (11, 28), (7, 32), (3, 28)], 'red')
    return s


def idol():
    s = Spr(69, 69)
    # Idolishche: a huge greedy brute, belly out, a bald head, a golden chain
    s.ellipse(22, 60, 7, 6, 'flesh').ellipse(42, 60, 7, 6, 'flesh')
    s.ellipse(32, 40, 24, 21, 'flesh')
    s.ellipse(34, 44, 15, 13, 'flesh', bias=.35, edge=False)
    s.ellipse(32, 15, 12, 11, 'flesh')
    s.ellipse(10, 38, 7, 12, 'flesh', bias=-.3)
    s.ellipse(55, 38, 7, 12, 'flesh')
    s.poly([(22, 22), (42, 22), (44, 30), (20, 30)], 'red')
    for x in range(20, 46, 3):
        s.px(x, 31 + (x % 2), ('gold', 3))
    eye(s, 32, 12, pupil='#d0201a')
    eye(s, 38, 12, pupil='#d0201a')
    s.line(31, 9, 35, 10, 'black', 0, 1).line(37, 10, 41, 9, 'black', 0, 1)
    s.line(33, 19, 41, 18, 'black', 0, 1)
    s.px(35, 20, ('bone', 4)).px(39, 20, ('bone', 4))
    s.line(56, 50, 64, 22, 'bark', 2, 4)
    s.ellipse(64, 20, 4, 5, 'bark')
    return s


def likho():
    s = Spr(78, 78)
    # Likho One-Eye: a gaunt grey giantess, tangled hair, one huge eye
    s.poly([(26, 56), (32, 56), (30, 76), (22, 76)], 'pale', bias=-.2)
    s.poly([(44, 56), (50, 56), (56, 76), (48, 76)], 'pale', bias=-.2)
    s.poly([(24, 28), (52, 28), (58, 60), (18, 60)], 'black')
    for x in range(20, 58, 6):
        s.poly([(x, 58), (x + 3, 64), (x + 6, 58)], 'black')
    s.ellipse(38, 20, 15, 14, 'pale')
    s.poly([(22, 18), (26, 4), (40, 2), (54, 6), (56, 20), (52, 28), (50, 12), (28, 12), (24, 30)], 'fur')
    s.ellipse(42, 20, 6, 5, 'eye', lv=0, edge=False)
    s.ellipse(43, 20, 3, 3, 'red', lv=2, edge=False)
    s.px(43, 20, 'k').px(44, 20, 'k').px(41, 18, '#ffffff')
    s.line(36, 30, 48, 29, 'black', 0, 1)
    s.line(20, 32, 8, 50, 'pale', 2, 3).line(56, 32, 68, 48, 'pale', 2, 3)
    for d in (-2, 0, 2):
        s.line(68, 48, 70 + d, 54, 'pale', 1, 1).line(8, 50, 6 + d, 56, 'pale', 1, 1)
    return s


def gorynych():
    s = Spr(101, 101)
    # Zmey Gorynych: three heads on long necks, two bat wings, a spiked green body
    for wing in ([(36, 56), (8, 20), (18, 26), (22, 14), (32, 28), (40, 22), (46, 50)],
                 [(56, 54), (66, 22), (72, 32), (82, 26), (84, 40), (94, 40), (70, 60)]):
        s.poly(wing, 'red', bias=.2)
        s.line(wing[0][0], wing[0][1], wing[1][0], wing[1][1], 'red', 0, 1)
    s.poly([(4, 80), (20, 70), (26, 76), (10, 90), (2, 88)], 'green')
    s.ellipse(46, 70, 28, 17, 'green')
    s.ellipse(50, 76, 16, 8, 'gold', bias=.3, edge=False)
    for x in range(24, 68, 6):
        s.poly([(x, 56), (x + 3, 48), (x + 6, 56)], 'gold')
    for x in (28, 42, 58):
        s.ellipse(x, 89, 6, 6, 'green')
        for d in (-3, 0, 3):
            s.px(x + d + 2, 95, ('bone', 4))
    for (nx, ny, hx_, hy_) in ((46, 58, 46, 14), (58, 60, 76, 30), (36, 60, 18, 34)):
        s.line(nx, ny, hx_, hy_ + 5, 'green', 2, 7)
        s.ellipse(hx_ + 2, hy_, 9, 7, 'green')
        s.poly([(hx_ + 6, hy_ - 3), (hx_ + 17, hy_ + 1), (hx_ + 16, hy_ + 7), (hx_ + 5, hy_ + 7)], 'green', bias=.1)
        s.poly([(hx_ - 4, hy_ - 5), (hx_ - 9, hy_ - 13), (hx_ + 1, hy_ - 7)], 'gold')
        s.poly([(hx_ + 1, hy_ - 6), (hx_ - 1, hy_ - 14), (hx_ + 5, hy_ - 7)], 'gold')
        eye(s, hx_ + 4, hy_ - 2, pupil='#d0201a')
        s.line(hx_ + 8, hy_ + 5, hx_ + 16, hy_ + 5, 'red', 2)
        s.px(hx_ + 10, hy_ + 4, ('bone', 4)).px(hx_ + 14, hy_ + 4, ('bone', 4))
    s.poly([(94, 33), (100, 29), (100, 39)], 'fire')
    return s


def thistle():
    s = Spr(37, 37)
    # a thistle: spiky leaves and a purple flower head
    s.line(18, 34, 18, 14, 'leaf', 2, 2)
    for (x0, y0, x1, y1) in ((18, 28, 6, 20), (18, 24, 30, 16), (18, 32, 30, 28), (18, 30, 5, 32)):
        s.poly([(x0, y0), (x1, y1), ((x0 + x1) / 2, y1 + 5)], 'leaf')
        s.px(x1, y1 - 1, ('leaf', 4))
    s.ellipse(18, 12, 6, 5, 'leaf')
    s.ellipse(18, 6, 6, 4.5, 'purple', bias=.3)
    for x in range(13, 24, 2):
        s.line(x, 6, x + (x - 18) // 2, 1, 'pink', 3, 1)
    return s


def koschei():
    s = Spr(55, 55)
    # Koschei the Deathless: tall and gaunt, a skull face, a golden crown,
    # a black cloak with a high collar, a long sword
    s.poly([(8, 54), (14, 18), (36, 18), (42, 54)], 'purple', bias=-.4)
    p = person(s, 24, 7, 47, 'black', legs='black', skin='bone', boots='black', sash='gold', wide=.75, eyes=False, nose=False)
    s.poly([(12, 22), (14, 12), (19, 18)], 'purple').poly([(36, 22), (34, 12), (29, 18)], 'purple')
    skull(s, p['hx'], p['hy'], p['hr'] + 1, glow='#7aff6a')
    s.poly([(p['hx'] - 7, p['hy'] - 5), (p['hx'] - 7, p['hy'] - 13), (p['hx'] - 4, p['hy'] - 9), (p['hx'], p['hy'] - 15),
            (p['hx'] + 4, p['hy'] - 9), (p['hx'] + 7, p['hy'] - 13), (p['hx'] + 7, p['hy'] - 5)], 'gold')
    s.px(int(p['hx']), int(p['hy']) - 9, ('red', 3))
    s.line(p['hx'] - 3, p['hy'] + 6, p['hx'] + 3, p['hy'] + 6, 'black', 0, 1)
    s.line(42, 1, 40, 38, 'steel', 3, 2)
    s.rect(36, 36, 9, 2, 'gold')
    return s


ALL = [bones, snake, guard, dragonling, sorcerer, bonehorse, chudo, knight, idol, likho, gorynych, thistle, koschei]
