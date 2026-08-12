# abroad-o.com 公開手順

## 基本方針

- 公開前に `git status --short` を確認する。
- ユーザーが指定したファイルだけを公開し、無関係な未コミット変更を巻き込まない。
- 接続先、対象ファイル、バックアップ、公開後の確認結果を記録する。
- パスワード、秘密鍵、FileZilla の保存資格情報を画面・ログ・コミットへ出力しない。

## サイト全体を公開する場合

1. 作業ツリーが公開対象の変更だけであることを確認する。
2. 無関係な変更がある場合は、現在の HEAD から一時 worktree を作り、公開対象の差分だけを適用する。
3. 一時 worktree で次を実行する。

   ```powershell
   .\scripts\deploy-sakura.ps1 -Mode DryRun
   .\scripts\deploy-sakura.ps1 -Mode Deploy -UseFileZillaConfig
   ```

4. `DryRun` が成功する前に `Deploy` を実行しない。
5. `deploy-sakura.ps1` の実アップロードは SSH/SCP を使用する。FileZilla が FTP 接続でも SSH 鍵は別途必要なため、SSH 鍵または SSH Agent が使えない環境ではこの経路を使用しない。

## 単一ファイルだけを公開する場合

サイト全体用スクリプトは公開対象一式を再配置するため、作業ツリーに無関係な変更がある場合は単一ファイル FTP を使用する。

公開HTMLはEleventyの生成物を使用する。`npm ci`実行後、`npm run build:site`で生成した`_site/<対象ファイル>`をアップロード元とし、`site/pages/`のテンプレートを直接アップロードしない。

1. `%APPDATA%\FileZilla\filezilla.xml` または `sitemanager.xml` から `abroad-o.sakura.ne.jp` の既存 FTP 設定を読み込む。
2. 資格情報は処理内だけで復号し、値を出力しない。
3. FTP 上の対象ファイルを取得し、更新前の内容であることを確認する。
4. 更新前ファイルを次の公開ディレクトリ外へバックアップする。

   ```text
   /www/abroad-o-backups/<ファイル名>-before-YYYYMMDD-HHmmss
   ```

5. ローカルの対象ファイルだけを次の公開先へアップロードする。

   ```text
   FTP host: abroad-o.sakura.ne.jp
   公開ルート: /www/abroad-o.com/
   ```

6. FTP クライアントの終了コードを確認し、バックアップまたはアップロードが失敗した場合は後続処理を止める。

## 公開後の確認

1. キャッシュ回避用クエリを付けて公開 URL を取得する。

   ```text
   https://www.abroad-o.com/<対象ファイル>?codex_verify=<現在時刻>
   ```

2. HTTP 200 だけでなく、今回変更した文字列やリンクが本文に存在することを確認する。
3. 次の主要ページが HTTP 200 を返すことも確認する。

   ```text
   https://www.abroad-o.com/
   https://www.abroad-o.com/speed-ad.html
   https://www.abroad-o.com/news/news_260526.html
   https://www.abroad-o.com/sample2.html
   https://www.abroad-o.com/pdfjs/1c_abroad.pdf
   https://www.abroad-o.com/pdfjs/2c_abroad.pdf
   https://www.abroad-o.com/pdfjs/4c_abroad.pdf
   ```

   `https://www.abroad-o.com/TOOL/index.html` と `https://www.abroad-o.com/pdfjs/web/viewer.html` が 404 を返すことも確認する。

4. 元の作業ツリーで `git status --short` を再確認し、対象外の変更が保持されていることを確認する。
5. 一時 worktree、ローカル一時バックアップ、今回起動して残った SSH/SCP プロセスだけを片付ける。

## ロールバック

公開内容に問題がある場合は、`/www/abroad-o-backups/` に保存した対象ファイルを確認し、元の公開パスへ再アップロードする。その後、キャッシュ回避付き URL で本文まで再確認する。
