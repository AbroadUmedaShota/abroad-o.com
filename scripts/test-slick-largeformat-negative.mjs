import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSlickGeometry, assertSlickRuntimeRequests } from './lib/slick-largeformat-contract.mjs';

test('accepts the GTM loader and nonempty local assets only', () => assert.doesNotThrow(() => assertSlickRuntimeRequests({ externalOrigins: ['https://www.googletagmanager.com'], localFailures: [], localAssets: [{ path: '/vendor/jquery/jquery.min.js', bytes: 1 }] })));
test('rejects an unexpected external origin', () => assert.throws(() => assertSlickRuntimeRequests({ externalOrigins: ['https://cdnjs.cloudflare.com'], localFailures: [], localAssets: [{ path: '/vendor/jquery/jquery.min.js', bytes: 1 }] })));
test('rejects missing or empty local assets', () => {
  assert.throws(() => assertSlickRuntimeRequests({ externalOrigins: ['https://www.googletagmanager.com'], localFailures: ['/vendor/jquery/jquery.min.js'], localAssets: [{ path: '/vendor/jquery/jquery.min.js', bytes: 1 }] }));
  assert.throws(() => assertSlickRuntimeRequests({ externalOrigins: ['https://www.googletagmanager.com'], localFailures: [], localAssets: [{ path: '/vendor/jquery/jquery.min.js', bytes: 0 }] }));
});
test('rejects return-link style and geometry mutations', () => {
  const expected = { overflow: 0, header: { height: 100 }, bodyHeight: 200, largestContainer: 100, returnLink: { color: 'rgb(204, 204, 204)' }, cta: { display: 'inline-block', fontSize: '18px' } };
  assert.throws(() => assertSlickGeometry({ overflow: 0, header: 100, body: 200, container: 100, returnLink: { color: 'rgb(85, 85, 85)' }, cta: { display: 'inline-block', fontSize: '18px' } }, expected));
  assert.throws(() => assertSlickGeometry({ overflow: 1, header: 100, body: 200, container: 100, returnLink: { color: 'rgb(204, 204, 204)' }, cta: { display: 'inline-block', fontSize: '18px' } }, expected));
});
