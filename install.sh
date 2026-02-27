#!/usr/bin/env bash
# DEX STUDIO - Instalador mejorado

# Re-ejecutar en bash si fue lanzado con sh
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(cat "$SCRIPT_DIR/VERSION.txt" 2>/dev/null || echo "1.0.3")"

if [ -t 1 ]; then
  RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m"
  RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; BLUE="\033[34m"; CYAN="\033[36m"; WHITE="\033[97m"
else
  RESET=""; BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN=""; WHITE=""
fi

ok() { echo -e "${GREEN}${BOLD}✔${RESET} $*"; }
info() { echo -e "${CYAN}${BOLD}→${RESET} $*"; }
warn() { echo -e "${YELLOW}${BOLD}⚠${RESET} $*"; }
fail() { echo -e "${RED}${BOLD}✖${RESET} $*"; }
divider() { echo -e "${DIM}────────────────────────────────────────────────────────${RESET}"; }

trap 'echo; fail "Instalación interrumpida."; exit 1' INT TERM

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    fail "Comando requerido no encontrado: $1"
    exit 1
  }
}

run_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

ask_yes_no() {
  local prompt="$1"
  local default="${2:-Y}" ans
  if [ "$default" = "Y" ]; then
    read -r -p "$(echo -e "${CYAN}❯${RESET} ${prompt} [Y/n]: ")" ans
    ans="${ans:-Y}"
  else
    read -r -p "$(echo -e "${CYAN}❯${RESET} ${prompt} [y/N]: ")" ans
    ans="${ans:-N}"
  fi
  case "$ans" in
    Y|y|S|s|SI|Si|si) return 0 ;;
    *) return 1 ;;
  esac
}

print_header() {
  clear 2>/dev/null || true
  echo
  echo -e "${BOLD}${BLUE}DEX STUDIO${RESET} ${DIM}v${VERSION}${RESET}"
  echo -e "${DIM}Instalador para Linux${RESET}"
  divider
}

check_base_tools() {
  need_cmd cp
  need_cmd mkdir
  need_cmd tee
  need_cmd chmod
  need_cmd python3
}

python_has_webview() {
  python3 - <<'PY' >/dev/null 2>&1
import webview
print(webview.__version__)
PY
}

install_dependencies() {
  local can_apt=0
  command -v apt-get >/dev/null 2>&1 && can_apt=1

  local missing=()
  command -v python3 >/dev/null 2>&1 || missing+=("python3")
  command -v pip3 >/dev/null 2>&1 || missing+=("python3-pip")
  python_has_webview || missing+=("python3-webview")

  if [ ${#missing[@]} -eq 0 ]; then
    ok "Dependencias Python detectadas correctamente"
    return 0
  fi

  warn "Dependencias faltantes: ${missing[*]}"
  if ! ask_yes_no "¿Instalar dependencias automáticamente?" "Y"; then
    fail "Instalación cancelada por dependencias faltantes"
    return 1
  fi

  if [ "$can_apt" -eq 1 ]; then
    info "Actualizando repositorios (apt)..."
    run_root apt-get update -y >/dev/null 2>&1 || warn "No se pudo actualizar apt (continuando)"

    info "Instalando paquetes del sistema..."
    run_root apt-get install -y python3 python3-pip >/dev/null 2>&1 || {
      fail "No se pudieron instalar python3/python3-pip"
      return 1
    }

    # Intento de paquete del sistema para pywebview
    run_root apt-get install -y python3-webview >/dev/null 2>&1 || true
  else
    warn "apt-get no disponible; se usará pip para dependencias Python"
  fi

  if ! python_has_webview; then
    info "Instalando pywebview con pip..."
    python3 -m pip install --user pywebview >/dev/null 2>&1 || python3 -m pip install pywebview >/dev/null 2>&1 || {
      fail "No se pudo instalar pywebview"
      return 1
    }
  fi

  python_has_webview || {
    fail "pywebview sigue sin estar disponible tras instalación"
    return 1
  }

  ok "Dependencias instaladas correctamente"
}

copy_project_files() {
  local install_dir="$1"

  info "Creando directorio de instalación: $install_dir"
  run_root mkdir -p "$install_dir"

  local folders=(backend frontend templates)
  local f
  for f in "${folders[@]}"; do
    if [ ! -d "$SCRIPT_DIR/$f" ]; then
      fail "No se encontró carpeta requerida: $f"
      return 1
    fi
    run_root rm -rf "$install_dir/$f"
    run_root cp -a "$SCRIPT_DIR/$f" "$install_dir/"
  done

  local files=(main.py requirements.txt VERSION.txt dex-icon.png)
  for f in "${files[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$f" ]; then
      fail "No se encontró archivo requerido: $f"
      return 1
    fi
    run_root cp -f "$SCRIPT_DIR/$f" "$install_dir/"
  done

  [ -f "$SCRIPT_DIR/run.sh" ] && run_root cp -f "$SCRIPT_DIR/run.sh" "$install_dir/"
  [ -f "$SCRIPT_DIR/editor-config.json" ] && run_root cp -f "$SCRIPT_DIR/editor-config.json" "$install_dir/"

  ok "Archivos del proyecto copiados"
}

install_launcher() {
  local install_dir="$1"

  info "Creando lanzador /usr/bin/dex-studio"
  run_root tee /usr/bin/dex-studio >/dev/null <<EOF
#!/usr/bin/env bash
set -e
cd "$install_dir"
if [ -x ./run.sh ]; then
  exec bash ./run.sh "\$@"
fi
exec python3 main.py "\$@"
EOF
  run_root chmod 755 /usr/bin/dex-studio
  ok "Lanzador instalado"
}

install_desktop_files() {
  local install_dir="$1"

  info "Instalando icono y entrada de escritorio"
  run_root mkdir -p /usr/share/icons/hicolor/256x256/apps
  run_root cp -f "$install_dir/dex-icon.png" /usr/share/icons/hicolor/256x256/apps/dex-studio.png

  run_root tee /usr/share/applications/dex-studio.desktop >/dev/null <<EOF
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
X-Author=farllirs/dex
EOF

  run_root update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
  run_root gtk-update-icon-cache /usr/share/icons/hicolor >/dev/null 2>&1 || true

  ok "Entrada de aplicación instalada"

  local desktop_dir="$HOME/Desktop"
  [ -d "$HOME/Escritorio" ] && desktop_dir="$HOME/Escritorio"
  if [ -d "$desktop_dir" ]; then
    cp -f /usr/share/applications/dex-studio.desktop "$desktop_dir/dex-studio.desktop" 2>/dev/null || true
    chmod +x "$desktop_dir/dex-studio.desktop" 2>/dev/null || true
    command -v gio >/dev/null 2>&1 && gio set "$desktop_dir/dex-studio.desktop" metadata::trusted true 2>/dev/null || true
  fi
}

main() {
  print_header

  echo -e "${BOLD}[1/4]${RESET} Validación de herramientas base"
  check_base_tools
  ok "Herramientas base disponibles"
  divider

  echo -e "${BOLD}[2/4]${RESET} Dependencias"
  install_dependencies || exit 1
  divider

  echo -e "${BOLD}[3/4]${RESET} Ruta de instalación"
  local default_dir="/usr/share/dex-studio"
  echo -e "${DIM}Ruta por defecto:${RESET} ${WHITE}${default_dir}${RESET}"
  read -r -p "$(echo -e "${CYAN}❯${RESET} Directorio de instalación (Enter para default): ")" INSTALL_DIR
  INSTALL_DIR="${INSTALL_DIR:-$default_dir}"
  info "Se instalará en: ${INSTALL_DIR}"
  divider

  echo -e "${BOLD}[4/4]${RESET} Copia e integración"
  copy_project_files "$INSTALL_DIR" || exit 1
  install_launcher "$INSTALL_DIR" || exit 1
  install_desktop_files "$INSTALL_DIR" || exit 1

  echo
  divider
  ok "Instalación completada"
  echo -e "${BOLD}Comandos:${RESET}"
  echo "  - Ejecutar: dex-studio"
  echo "  - Menú: DEX STUDIO"
  echo "  - Versión: v${VERSION}"
  divider
}

main "$@"
