import { parse } from 'parse5';

export function documentMetadata(html) {
  const document = parse(html);
  const values = new Map();
  let titleCount = 0;
  let title = '';
  const visit = (node) => {
    if (node.nodeName === 'title') {
      titleCount += 1;
      title = (node.childNodes || []).map((child) => child.value || '').join('');
    }
    if (node.nodeName === 'meta' || node.nodeName === 'link') {
      const attrs = new Map((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value]));
      const key = node.nodeName === 'meta' ? (attrs.get('property') || attrs.get('name')) : (attrs.get('rel') === 'canonical' ? 'canonical' : undefined);
      if (key) values.set(key, [...(values.get(key) || []), attrs.get('content') ?? attrs.get('href') ?? '']);
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(document);
  return { title, titleCount, values };
}

export function assertSingle(metadata, key, expected, file) {
  const values = metadata.values.get(key) || [];
  if (values.length !== 1 || !values[0] || values[0] !== expected) throw new Error(`Unexpected ${key} metadata in ${file}: ${JSON.stringify(values)}`);
}

export function assertPageMetadata(html, expected, file) {
  const metadata = documentMetadata(html);
  if (metadata.titleCount !== 1 || !metadata.title || metadata.title !== expected.title) throw new Error(`Unexpected title in ${file}`);
  for (const [key, value] of Object.entries(expected.meta)) assertSingle(metadata, key, value, file);
  const robots = metadata.values.get('robots') || [];
  if (expected.noindex ? robots.length !== 1 || robots[0] !== 'noindex' : robots.length !== 0) throw new Error(`Unexpected robots metadata in ${file}`);
}
