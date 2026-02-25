// ─── DEX Extension API ───
const DEX = {
    extensions: {},
    extensionHandlers: {},
    loadedWordlists: {},
    currentLanguage: 'text',
    uiButtons: [],

    registerExtension: function(config, handlers) {
        this.extensions[config.id] = config;
        this.extensionHandlers[config.id] = handlers;
        if (config.ui_buttons && config.ui_buttons.length > 0) {
            config.ui_buttons.forEach(function(btn) {
                btn._extId = config.id;
                DEX.uiButtons.push(btn);
            });
        }
        if (handlers.onInit) handlers.onInit();
    },

    showImageViewer: function(path) {
        var panel = document.getElementById('image-viewer-panel');
        var img = document.getElementById('image-viewer-img');
        var nameEl = document.getElementById('image-viewer-name');
        var editor = document.getElementById('code-editor');
        var highlight = document.getElementById('code-highlight');
        var preview = document.getElementById('preview-panel');

        if (preview) preview.style.display = 'none';
        if (editor) editor.style.display = 'none';
        if (highlight) highlight.style.display = 'none';

        window.pywebview.api.get_image_base64(path).then(function(res) {
            if (res.success) {
                img.src = res.data_uri;
                nameEl.textContent = path.split('/').pop();
                panel.style.display = 'flex';
            } else {
                app.log('Error al cargar imagen: ' + (res.error || ''), true);
            }
        });
    },

    hideImageViewer: function() {
        var panel = document.getElementById('image-viewer-panel');
        var editor = document.getElementById('code-editor');
        var highlight = document.getElementById('code-highlight');
        if (panel) panel.style.display = 'none';
        if (editor) editor.style.display = '';
        if (highlight) highlight.style.display = '';
    },

    openPreviewTab: function(htmlContent) {
        var panel = document.getElementById('preview-panel');
        var iframe = document.getElementById('preview-iframe');
        var editor = document.getElementById('code-editor');
        var highlight = document.getElementById('code-highlight');
        var imagePanel = document.getElementById('image-viewer-panel');

        if (imagePanel) imagePanel.style.display = 'none';
        if (editor) editor.style.display = 'none';
        if (highlight) highlight.style.display = 'none';
        panel.style.display = 'block';

        // Write HTML to iframe
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        // Add a preview tab
        app._previewOpen = true;
        app.renderTabs();
    },

    hidePreview: function() {
        var panel = document.getElementById('preview-panel');
        var editor = document.getElementById('code-editor');
        var highlight = document.getElementById('code-highlight');
        if (panel) panel.style.display = 'none';
        if (editor) editor.style.display = '';
        if (highlight) highlight.style.display = '';
        app._previewOpen = false;
        app.renderTabs();
    },

    // Called when file changes to show/hide extension buttons
    updateExtButtons: function(filePath) {
        var container = document.getElementById('ext-buttons');
        if (!container) return;
        container.innerHTML = '';

        if (!filePath) return;
        var ext = '.' + filePath.split('.').pop().toLowerCase();

        this.uiButtons.forEach(function(btn) {
            var matches = btn.fileTypes.some(function(ft) { return ft === ext; });
            if (!matches) return;

            var button = document.createElement('button');
            button.className = 'ext-toolbar-btn';
            button.title = btn.label;
            button.innerHTML = '<i data-lucide="' + btn.icon + '"></i> ' + btn.label;
            button.onclick = function() {
                var handler = DEX.extensionHandlers[btn._extId];
                if (handler && handler[btn.action]) handler[btn.action]();
            };
            container.appendChild(button);
        });

        app._refreshIcons();
    },

    // Trigger onFileOpen hooks — returns true if an extension handled it
    triggerFileOpen: function(path) {
        var ext = '.' + path.split('.').pop().toLowerCase();
        for (var id in this.extensionHandlers) {
            var h = this.extensionHandlers[id];
            if (h.onFileOpen && h.onFileOpen(path, ext)) return true;
        }
        return false;
    },

    // Trigger onEditorInput hooks
    triggerEditorInput: function(editor) {
        for (var id in this.extensionHandlers) {
            var h = this.extensionHandlers[id];
            if (h.onEditorInput) h.onEditorInput(editor);
        }
    },

    // ─── Extended Extension API ───

    _panels: {},
    _commands: {},
    _fileSaveCallbacks: [],
    _fileChangeCallbacks: [],
    _menuItems: {},

    createPanel: function(id, html, options) {
        var container = document.getElementById('extension-panels');
        if (!container) {
            container = document.createElement('div');
            container.id = 'extension-panels';
            var editorWrapper = document.querySelector('.editor-wrapper');
            if (editorWrapper) editorWrapper.appendChild(container);
        }
        var existing = document.getElementById('ext-panel-' + id);
        if (existing) existing.remove();

        var panel = document.createElement('div');
        panel.id = 'ext-panel-' + id;
        panel.className = 'ext-custom-panel';
        if (options && options.position === 'right') {
            panel.style.cssText = 'position:absolute;right:0;top:0;bottom:0;width:' + (options.width || '350px') + ';background:var(--bg-secondary);border-left:1px solid var(--border);z-index:10;overflow-y:auto;padding:16px;';
        } else {
            panel.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;background:var(--bg-secondary);z-index:10;overflow-y:auto;padding:16px;';
        }
        panel.innerHTML = html;
        container.appendChild(panel);
        this._panels[id] = panel;

        // Hide editor when panel is full
        if (!options || options.position !== 'right') {
            var editor = document.getElementById('code-editor');
            var highlight = document.getElementById('code-highlight');
            if (editor) editor.style.display = 'none';
            if (highlight) highlight.style.display = 'none';
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
        return panel;
    },

    removePanel: function(id) {
        var panel = this._panels[id];
        if (panel) {
            panel.remove();
            delete this._panels[id];
        }
        // Restore editor if no panels
        if (Object.keys(this._panels).length === 0) {
            var editor = document.getElementById('code-editor');
            var highlight = document.getElementById('code-highlight');
            if (editor) editor.style.display = '';
            if (highlight) highlight.style.display = '';
        }
    },

    readCurrentFile: function() {
        if (!app.currentFilePath) return null;
        return document.getElementById('code-editor').value;
    },

    writeCurrentFile: function(content) {
        if (!app.currentFilePath) return false;
        document.getElementById('code-editor').value = content;
        app.tabContents[app.currentFilePath] = content;
        app.updateHighlight();
        return true;
    },

    getCurrentFilePath: function() {
        return app.currentFilePath;
    },

    getProjectPath: function() {
        return app.currentProjectPath;
    },

    showSidebar: function(id, html) {
        return this.createPanel(id, html, { position: 'right', width: '350px' });
    },

    registerCommand: function(id, fn) {
        this._commands[id] = fn;
    },

    executeCommand: function(id) {
        if (this._commands[id]) {
            this._commands[id]();
            return true;
        }
        return false;
    },

    onFileSave: function(callback) {
        this._fileSaveCallbacks.push(callback);
    },

    onFileChange: function(callback) {
        this._fileChangeCallbacks.push(callback);
    },

    triggerFileSave: function(path) {
        this._fileSaveCallbacks.forEach(function(cb) { cb(path); });
    },

    triggerFileChange: function(path) {
        this._fileChangeCallbacks.forEach(function(cb) { cb(path); });
    },

    showInputDialog: function(opts) {
        return new Promise(function(resolve) {
            var overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.display = 'flex';
            overlay.innerHTML = '<div class="modal-card modal-sm" style="max-width:400px">' +
                '<div class="modal-header"><h2>' + (opts.title || 'Entrada') + '</h2>' +
                '<button class="modal-close" id="ext-dialog-close"><i data-lucide="x"></i></button></div>' +
                '<div class="modal-body">' +
                (opts.message ? '<p style="margin-bottom:12px;color:var(--text-secondary)">' + opts.message + '</p>' : '') +
                '<input type="' + (opts.type || 'text') + '" class="form-input" id="ext-dialog-input" placeholder="' + (opts.placeholder || '') + '" value="' + (opts.defaultValue || '') + '">' +
                '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">' +
                '<button class="btn-secondary btn-sm" id="ext-dialog-cancel">Cancelar</button>' +
                '<button class="btn-primary btn-sm" id="ext-dialog-ok">' + (opts.okLabel || 'Aceptar') + '</button>' +
                '</div></div></div>';
            document.body.appendChild(overlay);
            if (typeof lucide !== 'undefined') lucide.createIcons();

            var input = document.getElementById('ext-dialog-input');
            input.focus();
            input.select();

            function close(val) { overlay.remove(); resolve(val); }
            document.getElementById('ext-dialog-ok').onclick = function() { close(input.value); };
            document.getElementById('ext-dialog-cancel').onclick = function() { close(null); };
            document.getElementById('ext-dialog-close').onclick = function() { close(null); };
            input.addEventListener('keydown', function(e) { if (e.key === 'Enter') close(input.value); if (e.key === 'Escape') close(null); });
            overlay.addEventListener('click', function(e) { if (e.target === overlay) close(null); });
        });
    },

    getTheme: function() {
        return {
            ui: app.uiTheme,
            editor: app.editorTheme
        };
    },

    addMenuItem: function(menu, item) {
        if (!this._menuItems[menu]) this._menuItems[menu] = [];
        this._menuItems[menu].push(item);
    },

    showNotification: function(title, message, type, duration) {
        app.showNotification(title, message, type, duration);
    },

    log: function(msg, isError) {
        app.log(msg, isError);
    },

    parseMarkdown: function(md) {
        if (!md) return '';
        var html = md
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code style="background:var(--bg-elevated);padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--accent)">$1</a>')
            .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">')
            .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg-elevated);padding:12px;border-radius:8px;overflow-x:auto;font-size:0.85em">$1</pre>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/(<li>.*<\/li>)/s, '<ul style="padding-left:20px;margin:8px 0">$1</ul>');
        return '<div style="line-height:1.6;color:var(--text-primary)">' + html + '</div>';
    },

    // ─── Filesystem API ───
    fs: {
        readFile: function(path) { return window.pywebview.api.read_file(path); },
        writeFile: function(path, content) { return window.pywebview.api.write_file(path, content); },
        listDir: function(path) { return window.pywebview.api.list_directory(path); },
        createFile: function(path) { return window.pywebview.api.create_file(path); },
        createDir: function(path) { return window.pywebview.api.create_directory(path); },
        delete: function(path) { return window.pywebview.api.delete_item(path); },
        rename: function(oldPath, newPath) { return window.pywebview.api.rename_item(oldPath, newPath); },
        exists: function(path) { return window.pywebview.api.file_exists(path); }
    },

    // ─── Shell API ───
    shell: {
        exec: function(cmd) { return window.pywebview.api.run_command(cmd); }
    },

    // ─── Storage API ───
    storage: {
        _currentExtId: null,
        forExtension: function(extId) {
            return {
                get: function(key) { return window.pywebview.api.ext_storage_get(extId, key); },
                set: function(key, value) { return window.pywebview.api.ext_storage_set(extId, key, value); },
                delete: function(key) { return window.pywebview.api.ext_storage_delete(extId, key); }
            };
        }
    },

    // ─── Editor API ───
    editor: {
        getContent: function() {
            var el = document.getElementById('code-editor');
            return el ? el.value : '';
        },
        setContent: function(content) {
            var el = document.getElementById('code-editor');
            if (el) { el.value = content; app.updateHighlight(); }
        },
        getSelection: function() {
            var el = document.getElementById('code-editor');
            if (!el) return '';
            return el.value.substring(el.selectionStart, el.selectionEnd);
        },
        replaceSelection: function(text) {
            var el = document.getElementById('code-editor');
            if (!el) return;
            var start = el.selectionStart;
            var end = el.selectionEnd;
            el.value = el.value.substring(0, start) + text + el.value.substring(end);
            el.selectionStart = el.selectionEnd = start + text.length;
            app.updateHighlight();
        },
        insertAtCursor: function(text) {
            var el = document.getElementById('code-editor');
            if (!el) return;
            var pos = el.selectionStart;
            el.value = el.value.substring(0, pos) + text + el.value.substring(pos);
            el.selectionStart = el.selectionEnd = pos + text.length;
            app.updateHighlight();
        },
        getCursor: function() {
            var el = document.getElementById('code-editor');
            if (!el) return { line: 1, col: 1 };
            var text = el.value.substring(0, el.selectionStart);
            var lines = text.split('\n');
            return { line: lines.length, col: lines[lines.length - 1].length + 1 };
        }
    },

    _keybinds: [],

    registerKeybind: function(combo, callback) {
        this._keybinds.push({ combo: combo.toLowerCase(), callback: callback });
    },

    _snippets: [],

    registerSnippet: function(trigger, language, content) {
        this._snippets.push({ trigger: trigger, language: language, content: content });
    },

    // ─── Events API ───
    _eventListeners: {},

    events: {
        on: function(event, callback) {
            if (!DEX._eventListeners[event]) DEX._eventListeners[event] = [];
            DEX._eventListeners[event].push(callback);
        },
        off: function(event, callback) {
            if (!DEX._eventListeners[event]) return;
            DEX._eventListeners[event] = DEX._eventListeners[event].filter(function(cb) { return cb !== callback; });
        },
        emit: function(event, data) {
            if (!DEX._eventListeners[event]) return;
            DEX._eventListeners[event].forEach(function(cb) {
                try { cb(data); } catch(e) { console.error('Event handler error:', e); }
            });
        }
    },

    // ─── UI API ───
    ui: {
        showToast: function(message, type, duration) {
            app.showNotification('', message, type || 'info', duration || 3000);
        },
        createStatusBarItem: function(id, text) {
            var container = document.querySelector('.editor-actions');
            if (!container) return null;
            var existing = document.getElementById('ext-status-' + id);
            if (existing) { existing.textContent = text; return existing; }
            var item = document.createElement('span');
            item.id = 'ext-status-' + id;
            item.className = 'ln-col-indicator';
            item.textContent = text;
            container.insertBefore(item, container.firstChild);
            return item;
        },
        updateStatusBarItem: function(id, text) {
            var el = document.getElementById('ext-status-' + id);
            if (el) el.textContent = text;
        },
        removeStatusBarItem: function(id) {
            var el = document.getElementById('ext-status-' + id);
            if (el) el.remove();
        },
        addContextMenuItem: function(label, icon, callback, condition) {
            DEX._contextMenuItems = DEX._contextMenuItems || [];
            DEX._contextMenuItems.push({ label: label, icon: icon || 'plug', callback: callback, condition: condition });
        }
    },

    // ─── Dialog API ───
    dialog: {
        alert: function(message, title) {
            return new Promise(function(resolve) {
                app.showNotification(title || 'Aviso', message, 'info', 4000);
                resolve();
            });
        },
        confirm: function(message, title) {
            return new Promise(function(resolve) {
                resolve(confirm((title ? title + '\n\n' : '') + message));
            });
        },
        prompt: function(title, placeholder, defaultValue) {
            return DEX.showInputDialog({
                title: title || 'Entrada',
                placeholder: placeholder || '',
                defaultValue: defaultValue || ''
            });
        },
        select: function(title, options) {
            return new Promise(function(resolve) {
                var overlay = document.createElement('div');
                overlay.className = 'modal-overlay';
                overlay.style.display = 'flex';
                var html = '<div class="modal-card modal-sm" style="max-width:400px">' +
                    '<div class="modal-header"><h2>' + (title || 'Seleccionar') + '</h2>' +
                    '<button class="modal-close" id="ext-select-close"><i data-lucide="x"></i></button></div>' +
                    '<div class="modal-body" style="padding:0;max-height:300px;overflow-y:auto">';
                options.forEach(function(opt, i) {
                    var label = typeof opt === 'string' ? opt : opt.label;
                    var val = typeof opt === 'string' ? opt : (opt.value || opt.label);
                    html += '<button class="option-row" data-val="' + i + '" style="width:100%;text-align:left"><div><strong>' + label + '</strong></div></button>';
                });
                html += '</div></div>';
                overlay.innerHTML = html;
                document.body.appendChild(overlay);
                if (typeof lucide !== 'undefined') lucide.createIcons();

                function close(val) { overlay.remove(); resolve(val); }
                document.getElementById('ext-select-close').onclick = function() { close(null); };
                overlay.addEventListener('click', function(e) {
                    if (e.target === overlay) close(null);
                    var row = e.target.closest('.option-row');
                    if (row) {
                        var idx = parseInt(row.dataset.val);
                        var opt = options[idx];
                        close(typeof opt === 'string' ? opt : (opt.value || opt.label));
                    }
                });
            });
        }
    },

    // ─── Project API ───
    project: {
        getPath: function() { return app.currentProjectPath; },
        getName: function() {
            if (!app.currentProjectPath) return null;
            return app.currentProjectPath.split('/').pop();
        },
        getOpenFiles: function() { return app.openTabs.slice(); },
        getCurrentFile: function() { return app.currentFilePath; },
        getLanguage: function() { return app._hlLang || 'text'; },
        isExtension: function() { return app._isExtensionProject; },
        getFiles: function(path) {
            var dir = path || app.currentProjectPath;
            if (!dir) return Promise.resolve([]);
            return window.pywebview.api.list_directory(dir).then(function(res) {
                return res.success ? res.items : [];
            });
        }
    },

    // ─── Clipboard API ───
    clipboard: {
        write: function(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            }
            return new Promise(function(resolve) {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                resolve();
            });
        },
        read: function() {
            if (navigator.clipboard && navigator.clipboard.readText) {
                return navigator.clipboard.readText();
            }
            return Promise.resolve('');
        }
    },

    // ─── HTTP API ───
    http: {
        fetch: function(url, options) {
            var opts = options || {};
            return window.pywebview.api.run_command(
                'curl -s' +
                (opts.method ? ' -X ' + opts.method : '') +
                (opts.headers ? Object.keys(opts.headers).map(function(k) { return ' -H "' + k + ': ' + opts.headers[k] + '"'; }).join('') : '') +
                (opts.body ? " -d '" + opts.body.replace(/'/g, "'\\''") + "'" : '') +
                ' "' + url + '"'
            ).then(function(res) {
                return { success: res.success, data: res.stdout || '', error: res.stderr || '' };
            });
        }
    },

    // ─── Require API (load other JS files from extension folder) ───
    require: function(extId, filePath) {
        return window.pywebview.api.load_module_file(extId, filePath).then(function(res) {
            if (!res.success) throw new Error(res.error || 'No se pudo cargar ' + filePath);
            if (filePath.endsWith('.json')) {
                return JSON.parse(res.content);
            }
            if (filePath.endsWith('.js')) {
                var module = { exports: {} };
                var fn = new Function('module', 'exports', 'DEX', 'app', res.content);
                fn(module, module.exports, DEX, app);
                return module.exports;
            }
            return res.content;
        });
    },

    // ─── Python API (run Python scripts from extension folder) ───
    python: {
        run: function(extId, scriptName, args) {
            return window.pywebview.api.run_extension_python(extId, scriptName, args || '').then(function(res) {
                return {
                    success: res.success,
                    stdout: res.stdout || '',
                    stderr: res.stderr || '',
                    code: res.code,
                    error: res.error || ''
                };
            });
        },
        exec: function(extId, code) {
            return window.pywebview.api.run_extension_python(extId, '_exec_temp.py', '').then(function() {
                return { success: false, error: 'Use DEX.python.run() with a script file instead' };
            });
        }
    },

    // ─── Extension Files API ───
    extFiles: {
        list: function(extId) {
            return window.pywebview.api.list_extension_files(extId);
        },
        read: function(extId, filePath) {
            return window.pywebview.api.load_module_file(extId, filePath);
        },
        write: function(extId, filePath, content) {
            return window.pywebview.api.write_extension_file(extId, filePath, content);
        }
    }
};

const app = {
    currentProjectPath: null,
    currentFilePath: null,
    sidebarOpen: true,
    consoleOpen: true,
    uiTheme: 'dark',
    editorTheme: 'dark',
    contextPath: null,
    openTabs: [],
    tabContents: {},
    lastLogMessage: '',
    cmdHistory: [],
    cmdHistoryIndex: -1,
    _previewOpen: false,
    _iconsTimer: null,
    selectedTemplate: 'GUI',
    _extensionsLoaded: false,
    _isExtensionProject: false,
    _extensionTestMode: false,
    _testExtId: null,

    _settings: {},

    _splashProgress: function(percent, status) {
        var bar = document.getElementById('splash-progress');
        var text = document.getElementById('splash-status');
        if (bar) bar.style.width = percent + '%';
        if (text) text.textContent = status;
    },

    _hideSplash: function() {
        var splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('splash-hidden');
    },

    init: function() {
        this._splashProgress(10, 'Cargando interfaz...');
        // Defaults — will be overridden by editor-config.json when backend is ready
        this.loadThemes();
        this.log("DEX STUDIO v1.0.2 — Creador de Apps para Linux");
        document.getElementById('breadcrumb-text').textContent = 'Inicio';

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.showCommandPalette();
            } else if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveFile();
            } else if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.createFile();
            } else if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                this.toggleConsole();
            } else if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                if (this.currentFilePath) this.closeTab(this.currentFilePath);
            } else if (e.ctrlKey && (e.key === 'f' || e.key === 'h')) {
                e.preventDefault();
                this.showSearchReplace();
            } else if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.selectNextOccurrence();
            }
            if (e.ctrlKey && e.key === '`') {
                e.preventDefault();
                const ti = document.getElementById('terminal-input');
                if (ti) ti.focus();
            }
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            }
            // Extension keybinds
            DEX._keybinds.forEach(function(kb) {
                var parts = kb.combo.split('+');
                var key = parts.pop();
                var needCtrl = parts.includes('ctrl');
                var needShift = parts.includes('shift');
                var needAlt = parts.includes('alt');
                if (needCtrl === e.ctrlKey && needShift === e.shiftKey && needAlt === e.altKey && e.key.toLowerCase() === key) {
                    e.preventDefault();
                    kb.callback();
                }
            });
        });

        // Search handler
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.searchInProject();
                }
            });
        }

        // Terminal input handler
        setTimeout(() => {
            const termInput = document.getElementById('terminal-input');
            if (termInput) {
                termInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const cmd = termInput.value.trim();
                        if (cmd) {
                            this.execTerminalCommand(cmd);
                            termInput.value = '';
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (this.cmdHistory.length > 0) {
                            if (this.cmdHistoryIndex < this.cmdHistory.length - 1) this.cmdHistoryIndex++;
                            termInput.value = this.cmdHistory[this.cmdHistoryIndex] || '';
                        }
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (this.cmdHistoryIndex > 0) {
                            this.cmdHistoryIndex--;
                            termInput.value = this.cmdHistory[this.cmdHistoryIndex] || '';
                        } else {
                            this.cmdHistoryIndex = -1;
                            termInput.value = '';
                        }
                    }
                });
            }
        }, 100);

        // Cargar proyectos recientes (from localStorage fallback)
        try {
            const stored = window.localStorage.getItem('recentProjects');
            if (stored) this.renderRecentProjects(JSON.parse(stored));
        } catch(e) {}

        // Setup syntax highlighting
        this.setupEditorHighlighting();

        // Hook editor input for extensions (autocomplete etc)
        const editorEl = document.getElementById('code-editor');
        if (editorEl) {
            editorEl.addEventListener('input', () => {
                DEX.triggerEditorInput(editorEl);
            });
        }

        this._splashProgress(30, 'Conectando backend...');

        var self = this;
        var initBackend = async function() {
            self.log("Motor de Backend conectado");
            self._splashProgress(40, 'Cargando configuración...');
            await self.loadSettingsFromFile();
            self._splashProgress(65, 'Cargando extensiones...');
            await self.loadExtensions();
            DEX.registerCommand('preview-markdown', function() { app.previewMarkdown(); });
            self._splashProgress(90, 'Restaurando proyecto...');
            // Small pause to let UI settle
            await new Promise(function(r) { setTimeout(r, 150); });
            self._splashProgress(100, 'Listo');
            setTimeout(function() { self._hideSplash(); }, 400);
        };

        window.addEventListener('pywebviewready', () => { initBackend(); });

        // Also try loading after a short delay (in case pywebviewready already fired)
        setTimeout(() => {
            if (!this._extensionsLoaded || !this._settingsLoaded) {
                initBackend();
            }
        }, 500);

        // Fallback: hide splash after 4s even if backend never connects
        setTimeout(function() { self._hideSplash(); }, 4000);
    },

    loadExtensions: async function() {
        if (this._extensionsLoaded) return;
        try {
            if (!window.pywebview || !window.pywebview.api) return;
            this._extensionsLoaded = true;

            const res = await window.pywebview.api.list_modules();
            if (!res.success || !res.modules) return;

            // Obtener extensiones desactivadas
            var disabledIds = {};
            try {
                var infoRes = await window.pywebview.api.get_installed_extensions_info();
                if (infoRes.success) {
                    (infoRes.extensions || []).forEach(function(e) {
                        if (e.is_disabled) disabledIds[e.id] = true;
                    });
                }
            } catch(e) {}

            for (const mod of res.modules) {
                try {
                    // Saltar extensiones desactivadas
                    if (disabledIds[mod.name]) {
                        this.log('⏸ Extensión desactivada: ' + mod.name);
                        continue;
                    }

                    // Load manifest.json first for metadata
                    let manifest = null;
                    try {
                        const mRes = await window.pywebview.api.load_module_file(mod.name, 'manifest.json');
                        if (mRes.success) manifest = JSON.parse(mRes.content);
                    } catch(e) {}

                    // Load main.js
                    const modRes = await window.pywebview.api.load_module(mod.name);
                    if (!modRes.success || !modRes.valid) {
                        this.log('Extensión inválida: ' + mod.name, true);
                        continue;
                    }

                    // Load wordlists if manifest says so or if it's autocompletado
                    if ((manifest && manifest.has_wordlists) || mod.name === 'autocompletado') {
                        for (const lang of ['python', 'javascript', 'html', 'css']) {
                            try {
                                const wl = await window.pywebview.api.load_module_file(mod.name, 'wordlists/' + lang + '.json');
                                if (wl.success) DEX.loadedWordlists[lang] = JSON.parse(wl.content);
                            } catch(e) {}
                        }
                    }

                    // Execute extension code with module support
                    var extModule = { exports: {} };
                    try {
                        var extFn = new Function('module', 'exports', 'DEX', 'app', modRes.code);
                        extFn(extModule, extModule.exports, DEX, app);
                    } catch(e2) {
                        // Fallback: execute as plain script (backward compatible)
                        new Function(modRes.code)();
                    }

                    // Merge manifest metadata into loaded extension if available
                    if (manifest && DEX.extensions[mod.name]) {
                        var ext = DEX.extensions[mod.name];
                        if (!ext.color && manifest.color) ext.color = manifest.color;
                        if (!ext.author && manifest.author) ext.author = manifest.author;
                        if (!ext.category && manifest.category) ext.category = manifest.category;
                    }

                    var extName = DEX.extensions[mod.name] ? DEX.extensions[mod.name].name : mod.name;
                    this.log('✓ Extensión cargada: ' + extName);
                } catch(e) {
                    this.log('Error cargando extensión ' + mod.name + ': ' + e.message, true);
                }
            }

            // Update extensions view
            this.updateExtensionsView();
        } catch(e) {
            // Extensions loading is optional, don't crash
        }
    },

    updateExtensionsView: async function() {
        var container = document.getElementById('installed-extensions');
        if (!container) return;

        // Obtener info completa de extensiones instaladas en disco
        var installedExts = [];
        try {
            var res = await window.pywebview.api.get_installed_extensions_info();
            if (res.success) installedExts = res.extensions || [];
        } catch(e) {}

        // Actualizar contador en la pestaña
        var countEl = document.getElementById('ext-v2-installed-count');
        if (countEl) countEl.textContent = installedExts.length;

        if (installedExts.length === 0) {
            container.innerHTML = '<div class="ext-v2-empty"><i data-lucide="puzzle" style="width:32px;height:32px;color:var(--text-tertiary)"></i><p>No hay extensiones instaladas</p></div>';
            app._refreshIcons();
            return;
        }

        container.innerHTML = '';
        var self = this;
        installedExts.forEach(function(ext) {
            var isActive = !!DEX.extensions[ext.id];
            var isDisabled = !!ext.is_disabled;
            var color = ext.color || 'linear-gradient(135deg, #667eea, #764ba2)';
            var card = document.createElement('div');
            card.className = 'ext-v2-card';
            if (isDisabled) card.style.opacity = '0.5';

            var metaParts = [];
            if (ext.author) metaParts.push(ext.author);
            if (ext.category) metaParts.push(ext.category);
            if (ext.downloads) metaParts.push(ext.downloads + ' descargas');
            if (ext.installed_at) {
                var d = ext.installed_at.split('T')[0];
                metaParts.push('Instalada: ' + d);
            }

            // Determinar estado visual
            var statusClass, statusText;
            if (isDisabled) {
                statusClass = 'ext-v2-status-disabled';
                statusText = '⏸ Desactivada';
            } else if (isActive) {
                statusClass = 'ext-v2-status-active';
                statusText = '● Activa';
            } else {
                statusClass = 'ext-v2-status-installed';
                statusText = '● Instalada';
            }

            // Botón toggle (activar/desactivar)
            var toggleIcon = isDisabled ? 'play' : 'pause';
            var toggleLabel = isDisabled ? 'Activar' : 'Desactivar';
            var toggleClass = isDisabled ? 'ext-v2-btn-enable' : 'ext-v2-btn-disable';

            card.innerHTML =
                '<div class="ext-v2-card-icon" style="background:' + color + (isDisabled ? ';filter:grayscale(0.6)' : '') + '">' +
                    '<i data-lucide="' + (ext.icon || 'puzzle') + '"></i>' +
                '</div>' +
                '<div class="ext-v2-card-body">' +
                    '<div class="ext-v2-card-title">' + ext.name + ' <span class="ext-v2-version">v' + (ext.version || '1.0.0') + '</span></div>' +
                    '<div class="ext-v2-card-desc">' + (ext.description || 'Sin descripción') + '</div>' +
                    '<div class="ext-v2-card-meta">' + metaParts.join(' • ') + '</div>' +
                '</div>' +
                '<div class="ext-v2-card-actions">' +
                    '<span class="ext-v2-status ' + statusClass + '">' + statusText + '</span>' +
                    '<button class="' + toggleClass + '" data-ext-id="' + ext.id + '" title="' + toggleLabel + '"><i data-lucide="' + toggleIcon + '" style="width:12px;height:12px"></i></button>' +
                    '<button class="ext-v2-btn-uninstall" data-ext-id="' + ext.id + '" title="Desinstalar"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>' +
                '</div>';

            // Click en la card abre detalle
            card.addEventListener('click', function(e) {
                if (e.target.closest('.ext-v2-btn-uninstall') || e.target.closest('.ext-v2-btn-enable') || e.target.closest('.ext-v2-btn-disable')) return;
                self.showExtensionDetail(ext, true);
            });

            // Botón toggle activar/desactivar
            var toggleBtn = card.querySelector('.ext-v2-btn-enable, .ext-v2-btn-disable');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    self.toggleExtension(ext.id);
                });
            }

            // Botón desinstalar
            var unBtn = card.querySelector('.ext-v2-btn-uninstall');
            if (unBtn) {
                unBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    self.uninstallExtension(ext.id);
                });
            }

            container.appendChild(card);
        });

        app._refreshIcons();
    },

    // ── Tabs de extensiones ──
    _currentExtTab: 'installed',

    switchExtTab: function(tab) {
        this._currentExtTab = tab;
        // Actualizar tabs
        document.querySelectorAll('.ext-v2-tab').forEach(function(t) {
            t.classList.toggle('active', t.getAttribute('data-tab') === tab);
        });
        // Actualizar paneles
        document.querySelectorAll('.ext-v2-panel').forEach(function(p) {
            p.classList.remove('active');
        });
        var panel = document.getElementById('ext-v2-panel-' + tab);
        if (panel) panel.classList.add('active');

        // Auto-cargar marketplace al seleccionarlo por primera vez
        if (tab === 'marketplace' && !this._marketplaceLoaded) {
            this.openExtRepo();
        }
    },

    _marketplaceLoaded: false,

    log: function(msg, isError = false) {
        const out = document.getElementById('terminal-out');
        const time = new Date().toLocaleTimeString();
        const line = `[${time}] ${isError ? 'ERROR: ' : ''}${msg}`;
        out.textContent += '\n' + line;
        out.scrollTop = out.scrollHeight;
        this.lastLogMessage = line;
    },

    showNotification: function(title, message, type, duration) {
        if (type === undefined) type = 'info';
        if (duration === undefined) duration = 4000;
        var container = document.getElementById('notification-container');
        if (!container) return;

        var icons = {
            success: 'check-circle',
            error: 'x-circle',
            info: 'info',
            warning: 'alert-triangle'
        };

        var toast = document.createElement('div');
        toast.className = 'notification-toast notif-' + type + '-border';
        toast.innerHTML = '<i data-lucide="' + (icons[type] || 'info') + '" class="notification-icon notif-' + type + '"></i>' +
            '<div class="notification-body">' +
            '<div class="notification-title">' + title + '</div>' +
            (message ? '<div class="notification-message">' + message + '</div>' : '') +
            '</div>' +
            '<button class="notification-close" onclick="this.parentElement.classList.add(\'notif-leaving\');setTimeout(()=>this.parentElement.remove(),250)"><i data-lucide="x" style="width:14px;height:14px"></i></button>';

        container.appendChild(toast);
        app._refreshIcons();

        if (duration > 0) {
            setTimeout(function() {
                if (toast.parentElement) {
                    toast.classList.add('notif-leaving');
                    setTimeout(function() { toast.remove(); }, 250);
                }
            }, duration);
        }
    },

    clearTerminal: function() {
        document.getElementById('terminal-out').textContent = '';
    },

    updateTerminalPrompt: function(projectName) {
        const prompt = document.getElementById('terminal-prompt');
        if (prompt) {
            prompt.textContent = (projectName || '~') + ' $';
        }
    },

    execTerminalCommand: async function(cmd) {
        this.cmdHistory.unshift(cmd);
        if (this.cmdHistory.length > 50) this.cmdHistory.pop();
        this.cmdHistoryIndex = -1;

        const out = document.getElementById('terminal-out');
        const promptText = document.getElementById('terminal-prompt').textContent;
        out.textContent += '\n' + promptText + ' ' + cmd;

        // Handle built-in commands
        if (cmd === 'clear' || cmd === 'cls') {
            this.clearTerminal();
            return;
        }
        if (cmd === 'help') {
            out.textContent += '\n  Comandos disponibles:';
            out.textContent += '\n    clear     - Limpiar terminal';
            out.textContent += '\n    help      - Mostrar ayuda';
            out.textContent += '\n    pwd       - Directorio actual';
            out.textContent += '\n    ls        - Listar archivos';
            out.textContent += '\n    run       - Ejecutar main.py';
            out.textContent += '\n    build     - Compilar proyecto';
            out.textContent += '\n  También puedes ejecutar cualquier comando del sistema.';
            out.scrollTop = out.scrollHeight;
            return;
        }
        if (cmd === 'run') {
            this.runProject();
            return;
        }
        if (cmd === 'build') {
            this.compileProject();
            return;
        }

        try {
            const cwd = this.currentProjectPath || '~';
            const res = await window.pywebview.api.run_command('cd "' + cwd + '" 2>/dev/null; ' + cmd + ' 2>&1');
            if (res.success) {
                if (res.stdout) out.textContent += '\n' + res.stdout;
                if (res.stderr) out.textContent += '\n' + res.stderr;
            } else {
                out.textContent += '\nError: ' + (res.error || 'Comando falló');
            }
        } catch(e) {
            out.textContent += '\nError: ' + e.message;
        }
        out.scrollTop = out.scrollHeight;
    },

    showView: function(viewId) {
        // Remover clases active de todas las vistas
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        
        // Activar vista seleccionada
        const view = document.getElementById('view-' + viewId);
        if (view) {
            view.classList.add('active');
        }
        
        // Actualizar breadcrumb
        const breadcrumbText = document.getElementById('breadcrumb-text');
        if (breadcrumbText) {
            breadcrumbText.textContent = viewId.charAt(0).toUpperCase() + viewId.slice(1);
        }
        
        // Activar botón nav correspondiente
        const navItems = document.querySelectorAll('[data-view="' + viewId + '"]');
        navItems.forEach(item => item.classList.add('active'));
    },

    toggleDevTools: async function() {
        const res = await window.pywebview.api.toggle_devtools();
        if (res.success) this.log(res.message);
    },

    createProject: async function() {
        const metadata = {
            name: document.getElementById('p-name').value,
            identifier: document.getElementById('p-id').value,
            creator: document.getElementById('p-creator').value,
            version: document.getElementById('p-version').value,
            category: document.getElementById('p-category').value,
            license: document.getElementById('p-license').value,
            type: document.getElementById('p-type').value,
            icon: document.getElementById('p-icon').value,
            description: document.getElementById('p-desc').value
        };

        this.log(`Validando e inicializando proyecto: ${metadata.name}...`);
        const res = await window.pywebview.api.create_project(metadata);
        if (res.success) {
            this.currentProjectPath = res.path;
            this.expandedFolders = {};
            this.log("Proyecto oficial creado con éxito", false);
            this.showNotification('Proyecto Creado', metadata.name + ' se creó exitosamente', 'success');
            document.getElementById('breadcrumb-text').textContent = metadata.name;
            this.refreshExplorer();
            this.showView('editor');
            this.updateRecentProjects(metadata.name, res.path);
            this.updateTerminalPrompt(metadata.name);
            this.detectProjectType();
        } else {
            this.log(res.error, true);
            this.showNotification('Error al Crear Proyecto', res.error, 'error');
        }
    },

    resetForm: function() {
        document.getElementById('p-name').value = '';
        document.getElementById('p-id').value = '';
        document.getElementById('p-creator').value = '';
        document.getElementById('p-version').value = '1.0.0';
        document.getElementById('p-category').value = 'Utility';
        document.getElementById('p-license').value = 'MIT';
        document.getElementById('p-type').value = 'GUI';
        document.getElementById('p-icon').value = '';
        document.getElementById('p-desc').value = '';
        this.log('Formulario limpiado');
        this.selectTemplate('GUI');
    },

    selectTemplate: function(type) {
        this.selectedTemplate = type;
        document.getElementById('p-type').value = type;

        // Update visual selection
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.template === type);
        });

        // Show/hide form fields based on template
        const fgCategory = document.getElementById('fg-category');
        const fgLicense = document.getElementById('fg-license');
        const fgIcon = document.getElementById('fg-icon');
        const fgIdentifier = document.getElementById('fg-identifier');
        const fsConfig = document.getElementById('fs-config');

        if (type === 'Extension') {
            if (fgCategory) fgCategory.style.display = 'none';
            if (fgLicense) fgLicense.style.display = 'none';
            if (fgIcon) fgIcon.style.display = 'none';
            if (fsConfig) fsConfig.style.display = '';
            if (fgIdentifier) fgIdentifier.style.display = '';
        } else if (type === 'Blank') {
            if (fsConfig) fsConfig.style.display = 'none';
        } else {
            if (fgCategory) fgCategory.style.display = '';
            if (fgLicense) fgLicense.style.display = '';
            if (fgIcon) fgIcon.style.display = '';
            if (fsConfig) fsConfig.style.display = '';
            if (fgIdentifier) fgIdentifier.style.display = '';
        }

        app._refreshIcons();
    },



    expandedFolders: {},

    refreshExplorer: async function() {
        try {
            if (!this.currentProjectPath) {
                document.getElementById('file-list').innerHTML = '<p style="color: var(--text-dim); font-size: 0.8rem;">Abre un proyecto para ver archivos</p>';
                return;
            }

            const list = document.getElementById('file-list');
            list.innerHTML = '';
            await this.buildTree(this.currentProjectPath, list, 0);
            app._refreshIcons();
        } catch(e) {
            this.log("Error al actualizar explorador: " + e.message, true);
        }
    },

    buildTree: async function(dirPath, parentEl, depth) {
        if (depth > 6) return;
        const res = await window.pywebview.api.list_directory(dirPath);
        if (!res.success) return;

        const sorted = res.items
            .filter(i => !i.name.startsWith('.'))
            .sort((a, b) => {
                if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
                return a.is_dir ? -1 : 1;
            });

        for (const item of sorted) {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.setAttribute('draggable', 'true');
            li.dataset.path = item.path;
            li.dataset.isDir = item.is_dir ? 'true' : 'false';
            li.style.paddingLeft = (16 + depth * 16) + 'px';

            const isExpanded = this.expandedFolders[item.path];

            if (item.is_dir) {
                li.innerHTML = `<i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" style="width:12px;height:12px;flex-shrink:0;opacity:0.5"></i><i data-lucide="${isExpanded ? 'folder-open' : 'folder'}" style="width:14px;flex-shrink:0"></i><span class="file-item-name">${item.name}</span>`;
                li.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleFolder(item.path);
                };
            } else {
                li.innerHTML = `<span style="width:12px;flex-shrink:0"></span><i data-lucide="file" style="width:14px;flex-shrink:0"></i><span class="file-item-name">${item.name}</span>`;
                li.onclick = (e) => {
                    e.stopPropagation();
                    app.openFile(item.path);
                };
            }

            // Drag & Drop handlers
            li.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', item.path);
                e.dataTransfer.effectAllowed = 'move';
                li.classList.add('dragging');
            });

            li.addEventListener('dragend', (e) => {
                li.classList.remove('dragging');
                document.querySelectorAll('.drag-over, .drag-over-folder').forEach(el => {
                    el.classList.remove('drag-over', 'drag-over-folder');
                });
            });

            li.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                document.querySelectorAll('.drag-over, .drag-over-folder').forEach(el => {
                    el.classList.remove('drag-over', 'drag-over-folder');
                });
                if (item.is_dir) {
                    li.classList.add('drag-over-folder');
                } else {
                    li.classList.add('drag-over');
                }
            });

            li.addEventListener('dragleave', (e) => {
                li.classList.remove('drag-over', 'drag-over-folder');
            });

            li.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                li.classList.remove('drag-over', 'drag-over-folder');

                const sourcePath = e.dataTransfer.getData('text/plain');
                if (!sourcePath || sourcePath === item.path) return;

                // Determine destination directory
                const destDir = item.is_dir ? item.path : item.path.substring(0, item.path.lastIndexOf('/'));

                try {
                    const res = await window.pywebview.api.move_item(sourcePath, destDir);
                    if (res.success) {
                        app.log('✓ Movido: ' + sourcePath.split('/').pop() + ' → ' + destDir.split('/').pop());
                        if (item.is_dir) app.expandedFolders[item.path] = true;
                        app.refreshExplorer();
                    } else {
                        app.log(res.error, true);
                    }
                } catch(err) {
                    app.log('Error al mover: ' + err.message, true);
                }
            });

            li.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                app.showContextMenu(e, item.path, item.is_dir);
            };

            parentEl.appendChild(li);

            if (item.is_dir && isExpanded) {
                const childUl = document.createElement('ul');
                childUl.className = 'file-tree-nested';
                childUl.style.listStyle = 'none';
                childUl.style.padding = '0';
                childUl.style.margin = '0';
                parentEl.appendChild(childUl);
                await this.buildTree(item.path, childUl, depth + 1);
            }
        }
    },

    toggleFolder: function(folderPath) {
        this.expandedFolders[folderPath] = !this.expandedFolders[folderPath];
        this.refreshExplorer();
    },

    showContextMenu: function(e, path, isDir) {
        this.contextPath = path;
        this.contextIsDir = !!isDir;
        const menu = document.getElementById('context-menu');
        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
        
        setTimeout(() => {
            document.addEventListener('click', () => {
                menu.style.display = 'none';
            }, { once: true });
        }, 10);
    },

    createFile: async function() {
        if (!this.currentProjectPath) {
            this.log("Por favor abre un proyecto primero", true);
            return;
        }
        const name = prompt("Nombre del nuevo archivo:\n(Usa ruta relativa para subcarpetas, ej: src/utils.py)");
        if (name) {
            try {
                const path = this.currentProjectPath + '/' + name;
                const dir = path.substring(0, path.lastIndexOf('/'));
                if (dir !== this.currentProjectPath) {
                    await window.pywebview.api.create_directory(dir);
                }
                const res = await window.pywebview.api.create_file(path);
                if (res.success) {
                    this.log(`Archivo creado: ${name}`);
                    this.refreshExplorer();
                    this.openFile(path);
                } else {
                    this.log(res.error, true);
                }
            } catch(e) {
                this.log("Error al crear archivo: " + e.message, true);
            }
        }
    },

    createFolder: async function() {
        if (!this.currentProjectPath) {
            this.log("Por favor abre un proyecto primero", true);
            return;
        }
        const name = prompt("Nombre de la nueva carpeta:");
        if (name) {
            try {
                const path = this.currentProjectPath + '/' + name;
                const res = await window.pywebview.api.create_directory(path);
                if (res.success) {
                    this.log(`Carpeta creada: ${name}`);
                    this.expandedFolders[path] = true;
                    this.refreshExplorer();
                } else {
                    this.log(res.error || "Error al crear carpeta", true);
                }
            } catch(e) {
                this.log("Error al crear carpeta: " + e.message, true);
            }
        }
    },

    openFile: async function(path) {
        try {
            // Save current tab content before switching
            if (this.currentFilePath && this.openTabs.includes(this.currentFilePath)) {
                this.tabContents[this.currentFilePath] = document.getElementById('code-editor').value;
            }

            // Reset panels
            DEX.hideImageViewer();
            DEX.hidePreview();
            this._previewOpen = false;

            // Check if extension handles this file (e.g. image viewer)
            if (DEX.triggerFileOpen(path)) {
                this.currentFilePath = path;
                if (!this.openTabs.includes(path)) this.openTabs.push(path);
                document.getElementById('current-file').textContent = path.split('/').pop();
                this.renderTabs();
                this.showView('editor');
                DEX.updateExtButtons(path);
                return;
            }

            // Update language for autocomplete
            this._hlLang = this.detectLanguage(path);
            DEX.currentLanguage = this._hlLang;

            // If already open in a tab, just switch to it
            if (this.openTabs.includes(path)) {
                this.currentFilePath = path;
                document.getElementById('code-editor').value = this.tabContents[path] || '';
                document.getElementById('current-file').textContent = path.split('/').pop();
                this.updateHighlight();
                this.updateMinimap();
                this.renderTabs();
                this.showView('editor');
                DEX.updateExtButtons(path);
                return;
            }

            const res = await window.pywebview.api.read_file(path);
            if (res.success) {
                this.currentFilePath = path;
                this.openTabs.push(path);
                this.tabContents[path] = res.content;
                document.getElementById('code-editor').value = res.content;
                document.getElementById('current-file').textContent = path.split('/').pop();
                this.updateHighlight();
                this.updateMinimap();
                this.renderTabs();
                this.showView('editor');
                this.log('Archivo abierto: ' + path.split('/').pop());
                DEX.updateExtButtons(path);
                DEX.triggerFileChange(path);
                DEX.events.emit('fileOpen', path);
            } else {
                this.log(res.error || "Error al abrir archivo", true);
            }
        } catch(e) {
            this.log("Error: " + e.message, true);
        }
    },

    renderTabs: function() {
        const container = document.getElementById('editor-tabs');
        if (!container) return;
        container.innerHTML = '';

        this.openTabs.forEach(tabPath => {
            const tab = document.createElement('div');
            tab.className = 'editor-tab' + (tabPath === this.currentFilePath && !this._previewOpen ? ' active' : '');

            const name = document.createElement('span');
            name.textContent = tabPath.split('/').pop();
            name.style.cursor = 'pointer';
            name.onclick = (e) => {
                e.stopPropagation();
                this.openFile(tabPath);
            };

            const close = document.createElement('button');
            close.className = 'tab-close';
            close.textContent = '×';
            close.onclick = (e) => {
                e.stopPropagation();
                this.closeTab(tabPath);
            };

            tab.appendChild(name);
            tab.appendChild(close);
            container.appendChild(tab);
        });

        // Add Preview tab if open
        if (this._previewOpen) {
            const previewTab = document.createElement('div');
            previewTab.className = 'editor-tab active';
            previewTab.style.background = 'var(--accent)';
            previewTab.style.color = 'var(--bg-primary)';

            const pName = document.createElement('span');
            pName.textContent = '👁 Preview';
            pName.style.cursor = 'pointer';

            const pClose = document.createElement('button');
            pClose.className = 'tab-close';
            pClose.textContent = '×';
            pClose.onclick = (e) => {
                e.stopPropagation();
                DEX.hidePreview();
            };

            previewTab.appendChild(pName);
            previewTab.appendChild(pClose);
            container.appendChild(previewTab);
        }
    },

    closeTab: function(path) {
        const idx = this.openTabs.indexOf(path);
        if (idx === -1) return;

        // Save before closing if it's the active tab
        if (path === this.currentFilePath) {
            this.tabContents[path] = document.getElementById('code-editor').value;
        }

        this.openTabs.splice(idx, 1);
        delete this.tabContents[path];

        if (this.openTabs.length === 0) {
            this.currentFilePath = null;
            document.getElementById('code-editor').value = '';
            document.getElementById('current-file').textContent = 'Ningún archivo abierto';
        } else if (path === this.currentFilePath) {
            const newIdx = Math.min(idx, this.openTabs.length - 1);
            const newPath = this.openTabs[newIdx];
            this.currentFilePath = newPath;
            document.getElementById('code-editor').value = this.tabContents[newPath] || '';
            document.getElementById('current-file').textContent = newPath.split('/').pop();
        }

        DEX.events.emit('fileClose', path);
        this.renderTabs();
    },

    openProject: async function() {
        try {
            const folder = await window.pywebview.api.select_folder();
            if (!folder || !folder.path) return;

            const res = await window.pywebview.api.list_directory(folder.path);
            if (!res.success) {
                this.log("Error al listar proyectos: " + res.error, true);
                return;
            }

            const projects = res.items.filter(i => i.is_dir).map(i => ({ name: i.name, path: i.path }));
            if (projects.length === 0) {
                this.log("No hay proyectos en " + folder.path, true);
                this.showNotification('Sin Proyectos', 'No se encontraron proyectos. Crea uno primero.', 'warning');
                return;
            }

            // Show project selector modal
            this.showProjectSelector(projects);
        } catch(e) {
            this.log("Error al abrir proyecto: " + e.message, true);
        }
    },

    showProjectSelector: function(projects) {
        // Remove existing modal if any
        let modal = document.getElementById('project-selector-modal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'project-selector-modal';
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';

        let html = '<div class="modal-card modal-lg"><div class="modal-header"><h2>Seleccionar Proyecto</h2>' +
            '<button class="modal-close" onclick="app.closeModal(\'project-selector-modal\');document.getElementById(\'project-selector-modal\').remove()"><i data-lucide="x"></i></button></div>' +
            '<div class="modal-body" style="padding:0;max-height:60vh;overflow-y:auto">';

        projects.forEach(p => {
            html += '<div class="project-selector-item" style="display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s" ' +
                'onmouseenter="this.style.background=\'var(--bg-elevated)\'" onmouseleave="this.style.background=\'transparent\'">' +
                '<i data-lucide="folder" style="width:20px;height:20px;color:var(--accent);flex-shrink:0"></i>' +
                '<div style="flex:1;min-width:0">' +
                '<div style="font-size:14px;font-weight:600;color:var(--text-primary)">' + p.name + '</div>' +
                '<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.path + '</div></div>' +
                '<button class="btn-primary btn-sm" onclick="event.stopPropagation();app.selectAndOpenProject(\'' + p.name.replace(/'/g, "\\'") + '\',\'' + p.path.replace(/'/g, "\\'") + '\')" style="flex-shrink:0">' +
                '<i data-lucide="folder-open" style="width:13px;height:13px"></i> Abrir</button>' +
                '<button class="btn-small" onclick="event.stopPropagation();app.deleteProject(\'' + p.path.replace(/'/g, "\\'") + '\',\'' + p.name.replace(/'/g, "\\'") + '\')" ' +
                'style="flex-shrink:0;color:var(--error);border-color:var(--error)" title="Eliminar proyecto">' +
                '<i data-lucide="trash-2" style="width:13px;height:13px"></i></button>' +
                '</div>';
        });

        html += '</div></div>';
        modal.innerHTML = html;

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { modal.remove(); }
        });

        document.body.appendChild(modal);
        app._refreshIcons();
    },

    selectAndOpenProject: function(name, path) {
        const modal = document.getElementById('project-selector-modal');
        if (modal) modal.remove();

        this.currentProjectPath = path;
        this._syncProjectToBackend(path);
        this.expandedFolders = {};
        this.log('Proyecto abierto: ' + name);
        DEX.events.emit('projectOpen', { name: name, path: path });
        document.getElementById('breadcrumb-text').textContent = name;
        this.refreshExplorer();
        this.showView('editor');
        this.updateRecentProjects(name, path);
        this.updateTerminalPrompt(name);
        this.detectProjectType();
    },

    detectProjectType: async function() {
        if (!this.currentProjectPath) {
            this._isExtensionProject = false;
            this.updateRunButton();
            return;
        }
        try {
            var manifestRes = await window.pywebview.api.read_file(this.currentProjectPath + '/manifest.json');
            this._isExtensionProject = manifestRes.success;
        } catch(e) {
            this._isExtensionProject = false;
        }
        this.updateRunButton();
    },

    updateRunButton: function() {
        var btn = document.getElementById('run-btn');
        var icon = document.getElementById('run-btn-icon');
        var text = document.getElementById('run-btn-text');
        if (!btn || !icon || !text) return;

        if (this._extensionTestMode) {
            icon.setAttribute('data-lucide', 'square');
            text.textContent = 'Terminar Prueba';
            btn.style.background = 'var(--error, #ff453a)';
            btn.style.color = '#fff';
            btn.onclick = function() { app.stopTestExtension(); };
        } else if (this._isExtensionProject) {
            icon.setAttribute('data-lucide', 'flask-conical');
            text.textContent = 'Probar';
            btn.style.background = '';
            btn.style.color = '';
            btn.onclick = function() { app.testExtension(); };
        } else {
            icon.setAttribute('data-lucide', 'play');
            text.textContent = 'Ejecutar';
            btn.style.background = '';
            btn.style.color = '';
            btn.onclick = function() { app.runProject(); };
        }
        this._refreshIcons();
    },

    deleteProject: async function(path, name) {
        if (!confirm('¿Eliminar el proyecto "' + name + '" permanentemente?\n\nEsta acción no se puede deshacer.')) return;
        try {
            const res = await window.pywebview.api.delete_item(path);
            if (res.success) {
                this.log('Proyecto eliminado: ' + name);
                this.showNotification('Proyecto Eliminado', name, 'info');
                // Refresh the selector
                const modal = document.getElementById('project-selector-modal');
                if (modal) modal.remove();
                this.openProject();
            } else {
                this.log(res.error, true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    updateRecentProjects: function(name, path) {
        const container = document.getElementById('recent-projects');
        if (!container) return;

        let recents = [];
        try {
            const stored = window.localStorage.getItem('recentProjects');
            if (stored) recents = JSON.parse(stored);
        } catch(e) {}

        recents = recents.filter(p => p.path !== path);
        recents.unshift({ name: name, path: path });
        recents = recents.slice(0, 5);

        try {
            window.localStorage.setItem('recentProjects', JSON.stringify(recents));
        } catch(e) {}

        // Also persist to editor-config.json
        this._settings.recentProjects = recents;
        this._settings.lastProject = { name: name, path: path };
        this.persistSettings();

        this.renderRecentProjects(recents);
    },

    renderRecentProjects: function(recents) {
        const container = document.getElementById('recent-projects');
        const homeContainer = document.getElementById('home-recent-projects');

        // Sidebar recents
        if (container) {
            if (!recents || recents.length === 0) {
                container.innerHTML = '<p class="empty-state">No hay proyectos recientes</p>';
            } else {
                container.innerHTML = '';
                recents.forEach(p => {
                    const btn = document.createElement('button');
                    btn.className = 'nav-item';
                    btn.style.fontSize = '12px';
                    btn.style.padding = '8px 16px';
                    btn.innerHTML = `<i data-lucide="folder" style="width:14px;height:14px"></i><span>${p.name}</span>`;
                    btn.onclick = () => {
                        this.currentProjectPath = p.path;
                        this._syncProjectToBackend(p.path);
                        this.expandedFolders = {};
                        this.log(`Proyecto abierto: ${p.name}`);
                        document.getElementById('breadcrumb-text').textContent = p.name;
                        this.refreshExplorer();
                        this.showView('editor');
                        this.updateTerminalPrompt(p.name);
                        this.detectProjectType();
                    };
                    container.appendChild(btn);
                });
            }
        }

        // Home screen recents
        if (homeContainer) {
            if (!recents || recents.length === 0) {
                homeContainer.innerHTML = '<p class="empty-state">No hay proyectos recientes</p>';
            } else {
                homeContainer.innerHTML = '';
                recents.forEach(p => {
                    const btn = document.createElement('button');
                    btn.className = 'home-recent-item';
                    btn.innerHTML = `<i data-lucide="folder"></i><div class="recent-info"><div class="recent-name">${p.name}</div><div class="recent-path">${p.path}</div></div>`;
                    btn.onclick = () => {
                        this.currentProjectPath = p.path;
                        this._syncProjectToBackend(p.path);
                        this.expandedFolders = {};
                        this.log(`Proyecto abierto: ${p.name}`);
                        document.getElementById('breadcrumb-text').textContent = p.name;
                        this.refreshExplorer();
                        this.showView('editor');
                        this.updateTerminalPrompt(p.name);
                        this.detectProjectType();
                    };
                    homeContainer.appendChild(btn);
                });
            }
        }

        app._refreshIcons();
    },

    saveFile: async function() {
        if (!this.currentFilePath) {
            this.log("No hay archivo abierto", true);
            return;
        }
        try {
            const content = document.getElementById('code-editor').value;
            this.tabContents[this.currentFilePath] = content;
            const res = await window.pywebview.api.write_file(this.currentFilePath, content);
            if (res.success) {
                this.log('Archivo guardado: ' + this.currentFilePath.split('/').pop());
                this.showNotification('Guardado', this.currentFilePath.split('/').pop(), 'success', 2000);
                DEX.triggerFileSave(this.currentFilePath);
                    DEX.events.emit('fileSave', this.currentFilePath);
            } else {
                this.log(res.error || "Error al guardar", true);
            }
        } catch(e) {
            this.log("Error al guardar: " + e.message, true);
        }
    },

    renameFile: async function(oldPath) {
        const newName = prompt("Nuevo nombre:", oldPath.split('/').pop());
        if (newName && newName !== oldPath.split('/').pop()) {
            const newPath = oldPath.substring(0, oldPath.lastIndexOf('/')) + '/' + newName;
            const res = await window.pywebview.api.rename_item(oldPath, newPath);
            if (res.success) {
                this.log(`Renombrado: ${newName}`);
                this.refreshExplorer();
            }
        }
    },

    deleteFile: async function(path) {
        if (confirm("¿Está seguro de que desea eliminar este archivo/carpeta?")) {
            const res = await window.pywebview.api.delete_item(path);
            if (res.success) {
                this.log(`Eliminado: ${path.split('/').pop()}`);
                this.refreshExplorer();
            }
        }
    },

    runProject: function() {
        if (!this.currentProjectPath) {
            this.log("Abre un proyecto primero", true);
            return;
        }
        var modal = document.getElementById('run-modal');
        if (modal) {
            // Load current run config
            window.pywebview.api.get_run_config().then(function(res) {
                if (res.success && res.config) {
                    var c = res.config;
                    var mainEl = document.getElementById('run-main-file');
                    var interpEl = document.getElementById('run-interpreter');
                    var argsEl = document.getElementById('run-args');
                    if (mainEl) mainEl.value = c.main_file || 'main.py';
                    if (interpEl) interpEl.value = c.interpreter || 'python3';
                    if (argsEl) argsEl.value = c.args || '';
                }
            }).catch(function() {});
            modal.style.display = 'flex';
            app._refreshIcons();
        }
    },

    executeRun: async function() {
        this.closeModal('run-modal');
        if (this.currentFilePath) await this.saveFile();

        // Check if extension project
        try {
            var metaRes = await window.pywebview.api.read_file(this.currentProjectPath + '/manifest.json');
            if (metaRes.success) {
                var manifest = JSON.parse(metaRes.content);
                var extId = manifest.id || this.currentProjectPath.split('/').pop();
                this.log('▶ Instalando extensión localmente: ' + extId + '...');
                var copyRes = await window.pywebview.api.run_command(
                    'rm -rf ~/.dex-studio/extensions/' + extId + ' && mkdir -p ~/.dex-studio/extensions && cp -r "' + this.currentProjectPath + '" ~/.dex-studio/extensions/' + extId + ' 2>&1'
                );
                if (copyRes.success) {
                    this.log('✓ Extensión copiada a modules/' + extId);
                    this._extensionsLoaded = false;
                    DEX.extensions = {};
                    DEX.extensionHandlers = {};
                    DEX.uiButtons = [];
                    await this.loadExtensions();
                    this.showNotification('Extensión Recargada', manifest.name || extId, 'success');
                } else {
                    this.log('Error: ' + (copyRes.error || ''), true);
                }
                return;
            }
        } catch(e) {}

        // Normal project - use run config
        var mainFile = document.getElementById('run-main-file');
        var interpreter = document.getElementById('run-interpreter');
        var args = document.getElementById('run-args');
        var mf = (mainFile && mainFile.value) ? mainFile.value : 'main.py';
        var interp = (interpreter && interpreter.value) ? interpreter.value : 'python3';
        var extraArgs = (args && args.value) ? ' ' + args.value : '';

        this.log('▶ Ejecutando: ' + interp + ' ' + mf + extraArgs);
        try {
            var cmd = 'cd "' + this.currentProjectPath + '" && timeout 30 ' + interp + ' ' + mf + extraArgs + ' 2>&1 || true';
            var res = await window.pywebview.api.run_command(cmd);
            if (res.success) {
                if (res.stdout) this.log(res.stdout);
                if (res.stderr) this.log(res.stderr, true);
                if (res.code === 0) this.log('✓ Ejecución completada');
                else if (res.code === 124) this.log('⚠ Timeout: el proceso tardó más de 30s', true);
                else this.log('⚠ Proceso terminó con código: ' + res.code, true);
            } else {
                this.log(res.error || 'Error al ejecutar', true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    saveRunConfig: async function() {
        var mainFile = document.getElementById('run-main-file');
        var interpreter = document.getElementById('run-interpreter');
        var args = document.getElementById('run-args');
        var config = {
            main_file: mainFile ? mainFile.value : 'main.py',
            interpreter: interpreter ? interpreter.value : 'python3',
            args: args ? args.value : '',
            use_terminal: false
        };
        var res = await window.pywebview.api.save_run_config(config);
        if (res.success) {
            this.log('✓ Configuración de ejecución guardada');
            this.showNotification('Guardado', 'Configuración de ejecución guardada', 'success', 2000);
        } else {
            this.log(res.error, true);
        }
    },

    compileProject: function() {
        if (!this.currentProjectPath) {
            this.log('Abre un proyecto primero', true);
            return;
        }
        var modal = document.getElementById('compile-modal');
        if (modal) {
            var metaPath = this.currentProjectPath + '/manifest.json';
            var publishBtn = document.getElementById('compile-publish-btn');
            window.pywebview.api.read_file(metaPath).then(function(res) {
                var recEl = document.getElementById('compile-recommended');
                if (res.success) {
                    if (recEl) recEl.textContent = 'Recomendado: Empaquetar .zip (Extensión)';
                    if (publishBtn) publishBtn.style.display = '';
                } else {
                    if (recEl) recEl.textContent = 'Recomendado: Compilar .deb (Aplicación)';
                    if (publishBtn) publishBtn.style.display = 'none';
                }
            }).catch(function() {});
            modal.style.display = 'flex';
            app._refreshIcons();
        }
    },

    compileDeb: async function() {
        this.closeModal('compile-modal');
        this.log("Iniciando motor de empaquetado nativo (.deb)...");
        const res = await window.pywebview.api.compile_project();
        if (res.success) {
            this.log('ÉXITO: ' + res.message);
            this.showNotification('Compilación Exitosa', res.message, 'success');
        } else {
            this.log(res.error, true);
            this.showNotification('Error de Compilación', res.error, 'error');
        }
    },

    compileZip: async function() {
        this.closeModal('compile-modal');
        this.log("Empaquetando como .zip...");
        const res = await window.pywebview.api.compile_zip();
        if (res.success) {
            this.log('ÉXITO: ' + res.message);
            this.showNotification('ZIP Creado', res.message, 'success');
        } else {
            this.log(res.error, true);
            this.showNotification('Error', res.error, 'error');
        }
    },

    compileTar: async function() {
        this.closeModal('compile-modal');
        this.log("Exportando proyecto como .tar.gz...");
        const res = await window.pywebview.api.compile_tar();
        if (res.success) {
            this.log('ÉXITO: ' + res.message);
            this.showNotification('Exportado', res.message, 'success');
        } else {
            this.log(res.error, true);
            this.showNotification('Error', res.error, 'error');
        }
    },

    testExtension: async function() {
        if (!this.currentProjectPath) {
            this.log('Abre un proyecto de extensión primero', true);
            return;
        }
        if (this.currentFilePath) await this.saveFile();

        try {
            var metaRes = await window.pywebview.api.read_file(this.currentProjectPath + '/manifest.json');
            if (!metaRes.success) {
                this.log('No se encontró manifest.json', true);
                return;
            }
            var manifest = JSON.parse(metaRes.content);
            var extId = manifest.id || this.currentProjectPath.split('/').pop();
            var tempId = '_temp_test';

            this.log('🧪 Instalando extensión en modo prueba: ' + extId + '...');
            var copyRes = await window.pywebview.api.run_command(
                'rm -rf ~/.dex-studio/extensions/' + tempId + ' && mkdir -p ~/.dex-studio/extensions && cp -r "' + this.currentProjectPath + '" ~/.dex-studio/extensions/' + tempId + ' 2>&1'
            );
            if (copyRes.success) {
                this._extensionsLoaded = false;
                DEX.extensions = {};
                DEX.extensionHandlers = {};
                DEX.uiButtons = [];
                await this.loadExtensions();
                this._extensionTestMode = true;
                this._testExtId = tempId;
                this.updateRunButton();
                this.showNotification('Modo Prueba', 'Extensión "' + (manifest.name || extId) + '" en modo prueba', 'info');
                this.log('🧪 Extensión en modo prueba — presiona "Terminar Prueba" para finalizar');
            } else {
                this.log('Error: ' + (copyRes.error || ''), true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    stopTestExtension: async function() {
        if (!this._extensionTestMode) return;
        var tempId = this._testExtId || '_temp_test';

        this.log('⏹ Finalizando modo prueba...');
        try {
            await window.pywebview.api.run_command('rm -rf ~/.dex-studio/extensions/' + tempId + ' 2>&1');
            this._extensionsLoaded = false;
            DEX.extensions = {};
            DEX.extensionHandlers = {};
            DEX.uiButtons = [];
            await this.loadExtensions();
        } catch(e) {}

        this._extensionTestMode = false;
        this._testExtId = null;
        this.updateRunButton();
        this.showNotification('Prueba Finalizada', 'La extensión temporal fue eliminada', 'info');
        this.log('✓ Modo prueba finalizado');
    },

    publishExtension: async function() {
        this.closeModal('compile-modal');
        if (!this.currentProjectPath) {
            this.log('Abre un proyecto primero', true);
            return;
        }
        // Try loading token from settings, then from disk
        var token = this._settings.github_token;
        if (!token) {
            try {
                var tokenRes = await window.pywebview.api.load_github_token();
                if (tokenRes.success && tokenRes.token) {
                    token = tokenRes.token;
                    this._settings.github_token = token;
                }
            } catch(e) {}
        }
        if (!token) {
            token = prompt('Se necesita un token de GitHub para publicar.\n\nIntroduce tu token de acceso personal:\n(Crea uno en https://github.com/settings/tokens con scope "repo")');
            if (!token) return;
            this._settings.github_token = token;
            this.persistSettings();
            window.pywebview.api.save_github_token(token);
        }
        this.showPublishModal(token);
    },

    showPublishModal: function(token) {
        var existing = document.getElementById('publish-ext-modal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'publish-ext-modal';
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = '<div class="modal-card modal-sm" style="max-width:480px">' +
            '<div class="modal-header"><h2>📤 Publicar Extensión</h2>' +
            '<button class="modal-close" onclick="document.getElementById(\'publish-ext-modal\').remove()"><i data-lucide="x"></i></button></div>' +
            '<div class="modal-body">' +
            '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Elige dónde publicar tu extensión. Los archivos se subirán al repositorio que elijas y se registrará en el marketplace de DEX.</p>' +
            '<div style="display:flex;flex-direction:column;gap:12px">' +
            '<button class="option-row" id="pub-existing-btn" style="text-align:left">' +
            '<i data-lucide="github"></i><div><strong>Usar repositorio existente</strong><span>Sube los archivos a un repo de GitHub que ya tengas</span></div></button>' +
            '<button class="option-row" id="pub-new-btn" style="text-align:left">' +
            '<i data-lucide="plus-circle"></i><div><strong>Crear repositorio nuevo</strong><span>Se creará un nuevo repo en tu cuenta de GitHub</span></div></button>' +
            '</div>' +
            '<div id="pub-form" style="display:none;margin-top:16px">' +
            '<div class="form-group" id="pub-url-group">' +
            '<label style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;display:block">URL del Repositorio</label>' +
            '<input type="text" id="pub-repo-url" class="form-input" placeholder="https://github.com/usuario/mi-extension">' +
            '</div>' +
            '<div class="form-group" id="pub-name-group" style="display:none">' +
            '<label style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;display:block">Nombre del Repositorio</label>' +
            '<input type="text" id="pub-repo-name" class="form-input" placeholder="dex-ext-mi-extension">' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">' +
            '<button class="btn-secondary btn-sm" onclick="document.getElementById(\'publish-ext-modal\').remove()">Cancelar</button>' +
            '<button class="btn-primary btn-sm" id="pub-submit-btn"><i data-lucide="upload"></i> Publicar</button>' +
            '</div></div></div></div>';

        document.body.appendChild(modal);
        app._refreshIcons();

        var pubMode = 'existing';
        var pubForm = document.getElementById('pub-form');
        var urlGroup = document.getElementById('pub-url-group');
        var nameGroup = document.getElementById('pub-name-group');

        document.getElementById('pub-existing-btn').onclick = function() {
            pubMode = 'existing';
            pubForm.style.display = '';
            urlGroup.style.display = '';
            nameGroup.style.display = 'none';
            document.getElementById('pub-existing-btn').style.borderColor = 'var(--accent)';
            document.getElementById('pub-new-btn').style.borderColor = '';
        };
        document.getElementById('pub-new-btn').onclick = function() {
            pubMode = 'new';
            pubForm.style.display = '';
            urlGroup.style.display = 'none';
            nameGroup.style.display = '';
            document.getElementById('pub-new-btn').style.borderColor = 'var(--accent)';
            document.getElementById('pub-existing-btn').style.borderColor = '';
        };

        document.getElementById('pub-submit-btn').onclick = async function() {
            var repoUrl = document.getElementById('pub-repo-url').value.trim();
            var repoName = document.getElementById('pub-repo-name').value.trim();
            if (pubMode === 'existing' && !repoUrl) {
                app.showNotification('Error', 'Introduce la URL del repositorio', 'error');
                return;
            }
            if (pubMode === 'new' && !repoName) {
                app.showNotification('Error', 'Introduce un nombre para el repositorio', 'error');
                return;
            }
            document.getElementById('publish-ext-modal').remove();
            app.log('📤 Publicando extensión...');
            try {
                var res = await window.pywebview.api.publish_extension_v2(
                    token,
                    pubMode === 'existing' ? repoUrl : null,
                    pubMode === 'new',
                    pubMode === 'new' ? repoName : null
                );
                if (res.success) {
                    app.log('✓ ' + res.message);
                    app.showNotification('Publicada', res.message, 'success');
                } else {
                    app.log(res.error, true);
                    app.showNotification('Error al Publicar', res.error, 'error');
                }
            } catch(e) {
                app.log('Error: ' + e.message, true);
            }
        };

        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.remove();
        });
    },

    // Sidebar & Console Management
    toggleSidebar: function() {
        this.sidebarOpen = !this.sidebarOpen;
        const sidebar = document.getElementById('sidebar');
        if (this.sidebarOpen) {
            sidebar.classList.add('sidebar-open');
        } else {
            sidebar.classList.remove('sidebar-open');
        }
    },

    toggleConsole: function() {
        this.consoleOpen = !this.consoleOpen;
        const panel = document.getElementById('bottom-panel');
        const toggle = document.getElementById('console-toggle');
        
        if (this.consoleOpen) {
            panel.classList.remove('console-hidden');
            if (toggle) toggle.setAttribute('data-lucide', 'chevron-down');
        } else {
            panel.classList.add('console-hidden');
            if (toggle) toggle.setAttribute('data-lucide', 'chevron-up');
        }
        app._refreshIcons();
    },

    toggleThemeMenu: function() {
        const themes = ['dark', 'light', 'cyberpunk'];
        const currentIndex = themes.indexOf(this.uiTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        this.changeUITheme(nextTheme);
        const uiSelect = document.getElementById('ui-theme');
        if (uiSelect) uiSelect.value = nextTheme;
        const names = { dark: 'Futurista Dark', light: 'Minimalista Light', cyberpunk: 'Cyberpunk Neon' };
        this.log('Tema cambiado a: ' + (names[nextTheme] || nextTheme));
    },

    // ─── Settings Persistence ───
    _settingsLoaded: false,

    loadSettingsFromFile: async function() {
        if (this._settingsLoaded) return;
        try {
            if (!window.pywebview || !window.pywebview.api) return;
            this._settingsLoaded = true;
            const res = await window.pywebview.api.load_settings();
            if (res.success && res.settings) {
                this._settings = res.settings;
                if (res.settings.uiTheme) this.applyUITheme(res.settings.uiTheme);
                if (res.settings.editorTheme) this.applyEditorTheme(res.settings.editorTheme);
                if (res.settings.fontSize) this.changeFontSize(res.settings.fontSize, true);
                if (res.settings.fontFamily) this.changeFontFamily(res.settings.fontFamily, true);
                if (res.settings.consoleOpen === false) { this.consoleOpen = true; this.toggleConsole(); }
                if (res.settings.recentProjects) {
                    this.renderRecentProjects(res.settings.recentProjects);
                    try { window.localStorage.setItem('recentProjects', JSON.stringify(res.settings.recentProjects)); } catch(e) {}
                }
                // Sync select elements
                const uiSel = document.getElementById('ui-theme');
                const edSel = document.getElementById('editor-theme');
                const fsSel = document.getElementById('font-size');
                const ffSel = document.getElementById('font-family');
                if (uiSel && res.settings.uiTheme) uiSel.value = res.settings.uiTheme;
                if (edSel && res.settings.editorTheme) edSel.value = res.settings.editorTheme;
                if (fsSel && res.settings.fontSize) fsSel.value = res.settings.fontSize;
                if (ffSel && res.settings.fontFamily) ffSel.value = res.settings.fontFamily;

                if (res.settings.liteMode) {
                    document.body.classList.add('lite-mode');
                    this._liteModeHL = true;
                    var cb = document.getElementById('lite-mode-toggle');
                    if (cb) cb.checked = true;
                    try {
                        window.pywebview.api.run_command('killall picom 2>/dev/null; killall compton 2>/dev/null');
                    } catch(e) {}
                }

                // Load GitHub token from secure storage if not in settings
                if (!res.settings.github_token) {
                    try {
                        var tokenRes = await window.pywebview.api.load_github_token();
                        if (tokenRes.success && tokenRes.token) {
                            self._settings.github_token = tokenRes.token;
                        }
                    } catch(e) {}
                }

                // Restore last opened project
                if (res.settings.lastProject && res.settings.lastProject.path) {
                    await this.restoreLastProject(res.settings.lastProject);
                }
            }
        } catch(e) {}
    },

    restoreLastProject: async function(proj) {
        try {
            var checkRes = await window.pywebview.api.file_exists(proj.path);
            if (!checkRes.success || !checkRes.exists) return;
            this.currentProjectPath = proj.path;
            this._syncProjectToBackend(proj.path);
            this.expandedFolders = {};
            document.getElementById('breadcrumb-text').textContent = proj.name;
            this.updateTerminalPrompt(proj.name);
            await this.refreshExplorer();
            await this.detectProjectType();
            this.log('Proyecto restaurado: ' + proj.name);
        } catch(e) {}
    },

    persistSettings: function() {
        try {
            if (!window.pywebview || !window.pywebview.api) return;
            window.pywebview.api.save_settings(this._settings);
        } catch(e) {}
    },

    // Theme Management
    loadThemes: function() {
        this.applyUITheme(this.uiTheme);
        this.applyEditorTheme(this.editorTheme);
    },

    changeUITheme: function(theme) {
        this._settings.uiTheme = theme;
        this.persistSettings();
        this.applyUITheme(theme);
    },

    applyUITheme: function(theme) {
        document.body.className = document.body.className.replace(/theme-\w+/, '');
        if (theme !== 'dark') {
            document.body.classList.add('theme-' + theme);
        }
        this.uiTheme = theme;
    },

    changeEditorTheme: function(theme) {
        this._settings.editorTheme = theme;
        this.persistSettings();
        this.applyEditorTheme(theme);
    },

    applyEditorTheme: function(theme) {
        const editor = document.getElementById('code-editor');
        const highlight = document.getElementById('code-highlight');
        [editor, highlight].forEach(el => {
            if (!el) return;
            el.className = el.className.replace(/theme-\w+/g, '').trim();
            if (theme !== 'dark') el.classList.add('theme-' + theme);
        });
        this.editorTheme = theme;
        this.updateHighlight();
    },

    changeFontSize: function(size, skipPersist) {
        const editor = document.getElementById('code-editor');
        const highlight = document.getElementById('code-highlight');
        [editor, highlight].forEach(el => {
            if (el) el.style.fontSize = size + 'px';
        });
        if (!skipPersist) { this._settings.fontSize = size; this.persistSettings(); }
    },

    changeFontFamily: function(family, skipPersist) {
        const editor = document.getElementById('code-editor');
        const highlight = document.getElementById('code-highlight');
        [editor, highlight].forEach(el => {
            if (el) el.style.fontFamily = family;
        });
        if (!skipPersist) { this._settings.fontFamily = family; this.persistSettings(); }
    },

    // Git Integration
    initializeGitRepo: async function() {
        if (!this.currentProjectPath) {
            alert("Por favor abre un proyecto primero");
            return;
        }
        this.log("Inicializando repositorio Git...");
        const res = await window.pywebview.api.initialize_git(this.currentProjectPath);
        if (res.success) {
            this.log(`✓ Git inicializado: ${res.message}`);
        } else {
            this.log(res.error, true);
        }
    },

    connectGitHub: function() {
        const token = prompt("Introduce tu token de acceso de GitHub:\n(Crea uno en https://github.com/settings/tokens con scope 'repo')");
        if (token) {
            this._settings.github_token = token;
            this.persistSettings();
            // Also save to ~/.dex-studio/ for persistence across reinstalls
            window.pywebview.api.save_github_token(token);
            this.log("✓ Token de GitHub guardado de forma segura");
            this.showNotification('Token Guardado', 'Tu token de GitHub se ha guardado de forma segura', 'success');
        }
    },

    pushToGithub: async function() {
        if (!this.currentProjectPath) {
            this.log("Por favor abre un proyecto primero", true);
            return;
        }
        
        const repoUrl = prompt("URL del repositorio de GitHub (ej: https://github.com/usuario/repo.git)");
        if (!repoUrl) return;

        this.log("Subiendo a GitHub...");
        let token = this._settings.github_token || null;
        if (!token) {
            try {
                var tokenRes = await window.pywebview.api.load_github_token();
                if (tokenRes.success && tokenRes.token) token = tokenRes.token;
            } catch(e) {}
        }
        
        const res = await window.pywebview.api.push_to_github(this.currentProjectPath, repoUrl, token);
        
        if (res.success) {
            this.log("Proyecto subido: " + res.message);
        } else {
            this.log(res.error || "Error al subir", true);
        }
    },

    showHelp: function() {
        document.getElementById('help-modal').style.display = 'flex';
        app._refreshIcons();
        this.log('Ayuda abierta');
    },

    showMoreOptions: function() {
        document.getElementById('options-modal').style.display = 'flex';
        app._refreshIcons();
    },

    closeModal: function(id) {
        var modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
        document.querySelectorAll('.modal-backdrop, .modal-overlay').forEach(function(el) {
            if (el.style.display !== 'none' && el.id !== id && !el.querySelector('.modal-card')) {
                el.remove();
            }
        });
    },

    _syncProjectToBackend: function(path) {
        try {
            if (window.pywebview && window.pywebview.api && window.pywebview.api.open_project) {
                window.pywebview.api.open_project(path);
            }
        } catch(e) {}
    },

    _refreshIcons: function() {
        if (this._iconsTimer) clearTimeout(this._iconsTimer);
        this._iconsTimer = setTimeout(function() {
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, 30);
    },

    clearRecentProjects: function() {
        try { window.localStorage.removeItem('recentProjects'); } catch(e) {}
        const container = document.getElementById('recent-projects');
        if (container) container.innerHTML = '<p class="empty-state">No hay proyectos recientes</p>';
        this.log('Proyectos recientes limpiados');
        this.closeModal('options-modal');
    },

    exportProjectInfo: async function() {
        if (!this.currentProjectPath) {
            this.log('No hay proyecto abierto', true);
            return;
        }
        try {
            const res = await window.pywebview.api.read_file(this.currentProjectPath + '/metadata.json');
            if (res.success) {
                this.log('─── metadata.json ───\n' + res.content);
            } else {
                this.log('No se encontró metadata.json', true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    showGitMenu: function() {
        document.getElementById('git-modal').style.display = 'flex';
        app._refreshIcons();
    },

    openEditorRepo: function() {
        this.log('Abriendo repositorio de DEX STUDIO...');
        try {
            window.pywebview.api.run_command('xdg-open https://github.com/farllirs/DEX-STUDIO 2>/dev/null &');
        } catch(e) {
            this.log('No se pudo abrir el navegador', true);
        }
    },

    checkForUpdates: async function() {
        this.log('Buscando actualizaciones...');
        try {
            const res = await window.pywebview.api.run_command('curl -s https://raw.githubusercontent.com/farllirs/DEX-STUDIO/main/VERSION.txt 2>/dev/null');
            if (!res.success || !res.stdout) {
                this.log('No se pudo conectar con GitHub', true);
                this.showNotification('Error', 'No se pudo verificar actualizaciones', 'error');
                return;
            }

            const remoteVersion = res.stdout.trim();
            const localRes = await window.pywebview.api.read_file(window.pywebview.api.get_home_dir ? 
                (await window.pywebview.api.get_home_dir()) + '/dex-studio/VERSION.txt' : '/home/Dex/dex-studio/VERSION.txt');
            const localVersion = localRes.success ? localRes.content.trim() : '1.0.0';

            if (remoteVersion !== localVersion && remoteVersion > localVersion) {
                this.log('⬆ Nueva versión disponible: v' + remoteVersion + ' (actual: v' + localVersion + ')');
                if (confirm('Nueva versión disponible: v' + remoteVersion + '\n\n¿Deseas actualizar ahora?\n\nSe descargará desde GitHub y se reiniciará el editor.')) {
                    this.log('Descargando actualización...');
                    const updateRes = await window.pywebview.api.run_command(
                        'cd ~/dex-studio && git stash 2>/dev/null; git pull origin main 2>&1'
                    );
                    if (updateRes.success) {
                        this.log(updateRes.stdout || '');
                        this.showNotification('Actualizado', 'DEX STUDIO actualizado a v' + remoteVersion + '. Reinicia para aplicar.', 'success', 0);
                    } else {
                        this.log(updateRes.error || 'Error al actualizar', true);
                    }
                }
            } else {
                this.log('✓ DEX STUDIO v' + localVersion + ' — Estás usando la versión más reciente');
                this.showNotification('Sin Actualizaciones', 'Ya tienes la versión más reciente', 'info');
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    importFromGit: function() {
        const url = prompt('URL del repositorio a clonar:\n(Ej: https://github.com/usuario/repo.git)');
        if (!url) return;
        this.log('Clonando repositorio...');
        window.pywebview.api.run_command('cd "' + this.currentProjectPath + '/.." && git clone "' + url + '" 2>&1').then(res => {
            if (res.success && res.stdout) this.log(res.stdout);
            if (res.success && res.stderr) this.log(res.stderr);
            if (!res.success) this.log(res.error || 'Error al clonar', true);
        });
    },

    openExtRepo: async function() {
        this.log('Cargando repositorio de extensiones...');
        var container = document.getElementById('available-extensions');
        if (container) container.innerHTML = '<div class="ext-v2-empty"><i data-lucide="loader" style="width:24px;height:24px;color:var(--accent);animation:spin 1s linear infinite"></i><p>Cargando marketplace...</p></div>';
        app._refreshIcons();
        try {
            var res = await window.pywebview.api.sync_extension_registry();
            var allExts;
            if (!res.success) {
                res = await window.pywebview.api.fetch_extension_registry();
                if (!res.success) { this.log(res.error || 'Error al cargar repositorio', true); return; }
                allExts = res.registry.extensions || [];
            } else {
                allExts = res.extensions || [];
            }

            // Obtener IDs realmente instalados en disco
            var installedIds = [];
            try {
                var instRes = await window.pywebview.api.get_installed_extensions_info();
                if (instRes.success) {
                    installedIds = (instRes.extensions || []).map(function(e) { return e.id; });
                }
            } catch(e) {}

            this._marketplaceExts = allExts;
            this._marketplaceInstalledIds = installedIds;
            this._marketplaceLoaded = true;
            this._renderMarketplace(allExts, installedIds);
            this.log('✓ ' + allExts.length + ' extensiones encontradas');
        } catch(e) {
            this.log('Error: ' + e.message, true);
            if (container) container.innerHTML = '<div class="ext-v2-empty"><i data-lucide="wifi-off" style="width:32px;height:32px;color:var(--error)"></i><p>Error al cargar el marketplace</p></div>';
            app._refreshIcons();
        }
    },

    _marketplaceExts: [],
    _marketplaceInstalledIds: [],

    _renderMarketplace: function(allExts, installedIds) {
        var container = document.getElementById('available-extensions');
        if (!container) return;
        container.innerHTML = '';
        this._renderExtCards(allExts, installedIds, container);
        app._refreshIcons();

        // Conectar barra de búsqueda global
        var self = this;
        var searchInput = document.getElementById('ext-v2-search');
        if (searchInput) {
            searchInput.oninput = function() {
                var q = searchInput.value.toLowerCase().trim();
                if (self._currentExtTab === 'marketplace') {
                    var filtered = q ? self._marketplaceExts.filter(function(ext) {
                        return (ext.name || '').toLowerCase().includes(q) ||
                               (ext.description || '').toLowerCase().includes(q) ||
                               (ext.author || '').toLowerCase().includes(q) ||
                               (ext.id || '').toLowerCase().includes(q);
                    }) : self._marketplaceExts;
                    self._renderExtCards(filtered, self._marketplaceInstalledIds, container);
                } else {
                    // Filtrar instaladas
                    var instContainer = document.getElementById('installed-extensions');
                    if (instContainer) {
                        var cards = instContainer.querySelectorAll('.ext-v2-card');
                        cards.forEach(function(card) {
                            var text = card.textContent.toLowerCase();
                            card.style.display = (!q || text.includes(q)) ? '' : 'none';
                        });
                    }
                }
            };
        }
    },

    _renderExtCards: function(allExts, installedIds, container) {
        // Limpiar cards existentes
        var existingCards = container.querySelectorAll('.ext-v2-card');
        existingCards.forEach(function(c) { c.remove(); });
        var emptyEl = container.querySelector('.ext-v2-empty');
        if (emptyEl) emptyEl.remove();

        if (allExts.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'ext-v2-empty';
            empty.innerHTML = '<i data-lucide="search-x" style="width:28px;height:28px;color:var(--text-tertiary)"></i><p>No se encontraron extensiones</p>';
            container.appendChild(empty);
            app._refreshIcons();
            return;
        }

        var self = this;
        allExts.forEach(function(ext) {
            // Usar campo 'installed' del backend (disk check) O comparar con IDs
            var isInstalled = ext.installed === true || installedIds.includes(ext.id);
            var card = document.createElement('div');
            card.className = 'ext-v2-card';

            var color = ext.color || 'linear-gradient(135deg, #667eea, #764ba2)';
            var metaParts = [];
            if (ext.author) metaParts.push(ext.author);
            if (ext.category) metaParts.push(ext.category);
            if (ext.downloads) metaParts.push(ext.downloads + ' descargas');
            if (ext.repo_url) metaParts.push('📦 Repo propio');

            card.innerHTML =
                '<div class="ext-v2-card-icon" style="background:' + color + '">' +
                    '<i data-lucide="' + (ext.icon || 'puzzle') + '"></i>' +
                '</div>' +
                '<div class="ext-v2-card-body">' +
                    '<div class="ext-v2-card-title">' + (ext.name || ext.id) + ' <span class="ext-v2-version">v' + (ext.version || '1.0.0') + '</span></div>' +
                    '<div class="ext-v2-card-desc">' + (ext.description || 'Sin descripción') + '</div>' +
                    '<div class="ext-v2-card-meta">' + metaParts.join(' • ') + '</div>' +
                '</div>' +
                '<div class="ext-v2-card-actions">' +
                    (isInstalled
                        ? '<span class="ext-v2-status ext-v2-status-installed">Instalada ✓</span>'
                        : '<button class="ext-v2-btn-install" data-ext-id="' + ext.id + '"><i data-lucide="download" style="width:12px;height:12px"></i> Instalar</button>'
                    ) +
                '</div>';

            card.addEventListener('click', function(e) {
                if (e.target.closest('.ext-v2-btn-install')) return;
                self.showExtensionDetail(ext, isInstalled);
            });

            var installBtn = card.querySelector('.ext-v2-btn-install');
            if (installBtn) {
                installBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (ext.repo_url) {
                        self.installExtensionV2(ext.id, ext.repo_url);
                    } else {
                        self.installExtension(ext.id);
                    }
                });
            }

            container.appendChild(card);
        });

        app._refreshIcons();
    },

    installExtensionV2: async function(extId, repoUrl) {
        this.log('Instalando extensión: ' + extId + '...');
        try {
            var res = await window.pywebview.api.install_extension_v2(extId, repoUrl || null);
            if (res.success) {
                this.log('✓ ' + res.message);
                this.showNotification('Extensión Instalada', res.message, 'success');
                this.closeModal('ext-detail-modal');
                // Recargar extensiones y refrescar ambas vistas
                this._extensionsLoaded = false;
                await this.loadExtensions();
                await this.updateExtensionsView();
                this._marketplaceLoaded = false;
                if (this._currentExtTab === 'marketplace') this.openExtRepo();
            } else {
                this.log(res.error || 'Error al instalar', true);
                this.showNotification('Error de Instalación', res.error || 'No se pudo instalar la extensión', 'error');
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    showExtensionDetail: async function(ext, isInstalled) {
        var modal = document.getElementById('ext-detail-modal');
        if (!modal) return;

        // Header con icono grande
        var iconEl = document.getElementById('ext-detail-icon');
        iconEl.style.background = ext.color || 'linear-gradient(135deg, #667eea, #764ba2)';
        iconEl.innerHTML = '<i data-lucide="' + (ext.icon || 'puzzle') + '"></i>';

        document.getElementById('ext-detail-name').textContent = ext.name || ext.id;

        // Meta info detallada
        var metaParts = ['v' + (ext.version || '1.0.0')];
        if (ext.author) metaParts.push(ext.author);
        if (ext.category) metaParts.push(ext.category);
        if (ext.downloads) metaParts.push(ext.downloads + ' descargas');
        if (ext.installed_at) metaParts.push('Instalada: ' + ext.installed_at.split('T')[0]);
        if (ext.repo_url) metaParts.push('📦 Repo propio');
        document.getElementById('ext-detail-meta').textContent = metaParts.join(' • ');

        document.getElementById('ext-detail-desc').textContent = ext.description || 'Sin descripción';

        // Botones de acción
        var actionsEl = document.getElementById('ext-detail-actions');
        var isActive = !!DEX.extensions[ext.id];
        var isDisabled = !!ext.is_disabled;
        if (isInstalled) {
            var statusClass, statusText;
            if (isDisabled) { statusClass = 'ext-v2-status-disabled'; statusText = '⏸ Desactivada'; }
            else if (isActive) { statusClass = 'ext-v2-status-active'; statusText = '● Activa'; }
            else { statusClass = 'ext-v2-status-installed'; statusText = '● Instalada'; }

            var toggleLabel = isDisabled ? 'Activar' : 'Desactivar';
            var toggleIcon = isDisabled ? 'play' : 'pause';
            var toggleBtnClass = isDisabled ? 'ext-v2-btn-enable' : 'ext-v2-btn-disable';

            actionsEl.innerHTML =
                '<span class="ext-v2-status ' + statusClass + '" style="padding:4px 12px;font-size:11px">' + statusText + '</span>' +
                '<button class="' + toggleBtnClass + '" style="padding:4px 10px;width:auto;gap:4px" onclick="app.toggleExtension(\'' + ext.id + '\')"><i data-lucide="' + toggleIcon + '" style="width:12px;height:12px"></i> ' + toggleLabel + '</button>' +
                '<button class="ext-v2-btn-uninstall" onclick="app.uninstallExtension(\'' + ext.id + '\')"><i data-lucide="trash-2" style="width:12px;height:12px"></i> Desinstalar</button>';
        } else {
            var installFn = ext.repo_url
                ? 'app.installExtensionV2(\'' + ext.id + '\',\'' + (ext.repo_url || '') + '\')'
                : 'app.installExtension(\'' + ext.id + '\')';
            actionsEl.innerHTML = '<button class="ext-v2-btn-install" style="padding:6px 16px;font-size:12px" onclick="' + installFn + '"><i data-lucide="download" style="width:13px;height:13px"></i> Instalar</button>';
        }

        // README
        var readmeEl = document.getElementById('ext-detail-readme');
        readmeEl.innerHTML = '<div class="ext-v2-empty" style="padding:24px"><i data-lucide="loader" style="width:16px;height:16px;color:var(--accent);animation:spin 1s linear infinite"></i><p style="font-size:12px">Cargando README...</p></div>';
        modal.style.display = 'flex';
        app._refreshIcons();

        try {
            var res = await window.pywebview.api.fetch_extension_readme(ext.id);
            if (res.success && res.content) {
                readmeEl.innerHTML = '<div class="ext-v2-readme">' + DEX.parseMarkdown(res.content) + '</div>';
            } else {
                readmeEl.innerHTML = '<div class="ext-v2-empty" style="padding:24px"><i data-lucide="file-x" style="width:20px;height:20px;color:var(--text-tertiary)"></i><p style="font-size:12px">No se encontró README</p></div>';
            }
        } catch(e) {
            readmeEl.innerHTML = '<div class="ext-v2-empty" style="padding:24px"><p style="font-size:12px;color:var(--error)">Error al cargar README</p></div>';
        }
        app._refreshIcons();
    },

    installExtension: async function(extId) {
        this.log('Instalando extensión: ' + extId + '...');
        try {
            var res = await window.pywebview.api.install_extension(extId);
            if (res.success) {
                this.log('✓ ' + res.message);
                this.showNotification('Extensión Instalada', res.message, 'success');
                this.closeModal('ext-detail-modal');
                this._extensionsLoaded = false;
                await this.loadExtensions();
                await this.updateExtensionsView();
                this._marketplaceLoaded = false;
                if (this._currentExtTab === 'marketplace') this.openExtRepo();
            } else {
                this.log(res.error || 'Error al instalar', true);
                this.showNotification('Error de Instalación', res.error || 'No se pudo instalar la extensión', 'error');
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    toggleExtension: async function(extId) {
        try {
            var res = await window.pywebview.api.toggle_extension(extId);
            if (res.success) {
                this.log('✓ ' + res.message);
                var type = res.disabled ? 'warning' : 'success';
                this.showNotification('Extensión', res.message, type);
                // Si se reactivó, recargar extensiones
                if (!res.disabled) {
                    this._extensionsLoaded = false;
                    await this.loadExtensions();
                }
                await this.updateExtensionsView();
                this.showNotification('Reinicio', 'Reinicia DEX Studio para aplicar los cambios completamente', 'info', 5000);
            } else {
                this.log(res.error || 'Error', true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    uninstallExtension: async function(extId) {
        if (!confirm('¿Desinstalar extensión "' + extId + '"?')) return;
        try {
            var res = await window.pywebview.api.uninstall_extension(extId);
            if (res.success) {
                this.log('✓ ' + res.message);
                this.showNotification('Extensión Desinstalada', res.message, 'info');
                this.closeModal('ext-detail-modal');
                delete DEX.extensions[extId];
                delete DEX.extensionHandlers[extId];
                // Refrescar ambas vistas
                await this.updateExtensionsView();
                this._marketplaceLoaded = false;
                if (this._currentExtTab === 'marketplace') this.openExtRepo();
            } else {
                this.log(res.error || 'Error', true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    // ─── File Explorer Operations ───

    createFileInFolder: async function(path) {
        if (!path) { this.log('Abre un proyecto primero', true); return; }
        const dir = (path === this.currentProjectPath) ? path : this._resolveDir(path);
        const name = prompt('Nombre del nuevo archivo:');
        if (!name) return;
        try {
            const res = await window.pywebview.api.create_file_at(dir, name);
            if (res.success) {
                this.log('Archivo creado: ' + name);
                this.expandedFolders[dir] = true;
                this.refreshExplorer();
                this.openFile(res.path);
            } else {
                this.log(res.error, true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    createFolderInFolder: async function(path) {
        if (!path) { this.log('Abre un proyecto primero', true); return; }
        const dir = (path === this.currentProjectPath) ? path : this._resolveDir(path);
        const name = prompt('Nombre de la nueva carpeta:');
        if (!name) return;
        try {
            const res = await window.pywebview.api.create_folder_at(dir, name);
            if (res.success) {
                this.log('Carpeta creada: ' + name);
                this.expandedFolders[dir] = true;
                this.expandedFolders[res.path] = true;
                this.refreshExplorer();
            } else {
                this.log(res.error, true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    duplicateItem: async function(path) {
        if (!path) return;
        try {
            const res = await window.pywebview.api.duplicate_item(path);
            if (res.success) {
                this.log('Duplicado: ' + res.new_path.split('/').pop());
                this.refreshExplorer();
            } else {
                this.log(res.error, true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    moveItemPrompt: async function(path) {
        if (!path || !this.currentProjectPath) return;
        const dest = prompt('Mover a (ruta relativa al proyecto):\nEj: src/utils');
        if (!dest) return;
        const destFull = this.currentProjectPath + '/' + dest;
        try {
            const res = await window.pywebview.api.move_item(path, destFull);
            if (res.success) {
                this.log('Movido a: ' + dest);
                this.refreshExplorer();
            } else {
                this.log(res.error, true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    _resolveDir: function(path) {
        if (this.contextIsDir) return path;
        return path.substring(0, path.lastIndexOf('/'));
    },

    copyLastLog: function() {
        if (!this.lastLogMessage) {
            this.log('No hay log para copiar');
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(this.lastLogMessage).then(() => {
                this.log('✓ Último log copiado al portapapeles');
            }).catch(() => {
                this.fallbackCopy(this.lastLogMessage);
            });
        } else {
            this.fallbackCopy(this.lastLogMessage);
        }
    },

    fallbackCopy: function(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            this.log('✓ Último log copiado al portapapeles');
        } catch(e) {
            this.log('No se pudo copiar: ' + text);
        }
        document.body.removeChild(ta);
    },

    // ─── Syntax Highlighting Engine ───
    _hlLang: 'text',

    detectLanguage: function(filePath) {
        if (!filePath) return 'text';
        const ext = filePath.split('.').pop().toLowerCase();
        const map = {
            py: 'python', js: 'javascript', json: 'json',
            html: 'html', htm: 'html', css: 'css',
            md: 'markdown', txt: 'text', sh: 'bash',
            xml: 'html', svg: 'html'
        };
        return map[ext] || 'text';
    },

    escapeHtml: function(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    highlightCode: function(code, lang) {
        if (!code) return '';
        var escaped = this.escapeHtml(code);

        if (lang === 'python') return this._hlPython(escaped);
        if (lang === 'javascript') return this._hlJavaScript(escaped);
        if (lang === 'html') return this._hlHTML(escaped);
        if (lang === 'css') return this._hlCSS(escaped);
        if (lang === 'json') return this._hlJSON(escaped);
        if (lang === 'bash') return this._hlBash(escaped);
        return escaped;
    },

    _hlPython: function(code) {
        // Comments
        code = code.replace(/(#.*)/g, '<span class="hl-comment">$1</span>');
        // Triple-quoted strings
        code = code.replace(/(&#39;&#39;&#39;[\s\S]*?&#39;&#39;&#39;|&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;)/g, '<span class="hl-string">$1</span>');
        // Strings
        code = code.replace(/((?<![\\])(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;))/g, '<span class="hl-string">$1</span>');
        // Decorators
        code = code.replace(/(@\w+)/g, '<span class="hl-decorator">$1</span>');
        // Keywords
        code = code.replace(/\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|yield|raise|pass|break|continue|and|or|not|in|is|lambda|global|nonlocal|assert|del|async|await)\b/g, '<span class="hl-keyword">$1</span>');
        // Builtins
        code = code.replace(/\b(print|len|range|int|str|float|list|dict|set|tuple|bool|type|input|open|super|self|None|True|False|isinstance|enumerate|zip|map|filter|sorted|reversed|abs|min|max|sum|any|all|hasattr|getattr|setattr)\b/g, '<span class="hl-builtin">$1</span>');
        // Constants
        code = code.replace(/\b(None|True|False)\b/g, '<span class="hl-constant">$1</span>');
        // Numbers
        code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
        // Function calls
        code = code.replace(/(\w+)(\()/g, '<span class="hl-function">$1</span>$2');
        return code;
    },

    _hlJavaScript: function(code) {
        // Comments
        code = code.replace(/(\/\/.*)/g, '<span class="hl-comment">$1</span>');
        code = code.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');
        // Template literals
        code = code.replace(/(`[^`]*`)/g, '<span class="hl-string">$1</span>');
        // Strings
        code = code.replace(/((?<![\\])(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;))/g, '<span class="hl-string">$1</span>');
        // Keywords
        code = code.replace(/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|try|catch|finally|throw|async|await|yield|typeof|instanceof|of|in|delete|void)\b/g, '<span class="hl-keyword">$1</span>');
        // Builtins
        code = code.replace(/\b(console|document|window|Math|JSON|Array|Object|String|Number|Boolean|Promise|Map|Set|RegExp|Error|Date|parseInt|parseFloat|setTimeout|setInterval|fetch|require|module|exports)\b/g, '<span class="hl-builtin">$1</span>');
        // Constants
        code = code.replace(/\b(null|undefined|true|false|NaN|Infinity)\b/g, '<span class="hl-constant">$1</span>');
        // Numbers
        code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
        // Operators
        code = code.replace(/(===|!==|==|!=|&lt;=|&gt;=|=&gt;|\+\+|--)/g, '<span class="hl-operator">$1</span>');
        // Function calls
        code = code.replace(/(\w+)(\()/g, '<span class="hl-function">$1</span>$2');
        return code;
    },

    _hlHTML: function(code) {
        // Comments
        code = code.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comment">$1</span>');
        // Tags
        code = code.replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="hl-tag">$2</span>');
        // Attributes
        code = code.replace(/\s([\w-]+)(=)/g, ' <span class="hl-attr">$1</span>$2');
        // Attribute values in quotes
        code = code.replace(/(=)(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '$1<span class="hl-value">$2</span>');
        return code;
    },

    _hlCSS: function(code) {
        // Comments
        code = code.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');
        // Strings
        code = code.replace(/((?<![\\])(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;))/g, '<span class="hl-string">$1</span>');
        // Selectors (lines ending with {)
        code = code.replace(/^([^{}:;/\n]+)(\{)/gm, '<span class="hl-selector">$1</span>$2');
        // Properties
        code = code.replace(/\s\s([\w-]+)(\s*:)/g, '  <span class="hl-property">$1</span>$2');
        // Values - numbers with units
        code = code.replace(/:\s*([^;{}\n]+)(;)/g, ': <span class="hl-value">$1</span>$2');
        // Colors
        code = code.replace(/(#[0-9a-fA-F]{3,8})\b/g, '<span class="hl-number">$1</span>');
        return code;
    },

    _hlJSON: function(code) {
        // Strings (keys)
        code = code.replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="hl-attr">$1</span>$2');
        // Strings (values)
        code = code.replace(/(:\s*)(&quot;[^&]*?&quot;)/g, '$1<span class="hl-string">$2</span>');
        // Numbers
        code = code.replace(/:\s*(\d+\.?\d*)/g, ': <span class="hl-number">$1</span>');
        // Booleans / null
        code = code.replace(/:\s*(true|false|null)\b/g, ': <span class="hl-constant">$1</span>');
        return code;
    },

    _hlBash: function(code) {
        // Comments
        code = code.replace(/(#.*)/g, '<span class="hl-comment">$1</span>');
        // Strings
        code = code.replace(/((?<![\\])(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;))/g, '<span class="hl-string">$1</span>');
        // Keywords
        code = code.replace(/\b(if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|exit|export|source|local|echo|cd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk|chmod|chown|sudo|apt|pip|python3|python|node|npm)\b/g, '<span class="hl-keyword">$1</span>');
        // Variables
        code = code.replace(/(\$\w+|\$\{[^}]+\})/g, '<span class="hl-builtin">$1</span>');
        return code;
    },

    _hlTimer: null,

    updateHighlight: function() {
        if (this._liteModeHL) return;
        var editor = document.getElementById('code-editor');
        var highlight = document.getElementById('code-highlight');
        if (!editor || !highlight) return;
        var code = editor.value;
        var lang = this._hlLang;
        var html = this.highlightCode(code, lang);
        highlight.innerHTML = html + '\n';
        highlight.scrollTop = editor.scrollTop;
        highlight.scrollLeft = editor.scrollLeft;
    },

    updateHighlightDebounced: function() {
        if (this._liteModeHL) return;
        if (this._hlTimer) clearTimeout(this._hlTimer);
        var self = this;
        this._hlTimer = setTimeout(function() { self.updateHighlight(); }, 50);
    },

    setupEditorHighlighting: function() {
        var editor = document.getElementById('code-editor');
        var highlight = document.getElementById('code-highlight');
        if (!editor || !highlight) return;

        var self = this;
        editor.addEventListener('input', function() {
            self.updateHighlightDebounced();
            self.updateMinimap();
        });
        editor.addEventListener('scroll', function() {
            highlight.scrollTop = editor.scrollTop;
            highlight.scrollLeft = editor.scrollLeft;
            self.updateMinimap();
        });
        editor.addEventListener('click', function() { self.updateLnCol(); });
        editor.addEventListener('keyup', function() { self.updateLnCol(); });
        editor.addEventListener('keydown', function(e) {
            // Tab support with snippet expansion
            if (e.key === 'Tab') {
                var val = editor.value;
                var pos = editor.selectionStart;
                var lineStart = val.lastIndexOf('\n', pos - 1) + 1;
                var beforeCursor = val.substring(lineStart, pos);
                var matched = null;
                DEX._snippets.forEach(function(s) {
                    if (beforeCursor.endsWith(s.trigger) && (s.language === '*' || s.language === app._hlLang)) {
                        matched = s;
                    }
                });
                if (matched) {
                    e.preventDefault();
                    var triggerStart = pos - matched.trigger.length;
                    editor.value = val.substring(0, triggerStart) + matched.content + val.substring(pos);
                    editor.selectionStart = editor.selectionEnd = triggerStart + matched.content.length;
                    self.updateHighlight();
                    return;
                }
                e.preventDefault();
                var start = editor.selectionStart;
                var end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
                self.updateHighlight();
            }
        });
    },

    // ─── Command Palette ───
    showCommandPalette: function() {
        var overlay = document.getElementById('command-palette');
        var input = document.getElementById('cmd-palette-input');
        var list = document.getElementById('cmd-palette-list');
        overlay.style.display = 'flex';
        input.value = '';
        input.focus();

        var commands = [];
        commands.push({ id: 'save', label: 'Guardar archivo', key: 'Ctrl+S', fn: function() { app.saveFile(); } });
        commands.push({ id: 'new-file', label: 'Nuevo archivo', key: 'Ctrl+N', fn: function() { app.createFile(); } });
        commands.push({ id: 'toggle-terminal', label: 'Toggle Terminal', key: 'Ctrl+B', fn: function() { app.toggleConsole(); } });
        commands.push({ id: 'run', label: 'Ejecutar proyecto', fn: function() { app.runProject(); } });
        commands.push({ id: 'compile', label: 'Compilar proyecto', fn: function() { app.compileProject(); } });
        commands.push({ id: 'search', label: 'Buscar y Reemplazar', key: 'Ctrl+H', fn: function() { app.showSearchReplace(); } });
        commands.push({ id: 'settings', label: 'Abrir Configuración', fn: function() { app.showView('settings'); } });
        commands.push({ id: 'extensions', label: 'Extensiones', fn: function() { app.showView('extensions'); } });
        commands.push({ id: 'git-init', label: 'Git: Inicializar', fn: function() { app.initializeGitRepo(); } });
        commands.push({ id: 'git-push', label: 'Git: Subir a GitHub', fn: function() { app.pushToGithub(); } });
        commands.push({ id: 'diff', label: 'Git: Ver Diff', fn: function() { app.showDiff(); } });
        commands.push({ id: 'lite-mode', label: 'Toggle Modo Rendimiento', fn: function() { app.toggleLiteMode(); } });
        for (var id in DEX._commands) {
            commands.push({ id: 'ext-' + id, label: id.replace(/[-_]/g, ' '), fn: DEX._commands[id] });
        }
        this._paletteCommands = commands;
        this._paletteIndex = 0;
        this._renderPalette('');

        var self = this;
        input.oninput = function() { self._paletteIndex = 0; self._renderPalette(input.value); };
        input.onkeydown = function(e) {
            if (e.key === 'Escape') { self.hideCommandPalette(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); self._paletteIndex++; self._renderPalette(input.value); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); self._paletteIndex = Math.max(0, self._paletteIndex - 1); self._renderPalette(input.value); }
            else if (e.key === 'Enter') {
                var items = self._filteredPaletteItems || [];
                if (items[self._paletteIndex]) { self.hideCommandPalette(); items[self._paletteIndex].fn(); }
            }
        };
        overlay.onclick = function(e) { if (e.target === overlay) self.hideCommandPalette(); };
    },

    hideCommandPalette: function() {
        document.getElementById('command-palette').style.display = 'none';
    },

    _paletteCommands: [],
    _paletteIndex: 0,
    _filteredPaletteItems: [],

    _renderPalette: function(query) {
        var list = document.getElementById('cmd-palette-list');
        var q = query.toLowerCase();
        var filtered = this._paletteCommands.filter(function(c) { return !q || c.label.toLowerCase().includes(q); });
        this._filteredPaletteItems = filtered;
        if (this._paletteIndex >= filtered.length) this._paletteIndex = Math.max(0, filtered.length - 1);
        var self = this;
        list.innerHTML = '';
        filtered.forEach(function(c, i) {
            var item = document.createElement('div');
            item.className = 'cmd-palette-item' + (i === self._paletteIndex ? ' active' : '');
            item.innerHTML = '<span>' + c.label + '</span>' + (c.key ? '<span class="cmd-key">' + c.key + '</span>' : '');
            item.onclick = function() { self.hideCommandPalette(); c.fn(); };
            list.appendChild(item);
        });
    },

    // ─── Search & Replace ───
    _searchMatches: [],
    _searchIndex: -1,

    showSearchReplace: function() {
        var panel = document.getElementById('search-replace-panel');
        panel.style.display = '';
        var input = document.getElementById('sr-search-input');
        input.focus();
        if (input.value) this._doSearch(input.value);
        var self = this;
        input.oninput = function() { self._doSearch(input.value); };
        input.onkeydown = function(e) {
            if (e.key === 'Escape') self.hideSearchReplace();
            else if (e.key === 'Enter') { e.shiftKey ? self.searchPrev() : self.searchNext(); }
        };
    },

    hideSearchReplace: function() {
        document.getElementById('search-replace-panel').style.display = 'none';
        this._searchMatches = [];
        this._searchIndex = -1;
        document.getElementById('sr-count').textContent = '0/0';
    },

    _doSearch: function(query) {
        this._searchMatches = [];
        this._searchIndex = -1;
        if (!query) { document.getElementById('sr-count').textContent = '0/0'; return; }
        var editor = document.getElementById('code-editor');
        var text = editor.value;
        var idx = -1;
        while ((idx = text.indexOf(query, idx + 1)) !== -1) {
            this._searchMatches.push(idx);
        }
        document.getElementById('sr-count').textContent = this._searchMatches.length > 0 ? '0/' + this._searchMatches.length : '0/0';
        if (this._searchMatches.length > 0) this.searchNext();
    },

    searchNext: function() {
        if (this._searchMatches.length === 0) return;
        this._searchIndex = (this._searchIndex + 1) % this._searchMatches.length;
        this._goToMatch();
    },

    searchPrev: function() {
        if (this._searchMatches.length === 0) return;
        this._searchIndex = (this._searchIndex - 1 + this._searchMatches.length) % this._searchMatches.length;
        this._goToMatch();
    },

    _goToMatch: function() {
        var editor = document.getElementById('code-editor');
        var query = document.getElementById('sr-search-input').value;
        var pos = this._searchMatches[this._searchIndex];
        editor.focus();
        editor.setSelectionRange(pos, pos + query.length);
        document.getElementById('sr-count').textContent = (this._searchIndex + 1) + '/' + this._searchMatches.length;
    },

    replaceOne: function() {
        if (this._searchIndex < 0 || this._searchMatches.length === 0) return;
        var editor = document.getElementById('code-editor');
        var query = document.getElementById('sr-search-input').value;
        var replacement = document.getElementById('sr-replace-input').value;
        var pos = this._searchMatches[this._searchIndex];
        editor.value = editor.value.substring(0, pos) + replacement + editor.value.substring(pos + query.length);
        this.updateHighlight();
        this._doSearch(query);
    },

    replaceAll: function() {
        var editor = document.getElementById('code-editor');
        var query = document.getElementById('sr-search-input').value;
        var replacement = document.getElementById('sr-replace-input').value;
        if (!query) return;
        editor.value = editor.value.split(query).join(replacement);
        this.updateHighlight();
        this._doSearch(query);
        this.log('Reemplazados todos: "' + query + '" → "' + replacement + '"');
    },

    // ─── Ln/Col Indicator ───
    updateLnCol: function() {
        var el = document.getElementById('code-editor');
        var indicator = document.getElementById('ln-col-indicator');
        if (!el || !indicator) return;
        var text = el.value.substring(0, el.selectionStart);
        var lines = text.split('\n');
        indicator.textContent = 'Ln ' + lines.length + ', Col ' + (lines[lines.length - 1].length + 1);
    },

    // ─── Lite Mode ───
    toggleLiteMode: function() {
        var isLite = document.body.classList.toggle('lite-mode');
        this._settings.liteMode = isLite;
        this.persistSettings();
        var cb = document.getElementById('lite-mode-toggle');
        if (cb) cb.checked = isLite;
        // Kill/restore picom compositor
        try {
            if (isLite) {
                window.pywebview.api.run_command('killall picom 2>/dev/null; killall compton 2>/dev/null');
            } else {
                window.pywebview.api.run_command('picom --daemon 2>/dev/null || compton --daemon 2>/dev/null');
            }
        } catch(e) {}
        // Force disable highlight repaint in lite mode
        if (isLite) {
            this._liteModeHL = true;
        } else {
            this._liteModeHL = false;
            this.updateHighlight();
        }
        this.log(isLite ? '⚡ Modo Rendimiento activado (picom desactivado, highlighting off)' : '✓ Modo normal restaurado (picom activado)');
    },

    // ─── Multi-terminal ───
    _terminals: [{ id: 0, output: '', history: [], historyIndex: -1 }],
    _activeTerminal: 0,
    _terminalCounter: 0,

    addTerminal: function() {
        this._terminalCounter++;
        var id = this._terminalCounter;
        this._terminals.push({ id: id, output: '', history: [], historyIndex: -1 });
        this.switchTerminal(id);
        this._renderTerminalTabs();
    },

    switchTerminal: function(id) {
        var current = this._terminals.find(function(t) { return t.id === app._activeTerminal; });
        if (current) current.output = document.getElementById('terminal-out').textContent;
        this._activeTerminal = id;
        var target = this._terminals.find(function(t) { return t.id === id; });
        if (target) document.getElementById('terminal-out').textContent = target.output;
        this._renderTerminalTabs();
    },

    closeTerminal: function(id) {
        if (this._terminals.length <= 1) return;
        this._terminals = this._terminals.filter(function(t) { return t.id !== id; });
        if (this._activeTerminal === id) {
            this._activeTerminal = this._terminals[0].id;
            var target = this._terminals[0];
            document.getElementById('terminal-out').textContent = target.output;
        }
        this._renderTerminalTabs();
    },

    _renderTerminalTabs: function() {
        var container = document.getElementById('terminal-tabs');
        if (!container) return;
        var self = this;
        container.innerHTML = '';
        this._terminals.forEach(function(t, i) {
            var tab = document.createElement('button');
            tab.className = 'terminal-tab' + (t.id === self._activeTerminal ? ' active' : '');
            tab.innerHTML = 'Terminal ' + (i + 1) +
                (self._terminals.length > 1 ? ' <button class="term-close" onclick="event.stopPropagation();app.closeTerminal(' + t.id + ')">×</button>' : '');
            tab.onclick = function() { self.switchTerminal(t.id); };
            container.appendChild(tab);
        });
        var addBtn = document.createElement('button');
        addBtn.className = 'terminal-tab-add';
        addBtn.textContent = '+';
        addBtn.title = 'Nueva terminal';
        addBtn.onclick = function() { self.addTerminal(); };
        container.appendChild(addBtn);
    },

    // ─── Minimap ───
    updateMinimap: function() {
        var editor = document.getElementById('code-editor');
        var canvas = document.getElementById('minimap-canvas');
        var viewport = document.getElementById('minimap-viewport');
        if (!editor || !canvas || !viewport) return;
        var ctx = canvas.getContext('2d');
        var lines = editor.value.split('\n');
        canvas.width = 60;
        canvas.height = canvas.parentElement.clientHeight;
        ctx.clearRect(0, 0, 60, canvas.height);
        var lineH = Math.max(1, canvas.height / Math.max(lines.length, 1));
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        lines.forEach(function(line, i) {
            var w = Math.min(55, line.length * 0.5);
            if (w > 0) ctx.fillRect(3, i * lineH, w, Math.max(lineH - 0.5, 0.5));
        });
        var ratio = canvas.height / editor.scrollHeight;
        viewport.style.top = (editor.scrollTop * ratio) + 'px';
        viewport.style.height = (editor.clientHeight * ratio) + 'px';
    },

    minimapClick: function(e) {
        var editor = document.getElementById('code-editor');
        var canvas = document.getElementById('minimap-canvas');
        if (!editor || !canvas) return;
        var rect = canvas.getBoundingClientRect();
        var y = e.clientY - rect.top;
        var ratio = y / rect.height;
        editor.scrollTop = ratio * editor.scrollHeight;
    },

    // ─── Git Diff ───
    showDiff: async function() {
        if (!this.currentProjectPath) { this.log('Abre un proyecto primero', true); return; }
        this.log('Obteniendo diff...');
        var res = await window.pywebview.api.git_diff();
        var container = document.getElementById('diff-content');
        if (!res.success || !res.diff) {
            container.textContent = res.error || 'Sin cambios o no es un repositorio Git';
        } else {
            container.innerHTML = res.diff.split('\n').map(function(line) {
                if (line.startsWith('+') && !line.startsWith('+++')) return '<span class="diff-add">' + app.escapeHtml(line) + '</span>';
                if (line.startsWith('-') && !line.startsWith('---')) return '<span class="diff-del">' + app.escapeHtml(line) + '</span>';
                if (line.startsWith('@@')) return '<span class="diff-hdr">' + app.escapeHtml(line) + '</span>';
                return app.escapeHtml(line);
            }).join('\n');
        }
        document.getElementById('diff-modal').style.display = 'flex';
        app._refreshIcons();
    },

    // ─── Select Next Occurrence (Ctrl+D) ───
    selectNextOccurrence: function() {
        var editor = document.getElementById('code-editor');
        if (!editor) return;
        var selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
        if (!selected) {
            var pos = editor.selectionStart;
            var text = editor.value;
            var start = pos; var end = pos;
            while (start > 0 && /\w/.test(text[start - 1])) start--;
            while (end < text.length && /\w/.test(text[end])) end++;
            editor.setSelectionRange(start, end);
            return;
        }
        var searchFrom = editor.selectionEnd;
        var idx = editor.value.indexOf(selected, searchFrom);
        if (idx === -1) idx = editor.value.indexOf(selected);
        if (idx !== -1) {
            editor.setSelectionRange(idx, idx + selected.length);
            editor.focus();
        }
    },

    // ─── Debug ───
    _debugProcess: null,
    _breakpoints: {},

    toggleBreakpoint: function(line) {
        var file = this.currentFilePath;
        if (!file) return;
        if (!this._breakpoints[file]) this._breakpoints[file] = [];
        var idx = this._breakpoints[file].indexOf(line);
        if (idx === -1) {
            this._breakpoints[file].push(line);
            this.log('Breakpoint añadido: línea ' + line);
        } else {
            this._breakpoints[file].splice(idx, 1);
            this.log('Breakpoint eliminado: línea ' + line);
        }
    },

    startDebug: async function() {
        if (!this.currentProjectPath) { this.log('Abre un proyecto primero', true); return; }
        if (this.currentFilePath) await this.saveFile();
        var mainFile = document.getElementById('run-main-file');
        var mf = (mainFile && mainFile.value) ? mainFile.value : 'main.py';
        document.getElementById('debug-status').textContent = 'Running...';
        document.getElementById('debug-panel').style.display = '';
        this.log('🐛 Debug: ejecutando ' + mf + '...');
        try {
            var cmd = 'cd "' + this.currentProjectPath + '" && python3 -u ' + mf + ' 2>&1';
            var res = await window.pywebview.api.run_command(cmd);
            if (res.success) {
                if (res.stdout) this.log(res.stdout);
                if (res.stderr) this.log(res.stderr, true);
            }
            document.getElementById('debug-status').textContent = 'Finished (code: ' + (res.code || 0) + ')';
        } catch(e) {
            this.log('Debug error: ' + e.message, true);
            document.getElementById('debug-status').textContent = 'Error';
        }
    },

    stopDebug: function() {
        document.getElementById('debug-panel').style.display = 'none';
        document.getElementById('debug-status').textContent = 'Idle';
        this.log('⏹ Debug detenido');
    },

    // ─── Markdown Preview ───
    previewMarkdown: function() {
        if (!this.currentFilePath || !this.currentFilePath.endsWith('.md')) {
            this.log('Abre un archivo .md primero', true);
            return;
        }
        var content = document.getElementById('code-editor').value;
        var html = '<html><head><style>body{font-family:sans-serif;padding:24px;max-width:800px;margin:0 auto;color:#e0e0e0;background:#1c1c1e;line-height:1.6}a{color:#0a84ff}code{background:#2c2c2e;padding:2px 6px;border-radius:4px}pre{background:#2c2c2e;padding:12px;border-radius:8px;overflow-x:auto}h1,h2,h3{border-bottom:1px solid #333;padding-bottom:6px}</style></head><body>' + DEX.parseMarkdown(content) + '</body></html>';
        DEX.openPreviewTab(html);
        this.log('Preview MD abierto');
    },

    searchInProject: async function() {
        const searchInput = document.querySelector('.search-input');
        const query = searchInput ? searchInput.value.trim() : '';
        if (!query) {
            this.log('Escribe algo en el campo de búsqueda', true);
            return;
        }
        if (!this.currentProjectPath) {
            this.log('Abre un proyecto primero para buscar', true);
            return;
        }
        this.log('Buscando: "' + query + '"...');
        try {
            const res = await window.pywebview.api.run_command('grep -rnl "' + query + '" "' + this.currentProjectPath + '" --include="*.py" --include="*.js" --include="*.html" --include="*.css" --include="*.json" --include="*.md" --include="*.txt" 2>/dev/null || echo "Sin resultados"');
            if (res.success && res.stdout) {
                this.log('Resultados:\n' + res.stdout);
            } else {
                this.log('Sin resultados para: "' + query + '"');
            }
        } catch(e) {
            this.log('Error en búsqueda: ' + e.message, true);
        }
    }
};

app.init();
