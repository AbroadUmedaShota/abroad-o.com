# 公開資産棚卸しポリシー

`npm run inventory:public-assets` は、ビルド済みの `_site/` を公開マニフェストと照合し、HTML/CSS/JavaScriptから解決できるローカル参照を `output/public-asset-inventory.json` に記録します。出力には時刻を含めず、同じ公開物から常に同じJSONを生成します。コマンドは単一実行内で2回棚卸しを行い、JSONのバイト一致を確認します。

JSONには、生成時の`commit`、`scanScope`、Git履歴の完全性を示す`historyCompleteness`、4分類と不確実性・削除可否件数を集計した`summary`を含めます。全`.html`（`slick/largeformat.html`を含む）は直接公開URLの入口として扱います。

この棚卸しは削除判定ではありません。全資産の `deletionEligible` は常に `false` です。Git履歴がpartialの場合だけ`history-partial`を、動的参照・未解決参照は`uncertainties`として残します。公開HTMLを入口にHTML→CSS/JavaScript→CSS import等で到達する参照グラフ上では、公開ルート外への参照、存在しないローカル参照、公開マニフェスト外ディレクトリへの参照を失敗にします。CSSの `sourceMappingURL` は実行時に不要な開発補助情報のため、到達可能なCSSでも実体がなければ `missing-source-map` として記録します。到達しないCSS/JavaScriptも走査し、内部の同種の不整合は `unreachable-source-missing-reference` として記録します。これは削除許可ではありません。

削除または公開マニフェスト縮小は、次を全て満たし、担当ownerの明示承認を得るまで禁止します。

1. 対象URLのアクセスログを確認する。
2. 対象資産のownerと公開用途を確認する。
3. 外部・内部のURL参照を確認する。
4. sanitized backup と restore の独立検証を完了する。
5. 実施対象とロールバック手順について明示承認を得る。

3つの公開PDFは `deploy/sakura-public-files.json` の `protectedPaths` として保護し、棚卸し結果でも常に `protected` に分類します。

初回棚卸しでは `style.css` の `section#title_top2` に存在しない `image/top1.jpg` への参照が見つかったため、同じ公開済みPNGとWebPフォールバックへ修正しました。このセレクタは現行のsource/generated HTMLに存在せず、表示変更はありません。
