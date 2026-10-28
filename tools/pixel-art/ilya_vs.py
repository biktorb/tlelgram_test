from vs import *
c = Canvas(34, 46)
# Mace over the shoulder: iron head with spikes, oak handle down to the fist.
c.rows(1, 25, """
  g
 gHhg
gHhhGg
 hhgG
 gGGg
  g
""")
for i in range(16):
    c.row(7+i, 27 - (i*3)//15, 'oO')
# Helmet (шишак): tall pointed dome, gold rim.
c.rows(0, 13, """
   g
   Hg
  HHhg
  Hhhg
 HHhhgG
 Hhhhhgg
HHhhhhggG
Hhhhhhhgg
""")
c.row(8, 11, 'YyyyyyyyyyyY')
# Mail aventail behind and face in three-quarter view, nose guard.
c.rows(9, 11, """
nMMSssssssS
nMMSssseusS
nMMSSssssssS
nMmMSsssssSs
nMmMbwwSsSwT
""")
# Beard: broad, grey-brown, to the chest.
c.rows(14, 12, """
 bwwwwwwwwb
bwwbwwwwbwwb
bwbwwwwwwbwb
 bbwwbwwwbb
  bbwwwwbb
   bbbwbb
""")
# Red cloak and shoulders.
c.rows(15, 7, """
RRr
RrrqqM
Rrrqmm
""")
c.rows(15, 22, """
mMR
mmMr
""")
# Mail body with a checker weave, gold belt, mail skirt.
for y in range(18, 31):
    for x in range(10, 23):
        if c.px[y][x] == '.':
            base = 'h' if x < 13 else 'm' if x < 18 else 'M' if x < 21 else 'n'
            ring = {'h':'m','m':'M','M':'n','n':'G'}[base]
            c.px[y][x] = ring if (y % 2 == 0 and x % 2 == 0) or (y % 2 and x % 2 == 1 and y % 4 == 1) else base
c.row(26, 10, 'oOYyyyyyYOoOo')
# Cloak hanging behind, left side.
for y in range(17, 34):
    c.row(y, 7, 'Rr' if y < 33 else 'RR')
    c.row(y, 9, 'R')
# Right arm: sleeve and fist on the handle.
c.rows(17, 23, """
mMn
mMn
mMn
MMn
SsS
sSs
""")
# Round red shield with a gold boss on the near arm.
c.rows(19, 2, """
   RRRR
  RrrrrRR
 Rrqrrrrr R
 RrryyyrrrR
Rrryy Yyrrr
RrryYYYyrrR
RrrryYYrrrR
 RrrrrrrrR
 RRrrrrrRR
  RRRRRRR
""".replace(' Y', 'yY').replace(' R','rR'))
# Legs: blue trousers, red-brown boots.
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
c.outline()
if __name__ == '__main__':
    c.image(scale=10).save('ilya_vs.png')
