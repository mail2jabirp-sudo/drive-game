import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OsmMap } from '../src/osm-types.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts/import_osm.py');
const source = readFileSync(join(root, 'map.osm'));
const sourceText = source.toString('utf8');
const generated = readFileSync(join(root, 'public/maps/kottakkal.json'), 'utf8');
const map: OsmMap = JSON.parse(generated);
function temporary<T>(run: (directory: string) => T): T {
  // Keep fixtures inside this repository and outside Playwright's independently cleared results directory.
  mkdirSync(join(root, '.npm-cache'), { recursive: true });
  const directory = mkdtempSync(join(root, '.npm-cache/osm-import-'));
  try { return run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}
function sourceNode(id: string): { lat: number; lon: number } {
  const opening = sourceText.match(new RegExp(`<node id="${id}"[^>]*>`))?.[0];
  assert.ok(opening, `source node ${id} must exist`);
  return { lat: Number(opening.match(/\blat="([^"]+)"/)![1]), lon: Number(opening.match(/\blon="([^"]+)"/)![1]) };
}
function wayRefs(id: string): string[] {
  const xml = sourceText.match(new RegExp(`<way id="${id}"[^>]*>[\\s\\S]*?</way>`))?.[0];
  assert.ok(xml, `source way ${id} must exist`);
  return [...xml.matchAll(/<nd ref="(\d+)"/g)].map(match => match[1]);
}
function project(lat: number, lon: number) {
  const p = map.projection;
  return { x: p.earthRadius * Math.cos(p.latitude * Math.PI / 180) * (lon - p.longitude) * Math.PI / 180,
    z: -p.earthRadius * (lat - p.latitude) * Math.PI / 180 };
}

test('checked-in map is reproducible from the unchanged uploaded OSM source', () => temporary(directory => {
  assert.equal(map.source.sha256, createHash('sha256').update(source).digest('hex'));
  const output = join(directory, 'map.json');
  execFileSync('python3', [script, '--input', join(root, 'map.osm'), '--output', output], { encoding: 'utf8' });
  assert.equal(readFileSync(output, 'utf8'), generated, 'same source and settings must produce byte-identical map data');
  assert.deepEqual(readFileSync(join(root, 'map.osm')), source, 'import must not edit the primary source');
  assert.equal(map.projection.latitude, 11.001609);
  const unique = [...new Set(wayRefs('378587276'))].map(sourceNode);
  assert.ok(Math.abs(map.projection.latitude - unique.reduce((n, p) => n + p.lat, 0) / unique.length) < 1e-9);
  assert.ok(Math.abs(map.projection.longitude - unique.reduce((n, p) => n + p.lon, 0) / unique.length) < 1e-9);
  const provenance = JSON.parse(readFileSync(join(root, 'data/OSM_PROVENANCE.json'), 'utf8'));
  assert.equal(provenance.source.sha256, map.source.sha256);
  assert.equal(provenance.units, 'metres');
}));

test('retained real roads preserve source node order, metre coordinates and explicit shared-node connections', () => {
  assert.ok(map.roads.length > 20 && map.buildings.length > 50 && map.intersections.length > 10);
  for (const road of map.roads) {
    const refs = wayRefs(road.sourceWayId);
    assert.equal(road.points.length, road.nodeIds.length);
    assert.ok(road.points.length >= 2);
    let cursor = -1;
    for (let i = 0; i < road.nodeIds.length; i++) {
      const id = road.nodeIds[i], actual = road.points[i];
      assert.ok(actual.x >= map.bounds.minX && actual.x <= map.bounds.maxX && actual.z >= map.bounds.minZ && actual.z <= map.bounds.maxZ);
      if (id.startsWith('clip:')) continue;
      cursor = refs.indexOf(id, cursor + 1);
      assert.ok(cursor >= 0, `road ${road.id} must not invent or reorder source node ${id}`);
      const n = sourceNode(id), expected = project(n.lat, n.lon);
      assert.ok(Math.abs(actual.x - expected.x) <= 0.00051 && Math.abs(actual.z - expected.z) <= 0.00051, 'scale/axis must match source to output precision');
    }
    assert.ok(!['footway', 'path', 'cycleway', 'steps', 'track'].includes(road.highway));
    if (road.maxspeed !== null) assert.ok(road.tags.maxspeed, 'no posted speed may be invented');
  }
  for (const junction of map.intersections) {
    const sourceWays = new Set<string>();
    for (const id of junction.roadIds) {
      const road = map.roads.find(r => r.id === id)!;
      assert.ok(road);
      sourceWays.add(road.sourceWayId);
      const index = road.nodeIds.indexOf(junction.id);
      assert.ok(index >= 0, 'junction connections must use a shared original OSM node');
      assert.equal(road.points[index].x, junction.x);
      assert.equal(road.points[index].z, junction.z);
    }
    assert.ok(sourceWays.size >= 2);
  }
  for (const building of map.buildings) {
    const refs = wayRefs(building.id);
    assert.equal(refs[0], refs.at(-1), 'building source ring must be closed');
    assert.equal(building.points.length, refs.length - 1);
    const sourceFirst = sourceNode(refs[0]), expected = project(sourceFirst.lat, sourceFirst.lon);
    assert.ok(Math.abs(building.points[0].x - expected.x) < 0.00051 && Math.abs(building.points[0].z - expected.z) < 0.00051);
  }
  assert.ok(map.landmarks.some(p => p.id === 'way/378587276' && p.kind === 'bus_station' && Math.hypot(p.x, p.z) < 0.001));
  assert.ok(map.landmarks.some(p => p.kind === 'police'));
  assert.ok(map.water.some(w => w.id === '794429511' && w.kind === 'stream'));
  assert.ok(!map.water.some(w => w.id.startsWith('466438301')), 'do not include a remote meandering stream merely because its centroid is inside the slice');
});

function fixture(): string {
  const radius = 6371008.8;
  const coords: Array<[number, number, number]> = [
    [1,-200,0],[2,0,0],[3,200,0],[4,0,-200],[5,0,200],[6,-30,-50],[7,30,-50],[8,-40,-70],[9,40,-70],
    [20,-20,20],[21,20,20],[22,20,40],[23,-20,40],[24,-40,50],[25,-20,50],[26,-20,70],[27,-40,70],
    [30,30,60],[31,50,70],[40,-150,20],[41,-120,20],[42,-120,40],[43,-150,40],
  ];
  const nodes = coords.map(([id,x,z]) => `<node id="${id}" lat="${(-z/radius*180/Math.PI).toFixed(12)}" lon="${(x/radius*180/Math.PI).toFixed(12)}"/>`).join('');
  const way = (id: number, refs: number[], tags: Record<string,string>) => `<way id="${id}">${refs.map(ref=>`<nd ref="${ref}"/>`).join('')}${Object.entries(tags).map(([k,v])=>`<tag k="${k}" v="${v}"/>`).join('')}</way>`;
  return `<osm version="0.6">${nodes}` +
    way(10,[1,2,3],{highway:'primary',name:'Alpha &amp; Beta',oneway:'-1',maxspeed:'30 mph',width:'6 m'}) +
    way(11,[4,2,5],{highway:'residential',maxspeed:'signals',lanes:'2'}) +
    way(12,[6,7],{highway:'secondary',bridge:'yes',layer:'1',maxspeed:'70'}) +
    way(13,[8,9],{highway:'footway'}) + way(14,[8,9],{highway:'service',access:'private'}) +
    way(15,[8,9],{highway:'residential',motorcar:'no'}) + way(16,[1,777,3],{highway:'residential'}) +
    way(17,[2,30,31,2],{highway:'residential',junction:'roundabout'}) +
    way(20,[20,21,22,23,20],{building:'yes',height:'12 m'}) +
    way(21,[24,25,26,27,24],{building:'yes','building:levels':'2'}) +
    way(22,[20,22,21,23,20],{building:'yes'}) +
    way(23,[40,41,42,43,40],{building:'yes'}) +
    way(24,[20,21,22,23,20],{building:'yes',height:'12 m'}) +
    way(25,[24,25,26,27,24],{building:'yes','building:levels':'2'}) +
    way(30,[6,7],{waterway:'stream',name:'Mapped stream'}) +
    way(31,[20,21,22,23,20],{natural:'water',water:'pond'}) +
    `<relation id="100"><member type="way" ref="20" role="outer"/><member type="way" ref="21" role="inner"/><tag k="type" v="multipolygon"/><tag k="building" v="yes"/></relation></osm>`;
}

test('importer clips real segments, honors reverse/roundabout restrictions, avoids false bridge junctions and skips unsupported footprints', () => temporary(directory => {
  const input = join(directory, 'fixture.osm'), output = join(directory, 'fixture.json');
  writeFileSync(input, fixture());
  execFileSync('python3', [script,'--input',input,'--output',output,'--origin-lat','0','--origin-lon','0','--extent','100','--upstream-commit','fixture']);
  const data: OsmMap = JSON.parse(readFileSync(output,'utf8'));
  assert.deepEqual(data.roads.map(r=>r.sourceWayId), ['10','11','12','17']);
  const reverse = data.roads[0];
  assert.equal(reverse.oneway,'-1'); assert.equal(reverse.maxspeed,48.28); assert.equal(reverse.name,'Alpha & Beta');
  assert.equal(reverse.width,6); assert.equal(reverse.widthSource,'tag');
  assert.deepEqual(reverse.points,[{x:-100,z:0},{x:0,z:0},{x:100,z:0}]);
  assert.ok(reverse.nodeIds[0].startsWith('clip:')); assert.equal(reverse.nodeIds[1],'2');
  assert.equal(data.roads[1].maxspeed,null); assert.equal(data.roads[1].width,6.4); assert.equal(data.roads[1].widthSource,'lanes');
  assert.equal(data.roads[2].bridge,true); assert.equal(data.roads[2].layer,1);
  assert.equal(data.roads[3].oneway,'yes');
  assert.ok(data.intersections.some(j=>j.id==='2'));
  assert.ok(!data.intersections.some(j=>j.x===0 && j.z===-50), 'a geometric crossing without shared OSM node is not a junction');
  assert.deepEqual(data.buildings.map(b=>b.id), ['24','25'], 'multipolygon members, bow-tie, and incomplete boundary footprints must be omitted');
  assert.equal(data.buildings[0].height,12); assert.equal(data.buildings[0].heightSource,'tag');
  assert.equal(data.buildings[1].height,6.2); assert.equal(data.buildings[1].heightSource,'estimate');
  assert.equal(data.water.length,2);
  assert.equal(data.stats.unsupportedMultipolygons,1);
  assert.equal(data.stats.missingWayNodeReferences,1);
  assert.equal(data.stats.excludedRestrictedRoads,2);
}));

test('DTD input is rejected rather than expanding entities or editing source', () => temporary(directory => {
  const input=join(directory,'unsafe.osm'), output=join(directory,'unsafe.json');
  const raw='<!DOCTYPE osm [<!ENTITY data "expanded">]><osm><node id="1" lat="0" lon="0"/></osm>';
  writeFileSync(input,raw);
  const result=spawnSync('python3',[script,'--input',input,'--output',output,'--origin-lat','0','--origin-lon','0'],{encoding:'utf8'});
  assert.equal(result.status,1); assert.match(result.stderr,/DTD\/entity declarations/);
  assert.equal(readFileSync(input,'utf8'),raw);
}));

test('default Kottakkal import rejects a correctly named anchor in the wrong geographic location', () => temporary(directory => {
  const input = join(directory, 'wrong-location.osm'), output = join(directory, 'map.json');
  const refs = wayRefs('378587276');
  const unique = [...new Set(refs)];
  const nodes = unique.map(id => { const p = sourceNode(id); return `<node id="${id}" lat="${p.lat + 5}" lon="${p.lon}"/>`; }).join('');
  const xml = `<osm>${nodes}<way id="378587276">${refs.map(ref => `<nd ref="${ref}"/>`).join('')}<tag k="name" v="Kottakkal Bus stand"/><tag k="amenity" v="bus_station"/></way></osm>`;
  writeFileSync(input, xml);
  const result = spawnSync('python3', [script, '--input', input, '--output', output], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /incorrect Kottakkal anchor location/);
  assert.equal(readFileSync(input, 'utf8'), xml);
}));
