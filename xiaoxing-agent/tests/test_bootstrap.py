"""Offline installer lifecycle using simulated PRoot-Distro, not phone validation."""
import argparse
import base64
import hashlib
import importlib.util
import os
from pathlib import Path
import socket
import tempfile
import threading
import time

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sandbox_bootstrap', root / 'assets/sandbox_bootstrap.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


fake = '''#!/usr/bin/env python3
import os,pathlib,subprocess,sys
root=pathlib.Path(os.environ['XIAOXING_BOOTSTRAP_TEST'])
with (root/'calls').open('a') as f:f.write(sys.argv[1]+'\\n')
args=sys.argv[1:]
if args[0]=='list':print('xiaoxing-desktop' if (root/'broken').exists() else '');sys.exit(0)
if args[0]=='install':
 if (root/'fail').exists():print('MOCK_EXTRACT_FAILURE',flush=True);sys.exit(42)
 (root/'installed').write_text('yes');sys.exit(0)
if args[0]=='login':
 if not (root/'installed').exists():sys.exit(1)
 if args[3]=='/bin/true':sys.exit(0)
 if args[3]=='/bin/sh':sys.exit(0)
 if args[3]=='python3':os.execv(sys.executable,[sys.executable,*args[4:]])
sys.exit(99)
'''
backend = '''import argparse,json
from http.server import HTTPServer,BaseHTTPRequestHandler
p=argparse.ArgumentParser();p.add_argument('--port',type=int);p.add_argument('--token');a=p.parse_args()
class H(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  data=json.dumps({'running':True}).encode();self.send_response(200);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
HTTPServer(('127.0.0.1',a.port),H).serve_forever()
'''

with tempfile.TemporaryDirectory(prefix='xiaoxing-bootstrap-test-') as directory:
    home = Path(directory)
    command = home / 'proot-distro'
    command.write_text(fake)
    command.chmod(0o700)
    previous_path = os.environ['PATH']
    os.environ['PATH'] = directory + ':' + previous_path
    os.environ['XIAOXING_BOOTSTRAP_TEST'] = directory
    image = home / 'desktop.tar.xz'
    image.write_bytes(b'fake-checksum-verified-offline-system')
    def installer(case, sha=None):
        return module.Installer(argparse.Namespace(image=str(image), sha256=sha or hashlib.sha256(image.read_bytes()).hexdigest(),
            port=port(), desktop_port=port(), token='a'*64, server=base64.b64encode(backend.encode()).decode(), container='xiaoxing-desktop', state_dir=str(home/("case-"+case))))
    try:
        wrong = installer('wrong', '0'*64)
        wrong.install_and_start()
        assert wrong.state['phase'] == 'failed' and not wrong.state['installed']
        assert not (home / 'calls').exists(), 'No guest command before integrity verification'
        (home / 'broken').touch()
        broken = installer('broken')
        broken.install_and_start()
        assert broken.state['phase'] == 'failed' and '保留数据' in broken.state['message']
        assert 'install\n' not in (home / 'calls').read_text()
        (home / 'broken').unlink()
        (home / 'fail').touch()
        failed = installer('failed')
        failed.install_and_start()
        assert failed.state['phase'] == 'failed' and not failed.state['installed'] and '42' in failed.state['message']
        assert 'MOCK_EXTRACT_FAILURE' in failed.status()['log']
        (home / 'fail').unlink()
        valid = installer('valid')
        worker = threading.Thread(target=valid.install_and_start)
        worker.start()
        for _ in range(100):
            if valid.state['phase'] == 'ready':
                break
            time.sleep(0.05)
        assert valid.state['phase'] == 'ready' and valid.state['installed'] and valid.state['running'], valid.state
        valid.cancel.set()
        worker.join(5)
        assert not worker.is_alive() and valid.process.poll() is not None and valid.state['phase'] == 'stopped'
        print('Offline installer: integrity-before-execution, broken-container preservation, no false success, failure logs, actual readiness response and shutdown passed (mock guest lifecycle)')
    finally:
        os.environ['PATH'] = previous_path
        os.environ.pop('XIAOXING_BOOTSTRAP_TEST', None)
