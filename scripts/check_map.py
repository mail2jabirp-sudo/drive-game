#!/usr/bin/env python3
"""Fail before serving/building if the checked-in excerpt is stale."""
from pathlib import Path
import hashlib
import json
import sys
root = Path(__file__).resolve().parents[1]
try:
    digest = hashlib.sha256((root / 'map.osm').read_bytes()).hexdigest()
    excerpt = json.loads((root / 'public/maps/kottakkal.json').read_text(encoding='utf-8'))
    provenance = json.loads((root / 'data/OSM_PROVENANCE.json').read_text(encoding='utf-8'))
    if excerpt['version'] != 1 or excerpt['source']['sha256'] != digest or provenance['source']['sha256'] != digest:
        raise ValueError('source checksum differs')
except (OSError, ValueError, KeyError) as error:
    sys.exit(f'OSM data is absent or stale ({error}). Run npm run map:import, inspect the diff, then retry.')
print(f'OSM excerpt matches map.osm ({digest[:12]}).')
