import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createPublicAssetInventory, stableInventoryJson } from './lib/public-asset-inventory.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
if (!fs.existsSync(outputRoot)) throw new Error('Missing _site. Run npm run build:site before inventory:public-assets.');
const publicManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'deploy', 'public-manifest.json'), 'utf8'));
const deployConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'deploy', 'sakura-public-files.json'), 'utf8'));
for (const field of ['managedDirectories', 'managedRootFiles']) {
  const manifestValues = [...publicManifest[field]].sort();
  const deployValues = [...deployConfig[field]].sort();
  if (JSON.stringify(manifestValues) !== JSON.stringify(deployValues)) {
    throw new Error(`Public manifest and Sakura deploy configuration disagree on ${field}.`);
  }
}
const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
const inventory = createPublicAssetInventory({
  outputRoot,
  publicManifest,
  protectedPaths: deployConfig.protectedPaths,
  commit: git(['rev-parse', 'HEAD']),
  historyCompleteness: git(['rev-parse', '--is-shallow-repository']) === 'true' ? 'partial' : 'full'
});
const content = stableInventoryJson(inventory);
const secondContent = stableInventoryJson(createPublicAssetInventory({
  outputRoot,
  publicManifest,
  protectedPaths: deployConfig.protectedPaths,
  commit: inventory.commit,
  historyCompleteness: inventory.historyCompleteness
}));
if (content !== secondContent) throw new Error('Public asset inventory is not byte-reproducible across two scans.');
const destination = path.join(repoRoot, 'output', 'public-asset-inventory.json');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, content);
console.log(`Public asset inventory written: ${inventory.assets.length} files, ${inventory.uncertainties.length} uncertainties.`);
