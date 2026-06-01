import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for the saved-token session restore to finish, so a full page reload
  // (e.g. after switching organization) doesn't bounce to /login prematurely.
  await auth.ensureReady();

  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login']);
};
