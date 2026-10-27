#!/usr/bin/env python3
"""Stream the reconstructed road export into a bounded, road-only playable tile set."""
from pathlib import Path
import collections, hashlib, json, math, xml.etree.ElementTree as ET
from import_osm import MOTOR_ROADS, direction, speed, road_width, selected_tags, clipped_segment, point
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'export.osm'; OUT=ROOT/'public/maps/malappuram'
R=6371008.8; EXTENT=2400; SIZE=600; ORIGIN_WAY='169318337'
def encode(value): return (json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n').encode()
def generate(output=OUT, provenance_path=None, extent=EXTENT):
    if extent<2400 or extent%SIZE:raise ValueError("Extent must be a multiple of 600m, at least 2400m")
    OUT=output
    digest=hashlib.sha256(); size=0
    with SOURCE.open('rb') as f:
        while block:=f.read(1024*1024):
            if b'<!DOCTYPE' in block or b'<!ENTITY' in block: raise ValueError('DTD/entities are not accepted')
            digest.update(block);size+=len(block)
    nodes={}; ways=[]; counts=collections.Counter(); classes=collections.Counter(); names=set(); meta={}; bbox=[90,180,-90,-180]; root=None
    for event,el in ET.iterparse(SOURCE,events=('start','end')):
        if event=='start':
            if root is None:
                root=el
                if el.tag!='osm': raise ValueError('Expected OSM XML')
            continue
        if el.tag=='meta': meta=dict(el.attrib)
        if el.tag not in ('node','way','relation'): continue
        counts[el.tag]+=1
        if el.tag=='node':
            lat,lon=float(el.attrib['lat']),float(el.attrib['lon'])
            if not math.isfinite(lat+lon) or not(-90<=lat<=90 and -180<=lon<=180): raise ValueError('Invalid coordinates')
            nodes[el.attrib['id']]=(lat,lon);bbox=[min(bbox[0],lat),min(bbox[1],lon),max(bbox[2],lat),max(bbox[3],lon)]
        elif el.tag=='way':
            tags={t.attrib['k']:t.attrib['v'] for t in el.findall('tag')}
            if tags.get('highway'):
                classes[tags['highway']]+=1
                refs=[n.attrib['ref'] for n in el.findall('nd')]
                if any(ref not in nodes for ref in refs): raise ValueError('Missing highway node reference')
                ways.append((el.attrib['id'],refs,tags))
        el.clear();root.clear()
    anchor=next((w for w in ways if w[0]==ORIGIN_WAY),None)
    if not anchor or 'Malappuram' not in anchor[2].get('name',''): raise ValueError('Verified Malappuram Bypass source way missing')
    anchor_id=anchor[1][len(anchor[1])//2];lat0,lon0=nodes[anchor_id]
    def project(ref):
        lat,lon=nodes[ref]; return point(R*math.cos(math.radians(lat0))*math.radians(lon-lon0),-R*math.radians(lat-lat0))
    tiles=collections.defaultdict(list); selected=set(); restricted=0; one_way=set(); projected_nodes={}
    for way_id,refs,tags in ways:
        if tags.get('highway') not in MOTOR_ROADS or tags.get('area')=='yes': continue
        if any(tags.get(k) in ('no','private') for k in ('access','motor_vehicle','motorcar')): restricted+=1;continue
        width,width_source=road_width(tags)
        base={'sourceWayId':way_id,'name':tags.get('name:en',tags.get('name','')),'highway':tags['highway'],'oneway':direction(tags),'maxspeed':speed(tags.get('maxspeed')),'layer':int(tags.get('layer','0')) if tags.get('layer','0').lstrip('-').isdigit() else 0,'bridge':tags.get('bridge','no') not in ('no','false','0'),'width':width,'widthSource':width_source,'tags':selected_tags(tags)}
        fragments={}
        for index in range(1,len(refs)):
            a,b=project(refs[index-1]),project(refs[index])
            region=clipped_segment(a,b,extent)
            if region is None: continue
            ra,rb=region[2:]
            if math.hypot(ra['x']-rb['x'],ra['z']-rb['z'])<0.001:continue
            minx=max(-extent//SIZE,math.floor(min(ra['x'],rb['x'])/SIZE));maxx=min(extent//SIZE-1,math.floor(max(ra['x'],rb['x'])/SIZE))
            minz=max(-extent//SIZE,math.floor(min(ra['z'],rb['z'])/SIZE));maxz=min(extent//SIZE-1,math.floor(max(ra['z'],rb['z'])/SIZE))
            for ix in range(minx,maxx+1):
                for iz in range(minz,maxz+1):
                    cx,cz=(ix+0.5)*SIZE,(iz+0.5)*SIZE
                    segment=clipped_segment({'x':ra['x']-cx,'z':ra['z']-cz},{'x':rb['x']-cx,'z':rb['z']-cz},SIZE/2)
                    if segment is None:continue
                    pa,pb=[point(p['x']+cx,p['z']+cz) for p in segment[2:]]
                    if math.hypot(pa['x']-pb['x'],pa['z']-pb['z'])<0.001:continue
                    def identity(p):
                        for ref,original in [(refs[index-1],a),(refs[index],b)]:
                            if p==original:
                                projected_nodes[ref]=p;return ref
                        return f"clip:{way_id}:{p['x']}:{p['z']}"
                    ia,ib=identity(pa),identity(pb); key=f'{ix},{iz}'
                    previous=fragments.get(key)
                    if previous and previous['nodeIds'][-1]==ia:
                        previous['nodeIds'].append(ib);previous['points'].append(pb)
                    else:
                        previous={**base,'id':f'{way_id}:{key}:{index}','nodeIds':[ia,ib],'points':[pa,pb]};tiles[key].append(previous);fragments[key]=previous
                    selected.add(way_id)
                    if base['name']:names.add(base['name'])
                    if base['oneway']!='no':one_way.add(way_id)
    OUT.mkdir(parents=True,exist_ok=True); index={}
    for key,roads in sorted(tiles.items()):
        filename=key.replace(',','_')+'.json'; payload=encode({'version':1,'roads':roads});(OUT/filename).write_bytes(payload)
        index[key]={'file':filename,'sha256':hashlib.sha256(payload).hexdigest(),'bytes':len(payload),'roads':len(roads),'vertices':sum(len(r['points']) for r in roads)}
    source={'file':'export.osm','sha256':digest.hexdigest(),'copyright':'© OpenStreetMap contributors','license':'https://opendatacommons.org/licenses/odbl/1-0/','upstreamCommit':'user binary attachment, reconstructed in numerical order'}
    manifest={'version':1,'source':source,'projection':{'latitude':lat0,'longitude':lon0,'earthRadius':R},'bounds':{'minX':-extent,'maxX':extent,'minZ':-extent,'maxZ':extent},'tileSize':SIZE,'tiles':index,'origin':{'wayId':ORIGIN_WAY,'nodeId':anchor_id,'name':anchor[2]['name']},'sourceCoverage':{'nodeBounds':bbox,'counts':dict(counts),'highwayClasses':dict(classes),'metadata':meta,'administrativeBoundaryPresent':False},'stats':{'sourceBytes':size,'sourceHighwayWays':len(ways),'integratedWays':len(selected),'oneWayWays':len(one_way),'tiles':len(index),'roadFragments':sum(t['roads'] for t in index.values()),'vertices':sum(t['vertices'] for t in index.values()),'excludedRestrictedWays':restricted},'roadNames':sorted(names),'limitations':[f'Playable road selection: {extent*2/1000:g}km square around a verified Malappuram Bypass vertex; partial uploaded coverage, not the whole district.' if extent!=EXTENT else 'Initial playable window only: 4.8km square around a verified source vertex of Malappuram Bypass Road, not the whole district.','No administrative boundary, building, water or turn-restriction relation coverage is established by this road-only export.','Local metre projection; no surveyed elevation. Unknown widths are estimates; untagged oneway is not legal validation.']}
    (OUT/'manifest.json').write_bytes(encode(manifest))
    provenance={**manifest,'parts':json.loads((ROOT/'.npm-cache/export-parts-validation.json').read_text())['parts']} if (ROOT/'.npm-cache/export-parts-validation.json').exists() else manifest
    # Keep reconstruction hashes reproducible even outside this preparation workspace.
    if 'parts' not in provenance:
        old=ROOT/'data/EXPORT_PROVENANCE.json'
        if old.exists():provenance['parts']=json.loads(old.read_text())['parts']
    (provenance_path or ROOT/'data/EXPORT_PROVENANCE.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'projection':manifest['projection'],'origin':manifest['origin'],'stats':manifest['stats'],'roadNames':manifest['roadNames']},ensure_ascii=False))
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=OUT);parser.add_argument('--provenance',type=Path);parser.add_argument('--extent',type=int,default=EXTENT);args=parser.parse_args();generate(args.output,args.provenance,args.extent)
