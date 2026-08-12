import { parse } from 'parse5';

function imageNodes(html) {
  const document = parse(html);
  const images = [];
  const visit = (node) => {
    if (node.nodeName === 'img') images.push(new Map((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value])));
    for (const child of node.childNodes || []) visit(child);
  };
  visit(document);
  return images;
}

function assertAttribute(actual, expected, name, src, label) {
  if (expected === null) {
    if (actual.has(name)) throw new Error(`Unexpected ${name} on ${src} in ${label}: ${actual.get(name)}`);
    return;
  }
  if (actual.get(name) !== expected) throw new Error(`Unexpected ${name} on ${src} in ${label}: ${actual.get(name) ?? '(missing)'}`);
}

export function assertImagePerformanceContract(html, expectations, label = 'HTML') {
  const images = imageNodes(html);
  let previousIndex = -1;
  for (const expectation of expectations) {
    const matches = images.map((attrs, index) => ({ attrs, index })).filter(({ attrs }) => attrs.get('src') === expectation.src);
    if (matches.length !== 1) throw new Error(`Expected exactly one image for ${expectation.src} in ${label}, found ${matches.length}`);
    const { attrs, index } = matches[0];
    if (index <= previousIndex) throw new Error(`Image order changed for ${expectation.src} in ${label}`);
    previousIndex = index;
    for (const name of ['alt', 'class', 'width', 'height', 'decoding', 'loading', 'fetchpriority']) {
      assertAttribute(attrs, expectation[name] ?? null, name, expectation.src, label);
    }
  }
}

export function assertIntrinsicImageStyle(css, label = 'CSS') {
  if (!/\.image-intrinsic\s*\{[^}]*\bheight\s*:\s*auto\s*;[^}]*\}/.test(css)) {
    throw new Error(`Missing .image-intrinsic height:auto rule in ${label}`);
  }
}
