import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const pages = [
  { file: 'about.html', smooth: true, year: true, pageTop: true },
  { file: 'rule.html', smooth: true, year: true },
  { file: 'service.html', smooth: true },
  { file: 'speed-ad.html', smooth: true },
  { file: 'news.html', smooth: true, year: true },
  { file: 'form.html' },
  { file: 'index.html', smooth: true, year: true, modern: true },
  { file: 'scan.html', smooth: true, year: true, modern: true }
];

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  response.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const smoothScrollProbe = `
  ;(function ($) {
    var original = $.fn.smoothScroll;
    window.__abroadSmoothScrollCalls = 0;
    $.fn.smoothScroll = function () {
      window.__abroadSmoothScrollCalls += this.length;
      return original.apply(this, arguments);
    };
  })(window.jQuery);
`;

async function installSmoothScrollProbe(page) {
  await page.route('**/js/jquery.smooth-scroll.min.js', async (route) => {
    const body = fs.readFileSync(path.join(output, 'js', 'jquery.smooth-scroll.min.js'), 'utf8');
    await route.fulfill({ contentType: 'text/javascript', body: `${body}${smoothScrollProbe}` });
  });
}

async function assertPageTopBehavior(page) {
  const bottom = () => page.evaluate(() => Number.parseFloat(window.jQuery('#page-top').css('bottom')));
  await page.waitForFunction(() => Number.parseFloat(window.jQuery('#page-top').css('bottom')) === -150);
  await page.evaluate(() => window.scrollTo(0, 250));
  await page.waitForTimeout(350);
  if (await bottom() >= 0) throw new Error('page-top was visible at scrollTop <= 300.');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForFunction(() => Number.parseFloat(window.jQuery('#page-top').css('bottom')) === 20);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => Number.parseFloat(window.jQuery('#page-top').css('bottom')) === -200);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForFunction(() => window.scrollY === 600);
  await page.locator('#page-top').click();
  await page.waitForFunction(() => window.scrollY === 0, undefined, { timeout: 1000 });
}

async function assertNoopRuntimeMutationIsDetected(base) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await installSmoothScrollProbe(page);
    await page.route('**/js/legacy-smooth-scroll-all.js', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
    const response = await page.goto(`${base}/about.html`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error('No-op runtime mutation target did not return HTTP 200.');
    await page.waitForFunction(() => typeof window.jQuery?.fn?.smoothScroll === 'function');
    await page.waitForTimeout(100);
    if (await page.evaluate(() => window.__abroadSmoothScrollCalls) !== 0) {
      throw new Error('No-op runtime mutation negative did not disable the smooth-scroll invocation.');
    }
  } finally {
    await page.close();
  }
}

try {
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const target of pages) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    if (target.smooth) await installSmoothScrollProbe(page);
    const response = await page.goto(`${base}/${target.file}`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`${target.file} did not return HTTP 200.`);
    await page.waitForFunction(() => window.jQuery?.fn?.jquery === '3.7.1');
    if (target.smooth) {
      await page.waitForFunction(() => typeof window.jQuery?.fn?.smoothScroll === 'function');
      await page.waitForFunction(() => window.__abroadSmoothScrollCalls > 0);
    }
    if (target.year) {
      await page.waitForFunction((year) => document.querySelector('#current-year')?.textContent === year, String(new Date().getFullYear()));
    }
    if (target.pageTop) await assertPageTopBehavior(page);
    if (target.modern && !await page.evaluate(() => Boolean(window.bootstrap))) throw new Error(`${target.file} did not initialize Bootstrap.`);
    if (errors.length) throw new Error(`${target.file} browser console errors:\n${errors.join('\n')}`);
    await page.close();
    console.log(`${target.file} CSP runtime passed.`);
  }
  await assertNoopRuntimeMutationIsDetected(base);
  console.log('No-op runtime mutation negative passed.');
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
