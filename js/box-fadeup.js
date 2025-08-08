//指定箇所をフェードアップするJava 
 $(window).on('load',function(){
    // fade-in
    // $('.fade-in').css("opacity","1");
    $(window).scroll(function (){
        $('.fade-in').each(function(){
            var imgPos = $(this).offset().top;
            var scroll = $(window).scrollTop();
            var windowHeight = $(window).height();

            if (scroll > imgPos - windowHeight + windowHeight/5){
                $(this).css("opacity","1" );
            } else {
                $(this).css("opacity","0" );
            }
        });
    });
    // fade-up
    // $('.fade-up').css({
    //         'opacity':'1'
    // });
    $(window).scroll(function (){
        $('.fade-up').each(function(){
            var imgPos = $(this).offset().top;
            var scroll = $(window).scrollTop();
            var windowHeight = $(window).height();

            if (scroll > imgPos - windowHeight){
                $(this).css({
                        'opacity':'1',
                        'transform':'translateY(0)',
                        '-webkit-transform':'translateY(0)',
                        '-moz-transform':'translateY(0)',
                        '-ms-transform':'translateY(0)'
                });
            } else {
                $(this).css({
                        'opacity':'0',
                        'transform':'translateY(70px)',
                        '-webkit-transform':'translateY(70px)',
                        '-moz-transform':'translateY(70px)',
                        '-ms-transform':'translateY(70px)'
                  });
              }
          });
      });
    });