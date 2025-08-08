(function($) {

    // smoothScroll関数を定義
    $.fn.smoothScroll = function(options) {
      const settings = $.extend({
        speed: 400,
        easing: 'swing',
        offset: 0,
        callback: function() {}
      }, options);
  
      return this.each(function() {
        $(this).on('click', function(event) {
          event.preventDefault();
  
          const target = this.hash;
          if (!target) return;
  
          const $target = $(target);
          if (!$target.length) return;
          const targetOffset = $target.offset().top + settings.offset;
  
  
          $('html, body').animate({
              scrollTop: targetOffset
            },
            settings.speed,
            settings.easing,
             function() {
               settings.callback.call(this);
          });
        });
      });
    };
  
    // デバウンス処理
    function debounce(func, delay) {
      let timeout;
      return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
      };
    }
    // Intersection Observer API の代わりにdebounceを使用したスクロールイベント
    $(function() {
        // fade-in
        const fadeInHandler = function() {
            $('.fade-in').each(function() {
                const imgPos = $(this).offset().top;
                const scroll = $(window).scrollTop();
                const windowHeight = $(window).height();
  
                if (scroll > imgPos - windowHeight + windowHeight / 5) {
                    $(this).addClass("fade-in-active");
                } else {
                    $(this).removeClass("fade-in-active");
                }
            });
        };
        $(window).on('scroll', debounce(fadeInHandler, 10));
  
        // fade-up
        const fadeUpHandler = function() {
            $('.fade-up').each(function() {
                const imgPos = $(this).offset().top;
                const scroll = $(window).scrollTop();
                const windowHeight = $(window).height();
  
                if (scroll > imgPos - windowHeight) {
                    $(this).addClass('fade-up-active');
                } else {
                    $(this).removeClass('fade-up-active');
                }
            });
        };
  
        $(window).on('scroll', debounce(fadeUpHandler, 10));
    });
  })(jQuery);
  
  $(function() {
    $('a[href^="#"]').smoothScroll({
      speed: 600, // スクロール速度を調整
      easing: 'easeOutQuad', // イージングを調整
    });
  });