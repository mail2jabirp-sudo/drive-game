import type { MapPoint, OsmMap, OsmRoad } from './osm-types';

export function segmentDistance(point: MapPoint, a: MapPoint, b: MapPoint): { distance: number; t: number; point: MapPoint } {
  const dx = b.x - a.x, dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  const t = length2 > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length2)) : 0;
  const projected = { x: a.x + t * dx, z: a.z + t * dz };
  return { distance: Math.hypot(point.x - projected.x, point.z - projected.z), t, point: projected };
}
export function pointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
export function nearestRoad(roads: OsmRoad[], point: MapPoint): { road: OsmRoad; segment: number; point: MapPoint; distance: number; heading: number } | null {
  let best: ReturnType<typeof nearestRoad> = null;
  for (const road of roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], match = segmentDistance(point, a, b);
    if (!best || match.distance < best.distance) {
      const sign = road.oneway === '-1' ? -1 : 1;
      best = { road, segment: i - 1, point: match.point, distance: match.distance, heading: Math.atan2(-(b.x - a.x) * sign, -(b.z - a.z) * sign) };
    }
  }
  return best;
}
export interface GraphEdge { to: string; distance: number; roadId: string }
export interface RoadGraph { points: Map<string, MapPoint>; edges: Map<string, GraphEdge[]> }
export function createRoadGraph(roads: OsmRoad[], reverse = false): RoadGraph {
  const points = new Map<string, MapPoint>(), edges = new Map<string, GraphEdge[]>();
  const edge = (a: string, b: string, distance: number, roadId: string) => {
    const from = reverse ? b : a, to = reverse ? a : b;
    const list = edges.get(from) ?? []; list.push({ to, distance, roadId }); edges.set(from, list);
  };
  for (const road of roads) for (let i = 0; i < road.nodeIds.length; i++) {
    const id = road.nodeIds[i]; points.set(id, road.points[i]);
    if (i === 0) continue;
    const before = road.nodeIds[i - 1], a = road.points[i - 1], b = road.points[i];
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    if (!Number.isFinite(distance) || distance <= 0) continue;
    if (road.oneway !== '-1') edge(before, id, distance, road.id);
    if (road.oneway !== 'yes') edge(id, before, distance, road.id);
  }
  return { points, edges };
}
export function shortestPaths(graph: RoadGraph, start: string): { distance: Map<string, number>; previous: Map<string, string> } {
  const distance = new Map<string, number>([[start, 0]]), previous = new Map<string, string>();
  const open = new Set<string>([start]);
  while (open.size) {
    let current = '', minimum = Infinity;
    for (const id of open) { const d = distance.get(id)!; if (d < minimum) { current = id; minimum = d; } }
    open.delete(current);
    for (const edge of graph.edges.get(current) ?? []) {
      const next = minimum + edge.distance;
      if (next < (distance.get(edge.to) ?? Infinity)) { distance.set(edge.to, next); previous.set(edge.to, current); open.add(edge.to); }
    }
  }
  return { distance, previous };
}

export function selectMissionStops(data: OsmMap): {
  spawn: MapPoint & { heading: number }; pickup: MapPoint; dropoff: MapPoint;
  pickupName: string; dropoffName: string; route: MapPoint[];
} {
  const busStand = data.landmarks.find(l => l.kind === 'bus_station' && /kottakkal/i.test(l.name)) ?? data.landmarks.find(l => l.kind === 'bus_station');
  const center = busStand ?? { x: 0, z: 0 };
  const primary = data.roads.filter(road => ['primary', 'secondary', 'tertiary'].includes(road.highway));
  const match = nearestRoad(primary.length ? primary : data.roads, center);
  if (!match) throw new Error('The selected OSM area has no usable road geometry.');
  const a = match.road.points[match.segment], b = match.road.points[match.segment + 1];
  const startIndex = Math.hypot(center.x - a.x, center.z - a.z) < Math.hypot(center.x - b.x, center.z - b.z) ? match.segment : match.segment + 1;
  const start = match.road.nodeIds[startIndex];
  const graph = createRoadGraph(data.roads), reverse = createRoadGraph(data.roads, true);
  const forward = shortestPaths(graph, start), back = shortestPaths(reverse, start);
  const startPoint = graph.points.get(start)!;
  const candidates = [...forward.distance].filter(([id, d]) => d >= 160 && d <= 450 && back.distance.has(id));
  if (!candidates.length) throw new Error('The selected road extract has no connected returnable passenger route.');
  const destinations = data.landmarks.filter(l => ['marketplace', 'hospital', 'police', 'bus_station'].includes(l.kind));
  let end = candidates[0][0], label = 'Town road stop', score = Infinity;
  for (const [id, distance] of candidates) {
    const point = graph.points.get(id)!;
    for (const landmark of destinations) {
      const separation = Math.hypot(point.x - landmark.x, point.z - landmark.z);
      const next = separation + Math.abs(distance - 270) * 0.14;
      if (next < score) {
        score = next; end = id;
        label = landmark.kind === 'marketplace' ? 'Market road stop' : landmark.kind === 'hospital' ? 'Hospital road stop' : landmark.kind === 'police' ? 'Police station road stop' : 'Bus stand road stop';
      }
    }
  }
  const endPoint = graph.points.get(end)!;
  const ids = [end]; while (ids[ids.length - 1] !== start) {
    const previous = forward.previous.get(ids[ids.length - 1]); if (!previous) break; ids.push(previous);
  }
  ids.reverse();
  const firstNext = graph.points.get(ids[1]) ?? b;
  const heading = Math.atan2(-(firstNext.x - startPoint.x), -(firstNext.z - startPoint.z));
  const lane = match.road.oneway === 'no' ? Math.min(1.3, match.road.width / 4) : 0;
  const pickup = { x: startPoint.x - Math.cos(heading) * lane, z: startPoint.z + Math.sin(heading) * lane };
  return { spawn: { ...pickup, heading }, pickup, dropoff: { ...endPoint }, pickupName: busStand ? 'Kottakkal bus stand road stop' : 'Town road stop', dropoffName: label, route: ids.map(id => graph.points.get(id)!) };
}
