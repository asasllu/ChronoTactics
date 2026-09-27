"""Compose animation cells (from gif.cjs) into one looping GIF grid."""
import base64, io, json, sys
from PIL import Image, ImageDraw

cells = json.load(open(sys.argv[1]))
out, S, COLS = sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
TICK = 40  # ms per GIF frame
BG, CELLBG = (128, 128, 255), (106, 106, 224)


def dec(u):
    return Image.open(io.BytesIO(base64.b64decode(u.split(',', 1)[1]))).convert('RGBA')


for c in cells:
    for f in c['frames']:
        f['img'] = dec(f['png'])
    c['total'] = sum(f['ms'] for f in c['frames'])
    c['cycle'] = c['total'] + (0 if c['loop'] else 400)

cw = max(c['w'] for c in cells) + 8
ch = max(c['h'] for c in cells) + 8
LAB = 12
cols = min(COLS, len(cells))
rows = (len(cells) + cols - 1) // cols
W, H = cols * (cw * S + 6) + 6, rows * (ch * S + LAB + 6) + 6
span = max(c['cycle'] for c in cells)
span = min(max(span, 1200), 4000)
nframes = max(1, span // TICK)


def frame_at(c, t):
    t %= c['cycle']
    for f in c['frames']:
        if t < f['ms']:
            return f
        t -= f['ms']
    return c['frames'][-1]


base = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(base)
for i, c in enumerate(cells):
    x0, y0 = 6 + (i % cols) * (cw * S + 6), 6 + (i // cols) * (ch * S + LAB + 6)
    d.rectangle([x0, y0 + LAB, x0 + cw * S - 1, y0 + LAB + ch * S - 1], fill=(32, 24, 58) if c.get('fx') else CELLBG)
    d.text((x0, y0), c['label'], fill=(20, 12, 30))
    if not c.get('fx'):
        gy = y0 + LAB + (4 + c['ay']) * S + S
        d.line([x0, gy, x0 + cw * S - 1, gy], fill=(160, 160, 255))

gif = []
for k in range(nframes):
    im = base.copy()
    t = k * TICK
    for i, c in enumerate(cells):
        x0, y0 = 6 + (i % cols) * (cw * S + 6), 6 + (i // cols) * (ch * S + LAB + 6) + LAB
        f = frame_at(c, t)
        img = f['img'].resize((f['img'].width * S, f['img'].height * S), Image.NEAREST)
        if c.get('fx'):
            px, py = 4 + f.get('dx', 0), 4 + f.get('dy', 0)
        else:
            px, py = 4 + c['ax'] - f['cx'], 4 + c['ay'] - f['fy'] + 1
        im.paste(img, (x0 + px * S, y0 + py * S), img)
    gif.append(im.convert('P', palette=Image.ADAPTIVE, colors=255))
gif[0].save(out, save_all=True, append_images=gif[1:], duration=TICK, loop=0, disposal=1, optimize=False)
print('wrote', out, f'{len(cells)} cells, {nframes} frames')
