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
const turnstileScriptUrl = `https://${turnstileHost}/turnstile/v0/api.js?render=explicit`;
const unavailableMessage = '現在フォームを利用できません。時間をおいて再度お試しいただくか、下記メールアドレスまたは電話番号からご連絡ください。';
const expiredMessage = '確認の有効期限が切れました。もう一度確認してください。';
const turnstileErrorMessage = 'bot対策の確認を読み込めませんでした。時間をおいて再度お試しいただくか、別の方法でご連絡ください。';
const missingTokenMessage = 'bot対策の確認を完了してください。';
const submitErrorMessage = '送信結果を確認できませんでした。入力内容は保持されています。同じ内容で手動で再送してください。';
const expectedPayloadKeys = ['address', 'consent', 'department', 'email', 'enterprise', 'formStartedAt', 'inquiryDetails', 'name', 'phone', 'submissionId', 'turnstileToken', 'website'];
const validValues = {
  enterprise: '株式会社テスト',
  department: 'DX推進部',
  name: '山田太郎',
  email: 'test@example.com',
  phone: '03-5835-0250',
  address: '東京都千代田区',
  inquiry_details: 'お問い合わせです。'
};

const generatedForm = fs.readFileSync(path.join(output, 'form.html'), 'utf8');
assert.equal((generatedForm.match(new RegExp(`data-contact-api="${apiBase}"`, 'g')) || []).length, 1, 'The production contact API base changed or is duplicated.');
assert.equal((generatedForm.match(/js\/contact-form\.js\?v=20260906-contact-recovery/g) || []).length, 1, 'The contact-form cache URL changed or is duplicated.');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  response.writeHead(200, { 'content-type': contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const localBase = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function openForm(options = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const state = { config: [], submit: [], turnstile: [], escaped: [], openedAt: Date.now() };
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === workerHost) {
      if (url.href === `${apiBase}/config` && request.method() === 'GET') {
        state.config.push({ url: url.href, method: request.method() });
        if (options.configFailure) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
        const config = options.missingSiteKey ? {} : { turnstileSiteKey: 'test-site-key', turnstileAction: 'contact-submit' };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) });
      }
      if (url.href === `${apiBase}/submit` && request.method() === 'POST') {
        state.submit.push({ url: url.href, method: request.method(), headers: request.headers(), body: request.postDataJSON() });
        if (options.pendingSubmit) return new Promise(() => {});
        const body = options.submitBody ?? { ok: true };
        return route.fulfill({ status: options.submitStatus ?? 200, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body) });
      }
      state.escaped.push(`${request.method()} ${url.href}`);
      return route.abort();
    }
    if (url.hostname === turnstileHost) {
      if (url.href !== turnstileScriptUrl || request.method() !== 'GET') {
        state.escaped.push(`${request.method()} ${url.href}`);
        return route.abort();
      }
      state.turnstile.push({ url: url.href, method: request.method() });
      if (options.scriptFailure) return route.abort();
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.turnstile={render:(node,options)=>{window.__turnstileOptions=options;window.__turnstileNode=node;return 'widget-1'},reset:(id)=>{window.__turnstileReset=(window.__turnstileReset||[]).concat(id)}};`
      });
    }
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.fulfill({ status: 204, body: '' });
    return route.continue();
  });
  await page.goto(`${localBase}/form.html${options.query || ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__turnstileOptions || document.querySelector('#form-feedback')?.textContent);
  return { context, page, state };
}

async function closeCase(testCase) {
  assert.deepEqual(testCase.state.escaped, [], 'A Worker or Turnstile request escaped the exact mock contract.');
  await testCase.context.close();
}

async function fillValid(page) {
  for (const [id, value] of Object.entries(validValues)) await page.locator(`#${id}`).fill(value);
  await page.locator('#consent').check();
}

try {
  {
    const testCase = await openForm();
    const { page, state } = testCase;
    assert.deepEqual(state.config, [{ url: `${apiBase}/config`, method: 'GET' }]);
    assert.deepEqual(state.turnstile, [{ url: turnstileScriptUrl, method: 'GET' }]);
    assert.equal(state.submit.length, 0);
    assert.equal(await page.locator('.btn-submit').isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => ({
      sitekey: window.__turnstileOptions.sitekey,
      action: window.__turnstileOptions.action,
      theme: window.__turnstileOptions.theme,
      node: window.__turnstileNode
    })), { sitekey: 'test-site-key', action: 'contact-submit', theme: 'light', node: '#turnstile-container' });
    await page.evaluate(() => window.__turnstileOptions.callback('token-1'));
    assert.equal(await page.locator('.btn-submit').isDisabled(), false);
    await closeCase(testCase);
  }
  {
    const testCase = await openForm({ query: '?service=speed-ad' });
    assert.equal(await testCase.page.locator('#inquiry_details').inputValue(), 'SPEED ADについて相談したいです。');
    await closeCase(testCase);
  }
  {
    const testCase = await openForm();
    await testCase.page.locator('form').evaluate((form) => form.requestSubmit());
    assert.equal(await testCase.page.locator('#enterprise').evaluate((field) => document.activeElement === field), true);
    assert.equal(testCase.state.submit.length, 0);
    await closeCase(testCase);
  }
  {
    const testCase = await openForm();
    await fillValid(testCase.page);
    await testCase.page.locator('#email').fill('invalid-email');
    assert.equal(await testCase.page.locator('#email').getAttribute('aria-invalid'), 'true');
    assert.equal(await testCase.page.locator('#email + .error-message').evaluate((error) => error.classList.contains('error-visible')), true);
    await testCase.page.locator('form').evaluate((form) => form.requestSubmit());
    assert.equal(await testCase.page.locator('#email').evaluate((field) => document.activeElement === field), true);
    assert.equal(testCase.state.submit.length, 0);
    await closeCase(testCase);
  }
  {
    const testCase = await openForm();
    await fillValid(testCase.page);
    await testCase.page.locator('#phone').fill('abc');
    assert.equal(await testCase.page.locator('#phone').getAttribute('aria-invalid'), 'true');
    assert.equal(await testCase.page.locator('#phone + .error-message').evaluate((error) => error.classList.contains('error-visible')), true);
    await testCase.page.locator('form').evaluate((form) => form.requestSubmit());
    assert.equal(await testCase.page.locator('#phone').evaluate((field) => document.activeElement === field), true);
    assert.equal(testCase.state.submit.length, 0);
    await closeCase(testCase);
  }
  {
    const testCase = await openForm();
    await fillValid(testCase.page);
    await testCase.page.locator('#consent').uncheck();
    await testCase.page.evaluate(() => window.__turnstileOptions.callback('token'));
    await testCase.page.locator('form').evaluate((form) => form.requestSubmit());
    assert.equal(await testCase.page.locator('#consent').evaluate((field) => document.activeElement === field), true);
    assert.equal(testCase.state.submit.length, 0);
    await closeCase(testCase);
  }
  {
    const testCase = await openForm();
    await fillValid(testCase.page);
    await testCase.page.locator('form').evaluate((form) => form.requestSubmit());
    assert.equal(await testCase.page.locator('#form-feedback').textContent(), missingTokenMessage);
    assert.equal(testCase.state.submit.length, 0);
    await closeCase(testCase);
  }
  {
    const testCase = await openForm();
    const { page } = testCase;
    await page.evaluate(() => { window.__turnstileOptions.callback('token'); window.__turnstileOptions['expired-callback'](); });
    assert.equal(await page.locator('.btn-submit').isDisabled(), true);
    assert.equal(await page.locator('#form-feedback').textContent(), expiredMessage);
    await page.evaluate(() => window.__turnstileOptions['error-callback']());
    assert.equal(await page.locator('.btn-submit').isDisabled(), true);
    assert.equal(await page.locator('#form-feedback').textContent(), turnstileErrorMessage);
    assert.equal(testCase.state.submit.length, 0);
    await closeCase(testCase);
  }
  for (const options of [{ configFailure: true }, { missingSiteKey: true }, { scriptFailure: true }]) {
    const testCase = await openForm(options);
    assert.equal(await testCase.page.locator('.btn-submit').isDisabled(), true);
    assert.equal(await testCase.page.locator('#form-feedback').textContent(), unavailableMessage);
    assert.equal(testCase.state.submit.length, 0);
    await closeCase(testCase);
  }
  {
    const testCase = await openForm();
    const { page, state } = testCase;
    await fillValid(page);
    await page.evaluate(() => window.__turnstileOptions.callback('verified-token'));
    await Promise.all([page.waitForURL(`${localBase}/thank.html`), page.locator('form').evaluate((form) => form.requestSubmit())]);
    assert.equal(state.submit.length, 1);
    const request = state.submit[0];
    assert.equal(request.url, `${apiBase}/submit`);
    assert.equal(request.method, 'POST');
    assert.match(request.headers['content-type'], /^application\/json/);
    assert.deepEqual(Object.keys(request.body).sort(), expectedPayloadKeys);
    assert.match(request.body.submissionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(typeof request.body.formStartedAt, 'number');
    assert.ok(request.body.formStartedAt >= state.openedAt && request.body.formStartedAt <= Date.now());
    assert.deepEqual({
      enterprise: request.body.enterprise,
      department: request.body.department,
      name: request.body.name,
      email: request.body.email,
      phone: request.body.phone,
      address: request.body.address,
      inquiryDetails: request.body.inquiryDetails,
      consent: request.body.consent,
      website: request.body.website,
      turnstileToken: request.body.turnstileToken
    }, {
      enterprise: validValues.enterprise,
      department: validValues.department,
      name: validValues.name,
      email: validValues.email,
      phone: validValues.phone,
      address: validValues.address,
      inquiryDetails: validValues.inquiry_details,
      consent: true,
      website: '',
      turnstileToken: 'verified-token'
    });
    await page.waitForTimeout(50);
    assert.equal(state.submit.length, 1);
    await closeCase(testCase);
  }
  for (const options of [{ submitStatus: 500 }, { submitBody: { ok: false } }, { submitBody: 'not json' }]) {
    const testCase = await openForm(options);
    const { page, state } = testCase;
    await fillValid(page);
    await page.evaluate(() => window.__turnstileOptions.callback('token'));
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await page.waitForFunction((message) => document.querySelector('#form-feedback')?.textContent === message, submitErrorMessage);
    assert.equal(page.url(), `${localBase}/form.html`);
    assert.equal(state.submit.length, 1);
    assert.equal(await page.locator('.btn-submit').isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => window.__turnstileReset), ['widget-1']);
    await closeCase(testCase);
  }
  {
    const testCase = await openForm({ pendingSubmit: true });
    await fillValid(testCase.page);
    await testCase.page.evaluate(() => window.__turnstileOptions.callback('token'));
    await testCase.page.locator('form').evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
    await testCase.page.waitForTimeout(100);
    assert.equal(testCase.state.submit.length, 1);
    await closeCase(testCase);
  }
  console.log('Contact form Worker/Turnstile contract passed without production requests.');
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
