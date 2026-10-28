import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeeklyTargetForm } from './weekly-target-form';

describe('WeeklyTargetForm', () => {
  let fixture: ComponentFixture<WeeklyTargetForm>;
  let emitted: number[];

  const root = () => fixture.nativeElement as HTMLElement;
  const fields = () =>
    Array.from(root().querySelectorAll('input[type="number"]')) as HTMLInputElement[];
  const submitButton = () => root().querySelector('button[type="submit"]') as HTMLButtonElement;
  const errors = () =>
    Array.from(root().querySelectorAll('mat-error')).map((e) =>
      e.textContent?.replace(/\s+/g, ' ').trim(),
    );
  const preview = () => root().querySelector('.preview')?.textContent?.replace(/\s+/g, ' ').trim();

  async function open(minutes: number, busy = false) {
    fixture = TestBed.createComponent(WeeklyTargetForm);
    emitted = [];
    fixture.componentInstance.save.subscribe((value) => emitted.push(value));
    fixture.componentRef.setInput('minutes', minutes);
    fixture.componentRef.setInput('busy', busy);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function type(field: HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [WeeklyTargetForm] }));

  it("préremplit les heures et les minutes à partir de l'objectif en minutes", async () => {
    await open(2250);

    expect(fields().map((f) => f.value)).toEqual(['37', '30']);
    expect(preview()).toContain('= 37h30');
  });

  it("se réinitialise quand l'objectif reçu change", async () => {
    await open(2100);
    await type(fields()[0], '12');

    fixture.componentRef.setInput('minutes', 450);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fields().map((f) => f.value)).toEqual(['7', '30']);
    expect(preview()).toContain('= 7h30');
  });

  it('associe un libellé visible à chaque champ', async () => {
    await open(2100);

    const labels = fields().map((f) =>
      root().querySelector(`label[for="${f.id}"]`)?.textContent?.trim(),
    );

    expect(labels).toEqual(['Heures', 'Minutes']);
  });

  it("met à jour l'aperçu du total pendant la saisie", async () => {
    await open(2100);

    await type(fields()[0], '7');
    await type(fields()[1], '5');

    expect(preview()).toContain('= 7h05');
  });

  it.each([
    [0, 0, true],
    [35, 0, true],
    [0, 59, true],
    [167, 59, true],
    [168, 0, true],
    [-1, 0, false],
    [0, -1, false],
    [0, 60, false],
    [169, 0, false],
    [1.5, 0, false],
    [0, 0.5, false],
    [168, 1, false],
    [168, 59, false],
  ])('heures=%s minutes=%s : formulaire valide = %s', async (hours, minutes, valid) => {
    await open(2100);

    await type(fields()[0], String(hours));
    await type(fields()[1], String(minutes));

    expect(submitButton().disabled).toBe(!valid);
    expect(errors().filter(Boolean).length > 0).toBe(!valid);
  });

  it.each([
    ['', '0', "Saisissez un nombre d'heures."],
    ['e', '0', "Saisissez un nombre d'heures."],
    ['-1', '0', 'Les heures vont de 0 à 168.'],
    ['169', '0', 'Les heures vont de 0 à 168.'],
    ['1.5', '0', 'Les heures doivent être un nombre entier.'],
    ['1', '', 'Saisissez un nombre de minutes.'],
    ['1', '60', 'Les minutes vont de 0 à 59.'],
    ['1', '-5', 'Les minutes vont de 0 à 59.'],
    ['1', '0.5', 'Les minutes doivent être un nombre entier.'],
    ['168', '30', "L'objectif ne peut pas dépasser 168h00."],
  ])('heures="%s" minutes="%s" : affiche « %s »', async (hours, minutes, message) => {
    await open(2100);

    await type(fields()[0], hours);
    await type(fields()[1], minutes);

    expect(errors()).toContain(message);
  });

  it('explique pourquoi le bouton est désactivé quand seules les heures ont été modifiées', async () => {
    await open(6030); // 100h30 : les 30 minutes restent, 168h+ 30 min dépasse le maximum

    await type(fields()[0], '168');

    expect(submitButton().disabled).toBe(true);
    expect(errors()).toEqual(["L'objectif ne peut pas dépasser 168h00."]);
  });

  it('accepte la notation scientifique comprise par le navigateur (1e2 = 100 h)', async () => {
    await open(2100);

    await type(fields()[0], '1e2');
    submitButton().click();

    expect(emitted).toEqual([6000]);
  });

  it('refuse une valeur négative : message, bouton désactivé, aucune émission', async () => {
    await open(2100);

    await type(fields()[0], '-3');
    submitButton().click();
    fixture.detectChanges();

    expect(errors()).toEqual(['Les heures vont de 0 à 168.']);
    expect(fields()[0].getAttribute('aria-invalid')).toBe('true');
    expect(submitButton().disabled).toBe(true);
    expect(emitted).toEqual([]);
  });

  it('ne montre aucune erreur tant que la saisie est valide', async () => {
    await open(2100);

    await type(fields()[0], '40');

    expect(errors()).toEqual([]);
    expect(fields()[0].getAttribute('aria-invalid')).not.toBe('true');
  });

  it("émet l'objectif en minutes à l'envoi", async () => {
    await open(2100);

    await type(fields()[0], '37');
    await type(fields()[1], '30');
    submitButton().click();

    expect(emitted).toEqual([2250]);
  });

  it("accepte l'objectif nul et l'objectif maximal", async () => {
    await open(2100);

    await type(fields()[0], '0');
    submitButton().click();
    await type(fields()[0], '168');
    await type(fields()[1], '0');
    submitButton().click();

    expect(emitted).toEqual([0, 10_080]);
  });

  it('désactive le bouton et ignore la soumission pendant un enregistrement', async () => {
    await open(2100, true);

    submitButton().click();
    root().querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(submitButton().disabled).toBe(true);
    expect(emitted).toEqual([]);
  });
});
