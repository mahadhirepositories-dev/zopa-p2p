import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

const TRANSACT_ROLES = ['zopa_super_admin', 'zopa_buyer', 'client_admin', 'client_buyer'];

export const invoiceRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./invoice-list.component').then(m => m.InvoiceListComponent),
  },
  {
    path: 'create',
    canActivate: [roleGuard],
    data: { roles: TRANSACT_ROLES },
    loadComponent: () => import('./invoice-form.component').then(m => m.InvoiceFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./invoice-detail.component').then(m => m.InvoiceDetailComponent),
  },
];
