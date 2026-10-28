"""Draws every picture and packs them into one atlas for the client:
packages/client/src/cats/art/atlas.png and atlas.json ({name: [x, y, w, h]}).
Run: python3 tools/pixel-art/build.py"""
import json
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import forest, road, castle, weapons, world, bogatyr, ilya_vs, vasilisa_vs  # noqa: E402
from vs import VP  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '../../packages/client/src/cats/art')


def hero(c, pal):
    # Heroes are 34×46; they stand centred in a 48×48 box like the old ones.
    im = Image.new('RGBA', (48, 48))
    im.alpha_composite(c.image(pal), (7, 1))
    return im


def pictures():
    pics = {
        'ilya': hero(ilya_vs.c, VP),
        'dobrynya': hero(*bogatyr.dobrynya()),
        'alyosha': hero(*bogatyr.alyosha()),
        'vasilisa': hero(vasilisa_vs.c, vasilisa_vs.P),
    }
    for mod in (forest, road, castle, weapons):
        for f in mod.ALL:
            pics[f.__name__] = f().image()
    for name, f in world.SPRITES.items():
        pics[name] = f().image()
    for name, f in world.IMAGES.items():
        pics[name] = f()
    return pics


def pack(pics, width=1024):
    order = sorted(pics, key=lambda n: (-pics[n].height, n))
    x = y = row = 0
    rects = {}
    for n in order:
        w, h = pics[n].size
        if x + w > width:
            x, y, row = 0, y + row + 1, 0
        rects[n] = [x, y, w, h]
        x += w + 1
        row = max(row, h)
    atlas = Image.new('RGBA', (width, y + row))
    for n, (x, y, w, h) in rects.items():
        atlas.alpha_composite(pics[n], (x, y))
    return atlas, dict(sorted(rects.items()))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    atlas, rects = pack(pictures())
    atlas.save(os.path.join(OUT, 'atlas.png'), optimize=True)
    with open(os.path.join(OUT, 'atlas.json'), 'w') as f:
        json.dump(rects, f, separators=(',', ':'))
        f.write('\n')
    print(atlas.size, len(rects), 'pictures')
