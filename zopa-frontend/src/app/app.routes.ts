import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/auth/permission.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'executive-dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/executive-dashboard/executive-dashboard.component').then(m => m.ExecutiveDashboardComponent),
  },
  {
    path: 'purchase-orders',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'purchase_orders' },
    loadChildren: () => import('./features/purchase-orders/purchase-orders.routes').then(m => m.purchaseOrderRoutes),
  },
  {
    path: 'approvals',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'approvals' },
    loadChildren: () => import('./features/approvals/approvals.routes').then(m => m.approvalRoutes),
  },
  {
    path: 'vendors',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'vendors' },
    loadChildren: () => import('./features/vendors/vendors.routes').then(m => m.vendorRoutes),
  },
  {
    path: 'products',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'products' },
    loadChildren: () => import('./features/products/products.routes').then(m => m.productRoutes),
  },
  {
    path: 'categories',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'products' },
    loadChildren: () => import('./features/categories/categories.routes').then(m => m.categoryRoutes),
  },
  {
    path: 'cost-centers',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'cost_centers' },
    loadChildren: () => import('./features/cost-centers/cost-centers.routes').then(m => m.costCenterRoutes),
  },
  {
    path: 'org-masters',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'org_masters' },
    loadChildren: () => import('./features/org-masters/org-masters.routes').then(m => m.orgMastersRoutes),
  },
  {
    path: 'grns',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'grns' },
    loadChildren: () => import('./features/grns/grns.routes').then(m => m.grnRoutes),
  },
  {
    path: 'invoices',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'invoices' },
    loadChildren: () => import('./features/invoices/invoices.routes').then(m => m.invoiceRoutes),
  },
  {
    path: 'purchase-requisitions',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'purchase_requisitions' },
    loadChildren: () => import('./features/purchase-requisitions/purchase-requisitions.routes').then(m => m.prRoutes),
  },
  {
    path: 'reports',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'reports' },
    loadChildren: () => import('./features/reports/reports.routes').then(m => m.reportRoutes),
  },
  {
    path: 'org-staff',
    canActivate: [authGuard, permissionGuard],
    data: { module: 'org_staff' },
    loadComponent: () => import('./features/org-staff/org-staff.component').then(m => m.OrgStaffComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
  },
  {
    path: 'help',
    canActivate: [authGuard],
    loadComponent: () => import('./features/help/help.component').then(m => m.HelpComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.adminRoutes),
  },
  { path: '**', redirectTo: 'dashboard' },
];
