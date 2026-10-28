from vs import *
P = dict(VP, a='#5fa0e8', A='#3866b8', z='#243e7a', c='#f4f0e6', C='#c9c2b4',
         l='#9a5a2c', L='#6a3a1e', v='#e04a6a')
c = Canvas(34, 46)
# Kokoshnik: a tall crescent of red and gold with pearls.
c.rows(0, 11, """
    yyyy
   yYrrYy
  yYrvvrYy
 yYrryyrrYy
 yrvryyrvry
yYrrrrrrrrYy
 cYcYcYcYcY
""")
# Face, dark braid hair framing it.
c.rows(7, 12, """
LlScSsScsS
LlSssseusS
LlSssssssS
 LlSsssvsS
  LlSSSSS
""")
# White blouse sleeves, blue sarafan with gold trim widening to the hem.
c.rows(12, 9, """
   cccAaaAcc
  ccCAaaaaACcc
 ccCzAaaaaaACcc
 cCzAayyyyaaACc
 cCzAaaaaaaaACc
 sSzAaayyaaaaAzS
  zAaaayyaaaaAz
""")
for y in range(19, 41):
    half = 6 + (y - 19) // 3
    cx = 17
    for x in range(cx - half, cx + half + 1):
        rel = (x - cx) / half
        ch = 'a' if rel < -0.4 else 'A' if rel < 0.55 else 'z'
        if rel < -0.85: ch = 'A'
        if abs(x - cx) <= 1 and y % 3 != 2: ch = 'y'  # gold buttons strip
        c.px[y][x] = ch
for x in range(17 - 13, 17 + 14):
    c.px[39][x] = 'y' if x % 2 else 'Y'
    c.px[40][x] = 'v'
# The braid falling behind her shoulder.
for y in range(11, 30):
    c.row(y, 9 - (y > 20), 'Ll')
c.row(30, 8, 'vv')
# Wide white sleeves.
c.rows(13, 6, """
 ccc
ccCC
cCCC
cCCz
 SsS
""")
c.rows(13, 24, """
cc
cCc
CCCc
 CCc
""")
# A slim staff with a glowing blue orb in her far hand.
c.rows(4, 27, """
 aa
aecA
aAAz
 zz
""")
for y in range(8, 38):
    c.row(y, 28, 'l')
c.rows(17, 26, """
Ss
sS
""")
# Little red boots under the hem.
c.row(41, 11, 'rR', 22, 'rR')
c.row(42, 10, 'rrR', 22, 'rrR')
c.outline()
if __name__ == '__main__':
    c.image(P, 10).save('vasilisa_vs.png')
