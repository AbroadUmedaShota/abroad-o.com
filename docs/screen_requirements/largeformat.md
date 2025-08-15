# Screen Requirements Definition Document: Large Format Digitization Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`largeformat.html`

## Purpose
This page is dedicated to detailing Abroad Outsourcing Co., Inc.'s "Large Format (up to A1 size) Digitization Service" (大判（A1サイズまで）の電子化). It focuses on the specialized scanning of oversized documents such as architectural drawings, posters, paintings, and newspapers. The page emphasizes the use of high-speed overhead photography, which minimizes burden on original documents and allows for competitive pricing. It aims to inform potential clients about the capabilities, process, and cost of digitizing large-scale materials.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown for Data Entry, Aggregation, Scanning, Image Editing), NEWS, ABOUT (with dropdown for Privacy Policy, Recruit), and CONTACT.
*   **Main Content (`<main>`):
    *   **Service Title Section (`title_top`):** Features the heading "大判（A1サイズまで）の電子化" (Large Format (up to A1 size) Digitization) accompanied by a spinning cog icon.
    *   **Large Format Scanning Details Section (`film_top`):
        *   **Tabbed Interface:** Contains a primary tab labeled "大判（A1サイズまで）の電子化" (Large Format (up to A1 size) Digitization) and a "前の画面に戻る" (Go back to previous screen) link. (Note: Other tabs are present in the HTML but appear empty/inactive).
        *   **Service Overview:** An introductory image (`1_big.jpg`) and accompanying text that highlights the service's support for large documents up to A1 size, emphasizing low cost and minimal burden on originals due to high-speed overhead photography.
        *   **"電子化対象" (Digitization Targets):** Explains that various types of originals, including loose papers, bound books, and framed items, can be digitized without cutting or disassembling, thanks to the overhead (俯瞰) photography method. Examples are provided with images (`2_bara.jpg`, `3_book.jpg`, `4_gaku.jpg`).
        *   **"サンプル" (Sample):** Provides a sample image of an A1 size digitized document (`5_sample.jpg`) and mentions the possibility of providing samples from actual originals. Includes notes about potential distortion and readability issues.
        *   **Pricing Table (`film_table`):** A detailed table outlining prices per page for different large formats (A2/B3, A1/B2) and various options, categorized into:
            *   **Option ① (Original Type):** Pricing based on the type of original (e.g., loose paper with/without unfolding, accordion-bound books, hardcover books) and their thickness tiers.
            *   **Option ② (Ancillary Services):** Pricing for additional services such as file/folder naming (simple sequential or custom), file format conversion (JPEG to PDF or TIFF), file storage delivery, DVD delivery, original document return shipping, and original document disposal.
        *   **Payment Examples (`largepaper2`):** Two practical examples demonstrating how the pricing is calculated for different types of large format digitization, including the application of Option ①.
        *   **Important Notes (`film_price`):** A text block providing crucial information regarding tax exclusion, the primary use of overhead cameras, default output format (full color/300dpi/JPEG), potential image quality issues from original defects, considerations for bound/folded originals, scanning order, file naming conventions, actual quantity billing, and the minimum order amount.
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
*   **Lightbox Integration:** Sample images can be clicked to open in a larger, overlaying viewer.
*   **Inquiry Form Link:** A direct link to `form.html` for free estimates and inquiries.
*   **Modal Windows:** Includes two modals (`myModal`, `myModal2`) for embedding Google Forms, consistent with other service pages.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   `https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.9.0/css/lightbox.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://use.fontawesome.com/297671da61.js`) - *Note: This page uses FontAwesome 4, which is inconsistent with FontAwesome 5/6 used on `aggregate.html`, `edit.html`, `film.html`, and `index.html`. This should be addressed for site-wide consistency.*
    *   jQuery (`https://code.jquery.com/jquery-1.12.4.min.js` and `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`) - *Note: Redundant jQuery imports persist across pages. This should be consolidated to a single, consistent version for performance and to avoid potential conflicts.*
    *   `https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.9.0/js/lightbox.min.js`
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
    *   Google Forms embedded in modals (`https://docs.google.com/forms/d/e/1FAIpQLSducG_PN_pRRvNlEyEjI8RRUJbhFLKXPr--iopScCsDZhkZ9A/viewform?embedded=true` and `https://docs.google.com/forms/d/e/1FAIpQLScbeS-kxx7YT_ONfPENKkqfBis4d_Rd2O3pri_WRoAO0xGMDg/viewform?embedded=true`)