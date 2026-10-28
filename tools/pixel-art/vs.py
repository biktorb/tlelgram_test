# VS-style hero sprites: taller figures, 4-step hue-shifted ramps, dark outline.
from PIL import Image
VP = {
 'k':'#1e1626',
 'H':'#f2f5f8','h':'#bcc5d2','g':'#7f8aa0','G':'#4b5368',
 's':'#f2c49e','S':'#cf8f6a','T':'#93594a',
 'w':'#9a8a78','b':'#64564c','B':'#3c322e',
 'm':'#b4bcc8','M':'#7e879a','n':'#505870',
 'q':'#ee7656','r':'#c83c34','R':'#88232f',
 'y':'#f6d060','Y':'#b8862a',
 'p':'#46639a','P':'#2c3e68',
 'o':'#8a5432','O':'#56301e',
 'e':'#ffffff','u':'#2a2a3a','v':'#d0645a','C':'#d8d2c4','c':'#f4f0e6',
}
class Canvas:
    def __init__(s, w, h): s.w, s.h = w, h; s.px = [['.']*w for _ in range(h)]
    def row(s, y, *segs):
        for x, t in zip(segs[::2], segs[1::2]):
            for i, ch in enumerate(t):
                if ch != ' ': s.px[y][x+i] = ch
    def rows(s, y0, x0, block):
        for j, line in enumerate(block.strip('\n').split('\n')):
            for i, ch in enumerate(line):
                if ch not in ' ': s.px[y0+j][x0+i] = ch
    def outline(s):
        out = [r[:] for r in s.px]
        for y in range(s.h):
            for x in range(s.w):
                if s.px[y][x] != '.': continue
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    X, Y = x+dx, y+dy
                    if 0 <= X < s.w and 0 <= Y < s.h and s.px[Y][X] not in '.k':
                        out[y][x] = 'k'; break
        s.px = out
    def image(s, pal=VP, scale=1):
        im = Image.new('RGBA', (s.w, s.h))
        for y in range(s.h):
            for x in range(s.w):
                ch = s.px[y][x]
                if ch != '.':
                    c = pal[ch]; im.putpixel((x, y), tuple(int(c[i:i+2], 16) for i in (1,3,5)) + (255,))
        return im.resize((s.w*scale, s.h*scale), Image.NEAREST)
