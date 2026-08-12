import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAnalyticsOrder, assertNewsRuntimeOrder, assertNoAnalyticsScripts, assertNoInlineExecutableScripts, scriptInventory } from './lib/csp-readiness-contract.mjs';

const analytics = '<script async src="https://www.googletagmanager.com/gtag/js?id=UA-51168812-1"></script><script src="/js/analytics.js"></script>';
const news = '<script src="/vendor/jquery/jquery.min.js"></script><script src="/vendor/bootstrap3/js/bootstrap.min.js"></script><script src="/js/jquery.smooth-scroll.min.js"></script><script src="/js/news-runtime.js"></script>';
const analyticsScript = "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'UA-51168812-1');";
test('accepts externalized scripts', () => {
  assert.doesNotThrow(() => assertNoInlineExecutableScripts(`${analytics}${news}`, 'valid'));
  assert.doesNotThrow(() => assertAnalyticsOrder(analytics, analyticsScript, 'analytics'));
  assert.doesNotThrow(() => assertNewsRuntimeOrder(news, 'news'));
});
test('rejects inline executable scripts', () => assert.throws(() => assertNoInlineExecutableScripts('<script>window.x=1</script>', 'inline')));
test('rejects changed analytics scope or order', () => {
  assert.doesNotThrow(() => assertNoAnalyticsScripts('<script src="/js/site.js"></script>', 'outside-scope'));
  assert.throws(() => assertNoAnalyticsScripts('<script src="/js/analytics.js"></script>', 'outside-local'));
  assert.throws(() => assertNoAnalyticsScripts('<script async src="https://www.googletagmanager.com/gtag/js?id=UA-51168812-1"></script>', 'outside-loader'));
  assert.throws(() => assertAnalyticsOrder('<script src="/js/analytics.js"></script>', analyticsScript, 'missing-ga'));
  assert.throws(() => assertAnalyticsOrder(analytics.replace('async ', ''), analyticsScript, 'non-async-ga'));
  assert.throws(() => assertAnalyticsOrder(analytics.split('</script>').reverse().join('</script>'), analyticsScript, 'reversed'));
  assert.throws(() => assertAnalyticsOrder(`${analytics}${analytics}`, analyticsScript, 'duplicated-pair'));
  assert.throws(() => assertAnalyticsOrder(`${analytics}<script src="https://www.googletagmanager.com/gtag/js?id=UA-51168812-1"></script>`, analyticsScript, 'duplicate-loader'));
  assert.throws(() => assertAnalyticsOrder(`${analytics}<script async src="https://www.googletagmanager.com/gtag/js?id=UA-00000000-1"></script>`, analyticsScript, 'other-loader-id'));
  assert.throws(() => assertAnalyticsOrder(analytics, analyticsScript.replace('51168812', '00000000'), 'wrong-id'));
  assert.throws(() => assertAnalyticsOrder(analytics, analyticsScript.replace("gtag('config', 'UA-51168812-1');", ''), 'missing-config'));
  assert.throws(() => assertAnalyticsOrder(analytics, `${analyticsScript} gtag('config', 'UA-51168812-1');`, 'duplicate-config'));
});
test('rejects NEWS runtime omissions, duplication, and order changes', () => {
  assert.throws(() => assertNewsRuntimeOrder(news.replace('/js/news-runtime.js', '/js/other.js'), 'missing'));
  assert.throws(() => assertNewsRuntimeOrder(`${news}<script src="/js/news-runtime.js"></script>`, 'duplicate'));
  assert.throws(() => assertNewsRuntimeOrder(`${news}<script src="/vendor/jquery/jquery.min.js"></script>`, 'duplicate-dependency'));
  const reordered = news
    .replace('<script src="/vendor/jquery/jquery.min.js"></script>', '')
    .replace('<script src="/js/news-runtime.js"></script>', '<script src="/js/news-runtime.js"></script><script src="/vendor/jquery/jquery.min.js"></script>');
  assert.throws(() => assertNewsRuntimeOrder(reordered, 'reordered'));
});
test('documents passthrough inline scripts without treating them as generated-page exceptions', () => {
  assert.equal(scriptInventory('<script>one()</script><script>two()</script><script>three()</script>').filter((script) => script.inline).length, 3);
});
