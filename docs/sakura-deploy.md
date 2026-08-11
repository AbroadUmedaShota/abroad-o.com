# さくらサーバー公開手順

## 目的

FileZillaの手作業に依存せず、Git管理された公開ファイルだけをさくらサーバーの公開ディレクトリへ同期する。

## 公開対象

公開対象は `deploy/sakura-public-files.json` で管理する。HTMLはEleventyで`site/`から`_site/`へ生成し、デプロイスクリプトは`_site/`だけを梱包する。

含めるもの:

- `_site/`に生成されたルートHTMLとNEWS記事
- `_site/`へコピーされた`.htaccess`、CSS、画像、JavaScript、PDF.js、`slick/`、`TOOL/`

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

FileZillaがFTP/21番で保存されていても、このデプロイスクリプトはバックアップと復元を安全に行うためSSH/SCPを使う。FTPパスワードは表示・利用しない。

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

`Deploy` は `Preflight`、`Stage`、限定 `Promote` の順で実行する。Preflightは読み取り専用で、公開ディレクトリがシンボリックリンクでないこと、公開ファイルがローカルmanifestと完全一致すること、空き容量が100 MiB以上あることを確認する。未知のリモートファイルが1件でもある場合は反映を中止する。

`Stage` は公開tarballをホームディレクトリに置くだけで、公開ディレクトリを変更しない。`Promote` はmanifest記載ファイルだけを上書きし、公開ルートや管理ディレクトリを一括削除しない。反映前に `~/abroad-o-backups/abroad-o-before-<timestamp>.tgz` を作り、manifestのSHA-256を操作証跡として出力する。

これらのモードはSSH/SCP鍵認証が必須である。FileZillaにFTP/21の設定しかない場合は、このスクリプトで接続・公開しない。FTPパスワードの読取り、表示、またはFTPへのフォールバックは行わない。

直近の本番反映時バックアップ:

```text
/home/abroad-o/abroad-o-backups/abroad-o-before-20260526-225613.tgz
```

復元する場合:

```powershell
$env:SAKURA_BACKUP_FILE = "/home/abroad-o/abroad-o-backups/abroad-o-before-YYYYMMDD-HHMMSS.tgz"
.\scripts\deploy-sakura.ps1 -Mode Restore
```

段階操作を個別に実行する場合は、`Stage` の出力したリモートtarballパスを `Promote` に渡す。

```powershell
.\scripts\deploy-sakura.ps1 -Mode Preflight
.\scripts\deploy-sakura.ps1 -Mode Stage
$env:SAKURA_STAGED_PACKAGE = '$HOME/abroad-o-public-YYYYMMDD-HHMMSS.tgz'
.\scripts\deploy-sakura.ps1 -Mode Promote
```

## 確認

デプロイ後はスクリプトが以下を確認する。

- `https://www.abroad-o.com/` が 200
- `https://www.abroad-o.com/speed-ad.html` が 200
- `https://www.abroad-o.com/news/news_260526.html` が 200
- `https://www.abroad-o.com/news/news_260615.html` が 200
- `https://www.abroad-o.com/TOOL/index.html` が 200
- `https://www.abroad-o.com/docs/TOOL_USAGE.md` が 404
