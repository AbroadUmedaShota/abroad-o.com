# Screen Requirements Definition Document: News Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`news.html`

## Purpose
This page serves as the news and announcements section for Abroad Outsourcing Co., Inc. It provides a chronological list of news articles, including company updates, holiday announcements, and certification news. The page aims to keep visitors informed about the latest developments and important information from the company.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown), NEWS (this page), ABOUT (with dropdown), and CONTACT.
*   **Main Content (`<main>`):
    *   **Title Section (`title_top`):** Features the heading "NEWS".
    *   **News Section (`news_top`):
        *   **Two-Column Layout:** The news content is presented in a two-column layout:
            *   **Left Column (Main News Content - `col-md-8`):** Displays individual news articles, ordered from newest to oldest. Each news box (`news_box`) typically includes:
                *   A main heading (e.g., "年末年始の休業期間についてのご案内" - Year-end and New Year Holiday Announcement).
                *   A sub-heading (if applicable).
                *   Paragraphs of text detailing the announcement or news.
                *   Images (e.g., for P-mark updates) with Lightbox integration for larger viewing.
                *   Links to related pages (e.g., `film.html`, `edit.html`, `privacymark.jp`).
                *   "作成日" (Creation Date) indicating when the news was created or last updated.
            *   **Right Column (News List - `col-md-4`):** Displays a list of links to all news articles within the page. Each list item includes the date and title of the news, and clicking on it scrolls the user to the corresponding news box using an anchor link (e.g., `#news_21`).
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links, allowing users to smoothly navigate to specific news articles from the list.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Lightbox Integration:** Images embedded within news articles can be clicked to open in a larger, overlaying viewer.
*   **Internal Anchor Links:** The news list in the right column uses anchor links to provide quick navigation to specific news items on the same page.
*   **Inquiry Form Link:** A direct link to `form.html` for free estimates and inquiries.
*   **Modal Window:** Includes a modal (`myModal`) for embedding Google Forms, consistent with other service pages.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   `https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.9.0/css/lightbox.css`
    *   `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css` - *Note: This page uses FontAwesome 6.5.1, which is consistent with `index.html`, `aggregate.html`, `edit.html`, and `film.html`. However, `about.html` and `form.html` still use older FontAwesome versions (FontAwesome 4). This inconsistency should be addressed for site-wide consistency.*
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   jQuery (`https://code.jquery.com/jquery-1.12.4.min.js` and `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`) - *Note: Redundant jQuery imports persist across pages. This should be consolidated to a single, consistent version for performance and to avoid potential conflicts.*
    *   `https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.9.0/js/lightbox.min.js`
    *   `js/jquery.easing.min.js`
    *   `js/script.js`
    *   `js/bootstrap.min.js`
    *   `js/jquery.smooth-scroll.min.js`
    *   `js/bootsnav.js`
    *   Inline JavaScript for scroll-to-top button functionality. (A blinking effect script is present but appears incomplete or commented out).
*   **Conditional (IE9 Support):**
    *   `https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js`
    *   `https://oss.maxcdn.com/respond/1.4.2/respond.min.js`
*   **External Resources:**
    *   Google Web Fonts (`https://fonts.googleapis.com/css?family=Crimson+Text`)