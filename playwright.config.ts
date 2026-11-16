import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright pour la suite de tests de régression VMM-PROD.
 * Résolutions requises :
 * Desktop : 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080 (Chromium)
 * Mobile : 390×844, 390×664, 360×740, 430×932 (WebKit pour iPhone, Chromium pour Android)
 */

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}',
  expect: {
    timeout: 15000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    // --- Projets Desktop (Chromium) ---
    {
      name: 'desktop-1280x720',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'desktop-1366x768',
      use: {
        browserName: 'chromium',
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: 'desktop-1440x900',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'desktop-1536x864',
      use: {
        browserName: 'chromium',
        viewport: { width: 1536, height: 864 },
      },
    },
    {
      name: 'desktop-1920x1080',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
      },
    },

    // --- Projets Mobile (WebKit pour iPhone, Chromium pour Android) ---
    {
      name: 'mobile-iphone-390x844',
      use: {
        browserName: 'webkit',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-iphone-390x664',
      use: {
        browserName: 'webkit',
        viewport: { width: 390, height: 664 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-android-360x740',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-iphone-430x932',
      use: {
        browserName: 'webkit',
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
