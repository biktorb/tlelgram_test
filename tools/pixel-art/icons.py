"""Item and interface icons, 20×20, in the same kit as the creatures."""
import math
from pix import Spr, eye

N = 20


def _s():
    return Spr(N, N)


# ---------- weapons ----------
def w_sword():
    s = _s()
    s.line(4, 16, 14, 6, 'steel', 3, 2)
    s.line(5, 15, 14, 6, 'steel', 4, 1)
    s.poly([(13, 4), (17, 3), (16, 7)], 'steel')
    s.line(2, 13, 7, 18, 'gold', 3, 2)
    s.line(2, 18, 4, 16, 'bark', 2, 2)
    s.px(1, 19, ('gold', 3))
    return s


def w_feather():
    s = _s()
    s.poly([(3, 2), (9, 3), (15, 9), (18, 16), (13, 15), (7, 10)], 'fire', bias=.2)
    s.poly([(6, 4), (9, 5), (13, 9), (10, 9)], 'fire', lv=4, edge=False)
    s.line(4, 3, 18, 18, 'fire', 0, 1)
    return s


def w_arrows():
    s = _s()
    for dy in (0,):
        s.line(2, 17, 15, 4, 'wood', 3, 1)
        s.poly([(13, 3), (18, 1), (16, 6)], 'steel')
        s.poly([(1, 15), (4, 15), (4, 18), (2, 19)], 'white')
    return s


def w_charm():
    s = _s()
    s.ellipse(10, 11, 8, 8, 'gold')
    s.ellipse(10, 11, 5, 5, 'red')
    s.line(10, 7, 10, 15, 'gold', 3).line(6, 11, 14, 11, 'gold', 3)
    s.line(10, 0, 10, 3, 'bark', 2)
    return s


def w_gusli():
    s = _s()
    # a wing-shaped psaltery: a wooden board, a sound hole, strings fanning out
    s.poly([(1, 15), (5, 4), (19, 8), (18, 17)], 'wood')
    s.ellipse(9, 11, 2.2, 2, 'bark', lv=0, edge=False)
    for i in range(5):
        s.line(4 + i, 14 - i * 2 + 1, 17, 9 + i * 2 - 1, 'gold', 4)
    s.line(4, 5, 2, 15, 'red', 2, 1)
    return s


def w_water():
    s = _s()
    # a flask of living water
    s.rect(8, 2, 4, 3, 'wood')
    s.poly([(8, 5), (12, 5), (12, 7), (17, 12), (16, 17), (4, 17), (3, 12), (8, 7)], 'ghost')
    s.poly([(5, 12), (15, 12), (15, 16), (5, 16)], 'blue', bias=.3, edge=False)
    s.px(6, 9, ('white', 4)).px(6, 10, ('white', 4))
    return s


def w_axe():
    s = _s()
    s.line(4, 18, 11, 4, 'wood', 2, 2)
    s.poly([(9, 3), (17, 1), (19, 9), (12, 10)], 'steel')
    s.line(17, 2, 19, 8, 'steel', 4, 1)
    return s


def w_bolt():
    s = _s()
    s.poly([(11, 1), (4, 11), (9, 11), (6, 19), (16, 7), (11, 7), (14, 1)], 'gold', bias=.3)
    return s


# ---------- evolutions: richer versions with a glow ----------
def _glow(s, col='gold'):
    for a in range(0, 360, 45):
        x = 10 + math.cos(math.radians(a)) * 9
        y = 10 + math.sin(math.radians(a)) * 9
        s.px(int(x), int(y), (col, 4))
    return s


def e_sword():
    s = _s()
    _glow(s, 'ghost')
    s.line(4, 16, 15, 5, 'ghost', 3, 3)
    s.line(5, 15, 15, 5, 'white', 4, 1)
    s.poly([(14, 3), (18, 2), (17, 6)], 'ghost')
    s.line(2, 13, 7, 18, 'gold', 3, 2)
    s.px(2, 18, ('red', 3))
    return s


def e_firebird():
    s = _s()
    s.poly([(2, 16), (6, 10), (4, 4), (10, 9), (12, 3), (13, 10), (18, 8), (14, 14), (8, 17)], 'fire', bias=.2)
    s.ellipse(14, 9, 3, 2.5, 'fire', bias=.4)
    s.poly([(16, 8), (19, 9), (16, 10)], 'gold')
    s.px(14, 8, 'k')
    s.line(2, 16, 1, 19, 'fire', 3).line(5, 17, 5, 19, 'fire', 3)
    return s


def e_arrows():
    s = _s()
    for d in (-4, 0, 4):
        s.line(2 + d // 2, 17 + d // 2, 14 + d, 5 + d // 2 - 2, 'wood', 3, 1)
        s.poly([(13 + d, 3 + d // 2 - 2), (17 + d, 2 + d // 2 - 2), (15 + d, 6 + d // 2 - 2)], 'steel')
    return s


def e_charms():
    s = _s()
    for (x, y) in ((6, 6), (14, 6), (10, 14)):
        s.ellipse(x, y, 4.5, 4.5, 'gold')
        s.ellipse(x, y, 2.4, 2.4, 'red')
    return s


def e_gusli():
    s = w_gusli()
    _glow(s)
    s.poly([(1, 15), (5, 4), (19, 8), (18, 17)], 'gold')
    for i in range(5):
        s.line(4 + i, 14 - i * 2 + 1, 17, 9 + i * 2 - 1, 'white', 4)
    return s


def e_sea():
    s = _s()
    s.ellipse(10, 14, 9, 5, 'blue')
    s.poly([(2, 12), (6, 5), (11, 3), (15, 6), (11, 7), (9, 11)], 'ghost', bias=.2)
    s.px(12, 5, ('white', 4)).px(4, 13, ('white', 4)).px(15, 14, ('white', 4))
    return s


def e_axes():
    s = _s()
    s.line(3, 18, 10, 4, 'wood', 2, 2).line(17, 18, 10, 4, 'wood', 2, 2)
    s.poly([(7, 4), (1, 2), (0, 9), (6, 9)], 'steel')
    s.poly([(13, 4), (19, 2), (20, 9), (14, 9)], 'steel')
    return s


def e_storm():
    s = _s()
    s.ellipse(7, 7, 5, 4, 'stone').ellipse(13, 6, 6, 5, 'stone').ellipse(10, 9, 8, 3.5, 'stone')
    s.poly([(10, 10), (6, 16), (9, 16), (7, 20), (14, 13), (11, 13), (13, 10)], 'gold', bias=.4)
    return s


# ---------- passives and power-ups ----------
def p_bread():
    s = _s()
    s.ellipse(10, 12, 9, 6, 'wood')
    s.ellipse(10, 10, 7, 4, 'wood', bias=.3)
    for x in (6, 10, 14):
        s.line(x - 1, 9, x + 1, 12, 'wood', 1)
    s.ellipse(10, 6, 2, 1.5, 'straw', lv=3)
    return s


def p_book():
    s = _s()
    s.poly([(3, 4), (16, 3), (17, 16), (4, 17)], 'purple')
    s.poly([(5, 15), (17, 15), (17, 17), (5, 18)], 'white', lv=3, edge=False)
    s.ellipse(10, 9, 3, 3, 'gold')
    s.px(10, 9, ('red', 3))
    s.line(4, 4, 5, 17, 'purple', 0)
    return s


def p_bracers():
    s = _s()
    s.poly([(3, 6), (9, 4), (10, 15), (4, 17)], 'steel')
    s.poly([(11, 4), (17, 6), (16, 17), (10, 15)], 'steel', bias=-.2)
    for y in (8, 12):
        s.line(4, y, 9, y - 1, 'gold', 3).line(11, y - 1, 16, y, 'gold', 3)
    return s


def p_spindle():
    s = _s()
    s.line(10, 1, 10, 19, 'wood', 2, 2)
    s.ellipse(10, 12, 4, 3, 'wood')
    s.ellipse(10, 8, 3.5, 4, 'red')
    for y in range(6, 11, 2):
        s.line(7, y, 13, y + 1, 'red', 3)
    return s


def p_apple():
    s = _s()
    s.ellipse(10, 12, 7, 7, 'gold', bias=.1)
    s.ellipse(7, 9, 2, 1.5, 'gold', lv=4, edge=False)
    s.line(10, 5, 11, 2, 'bark', 1, 1)
    s.ellipse(14, 3, 3, 1.6, 'leaf')
    return s


def p_magnet():
    s = _s()
    s.ellipse(10, 9, 8, 8, 'red')
    s.ellipse(10, 9, 4, 4, None or 'red', lv=0)
    s.c = [[None if (r and r[0] == '#4e1420' and y > 2 and abs(x - 9.5) < 4 and y < 13) else r for x, r in enumerate(row)] for y, row in enumerate(s.c)]
    s.rect(2, 9, 6, 6, 'red').rect(12, 9, 6, 6, 'red')
    s.rect(2, 14, 6, 4, 'steel').rect(12, 14, 6, 4, 'steel')
    s.c = [[None if (6 < x < 13 and y > 8) else r for x, r in enumerate(row)] for y, row in enumerate(s.c)]
    return s


def p_fist():
    s = _s()
    s.ellipse(11, 9, 7, 6, 'skin')
    for x in (7, 10, 13):
        s.line(x, 5, x, 8, 'skin', 1)
    s.ellipse(6, 11, 3, 3, 'skin', bias=.2)
    s.rect(7, 14, 9, 5, 'red')
    s.line(7, 14, 16, 14, 'gold', 3)
    return s


def p_mirror():
    s = _s()
    s.line(10, 14, 10, 19, 'gold', 2, 2)
    s.ellipse(10, 8, 7, 7.5, 'gold')
    s.ellipse(10, 8, 5, 5.5, 'ghost', bias=.4)
    s.line(7, 6, 9, 4, 'white', 4)
    return s


def p_kasha():
    s = _s()
    s.poly([(2, 9), (18, 9), (15, 17), (5, 17)], 'bark')
    s.ellipse(10, 9, 8, 3, 'straw')
    s.line(13, 9, 18, 2, 'wood', 3, 2)
    s.line(4, 13, 16, 13, 'gold', 2)
    return s


def p_horseshoe():
    s = _s()
    for a in range(-30, 211, 6):
        x = 10 + math.cos(math.radians(a)) * 6.5
        y = 9 + math.sin(math.radians(-a)) * -6.5 + 0
    s.ellipse(10, 9, 8, 8, 'steel')
    s.c = [[None if ((x - 9.5) ** 2 + (y - 8.5) ** 2 < 16 or (y > 9 and 6 < x < 13)) else r for x, r in enumerate(row)] for y, row in enumerate(s.c)]
    for x, y in ((3, 8), (16, 8), (5, 3), (14, 3)):
        s.px(x, y, ('stone', 0))
    return s


def p_kvass():
    s = _s()
    s.rect(4, 6, 10, 12, 'wood')
    s.ellipse(9, 6, 5, 2, 'straw', lv=4)
    for y in (9, 14):
        s.line(4, y, 13, y, 'steel', 3)
    s.poly([(14, 8), (18, 9), (18, 14), (14, 15)], 'wood')
    s.c = [[None if (15 <= x <= 16 and 10 <= y <= 13) else r for x, r in enumerate(row)] for y, row in enumerate(s.c)]
    return s


def p_purse():
    s = _s()
    s.ellipse(10, 13, 7, 6, 'brown')
    s.poly([(6, 7), (14, 7), (12, 9), (8, 9)], 'brown')
    s.line(7, 8, 13, 8, 'gold', 3)
    s.ellipse(10, 13, 2.5, 2.5, 'gold')
    return s


def p_shield():
    s = _s()
    s.poly([(3, 3), (17, 3), (17, 10), (10, 18), (3, 10)], 'red')
    s.poly([(9, 5), (11, 5), (11, 9), (15, 9), (15, 11), (11, 11), (11, 15), (9, 15), (9, 11), (5, 11), (5, 9), (9, 9)], 'gold', bias=.3)
    return s


def p_boots():
    s = _s()
    s.poly([(4, 2), (10, 2), (10, 13), (17, 14), (17, 18), (3, 18)], 'red')
    s.line(4, 4, 10, 4, 'gold', 3, 2)
    s.line(3, 17, 17, 17, 'bark', 1, 1)
    return s


def p_clover():
    s = _s()
    for (x, y) in ((7, 6), (13, 6), (7, 12), (13, 12)):
        s.ellipse(x, y, 3.6, 3.6, 'leaf')
    s.line(11, 11, 15, 19, 'leaf', 1, 1)
    return s


def p_crown():
    s = _s()
    s.poly([(2, 16), (2, 6), (6, 10), (10, 3), (14, 10), (18, 6), (18, 16)], 'gold')
    s.line(2, 14, 18, 14, 'gold', 1)
    for x, c in ((6, 'red'), (10, 'blue'), (14, 'green')):
        s.px(x, 12, (c, 3))
    return s


def p_dice():
    s = _s()
    s.poly([(3, 7), (11, 4), (17, 7), (17, 15), (9, 18), (3, 15)], 'white')
    s.line(9, 10, 9, 18, 'white', 1).line(3, 7, 9, 10, 'white', 1).line(9, 10, 17, 7, 'white', 1)
    for x, y in ((10, 6), (5, 11), (7, 14), (13, 12), (15, 14), (12, 15)):
        s.px(x, y, ('red', 1))
    return s


def p_wind():
    s = _s()
    for y, w in ((5, 12), (10, 16), (15, 10)):
        s.line(2, y, 2 + w, y, 'ghost', 3, 2)
        s.ellipse(2 + w, y - 2, 2.5, 2.5, 'ghost')
        s.px(int(2 + w), y - 2, ('ghost', 0))
    return s


# ---------- pickups ----------
def k_pie():
    s = _s()
    s.ellipse(10, 12, 9, 5.5, 'wood')
    s.ellipse(10, 10, 8, 4, 'wood', bias=.35)
    for x in (6, 10, 14):
        s.px(x, 10, ('bark', 1))
    return s


def k_whirl():
    s = _s()
    for i, (y, w) in enumerate(((4, 16), (8, 12), (12, 8), (16, 5))):
        s.ellipse(10 + i - 1, y, w / 2, 2, 'ghost', bias=.2)
    return s


def k_bell():
    s = _s()
    s.poly([(10, 2), (14, 5), (15, 13), (18, 16), (2, 16), (5, 13), (6, 5)], 'gold')
    s.ellipse(10, 17, 2, 2, 'bark')
    s.px(10, 1, ('gold', 1))
    return s


def k_herb():
    s = _s()
    for (x1, y1) in ((4, 4), (10, 2), (16, 5), (6, 9), (14, 10)):
        s.line(10, 18, x1, y1, 'leaf', 2, 1)
        s.ellipse(x1, y1, 2.2, 1.6, 'leaf')
    s.ellipse(10, 3, 2, 2, 'purple', lv=3)
    s.ellipse(4, 4, 1.6, 1.6, 'purple', lv=3)
    return s


def k_chest():
    s = _s()
    s.rect(2, 8, 16, 10, 'wood')
    s.poly([(2, 8), (4, 3), (16, 3), (18, 8)], 'wood', bias=.3)
    for x in (2, 17):
        s.line(x, 4, x, 17, 'gold', 2)
    s.line(2, 8, 17, 8, 'gold', 2)
    s.rect(8, 7, 4, 4, 'gold')
    s.px(10, 9, 'k')
    return s


def k_leaf():
    s = _s()
    s.poly([(3, 16), (5, 8), (11, 3), (17, 4), (15, 11), (8, 16)], 'fire', bias=-.2)
    s.line(3, 17, 15, 5, 'fire', 0)
    return s


def k_coin():
    s = _s()
    s.ellipse(10, 10, 8, 8, 'gold')
    s.ellipse(10, 10, 5, 5, 'gold', bias=.3, edge=False)
    s.line(10, 6, 10, 14, 'gold', 1).line(8, 7, 12, 7, 'gold', 1)
    return s


# ---------- interface ----------
def u_map():
    s = _s()
    s.poly([(2, 4), (7, 2), (13, 4), (18, 2), (18, 16), (13, 18), (7, 16), (2, 18)], 'straw')
    s.line(7, 2, 7, 16, 'straw', 1).line(13, 4, 13, 18, 'straw', 1)
    s.line(4, 13, 8, 9, 'red', 2).line(8, 9, 12, 11, 'red', 2).line(12, 11, 15, 6, 'red', 2)
    s.px(15, 6, ('red', 1)).px(14, 5, ('red', 1)).px(16, 7, ('red', 1))
    return s


def u_sun():
    s = _s()
    for a in range(0, 360, 30):
        s.line(10, 10, 10 + math.cos(math.radians(a)) * 9, 10 + math.sin(math.radians(a)) * 9, 'fire', 3)
    s.ellipse(10, 10, 5.5, 5.5, 'gold')
    return s


def u_cup():
    s = _s()
    s.poly([(4, 2), (16, 2), (15, 9), (11, 12), (9, 12), (5, 9)], 'gold')
    s.rect(9, 12, 2, 3, 'gold').rect(5, 15, 10, 3, 'gold')
    s.line(4, 4, 1, 4, 'gold', 1).line(1, 4, 4, 9, 'gold', 1)
    s.line(16, 4, 19, 4, 'gold', 1).line(19, 4, 16, 9, 'gold', 1)
    return s


def u_swords():
    s = _s()
    s.line(3, 3, 16, 16, 'steel', 3, 2).line(16, 3, 3, 16, 'steel', 3, 2)
    s.line(13, 17, 17, 13, 'gold', 3, 2).line(3, 13, 7, 17, 'gold', 3, 2)
    return s


def u_scroll():
    s = _s()
    s.rect(4, 4, 12, 12, 'straw')
    s.ellipse(4, 10, 2, 7, 'wood').ellipse(16, 10, 2, 7, 'wood')
    for y in (7, 10, 13):
        s.line(7, y, 13, y, 'bark', 1)
    return s


def u_skull():
    s = _s()
    s.ellipse(10, 9, 7, 6.5, 'bone')
    s.rect(6, 13, 8, 4, 'bone')
    s.rect(6, 8, 3, 3, 'black', lv=0).rect(11, 8, 3, 3, 'black', lv=0)
    s.px(10, 12, ('black', 0))
    for x in (7, 9, 11, 13):
        s.px(x, 16, ('bone', 1))
    return s


def u_ghost():
    s = _s()
    s.poly([(4, 18), (4, 8), (7, 3), (13, 3), (16, 8), (16, 18), (13, 15), (10, 18), (7, 15)], 'ghost', bias=.3)
    s.px(8, 8, 'k').px(12, 8, 'k')
    return s


def u_lock():
    s = _s()
    s.ellipse(10, 7, 5, 5, 'steel')
    s.c = [[None if (x - 9.5) ** 2 + (y - 6.5) ** 2 < 8 else r for x, r in enumerate(row)] for y, row in enumerate(s.c)]
    s.rect(4, 9, 12, 9, 'gold')
    s.px(10, 12, 'k').px(10, 13, 'k')
    return s


def u_star():
    s = _s()
    pts = []
    for i in range(10):
        r = 9 if i % 2 == 0 else 4
        a = math.radians(-90 + i * 36)
        pts.append((10 + math.cos(a) * r, 10.5 + math.sin(a) * r))
    s.poly(pts, 'gold')
    return s


def u_heart():
    s = _s()
    s.ellipse(6.5, 7, 4.5, 4.5, 'red').ellipse(13.5, 7, 4.5, 4.5, 'red')
    s.poly([(2, 8), (18, 8), (10, 18)], 'red')
    s.px(5, 5, ('red', 4))
    return s


ITEMS = {
    # weapons and their evolutions
    'claws': w_sword, 'laser': w_feather, 'fish': w_arrows, 'yarn': w_charm, 'meow': w_gusli,
    'glass': w_water, 'pot': w_axe, 'spark': w_bolt,
    'evo:claws': e_sword, 'evo:laser': e_firebird, 'evo:fish': e_arrows, 'evo:yarn': e_charms,
    'evo:meow': e_gusli, 'evo:glass': e_sea, 'evo:pot': e_axes, 'evo:spark': e_storm,
    # passives and the extras
    'belly': p_bread, 'box': p_book, 'paws': p_bracers, 'patience': p_spindle, 'purr': p_apple,
    'catnip': p_magnet, 'bigpaws': p_fist, 'pack': p_mirror, 'food': p_kasha, 'blackcat': p_horseshoe,
    'snack': p_kvass, 'fishes': p_purse,
    # power-ups that have no passive of their own
    'shield': p_shield, 'boots': p_boots, 'clover': p_clover, 'crown': p_crown, 'dice': p_dice, 'wind': p_wind,
    # pickups
    'pie': k_pie, 'whirl': k_whirl, 'bell': k_bell, 'herb': k_herb, 'chest': k_chest, 'leaf': k_leaf, 'coin': k_coin,
    # interface
    'map': u_map, 'sun': u_sun, 'cup': u_cup, 'swords': u_swords, 'scroll': u_scroll, 'skull': u_skull,
    'ghost': u_ghost, 'lock': u_lock, 'star': u_star, 'heart': u_heart,
}
ALL = list(ITEMS.values())
