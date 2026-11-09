#!/usr/bin/env python3
"""Generate the AEGIS GRC brand mark and app icon set.

Vector-first: every asset is drawn from the same geometry at 4x supersampling
and downscaled with LANCZOS, so edges stay clean at any size.

    python3 scripts/make-logo.py

Outputs (assets/):
    logo.svg            master vector, 1024x1024, navy field
    icon.png            1024x1024 iOS / store icon (opaque)
    adaptive-icon.png   1024x1024 Android foreground (transparent, safe-zone scaled)
    splash.png          1284x2778 splash (navy field)
    favicon.png         512x512 web favicon
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

NAVY = (10, 25, 49, 255)        # #0A1931
WHITE = (255, 255, 255, 255)    # #FFFFFF
TEAL = (15, 163, 177, 255)      # #0FA3B1

SS = 4  # supersampling factor
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"

# --- mark geometry, in a 1024x1024 design space -----------------------------
CX, HALF_W = 512.0, 220.0
TOP, ARCH = 286.0, 34.0
TIP = 800.0
CHECK = [(400.0, 512.0), (478.0, 590.0), (636.0, 418.0)]
CHECK_W = 56.0
ARC_C = (620.0, 400.0)
ARC_RADII = (190.0, 245.0, 300.0)
ARC_W = 16.0
ARC_FROM, ARC_TO = -75.0, -15.0
NODE_R = 15.0

# shield bounds (arcs are a deliberate asymmetric accent), used to centre the mark
MARK_BBOX = (292.0, 252.0, 732.0, 800.0)
MARK_CX = (MARK_BBOX[0] + MARK_BBOX[2]) / 2
MARK_CY = (MARK_BBOX[1] + MARK_BBOX[3]) / 2
MARK_W = MARK_BBOX[2] - MARK_BBOX[0]
MARK_H = MARK_BBOX[3] - MARK_BBOX[1]


def quad(p0, c, p1, n=160):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((
            u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
            u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
        ))
    return pts


def cubic(p0, p1, p2, p3, n=200):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((
            u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
        ))
    return pts


def shield_outline():
    top_l = (CX - HALF_W, TOP)
    top_r = (CX + HALF_W, TOP)
    top_ctrl = (CX, TOP - 2 * ARCH)
    right = cubic(top_r, (CX + HALF_W, 440), (CX + 160, 740), (CX, TIP))
    left = cubic((CX, TIP), (CX - 160, 740), (CX - HALF_W, 440), top_l)
    return quad(top_l, top_ctrl, top_r) + right[1:] + left[1:]


def transform(p, scale, cx, cy):
    return ((p[0] - MARK_CX) * scale + cx, (p[1] - MARK_CY) * scale + cy)


def draw_mark(img, scale, cx, cy):
    d = ImageDraw.Draw(img)
    tf = lambda p: transform(p, scale, cx, cy)

    # shield plane
    d.polygon([tf(p) for p in shield_outline()], fill=WHITE)

    # checkmark
    check = [tf(p) for p in CHECK]
    w = max(1, int(round(CHECK_W * scale)))
    d.line(check, fill=TEAL, width=w, joint="curve")
    for p in (check[0], check[-1]):
        r = w / 2
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=TEAL)

    # monitoring arcs
    ac = tf(ARC_C)
    for radius in ARC_RADII:
        r = radius * scale
        d.arc(
            [ac[0] - r, ac[1] - r, ac[0] + r, ac[1] + r],
            start=ARC_FROM,
            end=ARC_TO,
            fill=TEAL,
            width=max(1, int(round(ARC_W * scale))),
        )

    # node dot on the middle arc
    nr = NODE_R * scale
    a = math.radians(ARC_TO)
    px = ac[0] + ARC_RADII[1] * scale * math.cos(a)
    py = ac[1] + ARC_RADII[1] * scale * math.sin(a)
    d.ellipse([px - nr, py - nr, px + nr, py + nr], fill=TEAL)


def render(w, h, scale, cx, cy, bg):
    img = Image.new("RGBA", (w * SS, h * SS), bg)
    draw_mark(img, scale * SS, cx * SS, cy * SS)
    return img.resize((w, h), Image.LANCZOS)


def svg_master() -> str:
    dx = 512 - MARK_CX
    dy = 512 - MARK_CY
    check = " ".join(f"{'M' if i == 0 else 'L'}{x:.1f} {y:.1f}" for i, (x, y) in enumerate(CHECK))
    arcs = []
    for radius in ARC_RADII:
        x0 = ARC_C[0] + radius * math.cos(math.radians(ARC_FROM))
        y0 = ARC_C[1] + radius * math.sin(math.radians(ARC_FROM))
        x1 = ARC_C[0] + radius * math.cos(math.radians(ARC_TO))
        y1 = ARC_C[1] + radius * math.sin(math.radians(ARC_TO))
        arcs.append(
            f'    <path d="M{x0:.1f} {y0:.1f} A{radius:.1f} {radius:.1f} 0 0 1 {x1:.1f} {y1:.1f}"/>'
        )
    a = math.radians(ARC_TO)
    node_x = ARC_C[0] + ARC_RADII[1] * math.cos(a)
    node_y = ARC_C[1] + ARC_RADII[1] * math.sin(a)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="AEGIS GRC">
  <rect width="1024" height="1024" fill="#0A1931"/>
  <g transform="translate({dx:.0f} {dy:.0f})">
    <path d="M292 286 Q512 218 732 286 L732 440 C732 640 672 740 512 800 C352 740 292 640 292 440 Z" fill="#FFFFFF"/>
    <path d="{check}" fill="none" stroke="#0FA3B1" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="none" stroke="#0FA3B1" stroke-width="12" stroke-linecap="round">
{chr(10).join(arcs)}
    </g>
    <circle cx="{node_x:.1f}" cy="{node_y:.1f}" r="13" fill="#0FA3B1"/>
  </g>
</svg>
"""


def main() -> None:
    OUT.mkdir(exist_ok=True)

    # app icon: full-bleed navy, mark optically centred
    render(1024, 1024, 1.0, 512, 512, NAVY).convert("RGB").save(OUT / "icon.png", optimize=True)

    # android adaptive foreground: transparent, inside the 66% safe circle
    render(1024, 1024, 0.56, 512, 512, (0, 0, 0, 0)).save(OUT / "adaptive-icon.png", optimize=True)

    # splash: navy field, mark at ~29% width
    render(1284, 2778, 380 / MARK_W, 642, 1389, NAVY).convert("RGB").save(OUT / "splash.png", optimize=True)

    # favicon
    render(512, 512, 1.0, 256, 256, NAVY).convert("RGB").save(OUT / "favicon.png", optimize=True)

    (OUT / "logo.svg").write_text(svg_master())

    for name in ("logo.svg", "icon.png", "adaptive-icon.png", "splash.png", "favicon.png"):
        p = OUT / name
        print(f"{name:18} {p.stat().st_size / 1024:8.1f} KB")


if __name__ == "__main__":
    main()
