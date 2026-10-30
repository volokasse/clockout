import { test, expect } from '../fixtures.js';
import { readSessions } from '../support/database.js';

test('pointage complet : commencer, pause, reprise, terminer', async ({ page, pool }) => {
    const status = (label: string) => page.getByText(label, { exact: true });
    const button = (name: string) => page.getByRole('button', { name, exact: true });

    await page.goto('/today');
    await expect(status('Aucune session')).toBeVisible();

    // Commencer
    await button('Commencer').click();
    await expect(status('Travail')).toBeVisible();
    await expect(button('Commencer')).toBeHidden();
    await expect(button('Pause')).toBeEnabled();
    await expect(button('Terminer')).toBeEnabled();

    // Pause
    await button('Pause').click();
    await expect(status('En pause')).toBeVisible();
    await expect(button('Reprendre')).toBeEnabled();
    await expect(button('Pause')).toBeHidden();

    // Reprise
    await button('Reprendre').click();
    await expect(status('Travail')).toBeVisible();
    await expect(button('Reprendre')).toBeHidden();

    // Terminer
    await button('Terminer').click();
    await expect(status('Aucune session')).toBeVisible();
    await expect(button('Commencer')).toBeEnabled();

    // L'historique montre la session terminée, avec sa pause.
    await page.getByRole('link', { name: 'Historique' }).click();
    await expect(page.getByRole('heading', { name: 'Historique', level: 1 })).toBeVisible();

    const rows = page
        .getByRole('table', { name: 'Historique des sessions' })
        .getByRole('row')
        .filter({ has: page.getByRole('button', { name: /Corriger la session/ }) });
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Terminée');
    await expect(rows.first()).toContainText('Pause');

    // Et PostgreSQL le confirme : une seule session, avec une heure de fin.
    const sessions = await readSessions(pool);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].end).not.toBeNull();
});
