#!/usr/bin/env python3
"""Extract control nodes from the unchanged uploaded OSM; no guessed geographic locations."""
from pathlib import Path
import json,math,hashlib,xml.etree.ElementTree as ET,argparse
ROOT=Path(__file__).resolve().parents[1]
def generate():
    m=json.loads((ROOT/'public/maps/district/manifest.json').read_text());p=m['projection'];b=m['bounds'];controls=[]
    for _,e in ET.iterparse(ROOT/'export.osm',events=('end',)):
        if e.tag=='node':
            tags={t.attrib['k']:t.attrib['v'] for t in e.findall('tag')};kind=tags.get('highway')
            if kind in ('traffic_signals','crossing'):
                lat=float(e.attrib['lat']);lon=float(e.attrib['lon']);x=p['earthRadius']*math.cos(math.radians(p['latitude']))*math.radians(lon-p['longitude']);z=-p['earthRadius']*math.radians(lat-p['latitude'])
                if b['minX']<=x<=b['maxX'] and b['minZ']<=z<=b['maxZ']:
                    controls.append({'nodeId':e.attrib['id'],'kind':kind,'x':round(x,3),'z':round(z,3),'tags':tags})
            e.clear()
        elif e.tag in ('way','relation'):e.clear()
    return {'version':1,'sourceSha256':hashlib.sha256((ROOT/'export.osm').read_bytes()).hexdigest(),'projection':p,'controls':sorted(controls,key=lambda c:c['nodeId']),'copyright':'© OpenStreetMap contributors','license':'ODbL 1.0','limitations':['Source node locations only; rendered curb offsets/stripe widths are artwork.','Signal phases are game rules, not surveyed timings or real-time traffic law.','Only nodes present in the currently loaded drivable graph control traffic.']}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');a=parser.parse_args();path=ROOT/'public/maps/district/traffic-controls.json';data=generate();encoded=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n'
    if a.check:
        if path.read_text()!=encoded:raise SystemExit('Traffic controls differ from preserved OSM source')
    else:path.write_text(encoded)
    print('Source-backed traffic controls:',len(data['controls']))
