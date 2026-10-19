import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { HealthService } from './health.service';

@Component({
  standalone: true,
  imports: [MatButtonModule],
  selector: 'app-health-status',
  template: `
    <h1> Clockout </h1>
    <p role="status">{{ message() }} </p>
    <button matButton="filled" (click)="checkApi()" [disabled]="loading()">Vérifier l'API</button>
  `,
})
export class HealthStatus {
  private readonly api = inject(HealthService);
  readonly message = signal('API non vérifiée');
  readonly loading = signal(false);

  checkApi() {
    this.loading.set(true);
    this.message.set('Vérification en cours...');
    this.api.check().subscribe({
      next: (data) => {
        this.message.set('API disponible : ' + data.service);
        this.loading.set(false);
      },
      error: () => {
        this.message.set('API indisponible.');
        this.loading.set(false);
      }
    })
  }
}
