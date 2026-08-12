import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.split('=');
  return [key.replace(/^--/, ''), value.join('=')];
}));
if (!args.site || !args.output) throw new Error('Usage: node scripts/capture-news-form-ui-baseline.mjs --site=<generated-site> --output=<fixture.json> [--screenshots=<directory>]');

const site = path.resolve(args.site);
const outputFile = path.resolve(args.output);
const screenshotDirectory = args.screenshots ? path.resolve(args.screenshots) : null;
const articles = fs.readdirSync(path.join(site, 'news')).filter((name) => name.endsWith('.html')).sort().map((name) => `news/${name}`);
const pages = ['news.html', ...articles, 'form.html', 'thank.html'];
if (pages.length !== 30) throw new Error(`Expected 30 NEWS/form baseline pages, found ${pages.length}.`);

const contentTypes = {
  '.css': 'text/css; charset=utf-8', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2'
};
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(site, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${site}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  response.writeHead(200, { 'content-type': contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const metrics = {};
try {
  for (const pageName of pages) for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'abroad-o-contact-form.abroad-o.workers.dev') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ turnstileSiteKey: 'test-site-key', turnstileAction: 'contact-submit' }) });
      if (url.href === 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit') return route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.turnstile={render:(node,options)=>{window.__turnstileOptions=options;return 'baseline-widget'},reset:()=>{}};` });
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    const response = await page.goto(`${base}/${pageName}`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`${pageName} did not return HTTP 200 at ${width}px.`);
    if (pageName === 'form.html') await page.waitForFunction(() => window.__turnstileOptions);
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: document.querySelector('header')?.getBoundingClientRect().height || 0,
      body: document.body.getBoundingClientRect().height,
      container: Math.max(0, ...[...document.querySelectorAll('.container')].map((node) => node.getBoundingClientRect().width))
    }));
    metrics[pageName] ||= {};
    metrics[pageName][width] = geometry;
    if (screenshotDirectory && width === 375 && ['news.html', 'news/news_171023.html', 'news/news_17110101.html', 'form.html', 'thank.html'].includes(pageName)) {
      fs.mkdirSync(screenshotDirectory, { recursive: true });
      await page.screenshot({ path: path.join(screenshotDirectory, `${pageName.replaceAll('/', '-').replace('.html', '')}.png`), fullPage: true });
    }
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(`Captured ${pages.length * 2} NEWS/form baseline cases from ${site}.`);
