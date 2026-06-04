import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission.guard';

export const invoiceRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./invoice-list.component').then(m => m.InvoiceListComponent),
  },
  {
    path: 'create',
    canActivate: [permissionGuard],
    data: { module: 'invoices', action: 'create' },
    loadComponent: () => import('./invoice-form.component').then(m => m.InvoiceFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./invoice-detail.component').then(m => m.InvoiceDetailComponent),
  },
];
