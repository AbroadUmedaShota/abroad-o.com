# Screen Requirements Definition Document: Aggregate Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`aggregate.html`

## Purpose
This page is dedicated to detailing the "Data Aggregation and Analysis Service" offered by Abroad Outsourcing Co., Inc. It explains how the company handles various data aggregation tasks, from simple to complex cross-tabulations for surveys, and highlights their capability to provide insightful reports with customizable graphs.

## Key Elements/Sections
*   **Header:** (Consistent with `about.html`) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with `about.html`) A sticky navigation bar providing links to HOME, SERVICE (with dropdown for Data Entry, Aggregation, Scanning, Image Editing), NEWS, ABOUT (with dropdown for Privacy Policy, Recruit), and CONTACT.
*   **Main Content (`<main>`):
    *   **Service Title Section (`aggregate_top`):** Features the heading "データ集計・分析サービス" (Data Aggregation and Analysis Service) accompanied by a spinning cog icon, visually representing data processing.
    *   **Service Details Section (`sample`):
        *   **Introduction:** A textual overview explaining the breadth of aggregation services, including survey tabulation and report generation.
        *   **Feature Highlights:** Presented in a three-column layout, emphasizing:
            *   Capability to handle basic to complex aggregation (e.g., triple cross-tabulation).
            *   High-precision data aggregation when input services are also utilized.
            *   Customizable work content per survey to align with client budgets.
        *   **Pricing Table (`text-price`):** A detailed table outlining various aggregation services (e.g., Simple Aggregation, Simple Aggregation with Graph, Simple/Cross Aggregation, Triple Cross Aggregation, After Coding, Report Creation) and their respective pricing (some marked as "応相談" - negotiable).
        *   **Delivery Types (`納品種類`):** Specifies that deliverables are primarily in Excel (.xlsx) format, with options for PowerPoint and PDF upon request.
        *   **Data Sample Images (`data-img`):** Provides visual examples of different output formats:
            *   Input Data (Raw Data Only)
            *   Simple Aggregation (GT Aggregation)
            *   Simple Aggregation (GT Graph)
            *   Cross-Tabulation Graph
            These images are integrated with Lightbox for an enhanced viewing experience.
    *   **Call to Action Section (`tele_mid4`):** Features a prominent button labeled "≪　無料お見積り・お問合せはコチラ　≫" (Free Estimate/Inquiry Here) that links to `form.html`, along with the company's phone number.
*   **Footer:** (Consistent with `about.html`) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Lightbox Integration:** Images within the "Data Sample Images" section can be clicked to open in a larger, overlaying viewer.
*   **Inquiry Form Link:** A direct link to `form.html` for free estimates and inquiries.
*   **Modal Window:** Includes a modal (`myModal`) for embedding Google Forms, similar to `about.html`.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   `https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.9.0/css/lightbox.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://kit.fontawesome.com/ac3b49c4bc.js`)
    *   jQuery (`https://code.jquery.com/jquery-1.12.4.min.js` and `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`) - *Note: Redundant jQuery imports. Should be consolidated.*
    *   `https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.9.0/js/lightbox.min.js`
    *   `js/jquery.easing.min.js`
    *   `js/script.js`
    *   `js/bootstrap.min.js`
    *   `js/bootsnav.js`
    *   `js/jquery.smooth-scroll.min.js`
    *   Inline JavaScript for scroll-to-top button functionality.
*   **Conditional (IE9 Support):**
    *   `https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js`
    *   `https://oss.maxcdn.com/respond/1.4.2/respond.min.js`
*   **External Resources:**
    *   Google Web Fonts (`https://fonts.googleapis.com/css?family=Crimson+Text`)
    *   Google Forms embedded in modal (`https://docs.google.com/forms/d/e/1FAIpQLSducG_PN_pRRvNlEyEjI8RRUJbhFLKXPr--iopScCsDZhkZ9A/viewform?embedded=true`)