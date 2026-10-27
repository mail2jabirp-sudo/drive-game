import type {MapPoint,OsmRoad} from './osm-types';
import {createRoadGraph,nearestRoad,shortestPaths,segmentDistance} from './osm-navigation';
import type {RoadGraph,GraphEdge} from './osm-navigation';
export interface NavigationRoute {points:MapPoint[];distance:number;offRoad:boolean;available:boolean}
/** A bounded resident-road graph. Virtual endpoints lie on source segments;
 * they never connect spatially close but disconnected or grade-separated ways. */
export class RoadNavigator {
 private roads:OsmRoad[]=[];private graph:RoadGraph={points:new Map(),edges:new Map()};
 setRoads(roads:OsmRoad[]){if(this.roads===roads)return false;this.roads=roads;this.graph=createRoadGraph(roads);return true;}
 route(from:MapPoint,to:MapPoint):NavigationRoute {
  const start=nearestRoad(this.roads,from),end=nearestRoad(this.roads,to);
  const unavailable={points:[],distance:0,offRoad:false,available:false};
  if(!start||!end||end.distance>15)return unavailable;
  const points=new Map(this.graph.points),edges=new Map(this.graph.edges);
  const begin='@gps-start',goal='@gps-goal';points.set(begin,start.point);points.set(goal,end.point);
  const add=(a:string,b:string,distance:number)=>{const list:GraphEdge[]=[...(edges.get(a)??[]),{to:b,distance,roadId:'source-segment-attachment'}];edges.set(a,list);};
  const attach=(m:typeof start,starting:boolean)=>{
   const r=m.road,a=r.nodeIds[m.segment],b=r.nodeIds[m.segment+1],pa=r.points[m.segment],pb=r.points[m.segment+1];
   if(r.oneway!=='-1')starting?add(begin,b,Math.hypot(m.point.x-pb.x,m.point.z-pb.z)):add(a,goal,Math.hypot(m.point.x-pa.x,m.point.z-pa.z));
   if(r.oneway!=='yes')starting?add(begin,a,Math.hypot(m.point.x-pa.x,m.point.z-pa.z)):add(b,goal,Math.hypot(m.point.x-pb.x,m.point.z-pb.z));
  };
  attach(start,true);attach(end,false);
  if(start.road===end.road&&start.segment===end.segment){
   const a=start.road.points[start.segment],b=start.road.points[start.segment+1],s=segmentDistance(from,a,b).t,e=segmentDistance(to,a,b).t;
   if(e>=s&&start.road.oneway!=='-1'||e<=s&&start.road.oneway!=='yes')add(begin,goal,Math.hypot(start.point.x-end.point.x,start.point.z-end.point.z));
  }
  const path=shortestPaths({points,edges},begin),distance=path.distance.get(goal);
  if(distance===undefined)return {...unavailable,offRoad:start.distance>Math.max(6,start.road.width)};
  const ids=[goal];while(ids[ids.length-1]!==begin){const p=path.previous.get(ids[ids.length-1]);if(!p)return unavailable;ids.push(p);}
  const route=ids.reverse().map(id=>points.get(id)!).filter((p,i,list)=>!i||Math.hypot(p.x-list[i-1].x,p.z-list[i-1].z)>.02);
  return {points:route,distance,offRoad:start.distance>Math.max(6,start.road.width),available:true};
 }
}
export function turnGuidance(route:NavigationRoute,player:MapPoint & {heading?:number}):{arrow:string;text:string;distance:number} {
 if(!route.available)return {arrow:'⋯',text:'Destination outside connected loaded roads',distance:0};
 if(route.offRoad)return {arrow:'↥',text:'Return to the mapped road',distance:0};
 if(player.heading!==undefined&&route.points.length>1){
  const [a,b]=route.points,heading=Math.atan2(-(b.x-a.x),-(b.z-a.z)),difference=Math.atan2(Math.sin(heading-player.heading),Math.cos(heading-player.heading));
  if(Math.abs(difference)>2.2)return {arrow:'↶',text:'Make a safe U-turn',distance:0};
 }
 let distance=0;
 for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i];distance+=i===1?segmentDistance(player,a,b).distance+Math.hypot(b.x-segmentDistance(player,a,b).point.x,b.z-segmentDistance(player,a,b).point.z):Math.hypot(b.x-a.x,b.z-a.z);
  const c=route.points[i+1];if(!c)break;
  const dx=b.x-a.x,dz=b.z-a.z,nx=c.x-b.x,nz=c.z-b.z;
  const angle=Math.atan2(dz*nx-dx*nz,dx*nx+dz*nz);
  if(Math.abs(angle)>.45&&Math.hypot(dx,dz)>2&&Math.hypot(nx,nz)>2)return {arrow:angle>0?'↰':'↱',text:angle>0?'Turn left':'Turn right',distance};
 }
 return {arrow:'↑',text:distance<10?'Stop at the marked roadside point':'Continue on the highlighted road',distance};
}
