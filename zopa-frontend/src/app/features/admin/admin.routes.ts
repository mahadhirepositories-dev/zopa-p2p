import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

export const adminRoutes: Routes = [
  {
    path: 'clients',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./clients-list/clients-list.component').then(m => m.ClientsListComponent),
  },
  {
    path: 'clients/:id',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./client-detail/client-detail.component').then(m => m.ClientDetailComponent),
  },
  {
    path: 'settings',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./platform-settings/platform-settings.component').then(m => m.PlatformSettingsComponent),
  },
  {
    path: 'dashboard',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./zopa-dashboard/zopa-dashboard.component').then(m => m.ZopaDashboardComponent),
  },
  {
    path: 'roles-master',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./roles-master/roles-master.component').then(m => m.RolesMasterComponent),
  },
  {
    path: 'staff',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./zopa-staff/zopa-staff.component').then(m => m.ZopaStaffComponent),
  },
  {
    path: 'access-control',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./access-control/access-control.component').then(m => m.AccessControlComponent),
  },
  {
    path: 'email-templates',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./email-templates/email-templates.component').then(m => m.EmailTemplatesComponent),
  },
  {
    path: 'vendor-forms',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./vendor-forms/vendor-form-builder.component').then(m => m.VendorFormBuilderComponent),
  },
  {
    path: 'vendor-onboarding',
    canActivate: [roleGuard],
    data: { roles: ['zopa_super_admin'] },
    loadComponent: () => import('./vendor-forms/vendor-onboarding-queue.component').then(m => m.VendorOnboardingQueueComponent),
  },
  { path: '', redirectTo: 'clients', pathMatch: 'full' }
];
