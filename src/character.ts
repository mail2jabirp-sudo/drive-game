import * as THREE from 'three';
/** One original lightweight rig, not a downloaded or motion-captured asset. */
export function createCharacter(){
 const root=new THREE.Group();root.name='Playable on-foot character';
 const shirt=new THREE.MeshStandardMaterial({color:'#adc6b6',roughness:.95}),pants=new THREE.MeshStandardMaterial({color:'#354944',roughness:1}),skin=new THREE.MeshStandardMaterial({color:'#a76c49',roughness:.95}),hair=new THREE.MeshStandardMaterial({color:'#20231f',roughness:1}),shoe=new THREE.MeshStandardMaterial({color:'#39352d',roughness:1});
 const mesh=(parent:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 mesh(root,new THREE.CapsuleGeometry(.23,.38,4,8),shirt,0,1.12,0);
 mesh(root,new THREE.SphereGeometry(.16,10,8),skin,0,1.63,-.015);
 const cap=mesh(root,new THREE.SphereGeometry(.165,8,6),hair,0,1.72,.015);cap.scale.y=.55;
 const legs:THREE.Group[]=[],arms:THREE.Group[]=[];
 for(const side of [-1,1]){
  const leg=new THREE.Group();leg.position.set(side*.13,.85,0);root.add(leg);legs.push(leg);
  mesh(leg,new THREE.CapsuleGeometry(.09,.5,3,6),pants,0,-.33,0);mesh(leg,new THREE.BoxGeometry(.18,.12,.3),shoe,0,-.76,-.06);
  const arm=new THREE.Group();arm.position.set(side*.29,1.36,0);root.add(arm);arms.push(arm);
  mesh(arm,new THREE.CapsuleGeometry(.065,.37,3,6),shirt,0,-.23,0);mesh(arm,new THREE.SphereGeometry(.07,6,5),skin,0,-.49,0);
 }
 let phase=0,amount=0;
 return {group:root,update(dt:number,speed:number){phase+=Math.abs(speed)*dt*5;amount+=(Math.min(1,Math.abs(speed)/1.6)-amount)*(1-Math.exp(-dt*12));for(let i=0;i<2;i++){legs[i].rotation.x=Math.sin(phase+i*Math.PI)*amount*.65;arms[i].rotation.x=-Math.sin(phase+i*Math.PI)*amount*.5;}root.position.y+=Math.abs(Math.sin(phase))*amount*.025;}};
}
