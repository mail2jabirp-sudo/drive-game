import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { OsmMap, OsmRoad, OsmBuilding } from '../src/osm-types.ts';
import { geographicCoordinate, projectCoordinate, validateKottakkalMap } from '../src/map-coordinates.ts';
import { buildRoadFoundation, buildingConflictsWithRoad, onRoadPatch, roadPaintSegments } from '../src/road-foundation.ts';
import { createRoadGraph, shortestPaths } from '../src/osm-navigation.ts';

const map: OsmMap = JSON.parse(readFileSync(new URL('../public/maps/kottakkal.json', import.meta.url), 'utf8'));
const road = (id: string, nodeIds: string[], points: { x: number; z: number }[]): OsmRoad => ({ ...map.roads[0], id, sourceWayId: id, nodeIds, points, width: 6, oneway: 'no' });

test('Kottakkal coordinate round-trips preserve source metres, axis orientation and bounded geographic extent', () => {
  validateKottakkalMap(map);
  for (const r of map.roads) for (const p of r.points) {
    const geo = geographicCoordinate(p, map.projection), back = projectCoordinate(geo.latitude, geo.longitude, map.projection);
    assert.ok(Math.hypot(p.x - back.x, p.z - back.z) < 1e-8);
    assert.ok(geo.latitude >= 10.99576 && geo.latitude <= 11.00746 && geo.longitude >= 75.99875 && geo.longitude <= 76.01067);
  }
  assert.ok(projectCoordinate(map.projection.latitude + .001, map.projection.longitude, map.projection).z < -111);
  assert.ok(projectCoordinate(map.projection.latitude, map.projection.longitude + .001, map.projection).x > 109);
});

test('runtime guard rejects wrong locations, inconsistent node positions, corrupt bounds and false intersections', () => {
  for (const change of [
    (m: OsmMap) => { m.projection.latitude = 10.85; },
    (m: OsmMap) => { m.projection.earthRadius = 1; },
    (m: OsmMap) => { m.landmarks = m.landmarks.filter(l => l.id !== 'way/378587276'); },
    (m: OsmMap) => { m.roads[0].points[0].x = 100000; },
    (m: OsmMap) => { m.roads[0].points[0].z = NaN; },
    (m: OsmMap) => { m.intersections[0].roadIds.push('nonexistent'); },
    (m: OsmMap) => { const n = m.intersections[0]; const r = m.roads.find(r => r.id === n.roadIds[0])!; r.points[r.nodeIds.indexOf(n.id)].x += .01; },
    (m: OsmMap) => { const r = m.roads.find(r => r.nodeIds.some(id => id.startsWith('clip:')))!; r.points[r.nodeIds.findIndex(id => id.startsWith('clip:'))] = { x: 0, z: 0 }; },
  ]) { const m = structuredClone(map); change(m); assert.throws(() => validateKottakkalMap(m), /Invalid Kottakkal map/); }
});

test('bevel joins retain all source centerlines, including short diagonals at clip boundaries', () => {
  const before = JSON.stringify(map), f = buildRoadFoundation(map);
  for (const r of map.roads) for (let i = 1; i < r.points.length; i++) for (const t of [0, .25, .5, .75, 1]) {
    const a = r.points[i - 1], b = r.points[i], point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    assert.ok(f.patches.some(p => onRoadPatch(point, p)), `${r.id} at ${i}:${t}`);
  }
  for (const patch of f.patches) for (const p of patch.points) assert.ok(Math.abs(p.x) <= 650 && Math.abs(p.z) <= 650);
  assert.equal(JSON.stringify(map), before, 'foundation generation must not alter any source data');
  assert.ok(f.ends.some(e => e.kind === 'boundary'));
  assert.ok(f.ends.some(e => e.kind === 'source-end'));
  assert.ok(f.ends.filter(e => e.kind === 'boundary').every(e => e.nodeId.startsWith('clip:')));
});

test('a T junction shares surface and routing; an overpass does not acquire a synthetic graph connection', () => {
  const a = road('main', ['a', 'j', 'b'], [{ x: -20, z: 0 }, { x: 0, z: 0 }, { x: 20, z: 0 }]);
  const b = road('side', ['j', 'c'], [{ x: 0, z: 0 }, { x: 0, z: 20 }]);
  const overpass = road('bridge', ['u', 'v'], [{ x: 10, z: -20 }, { x: 10, z: 20 }]); overpass.bridge = true; overpass.layer = 1;
  const f = buildRoadFoundation({ roads: [a, b, overpass], bounds: map.bounds });
  assert.ok(f.junctionRadii.has('j'));
  assert.equal(f.junctionRadii.has('u'), false);
  assert.ok(f.patches.some(p => p.kind === 'join' && p.roadIds.includes('main') && p.roadIds.includes('side')));
  assert.equal(shortestPaths(createRoadGraph([a, b, overpass]), 'a').distance.get('c'), 40);
  assert.equal(shortestPaths(createRoadGraph([a, b, overpass]), 'a').distance.has('u'), false);
  assert.ok(roadPaintSegments(b, f.junctionRadii).every(([p]) => p.z >= 6), 'guidance must stop before junction conflict area');
  assert.equal(f.patches.some(p => onRoadPatch({ x: 21, z: 0 }, p)), false, 'source ends have butt caps, not invented road extensions');
});

test('building conflict detection catches edge crossings and containment without moving valid footprints', () => {
  const patch = { kind: 'segment' as const, roadIds: ['r'], points: [{ x: -20, z: -1 }, { x: 20, z: -1 }, { x: 20, z: 1 }, { x: -20, z: 1 }] };
  const building = (points: OsmBuilding['points']): OsmBuilding => ({ ...map.buildings[0], points });
  assert.equal(buildingConflictsWithRoad(building([{ x: -2, z: -5 }, { x: 2, z: -5 }, { x: 2, z: 5 }, { x: -2, z: 5 }]), patch), true, 'edges cross even though neither polygon contains the other vertices');
  assert.equal(buildingConflictsWithRoad(building([{ x: 0, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 4 }, { x: 0, z: 4 }]), patch), false);
  assert.equal(buildingConflictsWithRoad(building([{ x: 0, z: -.5 }, { x: 2, z: -.5 }, { x: 2, z: .5 }, { x: 0, z: .5 }]), patch), true);
});
