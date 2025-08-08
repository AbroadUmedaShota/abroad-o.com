# コーディング規約

このドキュメントは、プロジェクトにおけるコードの一貫性と品質を維持するための規約を定めます。

UI/UXに関するデザインガイドラインは[こちら](design/00_design_guideline.md)を参照してください。
UIの文言・メッセージ定義は[こちら](design/01_ui_messages.md)を参照してください。

## 1. JavaScriptライブラリ

### 1.1. 日付ピッカー (`flatpickr`)

日付入力には、ブラウザ間の表示差異をなくし、一貫したUI/UXを提供するために `flatpickr` を標準ライブラリとして使用します。

#### 基本的なHTML構造

`flatpickr` を `wrap: true` オプションと共に使用する場合、以下のHTML構造を遵守してください。

-   入力欄を囲む親要素 (`div`) にユニークなIDを付与します。
-   `input` タグには `data-input` 属性を、カレンダーを開くトリガーとなる要素（アイコンボタンなど）には `data-toggle` 属性を付与します。
-   ユーザーによる意図しない手入力を防ぐため、`input` タグには `readonly` 属性を付与することを推奨します。

**実装例:**
```html
<!-- 開始日の例 -->
<div id="startDatePickerWrapper" class="input-group flex-1 relative">
    <input type="text" class="input-field pr-10" placeholder=" " readonly data-input>
    <label class="input-label">開始日</label>
    <button type="button" class="absolute right-3 top-1/2 ..." data-toggle>
        <span class="material-icons text-xl">calendar_today</span>
    </button>
</div>
```

#### JavaScriptでの初期化

`flatpickr` のインスタンスは、以下の規約で初期化します。

-   **日本語化:** `flatpickr.localize(flatpickr.l10ns.ja);` を必ず実行します。
-   **セレクター:** `wrap: true` を使用するため、セレクターには親要素のID (`#startDatePickerWrapper` など) を指定します。
-   **日付フォーマット:** `dateFormat: "Y-m-d"` を基本とします。
-   **期間の連動:** 開始日と終了日が連動する場合は、`onChange` イベントを利用して、もう一方のピッカーの `minDate` または `maxDate` を設定します。

**実装例:**
```javascript
// 日本語化
flatpickr.localize(flatpickr.l10ns.ja);

// 終了日ピッカー
const endDatePicker = flatpickr("#endDatePickerWrapper", {
    wrap: true,
    dateFormat: "Y-m-d",
});

// 開始日ピッカー
const startDatePicker = flatpickr("#startDatePickerWrapper", {
    wrap: true,
    dateFormat: "Y-m-d",
    onChange: function(selectedDates, dateStr, instance) {
        // 開始日が変更されたら、終了日の選択可能範囲を更新
        endDatePicker.set('minDate', dateStr);
    }
});
```
