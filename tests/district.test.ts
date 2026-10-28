import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRoadGraph,nearestRoad} from '../src/osm-navigation.ts';
import {districtRide} from '../src/route-save.ts';
import type {RoadManifest,RoadTile} from '../src/road-tiles.ts';
const m=JSON.parse(readFileSync('public/maps/district/manifest.json','utf8')) as RoadManifest;
const tiles=Object.values(m.tiles).map(t=>JSON.parse(readFileSync('public/maps/district/'+t.file,'utf8')) as RoadTile);

test('unified map reproducibly expands verified source roads while preserving archived maps',()=>{
 const temp=mkdtempSync(join(tmpdir(),'en3d-district-'));
 try{
  execFileSync('python3',['scripts/import_district.py','--output',temp,'--provenance',temp+'/provenance.json'],{stdio:'pipe'});
  for(const file of ['manifest.json','NOTICE.txt',...Object.values(m.tiles).map(t=>t.file)])assert.deepEqual(readFileSync(temp+'/'+file),readFileSync('public/maps/district/'+file),file);
 }finally{rmSync(temp,{recursive:true,force:true});}
 assert.equal((m as any).coverageComplete,false);assert.equal(Object.keys(m.tiles).length,8315);
 assert.equal(m.stats.integratedWays,39273);assert.equal(m.source.sha256,createHash('sha256').update(readFileSync('export.osm')).digest('hex'));
 assert.equal(m.legacySourceHash,createHash('sha256').update(readFileSync('map.osm')).digest('hex'));
 assert.equal(new Set(tiles.flatMap(t=>(t.buildings??[]).map(b=>b.id))).size,4673);
 assert.equal(new Set(tiles.flatMap(t=>(t.landmarks??[]).map(b=>b.id))).size,584);
 assert.equal(new Set(tiles.flatMap(t=>(t.landuse??[]).map(b=>b.id))).size,65);
 assert.equal(new Set(tiles.flatMap(t=>(t.water??[]).map(b=>b.id))).size,205);
});

test('Kottakkal uses verified bilingual place coordinates in the same connected drivable road graph',()=>{
 const place=m.places!.find(p=>p.name==='Kottakkal')!;assert.ok(place);assert.equal(place.nameMl,'കോട്ടക്കല്‍');
 const roads=tiles.flatMap(t=>t.roads),match=nearestRoad(roads,place)!;assert.ok(match.distance<200);
 const graph=createRoadGraph(roads),start=m.origin.nodeId;
 const reachable=new Set([start]),queue=[start];
 for(let i=0;i<queue.length;i++)for(const edge of graph.edges.get(queue[i])??[])if(!reachable.has(edge.to)){reachable.add(edge.to);queue.push(edge.to);}
 const target=match.road.nodeIds[match.segment];assert.ok(reachable.has(target),'a directed source-road path must connect Malappuram spawn to Kottakkal');
 const returning=new Set([target]),returnQueue=[target];
 for(let i=0;i<returnQueue.length;i++)for(const edge of graph.edges.get(returnQueue[i])??[])if(!returning.has(edge.to)){returning.add(edge.to);returnQueue.push(edge.to);}
 assert.ok(returning.has(start),'return journey must also respect one-way directions');
});

test('legacy geographic saves reproject without losing heading/passenger and current district rides retain exact coordinates',()=>{
 const legacy={version:1 as const,mapId:m.legacySourceHash!,x:30,z:65,heading:1.2,phase:'dropoff' as const};
 const migrated=districtRide(null,legacy,'osm',m)!;assert.ok(migrated.x < -8500 && migrated.x > -9500);assert.ok(migrated.z>5500&&migrated.z<6500);
 assert.equal(migrated.phase,legacy.phase);assert.equal(migrated.heading,legacy.heading);assert.equal(legacy.x,30);
 assert.equal(migrated.mapId,m.source.sha256);assert.deepEqual(districtRide(migrated,legacy,'malappuram',m),migrated);
 assert.equal(districtRide(null,null,null,m),null);
});
