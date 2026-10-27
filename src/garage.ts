/** Original game tuning, not manufacturer-certified vehicle dynamics. */
export type VehicleId='maruti800'|'passenger-auto';
export interface VehicleDynamics {mass:number;acceleration:number;braking:number;reverseAcceleration:number;reverseBraking:number;maxSpeed:number;reverseSpeed:number;wheelbase:number;maxSteer:number;steerResponse:number;rollingResistance:number;halfWidth?:number;halfLength?:number}
export const DYNAMICS:Record<VehicleId,VehicleDynamics>={
 'passenger-auto':{mass:360,acceleration:7,braking:16,reverseAcceleration:4,reverseBraking:14,maxSpeed:22,reverseSpeed:6,wheelbase:2.4,maxSteer:0.52,steerResponse:9,rollingResistance:1.6},
 maruti800:{mass:650,acceleration:4.8,braking:13.5,reverseAcceleration:3,reverseBraking:12.5,maxSpeed:32,reverseSpeed:7,wheelbase:2.175,maxSteer:0.5,steerResponse:6.5,rollingResistance:1.25,halfWidth:0.72,halfLength:1.67},
};
export function readVehicle(raw:string|null):VehicleId{try{return JSON.parse(raw??'null')?.vehicleId==='maruti800'?'maruti800':'passenger-auto';}catch{return 'passenger-auto';}}
export function withVehicle(save:string,id:VehicleId){return JSON.stringify({...JSON.parse(save),vehicleId:id});}
export function canSwitchVehicle(speed:number,phase:string,id:VehicleId){return Math.abs(speed)<0.5 && (id==='passenger-auto'||phase!=='dropoff');}
export function engineState(id:VehicleId,speed:number,throttle:boolean){
 const absolute=Math.abs(speed),gear=Math.min(id==='maruti800'?4:3,Math.floor(absolute/(id==='maruti800'?8:7))+1);
 const idle=id==='maruti800'?850:1100,rpm=idle+(absolute% (id==='maruti800'?8:7))*270+(throttle?650:0);
 return {gear,rpm,load:throttle?1:0.25};
}
