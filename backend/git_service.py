import os
import re
import subprocess
from urllib.parse import quote, urlparse, urlunparse


class GitService:
    def __init__(self):
        self.default_projects_root = os.path.join(os.path.expanduser('~'), 'DEX_Projects')

    def _expand(self, path):
        return os.path.realpath(os.path.expanduser(path)) if path else None

    def _repo_root(self, cwd):
        try:
            proc = subprocess.run(
                ['git', 'rev-parse', '--show-toplevel'],
                capture_output=True,
                text=True,
                cwd=cwd
            )
            if proc.returncode != 0:
                return None
            return proc.stdout.strip()
        except Exception:
            return None

    def _run_git(self, args, cwd, check=False):
        proc = subprocess.run(
            ['git'] + args,
            capture_output=True,
            text=True,
            cwd=cwd
        )
        ok = proc.returncode == 0
        if check and not ok:
            raw_error = (proc.stderr or proc.stdout or 'Comando git falló').strip()
            error_kind, error_hint = self._classify_git_error(raw_error)
            return {
                'success': False,
                'code': proc.returncode,
                'stdout': proc.stdout or '',
                'stderr': proc.stderr or '',
                'error': raw_error,
                'error_kind': error_kind,
                'hint': error_hint
            }
        return {
            'success': ok,
            'code': proc.returncode,
            'stdout': proc.stdout or '',
            'stderr': proc.stderr or ''
        }

    def _classify_git_error(self, text):
        raw = (text or '').strip()
        lower = raw.lower()

        if 'need to specify how to reconcile divergent branches' in lower:
            return (
                'divergent_pull_strategy',
                'Configura una estrategia de pull (merge, rebase o ff-only) antes de sincronizar.'
            )
        if 'refusing to merge unrelated histories' in lower:
            return (
                'unrelated_histories',
                'El repositorio local y remoto no comparten historial. Usa pull avanzado con historiales no relacionados.'
            )
        if 'would be overwritten by merge' in lower:
            return (
                'local_changes_would_be_overwritten',
                'Tienes cambios locales sin guardar en commits. Haz commit o stash antes de pull.'
            )
        if (
            'no tracking information for the current branch' in lower
            or 'has no upstream branch' in lower
            or 'set-upstream' in lower
        ):
            return (
                'missing_upstream',
                'La branch local no tiene upstream. Vincula la branch actual con origin/<branch>.'
            )
        if 'non-fast-forward' in lower or 'fetch first' in lower:
            return (
                'non_fast_forward',
                'El remoto tiene commits nuevos. Haz pull y resuelve conflictos antes de push.'
            )
        if (
            'authentication failed' in lower
            or 'invalid username or password' in lower
            or 'could not read username' in lower
            or 'permission denied (publickey)' in lower
        ):
            return (
                'auth_failed',
                'Credenciales inválidas o faltantes. Revisa token GitHub/credenciales del remoto.'
            )
        if 'conflict' in lower:
            return (
                'merge_conflict',
                'Hay conflictos de merge. Resuélvelos, crea commit y vuelve a sincronizar.'
            )
        if 'not a git repository' in lower:
            return (
                'not_a_repo',
                'La carpeta seleccionada no es un repositorio Git.'
            )
        return ('git_error', '')

    def _parse_porcelain(self, text):
        changed = []
        for raw in (text or '').splitlines():
            if not raw:
                continue
            if raw.startswith('## '):
                continue
            if len(raw) < 4:
                continue
            x = raw[0]
            y = raw[1]
            path = raw[3:]
            old_path = None
            if ' -> ' in path:
                old_path, path = path.split(' -> ', 1)
            changed.append({
                'index_status': x,
                'worktree_status': y,
                'path': path,
                'old_path': old_path,
                'staged': x not in (' ', '?'),
                'untracked': x == '?' and y == '?'
            })
        return changed

    def _parse_branch_head(self, text):
        branch = 'HEAD'
        ahead = 0
        behind = 0
        line = ''
        for row in (text or '').splitlines():
            if row.startswith('## '):
                line = row[3:]
                break
        if not line:
            return {'branch': branch, 'ahead': ahead, 'behind': behind}

        if line.startswith('No commits yet on '):
            branch = line.replace('No commits yet on ', '', 1).strip()
        elif '...' in line:
            branch = line.split('...')[0].strip()
        else:
            branch = line.split(' ')[0].strip()

        m = re.search(r'\[([^\]]+)\]', line)
        if m:
            info = m.group(1)
            m_a = re.search(r'ahead (\d+)', info)
            m_b = re.search(r'behind (\d+)', info)
            if m_a:
                ahead = int(m_a.group(1))
            if m_b:
                behind = int(m_b.group(1))
        return {'branch': branch, 'ahead': ahead, 'behind': behind}

    def _resolve_current_branch(self, cwd):
        """Return current branch, including unborn branches after git init."""
        head = self._run_git(['symbolic-ref', '--short', 'HEAD'], cwd)
        branch = (head.get('stdout') or '').strip()
        if branch and branch != 'HEAD':
            return branch

        status = self._run_git(['status', '--porcelain', '-b'], cwd)
        info = self._parse_branch_head(status.get('stdout', ''))
        branch = (info.get('branch') or '').strip()
        if branch and branch != 'HEAD':
            return branch

        default_branch = self._run_git(['config', '--get', 'init.defaultBranch'], cwd)
        candidate = (default_branch.get('stdout') or '').strip()
        if candidate:
            return candidate
        return 'main'

    def _inject_token(self, repo_url, token):
        if not token or not repo_url:
            return repo_url
        try:
            p = urlparse(repo_url)
            if p.scheme != 'https':
                return repo_url
            netloc = p.netloc
            if '@' in netloc:
                netloc = netloc.split('@', 1)[1]
            safe_token = quote(token, safe='')
            netloc = f'x-access-token:{safe_token}@{netloc}'
            return urlunparse((p.scheme, netloc, p.path, p.params, p.query, p.fragment))
        except Exception:
            return repo_url

    def list_repos(self, root_path=None):
        try:
            root = self._expand(root_path or self.default_projects_root)
            if not os.path.exists(root):
                return {'success': True, 'repos': []}
            repos = []
            seen = set()
            max_depth = 3
            for current_root, dirs, _files in os.walk(root):
                rel = os.path.relpath(current_root, root)
                depth = 0 if rel == '.' else rel.count(os.sep) + 1
                if depth > max_depth:
                    dirs[:] = []
                    continue
                if '.git' in dirs:
                    if current_root not in seen:
                        seen.add(current_root)
                        repos.append({
                            'name': os.path.basename(current_root),
                            'path': current_root
                        })
                    dirs[:] = [d for d in dirs if d != '.git']
            repos.sort(key=lambda r: r['name'].lower())
            return {'success': True, 'repos': repos, 'root': root}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def create_repo(self, name, root_path=None, init_readme=True):
        try:
            repo_name = (name or '').strip()
            if not repo_name:
                return {'success': False, 'error': 'Nombre de repositorio vacío'}
            safe_name = re.sub(r'[^a-zA-Z0-9._-]+', '-', repo_name).strip('-')
            if not safe_name:
                return {'success': False, 'error': 'Nombre de repositorio inválido'}

            root = self._expand(root_path or self.default_projects_root)
            os.makedirs(root, exist_ok=True)
            target = os.path.join(root, safe_name)
            if os.path.exists(target):
                return {'success': False, 'error': 'Ya existe una carpeta con ese nombre'}
            os.makedirs(target, exist_ok=False)

            init_res = self.init_repo(target)
            if not init_res.get('success'):
                return init_res

            if init_readme:
                readme = os.path.join(target, 'README.md')
                with open(readme, 'w', encoding='utf-8') as f:
                    f.write(f'# {repo_name}\n\nRepositorio creado desde DEX STUDIO.\n')

            return {'success': True, 'path': target, 'name': safe_name, 'message': 'Repositorio creado'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def init_repo(self, project_path, name=None, email=None):
        try:
            cwd = self._expand(project_path)
            if not cwd or not os.path.isdir(cwd):
                return {'success': False, 'error': 'Ruta de proyecto inválida'}

            r = self._run_git(['init'], cwd, check=True)
            if not r['success']:
                return r

            gitignore = os.path.join(cwd, '.gitignore')
            if not os.path.exists(gitignore):
                with open(gitignore, 'w', encoding='utf-8') as f:
                    f.write('build/\n__pycache__/\n*.pyc\n.DS_Store\n')

            if name:
                self._run_git(['config', 'user.name', name], cwd)
            if email:
                self._run_git(['config', 'user.email', email], cwd)

            return {'success': True, 'message': 'Repositorio Git inicializado'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def clone_repo(self, repo_url, destination_root=None, folder_name=None):
        try:
            dest_root = self._expand(destination_root or self.default_projects_root)
            os.makedirs(dest_root, exist_ok=True)

            if folder_name:
                target = os.path.join(dest_root, folder_name)
                args = ['clone', repo_url, target]
            else:
                target = None
                args = ['clone', repo_url]

            proc = self._run_git(args, dest_root, check=True)
            if not proc['success']:
                return proc

            cloned_path = target
            if not cloned_path:
                basename = os.path.basename(urlparse(repo_url).path).replace('.git', '')
                cloned_path = os.path.join(dest_root, basename)

            return {'success': True, 'path': cloned_path, 'message': 'Repositorio clonado'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def set_identity(self, repo_path, name=None, email=None):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            if name:
                self._run_git(['config', 'user.name', name], cwd)
            if email:
                self._run_git(['config', 'user.email', email], cwd)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_identity(self, repo_path):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            name = self._run_git(['config', '--get', 'user.name'], cwd)['stdout'].strip()
            email = self._run_git(['config', '--get', 'user.email'], cwd)['stdout'].strip()
            return {'success': True, 'name': name, 'email': email}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def status(self, repo_path):
        try:
            cwd = self._expand(repo_path)
            root = self._repo_root(cwd)
            if not root:
                return {'success': False, 'error': 'No es un repositorio Git'}

            s = self._run_git(['status', '--porcelain', '-b'], cwd, check=True)
            if not s['success']:
                return s

            branch_info = self._parse_branch_head(s['stdout'])
            changed = self._parse_porcelain(s['stdout'])
            tracked_res = self._run_git(['ls-files'], cwd, check=True)
            if not tracked_res['success']:
                return tracked_res
            tracked_files = [line.strip() for line in tracked_res['stdout'].splitlines() if line.strip()]
            changed_paths = set()
            for item in changed:
                path = item.get('path')
                old_path = item.get('old_path')
                if path:
                    changed_paths.add(path)
                if old_path:
                    changed_paths.add(old_path)
            clean_files = [path for path in tracked_files if path not in changed_paths]

            remote = self._run_git(['remote', '-v'], cwd)
            remotes = []
            for line in remote['stdout'].splitlines():
                parts = line.split()
                if len(parts) >= 3:
                    remotes.append({'name': parts[0], 'url': parts[1], 'scope': parts[2].strip('()')})

            return {
                'success': True,
                'repo_root': root,
                'branch': branch_info['branch'],
                'ahead': branch_info['ahead'],
                'behind': branch_info['behind'],
                'changed_files': changed,
                'changed_count': len(changed),
                'staged_count': len([c for c in changed if c['staged']]),
                'tracked_files': tracked_files,
                'tracked_count': len(tracked_files),
                'clean_files': clean_files,
                'clean_count': len(clean_files),
                'remotes': remotes
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def stage(self, repo_path, paths):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            if not isinstance(paths, list) or not paths:
                return {'success': False, 'error': 'Lista de archivos vacía'}
            r = self._run_git(['add', '--'] + paths, cwd, check=True)
            if not r['success']:
                return r
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def unstage(self, repo_path, paths):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            if not isinstance(paths, list) or not paths:
                return {'success': False, 'error': 'Lista de archivos vacía'}
            r = self._run_git(['restore', '--staged', '--'] + paths, cwd, check=True)
            if not r['success']:
                return r
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def discard(self, repo_path, paths):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            if not isinstance(paths, list) or not paths:
                return {'success': False, 'error': 'Lista de archivos vacía'}
            r = self._run_git(['restore', '--'] + paths, cwd, check=True)
            if not r['success']:
                return r
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def commit(self, repo_path, message):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            msg = (message or '').strip()
            if not msg:
                return {'success': False, 'error': 'Mensaje de commit vacío'}
            r = self._run_git(['commit', '-m', msg], cwd, check=True)
            if not r['success']:
                return r
            return {'success': True, 'message': (r['stdout'] or 'Commit creado').strip()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def branches(self, repo_path):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            r = self._run_git(['branch', '--format=%(refname:short)|%(HEAD)'], cwd, check=True)
            if not r['success']:
                return r
            branches = []
            current = None
            for line in r['stdout'].splitlines():
                if not line.strip():
                    continue
                name, head = (line.split('|', 1) + [''])[:2]
                is_current = head.strip() == '*'
                branches.append({'name': name.strip(), 'current': is_current})
                if is_current:
                    current = name.strip()
            return {'success': True, 'branches': branches, 'current': current}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def checkout_branch(self, repo_path, branch):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            b = (branch or '').strip()
            if not b:
                return {'success': False, 'error': 'Branch inválida'}
            r = self._run_git(['checkout', b], cwd, check=True)
            if not r['success']:
                return r
            return {'success': True, 'message': (r['stdout'] or '').strip()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def create_branch(self, repo_path, branch, checkout=True):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            b = (branch or '').strip()
            if not b:
                return {'success': False, 'error': 'Branch inválida'}
            cmd = ['checkout', '-b', b] if checkout else ['branch', b]
            r = self._run_git(cmd, cwd, check=True)
            if not r['success']:
                return r
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def set_remote(self, repo_path, repo_url, remote='origin'):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            remote = (remote or 'origin').strip()
            repo_url = (repo_url or '').strip()
            if not repo_url:
                return {'success': False, 'error': 'URL de remote vacía'}

            self._run_git(['remote', 'remove', remote], cwd)
            r = self._run_git(['remote', 'add', remote, repo_url], cwd, check=True)
            if not r['success']:
                return r
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def set_pull_strategy(self, repo_path, strategy='merge'):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            mode = (strategy or 'merge').strip().lower()
            if mode not in ('merge', 'rebase', 'ff-only'):
                return {'success': False, 'error': 'Estrategia de pull inválida'}

            if mode == 'rebase':
                r = self._run_git(['config', 'pull.rebase', 'true'], cwd, check=True)
                if not r['success']:
                    return r
                self._run_git(['config', '--unset', 'pull.ff'], cwd)
            elif mode == 'ff-only':
                r = self._run_git(['config', 'pull.ff', 'only'], cwd, check=True)
                if not r['success']:
                    return r
                self._run_git(['config', 'pull.rebase', 'false'], cwd)
            else:
                r = self._run_git(['config', 'pull.rebase', 'false'], cwd, check=True)
                if not r['success']:
                    return r
                self._run_git(['config', '--unset', 'pull.ff'], cwd)

            return {'success': True, 'strategy': mode, 'message': 'Estrategia de pull guardada'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_pull_strategy(self, repo_path):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}

            ff = (self._run_git(['config', '--get', 'pull.ff'], cwd).get('stdout') or '').strip().lower()
            rebase = (self._run_git(['config', '--get', 'pull.rebase'], cwd).get('stdout') or '').strip().lower()

            if ff == 'only':
                strategy = 'ff-only'
            elif rebase in ('true', 'merges', 'interactive'):
                strategy = 'rebase'
            else:
                strategy = 'merge'
            return {'success': True, 'strategy': strategy}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def set_upstream(self, repo_path, remote='origin', branch=None):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            remote_name = (remote or 'origin').strip() or 'origin'
            branch_name = (branch or '').strip() or self._resolve_current_branch(cwd)
            if not branch_name:
                return {'success': False, 'error': 'No se pudo detectar la branch actual'}

            r = self._run_git(
                ['branch', '--set-upstream-to', f'{remote_name}/{branch_name}', branch_name],
                cwd,
                check=True
            )
            if not r['success']:
                return r
            return {
                'success': True,
                'branch': branch_name,
                'remote': remote_name,
                'message': f'Upstream configurado: {branch_name} -> {remote_name}/{branch_name}'
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def push(self, repo_path, remote='origin', branch=None, token=None):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            remote = (remote or 'origin').strip() or 'origin'
            branch = (branch or '').strip()
            original_url = None
            get_url = self._run_git(['remote', 'get-url', remote], cwd, check=True)
            if not get_url.get('success'):
                return get_url
            original_url = get_url.get('stdout', '').strip()
            if not original_url:
                return {'success': False, 'error': f'No existe URL configurada para remote "{remote}"'}

            if not branch:
                branch = self._resolve_current_branch(cwd)
            if not branch:
                return {'success': False, 'error': 'No se pudo detectar la branch actual'}

            authed_url = self._inject_token(original_url, token) if token else original_url
            if authed_url and authed_url != original_url:
                self._run_git(['remote', 'set-url', remote, authed_url], cwd)
            args = ['push', '-u', remote, branch]
            r = self._run_git(args, cwd, check=True)
            if authed_url and authed_url != original_url:
                self._run_git(['remote', 'set-url', remote, original_url], cwd)
            if not r['success']:
                return r
            return {'success': True, 'message': (r['stdout'] or 'Push completado').strip()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def pull(self, repo_path, remote='origin', branch=None, strategy=None, allow_unrelated=False):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            args = ['pull']
            mode = (strategy or '').strip().lower()
            if mode == 'rebase':
                args.append('--rebase')
            elif mode == 'merge':
                args.append('--no-rebase')
            elif mode == 'ff-only':
                args.append('--ff-only')
            if allow_unrelated:
                args.append('--allow-unrelated-histories')
            args.append(remote)
            if branch:
                args.append(branch)
            r = self._run_git(args, cwd, check=True)
            if not r['success']:
                return r
            return {
                'success': True,
                'message': (r['stdout'] or 'Pull completado').strip(),
                'strategy_used': mode or 'default'
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def diff(self, repo_path, path=None):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            args = ['diff']
            if path:
                args += ['--', path]
            r = self._run_git(args, cwd)
            return {'success': True, 'diff': r['stdout']}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def log(self, repo_path, limit=25):
        try:
            cwd = self._expand(repo_path)
            if not self._repo_root(cwd):
                return {'success': False, 'error': 'No es un repositorio Git'}
            try:
                n = max(1, min(int(limit), 200))
            except Exception:
                n = 25
            fmt = '%h|%an|%ad|%s'
            r = self._run_git(['log', f'-n{n}', f'--pretty=format:{fmt}', '--date=short'], cwd, check=True)
            if not r['success']:
                return r
            commits = []
            for line in r['stdout'].splitlines():
                parts = line.split('|', 3)
                if len(parts) != 4:
                    continue
                commits.append({
                    'hash': parts[0],
                    'author': parts[1],
                    'date': parts[2],
                    'subject': parts[3]
                })
            return {'success': True, 'commits': commits}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def dashboard(self, repo_path):
        status = self.status(repo_path)
        if not status.get('success'):
            return status
        branches = self.branches(repo_path)
        logs = self.log(repo_path, 20)
        identity = self.get_identity(repo_path)
        pull_strategy = self.get_pull_strategy(repo_path)
        return {
            'success': True,
            'status': status,
            'branches': branches.get('branches', []),
            'current_branch': branches.get('current') or status.get('branch'),
            'commits': logs.get('commits', []),
            'identity': identity if identity.get('success') else {'success': True, 'name': '', 'email': ''},
            'pull_strategy': pull_strategy.get('strategy') if pull_strategy.get('success') else 'merge'
        }
