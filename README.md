# Kottakkal Drive 3D

A small, stylized browser auto-rickshaw game inspired by Kottakkal, Malappuram, Kerala. The neighbourhood is fictional: it is not a real street map. All scenery, signs, vehicle geometry and audio are generated locally. No paid assets, accounts, API keys or runtime network requests are needed.

## Develop

Requires Node.js **20.19+ or 22.12+** and npm (tested here with Node 24).

```sh
npm ci --cache .npm-cache
npm run dev
```

Use the existing checkout. Each cloud task already has an isolated environment; do not create an extra Git worktree. Vite listens on port 5173 (or the next free port). Access the server using your development environment's supported browser connection. WebGL2 and hardware acceleration are recommended. A small-screen device gets touch controls; landscape gives more room to see the road. Slow renderers automatically use lower resolution and turn off shadows.

```sh
npm run build       # strict TypeScript checking + production output in dist/
npm run preview     # serve the production output
npm test            # driving, collision, mission and save tests
npm run test:browser
```

Browser checks use Playwright and an installed Chromium at `/usr/bin/chromium`. Set `CHROMIUM_PATH` if yours is elsewhere. Browser tests include keyboard/touch input, pickup, delivery and saved-state restoration. They seed saved positions to test delivery without a lengthy automated road trip. Unit tests exercise driving and the mission rules separately. The application does not depend on Playwright at runtime.

## Drive

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | W / ↑ | GO pedal |
| Brake, then reverse | S / ↓ | BRAKE / REV pedal |
| Steer | A D / ← → | Arrow buttons |
| Handbrake | Space | P button |
| Horn | H | Note button |
| Pick up / drop off | E | Mission button |
| Return auto to road | R | Reset icon |
| Pause / resume | P / Escape | Pause icon |

The auto starts on Bakery Road, pointing toward the first passenger. Follow the gold marker and map, stop within 8 metres, then press **E** or the mission button. Carry the passenger around the road loop to the teal marker at the market bus stand. Stop and interact again to earn **₹120**. Another fare then becomes available. There is no timer, penalty or traffic in V1, so take your time. You can roam the town off the roads at a lower speed.

Earnings, completed trips, tea-break count, active passenger, position and heading save to this browser's local storage every two seconds, at interactions, on pause and on exit. Refreshing restores the ride. Private browsing or blocked storage can make saves temporary; the HUD reports storage failures. R resets only the vehicle, preserving your fare and money. Browser site-data clearing starts a fresh game. Saves stay on the device; there is no cloud account.

## Project map

- `src/main.ts`: scene lifecycle, chase camera, mission markers and HUD
- `src/world.ts`: generated town, scenery and collision bounds
- `src/vehicle.ts`: generated rickshaw and animation
- `src/driving.ts`: independent driving/collision model
- `src/input.ts`: keyboard and simultaneous pointer controls
- `src/progress.ts`: versioned save parsing and passenger mission rules
- `src/audio.ts`: user-gesture initialized synthesized engine/horn
- `src/style.css`, `index.html`: responsive interface

## Small next steps

1. **Done:** tea-shop interaction at Chaya Kada (₹10, with saved tea-break count).
2. A few slow vehicles following the existing loop, then simple collision avoidance.
3. A second passenger destination and a choice of fares.
4. A short Manjeri road spur; expand toward Perinthalmanna after the loop is stable.

Implement and verify one small feature at a time. `PROGRESS.md` records checkpoints and outstanding work so another session can resume without guessing.

## Licensing

Original code and generated artwork are MIT licensed; see `LICENSE`. Runtime dependency Three.js is MIT. Primary tools are MIT/Apache-2.0; user-approved BSD-3-Clause and ISC transitive development utilities are also retained. See `THIRD_PARTY_NOTICES.md`; dependency lockfile pins the installed graph. No downloaded art, models, music, fonts or map data are included.

### Tea stop

Chaya Kada is on the west side of the loop (the small terracotta map dot). Park in the circle outside the shop. Press E, use the mission interaction button, or tap **Have chai · ₹10**. Tea costs ₹10 and adds one saved tea break. It is optional, has no timer or performance bonus, and preserves your passenger. Complete a fare first to afford a cup.
