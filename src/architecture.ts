import * as THREE from 'three';
import type {MapPoint,OsmBuilding} from './osm-types';
import {pointInPolygon} from './osm-navigation';
export type ArchitectureStyle='traditional'|'modern'|'apartment'|'commercial'|'institutional'|'worship';
export interface ArchitecturePlan {style:ArchitectureStyle;ring:MapPoint[];center:MapPoint;height:number;wallHeight:number;rise:number;roof:'hipped'|'gabled'|'flat'|'dome';hash:number}
/** Illustrative architecture from verified footprints, not a surveyed facade/entrance. */
export function architecturePlan(building:OsmBuilding):ArchitecturePlan {
 const ring=building.points.filter((p,i,list)=>i!==list.length-1||Math.hypot(p.x-list[0].x,p.z-list[0].z)>.02),center={x:ring.reduce((s,p)=>s+p.x,0)/ring.length,z:ring.reduce((s,p)=>s+p.z,0)/ring.length},height=Math.max(2.5,Math.min(40,building.height));
 let hash=2166136261;for(const c of building.id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 const tags=building.tags,kind=building.kind,amenity=tags.amenity;
 const commercial=!!tags.shop||['retail','commercial','supermarket'].includes(kind)||['cafe','restaurant','marketplace'].includes(amenity);
 const institutional=['hospital','clinic','school','college','university','bus_station'].includes(amenity)||['hospital','school','college','transportation'].includes(kind);
 const worship=amenity==='place_of_worship'||!!tags.religion||['mosque','temple','church'].includes(kind);
 const style:ArchitectureStyle=worship?'worship':institutional?'institutional':commercial?'commercial':height>10||['apartments','office'].includes(kind)?'apartment':['house','residential'].includes(kind)||kind==='yes'&&hash%3===0?'traditional':'modern';
 const signs=ring.map((a,i)=>{const b=ring[(i+1)%ring.length],c=ring[(i+2)%ring.length];return Math.sign((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x));}).filter(Boolean),convex=ring.length===4&&signs.length===4&&signs.every(s=>s===signs[0]);
 const diameter=Math.max(...ring.map(p=>Math.hypot(p.x-center.x,p.z-center.z)))*2;
 let roof:ArchitecturePlan['roof']='flat';
 if(convex&&diameter<35&&height<=12&&tags['roof:shape']!=='flat'){
  if(tags['roof:shape']==='dome')roof='dome';else if(tags['roof:shape']==='gabled')roof='gabled';else if(tags['roof:shape']==='hipped'||style==='traditional')roof='hipped';
 }
 const rise=roof==='flat'?.32:Math.min(2.2,height*.24);
 return {style,ring,center,height,wallHeight:height-rise,rise,roof,hash};
}
export type ArchitectureLod='near'|'far'|false;
export type ArchitectureAdd=(geometry:THREE.BufferGeometry,material:THREE.Material,point:MapPoint,lod:ArchitectureLod,tint?:THREE.Color)=>void;
export interface ArchitectureMaterials {wall:THREE.Material;roof:THREE.Material;concrete:THREE.Material;wood:THREE.Material;metal:THREE.Material;glass:THREE.Material;door:THREE.Material;shutter:THREE.Material}
/** Direct buffer assembly: facade parts become a handful of shared chunk/material batches. */
class Parts {
 private groups=new Map<THREE.Material,{positions:number[];uv:number[]}>();
 quad(points:number[][],material:THREE.Material,uv?:number[][]){const data=this.groups.get(material)??{positions:[],uv:[]};this.groups.set(material,data);for(const i of [0,1,2,0,2,3]){data.positions.push(...points[i]);data.uv.push(...(uv?.[i]??[[0,0],[1,0],[1,1],[0,1]][i]));}}
 triangle(points:number[][],material:THREE.Material,uv:number[][]){const data=this.groups.get(material)??{positions:[],uv:[]};this.groups.set(material,data);points.forEach((p,i)=>{data.positions.push(...p);data.uv.push(...uv[i]);});}
 flush(add:ArchitectureAdd,center:MapPoint,lod:ArchitectureLod,tints:Map<THREE.Material,THREE.Color>){for(const [material,data] of this.groups){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.computeVertexNormals();add(g,material,center,lod,tints.get(material));}}
}
/** Details stay in the building envelope, with at most 4 cm of facade trim. */
export function addArchitecture(building:OsmBuilding,materials:ArchitectureMaterials,add:ArchitectureAdd,heightAt:(x:number,z:number)=>number,frontFace:(a:MapPoint,b:MapPoint)=>number){
 const p=architecturePlan(building);if(p.ring.length<3)return p;
 const {ring,wallHeight,center}=p,base=heightAt(center.x,center.z),near=new Parts(),farPanels=new Parts(),roof=new Parts();
 const tint=new THREE.Color(['#e5d7bd','#d2ddd5','#e3d9ce','#d8c6b0','#e1e0d3','#d7c6b8'][p.hash%6]);
 if(p.style==='institutional')tint.set('#e0e5db');if(p.style==='commercial')tint.set(['#d8d2c2','#c9d3ce','#e3dbc5'][p.hash%3]);
 const tints=new Map([[materials.wall,tint]]);
 const shape=new THREE.Shape(ring.map(q=>new THREE.Vector2(q.x,-q.z))),far=new THREE.ExtrudeGeometry(shape,{depth:wallHeight,bevelEnabled:false,steps:1});far.rotateX(-Math.PI/2);far.translate(0,base,0);const uv=far.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/3,uv.getY(i)/3);add(far,materials.wall,center,'far',tint);
 const faces=ring.map((a,i)=>({a,b:ring[(i+1)%ring.length],i,score:frontFace(a,ring[(i+1)%ring.length])})).sort((a,b)=>a.score-b.score),front=faces[0]?.i;
 for(let index=0;index<ring.length;index++){
  const a=ring[index],b=ring[(index+1)%ring.length],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.05)continue;
  const tx=(b.x-a.x)/length,tz=(b.z-a.z)/length,sign=pointInPolygon({x:(a.x+b.x)/2+tz*.05,z:(a.z+b.z)/2-tx*.05},ring)?-1:1,nx=tz*sign,nz=-tx*sign;
  const at=(d:number,y:number,depth=0)=>[a.x+tx*d+nx*depth,base+y,a.z+tz*d+nz*depth];
  const panel=(left:number,right:number,bottom:number,top:number,depth:number,mat:THREE.Material)=>{if(right-left<.001||top-bottom<.001)return;near.quad([at(left,bottom,depth),at(right,bottom,depth),at(right,top,depth),at(left,top,depth)],mat,[[left/3,bottom/3],[right/3,bottom/3],[right/3,top/3],[left/3,top/3]]);};
  const box=(d:number,y:number,width:number,height:number,depth:number,offset:number,mat:THREE.Material)=>{
   const l=d-width/2,r=d+width/2,lo=y-height/2,hi=y+height/2,back=offset-depth/2,face=offset+depth/2;
   near.quad([at(l,lo,face),at(r,lo,face),at(r,hi,face),at(l,hi,face)],mat);
   near.quad([at(r,lo,back),at(l,lo,back),at(l,hi,back),at(r,hi,back)],mat);
   near.quad([at(l,lo,back),at(l,lo,face),at(l,hi,face),at(l,hi,back)],mat);
   near.quad([at(r,lo,face),at(r,lo,back),at(r,hi,back),at(r,hi,face)],mat);
   near.quad([at(l,hi,face),at(r,hi,face),at(r,hi,back),at(l,hi,back)],mat);
   near.quad([at(l,lo,back),at(r,lo,back),at(r,lo,face),at(l,lo,face)],mat);
  };
  const floors=Math.max(1,Math.min(8,Math.floor(wallHeight/2.85))),storey=wallHeight/floors,slots=length>=2.6?Math.min(6,Math.max(1,Math.floor((length-.8)/2.7))):0,cell=length/(slots||1);
  for(let level=0;level<floors;level++){
   const bottom=level*storey,top=(level+1)*storey,openings=[];
   for(let slot=0;slot<slots;slot++){
    const d=cell*(slot+.5),entry=index===front&&level===0&&slot===Math.floor(slots/2),commercial=p.style==='commercial'&&level===0;
    const loggia=index===front&&level===1&&slot===Math.floor(slots/2)&&['apartment','modern'].includes(p.style);
    const veranda=entry&&p.style==='traditional'&&cell>2.6;
    const width=Math.min(cell*.73,commercial?2.6:veranda?2.7:loggia?2:entry?1.05:1.35),lo=bottom+(entry||commercial?.18:loggia?.32:1.05),hi=Math.min(top-.32,lo+(entry||commercial||veranda?2.3:loggia?2.15:1.25));
    if(hi-lo<.45)continue;openings.push({l:d-width/2,r:d+width/2,lo,hi,d,width,entry,commercial,loggia,veranda});
   }
   let cursor=0;for(const o of openings){panel(cursor,o.l,bottom,top,0,materials.wall);panel(o.l,o.r,bottom,o.lo,0,materials.wall);panel(o.l,o.r,o.hi,top,0,materials.wall);cursor=o.r;
    const recess=o.loggia||o.veranda?.5:.14,mat=o.entry?materials.door:o.commercial&&(p.hash+index)%3===0?materials.shutter:materials.glass;
    panel(o.l,o.r,o.lo,o.hi,-recess,mat);farPanels.quad([at(o.l,o.lo,.018),at(o.r,o.lo,.018),at(o.r,o.hi,.018),at(o.l,o.hi,.018)],mat);
    near.quad([at(o.l,o.lo),at(o.l,o.lo,-recess),at(o.l,o.hi,-recess),at(o.l,o.hi)],materials.concrete);
    near.quad([at(o.r,o.lo,-recess),at(o.r,o.lo),at(o.r,o.hi),at(o.r,o.hi,-recess)],materials.concrete);
    near.quad([at(o.l,o.lo,-recess),at(o.l,o.lo),at(o.r,o.lo),at(o.r,o.lo,-recess)],materials.concrete);
    near.quad([at(o.l,o.hi),at(o.l,o.hi,-recess),at(o.r,o.hi,-recess),at(o.r,o.hi)],materials.concrete);
    const frame=p.style==='traditional'||p.style==='worship'?materials.wood:materials.metal,h=o.hi-o.lo;
    for(const d of [o.l+.04,o.r-.04])box(d,(o.lo+o.hi)/2,.08,h,.12,-.045,frame);
    for(const y of [o.lo+.035,o.hi-.035])box(o.d,y,o.width,.07,.12,-.045,frame);
    if(o.entry){for(const y of [o.lo+h*.26,o.lo+h*.7])box(o.d,y,o.width*.65,h*.27,.035,-recess+.018,materials.wood);box(o.r-.18,o.lo+h*.48,.035,.18,.035,-recess+.04,materials.metal);}
    else if(o.commercial&&mat===materials.shutter){for(let y=o.lo+.15;y<o.hi;y+=.16)box(o.d,y,o.width-.12,.025,.035,-recess+.02,materials.metal);}
    else{box(o.d,(o.lo+o.hi)/2,.045,h-.1,.09,-recess+.05,frame);box(o.d,o.lo+h*.64,o.width-.08,.045,.09,-recess+.05,frame);}
    box(o.d,o.lo-.025,o.width+.12,.09,.2,-.06,materials.concrete);
    if(o.loggia){box(o.d,o.lo+.82,o.width-.08,.06,.06,-.025,materials.metal);for(let d=o.l+.15;d<o.r-.1;d+=.25)box(d,o.lo+.44,.035,.78,.04,-.025,materials.metal);}
    if(o.veranda){for(const d of [o.l+.16,o.r-.16])box(d,(o.lo+o.hi)/2,.14,h,.16,-.12,materials.wood);box(o.d,o.hi-.12,o.width,.15,.25,-.16,materials.wood);}
    if(p.style==='traditional'&&!o.entry&&!o.loggia&&o.l>.3&&o.r<length-.3){for(const side of [-1,1]){const d=side<0?o.l-.14:o.r+.14;box(d,(o.lo+o.hi)/2,.22,h,.045,-.015,materials.wood);for(let y=o.lo+.1;y<o.hi;y+=.18)near.quad([at(d-.09,y-.018,-.025),at(d+.09,y-.018,-.025),at(d+.09,y+.018,.025),at(d-.09,y+.018,.025)],materials.door);}}
   }panel(cursor,length,bottom,top,0,materials.wall);
   // Inset continuous plinths and floor bands give facades readable depth.
   box(length/2,bottom+.09,length,.15,.075,-.02,materials.concrete);
   if(level)box(length/2,bottom+.02,length,.08,.09,-.02,materials.concrete);
  }
  if(p.roof==='flat')box(length/2,wallHeight+.15,length,.3,.16,-.08,materials.concrete);
  else box(length/2,wallHeight-.06,length,.12,.12,-.05,materials.wood);
 }
 if(p.roof==='flat'){
  const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,base+wallHeight+.02,0);add(g,materials.concrete,center,false);
  // Parapets also survive the far LOD, without drawing tiny facade parts.
  const outer=new THREE.Shape(ring.map(q=>new THREE.Vector2(q.x,-q.z)));const g2=new THREE.ShapeGeometry(outer);g2.rotateX(-Math.PI/2);g2.translate(0,base+p.height,0);add(g2,materials.concrete,center,'far');
 }else if(p.roof==='dome'){
  const radius=Math.min(...ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return Math.abs((b.x-a.x)*(a.z-center.z)-(a.x-center.x)*(b.z-a.z))/Math.hypot(b.x-a.x,b.z-a.z);}))*.94;
  const g=new THREE.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2);g.scale(radius,p.rise,radius);g.translate(center.x,base+wallHeight,center.z);add(g,materials.concrete,center,false);
 }else{
  let longest=0;for(let i=1;i<4;i++)if(Math.hypot(ring[(i+1)%4].x-ring[i].x,ring[(i+1)%4].z-ring[i].z)>Math.hypot(ring[(longest+1)%4].x-ring[longest].x,ring[(longest+1)%4].z-ring[longest].z))longest=i;
  const q=Array.from({length:4},(_,i)=>ring[(longest+i)%4]),a={x:(q[0].x+q[3].x)/2,z:(q[0].z+q[3].z)/2},b={x:(q[1].x+q[2].x)/2,z:(q[1].z+q[2].z)/2},inset=p.roof==='gabled'?0:.24;
  const ra={x:a.x+(b.x-a.x)*inset,z:a.z+(b.z-a.z)*inset},rb={x:b.x+(a.x-b.x)*inset,z:b.z+(a.z-b.z)*inset},v=q.map(x=>[x.x,base+wallHeight,x.z]),r0=[ra.x,base+p.height,ra.z],r1=[rb.x,base+p.height,rb.z];
  const uv=(points:number[][])=>points.map(x=>[Math.hypot(x[0]-q[0].x,x[2]-q[0].z)/1.2,(x[1]-base+Math.hypot(x[0]-center.x,x[2]-center.z))/1.2]);
  for(const face of [[v[0],v[1],r1,r0],[v[2],v[3],r0,r1]])roof.quad(face,materials.roof,uv(face));
  roof.triangle([v[1],v[2],r1],p.roof==='gabled'?materials.wall:materials.roof,uv([v[1],v[2],r1]));roof.triangle([v[3],v[0],r0],p.roof==='gabled'?materials.wall:materials.roof,uv([v[3],v[0],r0]));
  const from=new THREE.Vector3(ra.x,base+p.height-.06,ra.z),to=new THREE.Vector3(rb.x,base+p.height-.06,rb.z),g=new THREE.CylinderGeometry(.065,.065,from.distanceTo(to),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()));g.translate(...from.clone().lerp(to,.5).toArray() as [number,number,number]);add(g,materials.roof,center,false);
 }
 farPanels.flush(add,center,'far',tints);near.flush(add,center,'near',tints);roof.flush(add,center,false,tints);return p;
}
