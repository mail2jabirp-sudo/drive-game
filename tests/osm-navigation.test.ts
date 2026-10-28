import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { OsmMap, OsmRoad } from '../src/osm-types.ts';
import { createRoadGraph, nearestRoad, pointInPolygon, segmentDistance, shortestPaths, selectMissionStops } from '../src/osm-navigation.ts';
import { createOsmWorld } from '../src/osm-world.ts';
import { ROAD_SURFACE_Y, buildRoadFoundation, buildingConflictsWithRoad } from '../src/road-foundation.ts';
const source = JSON.parse(readFileSync(new URL('../public/maps/kottakkal.json', import.meta.url), 'utf8')) as OsmMap;
const road = (id: string, nodeIds: string[], points: {x:number;z:number}[], oneway: OsmRoad['oneway'] = 'no'): OsmRoad => ({id,sourceWayId:id,nodeIds,points,oneway,name:'Test source road',highway:'primary',layer:0,bridge:false,maxspeed:null,width:6,widthSource:'estimate',tags:{}});
function createFixture(data: OsmMap) {
  const previous = globalThis.document;
  const context = new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})}, {get(target,key) {return key in target ? target[key as keyof typeof target] : ()=>{};},set(){return true;}});
  globalThis.document = {createElement:()=>({width:0,height:0,getContext:()=>context})} as unknown as Document;
  try {const scene=new THREE.Scene();return {scene,world:createOsmWorld(scene,data)};}
  finally {if(previous === undefined) delete (globalThis as {document?:Document}).document;else globalThis.document=previous;}
}
test('source road graph obeys one-way direction and does not connect geometric overpasses',()=>{
  const a=road('east',['a','b'],[{x:0,z:0},{x:10,z:0}],'yes');
  const b=road('cross',['c','d'],[{x:5,z:-5},{x:5,z:5}]); b.layer=1;b.bridge=true;
  const graph=createRoadGraph([a,b]);
  assert.equal(shortestPaths(graph,'a').distance.get('b'),10);
  assert.equal(shortestPaths(graph,'b').distance.has('a'),false);
  assert.equal(shortestPaths(graph,'a').distance.has('c'),false);
  a.oneway='-1';const reverse=createRoadGraph([a]);
  assert.equal(shortestPaths(reverse,'b').distance.get('a'),10);
  assert.equal(shortestPaths(reverse,'a').distance.has('b'),false);
});
test('actual mission is connected, returnable and uses the original metre coordinates',()=>{
  const mission=selectMissionStops(source);
  const graph=createRoadGraph(source.roads);
  assert.ok(mission.route.length>2);
  let distance=0;
  const ids=mission.route.map(point=>[...graph.points].find(([,p])=>p.x===point.x&&p.z===point.z)![0]);
  for(let i=1;i<ids.length;i++){
    const edge=graph.edges.get(ids[i-1])?.find(edge=>edge.to===ids[i]);assert.ok(edge,'mission cannot jump disconnected roads');distance+=edge.distance;
  }
  assert.ok(distance>=160&&distance<=450);
  assert.ok(shortestPaths(graph,ids.at(-1)!).distance.has(ids[0]),'a return route must exist');
  assert.ok(Math.hypot(mission.spawn.x-mission.pickup.x,mission.spawn.z-mission.pickup.z)<8);
  assert.ok(nearestRoad(source.roads,mission.spawn)!.distance<2);
  assert.equal(mission.pickupName,'Kottakkal bus stand road stop');
});
test('exact polygon collision avoids the false walls made by footprint bounding boxes',()=>{
  const triangle=[{x:0,z:0},{x:10,z:0},{x:0,z:10}];
  assert.equal(pointInPolygon({x:2,z:2},triangle),true);
  assert.equal(pointInPolygon({x:9,z:9},triangle),false);
  assert.equal(segmentDistance({x:2,z:3},{x:0,z:0},{x:4,z:0}).distance,3);
});
test('OSM world extrudes footprints north/south correctly, supports metre roads and culls detail',()=>{
  const fixture:OsmMap={...source,roads:[road('r',['a','b','c'],[{x:0,z:0},{x:200,z:0},{x:400,z:0}])],buildings:[{id:'b',name:'',kind:'yes',height:9,heightSource:'tag',tags:{},points:[{x:50,z:30},{x:70,z:30},{x:70,z:45},{x:50,z:45}]}],landmarks:[],water:[],intersections:[]};
  const {scene,world}=createFixture(fixture);scene.updateMatrixWorld(true);
  let wallBounds:THREE.Box3|undefined;
  scene.traverse(object=>{if(object instanceof THREE.Mesh&&object.castShadow)wallBounds=new THREE.Box3().setFromObject(object);});
  assert.ok(wallBounds);
  assert.equal(wallBounds.min.x,50);assert.equal(wallBounds.max.x,70);
  assert.equal(wallBounds.min.z,30);assert.equal(wallBounds.max.z,45);
  assert.ok(Math.abs(wallBounds.min.y)<1e-6);assert.ok(Math.abs(wallBounds.max.y-9)<1e-6);
  assert.equal(world.isBlocked(60,35),true);assert.equal(world.isBlocked(60,0),false);
  assert.equal(world.roadSurface(100,2),true);assert.equal(world.roadSurface(100,20),false);
  assert.equal(world.isBlocked(source.bounds.maxX+1,0),true);
  world.update(0,new THREE.Vector3(60,6,0),false);
  let normal=0;scene.traverseVisible(object=>{if(object instanceof THREE.Mesh)normal++;});
  world.update(0,new THREE.Vector3(60,6,0),true);
  let low=0;scene.traverseVisible(object=>{if(object instanceof THREE.Mesh)low++;});
  assert.ok(low<normal,'battery mode hides actual façade and centre-line detail');
  world.update(0,new THREE.Vector3(10000,6,10000),true);
  let distant=0;scene.traverseVisible(object=>{if(object instanceof THREE.Mesh)distant++;});
  assert.equal(distant,1,'only the base ground remains when all chunks are distant');
  world.dispose();assert.equal(scene.children.length,0);
});
test('every imported road segment and both passenger stops are traversable in the actual world',()=>{
  const {world}=createFixture(source);
  for(const road of source.roads) for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i];
    const point={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
    assert.equal(world.roadSurface(point.x,point.z),true,road.id);
    // Boundary-clipped end segments are checked away from the map exit barrier.
    if(Math.abs(point.x)<648&&Math.abs(point.z)<648)assert.equal(world.isBlocked(point.x,point.z),false,road.id);
  }
  for(const point of [world.spawn,world.pickup,world.dropoff])assert.equal(world.isBlocked(point.x,point.z),false);
  world.dispose();
});

test('real foundation shares a flat datum and omits only road-conflicting visual building models', () => {
  const original = JSON.stringify(source), { scene, world } = createFixture(source);
  const f = buildRoadFoundation(source), omitted = new Set(world.foundationStats.omittedBuildingIds);
  assert.ok(omitted.size > 0 && omitted.size < source.buildings.length / 2, 'bounded conflict handling must retain the majority of source models');
  for (const building of source.buildings) {
    assert.equal(omitted.has(building.id), f.patches.some(p => buildingConflictsWithRoad(building, p)), `model conflict decision ${building.id}`);
  }
  let asphaltMeshes = 0;
  const renderedRoads: THREE.Mesh[] = [];
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.name !== 'OSM asphalt foundation') return;
    asphaltMeshes++;
    renderedRoads.push(object);
    const position = object.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) assert.ok(Math.abs(position.getY(i) - ROAD_SURFACE_Y) < 1e-6, 'all road layers share the declared flat datum');
  });
  assert.ok(asphaltMeshes > 0);
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(); ray.ray.direction.set(0, -1, 0);
  for (const road of source.roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i];
    ray.ray.origin.set((a.x + b.x) / 2, 20, (a.z + b.z) / 2);
    const hit = ray.intersectObjects(renderedRoads, false)[0];
    assert.ok(hit && Math.abs(hit.point.y - ROAD_SURFACE_Y) < 1e-6, `actual asphalt triangles must cover source segment ${road.id}:${i}`);
  }
  assert.equal(JSON.stringify(source), original);
  let boundaryLabels = 0;
  scene.traverse(o => { if (o.name === 'Playable boundary; not a source road end') boundaryLabels++; });
  assert.equal(boundaryLabels, world.foundationStats.boundaryEnds);
  world.dispose(); assert.equal(scene.children.length, 0);
});
