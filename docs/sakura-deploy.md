# さくらサーバー公開手順

## 目的

FileZillaの手作業に依存せず、Git管理された公開ファイルだけをさくらサーバーの公開ディレクトリへ同期する。
CI/Sakuraの実装追跡は Issue #70 で行う。問い合わせフォームのbrowser recoveryテストはcontact作業の責務であり、このデプロイ契約から直接実行しない。

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

`preflight` と `deploy` では `target_sha` に **現在の `master` の完全な40文字SHA** を指定する。workflowは`master`から取得した共通gate helperで、指定SHAが現在の`master`と完全一致し、同じSHA・`master`・pushに対する `.github/workflows/site-check.yml`（`Site checks`）の**最新**runが成功し、そのrunの `site-gate` jobも成功していることを確認してから同じSHAをcheckoutする。APIエラー、run/job不足、別SHA、別ブランチ、後続の失敗runはいずれもfail-closedであり、Sakura接続前に停止する。`package` と読み取り専用の `audit` はこのgateを要求せず、`master`をcheckoutする。`contents: read` と `actions: read` 以外の権限は与えない。デプロイは単一の `sakura-deploy` concurrency group で直列化し、進行中の公開をキャンセルしない。

- `package`: Eleventyビルドと公開パッケージ作成のみ。SecretsとSakura接続は不要。
- `audit`: SSHで本番を読み取り、Gitから生成した公開物とSHA-256を照合する。本番は更新しない。
- `preflight`: SSHで公開ルート、symlink、sanitized snapshotに必要な空き容量、管理外ファイル件数を確認する。本番は更新しない。
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

### CIの費用プロファイル（2026-09-06確認）

リポジトリは public で、`master` の branch protection API は「Branch not protected」だった。利用枠・請求主体・残量はこの作業から取得できず、**unknown** として扱う。直近の `Site checks` 成功run（2026-08-28、run 33208741428）は約8分で、今回追加した `contact-worker` は `npm ci`、`npm test`、`npm run check` の独立Linux jobである。概算は既存site job約8分 + worker jobの実測未取得（最低1分に丸め）で、最低約9 runner分/run、実績取得までは上振れunknownとする。PRとmaster pushの両方で実行されるため、月間見積りは `PR回数 + master push回数` にこの実測前概算を掛ける。新たな高コストmatrixや手動の検証runは追加していない。枠が判明するまで、頻繁な不要pushや手動再実行は避け、実行後にjobごとの実測時間でこの記録を更新する。

さくらサーバー側で国外IPアドレスフィルターが有効な場合、GitHub ActionsからのSSH/SFTP接続が拒否される可能性がある。広く無効化せず、必要な許可リスト運用を優先する。

## バックアップと復元

`Restore` は恒久的に停止している。生のサイト全体backupを復元する機能は持たない。

`Promote` 前には、今回のRC path manifestに列挙されたファイルのうち、公開前に存在するものだけを `restore-contract-v1/` 形式のsanitized archiveとして保存する。`TOOL/`、`pdfjs/build/`、`pdfjs/web/`、`pdfjs/LICENSE`、管理外ファイルはarchiveに入らない。3件のPDFはバイト数とSHA-256を照合し、archiveに必ず含める。archive内metadataはformat version、固定公開ルート、対象RCのpath manifest SHA-256、content evidence SHA-256を結び付ける。archive SHA-256はarchive作成後に出力する。

`Promote` と `RestoreSafe -RestoreApply` は既存backup directory内の `.abroad-o-deploy.lock` を `mkdir` で原子的に取得する。owner metadataにはモード、UTC開始時刻、host、pid、userを記録する。既存lockは古く見えても自動削除せず、運用者が確認して解消するまでfail-closedとする。Promoteではlockがbackup、ファイル反映、反映後SHA監査までを、RestoreSafeでは復元・削除・復元後SHA監査までを包含する。Preflight、Audit、RestoreSafe DryRunは読み取り専用でlockを取得しない。

このarchiveは「今回のRCにより上書きされる既存管理ファイル」の安全な復元用であり、旧サイト全体の完全snapshotではない。過去の所有manifestがないため、現行RCにない旧ファイルを管理対象と推定して保存・復活させない。退役ファイルを戻す必要がある場合は、この契約を拡張せず、別の証跡と明示承認を用意する。

`RestoreSafe` は、上記形式のversioned archiveだけを対象にする。デフォルトはDryRunで、復元・新規管理ファイル削除の一覧だけを出す。実際に変更するには`-RestoreApply`を明示し、archive SHA-256とrestore manifest SHA-256を指定する。`-RestoreApply`は本番変更であり、DryRun結果を確認した後の別の明示承認が必須である。復元先は設定済みの公開ルートと完全一致しなければならず、絶対パス、`..`、CRLF、backslash、symbolic link、hard linkを含むarchiveは拒否する。復元はarchiveの管理対象だけを戻し、現在RC manifestにのみある管理ファイルだけを削除する。管理外ファイルは保持する。

```powershell
$env:SAKURA_BACKUP_FILE = '/home/abroad-o/abroad-o-backups/abroad-o-before-YYYYMMDD-HHMMSS.sra.tgz'
$env:SAKURA_RESTORE_ARCHIVE_SHA256 = '<archive sha256>'
$env:SAKURA_RESTORE_MANIFEST_SHA256 = '<restore manifest sha256>'
.\scripts\deploy-sakura.ps1 -Mode RestoreSafe
# DryRunの一覧を確認した、別の明示承認後だけ実行
.\scripts\deploy-sakura.ps1 -Mode RestoreSafe -RestoreApply
```

`Deploy` は `Preflight`、`Stage`、限定 `Promote` の順で実行する。Preflightは読み取り専用で、公開ディレクトリがシンボリックリンクでないこと、sanitized snapshotに必要な空き容量、管理外ファイル数を確認する。管理外ファイルは一覧出力せずtop-level集計だけを示し、Promoteでは変更・削除しない。manifest記載ファイルと明示削除allowlistだけが公開操作の対象である。

`Stage` は公開tarballをホームディレクトリに置くだけで、公開ディレクトリを変更しない。`Promote` はmanifest記載ファイルだけを上書きし、公開ルートや管理ディレクトリを一括削除しない。反映前に `~/abroad-o-backups/abroad-o-before-<timestamp>.sra.tgz` を作り、package SHA-256、path manifest SHA-256、content evidence SHA-256を区別して出力する。

各ファイルは公開先と同一ディレクトリの固有temporary fileへコピー、存在確認後にrenameする。asset類を先に、HTMLを後に反映する。これはファイル単位の切替であり、サイト全体が単一時点で切り替わるという主張はしない。失敗時は今回作成した固有temporary filesだけを掃除し、公開ルート全体は削除しない。

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
