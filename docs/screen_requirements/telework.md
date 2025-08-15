# Screen Requirements Definition Document: Telework Document Digitization Page

## Page Title
アブロードアウトソーシング株式会社│ テレワークのための紙媒体電子化

## URL
`telework.html`

## Purpose
This page is designed to promote the digitization of paper documents as a solution for establishing and improving telework environments. It explains the concept of telework, addresses common challenges faced by remote workers due to physical documents, and presents how digitization can solve these issues. The page also showcases various service examples tailored to customer needs and outlines the overall service flow.

## Key Elements/Sections
*   **Header:** (Consistent with other pages) Displays the company logo, contact phone number, and a link to the inquiry form.
*   **Navigation Bar:** (Consistent with other pages) A sticky navigation bar providing links to HOME, SERVICE (with dropdown), NEWS, ABOUT (with dropdown), and CONTACT.
*   **Main Content (`<main>`):
    *   **Title Section (`title_top`):** Features the heading "テレワークの環境整備のための書類のデジタル化" (Digitization of Documents for Telework Environment Setup) accompanied by a spinning cog icon.
    *   **"テレワークとは・・・" (What is Telework...) Section (`tele_top`):** Provides a concise definition of telework, discusses its various types, and highlights the increasing importance of remote work, especially from an infection control perspective. Includes an illustrative image (`tele4.png`).
    *   **"テレワークの課題とキーポイント" (Telework Challenges and Key Points) Section (`tele_mid1`):** Discusses common challenges encountered during telework, particularly the inability to access physical paper documents. It presents insights from a survey (by Adobe) showing reasons why employees still commute and the operational challenges experienced during telework. Includes supporting images (`tele1.png`, `tele2.png`).
    *   **"書類のデジタル化で問題可決！" (Problems Solved with Document Digitization!) Section (`tele_mid2`):** Explains how digitizing documents (converting them to PDF) effectively solves telework challenges. Benefits highlighted include:
        *   Reduced need for commuting (documents viewable on PC).
        *   Elimination of unnecessary equipment purchases (no need for personal scanners).
        *   Facilitation of web conferences (easy screen sharing and file sharing).
        *   Improved management and searchability (no need to search through piles of paper).
        *   Streamlined home-based document processing (e.g., accounting).
        *   Enhanced security through PDF password protection.
        Includes an illustrative image (`tele3.png`).
    *   **"お客様のニーズにお答えします！デジタル化のご依頼例ベスト３" (Responding to Customer Needs! Top 3 Digitization Request Examples) Section (`tele_mid3`):** Presents three common digitization request scenarios with example calculations and key features/pricing:
        *   "とにかく安く書類をPDFにしたい" (Want to PDF documents as cheaply as possible).
        *   "書類をPDF化したうえで、フォルダ名やファイル名で検索しやすくしたい" (Want to PDF documents and make them easily searchable by folder/file name).
        *   "製本化されている契約書をPDF化し、ファイル名に契約相手先を付与したい" (Want to PDF bound contracts and add client names to file names).
    *   **"お問合せから納品の流れ" (Flow from Inquiry to Delivery) Section (`tele_mid5`):** A clear, step-by-step list outlining the entire service process: Inquiry, Submission of Originals, Original Check, Work Execution, Data Delivery, and Billing.
    *   **"弊社サービスの特徴" (Features of Our Service) Section (`tele_mid6`):** Highlights four key advantages of the company's service:
        *   "はじめてでも安心" (Safe for First-timers): Emphasizes consultation and optimal proposals.
        *   "コスト重視" (Cost-focused): Focuses on appropriate, cost-effective proposals.
        *   "安心の品質" (Reliable Quality): Mentions specialized scanners and management by document information specialists.
        *   "安心のセキュリティ情報管理" (Secure Information Management): Highlights PrivacyMark certification for proper document and data management.
    *   **Call to Action Section (`tele_mid4`):** Features a prominent button labeled "≪　無料お見積り・お問合せはコチラ　≫" (Free Estimate/Inquiry Here) that links to `form.html`, along with the company's phone number.
*   **Footer:** (Consistent with other pages) Contains copyright information and a "scroll-to-top" button.

## Functionality
*   **Responsive Navigation:** The navigation bar adapts to different screen sizes, collapsing into a hamburger menu on mobile devices.
*   **Smooth Scrolling:** Enabled for internal page links.
*   **Scroll-to-Top Button:** A button appears upon scrolling down, allowing users to quickly return to the top of the page.
*   **Inquiry Form Link:** A direct link to `form.html` for free estimates and inquiries.
*   **Modal Window:** Includes a modal (`myModal`) for embedding Google Forms, consistent with other service pages.

## Dependencies
*   **CSS:**
    *   `css/bootstrap.css`
    *   `style.css`
    *   Inline styles for `.no-link-style`.
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   FontAwesome (`https://use.fontawesome.com/90388fa9b8.js`) - *Note: This page uses FontAwesome 4, which is inconsistent with FontAwesome 5/6 used on `index.html`, `aggregate.html`, `edit.html`, `film.html`, `microfilm.html`, `news.html`, `recruit.html`, `rule.html`, `sample.html`, and `sample2.html`. This should be addressed for site-wide consistency.*
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