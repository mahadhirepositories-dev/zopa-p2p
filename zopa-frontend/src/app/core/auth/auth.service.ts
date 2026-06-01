import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { PermissionAction, PermissionsMatrix, TenantContext, User } from '../models';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  token: string;
  user: User;
  clients: TenantContext[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<User | null>(null);
  private _clients = signal<TenantContext[]>([]);
  private _currentTenantId = signal<number | null>(null);
  private _originalZopaTenantId: number | null = null;
  /** Role × module permission matrix, loaded once after login / session restore. */
  private _permissionsMatrix = signal<PermissionsMatrix | null>(null);

  readonly user = this._user.asReadonly();
  readonly clients = this._clients.asReadonly();
  readonly currentTenantId = this._currentTenantId.asReadonly();

  readonly currentRole = computed(() => {
    const tid = this._currentTenantId();
    return this._clients().find(c => c.tenant_id === tid)?.role ?? null;
  });

  readonly currentTenantName = computed(() => {
    const tid = this._currentTenantId();
    return this._clients().find(c => c.tenant_id === tid)?.tenant_name ?? null;
  });

  readonly isLoggedIn = computed(() => !!this._user());

  /** Roles that may create/submit transactional documents (PR, PO, GRN, Invoice) */
  readonly canTransact = computed(() =>
    ['zopa_super_admin', 'zopa_buyer', 'client_admin', 'client_buyer'].includes(this.currentRole() ?? '')
  );

  /** Roles that may manage master data and perform financial/admin actions */
  readonly isAdmin = computed(() =>
    ['zopa_super_admin', 'client_admin'].includes(this.currentRole() ?? '')
  );

  /**
   * True only for ZOPA Super Admin. Based on the user's role assignments
   * (not the currently-selected tenant) so it stays true even while a super
   * admin is impersonating a client. Gates all platform-admin screens.
   */
  readonly isSuperAdmin = computed(() =>
    this._clients().some(c => c.role === 'zopa_super_admin')
  );

  /** True when ZOPA staff is acting on behalf of a client tenant */
  readonly isImpersonating = computed(() =>
    this.isZopaStaff() && !!this._originalZopaTenantId
  );

  /** Expose the loaded matrix (read-only) for the admin access-control screen. */
  readonly permissionsMatrix = this._permissionsMatrix.asReadonly();

  /** Resolves once the initial /auth/me session-restore attempt has finished. */
  private _ready: Promise<void>;
  /** True while session restore is in progress — guards the error interceptor
   *  from treating bootstrap 401s (from /role-permissions or /admin/clients)
   *  as a genuine token-revocation and forcing an unwanted logout. */
  private _restoring = false;

  constructor(private http: HttpClient, private router: Router) {
    this._ready = this.restoreSession();
  }

  /** Returns true while the initial session-restore is in flight. */
  isRestoring(): boolean {
    return this._restoring;
  }

  /** Guards await this so a full page reload doesn't bounce to /login before the
   *  user is restored from the saved token. */
  ensureReady(): Promise<void> {
    return this._ready;
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem('token', res.token);
        this._user.set(res.user);
        this._clients.set(res.clients);

        const savedTenant = localStorage.getItem('activeTenant');
        const firstClient = res.clients[0];

        if (savedTenant && res.clients.some(c => c.tenant_id === +savedTenant)) {
          this._currentTenantId.set(+savedTenant);
        } else if (firstClient) {
          this._currentTenantId.set(firstClient.tenant_id);
          localStorage.setItem('activeTenant', String(firstClient.tenant_id));
        }

        // Load fine-grained permission matrix after successful login.
        this.loadPermissions();
        // Super admins can act on any organization — populate the switcher.
        this.loadAllOrgsForSuperAdmin();
      })
    );
  }

  logout() {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe();
    this.clearSession();
    this.router.navigate(['/login']);
  }

  switchClient(tenantId: number) {
    this._currentTenantId.set(tenantId);
    localStorage.setItem('activeTenant', String(tenantId));
  }

  /**
   * ZOPA staff: temporarily act as a client tenant.
   * Adds the client to the clients list so currentRole() resolves properly.
   */
  impersonateClient(tenantId: number, tenantName: string) {
    if (!this.isZopaStaff()) return;
    // Save original ZOPA tenant to restore later
    if (!this._originalZopaTenantId) {
      this._originalZopaTenantId = this._currentTenantId();
    }
    // Ensure the client tenant exists in the list
    if (!this._clients().some(c => c.tenant_id === tenantId)) {
      this._clients.update(list => [
        ...list,
        { tenant_id: tenantId, tenant_name: tenantName, role: 'client_admin' },
      ]);
    }
    this.switchClient(tenantId);
  }

  /** Return ZOPA staff back to their own org context */
  exitImpersonation() {
    if (!this._originalZopaTenantId) return;
    const zopaId = this._originalZopaTenantId;
    this._originalZopaTenantId = null;
    this.switchClient(zopaId);
  }

  /**
   * Fine-grained permission check.
   *
   * Returns true if the current role is allowed to perform `action` on `module`.
   * Falls back to the existing coarse checks (canTransact / isAdmin) when the
   * permissions matrix has not loaded yet or has no entry for this combination,
   * so existing behaviour is fully preserved during the migration period.
   *
   * Example:
   *   auth.canDo('purchase_orders', 'delete')  → false for client_buyer
   *   auth.canDo('vendors', 'create')           → true  for zopa_buyer
   */
  canDo(module: string, action: PermissionAction): boolean {
    const role = this.currentRole();
    if (!role) return false;

    // Super admin is always permitted — no matrix lookup needed.
    if (role === 'zopa_super_admin') return true;

    const matrix = this._permissionsMatrix();
    const perms  = matrix?.[role]?.[module];

    if (!perms) {
      // Matrix not yet loaded or no entry for this role/module:
      // fall back to existing coarse-grained checks to avoid regressions.
      return action === 'view' ? true : this.canTransact();
    }

    switch (action) {
      case 'view':   return perms.can_view;
      case 'create': return perms.can_create;
      case 'edit':   return perms.can_edit;
      case 'delete': return perms.can_delete;
    }
  }

  /**
   * Load the full role-permissions matrix from the API.
   * Called after login (fire-and-forget) and during session restore (awaited).
   * Errors are silently swallowed — canDo() falls back gracefully when null.
   */
  loadPermissions(): void {
    this.loadPermissionsAsync();
  }

  private loadPermissionsAsync(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.http.get<PermissionsMatrix>(`${environment.apiUrl}/role-permissions`).subscribe({
        next: matrix => { this._permissionsMatrix.set(matrix); resolve(); },
        error: () => resolve(),
      });
    });
  }

  /** Update the current user's own profile (name, phone) and refresh local state. */
  updateProfile(data: { name: string; phone?: string | null }) {
    return this.http.put<{ message: string; user: User }>(`${environment.apiUrl}/auth/profile`, data).pipe(
      tap(res => this._user.set(res.user))
    );
  }

  /** Change the current user's own password. */
  changePassword(data: { current_password: string; password: string; password_confirmation: string }) {
    return this.http.put<{ message: string }>(`${environment.apiUrl}/auth/password`, data);
  }

  /** Request a password-reset link be emailed (public, no auth). */
  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  /** Complete a password reset using the token from the emailed link (public, no auth). */
  resetPassword(data: { token: string; email: string; password: string; password_confirmation: string }) {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/reset-password`, data);
  }

  hasRole(...roles: string[]): boolean {
    return roles.includes(this.currentRole() ?? '');
  }

  isZopaStaff(): boolean {
    return this._user()?.is_zopa_staff ?? false;
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  private restoreSession(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) return Promise.resolve();

    this._restoring = true;
    return new Promise<void>((resolve) => {
      this.http.get<{ user: User; clients: TenantContext[] }>(`${environment.apiUrl}/auth/me`).subscribe({
        next: async res => {
          this._user.set(res.user);
          this._clients.set(res.clients);
          // Run permission load and super-admin org load in parallel.
          // allSettled ensures both finish (success or error) before we clear
          // _restoring — so no 401 from either can trigger a spurious logout.
          await Promise.allSettled([
            this.loadPermissionsAsync(),
            this.loadAllOrgsForSuperAdmin(),
          ]);
          this.restoreActiveTenant();
          this._restoring = false;
          resolve();
        },
        error: (err) => {
          // Only clear token on actual auth rejection (401/403) — NOT on network
          // errors (e.g. server temporarily down). A network error (status 0)
          // leaves the token intact so the next request after recovery works.
          if (err.status === 401 || err.status === 403) {
            this.clearSession();
          }
          this._restoring = false;
          resolve();
        },
      });
    });
  }

  /** Restore the active tenant from localStorage against the current org list. */
  private restoreActiveTenant(): void {
    const saved = localStorage.getItem('activeTenant');
    const clients = this._clients();
    if (saved && clients.some(c => c.tenant_id === +saved)) {
      this._currentTenantId.set(+saved);
    } else if (clients[0]) {
      this._currentTenantId.set(clients[0].tenant_id);
      localStorage.setItem('activeTenant', String(clients[0].tenant_id));
    }
  }

  /**
   * Super admins can operate on ANY organization (the backend authorizes them
   * for every tenant). Load all orgs into the clients list — each as
   * zopa_super_admin — so the org switcher offers every organization.
   * No-op for everyone else. Resolves even on failure so it never blocks login.
   */
  private loadAllOrgsForSuperAdmin(): Promise<void> {
    if (!this.isSuperAdmin()) return Promise.resolve();

    return new Promise<void>((resolve) => {
      this.http.get<Array<{ id: number; name: string }>>(`${environment.apiUrl}/admin/clients`).subscribe({
        next: tenants => {
          const merged = [...this._clients()];
          for (const t of tenants) {
            if (!merged.some(c => c.tenant_id === t.id)) {
              merged.push({ tenant_id: t.id, tenant_name: t.name, role: 'zopa_super_admin' });
            }
          }
          this._clients.set(merged);
          resolve();
        },
        error: () => resolve(),
      });
    });
  }

  private clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('activeTenant');
    this._originalZopaTenantId = null;
    this._user.set(null);
    this._clients.set([]);
    this._currentTenantId.set(null);
    this._permissionsMatrix.set(null);
  }
}
