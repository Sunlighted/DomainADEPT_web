"""Compose the recorded episodes (record_shift_demos.py output) into one labelled
5x2 grid video per (task, domain), and write a summary json for the page.

  python compose_grid.py <rec_dir> <out_dir>
Needs numpy + pillow + ffmpeg.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

TASKS = ["threading", "coffee", "square", "tpa"]
CROP = (10, 40, 410, 340)          # workspace region of the 480x360 sideview render
TILE = (320, 240)
GAP = 6
COLS, ROWS = 5, 2
FPS = 20                           # control rate = real time
STRIDE = {"tpa": 2}                # TPA episodes are 1000 steps: shown at 2x
GREEN, RED, INK = (23, 153, 106), (192, 57, 43), (22, 24, 29)
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
fb, fr = ImageFont.truetype(FONT_B, 15), ImageFont.truetype(FONT, 13)


def pretty(label):
    return "Success" if label == "success" else label[0].upper() + label[1:]


def tile(frame, idx, label, finished):
    im = Image.fromarray(frame).crop(CROP).resize(TILE, Image.LANCZOS)
    d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((6, 6, 46, 26), 5, fill=(255, 255, 255, 215))
    d.text((26, 16), f"#{idx + 1}", font=fr, fill=INK, anchor="mm")
    if finished:
        d.rectangle((0, 0, TILE[0], TILE[1]), fill=(255, 255, 255, 60))
        ok = label == "success"
        txt = ("✓ " if ok else "✗ ") + pretty(label)
        w = d.textlength(txt, font=fb)
        x0, y1 = 8, TILE[1] - 8
        d.rounded_rectangle((x0, y1 - 28, x0 + w + 20, y1), 6, fill=(GREEN if ok else RED) + (240,))
        d.text((x0 + 10, y1 - 14), txt, font=fb, fill="white", anchor="lm")
    return im


def compose(rec, task, domain, out):
    res = json.load(open(os.path.join(rec, f"{task}_{domain}", "results.json")))
    eps = res["episodes"]
    s = STRIDE.get(task, 1)
    frames = [np.load(os.path.join(rec, f"{task}_{domain}", f"ep{e['ep']}.npz"))["frames"][::s] for e in eps]
    T = max(len(f) for f in frames) + FPS * 2          # hold the final grid for 2 s
    W = COLS * TILE[0] + (COLS - 1) * GAP
    H = ROWS * TILE[1] + (ROWS - 1) * GAP
    path = os.path.join(out, f"{task}_{domain}.mp4")
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "27",
                          "-pix_fmt", "yuv420p", "-movflags", "+faststart", path], stdin=subprocess.PIPE)
    for t in range(T):
        canvas = Image.new("RGB", (W, H), "white")
        for i, (e, f) in enumerate(zip(eps, frames)):
            done = t >= len(f) - 1
            im = tile(f[min(t, len(f) - 1)], i, e["label"], done)
            canvas.paste(im, ((i % COLS) * (TILE[0] + GAP), (i // COLS) * (TILE[1] + GAP)))
        p.stdin.write(canvas.tobytes())
        if t == T - 1:
            canvas.save(os.path.join(out, f"{task}_{domain}.jpg"), quality=85)
    p.stdin.close()
    p.wait()
    return dict(success=sum(e["success"] for e in eps), n=len(eps), speed=s,
                labels=[e["label"] for e in eps])


def main():
    rec, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    summary = {}
    for t in TASKS:
        summary[t] = {d: compose(rec, t, d, out) for d in ("source", "target")}
        print(t, {d: f"{v['success']}/{v['n']}" for d, v in summary[t].items()}, flush=True)
    json.dump(summary, open(os.path.join(out, "summary.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
