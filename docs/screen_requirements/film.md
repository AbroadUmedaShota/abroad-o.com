# Screen Requirements Definition Document: Film Scanning Service Page

## Page Title
アブロードアウトソーシング株式会社│ 写真・フィルムのスキャニングサービス

## URL
`film.html`

## Purpose
This page is dedicated to detailing Abroad Outsourcing Co., Inc.'s "Film Scanning Service" (フィルムのスキャン). It provides comprehensive information on the types of film supported, acceptable development states, color types, and sizes. The page also includes a detailed pricing table, practical usage examples, and outlines the entire service flow from initial inquiry to final delivery, aiming to inform and guide potential clients.

## Key Elements/Sections
*   **Header:** (Consistent with other service pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other service pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown for Data Entry, Aggregation, Scanning, Image Editing), NEWS, ABOUT (with dropdown for Privacy Policy, Recruit), and CONTACT.
*   **Main Content (`<main>`):
    *   **Service Title Section (`title_top`):** Features the heading "フィルムのスキャン" (Film Scanning) accompanied by a spinning cog icon.
    *   **Film Scanning Details Section (`film_top`):
        *   **Tabbed Interface:** Contains a primary tab labeled "フィルム" (Film) and a "前の画面に戻る" (Go back to previous screen) link. (Note: Other tabs are present in the HTML but appear empty/inactive).
        *   **Film Overview:** An introductory image (`film_top_1.jpg`) and accompanying text that highlights the service's support for various film types and sizes, emphasizing the benefits of digitizing film before degradation.
        *   **"現像状態" (Development State):** Presents three distinct boxes illustrating supported development states (Sleeve finish, Slide finish) and explicitly stating unsupported states (Undeveloped film) with corresponding images and brief descriptions.
        *   **"カラー種類" (Color Types):** Displays three boxes showcasing supported color types (Monochrome Negative, Color Negative, Reversal Negative/Positive Film) with images and descriptions.
        *   **"サイズ種類" (Size Types):** Explains the service's capability to handle film sizes from small to medium format, accompanied by an image (`size.jpg`) and a note encouraging consultation for other sizes.
        *   **Pricing Table (`film_table`):** A comprehensive table detailing the price per frame for various film sizes (e.g., 35mm, 35mm half, 110, 120/Bronica, 126, 127, APS, Large Format) and additional options (e.g., mounting, file naming, file format change, image correction).
        *   **Important Notes (`film_price`):** A text block providing crucial information regarding additional costs (taxes, shipping), potential image quality issues from original film defects, scanning order, trimming, album return policy, and minimum order amount.
        *   **Usage Examples (`film_price2`):** Two practical examples demonstrating how the pricing is calculated for different quantities and types of film, helping clients understand potential costs.
    *   **"お問合せから納品の流れ" (Flow from Inquiry to Delivery) Section (`tele_mid5_orange`):** A clear, step-by-step list outlining the entire service process: Inquiry, Submission, Original Check, Work, Delivery, and Billing.
    *   **"弊社サービスの特徴" (Features of Our Service) Section (`tele_mid6`):** Highlights four key advantages of the company's service:
        *   "はじめてでも安心" (Safe for First-timers): Emphasizes consultation and optimal proposals.
        *   "コスト重視" (Cost-focused): Focuses on appropriate, cost-effective proposals.
        *   "安心の品質" (Reliable Quality): Mentions specialized scanners and management by document information specialists.
        *   "安心のセキュリティ情報管理" (Secure Information Management): Highlights PrivacyMark certification for proper document and data management.
    *   **Call to Action Section (`tele_mid4`):** Features a prominent button labeled "≪　無料お見積り・お問合せはコチラ　≫" (Free Estimate/Inquiry Here) that links to `form.html`, along with the company's phone number.
*   **Footer:** (Consistent with other service pages) Contains copyright information and a "scroll-to-top" button.

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
    *   FontAwesome (`https://kit.fontawesome.com/ac3b49c4bc.js`) - *Note: Consistent FontAwesome5 usage across `aggregate.html`, `edit.html`, and `film.html`.*
    *   jQuery (`https://code.jquery.com/jquery-1.12.4.min.js` and `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`) - *Note: Redundant jQuery imports persist across pages. This should be addressed for site-wide consistency and performance.*
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