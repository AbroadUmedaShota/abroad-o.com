import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
for (const [name, asset, expected] of [
  ['local jQuery missing', '/vendor/jquery/jquery.min.js', /waitForFunction|Timeout/],
  ['local Font Awesome missing', '/vendor/fontawesome/css/all.min.css', /Glyphicons\/Font Awesome/],
  ['Lightbox script missing', '/vendor/lightbox2/js/lightbox.min.js', /waitForFunction|Timeout/]
]) {
  const result = spawnSync(process.execPath, ['scripts/check-news-form-ui.mjs'], { cwd: root, encoding: 'utf8', timeout: 120000, env: { ...process.env, NEWS_FORM_BLOCK_ASSET: asset } });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status === 0 || !expected.test(output)) throw new Error(`${name} did not fail the expected contract:\n${output}`);
  console.log(`${name} negative contract passed.`);
}
