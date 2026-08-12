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

export function assertAnalyticsOrder(html, file) {
  const scripts = scriptInventory(html);
  const gtagIndex = scripts.findIndex((script) => script.src === 'https://www.googletagmanager.com/gtag/js?id=UA-51168812-1' && script.async);
  const analyticsIndex = scripts.findIndex((script) => script.src === '/js/analytics.js');
  if (gtagIndex < 0 || analyticsIndex !== gtagIndex + 1) throw new Error(`Analytics script order changed in ${file}`);
}

export function assertNewsRuntimeOrder(html, file) {
  const scripts = scriptInventory(html).map(({ src }) => src);
  const required = ['/vendor/jquery/jquery.min.js', '/vendor/bootstrap3/js/bootstrap.min.js', '/js/jquery.smooth-scroll.min.js', '/js/news-runtime.js'];
  let previous = -1;
  for (const src of required) {
    const index = scripts.indexOf(src);
    if (index < 0 || index <= previous) throw new Error(`NEWS runtime order changed in ${file}: ${src}`);
    previous = index;
  }
  if (scripts.filter((src) => src === '/js/news-runtime.js').length !== 1) throw new Error(`NEWS runtime count changed in ${file}`);
}
