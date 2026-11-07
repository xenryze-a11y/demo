#!/usr/bin/env python3
"""Package only explicit public source paths; never include keys, build or releases."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys

root = Path(__file__).resolve().parents[1]
target = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'build/assets/self-source.zip'
target.parent.mkdir(parents=True, exist_ok=True)
files = []
for name in ('src', 'res', 'assets', 'tools', 'tests'):
    files.extend(p for p in (root / name).rglob('*') if p.is_file())
files.extend(root / name for name in ('AndroidManifest.xml', 'build.sh', '.gitignore'))
files.extend(root.glob('*.md'))
with ZipFile(target, 'w', ZIP_DEFLATED) as z:
    for p in sorted(set(files)):
        relative = p.relative_to(root)
        if p.is_symlink() or any(part.startswith('.') and part != '.gitignore' for part in relative.parts):
            continue
        if p.suffix in ('.jks', '.keystore', '.pyc', '.apk', '.zip') or '__pycache__' in relative.parts:
            continue
        z.write(p, relative.as_posix())
print(f'Source bundle: {target} ({target.stat().st_size} bytes)')
