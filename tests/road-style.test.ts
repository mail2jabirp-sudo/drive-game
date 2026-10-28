import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { OsmMap, OsmRoad } from '../src/osm-types.ts';
import { CLASS_WIDTHS, roadProfile } from '../src/road-profile.ts';
import { buildRoadFoundation, buildingConflictsWithRoad, onRoadPatch, roadPaintSegments } from '../src/road-foundation.ts';
import { buildRoadDressing } from '../src/road-dressing.ts';
import { createKeralaRoadMaterials } from '../src/road-materials.ts';
import * as THREE from 'three';

const map: OsmMap = JSON.parse(readFileSync(new URL('../public/maps/kottakkal.json', import.meta.url), 'utf8'));
const fixture = (patch: Partial<OsmRoad>): OsmRoad => ({ ...map.roads[0], oneway: 'no', bridge: false, ...patch });

test('class widths retain tagged/lane estimates and narrow or single-lane roads never get center markings', () => {
  for (const road of map.roads) {
    assert.equal(roadProfile(road).width, road.width);
    if (road.widthSource === 'estimate') assert.equal(road.width, CLASS_WIDTHS[road.highway] ?? 5);
    if (['residential', 'living_street', 'unclassified', 'service'].includes(road.highway) || road.width < 6) {
      assert.equal(roadPaintSegments(road, new Map()).length, 0);
    }
  }
  assert.equal(roadProfile(fixture({ width: 3.2, highway: 'tertiary', tags: { lanes: '1' } })).centerMarking, false);
  assert.equal(roadProfile(fixture({ width: 7, highway: 'secondary', tags: { lanes: '1' } })).centerMarking, false);
  assert.equal(roadProfile(fixture({ width: 7, highway: 'secondary', tags: {} })).centerMarking, true);
  assert.equal(roadProfile(fixture({ width: 6.4, widthSource: 'lanes', tags: { lanes: '2' } })).width, 6.4);
  assert.equal(roadProfile(fixture({ width: 5.8, widthSource: 'tag', tags: { width: '5.8' } })).width, 5.8);
  assert.equal(roadProfile(fixture({ oneway: 'yes' })).centerMarking, false);
});

test('source surface tags drive variation while bridge/tunnel roads do not acquire invented shoulders or drains', () => {
  assert.equal(roadProfile(fixture({ tags: { surface: 'concrete' } })).surface, 'concrete');
  assert.equal(roadProfile(fixture({ tags: { surface: 'gravel' } })).surface, 'gravel');
  assert.equal(roadProfile(fixture({ tags: { surface: 'gravel' } })).centerMarking, false);
  assert.equal(roadProfile(fixture({ tags: { surface: 'tartan' } })).surface, 'asphalt', 'unsupported surface uses disclosed neutral fallback');
  for (const road of [fixture({ bridge: true }), fixture({ tags: { tunnel: 'yes' } })]) {
    assert.equal(roadProfile(road).shoulder, 0); assert.equal(roadProfile(road).drainage, false);
  }
});

test('all dressing stays within bounds and avoids source buildings, roads, and water where required', () => {
  const before = JSON.stringify(map), foundation = buildRoadFoundation(map), dressing = buildRoadDressing(map, foundation);
  const bbox = (p: { points: { x: number; z: number }[] }) => ({ minX: Math.min(...p.points.map(p => p.x)), maxX: Math.max(...p.points.map(p => p.x)), minZ: Math.min(...p.points.map(p => p.z)), maxZ: Math.max(...p.points.map(p => p.z)) });
  const intersect = (a: ReturnType<typeof bbox>, b: ReturnType<typeof bbox>) => a.minX <= b.maxX + .04 && a.maxX >= b.minX - .04 && a.minZ <= b.maxZ + .04 && a.maxZ >= b.minZ - .04;
  const exclusions = [...map.buildings, ...map.water.filter(w => w.kind === 'area')].map(p => ({ polygon: p, box: bbox(p) }));
  const roadBoxes = foundation.patches.map(p => ({ polygon: p, box: bbox(p) }));
  assert.ok(dressing.shoulders.length > 500 && dressing.shoulders.length <= foundation.patches.length);
  assert.ok(dressing.details.some(d => d.kind === 'drain-channel') && dressing.details.some(d => d.kind === 'repair'));
  for (const patch of [...dressing.shoulders, ...dressing.details.map(p => ({ ...p, roadIds: [p.roadId], kind: 'segment' as const }))]) {
    for (const point of patch.points) assert.ok(Math.abs(point.x) <= 650 && Math.abs(point.z) <= 650);
    const b = bbox(patch);
    for (const exclusion of exclusions.filter(e => intersect(b, e.box))) assert.equal(buildingConflictsWithRoad(exclusion.polygon, patch), false);
  }
  for (const detail of dressing.details) {
    const b = bbox(detail), near = roadBoxes.filter(r => intersect(b, r.box));
    if (detail.kind === 'repair') assert.ok(detail.points.every(p => near.some(r => onRoadPatch(p, r.polygon))));
    else for (const road of near) assert.equal(buildingConflictsWithRoad(detail, road.polygon), false, 'drainage must not cross the carriageway or junction');
  }
  assert.equal(JSON.stringify(map), before);
  assert.deepEqual(dressing, buildRoadDressing(map, foundation), 'decoration must be deterministic across reloads');
});

function withCanvas<T>(run: () => T): T {
  const previous = globalThis.document;
  const context = new Proxy({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(target, key) { return key in target ? target[key as keyof typeof target] : () => {}; }, set() { return true; } });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  try { return run(); } finally { if (previous === undefined) delete (globalThis as { document?: Document }).document; else globalThis.document = previous; }
}

test('road materials share just two small mipmapped textures with explicit depth ordering', () => withCanvas(() => {
  const materials = createKeralaRoadMaterials(), maps = new Set<THREE.Texture>();
  for (const material of Object.values(materials)) {
    for (const map of [material.map, material.bumpMap, material.roughnessMap]) if (map) maps.add(map);
    assert.equal(material.map, materials.asphalt.map);
    assert.equal(material.bumpMap, material.roughnessMap);
    assert.equal(material.polygonOffset, true); assert.equal(material.transparent, false);
  }
  assert.equal(maps.size, 2);
  assert.equal(materials.asphalt.map!.image.width, 256);
  assert.equal(materials.asphalt.bumpMap!.image.width, 128);
  assert.ok(materials.asphalt.polygonOffsetUnits < materials.shoulder.polygonOffsetUnits);
  assert.ok(materials.detail.polygonOffsetUnits < materials.asphalt.polygonOffsetUnits);
  maps.forEach(m => m.dispose()); Object.values(materials).forEach(m => m.dispose());
}));
