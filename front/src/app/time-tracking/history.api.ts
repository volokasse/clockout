import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { SessionDetail, SessionPayload } from './history.model';

@Service()
export class HistoryApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/sessions';

  list(from: string, to: string) {
    return this.http.get<SessionDetail[]>(this.baseUrl, { params: { from, to }});
  }

  create(payload: SessionPayload) {
    return this.http.post<SessionDetail>(this.baseUrl, payload);
  }

  update(id: number, payload: SessionPayload) {
    return this.http.put<SessionDetail>(`${this.baseUrl}/${id}`, payload);
  }
}
