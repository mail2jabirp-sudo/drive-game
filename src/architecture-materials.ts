import * as THREE from 'three';
import type {ArchitectureMaterials} from './architecture';
/** Original 256px PBR channels, synthesized locally; no downloaded texture/image. */
export function createArchitectureMaterials(wall:THREE.MeshStandardMaterial,clay:THREE.MeshStandardMaterial):ArchitectureMaterials {
 const make=(kind:'plaster'|'tile'|'wood'|'stone'|'metal')=>{
  const size=256,heights=new Float32Array(size*size);let seed=12341+kind.length*733;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=y*size+x,grain=rand();let h=.5+grain*.08;
   if(kind==='tile'){const row=y%32,column=(x+(Math.floor(y/32)%2)*16)%32;h=.35+.25*Math.sin(column/32*Math.PI);if(row<2||column<2)h=.1;}
   if(kind==='wood')h=.45+.12*Math.sin(x*.45+Math.sin(y*.04)*2)+grain*.1;
   if(kind==='stone'){h=.5+grain*.14;if(y%64<2||(x+(Math.floor(y/64)%2)*64)%128<2)h=.15;}
   if(kind==='metal')h=.5+.09*Math.sin(y*Math.PI/4);
   heights[i]=h;const shade=kind==='wood'?195+Math.round(h*45):210+Math.round(h*40);pixels.data.set([shade,shade,shade,255],i*4);
  }
  ctx.putImageData(pixels,0,0);const color=new THREE.CanvasTexture(canvas);color.colorSpace=THREE.SRGBColorSpace;
  const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=size;const nc=normalCanvas.getContext('2d')!,np=nc.createImageData(size,size);
  const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=size;const rc=roughCanvas.getContext('2d')!,rp=rc.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size],dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x],n=new THREE.Vector3(-dx*2,-dy*2,1).normalize();np.data.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],i*4);const rough=kind==='metal'?145:kind==='wood'?190:225;rp.data.set([rough,rough,rough,255],i*4);}
  nc.putImageData(np,0,0);rc.putImageData(rp,0,0);const normal=new THREE.CanvasTexture(normalCanvas),roughness=new THREE.CanvasTexture(roughCanvas);
  for(const t of [color,normal,roughness]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;}return {map:color,normalMap:normal,roughnessMap:roughness};
 };
 const plaster=make('plaster'),tile=make('tile'),wood=make('wood'),stone=make('stone'),metal=make('metal');
 wall.map?.dispose();wall.map=plaster.map;wall.normalMap=plaster.normalMap;wall.roughnessMap=plaster.roughnessMap;wall.normalScale.set(.2,.2);wall.side=THREE.DoubleSide;wall.shadowSide=THREE.BackSide;wall.name='Architectural plaster PBR';
 clay.map?.dispose();Object.assign(clay,tile);clay.normalScale.set(.65,.65);clay.name='Architectural terracotta PBR';clay.side=THREE.DoubleSide;
 const material=(name:string,color:string,channels:ReturnType<typeof make>|null,roughness=.8,metalness=0)=>{const m=new THREE.MeshStandardMaterial({name,color,roughness,metalness,side:THREE.DoubleSide,...channels});m.normalScale.set(.35,.35);return m;};
 return {wall,roof:clay,wood:material('Architectural teak PBR','#755139',wood),door:material('Architectural timber doors','#523b2b',wood),concrete:material('Architectural stone and concrete','#c4c3b4',stone),metal:material('Architectural metal frames','#43504a',null,.4,.45),shutter:material('Architectural corrugated shutters','#77827b',metal,.65,.35),glass:material('Architectural recessed glazing','#354b50',null,.18,.25)};
}
