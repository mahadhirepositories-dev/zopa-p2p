import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PurchaseOrder } from '../../core/models';
import { AuthService } from '../../core/auth/auth.service';
import { ExportService } from '../../core/services/export.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';

@Component({
  selector: 'app-po-list',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, FormsModule, RouterLink,
    MatTableModule, MatButtonModule, MatChipsModule, MatIconModule,
    MatProgressSpinnerModule, MatCardModule, MatFormFieldModule, MatInputModule, SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">

      <div class="page-header">
        <div>
          <h2>Purchase Orders</h2>
          <p>{{ filtered().length }} order{{ filtered().length !== 1 ? 's' : '' }} found</p>
        </div>
        <div style="display: flex; gap: 12px;">
          <button mat-stroked-button (click)="exportData()">
            <mat-icon>download</mat-icon> Export
          </button>
          @if (auth.canDo('purchase_orders','create')) {
            <button mat-raised-button color="primary" routerLink="create" class="cta-btn">
              <mat-icon>add</mat-icon> New PO
            </button>
          }
        </div>
      </div>

      <!-- Search + filters bar -->
      <div class="toolbar-bar">
        <app-search-field class="search-field" [value]="search()" (valueChange)="search.set($event)"
                          placeholder="Search by PO number, vendor…" />

        <div class="filter-chips">
          <button class="filter-chip" [class.active]="statusFilter() === ''"
                  (click)="statusFilter.set('')">All</button>
          <button class="filter-chip" [class.active]="statusFilter() === 'draft'"
                  (click)="statusFilter.set('draft')">Draft</button>
          <button class="filter-chip returned" [class.active]="statusFilter() === 'returned'"
                  (click)="statusFilter.set('returned')">⚠ Returned</button>
          <button class="filter-chip pending" [class.active]="statusFilter() === 'pending'"
                  (click)="statusFilter.set('pending')">Pending</button>
          <button class="filter-chip approved" [class.active]="statusFilter() === 'approved'"
                  (click)="statusFilter.set('approved')">Approved</button>
          <button class="filter-chip released" [class.active]="statusFilter() === 'released'"
                  (click)="statusFilter.set('released')">Released</button>
          <button class="filter-chip delivered" [class.active]="statusFilter() === 'delivered'"
                  (click)="statusFilter.set('delivered')">Delivered</button>
          <button class="filter-chip invoiced" [class.active]="statusFilter() === 'invoiced'"
                  (click)="statusFilter.set('invoiced')">Invoiced</button>
          <button class="filter-chip payment" [class.active]="statusFilter() === 'payment_released'"
                  (click)="statusFilter.set('payment_released')">Payment Released</button>
        </div>
      </div>

      <mat-card class="table-card" style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (filtered().length === 0) {
            <div class="empty-state">
              <mat-icon>receipt_long</mat-icon>
              <h3>No purchase orders found</h3>
              <p>{{ search() || statusFilter() ? 'Try adjusting your search filters.' : 'Create your first purchase order to get started.' }}</p>
              @if (!search() && !statusFilter() && auth.canDo('purchase_orders','create')) {
                <button mat-raised-button color="primary" routerLink="create">
                  <mat-icon>add</mat-icon> Create PO
                </button>
              }
            </div>
          } @else {
            <table mat-table [dataSource]="filtered()" class="full-width">

              <ng-container matColumnDef="po_number">
                <th mat-header-cell *matHeaderCellDef>PO Number</th>
                <td mat-cell *matCellDef="let po">
                  <div class="po-number-cell">
                    <div class="po-icon">
                      <mat-icon>receipt_long</mat-icon>
                    </div>
                    <div>
                      <strong class="po-num">{{ po.po_number ?? 'Draft' }}</strong>
                      <div class="po-date">{{ po.created_at | date:'dd MMM yyyy' }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="vendor">
                <th mat-header-cell *matHeaderCellDef>Vendor</th>
                <td mat-cell *matCellDef="let po">
                  <div class="vendor-cell">
                    <div class="vendor-avatar">{{ po.vendor?.name?.[0] }}</div>
                    <span>{{ po.vendor?.name ?? '—' }}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="cost_center">
                <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                <td mat-cell *matCellDef="let po" style="color:var(--text-2);">
                  {{ po.cost_center?.name ?? '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="grand_total">
                <th mat-header-cell *matHeaderCellDef>Amount</th>
                <td mat-cell *matCellDef="let po">
                  <strong class="amount">₹{{ po.grand_total | number:'1.0-0' }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let po">
                  <mat-chip [class]="'status-' + po.status" [highlighted]="true">{{ formatStatus(po.status) }}</mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="arrow">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let po">
                  <mat-icon class="row-arrow">chevron_right</mat-icon>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"
                  class="clickable-row" (click)="view(row.id)"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .page-header h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .page-header p  { margin: 3px 0 0; font-size: 13px; color: var(--text-3); }
    .cta-btn { height: 40px !important; }

    .toolbar-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-field {
      flex: 1;
      max-width: 340px;
    }
    ::ng-deep .search-field .mat-mdc-form-field-infix { padding-top: 8px !important; padding-bottom: 8px !important; }

    .filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .filter-chip {
      padding: 5px 14px;
      border-radius: 99px;
      border: 1px solid var(--border);
      background: var(--surface);
      font-size: 12px;
      font-weight: 500;
      color: var(--text-2);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .filter-chip:hover { border-color: var(--brand); color: var(--brand); }
    .filter-chip.active { background: var(--brand); border-color: var(--brand); color: white; }
    .filter-chip.pending.active   { background: #d97706; border-color: #d97706; }
    .filter-chip.approved.active  { background: #16a34a; border-color: #16a34a; }
    .filter-chip.released.active  { background: #2563eb; border-color: #2563eb; }
    .filter-chip.delivered.active { background: #059669; border-color: #059669; }
    .filter-chip.invoiced.active  { background: #92400e; border-color: #92400e; }
    .filter-chip.payment.active   { background: #4f46e5; border-color: #4f46e5; }
    .filter-chip.returned         { color: #c2410c; border-color: #fed7aa; }
    .filter-chip.returned.active  { background: #ea580c; border-color: #ea580c; color: white; }

    .full-width { width: 100%; }
    .clickable-row { cursor: pointer; }

    .po-number-cell { display: flex; align-items: center; gap: 10px; }
    .po-icon {
      width: 32px;
      height: 32px;
      background: var(--brand-light);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .po-icon mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--brand); }
    .po-num { font-size: 13px; font-weight: 600; color: var(--text-1); }
    .po-date { font-size: 11px; color: var(--text-3); }

    .vendor-cell { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .vendor-avatar {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      background: #eff6ff;
      color: #2563eb;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .amount { font-size: 13px; font-weight: 700; color: var(--text-1); }

    .row-arrow { color: var(--text-3); font-size: 18px; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 60px 24px;
      color: var(--text-3);
      text-align: center;
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--border); }
    .empty-state h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--text-2); }
    .empty-state p { margin: 0; font-size: 13px; }
  `],
})
export class PoListComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  private exportService = inject(ExportService);

  columns = ['po_number', 'vendor', 'cost_center', 'grand_total', 'status', 'arrow'];
  orders = signal<PurchaseOrder[]>([]);
  loading = signal(true);
  search = signal('');
  statusFilter = signal('');

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.statusFilter();
    return this.orders().filter(po => {
      const matchSearch = !q
        || po.po_number?.toLowerCase().includes(q)
        || (po as any).vendor?.name?.toLowerCase().includes(q);
      const matchStatus = !s || po.status === s
        || (s === 'pending' && po.status?.startsWith('pending'));
      return matchSearch && matchStatus;
    });
  });

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/purchase-orders`).subscribe({
      next: res => { this.orders.set(res.data ?? res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  view(id: number) { this.router.navigate(['/purchase-orders', id]); }

  formatStatus(s: string): string {
    const map: Record<string, string> = {
      draft: 'Draft',
      pending_l1: 'Pending L1',
      pending_l2: 'Pending L2',
      pending_l3: 'Pending L3',
      approved: 'Approved',
      released: 'Released',
      delivered: 'Delivered',
      invoiced: 'Invoiced',
      payment_released: 'Payment Released',
      closed: 'Closed',
      cancelled: 'Cancelled',
    };
    return map[s] ?? s;
  }

  exportData() {
    this.exportService.export('purchase-orders/export', { status: this.statusFilter() });
  }
}
