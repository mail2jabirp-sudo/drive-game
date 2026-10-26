import * as THREE from 'three';

/** Original small repeating textures, synthesized once. No remote imagery or assets. */
type Surface = 'asphalt' | 'plaster' | 'clay' | 'concrete' | 'earth';
const wallColors = new Set(['#e4c590','#a8c4b5','#dda18a','#e6cd9c','#c2c8ae','#e0b794','#b8c4a4','#d1a594','#d8b59a','#b8c8bd','#d7c88f','#c8aca5','#e3be93','#a7c1b8','#dbac95','#d8c5a0','#abc2ab','#d4b9a5','#d4c799']);
const palette: Record<string, string> = {
  '#9cb57c':'#6f7d57', '#b7bf8d':'#8a8e70', '#535e60':'#43494a', '#c9c6ae':'#b8b7a8',
  '#e4c590':'#d2c3a6', '#a8c4b5':'#a6b2a5', '#dda18a':'#c6ad9b', '#e6cd9c':'#cdc5ad',
  '#c2c8ae':'#b9b9a8', '#e0b794':'#c9bba5', '#b8c4a4':'#b4b69e', '#d1a594':'#bdac9c',
  '#d8b59a':'#c6b6a3', '#b8c8bd':'#b5bcb2', '#d7c88f':'#c7c0a0', '#c8aca5':'#bcb0a5',
  '#e3be93':'#cabaa2', '#a7c1b8':'#aab7ad', '#dbac95':'#c3ac9b', '#d8c5a0':'#c6bca5',
  '#abc2ab':'#a9b3a2', '#d4b9a5':'#c1b3a5', '#d4c799':'#c4bda4', '#b76545':'#974e35',
  '#759b96':'#526b67', '#557c7b':'#3a5451', '#547b7a':'#425651', '#be6b4e':'#9f604b',
  '#eee0bc':'#d0c9b7', '#f5d29a':'#c7b797', '#f4e9ca':'#d8d1be', '#f2e4c7':'#d2ccbc',
  '#8fa98c':'#758e79', '#9cb394':'#829681', '#6d8c54':'#526b43',
};

function texture(surface: Surface): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  let seed = 0x2ba57 + surface.length * 31;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pixels = ctx.createImageData(256, 256);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const grain = surface === 'asphalt' ? 30 : surface === 'earth' ? 25 : 12;
    const value = 237 - Math.floor(random() * grain);
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  if (surface === 'asphalt') {
    // Aggregate and old repairs are small and low contrast, never route geometry.
    for (let i = 0; i < 650; i++) {
      const x = random() * 256, y = random() * 256;
      ctx.fillStyle = random() > 0.6 ? '#ffffff28' : '#00000018';
      ctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
    }
  } else if (surface === 'clay') {
    ctx.lineWidth = 2; ctx.strokeStyle = '#38211034';
    for (let y = 0; y <= 256; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y + 1); ctx.lineTo(256, y + 1); ctx.stroke();
      for (let x = 0; x < 256; x += 16) {
        const offset = y % 64 ? 8 : 0;
        ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y + 32); ctx.stroke();
        ctx.fillStyle = '#ffffff12'; ctx.fillRect(x + offset + 2, y + 3, 3, 26);
      }
    }
  } else if (surface === 'plaster') {
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = '#00000005';
      ctx.beginPath(); ctx.ellipse(random() * 256, random() * 256, 2 + random() * 16, 3 + random() * 20, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (surface === 'concrete') {
    ctx.strokeStyle = '#00000014'; ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, 254, 254);
  }
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.anisotropy = 4;
  return result;
}

export function createTownMaterials(): (color: string, roughness?: number) => THREE.MeshStandardMaterial {
  const textures = new Map<Surface, THREE.CanvasTexture>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  return (color: string, roughness = 0.9) => {
    const key = color + roughness;
    let material = materials.get(key);
    if (material) return material;
    let surface: Surface | undefined;
    if (color === '#535e60') surface = 'asphalt';
    else if (wallColors.has(color)) surface = 'plaster';
    else if (color === '#b76545') surface = 'clay';
    else if (['#c9c6ae','#d3c5a8','#f4e9ca','#f2e4c7','#d8d0b1'].includes(color)) surface = 'concrete';
    else if (color === '#9cb57c' || color === '#b7bf8d') surface = 'earth';
    let map: THREE.CanvasTexture | undefined;
    if (surface) {
      map = textures.get(surface);
      if (!map) { map = texture(surface); textures.set(surface, map); }
    }
    material = new THREE.MeshStandardMaterial({ color: palette[color] ?? color, roughness, map });
    material.userData.tileMetres = surface === 'clay' ? 3 : surface === 'asphalt' ? 3 : surface === 'plaster' ? 4 : 2;
    if (['#759b96','#557c7b','#547b7a'].includes(color)) {
      material.roughness = 0.3;
      material.metalness = 0.16;
    }
    materials.set(key, material);
    return material;
  };
}

/** Keep texture scale in metres instead of stretching one tile across a shop or road. */
export function texturedBox(width: number, height: number, depth: number, tileMetres: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) * width, y = position.getY(i) * height, z = position.getZ(i) * depth;
    if (Math.abs(normal.getX(i)) > 0.5) uv.setXY(i, z / tileMetres, y / tileMetres);
    else if (Math.abs(normal.getY(i)) > 0.5) uv.setXY(i, x / tileMetres, z / tileMetres);
    else uv.setXY(i, x / tileMetres, y / tileMetres);
  }
  return geometry;
}
