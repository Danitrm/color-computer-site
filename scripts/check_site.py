#!/usr/bin/env python3
"""Static regression checks for the COLOR COMPUTER GitHub Pages site."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "escolher-pc.html", "configurar-pc.html",
         "carrinho.html", "faq.html", "monte-seu-ambiente.html"]
IMAGES = {
    "ascension": ["ascension_01_preto.png", "ascension_02_prata.png",
                  "ascension_03_dourado.png", "ascension_04_azul.png",
                  "ascension_05_rose.png", "ascension_06_verde.png",
                  "ascension_07_vermelho.png"],
    "skyline": [f"skyline_{i:02d}_{color}_4k.png" for i, color in
                enumerate(["preto", "prata", "dourado", "azul", "rose", "verde", "vermelho"], 1)],
    "origin": [f"origin_{color}_premium.png" for color in
               ["preto", "prata", "dourado", "azul", "rose", "verde", "vermelho"]],
}
errors = []

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()
        self.images = []
        self.title = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "title":
            self.title = True
        if tag == "img":
            self.images.append(a)
        if tag in ("a", "link", "img", "script", "form"):
            target = a.get("href") or a.get("src")
            if target:
                self.links.append(target)

for page in PAGES:
    path = ROOT / page
    if not path.is_file():
        errors.append(f"Missing page: {page}")
        continue
    content = path.read_text(encoding="utf-8")
    parsed = Page()
    parsed.feed(content)
    if not parsed.title:
        errors.append(f"{page}: missing title")
    for img in parsed.images:
        if not img.get("alt"):
            errors.append(f"{page}: image missing nonempty alt: {img.get('src')}")
    for link in parsed.links:
        u = urlsplit(link)
        if u.scheme or u.netloc or link.startswith(("mailto:", "tel:", "data:")):
            continue
        local = unquote(u.path)
        if not local and u.fragment and u.fragment not in parsed.ids:
            errors.append(f"{page}: missing local anchor #{u.fragment}")
        if local and not (ROOT / local).is_file():
            errors.append(f"{page}: missing linked asset {local}")
        if local.endswith(".html") and u.fragment:
            target = (ROOT / local).read_text(encoding="utf-8") if (ROOT / local).is_file() else ""
            if f'id="{u.fragment}"' not in target:
                errors.append(f"{page}: missing target {local}#{u.fragment}")
for model, images in IMAGES.items():
    for filename in images:
        if not (ROOT / filename).is_file():
            errors.append(f"Missing original {model} photograph: {filename}")
cart = (ROOT / "carrinho.html").read_text(encoding="utf-8")
config = (ROOT / "configurar-pc.html").read_text(encoding="utf-8")
if "const OFFICIAL_QUOTE_ENABLED=false;" not in cart:
    errors.append("Unverified automatic quote form must stay disabled")
if "colorComputerCartV1" not in cart or "colorComputerCartV1" not in config:
    errors.append("Shared cart storage key changed")
# Verify all interactive color selections map to the correct original photos.
homepage = (ROOT / "index.html").read_text(encoding="utf-8")
color_ids = ["matte", "metallic", "colorful", "blue", "rose", "neon", "candy"]
for model, images in IMAGES.items():
    for color_id, image in zip(color_ids, images):
        if f'data-finish="{color_id}" data-img="{image}"' not in homepage:
            errors.append(f"Missing interactive {model} / {color_id}: {image}")
    if f'data-configure="{model}"' not in homepage:
        errors.append(f"Missing configuration link for {model}")
if homepage.count('data-finish="') != 21:
    errors.append("Homepage must expose exactly 21 original color choices")
if "fetchpriority=\"high\"" not in homepage:
    errors.append("Hero product image is not prioritized")
# Ensure product photography is not accidentally rendered as a composite crop.
if "color_computer_24_cores_designs_originais.png" in homepage:
    errors.append("Homepage must use individual product images, not a composite")
# Parse inline JavaScript with Node.js so syntax errors cannot silently ship.
for page in PAGES:
    if not (ROOT / page).is_file():
        continue
    html = (ROOT / page).read_text(encoding="utf-8")
    for index, script in enumerate(re.findall(r'<script\\b([^>]*)>([\\s\\S]*?)</script>', html, re.I), 1):
        attributes, code = script
        if not code.strip() or re.search(r'type\\s*=\\s*["\\']application/(?:ld\\+json|json)["\\']', attributes, re.I):
            continue
        with tempfile.NamedTemporaryFile(mode="w", suffix=".js", encoding="utf-8") as js:
            js.write(code)
            js.flush()
            result = subprocess.run(["node", "--check", js.name], capture_output=True, text=True)
            if result.returncode:
                errors.append(f"{page}: inline script {index} has invalid JavaScript syntax")
if errors:
    print("FAILED static checks:")
    for error in errors:
        print(" -", error)
    sys.exit(1)
print("PASS: links, anchors, image alt, 21 product choices, JS syntax, hero priority, quote safety, cart key")
