# Development checkpoints

All work belongs to `/workspace/drive-game`. Do not modify other repositories.

- Toolchain initialized: TypeScript, Three.js, Vite, npm lockfile, MIT license.
- Procedural town and rickshaw: road loop, shops, palms, plaza, bus shelter, collision bounds, animated vehicle.
- V1 complete: chase camera, mobile/keyboard input, horn, pause/reset, passenger fare and local saves.
- Validation: production build and five V1 unit tests passed. All three Chromium browser checks passed: driving/brake/reverse/horn/pause/reset, passenger pickup/delivery/save restoration, and mobile touch controls at landscape/portrait sizes. Scene screenshots inspected.

- First follow-up complete: Chaya Kada sells optional ₹10 tea; tea-break count persists and the passenger remains aboard. Version-1 saves migrate with a zero tea count.
- Final checks: clean `npm ci --cache .npm-cache`, `npm run build`, all 9 unit tests, and all 4 Chromium browser tests passed. Additional tea test re-run verified narrow 568×320 landscape controls and no card overlap. Mobile viewport checks also covered 844×390 and 390×844. Actual phone hardware has not been tested.
- Initial camera timing issue is fixed: initialize from the first animation timestamp and prevent negative frame deltas. Slow renderers reduce resolution/shadows automatically.
- Dependency licensing: runtime Three.js is MIT. The user explicitly approved BSD/ISC transitive development tools; notices are in THIRD_PARTY_NOTICES.md.
- Reusable install_script/start_skill saved in the cloud environment draft. Publication is a separate user action in environment settings. Local commits have not been pushed or deployed; new-task restoration has not been verified.

Next small feature: add a few slow traffic vehicles on the existing loop, then collision avoidance. After that: a second fare destination, then a short Manjeri spur before considering Perinthalmanna. Implement and verify one feature at a time. Keep this file current. Nothing requires an API key.
