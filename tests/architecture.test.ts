import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {architecturePlan,addArchitecture} from '../src/architecture';import type {ArchitectureMaterials} from '../src/architecture';import type {OsmBuilding} from '../src/osm-types';
const house:OsmBuilding={id:'25',name:'Synthetic test footprint',kind:'house',height:7.5,heightSource:'estimate',points:[{x:0,z:0},{x:12,z:0},{x:12,z:9},{x:0,z:9}],tags:{}};
const materials=Object.fromEntries(['wall','roof','wood','door','glass','concrete','metal','shutter'].map(k=>[k,new THREE.MeshStandardMaterial({side:THREE.DoubleSide})])) as unknown as ArchitectureMaterials;
test('architecture uses verified categories and roof tags; unsupported concave outlines never receive a fictional spanning roof',()=>{
 assert.equal(architecturePlan(house).style,'traditional');assert.equal(architecturePlan({...house,tags:{shop:'bakery'}}).style,'commercial');assert.equal(architecturePlan({...house,tags:{amenity:'hospital'}}).style,'institutional');
 assert.equal(architecturePlan({...house,tags:{religion:'muslim','roof:shape':'flat'}}).roof,'flat');assert.equal(architecturePlan({...house,tags:{'roof:shape':'dome'}}).roof,'dome');assert.equal(architecturePlan({...house,tags:{'roof:shape':'gabled'}}).roof,'gabled');
 const concave={...house,points:[{x:0,z:0},{x:10,z:0},{x:10,z:3},{x:3,z:3},{x:3,z:10},{x:0,z:10}]};assert.equal(architecturePlan(concave).roof,'flat');
});
test('true recessed facade geometry and roof LOD preserve source coordinates, heights and bounded model complexity',()=>{
 for(const tags of [{},{shop:'bakery'},{amenity:'school'},{'roof:shape':'dome'},{'roof:shape':'gabled'}]){
  const building={...house,tags},before=JSON.stringify(building),parts:Array<{g:THREE.BufferGeometry;lod:string|false}>=[];
  addArchitecture(building,materials,(g,_m,_p,lod)=>parts.push({g,lod}),()=>0,(a,b)=>(a.z+b.z)/2);
  assert.equal(JSON.stringify(building),before);assert.ok(parts.some(p=>p.lod==='near'));assert.ok(parts.some(p=>p.lod==='far'));
  let triangles=0,recessed=0;for(const {g,lod} of parts){g.computeBoundingBox();const b=g.boundingBox!;assert.ok(b.min.x>=-.05&&b.max.x<=12.05);assert.ok(b.min.z>=-.05&&b.max.z<=9.05);assert.ok(b.min.y>=-.05&&b.max.y<=7.55);const positions=g.getAttribute('position');triangles+=(g.index?.count??positions.count)/3;for(let i=0;i<positions.count;i++){assert.ok([positions.getX(i),positions.getY(i),positions.getZ(i)].every(Number.isFinite));if(lod==='near'&&positions.getZ(i)>.1&&positions.getZ(i)<.55)recessed++;}g.dispose();}assert.ok(recessed>0);assert.ok(triangles<6500,`${triangles} triangles exceeds house budget`);
 }
});

test('facade normals face outside the footprint in either winding, avoiding self-shadow acne',()=>{
 for(const points of [house.points,[...house.points].reverse()]){
  let checked=0;addArchitecture({...house,points},materials,(g,m,_p,lod)=>{if(m===materials.wall&&lod==='near'){const p=g.getAttribute('position'),n=g.getAttribute('normal');for(let i=0;i<p.count;i++){if(Math.abs(n.getY(i))>.01)continue;if(Math.abs(p.getZ(i))<.001&&Math.abs(n.getZ(i))>.99){assert.ok(n.getZ(i)<0);checked++;}if(Math.abs(p.getX(i))<.001&&Math.abs(n.getX(i))>.99){assert.ok(n.getX(i)<0);checked++;}}}g.dispose();},()=>0,()=>0);assert.ok(checked>0);
 }
});

test('regional variants are deterministic, honor category evidence and do not infer apartments from height alone',()=>{
 const original=JSON.stringify(house),plans=Array.from({length:24},(_,i)=>architecturePlan({...house,id:String(i)}));
 assert.ok(new Set(plans.map(p=>p.variant)).size>=8);assert.ok(plans.some(p=>p.style==='modern'));assert.ok(plans.some(p=>p.style==='traditional'));
 assert.deepEqual(architecturePlan(house),architecturePlan(structuredClone(house)));assert.equal(JSON.stringify(house),original);
 assert.equal(architecturePlan({...house,kind:'yes',height:20}).style,'modern');
 assert.equal(architecturePlan({...house,kind:'yes',tags:{office:'accountant'}}).typology,'office');
 assert.equal(architecturePlan({...house,kind:'apartments',height:14}).typology,'apartment');
 assert.equal(architecturePlan({...house,tags:{shop:'yes','building:levels':'2'}}).typology,'mixed-use');
 assert.equal(architecturePlan({...house,tags:{'roof:shape':'flat'}}).style,'modern');
 assert.equal(architecturePlan(house).appearanceSource,'regional-default');
 assert.equal(architecturePlan({...house,kind:'yes'}).categorySource,'inferred');
});


test('roof-pitch variants do not turn an untagged two-storey house into a double-height blank facade',()=>{
 for(let i=0;i<50;i++){const plan=architecturePlan({...house,id:String(i),height:7});assert.equal(plan.floors,2);assert.ok(plan.wallHeight/plan.floors<=3.5);}
 assert.equal(architecturePlan({...house,tags:{'building:levels':'1'}}).floors,1,'retain supported explicit storey evidence');
});
