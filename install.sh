#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  DEX STUDIO — Instalador Interactivo para Linux
#  Autor: farllirs/dex
# ══════════════════════════════════════════════════════════════

# Forzar ejecución con bash si se lanzó con sh
if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

# ── Colores y estilos ──
RESET="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"

BLACK="\033[30m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
MAGENTA="\033[35m"
CYAN="\033[36m"
WHITE="\033[97m"

BG_BLACK="\033[40m"
BG_BLUE="\033[44m"
BG_MAGENTA="\033[45m"
BG_CYAN="\033[46m"

# ── Funciones de utilidad ──

# Escribir texto con efecto typewriter
typewrite() {
    local text="$1"
    local delay="${2:-0.03}"
    local i=0
    while [ $i -lt ${#text} ]; do
        printf "%s" "${text:$i:1}"
        sleep "$delay"
        i=$((i + 1))
    done
    echo ""
}

# Spinner animado
spinner() {
    local pid=$1
    local msg="$2"
    local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
    local i=0
    tput civis  # ocultar cursor
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${CYAN}${frames[$i]}${RESET}  ${DIM}%s${RESET}" "$msg"
        i=$(( (i + 1) % ${#frames[@]} ))
        sleep 0.08
    done
    tput cnorm  # mostrar cursor
    printf "\r"
}

# Barra de progreso
progress_bar() {
    local current=$1
    local total=$2
    local label="$3"
    local width=30
    local filled=$(( current * width / total ))
    local empty=$(( width - filled ))
    local bar=""
    local i=0
    while [ $i -lt $filled ]; do bar="${bar}█"; i=$((i+1)); done
    i=0
    while [ $i -lt $empty ]; do bar="${bar}░"; i=$((i+1)); done
    local pct=$(( current * 100 / total ))
    printf "\r  ${CYAN}[${GREEN}%s${CYAN}]${RESET} ${BOLD}%3d%%${RESET}  ${DIM}%s${RESET}" "$bar" "$pct" "$label"
}

# Línea decorativa
divider() {
    echo -e "  ${DIM}${CYAN}────────────────────────────────────────────────${RESET}"
}

# Mensaje de éxito
ok() {
    echo -e "  ${GREEN}${BOLD}✔${RESET}  $1"
}

# Mensaje de advertencia
warn() {
    echo -e "  ${YELLOW}${BOLD}⚠${RESET}  $1"
}

# Mensaje de error
fail() {
    echo -e "  ${RED}${BOLD}✖${RESET}  $1"
}

# Mensaje de info
info() {
    echo -e "  ${CYAN}${BOLD}→${RESET}  $1"
}

# Pausa elegante
pause() {
    sleep "${1:-0.4}"
}

# ══════════════════════════════════════════════════════════════
#  PANTALLA DE BIENVENIDA
# ══════════════════════════════════════════════════════════════

clear
echo ""
pause 0.1

echo -e "${BOLD}${MAGENTA}"
echo "  ██████╗ ███████╗██╗  ██╗"
echo "  ██╔══██╗██╔════╝╚██╗██╔╝"
echo "  ██║  ██║█████╗   ╚███╔╝ "
echo "  ██║  ██║██╔══╝   ██╔██╗ "
echo "  ██████╔╝███████╗██╔╝ ██╗"
echo "  ╚═════╝ ╚══════╝╚═╝  ╚═╝"
echo -e "${RESET}"
echo -e "  ${BOLD}${WHITE}S T U D I O${RESET}  ${DIM}— Creador de Apps para Linux${RESET}"
echo ""

divider
VERSION=$(cat "$(dirname "$0")/VERSION.txt" 2>/dev/null || echo "1.0.3")
echo -e "  ${DIM}Versión ${BOLD}${WHITE}v${VERSION}${RESET}   ${DIM}·  Autor ${BOLD}${CYAN}farllirs/dex${RESET}"
divider
echo ""
pause 0.3

# ══════════════════════════════════════════════════════════════
#  PASO 1 — VERIFICAR DEPENDENCIAS
# ══════════════════════════════════════════════════════════════

echo -e "  ${BOLD}${CYAN}[1/4]${RESET}  ${BOLD}Verificando dependencias...${RESET}"
echo ""
pause 0.2

MISSING=""
CHECKS=("python3" "python3-webview")
TOTAL_CHECKS=${#CHECKS[@]}
i=0

for check in "${CHECKS[@]}"; do
    i=$((i + 1))
    progress_bar $i $TOTAL_CHECKS "Comprobando $check"
    sleep 0.3
    if [ "$check" = "python3" ] && ! command -v python3 &>/dev/null; then
        MISSING="$MISSING python3"
    fi
    if [ "$check" = "python3-webview" ] && ! python3 -c "import webview" 2>/dev/null; then
        MISSING="$MISSING python3-webview"
    fi
done

echo ""
echo ""

if [ -n "$MISSING" ]; then
    warn "Dependencias faltantes: ${BOLD}${RED}${MISSING}${RESET}"
    echo ""
    echo -e "  ${YELLOW}¿Instalar automáticamente?${RESET}"
    echo ""
    printf "  ${BOLD}[S]${RESET} Sí, instalar   ${DIM}|${RESET}   ${DIM}[n]${RESET} Cancelar"
    echo ""
    echo ""
    read -rp "  $(echo -e "${CYAN}❯${RESET} ") " INSTALL_DEPS
    INSTALL_DEPS=${INSTALL_DEPS:-S}
    echo ""

    case "$INSTALL_DEPS" in
        [Ss]|[Ss][Ii])
            info "Actualizando repositorios..."
            (sudo apt-get update -qq) &
            spinner $! "apt-get update"
            echo ""

            info "Instalando paquetes del sistema..."
            (sudo apt-get install -y python3 python3-pip python3-webview 2>/dev/null) &
            spinner $! "apt-get install python3 python3-pip python3-webview"
            echo ""

            info "Instalando pywebview via pip..."
            (pip3 install pywebview 2>/dev/null) &
            spinner $! "pip3 install pywebview"
            echo ""

            ok "${GREEN}Dependencias instaladas correctamente${RESET}"
            ;;
        *)
            echo ""
            fail "Instalación cancelada. Instala las dependencias manualmente."
            echo ""
            exit 1
            ;;
    esac
else
    ok "Todas las dependencias están ${GREEN}instaladas${RESET}"
fi

echo ""
divider
echo ""

# ══════════════════════════════════════════════════════════════
#  PASO 2 — DIRECTORIO DE INSTALACIÓN
# ══════════════════════════════════════════════════════════════

echo -e "  ${BOLD}${CYAN}[2/4]${RESET}  ${BOLD}Directorio de instalación${RESET}"
echo ""

DEFAULT_DIR="/usr/share/dex-studio"
echo -e "  ${DIM}Deja vacío para usar el directorio por defecto:${RESET}"
echo -e "  ${DIM}→  ${WHITE}${DEFAULT_DIR}${RESET}"
echo ""
printf "  ${CYAN}❯${RESET} "
read -r INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}

echo ""
info "Instalando en: ${BOLD}${WHITE}${INSTALL_DIR}${RESET}"
echo ""
divider
echo ""

# ══════════════════════════════════════════════════════════════
#  PASO 3 — COPIAR ARCHIVOS
# ══════════════════════════════════════════════════════════════

echo -e "  ${BOLD}${CYAN}[3/4]${RESET}  ${BOLD}Instalando archivos...${RESET}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ARCHIVOS=(
    "Creando directorio de instalación"
    "Copiando backend"
    "Copiando frontend"
    "Copiando templates"
    "Copiando archivos principales"
    "Creando comando dex-studio"
    "Instalando icono"
    "Creando entrada de aplicaciones"
    "Creando acceso directo en escritorio"
    "Actualizando caché del sistema"
)
TOTAL=${#ARCHIVOS[@]}

# Función interna para mostrar progreso por paso
step() {
    local n=$1
    local label="${ARCHIVOS[$((n-1))]}"
    progress_bar $n $TOTAL "$label"
    sleep 0.25
}

step 1
sudo mkdir -p "$INSTALL_DIR"

step 2
sudo rm -rf "$INSTALL_DIR/backend"
sudo cp -r "$SCRIPT_DIR/backend" "$INSTALL_DIR/"

step 3
sudo rm -rf "$INSTALL_DIR/frontend"
sudo cp -r "$SCRIPT_DIR/frontend" "$INSTALL_DIR/"

step 4
sudo rm -rf "$INSTALL_DIR/templates"
sudo cp -r "$SCRIPT_DIR/templates" "$INSTALL_DIR/"

step 5
sudo cp -f "$SCRIPT_DIR/main.py" "$INSTALL_DIR/"
sudo cp -f "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"
sudo cp -f "$SCRIPT_DIR/VERSION.txt" "$INSTALL_DIR/"
sudo cp -f "$SCRIPT_DIR/dex-icon.png" "$INSTALL_DIR/"
sudo cp -f "$SCRIPT_DIR/run.sh" "$INSTALL_DIR/" 2>/dev/null
[ -f "$SCRIPT_DIR/editor-config.json" ] && sudo cp -f "$SCRIPT_DIR/editor-config.json" "$INSTALL_DIR/"

step 6
sudo tee /usr/bin/dex-studio > /dev/null << BINEOF
#!/bin/bash
cd "$INSTALL_DIR" && python3 main.py "\$@"
BINEOF
sudo chmod 755 /usr/bin/dex-studio

step 7
sudo mkdir -p /usr/share/icons/hicolor/256x256/apps
sudo cp -f "$SCRIPT_DIR/dex-icon.png" /usr/share/icons/hicolor/256x256/apps/dex-studio.png

step 8
sudo tee /usr/share/applications/dex-studio.desktop > /dev/null << DTEOF
[Desktop Entry]
Type=Application
Name=DEX STUDIO
GenericName=IDE para Linux
Comment=Creador de aplicaciones para Linux
Exec=bash -c 'cd $INSTALL_DIR && bash run.sh || python3 main.py'
Icon=$INSTALL_DIR/dex-icon.png
Terminal=false
Categories=Development;IDE;
Keywords=IDE;editor;development;python;
StartupWMClass=dex-studio
X-Author=farllirs/dex
DTEOF

step 9
DESKTOP_DIR="$HOME/Escritorio"
[ -d "$HOME/Desktop" ] && DESKTOP_DIR="$HOME/Desktop"

cp -f /usr/share/applications/dex-studio.desktop "$DESKTOP_DIR/dex-studio.desktop"
chmod +x "$DESKTOP_DIR/dex-studio.desktop"
gio set "$DESKTOP_DIR/dex-studio.desktop" metadata::trusted true 2>/dev/null
dbus-launch gio set "$DESKTOP_DIR/dex-studio.desktop" metadata::trusted true 2>/dev/null

step 10
sudo update-desktop-database /usr/share/applications 2>/dev/null
sudo gtk-update-icon-cache /usr/share/icons/hicolor 2>/dev/null

echo ""
echo ""
ok "${GREEN}${BOLD}Todos los archivos instalados en:${RESET} ${WHITE}${INSTALL_DIR}${RESET}"
echo ""
divider
echo ""

# ══════════════════════════════════════════════════════════════
#  PASO 4 — RESUMEN FINAL
# ══════════════════════════════════════════════════════════════

echo -e "  ${BOLD}${CYAN}[4/4]${RESET}  ${BOLD}¡Instalación completada!${RESET}"
echo ""
pause 0.3

echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║                                                  ║"
echo "  ║   ✔   DEX STUDIO instalado correctamente        ║"
echo "  ║                                                  ║"
echo "  ╠══════════════════════════════════════════════════╣"
echo -e "  ║                                                  ║${RESET}"
echo -e "  ${GREEN}║${RESET}   ${CYAN}${BOLD}▸ Terminal:${RESET}   ${WHITE}dex-studio${RESET}                         ${GREEN}║${RESET}"
echo -e "  ${GREEN}║${RESET}   ${CYAN}${BOLD}▸ Escritorio:${RESET} Icono en tu escritorio             ${GREEN}║${RESET}"
echo -e "  ${GREEN}║${RESET}   ${CYAN}${BOLD}▸ Menú apps:${RESET}  Busca \"DEX STUDIO\"                 ${GREEN}║${RESET}"
echo -e "  ${GREEN}║${RESET}                                                  ${GREEN}║${RESET}"
echo -e "  ${GREEN}║${RESET}   ${DIM}Autor: farllirs/dex   ·   v${VERSION}${RESET}               ${GREEN}║${RESET}"
echo -e "  ${GREEN}║                                                  ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo ""
