import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';

const localAssetExtension = /\.(?:avif|bmp|css|eot|gif|html?|ico|jpe?g|js|mjs|map|mp3|mp4|ogg|otf|pdf|png|svg|ttf|txt|webm|webp|woff2?)(?:[?#][^\s"')}]*)?$/i;
const ignoredUrl = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function publicPath(root, file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function managedPath(file, publicManifest) {
  return publicManifest.managedRootFiles.includes(file)
    || publicManifest.managedDirectories.some((directory) => file.startsWith(`${directory}/`));
}

function normalizeUrl(raw) {
  return raw.trim().replace(/^['"]|['"]$/g, '').split(/[?#]/, 1)[0];
}

function splitSrcset(value) {
  return value.split(',').map((candidate) => candidate.trim().split(/\s+/, 1)[0]).filter(Boolean);
}

function isDynamic(value) {
  return /\$\{|\{\{|\{%|<%/.test(value);
}

function localReference(raw, from, kind, references, uncertainties, rootRelative = false) {
  if (!raw || isDynamic(raw)) {
    if (raw) uncertainties.push({ type: 'dynamic-reference', from, kind, value: raw });
    return;
  }
  if (ignoredUrl.test(raw)) return;
  const clean = normalizeUrl(raw);
  if (/\s/.test(clean)) return;
  if (!/^[A-Za-z0-9._/-]/.test(clean)) return;
  if (!clean || !localAssetExtension.test(raw)) return;
  references.push({ from, kind, raw, target: clean, rootRelative });
}

function cssReferences(css, from, kind, references, uncertainties) {
  const activeCss = css.replace(/\/\*(?!#\s*sourceMappingURL=)[\s\S]*?\*\//gi, '');
  for (const match of activeCss.matchAll(/url\(\s*([^)]*?)\s*\)/gi)) {
    localReference(match[1], from, `${kind}:url`, references, uncertainties);
  }
  for (const match of activeCss.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/gi)) {
    localReference(match[1], from, `${kind}:import`, references, uncertainties);
  }
  for (const match of css.matchAll(/\/\*#\s*sourceMappingURL=([^\s*]+)\s*\*\//gi)) {
    localReference(match[1], from, `${kind}:sourceMappingURL`, references, uncertainties);
  }
}

function jsReferences(js, from, references, uncertainties) {
  for (const match of js.matchAll(/(?:\bimport\s*(?:[^('";]+?\s+from\s*)?|\brequire\s*\(|\bnew\s+URL\s*\()\s*['"]([^'"]+)['"]/g)) {
    if (/^require\s*\(/.test(match[0]) && /CommonJS environment/i.test(js)) {
      uncertainties.push({ type: 'unresolved-reference', from, kind: 'js:commonjs', value: match[1] });
      continue;
    }
    localReference(match[1], from, 'js:module', references, uncertainties);
  }
  for (const match of js.matchAll(/['"]([^'"]+\.(?:avif|bmp|css|eot|gif|html?|ico|jpe?g|js|mjs|map|mp3|mp4|ogg|otf|pdf|png|svg|ttf|txt|webm|webp|woff2?)(?:[?#][^'"]*)?)['"]/gi)) {
    if (/(?:\bimport|\brequire|\bnew\s+URL)\s*\(\s*$/.test(js.slice(0, match.index))) continue;
    localReference(match[1], from, 'js:fixed-path', references, uncertainties, !/^(?:\.\.?\/|\/)/.test(match[1]));
  }
  for (const match of js.matchAll(/(?:import|require|new\s+URL)\s*\([^)]*(?:\$\{|\{\{)/g)) {
    uncertainties.push({ type: 'dynamic-reference', from, kind: 'js:module', value: match[0] });
  }
}

function htmlReferences(html, from, references, uncertainties) {
  const document = parse(html);
  const visit = (node) => {
    const attrs = new Map((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value]));
    for (const [name, value] of attrs) {
      if (['src', 'href', 'poster', 'lazy', 'data-src', 'data-href', 'data-lazy', 'data-original'].includes(name)) {
        localReference(value, from, `html:${name}`, references, uncertainties);
      } else if (name === 'srcset' || name === 'data-srcset') {
        for (const candidate of splitSrcset(value)) localReference(candidate, from, `html:${name}`, references, uncertainties);
      } else if (name === 'style') {
        cssReferences(value, from, 'html:style', references, uncertainties);
      }
    }
    if (node.tagName === 'style') cssReferences((node.childNodes || []).map((child) => child.value || '').join(''), from, 'html:style-block', references, uncertainties);
    if (node.tagName === 'script' && !attrs.has('src')) jsReferences((node.childNodes || []).map((child) => child.value || '').join(''), from, references, uncertainties);
    for (const child of node.childNodes || []) visit(child);
  };
  visit(document);
}

function resolveReference(reference, files, publicManifest) {
  const base = reference.target.startsWith('/') || reference.rootRelative ? '' : path.posix.dirname(reference.from);
  const resolved = path.posix.normalize(path.posix.join(base, reference.target.replace(/^\/+/, '')));
  if (resolved === '..' || resolved.startsWith('../') || path.posix.isAbsolute(resolved)) {
    throw new Error(`Public reference escapes the root: ${reference.from} -> ${reference.raw}`);
  }
  if (!managedPath(resolved, publicManifest)) {
    throw new Error(`Public reference targets an unmanaged path: ${reference.from} -> ${reference.raw} (${resolved})`);
  }
  if (!files.has(resolved)) {
    throw new Error(`Public reference targets a missing local file: ${reference.from} -> ${reference.raw} (${resolved})`);
  }
  return resolved;
}

export function createPublicAssetInventory({ outputRoot, publicManifest, protectedPaths = [] }) {
  const files = walk(outputRoot).map((file) => publicPath(outputRoot, file)).sort((left, right) => left.localeCompare(right));
  const fileSet = new Set(files);
  const unmanagedFiles = files.filter((file) => !managedPath(file, publicManifest));
  if (unmanagedFiles.length) throw new Error(`Published files outside the public manifest:\n${unmanagedFiles.join('\n')}`);

  const references = [];
  const uncertainties = [{ type: 'history-shallow', detail: 'Git history and access logs are intentionally not used to establish deletion eligibility.' }];
  for (const file of files) {
    const absolute = path.join(outputRoot, file);
    if (file.endsWith('.html')) htmlReferences(fs.readFileSync(absolute, 'utf8'), file, references, uncertainties);
    if (file.endsWith('.css')) cssReferences(fs.readFileSync(absolute, 'utf8'), file, 'css', references, uncertainties);
    if (/\.(?:js|mjs)$/i.test(file)) jsReferences(fs.readFileSync(absolute, 'utf8'), file, references, uncertainties);
  }

  const referencesBySource = new Map(files.map((file) => [file, []]));
  for (const reference of references) referencesBySource.get(reference.from).push(reference);
  const reachable = new Set(files.filter((file) => file.endsWith('.html')));
  const inbound = new Map(files.map((file) => [file, []]));
  const pending = [...reachable];
  while (pending.length) {
    const source = pending.shift();
    for (const reference of referencesBySource.get(source)) {
      let target;
      try {
        target = resolveReference(reference, fileSet, publicManifest);
      } catch (error) {
        if (reference.kind.endsWith(':sourceMappingURL')) {
          uncertainties.push({ type: 'missing-source-map', from: reference.from, kind: reference.kind, value: reference.raw, detail: error.message });
          continue;
        }
        throw error;
      }
      inbound.get(target).push({ from: reference.from, kind: reference.kind, raw: reference.raw, reachable: true });
      if (!reachable.has(target)) {
        reachable.add(target);
        pending.push(target);
      }
    }
  }
  for (const reference of references) {
    if (reachable.has(reference.from)) continue;
    try {
      resolveReference(reference, fileSet, publicManifest);
    } catch (error) {
      uncertainties.push({ type: 'unreachable-source-missing-reference', from: reference.from, kind: reference.kind, value: reference.raw, detail: error.message });
    }
  }
  const protectedSet = new Set(protectedPaths.map(({ path: file }) => file));
  for (const file of protectedSet) {
    if (!fileSet.has(file)) throw new Error(`Protected public asset is missing: ${file}`);
  }

  const assets = files.map((file) => {
    const referencesTo = inbound.get(file);
    let classification = 'static-unreferenced';
    if (protectedSet.has(file)) classification = 'protected';
    else if (file.endsWith('.html')) classification = 'entrypoint';
    else if (reachable.has(file)) classification = 'reachable';
    return {
      path: file,
      bytes: fs.statSync(path.join(outputRoot, file)).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(outputRoot, file))).digest('hex'),
      classification,
      deletionEligible: false,
      referencedBy: referencesTo.sort((left, right) => `${left.from}:${left.raw}`.localeCompare(`${right.from}:${right.raw}`))
    };
  });
  return {
    schemaVersion: 1,
    publicManifest: {
      managedDirectories: [...publicManifest.managedDirectories].sort(),
      managedRootFiles: [...publicManifest.managedRootFiles].sort()
    },
    protectedPaths: [...protectedSet].sort(),
    classifications: ['entrypoint', 'protected', 'reachable', 'static-unreferenced'],
    assets,
    uncertainties: uncertainties.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  };
}

export function stableInventoryJson(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}
