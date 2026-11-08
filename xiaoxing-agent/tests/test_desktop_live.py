"""Real Xvnc/Xfce/noVNC integration. Requires the packages in setup-desktop.sh.

No phone claims: this exercises desktop_server on the current Linux machine.
"""
import importlib.util
import json
import os
from pathlib import Path
import socket
import shlex
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('desktop_server', root / 'assets/desktop_server.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

with tempfile.TemporaryDirectory(prefix='xiaoxing-desktop-test-') as directory:
    desktop = module.Desktop('a' * 64, Path(directory) / 'profile', os.environ.get('XIAOXING_NOVNC_WEB', '/usr/share/novnc'), Path(directory) / 'workspace')
    terminal = None
    try:
        desktop.start()
        assert desktop.ready()
        server = ThreadingHTTPServer(('127.0.0.1', 0), module.handler_for(desktop))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

        def request(path, body=None, auth=True, origin=None):
            headers = {'Authorization': 'Bearer ' + desktop.token} if auth else {}
            if origin:
                headers['Origin'] = origin
            data = json.dumps(body).encode() if body is not None else None
            with opener.open(urllib.request.Request(base + path, data=data, headers=headers), timeout=20) as response:
                return response.read()

        def status_error(path, body, code, **kwargs):
            try:
                request(path, body, **kwargs)
                raise AssertionError('Request should fail')
            except urllib.error.HTTPError as e:
                assert e.code == code, (e.code, e.read())

        assert json.loads(request('/status'))['running']
        status_error('/status', None, 401, auth=False)
        status_error('/status', None, 403, origin='https://example.com')
        status_error('/action', {'action': 'key', 'key': 'Return'}, 400)
        viewer = json.loads(request('/viewer'))['url']
        with opener.open(viewer, timeout=10) as response:
            assert b'noVNC' in response.read()
        with socket.create_connection(('127.0.0.1', desktop.vnc_port), timeout=5) as connection:
            assert connection.recv(12).startswith(b'RFB ')

        result = Path(directory) / 'typed.txt'
        command = [
            'xfce4-terminal', '--disable-server', '--geometry=80x18+100+100', '--title=XIAOXING_SANDBOX_TEST',
            '--execute', '/usr/bin/python3', '-c',
            f'from pathlib import Path;print("Type here to verify independent desktop control:");Path({str(result)!r}).write_text(input())'
        ]
        terminal = subprocess.Popen(command, env=desktop.env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        for _ in range(60):
            search = subprocess.run(['xdotool', 'search', '--name', '^XIAOXING_SANDBOX_TEST$'], env=desktop.env, capture_output=True, text=True)
            if search.returncode == 0:
                wid = search.stdout.strip().splitlines()[0]
                break
            if terminal.poll() is not None:
                raise RuntimeError('Terminal failed: ' + terminal.stderr.read().decode())
            time.sleep(0.2)
        else:
            raise RuntimeError('Terminal window did not open')
        subprocess.run(['xdotool', 'windowactivate', '--sync', wid], env=desktop.env, check=True)
        png = request('/screenshot')
        assert png.startswith(b'\x89PNG\r\n\x1a\n')
        assert json.loads(request('/action', {'action': 'tap', 'x': 250, 'y': 300}))['submitted']
        status_error('/action', {'action': 'type', 'text': 'blocked-until-new-screenshot'}, 400)
        request('/screenshot')
        assert json.loads(request('/action', {'action': 'type', 'text': 'xiaoxing-desktop-ok 小星中文', 'paste_key': 'ctrl+shift+v'}))['submitted']
        screenshot = request('/screenshot')
        if len(sys.argv) > 1:
            Path(sys.argv[1]).write_bytes(screenshot)
        assert json.loads(request('/action', {'action': 'key', 'key': 'Return'}))['submitted']
        for _ in range(30):
            if result.exists():
                break
            time.sleep(0.1)
        assert result.read_text() == 'xiaoxing-desktop-ok 小星中文', 'GUI input did not reach the application'
        script = 'import time\nfor i in range(25):\n print(i,flush=True);time.sleep(0.1)'
        job = json.loads(request('/jobs', {'kind': 'command', 'command': 'python3 -u -c ' + shlex.quote(script), 'timeout_seconds': 5}))
        job_path = '/jobs/' + job['id']
        for _ in range(40):
            progress = json.loads(request(job_path))
            if progress['state'] == 'running' and progress['output']:
                break
            time.sleep(0.05)
        request('/screenshot')
        assert json.loads(request('/control', {'owner': 'user'}))['owner'] == 'user'
        status_error('/screenshot', None, 409)
        status_error('/action', {'action': 'key', 'key': 'Return'}, 409)
        status_error('/jobs', {'kind': 'command', 'command': 'echo must-not-start'}, 400)
        with opener.open(viewer, timeout=10) as response:
            assert b'noVNC' in response.read(), 'Human must still be able to view/control VNC'
        time.sleep(0.2)
        paused = json.loads(request(job_path))
        assert paused['paused'] and paused['state'] == 'running'
        time.sleep(5.3)
        assert json.loads(request(job_path))['output'] == paused['output'], 'AI command advanced during human takeover'
        assert json.loads(request('/control', {'owner': 'ai'}))['owner'] == 'ai'
        status_error('/action', {'action': 'key', 'key': 'Return'}, 400)
        request('/screenshot')
        for _ in range(80):
            progress = json.loads(request(job_path))
            if progress['state'] in ('completed', 'failed', 'timeout'):
                break
            time.sleep(0.1)
        assert progress['state'] == 'completed' and progress['exit_code'] == 0 and '24' in progress['output'], progress
        status_error('/jobs', {'kind': 'install', 'packages': ['good;echo injected']}, 400)
        assert json.loads(request('/shutdown', {}))['stopping']
        thread.join(5)
        server.server_close()
        assert not thread.is_alive()
        print('Live desktop: Xvnc/Xfce/noVNC, GUI input, human takeover, blocked AI screenshots/actions/jobs, paused process, resumed job/exit code, stale screenshot rejection and shutdown passed')
    finally:
        if terminal and terminal.poll() is None:
            terminal.terminate()
            terminal.wait(timeout=5)
        desktop.close()
        assert all(p.poll() is not None for p in desktop.children), 'Desktop child still running'
