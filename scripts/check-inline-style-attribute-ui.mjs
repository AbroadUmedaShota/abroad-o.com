import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const checks = [
  ['microfilm.html', '.microfilm-active-tab', 'backgroundColor', 'rgb(89, 89, 89)'], ['microfilm.html', '.microfilm-heading-band', 'backgroundColor', 'rgb(187, 187, 187)'], ['microfilm.html', '.microfilm-process-arrow', 'borderTopColor', 'rgb(187, 187, 187)'], ['microfilm.html', '.microfilm-process-step', 'borderLeftColor', 'rgb(187, 187, 187)'],
  ['scan.html', '.scan-heading-band', 'backgroundColor', 'rgb(8, 46, 93)'], ['form.html', '.form-page-title', 'textAlign', 'center'], ['news.html', '.news-list-spacing', 'marginTop', '30px'], ['news/news_250827.html', '.news-detail-back-link--compact', 'marginBottom', '15px'], ['news/news_250827.html', '.news-article-cta', 'marginTop', '30px'], ['news/news_250827.html', '.news-article-date', 'textAlign', 'right']
];
const missing = [];
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.slice(1));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    missing.push(pathname);
    return response.writeHead(404).end();
  }
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  for (const width of [375, 1440]) {
    const pages = new Map();
    for (const [file, selector, property, expected] of checks) {
      let page = pages.get(file);
      if (!page) {
        page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await page.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
        const response = await page.goto(`http://127.0.0.1:${server.address().port}/${file}`, { waitUntil: 'domcontentloaded' });
        assert.ok(response?.ok(), `${file} did not load at ${width}px`);
        page.__errors = errors;
        pages.set(file, page);
      }
      const actual = await page.locator(selector).first().evaluate((node, property) => getComputedStyle(node)[property], property);
      assert.equal(actual, expected, `${file} ${selector} ${property} at ${width}px`);
    }
    for (const [file, page] of pages) {
      assert.deepEqual(page.__errors, [], `${file} console errors at ${width}px`);
      await page.close();
    }
  }
  assert.deepEqual(missing, [], `Missing local assets: ${missing.join(', ')}`);
  console.log('Inline style attribute UI contract passed at 375px and 1440px.');
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
