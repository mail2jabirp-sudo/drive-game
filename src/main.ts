import * as THREE from 'three';
import './style.css';
import { createWorld, PICKUP, DROPOFF, SPAWN } from './world';
import { createLandscape } from './landscape';
import { createAtmosphere } from './atmosphere';
import { DISPLAY_KEY, GraphicsBudget, parseGraphicsMode } from './graphics';
import { createRickshaw } from './vehicle';
import { createStreamedRoadWorld } from './streamed-world';
import { createOsmWorld } from './osm-world';
import type { OsmMap } from './osm-types';
import { nearestRoad } from './osm-navigation';
import { WORLD_KEY, readOsmRide, serializeRouteProgress } from './route-save';
import { advanceCar, blocked, onRoad } from './driving';
import type { DriveState } from './driving';
import { Input } from './input';
import { GameAudio } from './audio';
import {createTraffic} from './traffic';
import {readDensity} from './traffic-types';
import { buyTea, TEA_PRICE, TEA_STOP } from './tea';
import { FARE, SAVE_KEY, newProgress, parseProgress, interactMission } from './progress';

const BRAND_TITLE='EN 3D — എന്റെ നാട്';
const SIMULATOR_SUBTITLE='Kerala Open World Simulator';
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let progress = newProgress();
let storageAvailable = true;
let rawSave: string | null = null;
try { rawSave = localStorage.getItem(SAVE_KEY); progress = parseProgress(rawSave); }
catch { storageAvailable = false; }
const practicePose = {x:progress.x, z:progress.z, heading:progress.heading, phase:progress.phase};
let osmRide = readOsmRide(rawSave);
let exportRide = readOsmRide(rawSave,'exportRide');
let mapId: string | null = null;
// Legacy URLs and area preferences all enter the same geographic district world.
let previousWorld: string|null=null;
try {previousWorld=localStorage.getItem(WORLD_KEY);localStorage.setItem(WORLD_KEY,'malappuram');}catch{/* Optional preference only. */}
const isReal = true;
const isExport = true;
document.body.classList.add('osm-mode');
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
  if (isExport && mapId) exportRide = {version:1,mapId,x:car.x,z:car.z,heading:car.heading,phase:progress.phase};
  else if (isReal && mapId) osmRide = {version:1, mapId, x:car.x, z:car.z, heading:car.heading, phase:progress.phase};
  else { progress.x = car.x; progress.z = car.z; progress.heading = car.heading; }
  try {
    localStorage.setItem(SAVE_KEY, serializeRouteProgress(progress, isReal ? practicePose : null, osmRide, exportRide));
    storageAvailable = true;
    element('save-status').textContent = 'Progress saved on this device';
  } catch {
    storageAvailable = false;
    element('save-status').textContent = 'Storage unavailable · progress is temporary';
  }
}

async function boot(): Promise<void> {
try {
  const renderer = new THREE.WebGLRenderer({ canvas: element<HTMLCanvasElement>('game'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dfe5df');
  scene.fog = new THREE.Fog('#dfe5df', 130, 400);
  const atmosphere = createAtmosphere(scene);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
  scene.add(new THREE.HemisphereLight('#d8e5ef', '#5b6650', 1.55));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.5);
  sun.position.set(-55, 85, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 240;
  sun.shadow.normalBias = 0.045;
  scene.add(sun, sun.target);
  let mapData: OsmMap | null = null;
  let streamed: Awaited<ReturnType<typeof createStreamedRoadWorld>> | null = null;
  if (isExport) {
    element('loading').textContent = 'Loading nearby roads…';
    streamed = await createStreamedRoadWorld(scene, exportRide ?? undefined, osmRide ?? undefined, previousWorld);
    mapData = streamed.data; mapId = mapData.source.sha256;
  } else if (isReal) {
    element('loading').textContent = 'Loading Kottakkal roads from your map.osm…';
    const response = await fetch(`${import.meta.env.BASE_URL}maps/kottakkal.json`);
    if (!response.ok) throw new Error(`Map request failed: ${response.status}`);
    mapData = await response.json() as OsmMap;
    if (mapData.version !== 1 || !mapData.roads?.length || !mapData.source?.sha256) throw new Error('Invalid map data; regenerate with npm run map:import');
    mapId = mapData.source.sha256;
  }
  const landscape = isReal ? {update: (_camera:THREE.Vector3) => {}, setLowDetail: (_low:boolean) => {}, chunkCount:0} : createLandscape(scene);
  const realWorld = streamed?.world ?? (mapData ? createOsmWorld(scene, mapData) : null);
  const world = realWorld ?? createWorld(scene);
  const groundHeight = (x:number,z:number) => realWorld?.heightAt(x,z) ?? 0;
  const carHeight = () => groundHeight(car.x,car.z);
  const pickup = realWorld?.pickup ?? PICKUP;
  const dropoff = realWorld?.dropoff ?? DROPOFF;
  const spawn = realWorld?.spawn ?? {x:SPAWN.x,z:SPAWN.z,heading:0};
  const tea = realWorld ? realWorld.tea : TEA_STOP;
  if(streamed?.manifest.teaStop)document.querySelector('#tea-panel h2')!.textContent=streamed.manifest.teaStop.name;
  const surface = realWorld ?? {roadSurface:onRoad, isBlocked:(x:number,z:number)=>blocked(x,z,world.colliders)};
  if (realWorld) {
    const ride = streamed?.restoredRide ?? (isExport ? exportRide : osmRide);
    const compatible = ride?.mapId === mapId;
    car.x = compatible ? ride!.x : spawn.x;
    car.z = compatible ? ride!.z : spawn.z;
    car.heading = compatible ? ride!.heading : spawn.heading;
    progress.phase = streamed?.restoredRide?.phase ?? ride?.phase ?? progress.phase;
  }
  element('map-attribution').hidden = !isReal;
  if(streamed?.terrainSource)element('map-attribution').append(document.createTextNode(` · Terrain: ${streamed.terrainSource.attribution}`));
  document.querySelector('.practice-notice')!.textContent = isExport ? 'Verified roads in a 36 km window · partial coverage, not the full district.' : isReal ? 'OSM roads and footprints · approximate buildings and heights · flat terrain.' : 'Fictional practice loop · real map available in the area selector.';
  document.querySelector('.welcome-eyebrow')!.textContent = 'EN 3D';
  document.querySelector('.welcome-footer span:first-child')!.textContent = BRAND_TITLE;
  document.querySelector('.welcome-footer span:last-child')!.textContent = SIMULATOR_SUBTITLE;
  document.querySelector('.map-heading > span')!.textContent = SIMULATOR_SUBTITLE;
  const rickshaw = createRickshaw();
  scene.add(rickshaw.group);
  if (surface.isBlocked(car.x, car.z)) {
    car.x = spawn.x; car.z = spawn.z; car.heading = spawn.heading;
  }

  const traffic=mapData&&realWorld?await createTraffic(scene,mapData,realWorld):null;
  const trafficSelect=element<HTMLSelectElement>('traffic-density');trafficSelect.value=traffic?.sim.density??'medium';
  trafficSelect.addEventListener('change',()=>{traffic?.setDensity(readDensity(trafficSelect.value));trafficSelect.blur();});
  element('clear-traffic').addEventListener('click',()=>{traffic?.clear();toast('Nearby traffic cleared. Your ride and fare are safe.');});
  const volume=element<HTMLInputElement>('audio-volume');
  try{const saved=JSON.parse(localStorage.getItem('en3d.audio.v1')??'{}');if(typeof saved.volume==='number'&&Number.isFinite(saved.volume))audio.volume=Math.max(0,Math.min(1,saved.volume));audio.muted=saved.muted===true;}catch{/* Optional audio preferences. */}
  volume.value=String(audio.volume);
  const saveAudio=()=>{try{localStorage.setItem('en3d.audio.v1',JSON.stringify({volume:audio.volume,muted:audio.muted}));}catch{/* Optional preference. */}};
  volume.addEventListener('input',()=>{audio.volume=Math.max(0,Math.min(1,Number(volume.value)));saveAudio();});
  element('sound-button').textContent=audio.muted?'♩':'♫';element('sound-button').setAttribute('aria-pressed',String(audio.muted));
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
  const pickupMarker = missionMarker(0xf5b83c); pickupMarker.position.set(pickup.x,groundHeight(pickup.x,pickup.z),pickup.z);
  const dropoffMarker = missionMarker(0x2da99a); dropoffMarker.position.set(dropoff.x,groundHeight(dropoff.x,dropoff.z),dropoff.z);
  // A passenger appears in the cabin only while a fare is active.
  const passenger = new THREE.Group();
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.33), new THREE.MeshStandardMaterial({ color: '#d36b4d' }));
  shirt.position.set(-0.35, 1.35, 0.84);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: '#a56843' }));
  head.position.set(-0.35, 1.78, 0.84);
  passenger.add(shirt, head); rickshaw.group.add(passenger);
  const waitingPassenger = new THREE.Group();
  if (realWorld) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.65,0.3), shirt.material); body.position.y = 1.15;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.18,10,8), head.material); face.position.y = 1.68;
    const trousers = new THREE.MeshStandardMaterial({color:'#374638'});
    for (const x of [-0.14,0.14]) {const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17,0.7,0.22),trousers);leg.position.set(x,0.48,0);waitingPassenger.add(leg);}
    waitingPassenger.add(body,face);
    waitingPassenger.position.set(pickup.x-Math.cos(spawn.heading)*3,0,pickup.z+Math.sin(spawn.heading)*3);
    waitingPassenger.position.y=groundHeight(waitingPassenger.position.x,waitingPassenger.position.z);
    scene.add(waitingPassenger);
  }
  const target = () => progress.phase === 'pickup' ? pickup : dropoff;
  const distance = () => Math.hypot(car.x - target().x, car.z - target().z);

  const teaDistance = () => tea ? Math.hypot(car.x - tea.x, car.z - tea.z) : Infinity;
  const teaRing = new THREE.Mesh(new THREE.RingGeometry(2.8, 3.0, 32), new THREE.MeshBasicMaterial({ color: '#c97645', side: THREE.DoubleSide }));
  teaRing.rotation.x = -Math.PI / 2; teaRing.position.set(tea?.x ?? 0, 0.13, tea?.z ?? 0); scene.add(teaRing);
  function interactTea(): void {
    if (!started || paused || elapsed - lastInteraction < 1) return;
    lastInteraction = elapsed;
    const result = buyTea(progress, teaDistance(), car.speed);
    if (result === 'bought') {
      audio.success(); save();
      toast(`A warm cup of chaya. −₹${TEA_PRICE} · ${progress.teaBreaks} tea break${progress.teaBreaks === 1 ? '' : 's'} enjoyed.`);
    } else if (result === 'insufficient') toast('Chaya is ₹10. Complete a passenger fare, then stop by.');
    else if (result === 'moving') toast('Park your auto before taking a tea break.');
    else toast('Pull into the terracotta circle beside Chaya Kada.');
    updateHud();
  }
  element('tea-button').addEventListener('click', interactTea);

  function interact(): void {
    if (!started || paused || elapsed - lastInteraction < 1) return;
    if (teaDistance() <= 9 && distance() > 8) { interactTea(); return; }
    lastInteraction = elapsed;
    const result = interactMission(progress, distance(), car.speed);
    if (result === 'pickup') {
      toast(isReal ? 'Passenger aboard! Follow the mapped road route to the next stop.' : 'Passenger aboard! Take the loop to the market.'); audio.success(); save();
    } else if (result === 'dropoff') {
      toast(`Trip complete · +₹${FARE}! Another passenger is waiting.`); audio.success(); save();
    } else if (distance() <= 8) toast('Brake to a stop to help your passenger.');
    else toast('Follow the gold marker to pick up, or teal to drop off.');
    updateHud();
  }
  function resetCar(): void {
    car.x = spawn.x; car.z = spawn.z; car.heading = spawn.heading; car.speed = 0; car.steering = 0;
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
    if (paused) { audio.silence();save(); toast('Paused · press P or Resume to keep driving'); }
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
    started = true; paused = false; document.body.classList.remove('paused'); document.body.classList.add('playing');
    element('start-screen').hidden = true; input.clear(); audio.start();
    if (!storageAvailable) toast('Browser storage is unavailable. This ride will not be saved.');
    else toast(progress.phase === 'dropoff' ? 'Welcome back! Your passenger is still aboard.' : isExport ? 'Malappuram source-road fare · stop in gold and press E.' : isReal ? 'Kottakkal road fare · stop in gold and press E to pick up.' : 'Welcome to Kottakkal. Your first passenger is up the road.');
    save();
    element<HTMLCanvasElement>('game').focus();
  });
  element('interact-button').addEventListener('click', interact);
  element('reset-button').addEventListener('click', () => { if (started && !paused) resetCar(); });
  element('pause-button').addEventListener('click', pause);
  element('sound-button').addEventListener('click', () => {
    audio.start(); audio.muted = !audio.muted;saveAudio();
    element('sound-button').textContent = audio.muted ? '♩' : '♫';
    element('sound-button').setAttribute('aria-label', audio.muted ? 'Turn sound on' : 'Mute sound');
    element('sound-button').title = audio.muted ? 'Sound off · tap to enable' : 'Sound on · tap to mute';
    element('sound-button').setAttribute('aria-pressed', String(audio.muted));
  });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden && started) { save(); if (!paused) pause(); } });

  let cameraColliderSource = world.colliders;
  let cameraObstacles = cameraColliderSource.map(b => new THREE.Box3(new THREE.Vector3(b.minX, 0, b.minZ), new THREE.Vector3(b.maxX, 17, b.maxZ)));
  const cameraRay = new THREE.Ray();
  const cameraHit = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const audioForward=new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const smoothedLook = new THREE.Vector3();
  function snapCamera(): void {
    camera.position.set(car.x + Math.sin(car.heading) * 10, carHeight()+6.4, car.z + Math.cos(car.heading) * 10);
    smoothedLook.set(car.x - Math.sin(car.heading) * 5, carHeight()+1.2, car.z - Math.cos(car.heading) * 5);
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
    const scale = mapData ? Math.min(w / (mapData.bounds.maxX-mapData.bounds.minX+45), h / (mapData.bounds.maxZ-mapData.bounds.minZ+45)) : 0.91;
    const viewScale = isExport ? 0.12 : scale;
    const sx = (x: number) => w / 2 + (x - (isExport ? car.x : 0)) * viewScale;
    const sz = (z: number) => h / 2 + (z - (isExport ? car.z : 0)) * viewScale;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e0e6cf'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c7d2b7';
    for (const box of world.colliders) ctx.fillRect(sx(box.minX), sz(box.minZ), (box.maxX - box.minX) * scale, (box.maxZ - box.minZ) * scale);
    if (mapData) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const road of mapData.roads) {
        ctx.strokeStyle = '#faf7e8'; ctx.lineWidth = Math.max(1.2,road.width*viewScale);
        ctx.beginPath(); road.points.forEach((p,i)=> i ? ctx.lineTo(sx(p.x),sz(p.z)) : ctx.moveTo(sx(p.x),sz(p.z))); ctx.stroke();
      }
      if (realWorld?.mission.route.length) {
        ctx.strokeStyle = '#c08433'; ctx.lineWidth = 2.8; ctx.beginPath();
        realWorld.mission.route.forEach((p,i)=> i ? ctx.lineTo(sx(p.x),sz(p.z)) : ctx.moveTo(sx(p.x),sz(p.z))); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = '#f9f6e8'; ctx.lineWidth = 16; ctx.lineJoin = 'round';
      ctx.strokeRect(sx(-72),sz(-62),144*scale,124*scale);
      ctx.strokeStyle = '#b7bba7'; ctx.lineWidth = 1; ctx.setLineDash([3,4]);
      ctx.strokeRect(sx(-72),sz(-62),144*scale,124*scale); ctx.setLineDash([]);
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#75816a'; ctx.fillText('KOTTAKKAL',w/2,h/2-3);
      ctx.font = '9px sans-serif'; ctx.fillText('PRACTICE LOOP',w/2,h/2+11);
    }
    if (tea) {ctx.fillStyle = '#c97645'; ctx.beginPath(); ctx.arc(sx(tea.x),sz(tea.z),4,0,Math.PI*2);ctx.fill();}
    ctx.beginPath(); ctx.arc(sx(target().x), sz(target().z), 6, 0, Math.PI * 2);
    ctx.fillStyle = progress.phase === 'pickup' ? '#e9a52b' : '#198c7c'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(sx(car.x), sz(car.z)); ctx.rotate(-car.heading);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fillStyle = '#1c3833'; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    ctx.fillStyle='#294a3a';ctx.font='9px sans-serif';
    for(const place of streamed?.manifest.places ?? []){const x=sx(place.x),z=sz(place.z);if(x>12&&x<w-40&&z>35&&z<h-15)ctx.fillText(place.nameMl ? `${place.name} · ${place.nameMl}` : place.name,x,z);}
    ctx.fillStyle = '#687766'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('N ↑', w - 20, 20);
  }
  function updateHud(): void {
    element('traffic-status').textContent=traffic?.status??'Traffic unavailable';
    element('money').textContent = `₹${progress.money.toLocaleString('en-IN')}`;
    element('trips').textContent = String(progress.trips);
    element('speed').textContent = String(Math.round(Math.abs(car.speed) * 3.6));
    const pickingUp = progress.phase === 'pickup';
    element('mission-title').textContent = isExport ? pickingUp ? 'Passenger fare' : 'Passenger aboard' : isReal ? pickingUp ? 'Kottakkal road fare' : 'Passenger aboard' : pickingUp ? 'A ride to the market' : 'Next stop: market';
    element('mission-description').textContent = realWorld ? pickingUp ? `Stop at ${realWorld.mission.pickupName}.` : `Follow the map route to ${realWorld.mission.dropoffName}.` : pickingUp ? 'A passenger is waiting outside the bakery. Pull into the gold circle.' : 'Passenger aboard. Follow the loop to the market bus stand and stop in the teal circle.';
    element('stream-status').hidden = !streamed;
    if(streamed) {const status=streamed.world.streaming;element('stream-status').textContent=status.error || `${status.resident}/${status.total} road tiles${status.loading ? ' · loading nearby…' : ' · nearby only'}`;}
    element('mission-distance').textContent = `${Math.round(distance())} m away`;
    element('mission-reward').textContent = `₹${FARE} fare`;
    element('location-label').textContent = car.z < -40 ? 'Market Road' : car.x < -45 ? 'Chaya Corner' : car.z > 40 ? 'Palm Avenue' : 'Bakery Road';
    if (mapData) {
      const nearest = nearestRoad(mapData.roads, {x:car.x,z:car.z});
      const nearbyPlace=streamed?.manifest.places?.filter(p=>Math.hypot(p.x-car.x,p.z-car.z)<1200).sort((a,b)=>Math.hypot(a.x-car.x,a.z-car.z)-Math.hypot(b.x-car.x,b.z-car.z))[0];
      element('location-label').textContent = nearbyPlace ? `${nearbyPlace.name}${nearbyPlace.nameMl ? ` · ${nearbyPlace.nameMl}` : ''}` : nearest?.road.name || nearest?.road.highway || SIMULATOR_SUBTITLE;
      element('road-rules').textContent = nearest ? `${nearest.road.oneway !== 'no' ? 'One-way · ' : ''}${nearest.road.maxspeed === null ? 'limit unmapped' : `${nearest.road.maxspeed} km/h OSM`}` : 'Road data unavailable';
    }
    const nearby = distance() <= 8;
    const nearTea = teaDistance() <= 9;
    element('tea-panel').hidden = teaDistance() > 21;
    element('tea-count').textContent = `${progress.teaBreaks} tea break${progress.teaBreaks === 1 ? '' : 's'} enjoyed`;
    element<HTMLButtonElement>('tea-button').disabled = !nearTea || Math.abs(car.speed) >= 2 || paused;
    teaRing.visible = teaDistance() < 35;
    element('interact-button').querySelector('span')!.textContent = nearby ? Math.abs(car.speed) >= 2 ? 'Stop first' : pickingUp ? 'Pick up' : 'Drop off' : nearTea ? Math.abs(car.speed) >= 2 ? 'Stop first' : 'Have chai' : 'Interact';
    element<HTMLButtonElement>('interact-button').disabled = (!nearby && !nearTea) || Math.abs(car.speed) >= 2 || paused;
    element('interact-button').classList.toggle('ready', (nearby || nearTea) && Math.abs(car.speed) < 2);
    document.body.classList.toggle('has-passenger', !pickingUp);
    pickupMarker.visible = pickingUp; dropoffMarker.visible = !pickingUp; passenger.visible = !pickingUp; waitingPassenger.visible = pickingUp;
    minimap();
  }
  let last: number | undefined;
  let hudClock = 0;
  let displayMode = parseGraphicsMode(null);
  try { displayMode = parseGraphicsMode(localStorage.getItem(DISPLAY_KEY)); } catch { /* Use Auto when storage is unavailable. */ }
  const graphics = new GraphicsBudget(displayMode);
  const qualitySelect = element<HTMLSelectElement>('quality-select');
  qualitySelect.value = graphics.mode;
  function applyGraphics(): void {
    renderer.setPixelRatio(graphics.lowDetail ? Math.min(window.devicePixelRatio, 0.85) : Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = !graphics.lowDetail;
    landscape.setLowDetail(graphics.lowDetail);
    element('render-status').textContent = graphics.mode === 'low' ? 'Battery saver' : graphics.lowDetail ? 'Auto · reduced detail' : 'Auto · standard';
    scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => { material.needsUpdate = true; });
      }
    });
  }
  qualitySelect.addEventListener('change', () => {
    graphics.setMode(parseGraphicsMode(qualitySelect.value));
    applyGraphics();
    try { localStorage.setItem(DISPLAY_KEY, graphics.mode); } catch { /* Preferences are optional; gameplay storage reports failures separately. */ }
    qualitySelect.blur();
  });
  applyGraphics();
  renderer.setAnimationLoop((now: number) => {
    const realDt = last === undefined ? 0 : Math.max(0, (now - last) / 1000);
    const dt = Math.min(realDt, 0.1); last = now;
    if (graphics.observeFrame(realDt)) applyGraphics();
    elapsed += dt;
    traffic?.update(dt,car,graphics.lowDetail,started&&!paused);
    if (started && !paused) {
      const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
      for (let n = 0; n < steps; n++) {
        const oldX=car.x,oldZ=car.z;
        const hit = advanceCar(car, input.controls, dt / steps, world.colliders, realWorld ?? undefined);
        if(traffic?.blocksPlayer(car.x,car.z,car.heading)){car.x=oldX;car.z=oldZ;car.speed=0;if(elapsed-lastToast>3){toast('Traffic ahead · wait for a clear gap or use Display to clear nearby traffic.');lastToast=elapsed;}}
        if (hit && elapsed - lastToast > 3) { toast('Easy there! Use R to get back on the road.'); lastToast = elapsed; }
      }
      if (elapsed - lastSave > 2) { save(); lastSave = elapsed; }
    }
    rickshaw.group.position.set(car.x, carHeight()+0.08, car.z);
    rickshaw.group.rotation.order='YXZ';rickshaw.group.rotation.y=car.heading;
    const dx=-Math.sin(car.heading),dz=-Math.cos(car.heading);
    const pitch=Math.atan2(groundHeight(car.x+dx,car.z+dz)-groundHeight(car.x-dx,car.z-dz),2);
    const rx=Math.cos(car.heading),rz=-Math.sin(car.heading);
    const roll=Math.atan2(groundHeight(car.x+rx,car.z+rz)-groundHeight(car.x-rx,car.z-rz),2);
    rickshaw.group.rotation.x+=(pitch-rickshaw.group.rotation.x)*(1-Math.exp(-dt*8));
    rickshaw.group.rotation.z+=(roll-rickshaw.group.rotation.z)*(1-Math.exp(-dt*8));
    rickshaw.animate(paused ? 0 : car.speed, car.steering, elapsed);
    if (realWorld) realWorld.update(elapsed, camera.position, graphics.lowDetail); else world.update(elapsed, camera.position);
    landscape.update(camera.position);
    sun.position.set(car.x - 45, carHeight()+70, car.z + 25);
    sun.target.position.set(car.x, carHeight(), car.z);
    pickupMarker.children[2].position.y = dropoffMarker.children[2].position.y = 5 + Math.sin(elapsed * 2) * 0.3;
    desiredCamera.set(car.x + Math.sin(car.heading) * (10 + Math.abs(car.speed) * 0.07), carHeight()+6.4 + Math.abs(car.speed) * 0.04, car.z + Math.cos(car.heading) * (10 + Math.abs(car.speed) * 0.07));
    cameraRay.origin.set(car.x, carHeight()+1.5, car.z);
    cameraRay.direction.copy(desiredCamera).sub(cameraRay.origin).normalize();
    let cameraDistance = cameraRay.origin.distanceTo(desiredCamera);
    if(cameraColliderSource!==world.colliders){cameraColliderSource=world.colliders;cameraObstacles=cameraColliderSource.map(b=>new THREE.Box3(new THREE.Vector3(b.minX,0,b.minZ),new THREE.Vector3(b.maxX,17,b.maxZ)));}
    for (const box of cameraObstacles) {
      if (cameraRay.intersectBox(box, cameraHit)) cameraDistance = Math.min(cameraDistance, Math.max(2.5, cameraRay.origin.distanceTo(cameraHit) - 0.6));
    }
    desiredCamera.copy(cameraRay.origin).addScaledVector(cameraRay.direction, cameraDistance);
    lookAt.set(car.x - Math.sin(car.heading) * 5, carHeight()+1.25, car.z - Math.cos(car.heading) * 5);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 5));
    smoothedLook.lerp(lookAt, 1 - Math.exp(-dt * 8)); camera.lookAt(smoothedLook);
    audio.update(car.speed, started && !paused);
    audio.updateTraffic(traffic?.sim.agents??[],camera.position,camera.getWorldDirection(audioForward),started&&!paused,dt);
    hudClock += dt;
    if (hudClock > 0.1) { updateHud(); hudClock = 0; }
    atmosphere.update(camera.position);
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
  element('fatal-error').textContent = isExport ? 'Unable to load the uploaded road tiles or 3D graphics. Your saved progress is safe. ' : isReal ? 'Unable to load the real Kottakkal map or 3D graphics. Your saved progress is safe. ' : 'Unable to start 3D graphics. Enable hardware acceleration or use a WebGL-capable browser, then reload. ';
  if (isReal) {
    const fallback = document.createElement('a');
    const terrainRequested=isExport&&new URLSearchParams(location.search).get('terrain')==='1';
    if(terrainRequested) element('fatal-error').textContent='The terrain prototype requires a verified local DEM. Your saves are safe. ';
    fallback.href = location.pathname; fallback.textContent = terrainRequested ? 'Continue without terrain' : 'Retry loading';
    element('fatal-error').append(fallback);
  }
}

}
void boot();
