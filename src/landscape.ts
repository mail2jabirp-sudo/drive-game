import * as THREE from 'three';

/** Scenic surroundings for the fictional practice loop; no geographic claim or road changes. */
export function createLandscape(scene: THREE.Scene): {
  update: (cameraPosition: THREE.Vector3) => void;
  setLowDetail: (low: boolean) => void;
  chunkCount: number;
} {
  const root = new THREE.Group();
  root.name = 'Kerala practice-area surroundings';
  scene.add(root);
  interface Detail { object: THREE.Object3D; distance: number; showOnLow: boolean }
  interface Chunk { group: THREE.Group; center: THREE.Vector3; radius: number; details: Detail[] }
  const chunks: Chunk[] = [];
  let lowDetail = false;
  let seed = 0x4b455241;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const color = (hex: string, roughness = 0.95) => new THREE.MeshStandardMaterial({ color: hex, roughness });
  const earth = color('#73664b');
  const stemMaterial = color('#777660');
  const groveMaterial = color('#a4b39b');
  const barkMaterial = color('#78766a');
  const darkBarkMaterial = color('#56594d');
  const leafMaterial = new THREE.MeshStandardMaterial({ color: '#426c41', roughness: 0.87, side: THREE.DoubleSide });
  const palmLeafMaterial = new THREE.MeshStandardMaterial({ color: '#3f6541', roughness: 0.9, side: THREE.DoubleSide });
  const riceMaterial = new THREE.MeshStandardMaterial({ color: '#6d843d', roughness: 1, side: THREE.DoubleSide });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitTrunk = new THREE.CylinderGeometry(0.8, 1, 1, 7);
  const canopyGeometry = new THREE.SphereGeometry(1, 10, 7);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  function chunk(name: string, x: number, z: number, radius: number): Chunk {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, 0, z);
    root.add(group);
    const result = { group, center: new THREE.Vector3(x, 0, z), radius, details: [] };
    chunks.push(result);
    return result;
  }
  function instances(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, count: number, name: string): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function place(mesh: THREE.InstancedMesh, index: number, position: number[], scale: number[], rotation: number[] = [0, 0, 0]): void {
    dummy.position.set(position[0], position[1], position[2]);
    dummy.rotation.set(rotation[0], rotation[1], rotation[2]);
    dummy.scale.set(scale[0], scale[1], scale[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  function finish(mesh: THREE.InstancedMesh): void {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }
  function detail(c: Chunk, object: THREE.Object3D, distance: number, showOnLow = false): void {
    c.details.push({ object, distance, showOnLow });
  }
  function surfaceTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#727e49'; ctx.fillRect(0, 0, 96, 96);
    for (let i = 0; i < 2100; i++) {
      const shade = 65 + Math.floor(random() * 36);
      ctx.fillStyle = `rgba(${shade},${shade + 22},${Math.floor(shade * 0.55)},0.42)`;
      ctx.fillRect(random() * 96, random() * 96, 1, 2 + random() * 3);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 10); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const paddyMaterial = new THREE.MeshStandardMaterial({ map: surfaceTexture(), roughness: 1 });

  // Three curved rice blades share one tiny geometry, repeated in orderly planted rows.
  function riceGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    for (let n = 0; n < 3; n++) {
      const a = n / 3 * Math.PI * 2;
      const dx = Math.cos(a), dz = Math.sin(a);
      const sideX = -dz * 0.04, sideZ = dx * 0.04;
      const mid = [dx * 0.1, 0.43, dz * 0.1];
      const tip = [dx * 0.38, 0.62 + n * 0.045, dz * 0.38];
      positions.push(-sideX, 0, -sideZ, sideX, 0, sideZ, mid[0] + sideX, mid[1], mid[2] + sideZ,
        -sideX, 0, -sideZ, mid[0] + sideX, mid[1], mid[2] + sideZ, mid[0] - sideX, mid[1], mid[2] - sideZ,
        mid[0] - sideX, mid[1], mid[2] - sideZ, mid[0] + sideX, mid[1], mid[2] + sideZ, ...tip);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals(); return geometry;
  }
  const rice = riceGeometry();
  for (const z of [-50, 0, 50]) {
    const c = chunk(`Paddy plots ${z}`, 161, z, 51);
    const plots = instances(c.group, unitBox, paddyMaterial, 2, 'Low rice-field surfaces');
    const bunds = instances(c.group, unitBox, earth, 8, 'Earthen paddy bunds');
    const plants = instances(c.group, rice, riceMaterial, 528, 'Instanced planted rice');
    let index = 0;
    for (let field = 0; field < 2; field++) {
      const cx = field === 0 ? -19 : 19;
      place(plots, field, [cx, 0.055, 0], [33, 0.06, 44]);
      const variation = 0.94 + random() * 0.08;
      tint.setRGB(variation, variation, variation); plots.setColorAt(field, tint);
      place(bunds, field * 4, [cx, 0.18, -22.6], [35.2, 0.32, 0.95]);
      place(bunds, field * 4 + 1, [cx, 0.18, 22.6], [35.2, 0.32, 0.95]);
      place(bunds, field * 4 + 2, [cx - 17.1, 0.18, 0], [0.95, 0.32, 44.4]);
      place(bunds, field * 4 + 3, [cx + 17.1, 0.18, 0], [0.95, 0.32, 44.4]);
      for (let row = 0; row < 22; row++) for (let col = 0; col < 12; col++) {
        const size = 0.8 + random() * 0.45;
        place(plants, index++, [cx - 15 + col * 2.7 + random() * 0.25, 0.09, -20.5 + row * 1.95], [size, size, size], [0, random() * 6.28, 0]);
      }
    }
    finish(plots); finish(bunds); finish(plants); detail(c, plants, 170);
  }

  // Rubber trees have upright pale trunks, low tapping bands, and broad layered crowns.
  for (const [x, z] of [[-157, -39], [-165, 43]]) {
    const c = chunk('Rubber grove', x, z, 39);
    const trunks = instances(c.group, unitTrunk, barkMaterial, 16, 'Rubber trunks');
    const crowns = instances(c.group, canopyGeometry, groveMaterial, 48, 'Rubber tree crowns');
    const tappingBands = instances(c.group, unitTrunk, darkBarkMaterial, 16, 'Rubber tapping bands');
    const latexCups = instances(c.group, new THREE.CylinderGeometry(0.13, 0.09, 0.18, 6), earth, 16, 'Latex cups');
    for (let i = 0; i < 16; i++) {
      const px = -20 + i % 4 * 13 + random() * 2.5;
      const pz = -23 + Math.floor(i / 4) * 14 + random() * 2.5;
      const h = 9 + random() * 4;
      place(trunks, i, [px, h / 2, pz], [0.24, h, 0.24], [0, 0, (random() - 0.5) * 0.045]);
      place(tappingBands, i, [px, 1.8, pz], [0.255, 0.12, 0.255], [0, 0, 0.14]);
      place(latexCups, i, [px + 0.23, 1.48, pz], [1, 1, 1]);
      for (let j = 0; j < 3; j++) {
        const a = j / 3 * Math.PI * 2 + i;
        place(crowns, i * 3 + j, [px + Math.cos(a) * 1.7, h - 0.7 + j % 2, pz + Math.sin(a) * 1.7], [3.3 + random(), 2 + random(), 3.2 + random()], [0, a, 0]);
        tint.setHSL(0.28 + random() * 0.035, 0.19, 0.23 + random() * 0.07); crowns.setColorAt(i * 3 + j, tint);
      }
    }
    for (const mesh of [trunks, crowns, tappingBands, latexCups]) finish(mesh);
    detail(c, tappingBands, 135); detail(c, latexCups, 125);
  }

  function bananaLeaf(): THREE.BufferGeometry {
    const positions: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 8; row++) {
      const t = row / 8;
      const half = Math.sin(t * Math.PI) * 0.58;
      const y = Math.sin(t * Math.PI) * 0.8 - t * t * 0.65;
      const z = t * 2.8;
      positions.push(-half * (row % 3 === 0 ? 0.75 : 1), y, z, 0, y + 0.035, z,
        half * (row % 3 === 1 ? 0.72 : 1), y, z);
      if (row < 8) for (let side = 0; side < 2; side++) {
        const a = row * 3 + side, b = a + 1;
        indices.push(a, a + 3, b, b, a + 3, b + 3);
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals(); return geometry;
  }
  const banana = bananaLeaf();
  for (const [x, z] of [[-129, 87], [129, -88]]) {
    const c = chunk('Banana garden', x, z, 14);
    const stems = instances(c.group, unitTrunk, stemMaterial, 5, 'Banana pseudostems');
    const leaves = instances(c.group, banana, leafMaterial, 35, 'Broad split banana leaves');
    for (let i = 0; i < 5; i++) {
      const px = (i % 3 - 1) * 3.1 + random(); const pz = (Math.floor(i / 3) - 0.5) * 4;
      const h = 2.6 + random() * 0.8;
      place(stems, i, [px, h / 2, pz], [0.16, h, 0.16]);
      for (let n = 0; n < 7; n++) {
        place(leaves, i * 7 + n, [px, h - 0.2 + n % 2 * 0.12, pz], [1, 1, 0.9 + random() * 0.25], [(random() - 0.4) * 0.3, n / 7 * Math.PI * 2 + i, 0]);
      }
    }
    finish(stems); finish(leaves);
  }

  // A local scenic pond. It is beyond the driving boundary, not a replacement for a mapped waterway.
  {
    const c = chunk('Pond and reed bank', 16, -129, 33);
    const bank = new THREE.Mesh(new THREE.CircleGeometry(1, 48), earth);
    bank.rotation.x = -Math.PI / 2; bank.scale.set(29, 16, 1); bank.position.y = 0.045; c.group.add(bank);
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, '#7c9692'); gradient.addColorStop(0.48, '#879d95'); gradient.addColorStop(1, '#657e6f');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 100; i++) { context.fillStyle = `rgba(210,221,204,${random() * 0.08})`; context.fillRect(random() * 128, random() * 64, 6 + random() * 22, 0.5); }
    const reflection = new THREE.CanvasTexture(canvas); reflection.colorSpace = THREE.SRGBColorSpace;
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ map: reflection, color: '#a8bbb1', roughness: 0.29, metalness: 0.12 }));
    water.name = 'Soft pond water'; water.rotation.x = -Math.PI / 2; water.scale.set(27.5, 14.5, 1); water.position.y = 0.065; c.group.add(water);
    const reeds = instances(c.group, rice, riceMaterial, 120, 'Pond reeds');
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * Math.PI * 2;
      place(reeds, i, [Math.cos(a) * (28 + random()), 0.08, Math.sin(a) * (15 + random())], [0.9, 1.2 + random(), 0.9], [0, a, 0]);
    }
    finish(reeds); detail(c, reeds, 145);
  }

  // Leaflets, rather than solid cones, give the palms their feathery silhouette.
  function palmFrond(): THREE.BufferGeometry {
    const positions: number[] = [];
    for (let side = -1; side <= 1; side += 2) for (let n = 1; n <= 10; n++) {
      const t = n / 11, z = t * 5.2, y = Math.sin(t * Math.PI) * 0.55 - t * t * 1.4;
      const width = Math.sin(t * Math.PI) * 1.18;
      positions.push(0, y, z - 0.09, side * width, y - 0.22, z + 0.65, 0, y, z + 0.09);
    }
    for (let n = 0; n < 10; n++) {
      const t = n / 10, nt = (n + 1) / 10;
      const y = Math.sin(t * Math.PI) * 0.55 - t * t * 1.4;
      const ny = Math.sin(nt * Math.PI) * 0.55 - nt * nt * 1.4;
      positions.push(-0.025, y, t * 5.2, 0.025, y, t * 5.2, 0, ny, nt * 5.2);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals(); return geometry;
  }
  const frondGeometry = palmFrond();
  const palmCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, 7, 0), new THREE.Vector3(1.4, 12, 0));
  const palmTrunk = new THREE.TubeGeometry(palmCurve, 13, 0.24, 5, false);
  for (const [x, z] of [[144, 99], [-137, -99]]) {
    const c = chunk('Boundary coconut grove', x, z, 30);
    const trunks = instances(c.group, palmTrunk, color('#8d816b'), 4, 'Curved coconut trunks');
    const fronds = instances(c.group, frondGeometry, palmLeafMaterial, 28, 'Feathered coconut fronds');
    for (let i = 0; i < 4; i++) {
      const px = (i % 2 - 0.5) * 17, pz = (Math.floor(i / 2) - 0.5) * 15;
      const turn = random() * Math.PI * 2, size = 0.86 + random() * 0.27;
      place(trunks, i, [px, 0, pz], [size, size, size], [0, turn, 0]);
      for (let n = 0; n < 7; n++) place(fronds, i * 7 + n,
        [px + Math.cos(turn) * 1.4 * size, 12 * size, pz - Math.sin(turn) * 1.4 * size], [size, size, size], [0, n / 7 * Math.PI * 2 + turn, 0]);
    }
    finish(trunks); finish(fronds);
  }

  // Low rolling profiles sit behind the neighbourhood; all slopes remain outside the playable roads.
  for (const [i, x, z] of [[0, -190, -173], [1, 191, -176], [2, 193, 166]]) {
    const c = chunk('Rolling distant terrain', x, z, 108);
    const geometry = new THREE.PlaneGeometry(155, 104, 22, 14);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute('position');
    for (let n = 0; n < positions.count; n++) {
      const px = positions.getX(n), pz = positions.getZ(n);
      const edge = Math.max(0, 1 - Math.pow(px / 80, 4)) * Math.max(0, 1 - Math.pow(pz / 54, 4));
      const height = (16 + Math.sin(px * 0.036 + i) * 8 + Math.cos(pz * 0.06) * 6) * edge;
      positions.setY(n, 0.03 + Math.max(0, height));
    }
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const hill = new THREE.Mesh(geometry, color(i === 1 ? '#72816a' : '#687b61'));
    hill.receiveShadow = true; c.group.add(hill);
  }

  return {
    chunkCount: chunks.length,
    update(cameraPosition) {
      for (const c of chunks) {
        const distance = Math.hypot(cameraPosition.x - c.center.x, cameraPosition.z - c.center.z);
        c.group.visible = distance < c.radius + (lowDetail ? 170 : 245);
        for (const item of c.details) item.object.visible = (!lowDetail || item.showOnLow) && distance < item.distance;
      }
    },
    setLowDetail(low) { lowDetail = low; },
  };
}
