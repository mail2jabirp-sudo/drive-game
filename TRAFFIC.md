# Bounded traffic prototype

Official branding remains **EN 3D — എന്റെ നാട്** / **Kerala Open World Simulator**. This increment uses the same existing streamed geographic world and adds no road coverage, map selector or replacement save format.

## Working vehicle types

Eight original procedural traffic prototypes are implemented: commuter motorcycle, scooter, compact hatchback, passenger autorickshaw, yellow three-wheeler goods pickup, passenger/light-commercial van, red-and-cream KSRTC-style Fast Passenger bus, and medium cargo lorry. Each has category dimensions, speed, acceleration/braking, wheelbase, steering response, rotating wheels, front steering, brake/indicator/headlamp visuals and small authored body vibration. Two nearby non-shadowed headlight cones are pooled for night-time traffic. Bus boards use original canvas-rendered text; no operator logos or photographs are used.

The beige hatchback reuses the unchanged `src/car-model.ts` from the earlier vehicle-foundation draft. The existing player autorickshaw source model and driving constants remain unchanged. Yellow goods-auto and red/cream bus styling follows the written requests; missing reference photographs have not been inspected or claimed matched. Models are optimized low-poly approximations, not photorealistic manufacturer assets. The previous playable-car/selection draft remains preserved separately; this release adds AI traffic and keeps the current main-branch player auto, fares and controls.

Sedans/SUVs, mini trucks, separate delivery/container/tipper variants and private-bus variants are future models. Cargo missions, bus ticket/stop gameplay and additional playable vehicles are not introduced by this traffic increment.

## Routing and interactions

- The simulation uses only source-node connections and currently loaded source-road geometry. Geometric crossings with different node IDs are not joined. One-way and reverse-one-way tags constrain directed edges.
- Two-way roads use left-side lane offsets; narrow/one-way segments use a shared/centre path. Lane coordinates match at ordinary source-way boundaries, which are not treated as intersections. Real graph junctions use bounded reservations and yield to approaching higher-class roads and the player.
- Size restrictions exclude oversized vehicles from narrow roads. Buses/lorries require major roads at least6.4m wide in the existing derived geometry and reject unsuitable turns. These widths may be source estimates, not certified real-road access. Full pose/corner/path samples and an indexed exact-footprint test reject pavement departures and building intersections.
- Spawn points are48–215m away, on suitable source roads, outside junction envelopes and separated from other vehicles/player. Missing suitable categories are preferred before road/context/hour weights supply extra traffic. Building availability supplies a limited town-context hint; traffic counts are game heuristics, not surveyed density. Kerala local hour influences extra-traffic weights and headlamps; scenery day/night lighting is unchanged.
- Lightweight20Hz deterministic updates provide acceleration/braking, safe following, turn-speed limits and vehicle-dependent yaw limits. Following and reservation rules are a prototype, not complete Indian traffic-law simulation, lane changing or overtaking AI.
- Player/AI footprints stop contact without changing wallet/fare state. AI yields to the nearby player. Distant vehicles beyond265m are recycled. Vehicles stationary from a non-signal obstruction for25seconds are removed as a recovery valve; this may be visible and is not a full jam-resolution system. Display → Clear nearby traffic provides a safe manual escape without resetting the ride or mission.

## Mapped signals and crossings

`npm run map:traffic` extracts48control nodes (9traffic signals,39crossings) from unchanged `export.osm`, using the existing geographic projection and bounds. `traffic-controls.json` retains source IDs/tags and SHA-256; prebuild verifies exact reproduction. Only controls whose node IDs occur in the loaded drivable graph affect traffic. Their geographic points are not invented. Rendered curb offsets, head arrangements, stripe widths and phases are authored approximations.

AI stops before its game red/amber phase and resumes on green; a final stop-line limit prevents late-detection overshoot. The32second alternating axis-based phase is not surveyed wiring, direction assignment or real-time timing. Crossings cause cautious approach speeds; pedestrian NPCs and occupied-crossing detection are not yet implemented. No player red-light/one-way fine system existed in main; none is falsely claimed here. Existing source direction/speed display, missions and wallet remain intact.

If metadata cannot be loaded/validated, AI disables with a settings status and the original driving game remains playable. It does not run traffic while silently ignoring missing controls.

## Rendering, audio and settings

Low/Medium/High caps are6/12/18 active vehicles. Battery Saver imposes a6vehicle cap while retaining the selected density preference. These preferences use `en3d.traffic.v1`; existing gameplay saves are untouched. Only currently loaded road chunks feed the simulator.

Per-type body/LOD geometries and materials are built once, then fixed instanced pools update transforms, wheel rotations and lamp colours. Distant vehicles use simpler geometry at90m in Battery Saver or135m otherwise. No per-vehicle mesh/texture allocation occurs while spawning; no full district/fleet preload. Geometry is bounded by the active count, with no traffic shadow maps. Long-session/device profiling and smoother interpolation are further acceptance work;20Hz motion and recovery despawns remain prototype limitations.

All engine, horn, braking/air-hiss and success sounds are **original MIT Web Audio synthesis**, explicitly substitutes rather than authentic recordings. There are distinct category frequency/filter/horn profiles and speed-based RPM/gear proxies. Four reusable HRTF/inverse-distance engine voices service the nearest vehicles within75m, with smoothed pitch/volume, bounded radial Doppler shifts and up to4short AI effects. The player retains its original synthesized character; short player effects are capped at6. A reusable noise buffer supplies heavy-vehicle brake hiss. Audio starts after user interaction, respects pause/mute, and shares a persistent volume control. Audio diagnostics/browser RMS checks establish signal production, not acoustic authenticity or listening quality on real hardware.

## Validation and remaining gates

Unit tests cover deterministic separation, lanes/directions/connectivity, red/green movement, player/following collision, size filtering, recovery, exact building polygons, lane continuity, source-control reproduction and all eight model/wheel shapes. A real-source-window test exercises town streets and the verified Malappuram Bypass origin, seeing all eight types without inventing roads. Browser checks cover moving/rendered vehicles, visible bus/lorry geometry, density/caps, actual audio output/mute, player stops and metadata failure. Production tests exercise the compiled traffic on every supported URL while retaining exact branding and no map selector.

Headless render samples are draw/triangle budgets, not real laptop/phone FPS. More detailed models, formal intersection/signal-direction validation, lane changing, turn-path refinement, pedestrians, traffic fines and additional road-user categories remain future source-backed increments. Real elevation and district-wide environment coverage remain outside this change.
