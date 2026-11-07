#!/usr/bin/env python3
"""Personal PRoot Xfce desktop; separate from bounded command execution.

No public listener, arbitrary command endpoint, account login or messaging loop.
PRoot shares the host kernel and Termux permissions; it is not a security VM.
"""
import argparse
import base64
import fcntl
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import shutil
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

    def __init__(self, token, state_dir=None, web_root='/usr/share/novnc'):
        if not re.fullmatch(r'[a-f0-9]{64}', token):
            raise ValueError('Invalid control token')
        self.token, self.children, self.observed = token, [], 0
        self.clipboard = None
        self.web_root = web_root
        self.state_dir = Path(state_dir) if state_dir else Path.home() / '.local/share/xiaoxing-desktop'
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.mutex = threading.Lock()
        self.directory = tempfile.TemporaryDirectory(prefix='xiaoxing-desktop-')
        self.root = Path(self.directory.name)
        self.password = secrets.token_hex(4)  # VNC's eight-character limit
        self.vnc_port, self.view_port = free_port(), free_port()
        self.env = dict(os.environ, DISPLAY=':77', XDG_RUNTIME_DIR=str(self.root / 'runtime'))
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
        required = ['Xtigervnc', 'tigervncpasswd', 'xdotool', 'xclip', 'scrot', 'websockify', 'dbus-run-session', 'xfce4-session']
        missing = [name for name in required if not shutil.which(name)]
        if missing:
            raise RuntimeError('缺少桌面软件，请先安装：' + ', '.join(missing))
        password = subprocess.run(['tigervncpasswd', '-f'], input=(self.password + '\n').encode(), capture_output=True, check=True).stdout
        secret = self.root / 'vnc-password'
        secret.write_bytes(password)
        secret.chmod(0o600)
        self.xserver = self.spawn(['Xtigervnc', ':77', '-geometry', f'{self.width}x{self.height}', '-depth', '24',
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
        self.session = self.spawn(['dbus-run-session', '--', 'xfce4-session'])
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

    def log(self):
        p = self.root / 'desktop.log'
        return p.read_text(errors='replace')[-2000:] if p.exists() else '无日志'

    def ready(self):
        return len(self.children) == 3 and all(p.poll() is None for p in self.children)

    def screenshot(self):
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

    def close(self):
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
                        self.reply({'running': desktop.ready(), 'kind': 'PRoot Linux Xfce', 'width': desktop.width, 'height': desktop.height,
                                    'message': '独立 Linux 桌面，共享手机内核；不是安卓虚拟手机', 'log': '' if desktop.ready() else desktop.log()})
                    elif self.path == '/screenshot':
                        self.reply(desktop.screenshot(), mime='image/png')
                    elif self.path == '/viewer':
                        self.reply({'url': f'http://127.0.0.1:{desktop.view_port}/vnc.html?autoconnect=1&resize=scale&password={desktop.password}'})
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
                        self.reply(desktop.action(body))
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
