import type {MapPoint} from './osm-types';
export interface FootPose extends MapPoint {heading:number;speed:number}
export interface FootSave extends MapPoint {version:1;mapId:string;heading:number}
export type TravelMode='driving'|'exiting'|'walking'|'entering';
export function readFootSave(raw:string|null):FootSave|null {
 try{const p=JSON.parse(raw??'null')?.onFoot;if(p?.version!==1||!/^[a-f0-9]{64}$/.test(p.mapId)||![p.x,p.z,p.heading].every((n:unknown)=>typeof n==='number'&&Number.isFinite(n))||Math.abs(p.x)>100000||Math.abs(p.z)>100000)return null;return {version:1,mapId:p.mapId,x:p.x,z:p.z,heading:p.heading};}catch{return null;}
}
/** Character state is separate from the parked vehicle; driving saves never move to foot coordinates. */
export class WalkingController {
 mode:TravelMode='driving';pose:FootPose={x:0,z:0,heading:0,speed:0};viewHeading=0;distance=0;
 private phase=0;private start:MapPoint={x:0,z:0};private end:MapPoint={x:0,z:0};
 constructor(private blocked:(point:MapPoint,ignoreVehicle?:boolean)=>boolean){}
 get active(){return this.mode!=='driving';}
 get transition(){return this.mode==='exiting'||this.mode==='entering';}
 get snapshot():MapPoint & {heading:number}|null{return this.mode==='walking'?{x:this.pose.x,z:this.pose.z,heading:this.pose.heading}:this.mode==='exiting'?{x:this.end.x,z:this.end.z,heading:this.pose.heading}:null;}
 restore(save:FootSave){if(this.blocked(save))return false;this.pose={x:save.x,z:save.z,heading:save.heading,speed:0};this.viewHeading=save.heading;this.mode='walking';return true;}
 exit(car:FootPose,preferredSide=-1):'moving'|'blocked'|'transition'|'ok'{
  if(this.mode!=='driving')return 'transition';if(Math.abs(car.speed)>.2)return 'moving';
  const candidates:Array<MapPoint & {score:number}>=[];
  for(const side of [preferredSide,-preferredSide])for(const lateral of [2,2.8,3.6])for(const forward of [0,1.5,-1.5]){
   const p={x:car.x+Math.cos(car.heading)*lateral*side-Math.sin(car.heading)*forward,z:car.z-Math.sin(car.heading)*lateral*side-Math.cos(car.heading)*forward};
   const door={x:car.x+Math.cos(car.heading)*.8*side,z:car.z-Math.sin(car.heading)*.8*side};
   let clear=!this.blocked(p);
   for(let t=0;t<=1&&clear;t+=.1)if(this.blocked({x:door.x+(p.x-door.x)*t,z:door.z+(p.z-door.z)*t},true))clear=false;
   if(clear)candidates.push({...p,score:lateral+Math.abs(forward)*.5+(side===preferredSide?0:.4)});
  }
  candidates.sort((a,b)=>a.score-b.score);if(!candidates.length)return 'blocked';
  this.viewHeading=car.heading;this.pose={x:car.x,z:car.z,heading:car.heading,speed:0};this.start={x:car.x,z:car.z};this.end=candidates[0];this.phase=0;this.mode='exiting';return 'ok';
 }
 enter(car:FootPose):'far'|'blocked'|'moving'|'transition'|'ok'{
  if(this.mode!=='walking')return 'transition';if(Math.abs(car.speed)>.2)return 'moving';if(Math.hypot(car.x-this.pose.x,car.z-this.pose.z)>3.2)return 'far';
  for(let t=0;t<=.6;t+=.1)if(this.blocked({x:this.pose.x+(car.x-this.pose.x)*t,z:this.pose.z+(car.z-this.pose.z)*t},true))return 'blocked';
  this.start={x:this.pose.x,z:this.pose.z};this.end={x:car.x,z:car.z};this.pose.speed=0;this.phase=0;this.mode='entering';return 'ok';
 }
 update(dt:number,input:{forward:boolean;back:boolean;left:boolean;right:boolean;run:boolean}){
  dt=Math.max(0,Math.min(.1,dt));
  if(this.transition){this.phase=Math.min(1,this.phase+dt/.5);const t=this.phase*this.phase*(3-2*this.phase);this.pose.x=this.start.x+(this.end.x-this.start.x)*t;this.pose.z=this.start.z+(this.end.z-this.start.z)*t;this.pose.speed=0;
   if(this.phase===1){this.mode=this.mode==='exiting'?'walking':'driving';}return;
  }
  if(this.mode!=='walking')return;
  const forward=Number(input.forward)-Number(input.back),side=Number(input.right)-Number(input.left),length=Math.hypot(forward,side),speed=input.run?3.8:1.6;
  this.pose.speed=0;if(!length)return;
  const vx=(-Math.sin(this.viewHeading)*forward+Math.cos(this.viewHeading)*side)/length,vz=(-Math.cos(this.viewHeading)*forward-Math.sin(this.viewHeading)*side)/length;
  const travel=speed*dt,steps=Math.max(1,Math.ceil(travel/.12));let moved=0;
  for(let n=0;n<steps;n++){
   const nx=this.pose.x+vx*travel/steps,nz=this.pose.z+vz*travel/steps;
   if(this.blocked({x:nx,z:nz}))break;this.pose.x=nx;this.pose.z=nz;moved+=travel/steps;
  }
  this.pose.speed=dt?moved/dt:0;this.distance+=moved;
  if(moved){const heading=Math.atan2(-vx,-vz),delta=Math.atan2(Math.sin(heading-this.pose.heading),Math.cos(heading-this.pose.heading));this.pose.heading+=delta*(1-Math.exp(-dt*12));}
 }
}
