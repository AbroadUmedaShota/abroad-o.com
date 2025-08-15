# Screen Requirements Definition Document: Edit Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`edit.html`

## Purpose
This page is dedicated to showcasing and detailing the "Image Editing and Processing Service" (画像編集・加工サービス) offered by Abroad Outsourcing Co., Inc. It provides various photo retouching examples with estimated prices and a comprehensive pricing table for different types of image manipulation, aiming to inform potential clients about the scope and cost of services.

## Key Elements/Sections
*   **Header:** (Consistent with `about.html` and `aggregate.html`) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with `about.html` and `aggregate.html`) A sticky navigation bar providing links to HOME, SERVICE (with dropdown for Data Entry, Aggregation, Scanning, Image Editing), NEWS, ABOUT (with dropdown for Privacy Policy, Recruit), and CONTACT.
*   **Main Content (`<main>`):
    *   **Service Title Section (`title_top`):** Features the heading "画像編集・加工サービス" (Image Editing and Processing Service) accompanied by a spinning cog icon.
    *   **Photo Retouching Examples Section (`photo_top`):
        *   **Introductory Image:** A visual element (`photo-top.png`) introducing the section.
        *   **"フォトレタッチの作業一例" (Photo Retouching Work Examples):** This section presents several distinct examples of image editing, each detailed in a row:
            *   **Type of Editing:** Clearly labeled (e.g., Spot Correction, Cropping, Color Correction, Skin Beautification, Unnecessary Object Removal, Cropping & Compositing).
            *   **Reference Price:** An estimated cost for the specific task.
            *   **Task List:** Bullet points outlining the specific actions involved in the editing process.
            *   **Preview Images:** Small visual cues demonstrating the before/after or process.
            *   **Lightbox Integration:** A larger image example that opens in a Lightbox viewer upon click, allowing for detailed inspection.
    *   **Detailed Pricing Table:** A comprehensive table categorizing various image editing and processing services (e.g., Dust Removal, Cutting, Color Adjustment, Rotation, Resolution Adjustment, Size (px) Adjustment, Color Mode Change, File Format Change, Color Profile Settings). It includes prices per image and indicates difficulty levels where applicable.
    *   **Important Notes:** A small text block at the bottom of the pricing table providing crucial information regarding service acceptance conditions (based on complexity/state of images), potential changes in image file size post-processing, separate charges for shipping and media, and a minimum order amount.
    *   **Call to Action Section (`tele_mid4`):** Features a prominent button labeled "≪　無料お見積り・お問合せはコチラ　≫" (Free Estimate/Inquiry Here) that links to `form.html`, along with the company's phone number.
*   **Footer:** (Consistent with `about.html` and `aggregate.html`) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Lightbox Integration:** Images within the examples section can be clicked to open in a larger, overlaying viewer, showcasing the editing results.
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
    *   FontAwesome (`https://kit.fontawesome.com/ac3b49c4bc.js`) - *Note: This is FontAwesome5, which is consistent with `aggregate.html` but differs from `about.html`'s FontAwesome4. Consistency across the site should be ensured.*
    *   jQuery (`https://code.jquery.com/jquery-1.12.4.min.js` and `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`) - *Note: Redundant jQuery imports. Should be consolidated for performance and consistency.*
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