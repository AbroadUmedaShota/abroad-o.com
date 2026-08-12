import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
const sourceRoot = path.join(repoRoot, 'site', 'pages');
const publicContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'deploy', 'public-manifest.json'), 'utf8'));
const defaultOgImageUrl = 'https://www.abroad-o.com/image/top1.png';
const defaultOgImagePath = path.join(outputRoot, 'image', 'top1.png');
const defaultOgImageWidth = 1990;
const defaultOgImageHeight = 810;

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

function metaValues(html, attribute, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...html.matchAll(new RegExp(`<meta\\s+${attribute}=["']${escaped}["']\\s+content=["']([^"']*)["']`, 'gi'))].map((match) => match[1]);
}

function assertSingleMeta(html, attribute, name, expected, file) {
  const values = metaValues(html, attribute, name);
  if (values.length !== 1 || (expected !== undefined && values[0] !== expected)) {
    throw new Error(`Unexpected ${name} metadata in ${file}: ${JSON.stringify(values)}`);
  }
}

function pngDimensions(file) {
  const png = fs.readFileSync(file);
  if (png.toString('ascii', 1, 4) !== 'PNG' || png.readUInt32BE(12) !== 0x49484452) {
    throw new Error(`Expected PNG image: ${file}`);
  }
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

function verifyRedirectContract() {
  const htaccess = fs.readFileSync(path.join(repoRoot, '.htaccess'), 'utf8');
  const canonicalRedirect = htaccess.indexOf('https://www.abroad-o.com/$1');
  const rootIndexRedirect = htaccess.indexOf('RewriteRule ^index(?:\\.html)?$ https://www.abroad-o.com/');
  const extensionlessRewrite = htaccess.indexOf('RewriteCond %{REQUEST_FILENAME}\\.html -f');
  if (rootIndexRedirect < 0 || canonicalRedirect < 0 || extensionlessRewrite < 0 || rootIndexRedirect > canonicalRedirect || canonicalRedirect > extensionlessRewrite) {
    throw new Error('.htaccess must canonicalize before extensionless rewrites.');
  }
  if (/RewriteRule[^\r\n]*https:\/\/[^\r\n]*%\{HTTP_HOST\}/i.test(htaccess)) {
    throw new Error('.htaccess must use the hardcoded canonical host and redirect root index documents.');
  }
}

function verifyContract(manifest) {
  const sourcePages = walk(sourceRoot).filter((file) => file.endsWith('.njk'));
  if (sourcePages.length !== 47) throw new Error(`Expected 47 generated page sources, found ${sourcePages.length}`);

  const htmlFiles = manifest.filter(({ path: file }) => file.endsWith('.html'));
  if (!fs.existsSync(path.join(outputRoot, 'sitemap.xml')) || !fs.existsSync(path.join(outputRoot, 'robots.txt')) || fs.existsSync(path.join(outputRoot, 'ap.xml'))) {
    throw new Error('Generated sitemap.xml or robots.txt is missing from the public root.');
  }
  const generatedFiles = htmlFiles.filter(({ path: file }) => file !== 'slick/largeformat.html');
  if (generatedFiles.length !== 47) throw new Error(`Expected 47 generated HTML files, found ${generatedFiles.length}`);

  const rootFiles = manifest.filter(({ path: file }) => !file.includes('/')).map(({ path: file }) => file);
  assertSame([...publicContract.managedRootFiles].sort(), rootFiles, 'Public root manifest');
  const rootDirectories = [...new Set(manifest.filter(({ path: file }) => file.includes('/')).map(({ path: file }) => file.split('/', 1)[0]))].sort();
  assertSame([...publicContract.managedDirectories].sort(), rootDirectories, 'Managed public directories');

  const expectedPdfs = [
    ['pdfjs/1c_abroad.pdf', 730670, 'b04b9773ab78143e3e58450d888a984eb4a2c03dcd6010344d606974b74a39c9'],
    ['pdfjs/2c_abroad.pdf', 6180052, '5617f03865319d34c6b055850638c1f1b87bf2cfc2cf2189dad58fed79c7cc2b'],
    ['pdfjs/4c_abroad.pdf', 6604538, '2531be1bb4bff62b5106cdf634aa92b5b05533e49af764c53070d8b00793ac0c']
  ];
  const actualPdfs = manifest.filter(({ path: file }) => file.startsWith('pdfjs/'));
  assertSame(expectedPdfs.map(([file]) => file), actualPdfs.map(({ path: file }) => file), 'Published PDF paths');
  for (const [file, bytes, sha256] of expectedPdfs) {
    const pdf = path.join(outputRoot, file);
    if (fs.statSync(pdf).size !== bytes) throw new Error(`Unexpected PDF byte size: ${file}`);
    const actualSha256 = crypto.createHash('sha256').update(fs.readFileSync(pdf)).digest('hex');
    if (actualSha256 !== sha256) throw new Error(`Unexpected PDF SHA-256: ${file}`);
  }
  if (htmlFiles.some(({ path: file }) => file.startsWith('TOOL/') || file.startsWith('pdfjs/'))) {
    throw new Error('TOOL or PDF viewer HTML was published.');
  }

  const sitemap = fs.readFileSync(path.join(outputRoot, 'sitemap.xml'), 'utf8');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (sitemap.includes('<lastmod>') || sitemapUrls.includes('https://www.abroad-o.com/index.html') || new Set(sitemapUrls).size !== sitemapUrls.length) {
    throw new Error('Sitemap must contain unique canonical URLs without timestamps or index.html.');
  }
  if (!fs.existsSync(defaultOgImagePath)) throw new Error('Default OG image is not published.');
  const [ogImageWidth, ogImageHeight] = pngDimensions(defaultOgImagePath);
  if (ogImageWidth !== defaultOgImageWidth || ogImageHeight !== defaultOgImageHeight) {
    throw new Error(`Unexpected default OG image dimensions: ${ogImageWidth}x${ogImageHeight}`);
  }
  const robots = fs.readFileSync(path.join(outputRoot, 'robots.txt'), 'utf8');
  if (!/^User-agent: \*\r?\nDisallow:\s*\r?\n\r?\nSitemap: https:\/\/www\.abroad-o\.com\/sitemap\.xml\s*$/i.test(robots)) {
    throw new Error('robots.txt does not permit crawling or point at the canonical sitemap.');
  }

  const indexableCanonicalUrls = [];
  for (const { path: file } of generatedFiles) {
    const html = fs.readFileSync(path.join(outputRoot, file), 'utf8');
    const titles = [...html.matchAll(/<title>([^<]+)<\/title>/gi)];
    if (titles.length !== 1) throw new Error(`Expected exactly one title: ${file}`);
    const canonicalUrls = [...html.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/gi)].map((match) => match[1]);
    const expectedCanonicalUrl = file === 'index.html' ? 'https://www.abroad-o.com/' : `https://www.abroad-o.com/${file}`;
    if (canonicalUrls.length !== 1 || canonicalUrls[0] !== expectedCanonicalUrl) {
      throw new Error(`Unexpected canonical URL in ${file}: ${JSON.stringify(canonicalUrls)}`);
    }
    const expectedOgType = file.startsWith('news/') ? 'article' : 'website';
    assertSingleMeta(html, 'property', 'og:title', undefined, file);
    assertSingleMeta(html, 'property', 'og:description', undefined, file);
    assertSingleMeta(html, 'property', 'og:type', expectedOgType, file);
    assertSingleMeta(html, 'property', 'og:url', expectedCanonicalUrl, file);
    assertSingleMeta(html, 'property', 'og:image', defaultOgImageUrl, file);
    assertSingleMeta(html, 'property', 'og:image:width', String(ogImageWidth), file);
    assertSingleMeta(html, 'property', 'og:image:height', String(ogImageHeight), file);
    assertSingleMeta(html, 'name', 'twitter:card', 'summary_large_image', file);
    assertSingleMeta(html, 'name', 'twitter:title', undefined, file);
    assertSingleMeta(html, 'name', 'twitter:description', undefined, file);
    assertSingleMeta(html, 'name', 'twitter:image', defaultOgImageUrl, file);
    const noindex = metaValues(html, 'name', 'robots');
    if (file === 'thank.html') {
      if (noindex.length !== 1 || noindex[0] !== 'noindex' || sitemapUrls.includes(expectedCanonicalUrl)) throw new Error('thank.html must be noindex and absent from the sitemap.');
    } else {
      if (noindex.length !== 0) throw new Error(`Unexpected noindex: ${file}`);
      indexableCanonicalUrls.push(expectedCanonicalUrl);
    }
    for (const value of publicContract.forbiddenReferences) {
      if (html.includes(value)) throw new Error(`Forbidden legacy reference ${value}: ${file}`);
    }
  }
  assertSame(indexableCanonicalUrls.sort(), sitemapUrls.sort(), 'Sitemap canonical URL set');
  if (indexableCanonicalUrls.length !== 46) throw new Error(`Expected 46 indexable pages, found ${indexableCanonicalUrls.length}`);
  verifyRedirectContract();

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
