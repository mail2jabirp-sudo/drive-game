# Phase 06 — Kerala buildings and roadside development

## Baseline and scope

Implemented on `codex/en3d-phase06-kerala-buildings`, based on approved integration `a3dbccf1ac9e297c990495eecb1c04598fddab8c`. At task start, a read-only fetch confirmed `origin/main` at `0f7bd8c73cb5089ef9430e3802453ed35b34f949`, already an ancestor of that integration. The integration includes the newer streamed district, vehicle fleet, walking, traffic, GPS, missions and dark green interface. Original worktrees and their untracked research/evidence were preserved. No main merge, push, deployment, production change, traffic-density change, signal-system implementation or Phase 07 work occurred.

The existing renderer uses Three.js standard materials, original canvas textures, 160 m material-batched chunks, complementary near/far architectural geometry, and at most nine resident 600 m source tiles. Tile refresh builds the next world before disposing the previous one. Source footprints drive collision separately from decorative facade geometry. Existing asset loading, controls, save keys and schema remain unchanged.

## Geography and evidence

The active district projection remains latitude **11.0544807**, longitude **76.0863541**, radius **6371008.8 m**. Kottakkal's former local origin (11.001609, 76.00470916) projects to approximately (-8910.067, 5879.073) in that shared frame. The ±49,200 m district container is a streaming envelope, not a claim of complete geographic or building coverage. The `map.osm` header query window is **10.9833–11.0349 N, 75.9557–76.0714 E**, around Kottakkal in Kerala. A full node scan also checks actual data beyond that header: `map.osm` spans **10.7651111–11.4436553 N, 75.8818387–76.1033108 E**; `export.osm` spans **10.6269746–11.5259870 N, 75.8256662–76.7019365 E**. These are regional extracts extending beyond Kottakkal, not proof that every node lies within a Kerala/Malappuram administrative boundary; no administrative polygon is provided. The approved partial district retains its existing clipping and coverage, and Phase 06 makes no geographic expansion. The legacy ±650 m map and the earlier ±2400 m Malappuram road window keep their distinct documented projections; neither is substituted for the active district. Optional DEM loading and its source/projection checks are unchanged.

Both raw OSM files are byte-identical to baseline:

- `map.osm`: `d7ef65eeb57978269dcbb2404fe32120f93e42f795bbb0ef96c1bb08f49d4add`
- `export.osm`: `7915b6d48899723c3dd4a88dfd8c3db64d77e0e85e60d9e99511c2bb6b7ac3f2`

Coverage remains 8,315 district tiles, 39,273 source road ways and 182 source components. The auxiliary source contains 4,673 buildings, 4,362 renderable buildings, 311 withheld road-buffer overlaps, 584 POIs, 205 water features and 65 land-use polygons. Source traffic-control data remains 10 signals and 96 crossings; no new signal behavior was added.

The extractor now retains existing `office` and `building:colour` tags alongside roof/material tags. Regeneration added **34 existing office tags in 25 tile files**. A structural comparison against baseline proved every changed tile otherwise identical: all roads, node IDs, footprints, orientations, heights, other tags and exclusions were preserved. Manifest/provenance changes are limited to corresponding tile byte counts and hashes. No source color tags were available to add. Across all 4,673 buildings there are 34 `building:levels` tags, one retained `height=0` tag (invalid as a physical building height), 155 `shop`, 167 `amenity`, 34 `office`, and zero roof-shape/material/color tags. All current derived heights carry `heightSource=estimate`; this phase preserves them rather than claiming measured heights.

An inspected 3.6 km neighborhood around the legacy Kottakkal origin contains 878 footprints, including 749 generic `building=yes`, 71 houses, 29 schools, three apartments and small numbers of other categories. None of these 878 footprints carries `roof:shape`. Placement and mapped categories are source grounded; exact roofs, facade colors, windows, entrances, verandas, balconies, steps and frontage boundaries are **procedural regional interpretations**, not surveyed identities. Generic tall footprints no longer become apartments merely because they are tall. Office, commercial, institutional, worship and supported residential categories take precedence over generic inference. Land-use and water data remain intact; no fictional urban infill or mapped ownership boundaries are added.

## Implemented visuals and safety

- Deterministic source-ID variants select restrained plaster palettes, facade spacing, window proportions, recess depth and roof pitch, preserving the source total height and footprint envelope.
- Traditional low-rise houses retain pitched clay roofs, timber details and recessed verandas. Modern concrete houses use flat roofs, parapets, shading and recessed upper loggias. Small shops and multi-storey mixed-use buildings retain ground-floor openings/shutters; offices gain inset shading. Tagged apartments, educational/medical/public exteriors and low-rise default structures use the existing reusable facade construction with varied proportions.
- Near-detail entry steps and commercial canopies stay inset within the footprint. No new projecting stair, balcony or awning extends into road space. Existing conservative flat-roof fallback for concave/large footprints remains.
- Original 256² plaster, tile, timber, stone and shutter PBR channels gain subtle weathering/roughness variation. Roof colors vary through vertex colors, sharing materials and textures. Glass gloss is reduced. No external texture, model, business identity, logo or proprietary Hey Auto content was used.
- Procedural frontages provide small paved entrances, low compound-wall/fence segments and gateposts with an open central gate gap. They are illustrative, not surveyed property boundaries. At most 24 eligible lots are generated within 170 m of the loaded focus. Entire proposed lots are rejected if they overlap expanded road/shoulder/junction geometry, any building, mapped water including stream width, another frontage, map bounds, or an 8 m pickup/drop-off protection zone. Steep/nonplanar terrain parts are omitted. Solid frontage parts participate in world obstruction checks used by walking and vehicle movement.
- Existing Phase 05 drains, road shoulders and utility poles remain. No dense roadside clutter or new vegetation was added. Observed source windows generated 10 town lots, two residential lots and zero rural lots where candidates failed clearance.
- All parts merge into existing chunk/material batches. No individual-building mesh hierarchy, heavyweight downloaded asset, new dependency or additional texture atlas is introduced. A 6 m near/far hysteresis band reduces LOD threshold chatter while preserving exclusive facade rendering. Existing streaming caps, culling and disposal are retained.

## The 34 withheld buildings

`python3 scripts/audit_phase06.py` checks the exact 34 IDs from Phase 04 against current district footprints, original `map.osm` nodes and current road geometry. Maximum coordinate error is **0.000690 m**, consistent with millimetre tile rounding. No projection/mesh translation error was found. The default world is flat; changing elevation cannot resolve these horizontal overlaps without invented grade separation.

**Restored: 0. Unresolved and safely withheld: 34.** Two source centerlines cross a footprint; 32 have a current width/clearance overlap. Conflicting road evidence includes 30 estimated-width and six lane-derived segment/way encounters; no surveyed width supports narrowing these roads. Resolving these safely requires verified source/width updates, not moving buildings or deleting roads. The 311 district exclusions are unchanged. The generated JSON contains exact polygons, road IDs, width provenance and clearance for every audited footprint. The top-down screenshot is explicitly an inspection view with red source polygons, fog/HUD disabled, and extended local chunk visibility, not normal gameplay or restored buildings.

| OSM footprint | Diagnosis | Most constrained source road | Width evidence | Clearance (m) |
| --- | --- | --- | --- | --- |
| 378584865 | road width/clearance overlaps footprint | 589906752 (residential) | 5 m / estimate | -0.976 |
| 378587276 | road width/clearance overlaps footprint | 478393075 (tertiary) | 6 m / estimate | -0.443 |
| 736701784 | road width/clearance overlaps footprint | 963213397 (unclassified) | 4.5 m / estimate | -1.887 |
| 746518430 | road width/clearance overlaps footprint | 466132573 (residential) | 5 m / estimate | -0.974 |
| 746518442 | road width/clearance overlaps footprint | 478393076 (tertiary) | 6 m / estimate | -1.44 |
| 746518443 | road width/clearance overlaps footprint | 478393076 (tertiary) | 6 m / estimate | -0.776 |
| 746518446 | road width/clearance overlaps footprint | 749845467 (secondary) | 6.4 m / lanes | -1.491 |
| 746518448 | road width/clearance overlaps footprint | 749845467 (secondary) | 6.4 m / lanes | -0.609 |
| 746518461 | road width/clearance overlaps footprint | 1078412540 (residential) | 5 m / estimate | -1.979 |
| 746518470 | road width/clearance overlaps footprint | 963213397 (unclassified) | 4.5 m / estimate | -0.393 |
| 746518471 | road width/clearance overlaps footprint | 963213397 (unclassified) | 4.5 m / estimate | -0.833 |
| 749798218 | road width/clearance overlaps footprint | 1501456359 (tertiary) | 6 m / estimate | -0.623 |
| 749798219 | road width/clearance overlaps footprint | 381689700 (primary) | 6.4 m / lanes | -0.706 |
| 749798255 | road width/clearance overlaps footprint | 963213397 (unclassified) | 4.5 m / estimate | -1.172 |
| 824720111 | road width/clearance overlaps footprint | 821539864 (secondary) | 6.4 m / lanes | -1.103 |
| 827600182 | road width/clearance overlaps footprint | 1269301801 (secondary) | 7 m / estimate | -2.334 |
| 830296355 | road width/clearance overlaps footprint | 478393076 (tertiary) | 6 m / estimate | -2.708 |
| 830320913 | road width/clearance overlaps footprint | 1501456359 (tertiary) | 6 m / estimate | -1.641 |
| 830324993 | road width/clearance overlaps footprint | 589906752 (residential) | 5 m / estimate | -1.387 |
| 855393145 | road width/clearance overlaps footprint | 1216174749 (residential) | 5 m / estimate | -1.634 |
| 855393146 | road width/clearance overlaps footprint | 1216174749 (residential) | 5 m / estimate | -0.576 |
| 891592468 | road width/clearance overlaps footprint | 817129714 (residential) | 5 m / estimate | -0.859 |
| 891667290 | road width/clearance overlaps footprint | 466132573 (residential) | 5 m / estimate | -0.953 |
| 891785628 | centerline intersects footprint | 831685914 (secondary) | 7 m / estimate | -3.9 |
| 891785920 | road width/clearance overlaps footprint | 891786062 (unclassified) | 4.5 m / estimate | -0.869 |
| 891804112 | road width/clearance overlaps footprint | 831685914 (secondary) | 7 m / estimate | -2.682 |
| 891804516 | centerline intersects footprint | 831685914 (secondary) | 7 m / estimate | -3.9 |
| 891963240 | road width/clearance overlaps footprint | 817129714 (residential) | 5 m / estimate | -0.706 |
| 891965947 | road width/clearance overlaps footprint | 817129714 (residential) | 5 m / estimate | -0.804 |
| 961959344 | road width/clearance overlaps footprint | 381689700 (primary) | 6.4 m / lanes | -1.613 |
| 961968570 | road width/clearance overlaps footprint | 589906752 (residential) | 5 m / estimate | -1.534 |
| 961971232 | road width/clearance overlaps footprint | 589906752 (residential) | 5 m / estimate | -0.959 |
| 996834571 | road width/clearance overlaps footprint | 381689700 (primary) | 6.4 m / lanes | -1.791 |
| 1096228153 | road width/clearance overlaps footprint | 1216174748 (residential) | 5 m / estimate | -0.719 |


## Validation, profiling and screenshots

- Full unit suite after the final visual correction: **95/95 passed**.
- Full development-browser regression suite: **37/37 passed** in 9.9 minutes. Matched-image review then caught an inferred-storey threshold regression; the floor calculation was corrected and a focused regression test added. Final-source browser reruns for architecture/walking/LOD, Phase 04/05 road integration, and Phase 06 streaming/HUD: **3/3 passed** in 45.5 seconds. No existing test was removed or disabled.
- Final production build, TypeScript checking and all map/source/network validators: **passed**. Bundle: **686.18 kB minified / 195.64 kB gzip**, versus integration baseline 681.96 / 193.95 kB. The existing >500 kB Vite advisory remains.
- Final local compiled-build browser checks: **7/7 passed** in 2.6 minutes, including all packaged-asset checks, four legacy/default URL entry points, driving/save/reload, walking and fleet continuation.
- `git diff --check`: passed. Credential-pattern scan of the candidate implementation/test/documentation files found zero matches. Explicit staging excludes all generated evidence, logs, dependencies and build output.

Final architectural walking/quality proof: medium/high **107 draw calls, 46,384 triangles**; low **74 calls, 34,303 triangles**; nine resident tiles, complementary near/far LOD, PBR channels and correct plaster shadow side. These are representative views, not whole-district or device FPS guarantees.

| View | Calls before → after | Triangles before → after | Mean frame ms before → after | Final geometry MiB |
| --- | --- | --- | --- | --- |
| town | 94 → 98 | 72,433 → 73,121 | 391.7 → 395.1 | 104.5 |
| residential | 103 → 104 | 18,982 → 19,350 | 211.0 → 205.7 | 115.0 |
| rural | 113 → 119 | 51,600 → 52,588 | 281.4 → 284.8 | 134.0 |
| junction | 101 → 101 | 42,282 → 42,394 | 299.6 → 295.8 | 134.0 |
| wide | 227 → 227 | 64,682 → 64,098 | 299.2 → 297.3 | 134.0 |
| driving | 92 → 92 | 62,668 → 63,568 | 242.4 → 228.8 | 134.0 |

These isolated Chromium/SwiftShader measurements sample 44 frame intervals per view at medium quality with comparison traffic frozen. The matched camera is applied before world culling and rendering, streaming is settled, and counters are sampled after frame profiling. Resident geometry is summed attribute/index typed-array payload, an estimate of buffer storage, not total process/GPU memory. Final texture RGBA/mipmap estimates are approximately 6.13 MiB and exclude render targets/shadows/driver overhead. Geometry payload rises by about 0.4–0.9 MiB across the source windows; geometry remains batched and resident tiles remain capped at nine. The software-renderer frame times are slow even at baseline; native desktop and mobile FPS remain unverified. CPU geometry generation on tile refresh remains a performance risk. No stable-FPS claim is made from one short software-renderer sample. The driving screenshots are pixel-identical controls with no changed facade in their view; the other five paired views show actual rendered differences.

Reproduce with `npm test`, `EN3D_TEST_PORT=5196 npm run test:browser`, `npm run build`, and `npm run test:production`. Browser tests use local Chromium/SwiftShader. Production checks exercise the locally served compiled build; they do not deploy it. Additional new tests cover deterministic categories/variants, unchanged OSM hashes, original-node projection, retained office tags, withholding, frontage road/water/building/mission clearance and collision, bounded streaming and HUD survival. Existing gameplay, save-compatibility, terrain, resource-disposal and complementary-LOD tests remain enabled.

Capture scripts are local-only instrumentation: `scripts/capture_phase06.mjs before|after` and `scripts/capture_phase06_conflicts.mjs`. BEFORE uses the unchanged integration worktree served locally on port 5197; AFTER uses this branch on 5196. Six paired views use identical saved world/car poses, camera positions/quaternions/FOV, static lighting and 1280×800 viewport at device scale .75, medium quality. Ambient traffic is frozen only in the comparison harness; shipped density is unchanged. PNGs and machine-readable camera/metrics evidence are untracked and excluded from the implementation commit. See [before metrics](evidence/phase06/before-metrics.json), [after metrics](evidence/phase06/after-metrics.json), [camera verification](evidence/phase06/comparison-verification.json), and [per-footprint audit](evidence/phase06/building-conflicts.json). Logs are retained beside the images.

| View | Before | After |
| --- | --- | --- |
| Town/commercial | [before](evidence/phase06/town-before.png) | [after](evidence/phase06/town-after.png) |
| Residential | [before](evidence/phase06/residential-before.png) | [after](evidence/phase06/residential-after.png) |
| Rural road/houses | [before](evidence/phase06/rural-before.png) | [after](evidence/phase06/rural-after.png) |
| Junction | [before](evidence/phase06/junction-before.png) | [after](evidence/phase06/junction-after.png) |
| Distant density/LOD | [before](evidence/phase06/wide-before.png) | [after](evidence/phase06/wide-after.png) |
| Driving/mission HUD | [before](evidence/phase06/driving-before.png) | [after](evidence/phase06/driving-after.png) |

[34-footprint inspection overview](evidence/phase06/withheld-34-overview.png). These files remain in this workspace and are not part of the local code commit.

## Files, licensing and limits

Runtime changes: `src/architecture.ts`, `src/architecture-materials.ts`, `src/building-frontage.ts`, `src/osm-world.ts`. Extraction: `scripts/world_features.py`, 25 tag-only district tile payloads, `public/maps/district/manifest.json`, `data/DISTRICT_PROVENANCE.json`. Tests: architecture additions, `tests/building-frontage.test.ts`, `tests/phase06-geography.test.ts`, `tests/phase06.spec.ts`. Reproducible audit/capture utilities and this report are included.

Application code and original procedural texture work follow the repository MIT license. OSM-derived databases remain ODbL 1.0 with the existing contributor notice and attribution. Existing dependencies/assets are retained without license changes; no third-party asset acquisition occurred.

This is a procedural regional improvement, not a photogrammetric reconstruction. Sparse mapped areas stay sparse. Exact facade style, entrance orientation, property lines, building identity and untagged height remain uncertain. Far LOD simplifies recesses and frontage detail still uses distance culling; hysteresis does not eliminate source-window loading delay or every visual transition. No physical mobile device was tested, so **mobile FPS is unverified**. Frame measurements on software Chromium describe this environment, not native-GPU performance or a target-device guarantee. Vegetation diversity, terrain/environment richness and further landscaping remain deferred to separately approved Phase 07. Geographic conflict fixes and traffic signals also require their own verified scope.
