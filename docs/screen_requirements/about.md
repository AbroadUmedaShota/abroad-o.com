# Screen Requirements Definition Document: About Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`about.html`

## Purpose
This page provides comprehensive information about Abroad Outsourcing Co., Inc., including its company profile, corporate philosophy, and an introduction to its executives. It also features a contact section with a map and a direct link to the inquiry form, serving as a central hub for visitors to learn about the company and get in touch.

## Key Elements/Sections
*   **Header:** Displays the company logo, contact phone number, and a quick link to the inquiry form.
*   **Navigation Bar:** A sticky navigation bar offering links to:
    *   HOME
    *   SERVICE (with dropdown menu for Data Entry, Data Aggregation/Analysis, Scanning, and Image Editing/Processing services)
    *   NEWS
    *   ABOUT (with dropdown menu for Privacy Policy and Recruit information)
    *   CONTACT (links to the contact section within this page)
*   **Main Content (`<main>`):
    *   **Title Section:** Features the heading "ABOUT".
    *   **About Section (`about_top`):
        *   **Tabbed Interface:** Organizes content into three distinct tabs:
            *   **会社概要 (Company Profile):** Presents detailed company information in a tabular format, including Trade Name, English Name, Establishment Date, Head Office Location, Phone Number, FAX, Email Address, Representative, Business Content, and Main Banks.
            *   **企業理念 (Corporate Philosophy):** Articulates the company's core philosophy, emphasizing "Business Process Standardization (BPS)" and the strategic allocation of resources to enhance the competitiveness of Japanese businesses.
            *   **役員紹介 (Executive Introduction):** Contains a message from the representative director and a biographical table outlining their professional background and key milestones.
    *   **Contact Section (`contact_up`, `contact_top`):
        *   **Title:** Displays the heading "CONTACT".
        *   **Google Map Embed:** Provides an interactive map showing the company's headquarters location.
        *   **Contact Button:** A prominent button labeled "≪　お問合わせはこちら　≫" (Inquire Here) that directs users to `form.html`.
*   **Footer:** Contains copyright information and a "scroll-to-top" button for easy navigation.

## Functionality
*   **Responsive Navigation:** The navigation bar is responsive, collapsing into a hamburger menu on smaller screens.
*   **Tabbed Content:** The "ABOUT" section utilizes a tabbed interface for organizing and displaying company information, allowing users to switch between Company Profile, Corporate Philosophy, and Executive Introduction.
*   **Smooth Scrolling:** Implemented for internal page links (e.g., "CONTACT" in the navigation).
*   **Scroll-to-Top Button:** A button appears after scrolling down, allowing users to quickly return to the top of the page.
*   **External Form Modals:** Although not directly triggered by visible elements on this page, the HTML includes definitions for two modal windows (`myModal`, `myModal2`) that embed Google Forms, suggesting they might be activated via JavaScript or from other linked pages.
*   **Google Maps Integration:** Displays the company's location directly on the page.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://use.fontawesome.com/297671da61.js`)
    *   jQuery (`https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`)
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
    *   Google Maps Embed (`https://www.google.com/maps/embed?...`)
    *   Google Forms embedded in modals (`https://docs.google.com/forms/d/e/1FAIpQLSducG_PN_pRRvNlEyEjI8RRUJbhFLKXPr--iopScCsDZhkZ9A/viewform?embedded=true` and `https://docs.google.com/forms/d/e/1FAIpQLScbeS-kxx7YT_ONfPENKkqfBis4d_Rd2O3pri_WRoAO0xGMDg/viewform?embedded=true`)