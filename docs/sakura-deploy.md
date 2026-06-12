# さくらサーバー公開手順

## 目的

FileZillaの手作業に依存せず、Git管理された公開ファイルだけをさくらサーバーの公開ディレクトリへ同期する。

## 公開対象

公開対象は `deploy/sakura-public-files.json` で管理する。

含めるもの:

- ルートの `*.html`, `.htaccess`, `sitemap.xml`, `style*.css`, `global.css`
- `css/`, `fonts/`, `image/`, `js/`, `news/`, `pdfjs/`, `slick/`, `TOOL/`

含めないもの:

- `.git/`, `.github/`, `.vscode/`, `.deploy/`
- `docs/`, `data/`, `deploy/`, `scripts/`
- `*.md`

## ローカル実行

PowerShellでリポジトリルートから実行する。

```powershell
.\scripts\deploy-sakura.ps1 -Mode DryRun
```

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

`.github/workflows/deploy-sakura.yml` は手動実行のみ。

GitHub repository secrets:

- `SAKURA_HOST`
- `SAKURA_USER`
- `SAKURA_REMOTE_DIR`
- `SAKURA_SSH_KEY`
- `SAKURA_PORT`

最初は `dry_run=true` で実行し、公開対象のパッケージだけ確認する。実公開する場合だけ `dry_run=false` を選ぶ。

さくらサーバー側で国外IPアドレスフィルターが有効な場合、GitHub ActionsからのSSH/SFTP接続が拒否される可能性がある。広く無効化せず、必要な許可リスト運用を優先する。

## バックアップと復元

`Deploy` は反映前にリモート側で `~/abroad-o-backups/abroad-o-before-<timestamp>.tgz` を作る。

直近の本番反映時バックアップ:

```text
/home/abroad-o/abroad-o-backups/abroad-o-before-20260526-225613.tgz
```

復元する場合:

```powershell
$env:SAKURA_BACKUP_FILE = "/home/abroad-o/abroad-o-backups/abroad-o-before-YYYYMMDD-HHMMSS.tgz"
.\scripts\deploy-sakura.ps1 -Mode Restore
```

## 確認

デプロイ後はスクリプトが以下を確認する。

- `https://www.abroad-o.com/` が 200
- `https://www.abroad-o.com/speed-ad.html` が 200
- `https://www.abroad-o.com/news/news_260526.html` が 200
- `https://www.abroad-o.com/news/news_260615.html` が 200
- `https://www.abroad-o.com/TOOL/index.html` が 200
- `https://www.abroad-o.com/docs/TOOL_USAGE.md` が 404
