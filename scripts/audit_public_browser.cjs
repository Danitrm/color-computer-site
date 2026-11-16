// Read-only real-browser measurements of the published GitHub Pages site.
// Produces JSON and screenshots as GitHub Actions artifacts; does not place orders.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const BASE = 'https://danitrm.github.io/color-computer-site/';
const PAGES = ['index.html', 'escolher-pc.html', 'configurar-pc.html', 'carrinho.html', 'faq.html', 'monte-seu-ambiente.html'];
const DEVICES = [
  { name: 'mobile-390', viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 },
  { name: 'desktop-1440', viewport: { width: 1440, height: 900 }, isMobile: false, deviceScaleFactor: 1 },
];
const out = path.resolve('performance-reports');
fs.mkdirSync(out, { recursive: true });
const results = [];
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const device of DEVICES) {
      const context = await browser.newContext({ viewport: device.viewport, isMobile: device.isMobile, deviceScaleFactor: device.deviceScaleFactor, reducedMotion: 'reduce' });
      for (const pagePath of PAGES) {
        const page = await context.newPage();
        const errors = [];
        const failedLocal = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => {
          if (response.url().startsWith(BASE) && response.status() >= 400) {
            failedLocal.push({ status: response.status(), url: response.url() });
          }
        });
        await page.addInitScript(() => {
          window.__ccLcp = null;
          try {
            new PerformanceObserver(list => {
              for (const entry of list.getEntries()) window.__ccLcp = Math.round(entry.startTime);
            }).observe({ type: 'largest-contentful-paint', buffered: true });
          } catch (_) {}
        });
        const start = Date.now();
        const response = await page.goto(BASE + pagePath, { waitUntil: 'load', timeout: 45000 });
        assert.equal(response?.status(), 200, `${device.name} ${pagePath}: HTTP not 200`);
        await page.locator('main#conteudo-principal').waitFor({ timeout: 12000 });
        await page.waitForTimeout(1200);
        const metrics = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource');
          const images = Array.from(document.images);
          const local = resources.filter(r => r.name.startsWith(location.origin + '/color-computer-site/'));
          return {
            domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
            loadMs: nav ? Math.round(nav.loadEventEnd) : null,
            largestContentfulPaintMs: window.__ccLcp,
            localResourceCount: local.length,
            localTransferBytes: local.reduce((n, r) => n + (r.transferSize || 0), 0),
            imageCount: images.length,
            imageLoadedCount: images.filter(i => i.complete && i.naturalWidth > 0).length,
            brokenVisibleImages: images.filter(i => {
              if (!i.getClientRects().length) return false;
              return i.complete && i.naturalWidth === 0;
            }).map(i => i.currentSrc || i.src),
            horizontalOverflowPx: Math.max(0, Math.ceil(document.documentElement.scrollWidth - window.innerWidth)),
          };
        });
        const record = { device: device.name, page: pagePath, status: response.status(), elapsedWallMs: Date.now() - start, ...metrics, javascriptErrors: errors, failedLocalRequests: failedLocal };
        results.push(record);
        if (['index.html', 'escolher-pc.html', 'carrinho.html'].includes(pagePath)) {
          await page.screenshot({ path: path.join(out, `${device.name}-${pagePath.replace('.html', '')}.png`), fullPage: true, animations: 'disabled' });
        }
        console.log(JSON.stringify(record));
        assert.deepEqual(errors, [], `${device.name} ${pagePath}: browser errors`);
        assert.deepEqual(failedLocal, [], `${device.name} ${pagePath}: failed local requests`);
        assert.deepEqual(metrics.brokenVisibleImages, [], `${device.name} ${pagePath}: broken visible images`);
        await page.close();
      }
      await context.close();
    }
  } finally {
    fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify({
      source: BASE, collectedAt: new Date().toISOString(),
      caveat: 'Single synthetic Chromium run, no throttling or real-user Core Web Vitals; transferSize may be zero due to caching/cross-origin restrictions.',
      results
    }, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
