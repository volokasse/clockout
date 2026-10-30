import { test, expect } from '../fixtures.js';

test("l'application s'ouvre sur l'écran Aujourd'hui", async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/today$/);
    await expect(page).toHaveTitle("Aujourd'hui");
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
    await expect(page.getByRole('link', { name: "Aujourd'hui" })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Aucune session')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Commencer' })).toBeEnabled();
});
