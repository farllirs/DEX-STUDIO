# {{APP_NAME}}

{{DESCRIPTION}}

## Author
{{CREATOR}}

## Version
{{VERSION}}

## Installation

### From the Marketplace (recommended)
1. Open DEX STUDIO
2. Go to the Extensions Marketplace (puzzle icon in the sidebar)
3. Search for "{{APP_NAME}}"
4. Click "Install"

### Manual installation
1. Copy this folder to `~/.dex-studio/extensions/`
2. Restart DEX STUDIO
3. The extension will load automatically

## Development

### Project structure
```
{{IDENTIFIER}}/
├── manifest.json          # Extension metadata and configuration
├── extension.dex.js       # Main extension code
├── theme.css              # (Optional) UI theme stylesheet
├── README.md              # This file
└── GUIA-EXTENSIONES.md    # Development guide (Spanish)
```

### Key files
- **manifest.json** — Defines id, name, version, category, icon, and color. Must have a unique `id` that matches the folder name.
- **extension.dex.js** — Contains the `DEX.registerExtension()` call with config and handlers. Must end with `// Dex code successful`.
- **theme.css** — (Optional) CSS variables for UI theme extensions. Only needed if `category` is `"theme"` or `type` is `"ui-theme"`.

### DEX SDK quick reference
```javascript
DEX.showImageViewer(path)        // Open image viewer
DEX.openPreviewTab(html)         // Open HTML preview tab
DEX.hidePreview()                // Close preview tab
DEX.currentLanguage              // Current file language
DEX.showNotification(msg, type)  // Show toast: 'success' | 'error' | 'info'
```

### Events
| Event         | Handler          | Description                    |
|---------------|------------------|--------------------------------|
| File opened   | `onFileOpen`     | Fires when a file is opened    |
| File saved    | `onFileSave`     | Fires after a file is saved    |
| File closed   | `onFileClose`    | Fires when a tab is closed     |
| Project open  | `onProjectOpen`  | Fires when a project is opened |
| Keystroke     | `onEditorInput`  | Fires on every editor input    |

## License
MIT
