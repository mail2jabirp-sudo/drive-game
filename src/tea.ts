/** A small optional roadside stop; no timers or fare bonuses to pressure a break. */
export const TEA_PRICE = 10;
export const TEA_STOP = { x: -72, z: 20 } as const;
export type TeaResult = 'bought' | 'too-far' | 'moving' | 'insufficient';
export function buyTea(wallet: { money: number; teaBreaks: number }, distance: number, speed: number): TeaResult {
  if (!Number.isFinite(distance) || distance > 9 || distance < 0) return 'too-far';
  if (!Number.isFinite(speed) || Math.abs(speed) >= 2) return 'moving';
  if (!Number.isFinite(wallet.money) || wallet.money < TEA_PRICE) return 'insufficient';
  wallet.money -= TEA_PRICE;
  wallet.teaBreaks += 1;
  return 'bought';
}
