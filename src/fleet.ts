import type {DriveState} from './driving';
import type {OsmMap} from './osm-types';
import {TrafficObstacles} from './traffic-obstacles';
import {rectanglesOverlap} from './traffic-sim';
export type VehicleKind='auto'|'hatchback'|'taxi'|'van';
export interface VehicleSpec {name:string;width:number;length:number;height:number;wheelbase:number;acceleration:number;braking:number;maxSpeed:number;reverse:number;steer:number;engine:number;cameraHeight:number;cameraBack:number;taxiEligible:boolean}
export const VEHICLES:Record<VehicleKind,VehicleSpec>={
 auto:{name:'Passenger auto',width:1.9,length:3.2,height:2.45,wheelbase:2.4,acceleration:7,braking:16,maxSpeed:22,reverse:6,steer:.52,engine:35,cameraHeight:1.86,cameraBack:9,taxiEligible:false},
 hatchback:{name:'Compact hatchback',width:1.8,length:3.6,height:1.62,wheelbase:2.35,acceleration:6.4,braking:18,maxSpeed:28,reverse:5,steer:.51,engine:49,cameraHeight:1.26,cameraBack:9.5,taxiEligible:true},
 taxi:{name:'Sedan taxi',width:1.85,length:4.35,height:1.65,wheelbase:2.65,acceleration:5.8,braking:17,maxSpeed:30,reverse:5,steer:.47,engine:43,cameraHeight:1.3,cameraBack:10.5,taxiEligible:true},
 van:{name:'Kerala van',width:1.95,length:4.6,height:2.3,wheelbase:2.8,acceleration:4.3,braking:14,maxSpeed:24,reverse:4,steer:.43,engine:29,cameraHeight:1.85,cameraBack:11,taxiEligible:false},
};
export interface FleetVehicle {id:VehicleKind;kind:VehicleKind;state:DriveState;taxiAvailable:boolean}
export interface FleetSave {version:1;mapId:string;active:VehicleKind;vehicles:FleetVehicle[]}
export function readFleet(raw:string|null,mapId:string):FleetSave|null{
 try{const f=JSON.parse(raw??'null')?.fleet;if(f?.version!==1||f.mapId!==mapId||!Object.hasOwn(VEHICLES,f.active)||!Array.isArray(f.vehicles)||(f.vehicles.length<1||f.vehicles.length>4))return null;
 const ids=new Set<string>();const vehicles:FleetVehicle[]=f.vehicles.map((v:FleetVehicle)=>{if(!Object.hasOwn(VEHICLES,v.kind)||v.id!==v.kind||ids.has(v.id)||![v.state?.x,v.state?.z,v.state?.heading].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<100000))throw Error('Invalid fleet');ids.add(v.id);return {id:v.id,kind:v.kind,state:{x:v.state.x,z:v.state.z,heading:v.state.heading,speed:0,steering:0},taxiAvailable:v.taxiAvailable===true&&VEHICLES[v.kind].taxiEligible};});if(!ids.has(f.active)||!ids.has('auto'))return null;return {version:1,mapId,active:f.active,vehicles};
 }catch{return null;}
}
export function vehicleOverlap(a:FleetVehicle,b:FleetVehicle,margin=.3){return rectanglesOverlap({...a.state,...VEHICLES[a.kind]},{...b.state,...VEHICLES[b.kind]},margin);}
/** Park only on source pavement, facing a legal direction, left of centre on two-way roads.
 * These are game vehicle locations, not claims of mapped/legal parking bays. */
export function placeFleet(data:OsmMap,surface:{roadSurface:(x:number,z:number)=>boolean;isBlocked:(x:number,z:number)=>boolean},auto:DriveState):FleetVehicle[]{
 const fleet:FleetVehicle[]=[{id:'auto',kind:'auto',state:auto,taxiAvailable:false}],obstacles=new TrafficObstacles();obstacles.update(data.buildings);
 // Streamed maps do not precompute intersections: derive junction degree from
 // shared OSM node IDs, never from line crossings or duplicate tile fragments.
 const nodes=new Map<string,{point:{x:number;z:number};neighbors:Set<string>}>();
 for(const road of data.roads)for(let i=0;i<(road.nodeIds?.length??0);i++){
  const id=road.nodeIds[i],entry=nodes.get(id)??{point:road.points[i],neighbors:new Set<string>()};
  if(i)entry.neighbors.add(road.nodeIds[i-1]);if(i+1<road.nodeIds.length)entry.neighbors.add(road.nodeIds[i+1]);nodes.set(id,entry);
 }
 const junctions=[...nodes.values()].filter(n=>n.neighbors.size>2).map(n=>n.point);
 junctions.push(...data.intersections.filter(j=>j.roadIds.length>1));
 for(const kind of ['hatchback','taxi','van'] as const){const spec=VEHICLES[kind],candidates:Array<DriveState & {distance:number}>=[];
 for(const road of data.roads){if(road.width<spec.width+2.3||['motorway','motorway_link','trunk'].includes(road.highway))continue;
 for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<spec.length+4)continue;
 const sign=road.oneway==='-1'?-1:1,heading=Math.atan2(-dx*sign,-dz*sign),lane=road.oneway==='no'?Math.min(road.width/2-spec.width/2-.3,road.width/4):0;
 for(let d=spec.length/2+2;d<len-spec.length/2-2;d+=4){const x=a.x+dx*d/len-Math.cos(heading)*lane,z=a.z+dz*d/len+Math.sin(heading)*lane,distance=Math.hypot(x-auto.x,z-auto.z),forward=-(x-auto.x)*Math.sin(auto.heading)-(z-auto.z)*Math.cos(auto.heading),lateral=Math.abs((x-auto.x)*Math.cos(auto.heading)-(z-auto.z)*Math.sin(auto.heading));if(forward>0&&forward<45&&lateral<(VEHICLES.auto.width+spec.width)/2+.8)continue;if(distance<10||distance>150||junctions.some(j=>Math.hypot(j.x-x,j.z-z)<10))continue;candidates.push({x,z,heading,speed:0,steering:0,distance});}
 }}candidates.sort((a,b)=>a.distance-b.distance);
 for(const p of candidates){const v:FleetVehicle={id:kind,kind,state:{x:p.x,z:p.z,heading:p.heading,speed:0,steering:0},taxiAvailable:kind==='taxi'};
 if(fleet.some(other=>vehicleOverlap(v,other,2))||obstacles.blocked(p,spec))continue;
 let clear=true;for(const x of [-spec.width/2,0,spec.width/2])for(const z of [-spec.length/2,0,spec.length/2]){const px=p.x+Math.cos(p.heading)*x+Math.sin(p.heading)*z,pz=p.z-Math.sin(p.heading)*x+Math.cos(p.heading)*z;if(!surface.roadSurface(px,pz)||surface.isBlocked(px,pz))clear=false;}
 if(clear){fleet.push(v);break;}}
 }return fleet;
}
export function availableVehicle(fleet:FleetVehicle[],point:{x:number;z:number},passengerVehicle:VehicleKind|null){return fleet.filter(v=>(!passengerVehicle||v.id===passengerVehicle)&&Math.abs(v.state.speed)<=.2).sort((a,b)=>Math.hypot(a.state.x-point.x,a.state.z-point.z)-Math.hypot(b.state.x-point.x,b.state.z-point.z))[0];}
