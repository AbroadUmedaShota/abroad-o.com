import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { assertPr4FormContract, assertPr4HtmlContract } from './lib/pr4-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const timeout = Number(process.env.PR4_TIMEOUT_MS || 5000);
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  response.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
const closeServer = () => new Promise((resolve, reject) => {
  server.closeAllConnections?.(); server.closeIdleConnections?.();
  server.close((error) => error ? reject(error) : resolve());
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const withPage = async (viewport, action) => {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(timeout);
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.fulfill({ status: 204, body: '' });
  });
  try { return await action(page); } finally { await page.close({ runBeforeUnload: false }); }
};
const open = async (page, name, readiness) => {
  const response = await page.goto(`${base}/${name}`, { waitUntil: 'domcontentloaded', timeout });
  assert.ok(response?.ok(), `${name} must load`);
  await page.waitForFunction(readiness, undefined, { timeout });
};
const isOpen = (legacy = false) => legacy
  ? document.querySelector('.navbar-main-collapse')?.classList.contains('in')
  : document.querySelector('.navbar-collapse')?.classList.contains('show');
const assertMenu = async (page, toggleId, legacy) => {
  const toggle = page.locator(`#${toggleId}`);
  const menu = page.locator(`#${await toggle.getAttribute('aria-controls')}`);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.navAccessibilityReady), 'true', 'navigation accessibility behavior must initialize');
  await toggle.click();
  await page.waitForFunction(({ toggleId, legacy }) => document.querySelector(`#${toggleId}`)?.getAttribute('aria-expanded') === 'true' && document.querySelector(`#${document.querySelector(`#${toggleId}`)?.getAttribute('aria-controls')}`)?.classList.contains('show'), { toggleId, legacy }, { timeout });
  await page.keyboard.press('ArrowDown');
  assert.equal(await menu.locator('a').first().evaluate((node) => document.activeElement === node), true, `${toggleId} ArrowDown must focus first submenu item`);
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => document.activeElement?.id === id, toggleId, { timeout });
  assert.equal(await toggle.evaluate((node) => document.activeElement === node), true, `${toggleId} Escape must return focus`);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false', `${toggleId} Escape must sync aria-expanded`);
  await toggle.focus(); await page.keyboard.press('Space');
  await page.waitForFunction((id) => document.querySelector(`#${id}`)?.getAttribute('aria-expanded') === 'true', toggleId, { timeout });
  await page.keyboard.press('Escape');
  await toggle.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction((id) => document.querySelector(`#${id}`)?.getAttribute('aria-expanded') === 'true', toggleId, { timeout });
  await page.keyboard.press('Escape');
  await toggle.click(); await page.mouse.click(1, 1);
  await page.waitForFunction((id) => document.querySelector(`#${id}`)?.getAttribute('aria-expanded') === 'false', toggleId, { timeout });
};

try {
  assertPr4HtmlContract(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), 'index.html');
  assertPr4FormContract(fs.readFileSync(path.join(output, 'form.html'), 'utf8'));
  for (const pageName of ['index.html', 'scan.html', 'telework.html']) for (const width of [320, 375, 768, 1440]) await withPage({ width, height: 900 }, async (page) => {
    await open(page, pageName, () => document.readyState === 'complete');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${pageName} must not overflow at ${width}px`);
  });
  for (const [pageName, legacy] of [['index.html', false], ['about.html', true]]) await withPage({ width: 375, height: 900 }, async (page) => {
    await open(page, pageName, legacy ? () => window.jQuery?.fn?.collapse : () => window.bootstrap && window.jQuery);
    const toggle = page.locator(legacy ? '.navbar-toggle' : '.navbar-toggler');
    for (const link of await page.locator('header a[href]').all()) assert.notEqual(await link.getAttribute('href'), '', `${pageName} primary header link must have a destination`);
    const outside = page.locator('main a[href], footer a[href]').first();
    await outside.focus(); await page.keyboard.press('Escape');
    assert.equal(await outside.evaluate((node) => document.activeElement === node), true, `${pageName} closed main navigation Escape must preserve unrelated focus`);
    await toggle.focus(); await page.keyboard.press('Space');
    await page.waitForFunction(isOpen, legacy, { timeout });
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape'); await page.waitForFunction((isLegacy) => !(isLegacy ? document.querySelector('.navbar-main-collapse')?.classList.contains('in') : document.querySelector('.navbar-collapse')?.classList.contains('show')), legacy, { timeout });
    await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('aria-expanded') === 'false', legacy ? '.navbar-toggle' : '.navbar-toggler', { timeout });
    assert.equal(await toggle.evaluate((node) => document.activeElement === node), true, `${pageName} must return focus to toggle`);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('Escape');
    await page.waitForFunction((isLegacy) => !(isLegacy ? document.querySelector('.navbar-main-collapse')?.classList.contains('in') : document.querySelector('.navbar-collapse')?.classList.contains('show')), legacy, { timeout });
  });
  for (const [pageName, legacy] of [['index.html', false], ['about.html', true]]) await withPage({ width: 375, height: 900 }, async (page) => {
    await open(page, pageName, legacy ? () => window.jQuery?.fn?.collapse : () => window.bootstrap && window.jQuery);
    const toggle = page.locator(legacy ? '.navbar-toggle' : '.navbar-toggler');
    const collapse = page.locator(legacy ? '.navbar-main-collapse' : '.navbar-collapse');
    await toggle.click(); await page.waitForFunction(isOpen, legacy, { timeout });
    const primary = collapse.locator('a[href]').first();
    await primary.evaluate((node) => node.addEventListener('click', (event) => event.preventDefault(), { once: true }));
    await primary.click();
    await page.waitForFunction((isLegacy) => !(isLegacy ? document.querySelector('.navbar-main-collapse')?.classList.contains('in') : document.querySelector('.navbar-collapse')?.classList.contains('show')), legacy, { timeout });
    await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('aria-expanded') === 'false', legacy ? '.navbar-toggle' : '.navbar-toggler', { timeout });
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false', `${pageName} mobile primary-link activation must close main navigation`);
    assert.equal(await toggle.evaluate((node) => document.activeElement === node), true, `${pageName} mobile primary-link activation must focus toggle`);
  });
  for (const [pageName, legacy] of [['index.html', false], ['about.html', true]]) await withPage({ width: 1440, height: 900 }, async (page) => {
    await open(page, pageName, legacy ? () => window.jQuery?.fn?.collapse : () => window.bootstrap && window.jQuery);
    await assertMenu(page, legacy ? 'legacyServiceDropdown' : 'serviceDropdown', legacy);
    const toggle = page.locator(`#${legacy ? 'legacyServiceDropdown' : 'serviceDropdown'}`);
    for (const key of ['Enter', 'Space', 'ArrowDown']) {
      await toggle.focus(); await page.keyboard.press(key);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true', `${pageName} submenu ${key} must open it`);
      assert.equal(await toggle.locator('xpath=..').evaluate((node) => node.classList.contains('open')), true, `${pageName} submenu ${key} must set dropdown class`);
      await page.keyboard.press('Escape');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false', `${pageName} submenu Escape must close it`);
      assert.equal(await toggle.evaluate((node) => document.activeElement === node), true, `${pageName} submenu Escape must retain its toggle focus`);
    }
  });
  await withPage({ width: 375, height: 900 }, async (page) => {
    await open(page, 'index.html', () => window.jQuery?.fn?.slick && document.querySelector('.autoplay')?.classList.contains('slick-initialized'));
    assert.equal(await page.locator('.slick-slide[aria-hidden="true"] a, .slick-slide[aria-hidden="true"] button').evaluateAll((nodes) => nodes.filter((node) => node.tabIndex >= 0).length), 0, 'hidden Slick slides must not be focusable');
    assert.ok(await page.locator('.slick-slide[aria-hidden="false"]').count(), 'active Slick slide must remain exposed to assistive technology');
  });
  for (const width of [375, 768, 1440]) await withPage({ width, height: 900 }, async (page) => {
    await open(page, 'form.html', () => document.querySelector('#form-feedback'));
    const fields = ['enterprise', 'department', 'name', 'email', 'phone', 'address', 'inquiry_details', 'consent'];
    const boxes = [];
    for (const id of fields) {
      const field = page.locator(`#${id}`); assert.ok(await field.count(), `form field #${id} missing`);
      const box = await field.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `#${id} must stay within ${width}px viewport`); boxes.push({ id, box });
    }
    for (const row of boxes) for (const other of boxes) if (row.id !== other.id && Math.abs(row.box.y - other.box.y) < 1) assert.ok(row.box.x + row.box.width <= other.box.x + 1 || other.box.x + other.box.width <= row.box.x + 1, `${row.id} must not overlap ${other.id}`);
    for (const id of ['email', 'phone']) {
      const field = page.locator(`#${id}`); const describedBy = await field.getAttribute('aria-describedby');
      assert.ok(describedBy && await page.locator(`#${describedBy}`).count(), `#${id} needs an existing error description`);
      await field.fill(id === 'email' ? 'invalid' : 'abc'); assert.equal(await field.getAttribute('aria-invalid'), 'true');
      assert.equal(await field.evaluate((node) => document.activeElement === node), true);
    }
    assert.ok(await page.locator('#consent').getAttribute('aria-labelledby'), 'consent needs an accessible name');
    assert.match(await page.locator('#form-feedback').getAttribute('role'), /^(status|alert)$/); assert.equal(await page.locator('#form-feedback').getAttribute('aria-live'), 'polite');
  });
  console.log('PR4 responsive, keyboard navigation, Slick, and form contracts passed.');
} finally {
  await browser.close();
  await closeServer();
}
