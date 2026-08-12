import fs from 'node:fs';
import path from 'node:path';
import { TOP_IMAGE, generateTopImageWebp } from './lib/top-image-derivative.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const pngPath = path.join(repoRoot, TOP_IMAGE.pngPath);
const webpPath = path.join(repoRoot, TOP_IMAGE.webpPath);
const webp = await generateTopImageWebp(fs.readFileSync(pngPath));
fs.writeFileSync(webpPath, webp);
console.log(`Generated ${TOP_IMAGE.webpPath} (${webp.length} bytes).`);
