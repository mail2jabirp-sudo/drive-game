#!/usr/bin/env python3
"""Verify the unified derived database without changing archived maps."""
from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parents[1];directory=root/'public/maps/district'
try:
    m=json.loads((directory/'manifest.json').read_text())
    for source in [m['source'],*m['additionalSources']]:
        if hashlib.sha256((root/source['file']).read_bytes()).hexdigest()!=source['sha256']:raise ValueError('District source checksum differs: '+source['file'])
    for tile in m['tiles'].values():
        if hashlib.sha256((directory/tile['file']).read_bytes()).hexdigest()!=tile['sha256']:raise ValueError('District tile checksum differs: '+tile['file'])
    if m.get('coverageComplete') is not False:raise ValueError('District coverage must remain explicitly partial')
except (OSError,ValueError,KeyError) as error:sys.exit(str(error))
print(f"Unified partial district: {len(m['tiles'])} tiles and both source checksums verified.")
