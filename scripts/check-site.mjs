import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
const sourceRoot = path.join(repoRoot, 'site', 'pages');
const publicContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'deploy', 'public-manifest.json'), 'utf8'));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(fullPath) : [fullPath];
    });
}

function publicPath(file) {
  return path.relative(outputRoot, file).replaceAll('\\', '/');
}

function buildManifest() {
  return walk(outputRoot)
    .map((file) => ({ path: publicPath(file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function manifestHash(manifest) {
  return crypto.createHash('sha256').update(`${JSON.stringify(manifest)}\n`).digest('hex');
}

function assertSame(expected, actual, label) {
  if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) {
    throw new Error(`${label} changed.\nExpected: ${expected.join(', ')}\nActual: ${actual.join(', ')}`);
  }
}

function verifyContract(manifest) {
  const sourcePages = walk(sourceRoot).filter((file) => file.endsWith('.njk'));
  if (sourcePages.length !== 47) throw new Error(`Expected 47 generated page sources, found ${sourcePages.length}`);

  const htmlFiles = manifest.filter(({ path: file }) => file.endsWith('.html'));
  if (!fs.existsSync(path.join(outputRoot, 'sitemap.xml')) || fs.existsSync(path.join(outputRoot, 'ap.xml'))) {
    throw new Error('sitemap.xml was not copied to the public root correctly.');
  }
  const generatedFiles = htmlFiles.filter(({ path: file }) => !file.startsWith('TOOL/') && !file.startsWith('pdfjs/') && file !== 'slick/largeformat.html');
  if (generatedFiles.length !== 47) throw new Error(`Expected 47 generated HTML files, found ${generatedFiles.length}`);

  const rootFiles = manifest.filter(({ path: file }) => !file.includes('/')).map(({ path: file }) => file);
  assertSame([...publicContract.managedRootFiles].sort(), rootFiles, 'Public root manifest');
  const rootDirectories = [...new Set(manifest.filter(({ path: file }) => file.includes('/')).map(({ path: file }) => file.split('/', 1)[0]))].sort();
  assertSame([...publicContract.managedDirectories].sort(), rootDirectories, 'Managed public directories');

  for (const { path: file } of generatedFiles) {
    const html = fs.readFileSync(path.join(outputRoot, file), 'utf8');
    if (!/<title>[^<]+<\/title>/i.test(html)) throw new Error(`Missing title: ${file}`);
    if (!/<link\s+rel=["']canonical["']/i.test(html)) throw new Error(`Missing canonical: ${file}`);
    for (const value of publicContract.forbiddenReferences) {
      if (html.includes(value)) throw new Error(`Forbidden legacy reference ${value}: ${file}`);
    }
  }

  const missingLinks = [];
  for (const { path: file } of htmlFiles) {
    const html = fs.readFileSync(path.join(outputRoot, file), 'utf8');
    for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
      const raw = match[1];
      if (/^(?:https?:|mailto:|tel:|javascript:|data:|#|\/\/)/i.test(raw)) continue;
      const clean = raw.split(/[?#]/, 1)[0];
      if (!clean) continue;
      const target = clean.startsWith('/') ? path.join(outputRoot, clean.slice(1)) : path.resolve(path.dirname(path.join(outputRoot, file)), clean);
      if (!fs.existsSync(target)) missingLinks.push(`${file} -> ${raw}`);
    }
  }
  if (missingLinks.length) throw new Error(`Missing local links:\n${missingLinks.join('\n')}`);
}

const firstManifest = buildManifest();
verifyContract(firstManifest);
execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'build-site.mjs')], { cwd: repoRoot, stdio: 'inherit' });
const secondManifest = buildManifest();
verifyContract(secondManifest);
const firstHash = manifestHash(firstManifest);
const secondHash = manifestHash(secondManifest);
if (firstHash !== secondHash) {
  const firstByPath = new Map(firstManifest.map((entry) => [entry.path, entry.sha256]));
  const secondByPath = new Map(secondManifest.map((entry) => [entry.path, entry.sha256]));
  const changed = [...new Set([...firstByPath.keys(), ...secondByPath.keys()])]
    .filter((file) => firstByPath.get(file) !== secondByPath.get(file));
  throw new Error(`Site build is not deterministic: ${firstHash} != ${secondHash}\nChanged paths:\n${changed.join('\n')}`);
}

console.log(`Site check passed: 47 generated pages, ${firstManifest.filter(({ path: file }) => file.endsWith('.html')).length} total HTML files.`);
console.log(`Public manifest SHA-256: ${secondHash}`);
