import { parse } from 'parse5';

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
    scripts.push({ src: attrs.get('src') || '', inline: !attrs.has('src') && content.length > 0, async: attrs.has('async') });
  });
  return scripts;
}

export function styleInventory(html) {
  let styleTags = 0;
  let styleAttributes = 0;
  visit(parse(html), (node) => {
    if (node.nodeName === 'style') styleTags += 1;
    if ((node.attrs || []).some(({ name }) => name.toLowerCase() === 'style')) styleAttributes += 1;
  });
  return { styleTags, styleAttributes };
}

export function assertNoInlineExecutableScripts(html, file) {
  const inline = scriptInventory(html).filter((script) => script.inline);
  if (inline.length) throw new Error(`Inline executable script remains in ${file}: ${inline.length}`);
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
