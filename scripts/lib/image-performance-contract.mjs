import { parse } from 'parse5';

export function imageDimensions(buffer, label = 'image') {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(pngSignature) && buffer.toString('ascii', 12, 16) === 'IHDR') {
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 3 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset];
      offset += 1;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (marker === 0xda) break;
      if (offset + 1 >= buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3)
        || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb)
        || (marker >= 0xcd && marker <= 0xcf);
      if (isStartOfFrame && length >= 7) {
        return [buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)];
      }
      offset += length;
    }
  }

  throw new Error(`Unsupported or invalid image format: ${label}`);
}

export function assertImageFileDimensions(buffer, width, height, label = 'image') {
  const [actualWidth, actualHeight] = imageDimensions(buffer, label);
  if (actualWidth !== Number(width) || actualHeight !== Number(height)) {
    throw new Error(`Image dimensions changed for ${label}: expected ${width}x${height}, found ${actualWidth}x${actualHeight}`);
  }
}

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

function preloadNodes(html) {
  const document = parse(html);
  const links = [];
  const visit = (node) => {
    if (node.nodeName === 'link') links.push(new Map((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value])));
    for (const child of node.childNodes || []) visit(child);
  };
  visit(document);
  return links;
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

export function assertTopImagePreloadContract(html, expected, label = 'HTML') {
  const matches = preloadNodes(html).filter((attrs) => {
    const relTokens = (attrs.get('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
    return relTokens.includes('preload') && attrs.get('href') === '/image/top1.webp';
  });
  if (!expected) {
    if (matches.length) throw new Error(`Unexpected top image preload in ${label}`);
    return;
  }
  if (matches.length !== 1) throw new Error(`Expected exactly one top image preload in ${label}, found ${matches.length}`);
  const attrs = matches[0];
  const relTokens = (attrs.get('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (relTokens.length !== 1 || relTokens[0] !== 'preload') {
    throw new Error(`Unexpected rel on top image preload in ${label}: ${attrs.get('rel') ?? '(missing)'}`);
  }
  for (const [name, value] of Object.entries({ as: 'image', type: 'image/webp', fetchpriority: 'high' })) {
    if (attrs.get(name) !== value) throw new Error(`Unexpected ${name} on top image preload in ${label}: ${attrs.get(name) ?? '(missing)'}`);
  }
}

export function assertTopImageCssContract(css, label = 'CSS') {
  const activeCss = css.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  if (!/:root\s*\{[^}]*--abroad-top-image\s*:\s*image-set\(\s*url\((?:"|')?image\/top1\.webp(?:"|')?\)\s+type\((?:"|')image\/webp(?:"|')\)\s+1x\s*,\s*url\((?:"|')?image\/top1\.png(?:"|')?\)\s+type\((?:"|')image\/png(?:"|')\)\s+1x\s*\)[^}]*\}/.test(activeCss)) {
    throw new Error(`Missing WebP image-set custom property in ${label}`);
  }
  const fallback = /background-image\s*:\s*url\(image\/top1\.png\)\s*;\s*background-image\s*:\s*var\(--abroad-top-image\)\s*;/g;
  const fallbackMatches = [...activeCss.matchAll(fallback)];
  const pngReferences = [...activeCss.matchAll(/background-image\s*:\s*url\(image\/top1\.png\)\s*;/g)];
  if (!pngReferences.length || fallbackMatches.length !== pngReferences.length) {
    throw new Error(`Every active PNG top image background must have a following WebP custom-property fallback in ${label}`);
  }
}

export function assertTopImageGradientCssContract(css, label = 'CSS') {
  const activeCss = css.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  const pngGradients = [...activeCss.matchAll(/background(?:-image)?\s*:\s*linear-gradient\([^;]+?\),\s*url\(image\/top1\.png\)\s*;/g)];
  const webpGradients = [...activeCss.matchAll(/background(?:-image)?\s*:\s*linear-gradient\([^;]+?\),\s*var\(--abroad-top-image\)\s*;/g)];
  if (pngGradients.length !== 2 || webpGradients.length !== 2) {
    throw new Error(`Expected two PNG/WebP gradient top image fallbacks in ${label}, found ${pngGradients.length}/${webpGradients.length}`);
  }
}

export function assertIntrinsicImageStyle(css, label = 'CSS') {
  if (!/\.image-intrinsic\s*\{[^}]*\bheight\s*:\s*auto\s*;[^}]*\}/.test(css)) {
    throw new Error(`Missing .image-intrinsic height:auto rule in ${label}`);
  }
}
