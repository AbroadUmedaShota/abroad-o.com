const MAIL_TEMPLATE_SHEET_NAME = 'メールテンプレート';
const MAIL_TEMPLATE_PUBLISHED_SHEET_NAME = '_メールテンプレート公開';
const MAIL_TEMPLATE_HISTORY_SHEET_NAME = 'メールテンプレート履歴';
const MAIL_TEMPLATE_PUBLISHED_RANGE = 'CONTACT_AUTOREPLY_PUBLISHED';
const MAIL_TEMPLATE_DRAFT_SUBJECT_RANGE = 'CONTACT_AUTOREPLY_DRAFT_SUBJECT';
const MAIL_TEMPLATE_DRAFT_BODY_RANGE = 'CONTACT_AUTOREPLY_DRAFT_BODY';
const MAIL_TEMPLATE_SUBJECT_MAX = 150;
const MAIL_TEMPLATE_BODY_MAX = 20000;
const MAIL_TEMPLATE_PLACEHOLDERS = [
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

function onOpen() {
  const spreadsheet = SpreadsheetApp.getActive();
  if (!spreadsheet.getRangeByName(MAIL_TEMPLATE_PUBLISHED_RANGE)) {
    setupMailTemplateEditor_(spreadsheet, activeEditorEmail_(), new Date());
  }
  SpreadsheetApp.getUi()
    .createMenu('メール文面管理')
    .addItem('プレビュー', 'previewAutoReplyTemplate')
    .addItem('下書きを公開', 'publishAutoReplyTemplate')
    .addItem('直前の公開版に戻す', 'rollbackAutoReplyTemplate')
    .addToUi();
}

function setupMailTemplateEditor() {
  const spreadsheet = SpreadsheetApp.getActive();
  const result = setupMailTemplateEditor_(spreadsheet, activeEditorEmail_(), new Date());
  spreadsheet.toast(
    result.created ? 'メールテンプレートを初期設定しました。' : 'メールテンプレートの設定を確認しました。',
    'メール文面管理',
    5
  );
  return result;
}

function verifyMailTemplateEditorSetup() {
  return verifyMailTemplateEditorSetup_(SpreadsheetApp.getActive());
}

function verifyMailTemplateEditorSetup_(spreadsheet) {
  const draftSheet = requireSheet_(spreadsheet, MAIL_TEMPLATE_SHEET_NAME);
  requireSheet_(spreadsheet, MAIL_TEMPLATE_HISTORY_SHEET_NAME);
  if (draftSheet.getRange(1, 1).getValue() !== 'お客様向け自動返信テンプレート') {
    throw new Error('テンプレート編集シートの初期設定が不完全です。');
  }
  const published = requireNamedRange_(spreadsheet, MAIL_TEMPLATE_PUBLISHED_RANGE).getValues()[0];
  const error = validateEditableAutoReplyTemplate_({
    subject: String(published[1] || ''),
    body: String(published[2] || ''),
  });
  if (!Number.isInteger(Number(published[0])) || Number(published[0]) < 1 || error) {
    throw new Error('公開テンプレートの初期設定が不完全です。');
  }
  return { ok: true, version: Number(published[0]) };
}

function previewAutoReplyTemplate() {
  try {
    const preview = buildDraftPreview_(SpreadsheetApp.getActive());
    const html = HtmlService.createHtmlOutput([
      '<div style="font-family:Arial,sans-serif;padding:16px">',
      '<h2 style="font-size:18px;margin:0 0 12px">件名</h2>',
      '<pre style="white-space:pre-wrap;border:1px solid #ccc;padding:12px">',
      escapeHtml_(preview.subject),
      '</pre>',
      '<h2 style="font-size:18px;margin:20px 0 12px">本文</h2>',
      '<pre style="white-space:pre-wrap;border:1px solid #ccc;padding:12px;max-height:440px;overflow:auto">',
      escapeHtml_(preview.body),
      '</pre></div>',
    ].join('')).setWidth(760).setHeight(650);
    SpreadsheetApp.getUi().showModalDialog(html, 'お客様向け自動返信プレビュー');
  } catch (error) {
    showTemplateEditorError_(error);
  }
}

function publishAutoReplyTemplate() {
  const spreadsheet = SpreadsheetApp.getActive();
  try {
    const draft = getDraftAutoReplyTemplate_(spreadsheet);
    assertEditableAutoReplyTemplate_(draft);
    const ui = SpreadsheetApp.getUi();
    const answer = ui.alert(
      'メール文面を公開',
      '確認済みの下書きを公開します。次回の自動返信から新しい文面が使用されます。',
      ui.ButtonSet.YES_NO
    );
    if (answer !== ui.Button.YES) {
      return { published: false };
    }

    const lock = LockService.getDocumentLock();
    if (!lock.tryLock(5000)) {
      throw new Error('別のメンバーが公開処理中です。少し待ってから再実行してください。');
    }
    try {
      const result = publishDraftAutoReply_(spreadsheet, activeEditorEmail_(), new Date());
      spreadsheet.toast('版' + result.version + 'を公開しました。', 'メール文面管理', 5);
      return result;
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    showTemplateEditorError_(error);
    return { published: false };
  }
}

function rollbackAutoReplyTemplate() {
  const spreadsheet = SpreadsheetApp.getActive();
  try {
    const ui = SpreadsheetApp.getUi();
    const answer = ui.alert(
      '直前の公開版に戻す',
      '現在の公開文面を、直前に公開されていた文面へ戻します。',
      ui.ButtonSet.YES_NO
    );
    if (answer !== ui.Button.YES) {
      return { rolledBack: false };
    }

    const lock = LockService.getDocumentLock();
    if (!lock.tryLock(5000)) {
      throw new Error('別のメンバーが公開処理中です。少し待ってから再実行してください。');
    }
    try {
      const result = rollbackAutoReplyTemplate_(spreadsheet, activeEditorEmail_(), new Date());
      spreadsheet.toast('直前の文面を版' + result.version + 'として公開しました。', 'メール文面管理', 5);
      return result;
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    showTemplateEditorError_(error);
    return { rolledBack: false };
  }
}

function setupMailTemplateEditor_(spreadsheet, editorEmail, now) {
  const draftSheet = spreadsheet.getSheetByName(MAIL_TEMPLATE_SHEET_NAME)
    || spreadsheet.insertSheet(MAIL_TEMPLATE_SHEET_NAME);
  const publishedSheet = spreadsheet.getSheetByName(MAIL_TEMPLATE_PUBLISHED_SHEET_NAME)
    || spreadsheet.insertSheet(MAIL_TEMPLATE_PUBLISHED_SHEET_NAME);
  const historySheet = spreadsheet.getSheetByName(MAIL_TEMPLATE_HISTORY_SHEET_NAME)
    || spreadsheet.insertSheet(MAIL_TEMPLATE_HISTORY_SHEET_NAME);
  const defaultTemplate = defaultAutoReplyTemplate_();
  const draftWasEmpty = !draftSheet.getRange(3, 2).getValue() && !draftSheet.getRange(5, 2).getValue();
  const publishedWasEmpty = !publishedSheet.getRange(2, 1).getValue();

  writeEditorLayout_(draftSheet);
  publishedSheet.getRange(1, 1, 1, 5).setValues([['版', '件名', '本文', '公開日時', '公開者']]);
  historySheet.getRange(1, 1, 1, 6).setValues([['版', '操作', '実行日時', '実行者', '件名', '本文']]);
  draftSheet.getRange(3, 2).setNumberFormat('@');
  draftSheet.getRange(5, 2).setNumberFormat('@');
  publishedSheet.getRange(2, 2, 1, 2).setNumberFormat('@');
  historySheet.getRange(2, 5, Math.max(1, historySheet.getMaxRows() - 1), 2).setNumberFormat('@');

  if (draftWasEmpty) {
    draftSheet.getRange(3, 2).setValue(defaultTemplate.subject);
    draftSheet.getRange(5, 2).setValue(defaultTemplate.body);
  }
  if (publishedWasEmpty) {
    publishedSheet.getRange(2, 1, 1, 5).setValues([[
      1,
      defaultTemplate.subject,
      defaultTemplate.body,
      now,
      editorEmail,
    ]]);
    if (historySheet.getLastRow() < 2) {
      historySheet.appendRow([1, '初期登録', now, editorEmail, defaultTemplate.subject, defaultTemplate.body]);
    }
  }

  spreadsheet.setNamedRange(MAIL_TEMPLATE_DRAFT_SUBJECT_RANGE, draftSheet.getRange(3, 2));
  spreadsheet.setNamedRange(MAIL_TEMPLATE_DRAFT_BODY_RANGE, draftSheet.getRange(5, 2));
  spreadsheet.setNamedRange(MAIL_TEMPLATE_PUBLISHED_RANGE, publishedSheet.getRange(2, 1, 1, 5));
  publishedSheet.hideSheet();
  updatePublishedStatus_(spreadsheet);
  return { created: draftWasEmpty || publishedWasEmpty };
}

function writeEditorLayout_(sheet) {
  sheet.getRange(1, 1, 1, 2).setValues([['お客様向け自動返信テンプレート', '']]);
  sheet.getRange(3, 1).setValue('下書き件名');
  sheet.getRange(5, 1).setValue('下書き本文');
  sheet.getRange(7, 1).setValue('現在の公開状態');
  sheet.getRange(8, 1).setValue('公開版');
  sheet.getRange(9, 1).setValue('公開日時');
  sheet.getRange(10, 1).setValue('公開者');
  sheet.getRange(11, 1).setValue('公開中の件名');
  sheet.getRange(12, 1).setValue('公開中の本文');
  sheet.getRange(14, 1).setValue('使用可能な差し込み項目');
  sheet.getRange(14, 2).setValue(MAIL_TEMPLATE_PLACEHOLDERS.join('\n'));
  sheet.getRange(16, 1).setValue('操作方法');
  sheet.getRange(16, 2).setValue('上部メニュー「メール文面管理」からプレビュー後に公開してください。');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 190);
  sheet.setColumnWidth(2, 760);
  sheet.setRowHeight(5, 420);
  sheet.setRowHeight(12, 260);
}

function buildDraftPreview_(spreadsheet) {
  const draft = getDraftAutoReplyTemplate_(spreadsheet);
  assertEditableAutoReplyTemplate_(draft);
  const replacements = sampleTemplateValues_();
  return {
    subject: renderEditorTemplate_(draft.subject, replacements),
    body: renderEditorTemplate_(draft.body, replacements),
  };
}

function publishDraftAutoReply_(spreadsheet, editorEmail, now) {
  const draft = getDraftAutoReplyTemplate_(spreadsheet);
  assertEditableAutoReplyTemplate_(draft);
  const publishedRange = requireNamedRange_(spreadsheet, MAIL_TEMPLATE_PUBLISHED_RANGE);
  const current = publishedRange.getValues()[0];
  const nextVersion = Math.max(0, Number(current[0]) || 0) + 1;
  publishedRange.setValues([[nextVersion, draft.subject, draft.body, now, editorEmail]]);
  requireSheet_(spreadsheet, MAIL_TEMPLATE_HISTORY_SHEET_NAME)
    .appendRow([nextVersion, '公開', now, editorEmail, draft.subject, draft.body]);
  updatePublishedStatus_(spreadsheet);
  return { published: true, version: nextVersion };
}

function rollbackAutoReplyTemplate_(spreadsheet, editorEmail, now) {
  const publishedRange = requireNamedRange_(spreadsheet, MAIL_TEMPLATE_PUBLISHED_RANGE);
  const current = publishedRange.getValues()[0];
  const currentVersion = Number(current[0]) || 0;
  const historySheet = requireSheet_(spreadsheet, MAIL_TEMPLATE_HISTORY_SHEET_NAME);
  const history = historySheet.getDataRange().getValues().slice(1);
  const candidates = history
    .filter(function (row) { return Number(row[0]) < currentVersion; })
    .sort(function (left, right) { return Number(right[0]) - Number(left[0]); });
  if (candidates.length === 0) {
    throw new Error('戻すことができる以前の公開版がありません。');
  }
  const target = candidates[0];
  const subject = String(target[4] == null ? '' : target[4]);
  const body = String(target[5] == null ? '' : target[5]);
  assertEditableAutoReplyTemplate_({ subject: subject, body: body });
  const nextVersion = currentVersion + 1;
  publishedRange.setValues([[nextVersion, subject, body, now, editorEmail]]);
  requireNamedRange_(spreadsheet, MAIL_TEMPLATE_DRAFT_SUBJECT_RANGE).setValue(subject);
  requireNamedRange_(spreadsheet, MAIL_TEMPLATE_DRAFT_BODY_RANGE).setValue(body);
  historySheet.appendRow([
    nextVersion,
    'ロールバック（版' + target[0] + '）',
    now,
    editorEmail,
    subject,
    body,
  ]);
  updatePublishedStatus_(spreadsheet);
  return { rolledBack: true, version: nextVersion, restoredVersion: Number(target[0]) };
}

function getDraftAutoReplyTemplate_(spreadsheet) {
  return {
    subject: String(requireNamedRange_(spreadsheet, MAIL_TEMPLATE_DRAFT_SUBJECT_RANGE).getValue() || ''),
    body: String(requireNamedRange_(spreadsheet, MAIL_TEMPLATE_DRAFT_BODY_RANGE).getValue() || ''),
  };
}

function validateEditableAutoReplyTemplate_(template) {
  if (!template || !template.subject) {
    return '件名を入力してください。';
  }
  if (template.subject.length > MAIL_TEMPLATE_SUBJECT_MAX) {
    return '件名は' + MAIL_TEMPLATE_SUBJECT_MAX + '文字以内で入力してください。';
  }
  if (/[\r\n]/.test(template.subject)) {
    return '件名に改行は使用できません。';
  }
  if (!template.body) {
    return '本文を入力してください。';
  }
  if (template.body.length > MAIL_TEMPLATE_BODY_MAX) {
    return '本文は' + MAIL_TEMPLATE_BODY_MAX + '文字以内で入力してください。';
  }

  const combined = template.subject + '\n' + template.body;
  const found = combined.match(/\{\{[^{}]+\}\}/g) || [];
  const unknown = found.filter(function (placeholder) {
    return MAIL_TEMPLATE_PLACEHOLDERS.indexOf(placeholder) < 0;
  });
  if (unknown.length > 0) {
    return '使用できない差し込み項目があります：' + unique_(unknown).join('、');
  }
  if (/\{\{|\}\}/.test(combined.replace(/\{\{[^{}]+\}\}/g, ''))) {
    return '差し込み項目の形式が正しくありません。';
  }
  const missing = MAIL_TEMPLATE_PLACEHOLDERS.filter(function (placeholder) {
    return template.body.indexOf(placeholder) < 0;
  });
  return missing.length > 0
    ? '本文に必須の差し込み項目が不足しています：' + missing.join('、')
    : '';
}

function assertEditableAutoReplyTemplate_(template) {
  const error = validateEditableAutoReplyTemplate_(template);
  if (error) {
    throw new Error(error);
  }
}

function renderEditorTemplate_(template, replacements) {
  return String(template).replace(/\{\{[^{}]+\}\}/g, function (placeholder) {
    return Object.prototype.hasOwnProperty.call(replacements, placeholder)
      ? String(replacements[placeholder] == null ? '' : replacements[placeholder])
      : placeholder;
  });
}

function sampleTemplateValues_() {
  return {
    '{{お名前}}': '山田 太郎',
    '{{お問い合わせ日時}}': '2026/8/9 10:30:00',
    '{{受付ID}}': 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    '{{貴社名}}': 'サンプル株式会社',
    '{{部署・役職}}': '営業部',
    '{{メールアドレス}}': 'user@example.invalid',
    '{{電話番号}}': '03-0000-0000',
    '{{住所}}': '東京都〇〇区〇〇',
    '{{お問い合わせ内容}}': [
      '一行目のご相談です。',
      '二行目もそのまま表示されます。',
      '本文中の {{受付ID}} は再置換されません。',
    ].join('\n'),
  };
}

function defaultAutoReplyTemplate_() {
  return {
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

function updatePublishedStatus_(spreadsheet) {
  const draftSheet = requireSheet_(spreadsheet, MAIL_TEMPLATE_SHEET_NAME);
  const published = requireNamedRange_(spreadsheet, MAIL_TEMPLATE_PUBLISHED_RANGE).getValues()[0];
  draftSheet.getRange(8, 2).setValue(published[0]);
  draftSheet.getRange(9, 2).setValue(published[3]);
  draftSheet.getRange(10, 2).setValue(published[4]);
  draftSheet.getRange(11, 2).setValue(published[1]);
  draftSheet.getRange(12, 2).setValue(published[2]);
}

function requireNamedRange_(spreadsheet, name) {
  const range = spreadsheet.getRangeByName(name);
  if (!range) {
    throw new Error('初期設定が完了していません。管理者へ連絡してください。');
  }
  return range;
}

function requireSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    throw new Error('必要なシート「' + name + '」が見つかりません。');
  }
  return sheet;
}

function activeEditorEmail_() {
  return Session.getActiveUser().getEmail() || '取得不可';
}

function showTemplateEditorError_(error) {
  const message = error && error.message ? error.message : '処理に失敗しました。';
  SpreadsheetApp.getUi().alert('メール文面管理', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unique_(values) {
  return values.filter(function (value, index) { return values.indexOf(value) === index; });
}
