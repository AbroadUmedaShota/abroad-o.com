# Screen Requirements Definition Document: Scanning Service Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`scan.html`

## Purpose
This page is dedicated to detailing Abroad Outsourcing Co., Inc.'s comprehensive "Scanning Service" (スキャニングサービス). It provides an overview of various scanning types, including documents, large format materials, film, microfilm, and receipts. The page highlights the features and pricing for each service, and outlines the overall service flow from inquiry to delivery, aiming to guide users through the diverse scanning options available.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown, including a direct link to this Scanning Service page), NEWS, ABOUT (with dropdown), and CONTACT.
*   **Main Content (`<main>`):
    *   **Service Title Section (`title_section`):** Features the heading "スキャニングサービス" (Scanning Service) accompanied by a spinning cog icon.
    *   **Scanning Service Carousel (`scan_carousel`):** A dynamic Bootstrap carousel that showcases different scanning services. Each carousel item includes an image, a brief description of the service, and a link to its respective detailed page or a specific section within this page:
        *   書類の電子化 (Document Digitization) - Links to `#scan-third` (a section within this page).
        *   A1までの大判サイズの電子化 (Large Format Digitization up to A1) - Links to `largeformat.html`.
        *   写真フィルムの電子化 (Photo Film Digitization) - Links to `film.html`.
        *   マイクロフィルムの電子化 (Microfilm Digitization) - Links to `microfilm.html`.
        *   領収書・レシートの電子化 (Receipt Digitization) - Links to `#scan-third` (a section within this page).
    *   **"人気のサービス" (Popular Services) Section (`scan-first`):** This section highlights popular scanning services in a grid layout, each with an icon, a brief description, pricing, and a "詳細はこちら" (Details here) button:
        *   バラ・裁断可の原本 (Loose/Cuttable Originals) - Links to `#scan-third`.
        *   製本・非破壊の原本 (Bound/Non-destructive Originals) - Links to `#scan-third`.
        *   大判サイズの原本 (Large Format Originals) - Links to `largeformat.html`.
        *   フィルム (Film) - Links to `film.html`.
        *   マイクロフィルム (Microfilm) - Links to `microfilm.html`.
        *   スキャンからのデータ入力 (Data Entry from Scan) - Links to `input.html`.
        *   画像編集 (Image Editing) - Links to `edit.html`.
    *   **"種類" (Types) Section (`scan-second`):** Presents a comprehensive grid of various document types that can be scanned, each represented by an icon, an image, and its name (e.g., General Books, Magazines, Contracts, Research Papers, Newsletters/Company Reports, Booklets/Books, Catalogs, Pamphlets, Business Cards, Paintings, Posters, Photos, Albums, Receipts, Product Packages).
    *   **"価格" (Price) Section (`scan-third`):**
        *   **Title:** Features the heading "価格" (Price) with a link to `sample2.html` for color and resolution samples.
        *   **Pricing Tables:** Provides detailed pricing for different scanning scenarios:
            *   **ADF原本 (ADF Originals):** Pricing per sheet for originals that can be automatically fed or cut, based on color (black/white, grayscale, full color) and DPI (200, 300, 400).
            *   **手差し原本 (Manual Feed Originals):** Pricing per sheet for non-destructive or non-automatic feed originals, based on color and DPI.
            *   **その他原本 (Other Originals):** Provides links to `largeformat.html`, `film.html`, and `microfilm.html` for detailed pricing on large format, film, and microfilm scanning, respectively.
        *   **Options Table:** Lists various additional services and their prices, such as blank page deletion, image deskewing, file naming, folder creation, original disposal, cutting, staple removal/attachment, express handling, PDF security/bookmark settings, OCR, on-site pickup/delivery, on-site scanning, image editing, and file format change.
        *   **Payment Examples:** Two practical examples demonstrating how scanning costs are calculated based on quantity and type.
        *   **Important Notes:** A text block providing crucial information regarding tax exclusion, original document condition, minimum order amount, and other considerations.
    *   **"お問合せから納品の流れ" (Flow from Inquiry to Delivery) Section (`flow_section`):** A clear, step-by-step list outlining the entire service process: Inquiry, Submission, Original Check, Work, Delivery, and Billing.
    *   **"弊社サービスの特徴" (Features of Our Service) Section (`feature_section`):** Highlights four key advantages of the company's service:
        *   "はじめてでも安心" (Safe for First-timers)
        *   "コスト重視" (Cost-focused)
        *   "安心の品質" (Reliable Quality)
        *   "安心のセキュリティ情報管理" (Secure Information Management)
    *   **Call to Action Section (`inquiry_section`):** Features a prominent button labeled "無料お見積り・お問い合わせはコチラ" (Free Estimate/Inquiry Here) that links to `form.html`, along with the company's phone number.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Bootstrap Carousel:** Displays a rotating set of images for service overview.
*   **Buttons:** Multiple buttons linking to various service pages and specific sections within this page.
*   **Inquiry Form Link:** A direct link to `form.html` for free estimates and inquiries.

## Dependencies
*   **CSS:**
    *   Bootstrap 4.5.2 (`https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css`) - *Note: This page uses Bootstrap 4, which is a different major version from Bootstrap 3 used on some other pages (`about.html`, `aggregate.html`, `edit.html`, `film.html`, `input.html`, `microfilm.html`, `news.html`, `recruit.html`, `rule.html`, `sample.html`, `sample2.html`). This inconsistency should be addressed for site-wide consistency and to prevent potential rendering issues.*
    *   `style3.css`
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   jQuery (`https://code.jquery.com/jquery-3.5.1.slim.min.js` and `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`) - *Note: Multiple, redundant, and inconsistent jQuery imports persist across pages. This is a critical issue that will negatively impact performance, potentially cause JavaScript conflicts, and should be immediately consolidated to a single, consistent, and up-to-date version.*
    *   Popper.js (`https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js`)
    *   Bootstrap 4.5.2 JS (`https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js`) - *Note: This page uses Bootstrap 4 JavaScript, which is a different major version from Bootstrap 3 JavaScript (`js/bootstrap.min.js`) used on some other pages. This is a major framework version inconsistency.*
    *   FontAwesome 6 (`https://kit.fontawesome.com/ac3b49c4bc.js`) - *Note: Consistent FontAwesome 6 usage across `index.html`, `aggregate.html`, `edit.html`, `film.html`, `microfilm.html`, and `news.html`. However, `about.html`, `form.html`, `input.html`, `recruit.html`, `rule.html`, `sample.html`, and `sample2.html` still use older FontAwesome versions.*
    *   `js/jquery.easing.min.js`
    *   `js/script.js`
    *   `js/bootstrap.min.js` (This local Bootstrap JS is redundant if Bootstrap 4 CDN is used.)
    *   `js/bootsnav.js`
    *   `js/jquery.smooth-scroll.min.js`
    *   `js/box-fadeup.js`
    *   Inline JavaScript for scroll-to-top button functionality.
*   **External Resources:**
    *   Google Web Fonts (`https://fonts.googleapis.com/css?family=Crimson+Text`)