### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
- 現在は `tempDiv.innerHTML` をそのまま `outputSource.value` に代入しているため、タグが一行に繋がって表示されています。

**Files to be changed:**
- `TOOL/js/convert.js`

#### 2. **Contribution to Project Goals**
- 開発者が生成されたコードを再利用・修正する際の視認性が大幅に向上します。

#### 3. **Overview of Changes**
- HTML 文字列を整形する `formatHtml` ヘルパー関数を追加するか、`convert` 関数内での出力処理を強化します。

#### 4. **Specific Work Content for Each File**
- `TOOL/js/convert.js`:
    - `convert` 関数の最後に、HTML 文字列に対してブロック要素（p, div, li, tr, table 等）の前後で改行を挿入する処理を追加します。
    - 連続する空行を整理し、クリーンなソースコードを出力します。

#### 5. **Definition of Done**
- [ ] 出力された HTML ソースが、タグごとに改行されて表示される。
- [ ] プレビュー側の表示が崩れていない（不要な空白がプレビューに影響しないように注意）。

---
If you approve, please reply to this comment with "Approve".
