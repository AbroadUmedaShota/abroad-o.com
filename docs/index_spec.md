# `index.html` 仕様書

## 1. ファイル名
`index.html`

## 2. 目的
本ウェブサイトのトップページであり、訪問者に対してサービス全体の概要、主要な特徴、および企業情報を簡潔に提供することを目的とする。

## 3. 主要機能
- **ヘッダー表示**: サイトロゴ、電話番号、お問い合わせフォームへのリンク、ナビゲーションメニュー（サービス、ニュース、会社概要、お問い合わせ）を表示。
- **メインビジュアル**: 業務効率化に関するキャッチフレーズを表示。
- **サービス紹介**: データ入力、データ集計・分析、スキャニング、画像編集・加工の4つの主要サービスを概要とリンク付きで紹介。
- **テレワーク関連案内**: テレワーク環境整備のための書類デジタル化に関する案内。
- **特徴紹介**: 「小ロットから大プロジェクトまで」「業務フローの標準化」「高品質＆高セキュリティなリソース」の3つの特徴を説明。
- **顧客紹介**: サービス利用企業（官公庁、大学、企業）のロゴをスライダー形式で表示。
- **外部認証資格**: プライバシーマーク、ISMS、QMSの取得状況と文書情報管理士の在籍を案内。
- **フッター表示**: 著作権表示、ページトップへのスクロールボタンを表示。

## 4. 構成要素
- **HTML構造**:
    - `<head>`: メタ情報、タイトル、OGP設定、Google Analytics、CSSリンク、ファビコンリンク、Google Fonts。
    - `<body>`:
        - `<header>`: サイトのヘッダー部分。
            - `#header_top`: ロゴ、電話番号、お問い合わせボタン。
            - `#header_nav`: グローバルナビゲーションメニュー。
        - `<main>`: ページ主要コンテンツ。
            - `#top`: メインビジュアルとキャッチフレーズ。
            - `#service`: 主要サービス紹介とテレワーク案内。
            - `#service2`: 企業の特徴紹介。
            - `#corp`: 顧客ロゴスライダー。
            - `#pre_footer`: 外部認証資格案内。
        - `<footer>`: サイトのフッター部分。
- **CSSファイル**:
    - `style3.css`: 主要なスタイル定義。
    - `slick/slick.css`, `slick/slick-theme.css`: Slick Carouselのスタイル。
- **JavaScriptファイル**:
    - Google Analytics関連スクリプト。
    - `https://code.jquery.com/jquery-3.6.0.min.js`: jQueryライブラリ。
    - `https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.6/dist/umd/popper.min.js`: Popper.js (Bootstrapの依存)。
    - `https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js`: Bootstrap JavaScript。
    - `https://kit.fontawesome.com/ac3b49c4bc.js`: Font Awesomeアイコン。
    - `js/jquery.easing.min.js`: jQuery Easingプラグイン。
    - `js/script.js`: カスタムJavaScript。
    - `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`: 別のjQuery読み込み（重複）。
    - `js/bootstrap.min.js`: 別のBootstrap JavaScript読み込み（重複）。
    - `js/bootsnav.js`: ナビゲーション関連JavaScript。
    - `js/jquery.smooth-scroll.min.js`: スムーズスクロールプラグイン。
    - ページトップスクロールボタンのJavaScript。
    - `//code.jquery.com/jquery-1.11.0.min.js`: 別のjQuery読み込み（重複）。
    - `//code.jquery.com/jquery-migrate-1.2.1.min.js`: jQuery Migrateプラグイン。
    - `slick/slick.min.js`: Slick Carousel JavaScript。
    - Slick Carouselの初期化スクリプト。

## 5. 依存関係
- **Bootstrap**: レイアウト、レスポンシブデザイン、ナビゲーション、ボタンなどに使用。
- **jQuery**: DOM操作、イベント処理、各種プラグインの基盤。複数のバージョンが読み込まれており、整理が必要。
- **Font Awesome**: アイコン表示に使用。
- **Slick Carousel**: 顧客ロゴのスライダー機能に使用。
- **Google Analytics**: アクセス解析。

## 6. 備考
- 現在、jQueryおよびBootstrapのJavaScriptファイルが複数回読み込まれており、パフォーマンスや競合の問題を引き起こす可能性がある。リファクタリングの際に整理が必要。
- ファビコンのパスが`favicon.png`と`fabicon.png`で混在している可能性がある。
- PHPの`include`は使用されていないため、静的なHTMLファイルとして機能している。

