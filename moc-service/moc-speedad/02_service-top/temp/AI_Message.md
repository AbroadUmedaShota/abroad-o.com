╭────────────────────────────────────────────────────────────────────────────╮
│  > 現在の色味を設定しているものについてにのまとめを一覧に出してください。  │
╰────────────────────────────────────────────────────────────────────────────╯

✦ 承知いたしました。現在の色味を設定しているものについて、service-top-style.css
  の定義と、それがどのように使用されているかを一覧でまとめます。

  1. CSS変数による色の定義 (service-top-style.css の :root セレクタ内)

    1 :root {
    2     /* Base Colors */
    3     --color-base-white: #FFFFFF;
    4     --color-base-black: #000000;
    5     --color-base-background-main: #FFFFFF;
    6     --color-base-background-sub: #F0F0F0;
    7     --color-base-card: #FFFFFF;
    8     --color-base-border-divider: #E0E0E0;
    9     --color-base-shadow-soft: none; /* フラットデザインのためnone */
   10     --color-base-shadow-strong: none; /* フラットデザインのためnone */
   11
   12     /* Text Colors */
   13     --color-text-main: #1A1A1A;
   14     --color-text-sub: #6B6B6B;
   15     --color-text-disabled: #AAAAAA;
   16
   17     /* Brand Colors */
   18     --color-brand-base-primary: #4285F4; /* Google Blue */
   19     --color-brand-base-secondary: #BDBDBD; /* Material Grey 400 */
   20     --gradient-brand-accent: linear-gradient(90deg, var(--color-brand-base-primary) 0%, var(--color-brand-base-secondary) 100%
      );
   21
   22     /* State Colors */
   23     --color-state-info: #2196F3;
   24     --color-state-success: #4CAF50;
   25     --color-state-warning: #FFC107;
   26     --color-state-error: #D32F2F;
   27     --color-state-on-info: #FFFFFF;
   28     --color-state-on-success: #FFFFFF;
   29     --color-state-on-warning: #1A1A1A;
   30     --color-state-on-error: #FFFFFF;
   31
   32     /* Button Colors */
   33     --color-button-primary-bg: #4285F4;
   34     --color-button-primary-text: #FFFFFF;
   35     --color-button-primary-hover-bg: #3367D6;
   36     --color-button-secondary-bg: #F0F0F0;
   37     --color-button-secondary-text: #1A1A1A;
   38     --color-button-secondary-hover-bg: #9E9E9E;
   39     --color-button-danger-bg: #D32F2F;
   40     --color-button-danger-text: #FFFFFF;
   41     --color-button-danger-hover-bg: #B02727;
   42     --color-button-disabled-bg: #E0E0E0;
   43     --color-button-disabled-text: #AAAAAA;
   44
   45     /* Input Colors */
   46     --color-input-bg: #FFFFFF;
   47     --color-input-text: #1A1A1A;
   48     --color-input-placeholder: #B0B0B0;
   49     --color-input-border-default: #D0D0D0;
   50     --color-input-border-focus: var(--color-brand-base-primary);
   51     --color-input-border-error: #D32F2F;
   52     --color-input-text-error: #D32F2F;
   53     --color-input-disabled-bg: #F5F5F5;
   54     --color-input-disabled-text: #AAAAAA;
   55
   56     /* M3_CONTAINER_COLOR_MISMATCH: Material 3由来のコンテナカラーの定義残存と再マッピング */
   57     --color-primary: var(--color-brand-base-primary);
   58     --color-secondary: var(--color-brand-base-secondary);
   59     --color-on-secondary: var(--color-state-on-info);
   60     --color-secondary-container: var(--color-button-secondary-bg);
   61     --color-on-secondary-container: var(--color-button-secondary-text);
   62
   63     --color-error: var(--color-state-error);
   64     --color-on-error: var(--color-state-on-error);
   65     --color-error-container: var(--color-state-error);
   66     --color-on-error-container: var(--color-on-error);
   67
   68     /* Scrim Color (for modal overlays) */
   69     --color-scrim: rgba(0, 0, 0, 0.15);
   70
   71     /* Accent Gradient (from guideline) */
   72     --gradient-primary-bg: var(--color-brand-base-primary);
   73     --gradient-button-bg: var(--color-button-primary-bg);
   74     --gradient-secondary-bg: var(--color-brand-base-secondary);
   75 }

  2. CSS変数とユーティリティクラスのマッピング (service-top-style.css 内)

  これらのCSS変数は、主に以下のユーティリティクラスを通じてHTML要素に適用されています。

   * 背景色 (`background-color`)
       * .bg-primary: var(--color-primary)
       * .bg-background: var(--color-base-background-main)
       * .bg-surface: var(--color-base-card)
       * .bg-surface-variant: var(--color-base-background-sub)
       * .bg-surface-bright: var(--color-input-bg)
       * .bg-primary-container: var(--color-primary-container)
       * .bg-secondary-container: var(--color-secondary-container)
       * .bg-error-container: var(--color-error-container)
       * .bg-scrim: var(--color-scrim)
       * .button-gradient-bg: var(--gradient-button-bg) (現在は単色にマッピング)
       * .gradient-primary-bg: var(--gradient-primary-bg) (現在は単色にマッピング)
       * .toast-notification.toast-success: var(--color-state-success)
       * .toast-notification.toast-error: var(--color-state-error)
       * .toast-notification.toast-info: var(--color-state-info)
       * button:disabled, .button-disabled: var(--color-button-disabled-bg)
       * .sidebar nav a.active: var(--color-primary-container)
       * .sidebar nav a:hover: #2064a8 (直接指定、変更の余地あり)
       * ::-webkit-scrollbar-track: var(--color-base-background-sub)
       * ::-webkit-scrollbar-thumb: #94a3b8 (直接指定)
       * ::-webkit-scrollbar-thumb:hover: #64748b (直接指定)

   * 文字色 (`color`)
       * .text-on-background: var(--color-text-main)
       * .text-on-surface: var(--color-text-main)
       * .text-on-surface-variant: var(--color-text-sub)
       * .text-on-primary: var(--color-button-primary-text)
       * .text-on-secondary: var(--color-button-secondary-text)
       * .text-on-primary-container: var(--color-on-primary-container)
       * .text-on-secondary-container: var(--color-on-secondary-container)
       * .text-error: var(--color-state-error)
       * .text-on-error-container: var(--color-on-error-container)
       * .text-primary: var(--color-primary)
       * .text-secondary: var(--color-secondary)
       * .text-disabled: var(--color-text-disabled)
       * .toast-notification.toast-success: var(--color-state-on-success)
       * .toast-notification.toast-error: var(--color-state-on-error)
       * .toast-notification.toast-info: var(--color-state-on-info)
       * button:disabled, .button-disabled: var(--color-button-disabled-text)
       * .sidebar nav a.active: var(--color-on-primary-container)
       * .sidebar nav a:hover: #ffffff (直接指定)
       * .sidebar nav a.active .material-icons: var(--color-primary)
       * .survey-table td:before: var(--color-text-sub)
       * .input-field::placeholder: transparent
       * .input-field:focus + .input-label: var(--color-input-border-focus)
       * .input-field.is-focused + .input-label: var(--color-input-border-focus)
       * .input-field:-webkit-autofill + .input-label: var(--color-input-border-focus)
       * .input-label: var(--color-text-sub)
       * .input-field-static: var(--color-on-surface-variant)
       * .input-label-static: var(--color-text-sub)
       * .error-message: var(--color-input-text-error)

   * ボーダー色 (`border-color`)
       * .border-outline: var(--color-base-border-divider)
       * .border-outline-variant: var(--color-base-border-divider)
       * .input-field: var(--color-input-border-default)
       * .input-field:focus: var(--color-input-border-focus)
       * .input-field.input-error, select.input-error, input[type="date"].input-error: var(--color-input-border-error)
       * .question-item.dragging: var(--color-primary)
       * .question-item.drag-over: var(--color-secondary)
       * .survey-table tr: var(--color-base-border-divider)
       * .survey-table td: var(--color-base-border-divider)
       * .question-item: border-outline-variant (クラス経由)
       * .survey-table: border-outline-variant (クラス経由)
       * .accordion-item: border-outline-variant (クラス経由)
       * .survey-preview-container: border-outline-variant (クラス経由)

  3. HTMLファイルでの直接の色指定 (一部)

  HTMLファイル内で直接色を指定している箇所は、Tailwind CSSのユーティリティクラスや、インラインスタイルとして存在します。

   * index.html, surveyCreation.html, bizcardSettings.html, thankYouEmailSettings.html のヘッダーのロゴSVGの fill="currentColor"
     は、親要素の text-on-primary の色を継承します。
   * index.html のスクロールバーのサムの色は #94a3b8 と #64748b が直接指定されています。
   * modals/accountInfoModal.html のパスワード変更ボタンのホバー色は hover:text-secondary となっており、これは var(--color-secondary)
     を参照します。

  この一覧で、現在の色味の設定状況が把握できるかと思います。"ザーに「セッションが切れました。再度お試しください。」のような**分かりやすいエラーメッセージ**をトースト通知で表示し、必要に応じて新しい冪等性キーの取得を促す導線を検討する。"