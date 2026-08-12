import assert from 'node:assert/strict';
import test from 'node:test';
import { assertImageFileDimensions, assertImagePerformanceContract, assertIntrinsicImageStyle, assertTopImagePreloadContract, imageDimensions } from './lib/image-performance-contract.mjs';

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

const topImagePreload = '<link rel="preload" as="image" href="/image/top1.png" fetchpriority="high">';
test('accepts the top image preload on an opted-in page', () => assert.doesNotThrow(() => assertTopImagePreloadContract(topImagePreload, true, 'preload')));
test('accepts no top image preload on an opted-out page', () => assert.doesNotThrow(() => assertTopImagePreloadContract('', false, 'no preload')));
for (const [name, html, expected] of [
  ['duplicateTopPreload', `${topImagePreload}${topImagePreload}`, true],
  ['missingFetchPriority', topImagePreload.replace(' fetchpriority="high"', ''), true],
  ['wrongAs', topImagePreload.replace('as="image"', 'as="script"'), true],
  ['unexpectedTopPreload', topImagePreload, false]
]) test(`rejects ${name}`, () => assert.throws(() => assertTopImagePreloadContract(html, expected, name)));

test('accepts the intrinsic image height rule', () => assert.doesNotThrow(() => assertIntrinsicImageStyle('.image-intrinsic { width: 100%; height: auto; }')));
test('rejects a missing intrinsic image height rule', () => assert.throws(() => assertIntrinsicImageStyle('.image-intrinsic { height: 100%; }')));

const png = Buffer.alloc(24);
Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
png.write('IHDR', 12, 'ascii');
png.writeUInt32BE(512, 16);
png.writeUInt32BE(256, 20);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x90, 0x02, 0x58, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);

test('reads PNG and JPEG intrinsic dimensions', () => {
  assert.deepEqual(imageDimensions(png, 'fixture.png'), [512, 256]);
  assert.deepEqual(imageDimensions(jpeg, 'fixture.jpg'), [600, 400]);
});
test('rejects an image file dimension mismatch', () => assert.throws(() => assertImageFileDimensions(png, 640, 256, 'fixture.png')));
test('rejects an unsupported image file', () => assert.throws(() => imageDimensions(Buffer.from('not an image'), 'fixture.txt')));
