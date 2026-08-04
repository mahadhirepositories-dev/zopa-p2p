import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
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
import { AuthService } from '../../core/auth/auth.service';
import { ExportService } from '../../core/services/export.service';
import { NotificationService } from '../../core/services/notification.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-pr-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TitleCasePipe, FormsModule, RouterLink,
    MatTableModule, MatButtonModule, MatChipsModule, MatIconModule,
    MatProgressSpinnerModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatPaginatorModule, MatCheckboxModule, MatTooltipModule, SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h2>Purchase Requisitions</h2>
          <p>{{ filtered().length }} requisition{{ filtered().length !== 1 ? 's' : '' }} found</p>
        </div>
        <div style="display: flex; gap: 12px;">
          @if (selectedPrIds().length > 0) {
            <button mat-raised-button color="accent" (click)="convertSelectedToPo()">
              <mat-icon>receipt_long</mat-icon> Convert Selected ({{ selectedPrIds().length }})
            </button>
          }
          <button mat-stroked-button (click)="exportData()">
            <mat-icon>download</mat-icon> Export
          </button>
          @if (auth.canDo('purchase_requisitions','create')) {
            <button mat-raised-button color="primary" routerLink="create" class="cta-btn">
              <mat-icon>add</mat-icon> New PR
            </button>
          }
        </div>
      </div>

      <div class="toolbar-bar">
        <app-search-field class="search-field" [value]="search()" (valueChange)="setSearch($event)"
                          placeholder="Search by PR number, title…" />

        <div class="filter-chips">
          <button class="filter-chip" [class.active]="statusFilter() === ''" (click)="setStatusFilter('')">All</button>
          <button class="filter-chip" [class.active]="statusFilter() === 'draft'" (click)="setStatusFilter('draft')">Draft</button>
          <button class="filter-chip submitted" [class.active]="statusFilter() === 'submitted'" (click)="setStatusFilter('submitted')">Submitted</button>
          <button class="filter-chip warning" [class.active]="statusFilter() === 'needs_clarification'" (click)="setStatusFilter('needs_clarification')">Needs Clarification</button>
          <button class="filter-chip rfq" [class.active]="statusFilter() === 'rfq_created'" (click)="setStatusFilter('rfq_created')">RFQ</button>

          <button class="filter-chip converted" [class.active]="statusFilter() === 'converted'" (click)="setStatusFilter('converted')">Converted</button>
          <button class="filter-chip" [class.active]="statusFilter() === 'short_closed'" (click)="setStatusFilter('short_closed')">Short Closed</button>
          <button class="filter-chip rejected" [class.active]="statusFilter() === 'rejected'" (click)="setStatusFilter('rejected')">Rejected</button>
        </div>

        @if (statusFilter() === 'draft' && (auth.canTransact() || auth.canDo('purchase_requisitions', 'delete'))) {
          <button mat-stroked-button color="warn" (click)="cleanupDrafts()" style="margin-left:auto;">
            <mat-icon>delete_sweep</mat-icon> Clean Up Today's Drafts
          </button>
        }
      </div>

      <mat-card class="table-card" style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (filtered().length === 0) {
            <div class="empty-state">
              <mat-icon>description</mat-icon>
              <h3>No purchase requisitions found</h3>
              <p>{{ search() || statusFilter() ? 'Try adjusting your search filters.' : 'Create your first requisition to get started.' }}</p>
              @if (!search() && !statusFilter() && auth.canDo('purchase_requisitions','create')) {
                <button mat-raised-button color="primary" routerLink="create">
                  <mat-icon>add</mat-icon> Create PR
                </button>
              }
            </div>
          } @else {
            <div class="table-responsive">
              <table mat-table [dataSource]="paginatedPrs()" class="full-width">

              <!-- Checkbox Column -->
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef style="width: 48px;">
                  <mat-checkbox (change)="toggleAll()"
                                [checked]="isAllSelected()"
                                [indeterminate]="isAnySelected() && !isAllSelected()">
                  </mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let pr" (click)="$event.stopPropagation()">
                  @if (isConvertible(pr)) {
                    <mat-checkbox (change)="toggleSelection(pr.id)"
                                  [checked]="selectedPrIds().includes(pr.id)">
                    </mat-checkbox>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="pr_number">
                <th mat-header-cell *matHeaderCellDef>PR Number</th>
                <td mat-cell *matCellDef="let pr">
                  <div class="pr-number-cell">
                    <div class="pr-icon"><mat-icon>description</mat-icon></div>
                    <div>
                      <strong class="pr-num">{{ pr.pr_number ?? 'Draft' }}</strong>
                      <div class="pr-date">{{ pr.created_at | date:'dd MMM yyyy' }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Title</th>
                <td mat-cell *matCellDef="let pr">
                  <div style="font-size:13px;font-weight:500;">{{ pr.title }}</div>
                </td>
              </ng-container>

              <ng-container matColumnDef="cost_center">
                <th mat-header-cell *matHeaderCellDef>Cost Centre</th>
                <td mat-cell *matCellDef="let pr" style="font-size:13px;color:var(--text-2);">
                  {{ pr.cost_center?.name ?? '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="project">
                <th mat-header-cell *matHeaderCellDef>Project</th>
                <td mat-cell *matCellDef="let pr" style="font-size:13px;color:var(--text-2);">
                  {{ pr.project?.name ?? '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="location">
                <th mat-header-cell *matHeaderCellDef>Location</th>
                <td mat-cell *matCellDef="let pr" style="font-size:13px;color:var(--text-2);">
                  {{ pr.location?.name ?? '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="requested_by">
                <th mat-header-cell *matHeaderCellDef>Requested By</th>
                <td mat-cell *matCellDef="let pr" style="color:var(--text-2);font-size:13px;">
                  {{ pr.requested_by?.name ?? '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="priority">
                <th mat-header-cell *matHeaderCellDef>Priority</th>
                <td mat-cell *matCellDef="let pr">
                  <span class="priority-badge priority-{{ pr.priority }}">{{ pr.priority | titlecase }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef>Est. Amount</th>
                <td mat-cell *matCellDef="let pr">
                  <strong style="font-size:13px;">₹{{ pr.estimated_amount | number:'1.0-0' }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let pr">
                  <mat-chip [class]="'status-' + (isPrConverted(pr) && pr.status === 'short_closed' ? 'converted_short_closed' : pr.status)" [highlighted]="true">{{ formatStatus(pr) }}</mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="arrow">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let pr">
                  <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
                    @if (pr.status === 'draft' && (auth.canTransact() || auth.canDo('purchase_requisitions', 'delete'))) {
                      <button mat-icon-button color="warn" matTooltip="Delete Draft PR" (click)="$event.stopPropagation(); deletePrRow(pr.id)">
                        <mat-icon style="font-size:18px;width:18px;height:18px;">delete</mat-icon>
                      </button>
                    }
                    <mat-icon class="row-arrow">chevron_right</mat-icon>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns();"
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
    .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px; }
    .page-header h2 { margin:0;font-size:20px;font-weight:700; }
    .page-header p  { margin:3px 0 0;font-size:13px;color:var(--text-3); }
    .cta-btn { height:40px!important; }
    .toolbar-bar { display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap; }
    .search-field { flex:1;max-width:340px; }
    ::ng-deep .search-field .mat-mdc-form-field-infix { padding-top:8px!important;padding-bottom:8px!important; }
    .filter-chips { display:flex;gap:6px;flex-wrap:wrap; }
    .filter-chip { padding:5px 14px;border-radius:99px;border:1px solid var(--border);background:var(--surface);font-size:12px;font-weight:500;color:var(--text-2);cursor:pointer;transition:all .15s; }
    .filter-chip:hover { border-color:var(--brand);color:var(--brand); }
    .filter-chip.active { background:var(--brand);border-color:var(--brand);color:white; }
    .filter-chip.submitted.active { background:#d97706;border-color:#d97706; }
    .filter-chip.rfq.active       { background:#2563eb;border-color:#2563eb; }
    .filter-chip.converted.active { background:#16a34a;border-color:#16a34a; }
    .filter-chip.rejected.active  { background:#dc2626;border-color:#dc2626; }
    .full-width { width:100%; }
    .clickable-row { cursor:pointer; }
    .pr-number-cell { display:flex;align-items:center;gap:10px; }
    .pr-icon { width:32px;height:32px;background:var(--brand-light);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .pr-icon mat-icon { font-size:16px;width:16px;height:16px;color:var(--brand); }
    .pr-num { font-size:13px;font-weight:600;color:var(--text-1); }
    .pr-date { font-size:11px;color:var(--text-3); }
    .row-arrow { color:var(--text-3);font-size:18px; }
    .priority-badge { display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600; }
    .priority-low    { background:#f1f5f9;color:#64748b; }
    .priority-normal { background:#eff6ff;color:#2563eb; }
    .priority-high   { background:#fff7ed;color:#d97706; }
    .priority-urgent { background:#fff1f2;color:#dc2626; }
    .empty-state { display:flex;flex-direction:column;align-items:center;gap:8px;padding:60px 24px;color:var(--text-3);text-align:center; }
    .empty-state mat-icon { font-size:48px;width:48px;height:48px;color:var(--border); }
    .empty-state h3 { margin:0;font-size:16px;font-weight:600;color:var(--text-2); }
    .empty-state p { margin:0; font-size:13px; }

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
      .search-field { max-width: none !important; }
    }
  `],
})
export class PrListComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  private exportService = inject(ExportService);
  private notify = inject(NotificationService);

  columns = ['pr_number', 'title', 'cost_center', 'project', 'location', 'requested_by', 'priority', 'amount', 'status', 'arrow'];
  prs = signal<any[]>([]);
  loading = signal(true);
  search = signal('');
  statusFilter = signal('');
  selectedPrIds = signal<number[]>([]);
  pageIndex = signal(0);
  pageSize = signal(20);

  displayedColumns = computed(() => {
    if (this.auth.canTransact()) {
      return ['select', ...this.columns];
    }
    return this.columns;
  });

  filtered = computed(() => {
    const list = Array.isArray(this.prs()) ? this.prs() : [];
    const q = (this.search() || '').trim().toLowerCase();
    const s = this.statusFilter();
    return list.filter(pr => {
      if (!pr) return false;
      const matchSearch = !q ||
        pr.pr_number?.toLowerCase().includes(q) ||
        pr.title?.toLowerCase().includes(q) ||
        pr.cost_center?.name?.toLowerCase().includes(q) ||
        pr.project?.name?.toLowerCase().includes(q) ||
        pr.location?.name?.toLowerCase().includes(q);

      let matchStatus = !s || pr.status === s;
      if (s === 'submitted') {
        matchStatus = !s || ['submitted', 'pending_l1', 'pending_l2', 'pending_l3'].includes(pr.status);
      } else if (s === 'rfq_created') {
        matchStatus = !s || ['rfq_created', 'rfq_approved'].includes(pr.status);
      } else if (s === 'converted') {
        matchStatus = !s || ['converted', 'partially_converted'].includes(pr.status);
      } else if (s === 'short_closed') {
        matchStatus = !s || ['short_closed', 'short_close_pending_l1', 'short_close_pending_l2'].includes(pr.status);
      }

      return matchSearch && matchStatus;
    });
  });

  paginatedPrs = computed(() => {
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

  loadPrs() {
    this.loading.set(true);
    this.http.get<any>(`${environment.apiUrl}/purchase-requisitions?per_page=500`).subscribe({
      next: res => {
        const items = Array.isArray(res) ? res : (res?.data ?? []);
        this.prs.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnInit() {
    this.loadPrs();
  }

  view(id: number) { this.router.navigate(['/purchase-requisitions', id]); }

  isConvertible(pr: any): boolean {
    return ['submitted', 'rfq_approved', 'partially_converted'].includes(pr.status);
  }

  isAllSelected() {
    const convertible = this.filtered().filter(pr => this.isConvertible(pr));
    return convertible.length > 0 && convertible.every(pr => this.selectedPrIds().includes(pr.id));
  }

  isAnySelected() {
    return this.selectedPrIds().length > 0;
  }

  toggleAll() {
    if (this.isAllSelected()) {
      this.selectedPrIds.set([]);
    } else {
      const convertibleIds = this.filtered()
        .filter(pr => this.isConvertible(pr))
        .map(pr => pr.id);
      this.selectedPrIds.set(convertibleIds);
    }
  }

  toggleSelection(id: number) {
    const current = this.selectedPrIds();
    if (current.includes(id)) {
      this.selectedPrIds.set(current.filter(x => x !== id));
    } else {
      this.selectedPrIds.set([...current, id]);
    }
  }

  convertSelectedToPo() {
    const ids = this.selectedPrIds();
    if (!ids.length) return;
    this.router.navigate(['/purchase-orders/create'], {
      queryParams: { pr_ids: ids.join(',') },
    });
  }

  isPrConverted(pr: any): boolean {
    if (!pr) return false;
    return !!pr.converted_at
      || pr.status === 'converted'
      || pr.status === 'partially_converted'
      || (pr.purchase_orders_count ?? pr.purchase_orders?.length ?? 0) > 0;
  }

  formatStatus(prArg: any): string {
    const s = typeof prArg === 'string' ? prArg : prArg?.status;
    const isConverted = typeof prArg === 'string' ? false : this.isPrConverted(prArg);

    if (s === 'short_closed' && isConverted) {
      return 'Converted & Short Closed';
    }
    if (s?.startsWith('short_close_pending') && isConverted) {
      return 'Converted & Short Close Pending';
    }
    const map: Record<string,string> = {
      draft: 'Draft', submitted: 'Submitted', needs_clarification: 'Needs Clarification',
      rfq_created: 'RFQ Created', rfq_approved: 'RFQ Approved', converted: 'Converted',
      partially_converted: 'Partial', rejected: 'Rejected', short_closed: 'Short Closed',
    };
    if (s === 'needs_clarification') return 'Needs Clarification';

    if (s?.startsWith('pending')) return 'Pending Approval';
    if (s?.startsWith('short_close_pending')) return 'Short Close Pending';
    return map[s] ?? s;
  }

  cleanupDrafts() {
    if (!confirm('Are you sure you want to delete all draft PRs created today?')) return;
    this.http.delete(`${environment.apiUrl}/purchase-requisitions/cleanup-drafts?today=1`).subscribe({
      next: (r: any) => {
        this.notify.success(r.message || 'Draft PRs cleaned up successfully.');
        this.loadPrs();
      },
      error: err => {
        this.notify.error(err.error?.error || 'Failed to clean up draft PRs.');
      }
    });
  }

  deletePrRow(id: number) {
    if (!confirm('Are you sure you want to delete this draft PR?')) return;
    this.http.delete(`${environment.apiUrl}/purchase-requisitions/${id}`).subscribe({
      next: () => {
        this.notify.success('Draft PR deleted.');
        this.loadPrs();
      },
      error: err => {
        this.notify.error(err.error?.error || 'Failed to delete draft PR.');
      }
    });
  }

  exportData() {
    this.exportService.export('purchase-requisitions/export', { status: this.statusFilter() });
  }
}
