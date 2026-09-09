import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const helpUrl = 'https://support.speed-ad.com/help/';

test('SPEED AD page exposes the approved HELP route without replacing primary CTAs', () => {
  const html = read('_site/speed-ad.html');

  assert.match(html, /<h1>SPEED AD<\/h1>/);
  assert.match(html, /展示会向けWEBアンケート作成サービス/);
  assert.match(html, new RegExp(`href="${helpUrl.replaceAll('/', '\\/')}"[^>]*target="_blank"[^>]*rel="noopener noreferrer"`));
  assert.match(html, />SPEED ADのヘルプを見る<\/a>/);
  assert.equal(html.split(helpUrl).length - 1, 1, 'HELP URL must appear exactly once');
  assert.doesNotMatch(html, new RegExp(`<iframe[^>]+${helpUrl.replaceAll('/', '\\/')}`, 'i'));
  assert.match(html, /href="https:\/\/speed-ad\.com\/\?intent=signup#top"/);
  assert.match(html, /href="form\.html\?service=speed-ad"/);
});

test('legacy and modern service menus use the service name', () => {
  for (const template of [
    'site/_includes/partials/header-legacy.njk',
    'site/_includes/partials/header-modern.njk'
  ]) {
    const source = read(template);
    assert.match(source, /href="\/speed-ad\.html">SPEED AD<\/a>/, `${template} must use SPEED AD`);
    assert.doesNotMatch(source, /href="\/speed-ad\.html">WEBアンケート作成サービス<\/a>/);
  }
});
