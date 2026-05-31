import { Routes } from '@angular/router';

export const costCenterRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./cost-center-list.component').then(m => m.CostCenterListComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./cost-center-detail.component').then(m => m.CostCenterDetailComponent),
  },
];
