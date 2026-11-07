#!/usr/bin/env python3
"""4-byte align stored entries without native zipalign (this app has no native .so)."""
import struct
import sys
from zipfile import ZipFile, ZIP_STORED

with ZipFile(sys.argv[1]) as source, ZipFile(sys.argv[2], 'w') as dest:
    for entry in source.infolist():
        if entry.compress_type == ZIP_STORED:
            position = dest.fp.tell() + 30 + len(entry.filename.encode('utf-8')) + len(entry.extra)
            if position % 4:
                padding = -(position + 4) % 4
                entry.extra += struct.pack('<HH', 0xcafe, padding) + bytes(padding)
        dest.writestr(entry, source.read(entry.filename))
