import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const lockPath = path.join(repoRoot, '.site-build.lock');

try {
  fs.mkdirSync(lockPath);
} catch (error) {
  if (error.code === 'EEXIST') {
    throw new Error('A site build is already running. Wait for it to finish before starting another build.');
  }
  throw error;
}

try {
  for (const [command, args] of [
    [process.execPath, [path.join(repoRoot, 'scripts', 'clean-site.mjs')]],
    [process.execPath, [path.join(repoRoot, 'node_modules', '@11ty', 'eleventy', 'cmd.cjs')]]
  ]) {
    const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
    if (result.status !== 0) process.exitCode = result.status || 1;
    if (process.exitCode) break;
  }
} finally {
  fs.rmSync(lockPath, { recursive: true, force: true });
}
