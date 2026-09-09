import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const screenshotDir = path.join(root, 'output', 'playwright');
const helpUrl = 'https://support.speed-ad.com/help/';
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

fs.mkdirSync(screenshotDir, { recursive: true });

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(file));
});

const closeServer = () => new Promise((resolve, reject) => {
  server.closeAllConnections?.();
  server.closeIdleConnections?.();
  server.close((error) => error ? reject(error) : resolve());
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile-390', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.fulfill({ status: 204, body: '' });
    });
    const response = await page.goto(`${base}/speed-ad.html`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `speed-ad.html must load at ${viewport.name}`);
    assert.equal(await page.locator('h1').innerText(), 'SPEED AD');
    assert.equal(await page.locator('.speed-ad-eyebrow').innerText(), '展示会向けWEBアンケート作成サービス');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${viewport.name} must not overflow horizontally`);

    const help = page.getByRole('link', { name: 'SPEED ADのヘルプを見る' });
    assert.equal(await help.getAttribute('href'), helpUrl);
    assert.equal(await help.getAttribute('target'), '_blank');
    assert.equal(await help.getAttribute('rel'), 'noopener noreferrer');
    await page.screenshot({ path: path.join(screenshotDir, `speed-ad-help-${viewport.name}.png`), fullPage: true });
    await help.evaluate((node) => node.addEventListener('click', (event) => { event.preventDefault(); window.__speedAdHelpActivated = true; }, { once: true }));
    await help.focus();
    assert.equal(await help.evaluate((node) => document.activeElement === node), true, `${viewport.name} HELP link must accept keyboard focus`);
    assert.notEqual(await help.evaluate((node) => getComputedStyle(node).outlineStyle), 'none', `${viewport.name} HELP focus must be visible`);
    await page.screenshot({ path: path.join(screenshotDir, `speed-ad-help-focus-${viewport.name}.png`), fullPage: true });
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.__speedAdHelpActivated), true, `${viewport.name} HELP link must activate with Enter`);

    assert.equal(await page.getByRole('link', { name: '無料で始める' }).first().getAttribute('href'), 'https://speed-ad.com/?intent=signup#top');
    assert.equal(await page.getByRole('link', { name: '展示会後の運用を相談する' }).first().getAttribute('href'), 'form.html?service=speed-ad');
    await page.close();
  }

  if (process.env.SPEED_AD_LIVE_CHECK === '1') {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const live = await page.goto(`https://www.abroad-o.com/speed-ad.html?codex-check=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    assert.ok(live && live.status() >= 200 && live.status() < 400, `live SPEED AD page returned ${live?.status()}`);
    const help = await page.goto(helpUrl, { waitUntil: 'domcontentloaded' });
    assert.ok(help && help.status() >= 200 && help.status() < 400, `SPEED AD HELP returned ${help?.status()}`);
    assert.ok((await page.title()).trim(), 'SPEED AD HELP must have a page title');
    await page.close();
  }

  console.log('SPEED AD HELP desktop, 390px, keyboard, route, and CTA checks passed.');
} finally {
  await browser.close();
  await closeServer();
}
