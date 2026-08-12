import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { cspReportOnly } from './lib/csp-report-only-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
function walk(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]); }
const pages = walk(output).filter((file) => file.endsWith('.html'));
assert.equal(pages.length, 48);
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404, { 'Content-Security-Policy-Report-Only': cspReportOnly }).end();
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
  response.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Security-Policy-Report-Only': cspReportOnly }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  for (const file of pages) {
    const page = await browser.newPage(); const violations = [];
    await page.addInitScript(() => addEventListener('securitypolicyviolation', (event) => window.__cspViolations.push({ directive: event.violatedDirective, blocked: event.blockedURI })));
    await page.addInitScript(() => { window.__cspViolations = []; });
    await page.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.fulfill({ status: 200, contentType: host === 'www.google.com' ? 'text/html' : 'text/javascript', body: '' });
    });
    const response = await page.goto(`${base}/${path.relative(output, file).replaceAll('\\', '/')}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${file} did not load`);
    violations.push(...await page.evaluate(() => window.__cspViolations));
    assert.deepEqual(violations, [], `${file} has unexpected CSP Report-Only violations`);
    await page.close();
  }
  const page = await browser.newPage();
  await page.addInitScript(() => { window.__cspViolations = []; addEventListener('securitypolicyviolation', (event) => window.__cspViolations.push(event.violatedDirective)); });
  await page.goto(`${base}/about.html`); await page.evaluate(() => { document.body.style.color = 'red'; });
  assert.deepEqual(await page.evaluate(() => window.__cspViolations), []);
  await page.evaluate(() => document.body.setAttribute('style', 'color: blue'));
  await page.waitForFunction(() => window.__cspViolations.includes('style-src-attr'));
  await page.close();
  console.log('CSP Report-Only browser contract passed: 48 HTML pages and style-src-attr behavior.');
} finally { await browser.close(); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
