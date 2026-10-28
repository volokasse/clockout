import type { Repository } from 'typeorm';
import { Preferences } from './entities/preferences.entity.js';
import { PreferencesService } from './preferences.service.js';
import { DEFAULT_WEEKLY_TARGET_MINUTES } from './weekly-target.js';

function createService(row: Partial<Preferences> | null) {
    const repository = {
        findOneBy: vi.fn().mockResolvedValue(row),
        upsert: vi.fn().mockResolvedValue(undefined)
    };
    const service = new PreferencesService(repository as unknown as Repository<Preferences>);
    return { service, repository };
}

describe('PreferencesService.getWeeklyTargetMinutes', () => {
    it('retourne l\'objectif enregistré', async () => {
        const { service, repository } = createService({ id: 1, weeklyTargetMinutes: 2250 });

        await expect(service.getWeeklyTargetMinutes()).resolves.toBe(2250);
        expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('retourne 0 quand l\'objectif enregistré est 0 (et non le défaut)', async () => {
        const { service } = createService({ id: 1, weeklyTargetMinutes: 0 });

        await expect(service.getWeeklyTargetMinutes()).resolves.toBe(0);
    });

    it('retourne le défaut quand la ligne est absente', async () => {
        const { service } = createService(null);

        await expect(service.getWeeklyTargetMinutes()).resolves.toBe(DEFAULT_WEEKLY_TARGET_MINUTES);
        expect(DEFAULT_WEEKLY_TARGET_MINUTES).toBe(2100);
    });
});

describe('PreferencesService.setWeeklyTargetMinutes', () => {
    it('écrit par upsert sur la ligne unique, sans toucher aux autres colonnes', async () => {
        const { service, repository } = createService({ id: 1, weeklyTargetMinutes: 2100 });

        const result = await service.setWeeklyTargetMinutes(2250);

        expect(result).toBe(2250);
        expect(repository.upsert).toHaveBeenCalledTimes(1);
        expect(repository.upsert).toHaveBeenCalledWith({ id: 1, weeklyTargetMinutes: 2250 }, ['id']);
    });

    it('propage l\'erreur de la base', async () => {
        const { service, repository } = createService(null);
        repository.upsert.mockRejectedValueOnce(new Error('connection lost'));

        await expect(service.setWeeklyTargetMinutes(300)).rejects.toThrow('connection lost');
    });
});
