# OpenStreetMap data license and attribution

**© OpenStreetMap contributors** — https://www.openstreetmap.org/copyright

The uploaded `map.osm` and the derived database `public/maps/kottakkal.json` are OpenStreetMap data, distributed under the **Open Data Commons Open Database License (ODbL) 1.0**:
https://opendatacommons.org/licenses/odbl/1-0/

The derived database is offered under that same ODbL license, including its attribution and share-alike terms. This data license is separate from the repository's MIT application code and original generated art. Do not remove the visible contributor attribution from the real-map mode when publishing the game. Do not describe the map database as MIT licensed.

## Source and reproducibility

- Input: `map.osm`, uploaded on GitHub in commit `292f3b8b61b0003f9ae1db3f52b8baa0b139e5a5`.
- Input SHA-256: `d7ef65eeb57978269dcbb2404fe32120f93e42f795bbb0ef96c1bb08f49d4add`.
- The complete uploaded XML remains in the repository unchanged, with its original OSM metadata/attribution/license declaration. The upload does not establish when the entire dataset was retrieved; OSM object timestamps are per-object edits, not a single extraction date.
- Adaptation: bounded motor-road selection, clipping, metre projection, source-footprint/POI extraction, source-node graph, and explicit rendering estimates. See `scripts/import_osm.py` and `data/OSM_PROVENANCE.json` for the exact transformation, projection, source identities, diagnostics and limitations.
- Reproduce with `npm run map:import` (Python 3 standard library). The generated database is committed and also publicly served at `maps/kottakkal.json`; the nearby `maps/NOTICE.txt` supplies attribution and license links. Source and adaptation tools are distributed in this repository, so recipients can access and reproduce the adapted database.

## Accuracy limits

Coordinates and retained source node/way identities derive from this supplied snapshot. Road widths without tags and every building height in this slice are estimates. Representative points of polygon landmarks are source-derived centroids, not verified entrances. Complex multipolygon relations and unsupported/invalid/boundary-crossing footprints are skipped rather than fabricated; diagnostics are recorded. Bridges/layers are retained as data, but this first playable slice is rendered flat and does not assert surveyed elevation or grade-separated vehicle physics. Rendered windows, roof finishes and neutral road guidance paint are authored artwork, not imagery or a lane survey.

One-way and numeric speed tags describe the uploaded data; they are not a statement of present traffic law. No signal locations are invented: this input has no traffic-signal nodes. Traffic fines, signal simulation and enforcement are not implemented by this map increment.

## Phase 04 rendering clearance

The source XML and derived JSON remain unchanged. The renderer withholds 34 approximate building models whose footprints intersect estimated road surface patches; their source geometry and identities remain available in the database. This is a conservative rendering conflict decision, not evidence that those structures are absent. See PHASE_04_MAP_FOUNDATION.md and research/phase04/foundation-audit.json. Road/ground rendering remains flat; depth-buffer offsets do not represent surveyed terrain or bridge heights. Playable-boundary labels are game annotations, not source traffic signs. Source provenance now records actual referenced-node bounds separately from the XML's declared query bounds.

## Phase 05 road presentation

Road materials and small textures are original generated artwork. Surface tags select concrete/gravel where supported; unknown/unsupported tags use a neutral fallback without changing source data. Existing carriageway widths, coordinates and graph remain unchanged. Shoulders, repair patches, drainage edges and covers are authored visual approximations, not mapped or surveyed infrastructure. Centre markings are conservative gameplay artwork restricted by class, width, direction and lane information; they do not assert actual legal road markings. Decoration is excluded from source building footprints and mapped water. See PHASE_05_REALISTIC_KERALA_ROADS.md and research/phase05/road-style-audit.json.
