import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAnalyticsOrder, assertNewsRuntimeOrder, assertNoInlineExecutableScripts, scriptInventory } from './lib/csp-readiness-contract.mjs';

const analytics = '<script async src="https://www.googletagmanager.com/gtag/js?id=UA-51168812-1"></script><script src="/js/analytics.js"></script>';
const news = '<script src="/vendor/jquery/jquery.min.js"></script><script src="/vendor/bootstrap3/js/bootstrap.min.js"></script><script src="/js/jquery.smooth-scroll.min.js"></script><script src="/js/news-runtime.js"></script>';
test('accepts externalized scripts', () => {
  assert.doesNotThrow(() => assertNoInlineExecutableScripts(`${analytics}${news}`, 'valid'));
  assert.doesNotThrow(() => assertAnalyticsOrder(analytics, 'analytics'));
  assert.doesNotThrow(() => assertNewsRuntimeOrder(news, 'news'));
});
test('rejects inline executable scripts', () => assert.throws(() => assertNoInlineExecutableScripts('<script>window.x=1</script>', 'inline')));
test('rejects changed analytics scope or order', () => {
  assert.throws(() => assertAnalyticsOrder('<script src="/js/analytics.js"></script>', 'missing-ga'));
  assert.throws(() => assertAnalyticsOrder(analytics.replace('async ', ''), 'non-async-ga'));
  assert.throws(() => assertAnalyticsOrder(analytics.split('</script>').reverse().join('</script>'), 'reversed'));
});
test('rejects NEWS runtime omissions, duplication, and order changes', () => {
  assert.throws(() => assertNewsRuntimeOrder(news.replace('/js/news-runtime.js', '/js/other.js'), 'missing'));
  assert.throws(() => assertNewsRuntimeOrder(`${news}<script src="/js/news-runtime.js"></script>`, 'duplicate'));
  const reordered = news
    .replace('<script src="/vendor/jquery/jquery.min.js"></script>', '')
    .replace('<script src="/js/news-runtime.js"></script>', '<script src="/js/news-runtime.js"></script><script src="/vendor/jquery/jquery.min.js"></script>');
  assert.throws(() => assertNewsRuntimeOrder(reordered, 'reordered'));
});
test('documents passthrough inline scripts without treating them as generated-page exceptions', () => {
  assert.equal(scriptInventory('<script>one()</script><script>two()</script><script>three()</script>').filter((script) => script.inline).length, 3);
});
