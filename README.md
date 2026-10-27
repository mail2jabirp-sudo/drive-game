# EN 3D — എന്റെ നാട്

**Kerala Open World Simulator**

The existing autorickshaw game retains its original two driving areas: a small **real OSM Kottakkal slice** from the repository's `map.osm`, and the preserved **original fictional practice loop**. Retained roads, connections and footprints use source geographic coordinates at metre scale. Building heights and models remain approximate; this is not photorealistic or surveyed 3D terrain. No paid assets, map API accounts or runtime map-service calls are required.

New players start in the real-map area. Existing saves return to their original practice ride. Select **Driving area** on the welcome screen, or open **Display → Change driving area** during a ride. Earnings, trips and tea-break counts are shared; each area's passenger and vehicle position are kept separately without erasing the original save.

## Uploaded Malappuram road mode

A third area, **Malappuram · uploaded road tiles**, integrates a verified 4.8km window from the reconstructed `export.osm`. Choose it on welcome or via Display → Change driving area. It streams a bounded 3×3 window of small road files, preserving both earlier maps and every ride save. The full source spans a broader Malappuram-region road extract, not verified whole-district coverage. See [ROAD_EXPORT.md](ROAD_EXPORT.md) for exact bounds, roads, reconstruction hashes, streaming limits and merge instructions. Buildings are deferred in this road-only mode.

## Develop

Requires Node.js **20.19+ or 22.12+**, npm (tested with Node 24), and **Python 3** for offline map checks/imports. No Python packages are needed.

```sh
npm ci --cache .npm-cache
npm run dev
```

Use the existing checkout. Each cloud task already has an isolated environment; do not create an extra Git worktree. Vite listens on port 5173 (or the next free port). Access the server using your development environment's supported browser connection. WebGL2 and hardware acceleration are recommended. A small-screen device gets touch controls; landscape gives more room to see the road. Open **Display** in the top toolbar to choose **Auto** or **Battery saver**. Auto reduces resolution, shadows and vegetation detail after sustained slow frames. Battery saver applies those reductions immediately; the preference is saved separately from gameplay. No smooth-framerate claim is made for every device.

```sh
npm run build       # strict TypeScript checking + production output in dist/
npm run preview     # serve the production output
npm test            # driving, collision, mission and save tests
npm run test:browser
npm run map:check   # source checksum agrees with the generated excerpt
npm run map:import  # intentionally regenerate after changing the source/config
```

Browser checks use Playwright and an installed Chromium at `/usr/bin/chromium`. Set `CHROMIUM_PATH` if yours is elsewhere. Browser tests include keyboard/touch input, pickup, delivery and saved-state restoration. They exercise all three areas and deliberately seed saved destination positions to test delivery without a lengthy automated road trip. Graph tests separately verify a connected, returnable route and traversable source segments. Unit tests exercise driving and the mission rules separately. The application does not depend on Playwright at runtime.

## Drive

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | W / ↑ | GO pedal |
| Brake, then reverse | S / ↓ | BRAKE / REV pedal |
| Steer | A D / ← → | Arrow buttons |
| Handbrake | Space | P button |
| Horn | H | Note button |
| Pick up / drop off | E | Mission button |
| Return auto to road | R | Reset icon |
| Pause / resume | P / Escape | Pause icon |

**Practice area:** the auto starts on Bakery Road, pointing toward the first passenger. Follow the gold marker and map, stop within 8 metres, then press **E** or the mission button. Carry the passenger around the road loop to the teal marker at the market bus stand. Stop and interact again to earn **₹120**. Another fare then becomes available. There is no timer, penalty or NPC traffic in the current build, so take your time. You can roam the town off the roads at a lower speed.

Earnings, completed trips, tea-break count, active passenger, position and heading save to this browser's local storage every two seconds, at interactions, on pause and on exit. Refreshing restores the ride. Private browsing or blocked storage can make saves temporary; the HUD reports storage failures. R resets only the vehicle, preserving your fare and money. Browser site-data clearing starts a fresh game. Saves stay on the device; there is no cloud account.

**Real-map area:** start at the Kottakkal bus-stand **road stop**. Stop in gold and press E to board. Follow the amber minimap route to the teal hospital-road stop for the same ₹120 fare. These are accessible game stops snapped to actual connected roads, not a claim of exact entrances. Practice tea purchases remain available in the practice area; mapped café tags do not establish a tea menu and no tea stop is invented on the real map.

The road-information pill shows available OSM speed and one-way tags. **Fines and signal enforcement are not active.** Unknown speed limits stay unmapped; OSM tags are not current legal advice. Reset returns to the current area's safe road start. Map edges stop the auto; this is a bounded 1.3 km slice, not all of Kerala.

## Project map

- `src/main.ts`: area selection, scene lifecycle, chase camera, mission markers and HUD
- `scripts/import_osm.py`: offline source XML parser/clipper/projector; no network or extra packages
- `src/osm-types.ts`, `public/maps/kottakkal.json`: typed, versioned geographic database
- `src/osm-world.ts`: bounded road/footprint rendering, culling and source-based collision
- `src/osm-navigation.ts`: shared-node directed graph, nearest roads, reachable passenger stops
- `src/route-save.ts`: atomic shared-wallet/separate-ride save compatibility
- `src/world.ts`: original practice loop, town and collision bounds
- `src/materials.ts`: original repeating asphalt, concrete, clay, earth and plaster textures
- `src/landscape.ts`: distance-culled scenery chunks and instanced vegetation
- `src/atmosphere.ts`: morning sky gradient
- `src/graphics.ts`: graphics preference and performance fallback rules
- `src/vehicle.ts`: generated rickshaw and animation
- `src/driving.ts`: independent driving/collision model
- `src/input.ts`: keyboard and simultaneous pointer controls
- `src/progress.ts`: versioned save parsing and passenger mission rules
- `src/audio.ts`: user-gesture initialized synthesized engine/horn
- `src/style.css`, `index.html`: responsive interface

## Map integration and next increment

The real slice is centred on source bus-stand way `378587276` at **11.001609° N, 76.00470916° E**, cropped to ±650 m. Local projection: `x = R cos(lat₀) Δlon`, `z = −R Δlat`, radians, `R = 6371008.8 m`. East is +X, north is −Z, and one world unit is one metre. The uploaded XML remains unchanged; source SHA, projection, bounds and diagnostics are in `data/OSM_PROVENANCE.json`.

Current excerpt: **68 road parts, 203 building footprints, 107 POIs, 70 shared-node intersections and four mapped water features**. Retained curves/node order and road classifications are preserved. One-way directions are used by passenger-route selection; only explicitly tagged numeric speeds are displayed. Geometric crossings do not create junctions without shared source nodes. Render batches use 160 m chunks with distance culling; fine façade/road detail is omitted in Battery saver. This is culling of a bounded loaded excerpt, not streaming the whole source map.

`map.osm` is about 12.9 MB; the game fetches only its roughly 123 KB generated excerpt. `predev`/`prebuild` checks reject a stale excerpt. After replacing source data, run the importer, review its geometry/provenance diff, and supply `--upstream-commit <actual-source-commit>` when the source revision changes. Example: `npm run map:import -- --upstream-commit <commit>`. Do not attribute a newly edited XML to the original upload without updating provenance. The unit suite independently verifies full byte-reproducibility from the checked-in source.

**Limitations:** no surveyed elevations, grade-separated bridge driving, real façade models, NPC traffic/signals, traffic fines or saved violation history. All 203 building heights are estimates in this slice. Some road/building tags overlap; road surfaces take precedence for playable collisions. Complex multipolygons and incomplete/invalid/boundary-crossing footprints are skipped with diagnostics rather than invented. This input contains no traffic-signal nodes. The original practice loop and countryside remain separately available.

**Next:** validate this small route on actual mobile hardware and against local references, then add one carefully tested traffic-rule increment (direction/posted-limit detection with incident deduplication and an explicit insufficient-wallet policy) before NPC traffic/signals or expansion. Manjeri/Kozhikode remain future data-backed stages. See [ROADMAP.md](ROADMAP.md).

## Deploy on Vercel

Use production branch **`main`**, repository root, Vite preset, build **`npm run build`**, output **`dist`**. `vercel.json` supplies the build settings. The old deployment at `292f3b8` contained only map data and cannot serve the game. Create a new deployment from the updated main; see [VERCEL.md](VERCEL.md).

## Deploy on Netlify

Use the repository-root `netlify.toml`: build **`npm run build`**, publish **`dist`**, Node **24**. Deploy `main`, which now includes the complete game and deployment configuration. The build also needs Python 3 for its map checksum check. Run `npm run test:production` to smoke-test the compiled site. See [DEPLOYMENT.md](DEPLOYMENT.md) for setup, production asset checks and remaining account/deployment steps.

## GitHub synchronization

GitHub `main` initially contained only the uploaded XML (`292f3b8`), while six local commits held the completed game. The histories were combined with an additive merge; both roots remain ancestors. The complete game was first published on **`codex/en3d-osm-kottakkal`**. `main` is now advanced normally to include that history and explicit Vercel deployment settings. No force-push, reset or history replacement is used. `PROGRESS.md` records the current checkpoint.

## Licensing

Original code and generated artwork are MIT licensed; see `LICENSE`. Runtime dependency Three.js is MIT. Primary tools are MIT/Apache-2.0; user-approved BSD-3-Clause and ISC transitive development utilities are also retained. See `THIRD_PARTY_NOTICES.md`; dependency lockfile pins the installed graph. No third-party art/model/music/font packs are included. **Map data is separately ODbL 1.0**: see [DATA_LICENSES.md](DATA_LICENSES.md). Real-map attribution must remain visible when publishing; the data is not MIT licensed.

### Tea stop

Chaya Kada is on the west side of the loop (the small terracotta map dot). Park in the circle outside the shop. Press E, use the mission interaction button, or tap **Have chai · ₹10**. Tea costs ₹10 and adds one saved tea break. It is optional, has no timer or performance bonus, and preserves your passenger. Complete a fare first to afford a cup.

Terrain development checkpoint: see [TERRAIN_PROTOTYPE.md](TERRAIN_PROTOTYPE.md). Existing real-map roads now use mapped surface tags and authored gravel verges. Optional terrain rendering/driving is tested with synthetic fixtures, but the actual DEM download is blocked; the shipped geographic modes remain flat. No full-district or real-elevation claim is made.
