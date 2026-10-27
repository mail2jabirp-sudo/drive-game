# Vercel deployment

The old Ready/404 deployment built commit292f3b8, which contained only map.osm. It did not contain the game entry point, package.json or Vite source. The complete game history is retained from codex/en3d-osm-kottakkal (28acc5c), and main is advanced normally to include it and vercel.json. No force-push or history replacement is needed.

Use these project settings in Vercel:

- Production Branch: main
- Root Directory: repository root (leave blank; do not select src or dist)
- Framework Preset: Vite
- Install Command: npm ci
- Build Command: npm run build
- Output Directory: dist
- Node.js: 24.x (the app was tested on Node24)

vercel.json supplies the framework/build/output/install values. Existing project dashboard overrides, repository connection and deployment promotion still need checking in the Vercel account. The build runs a Python3 standard-library map checksum check before TypeScript/Vite; inspect build logs if the selected build environment lacks python3. No API keys or runtime Python backend are needed. Keep development dependencies installed for TypeScript/Vite.

After main updates, the connected Git integration should create a new deployment. Confirm its source commit includes this file, index.html, src and package.json, rather than the old map-only commit. If no deployment starts, create a fresh deployment from the latest main. Redeploying the old292f3b8 deployment rebuilds the wrong source. Promote the correct successful deployment to Production if necessary and verify the project's production domain points to it.

The site root serves dist/index.html. The game selects areas with ?world=osm and ?world=practice; no catch-all path rewrite is required. Check hashed /assets/ JS/CSS, /maps/kottakkal.json and /maps/NOTICE.txt. Preserve visible OpenStreetMap attribution. Browser saves are origin-specific; a new domain does not automatically share saves from localhost or a different deployment URL.

Local verification: npm run build and npm run test:production. These test the compiled site, both areas, driving/save/reload and actual assets. They do not prove that Vercel has deployed or promoted the new source; verify that using the actual site URL and Vercel deployment commit/logs.
