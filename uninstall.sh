#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════
#  DEX STUDIO — Desinstalador
# ══════════════════════════════════════════════════════════

set -euo pipefail

APP_NAME="dex-studio"
INSTALL_DIR="/usr/share/dex-studio"
PURGE_USER_DATA=0
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "${1:-}" == "--purge-user-data" ]]; then
  PURGE_USER_DATA=1
fi

echo "══════════════════════════════════════════"
echo "  DEX STUDIO — Desinstalación"
echo "══════════════════════════════════════════"

if ! command -v sudo >/dev/null 2>&1; then
  echo "Error: sudo no está disponible en este sistema."
  exit 1
fi

remove_if_exists() {
  local target="$1"
  # Safety guard: never delete current project/source directory.
  if [[ -n "$target" && "$(realpath -m "$target" 2>/dev/null || echo "$target")" == "$SCRIPT_DIR" ]]; then
    echo "  • Omitido por seguridad: $target"
    return 0
  fi
  if [[ -e "$target" || -L "$target" ]]; then
    sudo rm -rf "$target"
    echo "  • Eliminado: $target"
  fi
}

echo "→ Removiendo paquete del sistema (si existe)..."
if dpkg -s "$APP_NAME" >/dev/null 2>&1; then
  sudo apt-get remove -y "$APP_NAME" >/dev/null 2>&1 || true
fi

echo "→ Limpiando archivos instalados..."
remove_if_exists "/usr/bin/$APP_NAME"
remove_if_exists "$INSTALL_DIR"
remove_if_exists "/usr/share/applications/$APP_NAME.desktop"
remove_if_exists "/usr/share/icons/hicolor/256x256/apps/$APP_NAME.png"
remove_if_exists "/usr/share/icons/hicolor/128x128/apps/$APP_NAME.png"
remove_if_exists "/usr/share/icons/hicolor/64x64/apps/$APP_NAME.png"
remove_if_exists "/usr/share/icons/hicolor/48x48/apps/$APP_NAME.png"
remove_if_exists "/usr/share/icons/hicolor/32x32/apps/$APP_NAME.png"
remove_if_exists "/usr/share/pixmaps/$APP_NAME.png"

echo "→ Limpiando accesos directos de usuario..."
remove_if_exists "$HOME/Desktop/$APP_NAME.desktop"
remove_if_exists "$HOME/Escritorio/$APP_NAME.desktop"
remove_if_exists "$HOME/.local/share/applications/$APP_NAME.desktop"

if [[ "$PURGE_USER_DATA" -eq 1 ]]; then
  echo "→ Borrando datos de usuario..."
  remove_if_exists "$HOME/.dex-studio"
fi

echo "→ Actualizando cachés del sistema..."
sudo update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
sudo gtk-update-icon-cache /usr/share/icons/hicolor >/dev/null 2>&1 || true
command -v xdg-desktop-menu >/dev/null 2>&1 && xdg-desktop-menu forceupdate >/dev/null 2>&1 || true

echo ""
echo "✅ DEX STUDIO desinstalado."
if [[ "$PURGE_USER_DATA" -eq 0 ]]; then
  echo "ℹ️  Datos de usuario conservados en: ~/.dex-studio"
  echo "   Usa: ./uninstall.sh --purge-user-data  para borrarlos también."
fi
echo "══════════════════════════════════════════"
