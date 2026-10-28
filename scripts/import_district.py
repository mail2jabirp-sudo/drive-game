#!/usr/bin/env python3
"""Expand the SAME geographic road frame; retain earlier datasets as immutable archives."""
from pathlib import Path
import json,math,hashlib,sys,xml.etree.ElementTree as ET
from import_export_roads import generate,encode,ROOT,R,SIZE
from world_features import features,feature_tiles,road_tiles,road_conflicts

def main(output=None,provenance=None):
    out=output or ROOT/'public/maps/district'; provenance=provenance or ROOT/'data/DISTRICT_PROVENANCE.json'
    defaults=json.loads((ROOT/'data/ROAD_WIDTH_DEFAULTS.json').read_text())
    if any(not isinstance(w,(int,float)) or not 2<=w<=20 for w in defaults.values()):raise ValueError('Invalid fallback width configuration')
    generate(out,provenance,18000,full_source=True,width_defaults=defaults)
    m=json.loads((out/'manifest.json').read_text());old=json.loads((ROOT/'public/maps/kottakkal.json').read_text())
    p=m['projection'];op=old['projection']
    def convert(point):
        lat=op['latitude']-point['z']/R*180/math.pi
        lon=op['longitude']+point['x']/(R*math.cos(math.radians(op['latitude'])))*180/math.pi
        return {'x':round(R*math.cos(math.radians(p['latitude']))*math.radians(lon-p['longitude']),3),'z':round(-R*math.radians(lat-p['latitude']),3)}
    tiles={key:json.loads((out/t['file']).read_text()) for key,t in m['tiles'].items()}
    present={r['sourceWayId'] for t in tiles.values() for r in t['roads']}
    canonical={n:p for t in tiles.values() for r in t['roads'] for n,p in zip(r['nodeIds'],r['points']) if not n.startswith('clip:')}
    full,feature_provenance=features(p)
    conflicts=road_conflicts(full['buildings'],[r for t in tiles.values() for r in t['roads']])
    reused={'roads':0,'buildings':0,'landmarks':0,'water':0,'landuse':0}
    # Reuse earlier real footprints/water/landmarks in the shared projection. Never reuse fictional scenery.
    # Roads already provided by export keep that snapshot; absent earlier source ways are retained.
    for kind in reused:
        for feature in full[kind]:
            if kind=='roads':
                if feature['sourceWayId'] in present:continue
                for key,item in road_tiles(feature,canonical):
                    tiles.setdefault(key,{'version':1,'roads':[]})['roads'].append(item)
                reused[kind]+=1
                continue
            item=dict(feature)
            if 'points'in item:points=item['points']
            else:
                points=[item]
            for key in feature_tiles(item):
                if key not in tiles:tiles[key]={'version':1,'roads':[]}
                tiles[key].setdefault(kind,[]).append(item)
            reused[kind]+=1
    # Source-verified bilingual place nodes only, not a hardcoded list of towns.
    places=[]
    for _,e in ET.iterparse(ROOT/'map.osm',events=('end',)):
        if e.tag=='node':
            tags={t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}
            if tags.get('place') and tags.get('name'):
                lat=float(e.attrib['lat']);lon=float(e.attrib['lon']);x=R*math.cos(math.radians(p['latitude']))*math.radians(lon-p['longitude']);z=-R*math.radians(lat-p['latitude'])
                key=f'{math.floor(x/SIZE)},{math.floor(z/SIZE)}'
                if key in tiles:
                    places.append({'id':e.attrib['id'],'x':round(x,3),'z':round(z,3),'name':tags.get('name:en',tags['name']),'nameMl':tags.get('name:ml',''),'source':'map.osm node '+e.attrib['id']})
            e.clear()
        elif e.tag in ('way','relation'):e.clear()
    m['places']=places;m['legacyProjection']=op;m['legacySourceHash']=old['source']['sha256']
    for key,tile in sorted(tiles.items()):
        name=key.replace(',','_')+'.json';payload=encode(tile);(out/name).write_bytes(payload)
        m['tiles'][key]={'file':name,'sha256':hashlib.sha256(payload).hexdigest(),'bytes':len(payload),'roads':len(tile['roads']),'vertices':sum(len(r['points']) for r in tile['roads'])}
    cafes=[f for t in tiles.values() for f in t.get('landmarks',[]) if f.get('tags',{}).get('amenity')=='cafe']
    for cafe in cafes:
        candidates=[]
        ix,iz=math.floor(cafe['x']/SIZE),math.floor(cafe['z']/SIZE)
        for x in range(ix-1,ix+2):
            for z in range(iz-1,iz+2):
                for road in tiles.get(f'{x},{z}',{}).get('roads',[]):
                    for a,b in zip(road['points'],road['points'][1:]):
                        dx=b['x']-a['x'];dz=b['z']-a['z'];length=dx*dx+dz*dz
                        if not length:continue
                        t=max(0,min(1,((cafe['x']-a['x'])*dx+(cafe['z']-a['z'])*dz)/length));x0=a['x']+t*dx;z0=a['z']+t*dz
                        candidates.append((math.hypot(x0-cafe['x'],z0-cafe['z']),x0,z0,road['sourceWayId']))
        if candidates:
            distance,x,z,way=min(candidates)
            if distance<40:
                m['teaStop']={'x':round(x,3),'z':round(z,3),'name':'Near '+cafe['name'],'source':'Authored game stop on source way '+way+' near map.osm landmark '+cafe['id']};break
    anchors=json.loads((ROOT/'data/WORLD_GAME_ANCHORS.json').read_text())
    if anchors['sourceSha256']!=m['source']['sha256'] or anchors['projection']!=m['projection']:raise ValueError('Game anchor source/projection mismatch')
    m['teaStop']=anchors['teaStop']
    m['world']='Malappuram District';m['coverageComplete']=False
    m['additionalSources']=[old['source']];m['reusedKottakkalFeatures']=reused
    m['featureConflicts']=conflicts
    m['featureCoverage']={'source':'map.osm','stats':full['stats'],'landuse':len(full['landuse']),'geographicBounds':feature_provenance['sourceBounds'],'limitations':feature_provenance['limitations']}
    m['stats']['additionalFeatureCopies']=sum(len(t.get(k,[])) for t in tiles.values() for k in ['buildings','landmarks','water','landuse'])
    m['stats']['tiles']=len(tiles)
    m['limitations']+=['One unified coordinate frame; no administrative district boundary or full district completeness claim.','All supported map.osm footprints/water/landmarks/landuse included in the shared projection; visual heights remain estimates.','Distant requested towns are not added unless verified source features cover them; road-only gaps remain.']
    (out/'manifest.json').write_bytes(encode(m))
    previous=json.loads(provenance.read_text());previous.update(m);provenance.write_text(json.dumps(previous,ensure_ascii=False,indent=2)+'\n')
    (out/'NOTICE.txt').write_text('© OpenStreetMap contributors. Derived road/feature database: ODbL 1.0. https://www.openstreetmap.org/copyright\nhttps://opendatacommons.org/licenses/odbl/1-0/\nSources: export.osm and map.osm, preserved in the repository. See data/DISTRICT_PROVENANCE.json and scripts/import_district.py. Partial coverage only.\n')
    print(json.dumps({'tiles':len(tiles),'reused':reused,'placeCount':len(places),'buildingConflicts':len(conflicts['excludedBuildingIds'])},ensure_ascii=False))
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path);parser.add_argument('--provenance',type=Path);a=parser.parse_args();main(a.output,a.provenance)
