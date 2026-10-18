#!/usr/bin/env python3
"""Generate Ocean half-block frames from upstream equations and renderer.
Pinned termflix revision f2f2a3abe818bc0f85986c66de5750ef13cd1e59.
This is an independent Python translation of src/animations/ocean.rs,
Canvas::new's HalfBlock dimensions, and src/render/halfblock.rs build_grid.
Run: python3 testdata/ocean-reference.py > testdata/ocean-reference.json
"""
import json
import math

DARK = .02

def clamp(value, low, high): return max(low, min(high, value))
def color_at(x, y, w, h, t, surface):
    depth = y - surface
    if depth < -2: return 0.0, (255, 255, 255)
    if depth < 0:
        foam = clamp(math.sin(x / w * 20 + t * 3) * .5 + .5, 0, 1)
        return clamp(.7 + foam * .3, 0, 1), (220, 240, 255)
    ratio = clamp(depth / (h * .65), 0, 1)
    brightness = clamp(.6 - ratio * .45, .1, .7)
    underwater = math.sin(x / w * 8 + y * .05 + t * 1.2) * .1
    return clamp(brightness + underwater, .1, .7), (
        int(20 + 30 * (1 - ratio)),
        int(80 + 80 * (1 - ratio) + underwater * 30),
        int(150 + 105 * (1 - ratio * .5)),
    )
def scaled(rgb, brightness): return [int(channel * clamp(brightness, 0, 1)) for channel in rgb]
def render(w, rows, t):
    h = rows * 2
    pixels = [[(0.0, (255, 255, 255)) for _ in range(w)] for _ in range(h)]
    for x in range(w):
        fx = x / w
        surface = (h * .35 + math.sin(fx * 6 + t * 1.5) * h * .08
                   + math.sin(fx * 12 + t * 2.5) * h * .04
                   + math.sin(fx * 3 + t * .8) * h * .12
                   + math.sin(fx * 18 + t * 3.5) * h * .02)
        for y in range(h): pixels[y][x] = color_at(x, y, w, h, t, surface)
    frame = []
    for row in range(rows):
        cells = []
        for x in range(w):
            tv, tc = pixels[row * 2][x]
            bv, bc = pixels[row * 2 + 1][x]
            td, bd = tv < DARK, bv < DARK
            cell = {"glyph": " " if td and bd else "▀", "mono": " " if td and bd else "▄" if td else "▀" if bd else "█"}
            if not (td and bd):
                cell["fg"] = scaled(tc, tv)
                cell["bg"] = scaled(bc, bv)
            cells.append(cell)
        frame.append(cells)
    return frame

def compact_rows(frame):
    return [{"glyphs": "".join(cell["glyph"] for cell in row),
             "fg": [cell.get("fg") for cell in row],
             "bg": [cell.get("bg") for cell in row],
             "mono": "".join(cell["mono"] for cell in row)} for row in frame]

cases = [{"width": w, "height": h, "seconds": t, "rows": compact_rows(render(w, h, t))}
         for w, h, t in [(12, 3, 0), (40, 8, 0), (40, 5, .5), (24, 10, 1.25)]]
print(json.dumps({"source": "termflix HalfBlock truecolor", "revision": "f2f2a3abe818bc0f85986c66de5750ef13cd1e59", "translation": "independent Python implementation of upstream Ocean, Canvas HalfBlock scaling and mono threshold", "cases": cases}, indent=2))
