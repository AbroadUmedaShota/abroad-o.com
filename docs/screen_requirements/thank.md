# Screen Requirements Definition Document: Thank You Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`thank.html`

## Purpose
This page serves as a confirmation and thank you page displayed to users after they have successfully submitted an inquiry or estimate request through the contact form (`form.html`). Its primary purpose is to acknowledge receipt of the submission, provide information on the expected response time, and offer alternative contact methods should the user not receive a timely response.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a static text indicating "フォームでのお問い合わせ" (Inquiry Form) rather than a clickable link.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown), NEWS, ABOUT (with dropdown), and CONTACT.
*   **Main Content (`<main>`):
    *   **Title Section (`title_top`):** Features the heading "お問い合わせ・お申込みありがとうございます。" (Thank you for your inquiry/application.).
    *   **Thank You Section (`thank_top`):
        *   **Thank You Message:** A prominent message expressing gratitude for the user's inquiry or estimate request.
        *   **Response Time Information:** Informs the user that a response will be provided within 2 business days via phone or email, based on the submitted content.
        *   **Alternative Contact:** Provides clear instructions and an email address for users to contact the company directly if they do not receive a response within the expected timeframe or have any further questions.
        *   Includes the company name and business hours.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Modal Window:** Includes a modal (`myModal`) for embedding Google Forms, consistent with other service pages, although it is not directly triggered from this page.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://use.fontawesome.com/297671da61.js`) - *Note: This page uses FontAwesome 4, which is inconsistent with FontAwesome 5/6 used on `index.html`, `aggregate.html`, `edit.html`, `film.html`, `microfilm.html`, `news.html`, `recruit.html`, `rule.html`, `sample.html`, `sample2.html`, and `telework.html`. This should be addressed for site-wide consistency.*
    *   jQuery (`https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`) - *Note: Redundant jQuery imports persist across pages. This should be consolidated to a single, consistent version for performance and to avoid potential conflicts.*
    *   `js/jquery.easing.min.js`
    *   `js/script.js`
    *   `js/bootstrap.min.js`
    *   `js/bootsnav.js`
    *   `js/jquery.smooth-scroll.min.js`
    *   Inline JavaScript for scroll-to-top button functionality. (A blinking effect script is present but appears incomplete or commented out).
*   **Conditional (IE9 Support):**
    *   `https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js`
    *   `https://oss.maxcdn.com/respond/1.4.2/respond.min.js`
*   **External Resources:**
    *   Google Web Fonts (`https://fonts.googleapis.com/css?family=Crimson+Text`)