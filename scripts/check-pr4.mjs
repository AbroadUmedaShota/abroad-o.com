import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  response.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  for (const pageName of ['index.html', 'scan.html', 'telework.html']) for (const width of [320, 375, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
    assert.ok((await page.goto(`${base}/${pageName}`, { waitUntil: 'domcontentloaded' }))?.ok(), `${pageName} must load at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${pageName} must not overflow at ${width}px`);
    await page.close();
  }
  for (const pageName of ['index.html', 'about.html']) {
    const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
    await page.goto(`${base}/${pageName}`, { waitUntil: 'domcontentloaded' });
    const toggle = page.locator('.navbar-toggler, .navbar-toggle').first();
    await toggle.focus(); await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('.navbar-collapse')?.classList.contains('show') || document.querySelector('.navbar-main-collapse')?.classList.contains('in'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !(document.querySelector('.navbar-collapse')?.classList.contains('show') || document.querySelector('.navbar-main-collapse')?.classList.contains('in')));
    assert.equal(await toggle.evaluate((node) => document.activeElement === node), true, `${pageName} must return focus to its toggle`);
    const links = page.locator('header a[href]');
    assert.ok(await links.count(), `${pageName} requires primary header links`);
    for (let index = 0; index < await links.count(); index += 1) assert.notEqual(await links.nth(index).getAttribute('href'), '', `${pageName} header link must have a destination`);
    await page.close();
  }
  const index = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await index.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
  await index.waitForFunction(() => window.jQuery?.fn?.slick && document.querySelector('.autoplay')?.classList.contains('slick-initialized'));
  assert.equal(await index.locator('.slick-slide[aria-hidden="true"] a, .slick-slide[aria-hidden="true"] button').evaluateAll((nodes) => nodes.filter((node) => node.tabIndex >= 0).length), 0, 'hidden Slick slides must not be focusable');
  await index.close();
  for (const width of [375, 768, 1440]) {
    const form = await browser.newPage({ viewport: { width, height: 900 } });
    await form.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
    await form.goto(`${base}/form.html`, { waitUntil: 'domcontentloaded' });
    for (const id of ['enterprise', 'department', 'name', 'email', 'phone', 'address', 'inquiry_details', 'consent']) {
      const field = form.locator(`#${id}`); assert.ok(await field.count(), `form field #${id} missing`);
      const box = await field.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `#${id} must stay within the ${width}px form viewport`);
    }
    for (const id of ['email', 'phone', 'consent']) assert.ok(await form.locator(`#${id}`).getAttribute('aria-describedby'), `#${id} needs an error or feedback description`);
    assert.equal(await form.locator('#form-feedback').getAttribute('aria-live'), 'polite');
    await form.close();
  }
  console.log('PR4 responsive, keyboard navigation, and form contracts passed.');
} finally { await browser.close(); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
