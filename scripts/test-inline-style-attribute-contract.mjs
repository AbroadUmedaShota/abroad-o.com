import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pageFiles = (directory) => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? pageFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]).filter((file) => file.endsWith('.njk'));

test('removes style attributes from generated-page sources while documenting passthrough exceptions', () => {
  for (const file of pageFiles('site/pages')) assert.doesNotMatch(read(file), /\sstyle\s*=/i, file);
  assert.equal((read('slick/largeformat.html').match(/\sstyle\s*=/gi) || []).length, 4);
});

test('maps every former inline declaration to its role-specific class', () => {
  const expected = [
    ['site/pages/news.html.njk', 'news-list-spacing'], ['site/pages/news/news_171023.html.njk', 'news-detail-back-link--spaced'], ['site/pages/news/news_250827.html.njk', 'news-detail-back-link--compact'], ['site/pages/news/news_250827.html.njk', 'news-article-cta'], ['site/pages/news/news_250827.html.njk', 'news-article-date'], ['site/pages/news/news_251212.html.njk', 'news-article-created-at'],
    ['site/pages/form.html.njk', 'form-page-title'], ['site/pages/about.html.njk', 'about-map-embed'], ['site/pages/film.html.njk', 'legacy-return-link'], ['site/pages/largeformat.html.njk', 'largeformat-price-marker'], ['site/pages/microfilm.html.njk', 'microfilm-active-tab'], ['site/pages/microfilm.html.njk', 'microfilm-heading-band'], ['site/pages/microfilm.html.njk', 'microfilm-table-heading'], ['site/pages/microfilm.html.njk', 'microfilm-process-arrow'], ['site/pages/microfilm.html.njk', 'microfilm-process-step'], ['site/pages/scan.html.njk', 'scan-heading-band']
  ];
  for (const [file, className] of expected) assert.match(read(file), new RegExp(`class="[^"]*\\b${className}\\b`), `${file}: ${className}`);
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
