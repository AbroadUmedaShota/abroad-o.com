# さくらサーバー公開手順

## 目的

FileZillaの手作業に依存せず、Git管理された公開ファイルだけをさくらサーバーの公開ディレクトリへ同期する。

## 公開対象

公開対象は `deploy/sakura-public-files.json` で管理する。HTMLはEleventyで`site/`から`_site/`へ生成し、デプロイスクリプトは`_site/`だけを梱包する。

含めるもの:

- `_site/`に生成されたルートHTMLとNEWS記事
- `_site/`へ生成・コピーされた`.htaccess`、`robots.txt`、`sitemap.xml`、CSS、画像、JavaScript、`slick/`、および `pdfjs/` 配下の3 PDF（`1c_abroad.pdf`、`2c_abroad.pdf`、`4c_abroad.pdf`）

`TOOL/` と PDF.js viewer（`pdfjs/build/`、`pdfjs/web/`、`pdfjs/LICENSE`）は公開しない。PDF閲覧はブラウザ組込み機能で行う。

`sitemap.xml` はEleventyがindexableページのcanonical URLだけから固定順序で生成する。`robots.txt` はクロールを許可し、同サイトマップを案内する。`.htaccess` はHTTP／非wwwと`/index`・`/index.html`を、クエリを保ったまま `https://www.abroad-o.com/` のcanonical URLへ1回だけ301リダイレクトする。

CIはApache実環境でHTTP／HTTPS、www／apex、index、拡張子有無、クエリ、禁止URLのリダイレクト行列を検証する。

含めないもの:

- `.git/`, `.github/`, `.vscode/`, `.deploy/`
- `docs/`, `data/`, `deploy/`, `scripts/`
- `*.md`

## ローカル実行

PowerShellでリポジトリルートから実行する。

```powershell
npm ci
npm run check:site
.\scripts\deploy-sakura.ps1 -Mode DryRun
```

単一ファイルを公開する場合も、編集元の`site/pages/`ではなく`npm run build:site`で生成した`_site/<対象ファイル>`をアップロードする。

FileZillaに保存されている接続先情報を確認する場合:

```powershell
.\scripts\read-filezilla-sakura.ps1
```

この環境では `abroad-o.sakura.ne.jp` / `abroad-o` / `/home/abroad-o/www/abroad-o.com` を利用する。FileZilla上の最後のリモート位置が `TOOL` や `adminBETA` などの配下の場合、デプロイ先は `abroad-o.com` 直下に補正する。

このPCではSSH鍵を以下に作成済み。

```text
C:\Users\admin\.ssh\sakura_abroad_o
```

ローカル設定を読み込む場合:

```powershell
. .\.deploy\sakura\local.env.ps1
```

実デプロイ時はSSH鍵認証を前提に、以下の環境変数を設定する。

```powershell
$env:SAKURA_HOST = "abroad-o.sakura.ne.jp"
$env:SAKURA_USER = "abroad-o"
$env:SAKURA_REMOTE_DIR = "/home/abroad-o/www/abroad-o.com"
$env:SAKURA_SSH_KEY_PATH = "$HOME\.ssh\sakura_abroad_o"
$env:SAKURA_PORT = "22"
.\scripts\deploy-sakura.ps1 -Mode Deploy
```

`SAKURA_REMOTE_DIR` を省略した場合は `/home/<SAKURA_USER>/www` を使う。

FileZillaの保存情報から `SAKURA_HOST`, `SAKURA_USER`, `SAKURA_REMOTE_DIR` を補完する場合:

```powershell
.\scripts\deploy-sakura.ps1 -Mode DryRun -UseFileZillaConfig
.\scripts\deploy-sakura.ps1 -Mode Deploy -UseFileZillaConfig
```

FileZillaがFTP/21番で保存されていても、このデプロイスクリプトは公開前バックアップと公開反映にSSH/SCPを使う。復元はsanitized backup と restoration contract の独立検証が完了するまで停止中である。FTPパスワードは表示・利用しない。

## GitHub Actions

`.github/workflows/deploy-sakura.yml` は手動実行のみ。実行時は次の3モードから選択する。

- `package`: Eleventyビルドと公開パッケージ作成のみ。SecretsとSakura接続は不要。
- `audit`: SSHで本番を読み取り、Gitから生成した公開物とSHA-256を照合する。本番は更新しない。
- `deploy`: 公開前バックアップを作成し、Sakuraへ本番反映する。実行前に明示確認を得る。

GitHub repository secrets:

- `SAKURA_HOST`
- `SAKURA_USER`
- `SAKURA_REMOTE_DIR`
- `SAKURA_SSH_KEY`
- `SAKURA_KNOWN_HOSTS`
- `SAKURA_PORT`

最初は `package` で公開対象のパッケージを確認する。Secrets登録後は `audit` でSSH接続と公開物の一致を確認し、明示承認後の実公開に限って `deploy` を選ぶ。

`audit` は生のSHA-256を優先し、差分があるテキストファイルだけCRLF/LFを正規化したSHA-256も比較する。内容が同一で改行だけが異なる場合は `line-ending-only` として件数を分け、内容差分には含めない。

さくらサーバー側で国外IPアドレスフィルターが有効な場合、GitHub ActionsからのSSH/SFTP接続が拒否される可能性がある。広く無効化せず、必要な許可リスト運用を優先する。

## バックアップと復元

`Restore` と `RestoreSafe` は、sanitized backup と復元契約が実装され、独立検証されるまで停止中である。旧 `TOOL/` や PDF.js viewer を復活させるおそれがあるため、実行しない。

`Deploy` は `Preflight`、`Stage`、限定 `Promote` の順で実行する。Preflightは読み取り専用で、公開ディレクトリがシンボリックリンクでないこと、公開ファイルに未知の追加物がないこと、パッケージ・現行バックアップ・作業領域を確保できる空き容量があることを確認する。未知のリモートファイルが1件でもある場合は反映を中止する。manifestに追加されたファイルや、明示した削除allowlist上のファイルはこの照合で許可する。

`Stage` は公開tarballをホームディレクトリに置くだけで、公開ディレクトリを変更しない。`Promote` はmanifest記載ファイルだけを上書きし、公開ルートや管理ディレクトリを一括削除しない。反映前に `~/abroad-o-backups/abroad-o-before-<timestamp>.tgz` を作り、manifestのSHA-256を操作証跡として出力する。

これらのモードはSSH/SCP鍵認証が必須である。FileZillaにFTP/21の設定しかない場合は、このスクリプトで接続・公開しない。FTPパスワードの読取り、表示、またはFTPへのフォールバックは行わない。

段階操作を個別に実行する場合は、`Stage` の出力したrelease IDを `Promote` に渡す。Promoteはrelease metadata内のtarball SHA-256とmanifest SHA-256を再照合するため、別パッケージのmanifestでの反映はできない。

```powershell
.\scripts\deploy-sakura.ps1 -Mode Preflight
.\scripts\deploy-sakura.ps1 -Mode Stage
$env:SAKURA_STAGED_RELEASE_ID = 'abroad-o-public-YYYYMMDD-HHMMSS'
.\scripts\deploy-sakura.ps1 -Mode Promote
```

## 確認

デプロイ後はスクリプトが以下を確認する。

- `https://www.abroad-o.com/` が 200
- `https://www.abroad-o.com/speed-ad.html` が 200
- `https://www.abroad-o.com/news/news_260526.html` が 200
- `https://www.abroad-o.com/news/news_260615.html` が 200
- `https://www.abroad-o.com/sample2.html` が 200
- `https://www.abroad-o.com/pdfjs/1c_abroad.pdf`、`2c_abroad.pdf`、`4c_abroad.pdf` が 200
- `https://www.abroad-o.com/docs/TOOL_USAGE.md` が 404
- `https://www.abroad-o.com/TOOL/index.html` が 404
- `https://www.abroad-o.com/pdfjs/web/viewer.html` が 404
# CSP Report-Only ヘッダー

`.htaccess` は `Content-Security-Policy-Report-Only` と4種類の補助セキュリティヘッダーを設定する。これは違反候補を報告するだけで通信を遮断しない。HSTSは今回設定しない。`report-uri`／`report-to` の送信先も未設定であり、本番ブラウザの違反レポートは保存されない。この状態だけを根拠に強制CSPへ切り替えてはならない。

このヘッダーを含む公開より前に、次の作業それぞれについて明示承認を得る。

1. Sakura上の隔離した一時ディレクトリで、`Header` を1件だけ設定する最小 `.htaccess` を使い、`mod_headers` が利用可能でHTTP 500にならないことを確認する。確認後は一時ファイルを削除する。
2. Report-Only公開後、キャッシュ回避付きの主要ページ、問い合わせフォーム、Google Maps、PDFで、レスポンスヘッダーの重複がなく、ブラウザのCSP違反イベント／コンソール違反がないことを採取する。
3. 強制CSPへの切替は、前項の実測結果を別途レビューし、あらためて承認を得る。

`Header` ディレクティブは未対応環境を黙って通さないため `<IfModule>` で囲っていない。Sakuraで未対応の場合はサイト全体が500になる可能性があるため、隔離probeを省略して本番公開しない。ローカルApache・決定論的ブラウザ検査・GitHub Actionsの成功はビルド証跡であり、Sakura上のprobe、観測、公開を許可するものではない。
