import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

const TRANSACT_ROLES = ['zopa_super_admin', 'zopa_buyer', 'client_admin', 'client_buyer'];

export const prRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pr-list.component').then(m => m.PrListComponent),
  },
  {
    path: 'create',
    canActivate: [roleGuard],
    data: { roles: TRANSACT_ROLES },
    loadComponent: () => import('./pr-form.component').then(m => m.PrFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./pr-detail.component').then(m => m.PrDetailComponent),
  },
];
