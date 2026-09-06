import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { parse } from 'parse5';

const html = fs.readFileSync(new URL('../_site/scan.html', import.meta.url), 'utf8');
const nodes = [];
function visit(node) {
  nodes.push(node);
  for (const child of node.childNodes || []) visit(child);
}
visit(parse(html));
function text(node) {
  return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
}
const paragraphs = nodes.filter(n => n.tagName === 'p').map(text);
const rows = nodes.filter(n => n.tagName === 'tr').map(text).map(s => s.replace(/\s+/g, ' ').trim());
test('P1/P2: approved 200dpi cards and matching table rates', () => {
  assert.ok(paragraphs.includes('自動読取/A4サイズ/200dpi/白黒'));
  assert.ok(paragraphs.includes('手動読取/A4サイズ/200dpi/白黒'));
  const cards = nodes.filter(n => n.attrs?.some(a => a.name === 'class' && a.value === 'col-box')).map(text);
  assert.ok(cards.some(s => s.includes('自動読取/A4サイズ/200dpi/白黒') && s.includes('4円〜')));
  assert.ok(cards.some(s => s.includes('手動読取/A4サイズ/200dpi/白黒') && s.includes('20円〜')));
  assert.ok(rows.includes('- 白黒二値 200dpi ￥4/枚'));
  assert.ok(rows.includes('- 白黒二値 200dpi ￥20/枚'));
});
test('P3: description, quantity, unit rate and independently calculated total agree', () => {
  const example = paragraphs.find(s => s.startsWith('例.裁断不可'));
  assert.ok(example.includes('冊子100ページ×100冊のカラー300dpi'));
  assert.ok(example.includes('￥30×100ページ×100冊=￥300,000（税別）'));
  assert.equal(30 * 100 * 100, 300000);
  assert.ok(rows.includes('- フルカラー 300dpi ￥30/枚'));
});
test('existing ADF 300dpi example retains table rate and total', () => {
  assert.ok(paragraphs.some(s => s.includes('￥6×10,000枚=￥60,000（税別）')));
  assert.ok(rows.includes('- 白黒二値 300dpi ￥6/枚'));
});
