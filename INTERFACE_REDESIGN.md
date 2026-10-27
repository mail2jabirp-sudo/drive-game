# EN 3D interface and starting-scene redesign

Main branding remains **EN 3D — എന്റെ നാട്** with **Kerala Open World Simulator** as the official subtitle. This increment redesigns the functioning game; it adds no map-selection mode or geographic coverage.

## Audit and completed interactions

The prior welcome screen used oversized type, a decorative stamp and lengthy keyboard instructions over a static chase view. Gameplay had a large light mission card, distant small-map route, separate overlays and no real main-menu settings/controls/vehicle flows. Many visible buildings remained flat-topped and Low hid all façade/road-paint details.

The new shared design uses dark forest panels, warm gold primary actions, consistent spacing/type, SVG action icons, visible keyboard focus, native modal focus handling and responsive touch layouts.

- **Start Driving** starts the existing ride without erasing earnings. **Continue** resumes the restored wallet, passenger and safe road pose. It is disabled with an explanation when no valid save exists. Returning through Pause → Main menu saves and enables Continue.
- The main menu renders the actual source-road scene with an authored slow camera orbit and moving existing traffic. Player physics and fares stay inactive until starting; audio remains gesture-gated. Reduced-motion preferences disable the decorative orbit. No prerecorded/fake background is used. The old stamp is removed.
- **Vehicles** opens an honest one-vehicle garage. Its **Drive this auto** action starts the current playable autorickshaw. Other existing models are identified as AI traffic, with further player vehicles explicitly unavailable.
- **Settings** controls real Auto/Low/Medium/High rendering, traffic density, master volume/mute and chase/driver cameras. Low keeps the prior reduced detail/resolution and six-traffic cap; Medium uses capped pixel density and 512px shadows; High uses the higher resolution cap and 1024px shadows. Auto retains sustained-slow-frame fallback. Preferences persist separately from the original gameplay save.
- **Controls** lists actual WASD/arrows, brake/reverse, Space, E, H, R, P/Escape and new C camera switching. Space/Enter still activate focused menu buttons. Opening a dialog during driving pauses input/traffic/audio, then closing it resumes only when it was previously running. Already-paused rides remain paused.
- Pause has working Resume, Settings, Controls and Main menu actions. Visibility/context-loss protections remain in place.

## Gameplay HUD and visuals

The smaller HUD retains money, trips, passenger objectives, actual fare actions, source-road GPS/turn distances, mapped simulated-signal countdowns and Malayalam advisories. Navigation adds short Malayalam turn instructions. The dark minimap uses a closer street scale, brighter route and edge-clamped destination markers; nearby building bounds now use that same map scale. Attribution remains visible. Streaming/render diagnostics move into Settings.

The speedometer shows km/h plus a speed-derived **N/D/R direction status** and actual braking/reversing/handbrake state. This is not a simulated manual gearbox. Fuel, damage bars and other unimplemented systems are deliberately absent.

The existing 203 verified building footprints remain in their original positions. Suitable small convex footprints receive approximate tiled roofs within the existing footprint and total source height; façades gain warmer variation and nearby windows remain visible on Low. Source-tagged shops/commercial buildings gain restrained frontage trim and safe short awnings. These are authored architectural approximations, not surveyed replicas. Existing source-supported water remains; no fields, rivers or exact landmark positions are fabricated.

Bounded decorative banana plants and grass join the existing batched palms/poles, using the same clear-verge placement and chunk budget. Asphalt/shoulder joins retain the preceding source-aligned repair; nearby markings now remain visible on Low. Morning sky/fog/exposure are adjusted for a clearer view. No DEM is installed, so elevation stays flat.

The player autorickshaw retains its proportions, seats, mirrors, lamps and three independently rotating wheels. Static parts are merged by material separately from the moving canopy/fork/wheel groups, reducing body draw submissions. Brake-lamp emission now responds to actual braking input. The chase camera is lower with a longer look-ahead and modest speed-responsive FOV; optional driver view uses the existing cabin/window geometry. Physics, road/traffic collisions and source coordinate frames are unchanged.

## Actual screenshots and reproducibility

All captures are actual Chromium/Three.js output, not mockups:

| View | Before | After |
| --- | --- | --- |
| Main menu | [Original menu](evidence/interface-redesign/menu-before.png) | [Live cinematic menu](evidence/interface-redesign/menu-after.png) |
| Same gameplay pose and camera | [Before](evidence/interface-redesign/game-before.png) | [After](evidence/interface-redesign/game-after-same-camera.png) |

[Mobile portrait](evidence/interface-redesign/mobile-portrait.png) · [Mobile landscape](evidence/interface-redesign/mobile-landscape.png) · [Normal new chase camera](evidence/interface-redesign/game-new-chase.png) · [Driver camera](evidence/interface-redesign/driver-camera.png) · [Settings](evidence/interface-redesign/settings.png) · [Pause](evidence/interface-redesign/pause.png) · [Vehicle interface](evidence/interface-redesign/vehicles.png).

`comparison.json` records the pre-change car pose, camera position/quaternion/FOV, save and traffic transforms. `scripts/capture_interface.mjs` reuses that baseline for the paired gameplay image and asserts exact pose/camera equality at 1440×900, Low, DPR 1. Traffic transforms are held for this static visual comparison; separate browser checks verify actual movement. Normal menu/chase/driver captures use the real camera behavior. Run the dev server, then `node scripts/capture_interface.mjs` to reproduce the after captures.

`verification.json` records the successful comparison and zero runtime errors. A normal Low sample rendered **91 draw calls / about 16,000 triangles**, **27 player meshes**, and at most **nine resident tiles**. These are headless budgets, not real-device FPS claims.

## Verification and remaining work

Validation includes TypeScript/build, 59 unit tests, 23 browser regressions and five compiled-production checks. The new browser cases exercise keyboard-start, live menu traffic, saved Continue, honest vehicle availability, rendering settings/shadow sizes, actual mute, modal input/clock pause, camera switching, real forward/reverse status, wheel animation/brake lamps and HUD/pedal separation at 568×320, 844×390 and 390×844. Existing driving, GPS/rerouting, signal countdowns, actual source-junction/seam crossing, traffic collisions/audio, mission earnings, save migration and tile-integrity checks remain.

Both raw OSM sources, all geographic assets, the original save protocol, missions and driving physics are preserved. All new geometry/textures/UI are authored code; no dependency, paid asset/API or external font is added. Existing MIT/application and ODbL/source attribution remain.

This completes the functional main-menu/HUD phase plus a bounded starting-environment/camera increment. The world is still stylized procedural geometry: photorealistic vehicle assets, detailed interiors/shopfronts, moving pedestrians, real elevation, richer source-backed land use, full-district coverage and routing through unloaded regions remain separate work. GPS retains its resident connected-road limitation; signal timing is simulated, not live/surveyed timing. Actual phone/laptop hardware profiling remains pending.

Vercel uses the unchanged `npm run build` / `dist` configuration. Deployment validation must match the merged commit and served assets. Hosted Chromium previously encountered this environment's `ERR_CERT_AUTHORITY_INVALID`; interactive screenshots/tests use local Chrome with no certificate bypass, and live HTTPS verification is reported separately.
