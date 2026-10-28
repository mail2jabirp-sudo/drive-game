import type { MapPoint, OsmBuilding, OsmMap, OsmRoad } from './osm-types';
import { pointInPolygon, segmentDistance } from './osm-navigation';
import { roadProfile } from './road-profile';

/** Pure X/Z presentation geometry. The active world retains main's terrain/layer datum. */
export interface RoadPatch { points: MapPoint[]; roadIds: string[]; kind: 'segment' | 'join' }
export interface RoadEnd { point: MapPoint; nodeId: string; roadId: string; kind: 'boundary' | 'source-end' }
export interface RoadFoundation { patches: RoadPatch[]; ends: RoadEnd[]; junctionRadii: Map<string, number> }

const cross = (a: MapPoint, b: MapPoint, c: MapPoint) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
function hull(points: MapPoint[]): MapPoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z).filter((p, i, a) => i === 0 || p.x !== a[i - 1].x || p.z !== a[i - 1].z);
  const half = (items: MapPoint[]) => {
    const result: MapPoint[] = [];
    for (const p of items) { while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], p) <= 1e-9) result.pop(); result.push(p); }
    return result;
  };
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
}

/** Segment rectangles plus bounded bevel joins, keyed only by actual source IDs.
 * Same datum and world-space UVs make overlapping junction patches visually identical.
 * No guessed snapping/extension, round caps, or synthetic connections at overpasses.
 */
export function buildRoadFoundation(data: Pick<OsmMap, 'roads' | 'bounds'>): RoadFoundation {
  const patches: RoadPatch[] = [], ends: RoadEnd[] = [], junctionRadii = new Map<string, number>();
  const nodes = new Map<string, { point: MapPoint; corners: MapPoint[]; roads: Set<string>; neighbors: Set<string>; width: number }>();
  // Clip edges, not individual corners: corner clamping can cut a short diagonal
  // road off its own centerline close to the excerpt boundary.
  const clip = (polygon: MapPoint[]): MapPoint[] => {
    let result = polygon;
    for (const [axis, limit, sign] of [['x', data.bounds.minX, 1], ['x', data.bounds.maxX, -1], ['z', data.bounds.minZ, 1], ['z', data.bounds.maxZ, -1]] as const) {
      const input = result; result = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i], b = input[(i + 1) % input.length], insideA = (a[axis] - limit) * sign >= 0, insideB = (b[axis] - limit) * sign >= 0;
        if (insideA) result.push(a);
        if (insideA !== insideB) {
          const t = (limit - a[axis]) / (b[axis] - a[axis]);
          result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, [axis]: limit });
        }
      }
    }
    return result;
  };
  for (const road of data.roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-6) continue;
    const ox = -(b.z - a.z) / length * road.width / 2, oz = (b.x - a.x) / length * road.width / 2;
    const corners = [{ x: a.x + ox, z: a.z + oz }, { x: b.x + ox, z: b.z + oz }, { x: b.x - ox, z: b.z - oz }, { x: a.x - ox, z: a.z - oz }];
    patches.push({ points: clip(corners), roadIds: [road.id], kind: 'segment' });
    for (const [index, c1, c2, neighbor] of [[i - 1, 0, 3, i], [i, 1, 2, i - 1]]) {
      const id = road.nodeIds[index], point = road.points[index];
      const n = nodes.get(id) ?? { point, corners: [], roads: new Set<string>(), neighbors: new Set<string>(), width: 0 };
      n.corners.push(corners[c1], corners[c2]); n.roads.add(road.id); n.neighbors.add(road.nodeIds[neighbor]); n.width = Math.max(n.width, road.width);
      nodes.set(id, n);
    }
  }
  for (const [id, node] of nodes) {
    const points = clip(hull(node.corners));
    if (node.neighbors.size > 1 && points.length >= 3) patches.push({ points, roadIds: [...node.roads], kind: 'join' });
    if (node.roads.size > 1) junctionRadii.set(id, node.width);
    if (node.neighbors.size === 1) ends.push({ point: node.point, nodeId: id, roadId: [...node.roads][0], kind: id.startsWith('clip:') ? 'boundary' : 'source-end' });
  }
  return { patches, ends, junctionRadii };
}

export function onRoadPatch(point: MapPoint, patch: RoadPatch, margin = 0): boolean {
  return pointInPolygon(point, patch.points) || patch.points.some((a, i) => segmentDistance(point, a, patch.points[(i + 1) % patch.points.length]).distance <= margin + 1e-7);
}
function segmentsMeet(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint): boolean {
  const ab1 = cross(a, b, c), ab2 = cross(a, b, d), cd1 = cross(c, d, a), cd2 = cross(c, d, b);
  if (ab1 * ab2 < 0 && cd1 * cd2 < 0) return true;
  return segmentDistance(a, c, d).distance < 0.03 || segmentDistance(b, c, d).distance < 0.03 || segmentDistance(c, a, b).distance < 0.03 || segmentDistance(d, a, b).distance < 0.03;
}

/** Suppress only conflicting approximate visual models, never edit source footprints.
 * Checking edges as well as vertices catches narrow road corridors cutting a building.
 */
export function buildingConflictsWithRoad(building: Pick<OsmBuilding, 'points'>, patch: RoadPatch): boolean {
  const a = building.points, b = patch.points;
  if (a.some(p => onRoadPatch(p, patch, 0.03)) || b.some(p => pointInPolygon(p, a))) return true;
  return a.some((p, i) => b.some((q, j) => segmentsMeet(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length])));
}

export function roadPaintSegments(road: OsmRoad, junctionRadii: Map<string, number>): Array<[MapPoint, MapPoint]> {
  const segments: Array<[MapPoint, MapPoint]> = [];
  if (!roadProfile(road).centerMarking) return segments;
  let distance = 0;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (!length) continue;
    const startClearance = junctionRadii.get(road.nodeIds[i - 1]) ?? 0, endClearance = junctionRadii.get(road.nodeIds[i]) ?? 0;
    for (let offset = Math.ceil((distance - 2) / 8) * 8 + 2 - distance; offset + 2.5 < length; offset += 8) {
      if (offset < Math.max(0, startClearance) || offset + 2.5 > length - endClearance) continue;
      const at = (d: number) => ({ x: a.x + (b.x - a.x) * d / length, z: a.z + (b.z - a.z) * d / length });
      segments.push([at(offset), at(offset + 2.5)]);
    }
    distance += length;
  }
  return segments;
}
