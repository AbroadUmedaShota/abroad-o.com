import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const file = 'slick/largeformat.html';
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'fixtures', 'legacy-ui-baseline.json'), 'utf8')).largeformat;
const localAssets = [
  '/vendor/jquery/jquery.min.js', '/vendor/bootstrap3/css/bootstrap.min.css', '/vendor/bootstrap3/js/bootstrap.min.js',
  '/vendor/fontawesome/css/all.min.css', '/vendor/fontawesome/css/v4-shims.min.css', '/js/jquery.smooth-scroll.min.js',
  '/js/legacy-smooth-scroll-all-ready.js', '/js/legacy-page-top.js', '/vendor/bootstrap3/fonts/glyphicons-halflings-regular.woff2',
  '/vendor/fontawesome/webfonts/fa-solid-900.woff2'
];
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const target = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!target.startsWith(`${output}${path.sep}`) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return response.writeHead(404).end();
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  response.writeHead(200, { 'content-type': types[path.extname(target).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(target));
});

function ratio(actual, expected) {
  return Math.abs(actual - expected) / expected;
}

const html = fs.readFileSync(path.join(output, file), 'utf8');
assert.match(html, /<link rel="canonical" href="https:\/\/www\.abroad-o\.com\/largeformat\.html">/);
assert.doesNotMatch(html, /<(?:script|style)(?![^>]*\bsrc\s*=)[^>]*>|\sstyle\s*=|\son[a-z]+\s*=/i);
assert.doesNotMatch(html, /(?:cdnjs\.cloudflare\.com|ajax\.googleapis\.com|code\.jquery\.com|use\.fontawesome\.com|jquery-easing|bootsnav|lightbox)/i);
for (const asset of localAssets.slice(0, 8)) assert.equal((html.match(new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1, `${asset} must be loaded once`);

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const screenshots = path.join(root, '.deploy', 'slick-largeformat');
fs.mkdirSync(screenshots, { recursive: true });
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', (route) => {
      const hostname = new URL(route.request().url()).hostname;
      if (['127.0.0.1', 'localhost'].includes(hostname)) return route.continue();
      if (hostname === 'www.googletagmanager.com') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
      return route.abort();
    });
    const response = await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${file} did not return HTTP 200 at ${width}px`);
    await page.waitForFunction(() => window.jQuery?.fn?.jquery === '3.7.1' && Boolean(window.jQuery?.fn?.collapse));
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: document.querySelector('header')?.getBoundingClientRect().height || 0,
      body: document.body.getBoundingClientRect().height,
      container: Math.max(...[...document.querySelectorAll('.container')].map((node) => node.getBoundingClientRect().width)),
      fonts: (() => {
        const glyph = document.createElement('span'); glyph.className = 'glyphicon glyphicon-triangle-right';
        const icon = document.createElement('i'); icon.className = 'fa fa-phone-square'; document.body.append(glyph, icon);
        const result = { glyph: getComputedStyle(glyph, '::before').fontFamily, glyphContent: getComputedStyle(glyph, '::before').content, fa: getComputedStyle(icon, '::before').fontFamily, faCode: getComputedStyle(icon, '::before').getPropertyValue('--fa') };
        glyph.remove(); icon.remove(); return result;
      })()
    }));
    const expected = baseline[width];
    assert.equal(geometry.overflow, 0, `horizontal overflow at ${width}px`);
    assert.ok(ratio(geometry.header, expected.headerHeight) <= 0.03, `header geometry changed at ${width}px`);
    assert.ok(ratio(geometry.body, expected.bodyHeight) <= 0.03, `body geometry changed at ${width}px`);
    assert.ok(ratio(geometry.container, Math.max(...expected.containerWidths)) <= 0.03, `container geometry changed at ${width}px`);
    assert.match(geometry.fonts.glyph, /Glyphicons/); assert.notEqual(geometry.fonts.glyphContent, 'none');
    assert.match(geometry.fonts.fa, /Font Awesome/); assert.ok(geometry.fonts.faCode);
    if (width === 375) {
      await page.locator('.navbar-toggle').click();
      await page.waitForFunction(() => document.querySelector('.navbar-main-collapse')?.classList.contains('in'));
      await page.locator('.navbar-toggle').click();
      await page.waitForFunction(() => !document.querySelector('.navbar-main-collapse')?.classList.contains('in'));
    }
    await page.locator('[href="#tabref-ContentC"]').click();
    await page.waitForFunction(() => document.querySelector('#tabref-ContentC')?.classList.contains('active'));
    await page.locator('.btn_center a.btn-danger').click({ modifiers: ['Control'] });
    assert.equal(await page.locator('.btn_center a.btn-danger').getAttribute('href'), '../form.html');
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForFunction(() => Number.parseFloat(window.jQuery('#page-top').css('bottom')) === 20);
    await page.screenshot({ path: path.join(screenshots, `largeformat-${width}.png`), fullPage: true });
    assert.deepEqual(errors, [], `browser console errors at ${width}px`);
    await page.close();
  }
  for (const asset of localAssets) {
    const response = await fetch(`${base}${asset}`);
    assert.ok(response.ok, `${asset} did not return HTTP 200`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${asset} was empty`);
  }
  console.log('slick/largeformat.html CSP and UI contract passed at 375px and 1440px.');
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
