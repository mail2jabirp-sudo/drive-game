import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GraphicsBudget, parseGraphicsMode } from '../src/graphics.ts';
test('invalid display preferences default to Auto without changing saved gameplay', () => {
  assert.equal(parseGraphicsMode(null), 'auto');
  assert.equal(parseGraphicsMode('corrupt'), 'auto');
  assert.equal(parseGraphicsMode('low'), 'low');
});
test('sustained slow frames reduce detail while isolated stalls do not', () => {
  const budget = new GraphicsBudget('auto');
  budget.observeFrame(0.5);
  for (let i = 0; i < 5; i++) budget.observeFrame(1 / 60);
  assert.equal(budget.lowDetail, false);
  for (let i = 0; i < 9; i++) budget.observeFrame(0.1);
  assert.equal(budget.lowDetail, true);
  for (let i = 0; i < 120; i++) budget.observeFrame(1 / 60);
  assert.equal(budget.lowDetail, true, 'do not oscillate graphics quality while driving');
  budget.setMode('auto'); assert.equal(budget.lowDetail, false);
  budget.observeFrame(NaN); assert.equal(budget.lowDetail, false);
});
test('Battery saver is immediately active and switching back retries standard', () => {
  const budget = new GraphicsBudget('low');
  assert.equal(budget.lowDetail, true);
  budget.setMode('auto'); assert.equal(budget.lowDetail, false);
  budget.setMode('low'); assert.equal(budget.lowDetail, true);
});

test('explicit Medium and High selections persist and do not use Auto fallback',()=>{
 for(const mode of ['medium','high'] as const){assert.equal(parseGraphicsMode(mode),mode);const budget=new GraphicsBudget(mode);for(let n=0;n<15;n++)budget.observeFrame(.1);assert.equal(budget.lowDetail,false);assert.equal(budget.mode,mode);}
});
