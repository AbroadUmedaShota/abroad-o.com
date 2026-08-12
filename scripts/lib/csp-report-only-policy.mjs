export const cspReportOnly = "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://challenges.cloudflare.com; style-src 'self'; style-src-attr 'none'; img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com; font-src 'self'; connect-src 'self' https://abroad-o-contact-form.abroad-o.workers.dev https://www.google-analytics.com; frame-src 'self' https://www.google.com https://challenges.cloudflare.com; frame-ancestors 'self'; form-action 'self'";

export const cspDirectiveSources = Object.freeze({
  'default-src': ["'self'"], 'base-uri': ["'self'"], 'object-src': ["'none'"],
  'script-src': ["'self'", 'https://www.google-analytics.com', 'https://www.googletagmanager.com', 'https://challenges.cloudflare.com'],
  'style-src': ["'self'"], 'style-src-attr': ["'none'"],
  'img-src': ["'self'", 'data:', 'https://www.google-analytics.com', 'https://www.googletagmanager.com'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'https://abroad-o-contact-form.abroad-o.workers.dev', 'https://www.google-analytics.com'],
  'frame-src': ["'self'", 'https://www.google.com', 'https://challenges.cloudflare.com'],
  'frame-ancestors': ["'self'"], 'form-action': ["'self'"]
});

export function parseCsp(value) {
  const directives = value.split(';').map((part) => part.trim()).filter(Boolean).map((part) => part.split(/\s+/));
  const names = directives.map(([name]) => name);
  if (new Set(names).size !== names.length) throw new Error('CSP has duplicate directives.');
  return Object.fromEntries(directives.map(([name, ...sources]) => [name, sources]));
}

export function assertCspReportOnly(value) {
  if (value !== cspReportOnly) throw new Error('CSP Report-Only policy changed.');
  const parsed = parseCsp(value);
  if (JSON.stringify(parsed) !== JSON.stringify(cspDirectiveSources)) throw new Error('CSP directive source sets changed.');
  if (/(?:unsafe-inline|unsafe-eval|\*)/.test(value)) throw new Error('CSP Report-Only policy was relaxed.');
}

export const securityHeaders = Object.freeze({
  'content-security-policy-report-only': cspReportOnly,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()'
});

export const apacheHeaderNames = Object.freeze({
  'content-security-policy-report-only': 'Content-Security-Policy-Report-Only',
  'x-content-type-options': 'X-Content-Type-Options',
  'referrer-policy': 'Referrer-Policy',
  'x-frame-options': 'X-Frame-Options',
  'permissions-policy': 'Permissions-Policy'
});

export function assertHtaccessSecurityHeaders(htaccess) {
  for (const [header, value] of Object.entries(securityHeaders)) {
    const apacheName = apacheHeaderNames[header];
    const matches = [...htaccess.matchAll(new RegExp(`^Header always set ${apacheName} "([^\"]+)"$`, 'gm'))];
    if (matches.length !== 1) throw new Error(`${apacheName} must occur exactly once.`);
    if (matches[0][1] !== value) throw new Error(`${apacheName} changed.`);
  }
}
