#!/usr/bin/env python3
"""Rasterize testdata/ocean-compare.mjs output with Pillow for visual review."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
(root / 'artifacts').mkdir(exist_ok=True)
cases = json.loads((root / '.lavish/ocean-comparison-frames.json').read_text())
labels = ['Pinned upstream equations', 'Prior compact port', 'Improved compact port', 'Aurora']
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 15)
cell_w, cell_h = 10, 20
pad, title_h, gap = 16, 28, 12
for case in cases:
    frames = case['frames']
    panel_w = 80 * cell_w + 2 * pad
    panel_h = case['height'] * cell_h + title_h + 2 * pad
    canvas = Image.new('RGB', (panel_w * 2 + gap * 3, panel_h * 2 + gap * 3), '#10131b')
    draw = ImageDraw.Draw(canvas)
    for index, (label, frame) in enumerate(zip(labels, frames)):
        x0 = gap + (index % 2) * (panel_w + gap)
        y0 = gap + (index // 2) * (panel_h + gap)
        draw.rounded_rectangle((x0, y0, x0 + panel_w, y0 + panel_h), radius=8, fill='#0b0e14', outline='#344454')
        draw.text((x0 + pad, y0 + 8), label, font=font, fill='#93d5d3')
        for y, row in enumerate(frame):
            for x, cell in enumerate(row):
                left, top = x0 + pad + x * cell_w, y0 + title_h + pad + y * cell_h
                fg = tuple(cell.get('fg') or (16, 19, 27))
                bg = tuple(cell.get('bg') or (16, 19, 27))
                draw.rectangle((left, top, left + cell_w - 1, top + cell_h - 1), fill=bg)
                if cell['glyph'] in ('▀', '█'):
                    draw.rectangle((left, top, left + cell_w - 1, top + cell_h // 2 - 1), fill=fg)
                elif cell['glyph'] == '▄':
                    draw.rectangle((left, top + cell_h // 2, left + cell_w - 1, top + cell_h - 1), fill=fg)
                elif cell['glyph'] != ' ':
                    draw.text((left, top), cell['glyph'], font=font, fill=fg)
    name = f"ocean-compare-{case['height']}rows-{str(case['seconds']).replace('.', '-')}.png"
    canvas.save(root / 'artifacts' / name)
