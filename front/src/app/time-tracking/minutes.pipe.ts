import { Pipe, PipeTransform } from '@angular/core';
import { formatMinutes, formatSignedMinutes } from './format-minutes';

/** `{{ 450 | minutes }}` -> "7 h 30" ; `{{ -75 | minutes: 'signed' }}` -> "-1 h 15". */
@Pipe({ name: 'minutes' })
export class MinutesPipe implements PipeTransform {
  transform(value: number | null | undefined, style?: 'signed'): string {
    if (value === null || value === undefined) return '';
    return style === 'signed' ? formatSignedMinutes(value) : formatMinutes(value);
  }
}
