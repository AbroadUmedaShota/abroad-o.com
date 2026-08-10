import fs from 'node:fs';
import path from 'node:path';

const outputRoot = path.resolve(import.meta.dirname, '..', '_site');

function removeDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removeDirectory(target);
    } else {
      fs.unlinkSync(target);
    }
  }
  fs.rmdirSync(directory);
}

if (fs.existsSync(outputRoot)) {
  removeDirectory(outputRoot);
}
