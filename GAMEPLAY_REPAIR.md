# Visible gameplay and passenger GPS repair

## Diagnosis

The production domain https://drive-game-beta.vercel.app/ served the PR #6 merge, `7cd1e7396fce68c7e40a2b6d90cadb58163eca56`. A separate clean checkout/build reproduced its JavaScript and CSS byte for byte against verified HTTPS responses:

- `index-BNe3CivP.js`: SHA-256 `b00cb738856c0ad3b052675c2bb3f87ea17456d0f63096164b56bf43c1c58e3e`.
- `index-DZRkRG9R.css`: SHA-256 `d27d534e429e2f0b75f1769831e5f42708de64e8746b5464b78b8f25fe1fd11a`.

The reproduced fresh start was `x=-66.036, z=256.061`, heading `1.394`. Its loaded window contained **zero footprints**. The six active traffic agents were approximately 69–189 metres away after five seconds; counting them did not establish useful camera visibility. Spawning deliberately excluded everything within 48 metres and ignored the forward view. The camera's far clip and instanced-vehicle frustum flags were not the root cause. Invalid saved positions on open grass passed the startup collision check because grass is not a blocking building.

No user save file or screenshot attachment was available in this request. Browser verification reproduced a fresh start, archived Kottakkal saves and a seeded off-road district save with an active passenger and wallet.

## Implemented

- Fresh rides start near the source-mapped Kottakkal bus stand, within the same unified world. Its existing 203 verified footprints are resident. Valid existing road poses remain where saved; off-road/obstructed poses are repaired to a nearby source-road segment after checking the vehicle footprint, direction and building polygons. Wallet, passenger phase, original practice pose and archived Kottakkal ride remain intact.
- Optional backwards-compatible `missionOrigin` keeps new-area passenger stops stable after reload/travel. Pre-existing district saves retain their former origin-area mission. Reset uses a validated local road pose.
- Nearby traffic candidates start 18–180 metres away and favour roads in the forward view. Existing lane, one-way, footprint, clearance, routing, size, following and collision checks still apply. No new vehicle models or sound recordings were introduced.
- Pavement joins use 24-sided round buffers with matching rounded shoulders. Source centre coordinates, source node IDs, tile seams and one-way tags are unchanged. This rounds the rendered edges; it does not claim to recover surveyed curves absent from OSM or create links across disconnected ways/overpasses.
- Source footprints, landmarks and earlier geographic assets are reused. Bounded, batched low-poly palms and utility poles populate clear verges, avoiding mapped roads, footprints and water. **These decorative positions and models are authored approximations, not surveyed vegetation, utility infrastructure or a real-world replica.** Existing shop/market landmark signs remain source-positioned; nearby annotations shrink/hide rather than covering the driving view.
- Waiting passengers are placed on a checked nearby verge rather than inside intersection pavement. The floating destination arrow hides when already at the stop, while its ground marker remains.
- GPS snaps its virtual endpoints onto real source segments and routes through shared source nodes with one-way direction preserved. It highlights the current pickup/drop-off route on the minimap and lays bounded ground arrows along it. Guidance includes left/right/U-turn instructions and distance to the next turn. Movement, mission changes and streamed road changes recalculate the route. Pickup/drop-off markers are labelled P/D. SVG turn icons avoid missing system-font glyphs.
- Nearby mapped signals show the same authored phase and countdown used by AI and rendered lamps; pause freezes that clock. The HUD explicitly says **Simulated signal**. Malayalam/English bridge, junction and bend advisories derive from bridge tags, source-node degree and sharp source geometry. They are not a surveyed danger assessment or live signal timing.
- Official branding remains **EN 3D — എന്റെ നാട് · Kerala Open World Simulator**. No map selector was added. No source map, tile, vehicle, mission or asset was deleted/replaced.

## Browser evidence

Actual Chromium/SwiftShader captures, with the game's normal driving/rendering paths:

- [Fresh start: player on pavement, moving nearby traffic, buildings, palms and passenger](evidence/gameplay-repair/start.png).
- [After actual throttle/braking: nearby bike, car, auto, van and bus, highlighted route and turn instruction](evidence/gameplay-repair/driving.png).
- [Recalculated route after taking another real road](evidence/gameplay-repair/rerouted.png).
- [Source-mapped signal with simulated phase countdown](evidence/gameplay-repair/signal.png).

Browser assertions require multiple agents inside the camera frustum within 95 metres, then observe their actual position changes. They also check rendered vegetation/building batches, a clear roadside passenger, GPS instance arrows, reroute revision/position, paused countdowns, and a throttle-driven crossing of a real clipped tile seam. Existing browser checks cover steering/braking/reverse, mobile pedals, pickup/drop-off earnings, saves, audio output/mute, source-road traffic collision stops, heavy-vehicle rendering and bounded traffic settings. Test-only instrumentation is injected by Playwright; it is not exposed by the production game.

Validation: 58 unit tests; 19 browser regressions; five additional focused browser checks after visual polish; five compiled-production checks; TypeScript and production build. All passed. A full fresh-window rendering sample was about **124 draw calls / 15,000 triangles**, with no more than nine resident tiles. These are headless render budgets, not a real laptop/phone FPS measurement. Vite retains its nonfatal >500 kB bundle advisory.

## Coverage and remaining limitations

The existing partial 36 km road window and all 3,535 road tiles remain unchanged. The bus-stand starting pose is approximately `11.00102°N, 76.00499°E`; its common frame remains `11.0544807°N, 76.0863541°E`. These changes add no geographic coverage and do not claim a complete district. Buildings are still approximate low-poly extrusions of existing footprints, with estimated heights where the source lacks heights. Areas without footprint data can still be sparse. Existing valid rides are not silently teleported into the new starting neighbourhood.

GPS uses only the bounded resident road graph. A destination outside that connected window is explicitly unavailable until its roads are resident; long-distance routing through unloaded tiles is a remaining increment. There is no straight-line/fabricated-road fallback. Traffic still uses a bounded 20 Hz prototype with recovery despawns; more complete turning, lane priority and pedestrian movement remain future work. Signals use a shared authored two-axis timing model, not surveyed phase plans or per-lane restrictions. No new fine system is claimed.

No verified elevation grid is installed, so production terrain remains flat. Detailed Kerala roofs/shopfronts, additional source footprints, mapped land-use vegetation, realistic terrain/bridges, full-area route planning and real hardware profiling remain pending. No paid asset/API or new dependency was introduced. OSM attribution and ODbL notices remain intact; original code/procedural assets are MIT.

The hosted-domain Chromium run is blocked by this environment's certificate trust chain. No browser security or trust setting was weakened. Interactive gameplay/screenshots were verified locally, including the compiled build; production is checked separately through verified HTTPS assets and GitHub/Vercel commit statuses. Do not interpret deployment success alone as a hosted interactive browser test.

## Preview

Run `npm ci`, `npm run dev -- --port 5173`, then open http://localhost:5173/. Production preview: `npm run build`, `npm run preview -- --port 4173`. Existing saved on-road rides resume locally; use a separate browser profile to inspect the new default start without clearing an existing wallet.
