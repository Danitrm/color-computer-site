#!/usr/bin/env python3
"""Build an optimized GitHub Pages artifact while preserving original image files."""
from pathlib import Path
from html import unescape
from urllib.parse import unquote, quote
import re
import shutil
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "_site"
EXCLUDE = {".git", ".github", "_site", "node_modules", "__pycache__", ".pytest_cache"}
if DEST.exists():
    shutil.rmtree(DEST)
shutil.copytree(ROOT, DEST, ignore=lambda folder, names: [name for name in names if name in EXCLUDE or (name == "scripts" and Path(folder) == ROOT)])
IMAGES = {}
saved = 0
for original in sorted(DEST.iterdir()):
    if original.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
        continue
    optimized = original.with_suffix(".webp")
    with Image.open(original) as image:
        image.save(optimized, "WEBP", quality=80, method=6)
    if optimized.stat().st_size >= original.stat().st_size:
        optimized.unlink()
        continue
    IMAGES[original.name] = optimized.name
    saved += original.stat().st_size - optimized.stat().st_size

# Wrap static image tags only. Dynamic configurator/gallery images remain PNG
# so their existing JS selectors and browser regression checks are unaffected.
IMAGE_TAG = re.compile(r'<img\b[^>]*>', re.I)
SRC = re.compile(r'\bsrc="([^"]+)"', re.I)
modified = 0
for page in DEST.glob("*.html"):
    html = page.read_text(encoding="utf-8")
    def upgrade(match):
        global modified
        tag = match.group()
        src = SRC.search(tag)
        if not src:
            return tag
        path = unquote(unescape(src.group(1))).split("?", 1)[0]
        if path not in IMAGES:
            return tag
        derivative = quote(IMAGES[path], safe="-_.")
        modified += 1
        return f'<picture><source srcset="{derivative}" type="image/webp">{tag}</picture>'
    result = IMAGE_TAG.sub(upgrade, html)
    page.write_text(result, encoding="utf-8")
if not IMAGES:
    raise SystemExit("ERROR: no smaller optimized images generated")
if modified < 4:
    raise SystemExit(f"ERROR: expected >=4 static image optimizations, got {modified}")
print(f"Optimized {len(IMAGES)} images, saving {saved / (1024 * 1024):.2f} MiB of image bytes")
print(f"Upgraded {modified} static HTML image elements; originals preserved")
