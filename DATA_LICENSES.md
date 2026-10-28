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

## Additional uploaded road export

`export.osm` and `public/maps/malappuram/` are an additional OpenStreetMap source and adapted road database, also offered under ODbL1.0 with © OpenStreetMap contributors attribution. The source was reconstructed by binary concatenation of three user uploads, without changing bytes. SHA-256: `7915b6d48899723c3dd4a88dfd8c3db64d77e0e85e60d9e99511c2bb6b7ac3f2`. See ROAD_EXPORT.md, `data/EXPORT_PROVENANCE.json`, `scripts/import_export_roads.py` and the publicly distributed `maps/malappuram/NOTICE.txt`. The prior `map.osm` database is preserved with its own provenance. Only an initial 4.8km window is playable; no district completeness, real building positions in the road-only mode, elevation or current legal traffic status is claimed.

## Elevation prototype (no dataset shipped yet)

The optional HGT importer targets the public Mapzen/Tilezen composite archive. Download is currently proxy-blocked; no real or synthetic DEM is distributed with this checkpoint. See TERRAIN_PROTOTYPE.md for the exact candidate URL, public-domain USGS global source credits, source/license documentation and remaining contributor/datum verification. A later successful import records checksums, source URL and attribution separately; runtime displays its dataset credit alongside OSM attribution. Do not describe all composite elevation sources as MIT, Apache, or pure SRTM.

## Unified district derivative

`public/maps/district/` combines the verified road selection from `export.osm` with reprojected prior Kottakkal footprints, landmarks, water and place nodes from `map.osm`. It is distributed under ODbL1.0 with ©OpenStreetMap contributors attribution; both original source XML files and earlier derivatives remain available in this repository. Reproduce with `scripts/import_district.py`; checksums/projections and retained source identities are in `data/DISTRICT_PROVENANCE.json` and the public manifest. The runtime now retains all eligible motor-road ways from the uploaded regional extract, plus supported full `map.osm` auxiliary features. It is not a verified district/state boundary or completeness claim; see NETWORK_RESTORATION.md and data/WORLD_AUDIT.json. Cafe gameplay stops, roof/material choices and estimated building heights are explicit authored approximations.

## Traffic control derivative and original traffic artwork

`public/maps/district/traffic-controls.json` derives source-tagged signal/crossing nodes from unchanged `export.osm` and is distributed under ODbL1.0 with ©OpenStreetMap contributors attribution. Source IDs/tags, geographic projection and source checksum are retained; reproduce/check with `scripts/import_traffic_controls.py`. Signal timing, curb offsets and stripe widths are explicitly authored game approximations, not surveyed/live traffic data.

Traffic meshes, canvas bus lettering and Web Audio waveforms/noise/envelopes are original MIT-licensed procedural work. The compact hatchback source is reused unchanged from the earlier project draft. No paid assets, copied logos, photographic vehicle textures or third-party recordings are used. Synthesized sounds are not authentic recordings. See TRAFFIC.md for the exact implemented categories and remaining limitations.
