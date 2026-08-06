const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_UPSTREAM_RESPONSE_BYTES = 4 * 1024;
const MIN_SUBMISSION_TIME_MS = 3_000;
const MAX_SUBMISSION_TIME_MS = 2 * 60 * 60 * 1_000;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const FIELD_RULES = {
  enterprise: { required: true, max: 120 },
  department: { required: false, max: 120 },
  name: { required: true, max: 80 },
  email: { required: true, max: 254 },
  phone: { required: true, max: 30 },
  address: { required: false, max: 500 },
  inquiryDetails: { required: true, max: 4000 },
};

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

export async function handleRequest(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowedOrigin = getAllowedOrigin(origin, env.ALLOWED_ORIGINS);

  if (request.method === 'OPTIONS') {
    if (!allowedOrigin) {
      return jsonResponse({ ok: false, code: 'origin_not_allowed' }, 403, null);
    }
    return new Response(null, {
      status: 204,
      headers: corsHeaders(allowedOrigin),
    });
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    return jsonResponse({ ok: true, service: 'contact-form' }, 200, allowedOrigin);
  }

  if (request.method === 'GET' && url.pathname === '/config') {
    if (!allowedOrigin) {
      return jsonResponse({ ok: false, code: 'origin_not_allowed' }, 403, null);
    }
    if (!env.TURNSTILE_SITE_KEY) {
      audit('config_error', requestId, 'turnstile_site_key_missing');
      return jsonResponse({ ok: false, code: 'service_unavailable' }, 503, allowedOrigin);
    }
    return jsonResponse({
      ok: true,
      turnstileSiteKey: env.TURNSTILE_SITE_KEY,
      turnstileAction: env.TURNSTILE_ACTION || 'contact-submit',
    }, 200, allowedOrigin);
  }

  if (request.method !== 'POST' || url.pathname !== '/submit') {
    return jsonResponse({ ok: false, code: 'not_found' }, 404, allowedOrigin);
  }

  if (!allowedOrigin) {
    audit('rejected', requestId, 'origin_not_allowed');
    return jsonResponse({ ok: false, code: 'request_rejected' }, 403, null);
  }

  const missingConfig = requiredConfiguration(env);
  if (missingConfig) {
    audit('config_error', requestId, missingConfig);
    return jsonResponse({ ok: false, code: 'service_unavailable' }, 503, allowedOrigin);
  }

  try {
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return reject(requestId, 'unsupported_content_type', 415, allowedOrigin);
    }

    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return reject(requestId, 'request_too_large', 413, allowedOrigin);
    }

    const requestText = await request.text();
    if (new TextEncoder().encode(requestText).byteLength > MAX_REQUEST_BYTES) {
      return reject(requestId, 'request_too_large', 413, allowedOrigin);
    }

    let input;
    try {
      input = JSON.parse(requestText);
    } catch {
      return reject(requestId, 'invalid_json', 400, allowedOrigin);
    }

    const validation = validateSubmission(input);
    if (!validation.ok) {
      return reject(requestId, validation.reason, 400, allowedOrigin, validation.fields);
    }

    const submission = validation.value;
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (!clientIp) {
      return reject(requestId, 'client_identity_missing', 503, allowedOrigin);
    }

    const [ipKey, emailKey] = await Promise.all([
      keyedHash(env.RATE_LIMIT_HASH_KEY, `ip:${clientIp}`),
      keyedHash(env.RATE_LIMIT_HASH_KEY, `email:${submission.email.toLowerCase()}`),
    ]);

    const ipLimit = await env.IP_RATE_LIMITER.limit({ key: ipKey });
    if (!ipLimit.success) {
      audit('rejected', requestId, 'rate_limited', ipKey);
      return jsonResponse({ ok: false, code: 'rate_limited' }, 429, allowedOrigin, {
        'Retry-After': '60',
      });
    }

    const turnstile = await verifyTurnstile({
      token: submission.turnstileToken,
      clientIp,
      secret: env.TURNSTILE_SECRET_KEY,
      expectedAction: env.TURNSTILE_ACTION || 'contact-submit',
      allowedHostnames: csv(env.ALLOWED_HOSTNAMES),
    });
    if (!turnstile.ok) {
      audit('rejected', requestId, turnstile.reason, ipKey);
      return jsonResponse({ ok: false, code: 'verification_failed' }, 400, allowedOrigin);
    }

    // Only a successfully verified visitor may consume the target-address quota.
    // This prevents invalid-token traffic from blocking a legitimate sender who
    // happens to use the same reply address.
    const emailLimit = await env.EMAIL_RATE_LIMITER.limit({ key: emailKey });
    if (!emailLimit.success) {
      audit('rejected', requestId, 'rate_limited', ipKey);
      return jsonResponse({ ok: false, code: 'rate_limited' }, 429, allowedOrigin, {
        'Retry-After': '60',
      });
    }

    const upstreamPayload = {
      version: 1,
      requestId: submission.submissionId,
      receivedAt: new Date().toISOString(),
      fields: {
        enterprise: submission.enterprise,
        department: submission.department,
        name: submission.name,
        email: submission.email,
        phone: submission.phone,
        address: submission.address,
        inquiryDetails: submission.inquiryDetails,
      },
      controls: {
        notificationEnabled: env.NOTIFY_ENABLED === 'true',
        autoReplyEnabled: env.AUTOREPLY_ENABLED === 'true',
      },
    };

    const upstreamResult = await sendToUpstream(upstreamPayload, env);
    if (!upstreamResult.ok) {
      audit('upstream_error', requestId, upstreamResult.reason, ipKey);
      return jsonResponse({ ok: false, code: 'service_unavailable' }, 503, allowedOrigin);
    }

    audit('accepted', requestId, 'verified_and_forwarded', ipKey);
    return jsonResponse({ ok: true, requestId: submission.submissionId }, 200, allowedOrigin);
  } catch (error) {
    audit('internal_error', requestId, safeErrorReason(error));
    return jsonResponse({ ok: false, code: 'service_unavailable' }, 503, allowedOrigin);
  }
}

export function validateSubmission(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, reason: 'invalid_payload' };
  }
  if (typeof input.website !== 'string' || input.website !== '') {
    return { ok: false, reason: 'honeypot_filled' };
  }
  if (input.consent !== true) {
    return { ok: false, reason: 'consent_missing', fields: ['consent'] };
  }
  if (!isUuid(input.submissionId)) {
    return { ok: false, reason: 'invalid_submission_id' };
  }
  if (!Number.isFinite(input.formStartedAt)) {
    return { ok: false, reason: 'invalid_form_time' };
  }

  const elapsed = now - input.formStartedAt;
  if (elapsed < MIN_SUBMISSION_TIME_MS) {
    return { ok: false, reason: 'submission_too_fast' };
  }
  if (elapsed > MAX_SUBMISSION_TIME_MS) {
    return { ok: false, reason: 'form_expired' };
  }

  const normalized = {};
  const invalidFields = [];
  for (const [field, rule] of Object.entries(FIELD_RULES)) {
    if (typeof input[field] !== 'string') {
      invalidFields.push(field);
      continue;
    }
    const value = input[field].normalize('NFC').trim();
    if ((rule.required && value.length === 0) || value.length > rule.max) {
      invalidFields.push(field);
      continue;
    }
    normalized[field] = value;
  }

  if (normalized.email && !isValidEmail(normalized.email)) {
    invalidFields.push('email');
  }
  if (normalized.phone && !/^[0-9+() -]{7,30}$/.test(normalized.phone)) {
    invalidFields.push('phone');
  }
  if (normalized.inquiryDetails && countUrls(normalized.inquiryDetails) > 5) {
    invalidFields.push('inquiryDetails');
  }
  if (invalidFields.length > 0) {
    return {
      ok: false,
      reason: 'field_validation_failed',
      fields: [...new Set(invalidFields)],
    };
  }
  if (typeof input.turnstileToken !== 'string'
    || input.turnstileToken.length === 0
    || input.turnstileToken.length > 2048) {
    return { ok: false, reason: 'turnstile_token_invalid' };
  }

  return {
    ok: true,
    value: {
      ...normalized,
      submissionId: input.submissionId.toLowerCase(),
      turnstileToken: input.turnstileToken,
    },
  };
}

export async function verifyTurnstile({
  token,
  clientIp,
  secret,
  expectedAction,
  allowedHostnames,
}) {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  formData.append('remoteip', clientIp);
  formData.append('idempotency_key', crypto.randomUUID());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, reason: 'turnstile_service_error' };
    }
    const result = await readLimitedJson(response, MAX_UPSTREAM_RESPONSE_BYTES);
    if (result.success !== true) {
      return { ok: false, reason: 'turnstile_rejected' };
    }
    if (result.action !== expectedAction) {
      return { ok: false, reason: 'turnstile_action_mismatch' };
    }
    if (!allowedHostnames.includes(result.hostname)) {
      return { ok: false, reason: 'turnstile_hostname_mismatch' };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error && error.name === 'AbortError'
        ? 'turnstile_timeout'
        : 'turnstile_service_error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendToUpstream(payload, env) {
  const upstreamUrl = new URL(env.UPSTREAM_URL);
  if (upstreamUrl.protocol !== 'https:'
    || !csv(env.UPSTREAM_ALLOWED_HOSTS).includes(upstreamUrl.hostname)) {
    return { ok: false, reason: 'upstream_url_not_allowed' };
  }

  const payloadText = JSON.stringify(payload);
  const signature = await keyedHash(env.UPSTREAM_SHARED_SECRET, payloadText);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(upstreamUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
        'X-Contact-Version': '1',
      },
      body: JSON.stringify({ payload: payloadText, signature }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, reason: 'upstream_http_error' };
    }
    const result = await readLimitedJson(response, MAX_UPSTREAM_RESPONSE_BYTES);
    return result && result.ok === true
      ? { ok: true }
      : { ok: false, reason: 'upstream_rejected' };
  } catch (error) {
    return {
      ok: false,
      reason: error && error.name === 'AbortError'
        ? 'upstream_timeout'
        : 'upstream_request_failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function keyedHash(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function readLimitedJson(response, limit) {
  if (!response.body) {
    throw new Error('empty_response');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error('response_too_large');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text);
}

function requiredConfiguration(env) {
  const required = [
    'TURNSTILE_SECRET_KEY',
    'RATE_LIMIT_HASH_KEY',
    'UPSTREAM_URL',
    'UPSTREAM_SHARED_SECRET',
    'ALLOWED_HOSTNAMES',
    'UPSTREAM_ALLOWED_HOSTS',
  ];
  for (const key of required) {
    if (!env[key]) {
      return `${key.toLowerCase()}_missing`;
    }
  }
  if (!env.IP_RATE_LIMITER || !env.EMAIL_RATE_LIMITER) {
    return 'rate_limiter_binding_missing';
  }
  return null;
}

function getAllowedOrigin(origin, configuredOrigins) {
  if (!origin) {
    return null;
  }
  return csv(configuredOrigins).includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

function jsonResponse(body, status, origin, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  };
  if (origin) {
    Object.assign(headers, corsHeaders(origin));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function reject(requestId, reason, status, origin, fields) {
  audit('rejected', requestId, reason);
  const body = { ok: false, code: 'request_rejected' };
  if (fields) {
    body.fields = fields;
  }
  return jsonResponse(body, status, origin);
}

function audit(outcome, requestId, reason, actorKey = '') {
  const entry = {
    event: 'contact_submission',
    outcome,
    requestId,
    reason,
  };
  if (actorKey) {
    entry.actorHash = actorKey.slice(0, 16);
  }
  const serialized = JSON.stringify(entry);
  if (outcome === 'accepted') {
    console.log(serialized);
  } else if (outcome === 'rejected') {
    console.warn(serialized);
  } else {
    console.error(serialized);
  }
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidEmail(value) {
  if (value.length > 254 || /[\r\n]/.test(value)) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function countUrls(value) {
  return (value.match(/https?:\/\/|www\./gi) || []).length;
}

function safeErrorReason(error) {
  if (!error || typeof error !== 'object') {
    return 'unknown_error';
  }
  const allowed = new Set([
    'empty_response',
    'response_too_large',
    'SyntaxError',
    'TypeError',
  ]);
  if (allowed.has(error.message)) {
    return error.message;
  }
  if (allowed.has(error.name)) {
    return error.name;
  }
  return 'unexpected_error';
}
