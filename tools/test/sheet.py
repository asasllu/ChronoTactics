"""Contact sheet from a GIF or a folder of PNGs.  python3 tools/test/sheet.py <in.gif|dir> <out.png> [cols=6] [maxFrames=36] [scale=0.5]"""
import os, sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
maxf = int(sys.argv[4]) if len(sys.argv) > 4 else 36
scale = float(sys.argv[5]) if len(sys.argv) > 5 else 0.5
frames = []
if os.path.isdir(src):
    frames = [Image.open(os.path.join(src, f)).convert('RGB') for f in sorted(os.listdir(src)) if f.endswith('.png')]
else:
    im = Image.open(src)
    for i in range(getattr(im, 'n_frames', 1)):
        im.seek(i); frames.append(im.convert('RGB'))
step = max(1, len(frames) // maxf)
frames = frames[::step][:maxf]
w, h = int(frames[0].width * scale), int(frames[0].height * scale)
rows = (len(frames) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), (20, 20, 30))
for i, f in enumerate(frames):
    sheet.paste(f.resize((w, h), Image.LANCZOS), ((i % cols) * w, (i // cols) * h))
sheet.save(out); print(out, len(frames), 'frames')
