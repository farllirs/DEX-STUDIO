#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  DEX STUDIO — Instalador Interactivo para Linux
# ══════════════════════════════════════════════════════════════

clear
echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║                                              ║"
echo "  ║       🎨  DEX STUDIO — Instalador            ║"
echo "  ║       Creador de Apps para Linux              ║"
echo "  ║                                              ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

VERSION=$(cat "$(dirname "$0")/VERSION.txt" 2>/dev/null || echo "1.0.1")
echo "  Versión: $VERSION"
echo "  ─────────────────────────────────────────"
echo ""

# ── Verificar requisitos ──
echo "  [1/4] Verificando requisitos..."
echo ""

MISSING=""

if ! command -v python3 &>/dev/null; then
    MISSING="$MISSING python3"
fi

if ! python3 -c "import webview" 2>/dev/null; then
    MISSING="$MISSING python3-webview"
fi

if [ -n "$MISSING" ]; then
    echo "  ⚠  Dependencias faltantes:$MISSING"
    echo ""
    read -p "  ¿Instalar dependencias automáticamente? [S/n]: " INSTALL_DEPS
    INSTALL_DEPS=${INSTALL_DEPS:-S}
    if [[ "$INSTALL_DEPS" =~ ^[Ss]$ ]]; then
        echo ""
        echo "  Instalando dependencias..."
        sudo apt-get update -qq
        sudo apt-get install -y python3 python3-pip python3-webview 2>/dev/null
        pip3 install pywebview 2>/dev/null
        echo "  ✅ Dependencias instaladas"
    else
        echo "  ❌ Instalación cancelada. Instala las dependencias manualmente."
        exit 1
    fi
else
    echo "  ✅ Todas las dependencias están instaladas"
fi
echo ""

# ── Elegir directorio de instalación ──
echo "  [2/4] Directorio de instalación"
echo ""
DEFAULT_DIR="/usr/share/dex-studio"
read -p "  Directorio [$DEFAULT_DIR]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}
echo ""

# ── Copiar archivos ──
echo "  [3/4] Instalando archivos..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p "$INSTALL_DIR"
sudo cp -r "$SCRIPT_DIR/backend" "$INSTALL_DIR/"
sudo cp -r "$SCRIPT_DIR/frontend" "$INSTALL_DIR/"
sudo cp -r "$SCRIPT_DIR/templates" "$INSTALL_DIR/"
sudo cp "$SCRIPT_DIR/main.py" "$INSTALL_DIR/"
sudo cp "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"
sudo cp "$SCRIPT_DIR/VERSION.txt" "$INSTALL_DIR/"
sudo cp "$SCRIPT_DIR/dex-icon.png" "$INSTALL_DIR/"
[ -f "$SCRIPT_DIR/editor-config.json" ] && sudo cp "$SCRIPT_DIR/editor-config.json" "$INSTALL_DIR/"

# Crear acceso directo en /usr/bin
sudo bash -c "cat > /usr/bin/dex-studio << 'BINEOF'
#!/bin/bash
cd /usr/share/dex-studio && python3 main.py \"\$@\"
BINEOF"
sudo chmod 755 /usr/bin/dex-studio

# Icono
sudo mkdir -p /usr/share/icons/hicolor/256x256/apps
sudo cp "$SCRIPT_DIR/dex-icon.png" /usr/share/icons/hicolor/256x256/apps/dex-studio.png

# Desktop entry
sudo bash -c 'cat > /usr/share/applications/dex-studio.desktop << DTEOF
[Desktop Entry]
Type=Application
Name=DEX STUDIO
GenericName=IDE para Linux
Comment=Creador de aplicaciones para Linux
Exec=dex-studio
Icon=dex-studio
Terminal=false
Categories=Development;IDE;
Keywords=IDE;editor;development;python;
StartupWMClass=dex-studio
DTEOF'

# Actualizar caches
sudo update-desktop-database /usr/share/applications 2>/dev/null
sudo gtk-update-icon-cache /usr/share/icons/hicolor 2>/dev/null

echo "  ✅ Archivos instalados en: $INSTALL_DIR"
echo ""

# ── Resumen ──
echo "  [4/4] ¡Instalación completada!"
echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║                                              ║"
echo "  ║   ✅  DEX STUDIO instalado correctamente     ║"
echo "  ║                                              ║"
echo "  ║   Ejecutar desde terminal:                   ║"
echo "  ║     \$ dex-studio                             ║"
echo "  ║                                              ║"
echo "  ║   También disponible en el menú de apps      ║"
echo "  ║                                              ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
