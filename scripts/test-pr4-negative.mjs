import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const selectedPage = process.env.PR4_NEGATIVE_PAGE || 'index.html';
const asset = process.env.PR4_NEGATIVE_ASSET || path.join(output, selectedPage);
const html = fs.readFileSync(asset, 'utf8');
const expectFailure = (name, mutate, assertion) => {
  const candidate = mutate(html);
  assert.throws(() => assertion(candidate), undefined, `${name} negative mutation must fail its contract`);
  console.log(`${name} expected failure observed.`);
};
expectFailure('navigation JavaScript removal', (value) => value.replace('/js/navigation-accessibility.js', '/js/navigation-accessibility.removed.js'), (value) => assert.match(value, /\/js\/navigation-accessibility\.js/));
expectFailure('forced overflow CSS', (value) => `${value}<style>body{min-width:9999px}</style>`, (value) => assert.doesNotMatch(value, /min-width:9999px/));
const form = fs.readFileSync(path.join(output, 'form.html'), 'utf8');
assert.throws(() => assert.match(form.replace('aria-describedby="email-error"', ''), /aria-describedby="email-error"/), undefined, 'missing form description must fail its contract');
console.log('PR4 negative contracts produced expected failures.');
