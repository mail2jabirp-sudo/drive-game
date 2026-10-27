import * as THREE from 'three';
import type { MapPoint, OsmMap } from './osm-types';
import { createOsmWorld } from './osm-world';
import { selectMissionStops } from './osm-navigation';
import { elevationSampler } from './elevation';
import type { ElevationGrid } from './elevation';
import { RoadTileStore } from './road-tiles';
import type { RoadManifest } from './road-tiles';

/** Loads/disposes a bounded local road window; the raw export never enters the browser. */
export async function createStreamedRoadWorld(scene:THREE.Scene, restore?:MapPoint & {mapId?:string}) {
  const response=await fetch(`${import.meta.env.BASE_URL}maps/malappuram/manifest.json`);
  if(!response.ok)throw new Error('Road manifest unavailable');
  const manifest=await response.json() as RoadManifest;
  if(manifest.version!==1||manifest.tileSize!==600||!manifest.source?.sha256||!manifest.tiles)throw new Error('Invalid road manifest');
  if(restore?.mapId !== manifest.source.sha256) restore=undefined;
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
  await store.load({x:0,z:0});
  const data:OsmMap={version:1,source:manifest.source,projection:manifest.projection,bounds:manifest.bounds,roads:store.roads(),buildings:[],landmarks:[],water:[],intersections:[],stats:manifest.stats};
  const fixed=selectMissionStops(data);
  fixed.pickupName='Malappuram-area mapped road stop';fixed.dropoffName='Connected mapped road stop';
  if(restore && Math.abs(restore.x)<2400 && Math.abs(restore.z)<2400){await store.load(restore);data.roads=store.roads();}
  let active=createOsmWorld(scene,data,fixed,terrain);
  let loadedKey=store.key(restore && store.hasPosition(restore.x,restore.z)?restore:{x:0,z:0});
  let loading=false;let error='';let retryAt=0;let disposed=false;
  async function refresh(point:MapPoint) {
    const key=store.key(point);
    if(loading||key===loadedKey||Date.now()<retryAt||disposed)return;
    loading=true;
    try {
      await store.load(point);
      if(disposed)return;
      data.roads=store.roads();
      // Build next geometry before removing the previous window.
      const next=createOsmWorld(scene,data,fixed,terrain);active.dispose();active=next;
      loadedKey=key;error='';
    }catch(reason){error='Road download failed · retained nearby roads';retryAt=Date.now()+3000;console.warn(reason);}
    finally{loading=false;}
  }
  const world={
    get colliders(){return active.colliders;},
    get chunkCount(){return active.chunkCount;},
    spawn:fixed.spawn,pickup:fixed.pickup,dropoff:fixed.dropoff,tea:null,
    mission:{pickupName:fixed.pickupName,dropoffName:fixed.dropoffName,route:fixed.route},
    heightAt:(x:number,z:number)=>active.heightAt(x,z),
    roadSurface:(x:number,z:number)=>active.roadSurface(x,z),
    isBlocked:(x:number,z:number)=>!store.hasPosition(x,z)||active.isBlocked(x,z),
    update(elapsed:number,cameraPosition:THREE.Vector3,low=false){void refresh(cameraPosition);active.update(elapsed,cameraPosition,low);},
    dispose(){disposed=true;active.dispose();},
    get streaming(){return {resident:store.resident.size,total:Object.keys(manifest.tiles).length,loading,error,keys:[...store.resident.keys()]};},
    refresh,
  };
  return {world,data,manifest,terrainSource};
}
