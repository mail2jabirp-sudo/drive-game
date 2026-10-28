import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('public/maps/district/manifest.json'));
test('Phase 06 preserves both original OSM sources, Kerala projection and district coverage',()=>{
 assert.equal(createHash('sha256').update(read('map.osm')).digest('hex'),'d7ef65eeb57978269dcbb2404fe32120f93e42f795bbb0ef96c1bb08f49d4add');
 assert.equal(createHash('sha256').update(read('export.osm')).digest('hex'),'7915b6d48899723c3dd4a88dfd8c3db64d77e0e85e60d9e99511c2bb6b7ac3f2');
 assert.deepEqual(manifest.projection,{latitude:11.0544807,longitude:76.0863541,earthRadius:6371008.8});assert.equal(Object.keys(manifest.tiles).length,8315);assert.equal(manifest.featureConflicts.excludedBuildingIds.length,311);
});
test('mapped office tags survive extraction without moving a previously withheld footprint',()=>{
 const raw=read('map.osm'),id='378584865',way=raw.match(new RegExp('<way\\b[^>]*id="'+id+'"[^>]*>[\\s\\S]*?</way>'))![0];assert.ok(way.includes('k="office" v="government"'));
 const p=manifest.projection,source=[...way.matchAll(/<nd ref="(\d+)"/g)].map(m=>{const node=raw.match(new RegExp('<node\\b[^>]*id="'+m[1]+'"[^>]*>'))![0],lat=Number(node.match(/lat="([^"]+)"/)![1]),lon=Number(node.match(/lon="([^"]+)"/)![1]);return {x:p.earthRadius*Math.cos(p.latitude*Math.PI/180)*(lon-p.longitude)*Math.PI/180,z:-p.earthRadius*(lat-p.latitude)*Math.PI/180};});
 const key=`${Math.floor(source[0].x/600)},${Math.floor(source[0].z/600)}`,tile=JSON.parse(read('public/maps/district/'+manifest.tiles[key].file)),building=tile.buildings.find((b:any)=>b.id===id);
 assert.equal(building.tags.office,'government');assert.equal(building.renderExcludedReason,'source-road-buffer-overlap');
 for(const point of building.points)assert.ok(source.some(q=>Math.hypot(q.x-point.x,q.z-point.z)<.001));
});
