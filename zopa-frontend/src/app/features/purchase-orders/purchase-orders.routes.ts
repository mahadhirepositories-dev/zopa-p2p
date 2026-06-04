import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission.guard';

export const purchaseOrderRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./po-list.component').then(m => m.PoListComponent),
  },
  {
    path: 'create',
    canActivate: [permissionGuard],
    data: { module: 'purchase_orders', action: 'create' },
    loadComponent: () => import('./po-form.component').then(m => m.PoFormComponent),
  },
  {
    path: ':id/edit',
    canActivate: [permissionGuard],
    data: { module: 'purchase_orders', action: 'edit' },
    loadComponent: () => import('./po-form.component').then(m => m.PoFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./po-detail.component').then(m => m.PoDetailComponent),
  },
];
