import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** All geometry is made here; no external models, textures, or paid assets. */
export function createRickshaw(): {
  group: THREE.Group;
  setOccupied:(occupied:boolean)=>void;
  animate: (speed: number, steering: number, elapsed: number, braking?:boolean) => void;
} {
  const group = new THREE.Group();
  group.name = 'Kottakkal auto-rickshaw';
  const yellow = new THREE.MeshStandardMaterial({ color: '#f5bc28', roughness: 0.48 });
  const charcoal = new THREE.MeshStandardMaterial({ color: '#15211e', roughness: 0.53 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#151f22', roughness: 0.97 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c0d1c7', metalness: 0.65, roughness: 0.28 });
  const seat = new THREE.MeshStandardMaterial({ color: '#5a3930', roughness: 0.92 });
  const glass = new THREE.MeshStandardMaterial({
    color: '#adede5', transparent: true, opacity: 0.27,
    roughness: 0.12, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false,
  });
  const headlamp = new THREE.MeshStandardMaterial({
    color: '#fff4c6', emissive: '#ffdc89', emissiveIntensity: 0.9, roughness: 0.2,
  });
  const tailLamp = new THREE.MeshStandardMaterial({
    color: '#dd5040', emissive: '#a62a19', emissiveIntensity: 0.45,
  });
  tailLamp.name='Autorickshaw brake lights';
  const amber = new THREE.MeshStandardMaterial({ color: '#ff841a', emissive: '#f77012', emissiveIntensity: 0.3 });

  function box(
    parent: THREE.Object3D, size: [number, number, number],
    position: [number, number, number], material: THREE.Material,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function bar(parent: THREE.Object3D, from: number[], to: number[], radius = 0.035, material = chrome): void {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 7), material);
    mesh.position.copy(a).lerp(b, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    mesh.castShadow = true;
    parent.add(mesh);
  }

  function sphere(parent: THREE.Object3D, position: number[], scale: number[], material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), material);
    mesh.position.set(...position as [number, number, number]);
    mesh.scale.set(...scale as [number, number, number]);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Chassis, broad passenger cabin and the tapered nose over its single wheel.
  box(group, [1.6, 0.18, 2.65], [0, 0.48, 0.1], charcoal);
  box(group, [1.68, 0.55, 1.4], [0, 0.8, 0.68], charcoal);
  box(group, [1.64, 0.1, 2.55], [0, 0.58, 0.05], yellow);
  box(group, [1.3, 0.44, 0.62], [0, 0.87, -1.04], yellow);
  const bonnet = box(group, [1.3, 0.12, 0.66], [0, 1.11, -1.05], yellow);
  bonnet.rotation.x = 0.16;
  box(group, [1.47, 0.15, 0.13], [0, 0.64, -1.42], chrome);
  box(group, [1.67, 0.1, 0.12], [0, 0.61, 1.49], chrome);
  for (const side of [-1, 1]) {
    box(group, [0.13, 0.32, 1.36], [side * 0.8, 0.9, 0.7], charcoal);
    box(group, [0.17, 0.09, 1.58], [side * 0.82, 0.61, 0.55], chrome);
    box(group, [0.25, 0.07, 0.75], [side * 0.87, 0.43, -0.15], chrome);
    // Characteristic curved rear wheel arches.
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.075, 6, 14, Math.PI), charcoal);
    arch.rotation.y = Math.PI / 2;
    arch.position.set(side * 0.85, 0.43, 0.85);
    group.add(arch);
  }

  // Passenger bench and driver, visible through the open sides.
  box(group, [1.35, 0.16, 0.48], [0, 0.96, 0.9], seat);
  box(group, [1.35, 0.52, 0.14], [0, 1.26, 1.15], seat);
  box(group, [0.64, 0.13, 0.47], [0, 0.96, -0.4], seat);
  box(group, [0.6, 0.49, 0.13], [0, 1.19, -0.18], seat);
  const driver=new THREE.Group();driver.name="Seated player driver";group.add(driver);
  const shirt = new THREE.MeshStandardMaterial({ color: '#c5b38c', roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: '#9b6545', roughness: 1 });
  const hair = new THREE.MeshStandardMaterial({ color: '#1c2828', roughness: 1 });
  sphere(driver, [0, 1.33, -0.4], [0.23, 0.32, 0.16], shirt);
  sphere(driver, [0, 1.72, -0.43], [0.15, 0.18, 0.15], skin);
  sphere(driver, [0, 1.82, -0.41], [0.153, 0.09, 0.15], hair);
  for (const side of [-1, 1]) {
    bar(driver, [side * 0.2, 1.48, -0.42], [side * 0.28, 1.31, -0.85], 0.065, shirt);
    sphere(driver, [side * 0.28, 1.31, -0.85], [0.07, 0.07, 0.07], skin);
  }
  bar(group, [-0.35, 1.3, -0.86], [0.35, 1.3, -0.86], 0.035, charcoal);
  bar(group, [0, 1.3, -0.86], [0, 0.95, -1], 0.045, charcoal);

  const cabin = new THREE.Group();
  group.add(cabin);
  // Soft domed yellow canopy, black edging, rear rain curtain and window.
  sphere(cabin, [0, 2.17, 0.1], [0.91, 0.17, 1.47], yellow);
  box(cabin, [1.79, 0.07, 2.67], [0, 2.1, 0.08], charcoal);
  box(cabin, [1.69, 0.9, 0.12], [0, 1.61, 1.38], charcoal);
  box(cabin, [1.17, 0.42, 0.025], [0, 1.7, 1.45], glass);
  for (const side of [-1, 1]) {
    bar(cabin, [side * 0.68, 1.11, -1.29], [side * 0.79, 2.09, -1.05], 0.052, charcoal);
    bar(cabin, [side * 0.81, 1.07, 0.65], [side * 0.84, 2.08, 0.65], 0.039, charcoal);
    bar(cabin, [side * 0.82, 1.03, 1.32], [side * 0.83, 2.08, 1.32], 0.046, charcoal);
    // Mirrors extending beyond the cab silhouette.
    bar(group, [side * 0.66, 1.35, -1.16], [side * 1, 1.55, -1.12], 0.022);
    sphere(group, [side * 1, 1.59, -1.12], [0.1, 0.15, 0.045], charcoal);
    box(group, [0.12, 0.08, 0.04], [side * 0.6, 0.94, -1.37], amber);
    box(group, [0.14, 0.18, 0.04], [side * 0.66, 0.87, 1.41], tailLamp);
  }
  const windshield = box(cabin, [1.35, 0.81, 0.025], [0, 1.64, -1.18], glass);
  windshield.rotation.x = 0.235;
  bar(cabin, [-0.66, 2.04, -1.06], [0.66, 2.04, -1.06], 0.045, charcoal);
  bar(cabin, [-0.61, 1.18, -1.29], [0.61, 1.18, -1.29], 0.04, charcoal);
  bar(cabin, [0.1, 1.25, -1.31], [-0.27, 1.62, -1.22], 0.013, charcoal);
  sphere(group, [0, 0.91, -1.38], [0.18, 0.18, 0.048], chrome);
  sphere(group, [0, 0.91, -1.425], [0.14, 0.14, 0.023], headlamp);
  for (let index = 0; index < 4; index++) {
    box(group, [0.47, 0.018, 0.02], [0, 0.72 + index * 0.035, -1.37], charcoal);
  }

  const wheelMeshes: THREE.Group[] = [];
  const frontSteering = new THREE.Group();
  frontSteering.name='Front steering fork';
  frontSteering.position.set(0, 0.34, -1.15);
  group.add(frontSteering);
  function wheel(parent: THREE.Object3D, x: number, y: number, z: number): void {
    const wheelGroup = new THREE.Group();wheelGroup.name='Rolling wheel';
    wheelGroup.position.set(x, y, z);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.23, 18), rubber);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    wheelGroup.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.245, 12), chrome);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);
    // Contrasting hub bolt makes rotation readable at low speed.
    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.05), charcoal);
    bolt.position.y = 0.1;
    wheelGroup.add(bolt);
    parent.add(wheelGroup);
    wheelMeshes.push(wheelGroup);
  }
  wheel(frontSteering, 0, 0, 0);
  wheel(group, -0.77, 0.34, 0.9);
  wheel(group, 0.77, 0.34, 0.9);
  bar(frontSteering, [-0.16, 0, 0], [-0.16, 0.53, 0.1], 0.032);
  bar(frontSteering, [0.16, 0, 0], [0.16, 0.53, 0.1], 0.032);

  // A small locally rendered plate, also visible while following the auto.
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#f6c83e';
    context.fillRect(0, 0, 256, 96);
    context.fillStyle = '#1a2928';
    context.font = 'bold 31px sans-serif';
    context.textAlign = 'center';
    context.fillText('KL 10 2026', 128, 59);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const plateMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75 });
    const rearPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.2), plateMaterial);
    rearPlate.position.set(0, 0.79, 1.432);
    group.add(rearPlate);
    const frontPlate = rearPlate.clone();
    frontPlate.position.set(0, 0.57, -1.493);
    frontPlate.rotation.y = Math.PI;
    group.add(frontPlate);
  }

  // Batch only static direct children. Wheels, fork and canopy retain their
  // independent transforms, steering, suspension and rolling animation.
  for(const parent of [group,cabin,driver]){
    const batches=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of parent.children)if(child instanceof THREE.Mesh&&!Array.isArray(child.material)){const list=batches.get(child.material)??[];list.push(child);batches.set(child.material,list);}
    const oldGeometry=new Set<THREE.BufferGeometry>();
    for(const [material,meshes] of batches){if(meshes.length<2)continue;
      const pieces=meshes.map(mesh=>{mesh.updateMatrix();const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrix);oldGeometry.add(mesh.geometry);return g;});
      const geometry=mergeGeometries(pieces,false);if(!geometry)throw new Error('Vehicle geometry batching failed');
      const mesh=new THREE.Mesh(geometry,material);mesh.name='Batched autorickshaw body';mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
      for(const old of meshes)parent.remove(old);for(const g of pieces)g.dispose();
    }
    for(const g of oldGeometry)g.dispose();
  }
  let lastElapsed = 0;
  let rotation = 0;
  return {
    group,
    setOccupied(occupied){driver.visible=occupied;},
    animate(speed, steering, elapsed, braking=false) {
      tailLamp.emissiveIntensity=braking?2.2:.45;
      const dt = Math.max(0, Math.min(elapsed - lastElapsed, 0.1));
      lastElapsed = elapsed;
      rotation -= speed * dt / 0.34;
      wheelMeshes.forEach((mesh) => { mesh.rotation.x = rotation; });
      frontSteering.rotation.y = steering * 0.45;
      // Vibration stays local to the canopy, so physics and camera remain stable.
      cabin.position.y = Math.sin(elapsed * 35) * Math.min(0.008, Math.abs(speed) * 0.001);
      cabin.rotation.z = -steering * Math.min(0.025, Math.abs(speed) * 0.0015);
    },
  };
}
