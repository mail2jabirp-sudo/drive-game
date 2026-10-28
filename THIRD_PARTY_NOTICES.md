# Third-party notices

Artwork, signs, vehicle models and synthesized audio are created by this project. No third-party asset packs are used. Geographic road/building/water geometry additionally derives from OpenStreetMap. Map data and its adapted database are ODbL 1.0, separately from MIT code/art; see DATA_LICENSES.md and public/maps/NOTICE.txt. © OpenStreetMap contributors: https://www.openstreetmap.org/copyright.

The shipped game uses Three.js (MIT). Main tools are Vite (MIT), TypeScript (Apache-2.0), tsx (MIT), and Playwright (Apache-2.0). With user approval, the development dependency graph also retains BSD-3-Clause and ISC utilities. These tools are not shipped as game runtime libraries.

The npm lockfile records exact versions and integrity hashes. Package distributions in node_modules include their upstream licenses. Optional platform-specific packages below are recorded in the lockfile and only installed where applicable.

## Apache-2.0

- `@dimforge/rapier3d-compat 0.12.0`
- `@playwright/test 1.64.1`
- `playwright 1.64.1`
- `playwright-core 1.64.1`
- `typescript 5.9.3`

## MIT

- `@esbuild/aix-ppc64 0.28.2`
- `@esbuild/android-arm 0.28.2`
- `@esbuild/android-arm64 0.28.2`
- `@esbuild/android-x64 0.28.2`
- `@esbuild/darwin-arm64 0.28.2`
- `@esbuild/darwin-x64 0.28.2`
- `@esbuild/freebsd-arm64 0.28.2`
- `@esbuild/freebsd-x64 0.28.2`
- `@esbuild/linux-arm 0.28.2`
- `@esbuild/linux-arm64 0.28.2`
- `@esbuild/linux-ia32 0.28.2`
- `@esbuild/linux-loong64 0.28.2`
- `@esbuild/linux-mips64el 0.28.2`
- `@esbuild/linux-ppc64 0.28.2`
- `@esbuild/linux-riscv64 0.28.2`
- `@esbuild/linux-s390x 0.28.2`
- `@esbuild/linux-x64 0.28.2`
- `@esbuild/netbsd-arm64 0.28.2`
- `@esbuild/netbsd-x64 0.28.2`
- `@esbuild/openbsd-arm64 0.28.2`
- `@esbuild/openbsd-x64 0.28.2`
- `@esbuild/openharmony-arm64 0.28.2`
- `@esbuild/sunos-x64 0.28.2`
- `@esbuild/win32-arm64 0.28.2`
- `@esbuild/win32-ia32 0.28.2`
- `@esbuild/win32-x64 0.28.2`
- `@napi-rs/lzma-linux-x64-gnu 1.5.1`
- `@rollup/rollup-android-arm-eabi 4.65.1`
- `@rollup/rollup-android-arm64 4.65.1`
- `@rollup/rollup-darwin-arm64 4.65.1`
- `@rollup/rollup-darwin-x64 4.65.1`
- `@rollup/rollup-freebsd-arm64 4.65.1`
- `@rollup/rollup-freebsd-x64 4.65.1`
- `@rollup/rollup-linux-arm-gnueabihf 4.65.1`
- `@rollup/rollup-linux-arm-musleabihf 4.65.1`
- `@rollup/rollup-linux-arm64-gnu 4.65.1`
- `@rollup/rollup-linux-arm64-musl 4.65.1`
- `@rollup/rollup-linux-loong64-gnu 4.65.1`
- `@rollup/rollup-linux-loong64-musl 4.65.1`
- `@rollup/rollup-linux-ppc64-gnu 4.65.1`
- `@rollup/rollup-linux-ppc64-musl 4.65.1`
- `@rollup/rollup-linux-riscv64-gnu 4.65.1`
- `@rollup/rollup-linux-riscv64-musl 4.65.1`
- `@rollup/rollup-linux-s390x-gnu 4.65.1`
- `@rollup/rollup-linux-x64-gnu 4.65.1`
- `@rollup/rollup-linux-x64-musl 4.65.1`
- `@rollup/rollup-openbsd-x64 4.65.1`
- `@rollup/rollup-openharmony-arm64 4.65.1`
- `@rollup/rollup-win32-arm64-msvc 4.65.1`
- `@rollup/rollup-win32-ia32-msvc 4.65.1`
- `@rollup/rollup-win32-x64-gnu 4.65.1`
- `@rollup/rollup-win32-x64-msvc 4.65.1`
- `@tweenjs/tween.js 23.1.3`
- `@types/estree 1.0.9`
- `@types/stats.js 0.17.4`
- `@types/three 0.180.0`
- `@types/webxr 0.5.24`
- `esbuild 0.28.2`
- `fdir 6.5.0`
- `fflate 0.8.3`
- `fsevents 2.3.3`
- `meshoptimizer 0.22.0`
- `nanoid 3.3.20`
- `picomatch 4.0.7`
- `postcss 8.5.31`
- `rollup 4.65.1`
- `three 0.180.0`
- `tinyglobby 0.2.17`
- `tsx 4.23.15`
- `vite 7.3.7`

## BSD-3-Clause

- `@webgpu/types 0.1.74`
- `source-map-js 1.2.2`

## ISC

- `picocolors 1.1.1`

## Three.js license (runtime)

```text
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Playable fleet additions

`src/road-vehicle.ts` contains original MIT procedural compact hatchback, sedan taxi and van geometry; it does not import a manufacturer model or reference photograph. `src/fleet.ts` supplies game handling dimensions and source-road vehicle placement. Engine/horn profiles in `src/audio.ts` are synthesized substitutes, not authentic vehicle sound recordings. No additional third-party models, recordings, paid assets or dependencies were introduced. Geographic roads remain separately licensed as stated above.
