import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Blocks navigation to a feature route when the current role lacks VIEW
 * permission for the route's module (configured via the Access Control screen).
 *
 * The module key is read from route data: `data: { module: 'purchase_orders' }`.
 * Routes without a `module` are always allowed.
 *
 * Note: auth.canDo() fails open for 'view' when the permission matrix has not
 * loaded yet (e.g. immediately after a hard refresh), so a user is never
 * locked out by a transient loading state — enforcement applies once the
 * matrix is available and is fully reflected in the sidebar menu.
 */
export const permissionGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ensureReady();

  if (!auth.isLoggedIn()) {
    return router.parseUrl('/login');
  }

  const module = route.data['module'] as string | undefined;
  if (!module) {
    return true;
  }

  return auth.canDo(module, 'view') ? true : router.parseUrl('/dashboard');
};
