import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
const sourceRoot = path.join(repoRoot, 'site', 'pages');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function publicPath(file) {
  return path.relative(outputRoot, file).replaceAll('\\', '/');
}

function manifestHash() {
  const hash = crypto.createHash('sha256');
  for (const file of walk(outputRoot).sort()) {
    hash.update(publicPath(file));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

const sourcePages = walk(sourceRoot).filter((file) => file.endsWith('.njk'));
if (sourcePages.length !== 47) {
  throw new Error(`Expected 47 generated page sources, found ${sourcePages.length}`);
}

const htmlFiles = walk(outputRoot).filter((file) => file.endsWith('.html'));
if (!fs.existsSync(path.join(outputRoot, 'sitemap.xml')) || fs.existsSync(path.join(outputRoot, 'ap.xml'))) {
  throw new Error('sitemap.xml was not copied to the public root correctly.');
}
const generatedFiles = htmlFiles.filter((file) => {
  const relative = publicPath(file);
  return !relative.startsWith('TOOL/') && !relative.startsWith('pdfjs/') && relative !== 'slick/largeformat.html';
});
if (generatedFiles.length !== 47) {
  throw new Error(`Expected 47 generated HTML files, found ${generatedFiles.length}`);
}

const forbidden = [
  'docs.google.com/forms',
  '1FAIpQLSducG_PN_pRRvNlEyEjI8RRUJbhFLKXPr--iopScCsDZhkZ9A',
  'id="myModal',
  'data-target="#myModal',
  'about.html#contact_up'
];

for (const file of generatedFiles) {
  const html = fs.readFileSync(file, 'utf8');
  if (!/<title>[^<]+<\/title>/i.test(html)) {
    throw new Error(`Missing title: ${publicPath(file)}`);
  }
  if (!/<link\s+rel=["']canonical["']/i.test(html)) {
    throw new Error(`Missing canonical: ${publicPath(file)}`);
  }
  for (const value of forbidden) {
    if (html.includes(value)) {
      throw new Error(`Forbidden legacy reference ${value}: ${publicPath(file)}`);
    }
  }
}

const missingLinks = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const raw = match[1];
    if (/^(?:https?:|mailto:|tel:|javascript:|data:|#|\/\/)/i.test(raw)) continue;
    const clean = raw.split(/[?#]/, 1)[0];
    if (!clean) continue;
    const target = clean.startsWith('/')
      ? path.join(outputRoot, clean.slice(1))
      : path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(target)) {
      missingLinks.push(`${publicPath(file)} -> ${raw}`);
    }
  }
}
if (missingLinks.length) {
  throw new Error(`Missing local links:\n${missingLinks.join('\n')}`);
}

const firstHash = manifestHash();
execFileSync(process.execPath, [path.join(repoRoot, 'node_modules', '@11ty', 'eleventy', 'cmd.cjs')], {
  cwd: repoRoot,
  stdio: 'inherit'
});
const secondHash = manifestHash();
if (firstHash !== secondHash) {
  throw new Error(`Site build is not deterministic: ${firstHash} != ${secondHash}`);
}

console.log(`Site check passed: ${generatedFiles.length} generated pages, ${htmlFiles.length} total HTML files.`);
console.log(`Deterministic manifest SHA-256: ${secondHash}`);
