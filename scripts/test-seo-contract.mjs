import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertRobotsPolicy,
  assertUniqueSearchMetadata,
  buildStructuredData,
  serializeStructuredData,
  validateStructuredData
} from './lib/structured-data.mjs';

const site = {
  origin: 'https://www.abroad-o.com',
  name: 'アブロードアウトソーシング',
  legalName: 'アブロードアウトソーシング株式会社',
  language: 'ja',
  organizationId: 'https://www.abroad-o.com/#organization',
  websiteId: 'https://www.abroad-o.com/#website',
  logoUrl: 'https://www.abroad-o.com/image/rogo.png',
  telephone: '+81-3-5835-0250',
  email: 'info@abroad-o.com',
  address: { addressCountry: 'JP' },
  serviceItems: []
};
const page = {
  title: 'Page',
  description: 'Description',
  canonicalUrl: 'https://www.abroad-o.com/page.html',
  site
};

test('builds a canonical Japanese WebPage for an indexable page', () => {
  const graph = buildStructuredData(page);
  assert.doesNotThrow(() => validateStructuredData(graph, page));
  assert.equal(graph['@graph'][0].inLanguage, 'ja');
});

test('rejects a NewsArticle with a missing publication date', () => {
  assert.throws(() => buildStructuredData({ ...page, schemaType: 'NewsArticle' }), /datePublished/);
});

test('rejects an invented dateModified', () => {
  const source = { ...page, schemaType: 'NewsArticle', datePublished: '2026-06-16' };
  const graph = buildStructuredData(source);
  graph['@graph'].find((node) => node['@type'] === 'NewsArticle').dateModified = '2026-06-17';
  assert.throws(() => validateStructuredData(graph, source), /invented/);
});

test('rejects Service data on an unrelated page', () => {
  const graph = buildStructuredData(page);
  graph['@graph'].push({ '@type': 'Service', serviceType: 'Unrelated', areaServed: 'JP' });
  assert.throws(() => validateStructuredData(graph, page), /Unrelated Service/);
});

test('rejects robots policy that allows GPTBot', () => {
  const invalid = 'User-agent: GPTBot\nAllow: /\n\nUser-agent: *\nDisallow:\n';
  assert.throws(() => assertRobotsPolicy(invalid), /policy mismatch/);
});

test('rejects duplicate search titles', () => {
  assert.throws(() => assertUniqueSearchMetadata([
    { title: 'Same', description: 'One', canonicalUrl: 'https://www.abroad-o.com/a.html' },
    { title: 'Same', description: 'Two', canonicalUrl: 'https://www.abroad-o.com/b.html' }
  ]), /Duplicate title/);
});

test('escapes HTML-significant characters in serialized JSON-LD', () => {
  const json = serializeStructuredData({ ...page, title: '</script><script>alert(1)</script>' });
  assert.equal(json.includes('</script>'), false);
  assert.doesNotThrow(() => JSON.parse(json));
});
