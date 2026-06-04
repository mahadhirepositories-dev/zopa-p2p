import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { PermissionAction } from '../models';

/**
 * Blocks navigation to a feature route when the current role lacks the required
 * permission for the route's module — driven entirely by the Access Control matrix.
 *
 *   data: { module: 'purchase_orders' }                  → requires VIEW
 *   data: { module: 'vendors', action: 'create' }        → requires CREATE
 *   data: { module: 'vendors', action: 'edit' }          → requires EDIT
 *
 * Routes without a `module` are always allowed. `auth.canDo()` allows `view`
 * while the matrix is still loading (no lockout flash) and is fail-closed for
 * mutations, so create/edit routes deny until the matrix confirms the grant.
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

  const action = (route.data['action'] as PermissionAction) ?? 'view';

  return auth.canDo(module, action) ? true : router.parseUrl('/dashboard');
};
