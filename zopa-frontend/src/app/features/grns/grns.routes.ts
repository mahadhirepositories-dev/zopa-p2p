import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

const TRANSACT_ROLES = ['zopa_super_admin', 'zopa_buyer', 'client_admin', 'client_buyer'];

export const grnRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./grn-list.component').then(m => m.GrnListComponent),
  },
  {
    path: 'create',
    canActivate: [roleGuard],
    data: { roles: TRANSACT_ROLES },
    loadComponent: () => import('./grn-form.component').then(m => m.GrnFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./grn-detail.component').then(m => m.GrnDetailComponent),
  },
];
