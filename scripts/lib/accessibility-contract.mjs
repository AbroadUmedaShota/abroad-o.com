import { parse } from 'parse5';

const genericAlt = /^(?:画像|ロゴ|写真)$/iu;
const imageExtension = /\.(?:png|jpe?g|gif|webp|svg)$/iu;
const genericEnglishStem = /^(?:photo|data|input|mini|top|service|pack|profile|rogo|font|pmark|c)(?:\s+(?:img|box|pic))?(?:[\s_-]*\d+)?$/iu;

function walk(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) walk(child, callback);
}

function attributes(node) {
  return new Map((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value]));
}

export function assertAccessibilityContract(html, label = 'document', { checkHeadingOrder = true } = {}) {
  const parserErrors = [];
  const document = parse(html, { onParseError: (error) => parserErrors.push(error) });
  const ids = new Set();
  const headings = [];
  const errors = [];
  if (parserErrors.some(({ code }) => code === 'duplicate-attribute')) errors.push('duplicate attribute');
  walk(document, (node) => {
    if (!node.tagName) return;
    const attrs = attributes(node);
    if (attrs.has('id')) {
      const id = attrs.get('id');
      if (ids.has(id)) errors.push(`duplicate id ${id}`);
      ids.add(id);
    }
    if (/^h[1-6]$/.test(node.tagName)) headings.push(Number(node.tagName[1]));
    if (node.tagName === 'a') {
      const href = attrs.get('href')?.trim();
      if (!href) errors.push('anchor without a non-empty href');
      else if ((href === '#' && attrs.get('id') !== 'page-top') || /^javascript:/iu.test(href)) errors.push(`unsafe anchor href ${href}`);
    }
    if (attrs.get('target') === '_blank') {
      const rel = new Set((attrs.get('rel') || '').toLowerCase().split(/\s+/).filter(Boolean));
      if (!rel.has('noopener') || !rel.has('noreferrer')) errors.push('target=_blank without noopener noreferrer');
    }
    if (node.tagName === 'img') {
      const alt = attrs.get('alt');
      const srcBase = (attrs.get('src') || '').split(/[?#]/, 1)[0].split('/').pop() || '';
      const normalizedSrc = srcBase.replace(imageExtension, '').replace(/[._-]+/gu, ' ').trim();
      const normalizedAlt = alt?.trim().replace(imageExtension, '').replace(/[._-]+/gu, ' ').trim();
      if (alt === undefined || (normalizedAlt && (genericAlt.test(normalizedAlt) || genericEnglishStem.test(normalizedAlt) || normalizedAlt.toLocaleLowerCase() === normalizedSrc.toLocaleLowerCase()))) errors.push('missing, generic, or filename image alt');
    }
  });
  walk(document, (node) => {
    if (!node.tagName) return;
    const controls = attributes(node).get('aria-controls');
    for (const control of controls?.trim().split(/[\t\n\f\r ]+/u).filter(Boolean) || []) {
      if (!ids.has(control)) errors.push(`unresolved aria-controls ${control}`);
    }
  });
  if (headings.filter((level) => level === 1).length !== 1) errors.push('expected exactly one h1');
  if (checkHeadingOrder) for (let index = 1; index < headings.length; index += 1) {
    if (headings[index] > headings[index - 1] + 1) errors.push(`heading level skipped from h${headings[index - 1]} to h${headings[index]}`);
  }
  if (errors.length) throw new Error(`${label}: ${[...new Set(errors)].join('; ')}`);
}
