# `news.html` 仕様書

## 1. ファイル名
`news.html`

## 2. 目的
アブロードアウトソーシング株式会社の最新情報、お知らせ、プレスリリースなどを時系列で掲載し、訪問者に対して企業の活動状況や更新情報を伝えることを目的とする。

## 3. 主要機能
- **ニュース一覧表示**: 過去のニュース記事を時系列（新しいものが上位）で一覧表示する。
- **ニュース詳細表示**: 各ニュース記事のタイトル、日付、本文、関連画像などを表示する。
- **ニュースカテゴリ/タグ**: （現状はなしだが、将来的な拡張として）ニュースをカテゴリやタグで分類し、絞り込み表示を可能にする。
- **ページ内リンク**: ニュース一覧から各ニュース詳細へのスムーズな遷移。
- **画像表示**: ニュース記事に関連する画像をLightbox形式で拡大表示する機能。

## 4. 構成要素
- **HTML構造**:
    - `<head>`: メタ情報、タイトル、OGP設定、Google Analytics、CSSリンク、ファビコンリンク、Google Fonts。
    - `<body>`:
        - `<header>`: サイトのヘッダー部分（共通コンポーネント化の対象）。
        - `<main>`: ページ主要コンテンツ。
            - `#title_top`: ページタイトル「NEWS」。
            - `#news_top`: ニュースコンテンツのメインエリア。
                - ニュース記事のリスト (`.news_box`)。
                - ニュース一覧へのリンク（サイドバー形式）。
        - `<footer>`: サイトのフッター部分（共通コンポーネント化の対象）。
        - モーダルウィンドウ (`#myModal`): お問い合わせフォームへのリンク。
- **CSSファイル**:
    - `style.css`: 主要なスタイル定義。
    - `lightbox.css`: Lightboxのスタイル。
- **JavaScriptファイル**:
    - Google Analytics関連スクリプト。
    - `https://use.fontawesome.com/297671da61.js`: Font Awesomeアイコン。
    - `js/jquery.easing.min.js`: jQuery Easingプラグイン。
    - `js/script.js`: カスタムJavaScript。
    - `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`: jQueryライブラリ。
    - `js/bootstrap.min.js`: Bootstrap JavaScript。
    - `js/jquery.smooth-scroll.min.js`: スムーズスクロールプラグイン。
    - `js/bootsnav.js`: ナビゲーション関連JavaScript。
    - `lightbox.js`: LightboxのJavaScript。
    - ページトップスクロールボタンのJavaScript。

## 5. 依存関係
- **Bootstrap**: レイアウト、レスポンシブデザイン、ナビゲーション、モーダルなどに使用。
- **jQuery**: DOM操作、イベント処理、各種プラグインの基盤。
- **Font Awesome**: アイコン表示に使用。
- **Lightbox**: 画像の拡大表示機能に使用。
- **Google Analytics**: アクセス解析。

## 6. 備考
- `index.html`と同様に、ヘッダーとフッターは共通コンポーネント化の対象となる。
- JavaScriptファイルが複数回読み込まれている箇所があり、整理が必要。
- `style.css`が適用されているが、`index.html`では`style3.css`が使用されており、CSSの統一性について検討が必要。
- ニュース記事の追加・更新は、現状HTMLファイルを直接編集する必要があるため、CMS導入の検討が望ましい。
