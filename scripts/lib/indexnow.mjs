export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export function sitemapCanonicalUrls(xml) {
  return new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
}

export function createIndexNowPayload(urls, site, allowedUrls) {
  if (!Array.isArray(urls) || urls.length === 0) throw new Error('At least one explicit canonical URL is required');
  if (urls.length > 10000) throw new Error('IndexNow accepts at most 10,000 URLs per request');
  if (!/^[a-f0-9]{32,128}$/.test(site.indexNowKey || '')) throw new Error('Invalid public IndexNow key');

  const origin = new URL(site.origin);
  const normalized = [...new Set(urls.map((rawUrl) => {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.hostname !== origin.hostname || url.port || url.search || url.hash) {
      throw new Error(`URL is outside the canonical host or contains a query/fragment: ${rawUrl}`);
    }
    if (!allowedUrls.has(url.href)) throw new Error(`URL is not present in the canonical sitemap: ${rawUrl}`);
    return url.href;
  }))];

  return {
    host: origin.hostname,
    key: site.indexNowKey,
    keyLocation: site.indexNowKeyLocation,
    urlList: normalized
  };
}

export async function submitIndexNow({ urls, site, allowedUrls, fetchImpl = globalThis.fetch }) {
  const payload = createIndexNowPayload(urls, site, allowedUrls);
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (![200, 202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}`);
  return { status: response.status, payload };
}
