"""Ground tiles, obstacles and breakable props. One art pixel is one world unit."""
import random
from pix import Spr, M, hx
from PIL import Image


def tile(n, base, specks, seed):
    """A seamless tile: a base colour, soft patches, then small details."""
    rnd = random.Random(seed)
    im = Image.new('RGBA', (n, n), hx(base))
    P = lambda x, y, c: im.putpixel((x % n, y % n), hx(c) if isinstance(c, str) else c)
    for kind, count, cols in specks:
        for _ in range(count):
            x, y = rnd.randrange(n), rnd.randrange(n)
            c = rnd.choice(cols)
            if kind == 'patch':
                r = rnd.randint(4, 9)
                for dy in range(-r, r + 1):
                    for dx in range(-r, r + 1):
                        d = dx * dx + dy * dy
                        if d <= r * r and (d < (r - 2) ** 2 and rnd.random() < .92 or (dx + dy) % 2 == 0):
                            P(x + dx, y + dy, c)
            elif kind == 'tuft':
                for dx, dy in ((0, 0), (-1, -1), (1, -1), (0, -1), (-1, -2), (1, -2)):
                    P(x + dx, y + dy, c if dy > -2 else cols[-1])
            elif kind == 'flower':
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    P(x + dx, y + dy, c)
                P(x, y, '#f2c94a')
            elif kind == 'dot':
                P(x, y, c)
            elif kind == 'pebble':
                P(x, y, c); P(x + 1, y, c); P(x, y + 1, cols[0]); P(x + 1, y + 1, cols[0])
                P(x, y - 1, cols[-1])
    return im


def forest_floor():
    return tile(192, '#6e9a4c', [
        ('patch', 34, ['#668f47', '#76a352']),
        ('tuft', 150, ['#4f7a38', '#5d8740', '#97c068']),
        ('flower', 14, ['#eef0f4', '#e8d0f0']),
        ('dot', 40, ['#c9853a', '#a5622a']),
    ], 7)


def road_floor():
    im = tile(192, '#c4a070', [
        ('patch', 40, ['#bc9868', '#cba97a']),
        ('pebble', 80, ['#8e7454', '#a8a2a0', '#d6d0c8']),
        ('dot', 160, ['#a88454', '#d8bc8e']),
        ('tuft', 20, ['#7a8a44', '#8a9a4c', '#b0c060']),
    ], 11)
    # two worn wheel ruts along the road
    for y0 in (88, 100):
        for x in range(192):
            for dy in (0, 1, 2):
                if (x * 7 + dy) % 13:
                    im.putpixel((x, y0 + dy), hx('#a8845a' if dy != 1 else '#9a774e'))
    return im


def castle_floor():
    """Flagstones: irregular slabs with dark seams and a few cracks."""
    n = 96
    im = Image.new('RGBA', (n, n), hx('#1c1822'))
    rnd = random.Random(5)
    ramp = ['#35303c', '#3b3542', '#403a47', '#37323f']
    rows = [0, 22, 46, 70, 96]
    for r in range(4):
        y0, y1 = rows[r], rows[r + 1]
        x = (r * 17) % 32 - 32
        while x < n:
            w = rnd.choice((24, 28, 32, 36))
            col = hx(rnd.choice(ramp))
            for yy in range(y0 + 1, y1 - 1):
                for xx in range(x + 1, x + w - 1):
                    c = col
                    if yy == y0 + 1 or xx == x + 1:
                        c = tuple(min(255, v + 18) for v in col[:3]) + (255,)
                    elif yy == y1 - 2 or xx == x + w - 2:
                        c = tuple(max(0, v - 16) for v in col[:3]) + (255,)
                    elif rnd.random() < .05:
                        c = tuple(max(0, v - 10) for v in col[:3]) + (255,)
                    im.putpixel((xx % n, yy), c)
            x += w
    for _ in range(6):
        x, y = rnd.randrange(n), rnd.randrange(n)
        for i in range(rnd.randint(3, 7)):
            im.putpixel(((x + i) % n, (y + (i // 2)) % n), hx('#2e2a36'))
    return im


# ---------- obstacles: drawn to the furniture boxes of the sim ----------

def log(w=130, h=54):
    s = Spr(w, h)
    # a fallen trunk: bark with knots and moss, a cut end with rings
    s.rect(4, 8, w - 18, h - 18, 'bark')
    rnd = random.Random(3)
    for _ in range(int(w * h / 60)):
        x, y = rnd.randrange(6, w - 16), rnd.randrange(10, h - 12)
        s.line(x, y, x + rnd.randint(4, 12), y, 'bark', 1)
    for x in range(14, w - 20, 26):
        s.ellipse(x, 12, 6, 3, 'moss')
    s.ellipse(14 + w // 3, h // 2, 3, 2, 'bark', lv=0)
    s.ellipse(w - 14, h / 2 - 1, 9, (h - 18) / 2, 'wood')
    for r in (6.5, 4, 1.6):
        for a in range(0, 360, 6):
            import math
            s.px(int(w - 14 + math.cos(math.radians(a)) * r * .9), int(h / 2 - 1 + math.sin(math.radians(a)) * r * 1.9), ('wood', 1))
    return s


def log_up():
    im = log().image()
    return im.rotate(90, expand=True)


def boulder(w=84, h=84):
    s = Spr(w, h)
    s.ellipse(42, 46, 38, 33, 'stone')
    s.ellipse(56, 58, 20, 18, 'stone', bias=-.15)
    s.ellipse(28, 30, 14, 9, 'stone', bias=.3, edge=False)
    for x, y in ((30, 20), (36, 18), (44, 17), (24, 24)):
        s.ellipse(x, y, 5, 2.5, 'moss')
    s.line(48, 36, 54, 48, 'stone', 0).line(54, 48, 52, 56, 'stone', 0)
    return s


def fir(s, cx, bottom, h):
    """One fir, `h` tall, its trunk foot at (cx, bottom)."""
    hw = h * .5
    s.rect(cx - 2, bottom - 8, 4, 8, 'bark')
    for k, (t0, t1, wk) in enumerate(((0, .45, .55), (.25, .7, .8), (.5, .92, 1.0))):
        top = bottom - h + h * t0
        bot = bottom - h + h * t1
        w2 = hw * wk
        pts = [(cx, top)]
        steps = 4
        for i in range(1, steps + 1):
            y = top + (bot - top) * i / steps
            pts.append((cx + w2 * i / steps, y))
            if i < steps:
                pts.append((cx + w2 * i / steps - 3, y + 1))
        pts += [(cx - x + 2 * cx * 0 - 0, y) for (x, y) in []]
        right = pts[:]
        left = [(2 * cx - x, y) for (x, y) in reversed(right[1:])]
        s.poly(right + left, 'leaf', bias=.05)
    return s


def firs(w=64, h=120):
    s = Spr(w, h)
    fir(s, w * .45, h * .55, h * .52)
    fir(s, w * .55, h - 2, h * .55)
    return s


def firs_side(w=120, h=64):
    s = Spr(w, h)
    fir(s, w * .27, h - 2, h * .95)
    fir(s, w * .7, h - 3, h * .9)
    return s


def bushes(w=120, h=70):
    s = Spr(w, h)
    rnd = random.Random(9)
    for i in range(9):
        x = 14 + (i % 5) * 23 + rnd.randint(-3, 3)
        y = 20 + (i // 5) * 26 + rnd.randint(-3, 3)
        s.ellipse(x, y, 15, 13, 'leaf')
    for _ in range(14):
        x, y = rnd.randrange(8, w - 8), rnd.randrange(10, h - 10)
        s.ellipse(x, y, 1.6, 1.6, 'red', lv=3, edge=False)
    return s


def cart(w=110, h=32):
    s = Spr(w, h + 8)
    # seen from above-front: a plank box with two wheels showing at the sides
    for x in (22, 86):
        s.ellipse(x, h + 2, 10, 5, 'wood')
        s.ellipse(x, h + 2, 2, 1.5, 'bark', lv=0)
    s.rect(2, 2, w - 4, h - 2, 'wood')
    for y in range(8, h, 7):
        s.line(4, y, w - 6, y, 'wood', 1)
    s.rect(8, 6, 40, 12, 'straw')
    s.line(w - 2, h // 2, w + 6, h // 2, 'wood', 2, 2)
    return s


def haystack(w=170, h=80):
    s = Spr(w, h)
    s.ellipse(w / 2, h / 2 + 2, w / 2 - 2, h / 2 - 4, 'straw')
    rnd = random.Random(4)
    for _ in range(120):
        x, y = rnd.randrange(12, w - 12), rnd.randrange(10, h - 10)
        if ((x - w / 2) / (w / 2 - 8)) ** 2 + ((y - h / 2) / (h / 2 - 8)) ** 2 < 1:
            s.line(x, y, x + rnd.randint(-4, 4), y + rnd.randint(2, 6), 'straw', rnd.choice((1, 3)))
    s.line(w * .3, 6, w * .32, h - 6, 'wood', 1, 2)
    return s


def wall_tile(w=40, h=44):
    """A stretch of castle wall, repeated along the shelves."""
    im = Image.new('RGBA', (w, h), hx('#26222f'))
    rows = [(0, 14), (14, 30), (30, 44)]
    for r, (y0, y1) in enumerate(rows):
        off = 0 if r % 2 == 0 else 20
        for x0 in range(-20 + off, w, 20):
            for y in range(y0 + 1, y1 - 1):
                for x in range(x0 + 1, x0 + 19):
                    if 0 <= x < w:
                        c = M['stone'][2]
                        if y == y0 + 1 or x == x0 + 1:
                            c = M['stone'][3]
                        elif y == y1 - 2 or x == x0 + 18:
                            c = M['stone'][1]
                        im.putpixel((x, y), hx(c))
    for x in range(w):
        im.putpixel((x, 0), hx(M['stone'][4]))
    return im


def basket():
    s = Spr(22, 22)
    s.poly([(3, 9), (19, 9), (17, 19), (5, 19)], 'straw')
    for y in (12, 15):
        s.line(4, y, 18, y, 'straw', 1)
    s.ellipse(11, 9, 8, 2.5, 'straw', bias=.2)
    s.ellipse(8, 7, 3, 2.5, 'red').ellipse(14, 7, 3, 2.5, 'red')
    s.px(8, 5, ('leaf', 3)).px(14, 5, ('leaf', 3))
    return s


def barrel():
    s = Spr(22, 22)
    s.ellipse(11, 12, 8, 9, 'wood')
    for y in (6, 17):
        s.line(4, y, 18, y, 'steel', 1)
    s.ellipse(11, 4, 6, 2, 'wood', bias=.3)
    return s


def urn():
    s = Spr(22, 22)
    s.ellipse(11, 13, 7, 7, 'flesh')
    s.rect(8, 3, 6, 5, 'flesh')
    s.ellipse(11, 3, 4, 1.5, 'flesh', lv=0)
    s.line(5, 13, 17, 13, 'gold', 3)
    return s


IMAGES = {
    'floor_flat': forest_floor, 'floor_yard': road_floor, 'floor_warehouse': castle_floor,
    'wall': wall_tile, 'log_up': log_up,
}
SPRITES = {
    'log': log, 'boulder': boulder, 'firs': firs, 'firs_side': firs_side, 'bushes': bushes,
    'cart': cart, 'haystack': haystack, 'basket': basket, 'barrel': barrel, 'urn': urn,
}


def lava(w=60, h=70):
    """The fiery river: molten bands with crusts, seamless along x."""
    rnd = random.Random(2)
    im = Image.new('RGBA', (w, h), hx(M['fire'][1]))
    P = lambda x, y, c: im.putpixel((x % w, y), hx(c))
    for y in range(h):
        for x in range(w):
            v = (abs(y - h / 2) / (h / 2))
            if v > .85:
                P(x, y, M['fire'][0])
            elif (x + y * 3) % 17 < 5 and v < .6:
                P(x, y, M['fire'][2])
    for _ in range(22):
        x, y = rnd.randrange(w), rnd.randrange(8, h - 8)
        for dx in range(-3, 4):
            for dy in (-1, 0, 1):
                if abs(dx) + abs(dy) * 2 < 4:
                    P(x + dx, y + dy, M['fire'][3] if abs(dx) < 2 and dy == 0 else M['fire'][2])
        P(x, y, M['fire'][4])
    for _ in range(6):
        x, y = rnd.randrange(w), rnd.randrange(10, h - 10)
        for dx in range(-2, 3):
            P(x + dx, y, '#3a1a16')
            P(x + dx, y + 1, '#5a2a1e')
    return im


IMAGES['lava'] = lava
