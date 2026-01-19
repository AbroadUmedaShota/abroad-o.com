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
    const scrollTargets = [inputArea, previewArea, outputSource];
    let isSyncingScroll = false;

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

    function syncScroll(source) {
        if (isSyncingScroll) return;
        isSyncingScroll = true;

        const sourceMax = source.scrollHeight - source.clientHeight;
        const ratio = sourceMax > 0 ? source.scrollTop / sourceMax : 0;

        scrollTargets.forEach(target => {
            if (target === source) return;
            const targetMax = target.scrollHeight - target.clientHeight;
            target.scrollTop = targetMax > 0 ? ratio * targetMax : 0;
        });

        isSyncingScroll = false;
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
        
        outputSource.value = formatHtml(resultHtml);
        previewArea.innerHTML = resultHtml.trim();
    }

    function formatHtml(html) {
        if (!html) return "";
        
        // 1. Basic cleaning
        let formatted = html.trim();
        
        // 2. Add newlines before/after block elements
        // This regex adds a newline after closing tags and before opening tags of block elements
        const blockElements = 'p|div|ul|ol|li|table|thead|tbody|tr|td|th|h[1-6]|br|hr|header|section|article';
        
        // Add newline after these tags
        formatted = formatted.replace(new RegExp(`(</(?:${blockElements})>|<br\\s*/?>)`, 'gi'), '$1\n');
        
        // Add newline before these tags (if not already preceded by one)
        formatted = formatted.replace(new RegExp(`(<(?:${blockElements})[ >])`, 'gi'), '\n$1');
        
        // 3. Cleanup: Remove multiple newlines and leading/trailing whitespace per line
        formatted = formatted.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
            
        return formatted;
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

    function isNonBlackColor(color) {
        if (!color) return false;
        const trimmed = color.trim();
        if (!trimmed) return false;
        if (/^transparent$/i.test(trimmed)) return false;
        return !(/^(#000000|#000|rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\)|black)$/i.test(trimmed));
    }

    function cleanNode(node) {
        // Allowed tags list
        const allowedTags = ['p', 'br', 'b', 'a'];
        
        // Remove comments
        if (node.nodeType === 8) {
            node.parentNode.removeChild(node);
            return;
        }

        if (node.nodeType === 1) { // Element
            const tag = node.tagName.toLowerCase();

            if (tag === 'strong') {
                const bold = document.createElement('b');
                while (node.firstChild) {
                    bold.appendChild(node.firstChild);
                }
                node.parentNode.replaceChild(bold, node);
                cleanNode(bold);
                return;
            }

            // Special handling for Style (Color and Bold)
            const color = node.style.color || node.getAttribute('color');
            const fontWeight = node.style.fontWeight;
            const hasColor = isNonBlackColor(color);
            const isBold = tag === 'strong' || (tag === 'b' && fontWeight !== 'normal') || fontWeight === 'bold' || parseInt(fontWeight) >= 600;

            // If it's bold but not a strong tag, wrap it or convert it later
            // But for simplicity, we can convert the current node if it's a span or similar
            
            // Clean Attributes first
            const attrs = Array.from(node.attributes);
            attrs.forEach(attr => {
                const name = attr.name.toLowerCase();
                if (tag === 'a' && ['href', 'target', 'rel'].includes(name)) return;
                node.removeAttribute(name);
            });

            // Restore allowed styles
            node.style.cssText = '';
            if (hasColor) {
                node.style.color = color;
            }
            if (isBold) {
                if (tag === 'p') {
                    node.style.fontWeight = 'bold';
                }
            } else if (tag === 'b' && hasColor) {
                node.style.fontWeight = 'normal';
            }

            // Unwrap disallowed tags
            let shouldUnwrap = !allowedTags.includes(tag);

            if (shouldUnwrap) {
                if (['style', 'script', 'meta', 'link', 'title'].includes(tag)) {
                    node.parentNode.removeChild(node);
                    return;
                }

                if (!node.parentNode) {
                    Array.from(node.childNodes).forEach(child => cleanNode(child));
                    return;
                }
                
                // Preserve color and bold when unwrapping disallowed tags
                let wrapper = null;
                if (hasColor) {
                    wrapper = document.createElement('b');
                    wrapper.style.color = color;
                    if (!isBold) wrapper.style.fontWeight = 'normal';
                }
                if (isBold && tag !== 'strong' && tag !== 'b') {
                    const strong = document.createElement('b');
                    while (node.firstChild) {
                        strong.appendChild(node.firstChild);
                    }
                    if (wrapper) {
                        wrapper.appendChild(strong);
                        node.appendChild(wrapper);
                    } else {
                        node.appendChild(strong);
                    }
                } else if (wrapper) {
                    while (node.firstChild) {
                        wrapper.appendChild(node.firstChild);
                    }
                    node.appendChild(wrapper);
                }

                while (node.firstChild) {
                    node.parentNode.insertBefore(node.firstChild, node);
                }
                node.parentNode.removeChild(node);
                return;
            }

            // Post-clean: if bold tag has no styles, drop style attr
            if (tag === 'b' && node.getAttribute('style') === '') node.removeAttribute('style');
            
            // Empty P removal
            if (tag === 'p' && node.innerHTML.trim() === '' && node.querySelectorAll('br').length === 0) {
                 const br = document.createElement('br');
                 node.parentNode.replaceChild(br, node);
                 return;
            }
        }

        Array.from(node.childNodes).forEach(child => cleanNode(child));
    }

    // Event Listeners
    inputArea.addEventListener('input', convert);
    scrollTargets.forEach(target => {
        target.addEventListener('scroll', () => syncScroll(target));
    });
    
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
