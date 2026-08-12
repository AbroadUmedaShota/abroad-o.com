import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { apacheHeaderNames, assertCspReportOnly, assertHtaccessSecurityHeaders, cspDirectiveSources, cspReportOnly, parseCsp, securityHeaders } from './lib/csp-report-only-policy.mjs';

test('accepts exactly the approved report-only policy', () => assert.doesNotThrow(() => assertCspReportOnly(cspReportOnly)));
test('parses the approved directive source sets exactly', () => assert.deepEqual(parseCsp(cspReportOnly), cspDirectiveSources));
test('rejects policy relaxations and directive changes', () => {
  assert.throws(() => assertCspReportOnly(`${cspReportOnly} 'unsafe-inline'`));
  assert.throws(() => assertCspReportOnly(cspReportOnly.replace("object-src 'none'", "object-src 'self'")));
});
test('requires every directive source and rejects unsafe or duplicate companions', () => {
  for (const [directive, sources] of Object.entries(cspDirectiveSources)) {
    for (const source of sources) assert.throws(() => assertCspReportOnly(cspReportOnly.replace(`${directive} ${sources.join(' ')}`, `${directive} ${sources.filter((candidate) => candidate !== source).join(' ')}`)), `${directive} must retain ${source}`);
  }
  assert.throws(() => assertCspReportOnly(cspReportOnly.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")));
  assert.throws(() => assertCspReportOnly(cspReportOnly.replace("img-src 'self'", "img-src *")));
  assert.throws(() => assertCspReportOnly(`${cspReportOnly}; img-src 'self'`));
});
test('rejects removals for each exercised external directive allowance', () => {
  const remove = (directive, source) => cspReportOnly.replace(new RegExp(`(${directive}[^;]*) ${source.replaceAll('.', '\\.')}`), '$1');
  for (const [directive, source] of [
    ['script-src', 'https://www.google-analytics.com'], ['img-src', 'https://www.google-analytics.com'], ['connect-src', 'https://www.google-analytics.com'],
    ['script-src', 'https://www.googletagmanager.com'], ['img-src', 'https://www.googletagmanager.com'], ['connect-src', 'https://www.googletagmanager.com'],
    ['script-src', 'https://challenges.cloudflare.com'], ['frame-src', 'https://challenges.cloudflare.com'],
    ['connect-src', 'https://abroad-o-contact-form.abroad-o.workers.dev'], ['frame-src', 'https://www.google.com']
  ]) assert.throws(() => assertCspReportOnly(remove(directive, source)), `${directive} must retain ${source}`);
});
test('htaccess contains exactly one exact value for every security header', () => {
  const htaccess = fs.readFileSync('.htaccess', 'utf8');
  assert.doesNotThrow(() => assertHtaccessSecurityHeaders(htaccess));
  for (const [header, value] of Object.entries(securityHeaders)) {
    const apacheName = apacheHeaderNames[header];
    const line = `Header always set ${apacheName} "${value}"`;
    assert.throws(() => assertHtaccessSecurityHeaders(htaccess.replace(line, '')));
    assert.throws(() => assertHtaccessSecurityHeaders(htaccess.replace(line, `${line}\n${line}`)));
    assert.throws(() => assertHtaccessSecurityHeaders(htaccess.replace(line, `Header always set ${apacheName} "changed"`)));
  }
});
