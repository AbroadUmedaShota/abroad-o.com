import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { assertFontObservation } from './lib/local-font-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const widths = [375, 768, 1440];
const fontCss = '/css/fonts.css';
const crimson = '/fonts/google/crimson-text-latin-400-normal.woff2';
const roboto = [
  '/fonts/google/roboto-latin-400-normal.woff2',
  '/fonts/google/roboto-latin-500-normal.woff2',
  '/fonts/google/roboto-latin-700-normal.woff2'
];
const targets = [
  { file: 'index.html', overflow: { 375: 25, 768: 25, 1440: 25 }, faces: [{ family: 'Crimson Text', weight: 400 }], expectedPaths: [fontCss, crimson], visible: [{ selector: '.bottom_img p', text: 'BPO', family: 'Crimson Text', weight: 400 }] },
  { file: 'scan.html', overflow: { 375: 9, 768: 0, 1440: 0 }, faces: [], expectedPaths: [fontCss], visible: [] },
  { file: 'news/news_260526.html', overflow: { 375: 1, 768: 1, 1440: 1 }, faces: [{ family: 'Roboto', weight: 400 }, { family: 'Roboto', weight: 500 }, { family: 'Roboto', weight: 700 }], expectedPaths: [fontCss, ...roboto], visible: [
    { selector: '.final-message', text: 'SPEED AD', family: 'Roboto', weight: 400 },
    { selector: '.hero-section .date', text: '2026', family: 'Roboto', weight: 500 },
    { selector: '.hero-section h1', text: 'SPEED AD', family: 'Roboto', weight: 700 }
  ] }
];
const localPaths = new Set([fontCss, crimson, ...roboto]);
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
  for (const target of targets) for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const externalFonts = [], responses = [];
    page.on('request', (request) => { if (/fonts\.(?:googleapis|gstatic)\.com/i.test(request.url())) externalFonts.push(request.url()); });
    page.on('response', (response) => {
      const pathname = new URL(response.url()).pathname;
      if (localPaths.has(pathname)) {
        if (response.status() !== 200) throw new Error(`${target.file} received ${response.status()} for ${pathname}.`);
        responses.push(pathname);
      }
    });
    const response = await page.goto(`${base}/${target.file}`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`${target.file} did not return HTTP 200 at ${width}px.`);
    const loadedFaces = await page.evaluate(async (faces) => {
      const result = [];
      for (const face of faces) {
        const loaded = await document.fonts.load(`${face.weight} 16px '${face.family}'`, 'SPEED AD BPO 2026');
        if (!loaded.length) throw new Error(`document.fonts.load returned no faces for ${face.family} ${face.weight}.`);
        result.push(...loaded.map((loadedFace) => ({ family: loadedFace.family, weight: loadedFace.weight, status: loadedFace.status })));
      }
      await document.fonts.ready;
      return result;
    }, target.faces);
    const visible = await page.evaluate((checks) => checks.map((check) => {
      const node = document.querySelector(check.selector);
      if (!node || !node.textContent.includes(check.text)) throw new Error(`Missing visible font sample ${check.selector}: ${check.text}.`);
      const style = getComputedStyle(node);
      return { family: style.fontFamily, weight: style.fontWeight, expectedFamily: check.family, expectedWeight: check.weight };
    }), target.visible);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > target.overflow[width]) throw new Error(`${target.file} overflow worsened at ${width}px: ${overflow}px.`);
    assertFontObservation({ expectedPaths: target.expectedPaths, responses, externalFonts, expectedFaces: target.faces, faces: loadedFaces, visible });
    await page.close();
    console.log(`${target.file} ${width}px local font UI passed.`);
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
