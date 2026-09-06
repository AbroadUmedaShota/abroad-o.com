import assert from 'node:assert/strict';
import test from 'node:test';

import {
  handleRequest,
  keyedHash,
  readLimitedText,
  validateSubmission,
} from '../src/index.js';

const ORIGIN = 'https://www.abroad-o.com';
const SUBMISSION_ID = '9f2208d4-6f4d-4d5a-86cc-572c690f4e25';

function validPayload(overrides = {}) {
  return {
    submissionId: SUBMISSION_ID,
    enterprise: 'テスト株式会社',
    department: '営業部',
    name: 'テスト担当',
    email: 'visitor@example.net',
    phone: '+81 3 1234 5678',
    address: '東京都',
    inquiryDetails: 'サービスについて相談したいです。',
    consent: true,
    website: '',
    formStartedAt: Date.now() - 5000,
    turnstileToken: 'valid-turnstile-token',
    ...overrides,
  };
}

function fakeLimiter(success = true) {
  return {
    calls: [],
    async limit(options) {
      this.calls.push(options);
      return { success };
    },
  };
}

function validEnv(overrides = {}) {
  return {
    ALLOWED_ORIGINS: `${ORIGIN},https://abroad-o.com`,
    ALLOWED_HOSTNAMES: 'www.abroad-o.com,abroad-o.com',
    UPSTREAM_ALLOWED_HOSTS: 'script.google.com',
    TURNSTILE_ACTION: 'contact-submit',
    TURNSTILE_SITE_KEY: 'public-site-key',
    TURNSTILE_SECRET_KEY: 'turnstile-secret-for-tests',
    RATE_LIMIT_HASH_KEY: 'rate-limit-secret-for-tests',
    UPSTREAM_URL: 'https://script.google.com/macros/s/test/exec',
    UPSTREAM_SHARED_SECRET: 'upstream-secret-for-tests',
    NOTIFY_ENABLED: 'true',
    AUTOREPLY_ENABLED: 'true',
    IP_RATE_LIMITER: fakeLimiter(),
    EMAIL_RATE_LIMITER: fakeLimiter(),
    ...overrides,
  };
}

function submitRequest(payload, headers = {}) {
  return new Request('https://contact.example/submit', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.42',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

function silenceAudit() {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  const entries = [];
  console.log = (value) => entries.push(String(value));
  console.warn = (value) => entries.push(String(value));
  console.error = (value) => entries.push(String(value));
  return {
    entries,
    restore() {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    },
  };
}

test('validates and normalizes a legitimate submission', () => {
  const result = validateSubmission(validPayload({
    enterprise: '  テスト株式会社  ',
    email: ' visitor@example.net ',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.enterprise, 'テスト株式会社');
  assert.equal(result.value.email, 'visitor@example.net');
});

test('rejects honeypot, fast submission, malformed fields and URL flooding', () => {
  assert.equal(validateSubmission(validPayload({ website: 'filled' })).reason, 'honeypot_filled');
  assert.equal(validateSubmission(validPayload({ formStartedAt: Date.now() - 100 })).reason, 'submission_too_fast');
  assert.equal(validateSubmission(validPayload({ email: 'invalid' })).reason, 'field_validation_failed');
  assert.equal(validateSubmission(validPayload({
    inquiryDetails: 'https://a.test https://b.test https://c.test https://d.test https://e.test https://f.test',
  })).reason, 'field_validation_failed');
});

test('returns form_expired as a safe client recovery code', async () => {
  const audit = silenceAudit();
  try {
    const response = await handleRequest(submitRequest(validPayload({
      formStartedAt: Date.now() - ((2 * 60 * 60 * 1000) + 1),
    })), validEnv());
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, code: 'form_expired' });
  } finally {
    audit.restore();
  }
});

test('reads request bodies at the byte boundary and cancels an oversized stream', async () => {
  const atLimit = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('a'.repeat(32 * 1024)));
      controller.close();
    },
  });
  assert.equal((await readLimitedText(atLimit, 32 * 1024)).length, 32 * 1024);

  let cancelled = false;
  const tooLarge = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('a'.repeat(16 * 1024)));
      controller.enqueue(new TextEncoder().encode('b'.repeat((16 * 1024) + 1)));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readLimitedText(tooLarge, 32 * 1024), { message: 'body_too_large' });
  assert.equal(cancelled, true);
});

test('serves public Turnstile configuration only to an allowed origin', async () => {
  const env = validEnv();
  const allowed = await handleRequest(new Request('https://contact.example/config', {
    headers: { Origin: ORIGIN },
  }), env);
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), {
    ok: true,
    turnstileSiteKey: 'public-site-key',
    turnstileAction: 'contact-submit',
  });

  const denied = await handleRequest(new Request('https://contact.example/config', {
    headers: { Origin: 'https://attacker.example' },
  }), env);
  assert.equal(denied.status, 403);
});

test('rejects tokenless requests before rate limit or upstream processing', async () => {
  const env = validEnv();
  const audit = silenceAudit();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('fetch must not be called');
  };
  try {
    const response = await handleRequest(submitRequest(validPayload({ turnstileToken: '' })), env);
    assert.equal(response.status, 400);
    assert.equal(fetchCalls, 0);
    assert.equal(env.IP_RATE_LIMITER.calls.length, 0);
    assert.equal(env.EMAIL_RATE_LIMITER.calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    audit.restore();
  }
});

test('rejects a request when either layered rate limit is exceeded', async () => {
  const env = validEnv({ IP_RATE_LIMITER: fakeLimiter(false) });
  const audit = silenceAudit();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('fetch must not be called');
  };
  try {
    const response = await handleRequest(submitRequest(validPayload()), env);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(fetchCalls, 0);
    assert.equal(env.IP_RATE_LIMITER.calls.length, 1);
    assert.equal(env.EMAIL_RATE_LIMITER.calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    audit.restore();
  }
});

test('rejects an invalid Turnstile result without contacting the receiver', async () => {
  const env = validEnv();
  const audit = silenceAudit();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
  };
  try {
    const response = await handleRequest(submitRequest(validPayload()), env);
    assert.equal(response.status, 400);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(env.IP_RATE_LIMITER.calls.length, 1);
    assert.equal(env.EMAIL_RATE_LIMITER.calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    audit.restore();
  }
});

test('applies the reply-address limit only after Turnstile succeeds', async () => {
  const env = validEnv({ EMAIL_RATE_LIMITER: fakeLimiter(false) });
  const audit = silenceAudit();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json({
      success: true,
      hostname: 'www.abroad-o.com',
      action: 'contact-submit',
    });
  };
  try {
    const response = await handleRequest(submitRequest(validPayload()), env);
    assert.equal(response.status, 429);
    assert.equal(calls.length, 1);
    assert.equal(env.IP_RATE_LIMITER.calls.length, 1);
    assert.equal(env.EMAIL_RATE_LIMITER.calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    audit.restore();
  }
});

test('forwards a valid request with an HMAC signature and safe control flags', async () => {
  const env = validEnv();
  const audit = silenceAudit();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/siteverify')) {
      return Response.json({
        success: true,
        hostname: 'www.abroad-o.com',
        action: 'contact-submit',
      });
    }
    return Response.json({ ok: true });
  };

  try {
    const response = await handleRequest(submitRequest(validPayload()), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, requestId: SUBMISSION_ID });
    assert.equal(calls.length, 2);

    const envelope = JSON.parse(calls[1].options.body);
    const payload = JSON.parse(envelope.payload);
    assert.equal(payload.requestId, SUBMISSION_ID);
    assert.equal(payload.controls.notificationEnabled, true);
    assert.equal(payload.controls.autoReplyEnabled, true);
    assert.equal(
      envelope.signature,
      await keyedHash(env.UPSTREAM_SHARED_SECRET, envelope.payload),
    );

    const auditText = audit.entries.join('\n');
    assert.equal(auditText.includes('visitor@example.net'), false);
    assert.equal(auditText.includes('サービスについて相談'), false);
  } finally {
    globalThis.fetch = originalFetch;
    audit.restore();
  }
});

test('propagates approved receiver recovery codes without changing success compatibility', async () => {
  for (const [code, status] of [
    ['request_id_conflict', 409],
    ['delivery_review_required', 202],
  ]) {
    const env = validEnv();
    const audit = silenceAudit();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => String(url).includes('/siteverify')
      ? Response.json({ success: true, hostname: 'www.abroad-o.com', action: 'contact-submit' })
      : Response.json({ ok: false, code });
    try {
      const response = await handleRequest(submitRequest(validPayload()), env);
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { ok: false, code });
    } finally {
      globalThis.fetch = originalFetch;
      audit.restore();
    }
  }
});

test('fails closed when required secrets or bindings are missing', async () => {
  const env = validEnv({ TURNSTILE_SECRET_KEY: '' });
  const audit = silenceAudit();
  try {
    const response = await handleRequest(submitRequest(validPayload()), env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, code: 'service_unavailable' });
  } finally {
    audit.restore();
  }
});
