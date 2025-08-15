# Screen Requirements Definition Document: Microfilm Scanning Service Page

## Page Title
アブロードアウトソーシング株式会社│ マイクロフィルムのスキャニングサービス

## URL
`microfilm.html`

## Purpose
This page is dedicated to detailing Abroad Outsourcing Co., Inc.'s "Microfilm Scanning Service" (マイクロフィルムのスキャン). It provides comprehensive information on the types of microfilm supported (e.g., microfiche, aperture cards, microfilm jackets, micro-opaque, micro-card), their physical forms (sheet, roll), and explicitly identifies types that are unsupported (e.g., cartridge type, nitrocellulose base, severely degraded film). The page also includes pricing details and outlines the entire service flow, aiming to inform and guide potential clients on digitizing their microfilm archives.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown for Data Entry, Aggregation, Scanning, Image Editing), NEWS, ABOUT (with dropdown for Privacy Policy, Recruit), and CONTACT.
*   **Main Content (`<main>`):
    *   **Service Title Section (`title_top`):** Features the heading "マイクロフィルムのスキャン" (Microfilm Scanning) accompanied by a spinning cog icon.
    *   **Microfilm Scanning Details Section (`film_top`):
        *   **Tabbed Interface:** Contains a primary tab labeled "マイクロフィルム" (Microfilm) and a "前の画面に戻る" (Go back to previous screen) link. (Note: Other tabs are present in the HTML but appear empty/inactive).
        *   **Service Overview:** An introductory image (`micro_top.jpg`) and accompanying text that highlights the benefits of digitizing microfilm, such as reducing maintenance costs and eliminating risks associated with degradation or equipment failure.
        *   **"形態" (Form):** Presents three boxes illustrating supported physical forms (シートタイプ - Sheet type, ロールタイプ - Roll type) and explicitly stating unsupported forms (カートリッジ式 - Cartridge type) with corresponding images and brief descriptions.
        *   **"種類" (Types):** Displays five boxes detailing various supported microfilm types:
            *   マイクロフィッシュ (Microfiche)
            *   アパチュアカード (Aperture Card)
            *   マイクロジャケット (Microfilm Jacket)
            *   マイクロオペーク (Micro Opaque)
            *   マイクロカード (Micro Card)
            Each includes an image and a brief description.
        *   **"対応が難しいもの" (Difficult to Handle):** This section outlines types of microfilm that are challenging or impossible to process:
            *   **Nitrocellulose (NC) Base Film:** Explains why this type of film (primarily used from 1889-1958) is not accepted due to its high flammability. A table compares NC, TAC (Triacetate Cellulose), and PET (Polyethylene Terephthalate) bases, indicating their acceptance status.
            *   **Severely Degraded Film:** Lists various degradation symptoms (e.g., discoloration, oxidation, breakage, silver mirroring, peeling, mold, cracks, vinegar syndrome, microscopic blemishes) that make film difficult to handle, with an example image (`8.jpg`).
        *   **Pricing Table (`film_table`):** A detailed table outlining prices per frame for various microfilm types (e.g., 16mm roll, 35mm roll, microfiche, microjacket, micro-opaque, microcard) and options (e.g., full scan, file naming, file format change). Some prices are listed as "お問合せください" (Please inquire).
        *   **Important Notes (`film_price`):** A text block providing crucial information regarding additional costs (taxes, shipping), potential image quality issues from original defects, scanning order, potential unreadability due to degradation, and the minimum order amount.
    *   **"お問合せから納品の流れ" (Flow from Inquiry to Delivery) Section (`tele_mid5_orange`):** A clear, step-by-step list outlining the entire service process: Inquiry, Submission, Original Check, Work, Delivery, and Billing.
    *   **"弊社サービスの特徴" (Features of Our Service) Section (`tele_mid6`):** Highlights four key advantages of the company's service:
        *   "はじめてでも安心" (Safe for First-timers)
        *   "コスト重視" (Cost-focused)
        *   "安心の品質" (Reliable Quality)
        *   "安心のセキュリティ情報管理" (Secure Information Management)
    *   **Call to Action Section (`tele_mid4`):** Features a prominent button labeled "≪　無料お見積り・お問合せはコチラ　≫" (Free Estimate/Inquiry Here) that links to `form.html`, along with the company's phone number.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Tabbed Content:** The `film_top` section uses a tabbed interface, though only one tab is actively populated with content.
*   **Inquiry Form Link:** A direct link to `form.html` for free estimates and inquiries.
*   **Modal Window:** Includes a modal (`myModal`) for embedding Google Forms, consistent with other service pages.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://kit.fontawesome.com/ac3b49c4bc.js`) - *Note: Consistent FontAwesome 5 usage across `aggregate.html`, `edit.html`, `film.html`, `index.html`, and `microfilm.html`. However, `about.html` and `form.html` still use older FontAwesome versions.*
    *   jQuery (`https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`) - *Note: Redundant jQuery imports persist across pages. This should be consolidated to a single, consistent version for performance and to avoid potential conflicts.*
    *   `js/jquery.easing.min.js`
    *   `js/script.js`
    *   `js/bootstrap.min.js`
    *   `js/bootsnav.js`
    *   `js/jquery.smooth-scroll.min.js`
    *   `js/box-fadeup.js`
    *   Inline JavaScript for scroll-to-top button functionality.
*   **Conditional (IE9 Support):**
    *   `https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js`
    *   `https://oss.maxcdn.com/respond/1.4.2/respond.min.js`
*   **External Resources:**
    *   Google Web Fonts (`https://fonts.googleapis.com/css?family=Crimson+Text`)
    *   Google Forms embedded in modal (`https://docs.google.com/forms/d/e/1FAIpQLSducG_PN_pRRvNlEyEjI8RRUJbhFLKXPr--iopScCsDZhkZ9A/viewform?embedded=true`)