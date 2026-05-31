import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

const TRANSACT_ROLES = ['zopa_super_admin', 'zopa_buyer', 'client_admin', 'client_buyer'];

export const purchaseOrderRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./po-list.component').then(m => m.PoListComponent),
  },
  {
    path: 'create',
    canActivate: [roleGuard],
    data: { roles: TRANSACT_ROLES },
    loadComponent: () => import('./po-form.component').then(m => m.PoFormComponent),
  },
  {
    path: ':id/edit',
    canActivate: [roleGuard],
    data: { roles: TRANSACT_ROLES },
    loadComponent: () => import('./po-form.component').then(m => m.PoFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./po-detail.component').then(m => m.PoDetailComponent),
  },
];
