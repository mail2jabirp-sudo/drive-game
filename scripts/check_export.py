#!/usr/bin/env python3
"""Verify that reconstructed export and committed road tiles remain consistent."""
from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parents[1];directory=root/'public/maps/malappuram'
try:
    m=json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
    digest=hashlib.sha256()
    with (root/'export.osm').open('rb') as source:
        for block in iter(lambda:source.read(1024*1024),b''):digest.update(block)
    if digest.hexdigest()!=m['source']['sha256']:raise ValueError('export source checksum differs')
    for tile in m['tiles'].values():
        if hashlib.sha256((directory/tile['file']).read_bytes()).hexdigest()!=tile['sha256']:raise ValueError('tile checksum differs: '+tile['file'])
except (OSError,ValueError,KeyError) as error:sys.exit(f'Export map check failed: {error}. Run npm run map:export after reviewing the source change.')
print(f"Uploaded road export and {len(m['tiles'])} tiles verified.")
