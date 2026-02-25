# DEX STUDIO

Creador de Aplicaciones para Linux con interfaz moderna.

## Características

- Editor de código con syntax highlighting (Python, JS, HTML, CSS, JSON, Bash)
- 4 temas de editor (Oscuro, Claro, Dracula, Nord)
- 3 temas de interfaz (Dark, Light, Cyberpunk)
- Explorador de archivos con drag & drop
- Terminal integrada multi-tab con historial
- Plantillas de proyecto (GUI, CLI, Web, Extensión, En Blanco)
- Marketplace de extensiones estilo VS Code con búsqueda y estadísticas
- Sistema de extensiones v2 con activar/desactivar, desinstalar y multi-archivo
- DEX Extension SDK (40+ métodos: paneles, eventos, diálogos, Python, HTTP)
- Compilación a .deb / .zip / .tar.gz
- Modo Probar Extensión (instalación temporal)
- Publicar extensiones a tu propio repo de GitHub
- Base de datos SQLite para gestión de extensiones
- Integración con Git/GitHub
- Token de GitHub persistente y seguro
- Auto-actualización desde GitHub
- Notificaciones tipo VS Code
- Sidebar con iconos estilo VS Code
- Command Palette (Ctrl+Shift+P)
- Buscar y Reemplazar (Ctrl+F / Ctrl+H)
- Minimap del código
- Git Diff visual
- Modo Rendimiento (Lite Mode)

## Requisitos

- Linux (Debian/Ubuntu/Termux)
- Python 3.8+
- PyWebView (`pip install pywebview`)

## Instalación

### Opción 1: Instalador interactivo
```bash
git clone https://github.com/farllirs/DEX-STUDIO.git
cd DEX-STUDIO
bash install.sh
```

### Opción 2: Desde código fuente
```bash
git clone https://github.com/farllirs/DEX-STUDIO.git
cd DEX-STUDIO
pip install -r requirements.txt
python3 main.py
```

### Opción 3: Instalar .deb
```bash
sudo dpkg -i dex-studio_1.0.2.deb
sudo apt-get install -f -y
dex-studio
```

### Generar .deb
```bash
bash build-deb.sh
```

## Novedades v1.0.2

- **Extensiones estilo VS Code** — Panel rediseñado con pestañas Instaladas/Marketplace, búsqueda global, estado en tiempo real
- **Activar/Desactivar extensiones** — Sin necesidad de desinstalar; toggle rápido con reinicio
- **Detección de estado real** — Las extensiones instaladas se verifican contra el disco, no solo la DB
- **Sidebar con iconos** — Navegación compacta tipo VS Code con tooltips
- **Modal mejorado** — Botón cerrar (X) arreglado, README renderizado con Markdown
- **Instalador interactivo** — `install.sh` guía paso a paso con verificación de dependencias
- **Generador .deb** — `build-deb.sh` empaqueta DEX STUDIO listo para distribución
- **Icono de ventana** — Se muestra el icono de DEX Studio en la barra de título
- **DevTools desactivado** — Eliminado el lag al inicio causado por el inspector automático

## Sistema de Extensiones v2

Las extensiones se almacenan en `~/.dex-studio/extensions/` y se gestionan con una base de datos SQLite local.

### Publicar una extensión

1. Crea un proyecto de tipo "Extensión" en DEX STUDIO
2. Escribe tu extensión con `manifest.json` + `main.js`
3. Click en Compilar → Publicar Extensión
4. Elige: usar un repo existente o crear uno nuevo en tu cuenta de GitHub
5. Los archivos se suben a **tu repositorio** (no necesitas permisos especiales)

### Instalar extensiones

1. Ve a la sección Extensiones → Marketplace
2. Busca por nombre, descripción o autor
3. Click en "Instalar"

### Gestionar extensiones

- **Activar/Desactivar** — Botón ⏸/▶ en cada extensión instalada
- **Desinstalar** — Botón 🗑 elimina archivos y registro
- **Estados** — ● Activa (azul), ● Instalada (verde), ⏸ Desactivada (gris)

### DEX Extension SDK

```javascript
// Filesystem
DEX.fs.readFile(path)
DEX.fs.writeFile(path, content)
DEX.fs.listDir(path)
DEX.fs.createFile(path) / DEX.fs.createDir(path)
DEX.fs.delete(path) / DEX.fs.rename(old, new)
DEX.fs.exists(path)

// Editor
DEX.editor.getContent() / DEX.editor.setContent(text)
DEX.editor.getSelection() / DEX.editor.replaceSelection(text)
DEX.editor.insertAtCursor(text) / DEX.editor.getCursor()

// Events
DEX.events.on(event, callback)    // fileOpen, fileSave, fileClose, projectOpen
DEX.events.off(event, callback)
DEX.events.emit(event, data)

// UI
DEX.ui.showToast(msg, type, duration)
DEX.ui.createStatusBarItem(id, text) / DEX.ui.updateStatusBarItem(id, text)
DEX.ui.addContextMenuItem(label, icon, callback)

// Dialogs
DEX.dialog.alert(msg) / DEX.dialog.confirm(msg)
DEX.dialog.prompt(title, placeholder) / DEX.dialog.select(title, options)

// Project
DEX.project.getPath() / DEX.project.getName()
DEX.project.getOpenFiles() / DEX.project.getCurrentFile()
DEX.project.getLanguage() / DEX.project.isExtension()

// Multi-archivo (v2)
DEX.require(extId, 'utils.js')        // Cargar módulos JS/JSON
DEX.python.run(extId, 'script.py')    // Ejecutar Python
DEX.extFiles.list(extId)              // Listar archivos de la extensión
DEX.extFiles.read(extId, path)        // Leer archivo
DEX.extFiles.write(extId, path, data) // Escribir archivo

// Otros
DEX.shell.exec(cmd)
DEX.clipboard.write(text) / DEX.clipboard.read()
DEX.http.fetch(url, options)
DEX.storage.forExtension(id).get(key) / .set(key, value)
DEX.registerKeybind(combo, callback)
DEX.registerSnippet(trigger, language, content)
```

## Estructura del Editor

```
dex-studio/
├── backend/
│   ├── api.py              # API principal PyWebView
│   ├── extensions_db.py    # Gestor SQLite de extensiones
│   └── packager.py         # Compilador .deb
├── frontend/
│   ├── index.html          # Interfaz principal
│   ├── css/style.css       # Estilos
│   └── js/main.js          # Lógica + DEX SDK
├── templates/              # Plantillas de proyecto
├── main.py                 # Punto de entrada
├── build-deb.sh            # Generador de .deb
├── install.sh              # Instalador interactivo
└── requirements.txt
```

Datos persistentes en `~/.dex-studio/`:
- `extensions/` — Extensiones instaladas
- `extensions.db` — Base de datos SQLite
- `github_token` — Token de GitHub (chmod 600)

## Repositorios

- **Editor:** https://github.com/farllirs/DEX-STUDIO
- **Extensiones:** https://github.com/farllirs/DEX-EXTENSIONS

## Licencia

MIT
