import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const fontFiles = [
  ['Crimson Text', 400, 'crimson-text-latin-400-normal.woff2', '@fontsource/crimson-text'],
  ['Roboto', 400, 'roboto-latin-400-normal.woff2', '@fontsource/roboto'],
  ['Roboto', 500, 'roboto-latin-500-normal.woff2', '@fontsource/roboto'],
  ['Roboto', 700, 'roboto-latin-700-normal.woff2', '@fontsource/roboto']
];
const fontStylesheet = '/css/fonts.css';
const unicodeRange = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

export function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

export function assertFontHtml(html, name) {
  if (/fonts\.(?:googleapis|gstatic)\.com/i.test(html)) throw new Error(`${name} references an external Google Font host.`);
  const links = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)]
    .filter(([tag]) => new RegExp(String.raw`\bhref=["']${fontStylesheet}["']`, 'i').test(tag));
  if (links.length !== 1) throw new Error(`${name} must load ${fontStylesheet} exactly once.`);
}

export function assertFontCss(css) {
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => match[1]);
  if (faces.length !== fontFiles.length) throw new Error(`Expected ${fontFiles.length} local @font-face rules, found ${faces.length}.`);
  for (const [family, weight, file] of fontFiles) {
    const face = faces.find((candidate) => new RegExp(`font-family:\\s*['\"]${family}['\"]`).test(candidate) && new RegExp(`font-weight:\\s*${weight}(?:;|\\s)`).test(candidate));
    if (!face || !/font-style:\s*normal(?:;|\s)/.test(face) || !/font-display:\s*swap(?:;|\s)/.test(face) || !face.includes(`url('/fonts/google/${file}') format('woff2')`) || !face.includes(`unicode-range: ${unicodeRange};`)) {
      throw new Error(`Invalid local @font-face for ${family} ${weight}.`);
    }
  }
}

export function assertFontAssets(repoRoot, outputRoot) {
  for (const [, , file, packageName] of fontFiles) {
    const source = path.join(repoRoot, 'node_modules', packageName, 'files', file);
    const published = path.join(outputRoot, 'fonts', 'google', file);
    if (!fs.existsSync(source) || !fs.existsSync(published)) throw new Error(`Missing local font binary: ${file}`);
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    const publishedHash = crypto.createHash('sha256').update(fs.readFileSync(published)).digest('hex');
    if (sourceHash !== publishedHash) throw new Error(`Published font bytes do not match ${packageName}: ${file}`);
  }
  for (const [packageName, license] of [['@fontsource/crimson-text', 'crimson-text-OFL.txt'], ['@fontsource/roboto', 'roboto-OFL.txt']]) {
    const source = path.join(repoRoot, 'node_modules', packageName, 'LICENSE');
    const published = path.join(outputRoot, 'fonts', 'google', license);
    if (!fs.existsSync(source) || !fs.existsSync(published) || !fs.readFileSync(published).equals(fs.readFileSync(source))) throw new Error(`Missing or changed OFL license: ${license}`);
  }
}
