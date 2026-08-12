import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { assertCspReportOnly, cspReportOnly } from './lib/csp-report-only-policy.mjs';

test('accepts exactly the approved report-only policy', () => assert.doesNotThrow(() => assertCspReportOnly(cspReportOnly)));
test('rejects policy relaxations and directive changes', () => {
  assert.throws(() => assertCspReportOnly(`${cspReportOnly} 'unsafe-inline'`));
  assert.throws(() => assertCspReportOnly(cspReportOnly.replace("object-src 'none'", "object-src 'self'")));
});
test('requires observed Google Analytics script and GTM image allowances', () => {
  assert.throws(() => assertCspReportOnly(cspReportOnly.replace('https://www.google-analytics.com ', '')));
  assert.throws(() => assertCspReportOnly(cspReportOnly.replace(' data: https://www.googletagmanager.com;', ' data:;')));
});
test('htaccess contains exactly one literal report-only header', () => {
  const htaccess = fs.readFileSync('.htaccess', 'utf8');
  const matches = [...htaccess.matchAll(/^Header always set Content-Security-Policy-Report-Only "([^"]+)"$/gm)];
  assert.equal(matches.length, 1); assert.equal(matches[0][1], cspReportOnly);
});
