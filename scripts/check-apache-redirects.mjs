const http = process.env.APACHE_HTTP_ORIGIN || 'http://127.0.0.1:18080';
const https = process.env.APACHE_HTTPS_ORIGIN || 'https://127.0.0.1:18443';
const canonical = 'https://www.abroad-o.com';
const redirectPaths = [['/', `${canonical}/`], ['/index', `${canonical}/`], ['/index.html', `${canonical}/`], ['/index?x=1', `${canonical}/?x=1`], ['/index.html?x=1', `${canonical}/?x=1`], ['/about.html', `${canonical}/about.html`], ['/about.html?x=1', `${canonical}/about.html?x=1`]];
const redirects = (origin, hosts) => hosts.flatMap((host) => redirectPaths.map(([pathname, location]) => [origin, host, pathname, 301, location]));
const cases = [
  ...redirects(http, ['abroad-o.com', 'www.abroad-o.com']), ...redirects(https, ['abroad-o.com']),
  [https, 'www.abroad-o.com', '/', 200], [https, 'www.abroad-o.com', '/?x=1', 200], [https, 'www.abroad-o.com', '/about.html', 200], [https, 'www.abroad-o.com', '/about.html?x=1', 200], [https, 'www.abroad-o.com', '/about', 200],
  [https, 'www.abroad-o.com', '/index', 301, `${canonical}/`], [https, 'www.abroad-o.com', '/index.html', 301, `${canonical}/`], [https, 'www.abroad-o.com', '/index?x=1', 301, `${canonical}/?x=1`], [https, 'www.abroad-o.com', '/index.html?x=1', 301, `${canonical}/?x=1`], [https, 'www.abroad-o.com', '/TOOL/index.html', 404]
];
for (const [origin, host, pathname, status, location] of cases) {
  const response = await fetch(`${origin}${pathname}`, { redirect: 'manual', headers: { Host: host } });
  if (response.status !== status || (location && response.headers.get('location') !== location)) throw new Error(`Redirect contract failed: ${host}${pathname}: ${response.status} ${response.headers.get('location')}`);
}
const response = await fetch(`${https}/about.html`, { redirect: 'manual', headers: { Host: 'www.abroad-o.com' } });
if (response.status !== 200) throw new Error('Canonical URL loop detected.');
console.log('Apache redirect matrix passed.');
