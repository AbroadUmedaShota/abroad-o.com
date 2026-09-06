const CONTACT_HEADERS = [
  '受付日時',
  '受付ID',
  '企業名',
  '部署・役職',
  'お名前',
  'メールアドレス',
  '電話番号',
  '住所',
  'お問い合わせ内容',
  '内部通知状態',
  '自動返信状態',
  '内容指紋',
];

const CONTACT_AUTOREPLY_RANGE_NAME = 'CONTACT_AUTOREPLY_PUBLISHED';
const CONTACT_AUTOREPLY_SUBJECT_MAX = 150;
const CONTACT_AUTOREPLY_BODY_MAX = 20000;
const CONTACT_AUTOREPLY_PLACEHOLDERS = [
  '{{お名前}}',
  '{{お問い合わせ日時}}',
  '{{受付ID}}',
  '{{貴社名}}',
  '{{部署・役職}}',
  '{{メールアドレス}}',
  '{{電話番号}}',
  '{{住所}}',
  '{{お問い合わせ内容}}',
];

/**
 * One-time authorization helper for deployments created through clasp.
 * Run this from the Apps Script editor as the deploying account. It requests
 * the manifest scopes without reading or sending inquiry data.
 */
function authorizeContactReceiver() {
  const effectiveUserAvailable = Boolean(Session.getEffectiveUser().getEmail());
  const remainingDailyMailQuota = MailApp.getRemainingDailyQuota();
  SpreadsheetApp.getActiveSpreadsheet();
  return {
    ok: effectiveUserAvailable,
    remainingDailyMailQuota: remainingDailyMailQuota,
  };
}

/**
 * Initializes the production receiver after its notification recipients have
 * been configured in Script Properties.
 * This function is callable only through the MYSELF-scoped Execution API.
 * The returned shared secret must be transferred directly to the Worker secret
 * binding and must never be written to source control or logs.
 */
function configureContactReceiver(spreadsheetId, sheetName) {
  const normalizedSpreadsheetId = String(spreadsheetId || '').trim();
  const normalizedSheetName = String(sheetName || 'お問い合わせ').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(normalizedSpreadsheetId)) {
    throw new Error('invalid_spreadsheet_id');
  }
  if (!normalizedSheetName || normalizedSheetName.length > 100) {
    throw new Error('invalid_sheet_name');
  }

  const properties = PropertiesService.getScriptProperties();
  const recipients = splitEmailList_(properties.getProperty('CONTACT_NOTIFY_EMAILS'));
  if (recipients.length === 0) {
    throw new Error('notify_recipients_missing');
  }
  const sharedSecret = properties.getProperty('CONTACT_SHARED_SECRET') || [
    Utilities.getUuid(),
    Utilities.getUuid(),
    Utilities.getUuid(),
  ].join('').replace(/-/g, '');

  properties.setProperties({
    CONTACT_SHARED_SECRET: sharedSecret,
    CONTACT_SPREADSHEET_ID: normalizedSpreadsheetId,
    CONTACT_SHEET_NAME: normalizedSheetName,
    CONTACT_NOTIFY_ENABLED: 'true',
    CONTACT_AUTOREPLY_ENABLED: 'true',
    CONTACT_FROM_NAME: 'アブロードアウトソーシング株式会社',
  });

  const sheet = getContactSheet_(properties);
  ensureHeaders_(sheet);
  return {
    ok: true,
    sharedSecret: sharedSecret,
    notificationEnabled: true,
    autoReplyEnabled: true,
    notificationRecipientCount: recipients.length,
  };
}

function getContactConfigurationStatus() {
  const properties = PropertiesService.getScriptProperties();
  const recipients = splitEmailList_(properties.getProperty('CONTACT_NOTIFY_EMAILS'));
  const sheet = getContactSheet_(properties);
  return {
    ok: Boolean(properties.getProperty('CONTACT_SHARED_SECRET')),
    spreadsheetAccessible: Boolean(sheet),
    notificationEnabled: propertyIsTrue_(properties, 'CONTACT_NOTIFY_ENABLED'),
    autoReplyEnabled: propertyIsTrue_(properties, 'CONTACT_AUTOREPLY_ENABLED'),
    notificationRecipientCount: recipients.length,
    remainingDailyMailQuota: MailApp.getRemainingDailyQuota(),
  };
}

function doPost(event) {
  const fallbackRequestId = Utilities.getUuid();
  try {
    const properties = PropertiesService.getScriptProperties();
    const envelope = JSON.parse(event && event.postData ? event.postData.contents : '');
    const secret = requireProperty_(properties, 'CONTACT_SHARED_SECRET');
    if (!envelope || typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') {
      return json_({ ok: false, code: 'invalid_envelope' });
    }

    const expectedSignature = hmacHex_(envelope.payload, secret);
    if (!constantTimeHexEqual_(expectedSignature, envelope.signature)) {
      console.warn(JSON.stringify({ event: 'contact_receiver', outcome: 'rejected', reason: 'invalid_signature' }));
      return json_({ ok: false, code: 'invalid_signature' });
    }

    const payload = JSON.parse(envelope.payload);
    validatePayload_(payload);
    const requestId = payload.requestId || fallbackRequestId;
    const cache = CacheService.getScriptCache();
    const cacheKey = 'contact:' + requestId;

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      return json_({ ok: false, code: 'receiver_busy' });
    }

    try {
      const fingerprint = payloadFingerprint_(payload, secret);
      const cachedFingerprint = cache.get(cacheKey);
      if (cachedFingerprint && !constantTimeHexEqual_(cachedFingerprint, fingerprint)) {
        console.warn(JSON.stringify({
          event: 'contact_receiver',
          outcome: 'rejected',
          reason: 'request_id_conflict',
          requestId: requestId,
        }));
        return json_({ ok: false, code: 'request_id_conflict' });
      }

      const sheet = getContactSheet_(properties);
      ensureHeaders_(sheet);
      const existingCell = findRequestRow_(sheet, requestId);
      if (existingCell) {
        const existingRowNumber = existingCell.getRow();
        const deliveryState = sheet.getRange(existingRowNumber, 10, 1, 3).getValues()[0];
        if (!constantTimeHexEqual_(String(deliveryState[2] || ''), fingerprint)) {
          console.warn(JSON.stringify({
            event: 'contact_receiver',
            outcome: 'rejected',
            reason: 'request_id_conflict',
            requestId: requestId,
          }));
          return json_({ ok: false, code: 'request_id_conflict' });
        }
        const delivery = resumeDelivery_(properties, payload, sheet, existingRowNumber, deliveryState);
        if (delivery.requiresReview) {
          return json_({ ok: false, code: 'delivery_review_required', duplicate: true });
        }
        cache.put(cacheKey, fingerprint, 21600);
        console.log(JSON.stringify({
          event: 'contact_receiver',
          outcome: 'duplicate',
          requestId: requestId,
        }));
        return json_({ ok: true, duplicate: true });
      }
      const notifyEnabled = propertyIsTrue_(properties, 'CONTACT_NOTIFY_ENABLED')
        && payload.controls.notificationEnabled === true;
      const autoReplyEnabled = propertyIsTrue_(properties, 'CONTACT_AUTOREPLY_ENABLED')
        && payload.controls.autoReplyEnabled === true;

      sheet.appendRow(buildRow_(payload, notifyEnabled, autoReplyEnabled, fingerprint));
      const rowNumber = sheet.getLastRow();
      const delivery = resumeDelivery_(properties, payload, sheet, rowNumber, [
        notifyEnabled ? '待機' : '停止',
        autoReplyEnabled ? '待機' : '停止',
        fingerprint,
      ]);
      if (delivery.requiresReview) {
        return json_({ ok: false, code: 'delivery_review_required' });
      }
      cache.put(cacheKey, fingerprint, 21600);

      console.log(JSON.stringify({
        event: 'contact_receiver',
        outcome: 'accepted',
        requestId: requestId,
        notificationEnabled: notifyEnabled,
        autoReplyEnabled: autoReplyEnabled,
      }));
      return json_({ ok: true });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: 'contact_receiver',
      outcome: 'error',
      requestId: fallbackRequestId,
      reason: safeErrorReason_(error),
    }));
    return json_({ ok: false, code: 'receiver_error' });
  }
}

function validatePayload_(payload) {
  if (!payload || payload.version !== 1 || !payload.fields || !payload.controls) {
    throw new Error('invalid_payload');
  }
  if (!/^[0-9a-f-]{36}$/i.test(String(payload.requestId || ''))) {
    throw new Error('invalid_request_id');
  }

  const fields = payload.fields;
  const limits = {
    enterprise: 120,
    department: 120,
    name: 80,
    email: 254,
    phone: 30,
    address: 500,
    inquiryDetails: 4000,
  };
  Object.keys(limits).forEach(function (field) {
    if (typeof fields[field] !== 'string' || fields[field].length > limits[field]) {
      throw new Error('invalid_field_' + field);
    }
  });
  if (!fields.enterprise || !fields.name || !fields.email || !fields.phone || !fields.inquiryDetails) {
    throw new Error('required_field_missing');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email) || /[\r\n]/.test(fields.email)) {
    throw new Error('invalid_email');
  }
}

function getContactSheet_(properties) {
  const spreadsheetId = requireProperty_(properties, 'CONTACT_SPREADSHEET_ID');
  const sheetName = requireProperty_(properties, 'CONTACT_SHEET_NAME');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('contact_sheet_not_found');
  }
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONTACT_HEADERS);
  }
}

function findRequestRow_(sheet, requestId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }
  return sheet
    .getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(requestId)
    .matchEntireCell(true)
    .findNext();
}

function buildRow_(payload, notifyEnabled, autoReplyEnabled, fingerprint) {
  const fields = payload.fields;
  return [
    new Date(payload.receivedAt),
    escapeSheetValue_(payload.requestId),
    escapeSheetValue_(fields.enterprise),
    escapeSheetValue_(fields.department),
    escapeSheetValue_(fields.name),
    escapeSheetValue_(fields.email),
    escapeSheetValue_(fields.phone),
    escapeSheetValue_(fields.address),
    escapeSheetValue_(fields.inquiryDetails),
    notifyEnabled ? '待機' : '停止',
    autoReplyEnabled ? '待機' : '停止',
    fingerprint,
  ];
}

function resumeDelivery_(properties, payload, sheet, rowNumber, deliveryState) {
  const notification = deliverMailChannel_(
    sheet,
    rowNumber,
    10,
    deliveryState[0],
    propertyIsTrue_(properties, 'CONTACT_NOTIFY_ENABLED') && payload.controls.notificationEnabled === true,
    function () { sendInternalNotification_(properties, payload, sheet, rowNumber); }
  );
  const autoReply = deliverMailChannel_(
    sheet,
    rowNumber,
    11,
    deliveryState[1],
    propertyIsTrue_(properties, 'CONTACT_AUTOREPLY_ENABLED') && payload.controls.autoReplyEnabled === true,
    function () { sendAutoReply_(properties, payload); }
  );
  return { requiresReview: notification.requiresReview || autoReply.requiresReview };
}

function deliverMailChannel_(sheet, rowNumber, column, state, enabled, send) {
  if (state === '送信中' || state === '結果不明') {
    return { requiresReview: true };
  }
  if (state === '完了' || state === '停止') {
    return { requiresReview: false };
  }
  if (state !== '待機') {
    return { requiresReview: true };
  }
  if (!enabled) {
    try {
      setDeliveryState_(sheet, rowNumber, column, '停止');
      return { requiresReview: false };
    } catch (error) {
      return { requiresReview: true };
    }
  }

  try {
    setDeliveryState_(sheet, rowNumber, column, '送信中');
  } catch (error) {
    // No mail has been handed to MailApp. An operator may reset a confirmed-
    // unsent row to 待機, after checking the actual sheet state.
    return { requiresReview: true };
  }

  try {
    send();
  } catch (error) {
    markDeliveryResultUnknown_(sheet, rowNumber, column);
    return { requiresReview: true };
  }

  try {
    setDeliveryState_(sheet, rowNumber, column, '完了');
    return { requiresReview: false };
  } catch (error) {
    markDeliveryResultUnknown_(sheet, rowNumber, column);
    return { requiresReview: true };
  }
}

function setDeliveryState_(sheet, rowNumber, column, state) {
  sheet.getRange(rowNumber, column).setValue(state);
  SpreadsheetApp.flush();
}

function markDeliveryResultUnknown_(sheet, rowNumber, column) {
  try {
    setDeliveryState_(sheet, rowNumber, column, '結果不明');
  } catch (error) {
    // Keep the persisted 送信中 state when the ambiguity marker cannot be saved.
  }
}

function payloadFingerprint_(payload, secret) {
  return hmacHex_(JSON.stringify({
    requestId: payload.requestId,
    fields: payload.fields,
  }), secret);
}

function sendInternalNotification_(properties, payload, sheet, rowNumber) {
  const recipients = splitEmailList_(requireProperty_(properties, 'CONTACT_NOTIFY_EMAILS'));
  if (recipients.length === 0) {
    throw new Error('notify_recipients_missing');
  }

  const fields = payload.fields;
  const rowUrl = sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + rowNumber;
  const subject = '[abroad-o.com 問い合わせ受付] ' + safeSubjectPart_(fields.enterprise) + ' / ' + safeSubjectPart_(fields.name);
  const body = [
    'Webサイトから問い合わせを受け付けました。',
    '',
    '受付ID: ' + payload.requestId,
    '企業名: ' + fields.enterprise,
    '部署・役職: ' + fields.department,
    'お名前: ' + fields.name,
    'メールアドレス: ' + fields.email,
    '電話番号: ' + fields.phone,
    '住所: ' + fields.address,
    '',
    'お問い合わせ内容:',
    fields.inquiryDetails,
    '',
    '回答行: ' + rowUrl,
    '',
    'サービス番号：ABOHPQF2024',
  ].join('\n');

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: subject,
    body: body,
    name: properties.getProperty('CONTACT_FROM_NAME') || 'Webサイト問い合わせ',
  });
}

function sendAutoReply_(properties, payload) {
  const fields = payload.fields;
  const receivedAt = Utilities.formatDate(
    new Date(payload.receivedAt),
    'Asia/Tokyo',
    'yyyy/M/d H:mm:ss'
  );
  const template = getPublishedAutoReplyTemplate_(properties);
  const replacements = {
    '{{お名前}}': fields.name,
    '{{お問い合わせ日時}}': receivedAt,
    '{{受付ID}}': payload.requestId,
    '{{貴社名}}': fields.enterprise,
    '{{部署・役職}}': fields.department,
    '{{メールアドレス}}': fields.email,
    '{{電話番号}}': fields.phone,
    '{{住所}}': fields.address,
    '{{お問い合わせ内容}}': fields.inquiryDetails,
  };
  const subject = renderMailTemplate_(template.subject, replacements)
    .replace(/[\r\n]+/g, ' ')
    .slice(0, CONTACT_AUTOREPLY_SUBJECT_MAX);
  const body = renderMailTemplate_(template.body, replacements);

  MailApp.sendEmail({
    to: fields.email,
    subject: subject,
    body: body,
    name: properties.getProperty('CONTACT_FROM_NAME') || 'アブロードアウトソーシング株式会社',
  });
}

function getPublishedAutoReplyTemplate_(properties) {
  const fallback = defaultAutoReplyTemplate_();
  try {
    const spreadsheetId = requireProperty_(properties, 'CONTACT_SPREADSHEET_ID');
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const range = spreadsheet.getRangeByName(CONTACT_AUTOREPLY_RANGE_NAME);
    if (!range) {
      throw new Error('template_range_missing');
    }
    const values = range.getValues();
    if (values.length !== 1 || values[0].length < 5) {
      throw new Error('template_range_invalid');
    }
    const row = values[0];
    const template = {
      version: Number(row[0]),
      subject: String(row[1] == null ? '' : row[1]),
      body: String(row[2] == null ? '' : row[2]),
    };
    const reason = validateAutoReplyTemplate_(template);
    if (reason) {
      throw new Error(reason);
    }
    return template;
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'contact_template',
      outcome: 'template_fallback',
      reason: safeTemplateErrorReason_(error),
    }));
    return fallback;
  }
}

function validateAutoReplyTemplate_(template) {
  if (!template || !Number.isInteger(template.version) || template.version < 1) {
    return 'template_version_invalid';
  }
  if (!template.subject || template.subject.length > CONTACT_AUTOREPLY_SUBJECT_MAX) {
    return 'template_subject_invalid';
  }
  if (/[\r\n]/.test(template.subject)) {
    return 'template_subject_newline';
  }
  if (!template.body || template.body.length > CONTACT_AUTOREPLY_BODY_MAX) {
    return 'template_body_invalid';
  }

  const combined = template.subject + '\n' + template.body;
  const found = combined.match(/\{\{[^{}]+\}\}/g) || [];
  const unknown = found.some(function (placeholder) {
    return CONTACT_AUTOREPLY_PLACEHOLDERS.indexOf(placeholder) < 0;
  });
  if (unknown || /\{\{|\}\}/.test(combined.replace(/\{\{[^{}]+\}\}/g, ''))) {
    return 'template_placeholder_invalid';
  }
  const missing = CONTACT_AUTOREPLY_PLACEHOLDERS.some(function (placeholder) {
    return template.body.indexOf(placeholder) < 0;
  });
  return missing ? 'template_placeholder_missing' : '';
}

function renderMailTemplate_(template, replacements) {
  return String(template).replace(/\{\{[^{}]+\}\}/g, function (placeholder) {
    return Object.prototype.hasOwnProperty.call(replacements, placeholder)
      ? String(replacements[placeholder] == null ? '' : replacements[placeholder])
      : placeholder;
  });
}

function defaultAutoReplyTemplate_() {
  return {
    version: 1,
    subject: '【Abroad】お問い合わせありがとうございます',
    body: [
    '{{お名前}} 様',
    '',
    'この度はアブロードアウトソーシング株式会社にお問い合わせいただき、誠にありがとうございます。',
    '',
    '以下の内容でお問い合わせを承りました：',
    '',
    'お問い合わせ日時：{{お問い合わせ日時}}',
    '受付ID：{{受付ID}}',
    '貴社名：{{貴社名}}',
    '部署・役職：{{部署・役職}}',
    'お名前：{{お名前}}',
    'メールアドレス：{{メールアドレス}}',
    '電話番号：{{電話番号}}',
    '住所：{{住所}}',
    'お問い合わせ内容：',
    '{{お問い合わせ内容}}',
    '',
    '内容を確認の上、２営業日以内に担当者より順次ご連絡させていただきます。',
    '',
    'また、ご記入いただいたメールアドレスに誤りがある場合、弊社からの返信が届かない可能性がございます。',
    'メールアドレスに誤りがないかご確認いただき、数日経っても弊社からの返信がない場合は、お手数ではございますが、以下のメールアドレスまでお問い合わせ下さい。',
    '',
    'info@abroad-o.com',
    '',
    'このメールに心当たりがない場合は、返信せず削除してください。',
    '',
    '今後ともご愛顧賜りますよう、よろしくお願い申し上げます。',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'アブロードアウトソーシング株式会社',
    '〒101-0032',
    '東京都千代田区岩本町2-11-9　IT2ビル8階',
    'TEL：03-5835-0250',
    'FAX：03-3863-2570',
    'Email: info@abroad-o.com',
    'Website: www.abroad-o.com',
    'プライバシーマーク認定(10862401(06))',
    'ISMS（情報セキュリティマネジメントシステム）',
    'ISO/IEC 27001:2022 / JIS Q 27001:2023',
    'QMS（品質マネジメントシステム）',
    'ISO 9001:2015 & JIS Q 9001:2015',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '※本メールは自動送信されています。',
    'このメールへの返信はお受けできませんので、あらかじめご了承ください。',
    'サービス番号：ABOHPQF2024',
    ].join('\n'),
  };
}

function safeTemplateErrorReason_(error) {
  const message = error && error.message ? String(error.message) : '';
  return /^template_[a-z_]+$/.test(message) ? message : 'template_unavailable';
}

function escapeSheetValue_(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function safeSubjectPart_(value) {
  return String(value || '').replace(/[\r\n]/g, ' ').slice(0, 80);
}

function splitEmailList_(value) {
  return String(value || '')
    .split(/[;,\n]/)
    .map(function (item) { return item.trim(); })
    .filter(function (item) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(item); });
}

function requireProperty_(properties, name) {
  const value = properties.getProperty(name);
  if (!value) {
    throw new Error(name.toLowerCase() + '_missing');
  }
  return value;
}

function propertyIsTrue_(properties, name) {
  return properties.getProperty(name) === 'true';
}

function hmacHex_(value, secret) {
  return Utilities.computeHmacSha256Signature(value, secret, Utilities.Charset.UTF_8)
    .map(function (byte) {
      const normalized = byte < 0 ? byte + 256 : byte;
      return normalized.toString(16).padStart(2, '0');
    })
    .join('');
}

function constantTimeHexEqual_(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function safeErrorReason_(error) {
  const allowed = [
    'invalid_payload',
    'invalid_request_id',
    'required_field_missing',
    'invalid_email',
    'contact_sheet_not_found',
    'notify_recipients_missing',
  ];
  const message = error && error.message ? error.message : 'unknown_error';
  if (allowed.indexOf(message) >= 0 || /_missing$/.test(message) || /^invalid_field_/.test(message)) {
    return message;
  }
  return 'unexpected_error';
}

function json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
