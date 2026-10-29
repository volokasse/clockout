import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { catchError, finalize, map, of, Subject, switchMap } from 'rxjs';
import { describeError } from '../time-tracking/describe-error';
import { MinutesPipe } from '../time-tracking/minutes.pipe';
import { PreferencesApi } from '../time-tracking/preferences.api';
import { ReportApi } from '../time-tracking/report.api';
import { WeeklyReport } from '../time-tracking/report.model';
import { WeeklyTargetForm } from '../weekly-target-form/weekly-target-form';

/** The server always sends 7 days, Monday first: the name is picked by position. */
const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

type Outcome = { report: WeeklyReport } | { error: unknown };

@Component({
  imports: [
    DatePipe,
    MatButtonModule,
    MatProgressBarModule,
    MatTableModule,
    MinutesPipe,
    WeeklyTargetForm,
  ],
  selector: 'app-results-page',
  styleUrl: './results-page.css',
  templateUrl: './results-page.html',
})
export default class ResultsPage {
  private readonly reports = inject(ReportApi);
  private readonly preferences = inject(PreferencesApi);
  private readonly destroyRef = inject(DestroyRef);

  /** One value per week to display: `undefined` means "current week" (no `date` parameter). */
  private readonly requests = new Subject<string | undefined>();
  private lastRequested: string | undefined;

  protected readonly columns = ['day', 'sessions', 'worked'];
  protected readonly dayNames = DAY_NAMES;

  protected readonly report = signal<WeeklyReport | null>(null);
  protected readonly incompleteSessions = computed(() => this.report()?.incompleteSessions ?? []);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly savingTarget = signal(false);
  protected readonly targetError = signal<string | null>(null);

  constructor() {
    this.requests
      .pipe(
        // switchMap cancels the previous request: a late answer for an older week can never
        // replace the week the user asked for last.
        switchMap((date) =>
          this.reports.weekly(date).pipe(
            map((report): Outcome => ({ report })),
            // The error is caught inside so that the stream survives and the user can retry.
            catchError((error) => of<Outcome>({ error })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((outcome) => {
        if ('report' in outcome) {
          this.report.set(outcome.report);
          this.errorMessage.set(null);
        } else {
          this.errorMessage.set(describeError(outcome.error));
        }
        this.loading.set(false);
      });

    this.show();
  }

  /** Shows the week of `date`, or the current week when omitted. */
  protected show(date?: string): void {
    this.lastRequested = date;
    this.loading.set(true);
    this.requests.next(date);
  }

  protected reload(): void {
    this.show(this.lastRequested);
  }

  protected saveTarget(minutes: number): void {
    if (this.savingTarget()) return;
    this.savingTarget.set(true);
    this.targetError.set(null);

    this.preferences
      .updateWeeklyTarget(minutes)
      .pipe(
        finalize(() => this.savingTarget.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.reload(),
        error: (error) =>
          this.targetError.set(`L'objectif n'a pas été enregistré. ${describeError(error)}`),
      });
  }
}
