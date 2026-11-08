#!/usr/bin/env python3
"""Install a checksum-verified complete offline desktop into a separate PRoot container.

The original 'xiaoxing' container is never removed or replaced. This terminal
owns the lifetime of both the bootstrap status server and the desktop session.
"""
import argparse
import base64
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
import time
import urllib.request


class Installer:
    def __init__(self, args):
        self.args, self.process = args, None
        self.cancel = threading.Event()
        self.error_seen = threading.Event()
        self.root = Path(args.state_dir) if args.state_dir else Path.home() / '.local/share/xiaoxing-desktop-setup'
        self.root.mkdir(parents=True, exist_ok=True)
        self.log = self.root / 'installation.log'
        self.state = {'phase': 'preparing', 'message': '准备离线独立电脑', 'installed': False, 'running': False, 'exit_code': None}
        self.update(**self.state)

    def update(self, **values):
        self.state = dict(self.state, **values)
        temp = self.root / 'state.partial'
        temp.write_text(json.dumps(self.state, ensure_ascii=False))
        temp.replace(self.root / 'state.json')
        print(self.state['message'], flush=True)

    def status(self):
        result = dict(self.state)
        if self.log.exists():
            with self.log.open('rb') as f:
                f.seek(max(0, self.log.stat().st_size - 8000))
                result['log'] = f.read(8000).decode('utf-8', 'replace')
        return result

    def command(self, argv, timeout=900):
        with self.log.open('ab') as out:
            self.process = subprocess.Popen(argv, stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
        start = time.monotonic()
        while self.process.poll() is None:
            if self.cancel.wait(0.25) or time.monotonic() - start > timeout:
                self.terminate()
                raise RuntimeError('安装已取消' if self.cancel.is_set() else '此安装阶段超时，文件和已有环境已保留')
        if self.process.returncode:
            raise RuntimeError('安装命令退出码 ' + str(self.process.returncode) + '；请查看安装日志')

    def terminate(self):
        p = self.process
        if p and p.poll() is None:
            try:
                os.killpg(p.pid, signal.SIGCONT)
                os.killpg(p.pid, signal.SIGTERM)
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(p.pid, signal.SIGKILL)
                p.wait(timeout=3)
            except ProcessLookupError:
                pass

    def install_and_start(self):
        try:
            image = Path(self.args.image).resolve()
            self.update(phase='verifying', message='校验 APK 内置独立电脑系统')
            digest = hashlib.sha256()
            with image.open('rb') as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b''):
                    if self.cancel.is_set():
                        raise RuntimeError('校验已取消')
                    digest.update(chunk)
            if not hmac.compare_digest(digest.hexdigest(), self.args.sha256):
                raise RuntimeError('系统包校验失败，未安装；重新获取完整 APK 或系统包')
            login = ['proot-distro', 'login', self.args.container, '--']
            existing = subprocess.run(login + ['/bin/true'], capture_output=True).returncode == 0
            if not existing:
                listing = subprocess.run(['proot-distro', 'list', '--quiet'], capture_output=True, text=True)
                if self.args.container in listing.stdout.splitlines():
                    raise RuntimeError('独立电脑目录已经存在但无法启动，保留数据，未自动覆盖。请导出日志处理')
                self.update(phase='extracting', message='正在解包并安装完整独立电脑；保留原有 Linux 工作区')
                self.command(['proot-distro', 'install', '--name', self.args.container, str(image)], timeout=1200)
            self.update(phase='checking', message='核对桌面、浏览器、文件管理器和输入工具')
            self.command(login + ['/bin/sh', '-ec',
                'mkdir -p /tmp /run; chmod 1777 /tmp; test -f /etc/xiaoxing-desktop-image; for t in python3 Xtigervnc tigervncpasswd xfce4-session '
                'xfce4-terminal websockify scrot xdotool xclip mousepad netsurf-gtk thunar; do command -v "$t"; done; '
                'test -f /usr/share/novnc/vnc.html'], timeout=45)
            self.update(phase='starting', message='独立电脑已安装，正在启动桌面画面', installed=True)
            code = "import base64;exec(compile(base64.b64decode('" + self.args.server + "'),'xiaoxing-desktop','exec'))"
            argv = login + ['python3', '-c', code, '--port', str(self.args.desktop_port), '--token', self.args.token]
            with self.log.open('ab') as log:
                self.process = subprocess.Popen(argv, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            for _ in range(100):
                if self.cancel.wait(0.3):
                    raise RuntimeError('启动已取消')
                if self.process.poll() is not None:
                    raise RuntimeError('桌面进程启动失败，退出码 ' + str(self.process.returncode) + '；请查看日志')
                try:
                    req = urllib.request.Request('http://127.0.0.1:' + str(self.args.desktop_port) + '/status', headers={'Authorization': 'Bearer ' + self.args.token})
                    with opener.open(req, timeout=1) as response:
                        ready = json.load(response)
                    if ready.get('running'):
                        break
                except Exception:
                    continue
            else:
                raise RuntimeError('桌面进程未返回就绪状态，请查看安装日志')
            self.update(phase='ready', message='独立电脑运行中：可回小星查看画面、交给 AI 或手动接管', running=True, installed=True)
            while self.process.poll() is None:
                if self.cancel.wait(0.3):
                    self.terminate()
                    break
            self.update(phase='stopped', message='独立电脑已停止；系统和文件保留，下次可重新启动', running=False, exit_code=self.process.returncode)
        except Exception as e:
            self.update(phase='cancelled' if self.cancel.is_set() else 'failed', message=str(e), running=False,
                        exit_code=self.process.returncode if self.process else None)
            self.terminate()


def handler_for(installer):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *args):
            pass

        def respond(self, obj, code=200):
            data = json.dumps(obj, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)

        def authorized(self):
            return not self.headers.get('Origin') and hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + installer.args.token)

        def do_GET(self):
            if not self.authorized():
                self.respond({'error': 'Unauthorized'}, 401)
            elif self.path == '/status':
                self.respond(installer.status())
                if installer.state['phase'] == 'failed':
                    installer.error_seen.set()
            else:
                self.respond({'error': 'Not found'}, 404)

        def do_POST(self):
            if not self.authorized():
                self.respond({'error': 'Unauthorized'}, 401)
            elif self.path == '/cancel':
                installer.cancel.set()
                self.respond({'cancelling': True})
            else:
                self.respond({'error': 'Not found'}, 404)
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--desktop-port', type=int, required=True)
    parser.add_argument('--token', required=True)
    parser.add_argument('--server', required=True)
    parser.add_argument('--container', default='xiaoxing-desktop')
    parser.add_argument('--state-dir')
    args = parser.parse_args()
    if not re.fullmatch('[a-f0-9]{64}', args.token) or not re.fullmatch('[a-f0-9]{64}', args.sha256) or not re.fullmatch('[a-z0-9-]{1,40}', args.container):
        raise ValueError('Invalid setup configuration')
    base64.b64decode(args.server, validate=True)
    installer = Installer(args)
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler_for(installer)) as server:
        server.daemon_threads = True
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            installer.install_and_start()
            if installer.state['phase'] == 'failed':
                installer.error_seen.wait(300)
        finally:
            installer.terminate()
            server.shutdown()
            thread.join(3)


if __name__ == '__main__':
    main()
