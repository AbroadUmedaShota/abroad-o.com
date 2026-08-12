import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPageMetadata } from './lib/html-contract.mjs';

const expected = { title: 'Title', noindex: false, meta: { canonical: 'https://example.test/', 'og:title': 'Title', 'og:description': 'Description', 'og:type': 'website', 'og:url': 'https://example.test/', 'og:image': 'https://example.test/image.png', 'og:image:width': '1', 'og:image:height': '1', 'twitter:card': 'summary_large_image', 'twitter:title': 'Title', 'twitter:description': 'Description', 'twitter:image': 'https://example.test/image.png' } };
const metas = Object.entries(expected.meta).map(([key, value]) => key === 'canonical' ? `<link href="${value}" data-x="1" rel="canonical">` : `<meta content="${value}" data-x="1" ${key.startsWith('og:') ? `property="${key}"` : `name="${key}"`}>`).join('');
const valid = `<html><head>${metas}<title data-x="1">Title</title></head></html>`;
test('accepts reordered and extra metadata attributes', () => assert.doesNotThrow(() => assertPageMetadata(valid, expected, 'valid')));
for (const [name, html] of Object.entries({ duplicate: valid.replace('</head>', '<meta property="og:title" content="Title"></head>'), empty: valid.replace('content="Description"', 'content=""'), titleMismatch: valid.replace('>Title</title>', '>Wrong</title>'), canonicalDuplicate: valid.replace('</head>', '<link rel="canonical" href="https://example.test/"></head>'), canonicalMismatch: valid.replace('https://example.test/', 'https://wrong.test/') })) {
  test(`rejects ${name}`, () => assert.throws(() => assertPageMetadata(html, expected, name)));
}
test('rejects non-empty OG description mismatch', () => assert.throws(() => assertPageMetadata(valid.replace('content="Description"', 'content="Other"'), expected, 'og-description-mismatch')));
