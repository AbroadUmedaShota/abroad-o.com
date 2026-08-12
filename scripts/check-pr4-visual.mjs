import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const baseRoot = process.env.PR4_BASE_DIR;
const fixturePath = path.join(root, 'scripts/fixtures/pr4-visual-baseline.json');
const evidenceRoot = path.join(root, '.deploy', 'pr4-visual');
const widths = [320, 342, 375, 759, 768, 991, 1440];
const targets = [
  ['about.html', '#tabref-ContentC .image-back > h4', '#tabref-ContentC .image-back > h2', [375, 759, 768, 1440]], ['film.html', '#film_top .col-md-5 h4', '#film_top .col-md-5 h2', [375, 768, 991, 1440]],
  ['sample.html', '#tape > .margin_le:first-of-type > h5:first-of-type', '#tape > .margin_le:first-of-type > h3.sample-subsection:first-of-type', [375, 1440]], ['service-pack.html', '#service-pack1 > .container > h4', '#service-pack1 > .container > h2', [375, 991, 1440]],
  ['scan.html', '#scan-first .row:first-of-type > div:first-child .col-box h5', '#scan-first .row:first-of-type > div:first-child .col-box h3', [320, 342, 375, 768, 1440]], ['scan.html', '#scan-second .row:first-of-type > div:first-child .col-box2 h5', '#scan-second .row:first-of-type > div:first-child .col-box2 h3', [320, 342, 375, 768, 1440]], ['scan.html', '#feature_section .row > div:first-child h4', '#feature_section .row > div:first-child h4', [375, 1440]],
  ['telework.html', '#tele_mid3 .container > .row.box:first-of-type h5', '#tele_mid3 .container > .row.box:first-of-type h4', [375, 768, 1440]], ['input.html', '#text-how > h3', '#text-how > h2', [375, 768, 1440]]
];
const properties = ['fontSize', 'fontWeight', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'color', 'backgroundColor', 'display'];
const aboutGeometryWidths = [375, 1440];
const timeout = 15000;
const start = (directory) => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(directory, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(path.resolve(directory)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': path.extname(file) === '.css' ? 'text/css' : path.extname(file) === '.js' ? 'text/javascript' : path.extname(file) === '.html' ? 'text/html' : 'application/octet-stream' }).end(fs.readFileSync(file));
  }).listen(0, '127.0.0.1', () => resolve(server));
});
const collect = async (base, browser, candidate) => {
  const jobs = targets.flatMap(([pageName, baseSelector, candidateSelector, targetWidths]) => targetWidths.map((width) => [pageName, baseSelector, candidateSelector, width]));
  const measure = async ([pageName, baseSelector, candidateSelector, width]) => {
    const selector = candidate ? candidateSelector : baseSelector;
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(timeout);
    try {
      await page.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
      console.log(`PR4 visual ${candidate ? 'candidate' : 'base'} ${pageName} ${width}`);
      await page.goto(`${base}/${pageName}`, { waitUntil: 'domcontentloaded', timeout });
      assert.equal(await page.locator(selector).count(), 1, `${pageName} ${selector} must identify exactly one representative element`);
      return [`${pageName}|${candidateSelector}|${width}`, await page.locator(selector).evaluate((node, names) => {
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return { style: Object.fromEntries(names.map((name) => [name, style[name]])), geometry: { width: rect.width, height: rect.height } };
      }, properties)];
    } finally { await page.close(); }
  };
  const measurements = [];
  for (let index = 0; index < jobs.length; index += 4) measurements.push(...await Promise.all(jobs.slice(index, index + 4).map(measure)));
  return Object.fromEntries(measurements);
};
const screenshots = async (base, browser, label) => {
  for (const pageName of ['about.html', 'film.html', 'sample.html', 'service-pack.html', 'scan.html']) for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
      page.setDefaultTimeout(timeout);
      await page.goto(`${base}/${pageName}`, { waitUntil: 'networkidle', timeout });
      await page.evaluate(() => document.fonts?.ready);
      if (pageName === 'scan.html') {
        await page.waitForFunction(() => Boolean(window.bootstrap?.Carousel));
        await page.evaluate(() => {
          const node = document.querySelector('#carouselExampleIndicators');
          const carousel = window.bootstrap.Carousel.getOrCreateInstance(node);
          carousel.pause();
          carousel.to(0);
        });
        await page.waitForFunction(() => {
          const carousel = document.querySelector('#carouselExampleIndicators');
          return carousel?.querySelector('.carousel-item.active') === carousel?.querySelector('.carousel-item:first-of-type') && !carousel?.querySelector('.carousel-item-start, .carousel-item-end');
        });
      }
      const destination = path.join(evidenceRoot, label); fs.mkdirSync(destination, { recursive: true });
      await page.screenshot({ path: path.join(destination, `${pageName.replace('.html', '')}-${width}.png`), animations: 'disabled', timeout });
    } finally { await page.close(); }
  }
};
const collectAboutGeometry = async (base, browser) => {
  const result = {};
  for (const width of aboutGeometryWidths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(timeout);
    try {
      await page.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
      await page.goto(`${base}/about.html`, { waitUntil: 'domcontentloaded', timeout });
      result[width] = await page.evaluate(() => {
        const containers = [...document.querySelectorAll('.container')].map((node) => node.getBoundingClientRect().width);
        return {
          headerHeight: document.querySelector('header')?.getBoundingClientRect().height ?? 0,
          bodyHeight: document.body.getBoundingClientRect().height,
          largestContainerWidth: Math.max(0, ...containers),
          overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
        };
      });
    } finally { await page.close(); }
  }
  return result;
};
const assertAboutGeometry = (baseline, expected, candidate) => {
  for (const width of aboutGeometryWidths) {
    const base = baseline[width]; const contract = expected[width]; const actual = candidate[width];
    const headerDelta = actual.headerHeight - base.headerHeight;
    const bodyRatio = Math.abs(actual.bodyHeight - base.bodyHeight) / Math.max(1, base.bodyHeight);
    const containerDelta = Math.abs(actual.largestContainerWidth - base.largestContainerWidth);
    const overflowDelta = actual.overflow - base.overflow;
    console.log(`PR4 about geometry ${width}: header ${base.headerHeight}->${actual.headerHeight} (${headerDelta >= 0 ? '+' : ''}${headerDelta}), body ${base.bodyHeight}->${actual.bodyHeight} (${(bodyRatio * 100).toFixed(2)}%), container ${base.largestContainerWidth}->${actual.largestContainerWidth}, overflow ${base.overflow}->${actual.overflow}`);
    assert.ok(Math.abs(actual.headerHeight - contract.headerHeight) <= contract.headerHeightTolerance, `about.html ${width}px header height must remain within its tracked candidate contract`);
    assert.ok(bodyRatio <= contract.bodyHeightRelativeTolerance, `about.html ${width}px body height must remain within ${(contract.bodyHeightRelativeTolerance * 100).toFixed(0)}% of base`);
    assert.ok(containerDelta <= contract.largestContainerWidthTolerance, `about.html ${width}px largest .container width must remain within ${contract.largestContainerWidthTolerance}px of base`);
    assert.ok(overflowDelta <= contract.overflowDeltaTolerance, `about.html ${width}px candidate overflow must not worsen from base`);
  }
};
let baseServer;
const candidateServer = await start(path.join(root, '_site'));
const browser = await chromium.launch();
try {
  if (process.argv.includes('--capture-evidence')) {
    assert.ok(baseRoot, 'PR4_BASE_DIR is required to capture visual evidence');
    baseServer = await start(path.join(baseRoot, '_site'));
    await screenshots(`http://127.0.0.1:${baseServer.address().port}`, browser, 'base');
    await screenshots(`http://127.0.0.1:${candidateServer.address().port}`, browser, 'candidate');
    console.log('PR4 visual evidence captured: base 10, candidate 10.');
    process.exitCode = 0;
  } else {
  if (process.argv.includes('--write-fixture')) {
    assert.ok(baseRoot, 'PR4_BASE_DIR is required to write the visual baseline');
    baseServer = await start(path.join(baseRoot, '_site'));
    const baseline = await collect(`http://127.0.0.1:${baseServer.address().port}`, browser, false);
    const aboutBaseline = await collectAboutGeometry(`http://127.0.0.1:${baseServer.address().port}`, browser);
    const aboutCandidate = await collectAboutGeometry(`http://127.0.0.1:${candidateServer.address().port}`, browser);
    const aboutGeometry = Object.fromEntries(aboutGeometryWidths.map((width) => [width, {
      baseline: aboutBaseline[width],
      candidate: {
        headerHeight: aboutCandidate[width].headerHeight,
        headerHeightTolerance: 1,
        bodyHeightRelativeTolerance: 0.03,
        largestContainerWidthTolerance: 1,
        overflowDeltaTolerance: 0
      }
    }]));
    fs.writeFileSync(fixturePath, `${JSON.stringify({ schemaVersion: 1, widths, targets, properties, baseline, aboutGeometry }, null, 2)}\n`);
    await new Promise((resolve) => baseServer.close(resolve)); baseServer = undefined;
  }
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(fixture.schemaVersion, 1, 'PR4 visual baseline schema must be current');
  assert.deepEqual(fixture.widths, widths, 'PR4 visual baseline widths must be current');
  assert.deepEqual(fixture.targets, targets, 'PR4 visual baseline targets must be current');
  assert.deepEqual(fixture.properties, properties, 'PR4 visual baseline properties must be current');
  const candidate = await collect(`http://127.0.0.1:${candidateServer.address().port}`, browser, true);
  for (const [key, expected] of Object.entries(fixture.baseline)) for (const [property, value] of Object.entries(expected.style)) {
    const actual = candidate[key].style[property];
    assert.equal(actual, value, `${key} ${property}: expected ${value}, got ${actual}`);
  }
  assert.deepEqual(Object.keys(fixture.aboutGeometry || {}).map(Number), aboutGeometryWidths, 'PR4 about geometry baseline widths must be current');
  const aboutBaseline = Object.fromEntries(aboutGeometryWidths.map((width) => [width, fixture.aboutGeometry[width].baseline]));
  const aboutExpected = Object.fromEntries(aboutGeometryWidths.map((width) => [width, fixture.aboutGeometry[width].candidate]));
  const aboutCandidate = await collectAboutGeometry(`http://127.0.0.1:${candidateServer.address().port}`, browser);
  assertAboutGeometry(aboutBaseline, aboutExpected, aboutCandidate);
  if (process.argv.includes('--write-fixture')) {
    const visualBase = await start(path.join(baseRoot, '_site'));
    try { await screenshots(`http://127.0.0.1:${visualBase.address().port}`, browser, 'base'); }
    finally { visualBase.closeAllConnections?.(); await new Promise((resolve) => visualBase.close(resolve)); }
    await screenshots(`http://127.0.0.1:${candidateServer.address().port}`, browser, 'candidate');
  }
  console.log(`PR4 visual baseline passed: ${Object.keys(fixture.baseline).length} viewport measurements.`);
  }
} finally {
  await browser.close();
  for (const server of [baseServer, candidateServer]) if (server) { server.closeAllConnections?.(); server.closeIdleConnections?.(); await new Promise((resolve) => server.close(resolve)); }
}
