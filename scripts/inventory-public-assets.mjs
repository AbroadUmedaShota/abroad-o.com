import fs from 'node:fs';
import path from 'node:path';
import { createPublicAssetInventory, stableInventoryJson } from './lib/public-asset-inventory.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
if (!fs.existsSync(outputRoot)) throw new Error('Missing _site. Run npm run build:site before inventory:public-assets.');
const publicManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'deploy', 'public-manifest.json'), 'utf8'));
const deployConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'deploy', 'sakura-public-files.json'), 'utf8'));
const inventory = createPublicAssetInventory({ outputRoot, publicManifest, protectedPaths: deployConfig.protectedPaths });
const content = stableInventoryJson(inventory);
const destination = path.join(repoRoot, 'output', 'public-asset-inventory.json');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, content);
console.log(`Public asset inventory written: ${inventory.assets.length} files, ${inventory.uncertainties.length} uncertainties.`);
