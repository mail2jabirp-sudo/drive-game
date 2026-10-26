import type { Controls } from './driving';
export class Input {
  private keys = new Set<string>();
  private pointers = new Map<number, string>();
  constructor(private action: (name: string) => void) {
    window.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName)) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) {
        if (e.code === 'KeyE') action('interact');
        if (e.code === 'KeyH') action('horn');
        if (e.code === 'KeyR') action('reset');
        if (e.code === 'Escape' || e.code === 'KeyP') action('pause');
      }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach(button => {
      button.addEventListener('pointerdown', e => {
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        const name = button.dataset.control!;
        this.pointers.set(e.pointerId, name);
        button.classList.add('pressed');
        if (name === 'horn') action('horn');
      });
      const release = (e: PointerEvent) => {
        this.pointers.delete(e.pointerId);
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', e => e.preventDefault());
    });
  }
  clear(): void {
    this.keys.clear();
    this.pointers.clear();
    document.querySelectorAll('.pressed').forEach(b => b.classList.remove('pressed'));
  }
  get controls(): Controls {
    const held = (name: string, ...codes: string[]) => [...this.pointers.values()].includes(name) || codes.some(c => this.keys.has(c));
    return {
      throttle: held('throttle', 'KeyW', 'ArrowUp'), brake: held('brake', 'KeyS', 'ArrowDown'),
      left: held('left', 'KeyA', 'ArrowLeft'), right: held('right', 'KeyD', 'ArrowRight'), handbrake: held('handbrake', 'Space'),
    };
  }
}
