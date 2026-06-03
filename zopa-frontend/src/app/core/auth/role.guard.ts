import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for session restore on a full reload before deciding.
  await auth.ensureReady();

  // If user is not logged in at all, redirect to login
  if (!auth.isLoggedIn()) {
    return router.parseUrl('/login');
  }

  // Get allowed roles from route data
  const allowedRoles = route.data['roles'] as string[];

  if (!allowedRoles || allowedRoles.length === 0) {
    return true; // No roles defined, allow access
  }

  // A ZOPA Super Admin can enter any role-gated route (their assignments allow it).
  if (auth.isSuperAdmin()) {
    return true;
  }

  // Otherwise the user must hold one of the explicitly-listed roles.
  // NOTE: routes listing ONLY 'zopa_super_admin' stay super-admin-only (a
  // non-super user won't match it). Routes listing several roles — e.g. the
  // create/edit forms for PR/PO/GRN/Invoice/Vendor — correctly allow any of
  // those roles. Previously the mere PRESENCE of 'zopa_super_admin' in the list
  // made the whole route super-admin-only, bouncing buyers/admins to /dashboard.
  const hasAccess = allowedRoles.some(role => auth.hasRole(role));

  return hasAccess ? true : router.parseUrl('/dashboard');
};
