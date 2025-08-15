# Screen Requirements Definition Document: Index Page

## Page Title
アブロードアウトソーシング株式会社│ データ入力、スキャニング、画像加工ならお任せ！

## URL
`index.html` (Canonical URL: `https://www.abroad-o.com/`)

## Purpose
This is the main landing page for Abroad Outsourcing Co., Inc., serving as a comprehensive introduction to the company and its services. It provides an overview of their core offerings, highlights key features, showcases client testimonials through a logo slider, and details their external certifications. The page aims to engage visitors, inform them about the company's capabilities, and guide them to relevant service pages or the inquiry form.

## Key Elements/Sections
*   **Header:**
    *   **Top Section (`header_top`):** Displays the company logo, contact phone number, and a prominent call-to-action button for "無料お見積り・お問合せはコチラ" (Free Estimate/Inquiry Here) which links to `form.html`.
    *   **Navigation Bar (`header_nav`):** A responsive navigation bar providing central access to key sections of the website:
        *   HOME
        *   SERVICE (with a dropdown menu for specific services: Data Entry, Data Aggregation/Analysis, Scanning, and Image Editing/Processing)
        *   NEWS
        *   ABOUT (with a dropdown menu for Privacy Policy and Recruit information)
        *   CONTACT (links to the contact section within the About page).
*   **Main Content (`<main>`):
    *   **Top Section (`top`):** A large hero section featuring the company's main catchphrase, emphasizing business process standardization and efficient outsourcing to improve operational efficiency, speed, and accuracy.
    *   **Service Introduction Section (`service`):
        *   **Telework Promotion (`jumbotron`):** A prominent section highlighting the company's support for digital transformation of paper documents for telework environments, with a "詳しくはこちら" (Learn More) button linking to `telework.html`.
        *   **"OUR SERVICES" Title:** A clear heading introducing the core service offerings.
        *   **Service Details:** Four distinct service blocks, each presented in a two-column layout (two rows of two columns), detailing a core service:
            *   データ入力 (Data Entry) - Themed in yellow.
            *   データ集計・分析 (Data Aggregation/Analysis) - Themed in orange.
            *   スキャニング (Scanning) - Themed in blue.
            *   画像編集・加工 (Image Editing/Processing) - Themed in green.
            Each service block includes a heading, a representative image, a brief description, and a "詳しくはこちら" (Learn More) button linking to its respective detailed service page.
        *   **Central Inquiry Button:** A large, centrally placed button labeled "≪　お問合わせはこちら　≫" (Inquire Here) that links to `form.html`.
    *   **Bottom Image Section (`bottom_img`):** A full-width cover image with an overlaid text emphasizing the company's role in supporting internal cost reduction and rationalization through BPO services, leveraging extensive work experience and high-quality resources.
    *   **Features Introduction Section (`service2`):
        *   **Company Features:** Three distinct feature blocks, each presented in a column, highlighting key aspects of the company's approach:
            *   小ロットから大プロジェクトまで (From Small Lots to Large Projects): Emphasizes flexibility in handling projects of any scale.
            *   業務フローの標準化 (Standardization of Business Flow): Explains their approach to optimizing workflows and eliminating human dependency.
            *   高品質＆高セキュリティなリソース (High-Quality & High-Security Resources): Details the use of qualified domestic and international resources with strict security management.
    *   **Second Bottom Image Section (`bottom_img`):** Another full-width cover image with an overlaid text indicating that their services are utilized by many government agencies, universities, and companies.
    *   **Client Introduction Section (`corp`):
        *   **"ご利用のお客様" (Our Clients) Title:** A heading introducing the client section.
        *   **Client Logo Slider (`autoplay`):** A dynamic carousel displaying logos of various notable clients (e.g., Ministry of Defense, Dentsu, University of Tokyo, Kyoto University, Tohoku University, Hirosaki University, Chuo University, Tokio Marine & Nichido, Sanseido Bookstore, CTC) using the Slick Slider library.
    *   **Certifications Section (`pre_footer`):
        *   **"外部認証資格" (External Certifications) Title:** A heading for the certifications section.
        *   **Certification Details:** Provides information about the company's acquired certifications, including:
            *   プライバシーマーク (PrivacyMark) with a link to its official site.
            *   ISMS (Information Security Management System) ISO/IEC 27001:2013 / JIS Q 27001:2014 with a link.
            *   QMS (Quality Management System) ISO 9001:2015 & JIS Q 9001:2015 with a link.
            *   Mentions the presence of 文書情報管理士 (Document Information Management Professional) to ensure proper personal information handling.
        *   **Privacy Policy Link:** A direct link to the company's "プライバシーポリシー" (Privacy Policy) page.
*   **Footer:** Contains copyright information and a "scroll-to-top" button for easy navigation.

## Functionality
*   **Responsive Navigation:** The navigation bar is designed to be responsive, adapting to various screen sizes and collapsing into a toggleable menu on smaller devices.
*   **Smooth Scrolling:** Implemented for internal page links, providing a smooth user experience when navigating within the page.
*   **Scroll-to-Top Button:** A button appears after scrolling down, allowing users to quickly return to the top of the page.
*   **Client Logo Carousel:** Utilizes the Slick Slider library to display a rotating carousel of client logos, adding a dynamic element to showcase partnerships.
*   **Call-to-Action Buttons:** Multiple prominent buttons strategically placed throughout the page to guide users to detailed service pages or the inquiry form.

## Dependencies
*   **CSS:**
    *   Bootstrap 4.5.2 (`https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css`) - *Note: This page uses Bootstrap 4, which is a different major version from Bootstrap 3 used on some other pages (`about.html`, `aggregate.html`, `edit.html`, `film.html`). This inconsistency should be addressed for site-wide consistency and to prevent potential rendering issues.*
    *   `style3.css`
    *   `slick/slick.css`
    *   `slick/slick-theme.css`
*   **JavaScript:**
    *   Google Analytics (`https://www.googletagmanager.com/gtag/js?id=UA-51168812-1`)
    *   jQuery (`https://code.jquery.com/jquery-3.6.0.min.js`) - *Note: The page now consistently uses a single version of jQuery.*
    *   Popper.js (`https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.6/dist/umd/popper.min.js`)
    *   Bootstrap 4.5.2 JS (`https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js`) - *Note: This page uses Bootstrap 4, which is inconsistent with other pages on the site using Bootstrap 3.*
    *   FontAwesome 6 (`https://kit.fontawesome.com/ac3b49c4bc.js`) - *Note: This is inconsistent with other pages on the site using older versions of FontAwesome.*
    *   `js/jquery.smooth-scroll.min.js`
    *   `slick/slick.min.js`
    *   `js/custom.js` (Contains all custom logic for scroll-to-top, dropdowns, and the Slick carousel initialization, formerly inline JS).
*   **External Resources:**
    *   Google Fonts (`https://fonts.googleapis.com/css2?family=Crimson+Text&display=swap`)
    *   OG Image (`https://www.abroad-o.com/image/og-image.jpg`)