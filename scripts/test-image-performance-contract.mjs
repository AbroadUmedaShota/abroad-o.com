import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { assertImageFileDimensions, assertImagePerformanceContract, assertIntrinsicImageStyle, assertTopImageCssContract, assertTopImageGradientCssContract, assertTopImagePreloadContract, imageDimensions } from './lib/image-performance-contract.mjs';
import { assertAlphaDifference, assertTopImageAlphaMetadata } from './lib/top-image-derivative.mjs';

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

const topImagePreload = '<link rel="preload" as="image" href="/image/top1.webp" type="image/webp" fetchpriority="high">';
test('accepts the top image preload on an opted-in page', () => assert.doesNotThrow(() => assertTopImagePreloadContract(topImagePreload, true, 'preload')));
test('accepts no top image preload on an opted-out page', () => assert.doesNotThrow(() => assertTopImagePreloadContract('', false, 'no preload')));
for (const [name, html, expected] of [
  ['duplicateTopPreload', `${topImagePreload}${topImagePreload}`, true],
  ['pngAndWebpTopPreload', `${topImagePreload}<link rel="preload" as="image" href="/image/top1.png" fetchpriority="high">`, true],
  ['missingFetchPriority', topImagePreload.replace(' fetchpriority="high"', ''), true],
  ['missingWebpType', topImagePreload.replace(' type="image/webp"', ''), true],
  ['wrongAs', topImagePreload.replace('as="image"', 'as="script"'), true],
  ['unexpectedTopPreload', topImagePreload, false],
  ['caseInsensitiveUnexpectedTopPreload', topImagePreload.replace('rel="preload"', 'rel="PRELOAD"'), false],
  ['multiTokenUnexpectedTopPreload', topImagePreload.replace('rel="preload"', 'rel="stylesheet preload"'), false],
  ['unexpectedTopPreloadRelTokens', topImagePreload.replace('rel="preload"', 'rel="stylesheet preload"'), true]
]) test(`rejects ${name}`, () => assert.throws(() => assertTopImagePreloadContract(html, expected, name)));

test('accepts the intrinsic image height rule', () => assert.doesNotThrow(() => assertIntrinsicImageStyle('.image-intrinsic { width: 100%; height: auto; }')));
test('rejects a missing intrinsic image height rule', () => assert.throws(() => assertIntrinsicImageStyle('.image-intrinsic { height: 100%; }')));

const topImageCss = `#top { background-image: url(image/top1.png); background-image: image-set(url("image/top1.webp") type("image/webp") 1x, url("image/top1.png") type("image/png") 1x); }`;
test('accepts paired PNG/WebP top image backgrounds', () => assert.doesNotThrow(() => assertTopImageCssContract(topImageCss)));
test('rejects an unpaired PNG top image background', () => assert.throws(() => assertTopImageCssContract(topImageCss.replace(/ background-image: image-set[^;]+;/, ''))));
test('rejects image-set hidden in a custom property because unsupported browsers lose the PNG fallback', () => assert.throws(() => assertTopImageCssContract(':root { --top: image-set(url("image/top1.webp") type("image/webp") 1x, url("image/top1.png") type("image/png") 1x); } #top { background-image: url(image/top1.png); background-image: var(--top); }')));
const topImageGradientCss = `.one { background-image: linear-gradient(red, blue), url(image/top1.png); background-image: linear-gradient(red, blue), image-set(url("image/top1.webp") type("image/webp") 1x, url("image/top1.png") type("image/png") 1x); }\n.two { background: linear-gradient(red, blue), url(image/top1.png); background: linear-gradient(red, blue), image-set(url("image/top1.webp") type("image/webp") 1x, url("image/top1.png") type("image/png") 1x); }`;
test('accepts paired PNG/WebP top image gradients', () => assert.doesNotThrow(() => assertTopImageGradientCssContract(topImageGradientCss)));
test('accepts absolute PNG/WebP top image gradients after CSS extraction', () => assert.doesNotThrow(() => assertTopImageGradientCssContract(topImageGradientCss.replaceAll('image/top1.', '/image/top1.'))));
test('rejects a missing WebP top image gradient', () => assert.throws(() => assertTopImageGradientCssContract(topImageGradientCss.replace(/background-image: linear-gradient\(red, blue\), image-set[^;]+;/, ''))));
test('rejects a changed alpha channel separately from RGB-only quality metrics', () => assert.throws(() => assertAlphaDifference(1)));
test('rejects mismatched alpha metadata', async () => {
  const [png, webp] = await Promise.all([
    sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).png().toBuffer(),
    sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 1, g: 2, b: 3 } } }).webp().toBuffer()
  ]);
  await assert.rejects(() => assertTopImageAlphaMetadata(png, webp));
});

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
