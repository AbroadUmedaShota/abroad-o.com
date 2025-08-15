# Screen Requirements Definition Document: Service Overview Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`service.html`

## Purpose
This page provides a comprehensive overview of all services offered by Abroad Outsourcing Co., Inc. It categorizes services into main offerings (Data Entry, Data Aggregation/Analysis, Scanning, Image Editing/Processing) and specialized services (for publishing/editing productions, and other services like "Sakutto Keiri" - quick accounting). The page serves as a central hub for users to explore the company's diverse range of solutions.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (this page), NEWS, ABOUT (with dropdown), and CONTACT.
*   **Main Content (`<main>`):
    *   **Service Title Section (`title_top`):** Features the heading "SERVICE" accompanied by a cog icon.
    *   **Main Services Section (`service`):** Presents the four core services in a two-column layout (two rows of two columns), similar to the service section on `index.html`:
        *   データ入力 (Data Entry) - Themed in yellow.
        *   データ集計・分析 (Data Aggregation/Analysis) - Themed in orange.
        *   スキャニング (Scanning) - Themed in blue.
        *   画像編集・加工 (Image Editing/Processing) - Themed in green.
        Each service block includes a heading, a representative image, a brief description, and a "詳しくはこちら" (Learn More) button linking to its respective detailed service page.
    *   **Service Detail Section (`service_detail`):
        *   **"出版・編集プロダクション専用サービス" (Services for Publishing/Editing Productions):** Highlights services tailored for publishing and editing companies:
            *   テキスト入力 (Text Input) - Links to `input.html`.
            *   テープ起こし (Tape Transcription) - Links to `input.html`.
        *   **"その他サービス" (Other Services):** Features additional services:
            *   サクッと経理 (Sakutto Keiri - Quick Accounting) - Links to an external site `https://www.abroad-o.biz/`.
    *   **Call to Action Section:** A large button labeled "≪　お問合わせはこちら　≫" (Inquire Here) that links to `form.html`.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Service Navigation:** Buttons link to various detailed service pages and an external accounting service.
*   **Inquiry Form Link:** A direct link to `form.html` for inquiries.
*   **Modal Window:** Includes a modal (`myModal`) for embedding Google Forms, consistent with other service pages.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://use.fontawesome.com/297671da61.js`) - *Note: This page uses FontAwesome 4, which is inconsistent with FontAwesome 5/6 used on `index.html`, `aggregate.html`, `edit.html`, `film.html`, `microfilm.html`, `news.html`, `recruit.html`, `rule.html`, `sample.html`, and `sample2.html`. This should be addressed for site-wide consistency.*
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