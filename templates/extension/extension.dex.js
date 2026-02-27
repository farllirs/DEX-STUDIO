// ============================================================================
// {{APP_NAME}} — Extension for DEX STUDIO
// Created by {{CREATOR}}
// Version: {{VERSION}}
// ============================================================================
//
// HOW EXTENSIONS WORK:
// Extensions are loaded automatically from ~/.dex-studio/extensions/{id}/
// Each extension must call DEX.registerExtension() with a config object
// and a handlers object. The file MUST end with "// Dex code successful".
//
// ============================================================================

DEX.registerExtension({
    // ── Config Object ─────────────────────────────────────────────────
    // id:          Must match "id" in manifest.json
    // name:        Display name (can contain spaces)
    // version:     Should match manifest.json version
    // description: Brief description of what the extension does
    // icon:        Lucide icon name (see https://lucide.dev/icons)

    id: '{{IDENTIFIER}}',
    name: '{{APP_NAME}}',
    version: '{{VERSION}}',
    description: '{{DESCRIPTION}}',
    icon: '{{EXT_ICON}}',

    // ── UI Buttons ────────────────────────────────────────────────────
    // Add buttons to the editor toolbar. Each button needs:
    //   label:     Button text
    //   icon:      Lucide icon name
    //   action:    Handler function name (defined below)
    //   fileTypes: Array of file extensions to show the button for (optional)
    //              If omitted, the button shows for all file types.
    //
    // Example:
    //   { label: 'Format', icon: 'wand', action: 'onFormat', fileTypes: ['.py', '.js'] }
    //   { label: 'Preview', icon: 'eye', action: 'onPreview', fileTypes: ['.html', '.md'] }

    ui_buttons: [
        // { label: 'My Action', icon: 'zap', action: 'onAction', fileTypes: ['.py', '.js'] }
    ]

    // ── Status Bar Items (optional) ───────────────────────────────────
    // Add items to the bottom status bar:
    //   ui_statusbar: [
    //       { text: 'My Extension', icon: 'info', action: 'onStatusClick' }
    //   ]

    // ── Panels (optional) ─────────────────────────────────────────────
    // Register a side panel:
    //   ui_panels: [
    //       { id: 'my-panel', title: 'My Panel', icon: 'layout', position: 'right' }
    //   ]

}, {
    // ── Handler Functions ──────────────────────────────────────────────
    // These are the lifecycle and action handlers for your extension.

    // ── onInit ────────────────────────────────────────────────────────
    // Called once when the extension loads. Use for setup, registering
    // listeners, or initializing state.
    onInit: function() {
        console.log('{{APP_NAME}} initialized');
    },

    // ── onFileOpen (event: fileOpen) ──────────────────────────────────
    // Called when a file is opened in the editor.
    //   path: Full file path (e.g. '/home/user/project/main.py')
    //   ext:  File extension (e.g. '.py')
    // Return true if your extension handles/claims this file type.
    onFileOpen: function(path, ext) {
        return false;
    },

    // ── onFileSave (event: fileSave) ──────────────────────────────────
    // Called after a file is saved. Useful for auto-formatting, linting,
    // or triggering builds.
    //   path: Full path of the saved file
    // onFileSave: function(path) {
    //     console.log('File saved:', path);
    // },

    // ── onFileClose (event: fileClose) ────────────────────────────────
    // Called when a file tab is closed.
    //   path: Full path of the closed file
    // onFileClose: function(path) {
    //     console.log('File closed:', path);
    // },

    // ── onProjectOpen (event: projectOpen) ────────────────────────────
    // Called when a project folder is opened.
    //   projectPath: Root path of the opened project
    // onProjectOpen: function(projectPath) {
    //     console.log('Project opened:', projectPath);
    // },

    // ── onEditorInput ─────────────────────────────────────────────────
    // Called every time the user types in the editor. Use sparingly —
    // this fires on every keystroke.
    //   editor: The textarea DOM element. Access content with editor.value,
    //           cursor position with editor.selectionStart.
    onEditorInput: function(editor) {
        // const code = editor.value;
        // const cursor = editor.selectionStart;
    },

    // ── onAction ──────────────────────────────────────────────────────
    // Custom action triggered by ui_buttons. The action name in the button
    // config must match this function name.
    onAction: function() {
        console.log('Action executed');
    }

    // ── DEX SDK — Key Methods ─────────────────────────────────────────
    //
    // DEX.showImageViewer(path)       — Open the built-in image viewer
    // DEX.openPreviewTab(html)        — Open an HTML preview tab
    // DEX.hidePreview()               — Close the preview tab
    // DEX.currentLanguage             — Current file's language (e.g. 'python')
    // DEX.showNotification(msg, type) — Show a toast notification
    //                                   type: 'success' | 'error' | 'info'
    //
    // ── Common Errors to Avoid ────────────────────────────────────────
    //
    // 1. Missing "// Dex code successful" at the end of this file
    //    → Extension will NOT load without this marker line.
    //
    // 2. Mismatched id between manifest.json and registerExtension()
    //    → The extension won't be recognized properly.
    //
    // 3. Referencing an action name in ui_buttons that doesn't exist
    //    as a handler function → Button click will silently fail.
    //
    // 4. Heavy computation in onEditorInput without debouncing
    //    → Will freeze the editor on every keystroke.
    //
    // 5. Forgetting to return true in onFileOpen for handled file types
    //    → DEX won't know your extension claims that file type.
    //
});

// Dex code successful
