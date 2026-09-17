import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-test config, not a full e2e suite: authenticated dashboard flows
 * need a seeded Clerk test account and real backend data this repo has no
 * standing fixture for, so e2e/smoke.spec.ts only covers the marketing/
 * public surface. `next dev` (not a production build) is the target
 * server -- CI cost of a full build just to smoke-test routing and basic
 * rendering isn't worth it, and this app's `output: 'standalone'` build
 * doesn't work with `next start` at all (see next.config.ts / the startup
 * warning it logs).
 *
 * Requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in the
 * environment -- Clerk's middleware wraps every route, public ones
 * included, and throws on boot without them.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    timeout: 30_000,
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command: 'npm run dev -- -p 3100',
              url: 'http://127.0.0.1:3100',
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
          },
});
