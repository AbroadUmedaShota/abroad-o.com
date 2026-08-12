import assert from 'node:assert/strict';
import test from 'node:test';
import { assertImagePerformanceContract, assertIntrinsicImageStyle } from './lib/image-performance-contract.mjs';

const critical = { src: 'image/critical.png', alt: '重要画像', class: 'critical', width: '1536', height: '1024', decoding: 'async', loading: null, fetchpriority: 'high' };
const deferred = { src: 'image/deferred.png', alt: '遅延画像', class: null, width: '512', height: '512', decoding: 'async', loading: 'lazy', fetchpriority: null };
const valid = `<img src="${critical.src}" alt="${critical.alt}" class="${critical.class}" width="${critical.width}" height="${critical.height}" decoding="${critical.decoding}" fetchpriority="${critical.fetchpriority}"><img src="${deferred.src}" alt="${deferred.alt}" width="${deferred.width}" height="${deferred.height}" decoding="${deferred.decoding}" loading="${deferred.loading}">`;

test('accepts the image performance contract', () => assert.doesNotThrow(() => assertImagePerformanceContract(valid, [critical, deferred], 'valid')));
for (const [name, html] of Object.entries({
  missingDimensions: valid.replace('height="1024" ', ''),
  criticalLazy: valid.replace('fetchpriority="high"', 'fetchpriority="high" loading="lazy"'),
  missingLazy: valid.replace(' loading="lazy"', ''),
  wrongDimensions: valid.replace('width="512"', 'width="640"')
})) test(`rejects ${name}`, () => assert.throws(() => assertImagePerformanceContract(html, [critical, deferred], name)));

test('accepts the intrinsic image height rule', () => assert.doesNotThrow(() => assertIntrinsicImageStyle('.image-intrinsic { width: 100%; height: auto; }')));
test('rejects a missing intrinsic image height rule', () => assert.throws(() => assertIntrinsicImageStyle('.image-intrinsic { height: 100%; }')));
