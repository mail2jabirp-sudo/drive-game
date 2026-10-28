import type { MapPoint, OsmMap } from './osm-types';

export function projectCoordinate(latitude: number, longitude: number, projection: OsmMap['projection']): MapPoint {
  const radians = Math.PI / 180;
  return { x: projection.earthRadius * Math.cos(projection.latitude * radians) * (longitude - projection.longitude) * radians,
    z: -projection.earthRadius * (latitude - projection.latitude) * radians };
}
export function geographicCoordinate(point: MapPoint, projection: OsmMap['projection']): { latitude: number; longitude: number } {
  return { latitude: projection.latitude - point.z / projection.earthRadius * 180 / Math.PI,
    longitude: projection.longitude + point.x / (projection.earthRadius * Math.cos(projection.latitude * Math.PI / 180)) * 180 / Math.PI };
}

/** Reject misplaced/corrupt maps before creating a scene or touching ride progress. */
export function validateKottakkalMap(data: OsmMap): void {
  const fail = (reason: string): never => { throw new Error(`Invalid Kottakkal map: ${reason}`); };
  const p = data?.projection, b = data?.bounds;
  if (data?.version !== 1 || !p || !b || !/^[a-f0-9]{64}$/.test(data.source?.sha256 ?? '')) fail('missing source/projection');
  if (![p.latitude, p.longitude, p.earthRadius, b.minX, b.maxX, b.minZ, b.maxZ].every(Number.isFinite)
    || Math.abs(p.latitude - 11.001609) > 0.00001 || Math.abs(p.longitude - 76.00470916) > 0.00001 || p.earthRadius !== 6371008.8) fail('incorrect geographic origin or scale');
  if (!(b.minX < 0 && b.maxX > 0 && b.minZ < 0 && b.maxZ > 0) || Math.max(-b.minX, b.maxX, -b.minZ, b.maxZ) > 3000) fail('invalid local bounds');
  if (![data.roads, data.buildings, data.landmarks, data.water, data.intersections].every(Array.isArray) || !data.roads.length) fail('missing features');
  const checkPoint = (point: MapPoint) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z) || point.x < b.minX || point.x > b.maxX || point.z < b.minZ || point.z > b.maxZ) fail('feature outside local bounds');
  };
  const nodes = new Map<string, MapPoint>();
  const ids = new Set<string>();
  for (const road of data.roads) {
    if (!road.id || ids.has(road.id) || !Array.isArray(road.points) || !Array.isArray(road.nodeIds) || road.points.length < 2 || road.points.length !== road.nodeIds.length
      || !Number.isFinite(road.width) || road.width < 1 || road.width > 30 || !['no', 'yes', '-1'].includes(road.oneway)) fail('invalid road');
    ids.add(road.id);
    road.points.forEach((point, i) => {
      checkPoint(point);
      const id = road.nodeIds[i], previous = nodes.get(id);
      if (typeof id !== 'string' || !id || (previous && (previous.x !== point.x || previous.z !== point.z))) fail('inconsistent shared-node coordinates');
      nodes.set(id, point);
      if (id.startsWith('clip:') && Math.min(Math.abs(point.x - b.minX), Math.abs(point.x - b.maxX), Math.abs(point.z - b.minZ), Math.abs(point.z - b.maxZ)) > 0.002) fail('clipped endpoint away from boundary');
    });
  }
  for (const feature of [...data.buildings, ...data.water]) {
    if (!Array.isArray(feature.points) || feature.points.length < 2) fail('invalid footprint/water');
    feature.points.forEach(checkPoint);
  }
  for (const building of data.buildings) if (building.points.length < 3 || !Number.isFinite(building.height) || building.height <= 0) fail('invalid building height/footprint');
  data.landmarks.forEach(checkPoint);
  for (const junction of data.intersections) {
    checkPoint(junction);
    if (!Array.isArray(junction.roadIds) || junction.roadIds.length < 2 || junction.id.startsWith('clip:')) fail('invalid intersection');
    for (const id of junction.roadIds) {
      const road = data.roads.find(r => r.id === id), index = road?.nodeIds.indexOf(junction.id) ?? -1;
      if (!road || index < 0 || road.points[index].x !== junction.x || road.points[index].z !== junction.z) fail('intersection without matching shared source node');
    }
  }
  const anchor = data.landmarks.find(l => l.id === 'way/378587276' && l.kind === 'bus_station' && /kottakkal/i.test(l.name));
  if (!anchor || Math.hypot(anchor.x, anchor.z) > 1) fail('missing/displaced Kottakkal bus stand');
}
