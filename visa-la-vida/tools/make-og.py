#!/usr/bin/env python3
"""Render the Open Graph / Twitter share covers for each landing segment.

Run from the project root:  python3 tools/make-og.py
Writes assets/og-<segment>.jpg (1200x630, the size Meta and Telegram expect).

The static Manrope TTFs next to this script are weight instances of the
variable woff2 subsets in assets/fonts, merged latin+cyrillic so Russian
headlines render. Pillow cannot read woff2 directly, hence the checked-in
copies.
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "assets")

W, H = 1200, 630
BG = (10, 10, 12)

THEMES = {
    "gold": (222, 186, 110),
    "blue": (111, 180, 247),
    "emerald": (127, 214, 178),
}

COVERS = [
    ("home", "gold", ["Visa la Vida"], "Сервис ВНЖ Испании за 20 рабочих дней"),
    ("visa", "gold", ["ВНЖ Испании", "на 3 года"],
     "Digital Nomad 2026 · без покупки недвижимости"),
    ("business", "blue", ["ВНЖ Испании", "для предпринимателей"],
     "Бизнес остаётся — меняется страна"),
    ("residence", "emerald", ["Заканчивается ВНЖ", "в Европе?"],
     "Альтернатива в Испании на 3 года"),
]


def font(weight, size):
    return ImageFont.truetype(os.path.join(HERE, f"manrope-{weight}.ttf"), size)


def glow(accent):
    """Soft elliptical accent glow behind the card, painted additively."""
    layer = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(layer)
    for i in range(240, 0, -3):
        k = (i / 240) ** 2.2
        col = tuple(int(BG[c] + (accent[c] - BG[c]) * 0.20 * (1 - k)) for c in range(3))
        d.ellipse((880 - i * 2, 90 - i, 880 + i * 2, 90 + i), fill=col)
    return layer


def render(name, theme, headline, sub):
    accent = THEMES[theme]
    img = glow(accent)
    d = ImageDraw.Draw(img)

    card = Image.open(os.path.join(ASSETS, "card.png")).convert("RGBA")
    cw = 600
    card = card.resize((cw, round(card.height * cw / card.width)), Image.LANCZOS)
    img.paste(card, (612, (H - card.height) // 2 + 6), card)

    logo = Image.open(os.path.join(
        ASSETS, "logo-gold.png" if theme == "gold" else "logo-white.png")).convert("RGBA")
    lw = 232
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (76, 86), logo)

    y = 210
    d.rectangle((78, y, 78 + 56, y + 3), fill=accent)
    y += 40

    f_head = font(800, 56 if max(len(l) for l in headline) < 22 else 46)
    for line in headline:
        d.text((76, y), line, font=f_head, fill=(247, 243, 234))
        y += f_head.size + 12

    y += 14
    f_sub = font(700, 25)
    d.text((76, y), sub, font=f_sub, fill=(178, 172, 158))

    # Bottom trust strip
    f_small = font(700, 22)
    d.text((76, H - 92), "3000+ клиентов", font=f_small, fill=accent)
    d.text((76 + 190, H - 92), "95% одобрений", font=f_small, fill=accent)

    out = os.path.join(ASSETS, f"og-{name}.jpg")
    img.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"{os.path.relpath(out, ROOT)}  {os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    for spec in COVERS:
        render(*spec)
