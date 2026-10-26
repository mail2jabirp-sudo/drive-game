import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTownMaterials, texturedBox } from './materials';

export interface Collider { minX: number; maxX: number; minZ: number; maxZ: number }
export const PICKUP = new THREE.Vector3(72, 0, -12);
export const DROPOFF = new THREE.Vector3(-18, 0, -62);
export const SPAWN = new THREE.Vector3(72, 0, 36);

/** Original, entirely procedural scenery. All dimensions are in metres. */
export function createWorld(scene: THREE.Scene): {
  colliders: Collider[];
  update: (elapsed: number) => void;
} {
  const colliders: Collider[] = [];
  const root = new THREE.Group();
  root.name = 'Kottakkal town';
  scene.add(root);
  const mat = createTownMaterials();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const box = (x: number, y: number, z: number, w: number, h: number, d: number,
    color: string, parent: THREE.Object3D = root, shadow = false) => {
    const material = mat(color);
    const mesh = new THREE.Mesh(material.map ? texturedBox(w, h, d, material.userData.tileMetres) : cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (x: number, y: number, z: number, top: number, bottom: number,
    h: number, color: string, parent: THREE.Object3D = root, sides = 10) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, sides), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const signMaterial = (title: string, subtitle: string, color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color; ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = '#f7ecd0'; ctx.lineWidth = 5; ctx.strokeRect(10, 10, 748, 172);
    ctx.fillStyle = '#fff6df'; ctx.textAlign = 'center';
    ctx.font = 'bold 52px sans-serif'; ctx.fillText(title, 384, 83, 710);
    ctx.font = '24px sans-serif'; ctx.fillText(subtitle, 384, 139, 710);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
  };
  const sign = (title: string, subtitle: string, color: string, w: number, h: number,
    x: number, y: number, z: number, parent: THREE.Object3D) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(title, subtitle, color));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };

  // The generous, simple loop keeps the first drive approachable on touch screens.
  box(0, -0.35, 0, 800, 0.7, 800, '#9cb57c');
  box(0, 0.006, 0, 175, 0.02, 155, '#b7bf8d');
  const asphalt = '#535e60';
  box(-72, 0.03, 0, 18, 0.055, 142, asphalt);
  box(72, 0.03, 0, 18, 0.055, 142, asphalt);
  box(0, 0.031, -62, 162, 0.055, 18, asphalt);
  box(0, 0.031, 62, 162, 0.055, 18, asphalt);
  // Inner and outer pavements, with low curbs that do not trap the vehicle.
  for (const x of [-83.5, -60.5, 60.5, 83.5]) {
    box(x, 0.10, 0, 4.5, 0.18, 115, '#c9c6ae');
    for (let z = -52; z <= 52; z += 4) box(x, 0.205, z, 4.4, 0.02, 0.055, '#a9aa96');
  }
  for (const z of [-73.5, -50.5, 50.5, 73.5]) {
    box(0, 0.10, z, 166, 0.18, 4.5, '#c9c6ae');
    for (let x = -78; x <= 78; x += 4) box(x, 0.205, z, 0.055, 0.02, 4.4, '#a9aa96');
  }
  for (const x of [-72, 72]) {
    for (let z = -48; z <= 48; z += 9) box(x, 0.066, z, 0.18, 0.025, 4.2, '#e6d7a4');
    for (const edge of [-8, 8]) box(x + edge, 0.066, 0, 0.14, 0.02, 104, '#ced0bf');
  }
  for (const z of [-62, 62]) {
    for (let x = -54; x <= 54; x += 9) box(x, 0.067, z, 4.2, 0.025, 0.18, '#e6d7a4');
    for (const edge of [-8, 8]) box(0, 0.067, z + edge, 123, 0.02, 0.14, '#ced0bf');
  }
  for (let i = -3; i <= 3; i++) {
    box(72 + i * 2, 0.083, 24, 1.05, 0.025, 5, '#e7e5cf');
    box(-24, 0.083, -62 + i * 2, 5, 0.025, 1.05, '#e7e5cf');
  }

  function building(x: number, z: number, w: number, d: number, h: number,
    color: string, name: string, subtitle: string, rotation = 0, roof = false) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation;
    root.add(group);
    box(0, h / 2, 0, w, h, d, color, group, true);
    box(0, 0.4, d / 2 + 0.5, w + 0.8, 0.8, 1.8, '#d3c5a8', group);
    box(0, h - 0.55, 0, w + 0.5, 0.35, d + 0.5, '#f4e9ca', group);
    box(0, 3.5, d / 2 + 0.7, w + 0.8, 0.24, 2.3, '#f5d29a', group, true);
    const awningColors = ['#be6b4e', '#eee0bc'];
    for (let n = 0; n < 10; n++) box(-w / 2 + (n + 0.5) * w / 10, 3.24,
      d / 2 + 1.7, w / 10, 0.45, 0.15, awningColors[n % 2], group);
    box(0, 1.6, d / 2 + 0.025, w * 0.36, 2.5, 0.07, '#283b3c', group);
    for (const side of [-1, 1]) {
      box(side * w * 0.31, 1.8, d / 2 + 0.045, w * 0.2, 2.15, 0.07, '#759b96', group);
      box(side * w * 0.31, 1.8, d / 2 + 0.09, 0.10, 2.2, 0.06, '#e3dcc1', group);
    }
    for (let yy = 6.3; yy < h - 1; yy += 3.4) {
      for (let xx = -w / 2 + 2; xx < w / 2 - 1; xx += 3.6) {
        box(xx, yy, d / 2 + 0.045, 1.65, 1.8, 0.10, '#f7e6bd', group);
        box(xx, yy, d / 2 + 0.105, 1.35, 1.5, 0.06, '#557c7b', group);
        box(xx, yy - 0.88, d / 2 + 0.2, 2, 0.16, 0.48, '#c8cdb4', group);
      }
      for (const side of [-1, 1]) for (let zz = -d / 2 + 2; zz < d / 2 - 1; zz += 3.8) {
        box(side * (w / 2 + 0.04), yy, zz, 0.09, 1.65, 1.65, '#547b7a', group);
      }
    }
    // Worn plinth, shutter grooves, window mullions and modest utility fittings.
    box(0, 0.3, d / 2 + 0.035, w, 0.6, 0.10, '#8f9288', group);
    for (let yy = 0.8; yy < 2.8; yy += 0.17) box(0, yy, d / 2 + 0.08, w * 0.35, 0.025, 0.03, '#4b5954', group);
    for (const side of [-1, 1]) {
      box(side * w * 0.31, 1.8, d / 2 + 0.11, w * 0.2, 0.06, 0.04, '#c2bda9', group);
      box(side * (w / 2 - 0.4), 2.2, d / 2 + 0.13, 0.12, 3.8, 0.12, '#7e8179', group);
    }
    box(w * 0.4, 2.4, d / 2 + 0.15, 0.5, 0.65, 0.14, '#898d81', group);
    sign(name, subtitle, '#265b54', w * 0.93, 2.0, 0, 4.75, d / 2 + 0.08, group);
    if (roof) {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(1, 2.4, 4), mat('#b76545'));
      mesh.rotation.y = Math.PI / 4; mesh.scale.set((w + 2) / Math.SQRT2, 1, (d + 2) / Math.SQRT2);
      mesh.position.y = h + 1.1; mesh.castShadow = true; group.add(mesh);
      const roofUv = mesh.geometry.getAttribute('uv');
      for (let i = 0; i < roofUv.count; i++) roofUv.setXY(i, roofUv.getX(i) * w / 1.5, roofUv.getY(i) * d / 3);
      // Thin fascia/eave details ground the roof rather than leaving a plain pyramid.
      for (const side of [-1, 1]) {
        box(side * (w / 2 + 0.8), h - 0.03, 0, 0.16, 0.2, d + 1.6, '#6c5745', group);
        box(0, h - 0.03, side * (d / 2 + 0.8), w + 1.6, 0.2, 0.16, '#6c5745', group);
      }
    } else {
      box(0, h + 0.22, 0, w + 0.7, 0.42, d + 0.7, '#f2e4c7', group);
      box(-w * 0.25, h + 1.0, -d * 0.22, 2, 1.5, 2, '#617c7a', group);
      cylinder(w * 0.22, h + 0.9, -d * 0.20, 0.8, 0.8, 1.4, '#394b49', group);
    }
    const odd = Math.abs(Math.sin(rotation)) > 0.5;
    colliders.push({ minX: x - (odd ? d : w) / 2 - 0.6, maxX: x + (odd ? d : w) / 2 + 0.6,
      minZ: z - (odd ? w : d) / 2 - 0.6, maxZ: z + (odd ? w : d) / 2 + 0.6 });
    return group;
  }

  // A fictional neighbourhood inspired by Kerala, rather than a claimed street map.
  building(96, -35, 22, 17, 13, '#e4c590', 'KOTTAKKAL STORES', 'GENERAL MERCHANTS · SINCE 1984', -Math.PI / 2);
  building(96, -4, 22, 17, 10, '#a8c4b5', 'MALABAR BAKERY', 'FRESH BAKES & SWEET MOMENTS', -Math.PI / 2, true);
  building(96, 28, 22, 17, 14, '#dda18a', 'ARYA MEDICALS', 'YOUR NEIGHBOURHOOD PHARMACY', -Math.PI / 2);
  building(96, 57, 20, 17, 8, '#e6cd9c', 'SOUK TEXTILES', 'COLOURS OF MALABAR', -Math.PI / 2, true);
  building(-97, -35, 23, 18, 12, '#c2c8ae', 'BOOK HOUSE', 'BOOKS · STATIONERY · STORIES', Math.PI / 2);
  building(-96, 2, 18, 17, 9, '#e0b794', 'AUTO WORKS', 'REPAIRS & GOOD ADVICE', Math.PI / 2);
  const tea = building(-92, 25, 17, 12, 6, '#b8c4a4', 'CHAYA KADA', 'ചായക്കട · A LITTLE TEA BREAK', Math.PI / 2, true);
  sign('CHAI  ₹10', 'HOT · FRESH · LOCAL', '#b8653d', 5.5, 1.7, 0, 2.0, 6.25, tea);
  building(-95, 56, 20, 15, 11, '#d1a594', 'MALABAR LODGE', 'REST A WHILE', Math.PI / 2);
  building(-47, -88, 24, 20, 11, '#d8b59a', 'KOTTAKKAL MARKET', 'LOCAL FINDS · EVERY DAY', 0, true);
  building(-15, -88, 24, 20, 9, '#b8c8bd', 'BUS STAND CAFE', 'WELCOME TO KOTTAKKAL', 0);
  building(22, -88, 26, 20, 13, '#d7c88f', 'COCONUT CORNER', 'FRESH FRUIT · FRESH JUICE', 0);
  building(55, -88, 24, 20, 10, '#c8aca5', 'MALABAR MOBILES', 'STAY CONNECTED', 0);
  building(-48, 88, 25, 20, 11, '#e3be93', 'KOTTAKKAL CO-OP', 'A NEIGHBOURHOOD TOGETHER', Math.PI);
  building(-12, 88, 26, 20, 9, '#a7c1b8', 'RICE & SPICE', 'THE TASTE OF HOME', Math.PI, true);
  building(26, 88, 25, 20, 12, '#dbac95', 'MALABAR TRADERS', 'QUALITY GOODS · FAIR PRICES', Math.PI);
  building(49, -25, 20, 16, 9, '#d8c5a0', 'FLOWER SHOP', 'A LITTLE COLOUR FOR YOUR DAY', Math.PI / 2, true);
  building(-49, -22, 21, 16, 12, '#abc2ab', 'GREEN GROCER', 'FARM FRESH · LOCALLY GROWN', -Math.PI / 2);
  building(27, 36, 25, 15, 9, '#d4b9a5', 'COMMUNITY HALL', 'KOTTAKKAL · WELCOME', Math.PI, true);
  building(-27, 36, 24, 15, 10, '#d4c799', 'MALABAR CRAFTS', 'MADE WITH CARE', Math.PI);

  function palm(x: number, z: number, h = 12, phase = 0) {
    const group = new THREE.Group(); group.position.set(x, 0, z); root.add(group);
    const trunk = cylinder(0, h / 2, 0, 0.29, 0.47, h, '#987251', group, 7);
    trunk.rotation.z = Math.sin(phase) * 0.06;
    const topX = -Math.sin(trunk.rotation.z) * h / 2;
    for (let yy = 1; yy < h - 0.5; yy += 0.65) {
      const ridge = cylinder(-Math.sin(trunk.rotation.z) * (yy - h / 2), yy, 0, 0.31, 0.34, 0.055, '#75634e', group, 8);
      ridge.rotation.z = trunk.rotation.z;
    }
    // Paired tapering leaflets follow a curved rachis, with a drooping coconut silhouette.
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2 + phase;
      const positions: number[] = [], uvs: number[] = [];
      const length = 4.5 + (i % 3) * 0.4;
      const point = (t: number, lateral: number) => new THREE.Vector3(
        topX + Math.cos(angle) * t * length - Math.sin(angle) * lateral,
        h + 0.6 + Math.sin(t * Math.PI) * 0.9 - t * t * 2.5,
        Math.sin(angle) * t * length + Math.cos(angle) * lateral,
      );
      const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
        positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
        uvs.push(0, 0, 1, 0, 0.5, 1);
      };
      for (let n = 0; n < 12; n++) {
        const t = 0.05 + n / 13;
        const a = point(t, 0), b = point(Math.min(1, t + 0.08), 0);
        const spread = Math.sin(t * Math.PI) * 0.8 + 0.15;
        triangle(a, b, point(Math.min(1, t + 0.13), spread));
        triangle(b, a, point(Math.min(1, t + 0.13), -spread));
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.computeVertexNormals();
      const leafMaterial = mat(i % 2 ? '#3e6340' : '#506c3e');
      leafMaterial.side = THREE.DoubleSide;
      const leaf = new THREE.Mesh(geometry, leafMaterial);
      leaf.castShadow = true; group.add(leaf);
    }
    for (let n = 0; n < 3; n++) cylinder(topX + n * 0.22 - 0.2, h - 0.5, 0.2, 0.22, 0.22, 0.4, '#7a7148', group, 6);
    colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45 });
    return group;
  }
  [[86,-55],[86,10],[86,43],[-85,-54],[-84,43],[-58,-41],[58,41],[49,15],[-49,15],[-29,-45],[36,-45],[-6,46],[-37,4],[29,9],[5,-32]].forEach(([x,z],i)=>palm(x,z,11+i%3,i));
  const shrubGeometry = new THREE.SphereGeometry(1, 7, 5);
  function shrub(x: number, z: number, size = 1.6) {
    const mesh = new THREE.Mesh(shrubGeometry, mat('#6d8c54'));
    mesh.position.set(x, size * 0.65, z); mesh.scale.set(size, size * 0.85, size);
    mesh.castShadow = true; root.add(mesh);
  }
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    shrub(Math.cos(a) * 25, Math.sin(a) * 20 - 4, 1.6 + i % 2 * 0.3);
  }
  for (let i = -5; i <= 5; i++) { shrub(i * 4.5, -46, 1.1); shrub(i * 4.5, 46, 1.1); }

  // Small central garden and fountain, visible above the inner streets.
  cylinder(0, 0.07, -4, 20, 20, 0.12, '#c7bfa0', root, 48);
  cylinder(0, 0.18, -4, 14, 14, 0.25, '#adb88b', root, 48);
  cylinder(0, 0.45, -4, 6.4, 6.5, 0.9, '#d8d0b1', root, 32);
  const water = cylinder(0, 0.94, -4, 5.9, 5.9, 0.07, '#72b1ac', root, 32);
  water.material = new THREE.MeshStandardMaterial({ color: '#72b1ac', roughness: 0.3, metalness: 0.2 });
  cylinder(0, 1.65, -4, 0.45, 0.7, 1.6, '#d8d0b1');
  cylinder(0, 2.55, -4, 2.6, 1.5, 0.35, '#d8d0b1', root, 24);
  const fountain = cylinder(0, 3.0, -4, 0.12, 0.3, 1, '#b2dfd1');
  colliders.push({ minX: -6.5, maxX: 6.5, minZ: -10.5, maxZ: 2.5 });
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    const bench = new THREE.Group(); bench.position.set(Math.cos(angle) * 16, 0, Math.sin(angle) * 16 - 4);
    bench.rotation.y = -angle + Math.PI / 2; root.add(bench);
    box(0, 0.85, 0, 4, 0.2, 1.1, '#956e4c', bench);
    box(0, 1.5, -0.43, 4, 1, 0.16, '#a17b50', bench);
    box(-1.45, 0.45, 0, 0.22, 0.8, 0.9, '#485a50', bench);
    box(1.45, 0.45, 0, 0.22, 0.8, 0.9, '#485a50', bench);
  }

  function person(x: number, z: number, shirt: string, rotation = 0) {
    const person = new THREE.Group(); person.position.set(x, 0.22, z); person.rotation.y = rotation;
    root.add(person);
    box(-0.19, 0.45, 0, 0.22, 0.9, 0.28, '#394d54', person);
    box(0.19, 0.45, 0, 0.22, 0.9, 0.28, '#394d54', person);
    box(0, 1.14, 0, 0.66, 0.65, 0.35, shirt, person);
    cylinder(0, 1.77, 0, 0.24, 0.24, 0.43, '#b9815f', person, 8);
    box(0, 1.98, 0, 0.46, 0.13, 0.41, '#3d3730', person);
    box(-0.43, 1.1, 0, 0.17, 0.68, 0.2, '#b9815f', person);
    box(0.43, 1.1, 0, 0.17, 0.68, 0.2, '#b9815f', person);
    return person;
  }
  person(84, -12, '#e2a957', -Math.PI / 2);
  person(85, 1, '#bd7b7a', -Math.PI / 2);
  person(-17, -75, '#7d9aab');
  person(-84, 28, '#d2bc81', Math.PI / 2);
  person(24, 49, '#cf9789', Math.PI);
  // Bus stop destination: shelter and route board beside the north road.
  box(-18, 0.35, -76, 9, 0.6, 3, '#d9cfad');
  for (const x of [-22, -14]) box(x, 2.1, -76.5, 0.18, 3.6, 0.18, '#4f7870');
  box(-18, 4.0, -76, 10, 0.25, 4, '#668d7e', root, true);
  box(-18, 1.1, -77, 7, 0.3, 1.1, '#b58d60');
  sign('BUS STAND', 'KOTTAKKAL', '#426f61', 5, 1.1, -18, 3.1, -75.9, root);

  // Street lamps, wires and pennants give the road a lived-in silhouette.
  for (const x of [-84, 84]) for (const z of [-46, -9, 34]) {
    cylinder(x, 3.9, z, 0.10, 0.16, 7.8, '#667773');
    box(x + (x > 0 ? -1.0 : 1.0), 7.75, z, 2.1, 0.14, 0.14, '#667773');
    box(x + (x > 0 ? -1.9 : 1.9), 7.6, z, 0.65, 0.16, 0.9, '#e6d4a1');
  }
  const wireMat = new THREE.LineBasicMaterial({ color: '#56645a' });
  for (const x of [-85, 85]) {
    for (const z of [-53, -7, 39]) {
      cylinder(x, 4.7, z, 0.13, 0.21, 9.4, '#756e5b');
      box(x, 9, z, 2.3, 0.14, 0.14, '#756e5b');
    }
    for (let i = 0; i < 2; i++) for (const dx of [-0.8, 0.8]) {
      const from = -53 + i * 46;
      const pts = [];
      for (let j = 0; j <= 20; j++) {
        const t = j / 20; pts.push(new THREE.Vector3(x + dx, 9 - Math.sin(t * Math.PI) * 1.6, from + t * 46));
      }
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }
  }
  const flagColors = ['#d8946c','#f3d498','#7fafa4','#c79690'];
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(59 + i * 1.3, 8.6 - Math.sin(i / 20 * Math.PI) * 1.2, 5));
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  for (let i = 0; i < 16; i++) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0.8,0,0, 0.4,-1.1,0], 3)); geom.computeVertexNormals();
    const flag = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: flagColors[i%4], side: THREE.DoubleSide }));
    const x = 60 + i * 1.5; flag.position.set(x, 8.6 - Math.sin((x-59)/26*Math.PI)*1.2,5); root.add(flag);
  }
  // Soft low-poly Western Ghats horizon.
  for (let i = 0; i < 17; i++) {
    const angle = i / 17 * Math.PI * 2;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat(i % 2 ? '#8fa98c' : '#9cb394'));
    hill.position.set(Math.cos(angle) * 260, 12, Math.sin(angle) * 255);
    hill.scale.set(75 + i % 3 * 12, 35 + i % 4 * 10, 72); root.add(hill);
  }
  const cloudMaterial = mat('#f1edda');
  const cloudGeometry = new THREE.SphereGeometry(1, 10, 7);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) {
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloud.position.set(-160 + i * 44 + j * 8, 75 + i % 3 * 10 + j % 2 * 2, -140 - i % 2 * 70);
    cloud.scale.set(15, 5 + j, 8); root.add(cloud);
  }
  // Batch static opaque scenery by material to keep mobile draw calls low.
  root.updateMatrixWorld(true);
  const batches = new Map<string, { geometries: THREE.BufferGeometry[]; material: THREE.Material; shadow: boolean }>();
  const originals: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object === water || object === fountain || Array.isArray(object.material)) return;
    const key = object.material.uuid + object.castShadow;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometries: [], material: object.material, shadow: object.castShadow };
      batches.set(key, batch);
    }
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    batch.geometries.push(geometry);
    originals.push(object);
  });
  for (const object of originals) object.removeFromParent();
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, batch.material);
      mesh.castShadow = batch.shadow; mesh.receiveShadow = true;
      root.add(mesh);
    }
    for (const geometry of batch.geometries) geometry.dispose();
  }
  return {
    colliders,
    update(elapsed: number) {
      fountain.scale.x = fountain.scale.z = 1 + Math.sin(elapsed * 2) * 0.08;
      water.rotation.y = elapsed * 0.015;
    },
  };
}
