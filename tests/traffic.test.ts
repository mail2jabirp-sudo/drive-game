import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {TrafficSimulation,lanePosition,rectanglesOverlap} from '../src/traffic-sim.ts';
import {TRAFFIC,eligible,signalPhase} from '../src/traffic-types.ts';
import type {TrafficAgent,TrafficKind} from '../src/traffic-types.ts';
import type {OsmRoad} from '../src/osm-types.ts';
import {trafficBody,wheelOffsets} from '../src/traffic-models.ts';
const road=(oneway:OsmRoad['oneway']='no'):OsmRoad=>({id:'main',sourceWayId:'1',nodeIds:['a','b','c','d','e','f','g','h','i'],points:Array.from({length:9},(_,i)=>({x:(i-4)*100,z:0})),name:'Synthetic test road',highway:'primary',oneway,maxspeed:40,layer:0,bridge:false,width:8,widthSource:'tag',tags:{}});
const surface={roadSurface:(_x:number,z:number)=>Math.abs(z)<=4.5,isBlocked:()=>false};
function agent(sim:TrafficSimulation,kind:TrafficKind,from:string,to:string,s:number,speed=0):TrafficAgent{const e=[...sim.edges.values()].find(e=>e.from===from&&e.to===to)!,p=lanePosition(e,s,sim.junctions);return {id:99,kind,edge:e.id,s,...p,speed,heading:Math.atan2(-e.dx,-e.dz),steering:0,braking:false,indicator:0,distance:0,stuck:0,reason:'test',turns:0,paint:0};}

test('traffic lanes use the left side and the graph retains source direction and overpass separation',()=>{
 const sim=new TrafficSimulation(surface);sim.setRoads([road()]);
 const east=[...sim.edges.values()].find(e=>e.dx>0)!,west=[...sim.edges.values()].find(e=>e.dx<0)!;
 assert.ok(lanePosition(east,50,sim.junctions).z<0);assert.ok(lanePosition(west,50,sim.junctions).z>0);
 sim.setRoads([road('yes')]);assert.ok([...sim.edges.values()].every(e=>e.dx>0));sim.setRoads([road('-1')]);assert.ok([...sim.edges.values()].every(e=>e.dx<0));
 const over={...road(),sourceWayId:'over',nodeIds:['x','y'],points:[{x:0,z:-100},{x:0,z:100}],layer:1,bridge:true};sim.setRoads([road(),over]);assert.ok(!sim.junctions.has('x'));assert.ok(!sim.outgoing.get('x')?.some(e=>e.to==='e'));
 assert.equal(eligible('bus',{...road(),width:5}),false);assert.equal(eligible('lorry',{...road(),highway:'service'}),false);
});
test('fixed-step spawning is deterministic, diverse, capped, separated and remains on drivable geometry',()=>{
 const make=()=>{const s=new TrafficSimulation(surface,[],73);s.hour=12;s.setRoads([road()]);return s;},a=make(),b=make(),player={x:0,z:30,heading:0,speed:0},seen=new Set<string>();
 for(let i=0;i<600;i++){
  a.update(.05,player);b.update(.05,player);assert.ok(a.agents.length<=12);
  for(const v of a.agents){seen.add(v.kind);assert.ok(surface.roadSurface(v.x,v.z));assert.ok(Number.isFinite(v.heading));}
  for(let x=0;x<a.agents.length;x++)for(let y=x+1;y<a.agents.length;y++)assert.equal(rectanglesOverlap({...a.agents[x],...TRAFFIC[a.agents[x].kind]},{...a.agents[y],...TRAFFIC[a.agents[y].kind]}),false);
 }
 assert.deepEqual(a.agents,b.agents);assert.ok(seen.size>=6,`only saw ${[...seen]}`);assert.ok(a.agents.some(v=>v.distance>10));
 a.lowDetail=true;a.update(.05,player);assert.ok(a.agents.length<=6);a.clear();assert.equal(a.agents.length,0);
});
test('AI stops before a mapped red signal, then continues on its source road when green',()=>{
 const sim=new TrafficSimulation(surface,[{nodeId:'e',x:0,z:0,kind:'traffic_signals',tags:{}}]);sim.setRoads([road()]);sim.spawning=false;sim.hour=0;
 const car=agent(sim,'car','d','e',70,8);sim.agents.push(car);const player={x:0,z:100,heading:0,speed:0};
 for(let i=0;i<200;i++){sim.update(.05,player);assert.ok(car.x<=-3.5);}
 assert.ok(car.speed<.1);assert.equal(car.reason,'signal');
 for(let i=0;i<220;i++)sim.update(.05,player);assert.ok(car.x>0);assert.equal(signalPhase(18,-Math.PI/2),'green');assert.equal(signalPhase(18,0),'red');
});
test('following, player collision and stalled-vehicle recovery avoid overlap and permanent blockage',()=>{
 const sim=new TrafficSimulation(surface);sim.setRoads([road()]);sim.spawning=false;
 const back=agent(sim,'van','c','d',40,8),front=agent(sim,'car','c','d',65,0);front.id=100;sim.agents.push(back,front);
 const player={x:-126,z:-2,heading:-Math.PI/2,speed:0};
 for(let i=0;i<80;i++)sim.update(.05,player);
 assert.equal(rectanglesOverlap({...back,...TRAFFIC.van},{...front,...TRAFFIC.car}),false);
 assert.equal(sim.blocksPlayer(front.x,front.z,front.heading),true);
 const stationary=new TrafficSimulation({...surface,isBlocked:()=>true});stationary.spawning=false;stationary.setRoads([road()]);stationary.agents.push(agent(stationary,'auto','c','d',50));
 for(let i=0;i<540;i++)stationary.update(.05,{x:0,z:100,heading:0,speed:0});assert.equal(stationary.agents.length,0);
});
test('all eight original traffic prototypes have bounded render geometry and category-correct wheel counts',()=>{
 for(const kind of Object.keys(TRAFFIC) as TrafficKind[]){const g=trafficBody(kind);assert.ok(g.getAttribute('position').count/3<12000,kind);assert.ok(g.getAttribute('color'));const expected=kind==='bike'||kind==='scooter'?2:kind==='auto'||kind==='pickup'?3:kind==='lorry'?6:4;assert.equal(wheelOffsets(kind).length,expected);g.dispose();}
});
test('mapped signals and crossings reproduce from the unchanged uploaded OSM source',()=>{
 execFileSync('python3',['scripts/import_traffic_controls.py','--check'],{stdio:'pipe'});const data=JSON.parse(readFileSync('public/maps/district/traffic-controls.json','utf8'));assert.equal(data.controls.length,106);assert.ok(data.controls.some((c:any)=>c.kind==='traffic_signals'));assert.ok(data.controls.some((c:any)=>c.kind==='crossing'));
});

test('traffic footprint collision rejects enclosed and edge-crossing buildings without AABB false walls',async()=>{
 const {TrafficObstacles}=await import('../src/traffic-obstacles.ts');const index=new TrafficObstacles();
 index.update([{id:'triangle',name:'',kind:'yes',height:6,heightSource:'estimate',tags:{},points:[{x:0,z:0},{x:10,z:0},{x:0,z:10}]}]);
 assert.equal(index.blocked({x:8,z:8,heading:0},{length:1,width:1}),false);
 assert.equal(index.blocked({x:2,z:2,heading:0},{length:1,width:1}),true);
 index.update([{id:'small',name:'',kind:'yes',height:6,heightSource:'estimate',tags:{},points:[{x:-.2,z:-.2},{x:.2,z:-.2},{x:.2,z:.2},{x:-.2,z:.2}]}]);
 assert.equal(index.blocked({x:0,z:0,heading:0},{length:10,width:2.4}),true);
});

test('the actual loaded Malappuram road window supports moving mixed traffic including buses and lorries',async()=>{
 const THREE=await import('three');const {createOsmWorld}=await import('../src/osm-world.ts');
 const m=JSON.parse(readFileSync('public/maps/district/manifest.json','utf8'));
 const roads=[];for(const x of [-1,0,1])for(const z of [-1,0,1])roads.push(...JSON.parse(readFileSync('public/maps/district/'+m.tiles[`${x},${z}`].file,'utf8')).roads);
 const data={version:1 as const,source:m.source,projection:m.projection,bounds:m.bounds,roads,buildings:[],landmarks:[],water:[],intersections:[],stats:m.stats};
 const previous=globalThis.document;const context=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get(target,key){return key in target?target[key as keyof typeof target]:()=>{};},set(){return true;}});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})} as unknown as Document;
 let world:ReturnType<typeof createOsmWorld>;
 try{world=createOsmWorld(new THREE.Scene(),data);}finally{if(previous===undefined)delete(globalThis as {document?:Document}).document;else globalThis.document=previous;}
 try{
  const sim=new TrafficSimulation(world);sim.hour=12;sim.setRoads(roads);const player={...world.spawn,speed:0},seen=new Set<string>();let travelled=0;
  for(let i=0;i<1000;i++){if(i===500){sim.clear();player.x=0;player.z=0;assert.ok(world.roadSurface(0,0),'verified Malappuram Bypass origin is a source road');}sim.update(.05,player);for(const a of sim.agents){seen.add(a.kind);travelled=Math.max(travelled,a.distance);assert.ok(world.roadSurface(a.x,a.z));}}
  console.log('Actual road traffic kinds:',[...seen].join(', '),'max travel',travelled.toFixed(1));
  assert.ok(seen.has('bus'));assert.ok(seen.has('lorry'));assert.ok(seen.size>=6);assert.ok(travelled>30);sim.density='high';assert.equal(sim.capacity,18);
 }finally{world.dispose();}
});

test('a source way boundary preserves continuous left-lane coordinates without inventing an intersection',()=>{
 const a={...road(),id:'a',sourceWayId:'a',nodeIds:['a','b'],points:[{x:-100,z:0},{x:0,z:0}],width:6},b={...road(),id:'b',sourceWayId:'b',nodeIds:['b','c'],points:[{x:0,z:0},{x:80,z:-40}],width:8};
 const sim=new TrafficSimulation({roadSurface:()=>true,isBlocked:()=>false});sim.setRoads([a,b]);assert.equal(sim.junctions.has('b'),false);
 const incoming=[...sim.edges.values()].find(e=>e.from==='a'&&e.to==='b')!,outgoing=[...sim.edges.values()].find(e=>e.from==='b'&&e.to==='c')!;
 const end=lanePosition(incoming,incoming.length,sim.junctions),start=lanePosition(outgoing,0,sim.junctions);assert.ok(Math.hypot(end.x-start.x,end.z-start.z)<1e-9);
});
