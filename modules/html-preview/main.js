var DEX_EXTENSION = {
    id: "html-preview",
    name: "Preview HTML",
    icon: "eye",
    version: "1.0.0",
    description: "Previsualiza archivos HTML en una pestaña del editor",
    ui_buttons: [
        { icon: "eye", label: "Preview", position: "editor-toolbar", fileTypes: [".html", ".htm"], action: "openPreview" }
    ]
};

(function () {
    var handlers = {
        openPreview: function () {
            var editor = document.getElementById("code-editor");
            if (!editor) return;
            DEX.openPreviewTab(editor.value);
        }
    };

    DEX.registerExtension(DEX_EXTENSION, handlers);
})();
// Dex code successful
