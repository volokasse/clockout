import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { SUB_TYPES, SubTypeId } from "../time-tracking/sub-types";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { Component, effect, inject, input, output } from "@angular/core";
import { SessionDetail, SessionPayload } from "../time-tracking/history.model";
import { emptySub, SubFormValue, toFormValue, toPayload } from "../time-tracking/session-form.model";

type SubGroup = FormGroup<{
  periodTypeId: FormControl<SubTypeId>;
  start: FormControl<string>;
  end: FormControl<string>;
}>;

@Component({
  selector: 'app-session-form',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  styleUrl: './session-form.css',
  templateUrl: './session-form.html'
})
export class SessionForm {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly session = input<SessionDetail | null>(null);
  readonly busy = input(false);

  readonly save = output<SessionPayload>();
  readonly cancelled = output<void>();

  protected readonly subTypes = SUB_TYPES;
  protected readonly form = this.fb.group({
      start: this.fb.control('', Validators.required),
      end: this.fb.control(''),
      note: this.fb.control('', Validators.maxLength(500)
    ),
    subs: this.fb.array<SubGroup>([])
  });

  constructor() {
    effect(() => this.load(this.session()));
  }

  protected get subs() {
    return this.form.controls.subs;
  }

  protected addSub(): void {
    this.subs.push(this.newSub(emptySub()));
  }

  protected removeSub(index: number): void {
    this.subs.removeAt(index);
    this.form.markAsDirty();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit(toPayload(this.form.getRawValue()));
  }

  private load(session: SessionDetail | null): void {
    const value = toFormValue(session);
    this.subs.clear();
    value.subs.forEach((sub) => this.subs.push(this.newSub(sub)));
    this.form.patchValue({ start: value.start, end: value.end, note: value.note });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private newSub(value: SubFormValue): SubGroup {
    return this.fb.group({
      periodTypeId: this.fb.control(value.periodTypeId),
      start: this.fb.control(value.start, Validators.required),
      end: this.fb.control(value.end)
    });
  }
}
