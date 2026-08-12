if (window.jQuery) {
  window.jQuery(function () {
    var showFlag = false;
    var topBtn = window.jQuery('#page-top');
    if (!topBtn.length) {
      return;
    }
    topBtn.css('bottom', '-150px');
    window.jQuery(window).scroll(function () {
      if (window.jQuery(this).scrollTop() > 300) {
        if (showFlag == false) {
          showFlag = true;
          topBtn.stop().animate({'bottom' : '20px'}, 300);
        }
      } else if (showFlag) {
        showFlag = false;
        topBtn.stop().animate({'bottom' : '-200px'}, 300);
      }
    });
    topBtn.click(function () {
      window.jQuery('body,html').animate({
        scrollTop: 0
      }, 500);
      return false;
    });
  });
}
