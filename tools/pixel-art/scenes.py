"""Tale frames shown before a location, 192×108, built from the game's own
creatures on painted backdrops."""
import math
import random
from PIL import Image
from pix import Spr, M, hx
import forest, road, castle, world, bogatyr, ilya_vs, vasilisa_vs
from vs import VP

W, H = 192, 108


def pp(im, xy, c):
    x, y = int(xy[0]), int(xy[1])
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), c)


def sky(im, top, bottom, y1=H):
    """A vertical gradient in a few bands with dithered edges."""
    t, b = hx(top), hx(bottom)
    bands = 6
    for y in range(y1):
        f = y / max(1, y1 - 1) * bands
        for x in range(W):
            k = int(f + (0.5 if (x + y) % 2 else 0)) / bands
            k = min(1, k)
            pp(im, (x, y), tuple(int(t[i] + (b[i] - t[i]) * k) for i in range(3)) + (255,))


def stars(im, n, seed, y1=60, col='#fff6d8'):
    rnd = random.Random(seed)
    for _ in range(n):
        pp(im, (rnd.randrange(W), rnd.randrange(y1)), hx(col))


def moon(im, x, y, r, col='#f4ecc8', shade='#c9bf9a'):
    for yy in range(y - r, y + r + 1):
        for xx in range(x - r, x + r + 1):
            d = (xx - x) ** 2 + (yy - y) ** 2
            if d <= r * r:
                c = shade if (xx - x + 2) ** 2 + (yy - y - 1) ** 2 > (r - 1) ** 2 and xx > x else col
                pp(im, (xx, yy), hx(c))


def hills(im, base, amp, col, seed, step=0.05):
    rnd = random.Random(seed)
    ph = rnd.random() * 6
    for x in range(W):
        top = int(base - amp * (0.6 * math.sin(x * step + ph) + 0.4 * math.sin(x * step * 2.3 + ph * 2)))
        for y in range(max(0, top), H):
            pp(im, (x, y), hx(col))


def ground(im, y0, cols, seed):
    """Grass or earth from y0 down, with darker specks."""
    rnd = random.Random(seed)
    for y in range(y0, H):
        for x in range(W):
            pp(im, (x, y), hx(cols[0]))
    for _ in range(W * (H - y0) // 9):
        x, y = rnd.randrange(W), rnd.randrange(y0, H)
        pp(im, (x, y), hx(rnd.choice(cols[1:])))


def firs_row(im, y, h, col, seed, gap=9):
    rnd = random.Random(seed)
    x = -4
    while x < W + 4:
        hh = h + rnd.randint(-4, 4)
        for yy in range(hh):
            half = int(yy * 0.38) + (1 if yy % 4 == 3 else 0)
            for xx in range(x - half, x + half + 1):
                if 0 <= xx < W and 0 <= y - hh + yy < H:
                    pp(im, (xx, y - hh + yy), hx(col))
        x += gap + rnd.randint(0, 4)


def put(im, sprite, x, y, flip=False):
    """Pastes a creature (an Spr or an image) by its bottom middle."""
    s = sprite.image() if isinstance(sprite, Spr) else sprite
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    bb = s.getbbox()
    if bb:
        s = s.crop(bb)
    im.alpha_composite(s, (int(x - s.width / 2), int(y - s.height)))


def hero(name):
    return {'ilya': ilya_vs.c.image(VP), 'vasilisa': vasilisa_vs.c.image(vasilisa_vs.P),
            'dobrynya': bogatyr.dobrynya()[0].image(bogatyr.dobrynya()[1]),
            'alyosha': bogatyr.alyosha()[0].image(bogatyr.alyosha()[1])}[name]


def hut_silhouette(im, x, y, w, col, lit=None):
    for yy in range(y - 12, y):
        for xx in range(x, x + w):
            pp(im, (xx, yy), hx(col))
    for i in range(w // 2 + 3):
        for xx in range(x - 2 + i, x + w + 2 - i):
            yy = y - 12 - i // 1
            if 0 <= yy:
                pp(im, (xx, yy), hx(col))
    if lit:
        for yy in range(y - 9, y - 5):
            for xx in range(x + w // 2 - 2, x + w // 2 + 2):
                pp(im, (xx, yy), hx(lit))


def castle_silhouette(im, x, y, col, glow=None, scale=1.0):
    def rect(x0, y0, w, h):
        for yy in range(int(y0), int(y0 + h)):
            for xx in range(int(x0), int(x0 + w)):
                if 0 <= xx < W and 0 <= yy < H:
                    pp(im, (xx, yy), hx(col))
    k = scale
    rect(x, y - 18 * k, 60 * k, 18 * k)
    for tx, th in ((0, 34), (14, 26), (26, 44), (40, 28), (52, 36)):
        rect(x + tx * k, y - th * k, 8 * k, th * k)
        for i in range(int(6 * k)):
            rect(x + tx * k + i * .7, y - th * k - i, 8 * k - i * 1.4, 1)
    if glow:
        for tx, th in ((2, 26), (28, 36), (54, 28)):
            rect(x + (tx + 2) * k, y - th * k, 2, 3)
            pp(im, (int(x + (tx + 2) * k), int(y - th * k)), hx(glow))


def bats(im, pts):
    for x, y in pts:
        for dx, dy in ((-2, -1), (-1, 0), (0, 0), (1, 0), (2, -1), (-3, -1), (3, -1)):
            pp(im, (x + dx, y + dy), hx('#1e1626'))


# ---------- the frames ----------
def flat1():
    im = Image.new('RGBA', (W, H))
    sky(im, '#1a1430', '#5a3a5a', 80)
    stars(im, 40, 1)
    moon(im, 160, 18, 8)
    hills(im, 70, 6, '#2a2240', 3)
    castle_silhouette(im, 118, 72, '#16121e', glow='#7aff6a', scale=.8)
    for x0 in (0, 90, 140):
        pass
    ground(im, 78, ['#2e3a2a', '#26301f', '#3a4630'], 2)
    for x, lit in ((14, None), (46, None), (78, None)):
        hut_silhouette(im, x, 92, 22, '#3a2a24')
        for yy in range(82, 92):
            pp(im, (x + 10, yy), hx('#1e1626'))
    put(im, forest.bat(), 60, 40)
    put(im, forest.bat(), 92, 30, True)
    put(im, forest.wisp(), 36, 72)
    put(im, forest.bat(), 130, 52)
    return im


def flat2():
    im = Image.new('RGBA', (W, H))
    sky(im, '#f2a868', '#ffe2a8', 70)
    moon(im, 30, 64, 10, '#fff2b8', '#ffd890')
    hills(im, 66, 5, '#8a9a70', 4)
    # the outpost: a palisade with a watchtower
    for x in range(110, 192, 5):
        for y in range(50, 80):
            pp(im, (x, y), hx('#6e4630' if x % 10 else '#4a2e22'))
        pp(im, (x + 2, 49), hx('#4a2e22'))
    for y in range(28, 80):
        for x in range(150, 164):
            pp(im, (x, y), hx('#946342' if x < 157 else '#6e4630'))
    for i in range(10):
        for x in range(146 + i, 168 - i):
            pp(im, (x, 28 - i), hx('#8a5a32'))
    ground(im, 78, ['#5d8740', '#4f7a38', '#7fab58'], 5)
    put(im, hero('dobrynya'), 34, 104)
    put(im, hero('ilya'), 70, 106)
    put(im, hero('alyosha'), 104, 104)
    put(im, hero('vasilisa'), 136, 104)
    return im


def flat3():
    im = Image.new('RGBA', (W, H))
    sky(im, '#142028', '#2a4a3a', 70)
    stars(im, 25, 3, 40)
    moon(im, 40, 16, 7, '#e8f0d0', '#b8c8a8')
    firs_row(im, 76, 40, '#16302a', 1, 10)
    firs_row(im, 84, 34, '#1d3e30', 2, 12)
    ground(im, 84, ['#2a3a26', '#22301f', '#384a30'], 7)
    put(im, forest.hut(), 150, 104)
    put(im, forest.yaga(), 76, 70)
    put(im, forest.wolf(), 26, 104)
    return im


def yard1():
    im = Image.new('RGBA', (W, H))
    sky(im, '#7ab4e0', '#d8eef8', 60)
    hills(im, 56, 4, '#9ab27a', 6)
    ground(im, 58, ['#8aa05a', '#7a9050', '#a0b868'], 8)
    # the road narrowing to the horizon
    for y in range(58, H):
        k = (y - 58) / (H - 58)
        half = 3 + k * 60
        for x in range(int(96 - half), int(96 + half)):
            pp(im, (x, y), hx('#b89262' if (x + y) % 7 else '#a88454'))
    rnd = random.Random(4)
    for _ in range(260):
        x, y = rnd.randrange(W), rnd.randrange(64, H)
        for i in range(rnd.randint(2, 6)):
            if 0 <= y - i:
                pp(im, (x, y - i), hx(rnd.choice(('#6a8a3a', '#8aaa4a', '#b0c860'))))
    # the stone at the crossroads
    s = Spr(28, 30)
    s.poly([(3, 29), (5, 6), (14, 1), (24, 6), (26, 29)], 'stone')
    for y in (10, 14, 18):
        s.line(9, y, 20, y, 'stone', 0)
    s.ellipse(8, 4, 4, 2, 'moss')
    put(im, s, 40, 92)
    put(im, road.bird(), 140, 26)
    put(im, road.bird(), 160, 34, True)
    return im


def yard2():
    im = Image.new('RGBA', (W, H))
    sky(im, '#5a6a8a', '#a8b4c4')
    ground(im, 84, ['#5d8740', '#4f7a38', '#6e9a4c'], 9)
    # oaks swaying in the wind
    for x, r in ((20, 18), (58, 20), (150, 18), (182, 16)):
        for y in range(56, 86):
            for xx in range(x - 3, x + 3):
                pp(im, (xx, y), hx('#4a2e22'))
        for yy in range(-r, r):
            for xx in range(-r, r):
                if xx * xx + yy * yy * 1.5 < r * r:
                    c = '#2c5a30' if xx + yy > 0 else '#3d7a3c'
                    pp(im, (max(0, min(W - 1, x + xx + yy // 4)), 50 + yy), hx(c))
    put(im, road.solovey(), 104, 108)
    for y, x0, x1 in ((40, 124, 186), (52, 130, 192), (64, 126, 180)):
        for x in range(x0, x1, 2):
            pp(im, (x, y + int(2 * math.sin(x / 5))), hx('#e0f0ff'))
    return im


def yard3():
    im = Image.new('RGBA', (W, H))
    sky(im, '#e8986a', '#f8d8a0', 62)
    hills(im, 60, 5, '#a0885a', 2)
    ground(im, 64, ['#c4a070', '#b89262', '#d0b080'], 3)
    put(im, hero('ilya'), 44, 104)
    put(im, hero('alyosha'), 20, 98)
    put(im, road.robber(), 118, 100, True)
    put(im, road.flail(), 146, 104, True)
    put(im, road.ataman(), 176, 104, True)
    return im


def wh1():
    im = Image.new('RGBA', (W, H))
    sky(im, '#1a0e16', '#6a2420', 64)
    castle_silhouette(im, 112, 62, '#120c14', glow='#ff5a2a', scale=1.2)
    hills(im, 62, 2, '#1e1218', 7)
    lava = world.lava()
    for x in range(0, W, lava.width):
        im.alpha_composite(lava.crop((0, 20, lava.width, 50)), (x, 70))
    # Kalinov bridge
    for x in range(30, 160):
        y = 68 - int(10 * math.sin((x - 30) / 130 * math.pi))
        for yy in range(y, y + 4):
            pp(im, (x, yy), hx('#4a4552' if yy > y else '#6e6a78'))
        if x % 18 == 0:
            for yy in range(y + 4, 100):
                if yy < H:
                    pp(im, (x, yy), hx('#2c2a38'))
                    pp(im, (x + 1, yy), hx('#2c2a38'))
    ground(im, 100, ['#2a1e22', '#1e161a', '#3a2a2a'], 4)
    return im


def wh2():
    im = Image.new('RGBA', (W, H))
    sky(im, '#2a0e18', '#8a3a24', 70)
    lava = world.lava()
    for x in range(0, W, lava.width):
        im.alpha_composite(lava.crop((0, 10, lava.width, 40)), (x, 78))
    for x in range(0, W):
        for yy in range(74, 80):
            pp(im, (x, yy), hx('#4a4552' if yy > 75 else '#6e6a78'))
    put(im, castle.gorynych(), 120, 80)
    put(im, castle.bones(), 26, 76)
    put(im, castle.bones(), 44, 76)
    put(im, castle.guard(), 64, 76)
    put(im, castle.bones(), 180, 76, True)
    return im


def wh3():
    im = Image.new('RGBA', (W, H))
    sky(im, '#101828', '#3a4a6a', 80)
    stars(im, 30, 9, 50)
    ground(im, 86, ['#2a3a2a', '#22301f', '#384a30'], 1)
    # the great oak with a chest on chains
    for y in range(30, 90):
        for x in range(60, 74):
            pp(im, (x, y), hx('#4a2e22' if x > 66 else '#6e4630'))
    for yy in range(-26, 22):
        for xx in range(-50, 50):
            if (xx / 50) ** 2 + (yy / 24) ** 2 < 1 and random.Random(xx * 99 + yy).random() < .97:
                pp(im, (67 + xx, 26 + yy), hx('#1f3a26' if xx + yy > 10 else '#2c5a30'))
    for y in range(40, 58):
        pp(im, (92, y), hx('#a8a2a0'))
    chest = Spr(20, 16)
    chest.rect(1, 3, 18, 12, 'wood').line(1, 8, 18, 8, 'gold', 2).rect(8, 6, 4, 4, 'gold')
    put(im, chest, 92, 72)
    # hare, duck, egg, needle in a row: where Koschei's death hides
    hare = Spr(20, 16)
    hare.ellipse(9, 10, 7, 5, 'pale').ellipse(15, 6, 4, 3.5, 'pale')
    hare.line(14, 3, 13, -2, 'pale', 2, 2).line(17, 3, 18, -2, 'pale', 2, 2)
    hare.px(16, 5, 'k')
    duck = Spr(20, 16)
    duck.ellipse(9, 10, 7, 4.5, 'brown').ellipse(15, 5, 3.5, 3, 'green').poly([(17, 5), (20, 6), (17, 7)], 'gold')
    duck.px(15, 4, 'k')
    egg = Spr(10, 12)
    egg.ellipse(5, 6, 3.5, 5, 'white')
    needle = Spr(14, 6)
    needle.line(1, 3, 12, 3, 'steel', 4).px(1, 3, ('steel', 0))
    for sp, x in ((hare, 120), (duck, 142), (egg, 160), (needle, 176)):
        put(im, sp, x, 96)
    put(im, castle.koschei(), 30, 104)
    return im


SCENES = {'tale_flat_0': flat1, 'tale_flat_1': flat2, 'tale_flat_2': flat3,
          'tale_yard_0': yard1, 'tale_yard_1': yard2, 'tale_yard_2': yard3,
          'tale_warehouse_0': wh1, 'tale_warehouse_1': wh2, 'tale_warehouse_2': wh3}

if __name__ == '__main__':
    ims = [f() for f in SCENES.values()]
    sh = Image.new('RGBA', (W * 3 + 16, H * 3 + 16), (20, 18, 26, 255))
    for i, im in enumerate(ims):
        sh.alpha_composite(im, (4 + (i % 3) * (W + 4), 4 + (i // 3) * (H + 4)))
    sh.resize((sh.width * 3, sh.height * 3), Image.NEAREST).save('scenes-preview.png')
