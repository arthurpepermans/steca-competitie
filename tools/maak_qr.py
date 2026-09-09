"""Maakt docs/qr-registreer.png voor de registratiepagina van de app.

Gebruik: python tools/maak_qr.py [URL]   (standaard: GitHub Pages-adres)
"""
import sys
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

URL = sys.argv[1] if len(sys.argv) > 1 else "https://stecajuniors.app/#/registreer"
DOEL = Path(__file__).resolve().parents[1] / "docs" / "qr-registreer.png"

qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=3)
qr.add_data(URL)
qr.make(fit=True)
img = qr.make_image(fill_color="#7a1f2b", back_color="white").convert("RGB")
w, h = img.size
canvas = Image.new("RGB", (w, h + 150), "white")
canvas.paste(img, (0, 0))
d = ImageDraw.Draw(canvas)
try:
    f1, f2 = ImageFont.truetype("arialbd.ttf", 44), ImageFont.truetype("arial.ttf", 26)
except OSError:
    f1 = f2 = ImageFont.load_default()


def centreer(tekst: str, y: int, font) -> None:
    d.text(((w - d.textlength(tekst, font=font)) / 2, y), tekst, fill="#1f1f1f", font=font)


centreer("Steca Juniors app", h + 10, f1)
centreer("Scan, maak je account aan en wacht op goedkeuring", h + 70, f2)
centreer(URL.replace("https://", ""), h + 108, f2)
canvas.save(DOEL)
print(f"{DOEL} ({canvas.size[0]}x{canvas.size[1]}) -> {URL}")
