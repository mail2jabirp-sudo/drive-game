import {TrafficAudio} from './traffic-audio';
import type {TrafficAgent} from './traffic-types';
/** Synthesized locally. Audio starts only after a user gesture. */
export class GameAudio {
  private context?: AudioContext;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private master?:GainNode;private analyser?:AnalyserNode;private traffic?:TrafficAudio;
  private transients=0;
  volume=0.65;
  muted = false;
  start(): void {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
      if (!this.engine) {
        this.master=this.context.createGain();this.master.gain.value=this.muted?0:this.volume;this.analyser=this.context.createAnalyser();this.analyser.fftSize=256;this.master.connect(this.analyser).connect(this.context.destination);
        this.traffic=new TrafficAudio(this.context,this.master);
        this.engine = this.context.createOscillator();
        this.engine.type = 'sawtooth';
        this.engineGain = this.context.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 210;
        this.engine.connect(filter).connect(this.engineGain).connect(this.master!);
        this.engine.start();
      }
    } catch { /* Unsupported or denied audio does not prevent play. */ }
  }
  update(speed: number, active: boolean): void {
    if (!this.context || !this.engine || !this.engineGain) return;
    this.master?.gain.setTargetAtTime(this.muted?0:this.volume,this.context.currentTime,.08);
    this.engine.frequency.setTargetAtTime(35 + Math.abs(speed) * 3, this.context.currentTime, 0.12);
    this.engineGain.gain.setTargetAtTime(active && !this.muted ? 0.018 : 0, this.context.currentTime, 0.1);
  }
  updateTraffic(agents:TrafficAgent[],camera:{x:number;y:number;z:number},forward:{x:number;y:number;z:number},active:boolean,dt:number){this.traffic?.update(agents,camera,forward,active,dt);}
  silence(){if(this.context){this.engineGain?.gain.setTargetAtTime(0,this.context.currentTime,.08);this.traffic?.silence();}}
  diagnostics(){const data=new Float32Array(256);this.analyser?.getFloatTimeDomainData(data);return {state:this.context?.state??'uninitialized',rms:Math.sqrt(data.reduce((s,v)=>s+v*v,0)/data.length),traffic:this.traffic?.diagnostics()??null};}
  horn(): void {
    if (!this.context || this.muted) return;
    for (const frequency of [370, 465]) this.tone(frequency, 0.25, 0.045, 'square');
  }
  success(): void {
    if (!this.context || this.muted) return;
    this.tone(660, 0.17, 0.08, 'sine');
    window.setTimeout(() => this.tone(880, 0.25, 0.08, 'sine'), 140);
  }
  private tone(frequency: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.context || this.muted || this.transients>=6) return;
    this.transients++;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.master!);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.transients--;};
    oscillator.start(); oscillator.stop(this.context.currentTime + duration);
  }
}
