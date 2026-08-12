import fs from 'node:fs';
import path from 'node:path';
import { assertAnalyticsOrder, assertNewsRuntimeOrder, assertNoAnalyticsScripts, assertNoInlineEventAttributes, assertNoInlineExecutableScripts, assertNoInlineStyles, assertPageStyleLink, assertPageStyleSheet, pageStyleSheetPaths, scriptInventory, styleInventory } from './lib/csp-readiness-contract.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
const sourceRoots = [path.join(repoRoot, 'site', 'pages'), path.join(repoRoot, 'site', '_includes', 'partials')];
const passthroughSource = path.join(repoRoot, 'slick', 'largeformat.html');
const analyticsPages = new Set(['about.html', 'aggregate.html', 'edit.html', 'film.html', 'form.html', 'index.html', 'input.html', 'largeformat.html', 'microfilm.html', 'recruit.html', 'rule.html', 'sample.html', 'sample2.html', 'scan.html', 'service-pack.html', 'service.html', 'speed-ad.html', 'telework.html', 'thank.html', 'slick/largeformat.html']);
const analyticsScript = fs.readFileSync(path.join(outputRoot, 'js', 'analytics.js'), 'utf8');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const sourceFiles = sourceRoots.flatMap(walk).filter((file) => file.endsWith('.njk'));
for (const file of [...sourceFiles, passthroughSource]) {
  const source = fs.readFileSync(file, 'utf8');
  assertNoInlineExecutableScripts(source, path.relative(repoRoot, file));
  assertNoInlineStyles(source, path.relative(repoRoot, file));
  assertNoInlineEventAttributes(source, path.relative(repoRoot, file));
}

const htmlFiles = walk(outputRoot).filter((file) => file.endsWith('.html'));
if (htmlFiles.length !== 48) throw new Error(`Expected 48 public HTML files, found ${htmlFiles.length}`);

let styleTags = 0;
let analyticsCount = 0;
let newsRuntimeCount = 0;
for (const file of htmlFiles) {
  const relative = path.relative(outputRoot, file).replaceAll('\\', '/');
  const html = fs.readFileSync(file, 'utf8');
  assertNoInlineExecutableScripts(html, relative);
  assertNoInlineStyles(html, relative);
  assertNoInlineEventAttributes(html, relative);
  assertPageStyleLink(html, relative);
  const styles = styleInventory(html);
  styleTags += styles.styleTags;
  if (analyticsPages.has(relative)) {
    assertAnalyticsOrder(html, analyticsScript, relative);
    analyticsCount += 1;
  } else assertNoAnalyticsScripts(html, relative);
  if (relative === 'news.html' || relative.startsWith('news/')) {
    assertNewsRuntimeOrder(html, relative);
    newsRuntimeCount += 1;
  } else if (scriptInventory(html).some((script) => script.src === '/js/news-runtime.js')) {
    throw new Error(`NEWS runtime was added outside NEWS: ${relative}`);
  }
}
if (analyticsCount !== 20) throw new Error(`Expected analytics on 20 pages, found ${analyticsCount}`);
if (newsRuntimeCount !== 28) throw new Error(`Expected NEWS runtime on 28 pages, found ${newsRuntimeCount}`);
if (styleTags !== 0) throw new Error(`Expected 0 generated inline style tags, found ${styleTags}`);
for (const href of pageStyleSheetPaths()) {
  assertPageStyleSheet(fs.readFileSync(path.join(outputRoot, href.slice(1)), 'utf8'), href);
}

console.log('CSP script readiness passed: 48 public HTML pages, 0 inline executable scripts or event attributes.');
console.log('CSP style readiness passed: 48 public HTML pages, 0 inline style tags/attributes; 10 exact external page stylesheets.');
