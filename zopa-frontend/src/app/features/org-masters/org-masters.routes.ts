import { Routes } from '@angular/router';

export const orgMastersRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./org-masters.component').then(m => m.OrgMastersComponent),
  }
];
