# Apps Script問い合わせ受信処理

Cloudflare WorkerがTurnstile・入力検証・レート制限を通過した問い合わせだけを、HMAC署名付きでこのWebアプリへ送ります。WebアプリURLと共有鍵は公開HTMLへ置きません。

## Script Properties

初回デプロイ前に、新しい台帳を既存の問い合わせ運用グループへ共有し、各担当者が開けることを確認します。通知先はソースや実行引数ではなく、Apps ScriptのScript Propertiesでその運用グループに設定します。実アドレスはこのREADME、GitHub、ログへ残しません。

`CONTACT_NOTIFY_EMAILS`を設定した後、本人限定のExecution APIから次を1回実行すると、保存先・メール有効化設定と共有鍵を安全に初期化できます。

```text
configureContactReceiver(<spreadsheet id>, "お問い合わせ")
```

この初期化は`CONTACT_NOTIFY_EMAILS`を変更しません。内部通知・自動返信はいずれも`true`になります。戻り値の`sharedSecret`だけをWorkerの`UPSTREAM_SHARED_SECRET`へ直接移し、端末出力、Issue、ソースへ残さないでください。設定後は`getContactConfigurationStatus()`を実行し、シート到達性、通知先件数、両メール経路の有効状態、残りメール枠を確認します。

必須:

- `CONTACT_SHARED_SECRET`: Workerの`UPSTREAM_SHARED_SECRET`と同じ十分に長いランダム値
- `CONTACT_SPREADSHEET_ID`: 回答保存先スプレッドシートID
- `CONTACT_SHEET_NAME`: 回答保存先シート名
- `CONTACT_NOTIFY_ENABLED`: 内部通知を有効にする場合だけ`true`
- `CONTACT_AUTOREPLY_ENABLED`: 通常運用では`true`。インシデント対応やメール経路障害時だけ`false`

内部通知を有効にする場合:

- `CONTACT_NOTIFY_EMAILS`: カンマ、セミコロン、改行区切りの通知先
- `CONTACT_FROM_NAME`: 任意の差出人表示名

## 公開条件

Webアプリは「自分として実行」「全員（匿名ユーザーを含む）がアクセス可能」でデプロイします。Execution APIは本人限定です。匿名アクセスを許可しても、正しいHMAC署名がない本文は保存・通知・自動返信されません。

実データで試す前に、テスト用スプレッドシート・通知先で動作確認してください。実際のメールアドレスや共有鍵をGitHub Issue、ソース、ログへ貼り付けないでください。
