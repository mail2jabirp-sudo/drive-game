import * as THREE from 'three';

/** Small original seamless textures; no downloaded road imagery or assets. */
export function createKeralaRoadMaterials(): Record<'asphalt' | 'concrete' | 'gravel' | 'shoulder' | 'detail', THREE.MeshStandardMaterial> {
  const makeTexture = (size: number, roughness: boolean): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!, image = ctx.createImageData(size, size);
    const hash = (x: number, y: number) => {
      const n = Math.imul((x & 7) + 31, 374761393) ^ Math.imul((y & 7) + 17, 668265263);
      return (Math.imul(n ^ (n >>> 13), 1274126177) >>> 0) / 4294967296;
    };
    let seed = 0x4b455241;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 4294967296;
      const gx = x * 8 / size, gy = y * 8 / size, ix = Math.floor(gx), iy = Math.floor(gy);
      const fx = gx - ix, fy = gy - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const top = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
      const bottom = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
      const mottle = top * (1 - sy) + bottom * sy;
      const value = roughness ? 200 + noise * 45 : 211 + (mottle - .5) * 9 + (noise - 0.5) * 30;
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value; image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    if (!roughness) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  };
  const grain = makeTexture(256, false), relief = makeTexture(128, true);
  function material(color: string, units: number, bumpScale: number, vertexColors = false) {
    return new THREE.MeshStandardMaterial({ color, map: grain, roughness: 0.98, roughnessMap: relief,
      bumpMap: relief, bumpScale, metalness: 0, vertexColors,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: units });
  }
  return {
    asphalt: material('#767c79', -8, 0.018), concrete: material('#b4b1a4', -10, 0.008),
    gravel: material('#998569', -12, 0.025), shoulder: material('#998569', -2, 0.02),
    detail: material('#ffffff', -16, 0.005, true),
  };
}
