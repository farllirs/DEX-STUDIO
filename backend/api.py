import os
import json
import shutil
import subprocess
import re
import base64
from backend.packager import Packager

class API:
    def __init__(self):
        self.window = None
        self.current_project_path = None
        self.projects_root = os.path.join(os.path.expanduser("~"), 'DEX_Projects')
        os.makedirs(self.projects_root, exist_ok=True)

    def set_window(self, window):
        self.window = window

    def toggle_devtools(self):
        if self.window:
            return {'success': True, 'message': 'Usa CTRL+SHIFT+I para inspeccionar (Modo Debug Activo)'}
        return {'success': False}

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
                '{{IDENTIFIER}}': metadata['identifier']
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
            if os.path.exists(os.path.join(path, 'metadata.json')):
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
            modules_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'modules')
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
            modules_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'modules')
            main_js = os.path.join(modules_dir, name, 'main.js')
            if not os.path.exists(main_js):
                return {'success': False, 'error': f'Módulo "{name}" no encontrado'}
            with open(main_js, 'r', encoding='utf-8') as f:
                code = f.read()
            valid = code.strip().endswith('// Dex code successful')
            return {'success': True, 'code': code, 'valid': valid}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def load_module_file(self, module_name, file_path):
        try:
            modules_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'modules')
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
        """Fetch README.md for an extension from GitHub"""
        try:
            import urllib.request
            url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/README.md'
            req = urllib.request.Request(url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                content = response.read().decode('utf-8')
            return {'success': True, 'content': content}
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
            modules_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'modules')
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

            # Download main.js
            main_url = f'https://raw.githubusercontent.com/farllirs/DEX-EXTENSIONS/main/extensions/{ext_id}/main.js'
            req = urllib.request.Request(main_url, headers={'User-Agent': 'DEX-STUDIO/1.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                main_code = response.read().decode('utf-8')
            with open(os.path.join(ext_dir, 'main.js'), 'w') as f:
                f.write(main_code)

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

            return {'success': True, 'message': f'Extensión "{manifest.get("name", ext_id)}" instalada correctamente'}
        except Exception as e:
            # Clean up on failure
            if os.path.exists(ext_dir):
                shutil.rmtree(ext_dir, ignore_errors=True)
            return {'success': False, 'error': str(e)}

    def uninstall_extension(self, ext_id):
        """Uninstall an extension"""
        try:
            modules_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'modules')
            ext_dir = os.path.join(modules_dir, ext_id)
            if not os.path.exists(ext_dir):
                return {'success': False, 'error': 'Extensión no encontrada'}
            shutil.rmtree(ext_dir)
            return {'success': True, 'message': f'Extensión "{ext_id}" desinstalada'}
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
