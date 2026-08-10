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
  const publishedTemplate = options.publishedTemplate || null;
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

  const spreadsheet = {
    getSheetByName() {
      return sheet;
    },
    getRangeByName(name) {
      if (name !== 'CONTACT_AUTOREPLY_PUBLISHED' || !publishedTemplate) {
        return null;
      }
      return {
        getValues() {
          return [publishedTemplate];
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
      Charset: { UTF_8: 'UTF_8' },
      getUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      formatDate(date, timeZone, format) {
        assert.equal(timeZone, 'Asia/Tokyo');
        assert.equal(format, 'yyyy/M/d H:mm:ss');
        const parts = new Intl.DateTimeFormat('ja-JP', {
          timeZone,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        }).formatToParts(date);
        const part = (type) => parts.find((item) => item.type === type).value;
        return `${part('year')}/${part('month')}/${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
      },
      computeHmacSha256Signature(value, secret, charset) {
        if (/[^\x00-\x7f]/.test(value) && charset !== 'UTF_8') {
          throw new Error('utf8_charset_required');
        }
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
        return spreadsheet;
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

test('Apps Script receiver rejects changed content when the duplicate cache is populated', () => {
  const harness = createHarness();
  const first = harness.context.doPost(signedEvent());
  assert.deepEqual(JSON.parse(first.text), { ok: true });
  assert.equal(harness.cache.size, 1);

  const conflict = harness.context.doPost(signedEvent({
    inquiryDetails: '内容を変更した再送です。',
  }));
  assert.deepEqual(JSON.parse(conflict.text), { ok: false, code: 'request_id_conflict' });
  assert.equal(harness.rows.length, 2);
  assert.equal(harness.sentEmails.length, 1);
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
  assert.equal(
    harness.sentEmails[0].subject,
    '[abroad-o.com 問い合わせ受付] テスト株式会社 / テスト担当'
  );
  assert.match(
    harness.sentEmails[0].body,
    /回答行: https:\/\/docs\.google\.com\/spreadsheets\/d\/test#gid=123&range=A2\n\nサービス番号：ABOHPQF2024$/
  );
  assert.equal(harness.sentEmails[1].to, 'visitor@example.net');
  assert.equal(harness.rows[1][9], '完了');
  assert.equal(harness.rows[1][10], '完了');
});

test('Apps Script auto-reply includes the received inquiry in the legacy field order', () => {
  const harness = createHarness({
    CONTACT_NOTIFY_ENABLED: 'false',
    CONTACT_AUTOREPLY_ENABLED: 'true',
    CONTACT_FROM_NAME: 'アブロードアウトソーシング株式会社',
  });
  const result = harness.context.doPost(signedEvent({
    inquiryDetails: '一行目のご相談です。\n二行目もそのまま返してください。',
  }, {
    notificationEnabled: false,
    autoReplyEnabled: true,
  }));

  assert.deepEqual(JSON.parse(result.text), { ok: true });
  assert.equal(harness.sentEmails.length, 1);
  assert.equal(harness.sentEmails[0].to, 'visitor@example.net');
  assert.equal(harness.sentEmails[0].subject, '【Abroad】お問い合わせありがとうございます');
  assert.equal(harness.sentEmails[0].name, 'アブロードアウトソーシング株式会社');

  const body = harness.sentEmails[0].body;
  const expectedBody = `テスト担当 様

この度はアブロードアウトソーシング株式会社にお問い合わせいただき、誠にありがとうございます。

以下の内容でお問い合わせを承りました：

お問い合わせ日時：2026/8/3 9:00:00
受付ID：9f2208d4-6f4d-4d5a-86cc-572c690f4e25
貴社名：テスト株式会社
部署・役職：営業部
お名前：テスト担当
メールアドレス：visitor@example.net
電話番号：03-1234-5678
住所：東京都
お問い合わせ内容：
一行目のご相談です。
二行目もそのまま返してください。

内容を確認の上、２営業日以内に担当者より順次ご連絡させていただきます。

また、ご記入いただいたメールアドレスに誤りがある場合、弊社からの返信が届かない可能性がございます。
メールアドレスに誤りがないかご確認いただき、数日経っても弊社からの返信がない場合は、お手数ではございますが、以下のメールアドレスまでお問い合わせ下さい。

info@abroad-o.com

このメールに心当たりがない場合は、返信せず削除してください。

今後ともご愛顧賜りますよう、よろしくお願い申し上げます。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
アブロードアウトソーシング株式会社
〒101-0032
東京都千代田区岩本町2-11-9　IT2ビル8階
TEL：03-5835-0250
FAX：03-3863-2570
Email: info@abroad-o.com
Website: www.abroad-o.com
プライバシーマーク認定(10862401(06))
ISMS（情報セキュリティマネジメントシステム）
ISO/IEC 27001:2022 / JIS Q 27001:2023
QMS（品質マネジメントシステム）
ISO 9001:2015 & JIS Q 9001:2015
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

※本メールは自動送信されています。
このメールへの返信はお受けできませんので、あらかじめご了承ください。
サービス番号：ABOHPQF2024`;
  assert.equal(body, expectedBody);
});

test('Apps Script auto-reply keeps labels for blank optional fields', () => {
  const harness = createHarness({
    CONTACT_NOTIFY_ENABLED: 'false',
    CONTACT_AUTOREPLY_ENABLED: 'true',
  });
  harness.context.doPost(signedEvent({ department: '', address: '' }, {
    notificationEnabled: false,
    autoReplyEnabled: true,
  }));

  const body = harness.sentEmails[0].body;
  assert.match(body, /\n部署・役職：\n/);
  assert.match(body, /\n住所：\n/);
});

test('Apps Script auto-reply renders the published spreadsheet template', () => {
  const publishedTemplate = [
    7,
    '受付完了：{{貴社名}}',
    [
      '{{お名前}} 様',
      '受付日時={{お問い合わせ日時}}',
      '受付ID={{受付ID}}',
      '貴社名={{貴社名}}',
      '部署・役職={{部署・役職}}',
      'お名前={{お名前}}',
      'メールアドレス={{メールアドレス}}',
      '電話番号={{電話番号}}',
      '住所={{住所}}',
      'お問い合わせ内容：',
      '{{お問い合わせ内容}}',
    ].join('\n'),
    new Date('2026-08-09T00:00:00.000Z'),
    'editor@example.invalid',
  ];
  const harness = createHarness({
    CONTACT_NOTIFY_ENABLED: 'false',
    CONTACT_AUTOREPLY_ENABLED: 'true',
  }, { publishedTemplate });

  harness.context.doPost(signedEvent({
    inquiryDetails: '一行目\n二行目に {{受付ID}} と記載',
  }, {
    notificationEnabled: false,
    autoReplyEnabled: true,
  }));

  assert.equal(harness.sentEmails.length, 1);
  assert.equal(harness.sentEmails[0].subject, '受付完了：テスト株式会社');
  assert.match(harness.sentEmails[0].body, /受付日時=2026\/8\/3 9:00:00/);
  assert.match(harness.sentEmails[0].body, /一行目\n二行目に \{\{受付ID\}\} と記載/);
  assert.equal(harness.logs.some((entry) => entry.includes('template_fallback')), false);
});

test('Apps Script auto-reply falls back safely when the published template is invalid', () => {
  const publishedTemplate = [
    8,
    '不正な件名 {{未知}}',
    '{{お名前}} 様だけの不完全な本文',
    new Date('2026-08-09T00:00:00.000Z'),
    'editor@example.invalid',
  ];
  const harness = createHarness({
    CONTACT_NOTIFY_ENABLED: 'false',
    CONTACT_AUTOREPLY_ENABLED: 'true',
  }, { publishedTemplate });

  harness.context.doPost(signedEvent({}, {
    notificationEnabled: false,
    autoReplyEnabled: true,
  }));

  assert.equal(harness.sentEmails[0].subject, '【Abroad】お問い合わせありがとうございます');
  assert.match(harness.sentEmails[0].body, /以下の内容でお問い合わせを承りました/);
  const logText = harness.logs.join('\n');
  assert.match(logText, /template_fallback/);
  assert.equal(logText.includes('不正な件名'), false);
  assert.equal(logText.includes('テスト株式会社'), false);
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
