const forbiddenPatterns = [
  { label: 'oss.maxcdn.com IE shim', pattern: /https?:\/\/oss\.maxcdn\.com\//i },
  { label: 'Google Code css3-mediaqueries shim', pattern: /https?:\/\/[^\s"']*googlecode\.com\//i },
  { label: 'IE conditional comment', pattern: /<!--\s*\[if\s+[^\]]*\bIE\b[^\]]*\]>/i },
  { label: 'IE conditional comment terminator', pattern: /<!\[endif\]\s*-->/i }
];

export function assertNoIeCompatibilityShims(html, label) {
  for (const { label: forbidden, pattern } of forbiddenPatterns) {
    if (pattern.test(html)) throw new Error(`${label} contains forbidden ${forbidden}.`);
  }
}
