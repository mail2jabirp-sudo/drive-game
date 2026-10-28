import type { MapPoint, OsmMap } from './osm-types';
import { buildRoadFoundation, buildingConflictsWithRoad, onRoadPatch } from './road-foundation';
import type { RoadFoundation, RoadPatch } from './road-foundation';
import { roadProfile } from './road-profile';
import { segmentDistance } from './osm-navigation';

export interface RoadDetail { points: MapPoint[]; color: string; kind: 'drain-rim' | 'drain-channel' | 'cover' | 'repair'; roadId: string }
type Polygon = { points: MapPoint[] };
const bounds = (p: Polygon) => ({ minX: Math.min(...p.points.map(p => p.x)), maxX: Math.max(...p.points.map(p => p.x)), minZ: Math.min(...p.points.map(p => p.z)), maxZ: Math.max(...p.points.map(p => p.z)) });
function spatialIndex<T extends Polygon>(polygons: T[]) {
  const cells = new Map<string, T[]>();
  const keys = (p: Polygon) => {
    const b = bounds(p), result: string[] = [];
    for (let x = Math.floor((b.minX - .04) / 32); x <= Math.floor((b.maxX + .04) / 32); x++) for (let z = Math.floor((b.minZ - .04) / 32); z <= Math.floor((b.maxZ + .04) / 32); z++) result.push(`${x},${z}`);
    return result;
  };
  for (const polygon of polygons) for (const key of keys(polygon)) { const cell = cells.get(key) ?? []; cell.push(polygon); cells.set(key, cell); }
  return (polygon: Polygon) => new Set(keys(polygon).flatMap(key => cells.get(key) ?? []));
}

export function buildRoadDressing(data: OsmMap, foundation: RoadFoundation): { shoulders: RoadPatch[]; details: RoadDetail[] } {
  const profiles = new Map(data.roads.map(r => [r.id, roadProfile(r)]));
  const quad = (a: MapPoint, b: MapPoint, inner: number, outer: number, side: number): MapPoint[] => {
    const length = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / length * side, nz = (b.x - a.x) / length * side;
    return [{ x: a.x + nx * inner, z: a.z + nz * inner }, { x: b.x + nx * inner, z: b.z + nz * inner },
      { x: b.x + nx * outer, z: b.z + nz * outer }, { x: a.x + nx * outer, z: a.z + nz * outer }];
  };
  const exclusions: Polygon[] = [...data.buildings, ...data.water.filter(w => w.kind === 'area')];
  for (const water of data.water.filter(w => w.kind === 'stream')) for (let i = 1; i < water.points.length; i++) {
    const a = water.points[i - 1], b = water.points[i];
    if (Math.hypot(a.x - b.x, a.z - b.z) > 1e-6) exclusions.push({ points: quad(a, b, -(water.width ?? 2) / 2 - .6, (water.width ?? 2) / 2 + .6, 1) });
  }
  const nearbyExclusions = spatialIndex(exclusions), nearbyRoads = spatialIndex(foundation.patches);
  const clear = (p: Polygon) => {
    if (p.points.some(p => p.x < data.bounds.minX || p.x > data.bounds.maxX || p.z < data.bounds.minZ || p.z > data.bounds.maxZ)) return false;
    return ![...nearbyExclusions(p)].some(e => buildingConflictsWithRoad(e, { points: p.points, roadIds: [], kind: 'segment' }));
  };
  // Render this expanded band BELOW the unchanged carriageway. Shared bevels
  // provide continuous shoulders without widening the drivable road or graph.
  const expanded = buildRoadFoundation({ bounds: data.bounds, roads: data.roads.map(r => ({ ...r, width: r.width + profiles.get(r.id)!.shoulder * 2 })) });
  const shoulders = expanded.patches.filter(p => p.roadIds.every(id => profiles.get(id)!.shoulder > 0) && clear(p));
  const nearbyShoulders = spatialIndex(shoulders);
  const details: RoadDetail[] = [];
  const outsideRoad = (p: Polygon) => ![...nearbyRoads(p)].some(r => buildingConflictsWithRoad(p, r));
  const onShoulder = (p: Polygon) => p.points.every(point => [...nearbyShoulders({ points: [point] })].some(s => onRoadPatch(point, s)));
  for (const road of data.roads) {
    const profile = profiles.get(road.id)!;
    let repairs = 0;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 6) continue;
      const at = (d: number) => ({ x: a.x + (b.x - a.x) * d / length, z: a.z + (b.z - a.z) * d / length });
      const start = Math.max(1.5, foundation.junctionRadii.get(road.nodeIds[i - 1]) ?? 0);
      const end = Math.min(length - 1.5, length - (foundation.junctionRadii.get(road.nodeIds[i]) ?? 0));
      if (end - start < 3) continue;
      const seed = [...road.id].reduce((n, c) => n + c.charCodeAt(0), i * 17);
      if (profile.surface === 'asphalt' && repairs < 2 && seed % 7 === 0) {
        const p = quad(at(start + .5), at(Math.min(start + 2.5, end)), -.22 * road.width, .12 * road.width, 1);
        if (clear({ points: p })) { details.push({ points: p, color: '#69716b', kind: 'repair', roadId: road.id }); repairs++; }
      }
      if (!profile.drainage) continue;
      // Authored visual drainage only where source building context suggests a
      // built-up roadside. Never claim mapped drains or add physical trenches.
      for (const side of [-1, 1]) {
        const p = quad(at(start), at(Math.min(end, start + 14)), road.width / 2 + .08, road.width / 2 + .38, side);
        const polygon = { points: p };
        if (!clear(polygon) || !outsideRoad(polygon) || !onShoulder(polygon)) continue;
        const nearBuildings = data.buildings.some(building => building.points.some(point => segmentDistance(point, p[0], p[1]).distance < 22));
        if (!nearBuildings) continue;
        details.push({ points: p, color: '#aaa594', kind: 'drain-rim', roadId: road.id });
        const channel = quad(at(start + .1), at(Math.min(end - .1, start + 13.9)), road.width / 2 + .16, road.width / 2 + .30, side);
        details.push({ points: channel, color: '#535a4d', kind: 'drain-channel', roadId: road.id });
        if (seed % 3 === 0) {
          const cover = quad(at(start + .4), at(start + 1.1), road.width / 2 + .08, road.width / 2 + .38, side);
          details.push({ points: cover, color: '#8d9081', kind: 'cover', roadId: road.id });
        }
      }
    }
  }
  return { shoulders, details };
}
