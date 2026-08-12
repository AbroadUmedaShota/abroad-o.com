import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.env.PAGE_STYLE_OUTPUT_ROOT || path.join(root, '_site'));
const capture = process.env.PAGE_STYLE_CAPTURE === '1';
const fixturePath = path.join(root, 'scripts', 'fixtures', 'page-style-ui-baseline.json');
const checks = [
  ['about.html', '.no-link-style'],
  ['form.html', '.table_agree th'], ['form.html', '.table_agree td'], ['form.html', '.scroll-spy'], ['form.html', '.consent-container'], ['form.html', '.error-message'], ['form.html', '.honeypot'],
  ['news.html', '.news-summary-item'], ['news/news_250827.html', '.info-card'], ['news/news_250827.html', '.btn-material'], ['news/news_251212.html', '.greeting-block'], ['news/news_260526.html', '.info-card .hero-section h1'],
  ['service.html', '#title_top h1'], ['service.html', '.speed-ad-service-card'],
  ['speed-ad.html', '.speed-ad-hero'], ['speed-ad.html', '.speed-ad-hero__inner'], ['speed-ad.html', '.speed-ad-actions .btn-primary'], ['speed-ad.html', '.speed-ad-hero-product-image']
];

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  response.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const measurements = {};
try {
  for (const width of [375, 1440]) {
    const pages = new Map();
    for (const [file, selector] of checks) {
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
      const style = await page.locator(selector).first().evaluate((node) => {
        const value = getComputedStyle(node);
        return Object.fromEntries(['color', 'textDecorationLine', 'backgroundColor', 'borderTopStyle', 'borderRadius', 'paddingTop', 'paddingBottom', 'fontSize', 'height', 'overflowY', 'display', 'justifyContent', 'visibility', 'boxShadow', 'maxWidth', 'width'].map((property) => [property, value[property]]));
      });
      measurements[`${file} ${selector}`] ||= {};
      measurements[`${file} ${selector}`][width] = style;
    }
    for (const [file, page] of pages) {
      if (page.__styleErrors.length || page.__styleLocalFailures.length) throw new Error(`Page stylesheet browser/local-asset failure: ${file}: ${[...page.__styleErrors, ...page.__styleLocalFailures].join('\n')}`);
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
