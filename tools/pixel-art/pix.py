"""A small pixel-art kit: shapes lit from the upper left, dark inner edges
where parts overlap, a one-pixel outline round the whole sprite."""
import math
from PIL import Image

OUTLINE = '#1e1626'
LIGHT = (-0.5, -0.7, 0.52)
_n = math.sqrt(sum(v * v for v in LIGHT))
LIGHT = tuple(v / _n for v in LIGHT)


def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


# Colour ramps, darkest first. Shadows lean cool, lights lean warm.
M = {
    'fur': ['#3e3a4c', '#5f5d72', '#8a8a9e', '#b9bccb', '#e2e4ea'],
    'brown': ['#3a2420', '#5e3828', '#8a5634', '#b67e48', '#d9a868'],
    'black': ['#16121e', '#2a2534', '#423c50', '#5f586e', '#7e778e'],
    'bark': ['#2c1c1a', '#4a2e22', '#6e4630', '#946342', '#b88a5a'],
    'wood': ['#4a2a1a', '#74442a', '#9e6638', '#c48e50', '#e2b674'],
    'leaf': ['#173828', '#22553a', '#33764a', '#4e9a56', '#7cbf66'],
    'moss': ['#253a26', '#3a5a32', '#557a3c', '#77984a', '#a0b860'],
    'swamp': ['#1f3a34', '#2e5a48', '#3f7d5a', '#65a06a', '#9cc488'],
    'skin': ['#7a4038', '#ad6450', '#d48e6c', '#f0b890', '#fcd8b4'],
    'pale': ['#4c4258', '#7a6e84', '#a89cac', '#d0c6cc', '#f0eae8'],
    'bone': ['#5a4a46', '#8a7868', '#b8a68e', '#ddd0b4', '#f6eed8'],
    'steel': ['#2e3244', '#4b5368', '#7f8aa0', '#bcc5d2', '#f2f5f8'],
    'dark': ['#17141f', '#26222f', '#3a3446', '#575168', '#7a7390'],
    'red': ['#4e1420', '#88232f', '#c83c34', '#ee7656', '#ffb08a'],
    'blue': ['#1c2450', '#2c3e7a', '#3f66b4', '#5f9ae6', '#a8d4ff'],
    'gold': ['#5a3410', '#9a6420', '#d6a034', '#f6d060', '#fff2a8'],
    'fire': ['#8a1c14', '#d0401c', '#f2801e', '#ffc23a', '#fff4a0'],
    'ghost': ['#2c4a7a', '#4a7ac0', '#7ab4ea', '#b8e2ff', '#f0fbff'],
    'purple': ['#24143a', '#3e2462', '#62388e', '#8e5ec0', '#c09ae8'],
    'green': ['#123a1e', '#1e5a2c', '#2f8a3c', '#56b44c', '#9ade6a'],
    'jade': ['#0e3436', '#17524e', '#257a66', '#3fa880', '#7ad6a2'],
    'flesh': ['#4a2a3a', '#7a4652', '#a86a6a', '#cc9484', '#ecc2a8'],
    'straw': ['#6a4a14', '#9a7424', '#c8a038', '#e8c860', '#fae890'],
    'white': ['#7a7a8e', '#a8aab8', '#cfd2dc', '#eceef2', '#ffffff'],
    'pink': ['#6a2a3a', '#a84a5a', '#d87080', '#f4a0a8', '#ffd0d0'],
    'stone': ['#2c2a38', '#45424f', '#625e6e', '#85818f', '#aaa6b2'],
    'eye': ['#f4f4f4'] * 5,
}


class Spr:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.c = [[None] * w for _ in range(h)]  # (colour, shape id)
        self.sid = 0

    def _put(self, x, y, col, sid):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.c[y][x] = (col, sid)

    def _shape(self, cells, mat, norm, edge=True, lv=None, dither=True, bias=0.0):
        """cells: set of (x, y); norm(x, y) -> (nx, ny) in [-1, 1]."""
        self.sid += 1
        ramp = M[mat] if isinstance(mat, str) else mat
        n = len(ramp)
        for (x, y) in cells:
            if lv is not None:
                i = lv
            else:
                nx, ny = norm(x, y)
                nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
                d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + bias
                f = max(0.0, min(0.999, (d + 0.55) / 1.45)) * (n - 1)
                i = int(f)
                if dither and f - i > 0.82 and (x + y) % 2 == 0:
                    i = min(n - 1, i + 1)
                i = min(i, n - 2) if n > 2 else i  # brightest only for highlights
            if edge:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if (X, Y) not in cells and 0 <= X < self.w and 0 <= Y < self.h and self.c[Y][X] is not None:
                        i = 0
                        break
            self._put(x, y, ramp[i], self.sid)
        return self

    def ellipse(self, cx, cy, rx, ry, mat, **kw):
        cells = {(x, y) for y in range(int(cy - ry) - 1, int(cy + ry) + 2) for x in range(int(cx - rx) - 1, int(cx + rx) + 2)
                 if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1}
        return self._shape(cells, mat, lambda x, y: ((x + .5 - cx) / rx, (y + .5 - cy) / ry), **kw)

    def poly(self, pts, mat, **kw):
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        cells = set()
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                if _inside(x + .5, y + .5, pts):
                    cells.add((x, y))
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, max(1, (x1 - x0) / 2), max(1, (y1 - y0) / 2)
        return self._shape(cells, mat, lambda x, y: ((x + .5 - cx) / rx * .85, (y + .5 - cy) / ry * .85), **kw)

    def rect(self, x, y, w, h, mat, **kw):
        return self.poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], mat, **kw)

    def line(self, x0, y0, x1, y1, mat, lv=2, w=1, edge=False):
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        cells = set()
        for i in range(steps + 1):
            t = i / steps
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for dx in range(w):
                for dy in range(w):
                    cells.add((int(x) + dx - w // 2, int(y) + dy - w // 2))
        return self._shape(cells, mat, None, lv=lv, edge=edge)

    def px(self, x, y, col):
        """A single hand-placed pixel: a ramp name + level, a hex colour or 'k'."""
        if col == 'k':
            col = OUTLINE
        elif isinstance(col, tuple):
            col = M[col[0]][col[1]]
        self._put(x, y, col, -1)
        return self

    def pixels(self, x0, y0, block, key):
        """Hand-drawn detail: rows of characters looked up in `key`."""
        for j, row in enumerate(block.strip('\n').split('\n')):
            for i, ch in enumerate(row):
                if ch in key:
                    self.px(x0 + i, y0 + j, key[ch])
        return self

    def mirror(self):
        self.c = [row[::-1] for row in self.c]
        return self

    def image(self, outline=True):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                if self.c[y][x]:
                    im.putpixel((x, y), hx(self.c[y][x][0]))
        if outline:
            out = im.copy()
            p = im.load()
            for y in range(self.h):
                for x in range(self.w):
                    if p[x, y][3]:
                        continue
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        X, Y = x + dx, y + dy
                        if 0 <= X < self.w and 0 <= Y < self.h and p[X, Y][3]:
                            out.putpixel((x, y), hx(OUTLINE))
                            break
            im = out
        return im


def _inside(x, y, pts):
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def eye(s, x, y, pupil='k', white=True, big=False):
    """A two-pixel eye looking right: white then pupil."""
    if white:
        s.px(x, y, '#f4f4f4')
    s.px(x + 1, y, pupil)
    if big:
        s.px(x, y + 1, '#d0d0d8')
        s.px(x + 1, y + 1, pupil)
