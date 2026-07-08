import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { environment } from '../../../environments/environment';
import { Vendor } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { BulkImportService } from '../../core/services/bulk-import.service';
import { AuthService } from '../../core/auth/auth.service';
import { ExportService } from '../../core/services/export.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';

@Component({
  selector: 'app-vendor-list',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressSpinnerModule, MatTooltipModule,
    MatCardModule, MatFormFieldModule, MatInputModule, SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2>Vendors</h2>
          <p>{{ filtered().length }} of {{ vendors().length }} vendor{{ vendors().length !== 1 ? 's' : '' }}</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <app-search-field class="search-field" [value]="search()" (valueChange)="search.set($event)"
                            placeholder="Search vendors…" />
          <button mat-stroked-button (click)="exportData()">
            <mat-icon>download</mat-icon> Export
          </button>
          
          @if (auth.canDo('vendors','create')) {
            <button mat-stroked-button color="primary" (click)="downloadTemplate()" matTooltip="Download Excel Template">
              <mat-icon>download</mat-icon> Template
            </button>
            <button mat-stroked-button color="primary" (click)="fileInput.click()" [disabled]="uploading()" matTooltip="Import from Excel">
              @if(uploading()) { <mat-spinner diameter="20"/> } @else { <mat-icon>upload</mat-icon> }
              Import
            </button>
            <input #fileInput type="file" accept=".xlsx,.xls,.csv" style="display:none" (change)="onFileSelected($event)">
            
            <button mat-raised-button color="primary" (click)="router.navigate(['/vendors/create'])" class="cta-btn">
              <mat-icon>add</mat-icon> New Vendor
            </button>
          }
        </div>
      </div>

      @if (importErrors().length) {
        <div class="import-errors">
          <div class="import-errors-head">
            <mat-icon>warning_amber</mat-icon>
            <span>{{ importErrors().length }} row(s) were skipped during import</span>
            <button mat-icon-button (click)="importErrors.set([])"><mat-icon>close</mat-icon></button>
          </div>
          <ul>@for (e of importErrors(); track e) { <li>{{ e }}</li> }</ul>
        </div>
      }

      <!-- Filter chips -->
      <div class="filter-row">
        <button class="filter-chip" [class.active]="statusFilter() === ''" (click)="statusFilter.set('')">All</button>
        <button class="filter-chip" [class.active]="statusFilter() === 'active'" (click)="statusFilter.set('active')">Active</button>
        <button class="filter-chip" [class.active]="statusFilter() === 'inactive'" (click)="statusFilter.set('inactive')">Inactive</button>
      </div>

      <!-- Table card -->
      <mat-card style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (filtered().length === 0) {
            <div class="empty-state">
              <mat-icon>business_off</mat-icon>
              <h3>No vendors found</h3>
              <p>{{ search() ? 'Try a different search term.' : 'Add your first vendor to get started.' }}</p>
              @if (!search() && auth.canDo('vendors','create')) {
                <button mat-raised-button color="primary" (click)="router.navigate(['/vendors/create'])">
                  <mat-icon>add</mat-icon> New Vendor
                </button>
              }
            </div>
          } @else {
            <table mat-table [dataSource]="filtered()" class="full-width">

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Vendor</th>
                <td mat-cell *matCellDef="let v">
                  <div class="name-cell">
                    <div class="avatar">{{ v.name[0]?.toUpperCase() }}</div>
                    <div>
                      <div class="name-primary">{{ v.name }}</div>
                      @if (v.email || v.phone) {
                        <div class="name-sub">{{ v.email ?? v.phone }}</div>
                      }
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="pan">
                <th mat-header-cell *matHeaderCellDef>PAN</th>
                <td mat-cell *matCellDef="let v">
                  <span class="mono-tag">{{ v.pan ?? '—' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="gstin">
                <th mat-header-cell *matHeaderCellDef>GSTIN</th>
                <td mat-cell *matCellDef="let v">
                  @if (v.gstin) {
                    <span class="mono-tag gstin">{{ v.gstin }}</span>
                  } @else {
                    <span style="color:var(--text-3);">—</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef>Category</th>
                <td mat-cell *matCellDef="let v">
                  @if (v.category) {
                    <div style="font-size:12px; font-weight:600; color:var(--text-2);">{{ v.category.name }}</div>
                    @if (v.subcategory) {
                      <div style="font-size:11px; color:var(--text-3);">{{ v.subcategory.name }}</div>
                    }
                  } @else {
                    <span style="color:var(--text-3);">—</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="addresses">
                <th mat-header-cell *matHeaderCellDef>Addresses</th>
                <td mat-cell *matCellDef="let v">
                  <div class="count-badge">
                    <mat-icon>location_on</mat-icon>
                    {{ v.addresses?.length ?? 0 }}
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let v">
                  <mat-chip [class]="v.is_active ? 'status-approved' : 'status-cancelled'" [highlighted]="true">
                    {{ v.is_active ? 'Active' : 'Inactive' }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let v" style="text-align:right;white-space:nowrap;">
                  @if (auth.canDo('vendors','edit')) {
                    <button mat-icon-button matTooltip="Edit" (click)="router.navigate(['/vendors', v.id, 'edit'])">
                      <mat-icon>edit</mat-icon>
                    </button>
                  }
                  <button mat-icon-button matTooltip="View addresses" (click)="goDetail(v.id)">
                    <mat-icon>location_on</mat-icon>
                  </button>
                  @if (auth.canDo('vendors','delete')) {
                    <button mat-icon-button [matTooltip]="v.is_active ? 'Deactivate' : 'Activate'" (click)="toggleStatus(v)">
                      <mat-icon [style.color]="v.is_active ? '#16a34a' : '#94a3b8'">
                        {{ v.is_active ? 'toggle_on' : 'toggle_off' }}
                      </mat-icon>
                    </button>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;" class="hover-row"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px; }
    .page-header h2 { margin:0; font-size:20px; font-weight:700; color:var(--text-1); }
    .page-header p  { margin:3px 0 0; font-size:13px; color:var(--text-3); }
    .cta-btn { height:40px!important; }
    .search-field { width:220px; }
    ::ng-deep .search-field .mat-mdc-form-field-subscript-wrapper { display:none; }

    .filter-row { display:flex; gap:6px; margin-bottom:16px; }
    .filter-chip {
      padding:5px 14px; border-radius:20px;
      border:1px solid var(--border); background:var(--surface);
      font-size:12px; font-weight:500; color:var(--text-2);
      cursor:pointer; transition:all .15s;
    }
    .filter-chip:hover { border-color:var(--brand); color:var(--brand); }
    .filter-chip.active { background:var(--brand); color:#fff; border-color:var(--brand); font-weight:600; }

    .full-width { width:100%; }
    .hover-row { cursor:default; }
    .hover-row:hover { background:#fafafa; }

    .name-cell { display:flex; align-items:center; gap:10px; padding:4px 0; }
    .avatar {
      width:34px; height:34px; border-radius:9px; flex-shrink:0;
      background:linear-gradient(135deg,var(--brand),var(--brand-hover));
      color:white; font-size:14px; font-weight:700;
      display:flex; align-items:center; justify-content:center;
    }
    .name-primary { font-size:13px; font-weight:600; color:var(--text-1); }
    .name-sub { font-size:11px; color:var(--text-3); margin-top:1px; }
    .font-mono { font-family:monospace; }

    .mono-tag {
      font-family:monospace; font-size:12px; font-weight:600;
      background:#f1f5f9; color:var(--text-2);
      padding:2px 8px; border-radius:5px;
    }
    .mono-tag.gstin { background:#eff6ff; color:#1d4ed8; }

    .count-badge {
      display:inline-flex; align-items:center; gap:4px;
      font-size:13px; color:var(--text-2);
    }
    .count-badge mat-icon { font-size:15px; width:15px; height:15px; color:var(--text-3); }

    .empty-state {
      display:flex; flex-direction:column; align-items:center;
      gap:8px; padding:60px 24px; text-align:center;
    }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; color:var(--border); }
    .empty-state h3 { margin:0; font-size:16px; font-weight:600; color:var(--text-2); }
    .empty-state p  { margin:0; font-size:13px; color:var(--text-3); }

    .import-errors { background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:12px 16px; margin-bottom:16px; }
    .import-errors-head { display:flex; align-items:center; gap:8px; font-weight:600; color:#9a3412; font-size:13px; }
    .import-errors-head mat-icon { color:#ea580c; }
    .import-errors-head button { margin-left:auto; }
    .import-errors ul { margin:8px 0 0; padding-left:34px; }
    .import-errors li { font-size:12.5px; color:#7c2d12; margin:2px 0; }
  `],
})
export class VendorListComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private bulk = inject(BulkImportService);
  readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private exportService = inject(ExportService);

  columns = ['name', 'pan', 'gstin', 'category', 'addresses', 'status', 'actions'];
  vendors = signal<Vendor[]>([]);
  loading = signal(true);
  search = signal('');
  statusFilter = signal('');
  uploading = signal(false);
  importErrors = signal<string[]>([]);

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const sf = this.statusFilter();
    return this.vendors().filter(v => {
      const matchSearch = !q || v.name.toLowerCase().includes(q)
        || (v.pan ?? '').toLowerCase().includes(q)
        || (v.gstin ?? '').toLowerCase().includes(q);
      const matchStatus = !sf || (sf === 'active' ? v.is_active : !v.is_active);
      return matchSearch && matchStatus;
    });
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<Vendor[]>(`${environment.apiUrl}/vendors`).subscribe({
      next: res => { this.vendors.set(res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  goDetail(id: number) { this.router.navigate(['/vendors', id]); }

  downloadTemplate() {
    this.bulk.downloadTemplate('vendors/template', 'vendor-import-template.xlsx').subscribe({
      next: blob => this.bulk.saveBlob(blob, 'vendor-import-template.xlsx'),
      error: () => this.notify.error('Could not download the template.'),
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.importErrors.set([]);
    this.bulk.import('vendors/import', file).subscribe({
      next: res => {
        this.uploading.set(false);
        this.notify.success(res.message);
        this.importErrors.set(res.errors ?? []);
        this.load();
      },
      error: err => {
        this.uploading.set(false);
        this.notify.error(err.error?.message ?? 'Import failed.');
      },
    });
    input.value = '';
  }

  toggleStatus(vendor: Vendor) {
    this.http.put(`${environment.apiUrl}/vendors/${vendor.id}`, { is_active: !vendor.is_active }).subscribe({
      next: () => {
        this.vendors.update(list => list.map(v => v.id === vendor.id ? { ...v, is_active: !v.is_active } : v));
        this.notify.success(`Vendor ${vendor.is_active ? 'deactivated' : 'activated'}.`);
      },
      error: () => this.notify.error('Could not update vendor status.'),
    });
  }

  exportData() {
    this.exportService.export('api/vendors/export');
  }
}
