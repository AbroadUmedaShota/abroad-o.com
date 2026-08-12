import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPublicAssetInventory, stableInventoryJson } from './lib/public-asset-inventory.mjs';

const manifest = { managedDirectories: ['css', 'image', 'js'], managedRootFiles: ['index.html', 'style.css'] };
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abroad-assets-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}
function inventory(files, protectedPaths = []) {
  const root = fixture(files);
  try { return createPublicAssetInventory({ outputRoot: root, publicManifest: manifest, protectedPaths }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
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
});

for (const [name, files, expected] of [
  ['missing HTML target', { 'index.html': '<img src="image/missing.png">', 'style.css': '' }, /missing local file/],
  ['missing HTML srcset target', { 'index.html': '<img srcset="image/missing.png 1x">', 'style.css': '' }, /missing local file/],
  ['root escape', { 'index.html': '<img src="../secret.png">', 'style.css': '' }, /escapes the root/],
  ['unmanaged target', { 'index.html': '<a href="docs/readme.txt">x</a>', 'style.css': '' }, /unmanaged path/],
  ['missing CSS url target', { 'index.html': '<link href="style.css">', 'style.css': '.x{background:url(image/missing.png)}' }, /missing local file/],
  ['missing CSS import target', { 'index.html': '<link href="style.css">', 'style.css': '@import "css/missing.css";' }, /missing local file/],
  ['missing JavaScript import target', { 'index.html': '<script src="js/app.js"></script>', 'style.css': '', 'js/app.js': 'import "../image/missing.png";' }, /missing local file/],
  ['missing JavaScript fixed target', { 'index.html': '<script src="js/app.js"></script>', 'style.css': '', 'js/app.js': 'const value = "../image/missing.png";' }, /missing local file/]
]) test(`rejects ${name}`, () => assert.throws(() => inventory(files), expected));

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

test('marks protected paths and records dynamic and history uncertainties', () => {
  const result = inventory({ 'index.html': '<img src="{{ dynamic }}">', 'style.css': '', 'image/a.png': 'a' }, [{ path: 'image/a.png' }]);
  assert.equal(result.assets.find((asset) => asset.path === 'image/a.png').classification, 'protected');
  assert.ok(result.uncertainties.some((item) => item.type === 'dynamic-reference'));
  assert.ok(result.uncertainties.some((item) => item.type === 'history-shallow'));
});
