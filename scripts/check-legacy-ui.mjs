import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const allPages = ['about', 'aggregate', 'edit', 'film', 'input', 'largeformat', 'microfilm', 'recruit', 'rule', 'sample', 'sample2', 'service', 'service-pack', 'speed-ad', 'telework'];
const pages = process.env.LEGACY_PAGES ? process.env.LEGACY_PAGES.split(',') : allPages;
const widths = process.env.LEGACY_WIDTHS ? process.env.LEGACY_WIDTHS.split(',').map(Number) : [375, 1440];
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'fixtures', 'legacy-ui-baseline.json'), 'utf8'));
const blockedAsset = process.env.LEGACY_BLOCK_ASSET || '';
const disabledBehavior = process.env.LEGACY_DISABLE_BEHAVIOR || '';
const timeout = Number(process.env.LEGACY_CHECK_TIMEOUT_MS || 10000);
const writeScreenshots = process.env.LEGACY_SKIP_SCREENSHOTS !== '1';
const requiredAssets = [
  'vendor/bootstrap3/css/bootstrap.min.css', 'vendor/bootstrap3/js/bootstrap.min.js', 'vendor/bootstrap3/fonts/glyphicons-halflings-regular.woff2', 'vendor/bootstrap3/LICENSE',
  'vendor/fontawesome/css/all.min.css', 'vendor/fontawesome/css/v4-shims.min.css', 'vendor/fontawesome/webfonts/fa-solid-900.woff2', 'vendor/fontawesome/LICENSE.txt',
  'vendor/lightbox2/css/lightbox.min.css', 'vendor/lightbox2/js/lightbox.min.js', 'vendor/lightbox2/images/close.png', 'vendor/lightbox2/LICENSE'
];
const retired = /ajax\.googleapis\.com\/ajax\/libs\/jquery\/1\.12|code\.jquery\.com\/jquery-1\.12|src=["'](?:\/)?js\/bootstrap\.min\.js|use\.fontawesome\.com|kit\.fontawesome\.com|jquery-easing|bootsnav|cdnjs\.cloudflare\.com\/ajax\/libs\/lightbox2/;
const vulnerableBootstrapFeatures = /data-toggle=["'](?:tooltip|popover)["']|data-(?:content|template|loading-text)=|\.(?:tooltip|popover)\(|\.button\(\s*["']loading/;
for (const asset of requiredAssets) if (!fs.existsSync(path.join(output, asset))) throw new Error(`Missing legacy vendor asset: /${asset}`);
for (const pageName of pages) {
  const html = fs.readFileSync(path.join(output, `${pageName}.html`), 'utf8');
  if (retired.test(html)) throw new Error(`${pageName}.html still references a retired legacy dependency.`);
  if (vulnerableBootstrapFeatures.test(html)) throw new Error(`${pageName}.html uses a Bootstrap 3 API covered by an unpatched XSS advisory.`);
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
  const contentTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const contentType = contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, { 'content-type': contentType }).end(pathname === blockedAsset ? '' : fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
for (const pdf of ['1c_abroad.pdf', '2c_abroad.pdf', '4c_abroad.pdf']) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/pdfjs/${pdf}`);
  if (!response.ok || response.headers.get('content-type') !== 'application/pdf' || (await response.arrayBuffer()).byteLength === 0) throw new Error(`PDF contract failed: ${pdf}`);
}
const browser = await chromium.launch();
const screenshots = path.join(root, '.deploy', 'pr3b-legacy');
fs.mkdirSync(screenshots, { recursive: true });
const candidateMetrics = {};
try {
  for (const pageName of pages) for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(timeout);
    const errors = [];
    const localAssetFailures = [];
    await page.route('**/*', (route) => {
      const hostname = new URL(route.request().url()).hostname;
      if (!['127.0.0.1', 'localhost'].includes(hostname)) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    page.on('requestfailed', (request) => {
      if (new URL(request.url()).hostname === '127.0.0.1' && !request.url().endsWith('.pdf')) localAssetFailures.push(`${request.url()} (${request.failure()?.errorText || 'unknown'})`);
    });
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(`http://127.0.0.1:${server.address().port}/${pageName}.html`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`${pageName}.html did not return 2xx at ${width}px.`);
    await page.waitForFunction(() => window.jQuery?.fn?.jquery === '3.7.1' && Boolean(window.jQuery?.fn?.collapse));
    if (pageName === 'recruit') {
      const originalUrl = page.url();
      const employee = page.getByRole('tab', { name: '社員採用', exact: true });
      const partTime = page.getByRole('tab', { name: 'パート・アルバイト採用', exact: true });
      const panels = page.getByRole('tabpanel', { includeHidden: true });
      await expect(page).toHaveTitle('採用情報｜社員・パート・アルバイト｜アブロードアウトソーシング');
      await expect(page.locator('h1')).toHaveText('採用情報');
      await expect(employee).toHaveAttribute('aria-selected', 'true');
      await expect(employee).toHaveAttribute('tabindex', '0');
      await expect(partTime).toHaveAttribute('tabindex', '-1');
      await expect(panels).toHaveCount(2);
      await expect(panels.nth(0)).toBeVisible();
      await expect(panels.nth(1)).toBeHidden();
      for (const [index, tab] of [employee, partTime].entries()) {
        await expect(tab).toHaveAttribute('aria-controls', await panels.nth(index).getAttribute('id'));
        await expect(panels.nth(index)).toHaveAttribute('aria-labelledby', await tab.getAttribute('id'));
      }
      const tabBoxes = await Promise.all([employee.boundingBox(), partTime.boundingBox()]);
      if (Math.abs(tabBoxes[0].y - tabBoxes[1].y) > 1) throw new Error(`Recruit tabs must share a row at ${width}px.`);

      await partTime.click();
      await expect(partTime).toHaveAttribute('aria-selected', 'true');
      await expect(employee).toHaveAttribute('tabindex', '-1');
      await expect(panels.nth(0)).toBeHidden();
      await expect(panels.nth(1)).toBeVisible();
      await expect(page).toHaveURL(originalUrl);
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`Recruit part-time panel overflows at ${width}px.`);
      for (const [key, selected] of [['ArrowRight', employee], ['ArrowLeft', partTime], ['Home', employee], ['End', partTime]]) {
        await page.keyboard.press(key);
        await expect(selected).toBeFocused();
        await expect(selected).toHaveAttribute('aria-selected', 'true');
        await expect(selected).toHaveAttribute('tabindex', '0');
        await expect(page).toHaveURL(originalUrl);
      }
      await page.keyboard.press('Tab');
      await expect(partTime).not.toBeFocused();
      await expect(employee).not.toBeFocused();
      await employee.focus();
      await page.keyboard.press('Enter');
      await expect(employee).toHaveAttribute('aria-selected', 'true');
      await partTime.focus();
      await page.keyboard.press('Space');
      await expect(partTime).toHaveAttribute('aria-selected', 'true');
      await expect(page).toHaveURL(originalUrl);

      const engageUrl = 'https://en-gage.net/abroad-o_jobs/';
      await page.route(engageUrl, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Recruitment destination</title>' }));
      for (const tab of [employee, partTime]) {
        await tab.click();
        const link = page.getByRole('link', { name: '現在の募集職種を見る（engage）', exact: true });
        await expect(link).toHaveAttribute('href', engageUrl);
        const target = await link.getAttribute('target');
        if (target && target !== '_self') throw new Error('Recruit CTA must navigate in the same tab.');
        await link.click();
        await expect(page).toHaveURL(engageUrl);
        await page.goto(originalUrl, { waitUntil: 'domcontentloaded' });
      }
      await page.goto(`${originalUrl}?source=check#existing-fragment`, { waitUntil: 'domcontentloaded' });
      const decoratedUrl = page.url();
      await partTime.click();
      await expect(page).toHaveURL(decoratedUrl);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(employee).toHaveAttribute('aria-selected', 'true');
      await expect(panels.nth(1)).toBeHidden();
      await expect(page).toHaveURL(decoratedUrl);

      const fallback = await browser.newPage({ viewport: { width, height: 900 }, javaScriptEnabled: false });
      await fallback.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
      try {
        await fallback.goto(originalUrl, { waitUntil: 'domcontentloaded' });
        await expect(fallback.getByText('お客様とチームをつなぎ、仕事の進め方をよりよくする。', { exact: true })).toBeVisible();
        await expect(fallback.getByText('一つひとつの丁寧な作業が、お客様の仕事を支える。', { exact: true })).toBeVisible();
        await expect(fallback.getByRole('link', { name: '現在の募集職種を見る（engage）', exact: true })).toHaveCount(2);
        if (await fallback.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`Recruit fallback overflows at ${width}px.`);
      } finally {
        await fallback.close();
      }
      await page.goto(originalUrl, { waitUntil: 'domcontentloaded' });
      console.log(`Recruit tabs, keyboard, same-tab CTA, stable URL, reload and no-JS fallback passed at ${width}px.`);
    }
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: document.querySelector('header')?.getBoundingClientRect().height || 0,
      body: document.body.getBoundingClientRect().height,
      containers: [...document.querySelectorAll('.container')].map((node) => node.getBoundingClientRect().width).filter(Boolean),
      jquery: window.jQuery?.fn?.jquery,
      bootstrap: window.jQuery?.fn?.bootstrapVersion || Boolean(window.jQuery?.fn?.collapse),
      icons: (() => {
        const glyph = document.createElement('span'); glyph.className = 'glyphicon glyphicon-arrow-right';
        const icon = document.createElement('i'); icon.className = 'fa fa-phone-square';
        document.body.append(glyph, icon);
        const glyphBefore = getComputedStyle(glyph, '::before');
        const iconBefore = getComputedStyle(icon, '::before');
        const result = { glyph: { content: glyphBefore.content, font: glyphBefore.fontFamily }, fontAwesome: { content: iconBefore.content, font: iconBefore.fontFamily, code: iconBefore.getPropertyValue('--fa') } };
        glyph.remove(); icon.remove();
        return result;
      })()
    }));
    const reference = baseline[pageName][width];
    if (geometry.jquery !== '3.7.1' || !geometry.bootstrap) throw new Error(`${pageName}.html failed to initialize the local legacy core.`);
    if (writeScreenshots && ['about', 'aggregate', 'input'].includes(pageName)) await page.screenshot({ path: path.join(screenshots, `${pageName}-${width}.png`), fullPage: true });
    if (geometry.overflow > reference.overflow + 1) {
      const offenders = await page.evaluate(() => [...document.querySelectorAll('body *')].map((node) => {
        const rect = node.getBoundingClientRect();
        return { selector: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${[...node.classList].slice(0, 2).map((name) => `.${name}`).join('')}`, left: rect.left, right: rect.right, width: rect.width };
      }).filter((item) => item.left < -1 || item.right > document.documentElement.clientWidth + 1).sort((a, b) => b.right - a.right).slice(0, 8));
      throw new Error(`${pageName}.html overflow worsened at ${width}px: ${geometry.overflow}px. Offenders: ${JSON.stringify(offenders)}`);
    }
    const largestContainer = Math.max(...geometry.containers);
    const baselineLargestContainer = Math.max(...reference.containerWidths);
    if (!geometry.body || Math.abs(geometry.header - reference.headerHeight) / reference.headerHeight > 0.03 || Math.abs(geometry.body - reference.bodyHeight) / reference.bodyHeight > 0.03 || Math.abs(largestContainer - baselineLargestContainer) / baselineLargestContainer > 0.03) throw new Error(`${pageName}.html geometry changed beyond the 3% baseline tolerance at ${width}px (header ${reference.headerHeight}->${geometry.header}, body ${reference.bodyHeight}->${geometry.body}, container ${baselineLargestContainer}->${largestContainer}).`);
    if (!geometry.icons.glyph.font.includes('Glyphicons') || geometry.icons.glyph.content === 'none' || !geometry.icons.fontAwesome.font.includes('Font Awesome') || !geometry.icons.fontAwesome.code) throw new Error(`${pageName}.html did not render local Glyphicons and Font Awesome: ${JSON.stringify(geometry.icons)}.`);
    if (localAssetFailures.length) throw new Error(`${pageName}.html failed to load local assets:\n${localAssetFailures.join('\n')}`);
    candidateMetrics[pageName] ||= {};
    candidateMetrics[pageName][width] = { ...geometry, largestContainer };
    if (width === 375) {
      const toggle = page.locator('.navbar-toggle');
      await toggle.click();
      await page.waitForFunction(() => document.querySelector('.navbar-main-collapse')?.classList.contains('in'));
      await toggle.click();
      await page.waitForFunction(() => !document.querySelector('.navbar-main-collapse')?.classList.contains('in'));
    }
    if (pageName === 'about' || pageName === 'film') {
      const tabs = page.locator('[data-toggle="tab"]');
      if (await tabs.count() > 1) {
        const pane = await tabs.nth(1).getAttribute('href');
        if (disabledBehavior === 'tab') await tabs.nth(1).evaluate((node) => node.removeAttribute('data-toggle'));
        await tabs.nth(1).click();
        await page.waitForFunction((selector) => document.querySelector(selector)?.classList.contains('active'), pane);
      }
    }
    if (pageName === 'input') {
      const next = page.locator('.carousel-control.right');
      if (await next.count()) {
        const before = await page.locator('.carousel-inner .item.active').evaluate((node) => [...node.parentElement.children].indexOf(node));
        if (disabledBehavior === 'carousel') await next.evaluate((node) => node.removeAttribute('data-slide'));
        await next.click();
        await page.waitForFunction((current) => { const node = document.querySelector('.carousel-inner .item.active'); return node && [...node.parentElement.children].indexOf(node) !== current; }, before);
      }
    }
    if (['aggregate', 'edit'].includes(pageName)) {
      const trigger = page.locator('[data-lightbox]').first();
      if (disabledBehavior === 'lightbox') await trigger.evaluate((node) => node.removeAttribute('data-lightbox'));
      await trigger.click();
      await page.waitForFunction(() => document.querySelector('#lightbox')?.style.display !== 'none');
      await page.waitForFunction(() => {
        const image = document.querySelector('.lb-image');
        return image?.complete && image.naturalWidth > 0;
      });
      await page.locator('.lb-close').click();
      await page.waitForFunction(() => document.querySelector('#lightbox')?.style.display === 'none');
    }
    if (errors.length) throw new Error(`${pageName}.html browser console errors at ${width}px:\n${errors.join('\n')}`);
    await page.close();
    console.log(`${pageName}.html ${width}px passed.`);
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
fs.writeFileSync(path.join(screenshots, 'metrics.json'), `${JSON.stringify(candidateMetrics, null, 2)}\n`);
