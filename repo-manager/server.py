import http.server
import json
import os
import subprocess
import sys
import webbrowser
from urllib.parse import urlparse

PORT = 8080
REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Timeout máximo en segundos para cualquier comando git (60s por defecto)
GIT_TIMEOUT = 60

def run_git(args, cwd=REPO_DIR, timeout=None):
    """Ejecuta un comando git de forma segura con timeout."""
    t = timeout if timeout is not None else GIT_TIMEOUT
    try:
        res = subprocess.run(
            ['git'] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=True,
            timeout=t
        )
        return res.stdout.strip(), res.stderr.strip(), 0
    except subprocess.TimeoutExpired:
        msg = f"⏱️ Comando 'git {' '.join(args)}' superó el límite de {t}s y fue cancelado."
        return "", msg, -2
    except subprocess.CalledProcessError as e:
        return e.stdout.strip(), e.stderr.strip(), e.returncode
    except Exception as e:
        return "", str(e), -1

def parse_gitmodules():
    """Parsea .gitmodules manualmente para ser robusto ante formatos."""
    gitmodules_path = os.path.join(REPO_DIR, ".gitmodules")
    submodules = {}
    if not os.path.exists(gitmodules_path):
        return submodules

    current_name = None
    with open(gitmodules_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('[submodule') and '"' in line:
                current_name = line.split('"')[1]
                submodules[current_name] = {'name': current_name}
            elif current_name and '=' in line:
                key, val = line.split('=', 1)
                key = key.strip()
                val = val.strip().strip('"')
                submodules[current_name][key] = val
    return submodules

def get_gitlinks():
    """Obtiene los gitlinks (mode 160000) en el índice de Git."""
    stdout, _, code = run_git(['ls-files', '--stage'])
    gitlinks = {}
    if code == 0:
        for line in stdout.splitlines():
            if line.startswith('160000'):
                parts = line.split(maxsplit=3)
                if len(parts) >= 4:
                    hsh = parts[1]
                    path = parts[3].strip()
                    gitlinks[path] = hsh
    return gitlinks

def get_repo_status():
    """Retorna el estado detallado del repositorio principal y submódulos."""
    # Estado del Repositorio Padre
    p_branch, _, _ = run_git(['branch', '--show-current'])
    if not p_branch:
        p_branch, _, _ = run_git(['rev-parse', '--abbrev-ref', 'HEAD'])
    
    p_commit, _, _ = run_git(['rev-parse', '--short', 'HEAD'])
    p_status, _, _ = run_git(['status', '--porcelain'])
    p_unpushed, _, _ = run_git(['log', '@{u}..HEAD', '--oneline'])
    
    parent_info = {
        'branch': p_branch or 'Desconocida',
        'commit': p_commit or 'N/A',
        'has_changes': bool(p_status),
        'has_unpushed': bool(p_unpushed),
        'status_raw': p_status
    }

    # Procesar Submódulos
    gitmodules = parse_gitmodules()
    gitlinks = get_gitlinks()

    # Combinamos ambas fuentes
    all_submodule_paths = set(gitlinks.keys())
    for name, data in gitmodules.items():
        if 'path' in data:
            all_submodule_paths.add(data['path'])

    submodules_list = []
    for path in sorted(all_submodule_paths):
        # Encontrar los metadatos en .gitmodules
        sub_meta = next((data for data in gitmodules.values() if data.get('path') == path), None)
        
        # Estado inicial
        info = {
            'name': sub_meta['name'] if sub_meta else os.path.basename(path),
            'path': path,
            'url': sub_meta.get('url', 'Sin configurar en .gitmodules') if sub_meta else 'Sin configurar en .gitmodules',
            'status': 'active',
            'branch': 'HEAD',
            'commit': gitlinks.get(path, 'N/A'),
            'has_changes': False,
            'has_unpushed': False,
            'sync_status': 'unknown',
            'error': None
        }

        # Detección de Discrepancias
        is_in_modules = sub_meta is not None
        is_in_index = path in gitlinks

        if is_in_modules and not is_in_index:
            info['status'] = 'not_in_index'
            info['error'] = 'No registrado en el índice de Git. Ejecuta "git submodule update --init".'
            submodules_list.append(info)
            continue
        elif is_in_index and not is_in_modules:
            info['status'] = 'missing_mapping'
            info['error'] = 'Conflicto: Registrado en Git index pero falta el mapeo en .gitmodules.'
            submodules_list.append(info)
            continue

        # Submódulo normal, verificar existencia de carpeta
        sub_full_path = os.path.join(REPO_DIR, path)
        if not os.path.exists(sub_full_path):
            info['status'] = 'missing_folder'
            info['error'] = 'Carpeta física no encontrada.'
            submodules_list.append(info)
            continue

        # Verificar si está inicializado (contiene archivo o carpeta .git)
        git_sub_indicator = os.path.join(sub_full_path, '.git')
        if not os.path.exists(git_sub_indicator):
            info['status'] = 'uninitialized'
            info['error'] = 'No inicializado. Carpeta vacía o sin archivos Git.'
            submodules_list.append(info)
            continue

        # Leer estado dentro del submódulo
        # 1. Commit actual
        s_commit, _, _ = run_git(['rev-parse', '--short', 'HEAD'], cwd=sub_full_path)
        if s_commit:
            info['commit'] = s_commit

        # 2. Rama actual y sincronización
        s_status_sb, _, s_code = run_git(['status', '-sb'], cwd=sub_full_path)
        if s_code == 0 and s_status_sb:
            first_line = s_status_sb.splitlines()[0] if s_status_sb else ''
            # parse branch
            if first_line.startswith('## '):
                branch_part = first_line[3:]
                if 'HEAD (no branch)' in branch_part:
                    info['branch'] = 'Detached HEAD ⚠️'
                    info['sync_status'] = 'detached'
                else:
                    # branch...remote
                    if '...' in branch_part:
                        branch_name, remote_part = branch_part.split('...', 1)
                        info['branch'] = branch_name
                        if 'ahead' in remote_part:
                            info['has_unpushed'] = True
                        if 'behind' in remote_part:
                            info['sync_status'] = 'behind'
                        else:
                            info['sync_status'] = 'synced'
                    else:
                        info['branch'] = branch_part
                        info['sync_status'] = 'no_remote_tracking'

        # 3. Cambios sin hacer commit
        s_status, _, _ = run_git(['status', '--porcelain'], cwd=sub_full_path)
        info['has_changes'] = bool(s_status)
        info['status_raw'] = s_status

        # 4. Obtener URL remota real
        s_url, _, _ = run_git(['config', '--get', 'remote.origin.url'], cwd=sub_full_path)
        if s_url:
            info['url'] = s_url

        submodules_list.append(info)

    return {
        'parent': parent_info,
        'submodules': submodules_list
    }

class VaultManagerHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Desactivamos logs en la consola estándar para mantenerla limpia
        pass

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        # Servir archivos estáticos
        if self.path in ('/', '/index.html'):
            self.serve_file('index.html', 'text/html')
        elif self.path == '/styles.css':
            self.serve_file('styles.css', 'text/css')
        elif self.path == '/app.js':
            self.serve_file('app.js', 'application/javascript')
        elif self.path == '/api/status':
            try:
                status_data = get_repo_status()
                self.send_json(status_data)
            except Exception as e:
                self.send_json({'error': str(e)}, 500)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b''
        
        try:
            params = json.loads(post_data.decode('utf-8')) if post_data else {}
        except Exception:
            params = {}

        # Endpoints de la API
        if self.path == '/api/submodule/action':
            sub_path = params.get('path')
            action = params.get('action') # 'pull', 'push', 'checkout_main', 'commit'
            
            if not sub_path or not action:
                return self.send_json({'error': 'Faltan parámetros path o action'}, 400)
            
            sub_full_path = os.path.join(REPO_DIR, sub_path)
            
            if action == 'pull':
                # Intentar pull origin/main o origin/master
                stdout, stderr, code = run_git(['pull', 'origin', 'main'], cwd=sub_full_path)
                if code != 0:
                    stdout, stderr, code = run_git(['pull', 'origin', 'master'], cwd=sub_full_path)
                self.send_json({'stdout': stdout, 'stderr': stderr, 'code': code})
                
            elif action == 'push':
                # Intentar subir
                # Obtener rama actual
                branch, _, _ = run_git(['branch', '--show-current'], cwd=sub_full_path)
                if not branch or branch == 'HEAD':
                    branch = 'main'
                stdout, stderr, code = run_git(['push', 'origin', branch], cwd=sub_full_path)
                self.send_json({'stdout': stdout, 'stderr': stderr, 'code': code})
                
            elif action == 'checkout_main':
                # Primero probar main, luego master
                stdout, stderr, code = run_git(['checkout', 'main'], cwd=sub_full_path)
                if code != 0:
                    stdout, stderr, code = run_git(['checkout', 'master'], cwd=sub_full_path)
                self.send_json({'stdout': stdout, 'stderr': stderr, 'code': code})
                
            elif action == 'commit':
                msg = params.get('message', 'Actualización rápida desde Repo-Manager')
                # Add y commit dentro del submódulo
                stdout_add, stderr_add, code_add = run_git(['add', '.'], cwd=sub_full_path)
                if code_add == 0:
                    stdout_c, stderr_c, code_c = run_git(['commit', '-m', msg], cwd=sub_full_path)
                    self.send_json({'stdout': stdout_c, 'stderr': stderr_c, 'code': code_c})
                else:
                    self.send_json({'stdout': stdout_add, 'stderr': stderr_add, 'code': code_add})
            else:
                self.send_json({'error': f'Acción no soportada: {action}'}, 400)

        elif self.path == '/api/submodule/add':
            url = params.get('url')
            sub_path = params.get('path')
            branch = params.get('branch')
            
            if not url or not sub_path:
                return self.send_json({'error': 'Faltan parámetros url o path'}, 400)

            # Ejecuta git submodule add
            args = ['submodule', 'add']
            if branch:
                args += ['-b', branch]
            args += [url, sub_path]

            stdout, stderr, code = run_git(args)
            self.send_json({'stdout': stdout, 'stderr': stderr, 'code': code})

        elif self.path == '/api/vault/deploy':
            msg = params.get('message', 'deploy: quick update via repo-manager')
            
            # Flujo de deploy en el padre: add ., commit, push
            stdout_add, stderr_add, code_add = run_git(['add', '.'])
            if code_add == 0:
                stdout_c, stderr_c, code_c = run_git(['commit', '-m', msg])
                stdout_p, stderr_p, code_p = run_git(['push', 'origin', 'main'])
                self.send_json({
                    'stdout': f"Add: {stdout_add}\nCommit: {stdout_c}\nPush: {stdout_p}",
                    'stderr': f"{stderr_add}\n{stderr_c}\n{stderr_p}",
                    'code': code_p
                })
            else:
                self.send_json({'stdout': stdout_add, 'stderr': stderr_add, 'code': code_add})

        elif self.path == '/api/troubleshoot/fix-cached':
            target_path = params.get('path')
            if not target_path:
                return self.send_json({'error': 'Falta el parámetro path'}, 400)
            
            # Ejecuta git rm --cached para limpiar referencias fantasma
            stdout, stderr, code = run_git(['rm', '--cached', target_path])
            self.send_json({'stdout': stdout, 'stderr': stderr, 'code': code})

        elif self.path == '/api/troubleshoot/convert-to-submodule':
            target_path = params.get('path')
            url = params.get('url')
            if not target_path or not url:
                return self.send_json({'error': 'Faltan parámetros path o url'}, 400)

            # Paso 1: Eliminar la referencia huérfana del índice
            stdout_rm, stderr_rm, code_rm = run_git(['rm', '--cached', target_path])
            if code_rm != 0:
                return self.send_json({
                    'stdout': stdout_rm,
                    'stderr': stderr_rm,
                    'code': code_rm,
                    'step': 'git rm --cached'
                })

            # Paso 2: Agregar como submódulo real
            stdout_add, stderr_add, code_add = run_git(['submodule', 'add', url, target_path])
            self.send_json({
                'stdout': f"[rm --cached]\n{stdout_rm}\n\n[submodule add]\n{stdout_add}",
                'stderr': f"{stderr_rm}\n{stderr_add}",
                'code': code_add,
                'step': 'submodule add'
            })

        elif self.path == '/api/troubleshoot/update-all':
            stdout, stderr, code = run_git(['submodule', 'update', '--remote', '--merge'])
            self.send_json({'stdout': stdout, 'stderr': stderr, 'code': code})

        elif self.path == '/api/troubleshoot/init-all':
            stdout, stderr, code = run_git(['submodule', 'update', '--init', '--recursive'])
            self.send_json({'stdout': stdout, 'stderr': stderr, 'code': code})
            
        else:
            self.send_json({'error': 'Ruta no encontrada'}, 404)

    def serve_file(self, filename, content_type):
        filepath = os.path.join(os.path.dirname(__file__), filename)
        if os.path.exists(filepath):
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.end_headers()

class ThreadedVaultServer(http.server.ThreadingHTTPServer):
    """Servidor multi-hilo: cada request se maneja en su propio hilo.
    Esto evita que un comando git lento bloquee toda la interfaz."""
    daemon_threads = True  # Los hilos mueren al cerrar el servidor

def main():
    if not os.path.exists(os.path.join(REPO_DIR, ".git")):
        print(f"ERROR: No se detectó un repositorio git en {REPO_DIR}")
        sys.exit(1)

    server = ThreadedVaultServer(('localhost', PORT), VaultManagerHandler)
    print(f"Servidor de Repo-Vault activo en http://localhost:{PORT}")
    print(f"Timeout por comando git: {GIT_TIMEOUT}s")
    print("Presiona Ctrl+C para detener el servidor.")
    
    # Abrir navegador automáticamente
    webbrowser.open(f"http://localhost:{PORT}")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido por el usuario.")
        server.server_close()

if __name__ == '__main__':
    main()
