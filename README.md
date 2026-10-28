# EN 3D — എന്റെ നാട്

**Kerala Open World Simulator**

The game automatically loads the same streamed district world for every player. There is no driving-area selector. Old `?world=osm`, `?world=practice` and `?world=malappuram` links all enter this world. Kottakkal is part of the same road network, not a selectable map.

The runtime now retains all **39,273 eligible motor-road ways** in the uploaded regional extract across **8,315 streamed tiles**. Actual motor-road vertices span 10.6269746–11.4861819° N / 75.8256662–76.4768593° E; this is **not a verified full district/state boundary or filled rectangular map**. Supported existing auxiliary data includes 4,673 building footprints (311 road-buffer conflicts flagged and excluded from rendering), 584 POIs, 205 water features and 65 agricultural/natural polygons, mainly near Kottakkal. See [NETWORK_RESTORATION.md](NETWORK_RESTORATION.md) for source audits, matching-camera screenshots, tests and explicit remaining phases.

## Run locally

Node.js 20.19+ or 22.12+ (tested with Node24), npm and Python3 standard library are required.

```sh
npm install
npm run dev -- --port 5173
```

Open `http://localhost:5173/` on your own machine. The welcome screen loads the district automatically; press **Start Driving**. A cloud localhost address is not a hosted preview URL.

```sh
npm run build
npm test
npm run test:browser
npm run test:production
npm run preview -- --port 4173
```

Playwright uses `/usr/bin/chromium`, or set `CHROMIUM_PATH`. Build output is `dist`; Vercel and Netlify build with `npm run build`. Runtime needs static HTTPS hosting for map checksum verification. No paid APIs, assets, map accounts or runtime map-service requests are needed.

## Controls and gameplay

- W / up: accelerate. S / down: brake, then reverse. A/D or arrows: steer. Space: handbrake.
- F: exit a stopped vehicle / enter an available nearby owned vehicle. On foot: WASD walks, Shift (touch RUN) runs. C changes driving camera or rotates walking view.
- Four playable types: passenger auto, compact hatchback, sedan taxi and Kerala-style van. Parked vehicles keep separate saved poses. Eligible cars have a taxi-availability toggle; the van is free-driving only. See [Vehicle switching](VEHICLE_SWITCHING.md) for placement, save compatibility, evidence and limitations.
- E: board/deliver a nearby passenger while stopped. H: horn. P / Escape: pause. R: return to the known source-road starting stop.
- Mobile has touch steering, pedals, horn, interaction and reset buttons. Display settings retain Auto and Battery Saver quality.
- Passenger trips earn a flat ₹120 game fare (not the official Kerala fare). Wallet, trips, passenger, pose and tea counters save automatically. The existing ₹10 tea interaction is available at an authored game stopping point on a mapped road near a mapped Kottakkal cafe; this does not assert its current menu, entrance or exact parking bay.

The old practice save pose and original `osmRide` remain archived in the same localStorage record. Existing export rides retain geographic coordinates. A prior Kottakkal ride reprojects into the district frame, retaining heading/passenger and wallet. Fictional practice coordinates are not misrepresented as geographic coordinates; its earnings/counters and passenger phase carry forward while its pose remains archived. A source failure offers retry of the same district, never a fictional replacement world.

## Data, streaming and reproducibility

Sources `map.osm`, reconstructed `export.osm`, their original imports and all earlier tile assets remain in the repository. They are useful archives, not runtime map choices. `src/world.ts`, landscape/vehicle/input/mission modules and earlier tests of those reusable systems remain preserved.

```sh
npm run map:district
npm run map:traffic
npm run map:audit
npm run map:check
```

`map:district` derives `public/maps/district/` from all eligible existing road-export ways and supported full `map.osm` features in the same metre frame; it does not overwrite earlier map directories. Checksums cover both source files and all unified tiles. Source metadata, limitations and reconstruction part hashes are recorded in `data/DISTRICT_PROVENANCE.json`.

Only a 3×3 nearby 600m tile window is resident, at most nine tiles. Hashes are checked before loading, old resources are disposed after replacement and failed downloads retain nearby geometry and block travel into unloaded cells. The approximately 50.5MB of district tile data is stored on the server, not loaded all at once. Small textures, chunk culling, merged geometry and Battery Saver remain in use; frame-rate claims require real-device profiling.

## Current limits

Default terrain is flat. Real DEM download remains proxy-blocked; no elevations or exact slopes are fabricated. The earlier optional DEM experiment is retained but its single-tile 4.8km importer is insufficient for this expanded window; district terrain needs a verified multi-tile dataset and further development. See [TERRAIN_PROTOTYPE.md](TERRAIN_PROTOTYPE.md) for that historical checkpoint and [DISTRICT_WORLD.md](DISTRICT_WORLD.md) for current acceptance gates.

No district-wide auxiliary coverage, engineered bridge/tunnel elevations, monetary fines or general pedestrian population is claimed. Existing bounded AI and mapped simulated signals remain playable. Real terrain and further environmental coverage require verified data and browser tests. Existing mapped one-way and speed tags are retained as data, not a guarantee of current traffic law. Building heights/materials, road widths without tags, shoulders and paint are visual estimates/artwork.

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Derived geographic databases are **ODbL1.0**, separate from MIT application code. See [DATA_LICENSES.md](DATA_LICENSES.md). Application dependencies use MIT/Apache licensing; permissive BSD/ISC transitive build tools were approved by the user.

## Nearby AI traffic

A bounded traffic prototype now adds bikes, scooters, hatchbacks, autos, goods three-wheelers, vans, public buses and lorries on the existing roads. Use Display → Traffic density (Low/Medium/High), Audio volume or Clear nearby traffic. Battery Saver caps active traffic at6. Sounds are original synthesized substitutes. Existing auto controls, passenger fares and saves remain unchanged. See [TRAFFIC.md](TRAFFIC.md) for routing, mapped controls, performance and prototype limits.
