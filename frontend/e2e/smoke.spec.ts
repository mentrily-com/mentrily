import { test, expect, type Page } from '@playwright/test';

/**
 * Marketing/public-route smoke coverage. These assert the page renders,
 * responds 200, and throws no client-side error -- not full behavioral
 * coverage of any one page's content. Authenticated dashboard/exam flows
 * aren't reachable here: they need a seeded Clerk test account and real
 * backend data this repo has no CI fixture for (see playwright.config.ts).
 */

const PUBLIC_ROUTES = [
    '/',
    '/pricing',
    '/about',
    '/contact',
    '/careers',
    '/changelog',
    '/roadmap',
    '/status',
    '/docs',
    '/partnership',
    '/online-compilers',
    '/terms',
    '/privacy',
] as const;

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    return errors;
}

for (const route of PUBLIC_ROUTES) {
    test(`${route} loads with no console errors`, async ({ page }) => {
        const errors = collectPageErrors(page);

        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${route} should respond 200`).toBe(200);

        // Chunk hydration and any client-side data fetch happen after
        // domcontentloaded, so give the page a moment before asserting on
        // console output.
        await page.waitForTimeout(1000);

        expect(errors, `${route} should log no console/page errors`).toEqual([]);
    });
}

test('homepage renders primary navigation and a call to action', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav, header').first()).toBeVisible();
    // At least one CTA into the signed-up product -- the actual copy varies,
    // but a marketing homepage with no path into signup/login is broken.
    await expect(
        page.getByRole('link', { name: /sign up|start free|get started|log in|sign in/i }).first(),
    ).toBeVisible();
});

test('pricing page lists at least one plan', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/\$|free|plan/i).first()).toBeVisible();
});

test('mobile navigation drawer opens, traps focus, and closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pricing');

    const menuButton = page.getByRole('button', { name: /open menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const drawer = page.locator('[role="dialog"][aria-label="Mobile navigation"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('aria-modal', 'true');

    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).toBe('hidden');

    const focusInsideDrawer = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Mobile navigation"]');
        return dialog ? dialog.contains(document.activeElement) : false;
    });
    expect(focusInsideDrawer).toBe(true);

    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
});

test('404 route renders a not-found page rather than crashing', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-anywhere');
    expect(response?.status()).toBe(404);
});
