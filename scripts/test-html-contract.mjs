import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPageMetadata } from './lib/html-contract.mjs';
import { assertAccessibilityContract } from './lib/accessibility-contract.mjs';

const expected = { title: 'Title', noindex: false, meta: { canonical: 'https://example.test/', 'og:title': 'Title', 'og:description': 'Description', 'og:type': 'website', 'og:url': 'https://example.test/', 'og:image': 'https://example.test/image.png', 'og:image:width': '1', 'og:image:height': '1', 'twitter:card': 'summary_large_image', 'twitter:title': 'Title', 'twitter:description': 'Description', 'twitter:image': 'https://example.test/image.png' } };
const metas = Object.entries(expected.meta).map(([key, value]) => key === 'canonical' ? `<link href="${value}" data-x="1" rel="canonical">` : `<meta content="${value}" data-x="1" ${key.startsWith('og:') ? `property="${key}"` : `name="${key}"`}>`).join('');
const valid = `<html><head>${metas}<title data-x="1">Title</title></head></html>`;
test('accepts reordered and extra metadata attributes', () => assert.doesNotThrow(() => assertPageMetadata(valid, expected, 'valid')));
for (const [name, html] of Object.entries({ duplicate: valid.replace('</head>', '<meta property="og:title" content="Title"></head>'), empty: valid.replace('content="Description"', 'content=""'), titleMismatch: valid.replace('>Title</title>', '>Wrong</title>'), canonicalDuplicate: valid.replace('</head>', '<link rel="canonical" href="https://example.test/"></head>'), canonicalMismatch: valid.replace('https://example.test/', 'https://wrong.test/') })) {
  test(`rejects ${name}`, () => assert.throws(() => assertPageMetadata(html, expected, name)));
}
test('rejects non-empty OG description mismatch', () => assert.throws(() => assertPageMetadata(valid.replace('content="Description"', 'content="Other"'), expected, 'og-description-mismatch')));

const accessible = '<h1>Title</h1><h2>Section</h2><h3>Child</h3><a rel="noreferrer noopener" target=_blank href=/ok>link</a><button aria-controls="panel secondary"></button><div id=panel></div><div id=secondary></div><img alt="サービスの説明" src="service.png"><img alt="" src="decoration.png">';
test('accepts reordered or unquoted accessibility attributes', () => assert.doesNotThrow(() => assertAccessibilityContract(accessible)));
for (const [name, html] of Object.entries({
  missingHref: accessible.replace('href=/ok', ''), emptyHref: accessible.replace('href=/ok', 'href=""'), blankRel: accessible.replace('rel="noreferrer noopener"', 'rel=noopener'), unresolvedControls: accessible.replace('id=secondary', 'id=other'), missingAlt: accessible.replace('alt="サービスの説明"', ''), genericAlt: accessible.replace('alt="サービスの説明"', 'alt=画像'), photoAlt: accessible.replace('alt="サービスの説明"', 'alt="photo 1"'), dataAlt: accessible.replace('alt="サービスの説明"', 'alt="data img1"'), inputAlt: accessible.replace('alt="サービスの説明"', 'alt="input 1"'), miniAlt: accessible.replace('alt="サービスの説明"', 'alt="mini box1"'), filenameAlt: accessible.replace('alt="サービスの説明"', 'alt="service.png"'), sourceFilenameAlt: accessible.replace('alt="サービスの説明"', 'alt="service"'), duplicateAttribute: accessible.replace('alt="サービスの説明"', 'alt="サービスの説明" class=one class=two'), duplicateId: accessible.replace('<div id=secondary>', '<div id=panel>'), unsafeHashHref: accessible.replace('href=/ok', 'href=#'), unsafeJavascriptHref: accessible.replace('href=/ok', 'href="javascript:void(0)"'), headingSkip: accessible.replace('<h2>Section</h2><h3>Child</h3>', '<h3>Skipped</h3>'), multipleH1: accessible.replace('<h2>Section</h2>', '<h1>Second</h1>')
})) test(`rejects ${name}`, () => assert.throws(() => assertAccessibilityContract(html, name)));
