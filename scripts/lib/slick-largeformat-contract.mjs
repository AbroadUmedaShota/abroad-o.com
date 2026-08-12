import assert from 'node:assert/strict';

export function assertSlickRuntimeRequests({ externalOrigins, localFailures, localAssets }) {
  assert.deepEqual(externalOrigins, ['https://www.googletagmanager.com']);
  assert.deepEqual(localFailures, []);
  for (const asset of localAssets) assert.ok(asset.bytes > 0, `${asset.path} was empty`);
}

export function assertSlickGeometry(actual, expected) {
  const ratio = (value, reference) => Math.abs(value - reference) / reference;
  assert.equal(actual.overflow, expected.overflow);
  assert.ok(ratio(actual.header, expected.header.height) <= 0.03, 'header geometry changed');
  assert.ok(ratio(actual.body, expected.bodyHeight) <= 0.03, 'body geometry changed');
  assert.ok(ratio(actual.container, expected.largestContainer) <= 0.03, 'container geometry changed');
  assert.equal(actual.returnLink.color, expected.returnLink.color);
  assert.equal(actual.cta.display, expected.cta.display);
  assert.equal(actual.cta.fontSize, expected.cta.fontSize);
}
