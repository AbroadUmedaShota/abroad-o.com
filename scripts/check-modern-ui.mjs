import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
const modernPages = ['index.html', 'scan.html'];
const viewports = [375, 768, 1440];
const overflowBaseline = {
  index: { 375: 25, 768: 25, 1440: 25 },
  scan: { 375: 9, 768: 0, 1440: 0 }
};
const requiredAssets = [
  'vendor/bootstrap/bootstrap.min.css',
  'vendor/bootstrap/bootstrap.bundle.min.js',
  'vendor/bootstrap/LICENSE',
  'vendor/jquery/jquery.min.js',
  'vendor/jquery/LICENSE.txt'
];

for (const asset of requiredAssets) {
  if (!fs.existsSync(path.join(outputRoot, asset))) throw new Error(`Missing modern vendor asset: /${asset}`);
}

for (const pageName of modernPages) {
  const html = fs.readFileSync(path.join(outputRoot, pageName), 'utf8');
  if (/stackpath\.bootstrapcdn\.com|code\.jquery\.com|cdn\.jsdelivr\.net\/npm\/@popperjs|data-(?:toggle|target|ride|interval|pause|slide|touch)=|\bsr-only\b|\bcol-xs-/.test(html)) {
    throw new Error(`${pageName} still contains a removed modern dependency or Bootstrap 4 API.`);
  }
  const jqueryIndex = html.indexOf('/vendor/jquery/jquery.min.js');
  const bootstrapIndex = html.indexOf('/vendor/bootstrap/bootstrap.bundle.min.js');
  const slickIndex = html.indexOf('/slick/slick.min.js');
  const customIndex = html.indexOf('/js/custom.js');
  if (!(jqueryIndex >= 0 && jqueryIndex < bootstrapIndex && bootstrapIndex < slickIndex && slickIndex < customIndex)) {
    throw new Error(`${pageName} has an invalid modern script order.`);
  }
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(outputRoot, relativePath);
  if (!file.startsWith(`${outputRoot}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200).end(fs.readFileSync(file));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch();
const screenshots = path.join(repoRoot, '.deploy', 'pr3a-modern');
fs.mkdirSync(screenshots, { recursive: true });

try {
  for (const pageName of modernPages) {
    const pageKey = pageName.replace('.html', '');
    for (const width of viewports) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const response = await page.goto(`http://127.0.0.1:${port}/${pageName}`, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`${pageName} did not return 2xx at ${width}px.`);
      await page.waitForFunction(() => window.bootstrap?.Tooltip?.VERSION && window.jQuery?.fn?.jquery);
      if (pageName === 'index.html') {
        await page.waitForFunction(() => window.jQuery?.fn?.slick && document.querySelector('.autoplay')?.classList.contains('slick-initialized'));
      }
      await page.waitForTimeout(250);
      const versions = await page.evaluate(() => ({
        bootstrap: window.bootstrap?.Tooltip?.VERSION,
        jquery: window.jQuery?.fn?.jquery,
        slick: window.jQuery?.fn?.slick !== undefined,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      if (versions.bootstrap !== '5.3.8' || versions.jquery !== '3.7.1') {
        throw new Error(`${pageName} loaded unexpected dependency versions: ${JSON.stringify(versions)}.`);
      }
      if (versions.overflow > overflowBaseline[pageKey][width]) {
        const overflowNodes = await page.evaluate(() => [...document.querySelectorAll('*')]
          .map((node) => ({ selector: node.id ? `#${node.id}` : node.className, right: Math.ceil(node.getBoundingClientRect().right) }))
          .filter(({ right }) => right > window.innerWidth)
          .slice(0, 10));
        throw new Error(`${pageName} overflow worsened at ${width}px: ${versions.overflow}px (baseline ${overflowBaseline[pageKey][width]}px). ${JSON.stringify(overflowNodes)}`);
      }
      if (pageKey === 'index') {
        if (!versions.slick) throw new Error('index.html did not initialize Slick.');
        if (width === 375) {
          const toggler = page.locator('.navbar-toggler');
          await toggler.click();
          await page.waitForTimeout(400);
          if (!(await page.locator('#navbarSupportedContent').evaluate((node) => node.classList.contains('show')))) {
            throw new Error('Mobile navigation did not open.');
          }
          await toggler.click();
          await page.waitForTimeout(400);
          if (await page.locator('#navbarSupportedContent').evaluate((node) => node.classList.contains('show'))) {
            throw new Error('Mobile navigation did not close.');
          }
          await toggler.click();
          await page.waitForTimeout(400);
          const serviceDropdown = page.locator('#serviceDropdown');
          await serviceDropdown.click();
          if (!(await page.locator('[aria-labelledby="serviceDropdown"]').evaluate((node) => node.classList.contains('show'))) || await serviceDropdown.getAttribute('aria-expanded') !== 'true') {
            throw new Error('Mobile service dropdown did not open.');
          }
          await serviceDropdown.click();
          if (await page.locator('[aria-labelledby="serviceDropdown"]').evaluate((node) => node.classList.contains('show')) || await serviceDropdown.getAttribute('aria-expanded') !== 'false') {
            throw new Error('Mobile service dropdown did not close.');
          }
        }
        if (width === 1440) {
          await page.locator('#serviceDropdown').hover();
          await page.waitForTimeout(350);
          if (!(await page.locator('[aria-labelledby="serviceDropdown"]').isVisible())) {
            throw new Error('Desktop service dropdown did not open on hover.');
          }
        }
      }
      if (pageKey === 'scan') {
        await page.evaluate(() => window.bootstrap.Carousel.getOrCreateInstance(document.querySelector('#carouselExampleIndicators')).pause());
        const activeBefore = await page.locator('.carousel-indicators .active').getAttribute('data-bs-slide-to');
        await page.locator('.carousel-control-next').click();
        await page.waitForFunction((before) => document.querySelector('.carousel-indicators .active')?.getAttribute('data-bs-slide-to') !== before, activeBefore);
        const activeAfter = await page.locator('.carousel-indicators .active').getAttribute('data-bs-slide-to');
        if (activeBefore === activeAfter) throw new Error('Scan carousel next control did not change slides.');
        await page.locator('.carousel-indicators button').nth(3).click();
        await page.waitForFunction(() => document.querySelector('.carousel-indicators .active')?.getAttribute('data-bs-slide-to') === '3');
        if (await page.locator('.carousel-indicators .active').getAttribute('data-bs-slide-to') !== '3') {
          throw new Error('Scan carousel indicator did not select its slide.');
        }
      }
      if (errors.length) throw new Error(`${pageName} browser console errors at ${width}px:\n${errors.join('\n')}`);
      await page.screenshot({ path: path.join(screenshots, `${pageKey}-${width}.png`), fullPage: true });
      await page.close();
      console.log(`${pageName} ${width}px passed (overflow ${versions.overflow}px).`);
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
