"""Runs the shipped installer against mock Termux tools; does not install a real phone container."""
import os
from pathlib import Path
import subprocess
import tempfile

script=Path('assets/setup-linux.sh').resolve()
with tempfile.TemporaryDirectory() as d:
    root=Path(d);bin_dir=root/'bin';bin_dir.mkdir();state=root/'state';calls=root/'calls'
    proot=bin_dir/'proot-distro'
    proot.write_text('''#!/usr/bin/env python3
import os,sys
from pathlib import Path
s=Path(os.environ['XIAOXING_TEST_STATE']);log=Path(os.environ['XIAOXING_TEST_CALLS'])
a=sys.argv[1:]
with log.open('a') as f:f.write(repr(a)+'\\n')
value=s.read_text() if s.exists() else ''
if a[:2]==['install','--help']:print('--name NAME');sys.exit(0)
if a and a[0]=='list':print('xiaoxing' if value else '');sys.exit(0)
if a and a[0]=='install':
 assert a==['install','--name','xiaoxing','mirror.gcr.io/library/debian:bookworm']
 if os.environ.get('XIAOXING_TEST_FAIL')=='download':print('network error');sys.exit(1)
 s.write_text('ok');sys.exit(0)
if a and a[0]=='login':
 if not value or value=='broken':sys.exit(2)
 if '/bin/bash' in a and os.environ.get('XIAOXING_TEST_FAIL')=='apt':sys.exit(42)
 print('mock command completed');sys.exit(0)
sys.exit(3)
''')
    proot.chmod(0o700)
    for name,body in [('termux-reload-settings','exit 0'),('pkg','echo unexpected-package-reinstall; exit 99')]:
        f=bin_dir/name;f.write_text('#!/bin/sh\n'+body+'\n');f.chmod(0o700)
    env=dict(os.environ,PATH=str(bin_dir)+':'+os.environ['PATH'],XIAOXING_CONFIG_DIR=str(root/'config'),XIAOXING_TEST_STATE=str(state),XIAOXING_TEST_CALLS=str(calls))
    def run(fail=''):
        return subprocess.run(['bash',str(script)],env=dict(env,XIAOXING_TEST_FAIL=fail),capture_output=True,text=True,timeout=10)
    failed=run('download')
    assert failed.returncode and '下载 Debian 系统镜像' in failed.stdout and 'Setup complete' not in failed.stdout
    assert not state.exists()
    passed=run()
    assert passed.returncode==0 and '小星开发环境安装完成 / Setup complete' in passed.stdout
    before=calls.read_text().count("['install', '--name'")
    resumed=run()
    assert resumed.returncode==0 and '跳过重新安装' in resumed.stdout
    assert calls.read_text().count("['install', '--name'")==before
    assert (root/'config/termux.properties').read_text().count('allow-external-apps=true')==1
    apt_failed=run('apt')
    assert apt_failed.returncode==42 and '安装 Python、Node 和 Git' in apt_failed.stdout and 'Setup complete' not in apt_failed.stdout
    state.write_text('broken');before=calls.read_text().count("['install', '--name'")
    broken=run()
    assert broken.returncode and '保留其中数据' in broken.stdout
    assert calls.read_text().count("['install', '--name'")==before
    print('Installer repair: alternate source, download failure stage, no false success, resume, no redundant package reinstall, config idempotence, apt failure, existing container preservation passed (mock tools).')
