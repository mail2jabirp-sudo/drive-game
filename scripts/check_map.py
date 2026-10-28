#!/usr/bin/env python3
"""Fail before serving/building if the checked-in excerpt is stale."""
from pathlib import Path
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from map_geography import coordinate_bounds, kottakkal_anchor
from import_osm import import_map
root = Path(__file__).resolve().parents[1]
try:
    digest = hashlib.sha256((root / 'map.osm').read_bytes()).hexdigest()
    excerpt = json.loads((root / 'public/maps/kottakkal.json').read_text(encoding='utf-8'))
    provenance = json.loads((root / 'data/OSM_PROVENANCE.json').read_text(encoding='utf-8'))
    xml = ET.parse(root / 'map.osm').getroot()
    nodes = {n.get('id'): n for n in xml.findall('node')}
    coordinate_bounds(nodes)
    anchor = kottakkal_anchor(xml, nodes)
    if any(abs(excerpt['projection'][k] - anchor[k]) > 1e-9 for k in ('latitude', 'longitude')):
        raise ValueError('incorrect Kottakkal projection origin')
    if not any(l['id'] == 'way/378587276' and l['kind'] == 'bus_station' and abs(l['x']) < 1 and abs(l['z']) < 1 for l in excerpt['landmarks']):
        raise ValueError('Kottakkal landmark anchor is missing or displaced')
    if excerpt['version'] != 1 or excerpt['source']['sha256'] != digest or provenance['source']['sha256'] != digest:
        raise ValueError('source checksum differs')
    expected, _ = import_map(root / 'map.osm', 650)
    if excerpt != expected:
        raise ValueError('derived geometry differs from the verified source/settings')
except (OSError, ValueError, KeyError, ET.ParseError) as error:
    sys.exit(f'OSM data is absent or stale ({error}). Run npm run map:import, inspect the diff, then retry.')
print(f'OSM excerpt matches map.osm ({digest[:12]}).')
