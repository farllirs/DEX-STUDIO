var DEX_EXTENSION = {
    id: "file-icons",
    name: "File Icons",
    icon: "file-type",
    version: "1.0.0",
    description: "Iconos coloridos por tipo de archivo en el explorador",
    ui_buttons: []
};

(function() {
    var iconMap = {
        '.py': { icon: 'file-code', color: '#3572A5' },
        '.js': { icon: 'file-code', color: '#f1e05a' },
        '.html': { icon: 'file-code', color: '#e34c26' },
        '.htm': { icon: 'file-code', color: '#e34c26' },
        '.css': { icon: 'file-code', color: '#563d7c' },
        '.json': { icon: 'file-json', color: '#cb8622' },
        '.md': { icon: 'file-text', color: '#083fa1' },
        '.txt': { icon: 'file-text', color: '#888888' },
        '.png': { icon: 'file-image', color: '#a074c4' },
        '.jpg': { icon: 'file-image', color: '#a074c4' },
        '.jpeg': { icon: 'file-image', color: '#a074c4' },
        '.gif': { icon: 'file-image', color: '#a074c4' },
        '.svg': { icon: 'file-image', color: '#ff9800' },
        '.sh': { icon: 'file-terminal', color: '#89e051' },
        '.xml': { icon: 'file-code', color: '#0060ac' },
        '.yaml': { icon: 'file-cog', color: '#cb171e' },
        '.yml': { icon: 'file-cog', color: '#cb171e' },
        '.gitignore': { icon: 'git-branch', color: '#f05032' }
    };

    var style = document.createElement('style');
    style.textContent = `
        .file-item .fi-icon { flex-shrink: 0; width: 14px; height: 14px; }
    `;
    document.head.appendChild(style);

    function colorizeFileTree() {
        var items = document.querySelectorAll('.file-item');
        items.forEach(function(item) {
            var nameEl = item.querySelector('.file-item-name');
            if (!nameEl) return;
            var name = nameEl.textContent.trim();
            var ext = '.' + name.split('.').pop().toLowerCase();
            var full = '.' + name;
            var mapping = iconMap[full] || iconMap[ext];
            if (mapping) {
                var icons = item.querySelectorAll('[data-lucide="file"]');
                icons.forEach(function(ic) {
                    ic.setAttribute('data-lucide', mapping.icon);
                    ic.style.color = mapping.color;
                });
            }
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    var observer = new MutationObserver(function() {
        setTimeout(colorizeFileTree, 50);
    });

    var handlers = {
        onInit: function() {
            var fileList = document.getElementById('file-list');
            if (fileList) {
                observer.observe(fileList, { childList: true, subtree: true });
                colorizeFileTree();
            }
        }
    };

    DEX.registerExtension(DEX_EXTENSION, handlers);
})();
// Dex code successful
