import assert from 'node:assert/strict';

export const assertPr4HtmlContract = (html, name = 'page') => {
  assert.match(html, /<script[^>]+src=["'](?:\/)?js\/navigation-accessibility\.js["']/i, `${name} must load navigation accessibility behavior`);
  assert.doesNotMatch(html, /min-width\s*:\s*(?:[1-9]\d{3,}|\d{5,})px/i, `${name} must not force viewport overflow`);
};

export const assertPr4FormContract = (html) => {
  assert.match(html, /id=["']email["'][^>]*aria-describedby=["']email-error["']/i, 'email needs its error description');
  assert.match(html, /id=["']phone["'][^>]*aria-describedby=["']phone-error["']/i, 'phone needs its error description');
};
