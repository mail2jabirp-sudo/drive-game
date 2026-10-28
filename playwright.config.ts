import { defineConfig } from '@playwright/test';
const port=process.env.EN3D_TEST_PORT ?? '5173';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/production.spec.ts',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 0.75,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    screenshot: 'only-on-failure',
  },
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI },
});
