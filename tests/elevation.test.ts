import {test} from 'node:test';
import assert from 'node:assert/strict';
import {elevationSampler,roadPieces} from '../src/elevation.ts';
import type {ElevationGrid} from '../src/elevation.ts';
import {advanceCar} from '../src/driving.ts';
const fixture:ElevationGrid={version:1,projection:{latitude:0,longitude:0,earthRadius:6371008.8},bounds:{minX:0,minZ:0,maxX:100,maxZ:100},columns:2,rows:2,heights:[100,110,120,130],originElevation:100,source:{url:'synthetic-test-only',tile:'synthetic-test-only',sha256:'not-geographic-data',datum:'test metres',attribution:'Synthetic unit fixture, not Kerala DEM'}};
test('DEM grid interpolates east/north orientation and metre scale without extrapolating outside coverage',()=>{
 const height=elevationSampler(fixture);assert.equal(height(0,0),0);assert.equal(height(100,0),10);assert.equal(height(0,100),20);assert.equal(height(50,50),15);
 assert.throws(()=>height(101,0),/outside/);assert.throws(()=>height(NaN,0),/outside/);
 assert.throws(()=>elevationSampler({...fixture,heights:[100,NaN,120,130]}),/Invalid/);
 assert.throws(()=>elevationSampler({...fixture,bounds:{...fixture.bounds,maxX:NaN}}),/Invalid/);
});
test('terrain road tessellation preserves original curve endpoints and caps sampling gaps',()=>{
 const pieces=roadPieces({x:10,z:20},{x:80,z:90});assert.deepEqual(pieces[0].a,{x:10,z:20});assert.deepEqual(pieces.at(-1)!.b,{x:80,z:90});
 for(let i=0;i<pieces.length;i++){assert.ok(Math.hypot(pieces[i].b.x-pieces[i].a.x,pieces[i].b.z-pieces[i].a.z)<=8.0001);if(i)assert.deepEqual(pieces[i-1].b,pieces[i].a);}
});
test('optional measured surface grade slows uphill motion and handbrake remains stable',()=>{
 const controls={throttle:true,brake:false,left:false,right:false,handbrake:false};
 const flat={x:0,z:0,heading:0,speed:0,steering:0},up={...flat},down={...flat};
 const surface={roadSurface:()=>true,isBlocked:()=>false};
 for(let i=0;i<120;i++){advanceCar(flat,controls,1/60,[],surface);advanceCar(up,controls,1/60,[],{...surface,heightAt:(_x,z)=>-z*0.1});advanceCar(down,controls,1/60,[],{...surface,heightAt:(_x,z)=>z*0.1});}
 assert.ok(up.speed<flat.speed&&flat.speed<down.speed);assert.ok(up.speed>0);
 for(let i=0;i<120;i++)advanceCar(up,{...controls,throttle:false,handbrake:true},1/60,[],{...surface,heightAt:(_x,z)=>-z*0.1});assert.equal(up.speed,0);
});
