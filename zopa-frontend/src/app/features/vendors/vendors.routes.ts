import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission.guard';

export const vendorRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./vendor-list.component').then(m => m.VendorListComponent),
  },
  {
    path: 'create',
    canActivate: [permissionGuard],
    data: { module: 'vendors', action: 'create' },
    loadComponent: () => import('./vendor-form.component').then(m => m.VendorFormComponent),
  },
  {
    path: ':id/edit',
    canActivate: [permissionGuard],
    data: { module: 'vendors', action: 'edit' },
    loadComponent: () => import('./vendor-form.component').then(m => m.VendorFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./vendor-detail.component').then(m => m.VendorDetailComponent),
  },
];
