import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoIeCompatibilityShims } from './lib/ie-shim-contract.mjs';

test('accepts ordinary external dependencies', () => {
  assert.doesNotThrow(() => assertNoIeCompatibilityShims('<script src="https://code.jquery.com/jquery-1.12.4.min.js"></script>', 'valid'));
});

for (const [name, html] of Object.entries({
  maxcdn: '<script src="https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js"></script>',
  protocolRelativeMaxcdn: '<script src="//oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js"></script>',
  googlecode: '<script src="http://css3-mediaqueries-js.googlecode.com/svn/trunk/css3-mediaqueries.js"></script>',
  protocolRelativeGooglecode: '<script src="//css3-mediaqueries-js.googlecode.com/svn/trunk/css3-mediaqueries.js"></script>',
  conditional: '<!--[if lt IE 9]><script src="/js/legacy.js"></script><![endif]-->',
  conditionalTerminator: '<![endif]-->'
})) {
  test(`rejects ${name}`, () => assert.throws(() => assertNoIeCompatibilityShims(html, name)));
}
