import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {RoadTileStore,nearbyTileKeys} from '../src/road-tiles.ts';
import type {RoadManifest,RoadTile} from '../src/road-tiles.ts';
import {createRoadGraph,selectMissionStops,shortestPaths} from '../src/osm-navigation.ts';
import type {OsmMap} from '../src/osm-types.ts';
const root=new URL('../',import.meta.url);
const directory=new URL('public/maps/malappuram/',root);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',directory),'utf8')) as RoadManifest;
const bytes=(file:string)=>readFileSync(new URL(file,directory));
const fetcher:typeof fetch=async(input)=>new Response(bytes(String(input).split('/').pop()!) as any);
function mapData(roads:OsmMap['roads']):OsmMap{return {version:1,source:manifest.source,projection:manifest.projection,bounds:manifest.bounds,roads,buildings:[],landmarks:[],intersections:[],water:[],stats:manifest.stats};}

test('reconstruction/source checksum and deterministic tile output agree with preserved input',()=>{
  assert.equal(createHash('sha256').update(readFileSync(new URL('export.osm',root))).digest('hex'),manifest.source.sha256);
  const provenance=JSON.parse(readFileSync(new URL('data/EXPORT_PROVENANCE.json',root),'utf8'));
  assert.deepEqual(provenance.parts.map((p:any)=>p.name),['export.osm.part01','export.osm.part02','export.osm.part03']);
  assert.equal(provenance.parts.reduce((sum:number,p:any)=>sum+p.sizeBytes,0),52112410);
  const temp=mkdtempSync(new URL('.npm-cache/export-repro-',root).pathname);
  try{
    execFileSync('python3',['scripts/import_export_roads.py','--output',temp,'--provenance',temp+'/provenance.json'],{cwd:root,stdio:'pipe'});
    for(const file of ['manifest.json',...Object.values(manifest.tiles).map(t=>t.file)])assert.deepEqual(readFileSync(temp+'/'+file),bytes(file),file);
  }finally{rmSync(temp,{recursive:true,force:true});}
});

test('every tile checksum, geometry boundary and shared-node coordinate is consistent',()=>{
  const vertices=new Map<string,string>();let reverse=0;
  for(const [key,description] of Object.entries(manifest.tiles)){
    assert.equal(createHash('sha256').update(bytes(description.file)).digest('hex'),description.sha256);
    const tile=JSON.parse(bytes(description.file).toString()) as RoadTile;
    const [ix,iz]=key.split(',').map(Number);
    for(const road of tile.roads){
      assert.equal(road.points.length,road.nodeIds.length);
      assert.ok(road.points.length>=2);
      if(road.oneway!=='no')reverse++;
      for(let i=0;i<road.points.length;i++){
        const p=road.points[i];assert.ok(p.x>=ix*600-0.001&&p.x<=(ix+1)*600+0.001);assert.ok(p.z>=iz*600-0.001&&p.z<=(iz+1)*600+0.001);
        const coord=JSON.stringify(p),previous=vertices.get(road.nodeIds[i]);if(previous)assert.equal(coord,previous);vertices.set(road.nodeIds[i],coord);
      }
    }
  }
  assert.ok(reverse>0);assert.equal(Object.keys(manifest.tiles).length,64);
});

test('nearby tile loading bounds resident memory, evicts old data and survives failed downloads',async()=>{
  const requested:string[]=[];
  const store=new RoadTileStore(manifest,async(input,init)=>{requested.push(String(input));return fetcher(input,init);},'/maps/malappuram/');
  await store.load({x:0,z:0});assert.equal(store.resident.size,9);assert.equal(requested.length,9);
  const original=[...store.resident.keys()];
  await store.load({x:650,z:0});assert.equal(store.resident.size,9);assert.equal(requested.length,12);
  assert.ok(original.some(k=>!store.resident.has(k)));assert.equal(store.hasPosition(-500,0),false);
  await store.load({x:1900,z:1900});assert.ok(store.resident.size<=9);
  const failing=new RoadTileStore(manifest,async()=>new Response('failure',{status:503}));
  await assert.rejects(()=>failing.load({x:0,z:0}));assert.equal(failing.resident.size,0);
  const corrupt=new RoadTileStore(manifest,async()=>new Response('{"version":1,"roads":[]}'));
  await assert.rejects(()=>corrupt.load({x:0,z:0}),/checksum/);
  assert.ok(nearbyTileKeys(manifest,{x:0,z:0}).length<Object.keys(manifest.tiles).length);
});

test('initial uploaded-road mission uses connected original/clipped source nodes and is returnable',async()=>{
  const store=new RoadTileStore(manifest,fetcher);await store.load({x:0,z:0});
  const data=mapData(store.roads()),mission=selectMissionStops(data),graph=createRoadGraph(data.roads);
  const ids=mission.route.map(p=>[...graph.points].find(([,q])=>p.x===q.x&&p.z===q.z)![0]);
  assert.ok(ids.length>2);
  for(let i=1;i<ids.length;i++)assert.ok(graph.edges.get(ids[i-1])?.some(e=>e.to===ids[i]));
  assert.ok(shortestPaths(graph,ids.at(-1)!).distance.has(ids[0]));
});

test('tile vertices and one-way tags derive from actual source ways without invented connections',()=>{
  const audit=execFileSync('python3',['-c',`
import xml.etree.ElementTree as E,json,math
from pathlib import Path
m=json.loads(Path('public/maps/malappuram/manifest.json').read_text());roads=[r for t in m['tiles'].values() for r in json.loads((Path('public/maps/malappuram')/t['file']).read_text())['roads']]
ids={r['sourceWayId'] for r in roads};needed={i for r in roads for i in r['nodeIds'] if not i.startswith('clip:')};nodes={};ways={};root=None
for event,el in E.iterparse('export.osm',events=('start','end')):
 if event=='start':
  if root is None:root=el
  continue
 if el.tag not in ('node','way'):continue
 if el.tag=='node' and el.get('id') in needed:nodes[el.get('id')]=(float(el.get('lat')),float(el.get('lon')))
 if el.tag=='way' and el.get('id') in ids:ways[el.get('id')]=([n.get('ref') for n in el.findall('nd')],{t.get('k'):t.get('v') for t in el.findall('tag')})
 el.clear();root.clear()
p=m['projection'];R=p['earthRadius']
for road in roads:
 refs,tags=ways[road['sourceWayId']];cursor=-1
 expected='yes' if tags.get('oneway') in ['yes','true','1'] or (not tags.get('oneway') and tags.get('junction')=='roundabout') else '-1' if tags.get('oneway') in ['-1','reverse'] else 'no'
 assert road['oneway']==expected
 for identity,point in zip(road['nodeIds'],road['points']):
  if identity.startswith('clip:'):continue
  cursor=refs.index(identity,cursor+1);lat,lon=nodes[identity]
  x=R*math.cos(math.radians(p['latitude']))*math.radians(lon-p['longitude']);z=-R*math.radians(lat-p['latitude'])
  assert abs(x-point['x'])<0.00051 and abs(z-point['z'])<0.00051
print(len(roads))
`],{cwd:root,encoding:'utf8'});
  assert.ok(Number(audit.trim())>500);
});

test('default tile transport preserves the host fetch receiver',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=(function(this:unknown,input:any){assert.equal(this,globalThis,'native browser fetch requires the global receiver');return Promise.resolve(new Response(bytes(String(input).split('/').pop()!) as any));}) as typeof fetch;
    const store=new RoadTileStore(manifest);await store.load({x:0,z:0});assert.equal(store.resident.size,9);
  }finally{globalThis.fetch=original;}
});

test('a failed replacement window leaves the existing road tiles intact',async()=>{
  let fail=false;
  const store=new RoadTileStore(manifest,async(input,init)=>fail?new Response('failed',{status:503}):fetcher(input,init));
  await store.load({x:0,z:0});const before=[...store.resident.keys()];fail=true;
  await assert.rejects(()=>store.load({x:650,z:0}));assert.deepEqual([...store.resident.keys()],before);
});
