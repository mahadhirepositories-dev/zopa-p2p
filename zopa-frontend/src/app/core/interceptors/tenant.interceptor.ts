import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const tenantId = auth.currentTenantId();

  if (tenantId && req.url.includes('/api/')) {
    req = req.clone({ setHeaders: { 'X-Tenant-ID': String(tenantId) } });
  }

  return next(req);
};
