import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { cspReportOnly, securityHeaders } from './lib/csp-report-only-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const pages = walk(output).filter((file) => file.endsWith('.html'));
assert.equal(pages.length, 48);
assert.ok(fs.readFileSync(path.join(root, '.htaccess')).equals(fs.readFileSync(path.join(output, '.htaccess'))), 'Generated .htaccess must be byte-identical.');
const negativeCases = [
  ['ga-script', 'script-src', 'https://www.google-analytics.com'], ['ga-image', 'img-src', 'https://www.google-analytics.com'], ['ga-connect', 'connect-src', 'https://www.google-analytics.com'],
  ['gtm-script', 'script-src', 'https://www.googletagmanager.com'], ['gtm-image', 'img-src', 'https://www.googletagmanager.com'],
  ['turnstile-script', 'script-src', 'https://challenges.cloudflare.com'], ['turnstile-frame', 'frame-src', 'https://challenges.cloudflare.com'],
  ['worker-connect', 'connect-src', 'https://abroad-o-contact-form.abroad-o.workers.dev'], ['maps-frame', 'frame-src', 'https://www.google.com']
];
const negativePolicies = new Map(negativeCases.map(([name, directive, source]) => {
  const directiveText = cspReportOnly.split('; ').find((part) => part.startsWith(`${directive} `));
  return [name, cspReportOnly.replace(directiveText, directiveText.split(' ').filter((token) => token !== source).join(' '))];
}));
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === '/__csp-negative.js') {
    const scripts = {
      'ga-script': "const node=document.createElement('script');node.src='https://www.google-analytics.com/analytics.js';document.head.append(node)",
      'ga-image': "new Image().src='https://www.google-analytics.com/collect?negative=1'",
      'ga-connect': "fetch('https://www.google-analytics.com/collect?negative=1')",
      'gtm-script': "const node=document.createElement('script');node.src='https://www.googletagmanager.com/gtag/js?negative=1';document.head.append(node)",
      'gtm-image': "new Image().src='https://www.googletagmanager.com/gtm.gif?negative=1'",
      'turnstile-script': "const node=document.createElement('script');node.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';document.head.append(node)",
      'turnstile-frame': "const node=document.createElement('iframe');node.src='https://challenges.cloudflare.com/turnstile/mock-frame';document.body.append(node)",
      'worker-connect': "fetch('https://abroad-o-contact-form.abroad-o.workers.dev/config')",
      'maps-frame': "const node=document.createElement('iframe');node.src='https://www.google.com/maps/embed?negative=1';document.body.append(node)"
    };
    const script = scripts[url.searchParams.get('case')];
    return response.writeHead(script ? 200 : 404, { ...securityHeaders, 'content-type': 'text/javascript' }).end(script || '');
  }
  if (pathname.startsWith('/__csp-negative/')) {
    const name = pathname.slice('/__csp-negative/'.length, -'.html'.length);
    const policy = negativePolicies.get(name);
    const headers = { ...securityHeaders, 'content-security-policy-report-only': policy || cspReportOnly, 'content-type': 'text/html' };
    return response.writeHead(policy ? 200 : 404, headers).end(policy ? `<!doctype html><body><script src="/__csp-negative.js?case=${name}"></script>` : '');
  }
  const file = path.resolve(output, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404, securityHeaders).end();
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
  response.writeHead(200, { ...securityHeaders, 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const allowedExternal = new Map([
  ['www.google-analytics.com', (url) => url.pathname === '/analytics.js'
    ? { type: 'text/javascript', body: "fetch('https://www.google-analytics.com/collect');new Image().src='https://www.google-analytics.com/collect?v=1';window.__gaFixtureLoaded=true;" }
    : url.pathname === '/collect' ? { type: 'image/gif', body: 'GIF89a' } : null],
  ['www.googletagmanager.com', (url) => url.pathname === '/gtag/js'
    ? { type: 'text/javascript', body: "const script=document.createElement('script');script.src='https://www.google-analytics.com/analytics.js';document.head.append(script);new Image().src='https://www.googletagmanager.com/gtm.gif?id=GTM-test';window.__gtmFixtureLoaded=true;" }
    : url.pathname === '/gtm.gif' ? { type: 'image/gif', body: 'GIF89a' } : null],
  ['challenges.cloudflare.com', (url) => url.pathname === '/turnstile/v0/api.js' ? { type: 'text/javascript', body: "window.turnstile={render:(target,options)=>{const frame=document.createElement('iframe');frame.src='https://challenges.cloudflare.com/turnstile/mock-frame';document.querySelector(target).append(frame);options.callback('mock-token');return 1},reset:()=>{}};" } : url.pathname === '/turnstile/mock-frame' ? { type: 'text/html', body: '<!doctype html><title>turnstile mock</title>' } : null],
  ['www.google.com', (url) => url.pathname === '/maps/embed' ? { type: 'text/html', body: '<!doctype html><title>map mock</title>' } : null],
  ['abroad-o-contact-form.abroad-o.workers.dev', (url) => url.pathname === '/config' ? { type: 'application/json', body: JSON.stringify({ turnstileSiteKey: 'test-key' }) } : url.pathname === '/submit' ? { type: 'application/json', body: JSON.stringify({ ok: true }) } : null]
]);

async function instrument(page, requests, violations, consoleCsp) {
  const failures = [];
  await page.exposeFunction('__recordCspViolation', (violation) => violations.push(violation));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    addEventListener('securitypolicyviolation', (event) => {
      const violation = { directive: event.violatedDirective, blocked: event.blockedURI };
      window.__cspViolations.push(violation);
      window.__recordCspViolation(violation);
    });
  });
  page.on('console', (message) => { if (/violat(?:e|ion).*Content Security Policy|Content Security Policy.*violat(?:e|ion)|Refused to/i.test(message.text())) consoleCsp.push(message.text()); });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    const expectedPdfAbort = url.hostname === '127.0.0.1' && url.pathname.startsWith('/pdfjs/') && request.failure()?.errorText === 'net::ERR_ABORTED';
    if (url.hostname === '127.0.0.1' && !expectedPdfAbort) failures.push(`Local request failed: ${request.url()} (${request.failure()?.errorText})`);
  });
  page.on('response', (response) => { const url = new URL(response.url()); if (url.hostname === '127.0.0.1' && !response.ok()) failures.push(`Local request was not 2xx: ${response.url()} (${response.status()})`); });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    const responder = allowedExternal.get(url.hostname); const payload = responder?.(url);
    if (!payload) { failures.push(`Unexpected external request: ${url.origin}${url.pathname}`); return route.abort('blockedbyclient'); }
    requests.push(`${url.origin}${url.pathname}`);
    return route.fulfill({ status: 200, contentType: payload.type, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }, body: payload.body });
  });
  return failures;
}

async function settlePage(page) {
  if (await page.locator('script[src^="https://www.googletagmanager.com/gtag/js"]').count()) {
    await page.waitForFunction(() => window.__gtmFixtureLoaded === true && window.__gaFixtureLoaded === true, undefined, { timeout: 3000 });
  }
  await page.waitForTimeout(100);
}

async function assertExactHeaders(response, label) {
  const headers = await response.headersArray();
  for (const [header, value] of Object.entries(securityHeaders)) {
    const matches = headers.filter((entry) => entry.name.toLowerCase() === header);
    assert.equal(matches.length, 1, `${label} must return exactly one ${header}.`);
    assert.equal(matches[0].value, value, `${label} returned a changed ${header}.`);
  }
}

function assertCleanRuntime(violations, consoleCsp, failures, label) {
  assert.deepEqual(violations, [], `${label} has CSP Report-Only violations`);
  assert.deepEqual(consoleCsp, [], `${label} has CSP console messages`);
  assert.deepEqual(failures, [], `${label} has failed or unexpected requests`);
}

const browser = await chromium.launch();
try {
  const scope = process.env.CSP_BROWSER_SCOPE || 'all';
  const allRequests = new Set();
  if (scope !== 'negative') {
  for (const file of pages) {
    const page = await browser.newPage(); const requests = []; const violations = []; const consoleCsp = [];
    const failures = await instrument(page, requests, violations, consoleCsp);
    const response = await page.goto(`${base}/${path.relative(output, file).replaceAll('\\', '/')}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${file} did not load`);
    await assertExactHeaders(response, file);
    await settlePage(page);
    assertCleanRuntime(violations, consoleCsp, failures, file);
    requests.forEach((value) => allRequests.add(value));
    await page.close();
  }
  const about = await browser.newPage(); const aboutRequests = []; const aboutViolations = []; const aboutConsole = [];
  const aboutFailures = await instrument(about, aboutRequests, aboutViolations, aboutConsole); await about.goto(`${base}/about.html`); await about.waitForFunction(() => document.querySelector('iframe[src^="https://www.google.com/maps/embed"]')); await settlePage(about);
  assert.ok(aboutRequests.includes('https://www.google.com/maps/embed'), 'Map frame was not requested.'); assertCleanRuntime(aboutViolations, aboutConsole, aboutFailures, 'about map journey'); await about.close();
  const sample = await browser.newPage(); const sampleRequests = []; const sampleViolations = []; const sampleConsole = []; const pdfResponses = [];
  sample.on('response', (response) => { if (new URL(response.url()).pathname.startsWith('/pdfjs/')) pdfResponses.push(response); });
  const sampleFailures = await instrument(sample, sampleRequests, sampleViolations, sampleConsole); await sample.goto(`${base}/sample2.html`); await sample.waitForFunction(() => document.querySelectorAll('iframe[src^="/pdfjs/"]').length === 3); await settlePage(sample);
  assert.deepEqual(sampleFailures, []);
  assert.equal(await sample.locator('iframe[src^="/pdfjs/"]').count(), 3, 'sample2 must contain three PDF frames.');
  assert.equal(pdfResponses.length, 3, 'sample2 must request three PDFs.');
  for (const response of pdfResponses) {
    assert.equal(response.status(), 200, `${response.url()} did not return 200.`);
    assert.equal(response.headers()['content-type'], 'application/pdf', `${response.url()} has the wrong MIME type.`);
    const direct = await sample.request.get(response.url());
    assert.equal(direct.status(), 200, `${response.url()} direct verification failed.`);
    assert.equal(direct.headers()['content-type'], 'application/pdf', `${response.url()} direct MIME verification failed.`);
    assert.ok((await direct.body()).byteLength > 0, `${response.url()} was empty.`);
  }
  assertCleanRuntime(sampleViolations, sampleConsole, sampleFailures, 'sample2 PDF journey'); await sample.close();
  const form = await browser.newPage(); const formRequests = []; const formViolations = []; const formConsole = [];
  const formFailures = await instrument(form, formRequests, formViolations, formConsole); await form.goto(`${base}/form.html`); await form.waitForFunction(() => document.querySelector('#turnstile-container iframe'));
  assert.ok(formRequests.includes('https://abroad-o-contact-form.abroad-o.workers.dev/config'), 'Worker config was not requested.'); assert.ok(formRequests.includes('https://challenges.cloudflare.com/turnstile/v0/api.js'), 'Turnstile API was not requested.'); assert.ok(formRequests.includes('https://challenges.cloudflare.com/turnstile/mock-frame'), 'Turnstile frame was not requested.');
  await form.locator('#enterprise').fill('Test'); await form.locator('#name').fill('Test User'); await form.locator('#inquiry_details').fill('Test inquiry'); await form.locator('#email').fill('test@example.com'); await form.locator('#phone').fill('0312345678'); await form.locator('#consent').check(); await form.locator('#contactForm').evaluate((node) => node.requestSubmit()); await form.waitForURL(`${base}/thank.html`, { timeout: 5000 }); await settlePage(form);
  assert.ok(formRequests.includes('https://abroad-o-contact-form.abroad-o.workers.dev/submit'), 'Worker submit was not requested.'); assertCleanRuntime(formViolations, formConsole, formFailures, 'contact form journey'); await form.close();
  const style = await browser.newPage(); const styleRequests = []; const styleViolations = []; const styleConsole = [];
  const styleFailures = await instrument(style, styleRequests, styleViolations, styleConsole); await style.goto(`${base}/about.html`); await style.evaluate(() => { document.body.style.color = 'red'; }); await style.waitForTimeout(150);
  assert.deepEqual(await style.evaluate(() => window.__cspViolations), [], 'Direct style property must not create a CSP violation.'); await style.evaluate(() => document.body.setAttribute('style', 'color: blue')); await style.waitForFunction(() => window.__cspViolations.length === 1);
  await style.waitForTimeout(50); assert.deepEqual(await style.evaluate(() => window.__cspViolations), [{ directive: 'style-src-attr', blocked: 'inline' }]); assert.deepEqual(styleViolations, [{ directive: 'style-src-attr', blocked: 'inline' }]); assert.deepEqual(styleFailures, []); await style.close();
  for (const expected of ['https://www.google-analytics.com/analytics.js', 'https://www.google-analytics.com/collect', 'https://www.googletagmanager.com/gtag/js', 'https://www.googletagmanager.com/gtm.gif']) assert.ok(allRequests.has(expected), `Approved external request was not exercised: ${expected}`);
  }
  if (scope !== 'positive') for (const [name, directive, source] of negativeCases) {
    const page = await browser.newPage(); const requests = []; const violations = []; const consoleCsp = [];
    const failures = await instrument(page, requests, violations, consoleCsp); const response = await page.goto(`${base}/__csp-negative/${name}.html`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${name} negative fixture did not load.`); await page.waitForFunction(() => window.__cspViolations.length > 0, undefined, { timeout: 3000 }); await page.waitForTimeout(50);
    const effectiveDirectives = directive === 'script-src' ? ['script-src', 'script-src-elem'] : [directive];
    assert.ok(violations.some((violation) => effectiveDirectives.includes(violation.directive) && violation.blocked.startsWith(source)), `${name} did not report ${directive} for ${source}.`);
    assert.ok(consoleCsp.length > 0, `${name} did not emit a CSP console violation.`); assert.deepEqual(failures, [], `${name} negative fixture had request failures.`); await page.close();
  }
  console.log(`CSP Report-Only browser contract passed (${scope}): 48 HTML pages, exact headers, approved external journeys, and directive-removal negatives.`);
} finally {
  await browser.close();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
