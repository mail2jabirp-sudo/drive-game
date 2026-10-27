import type { MapPoint, OsmMap, OsmRoad } from './osm-types';
export interface RoadManifest {
  version:1; source:OsmMap['source']; projection:OsmMap['projection']; bounds:OsmMap['bounds']; tileSize:number;
  tiles:Record<string,{file:string;sha256:string;bytes:number;roads:number;vertices:number}>;
  stats:Record<string,number>; origin:{wayId:string;nodeId:string;name:string};
}
export interface RoadTile {version:1;roads:OsmRoad[]}
export function nearbyTileKeys(manifest:RoadManifest, point:MapPoint):string[] {
  const ix=Math.floor(point.x/manifest.tileSize),iz=Math.floor(point.z/manifest.tileSize);
  const result:string[]=[];
  for(let x=ix-1;x<=ix+1;x++)for(let z=iz-1;z<=iz+1;z++){const key=`${x},${z}`;if(manifest.tiles[key])result.push(key);}
  return result.sort();
}
export class RoadTileStore {
  readonly resident=new Map<string,RoadTile>();
  constructor(readonly manifest:RoadManifest,private fetcher:typeof fetch=globalThis.fetch.bind(globalThis),private base=`${import.meta.env?.BASE_URL ?? '/'}maps/malappuram/`) {}
  key(point:MapPoint):string{return nearbyTileKeys(this.manifest,point).join(';');}
  async load(point:MapPoint):Promise<void> {
    const keys=nearbyTileKeys(this.manifest,point);
    if(!keys.length)throw new Error('No mapped road tiles at this position');
    // Prepare the whole local window before evicting, so a failed request preserves playable geometry.
    const loaded=await Promise.all(keys.map(async key=>{
      const existing=this.resident.get(key);if(existing)return [key,existing] as const;
      const descriptor=this.manifest.tiles[key];
      if(!/^-?\d+_-?\d+\.json$/.test(descriptor.file))throw new Error('Invalid tile filename');
      const response=await this.fetcher(this.base+descriptor.file,{signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error(`Road tile unavailable: ${key}`);
      const bytes=await response.arrayBuffer();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==descriptor.sha256)throw new Error(`Road tile checksum mismatch: ${key}`);
      const data=JSON.parse(new TextDecoder().decode(bytes)) as RoadTile;
      if(data.version!==1||!Array.isArray(data.roads))throw new Error('Invalid road tile');
      return [key,data] as const;
    }));
    this.resident.clear();for(const [key,data] of loaded)this.resident.set(key,data);
  }
  hasPosition(x:number,z:number):boolean{return this.resident.has(`${Math.floor(x/this.manifest.tileSize)},${Math.floor(z/this.manifest.tileSize)}`);}
  roads():OsmRoad[] {
    const seen=new Set<string>();const roads:OsmRoad[]=[];
    for(const tile of this.resident.values())for(const road of tile.roads){const key=road.sourceWayId+':'+road.nodeIds.join('/');if(!seen.has(key)){seen.add(key);roads.push(road);}}
    return roads;
  }
}
