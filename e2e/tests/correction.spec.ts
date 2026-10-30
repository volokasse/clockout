import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.js';
import { addDays, previousMonday, toFrenchDate } from '../support/dates.js';

// L'historique n'affiche que le mois en cours par défaut : on cible le jour voulu.
async function openHistoryOn(page: Page, day: string) {
    await page.getByRole('link', { name: 'Historique' }).click();
    await page.getByLabel('Du', { exact: true }).fill(day);
    await page.getByLabel('Au', { exact: true }).fill(day);
    await page.getByRole('button', { name: 'Filtrer' }).click();
}

// Le bilan s'ouvre sur la semaine en cours : la session est dans la précédente.
async function openPreviousWeekReport(page: Page, monday: string) {
    await page.getByRole('link', { name: 'Bilan' }).click();
    await page.getByRole('button', { name: 'Semaine précédente' }).click();
    const label = `Semaine du ${toFrenchDate(monday)} au ${toFrenchDate(addDays(monday, 6))}`;
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
}

test('corriger la fin d’une pause fait passer le bilan de 7h30 à 7h45', async ({ page }) => {
    const monday = previousMonday();
    const mondayRow = page.getByRole('row', { name: /^Lundi/ });
    const totalRow = page.getByRole('row', { name: /^Total/ });

    await page.goto('/today');
    await openHistoryOn(page, monday);

    // 1. Créer la session 09:00-17:30 avec une pause 12:30-13:30.
    await page.getByRole('button', { name: 'Ajouter une session' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter une session' });
    await dialog.getByLabel('Arrivée', { exact: true }).fill(`${monday}T09:00`);
    await dialog.getByLabel('Départ', { exact: true }).fill(`${monday}T17:30`);
    await dialog.getByRole('button', { name: 'Ajouter une pause' }).click();
    const pauses = dialog.getByRole('group', { name: 'Pauses et veilles' });
    await pauses.getByLabel('Début', { exact: true }).fill(`${monday}T12:30`);
    await pauses.getByLabel('Fin', { exact: true }).fill(`${monday}T13:30`);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).toBeHidden();

    // 2. L'historique, puis le bilan, annoncent 7h30.
    const session = page.getByRole('row').filter({ hasText: toFrenchDate(monday) });
    await expect(session).toContainText('7h30');

    await openPreviousWeekReport(page, monday);
    await expect(mondayRow).toContainText('7h30');
    await expect(totalRow).toContainText('7h30');

    // 3. Corriger la fin de la pause à 13:15.
    await openHistoryOn(page, monday);
    await page.getByRole('button', { name: /Corriger la session/ }).click();
    const editor = page.getByRole('dialog', { name: 'Corriger la session' });
    await editor
        .getByRole('group', { name: 'Pauses et veilles' })
        .getByLabel('Fin', { exact: true })
        .fill(`${monday}T13:15`);
    await editor.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(editor).toBeHidden();
    await expect(session).toContainText('7h45');

    // 4. Le bilan annonce 7h45.
    await openPreviousWeekReport(page, monday);
    await expect(mondayRow).toContainText('7h45');
    await expect(totalRow).toContainText('7h45');
});
