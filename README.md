# DEX STUDIO

Creador de Aplicaciones para Linux con interfaz moderna.

## Características

- Editor de código con syntax highlighting (Python, JS, HTML, CSS, JSON, Bash)
- 4 temas de editor (Oscuro, Claro, Dracula, Nord)
- 3 temas de interfaz (Dark, Light, Cyberpunk)
- Explorador de archivos con drag & drop
- Terminal integrada
- Plantillas de proyecto (GUI, CLI, Web, Extensión, En Blanco)
- Marketplace de extensiones
- Compilación a .deb con instalación automática
- Integración con Git/GitHub
- Auto-actualización desde GitHub
- Notificaciones tipo VS Code

## Requisitos

- Linux (Debian/Ubuntu)
- Python 3.8+
- PyWebView (`pip install pywebview`)

## Instalación

```bash
git clone https://github.com/farllirs/DEX-STUDIO.git
cd DEX-STUDIO
pip install -r requirements.txt
python3 main.py
```

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
├── modules/            # Extensiones instaladas
├── templates/          # Plantillas de proyecto
├── main.py             # Punto de entrada
└── requirements.txt
```

## Licencia

MIT
