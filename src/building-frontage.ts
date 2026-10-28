import type {MapPoint,OsmMap} from './osm-types';
import {architecturePlan} from './architecture';
import {buildRoadFoundation,buildingConflictsWithRoad} from './road-foundation';
import {pointInPolygon,segmentDistance,nearestRoad} from './osm-navigation';
import {roadProfile} from './road-profile';
export interface FrontagePart {buildingId:string;kind:'entrance'|'wall'|'gatepost'|'fence';points:MapPoint[];height:number;solid:boolean;source:'procedural'}
/** Illustrative frontage, never a cadastral boundary. Reject entire lots on uncertain clearance. */
export function buildBuildingFrontages(data:OsmMap,focus:MapPoint,protectedStops:MapPoint[]=[]):FrontagePart[]{
 const result:FrontagePart[]=[];
 const pavement=buildRoadFoundation({bounds:data.bounds,roads:data.roads.map(r=>({...r,width:r.width+2*(roadProfile(r).shoulder+.55)}))}).patches;
 const overlaps=(a:{points:MapPoint[]},b:{points:MapPoint[]})=>buildingConflictsWithRoad(a,{...b,roadIds:[],kind:'segment'});
 const water=[...data.water.filter(w=>w.kind==='area')];
 for(const w of data.water.filter(w=>w.kind==='stream'))for(let i=1;i<w.points.length;i++){
  const a=w.points[i-1],b=w.points[i],len=Math.hypot(b.x-a.x,b.z-a.z);if(len<.01)continue;const nx=-(b.z-a.z)/len*((w.width??2)/2+.6),nz=(b.x-a.x)/len*((w.width??2)/2+.6);
  water.push({...w,points:[{x:a.x+nx,z:a.z+nz},{x:b.x+nx,z:b.z+nz},{x:b.x-nx,z:b.z-nz},{x:a.x-nx,z:a.z-nz}]});
 }
 const candidates=data.buildings.map(b=>({b,p:architecturePlan(b)})).filter(({b,p})=>!b.renderExcludedReason&&p.height<=10&&['traditional-house','concrete-house','rural'].includes(p.typology)&&Math.hypot(p.center.x-focus.x,p.center.z-focus.z)<170).sort((a,b)=>a.p.hash-b.p.hash);
 let lots=0;
 for(const {b,p} of candidates){
  if(lots>=24)break;
  const faces=p.ring.map((a,i)=>({a,b:p.ring[(i+1)%p.ring.length]})).sort((u,v)=>(nearestRoad(data.roads,{x:(u.a.x+u.b.x)/2,z:(u.a.z+u.b.z)/2})?.distance??Infinity)-(nearestRoad(data.roads,{x:(v.a.x+v.b.x)/2,z:(v.a.z+v.b.z)/2})?.distance??Infinity));
  const f=faces[0];if(!f)continue;const len=Math.hypot(f.b.x-f.a.x,f.b.z-f.a.z);if(len<5||len>24)continue;
  const tx=(f.b.x-f.a.x)/len,tz=(f.b.z-f.a.z)/len,sign=pointInPolygon({x:(f.a.x+f.b.x)/2+tz*.1,z:(f.a.z+f.b.z)/2-tx*.1},p.ring)?-1:1,nx=tz*sign,nz=-tx*sign;
  const at=(u:number,v:number)=>({x:f.a.x+tx*u+nx*v,z:f.a.z+tz*u+nz*v});
  const rectangle=(l:number,r:number,inside:number,outside:number)=>[at(l,inside),at(r,inside),at(r,outside),at(l,outside)];
  const envelope={points:rectangle(.3,len-.3,.12,1.9)};
  if(envelope.points.some(q=>q.x<data.bounds.minX||q.x>data.bounds.maxX||q.z<data.bounds.minZ||q.z>data.bounds.maxZ))continue;
  if(pavement.some(r=>overlaps(envelope,r))||water.some(w=>overlaps(envelope,w))||data.buildings.some(other=>overlaps(envelope,other)))continue;
  if(protectedStops.some(stop=>pointInPolygon(stop,envelope.points)||envelope.points.some((a,i)=>segmentDistance(stop,a,envelope.points[(i+1)%4]).distance<8)))continue;
  if(result.some(part=>overlaps(envelope,part)))continue;
  const mid=len/2,gap=1.2;
  const part=(kind:FrontagePart['kind'],points:MapPoint[],height:number,solid=true)=>({buildingId:b.id,kind,points,height,solid,source:'procedural' as const});
  result.push(part('entrance',rectangle(mid-gap,mid+gap,.14,1.9),.025,false));
  for(const [l,r] of [[.3,mid-gap-.15],[mid+gap+.15,len-.3]]){
   if(r-l<.3)continue;
   result.push(part(p.hash%3===0?'fence':'wall',rectangle(l,r,1.6,1.76),p.hash%3===0?.75:.6));
  }
  for(const u of [mid-gap-.1,mid+gap+.1])result.push(part('gatepost',rectangle(u-.09,u+.09,1.55,1.82),.95));
  lots++;
 }
 return result;
}
export function frontageBlocks(parts:FrontagePart[],point:MapPoint,radius:number){return parts.some(p=>p.solid&&(pointInPolygon(point,p.points)||p.points.some((a,i)=>segmentDistance(point,a,p.points[(i+1)%p.points.length]).distance<radius)));}
