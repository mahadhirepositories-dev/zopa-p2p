import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { ModulePermissions, PermissionsMatrix } from '../../../core/models';

export interface PlatformSettings {
  logo_path?: string | null;
  logo_url?:  string | null;
}

export interface Tenant {
  id: number;
  name: string;
  code: string;
  gstin?: string;
  address_json?: any;
  po_prefix?: string;
  po_starting_series?: number;
  pr_prefix?: string;
  pr_starting_series?: number;
  fiscal_year_start?: string;
  is_active: boolean;
  is_internal: boolean;
  logo_path?: string | null;
  logo_url?: string | null;
}

export interface UserTenantRole {
  id: number;
  user_id: number;
  tenant_id: number;
  role: string;
  assigned_by: number;
  is_active: boolean;
  user?: any; // The user object
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/admin`;

  // Tenants
  getClients(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(`${this.apiUrl}/clients`);
  }

  getClient(id: number): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.apiUrl}/clients/${id}`);
  }

  createClient(data: Partial<Tenant>): Observable<Tenant> {
    return this.http.post<Tenant>(`${this.apiUrl}/clients`, data);
  }

  updateClient(id: number, data: Partial<Tenant>): Observable<Tenant> {
    return this.http.put<Tenant>(`${this.apiUrl}/clients/${id}`, data);
  }

  // Users for a tenant
  getClientUsers(tenantId: number): Observable<UserTenantRole[]> {
    return this.http.get<UserTenantRole[]>(`${this.apiUrl}/clients/${tenantId}/users`);
  }

  createClientUser(tenantId: number, data: any): Observable<UserTenantRole> {
    return this.http.post<UserTenantRole>(`${this.apiUrl}/clients/${tenantId}/users`, data);
  }

  assignZopaStaff(tenantId: number, data: { user_id: number, role: string }): Observable<UserTenantRole> {
    return this.http.post<UserTenantRole>(`${this.apiUrl}/clients/${tenantId}/assign-staff`, data);
  }

  updateUserRole(tenantId: number, userId: number, roleRecordId: number, role: string): Observable<UserTenantRole> {
    return this.http.put<UserTenantRole>(`${this.apiUrl}/clients/${tenantId}/users/${userId}/role`, {
      role,
      user_tenant_role_id: roleRecordId
    });
  }

  removeUserAssignment(tenantId: number, userId: number, roleRecordId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/clients/${tenantId}/users/${userId}`, {
      body: { user_tenant_role_id: roleRecordId }
    });
  }

  uploadLogo(tenantId: number, file: File): Observable<Tenant> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.post<Tenant>(`${this.apiUrl}/clients/${tenantId}/logo`, fd);
  }

  // Zopa Staff
  getZopaStaff(excludeTenantId?: number): Observable<any[]> {
    const url = excludeTenantId
      ? `${this.apiUrl}/zopa-staff?not_in_tenant_id=${excludeTenantId}`
      : `${this.apiUrl}/zopa-staff`;
    return this.http.get<any[]>(url);
  }

  createZopaStaff(data: { name: string; email: string; password: string; role: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/zopa-staff`, data);
  }

  deactivateZopaStaff(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/zopa-staff/${userId}`);
  }

  // Platform (parent company) settings
  getPlatformSettings(): Observable<PlatformSettings> {
    return this.http.get<PlatformSettings>(`${this.apiUrl}/settings`);
  }

  uploadPlatformLogo(file: File): Observable<PlatformSettings> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.post<PlatformSettings>(`${this.apiUrl}/settings/logo`, fd);
  }

  removePlatformLogo(): Observable<PlatformSettings> {
    return this.http.delete<PlatformSettings>(`${this.apiUrl}/settings/logo`);
  }

  // ── Access Control ──────────────────────────────────────────────────────────

  /**
   * Returns the full permission matrix along with canonical role/module lists.
   * Response: { matrix: PermissionsMatrix, roles: string[], modules: string[] }
   */
  getRolePermissions(): Observable<{ matrix: PermissionsMatrix; roles: string[]; modules: string[] }> {
    return this.http.get<{ matrix: PermissionsMatrix; roles: string[]; modules: string[] }>(
      `${this.apiUrl}/role-permissions`
    );
  }

  /**
   * Saves all module permissions for a single role.
   * @param role   e.g. 'client_buyer'
   * @param modules  map of module → ModulePermissions
   */
  updateRolePermissions(role: string, modules: Record<string, ModulePermissions>): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/role-permissions/${encodeURIComponent(role)}`,
      { modules }
    );
  }
}
