"""Rasterize JSON frames from renderGalaxy; Pillow is only needed for this capture."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

frames = json.load(sys.stdin)
Path('artifacts').mkdir(exist_ok=True)

def raster(frame):
    image = Image.new('RGB', (len(frame[0]) * 8, len(frame) * 16))
    draw = ImageDraw.Draw(image)
    for y, row in enumerate(frame):
        for x, cell in enumerate(row):
            if cell['glyph'] == '▀':
                draw.rectangle((x*8, y*16, x*8+7, y*16+7), fill=tuple(cell['fg']))
                if 'bg' in cell:
                    draw.rectangle((x*8, y*16+8, x*8+7, y*16+15), fill=tuple(cell['bg']))
            elif cell['glyph'] == '▄':
                draw.rectangle((x*8, y*16+8, x*8+7, y*16+15), fill=tuple(cell['fg']))
    return image

images = [raster(frame) for frame in frames['clip']]
# Build one palette from every frame's actual subpixels, without dithering.
samples = Image.new('RGB', (80, 20 * len(images)))
for i, image in enumerate(images):
    samples.paste(image.resize((80, 20), Image.NEAREST), (0, i * 20))
palette = samples.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)
quantized = [image.quantize(palette=palette, dither=Image.NONE) for image in images]
quantized[0].save('docs/galaxy.gif', save_all=True, append_images=quantized[1:],
                  duration=[70 if i % 3 != 1 else 60 for i in range(len(images))], optimize=False)
# Compare decoded adjacent-frame changes with the RGB source at each subpixel.
gif = Image.open('docs/galaxy.gif')
assert gif.n_frames == len(images) and 'loop' not in gif.info
previous_source = previous_gif = None
error = count = 0
for i, image in enumerate(images):
    gif.seek(i)
    source = list(image.resize((80, 20), Image.NEAREST).getdata())
    decoded = list(gif.convert('RGB').resize((80, 20), Image.NEAREST).getdata())
    assert all(decoded[y * 80] == (0, 0, 0) for y in range(20)), 'sky changed color'
    if previous_source is not None:
        for a, b, c, d in zip(source, previous_source, decoded, previous_gif):
            error += sum(abs((a[k] - b[k]) - (c[k] - d[k])) for k in range(3))
            count += 3
    previous_source, previous_gif = source, decoded
print(f'GIF adjacent-frame RGB delta mean absolute error: {error / count:.3f} / 255')
assert error / count < 1
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 16)
for frame in frames['sizes']:
    w, h = len(frame[0]), len(frame)
    raster(frame).save(f'artifacts/galaxy-{w}x{h}.png')
    mono = Image.new('RGB', (w * 12, h * 20))
    draw = ImageDraw.Draw(mono)
    for y, row in enumerate(frame):
        draw.text((0, y * 20), ''.join(cell['mono'] for cell in row), font=font, fill='white')
    mono.save(f'artifacts/galaxy-{w}x{h}-mono.png')
