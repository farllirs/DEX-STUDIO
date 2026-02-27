# DEX STUDIO

<p align="center">
  <img src="./dex-icon.png" alt="DEX STUDIO" width="220" />
</p>

Creador de aplicaciones para Linux con interfaz moderna, editor integrado, terminal y empaquetado.

## Características

- Editor de código con syntax highlighting
- Temas de editor: Oscuro, Claro, Dracula, Nord
- Temas normales de interfaz: Dark, Light, Cyberpunk y extensiones `theme`
- API de UI para extensiones (`DEX.ui`) para modificar botones core sin tocar el código base
- Explorador de archivos con drag and drop
- Terminal integrada
- Plantillas: GUI, CLI, Web, Extensión y En Blanco
- Compilación: `.deb`, `.zip`, `.tar.gz`
- Integración Git/GitHub

## Instalación

### Opción 1: instalador interactivo

```bash
git clone https://github.com/farllirs/DEX-STUDIO.git
cd DEX-STUDIO
bash install.sh
```

### Opción 2: desde código fuente

```bash
git clone https://github.com/farllirs/DEX-STUDIO.git
cd DEX-STUDIO
pip install -r requirements.txt
python3 main.py
```

### Opción 3: paquete `.deb`

```bash
sudo dpkg -i dex-studio_1.0.3.deb
sudo apt-get install -f -y
dex-studio
```

## Estructura

```text
dex-studio/
├── backend/
├── frontend/
├── templates/
├── main.py
├── install.sh
├── build-deb.sh
└── requirements.txt
```

## Documentación de extensiones

La documentación de extensiones está separada en su repositorio dedicado:

- Repositorio: https://github.com/farllirs/DEX-EXTENSIONS
- Registro del Marketplace: https://github.com/farllirs/DEX-EXTENSIONS/blob/main/registry.json
- Guía local incluida en este repo: `templates/extension/GUIA-EXTENSIONES.md`

## Novedades recientes (parche)

- Persistencia de configuraciones corregida (terminal visible, minimap, word-wrap, tab size, límite de historial).
- Sección `Developer` en Configuración para ver/copiar catálogo de IDs de UI.
- Nueva API `DEX.ui.overrideButton`, `DEX.ui.clearButton` y `DEX.ui.listButtons`.
- Sincronización de Marketplace con detección de extensiones no disponibles:
  - Se marca como "Extensión no disponible".
  - Después de un periodo de gracia, se oculta automáticamente.
- Mejoras en publicación/instalación de extensiones `theme` y `ui-theme` con manejo estable de `theme.css`.
- Corrección de regresión del botón principal Ejecutar/Probar al usar overrides de UI.

## Repositorios

- Editor: https://github.com/farllirs/DEX-STUDIO
- Extensiones: https://github.com/farllirs/DEX-EXTENSIONS

## Licencia

MIT
