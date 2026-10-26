import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLandscape } from '../src/landscape.ts';

/** Only canvas painting is stubbed: geometry, bounds, instances and visibility are real Three.js objects. */
function landscapeFixture() {
  const oldDocument = globalThis.document;
  const context = {
    fillStyle: '',
    fillRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
  };
  globalThis.document = {
    createElement() {
      return { width: 0, height: 0, getContext() { return context; } };
    },
  } as unknown as Document;
  try {
    const scene = new THREE.Scene();
    return { scene, landscape: createLandscape(scene) };
  } finally {
    if (oldDocument === undefined) delete (globalThis as { document?: Document }).document;
    else globalThis.document = oldDocument;
  }
}

function visibleMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  scene.traverseVisible(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  return meshes;
}

test('landscape keeps actual instance geometry within the mobile scene budget', () => {
  const { scene, landscape } = landscapeFixture();
  let meshes = 0, vertices = 0, triangles = 0, instances = 0;
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const count = object instanceof THREE.InstancedMesh ? object.count : 1;
    meshes += 1;
    instances += count;
    vertices += object.geometry.getAttribute('position').count * count;
    triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) * count / 3;
  });
  assert.ok(landscape.chunkCount >= 4, 'surroundings must be partitioned into multiple chunks');
  assert.ok(meshes > 0 && meshes <= 45, `${meshes} meshes exceeds the scenery draw-call budget`);
  assert.ok(vertices > 0 && vertices <= 80_000, `${vertices} expanded vertices exceeds the scenery budget`);
  assert.ok(triangles > 0 && triangles <= 50_000, `${triangles} triangles exceeds the scenery budget`);
  assert.ok(instances > meshes * 10, 'vegetation should use actual repeated instances, not individual draw calls');
});

test('all surrounding scenery bounds stay outside the existing playable town rectangle', () => {
  const { scene } = landscapeFixture();
  scene.updateMatrixWorld(true);
  const playable = { minX: -115, maxX: 115, minZ: -105, maxZ: 105 };
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const checkBounds = (bounds: THREE.Box3, label: string) => {
      assert.ok(!bounds.isEmpty(), `${label} has no measurable geometry`);
      const intersectsTown = bounds.max.x > playable.minX && bounds.min.x < playable.maxX &&
        bounds.max.z > playable.minZ && bounds.min.z < playable.maxZ;
      assert.equal(intersectsTown, false, `${label} intrudes into the driving area: ${JSON.stringify(bounds)}`);
    };
    if (object instanceof THREE.InstancedMesh) {
      object.geometry.computeBoundingBox();
      const instanceMatrix = new THREE.Matrix4();
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, instanceMatrix);
        instanceMatrix.premultiply(object.matrixWorld);
        checkBounds(object.geometry.boundingBox!.clone().applyMatrix4(instanceMatrix), `${object.name} instance ${i}`);
      }
    } else checkBounds(new THREE.Box3().setFromObject(object), object.name || object.type);
  });
});

test('distance culling removes distant chunks and battery mode hides details while keeping nearby terrain', () => {
  const { scene, landscape } = landscapeFixture();
  const camera = new THREE.Vector3(72, 6, 36);
  landscape.update(camera);
  const normal = visibleMeshes(scene);
  assert.ok(normal.some(mesh => mesh.name === 'Instanced planted rice'), 'nearby fields should include planted-rice detail');
  assert.ok(normal.some(mesh => mesh.name === 'Low rice-field surfaces'), 'nearby field terrain must remain visible');

  landscape.setLowDetail(true);
  landscape.update(camera);
  const low = visibleMeshes(scene);
  assert.ok(low.length > 0 && low.length < normal.length, 'battery mode must reduce actual visible mesh count');
  assert.ok(low.some(mesh => mesh.name === 'Low rice-field surfaces'), 'battery mode must retain nearby field terrain');
  assert.ok(!low.some(mesh => mesh.name === 'Instanced planted rice' || mesh.name === 'Pond reeds'), 'battery mode should omit fine grass/reed geometry');

  landscape.setLowDetail(false);
  landscape.update(camera);
  assert.equal(visibleMeshes(scene).length, normal.length, 'returning to standard detail should restore visible meshes');
  landscape.update(new THREE.Vector3(10_000, 6, 10_000));
  assert.equal(visibleMeshes(scene).length, 0, 'far-away scenery chunks should all be culled');
});
