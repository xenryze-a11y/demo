#!/usr/bin/env python3
"""Personal PRoot Xfce desktop; separate from bounded command execution.

No public listener, arbitrary command endpoint, account login or messaging loop.
PRoot shares the host kernel and Termux permissions; it is not a security VM.
"""
import argparse
import base64
import configparser
import fcntl
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import select
import shutil
import shlex
import signal
import socket
import subprocess
import tempfile
import threading
import time


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class Desktop:
    width, height = 1280, 800

    def __init__(self, token, state_dir=None, web_root='/usr/share/novnc', workspace=None):
        if not re.fullmatch(r'[a-f0-9]{64}', token):
            raise ValueError('Invalid control token')
        self.token, self.children, self.observed = token, [], 0
        self.owner, self.control_generation = 'ai', 0
        self.jobs, self.applications = {}, []
        self.clipboard = None
        self.web_root = web_root
        self.state_dir = Path(state_dir) if state_dir else Path.home() / '.local/share/xiaoxing-desktop'
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.workspace = Path(workspace) if workspace else Path.home() / 'xiaoxing-workspace'
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.mutex = threading.Lock()
        self.directory = tempfile.TemporaryDirectory(prefix='xiaoxing-desktop-')
        self.root = Path(self.directory.name)
        self.password = secrets.token_hex(4)  # VNC's eight-character limit
        self.vnc_port, self.view_port = free_port(), free_port()
        self.display = ':' + str(100 + secrets.randbelow(800))
        self.env = dict(os.environ, DISPLAY=self.display, XDG_RUNTIME_DIR=str(self.root / 'runtime'))
        self.env['ICEAUTHORITY'] = str(self.root / 'ICEauthority')
        for name in ('SESSION_MANAGER', 'DBUS_SESSION_BUS_ADDRESS', 'DBUS_SESSION_BUS_PID'):
            self.env.pop(name, None)
        for key, subdir in (('XDG_CONFIG_HOME', 'config'), ('XDG_CACHE_HOME', 'cache'), ('XDG_DATA_HOME', 'data')):
            self.env[key] = str(self.state_dir / subdir)
            (self.state_dir / subdir).mkdir(exist_ok=True)
        Path(self.env['XDG_RUNTIME_DIR']).mkdir(mode=0o700)

    def spawn(self, args):
        log = (self.root / 'desktop.log').open('ab')
        try:
            p = subprocess.Popen(args, env=self.env, stdout=log, stderr=log, start_new_session=True)
        finally:
            log.close()
        self.children.append(p)
        return p

    def start(self):
        required = ['Xtigervnc', 'tigervncpasswd', 'xdotool', 'xclip', 'scrot', 'websockify', 'dbus-daemon', 'xfce4-session', 'xfconf-query']
        missing = [name for name in required if not shutil.which(name)]
        if missing:
            raise RuntimeError('缺少桌面软件，请先安装：' + ', '.join(missing))
        password = subprocess.run(['tigervncpasswd', '-f'], input=(self.password + '\n').encode(), capture_output=True, check=True).stdout
        secret = self.root / 'vnc-password'
        secret.write_bytes(password)
        secret.chmod(0o600)
        self.xserver = self.spawn(['Xtigervnc', self.display, '-geometry', f'{self.width}x{self.height}', '-depth', '24',
                                   '-SecurityTypes', 'VncAuth', '-PasswordFile', str(secret), '-localhost', 'yes',
                                   '-rfbport', str(self.vnc_port), '-nolisten', 'tcp'])
        for _ in range(60):
            if self.xserver.poll() is not None:
                raise RuntimeError('Xvnc 启动失败：' + self.log())
            try:
                subprocess.run(['xdotool', 'getdisplaygeometry'], env=self.env, check=True, capture_output=True, timeout=2)
                break
            except (subprocess.SubprocessError, OSError):
                time.sleep(0.25)
        else:
            raise RuntimeError('Xvnc 未就绪：' + self.log())
        # PRoot's UID/Unix credential emulation and long translated socket paths
        # can break EXTERNAL authentication. nonce-tcp + a private cookie avoids
        # those Unix-socket constraints without exposing an anonymous message bus.
        guest = bool(os.environ.get('PD_CONTAINER'))
        transport = 'nonce-tcp:host=127.0.0.1,port=0,family=ipv4' if guest else 'unix:path=' + str(self.root / 'session-bus')
        mechanism = 'DBUS_COOKIE_SHA1' if guest else 'EXTERNAL'
        config = self.root / 'session-bus.conf'
        config.write_text('<busconfig><type>session</type><listen>' + transport + '</listen><auth>' + mechanism + '</auth>'
                          '<standard_session_servicedirs/><policy context="default"><allow send_destination="*" eavesdrop="true"/>'
                          '<allow eavesdrop="true"/><allow own="*"/></policy></busconfig>')
        with (self.root / 'desktop.log').open('ab') as log:
            self.bus = subprocess.Popen(['dbus-daemon', '--nofork', '--print-address=1', '--config-file=' + str(config)],
                                         env=self.env, stdout=subprocess.PIPE, stderr=log, start_new_session=True)
        self.children.append(self.bus)
        if not select.select([self.bus.stdout], [], [], 15)[0]:
            raise RuntimeError('桌面会话总线未就绪：' + self.log())
        address = self.bus.stdout.readline(4096).decode().strip()
        if self.bus.poll() is not None or not address.startswith(('unix:', 'nonce-tcp:')):
            raise RuntimeError('桌面会话总线启动失败：' + self.log())
        self.env['DBUS_SESSION_BUS_ADDRESS'] = address
        self.session = self.spawn(['xfce4-session'])
        self.viewer = self.spawn(['websockify', '--web=' + self.web_root, f'127.0.0.1:{self.view_port}', f'127.0.0.1:{self.vnc_port}'])
        for _ in range(40):
            if self.viewer.poll() is not None or self.session.poll() is not None:
                raise RuntimeError('Xfce/noVNC 启动失败：' + self.log())
            try:
                with socket.create_connection(('127.0.0.1', self.view_port), timeout=0.5):
                    break
            except OSError:
                time.sleep(0.25)
        else:
            raise RuntimeError('noVNC 端口未就绪')
        subprocess.run(['xfconf-query', '-c', 'xfwm4', '-l'], env=self.env, check=True, capture_output=True, timeout=20)

    def log(self):
        p = self.root / 'desktop.log'
        return p.read_text(errors='replace')[-2000:] if p.exists() else '无日志'

    def ready(self):
        return len(self.children) == 4 and all(p.poll() is None for p in self.children)

    def screenshot(self):
        if self.owner != 'ai':
            raise ValueError('用户正在接管，AI 暂停截图与操作')
        if not self.ready():
            raise RuntimeError('桌面进程未运行：' + self.log())
        path = self.root / 'screen.png'
        subprocess.run(['scrot', '-o', str(path)], env=self.env, check=True, capture_output=True, timeout=10)
        data = path.read_bytes()
        if len(data) > 5 * 1024 * 1024:
            raise ValueError('截图超过 5 MiB')
        self.observed = time.monotonic()
        return data

    def action(self, body):
        if self.owner != 'ai':
            raise ValueError('用户正在接管，AI 不得操作')
        if not self.ready() or time.monotonic() - self.observed > 60:
            raise ValueError('先获取独立桌面截图，再操作；截图有效期 60 秒')
        action = body.get('action')
        if action == 'tap':
            x, y = int(body['x']), int(body['y'])
            if not (0 <= x <= 1000 and 0 <= y <= 1000):
                raise ValueError('坐标必须为 0~1000')
            args = ['mousemove', str(min(self.width - 1, x * self.width // 1000)), str(min(self.height - 1, y * self.height // 1000)), 'click', '1']
        elif action == 'type':
            text = body.get('text', '')
            if not isinstance(text, str) or len(text) > 2000 or '\0' in text:
                raise ValueError('文字需为 0~2000 字符，不含空字符')
            paste_key = body.get('paste_key', 'ctrl+v')
            if paste_key not in ('ctrl+v', 'ctrl+shift+v', 'shift+Insert'):
                raise ValueError('paste_key 仅支持 ctrl+v、ctrl+shift+v 或 shift+Insert')
            if self.clipboard and self.clipboard.poll() is None:
                self.clipboard.terminate()
                self.clipboard.wait(timeout=2)
            self.clipboard = subprocess.Popen(['xclip', '-quiet', '-selection', 'clipboard', '-in'], env=self.env,
                                              stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self.clipboard.stdin.write(text.encode('utf-8'))
            self.clipboard.stdin.close()
            for _ in range(20):
                probe = subprocess.run(['xclip', '-selection', 'clipboard', '-out'], env=self.env, capture_output=True, timeout=2)
                if probe.returncode == 0 and probe.stdout == text.encode('utf-8'):
                    break
                time.sleep(0.05)
            else:
                raise RuntimeError('中文剪贴板未就绪')
            args = ['key', '--clearmodifiers', paste_key]
        elif action == 'key':
            key = body.get('key', '')
            if not re.fullmatch(r'[A-Za-z0-9+_-]{1,60}', key):
                raise ValueError('不支持的按键名称')
            args = ['key', '--clearmodifiers', key]
        else:
            raise ValueError('未知操作')
        subprocess.run(['xdotool', *args], env=self.env, check=True, capture_output=True, timeout=15)
        self.observed = 0
        return {'submitted': True, 'message': '动作已提交；重新截图确认结果，不代表任务成功'}

    def set_owner(self, owner):
        if owner not in ('ai', 'user'):
            raise ValueError('控制权仅可为 ai 或 user')
        if owner != self.owner:
            self.owner, self.observed = owner, 0
            self.control_generation += 1
            for job in self.jobs.values():
                p = job.get('process')
                if p and p.poll() is None:
                    try:
                        os.killpg(p.pid, signal.SIGSTOP if owner == 'user' else signal.SIGCONT)
                    except ProcessLookupError:
                        pass
        return {'owner': self.owner, 'generation': self.control_generation,
                'message': '你已接管；AI 已暂停，手动完成后点交还 AI' if owner == 'user' else '已交还 AI；须重新截图后才能操作'}

    def launch_app(self, name):
        if self.owner != 'ai':
            raise ValueError('用户接管期间不启动应用')
        applications = {'terminal': ['xfce4-terminal', '--disable-server'], 'files': ['thunar'],
                        'editor': ['mousepad'], 'browser': ['firefox-esr', '--no-remote'] if shutil.which('firefox-esr') else ['netsurf-gtk'],
                        'qq': ['qq', '--no-sandbox', '--disable-gpu']}
        if name in applications:
            command = applications[name]
        else:
            found = self.desktop_apps().get(name)
            if not found:
                raise ValueError('未找到应用；先用 desktop_apps 查看已安装应用 ID')
            command = shlex.split(found['exec'])
            command = [part for part in command if not re.fullmatch(r'%[fFuUdDnNickvm]', part)]
            if not command:
                raise ValueError('应用启动项为空')
        if not shutil.which(command[0]):
            raise ValueError('尚未安装此应用：' + name)
        log = (self.root / 'applications.log').open('ab')
        try:
            env = dict(self.env)
            if 'firefox' in command[0]:
                env['MOZ_DISABLE_CONTENT_SANDBOX'] = '1'
            p = subprocess.Popen(command, env=env, stdout=log, stderr=log, start_new_session=True)
        finally:
            log.close()
        self.applications.append(p)
        return {'started': True, 'application': name, 'pid': p.pid, 'message': '已提交启动，请截图验证窗口'}

    def desktop_apps(self):
        apps = {}
        for directory in (Path('/usr/share/applications'), Path('/usr/local/share/applications'), self.state_dir / 'data/applications'):
            if not directory.is_dir():
                continue
            for path in sorted(directory.glob('*.desktop'))[:200]:
                parser = configparser.ConfigParser(interpolation=None, strict=False)
                try:
                    parser.read(path, encoding='utf-8')
                    app = parser['Desktop Entry']
                    if app.get('Type', 'Application') != 'Application' or app.get('Hidden', '').lower() == 'true' or not app.get('Exec'):
                        continue
                    apps[path.name] = {'name': app.get('Name[zh_CN]', app.get('Name', path.stem)), 'exec': app['Exec']}
                except (OSError, configparser.Error, KeyError):
                    continue
        return apps

    def submit_job(self, body):
        if self.owner != 'ai':
            raise ValueError('用户接管期间不提交 AI 命令')
        if any(j['state'] in ('queued', 'running') for j in self.jobs.values()):
            raise ValueError('已有安装或命令运行，请先查看或取消该任务')
        kind = body.get('kind', 'command')
        if kind == 'install':
            packages = body.get('packages', [])
            if not isinstance(packages, list) or not 1 <= len(packages) <= 15 or any(not isinstance(p, str) or not re.fullmatch(r'[a-z0-9][a-z0-9+.-]{0,80}', p) for p in packages):
                raise ValueError('提供 1~15 个 Debian 软件包名，例如 mousepad；这里安装 Linux 软件')
            command = ['/bin/bash', '-ec',
                'missing=0; for p in "$@"; do dpkg-query -W -f=\'${Status}\' "$p" 2>/dev/null | grep -qx "install ok installed" || missing=1; done; '
                'if [ "$missing" = 0 ]; then exec dpkg-query -W "$@"; fi; '
                'apt-get -o Acquire::Retries=3 update; exec apt-get -o Acquire::Retries=3 install -y --no-install-recommends "$@"',
                'xiaoxing-install', *packages]
        elif kind == 'command':
            text = body.get('command', '')
            if not isinstance(text, str) or not text.strip() or len(text) > 24000 or '\0' in text:
                raise ValueError('命令需为 1~24000 字符')
            command = ['/bin/bash', '-lc', text]
        else:
            raise ValueError('不支持的任务类型')
        job_id = secrets.token_hex(12)
        job = {'id': job_id, 'kind': kind, 'state': 'queued', 'exit_code': None,
               'path': self.root / ('job-' + job_id + '.log'), 'process': None, 'cancelled': False,
               'timeout': max(5, min(900, int(body.get('timeout_seconds', 300))))}
        self.jobs[job_id] = job
        while len(self.jobs) > 20:
            oldest = next(iter(self.jobs))
            self.jobs.pop(oldest)['path'].unlink(missing_ok=True)
        threading.Thread(target=self._run_job, args=(job, command), daemon=True).start()
        return self.job_status(job_id)

    def _run_job(self, job, command):
        try:
            with self.mutex:
                if job['cancelled']:
                    return
                env = dict(self.env, DEBIAN_FRONTEND='noninteractive')
                with job['path'].open('wb') as log:
                    p = subprocess.Popen(command, env=env, cwd=self.workspace, stdout=log,
                                         stderr=log, start_new_session=True)
                job.update(process=p, state='running')
                if self.owner == 'user':
                    os.killpg(p.pid, signal.SIGSTOP)
            elapsed, previous = 0.0, time.monotonic()
            while p.poll() is None:
                time.sleep(0.2)
                now = time.monotonic()
                if self.owner == 'ai':
                    elapsed += now - previous
                previous = now
                if elapsed > job['timeout'] or job['path'].stat().st_size > 2 * 1024 * 1024:
                    job['state'] = 'timeout'
                    self._terminate(p)
                    break
            p.wait()
            if job['state'] != 'timeout':
                job['state'] = 'cancelled' if job['cancelled'] else ('completed' if p.returncode == 0 else 'failed')
            job['exit_code'] = p.returncode
        except Exception as e:
            job.update(state='failed', error=str(e))
        finally:
            p = job.get('process')
            if p:
                self._terminate(p)

    @staticmethod
    def _terminate(p):
        try:
            os.killpg(p.pid, signal.SIGCONT)
            os.killpg(p.pid, signal.SIGTERM)
            p.wait(timeout=2)
        except ProcessLookupError:
            pass
        except subprocess.TimeoutExpired:
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            p.wait(timeout=2)

    def job_status(self, job_id):
        job = self.jobs.get(job_id)
        if not job:
            raise ValueError('没有此任务')
        output = ''
        if job['path'].exists():
            with job['path'].open('rb') as f:
                f.seek(max(0, job['path'].stat().st_size - 12000))
                output = f.read(12000).decode('utf-8', 'replace')
        return {k: job[k] for k in ('id', 'kind', 'state', 'exit_code')} | {'output': output, 'error': job.get('error', ''), 'paused': self.owner == 'user'}

    def cancel_job(self, job_id):
        job = self.jobs.get(job_id)
        if not job:
            raise ValueError('没有此任务')
        job.update(cancelled=True, state='cancelled')
        if job.get('process'):
            self._terminate(job['process'])
        return self.job_status(job_id)

    def close(self):
        for job in self.jobs.values():
            job['cancelled'] = True
            if job.get('process'):
                self._terminate(job['process'])
        for p in self.applications:
            self._terminate(p)
        if self.clipboard and self.clipboard.poll() is None:
            self.clipboard.terminate()
            self.clipboard.wait(timeout=2)
        for p in reversed(self.children):
            try:
                os.killpg(p.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        for p in reversed(self.children):
            try:
                p.wait(timeout=2)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(p.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                p.wait(timeout=2)
        self.directory.cleanup()


def handler_for(desktop):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def log_message(self, *args):
            pass  # Do not log tokens, URLs, input text or screenshots.

        def reply(self, data, status=200, mime='application/json'):
            if not isinstance(data, bytes):
                data = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)

        def authorized(self):
            if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + desktop.token):
                self.reply({'error': 'Unauthorized'}, 401)
                return False
            if self.headers.get('Origin') or self.headers.get('Transfer-Encoding'):
                self.reply({'error': 'Cross-origin/chunked requests forbidden'}, 403)
                return False
            return True

        def do_GET(self):
            if not self.authorized():
                return
            try:
                with desktop.mutex:
                    if self.path == '/status':
                        self.reply({'running': desktop.ready(), 'protocol': 2, 'kind': 'PRoot Linux Xfce', 'width': desktop.width, 'height': desktop.height, 'owner': desktop.owner, 'generation': desktop.control_generation,
                                    'jobs': [desktop.job_status(k) for k in desktop.jobs],
                                    'message': '独立 Linux 桌面，共享手机内核；不是安卓虚拟手机', 'log': '' if desktop.ready() else desktop.log()})
                    elif self.path == '/screenshot':
                        if desktop.owner != 'ai':
                            self.reply({'error': '用户接管中，AI 截图暂停', 'owner': 'user'}, 409)
                            return
                        self.reply(desktop.screenshot(), mime='image/png')
                    elif self.path.startswith('/jobs/'):
                        self.reply(desktop.job_status(self.path[len('/jobs/'):]))
                    elif self.path == '/viewer':
                        self.reply({'url': f'http://127.0.0.1:{desktop.view_port}/vnc.html?autoconnect=1&resize=scale&password={desktop.password}'})
                    elif self.path == '/apps':
                        self.reply(desktop.desktop_apps())
                    else:
                        self.reply({'error': 'Not found'}, 404)
            except Exception as e:
                self.reply({'error': str(e)}, 500)

        def do_POST(self):
            if not self.authorized():
                return
            try:
                length = int(self.headers.get('Content-Length', '-1'))
                if not 0 <= length <= 16000:
                    raise ValueError('Invalid body length')
                data = self.rfile.read(length)
                if len(data) != length:
                    raise ValueError('Incomplete body')
                body = json.loads(data)
                with desktop.mutex:
                    if self.path == '/action':
                        if desktop.owner != 'ai':
                            self.reply({'error': '用户接管中，AI 操作暂停', 'owner': 'user'}, 409)
                            return
                        self.reply(desktop.action(body))
                    elif self.path == '/control':
                        self.reply(desktop.set_owner(body.get('owner')))
                    elif self.path == '/launch':
                        self.reply(desktop.launch_app(body.get('application')))
                    elif self.path == '/jobs':
                        self.reply(desktop.submit_job(body))
                    elif self.path.startswith('/jobs/') and self.path.endswith('/cancel'):
                        self.reply(desktop.cancel_job(self.path[len('/jobs/'):-len('/cancel')]))
                    elif self.path == '/shutdown':
                        self.reply({'stopping': True})
                        threading.Thread(target=self.server.shutdown, daemon=True).start()
                    else:
                        self.reply({'error': 'Not found'}, 404)
            except Exception as e:
                self.reply({'error': str(e)}, 400)
    return Handler


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--port', required=True, type=int)
    p.add_argument('--token', required=True)
    p.add_argument('--state-dir')
    p.add_argument('--web-root', default='/usr/share/novnc')
    args = p.parse_args()
    state_dir = Path(args.state_dir) if args.state_dir else Path.home() / '.local/share/xiaoxing-desktop'
    lockpath = state_dir / 'desktop.lock'
    lockpath.parent.mkdir(parents=True, exist_ok=True)
    with lockpath.open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        desktop = Desktop(args.token, state_dir, args.web_root)
        try:
            desktop.start()
            with ThreadingHTTPServer(('127.0.0.1', args.port), handler_for(desktop)) as server:
                server.daemon_threads = True
                def terminate(*_):
                    raise KeyboardInterrupt()
                signal.signal(signal.SIGTERM, terminate)
                print('小星独立 Linux 桌面已就绪。保持此 Termux 会话运行，可回到小星查看桌面。', flush=True)
                server.serve_forever(poll_interval=0.25)
        finally:
            desktop.close()


if __name__ == '__main__':
    main()
