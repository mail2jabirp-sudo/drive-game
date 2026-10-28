"""Geographic identity checks; bounds metadata alone does not prove location."""
import math

ANCHOR_ID = '378587276'


def coordinate_bounds(nodes):
    coords = [(float(n.attrib['lat']), float(n.attrib['lon'])) for n in nodes.values()]
    if not coords or any(not (math.isfinite(a) and math.isfinite(o) and -90 <= a <= 90 and -180 <= o <= 180) for a, o in coords):
        raise ValueError('missing or invalid geographic coordinates')
    return dict(minLat=min(a for a, _ in coords), maxLat=max(a for a, _ in coords),
                minLon=min(o for _, o in coords), maxLon=max(o for _, o in coords))


def kottakkal_anchor(root, nodes):
    anchor = next((w for w in root.findall('way') if w.get('id') == ANCHOR_ID), None)
    if anchor is None:
        raise ValueError('unverified Kottakkal location: bus-stand anchor is missing')
    tags = {t.get('k'): t.get('v') for t in anchor.findall('tag')}
    refs = list(dict.fromkeys(n.get('ref') for n in anchor.findall('nd')))
    if not refs or any(r not in nodes for r in refs):
        raise ValueError('Kottakkal anchor has incomplete geometry')
    lat = sum(float(nodes[r].get('lat')) for r in refs) / len(refs)
    lon = sum(float(nodes[r].get('lon')) for r in refs) / len(refs)
    if not (10.99 < lat < 11.015 and 75.99 < lon < 76.02) or tags.get('amenity') != 'bus_station' or 'kottakkal' not in tags.get('name', '').lower():
        raise ValueError('incorrect Kottakkal anchor location or identity')
    return {'latitude': round(lat, 9), 'longitude': round(lon, 9)}
