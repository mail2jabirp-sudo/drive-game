import * as THREE from 'three';
import './style.css';
import { createWorld, PICKUP, DROPOFF, SPAWN } from './world';
import { createRickshaw } from './vehicle';
import { advanceCar, blocked } from './driving';
import type { DriveState } from './driving';
import { Input } from './input';
import { GameAudio } from './audio';
import { FARE, SAVE_KEY, newProgress, parseProgress, interactMission } from './progress';

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let progress = newProgress();
let storageAvailable = true;
try { progress = parseProgress(localStorage.getItem(SAVE_KEY)); }
catch { storageAvailable = false; }
const audio = new GameAudio();
let started = false;
let paused = false;
let lastSave = 0;
let lastToast = 0;
let lastInteraction = -Infinity;
let toastTimer = 0;
let elapsed = 0;
let input: Input;
const car: DriveState = { x: progress.x, z: progress.z, heading: progress.heading, speed: 0, steering: 0 };

function toast(message: string): void {
  element('toast').textContent = message;
  element('toast').classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element('toast').classList.remove('visible'), 4000);
}
function save(): void {
  progress.x = car.x; progress.z = car.z; progress.heading = car.heading;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    storageAvailable = true;
    element('save-status').textContent = 'Progress saved on this device';
  } catch {
    storageAvailable = false;
    element('save-status').textContent = 'Storage unavailable · progress is temporary';
  }
}

try {
  const renderer = new THREE.WebGLRenderer({ canvas: element<HTMLCanvasElement>('game'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b8d9d4');
  scene.fog = new THREE.Fog('#b8d9d4', 100, 340);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
  scene.add(new THREE.HemisphereLight('#fff4d4', '#667e5c', 2.5));
  const sun = new THREE.DirectionalLight('#ffe1ad', 3.3);
  sun.position.set(-55, 85, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -135; sun.shadow.camera.right = 135;
  sun.shadow.camera.top = 125; sun.shadow.camera.bottom = -125;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 240;
  sun.shadow.normalBias = 0.045;
  scene.add(sun);
  const world = createWorld(scene);
  const rickshaw = createRickshaw();
  scene.add(rickshaw.group);
  if (blocked(car.x, car.z, world.colliders)) {
    car.x = SPAWN.x; car.z = SPAWN.z; car.heading = 0;
  }

  function missionMarker(color: number): THREE.Group {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.65, 48), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; group.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 3, 32, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 1.5; group.add(beam);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.1, 4), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 }));
    arrow.rotation.z = Math.PI; arrow.position.y = 5; group.add(arrow);
    scene.add(group);
    return group;
  }
  const pickupMarker = missionMarker(0xf5b83c); pickupMarker.position.copy(PICKUP);
  const dropoffMarker = missionMarker(0x2da99a); dropoffMarker.position.copy(DROPOFF);
  // A passenger appears in the cabin only while a fare is active.
  const passenger = new THREE.Group();
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.33), new THREE.MeshStandardMaterial({ color: '#d36b4d' }));
  shirt.position.set(-0.35, 1.35, 0.84);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: '#a56843' }));
  head.position.set(-0.35, 1.78, 0.84);
  passenger.add(shirt, head); rickshaw.group.add(passenger);
  const target = () => progress.phase === 'pickup' ? PICKUP : DROPOFF;
  const distance = () => Math.hypot(car.x - target().x, car.z - target().z);

  function interact(): void {
    if (!started || paused || elapsed - lastInteraction < 1) return;
    lastInteraction = elapsed;
    const result = interactMission(progress, distance(), car.speed);
    if (result === 'pickup') {
      toast('Passenger aboard! Take the loop to the market.'); audio.success(); save();
    } else if (result === 'dropoff') {
      toast(`Trip complete · +₹${FARE}! Another passenger is waiting.`); audio.success(); save();
    } else if (distance() <= 8) toast('Brake to a stop to help your passenger.');
    else toast('Follow the gold marker to pick up, or teal to drop off.');
    updateHud();
  }
  function resetCar(): void {
    car.x = SPAWN.x; car.z = SPAWN.z; car.heading = 0; car.speed = 0; car.steering = 0;
    snapCamera(); save(); toast('Back on the road. Your fare and earnings are safe.');
  }
  function pause(): void {
    if (!started) return;
    paused = !paused; input.clear();
    element('pause-button').innerHTML = paused
      ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 2 10 6-10 6Z" fill="currentColor"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" stroke="currentColor" stroke-width="3"/></svg>';
    element('pause-button').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    element('pause-button').title = paused ? 'Resume game (P)' : 'Pause game (P)';
    element('pause-button').setAttribute('aria-pressed', String(paused));
    document.body.classList.toggle('paused', paused);
    if (paused) { save(); toast('Paused · press P or Resume to keep driving'); }
    else toast('Enjoy the ride.');
  }
  input = new Input(name => {
    if (name === 'pause') { pause(); return; }
    if (!started || paused) return;
    if (name === 'interact') interact();
    if (name === 'horn') audio.horn();
    if (name === 'reset') resetCar();
  });
  element('start-button').addEventListener('click', () => {
    started = true; document.body.classList.add('playing');
    element('start-screen').hidden = true; input.clear(); audio.start();
    if (!storageAvailable) toast('Browser storage is unavailable. This ride will not be saved.');
    else toast(progress.phase === 'dropoff' ? 'Welcome back! Your passenger is still aboard.' : 'Welcome to Kottakkal. Your first passenger is up the road.');
    save();
    element<HTMLCanvasElement>('game').focus();
  });
  element('interact-button').addEventListener('click', interact);
  element('reset-button').addEventListener('click', () => { if (started && !paused) resetCar(); });
  element('pause-button').addEventListener('click', pause);
  element('sound-button').addEventListener('click', () => {
    audio.start(); audio.muted = !audio.muted;
    element('sound-button').textContent = audio.muted ? '♩' : '♫';
    element('sound-button').setAttribute('aria-label', audio.muted ? 'Turn sound on' : 'Mute sound');
    element('sound-button').title = audio.muted ? 'Sound off · tap to enable' : 'Sound on · tap to mute';
    element('sound-button').setAttribute('aria-pressed', String(audio.muted));
  });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden && started) { save(); if (!paused) pause(); } });

  const cameraObstacles = world.colliders.map(b => new THREE.Box3(new THREE.Vector3(b.minX, 0, b.minZ), new THREE.Vector3(b.maxX, 17, b.maxZ)));
  const cameraRay = new THREE.Ray();
  const cameraHit = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const smoothedLook = new THREE.Vector3();
  function snapCamera(): void {
    camera.position.set(car.x + Math.sin(car.heading) * 10, 6.4, car.z + Math.cos(car.heading) * 10);
    smoothedLook.set(car.x - Math.sin(car.heading) * 5, 1.2, car.z - Math.cos(car.heading) * 5);
    camera.lookAt(smoothedLook);
  }
  snapCamera();
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = window.innerWidth < 600 ? 62 : 52;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize); resize();
  element('loading').hidden = true;
  element<HTMLButtonElement>('start-button').disabled = false;

  const map = element<HTMLCanvasElement>('minimap');
  const ctx = map.getContext('2d')!;
  function minimap(): void {
    const w = map.width, h = map.height;
    const sx = (x: number) => w / 2 + x * 0.91;
    const sz = (z: number) => h / 2 + z * 0.91;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e0e6cf'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c7d2b7';
    for (const box of world.colliders) ctx.fillRect(sx(box.minX), sz(box.minZ), (box.maxX - box.minX) * 0.91, (box.maxZ - box.minZ) * 0.91);
    ctx.strokeStyle = '#f9f6e8'; ctx.lineWidth = 16;
    ctx.lineJoin = 'round'; ctx.strokeRect(sx(-72), sz(-62), 144 * 0.91, 124 * 0.91);
    ctx.strokeStyle = '#b7bba7'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.strokeRect(sx(-72), sz(-62), 144 * 0.91, 124 * 0.91); ctx.setLineDash([]);
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#75816a'; ctx.fillText('KOTTAKKAL', w / 2, h / 2 - 3); ctx.font = '9px sans-serif'; ctx.fillText('TOWN LOOP', w / 2, h / 2 + 11);
    ctx.beginPath(); ctx.arc(sx(target().x), sz(target().z), 6, 0, Math.PI * 2);
    ctx.fillStyle = progress.phase === 'pickup' ? '#e9a52b' : '#198c7c'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(sx(car.x), sz(car.z)); ctx.rotate(-car.heading);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fillStyle = '#1c3833'; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#687766'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('N ↑', w - 20, 20);
  }
  function updateHud(): void {
    element('money').textContent = `₹${progress.money.toLocaleString('en-IN')}`;
    element('trips').textContent = String(progress.trips);
    element('speed').textContent = String(Math.round(Math.abs(car.speed) * 3.6));
    const pickingUp = progress.phase === 'pickup';
    element('mission-title').textContent = pickingUp ? 'A ride to the market' : 'Next stop: market';
    element('mission-description').textContent = pickingUp ? 'A passenger is waiting outside the bakery. Pull into the gold circle.' : 'Passenger aboard. Follow the loop to the market bus stand and stop in the teal circle.';
    element('mission-distance').textContent = `${Math.round(distance())} m away`;
    element('mission-reward').textContent = `₹${FARE} fare`;
    element('location-label').textContent = car.z < -40 ? 'Market Road' : car.x < -45 ? 'Chaya Corner' : car.z > 40 ? 'Palm Avenue' : 'Bakery Road';
    const nearby = distance() <= 8;
    element('interact-button').querySelector('span')!.textContent = nearby ? Math.abs(car.speed) >= 2 ? 'Stop first' : pickingUp ? 'Pick up' : 'Drop off' : 'Interact';
    element<HTMLButtonElement>('interact-button').disabled = !nearby || Math.abs(car.speed) >= 2 || paused;
    element('interact-button').classList.toggle('ready', nearby && Math.abs(car.speed) < 2);
    document.body.classList.toggle('has-passenger', !pickingUp);
    pickupMarker.visible = pickingUp; dropoffMarker.visible = !pickingUp; passenger.visible = !pickingUp;
    minimap();
  }
  let last: number | undefined;
  let hudClock = 0;
  let slowFrames = 0;
  let reducedQuality = false;
  renderer.setAnimationLoop((now: number) => {
    const realDt = last === undefined ? 0 : Math.max(0, (now - last) / 1000);
    const dt = Math.min(realDt, 0.1); last = now;
    // Prefer responsive driving to high-resolution shadows on older phones/software GPUs.
    slowFrames = realDt > 0.075 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (!reducedQuality && slowFrames > 8) {
      reducedQuality = true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 0.85));
      renderer.shadowMap.enabled = false;
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => { material.needsUpdate = true; });
        }
      });
    }
    elapsed += dt;
    if (started && !paused) {
      const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
      for (let n = 0; n < steps; n++) {
        const hit = advanceCar(car, input.controls, dt / steps, world.colliders);
        if (hit && elapsed - lastToast > 3) { toast('Easy there! Use R to get back on the road.'); lastToast = elapsed; }
      }
      if (elapsed - lastSave > 2) { save(); lastSave = elapsed; }
    }
    rickshaw.group.position.set(car.x, 0.08, car.z); rickshaw.group.rotation.y = car.heading;
    rickshaw.animate(paused ? 0 : car.speed, car.steering, elapsed);
    world.update(elapsed);
    pickupMarker.children[2].position.y = dropoffMarker.children[2].position.y = 5 + Math.sin(elapsed * 2) * 0.3;
    desiredCamera.set(car.x + Math.sin(car.heading) * (10 + Math.abs(car.speed) * 0.07), 6.4 + Math.abs(car.speed) * 0.04, car.z + Math.cos(car.heading) * (10 + Math.abs(car.speed) * 0.07));
    cameraRay.origin.set(car.x, 1.5, car.z);
    cameraRay.direction.copy(desiredCamera).sub(cameraRay.origin).normalize();
    let cameraDistance = cameraRay.origin.distanceTo(desiredCamera);
    for (const box of cameraObstacles) {
      if (cameraRay.intersectBox(box, cameraHit)) cameraDistance = Math.min(cameraDistance, Math.max(2.5, cameraRay.origin.distanceTo(cameraHit) - 0.6));
    }
    desiredCamera.copy(cameraRay.origin).addScaledVector(cameraRay.direction, cameraDistance);
    lookAt.set(car.x - Math.sin(car.heading) * 5, 1.25, car.z - Math.cos(car.heading) * 5);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 5));
    smoothedLook.lerp(lookAt, 1 - Math.exp(-dt * 8)); camera.lookAt(smoothedLook);
    audio.update(car.speed, started && !paused);
    hudClock += dt;
    if (hudClock > 0.1) { updateHud(); hudClock = 0; }
    renderer.render(scene, camera);
  });
  updateHud();
  if (!storageAvailable) element('save-status').textContent = 'Storage unavailable · progress is temporary';
  element('game').addEventListener('webglcontextlost', e => {
    e.preventDefault(); save();
    if (started && !paused) pause();
    element('fatal-error').hidden = false;
    element('fatal-error').textContent = 'The graphics connection was lost. Reload to resume your saved ride.';
  });
} catch (error) {
  console.error(error);
  element('loading').hidden = true;
  element('fatal-error').hidden = false;
  element('fatal-error').textContent = 'Unable to start 3D graphics. Enable hardware acceleration or use a WebGL-capable browser, then reload.';
}
