import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

const ADMIN_ROLES = ['zopa_super_admin', 'zopa_buyer', 'client_admin', 'client_buyer'];

export const vendorRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./vendor-list.component').then(m => m.VendorListComponent),
  },
  {
    path: 'create',
    loadComponent: () => import('./vendor-form.component').then(m => m.VendorFormComponent),
    canActivate: [roleGuard], data: { roles: ADMIN_ROLES },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./vendor-form.component').then(m => m.VendorFormComponent),
    canActivate: [roleGuard], data: { roles: ADMIN_ROLES },
  },
  {
    path: ':id',
    loadComponent: () => import('./vendor-detail.component').then(m => m.VendorDetailComponent),
  },
];
