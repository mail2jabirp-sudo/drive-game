# Phase 05 — Realistic Kerala Roads

Completed 28 October 2026 on top of the approved Phase 04 working tree. Road presentation is implemented in the existing Three.js game. No merge, push, deployment or publication was performed. Stop for approval before further phases.

## Implemented changes

- **Original asphalt material:** a 256×256 aggregate/albedo texture plus one 128×128 shared roughness/bump texture. Low-contrast, smoothly varying mottling replaces the nearly black road appearance. Texture coordinates stay in world metres across strips, corners and junctions. The two textures repeat with mipmaps and bounded anisotropy; no imagery download, new library or custom shader is required.
- **Source-driven surface variation:** the mapped concrete road (`821771275`) and gravel lane (`821772567`) now get distinct material treatments. Other unknown/unsupported surface tags use a neutral asphalt-like fallback; tags are not rewritten. One source `surface=tartan` value remains untouched and is not presented as verified asphalt.
- **Explicit width and marking policy:** road profiles retain the Phase 04 carriageway widths, including lane-derived values and narrow single-lane tertiary roads. Profiles make the existing highway-class estimates explicit and drive shoulder/drainage/marking choices. No arbitrary widening, narrowing, coordinate movement or extra connections were introduced. This preserves collision behavior and mission/save locations while giving roads of different classes a coherent visual treatment.
- **Continuous, restrained shoulders:** 1,028 accepted surface patches form narrow laterite/dust-colored visual bands beneath the unchanged carriageway. They reuse the foundation's clipped bevel joins, so corners and junctions transition without opening holes in the asphalt. Bands are excluded where they would intersect any source building footprint or mapped water, including footprints of models withheld in Phase 04. Bridge/tunnel parts receive no invented roadside shoulders or drainage.
- **Selective centre markings:** eight road parts qualify. Major two-way roads require sufficient width and either multi-lane tags or a conservative width threshold. Single-lane roads, one-way carriageways, gravel, narrow tertiary roads and residential/unclassified/service/living streets get no inferred centreline. Dashes remain interrupted around shared-node junctions. No zebra crossings, stop/yield lines, traffic signs, lane arrows or legal priority rules were invented.
- **Roadside weathering and drainage:** 59 small, deterministic repair overlays; 115 authored drainage-rim/channel spans with 35 short cover slabs. Drains require a suitable major-road profile, nearby source building context, an accepted shoulder and clearance from every carriageway, building and mapped water area. They are flat visual details, not mapped drainage infrastructure or physical trenches. Repairs change no driving behavior.
- **Desktop/mobile detail control:** asphalt, surface variation, shoulders and eligible centre markings remain in Battery saver. Repairs, drainage and covers use existing detail/distance culling and disappear in Battery saver. Geometry is merged by material/detail level inside the existing 160 m chunks; no per-object draw calls or new shadow-casting roadside models were added.

### Widths and placement

| OSM classification | Existing fallback carriageway width | Added visual shoulder, each side |
| --- | --- | --- |
| Primary | 8 m | 0.50 m |
| Secondary | 7 m | 0.50 m |
| Tertiary | 6 m | 0.30 m |
| Residential | 5 m | 0.22 m |
| Unclassified | 4.5 m | 0.22 m |
| Living street | 4 m | 0.22 m |
| Service | 4 m | 0.16 m |

These fallback values already existed in the importer; they are estimates, not Kerala engineering standards. The renderer retains exported width values, including 6.4 m lane-derived widths and a 3.2 m single-lane tertiary road. Actual `width` tags would remain authoritative through the existing importer. Shoulder bands do **not** expand the drivable road surface or alter the minimap/database.

Shoulder omission near a source conflict is intentional; it does not remove carriageway geometry. Existing road ends and the 31 map-exit labels remain intact. Nine source graph components are still preserved rather than joined by visual proximity. All 203 source footprints remain in the database, and the same 34 conflicting approximate models remain withheld, as documented in Phase 04.

## Surface stability and preservation

The physical surface remains flat at the Phase 04 datum: ground Y=0, carriageway Y=0.004 m, guidance paint Y=0.006 m. Shoulders and drainage sit close to the ground; repairs are visual overlays. Explicit depth-buffer ordering separates ground/water, shoulders, asphalt, concrete/gravel, weathering/channels/covers and paint. Source surface changes use deterministic material ordering at overlaps; equivalent patches share world-space textures.

Screenshot inspection caught an intermediate shoulder-through-asphalt artifact and an overly regular first texture pattern. The final material removes the regular pattern and increases depth separation. The browser GPU readback regression now includes shoulder underlays as well as ground and checks asphalt coverage at real route points from a 180 m overhead camera. Geometry tests still verify rendered triangle coverage over every source segment midpoint.

No Phase 05 changes were made to source XML, derived geographic JSON, projection, nodes, way order, road graph, physics, vehicle model, input, camera logic, passenger/wallet/tea logic, save schema, HUD, minimap or traffic/rule systems. Practice mode retains its original materials and behavior because the new material factory is used only by the OSM renderer. No traffic behavior was added or replaced.

## Before-and-after screenshots

Before images were captured from the completed Phase 04 working tree before road edits. Matched desktop views use the same map, empty save, Battery saver, 1280×800 viewport and 0.75 device scale. Three inspection views override the camera and disable fog only in the served test response. No screenshots were generated or composited. UI toast timing may differ.

| View | Before | After |
| --- | --- | --- |
| Normal spawn camera | [![Before spawn](research/phase05/before-drive.png)](research/phase05/before-drive.png) | [![After spawn](research/phase05/after-drive.png)](research/phase05/after-drive.png) |
| Main-road inspection, camera (68,18,95), target (80,0,65) | [![Before main road](research/phase05/before-main-road.png)](research/phase05/before-main-road.png) | [![After main road](research/phase05/after-main-road.png)](research/phase05/after-main-road.png) |
| Overhead junction, camera (110,125,65) | [![Before junction](research/phase05/before-junction.png)](research/phase05/before-junction.png) | [![After junction](research/phase05/after-junction.png)](research/phase05/after-junction.png) |
| Local-road inspection, camera (40,13,16), target (55,0,−12) | [![Before local road](research/phase05/before-village-road.png)](research/phase05/before-village-road.png) | [![After local road](research/phase05/after-village-road.png)](research/phase05/after-village-road.png) |

Additional after-only evidence: [drainage close-up](research/phase05/after-drainage-detail.png), [mobile landscape](research/phase05/after-mobile-landscape.png), [mobile portrait](research/phase05/after-mobile-portrait.png). The drainage close-up explicitly enables full world detail in test instrumentation while retaining low shadow settings; it is not a matched Battery saver comparison or a claim that drainage is displayed in Battery saver.

Capture command against a running Vite server: `node scripts/capture_kerala_roads.cjs after`. The `before` label requires serving the pre-change source; using that label on current source does not reproduce the historical baseline.

## Validation and measured costs

- **39 unit tests passed** with `npm test`. New checks cover width provenance/class defaults, narrow/single-lane marking exclusions, surface tags, bridge/tunnel decoration exclusions, deterministic dressing, building/water/road clearance, map bounds, two-texture sharing, material ordering, geometry budget, detail culling and exact-once scene resource disposal. Existing geographic/import/routing/rendered-triangle/gameplay/save tests pass.
- **All 11 Chromium browser tests passed** with `npm run test:browser` (1.7 minutes). Coverage includes practice driving/braking/reversing/horn/pause/reset, camera, passenger pickup/delivery/reload, tea/wallet, mobile landscape/portrait controls, legacy/area saves, map failure/wrong-location recovery, attribution, foundation GPU coverage and Phase 05 low/full-detail budgets.
- **Strict TypeScript and production build passed** with `npm run build`, including deterministic source/derived-map validation. Main JS: 589.32 kB minified / 160.16 kB gzip, compared with Phase 04's 583.33 / 157.86 kB. The existing >500 kB chunk advisory remains. No dependency or lockfile changed.
- All comparison screenshots were inspected, and `git diff --check` passes. A new marking test initially inherited a one-way flag from its fixture; the corrected two-way fixture and full unit rerun pass. No unresolved test failure remains.

| Matched Battery saver view | Phase 04 calls / triangles | Phase 05 calls / triangles |
| --- | --- | --- |
| Spawn | 100 / 6,149 | 109 / 6,475 |
| Main-road inspection | 23 / 1,493 | 31 / 1,885 |
| Overhead junction | 103 / 6,336 | 115 / 6,794 |
| Local-road inspection | 22 / 1,692 | 32 / 2,146 |

The spawn comparison adds 9% draw calls and about 5.3% triangles. Material batching keeps the absolute increase small; it is not a performance improvement claim. Saved samples: [before](research/phase05/before-render-cost.json), [after](research/phase05/after-render-cost.json).

At mobile spawn, the automated check measured **113 calls / 6,515 triangles / 9 renderer textures** in Battery saver. Forcing full nearby geometry detail with the same camera and low shadow settings measured **136 calls / 8,168 triangles / 10 renderer textures**. These passed the explicit test caps of 160 calls/12,000 triangles for low detail and 220 calls/18,000 triangles/40 textures for the full-detail stress view. They do not establish production Auto-mode FPS.

The whole retained map now has 61,916 expanded mesh vertices across 427 meshes, most distance/detail culled, with the same 82 chunks. Dressing generation had an initial one-off Node sample of approximately 58 ms; it runs at world creation, not every driving frame. Road materials share only two new textures (256² color and 128² roughness/bump), roughly 0.42 MiB of uncompressed RGBA storage including a full mip chain. This estimate excludes geometry, other game textures and driver overhead.

Measured limits and remaining risks:

- Additional materials/shoulders increase draw calls; nearby full-detail drainage adds more. Mobile Battery saver removes optional detail, but real Android/iPhone profiling and thermal/memory testing remain pending.
- Two extra texture samplers for roughness/bump add fragment work even when triangle counts are low. Software Chromium scene costs are not a real-phone FPS guarantee. Texture/mipmap and mesh-count tests bound growth; they do not prove absence of GPU stalls on all devices.
- The existing flat terrain/bridge limitation remains. No actual drainage depth, hydrology, road cambers, graded shoulders or surveyed elevations are simulated.
- Materials, repair patches, drains and shoulders are authored approximations. Unknown width/surface data and the 34 withheld building models still need local verification; a highway classification does not establish real markings or road condition.
- No asynchronous world streaming, large-area expansion, new road connections or traffic-rule implementation was started.

## Modified files and evidence

The local source commit excludes generated screenshots and JSON evidence. They remain in this workspace; evidence links below refer to those local artifacts. Source scripts and tests are included so the checks and captures can be repeated.

Phase 05 changes relative to the Phase 04 working tree:

| File | Purpose |
| --- | --- |
| `src/road-profile.ts` (new) | Existing class-width policy, retained width provenance, surface type, shoulder/drain eligibility and conservative marking rules. |
| `src/road-materials.ts` (new) | Original shared small textures, surface materials, roughness/bump and explicit depth ordering. |
| `src/road-dressing.ts` (new) | Deterministic shoulders, clearance-indexed drainage/covers and repair overlays; no source mutation. |
| `src/road-foundation.ts` | Consult marking eligibility; allow reusable footprint-only clearance queries. Core road-patch construction is unchanged. |
| `src/osm-world.ts` | Integrate/batch materials and dressing, keep centre guidance in low detail, cull optional detail, expose test statistics and dispose owned materials/textures. |
| `tests/road-style.test.ts` (new) | Five road-policy, clearance, determinism, resource and geometry-budget tests. |
| `tests/osm-browser.spec.ts` | Extend GPU underlay coverage and add mobile low/detail performance and portrait checks. |
| `scripts/capture_kerala_roads.cjs` (new) | Repeatable Phase 05 comparison views and after-only detail capture. |
| `DATA_LICENSES.md`, `PROGRESS.md`, this report, `research/phase05/` | Scope, measurements, screenshots, validation and source-preservation evidence. |

Detailed per-road profiles, decoration counts and retained model IDs: [road-style-audit.json](research/phase05/road-style-audit.json). Final check summary: [validation-results.json](research/phase05/validation-results.json). The Phase 02–04 reports and existing working-tree changes remain preserved; they were not reset or reapplied.

The source XML SHA-256 remains `d7ef65eeb57978269dcbb2404fe32120f93e42f795bbb0ef96c1bb08f49d4add`; derived geographic JSON remains `87704620c3270876026d58e24fc73ca481d92cbb3b3bac8791dce2f425ce6dbc`. ODbL attribution and license remain intact, separately from the original MIT application/artwork. No proprietary Hey Auto code or assets were used.

Preview: `npm run dev -- --port 5173`, then open `http://localhost:5173/?world=osm`. The original practice area is `?world=practice`.

**Phase 05 is complete. Stop here for review and approval; no merge, deployment or next phase has begun.**
