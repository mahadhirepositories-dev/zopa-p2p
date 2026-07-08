import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OrgEntity {
  id: number;
  name: string;
  is_active: boolean;
  // For Location:
  address?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  country?: string;
  gstin?: string;
  head_user_id?: number;
  head?: { id: number; name: string; email: string };
  receiver_name?: string;
  receiver_phone?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrgService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Departments
  getDepartments(): Observable<OrgEntity[]> {
    return this.http.get<OrgEntity[]>(`${this.apiUrl}/departments`);
  }
  createDepartment(data: any): Observable<OrgEntity> {
    return this.http.post<OrgEntity>(`${this.apiUrl}/departments`, data);
  }
  updateDepartment(id: number, data: any): Observable<OrgEntity> {
    return this.http.put<OrgEntity>(`${this.apiUrl}/departments/${id}`, data);
  }
  deleteDepartment(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/departments/${id}`);
  }

  // Projects
  getProjects(): Observable<OrgEntity[]> {
    return this.http.get<OrgEntity[]>(`${this.apiUrl}/projects`);
  }
  createProject(data: any): Observable<OrgEntity> {
    return this.http.post<OrgEntity>(`${this.apiUrl}/projects`, data);
  }
  updateProject(id: number, data: any): Observable<OrgEntity> {
    return this.http.put<OrgEntity>(`${this.apiUrl}/projects/${id}`, data);
  }
  deleteProject(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/projects/${id}`);
  }

  // Locations
  getLocations(): Observable<OrgEntity[]> {
    return this.http.get<OrgEntity[]>(`${this.apiUrl}/locations`);
  }
  createLocation(data: any): Observable<OrgEntity> {
    return this.http.post<OrgEntity>(`${this.apiUrl}/locations`, data);
  }
  updateLocation(id: number, data: any): Observable<OrgEntity> {
    return this.http.put<OrgEntity>(`${this.apiUrl}/locations/${id}`, data);
  }
  deleteLocation(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/locations/${id}`);
  }
}
