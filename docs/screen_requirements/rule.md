# Screen Requirements Definition Document: Policy Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`rule.html`

## Purpose
This page serves as a comprehensive repository for Abroad Outsourcing Co., Inc.'s official policies, including its "Privacy Policy" (個人情報保護方針), "Information Security Basic Policy" (情報セキュリティ基本方針), and "Quality Policy" (品質方針). Its primary purpose is to transparently communicate the company's commitment to data protection, information security, and quality management to its visitors and stakeholders.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown), NEWS, ABOUT (with dropdown, including a link to this Policy page), and CONTACT.
*   **Main Content (`<main>`):
    *   **Title Section (`title_top`):** Features the heading "プライバシーポリシー" (Privacy Policy).
    *   **Policy Section (`rule`):** This section is structured to present three distinct policies:
        *   **"【個人情報保護方針】" (Privacy Policy):**
            *   An introduction outlining the company's commitment to personal information protection and management as a social responsibility.
            *   A numbered list of core principles, including guidelines for personal information acquisition, use, and provision; compliance with relevant laws and national guidelines; prevention and correction of personal information leakage, loss, or damage; handling of complaints and consultations; and continuous improvement of the personal information management system.
            *   Includes the company name, representative director's name, and a chronological list of revision dates.
            *   Provides contact information for inquiries related to the privacy policy.
        *   **"【個人情報の取扱いについて】" (About Handling of Personal Information):**
            *   States the name and address of the personal information handling business operator.
            *   Details the purposes of personal information acquisition and utilization for various categories (e.g., customer information, business partner information, employee information, recruitment applicants, retired employees, inquiries, and data entrusted by clients).
            *   Clarifies policies on third-party provision (none without consent or legal basis) and outsourcing of personal information handling.
            *   Outlines procedures for requests regarding disclosure, correction, addition, deletion, suspension of use, or cessation of third-party provision of retained personal data.
            *   Describes methods for accepting such requests.
            *   Explains measures taken for personal information security management.
            *   Identifies the name and contact information of the accredited personal information protection organization.
            *   Reiterates contact information for personal information inquiries.
        *   **"【情報セキュリティ基本方針】" (Information Security Basic Policy):**
            *   States the company's overarching goal regarding information security.
            *   Presents a numbered list of action guidelines, covering aspects like protecting confidentiality, integrity, and availability of information assets; conducting information security education for all employees; setting and reviewing information security objectives; and delegating responsibility for management system implementation.
            *   Includes the establishment date, company name, and representative director's name.
        *   **"【品質方針】" (Quality Policy):**
            *   Outlines the company's basic philosophy regarding quality.
            *   Presents a numbered list of quality policy statements, including setting quality objectives, striving for continuous improvement of the Quality Management System (QMS), emphasizing employee responsibility in quality management, and committing to public disclosure of the policy.
            *   Includes the establishment date, company name, and representative director's name.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Inquiry Form Link:** A direct link to `form.html` for inquiries.
*   **Modal Window:** Includes a modal (`myModal`) for embedding Google Forms, consistent with other service pages.

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
*   **Conditional (IE9 Support):**
    *   `https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js`
    *   `https://oss.maxcdn.com/respond/1.4.2/respond.min.js`
*   **External Resources:**
    *   Google Web Fonts (`https://fonts.googleapis.com/css?family=Crimson+Text`)