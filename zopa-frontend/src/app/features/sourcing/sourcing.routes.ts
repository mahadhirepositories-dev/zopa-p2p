import { Routes } from '@angular/router';

export const sourcingRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./sourcing-list.component').then(m => m.SourcingListComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./sourcing-detail.component').then(m => m.SourcingDetailComponent),
  },
];
