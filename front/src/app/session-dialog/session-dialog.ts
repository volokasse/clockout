import { Component, DestroyRef, inject, signal } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { SessionForm } from "../session-form.ts/session-form";
import { SessionDetail, SessionPayload, Violation } from "../time-tracking/history.model";
import { HistoryApi } from "../time-tracking/history.api";
import { finalize } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { describeError } from "../time-tracking/describe-error";
import { HttpErrorResponse } from "@angular/common/http";


export interface SessionDialogData {
  session: SessionDetail | null;
}

@Component({
  selector: 'app-session-dialog',
  imports: [MatDialogModule, SessionForm],
  styleUrl: './session-dialog.css',
  templateUrl: './session-dialog.html'
})
export class SessionDialog {
  protected readonly data = inject<SessionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<SessionDialog, boolean>>(MatDialogRef);
  private readonly api = inject(HistoryApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly title = this.data.session ? 'Corriger la session' : 'Ajouter une session';
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly violations = signal<Violation[]>([]);

  protected save(payload: SessionPayload): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.violations.set([]);
    this.errorMessage.set(null);

    const request = this.data.session
      ? this.api.update(this.data.session.id, payload)
      : this.api.create(payload);

    request
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error) => {
          if (error instanceof HttpErrorResponse && error.status === 422) {
            this.violations.set(error.error?.violations ?? []);
          }
          else {
            this.errorMessage.set(describeError(error));
          }
        }
      });
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
