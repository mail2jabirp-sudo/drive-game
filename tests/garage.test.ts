import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readVehicle,withVehicle,canSwitchVehicle,DYNAMICS,engineState} from '../src/garage.ts';
import {advanceCar} from '../src/driving.ts';
import {createCompactCar} from '../src/car-model.ts';
import * as THREE from 'three';
test('vehicle preference retains every old save field and safely defaults old saves to the passenger auto',()=>{
 const legacy={money:240,phase:'dropoff',osmRide:{x:4},exportRide:{x:9}};
 assert.equal(readVehicle(null),'passenger-auto');assert.equal(readVehicle('bad'),'passenger-auto');assert.equal(readVehicle('{"vehicleId":"bus"}'),'passenger-auto');
 const raw=withVehicle(JSON.stringify(legacy),'maruti800');assert.deepEqual(JSON.parse(raw),{...legacy,vehicleId:'maruti800'});assert.equal(readVehicle(raw),'maruti800');
 assert.equal(canSwitchVehicle(2,'pickup','maruti800'),false);assert.equal(canSwitchVehicle(0,'dropoff','maruti800'),false);assert.equal(canSwitchVehicle(0,'pickup','maruti800'),true);
});
test('compact car and unchanged auto tuning have distinct acceleration, top speed and turning response',()=>{
 const surface={roadSurface:()=>true,isBlocked:()=>false},input={throttle:true,brake:false,left:false,right:false,handbrake:false};
 const auto={x:0,z:0,heading:0,speed:0,steering:0},car={...auto};
 for(let i=0;i<600;i++){advanceCar(auto,input,1/60,[],surface);advanceCar(car,input,1/60,[],surface,DYNAMICS.maruti800);}
 assert.equal(auto.speed,22);assert.equal(car.speed,32);assert.notEqual(DYNAMICS.maruti800.mass,DYNAMICS['passenger-auto'].mass);
 const a={...auto,speed:5},b={...car,speed:5};for(let i=0;i<60;i++){advanceCar(a,{...input,throttle:false,left:true},1/60,[],surface);advanceCar(b,{...input,throttle:false,left:true},1/60,[],surface,DYNAMICS.maruti800);}assert.notEqual(a.heading,b.heading);
 assert.ok(engineState('maruti800',6,true).rpm>engineState('maruti800',0,false).rpm);
});
test('compact body has four rotating tyres, actual steering pivots, interiors and bounded model geometry',()=>{
 const car=createCompactCar();let triangles=0,wheels=0;car.group.traverse(o=>{if(o.name==='Rotating wheel')wheels++;if(o instanceof THREE.Mesh)triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
 assert.equal(wheels,4);assert.ok(triangles<10000);const bounds=new THREE.Box3().setFromObject(car.group);assert.ok(bounds.max.z-bounds.min.z<3.6);assert.ok(bounds.max.x-bounds.min.x<1.9);
 car.animate(8,0.4,1);assert.equal(car.group.getObjectByName('Front steering pivot')!.rotation.y,0.4);assert.notEqual(car.group.getObjectByName('Rotating wheel')!.rotation.x,0);
});
test('the car collision footprint checks its corners instead of passing its nose through a wall',()=>{
 const car={x:0,z:0,heading:0,speed:5,steering:0};
 advanceCar(car,{throttle:false,brake:false,left:false,right:false,handbrake:false},1/90,[],{roadSurface:()=>true,isBlocked:(_x,z)=>z < -1.6},DYNAMICS.maruti800);
 assert.equal(car.speed,0);assert.equal(car.z,0);
});
