#!/usr/bin/env python3
"""Prove packed roads preserve source-node coordinates and directed reachability."""
from pathlib import Path
import collections,json,math
ROOT=Path(__file__).resolve().parents[1]
def generate():
 m=json.loads((ROOT/'public/maps/district/manifest.json').read_text());coords={};parents={};forward=collections.defaultdict(set);reverse=collections.defaultdict(set);ways=set();bridges=set();length=0;fragments=0
 def find(n):
  parents.setdefault(n,n)
  while parents[n]!=n:parents[n]=parents[parents[n]];n=parents[n]
  return n
 for key,desc in m['tiles'].items():
  ix,iz=map(int,key.split(','));tile=json.loads((ROOT/'public/maps/district'/desc['file']).read_text())
  for r in tile['roads']:
   ways.add(r['sourceWayId']);fragments+=1
   if r['bridge']:bridges.add(r['sourceWayId'])
   assert len(r['points'])==len(r['nodeIds'])>=2
   for n,p in zip(r['nodeIds'],r['points']):
    pair=(p['x'],p['z']);assert coords.get(n,pair)==pair,('Shared node moved',n,coords.get(n),pair);coords[n]=pair
    assert ix*600-.001<=p['x']<=(ix+1)*600+.001 and iz*600-.001<=p['z']<=(iz+1)*600+.001,(key,n)
   for a,b in zip(r['nodeIds'],r['nodeIds'][1:]):
    if a==b:continue
    parents[find(a)]=find(b);pa,pb=coords[a],coords[b];length+=math.hypot(pa[0]-pb[0],pa[1]-pb[1])
    if r['oneway']!='-1':forward[a].add(b);reverse[b].add(a)
    if r['oneway']!='yes':forward[b].add(a);reverse[a].add(b)
 def visit(graph):
  seen={m['origin']['nodeId']};q=list(seen)
  for n in q:
   for nxt in graph.get(n,()):
    if nxt not in seen:seen.add(nxt);q.append(nxt)
  return seen
 reachable=visit(forward);returnable=visit(reverse);roundtrip=reachable&returnable;groups=collections.Counter(find(n) for n in coords)
 source_audit=json.loads((ROOT/'data/WORLD_AUDIT.json').read_text())['sources'][0]
 assert len(ways)==source_audit['eligibleMotorWays'];assert len(groups)==source_audit['weakComponents'],('Unexpected connectivity loss',len(groups))
 far=sorted((n for n in roundtrip if n.isdigit()),key=lambda n:math.hypot(*coords[n]),reverse=True)
 result={'sourceSha256':m['source']['sha256'],'tiles':len(m['tiles']),'uniqueMotorWays':len(ways),'roadFragments':fragments,'lengthKm':round(length/1000,3),'sharedNodeCoordinateConflicts':0,'weakComponents':len(groups),'sourceWeakComponents':source_audit['weakComponents'],'reachableDirectedNodes':len(reachable),'returnableDirectedNodes':len(returnable),'roundTripNodes':len(roundtrip),'originalRoundTripNodes':sum(n.isdigit() for n in roundtrip),'bridgeWays':len(bridges),'farRoundTripExamples':[{'nodeId':n,'x':coords[n][0],'z':coords[n][1]} for n in far[:3]],'limitations':['Connectivity is by original OSM nodes and deterministic clip endpoints only.','Turn-restriction relations are absent from export.osm; one-way tags are applied.','Independent source components are retained, not joined with fictional links.']}
 (ROOT/'data/NETWORK_CONNECTIVITY.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));return result
if __name__=='__main__':generate()
