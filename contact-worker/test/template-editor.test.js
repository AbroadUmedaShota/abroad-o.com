import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'template-editor', 'Code.gs'), 'utf8');

class FakeRange {
  constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) => (
      Array.from({ length: this.columnCount }, (_, columnOffset) => (
        this.sheet.valueAt(this.row + rowOffset, this.column + columnOffset)
      ))
    ));
  }

  setValues(values) {
    values.forEach((row, rowOffset) => {
      row.forEach((value, columnOffset) => {
        this.sheet.setValueAt(this.row + rowOffset, this.column + columnOffset, value);
      });
    });
    return this;
  }

  getValue() {
    return this.getValues()[0][0];
  }

  setValue(value) {
    return this.setValues([[value]]);
  }

  setNumberFormat() {
    return this;
  }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.rows = [];
    this.hidden = false;
  }

  valueAt(row, column) {
    return (this.rows[row - 1] || [])[column - 1] ?? '';
  }

  setValueAt(row, column, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < column) this.rows[row - 1].push('');
    this.rows[row - 1][column - 1] = value;
  }

  getRange(row, column, rowCount = 1, columnCount = 1) {
    return new FakeRange(this, row, column, rowCount, columnCount);
  }

  appendRow(values) {
    this.rows.push([...values]);
    return this;
  }

  getLastRow() {
    return this.rows.length;
  }

  getMaxRows() {
    return Math.max(1000, this.rows.length);
  }

  getDataRange() {
    const columns = Math.max(1, ...this.rows.map((row) => row.length));
    return this.getRange(1, 1, Math.max(1, this.rows.length), columns);
  }

  hideSheet() {
    this.hidden = true;
    return this;
  }

  setFrozenRows() { return this; }
  setColumnWidth() { return this; }
  setRowHeight() { return this; }
}

class FakeSpreadsheet {
  constructor() {
    this.sheets = new Map();
    this.namedRanges = new Map();
  }

  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }

  insertSheet(name) {
    const sheet = new FakeSheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }

  setNamedRange(name, range) {
    this.namedRanges.set(name, range);
  }

  getRangeByName(name) {
    return this.namedRanges.get(name) || null;
  }
}

function createHarness() {
  const context = vm.createContext({
    console,
    Date,
    JSON,
    String,
    Number,
    RegExp,
    Object,
    Array,
    Error,
  });
  vm.runInContext(source, context, { filename: 'template-editor/Code.gs' });
  return { context, spreadsheet: new FakeSpreadsheet() };
}

test('template editor setup creates draft, published and history sheets without inquiry data', () => {
  const { context, spreadsheet } = createHarness();
  const result = context.setupMailTemplateEditor_(
    spreadsheet,
    'editor@example.invalid',
    new Date('2026-08-09T00:00:00.000Z'),
  );

  assert.equal(result.created, true);
  assert.equal(spreadsheet.getSheetByName('メールテンプレート') !== null, true);
  assert.equal(spreadsheet.getSheetByName('_メールテンプレート公開').hidden, true);
  assert.equal(spreadsheet.getSheetByName('メールテンプレート履歴') !== null, true);
  assert.equal(spreadsheet.getRangeByName('CONTACT_AUTOREPLY_PUBLISHED').getValues()[0][0], 1);
  assert.equal(spreadsheet.getRangeByName('CONTACT_AUTOREPLY_DRAFT_SUBJECT').getValue(), '【Abroad】お問い合わせありがとうございます');
  assert.equal(spreadsheet.getSheetByName('メールテンプレート').getRange(11, 2).getValue(), '【Abroad】お問い合わせありがとうございます');
  assert.match(spreadsheet.getSheetByName('メールテンプレート').getRange(12, 2).getValue(), /お問い合わせ日時：\{\{お問い合わせ日時\}\}/);
  assert.equal(context.verifyMailTemplateEditorSetup_(spreadsheet).ok, true);
});

test('draft changes remain inactive until publish and publish records a new version', () => {
  const { context, spreadsheet } = createHarness();
  context.setupMailTemplateEditor_(spreadsheet, 'editor@example.invalid', new Date('2026-08-09T00:00:00.000Z'));
  const before = spreadsheet.getRangeByName('CONTACT_AUTOREPLY_PUBLISHED').getValues()[0];
  const draftSubject = spreadsheet.getRangeByName('CONTACT_AUTOREPLY_DRAFT_SUBJECT');
  const draftBody = spreadsheet.getRangeByName('CONTACT_AUTOREPLY_DRAFT_BODY');
  draftSubject.setValue('新しい受付件名：{{貴社名}}');
  draftBody.setValue(draftBody.getValue().replace('誠にありがとうございます。', '心より御礼申し上げます。'));

  assert.equal(spreadsheet.getRangeByName('CONTACT_AUTOREPLY_PUBLISHED').getValues()[0][1], before[1]);

  const published = context.publishDraftAutoReply_(
    spreadsheet,
    'editor@example.invalid',
    new Date('2026-08-09T01:00:00.000Z'),
  );
  const after = spreadsheet.getRangeByName('CONTACT_AUTOREPLY_PUBLISHED').getValues()[0];
  assert.equal(published.version, 2);
  assert.equal(after[1], '新しい受付件名：{{貴社名}}');
  assert.match(after[2], /心より御礼申し上げます/);
  assert.equal(spreadsheet.getSheetByName('メールテンプレート').getRange(11, 2).getValue(), '新しい受付件名：{{貴社名}}');
  assert.equal(spreadsheet.getSheetByName('メールテンプレート履歴').getLastRow(), 3);
});

test('template editor rejects unsafe or incomplete drafts', () => {
  const { context } = createHarness();
  const valid = context.defaultAutoReplyTemplate_();
  assert.equal(context.validateEditableAutoReplyTemplate_(valid), '');
  assert.equal(context.validateEditableAutoReplyTemplate_({ ...valid, subject: '' }), '件名を入力してください。');
  assert.equal(context.validateEditableAutoReplyTemplate_({ ...valid, subject: 'a'.repeat(151) }), '件名は150文字以内で入力してください。');
  assert.equal(context.validateEditableAutoReplyTemplate_({ ...valid, subject: '改行\n件名' }), '件名に改行は使用できません。');
  assert.equal(context.validateEditableAutoReplyTemplate_({ ...valid, body: '' }), '本文を入力してください。');
  assert.equal(context.validateEditableAutoReplyTemplate_({ ...valid, body: 'a'.repeat(20001) }), '本文は20000文字以内で入力してください。');
  assert.equal(context.validateEditableAutoReplyTemplate_({ ...valid, body: valid.body.replace('{{受付ID}}', '') }), '本文に必須の差し込み項目が不足しています：{{受付ID}}');
  assert.equal(context.validateEditableAutoReplyTemplate_({ ...valid, body: `${valid.body}\n{{未知}}` }), '使用できない差し込み項目があります：{{未知}}');
  assert.equal(context.validateEditableAutoReplyTemplate_({ ...valid, subject: '{{未知}}' }), '使用できない差し込み項目があります：{{未知}}');
});

test('preview renders sample values once and preserves multiline content', () => {
  const { context, spreadsheet } = createHarness();
  context.setupMailTemplateEditor_(spreadsheet, 'editor@example.invalid', new Date('2026-08-09T00:00:00.000Z'));
  const bodyRange = spreadsheet.getRangeByName('CONTACT_AUTOREPLY_DRAFT_BODY');
  bodyRange.setValue(bodyRange.getValue().replace('{{お問い合わせ内容}}', '{{お問い合わせ内容}}\n確認用'));

  const preview = context.buildDraftPreview_(spreadsheet);
  assert.match(
    preview.body,
    /一行目のご相談です。\n二行目もそのまま表示されます。\n本文中の \{\{受付ID\}\} は再置換されません。\n確認用/
  );
  assert.match(preview.body, /本文中の \{\{受付ID\}\} は再置換されません。/);
});

test('rollback restores the immediately previous public version as a new version', () => {
  const { context, spreadsheet } = createHarness();
  context.setupMailTemplateEditor_(spreadsheet, 'editor@example.invalid', new Date('2026-08-09T00:00:00.000Z'));
  const original = spreadsheet.getRangeByName('CONTACT_AUTOREPLY_PUBLISHED').getValues()[0];
  spreadsheet.getRangeByName('CONTACT_AUTOREPLY_DRAFT_SUBJECT').setValue('変更後：{{貴社名}}');
  context.publishDraftAutoReply_(spreadsheet, 'editor@example.invalid', new Date('2026-08-09T01:00:00.000Z'));

  const rolledBack = context.rollbackAutoReplyTemplate_(
    spreadsheet,
    'editor@example.invalid',
    new Date('2026-08-09T02:00:00.000Z'),
  );
  const current = spreadsheet.getRangeByName('CONTACT_AUTOREPLY_PUBLISHED').getValues()[0];
  assert.equal(rolledBack.version, 3);
  assert.equal(current[1], original[1]);
  assert.equal(current[2], original[2]);
});
