# EN 3D development plan

Continue `/workspace/drive-game`; retain the original practice loop, controls, camera, missions, tea/wallet and legacy saves. Implement a working increment at a time. The product is a simulator in development, not a claim of photorealism or surveyed geographic accuracy.

## Phase 1 — grounded practice area (this increment)

- EN 3D — എന്റെ നാട് / Kerala Open World Simulator branding; visible fictional-map disclosure.
- Original textured asphalt/concrete/plaster/clay, restrained palette, curved coconut fronds, detailed shops and morning lighting.
- Scenic paddy, rubber/banana vegetation and pond surrounds; shared instanced geometry, distance-culled chunks and reduced detail.
- Explicit Battery saver control plus automatic fallback. Existing missions, money, tea, controls and save key preserved.
- TypeScript/production build, existing unit/browser regressions, save compatibility and rendering-budget checks.

## Phase 2 — a small verified Kottakkal road-data slice (next)

Do not generate random roads as a substitute for available real geometry. Choose a small bounded section around Kottakkal and verify names/locations from the actual source before assigning landmarks. Keep the practice loop as a separate, explicit mode while real-road navigation and missions are developed.

1. Fetch a bounded OpenStreetMap extract through a permitted public data endpoint, respecting its usage policy; cache a checked-in, reproducible extract rather than making every browser query a live service. Record source URL/query, bounding box, retrieval date, OSM object IDs/versions and a file checksum. Do not scrape map tiles or require paid APIs.
2. Convert latitude/longitude to a documented local metre projection, preserve way-node order, curves, intersections and tags (`oneway`, `junction`, `maxspeed`, lanes and access). Separate roads from sidewalks/private access. Validate missing tags instead of guessing legal directions or limits. OSM elevation is often incomplete: do not claim surveyed heights.
3. Partition meshes/data into bounded chunks; deterministic load/unload must not duplicate colliders or strand a moving vehicle. Test junction continuity, traversable route widths and restart behavior.
4. Attribute **© OpenStreetMap contributors** visibly in the map UI, linked to https://www.openstreetmap.org/copyright. Record ODbL 1.0 terms and source provenance in a dedicated data notice; preserve notices and comply with share-alike obligations for distributed adapted databases. Code/assets retain their separate licenses. The user's request explicitly permits applicable map-data licensing; it is not an MIT-code license claim.
5. Add one short playable road section only after data validation; migrate saves through explicit world/route identity without erasing wallet/passenger state. Confirm actual route/landmark references before calling it accurate. If access is blocked, report the endpoint/operation; do not substitute invented coordinates and call them real.

## Phase 3 — rules and fines

Build stop-line/segment crossing detectors from validated lane directions. Signals cycle red/yellow/green; NPC vehicles stop and queue. Test time-step crossings, stationary vehicles, reverse movement and boundary jitter. Penalize an incident once, with re-arm conditions; do not fine on every animation frame.

Fictional game amounts requested: red signal ₹500; speeding ₹1,000; wrong-way ₹500; prohibited one-way entry ₹500. These are not official Kerala rates. Define wallet-insufficiency/debt behavior explicitly and visibly before implementation; preserve existing earned money through save migration. Save bounded violation history and wallet atomically; test reload and duplicate suppression. Do not invent posted limits where real data is absent; clearly mark any authored gameplay limits.

## Phase 4 — landmarks and traffic

Verify Kottakkal bus stand/junctions and Arya Vaidya Sala area with permitted references. Distinguish approximate models from referenced geography. Add police station/NPCs, buses, cars, motorcycles/delivery/trucks progressively. Use Kerala-inspired liveries without claiming official affiliation. NPC routes must obey signals, maintain headway and recover from blocked queues. Keep passenger access clear.

## Phase 5 — expansion and environment

Add a tested Manjeri road section and bus stand, then a Kozhikode route section. Stream chunks at junctions without breaking mission/save coordinates. Add elevation-aware driving before uphill/downhill roads and bridges. Develop morning/evening/night and sunny/cloudy/monsoon presets one at a time with bounded rain/lighting costs and mobile fallback. Rivers/streams/paddy/houses should follow reference data where claimed, with clearly approximate artwork where references are unavailable.

## Delivery checks for every increment

Run `npm test`, `npm run build` and relevant `npm run test:browser` checks. Exercise driving/camera, passenger pickup/delivery, tea/wallet/save restoration and touch controls after world changes. Inspect screenshots; measure draw calls/triangles and culling, but do not equate software-headless results with real-phone FPS. Mark unimplemented traffic/map tests pending. Commit completed work, update PROGRESS.md and report exact preview commands and limitations. No pushing or deployment is implied by a local commit.
