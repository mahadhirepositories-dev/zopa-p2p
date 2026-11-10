import { Routes } from '@angular/router';

export const rateCardRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./rate-card-list.component').then(m => m.RateCardListComponent),
  },
];
