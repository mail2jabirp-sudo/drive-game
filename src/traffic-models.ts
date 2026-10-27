import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createCompactCar} from './car-model';
import {TRAFFIC} from './traffic-types';
import type {TrafficKind} from './traffic-types';
/** Original low-poly MIT traffic artwork. No photo textures, external models or recordings. */
export function trafficBody(kind:TrafficKind):THREE.BufferGeometry{
 const root=new THREE.Group(),spec=TRAFFIC[kind];
 const material=(color:string)=>new THREE.MeshStandardMaterial({color});
 const paint=material(spec.paint[0]),black=material('#202927'),glass=material('#799b9c'),cream=material('#e5d7b7'),metal=material('#a6a9a0'),skin=material('#a16e4b');
 function box(w:number,h:number,l:number,x:number,y:number,z:number,m:THREE.Material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),m);mesh.position.set(x,y,z);root.add(mesh);return mesh;}
 function driver(x:number,y:number,z:number){box(.28,.4,.2,x,y,z,cream);const head=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),skin);head.position.set(x,y+.33,z);root.add(head);}
 if(kind==='car'){
  const model=createCompactCar();model.group.updateMatrixWorld(true);
  model.group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;let p:THREE.Object3D|null=o;while(p){if(p.name==='Rotating wheel')return;p=p.parent;}const mesh=new THREE.Mesh(o.geometry.clone(),o.material);mesh.applyMatrix4(o.matrixWorld);root.add(mesh);});
 }else if(kind==='bike'||kind==='scooter'){
  box(.3,.18,1.3,0,.55,0,black);box(.42,.15,.65,0,.87,.16,black);
  if(kind==='bike'){const tank=box(.4,.28,.5,0,.78,-.25,paint);tank.rotation.x=-.12;box(.32,.25,.35,0,.45,0,metal);}else{box(.56,.55,.32,0,.65,-.48,paint);box(.55,.35,.65,0,.6,.35,paint);}
  box(.64,.045,.06,0,1.05,-.55,metal);box(.08,.55,.09,0,.57,-.64,metal);driver(0,1.12,0);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),black);head.position.set(0,1.57,-.04);root.add(head);
 }else if(kind==='auto'||kind==='pickup'){
  box(1.5,.2,2.5,0,.48,.1,black);box(1.25,.48,.6,0,.83,-1.05,paint);box(1.2,.68,.035,0,1.47,-1.16,glass);
  box(.07,.92,.08,-.62,1.48,-1.05,black);box(.07,.92,.08,.62,1.48,-1.05,black);box(1.45,.1,1.1,0,1.95,-.65,paint);driver(0,1.25,-.55);
  if(kind==='auto'){box(1.6,.55,1.4,0,.85,.65,black);box(1.55,.1,2.6,0,2.08,.03,paint);box(1.5,.85,.1,0,1.53,1.3,black);box(1.0,.38,.03,0,1.65,1.36,glass);box(1.3,.2,.45,0,1.02,.83,cream);for(const x of [-.75,.75])box(.06,1,.06,x,1.53,.83,black);}
  else{box(1.52,.15,1.58,0,.65,.7,paint);for(const x of [-.75,.75])box(.07,.55,1.65,x,.98,.68,paint);box(1.5,.55,.07,0,.98,1.48,paint);for(const x of [-.68,.68])for(const z of [.1,1.35])box(.055,.8,.055,x,1.2,z,metal);}
 }else if(kind==='van'){
  box(1.75,.65,4.3,0,.72,0,paint);box(1.72,.7,3.8,0,1.42,.1,paint);box(1.5,.57,.04,0,1.45,-1.85,glass);box(1.72,.1,3.9,0,1.87,.06,paint);
  for(const side of [-1,1])for(const z of [-1.1,-.25,.7,1.45]){box(.03,.48,.65,side*.88,1.43,z,glass);box(.04,.04,.2,side*.9,1.03,z,black);}driver(.42,1.2,-1.22);
 }else if(kind==='bus'){
  box(2.38,1.08,10.3,0,1.05,0,paint);box(2.36,1.08,10.25,0,2.08,0,cream);box(2.4,.14,10.35,0,2.73,0,cream);
  for(const side of [-1,1])for(let z=-4.25;z<=4.3;z+=.93){box(.035,.77,.76,side*1.19,2.08,z,glass);box(.05,.05,.84,side*1.22,1.56,z,paint);}
  box(2.08,.82,.04,0,2.03,-5.18,glass);box(2.05,.6,.04,0,2.05,5.18,glass);box(2.05,.08,.05,0,1.5,-5.2,black);box(2.4,.17,.12,0,.56,-5.23,black);
  for(const side of [-1,1]){box(.1,.45,.12,side*1.35,2.25,-4.8,black);for(let z=-3.5;z<4;z+=.8)box(.85,.6,.25,side*.64,1.55,z,black);}driver(.7,1.68,-4.5);
 }else{
  box(2.3,.3,7.4,0,.64,0,black);box(2.3,1.55,2.1,0,1.55,-2.75,paint);box(2.05,.7,.04,0,1.92,-3.82,glass);box(2.35,.13,2.15,0,2.38,-2.75,cream);
  box(2.32,1.4,5.15,0,1.55,1.05,cream);box(2.4,.2,.15,0,.68,-3.95,black);for(const side of [-1,1]){box(.1,.45,.1,side*1.32,2.05,-3.1,black);for(let z=-1;z<3.6;z+=.65)box(.07,1.45,.09,side*1.18,1.6,z,paint);}driver(.62,1.65,-2.85);
 }
 root.updateMatrixWorld(true);const geometry:THREE.BufferGeometry[]=[];const materials=new Set<THREE.Material>();
 root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.deleteAttribute('uv');
  const color=(o.material as THREE.MeshStandardMaterial).color??new THREE.Color('white'),colors=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.push(g);materials.add(o.material as THREE.Material);o.geometry.dispose();});
 const merged=mergeGeometries(geometry)!;geometry.forEach(g=>g.dispose());for(const m of materials){for(const v of Object.values(m))if(v instanceof THREE.Texture)v.dispose();m.dispose();}return merged;
}
export function wheelOffsets(kind:TrafficKind):Array<{x:number;z:number;front:boolean}>{const s=TRAFFIC[kind];
 if(kind==='bike'||kind==='scooter')return [{x:0,z:-s.wheelbase/2,front:true},{x:0,z:s.wheelbase/2,front:false}];
 if(kind==='auto'||kind==='pickup')return [{x:0,z:-s.wheelbase/2,front:true},...[-1,1].map(side=>({x:side*s.width*.42,z:s.wheelbase/2,front:false}))];
 const result=[-1,1].flatMap(side=>[{x:side*s.width*.42,z:-s.wheelbase/2,front:true},{x:side*s.width*.42,z:s.wheelbase/2,front:false}]);
 if(kind==='lorry')for(const side of [-1,1])result.push({x:side*s.width*.42,z:s.wheelbase/2+.65,front:false});return result;
}
export function trafficWheel(){const geometries:THREE.BufferGeometry[]=[];for(const [r,w,c] of [[1,.6,'#17201f'],[.52,.64,'#a7afa8']] as const){const g=new THREE.CylinderGeometry(r,r,w,12).toNonIndexed();g.rotateZ(Math.PI/2);const col=new THREE.Color(c),a=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<a.length;i+=3){a[i]=col.r;a[i+1]=col.g;a[i+2]=col.b;}g.deleteAttribute('uv');g.setAttribute('color',new THREE.BufferAttribute(a,3));geometries.push(g);}const result=mergeGeometries(geometries)!;geometries.forEach(g=>g.dispose());return result;}
