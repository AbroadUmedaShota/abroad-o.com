export const cspReportOnly = "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://challenges.cloudflare.com; style-src 'self'; style-src-attr 'none'; img-src 'self' data: https://www.googletagmanager.com; font-src 'self'; connect-src 'self' https://abroad-o-contact-form.abroad-o.workers.dev https://www.google-analytics.com https://www.googletagmanager.com; frame-src 'self' https://www.google.com https://challenges.cloudflare.com; frame-ancestors 'self'; form-action 'self'";

export function assertCspReportOnly(value) {
  if (value !== cspReportOnly) throw new Error('CSP Report-Only policy changed.');
  if (/(?:unsafe-inline|unsafe-eval|\*)/.test(value)) throw new Error('CSP Report-Only policy was relaxed.');
}
