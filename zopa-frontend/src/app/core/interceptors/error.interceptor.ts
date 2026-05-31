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
      if (err.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/me')) {
        // Token expired or revoked — clear session and redirect to login
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
