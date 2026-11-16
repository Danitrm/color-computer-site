// Browser regression checks for the exact _site/ artifact uploaded to GitHub Pages.
// Tests the optimized hero source, network requests and fallback image availability.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.CC_TEST_BASE || 'http://127.0.0.1:8766/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const requests = [];
    const failures = [];
    page.on('request', request => {
      if (request.url().startsWith(BASE)) requests.push(request.url());
    });
    page.on('response', response => {
      if (response.url().startsWith(BASE) && response.status() >= 400) {
        failures.push({ url: response.url(), status: response.status() });
      }
    });
    const response = await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    assert.equal(response.status(), 200);
    const hero = page.locator('.hero-art picture img');
    assert.equal(await hero.count(), 1, 'Hero must have a WebP picture wrapper');
    assert.equal(await hero.getAttribute('src'), 'ascension_01_preto.png', 'Original fallback must remain');
    assert.equal(await page.locator('.hero-art picture source[type="image/webp"]').getAttribute('srcset'), 'ascension_01_preto.webp');
    assert.equal(await page.locator('link[rel="preload"][as="image"]').getAttribute('href'), 'ascension_01_preto.webp');
    assert.equal(await hero.evaluate(img => img.currentSrc.endsWith('ascension_01_preto.webp') && img.naturalWidth > 0), true, 'Browser did not display optimized hero');
    const webpRequests = requests.filter(url => url.endsWith('/ascension_01_preto.webp'));
    assert.equal(webpRequests.length, 1, 'Expected exactly one optimized hero request (preload reused)');
    // Other images on the page may legitimately reuse the original PNG in catalog
    // cards. Do not count those as redundant hero preload requests.
    const fallback = await page.request.get(BASE + 'ascension_01_preto.png');
    assert.equal(fallback.status(), 200, 'Original PNG fallback must remain deployed');
    assert.deepEqual(failures, [], 'Deployed artifact has failed local requests');
    console.log('PASS: optimized _site hero, single WebP preload, fallback PNG and network integrity');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
