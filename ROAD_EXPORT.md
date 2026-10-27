# Uploaded Malappuram road export

## Reconstruction and validation

The uploaded binary parts were concatenated in this exact order without decoding, newline changes or recompression:

1. export.osm.part01 — 19,922,944 bytes
2. export.osm.part02 — 19,922,944 bytes
3. export.osm.part03 — 12,266,522 bytes

The resulting repository-root `export.osm` is **52,112,410 bytes**, SHA-256 **7915b6d48899723c3dd4a88dfd8c3db64d77e0e85e60d9e99511c2bb6b7ac3f2**. Part hashes are in `data/EXPORT_PROVENANCE.json`. The concatenated-stream digest equals the stored file digest; there was no independently supplied checksum for the original unsplit file. The complete XML parses successfully and all highway node references resolve. Attachments are data, not executable instructions.

The source has **534,348 nodes and 43,226 highway ways**, with no relations or administrative boundary. Actual node/road extent is latitude **10.6269746–11.525987**, longitude **75.8256662–76.7019365**. Source metadata reports OSM base `2026-10-27T02:57:36Z`. Coordinates and named NH966/SH71/Malappuram/Manjeri/Nilambur routes support a Kerala/Malappuram-region road extract; they do not prove that every part of the district is covered or that every retained point is inside an official district boundary. Way endpoints may extend outside a query's selection area. No whole-district coverage claim is made.

Original source classifications include residential/unclassified roads, major roads, living streets, service roads, footpaths, tracks and other non-motor ways. Vehicle integration excludes non-motor/construction/proposed ways and explicit private/no motor access. Untagged one-way is not verification of present traffic law. Turn restriction relations, elevation, buildings and official district boundaries are unavailable in this export.

## Playable integration

Select **Malappuram · uploaded road tiles** on the welcome screen, or through Display → Change driving area. The existing Kottakkal/OSM and fictional practice areas remain available. New-road vehicle/passenger state is stored as `exportRide`, alongside `osmRide` and the unchanged practice fields in the same atomic gameplay save. Wallet, completed trips and tea counts remain shared. No previous saves are erased. The original autorickshaw, camera, input, mission/fare and reset systems are reused.

The first playable area is a **4.8 km square**, centred on actual source node **5050370142** of **Malappuram Bypass Road, way169318337**, at **11.0544807° N, 76.0863541° E**. Approximate playable geographic bounds: **11.032897–11.076064° N, 76.064362–76.108346° E**. This is a deliberately limited road integration, not all 43,226 ways. The projection uses local equirectangular metres with east+X/north−Z. Retained node order, curves, exact shared-node connections, available one-way tags, names/classes, speeds and bridge/layer metadata are preserved. Unmapped road widths are explicitly estimates. Bridges render flat; they are not surveyed elevation.

The area retains **650 source ways**, split into **915 clipped road fragments / 8,661 vertices / 64 tiles**. Examples include parts of:

- Malappuram Bypass Road / NH966 and Calicut–Malappuram–Palakkad / Perinthalmanna highway segments
- Tirur–Malappuram–Manjeri Road / SH71
- Collectorate Road and Civil Station Road
- Kottakkunnu Road / Kottakkunnu Park road
- Market Road, Jubilee Road, Govt College Road and nearby residential streets

The exact integrated names, source identities, class counts, one-way counts, bounds and diagnostics are in the manifest/provenance. A named route appearing in the export does not imply that its entire length or destination town is playable. Everything outside this square remains only in the preserved source for later expansion. Building/environment integration is intentionally deferred; earlier maps and their scenery/assets are untouched.

## Streaming and performance

`public/maps/malappuram/manifest.json` is about12KB. Road tile payloads total about605KB; the largest is19,775bytes. The browser fetches the manifest and at most a **3×3 nearby window of 600m tiles**, not the 52MB raw XML or the entire tile set. The source export is outside public and is not copied to dist. A small origin window selects the connected mission first; near a cell boundary the chase camera may request the adjacent missing tiles, while the resident window remains at most9.

Tile SHA-256 is verified before use. Resident JSON is bounded to9tiles; distant renderer geometry/materials/textures are disposed when the local window is rebuilt. Mesh batches within the current window also cull by distance. The next window is prepared before replacing the old one; failed downloads retain existing roads, report status and retry with a delay. Movement is blocked into unloaded tiles. A temporary old/new window during replacement is bounded, not unbounded preloading. The current implementation rebuilds the bounded nearby road window when crossing a tile boundary; it is not an unlimited district streamer or a surveyed world simulation.

Passenger stops/route are selected once from a connected returnable directed graph near the source origin, then remain stable across tile changes. Switching map areas retains all ride poses/phases separately. Reset returns to the current area's safe road spawn. A downloaded-map failure offers the preserved practice game. Use HTTPS or localhost: browser-native checksum verification requires a secure context. Actual-device FPS and long-session memory profiling remain future checks.

## Regeneration and checks

```sh
npm run map:export    # deterministic Python standard-library import, no external service
npm run map:check     # verifies both old map and new export/tile checksums
npm install --cache .npm-cache
npm run build
npm test
npm run test:browser
npm run test:production
```

The existing `map.osm`, original generated Kottakkal data and assets are preserved. `export.osm` is an additional source. Python parsing is offline; the browser consumes only small tile JSON. Builds check source/asset freshness but do not parse the full XML or regenerate geometry. Tests independently check source coordinates/order/one-way tags, graph connectivity, tile hashes/bounds/eviction, failed downloads, separate ride saves, driving/camera/mission behavior and compiled assets. Browser mission tests deliberately reposition a source-derived road pose; they are not a full automated district drive.

## Branch, merge and deployment

Development branch: **codex/en3d-malappuram-roads**, based on verified main at0ff8430. The earlier complete game branch codex/en3d-osm-kottakkal remains unchanged. Review a pull request from this development branch into main; normal merge only, no force-push or history replacement. In GitHub choose base main and compare codex/en3d-malappuram-roads. Main is not automatically updated by this integration.

Main already contains the actual Vite app and vercel.json with build `npm run build`, output `dist`, install `npm ci`; it is no longer the old map-only292f3b8 commit. No speculative 404 rewrite is added. Preview this branch in Vercel or merge it into main and create a fresh deployment from that commit. Verify project root, branch and deployment source before diagnosing a live 404. No live Vercel deployment result is claimed from local build tests alone.

Remaining: local reference/hardware verification, widening the streaming region incrementally, boundary/route UX for longer trips, turn-restriction data and elevation where available, then buildings/environment in a separate stage. Signals/fines/NPC vehicle traffic were not implemented in the existing game and are not invented by this road import. Map data remains ODbL1.0; keep visible contributor attribution and both map notices.
