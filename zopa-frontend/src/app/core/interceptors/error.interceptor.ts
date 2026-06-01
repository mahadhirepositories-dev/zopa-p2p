import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError(err => {
      // Only force a logout when:
      //  • the user IS logged in (not during pre-auth bootstrap)
      //  • the session restore is fully complete (_restoring = false) so that
      //    a 401 from /role-permissions or /admin/clients during the bootstrap
      //    window doesn't cascade into a spurious logout after an org switch
      //  • the failing request is not the login or me endpoint itself
      if (
        err.status === 401 &&
        auth.isLoggedIn() &&
        !auth.isRestoring() &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/me')
      ) {
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
