import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';

const root = path.resolve(import.meta.dirname, '..', 'site', 'pages');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
function text(node) {
  return (node.childNodes || []).map((child) => child.value || text(child)).join('').replace(/\s+/g, ' ').trim();
}
function headings(node, result = []) {
  if (/^h[1-6]$/.test(node.tagName || '')) result.push({ level: Number(node.tagName[1]), text: text(node) });
  for (const child of node.childNodes || []) headings(child, result);
  return result;
}

const skips = [];
for (const file of walk(root).filter((file) => file.endsWith('.njk'))) {
  const levels = headings(parse(fs.readFileSync(file, 'utf8')));
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index].level > levels[index - 1].level + 1) skips.push(`${path.relative(root, file).replaceAll('\\', '/')} | h${levels[index - 1].level} -> h${levels[index].level} | ${levels[index].text}`);
  }
}
console.log(`Heading skips: ${skips.length}`);
console.log(skips.join('\n'));
if (skips.length) process.exitCode = 1;
