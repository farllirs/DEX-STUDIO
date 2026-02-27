import os
import json
import shutil
import subprocess
import re
import base64
import urllib.error
from datetime import datetime, timedelta
from backend.packager import Packager
from backend.extensions_db import ExtensionsDB

class API:
    def __init__(self):
        # Keep window reference private so pywebview js_api introspection ignores it.
        self._window = None
        self._window_maximized = False
        self.current_project_path = None
        self.projects_root = os.path.join(os.path.expanduser("~"), 'DEX_Projects')
        os.makedirs(self.projects_root, exist_ok=True)
        self.ext_db = ExtensionsDB()
        self._migrate_modules_to_extensions()

    def _migrate_modules_to_extensions(self):
        """Migrate extensions from old modules/ dir to ~/.dex-studio/extensions/"""
        try:
            old_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'modules')
            new_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            os.makedirs(new_dir, exist_ok=True)
            if os.path.exists(old_dir):
                for item in os.listdir(old_dir):
                    old_path = os.path.join(old_dir, item)
                    new_path = os.path.join(new_dir, item)
                    if os.path.isdir(old_path) and not os.path.exists(new_path):
                        shutil.copytree(old_path, new_path)
        except Exception:
            pass

    def set_window(self, window):
        self._window = window

    def toggle_devtools(self):
        if self._window:
            return {'success': True, 'message': 'Usa CTRL+SHIFT+I para inspeccionar (Modo Debug Activo)'}
        return {'success': False}

    def window_minimize(self):
        try:
            if not self._window:
                return {'success': False, 'error': 'Ventana no inicializada'}
            self._window.minimize()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def window_toggle_maximize(self):
        try:
            if not self._window:
                return {'success': False, 'error': 'Ventana no inicializada'}
            if self._window_maximized:
                self._window.restore()
                self._window_maximized = False
            else:
                self._window.maximize()
                self._window_maximized = True
            return {'success': True, 'maximized': self._window_maximized}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def window_close(self):
        try:
            if not self._window:
                return {'success': False, 'error': 'Ventana no inicializada'}
            self._window.destroy()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_home_dir(self):
        return os.path.expanduser("~")

    def list_directory(self, path):
        try:
            path = os.path.expanduser(path)
            if not os.path.exists(path):
                return {'success': False, 'error': 'Ruta no existe'}
            items = []
            for item in os.listdir(path):
                full_path = os.path.join(path, item)
                items.append({
                    'name': item,
                    'path': full_path,
                    'is_dir': os.path.isdir(full_path)
                })
            return {'success': True, 'items': items}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def read_file(self, path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            return {'success': True, 'content': content}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def save_file(self, path, content):
        try:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def write_file(self, path, content):
        """Alias para save_file"""
        return self.save_file(path, content)

    def select_folder(self):
        """Retorna la carpeta de proyectos actual"""
        try:
            return {'path': self.projects_root, 'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def create_file(self, path):
        try:
            with open(path, 'w') as f:
                f.write('')
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def create_directory(self, path):
        try:
            os.makedirs(path, exist_ok=True)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def delete_item(self, path):
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def rename_item(self, old_path, new_path):
        try:
            os.rename(old_path, new_path)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def create_project(self, metadata):
        try:
            # Mandatory Fields Validation
            project_type = metadata.get('type', 'GUI')
            if project_type in ('Blank', 'Extension'):
                required = ['name', 'creator', 'version', 'type']
            else:
                required = ['name', 'creator', 'version', 'description', 'category', 'identifier', 'type']
            for field in required:
                if not metadata.get(field) or not str(metadata.get(field)).strip():
                    return {'success': False, 'error': f'El campo "{field}" es obligatorio.'}
            # Auto-generate identifier if not provided
            if not metadata.get('identifier') or not str(metadata.get('identifier')).strip():
                metadata['identifier'] = metadata['name'].lower().replace(' ', '-')
            
            # Strict Validation (Section 9)
            if not re.match(r'^[a-zA-Z0-9._-]+$', metadata['identifier']):
                return {'success': False, 'error': 'Identificador inválido. Solo letras, números, puntos, guiones y guiones bajos.'}
            
            if not re.match(r'^[a-zA-Z0-9\s_-]+$', metadata['name']):
                return {'success': False, 'error': 'Nombre de aplicación contiene caracteres ilegales.'}

            project_folder = metadata['name'].lower().replace(' ', '-')
            base_path = os.path.join(self.projects_root, project_folder)
            
            if os.path.exists(base_path):
                return {'success': False, 'error': 'El proyecto ya existe en el sistema.'}
            
            template_type = metadata.get('type', 'GUI')
            template_map = {'GUI': 'gui', 'CLI': 'cli', 'Web': 'web', 'Extension': 'extension'}
            template_name = template_map.get(template_type)

            if template_type == 'Extension':
                # Extensions: just create project dir, no src/assets/icons/build
                os.makedirs(base_path, exist_ok=True)
            elif template_type == 'Blank':
                # Blank project: minimal structure
                for sub in ['src']:
                    os.makedirs(os.path.join(base_path, sub), exist_ok=True)
            else:
                # Official Structure (Section 6)
                for sub in ['src', 'assets', 'icons', 'build']:
                    os.makedirs(os.path.join(base_path, sub), exist_ok=True)

                # Copy default icon if no custom icon provided
                if not metadata.get('icon') or not os.path.exists(metadata['icon']):
                    default_icon = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                                               'frontend', 'assets', 'default-app-icon.png')
                    if os.path.exists(default_icon):
                        shutil.copy(default_icon, os.path.join(base_path, 'icons', 'app-icon.png'))
                        metadata['icon'] = 'icons/app-icon.png'
                else:
                    shutil.copy(metadata['icon'], os.path.join(base_path, 'icons', 'app-icon.png'))
                    metadata['icon'] = 'icons/app-icon.png'

                # Metadata & Config Files
                with open(os.path.join(base_path, 'metadata.json'), 'w') as f:
                    json.dump(metadata, f, indent=4)

                with open(os.path.join(base_path, 'config.json'), 'w') as f:
                    json.dump({"project_id": metadata['identifier'], "engine": "DEX-STUDIO-V1"}, f, indent=4)

            # Copy template files
            template_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates', template_name)

            placeholders = {
                '{{APP_NAME}}': metadata['name'],
                '{{CREATOR}}': metadata['creator'],
                '{{VERSION}}': metadata['version'],
                '{{DESCRIPTION}}': metadata.get('description', ''),
                '{{IDENTIFIER}}': metadata['identifier'],
                '{{EXT_CATEGORY}}': metadata.get('ext_category', 'editor'),
                '{{EXT_ICON}}': metadata.get('ext_icon', 'puzzle'),
                '{{EXT_COLOR}}': metadata.get('ext_color', 'linear-gradient(135deg, #667eea, #764ba2)')
            }

            if os.path.exists(template_dir):
                for root, dirs, files in os.walk(template_dir):
                    rel_root = os.path.relpath(root, template_dir)
                    dest_root = os.path.join(base_path, rel_root) if rel_root != '.' else base_path
                    os.makedirs(dest_root, exist_ok=True)
                    for file_name in files:
                        src_file = os.path.join(root, file_name)
                        dst_file = os.path.join(dest_root, file_name)
                        try:
                            with open(src_file, 'r', encoding='utf-8') as f:
                                content = f.read()
                            for placeholder, value in placeholders.items():
                                content = content.replace(placeholder, value)
                            with open(dst_file, 'w', encoding='utf-8') as f:
                                f.write(content)
                        except (UnicodeDecodeError, Exception):
                            shutil.copy2(src_file, dst_file)

            # Write metadata.json for Extension/Blank type too
            if template_type in ('Extension', 'Blank'):
                with open(os.path.join(base_path, 'metadata.json'), 'w') as f:
                    json.dump(metadata, f, indent=4)

            # Generate theme.css scaffold for theme/ui-theme extensions
            if template_type == 'Extension' and metadata.get('ext_category') in ('theme', 'ui-theme'):
                theme_css_path = os.path.join(base_path, 'theme.css')
                if not os.path.exists(theme_css_path):
                    with open(theme_css_path, 'w', encoding='utf-8') as f:
                        f.write(""":root {
    /* ── Fondos ── */
    --bg-base:              #1e1e2e;
    --bg-surface:           #313244;
    --bg-elevated:          #45475a;
    --bg-overlay:           #585b70;

    /* ── Texto ── */
    --text-primary:         rgba(205, 214, 244, 0.92);
    --text-secondary:       rgba(166, 173, 200, 0.60);
    --text-tertiary:        rgba(127, 132, 156, 0.30);

    /* ── Acento ── */
    --accent:               #89b4fa;
    --accent-hover:         #74c7ec;
    --accent-subtle:        rgba(137, 180, 250, 0.10);

    /* ── Bordes ── */
    --border:               rgba(137, 180, 250, 0.10);
    --border-strong:        rgba(137, 180, 250, 0.20);

    /* ── Estados ── */
    --success:              #a6e3a1;
    --warning:              #f9e2af;
    --error:                #f38ba8;
}
""")
            
            # Blank project: create minimal main.py
            if template_type == 'Blank':
                with open(os.path.join(base_path, 'main.py'), 'w') as f:
                    f.write(f'#!/usr/bin/env python3\n# {metadata["name"]}\n# Creado por {metadata["creator"]} con DEX STUDIO\n\nprint("Hola desde {metadata["name"]}!")\n')

            self.current_project_path = base_path
            return {'success': True, 'path': base_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def open_project(self, path):
        try:
            path = os.path.expanduser(path)
            if os.path.isdir(path):
                self.current_project_path = path
                return {'success': True}
            return {'success': False, 'error': 'No es un proyecto válido de DEX STUDIO.'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def run_command(self, command):
        try:
            cwd = self.current_project_path or os.getcwd()
            result = subprocess.run(command, shell=True, capture_output=True, text=True, cwd=cwd)
            return {'success': True, 'stdout': result.stdout, 'stderr': result.stderr, 'code': result.returncode}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def compile_project(self):
        if not self.current_project_path:
            return {'success': False, 'error': 'No hay un proyecto abierto para compilar.'}
        return Packager.create_deb(self.current_project_path)

    def initialize_git(self, project_path):
        try:
            cwd = os.path.expanduser(project_path)
            result = subprocess.run(['git', 'init'], capture_output=True, text=True, cwd=cwd)
            if result.returncode == 0:
                # Create .gitignore
                gitignore_path = os.path.join(cwd, '.gitignore')
                with open(gitignore_path, 'w') as f:
                    f.write('build/\n__pycache__/\n*.pyc\n.DS_Store\n')
                return {'success': True, 'message': 'Repositorio Git inicializado'}
            return {'success': False, 'error': result.stderr}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def push_to_github(self, project_path, repo_url, token=None):
        try:
            cwd = os.path.expanduser(project_path)
            
            # Configure Git user if needed
            subprocess.run(['git', 'config', 'user.email', 'dexstudio@localhost'], cwd=cwd, capture_output=True)
            subprocess.run(['git', 'config', 'user.name', 'DEX Developer'], cwd=cwd, capture_output=True)
            
            # Add all files
            subprocess.run(['git', 'add', '.'], cwd=cwd, capture_output=True, text=True)
            
            # Initial commit
            commit_result = subprocess.run(['git', 'commit', '-m', 'Initial commit from DEX STUDIO'], 
                                         cwd=cwd, capture_output=True, text=True)
            
            # Add remote
            subprocess.run(['git', 'remote', 'remove', 'origin'], cwd=cwd, capture_output=True)
            subprocess.run(['git', 'remote', 'add', 'origin', repo_url], cwd=cwd, capture_output=True, text=True)
            
            # Push to GitHub
            if token:
                url_with_token = repo_url.replace('https://', f'https://{token}@')
                push_result = subprocess.run(['git', 'push', '-u', 'origin', 'master'], 
                                           cwd=cwd, capture_output=True, text=True)
            else:
                push_result = subprocess.run(['git', 'push', '-u', 'origin', 'master'], 
                                           cwd=cwd, capture_output=True, text=True)
            
            if push_result.returncode == 0:
                return {'success': True, 'message': 'Proyecto subido a GitHub correctamente'}
            else:
                return {'success': False, 'error': push_result.stderr}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def list_modules(self):
        try:
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            if not os.path.exists(modules_dir):
                return {'success': True, 'modules': []}
            modules = []
            for item in os.listdir(modules_dir):
                full_path = os.path.join(modules_dir, item)
                if os.path.isdir(full_path):
                    modules.append({'name': item, 'path': full_path})
            return {'success': True, 'modules': modules}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def load_module(self, name):
        try:
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            ext_js = os.path.join(modules_dir, name, 'extension.dex.js')
            main_js = os.path.join(modules_dir, name, 'main.js')
            if os.path.exists(ext_js):
                js_path = ext_js
            elif os.path.exists(main_js):
                js_path = main_js
            else:
                return {'success': False, 'error': f'Módulo "{name}" no encontrado'}
            with open(js_path, 'r', encoding='utf-8') as f:
                code = f.read()
            valid = code.strip().endswith('// Dex code successful')
            return {'success': True, 'code': code, 'valid': valid}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def load_module_file(self, module_name, file_path):
        try:
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            full_path = os.path.realpath(os.path.join(modules_dir, module_name, file_path))
            if not full_path.startswith(os.path.realpath(modules_dir)):
                return {'success': False, 'error': 'Acceso denegado: ruta fuera del directorio de módulos'}
            if not os.path.exists(full_path):
                return {'success': False, 'error': f'Archivo no encontrado: {file_path}'}
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return {'success': True, 'content': content}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_image_base64(self, path):
        try:
            if not os.path.exists(path):
                return {'success': False, 'error': f'Imagen no encontrada: {path}'}
            mime_types = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.webp': 'image/webp',
                '.ico': 'image/x-icon',
                '.bmp': 'image/bmp',
            }
            ext = os.path.splitext(path)[1].lower()
            mime = mime_types.get(ext, 'application/octet-stream')
            with open(path, 'rb') as f:
                data = base64.b64encode(f.read()).decode('utf-8')
            return {'success': True, 'data_uri': f'data:{mime};base64,{data}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Settings persistence ──────────────────────────────────────────

    def load_settings(self):
        """Load editor settings from editor-config.json"""
        try:
            config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'editor-config.json')
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    return {'success': True, 'settings': json.load(f)}
            return {'success': True, 'settings': {}}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def save_settings(self, settings):
        """Save editor settings to editor-config.json"""
        try:
            config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'editor-config.json')
            with open(config_path, 'w') as f:
                json.dump(settings, f, indent=4)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def save_github_token(self, token):
        """Save GitHub token securely in ~/.dex-studio/"""
        try:
            token_dir = os.path.join(os.path.expanduser("~"), '.dex-studio')
            os.makedirs(token_dir, exist_ok=True)
            token_path = os.path.join(token_dir, 'github_token')
            with open(token_path, 'w') as f:
                f.write(token.strip())
            os.chmod(token_path, 0o600)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def load_github_token(self):
        """Load GitHub token from ~/.dex-studio/"""
        try:
            token_path = os.path.join(os.path.expanduser("~"), '.dex-studio', 'github_token')
            if os.path.exists(token_path):
                with open(token_path, 'r') as f:
                    token = f.read().strip()
                if token:
                    return {'success': True, 'token': token}
            return {'success': True, 'token': None}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def delete_github_token(self):
        """Delete stored GitHub token"""
        try:
            token_path = os.path.join(os.path.expanduser("~"), '.dex-studio', 'github_token')
            if os.path.exists(token_path):
                os.remove(token_path)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── UI Themes & Layouts ──────────────────────────────────────────

    def get_ui_themes(self):
        """Scan installed extensions for UI layout themes (ui-theme)"""
        try:
            ext_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            themes = []
            if not os.path.exists(ext_dir):
                return {'success': True, 'themes': []}
            for item in os.listdir(ext_dir):
                item_path = os.path.join(ext_dir, item)
                if not os.path.isdir(item_path):
                    continue
                manifest_path = os.path.join(item_path, 'manifest.json')
                if not os.path.exists(manifest_path):
                    continue
                try:
                    with open(manifest_path, 'r', encoding='utf-8') as f:
                        manifest = json.load(f)
                except (json.JSONDecodeError, OSError):
                    continue
                is_theme = (manifest.get('category') == 'ui-theme' or
                            manifest.get('type') == 'ui-theme')
                css_path = os.path.join(item_path, 'theme.css')
                has_css = os.path.exists(css_path)
                if not is_theme or not has_css:
                    continue
                themes.append({
                    'id': item,
                    'name': manifest.get('name', item),
                    'description': manifest.get('description', ''),
                    'css_path': css_path if has_css else None,
                    'colors': manifest.get('colors', {})
                })
            return {'success': True, 'themes': themes}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_normal_themes(self):
        """Scan installed extensions for normal themes (category: theme)"""
        try:
            ext_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            themes = []
            if not os.path.exists(ext_dir):
                return {'success': True, 'themes': []}

            for item in os.listdir(ext_dir):
                item_path = os.path.join(ext_dir, item)
                if not os.path.isdir(item_path):
                    continue
                manifest_path = os.path.join(item_path, 'manifest.json')
                css_path = os.path.join(item_path, 'theme.css')
                if not os.path.exists(manifest_path) or not os.path.exists(css_path):
                    continue
                try:
                    with open(manifest_path, 'r', encoding='utf-8') as f:
                        manifest = json.load(f)
                except (json.JSONDecodeError, OSError):
                    continue

                category = manifest.get('category')
                ext_type = manifest.get('type')
                is_normal_theme = (category == 'theme' and ext_type != 'ui-theme')
                if not is_normal_theme:
                    continue

                themes.append({
                    'id': item,
                    'name': manifest.get('name', item),
                    'description': manifest.get('description', ''),
                    'css_path': css_path,
                    'colors': manifest.get('colors', {})
                })

            return {'success': True, 'themes': themes}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def load_ui_theme(self, theme_id):
        """Load CSS content for a UI theme extension"""
        try:
            css_path = os.path.join(os.path.expanduser("~"), '.dex-studio',
                                    'extensions', theme_id, 'theme.css')
            if not os.path.exists(css_path):
                return {'success': False, 'error': f'theme.css no encontrado para "{theme_id}"'}
            with open(css_path, 'r', encoding='utf-8') as f:
                css = f.read()
            return {'success': True, 'css': css}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def load_normal_theme(self, theme_id):
        """Load CSS content for a normal theme extension"""
        try:
            css_path = os.path.join(os.path.expanduser("~"), '.dex-studio',
                                    'extensions', theme_id, 'theme.css')
            if not os.path.exists(css_path):
                return {'success': False, 'error': f'theme.css no encontrado para "{theme_id}"'}
            with open(css_path, 'r', encoding='utf-8') as f:
                css = f.read()
            return {'success': True, 'css': css}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def save_custom_ui_layout(self, layout_name, layout_data):
        """Save a custom UI layout configuration"""
        try:
            layouts_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'layouts')
            os.makedirs(layouts_dir, exist_ok=True)
            layout_path = os.path.join(layouts_dir, f'{layout_name}.json')
            with open(layout_path, 'w', encoding='utf-8') as f:
                json.dump(layout_data, f, indent=4)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def load_custom_ui_layout(self, layout_name):
        """Load a UI layout configuration"""
        try:
            layout_path = os.path.join(os.path.expanduser("~"), '.dex-studio',
                                       'layouts', f'{layout_name}.json')
            if not os.path.exists(layout_path):
                return {'success': False, 'error': f'Layout "{layout_name}" no encontrado'}
            with open(layout_path, 'r', encoding='utf-8') as f:
                layout = json.load(f)
            return {'success': True, 'layout': layout}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def list_ui_layouts(self):
        """List all saved UI layouts"""
        try:
            layouts_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'layouts')
            if not os.path.exists(layouts_dir):
                return {'success': True, 'layouts': []}
            layouts = []
            for f in os.listdir(layouts_dir):
                if f.endswith('.json'):
                    layouts.append(os.path.splitext(f)[0])
            return {'success': True, 'layouts': layouts}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def delete_ui_layout(self, layout_name):
        """Delete a saved UI layout"""
        try:
            layout_path = os.path.join(os.path.expanduser("~"), '.dex-studio',
                                       'layouts', f'{layout_name}.json')
            if os.path.exists(layout_path):
                os.remove(layout_path)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Extension marketplace ─────────────────────────────────────────

    def fetch_extension_registry(self):
        """Fetch the extension registry from GitHub"""
        try:
            import urllib.request
            url = 'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/registry.json'
            req = urllib.request.Request(url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
            return {'success': True, 'registry': data}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def fetch_extension_readme(self, ext_id):
        """Fetch README.md for an extension — try local, then author's repo, then central"""
        try:
            import urllib.request
            # Try local first
            ext_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions', ext_id)
            local_readme = os.path.join(ext_dir, 'README.md')
            if os.path.exists(local_readme):
                with open(local_readme, 'r', encoding='utf-8') as f:
                    return {'success': True, 'content': f.read()}

            # Try author's repo
            ext_data = self.ext_db.get_extension(ext_id)
            if ext_data and ext_data.get('repo_url'):
                repo_url = ext_data['repo_url']
                parts = repo_url.rstrip('/').split('/')
                owner = parts[-2]
                repo = parts[-1].replace('.git', '')
                for branch in ['main', 'master']:
                    try:
                        url = f'https://raw.githubusercontent.com/{owner}/{repo}/{branch}/README.md'
                        req = urllib.request.Request(url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                        with urllib.request.urlopen(req, timeout=10) as response:
                            return {'success': True, 'content': response.read().decode('utf-8')}
                    except:
                        continue

            # Fallback to central repo
            url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/README.md'
            req = urllib.request.Request(url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                return {'success': True, 'content': response.read().decode('utf-8')}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def fetch_extension_manifest(self, ext_id):
        """Fetch manifest.json for an extension from GitHub"""
        try:
            import urllib.request
            url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/manifest.json'
            req = urllib.request.Request(url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
            return {'success': True, 'manifest': data}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def install_extension(self, ext_id):
        """Download and install an extension from GitHub"""
        try:
            import urllib.request
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            ext_dir = os.path.join(modules_dir, ext_id)

            # Check if already installed
            if os.path.exists(ext_dir):
                return {'success': False, 'error': 'Extensión ya instalada'}

            os.makedirs(ext_dir, exist_ok=True)

            # Get manifest first to know what files to download
            manifest_url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/manifest.json'
            req = urllib.request.Request(manifest_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                manifest = json.loads(response.read().decode('utf-8'))

            # Save manifest
            with open(os.path.join(ext_dir, 'manifest.json'), 'w') as f:
                json.dump(manifest, f, indent=4)

            # Download extension entrypoint (main.js or extension.dex.js)
            js_downloaded = False
            for js_name in ['main.js', 'extension.dex.js']:
                try:
                    js_url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/{js_name}'
                    req = urllib.request.Request(js_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                    with urllib.request.urlopen(req, timeout=10) as response:
                        js_code = response.read().decode('utf-8')
                    with open(os.path.join(ext_dir, js_name), 'w') as f:
                        f.write(js_code)
                    js_downloaded = True
                    break
                except urllib.error.HTTPError:
                    continue
            if not js_downloaded:
                raise FileNotFoundError(f'No se encontró main.js ni extension.dex.js para "{ext_id}"')

            # Download README.md
            try:
                readme_url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/README.md'
                req = urllib.request.Request(readme_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                with urllib.request.urlopen(req, timeout=10) as response:
                    readme = response.read().decode('utf-8')
                with open(os.path.join(ext_dir, 'README.md'), 'w') as f:
                    f.write(readme)
            except:
                pass

            # Check for wordlists directory (for autocompletado-type extensions)
            if manifest.get('has_wordlists'):
                wl_dir = os.path.join(ext_dir, 'wordlists')
                os.makedirs(wl_dir, exist_ok=True)
                for lang in ['python', 'javascript', 'html', 'css']:
                    try:
                        wl_url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/wordlists/{lang}.json'
                        req = urllib.request.Request(wl_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                        with urllib.request.urlopen(req, timeout=10) as response:
                            wl_data = response.read().decode('utf-8')
                        with open(os.path.join(wl_dir, f'{lang}.json'), 'w') as f:
                            f.write(wl_data)
                    except:
                        pass

            # Download additional files declared in manifest
            extra_files = manifest.get('files', [])
            for extra in extra_files:
                try:
                    f_url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/{extra}'
                    req = urllib.request.Request(f_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                    with urllib.request.urlopen(req, timeout=10) as response:
                        f_content = response.read().decode('utf-8')
                    f_path = os.path.join(ext_dir, extra)
                    os.makedirs(os.path.dirname(f_path), exist_ok=True)
                    with open(f_path, 'w', encoding='utf-8') as f:
                        f.write(f_content)
                except:
                    pass

            # For theme/ui-theme extensions, try downloading theme.css even if not listed in manifest.files
            try:
                if manifest.get('category') in ('theme', 'ui-theme') or manifest.get('type') == 'ui-theme':
                    css_url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/theme.css'
                    req = urllib.request.Request(css_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                    with urllib.request.urlopen(req, timeout=10) as response:
                        css_content = response.read().decode('utf-8')
                    with open(os.path.join(ext_dir, 'theme.css'), 'w', encoding='utf-8') as f:
                        f.write(css_content)
            except:
                pass

            self.ext_db.mark_installed(ext_id)
            self.ext_db.add_extension({
                'id': ext_id,
                'name': manifest.get('name', ext_id),
                'version': manifest.get('version', '1.0.0'),
                'description': manifest.get('description', ''),
                'author': manifest.get('author', ''),
                'category': manifest.get('category', 'editor'),
                'icon': manifest.get('icon', 'puzzle'),
                'color': manifest.get('color', 'linear-gradient(135deg, #667eea, #764ba2)')
            })
            return {'success': True, 'message': f'Extensión "{manifest.get("name", ext_id)}" instalada correctamente'}
        except urllib.error.HTTPError as e:
            if os.path.exists(ext_dir):
                shutil.rmtree(ext_dir, ignore_errors=True)
            if e.code == 404:
                return {'success': False, 'error': f'Error 404: Los archivos de la extensión "{ext_id}" no existen en el repositorio. Puede que la extensión no esté publicada correctamente.'}
            return {'success': False, 'error': f'Error HTTP {e.code}: {e.reason}'}
        except Exception as e:
            if os.path.exists(ext_dir):
                shutil.rmtree(ext_dir, ignore_errors=True)
            return {'success': False, 'error': str(e)}

    def uninstall_extension(self, ext_id):
        """Uninstall an extension"""
        try:
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            ext_dir = os.path.join(modules_dir, ext_id)
            if not os.path.exists(ext_dir):
                return {'success': False, 'error': 'Extensión no encontrada'}
            shutil.rmtree(ext_dir)
            self.ext_db.mark_uninstalled(ext_id)
            return {'success': True, 'message': f'Extensión "{ext_id}" desinstalada'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def toggle_extension(self, ext_id):
        """Activa o desactiva una extensión sin desinstalarla"""
        try:
            is_currently_disabled = self.ext_db.is_disabled(ext_id)
            self.ext_db.set_disabled(ext_id, not is_currently_disabled)
            new_state = 'desactivada' if not is_currently_disabled else 'activada'
            return {'success': True, 'message': f'Extensión "{ext_id}" {new_state}', 'disabled': not is_currently_disabled}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_installed_extensions_info(self):
        """Retorna info completa de todas las extensiones instaladas en disco"""
        try:
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            if not os.path.exists(modules_dir):
                return {'success': True, 'extensions': []}
            result = []
            for item in sorted(os.listdir(modules_dir)):
                ext_dir = os.path.join(modules_dir, item)
                if not os.path.isdir(ext_dir):
                    continue
                ext_info = {'id': item, 'name': item, 'version': '1.0.0', 'description': '', 'author': '', 'category': 'editor', 'icon': 'puzzle', 'color': '#667eea', 'installed': True}
                # Leer manifest.json si existe
                manifest_path = os.path.join(ext_dir, 'manifest.json')
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, 'r', encoding='utf-8') as f:
                            manifest = json.load(f)
                        ext_info.update({
                            'name': manifest.get('name', item),
                            'version': manifest.get('version', '1.0.0'),
                            'description': manifest.get('description', ''),
                            'author': manifest.get('author', ''),
                            'category': manifest.get('category', 'editor'),
                            'icon': manifest.get('icon', 'puzzle'),
                            'color': manifest.get('color', '#667eea')
                        })
                    except Exception:
                        pass
                # Enriquecer con datos de la DB
                db_data = self.ext_db.get_extension(item)
                if db_data:
                    ext_info['installed_at'] = db_data.get('installed_at', '')
                    ext_info['downloads'] = db_data.get('downloads', 0)
                    ext_info['repo_url'] = db_data.get('repo_url', '')
                    ext_info['is_published'] = db_data.get('is_published', 0)
                    ext_info['is_disabled'] = db_data.get('is_disabled', 0)
                else:
                    ext_info['is_disabled'] = 0
                result.append(ext_info)
            return {'success': True, 'extensions': result}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def compile_zip(self):
        """Package current project as .zip"""
        if not self.current_project_path:
            return {'success': False, 'error': 'No hay un proyecto abierto.'}
        try:
            import zipfile
            project_name = os.path.basename(self.current_project_path)
            build_dir = os.path.join(self.current_project_path, 'build')
            os.makedirs(build_dir, exist_ok=True)
            zip_path = os.path.join(build_dir, project_name + '.zip')
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(self.current_project_path):
                    # Skip build dir and hidden dirs
                    dirs[:] = [d for d in dirs if d != 'build' and not d.startswith('.')]
                    for file in files:
                        if file.startswith('.'):
                            continue
                        full_path = os.path.join(root, file)
                        arc_name = os.path.relpath(full_path, self.current_project_path)
                        zf.write(full_path, os.path.join(project_name, arc_name))
            return {'success': True, 'message': f'ZIP creado: {zip_path}', 'path': zip_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def compile_tar(self):
        """Package current project as .tar.gz"""
        if not self.current_project_path:
            return {'success': False, 'error': 'No hay un proyecto abierto.'}
        try:
            import tarfile
            project_name = os.path.basename(self.current_project_path)
            build_dir = os.path.join(self.current_project_path, 'build')
            os.makedirs(build_dir, exist_ok=True)
            tar_path = os.path.join(build_dir, project_name + '.tar.gz')
            with tarfile.open(tar_path, 'w:gz') as tf:
                for root, dirs, files in os.walk(self.current_project_path):
                    dirs[:] = [d for d in dirs if d != 'build' and not d.startswith('.')]
                    for file in files:
                        if file.startswith('.'):
                            continue
                        full_path = os.path.join(root, file)
                        arc_name = os.path.join(project_name, os.path.relpath(full_path, self.current_project_path))
                        tf.add(full_path, arcname=arc_name)
            return {'success': True, 'message': f'Exportado: {tar_path}', 'path': tar_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_run_config(self):
        """Get run configuration from project metadata"""
        if not self.current_project_path:
            return {'success': False, 'error': 'No hay proyecto abierto'}
        try:
            meta_path = os.path.join(self.current_project_path, 'metadata.json')
            if os.path.exists(meta_path):
                with open(meta_path, 'r') as f:
                    meta = json.load(f)
                return {'success': True, 'config': meta.get('run_config', {
                    'main_file': 'main.py',
                    'interpreter': 'python3',
                    'args': '',
                    'use_terminal': False
                })}
            return {'success': True, 'config': {
                'main_file': 'main.py',
                'interpreter': 'python3',
                'args': '',
                'use_terminal': False
            }}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def save_run_config(self, config):
        """Save run configuration to project metadata"""
        if not self.current_project_path:
            return {'success': False, 'error': 'No hay proyecto abierto'}
        try:
            meta_path = os.path.join(self.current_project_path, 'metadata.json')
            meta = {}
            if os.path.exists(meta_path):
                with open(meta_path, 'r') as f:
                    meta = json.load(f)
            meta['run_config'] = config
            with open(meta_path, 'w') as f:
                json.dump(meta, f, indent=4)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def check_is_extension_project(self):
        """Check if current project is an extension"""
        if not self.current_project_path:
            return {'success': True, 'is_extension': False}
        manifest = os.path.join(self.current_project_path, 'manifest.json')
        ext_js = os.path.join(self.current_project_path, 'extension.dex.js')
        return {'success': True, 'is_extension': os.path.exists(manifest) or os.path.exists(ext_js)}

    def publish_extension(self, token):
        """Publish extension from current project to DEX-EXTENSIONS repo"""
        if not self.current_project_path:
            return {'success': False, 'error': 'No hay proyecto abierto'}
        if not token or not token.strip():
            return {'success': False, 'error': 'Token de GitHub vacío. Configúralo en Ajustes → GitHub Token.'}
        token = token.strip()
        try:
            import urllib.request

            manifest_path = os.path.join(self.current_project_path, 'manifest.json')
            if not os.path.exists(manifest_path):
                return {'success': False, 'error': 'No se encontró manifest.json'}
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)

            ext_id = manifest.get('id')
            if not ext_id:
                return {'success': False, 'error': 'manifest.json no tiene campo "id"'}

            ext_js_path = os.path.join(self.current_project_path, 'extension.dex.js')
            main_js_path = os.path.join(self.current_project_path, 'main.js')
            if os.path.exists(ext_js_path):
                js_path = ext_js_path
            elif os.path.exists(main_js_path):
                js_path = main_js_path
            else:
                return {'success': False, 'error': 'No se encontró extension.dex.js ni main.js'}

            with open(js_path, 'r') as f:
                js_content = f.read()

            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
                'User-Agent': 'DEX-STUDIO/1.0'
            }

            repo = 'farllirs/DEX-EXTENSIONS'

            def upload_file(file_path_in_repo, content_str):
                url = f'https://api.github.com/repos/{repo}/contents/{file_path_in_repo}'
                encoded = base64.b64encode(content_str.encode('utf-8')).decode('utf-8')
                sha = None
                try:
                    req = urllib.request.Request(url, headers=headers)
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        existing = json.loads(resp.read().decode('utf-8'))
                        sha = existing.get('sha')
                except:
                    pass
                body = {
                    'message': f'Publish extension: {manifest.get("name", ext_id)}',
                    'content': encoded
                }
                if sha:
                    body['sha'] = sha
                data = json.dumps(body).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers=headers, method='PUT')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return json.loads(resp.read().decode('utf-8'))

            upload_file(f'extensions/{ext_id}/main.js', js_content)
            # Keep compatibility with extension loader variants
            upload_file(f'extensions/{ext_id}/extension.dex.js', js_content)

            with open(manifest_path, 'r') as f:
                manifest_content = f.read()
            upload_file(f'extensions/{ext_id}/manifest.json', manifest_content)

            readme_path = os.path.join(self.current_project_path, 'README.md')
            if os.path.exists(readme_path):
                with open(readme_path, 'r') as f:
                    readme_content = f.read()
                upload_file(f'extensions/{ext_id}/README.md', readme_content)

            # Upload theme.css when present so marketplace installs can detect themes
            theme_css_path = os.path.join(self.current_project_path, 'theme.css')
            if os.path.exists(theme_css_path):
                with open(theme_css_path, 'r', encoding='utf-8') as f:
                    theme_css_content = f.read()
                upload_file(f'extensions/{ext_id}/theme.css', theme_css_content)

            registry_url = f'https://api.github.com/repos/{repo}/contents/registry.json'
            req = urllib.request.Request(registry_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                registry_data = json.loads(resp.read().decode('utf-8'))

            registry_sha = registry_data.get('sha')
            registry_content = base64.b64decode(registry_data['content']).decode('utf-8')
            registry = json.loads(registry_content)

            extensions_list = registry.get('extensions', [])
            new_entry = {
                'id': ext_id,
                'name': manifest.get('name', ext_id),
                'version': manifest.get('version', '1.0.0'),
                'description': manifest.get('description', ''),
                'author': manifest.get('author', ''),
                'category': manifest.get('category', 'editor'),
                'icon': manifest.get('icon', 'puzzle'),
                'color': manifest.get('color', 'linear-gradient(135deg, #667eea, #764ba2)')
            }
            found = False
            for i, ext in enumerate(extensions_list):
                if ext.get('id') == ext_id:
                    extensions_list[i] = new_entry
                    found = True
                    break
            if not found:
                extensions_list.append(new_entry)

            registry['extensions'] = extensions_list
            new_registry_content = json.dumps(registry, indent=4)

            registry_body = {
                'message': f'Update registry: {manifest.get("name", ext_id)}',
                'content': base64.b64encode(new_registry_content.encode('utf-8')).decode('utf-8'),
                'sha': registry_sha
            }
            data = json.dumps(registry_body).encode('utf-8')
            req = urllib.request.Request(registry_url, data=data, headers=headers, method='PUT')
            with urllib.request.urlopen(req, timeout=15) as resp:
                pass

            return {'success': True, 'message': f'Extensión "{manifest.get("name", ext_id)}" publicada en DEX-EXTENSIONS'}
        except urllib.error.HTTPError as e:
            if e.code == 403:
                return {'success': False, 'error': 'Error 403: Token sin permisos de escritura. Asegúrate de que el token tenga el scope "repo" y seas colaborador del repositorio DEX-EXTENSIONS.'}
            elif e.code == 404:
                return {'success': False, 'error': 'Error 404: Repositorio no encontrado. Verifica que el repositorio farllirs/DEX-EXTENSIONS existe.'}
            elif e.code == 401:
                return {'success': False, 'error': 'Error 401: Token inválido o expirado. Genera uno nuevo en GitHub → Settings → Personal Access Tokens.'}
            elif e.code == 422:
                return {'success': False, 'error': 'Error 422: Conflicto al subir. Intenta de nuevo.'}
            return {'success': False, 'error': f'Error HTTP {e.code}: {e.reason}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Extension system v2 ─────────────────────────────────────────

    def create_github_repo(self, token, name, description=''):
        """Create a new GitHub repository"""
        try:
            import urllib.request
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
                'User-Agent': 'DEX-STUDIO/1.0'
            }
            body = json.dumps({
                'name': name,
                'description': description,
                'private': False,
                'auto_init': True
            }).encode('utf-8')
            req = urllib.request.Request('https://api.github.com/user/repos', data=body, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=15) as resp:
                repo_data = json.loads(resp.read().decode('utf-8'))
            return {'success': True, 'repo_url': repo_data.get('html_url')}
        except urllib.error.HTTPError as e:
            return {'success': False, 'error': f'Error HTTP {e.code}: {e.reason}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def publish_extension_v2(self, token, repo_url=None, create_new=False, repo_name=None):
        """Publish extension to author's own GitHub repo and update central registry"""
        if not self.current_project_path:
            return {'success': False, 'error': 'No hay proyecto abierto'}
        if not token or not token.strip():
            return {'success': False, 'error': 'Token de GitHub vacío. Configúralo en Ajustes → GitHub Token.'}
        token = token.strip()
        try:
            import urllib.request

            manifest_path = os.path.join(self.current_project_path, 'manifest.json')
            if not os.path.exists(manifest_path):
                return {'success': False, 'error': 'No se encontró manifest.json'}
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)

            ext_id = manifest.get('id')
            if not ext_id:
                return {'success': False, 'error': 'manifest.json no tiene campo "id"'}

            ext_js_path = os.path.join(self.current_project_path, 'extension.dex.js')
            main_js_path = os.path.join(self.current_project_path, 'main.js')
            if os.path.exists(ext_js_path):
                js_path = ext_js_path
            elif os.path.exists(main_js_path):
                js_path = main_js_path
            else:
                return {'success': False, 'error': 'No se encontró extension.dex.js ni main.js'}

            with open(js_path, 'r') as f:
                js_content = f.read()

            # Create new repo if requested
            if create_new:
                name = repo_name or f'dex-ext-{ext_id}'
                result = self.create_github_repo(token, name, manifest.get('description', ''))
                if not result.get('success'):
                    return result
                repo_url = result['repo_url']

            if not repo_url:
                return {'success': False, 'error': 'No se proporcionó URL del repositorio'}

            # Parse owner/repo from URL
            parts = repo_url.rstrip('/').split('/')
            owner = parts[-2]
            repo = parts[-1].replace('.git', '')

            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
                'User-Agent': 'DEX-STUDIO/1.0'
            }

            def upload_file_to_repo(file_path_in_repo, content_str):
                url = f'https://api.github.com/repos/{owner}/{repo}/contents/{file_path_in_repo}'
                encoded = base64.b64encode(content_str.encode('utf-8')).decode('utf-8')
                sha = None
                try:
                    req = urllib.request.Request(url, headers=headers)
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        existing = json.loads(resp.read().decode('utf-8'))
                        sha = existing.get('sha')
                except:
                    pass
                body = {
                    'message': f'Publish extension: {manifest.get("name", ext_id)}',
                    'content': encoded
                }
                if sha:
                    body['sha'] = sha
                data = json.dumps(body).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers=headers, method='PUT')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return json.loads(resp.read().decode('utf-8'))

            # Upload ALL project files to author's repo
            for root, dirs, files in os.walk(self.current_project_path):
                dirs[:] = [d for d in dirs if d != 'build' and not d.startswith('.')]
                for fname in files:
                    if fname.startswith('.'):
                        continue
                    full_path = os.path.join(root, fname)
                    rel_path = os.path.relpath(full_path, self.current_project_path)
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            file_content = f.read()
                        upload_file_to_repo(rel_path, file_content)
                    except (UnicodeDecodeError, Exception):
                        pass

            # Build entry for registry/DB
            new_entry = {
                'id': ext_id,
                'name': manifest.get('name', ext_id),
                'version': manifest.get('version', '1.0.0'),
                'description': manifest.get('description', ''),
                'author': manifest.get('author', ''),
                'category': manifest.get('category', 'editor'),
                'icon': manifest.get('icon', 'puzzle'),
                'color': manifest.get('color', 'linear-gradient(135deg, #667eea, #764ba2)'),
                'repo_url': repo_url
            }

            # Try to update central registry (optional — may fail with 403 if not collaborator)
            registry_updated = False
            try:
                central_repo = 'farllirs/DEX-EXTENSIONS'
                registry_url = f'https://api.github.com/repos/{central_repo}/contents/registry.json'
                req = urllib.request.Request(registry_url, headers=headers)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    registry_data = json.loads(resp.read().decode('utf-8'))

                registry_sha = registry_data.get('sha')
                registry_content = base64.b64decode(registry_data['content']).decode('utf-8')
                registry = json.loads(registry_content)

                extensions_list = registry.get('extensions', [])
                found = False
                for i, ext in enumerate(extensions_list):
                    if ext.get('id') == ext_id:
                        extensions_list[i] = new_entry
                        found = True
                        break
                if not found:
                    extensions_list.append(new_entry)

                registry['extensions'] = extensions_list
                new_registry_content = json.dumps(registry, indent=4)

                registry_body = {
                    'message': f'Update registry: {manifest.get("name", ext_id)}',
                    'content': base64.b64encode(new_registry_content.encode('utf-8')).decode('utf-8'),
                    'sha': registry_sha
                }
                data = json.dumps(registry_body).encode('utf-8')
                req = urllib.request.Request(registry_url, data=data, headers=headers, method='PUT')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    pass
                registry_updated = True
            except urllib.error.HTTPError:
                pass
            except Exception:
                pass

            # Register in local DB
            self.ext_db.add_extension(new_entry)
            self.ext_db.mark_published(ext_id, repo_url)

            msg = f'Extensión "{manifest.get("name", ext_id)}" publicada en {repo_url}'
            if not registry_updated:
                msg += ' (registro central pendiente — se actualizará cuando un admin apruebe)'
            return {'success': True, 'message': msg, 'repo_url': repo_url}
        except urllib.error.HTTPError as e:
            if e.code == 403:
                return {'success': False, 'error': 'Error 403: Token sin permisos. Verifica que el token tenga scope "repo" y que el repositorio exista y sea tuyo.'}
            elif e.code == 404:
                return {'success': False, 'error': 'Error 404: Repositorio no encontrado. Verifica la URL.'}
            elif e.code == 401:
                return {'success': False, 'error': 'Error 401: Token inválido o expirado. Genera uno nuevo en GitHub → Settings → Developer Settings → Personal Access Tokens.'}
            elif e.code == 422:
                return {'success': False, 'error': 'Error 422: Conflicto al subir. Intenta de nuevo.'}
            return {'success': False, 'error': f'Error HTTP {e.code}: {e.reason}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def install_extension_v2(self, ext_id, repo_url=None):
        """Download and install an extension from the author's GitHub repo"""
        try:
            import urllib.request
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            ext_dir = os.path.join(modules_dir, ext_id)

            if os.path.exists(ext_dir):
                return {'success': False, 'error': 'Extensión ya instalada'}

            # Look up repo_url if not provided
            if not repo_url:
                ext_data = self.ext_db.get_extension(ext_id)
                if ext_data and ext_data.get('repo_url'):
                    repo_url = ext_data['repo_url']

            if not repo_url:
                # Try fetching from remote registry
                try:
                    reg_url = 'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/registry.json'
                    req = urllib.request.Request(reg_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                    with urllib.request.urlopen(req, timeout=10) as response:
                        registry = json.loads(response.read().decode('utf-8'))
                    for ext in registry.get('extensions', []):
                        if ext.get('id') == ext_id and ext.get('repo_url'):
                            repo_url = ext['repo_url']
                            break
                except:
                    pass

            if not repo_url:
                return {'success': False, 'error': f'No se encontró repo_url para la extensión "{ext_id}"'}

            # Parse owner/repo from URL
            parts = repo_url.rstrip('/').split('/')
            owner = parts[-2]
            repo = parts[-1].replace('.git', '')

            os.makedirs(ext_dir, exist_ok=True)

            # Detect default branch (try main, then master)
            branch = 'main'
            for try_branch in ['main', 'master']:
                try:
                    test_url = f'https://raw.githubusercontent.com/{owner}/{repo}/{try_branch}/manifest.json'
                    req = urllib.request.Request(test_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                    with urllib.request.urlopen(req, timeout=8) as response:
                        manifest = json.loads(response.read().decode('utf-8'))
                    branch = try_branch
                    break
                except urllib.error.HTTPError:
                    manifest = None
                    continue

            if not manifest:
                if os.path.exists(ext_dir):
                    shutil.rmtree(ext_dir, ignore_errors=True)
                return {'success': False, 'error': f'No se encontró manifest.json en el repositorio {owner}/{repo} (branch main ni master)'}

            with open(os.path.join(ext_dir, 'manifest.json'), 'w') as f:
                json.dump(manifest, f, indent=4)

            # Download main.js (or extension.dex.js)
            main_downloaded = False
            for js_name in ['main.js', 'extension.dex.js']:
                try:
                    js_url = f'https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{js_name}'
                    req = urllib.request.Request(js_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                    with urllib.request.urlopen(req, timeout=10) as response:
                        main_code = response.read().decode('utf-8')
                    with open(os.path.join(ext_dir, js_name), 'w') as f:
                        f.write(main_code)
                    main_downloaded = True
                    break
                except urllib.error.HTTPError:
                    continue

            if not main_downloaded:
                if os.path.exists(ext_dir):
                    shutil.rmtree(ext_dir, ignore_errors=True)
                return {'success': False, 'error': f'No se encontró main.js ni extension.dex.js en {owner}/{repo}'}

            # Download additional files from manifest
            extra_files = manifest.get('files', [])
            for extra in extra_files:
                try:
                    f_url = f'https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{extra}'
                    req = urllib.request.Request(f_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                    with urllib.request.urlopen(req, timeout=10) as response:
                        f_content = response.read().decode('utf-8')
                    f_path = os.path.join(ext_dir, extra)
                    os.makedirs(os.path.dirname(f_path), exist_ok=True)
                    with open(f_path, 'w', encoding='utf-8') as f:
                        f.write(f_content)
                except:
                    pass

            # For theme/ui-theme extensions, try downloading theme.css even if not listed in manifest.files
            try:
                if manifest.get('category') in ('theme', 'ui-theme') or manifest.get('type') == 'ui-theme':
                    css_url = f'https://raw.githubusercontent.com/{owner}/{repo}/{branch}/theme.css'
                    req = urllib.request.Request(css_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                    with urllib.request.urlopen(req, timeout=10) as response:
                        css_content = response.read().decode('utf-8')
                    with open(os.path.join(ext_dir, 'theme.css'), 'w', encoding='utf-8') as f:
                        f.write(css_content)
            except:
                pass

            # Try downloading README.md
            try:
                readme_url = f'https://raw.githubusercontent.com/{owner}/{repo}/{branch}/README.md'
                req = urllib.request.Request(readme_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                with urllib.request.urlopen(req, timeout=10) as response:
                    readme = response.read().decode('utf-8')
                with open(os.path.join(ext_dir, 'README.md'), 'w') as f:
                    f.write(readme)
            except:
                pass

            # Register in DB
            self.ext_db.mark_installed(ext_id)
            self.ext_db.add_extension({
                'id': ext_id,
                'name': manifest.get('name', ext_id),
                'version': manifest.get('version', '1.0.0'),
                'description': manifest.get('description', ''),
                'author': manifest.get('author', ''),
                'category': manifest.get('category', 'editor'),
                'icon': manifest.get('icon', 'puzzle'),
                'color': manifest.get('color', 'linear-gradient(135deg, #667eea, #764ba2)'),
                'repo_url': repo_url
            })
            self.ext_db.increment_downloads(ext_id)

            return {'success': True, 'message': f'Extensión "{manifest.get("name", ext_id)}" instalada correctamente'}
        except urllib.error.HTTPError as e:
            if os.path.exists(ext_dir):
                shutil.rmtree(ext_dir, ignore_errors=True)
            if e.code == 404:
                return {'success': False, 'error': f'Error 404: Los archivos de la extensión "{ext_id}" no existen en el repositorio.'}
            return {'success': False, 'error': f'Error HTTP {e.code}: {e.reason}'}
        except Exception as e:
            if os.path.exists(ext_dir):
                shutil.rmtree(ext_dir, ignore_errors=True)
            return {'success': False, 'error': str(e)}

    def search_extensions(self, query):
        """Search extensions in local DB"""
        try:
            results = self.ext_db.search_extensions(query)
            return {'success': True, 'extensions': results}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_extension_stats(self, ext_id):
        """Get stats for an extension"""
        try:
            ext_data = self.ext_db.get_extension(ext_id)
            if not ext_data:
                return {'success': False, 'error': f'Extensión "{ext_id}" no encontrada'}
            versions = self.ext_db.get_versions(ext_id)
            return {
                'success': True,
                'stats': {
                    'id': ext_data.get('id'),
                    'name': ext_data.get('name'),
                    'version': ext_data.get('version'),
                    'downloads': ext_data.get('downloads', 0),
                    'installed': ext_data.get('installed', False),
                    'author': ext_data.get('author', ''),
                    'versions': versions
                }
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def update_extension(self, ext_id, token):
        """Update an existing published extension (bump version, upload new files, update registry)"""
        if not self.current_project_path:
            return {'success': False, 'error': 'No hay proyecto abierto'}
        if not token or not token.strip():
            return {'success': False, 'error': 'Token de GitHub vacío.'}
        token = token.strip()
        try:
            import urllib.request

            manifest_path = os.path.join(self.current_project_path, 'manifest.json')
            if not os.path.exists(manifest_path):
                return {'success': False, 'error': 'No se encontró manifest.json'}
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)

            if manifest.get('id') != ext_id:
                return {'success': False, 'error': f'El manifest.json no corresponde a la extensión "{ext_id}"'}

            # Bump patch version
            version = manifest.get('version', '1.0.0')
            version_parts = version.split('.')
            if len(version_parts) == 3:
                version_parts[2] = str(int(version_parts[2]) + 1)
                manifest['version'] = '.'.join(version_parts)
            else:
                manifest['version'] = version + '.1'

            # Save bumped manifest
            with open(manifest_path, 'w') as f:
                json.dump(manifest, f, indent=4)

            # Get repo_url from DB or manifest
            ext_data = self.ext_db.get_extension(ext_id)
            repo_url = None
            if ext_data:
                repo_url = ext_data.get('repo_url')
            if not repo_url:
                repo_url = manifest.get('repo_url')
            if not repo_url:
                return {'success': False, 'error': 'No se encontró repo_url para esta extensión. Publícala primero con publish_extension_v2.'}

            # Parse owner/repo
            parts = repo_url.rstrip('/').split('/')
            owner = parts[-2]
            repo = parts[-1].replace('.git', '')

            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
                'User-Agent': 'DEX-STUDIO/1.0'
            }

            def upload_file_to_repo(file_path_in_repo, content_str):
                url = f'https://api.github.com/repos/{owner}/{repo}/contents/{file_path_in_repo}'
                encoded = base64.b64encode(content_str.encode('utf-8')).decode('utf-8')
                sha = None
                try:
                    req = urllib.request.Request(url, headers=headers)
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        existing = json.loads(resp.read().decode('utf-8'))
                        sha = existing.get('sha')
                except:
                    pass
                body = {
                    'message': f'Update extension: {manifest.get("name", ext_id)} v{manifest["version"]}',
                    'content': encoded
                }
                if sha:
                    body['sha'] = sha
                data = json.dumps(body).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers=headers, method='PUT')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return json.loads(resp.read().decode('utf-8'))

            # Upload ALL project files to author's repo
            for root, dirs, files in os.walk(self.current_project_path):
                dirs[:] = [d for d in dirs if d != 'build' and not d.startswith('.')]
                for fname in files:
                    if fname.startswith('.'):
                        continue
                    full_path = os.path.join(root, fname)
                    rel_path = os.path.relpath(full_path, self.current_project_path)
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            file_content = f.read()
                        upload_file_to_repo(rel_path, file_content)
                    except (UnicodeDecodeError, Exception):
                        pass

            # Build entry for registry/DB
            new_entry = {
                'id': ext_id,
                'name': manifest.get('name', ext_id),
                'version': manifest.get('version', '1.0.0'),
                'description': manifest.get('description', ''),
                'author': manifest.get('author', ''),
                'category': manifest.get('category', 'editor'),
                'icon': manifest.get('icon', 'puzzle'),
                'color': manifest.get('color', 'linear-gradient(135deg, #667eea, #764ba2)'),
                'repo_url': repo_url
            }

            # Try to update central registry (optional — may fail with 403 if not collaborator)
            registry_updated = False
            try:
                central_repo = 'farllirs/DEX-EXTENSIONS'
                registry_url = f'https://api.github.com/repos/{central_repo}/contents/registry.json'
                req = urllib.request.Request(registry_url, headers=headers)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    registry_data = json.loads(resp.read().decode('utf-8'))

                registry_sha = registry_data.get('sha')
                registry_content = base64.b64decode(registry_data['content']).decode('utf-8')
                registry = json.loads(registry_content)

                extensions_list = registry.get('extensions', [])
                found = False
                for i, ext in enumerate(extensions_list):
                    if ext.get('id') == ext_id:
                        extensions_list[i] = new_entry
                        found = True
                        break
                if not found:
                    extensions_list.append(new_entry)

                registry['extensions'] = extensions_list
                new_registry_content = json.dumps(registry, indent=4)

                registry_body = {
                    'message': f'Update registry: {manifest.get("name", ext_id)} v{manifest["version"]}',
                    'content': base64.b64encode(new_registry_content.encode('utf-8')).decode('utf-8'),
                    'sha': registry_sha
                }
                data = json.dumps(registry_body).encode('utf-8')
                req = urllib.request.Request(registry_url, data=data, headers=headers, method='PUT')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    pass
                registry_updated = True
            except urllib.error.HTTPError:
                pass
            except Exception:
                pass

            # Update local DB
            self.ext_db.add_extension(new_entry)
            self.ext_db.mark_published(ext_id, repo_url)

            msg = f'Extensión "{manifest.get("name", ext_id)}" actualizada a v{manifest["version"]}'
            if not registry_updated:
                msg += ' (registro central pendiente — se actualizará cuando un admin apruebe)'
            return {'success': True, 'message': msg}
        except urllib.error.HTTPError as e:
            if e.code == 403:
                return {'success': False, 'error': 'Error 403: Token sin permisos. Verifica que el token tenga scope "repo" y que el repositorio exista y sea tuyo.'}
            elif e.code == 404:
                return {'success': False, 'error': 'Error 404: Repositorio no encontrado. Verifica la URL.'}
            elif e.code == 401:
                return {'success': False, 'error': 'Error 401: Token inválido o expirado. Genera uno nuevo en GitHub → Settings → Developer Settings → Personal Access Tokens.'}
            elif e.code == 422:
                return {'success': False, 'error': 'Error 422: Conflicto al subir. Intenta de nuevo.'}
            return {'success': False, 'error': f'Error HTTP {e.code}: {e.reason}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_installed_extensions_v2(self):
        """Get installed extensions from DB"""
        try:
            extensions = self.ext_db.get_installed_extensions()
            return {'success': True, 'extensions': extensions}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def sync_extension_registry(self):
        """Fetch remote registry and sync with local DB"""
        try:
            import urllib.request
            hide_after_days = int(os.getenv('DEX_EXT_UNAVAILABLE_HIDE_DAYS', '14'))
            check_interval_hours = int(os.getenv('DEX_EXT_AVAIL_CHECK_HOURS', '24'))
            now = datetime.utcnow()

            # Availability cache persisted in user_config
            cache_key = 'marketplace_repo_status_v1'
            try:
                availability_cache = json.loads(self.ext_db.get_config(cache_key) or '{}')
                if not isinstance(availability_cache, dict):
                    availability_cache = {}
            except Exception:
                availability_cache = {}

            def _parse_repo(repo_url):
                if not repo_url or 'github.com' not in repo_url:
                    return None, None
                parts = repo_url.rstrip('/').split('/')
                if len(parts) < 2:
                    return None, None
                owner = parts[-2]
                repo = parts[-1].replace('.git', '')
                return owner, repo

            def _repo_has_manifest(repo_url):
                owner, repo = _parse_repo(repo_url)
                if not owner or not repo:
                    return False
                for branch in ['main', 'master']:
                    try:
                        test_url = f'https://raw.githubusercontent.com/{owner}/{repo}/{branch}/manifest.json'
                        req = urllib.request.Request(test_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
                        with urllib.request.urlopen(req, timeout=8):
                            return True
                    except Exception:
                        continue
                return False

            url = 'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/registry.json'
            req = urllib.request.Request(url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                registry = json.loads(response.read().decode('utf-8'))

            remote_extensions = registry.get('extensions', [])

            # Sync each remote extension into local DB
            for ext in remote_extensions:
                self.ext_db.add_extension(ext)

            # Build merged list — check DISK for real install status
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            merged = []
            for ext in remote_extensions:
                ext_id = ext.get('id')
                local = self.ext_db.get_extension(ext_id)
                entry = dict(ext)
                # Verificar si existe en disco (fuente de verdad)
                ext_dir = os.path.join(modules_dir, ext_id)
                entry['installed'] = os.path.isdir(ext_dir)
                if local:
                    entry['downloads'] = local.get('downloads', 0)
                    entry['is_disabled'] = local.get('is_disabled', 0)
                else:
                    entry['downloads'] = 0
                    entry['is_disabled'] = 0

                # Detect unavailable repos and hide after grace period
                repo_url = entry.get('repo_url')
                state = availability_cache.get(ext_id, {})
                status = state.get('status', 'ok')
                last_check = state.get('last_check')
                should_check = True

                if last_check:
                    try:
                        last_dt = datetime.fromisoformat(last_check)
                        if now - last_dt < timedelta(hours=check_interval_hours):
                            should_check = False
                    except Exception:
                        should_check = True

                if repo_url and should_check:
                    ok = _repo_has_manifest(repo_url)
                    state['last_check'] = now.isoformat()
                    if ok:
                        state['status'] = 'ok'
                        state.pop('first_unavailable_at', None)
                        state.pop('last_unavailable_at', None)
                    else:
                        state['status'] = 'unavailable'
                        if not state.get('first_unavailable_at'):
                            state['first_unavailable_at'] = now.isoformat()
                        state['last_unavailable_at'] = now.isoformat()

                availability_cache[ext_id] = state
                status = state.get('status', status)

                unavailable_since = state.get('first_unavailable_at')
                is_unavailable = (status == 'unavailable')
                hide_from_marketplace = False
                if is_unavailable and unavailable_since:
                    try:
                        first_dt = datetime.fromisoformat(unavailable_since)
                        hide_from_marketplace = (now - first_dt) >= timedelta(days=hide_after_days)
                    except Exception:
                        hide_from_marketplace = False

                entry['unavailable'] = bool(is_unavailable)
                entry['unavailable_since'] = unavailable_since
                entry['hidden'] = bool(hide_from_marketplace)
                entry['availability_message'] = 'Extensión no disponible' if is_unavailable else ''

                if not hide_from_marketplace:
                    merged.append(entry)

            # Persist refreshed availability cache
            try:
                self.ext_db.set_config(cache_key, json.dumps(availability_cache))
            except Exception:
                pass

            return {'success': True, 'extensions': merged}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def run_extension_python(self, ext_id, script_name, args=''):
        """Run a Python script from an extension's folder"""
        try:
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            ext_dir = os.path.join(modules_dir, ext_id)
            if not os.path.exists(ext_dir):
                return {'success': False, 'error': f'Extensión "{ext_id}" no encontrada'}
            script_path = os.path.realpath(os.path.join(ext_dir, script_name))
            if not script_path.startswith(os.path.realpath(ext_dir)):
                return {'success': False, 'error': 'Acceso denegado: ruta fuera del directorio de la extensión'}
            if not os.path.exists(script_path):
                return {'success': False, 'error': f'Script no encontrado: {script_name}'}
            cmd = f'python3 "{script_path}" {args}'
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=ext_dir, timeout=30)
            return {
                'success': True,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'code': result.returncode
            }
        except subprocess.TimeoutExpired:
            return {'success': False, 'error': 'Timeout: el script tardó más de 30 segundos'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def list_extension_files(self, ext_id):
        """List all files in an extension's directory"""
        try:
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            ext_dir = os.path.join(modules_dir, ext_id)
            if not os.path.exists(ext_dir):
                return {'success': False, 'error': f'Extensión "{ext_id}" no encontrada'}
            files = []
            for root, dirs, filenames in os.walk(ext_dir):
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                for fname in filenames:
                    if fname.startswith('.'):
                        continue
                    full = os.path.join(root, fname)
                    rel = os.path.relpath(full, ext_dir)
                    files.append(rel)
            return {'success': True, 'files': files}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def write_extension_file(self, ext_id, file_path, content):
        """Write a file inside an extension's directory"""
        try:
            modules_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions')
            ext_dir = os.path.join(modules_dir, ext_id)
            full_path = os.path.realpath(os.path.join(ext_dir, file_path))
            if not full_path.startswith(os.path.realpath(ext_dir)):
                return {'success': False, 'error': 'Acceso denegado: ruta fuera del directorio de la extensión'}
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── File operations for explorer ──────────────────────────────────

    def move_item(self, source_path, dest_dir):
        """Move a file or folder to a destination directory"""
        try:
            if not os.path.exists(source_path):
                return {'success': False, 'error': 'Archivo/carpeta no encontrado'}
            if not os.path.isdir(dest_dir):
                return {'success': False, 'error': 'Destino no es un directorio'}
            name = os.path.basename(source_path)
            dest_path = os.path.join(dest_dir, name)
            if os.path.exists(dest_path):
                return {'success': False, 'error': f'Ya existe "{name}" en el destino'}
            shutil.move(source_path, dest_path)
            return {'success': True, 'new_path': dest_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def create_file_at(self, dir_path, file_name):
        """Create a new file inside a specific directory"""
        try:
            if not os.path.isdir(dir_path):
                return {'success': False, 'error': 'Directorio no existe'}
            full_path = os.path.join(dir_path, file_name)
            if os.path.exists(full_path):
                return {'success': False, 'error': 'El archivo ya existe'}
            # Create parent dirs if file_name contains subdirs
            parent = os.path.dirname(full_path)
            if parent != dir_path:
                os.makedirs(parent, exist_ok=True)
            with open(full_path, 'w') as f:
                f.write('')
            return {'success': True, 'path': full_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def create_folder_at(self, dir_path, folder_name):
        """Create a new folder inside a specific directory"""
        try:
            full_path = os.path.join(dir_path, folder_name)
            if os.path.exists(full_path):
                return {'success': False, 'error': 'La carpeta ya existe'}
            os.makedirs(full_path, exist_ok=True)
            return {'success': True, 'path': full_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def file_exists(self, path):
        """Check if a file or directory exists"""
        try:
            return {'success': True, 'exists': os.path.exists(path)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def ext_storage_get(self, ext_id, key):
        """Get a stored value for an extension"""
        try:
            storage_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions', ext_id)
            storage_file = os.path.join(storage_dir, '.storage.json')
            if os.path.exists(storage_file):
                with open(storage_file, 'r') as f:
                    data = json.load(f)
                return {'success': True, 'value': data.get(key)}
            return {'success': True, 'value': None}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def ext_storage_set(self, ext_id, key, value):
        """Set a stored value for an extension"""
        try:
            storage_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions', ext_id)
            storage_file = os.path.join(storage_dir, '.storage.json')
            data = {}
            if os.path.exists(storage_file):
                with open(storage_file, 'r') as f:
                    data = json.load(f)
            data[key] = value
            os.makedirs(storage_dir, exist_ok=True)
            with open(storage_file, 'w') as f:
                json.dump(data, f, indent=2)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def ext_storage_delete(self, ext_id, key):
        """Delete a stored value for an extension"""
        try:
            storage_dir = os.path.join(os.path.expanduser("~"), '.dex-studio', 'extensions', ext_id)
            storage_file = os.path.join(storage_dir, '.storage.json')
            if not os.path.exists(storage_file):
                return {'success': True}
            with open(storage_file, 'r') as f:
                data = json.load(f)
            data.pop(key, None)
            with open(storage_file, 'w') as f:
                json.dump(data, f, indent=2)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def git_diff(self, path=None):
        """Get git diff for current project or specific file"""
        try:
            cwd = self.current_project_path or os.getcwd()
            cmd = ['git', 'diff']
            if path:
                cmd.extend(['--', path])
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
            return {'success': True, 'diff': result.stdout}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def duplicate_item(self, path):
        """Duplicate a file or folder"""
        try:
            if not os.path.exists(path):
                return {'success': False, 'error': 'No encontrado'}
            parent = os.path.dirname(path)
            name = os.path.basename(path)
            base, ext = os.path.splitext(name)
            new_name = f'{base} (copia){ext}'
            new_path = os.path.join(parent, new_name)
            counter = 1
            while os.path.exists(new_path):
                counter += 1
                new_name = f'{base} (copia {counter}){ext}'
                new_path = os.path.join(parent, new_name)
            if os.path.isdir(path):
                shutil.copytree(path, new_path)
            else:
                shutil.copy2(path, new_path)
            return {'success': True, 'new_path': new_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}
