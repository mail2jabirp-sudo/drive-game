import type {MapPoint,OsmRoad} from './osm-types';
import {DENSITY,TRAFFIC,eligible,signalPhase} from './traffic-types';
import type {ControlNode,Density,TrafficAgent,TrafficEdge,TrafficKind} from './traffic-types';
export interface TrafficSurface {roadSurface:(x:number,z:number)=>boolean;isBlocked:(x:number,z:number)=>boolean;vehicleBlocked?:(pose:MapPoint & {heading:number},spec:{length:number;width:number})=>boolean}
export interface PlayerPose extends MapPoint {heading:number;speed:number}
const kinds=Object.keys(TRAFFIC) as TrafficKind[];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
function hash(value:string){let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function lanePosition(edge:TrafficEdge,s:number,junctions:Set<string>):MapPoint{
 const t=clamp(s/edge.length,0,1),fade=(junctions.has(edge.from)?clamp(s/7,0,1):1)*(junctions.has(edge.to)?clamp((edge.length-s)/7,0,1):1);
 const offset=edge.road.oneway==='no'&&edge.road.width>=4?Math.min(2.1,edge.road.width/4):0;
 return {x:edge.a.x+(edge.b.x-edge.a.x)*t+(edge.startNormal.x*(1-t)+edge.endNormal.x*t)*offset*fade,z:edge.a.z+(edge.b.z-edge.a.z)*t+(edge.startNormal.z*(1-t)+edge.endNormal.z*t)*offset*fade};
}
export function rectanglesOverlap(a:MapPoint & {heading:number;length:number;width:number},b:MapPoint & {heading:number;length:number;width:number},margin=0):boolean{
 const axes=[{x:Math.cos(a.heading),z:-Math.sin(a.heading)},{x:-Math.sin(a.heading),z:-Math.cos(a.heading)},{x:Math.cos(b.heading),z:-Math.sin(b.heading)},{x:-Math.sin(b.heading),z:-Math.cos(b.heading)}];
 const radius=(o:typeof a,axis:MapPoint)=>Math.abs(Math.cos(o.heading)*axis.x-Math.sin(o.heading)*axis.z)*(o.width/2+margin)+Math.abs(-Math.sin(o.heading)*axis.x-Math.cos(o.heading)*axis.z)*(o.length/2+margin);
 return axes.every(axis=>Math.abs((b.x-a.x)*axis.x+(b.z-a.z)*axis.z)<=radius(a,axis)+radius(b,axis));
}
export class TrafficSimulation{
 readonly agents:TrafficAgent[]=[];readonly edges=new Map<string,TrafficEdge>();readonly outgoing=new Map<string,TrafficEdge[]>();readonly nodeEdges=new Map<string,TrafficEdge>();readonly junctions=new Set<string>();
 readonly controls=new Map<string,ControlNode>();private reservations=new Map<string,{id:number;until:number}>();
 private roadList:OsmRoad[]=[];private candidates:TrafficEdge[]=[];private accumulator=0;private spawnClock=0;private serial=0;private cursor=0;
 clock=0;density:Density='medium';hour=12;lowDetail=false;town=false;enabled=true;spawning=true;
 constructor(readonly surface:TrafficSurface,controls:ControlNode[]=[],readonly seed=73){for(const control of controls)this.controls.set(control.nodeId,control);}
 setRoads(roads:OsmRoad[]){
  if(roads===this.roadList)return;this.roadList=roads;this.edges.clear();this.outgoing.clear();this.nodeEdges.clear();this.junctions.clear();this.reservations.clear();
  const neighbors=new Map<string,Set<string>>(),sources=new Map<string,Set<string>>();
  for(const road of roads){
   const normal=(i:number,sign:number)=>{const a=road.points[Math.max(0,i-1)],b=road.points[Math.min(road.points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:(b.z-a.z)/len*sign,z:-(b.x-a.x)/len*sign};};
   for(let i=1;i<road.points.length;i++)for(const reverse of [false,true]){
    if((reverse&&road.oneway==='yes')||(!reverse&&road.oneway==='-1'))continue;
    const ai=reverse?i:i-1,bi=reverse?i-1:i,from=road.nodeIds[ai],to=road.nodeIds[bi],a=road.points[ai],b=road.points[bi],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<0.3)continue;
    const id=`${road.sourceWayId}:${from}>${to}`;if(this.edges.has(id))continue;
    const edge:TrafficEdge={id,from,to,a,b,length,dx:(b.x-a.x)/length,dz:(b.z-a.z)/length,road,startNormal:normal(ai,reverse?-1:1),endNormal:normal(bi,reverse?-1:1)};
    this.edges.set(id,edge);if(!this.nodeEdges.has(from))this.nodeEdges.set(from,edge);if(!this.nodeEdges.has(to))this.nodeEdges.set(to,edge);const out=this.outgoing.get(from)??[];out.push(edge);this.outgoing.set(from,out);
    for(const [node,other] of [[from,to],[to,from]]){const n=neighbors.get(node)??new Set();n.add(other);neighbors.set(node,n);const s=sources.get(node)??new Set();s.add(road.sourceWayId);sources.set(node,s);}
   }
  }
  for(const [node,n] of neighbors)if(n.size>2)this.junctions.add(node);
  // Source-way boundaries are not intersections. Match lane endpoints across connected curves.
  const offset=(e:TrafficEdge)=>e.road.oneway==='no'&&e.road.width>=4?Math.min(2.1,e.road.width/4):0;
  for(const e of this.edges.values())if(!this.junctions.has(e.to)){
   const continuation=(this.outgoing.get(e.to)??[]).filter(n=>n.to!==e.from);
   if(continuation.length===1){const n=continuation[0],length=Math.hypot(e.dx+n.dx,e.dz+n.dz);if(length>.01){const normal={x:(e.dz+n.dz)/length,z:-(e.dx+n.dx)/length},common=Math.min(offset(e),offset(n));e.endNormal={x:normal.x*common/(offset(e)||1),z:normal.z*common/(offset(e)||1)};n.startNormal={x:normal.x*common/(offset(n)||1),z:normal.z*common/(offset(n)||1)};}}
  }
  for(const out of this.outgoing.values())out.sort((a,b)=>a.id.localeCompare(b.id));
  this.candidates=[...this.edges.values()].sort((a,b)=>hash(a.id+this.seed)-hash(b.id+this.seed));
  for(let i=this.agents.length-1;i>=0;i--)if(!this.edges.has(this.agents[i].edge))this.agents.splice(i,1);
 }
 get capacity(){return this.lowDetail?Math.min(6,DENSITY[this.density]):DENSITY[this.density];}
 clear(){this.agents.length=0;this.reservations.clear();this.spawnClock=0;}
 private next(agent:TrafficAgent,edge=this.edges.get(agent.edge)!):TrafficEdge|undefined{
  if(!edge)return;const spec=TRAFFIC[agent.kind],limit=spec.majorOnly?1.2:2.5;
  return (this.outgoing.get(edge.to)??[]).filter(e=>e.to!==edge.from&&eligible(agent.kind,e.road)&&Math.acos(clamp(edge.dx*e.dx+edge.dz*e.dz,-1,1))<limit)
   .map(e=>({e,score:Math.acos(clamp(edge.dx*e.dx+edge.dz*e.dz,-1,1))+(hash(`${agent.id}:${agent.turns}:${e.id}`)%100)/130}))
   .sort((a,b)=>a.score-b.score||a.e.id.localeCompare(b.e.id))[0]?.e;
 }
 private upcoming(agent:TrafficAgent){let edge=this.edges.get(agent.edge)!,distance=edge.length-agent.s,turns=agent.turns;
  for(let i=0;i<16&&distance<45;i++){
   const control=this.controls.get(edge.to);if(control||this.junctions.has(edge.to))return {edge,distance,control,junction:this.junctions.has(edge.to)};
   const next=this.next({...agent,edge:edge.id,turns},edge);if(!next)break;edge=next;turns++;distance+=edge.length;
  }
 }
 private validPose(agent:Pick<TrafficAgent,'kind'|'x'|'z'|'heading'>){
  const spec=TRAFFIC[agent.kind];if(this.surface.vehicleBlocked?.(agent,spec))return false;
  const side={x:Math.cos(agent.heading),z:-Math.sin(agent.heading)},forward={x:-Math.sin(agent.heading),z:-Math.cos(agent.heading)};
  for(const end of [-.48,0,.48])for(const width of [-.46,.46]){
   const x=agent.x+forward.x*spec.length*end+side.x*spec.width*width,z=agent.z+forward.z*spec.length*end+side.z*spec.width*width;
   if(!this.surface.roadSurface(x,z)||this.surface.isBlocked(x,z))return false;
  }
  return true;
 }
 private overlaps(agent:Pick<TrafficAgent,'id'|'kind'|'x'|'z'|'heading'>,player:PlayerPose,margin=0.25){
  const box={...agent,...TRAFFIC[agent.kind]};
  if(rectanglesOverlap(box,{...player,width:1.8,length:3.0},margin))return true;
  return this.agents.some(other=>other.id!==agent.id&&rectanglesOverlap(box,{...other,...TRAFFIC[other.kind]},margin));
 }
 private spawn(player:PlayerPose){
  if(!this.candidates.length)return;
  const local=this.candidates.filter(e=>{const p=lanePosition(e,e.length/2,this.junctions),d=Math.hypot(p.x-player.x,p.z-player.z);return d>=18&&d<=180;});
  // Seed the first nearby vehicles in the actual forward view, without moving roads
  // or bypassing footprint, junction, lane and following-distance checks.
  local.sort((a,b)=>{
   const score=(e:TrafficEdge)=>{const p=lanePosition(e,e.length/2,this.junctions),dx=p.x-player.x,dz=p.z-player.z,d=Math.hypot(dx,dz),forward=-Math.sin(player.heading)*dx-Math.cos(player.heading)*dz,lateral=Math.abs(Math.cos(player.heading)*dx-Math.sin(player.heading)*dz);return d+Math.max(0,20-forward)*8+lateral*3;};
   return score(a)-score(b)||a.id.localeCompare(b.id);
  });
  if(!local.length)return;
  const order:TrafficKind[]=['bike','car','auto','van','bus','lorry','scooter','pickup'];
  // First fill missing suitable categories, then use context/hour weights for extra traffic.
  const priorities:Array<TrafficKind|null>=[...order.filter(k=>!this.agents.some(a=>a.kind===k)),null];
  for(const wanted of priorities)for(let attempt=0;attempt<local.length;attempt++){
   const edge=local[attempt];this.cursor++;const middle=lanePosition(edge,edge.length/2,this.junctions),distance=Math.hypot(middle.x-player.x,middle.z-player.z);
   if(distance<18||distance>180)continue;
   const major=['trunk','primary','secondary','tertiary'].includes(edge.road.highway),night=this.hour<6||this.hour>=19;
   const choices=kinds.filter(k=>eligible(k,edge.road)&&edge.length>1&&this.agents.filter(a=>a.kind===k).length<Math.max(2,Math.ceil(this.capacity/3)));
   if(!choices.length||(wanted&&!choices.includes(wanted)))continue;
   const weighted=choices.flatMap(k=>Array.from({length:Math.max(1,Math.round((k==='bike'||k==='scooter'?3:k==='auto'?2:1)*(major&&(k==='bus'||k==='lorry')?3:1)*(this.town&&(k==='auto'||k==='van')?2:1)*(night?(k==='lorry'?2:(k==='bike'||k==='scooter')?.5:1):1)))},()=>k));
   const kind=wanted??weighted[hash(`${this.seed}:${this.cursor}:${this.serial}`)%weighted.length],spec=TRAFFIC[kind],s=edge.length*.5;
   if([...this.junctions].some(id=>{const e=this.nodeEdges.get(id)!;const p=e.from===id?e.a:e.b;return Math.hypot(p.x-middle.x,p.z-middle.z)<spec.length/2+4;}))continue;
   const before=lanePosition(edge,Math.max(0,s-.4),this.junctions),after=lanePosition(edge,Math.min(edge.length,s+.4),this.junctions);
   const agent:TrafficAgent={id:this.serial++,kind,edge:edge.id,s,x:middle.x,z:middle.z,speed:0,heading:Math.atan2(-(after.x-before.x),-(after.z-before.z)),steering:0,braking:false,indicator:0,distance:0,stuck:0,reason:'spawn',turns:0,paint:this.serial%spec.paint.length};
   if(!this.next(agent)||!this.validPose(agent)||this.overlaps(agent,player,4))continue;
   this.agents.push(agent);return;
  }
 }
 update(dt:number,player:PlayerPose){if(!this.enabled)return;this.accumulator+=clamp(dt,0,.15);
  while(this.accumulator>=.05){this.accumulator-=.05;this.step(.05,player);}
 }
 private step(dt:number,player:PlayerPose){
  this.clock+=dt;this.spawnClock+=dt;
  for(const [key,value] of this.reservations)if(value.until<this.clock||!this.agents.some(a=>a.id===value.id))this.reservations.delete(key);
  for(let i=this.agents.length-1;i>=0;i--){const a=this.agents[i];if(Math.hypot(a.x-player.x,a.z-player.z)>265||a.stuck>25||!this.edges.has(a.edge)||i>=this.capacity)this.agents.splice(i,1);}
  if(this.spawning&&this.spawnClock>.3&&this.agents.length<this.capacity){this.spawnClock=0;this.spawn(player);}
  for(const a of this.agents){
   const edge=this.edges.get(a.edge)!;if(!eligible(a.kind,edge.road)){a.stuck=26;continue;}
   const spec=TRAFFIC[a.kind],next=this.next(a),remaining=edge.length-a.s;
   const roadCap=['trunk','primary'].includes(edge.road.highway)?14:['secondary','tertiary'].includes(edge.road.highway)?10:edge.road.highway==='service'?4:6;
   let hardStop=Infinity;
   let target=Math.min(spec.cruise,roadCap,edge.road.maxspeed===null?Infinity:edge.road.maxspeed/3.6),reason='cruise';a.indicator=0;
   const stop=(gap:number,why:string)=>{if(['signal','junction yield','player priority','major-road priority'].includes(why))hardStop=Math.min(hardStop,Math.max(0,gap));target=Math.min(target,Math.sqrt(2*spec.brake*Math.max(0,gap)));if(gap<spec.length+5)reason=why;};
   if(!next)stop(remaining-spec.length/2-1,'road end');
   else if(remaining<18){const delta=angle(Math.atan2(-next.dx,-next.dz)-Math.atan2(-edge.dx,-edge.dz));if(Math.abs(delta)>.25){target=Math.min(target,spec.majorOnly?2.4:4);a.indicator=delta>0?1:-1;}}
   const upcoming=this.upcoming(a);
   if(upcoming){const {control,distance,junction}=upcoming,stopGap=distance-spec.length/2-2;
    if(control?.kind==='traffic_signals'&&signalPhase(this.clock+this.hour*3600,Math.atan2(-upcoming.edge.dx,-upcoming.edge.dz))!=='green')stop(stopGap,'signal');
    if(control?.kind==='crossing'&&distance<18)target=Math.min(target,4);
    if(junction&&distance<Math.max(20,a.speed*a.speed/(2*spec.brake)+8)){
     const node=upcoming.edge.to,owner=this.reservations.get(node),p=upcoming.edge.b;
     if(Math.hypot(player.x-p.x,player.z-p.z)<10)stop(stopGap,'player priority');
     else if(owner&&owner.id!==a.id)stop(stopGap,'junction yield');
     else {
      const rank=(highway:string)=>({trunk:0,primary:1,secondary:2,tertiary:3} as Record<string,number>)[highway]??4;
      const majorApproach=this.agents.some(b=>b.id!==a.id&&rank(this.edges.get(b.edge)?.road.highway??'')<rank(edge.road.highway)&&this.upcoming(b)?.edge.to===node&&Math.hypot(b.x-p.x,b.z-p.z)<25);
      if(!owner&&majorApproach)stop(stopGap,'major-road priority');else this.reservations.set(node,{id:a.id,until:this.clock+4.5});
     }
    }
   }
   const forward={x:-Math.sin(a.heading),z:-Math.cos(a.heading)};
   for(const b of [...this.agents.filter(b=>b.id!==a.id).map(b=>({...b,length:TRAFFIC[b.kind].length,width:TRAFFIC[b.kind].width})),{...player,length:3,width:1.8}]){
    const dx=b.x-a.x,dz=b.z-a.z,ahead=dx*forward.x+dz*forward.z,lateral=Math.abs(dx*forward.z-dz*forward.x);
    if(ahead>0&&lateral<(spec.width+b.width)/2+.35)stop(ahead-(spec.length+b.length)/2-3-a.speed*.8,'following');
   }
   const speed=clamp(a.speed+clamp(target-a.speed,-spec.brake*dt,spec.accel*dt),0,spec.cruise),travel=Math.min(speed*dt,hardStop);
   let newEdge=edge,s=a.s+travel,turns=a.turns;
   for(let n=0;s>newEdge.length&&n<8;n++){const continuation=this.next({...a,edge:newEdge.id,turns},newEdge);if(!continuation){s=newEdge.length;break;}s-=newEdge.length;newEdge=continuation;turns++;}
   const point=lanePosition(newEdge,s,this.junctions),lookDistance=Math.max(1,spec.wheelbase*.8),lookNext=this.next({...a,edge:newEdge.id,turns},newEdge),look=lookNext&&newEdge.length-s<lookDistance?lanePosition(lookNext,Math.min(lookNext.length,lookDistance-(newEdge.length-s)),this.junctions):lanePosition(newEdge,Math.min(newEdge.length,s+lookDistance),this.junctions);
   const desired=Math.hypot(look.x-point.x,look.z-point.z)>.1?Math.atan2(-(look.x-point.x),-(look.z-point.z)):Math.atan2(-newEdge.dx,-newEdge.dz);
   const delta=clamp(angle(desired-a.heading),-Math.max(speed,.1)/spec.wheelbase*Math.tan(spec.majorOnly?.5:.65)*dt,Math.max(speed,.1)/spec.wheelbase*Math.tan(spec.majorOnly?.5:.65)*dt),heading=angle(a.heading+delta);
   const candidate={...a,...point,heading};let allowed=this.validPose(candidate)&&!this.overlaps(candidate,player,.2);
   // Submetre path checks stop tunnelling through footprint corners on a large frame.
   if(allowed&&travel>.25)for(let t=.25;t<travel;t+=.25){const p=lanePosition(edge,Math.min(edge.length,a.s+t),this.junctions);if(!this.validPose({...candidate,...p})){allowed=false;break;}}
   a.braking=!allowed||target<a.speed-.2;a.reason=allowed?reason:'obstacle';
   if(allowed){a.x=point.x;a.z=point.z;a.heading=heading;a.edge=newEdge.id;a.s=s;a.turns=turns;a.speed=travel<speed*dt?0:speed;a.steering=clamp(Math.atan(delta*spec.wheelbase/Math.max(travel,.01)),-.65,.65);a.distance+=travel;}else a.speed=0;
   a.stuck=a.speed<.1&&a.reason!=='signal'?a.stuck+dt:0;
  }
 }
 blocksPlayer(x:number,z:number,heading=0){return this.agents.some(a=>rectanglesOverlap({...a,...TRAFFIC[a.kind]},{x,z,heading,width:1.8,length:3},.05));}
}
