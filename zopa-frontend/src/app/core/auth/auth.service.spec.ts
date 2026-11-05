import { Component } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { tenantInterceptor } from '../interceptors/tenant.interceptor';

@Component({ template: '' })
class BlankPage {}

const clientUser = {
  user: { id: 1, name: 'Client Admin', email: 'cadmin@acmetest.com', is_zopa_staff: false },
  clients: [
    { tenant_id: 10, tenant_name: 'Acme', role: 'client_admin' },
    { tenant_id: 20, tenant_name: 'Globex', role: 'client_admin' },
  ],
};

const superAdmin = {
  user: { id: 2, name: 'Super Admin', email: 'superadmin@zopatest.com', is_zopa_staff: true },
  clients: [{ tenant_id: 1, tenant_name: 'ZOPA Internal', role: 'zopa_super_admin', is_internal: true }],
};

/** Everything below the real interceptors is faked, as on a page load with a saved token. */
function hardLoad(token: string | null, activeTenant: string | null = null) {
  localStorage.clear();
  if (token) localStorage.setItem('token', token);
  if (activeTenant) localStorage.setItem('activeTenant', activeTenant);

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor, tenantInterceptor, errorInterceptor])),
      provideHttpClientTesting(),
      provideRouter([
        { path: 'login', component: BlankPage },
        { path: 'purchase-orders', component: BlankPage, canActivate: [authGuard] },
      ]),
    ],
  });

  const router = TestBed.inject(Router);
  const navigation = router.navigateByUrl('/purchase-orders');
  return {
    router,
    navigation,
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
  };
}

/** Lets the deferred restore and the guard's await run. */
const settle = () => new Promise(resolve => setTimeout(resolve));

const isMe = (r: { url: string }) => r.url.endsWith('/auth/me');
const isMatrix = (r: { url: string }) => r.url.endsWith('/role-permissions');
const isAllOrgs = (r: { url: string }) => r.url.endsWith('/admin/clients');

describe('AuthService session restore on a full page load', () => {
  afterEach(() => localStorage.clear());

  it('sends /auth/me with the saved token through the real interceptors', async () => {
    const { http } = hardLoad('saved-token');
    await settle();

    const me = http.expectOne(isMe);
    expect(me.request.headers.get('Authorization')).toBe('Bearer saved-token');
  });

  it('keeps a client user on the same page in their saved organization', async () => {
    const { auth, http, router, navigation } = hardLoad('saved-token', '20');
    await settle();

    http.expectOne(isMe).flush(clientUser);
    await settle();
    http.expectOne(isMatrix).flush({});
    await navigation;

    expect(router.url).toBe('/purchase-orders');
    expect(auth.user()?.email).toBe('cadmin@acmetest.com');
    expect(auth.currentTenantId()).toBe(20);
    expect(auth.currentRole()).toBe('client_admin');
    http.verify();
  });

  it('keeps a super admin on the same page in a client organization they are not assigned to', async () => {
    const { auth, http, router, navigation } = hardLoad('saved-token', '30');
    await settle();

    http.expectOne(isMe).flush(superAdmin);
    await settle();
    http.expectOne(isMatrix).flush({});
    http.expectOne(isAllOrgs).flush([{ id: 1, name: 'ZOPA Internal', is_internal: true }, { id: 30, name: 'Initech' }]);
    await navigation;

    expect(router.url).toBe('/purchase-orders');
    expect(auth.isSuperAdmin()).toBe(true);
    expect(auth.currentTenantId()).toBe(30);
    expect(auth.currentTenantName()).toBe('Initech');
    http.verify();
  });

  it('sends an expired token to login and clears it', async () => {
    const { auth, http, router, navigation } = hardLoad('expired-token', '20');
    await settle();

    http.expectOne(isMe).flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });
    await navigation;

    expect(router.url).toBe('/login');
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('activeTenant')).toBeNull();
  });

  it('keeps the token when the server cannot be reached', async () => {
    const { http, navigation } = hardLoad('saved-token', '20');
    await settle();

    http.expectOne(isMe).error(new ProgressEvent('error'), { status: 0 });
    await navigation;

    expect(localStorage.getItem('token')).toBe('saved-token');
    expect(localStorage.getItem('activeTenant')).toBe('20');
  });

  it('keeps the token when /auth/me fails with a server error', async () => {
    const { http, navigation } = hardLoad('saved-token');
    await settle();

    http.expectOne(isMe).flush({}, { status: 500, statusText: 'Server Error' });
    await navigation;

    expect(localStorage.getItem('token')).toBe('saved-token');
  });

  it('does not log out on a 401 from the permissions call while restoring', async () => {
    const { auth, http, navigation } = hardLoad('saved-token', '10');
    await settle();

    http.expectOne(isMe).flush(clientUser);
    await settle();
    expect(auth.isRestoring()).toBe(true);
    http.expectOne(isMatrix).flush({}, { status: 401, statusText: 'Unauthorized' });
    await navigation;

    expect(auth.isRestoring()).toBe(false);
    expect(auth.isLoggedIn()).toBe(true);
    expect(localStorage.getItem('token')).toBe('saved-token');
  });

  it('logs out on a 401 once the restore has finished', async () => {
    const { auth, http, router, navigation } = hardLoad('saved-token', '10');
    await settle();
    http.expectOne(isMe).flush(clientUser);
    await settle();
    http.expectOne(isMatrix).flush({});
    await navigation;

    TestBed.inject(HttpClient).get('/api/purchase-orders').subscribe({ error: () => {} });
    http.expectOne('/api/purchase-orders').flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(auth.isLoggedIn()).toBe(false);
    expect(router.url).toBe('/login');
  });

  it('asks the server nothing when there is no saved token', async () => {
    const { http, router, navigation } = hardLoad(null);
    await navigation;

    http.expectNone(isMe);
    expect(router.url).toBe('/login');
  });
});
