import type {MapPoint,OsmRoad} from './osm-types';
export type TrafficKind='bike'|'scooter'|'car'|'auto'|'pickup'|'van'|'bus'|'lorry';
export type Density='low'|'medium'|'high';
export const DENSITY:Record<Density,number>={low:6,medium:12,high:18};
export interface TrafficSpec {length:number;width:number;height:number;wheelbase:number;wheelRadius:number;accel:number;brake:number;cruise:number;minWidth:number;majorOnly?:boolean;idle:number;horn:number;paint:string[]}
export const TRAFFIC:Record<TrafficKind,TrafficSpec>={
 bike:{length:1.95,width:0.65,height:1.65,wheelbase:1.3,wheelRadius:0.29,accel:2.6,brake:5,cruise:11,minWidth:3,idle:48,horn:590,paint:['#445461','#9c3e35','#272e31']},
 scooter:{length:1.8,width:0.7,height:1.55,wheelbase:1.2,wheelRadius:0.24,accel:2.2,brake:4.5,cruise:9,minWidth:3,idle:58,horn:650,paint:['#dad4c5','#788d9a','#ae725f']},
 car:{length:3.34,width:1.5,height:1.42,wheelbase:2.175,wheelRadius:0.25,accel:2,brake:5,cruise:13,minWidth:4.2,idle:32,horn:420,paint:['#d9cfad','#a8b6c0','#c5c8c0','#92736a']},
 auto:{length:2.8,width:1.65,height:2.25,wheelbase:2,wheelRadius:0.32,accel:1.6,brake:4.5,cruise:9,minWidth:3.8,idle:23,horn:370,paint:['#f0bd35']},
 pickup:{length:3.15,width:1.6,height:1.9,wheelbase:2.1,wheelRadius:0.31,accel:1.3,brake:4,cruise:8,minWidth:4.2,idle:26,horn:330,paint:['#e9b72d']},
 van:{length:4.5,width:1.8,height:2.1,wheelbase:2.6,wheelRadius:0.33,accel:1.3,brake:4.2,cruise:10,minWidth:5.6,idle:29,horn:350,paint:['#d4d9d3','#93b2bd','#a99a7c']},
 bus:{length:10.4,width:2.4,height:3.15,wheelbase:5.8,wheelRadius:0.5,accel:0.85,brake:3.5,cruise:10,minWidth:6.4,majorOnly:true,idle:17,horn:190,paint:['#ca392f']},
 lorry:{length:7.8,width:2.4,height:3.1,wheelbase:4.4,wheelRadius:0.47,accel:0.7,brake:3.2,cruise:9,minWidth:6.4,majorOnly:true,idle:15,horn:155,paint:['#be8c42','#81978b','#b57853']},
};
export interface ControlNode extends MapPoint {nodeId:string;kind:'traffic_signals'|'crossing';tags:Record<string,string>}
export interface TrafficEdge {id:string;from:string;to:string;a:MapPoint;b:MapPoint;length:number;dx:number;dz:number;road:OsmRoad;startNormal:MapPoint;endNormal:MapPoint}
export interface TrafficAgent extends MapPoint {id:number;y?:number;kind:TrafficKind;edge:string;s:number;speed:number;heading:number;steering:number;braking:boolean;indicator:-1|0|1;distance:number;stuck:number;reason:string;turns:number;paint:number}
export function readDensity(value:string|null):Density{return value==='low'||value==='high'?value:'medium';}
export function signalPhase(time:number,heading:number):'green'|'amber'|'red'{const phase=((time%32)+32)%32,ns=Math.abs(Math.cos(heading))>=Math.abs(Math.sin(heading));return ns?(phase<12?'green':phase<14?'amber':'red'):(phase>=16&&phase<28?'green':phase>=28&&phase<30?'amber':'red');}
export function eligible(kind:TrafficKind,road:OsmRoad){return road.width>=TRAFFIC[kind].minWidth&&(!TRAFFIC[kind].majorOnly||['trunk','primary','secondary','tertiary','trunk_link','primary_link'].includes(road.highway));}

/** Seconds to the next transition in the same authored phase model used by AI and lamps. */
export function signalCountdown(time:number,heading:number):number {
 const phase=signalPhase(time,heading);
 for(let n=1;n<=32;n++){const next=Math.floor(time)+n;if(signalPhase(next+1e-6,heading)!==phase)return Math.max(1,Math.ceil(next-time));}
 return 1;
}
