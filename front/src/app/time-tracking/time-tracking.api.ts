import { HttpClient } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { SessionResponse } from "./session.model";
import { SubTypeId } from "./sub-types";

@Service()
export class TimeTrackingApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/time-tracking';

  private prepUrl(route: string) {
    return `${this.baseUrl}/${route}`;
  }

  current() {
    return this.http.get<SessionResponse>(this.prepUrl('current'));
  }

  start() {
    return this.http.post<SessionResponse>(this.prepUrl('start'), {});
  }

  startSub(periodTypeId: SubTypeId) {
    return this.http.post<SessionResponse>(this.prepUrl('startSub'), { periodTypeId });
  }

  endSub() {
    return this.http.post<SessionResponse>(this.prepUrl('endSub'), {});
  }

  end() {
    return this.http.post<SessionResponse>(this.prepUrl('end'), {});
  }
}
