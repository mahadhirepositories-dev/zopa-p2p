import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission.guard';

export const grnRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./grn-list.component').then(m => m.GrnListComponent),
  },
  {
    path: 'create',
    canActivate: [permissionGuard],
    data: { module: 'grns', action: 'create' },
    loadComponent: () => import('./grn-form.component').then(m => m.GrnFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./grn-detail.component').then(m => m.GrnDetailComponent),
  },
];
