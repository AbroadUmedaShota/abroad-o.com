import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const workerHost = 'abroad-o-contact-form.abroad-o.workers.dev';
const turnstileHost = 'challenges.cloudflare.com';
const apiBase = `https://${workerHost}`;
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  response.writeHead(200, { 'content-type': path.extname(file) === '.js' ? 'text/javascript' : 'text/html' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const localBase = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function openForm(submitCodes) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const state = { submits: [], resets: [] };
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === workerHost && url.pathname === '/config') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ turnstileSiteKey: 'test-key' }) });
    if (url.hostname === workerHost && url.pathname === '/submit') {
      state.submits.push(request.postDataJSON());
      const code = submitCodes.shift();
      return route.fulfill({ status: code === 'delivery_review_required' ? 202 : 409, contentType: 'application/json', body: JSON.stringify({ ok: false, code }) });
    }
    if (url.hostname === turnstileHost) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.turnstile={render:(node,options)=>{window.__turnstileOptions=options;return 'widget-1'},reset:(id)=>window.__turnstileResets=(window.__turnstileResets||[]).concat(id)}` });
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  await page.goto(`${localBase}/form.html`);
  await page.waitForFunction(() => window.__turnstileOptions);
  return { context, page, state };
}

async function fillAndSubmit(page, name = '山田太郎') {
  for (const [id, value] of Object.entries({ enterprise: '株式会社テスト', name, email: 'test@example.com', phone: '03-5835-0250', inquiry_details: 'お問い合わせです。' })) await page.locator(`#${id}`).fill(value);
  await page.locator('#consent').check();
  await page.evaluate(() => window.__turnstileOptions.callback('verified-token'));
  await page.locator('form').evaluate((form) => form.requestSubmit());
}

try {
  const unknown = await openForm(['unknown_error', 'unknown_error', 'unknown_error']);
  await fillAndSubmit(unknown.page);
  await unknown.page.waitForFunction(() => document.querySelector('#form-feedback').textContent.includes('送信結果を確認できませんでした'));
  await unknown.page.evaluate(() => window.__turnstileOptions.callback('verified-token-2'));
  await unknown.page.locator('form').evaluate((form) => form.requestSubmit());
  await unknown.page.waitForFunction(() => window.__turnstileResets?.length === 2);
  assert.equal(unknown.state.submits.length, 2);
  assert.equal(unknown.state.submits[0].submissionId, unknown.state.submits[1].submissionId);
  await unknown.page.locator('#name').fill('佐藤花子');
  await unknown.page.evaluate(() => window.__turnstileOptions.callback('verified-token-3'));
  await unknown.page.locator('form').evaluate((form) => form.requestSubmit());
  await unknown.page.waitForFunction(() => window.__turnstileResets?.length === 3);
  assert.notEqual(unknown.state.submits[1].submissionId, unknown.state.submits[2].submissionId);
  await unknown.context.close();

  const equivalent = await openForm(['unknown_error', 'unknown_error', 'unknown_error']);
  await fillAndSubmit(equivalent.page, 'か\u3099');
  await equivalent.page.waitForFunction(() => window.__turnstileResets?.length === 1);
  await equivalent.page.locator('#name').fill('が');
  await equivalent.page.evaluate(() => window.__turnstileOptions.callback('canonical-token'));
  await equivalent.page.locator('form').evaluate((form) => form.requestSubmit());
  await equivalent.page.waitForFunction(() => window.__turnstileResets?.length === 2);
  await equivalent.page.locator('#enterprise').fill(' 株式会社テスト ');
  await equivalent.page.evaluate(() => window.__turnstileOptions.callback('whitespace-token'));
  await equivalent.page.locator('form').evaluate((form) => form.requestSubmit());
  await equivalent.page.waitForFunction(() => window.__turnstileResets?.length === 3);
  assert.equal(new Set(equivalent.state.submits.map(p => p.submissionId)).size, 1);
  await equivalent.context.close();

  const expired = await openForm(['form_expired']);
  await fillAndSubmit(expired.page);
  await expired.page.waitForFunction(() => document.querySelector('#form-feedback').textContent.includes('有効期限が切れました'));
  assert.equal(expired.state.submits.length, 1);
  assert.match(await expired.page.locator('#form-feedback').textContent(), /3秒ほど待って/);
  assert.deepEqual(await expired.page.evaluate(() => window.__turnstileResets), ['widget-1']);
  await expired.context.close();

  const conflict = await openForm(['request_id_conflict']);
  await fillAndSubmit(conflict.page);
  await conflict.page.waitForFunction(() => document.querySelector('#form-feedback').textContent.includes('確認が必要'));
  assert.equal(conflict.state.submits.length, 1);
  assert.deepEqual(await conflict.page.evaluate(() => window.__turnstileResets), ['widget-1']);
  await conflict.context.close();

  const review = await openForm(['delivery_review_required']);
  await fillAndSubmit(review.page);
  await review.page.waitForFunction(() => document.querySelector('#form-feedback').textContent.includes('受付記録は保存されました'));
  assert.equal(review.state.submits.length, 1);
  assert.match(await review.page.locator('#form-feedback').textContent(), /重複送信はせず/);
  await review.page.evaluate(() => window.__turnstileOptions.callback('newly-solved-token'));
  await review.page.locator('.btn-submit').click({ force: true });
  await review.page.locator('form').evaluate((form) => form.requestSubmit());
  await review.page.waitForTimeout(100);
  assert.equal(review.state.submits.length, 1);
  assert.equal(await review.page.locator('.btn-submit').isDisabled(), true);
  assert.match(await review.page.locator('#form-feedback').textContent(), /受付記録は保存されました/);
  await review.context.close();
  console.log('Contact form recovery contract passed with mocked Worker and Turnstile endpoints.');
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
