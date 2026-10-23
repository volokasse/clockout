import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TimeTrackingApi } from '../time-tracking/time-tracking.api';
import { SessionResponse } from '../time-tracking/session.model';
import { subTypeInfo } from '../time-tracking/sub-types';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { describeError } from '../time-tracking/describe-error';

@Component({
  imports: [DatePipe, MatButtonModule, MatCardModule, MatProgressBarModule],
  selector: 'app-today-page',
  styleUrl: './today-page.css',
  templateUrl: './today-page.html',
})
export default class TodayPage {
  private readonly api = inject(TimeTrackingApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly session = signal<SessionResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly status = computed(() => this.session()?.status ?? 'none');

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

  constructor() {
    this.refresh();
  }

  protected refresh(): void {
    this.api.current().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => this.apply(session),
        error: (error) => {
          this.errorMessage.set(describeError(error));
          this.loading.set(false);
        }
      });
  };

  private apply(session: SessionResponse): void {
    this.session.set(session);
    this.errorMessage.set(null);
    this.loading.set(false);
  }
}
