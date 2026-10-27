import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTownMaterials } from './materials';
import type { MapPoint, OsmMap, OsmRoad } from './osm-types';
import { nearestRoad, pointInPolygon, segmentDistance, selectMissionStops } from './osm-navigation';
import type { Collider } from './world';

/** Render a bounded source-data slice, not a fabricated road network or surveyed building model. */
export function createOsmWorld(scene: THREE.Scene, data: OsmMap, missionOverride?: ReturnType<typeof selectMissionStops>): {
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
} {
  const root = new THREE.Group(); root.name = 'OSM Kottakkal source geometry'; scene.add(root);
  const townMaterial = createTownMaterials();
  const asphalt = townMaterial('#535e60');
  const wall = townMaterial('#c2c8ae'); wall.vertexColors = true;
  const roof = new THREE.MeshStandardMaterial({ color: '#9b9687', roughness: 0.98, vertexColors: true });
  const windows = new THREE.MeshStandardMaterial({ color: '#526963', roughness: 0.42, metalness: 0.1, side: THREE.DoubleSide });
  const roadPaint = new THREE.MeshStandardMaterial({ color: '#d2ccaf', roughness: 1 });
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#708e85', roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(data.bounds.maxX - data.bounds.minX + 20, data.bounds.maxZ - data.bounds.minZ + 20), townMaterial('#9cb57c'));
  ground.rotation.x = -Math.PI / 2; ground.position.set((data.bounds.minX + data.bounds.maxX) / 2, -0.025, (data.bounds.minZ + data.bounds.maxZ) / 2);
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
  interface Segment { a: MapPoint; b: MapPoint; road: OsmRoad }
  const segmentCells = new Map<string, Segment[]>();
  const cellSize = 32;
  const register = <T>(cells: Map<string, T[]>, item: T, bounds: Collider): void => {
    for (let ix = Math.floor(bounds.minX / cellSize); ix <= Math.floor(bounds.maxX / cellSize); ix++) for (let iz = Math.floor(bounds.minZ / cellSize); iz <= Math.floor(bounds.maxZ / cellSize); iz++) {
      const key = `${ix},${iz}`, list = cells.get(key) ?? []; list.push(item); cells.set(key, list);
    }
  };
  for (const road of data.roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], middle = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const y = 0.035 + road.layer * 0.001;
    addGeometry(lineQuad(a, b, road.width, y), asphalt, middle);
    // Round each actual source vertex to join adjoining strip segments; no invented connections.
    const disc = new THREE.CircleGeometry(road.width / 2, 10); disc.rotateX(-Math.PI / 2); disc.translate(a.x, y, a.z);
    addGeometry(disc, asphalt, a);
    if (i === road.points.length - 1) {
      const end = new THREE.CircleGeometry(road.width / 2, 10); end.rotateX(-Math.PI / 2); end.translate(b.x, y, b.z); addGeometry(end, asphalt, b);
    }
    register(segmentCells, { a, b, road }, { minX: Math.min(a.x, b.x) - road.width, maxX: Math.max(a.x, b.x) + road.width, minZ: Math.min(a.z, b.z) - road.width, maxZ: Math.max(a.z, b.z) + road.width });
    // Neutral centre guidance on wider two-way roads; this is authored paint, not imported lane survey.
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (road.oneway === 'no' && road.width >= 6) for (let offset = 2; offset + 2 < length; offset += 8) {
      const start = offset / length, end = (offset + 2.5) / length;
      addGeometry(lineQuad({ x: a.x + (b.x - a.x) * start, z: a.z + (b.z - a.z) * start }, { x: a.x + (b.x - a.x) * end, z: a.z + (b.z - a.z) * end }, 0.1, y + 0.008), roadPaint, middle, true);
    }
  }
  const roadSurface = (x: number, z: number): boolean => (segmentCells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) ?? []).some(s => segmentDistance({ x, z }, s.a, s.b).distance <= s.road.width / 2 + 0.4);
  const buildingCells = new Map<string, typeof data.buildings>();
  const colliders: Collider[] = [];
  for (const building of data.buildings) {
    if (building.points.length < 3) continue;
    const xs = building.points.map(p => p.x), zs = building.points.map(p => p.z);
    const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
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
    // Imported road centre geometry wins over imperfect overlapping footprint tags, keeping validated routes traversable.
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
    if (water.kind === 'area' && water.points.length >= 3) addGeometry(flatShape(water.points, 0.012), waterMaterial, middle);
    else for (let i = 1; i < water.points.length; i++) addGeometry(lineQuad(water.points[i - 1], water.points[i], 2, 0.012), waterMaterial, middle);
  }
  for (const chunk of chunks.values()) for (const batch of chunk.batches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    if (!geometry) throw new Error('Unable to combine OSM geometry.');
    const mesh = new THREE.Mesh(geometry, batch.material); mesh.receiveShadow = true; mesh.castShadow = batch.material === wall;
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
    const building = data.buildings.find(b => pointInPolygon(landmark, b.points));
    label.position.set(landmark.x, building ? Math.min(building.height, 40) + 1.6 : 3.4, landmark.z);
    chunkAt(landmark.x, landmark.z).group.add(label); signs.push(label);
  }
  const stops = missionOverride ?? selectMissionStops(data);
  return {
    colliders, roadSurface, isBlocked, spawn: stops.spawn, pickup: stops.pickup, dropoff: stops.dropoff, tea: null,
    mission: { pickupName: stops.pickupName, dropoffName: stops.dropoffName, route: stops.route }, chunkCount: chunks.size,
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
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
      geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
    },
  };
}
