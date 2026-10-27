import * as THREE from 'three';
import type {NavigationRoute} from './gps';
/** Reusable ground arrows, laid only along routed source segments. */
export function createGpsRenderer(scene:THREE.Scene,heightAt:(x:number,z:number)=>number){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,.09,-1.2,-.55,.09,.55,.55,.09,.55],3));geometry.computeVertexNormals();
 const material=new THREE.MeshBasicMaterial({color:'#25bba1',side:THREE.DoubleSide,transparent:true,opacity:.75,depthWrite:false});
 const arrows=new THREE.InstancedMesh(geometry,material,64);arrows.name='GPS source-road direction arrows';arrows.frustumCulled=false;arrows.count=0;scene.add(arrows);const dummy=new THREE.Object3D();
 const entry=new THREE.Mesh(new THREE.RingGeometry(.65,.9,24),new THREE.MeshBasicMaterial({color:'#80e4ce',side:THREE.DoubleSide}));entry.rotation.x=-Math.PI/2;entry.name='GPS verified road entry';entry.visible=false;scene.add(entry);
 return {update(route:NavigationRoute,player:{x:number;z:number},showEntry=false){
  entry.visible=showEntry&&route.available&&route.offRoad&&route.points.length>0;if(entry.visible){const p=route.points[0];entry.position.set(p.x,heightAt(p.x,p.z)+.12,p.z);}
  arrows.count=0;let travelled=0,next=6;
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.01)continue;
   while(next<travelled+len&&arrows.count<64){const t=(next-travelled)/len,x=a.x+dx*t,z=a.z+dz*t;if(Math.hypot(x-player.x,z-player.z)<130){dummy.position.set(x,heightAt(x,z)+.015,z);dummy.rotation.y=Math.atan2(-dx,-dz);dummy.updateMatrix();arrows.setMatrixAt(arrows.count++,dummy.matrix);}next+=12;}
   travelled+=len;if(arrows.count===64)break;
  }
  arrows.instanceMatrix.needsUpdate=true;
 }};
}

/** SVG paths avoid missing turn-arrow glyphs on browser/system fonts. */
export function navigationIcon(arrow:string):string {
 const paths:Record<string,string>={
  '↰':'M19 20V12Q19 7 14 7H4M9 2L4 7L9 12',
  '↱':'M5 20V12Q5 7 10 7H20M15 2L20 7L15 12',
  '↶':'M6 21V9a6 6 0 0 1 12 0v7M13 11l5 5 5-5',
  '⋯':'M5 12h.1M12 12h.1M19 12h.1',
 };
 return `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="${paths[arrow]??'M12 21V3M5 10l7-7 7 7'}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
