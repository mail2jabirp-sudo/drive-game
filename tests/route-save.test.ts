import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, parseProgress } from '../src/progress.ts';
import { readOsmRide, serializeRouteProgress } from '../src/route-save.ts';
const pose = {x: 72, z: -12, heading: 0, phase: 'dropoff' as const};
const ride = {version: 1 as const, mapId: 'a'.repeat(64), x: 288, z: -324, heading: 1, phase: 'pickup' as const};
test('real-map earnings persist atomically without overwriting the practice passenger or position', () => {
  const current = {...newProgress(), money: 120, trips: 1, phase: 'pickup' as const};
  const raw = serializeRouteProgress(current, pose, ride);
  assert.deepEqual(parseProgress(raw), {...current,...pose});
  assert.deepEqual(readOsmRide(raw),ride);
});
test('saving practice progress retains the parked real-map ride', () => {
  const current = {...newProgress(), money: 110, teaBreaks:1};
  const raw = serializeRouteProgress(current, null, ride);
  assert.deepEqual(parseProgress(raw),current); assert.deepEqual(readOsmRide(raw),ride);
});
test('legacy or damaged ride data cannot become an invalid map position', () => {
  assert.equal(readOsmRide(JSON.stringify(newProgress())),null);
  for(const raw of ['bad','null','{}', JSON.stringify({osmRide:{...ride,x:'bad'}}),JSON.stringify({osmRide:{...ride,mapId:'wrong'}})]) assert.equal(readOsmRide(raw),null);
});
