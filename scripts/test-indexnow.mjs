import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createIndexNowPayload, INDEXNOW_ENDPOINT, submitIndexNow } from './lib/indexnow.mjs';

const site = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'site', '_data', 'site.json'), 'utf8'));
const allowedUrls = new Set(['https://www.abroad-o.com/', 'https://www.abroad-o.com/input.html']);

test('submits the documented IndexNow payload to the official endpoint', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { status: 202 };
  };
  const result = await submitIndexNow({
    urls: ['https://www.abroad-o.com/', 'https://www.abroad-o.com/input.html'],
    site,
    allowedUrls,
    fetchImpl
  });
  assert.equal(request.url, INDEXNOW_ENDPOINT);
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {
    host: 'www.abroad-o.com',
    key: site.indexNowKey,
    keyLocation: site.indexNowKeyLocation,
    urlList: ['https://www.abroad-o.com/', 'https://www.abroad-o.com/input.html']
  });
  assert.equal(result.status, 202);
});

for (const invalidUrl of [
  'http://www.abroad-o.com/',
  'https://abroad-o.com/',
  'https://www.abroad-o.com/input.html?x=1',
  'https://www.abroad-o.com/not-in-sitemap.html'
]) {
  test(`rejects non-canonical IndexNow URL ${invalidUrl}`, () => {
    assert.throws(() => createIndexNowPayload([invalidUrl], site, allowedUrls));
  });
}

test('requires an explicit URL list', () => {
  assert.throws(() => createIndexNowPayload([], site, allowedUrls));
});

test('surfaces an IndexNow HTTP failure without retrying', async () => {
  let calls = 0;
  await assert.rejects(() => submitIndexNow({
    urls: ['https://www.abroad-o.com/'],
    site,
    allowedUrls,
    fetchImpl: async () => {
      calls += 1;
      return { status: 429 };
    }
  }), /HTTP 429/);
  assert.equal(calls, 1);
});
