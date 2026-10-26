import type { Progress, MissionPhase } from './progress';
export const WORLD_KEY = 'en3d.world.v1';
export interface PracticePose { x: number; z: number; heading: number; phase: MissionPhase }
export interface OsmRide extends PracticePose { version: 1; mapId: string }
export function readOsmRide(raw: string | null): OsmRide | null {
  try {
    const p = JSON.parse(raw ?? 'null')?.osmRide;
    if (!p || p.version !== 1 || typeof p.mapId !== 'string' || !/^[a-f0-9]{64}$/.test(p.mapId)) return null;
    if (![p.x, p.z, p.heading].every(n => typeof n === 'number' && Number.isFinite(n))) return null;
    if (Math.abs(p.x) > 10000 || Math.abs(p.z) > 10000 || !['pickup', 'dropoff'].includes(p.phase)) return null;
    return { version: 1, mapId: p.mapId, x: p.x, z: p.z, heading: p.heading % (2 * Math.PI), phase: p.phase };
  } catch { return null; }
}
/** One atomic localStorage value keeps wallet changes and both ride states together. */
export function serializeRouteProgress(progress: Progress, practicePose: PracticePose | null, osmRide: OsmRide | null): string {
  return JSON.stringify({ ...progress, ...(practicePose ?? {}), ...(osmRide ? { osmRide } : {}) });
}
