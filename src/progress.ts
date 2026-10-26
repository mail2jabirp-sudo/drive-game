export const SAVE_KEY = 'kottakkal-drive.v1';
export const FARE = 120;
export type MissionPhase = 'pickup' | 'dropoff';
export interface Progress {
  version: 1;
  money: number;
  trips: number;
  teaBreaks: number;
  phase: MissionPhase;
  x: number;
  z: number;
  heading: number;
}
export const newProgress = (): Progress => ({ version: 1, money: 0, trips: 0, teaBreaks: 0, phase: 'pickup', x: 72, z: 36, heading: 0 });

/** Treat browser storage as untrusted input; a bad save must never break driving. */
export function parseProgress(raw: string | null): Progress {
  const fresh = newProgress();
  if (!raw) return fresh;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return fresh;
    const p = data as Partial<Progress>;
    if (p.version !== 1) return fresh;
    const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
    return {
      version: 1,
      money: finite(p.money) ? Math.max(0, Math.min(9999999, Math.floor(p.money))) : 0,
      trips: finite(p.trips) ? Math.max(0, Math.min(999999, Math.floor(p.trips))) : 0,
      teaBreaks: finite(p.teaBreaks) ? Math.max(0, Math.min(999999, Math.floor(p.teaBreaks))) : 0,
      phase: p.phase === 'dropoff' ? 'dropoff' : 'pickup',
      x: finite(p.x) && Math.abs(p.x) < 116 ? p.x : fresh.x,
      z: finite(p.z) && Math.abs(p.z) < 106 ? p.z : fresh.z,
      heading: finite(p.heading) ? p.heading % (Math.PI * 2) : 0,
    };
  } catch { return fresh; }
}

export function interactMission(progress: Progress, distance: number, speed: number): 'pickup' | 'dropoff' | null {
  if (distance > 8 || Math.abs(speed) >= 2) return null;
  if (progress.phase === 'pickup') {
    progress.phase = 'dropoff';
    return 'pickup';
  }
  progress.phase = 'pickup';
  progress.money += FARE;
  progress.trips += 1;
  return 'dropoff';
}
