import {TRAFFIC} from './traffic-types';
import type {TrafficAgent} from './traffic-types';
interface Voice {a:OscillatorNode;b:OscillatorNode;gain:GainNode;filter:BiquadFilterNode;panner:PannerNode;id:number;distance:number;braking:boolean;lastEffect:number;frequency:number}
/** Original MIT synthesis, not authentic vehicle recordings. Four pooled spatial engine voices. */
export class TrafficAudio{
 private voices:Voice[]=[];private noise:AudioBuffer;private clock=0;private transients=0;private analyser:AnalyserNode;
 constructor(private context:AudioContext,destination:AudioNode){const c=context;this.analyser=c.createAnalyser();this.analyser.fftSize=256;this.analyser.connect(destination);
  this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);let seed=2718;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
  for(let i=0;i<4;i++){const a=c.createOscillator(),b=c.createOscillator(),gain=c.createGain(),filter=c.createBiquadFilter(),panner=c.createPanner();a.type='sawtooth';b.type='triangle';a.frequency.value=25;b.frequency.value=50;gain.gain.value=0;filter.type='lowpass';filter.frequency.value=300;panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=5;panner.maxDistance=100;panner.rolloffFactor=1.5;a.connect(filter);b.connect(filter);filter.connect(gain).connect(panner).connect(this.analyser);a.start();b.start();this.voices.push({a,b,gain,filter,panner,id:-1,distance:0,braking:false,lastEffect:-100,frequency:0});}
 }
 update(agents:TrafficAgent[],camera:{x:number;y:number;z:number},forward:{x:number;y:number;z:number},active:boolean,dt:number){
  const c=this.context;this.clock+=dt;const near=active?agents.filter(a=>Math.hypot(a.x-camera.x,a.z-camera.z)<75).sort((a,b)=>Math.hypot(a.x-camera.x,a.z-camera.z)-Math.hypot(b.x-camera.x,b.z-camera.z)).slice(0,4):[];
  const assigned=new Set<number>();for(const voice of this.voices)if(near.some(a=>a.id===voice.id))assigned.add(voice.id);
  for(const voice of this.voices){let agent=near.find(a=>a.id===voice.id);if(!agent){agent=near.find(a=>!assigned.has(a.id));if(agent){assigned.add(agent.id);voice.id=agent.id;voice.distance=Math.hypot(agent.x-camera.x,agent.z-camera.z);voice.braking=false;}else voice.id=-1;}
   if(!agent){voice.gain.gain.setTargetAtTime(0,c.currentTime,.15);continue;}
   const s=TRAFFIC[agent.kind],distance=Math.hypot(agent.x-camera.x,agent.z-camera.z),radial=Math.max(-40,Math.min(40,(distance-voice.distance)/Math.max(.01,dt))),doppler=Math.max(.88,Math.min(1.12,343/(343+radial)));
   const gearSpan=s.majorOnly?5:7,rpm=s.idle+(agent.speed%gearSpan)*(s.majorOnly?2:4);voice.frequency=rpm*doppler;
   voice.a.frequency.setTargetAtTime(voice.frequency,c.currentTime,.12);voice.b.frequency.setTargetAtTime(voice.frequency*(agent.kind==='bike'?2.9:2.03),c.currentTime,.12);
   voice.filter.frequency.setTargetAtTime((s.majorOnly?170:agent.kind==='scooter'?480:280)+agent.speed*18,c.currentTime,.15);
   voice.gain.gain.setTargetAtTime((s.majorOnly?.026:.018)+Math.min(.012,agent.speed*.001)+Math.sin(this.clock*(s.majorOnly?23:38)+agent.id)*.002,c.currentTime,.12);
   voice.panner.positionX.setTargetAtTime(agent.x-camera.x,c.currentTime,.07);voice.panner.positionY.setTargetAtTime((agent.y??0)+.8-camera.y,c.currentTime,.07);voice.panner.positionZ.setTargetAtTime(agent.z-camera.z,c.currentTime,.07);
   if(agent.braking&&!voice.braking&&s.majorOnly&&distance<40&&this.clock-voice.lastEffect>3){this.effect(voice,true,s.horn);voice.lastEffect=this.clock;}
   else if(agent.reason==='following'&&agent.speed<.5&&distance<14&&this.clock-voice.lastEffect>12){this.effect(voice,false,s.horn);voice.lastEffect=this.clock;}
   voice.braking=agent.braking;voice.distance=distance;
  }
  for(const [parameter,value] of [[c.listener.forwardX,forward.x],[c.listener.forwardY,forward.y],[c.listener.forwardZ,forward.z]] as const)parameter.setTargetAtTime(value,c.currentTime,.08);
 }
 private effect(voice:Voice,air:boolean,frequency:number){if(this.transients>=4)return;const c=this.context,node=air?c.createBufferSource():c.createOscillator(),gain=c.createGain(),filter=c.createBiquadFilter();if(node instanceof AudioBufferSourceNode)node.buffer=this.noise;else{node.type='square';node.frequency.value=frequency;}filter.type='lowpass';filter.frequency.value=air?1300:900;gain.gain.setValueAtTime(.045,c.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.3);node.connect(filter).connect(gain).connect(voice.panner);this.transients++;node.onended=()=>{node.disconnect();filter.disconnect();gain.disconnect();this.transients--;};node.start();node.stop(c.currentTime+.3);}
 silence(){for(const v of this.voices)v.gain.gain.setTargetAtTime(0,this.context.currentTime,.08);}
 diagnostics(){const data=new Float32Array(256);this.analyser.getFloatTimeDomainData(data);return {pool:4,active:this.voices.filter(v=>v.id>=0).length,transients:this.transients,rms:Math.sqrt(data.reduce((s,v)=>s+v*v,0)/data.length),frequencies:this.voices.filter(v=>v.id>=0).map(v=>v.frequency)};}
}
