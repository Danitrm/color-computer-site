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
        if (path === 'index.html') {
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
