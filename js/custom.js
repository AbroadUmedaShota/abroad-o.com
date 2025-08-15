$(document).ready(function() {

    // Smooth Scroll for page-scroll links
    $('a.page-scroll').smoothScroll();

    // Scroll-to-top button (Revised)
    (function() {
        var topBtn = $('#page-top');
        // Hide the button initially
        topBtn.hide();

        // Fade in/out logic
        $(window).scroll(function() {
            if ($(this).scrollTop() > 300) {
                topBtn.fadeIn();
            } else {
                topBtn.fadeOut();
            }
        });

        // Scroll-to-top click
        topBtn.click(function(e) {
            e.preventDefault();
            $('html, body').animate({
                scrollTop: 0
            }, 500); // 500ms scroll duration
        });
    })();

    // Dropdown behavior for Bootstrap 4
    (function() {
        function handleDropdowns() {
            if ($(window).width() >= 768) { // Desktop view
                $('.navbar .dropdown').hover(function() {
                    $(this).find('.dropdown-menu').first().stop(true, true).delay(100).slideDown(200);
                }, function() {
                    $(this).find('.dropdown-menu').first().stop(true, true).delay(100).slideUp(200);
                });

                $('.navbar .dropdown > a').click(function() {
                    location.href = this.href;
                });
            } else { // Mobile view
                // Unbind hover to prevent issues on touch devices
                $('.navbar .dropdown').off('mouseenter mouseleave');
            }
        }

        handleDropdowns();
        $(window).resize(handleDropdowns);
    })();

    // Slick Slider Initialization (Revised for continuous scroll)
    $('.autoplay').slick({
        dots: true,
        infinite: true,
        slidesToShow: 3,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 0, // Set to 0 for continuous scroll
        speed: 5000,      // This now controls the duration of the scroll animation
        cssEase: 'linear'
    });

});