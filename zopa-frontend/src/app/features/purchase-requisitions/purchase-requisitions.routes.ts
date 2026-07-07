import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission.guard';

export const prRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pr-list.component').then(m => m.PrListComponent),
  },
  {
    path: 'create',
    canActivate: [permissionGuard],
    data: { module: 'purchase_requisitions', action: 'create' },
    loadComponent: () => import('./pr-form.component').then(m => m.PrFormComponent),
  },
  {
    path: ':id/edit',
    canActivate: [permissionGuard],
    data: { module: 'purchase_requisitions', action: 'update' },
    loadComponent: () => import('./pr-form.component').then(m => m.PrFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./pr-detail.component').then(m => m.PrDetailComponent),
  },
];
