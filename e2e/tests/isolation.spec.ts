import { test, expect } from '../fixtures.js';
import { readSessions } from '../support/database.js';

// Deux tests volontairement « voisins » : le premier laisse une session ouverte,
// le second exige une base vide. Il doit réussir seul comme après le premier.
test('laisse une session ouverte derrière lui', async ({ page, pool }) => {
    await page.goto('/today');
    await page.getByRole('button', { name: 'Commencer' }).click();

    await expect(page.getByText('Travail', { exact: true })).toBeVisible();
    expect(await readSessions(pool)).toHaveLength(1);
});

test('repart d’une base vide, quoi qu\'ait fait le test précédent', async ({ page, pool }) => {
    expect(await readSessions(pool)).toHaveLength(0);

    await page.goto('/today');
    await expect(page.getByText('Aucune session')).toBeVisible();
});
