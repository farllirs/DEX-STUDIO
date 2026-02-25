#!/bin/bash
# ══════════════════════════════════════════════════════════
#  DEX STUDIO — Generador de paquete .deb
# ══════════════════════════════════════════════════════════

set -e

APP_NAME="dex-studio"
VERSION=$(cat VERSION.txt 2>/dev/null || echo "1.0.1")
ARCH="all"
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$BASE_DIR/build/${APP_NAME}_${VERSION}"

echo "══════════════════════════════════════════"
echo "  DEX STUDIO — Empaquetando v${VERSION}"
echo "══════════════════════════════════════════"

# Limpiar build anterior
rm -rf "$BUILD_DIR"
mkdir -p "$BASE_DIR/build"

# Crear estructura .deb
mkdir -p "$BUILD_DIR/DEBIAN"
mkdir -p "$BUILD_DIR/usr/share/$APP_NAME"
mkdir -p "$BUILD_DIR/usr/share/applications"
mkdir -p "$BUILD_DIR/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$BUILD_DIR/usr/bin"

# ── DEBIAN/control ──
cat > "$BUILD_DIR/DEBIAN/control" << EOF
Package: $APP_NAME
Version: $VERSION
Section: devel
Priority: optional
Architecture: $ARCH
Depends: python3, python3-webview
Maintainer: DEX STUDIO Team
Description: IDE y creador de aplicaciones para Linux
 DEX STUDIO es un entorno de desarrollo integrado ligero
 para crear aplicaciones de escritorio en Linux con Python,
 HTML, CSS y JavaScript.
EOF

# ── Copiar archivos de la aplicación ──
echo "Copiando archivos..."
cp -r "$BASE_DIR/backend" "$BUILD_DIR/usr/share/$APP_NAME/"
cp -r "$BASE_DIR/frontend" "$BUILD_DIR/usr/share/$APP_NAME/"
cp -r "$BASE_DIR/templates" "$BUILD_DIR/usr/share/$APP_NAME/"
cp "$BASE_DIR/main.py" "$BUILD_DIR/usr/share/$APP_NAME/"
cp "$BASE_DIR/requirements.txt" "$BUILD_DIR/usr/share/$APP_NAME/"
cp "$BASE_DIR/VERSION.txt" "$BUILD_DIR/usr/share/$APP_NAME/"
cp "$BASE_DIR/dex-icon.png" "$BUILD_DIR/usr/share/$APP_NAME/"
[ -f "$BASE_DIR/editor-config.json" ] && cp "$BASE_DIR/editor-config.json" "$BUILD_DIR/usr/share/$APP_NAME/"

# ── Icono ──
cp "$BASE_DIR/dex-icon.png" "$BUILD_DIR/usr/share/icons/hicolor/256x256/apps/$APP_NAME.png"

# ── Wrapper ejecutable ──
cat > "$BUILD_DIR/usr/bin/$APP_NAME" << 'WRAPPER'
#!/bin/bash
cd /usr/share/dex-studio && python3 main.py "$@"
WRAPPER
chmod 755 "$BUILD_DIR/usr/bin/$APP_NAME"

# ── Desktop entry ──
cat > "$BUILD_DIR/usr/share/applications/$APP_NAME.desktop" << EOF
[Desktop Entry]
Type=Application
Name=DEX STUDIO
GenericName=IDE para Linux
Comment=Creador de aplicaciones para Linux
Exec=$APP_NAME
Icon=$APP_NAME
Terminal=false
Categories=Development;IDE;
Keywords=IDE;editor;development;python;
StartupWMClass=dex-studio
EOF

# ── Limpiar archivos innecesarios ──
find "$BUILD_DIR/usr/share/$APP_NAME" -name "*.pyc" -delete 2>/dev/null
find "$BUILD_DIR/usr/share/$APP_NAME" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
find "$BUILD_DIR/usr/share/$APP_NAME" -name ".git" -type d -exec rm -rf {} + 2>/dev/null
rm -f "$BUILD_DIR/usr/share/$APP_NAME/"*.deb 2>/dev/null

# ── Construir .deb ──
echo "Construyendo paquete .deb..."
DEB_PATH="$BASE_DIR/build/${APP_NAME}_${VERSION}.deb"
dpkg-deb --build "$BUILD_DIR" "$DEB_PATH"

# ── Limpiar directorio temporal ──
rm -rf "$BUILD_DIR"

echo ""
echo "✅ Paquete creado: $DEB_PATH"
echo "   Tamaño: $(du -h "$DEB_PATH" | cut -f1)"
echo ""
echo "Para instalar:"
echo "  sudo dpkg -i $DEB_PATH"
echo "  sudo apt-get install -f  # si faltan dependencias"
echo "══════════════════════════════════════════"
