"""Weapon pictures: arrow points right, the feather leans as the old one did."""
from pix import Spr


def arrow():
    s = Spr(24, 24)
    s.line(3, 12, 18, 12, 'wood', 3, 1)
    s.poly([(17, 9), (23, 12), (17, 15)], 'steel')
    for d in (-1, 1):
        s.poly([(2, 12), (7, 12), (5, 12 + d * 4), (0, 12 + d * 4)], 'white')
    return s


def feather():
    s = Spr(24, 24)
    # the firebird's feather, tilted with its tip to the upper left
    s.poly([(4, 3), (10, 4), (17, 11), (20, 18), (15, 17), (8, 12)], 'fire', bias=.2)
    s.poly([(7, 5), (11, 6), (15, 11), (12, 11)], 'fire', lv=4, edge=False)
    s.line(5, 4, 21, 21, 'fire', 0, 1)
    s.px(22, 22, ('fire', 0))
    return s


def axe():
    s = Spr(24, 24)
    s.line(6, 22, 13, 5, 'wood', 2, 2)
    s.poly([(11, 4), (20, 2), (23, 10), (14, 11)], 'steel')
    s.line(21, 3, 23, 9, 'steel', 4, 1)
    return s


def charm():
    s = Spr(24, 24)
    # a round amulet: gold rim, red enamel, a sun cross
    s.ellipse(12, 12, 10, 10, 'gold')
    s.ellipse(12, 12, 6.5, 6.5, 'red')
    s.line(12, 7, 12, 17, 'gold', 3).line(7, 12, 17, 12, 'gold', 3)
    s.ellipse(12, 12, 2, 2, 'gold', lv=4, edge=False)
    return s


ALL = [arrow, feather, axe, charm]
