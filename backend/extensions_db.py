import os
import json
import sqlite3
from datetime import datetime


class ExtensionsDB:
    """Gestor de base de datos SQLite para el sistema de extensiones de DEX STUDIO"""

    def __init__(self):
        self.db_dir = os.path.join(os.path.expanduser("~"), '.dex-studio')
        os.makedirs(self.db_dir, exist_ok=True)
        self.db_path = os.path.join(self.db_dir, 'extensions.db')
        self._init_tables()

    def _connect(self):
        """Crea conexión con row_factory para obtener diccionarios"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_tables(self):
        """Inicializa las tablas si no existen"""
        try:
            with self._connect() as conn:
                conn.executescript('''
                    CREATE TABLE IF NOT EXISTS extensions (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        version TEXT,
                        description TEXT,
                        author TEXT,
                        category TEXT,
                        icon TEXT,
                        color TEXT,
                        repo_url TEXT,
                        main_file TEXT,
                        installed_at TEXT,
                        updated_at TEXT,
                        downloads INTEGER DEFAULT 0,
                        is_published INTEGER DEFAULT 0,
                        manifest_json TEXT
                    );

                    CREATE TABLE IF NOT EXISTS extension_versions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ext_id TEXT REFERENCES extensions(id),
                        version TEXT,
                        changelog TEXT,
                        published_at TEXT,
                        commit_sha TEXT
                    );

                    CREATE TABLE IF NOT EXISTS user_config (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    );
                ''')
                # Migración: agregar is_disabled si no existe
                try:
                    conn.execute('ALTER TABLE extensions ADD COLUMN is_disabled INTEGER DEFAULT 0')
                except Exception:
                    pass
        except Exception as e:
            print(f'[ExtensionsDB] Error inicializando tablas: {e}')

    # ── Extensiones ───────────────────────────────────────────────────

    def add_extension(self, ext_data: dict) -> bool:
        """Inserta o actualiza una extensión en la base de datos"""
        try:
            now = datetime.now().isoformat()
            with self._connect() as conn:
                conn.execute('''
                    INSERT INTO extensions (id, name, version, description, author, category,
                        icon, color, repo_url, main_file, installed_at, updated_at,
                        downloads, is_published, manifest_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name=excluded.name,
                        version=excluded.version,
                        description=excluded.description,
                        author=excluded.author,
                        category=excluded.category,
                        icon=excluded.icon,
                        color=excluded.color,
                        repo_url=excluded.repo_url,
                        main_file=excluded.main_file,
                        updated_at=excluded.updated_at,
                        downloads=excluded.downloads,
                        is_published=excluded.is_published,
                        manifest_json=excluded.manifest_json
                ''', (
                    ext_data.get('id'),
                    ext_data.get('name'),
                    ext_data.get('version'),
                    ext_data.get('description'),
                    ext_data.get('author'),
                    ext_data.get('category', 'editor'),
                    ext_data.get('icon', 'puzzle'),
                    ext_data.get('color', '#667eea'),
                    ext_data.get('repo_url'),
                    ext_data.get('main_file', 'main.js'),
                    ext_data.get('installed_at'),
                    now,
                    ext_data.get('downloads', 0),
                    ext_data.get('is_published', 0),
                    ext_data.get('manifest_json') or json.dumps(ext_data)
                ))
            return True
        except Exception as e:
            print(f'[ExtensionsDB] Error agregando extensión: {e}')
            return False

    def remove_extension(self, ext_id: str) -> bool:
        """Elimina una extensión y sus versiones de la base de datos"""
        try:
            with self._connect() as conn:
                conn.execute('DELETE FROM extension_versions WHERE ext_id = ?', (ext_id,))
                conn.execute('DELETE FROM extensions WHERE id = ?', (ext_id,))
            return True
        except Exception as e:
            print(f'[ExtensionsDB] Error eliminando extensión: {e}')
            return False

    def get_extension(self, ext_id: str):
        """Obtiene una extensión por su ID, retorna dict o None"""
        try:
            with self._connect() as conn:
                row = conn.execute('SELECT * FROM extensions WHERE id = ?', (ext_id,)).fetchone()
                return dict(row) if row else None
        except Exception as e:
            print(f'[ExtensionsDB] Error obteniendo extensión: {e}')
            return None

    def get_all_extensions(self) -> list:
        """Retorna todas las extensiones registradas"""
        try:
            with self._connect() as conn:
                rows = conn.execute('SELECT * FROM extensions ORDER BY name').fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f'[ExtensionsDB] Error listando extensiones: {e}')
            return []

    def get_installed_extensions(self) -> list:
        """Retorna extensiones que están instaladas (installed_at no es null)"""
        try:
            with self._connect() as conn:
                rows = conn.execute(
                    'SELECT * FROM extensions WHERE installed_at IS NOT NULL ORDER BY name'
                ).fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f'[ExtensionsDB] Error listando extensiones instaladas: {e}')
            return []

    def get_published_extensions(self) -> list:
        """Retorna extensiones publicadas (is_published = 1)"""
        try:
            with self._connect() as conn:
                rows = conn.execute(
                    'SELECT * FROM extensions WHERE is_published = 1 ORDER BY name'
                ).fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f'[ExtensionsDB] Error listando extensiones publicadas: {e}')
            return []

    def search_extensions(self, query: str) -> list:
        """Busca extensiones por nombre, descripción o autor"""
        try:
            pattern = f'%{query}%'
            with self._connect() as conn:
                rows = conn.execute('''
                    SELECT * FROM extensions
                    WHERE name LIKE ? OR description LIKE ? OR author LIKE ?
                    ORDER BY name
                ''', (pattern, pattern, pattern)).fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f'[ExtensionsDB] Error buscando extensiones: {e}')
            return []

    def increment_downloads(self, ext_id: str):
        """Incrementa el contador de descargas de una extensión"""
        try:
            with self._connect() as conn:
                conn.execute(
                    'UPDATE extensions SET downloads = downloads + 1 WHERE id = ?',
                    (ext_id,)
                )
        except Exception as e:
            print(f'[ExtensionsDB] Error incrementando descargas: {e}')

    # ── Versiones ─────────────────────────────────────────────────────

    def add_version(self, ext_id: str, version: str, changelog: str = '', commit_sha: str = ''):
        """Registra una nueva versión para una extensión"""
        try:
            now = datetime.now().isoformat()
            with self._connect() as conn:
                conn.execute('''
                    INSERT INTO extension_versions (ext_id, version, changelog, published_at, commit_sha)
                    VALUES (?, ?, ?, ?, ?)
                ''', (ext_id, version, changelog, now, commit_sha))
                # Actualizar versión en la tabla principal
                conn.execute(
                    'UPDATE extensions SET version = ?, updated_at = ? WHERE id = ?',
                    (version, now, ext_id)
                )
        except Exception as e:
            print(f'[ExtensionsDB] Error agregando versión: {e}')

    def get_versions(self, ext_id: str) -> list:
        """Retorna todas las versiones de una extensión, ordenadas de más reciente a más antigua"""
        try:
            with self._connect() as conn:
                rows = conn.execute('''
                    SELECT * FROM extension_versions
                    WHERE ext_id = ?
                    ORDER BY published_at DESC
                ''', (ext_id,)).fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f'[ExtensionsDB] Error obteniendo versiones: {e}')
            return []

    def get_latest_version(self, ext_id: str):
        """Retorna la versión más reciente de una extensión, o None"""
        try:
            with self._connect() as conn:
                row = conn.execute('''
                    SELECT * FROM extension_versions
                    WHERE ext_id = ?
                    ORDER BY published_at DESC
                    LIMIT 1
                ''', (ext_id,)).fetchone()
                return dict(row) if row else None
        except Exception as e:
            print(f'[ExtensionsDB] Error obteniendo última versión: {e}')
            return None

    # ── Configuración de usuario ──────────────────────────────────────

    def set_config(self, key: str, value: str):
        """Guarda un valor de configuración"""
        try:
            with self._connect() as conn:
                conn.execute('''
                    INSERT INTO user_config (key, value) VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value=excluded.value
                ''', (key, value))
        except Exception as e:
            print(f'[ExtensionsDB] Error guardando config: {e}')

    def get_config(self, key: str):
        """Obtiene un valor de configuración, retorna str o None"""
        try:
            with self._connect() as conn:
                row = conn.execute(
                    'SELECT value FROM user_config WHERE key = ?', (key,)
                ).fetchone()
                return row['value'] if row else None
        except Exception as e:
            print(f'[ExtensionsDB] Error obteniendo config: {e}')
            return None

    # ── Sincronización y estado ───────────────────────────────────────

    def sync_from_registry(self, registry_extensions: list):
        """Sincroniza datos del registro remoto con la base de datos local.
        Para extensiones no instaladas, solo guarda metadata.
        Para extensiones instaladas, actualiza si hay nueva versión disponible."""
        try:
            with self._connect() as conn:
                now = datetime.now().isoformat()
                for ext in registry_extensions:
                    ext_id = ext.get('id')
                    if not ext_id:
                        continue

                    existing = conn.execute(
                        'SELECT * FROM extensions WHERE id = ?', (ext_id,)
                    ).fetchone()

                    if existing:
                        # Extensión ya existe — actualizar metadata sin tocar installed_at
                        conn.execute('''
                            UPDATE extensions SET
                                name = ?, version = ?, description = ?, author = ?,
                                category = ?, icon = ?, color = ?, updated_at = ?,
                                manifest_json = ?
                            WHERE id = ?
                        ''', (
                            ext.get('name', existing['name']),
                            ext.get('version', existing['version']),
                            ext.get('description', existing['description']),
                            ext.get('author', existing['author']),
                            ext.get('category', existing['category']),
                            ext.get('icon', existing['icon']),
                            ext.get('color', existing['color']),
                            now,
                            json.dumps(ext),
                            ext_id
                        ))
                    else:
                        # Nueva extensión del registro — solo metadata, no instalada
                        conn.execute('''
                            INSERT INTO extensions (id, name, version, description, author,
                                category, icon, color, updated_at, manifest_json)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            ext_id,
                            ext.get('name'),
                            ext.get('version'),
                            ext.get('description'),
                            ext.get('author'),
                            ext.get('category', 'editor'),
                            ext.get('icon', 'puzzle'),
                            ext.get('color', '#667eea'),
                            now,
                            json.dumps(ext)
                        ))
        except Exception as e:
            print(f'[ExtensionsDB] Error sincronizando registro: {e}')

    def mark_installed(self, ext_id: str):
        """Marca una extensión como instalada (fecha actual)"""
        try:
            now = datetime.now().isoformat()
            with self._connect() as conn:
                conn.execute(
                    'UPDATE extensions SET installed_at = ?, updated_at = ? WHERE id = ?',
                    (now, now, ext_id)
                )
        except Exception as e:
            print(f'[ExtensionsDB] Error marcando como instalada: {e}')

    def mark_uninstalled(self, ext_id: str):
        """Limpia la fecha de instalación (desinstalar)"""
        try:
            now = datetime.now().isoformat()
            with self._connect() as conn:
                conn.execute(
                    'UPDATE extensions SET installed_at = NULL, updated_at = ? WHERE id = ?',
                    (now, ext_id)
                )
        except Exception as e:
            print(f'[ExtensionsDB] Error marcando como desinstalada: {e}')

    def mark_published(self, ext_id: str, repo_url: str):
        """Marca una extensión como publicada y establece su repo_url"""
        try:
            now = datetime.now().isoformat()
            with self._connect() as conn:
                conn.execute(
                    'UPDATE extensions SET is_published = 1, repo_url = ?, updated_at = ? WHERE id = ?',
                    (repo_url, now, ext_id)
                )
        except Exception as e:
            print(f'[ExtensionsDB] Error marcando como publicada: {e}')

    def set_disabled(self, ext_id: str, disabled: bool):
        """Activa o desactiva una extensión"""
        try:
            now = datetime.now().isoformat()
            with self._connect() as conn:
                conn.execute(
                    'UPDATE extensions SET is_disabled = ?, updated_at = ? WHERE id = ?',
                    (1 if disabled else 0, now, ext_id)
                )
        except Exception as e:
            print(f'[ExtensionsDB] Error cambiando estado: {e}')

    def is_disabled(self, ext_id: str) -> bool:
        """Retorna True si la extensión está desactivada"""
        try:
            with self._connect() as conn:
                row = conn.execute(
                    'SELECT is_disabled FROM extensions WHERE id = ?', (ext_id,)
                ).fetchone()
                return bool(row['is_disabled']) if row else False
        except Exception:
            return False
