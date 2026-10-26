import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceCar, blocked } from '../src/driving.ts';
import { FARE, interactMission, newProgress, parseProgress } from '../src/progress.ts';
const idle = { throttle: false, brake: false, left: false, right: false, handbrake: false };
const freshCar = () => ({ x: 72, z: 36, heading: 0, speed: 0, steering: 0 });
test('throttle drives forwards, braking stops and then reverses', () => {
  const car = freshCar();
  for (let i = 0; i < 120; i++) advanceCar(car, { ...idle, throttle: true }, 1 / 60, []);
  assert.ok(car.z < 25 && car.speed > 10);
  for (let i = 0; i < 150; i++) advanceCar(car, { ...idle, brake: true }, 1 / 60, []);
  assert.ok(car.speed < 0 && car.speed >= -6);
});
test('left steering turns left and handbrake stops', () => {
  const car = freshCar(); car.speed = 12;
  for (let i = 0; i < 45; i++) advanceCar(car, { ...idle, left: true }, 1 / 60, []);
  assert.ok(car.x < 71 && car.heading > 0);
  for (let i = 0; i < 60; i++) advanceCar(car, { ...idle, handbrake: true }, 1 / 60, []);
  assert.equal(car.speed, 0);
});
test('solid obstacles and map edges stop movement', () => {
  const car = freshCar(); car.speed = 18;
  const boxes = [{ minX: 69, maxX: 75, minZ: 30, maxZ: 33 }];
  for (let i = 0; i < 120; i++) advanceCar(car, { ...idle, throttle: true }, 1 / 90, boxes);
  assert.ok(car.z >= 34.05 && car.speed === 0);
  assert.equal(blocked(116, 0, []), true);
});
test('mission requires a stopped nearby vehicle; fare is paid only on delivery', () => {
  const p = newProgress();
  assert.equal(interactMission(p, 9, 0), null);
  assert.equal(interactMission(p, 4, 3), null);
  assert.equal(interactMission(p, 4, 0), 'pickup');
  assert.equal(p.money, 0); assert.equal(p.phase, 'dropoff');
  assert.equal(interactMission(p, 200, 0), null);
  assert.equal(interactMission(p, 2, -0.5), 'dropoff');
  assert.equal(p.money, FARE); assert.equal(p.trips, 1); assert.equal(p.phase, 'pickup');
});
test('save round-trip retains money, passenger and position; malformed saves recover', () => {
  const p = { ...newProgress(), money: 240, trips: 2, phase: 'dropoff' as const, x: -72, z: -40, heading: Math.PI / 2 };
  assert.deepEqual(parseProgress(JSON.stringify(p)), p);
  for (const raw of [null, 'bad json', 'null', '{"version":2}', '[]']) assert.deepEqual(parseProgress(raw), newProgress());
  const bad = parseProgress('{"version":1,"money":-50,"x":999,"z":"hello","heading":null,"phase":"hacked"}');
  assert.deepEqual(bad, newProgress());
});
