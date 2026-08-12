import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFontCss, assertFontHtml, assertFontObservation } from './lib/local-font-contract.mjs';

const valid = '<link rel="stylesheet" href="/css/fonts.css">';
test('accepts exactly one shared local font stylesheet', () => assert.doesNotThrow(() => assertFontHtml(valid, 'valid')));
test('rejects missing, duplicate, and external font references', () => {
  assert.throws(() => assertFontHtml('', 'missing'));
  assert.throws(() => assertFontHtml(`${valid}${valid}`, 'duplicate'));
  assert.throws(() => assertFontHtml(`${valid}<link href="https://fonts.googleapis.com/css?family=Crimson+Text" rel="stylesheet">`, 'external'));
});
test('rejects a font-face that omits the required local contract', () => assert.throws(() => assertFontCss('@font-face { font-family: Roboto; }')));

const observation = {
  expectedPaths: ['/css/fonts.css', '/fonts/google/roboto-latin-400-normal.woff2'],
  responses: ['/css/fonts.css', '/fonts/google/roboto-latin-400-normal.woff2'],
  externalFonts: [],
  expectedFaces: [{ family: 'Roboto', weight: 400 }],
  faces: [{ family: 'Roboto', weight: '400', status: 'loaded' }],
  visible: [{ family: 'Roboto, serif', weight: '400', expectedFamily: 'Roboto', expectedWeight: 400 }]
};
test('rejects missing face', () => assert.throws(() => assertFontObservation({ ...observation, faces: [] }), /Missing face/));
test('rejects corrupt or error face', () => assert.throws(() => assertFontObservation({ ...observation, faces: [{ ...observation.faces[0], status: 'error' }] }), /Corrupt or error face/));
test('rejects wrong weight', () => assert.throws(() => assertFontObservation({ ...observation, visible: [{ ...observation.visible[0], weight: '500' }] }), /wrong weight/));
test('rejects fallback-only rendering', () => assert.throws(() => assertFontObservation({ ...observation, visible: [{ ...observation.visible[0], family: 'serif' }] }), /Fallback-only rendering/));
