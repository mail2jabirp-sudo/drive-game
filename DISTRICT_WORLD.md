> Historical 36 km checkpoint. Superseded by the [uploaded-network restoration](NETWORK_RESTORATION.md); the older selection described below remains documented for provenance.

# One unified Malappuram District world

## This increment

The sole runtime world is `public/maps/district/`. Its shared projection has origin **11.0544807N, 76.0863541E**, earth radius 6371008.8m, x east and z south. The window is ±18,000m on both axes, approximately **10.892603–11.216358N / 75.921416–76.251292E**. It is a square selection from available source roads, not a district administrative polygon. No full district claim is made.

The expanded selection retains **19,225 source motor-road ways / 32,131 clipped fragments / 303,581 vertices**, including 292 one-way source ways, in **3,535 600m tiles**. Road geometry/curves, source-node graph connections and source directions are preserved. Parts of named highways and local routes are present, not necessarily their entire lengths. An automated directed graph check verifies a path from the Malappuram origin to real roads near the verified Kottakkal place node and a return path, obeying one-way tags. No invented roads bridge data gaps.

Kottakkal is no longer a separate map. All **203** existing building footprints, **107** mapped landmarks and **4** mapped water features from its prior slice are reprojected into this frame and streamed with nearby roads. Their original source database remains intact. Heights and models remain approximate; no new surveyed architecture or terrain is claimed. All 68 earlier road fragments' source ways are already represented in the expanded road selection, so duplicate parallel roads are not added.

There are 21 source-verified place nodes from `map.osm`; available Malayalam tags are retained. Labels display when nearby/in minimap view, not as geographically false shortcuts to distant towns. Kottakkal, Changuvetty, Edarikkod, Othukungal and other supplied local places are included. Named roads toward Manjeri, Tirur, Vengara or other towns do not by themselves establish a town centre or complete urban coverage. Ponnani, Nilambur, Perinthalmanna and all requested settlements still need individual geographic/coverage verification and further extracts where absent. Do not imply the 36km square contains every requested town.

## Assets and saves

`map.osm` and `export.osm` retain their original hashes; `public/maps/kottakkal.json` and the 64 earlier Malappuram tiles are unchanged. No old application/vehicle/control/mission/landscape modules or original source assets are deleted. The importer accepts a larger extent as an optional argument, preserving byte-identical default output for the earlier map.

No query parameter or saved area preference selects another world. The selector and Change driving area button are removed, including stale welcome metadata. Loading failure offers a retry of the same district. Source assets can remain accessible on the static server without being playable alternate modes.

The original save key and wallet/trip/tea counters are retained. The old base practice pose and `osmRide` remain archived. Existing export coordinates share the district projection and source identity. Old Kottakkal coordinates convert through their original latitude/longitude projection into district coordinates; invalid/unmapped positions fall back to the known starting road without deleting their original archive. Passengers remain aboard. New progress is saved under the existing export ride field. District-sized coordinates no longer fail the prior 10km ride parser limit.

The ₹10 tea mechanic is reused at an authored stopping point on a verified road near a source-tagged cafe. `teaStop.source` records both sources; this does not claim an entrance, current menu or parking facility. The stop is deliberately not fabricated at the former practice-loop coordinates.

## Streaming and limits

The manifest is about 544KB uncompressed; all district tiles total about 21.7MB uncompressed **on the server**. Runtime loads at most nine nearby tiles, checks SHA-256, reuses resident tiles, and disposes old geometry/materials/textures after replacement. Road and existing Kottakkal feature chunks are distance culled. A failed request keeps the previous window and blocks unloaded movement. The camera's building collider cache updates when streamed geometry changes. Flat ground uses a nearby 2.4km patch rather than a giant district plane, preventing depth precision from hiding distant road surfaces.

The existing ground remains flat, and road widths without tags, shoulders and paint are estimates/artwork. The prior DEM host was blocked by proxy CONNECT403. The expanded window crosses 11N and 76E, requiring at least HGT cells N10E075, N10E076, N11E075 and N11E076, or an equivalent verified licensed mosaic. The retained single-tile importer is a historical small prototype, not working district terrain. No synthetic DEM is shipped. Bridges/tunnels do not yet have verified deck heights.

Mapped signals/crossings in the export are not yet functional simulation. New building/landuse/water extraction beyond the reused Kottakkal slice, fields/vegetation, terrain smoothing, AI vehicles, pedestrians, fines and extra bilingual places remain future source-backed increments. Do not invent these to fill missing data. Real-device FPS, long drives and memory profiling remain acceptance work; headless rendering budgets are not device FPS.

## Release checks

Run `npm run build`, `npm test`, `npm run test:browser` and `npm run test:production`. Browser coverage includes sole-world default and old links, legacy wallet/passenger preservation, Kottakkal reprojected saves/features/labels, driving/mobile controls, tea, fares, streaming without document navigation and failure retry. Unit checks reproduce all new/archived tiles and verify directed geographic connectivity. Production tests check every published asset plus default and all legacy URLs entering the same district.

Sources are the unchanged uploaded OSM snapshots; no additional external geographic download was needed for this road expansion. OSM databases remain ODbL1.0 with visible attribution. Deployment uses the existing Vercel Vite configuration (`npm run build`, `dist`). Hosted functionality may only be claimed after testing the actual deployment URL; a Vercel success status alone is insufficient.
