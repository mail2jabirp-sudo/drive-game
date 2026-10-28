import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {RoadTileStore} from '../src/road-tiles';
const json=(p:string)=>JSON.parse(readFileSync(p,'utf8')),m=json('public/maps/district/manifest.json');
test('full-source tiling preserves every eligible way, disconnected components and directed return routes',()=>{
 const result=JSON.parse(execFileSync('python3',['scripts/audit_tiles.py'],{encoding:'utf8',maxBuffer:200000})),source=json('data/WORLD_AUDIT.json').sources[0];
 assert.equal(result.uniqueMotorWays,source.eligibleMotorWays);assert.equal(result.weakComponents,source.weakComponents);assert.equal(result.sharedNodeCoordinateConflicts,0);assert.ok(result.originalRoundTripNodes>490000);assert.ok(result.farRoundTripExamples.some((p:any)=>Math.abs(p.x)>18000&&Math.abs(p.z)>18000));assert.equal(result.bridgeWays,783);
 assert.equal(m.selection.mode,'all-eligible-source-roads');assert.deepEqual(m.projection,json('data/WORLD_GAME_ANCHORS.json').projection);assert.deepEqual(m.teaStop,json('data/WORLD_GAME_ANCHORS.json').teaStop);
});
test('streamed overlapping source features deduplicate at tile edges and flagged road overlaps stay out of collision data',()=>{
 const store=new RoadTileStore(m),a={id:'same',points:[{x:0,z:0}],tags:{},kind:'yes',name:'',height:5,heightSource:'estimate' as const},b={...a,id:'conflicting',renderExcludedReason:'source-road-buffer-overlap'};
 store.resident.set('0,0',{version:1,roads:[],buildings:[a,b],landuse:[{id:'field',name:'',kind:'farmland',points:[],tags:{}}]});store.resident.set('1,0',{version:1,roads:[],buildings:[a],landuse:[{id:'field',name:'',kind:'farmland',points:[],tags:{}}]});assert.deepEqual(store.features().buildings.map(b=>b.id),['same']);assert.equal(store.features().landuse.length,1);
});
