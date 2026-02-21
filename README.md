# DEX STUDIO

Creador de Aplicaciones para Linux con interfaz moderna.

## Características

- Editor de código con syntax highlighting (Python, JS, HTML, CSS, JSON, Bash)
- 4 temas de editor (Oscuro, Claro, Dracula, Nord)
- 3 temas de interfaz (Dark, Light, Cyberpunk)
- Explorador de archivos con drag & drop
- Terminal integrada con historial
- Plantillas de proyecto (GUI, CLI, Web, Extensión, En Blanco)
- Marketplace de extensiones con instalación desde GitHub
- API de extensiones expandida (20+ métodos: paneles, hooks, comandos, diálogos)
- Compilación a .deb / .zip / .tar.gz
- Menú Ejecutar con configuración de intérprete y argumentos
- Modo Probar Extensión (instalación temporal sin duplicados)
- Publicar extensiones al marketplace desde el editor
- Integración con Git/GitHub
- Auto-actualización desde GitHub
- Notificaciones tipo VS Code

## Requisitos

- Linux (Debian/Ubuntu/Termux)
- Python 3.8+
- PyWebView (`pip install pywebview`)

## Instalación

### Opción 1: Instalar .deb (recomendado)
```bash
sudo dpkg -i dex-studio_1.0.1.deb
sudo apt-get install -f -y   # Si falta alguna dependencia
dex-studio                    # Ejecutar
```

### Opción 2: Desde código fuente
```bash
git clone https://github.com/farllirs/DEX-STUDIO.git
cd DEX-STUDIO
pip install -r requirements.txt
python3 main.py
```

## Novedades v1.0.1

- Sistema de extensiones mejorado (`extension.dex.js`)
- Detección automática de proyectos de extensión
- Modo "Probar Extensión" temporal
- Publicar extensiones al marketplace desde el editor
- Menú Compilar con .deb / .zip / .tar.gz
- Menú Ejecutar con configuración persistente
- API de extensiones expandida (paneles, hooks, comandos)
- Bug fix: crear archivos/carpetas en el explorador
- Mejoras de rendimiento (debounce en highlighting e íconos)

## Estructura

```
dex-studio/
├── backend/
│   ├── api.py          # API del backend
│   └── packager.py     # Compilador .deb
├── frontend/
│   ├── index.html      # Interfaz principal
│   ├── css/style.css   # Estilos
│   └── js/main.js      # Lógica del frontend
├── templates/          # Plantillas de proyecto
├── main.py             # Punto de entrada
└── requirements.txt
```

## Repositorios

- **Editor:** https://github.com/farllirs/DEX-STUDIO
- **Extensiones:** https://github.com/farllirs/DEX-EXTENSIONS

## Licencia

MIT
