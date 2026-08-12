import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
const pages = ['/', '/scan.html', '/film.html', '/largeformat.html', '/microfilm.html', '/telework.html', '/form.html', '/speed-ad.html', '/news/news_260526.html', '/sample2.html'];

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
const context = await browser.newContext();
try {
  const critical = [];
  for (const pagePath of pages) {
    const page = await context.newPage();
    await page.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.fulfill({ status: 204, body: '' }));
    const response = await page.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) {
      throw new Error(`Accessibility target did not return 2xx: ${pagePath} (${response?.status() ?? 'no response'})`);
    }
    if (pagePath === '/sample2.html') {
      const frames = page.locator('iframe');
      if (await frames.count() !== 3) throw new Error('sample2.html must embed exactly three PDF iframes.');
      for (let index = 0; index < 3; index += 1) {
        const frame = frames.nth(index);
        const source = await frame.getAttribute('src');
        if (!source?.startsWith('/pdfjs/') || !(await frame.getAttribute('title'))) {
          throw new Error(`sample2.html PDF iframe ${index + 1} is missing its source or title.`);
        }
        const pdfResponse = await page.request.get(`http://127.0.0.1:${port}${source}`);
        if (!pdfResponse.ok()) throw new Error(`sample2.html PDF iframe ${index + 1} did not return 2xx.`);
      }
      fs.mkdirSync(path.join(repoRoot, '.deploy'), { recursive: true });
      await page.screenshot({ path: path.join(repoRoot, '.deploy', 'sample2-pdf-iframe.png'), fullPage: true });
      console.log('sample2 PDF iframe responses and screenshot passed.');
    }
    const results = await new AxeBuilder({ page }).analyze();
    console.log(`Axe details ${pagePath}: ${results.violations.map((violation) => `${violation.id}/${violation.impact}: ${violation.nodes.map((node) => node.html).join(' | ')}`).join(', ') || 'none'}`);
    for (const violation of results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact))) {
      critical.push(`${pagePath}: ${violation.id} (${violation.nodes.length} nodes)`);
    }
    console.log(`Axe ${pagePath}: ${results.violations.length} total violations, ${results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact)).length} serious/critical.`);
    await page.close();
  }
  if (critical.length) throw new Error(`Serious or critical accessibility violations:\n${critical.join('\n')}`);
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
