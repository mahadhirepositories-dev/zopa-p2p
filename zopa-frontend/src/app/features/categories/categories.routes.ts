import { Routes } from '@angular/router';

export const categoryRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./category-list.component').then(m => m.CategoryListComponent),
  },
];
