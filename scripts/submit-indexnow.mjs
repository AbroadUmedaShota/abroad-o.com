import fs from 'node:fs';
import path from 'node:path';
import { sitemapCanonicalUrls, submitIndexNow } from './lib/indexnow.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(repoRoot, 'site', '_data', 'site.json'), 'utf8'));
const sitemapPath = path.join(repoRoot, '_site', 'sitemap.xml');

function explicitUrls(args) {
  const urls = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--url' || !args[index + 1]) throw new Error('Usage: npm run notify:indexnow -- --url https://www.abroad-o.com/path');
    urls.push(args[index + 1]);
    index += 1;
  }
  return urls;
}

if (!fs.existsSync(sitemapPath)) throw new Error('Build the site before notifying IndexNow: npm run build:site');
const urls = explicitUrls(process.argv.slice(2));
const allowedUrls = sitemapCanonicalUrls(fs.readFileSync(sitemapPath, 'utf8'));
const result = await submitIndexNow({ urls, site, allowedUrls });
console.log(`IndexNow accepted ${result.payload.urlList.length} URL(s) with HTTP ${result.status}.`);
