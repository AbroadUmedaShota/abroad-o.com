# Screen Requirements Definition Document: Data Entry Service Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`input.html`

## Purpose
This page provides detailed information about Abroad Outsourcing Co., Inc.'s "Data Entry Service" (データ入力サービス). It outlines various types of data input services offered, their pricing structures, the process from inquiry to delivery, and the quality assurance measures in place. The page aims to inform potential clients about the scope, cost, and reliability of the data entry services.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown for Data Entry, Aggregation, Scanning, Image Editing), NEWS, ABOUT (with dropdown for Privacy Policy, Recruit), and CONTACT.
*   **Main Content (`<main>`):
    *   **Service Title Section (`input_top`):** Features the heading "データ入力サービス" (Data Entry Service) accompanied by a spinning cog icon.
    *   **Two-Column Layout:** The main content area is divided into two columns:
        *   **Left Menu (`menu-left`):** A navigation-like list of various data entry services, each with an icon and a brief price indication. Services include: Survey Input, List Input, Postcard Input, Application Form Input, Contract Input, Layout Input, Receipt Input, Aggregation/Graph Creation, Tape/Video Transcription, Data Collection, and Various Office Work. This section also prominently displays the PrivacyMark logo and a statement about the company's certification.
        *   **Right Content (`menu-right`):
            *   **Service Carousel:** A Bootstrap carousel showcasing images related to data entry services (`input-1.png`).
            *   **Quick Links (`mini-box`):** Three small, visually distinct boxes providing quick navigation to the "価格" (Price), "ご利用方法" (How to Use), and "品質" (Quality) sections further down the page.
            *   **Price Section (`text-price`):** Comprehensive pricing tables for different data entry services:
                *   Text Input (for Editorial Production): Priced per character, with tiers based on monthly volume.
                *   Survey, List, Postcard, Application Form Input: Priced per item/field for basic information (e.g., gender, age, name, address, email).
                *   Survey, List, Postcard, Application Form Input (Answer Content): Priced per item/field for answer content (e.g., single answer, multi-answer, free-form text).
                *   Tape/Video Transcription: Priced per 15-minute unit, with options for raw transcription and time codes.
                *   Aggregation/Graph Creation: Links to `aggregate.html` for samples and details.
                *   Other: Includes various additional costs such as express handling, handwritten document surcharges, original document shipping fees, scanning fees, and free server creation for continuous submissions.
                *   Provides payment examples and details the minimum order amount.
            *   **How to Use Section (`text-how`):
                *   **"お問合わせから納品までの流れ" (Flow from Inquiry to Delivery):** A step-by-step visual guide illustrating the process from initial inquiry to final delivery, complete with icons and descriptions for each stage (Inquiry, Submission, Work, Delivery, Billing).
                *   **"継続入稿自動入力サービス" (Continuous Submission Automatic Input Service):** Describes a specialized service for regular, fixed-format document submissions, emphasizing convenience for the client.
                *   **Flow for Continuous Submission:** A simplified step-by-step process specifically for the continuous submission service.
            *   **Quality Section (`text-quality`):** Details the quality assurance measures and standards:
                *   Input Accuracy: Achieves 99.98% accuracy through verify input by specialized staff.
                *   Typed/Handwritten Support: Handled by experienced data entry professionals.
                *   Flexible Billing Deadlines: Offers flexible payment terms, up to 2 months.
                *   Secure Information Management: Highlights PrivacyMark certification ensuring proper handling and management of sensitive information.
    *   **Call to Action Section (`tele_mid4`):** Features a prominent button labeled "≪　無料お見積り・お問合せはコチラ　≫" (Free Estimate/Inquiry Here) that links to `form.html`, along with the company's phone number.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Bootstrap Carousel:** Displays a rotating set of images related to data entry services.
*   **Quick Navigation:** Mini-boxes provide quick links to key sections (Price, How to Use, Quality) within the page.
*   **Inquiry Form Link:** A direct link to `form.html` for free estimates and inquiries.
*   **Modal Window:** Includes a modal (`myModal`) for embedding Google Forms, consistent with other service pages.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   `https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.9.0/css/lightbox.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://use.fontawesome.com/90388fa9b8.js`) - *Note: This page uses FontAwesome 4, which is inconsistent with FontAwesome 5/6 used on `aggregate.html`, `edit.html`, `film.html`, and `index.html`. This should be addressed for site-wide consistency.*
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
    *   Google Forms embedded in modal (`https://docs.google.com/forms/d/e/1FAIpQLSducG_PN_pRRvNlEyEjI8RRUJbhFLKXPr--iopScCsDZhkZ9A/viewform?embedded=true`)