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
      if (cache.get(cacheKey)) {
        return json_({ ok: true, duplicate: true });
      }

      const sheet = getContactSheet_(properties);
      ensureHeaders_(sheet);
      const fingerprint = payloadFingerprint_(payload, secret);
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
        resumeDelivery_(properties, payload, sheet, existingRowNumber, deliveryState);
        cache.put(cacheKey, 'accepted', 21600);
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
      resumeDelivery_(properties, payload, sheet, rowNumber, [
        notifyEnabled ? '待機' : '停止',
        autoReplyEnabled ? '待機' : '停止',
        fingerprint,
      ]);
      cache.put(cacheKey, 'accepted', 21600);

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
  if (deliveryState[0] === '待機') {
    const notifyStillEnabled = propertyIsTrue_(properties, 'CONTACT_NOTIFY_ENABLED')
      && payload.controls.notificationEnabled === true;
    if (notifyStillEnabled) {
      sendInternalNotification_(properties, payload, sheet, rowNumber);
      sheet.getRange(rowNumber, 10).setValue('完了');
    } else {
      sheet.getRange(rowNumber, 10).setValue('停止');
    }
  }
  if (deliveryState[1] === '待機') {
    const autoReplyStillEnabled = propertyIsTrue_(properties, 'CONTACT_AUTOREPLY_ENABLED')
      && payload.controls.autoReplyEnabled === true;
    if (autoReplyStillEnabled) {
      sendAutoReply_(properties, payload);
      sheet.getRange(rowNumber, 11).setValue('完了');
    } else {
      sheet.getRange(rowNumber, 11).setValue('停止');
    }
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
  const subject = '[問い合わせ] ' + safeSubjectPart_(fields.enterprise) + ' / ' + safeSubjectPart_(fields.name);
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
  const body = [
    fields.name + ' 様',
    '',
    'お問い合わせを受け付けました。',
    '内容を確認のうえ、担当者からご連絡いたします。',
    '',
    '受付ID: ' + payload.requestId,
    '',
    'このメールに心当たりがない場合は、返信せず削除してください。',
  ].join('\n');

  MailApp.sendEmail({
    to: fields.email,
    subject: 'お問い合わせを受け付けました',
    body: body,
    name: properties.getProperty('CONTACT_FROM_NAME') || 'アブロードアウトソーシング株式会社',
  });
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
  return Utilities.computeHmacSha256Signature(value, secret)
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
