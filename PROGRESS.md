# EN 3D development checkpoints

All work belongs to `/workspace/drive-game`. Do not modify other repositories.

- Toolchain initialized: TypeScript, Three.js, Vite, npm lockfile, MIT license.
- Procedural town and rickshaw: road loop, shops, palms, plaza, bus shelter, collision bounds, animated vehicle.
- V1 complete: chase camera, mobile/keyboard input, horn, pause/reset, passenger fare and local saves.
- Validation: production build and five V1 unit tests passed. All three Chromium browser checks passed: driving/brake/reverse/horn/pause/reset, passenger pickup/delivery/save restoration, and mobile touch controls at landscape/portrait sizes. Scene screenshots inspected.

- First follow-up complete: Chaya Kada sells optional ₹10 tea; tea-break count persists and the passenger remains aboard. Version-1 saves migrate with a zero tea count.
- V1 final checks: clean `npm ci --cache .npm-cache`, `npm run build`, all 9 unit tests, and all 4 Chromium browser tests passed. Additional tea test re-run verified narrow 568×320 landscape controls and no card overlap. Mobile viewport checks also covered 844×390 and 390×844. Actual phone hardware has not been tested.
- Initial camera timing issue is fixed: initialize from the first animation timestamp and prevent negative frame deltas. Slow renderers reduce resolution/shadows automatically.
- Dependency licensing: runtime Three.js is MIT. The user explicitly approved BSD/ISC transitive development tools; notices are in THIRD_PARTY_NOTICES.md.
- Reusable install_script/start_skill saved in the cloud environment draft. Publication is a separate user action in environment settings. Local commits have not been pushed or deployed; new-task restoration has not been verified.

## Latest increment — EN 3D Phase 1

The user's new phased roadmap supersedes the earlier traffic-first queue. This is one working visual/performance increment on the existing game, not implementation of every requested phase.

- Rebranded EN 3D — എന്റെ നാട് / Kerala Open World Simulator. Welcome and minimap explicitly identify a fictional practice loop; removed the previous geographic coordinate claim.
- Original repeating asphalt/plaster/concrete/clay textures, subdued shop finishes, shutters/eaves and curved coconut fronds. Town surface checkpoint committed separately (`a113da7`).
- Added morning sky/lighting and 13 distance-culled scenery chunks: paddy plots, rubber groves with tapping details, banana plants, boundary palms, pond/reeds and rolling hills. All new surrounds lie outside the current driving area. No road geometry, collider definitions, mission positions or terrain elevations changed.
- Added saved Auto/Battery saver graphics selection; automatic detail/shadow/resolution fallback. Graphics preferences use `en3d.display.v1`; the existing `kottakkal-drive.v1` gameplay save key/schema remain unchanged. No new dependencies or external assets.
- Validation: strict TypeScript + production build pass. All 15 unit tests passed, including actual instance bounds/culling and geometry budgets. All 5 Chromium browser tests passed: original driving/mission/tea/mobile regressions plus branding/legacy-save compatibility, camera/steering, graphics and render-budget checks. A final targeted re-run also passed after aligning the sun disc and adding preference reload/small-screen welcome checks. Replaced a fixed steering-test delay with observation of actual heading to avoid software-rendering timing flakiness.
- Measured Battery saver sample at spawn: 176 draw calls, 54,376 rendered triangles. New scenery totals: 31 meshes maximum, 68,597 expanded instance vertices, 36,960 triangles. These are bounded render costs, not a promised phone FPS. Real hardware profiling remains pending.
- Screenshots inspected at desktop and 568×320 welcome size; existing touch checks cover 844×390 and 390×844 plus narrow tea controls. No critical visual overlap found.
- Vite emits its advisory about a bundle over 500 kB (Three.js included); production build succeeds. Bundle size is about 543 kB minified / 143 kB gzip.
- Updated reusable startup draft for the EN 3D title and current checks. Draft saving does not publish. Source commits remain local; nothing was pushed or deployed, and new-task snapshot restoration has not been tested.

## Next manageable increment

Phase 2: fetch and validate a small cached OpenStreetMap Kottakkal road extract with source provenance, data license notices and visible contributor attribution. Keep this working practice loop available separately. Follow ROADMAP.md before changing road topology or save world identity. Do not invent accurate geography, junction names, elevations or posted rules.

Pending: real Kottakkal/Manjeri/Kozhikode routes, geographic landmarks, traffic signals/NPC vehicles, one-way/wrong-way/speed/red-light detection, fine deductions and saved violation history, drivable slopes/streams/bridges, rain/night/evening presets, and expansion. Traffic/fine/real-map tests are unimplemented, not passing. Preserve all working gameplay as each phase is introduced. No API keys are currently required.
