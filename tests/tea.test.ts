import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyTea, TEA_PRICE } from '../src/tea.ts';

test('a nearby stopped driver can pay for a tea break', () => {
  const wallet = { money: 120, teaBreaks: 0 };
  assert.equal(buyTea(wallet, 9, -1), 'bought');
  assert.deepEqual(wallet, { money: 120 - TEA_PRICE, teaBreaks: 1 });
});
test('tea never charges a distant, moving, or broke driver', () => {
  const wallet = { money: 120, teaBreaks: 2 };
  assert.equal(buyTea(wallet, 9.01, 0), 'too-far');
  assert.equal(buyTea(wallet, 1, 2), 'moving');
  assert.equal(buyTea(wallet, 1, -2), 'moving');
  assert.deepEqual(wallet, { money: 120, teaBreaks: 2 });
  wallet.money = 9;
  assert.equal(buyTea(wallet, 1, 0), 'insufficient');
  assert.deepEqual(wallet, { money: 9, teaBreaks: 2 });
});
test('the exact tea price is sufficient and invalid distances or speeds do not charge', () => {
  const wallet = { money: 10, teaBreaks: 0 };
  assert.equal(buyTea(wallet, NaN, 0), 'too-far');
  assert.equal(buyTea(wallet, 1, Infinity), 'moving');
  assert.equal(wallet.money, 10);
  assert.equal(buyTea(wallet, 0, 0), 'bought');
  assert.deepEqual(wallet, { money: 0, teaBreaks: 1 });
});
