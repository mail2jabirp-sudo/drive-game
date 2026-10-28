"""Read-only Phase 06 geography/conflict audit. Writes generated evidence only."""
import json, math, hashlib, xml.etree.ElementTree as ET
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]
IDS='378584865,378587276,736701784,746518430,746518442,746518443,746518446,746518448,746518461,746518470,746518471,749798218,749798219,749798255,824720111,827600182,830296355,830320913,830324993,855393145,855393146,891592468,891667290,891785628,891785920,891804112,891804516,891963240,891965947,961959344,961968570,961971232,996834571,1096228153'.split(',')
m=json.loads((ROOT/'public/maps/district/manifest.json').read_text());p=m['projection'];r=p['earthRadius']
def project(lat,lon):return {'x':r*math.cos(math.radians(p['latitude']))*math.radians(lon-p['longitude']),'z':-r*math.radians(lat-p['latitude'])}
raw=ET.parse(ROOT/'map.osm').getroot();nodes={n.attrib['id']:project(float(n.attrib['lat']),float(n.attrib['lon'])) for n in raw.findall('node')};ways={w.attrib['id']:w for w in raw.findall('way')}
bs={};roads={}
for key,meta in m['tiles'].items():
 ix,iz=map(int,key.split(','))
 if not(-19<=ix<=-10 and 5<=iz<=14):continue
 tile=json.loads((ROOT/'public/maps/district'/meta['file']).read_text())
 for b in tile.get('buildings',[]):bs[b['id']]=b
 for road in tile['roads']:roads[road['id']]=road
def dist(q,a,b):
 dx,dz=b['x']-a['x'],b['z']-a['z'];den=dx*dx+dz*dz;t=max(0,min(1,((q['x']-a['x'])*dx+(q['z']-a['z'])*dz)/den)) if den else 0
 return math.hypot(q['x']-a['x']-t*dx,q['z']-a['z']-t*dz)
def cross(a,b,c):return (b['x']-a['x'])*(c['z']-a['z'])-(b['z']-a['z'])*(c['x']-a['x'])
def inside(q,poly):
 yes=False
 for a,b in zip(poly,poly[1:]+poly[:1]):
  if (a['z']>q['z'])!=(b['z']>q['z']) and q['x']<(b['x']-a['x'])*(q['z']-a['z'])/(b['z']-a['z'])+a['x']:yes=not yes
 return yes
def clearance(poly,a,b):
 if inside(a,poly) or inside(b,poly):return 0
 best=float('inf')
 for c,d in zip(poly,poly[1:]+poly[:1]):
  if cross(a,b,c)*cross(a,b,d)<0 and cross(c,d,a)*cross(c,d,b)<0:return 0
  best=min(best,dist(c,a,b),dist(d,a,b),dist(a,c,d),dist(b,c,d))
 return best
rows=[]
for id in IDS:
 b=bs[id];poly=b['points'];w=ways[id];original=[nodes[n.attrib['ref']] for n in w.findall('nd')];original=original[:-1] if original[0]==original[-1] else original
 error=max(min(math.hypot(q['x']-v['x'],q['z']-v['z']) for v in original) for q in poly)
 hits=[]
 for road in roads.values():
  # Broad phase avoids testing distant segments in this read-only audit.
  if min(q['x'] for q in poly)>max(q['x'] for q in road['points'])+20 or max(q['x'] for q in poly)<min(q['x'] for q in road['points'])-20:continue
  if min(q['z'] for q in poly)>max(q['z'] for q in road['points'])+20 or max(q['z'] for q in poly)<min(q['z'] for q in road['points'])-20:continue
  d=min(clearance(poly,a,c) for a,c in zip(road['points'],road['points'][1:]))
  if d<road['width']/2+.4:hits.append({'way':road['sourceWayId'],'highway':road['highway'],'width':road['width'],'widthSource':road['widthSource'],'edgeToCenterline':round(d,3),'physicalClearance':round(d-road['width']/2-.4,3)})
 hits.sort(key=lambda h:h['physicalClearance']);assert error<.001, (id,error);assert b.get('renderExcludedReason') and hits,id
 rows.append({'id':id,'maxProjectionErrorMetres':round(error,6),'diagnosis':'centerline intersects footprint' if any(h['edgeToCenterline']==0 for h in hits) else 'road width/clearance overlaps footprint','status':'withheld; source preserved','conflicts':hits,'points':poly})
node_bounds={}
for name in ['map.osm','export.osm']:
 low=[90,180];high=[-90,-180]
 for _,element in ET.iterparse(ROOT/name,events=('end',)):
  if element.tag=='node':
   lat,lon=float(element.attrib['lat']),float(element.attrib['lon']);low=[min(low[0],lat),min(low[1],lon)];high=[max(high[0],lat),max(high[1],lon)]
  element.clear()
 node_bounds[name]={'minlat':low[0],'minlon':low[1],'maxlat':high[0],'maxlon':high[1]}
out={'actualNodeBounds':node_bounds,'projection':p,'sourceHashes':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['map.osm','export.osm']},'restored':0,'unresolved':len(rows),'diagnoses':dict(Counter(row['diagnosis'] for row in rows)),'rows':rows}
path=ROOT/'evidence/phase06';path.mkdir(parents=True,exist_ok=True);(path/'building-conflicts.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:v for k,v in out.items() if k!='rows'},indent=2))
