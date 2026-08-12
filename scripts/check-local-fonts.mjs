import fs from 'node:fs';
import path from 'node:path';
import { assertFontAssets, assertFontCss, assertFontHtml, walk } from './lib/local-font-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const pages = walk(output).filter((file) => file.endsWith('.html'));
if (pages.length !== 48) throw new Error(`Expected 48 public HTML pages, found ${pages.length}.`);
for (const page of pages) assertFontHtml(fs.readFileSync(page, 'utf8'), path.relative(output, page));
assertFontCss(fs.readFileSync(path.join(output, 'css', 'fonts.css'), 'utf8'));
assertFontAssets(root, output);
console.log(`Local font static contract passed: ${pages.length} generated pages, 4 WOFF2 files, 2 OFL licenses.`);
