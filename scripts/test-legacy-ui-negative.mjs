import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cases = [
  { name: 'Bootstrap JS missing', pages: 'about', asset: '/vendor/bootstrap3/js/bootstrap.min.js', expected: /Timeout|waitForFunction/ },
  { name: 'Font Awesome CSS missing', pages: 'about', asset: '/vendor/fontawesome/css/all.min.css', expected: /did not render local Glyphicons and Font Awesome/ },
  { name: 'tab does not activate', pages: 'about', behavior: 'tab', expected: /Timeout|waitForFunction/ },
  { name: 'carousel does not advance', pages: 'input', behavior: 'carousel', expected: /Timeout|waitForFunction/ },
  { name: 'Lightbox does not open', pages: 'aggregate', asset: '/vendor/lightbox2/js/lightbox.min.js', expected: /Timeout|waitForFunction/ }
];

for (const testCase of cases) {
  const result = spawnSync(process.execPath, ['scripts/check-legacy-ui.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      LEGACY_PAGES: testCase.pages,
      LEGACY_WIDTHS: '375',
      LEGACY_BLOCK_ASSET: testCase.asset || '',
      LEGACY_DISABLE_BEHAVIOR: testCase.behavior || '',
      LEGACY_CHECK_TIMEOUT_MS: '1500',
      LEGACY_SKIP_SCREENSHOTS: '1'
    }
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status === 0) throw new Error(`${testCase.name} unexpectedly passed.`);
  if (!testCase.expected.test(output)) throw new Error(`${testCase.name} failed for an unexpected reason:\n${output}`);
  console.log(`${testCase.name} negative contract passed.`);
}
