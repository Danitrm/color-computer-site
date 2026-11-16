#!/usr/bin/env python3
"""Read-only checks against the deployed COLOR COMPUTER GitHub Pages site."""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import os
import sys
import time

BASE = "https://danitrm.github.io/color-computer-site/"
PAGES = ("index.html", "escolher-pc.html", "configurar-pc.html",
         "carrinho.html", "faq.html", "monte-seu-ambiente.html")
PRODUCT_IMAGES = (
    *("ascension_%02d_%s.png" % (i, color) for i, color in enumerate(
        ("preto", "prata", "dourado", "azul", "rose", "verde", "vermelho"), 1)),
    *("skyline_%02d_%s_4k.png" % (i, color) for i, color in enumerate(
        ("preto", "prata", "dourado", "azul", "rose", "verde", "vermelho"), 1)),
    *("origin_%s_premium.png" % color for color in
      ("preto", "prata", "dourado", "azul", "rose", "verde", "vermelho")),
)
class Inspect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = False
        self.main = False
        self.skip = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.title |= tag == "title"
        self.main |= tag == "main" and a.get("id") == "conteudo-principal"
        self.skip |= tag == "a" and a.get("href") == "#conteudo-principal"

def get(path, method="GET", attempts=3):
    url = urljoin(BASE, path)
    assert urlparse(url).netloc == urlparse(BASE).netloc, "Unexpected host"
    for attempt in range(attempts):
        try:
            with urlopen(Request(url, method=method, headers={
                "User-Agent": "COLOR-COMPUTER-public-smoke/1.0",
                "Cache-Control": "no-cache"
            }), timeout=25) as response:
                if response.status != 200:
                    raise RuntimeError(f"{url}: HTTP {response.status}")
                if method == "HEAD":
                    return b""
                return response.read(3_000_000)
        except (HTTPError, URLError, TimeoutError) as error:
            if attempt == attempts - 1:
                raise RuntimeError(f"{url}: {error}") from error
            time.sleep(3 * (attempt + 1))

def main():
    for path in PAGES:
        raw = get(path)
        parsed = Inspect()
        parsed.feed(raw.decode("utf-8"))
        if not (parsed.title and parsed.main and parsed.skip):
            raise RuntimeError(f"{path}: deployed page is missing expected navigation landmarks")
        print(f"PASS: live page {path}")
    homepage = get("index.html").decode("utf-8")
    if homepage.count('data-finish=') != 21:
        raise RuntimeError("Deployed homepage does not contain all 21 finish selectors")
    if 'cc-interactive-colors-script' not in homepage:
        raise RuntimeError("Deployed homepage missing interactive colors script")
    checkout = get("carrinho.html").decode("utf-8")
    if "const OFFICIAL_QUOTE_ENABLED=false;" not in checkout:
        raise RuntimeError("Public checkout automatic quote safety guard missing")
    for image in PRODUCT_IMAGES:
        get(image, method="HEAD")
        print(f"PASS: live product photo {image}")
    print("PASS: 6 live pages, 21 images, interactive finishes, commercial safety")
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"FAIL: {error}", file=sys.stderr)
        sys.exit(1)
