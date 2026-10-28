# Phase 06 preview camera-test blocker

Baseline: `318f0f5d9f252d21d94d2012ca1dccb61d30a1e5`, branch `codex/en3d-phase06-kerala-buildings`.

## Root cause

The traffic test performed a synthetic relocation from Kottakkal (-8878.932, 5944.025) to the verified road at (0, 0), about 10.7 km away. `stoppedAt()` assigned the car pose and camera X/Z but retained the camera's smoothed look target at the previous location. It waited two animation callbacks, then the traffic fixture changed the car heading towards a bus without resetting the camera state.

The game smooths position and look with `1-exp(-5*dt)` and `1-exp(-8*dt)` respectively, with simulation `dt` capped at 0.1 s. The number of rendered frames therefore affects convergence. Mesh counts and toast state do not establish camera readiness. The test could project vehicles before the view caught up; later screenshot capture could already show them. The unchanged original test also passed in a trace-enabled run, consistent with frame/timing sensitivity. The controlled frame probe below establishes the cause independently of that outcome.

The normal game already calls `snapCamera()` at start, recovery and driving-camera changes. That function resets position and smoothed look together. The camera code, original test and helper were unchanged between the approved Phase 04/05 integration and Phase 06. The failure is an inconsistent synthetic test fixture and missing render synchronization; the visibility expectation remains valid.

## Controlled reproduction and evidence

Earlier failure logs, assertions, page snapshots and screenshots were reviewed. Earlier failures had no saved trace, so new Playwright traces and per-frame telemetry were captured. The controlled probe used the unchanged application, identical car coordinates/heading, source road, viewport (1280×800, device scale .75), low quality and static lighting. Traffic was frozen after population in this diagnostic only. The actual first post-setup rendered frame was held for screenshot capture, preventing capture latency from advancing the camera. No image editing or mockup was used. Camera position/orientation differ intentionally because the fixture reset is the subject of the comparison.

| First rendered frame | Original partial relocation | Atomic camera reset |
| --- | --- | --- |
| Smoothed look error | 130.438 m | 0.449 m |
| Camera position error | 1.719 m | 0 m |
| Vehicles inside original frustum bounds | 0 | 6 |
| Source buildings in loaded window | 0 | 0 |
| Building colliders | 0 | 0 |

After 24 additional rendered callbacks, the original case also had all six vehicles in view and its look error fell to about 0.0000023 m. This controlled transition establishes the timing/state cause. Zero buildings and colliders rule out Phase 06 building obstruction for this failure. Source geometry, road connectivity, spawning and camera controls were preserved.

- [Before: actual captured frame](evidence/phase06-camera-fix/before.png)
- [After: actual captured frame](evidence/phase06-camera-fix/synchronized.png)
- [Final fixed test screenshot](evidence/phase06-camera-fix/after-test.png)
- [Before telemetry](evidence/phase06-camera-fix/before.json), [after telemetry](evidence/phase06-camera-fix/synchronized.json)
- [Before trace](evidence/phase06-camera-fix/before-trace.zip), [after trace](evidence/phase06-camera-fix/synchronized-trace.zip)
- [Original unmodified test trace](evidence/phase06-camera-fix/original-test-trace/traffic-buses-and-lorries--6927e-er-than-narrow-town-streets/trace.zip)

The associated walking GPS test had a second instance of premature view sampling: it directly relocated the foot pose and advanced orbit commands after a fixed 500 ms. An initial convergence-only prototype exposed a further race: a camera command can still leave the previous frame's target marked settled until the next animation frame. The final helper first crosses a render barrier, then measures the updated camera targets. This also ensures the renderer has refreshed camera world/projection matrices before `.project(camera)` is sampled. The GPS loop synchronizes before its first visibility check and after each rotation.

## Smallest safe fix

- `tests/helpers/game.ts`: expose the existing `snapCamera()` and read-only tracking error through the existing request-intercepted test hook. `waitForCamera()` waits for a fresh rendered frame and asserts position/look errors below 0.05 m and FOV error below 0.05 degrees. The existing general-purpose `stoppedAt()` helper remains unchanged; camera-sensitive fixtures explicitly synchronize the view before inspecting it.
- `tests/traffic.spec.ts`: reset the camera after the fixture's deliberate heading change, then assert convergence before inspecting projection.
- `tests/walking.spec.ts`: replace the fixed orbit delay with fresh-frame/convergence checks and synchronize the initial relocated view.

A TypeScript AST comparison confirms all **116 original assertions** in the affected files are preserved; the helper adds one readiness assertion. Playwright configuration files are unchanged. See [assertion integrity](evidence/phase06-camera-fix/assertion-integrity.json).

An intermediate prototype reset the view in the shared relocation helper. Full-suite validation exposed an unrelated bridge-driving fixture missing its unchanged 20-second movement budget while the car was still moving. The final fix scopes the reset to the traffic camera fixture and restores the common relocation helper exactly, preserving other test setup behavior. No gameplay or timeout changes were made to address that intermediate result. In final scoped checks, the two camera-sensitive cases passed all three repetitions each. The untouched bridge case passed two of three runs; its single failure stopped at 72.616 m against the 75.243 m target while still travelling at 79 km/h. This is retained as an independent fixed-wall-clock sensitivity on the software-renderer executor; the final full-suite result is recorded below.

All original visibility bounds, traffic population/density limits, geometry budgets, road checks and gameplay assertions remain intact. No timeout was increased, no test skipped or deleted, and no expectation was relaxed. The helper adds a positive readiness assertion under the existing timeout. The hook exists only in Playwright's intercepted development response; it is absent from the shipped application.

No `src/`, OSM data, assets, settings, saves, camera controls, traffic behavior/density, Phase 04/05 road or Phase 06 building code changed. The production bundle remains `index-BaqxIBf8.js` (686.18 kB minified / 195.64 kB gzip), identical to the approved implementation. Existing Vite >500 kB advisory remains.

## Final verification

- Final complete development-browser suite: **37/37 passed**, zero retries, 18.9 minutes. This includes the original traffic framing assertion, GPS ring visibility, bridge/water/rail traversal, long driving, traffic audio/density, vehicles, missions, HUD/minimap, walking and saves.
- Final scoped repetitions: **traffic camera 3/3 passed; walking GPS 3/3 passed**, zero retries. The unchanged bridge check additionally passed 2/3 focused runs; its independent fixed-wall-clock sensitivity is documented above, and it passed in the complete final suite. No timeout or bridge expectation changed.
- All unit tests: **95/95 passed**.
- Production build, TypeScript and map/source/network validators: **passed**. Runtime inputs and bundle fingerprint are unchanged.
- AST assertion audit: **116/116 original assertions preserved**; one readiness assertion added. Common `stoppedAt()` body and Playwright configuration unchanged.
- `git diff --check`: passed. Credential-pattern scan of the four commit candidates: zero matches. Generated evidence is excluded.

Logs: [final browser suite](evidence/phase06-camera-fix/browser-final.log), [focused repetitions](evidence/phase06-camera-fix/scoped-repeated.log), [unit tests](evidence/phase06-camera-fix/unit.log), [build](evidence/phase06-camera-fix/build.log).

Generated screenshots, traces, telemetry and logs remain local under `evidence/phase06-camera-fix/` and are excluded from the fix commit. Existing research and evidence were preserved. No push, merge, deployment, Production change or Phase 07 work occurred. Preview deployment requires the user's next approval.
