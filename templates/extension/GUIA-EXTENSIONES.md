# Guía para Crear Extensiones — DEX STUDIO

## Estructura de una Extensión
```
mi-extension/
├── manifest.json    # Metadatos de la extensión
├── main.js          # Código principal (DEBE terminar con "// Dex code successful")
├── README.md        # Documentación
└── GUIA-EXTENSIONES.md
```

## API Disponible (DEX)

### Registrar Extensión
```javascript
DEX.registerExtension(config, handlers)
```

**config**: `{ id, name, version, description, icon, ui_buttons }`
**handlers**: `{ onInit, onFileOpen, onEditorInput, onAction }`

### ui_buttons
```javascript
{ label: 'Texto', icon: 'lucide-icon', action: 'handlerName', fileTypes: ['.py'] }
```

### Funciones útiles
- `DEX.showImageViewer(path)` — Mostrar imagen
- `DEX.openPreviewTab(html)` — Abrir preview HTML
- `DEX.hidePreview()` — Cerrar preview
- `DEX.currentLanguage` — Lenguaje actual del archivo

### Acceso al Editor
```javascript
onEditorInput: function(editor) {
    const code = editor.value;
    const cursor = editor.selectionStart;
}
```

## Publicar en el Marketplace
1. Sube tu extensión a GitHub
2. Agrega entrada en `registry.json` del repo DEX-EXTENSIONS
3. Los usuarios podrán instalarla desde el Marketplace
