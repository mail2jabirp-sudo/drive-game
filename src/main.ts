import * as THREE from 'three';
import './style.css';
import {WalkingController,readFootSave} from './walking';
import {createCharacter} from './character';
import {TrafficObstacles} from './traffic-obstacles';
import {rectanglesOverlap} from './traffic-sim';
import { createWorld, PICKUP, DROPOFF, SPAWN } from './world';
import { createLandscape } from './landscape';
import { createAtmosphere } from './atmosphere';
import { DISPLAY_KEY, GraphicsBudget, parseGraphicsMode } from './graphics';
import {createPlayableVehicle} from './road-vehicle';
import {VEHICLES,readFleet,placeFleet,availableVehicle} from './fleet';
import type {FleetSave,FleetVehicle} from './fleet';
import { createStreamedRoadWorld } from './streamed-world';
import { createOsmWorld } from './osm-world';
import type { OsmMap } from './osm-types';
import {roadSpawn} from './road-spawn';
import { nearestRoad } from './osm-navigation';
import { WORLD_KEY, readOsmRide, serializeRouteProgress } from './route-save';
import { advanceCar, blocked, onRoad } from './driving';
import type { DriveState } from './driving';
import { Input } from './input';
import { GameAudio } from './audio';
import {createTraffic} from './traffic';
import {readDensity,signalPhase,signalCountdown} from './traffic-types';
import {RoadNavigator,turnGuidance} from './gps';
import type {NavigationRoute} from './gps';
import {createGpsRenderer,navigationIcon} from './gps-renderer';
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
let savedRideAvailable=false;
try{const saved=JSON.parse(rawSave??'null');savedRideAvailable=saved?.version===1&&Number.isFinite(saved.money)&&Number.isFinite(saved.trips);}catch{/* Invalid saves do not enable Continue. */}
let onFootSave=readFootSave(rawSave);
let mapId: string | null = null;
let missionOrigin: {x:number;z:number}|undefined;
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
let fleetSave:FleetSave|null=null;
let car: DriveState = { x: progress.x, z: progress.z, heading: progress.heading, speed: 0, steering: 0 };

function toast(message: string): void {
  element('toast').textContent = message;
  element('toast').classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element('toast').classList.remove('visible'), 4000);
}
function save(): void {
  if (isExport && mapId) exportRide = {version:1,mapId,missionOrigin,x:car.x,z:car.z,heading:car.heading,phase:progress.phase};
  else if (isReal && mapId) osmRide = {version:1, mapId, x:car.x, z:car.z, heading:car.heading, phase:progress.phase};
  else { progress.x = car.x; progress.z = car.z; progress.heading = car.heading; }
  try {
    localStorage.setItem(SAVE_KEY, serializeRouteProgress(progress, isReal ? practicePose : null, osmRide, exportRide,onFootSave,fleetSave));
    storageAvailable = true;savedRideAvailable=true;
    if(mapId){element<HTMLButtonElement>('continue-button').disabled=false;element('continue-status').textContent=`₹${progress.money} · ${progress.trips} trips`;}
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
  renderer.toneMappingExposure = 1.03;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c2d4d5');
  scene.fog = new THREE.Fog('#c2d4d5', 170, 420);
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
    missionOrigin=streamed.missionOrigin;
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
  document.querySelector('.welcome-eyebrow')!.textContent = 'THE ROAD FEELS LIKE HOME';
  document.querySelector('.welcome-footer span:first-child')!.textContent = BRAND_TITLE;
  document.querySelector('.welcome-footer span:last-child')!.textContent = SIMULATOR_SUBTITLE;
  document.querySelector('.map-heading > span')!.textContent = SIMULATOR_SUBTITLE;

  if(mapData)Object.assign(car,roadSpawn(mapData,surface,car));
  else if(surface.isBlocked(car.x,car.z))Object.assign(car,spawn);

  const restoredFleet=mapId?readFleet(rawSave,mapId):null;
  const fleet=restoredFleet?.vehicles??(mapData?placeFleet(mapData,surface,car):[{id:'auto' as const,kind:'auto' as const,state:car,taxiAvailable:false}]);
  let activeVehicle=fleet.find(v=>v.id===restoredFleet?.active)??fleet[0];
  // The legacy exportRide mirrors the active vehicle; only repair that vehicle
  // against its loaded source window. Distant parked poses stay intact.
  if(restoredFleet)Object.assign(activeVehicle.state,car);
  car=activeVehicle.state;
  const models=new Map(fleet.map(v=>{const model=createPlayableVehicle(v.kind);model.setOccupied(false);scene.add(model.group);return [v.id,model] as const;}));
  let rickshaw=models.get(activeVehicle.id)!;
  const vehicleSpec=()=>VEHICLES[activeVehicle.kind];
  if(restoredFleet&&mapData)Object.assign(car,roadSpawn(mapData,surface,car,vehicleSpec()));
  const syncFleetSave=()=>{if(mapId)fleetSave={version:1,mapId,active:activeVehicle.id,vehicles:fleet};};syncFleetSave();
  const parkedVehicles=()=>fleet.filter(v=>v!==activeVehicle||foot.active);
  const nearestVehicle=()=>availableVehicle(fleet,foot.pose,progress.phase==='dropoff'?activeVehicle.id:null);
  const vehicleBox=(v:FleetVehicle)=>({...v.state,...VEHICLES[v.kind]});
  const vehicleBlocks=(p:{x:number;z:number;heading?:number},width:number,length:number,ignore?:FleetVehicle)=>fleet.some(v=>v!==ignore&&rectanglesOverlap({...p,heading:p.heading??0,width,length},vehicleBox(v),.12));
  const traffic=mapData&&realWorld?await createTraffic(scene,mapData,realWorld):null;
  let interactionVehicle=activeVehicle;
  const footObstacles=new TrafficObstacles();
  const footBlocked=(p:{x:number;z:number},ignoreVehicle=false)=>{
    if(mapData)footObstacles.update(mapData.buildings);
    return (realWorld?realWorld.isBlocked(p.x,p.z,.35):surface.isBlocked(p.x,p.z))||footObstacles.blocked({...p,heading:0},{width:.7,length:.7})||!!traffic?.blocksPedestrian(p.x,p.z)||vehicleBlocks(p,.7,.7,ignoreVehicle?interactionVehicle:undefined);
  };
  const drivingHints=document.querySelector('.desktop-controls')!.innerHTML;
  const foot=new WalkingController(footBlocked),character=createCharacter();scene.add(character.group);
  if(onFootSave?.mapId===mapId){
    if(streamed)await streamed.world.refresh(onFootSave);
    if(!foot.restore(onFootSave))onFootSave=null;
  }else onFootSave=null;
  const focus=()=>foot.active?foot.pose:car;
  const syncFootSave=()=>{const p=foot.snapshot;onFootSave=p&&mapId?{version:1,mapId,...p}:null;};
  function vehicleAction(){
    if(!started||paused)return;
    if(foot.transition)return;
    const candidate=foot.active?nearestVehicle():activeVehicle;
    if(!candidate){toast('No available stopped vehicle nearby.');return;}
    interactionVehicle=candidate;
    const result=foot.mode==='driving'?foot.exit(car,activeVehicle.kind==='auto'?-1:1):foot.enter(candidate.state);
    if(result==='ok'){
      if(foot.mode==='entering'){
        activeVehicle=candidate;car=candidate.state;rickshaw=models.get(candidate.id)!;rickshaw.group.add(passenger);
      }
      const doorPoint=foot.snapshot??foot.pose,doorSide=Math.sign((doorPoint.x-candidate.state.x)*Math.cos(candidate.state.heading)-(doorPoint.z-candidate.state.z)*Math.sin(candidate.state.heading))||1;
      car.speed=0;models.get(candidate.id)!.setDoor(true,doorSide);input.clear();
      toast(foot.mode==='exiting'?'On foot · walk to an available vehicle and press F.':`Entering ${VEHICLES[candidate.kind].name}.`);
      syncFootSave();syncFleetSave();save();
    }
    else if(result==='moving')toast('ആദ്യം നിർത്തുക · Stop completely before leaving the vehicle.');
    else if(result==='blocked')toast(foot.active?'Entry blocked · approach a clear side.':'Exit blocked · move to a clear, safe stopping place.');
    else if(result==='far')toast('വാഹനത്തിലേക്ക് മടങ്ങുക · Walk within 3 m of an available vehicle to enter.');
  }
  const taxiButton=document.createElement('button');taxiButton.id='taxi-availability';taxiButton.className='vehicle-action';element('vehicle-action').after(taxiButton);
  taxiButton.addEventListener('click',()=>{if(!started||paused||foot.active)return;if(progress.phase==='dropoff'){toast('Finish this fare before going unavailable.');return;}activeVehicle.taxiAvailable=!activeVehicle.taxiAvailable;syncFleetSave();save();updateHud();element('game').focus();});
  const entryPrompt=document.createElement('div');entryPrompt.id='vehicle-prompt';entryPrompt.className='vehicle-prompt';entryPrompt.hidden=true;document.body.append(entryPrompt);
  element('vehicle-action').addEventListener('click',()=>{vehicleAction();element('game').focus();});
  const trafficSelect=element<HTMLSelectElement>('traffic-density');trafficSelect.value=traffic?.sim.density??'medium';
  trafficSelect.addEventListener('change',()=>{traffic?.setDensity(readDensity(trafficSelect.value));});
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
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,.7,24,1,true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.025, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = .35; group.add(beam);
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
  let waitingPassengerValid=false;
  if (realWorld) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.65,0.3), shirt.material); body.position.y = 1.15;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.18,10,8), head.material); face.position.y = 1.68;
    const trousers = new THREE.MeshStandardMaterial({color:'#374638'});
    for (const x of [-0.14,0.14]) {const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17,0.7,0.22),trousers);leg.position.set(x,0.48,0);waitingPassenger.add(leg);}
    waitingPassenger.add(body,face);
    placeWaitingPassenger();
    waitingPassenger.name='Passenger at validated roadside pickup';scene.add(waitingPassenger);
  }
  function placeWaitingPassenger(){
    waitingPassengerValid=false;if(!realWorld)return;
    const match=mapData?nearestRoad(mapData.roads,pickup):null;
    if(match){
      for(const side of [1,-1])for(const extra of [1.2,2.2,3.2]){
        if(waitingPassengerValid)break;
        const offset=(match.road.width/2+extra)*side,x=match.point.x-Math.cos(match.heading)*offset,z=match.point.z+Math.sin(match.heading)*offset;
        if(!realWorld.roadSurface(x,z)&&!realWorld.isBlocked(x,z)){waitingPassenger.position.set(x,groundHeight(x,z),z);waitingPassengerValid=true;}
      }
    }
    // At a junction both perpendicular shoulders can still be pavement. Search
    // the nearby verge rather than putting the waiting person in live traffic.
    for(const radius of [3.5,5,7,9])for(let i=0;i<16&&!waitingPassengerValid;i++){
      const angle=i*Math.PI/8,x=pickup.x+Math.cos(angle)*radius,z=pickup.z+Math.sin(angle)*radius;
      if(!realWorld.roadSurface(x,z)&&!realWorld.isBlocked(x,z)){waitingPassenger.position.set(x,groundHeight(x,z),z);waitingPassengerValid=true;}
    }
  }
  let waitingPassengerRoads=mapData?.roads;
  const target = () => foot.active?(nearestVehicle()?.state??car):progress.phase === 'pickup' ? pickup : dropoff;
  const navigator=new RoadNavigator(),gpsRenderer=createGpsRenderer(scene,groundHeight);
  let navRoute:NavigationRoute={points:[],distance:0,offRoad:false,available:false},navRevision=0;
  let navOnFoot=foot.active;
  let navFrom={x:Infinity,z:Infinity},navTarget={x:Infinity,z:Infinity},nextNavigation=0;
  function updateNavigation(){
    if(!mapData)return;const actor=focus();
    const changed=navigator.setRoads(mapData.roads),destination=target();
    if(changed||navOnFoot!==foot.active||destination.x!==navTarget.x||destination.z!==navTarget.z||elapsed>=nextNavigation&&Math.hypot(actor.x-navFrom.x,actor.z-navFrom.z)>6){
      navOnFoot=foot.active;navRoute=navigator.route(actor,destination);navRevision++;navFrom={x:actor.x,z:actor.z};navTarget={...destination};nextNavigation=elapsed+1;gpsRenderer.update(navRoute,actor,foot.active);
    }
    const nearAuto=foot.active&&Math.hypot(actor.x-target().x,actor.z-target().z)<=3.2;
    const instruction=nearAuto?{arrow:'↥',text:activeVehicle.kind==='auto'&&nearestVehicle()===activeVehicle?'Enter your parked auto':`F · Enter ${VEHICLES[nearestVehicle()?.kind??activeVehicle.kind].name}`,distance:Math.hypot(actor.x-target().x,actor.z-target().z)}:turnGuidance(navRoute,actor);
    const arrow=element('gps-arrow');if(arrow.dataset.direction!==instruction.arrow){arrow.innerHTML=navigationIcon(instruction.arrow);arrow.dataset.direction=instruction.arrow;}
    element('gps-instruction').textContent=instruction.text;
    const localTurn:Record<string,string>={'↰':'ഇടത്തോട്ട് തിരിയുക','↱':'വലത്തോട്ട് തിരിയുക','↶':'സുരക്ഷിതമായി തിരിയുക','↥':'റോഡിലേക്ക് മടങ്ങുക'};
    element('gps-distance').textContent=navRoute.available?`${Math.round(instruction.distance)} m · ${foot.active?(nearestVehicle()?.kind??'vehicle'):progress.phase==='pickup'?'pickup':'drop-off'}${localTurn[instruction.arrow]?' · '+localTurn[instruction.arrow]:''}`:'Waiting for connected road coverage';
    const warning=element('road-warning'),signal=element('signal-status');warning.hidden=true;signal.hidden=true;
    if(!traffic)return;
    const ahead=(p:{x:number;z:number},range:number)=>Math.hypot(p.x-actor.x,p.z-actor.z)<range&&-(p.x-actor.x)*Math.sin(actor.heading)-(p.z-actor.z)*Math.cos(actor.heading)>-4;
    const match=nearestRoad(mapData.roads,car);
    const control=[...traffic.sim.controls.values()].filter(c=>c.kind==='traffic_signals'&&traffic.sim.nodeEdges.has(c.nodeId)&&match?.road.nodeIds.includes(c.nodeId)&&ahead(c,90)).sort((a,b)=>Math.hypot(a.x-actor.x,a.z-actor.z)-Math.hypot(b.x-actor.x,b.z-actor.z))[0];
    if(control){const phase=signalPhase(traffic.sim.clock,actor.heading);signal.hidden=false;signal.dataset.phase=phase;signal.textContent=`Simulated signal · ${phase} · ${signalCountdown(traffic.sim.clock,actor.heading)} s`;}
    if(match?.road.bridge&&match.distance<15){warning.hidden=false;warning.textContent='പാലം · Bridge — keep left';}
    else if([...traffic.sim.junctions].some(id=>{if(!match?.road.nodeIds.includes(id))return false;const e=traffic.sim.nodeEdges.get(id)!;return ahead(e.from===id?e.a:e.b,40);})){warning.hidden=false;warning.textContent='ജംഗ്ഷൻ · Junction — slow down';}
    else if(match?.road.points.some((b,i,list)=>{if(!i||i===list.length-1||!ahead(b,35))return false;const a=list[i-1],c=list[i+1],ux=b.x-a.x,uz=b.z-a.z,vx=c.x-b.x,vz=c.z-b.z;return Math.abs(Math.atan2(uz*vx-ux*vz,ux*vx+uz*vz))>.6;})){warning.hidden=false;warning.textContent='വളവ് · Bend — slow down';}
  }
  const distance = () => Math.hypot(focus().x-target().x,focus().z-target().z);

  const teaDistance = () => tea ? Math.hypot(car.x - tea.x, car.z - tea.z) : Infinity;
  const teaRing = new THREE.Mesh(new THREE.RingGeometry(2.8, 3.0, 32), new THREE.MeshBasicMaterial({ color: '#c97645', side: THREE.DoubleSide }));
  teaRing.rotation.x = -Math.PI / 2; teaRing.position.set(tea?.x ?? 0, 0.13, tea?.z ?? 0); scene.add(teaRing);
  function interactTea(): void {
    if(foot.active){toast('Return to your auto before using the tea stop.');return;}
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
    if(foot.active){vehicleAction();return;}
    if (!started || paused || elapsed - lastInteraction < 1) return;
    if (teaDistance() <= 9 && distance() > 8) { interactTea(); return; }
    if(progress.phase==='pickup'&&activeVehicle.kind!=='auto'&&(!vehicleSpec().taxiEligible||!activeVehicle.taxiAvailable)){toast(vehicleSpec().taxiEligible?'Set taxi availability to ON to accept a car request.':'This van is free-driving only. Passenger fares require an auto or available taxi.');return;}
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
    if(foot.active){toast('Follow GPS back to your parked auto.');return;}
    const recovered=mapData?roadSpawn(mapData,{roadSurface:surface.roadSurface,isBlocked:(x,z)=>surface.isBlocked(x,z)||vehicleBlocks({x,z,heading:spawn.heading},vehicleSpec().width,vehicleSpec().length,activeVehicle)},spawn,vehicleSpec()):spawn;
    car.x = recovered.x; car.z = recovered.z; car.heading = recovered.heading; car.speed = 0; car.steering = 0;
    snapCamera(); save(); toast('Back on the road. Your fare and earnings are safe.');
  }
  function pause(): void {
    if (!started) return;
    paused = !paused; input.clear();if(foot.active)foot.pose.speed=0;
    element('pause-button').innerHTML = paused
      ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 2 10 6-10 6Z" fill="currentColor"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" stroke="currentColor" stroke-width="3"/></svg>';
    element('pause-button').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    element('pause-button').title = paused ? 'Resume game (P)' : 'Pause game (P)';
    element('pause-button').setAttribute('aria-pressed', String(paused));
    document.body.classList.toggle('paused', paused);element('pause-screen').hidden=!paused;
    if (paused) { audio.silence();save(); toast('Paused · press P or Resume to keep driving'); }
    else toast('Enjoy the ride.');
  }
  input = new Input(name => {
    if(document.querySelector('dialog[open]'))return;
    if (name === 'pause') { pause(); return; }
    if(name==='camera'){if(started&&!paused){if(foot.active)foot.viewHeading+=Math.PI/4;else switchCamera();}return;}
    if (!started || paused) return;
    if(name==='vehicle'){vehicleAction();return;}
    if (name === 'interact') interact();
    if (name === 'horn'&&!foot.active) audio.horn(activeVehicle.kind==='auto'?370:activeVehicle.kind==='van'?260:420);
    if (name === 'reset') resetCar();
  });
  function beginDriving(){
    resumeAfterDialog=false;document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());
    started=true;paused=false;document.body.classList.remove('paused');document.body.classList.add('playing');
    element('start-screen').hidden=true;element('pause-screen').hidden=true;input.clear();audio.start();if(!foot.active)snapCamera();
    toast(!storageAvailable?'Storage unavailable · this ride cannot be saved.':foot.active?'WASD to walk · Shift to run · F to enter an available vehicle.':progress.phase==='dropoff'?'Welcome back. Your passenger is still aboard.':activeVehicle.kind==='van'?'Van ready · explore the mapped roads.':activeVehicle.kind!=='auto'&&!activeVehicle.taxiAvailable?'Car ready · enable taxi requests to accept a fare.':'Stop at the gold ring and press E to pick up your passenger.');
    save();element('game').focus();
  }
  element('start-button').addEventListener('click',beginDriving);
  element('continue-button').addEventListener('click',()=>{if(savedRideAvailable)beginDriving();});
  element('drive-auto').addEventListener('click',beginDriving);
  element('resume-button').addEventListener('click',()=>{if(paused)pause();element('game').focus();});
  element('menu-button').addEventListener('click',()=>{
    save();input.clear();car.speed=0;started=false;paused=false;document.body.classList.remove('playing','paused');
    element('pause-screen').hidden=true;element('start-screen').hidden=false;element('start-button').focus();
  });
  let resumeAfterDialog=false;
  function openPanel(name:string){
    const dialog=element<HTMLDialogElement>(`${name}-dialog`);if(!dialog)return;
    resumeAfterDialog=started&&!paused;if(resumeAfterDialog)pause();input.clear();dialog.showModal();
  }
  document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(b=>b.addEventListener('click',()=>openPanel(b.dataset.panel!)));
  element('display-settings').addEventListener('click',()=>openPanel('settings'));
  function finishDialog(dialog:HTMLDialogElement){
    const resume=resumeAfterDialog;resumeAfterDialog=false;dialog.close();input.clear();
    if(resume&&started&&paused){pause();element('game').focus();}
  }
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>{
    dialog.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.addEventListener('click',()=>finishDialog(dialog)));
    dialog.addEventListener('cancel',e=>{e.preventDefault();finishDialog(dialog);});
    dialog.addEventListener('close',()=>{const resume=resumeAfterDialog;resumeAfterDialog=false;input.clear();if(resume&&started&&paused){pause();element('game').focus();}});
    dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))finishDialog(dialog);});
  });
  element('interact-button').addEventListener('click', interact);
  element('reset-button').addEventListener('click', () => { if (started && !paused) resetCar(); });
  element('pause-button').addEventListener('click', pause);
  element('sound-button').addEventListener('click', () => {
    audio.start(); audio.muted = !audio.muted;saveAudio();
    element('sound-button').textContent = audio.muted ? '♩' : '♫';
    element('sound-button').setAttribute('aria-label', audio.muted ? 'Turn sound on' : 'Mute sound');
    element('sound-button').title = audio.muted ? 'Sound off · tap to enable' : 'Sound on · tap to mute';
    element('sound-button').setAttribute('aria-pressed', String(audio.muted));element('settings-mute').textContent=audio.muted?'Enable audio':'Mute audio';
  });
  element('settings-mute').addEventListener('click',()=>element('sound-button').click());
  element('settings-mute').textContent=audio.muted?'Enable audio':'Mute audio';
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden && started) { save(); if (!paused) pause(); } });

  let cameraMode:'chase'|'driver'='chase';
  try{if(localStorage.getItem('en3d.camera.v1')==='driver')cameraMode='driver';}catch{/* Optional preference. */}
  const cameraSelect=element<HTMLSelectElement>('camera-select');cameraSelect.value=cameraMode;
  element('camera-button').setAttribute('aria-label',cameraMode==='chase'?'Switch to driver camera':'Switch to chase camera');
  function setCamera(mode:string){cameraMode=mode==='driver'?'driver':'chase';cameraSelect.value=cameraMode;
    element('camera-button').setAttribute('aria-label',cameraMode==='chase'?'Switch to driver camera':'Switch to chase camera');
    try{localStorage.setItem('en3d.camera.v1',cameraMode);}catch{/* Optional preference. */}if(!foot.active)snapCamera();
  }
  function switchCamera(){setCamera(cameraMode==='chase'?'driver':'chase');}
  cameraSelect.addEventListener('change',()=>setCamera(cameraSelect.value));element('camera-button').addEventListener('click',()=>{if(foot.active)foot.viewHeading+=Math.PI/4;else switchCamera();if(started&&!paused)element('game').focus();});
  let cameraColliderSource = world.colliders;
  let cameraObstacles = cameraColliderSource.map(b => new THREE.Box3(new THREE.Vector3(b.minX, 0, b.minZ), new THREE.Vector3(b.maxX, 17, b.maxZ)));
  const cameraRay = new THREE.Ray();
  const cameraHit = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const audioForward=new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const smoothedLook = new THREE.Vector3();
  function snapCamera(): void {
    camera.position.set(car.x+Math.sin(car.heading)*(cameraMode==='driver'?-.46:vehicleSpec().cameraBack),carHeight()+(cameraMode==='driver'?vehicleSpec().cameraHeight:4.4),car.z+Math.cos(car.heading)*(cameraMode==='driver'?-.46:vehicleSpec().cameraBack));
    smoothedLook.set(car.x-Math.sin(car.heading)*8,carHeight()+1.4,car.z-Math.cos(car.heading)*8);
    camera.lookAt(smoothedLook);camera.fov=foot.active?58:cameraMode==='driver'?68:window.innerWidth<600?62:56;camera.updateProjectionMatrix();
  }
  snapCamera();
  if(foot.active){camera.position.set(foot.pose.x+Math.sin(foot.viewHeading)*5.5,groundHeight(foot.pose.x,foot.pose.z)+3,foot.pose.z+Math.cos(foot.viewHeading)*5.5);smoothedLook.set(foot.pose.x,groundHeight(foot.pose.x,foot.pose.z)+1.1,foot.pose.z);camera.lookAt(smoothedLook);}
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = foot.active?58:cameraMode==='driver'?68:window.innerWidth<600?62:56;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize); resize();
  element('loading').hidden = true;
  element<HTMLButtonElement>('start-button').disabled = false;
  document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(b=>b.disabled=false);
  element<HTMLButtonElement>('continue-button').disabled=!savedRideAvailable;
  element('continue-status').textContent=savedRideAvailable?`₹${progress.money} · ${progress.trips} trips`:'No saved ride yet';

  const map = element<HTMLCanvasElement>('minimap');
  const ctx = map.getContext('2d')!;
  function minimap(): void {
    const actor=focus();
    const w = map.width, h = map.height;
    const scale = mapData ? Math.min(w / (mapData.bounds.maxX-mapData.bounds.minX+45), h / (mapData.bounds.maxZ-mapData.bounds.minZ+45)) : 0.91;
    const viewScale = isExport ? 0.42 : scale;
    const sx = (x: number) => w / 2 + (x - (isExport ? actor.x : 0)) * viewScale;
    const sz = (z: number) => h / 2 + (z - (isExport ? actor.z : 0)) * viewScale;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#20392f'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#365345';
    for (const box of world.colliders) ctx.fillRect(sx(box.minX), sz(box.minZ), (box.maxX - box.minX) * viewScale, (box.maxZ - box.minZ) * viewScale);
    if (mapData) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const road of mapData.roads) {
        ctx.strokeStyle = '#718271'; ctx.lineWidth = Math.max(1.2,road.width*viewScale);
        ctx.beginPath(); road.points.forEach((p,i)=> i ? ctx.lineTo(sx(p.x),sz(p.z)) : ctx.moveTo(sx(p.x),sz(p.z))); ctx.stroke();
      }
      if (navRoute.available&&navRoute.points.length) {
        ctx.strokeStyle = progress.phase==='pickup'?'#e1c476':'#89d5bb'; ctx.lineWidth = 3.8; ctx.beginPath();
        navRoute.points.forEach((p,i)=> i ? ctx.lineTo(sx(p.x),sz(p.z)) : ctx.moveTo(sx(p.x),sz(p.z))); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = '#f9f6e8'; ctx.lineWidth = 16; ctx.lineJoin = 'round';
      ctx.strokeRect(sx(-72),sz(-62),144*scale,124*scale);
      ctx.strokeStyle = '#b7bba7'; ctx.lineWidth = 1; ctx.setLineDash([3,4]);
      ctx.strokeRect(sx(-72),sz(-62),144*scale,124*scale); ctx.setLineDash([]);
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#75816a'; ctx.fillText('KOTTAKKAL',w/2,h/2-3);
      ctx.font = '9px sans-serif'; ctx.fillText('PRACTICE LOOP',w/2,h/2+11);
    }
    if(mapData){
      const kinds:Record<string,string>={hospital:'H',school:'S',college:'S',bus_station:'B',bus_stop:'B',taxi:'T',place_of_worship:'W',marketplace:'M',shop:'•'};
      const pois=mapData.landmarks.filter(p=>kinds[p.kind]&&Math.hypot(p.x-actor.x,p.z-actor.z)<260).sort((a,b)=>Math.hypot(a.x-actor.x,a.z-actor.z)-Math.hypot(b.x-actor.x,b.z-actor.z)).slice(0,8);
      for(const poi of pois){const x=sx(poi.x),z=sz(poi.z);if(x<9||x>w-10||z<12||z>h-12)continue;ctx.fillStyle='#b9ceb8';ctx.font='bold 9px sans-serif';ctx.fillText(kinds[poi.kind],x,z);}
    }
    if (tea) {ctx.fillStyle = '#c97645'; ctx.beginPath(); ctx.arc(sx(tea.x),sz(tea.z),4,0,Math.PI*2);ctx.fill();}
    for(const [point,label,color] of [[pickup,'P','#c08433'],[dropoff,'D','#148e7c']] as const){const x=Math.max(10,Math.min(w-18,sx(point.x))),z=Math.max(16,Math.min(h-12,sz(point.z)));ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,z,5,0,Math.PI*2);ctx.fill();ctx.font='bold 11px sans-serif';ctx.fillText(label,x+7,z-5);}
    ctx.beginPath(); ctx.arc(Math.max(10,Math.min(w-18,sx(target().x))), Math.max(16,Math.min(h-12,sz(target().z))), 6, 0, Math.PI * 2);
    ctx.fillStyle = progress.phase === 'pickup' ? '#e9a52b' : '#198c7c'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    if(foot.active){ctx.fillStyle='#d5c58b';const x=Math.max(10,Math.min(w-25,sx(car.x))),z=Math.max(15,Math.min(h-10,sz(car.z)));ctx.fillRect(x-4,z-4,8,8);ctx.font='bold 9px sans-serif';ctx.fillText(activeVehicle.kind.toUpperCase(),x+6,z-5);}
    ctx.save(); ctx.translate(sx(actor.x), sz(actor.z)); ctx.rotate(-actor.heading);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fillStyle = '#eef4de'; ctx.fill(); ctx.strokeStyle = '#142b22'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    ctx.fillStyle='#d0dfbd';ctx.font='9px sans-serif';
    for(const place of streamed?.manifest.places ?? []){const x=sx(place.x),z=sz(place.z);if(x>12&&x<w-40&&z>35&&z<h-15)ctx.fillText(place.nameMl ? `${place.name} · ${place.nameMl}` : place.name,x,z);}
    ctx.fillStyle = '#d0dfbd'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('N ↑', w - 20, 20);
  }
  function updateHud(): void {
    const actor=focus();updateNavigation();
    if(mapData&&mapData.roads!==waitingPassengerRoads&&Math.hypot(car.x-pickup.x,car.z-pickup.z)<250){placeWaitingPassenger();waitingPassengerRoads=mapData.roads;}
    element('traffic-status').textContent=traffic?.status??'Traffic unavailable';
    element('money').textContent = `₹${progress.money.toLocaleString('en-IN')}`;
    element('trips').textContent = String(progress.trips);
    element('speed').textContent = String(Math.round(Math.abs(actor.speed) * 3.6));
    element('drive-gear').textContent=foot.active?'—':Math.abs(car.speed)<.15?'N':car.speed<0?'R':'D';
    element('vehicle-status').textContent=foot.active?(foot.transition?'Changing mode':foot.pose.speed>2?'Running':foot.pose.speed>.1?'Walking':'On foot'):Math.abs(car.speed)<.15?'Stationary':input.controls.handbrake?'Handbrake':input.controls.brake&&car.speed>0?'Braking':car.speed<0?'Reversing':'Driving';
    const modeChanged=document.body.classList.contains('on-foot')!==foot.active;document.body.classList.toggle('on-foot',foot.active);
    if(modeChanged)document.querySelector('.desktop-controls')!.innerHTML=foot.active?'<span><kbd>WASD</kbd> Walk</span><span><kbd>Shift</kbd> Run</span><span><kbd>F</kbd> Enter vehicle</span><span><kbd>C</kbd> View</span>':drivingHints;
    if(modeChanged){element('start-button').firstChild!.textContent=foot.active?'CONTINUE ON FOOT ':'START DRIVING ';element('drive-auto').firstChild!.textContent=foot.active?'CONTINUE ON FOOT ':'DRIVE THIS AUTO ';document.querySelector('.vehicle-badge')!.textContent=foot.active?'PARKED · YOUR AUTO':'READY TO DRIVE';}
    element('vehicles-title').textContent=VEHICLES[activeVehicle.kind].name;
    document.querySelector('.vehicle-card h3')!.textContent=VEHICLES[activeVehicle.kind].name;document.querySelector('.vehicle-card p')!.textContent=activeVehicle.kind==='auto'?'Black-and-yellow passenger auto. Passenger fares and roadside tea stops.':activeVehicle.kind==='van'?'Local-style van. Free driving in the same mapped world.':'Four-wheel driving. Enable taxi requests in the HUD to accept a passenger fare.';
    const details=document.querySelectorAll('.vehicle-card dd');details[0].textContent=activeVehicle.kind==='auto'?'Three wheels':'Four wheels';details[1].textContent=activeVehicle.kind==='van'?'Free driving':activeVehicle.kind==='auto'?'Passenger fares':'Optional taxi fares';if(!foot.active)element('drive-auto').firstChild!.textContent=activeVehicle.kind==='auto'?'DRIVE THIS AUTO ':'CONTINUE DRIVING ';
    element('game').setAttribute('aria-label','3D driving and walking game. WASD to move, F to enter or exit, C for camera.');element('reset-button').setAttribute('aria-label','Recover active vehicle to the road');
    element('vehicle-label').textContent=foot.active?'ON FOOT':VEHICLES[activeVehicle.kind].name.toUpperCase();
    element('camera-button').setAttribute('aria-label',foot.active?'Rotate walking camera':cameraMode==='chase'?'Switch to driver camera':'Switch to chase camera');
    const candidate=nearestVehicle(),autoDistance=candidate?Math.hypot(foot.pose.x-candidate.state.x,foot.pose.z-candidate.state.z):Infinity;
    taxiButton.hidden=foot.active||!vehicleSpec().taxiEligible;taxiButton.textContent=`Taxi requests: ${activeVehicle.taxiAvailable?'ON':'OFF'}`;taxiButton.disabled=paused||progress.phase==='dropoff';
    entryPrompt.hidden=true;
    if(foot.mode==='walking'&&candidate&&autoDistance<12){const p=new THREE.Vector3(candidate.state.x,groundHeight(candidate.state.x,candidate.state.z)+VEHICLES[candidate.kind].height+.4,candidate.state.z).project(camera);if(p.z>0&&p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.9){entryPrompt.hidden=false;entryPrompt.style.left=`${(p.x+1)*50}%`;entryPrompt.style.top=`${(1-p.y)*50}%`;entryPrompt.textContent=`${autoDistance<=3.2?'F · Enter':'Walk closer ·'} ${VEHICLES[candidate.kind].name} · ${Math.round(autoDistance)} m`;}}

    element('vehicle-action').textContent=foot.transition?'Please wait…':foot.active?`F · ${VEHICLES[candidate?.kind??activeVehicle.kind].name} · ${Math.round(autoDistance)} m`:`Exit ${VEHICLES[activeVehicle.kind].name} · F`;
    element<HTMLButtonElement>('vehicle-action').disabled=foot.transition||paused||(foot.active?autoDistance>3.2:Math.abs(car.speed)>.2);
    const runButton=document.querySelector<HTMLButtonElement>('[data-control=handbrake]')!;runButton.textContent=foot.active?'RUN':'P';runButton.setAttribute('aria-label',foot.active?'Run while held':'Handbrake');
    document.querySelector<HTMLButtonElement>('[data-control=horn]')!.disabled=foot.active;
    element('touch-throttle-label').textContent=foot.active?'WALK':'GO';element('touch-brake-label').textContent=foot.active?'BACK':'BRAKE / REV';
    const pickingUp = progress.phase === 'pickup';
    element('mission-title').textContent = foot.active?'Walk to an available vehicle': activeVehicle.kind==='van'?'Van · free driving':activeVehicle.kind!=='auto'&&pickingUp?(activeVehicle.taxiAvailable?'Car taxi request':'Car · free driving'): isExport ? pickingUp ? 'Passenger fare' : 'Passenger aboard' : isReal ? pickingUp ? 'Kottakkal road fare' : 'Passenger aboard' : pickingUp ? 'A ride to the market' : 'Next stop: market';
    element('mission-description').textContent =foot.active?`F to enter a stopped vehicle${progress.phase==='dropoff'?' · return to your passenger vehicle first':''} · Shift / RUN to run`:activeVehicle.kind==='van'?'Van: exploration and free driving. Passenger service is unavailable.':activeVehicle.kind!=='auto'&&pickingUp&&!activeVehicle.taxiAvailable?'Enable taxi availability below to accept this mapped pickup request.': realWorld ? pickingUp ? `Stop at ${realWorld.mission.pickupName}.` : `Follow the map route to ${realWorld.mission.dropoffName}.` : pickingUp ? 'A passenger is waiting outside the bakery. Pull into the gold circle.' : 'Passenger aboard. Follow the loop to the market bus stand and stop in the teal circle.';
    element('stream-status').hidden = !streamed;
    if(streamed) {const status=streamed.world.streaming;element('stream-status').textContent=status.error || `${status.resident}/${status.total} road tiles${status.loading ? ' · loading nearby…' : ' · nearby only'}`;}
    element('mission-distance').textContent = `${Math.round(distance())} m away`;
    element('mission-reward').textContent = foot.active?'AVAILABLE VEHICLES':activeVehicle.kind==='van'?'FREE DRIVE':`₹${FARE} game fare`;
    element('location-label').textContent = car.z < -40 ? 'Market Road' : car.x < -45 ? 'Chaya Corner' : car.z > 40 ? 'Palm Avenue' : 'Bakery Road';
    if (mapData) {
      const nearest = nearestRoad(mapData.roads,actor);
      const nearbyPlace=streamed?.manifest.places?.filter(p=>Math.hypot(p.x-actor.x,p.z-actor.z)<1200).sort((a,b)=>Math.hypot(a.x-actor.x,a.z-actor.z)-Math.hypot(b.x-actor.x,b.z-actor.z))[0];
      element('location-label').textContent = nearbyPlace ? `${nearbyPlace.name}${nearbyPlace.nameMl ? ` · ${nearbyPlace.nameMl}` : ''}` : nearest?.road.name || nearest?.road.highway || SIMULATOR_SUBTITLE;
      element('road-rules').textContent = nearest ? `${nearest.road.oneway !== 'no' ? 'One-way · ' : ''}${nearest.road.maxspeed === null ? 'limit unmapped' : `${nearest.road.maxspeed} km/h OSM`}` : 'Road data unavailable';
    }
    element('menu-location').textContent=element('location-label').textContent;
    const nearby = distance() <= 8;
    const nearTea = teaDistance() <= 9;
    element('tea-panel').hidden = foot.active||teaDistance() > 21;
    element('tea-count').textContent = `${progress.teaBreaks} tea break${progress.teaBreaks === 1 ? '' : 's'} enjoyed`;
    element<HTMLButtonElement>('tea-button').disabled = foot.active||!nearTea || Math.abs(car.speed) >= 2 || paused;
    teaRing.visible = teaDistance() < 35;
    element('interact-button').querySelector('span')!.textContent =foot.active?'Enter vehicle': nearby ? Math.abs(car.speed) >= 2 ? 'Stop first' : pickingUp ? 'Pick up' : 'Drop off' : nearTea ? Math.abs(car.speed) >= 2 ? 'Stop first' : 'Have chai' : 'Interact';
    element<HTMLButtonElement>('interact-button').disabled = foot.active?(autoDistance>3.2||foot.transition||paused):(!nearby && !nearTea) || Math.abs(car.speed) >= 2 || paused;
    element('interact-button').classList.toggle('ready', (nearby || nearTea) && Math.abs(car.speed) < 2);
    document.body.classList.toggle('has-passenger', !pickingUp);
    pickupMarker.visible = started&&pickingUp&&(activeVehicle.kind==='auto'||activeVehicle.taxiAvailable); dropoffMarker.visible = started&&!pickingUp; passenger.visible = !pickingUp; waitingPassenger.visible = pickingUp&&waitingPassengerValid;
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,graphics.lowDetail ? .85 : graphics.mode==='medium'?1.1:1.5));
    const shadowSize=graphics.mode==='medium'?512:1024;
    if(sun.shadow.mapSize.x!==shadowSize){sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;}
    renderer.shadowMap.enabled = !graphics.lowDetail;
    landscape.setLowDetail(graphics.lowDetail);
    element('render-status').textContent = graphics.mode === 'low' ? 'Low · battery saver' : graphics.lowDetail ? 'Auto · reduced detail' : graphics.mode==='medium'?'Medium · balanced shadows':graphics.mode==='high'?'High · full detail':'Auto · standard';
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
  });
  applyGraphics();
  renderer.setAnimationLoop((now: number) => {
    const realDt = last === undefined ? 0 : Math.max(0, (now - last) / 1000);
    const dt = Math.min(realDt, 0.1); last = now;
    if (graphics.observeFrame(realDt)) applyGraphics();
    elapsed += dt;
    traffic?.setParkedVehicles(parkedVehicles().map(vehicleBox));
    traffic?.update(dt,{...focus(),width:foot.active?.7:vehicleSpec().width,length:foot.active?.7:vehicleSpec().length},graphics.lowDetail,!paused);
    if (started && !paused) {
      const previousMode=foot.mode;const controls=input.controls;
      foot.update(dt,{forward:controls.throttle,back:controls.brake,left:controls.left,right:controls.right,run:input.running});
      if(previousMode!==foot.mode){input.clear();if(!foot.transition)rickshaw.setDoor(false);syncFootSave();syncFleetSave();save();}
      const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
      for (let n = 0; n < steps&&!foot.active; n++) {
        const oldX=car.x,oldZ=car.z;
        footObstacles.update(mapData?.buildings??[]);
        const vehicleSurface={...surface,heightAt:groundHeight,isBlocked:(x:number,z:number)=>surface.isBlocked(x,z)||footObstacles.blocked({x,z,heading:car.heading},vehicleSpec())};
        const hit = advanceCar(car, input.controls, dt / steps, world.colliders, vehicleSurface,vehicleSpec());
        if(traffic?.blocksPlayer(car.x,car.z,car.heading,vehicleSpec().width,vehicleSpec().length)||vehicleBlocks(car,vehicleSpec().width,vehicleSpec().length,activeVehicle)){car.x=oldX;car.z=oldZ;car.speed=0;if(elapsed-lastToast>3){toast('Traffic ahead · wait for a clear gap or use Display to clear nearby traffic.');lastToast=elapsed;}}
        if (hit && elapsed - lastToast > 3) { toast('Easy there! Use R to get back on the road.'); lastToast = elapsed; }
      }
      if (elapsed - lastSave > 2) { syncFootSave();syncFleetSave();save(); lastSave = elapsed; }
    }
    const actor=focus();syncFootSave();syncFleetSave();
    for(const v of fleet){const model=models.get(v.id)!;model.setOccupied(v===activeVehicle&&!foot.active);if(v!==activeVehicle){model.group.position.set(v.state.x,groundHeight(v.state.x,v.state.z)+.08,v.state.z);model.group.rotation.y=v.state.heading;model.group.visible=Math.hypot(v.state.x-actor.x,v.state.z-actor.z)<300;model.animate(0,0,elapsed);}}
    rickshaw.group.visible=true;passenger.position.y=activeVehicle.kind==='auto'?0:-.4;passenger.position.z=activeVehicle.kind==='auto'?0:-.15;character.group.visible=foot.active;
    character.group.position.set(foot.pose.x,groundHeight(foot.pose.x,foot.pose.z),foot.pose.z);character.group.rotation.y=foot.pose.heading;character.update(paused?0:dt,foot.transition?1.4:foot.pose.speed);
    rickshaw.group.position.set(car.x, carHeight()+0.08, car.z);
    rickshaw.group.rotation.order='YXZ';rickshaw.group.rotation.y=car.heading;
    const dx=-Math.sin(car.heading),dz=-Math.cos(car.heading);
    const pitch=Math.atan2(groundHeight(car.x+dx,car.z+dz)-groundHeight(car.x-dx,car.z-dz),2);
    const rx=Math.cos(car.heading),rz=-Math.sin(car.heading);
    const roll=Math.atan2(groundHeight(car.x+rx,car.z+rz)-groundHeight(car.x-rx,car.z-rz),2);
    rickshaw.group.rotation.x+=(pitch-rickshaw.group.rotation.x)*(1-Math.exp(-dt*8));
    rickshaw.group.rotation.z+=(roll-rickshaw.group.rotation.z)*(1-Math.exp(-dt*8));
    rickshaw.animate(paused ? 0 : car.speed, car.steering, elapsed,!foot.active&&(input.controls.brake||input.controls.handbrake));
    if (realWorld) realWorld.update(elapsed, camera.position, graphics.lowDetail); else world.update(elapsed, camera.position);
    landscape.update(camera.position);
    sun.position.set(actor.x-45,groundHeight(actor.x,actor.z)+70,actor.z+25);
    sun.target.position.set(actor.x,groundHeight(actor.x,actor.z),actor.z);
    // Keep the nearby road view clear; the ground ring and passenger still mark the stop.
    pickupMarker.children[2].visible=Math.hypot(car.x-pickup.x,car.z-pickup.z)>12;
    dropoffMarker.children[2].visible=Math.hypot(car.x-dropoff.x,car.z-dropoff.z)>12;
    pickupMarker.children[2].position.y = dropoffMarker.children[2].position.y = 5 + Math.sin(elapsed * 2) * 0.3;
    desiredCamera.set(car.x+Math.sin(car.heading)*(vehicleSpec().cameraBack+Math.abs(car.speed)*.06),carHeight()+4.4+Math.abs(car.speed)*.025,car.z+Math.cos(car.heading)*(vehicleSpec().cameraBack+Math.abs(car.speed)*.06));
    cameraRay.origin.set(car.x, carHeight()+1.5, car.z);
    cameraRay.direction.copy(desiredCamera).sub(cameraRay.origin).normalize();
    let cameraDistance = cameraRay.origin.distanceTo(desiredCamera);
    if(cameraColliderSource!==world.colliders){cameraColliderSource=world.colliders;cameraObstacles=cameraColliderSource.map(b=>new THREE.Box3(new THREE.Vector3(b.minX,0,b.minZ),new THREE.Vector3(b.maxX,17,b.maxZ)));}
    for (const box of cameraObstacles) {
      if (cameraRay.intersectBox(box, cameraHit)) cameraDistance = Math.min(cameraDistance, Math.max(2.5, cameraRay.origin.distanceTo(cameraHit) - 0.6));
    }
    desiredCamera.copy(cameraRay.origin).addScaledVector(cameraRay.direction, cameraDistance);
    lookAt.set(car.x-Math.sin(car.heading)*7,carHeight()+1.4,car.z-Math.cos(car.heading)*7);
    if(cameraMode==='driver'){
      desiredCamera.set(car.x-Math.sin(car.heading)*.46,carHeight()+vehicleSpec().cameraHeight,car.z-Math.cos(car.heading)*.46);
      lookAt.set(car.x-Math.sin(car.heading)*20,carHeight()+vehicleSpec().cameraHeight-.1,car.z-Math.cos(car.heading)*20);
    }
    if(foot.active){
      const origin=new THREE.Vector3(actor.x,groundHeight(actor.x,actor.z)+1.3,actor.z);
      const parkedViews=fleet.filter(v=>Math.hypot(v.state.x-actor.x,v.state.z-actor.z)<12).map(v=>{const s=VEHICLES[v.kind];return {inverse:new THREE.Matrix4().makeRotationY(v.state.heading).setPosition(v.state.x,groundHeight(v.state.x,v.state.z),v.state.z).invert(),box:new THREE.Box3(new THREE.Vector3(-s.width/2-.1,0,-s.length/2-.1),new THREE.Vector3(s.width/2+.1,s.height,s.length/2+.1))};});
      const clearView=(yaw:number)=>{
        const desired=new THREE.Vector3(actor.x+Math.sin(yaw)*5.5,groundHeight(actor.x,actor.z)+3,actor.z+Math.cos(yaw)*5.5);
        const ray=new THREE.Ray(origin,desired.clone().sub(origin).normalize());let distance=origin.distanceTo(desired);
        for(const box of cameraObstacles)if(ray.intersectBox(box,cameraHit))distance=Math.min(distance,Math.max(.8,origin.distanceTo(cameraHit)-.4));
        if(foot.mode==='walking')for(const parked of parkedViews){const local=ray.clone().applyMatrix4(parked.inverse),hit=local.intersectBox(parked.box,new THREE.Vector3());if(hit)distance=Math.min(distance,Math.max(.8,local.origin.distanceTo(hit)-.35));}
        return {distance,position:origin.clone().addScaledVector(ray.direction,distance)};
      };
      let view=clearView(foot.viewHeading);
      if(view.distance<3.5&&foot.mode==='walking')for(const turn of [Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI]){const candidate=clearView(foot.viewHeading+turn);if(candidate.distance>4){foot.viewHeading+=turn;view=candidate;break;}}
      desiredCamera.copy(view.position);lookAt.set(actor.x,groundHeight(actor.x,actor.z)+1.1,actor.z);
    }
    if(!started){
      const orbit=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.sin(elapsed*.08)*.12;
      const angle=actor.heading+orbit;
      desiredCamera.set(actor.x+Math.sin(angle)*8+Math.cos(angle)*7,groundHeight(actor.x,actor.z)+3.6,actor.z+Math.cos(angle)*8-Math.sin(angle)*7);
      lookAt.set(actor.x-Math.cos(actor.heading)*3-Math.sin(actor.heading)*2,groundHeight(actor.x,actor.z)+1.3,actor.z+Math.sin(actor.heading)*3-Math.cos(actor.heading)*2);
    }
    const targetFov=started?(foot.active?58:cameraMode==='driver'?68:(window.innerWidth<600?62:56)+Math.min(4,Math.abs(car.speed)*.2)):50;
    if(Math.abs(camera.fov-targetFov)>.02){camera.fov+=(targetFov-camera.fov)*(1-Math.exp(-dt*4));camera.updateProjectionMatrix();}
    camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 5));
    smoothedLook.lerp(lookAt, 1 - Math.exp(-dt * 8)); camera.lookAt(smoothedLook);
    audio.update(car.speed, started && !paused&&!foot.active,vehicleSpec().engine);
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
