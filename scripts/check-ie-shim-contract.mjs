import fs from 'node:fs';
import path from 'node:path';
import { assertNoIeCompatibilityShims } from './lib/ie-shim-contract.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(repoRoot, 'site', 'pages');
const outputRoot = path.join(repoRoot, '_site');
const passthrough = 'slick/largeformat.html';

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const sourceTemplates = walk(sourceRoot).filter((file) => file.endsWith('.njk'));
if (sourceTemplates.length !== 47) throw new Error(`Expected 47 generated page sources, found ${sourceTemplates.length}`);

const sourceEntrypoints = sourceTemplates.map((file) => ({
  label: path.relative(repoRoot, file).replaceAll('\\', '/'),
  file,
  publicPath: path.relative(sourceRoot, file).replace(/\.njk$/, '').replaceAll('\\', '/')
}));
sourceEntrypoints.push({
  label: passthrough,
  file: path.join(repoRoot, passthrough),
  publicPath: passthrough
});

if (sourceEntrypoints.length !== 48) throw new Error(`Expected 48 source public HTML entrypoints, found ${sourceEntrypoints.length}`);
for (const entrypoint of sourceEntrypoints) {
  assertNoIeCompatibilityShims(fs.readFileSync(entrypoint.file, 'utf8'), entrypoint.label);
}

const publicHtml = walk(outputRoot).filter((file) => file.endsWith('.html'));
if (publicHtml.length !== 48) throw new Error(`Expected 48 public HTML entrypoints, found ${publicHtml.length}`);
const publicPaths = new Set(publicHtml.map((file) => path.relative(outputRoot, file).replaceAll('\\', '/')));
for (const entrypoint of sourceEntrypoints) {
  if (!publicPaths.has(entrypoint.publicPath)) throw new Error(`Missing public HTML entrypoint: ${entrypoint.publicPath}`);
}
for (const file of publicHtml) {
  assertNoIeCompatibilityShims(fs.readFileSync(file, 'utf8'), path.relative(outputRoot, file).replaceAll('\\', '/'));
}

console.log('IE shim contract passed: 48 source/public HTML entrypoints contain no IE conditional comments or retired IE shims.');
