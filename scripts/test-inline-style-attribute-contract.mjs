import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pageFiles = (directory) => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? pageFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]).filter((file) => file.endsWith('.njk'));
const roleClassCounts = {
  'news-list-spacing': 1,
  'news-detail-back-link--spaced': 21,
  'news-detail-back-link--compact': 5,
  'news-article-cta': 5,
  'news-article-date': 5,
  'news-article-created-at': 1,
  'form-page-title': 1,
  'about-map-embed': 1,
  'legacy-return-link': 3,
  'largeformat-price-marker': 3,
  'microfilm-active-tab': 1,
  'microfilm-heading-band': 4,
  'microfilm-table-heading': 9,
  'microfilm-process-arrow': 2,
  'microfilm-process-step': 6,
  'scan-heading-band': 3
};

export function countRoleClasses(sources) {
  const counts = Object.fromEntries(Object.keys(roleClassCounts).map((name) => [name, 0]));
  for (const source of sources) for (const match of source.matchAll(/\bclass\s*=\s*"([^"]*)"/gi)) {
    for (const token of match[1].trim().split(/\s+/)) if (token in counts) counts[token] += 1;
  }
  return counts;
}

export function assertRoleClassCounts(sources) {
  assert.deepEqual(countRoleClasses(sources), roleClassCounts);
}

test('removes style attributes from generated-page sources while documenting passthrough exceptions', () => {
  for (const file of pageFiles('site/pages')) assert.doesNotMatch(read(file), /\sstyle\s*=/i, file);
  assert.equal((read('slick/largeformat.html').match(/\sstyle\s*=/gi) || []).length, 4);
});

test('maps all 71 former inline declarations to role-specific class tokens exactly once', () => {
  const sources = pageFiles('site/pages').map(read);
  assert.equal(Object.values(countRoleClasses(sources)).reduce((total, count) => total + count, 0), 71);
  assertRoleClassCounts(sources);
});

test('rejects missing, renamed, and duplicated role class tokens', () => {
  const sources = pageFiles('site/pages').map(read);
  assert.throws(() => assertRoleClassCounts(sources.map((source) => source.replace('news-detail-back-link--spaced', ''))));
  assert.throws(() => assertRoleClassCounts(sources.map((source) => source.replace('microfilm-process-step', 'other-process-step'))));
  assert.throws(() => assertRoleClassCounts([...sources, '<div class="news-list-spacing"></div>']));
});

test('keeps the former declarations in CSS with selectors that beat legacy rules', () => {
  const css = read('style.css');
  for (const selector of [
    '#film_top ul.nav-tabs > li.active > a.microfilm-active-tab', '#film_top ul.nav-tabs > li > a.legacy-return-link', '#film_table .largeformat-price-marker', '.line_orange.microfilm-heading-band', '#film_top .table .microfilm-table-heading', '.triangle_orange.microfilm-process-arrow', 'section#tele_mid5_orange ul li.microfilm-process-step'
  ]) assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(css, /\.line_orange\.microfilm-heading-band\s*\{\s*background-color:\s*#BBBBBB/);
  assert.match(css, /\.triangle_orange\.microfilm-process-arrow\s*\{\s*border-top-color:\s*#BBBBBB/);
  assert.match(css, /li\.microfilm-process-step\s*\{\s*background-color:\s*#EEEEEE;\s*border-left-color:\s*#BBBBBB/);
  assert.match(read('style3.css'), /\.scan-heading-band\s*\{\s*background-color:\s*#082E5D/);
  assert.match(read('css/pages/form.css'), /\.form-page-title\s*\{\s*text-align:\s*center/);
  assert.match(read('css/pages/news-index.css'), /\.news-list-spacing\s*\{\s*margin-top:\s*30px/);
  assert.match(read('css/pages/news-251212.css'), /\.news-article-created-at\s*\{\s*margin-bottom:\s*8px/);
});
