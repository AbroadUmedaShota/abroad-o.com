const http = 'http://127.0.0.1:18080';
const https = 'https://127.0.0.1:18443';
const canonical = 'https://www.abroad-o.com';
const cases = [
  [http, 'abroad-o.com', '/', 301, `${canonical}/`], [https, 'abroad-o.com', '/', 301, `${canonical}/`],
  [http, 'www.abroad-o.com', '/index?x=1', 301, `${canonical}/?x=1`], [https, 'www.abroad-o.com', '/index.html', 301, `${canonical}/`],
  [http, 'abroad-o.com', '/about.html?x=1', 301, `${canonical}/about.html?x=1`], [https, 'www.abroad-o.com', '/about.html', 200],
  [https, 'www.abroad-o.com', '/about', 200], [https, 'www.abroad-o.com', '/TOOL/index.html', 404]
];
for (const [origin, host, pathname, status, location] of cases) {
  const response = await fetch(`${origin}${pathname}`, { redirect: 'manual', headers: { Host: host } });
  if (response.status !== status || (location && response.headers.get('location') !== location)) throw new Error(`Redirect contract failed: ${host}${pathname}: ${response.status} ${response.headers.get('location')}`);
}
const response = await fetch(`${https}/about.html`, { redirect: 'manual', headers: { Host: 'www.abroad-o.com' } });
if (response.status !== 200) throw new Error('Canonical URL loop detected.');
console.log('Apache redirect matrix passed.');
