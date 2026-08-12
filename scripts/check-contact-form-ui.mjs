import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const worker = 'abroad-o-contact-form.abroad-o.workers.dev';
const turnstile = 'challenges.cloudflare.com';
const api = `https://${worker}`;
const unavailable = '現在フォームを利用できません。時間をおいて再度お試しいただくか、下記メールアドレスまたは電話番号からご連絡ください。';
const expired = '確認の有効期限が切れました。もう一度確認してください。';
const turnstileError = 'bot対策の確認を読み込めませんでした。時間をおいて再度お試しいただくか、別の方法でご連絡ください。';
const submitError = '送信できませんでした。時間をおいて再度お試しいただくか、別の方法でご連絡ください。';
const html = fs.readFileSync(path.join(output, 'form.html'), 'utf8');
assert.match(html, new RegExp(`data-contact-api="${api}"`));
assert.equal((html.match(/js\/contact-form\.js\?v=20260808-turnstile-light/g) || []).length, 1, 'contact-form cache URL changed or duplicated');
const server = http.createServer((req, res) => { const pathname = new URL(req.url, 'http://localhost').pathname; const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.slice(1)); if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end(); res.writeHead(200).end(fs.readFileSync(file)); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const expectedKeys = ['address','consent','department','email','enterprise','formStartedAt','inquiryDetails','name','phone','submissionId','turnstileToken','website'];
async function open(options = {}) {
  const context = await browser.newContext(); const page = await context.newPage(); const state = { config: 0, submit: [], reset: 0, options: null, escaped: [] };
  await page.route('**/*', async route => { const url = new URL(route.request().url());
    if (url.hostname === worker) { if (url.pathname === '/config') { state.config++; if (options.configFailure) return route.fulfill({ status: 503, body: '{}' }); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(options.missingKey ? {} : { turnstileSiteKey: 'test-site-key', turnstileAction: 'contact-submit' }) }); } if (url.pathname === '/submit') { state.submit.push({ headers: route.request().headers(), body: route.request().postDataJSON() }); if (options.pending) return; const body = options.submitBody ?? { ok: true }; return route.fulfill({ status: options.submitStatus ?? 200, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body) }); } state.escaped.push(url.href); return route.abort(); }
    if (url.hostname === turnstile) { if (options.scriptFailure) return route.abort(); return route.fulfill({ contentType: 'application/javascript', body: `window.turnstile={render:(node,o)=>{window.__ts=o;return 'widget-1'},reset:()=>window.__reset=(window.__reset||0)+1};` }); }
    if (!['127.0.0.1','localhost'].includes(url.hostname)) return route.fulfill({ status: 204, body: '' }); return route.continue(); });
  await page.goto(`${base}/form.html${options.query || ''}`, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__ts || document.querySelector('#form-feedback').textContent); return { context, page, state };
}
async function fillValid(page) { for (const [id, value] of Object.entries({ enterprise: '株式会社テスト', name: '山田太郎', email: 'test@example.com', phone: '03-5835-0250', address: '東京都', inquiry_details: 'お問い合わせです。' })) await page.locator(`#${id}`).fill(value); await page.locator('#consent').check(); }
try {
  { const { page, context, state } = await open(); assert.equal(state.config, 1); assert.equal(state.submit.length, 0); assert.equal(await page.locator('.btn-submit').isDisabled(), true); const ts = await page.evaluate(() => ({ sitekey: __ts.sitekey, action: __ts.action, theme: __ts.theme, id: window.turnstile.render && 'widget-1' })); assert.deepEqual(ts, { sitekey: 'test-site-key', action: 'contact-submit', theme: 'light', id: 'widget-1' }); await page.evaluate(() => __ts.callback('token-1')); assert.equal(await page.locator('.btn-submit').isDisabled(), false); await context.close(); }
  { const { page, context } = await open({ query: '?service=speed-ad' }); assert.equal(await page.locator('#inquiry_details').inputValue(), 'SPEED ADについて相談したいです。'); await context.close(); }
  { const { page, context, state } = await open(); await page.locator('form').evaluate(f => f.requestSubmit()); assert.equal(await page.locator('#enterprise').evaluate(e => document.activeElement === e), true); await page.locator('#email').fill('bad'); await page.locator('#phone').fill('bad'); assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'true'); assert.equal(await page.locator('#phone').getAttribute('aria-invalid'), 'true'); await page.locator('form').evaluate(f => f.requestSubmit()); assert.equal(state.submit.length, 0); await context.close(); }
  { const { page, context, state } = await open(); await page.evaluate(() => __ts.callback('x')); await fillValid(page); await page.locator('#consent').uncheck(); await page.locator('form').evaluate(f => f.requestSubmit()); assert.equal(await page.locator('#consent').evaluate(e => document.activeElement === e), true); assert.equal(state.submit.length, 0); await context.close(); }
  { const { page, context } = await open(); await page.evaluate(() => { __ts.callback('x'); __ts['expired-callback'](); }); assert.equal(await page.locator('.btn-submit').isDisabled(), true); assert.equal(await page.locator('#form-feedback').textContent(), expired); await page.evaluate(() => __ts['error-callback']()); assert.equal(await page.locator('#form-feedback').textContent(), turnstileError); await context.close(); }
  for (const options of [{ configFailure: true }, { missingKey: true }, { scriptFailure: true }]) { const { page, context, state } = await open(options); assert.equal(await page.locator('.btn-submit').isDisabled(), true); assert.equal(await page.locator('#form-feedback').textContent(), unavailable); assert.equal(state.submit.length, 0); await context.close(); }
  { const { page, context, state } = await open(); await fillValid(page); await page.evaluate(() => __ts.callback('verified')); await Promise.all([page.waitForURL(`${base}/thank.html`), page.locator('form').evaluate(f => f.requestSubmit())]); assert.equal(state.submit.length, 1); const sent = state.submit[0]; assert.match(sent.headers['content-type'], /^application\/json/); assert.deepEqual(Object.keys(sent.body).sort(), expectedKeys); assert.match(sent.body.submissionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i); assert.equal(typeof sent.body.formStartedAt, 'number'); assert.equal(sent.body.turnstileToken, 'verified'); assert.equal(sent.body.enterprise, '株式会社テスト'); await context.close(); }
  for (const options of [{ submitStatus: 500 }, { submitBody: { ok: false } }, { submitBody: 'not json' }]) { const { page, context, state } = await open(options); await fillValid(page); await page.evaluate(() => __ts.callback('x')); await page.locator('form').evaluate(f => f.requestSubmit()); await page.waitForFunction(t => document.querySelector('#form-feedback').textContent === t, submitError); assert.equal(page.url(), `${base}/form.html`); assert.equal(state.submit.length, 1); assert.equal(await page.locator('.btn-submit').isDisabled(), true); assert.equal(await page.evaluate(() => window.__reset), 1); await context.close(); }
  { const { page, context, state } = await open({ pending: true }); await fillValid(page); await page.evaluate(() => __ts.callback('x')); await page.locator('form').evaluate(f => { f.requestSubmit(); f.requestSubmit(); }); await page.waitForTimeout(100); assert.equal(state.submit.length, 1); await context.close(); }
  console.log('Contact form Worker/Turnstile contract passed.');
} finally { await browser.close(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
