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

        if (typeof lucide !== 'undefined') lucide.createIcons();
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
    selectedTemplate: 'GUI',
    _extensionsLoaded: false,

    _settings: {},

    init: function() {
        // Defaults — will be overridden by editor-config.json when backend is ready
        this.loadThemes();
        this.log("DEX STUDIO v1.0.0 — Creador de Apps para Linux");
        document.getElementById('breadcrumb-text').textContent = 'Inicio';

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveFile();
            } else if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.createFile();
            } else if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                this.toggleConsole();
            }
            else if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                if (this.currentFilePath) this.closeTab(this.currentFilePath);
            }
            if (e.ctrlKey && e.key === '`') {
                e.preventDefault();
                const ti = document.getElementById('terminal-input');
                if (ti) ti.focus();
            }
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
            }
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

        window.addEventListener('pywebviewready', () => {
            this.log("Motor de Backend conectado");
            this.loadSettingsFromFile();
            this.loadExtensions();
        });

        // Also try loading after a short delay (in case pywebviewready already fired)
        setTimeout(() => {
            if (!this._extensionsLoaded) this.loadExtensions();
            if (!this._settingsLoaded) this.loadSettingsFromFile();
        }, 500);
    },

    loadExtensions: async function() {
        if (this._extensionsLoaded) return;
        try {
            if (!window.pywebview || !window.pywebview.api) return;
            this._extensionsLoaded = true;

            const res = await window.pywebview.api.list_modules();
            if (!res.success || !res.modules) return;

            for (const mod of res.modules) {
                try {
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

                    // Execute extension code
                    new Function(modRes.code)();

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

    updateExtensionsView: function() {
        const container = document.getElementById('installed-extensions');
        if (!container) return;

        const exts = Object.values(DEX.extensions);
        if (exts.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay extensiones instaladas</p>';
            return;
        }

        container.innerHTML = '';
        exts.forEach(ext => {
            const color = ext.color || 'linear-gradient(135deg, #667eea, #764ba2)';
            const card = document.createElement('div');
            card.className = 'extension-card';
            card.innerHTML = `
                <div class="ext-icon" style="background: ${color}">
                    <i data-lucide="${ext.icon || 'puzzle'}"></i>
                </div>
                <div class="ext-info">
                    <h4>${ext.name}</h4>
                    <p>${ext.description || ''}</p>
                </div>
                <span class="ext-badge-active">v${ext.version || '1.0'} ✓</span>
            `;
            container.appendChild(card);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

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
        if (typeof lucide !== 'undefined') lucide.createIcons();

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

        if (typeof lucide !== 'undefined') lucide.createIcons();
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
            lucide.createIcons();
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
                app.showContextMenu(e, item.path);
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

    showContextMenu: function(e, path) {
        this.contextPath = path;
        const menu = document.getElementById('context-menu');
        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
        
        document.addEventListener('click', () => {
            menu.style.display = 'none';
        }, { once: true });
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
                this.renderTabs();
                this.showView('editor');
                this.log('Archivo abierto: ' + path.split('/').pop());
                DEX.updateExtButtons(path);
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
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    selectAndOpenProject: function(name, path) {
        const modal = document.getElementById('project-selector-modal');
        if (modal) modal.remove();

        this.currentProjectPath = path;
        this.expandedFolders = {};
        this.log('Proyecto abierto: ' + name);
        document.getElementById('breadcrumb-text').textContent = name;
        this.refreshExplorer();
        this.showView('editor');
        this.updateRecentProjects(name, path);
        this.updateTerminalPrompt(name);
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
                        this.expandedFolders = {};
                        this.log(`Proyecto abierto: ${p.name}`);
                        document.getElementById('breadcrumb-text').textContent = p.name;
                        this.refreshExplorer();
                        this.showView('editor');
                        this.updateTerminalPrompt(p.name);
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
                        this.expandedFolders = {};
                        this.log(`Proyecto abierto: ${p.name}`);
                        document.getElementById('breadcrumb-text').textContent = p.name;
                        this.refreshExplorer();
                        this.showView('editor');
                        this.updateTerminalPrompt(p.name);
                    };
                    homeContainer.appendChild(btn);
                });
            }
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
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

    runProject: async function() {
        if (!this.currentProjectPath) {
            this.log("Abre un proyecto primero", true);
            return;
        }
        // Save current file before running
        if (this.currentFilePath) await this.saveFile();

        // Check if this is an extension project
        try {
            const metaRes = await window.pywebview.api.read_file(this.currentProjectPath + '/manifest.json');
            if (metaRes.success) {
                // It's an extension project — copy to modules and reload
                const manifest = JSON.parse(metaRes.content);
                const extId = manifest.id || this.currentProjectPath.split('/').pop();
                const modulesDir = this.currentProjectPath.replace(/\/[^/]+$/, '').replace(/DEX_Projects.*/, 'dex-studio/modules');
                
                this.log('▶ Instalando extensión localmente: ' + extId + '...');
                const copyRes = await window.pywebview.api.run_command(
                    'rm -rf ~/dex-studio/modules/' + extId + ' && cp -r "' + this.currentProjectPath + '" ~/dex-studio/modules/' + extId + ' 2>&1'
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

        // Normal project — run main.py
        this.log("▶ Ejecutando proyecto...");
        try {
            const res = await window.pywebview.api.run_command('cd "' + this.currentProjectPath + '" && timeout 30 python3 main.py 2>&1 || true');
            if (res.success) {
                if (res.stdout) this.log(res.stdout);
                if (res.stderr) this.log(res.stderr, true);
                if (res.code === 0) this.log("✓ Ejecución completada");
                else if (res.code === 124) this.log("⚠ Timeout: el proceso tardó más de 30s", true);
                else this.log("⚠ Proceso terminó con código: " + res.code, true);
            } else {
                this.log(res.error || "Error al ejecutar", true);
            }
        } catch(e) {
            this.log("Error: " + e.message, true);
        }
    },

    compileProject: async function() {
        if (!this.currentProjectPath) return;
        this.log("Iniciando motor de empaquetado nativo (.deb)...");
        const res = await window.pywebview.api.compile_project();
        if (res.success) {
            this.log(`ÉXITO: ${res.message}`);
            this.showNotification('Compilación Exitosa', res.message, 'success');
        } else {
            this.log(res.error, true);
            this.showNotification('Error de Compilación', res.error, 'error');
        }
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
        if (typeof lucide !== 'undefined') lucide.createIcons();
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
            }
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
        const token = prompt("Introduce tu token de acceso de GitHub:\n(Crea uno en https://github.com/settings/tokens)");
        if (token) {
            this._settings.github_token = token;
            this.persistSettings();
            this.log("Token de GitHub guardado");
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
        
        const res = await window.pywebview.api.push_to_github(this.currentProjectPath, repoUrl, token);
        
        if (res.success) {
            this.log("Proyecto subido: " + res.message);
        } else {
            this.log(res.error || "Error al subir", true);
        }
    },

    showHelp: function() {
        document.getElementById('help-modal').style.display = 'flex';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        this.log('Ayuda abierta');
    },

    showMoreOptions: function() {
        document.getElementById('options-modal').style.display = 'flex';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    closeModal: function(id) {
        document.getElementById(id).style.display = 'none';
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
        if (typeof lucide !== 'undefined') lucide.createIcons();
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
        try {
            const res = await window.pywebview.api.fetch_extension_registry();
            if (!res.success) { this.log(res.error || 'Error al cargar repositorio', true); return; }
            const registry = res.registry;
            const installedIds = Object.keys(DEX.extensions);
            const container = document.getElementById('available-extensions');
            if (!container) return;
            container.innerHTML = '';

            const allExts = registry.extensions || [];
            if (allExts.length === 0) {
                container.innerHTML = '<p class="empty-state">No hay extensiones disponibles</p>';
                return;
            }

            allExts.forEach(ext => {
                const isInstalled = installedIds.includes(ext.id);
                const card = document.createElement('div');
                card.className = 'extension-card';
                card.style.cursor = 'pointer';
                card.innerHTML = `
                    <div class="ext-icon" style="background: ${ext.color || '#667eea'}">
                        <i data-lucide="${ext.icon || 'puzzle'}"></i>
                    </div>
                    <div class="ext-info">
                        <h4>${ext.name}</h4>
                        <p>${ext.description || ''}</p>
                    </div>
                    ${isInstalled
                        ? '<span class="ext-badge-active">Instalada ✓</span>'
                        : '<button class="btn-primary btn-sm ext-install-btn" data-ext-id="' + ext.id + '"><i data-lucide="download"></i> Instalar</button>'
                    }
                `;
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.ext-install-btn')) return;
                    this.showExtensionDetail(ext, isInstalled);
                });
                const installBtn = card.querySelector('.ext-install-btn');
                if (installBtn) {
                    installBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.installExtension(ext.id);
                    });
                }
                container.appendChild(card);
            });

            if (typeof lucide !== 'undefined') lucide.createIcons();
            this.log('✓ ' + allExts.length + ' extensiones encontradas');
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    showExtensionDetail: async function(ext, isInstalled) {
        const modal = document.getElementById('ext-detail-modal');
        if (!modal) return;

        document.getElementById('ext-detail-name').textContent = ext.name;
        document.getElementById('ext-detail-meta').textContent = `v${ext.version || '1.0.0'} • ${ext.author || 'DEX STUDIO'} • ${ext.category || 'editor'}`;
        document.getElementById('ext-detail-desc').textContent = ext.description || '';

        const iconEl = document.getElementById('ext-detail-icon');
        iconEl.style.background = ext.color || '#667eea';
        iconEl.innerHTML = '<i data-lucide="' + (ext.icon || 'puzzle') + '"></i>';

        const actionsEl = document.getElementById('ext-detail-actions');
        if (isInstalled) {
            actionsEl.innerHTML = '<span class="ext-badge-active" style="font-size:12px;padding:5px 12px">Instalada ✓</span>' +
                '<button class="btn-secondary btn-sm" onclick="app.uninstallExtension(\'' + ext.id + '\')"><i data-lucide="trash-2"></i> Desinstalar</button>';
        } else {
            actionsEl.innerHTML = '<button class="btn-primary btn-sm" onclick="app.installExtension(\'' + ext.id + '\')"><i data-lucide="download"></i> Instalar</button>';
        }

        const readmeEl = document.getElementById('ext-detail-readme');
        readmeEl.innerHTML = '<p class="empty-state">Cargando README...</p>';
        modal.style.display = 'flex';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            const res = await window.pywebview.api.fetch_extension_readme(ext.id);
            if (res.success) {
                readmeEl.textContent = res.content;
            } else {
                readmeEl.innerHTML = '<p class="empty-state">No se encontró README</p>';
            }
        } catch(e) {
            readmeEl.innerHTML = '<p class="empty-state">Error al cargar README</p>';
        }
    },

    installExtension: async function(extId) {
        this.log('Instalando extensión: ' + extId + '...');
        try {
            const res = await window.pywebview.api.install_extension(extId);
            if (res.success) {
                this.log('✓ ' + res.message);
                this.showNotification('Extensión Instalada', res.message, 'success');
                this.closeModal('ext-detail-modal');
                // Reload to activate
                this._extensionsLoaded = false;
                await this.loadExtensions();
                this.openExtRepo();
            } else {
                this.log(res.error || 'Error al instalar', true);
                this.showNotification('Error de Instalación', res.error || 'No se pudo instalar la extensión', 'error');
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    uninstallExtension: async function(extId) {
        if (!confirm('¿Desinstalar extensión "' + extId + '"?')) return;
        try {
            const res = await window.pywebview.api.uninstall_extension(extId);
            if (res.success) {
                this.log('✓ ' + res.message);
                this.showNotification('Extensión Desinstalada', res.message, 'info');
                this.closeModal('ext-detail-modal');
                delete DEX.extensions[extId];
                delete DEX.extensionHandlers[extId];
                this.updateExtensionsView();
                this.openExtRepo();
            } else {
                this.log(res.error || 'Error', true);
            }
        } catch(e) {
            this.log('Error: ' + e.message, true);
        }
    },

    // ─── File Explorer Operations ───

    createFileInFolder: async function(path) {
        if (!path) return;
        const dir = await this._resolveDir(path);
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
        if (!path) return;
        const dir = await this._resolveDir(path);
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

    _resolveDir: async function(path) {
        try {
            const res = await window.pywebview.api.list_directory(path);
            if (res.success) return path;
        } catch(e) {}
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

    updateHighlight: function() {
        var editor = document.getElementById('code-editor');
        var highlight = document.getElementById('code-highlight');
        if (!editor || !highlight) return;
        var code = editor.value;
        var lang = this._hlLang;
        var html = this.highlightCode(code, lang);
        // Add trailing newline so pre height matches textarea
        highlight.innerHTML = html + '\n';
        highlight.scrollTop = editor.scrollTop;
        highlight.scrollLeft = editor.scrollLeft;
    },

    setupEditorHighlighting: function() {
        var editor = document.getElementById('code-editor');
        var highlight = document.getElementById('code-highlight');
        if (!editor || !highlight) return;

        var self = this;
        editor.addEventListener('input', function() { self.updateHighlight(); });
        editor.addEventListener('scroll', function() {
            highlight.scrollTop = editor.scrollTop;
            highlight.scrollLeft = editor.scrollLeft;
        });
        editor.addEventListener('keydown', function(e) {
            // Tab support
            if (e.key === 'Tab') {
                e.preventDefault();
                var start = editor.selectionStart;
                var end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
                self.updateHighlight();
            }
        });
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
