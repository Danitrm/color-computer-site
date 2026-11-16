// End-to-end matrix: three real products x seven original finishes.
// No WhatsApp messages, forms, orders or external requests are submitted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.env.CC_TEST_BASE || 'http://127.0.0.1:8765/';
const FINISHES = [
  ['matte', 'preto', 'Preto'],
  ['metallic', 'prata', 'Prata'],
  ['colorful', 'dourado', 'Dourado'],
  ['blue', 'azul', 'Azul'],
  ['rose', 'rose', 'Rosé'],
  ['neon', 'verde', 'Verde'],
  ['candy', 'vermelho', 'Vermelho'],
];
const MODELS = {
  ascension: (number, color) => `ascension_${number}_${color}.png`,
  skyline: (number, color) => `skyline_${number}_${color}_4k.png`,
  origin: (_, color) => `origin_${color}_premium.png`,
};
const WIDTHS = [360, 390, 768, 1440];
const PAGES = ['index.html', 'escolher-pc.html', 'configurar-pc.html', 'carrinho.html', 'faq.html', 'monte-seu-ambiente.html'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let checked = 0;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of PAGES) {
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
        assert.equal(await page.locator('.cc-skip-link').count(), 1, `${path}: skip link missing at ${width}px`);
        assert.equal(await page.locator('main#conteudo-principal').count(), 1, `${path}: main missing at ${width}px`);
        const nav = page.locator('nav[aria-label="Navegação principal"]');
        if (path === 'escolher-pc.html') {
          const cards = page.locator('.grid .card');
          assert.equal(await cards.count(), 3, 'Catalog must show all three original models');
          for (const card of await cards.all()) {
            const visual = card.locator('.visual');
            await visual.scrollIntoViewIfNeeded();
            const geometry = await visual.evaluate(async frame => {
              const img = frame.querySelector('img');
              const loaded = await img.decode().then(() => img.naturalWidth > 0).catch(() => false);
              const parent = frame.getBoundingClientRect();
              const child = img.getBoundingClientRect();
              return {
                inside: child.left >= parent.left - 1 && child.right <= parent.right + 1 &&
                  child.top >= parent.top - 1 && child.bottom <= parent.bottom + 1,
                fit: getComputedStyle(img).objectFit,
                loaded,
              };
            });
            assert.equal(geometry.inside, true, 'Catalog photo overflows its frame at ' + width + 'px');
            assert.equal(geometry.fit, 'contain', 'Catalog must show full uncropped product photo');
            assert.equal(geometry.loaded, true, 'Catalog original image missing');
          }
        }
        if (path === 'index.html') {
          // Regression for the cut-off product photos reported by the owner.
          // The production build wraps static images in <picture>, so test both
          // source and deployed layouts at every responsive viewport.
          for (const card of await page.locator('.product').all()) {
            const media = card.locator('.product-media');
            await media.scrollIntoViewIfNeeded();
            const image = media.locator('img');
            assert.equal(await image.evaluate(img => img.decode().then(() => img.naturalWidth > 0).catch(() => false)), true, 'Product photo failed to decode');
            const geometry = await media.evaluate(frame => {
              const img = frame.querySelector('img');
              const outer = frame.getBoundingClientRect();
              const inner = img.getBoundingClientRect();
              const style = getComputedStyle(img);
              return {
                contained: inner.left >= outer.left - 1 && inner.top >= outer.top - 1 && inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1,
                fit: style.objectFit,
                ratio: img.naturalWidth / img.naturalHeight,
              };
            });
            assert.equal(geometry.contained, true, 'Product image box escapes its frame at ' + width + 'px');
            assert.equal(geometry.fit, 'contain', 'Product photo must never be cropped');
          }
          for (const label of ['OS MODELOS', 'AMBIENTES', 'MEU CARRINHO']) {
            assert.equal(await nav.getByRole('link', { name: new RegExp(label) }).isVisible(), true, `${label} hidden at ${width}px`);
          }
        }
      }
      console.log(`PASS: six pages, landmarks and primary navigation at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [model, imageName] of Object.entries(MODELS)) {
      for (const [i, [finishId, filename, label]] of FINISHES.entries()) {
        const image = imageName(String(i + 1).padStart(2, '0'), filename);
        await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
        const card = page.locator('.product').filter({ has: page.locator(`[data-configure="${model}"]`) });
        assert.equal(await card.count(), 1, `${model}: missing product card`);
        const button = card.locator(`[data-finish="${finishId}"]`);
        assert.equal(await button.getAttribute('data-img'), image, `${model} ${label}: incorrect original photo mapping`);
        await button.click();
        await page.waitForFunction(
          ({ model, image }) => {
            const link = document.querySelector(`[data-configure="${model}"]`);
            return link?.closest('.product')?.querySelector('.product-media img')?.getAttribute('src') === image;
          }, { model, image }
        );
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        assert.match(await card.locator('.finish-caption').innerText(), new RegExp(label, 'i'));
        const href = await card.locator('[data-configure]').getAttribute('href');
        const params = new URL(href, BASE);
        assert.equal(params.searchParams.get('modelo'), model);
        assert.equal(params.searchParams.get('cor'), finishId);
        await page.goto(params.href, { waitUntil: 'domcontentloaded' });
        assert.equal(await page.locator('#pcImage').getAttribute('src'), image, `${model} ${label}: configurator image mismatch`);
        await page.locator('#addToCart').click();
        await page.waitForURL(/carrinho\.html/);
        assert.equal(await page.locator('.cart-product-visual img').getAttribute('src'), image, `${model} ${label}: cart image mismatch`);
        const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('colorComputerCartV1') || '[]'));
        assert.equal(cart.at(-1)?.model.toLowerCase(), model);
        assert.equal(cart.at(-1)?.color, label);
        await page.locator('[data-act="remove"]').last().click();
        // Every test case starts from an empty cart, not a growing shared order.
        assert.equal(await page.locator('.cart-empty-cta').count(), 1, 'Cart did not return to empty state');
        checked++;
      }
      console.log(`PASS: ${model} / 7 original finishes, configurator, cart and removal`);
    }
    assert.equal(checked, 21);
    assert.deepEqual(errors, [], 'Browser JavaScript exceptions');
    console.log(`PASS: ${checked} product/finish journeys and ${WIDTHS.length} viewport sizes`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
