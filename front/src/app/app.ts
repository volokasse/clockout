import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HealthStatus } from './health/health-status';

@Component({
  imports: [RouterOutlet, HealthStatus],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('front');
}
