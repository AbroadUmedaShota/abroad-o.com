# Screen Requirements Definition Document: Service Pack Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`service-pack.html`

## Purpose
This page introduces two specialized "service packs" offered by Abroad Outsourcing Co., Inc.: the "らくらくスキャンパック" (Easy Scan Pack) and the "写真美化パック" (Photo Beautification Pack). These bundled services are designed to provide simplified, all-inclusive solutions for document scanning and photo enhancement, catering to users who seek straightforward and efficient digitization and beautification processes.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown), NEWS, ABOUT (with dropdown), and CONTACT.
*   **Main Content (`<main>`):
    *   **Service Pack Title Section (`title_top`):** Features the heading "オススメサービス" (Recommended Services) accompanied by a spinning cog icon.
    *   **"らくらくスキャンパック" (Easy Scan Pack) Section (`service-pack1`):
        *   **Title:** "らくらくスキャンパック" (Easy Scan Pack).
        *   **Service Content Overview:** Explains a simplified pricing model based on cardboard box size and quantity, plus optional services. An example calculation is provided to illustrate the cost structure.
        *   **Key Features:** Four icon-based features highlighting the pack's benefits:
            *   Supports documents from business card size up to A3.
            *   Users simply put documents into a box without prior sorting.
            *   Specifications are handled by the service provider.
            *   Personal information is handled securely (indicated by PrivacyMark).
        *   **"こんな方にオススメ" (Recommended for):** A list of common user scenarios where this pack is an ideal solution (e.g., desire to view documents on PC, need for emergency data backup, aim to free up bookshelf space, preference for complete outsourcing without hassle).
        *   **Pricing Table:** Details pricing based on cardboard box size (80, 100, 120 size) and associated estimated delivery days.
        *   **Options Table:** Lists various optional services (e.g., higher resolution settings, custom sizing, custom file naming, trimming, photo removal from mounts) and their additional costs.
        *   **Delivery Methods Table:** Outlines available delivery options (e.g., download via free storage server, CD-R/DVD-R, USB, secure server download for continuous submissions) and their respective costs.
        *   **"ご利用方法" (How to Use):** A step-by-step guide detailing the process from initial application to the return of original documents (Application, Shipping, Arrival Check, Scanning, Delivery, Payment, Return).
        *   **Call to Action Button:** A large button labeled "≪　らくらくスキャンパックのお問合わせはこちら　≫" (Inquire about Easy Scan Pack Here) that links to `form.html` (via `myModal2`).
    *   **Separator Image (`bottom_img2`):** A visual separator between the two service pack sections.
    *   **"写真美化パック" (Photo Beautification Pack) Section (`service-pack2`):
        *   **Title:** "写真美化パック" (Photo Beautification Pack).
        *   **Service Content Overview:** Explains the service's aim to digitize and enhance photos, including those that are already beautiful, slightly faded, stained, or in large quantities. An illustrative image (`pack.png`) is included.
        *   **"こんな方にオススメ" (Recommended for):** A list of common user scenarios where this pack is suitable (e.g., desire to view photos on PC/smartphone, wish to restore faded photos, difficulty finding photos in albums, desire to give photos as gifts, need for beautiful images for events like weddings or parties).
        *   **Pricing Table:** Details pricing based on the number of photos per album (Mini Album Plan, Album Plan, Large Album Plan), with each plan including "データ化+ファイル名入力+写真補正" (Digitization + File Naming + Photo Correction).
        *   **Options Table:** Lists additional options (e.g., resolution upgrade, black and white photo colorization, correction for highly degraded photos) and their costs.
        *   **"ご利用方法" (How to Use):** A step-by-step guide detailing the process from initial application to the return of original photos (Application, Shipping, Arrival Check, Scanning, Delivery, Payment, Return).
        *   **Call to Action Button:** A large button labeled "≪　写真美化パックのお問合わせはこちら　≫" (Inquire about Photo Beautification Pack Here) that links to `form.html`.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Inquiry Form Links:** Multiple prominent buttons linking to `form.html` for inquiries, with some utilizing modal windows for Google Forms.
*   **Modal Windows:** Includes two modals (`myModal`, `myModal2`) for embedding Google Forms, consistent with other service pages.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://use.fontawesome.com/297671da61.js`) - *Note: This page uses FontAwesome 4, which is inconsistent with FontAwesome 5/6 used on `index.html`, `aggregate.html`, `edit.html`, `film.html`, `microfilm.html`, and `news.html`. This should be addressed for site-wide consistency.*
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