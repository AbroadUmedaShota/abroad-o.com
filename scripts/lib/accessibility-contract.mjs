import { parse } from 'parse5';

const genericAlt = /^(?:画像|ロゴ|写真)$/iu;
const filenameAlt = /(?:^|\s)(?:[\w-]+\.(?:png|jpe?g|gif|webp|svg))(?:\s|$)/iu;

function walk(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) walk(child, callback);
}

function attributes(node) {
  return new Map((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value]));
}

export function assertAccessibilityContract(html, label = 'document', { checkHeadingOrder = true } = {}) {
  const document = parse(html);
  const ids = new Set();
  const headings = [];
  const errors = [];
  walk(document, (node) => {
    if (!node.tagName) return;
    const attrs = attributes(node);
    if (attrs.has('id')) ids.add(attrs.get('id'));
    if (/^h[1-6]$/.test(node.tagName)) headings.push(Number(node.tagName[1]));
    if (node.tagName === 'a' && !attrs.get('href')?.trim()) errors.push('anchor without a non-empty href');
    if (attrs.get('target') === '_blank') {
      const rel = new Set((attrs.get('rel') || '').toLowerCase().split(/\s+/).filter(Boolean));
      if (!rel.has('noopener') || !rel.has('noreferrer')) errors.push('target=_blank without noopener noreferrer');
    }
    if (node.tagName === 'img') {
      const alt = attrs.get('alt');
      if (alt === undefined || genericAlt.test(alt.trim()) || filenameAlt.test(alt.trim())) errors.push('missing, generic, or filename image alt');
    }
  });
  walk(document, (node) => {
    if (!node.tagName) return;
    const controls = attributes(node).get('aria-controls');
    if (controls && !ids.has(controls)) errors.push(`unresolved aria-controls ${controls}`);
  });
  if (headings.filter((level) => level === 1).length !== 1) errors.push('expected exactly one h1');
  if (checkHeadingOrder) for (let index = 1; index < headings.length; index += 1) {
    if (headings[index] > headings[index - 1] + 1) errors.push(`heading level skipped from h${headings[index - 1]} to h${headings[index]}`);
  }
  if (errors.length) throw new Error(`${label}: ${[...new Set(errors)].join('; ')}`);
}
