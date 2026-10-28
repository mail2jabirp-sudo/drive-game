# Playable vehicle switching and taxi increment

Branding remains EN 3D — എന്റെ നാട് / Kerala Open World Simulator. One existing geographic world; no new map data, map selection or billboards.

## Playable loop

- Four owned, available vehicles: existing black/yellow passenger auto, beige compact hatchback, cream sedan taxi and pale-blue Kerala-style van. The three additions are original MIT procedural approximations, not manufacturer-accurate licensed replicas. The auto model is reused unchanged.
- Stop completely (below 0.2 m/s) and press **F** or the vehicle HUD button to exit. WASD/arrow keys walk, Shift or touch RUN runs. Walk within 3.2 m of an available vehicle, then F (or E/touch interaction) to enter. Near-vehicle screen prompts name the target. Moving vehicles and AI-occupied traffic are unavailable.
- The car and van front doors pivot on the approached side during the existing half-second entry/exit transition. The auto has open sides. These are simple animations, not cinematic seating or skeletal door interactions.
- Acceleration/braking/speed/steering/wheelbase differ per vehicle. Four wheel steering/rotation, brake lights, visible driver occupancy and distinct engine pitch/horn profiles are present. Audio is explicitly synthesized Web Audio under the application's MIT licence; there are no authentic recordings or new audio downloads. Browser gesture, volume/mute and bounded spatial AI audio are retained.
- **C** switches chase/driver cameras while driving; walking retains third-person camera. Driving camera distance and eye height depend on vehicle.
- Every parked vehicle has a separate pose; the character never drags parked cars to its position. Only four player fleet models are allocated, and distant parked models are hidden beyond 300 m. AI traffic remains capped by the existing settings.

## Taxi service and preservation

- Passenger auto retains its existing passenger mission by default. Hatchback starts in personal/free-driving mode; sedan starts available for taxi requests. Toggle **Taxi requests: ON/OFF** on the car HUD. Van is free-driving only.
- Available car requests reuse the existing verified source-road pickup and destination, waiting passenger, route/highlight, E pickup/drop-off and wallet payout. HUD distinguishes car taxi requests from auto fares. Requests repeat the existing route; this is not a city-wide dispatch service.
- An onboard passenger binds entry to that fare's vehicle until delivery. Exit/walk/re-enter remains allowed; another car cannot take or remotely complete that passenger's fare. Availability cannot be disabled during a trip.
- The existing **₹120 flat game fare** remains; it is not an official Kerala fare. No meter or official tariff is claimed.
- The optional, validated `fleet` field is written atomically in the existing progress key alongside wallet, old map poses, active ride and optional walking state. It stores stable vehicle IDs, independent parked poses, active ID and taxi availability. Restored speeds are zero. Older saves initialize a fleet without discarding money, passengers or archived map poses. Older game builds can ignore the extra field and resume the active ride.

## Geographic placement and collision scope

Initial additional vehicles are deterministically placed on resident verified OSM road segments, in the legal source direction, on the left lane of two-way roads. Their full rectangles are checked against pavement samples, exact building polygons, blocked terrain/water and the other fleet vehicles. Shared OSM node connectivity supplies junction clearance even when streamed intersection metadata is absent. The first 45 m of the starting auto’s departure corridor is kept clear. Unsuitable narrow roads and motorway/trunk segments are excluded; no fictional parking polygons or real-world ownership/parking legality is claimed. These are game placements on real pavement.

At a fresh Kottakkal start the hatchback is approximately 13.0 m away, taxi 12.8 m and van 22.6 m. The existing source-road graph, junctions, terrain capability, 9-tile streaming budget and ODbL attribution are retained. Coverage stays the previous partial 36 km source window, not the entire district. There is no new elevation data.

Walking collides with all fleet rectangles, existing source buildings/water/loaded bounds and AI traffic. AI avoids parked fleet vehicles; moving player vehicle dimensions are supplied to traffic avoidance/collision. Driving uses the active vehicle's full rectangle for building and parked/AI collisions. Existing limitations in scenery collision, accident physics and pedestrian AI still apply.

## Verification and evidence

Commands: `npm test`, `npm run build`, `npm run test:browser`, `npm run test:production`.

Fleet browser tests exercise collision-tested walking-controller movement from auto to hatchback, F transitions, actual throttle/brake/C controls, moving exit rejection, car-door closure, separate parked poses and reload. Taxi tests cover availability, pickup, passenger binding, valid destination payout and driving the van. Source-world positioning helpers set up pickup/drop-off and the return approach; they do not claim an autonomous full-route driving test. Production tests additionally execute car F-entry/driving/exit and reload against the compiled build with a validated source-coordinate save and no production debug hooks.

Final verification: **70 unit tests, all 31 browser regression tests and all 7 compiled-production tests passed**, plus TypeScript/Vite production build and every source-map checksum guard. Production checks fetch all published assets and compare bytes to `dist`; compiled car entry/driving/exit/reload has no debug hooks. Nonfatal Vite >500 kB bundle advisory remains (approximately 665 kB JS / 187 kB gzip).

Actual browser screenshots: [hatchback](evidence/vehicle-switching/hatchback.png), [taxi after fare delivery](evidence/vehicle-switching/taxi.png). [Machine-readable results and expected asset hashes](evidence/vehicle-switching/verification.json). A fresh low-detail sample rendered 88 calls / 15,888 triangles; on-foot sample 92 calls / 15,066 triangles, with at most 9 resident tiles. These use local software WebGL; they are not laptop/mobile hardware FPS claims.

The production URL is **https://drive-game-beta.vercel.app/**. This environment rejects its HTTPS CONNECT tunnel with **403 Forbidden**, so live HTML/bundle contents and gameplay cannot be verified here. GitHub/Vercel deployment status is checked separately; a completed deployment is not claimed as a successful live browser test. The expected built asset hashes are recorded above.

## Remaining work

Higher fidelity bodywork/interiors, detailed seating/passenger boarding animations, additional dispatch routes, configurable per-kilometre fares, monetary traffic fines, marked legal parking source data and full district expansion remain future milestones. Nearby AI models remain separate occupied traffic, not stealable or switchable player cars. Real DEM/elevation integration remains as documented in the previous milestone. No billboard designs were introduced.
