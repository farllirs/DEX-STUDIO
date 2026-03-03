#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  DEX STUDIO — Instalador Interactivo para Linux
#  Autor: farllirs/dex
# ══════════════════════════════════════════════════════════════

if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/VERSION.txt"
VERSION="$(cat "$VERSION_FILE" 2>/dev/null || echo "1.0.1")"

install_deb_file() {
    local deb_path="$1"
    if [ -z "$deb_path" ] || [ ! -f "$deb_path" ]; then
        echo "Error: no se encontró el .deb: $deb_path"
        exit 1
    fi
    echo "Instalando paquete: $deb_path"
    sudo dpkg -i "$deb_path" || true
    sudo apt-get install -f -y
    echo "Instalación finalizada. Ejecuta: dex-studio"
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    cat << EOF
Uso: bash install.sh [opción]

Opciones:
  --deb <ruta.deb>   Instalar directamente desde un paquete .deb
  --build-deb        Construir .deb con build-deb.sh e instalarlo
  --help             Mostrar esta ayuda

Sin opciones:
  Ejecuta el instalador interactivo desde código fuente.
EOF
    exit 0
fi

if [ "${1:-}" = "--deb" ]; then
    install_deb_file "${2:-}"
    exit 0
fi

if [ "${1:-}" = "--build-deb" ]; then
    bash "$SCRIPT_DIR/build-deb.sh"
    install_deb_file "$SCRIPT_DIR/build/dex-studio_${VERSION}.deb"
    exit 0
fi

# ── Colores ──
R="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"
ITALIC="\033[3m"
UL="\033[4m"

W="\033[97m"       # Blanco brillante
G="\033[90m"       # Gris
C="\033[36m"       # Cyan
CB="\033[1;36m"    # Cyan bold
CY="\033[33m"      # Amarillo
RED="\033[31m"     # Rojo
GR="\033[32m"      # Verde
BLU="\033[34m"     # Azul
MAG="\033[35m"     # Magenta

BG_BLACK="\033[40m"
BG_CYAN="\033[46m"
BG_RED="\033[41m"
BG_GREEN="\033[42m"

# ── Utilidades ──

beep()    { printf "\007"; }
newline() { echo ""; }
pause()   { sleep "${1:-0.3}"; }

# Ocultar/mostrar cursor
hide_cursor() { tput civis 2>/dev/null; }
show_cursor() { tput cnorm 2>/dev/null; }

# Limpiar línea actual
clearline() { printf "\r\033[K"; }

# Trap para restaurar cursor si se interrumpe
trap 'show_cursor; echo ""; echo ""; fail "Instalación interrumpida."; echo ""; exit 1' INT TERM

# ── Typewriter con color ──
typewrite() {
    local text="$1"
    local delay="${2:-0.04}"
    local color="${3:-}"
    local i=0
    printf "%s" "$color"
    while [ $i -lt ${#text} ]; do
        printf "%s" "${text:$i:1}"
        sleep "$delay"
        i=$((i + 1))
    done
    printf "%s" "$R"
    echo ""
}

# ── Spinner ──
spinner() {
    local pid=$1
    local msg="$2"
    local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
    local i=0
    hide_cursor
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${C}${frames[$i]}${R}  ${DIM}%s${R}" "$msg"
        i=$(( (i + 1) % ${#frames[@]} ))
        sleep 0.07
    done
    show_cursor
    clearline
}

# ── Barra de progreso grande ──
progress_bar() {
    local current=$1
    local total=$2
    local label="$3"
    local width=40
    local filled=$(( current * width / total ))
    local empty=$(( width - filled ))
    local bar=""
    local i=0
    while [ $i -lt $filled ]; do bar="${bar}█"; i=$((i+1)); done
    i=0
    while [ $i -lt $empty ]; do bar="${bar}░"; i=$((i+1)); done
    local pct=$(( current * 100 / total ))
    printf "\r  ${CB}[${GR}%s${G}%s${CB}]${R}  ${BOLD}${W}%3d%%${R}  ${DIM}%s${R}" \
        "$(echo "$bar" | head -c $filled)" \
        "$(echo "$bar" | tail -c +$((filled+1)))" \
        "$pct" "$label"
}

progress_bar2() {
    local current=$1
    local total=$2
    local label="$3"
    local filled=$(( current * 40 / total ))
    local empty=$(( 40 - filled ))
    local f="" e="" i=0
    while [ $i -lt $filled ]; do f="${f}█"; i=$((i+1)); done
    i=0
    while [ $i -lt $empty ]; do e="${e}░"; i=$((i+1)); done
    local pct=$(( current * 100 / total ))
    printf "\r  ${CB}[${GR}%s${G}%s${CB}]${R}  ${BOLD}${W}%3d%%${R}  ${DIM}%s${R}" \
        "$f" "$e" "$pct" "$label"
}

# ── Mensajes ──
ok()    { echo -e "  ${GR}${BOLD}✔${R}  ${W}$1${R}"; }
warn()  { echo -e "  ${CY}${BOLD}⚠${R}  $1"; }
fail()  { echo -e "  ${RED}${BOLD}✖${R}  ${W}$1${R}"; }
info()  { echo -e "  ${C}${BOLD}›${R}  $1"; }
label() { echo -e "  ${G}$1${R}"; }

divider_thin()  { echo -e "  ${G}────────────────────────────────────────────────${R}"; }
divider_thick() { echo -e "  ${C}════════════════════════════════════════════════${R}"; }

# ══════════════════════════════════════════════════════════════
#  INTRO ANIMADA
# ══════════════════════════════════════════════════════════════

clear
hide_cursor
newline
pause 0.2

# Aparecer el logo letra a letra con typewriter
LOGO_LINES=(
"  ██████╗ ███████╗██╗  ██╗"
"  ██╔══██╗██╔════╝╚██╗██╔╝"
"  ██║  ██║█████╗   ╚███╔╝ "
"  ██║  ██║██╔══╝   ██╔██╗ "
"  ██████╔╝███████╗██╔╝ ██╗"
"  ╚═════╝ ╚══════╝╚═╝  ╚═╝"
)

printf "${C}"
for line in "${LOGO_LINES[@]}"; do
    i=0
    while [ $i -lt ${#line} ]; do
        printf "%s" "${line:$i:1}"
        sleep 0.008
        i=$((i + 1))
    done
    echo ""
done
printf "${R}"

newline
pause 0.15

# Subtítulo letra a letra
printf "  ${BOLD}${W}"
subtitle="S T U D I O"
i=0
while [ $i -lt ${#subtitle} ]; do
    printf "%s" "${subtitle:$i:1}"
    sleep 0.06
    i=$((i + 1))
done
printf "${R}"

printf "  ${G}"
sub2="— Creador de Apps para Linux"
i=0
while [ $i -lt ${#sub2} ]; do
    printf "%s" "${sub2:$i:1}"
    sleep 0.02
    i=$((i + 1))
done
printf "${R}"
newline
newline

pause 0.2
divider_thick
printf "  ${G}Versión ${BOLD}${W}v${VERSION}${R}   ${G}·   Autor ${CB}farllirs/dex${R}\n"
divider_thick
newline
show_cursor
pause 0.4

# ══════════════════════════════════════════════════════════════
#  PASO 1 — VERIFICAR DEPENDENCIAS
# ══════════════════════════════════════════════════════════════

echo -e "  ${CB}[1 / 4]${R}  ${BOLD}${W}Verificando dependencias${R}"
newline
pause 0.2

MISSING=""
CHECKS=("python3" "python3-webview")

i=0
for check in "${CHECKS[@]}"; do
    i=$((i + 1))
    progress_bar2 $i 2 "Comprobando $check"
    sleep 0.5
    if [ "$check" = "python3" ] && ! command -v python3 &>/dev/null; then
        MISSING="$MISSING python3"
    fi
    if [ "$check" = "python3-webview" ] && ! python3 -c "import webview" 2>/dev/null; then
        MISSING="$MISSING python3-webview"
    fi
done

newline; newline

if [ -n "$MISSING" ]; then
    warn "Dependencias faltantes: ${BOLD}${RED}${MISSING}${R}"
    newline
    echo -e "  ${CY}¿Instalar automáticamente?${R}"
    newline
    echo -e "  ${BOLD}${W}[S]${R} ${G}Sí, instalar${R}    ${G}·${R}    ${DIM}[n] Cancelar${R}"
    newline
    printf "  ${C}❯${R} "
    read -r INSTALL_DEPS
    INSTALL_DEPS=${INSTALL_DEPS:-S}
    newline

    case "$INSTALL_DEPS" in
        [Ss]|[Ss][Ii])
            info "Actualizando repositorios..."
            (sudo apt-get update -qq 2>&1) &
            spinner $! "apt-get update..."
            ok "Repositorios actualizados"

            info "Instalando paquetes del sistema..."
            (sudo apt-get install -y python3 python3-pip python3-webview 2>/dev/null) &
            spinner $! "apt-get install python3 python3-pip python3-webview"
            ok "Paquetes instalados"

            info "Instalando pywebview via pip..."
            (pip3 install pywebview 2>/dev/null) &
            spinner $! "pip3 install pywebview"
            ok "pywebview instalado"
            newline
            ;;
        *)
            newline
            # ── PANTALLA DE ERROR DRAMÁTICA ──
            clear
            newline
            hide_cursor
            pause 0.1
            echo -e "${BG_RED}${BOLD}${W}                                                    ${R}"
            echo -e "${BG_RED}${BOLD}${W}         ✖  INSTALACIÓN CANCELADA                   ${R}"
            echo -e "${BG_RED}${BOLD}${W}                                                    ${R}"
            newline
            echo -e "  ${RED}${BOLD}No se instalaron las dependencias requeridas.${R}"
            newline
            echo -e "  ${G}Instálalas manualmente y vuelve a ejecutar:${R}"
            newline
            echo -e "  ${DIM}  sudo apt install python3 python3-pip python3-webview${R}"
            echo -e "  ${DIM}  pip3 install pywebview${R}"
            newline
            divider_thin
            newline
            show_cursor
            exit 1
            ;;
    esac
else
    ok "Todas las dependencias están ${GR}instaladas${R}"
fi

newline
divider_thin
newline

# ══════════════════════════════════════════════════════════════
#  PASO 2 — DIRECTORIO DE INSTALACIÓN
# ══════════════════════════════════════════════════════════════

echo -e "  ${CB}[2 / 4]${R}  ${BOLD}${W}Directorio de instalación${R}"
newline
DEFAULT_DIR="/usr/share/dex-studio"
label "Deja vacío para usar el directorio por defecto:"
echo -e "  ${G}›  ${W}${DEFAULT_DIR}${R}"
newline
printf "  ${C}❯${R} "
read -r INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}

newline
info "Destino: ${BOLD}${W}${INSTALL_DIR}${R}"
newline
divider_thin
newline

# ══════════════════════════════════════════════════════════════
#  PASO 3 — COPIAR ARCHIVOS
# ══════════════════════════════════════════════════════════════

echo -e "  ${CB}[3 / 4]${R}  ${BOLD}${W}Instalando archivos...${R}"
newline

STEPS=(
    "Creando directorio de instalación"
    "Copiando backend"
    "Copiando frontend"
    "Copiando templates"
    "Copiando archivos principales"
    "Creando comando dex-studio"
    "Instalando icono del sistema"
    "Creando entrada en aplicaciones"
    "Creando acceso directo en escritorio"
    "Actualizando caché del sistema"
)
TOTAL=10

do_step() {
    local n=$1
    local label="${STEPS[$((n-1))]}"
    hide_cursor
    progress_bar2 $n $TOTAL "$label"
    sleep 0.28
    show_cursor
}

do_step 1
sudo mkdir -p "$INSTALL_DIR"

do_step 2
sudo cp -r "$SCRIPT_DIR/backend"   "$INSTALL_DIR/" 2>/dev/null

do_step 3
sudo cp -r "$SCRIPT_DIR/frontend"  "$INSTALL_DIR/" 2>/dev/null

do_step 4
sudo cp -r "$SCRIPT_DIR/templates" "$INSTALL_DIR/" 2>/dev/null

do_step 5
sudo cp "$SCRIPT_DIR/main.py"          "$INSTALL_DIR/" 2>/dev/null
sudo cp "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/" 2>/dev/null
sudo cp "$SCRIPT_DIR/VERSION.txt"      "$INSTALL_DIR/" 2>/dev/null
sudo cp "$SCRIPT_DIR/dex-icon.png"     "$INSTALL_DIR/" 2>/dev/null
[ -f "$SCRIPT_DIR/editor-config.json" ] && sudo cp "$SCRIPT_DIR/editor-config.json" "$INSTALL_DIR/" 2>/dev/null

do_step 6
sudo bash -c "cat > /usr/bin/dex-studio << 'BINEOF'
#!/bin/bash
cd /usr/share/dex-studio && python3 main.py \"\$@\"
BINEOF"
sudo chmod 755 /usr/bin/dex-studio

do_step 7
sudo mkdir -p /usr/share/icons/hicolor/256x256/apps
sudo mkdir -p /usr/share/icons/hicolor/128x128/apps
sudo mkdir -p /usr/share/icons/hicolor/64x64/apps
sudo mkdir -p /usr/share/icons/hicolor/48x48/apps
sudo mkdir -p /usr/share/icons/hicolor/32x32/apps
sudo mkdir -p /usr/share/pixmaps
sudo cp "$SCRIPT_DIR/dex-icon.png" /usr/share/icons/hicolor/256x256/apps/dex-studio.png
sudo cp "$SCRIPT_DIR/dex-icon.png" /usr/share/icons/hicolor/128x128/apps/dex-studio.png
sudo cp "$SCRIPT_DIR/dex-icon.png" /usr/share/icons/hicolor/64x64/apps/dex-studio.png
sudo cp "$SCRIPT_DIR/dex-icon.png" /usr/share/icons/hicolor/48x48/apps/dex-studio.png
sudo cp "$SCRIPT_DIR/dex-icon.png" /usr/share/icons/hicolor/32x32/apps/dex-studio.png
sudo cp "$SCRIPT_DIR/dex-icon.png" /usr/share/pixmaps/dex-studio.png

do_step 8
sudo bash -c "cat > /usr/share/applications/dex-studio.desktop << DTEOF
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
DTEOF"

do_step 9
DESKTOP_DIR="$HOME/Escritorio"
[ -d "$HOME/Desktop" ] && DESKTOP_DIR="$HOME/Desktop"
cat > "$DESKTOP_DIR/dex-studio.desktop" << DESKEOF
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
DESKEOF
chmod +x "$DESKTOP_DIR/dex-studio.desktop"
gio set "$DESKTOP_DIR/dex-studio.desktop" metadata::trusted true 2>/dev/null
dbus-launch gio set "$DESKTOP_DIR/dex-studio.desktop" metadata::trusted true 2>/dev/null

do_step 10
sudo update-desktop-database /usr/share/applications 2>/dev/null
sudo gtk-update-icon-cache /usr/share/icons/hicolor 2>/dev/null
command -v xdg-desktop-menu >/dev/null 2>&1 && xdg-desktop-menu forceupdate 2>/dev/null || true

newline; newline
ok "Archivos instalados en ${W}${INSTALL_DIR}${R}"
newline
divider_thin
newline

# ══════════════════════════════════════════════════════════════
#  PASO 4 — RESUMEN FINAL ANIMADO
# ══════════════════════════════════════════════════════════════

echo -e "  ${CB}[4 / 4]${R}  ${BOLD}${W}Instalación completada${R}"
newline
pause 0.3
hide_cursor

# Panel final apareciendo línea a línea
PANEL=(
"  ╔══════════════════════════════════════════════════════╗"
"  ║                                                      ║"
"  ║     ✔   DEX STUDIO  —  Instalado correctamente      ║"
"  ║                                                      ║"
"  ╠══════════════════════════════════════════════════════╣"
"  ║                                                      ║"
"  ║   ›  Terminal    dex-studio                          ║"
"  ║   ›  Escritorio  Icono creado en tu escritorio       ║"
"  ║   ›  Menú apps   Busca  DEX STUDIO                   ║"
"  ║                                                      ║"
"  ╠══════════════════════════════════════════════════════╣"
"  ║                                                      ║"
"  ║   Autor: farllirs/dex   ·   v${VERSION}                     ║"
"  ║                                                      ║"
"  ╚══════════════════════════════════════════════════════╝"
)

for line in "${PANEL[@]}"; do
    echo -e "${GR}${BOLD}${line}${R}"
    sleep 0.06
done

newline
show_cursor

# Bip de finalización
beep
pause 0.15
beep

newline
printf "  ${G}Presiona ${W}${BOLD}Enter${R}${G} para salir...${R} "
read -r
newline
echo -e "  ${C}${DIM}Hasta pronto. — DEX STUDIO${R}"
newline
