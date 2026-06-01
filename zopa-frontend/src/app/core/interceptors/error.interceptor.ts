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
      // Only force a logout when an ALREADY-logged-in user's token is rejected.
      // During bootstrap / session-restore (isLoggedIn() === false) a stray 401
      // must NOT clear the token, otherwise a page reload (e.g. after switching
      // organization) could cascade into an unwanted logout.
      if (
        err.status === 401 &&
        auth.isLoggedIn() &&
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
