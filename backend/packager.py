import os
import shutil
import subprocess
import json

class Packager:
    @staticmethod
    def create_deb(project_path):
        try:
            # Load metadata
            meta_path = os.path.join(project_path, 'metadata.json')
            if not os.path.exists(meta_path):
                return {'success': False, 'error': 'Falta metadata.json en el proyecto.'}
            
            with open(meta_path, 'r') as f:
                meta = json.load(f)
            
            name = meta.get('name', 'app').lower().replace(' ', '-')
            version = meta.get('version', '1.0.0')
            identifier = meta.get('identifier', f'com.dex.{name}')
            creator = meta.get('creator', 'DEX Developer')
            category = meta.get('category', 'Utility')
            description = meta.get('description', 'Aplicación creada con DEX STUDIO')
            app_type = meta.get('type', 'GUI')
            
            # Build structure
            build_root = os.path.join(project_path, 'build', f"{name}_{version}")
            if os.path.exists(build_root):
                shutil.rmtree(build_root)
            
            os.makedirs(os.path.join(build_root, 'DEBIAN'), exist_ok=True)
            os.makedirs(os.path.join(build_root, 'usr', 'bin'), exist_ok=True)
            app_dir = os.path.join(build_root, 'usr', 'share', name)
            os.makedirs(app_dir, exist_ok=True)
            os.makedirs(os.path.join(build_root, 'usr', 'share', 'applications'), exist_ok=True)
            os.makedirs(os.path.join(build_root, 'usr', 'share', 'icons', 'hicolor', 'scalable', 'apps'), exist_ok=True)
            
            # Determine dependencies
            depends = 'python3'
            if app_type == 'GUI':
                depends = 'python3, python3-webview'
            
            # Control file
            control = (
                f"Package: {name}\n"
                f"Version: {version}\n"
                f"Section: {category.lower()}\n"
                f"Priority: optional\n"
                f"Architecture: all\n"
                f"Depends: {depends}\n"
                f"Maintainer: {creator}\n"
                f"Description: {description}\n"
            )
            with open(os.path.join(build_root, 'DEBIAN', 'control'), 'w') as f:
                f.write(control)
            
            # Determine if terminal app
            use_terminal = 'true' if app_type == 'CLI' else 'false'
            
            # Wrapper script
            wrapper = f"#!/bin/bash\ncd /usr/share/{name} && python3 main.py \"$@\"\n"
            wrapper_path = os.path.join(build_root, 'usr', 'bin', name)
            with open(wrapper_path, 'w') as f:
                f.write(wrapper)
            os.chmod(wrapper_path, 0o755)
            
            # Copy ALL project files (except build/ and metadata.json internals)
            skip_dirs = {'build', '.git', '__pycache__'}
            skip_files = {'.gitignore'}
            
            for item in os.listdir(project_path):
                if item in skip_dirs:
                    continue
                if item in skip_files:
                    continue
                s = os.path.join(project_path, item)
                d = os.path.join(app_dir, item)
                if os.path.isdir(s):
                    shutil.copytree(s, d, dirs_exist_ok=True)
                else:
                    shutil.copy2(s, d)
            
            # Copy icon if exists
            icon_candidates = [
                os.path.join(project_path, 'icons', 'app-icon.png'),
                os.path.join(project_path, 'icons', 'icon.png'),
            ]
            for icon_src in icon_candidates:
                if os.path.exists(icon_src):
                    shutil.copy2(icon_src, os.path.join(
                        build_root, 'usr', 'share', 'icons', 'hicolor', 'scalable', 'apps', f'{name}.png'))
                    break
            
            # Desktop file
            desktop = (
                f"[Desktop Entry]\n"
                f"Type=Application\n"
                f"Name={meta.get('name')}\n"
                f"Comment={description}\n"
                f"Exec={name}\n"
                f"Icon={name}\n"
                f"Terminal={use_terminal}\n"
                f"Categories={category};\n"
                f"X-DEX-Identifier={identifier}\n"
            )
            desktop_path = os.path.join(build_root, 'usr', 'share', 'applications', f"{name}.desktop")
            with open(desktop_path, 'w') as f:
                f.write(desktop)
            
            # Build .deb
            output = os.path.join(project_path, 'build', f"{name}_{version}.deb")
            result = subprocess.run(
                ['dpkg-deb', '--build', build_root, output],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                return {'success': False, 'error': f'Error en dpkg-deb: {result.stderr}'}
            
            # Create install script
            install_script = os.path.join(project_path, 'build', f'install-{name}.sh')
            with open(install_script, 'w') as f:
                f.write(f'''#!/bin/bash
# Instalador de {meta.get("name")} — Generado por DEX STUDIO
echo "══════════════════════════════════════════"
echo "  Instalando {meta.get("name")} v{version}"
echo "══════════════════════════════════════════"

DEB_FILE="$(dirname "$0")/{name}_{version}.deb"

if [ ! -f "$DEB_FILE" ]; then
    echo "ERROR: No se encontró $DEB_FILE"
    exit 1
fi

# Instalar .deb
sudo dpkg -i "$DEB_FILE" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Resolviendo dependencias..."
    sudo apt-get install -f -y 2>/dev/null
    sudo dpkg -i "$DEB_FILE"
fi

# Actualizar base de datos de aplicaciones
sudo update-desktop-database /usr/share/applications 2>/dev/null
sudo gtk-update-icon-cache /usr/share/icons/hicolor 2>/dev/null

echo ""
echo "✓ {meta.get("name")} instalado correctamente"
echo "  Ejecutar: {name}"
echo "  También disponible en el menú de aplicaciones"
echo "══════════════════════════════════════════"
''')
            os.chmod(install_script, 0o755)
            
            # Try auto-install
            install_msg = ''
            try:
                install_result = subprocess.run(
                    ['bash', install_script],
                    capture_output=True, text=True, timeout=30
                )
                if install_result.returncode == 0:
                    install_msg = ' e instalado en el sistema'
                else:
                    install_msg = ' (instalar manualmente: build/install-' + name + '.sh)'
            except Exception:
                install_msg = ' (instalar manualmente: build/install-' + name + '.sh)'
            
            # Clean build directory (remove extracted tree)
            if os.path.exists(build_root):
                shutil.rmtree(build_root)
            
            return {
                'success': True,
                'message': f'{name}_{version}.deb generado{install_msg}',
                'deb_path': output,
                'install_script': install_script
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
