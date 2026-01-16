document.addEventListener('DOMContentLoaded', () => {
    const inputArea = document.getElementById('input-area');
    const outputSource = document.getElementById('output-source');
    const previewArea = document.getElementById('preview-area');
    const charCount = document.getElementById('char-count');
    const copyBtn = document.getElementById('copy-btn');
    const clearBtn = document.getElementById('clear-btn');
    const toast = document.getElementById('toast');

    const charMap = {
        '①': '1.', '②': '2.', '③': '3.', '④': '4.', '⑤': '5.',
        '⑥': '6.', '⑦': '7.', '⑧': '8.', '⑨': '9.', '⑩': '10.',
        '㈱': '(株)', '㈲': '(有)', '㈹': '(代)', '㍑': 'リットル', '㌖': 'キロ',
        '－': '-', '～': '~', '　': ' '
    };
    
    const STORAGE_KEY = 'linst_tool_settings';

    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (settings) {
            if (settings.normalizeChars !== undefined) document.getElementById('normalizeChars').checked = settings.normalizeChars;
            if (settings.darkMode !== undefined) {
                if (settings.darkMode) document.body.classList.add('dark-mode');
                const darkModeCheck = document.getElementById('darkModeToggle');
                if (darkModeCheck) darkModeCheck.checked = settings.darkMode;
            }
        }
    }

    function saveSettings() {
        const normalizeChars = document.getElementById('normalizeChars').checked;
        const darkMode = document.body.classList.contains('dark-mode');

        const settings = {
            normalizeChars,
            darkMode
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        saveSettings();
    }

    function showToast() {
        toast.className = "show";
        setTimeout(() => { toast.className = ""; }, 2500);
    }

    function convert() {
        // const wrapOption = document.querySelector('input[name="wrapOption"]:checked').value; // No longer primary logic
        // const doConvertList = document.getElementById('convertList').checked; // Handled naturally by preserving UL/LI
        const doNormalize = document.getElementById('normalizeChars').checked;

        let resultHtml = "";
        const textContent = inputArea.innerText;
        charCount.innerText = `${textContent.length} chars`;

        // Create a clone to process
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = inputArea.innerHTML;

        // 1. Normalize Chars (Text node processing)
        if (doNormalize) {
            normalizeTextNodes(tempDiv);
        }

        // 2. Clean HTML (Remove bad tags/styles, keep structure)
        cleanNode(tempDiv);

        // 3. Post-processing (Images, URLs)
        resultHtml = tempDiv.innerHTML;

        // Image tag replacement (Text based)
        resultHtml = resultHtml.replace(/\[画像[:：]\s*([^\]]+)\]/g, (match, filename) => {
            return `<img src="image/${filename.trim()}" class="img-responsive" alt="">`;
        });

        // URL linking
        // Only linkify text that isn't already inside an <a> tag
        // Simple approach: find URLs and wrap them, but we need to be careful with existing HTML
        // For better accuracy, we handle it via a temporary DOM processing or specific regex
        const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
        
        // We use a safe way to replace URLs only in text nodes
        const finalDiv = document.createElement('div');
        finalDiv.innerHTML = resultHtml;
        linkifyTextNodes(finalDiv, urlRegex);
        resultHtml = finalDiv.innerHTML;
        
        outputSource.value = resultHtml.trim();
        previewArea.innerHTML = resultHtml.trim();
    }

    function linkifyTextNodes(node, regex) {
        if (node.nodeType === 1 && node.tagName.toLowerCase() === 'a') return; // Skip already linked
        
        if (node.nodeType === 3) { // Text node
            const text = node.nodeValue;
            if (regex.test(text)) {
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;
                text.replace(regex, (match, url, index) => {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
                    const a = document.createElement('a');
                    a.href = url;
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    a.textContent = url;
                    fragment.appendChild(a);
                    lastIndex = index + match.length;
                });
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                node.parentNode.replaceChild(fragment, node);
            }
        } else {
            Array.from(node.childNodes).forEach(child => linkifyTextNodes(child, regex));
        }
    }

    function normalizeTextNodes(node) {
        if (node.nodeType === 3) { // Text node
            let text = node.nodeValue;
            for (let key in charMap) {
                text = text.split(key).join(charMap[key]);
            }
            node.nodeValue = text;
        } else {
            node.childNodes.forEach(child => normalizeTextNodes(child));
        }
    }

    function cleanNode(node) {
        // Allowed tags list (Removed 'span')
        const allowedTags = ['p', 'br', 'div', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        
        // Remove comments
        if (node.nodeType === 8) {
            node.parentNode.removeChild(node);
            return;
        }

        if (node.nodeType === 1) { // Element
            const tag = node.tagName.toLowerCase();

            // Special handling for Style (Color and Bold)
            const color = node.style.color;
            const fontWeight = node.style.fontWeight;
            const hasColor = color && !(/rgb\(0, 0, 0\)|#000000|black/i.test(color));
            const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 600;

            // If it's bold but not a strong tag, wrap it or convert it later
            // But for simplicity, we can convert the current node if it's a span or similar
            
            // Clean Attributes first
            const attrs = Array.from(node.attributes);
            attrs.forEach(attr => {
                const name = attr.name.toLowerCase();
                if (['href', 'src', 'alt', 'target', 'rel', 'colspan', 'rowspan', 'class'].includes(name)) {
                    if (name === 'class') {
                        const cls = attr.value;
                        if (!cls.includes('table') && !cls.includes('img-responsive')) {
                             node.removeAttribute('class');
                        }
                    }
                    return;
                }
                node.removeAttribute(name);
            });

            // Restore allowed styles
            if (hasColor) {
                node.style.color = color;
            }
            if (isBold) {
                // If it's a block or important tag, keep style, otherwise we'll prefer strong
                if (tag === 'p' || tag === 'div' || tag.startsWith('h')) {
                    node.style.fontWeight = 'bold';
                }
            }

            // Unwrap disallowed tags
            // Special exception: allow span IF it has color
            let shouldUnwrap = !allowedTags.includes(tag);
            if (tag === 'span' && hasColor) {
                shouldUnwrap = false;
            }

            if (shouldUnwrap) {
                if (['style', 'script', 'meta', 'link', 'title'].includes(tag)) {
                    node.parentNode.removeChild(node);
                    return;
                }
                
                // If it was bold, wrap children in strong before unwrapping
                if (isBold && tag !== 'strong' && tag !== 'b') {
                    const strong = document.createElement('strong');
                    while (node.firstChild) {
                        strong.appendChild(node.firstChild);
                    }
                    node.appendChild(strong);
                }

                while (node.firstChild) {
                    node.parentNode.insertBefore(node.firstChild, node);
                }
                node.parentNode.removeChild(node);
                return;
            }

            // Post-clean: if it's a bold tag (b/strong) and has bold style, remove style
            if ((tag === 'strong' || tag === 'b') && node.style.fontWeight) {
                node.style.fontWeight = '';
                if (node.getAttribute('style') === '') node.removeAttribute('style');
            }
            
            // Empty P or DIV removal
            if ((tag === 'p' || tag === 'div') && node.innerHTML.trim() === '' && node.querySelectorAll('br, img').length === 0) {
                 const br = document.createElement('br');
                 node.parentNode.replaceChild(br, node);
                 return;
            }
        }

        Array.from(node.childNodes).forEach(child => cleanNode(child));
    }

    // Event Listeners
    inputArea.addEventListener('input', convert);
    
    const normalizeCheck = document.getElementById('normalizeChars');
    if (normalizeCheck) {
        normalizeCheck.addEventListener('change', () => {
            convert();
            saveSettings();
        });
    }
    
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', toggleDarkMode);
    }

    inputArea.addEventListener('paste', () => setTimeout(convert, 50));
    
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(outputSource.value);
            showToast();
        } catch (err) {
            outputSource.select();
            document.execCommand('copy');
            showToast();
        }
    });
    
    clearBtn.addEventListener('click', () => {
        inputArea.innerHTML = "";
        convert();
        inputArea.focus();
    });

    // Initialize
    loadSettings();
});
