import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TimeTrackingApi } from '../time-tracking/time-tracking.api';
import { SessionResponse } from '../time-tracking/session.model';
import { SUB_TYPES, SubTypeId, subTypeInfo } from '../time-tracking/sub-types';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { describeError } from '../time-tracking/describe-error';
import { finalize, interval, Observable, switchMap } from 'rxjs';
import { formatClock } from '../time-tracking/format-clock';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

const TICK_MS = 1000;
const REFRESH_MS = 30_000;

@Component({
  imports: [DatePipe, MatButtonModule, MatCardModule, MatProgressBarModule],
  selector: 'app-today-page',
  styleUrl: './today-page.css',
  templateUrl: './today-page.html',
})
export default class TodayPage {
  private readonly api = inject(TimeTrackingApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly subTypes = SUB_TYPES;

  protected readonly session = signal<SessionResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly receivedAt = signal(Date.now());
  private readonly now = signal(Date.now());

  protected readonly status = computed(() => this.session()?.status ?? 'none');
  protected readonly canStart = computed(() => this.status() === 'none');
  protected readonly canStartSub = computed(() => this.status() === 'period');
  protected readonly canEndSub = computed(() => this.status() === 'subed');
  protected readonly canEnd = computed(() => this.status() !== 'none');

  protected readonly currentSubType = computed(() => {
    const sub = this.session()?.sub;
    return sub ? subTypeInfo(sub.periodTypeId) : undefined;
  });

  protected readonly statusLabel = computed(() => {
    switch(this.status()) {
      case 'none':
        return 'Aucune session';
      case 'period':
        return 'Travail';
      case 'subed':
        return this.currentSubType()?.statusLabel ?? 'En pause';
    }
  });

  protected readonly subs = computed(() => {
    return (this.session()?.subs ?? []).map((sub) => ({
      ...sub,
      label: subTypeInfo(sub.periodTypeId)?.startLabel ?? 'Autre'
    }));
  });

  protected readonly clock = computed(() => {
    const session = this.session();
    if (!session) return formatClock(0);

    const elapsed = session.status === 'period' ? Math.max(0, this.now() - this.receivedAt()) : 0;
    return formatClock(session.workedMs + elapsed);
  });

  constructor() {
    this.refresh();
    interval(TICK_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.busy()) this.refresh();
      });
  }

  protected refresh(): void {
    this.api.current()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => this.apply(session),
        error: (error) => {
          this.errorMessage.set(describeError(error));
          this.loading.set(false);
        }
      });
  };

  protected start(): void {
    this.run(() => this.api.start());
  }

  protected startSub(periodTypeId: SubTypeId): void {
    this.run(() => this.api.startSub(periodTypeId));
  }

  protected endSub(): void {
    this.run(() => this.api.endSub());
  }

  protected end(): void {
    this.run(() => this.api.end());
  }

  private run(action: () => Observable<SessionResponse>): void {
    if (this.busy()) return;
    this.busy.set(true);

    action()
      .pipe(
        switchMap(() => this.api.current()),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (session) => this.apply(session),
        error: (error) => this.errorMessage.set(describeError(error))
      });
  }

  private apply(session: SessionResponse): void {
    this.session.set(session);
    this.errorMessage.set(null);
    this.loading.set(false);
  }

  private fail(error: unknown): void {
    const message = describeError(error);
    this.errorMessage.set(message);
    this.snackBar.open(message, 'Fermer', { duration: 6000 });
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.refresh();
    }
  }
}
