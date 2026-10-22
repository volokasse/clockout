import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/today',
    pathMatch: 'full'
  },
  {
    path: 'today',
    title: "Aujourd'hui",
    loadComponent: () => import('./today-page/today-page')
  },
  {
    path: 'history',
    title: "Historique",
    loadComponent: () => import('./history-page/history-page')
  },
  {
    path: 'results',
    title: "Bilan",
    loadComponent: () => import('./results-page/results-page')
  },
  {
    path: '**',
    redirectTo: '/today'
  }
];
