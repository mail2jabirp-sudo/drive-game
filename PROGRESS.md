# EN 3D development checkpoints

## Phase 05 — Realistic Kerala Roads (28 October 2026)

Implemented original shared aggregate/roughness textures, tagged concrete/gravel variation, explicit retained class-width profiles, 1,028 clearance-filtered shoulder patches, conservative centre markings on eight road parts, and 324 optional repair/drainage/cover patches. Source roads/widths/coordinates/graph, physical surface/colliders, saves, HUD/minimap and practice behavior remain unchanged. Drains/repairs are authored decorative approximations; Battery saver hides them while keeping shoulders and eligible guidance. Phase 04's same 34 building models remain withheld; all source footprints remain present.

All 39 unit tests, all 11 Chromium browser tests and TypeScript/production/source-freshness build pass. GPU coverage now checks asphalt against shoulder underlays. Matched Battery saver spawn: 100 calls/6,149 triangles before, 109 calls/6,475 after. Mobile low/full-detail stress samples: 113/6,515 and 136/8,168. These are software render costs, not phone FPS. Whole-map expanded vertices: 61,916; same 82 chunks. Existing bundle advisory remains (~589 kB minified/~160 kB gzip).

See PHASE_05_REALISTIC_KERALA_ROADS.md and research/phase05/ for modified files, before/after screenshots, per-road audit, performance risks and limits. No dependency change, merge, push, publish or deployment. Stop for approval after this phase.

## Phase 04 — Kottakkal Map Foundation (28 October 2026)

The user's approved research/map-foundation sequence is separate from ROADMAP.md's older numbered traffic queue. Implemented source/derivative geographic guards, reversible coordinate functions, shared bevel-joined road patches for rendering/surface checks, bounded clipping and junction paint, a flat ground/tire datum with tested depth offsets, source-vs-boundary endpoint labels, and conservative render-only building clearance. Raw XML, derived JSON, origin/coordinates, directed source topology and saves remain unchanged. 169 approximate building models render; 34 conflicts are withheld and listed for review while all 203 footprints remain in the source database. No guessed links were added between the nine source graph components.

Read PHASE_04_MAP_FOUNDATION.md for geographic audit decisions, modified files, exact limitations, tests and matched before/after screenshots in research/phase04/. No new runtime dependency, merge, push, publication or deployment. Stop for review after this phase.

Final validation: all 34 unit tests, all 10 Chromium browser tests, strict TypeScript and production/source-freshness build passed. Screenshot inspection caught and resolved an intermediate flush-surface depth artifact; the browser suite now checks actual GPU road-over-ground coverage. Matched spawn sample decreased from 102 calls/6,990 triangles to 100 calls/6,149 triangles; this includes withheld models and is not a physical-phone FPS claim. Existing bundle-size advisory remains (~583 kB minified/~158 kB gzip).

All work belongs to `/workspace/drive-game`. Do not modify other repositories.

- Toolchain initialized: TypeScript, Three.js, Vite, npm lockfile, MIT license.
- Procedural town and rickshaw: road loop, shops, palms, plaza, bus shelter, collision bounds, animated vehicle.
- V1 complete: chase camera, mobile/keyboard input, horn, pause/reset, passenger fare and local saves.
- Validation: production build and five V1 unit tests passed. All three Chromium browser checks passed: driving/brake/reverse/horn/pause/reset, passenger pickup/delivery/save restoration, and mobile touch controls at landscape/portrait sizes. Scene screenshots inspected.

- First follow-up complete: Chaya Kada sells optional ₹10 tea; tea-break count persists and the passenger remains aboard. Version-1 saves migrate with a zero tea count.
- V1 final checks: clean `npm ci --cache .npm-cache`, `npm run build`, all 9 unit tests, and all 4 Chromium browser tests passed. Additional tea test re-run verified narrow 568×320 landscape controls and no card overlap. Mobile viewport checks also covered 844×390 and 390×844. Actual phone hardware has not been tested.
- Initial camera timing issue is fixed: initialize from the first animation timestamp and prevent negative frame deltas. Slow renderers reduce resolution/shadows automatically.
- Dependency licensing: runtime Three.js is MIT. The user explicitly approved BSD/ISC transitive development tools; notices are in THIRD_PARTY_NOTICES.md.
- Reusable install_script/start_skill saved in the cloud environment draft. Publication is a separate user action in environment settings. Local commits have not been pushed or deployed; new-task restoration has not been verified.

## Latest increment — EN 3D Phase 1

The user's new phased roadmap supersedes the earlier traffic-first queue. This is one working visual/performance increment on the existing game, not implementation of every requested phase.

- Rebranded EN 3D — എന്റെ നാട് / Kerala Open World Simulator. Welcome and minimap explicitly identify a fictional practice loop; removed the previous geographic coordinate claim.
- Original repeating asphalt/plaster/concrete/clay textures, subdued shop finishes, shutters/eaves and curved coconut fronds. Town surface checkpoint committed separately (`a113da7`).
- Added morning sky/lighting and 13 distance-culled scenery chunks: paddy plots, rubber groves with tapping details, banana plants, boundary palms, pond/reeds and rolling hills. All new surrounds lie outside the current driving area. No road geometry, collider definitions, mission positions or terrain elevations changed.
- Added saved Auto/Battery saver graphics selection; automatic detail/shadow/resolution fallback. Graphics preferences use `en3d.display.v1`; the existing `kottakkal-drive.v1` gameplay save key/schema remain unchanged. No new dependencies or external assets.
- Validation: strict TypeScript + production build pass. All 15 unit tests passed, including actual instance bounds/culling and geometry budgets. All 5 Chromium browser tests passed: original driving/mission/tea/mobile regressions plus branding/legacy-save compatibility, camera/steering, graphics and render-budget checks. A final targeted re-run also passed after aligning the sun disc and adding preference reload/small-screen welcome checks. Replaced a fixed steering-test delay with observation of actual heading to avoid software-rendering timing flakiness.
- Measured Battery saver sample at spawn: 176 draw calls, 54,376 rendered triangles. New scenery totals: 31 meshes maximum, 68,597 expanded instance vertices, 36,960 triangles. These are bounded render costs, not a promised phone FPS. Real hardware profiling remains pending.
- Screenshots inspected at desktop and 568×320 welcome size; existing touch checks cover 844×390 and 390×844 plus narrow tea controls. No critical visual overlap found.
- Vite emits its advisory about a bundle over 500 kB (Three.js included); production build succeeds. Bundle size is about 543 kB minified / 143 kB gzip.
- Updated reusable startup draft for the EN 3D title and current checks. Draft saving does not publish. Source commits remain local; nothing was pushed or deployed, and new-task snapshot restoration has not been tested.

## Latest increment — real `map.osm` integration

- Verified GitHub HTTPS read/write access with the platform's existing authentication. `origin/main` was `292f3b8` (map upload only); the complete existing game lived in six local commits ending at `b9ae6b0`. Their roots were unrelated. Additive merge `88c7634` preserves both source histories. Both `origin/main` and the old game HEAD are verified ancestors; no reset or force-push was used.
- Published the combined baseline to review branch `codex/en3d-osm-kottakkal`, preserving `main`. Subsequent importer/integration commits are normal fast-forward pushes to that branch. Review/merge is required to put the game on `main`; do not claim main already contains it.
- Import checkpoint `d5bdb1b`: unchanged 12,921,889-byte source XML, deterministic Python-stdlib parser, SHA/provenance, clipped 1.3 km slice and ODbL data notices. `npm run map:check` runs before dev/build; regeneration is explicit with `npm run map:import`.
- Exact source SHA256: `d7ef65eeb57978269dcbb2404fe32120f93e42f795bbb0ef96c1bb08f49d4add`. Unique-vertex bus-stand origin latitude 11.001609, longitude76.00470916; local metre projection east+X/north−Z. 68 source road parts/641vertices, 203 footprints, 107POIs, 70shared-node intersections, three ponds and stream794429511. Long meandering source streams are clipped by actual geometry, not centroid guesses.
- Preserved road node order, source IDs, classifications, bridge/layer metadata, one-way directions and explicit speeds. Directed graph route selection respects oneway/reverse/roundabouts and does not connect geometric overpasses without shared nodes. Complex multipolygons/invalid/missing/boundary-crossing footprints are skipped with diagnostics.
- Added real Kottakkal mode plus preserved practice mode. First-time players start real; legacy users retain practice until choosing otherwise. Area preference persists. Each ride's passenger/position is retained separately, with shared earnings/trips/tea counts in one atomic value under `kottakkal-drive.v1`. No prior saves were erased.
- Real fare: source-connected bus-stand road stop near (31.14,64.95) to hospital-access road stop near (378.389,63.659), roughly400m graph route. These are game road stops near source POIs, not verified entrances. A return route is verified. Real mode does not invent a café tea menu; original practice tea interaction remains.
- Renderer: real metre-scale road strips/junction joins, exact footprint extrusion, source-based landmark labels and water, indexed road/polygon collisions, 160m culling batches (82chunks), reduced detail and camera-centred sky. Road geometry takes precedence where imperfect footprint tags overlap; flat rendering does not simulate surveyed bridge elevation. All203building heights are explicitly estimates.
- Validation: all27unit tests and all8browser tests passed. Final production build/source-freshness check passed; targeted3OSMbrowser tests were re-run successfully after final mode-preference/NPC/texture refinements. Browser checks cover real source counts/hash, attribution, mobile controls/camera, pickup/delivery and wallet reload at coordinates outside old practice bounds, bidirectional area-save preservation and failed-map fallback. Original five browser regressions passed too. Browser fare test seeds the destination pose; separate graph/geometry tests establish connectivity/traversability. It is not a full end-to-end automated road trip.
- Latest real-mode Battery saver sample at spawn: 103drawcalls, 7,012triangles. Original practice sample remains176calls/54,376triangles. These are software-rendered scene costs, not a real-phone FPS claim. Actual hardware profiling remains pending. Screenshots inspected; production emits only the existing >500kB bundle advisory (~577kB minified/~156kB gzip).
- No traffic signals, fines/history or NPC vehicle traffic existed in the prior game; none were deleted. The supplied XML has no signal nodes. Current UI displays available OSM speed/one-way tags; routing respects directions, but player traffic enforcement/fines remain pending. Tests for those unimplemented systems are not claimed passed.

## Next manageable increment

Review this small source-backed route on actual mobile hardware and against local references. Then add one direction/speed violation detector with incident deduplication and a clearly defined insufficient-wallet policy before fines or signal/NPC traffic. Keep the practice loop and both ride states intact. Manjeri/Kozhikode expansion remains data-backed future work; do not invent road geometry or landmark positions. See ROADMAP.md and DATA_LICENSES.md.
