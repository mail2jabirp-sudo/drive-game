# EN 3D development plan

Continue `/workspace/drive-game`; retain the original practice loop, controls, camera, missions, tea/wallet and legacy saves. Implement a working increment at a time. The product is a simulator in development, not a claim of photorealism or surveyed geographic accuracy.

## Phase 1 — grounded practice area (this increment)

- EN 3D — എന്റെ നാട് / Kerala Open World Simulator branding; visible fictional-map disclosure.
- Original textured asphalt/concrete/plaster/clay, restrained palette, curved coconut fronds, detailed shops and morning lighting.
- Scenic paddy, rubber/banana vegetation and pond surrounds; shared instanced geometry, distance-culled chunks and reduced detail.
- Explicit Battery saver control plus automatic fallback. Existing missions, money, tea, controls and save key preserved.
- TypeScript/production build, existing unit/browser regressions, save compatibility and rendering-budget checks.

## Phase 2 — first Kottakkal slice delivered (current)

Do not generate random roads as a substitute for available real geometry. Choose a small bounded section around Kottakkal and verify names/locations from the actual source before assigning landmarks. Keep the practice loop as a separate, explicit mode while real-road navigation and missions are developed.

The supplied `map.osm` from GitHub is now imported offline with `npm run map:import`. The input is unchanged. Source SHA, upstream commit, projection and diagnostics are recorded in `data/OSM_PROVENANCE.json`; visible contributor attribution and ODbL data licensing are in place. No live Overpass/map-service dependency is used.

Current shipped area: ±650 m around source bus-stand way 378587276, containing 68 road parts, 203 source footprints, 107 POIs, 70 shared-node intersections, three ponds and one mapped stream. Width/height estimates are marked; one-way, explicit speed, bridge/layer tags and source identities are retained. Shared node IDs define directed connectivity; grade crossings do not magically connect. The fare uses a connected, returnable road route. Buildings are approximate models on real footprints, all with estimated heights in this slice.

Rendering uses bounded 160 m batches and culling, not whole-Kerala streaming. Both the real-map mode and original practice loop remain available. Area positions/passengers are saved separately under the original storage key, with shared wallet/trips/tea counts written atomically. A changed map hash resets incompatible positions to the current safe start while preserving the saved passenger phase and wallet. No surveyed elevation, bridge height or real façade accuracy is claimed.

Next validation: profile on actual mobile hardware; verify this source slice's entrances, widths and key POIs using permitted local references. For later source replacements/expansions, record their actual upstream commit, retain ODbL attribution/share-alike compliance, regenerate and review the data diff, test graph continuity/mission reachability and preserve both ride states. Keep bounded cached data instead of making every browser query a public API. Do not infer current legal limits or signals where tags are absent.

## Phase 3 — rules and fines

Build stop-line/segment crossing detectors from validated lane directions. Signals cycle red/yellow/green; NPC vehicles stop and queue. Test time-step crossings, stationary vehicles, reverse movement and boundary jitter. Penalize an incident once, with re-arm conditions; do not fine on every animation frame.

Fictional game amounts requested: red signal ₹500; speeding ₹1,000; wrong-way ₹500; prohibited one-way entry ₹500. These are not official Kerala rates. Define wallet-insufficiency/debt behavior explicitly and visibly before implementation; preserve existing earned money through save migration. Save bounded violation history and wallet atomically; test reload and duplicate suppression. Do not invent posted limits where real data is absent; clearly mark any authored gameplay limits.

## Phase 4 — landmarks and traffic

Verify Kottakkal bus stand/junctions and Arya Vaidya Sala area with permitted references. Distinguish approximate models from referenced geography. Add police station/NPCs, buses, cars, motorcycles/delivery/trucks progressively. Use Kerala-inspired liveries without claiming official affiliation. NPC routes must obey signals, maintain headway and recover from blocked queues. Keep passenger access clear.

## Phase 5 — expansion and environment

Add a tested Manjeri road section and bus stand, then a Kozhikode route section. Stream chunks at junctions without breaking mission/save coordinates. Add elevation-aware driving before uphill/downhill roads and bridges. Develop morning/evening/night and sunny/cloudy/monsoon presets one at a time with bounded rain/lighting costs and mobile fallback. Rivers/streams/paddy/houses should follow reference data where claimed, with clearly approximate artwork where references are unavailable.

## Delivery checks for every increment

Run `npm test`, `npm run build` and relevant `npm run test:browser` checks. Exercise driving/camera, passenger pickup/delivery, tea/wallet/save restoration and touch controls after world changes. Inspect screenshots; measure draw calls/triangles and culling, but do not equate software-headless results with real-phone FPS. Mark unimplemented traffic/map tests pending. Commit completed work, update PROGRESS.md and report exact preview commands and limitations. No pushing or deployment is implied by a local commit.
