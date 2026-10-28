#!/usr/bin/env python3
"""Read-only inventory of every supplied geographic dataset, including upload fragments."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from map_geography import coordinate_bounds, kottakkal_anchor

ROOT = Path(__file__).resolve().parents[1]


def audit_xml(paths):
    raw = b''.join(p.read_bytes() for p in paths)
    result = {'paths': [str(p) for p in paths], 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    try:
        root = ET.fromstring(raw)
        nodes = {n.get('id'): n for n in root.findall('node')}
        result['actualNodeBounds'] = coordinate_bounds(nodes)
        result['nodes'] = len(nodes)
        bounds = root.find('bounds')
        result['declaredBounds'] = bounds.attrib if bounds is not None else None
        result['anchor'] = kottakkal_anchor(root, nodes)
        result['decision'] = 'accepted Kottakkal source; select bounded local geometry only'
    except (ValueError, ET.ParseError) as error:
        result['decision'] = 'rejected as Kottakkal replacement'
        result['reason'] = str(error)
    return result


def audit_json(path):
    raw = path.read_bytes(); data = json.loads(raw)
    p, b = data['projection'], data['bounds']
    def geo(x, z):
        return (p['latitude'] - math.degrees(z / p['earthRadius']),
                p['longitude'] + math.degrees(x / (p['earthRadius'] * math.cos(math.radians(p['latitude'])))))
    south, west = geo(b['minX'], b['maxZ']); north, east = geo(b['maxX'], b['minZ'])
    anchor = any(l['id'] == 'way/378587276' and l['kind'] == 'bus_station' and 'kottakkal' in l['name'].lower() and math.hypot(l['x'], l['z']) < 1 for l in data['landmarks'])
    valid = anchor and abs(p['latitude'] - 11.001609) < .00001 and abs(p['longitude'] - 76.00470916) < .00001
    return {'paths': [str(path)], 'sha256': hashlib.sha256(raw).hexdigest(), 'sourceSha256': data['source']['sha256'],
            'localBounds': b, 'geographicBounds': {'minLat': south, 'maxLat': north, 'minLon': west, 'maxLon': east},
            'decision': 'accepted bounded Kottakkal derivative' if valid else 'rejected: incorrect origin or missing anchor'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--attachments', type=Path, default=Path('/workspace/attachments'))
    args = parser.parse_args()
    records = [audit_xml([ROOT / 'map.osm'])]
    parts = sorted(args.attachments.rglob('export.osm.part*'), key=lambda p: p.name)
    if parts:
        records.append(audit_xml(parts))
    records.extend(audit_json(p) for p in sorted(ROOT.rglob('kottakkal.json')) if 'node_modules' not in p.parts)
    report = {'datasets': records, 'notes': ['Fragments are concatenated in filename order only for inspection; originals are never changed.',
              'Full-way referenced nodes can exceed the XML declared query bounds. Actual node bounds are reported separately.',
              'A regional extent containing Kottakkal is not sufficient evidence of the required local map identity.']}
    text = json.dumps(report, indent=2) + '\n'
    if args.output:
        args.output.write_text(text)
    else:
        print(text)


if __name__ == '__main__':
    main()
