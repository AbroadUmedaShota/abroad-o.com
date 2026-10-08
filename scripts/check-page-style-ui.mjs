import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

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
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };
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
  for (const width of [320, 375, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
    const panel = page.locator('.certification-panel');
    const iso = page.locator('.certification-marks__iso');
    await iso.scrollIntoViewIfNeeded();
    await page.locator('.certification-marks__privacy img').evaluate((image) => image.decode());
    await iso.evaluate((image) => image.decode());
    const layout = await page.evaluate(() => {
      const section = document.querySelector('#pre_footer');
      const outer = document.querySelector('.certification-layout');
      const panel = document.querySelector('.certification-panel');
      const marks = document.querySelector('.certification-marks');
      const privacy = document.querySelector('.certification-marks__privacy img');
      const isoImage = document.querySelector('.certification-marks__iso');
      const copy = document.querySelector('.certification-copy');
      const list = document.querySelector('.certification-list');
      const link = list.querySelector('a');
      const rect = (node) => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; };
      return {
        sectionBackground: getComputedStyle(section).backgroundColor,
        panelBackground: getComputedStyle(panel).backgroundColor,
        panelBorder: getComputedStyle(panel).borderTopColor,
        panelRadius: getComputedStyle(panel).borderTopLeftRadius,
        panelPadding: getComputedStyle(panel).paddingLeft,
        panelSizing: getComputedStyle(panel).boxSizing,
        isolation: getComputedStyle(marks).isolation,
        blend: getComputedStyle(isoImage).mixBlendMode,
        direction: getComputedStyle(marks).flexDirection,
        gridColumns: getComputedStyle(outer).gridTemplateColumns.split(' ').length,
        fontSize: getComputedStyle(copy).fontSize,
        lineHeight: getComputedStyle(copy).lineHeight,
        textColor: getComputedStyle(copy).color,
        linkColor: getComputedStyle(link).color,
        listGap: getComputedStyle(list).rowGap,
        section: rect(section), panel: rect(panel), privacy: rect(privacy), iso: rect(isoImage), copy: rect(copy),
        overflow: document.documentElement.scrollWidth > innerWidth,
        imagesLoaded: privacy.complete && privacy.naturalWidth === 200 && isoImage.complete && isoImage.naturalWidth === 354,
        isoCrop: getComputedStyle(isoImage).objectFit === 'cover' && getComputedStyle(isoImage).objectPosition === '100% 50%',
        certifications: [...list.querySelectorAll('li')].map((item) => ({
          name: item.querySelector('a').textContent,
          url: item.querySelector('a').getAttribute('href'),
          detail: item.querySelector('span').textContent
        }))
      };
    });
    const { data, info } = await sharp(await panel.screenshot()).raw().toBuffer({ resolveWithObject: true });
    const panelPixel = [...data.subarray((10 * info.width + 10) * info.channels, (10 * info.width + 10) * info.channels + 3)];
    const relativeLuminance = (rgb) => rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const linkRgb = layout.linkColor.match(/\d+/g).slice(0, 3).map(Number);
    const contrast = (1.05) / (relativeLuminance(linkRgb) + 0.05);
    const grayContrast = (relativeLuminance([238, 238, 238]) + 0.05) / (relativeLuminance(linkRgb) + 0.05);
    const expectedCertifications = [
      { name: 'プライバシーマーク', url: 'https://privacymark.jp/', detail: '10862401(07)' },
      { name: 'ISMS（情報セキュリティマネジメントシステム）', url: 'https://www.eqajapan.com/html/iso/27001.htm#27001_1', detail: 'ISO/IEC 27001:2013 / JIS Q 27001:2014' },
      { name: 'QMS（品質マネジメントシステム）', url: 'https://www.eqajapan.com/html/iso/9001.htm#9001_1', detail: 'ISO 9001:2015 & JIS Q 9001:2015' }
    ];
    const shouldStack = width < 576;
    const shouldGrid = width >= 1200;
    const near = (actual, expected) => Math.abs(actual - expected) < 1;
    if (layout.sectionBackground !== 'rgb(238, 238, 238)' || layout.panelBackground !== 'rgb(255, 255, 255)' || layout.panelBorder !== 'rgb(215, 222, 230)' || layout.panelRadius !== '6px' || layout.panelPadding !== '20px' || layout.panelSizing !== 'border-box' || layout.isolation !== 'auto' || layout.blend !== 'normal' || layout.direction !== (shouldStack ? 'column' : 'row') || layout.gridColumns !== (shouldGrid ? 2 : 1) || layout.fontSize !== '16px' || !near(parseFloat(layout.lineHeight), 27.2) || layout.textColor !== 'rgb(34, 34, 34)' || layout.listGap !== '12px' || layout.panel.width > 396 || !near(layout.privacy.width, 149) || !near(layout.privacy.height, 149) || !near(layout.iso.width, 189) || !near(layout.iso.height, 149) || (shouldGrid ? !(layout.panel.x < layout.copy.x) : !(layout.panel.y < layout.copy.y)) || layout.overflow || !layout.imagesLoaded || !layout.isoCrop || contrast < 4.5 || grayContrast < 4.5 || JSON.stringify(layout.certifications) !== JSON.stringify(expectedCertifications) || panelPixel.some((channel) => channel !== 255)) {
      throw new Error(`Homepage certification readability failed at ${width}px: ${JSON.stringify({ layout, panelPixel, contrast, grayContrast })}`);
    }
    await page.close();
    console.log(`Homepage certification readability UI passed at ${width}px; link contrast ${contrast.toFixed(2)} on white / ${grayContrast.toFixed(2)} on gray.`);
  }
  const zoomProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'abroad-cert-zoom-'));
  let zoomContext;
  try {
    const preferences = path.join(zoomProfile, 'Default', 'Preferences');
    fs.mkdirSync(path.dirname(preferences), { recursive: true });
    fs.writeFileSync(preferences, JSON.stringify({ partition: { default_zoom_level: { x: Math.log(2) / Math.log(1.2) } } }));
    zoomContext = await chromium.launchPersistentContext(zoomProfile, { channel: 'chromium', headless: true, viewport: null, args: ['--window-size=1440,900', '--no-first-run'] });
    const page = zoomContext.pages()[0] || await zoomContext.newPage();
    await page.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
    await page.locator('.certification-panel').scrollIntoViewIfNeeded();
    await page.locator('.certification-marks__privacy img').evaluate((image) => image.decode());
    await page.locator('.certification-marks__iso').evaluate((image) => image.decode());
    const zoom = await page.evaluate(() => {
      const rect = (selector) => { const box = document.querySelector(selector).getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right }; };
      return {
        innerWidth, devicePixelRatio, visualScale: visualViewport.scale,
        fontSize: getComputedStyle(document.querySelector('.certification-copy')).fontSize,
        panel: rect('.certification-panel'), privacy: rect('.certification-marks__privacy img'), iso: rect('.certification-marks__iso'), copy: rect('.certification-copy'),
        overflow: document.documentElement.scrollWidth > innerWidth,
        imagesLoaded: document.querySelector('.certification-marks__privacy img').naturalWidth === 200 && document.querySelector('.certification-marks__iso').naturalWidth === 354
      };
    });
    if (zoom.innerWidth < 700 || zoom.innerWidth > 730 || Math.abs(zoom.devicePixelRatio - 2) > 0.1 || zoom.visualScale !== 1 || zoom.fontSize !== '16px' || zoom.panel.width !== 396 || zoom.panel.right > zoom.innerWidth || zoom.privacy.width !== 149 || zoom.privacy.height !== 149 || zoom.iso.width !== 189 || zoom.iso.height !== 149 || zoom.copy.y <= zoom.panel.y || zoom.overflow || !zoom.imagesLoaded) {
      throw new Error(`Homepage native 200% browser zoom failed: ${JSON.stringify(zoom)}`);
    }
    console.log(`Homepage native 200% browser zoom passed with Chromium ${zoomContext.browser().version()}: ${JSON.stringify(zoom)}.`);
  } finally {
    if (zoomContext) await zoomContext.close();
    const tmpRoot = path.resolve(os.tmpdir()) + path.sep;
    if (path.resolve(zoomProfile).startsWith(tmpRoot) && path.basename(zoomProfile).startsWith('abroad-cert-zoom-')) fs.rmSync(zoomProfile, { recursive: true, force: true });
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
