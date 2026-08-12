import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const articles = fs.readdirSync(path.join(output, 'news')).filter((name) => name.endsWith('.html')).sort().map((name) => `news/${name}`);
const allPages = ['news.html', ...articles, 'form.html', 'thank.html'];
const pages = process.env.NEWS_FORM_PAGES ? process.env.NEWS_FORM_PAGES.split(',') : allPages;
const widths = process.env.NEWS_FORM_WIDTHS ? process.env.NEWS_FORM_WIDTHS.split(',').map(Number) : [375, 1440];
const timeout = Number(process.env.NEWS_FORM_TIMEOUT_MS || 10000);
const writeScreenshots = process.env.NEWS_FORM_SKIP_SCREENSHOTS !== '1';
const lightbox = new Set(['news/news_17110101.html', 'news/news_17110102.html', 'news/news_17110103.html', 'news/news_18083101.html', 'news/news_18083102.html', 'news/news_210329.html', 'news/news_220807.html']);
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'fixtures', 'news-form-ui-baseline.json'), 'utf8'));
const core = ['/vendor/jquery/jquery.min.js', '/vendor/bootstrap3/js/bootstrap.min.js', '/vendor/bootstrap3/css/bootstrap.min.css', '/vendor/fontawesome/css/all.min.css', '/vendor/fontawesome/css/v4-shims.min.css'];
const retired = /jquery(?:-|\.)1\.12|jquery-3\.2\.1\.slim|cdnjs\.cloudflare\.com\/(?:ajax\/libs\/font-awesome|ajax\/libs\/jquery-easing|ajax\/libs\/bootsnav|ajax\/libs\/popper)|maxcdn\.bootstrapcdn\.com\/bootstrap\/4|use\.fontawesome\.com|(?:src=["'](?:\.\.\/)?js\/bootstrap\.min\.js)/i;
const unsafeBs3 = /data-toggle=["'](?:tooltip|popover)["']|data-(?:content|template|loading-text)=|\.(?:tooltip|popover)\(|\.button\(\s*["']loading/;
const blockedAsset = process.env.NEWS_FORM_BLOCK_ASSET || '';
const count = (html, needle) => (html.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
if (!process.env.NEWS_FORM_PAGES && pages.length !== 30) throw new Error(`Expected 30 NEWS/form targets, found ${pages.length}.`);
for (const pageName of pages) {
  const html = fs.readFileSync(path.join(output, pageName), 'utf8');
  if (retired.test(html) || unsafeBs3.test(html)) throw new Error(`${pageName} retains a retired or advisory-covered dependency/API.`);
  for (const asset of core) if (count(html, asset) !== 1) throw new Error(`${pageName} must load ${asset} exactly once.`);
  const hasLightbox = html.includes('/vendor/lightbox2/');
  if (hasLightbox !== lightbox.has(pageName)) throw new Error(`${pageName} has an unexpected Lightbox dependency.`);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const file = path.resolve(output, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
  response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(url.pathname === blockedAsset ? '' : fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const candidateMetrics = {};
try {
  for (const pageName of pages) for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(timeout);
    const errors = [], localFailures = [];
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'abroad-o-contact-form.abroad-o.workers.dev') return route.fulfill({ status: 200, contentType: 'application/json', body: url.pathname.endsWith('/config') ? JSON.stringify({ turnstileSiteKey: 'test-site-key', turnstileAction: 'contact-submit' }) : JSON.stringify({ ok: true }) });
      if (url.hostname === 'challenges.cloudflare.com') return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.turnstile={render:(node,options)=>{window.__turnstileOptions=options; return "test-widget"},reset:()=>{}};' });
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', (request) => { if (new URL(request.url()).hostname === '127.0.0.1') localFailures.push(request.url()); });
    const response = await page.goto(`${base}/${pageName}`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`${pageName} did not return HTTP 200 at ${width}px.`);
    await page.waitForFunction(() => window.jQuery?.fn?.jquery === '3.7.1' && Boolean(window.jQuery?.fn?.collapse));
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, header: document.querySelector('header')?.getBoundingClientRect().height || 0, body: document.body.getBoundingClientRect().height, container: Math.max(0, ...[...document.querySelectorAll('.container')].map((node) => node.getBoundingClientRect().width)) }));
    if (!metrics.body || !metrics.header || metrics.overflow > 1) throw new Error(`${pageName} geometry/overflow contract failed at ${width}px: ${JSON.stringify(metrics)}.`);
    const reference = baseline[pageName]?.[width];
    if (!reference) throw new Error(`Missing base 654b193 geometry baseline for ${pageName} at ${width}px.`);
    for (const key of ['header', 'body', 'container']) if (Math.abs(metrics[key] - reference[key]) / reference[key] > 0.03) throw new Error(`${pageName} ${key} changed beyond the 3% baseline tolerance at ${width}px: base=${reference[key]}, candidate=${metrics[key]}.`);
    if (metrics.overflow > reference.overflow + 1) throw new Error(`${pageName} overflow worsened from base at ${width}px.`);
    candidateMetrics[pageName] ||= {};
    candidateMetrics[pageName][width] = metrics;
    const icons = await page.evaluate(() => {
      const glyph = document.createElement('span'), icon = document.createElement('i');
      glyph.className = 'glyphicon glyphicon-arrow-right'; icon.className = 'fa fa-phone'; document.body.append(glyph, icon);
      const glyphStyle = getComputedStyle(glyph, '::before'), iconStyle = getComputedStyle(icon, '::before');
      const value = {
        glyph: { content: glyphStyle.content, font: glyphStyle.fontFamily },
        fontAwesome: { content: iconStyle.content, font: iconStyle.fontFamily, code: iconStyle.getPropertyValue('--fa') }
      };
      glyph.remove(); icon.remove(); return value;
    });
    if (!icons.glyph.font.includes('Glyphicons') || ['none', 'normal'].includes(icons.glyph.content) || !icons.fontAwesome.font.includes('Font Awesome') || ['none', 'normal'].includes(icons.fontAwesome.content) || !icons.fontAwesome.code) throw new Error(`${pageName} did not render local Glyphicons/Font Awesome: ${JSON.stringify(icons)}.`);
    if (writeScreenshots && width === 375 && ['news.html', 'news/news_171023.html', 'news/news_17110101.html', 'form.html', 'thank.html'].includes(pageName)) { fs.mkdirSync(path.join(root, '.deploy', 'pr3c-news-form'), { recursive: true }); await page.screenshot({ path: path.join(root, '.deploy', 'pr3c-news-form', `${pageName.replaceAll('/', '-').replace('.html', '')}.png`), fullPage: true }); }
    if (width === 375) { await page.locator('.navbar-toggle').click(); await page.waitForFunction(() => document.querySelector('.navbar-main-collapse')?.classList.contains('in')); }
    if (lightbox.has(pageName)) { const trigger = page.locator('[data-lightbox]').first(); await trigger.click(); await page.waitForFunction(() => document.querySelector('#lightbox')?.style.display !== 'none' && document.querySelector('.lb-image')?.naturalWidth > 0); await page.locator('.lb-close').click(); await page.waitForFunction(() => document.querySelector('#lightbox')?.style.display === 'none'); }
    if (errors.length || localFailures.length) throw new Error(`${pageName} browser/local-asset failure: ${[...errors, ...localFailures].join('\n')}`);
    await page.close();
    console.log(`${pageName} ${width}px passed.`);
  }
} finally { await browser.close(); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
if (!process.env.NEWS_FORM_PAGES) {
  const evidenceDirectory = path.join(root, '.deploy', 'pr3c-news-form');
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(path.join(evidenceDirectory, 'metrics.json'), `${JSON.stringify(candidateMetrics, null, 2)}\n`);
}
