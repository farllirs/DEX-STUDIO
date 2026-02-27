# Guía para Crear Extensiones — DEX STUDIO

## Compatibilidad de temas

| Tipo funcional | `category` | `type` | Estado | Dónde se aplica |
|---|---|---|---|---|
| Tema normal (colores/estilo) | `theme` | vacío u opcional | Estable | Configuración > Apariencia > Tema Normal |
| UI Layout (estructura/disposición) | `ui-theme` | `ui-theme` recomendado | Beta | Configuración > UI Layout (Beta) |
| Compatibilidad legacy UI Layout | `theme` | `ui-theme` | Compatibilidad | Se trata como UI Layout |

## Estructura de una Extensión
```
mi-extension/
├── manifest.json          # Metadatos y configuración de la extensión
├── extension.dex.js       # Código principal (o main.js)
├── theme.css              # (Opcional) CSS para extensiones de tipo UI Theme
├── README.md              # Documentación para el Marketplace
└── GUIA-EXTENSIONES.md    # Esta guía
```

> **Importante:** El archivo principal DEBE terminar con la línea `// Dex code successful`
> para que DEX STUDIO lo reconozca como extensión válida.

---

## manifest.json — Campos Explicados

| Campo         | Requerido | Descripción |
|---------------|-----------|-------------|
| `id`          | ✅ | Identificador único (minúsculas, guiones). Debe coincidir con el nombre de carpeta. |
| `name`        | ✅ | Nombre visible en el Marketplace y gestor de extensiones. |
| `version`     | ✅ | Versión semántica (major.minor.patch). Ej: `1.0.0` |
| `description` | ✅ | Descripción corta (1-2 oraciones). |
| `author`      | ✅ | Nombre del creador. |
| `category`    | ✅ | Categoría: `editor`, `tools`, `language`, `theme`, `ui-theme`, `productivity`, `debug` |
| `icon`        | ❌ | Nombre de ícono Lucide (ej: `puzzle`, `palette`, `zap`). Default: `puzzle` |
| `color`       | ❌ | Gradiente CSS para la tarjeta del Marketplace. |
| `type`        | ❌ | Usar `"ui-theme"` para temas de interfaz completa. |
| `colors`      | ❌ | Objeto con colores de preview: `{ "background": "#1e1e2e", "accent": "#89b4fa" }` |
| `files`       | ❌ | Array de archivos adicionales para incluir al publicar. |

---

## API DEX — Referencia Completa

### Registrar Extensión
```javascript
DEX.registerExtension(config, handlers)
```

**config** (objeto de configuración):
```javascript
{
    id: 'mi-extension',           // Debe coincidir con manifest.json
    name: 'Mi Extensión',
    version: '1.0.0',
    description: 'Descripción',
    icon: 'puzzle',               // Ícono Lucide
    ui_buttons: [...],            // Botones en toolbar (opcional)
    ui_statusbar: [...],          // Items en barra de estado (opcional)
    ui_panels: [...]              // Paneles laterales (opcional)
}
```

### Elementos de UI

#### Botones en Toolbar
```javascript
ui_buttons: [
    {
        label: 'Mi Botón',        // Texto del botón
        icon: 'zap',              // Ícono Lucide
        action: 'onMyAction',     // Nombre del handler a ejecutar
        fileTypes: ['.py', '.js'] // Solo mostrar para estos tipos (opcional)
    }
]
```

#### Items en Barra de Estado
```javascript
ui_statusbar: [
    { text: 'Estado', icon: 'info', action: 'onStatusClick' }
]
```

#### Paneles Laterales
```javascript
ui_panels: [
    { id: 'mi-panel', title: 'Mi Panel', icon: 'layout', position: 'right' }
]
```

### Handlers (Eventos del Ciclo de Vida)

| Handler          | Evento         | Parámetros           | Descripción |
|------------------|----------------|----------------------|-------------|
| `onInit`         | —              | ninguno              | Se ejecuta una vez al cargar la extensión |
| `onFileOpen`     | `fileOpen`     | `(path, ext)`        | Al abrir un archivo. Retornar `true` si la extensión lo maneja |
| `onFileSave`     | `fileSave`     | `(path)`             | Después de guardar un archivo |
| `onFileClose`    | `fileClose`    | `(path)`             | Al cerrar una pestaña |
| `onProjectOpen`  | `projectOpen`  | `(projectPath)`      | Al abrir un proyecto |
| `onEditorInput`  | —              | `(editor)`           | En cada pulsación de tecla en el editor |

### Funciones del SDK

| Función                            | Descripción |
|------------------------------------|-------------|
| `DEX.showImageViewer(path)`        | Abrir el visor de imágenes integrado |
| `DEX.openPreviewTab(html)`         | Abrir una pestaña de preview HTML |
| `DEX.hidePreview()`                | Cerrar la pestaña de preview |
| `DEX.currentLanguage`              | Lenguaje actual del archivo (ej: `'python'`) |
| `DEX.showNotification(msg, type)`  | Mostrar notificación toast (`'success'`, `'error'`, `'info'`) |

### Acceso al Editor
```javascript
onEditorInput: function(editor) {
    const code = editor.value;               // Contenido completo
    const cursor = editor.selectionStart;    // Posición del cursor
    const selected = editor.value.substring( // Texto seleccionado
        editor.selectionStart,
        editor.selectionEnd
    );
}
```

---

## Crear una Extensión de Tema Normal (`theme`)

Las extensiones de tipo `theme` cambian colores y estilo visual general.

### 1. Configurar manifest.json
```json
{
    "id": "mi-tema-oscuro",
    "name": "Mi Tema Oscuro",
    "version": "1.0.0",
    "description": "Un tema oscuro personalizado para DEX STUDIO",
    "author": "Tu Nombre",
    "category": "theme",
    "icon": "palette",
    "color": "linear-gradient(135deg, #1e1e2e, #313244)",
    "colors": {
        "background": "#1e1e2e",
        "foreground": "#cdd6f4",
        "accent": "#89b4fa",
        "sidebar": "#181825",
        "toolbar": "#313244"
    }
}
```

### 2. Crear `theme.css`
```css
/* theme.css — Variables CSS que DEX STUDIO aplica a la interfaz */
:root {
    --bg-primary: #1e1e2e;
    --bg-secondary: #313244;
    --bg-sidebar: #181825;
    --text-primary: #cdd6f4;
    --text-secondary: #a6adc8;
    --accent: #89b4fa;
    --accent-hover: #74c7ec;
    --border-color: #45475a;
    --button-bg: #45475a;
    --button-hover: #585b70;
    --tab-active: #313244;
    --tab-inactive: #1e1e2e;
    --scrollbar-thumb: #45475a;
    --terminal-bg: #11111b;
}
```

### 3. El archivo `extension.dex.js` es opcional para temas puros
Si el tema solo aplica CSS, puedes usar un `extension.dex.js` mínimo:
```javascript
DEX.registerExtension({
    id: 'mi-tema-oscuro',
    name: 'Mi Tema Oscuro',
    version: '1.0.0',
    description: 'Tema oscuro personalizado',
    icon: 'palette'
}, {
    onInit: function() {
        console.log('Tema Mi Tema Oscuro cargado');
    }
});
// Dex code successful
```

---

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| Extensión no carga | Falta `// Dex code successful` al final | Agregar la línea exacta al final del archivo JS |
| Botón no aparece | `action` no coincide con nombre del handler | Verificar que el string en `action` es idéntico al nombre de la función |
| `id` no reconocido | `id` en manifest ≠ `id` en registerExtension | Usar el mismo identificador en ambos archivos |
| Editor se congela | Código pesado en `onEditorInput` | Usar debounce o limitar la frecuencia de ejecución |
| Tema no se aplica | Falta `theme.css` o categoría incorrecta | Para tema normal usar `category: "theme"`; para layout usar `category: "ui-theme"` |

---

## Publicar en el Marketplace
1. Sube tu extensión a un repositorio de GitHub
2. Desde DEX STUDIO, usa la opción "Publicar Extensión" con tu token de GitHub
3. La extensión se registra automáticamente en el Marketplace
4. Los usuarios pueden instalarla buscando en el Marketplace integrado
