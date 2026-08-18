import { parse } from 'parse5';
import crypto from 'node:crypto';

export const pageStyleSheets = new Map([
  ['about.html', '/css/pages/legacy-no-link.css'],
  ['aggregate.html', '/css/pages/legacy-no-link.css'],
  ['edit.html', '/css/pages/legacy-no-link.css'],
  ['film.html', '/css/pages/legacy-no-link.css'],
  ['input.html', '/css/pages/legacy-no-link.css'],
  ['largeformat.html', '/css/pages/legacy-no-link.css'],
  ['microfilm.html', '/css/pages/legacy-no-link.css'],
  ['recruit.html', '/css/pages/legacy-no-link.css'],
  ['rule.html', '/css/pages/legacy-no-link.css'],
  ['sample.html', '/css/pages/legacy-no-link.css'],
  ['sample2.html', '/css/pages/legacy-no-link.css'],
  ['service-pack.html', '/css/pages/legacy-no-link.css'],
  ['telework.html', '/css/pages/legacy-no-link.css'],
  ['form.html', '/css/pages/form.css'],
  ['news.html', '/css/pages/news-index.css'],
  ['service.html', '/css/pages/service.css'],
  ['speed-ad.html', '/css/pages/speed-ad.css'],
  ['news/news_250827.html', '/css/pages/news-office-move.css'],
  ['news/news_250908.html', '/css/pages/news-office-move.css'],
  ['news/news_251212.html', '/css/pages/news-251212.css'],
  ['news/news_260526.html', '/css/pages/news-260526.css'],
  ['news/news_260615.html', '/css/pages/news-260615.css'],
  ['news/news_260616.html', '/css/pages/news-260616.css']
]);

const pageStyleFingerprints = new Map([
  ['/css/pages/legacy-no-link.css', '2092c2908856'],
  ['/css/pages/form.css', 'ba4675b242e1'],
  ['/css/pages/news-index.css', '160cf5669050'],
  ['/css/pages/news-office-move.css', '4c4fcc77f120'],
  ['/css/pages/news-251212.css', '96762581c2b4'],
  ['/css/pages/news-260526.css', '330eec19dbf8'],
  ['/css/pages/news-260615.css', '742a7665333f'],
  ['/css/pages/news-260616.css', '5a684272925a'],
  ['/css/pages/service.css', 'b543ac64b22a'],
  ['/css/pages/speed-ad.css', 'ced0b1a7dc18']
]);

function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) visit(child, callback);
}

function attributes(node) {
  return new Map((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value]));
}

export function scriptInventory(html) {
  const scripts = [];
  visit(parse(html), (node) => {
    if (node.nodeName !== 'script') return;
    const attrs = attributes(node);
    const content = (node.childNodes || []).map((child) => child.value || '').join('').trim();
    scripts.push({ src: attrs.get('src') || '', type: (attrs.get('type') || '').trim().toLowerCase(), inline: !attrs.has('src') && content.length > 0, async: attrs.has('async') });
  });
  return scripts;
}

export function styleInventory(html) {
  let styleTags = 0;
  let styleAttributes = 0;
  const pageStyleLinks = [];
  visit(parse(html), (node) => {
    if (node.nodeName === 'style') styleTags += 1;
    if ((node.attrs || []).some(({ name }) => name.toLowerCase() === 'style')) styleAttributes += 1;
    if (node.nodeName === 'link') {
      const attrs = attributes(node);
      if ((attrs.get('rel') || '').toLowerCase().split(/\s+/).includes('stylesheet') && (attrs.get('href') || '').startsWith('/css/pages/')) {
        pageStyleLinks.push(attrs.get('href'));
      }
    }
  });
  return { styleTags, styleAttributes, pageStyleLinks };
}

export function assertPageStyleLink(html, file) {
  const expected = pageStyleSheets.get(file);
  const { pageStyleLinks } = styleInventory(html);
  if (!expected) {
    if (pageStyleLinks.length) throw new Error(`Page stylesheet was added outside the existing page set: ${file}`);
    return;
  }
  if (pageStyleLinks.length !== 1 || pageStyleLinks[0] !== expected) {
    throw new Error(`Page stylesheet link or count changed in ${file}`);
  }
}

export function assertNoInlineStyles(html, file) {
  const { styleTags, styleAttributes } = styleInventory(html);
  if (styleTags || styleAttributes) throw new Error(`Inline styles remain in ${file}: ${styleTags} style tags, ${styleAttributes} style attributes`);
}

export function assertPageStyleSheet(css, href) {
  if (!css.trim()) throw new Error(`Page stylesheet is empty: ${href}`);
  const normalized = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');
  const fingerprint = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  if (pageStyleFingerprints.get(href) !== fingerprint) throw new Error(`Page stylesheet content changed: ${href}`);
}

export function pageStyleSheetPaths() {
  return [...pageStyleFingerprints.keys()];
}

export function assertNoInlineExecutableScripts(html, file) {
  const inline = scriptInventory(html).filter((script) => script.inline && script.type !== 'application/ld+json');
  if (inline.length) throw new Error(`Inline executable script remains in ${file}: ${inline.length}`);
}

export function assertNoInlineEventAttributes(html, file) {
  const eventAttributes = [];
  visit(parse(html), (node) => {
    for (const { name } of node.attrs || []) if (/^on[a-z]/i.test(name)) eventAttributes.push(name);
  });
  if (eventAttributes.length) throw new Error(`Inline event attributes remain in ${file}: ${eventAttributes.join(', ')}`);
}

export function assertAnalyticsOrder(html, analyticsScript, file) {
  const scripts = scriptInventory(html);
  const loader = 'https://www.googletagmanager.com/gtag/js?id=UA-51168812-1';
  const loaderIndexes = scripts.map((script, index) => script.src === loader ? index : -1).filter((index) => index >= 0);
  const analyticsIndexes = scripts.map((script, index) => script.src === '/js/analytics.js' ? index : -1).filter((index) => index >= 0);
  const gaLoaders = scripts.filter((script) => script.src.includes('googletagmanager.com/gtag/js?id='));
  if (loaderIndexes.length !== 1 || !scripts[loaderIndexes[0]].async || gaLoaders.length !== 1 || analyticsIndexes.length !== 1 || analyticsIndexes[0] !== loaderIndexes[0] + 1) {
    throw new Error(`Analytics script order or count changed in ${file}`);
  }
  const configs = analyticsScript.match(/gtag\s*\(\s*['"]config['"]\s*,\s*['"]UA-51168812-1['"]\s*\)/g) || [];
  if (configs.length !== 1) throw new Error(`Analytics config changed in ${file}`);
  const analyticsIds = analyticsScript.match(/\b(?:UA-\d[\w-]*|G-[A-Z0-9]+)\b/gi) || [];
  if (analyticsIds.length !== 1 || analyticsIds[0] !== 'UA-51168812-1') throw new Error(`Unexpected analytics ID in ${file}`);
}

export function assertNoAnalyticsScripts(html, file) {
  const scripts = scriptInventory(html);
  const analyticsScripts = scripts.filter((script) =>
    script.src === '/js/analytics.js' || script.src.includes('googletagmanager.com/gtag/js?id=')
  );
  if (analyticsScripts.length) throw new Error(`Analytics was added outside the existing page set: ${file}`);
}

export function assertNewsRuntimeOrder(html, file) {
  const scripts = scriptInventory(html).map(({ src }) => src);
  const required = ['/vendor/jquery/jquery.min.js', '/vendor/bootstrap3/js/bootstrap.min.js', '/js/jquery.smooth-scroll.min.js', '/js/news-runtime.js'];
  let previous = -1;
  for (const src of required) {
    const indexes = scripts.map((value, index) => value === src ? index : -1).filter((index) => index >= 0);
    if (indexes.length !== 1 || indexes[0] <= previous) throw new Error(`NEWS runtime order or count changed in ${file}: ${src}`);
    const index = indexes[0];
    previous = index;
  }
}
