#!/usr/bin/env python3
"""Build LabForge's folded-page .lfg document icons from the capital of the approved application icon.

The shell's generator takes the letter from the red channel, which suits a dark letter. The LabForge letter is red, so it is
taken from the alpha channel here. Stem, label and ink come from desktop.document in forge.config.json.
"""

import json
import os
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFilter, ImageFont

size = 1024
source = Image.open("assets/icon.png").convert("RGBA")
letter_alpha = source.getchannel("A")
document = json.load(open("forge.config.json"))["desktop"]["document"]
stem, label = document["iconStem"], document["iconLabel"]
red = tuple(bytes.fromhex(document["iconInk"].removeprefix("#"))) + (255,)

icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
left, top, right, bottom, fold = 170, 70, 854, 954, 210
page = [(left, top), (right - fold, top), (right, top + fold), (right, bottom), (left, bottom)]
shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
ImageDraw.Draw(shadow).polygon([(x, y + 14) for x, y in page], fill=(0, 0, 0, 90))
icon.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
draw = ImageDraw.Draw(icon)
draw.polygon(page, fill=(255, 255, 255, 255), outline=(205, 210, 222, 255), width=4)
draw.polygon([(right - fold, top), (right, top + fold), (right - fold, top + fold)], fill=(228, 232, 244, 255), outline=(205, 210, 222, 255), width=4)

letter = letter_alpha.crop(letter_alpha.getbbox())
letter_height = 380
letter = letter.resize((round(letter.width * letter_height / letter.height), letter_height), Image.Resampling.LANCZOS)
layer = Image.new("RGBA", letter.size, red)
layer.putalpha(letter)
icon.alpha_composite(layer, ((left + right) // 2 - letter.width // 2, 330))

font = None
for candidate in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc", "C:/Windows/Fonts/arialbd.ttf"]:
    if os.path.exists(candidate):
        font = ImageFont.truetype(candidate, 118)
        break
if font is None:
    raise RuntimeError(f"Arial Bold or Helvetica is required to render the {label} label.")
label_width = draw.textlength(label, font=font)
draw.text(((left + right) / 2 - label_width / 2, 760), label, font=font, fill=red)

os.makedirs("assets/icon", exist_ok=True)
icon.save(f"assets/icon/{stem}.png")
with tempfile.TemporaryDirectory() as temporary:
    iconset = os.path.join(temporary, f"{stem}.iconset")
    os.makedirs(iconset)
    for icon_size in (16, 32, 128, 256, 512):
        icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS).save(os.path.join(iconset, f"icon_{icon_size}x{icon_size}.png"))
        icon.resize((icon_size * 2, icon_size * 2), Image.Resampling.LANCZOS).save(os.path.join(iconset, f"icon_{icon_size}x{icon_size}@2x.png"))
    if shutil.which("iconutil"):
        subprocess.run(["iconutil", "-c", "icns", iconset, "-o", f"assets/icon/{stem}.icns"], check=True)
icon.save(f"assets/icon/{stem}.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(f"wrote assets/icon/{stem}.png, {stem}.icns, {stem}.ico")
