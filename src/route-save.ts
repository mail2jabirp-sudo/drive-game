import type {FootSave} from './walking';
import type { Progress, MissionPhase } from './progress';
export const WORLD_KEY = 'en3d.world.v1';
export interface PracticePose { x: number; z: number; heading: number; phase: MissionPhase }
export interface OsmRide extends PracticePose { version: 1; mapId: string; missionOrigin?: {x:number;z:number} }
export function readOsmRide(raw: string | null, field: 'osmRide' | 'exportRide' = 'osmRide'): OsmRide | null {
  try {
    const p = JSON.parse(raw ?? 'null')?.[field];
    if (!p || p.version !== 1 || typeof p.mapId !== 'string' || !/^[a-f0-9]{64}$/.test(p.mapId)) return null;
    if (![p.x, p.z, p.heading].every(n => typeof n === 'number' && Number.isFinite(n))) return null;
    if (Math.abs(p.x) > 100000 || Math.abs(p.z) > 100000 || !['pickup', 'dropoff'].includes(p.phase)) return null;
    const origin=p.missionOrigin;
    const missionOrigin=origin&&[origin.x,origin.z].every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<100000)?{x:origin.x,z:origin.z}:undefined;
    return { ...(missionOrigin?{missionOrigin}:{}), version: 1, mapId: p.mapId, x: p.x, z: p.z, heading: p.heading % (2 * Math.PI), phase: p.phase };
  } catch { return null; }
}
/** One atomic localStorage value keeps wallet changes and both ride states together. */
export function serializeRouteProgress(progress: Progress, practicePose: PracticePose | null, osmRide: OsmRide | null, exportRide: OsmRide | null = null, onFoot:FootSave|null=null): string {
  return JSON.stringify({ ...(onFoot?{onFoot}:{}), ...progress, ...(practicePose ?? {}), ...(osmRide ? { osmRide } : {}), ...(exportRide ? {exportRide} : {}) });
}

/** Reproject an archived Kottakkal ride; its original save field remains untouched. */
export function districtRide(exportRide:OsmRide|null, oldRide:OsmRide|null, previousWorld:string|null,
  manifest:{source:{sha256:string};projection:{latitude:number;longitude:number;earthRadius:number};legacyProjection?:{latitude:number;longitude:number;earthRadius:number};legacySourceHash?:string}):OsmRide|null {
  if(exportRide?.mapId===manifest.source.sha256 && !(previousWorld==='osm'&&oldRide))return exportRide;
  if(oldRide && oldRide.mapId===manifest.legacySourceHash&&manifest.legacyProjection){
    const p=manifest.projection,o=manifest.legacyProjection;
    const lat=o.latitude-oldRide.z/o.earthRadius*180/Math.PI;
    const lon=o.longitude+oldRide.x/(o.earthRadius*Math.cos(o.latitude*Math.PI/180))*180/Math.PI;
    return {...oldRide,mapId:manifest.source.sha256,x:p.earthRadius*Math.cos(p.latitude*Math.PI/180)*(lon-p.longitude)*Math.PI/180,z:-p.earthRadius*(lat-p.latitude)*Math.PI/180};
  }
  return exportRide?.mapId===manifest.source.sha256?exportRide:null;
}
