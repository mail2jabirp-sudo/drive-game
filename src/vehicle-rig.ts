import * as THREE from 'three';
import {createRickshaw} from './vehicle';
import {createCompactCar} from './car-model';
import type {VehicleId} from './garage';
export type Indicator='off'|'left'|'right'|'hazard';
/** Both playable prototypes use the same light/animation lifecycle. No external assets or recordings. */
export function createVehicleRig(id:VehicleId){
 const model=id==='maruti800'?createCompactCar():createRickshaw(),group=model.group;
 const lamps:Array<{mesh:THREE.Mesh;material:THREE.MeshStandardMaterial;kind:'head'|'tail'|'indicator'}>=[];
 group.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||!(object.material instanceof THREE.MeshStandardMaterial))return;
  const hex=object.material.color.getHexString();
  const kind=['f2edcc','fff4c6'].includes(hex)?'head':['b32e24','dd5040'].includes(hex)?'tail':['ff941c','ff841a'].includes(hex)?'indicator':null;
  if(kind){object.material=object.material.clone();lamps.push({mesh:object,material:object.material,kind});}
 });
 const light=new THREE.SpotLight('#fff1cf',0,35,0.55,0.5,1.5);light.position.set(0,0.8,id==='maruti800'?-1.7:-1.5);light.target.position.set(0,0,-15);group.add(light,light.target);
 return {group,animate:model.animate,updateLights(headlights:boolean,braking:boolean,indicator:Indicator,elapsed:number){
  light.intensity=headlights?18:0;
  for(const lamp of lamps){const left=lamp.mesh.position.x<0;lamp.material.emissiveIntensity=lamp.kind==='head'?(headlights?2:0.05):lamp.kind==='tail'?(braking?2:headlights?0.45:0.08):((indicator==='hazard'||indicator===(left?'left':'right'))&&Math.floor(elapsed*2)%2===0?2:0.03);}
 },dispose(){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  group.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});
  for(const material of materials){for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);material.dispose();}
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());light.dispose();group.removeFromParent();
 }};
}
