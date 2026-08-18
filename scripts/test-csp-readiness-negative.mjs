import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAnalyticsOrder, assertNewsRuntimeOrder, assertNoAnalyticsScripts, assertNoInlineEventAttributes, assertNoInlineExecutableScripts, assertNoInlineStyles, assertPageStyleLink, assertPageStyleSheet } from './lib/csp-readiness-contract.mjs';

const analytics = '<script async src="https://www.googletagmanager.com/gtag/js?id=UA-51168812-1"></script><script src="/js/analytics.js"></script>';
const news = '<script src="/vendor/jquery/jquery.min.js"></script><script src="/vendor/bootstrap3/js/bootstrap.min.js"></script><script src="/js/jquery.smooth-scroll.min.js"></script><script src="/js/news-runtime.js"></script>';
const analyticsScript = "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'UA-51168812-1');";
test('accepts externalized scripts', () => {
  assert.doesNotThrow(() => assertNoInlineExecutableScripts(`${analytics}${news}<script type="application/ld+json">{"@context":"https://schema.org"}</script>`, 'valid'));
  assert.doesNotThrow(() => assertAnalyticsOrder(analytics, analyticsScript, 'analytics'));
  assert.doesNotThrow(() => assertNewsRuntimeOrder(news, 'news'));
});
test('rejects inline executable scripts', () => assert.throws(() => assertNoInlineExecutableScripts('<script>window.x=1</script>', 'inline')));
test('rejects executable MIME types even when they resemble JSON-LD', () => {
  assert.throws(() => assertNoInlineExecutableScripts('<script type="application/javascript">window.x=1</script>', 'javascript-type'));
  assert.throws(() => assertNoInlineExecutableScripts('<script type="application/ld+jsonx">window.x=1</script>', 'near-json-ld-type'));
});
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
test('rejects inline event attributes', () => assert.throws(() => assertNoInlineEventAttributes('<button onclick="window.x=1">go</button>', 'event-attribute')));
test('rejects inline styles and changed page stylesheet mapping', () => {
  const valid = '<link rel="stylesheet" href="/css/pages/form.css">';
  assert.doesNotThrow(() => assertNoInlineStyles(valid, 'form.html'));
  assert.doesNotThrow(() => assertPageStyleLink(valid, 'form.html'));
  assert.throws(() => assertNoInlineStyles('<style>.x { color: red; }</style>', 'inline-style'));
  assert.throws(() => assertNoInlineStyles('<div style="color: red"></div>', 'inline-style-attribute'));
  assert.throws(() => assertPageStyleLink('', 'form.html'));
  assert.throws(() => assertPageStyleLink(`${valid}${valid}`, 'form.html'));
  assert.throws(() => assertPageStyleLink('<link rel="stylesheet" href="/css/pages/news-index.css">', 'form.html'));
  assert.throws(() => assertPageStyleLink(valid, 'about.html'));
  assert.throws(() => assertPageStyleLink('<link rel="stylesheet" href="/css/pages/form.css">', 'index.html'));
});
test('rejects missing or modified external page stylesheets', () => {
  const css = '.no-link-style { color: inherit; text-decoration: none; } .no-link-style:hover, .no-link-style:active, .no-link-style:visited { color: inherit; text-decoration: none; }';
  assert.doesNotThrow(() => assertPageStyleSheet(css, '/css/pages/legacy-no-link.css'));
  assert.throws(() => assertPageStyleSheet('', '/css/pages/form.css'));
  assert.throws(() => assertPageStyleSheet(`${css} .changed { display: block; }`, '/css/pages/legacy-no-link.css'));
});
