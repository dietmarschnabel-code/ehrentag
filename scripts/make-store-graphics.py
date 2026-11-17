#!/usr/bin/env python3
"""Creates the Google Play icon (512x512) and the feature graphic (1024x500).

    pip install pillow
    python3 scripts/make-store-graphics.py

Output: store/icon-512.png and store/feature-graphic-1024x500.png
"""
import colorsys
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "store"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
TITLE = "Special Days Manager"
SUBTITLE = "Birthdays · Name days · Anniversaries · Reminders"

GLYPH = {
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "I": [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "N": ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
}


def rainbow(h, s=0.85, v=1.0):
    return tuple(int(x * 255) for x in colorsys.hsv_to_rgb(h % 1.0, s, v)) + (255,)


def confetti(draw, w, h, n, seed, rmin, rmax, avoid=None):
    rnd = random.Random(seed)
    for _ in range(n):
        x, y = rnd.randint(8, w - 8), rnd.randint(8, h - 8)
        if avoid and avoid[0] < x < avoid[2] and avoid[1] < y < avoid[3]:
            continue
        r = rnd.randint(rmin, rmax)
        c = rainbow(rnd.random(), 0.8, 1.0)
        if rnd.random() > 0.5:
            draw.ellipse((x - r, y - r, x + r, y + r), fill=c)
        else:
            draw.rectangle((x - r, y - r // 2, x + r, y + r // 2), fill=c)


def icon():
    s = 1024  # a full-bleed square: Google Play applies its own mask
    img = Image.new("RGBA", (s, s), (20, 12, 40, 255))
    d = ImageDraw.Draw(img)
    confetti(d, s, s, 120, 1111, 6, 16, avoid=(s * 0.2, s * 0.14, s * 0.8, s * 0.86))
    cell = int(s * 0.13)
    x0, y0 = (s - 5 * cell) // 2, (s - 7 * cell) // 2
    for row, line in enumerate(GLYPH["M"]):
        for col, ch in enumerate(line):
            if ch != "#":
                continue
            x, y, size = x0 + col * cell, y0 + row * cell, int(cell * 0.86)
            d.rounded_rectangle((x + 16, y + 16, x + size + 16, y + size + 16), radius=20, fill=(0, 0, 0, 120))
            d.rounded_rectangle((x, y, x + size, y + size), radius=20, fill=rainbow(col * 0.06 + row * 0.04))
    img.convert("RGB").resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")


def feature_graphic():
    w, h = 2048, 1000  # drawn at twice the size
    img = Image.new("RGBA", (w, h), (20, 12, 40, 255))
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(h):
        t = i / h
        d.line((0, i, w, i), fill=(int(20 + 18 * t), int(12 + 6 * t), int(40 + 34 * t), 255))
    confetti(d, w, h, 300, 2026, 8, 24, avoid=(180, 150, w - 180, 880))
    cell, gap = 44, 1.3
    x = int((w - (6 * 5 + 5 * gap) * cell) / 2)
    for li, ch in enumerate("MARTIN"):
        for row in range(7):
            for col in range(5):
                if GLYPH[ch][row][col] != "#":
                    continue
                px, py, size = x + col * cell, 190 + row * cell, int(cell * 0.84)
                d.rectangle((px + 5, py + 5, px + size + 5, py + size + 5), fill=(0, 0, 0, 110))
                d.rectangle((px, py, px + size, py + size), fill=rainbow(0.05 + (li * 5 + col) * 0.035 + row * 0.02))
        x += (5 + gap) * cell
    font, small = ImageFont.truetype(FONT_BOLD, 84), ImageFont.truetype(FONT, 48)
    tw = d.textlength(TITLE, font=font)
    d.text(((w - tw) / 2 + 4, 594), TITLE, font=font, fill=(0, 0, 0, 140))
    d.text(((w - tw) / 2, 590), TITLE, font=font, fill=(255, 225, 120, 255))
    sw = d.textlength(SUBTITLE, font=small)
    d.text(((w - sw) / 2, 735), SUBTITLE, font=small, fill=(205, 195, 235, 255))
    img.convert("RGB").resize((1024, 500), Image.LANCZOS).save(OUT / "feature-graphic-1024x500.png")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    icon()
    feature_graphic()
    print("Written:", OUT / "icon-512.png", OUT / "feature-graphic-1024x500.png")
