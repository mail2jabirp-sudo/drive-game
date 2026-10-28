# Kerala architecture detail increment

EN 3D — എന്റെ നാട് · Kerala Open World Simulator

This release upgrades the close-up building system in the existing playable world. It is an original procedural architecture increment, with true mesh depth and locally generated PBR surfaces. High-fidelity vehicle GLBs, rigged realistic people and a complete GTA-style art pass remain later milestones.

## Models actually implemented

| Building treatment | Visible 3D work | Geographic/style basis |
|---|---|---|
| Traditional house | Ridged hipped/gabled tile roof, fascia and ridge cap, timber window frames/mullions, angled shutter louvers, panelled door/handle and recessed veranda where the face is wide enough | Existing footprint; explicit roof tags and house/residential tags preferred; conservative deterministic illustrative treatment for some unclassified buildings |
| Modern residence | Flat terrace/parapet, recessed glazing, concrete sills and floor bands, panelled entrance, metal frames and inset first-floor balcony/loggia | Existing footprint/height; mapped flat roofs respected |
| Apartments/office | Repeated storeys of framed recessed openings, floor bands, terrace/parapet and inset balcony detail | Existing height/building classification; capped visual complexity |
| Shop/commercial | Wide ground-floor shop openings, actual corrugated shutter ribs or glazing, entrance frames and facade trim | Shop/retail/commercial or mapped restaurant/cafe/market tags; no invented business names or signs |
| Hospital/school/college/transport building | Muted institutional facade palette, repeated framed glazing and recessed entrance treatment | Verified building tags or a matching POI lying inside the footprint |
| Worship building | Conservative footprint-adapted facade/roof treatment; dome only when explicitly tagged and the footprint supports it | Verified worship/religion tags; bespoke mosque/temple/church landmark models are still pending |

These are **detailed procedural approximations**, not scanned buildings, manufacturer assets or exact real-world replicas. No external GLB/glTF model was imported in this increment. Buildings remain opaque collision footprints: visual doors, balconies and verandas do not introduce enterable rooms or new interior gameplay.

The close model has openings cut out of its facade panels, with glazing/doors recessed approximately 14 cm and inset loggias/verandas approximately 50 cm. Frames, sills, columns, panels, handles, roof ridges and louvers are mesh geometry. Windows are shaded PBR surfaces, not photographs pasted over the world. Simple glazing is opaque; full room interiors, glass refraction and scene reflections remain pending.

Mapped outlines and total heights remain constrained as before. Facade trim projects at most approximately 4 cm; balconies/verandas are inset instead of extending into roads. Unsupported concave outlines use footprint-constrained flat roofs rather than a roof spanning across courtyards. Existing building collision polygons and road clearances are unchanged.

## PBR textures and rendering

Original code in `src/architecture-materials.ts` synthesizes five shared 256×256 sets: plaster, terracotta, wood, stone/concrete and corrugated metal. Each set has color, normal and roughness channels. Color textures use sRGB; normal/roughness channels use linear data. Repeating textures use mipmaps and capped anisotropy. Wood channels are shared between timber frames and doors.

All materials use Three.js MeshStandardMaterial. Existing daylight, shadows, atmosphere and Low/Medium/High/Auto settings are retained. No remote imagery, game asset rip, paid API, new package dependency or billboard was added. Original procedural code/geometry/textures use the repository MIT licence; geographic footprints/data remain ODbL with existing OSM attribution.

Detailed parts batch by material, LOD and the existing 160 m render chunks. Nearby facades switch to simpler complete wall/glazing versions at distance; near and far wall versions are mutually exclusive. Roofs remain visible through the transition. Low uses a smaller detail radius than other presets. At most nine road tiles remain resident, and streaming disposal also releases the new geometries and texture channels.

Merged chunk geometry now uses local GPU coordinates with a world-space mesh offset; geographic positions are unchanged. Correct outward facade/roof winding and back-face wall shadow casting avoid the diagonal self-shadow artifacts found during actual High-quality screenshot inspection.

## Preserved systems

Original source XML, generated map assets, geographic projection, road geometry/connections, vehicles, handling, walking/running, vehicle switching, camera modes, taxi/passenger missions, fares, wallet, GPS and save data remain. Only building rendering/materials and a small walking-HUD overlap fix changed. The on-foot heading now has room without a fare badge overlapping it.

Architectural facade types can use verified POIs inside a footprint. They do not change the source database, create a new geographic location, infer a surveyed entrance or add named facilities where none were mapped.

## Browser evidence and checks

`scripts/capture_architecture.mjs` captured the prior game before edits and replays the exact camera position, quaternion, FOV and player pose afterward. Independent assertions and JSON camera records accompany the images.

- [Starting area before](evidence/architecture-upgrade/start-before.png) / [after](evidence/architecture-upgrade/start-after.png).
- [Close roadside house before](evidence/architecture-upgrade/outskirts-before.png) / [after](evidence/architecture-upgrade/outskirts-after.png).
- [Walking by the upgraded facade](evidence/architecture-upgrade/walking-facade.png) / [High quality with shadows](evidence/architecture-upgrade/walking-high.png).

A browser gameplay check exits the existing auto, moves the walking character near a source-footprint building, verifies normal/roughness material channels, verifies mutually exclusive near/far geometry, and measures rendering. One local close-up sample: **68 draw calls / 34,682 triangles / 9 resident tiles**. These are software Chromium samples, not real laptop/phone FPS claims. Original frame/model rendering and vehicle/mission regressions remain active.

Final checks passed: **76 unit tests, 35 browser regressions and 7 compiled-production browser tests**, plus the TypeScript/Vite production build and source-map checks. Low/Medium/High were exercised through the actual settings UI. Software Chromium samples were approximately 66–69 / 95 / 96 draw calls and 35k / 48k / 48k triangles respectively; these are scene measurements, not hardware FPS benchmarks. Vite retains its non-fatal large-bundle advisory (674 kB JS, 191 kB gzip).

Final verification results and built asset/screenshot hashes are in `evidence/architecture-upgrade/verification.json`. New unit tests protect source-coordinate/height limits, conservative roof/category handling, genuine recess geometry and a per-fixture triangle budget. The older north/south extrusion/roof test now checks the named architectural materials and a tagged synthetic house; it still verifies geographic orientation, total height, collision and culling.

Reproduce:

```sh
npm test
npm run build
npm run test:browser
npm run test:production
node scripts/capture_architecture.mjs after
```

## Remaining work

- Detailed optimized vehicle models, preserving the recognizable existing Kerala auto, hatchback, taxi, van and AI categories. Existing wheel/door/light/driving animation remains; no vehicle model replacement is claimed here.
- Properly rigged/skin-weighted realistic human assets, natural animation clips, varied clothing/appearance, boarding/alighting and walking crowds. The existing procedural character and waiting passenger remain prototypes.
- Bespoke verified landmark architecture, richer room/interior treatment, facade art review and more realistic weathering. The footprint-driven buildings remain approximations.
- Environmental art, water/reflection improvements, source-supported terrain and real-device performance profiling. No elevations or new geographic coverage were fabricated.

Production URL: https://drive-game-beta.vercel.app/. Deployment status is reported separately from live gameplay. The active environment has previously rejected this host's HTTPS CONNECT tunnel; a successful Vercel status alone is not treated as browser verification.
