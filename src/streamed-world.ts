import * as THREE from 'three';
import type { MapPoint, OsmMap } from './osm-types';
import { createOsmWorld } from './osm-world';
import {roadSpawn} from './road-spawn';
import {districtRide} from './route-save';
import type {OsmRide} from './route-save';
import { selectMissionStops } from './osm-navigation';
import { elevationSampler } from './elevation';
import type { ElevationGrid } from './elevation';
import { RoadTileStore,nearbyTileKeys } from './road-tiles';
import type { RoadManifest } from './road-tiles';

/** Loads/disposes a bounded local road window; the raw export never enters the browser. */
export async function createStreamedRoadWorld(scene:THREE.Scene, saved?:OsmRide, legacy?:OsmRide, previousWorld?:string|null) {
  const response=await fetch(`${import.meta.env.BASE_URL}maps/district/manifest.json`);
  if(!response.ok)throw new Error('Road manifest unavailable');
  const manifest=await response.json() as RoadManifest;
  if(manifest.version!==1||manifest.tileSize!==600||!manifest.source?.sha256||!manifest.tiles)throw new Error('Invalid road manifest');
  const restore=districtRide(saved??null,legacy??null,previousWorld??null,manifest)??undefined;
  let terrainSource: ElevationGrid['source']|undefined;
  let terrain: {heightAt:(x:number,z:number)=>number}|undefined;
  if(new URLSearchParams(location.search).get('terrain')==='1'){
    const dem=await fetch(`${import.meta.env.BASE_URL}maps/malappuram/terrain.json`);
    if(!dem.ok)throw new Error('Verified DEM unavailable: use the flat map until elevation data is imported');
    const grid=await dem.json() as ElevationGrid;
    if(!grid.source?.sha256||grid.source.tile!=='N11E076')throw new Error('DEM provenance missing');
    if(['minX','maxX','minZ','maxZ'].some(key=>grid.bounds[key as keyof typeof grid.bounds]!==manifest.bounds[key as keyof typeof manifest.bounds]))throw new Error('DEM and road coverage differ');
    if(!grid.projection||(['latitude','longitude','earthRadius'] as const).some(key=>grid.projection[key]!==manifest.projection[key]))throw new Error('DEM and road projections differ');
    terrain={heightAt:elevationSampler(grid)};terrainSource=grid.source;
  }
  const store=new RoadTileStore(manifest);
  // Existing saves retain their original mission region; new rides start among verified footprints.
  const origin=restore?(restore.missionOrigin&&nearbyTileKeys(manifest,restore.missionOrigin).length?restore.missionOrigin:{x:0,z:0}):(manifest.places?.find(p=>p.name==='Kottakkal')??{x:0,z:0});
  await store.load(origin);
  const data:OsmMap={version:1,source:manifest.source,projection:manifest.projection,bounds:manifest.bounds,...store.features(),intersections:[],stats:manifest.stats};
  const fixed=selectMissionStops(data);
  if(restore && restore.x>manifest.bounds.minX&&restore.x<manifest.bounds.maxX&&restore.z>manifest.bounds.minZ&&restore.z<manifest.bounds.maxZ){if(nearbyTileKeys(manifest,restore).length)await store.load(restore);Object.assign(data,store.features());}
  let active=createOsmWorld(scene,data,fixed,terrain,restore??origin);
  const spawn=roadSpawn(data,active,restore??fixed.spawn);
  let loadedKey=store.key(restore && store.hasPosition(restore.x,restore.z)?restore:origin);
  let loading=false;let error='';let retryAt=0;let disposed=false;
  async function refresh(point:MapPoint) {
    const key=store.key(point);
    if(loading||key===loadedKey||Date.now()<retryAt||disposed)return;
    loading=true;
    try {
      await store.load(point);
      if(disposed)return;
      Object.assign(data,store.features());
      // Build next geometry before removing the previous window.
      const next=createOsmWorld(scene,data,fixed,terrain,point);active.dispose();active=next;
      loadedKey=key;error='';
    }catch(reason){error='Road download failed · retained nearby roads';retryAt=Date.now()+3000;console.warn(reason);}
    finally{loading=false;}
  }
  const world={
    get colliders(){return active.colliders;},
    get chunkCount(){return active.chunkCount;},
    spawn,pickup:fixed.pickup,dropoff:fixed.dropoff,tea:manifest.teaStop??null,
    mission:{pickupName:fixed.pickupName,dropoffName:fixed.dropoffName,route:fixed.route},
    heightAt:(x:number,z:number)=>active.heightAt(x,z),
    roadSurface:(x:number,z:number)=>active.roadSurface(x,z),
    isBlocked:(x:number,z:number)=>!store.hasPosition(x,z)||active.isBlocked(x,z),
    update(elapsed:number,cameraPosition:THREE.Vector3,low=false){void refresh(cameraPosition);active.update(elapsed,cameraPosition,low);},
    dispose(){disposed=true;active.dispose();},
    get streaming(){return {resident:store.resident.size,total:Object.keys(manifest.tiles).length,loading,error,keys:[...store.resident.keys()]};},
    refresh,
  };
  return {world,data,manifest,terrainSource,restoredRide:restore,missionOrigin:{x:origin.x,z:origin.z}};
}
