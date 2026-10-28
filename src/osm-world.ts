import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roadPieces } from './elevation';
import { createTownMaterials } from './materials';
import {addArchitecture} from './architecture';
import {buildBuildingFrontages,frontageBlocks} from './building-frontage';
import {createArchitectureMaterials} from './architecture-materials';
import type { MapPoint, OsmMap, OsmRoad } from './osm-types';
import { nearestRoad, pointInPolygon, segmentDistance, selectMissionStops } from './osm-navigation';
import type { Collider } from './world';
import { buildRoadFoundation, roadPaintSegments } from './road-foundation';
import { roadProfile } from './road-profile';
import { createKeralaRoadMaterials } from './road-materials';
import { buildRoadDressing } from './road-dressing';

/** Render a bounded source-data slice, not a fabricated road network or surveyed building model. */
export function createOsmWorld(scene: THREE.Scene, data: OsmMap, missionOverride?: ReturnType<typeof selectMissionStops>, terrain?: {heightAt:(x:number,z:number)=>number}, focus?:MapPoint): {
  colliders: Collider[];
  heightAt:(x:number,z:number)=>number;
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
  const roadMaterials = createKeralaRoadMaterials();
  for(const [name,material] of Object.entries(roadMaterials))material.name=`Integrated road ${name}`;
  const channelMaterial=roadMaterials.detail.clone();channelMaterial.polygonOffsetUnits=-18;
  const coverMaterial=roadMaterials.detail.clone();coverMaterial.polygonOffsetUnits=-20;
  const roadDetailMaterials=new Set<THREE.Material>([roadMaterials.detail,channelMaterial,coverMaterial]);
  const roadsById=new Map(data.roads.map(road=>[road.id,road]));
  const heightAt = (x:number,z:number) => terrain?.heightAt(Math.max(data.bounds.minX,Math.min(data.bounds.maxX,x)),Math.max(data.bounds.minZ,Math.min(data.bounds.maxZ,z))) ?? 0;
  const wall = townMaterial('#c2c8ae'); wall.vertexColors = true;wall.name='Verified footprint facades';
  const tiledRoof=townMaterial('#b76545');tiledRoof.side=THREE.DoubleSide;tiledRoof.vertexColors=true;tiledRoof.name='Approximate Kerala tiled roofs';
  const architecture=createArchitectureMaterials(wall,tiledRoof);
  const bark=new THREE.MeshStandardMaterial({color:'#77654c',roughness:1});bark.name='Decorative palm trunks';
  const poleMaterial=new THREE.MeshStandardMaterial({color:'#8d918a',roughness:1});poleMaterial.name='Decorative utility poles';
  const grass=new THREE.MeshStandardMaterial({color:'#81925d',side:THREE.DoubleSide,roughness:1});grass.name='Decorative grass';
  const leaves=new THREE.MeshStandardMaterial({color:'#3e7046',roughness:1,side:THREE.DoubleSide});leaves.name='Decorative palm crowns';
  const bridgeRail=new THREE.MeshStandardMaterial({color:'#b6b5a4',roughness:.8});bridgeRail.name='Mapped bridge rail artwork';
  const roadPaint = new THREE.MeshStandardMaterial({ color: '#d2ccaf', roughness: 1, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-24 });
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#5f9290', roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide });
  const centerX=(data.bounds.minX+data.bounds.maxX)/2,centerZ=(data.bounds.minZ+data.bounds.maxZ)/2;
  // A nearby flat patch avoids huge-triangle depth precision hiding roads far from the origin.
  const groundWidth=terrain?data.bounds.maxX-data.bounds.minX+20:Math.min(2400,data.bounds.maxX-data.bounds.minX+20);
  const groundDepth=terrain?data.bounds.maxZ-data.bounds.minZ+20:Math.min(2400,data.bounds.maxZ-data.bounds.minZ+20);
  const groundGeometry = new THREE.PlaneGeometry(groundWidth,groundDepth,terrain?80:1,terrain?80:1);
  groundGeometry.rotateX(-Math.PI/2);
  if(terrain){const positions=groundGeometry.getAttribute('position');for(let i=0;i<positions.count;i++)positions.setY(i,heightAt(positions.getX(i)+centerX,positions.getZ(i)+centerZ));groundGeometry.computeVertexNormals();}
  const ground = new THREE.Mesh(groundGeometry,townMaterial('#9cb57c'));
  ground.name=terrain?'DEM terrain surface':'Flat map ground';
  ground.position.set(centerX,-0.025,centerZ);
  const groundUv=ground.geometry.getAttribute('uv');
  for(let i=0;i<groundUv.count;i++)groundUv.setXY(i,groundUv.getX(i)*groundWidth/4,groundUv.getY(i)*groundDepth/4);
  ground.receiveShadow=true;root.add(ground);
  interface Batch { geometries: THREE.BufferGeometry[]; material: THREE.Material; detail: boolean;lod?:'near'|'far' }
  interface Chunk { group: THREE.Group; x: number; z: number; batches: Map<string, Batch>; radius: number; detail: THREE.Mesh[];architectural:Array<{mesh:THREE.Mesh;lod:'near'|'far'}>;architectureRadius:number;nearArchitecture?:boolean }
  const chunks = new Map<string, Chunk>();
  const size = 160;
  const chunkAt = (x: number, z: number): Chunk => {
    const ix = Math.floor(x / size), iz = Math.floor(z / size), key = `${ix},${iz}`;
    let chunk = chunks.get(key);
    if (!chunk) {
      const group = new THREE.Group(); group.name = `OSM chunk ${key}`; root.add(group);
      chunk = { group, x: (ix + 0.5) * size, z: (iz + 0.5) * size, batches: new Map(), radius: 0, detail: [], architectural:[],architectureRadius:0 }; chunks.set(key, chunk);
    }
    return chunk;
  };
  function addGeometry(geometry: THREE.BufferGeometry, material: THREE.Material, point: MapPoint, detail:boolean|'near'|'far' = false, tint?: THREE.Color): void {
    const chunk = chunkAt(point.x, point.z);
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geometry !== plain) geometry.dispose();
    if (!plain.getAttribute('normal')) plain.computeVertexNormals();
    if (!plain.getAttribute('uv')) plain.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(plain.getAttribute('position').count * 2).fill(0), 2));
    if (tint || (material as THREE.MeshStandardMaterial).vertexColors) {
      const colors: number[] = [];
      for (let i = 0; i < plain.getAttribute('position').count; i++) colors.push(tint?.r??1, tint?.g??1, tint?.b??1);
      plain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    plain.computeBoundingBox();
    const bounds = plain.boundingBox!;
    chunk.radius = Math.max(chunk.radius, Math.hypot(bounds.min.x - chunk.x, bounds.min.z - chunk.z), Math.hypot(bounds.max.x - chunk.x, bounds.max.z - chunk.z));
    const lod=typeof detail==='string'?detail:undefined;
    if(lod)chunk.architectureRadius=Math.max(chunk.architectureRadius,Math.hypot(bounds.min.x-chunk.x,bounds.min.z-chunk.z),Math.hypot(bounds.max.x-chunk.x,bounds.max.z-chunk.z));
    const key = material.uuid + (lod??(detail ? 'detail' : 'base'));
    const batch = chunk.batches.get(key) ?? { geometries: [], material, detail:detail===true,lod };
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
    if(terrain){const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+heightAt(p.getX(i),p.getZ(i)));}
    geometry.computeVertexNormals();
    // Order above faces up for both north- and east-bound segments.
    return geometry;
  }
  // Closed source land-use polygons, not invented crop locations or field boundaries.
  const agricultural=new THREE.MeshStandardMaterial({color:'#a2ab70',roughness:1,side:THREE.DoubleSide});agricultural.name='Mapped agricultural landuse';
  const naturalLand=new THREE.MeshStandardMaterial({color:'#6f8e5e',roughness:1,side:THREE.DoubleSide});naturalLand.name='Mapped natural landuse';
  for(const area of data.landuse??[]){if(area.points.length<3)continue;const geometry=flatShape(area.points,.004),positions=geometry.getAttribute('position');if(terrain){for(let i=0;i<positions.count;i++)positions.setY(i,.004+heightAt(positions.getX(i),positions.getZ(i)));geometry.computeVertexNormals();}addGeometry(geometry,['farmland','farmyard','orchard','plant_nursery'].includes(area.kind)?agricultural:naturalLand,area.points[0]);}
  interface Segment { a: MapPoint; b: MapPoint; road: OsmRoad }
  const segmentCells = new Map<string, Segment[]>();
  const cellSize = 32;
  const register = <T>(cells: Map<string, T[]>, item: T, bounds: Collider): void => {
    for (let ix = Math.floor(bounds.minX / cellSize); ix <= Math.floor(bounds.maxX / cellSize); ix++) for (let iz = Math.floor(bounds.minZ / cellSize); iz <= Math.floor(bounds.maxZ / cellSize); iz++) {
      const key = `${ix},${iz}`, list = cells.get(key) ?? []; list.push(item); cells.set(key, list);
    }
  };
  // Render-only tessellation preserves main's DEM sampling contract. Source
  // arrays, routing, tile IDs and collision queries are never rewritten.
  const renderData:OsmMap=terrain?{...data,roads:data.roads.map(road=>{
    const points=[road.points[0]],nodeIds=[road.nodeIds[0]];
    for(let i=1;i<road.points.length;i++){
      const pieces=roadPieces(road.points[i-1],road.points[i]);
      pieces.forEach((piece,n)=>{points.push(piece.b);nodeIds.push(n===pieces.length-1?road.nodeIds[i]:`render:${road.id}:${i}:${n}`);});
    }
    return {...road,points,nodeIds};
  })}:data;
  const foundation=buildRoadFoundation(renderData),dressing=buildRoadDressing(renderData,foundation);
  const patchSurface=(ids:string[])=>{
    const surfaces=ids.map(id=>roadProfile(roadsById.get(id)!).surface);
    return surfaces.includes('asphalt')?'asphalt':surfaces.includes('concrete')?'concrete':'gravel';
  };
  const patchHeight=(ids:string[])=>.035+Math.max(...ids.map(id=>roadsById.get(id)!.layer))*.001;
  const patchCenter=(points:MapPoint[])=>({x:points.reduce((n,p)=>n+p.x,0)/points.length,z:points.reduce((n,p)=>n+p.z,0)/points.length});
  const roadShape=(points:MapPoint[],height:number)=>{
    const geometry=flatShape(points,height),positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i);
      if(terrain)positions.setY(i,height+heightAt(x,z));
      uv.setXY(i,x/2,z/2);
    }
    if(terrain)geometry.computeVertexNormals();
    return geometry;
  };
  for(const patch of dressing.shoulders)addGeometry(roadShape(patch.points,patchHeight(patch.roadIds)-.009),roadMaterials.shoulder,patchCenter(patch.points));
  for(const patch of foundation.patches)addGeometry(roadShape(patch.points,patchHeight(patch.roadIds)),roadMaterials[patchSurface(patch.roadIds)],patchCenter(patch.points));
  for(const detail of dressing.details){
    const material=detail.kind==='drain-channel'?channelMaterial:detail.kind==='cover'?coverMaterial:roadMaterials.detail;
    addGeometry(roadShape(detail.points,patchHeight([detail.roadId])+(detail.kind==='repair'?.005:-.004)),material,patchCenter(detail.points),true,new THREE.Color(detail.color));
  }
  for(const road of data.roads)for(const [a,b] of roadPaintSegments(road,foundation.junctionRadii)){
    addGeometry(lineQuad(a,b,.1,patchHeight([road.id])+.008),roadPaint,{x:(a.x+b.x)/2,z:(a.z+b.z)/2},true);
  }
  for (const road of data.roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], middle = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    // Bridge position/alignment is mapped; these flat-deck rails are approximate
    // artwork, not surveyed bridge clearance or a substitute for missing DEM.
    if(road.bridge){const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length>.05)for(const side of [-1,1]){const ox=-dz/length*(road.width/2+.15)*side,oz=dx/length*(road.width/2+.15)*side;for(const level of [.45,.85]){const from=new THREE.Vector3(a.x+ox,heightAt(a.x,a.z)+level,a.z+oz),to=new THREE.Vector3(b.x+ox,heightAt(b.x,b.z)+level,b.z+oz),g=new THREE.CylinderGeometry(.045,.045,from.distanceTo(to),5);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()));g.translate(...from.clone().lerp(to,.5).toArray() as [number,number,number]);addGeometry(g,bridgeRail,middle);}}}
    register(segmentCells, { a, b, road }, { minX: Math.min(a.x, b.x) - road.width, maxX: Math.max(a.x, b.x) + road.width, minZ: Math.min(a.z, b.z) - road.width, maxZ: Math.max(a.z, b.z) + road.width });
  }
  const roadSurface = (x: number, z: number): boolean => (segmentCells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) ?? []).some(s => segmentDistance({ x, z }, s.a, s.b).distance <= s.road.width / 2 + 0.4);
  const buildingCells = new Map<string, typeof data.buildings>();
  const colliders: Collider[] = [];
  const stylePriority=['place_of_worship','hospital','clinic','school','college','bus_station','marketplace','cafe','restaurant','shop'];
  const stylePois=data.landmarks.filter(p=>stylePriority.includes(p.kind)).sort((a,b)=>stylePriority.indexOf(a.kind)-stylePriority.indexOf(b.kind));
  for (const building of data.buildings) {
    if (building.points.length < 3) continue;
    const xs = building.points.map(p => p.x), zs = building.points.map(p => p.z);
    const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    colliders.push(bounds); register(buildingCells, building, bounds);
    const poi=!building.tags.amenity?stylePois.find(p=>p.x>=bounds.minX&&p.x<=bounds.maxX&&p.z>=bounds.minZ&&p.z<=bounds.maxZ&&pointInPolygon(p,building.points)):undefined;
    const styled=poi?{...building,tags:{...building.tags,...(poi.kind==='shop'?{shop:building.tags.shop||'yes'}:{amenity:poi.kind})}}:building;
    addArchitecture(styled,architecture,addGeometry,heightAt,(a,b)=>nearestRoad(data.roads,{x:(a.x+b.x)/2,z:(a.z+b.z)/2})?.distance??Infinity);
  }
  const frontageStops=missionOverride??selectMissionStops(data);
  const frontages=buildBuildingFrontages(data,focus??frontageStops.spawn,[frontageStops.pickup,frontageStops.dropoff]).filter(part=>{const heights=part.points.map(p=>heightAt(p.x,p.z));return Math.max(...heights)-Math.min(...heights)<=.15;});
  for(const part of frontages){
    const center={x:part.points.reduce((v,p)=>v+p.x,0)/4,z:part.points.reduce((v,p)=>v+p.z,0)/4};
    const base=Math.max(...part.points.map(p=>heightAt(p.x,p.z)));
    // Skip cosmetic lots on steep/nonplanar support rather than float a wall.
    if(base-Math.min(...part.points.map(p=>heightAt(p.x,p.z)))>.15)continue;
    const shape=new THREE.Shape(part.points.map(p=>new THREE.Vector2(p.x,-p.z)));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:part.height,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);geometry.translate(0,base+.008,0);
    addGeometry(geometry,part.kind==='fence'?architecture.metal:architecture.concrete,center,true);
  }
  const isBlocked = (x: number, z: number, radius = 1.05): boolean => {
    if (x < data.bounds.minX + radius || x > data.bounds.maxX - radius || z < data.bounds.minZ + radius || z > data.bounds.maxZ - radius) return true;
    // Imported road centre geometry wins over imperfect overlapping footprint tags, keeping validated routes traversable.
    if (roadSurface(x, z)) return false;
    if(frontageBlocks(frontages,{x,z},radius))return true;
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
    else for (let i = 1; i < water.points.length; i++) addGeometry(lineQuad(water.points[i - 1], water.points[i], water.width??2, 0.012), waterMaterial, middle);
  }
  // Decorative Kerala roadside planting, not surveyed tree positions or new land-use data.
  // Shared batches inherit source chunk culling/disposal and never occupy mapped pavement,
  // footprints or water. Limit density independently of the source extract's size.
  let treeCount=0;const planted:MapPoint[]=[];
  const plantingCenter=focus??missionOverride?.spawn??{x:0,z:0};
  const plantingRoads=data.roads.map(road=>({road,distance:Math.min(...road.points.map(p=>Math.hypot(p.x-plantingCenter.x,p.z-plantingCenter.z)))})).sort((a,b)=>a.distance-b.distance).map(p=>p.road);
  for(const road of plantingRoads){
    if(!['primary','secondary','tertiary','residential','unclassified'].includes(road.highway))continue;
    for(let i=1;i<road.points.length&&treeCount<240;i++){
      const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<12)continue;
      const hash=[...road.sourceWayId].reduce((h,c)=>h*31+c.charCodeAt(0),7)>>>0;
      for(let d=8+(hash%13);d<len&&treeCount<240;d+=38){
        const side=(i+Math.floor(d/38)+hash)%2?1:-1,offset=road.width/2+5+(hash%4);
        const p={x:a.x+dx*d/len-dz/len*offset*side,z:a.z+dz*d/len+dx/len*offset*side};
        if(p.x<data.bounds.minX||p.x>data.bounds.maxX||p.z<data.bounds.minZ||p.z>data.bounds.maxZ||isBlocked(p.x,p.z,3)||nearestRoad(data.roads,p)!.distance<5||planted.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<18))continue;
        if(data.water.some(w=>w.kind==='area'?pointInPolygon(p,w.points):w.points.some((q,j)=>j>0&&segmentDistance(p,w.points[j-1],q).distance<7)))continue;
        planted.push(p);treeCount++;
        if(treeCount%3===0){
          const positions:number[]=[],base=heightAt(p.x,p.z);
          for(let blade=0;blade<5;blade++){const a=blade*2.4+hash,x=p.x+Math.cos(a)*.8,z=p.z+Math.sin(a)*.8;positions.push(x-.08,base,z,x+.08,base,z,x+.12,base+.35,z+.12);}
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();addGeometry(g,grass,p);
        }
        if(treeCount%5===0){
          const base=heightAt(p.x,p.z),pole=new THREE.CylinderGeometry(.12,.18,6,5);pole.translate(p.x,base+3,p.z);addGeometry(pole,poleMaterial,p);
          const arm=new THREE.BoxGeometry(1.7,.12,.13);arm.translate(p.x,base+5.5,p.z);addGeometry(arm,poleMaterial,p);continue;
        }
        if(treeCount%4===0){
          const base=heightAt(p.x,p.z),stem=new THREE.CylinderGeometry(.10,.2,2.2,5);stem.translate(p.x,base+1.1,p.z);addGeometry(stem,leaves,p);
          const positions:number[]=[];
          for(let n=0;n<6;n++){const a=n*Math.PI/3+hash,dx=Math.cos(a),dz=Math.sin(a),nx=-dz,nz=dx;
            positions.push(p.x,base+2,p.z,p.x+dx+nx*.4,base+2.6,p.z+dz+nz*.4,p.x+dx*2.2,base+1.8,p.z+dz*2.2,p.x,base+2,p.z,p.x+dx*2.2,base+1.8,p.z+dz*2.2,p.x+dx-nx*.4,base+2.6,p.z+dz-nz*.4);
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();addGeometry(g,leaves,p);continue;
        }
        const h=5.5+(hash%4)*.6,base=heightAt(p.x,p.z);
        const trunk=new THREE.CylinderGeometry(.13,.23,h,5);trunk.translate(p.x,base+h/2,p.z);addGeometry(trunk,bark,p);
        const positions:number[]=[];
        for(let n=0;n<7;n++){
          const angle=n*Math.PI*2/7+hash,ux=Math.cos(angle),uz=Math.sin(angle),vx=-uz,vz=ux;
          const tip={x:p.x+ux*3.8,z:p.z+uz*3.8},mid={x:p.x+ux*1.8,z:p.z+uz*1.8};
          positions.push(p.x,base+h,p.z,mid.x+vx*.55,base+h+.3,mid.z+vz*.55,tip.x,base+h-1.2,tip.z,
            p.x,base+h,p.z,tip.x,base+h-1.2,tip.z,mid.x-vx*.55,base+h+.3,mid.z-vz*.55);
        }
        const crown=new THREE.BufferGeometry();crown.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));crown.computeVertexNormals();addGeometry(crown,leaves,p);
      }
    }
  }
  for (const chunk of chunks.values()) for (const batch of chunk.batches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    if (!geometry) throw new Error('Unable to combine OSM geometry.');
    // Keep GPU vertex coordinates local: large OSM world coordinates otherwise
    // lose derivative/shadow precision on detailed PBR facades. World transforms
    // preserve the original geographic placement and collision coordinates.
    geometry.translate(-chunk.x,0,-chunk.z);
    const mesh = new THREE.Mesh(geometry, batch.material);mesh.position.set(chunk.x,0,chunk.z); mesh.receiveShadow = true; mesh.castShadow = Object.values(architecture).includes(batch.material);
    mesh.userData.roadDressing=roadDetailMaterials.has(batch.material);
    if(Object.values(roadMaterials).includes(batch.material as THREE.MeshStandardMaterial))mesh.name=batch.material.name;
    mesh.userData.architectureLod=batch.lod;chunk.group.add(mesh); if (batch.detail) chunk.detail.push(mesh);if(batch.lod)chunk.architectural.push({mesh,lod:batch.lod});
    for (const geometry of batch.geometries) geometry.dispose(); batch.geometries.length = 0;
  }
  const signs: THREE.Mesh[] = [];
  const mappedSigns = data.landmarks.filter(l => ['bus_station', 'hospital', 'police', 'marketplace'].includes(l.kind)).sort((a,b)=>['bus_station','marketplace','police','hospital'].indexOf(a.kind)-['bus_station','marketplace','police','hospital'].indexOf(b.kind)).slice(0, 12);
  // World-space name boards are disabled pending owner-provided designs.
  // Verified POIs remain in the database and map/navigation UI.
  for (const landmark of mappedSigns.slice(0,0)) {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e9e7d6'; ctx.fillRect(0, 0, 640, 128); ctx.fillStyle = '#29483a'; ctx.textAlign = 'center';
    ctx.font = 'bold 27px sans-serif'; ctx.fillText(landmark.name || landmark.kind.replace('_', ' '), 320, 52, 610);
    ctx.font = '18px sans-serif'; ctx.fillText('OSM location · approximate model', 320, 91, 610);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    label.name=`OSM landmark label ${landmark.id}`;
    const building = data.buildings.find(b => pointInPolygon(landmark, b.points));
    label.position.set(landmark.x, building ? Math.min(building.height, 40) + 1.6 : 3.4, landmark.z);
    chunkAt(landmark.x, landmark.z).group.add(label); signs.push(label);
  }
  const stops = missionOverride ?? selectMissionStops(data);
  return {
    colliders, heightAt, roadSurface, isBlocked, spawn: stops.spawn, pickup: stops.pickup, dropoff: stops.dropoff, tea: null,
    mission: { pickupName: stops.pickupName, dropoffName: stops.dropoffName, route: stops.route }, chunkCount: chunks.size,
    update(_elapsed, cameraPosition, lowDetail = false) {
      if(!terrain){ground.position.x=Math.round(cameraPosition.x/600)*600;ground.position.z=Math.round(cameraPosition.z/600)*600;}
      for (const chunk of chunks.values()) {
        const distance = Math.hypot(cameraPosition.x - chunk.x, cameraPosition.z - chunk.z);
        chunk.group.visible = distance < (lowDetail ? 220 : 330) + chunk.radius;
        for (const detail of chunk.detail) detail.visible = detail.userData.roadDressing?(!lowDetail&&distance<205):(lowDetail?distance<110:distance<205);
        // A 6 m hysteresis band avoids near/far chatter without double-rendered facades.
        const limit=(lowDetail?55:115)+(chunk.nearArchitecture?6:0);
        const close=distance-Math.min(120,chunk.architectureRadius)<limit;chunk.nearArchitecture=close;
        for(const item of chunk.architectural)item.mesh.visible=item.lod==='near'?close:!close;
      }
      for (const sign of signs){
        const distance=Math.hypot(cameraPosition.x-sign.position.x,cameraPosition.z-sign.position.z);
        // Map labels are UI annotations, not giant physical billboards in the lane.
        sign.visible=distance>12&&distance<200;sign.scale.setScalar(Math.min(1,distance/45));
        sign.lookAt(cameraPosition.x,sign.position.y,cameraPosition.z);
      }
    },
    dispose() {
      root.removeFromParent();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); } });
      for(const material of [...Object.values(roadMaterials),channelMaterial,coverMaterial])materials.add(material);
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
      geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
    },
  };
}
