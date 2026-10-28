import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Preferences } from './entities/preferences.entity.js';
import { DEFAULT_WEEKLY_TARGET_MINUTES } from './weekly-target.js';

// The preferences table holds a single row, whose id is 1 (CHECK constraint)
const SINGLETON_ID = 1;

@Injectable()
export class PreferencesService {
    constructor(
        @InjectRepository(Preferences)
        private readonly preferences: Repository<Preferences>
    ) {}

    async getWeeklyTargetMinutes(): Promise<number> {
        const row = await this.preferences.findOneBy({ id: SINGLETON_ID });
        return row?.weeklyTargetMinutes ?? DEFAULT_WEEKLY_TARGET_MINUTES;
    }

    // Upsert: also works if the row is missing, and only overwrites the target
    // (the other columns, such as time_zone, keep their value).
    async setWeeklyTargetMinutes(minutes: number): Promise<number> {
        await this.preferences.upsert(
            { id: SINGLETON_ID, weeklyTargetMinutes: minutes },
            ['id']
        );
        return minutes;
    }
}
