"""Draws one module's creatures side by side, scaled up: python3 preview.py forest 4 out.png"""
import sys, importlib
from PIL import Image
mod = importlib.import_module(sys.argv[1])
scale = int(sys.argv[2]) if len(sys.argv) > 2 else 5
ims = [f().image() for f in mod.ALL]
W = sum(i.width * scale + 16 for i in ims) + 16
H = max(i.height for i in ims) * scale + 32
sheet = Image.new('RGBA', (W, H), (96, 128, 80, 255))
x = 16
for i in ims:
    big = i.resize((i.width * scale, i.height * scale), Image.NEAREST)
    sheet.alpha_composite(big, (x, H - 16 - big.height)); x += big.width + 16
sheet.save(sys.argv[3] if len(sys.argv) > 3 else f'{sys.argv[1]}-preview.png')
