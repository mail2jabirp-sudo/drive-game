# Phase 1 terrain and roads checkpoint

**Historical small-window checkpoint:** the current sole playable world is now the expanded district described in [DISTRICT_WORLD.md](DISTRICT_WORLD.md). There are no separate map choices. The single-tile DEM procedure below is retained for reference and is not sufficient for the new 36km window; real district terrain remains pending.

This is an incremental development branch based on main `3d601e9`. **Real elevation integration is blocked, not complete.** The default playable maps remain flat. No synthetic elevation is shipped. Do not merge this draft as a claim of real Kerala slopes.

## Verified coverage and preserved data

- Original Kottakkal slice: approximately 1.3 km square, centred on 11.001609 N, 76.00470916 E; existing roads, 203 footprints and earlier gameplay retained.
- Malappuram road-only playable window: 4.8 km square centred on 11.0544807 N, 76.0863541 E (source node 5050370142, Malappuram Bypass Road). Approximate window bounds: 11.032897–11.076064 N, 76.064362–76.108346 E. It contains 650 retained source motor-road ways split into 915 fragments, not all Malappuram District or entire named routes.
- The uploaded XML's wider coordinate envelope, 10.6269746–11.525987 N / 75.8256662–76.7019365 E, does not establish continuous or district-complete coverage. No administrative boundary was provided.
- Parts of NH966/Malappuram Bypass, SH71, Collectorate/Civil Station/Kottakkunnu/Market roads remain in the initial selection; no new geographic coverage is added here.
- A source audit of nodes inside the window found 5 `highway=traffic_signals` nodes and 5 crossing nodes; 3 waterway ways have at least one node inside. This is source availability, not implemented traffic/water simulation. No building/landuse/natural ways or named place nodes were found by that local audit of the road-focused export. Later phases need additional verified data. The earlier Kottakkal footprint database remains intact.
- Both XML sources, all existing derived map tiles, vehicle assets, input, fare rules and save schema are preserved. No new exact landmark, town, slope, signal or building locations are invented.

## Implemented increment

- Existing OSM curves, node graph, classifications and directions remain the navigation source. Surface tags choose asphalt, concrete or earth material where available. Gravel-colour verges on major roads are authored visual estimates, not surveyed shoulders; centre guidance remains authored paint, omitted on unpaved roads. Source widths and collision boundaries are unchanged.
- Optional terrain support uses one small 81×81 metre-height grid for the bounded 4.8 km window. Nearby road tiles still have a maximum of 9 resident tiles; raw XML/whole district data never enter the browser. The ground grid is about 12,800 triangles. Terrain roads resample at no more than 8 m between render sections, retaining original geographic endpoints and graph connections.
- Terrain sampling is bilinear, x east / z south, relative to the origin height with vertical scale 1. Roads, junction discs, passenger markers, rickshaw pitch/roll and chase camera share that surface. Incline force is optional; existing flat driving remains unchanged. This is a prototype, not surveyed road grading or engineered vertical alignment.
- Missing DEM fails clearly and offers the existing flat Malappuram map while retaining progress. No terrain option is advertised in the area selector until real data is available. Test-only synthetic HGT and plane fixtures stay in temporary files/intercepted responses, never in served map assets.

## DEM source and precise blocker

Candidate public archive: Tilezen/Mapzen terrain composite HGT tile `N11E076` (11–12 N, 76–77 E), covering the current Malappuram window:

https://elevation-tiles-prod.s3.amazonaws.com/skadi/N11/N11E076.hgt.gz

Attempting access returned **`curl: (56) CONNECT tunnel failed, response 403`** from the environment proxy, before the dataset server. The object, samples, contributing-source header and actual heights have therefore **not been downloaded or verified**. This is not an upstream object-not-found claim. A network configuration draft adds the exact host `elevation-tiles-prod.s3.amazonaws.com` while preserving `api.github.com` and existing presets. Saving that draft does not apply it to the running environment; the user must apply/publish the updated environment settings before another attempt.

Source documentation was accessible through GitHub:

- https://github.com/tilezen/joerd/blob/master/docs/data-sources.md
- https://github.com/tilezen/joerd/blob/master/docs/attribution.md
- https://github.com/tilezen/joerd/blob/master/docs/formats.md

The composite uses SRTM/GMTED2010 globally among other regional sources. USGS SRTM/GMTED data are public domain with credit requested; credit Mapzen/Tilezen and contributing providers. A composite tile must not be called pure SRTM without checking its actual contributors. Inspect any `X-Imagery-Sources` response header/footprints metadata and confirm applicable attribution and vertical datum before delivering real terrain. No unverified DEM is redistributed in this checkpoint.

## Reproduction after network access is applied

```sh
npm install
npm run map:terrain -- --download
npm run build
npm test
npm run test:browser
npm run test:production
npm run dev -- --port 5173
```

Only after real import succeeds, locally visit `http://localhost:5173/?world=malappuram&terrain=1`. Default `?world=malappuram`, `?world=osm` and `?world=practice` remain available without a DEM. These are local instructions, not a hosted preview link.

The importer checks gzip dimensions (1201² or 3601² signed big-endian metre samples), rejects voids rather than filling them, checks geographic coverage, extracts the window, and writes `public/maps/malappuram/terrain.json` and `data/ELEVATION_PROVENANCE.json`. The download receipt retains response headers and SHA-256. A local input must be named `N11E076.hgt.gz` with explicit `--source-url` and `--attribution`; filenames alone cannot verify geographic/provider authenticity. Import refuses to overwrite an existing input download or generated DEM/provenance. Inspect existing files before a deliberate replacement. Raw input is retained in `data/elevation/`, outside Vite public assets.

## Limits and next acceptance gate

Phase 1 remains incomplete until actual DEM download, source/datum review, numerical height/gradient inspection and browser driving on actual terrain succeed. No claim of real road gradients, surveyed bridge decks/tunnels, smoothed engineered intersections, hillside collision correctness, real-device FPS or full district coverage is made. Terrain follows the sampled DEM directly; dedicated road-grade smoothing and bridge/tunnel handling require verified data and further testing before release. Road/chunk rebuilds are still synchronous and need long-session profiling.

After that gate, Phase 2 adds verified local building footprints and estimated/tagged heights with architectural variation; Phase 3 uses verified landuse/waterways for vegetation and water; Phase 4 adds mapped traffic controls, AI and pedestrians; Phase 5 adds source-backed bilingual labels and further profiling/coverage expansion. Existing code has no traffic fines, signal simulation or AI traffic to claim as preserved working features.
