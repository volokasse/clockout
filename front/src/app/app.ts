import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: {
    '(document:keydown.escape)': 'closeMenu()',
    '[class.menu-open]': 'menuOpen()'
  }
})
export class App {
  protected readonly title = signal('front');
  protected readonly menuOpen = signal(false);
  protected readonly links = [
    { path: '/today', label: "Aujourd'hui" },
    { path: '/history', label: "Historique" },
    { path: '/results', label: "Bilan" }
  ];

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
