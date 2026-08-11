import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
const pages = ['/', '/speed-ad.html', '/news/news_260526.html', '/TOOL/index.html'];

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
    await page.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page }).analyze();
    for (const violation of results.violations.filter((violation) => violation.impact === 'critical')) {
      critical.push(`${pagePath}: ${violation.id} (${violation.nodes.length} nodes)`);
    }
    console.log(`Axe ${pagePath}: ${results.violations.length} total violations, ${results.violations.filter((violation) => violation.impact === 'critical').length} critical.`);
    await page.close();
  }
  if (critical.length) throw new Error(`Critical accessibility violations:\n${critical.join('\n')}`);
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
