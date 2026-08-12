# 問い合わせフォーム bot対策・移行手順

## 構成

```text
form.html
  -> Cloudflare Turnstile widget
  -> Cloudflare Worker /submit
       1. Origin・サイズ・入力・honeypot・送信時間を検証
       2. 送信元と宛先メールのHMAC値でレート制限
       3. Turnstile Siteverifyでtoken・action・hostnameを検証
       4. 検証済みデータへHMAC署名
  -> Apps Script Web App
       1. HMAC署名と受付ID重複を検証
       2. Spreadsheetへ保存
       3. 有効時のみ内部通知
       4. 有効時のみ自動返信
```

公開HTMLへ置くのはWorkerのURLとTurnstileサイトキーだけです。Turnstileシークレット、受信WebアプリURL、共有鍵、通知先は公開しません。

## 防御の考え方

- TurnstileはWorkerからSiteverifyを呼び、`success`だけでなく`action`と`hostname`も確認する。
- Turnstile tokenは5分・1回限りのため、エラー時はクライアントでwidgetをresetする。
- IP制限は共有回線での誤検知を避けるため緩めの10件/分、同一返信先は3件/分とする。レート制限キーはHMAC化し、IP・メールアドレスを平文保存しない。
- ランダム文字列らしさ、国外IP、フリーメールだけでは拒否しない。
- ログには受付ID、結果、理由、短縮したHMAC値だけを記録し、氏名、メール、電話、本文を出さない。
- WorkerとApps Scriptの両方で通知・自動返信を有効化しない限り、メールは送られない。通常の切替では両方を有効にし、新経路の開始時から自動返信を継続する。停止スイッチは異常時の緊急対応に限定する。
- Apps Scriptは受付IDと内容指紋をSpreadsheetへ永続保存する。通知失敗時は状態を`待機`のまま残し、同じ受付ID・同じ内容の再送時だけ未完了処理を再開する。再開時にも現在のメール有効化設定を確認し、緊急停止中なら`待機`から`停止`へ変更して送信しない。異なる内容で同じ受付IDを使った要求は拒否する。

## Cloudflare Workerの設定

`contact-worker/` で作業する。

```powershell
npm install
npm test
npm run check
```

秘密値は`wrangler.jsonc`へ書かず、CloudflareのSecretとして登録する。

```powershell
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RATE_LIMIT_HASH_KEY
npx wrangler secret put UPSTREAM_URL
npx wrangler secret put UPSTREAM_SHARED_SECRET
```

Turnstileサイトキーは公開値だが環境ごとのWorker変数`TURNSTILE_SITE_KEY`として設定する。`UPSTREAM_SHARED_SECRET`はApps Scriptの`CONTACT_SHARED_SECRET`と同じ十分に長いランダム値にする。値をコマンド履歴、Issue、ログへ貼り付けない。

`abroad-o.com`のDNSゾーンをCloudflareで管理していないため、サイト全体のDNSへ影響を出さないよう、初回リリースは`https://abroad-o-contact-form.abroad-o.workers.dev`を使用する。将来Cloudflare側へDNSゾーンを追加する場合だけ、`https://contact.abroad-o.com`のCustom Domainへ切り替える。公開前に以下を確認する。

- `/health` が200
- 許可Originから`/config`が200、その他Originが403
- tokenなし、無効token、異なるaction/hostnameが保存前に拒否される
- 連投で429になる
- Workerログに個人情報がない

## Apps Scriptの設定

`contact-worker/apps-script/`を専用のApps Scriptプロジェクトへ反映する。新しい台帳は既存の問い合わせ運用グループへ共有し、切替担当を含む必要な担当者が閲覧できることを先に確認する。内部通知先はScript Propertiesの`CONTACT_NOTIFY_EMAILS`へ設定し、実アドレスをソース、Issue、端末出力、ログへ置かない。本人限定Execution APIから`configureContactReceiver`を1回実行し、戻された共有鍵は画面やログへ出さずWorker Secretへ直接設定する。この初期化は通知先を上書きしない。`getContactConfigurationStatus`が成功し、保存先到達性、通知先件数、通知・自動返信ON、メール残量を返すことを公開条件とする。詳細は同フォルダのREADMEを参照する。

本番切替前に、テスト用Spreadsheetと管理下のテスト用メールアドレスを使い、次の状態で自動返信まで確認する。

```text
CONTACT_NOTIFY_ENABLED=true
CONTACT_AUTOREPLY_ENABLED=true
```

保存、内部通知、自動返信を一連で確認する。テストに実在する第三者のメールアドレスを使用しない。本番設定でも自動返信を有効にした状態で切り替える。

## 旧Google Formsからの切替順序

1. 旧Google Formに紐づく自動返信元、回答受付、トリガーを特定し、切替操作と確認方法を確定する。この段階では通常運用を停止しない。
2. 新しい問い合わせ台帳を既存の問い合わせ運用グループへ共有し、必要な担当者の閲覧可否と旧回答データが保持されていることを確認する。
3. テスト用Turnstile・Worker・Apps Script・Spreadsheet・管理下のテスト用メールアドレスで、保存・内部通知・自動返信と拒否系を確認する。
4. Apps Script本番保存先とScript Propertiesの通知先を設定し、内部通知と自動返信を有効にする。Worker側も両方を有効にする。
5. Workerを専用`workers.dev` URLで公開する。Cloudflare管理のDNSゾーンがある場合だけCustom Domainを割り当てる。公開フォームからはまだ参照しない。
6. `form.html`をSakuraの既存手順でDryRun後に公開し、新経路へ切り替える。
7. 公開ページから管理下のメールアドレスで1件だけ送信し、保存・内部通知・自動返信・ログを確認する。通常の受付フローが確認できるまで旧Google Formは停止しない。
8. 通常フロー確認後、同じ切替作業内で旧Google Formの回答受付を停止し、既知の`formResponse`へ直接POSTしても保存・通知・自動返信されないことを確認する。
9. 自動返信を継続したまま、受付数、拒否数、正規問い合わせ、バウンス、送信量を重点監視する。

旧Google Formの停止前は、公開HTMLから送信先を除いても既知の`formResponse`へ直接POSTできるため、対策完了とはしない。

本Issueは、旧Google Formの回答受付停止と旧自動返信経路の無効化を読み取り確認するまで完了扱いにしない。Worker・HTMLだけを公開して完了にしない。

## ロールバック

- 通常時は自動返信を継続する。明確な不正送信、バウンス急増、メール経路障害がある場合だけ、WorkerまたはApps Scriptの`AUTOREPLY_ENABLED`をfalseにして緊急停止する。
- フォーム受付自体が不安定な場合は`NOTIFY_ENABLED`も停止し、画面上の代替メール・電話導線を利用する。
- Sakura側HTMLの復元は、sanitized backup と restoration contract の独立検証が完了するまで実行しない。旧Google Form直POST版は悪用経路を再開するため、いずれにしても復元しない。復旧までは代替連絡導線を使用する。
- 新旧のSpreadsheet回答や受信メールは自動削除しない。旧Google Form停止後も過去データは保持し、参照可能な状態を維持する。

## 監視

- Workers Observabilityで`accepted`、`rejected`、`rate_limited`、`upstream_error`を集計する。
- Google Workspace側で送信数、バウンス、迷惑メール報告、送信上限接近を確認する。
- Spreadsheetの`内部通知状態`・`自動返信状態`に`待機`が残っていないか確認する。再送でも解消しない場合は行の内容を確認して手動対応する。
- 拒否率が急増した場合は、自動返信だけを停止し、正規問い合わせの保存と内部確認を優先する。
