# Phase 04/05 integration onto current main

Prepared locally on 28 October 2026. Branch: `codex/en3d-phase04-05-integration`.

Base: freshly fetched `origin/main`, `0f7bd8c73cb5089ef9430e3802453ed35b34f949`.
Reference improvements: `15925baa39f687c568f766c1237504d955fd87a9` on `codex/en3d-phase04-05-preview`.

The older branch was not deployed, merged, or used as the integration base. An isolated worktree at `/workspace/drive-game-phase04-05-integration` preserves the original `work` checkout and its local generated/research files. This branch has no upstream push target. No push, PR, deployment or Production configuration change was performed. Stop for user approval before publishing anything.

## Comparison and integration decisions

Main contains 43 commits absent from the old preview, adding full uploaded-source restoration, bounded district streaming, traffic, GPS, walking, multiple vehicles, save migration, redesigned HUD/minimap, terrain interfaces and detailed architecture. Applying the old renderer wholesale would have removed or bypassed those systems. This is a selective adaptation onto main, not a blind cherry-pick.

| Phase 04/05 improvement | Integration treatment |
| --- | --- |
| Verified legacy map origin and deterministic derivative checks | Ported to the archived Kottakkal importer/checker and legacy loading path only. They do not reject the newer regional world or its different origin. Main's district/export/network/traffic checks remain unchanged and continue to run. |
| Projection helpers and geographic guard | Retained for the legacy ±650 m extract and tested independently. The active district keeps 11.0544807°N / 76.0863541°E and its ±49,200 m container bounds. No save pose or world coordinate is reprojected by this change. |
| Shared-node bevel joins and source-end clipping | Used for road presentation in the existing renderer. The source graph, original arrays, tile identities and road-surface/collision predicates remain main's existing implementation. No connections are inferred from visual crossings. |
| Original aggregate/roughness/bump textures and surface variation | Ported to the current road batches. Main's supported `surface=earth` treatment is retained alongside concrete/gravel. Two small shared procedural textures are used; no external assets or dependencies are introduced. |
| Class-aware widths and conservative markings | Retain every exported width; the profile defaults exactly match main's `ROAD_WIDTH_DEFAULTS.json`, including narrower link roads. Centre guidance respects class, width, direction and lane information, and clears shared-node junction areas. |
| Clearance-filtered shoulders, repair overlays and drainage | Ported as authored visual dressing. Exclusions use the currently loaded source footprints/water, including main's mapped waterway widths rather than the old fixed stream assumption. They do not alter driving physics. Optional dressing is hidden in Low detail; other main detail/architecture LOD rules remain unchanged. |
| Flat datum and tire offsets from old Phase 04 | Not imposed on main. Existing `heightAt`, layer offsets, vehicle contact heights, camera behavior and slope physics are preserved. Render-only intermediate samples retain main's maximum 8 m road terrain sampling, without changing source points/node IDs. |
| Withholding 34 approximate buildings | Superseded by main's source-based 311 conflict flags and streaming filters. Those rules and all newer facades/roofs remain untouched; buildings are not suppressed a second time or replaced with old extrusions. |
| Old clipped-map boundary labels | Not restored: regional streaming seams are not playable map exits. Main's disabled world name boards remain disabled; source POIs/HUD/navigation remain intact. |
| Old rejection of the uploaded regional fragments | Not applied to the active world. Main now verifies and uses the reconstructed `export.osm` through its own source-backed pipeline. No newer source/derived geographic data is overwritten. |

The architecture module/materials, vehicles/fleet, walking controller, traffic simulation, GPS, source graph, streaming store, save schema, CSS/HUD/minimap, source XML, public assets/tiles, package files and `vercel.json` have no diff from the base. Main's geographic feature coverage and 106 source traffic controls remain validated. No generated data was regenerated into the commit.

## Validation

- Clean main baseline: **76 unit tests passed**, plus its complete source checks, strict TypeScript and Vite production build.
- Integrated unit suite: **all 89 tests passed**, including the retained wrong-location Python importer regression. This includes all 76 main cases plus adapted foundation/profile/material/clearance cases and three integration cases for current class defaults, wide mapped waterways, and large-coordinate terrain/bridge/architecture/resource preservation.
- Development browser checks: the first full run passed **34 of 35** existing cases. One walking test was interrupted when an unused-constant cleanup triggered Vite's development reload; its failure snapshot shows the loading screen and absent test instrumentation. Application files were then frozen. **All six walking cases passed on rerun**, along with the new active-district integration case. This validates **36 distinct development browser cases across the runs**, with no unresolved gameplay failure. Existing tests were not weakened or removed.
- The browser checks exercise all four vehicles, doors, switching, taxi pickup/payout, passenger binding, wallet/saves/legacy migration, walking/running/re-entry, touch controls, HUD/settings/minimap, cameras, architecture/PBR/LOD, source signals/traffic/audio, GPS rerouting, real junction traversal, streamed seam crossing, failed-tile recovery and missing-DEM fallback.
- Actual 700 m driving on Chamravattom's source bridge passed without teleporting or reloading; tiles changed while resident count remained bounded. Driving beyond the former 18 km cut also passed. Synthetic test-only terrain retained vehicle contact/camera/mission behavior without requiring or claiming a real DEM.
- **All seven local compiled-build browser checks passed** (2.4 minutes), including HTML/hashed assets/geographic/license verification, driving and save/reload through all supported legacy URLs, on-foot controls and fleet saves without developer instrumentation. These ran on loopback only; they are not a Vercel or Production deployment.
- **Final TypeScript/Vite build passed** with all source/export/district/traffic/network checks. JS: 681.96 kB minified / 193.95 kB gzip, versus main baseline 674.14 / 190.79 kB. The existing large-chunk advisory remains.

Representative integration samples from software Chromium:

| Check | Result |
| --- | --- |
| Active district / new road PBR / retained architecture | 86 calls, 10,593 triangles, 9 resident tiles; current projection and source hash verified |
| Walking beside the detailed facade | 69 calls, 33,110 triangles; both complementary architecture LODs and PBR channels verified |
| Actual Medium/High settings at that facade | 102 calls, 45,408 triangles; shadows enabled |
| High traffic | 18 agents, 82 calls, 18,261 triangles |
| Continuous long bridge drive | 46 calls, 5,777 triangles, 8 resident tiles after travelling more than 700 m |

These are bounded scene-cost samples, not measured phone FPS. Procedural dressing/material construction adds work when a streamed window is rebuilt. Mobile thermals, long-session GPU memory and physical-device performance remain unverified. The existing large-JS-chunk advisory remains; no new dependency or imagery service is required.

## Matched screenshots

Latest main was captured before edits, then integration was captured using the same stored vehicle pose, camera position/quaternion and field of view. The capture script asserts exact camera/pose equality. Both use a 1280×800 viewport, 0.75 device scale, Low detail and disabled traffic spawning for comparison stability. The screenshots show the newer HUD, vehicles, vegetation and detailed buildings alongside the updated road surfaces.

| View | Latest main baseline | Integrated roads |
| --- | --- | --- |
| Starting area | [![Before](evidence/phase04-05-integration/start-before.png)](evidence/phase04-05-integration/start-before.png) | [![After](evidence/phase04-05-integration/start-after.png)](evidence/phase04-05-integration/start-after.png) |
| Road beside the detailed house | [![Before](evidence/phase04-05-integration/outskirts-before.png)](evidence/phase04-05-integration/outskirts-before.png) | [![After](evidence/phase04-05-integration/outskirts-after.png)](evidence/phase04-05-integration/outskirts-after.png) |

[Active district screenshot](evidence/phase04-05-integration/active-world.png) and [camera/pose verification](evidence/phase04-05-integration/comparison-verification.json). Generated screenshots/JSON remain local review artifacts, excluded from the source commit. The repeatable capture script is included.

## Changed files

- `src/osm-world.ts`: adapt the road surface/material/dressing pass; retain main's terrain, localized GPU batches, bridge rails, architecture and source collision behavior.
- New `src/road-foundation.ts`, `src/road-profile.ts`, `src/road-materials.ts`, `src/road-dressing.ts`: adapted presentation helpers from the approved reference commit.
- New `src/map-coordinates.ts`, `scripts/map_geography.py`; updated `scripts/check_map.py`, `scripts/import_osm.py`: legacy-extract geographic and deterministic source checks.
- `src/main.ts`: only the legacy load path gains the guard; the newer district/fleet/walking/traffic/HUD flow is preserved.
- `tests/map-foundation.test.ts`, `tests/road-style.test.ts`, `tests/osm-import.test.ts`, `tests/phase04-05-integration.test.ts`, `tests/phase04-05-integration.spec.ts`: ported compatible cases and integration-specific regression coverage.
- `playwright.config.ts`: optional `EN3D_TEST_PORT` override and strict port binding, preventing tests from accidentally reusing the old checkout's server. Existing default port and test expectations remain intact.
- `scripts/capture_phase04_05_integration.mjs` and this report: local comparison evidence and review instructions.

## Preview and approval gate

```sh
cd /workspace/drive-game-phase04-05-integration
npm run dev -- --host 127.0.0.1 --port 5190 --strictPort
# http://127.0.0.1:5190
EN3D_TEST_PORT=5190 npm run test:browser
npm test
npm run build
npm run test:production  # compiled build on local loopback only
```

The old preview branch remains unchanged. This integration is local only. **Review and approve the integration commit before any push or deployment.** No merge into main or Production modification is authorized or performed.
