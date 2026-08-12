import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.env.PAGE_STYLE_OUTPUT_ROOT || path.join(root, '_site'));
const capture = process.env.PAGE_STYLE_CAPTURE === '1';
const fixturePath = path.join(root, 'scripts', 'fixtures', 'page-style-ui-baseline.json');
const checks = [
  ['about.html', '.no-link-style', ['color', 'textDecorationLine']],
  ['form.html', '.table_agree th', ['fontSize']], ['form.html', '.table_agree td', ['fontSize', 'paddingBottom']], ['form.html', '.scroll-spy', ['height', 'overflowY', 'borderTopStyle']], ['form.html', '.consent-container', ['display', 'justifyContent']], ['form.html', '.error-message', ['color', 'display']], ['form.html', '.honeypot', ['display', 'visibility', 'position']],
  ['news.html', '.news-summary-item', ['borderTopStyle', 'borderRadius', 'paddingTop', 'boxShadow']], ['news/news_250827.html', '.info-card', ['backgroundColor', 'borderRadius', 'paddingTop', 'boxShadow']], ['news/news_250827.html', '.btn-material', ['backgroundColor', 'borderRadius', 'paddingTop', 'fontSize']], ['news/news_251212.html', '.greeting-block', ['backgroundColor', 'borderTopStyle', 'paddingTop']], ['news/news_260526.html', '.info-card .hero-section h1', ['color', 'fontSize', 'fontWeight']],
  ['service.html', '#title_top h1', ['paddingTop', 'fontSize']], ['service.html', '.speed-ad-service-card', ['borderTopStyle', 'borderRadius', 'backgroundColor']],
  ['speed-ad.html', '.speed-ad-hero', ['backgroundImage', 'backgroundPosition', 'backgroundSize', 'color']], ['speed-ad.html', '.speed-ad-hero__inner', ['display', 'alignItems', 'justifyContent', 'paddingTop']], ['speed-ad.html', '.speed-ad-actions .btn-primary', ['backgroundColor', 'borderRadius', 'fontWeight']], ['speed-ad.html', '.speed-ad-hero-product-image', ['maxWidth', 'display']]
];

const missingLocalAssets = [];
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    missingLocalAssets.push(pathname);
    return response.writeHead(404).end();
  }
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  response.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const measurements = {};
try {
  for (const width of [375, 1440]) {
    const pages = new Map();
    for (const [file, selector, properties] of checks) {
      let page = pages.get(file);
      if (!page) {
        page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        const localFailures = [];
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('requestfailed', (request) => { if (['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) localFailures.push(request.url()); });
        await page.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
        const response = await page.goto(`http://127.0.0.1:${server.address().port}/${file}`, { waitUntil: 'domcontentloaded' });
        if (!response?.ok()) throw new Error(`Style check failed to load ${file} at ${width}px.`);
        page.__styleErrors = errors;
        page.__styleLocalFailures = localFailures;
        pages.set(file, page);
      }
      const style = await page.locator(selector).first().evaluate((node, properties) => {
        const value = getComputedStyle(node);
        return Object.fromEntries(properties.map((property) => [property, value[property].replace(/https?:\/\/127\.0\.0\.1:\d+/g, '')]));
      }, properties);
      measurements[`${file} ${selector}`] ||= {};
      measurements[`${file} ${selector}`][width] = style;
    }
    for (const [file, page] of pages) {
      if (!capture && (page.__styleErrors.length || page.__styleLocalFailures.length)) throw new Error(`Page stylesheet browser/local-asset failure: ${file}: ${[...page.__styleErrors, ...page.__styleLocalFailures, ...missingLocalAssets].join('\n')}`);
      await page.close();
    }
    console.log(`Page stylesheet UI passed at ${width}px.`);
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
if (capture) {
  fs.writeFileSync(fixturePath, `${JSON.stringify(measurements, null, 2)}\n`);
  console.log(`Captured page stylesheet UI baseline: ${path.relative(root, fixturePath)}.`);
} else {
  const baseline = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  if (JSON.stringify(measurements) !== JSON.stringify(baseline)) throw new Error('Page stylesheet computed-style baseline changed.');
  console.log('Page stylesheet computed-style baseline matched.');
}
