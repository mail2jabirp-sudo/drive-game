import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {VEHICLES} from './fleet';import type {VehicleKind} from './fleet';
import {createRickshaw} from './vehicle';
/** Original MIT procedural vehicles. Approximate local silhouettes, not licensed replicas. */
export function createPlayableVehicle(kind:VehicleKind){
 if(kind==='auto')return {...createRickshaw(),setDoor:(_open:boolean)=>{}};
 const s=VEHICLES[kind],group=new THREE.Group();group.name=s.name;
 const body=new THREE.MeshStandardMaterial({color:kind==='taxi'?'#f2eee0':kind==='van'?'#b8c8cf':'#d6c4a2',roughness:.48,metalness:.12});
 const dark=new THREE.MeshStandardMaterial({color:'#172724',roughness:.8}),glass=new THREE.MeshStandardMaterial({color:'#355e65',roughness:.23,metalness:.3,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide});
 const chrome=new THREE.MeshStandardMaterial({color:'#a3adad',metalness:.7,roughness:.3}),rubber=new THREE.MeshStandardMaterial({color:'#19201e',roughness:1});
 const lamp=new THREE.MeshStandardMaterial({color:'#fff0cd',emissive:'#ffe4a5',emissiveIntensity:.7});
 const brake=new THREE.MeshStandardMaterial({color:'#ad2f23',emissive:'#ea3220',emissiveIntensity:.35});brake.name='Vehicle brake lights';
 const box=(parent:THREE.Object3D,w:number,h:number,l:number,x:number,y:number,z:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const van=kind==='van',h=s.height-.03,w=s.width-.12,l=s.length-.12;
 box(group,w,.44,l,0,.65,0,body);box(group,w-.08,.17,l-.15,0,.45,0,dark);
 box(group,w-.12,.12,l*.24,0,.91,-l*.36,body);
 const roofZ=van?.18:.16,roofLength=van?l*.78:kind==='taxi'?l*.48:l*.57;
 box(group,w*.86,.12,roofLength,0,h-.05,roofZ,body);
 box(group,w*.84,van?.8:.48,.055,0,h-(van?.52:.34),roofZ-roofLength/2,glass).rotation.x=van?.08:.22;
 box(group,w*.84,van?.8:.43,.055,0,h-(van?.52:.31),roofZ+roofLength/2,glass).rotation.x=-.13;
 for(const side of [-1,1]){
  for(const z of [roofZ-roofLength/2,roofZ,roofZ+roofLength/2])box(group,.07,h-.85,.07,side*w*.43,(h+.85)/2,z,body);
  box(group,.045,h-.95,roofLength/2-.13,side*w*.44,(h+.9)/2,roofZ+roofLength/4,glass);
  box(group,.08,.15,l*.5,side*w*.5,.98,.2,body);
  box(group,.12,.16,.26,side*(w/2+.08),1.05,-l*.24,dark);
  box(group,.26,.16,.07,side*w*.32,.75,-l/2-.02,lamp);box(group,.23,.2,.06,side*w*.36,.73,l/2+.02,brake);
  box(group,.08,.32,l*.22,side*w*.48,.56,-s.wheelbase/2,body);box(group,.08,.32,l*.22,side*w*.48,.56,s.wheelbase/2,body);
 }
 box(group,w,.12,.12,0,.48,-l/2-.04,chrome);box(group,w,.12,.12,0,.48,l/2+.04,chrome);
 box(group,w*.4,.15,.04,0,.72,-l/2-.05,dark);
 const driver=new THREE.Group();driver.name='Seated player driver';group.add(driver);
 const skin=new THREE.MeshStandardMaterial({color:'#a16d4d'}),shirt=new THREE.MeshStandardMaterial({color:'#c5b38c'});
 box(driver,.33,.44,.25,w*.23,1.03,-.2,shirt);const head=new THREE.Mesh(new THREE.SphereGeometry(.14,10,7),skin);head.position.set(w*.23,1.4,-.2);driver.add(head);
 for(const x of [-w*.24,w*.24]){box(group,.5,.12,.5,x,.73,.1,dark);box(group,.5,.45,.13,x,.95,.35,dark);}
 const steering=new THREE.Mesh(new THREE.TorusGeometry(.16,.025,5,12),dark);steering.position.set(w*.23,1.12,-.58);steering.rotation.x=.8;group.add(steering);
 const door=new THREE.Group();door.name='Animated driver door';door.position.set(w*.46,.84,-roofLength/2+roofZ);group.add(door);
 box(door,.07,.36,roofLength/2-.1,0,0,roofLength/4,body);box(door,.035,h-.96,roofLength/2-.15,0,(h-.85)/2,roofLength/4,glass);box(door,.06,.04,.13,.04,.13,roofLength/2-.18,chrome);
 if(kind==='taxi'){box(group,.65,.19,.26,0,h+.1,roofZ,new THREE.MeshStandardMaterial({color:'#edbe44',emissive:'#b88d20',emissiveIntensity:.3}));}
 const wheels:THREE.Group[]=[],forks:THREE.Group[]=[];
 for(const side of [-1,1])for(const front of [-1,1]){const pivot=new THREE.Group();pivot.name=front<0?'Front steering wheel':'Rear wheel';pivot.position.set(side*w*.46,.32,front*s.wheelbase/2);group.add(pivot);if(front<0)forks.push(pivot);
 const rolling=new THREE.Group();rolling.name='Rolling wheel';pivot.add(rolling);wheels.push(rolling);
 for(const [radius,width,mat] of [[.32,.2,rubber],[.17,.215,chrome]] as const){const tyre=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,width,14),mat);tyre.rotation.z=Math.PI/2;tyre.castShadow=true;rolling.add(tyre);}box(rolling,.23,.045,.06,0,.1,0,dark);}
 // Material batching leaves doors, steering and wheels independently animated.
 const batches=new Map<THREE.Material,THREE.Mesh[]>();for(const mesh of group.children)if(mesh instanceof THREE.Mesh&&!Array.isArray(mesh.material)){const a=batches.get(mesh.material)??[];a.push(mesh);batches.set(mesh.material,a);}
 for(const [material,meshes] of batches){if(meshes.length<2)continue;const parts=meshes.map(m=>{m.updateMatrix();const g=m.geometry.toNonIndexed();g.applyMatrix4(m.matrix);return g;});const merged=mergeGeometries(parts);if(merged){const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);for(const m of meshes){group.remove(m);m.geometry.dispose();}}for(const g of parts)g.dispose();}
 let rotation=0,last=0,opened=false;
 return {group,setOccupied(occupied:boolean){driver.visible=occupied;},setDoor(open:boolean){opened=open;},animate(speed:number,steering:number,elapsed:number,braking=false){const dt=Math.max(0,Math.min(.1,elapsed-last));last=elapsed;rotation-=speed*dt/.32;wheels.forEach(w=>w.rotation.x=rotation);forks.forEach(w=>w.rotation.y=steering);brake.emissiveIntensity=braking?2.5:.35;door.rotation.y+=((opened?-1.05:0)-door.rotation.y)*(1-Math.exp(-dt*12));}};
}
