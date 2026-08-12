import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const allPages = ['about', 'aggregate', 'edit', 'film', 'input', 'largeformat', 'microfilm', 'recruit', 'rule', 'sample', 'sample2', 'service', 'service-pack', 'speed-ad', 'telework'];
const pages = process.env.LEGACY_PAGES ? process.env.LEGACY_PAGES.split(',') : allPages;
const widths = [375, 1440];
const overflowBaseline = { about: [8, 0], aggregate: [112, 0], edit: [0, 0], film: [0, 0], input: [0, 0], largeformat: [0, 0], microfilm: [0, 0], recruit: [0, 0], rule: [0, 0], sample: [0, 0], sample2: [0, 0], service: [0, 0], 'service-pack': [0, 0], 'speed-ad': [0, 0], telework: [42, 0] };
const requiredAssets = [
  'vendor/bootstrap3/css/bootstrap.min.css', 'vendor/bootstrap3/js/bootstrap.min.js', 'vendor/bootstrap3/fonts/glyphicons-halflings-regular.woff2', 'vendor/bootstrap3/LICENSE',
  'vendor/fontawesome/css/all.min.css', 'vendor/fontawesome/css/v4-shims.min.css', 'vendor/fontawesome/webfonts/fa-solid-900.woff2', 'vendor/fontawesome/LICENSE.txt',
  'vendor/lightbox2/css/lightbox.min.css', 'vendor/lightbox2/js/lightbox.min.js', 'vendor/lightbox2/images/close.png', 'vendor/lightbox2/LICENSE'
];
const retired = /ajax\.googleapis\.com\/ajax\/libs\/jquery\/1\.12|code\.jquery\.com\/jquery-1\.12|src=["'](?:\/)?js\/bootstrap\.min\.js|use\.fontawesome\.com|kit\.fontawesome\.com|jquery-easing|bootsnav|cdnjs\.cloudflare\.com\/ajax\/libs\/lightbox2/;
for (const asset of requiredAssets) if (!fs.existsSync(path.join(output, asset))) throw new Error(`Missing legacy vendor asset: /${asset}`);
for (const pageName of pages) {
  const html = fs.readFileSync(path.join(output, `${pageName}.html`), 'utf8');
  if (retired.test(html)) throw new Error(`${pageName}.html still references a retired legacy dependency.`);
  for (const asset of ['/vendor/jquery/jquery.min.js', '/vendor/bootstrap3/js/bootstrap.min.js', '/vendor/bootstrap3/css/bootstrap.min.css', '/vendor/fontawesome/css/all.min.css', '/vendor/fontawesome/css/v4-shims.min.css']) {
    if ((html.match(new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 1) throw new Error(`${pageName}.html must load ${asset} exactly once.`);
  }
  const usesLightbox = ['aggregate', 'edit'].includes(pageName);
  if ((html.includes('/vendor/lightbox2/') !== usesLightbox)) throw new Error(`${pageName}.html has an unexpected Lightbox dependency.`);
  if (usesLightbox && !(html.indexOf('/vendor/jquery/jquery.min.js') < html.indexOf('/vendor/lightbox2/js/lightbox.min.js'))) throw new Error(`${pageName}.html loads Lightbox before jQuery.`);
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  response.writeHead(200).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const screenshots = path.join(root, '.deploy', 'pr3b-legacy');
fs.mkdirSync(screenshots, { recursive: true });
try {
  for (const pageName of pages) for (const [index, width] of widths.entries()) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    await page.route(/google-analytics|googletagmanager|fonts\.googleapis|fontawesome|cloudflare/i, (route) => route.fulfill({ status: 204, body: '' }));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const response = await page.goto(`http://127.0.0.1:${server.address().port}/${pageName}.html`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`${pageName}.html did not return 2xx at ${width}px.`);
    await page.waitForFunction(() => window.jQuery?.fn?.jquery === '3.7.1' && Boolean(window.jQuery?.fn?.collapse));
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: document.querySelector('header')?.getBoundingClientRect().height || 0,
      body: document.body.getBoundingClientRect().height,
      containers: [...document.querySelectorAll('.container')].map((node) => node.getBoundingClientRect().width).filter(Boolean),
      jquery: window.jQuery?.fn?.jquery,
      bootstrap: window.jQuery?.fn?.bootstrapVersion || Boolean(window.jQuery?.fn?.collapse),
      icons: { glyph: Boolean(document.querySelector('.glyphicon')), fontAwesome: Boolean(document.querySelector('.fa')) }
    }));
    const expectedContainer = width === 375 ? 371.25 : 1170;
    if (geometry.jquery !== '3.7.1' || !geometry.bootstrap) throw new Error(`${pageName}.html failed to initialize the local legacy core.`);
    if (geometry.overflow > overflowBaseline[pageName][index]) throw new Error(`${pageName}.html overflow worsened at ${width}px: ${geometry.overflow}px.`);
    const expectedLargestContainer = pageName === 'speed-ad' && width === 1440 ? 1352 : expectedContainer;
    if (Math.abs(geometry.header - (width === 375 ? 167.44 : 140.09)) > 5 || !geometry.body || Math.abs(Math.max(...geometry.containers) - expectedLargestContainer) / expectedLargestContainer > 0.03) throw new Error(`${pageName}.html geometry changed beyond the 3% baseline tolerance at ${width}px.`);
    if (!geometry.icons.fontAwesome || (pageName === 'sample2' && !geometry.icons.glyph)) throw new Error(`${pageName}.html is missing expected legacy icon markup.`);
    if (width === 375) {
      const toggle = page.locator('.navbar-toggle');
      await toggle.click();
      await page.waitForFunction(() => document.querySelector('.navbar-main-collapse')?.classList.contains('in'));
      await toggle.click();
      await page.waitForFunction(() => !document.querySelector('.navbar-main-collapse')?.classList.contains('in'));
    }
    if (pageName === 'about' || pageName === 'film') {
      const tabs = page.locator('[data-toggle="tab"]');
      if (await tabs.count()) { await tabs.nth(1).click(); await page.waitForTimeout(50); }
    }
    if (pageName === 'input') {
      const next = page.locator('.carousel-control.right');
      if (await next.count()) { const before = await page.locator('.carousel-inner .item.active').count(); await next.click(); await page.waitForTimeout(650); if (!before) throw new Error('input carousel is unavailable.'); }
    }
    if (['aggregate', 'edit'].includes(pageName)) {
      await page.locator('[data-lightbox]').first().click();
      await page.waitForFunction(() => document.querySelector('#lightbox')?.style.display !== 'none');
      await page.locator('.lb-close').click();
    }
    if (errors.length) throw new Error(`${pageName}.html browser console errors at ${width}px:\n${errors.join('\n')}`);
    if (['about', 'aggregate', 'input'].includes(pageName)) await page.screenshot({ path: path.join(screenshots, `${pageName}-${width}.png`), fullPage: true });
    await page.close();
    console.log(`${pageName}.html ${width}px passed.`);
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
