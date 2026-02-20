var DEX_EXTENSION = {
    id: "autocompletado",
    name: "Autocompletado",
    icon: "wand-2",
    version: "1.0.0",
    description: "Sugerencias inteligentes de código mientras escribes",
    ui_buttons: []
};

(function () {
    var wordlists = {};
    var popupEl = null;
    var activeIndex = 0;
    var suggestions = [];
    var currentFragment = "";
    var fragmentStart = 0;

    function getCaretCoordinates(textarea, position) {
        var mirror = document.getElementById("input-mirror");
        if (!mirror) {
            mirror = document.createElement("div");
            mirror.id = "input-mirror";
            mirror.style.position = "absolute";
            mirror.style.left = "-9999px";
            mirror.style.top = "-9999px";
            mirror.style.visibility = "hidden";
            mirror.style.whiteSpace = "pre-wrap";
            mirror.style.wordWrap = "break-word";
            document.body.appendChild(mirror);
        }

        var computed = window.getComputedStyle(textarea);
        var properties = [
            "fontFamily", "fontSize", "fontStyle", "fontWeight",
            "letterSpacing", "lineHeight", "textTransform",
            "wordSpacing", "textIndent",
            "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
            "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
            "boxSizing", "tabSize"
        ];

        properties.forEach(function (prop) {
            mirror.style[prop] = computed[prop];
        });

        mirror.style.width = textarea.offsetWidth + "px";
        mirror.style.height = "auto";
        mirror.style.overflow = "hidden";

        var text = textarea.value.substring(0, position);
        mirror.textContent = text;

        var span = document.createElement("span");
        span.textContent = textarea.value.substring(position) || ".";
        mirror.appendChild(span);

        var rect = textarea.getBoundingClientRect();
        var spanRect = span.getBoundingClientRect();
        var mirrorRect = mirror.getBoundingClientRect();

        var x = rect.left + (spanRect.left - mirrorRect.left) - textarea.scrollLeft;
        var y = rect.top + (spanRect.top - mirrorRect.top) - textarea.scrollTop + parseInt(computed.lineHeight, 10);

        return { x: x, y: y };
    }

    function getCurrentWord(textarea) {
        var pos = textarea.selectionStart;
        var text = textarea.value;
        var start = pos;

        while (start > 0 && /[\w\-]/.test(text[start - 1])) {
            start--;
        }

        var fragment = text.substring(start, pos);
        return { fragment: fragment, start: start };
    }

    function getLanguageFromEditor() {
        if (typeof DEX !== "undefined" && DEX.currentLanguage) {
            return DEX.currentLanguage;
        }
        var langEl = document.querySelector(".language-indicator, #current-language");
        if (langEl) {
            return langEl.textContent.trim().toLowerCase();
        }
        return "javascript";
    }

    function filterSuggestions(fragment, lang) {
        var list = wordlists[lang] || [];
        var lower = fragment.toLowerCase();
        return list.filter(function (word) {
            return word.toLowerCase().startsWith(lower) && word.toLowerCase() !== lower;
        }).slice(0, 6);
    }

    function showPopup(textarea) {
        if (!popupEl) {
            popupEl = document.getElementById("autocomplete-popup");
            if (!popupEl) {
                popupEl = document.createElement("div");
                popupEl.id = "autocomplete-popup";
                popupEl.style.position = "fixed";
                popupEl.style.zIndex = "10000";
                popupEl.style.background = "#1e1e2e";
                popupEl.style.border = "1px solid #444";
                popupEl.style.borderRadius = "6px";
                popupEl.style.boxShadow = "0 4px 16px rgba(0,0,0,0.4)";
                popupEl.style.maxHeight = "200px";
                popupEl.style.overflowY = "auto";
                popupEl.style.display = "none";
                popupEl.style.fontFamily = "monospace";
                popupEl.style.fontSize = "13px";
                document.body.appendChild(popupEl);
            }
        }

        popupEl.innerHTML = "";
        activeIndex = 0;

        suggestions.forEach(function (word, i) {
            var item = document.createElement("div");
            item.className = "ac-item" + (i === 0 ? " ac-active" : "");
            item.textContent = word;
            item.style.padding = "6px 12px";
            item.style.cursor = "pointer";
            item.style.color = "#cdd6f4";
            item.addEventListener("mousedown", function (e) {
                e.preventDefault();
                acceptSuggestion(textarea, word);
            });
            item.addEventListener("mouseenter", function () {
                setActive(i);
            });
            popupEl.appendChild(item);
        });

        var coords = getCaretCoordinates(textarea, textarea.selectionStart);
        popupEl.style.left = coords.x + "px";
        popupEl.style.top = coords.y + "px";
        popupEl.style.display = "block";
    }

    function hidePopup() {
        if (popupEl) {
            popupEl.style.display = "none";
            popupEl.innerHTML = "";
        }
        suggestions = [];
        activeIndex = 0;
    }

    function setActive(index) {
        var items = popupEl.querySelectorAll(".ac-item");
        items.forEach(function (el, i) {
            if (i === index) {
                el.classList.add("ac-active");
                el.style.background = "#45475a";
            } else {
                el.classList.remove("ac-active");
                el.style.background = "transparent";
            }
        });
        activeIndex = index;
    }

    function acceptSuggestion(textarea, word) {
        var before = textarea.value.substring(0, fragmentStart);
        var after = textarea.value.substring(textarea.selectionStart);
        textarea.value = before + word + after;
        var newPos = fragmentStart + word.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
        hidePopup();

        var evt = new Event("input", { bubbles: true });
        textarea.dispatchEvent(evt);
    }

    function handleKeydown(e) {
        if (!popupEl || popupEl.style.display === "none" || suggestions.length === 0) {
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((activeIndex + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((activeIndex - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Tab" || e.key === "Enter") {
            e.preventDefault();
            var textarea = e.target;
            acceptSuggestion(textarea, suggestions[activeIndex]);
        } else if (e.key === "Escape") {
            e.preventDefault();
            hidePopup();
        }
    }

    function handleClickOutside(e) {
        if (popupEl && popupEl.style.display !== "none") {
            if (!popupEl.contains(e.target)) {
                hidePopup();
            }
        }
    }

    var handlers = {
        onInit: function () {
            if (typeof DEX !== "undefined" && DEX.loadedWordlists) {
                wordlists = DEX.loadedWordlists;
            }
            document.addEventListener("click", handleClickOutside);
        },

        onEditorInput: function (editor) {
            var result = getCurrentWord(editor);
            currentFragment = result.fragment;
            fragmentStart = result.start;

            if (currentFragment.length < 2) {
                hidePopup();
                return;
            }

            var lang = getLanguageFromEditor();
            suggestions = filterSuggestions(currentFragment, lang);

            if (suggestions.length === 0) {
                hidePopup();
                return;
            }

            showPopup(editor);

            editor.removeEventListener("keydown", handleKeydown);
            editor.addEventListener("keydown", handleKeydown);
        },

        onDestroy: function () {
            document.removeEventListener("click", handleClickOutside);
            if (popupEl && popupEl.parentNode) {
                popupEl.parentNode.removeChild(popupEl);
            }
            var mirror = document.getElementById("input-mirror");
            if (mirror && mirror.parentNode) {
                mirror.parentNode.removeChild(mirror);
            }
            popupEl = null;
            wordlists = {};
            suggestions = [];
        }
    };

    DEX.registerExtension(DEX_EXTENSION, handlers);
})();
// Dex code successful
