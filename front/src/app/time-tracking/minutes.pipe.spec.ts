import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MinutesPipe } from './minutes.pipe';

@Component({
  imports: [MinutesPipe],
  template: `<p id="plain">{{ value | minutes }}</p>
    <p id="signed">{{ value | minutes: 'signed' }}</p>`,
})
class Host {
  value: number | null = 450;
}

describe('MinutesPipe', () => {
  const pipe = new MinutesPipe();

  it.each([
    [0, '0h00'],
    [5, '0h05'],
    [450, '7h30'],
    [2100, '35h00'],
  ])('formate %i minutes en « %s »', (value, expected) => {
    expect(pipe.transform(value)).toBe(expected);
  });

  it.each([
    [-75, '-1h15'],
    [30, '+0h30'],
    [0, '0h00'],
  ])("formate l'écart %i en « %s » avec l'option signed", (value, expected) => {
    expect(pipe.transform(value, 'signed')).toBe(expected);
  });

  it('renvoie un texte vide pour une valeur absente', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined, 'signed')).toBe('');
  });

  it('fonctionne dans un gabarit', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#plain')?.textContent).toBe('7h30');
    expect(root.querySelector('#signed')?.textContent).toBe('+7h30');
  });
});
