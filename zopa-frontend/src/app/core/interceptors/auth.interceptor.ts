import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Always tell Laravel this is an API client expecting JSON errors,
  // so it never tries to redirect to route('login')
  if (!req.headers.has('Accept')) {
    headers['Accept'] = 'application/json';
  }

  if (Object.keys(headers).length) {
    req = req.clone({ setHeaders: headers });
  }

  return next(req);
};
