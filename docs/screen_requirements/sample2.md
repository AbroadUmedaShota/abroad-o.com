# Screen Requirements Definition Document: Scanning Sample Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`sample2.html`

## Purpose
This page serves as a demonstration of Abroad Outsourcing Co., Inc.'s scanning capabilities, specifically showcasing the differences in scanning quality based on color and resolution. It aims to educate users on optimal DPI settings for various purposes (storage, viewing, high-quality printing) and explains technical concepts such as file size implications and the occurrence of moiré patterns.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown), NEWS, ABOUT (with dropdown), and CONTACT.
*   **Main Content (`<main>`):
    *   **Scan Sample Section (`sample`):
        *   **Title:** Features the heading "スキャン" (Scan) accompanied by a commenting icon.
        *   **Introduction:** Explains the purpose of the samples, which is to illustrate the variations in scanning quality based on color and resolution settings.
        *   **DPI Recommendations:** Provides textual recommendations for optimal DPI (dots per inch) settings tailored to different usage scenarios:
            *   240dpi or higher for archival storage.
            *   300-400dpi for general viewing.
            *   400-600dpi for enlargement or high-quality printing.
            It also explains the relationship between color/DPI and file size (e.g., black and white < grayscale ≈ full color; lower DPI < higher DPI leads to larger file sizes) and mentions the potential for moiré patterns due to the nature of optical scanning.
        *   **Scanning Samples (Embedded PDFs):** Displays three distinct scanning samples, each embedded as a PDF viewer, allowing users to interact with the content:
            *   **"①白黒2値" (1-bit Black and White):** Sample embedded from `/pdfjs/1c_abroad.pdf`.
            *   **"グレースケール" (Grayscale):** Sample embedded from `/pdfjs/2c_abroad.pdf`.
            *   **"フルカラー" (Full Color):** Sample embedded from `/pdfjs/4c_abroad.pdf`.
            Each sample is accompanied by a "前のページに戻る" (Go back to previous page) link to `scan.html`.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Embedded PDF Viewers:** Allows direct viewing and interaction with PDF scanning samples within the page.
*   **Inquiry Form Link:** A direct link to `form.html` for inquiries.
*   **Modal Window:** Includes a modal (`myModal`) for embedding Google Forms, consistent with other service pages.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://use.fontawesome.com/90388fa9b8.js`) - *Note: This page uses FontAwesome 4, which is inconsistent with FontAwesome 5/6 used on `index.html`, `aggregate.html`, `edit.html`, `film.html`, `microfilm.html`, and `news.html`. This should be addressed for site-wide consistency.*
    *   jQuery (`https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`) - *Note: Redundant jQuery imports persist across pages. This should be consolidated to a single, consistent version for performance and to avoid potential conflicts.*
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
    *   PDF.js (implied by embedded PDF objects, though the library itself is not directly linked in the `<script>` tags, suggesting it's handled by the browser or a pre-loaded script not visible in this file).