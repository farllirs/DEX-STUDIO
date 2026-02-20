var DEX_EXTENSION = {
    id: "image-viewer",
    name: "Visor de Imágenes",
    icon: "image",
    version: "1.0.0",
    description: "Visualiza imágenes directamente en el editor",
    fileTypes: [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp"],
    ui_buttons: []
};

(function () {
    var supportedExtensions = DEX_EXTENSION.fileTypes;

    function isImageFile(ext) {
        return supportedExtensions.indexOf(ext.toLowerCase()) !== -1;
    }

    var handlers = {
        onFileOpen: function (path, ext) {
            if (isImageFile(ext)) {
                DEX.showImageViewer(path);
                return true;
            }
            return false;
        }
    };

    DEX.registerExtension(DEX_EXTENSION, handlers);
})();
// Dex code successful
