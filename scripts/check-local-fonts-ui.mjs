import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { fontFiles } from './lib/local-font-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const targets = [
  ['index.html', '.top_wrap h1', 'Crimson Text', { 375: 25, 768: 25, 1440: 25 }],
  ['scan.html', null, 'Crimson Text', { 375: 9, 768: 0, 1440: 0 }],
  ['news/news_260526.html', 'body', 'Roboto', { 375: 1, 768: 1, 1440: 1 }]
];
const widths = [375, 768, 1440];
const fontPaths = new Set(fontFiles.map(([, , file]) => `/fonts/google/${file}`));
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.resolve(output, relative);
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  const type = path.extname(file) === '.woff2' ? 'font/woff2' : path.extname(file) === '.css' ? 'text/css' : path.extname(file) === '.js' ? 'text/javascript' : 'text/html';
  response.writeHead(200, { 'content-type': type }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  for (const [file, selector, family, overflow] of targets) for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const externalFonts = [], fontResponses = [];
    page.on('request', (request) => { if (/fonts\.(?:googleapis|gstatic)\.com/i.test(request.url())) externalFonts.push(request.url()); });
    page.on('response', (response) => { if (fontPaths.has(new URL(response.url()).pathname)) fontResponses.push([new URL(response.url()).pathname, response.status()]); });
    const response = await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`${file} did not return HTTP 200 at ${width}px.`);
    await page.waitForFunction(async ({ targetFamily, roboto }) => {
      await document.fonts.load(`400 16px '${targetFamily}'`, 'Latin');
      if (roboto) {
        await document.fonts.load("500 16px 'Roboto'", 'SPEED AD');
        await document.fonts.load("700 16px 'Roboto'", 'SPEED AD');
      }
      await document.fonts.ready;
      return document.fonts.check(`400 16px '${targetFamily}'`, 'Latin') && (!roboto || document.fonts.check("700 16px 'Roboto'", 'SPEED AD'));
    }, { targetFamily: family, roboto: family === 'Roboto' });
    const metrics = await page.evaluate((target) => {
      const probe = document.createElement('span');
      probe.style.fontFamily = `'${target.family}', serif`;
      probe.textContent = 'Latin';
      probe.hidden = true;
      document.body.append(probe);
      const node = target.selector ? document.querySelector(target.selector) : probe;
      const family = getComputedStyle(node).fontFamily;
      probe.remove();
      return { family, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, { selector, family });
    if (!metrics.family.includes(family)) throw new Error(`${file} did not compute ${family} at ${width}px: ${metrics.family}`);
    if (metrics.overflow > overflow[width]) throw new Error(`${file} overflow worsened at ${width}px: ${metrics.overflow}px.`);
    if (externalFonts.length || fontResponses.some(([, status]) => status !== 200) || !fontResponses.length) throw new Error(`${file} font network contract failed at ${width}px: ${JSON.stringify({ externalFonts, fontResponses })}`);
    if (family !== 'Roboto' && fontResponses.some(([font]) => font.includes('/roboto-'))) throw new Error(`${file} unexpectedly loaded Roboto at ${width}px.`);
    await page.close();
    console.log(`${file} ${width}px local font UI passed.`);
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
