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
const containerWidths = { 375: 375, 768: 720, 1440: 1140 };
const headerHeights = { 375: 224.8, 768: 143, 1440: 143 };
const bodyHeights = {
  index: { 375: 5161.9, 768: 3827.8, 1440: 4054.8 },
  scan: { 375: 6695.0, 768: 5285.7, 1440: 5262.0 }
};
const carouselHeights = { 375: 446.1, 768: 308, 1440: 370 };
const requiredAssets = [
  'vendor/bootstrap/bootstrap.min.css',
  'vendor/bootstrap/bootstrap.bundle.min.js',
  'vendor/bootstrap/LICENSE',
  'vendor/bootstrap/POPPER-LICENSE.txt',
  'vendor/jquery/jquery.min.js',
  'vendor/jquery/LICENSE.txt',
  'vendor/fontawesome/css/all.min.css',
  'vendor/fontawesome/css/v4-shims.min.css',
  'vendor/fontawesome/webfonts/fa-solid-900.woff2',
  'vendor/fontawesome/webfonts/fa-regular-400.woff2',
  'vendor/fontawesome/LICENSE.txt'
];

for (const asset of requiredAssets) {
  if (!fs.existsSync(path.join(outputRoot, asset))) throw new Error(`Missing modern vendor asset: /${asset}`);
}

for (const pageName of modernPages) {
  const html = fs.readFileSync(path.join(outputRoot, pageName), 'utf8');
  if (/stackpath\.bootstrapcdn\.com|code\.jquery\.com|cdn\.jsdelivr\.net\/npm\/@popperjs|kit\.fontawesome\.com|data-(?:toggle|target|ride|interval|pause|slide|touch)=|\bsr-only\b|\bcol-xs-/.test(html)) {
    throw new Error(`${pageName} still contains a removed modern dependency or Bootstrap 4 API.`);
  }
  for (const stylesheet of ['/vendor/fontawesome/css/all.min.css', '/vendor/fontawesome/css/v4-shims.min.css']) {
    if (html.split(`href="${stylesheet}"`).length !== 2) throw new Error(`${pageName} must load ${stylesheet} exactly once.`);
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
      page.on('request', (request) => {
        if (new URL(request.url()).hostname === 'kit.fontawesome.com') errors.push(`Retired Font Awesome Kit request: ${request.url()}`);
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
      const measurements = await page.evaluate(() => ({
        headerHeight: document.querySelector('header').getBoundingClientRect().height,
        bodyHeight: document.body.getBoundingClientRect().height,
        containerWidths: [...document.querySelectorAll('.container')]
          .map((container) => container.getBoundingClientRect().width)
          .filter((width) => width > 0),
        carouselHeight: document.querySelector('#carouselExampleIndicators')?.getBoundingClientRect().height
      }));
      const iconState = await page.evaluate(() => {
        const selectors = ['header .fas', 'footer .fa', '#title_section .fa-cog', '#scan-first .far'];
        return selectors.filter((selector) => document.querySelector(selector)).map((selector) => {
          const icon = document.querySelector(selector);
          const before = getComputedStyle(icon, '::before');
          return { selector, content: before.content, fontFamily: before.fontFamily, width: icon.getBoundingClientRect().width, height: icon.getBoundingClientRect().height };
        });
      });
      if (!iconState.length || iconState.some(({ content, fontFamily }) => !content || content === 'none' || !/Font Awesome/i.test(fontFamily)) || !iconState.some(({ width: iconWidth, height: iconHeight }) => iconWidth > 0 && iconHeight > 0)) {
        throw new Error(`${pageName} did not render local Font Awesome icons: ${JSON.stringify(iconState)}.`);
      }
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
      if (Math.abs(measurements.headerHeight - headerHeights[width]) > 2) {
        throw new Error(`${pageName} header height changed at ${width}px: ${measurements.headerHeight}px (baseline ${headerHeights[width]}px).`);
      }
      if (measurements.containerWidths.some((containerWidth) => Math.abs(containerWidth - containerWidths[width]) > 1)) {
        throw new Error(`${pageName} container width changed at ${width}px: ${measurements.containerWidths.join(', ')}px (baseline ${containerWidths[width]}px).`);
      }
      const bodyTolerance = bodyHeights[pageKey][width] * 0.03;
      if (Math.abs(measurements.bodyHeight - bodyHeights[pageKey][width]) > bodyTolerance) {
        throw new Error(`${pageName} body height changed at ${width}px: ${measurements.bodyHeight}px (baseline ${bodyHeights[pageKey][width]}px ±${bodyTolerance.toFixed(1)}px).`);
      }
      if (pageKey === 'scan' && Math.abs(measurements.carouselHeight - carouselHeights[width]) > 5) {
        throw new Error(`scan.html carousel height changed at ${width}px: ${measurements.carouselHeight}px (baseline ${carouselHeights[width]}px ±5px).`);
      }
      if (pageKey === 'index') {
        if (!versions.slick) throw new Error('index.html did not initialize Slick.');
        if (width === 375) {
          const toggler = page.locator('.navbar-toggler');
          await toggler.click();
          await page.waitForFunction(() => {
            const collapse = document.querySelector('#navbarSupportedContent');
            const toggle = document.querySelector('.navbar-toggler');
            return collapse?.classList.contains('show') && !collapse.classList.contains('collapsing') && toggle?.getAttribute('aria-expanded') === 'true';
          });
          await toggler.click();
          await page.waitForFunction(() => {
            const collapse = document.querySelector('#navbarSupportedContent');
            const toggle = document.querySelector('.navbar-toggler');
            return !collapse?.classList.contains('show') && !collapse?.classList.contains('collapsing') && toggle?.getAttribute('aria-expanded') === 'false';
          });
          await toggler.click();
          await page.waitForFunction(() => {
            const collapse = document.querySelector('#navbarSupportedContent');
            const toggle = document.querySelector('.navbar-toggler');
            return collapse?.classList.contains('show') && !collapse.classList.contains('collapsing') && toggle?.getAttribute('aria-expanded') === 'true';
          });
          const serviceDropdown = page.locator('#serviceDropdown');
          await serviceDropdown.click();
          await page.waitForFunction(() => document.querySelector('[aria-labelledby="serviceDropdown"]')?.classList.contains('show') && document.querySelector('#serviceDropdown')?.getAttribute('aria-expanded') === 'true');
          await serviceDropdown.click();
          await page.waitForFunction(() => !document.querySelector('[aria-labelledby="serviceDropdown"]')?.classList.contains('show') && document.querySelector('#serviceDropdown')?.getAttribute('aria-expanded') === 'false');
          await page.keyboard.press('Escape');
          await page.locator('#navbarSupportedContent').evaluate((node) => window.bootstrap.Collapse.getOrCreateInstance(node).hide());
          await page.waitForFunction(() => {
            const collapse = document.querySelector('#navbarSupportedContent');
            return !collapse?.classList.contains('show') && !collapse?.classList.contains('collapsing');
          });
        }
        if (width === 1440) {
          await page.locator('#serviceDropdown').hover();
          await page.waitForFunction(() => document.querySelector('[aria-labelledby="serviceDropdown"]')?.checkVisibility());
          await page.mouse.move(0, 0);
          await page.waitForFunction(() => !document.querySelector('[aria-labelledby="serviceDropdown"]')?.checkVisibility());
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
        if (await page.locator('.carousel-indicators .active').getAttribute('data-bs-slide-to') !== '0') {
          await Promise.all([
            page.waitForFunction(() => document.querySelector('.carousel-indicators .active')?.getAttribute('data-bs-slide-to') === '0'),
            page.evaluate(() => window.bootstrap.Carousel.getOrCreateInstance(document.querySelector('#carouselExampleIndicators')).to(0))
          ]);
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
