import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { HistoryApi } from '../time-tracking/history.api';
import { formatDuration } from '../time-tracking/format-duration';
import { firstDayOfMonth, lastDayofMonth, startOfDay, startOfNextDay } from '../time-tracking/date-range';
import { SessionDetail } from '../time-tracking/history.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { describeError } from '../time-tracking/describe-error';
import { SessionDialogData, SessionDialog } from '../session-dialog/session-dialog';
import { subTypeInfo } from '../time-tracking/sub-types';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';

@Component({
  imports: [
    DatePipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatProgressBarModule, MatTableModule
  ],
  selector: 'app-history-page',
  styleUrl: './history-page.css',
  templateUrl: './history-page.html',
})
export default class HistoryPage {
  private readonly api = inject(HistoryApi);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly columns = ['date', 'arrival', 'departure', 'subs', 'duration', 'status', 'actions'];
  protected readonly formatDuration = formatDuration;

  protected readonly filter = this.fb.group({
    from: this.fb.control(firstDayOfMonth()),
    to: this.fb.control(lastDayofMonth())
  });

  protected readonly sessions = signal<SessionDetail[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    const { from, to } = this.filter.getRawValue();
    if(!from || !to || from > to) {
      this.errorMessage.set('La période est invalide : la date de début doit précéder la date de fin');
      return;
    }

    this.loading.set(true);
    this.api
      .list(startOfDay(from), startOfNextDay(to))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
          this.errorMessage.set(null);
          this.loading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(describeError(error));
          this.loading.set(false);
        }
      });
  }

  protected openEditor(session: SessionDetail | null): void {
    const data: SessionDialogData = { session };
    this.dialog
      .open(SessionDialog, { data, width: '760px', maxWidth: '96vw' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }

  protected subLabel(periodTypeId: number): string {
    return subTypeInfo(periodTypeId)?.startLabel ?? 'Autre';
  }

  protected sameDay(session: SessionDetail): boolean {
    return !session.end || new Date(session.start).toDateString() === new Date(session.end).toDateString();
  }
}
