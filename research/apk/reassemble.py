"""Rebuild the original APK from the checked-in binary parts (Python 3)."""
from pathlib import Path
import hashlib
import json
import os
import tempfile
import zipfile

def main():
    base = Path(__file__).resolve().parent
    manifest = json.loads((base / 'manifest.json').read_text(encoding='utf-8'))
    target = base / manifest['output']
    if target.exists():
        if target.stat().st_size == manifest['size'] and hashlib.sha256(target.read_bytes()).hexdigest() == manifest['sha256']:
            print('Already verified:', target)
            return
        raise SystemExit('Output exists with different contents; move it before retrying.')
    temp_path = None
    try:
        digest = hashlib.sha256()
        total = 0
        with tempfile.NamedTemporaryFile(dir=base, prefix='.rebuild-', delete=False) as output:
            temp_path = Path(output.name)
            for part in manifest['parts']:
                data = (base / part['file']).read_bytes()
                if len(data) != part['size'] or hashlib.sha256(data).hexdigest() != part['sha256']:
                    raise SystemExit('Part checksum failed: ' + part['file'])
                output.write(data)
                digest.update(data)
                total += len(data)
        if total != manifest['size'] or digest.hexdigest() != manifest['sha256']:
            raise SystemExit('Full APK checksum failed')
        with zipfile.ZipFile(temp_path) as archive:
            bad = archive.testzip()
            if bad is not None:
                raise SystemExit('APK archive corruption: ' + bad)
        os.replace(temp_path, target)
        temp_path = None
        print('Verified:', target)
        print('Bytes:', total)
        print('SHA256:', digest.hexdigest())
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)

if __name__ == '__main__':
    main()
