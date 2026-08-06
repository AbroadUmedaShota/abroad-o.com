import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'apps-script', 'Code.gs'), 'utf8');

function createHarness(propertyOverrides = {}, options = {}) {
  const properties = {
    CONTACT_SHARED_SECRET: 'shared-secret-for-tests',
    CONTACT_SPREADSHEET_ID: 'spreadsheet-id',
    CONTACT_SHEET_NAME: 'お問い合わせ',
    CONTACT_NOTIFY_ENABLED: 'true',
    CONTACT_AUTOREPLY_ENABLED: 'false',
    CONTACT_NOTIFY_EMAILS: 'operations@example.invalid',
    ...propertyOverrides,
  };
  const rows = [];
  const sentEmails = [];
  const cache = new Map();
  const logs = [];
  let remainingMailFailures = options.mailFailures || 0;

  const sheet = {
    appendRow(row) {
      rows.push(row);
    },
    getLastRow() {
      return rows.length;
    },
    getParent() {
      return { getUrl: () => 'https://docs.google.com/spreadsheets/d/test' };
    },
    getSheetId() {
      return 123;
    },
    getRange(startRow, startColumn, rowCount = 1, columnCount = 1) {
      return {
        createTextFinder(searchValue) {
          let exact = false;
          return {
            matchEntireCell(value) {
              exact = value;
              return this;
            },
            findNext() {
              const values = rows.slice(startRow - 1, startRow - 1 + rowCount);
              const offset = values.findIndex((row) => {
                const cell = String(row[startColumn - 1] || '');
                return exact ? cell === searchValue : cell.includes(searchValue);
              });
              return offset >= 0 ? { getRow: () => startRow + offset } : null;
            },
          };
        },
        getValues() {
          return rows
            .slice(startRow - 1, startRow - 1 + rowCount)
            .map((row) => row.slice(startColumn - 1, startColumn - 1 + columnCount));
        },
        setValue(value) {
          rows[startRow - 1][startColumn - 1] = value;
          return this;
        },
      };
    },
  };

  const context = vm.createContext({
    console: {
      log: (value) => logs.push(String(value)),
      warn: (value) => logs.push(String(value)),
      error: (value) => logs.push(String(value)),
    },
    Utilities: {
      getUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      computeHmacSha256Signature(value, secret) {
        return [...crypto.createHmac('sha256', secret).update(value).digest()]
          .map((byte) => (byte > 127 ? byte - 256 : byte));
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty: (name) => properties[name] || null,
          setProperties(values) {
            Object.assign(properties, values);
            return this;
          },
        };
      },
    },
    Session: {
      getEffectiveUser() {
        return { getEmail: () => 'owner@example.invalid' };
      },
    },
    CacheService: {
      getScriptCache() {
        return {
          get: (key) => cache.get(key) || null,
          put: (key, value) => cache.set(key, value),
        };
      },
    },
    LockService: {
      getScriptLock() {
        return { tryLock: () => true, releaseLock: () => {} };
      },
    },
    SpreadsheetApp: {
      openById() {
        return { getSheetByName: () => sheet };
      },
    },
    MailApp: {
      getRemainingDailyQuota() {
        return 1499;
      },
      sendEmail(message) {
        if (remainingMailFailures > 0) {
          remainingMailFailures -= 1;
          throw new Error('mail_send_failed');
        }
        sentEmails.push(message);
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        return {
          text,
          setMimeType() {
            return this;
          },
        };
      },
    },
    Date,
    JSON,
    String,
    RegExp,
    Object,
    Array,
    Error,
  });
  vm.runInContext(source, context, { filename: 'Code.gs' });
  return { context, rows, sentEmails, cache, logs, properties };
}

test('Apps Script production setup preserves Script Properties recipients and enables both mail paths', () => {
  const harness = createHarness({ CONTACT_SHARED_SECRET: '' });
  const result = harness.context.configureContactReceiver(
    'spreadsheet-id-abcdefghijklmnop',
    'お問い合わせ',
  );

  assert.equal(result.ok, true);
  assert.match(result.sharedSecret, /^[0-9a-f]{96}$/);
  assert.equal(result.notificationEnabled, true);
  assert.equal(result.autoReplyEnabled, true);
  assert.equal(result.notificationRecipientCount, 1);
  assert.equal(harness.properties.CONTACT_NOTIFY_ENABLED, 'true');
  assert.equal(harness.properties.CONTACT_AUTOREPLY_ENABLED, 'true');
  assert.equal(harness.properties.CONTACT_NOTIFY_EMAILS, 'operations@example.invalid');

  const status = harness.context.getContactConfigurationStatus();
  assert.equal(status.ok, true);
  assert.equal(status.spreadsheetAccessible, true);
  assert.equal(status.remainingDailyMailQuota, 1499);
});

test('Apps Script production setup requires notification recipients in Script Properties', () => {
  const harness = createHarness({ CONTACT_NOTIFY_EMAILS: '' });
  assert.throws(
    () => harness.context.configureContactReceiver('spreadsheet-id-abcdefghijklmnop', 'お問い合わせ'),
    /notify_recipients_missing/,
  );
});

function signedEvent(fields = {}, controls = {}) {
  const payload = JSON.stringify({
    version: 1,
    requestId: '9f2208d4-6f4d-4d5a-86cc-572c690f4e25',
    receivedAt: '2026-08-03T00:00:00.000Z',
    fields: {
      enterprise: 'テスト株式会社',
      department: '営業部',
      name: 'テスト担当',
      email: 'visitor@example.net',
      phone: '03-1234-5678',
      address: '東京都',
      inquiryDetails: 'サービスについて相談したいです。',
      ...fields,
    },
    controls: {
      notificationEnabled: true,
      autoReplyEnabled: false,
      ...controls,
    },
  });
  const signature = crypto
    .createHmac('sha256', 'shared-secret-for-tests')
    .update(payload)
    .digest('hex');
  return { postData: { contents: JSON.stringify({ payload, signature }) } };
}

test('Apps Script receiver rejects an invalid signature before storage or mail', () => {
  const harness = createHarness();
  const event = signedEvent();
  const envelope = JSON.parse(event.postData.contents);
  envelope.signature = '0'.repeat(64);
  event.postData.contents = JSON.stringify(envelope);

  const result = harness.context.doPost(event);
  assert.deepEqual(JSON.parse(result.text), { ok: false, code: 'invalid_signature' });
  assert.equal(harness.rows.length, 0);
  assert.equal(harness.sentEmails.length, 0);
});

test('Apps Script receiver stores once, escapes formulas and keeps auto-reply disabled', () => {
  const harness = createHarness();
  const event = signedEvent({ enterprise: '=IMPORTDATA("https://example.test")' });

  const first = harness.context.doPost(event);
  assert.deepEqual(JSON.parse(first.text), { ok: true });
  assert.equal(harness.rows.length, 2);
  assert.equal(harness.rows[1][2].startsWith("'="), true);
  assert.equal(harness.rows[1][9], '完了');
  assert.equal(harness.rows[1][10], '停止');
  assert.match(harness.rows[1][11], /^[0-9a-f]{64}$/);
  assert.equal(harness.sentEmails.length, 1);
  assert.equal(harness.sentEmails[0].to, 'operations@example.invalid');

  // CacheService is only an optimization. Clearing it proves that the
  // Spreadsheet request-id index remains the durable idempotency boundary.
  harness.cache.clear();
  const second = harness.context.doPost(event);
  assert.deepEqual(JSON.parse(second.text), { ok: true, duplicate: true });
  assert.equal(harness.rows.length, 2);
  assert.equal(harness.sentEmails.length, 1);

  const logText = harness.logs.join('\n');
  assert.equal(logText.includes('visitor@example.net'), false);
  assert.equal(logText.includes('サービスについて相談'), false);
});

test('Apps Script receiver requires both signed controls and Script Properties for mail', () => {
  const harness = createHarness({
    CONTACT_NOTIFY_ENABLED: 'false',
    CONTACT_AUTOREPLY_ENABLED: 'false',
  });
  const result = harness.context.doPost(signedEvent({}, {
    notificationEnabled: true,
    autoReplyEnabled: true,
  }));

  assert.deepEqual(JSON.parse(result.text), { ok: true });
  assert.equal(harness.sentEmails.length, 0);
  assert.equal(harness.rows[1][9], '停止');
  assert.equal(harness.rows[1][10], '停止');
});

test('Apps Script receiver sends notification and auto-reply when both production gates are enabled', () => {
  const harness = createHarness({
    CONTACT_NOTIFY_ENABLED: 'true',
    CONTACT_AUTOREPLY_ENABLED: 'true',
  });
  const result = harness.context.doPost(signedEvent({}, {
    notificationEnabled: true,
    autoReplyEnabled: true,
  }));

  assert.deepEqual(JSON.parse(result.text), { ok: true });
  assert.equal(harness.sentEmails.length, 2);
  assert.equal(harness.sentEmails[0].to, 'operations@example.invalid');
  assert.equal(harness.sentEmails[1].to, 'visitor@example.net');
  assert.equal(harness.rows[1][9], '完了');
  assert.equal(harness.rows[1][10], '完了');
});

test('Apps Script receiver resumes a pending notification after a mail failure', () => {
  const harness = createHarness({}, { mailFailures: 1 });
  const event = signedEvent();

  const failed = harness.context.doPost(event);
  assert.deepEqual(JSON.parse(failed.text), { ok: false, code: 'receiver_error' });
  assert.equal(harness.rows.length, 2);
  assert.equal(harness.rows[1][9], '待機');
  assert.equal(harness.cache.size, 0);

  const retried = harness.context.doPost(event);
  assert.deepEqual(JSON.parse(retried.text), { ok: true, duplicate: true });
  assert.equal(harness.rows.length, 2);
  assert.equal(harness.rows[1][9], '完了');
  assert.equal(harness.sentEmails.length, 1);
});

test('Apps Script receiver honors an emergency mail stop before resuming pending work', () => {
  const harness = createHarness({
    CONTACT_NOTIFY_ENABLED: 'false',
    CONTACT_AUTOREPLY_ENABLED: 'true',
  }, { mailFailures: 1 });
  const event = signedEvent({}, {
    notificationEnabled: false,
    autoReplyEnabled: true,
  });

  const failed = harness.context.doPost(event);
  assert.deepEqual(JSON.parse(failed.text), { ok: false, code: 'receiver_error' });
  assert.equal(harness.rows[1][10], '待機');

  harness.properties.CONTACT_AUTOREPLY_ENABLED = 'false';
  const retried = harness.context.doPost(event);
  assert.deepEqual(JSON.parse(retried.text), { ok: true, duplicate: true });
  assert.equal(harness.rows[1][10], '停止');
  assert.equal(harness.sentEmails.length, 0);
});
