#!/usr/bin/env python3
"""Reproducibly extract a bounded, metre-scaled Kottakkal OSM slice.

Only Python's standard library is used. The input is never edited and no network
requests are made. Geometry/data retains the ODbL license, separate from app code.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
from map_geography import coordinate_bounds, kottakkal_anchor

REPO = Path(__file__).resolve().parents[1]
EARTH_RADIUS = 6371008.8
BUS_STAND_WAY = '378587276'
UPSTREAM_COMMIT = '292f3b8b61b0003f9ae1db3f52b8baa0b139e5a5'
MOTOR_ROADS = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
               'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified',
               'residential', 'living_street', 'service', 'road'}
AMENITIES = {'bus_station', 'marketplace', 'hospital', 'clinic', 'police', 'cafe', 'restaurant',
             'pharmacy', 'fuel', 'bank', 'school', 'college', 'townhall', 'place_of_worship'}
RELEVANT_TAGS = {'name', 'name:en', 'name:ml', 'ref', 'highway', 'oneway', 'junction', 'maxspeed',
                 'maxspeed:forward', 'maxspeed:backward', 'width', 'lanes', 'access', 'motor_vehicle',
                 'motorcar', 'service', 'surface', 'layer', 'bridge', 'tunnel', 'building',
                 'building:levels', 'height', 'amenity', 'shop', 'public_transport', 'natural',
                 'water', 'waterway', 'operator'}


def tags(element: ET.Element) -> dict[str, str]:
    return {t.attrib['k']: t.attrib['v'] for t in element.findall('tag')}


def selected_tags(value: dict[str, str]) -> dict[str, str]:
    return {k: v for k, v in sorted(value.items()) if k in RELEVANT_TAGS}


def point(x: float, z: float) -> dict[str, float]:
    # Millimetre output precision is much smaller than the precision of the source.
    return {'x': round(x, 3) or 0.0, 'z': round(z, 3) or 0.0}


def number(raw: str | None) -> float | None:
    if raw is None:
        return None
    match = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(?:m)?\s*', raw)
    return float(match[1]) if match else None


def speed(raw: str | None) -> float | None:
    if not raw:
        return None
    match = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(km/h|kmh|kph|mph)?\s*', raw.lower())
    if not match:
        return None
    value = float(match[1]) * (1.609344 if match[2] == 'mph' else 1)
    return round(value, 3) if 0 < value <= 200 else None


def direction(t: dict[str, str]) -> str:
    raw = t.get('oneway', '').lower()
    if raw in {'yes', 'true', '1'}:
        return 'yes'
    if raw in {'-1', 'reverse'}:
        return '-1'
    if raw in {'no', 'false', '0'}:
        return 'no'
    return 'yes' if t.get('junction') == 'roundabout' else 'no'


def road_width(t: dict[str, str]) -> tuple[float, str]:
    width = number(t.get('width'))
    if width is not None and 1 <= width <= 30:
        return width, 'tag'
    lanes = number(t.get('lanes'))
    if lanes is not None and 1 <= lanes <= 8:
        return round(lanes * 3.2, 2), 'lanes'
    defaults = {'motorway': 10, 'trunk': 9, 'primary': 8, 'secondary': 7, 'tertiary': 6,
                'residential': 5, 'unclassified': 4.5, 'service': 4, 'living_street': 4}
    return defaults.get(t.get('highway'), 5), 'estimate'


def inside(p: dict[str, float], extent: float) -> bool:
    return abs(p['x']) <= extent and abs(p['z']) <= extent


def clipped_segment(a: dict[str, float], b: dict[str, float], extent: float):
    """Liang–Barsky clipping preserves the exact shape of every retained segment."""
    dx, dz = b['x'] - a['x'], b['z'] - a['z']
    lo, hi = 0.0, 1.0
    for p, q in [(-dx, a['x'] + extent), (dx, extent - a['x']),
                 (-dz, a['z'] + extent), (dz, extent - a['z'])]:
        if abs(p) < 1e-12:
            if q < 0:
                return None
        else:
            ratio = q / p
            if p < 0:
                lo = max(lo, ratio)
            else:
                hi = min(hi, ratio)
            if lo > hi:
                return None
    if hi - lo < 1e-10:
        return None
    return lo, hi, point(a['x'] + dx * lo, a['z'] + dz * lo), point(a['x'] + dx * hi, a['z'] + dz * hi)


def clipped_parts(way_id: str, refs: list[str], projected: dict[str, dict[str, float]], extent: float):
    parts, ids, points = [], [], []

    def finish():
        nonlocal ids, points
        if len(points) >= 2:
            parts.append((ids, points))
        ids, points = [], []

    for segment, (aid, bid) in enumerate(zip(refs, refs[1:])):
        if aid not in projected or bid not in projected:
            finish()  # Never connect across a missing OSM node.
            continue
        clipped = clipped_segment(projected[aid], projected[bid], extent)
        if clipped is None:
            finish()
            continue
        lo, hi, start, end = clipped
        if start == end:
            continue
        sid = aid if lo < 1e-10 else f'clip:{way_id}:{segment}:start'
        eid = bid if hi > 1 - 1e-10 else f'clip:{way_id}:{segment}:end'
        if points and points[-1] == start:
            if points[-1] != end:
                ids.append(eid)
                points.append(end)
        else:
            finish()
            ids, points = [sid, eid], [start, end]
        if hi < 1 - 1e-10:
            finish()
    finish()
    return parts


def polygon(refs: list[str], projected: dict[str, dict[str, float]], extent: float):
    if len(refs) < 4 or refs[0] != refs[-1] or any(r not in projected for r in refs):
        return None
    pts = [projected[r] for r in refs[:-1]]
    if len(set(refs[:-1])) < 3 or any(not inside(p, extent) for p in pts):
        return None
    area = sum(a['x'] * b['z'] - b['x'] * a['z'] for a, b in zip(pts, pts[1:] + pts[:1])) / 2
    if abs(area) < 0.5:
        return None
    # Reject bow-ties/invalid ring crossings rather than silently inventing a footprint.
    def orientation(a, b, c):
        return (b['x'] - a['x']) * (c['z'] - a['z']) - (b['z'] - a['z']) * (c['x'] - a['x'])
    count = len(pts)
    for i in range(count):
        a, b = pts[i], pts[(i + 1) % count]
        for j in range(i + 2, count):
            if i == 0 and j == count - 1:
                continue
            c, d = pts[j], pts[(j + 1) % count]
            if orientation(a, b, c) * orientation(a, b, d) < -1e-8 and orientation(c, d, a) * orientation(c, d, b) < -1e-8:
                return None
    return pts


def import_map(input_path: Path, extent: float, origin_lat: float | None = None, origin_lon: float | None = None,
               upstream_commit: str = UPSTREAM_COMMIT):
    raw = input_path.read_bytes()
    if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('DTD/entity declarations are not supported in OSM input')
    root = ET.fromstring(raw)
    if root.tag != 'osm':
        raise ValueError('expected an <osm> XML document')
    nodes = {n.attrib['id']: n for n in root.findall('node')}
    actual_bounds = coordinate_bounds(nodes)
    ways = root.findall('way')
    if (origin_lat is None) != (origin_lon is None):
        raise ValueError('--origin-lat and --origin-lon must be supplied together')
    origin_source = {'type': 'explicit', 'id': None, 'method': 'explicit CLI origin'}
    if origin_lat is None:
        kottakkal_anchor(root, nodes)
        anchor = next((w for w in ways if w.get('id') == BUS_STAND_WAY), None)
        if anchor is None:
            raise ValueError('Kottakkal bus-stand way is missing; provide an explicit test/import origin')
        refs = list(dict.fromkeys(n.attrib['ref'] for n in anchor.findall('nd')))
        if not refs or any(r not in nodes for r in refs):
            raise ValueError('bus-stand anchor has missing node references')
        origin_lat = round(sum(float(nodes[r].attrib['lat']) for r in refs) / len(refs), 9)
        origin_lon = round(sum(float(nodes[r].attrib['lon']) for r in refs) / len(refs), 9)
        origin_source = {'type': 'way', 'id': BUS_STAND_WAY, 'method': 'arithmetic mean of unique source vertices, excluding repeated ring closure'}
    if not (-85 < origin_lat < 85 and -180 <= origin_lon <= 180):
        raise ValueError('invalid projection origin')
    cos_lat = math.cos(math.radians(origin_lat))
    projected = {}
    for ref, node in nodes.items():
        lat, lon = float(node.attrib['lat']), float(node.attrib['lon'])
        if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError(f'invalid source coordinates on node {ref}')
        projected[ref] = point(EARTH_RADIUS * cos_lat * math.radians(lon - origin_lon), -EARTH_RADIUS * math.radians(lat - origin_lat))
    stats = collections.Counter(sourceNodes=len(nodes), sourceWays=len(ways), sourceRelations=len(root.findall('relation')))
    roads, buildings, landmarks, water = [], [], [], []
    # Relations with holes or multiple rings require topology handling: do not fake them as solid polygons.
    relation_members = set()
    for relation in root.findall('relation'):
        t = tags(relation)
        if t.get('type') == 'multipolygon' and (t.get('building') or t.get('natural') == 'water' or t.get('water')):
            relation_members.update(m.get('ref') for m in relation.findall('member') if m.get('type') == 'way')
            stats['unsupportedMultipolygons'] += 1
        if t.get('type') == 'restriction':
            stats['sourceTurnRestrictions'] += 1
    for way in ways:
        ref = way.attrib['id']; t = tags(way); refs = [n.attrib['ref'] for n in way.findall('nd')]
        stats['missingWayNodeReferences'] += sum(r not in nodes for r in refs)
        if t.get('highway') in MOTOR_ROADS and t.get('area') != 'yes':
            if any(t.get(k) in {'no', 'private'} for k in ('access', 'motor_vehicle', 'motorcar')):
                stats['excludedRestrictedRoads'] += 1
            else:
                width, width_source = road_width(t)
                parts = clipped_parts(ref, refs, projected, extent)
                for i, (node_ids, pts) in enumerate(parts):
                    raw_layer = t.get('layer', '0')
                    try:
                        layer = int(raw_layer)
                    except ValueError:
                        layer = 0
                        stats['unparsedLayers'] += 1
                    roads.append({'id': ref if len(parts) == 1 else f'{ref}:{i}', 'sourceWayId': ref,
                                  'name': t.get('name:en', t.get('name', '')), 'highway': t['highway'],
                                  'oneway': direction(t), 'maxspeed': speed(t.get('maxspeed')), 'layer': layer,
                                  'bridge': t.get('bridge', 'no') not in {'no', 'false', '0'},
                                  'width': width, 'widthSource': width_source, 'nodeIds': node_ids,
                                  'points': pts, 'tags': selected_tags(t)})
        if t.get('building') and t.get('building') != 'no':
            pts = None if ref in relation_members else polygon(refs, projected, extent)
            if pts:
                actual_height = number(t.get('height'))
                levels = number(t.get('building:levels'))
                estimated_height = min(36, max(3, levels * 3.1)) if levels else (3.5 if t.get('building') in {'shed', 'garage'} else 7.5)
                if actual_height is not None and not 0 < actual_height <= 500:
                    actual_height = None
                    stats['unsupportedBuildingHeights'] += 1
                height = actual_height if actual_height is not None else estimated_height
                buildings.append({'id': ref, 'name': t.get('name:en', t.get('name', '')), 'kind': t.get('building', 'yes'),
                                  'height': round(height, 2), 'heightSource': 'tag' if actual_height else 'estimate',
                                  'points': pts, 'tags': selected_tags(t)})
            else:
                stats['skippedBuildingFootprints'] += 1
        water_area = t.get('natural') == 'water' or t.get('water') in {'pond', 'reservoir', 'lake', 'basin'} or t.get('waterway') == 'riverbank'
        if water_area:
            pts = None if ref in relation_members else polygon(refs, projected, extent)
            if pts:
                water.append({'id': ref, 'kind': 'area', 'name': t.get('name', ''), 'points': pts})
            else:
                stats['skippedWaterAreas'] += 1
        elif t.get('waterway') in {'stream', 'river', 'canal', 'drain'}:
            parts = clipped_parts(ref, refs, projected, extent)
            for i, (_, pts) in enumerate(parts):
                water.append({'id': ref if len(parts) == 1 else f'{ref}:{i}', 'kind': 'stream', 'name': t.get('name', ''), 'points': pts})
    def landmark(element, location):
        t = tags(element)
        kind = t.get('amenity') if t.get('amenity') in AMENITIES else ('shop' if t.get('shop') else None)
        if t.get('highway') in {'bus_stop', 'traffic_signals'}:
            kind = t['highway']
        elif t.get('public_transport') in {'station', 'platform'}:
            kind = kind or 'bus_stop'
        name = t.get('name:en', t.get('name', ''))
        if not kind or not inside(location, extent) or (not name and kind not in {'bus_stop', 'traffic_signals', 'bus_station'}):
            return
        landmarks.append({'id': f'{element.tag}/{element.attrib["id"]}', 'name': name or kind.replace('_', ' ').title(), 'kind': kind,
                          **location, 'tags': selected_tags(t)})
    for ref, node in nodes.items():
        if node.findall('tag'):
            landmark(node, projected[ref])
    for way in ways:
        refs = list(dict.fromkeys(n.attrib['ref'] for n in way.findall('nd')))
        if refs and all(r in projected for r in refs):
            # A source-derived representative point, not an invented building/entrance position.
            location = point(sum(projected[r]['x'] for r in refs) / len(refs), sum(projected[r]['z'] for r in refs) / len(refs))
            landmark(way, location)
    shared = collections.defaultdict(set)
    source_ways = {}
    for road in roads:
        source_ways[road['id']] = road['sourceWayId']
        for ref in road['nodeIds']:
            if not ref.startswith('clip:'):
                shared[ref].add(road['id'])
    intersections = [{'id': ref, **projected[ref], 'roadIds': sorted(road_ids)} for ref, road_ids in sorted(shared.items(), key=lambda x: int(x[0]))
                     if len({source_ways[road_id] for road_id in road_ids}) > 1]
    stats.update(roads=len(roads), buildings=len(buildings), landmarks=len(landmarks), waterFeatures=len(water), intersections=len(intersections),
                 roadVertices=sum(len(r['points']) for r in roads), oneWayRoadParts=sum(r['oneway'] != 'no' for r in roads),
                 explicitSpeedRoadParts=sum(r['maxspeed'] is not None for r in roads), bridges=sum(r['bridge'] for r in roads))
    source = {'file': input_path.name, 'sha256': hashlib.sha256(raw).hexdigest(), 'copyright': '© OpenStreetMap contributors',
              'license': 'https://opendatacommons.org/licenses/odbl/1-0/', 'upstreamCommit': upstream_commit}
    data = {'version': 1, 'source': source,
            'projection': {'latitude': origin_lat, 'longitude': origin_lon, 'earthRadius': EARTH_RADIUS},
            'bounds': {'minX': -extent, 'maxX': extent, 'minZ': -extent, 'maxZ': extent},
            'roads': roads, 'buildings': buildings, 'landmarks': landmarks, 'water': water,
            'intersections': intersections, 'stats': dict(sorted(stats.items()))}
    map_bounds = root.find('bounds')
    provenance = {'source': source, 'sourceBytes': len(raw), 'sourceBounds': dict(map_bounds.attrib) if map_bounds is not None else None,
                  'actualSourceNodeBounds': actual_bounds,
                  'originFeature': origin_source, 'projection': data['projection'], 'bounds': data['bounds'],
                  'formula': 'x=R*cos(latitude0)*radians(longitude-longitude0); z=-R*radians(latitude-latitude0)',
                  'units': 'metres', 'coordinatePrecisionMetres': 0.001,
                  'attributionUrl': 'https://www.openstreetmap.org/copyright',
                  'limitations': ['Approximate local equirectangular projection, not a surveyed 3D/elevation model.',
                                 'Only retained motor-road segments and complete valid closed single-ring building/water footprints are rendered.',
                                 'Widths and building heights are authored estimates where source tags are absent; widthSource/heightSource identify these.',
                                 'Road topology uses shared original OSM node IDs, not inferred geometric intersections.',
                                 'Multipolygon relations are omitted rather than filling holes incorrectly; relation/member diagnostics are counted.',
                                 'Only explicit numeric maxspeed tags are exported; unknown limits stay null.',
                                 'OSM tags reflect the uploaded snapshot and are not a statement of current traffic law.'],
                  'stats': data['stats']}
    return data, provenance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=REPO / 'map.osm')
    parser.add_argument('--output', type=Path, default=REPO / 'public/maps/kottakkal.json')
    parser.add_argument('--provenance', type=Path)
    parser.add_argument('--extent', type=float, default=650)
    parser.add_argument('--origin-lat', type=float)
    parser.add_argument('--origin-lon', type=float)
    parser.add_argument('--upstream-commit', default=UPSTREAM_COMMIT)
    args = parser.parse_args()
    if not math.isfinite(args.extent) or not 10 <= args.extent <= 3000:
        parser.error('--extent must be finite and between 10 and 3000 metres')
    try:
        data, provenance = import_map(args.input, args.extent, args.origin_lat, args.origin_lon, args.upstream_commit)
        if args.output.resolve() == (REPO / 'public/maps/kottakkal.json').resolve():
            anchor_root = ET.fromstring(args.input.read_bytes())
            anchor = kottakkal_anchor(anchor_root, {n.get('id'): n for n in anchor_root.findall('node')})
            if any(abs(data['projection'][k] - anchor[k]) > 1e-9 for k in ('latitude', 'longitude')):
                raise ValueError('production Kottakkal output must use the verified bus-stand origin')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        provenance_path = args.provenance or (REPO / 'data/OSM_PROVENANCE.json' if args.output.resolve() == (REPO / 'public/maps/kottakkal.json').resolve() else args.output.with_suffix('.provenance.json'))
        provenance_path.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')
        provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
        print(json.dumps({'output': str(args.output), 'bytes': args.output.stat().st_size, **data['stats']}, sort_keys=True))
    except (ValueError, OSError, ET.ParseError) as error:
        parser.exit(1, f'OSM import failed: {error}\n')


if __name__ == '__main__':
    main()
