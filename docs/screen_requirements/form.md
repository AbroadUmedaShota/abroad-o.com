# Screen Requirements Definition Document: Inquiry Form Page

## Page Title
アブロードアウトソーシング株式会社 | お問い合わせフォーム

## URL
`form.html`

## Purpose
This page serves as the primary contact point for users to submit inquiries and request estimates for Abroad Outsourcing Co., Inc.'s services, including data entry, scanning, and image processing. It is designed to collect necessary user and inquiry details efficiently and includes important information regarding personal data handling.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form (this page itself).
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown), NEWS, ABOUT (with dropdown), and CONTACT.
*   **Main Content (`<main>`):
    *   **Form Header (`form-top`):** Features a prominent heading "お問い合わせ・お見積もりフォーム" (Inquiry/Estimate Form).
    *   **Contact Form (`contactForm`):
        *   **Submission Target:** Data is submitted to a Google Forms endpoint (`https://docs.google.com/forms/d/e/1FAIpQLSducG_PN_pRRvNlEyEjI8RRUJbhFLKXPr--iopScCsDZhkZ9A/formResponse`).
        *   **Input Fields:** A series of input fields for collecting user information. Required fields are clearly marked with "必須" (Required) and include:
            *   企業名 (Company Name)
            *   部署・役職 (Department/Position) - Optional
            *   お名前 (Name)
            *   メールアドレス (Email Address) - Includes client-side validation.
            *   電話番号 (Phone Number) - Includes client-side validation.
            *   住所 (Address) - Optional, a textarea for multi-line input.
            *   お問い合わせ内容 (Inquiry Details) - A textarea for the main message.
        *   **Honeypot Field:** A hidden input field (`honeypot_email`) is included to help detect and deter bot submissions without user interaction.
        *   **Personal Information Handling Section (`scroll-spy`):** A scrollable content area presenting detailed terms and conditions regarding the company's handling of personal information. This section covers:
            *   Business Operator Name
            *   Personal Information Protection Manager details
            *   Purpose of personal data use
            *   Information on third-party provision and entrustment of handling
            *   Consequences of not providing personal information
            *   Procedures for disclosure, correction, or deletion requests for retained personal data
            *   Statement on non-use of cookies or web beacons for personal information acquisition
            *   Details on security management measures for personal information
            *   Reference to the company's Personal Information Protection Policy
            *   Contact information for complaints and consultations.
        *   **Consent Checkbox:** A mandatory checkbox labeled "個人情報の取扱について同意する。" (I agree to the handling of personal information.) that must be checked before submission.
        *   **Submit Button:** A button labeled "送信する" (Send) to submit the form.
        *   **Form Feedback Area:** A designated `div` (`form-feedback`) to display success or error messages to the user.
        *   **Error Contact Information:** Provides an email address for users to contact directly if they encounter submission errors or do not receive a response within two business days.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes.
*   **Smooth Scrolling:** Implemented for internal page links.
*   **Scroll-to-Top Button:** Allows users to quickly return to the top of the page.
*   **Client-Side Form Validation:** Ensures that required fields are filled and that email and phone number formats are correct before submission.
*   **Bot Detection:** Utilizes a honeypot field and a time-based submission check to identify and prevent automated bot submissions.
*   **Consent Mechanism:** Requires user consent to personal information handling before form submission.
*   **Google Forms Integration:** Submits collected data directly to a Google Forms endpoint.
*   **Post-Submission Redirection:** Upon successful submission, a success message is displayed, and the user is automatically redirected to `thank.html` after a 5-second delay.
*   **Error Handling:** Provides user feedback for submission errors and alternative contact methods.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css` - *Note: This page uses FontAwesome 4.7.0, which is an older version compared to FontAwesome 5 used on `aggregate.html` and `edit.html`. This inconsistency should be addressed for site-wide consistency.*
    *   Inline styles specific to the form layout and validation.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   jQuery (`https://code.jquery.com/jquery-3.2.1.slim.min.js`) - *Note: This page uses jQuery 3.2.1 (slim version), which is a different and newer version compared to jQuery 1.12.4 used on other pages. This is a significant inconsistency in library versions across the site.*
    *   Popper.js (`https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.3/umd/popper.min.js`)
    *   Bootstrap JS (`https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js`) - *Note: This page uses Bootstrap 4 JavaScript, while other pages use Bootstrap 3 JavaScript (`js/bootstrap.min.js`). This is a major framework version inconsistency that could lead to unexpected behavior.*
    *   Inline JavaScript for form submission logic, bot detection (honeypot and time-based), consent check, and smooth scrolling. This script replaces some functionalities typically handled by jQuery plugins on other pages.