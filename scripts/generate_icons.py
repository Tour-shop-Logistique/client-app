"""Generates PWA / favicon icons from the TourShop logo (needs Pillow).

    python scripts/generate_icons.py

- public/icons/icon-192|512.png, apple-touch-icon.png : full logo on white
- public/icons/icon-512-maskable.png : full logo inside the 80% maskable safe zone
- public/favicon-32.png, favicon-48.png, favicon.ico : feather mark only (readable at 16-32px)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGO = Image.open(ROOT / "src/assets/logo_transparent.png").convert("RGBA")
MARK = Image.open(ROOT / "src/assets/logo_mark.png").convert("RGBA")
OUT = ROOT / "public"
(OUT / "icons").mkdir(parents=True, exist_ok=True)


def compose(art, size, fill, bg=(255, 255, 255, 255)):
    """Center `art` in a size x size square so it fits `fill` of the width and height."""
    art = art.crop(art.getbbox())
    box = size * fill
    scale = min(box / art.width, box / art.height)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg)
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas.convert("RGB")


compose(LOGO, 192, 0.86).save(OUT / "icons/icon-192.png")
compose(LOGO, 512, 0.86).save(OUT / "icons/icon-512.png")
compose(LOGO, 180, 0.86).save(OUT / "icons/apple-touch-icon.png")
compose(LOGO, 512, 0.62).save(OUT / "icons/icon-512-maskable.png")  # full-bleed white, logo in safe zone

compose(MARK, 32, 0.94, (0, 0, 0, 0)).convert("RGBA")  # sanity: no error on transparent bg
for s in (32, 48):
    compose(MARK, s, 0.94).save(OUT / f"favicon-{s}.png")
compose(MARK, 64, 0.94).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("done")
