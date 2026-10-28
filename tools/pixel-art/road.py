"""Муромская дорога."""
from pix import Spr, eye
from people import person


def bird():
    s = Spr(28, 28)
    # a jackdaw in flight: black with a grey nape
    s.poly([(3, 9), (11, 11), (14, 15), (8, 17), (4, 14)], 'black')
    s.ellipse(14, 15, 7, 4.5, 'black')
    s.ellipse(20, 12, 4, 3.5, 'fur', bias=-.3)
    s.poly([(23, 11), (27, 12.5), (23, 14)], 'gold')
    s.poly([(7, 15), (2, 19), (8, 18)], 'black')
    s.poly([(12, 13), (17, 6), (20, 8), (17, 15)], 'black', bias=.3)
    eye(s, 20, 11, pupil='#f4f4f4', white=False)
    s.px(21, 11, '#e8f0ff')
    return s


def goose():
    s = Spr(37, 37)
    # a swan-goose hissing, wings half open
    s.ellipse(8, 33, 2, 1, 'gold').ellipse(15, 33, 2, 1, 'gold')
    s.line(10, 28, 9, 32, 'gold', 2, 1).line(14, 28, 15, 32, 'gold', 2, 1)
    s.ellipse(14, 23, 11, 7, 'white')
    s.poly([(4, 18), (12, 14), (18, 20), (8, 24)], 'white', bias=.2)
    s.poly([(20, 21), (24, 10), (27, 9), (24, 22)], 'white')
    s.ellipse(27, 8, 4, 3.5, 'white')
    s.poly([(30, 7), (36, 9), (30, 10)], 'fire')
    eye(s, 27, 7, white=False)
    return s


def hornet():
    s = Spr(21, 21)
    s.ellipse(8, 7, 4, 3, 'ghost', bias=.4).ellipse(12, 6, 3.5, 2.6, 'ghost', bias=.4)
    s.ellipse(7, 12, 5, 3.5, 'gold')
    for x in (5, 8):
        s.line(x, 9, x, 15, 'black', 1)
    s.poly([(1, 12), (3, 11), (3, 13)], 'black')
    s.ellipse(13, 12, 3, 2.6, 'black')
    s.ellipse(17, 11.5, 2.6, 2.6, 'gold')
    s.px(18, 11, '#c81e1e')
    s.line(18, 13, 19, 15, 'black', 1)
    return s


def robber():
    s = Spr(35, 35)
    p = person(s, 15, 3, 30, 'red', legs='brown', boots='black')
    # a shaggy black beard, a cap, a club over the shoulder
    s.poly([(p['hx'] - 3, p['hy'] + 1), (p['hx'] + 5, p['hy'] + 1), (p['hx'] + 3, p['hy'] + 7), (p['hx'] - 1, p['hy'] + 7)], 'black')
    s.poly([(p['hx'] - 5, p['hy'] - 2), (p['hx'] - 3, p['hy'] - 6), (p['hx'] + 5, p['hy'] - 6), (p['hx'] + 5, p['hy'] - 2)], 'brown')
    s.line(15, 17, 22, 17, 'black', 1)
    s.line(22, 22, 28, 4, 'wood', 2, 3)
    s.ellipse(28, 5, 3.5, 4, 'wood')
    s.ellipse(22, 22, 2, 2, 'skin')
    return s


def flail():
    s = Spr(51, 51)
    p = person(s, 22, 6, 42, 'blue', legs='black', boots='brown', wide=1.2)
    s.poly([(p['hx'] - 4, p['hy'] + 1), (p['hx'] + 6, p['hy'] + 1), (p['hx'] + 4, p['hy'] + 10), (p['hx'], p['hy'] + 10)], 'wood')
    s.poly([(p['hx'] - 7, p['hy'] - 2), (p['hx'] - 3, p['hy'] - 8), (p['hx'] + 6, p['hy'] - 8), (p['hx'] + 7, p['hy'] - 2)], 'black')
    s.line(18, 30, 29, 30, 'gold', 2, 2)
    # the flail: a handle, a chain and an iron ball swinging up
    s.ellipse(33, 26, 2.5, 2.5, 'skin')
    s.line(33, 26, 38, 20, 'wood', 2, 2)
    for i in range(5):
        s.px(39 + i, 18 - i * 2, ('steel', 2))
    s.ellipse(45, 7, 4.5, 4.5, 'steel')
    for x, y in ((45, 1), (50, 7), (45, 13), (40, 7)):
        s.px(x, y, ('steel', 3))
    return s


def tur():
    s = Spr(60, 60)
    # an aurochs charging: black bull, pale muzzle, great lyre horns
    for x in (12, 20, 36, 44):
        s.rect(x, 40, 5, 14, 'black', bias=-.2)
        s.rect(x - 1, 52, 7, 3, 'dark')
    s.ellipse(28, 34, 22, 13, 'black')
    s.ellipse(38, 30, 9, 9, 'dark', bias=.1, edge=False)
    s.poly([(40, 26), (54, 30), (57, 40), (48, 46), (40, 42)], 'black', bias=.15)
    s.ellipse(54, 40, 4, 4, 'bone')
    s.line(46, 25, 42, 16, 'bone', 3, 2).line(42, 16, 46, 10, 'bone', 4, 2)
    s.line(51, 26, 56, 18, 'bone', 3, 2).line(56, 18, 54, 12, 'bone', 4, 2)
    eye(s, 48, 31, pupil='#d0201a', white=False)
    s.line(6, 28, 3, 40, 'black', 1, 2)
    return s


def rider():
    s = Spr(46, 46)
    # a robber on a brown horse
    for x in (8, 14, 28, 34):
        s.line(x, 32, x + (2 if x > 20 else -1), 43, 'brown', 1, 2)
    s.ellipse(21, 28, 15, 7, 'brown')
    s.poly([(32, 24), (40, 14), (44, 18), (38, 28)], 'brown')
    s.ellipse(42, 16, 4, 3, 'brown')
    s.poly([(30, 22), (38, 12), (36, 22)], 'black')
    s.line(6, 26, 2, 36, 'black', 1, 2)
    eye(s, 41, 14, white=False)
    p = person(s, 22, 2, 26, 'green', legs='blue', boots='black')
    s.poly([(p['hx'] - 3, p['hy'] + 1), (p['hx'] + 5, p['hy'] + 1), (p['hx'] + 2, p['hy'] + 6)], 'brown')
    s.poly([(p['hx'] - 5, p['hy'] - 2), (p['hx'] + 1, p['hy'] - 8), (p['hx'] + 5, p['hy'] - 2)], 'red')
    s.line(25, 16, 34, 6, 'steel', 3, 1)
    return s


def ataman():
    s = Spr(69, 69)
    # the ataman: big belly, red kaftan, fur hat, a curved sabre raised
    p = person(s, 30, 6, 60, 'red', legs='blue', boots='black', wide=1.5)
    s.ellipse(32, 38, 12, 10, 'red', bias=.1)
    s.line(18, 40, 46, 40, 'gold', 2, 3)
    s.ellipse(32, 40, 2.5, 2.5, 'gold')
    s.poly([(p['hx'] - 6, p['hy'] + 2), (p['hx'] + 8, p['hy'] + 2), (p['hx'] + 5, p['hy'] + 14), (p['hx'] - 2, p['hy'] + 14)], 'black')
    s.ellipse(p['hx'], p['hy'] - 6, 10, 5, 'black', bias=.2)
    s.rect(p['hx'] - 6, p['hy'] - 14, 12, 7, 'red')
    s.line(p['hx'] + 1, p['hy'] + 3, p['hx'] + 7, p['hy'] + 3, 'black', 1, 2)
    s.ellipse(50, 26, 3, 3, 'skin')
    s.line(46, 34, 50, 27, 'red', 2, 3)
    for i in range(16):
        s.px(51 + i // 3, 24 - i, ('steel', 3 if i % 3 else 4))
        s.px(52 + i // 3, 24 - i, ('steel', 2))
    s.rect(48, 25, 6, 2, 'gold')
    return s


def son():
    s = Spr(69, 69)
    # Solovey's son: a young giant robber with a long whistle-horn and a cudgel
    p = person(s, 30, 4, 62, 'purple', legs='black', boots='brown', wide=1.4)
    s.poly([(p['hx'] - 8, p['hy'] - 3), (p['hx'] - 4, p['hy'] - 10), (p['hx'] + 6, p['hy'] - 11), (p['hx'] + 9, p['hy'] - 4)], 'gold')
    s.poly([(p['hx'] - 3, p['hy'] + 4), (p['hx'] + 7, p['hy'] + 4), (p['hx'] + 3, p['hy'] + 9)], 'brown')
    s.line(18, 42, 44, 42, 'gold', 2, 2)
    s.line(44, 46, 58, 14, 'wood', 2, 4)
    s.ellipse(58, 13, 5, 6, 'wood')
    for x, y in ((58, 6), (63, 12), (54, 10)):
        s.px(x, y, ('steel', 3))
    s.ellipse(44, 46, 3, 3, 'skin')
    return s


def solovey():
    s = Spr(92, 92)
    # Solovey the Robber perched in his nest on an oak, cheeks puffed, whistling a gale
    s.poly([(36, 60), (54, 60), (58, 90), (32, 90)], 'bark')
    s.line(36, 82, 26, 90, 'bark', 1, 3).line(54, 82, 64, 90, 'bark', 1, 3)
    s.ellipse(45, 56, 30, 10, 'wood')
    for x in range(18, 74, 5):
        s.line(x, 50 + (x % 3), x + 6, 62 - (x % 4), 'straw', 1)
    s.ellipse(45, 30, 19, 18, 'brown')  # a feathered cloak
    s.poly([(26, 30), (16, 50), (30, 50)], 'brown')
    s.poly([(64, 30), (74, 50), (60, 50)], 'brown')
    s.ellipse(48, 24, 11, 11, 'skin')
    s.poly([(40, 30), (58, 30), (55, 46), (50, 50), (44, 44)], 'black')
    s.ellipse(58, 28, 5, 4.5, 'skin', bias=.4)  # cheek puffed with the whistle
    s.ellipse(47, 12, 12, 6, 'brown', bias=.1)  # fur cap
    s.rect(40, 2, 14, 8, 'red')
    eye(s, 49, 20)
    eye(s, 54, 20)
    s.line(48, 17, 52, 18, 'black', 0, 1).line(54, 18, 57, 17, 'black', 0, 1)
    s.ellipse(63, 28, 2.5, 2, 'red')
    # the whistle: rings of wind
    for r, a in ((6, 1), (10, 2), (14, 3)):
        for t in range(-r // 2, r // 2 + 1):
            s.px(66 + r, 27 + t, ('ghost', a))
    s.ellipse(32, 6, 4, 3, 'leaf').ellipse(24, 10, 5, 3.5, 'leaf').ellipse(68, 8, 5, 3.5, 'leaf')
    return s


ALL = [bird, goose, hornet, robber, flail, tur, rider, ataman, son, solovey]
