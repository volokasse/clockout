import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { WeeklyReport } from './report.model';

@Service()
export class ReportApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/reports/weekly';

  /** Without `date` the server answers with the current week. */
  weekly(date?: string) {
    return this.http.get<WeeklyReport>(this.baseUrl, date ? { params: { date } } : {});
  }
}
