# Phase 04 — Kottakkal Map Foundation

Implemented on 28 October 2026 in the existing EN 3D game. This is the approved map-foundation increment, distinct from the older numbered traffic/landmark queue in ROADMAP.md. No merge, push, publication or deployment was performed. Stop for review before further phases.

## Geographic verification

Read the available Phase 1 checkpoint in PROGRESS.md, the Phase 02 reference report and Phase 03 research report. Inspected every supplied map dataset discovered in the workspace: the source XML, three uploaded XML fragments as one reconstructed document, and both public/build copies of the derived JSON. No external map, imagery or elevation service was needed.

| Dataset | Actual geographic extent | Decision |
| --- | --- | --- |
| `map.osm`, 54,513 nodes | 10.7651111–11.4436553°N, 75.8818387–76.1033108°E | Retain as source; verified bus-station way 378587276 and its Kottakkal name/type/coordinates. Import only the bounded local geometry. |
| Reconstructed `export.osm.part01`–`part03`, 534,348 nodes | 10.6269746–11.525987°N, 75.8256662–76.7019365°E | Reject as a replacement for the active Kottakkal map: it lacks the required anchor. It is regional Kerala data, not proven to be an entirely wrong region; bounding-box overlap alone is insufficient to establish local identity/completeness. Uploads remain untouched. |
| `public/maps/kottakkal.json` and `dist/maps/kottakkal.json` | 10.9957634176–11.0074545824°N, 75.9987541351–76.0106641849°E | Retain. Both are the same ±650 m derivative around the verified origin. |

The XML's declared query bounds are narrower than the actual referenced-node bounds; complete ways can include distant referenced nodes. The audit records both instead of silently treating the query rectangle as the data extent. See [dataset-audit.json](research/phase04/dataset-audit.json), including exact paths, hashes and decisions.

The stable world origin remains **11.001609°N, 76.00470916°E**, east +X / north −Z, in metres using the existing local projection. Changing it would invalidate saved rides and mission coordinates without improving this small map's accuracy. The improvement is explicit forward/inverse coordinate functions, validation of origin/scale/bounds, consistent shared-node positions, and rejection of misplaced/corrupt maps before world creation or gameplay-save writes.

Build/startup validation now also regenerates the expected derivative in memory and compares it against the supplied source/settings. A matching source-hash field alone no longer allows altered derived geometry through `map:check`. Production imports reject a displaced origin even if a generic fixture import uses explicit coordinates.

## Implemented foundation

- Replaced round caps/discs at every road vertex with **1,090 surface patches, including 517 bounded bevel joins**. Strips and junctions derive from existing ordered source nodes. Matching world-space UVs remove per-strip texture restarts. Segment and join edges clip to the map bounds without shifting centerlines or fabricating connections.
- Road rendering and road-surface queries now use the **same polygons**, with a 32 m spatial index. This replaces the mismatch between drawn strip/disc geometry and wider capsule-based surface checks. Actual rendered-triangle raycasts verify coverage at every imported segment midpoint; additional polygon tests sample endpoints and quarter points.
- Shared-node joins connect the visible road surface at bends/intersections. Paint is phased along each way and kept away from shared-node junction areas. Paint remains authored guidance, not surveyed lane markings. Geometric crossings without shared IDs still gain no routing connection.
- Kept a single **flat ground datum at Y=0**, with road surface at Y=0.004 m and paint at Y=0.006 m. These tiny render offsets are not terrain elevation. The rickshaw's tire baseline now matches the real-map surface instead of the previous fixed Y=0.08 offset; practice-mode positioning remains unchanged. Water is below asphalt, so flat bridge crossings do not get painted over by stream surfaces.
- Added material depth offsets to keep nearly flush roads visible against the ground. Screenshot inspection exposed depth-buffer artifacts in an intermediate version; a GPU readback test now checks real asphalt geometry over ground from a 180 m overhead camera. This avoids raising roads visibly to hide depth artifacts.
- Resolved visible road/building penetration conservatively: **169 building models remain rendered; 34 conflicting approximate models are withheld**. The check includes edge crossings and containment, not just building centroids. Affected render/collision models are omitted together; no footprint is moved, resized, carved, or deleted from the source database. This includes the approximate bus-stand shed extrusion. Its source POI/label and all map data remain. Each affected ID is recorded in [foundation-audit.json](research/phase04/foundation-audit.json), pending source-width/building-use verification. This is conflict containment, not a claim that those buildings do not exist.
- Classified **31 clipped map exits** separately from **18 degree-one retained source endpoints**. Clipped exits now display “PLAYABLE MAP BOUNDARY — Source road continues beyond this extract.” Butt caps no longer suggest round cul-de-sacs or extend roads past their source ends. Labels describe the game boundary, not actual traffic signs. Existing map-edge collision continues to constrain play.
- Increased label-chunk bounds to include the label geometry so labels are not culled too early. Shared geometry/material batching, distance/detail culling and Battery saver remain in place. No dependency was added.

The retained road graph has nine weakly connected components (524, 16, 9, 5, 3, 3, 2, 2 and 2 nodes). They remain source-separated; closing apparent gaps without source evidence would create incorrect geography. The existing bus-stand-to-hospital road-stop fare remains connected and returnable, at the same coordinates. This phase improves surface continuity and rejects inconsistent topology; it does not claim to make the entire retained road network one connected component.

## Before-and-after screenshots

These are real local Chromium captures. Before images were captured before application edits; after images use the same capture procedure, map, empty gameplay save, Battery saver, 1280×800 viewport and 0.75 device scale. No image generation, compositing, or proprietary assets were used. The two overhead views override only the camera and disable fog through a test response; the normal driving image uses the game's camera. UI/toast animation timing can differ slightly.

| View | Before | After |
| --- | --- | --- |
| Bus-stand area, camera (15, 180, 20) looking down: visible source-road corridor without the conflicting large shed extrusion | [![Before bus stand](research/phase04/before-bus-stand.png)](research/phase04/before-bus-stand.png) | [![After bus stand](research/phase04/after-bus-stand.png)](research/phase04/after-bus-stand.png) |
| Junction, camera (110, 125, 65) looking down: bevel joins and roadside model clearance | [![Before junction](research/phase04/before-junction.png)](research/phase04/before-junction.png) | [![After junction](research/phase04/after-junction.png)](research/phase04/after-junction.png) |
| Playable spawn: same ride and road, with the tire baseline aligned | [![Before driving](research/phase04/before-drive.png)](research/phase04/before-drive.png) | [![After driving](research/phase04/after-drive.png)](research/phase04/after-drive.png) |

The overhead views show some billboard labels edge-on; these thin light strips are labels, not road geometry. This increment is a foundation correction, not a scenery-density or photorealism upgrade.

| Matched Battery saver view | Before draw calls / triangles | After draw calls / triangles |
| --- | --- | --- |
| Spawn driving | 102 / 6,990 | 100 / 6,149 |
| Bus-stand overhead | 107 / 7,492 | 107 / 6,485 |
| Junction overhead | 105 / 7,327 | 103 / 6,336 |

Saved samples: [before](research/phase04/before-render-cost.json), [after](research/phase04/after-render-cost.json). Spawn triangles decreased about 12%; the reduction includes both simpler joins and withheld conflicting models. The browser's landscape-mobile sample was 103 calls / 6,183 triangles. These are scene-cost measurements from software Chromium, not physical-phone FPS or memory benchmarks. The chunk count remains 82; this work does not introduce asynchronous world streaming.

## Validation

- `npm test`: **34 tests passed**. Includes existing gameplay/save tests, reproducible import, source node order/coordinates, wrong-location rejection, projection round-trips, invalid bounds/shared-node rejection, true/false junction fixtures, boundary clipping, building-edge conflicts, surface coverage, real rendered triangles, flat datum, label classification and resource disposal.
- `npm run build`: **passed** strict TypeScript, verified source/derivative check and production build. Main JS is 583.33 kB minified / 157.86 kB gzip; the existing >500 kB bundle advisory remains.
- Chromium browser coverage: practice driving/braking/reversing/horn/pause/reset, pickup/delivery/reload, tea/wallet, landscape/portrait controls, legacy saves, camera/render budgets; real-map driving, attribution, mode-switch save preservation, mission/wallet, failed-map recovery, wrong-location rejection without save changes, tire baseline and GPU road-over-ground coverage.
- `npm run test:browser`: **all 10 tests passed** in the final complete run (1.5 minutes). The first browser pass exposed a test expectation for an undisplayed internal validation reason. The product now presents a clear rejected-map message and safe practice fallback. The final run includes the GPU depth readback assertion added after screenshot inspection.
- All three before/after pairs were visually inspected. `git diff --check` passes. Source/map hashes remain unchanged. No physical Android/iPhone testing or long-session GPU-memory profiling is claimed.

## Files changed

The local source commit excludes generated screenshots, JSON evidence and regenerated provenance. Those files remain available in this workspace for review; links below to generated evidence refer to local artifacts. The audit/capture/import scripts are included so evidence can be regenerated.

| File | Purpose |
| --- | --- |
| `src/map-coordinates.ts` (new) | Forward/inverse local coordinates and runtime geographic/geometry guard. |
| `src/road-foundation.ts` (new) | Clipped road patches, bounded bevel joins, endpoint classification, surface tests, building-conflict detection and junction-aware paint. |
| `src/osm-world.ts` | Consume the shared surface; spatial clearance filtering, flat datum/depth handling, water ordering, endpoint labels, label culling bounds and review statistics. |
| `src/main.ts` | Reject invalid map data, align real-mode tires and show a safe rejected-map fallback. |
| `scripts/map_geography.py` (new) | Source-coordinate bounds and verified Kottakkal anchor checks. |
| `scripts/audit_map_datasets.py` (new) | Read-only source/upload/derivative geographic inventory. |
| `scripts/import_osm.py`, `scripts/check_map.py` | Geographic identity and production-origin guards, actual-node provenance and deterministic derived-geometry validation. |
| `scripts/capture_map_foundation.cjs` (new) | Reproducible local screenshot comparisons; instrumentation is not shipped in the game. |
| `data/OSM_PROVENANCE.json` | Adds actual source-node bounds; retains original declared bounds. |
| `tests/map-foundation.test.ts` (new), `tests/osm-import.test.ts`, `tests/osm-navigation.test.ts`, `tests/osm-browser.spec.ts` | Geographic, geometric, gameplay and GPU regression coverage. |
| `.gitignore` | Ignore generated Python bytecode caches. |
| `DATA_LICENSES.md`, `PROGRESS.md`, this report and `research/phase04/` | Document the verified bounds, render-only omissions, implementation, validation and screenshots. |

The untracked Phase 02/03 reports and Phase 03 research evidence present at task start are preserved. No changes were made to package manifests/lockfiles, the raw source XML, derived map JSON, save schema, practice world, input, vehicle model or wallet/mission logic.

## Preview and review boundary

```sh
cd /workspace/drive-game
npm run dev -- --port 5173
# Open http://localhost:5173/?world=osm
# Original practice area: http://localhost:5173/?world=practice
```

For a new comparison capture against an already running Vite server: `node scripts/capture_map_foundation.cjs after`. The `before` label is only appropriate when serving the pre-change source; running it on current code does not recreate the historical baseline. Preserve the supplied images when making new comparisons.

The raw XML SHA-256 remains `d7ef65eeb57978269dcbb2404fe32120f93e42f795bbb0ef96c1bb08f49d4add`; the derived JSON remains `87704620c3270876026d58e24fc73ca481d92cbb3b3bac8791dce2f425ce6dbc`. Origin, source IDs, all 68 road parts/641 road vertices, 203 footprints, 107 POIs, water features and source tags remain intact. ODbL attribution remains visible and the data remains separate from MIT application code.

Remaining limits: source widths/heights and façades are not locally surveyed; 34 withheld models need source/use verification; retained source endpoints may reflect filtering or incomplete mapping; no missing streets are invented. Two mapped bridges/layers remain flat because no verified elevation or grade-separated physics exists. This phase does not certify surveyed road-to-terrain elevation, real entrances, current traffic restrictions, complete geographic coverage or phone frame rates.

**Phase 04 stops here for review. No further phase, merge or deployment is authorized by this completion.**
