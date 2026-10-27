export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }
export interface DriveState { x: number; z: number; heading: number; speed: number; steering: number }
export interface Controls { throttle: boolean; brake: boolean; left: boolean; right: boolean; handbrake: boolean }
export const onRoad = (x: number, z: number): boolean =>
  (Math.abs(Math.abs(x) - 72) <= 9.8 && Math.abs(z) <= 71.8) ||
  (Math.abs(Math.abs(z) - 62) <= 9.8 && Math.abs(x) <= 81.8);
export function blocked(x: number, z: number, boxes: Box[]): boolean {
  const r = 1.05;
  return Math.abs(x) > 115 || Math.abs(z) > 105 || boxes.some(b => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ);
}
export interface DriveSurface {
  heightAt?: (x:number,z:number)=>number;
  roadSurface: (x: number, z: number) => boolean;
  isBlocked: (x: number, z: number) => boolean;
}
export function advanceCar(car: DriveState, input: Controls, dt: number, boxes: Box[], surface?: DriveSurface): boolean {
  const oldSpeed = car.speed;
  const offroad = !(surface?.roadSurface ?? onRoad)(car.x, car.z);
  if (input.throttle) car.speed += (car.speed < 0 ? 14 : 7) * dt;
  if (input.brake) car.speed -= (car.speed > 0 ? 16 : 4) * dt;
  if (!input.throttle && !input.brake) car.speed = approach(car.speed, 0, (offroad ? 4.5 : 1.6) * dt);
  if (input.handbrake) car.speed = approach(car.speed, 0, 24 * dt);
  if(surface?.heightAt && !input.handbrake && Math.abs(car.speed)>0.05){
    const dx=-Math.sin(car.heading),dz=-Math.cos(car.heading);
    const gradient=(surface.heightAt(car.x+dx*0.6,car.z+dz*0.6)-surface.heightAt(car.x-dx*0.6,car.z-dz*0.6))/1.2;
    car.speed-=9.81*Math.sin(Math.atan(gradient))*dt;
  }
  car.speed = Math.max(-6, Math.min(offroad ? 9 : 22, car.speed));
  const targetSteer = (Number(input.left) - Number(input.right)) * 0.52;
  car.steering += (targetSteer - car.steering) * Math.min(1, dt * 9);
  // Bicycle model: front points down -Z; reversing naturally reverses steering.
  const steeringAtSpeed = car.steering / (1 + Math.abs(car.speed) * 0.055);
  car.heading += car.speed / 2.4 * Math.tan(steeringAtSpeed) * dt;
  const nx = car.x - Math.sin(car.heading) * car.speed * dt;
  const nz = car.z - Math.cos(car.heading) * car.speed * dt;
  if (surface ? surface.isBlocked(nx, nz) : blocked(nx, nz, boxes)) {
    car.speed = 0;
    return Math.abs(oldSpeed) > 3;
  }
  car.x = nx;
  car.z = nz;
  return false;
}
function approach(value: number, target: number, delta: number): number {
  return value > target ? Math.max(target, value - delta) : Math.min(target, value + delta);
}
