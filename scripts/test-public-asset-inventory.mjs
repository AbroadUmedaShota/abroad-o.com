import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPublicAssetInventory, stableInventoryJson } from './lib/public-asset-inventory.mjs';

const manifest = { managedDirectories: ['css', 'image', 'js', 'slick'], managedRootFiles: ['about.html', 'index.html', 'style.css'] };
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abroad-assets-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}
function inventory(files, protectedPaths = [], options = {}) {
  const root = fixture(files);
  try { return createPublicAssetInventory({ outputRoot: root, publicManifest: manifest, protectedPaths, commit: 'test-commit', historyCompleteness: 'full', ...options }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('creates a stable no-delete inventory across HTML CSS and JavaScript references', () => {
  const files = {
    'index.html': '<link href="style.css"><img src="image/a.png" srcset="image/a.png 1x"><script src="js/app.js"></script>',
    'style.css': '@import "css/base.css"; .x{background:url(image/b.png)}',
    'css/base.css': '.x{background:url(../image/c.png)}',
    'js/app.js': 'import "../css/base.css"; const logo = "../image/d.png";',
    'image/a.png': 'a', 'image/b.png': 'b', 'image/c.png': 'c', 'image/d.png': 'd'
  };
  const first = inventory(files);
  const second = inventory(files);
  assert.equal(stableInventoryJson(first), stableInventoryJson(second));
  assert.ok(first.assets.every((asset) => asset.deletionEligible === false));
  assert.equal(first.assets.find((asset) => asset.path === 'image/a.png').classification, 'reachable');
  assert.deepEqual(Object.keys(first).filter((key) => ['commit', 'scanScope', 'historyCompleteness', 'summary'].includes(key)).sort(), ['commit', 'historyCompleteness', 'scanScope', 'summary']);
  assert.equal(first.commit, 'test-commit');
  assert.equal(first.historyCompleteness, 'full');
  assert.equal(first.uncertainties.some((item) => item.type === 'history-partial'), false);
  assert.ok(first.uncertainties.some((item) => item.type === 'access-logs-not-reviewed'));
  assert.deepEqual(first.summary, { entrypoints: 1, protected: 0, reachable: 7, staticUnreferenced: 0, uncertainties: 1, deletionEligible: 0 });
});

for (const [name, files, expected] of [
  ['missing HTML target', { 'index.html': '<img src="image/missing.png">', 'style.css': '' }, /missing local file/],
  ['missing HTML srcset target', { 'index.html': '<img srcset="image/missing.png 1x">', 'style.css': '' }, /missing local file/],
  ['missing form action target', { 'index.html': '<form action="missing"><button>送信</button></form>', 'style.css': '' }, /missing local file/],
  ['missing object data target', { 'index.html': '<object data="image/missing.png"></object>', 'style.css': '' }, /missing local file/],
  ['root escape', { 'index.html': '<img src="../secret.png">', 'style.css': '' }, /escapes the root/],
  ['percent decoded root escape', { 'index.html': '<img src="%2e%2e/secret.png">', 'style.css': '' }, /escapes the root/],
  ['invalid percent encoding', { 'index.html': '<img src="image/%ZZ.png">', 'style.css': '' }, /Invalid percent-encoded/],
  ['windows drive path', { 'index.html': '<img src="C:\\secret.png">', 'style.css': '' }, /Windows drive and backslash/],
  ['UNC path', { 'index.html': '<img src="\\\\server\\share.png">', 'style.css': '' }, /Windows drive and backslash/],
  ['unmanaged target', { 'index.html': '<a href="docs/readme.txt">x</a>', 'style.css': '' }, /unmanaged path/],
  ['missing CSS url target', { 'index.html': '<link href="style.css">', 'style.css': '.x{background:url(image/missing.png)}' }, /missing local file/],
  ['missing CSS import target', { 'index.html': '<link href="style.css">', 'style.css': '@import "css/missing.css";' }, /missing local file/],
  ['missing CSS image-set quoted target', { 'index.html': '<link href="style.css">', 'style.css': '.x{background:image-set("image/missing.webp" 1x)}' }, /missing local file/],
  ['missing JavaScript import target', { 'index.html': '<script src="js/app.js"></script>', 'style.css': '', 'js/app.js': 'import "../image/missing.png";' }, /missing local file/],
  ['missing dynamic import target', { 'index.html': '<script src="js/app.js"></script>', 'style.css': '', 'js/app.js': 'import("../image/missing.png");' }, /missing local file/],
  ['missing extensionless import target', { 'index.html': '<script src="js/app.js"></script>', 'style.css': '', 'js/app.js': 'import("../image/missing");' }, /missing local file/],
  ['missing JavaScript fixed target', { 'index.html': '<script src="js/app.js"></script>', 'style.css': '', 'js/app.js': 'const value = "../image/missing.png";' }, /missing local file/],
  ['case mismatch', { 'index.html': '<img src="image/Logo.png">', 'style.css': '', 'image/logo.png': 'logo' }, /missing local file/]
]) test(`rejects ${name}`, () => assert.throws(() => inventory(files), expected));

test('normalizes query/hash and extensionless public page URLs', () => {
  const result = inventory({
    'index.html': '<a href="/about?campaign=1#main">about</a><a href="about">relative</a>',
    'about.html': '<a href="/">home</a>',
    'style.css': ''
  });
  assert.equal(result.assets.find((asset) => asset.path === 'about.html').classification, 'entrypoint');
  assert.equal(result.assets.find((asset) => asset.path === 'index.html').classification, 'entrypoint');
});

test('resolves static extensionless imports and legacy HTML image attributes', () => {
  const result = inventory({
    'index.html': '<script src="js/app.js"></script><div data-background="image/a.png" data-bg="image/a.png" data-url="image/a.png" data-image="image/a.png" background="image/a.png"></div>',
    'style.css': '', 'js/app.js': 'import("./module")', 'js/module.js': '', 'image/a.png': 'a'
  });
  assert.equal(result.assets.find((asset) => asset.path === 'js/module.js').classification, 'reachable');
});

test('ignores quoted external and data URLs before and after normalization', () => {
  assert.doesNotThrow(() => inventory({
    'index.html': '<a href="https://example.com/a.png">x</a><img src="data:image/png;base64,x"><img src="//example.com/a.png">',
    'style.css': '.x{background:url("https://example.com/a.png"); mask-image:url("data:image/svg+xml,x")}'
  }));
});

test('treats every public HTML file including slick/largeformat as a direct entrypoint', () => {
  const result = inventory({ 'index.html': '', 'slick/largeformat.html': '', 'style.css': '' });
  assert.equal(result.assets.find((asset) => asset.path === 'slick/largeformat.html').classification, 'entrypoint');
  assert.equal(result.summary.entrypoints, 2);
});

test('records a reachable missing source map as a non-runtime uncertainty', () => {
  const result = inventory({ 'index.html': '<link href="style.css">', 'style.css': '/*# sourceMappingURL=css/missing.css.map */' });
  assert.ok(result.uncertainties.some((item) => item.type === 'missing-source-map'));
  assert.ok(result.assets.every((asset) => asset.deletionEligible === false));
});

test('records a missing reference from static-unreferenced source without weakening reachable checks', () => {
  const result = inventory({ 'index.html': '', 'style.css': '', 'css/orphan.css': '.x{background:url(../image/missing.png)}' });
  assert.equal(result.assets.find((asset) => asset.path === 'css/orphan.css').classification, 'static-unreferenced');
  assert.ok(result.uncertainties.some((item) => item.type === 'unreachable-source-missing-reference'));
});

test('validates protected bytes and SHA-256', () => {
  const sha256 = crypto.createHash('sha256').update('a').digest('hex');
  assert.doesNotThrow(() => inventory({ 'index.html': '', 'style.css': '', 'image/a.png': 'a' }, [{ path: 'image/a.png', bytes: 1, sha256 }]));
  assert.throws(() => inventory({ 'index.html': '', 'style.css': '', 'image/a.png': 'a' }, [{ path: 'image/a.png', bytes: 2, sha256 }]), /bytes changed/);
  assert.throws(() => inventory({ 'index.html': '', 'style.css': '', 'image/a.png': 'a' }, [{ path: 'image/a.png', bytes: 1, sha256: '0'.repeat(64) }]), /SHA-256 changed/);
});

test('marks protected paths and records dynamic references only for partial history', () => {
  const result = inventory({ 'index.html': '<img src="{{ dynamic }}"><button onclick="location.href = \'/image/\' + name">go</button>', 'style.css': '', 'image/a.png': 'a' }, [{ path: 'image/a.png' }], { historyCompleteness: 'partial' });
  assert.equal(result.assets.find((asset) => asset.path === 'image/a.png').classification, 'protected');
  assert.ok(result.uncertainties.some((item) => item.type === 'dynamic-reference'));
  assert.ok(result.uncertainties.some((item) => item.type === 'inline-event-handler'));
  assert.ok(result.uncertainties.some((item) => item.type === 'history-partial'));
  assert.ok(result.uncertainties.some((item) => item.type === 'access-logs-not-reviewed'));
  assert.ok(result.uncertainties.some((item) => item.kind === 'js:concatenation'));
});

test('records template prefix dynamic JavaScript without treating it as a fixed URL', () => {
  const result = inventory({ 'index.html': '<script src="js/app.js"></script>', 'style.css': '', 'js/app.js': 'const path = `/image/${name}.png`;' });
  assert.ok(result.uncertainties.some((item) => item.kind === 'js:template'));
});

test('uses required scan metadata and marks all assets no-delete', () => {
  const result = inventory({ 'index.html': '', 'style.css': '' });
  assert.equal(result.scanScope.entrypoints, 'all .html files including slick/largeformat.html');
  assert.equal(result.summary.deletionEligible, 0);
  assert.ok(result.assets.every((asset) => asset.deletionEligible === false));
});
