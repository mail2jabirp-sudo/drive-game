import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTownMaterials } from './materials';
import type { MapPoint, OsmMap } from './osm-types';
import { nearestRoad, pointInPolygon, segmentDistance, selectMissionStops } from './osm-navigation';
import type { Collider } from './world';
import { buildRoadFoundation, buildingConflictsWithRoad, onRoadPatch, roadPaintSegments, MAP_GROUND_Y, ROAD_SURFACE_Y, ROAD_PAINT_Y } from './road-foundation';
import type { RoadPatch } from './road-foundation';
import { roadProfile } from './road-profile';
import { createKeralaRoadMaterials } from './road-materials';
import { buildRoadDressing } from './road-dressing';

/** Render a bounded source-data slice, not a fabricated road network or surveyed building model. */
export function createOsmWorld(scene: THREE.Scene, data: OsmMap): {
  colliders: Collider[];
  update: (elapsed: number, cameraPosition: THREE.Vector3, lowDetail?: boolean) => void;
  dispose: () => void;
  roadSurface: (x: number, z: number) => boolean;
  isBlocked: (x: number, z: number, radius?: number) => boolean;
  spawn: MapPoint & { heading: number };
  pickup: MapPoint;
  dropoff: MapPoint;
  tea: MapPoint | null;
  mission: { pickupName: string; dropoffName: string; route: MapPoint[] };
  chunkCount: number;
  foundationStats: { roadPatches: number; joins: number; boundaryEnds: number; sourceEnds: number; omittedBuildingIds: string[] };
  roadStyleStats: Record<string, number>;
} {
  const root = new THREE.Group(); root.name = 'OSM Kottakkal source geometry'; scene.add(root);
  const townMaterial = createTownMaterials();
  const roadMaterials = createKeralaRoadMaterials();
  const asphalt = roadMaterials.asphalt;
  const roadSurfaceMaterials = new Set([asphalt, roadMaterials.concrete, roadMaterials.gravel]);
  const channelMaterial = roadMaterials.detail.clone(); channelMaterial.polygonOffsetUnits = -18;
  const coverMaterial = roadMaterials.detail.clone(); coverMaterial.polygonOffsetUnits = -20;
  // Keep the physical datum flush while biasing only depth testing. Millimetre
  // separation alone loses precision in the overhead/mobile camera's depth buffer.
  asphalt.polygonOffset = true; asphalt.polygonOffsetFactor = -1;
  const wall = townMaterial('#c2c8ae'); wall.vertexColors = true;
  const roof = new THREE.MeshStandardMaterial({ color: '#9b9687', roughness: 0.98, vertexColors: true });
  const windows = new THREE.MeshStandardMaterial({ color: '#526963', roughness: 0.42, metalness: 0.1, side: THREE.DoubleSide });
  const roadPaint = new THREE.MeshStandardMaterial({ color: '#d2ccaf', roughness: 1 });
  roadPaint.polygonOffset = true; roadPaint.polygonOffsetFactor = -1; roadPaint.polygonOffsetUnits = -24;
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#708e85', roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide });
  waterMaterial.polygonOffset = true; waterMaterial.polygonOffsetFactor = -0.5; waterMaterial.polygonOffsetUnits = -1;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(data.bounds.maxX - data.bounds.minX + 20, data.bounds.maxZ - data.bounds.minZ + 20), townMaterial('#9cb57c'));
  ground.rotation.x = -Math.PI / 2; ground.position.set((data.bounds.minX + data.bounds.maxX) / 2, MAP_GROUND_Y, (data.bounds.minZ + data.bounds.maxZ) / 2);
  const groundUv = ground.geometry.getAttribute('uv');
  for (let i=0;i<groundUv.count;i++) groundUv.setXY(i,groundUv.getX(i)*(data.bounds.maxX-data.bounds.minX)/4,groundUv.getY(i)*(data.bounds.maxZ-data.bounds.minZ)/4);
  ground.receiveShadow = true; root.add(ground);
  interface Batch { geometries: THREE.BufferGeometry[]; material: THREE.Material; detail: boolean }
  interface Chunk { group: THREE.Group; x: number; z: number; batches: Map<string, Batch>; radius: number; detail: THREE.Mesh[] }
  const chunks = new Map<string, Chunk>();
  const size = 160;
  const chunkAt = (x: number, z: number): Chunk => {
    const ix = Math.floor(x / size), iz = Math.floor(z / size), key = `${ix},${iz}`;
    let chunk = chunks.get(key);
    if (!chunk) {
      const group = new THREE.Group(); group.name = `OSM chunk ${key}`; root.add(group);
      chunk = { group, x: (ix + 0.5) * size, z: (iz + 0.5) * size, batches: new Map(), radius: 0, detail: [] }; chunks.set(key, chunk);
    }
    return chunk;
  };
  function addGeometry(geometry: THREE.BufferGeometry, material: THREE.Material, point: MapPoint, detail = false, tint?: THREE.Color): void {
    const chunk = chunkAt(point.x, point.z);
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geometry !== plain) geometry.dispose();
    if (!plain.getAttribute('normal')) plain.computeVertexNormals();
    if (!plain.getAttribute('uv')) plain.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(plain.getAttribute('position').count * 2).fill(0), 2));
    if (tint) {
      const colors: number[] = [];
      for (let i = 0; i < plain.getAttribute('position').count; i++) colors.push(tint.r, tint.g, tint.b);
      plain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    plain.computeBoundingBox();
    const bounds = plain.boundingBox!;
    chunk.radius = Math.max(chunk.radius, Math.hypot(bounds.min.x - chunk.x, bounds.min.z - chunk.z), Math.hypot(bounds.max.x - chunk.x, bounds.max.z - chunk.z));
    const key = material.uuid + (detail ? 'detail' : 'base');
    const batch = chunk.batches.get(key) ?? { geometries: [], material, detail };
    batch.geometries.push(plain); chunk.batches.set(key, batch);
  }
  function flatShape(points: MapPoint[], height: number): THREE.BufferGeometry {
    const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, -p.z)));
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, height, 0); return geometry;
  }
  function lineQuad(a: MapPoint, b: MapPoint, width: number, height: number): THREE.BufferGeometry {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1;
    const ox = -dz / length * width / 2, oz = dx / length * width / 2;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      a.x + ox, height, a.z + oz, b.x + ox, height, b.z + oz, a.x - ox, height, a.z - oz,
      a.x - ox, height, a.z - oz, b.x + ox, height, b.z + oz, b.x - ox, height, b.z - oz,
    ], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, length / 3, width / 3, 0, width / 3, 0, 0, length / 3, width / 3, length / 3], 2));
    geometry.computeVertexNormals();
    // Order above faces up for both north- and east-bound segments.
    return geometry;
  }
  const foundation = buildRoadFoundation(data);
  const dressing = buildRoadDressing(data, foundation);
  const roadsById = new Map(data.roads.map(r => [r.id, r]));
  const worldUv = (geometry: THREE.BufferGeometry, metres = 2) => {
    const uv = geometry.getAttribute('uv'), position = geometry.getAttribute('position');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / metres, position.getZ(i) / metres);
    return geometry;
  };
  const patchCenter = (patch: { points: MapPoint[] }): MapPoint => ({
    x: patch.points.reduce((n, p) => n + p.x, 0) / patch.points.length,
    z: patch.points.reduce((n, p) => n + p.z, 0) / patch.points.length,
  });
  for (const patch of dressing.shoulders) {
    addGeometry(worldUv(flatShape(patch.points, 0.0015)), roadMaterials.shoulder, patchCenter(patch));
  }
  for (const detail of dressing.details) {
    const material = detail.kind === 'drain-channel' ? channelMaterial : detail.kind === 'cover' ? coverMaterial : roadMaterials.detail;
    addGeometry(worldUv(flatShape(detail.points, detail.kind === 'repair' ? ROAD_SURFACE_Y + .001 : .002)), material,
      patchCenter(detail), true, new THREE.Color(detail.color));
  }
  const patchCells = new Map<string, RoadPatch[]>();
  const omittedBuildingIds: string[] = [];
  const cellSize = 32;
  const register = <T>(cells: Map<string, T[]>, item: T, bounds: Collider): void => {
    for (let ix = Math.floor(bounds.minX / cellSize); ix <= Math.floor(bounds.maxX / cellSize); ix++) for (let iz = Math.floor(bounds.minZ / cellSize); iz <= Math.floor(bounds.maxZ / cellSize); iz++) {
      const key = `${ix},${iz}`, list = cells.get(key) ?? []; list.push(item); cells.set(key, list);
    }
  };
  for (const patch of foundation.patches) {
    const xs = patch.points.map(p => p.x), zs = patch.points.map(p => p.z);
    const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    const center = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
    const geometry = worldUv(flatShape(patch.points, ROAD_SURFACE_Y));
    // Identical world UVs across strips/joins avoid texture seams and coplanar flicker.
    const surfaces = patch.roadIds.map(id => roadProfile(roadsById.get(id)!).surface);
    const surface = surfaces.includes('asphalt') ? 'asphalt' : surfaces.includes('concrete') ? 'concrete' : 'gravel';
    addGeometry(geometry, roadMaterials[surface], center);
    register(patchCells, patch, bounds);
  }
  for (const road of data.roads) for (const [a, b] of roadPaintSegments(road, foundation.junctionRadii)) {
    addGeometry(lineQuad(a, b, 0.1, ROAD_PAINT_Y), roadPaint, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
  }
  const roadSurface = (x: number, z: number): boolean => (patchCells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) ?? []).some(patch => onRoadPatch({ x, z }, patch));
  const buildingCells = new Map<string, typeof data.buildings>();
  const colliders: Collider[] = [];
  for (const building of data.buildings) {
    if (building.points.length < 3) continue;
    const xs = building.points.map(p => p.x), zs = building.points.map(p => p.z);
    const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    const nearby = new Set<RoadPatch>();
    for (let ix = Math.floor((bounds.minX - 0.03) / cellSize); ix <= Math.floor((bounds.maxX + 0.03) / cellSize); ix++) for (let iz = Math.floor((bounds.minZ - 0.03) / cellSize); iz <= Math.floor((bounds.maxZ + 0.03) / cellSize); iz++) {
      for (const patch of patchCells.get(`${ix},${iz}`) ?? []) nearby.add(patch);
    }
    if ([...nearby].some(patch => buildingConflictsWithRoad(building, patch))) {
      omittedBuildingIds.push(building.id); continue;
    }
    colliders.push(bounds); register(buildingCells, building, bounds);
    const center = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
    const height = Math.max(2.5, Math.min(40, building.height));
    const shape = new THREE.Shape(building.points.map(p => new THREE.Vector2(p.x, -p.z)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    const uv = geometry.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
    const hash = [...building.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const tint = new THREE.Color(['#d8cbb7', '#c7c7b7', '#b9c7be', '#d3bfb0'][hash % 4]);
    addGeometry(geometry, wall, center, false, tint);
    addGeometry(flatShape(building.points, height + 0.025), roof, center, false, new THREE.Color(hash % 4 === 0 ? '#a77a5f' : '#c4c2b3'));
    if (nearestRoad(data.roads, center)!.distance < 45) {
      const positions: number[] = [];
      for (let i = 0; i < building.points.length; i++) {
        const a = building.points[i], b = building.points[(i + 1) % building.points.length];
        const length = Math.hypot(b.x - a.x, b.z - a.z); if (length < 3) continue;
        const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
        const normalSign = pointInPolygon({ x: (a.x + b.x) / 2 + dz * 0.05, z: (a.z + b.z) / 2 - dx * 0.05 }, building.points) ? -1 : 1;
        for (let y = 1.5; y < height - 0.6; y += 3) for (let d = 1.8; d < length - 0.8; d += 3.6) {
          const cx = a.x + dx * d, cz = a.z + dz * d, ox = dz * 0.025 * normalSign, oz = -dx * 0.025 * normalSign;
          positions.push(cx - dx * 0.6 + ox, y, cz - dz * 0.6 + oz, cx + dx * 0.6 + ox, y, cz + dz * 0.6 + oz, cx - dx * 0.6 + ox, y + 1.2, cz - dz * 0.6 + oz,
            cx - dx * 0.6 + ox, y + 1.2, cz - dz * 0.6 + oz, cx + dx * 0.6 + ox, y, cz + dz * 0.6 + oz, cx + dx * 0.6 + ox, y + 1.2, cz + dz * 0.6 + oz);
        }
      }
      if (positions.length) { const detail = new THREE.BufferGeometry(); detail.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); addGeometry(detail, windows, center, true); }
    }
  }
  const isBlocked = (x: number, z: number, radius = 1.05): boolean => {
    if (x < data.bounds.minX + radius || x > data.bounds.maxX - radius || z < data.bounds.minZ + radius || z > data.bounds.maxZ - radius) return true;
    // The same patch geometry drives asphalt, ground contact and clearance decisions.
    if (roadSurface(x, z)) return false;
    if (data.water.some(water => water.kind === 'area' && pointInPolygon({ x, z }, water.points))) return true;
    const candidates = new Set<typeof data.buildings[number]>();
    for (let ix = Math.floor((x - radius) / cellSize); ix <= Math.floor((x + radius) / cellSize); ix++) for (let iz = Math.floor((z - radius) / cellSize); iz <= Math.floor((z + radius) / cellSize); iz++) {
      for (const building of buildingCells.get(`${ix},${iz}`) ?? []) candidates.add(building);
    }
    return [...candidates].some(building => pointInPolygon({ x, z }, building.points) || building.points.some((a, i) => segmentDistance({ x, z }, a, building.points[(i + 1) % building.points.length]).distance < radius));
  };
  for (const water of data.water) {
    if (water.points.length < 2) continue;
    const middle = water.points[Math.floor(water.points.length / 2)];
    if (water.kind === 'area' && water.points.length >= 3) addGeometry(flatShape(water.points, 0.001), waterMaterial, middle);
    else for (let i = 1; i < water.points.length; i++) addGeometry(lineQuad(water.points[i - 1], water.points[i], 2, 0.001), waterMaterial, middle);
  }
  for (const chunk of chunks.values()) for (const batch of chunk.batches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    if (!geometry) throw new Error('Unable to combine OSM geometry.');
    const mesh = new THREE.Mesh(geometry, batch.material); mesh.receiveShadow = true; mesh.castShadow = batch.material === wall;
    mesh.name = roadSurfaceMaterials.has(batch.material as THREE.MeshStandardMaterial) ? 'OSM asphalt foundation'
      : batch.material === roadMaterials.shoulder ? 'Authored road shoulder'
      : [roadMaterials.detail, channelMaterial, coverMaterial].includes(batch.material as THREE.MeshStandardMaterial) ? 'Authored road weathering and drainage'
      : batch.material === roadPaint ? 'Authored road guidance' : batch.material === wall ? 'Non-conflicting source building models' : 'OSM detail';
    chunk.group.add(mesh); if (batch.detail) chunk.detail.push(mesh);
    for (const geometry of batch.geometries) geometry.dispose(); batch.geometries.length = 0;
  }
  const signs: THREE.Mesh[] = [];
  const mappedSigns = data.landmarks.filter(l => ['bus_station', 'hospital', 'police', 'marketplace'].includes(l.kind)).sort((a,b)=>['bus_station','marketplace','police','hospital'].indexOf(a.kind)-['bus_station','marketplace','police','hospital'].indexOf(b.kind)).slice(0, 12);
  for (const landmark of mappedSigns) {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e9e7d6'; ctx.fillRect(0, 0, 640, 128); ctx.fillStyle = '#29483a'; ctx.textAlign = 'center';
    ctx.font = 'bold 27px sans-serif'; ctx.fillText(landmark.name || landmark.kind.replace('_', ' '), 320, 52, 610);
    ctx.font = '18px sans-serif'; ctx.fillText('OSM location · approximate model', 320, 91, 610);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    const building = data.buildings.find(b => !omittedBuildingIds.includes(b.id) && pointInPolygon(landmark, b.points));
    label.position.set(landmark.x, building ? Math.min(building.height, 40) + 1.6 : 3.4, landmark.z);
    const chunk = chunkAt(landmark.x, landmark.z);
    chunk.radius = Math.max(chunk.radius, Math.hypot(landmark.x - chunk.x, landmark.z - chunk.z) + 4);
    chunk.group.add(label); signs.push(label);
  }
  // These describe the playable excerpt, never an OSM cul-de-sac or a real road sign.
  const boundaryEnds = foundation.ends.filter(e => e.kind === 'boundary');
  if (boundaryEnds.length) {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#3f4539'; ctx.fillRect(0, 0, 640, 128); ctx.fillStyle = '#f6d27a'; ctx.textAlign = 'center';
    ctx.font = 'bold 30px sans-serif'; ctx.fillText('PLAYABLE MAP BOUNDARY', 320, 50);
    ctx.font = '22px sans-serif'; ctx.fillText('Source road continues beyond this extract', 320, 96);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(7, 1.4);
    for (const end of boundaryEnds) {
      const label = new THREE.Mesh(geometry, material); label.name = 'Playable boundary; not a source road end';
      label.position.set(Math.max(data.bounds.minX + 2, Math.min(data.bounds.maxX - 2, end.point.x)), 2.5, Math.max(data.bounds.minZ + 2, Math.min(data.bounds.maxZ - 2, end.point.z)));
      const chunk = chunkAt(label.position.x, label.position.z);
      chunk.radius = Math.max(chunk.radius, Math.hypot(label.position.x - chunk.x, label.position.z - chunk.z) + 4);
      chunk.group.add(label); signs.push(label);
    }
  }
  const stops = selectMissionStops(data);
  return {
    colliders, roadSurface, isBlocked, spawn: stops.spawn, pickup: stops.pickup, dropoff: stops.dropoff, tea: null,
    mission: { pickupName: stops.pickupName, dropoffName: stops.dropoffName, route: stops.route }, chunkCount: chunks.size,
    foundationStats: { roadPatches: foundation.patches.length, joins: foundation.patches.filter(p => p.kind === 'join').length,
      boundaryEnds: foundation.ends.filter(e => e.kind === 'boundary').length, sourceEnds: foundation.ends.filter(e => e.kind === 'source-end').length, omittedBuildingIds },
    roadStyleStats: { shoulderPatches: dressing.shoulders.length, detailPatches: dressing.details.length,
      drains: dressing.details.filter(p => p.kind === 'drain-rim').length, repairs: dressing.details.filter(p => p.kind === 'repair').length,
      markedRoads: data.roads.filter(r => roadProfile(r).centerMarking).length,
      concreteRoads: data.roads.filter(r => roadProfile(r).surface === 'concrete').length,
      gravelRoads: data.roads.filter(r => roadProfile(r).surface === 'gravel').length },
    update(_elapsed, cameraPosition, lowDetail = false) {
      for (const chunk of chunks.values()) {
        const distance = Math.hypot(cameraPosition.x - chunk.x, cameraPosition.z - chunk.z);
        chunk.group.visible = distance < (lowDetail ? 220 : 330) + chunk.radius;
        for (const detail of chunk.detail) detail.visible = !lowDetail && distance < 205;
      }
      for (const sign of signs) sign.lookAt(cameraPosition.x, sign.position.y, cameraPosition.z);
    },
    dispose() {
      root.removeFromParent();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); } });
      for (const material of [...Object.values(roadMaterials), channelMaterial, coverMaterial]) materials.add(material);
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
      geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
    },
  };
}
