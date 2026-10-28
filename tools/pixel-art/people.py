"""Shared builder for people in kaftans: faces right, light from the upper left."""
from pix import eye


def person(s, cx, top, h, body, legs='black', skin='skin', boots='brown', head=True, wide=1.0, eyes=True,
           front_arm=True, sash='gold', nose=True):
    """A standing figure `h` px tall whose head top is at `top`.
    Returns key points for hats, beards and weapons."""
    hr = max(3, h * 0.17)              # head radius
    hy = top + hr
    sy = hy + hr * .85                 # shoulders
    wy = top + h * 0.52                # waist sash
    ky = top + h * 0.8                 # kaftan hem, at the knees
    fy = top + h                       # feet
    bw = h * 0.15 * wide               # half width at the shoulders
    hw = bw * 1.35                     # half width at the hem
    lw = max(2, bw * .55)
    # back arm in shadow, behind the body
    s.ellipse(cx - bw + .5, (sy + wy) / 2 + 1, max(2, bw * .4), (wy - sy) / 2 + 1, body, bias=-.6)
    # legs and boots under the hem
    s.rect(cx - lw - 1, ky - 2, lw, fy - ky - 1, legs, bias=-.3)
    s.rect(cx + 1, ky - 2, lw, fy - ky - 1, legs, bias=-.5)
    s.poly([(cx - lw - 1, fy - 4), (cx - 1, fy - 4), (cx, fy), (cx - lw - 2, fy)], boots)
    s.poly([(cx + 1, fy - 4), (cx + lw + 1, fy - 4), (cx + lw + 3, fy), (cx + 1, fy)], boots)
    # the kaftan: shoulders, a waist, a flared skirt
    s.poly([(cx - bw, sy + 2), (cx - bw + 2, sy), (cx + bw - 2, sy), (cx + bw, sy + 2), (cx + bw * .9, wy),
            (cx + hw, ky), (cx - hw, ky), (cx - bw * .9, wy)], body)
    # trim down the front and along the hem
    s.line(cx + bw * .45, sy + 1, cx + bw * .6, ky - 1, sash, 3, 1)
    s.line(cx - hw + 1, ky - 1, cx + hw - 1, ky - 1, sash, 2, 1)
    s.line(cx - bw * .9, wy, cx + bw * .9, wy, sash, 2, max(1, int(h / 28)))
    if front_arm:
        s.ellipse(cx + bw * .6, (sy + wy) / 2 + 1, max(2, bw * .42), (wy - sy) / 2 + 1, body, bias=.2)
        s.ellipse(cx + bw * .75, wy + 1, max(1.6, hr * .38), max(1.6, hr * .38), skin)
    if head:
        s.ellipse(cx + 1, hy, hr, hr, skin)
        if nose:
            s.px(int(cx + 1 + hr), int(hy + 1), (skin, 2)).px(int(cx + hr), int(hy + 2), (skin, 1))
        if eyes:
            ex = int(cx + 1 + hr * .1)
            eye(s, ex, int(hy - hr * .05))
            eye(s, ex + max(3, int(hr * .6)), int(hy - hr * .05))
    return dict(hx=cx + 1, hy=hy, hr=hr, sy=sy, wy=wy, ky=ky, fy=fy, bw=bw, hand=(cx + bw * .75, wy + 1))
