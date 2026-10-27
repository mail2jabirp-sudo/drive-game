import {DYNAMICS} from './garage';
import type {VehicleDynamics} from './garage';
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
  isBlocked: (x: number, z: number, radius?:number) => boolean;
}
export function advanceCar(car: DriveState, input: Controls, dt: number, boxes: Box[], surface?: DriveSurface, dynamics:VehicleDynamics=DYNAMICS['passenger-auto']): boolean {
  const oldSpeed = car.speed;
  const offroad = !(surface?.roadSurface ?? onRoad)(car.x, car.z);
  if (input.throttle) car.speed += (car.speed < 0 ? dynamics.reverseBraking : dynamics.acceleration) * dt;
  if (input.brake) car.speed -= (car.speed > 0 ? dynamics.braking : dynamics.reverseAcceleration) * dt;
  if (!input.throttle && !input.brake) car.speed = approach(car.speed, 0, (offroad ? 4.5 : dynamics.rollingResistance) * dt);
  if (input.handbrake) car.speed = approach(car.speed, 0, 24 * dt);
  if(surface?.heightAt && !input.handbrake && Math.abs(car.speed)>0.05){
    const dx=-Math.sin(car.heading),dz=-Math.cos(car.heading);
    const gradient=(surface.heightAt(car.x+dx*0.6,car.z+dz*0.6)-surface.heightAt(car.x-dx*0.6,car.z-dz*0.6))/1.2;
    car.speed-=9.81*Math.sin(Math.atan(gradient))*dt;
  }
  car.speed = Math.max(-dynamics.reverseSpeed, Math.min(offroad ? 9 : dynamics.maxSpeed, car.speed));
  const targetSteer = (Number(input.left) - Number(input.right)) * dynamics.maxSteer;
  car.steering += (targetSteer - car.steering) * Math.min(1, dt * dynamics.steerResponse);
  // Bicycle model: front points down -Z; reversing naturally reverses steering.
  const steeringAtSpeed = car.steering / (1 + Math.abs(car.speed) * 0.055);
  car.heading += car.speed / dynamics.wheelbase * Math.tan(steeringAtSpeed) * dt;
  const nx = car.x - Math.sin(car.heading) * car.speed * dt;
  const nz = car.z - Math.cos(car.heading) * car.speed * dt;
  const collision=surface ? vehicleBlocked(nx,nz,car.heading,surface,dynamics) : blocked(nx,nz,boxes);
  if (collision) {
    car.speed = 0;
    return Math.abs(oldSpeed) > 3;
  }
  car.x = nx;
  car.z = nz;
  return false;
}
export function vehicleBlocked(x:number,z:number,heading:number,surface:DriveSurface,dynamics:VehicleDynamics):boolean {
  if(surface.isBlocked(x,z))return true;
  if(dynamics.halfWidth&&dynamics.halfLength)for(const side of [-1,1])for(const end of [-1,0,1]){
    const px=x+Math.cos(heading)*side*dynamics.halfWidth-Math.sin(heading)*end*dynamics.halfLength;
    const pz=z-Math.sin(heading)*side*dynamics.halfWidth-Math.cos(heading)*end*dynamics.halfLength;
    if(surface.isBlocked(px,pz,0.12))return true;
  }
  return false;
}
function approach(value: number, target: number, delta: number): number {
  return value > target ? Math.max(target, value - delta) : Math.min(target, value + delta);
}
