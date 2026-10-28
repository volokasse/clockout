import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WeeklyTargetDto } from './weekly-target.dto.js';

const errorsFor = (body: object) => validate(plainToInstance(WeeklyTargetDto, body));

describe('WeeklyTargetDto', () => {
    it.each([
        ['zéro', 0],
        ['une valeur courante', 450],
        ['le défaut', 2100],
        ['le maximum (7 x 24 h)', 10_080]
    ])('accepte %s : %i', async (_label, minutes) => {
        expect(await errorsFor({ minutes })).toHaveLength(0);
    });

    it.each([
        ['une valeur négative', -1],
        ['un décimal', 1.5],
        ['un texte numérique', '450'],
        ['du texte', 'abc'],
        ['null', null],
        ['un booléen', true],
        ['un tableau', [450]],
        ['un dépassement du maximum', 10_081],
        ['un nombre énorme', 1e12],
        ['une valeur infinie', Infinity]
    ])('refuse %s : %j', async (_label, minutes) => {
        const errors = await errorsFor({ minutes });

        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('minutes');
    });

    it('refuse un corps sans minutes', async () => {
        const errors = await errorsFor({});

        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('minutes');
    });
});
