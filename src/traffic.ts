import * as THREE from 'three';
import {TrafficSimulation} from './traffic-sim';
import type {PlayerPose,TrafficSurface} from './traffic-sim';
import {TrafficObstacles} from './traffic-obstacles';
import {TrafficRenderer} from './traffic-renderer';
import {readDensity} from './traffic-types';
import type {ControlNode,Density} from './traffic-types';
import type {OsmMap} from './osm-types';
export async function createTraffic(scene:THREE.Scene,data:OsmMap,surface:TrafficSurface & {heightAt:(x:number,z:number)=>number}){
 let controls:ControlNode[]=[],available=true;
 try{const response=await fetch(`${import.meta.env.BASE_URL}maps/district/traffic-controls.json`,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('Traffic control data unavailable');const input=await response.json();
  if(input.version!==1||input.sourceSha256!==data.source.sha256||!Array.isArray(input.controls)||input.controls.some((c:ControlNode)=>!/^\d+$/.test(c.nodeId)||!['crossing','traffic_signals'].includes(c.kind)||![c.x,c.z].every(Number.isFinite)||c.x<data.bounds.minX||c.x>data.bounds.maxX||c.z<data.bounds.minZ||c.z>data.bounds.maxZ))throw new Error('Invalid traffic control data');controls=input.controls;
 }catch(error){available=false;console.warn('Traffic disabled safely; existing driving remains available.',error);}
 const obstacles=new TrafficObstacles();obstacles.update(data.buildings);
 const sim=new TrafficSimulation({...surface,vehicleBlocked:(pose,spec)=>obstacles.blocked(pose,spec)},controls);sim.enabled=available;sim.setRoads(data.roads);
 try{sim.density=readDensity(JSON.parse(localStorage.getItem('en3d.traffic.v1')??'{}').density??null);}catch{/* Optional traffic preference. */}
 try{sim.hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',hourCycle:'h23'}).format(new Date()));}catch{sim.hour=12;}
 const renderer=new TrafficRenderer(scene);
 return {sim,available,
  setDensity(density:Density){sim.density=density;try{localStorage.setItem('en3d.traffic.v1',JSON.stringify({density}));}catch{/* Optional preference only. */}},
  update(dt:number,player:PlayerPose,low:boolean,active:boolean){sim.setRoads(data.roads);obstacles.update(data.buildings);sim.town=data.buildings.length>20;sim.lowDetail=low;if(active)sim.update(dt,player);renderer.update(sim,player,surface.heightAt,low);},
  blocksPlayer:(x:number,z:number,heading:number)=>sim.blocksPlayer(x,z,heading),clear:()=>sim.clear(),dispose:()=>renderer.dispose(),
  get status(){return !available?'Traffic unavailable · driving remains ready':`${sim.agents.length} nearby vehicles${sim.lowDetail?' · Battery saver cap 6':''}`;}
 };
}
