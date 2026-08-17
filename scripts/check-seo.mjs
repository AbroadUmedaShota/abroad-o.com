import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { documentMetadata } from './lib/html-contract.mjs';
import {
  assertRobotsPolicy,
  assertStructuredDataSource,
  assertUniqueSearchMetadata,
  validateStructuredData
} from './lib/structured-data.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(repoRoot, 'site', 'pages');
const outputRoot = path.join(repoRoot, '_site');
const site = JSON.parse(fs.readFileSync(path.join(repoRoot, 'site', '_data', 'site.json'), 'utf8'));

const fixedSearchCopy = new Map([
  ['https://www.abroad-o.com/', ['データ入力・スキャニング・画像加工のBPO｜アブロードアウトソーシング', 'データ入力、集計・分析、書類・図面・フィルムのスキャニング、画像編集・加工を提供。小ロットから大規模案件まで、業務標準化と品質・セキュリティ管理で支援します。']],
  ['https://www.abroad-o.com/service.html', ['BPOサービス一覧｜データ入力・集計・スキャン・画像加工｜アブロードアウトソーシング', 'データ入力、アンケート集計・分析、書類・図面・フィルムのスキャニング、画像編集・加工など、法人向けBPOサービスの一覧です。']],
  ['https://www.abroad-o.com/input.html', ['データ入力代行サービス｜名簿・アンケート・申込書対応｜アブロードアウトソーシング', '名簿、アンケート、申込書、契約書、書籍などのデータ入力を代行します。入力仕様、参考価格、納品までの流れ、品質・セキュリティ管理をご案内します。']],
  ['https://www.abroad-o.com/aggregate.html', ['データ集計・分析サービス｜アンケート集計・データ加工｜アブロードアウトソーシング', 'アンケートの単純集計・クロス集計、グラフ作成、データクリーニング・コンバートに対応。納品形式と参考価格をご案内します。']],
  ['https://www.abroad-o.com/scan.html', ['書類スキャニング・電子化サービス｜図面・写真対応｜アブロードアウトソーシング', '書類、契約書、書籍、図面、写真、フィルムなどのスキャニング・電子化に対応。対象原稿、解像度、参考価格、納品までの流れをご案内します。']],
  ['https://www.abroad-o.com/edit.html', ['画像編集・加工サービス｜切り抜き・補正・レタッチ｜アブロードアウトソーシング', '画像の切り抜き、カラー補正、レタッチ、不要物削除、合成などに対応。作業例、参考価格、見積条件をご案内します。']],
  ['https://www.abroad-o.com/film.html', ['写真フィルムスキャンサービス｜ネガ・ポジ対応｜アブロードアウトソーシング', 'ネガ・ポジ・35mm・各種写真フィルムのスキャンに対応。対応サイズ、解像度、参考価格、納品までの流れをご案内します。']],
  ['https://www.abroad-o.com/microfilm.html', ['マイクロフィルム電子化・スキャンサービス｜アブロードアウトソーシング', 'マイクロフィッシュ、ロールフィルムなどの電子化に対応。対応可能な種類・サイズ、取扱条件、参考価格をご案内します。']],
  ['https://www.abroad-o.com/largeformat.html', ['大判図面・ポスターのスキャン・電子化｜A1対応｜アブロードアウトソーシング', '図面、ポスター、絵画、新聞などA1サイズまでの大判原稿を電子化。対応サイズ、撮影方法、参考価格、納品までの流れをご案内します。']],
  ['https://www.abroad-o.com/telework.html', ['テレワーク向け書類電子化・スキャニング｜アブロードアウトソーシング', 'テレワーク環境整備に向け、紙書類のスキャニング、PDF化、ファイル名付与に対応。参考価格、納期、セキュリティ対策をご案内します。']],
  ['https://www.abroad-o.com/service-pack.html', ['らくらくスキャンパック｜書類電子化サービス｜アブロードアウトソーシング', '書類の箱単位スキャンなど、用途別に選べる「らくらくスキャンパック」をご案内。料金、納期、納品方法、申込手順を確認できます。']]
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function generatedPath(data) {
  return path.join(outputRoot, data.permalink.replace(/^\//, ''));
}

function scriptJsonLd(html, file) {
  const matches = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (matches.length !== 1) throw new Error(`Expected one JSON-LD script: ${file}`);
  return JSON.parse(matches[0][1]);
}

function assertSingleMeta(metadata, key, expected, file) {
  const values = metadata.values.get(key) || [];
  if (values.length !== 1 || values[0] !== expected) throw new Error(`Unexpected ${key} in ${file}: ${JSON.stringify(values)}`);
}

const sources = walk(sourceRoot).filter((file) => file.endsWith('.njk')).map((file) => {
  const template = fs.readFileSync(file, 'utf8');
  const data = matter(template).data;
  return { file, template, data };
});
const indexable = sources.filter(({ data }) => data.noindex !== true);
assertUniqueSearchMetadata(indexable.map(({ data }) => data));
if (indexable.length !== 46) throw new Error(`Expected 46 indexable pages, found ${indexable.length}`);

const graphs = [];
for (const { file, template, data } of sources) {
  if (/meta\s+name=["']keywords["']/i.test(template)) throw new Error(`meta keywords remains in ${file}`);
  if (/meta\s+name=["']google-site-verification["']/i.test(template)) throw new Error(`Page-local Google verification remains in ${file}`);
  const outputFile = generatedPath(data);
  const html = fs.readFileSync(outputFile, 'utf8');
  const metadata = documentMetadata(html);
  assertSingleMeta(metadata, 'google-site-verification', site.googleSiteVerification, outputFile);
  assertSingleMeta(metadata, 'og:site_name', site.name, outputFile);
  assertSingleMeta(metadata, 'og:locale', site.locale, outputFile);
  assertSingleMeta(metadata, 'og:image:alt', data.ogImageAlt || site.defaultOgImageAlt, outputFile);
  assertSingleMeta(metadata, 'twitter:image:alt', data.ogImageAlt || site.defaultOgImageAlt, outputFile);
  if ((metadata.values.get('keywords') || []).length) throw new Error(`Generated meta keywords remains in ${outputFile}`);

  if (data.noindex === true) {
    if (/application\/ld\+json/i.test(html)) throw new Error(`noindex page has JSON-LD: ${outputFile}`);
    continue;
  }
  assertStructuredDataSource(data);
  const graph = scriptJsonLd(html, outputFile);
  validateStructuredData(graph, data);
  graphs.push(graph);

  if (data.schemaType === 'NewsArticle' && !new RegExp(`<time\\b[^>]*datetime=["']${data.datePublished}["']`, 'i').test(html)) {
    throw new Error(`NewsArticle has no visible time for datePublished: ${outputFile}`);
  }
  if (data.schemaImage) {
    const image = new URL(data.schemaImage);
    if (image.origin !== site.origin || !fs.existsSync(path.join(outputRoot, image.pathname.slice(1))) || !html.includes(path.basename(image.pathname))) {
      throw new Error(`NewsArticle schemaImage is not article-specific published content: ${outputFile}`);
    }
  }
  const fixed = fixedSearchCopy.get(data.canonicalUrl);
  if (fixed && (data.title !== fixed[0] || data.description !== fixed[1])) throw new Error(`Fixed search copy changed: ${data.canonicalUrl}`);
}

const definedIds = new Set(graphs.flatMap((graph) => graph['@graph']).filter((node) => node['@type'] && node['@id']).map((node) => node['@id']));
for (const graph of graphs) {
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if (value['@id'] && !definedIds.has(value['@id'])) throw new Error(`Unresolved JSON-LD @id: ${value['@id']}`);
    Object.values(value).forEach(visit);
  };
  visit(graph);
}

const serviceHtml = fs.readFileSync(path.join(outputRoot, 'service.html'), 'utf8');
for (const item of site.serviceItems) {
  const url = new URL(item.url);
  const visibleHref = url.origin === site.origin ? path.basename(url.pathname) : item.url;
  if (!serviceHtml.includes(visibleHref)) throw new Error(`ItemList entry is not linked on service.html: ${item.name}`);
}

const sitemap = fs.readFileSync(path.join(outputRoot, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (sitemapUrls.length !== 46 || new Set(sitemapUrls).size !== 46 || sitemap.includes('<lastmod>')) throw new Error('Sitemap must contain 46 unique canonical URLs without lastmod');
assertRobotsPolicy(fs.readFileSync(path.join(outputRoot, 'robots.txt'), 'utf8'));

const keyFile = path.join(outputRoot, `${site.indexNowKey}.txt`);
if (!fs.existsSync(keyFile) || fs.readFileSync(keyFile, 'utf8').trim() !== site.indexNowKey) throw new Error('Public IndexNow key file mismatch');
for (const header of ['header-modern.njk', 'header-legacy.njk']) {
  const content = fs.readFileSync(path.join(repoRoot, 'site', '_includes', 'partials', header), 'utf8');
  if (content.includes('/index.html')) throw new Error(`Non-canonical home link remains in ${header}`);
}

console.log('SEO/AIO check passed: 46 indexable pages, JSON-LD references, metadata, robots, sitemap, and IndexNow key verified.');
