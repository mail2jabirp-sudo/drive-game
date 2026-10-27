import type {MapPoint,OsmMap} from './osm-types';
import {segmentDistance} from './osm-navigation';
import {TrafficObstacles} from './traffic-obstacles';
export type RoadPose=MapPoint & {heading:number};
/** Repair a position, never the wallet, passenger state or archived save. */
export function roadSpawn(data:OsmMap,surface:{roadSurface:(x:number,z:number)=>boolean;isBlocked:(x:number,z:number)=>boolean},desired:RoadPose):RoadPose {
 const obstacles=new TrafficObstacles();obstacles.update(data.buildings);
 const fits=(pose:RoadPose)=>{
  if(![pose.x,pose.z,pose.heading].every(Number.isFinite)||obstacles.blocked(pose,{width:1.8,length:3}))return false;
  for(const x of [-.9,0,.9])for(const z of [-1.5,0,1.5]){
   const px=pose.x+Math.cos(pose.heading)*x+Math.sin(pose.heading)*z,pz=pose.z-Math.sin(pose.heading)*x+Math.cos(pose.heading)*z;
   if(!surface.roadSurface(px,pz)||surface.isBlocked(px,pz))return false;
  }
  return true;
 };
 if(fits(desired))return {...desired};
 const candidates:Array<RoadPose & {distance:number}>=[];
 for(const road of data.roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<4||road.width<3)continue;
  const sign=road.oneway==='-1'?-1:1,heading=Math.atan2(-dx*sign,-dz*sign);
  const projected=segmentDistance(desired,a,b);
  const lane=road.oneway==='no'?Math.min(1.1,Math.max(0,road.width/2-1.1)):0;
  // A footprint can obstruct the closest projection: search along the same real
  // segment as well, rather than falling back to an unrelated distant road.
  for(const offset of [0,-4,4,-10,10,-20,20]){
   const t=Math.max(2/len,Math.min(1-2/len,projected.t+offset/len));
   const x=a.x+dx*t-Math.cos(heading)*lane,z=a.z+dz*t+Math.sin(heading)*lane;
   candidates.push({x,z,heading,distance:Math.hypot(x-desired.x,z-desired.z)});
  }
 }
 candidates.sort((a,b)=>a.distance-b.distance);
 for(const p of candidates)if(fits(p))return {x:p.x,z:p.z,heading:p.heading};
 throw new Error('No safe drivable road spawn in loaded source tiles');
}
