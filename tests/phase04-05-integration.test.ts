import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import type {OsmMap,OsmRoad} from '../src/osm-types';
import {createOsmWorld} from '../src/osm-world';
import {CLASS_WIDTHS,roadProfile} from '../src/road-profile';
import {buildRoadFoundation} from '../src/road-foundation';
import {buildRoadDressing} from '../src/road-dressing';
const legacy=JSON.parse(readFileSync(new URL('../public/maps/kottakkal.json',import.meta.url),'utf8')) as OsmMap;
const road:OsmRoad={...legacy.roads[0],id:'integration',sourceWayId:'integration',oneway:'no',bridge:true,layer:1,width:6.4,nodeIds:['a','b','c'],points:[{x:-9000,z:6000},{x:-8800,z:6000},{x:-8600,z:6000}],tags:{lanes:'2'}};
function canvas<T>(run:()=>T):T{
 const previous=globalThis.document;
 const context=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(t,k)=>k in t?t[k as keyof typeof t]:()=>{},set:()=>true});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})} as unknown as Document;
 try{return run();}finally{if(previous===undefined)delete (globalThis as {document?:Document}).document;else globalThis.document=previous;}
}
test('integrated class estimates exactly retain the newer main width defaults including link roads',()=>{
 const defaults=JSON.parse(readFileSync(new URL('../data/ROAD_WIDTH_DEFAULTS.json',import.meta.url),'utf8'));
 assert.deepEqual(CLASS_WIDTHS,defaults);
 assert.equal(roadProfile({...road,tags:{surface:'earth'}}).surface,'gravel');
});
test('drainage/shoulder clearance respects newer mapped waterway widths',()=>{
 const r={...road,bridge:false,points:[{x:0,z:0},{x:200,z:0},{x:400,z:0}]};
 const data:OsmMap={...legacy,roads:[r],buildings:[],landmarks:[],water:[{id:'stream',kind:'stream',name:'Fixture',width:10,points:[{x:0,z:8},{x:400,z:8}]}]};
 const wide=buildRoadDressing(data,buildRoadFoundation(data));
 const narrowData={...data,water:data.water.map(w=>({...w,width:2}))};
 const narrow=buildRoadDressing(narrowData,buildRoadFoundation(narrowData));
 assert.ok(wide.shoulders.length<narrow.shoulders.length,'a wide mapped stream must not be treated as the old fixed-width drainage exclusion');
});
test('district coordinates, sampled terrain, bridge rails, architectural LOD and resource disposal survive integration',()=>canvas(()=>{
 const data:OsmMap={...legacy,projection:{latitude:11.0544807,longitude:76.0863541,earthRadius:6371008.8},bounds:{minX:-18000,maxX:18000,minZ:-18000,maxZ:18000},roads:[road],landmarks:[],water:[],intersections:[],buildings:[{...legacy.buildings[0],id:'house',kind:'house',tags:{},height:9,points:[{x:-8900,z:6020},{x:-8888,z:6020},{x:-8888,z:6030},{x:-8900,z:6030}]}]};
 const before=JSON.stringify(data),scene=new THREE.Scene();
 const heightAt=(x:number,z:number)=>(x+9000)*.01+(z-6000)*.015;
 const world=createOsmWorld(scene,data,undefined,{heightAt});scene.updateMatrixWorld(true);
 let pavement=0,near=0,far=0,rails=0;
 const materials=new Set<THREE.Material>(),geometries=new Set<THREE.BufferGeometry>(),textures=new Set<THREE.Texture>();
 scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
  if(o.userData.architectureLod==='near')near++;if(o.userData.architectureLod==='far')far++;
  const m=o.material as THREE.MeshStandardMaterial;
  if(m.name==='Mapped bridge rail artwork')rails++;
  if(m.name==='Integrated road asphalt'){
   pavement++;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++){
    const v=o.localToWorld(new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)));
    assert.ok(Math.abs(v.y-heightAt(v.x,v.z)-.036)<.001,'asphalt must retain main terrain/layer offset at large coordinates');
   }
  }
  geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}
 });
 assert.ok(pavement>0&&near>0&&far>0&&rails>0);
 assert.equal(world.roadSurface(-8900,6000),true);assert.equal(world.isBlocked(-8900,6000),false);assert.equal(world.heightAt(-8900,6000),1);
 assert.equal(JSON.stringify(data),before);
 const disposed=new Map<object,number>();for(const resource of [...materials,...geometries,...textures])resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)??0)+1));
 world.dispose();for(const resource of [...materials,...geometries,...textures])assert.equal(disposed.get(resource),1);assert.equal(scene.children.length,0);
}));
