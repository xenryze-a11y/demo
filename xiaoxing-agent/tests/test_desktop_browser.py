"""Real noVNC browser interaction, separate from the Android PiP implementation."""
import importlib.util
from http.server import ThreadingHTTPServer
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('desktop_server',root/'assets/desktop_server.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory(prefix='xiaoxing-novnc-browser-') as directory:
    directory=Path(directory)
    desktop=module.Desktop('b'*64,directory/'profile',os.environ.get('XIAOXING_NOVNC_WEB','/usr/share/novnc'),directory/'workspace')
    terminal=None
    try:
        desktop.start()
        server=ThreadingHTTPServer(('127.0.0.1',0),module.handler_for(desktop))
        thread=threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        result=directory/'manual.txt'
        terminal=subprocess.Popen(['xfce4-terminal','--disable-server','--geometry=80x18+100+100','--title=XIAOXING_LIVE_SHARE','--execute','/usr/bin/python3','-c',f'from pathlib import Path;print("Live screen sharing: type here");Path({str(result)!r}).write_text(input())'],env=desktop.env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(50):
            window=subprocess.run(['xdotool','search','--name','^XIAOXING_LIVE_SHARE$'],env=desktop.env,capture_output=True,text=True)
            if window.returncode==0:
                subprocess.run(['xdotool','windowactivate','--sync',window.stdout.strip().splitlines()[0]],env=desktop.env,check=True)
                break
            time.sleep(.2)
        screenshot=sys.argv[1] if len(sys.argv)>1 else str(directory/'browser.png')
        viewer=f'http://127.0.0.1:{desktop.view_port}/vnc.html?autoconnect=1&resize=scale&password={desktop.password}'
        subprocess.run(['node',str(root/'tests/novnc-browser.cjs'),viewer,f'http://127.0.0.1:{server.server_port}',desktop.token,screenshot],check=True,timeout=60)
        for _ in range(30):
            if result.exists():break
            time.sleep(.1)
        assert result.read_text()=='manual-vnc-ok','Browser input did not reach actual guest desktop application'
        print('Browser input arrived in actual desktop application:',result.read_text())
        server.shutdown();server.server_close();thread.join(3)
    finally:
        if terminal and terminal.poll() is None:
            terminal.terminate();terminal.wait(timeout=5)
        desktop.close()
