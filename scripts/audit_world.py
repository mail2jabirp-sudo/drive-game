#!/usr/bin/env python3
"""Audit uploaded source geometry and current clipping; no synthetic connectivity."""
from pathlib import Path
import collections,hashlib,json,math,xml.etree.ElementTree as ET
from import_osm import MOTOR_ROADS
ROOT=Path(__file__).resolve().parents[1]
def audit(path,projection,bounds):
 nodes={};ways=[];counts=collections.Counter();classes=collections.Counter();features=collections.Counter();relation_counts=collections.Counter()
 for _,e in ET.iterparse(path,events=('end',)):
  if e.tag=='node':
   lat,lon=float(e.attrib['lat']),float(e.attrib['lon'])
   if not(math.isfinite(lat+lon) and -90<=lat<=90 and -180<=lon<=180):raise ValueError('Invalid coordinate')
   nodes[e.attrib['id']]=(lat,lon);counts['nodes']+=1;e.clear()
  elif e.tag=='way':
   tags={t.attrib['k']:t.attrib['v'] for t in e.findall('tag')};refs=[n.attrib['ref'] for n in e.findall('nd')];ways.append((e.attrib['id'],refs,tags));counts['ways']+=1;e.clear()
  elif e.tag=='relation':
   tags={t.attrib['k']:t.attrib['v'] for t in e.findall('tag')};relation_counts[tags.get('type','untyped')]+=1;counts['relations']+=1;e.clear()
 if not nodes:raise ValueError('No nodes')
 R=projection['earthRadius'];lat0=projection['latitude'];lon0=projection['longitude']
 xy={n:(R*math.cos(math.radians(lat0))*math.radians(lon-lon0),-R*math.radians(lat-lat0)) for n,(lat,lon) in nodes.items()}
 parents={};adj=collections.defaultdict(set);used=set();outside=set();partial=set();eligible=[];length=0;missing=0;bridges=0;restricted=0
 def find(x):
  parents.setdefault(x,x)
  while parents[x]!=x:parents[x]=parents[parents[x]];x=parents[x]
  return x
 def inside(n):
  x,z=xy[n];return bounds['minX']<=x<=bounds['maxX'] and bounds['minZ']<=z<=bounds['maxZ']
 for wid,refs,t in ways:
  if t.get('building') and t['building']!='no':features['buildingWays']+=1
  if t.get('natural')=='water' or t.get('water') or t.get('waterway')=='riverbank':features['waterAreaWays']+=1
  if t.get('waterway') in ('river','stream','canal','drain','ditch'):features['waterwayWays']+=1
  if t.get('landuse'):features['landuse:'+t['landuse']]+=1
  if t.get('highway'):classes[t['highway']]+=1
  if t.get('highway') not in MOTOR_ROADS or t.get('area')=='yes':continue
  if any(t.get(k) in ('private','no') for k in ('access','motor_vehicle','motorcar')):restricted+=1;continue
  if any(n not in nodes for n in refs):missing+=1;continue
  eligible.append(wid);used.update(refs)
  if not all(inside(n) for n in refs):partial.add(wid)
  if not any(inside(n) for n in refs):outside.add(wid)
  if t.get('bridge','no') not in ('no','false','0'):bridges+=1
  for a,b in zip(refs,refs[1:]):
   ra,rb=find(a),find(b);parents[ra]=rb;adj[a].add(b);adj[b].add(a)
   ax,az=xy[a];bx,bz=xy[b];length+=math.hypot(ax-bx,az-bz)
 components=collections.Counter(find(n) for n in used);main=components.most_common(1)[0][0]
 def bbox(ids):
  pts=[nodes[n] for n in ids];return {'minLat':min(p[0] for p in pts),'maxLat':max(p[0] for p in pts),'minLon':min(p[1] for p in pts),'maxLon':max(p[1] for p in pts)}
 projected=[xy[n] for n in used]
 return {'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'objects':dict(counts),'allNodeBounds':bbox(nodes),'motorRoadBounds':bbox(used),'projectedMotorBounds':{'minX':min(p[0] for p in projected),'maxX':max(p[0] for p in projected),'minZ':min(p[1] for p in projected),'maxZ':max(p[1] for p in projected)},'eligibleMotorWays':len(eligible),'excludedRestrictedWays':restricted,'missingNodeMotorWays':missing,'motorLengthKm':round(length/1000,3),'waysNotFullyInsideCurrentWindow':len(partial),'waysWithNoVerticesInsideCurrentWindow':len(outside),'weakComponents':len(components),'largestWeakComponentNodes':components[main],'motorNodes':len(used),'largestWeakComponentBounds':bbox(n for n in used if find(n)==main),'componentSizesTop10':[v for _,v in components.most_common(10)],'junctionNodes':sum(len(v)>2 for v in adj.values()),'bridgeWays':bridges,'highwayClasses':dict(sorted(classes.items())),'mappedWayFeatures':dict(sorted(features.items())),'relationTypes':dict(relation_counts),'limitations':['Weak connectivity is not proof of bidirectional reachability or legal turn access.','No administrative district boundary validation.','Lengths follow projected source centre lines, not carriageway counts.']}
def main():
 manifest=json.loads((ROOT/'public/maps/district/manifest.json').read_text());out={'projection':manifest['projection'],'previousPlayableBounds':json.loads((ROOT/'data/NETWORK_BASELINE.json').read_text())['bounds'],'previousTiles':json.loads((ROOT/'data/NETWORK_BASELINE.json').read_text())['stats']['tiles'],'currentPlayableBounds':manifest['bounds'],'sources':[audit(ROOT/n,manifest['projection'],json.loads((ROOT/'data/NETWORK_BASELINE.json').read_text())['bounds']) for n in ['export.osm','map.osm']]}
 target=ROOT/'data/WORLD_AUDIT.json';target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
