import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
  message: string;
}

/**
 * Shared helpers for Excel template download + bulk import. The HTTP
 * interceptors attach the Bearer token and X-Tenant-ID automatically, so
 * downloads/imports are always scoped to the active organization.
 */
@Injectable({ providedIn: 'root' })
export class BulkImportService {
  private http = inject(HttpClient);

  /** Download a template xlsx (path is relative to the API root, e.g. 'products/template'). */
  downloadTemplate(path: string, filename: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/${path}`, { responseType: 'blob' });
  }

  /** Trigger a browser save for a downloaded blob. */
  saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /** Upload a filled-in template for import (path e.g. 'products/import'). */
  import(path: string, file: File): Observable<ImportResult> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ImportResult>(`${environment.apiUrl}/${path}`, fd);
  }
}
