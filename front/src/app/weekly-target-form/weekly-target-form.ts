import { Component, computed, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { map } from 'rxjs';
import {
  MAX_WEEKLY_TARGET_MINUTES,
  splitMinutes,
  toMinutes,
} from '../time-tracking/duration-input';
import { formatMinutes } from '../time-tracking/format-minutes';

const MAX_HOURS = MAX_WEEKLY_TARGET_MINUTES / 60;
const MAX_MINUTES = 59;

const integer: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  Number.isInteger(control.value) ? null : { integer: true };

/** The group is invalid when hours + minutes go beyond the weekly maximum. */
const withinMaximum: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const { hours, minutes } = group.getRawValue() as { hours: unknown; minutes: unknown };
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return toMinutes(hours as number, minutes as number) > MAX_WEEKLY_TARGET_MINUTES
    ? { tooLong: true }
    : null;
};

/** Show an error as soon as the user has typed something, not only after leaving the field. */
const showWhenEdited: ErrorStateMatcher = {
  isErrorState: (control: AbstractControl | null) =>
    !!control && control.invalid && (control.dirty || control.touched),
};

/**
 * The minutes field also carries the error of the whole group (total too long). The group is
 * "edited" as soon as one of its fields is: otherwise changing only the hours (168 h + the 30
 * minutes already there) would disable the button without any explanation.
 */
const showGroupErrorWhenEdited: ErrorStateMatcher = {
  isErrorState: (control: AbstractControl | null) => {
    if (!control) return false;
    const group = control.parent;
    const edited = control.dirty || control.touched || !!group?.dirty || !!group?.touched;
    return edited && (control.invalid || !!group?.hasError('tooLong'));
  },
};

@Component({
  selector: 'app-weekly-target-form',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  styleUrl: './weekly-target-form.css',
  templateUrl: './weekly-target-form.html',
})
export class WeeklyTargetForm {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly minutes = input.required<number>();
  readonly busy = input(false);

  readonly save = output<number>();

  protected readonly maxHours = MAX_HOURS;
  protected readonly maxMinutes = MAX_MINUTES;
  protected readonly maxLabel = formatMinutes(MAX_WEEKLY_TARGET_MINUTES);
  protected readonly hoursMatcher = showWhenEdited;
  protected readonly minutesMatcher = showGroupErrorWhenEdited;

  protected readonly form = this.fb.group(
    {
      hours: this.fb.control(0, [
        Validators.required,
        integer,
        Validators.min(0),
        Validators.max(MAX_HOURS),
      ]),
      minutes: this.fb.control(0, [
        Validators.required,
        integer,
        Validators.min(0),
        Validators.max(MAX_MINUTES),
      ]),
    },
    { validators: withinMaximum },
  );

  private readonly value = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** Preview of what will be saved ("35h00"); empty while the fields are not whole numbers. */
  protected readonly preview = computed(() => {
    const { hours, minutes } = this.value();
    const usable =
      Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && minutes >= 0;
    return usable ? formatMinutes(toMinutes(hours, minutes)) : null;
  });

  constructor() {
    effect(() => this.reset(this.minutes()));
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) return;
    const { hours, minutes } = this.form.getRawValue();
    this.save.emit(toMinutes(hours, minutes));
  }

  private reset(minutes: number): void {
    this.form.reset(splitMinutes(minutes));
  }
}
