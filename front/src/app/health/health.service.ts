import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';

export interface HealthResponse {
  status: 'ok';
  service: string;
}

@Service()
export class HealthService {
  private readonly http = inject(HttpClient);

  check() {
    return this.http.get<HealthResponse>('/api/health');
  }
}
