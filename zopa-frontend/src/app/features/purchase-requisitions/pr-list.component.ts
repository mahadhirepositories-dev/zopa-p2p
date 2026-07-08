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
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ExportService } from '../../core/services/export.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-pr-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TitleCasePipe, FormsModule, RouterLink,
    MatTableModule, MatButtonModule, MatChipsModule, MatIconModule,
    MatProgressSpinnerModule, MatCardModule, MatFormFieldModule, MatInputModule, SearchFieldComponent,
    MatCheckboxModule,
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
        <app-search-field class="search-field" [value]="search()" (valueChange)="search.set($event)"
                          placeholder="Search by PR number, title…" />

        <div class="filter-chips">
          <button class="filter-chip" [class.active]="statusFilter() === ''" (click)="statusFilter.set('')">All</button>
          <button class="filter-chip" [class.active]="statusFilter() === 'draft'" (click)="statusFilter.set('draft')">Draft</button>
          <button class="filter-chip submitted" [class.active]="statusFilter() === 'submitted'" (click)="statusFilter.set('submitted')">Submitted</button>
          <button class="filter-chip rfq" [class.active]="statusFilter() === 'rfq_created'" (click)="statusFilter.set('rfq_created')">RFQ</button>
          <button class="filter-chip converted" [class.active]="statusFilter() === 'converted'" (click)="statusFilter.set('converted')">Converted</button>
          <button class="filter-chip rejected" [class.active]="statusFilter() === 'rejected'" (click)="statusFilter.set('rejected')">Rejected</button>
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
              <mat-icon>description</mat-icon>
              <h3>No requisitions found</h3>
              <p>{{ search() || statusFilter() ? 'Try adjusting your filters.' : 'Create your first purchase requisition.' }}</p>
              @if (!search() && !statusFilter() && auth.canDo('purchase_requisitions','create')) {
                <button mat-raised-button color="primary" routerLink="create">
                  <mat-icon>add</mat-icon> Create PR
                </button>
              }
            </div>
          } @else {
            <table mat-table [dataSource]="filtered()" class="full-width">

              <!-- Checkbox Column -->
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef style="width: 48px;">
                  <mat-checkbox (change)="$event ? toggleAll() : null"
                                [checked]="isAllSelected()"
                                [indeterminate]="isAnySelected() && !isAllSelected()">
                  </mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let pr" (click)="$event.stopPropagation()">
                  <mat-checkbox (change)="$event ? toggleSelection(pr.id) : null"
                                [checked]="selectedPrIds().includes(pr.id)"
                                [disabled]="!isConvertible(pr)">
                  </mat-checkbox>
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
                  <div style="font-size:11px;color:var(--text-3);">{{ pr.cost_center?.name }}</div>
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
                  <mat-chip [class]="'status-' + pr.status" [highlighted]="true">{{ formatStatus(pr.status) }}</mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="arrow">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let pr">
                  <mat-icon class="row-arrow">chevron_right</mat-icon>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns();"
                  class="clickable-row" (click)="view(row.id)"></tr>
            </table>
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
    .empty-state p { margin:0;font-size:13px; }
  `],
})
export class PrListComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  private exportService = inject(ExportService);

  columns = ['pr_number', 'title', 'requested_by', 'priority', 'amount', 'status', 'arrow'];
  prs = signal<any[]>([]);
  loading = signal(true);
  search = signal('');
  statusFilter = signal('');
  selectedPrIds = signal<number[]>([]);

  displayedColumns = computed(() => {
    if (this.auth.canTransact()) {
      return ['select', ...this.columns];
    }
    return this.columns;
  });

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.statusFilter();
    return this.prs().filter(pr => {
      const matchSearch = !q || pr.pr_number?.toLowerCase().includes(q) || pr.title?.toLowerCase().includes(q);
      const matchStatus = !s || pr.status === s;
      return matchSearch && matchStatus;
    });
  });

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/purchase-requisitions`).subscribe({
      next: res => { this.prs.set(res.data ?? res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
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

  formatStatus(s: string): string {
    const map: Record<string,string> = {
      draft: 'Draft', submitted: 'Submitted', rfq_created: 'RFQ Created',
      rfq_approved: 'RFQ Approved', converted: 'Converted', rejected: 'Rejected',
    };
    return map[s] ?? s;
  }

  exportData() {
    this.exportService.export('purchase-requisitions/export', { status: this.statusFilter() });
  }
}
