"""Exercises the supervisor with a local fake proot executable; not a phone/container test."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import uuid

runner=Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory() as directory:
    fake=Path(directory)/'proot-distro'
    fake.write_text('#!/bin/sh\nexec /bin/bash -lc "$6"\n')
    fake.chmod(0o700)
    env=dict(os.environ,PATH=directory+':'+os.environ['PATH'])
    def run(command,seconds=3):
        token=str(uuid.uuid4())
        result=subprocess.run([sys.executable,str(runner),token,str(seconds),command],env=env,capture_output=True,text=True,timeout=seconds+8)
        assert not (Path.home()/'.cache/xiaoxing-agent'/f'{token}.pid').exists()
        return result
    result=run("printf 'hello linux'; printf 'stderr' >&2")
    assert result.returncode==0 and 'hello linuxstderr' in result.stdout
    assert run('exit 7').returncode==7
    result=run("python3 -c \"print('x'*60000)\"")
    assert result.returncode==0 and len(result.stdout)<25000 and 'truncated' in result.stdout
    start=time.monotonic();result=run('sleep 30',1)
    assert result.returncode==124 and time.monotonic()-start<6 and 'timeout' in result.stdout
    pidfile=Path(directory)/'child.pid'
    result=run(f'sleep 30 & echo $! > {pidfile}; wait',1)
    assert result.returncode==124
    child=int(pidfile.read_text())
    stat=Path(f'/proc/{child}/stat')
    assert not stat.exists() or stat.read_text().split()[2]=='Z', 'child still running'
    print('Linux supervisor: stdout/stderr, exit status, output cap, timeout, child termination and pid cleanup passed')
