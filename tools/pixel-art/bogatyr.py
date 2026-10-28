from vs import *
def body(c, cloak, beard):
    """Mail body, belt, cloak, legs shared by the three bogatyrs."""
    for y in range(18, 31):
        for x in range(10, 23):
            if c.px[y][x] == '.':
                base = 'h' if x < 13 else 'm' if x < 18 else 'M' if x < 21 else 'n'
                ring = {'h':'m','m':'M','M':'n','n':'G'}[base]
                c.px[y][x] = ring if (y % 2 == 0 and x % 2 == 0) or (y % 2 and x % 2 == 1 and y % 4 == 1) else base
    c.row(26, 10, 'oOYyyyyyYOoOo')
    for y in range(17, 34):
        c.row(y, 7, 'Rr' if y < 33 else 'RR'); c.row(y, 9, 'R')
    c.rows(15, 7, "RRr\nRrrqqM\nRrrqmm")
    c.rows(15, 22, "mMR\nmmMr")
    c.rows(31, 11, """
ppPP  ppPP
ppPP  ppPP
pPPP  pPPP
pPP    pPP
pPP    pPP
oOO    oOO
ooO    ooO
ooOO   ooOO
ooOOO  ooOOO
""")

def dobrynya():
    P = dict(VP, q='#6fc27a', r='#3e9a52', R='#23603a', w='#c0703a', b='#8a4626', B='#5a2c18')
    c = Canvas(34, 46)
    # Sword raised: long blade up past the helmet.
    for y in range(1, 17):
        c.row(y, 26, 'Hh' if y > 1 else ' H')
    c.row(17, 24, 'YyyY')
    c.row(18, 25, 'oO'); c.row(19, 25, 'oO'); c.row(20, 25, 'yY')
    # Round helmet with a short spike and a red plume.
    c.rows(1, 14, """
  rq
  rr
  Hg
 HHhg
HHhhhg
Hhhhhgg
Hhhhhhgg
""")
    c.rows(5, 12, "H\nHh\nHh")
    c.row(8, 11, 'YyyyyyyyyyyY')
    c.rows(9, 11, """
nMMSssssssS
nMMSssseusS
nMMSSssssssS
nMmMSsssssSs
nMmMbwwSsSwT
""")
    # Short forked beard.
    c.rows(14, 13, """
bwwwwwwwb
bwbwwwwbwb
 bwwbwwbb
  bwb bwb
   b   b
""")
    body(c, 'r', 'w')
    c.rows(20, 23, "mMn\nmMn\nMMn\nSsS")
    c.rows(18, 25, "Ss\nsS")
    # Kite-shaped green shield.
    c.rows(18, 3, """
RRRRRRR
RrqqrrrR
RrqyyrrR
RrryyrrR
RryyyyrR
RrryyrrR
 RrryrR
 RrrrrR
  RrrR
  RrrR
   RR
""")
    c.outline(); return c, P

def alyosha():
    P = dict(VP, q='#7fb6f0', r='#3f78c8', R='#284c8c', w='#f2c24a', b='#c88a2a', B='#8a5a1a')
    c = Canvas(34, 46)
    # Bow held in front: a curved wooden arc with a string.
    for y, x in ((6,27),(7,28),(8,28),(9,29),(10,29),(11,29),(12,30),(13,30),(14,30),(15,30),(16,30),(17,30),(18,30),(19,30),(20,29),(21,29),(22,29),(23,28),(24,28),(25,27)):
        c.px[y][x] = 'o'; c.px[y][x+1] = 'O'
    for y in range(7, 25): c.px[y][26] = 'C' if c.px[y][26] == '.' else c.px[y][26]
    # Low round helmet with gold, golden curls under it.
    c.rows(2, 13, """
   Y
  yyY
 HyyhG
HHhhhgG
Hhhhhhgg
""")
    c.row(7, 11, 'YyyyyyyyyyyY')
    c.rows(8, 10, """
wbwbSssssssS
 wbSssseusSS
wbwSSssssssS
 wbwSsssvsSs
  bwbSSSSSST
""")
    c.rows(13, 11, "qrrSsSSrrR\nqrrmhmmMMRR\nqhmmmmmMMMn\n hmmmmmMMMn\n hmmmmmMMMn")
    body(c, 'r', 'w')
    # Quiver of arrows on his back.
    c.rows(10, 5, """
 H H
 yHy
oOoO
oOoO
oOoO
oOoO
oOoO
oOoO
 OO
""")
    c.rows(17, 23, "mMn\nmMn\nmMn\nMMn\nSsS\nsSs")
    c.outline(); return c, dict(P, C='#d8d2c4')

if __name__ == '__main__':
    for f in (dobrynya, alyosha):
        c, P = f(); c.image(P, 10).save(f.__name__ + '_vs.png')
