/** Synthesized locally. Audio starts only after a user gesture. */
export class GameAudio {
  private context?: AudioContext;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  muted = false;
  start(): void {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
      if (!this.engine) {
        this.engine = this.context.createOscillator();
        this.engine.type = 'sawtooth';
        this.engineGain = this.context.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 210;
        this.engine.connect(filter).connect(this.engineGain).connect(this.context.destination);
        this.engine.start();
      }
    } catch { /* Unsupported or denied audio does not prevent play. */ }
  }
  update(speed: number, active: boolean): void {
    if (!this.context || !this.engine || !this.engineGain) return;
    this.engine.frequency.setTargetAtTime(35 + Math.abs(speed) * 3, this.context.currentTime, 0.12);
    this.engineGain.gain.setTargetAtTime(active && !this.muted ? 0.018 : 0, this.context.currentTime, 0.1);
  }
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
    if (!this.context || this.muted) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(); oscillator.stop(this.context.currentTime + duration);
  }
}
