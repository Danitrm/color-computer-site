// Browser-level smoke checks for the real storefront, without sending messages or orders.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.CC_TEST_BASE || 'http://127.0.0.1:8765/';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('#hero-title').innerText(), /Computadores[\\s\\S]*evoluíram por dentro[\\s\\S]*A experiência também[\\s\\S]*precisa evoluir/);
    assert.equal(await page.getByRole('link', { name: /CONFIGURE O SEU/i }).getAttribute('href'), 'escolher-pc.html');
    assert.equal(await page.locator('.hero-art img').getAttribute('src'), 'ascension_01_preto.png');
    assert.equal(await page.locator('.hero-art img').evaluate(img => img.complete && img.naturalWidth > 0), true, 'Hero original photo failed to load');
    for (const name of ['OS MODELOS', 'AMBIENTES', 'MEU CARRINHO']) {
      assert.equal(await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: new RegExp(name) }).isVisible(), true, name + ' hidden on mobile');
    }
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.cc-skip-link').evaluate(el => el === document.activeElement), true, 'Skip link is not keyboard accessible');
    const card = page.locator('.product').first();
    await card.locator('[data-finish="blue"]').click();
    await page.waitForFunction(() => document.querySelector('.product .product-media img').getAttribute('src') === 'ascension_04_azul.png');
    assert.equal(await card.locator('[data-finish="blue"]').getAttribute('aria-pressed'), 'true');
    const url = await card.locator('[data-configure]').getAttribute('href');
    assert.match(url, /modelo=ascension&cor=blue/);
    await card.locator('[data-configure]').click();
    await page.waitForURL(/configurar-pc\.html/);
    assert.match(page.url(), /cor=blue/);
    assert.equal(await page.locator('#pcImage').getAttribute('src'), 'ascension_04_azul.png');
    await page.locator('#addToCart').click();
    await page.waitForURL(/carrinho\.html/);
    assert.equal(await page.locator('.cart-product-visual img').count(), 1);
    assert.equal(await page.locator('.cart-product-visual img').getAttribute('src'), 'ascension_04_azul.png');
    assert.equal(await page.locator('#checkoutBtn').isEnabled(), true);
    await page.locator('#checkoutBtn').click();
    await page.locator('#finish').click();
    assert.match(await page.locator('#feedback').innerText(), /Informe seu nome/);
    await page.locator('#name').fill('Cliente Teste');
    await page.locator('#email').fill('teste@example.com');
    await page.locator('#finish').click();
    assert.equal(await page.locator('#sendActions').isVisible(), true);
    assert.match(await page.locator('#sendDaniel').getAttribute('href'), /^https:\/\/wa\.me\/\d+\?text=/);
    assert.match(await page.locator('#orderText').inputValue(), /NÃO É PEDIDO CONFIRMADO/);
    assert.equal(await page.locator('#officialQuoteForm').isVisible(), false, 'Unapproved automatic quote form became visible');
    await page.locator('[data-act="remove"]').click();
    assert.equal(await page.locator('.cart-empty-cta').isVisible(), true);
    assert.equal(await page.locator('#checkoutBtn').isDisabled(), true);
    assert.deepEqual(errors, [], 'Unexpected browser JavaScript errors');
    console.log('PASS: mobile nav, keyboard skip, colors, configurator, cart, quote preparation, empty cart');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
