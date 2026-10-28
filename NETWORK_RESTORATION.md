# Uploaded road-network restoration

EN 3D — എന്റെ നാട് · Kerala Open World Simulator

This increment fixes the existing geographic pipeline. It does not replace the game or claim a complete district/state, realistic terrain, surveyed buildings or a finished implementation of every requested phase.

## Root causes and verified coverage

The road exporter explicitly clipped eligible ways to **±18,000 m** around the existing Malappuram Bypass origin. The uploaded XML contains a much larger region. The old **3,535-tile** selection integrated **19,225** eligible source ways; **20,381** ways were not wholly inside that window, including **20,048** with no vertices inside it. This was a deliberate importer boundary, rather than proof that the source itself ended there.

The auxiliary pipeline independently reused only the old 650 m Kottakkal slice: **203 footprints / 107 POIs / 4 water features**. The original `map.osm` has many more usable features. Road-only parts of `export.osm` have no building, water or land-use ways; expanding those road tiles cannot supply missing environmental data.

| Source | Actual verified geographic coverage |
|---|---|
| `export.osm`, all source nodes | 10.6269746–11.5259870° N; 75.8256662–76.7019365° E |
| Eligible motor-road vertices | 10.6269746–11.4861819° N; 75.8256662–76.4768593° E |
| `map.osm`, building footprints | approximately 10.983188–11.035052° N; 75.955700–76.071501° E |
| `map.osm`, water features | approximately 10.973581–11.059710° N; 75.917218–76.089210° E |

The motor-road footprint spans about **95.5 km north–south / 71.1 km east–west**. Its container bounds are ±49,200 m with a safety margin; this **does not mean every location in a 98.4 km square is mapped or connected**. An administrative district/state boundary has not been validated. Tracks, footpaths, construction and other unsupported non-motor classes are not silently promoted to vehicle roads; 257 explicitly private/prohibited motor ways are excluded.

Full source inventory and previous/current bounds: [WORLD_AUDIT.json](data/WORLD_AUDIT.json). Both original XML checksums and all earlier source/derivative archives remain unchanged.

## Working pipeline and world

- **39,273 eligible source ways / 67,195 tile fragments / 601,564 vertices / 8,315 tiles**. Approximately **13,566.466 km** of OSM way centre lines, including separate mapped carriageways; not a count of unique named physical roads or a district completeness measure. There are 1,872 distinct source road-name strings.
- All eligible uploaded road geometry fits within the new bounds. The projection/origin is unchanged: x east, z south, metres around 11.0544807° N / 76.0863541° E. Old saved poses, fleet IDs and wallet schema remain valid.
- Original OSM node identities and deterministic clip endpoints preserve junctions and seams. **Zero shared-node coordinate conflicts**. **182 weak components** in both original eligible roads and packed output; separate source components are retained without invented links. From the source Malappuram Bypass node, 491,207 original nodes have a directed round trip (518,815 including generated seam endpoints). This is topology verification, not an hour-long driving test of every route.
- Existing left-side AI, source one-way tags, road curves and rounded render joins remain. Explicit width/lane tags take priority; missing widths use reviewed class defaults in [ROAD_WIDTH_DEFAULTS.json](data/ROAD_WIDTH_DEFAULTS.json). Link/local/service roads retain narrower widths. Shoulders and painted lanes remain approximate artwork, not surveyed dimensions.
- At most **nine 600 m tiles** are resident. A one-tile surrounding window loads ahead as the player moves; data is checksum-verified, distant geometry disposed and failed downloads retain the previous playable window. The approximately **50.5 MB** of tile payloads stays on the server, not in a simultaneous whole-world render. No raw OSM XML or whole-region routing graph loads into the browser.
- Features crossing tile boundaries are indexed into every intersecting bounding-box tile, then deduplicated by source ID in the resident window. This prevents duplicate buildings and centroid-only scenery disappearing across seams.

[NETWORK_CONNECTIVITY.json](data/NETWORK_CONNECTIVITY.json) records exact graph counts, source checks and far connected-node witnesses.

## Source-based scenery actually included

| Feature | Included source objects | Treatment and limits |
|---|---:|---|
| Building footprints | 4,673 | Existing footprint extrusion, windows and approximate Kerala roof/material treatment. 4,362 are eligible to render nearby. |
| Road-buffer conflicts | 311 | Original polygons retained and flagged in tile data; excluded from rendering/collision until source snapshot/width review. This includes 34 previously rendered footprints. No source polygons were deleted. |
| Supported POIs | 584 | Source names/tags and representative geographic positions; not surveyed entrances or custom architectural replicas. |
| Water areas | 114 | Closed source polygons for mapped water. |
| Linear waterways | 91 | Real source paths; explicit widths when parsed, otherwise marked estimated widths. |
| Agricultural/natural areas | 65 | 53 farmland, 6 farmyard, 3 grassland, 1 nursery, 1 grass, 1 wood polygon. Crop identity, paddy flooding, coconut/rubber plantations are not invented. |
| Bridge-tagged road ways | 783 | Source positions and connections; approximate rail artwork on flat decks. Several ways may describe one physical bridge. No surveyed clearance/elevation claim. |
| Mapped traffic controls | 106 | 10 signals / 96 crossings, controlling only loaded connected source roads. Existing signal phases/countdowns are game simulations. |
| Verified place nodes | 21 | Existing source-backed local English/Malayalam names. Distant town centres are not fabricated from road-name strings. |

POIs include 309 shops, 74 schools, 58 worship places, 32 hospitals, 11 clinics, 29 banks, 20 restaurants, 13 cafes, 8 fuel points, 5 pharmacies, 4 markets, 2 police stations, 1 town hall, 16 bus stops, 1 bus station and 1 college. These are the supported named/transport features imported by the current extractor; additional unnamed POIs, parking/taxi taxonomy, entrances and detailed landmark models remain work.

Existing decorative palms, bananas, grass and poles remain clearly authored roadside scenery, not surveyed vegetation. No billboards or owner designs were added. Source tag additions retain available religion/roof metadata without claiming a bespoke building replica.

## Gameplay preservation

The vehicle models, handling, walking controller, passenger earnings, wallet and save protocol are unchanged. The default start stays on the same Kottakkal source road. Existing Kottakkal and legacy-origin passenger pickup/drop-off points **and complete source routes** were compared against the previously merged game and match exactly; a regression stores their baseline. The existing authored tea stop is preserved explicitly instead of moving to a newly discovered cafe.

Actual tests cover vehicle switching, taxi availability/fares, walking/running, mobile controls, camera switching, traffic/audio, source junctions, both old/new tile seams and saved-game restoration. No driving-area selector was introduced.

## Browser evidence and validation

Matching-camera/pose comparisons (captured from real local browser rendering):

- [Starting scene before](evidence/network-restoration/start-before.png) / [after](evidence/network-restoration/start-after.png).
- [Outskirts before](evidence/network-restoration/outskirts-before.png) / [after](evidence/network-restoration/outskirts-after.png). Mapped houses now appear beyond the former small auxiliary slice. Camera state is preserved in the accompanying JSON files.
- Actual driving crosses the former x=18,000 m clip boundary on **OSM way 678461651** and remains on rendered pavement with bounded resident tiles.
- Actual driving crosses the entire approximately 73 m **Ummathur bridge, way 814613181**, near mapped water. This validates flat-road traversability, not realistic bridge elevation.
- An additional **700+ metre uninterrupted drive** follows the verified **Chamravattom Regulator-cum-Bridge, way 167057069**, loading new tiles without teleporting or page navigation. Its river geometry is absent from the auxiliary extract and is not invented.

**Passed:** 73 unit tests; the full 33-case browser regression suite plus one additional continuous-drive test (34 unique cases); all seven compiled-production checks, including byte comparisons of every published asset; TypeScript/Vite build and source checksum guards. Final test results and evidence hashes are recorded in `evidence/network-restoration/verification.json`. Rendering samples use local Chromium software WebGL, not real laptop/mobile hardware FPS. The existing Vite >500 kB JS bundle advisory remains.

Reproduce:

```sh
npm run map:district
npm run map:traffic
npm run map:audit
npm run map:check
npm test
npm run build
npm run test:browser
npm run test:production
node scripts/capture_network.mjs after
```

The `before` capture was taken on the prior working source dataset before regeneration. After comparisons replay the saved camera/pose, not a similarly framed approximation.

## Blockers and remaining milestones

Normal HTTPS connectivity probes to the verified DEM host and Overpass endpoint are rejected by the active environment proxy with **403 CONNECT**. [DEM blocker](evidence/network-restoration/DEM_BLOCKER.txt) / [OSM access blocker](evidence/network-restoration/OSM_ACCESS_BLOCKER.txt). No additional extract or elevation bytes were downloaded. Full road coverage spans four one-degree DEM cells (N10E075/N10E076/N11E075/N11E076), requiring a properly licensed, projected multi-tile terrain pipeline.

- **Completed first increment:** source/coverage/connectivity audit, full eligible road restoration, width policy, bounded unified streaming and supported existing auxiliary-source feature restoration.
- **Terrain pending:** real slopes, hills, valleys, cuttings, embankments, building foundations and engineered bridge/tunnel height separation. Flat bridge rails are not this work.
- **Environment pending:** richer building/water/land-use extracts outside the small `map.osm` coverage, source-conflict review, complex multipolygon/holes support, detailed Kerala landmarks/entrances, verified crops and vegetation.
- **Navigation pending:** global/cross-region route planning beyond the resident graph, circular minimap and additional verified town-centre labels. Existing local GPS/rerouting works; it honestly reports unavailable when the destination is outside connected loaded roads. No straight shortcuts across fields or waterways are generated.
- **Performance pending:** real-device profiling and more efficient incremental geometry updates for denser future extracts.

Production URL: **https://drive-game-beta.vercel.app/**. GitHub/Vercel status is checked separately from live browser behavior. This environment has also rejected that domain's HTTPS tunnel; deployment success must not be confused with live verification. Existing tabs may need refresh after a map-data deployment; saved progress is retained.

Next step: restore active network access for verified DEM and supplemental OSM, then complete a small source-based terrain/building/water prototype before extending environmental coverage. Do not fill road-only areas with fictitious landmarks or claim the entire district/state is finished.
