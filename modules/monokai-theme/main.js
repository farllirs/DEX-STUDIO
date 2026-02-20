var DEX_EXTENSION = {
    id: "monokai-theme",
    name: "Monokai Theme",
    icon: "palette",
    version: "1.0.0",
    description: "Tema Monokai clásico para el editor de código",
    ui_buttons: []
};

(function() {
    var style = document.createElement('style');
    style.textContent = `
        .code-highlight.theme-monokai { background: #272822; color: #f8f8f2; }
        .code-highlight.theme-monokai .hl-keyword  { color: #f92672; font-weight: 600; }
        .code-highlight.theme-monokai .hl-builtin  { color: #66d9ef; }
        .code-highlight.theme-monokai .hl-string   { color: #e6db74; }
        .code-highlight.theme-monokai .hl-comment  { color: #75715e; font-style: italic; }
        .code-highlight.theme-monokai .hl-number   { color: #ae81ff; }
        .code-highlight.theme-monokai .hl-function { color: #a6e22e; }
        .code-highlight.theme-monokai .hl-operator { color: #f92672; }
        .code-highlight.theme-monokai .hl-decorator{ color: #a6e22e; }
        .code-highlight.theme-monokai .hl-constant { color: #ae81ff; font-weight: 600; }
        .code-highlight.theme-monokai .hl-tag      { color: #f92672; }
        .code-highlight.theme-monokai .hl-attr     { color: #a6e22e; }
        .code-highlight.theme-monokai .hl-value    { color: #e6db74; }
        .code-highlight.theme-monokai .hl-selector { color: #f92672; }
        .code-highlight.theme-monokai .hl-property { color: #66d9ef; }
        .code-editor.theme-monokai { caret-color: #f8f8f2; }
    `;
    document.head.appendChild(style);

    // Register theme in editor theme selector
    var editorThemeSelect = document.getElementById('editor-theme');
    if (editorThemeSelect && !editorThemeSelect.querySelector('option[value="monokai"]')) {
        var opt = document.createElement('option');
        opt.value = 'monokai';
        opt.textContent = 'Monokai';
        editorThemeSelect.appendChild(opt);
    }

    var handlers = {
        onInit: function() {}
    };

    DEX.registerExtension(DEX_EXTENSION, handlers);
})();
// Dex code successful
