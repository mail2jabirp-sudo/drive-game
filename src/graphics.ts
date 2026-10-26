export type GraphicsMode = 'auto' | 'low';
export const DISPLAY_KEY = 'en3d.display.v1';
export function parseGraphicsMode(raw: string | null): GraphicsMode {
  return raw === 'low' ? 'low' : 'auto';
}

/** One-way fallback per Auto session avoids visible resolution/shadow flicker. */
export class GraphicsBudget {
  private slowFrames = 0;
  private fallback = false;
  constructor(public mode: GraphicsMode) {}
  get lowDetail(): boolean { return this.mode === 'low' || this.fallback; }
  setMode(mode: GraphicsMode): void {
    this.mode = mode;
    this.slowFrames = 0;
    this.fallback = false;
  }
  observeFrame(seconds: number): boolean {
    const previous = this.lowDetail;
    if (!Number.isFinite(seconds) || seconds <= 0) return false;
    this.slowFrames = seconds > 0.075 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.mode === 'auto' && this.slowFrames > 8) this.fallback = true;
    return previous !== this.lowDetail;
  }
}
