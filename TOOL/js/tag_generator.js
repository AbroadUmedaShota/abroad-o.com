$(document).ready(function() {

    // --- 共通: 出力とプレビュー更新 ---
    function setOutput(html) {
        $('#output-source').val(html);
        $('#preview-area').html(html);
    }

    // --- 1. リンク生成 ---
    $('#link-type').change(function() {
        var type = $(this).val();
        if (type === 'custom') {
            $('#link-text-group').show();
        } else {
            $('#link-text-group').hide();
        }
    });

    window.generateLink = function() {
        var type = $('#link-type').val();
        var url = $('#link-url').val();
        var text = $('#link-text').val().replace(/\n/g, '<br>');
        var html = '';

        if (!url) {
            alert('URLを入力してください。');
            return;
        }

        if (type === 'normal') {
            // <a href="URL" target="_blank">URL</a>
            html = '<a href="' + url + '" target="_blank">' + url + '</a>';
        } else if (type === 'here') {
            // 要望: URLを「こちら」に変える方法 -> <a href="URL" target="_blank">URL</a>こちら</a>
            // Issueコメントでの補足に基づき、実用的な形と要望の形を考慮する。
            // 厳密なユーザー要望: <a href="URL" target="_blank">URL</a>こちら</a>
            // ですが、HTMLとして壊れているため、恐らく意図は「こちら」というリンクを作成すること。
            // しかし「URLを『こちら』に変える」という表現と、例示されたコードの差異を鑑み、
            // 「こちら」のリンクを作成する標準的な形を採用しつつ、
            // もしユーザーが「URLを表示しつつ、横に『こちら』とも表示したい」という意図だった場合の
            // 特殊対応は複雑になるため、ここでは「こちら」というテキストのリンクを作成する。
            html = '<a href="' + url + '" target="_blank">こちら</a>';
        } else if (type === 'custom') {
            if (!text) text = url;
            html = '<a href="' + url + '" target="_blank">' + text + '</a>';
        }

        setOutput(html);
    };

    // --- 2. 画像生成 ---
    $('#img-type').change(function() {
        var type = $(this).val();
        if (type === 'link') {
            $('#img-link-opts').show();
            $('#img-align-opts').hide();
        } else {
            $('#img-link-opts').hide();
            $('#img-align-opts').show();
        }
    });

    window.generateImage = function() {
        var type = $('#img-type').val();
        var src = $('#img-src').val();
        var html = '';

        if (!src) {
            setOutput('');
            return;
        }

        if (type === 'link') {
            var href = $('#img-link-url').val();
            if (!href) {
                setOutput('');
                return;
            }
            // <a href="移動先のURL"><img src="画像のURL"></a>
            html = '<a href="' + href + '"><img src="' + src + '"></a>';
        } else {
            var align = $('input[name="img-align"]:checked').val();
            // <p class="tac"><img src="画像URL" img align="middle"></p><br clear="all">
            // Note: ユーザー指定のタグには `img align="..."` という属性記述がありますが、
            // 標準属性は `align` です。 `img` という属性はありませんが、要望の文字列通り `img align` とするのは
            // 明らかなタイプミス（タグ名と属性の混同）の可能性が高いですが、
            // `img align="middle"` という記述が指定されています。
            // ここでは標準的な `<img src="..." align="...">` を生成しつつ、
            // クラス `tac` (text-align: center) は `p` に付与します。
            
            // 要望: <p class="tac"><img src="画像URL" img align="middle"></p><br clear="all">
            // ここで `img align="middle"` はHTML構文として属性名にスペースが入っており不正です。
            // 恐らく `<img src="..." align="middle">` の意図、あるいは単なるメモ書きの混入。
            // 安全かつ動作するコードとして `<img src="..." align="...">` を生成します。
            
            html = '<p class="tac"><img src="' + src + '" align="' + align + '"></p><br clear="all">';
        }

        setOutput(html);
    };

    // --- 3. 文字装飾生成 ---
    window.generateText = function() {
        var text = $('#text-content').val().replace(/\n/g, '<br>');
        var color = $('#text-color').val();
        var size = $('#text-size').val();
        var isBold = $('#text-bold').is(':checked');
        var isUnder = $('#text-under').is(':checked');
        var isBg = $('#text-bg').is(':checked');
        var bgColor = $('#text-bg-color').val();

        if (!text) {
            setOutput('');
            return;
        }

        // 組み立て順序: span(bg) -> font(color/size) -> b -> u -> text
        // ※入れ子の順序は厳密でなくても良いが、内側から文字に近い装飾を行うのが一般的。
        // 指定された例: <font color="red" size="5">文字範囲</font>
        
        var inner = text;

        if (isUnder) {
            inner = '<u>' + inner + '</u>';
        }

        if (isBold) {
            inner = '<b>' + inner + '</b>';
        }

        // Font tag processing
        if (color || size) {
            var fontTag = '<font';
            if (color) fontTag += ' color="' + color + '"';
            if (size) fontTag += ' size="' + size + '"';
            fontTag += '>' + inner + '</font>';
            inner = fontTag;
        }

        // Background span processing
        if (isBg) {
            if (!bgColor) bgColor = '#ffff00'; // Default yellow if empty
            inner = '<span style="background-color:' + bgColor + '">' + inner + '</span>';
        }

        setOutput(inner);
    };

    // --- 4. レイアウト生成 ---
    $('#layout-type').change(function() {
        var type = $(this).val();
        $('#layout-align-opts').hide();
        $('#layout-bg-opts').hide();

        if (type === 'align') {
            $('#layout-align-opts').show();
        } else if (type === 'bg-div') {
            $('#layout-bg-opts').show();
        }
    });

    window.generateLayout = function() {
        var type = $('#layout-type').val();
        var html = '';

        if (type === 'br') {
            html = '<br>';
        } else if (type === 'align') {
            var text = $('#layout-text').val().replace(/\n/g, '<br>');
            var align = $('#layout-align-val').val();
            if (!text) {
                setOutput('');
                return;
            }
            // <p align="center">文字範囲</p>
            html = '<p align="' + align + '">' + text + '</p>';
        } else if (type === 'bg-div') {
            var content = $('#layout-bg-content').val().replace(/\n/g, '<br>');
            var color = $('#layout-bg-val').val();
            if (!color) {
                setOutput('');
                return;
            }
            // <div style="background-color:#色彩の数字;">～</div>
            html = '<div style="background-color:' + color + ';">' + content + '</div>';
        }

        setOutput(html);
    };

    // --- コピー機能 ---
    $('#copy-btn').click(function() {
        var copyText = document.getElementById("output-source");
        copyText.select();
        copyText.setSelectionRange(0, 99999); // For mobile devices

        if (document.execCommand("copy")) {
            showToast();
        }
    });

    // --- 全クリア ---
    $('#clear-all-btn').click(function() {
        $('input[type="text"], textarea').val('');
        $('input[type="checkbox"], input[type="radio"]').prop('checked', false);
        // Reset specific defaults
        $('input[name="img-align"][value="middle"]').prop('checked', true);
        $('select').each(function() { this.selectedIndex = 0; });
        
        // Trigger change events to reset UI visibility
        $('#link-type').trigger('change');
        $('#img-type').trigger('change');
        $('#layout-type').trigger('change');
        
        setOutput('');
    });

    // --- リアルタイム更新のイベントリスナー設定 ---
    
    // 1. リンク: 入力変更時に即時生成
    $('#tab-link').on('input change', 'input, select, textarea', generateLink);
    
    // 2. 画像: 入力変更時に即時生成
    $('#tab-image').on('input change', 'input, select, textarea', generateImage);
    
    // 3. 文字装飾: 入力変更時に即時生成
    $('#tab-text').on('input change', 'input, select, textarea', generateText);
    
    // 4. レイアウト: 入力変更時に即時生成
    $('#tab-layout').on('input change', 'input, select, textarea', generateLayout);

    // タブ切り替え時に、切り替え先のタブの生成処理を実行して表示を更新する
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        var target = $(e.target).attr("href"); // activated tab
        if (target === '#tab-link') generateLink();
        else if (target === '#tab-image') generateImage();
        else if (target === '#tab-text') generateText();
        else if (target === '#tab-layout') generateLayout();
    });

    // --- トースト表示 ---
    function showToast() {
        var x = document.getElementById("toast");
        x.className = "show";
        setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
    }
    
    // 初期化実行
    generateLink();

});
