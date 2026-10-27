import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('HGT importer preserves endian, geographic orientation, metre heights and honest local provenance',()=>{
  const folder=mkdtempSync(join(tmpdir(),'en3d-dem-test-'));
  try {
    const input=join(folder,'N11E076.hgt.gz'),output=join(folder,'terrain-test.json'),provenance=join(folder,'provenance-test.json');
    // Synthetic HGT is confined to temp files, not the served map. Row+column plane has known heights.
    const make=spawnSync('python3',['-c',`import array,gzip,sys
h=array.array('h',(row+col for row in range(1201) for col in range(1201)))
if sys.byteorder=='little':h.byteswap()
with gzip.open(sys.argv[1],'wb') as f:f.write(h.tobytes())`,input],{encoding:'utf8'});
    assert.equal(make.status,0,make.stderr);
    const args=['scripts/prepare_elevation.py','--input',input,'--output',output,'--provenance',provenance];
    const missing=spawnSync('python3',args,{encoding:'utf8'});assert.notEqual(missing.status,0);assert.match(missing.stderr,/provenance cannot be inferred/);
    const run=spawnSync('python3',[...args,'--source-url','synthetic-test-only','--attribution','Synthetic test only, not geographic data'],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const grid=JSON.parse(readFileSync(output,'utf8'));
    const p=grid.projection,expected=(12-p.latitude+p.longitude-76)*1200;
    assert.ok(Math.abs(grid.originElevation-expected)<0.01);assert.equal(grid.heights.length,81*81);
    assert.ok(grid.heights[80]>grid.heights[0],'east is increasing HGT columns');
    assert.ok(grid.heights[80*81]>grid.heights[0],'south is increasing HGT rows');
    assert.equal(grid.verticalScale,1);assert.equal(grid.source.url,'synthetic-test-only');assert.equal(grid.source.sha256.length,64);
    assert.ok(!('heights' in JSON.parse(readFileSync(provenance,'utf8'))));
    const repeat=spawnSync('python3',[...args,'--source-url','synthetic-test-only','--attribution','test'],{encoding:'utf8'});
    assert.notEqual(repeat.status,0);assert.match(repeat.stderr,/before replacing/);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
