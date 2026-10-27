import * as THREE from 'three';
/** Original MIT procedural prototype from written specifications; reference photos are unavailable. */
export function createCompactCar(){
 const group=new THREE.Group();group.name='Beige Maruti 800-inspired prototype';
 const chassis=new THREE.Group();chassis.name='Sprung car body';group.add(chassis);
 const body=new THREE.MeshStandardMaterial({color:'#d9cfad',roughness:0.55});
 const black=new THREE.MeshStandardMaterial({color:'#202523',roughness:0.8});
 const rubber=new THREE.MeshStandardMaterial({color:'#151817',roughness:1});
 const steel=new THREE.MeshStandardMaterial({color:'#a8aaa4',metalness:0.65,roughness:0.35});
 const glass=new THREE.MeshStandardMaterial({color:'#70989c',transparent:true,opacity:0.36,side:THREE.DoubleSide,depthWrite:false,roughness:0.15});
 const lamp=new THREE.MeshStandardMaterial({color:'#f2edcc',emissive:'#ffe6af',emissiveIntensity:0.1});
 const tail=new THREE.MeshStandardMaterial({color:'#b32e24',emissive:'#ff1810',emissiveIntensity:0.1});
 const amber=new THREE.MeshStandardMaterial({color:'#ff941c',emissive:'#ff941c',emissiveIntensity:0});
 function box(size:number[],p:number[],m:THREE.Material,parent:THREE.Object3D=chassis){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),m);mesh.position.set(...p as [number,number,number]);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function panel(points:number[][],material:THREE.Material){const a=new THREE.Float32BufferAttribute(points.flat(),3),g=new THREE.BufferGeometry();g.setAttribute('position',a);g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);chassis.add(mesh);return mesh;}
 function bar(a:number[],b:number[],width:number,m:THREE.Material){const va=new THREE.Vector3(...a as [number,number,number]),vb=new THREE.Vector3(...b as [number,number,number]);const mesh=box([width,va.distanceTo(vb),width],va.clone().add(vb).multiplyScalar(0.5).toArray(),m);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());}
 // Low, narrow five-door hatchback, short bonnet and sloping rear hatch.
 box([1.42,0.34,3.22],[0,0.55,0],body);box([1.4,0.1,3.1],[0,0.33,0],black);
 const bonnet=box([1.39,0.12,0.8],[0,0.8,-1.19],body);bonnet.rotation.x=-0.05;
 box([1.32,0.07,1.64],[0,1.34,0.18],body);
 panel([[-0.64,0.86,-0.83],[0.64,0.86,-0.83],[0.62,1.3,-0.57],[-0.62,1.3,-0.57]],glass);
 panel([[-0.65,0.88,1.52],[-0.62,1.3,0.98],[0.62,1.3,0.98],[0.65,0.88,1.52]],glass);
 for(const side of [-1,1]){
  const x=side*0.69;
  bar([x,0.82,-0.86],[x,1.34,-0.59],0.055,body);bar([x,0.82,1.55],[x,1.34,1.0],0.065,body);
  bar([x,0.8,0.25],[x,1.32,0.25],0.05,black);
  panel([[x,0.86,-0.75],[x,1.29,-0.54],[x,1.29,0.21],[x,0.86,0.21]],glass);
  panel([[x,0.86,0.29],[x,1.29,0.29],[x,1.29,0.96],[x,0.86,1.45]],glass);
  box([0.025,0.035,0.18],[side*0.725,0.82,0.08],black);box([0.025,0.035,0.18],[side*0.725,0.82,0.82],black);
  box([0.018,0.018,2.5],[side*0.722,0.57,0.1],black);
  bar([side*0.71,0.99,-0.55],[side*0.83,1.0,-0.6],0.03,black);box([0.12,0.1,0.15],[side*0.84,1.0,-0.62],black);
  box([0.3,0.15,0.035],[side*0.46,0.7,-1.64],lamp);box([0.15,0.09,0.04],[side*0.64,0.68,-1.646],amber.clone());
  box([0.2,0.24,0.035],[side*0.57,0.66,1.63],tail);box([0.14,0.06,0.04],[side*0.58,0.82,1.635],amber.clone());
  for(const z of [-1.05,1.125]){const arch=new THREE.Mesh(new THREE.TorusGeometry(0.29,0.035,5,12,Math.PI),body);arch.rotation.y=Math.PI/2;arch.position.set(side*0.72,0.29,z);chassis.add(arch);}
 }
 box([0.65,0.14,0.04],[0,0.67,-1.65],black);
 for(const z of [-1.67,1.67])box([1.47,0.11,0.1],[0,0.42,z],black);
 for(const x of [-0.33,0.33]){box([0.48,0.12,0.46],[x,0.67,-0.12],black);box([0.48,0.44,0.09],[x,0.9,0.1],black);}
 box([1.15,0.14,0.48],[0,0.67,0.89],black);box([1.15,0.4,0.1],[0,0.88,1.15],black);
 box([1.22,0.15,0.24],[0,0.86,-0.64],black);
 const steeringWheel=new THREE.Mesh(new THREE.TorusGeometry(0.13,0.02,5,12),black);steeringWheel.position.set(0.35,0.93,-0.46);steeringWheel.rotation.x=-0.5;chassis.add(steeringWheel);
 const skin=new THREE.MeshStandardMaterial({color:'#a76f4e',roughness:1});
 box([0.25,0.35,0.17],[0.34,0.96,-0.1],new THREE.MeshStandardMaterial({color:'#a5b2a5'}));const head=new THREE.Mesh(new THREE.SphereGeometry(0.115,10,7),skin);head.position.set(0.34,1.2,-0.1);chassis.add(head);
 const wheels:THREE.Group[]=[],front:THREE.Group[]=[];
 for(const z of [-1.05,1.125])for(const side of [-1,1]){
  const pivot=new THREE.Group();pivot.name=z<0?'Front steering pivot':'Rear axle';pivot.position.set(side*0.68,0.25,z);group.add(pivot);if(z<0)front.push(pivot);
  const wheel=new THREE.Group();wheel.name='Rotating wheel';pivot.add(wheel);wheels.push(wheel);
  for(const [radius,width,material] of [[0.25,0.16,rubber],[0.135,0.17,steel]] as const){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,width,14),material);mesh.rotation.z=Math.PI/2;wheel.add(mesh);}
  box([0.18,0.04,0.04],[side*0.09,0.06,0],black,wheel);
 }
 bar([-0.35,0.9,-0.86],[-0.05,1.1,-0.74],0.015,black);
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');
  if(ctx){ctx.fillStyle='#eeeade';ctx.fillRect(0,0,256,64);ctx.fillStyle='#192520';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText('KL 10 E 0800',128,43);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshStandardMaterial({map:texture});
   for(const z of [-1.73,1.73]){const plate=new THREE.Mesh(new THREE.PlaneGeometry(0.38,0.095),material);plate.position.set(0,0.47,z);if(z<0)plate.rotation.y=Math.PI;chassis.add(plate);}
  }
 }
 let last=0,rotation=0,previousSpeed=0;
 return {group,animate(speed:number,steering:number,elapsed:number){const dt=Math.max(0,Math.min(0.1,elapsed-last));last=elapsed;rotation-=speed*dt/0.25;for(const wheel of wheels)wheel.rotation.x=rotation;for(const pivot of front)pivot.rotation.y=steering;steeringWheel.rotation.z=-steering;chassis.position.y=Math.sin(elapsed*17)*Math.min(0.006,Math.abs(speed)*0.0004);chassis.rotation.z=-steering*Math.min(0.07,Math.abs(speed)*0.004);const pitch=Math.max(-0.035,Math.min(0.035,(speed-previousSpeed)/Math.max(dt,0.001)*0.005));chassis.rotation.x+=(pitch-chassis.rotation.x)*(1-Math.exp(-dt*7));previousSpeed=speed;}};
}
