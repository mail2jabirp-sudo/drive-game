# Interactive world milestone: walking and returning to the autorickshaw

This is a working character/vehicle foundation, not a claim that all requested simulator systems are complete. Branding remains **EN 3D — എന്റെ നാട് · Kerala Open World Simulator**. The existing unified source-road world, vehicles, passenger missions, wallet, driving physics and geographic assets are preserved.

## Implemented controls and state

- **F** exits the owned autorickshaw only after stopping below 0.2 m/s. Candidate exits are checked against the loaded map, source building polygons, water, traffic and vehicle body; blocked exits are rejected. Entry/exit position blends last half a second and lock movement until finished. These are original procedural prototype transitions, not motion-captured door/seat animations.
- **WASD/arrows** move the character relative to the walking view. **Shift** runs. Touch pedals become WALK/BACK, steering arrows strafe, and the auxiliary handbrake button becomes a held **RUN** control. Walking/running use 1.6/3.8 m/s; diagonal input is normalized and movement is subdivided for collision checks.
- **C** retains chase/driver switching while driving and rotates the third-person walking view on foot. Walking camera clearance tests buildings and the parked auto, selecting a clear angle when the vehicle would hide the character. Vehicle camera preferences remain available for the next drive.
- **F**, **E** or **Enter auto** re-enters only the owned stopped autorickshaw within 3.2 m and along a clear approach. Existing AI traffic is not enterable. The seated driver hides while the independently animated character is outside, then returns on entry. During play the car remains parked at its own coordinates; its engine/horn controls do not operate through walking inputs. It remains a collision obstacle for AI.
- The HUD shows on-foot movement/status, distance to the owned auto and appropriate controls. GPS targets the parked auto while walking. The map continues to show pickup/drop-off points and the auto's location, with capped POI symbols only for available source landmarks. A bright ground ring marks the actual source-road projection when road entry is needed, with measured distance and Malayalam guidance. No fictional road/path is drawn across the verge.
- Fare interactions require driving mode. An active passenger remains in the parked auto; walking to a destination cannot remotely finish the fare. Entry restores the same passenger/mission and earnings. Tea purchases also remain vehicle-bound.

The optional `onFoot` field is stored atomically in the existing version-1 save, alongside the parked `exportRide`, archived ride and practice pose. It contains a source-map hash and finite position/heading. Legacy saves start in their vehicle normally. Existing unsafe/off-road vehicle save recovery still applies; exact parking persistence is verified for valid road poses, not arbitrary off-road parking. Invalid or blocked walking states fall back to the safe parked vehicle without erasing the wallet/passenger. Reload first validates the parked vehicle in its source window, then loads/restores the walking window. A browser test covers restoring a different real tile window while the auto remains more than a local window away. Transition saves use the safe exit endpoint or parked vehicle rather than an intermediate position inside its body.

## Geographic data and billboards

No raw OSM file, road tile, footprint or geographic coordinate was replaced. The preceding verified 36 km road window and 203 starting-neighbourhood footprints remain partial coverage. Source-supported houses/shops/landmarks and water are reused; no district-wide roads, slopes, churches or other landmarks are invented.

No billboard/design asset was added. Auto-generated world-space name boards are disabled pending owner-provided designs. Their source POIs remain available to missions and map/HUD information. Standard GPS markers and map symbols are navigation UI, not advertising designs.

The documented elevation source was retried:

`https://elevation-tiles-prod.s3.amazonaws.com/skadi/N11/N11E076.hgt.gz`

Result: `<urlopen error Tunnel connection failed: 403 Forbidden>`. The tunnel/proxy rejected the request before DEM validation. No DEM was downloaded or used; terrain remains flat. Allowing the source host or supplying licensed georeferenced elevation is needed before a separate terrain milestone. Full-window terrain also needs coverage beyond this single HGT tile and validation of road/building/water heights. No exact slopes are fabricated.

## Browser evidence and checks

- [On foot beside the parked auto after camera rotation](evidence/on-foot/walking.png).
- [Touch walking and RUN controls](evidence/on-foot/mobile.png).
- [Off-road guidance and the verified road-entry marker](evidence/on-foot/road-entry.png).

Actual browser checks exercise movement and running, blocked car/building positions, moving-exit rejection, camera visibility, two-touch RUN, parked vehicle stability, on-foot save/reload/Continue, restoring a separate source tile window, source-road entry position/distance, fare prevention while walking, re-entry and subsequent successful passenger delivery. Existing source-junction/seam driving, GPS, traffic/collision/audio, mobile UI, earnings and legacy-save regressions remain.

Validation: 63 unit tests, 29 browser regressions, TypeScript/production build and six compiled-production checks. Local Chromium screenshots show the original procedural character in the actual game, not a mockup. A rotated on-foot view sampled about **102 draw calls / 15,300 triangles** with **nine resident tiles**. This is not hardware FPS profiling. No dependency or paid asset/audio recording was added; original character/code remain MIT and OSM attribution remains intact.

## Remaining milestones

1. Personal car/taxi roster and permitted vehicle switching with persistent owned/parked vehicle identities.
2. Passenger walk-up/boarding/alighting animations, taxi eligibility, distance-based metering and configurable sample game rates. The existing **₹120 flat game fare remains unchanged and is explicitly not the official Kerala tariff**. No fare-meter setting is claimed.
3. Source/scene-backed red-light, wrong-way, speeding and parking rules with sample in-game fines, cooldowns, Malayalam notices and a save-safe transaction ledger. Existing simulated signals/countdowns/warnings continue; monetary fines are not introduced by this milestone.
4. Legally usable DEM integration, broader verified footprints/POIs, terrain/road/bridge validation and more detailed assets. Road-based return GPS still uses the resident drivable graph, not a complete pedestrian network or unloaded district-wide routing. Waiting NPCs and walking player are not a complete pedestrian crowd/physics system.

Deployment uses the existing Vercel build settings. Hosted Chromium has encountered this environment's `ERR_CERT_AUTHORITY_INVALID`; local interactive/compiled-browser tests and live verified-HTTPS asset checks are reported separately, without bypassing certificate checks.
