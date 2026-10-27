import type {VehicleId} from './garage';
import {engineState} from './garage';
/** Original synthesized placeholders (MIT), NOT recordings of real vehicles. One engine voice, capped transients. */
export class GameAudio {
 private context?:AudioContext;private engine?:OscillatorNode;private harmonic?:OscillatorNode;private gain?:GainNode;
 private master?:GainNode;private panner?:PannerNode;private filter?:BiquadFilterNode;private analyser?:AnalyserNode;
 private noise?:AudioBuffer;private transientCount=0;private previousGear=1;private wasBraking=false;private lastClick=0;
 private id:VehicleId='passenger-auto';private level=0.65;private silent=false;
 get muted(){return this.silent;}set muted(value:boolean){this.silent=value;this.applyMaster();}
 get volume(){return this.level;}set volume(value:number){this.level=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0.65;this.applyMaster();}
 private applyMaster(){if(this.context&&this.master)this.master.gain.setTargetAtTime(this.silent?0:this.level,this.context.currentTime,0.08);}
 setVehicle(id:VehicleId){this.id=id;this.previousGear=1;if(this.context?.state==='running')this.ignition();}
 start(){
  try{
   this.context??=new AudioContext();const c=this.context;
   if(!this.engine){
    this.master=c.createGain();this.master.gain.value=this.silent?0:this.level;this.analyser=c.createAnalyser();this.analyser.fftSize=256;
    this.master.connect(this.analyser).connect(c.destination);
    this.panner=c.createPanner();this.panner.panningModel='HRTF';this.panner.distanceModel='inverse';this.panner.refDistance=4;this.panner.maxDistance=100;this.panner.rolloffFactor=1;
    this.panner.connect(this.master);this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=400;
    this.gain=c.createGain();this.gain.gain.value=0;this.filter.connect(this.gain).connect(this.panner);
    this.engine=c.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=this.id==='maruti800'?850/30:1100/60;this.engine.connect(this.filter);this.engine.start();
    this.harmonic=c.createOscillator();this.harmonic.type='triangle';this.harmonic.frequency.value=this.engine.frequency.value*2.03;this.harmonic.connect(this.filter);this.harmonic.start();
    this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);let seed=123;
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296)*2-1;}
    void c.resume().then(()=>this.ignition()).catch(()=>{});
   }else void c.resume().catch(()=>{});
  }catch{/* Audio denial does not prevent driving. */}
 }
 private ignition(){this.tone(this.id==='maruti800'?65:45,0.35,0.035,'sawtooth');this.tone(115,0.12,0.018,'triangle');}
 update(speed:number,active:boolean,options:{throttle?:boolean;braking?:boolean;indicator?:boolean;source?:[number,number,number];listenerForward?:[number,number,number]}={}){
  const c=this.context;if(!c||!this.engine||!this.harmonic||!this.gain)return;
  const state=engineState(this.id,speed,!!options.throttle),frequency=state.rpm/(this.id==='maruti800'?30:60);
  this.engine.frequency.setTargetAtTime(frequency,c.currentTime,0.13);this.harmonic.frequency.setTargetAtTime(frequency*2.03,c.currentTime,0.15);
  this.filter!.frequency.setTargetAtTime((this.id==='maruti800'?320:210)+state.rpm*0.06,c.currentTime,0.12);
  this.gain.gain.setTargetAtTime(active?0.016+(options.throttle?0.012:0)+Math.sin(c.currentTime*(this.id==='maruti800'?55:27))*0.002:0,c.currentTime,0.1);
  const p=options.source??[0,0,-8];this.panner!.positionX.setTargetAtTime(p[0],c.currentTime,0.05);this.panner!.positionY.setTargetAtTime(p[1],c.currentTime,0.05);this.panner!.positionZ.setTargetAtTime(p[2],c.currentTime,0.05);
  const forward=options.listenerForward??[0,0,-1],listener=c.listener;
  listener.forwardX.setTargetAtTime(forward[0],c.currentTime,0.05);listener.forwardY.setTargetAtTime(forward[1],c.currentTime,0.05);listener.forwardZ.setTargetAtTime(forward[2],c.currentTime,0.05);
  if(active){
   if(state.gear!==this.previousGear){this.tone(130,0.09,0.018,'triangle');this.previousGear=state.gear;}
   if(options.braking&&!this.wasBraking&&Math.abs(speed)>1)this.hiss(0.15,0.025);
   if(options.indicator&&c.currentTime-this.lastClick>0.48){this.lastClick=c.currentTime;this.tone(1100,0.025,0.025,'square');}
  }
  this.wasBraking=!!options.braking;
 }
 horn(){if(this.id==='maruti800'){this.tone(420,0.3,0.07,'triangle');this.tone(510,0.3,0.035,'square');}else for(const f of [370,465])this.tone(f,0.25,0.045,'square');}
 success(){this.tone(660,0.17,0.06,'sine');window.setTimeout(()=>this.tone(880,0.25,0.06,'sine'),140);}
 private tone(frequency:number,duration:number,volume:number,type:OscillatorType){
  const c=this.context;if(!c||!this.panner||this.silent||this.transientCount>=6)return;
  const node=c.createOscillator(),gain=c.createGain();node.type=type;node.frequency.value=frequency;
  gain.gain.setValueAtTime(0,c.currentTime);gain.gain.linearRampToValueAtTime(volume,c.currentTime+0.008);gain.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+duration);
  node.connect(gain).connect(this.panner);this.transientCount++;node.onended=()=>{node.disconnect();gain.disconnect();this.transientCount--;};node.start();node.stop(c.currentTime+duration);
 }
 private hiss(duration:number,volume:number){
  const c=this.context;if(!c||!this.noise||!this.panner||this.silent||this.transientCount>=6)return;
  const node=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter();node.buffer=this.noise;filter.type='bandpass';filter.frequency.value=1200;
  gain.gain.setValueAtTime(volume,c.currentTime);gain.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+duration);node.connect(filter).connect(gain).connect(this.panner);
  this.transientCount++;node.onended=()=>{node.disconnect();gain.disconnect();filter.disconnect();this.transientCount--;};node.start();node.stop(c.currentTime+duration);
 }
 /** Read-only diagnostics used by real browser audio tests; no extra sound sources are created. */
 diagnostics(){const values=new Float32Array(256);this.analyser?.getFloatTimeDomainData(values);return {state:this.context?.state??'uninitialized',vehicle:this.id,frequency:this.engine?.frequency.value??0,transients:this.transientCount,engineVoices:this.engine?1:0,rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),volume:this.level,muted:this.silent};}
}
