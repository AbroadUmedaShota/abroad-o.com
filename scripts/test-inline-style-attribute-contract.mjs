import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'parse5';

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

const roleBindings = {
  'news-list-spacing': { 'news.html.njk|section': 1 },
  'news-detail-back-link--spaced': Object.fromEntries(['171023', '17110101', '17110102', '17110103', '171211', '18083101', '18083102', '181220', '190327', '191227', '200106', '200327', '200508', '200526', '200721', '201106', '210329', '220807', '221212', '231226', '241218'].map((date) => [`news/news_${date}.html.njk|p`, 1])),
  'news-detail-back-link--compact': Object.fromEntries(['250827', '250908', '260526', '260615', '260616'].map((date) => [`news/news_${date}.html.njk|p`, 1])),
  'news-article-cta': Object.fromEntries(['250827', '250908', '260526', '260615', '260616'].map((date) => [`news/news_${date}.html.njk|div`, 1])),
  'news-article-date': Object.fromEntries(['250827', '250908', '260526', '260615', '260616'].map((date) => [`news/news_${date}.html.njk|p`, 1])),
  'news-article-created-at': { 'news/news_251212.html.njk|p': 1 },
  'form-page-title': { 'form.html.njk|h1': 1 },
  'about-map-embed': { 'about.html.njk|iframe': 1 },
  'legacy-return-link': { 'film.html.njk|a': 1, 'largeformat.html.njk|a': 1, 'microfilm.html.njk|a': 1 },
  'largeformat-price-marker': { 'largeformat.html.njk|b': 3 },
  'microfilm-active-tab': { 'microfilm.html.njk|a': 1 },
  'microfilm-heading-band': { 'microfilm.html.njk|div': 4 },
  'microfilm-table-heading': { 'microfilm.html.njk|th': 5, 'microfilm.html.njk|td': 4 },
  'microfilm-process-arrow': { 'microfilm.html.njk|div': 2 },
  'microfilm-process-step': { 'microfilm.html.njk|li': 6 },
  'scan-heading-band': { 'scan.html.njk|div': 3 }
};

function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) visit(child, callback);
}

export function roleClassBindings(records) {
  const bindings = Object.fromEntries(Object.keys(roleBindings).map((role) => [role, {}]));
  for (const { file, source } of records) visit(parse(source), (node) => {
    const classes = (node.attrs || []).find(({ name }) => name.toLowerCase() === 'class')?.value || '';
    for (const token of classes.trim().split(/\s+/)) if (token in bindings) {
      const key = `${file}|${node.nodeName}`;
      bindings[token][key] = (bindings[token][key] || 0) + 1;
    }
  });
  return bindings;
}

export function assertRoleClassBindings(records) {
  assert.deepEqual(roleClassBindings(records), roleBindings);
}

function attributes(node) {
  return Object.fromEntries((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value]));
}

function nodeText(node) {
  let text = '';
  visit(node, (child) => { if (child.nodeName === '#text') text += child.value || ''; });
  return text.replace(/\s+/g, ' ').trim();
}

function childAnchorHref(node) {
  let href = '';
  visit(node, (child) => { if (!href && child.nodeName === 'a') href = attributes(child).href || ''; });
  return href;
}

function hasAncestor(node, predicate) {
  for (let ancestor = node.parentNode; ancestor; ancestor = ancestor.parentNode) {
    if (predicate(ancestor, attributes(ancestor))) return true;
  }
  return false;
}

function semanticRoleMatch(role, node, file) {
  const attrs = attributes(node);
  const text = nodeText(node);
  const href = childAnchorHref(node);
  const classes = (attrs.class || '').split(/\s+/);
  if (!roleBindings[role]?.[`${file}|${node.nodeName}`]) return false;
  switch (role) {
    case 'news-list-spacing': return node.nodeName === 'section' && attrs.id === 'news_list' && classes.includes('container');
    case 'news-detail-back-link--spaced':
    case 'news-detail-back-link--compact': return node.nodeName === 'p' && href === '../news.html' && classes.includes('news-detail-back-link');
    case 'news-article-cta': return node.nodeName === 'div' && classes.includes('text-center') && /(?:SPEED AD|Googleマップ|PR TIMES|無料で始める)/.test(text);
    case 'news-article-date': return node.nodeName === 'p' && !href && classes.every((token) => !token || token === role) && /20(?:25|26)年/.test(text) && /アブロードアウトソーシング/.test(text);
    case 'news-article-created-at': return node.nodeName === 'p' && text === '作成日：2025/12/12';
    case 'form-page-title': return node.nodeName === 'h1' && text === 'お問い合わせ・お見積もりフォーム';
    case 'about-map-embed': return node.nodeName === 'iframe' && attrs.width === '99%' && attrs.height === '400' && (attrs.src || '').startsWith('https://www.google.com/maps/embed?');
    case 'legacy-return-link': return node.nodeName === 'a' && attrs.href === 'scan.html' && text === '前の画面に戻る';
    case 'largeformat-price-marker': return node.nodeName === 'b' && !text && ['基本料金', 'A2・B3サイズ', 'A1・B2サイズ'].includes(nodeText(node.parentNode));
    case 'microfilm-active-tab': return node.nodeName === 'a' && attrs.href === '#sampleContentA' && attrs['data-toggle'] === 'tab';
    case 'microfilm-heading-band': return node.nodeName === 'div' && classes.includes('line_orange');
    case 'microfilm-table-heading': return ['th', 'td'].includes(node.nodeName) && ['ベース素材', '内容', '対応可否', 'サイズ', '価格/コマ', 'オプション', '補足事項', '-'].includes(text) && hasAncestor(node, (ancestor, ancestorAttrs) => ancestor.nodeName === 'tr' && (ancestorAttrs.class || '').split(/\s+/).includes('active'));
    case 'microfilm-process-arrow': return node.nodeName === 'div' && classes.includes('triangle_orange');
    case 'microfilm-process-step': return node.nodeName === 'li' && text.length > 0 && hasAncestor(node, (ancestor, ancestorAttrs) => ancestor.nodeName === 'section' && ancestorAttrs.id === 'tele_mid5_orange');
    case 'scan-heading-band': return node.nodeName === 'div' && classes.includes('max-width-line_blue') && classes.includes('max-width-line');
    default: return false;
  }
}

export function assertRoleClassSemantics(records) {
  const violations = [];
  for (const { file, source } of records) visit(parse(source), (node) => {
    const classes = (attributes(node).class || '').trim().split(/\s+/).filter(Boolean);
    for (const role of Object.keys(roleClassCounts)) {
      const occurrences = classes.filter((token) => token === role).length;
      const expectedHere = semanticRoleMatch(role, node, file);
      if (occurrences > 1) violations.push(`${file}:${node.nodeName}:${role}:duplicate`);
      if (occurrences === 1 && !expectedHere) violations.push(`${file}:${node.nodeName}:${role}:misplaced`);
      if (expectedHere && occurrences !== 1) violations.push(`${file}:${node.nodeName}:${role}:missing`);
    }
  });
  assert.deepEqual(violations, []);
}

const sourceRecords = () => pageFiles('site/pages').map((file) => ({ file: path.relative(path.join(root, 'site', 'pages'), file).replaceAll('\\', '/'), source: read(file) }));

test('removes style attributes from generated-page sources while documenting passthrough exceptions', () => {
  for (const file of pageFiles('site/pages')) assert.doesNotMatch(read(file), /\sstyle\s*=/i, file);
  assert.equal((read('slick/largeformat.html').match(/\sstyle\s*=/gi) || []).length, 4);
});

test('maps all 71 former inline declarations to role-specific class tokens exactly once', () => {
  const sources = sourceRecords().map(({ source }) => source);
  assert.equal(Object.values(countRoleClasses(sources)).reduce((total, count) => total + count, 0), 71);
  assertRoleClassCounts(sources);
  assertRoleClassBindings(sourceRecords());
  assertRoleClassSemantics(sourceRecords());
});

test('rejects missing, renamed, and duplicated role class tokens', () => {
  const sources = sourceRecords().map(({ source }) => source);
  assert.throws(() => assertRoleClassCounts(sources.map((source) => source.replace('news-detail-back-link--spaced', ''))));
  assert.throws(() => assertRoleClassCounts(sources.map((source) => source.replace('microfilm-process-step', 'other-process-step'))));
  assert.throws(() => assertRoleClassCounts([...sources, '<div class="news-list-spacing"></div>']));
});

test('rejects a same-count role class swap or relocation', () => {
  const records = sourceRecords();
  const swapped = records.map((record) => ({ ...record, source: record.source }));
  const largeformat = swapped.find(({ file }) => file === 'largeformat.html.njk');
  largeformat.source = largeformat.source
    .replace('legacy-return-link', '__swapped-role__')
    .replace('largeformat-price-marker', 'legacy-return-link')
    .replace('__swapped-role__', 'largeformat-price-marker');
  assertRoleClassCounts(swapped.map(({ source }) => source));
  assert.throws(() => assertRoleClassBindings(swapped));
});

test('rejects compact/date swaps between same-file paragraph elements', () => {
  const records = sourceRecords().map((record) => ({ ...record, source: record.source }));
  const article = records.find(({ file }) => file === 'news/news_250827.html.njk');
  article.source = article.source
    .replace('news-detail-back-link--compact', '__swapped-role__')
    .replace('news-article-date', 'news-detail-back-link--compact')
    .replace('__swapped-role__', 'news-article-date');
  assertRoleClassCounts(records.map(({ source }) => source));
  assertRoleClassBindings(records);
  assert.throws(() => assertRoleClassSemantics(records));
});

test('rejects same-role relocation to another same-file list item', () => {
  const records = sourceRecords().map((record) => ({ ...record, source: record.source }));
  const page = records.find(({ file }) => file === 'microfilm.html.njk');
  page.source = page.source
    .replace('class="microfilm-process-step"', 'class=""')
    .replace('<li class="active">', '<li class="active microfilm-process-step">');
  assertRoleClassCounts(records.map(({ source }) => source));
  assertRoleClassBindings(records);
  assert.throws(() => assertRoleClassSemantics(records));
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
