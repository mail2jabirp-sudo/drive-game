import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {trafficBody,trafficWheel,wheelOffsets} from './traffic-models';
import {TRAFFIC,signalPhase} from './traffic-types';
import type {TrafficKind,TrafficAgent} from './traffic-types';
import type {TrafficSimulation,PlayerPose} from './traffic-sim';
const CAP=18;
function proxyBody(kind:TrafficKind){const s=TRAFFIC[kind],pieces:THREE.BufferGeometry[]=[];
 for(const [width,height,length,y,z,color] of [[s.width,s.height*.38,s.length,s.wheelRadius+s.height*.19,0,s.paint[0]],[s.width*.85,s.height*.27,s.length*.48,s.wheelRadius+s.height*.51,-s.length*.12,'#8ba2a0']] as const){const g=new THREE.BoxGeometry(width,height,length).toNonIndexed();g.translate(0,y,z);g.deleteAttribute('uv');const c=new THREE.Color(color),a=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));pieces.push(g);}const merged=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());return merged;
}
/** Fixed instanced pools: no per-agent mesh/material/texture allocation during play. */
export class TrafficRenderer{
 readonly root=new THREE.Group();private detailed=new Map<TrafficKind,THREE.InstancedMesh>();private distant=new Map<TrafficKind,THREE.InstancedMesh>();
 private wheels:THREE.InstancedMesh;private lamps:THREE.InstancedMesh;private poles:THREE.InstancedMesh;private bulbs:THREE.InstancedMesh;private stripes:THREE.InstancedMesh;
 private board:THREE.InstancedMesh;private lights:THREE.SpotLight[]=[];private dummy=new THREE.Object3D();private color=new THREE.Color();
 constructor(scene:THREE.Scene){
  this.root.name='Bounded source-road AI traffic';scene.add(this.root);
  const bodyMaterial=new THREE.MeshStandardMaterial({color:'white',vertexColors:true,roughness:.78});
  for(const kind of Object.keys(TRAFFIC) as TrafficKind[]){const mesh=new THREE.InstancedMesh(trafficBody(kind),bodyMaterial,CAP),lod=new THREE.InstancedMesh(proxyBody(kind),bodyMaterial,CAP);mesh.name=`Traffic ${kind} detailed`;lod.name=`Traffic ${kind} distant`;mesh.count=lod.count=0;mesh.frustumCulled=lod.frustumCulled=false;mesh.castShadow=false;this.detailed.set(kind,mesh);this.distant.set(kind,lod);this.root.add(mesh,lod);}
  this.wheels=new THREE.InstancedMesh(trafficWheel(),bodyMaterial,CAP*6);this.wheels.frustumCulled=false;this.root.add(this.wheels);
  const lampMaterial=new THREE.MeshBasicMaterial({color:'white'});this.lamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),lampMaterial,CAP*8);this.lamps.frustumCulled=false;this.root.add(this.lamps);
  this.poles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.065,3.5,6),new THREE.MeshStandardMaterial({color:'#46534c'}),20);this.poles.frustumCulled=false;this.root.add(this.poles);
  this.bulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(.13,6,4),lampMaterial,120);this.bulbs.frustumCulled=false;this.root.add(this.bulbs);
  this.stripes=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.018,.32),new THREE.MeshStandardMaterial({color:'#d9d2bd'}),120);this.stripes.frustumCulled=false;this.root.add(this.stripes);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#e8ddbd';ctx.fillRect(0,0,512,96);ctx.fillStyle='#9d2d22';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.fillText('FAST PASSENGER',256,62);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  this.board=new THREE.InstancedMesh(new THREE.BoxGeometry(1.9,.3,.035),new THREE.MeshStandardMaterial({map:texture}),CAP);this.board.frustumCulled=false;this.root.add(this.board);
  for(const mesh of [this.wheels,this.lamps,this.poles,this.bulbs,this.stripes,this.board])mesh.count=0;
  for(let i=0;i<2;i++){const light=new THREE.SpotLight('#fff1cd',0,40,.48,.6,1.5);light.castShadow=false;this.root.add(light,light.target);this.lights.push(light);}
 }
 private transform(mesh:THREE.InstancedMesh,index:number,x:number,y:number,z:number,heading=0,sx=1,sy=1,sz=1,roll=0){this.dummy.position.set(x,y,z);this.dummy.rotation.set(roll,heading,0,'YXZ');this.dummy.scale.set(sx,sy,sz);this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);}
 update(sim:TrafficSimulation,player:PlayerPose,heightAt:(x:number,z:number)=>number,low:boolean){
  for(const mesh of [...this.detailed.values(),...this.distant.values()])mesh.count=0;
  let wheel=0,lamp=0,board=0,spot=0;const night=sim.hour<6||sim.hour>=18;
  const agents=[...sim.agents].sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  for(const a of agents){const s=TRAFFIC[a.kind],distance=Math.hypot(a.x-player.x,a.z-player.z),mesh=(distance>(low?90:135)?this.distant:this.detailed).get(a.kind)!,i=mesh.count++;
   const y=heightAt(a.x,a.z)+.04,dx=-Math.sin(a.heading),dz=-Math.cos(a.heading);
   a.y=y;this.transform(mesh,i,a.x,y+Math.sin(sim.clock*20+a.id)*Math.min(.012,a.speed*.001),a.z,a.heading);
   const primary=new THREE.Color(s.paint[0]),paint=new THREE.Color(s.paint[a.paint]);this.color.setRGB(paint.r/Math.max(.01,primary.r),paint.g/Math.max(.01,primary.g),paint.b/Math.max(.01,primary.b));mesh.setColorAt(i,this.color);
   const world=(x:number,z:number)=>({x:a.x+Math.cos(a.heading)*x+Math.sin(a.heading)*z,z:a.z-Math.sin(a.heading)*x+Math.cos(a.heading)*z});
   for(const offset of wheelOffsets(a.kind)){const p=world(offset.x,offset.z);this.transform(this.wheels,wheel++,p.x,heightAt(p.x,p.z)+s.wheelRadius+.04,p.z,a.heading+(offset.front?a.steering:0),a.kind==='bike'||a.kind==='scooter'?.12/.6:.25/.6,s.wheelRadius,s.wheelRadius,-a.distance/s.wheelRadius);}
   for(const end of [-1,1])for(const side of [-1,1]){const p=world(side*s.width*.35,end*(s.length/2+.035));this.transform(this.lamps,lamp,p.x,y+(a.kind==='bus'?1:.7),p.z,a.heading,.15,.13,.05);this.lamps.setColorAt(lamp++,this.color.set(end<0?(night?'#fff0b8':'#b7bba4'):a.braking?'#ff3724':'#792b24'));
    const q=world(side*s.width*.44,end*(s.length/2+.04));this.transform(this.lamps,lamp,q.x,y+.88,q.z,a.heading,.12,.08,.06);const blink=a.indicator!==0&&Math.floor(sim.clock*2)%2===0&&(side===(a.indicator>0?-1:1));this.lamps.setColorAt(lamp++,this.color.set(blink?'#ffaf28':'#705a2e'));
   }
   if(a.kind==='bus'&&distance<120){const p=world(0,-s.length/2-.04);this.transform(this.board,board++,p.x,y+2.65,p.z,a.heading);}
   if(night&&spot<this.lights.length&&distance<65){const light=this.lights[spot++];light.position.set(a.x+dx*s.length/2,y+.85,a.z+dz*s.length/2);light.target.position.set(a.x+dx*22,y,a.z+dz*22);light.intensity=24;}
  }
  for(let i=spot;i<this.lights.length;i++)this.lights[i].intensity=0;
  this.wheels.count=wheel;this.lamps.count=lamp;this.board.count=board;
  let pole=0,bulb=0,stripe=0;
  for(const control of sim.controls.values()){
   const edge=sim.nodeEdges.get(control.nodeId);if(!edge||Math.hypot(control.x-player.x,control.z-player.z)>(low?130:200))continue;
   const y=heightAt(control.x,control.z);
   if(control.kind==='traffic_signals'&&pole<20){const x=control.x+edge.road.width/2+.6,z=control.z;this.transform(this.poles,pole++,x,y+1.75,z);
    for(const heading of [0,Math.PI/2]){const phase=signalPhase(sim.clock+sim.hour*3600,heading);for(const [i,color] of ['red','amber','green'].entries()){this.transform(this.bulbs,bulb,x+(heading?-.2:0),y+3.35-i*.3,z+(heading?0:-.2),heading);this.bulbs.setColorAt(bulb++,this.color.set(phase===color?color==='red'?'#f9432e':color==='amber'?'#ffb62f':'#4bf287':'#334039'));}}
   }else if(control.kind==='crossing'&&stripe<110){const heading=Math.atan2(-edge.dx,-edge.dz);for(let i=-2;i<=2;i++)this.transform(this.stripes,stripe++,control.x+edge.dx*i*.65,y+.065,control.z+edge.dz*i*.65,heading,Math.max(2,edge.road.width-.5),1,1);}
  }
  this.poles.count=pole;this.bulbs.count=bulb;this.stripes.count=stripe;
  for(const mesh of [...this.detailed.values(),...this.distant.values(),this.wheels,this.lamps,this.board,this.poles,this.bulbs,this.stripes]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 }
 dispose(){this.root.removeFromParent();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();this.root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometries.forEach(g=>g.dispose());for(const m of materials){for(const v of Object.values(m))if(v instanceof THREE.Texture)v.dispose();m.dispose();}this.lights.forEach(l=>l.dispose());}
}
