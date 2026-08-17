import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
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
import { MatPaginatorModule } from '@angular/material/paginator';
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
    MatPaginatorModule,
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
        <app-search-field class="search-field" [value]="search()" (valueChange)="setSearch($event)"
                          placeholder="Search by PO number, vendor…" />

        <div class="filter-chips">
          <button class="filter-chip" [class.active]="statusFilter() === ''"
                  (click)="setStatusFilter('')">All</button>
          <button class="filter-chip" [class.active]="statusFilter() === 'draft'"
                  (click)="setStatusFilter('draft')">Draft</button>
          <button class="filter-chip returned" [class.active]="statusFilter() === 'returned'"
                  (click)="setStatusFilter('returned')">⚠ Returned</button>
          <button class="filter-chip pending" [class.active]="statusFilter() === 'pending'"
                  (click)="setStatusFilter('pending')">Pending</button>
          <button class="filter-chip approved" [class.active]="statusFilter() === 'approved'"
                  (click)="setStatusFilter('approved')">Approved</button>
          <button class="filter-chip released" [class.active]="statusFilter() === 'released'"
                  (click)="setStatusFilter('released')">Released</button>
          <button class="filter-chip partial" [class.active]="statusFilter() === 'partially_delivered'"
                  (click)="setStatusFilter('partially_delivered')">Partial Delivered</button>
          <button class="filter-chip delivered" [class.active]="statusFilter() === 'delivered'"
                  (click)="setStatusFilter('delivered')">Delivered</button>
          <button class="filter-chip invoiced" [class.active]="statusFilter() === 'invoiced'"
                  (click)="setStatusFilter('invoiced')">Invoiced</button>
          <button class="filter-chip payment" [class.active]="statusFilter() === 'payment_released'"
                  (click)="setStatusFilter('payment_released')">Payment Released</button>
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
            <div class="table-responsive">
              <table mat-table [dataSource]="paginatedOrders()" class="full-width">

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
                  @if (po.delivery_status === 'partially_delivered') {
                    <mat-chip class="status-partially_delivered" [highlighted]="true">Partially Delivered</mat-chip>
                  } @else {
                    <mat-chip [class]="'status-' + po.status" [highlighted]="true">{{ formatStatus(po.status) }}</mat-chip>
                  }
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
            </div>

            <mat-paginator [length]="filtered().length"
                           [pageSize]="pageSize()"
                           [pageIndex]="pageIndex()"
                           [pageSizeOptions]="[10, 20, 50, 100]"
                           (page)="pageIndex.set($event.pageIndex); pageSize.set($event.pageSize)"
                           showFirstLastButtons>
            </mat-paginator>
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
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      align-items: center;
    }
    .search-field { flex: 1; min-width: 260px; }
    .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-chip {
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-2);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .filter-chip:hover { border-color: var(--text-3); color: var(--text-1); }
    .filter-chip.active { background: var(--primary); color: #fff; border-color: var(--primary); }
    .filter-chip.returned.active { background: #ef4444; border-color: #ef4444; }
    .filter-chip.pending.active  { background: #f59e0b; border-color: #f59e0b; }
    .filter-chip.approved.active { background: #22c55e; border-color: #22c55e; }
    .filter-chip.released.active { background: #3b82f6; border-color: #3b82f6; }
    .filter-chip.partial.active   { background: #b45309; border-color: #b45309; }
    .filter-chip.delivered.active { background: #06b6d4; border-color: #06b6d4; }
    .filter-chip.invoiced.active  { background: #8b5cf6; border-color: #8b5cf6; }
    .filter-chip.payment.active   { background: #10b981; border-color: #10b981; }

    .po-number-cell { display: flex; align-items: center; gap: 12px; }
    .po-icon {
      width: 36px; height: 36px;
      background: #eff6ff;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #2563eb;
    }
    .po-num { font-size: 14px; font-weight: 600; color: var(--text-1); }
    .po-date { font-size: 12px; color: var(--text-3); }
    .vendor-cell { display: flex; align-items: center; gap: 10px; }
    .vendor-avatar {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: #f1f5f9;
      color: #475569;
      font-size: 12px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      text-transform: uppercase;
    }
    .amount { font-size: 14px; color: var(--text-1); }
    .clickable-row { cursor: pointer; transition: background 0.15s ease; }
    .clickable-row:hover { background: var(--surface-hover); }
    .row-arrow { color: var(--text-3); font-size: 20px; }

    /* Table responsive wrapper */
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-bottom: 8px;
    }
    .table-responsive table {
      min-width: 1000px;
    }

    /* Mobile header layout adjustments */
    @media (max-width: 768px) {
      .page-wrapper { padding: 16px !important; }
      .page-header { flex-direction: column; gap: 12px; align-items: stretch !important; }
      .toolbar-bar { flex-direction: column; align-items: stretch !important; }
      .search-field { max-width: none !important; width: 100% !important; }
    }

    .status-draft      { background: #f1f5f9; color: #475569; }
    .status-returned   { background: #fef2f2; color: #dc2626; }
    .status-pending_l1 { background: #fffbeb; color: #d97706; }
    .status-pending_l2 { background: #fffbeb; color: #d97706; }
    .status-pending_l3 { background: #fffbeb; color: #d97706; }
    .status-approved   { background: #f0fdf4; color: #16a34a; }
    .status-released   { background: #eff6ff; color: #2563eb; }
    .status-sent_to_vendor { background: #eff6ff; color: #2563eb; }
    .status-partially_delivered { background: #fef3c7; color: #b45309; font-weight: 600; }
    .status-delivered  { background: #ecfeff; color: #0891b2; }
    .status-fully_delivered { background: #ecfeff; color: #0891b2; }
    .status-invoiced   { background: #f5f3ff; color: #7c3aed; }
    .status-payment_released { background: #ecfdf5; color: #059669; }
    .status-closed     { background: #f8fafc; color: #64748b; }
    .status-cancelled  { background: #fef2f2; color: #991b1b; }

    .empty-state {
      padding: 60px 20px;
      text-align: center;
      color: var(--text-3);
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--border); }
    .empty-state h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--text-2); }
    .empty-state p { margin: 0; font-size: 13px; }
  `],
})
export class PoListComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private exportService = inject(ExportService);

  columns = ['po_number', 'vendor', 'cost_center', 'grand_total', 'status', 'arrow'];
  orders = signal<PurchaseOrder[]>([]);
  loading = signal(true);
  search = signal('');
  statusFilter = signal('');

  pageIndex = signal(0);
  pageSize = signal(20);

  ngOnInit() {
    const s = this.route.snapshot.queryParamMap.get('status');
    if (s) {
      this.statusFilter.set(s);
    }
    this.fetchOrders();
  }

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.statusFilter();
    return this.orders().filter(po => {
      const matchSearch = !q
        || po.po_number?.toLowerCase().includes(q)
        || (po as any).vendor?.name?.toLowerCase().includes(q);
      const effectiveStatus = (po.delivery_status === 'partially_delivered') ? 'partially_delivered'
        : (po.delivery_status === 'delivered' || po.status === 'delivered') ? 'delivered'
        : po.status;
      const matchStatus = !s
        || effectiveStatus === s
        || (s === 'pending' && po.status?.startsWith('pending'));
      return matchSearch && matchStatus;
    });
  });

  paginatedOrders = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  setSearch(val: string) {
    this.search.set(val);
    this.pageIndex.set(0);
  }

  setStatusFilter(s: string) {
    this.statusFilter.set(s);
    this.pageIndex.set(0);
  }

  fetchOrders() {
    this.http.get<any>(`${environment.apiUrl}/purchase-orders?per_page=500`).subscribe({
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
      sent_to_vendor: 'Released',
      partially_delivered: 'Partially Delivered',
      delivered: 'Delivered',
      fully_delivered: 'Delivered',
      invoiced: 'Invoiced',
      payment_released: 'Payment Released',
      closed: 'Closed',
      cancelled: 'Cancelled',
    };
    return map[s] ?? (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  exportData() {
    this.exportService.export('purchase-orders/export', { status: this.statusFilter() });
  }
}
