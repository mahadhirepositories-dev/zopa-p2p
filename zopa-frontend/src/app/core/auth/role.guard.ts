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

  // Super-admin-only routes: must be an actual ZOPA Super Admin.
  // (Previously any ZOPA staff — e.g. zopa_buyer — incorrectly passed here.)
  if (allowedRoles.includes('zopa_super_admin')) {
    return auth.isSuperAdmin() ? true : router.parseUrl('/dashboard');
  }

  // Check if current role matches any allowed role
  const hasAccess = allowedRoles.some(role => auth.hasRole(role));

  if (hasAccess) {
    return true;
  }

  // Redirect to dashboard if unauthorized
  return router.parseUrl('/dashboard');
};
