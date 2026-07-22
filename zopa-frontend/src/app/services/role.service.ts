import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Role {
  id?: number;
  slug: string;
  name: string;
  type: 'zopa' | 'client';
  is_system: boolean;
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/roles`);
  }

  getAdminRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/admin/roles`);
  }

  createRole(role: Partial<Role>): Observable<{ message: string, role: Role }> {
    return this.http.post<{ message: string, role: Role }>(`${this.apiUrl}/admin/roles`, role);
  }

  updateRole(slug: string, role: Partial<Role>): Observable<{ message: string, role: Role }> {
    return this.http.put<{ message: string, role: Role }>(`${this.apiUrl}/admin/roles/${slug}`, role);
  }

  deleteRole(slug: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/admin/roles/${slug}`);
  }
}
