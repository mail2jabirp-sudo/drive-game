import * as THREE from 'three';

/** A restrained humid morning sky; not a simulation of measured weather. */
export function createAtmosphere(scene: THREE.Scene): {update:(cameraPosition:THREE.Vector3)=>void} {
  const geometry = new THREE.SphereGeometry(480, 24, 12);
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  const horizon = new THREE.Color('#dfe5df');
  const zenith = new THREE.Color('#80a6bc');
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const t = Math.pow(Math.max(0, positions.getY(i) / 480), 0.65);
    color.copy(horizon).lerp(zenith, t);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.name = 'Humid morning sky'; sky.renderOrder = -10; scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: '#fff3d7', fog: false, depthWrite: false }));
  sun.position.set(-180, 280, 100); sun.lookAt(0, 0, 0); sun.renderOrder = -9;
  sun.name = 'Morning sun disc'; scene.add(sun);
  const direction = sun.position.clone();
  return {update(cameraPosition) {sky.position.copy(cameraPosition); sun.position.copy(cameraPosition).add(direction); sun.lookAt(cameraPosition);}};
}
