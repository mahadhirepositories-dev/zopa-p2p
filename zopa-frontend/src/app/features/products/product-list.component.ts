import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { environment } from '../../../environments/environment';
import { Product } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { BulkImportService } from '../../core/services/bulk-import.service';
import { ProductFormDialogComponent } from './product-form-dialog.component';
import { AuthService } from '../../core/auth/auth.service';
import { ExportService } from '../../core/services/export.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressSpinnerModule, MatTooltipModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatCardModule, SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2>Products</h2>
          <p>{{ filtered().length }} of {{ products().length }} product{{ products().length !== 1 ? 's' : '' }}</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <app-search-field class="search-field" [value]="search()" (valueChange)="search.set($event)"
                            placeholder="Search products…" />
          <button mat-stroked-button (click)="exportData()">
            <mat-icon>download</mat-icon> Export
          </button>
          @if (auth.canDo('products','create')) {
            <button mat-stroked-button (click)="downloadTemplate()" matTooltip="Download the Excel import template">
              <mat-icon>download</mat-icon> Template
            </button>
            <button mat-stroked-button [disabled]="uploading()" (click)="fileInput.click()"
                    matTooltip="Bulk upload products from a filled-in template">
              @if (uploading()) { <mat-spinner diameter="18" /> } @else { <mat-icon>upload_file</mat-icon> }
              Bulk Upload
            </button>
            <input #fileInput type="file" hidden accept=".xlsx,.xls,.csv" (change)="onFileSelected($event)" />
            <button mat-raised-button color="primary" class="cta-btn" (click)="openForm()">
              <mat-icon>add</mat-icon> New Product
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

      <!-- Status filter chips -->
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
              <mat-icon>inventory_2</mat-icon>
              <h3>No products found</h3>
              <p>{{ search() ? 'Try a different search term.' : 'Add your first product to get started.' }}</p>
              @if (!search() && auth.canDo('products','create')) {
                <button mat-raised-button color="primary" (click)="openForm()">
                  <mat-icon>add</mat-icon> New Product
                </button>
              }
            </div>
          } @else {
            <table mat-table [dataSource]="filtered()" class="full-width">

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Product</th>
                <td mat-cell *matCellDef="let p">
                  <div class="name-cell">
                    <div class="avatar">
                      <mat-icon>inventory</mat-icon>
                    </div>
                    <div>
                      <div class="name-primary">{{ p.name }}</div>
                      @if (p.code) { <div class="name-sub font-mono">{{ p.code }}</div> }
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="unit">
                <th mat-header-cell *matHeaderCellDef>Unit</th>
                <td mat-cell *matCellDef="let p">
                  <span class="tag">{{ p.unit }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="hsn_code">
                <th mat-header-cell *matHeaderCellDef>HSN Code</th>
                <td mat-cell *matCellDef="let p">
                  <span class="mono-tag">{{ p.hsn_code ?? '—' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="net_rate">
                <th mat-header-cell *matHeaderCellDef>Net Rate</th>
                <td mat-cell *matCellDef="let p">
                  <span class="amount">₹{{ p.net_rate | number:'1.2-2' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="gst_rate">
                <th mat-header-cell *matHeaderCellDef>GST</th>
                <td mat-cell *matCellDef="let p">
                  <span class="tag gst">{{ p.gst_rate }}%</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let p">
                  <mat-chip [class]="p.is_active ? 'status-approved' : 'status-cancelled'" [highlighted]="true">
                    {{ p.is_active ? 'Active' : 'Inactive' }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let p" style="text-align:right;">
                  @if (auth.canDo('products','edit')) {
                    <button mat-icon-button [matTooltip]="p.is_active ? 'Mark Inactive' : 'Mark Active'" (click)="toggleActive(p)">
                      <mat-icon [style.color]="p.is_active ? '#16a34a' : '#94a3b8'">
                        {{ p.is_active ? 'toggle_on' : 'toggle_off' }}
                      </mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Edit" (click)="openForm(p)">
                      <mat-icon>edit</mat-icon>
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
    .hover-row:hover { background:#fafafa; }

    .name-cell { display:flex; align-items:center; gap:10px; padding:4px 0; }
    .avatar {
      width:34px; height:34px; border-radius:9px; flex-shrink:0;
      background:var(--brand-light);
      display:flex; align-items:center; justify-content:center;
    }
    .avatar mat-icon { font-size:18px; width:18px; height:18px; color:var(--brand); }
    .name-primary { font-size:13px; font-weight:600; color:var(--text-1); }
    .name-sub { font-size:11px; color:var(--text-3); margin-top:1px; }
    .font-mono { font-family:monospace; }

    .mono-tag {
      font-family:monospace; font-size:12px; font-weight:600;
      background:#f1f5f9; color:var(--text-2);
      padding:2px 8px; border-radius:5px;
    }
    .tag {
      display:inline-block; font-size:12px; font-weight:500;
      background:#f1f5f9; color:var(--text-2);
      padding:2px 8px; border-radius:5px;
    }
    .tag.gst { background:#eff6ff; color:#2563eb; }
    .amount { font-size:13px; font-weight:600; color:var(--text-1); }

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
export class ProductListComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  private bulk = inject(BulkImportService);
  private exportService = inject(ExportService);
  readonly auth = inject(AuthService);

  columns = ['name', 'unit', 'hsn_code', 'net_rate', 'gst_rate', 'status', 'actions'];
  products = signal<Product[]>([]);
  loading = signal(true);
  search = signal('');
  statusFilter = signal('');
  uploading = signal(false);
  importErrors = signal<string[]>([]);

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const sf = this.statusFilter();
    return this.products().filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q) || (p.hsn_code ?? '').includes(q);
      const matchStatus = !sf || (sf === 'active' ? p.is_active : !p.is_active);
      return matchSearch && matchStatus;
    });
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<Product[]>(`${environment.apiUrl}/products`).subscribe({
      next: res => { this.products.set(res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm(product?: Product) {
    const ref = this.dialog.open(ProductFormDialogComponent, { width: '540px', data: product ?? null });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  toggleActive(product: Product) {
    this.http.patch<Product>(`${environment.apiUrl}/products/${product.id}/toggle-active`, {}).subscribe({
      next: res => {
        this.notify.success(`Product '${res.name}' is now ${res.is_active ? 'Active' : 'Inactive'}.`);
        this.load();
      },
      error: () => this.notify.error('Could not change product status.'),
    });
  }

  downloadTemplate() {
    this.bulk.downloadTemplate('products/template', 'product-import-template.xlsx').subscribe({
      next: blob => this.bulk.saveBlob(blob, 'product-import-template.xlsx'),
      error: () => this.notify.error('Could not download the template.'),
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.importErrors.set([]);
    this.bulk.import('products/import', file).subscribe({
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

  exportData() {
    this.exportService.export('products/export');
  }
}
