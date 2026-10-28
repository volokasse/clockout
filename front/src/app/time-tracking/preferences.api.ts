import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';

export interface WeeklyTarget {
  minutes: number;
}

@Service()
export class PreferencesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/preferences/weekly-target';

  weeklyTarget() {
    return this.http.get<WeeklyTarget>(this.baseUrl);
  }

  updateWeeklyTarget(minutes: number) {
    return this.http.put<WeeklyTarget>(this.baseUrl, { minutes });
  }
}
