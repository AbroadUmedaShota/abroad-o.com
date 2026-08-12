if (window.jQuery) {
  window.jQuery(function () {
    if (typeof window.jQuery.fn.smoothScroll === 'function') {
      window.jQuery('a').smoothScroll();
    }
  });
}
var abroadNewsCurrentYear = document.getElementById('current-year');
if (abroadNewsCurrentYear) {
  abroadNewsCurrentYear.textContent = new Date().getFullYear();
}
