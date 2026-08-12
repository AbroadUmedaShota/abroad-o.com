import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFontCss, assertFontHtml } from './lib/local-font-contract.mjs';

const valid = '<link rel="stylesheet" href="/css/fonts.css">';
test('accepts exactly one shared local font stylesheet', () => assert.doesNotThrow(() => assertFontHtml(valid, 'valid')));
test('rejects missing, duplicate, and external font references', () => {
  assert.throws(() => assertFontHtml('', 'missing'));
  assert.throws(() => assertFontHtml(`${valid}${valid}`, 'duplicate'));
  assert.throws(() => assertFontHtml(`${valid}<link href="https://fonts.googleapis.com/css?family=Crimson+Text" rel="stylesheet">`, 'external'));
});
test('rejects a font-face that omits the required local contract', () => assert.throws(() => assertFontCss('@font-face { font-family: Roboto; }')));
