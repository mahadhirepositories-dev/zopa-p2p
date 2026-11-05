import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, UpperCasePipe, formatDate } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';
import { SearchSelectDialogComponent, SearchSelectOption } from '../../../shared/components/search-select-dialog.component';
import { inr } from '../../../shared/inr';

interface TenantSummary {
  id: number; name: string; code?: string; plan: string; is_active: boolean; created_at: string;
  kpi: { total_pos: number; total_pr: number; po_value: number; pending_approvals: number; avg_tat_days?: number | null; };
}

const PERIODS = [
  { key: 'all',        label: 'All Time' },
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year',  label: 'This Year' },
  { key: 'custom',     label: 'Custom Range' },
];

@Component({
  selector: 'app-zopa-dashboard',
  standalone: true,
  imports: [DecimalPipe, UpperCasePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTableModule, MatTooltipModule],
  template: `
    <div class="page-wrapper ui-page">
      <div class="page-header">
        <div>
          <h2>ZOPA Admin Dashboard</h2>
          <p>Procurement across all organizations</p>
        </div>
        <div class="header-actions">
          <button class="org-filter-btn" (click)="openOrgPicker()" matTooltip="Filter by organization — searchable">
            <mat-icon class="ofb-lead">corporate_fare</mat-icon>
            <span class="ofb-col">
              <span class="ofb-cap">Organization</span>
              <span class="ofb-name">{{ selectedTenantName() }}</span>
            </span>
            <mat-icon class="ofb-caret">expand_more</mat-icon>
          </button>

          <button mat-raised-button color="primary" (click)="exportCsv()" [disabled]="exporting()">
            @if (exporting()) {
              <mat-spinner diameter="18" />
            } @else {
              <mat-icon>download</mat-icon>
            }
            Export CSV
          </button>
        </div>
      </div>

      <div class="filters">
        <div class="period-pills" role="group" aria-label="Period">
          @for (p of periods; track p.key) {
            <button class="pill-btn" [class.active]="selectedPeriod() === p.key" [attr.aria-pressed]="selectedPeriod() === p.key"
                    (click)="setPeriod(p.key)">{{ p.label }}</button>
          }
        </div>

        @if (selectedPeriod() === 'custom') {
          <div class="custom-date-inputs">
            <label class="date-input-group">From
              <input type="date" class="date-picker-input" [value]="fromDate()" (change)="onFromDateChange($event)">
            </label>
            <label class="date-input-group">To
              <input type="date" class="date-picker-input" [value]="toDate()" (change)="onToDateChange($event)">
            </label>
            <button mat-stroked-button color="primary" [disabled]="!canApplyRange()" (click)="loadData()">Apply Range</button>
          </div>
        }
      </div>

      @if (stats(); as s) {
        <div class="ui-stack" [class.refreshing]="loading()" [attr.aria-busy]="loading()">

          <div class="ui-grid-lead">
            <section class="ui-hero" aria-labelledby="zopa-value-title">
              <div class="ui-hero-head">
                <h3 id="zopa-value-title">PO value</h3>
                <span>{{ selectedTenantName() }}, {{ periodLabel() }}</span>
              </div>
              <div class="ui-hero-figure" tabindex="0" [matTooltip]="'₹' + (s.po.approved_value | number:'1.0-0')">{{ inr(s.po.approved_value) }}</div>
              <p class="ui-hero-meta">Excluding drafts and cancelled POs</p>
            </section>

            <section class="ui-panel" aria-labelledby="zopa-docs-title">
              <div class="ui-panel-head">
                <h3 id="zopa-docs-title">Documents</h3>
                <span class="ui-panel-note">{{ periodLabel() }}</span>
              </div>
              <div class="ui-stat-band">
                <div class="ui-stat">
                  <span class="ui-stat-label">Purchase orders</span>
                  <span class="ui-stat-value ui-stat-value--sm">{{ s.po.total | number }}</span>
                </div>
                <div class="ui-stat">
                  <span class="ui-stat-label">Requisitions</span>
                  <span class="ui-stat-value ui-stat-value--sm">{{ s.pr.total | number }}</span>
                </div>
                <div class="ui-stat">
                  <span class="ui-stat-label">GRNs</span>
                  <span class="ui-stat-value ui-stat-value--sm">{{ s.grn.total | number }}</span>
                </div>
                <div class="ui-stat">
                  <span class="ui-stat-label">Invoices</span>
                  <span class="ui-stat-value ui-stat-value--sm">{{ s.invoice.total | number }}</span>
                </div>
                <div class="ui-stat">
                  <span class="ui-stat-label">POs pending approval</span>
                  <span class="ui-stat-value ui-stat-value--sm" [class.zopa-pending]="s.po.pending_approvals > 0">{{ s.po.pending_approvals | number }}</span>
                </div>
              </div>
            </section>
          </div>

          <div class="ui-grid-even">
            <section class="ui-panel" aria-labelledby="zopa-tat-title">
              <div class="ui-panel-head">
                <h3 id="zopa-tat-title">Turnaround time</h3>
                <span class="ui-panel-note">{{ periodLabel() }}</span>
              </div>
              <div class="ui-stat zopa-stat">
                @if (s.tat_summary.avg_total_days !== null) {
                  <span class="ui-stat-value">{{ s.tat_summary.avg_total_days }} <small>days</small></span>
                } @else {
                  <span class="ui-stat-value ui-stat-value--none">No data</span>
                }
                <span class="ui-stat-sub">Total cycle, PO created to delivery. Delivered orders only.</span>
              </div>
              <ul class="ui-bars">
                @for (st of stages(); track st.label) {
                  <li class="ui-bar">
                    <div class="ui-bar-text">
                      <span class="ui-bar-label">{{ st.label }}
                        @if (st.slowest) { <span class="ui-tag">Slowest</span> }
                      </span>
                      <span class="ui-bar-sub">{{ st.sub }}</span>
                    </div>
                    <span class="ui-bar-track"><span class="ui-bar-fill" [class.ui-bar-fill--accent]="st.slowest" [style.width.%]="st.pct"></span></span>
                    <span class="ui-bar-value" [class.ui-bar-value--none]="st.days === null">{{ st.days === null ? 'No data' : st.days + ' d' }}</span>
                  </li>
                }
              </ul>
            </section>

            <section class="ui-panel" aria-labelledby="zopa-value-bars-title">
              <div class="ui-panel-head">
                <h3 id="zopa-value-bars-title">Value at a glance</h3>
                <span class="ui-panel-note">{{ periodLabel() }}</span>
              </div>
              <ul class="ui-bars">
                @for (v of valueBars(); track v.label) {
                  <li class="ui-bar">
                    <div class="ui-bar-text">
                      <span class="ui-bar-label">{{ v.label }}</span>
                      <span class="ui-bar-sub">{{ v.sub }}</span>
                    </div>
                    <span class="ui-bar-track"><span class="ui-bar-fill" [style.width.%]="v.pct"></span></span>
                    <span class="ui-bar-value" [matTooltip]="'₹' + (v.value | number:'1.0-0')">{{ inr(v.value) }}</span>
                  </li>
                }
              </ul>
            </section>
          </div>

          <section class="ui-panel" aria-labelledby="zopa-pipeline-title">
            <div class="ui-panel-head">
              <h3 id="zopa-pipeline-title">PO pipeline</h3>
              <span class="ui-panel-note">{{ s.po.total | number }} total, {{ periodLabel() }}</span>
            </div>
            <div class="ui-lane-stages">
              @for (st of poStages(); track st.label) {
                <div class="ui-lane-stage" [class.ui-lane-stage--empty]="!st.count">
                  <span class="ui-lane-count">{{ st.count | number }}</span>
                  <span class="ui-lane-label">{{ st.label }}</span>
                  <span class="ui-lane-bar"><span [style.width.%]="st.pct"></span></span>
                </div>
              }
            </div>
          </section>

          <section class="ui-panel ui-panel--flush" aria-labelledby="zopa-orgs-title">
            <div class="ui-panel-head">
              <h3 id="zopa-orgs-title">Organizations</h3>
              <span class="ui-panel-note">{{ periodLabel() }}</span>
            </div>
            @if (tenants().length) {
              <div class="table-responsive">
                <table mat-table [dataSource]="tenants()" class="tenants-table">
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Organization</th>
                    <td mat-cell *matCellDef="let t">
                      <button class="org-cell" (click)="selectTenant(t.id)" [matTooltip]="'Filter to ' + t.name">
                        <span class="org-avatar">{{ t.name.substring(0, 2).toUpperCase() }}</span>
                        <span>
                          <span class="org-name">{{ t.name }}</span>
                          <span class="org-sub">Plan: {{ t.plan | uppercase }}</span>
                        </span>
                      </button>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="pos">
                    <th mat-header-cell *matHeaderCellDef class="center">POs</th>
                    <td mat-cell *matCellDef="let t" class="center"><strong>{{ t.kpi.total_pos }}</strong></td>
                  </ng-container>
                  <ng-container matColumnDef="prs">
                    <th mat-header-cell *matHeaderCellDef class="center">PRs</th>
                    <td mat-cell *matCellDef="let t" class="center">{{ t.kpi.total_pr }}</td>
                  </ng-container>
                  <ng-container matColumnDef="pending">
                    <th mat-header-cell *matHeaderCellDef class="center">Pending approval</th>
                    <td mat-cell *matCellDef="let t" class="center">
                      @if (t.kpi.pending_approvals > 0) {
                        <span class="pending-chip">{{ t.kpi.pending_approvals }}</span>
                      } @else {
                        0
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="value">
                    <th mat-header-cell *matHeaderCellDef class="num">PO value (incl. drafts)</th>
                    <td mat-cell *matCellDef="let t" class="num"><strong [matTooltip]="'₹' + (t.kpi.po_value | number:'1.0-0')">{{ inr(t.kpi.po_value) }}</strong></td>
                  </ng-container>
                  <ng-container matColumnDef="tat">
                    <th mat-header-cell *matHeaderCellDef class="center"><span matTooltip="Average days from PO created to delivery">Avg TAT</span></th>
                    <td mat-cell *matCellDef="let t" class="center">
                      @if (t.kpi.avg_tat_days !== null && t.kpi.avg_tat_days !== undefined) {
                        <span class="tat-badge" [class.tat-ok]="t.kpi.avg_tat_days <= 3" [class.tat-warn]="t.kpi.avg_tat_days > 3">{{ t.kpi.avg_tat_days }}d</span>
                      } @else {
                        —
                      }
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="tenantCols"></tr>
                  <tr mat-row *matRowDef="let row; columns: tenantCols;" class="plain-row"></tr>
                </table>
              </div>
            } @else {
              <div class="empty-state">
                <mat-icon>corporate_fare</mat-icon>
                <p>No client organizations yet.</p>
              </div>
            }
          </section>

        </div>
      } @else if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="40" />
          <span>Loading dashboard…</span>
        </div>
      } @else {
        <div class="empty-state" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>Unable to load dashboard data.</p>
          <button mat-stroked-button (click)="loadData()">Try again</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .zopa-stat { margin-bottom: 16px; }
    .zopa-pending { color: #c2410c; }

    th.num, td.num { text-align: right; }
    th.center, td.center { text-align: center; }
    .plain-row, .plain-row:hover .mat-mdc-cell { cursor: default !important; }
    .tenants-table { min-width: 720px; }
    @media (max-width: 600px) { .tenants-table { min-width: 0; } .mat-column-prs, .mat-column-tat, .org-sub { display: none; } }
    .org-cell { display: flex; align-items: center; gap: 10px; padding: 4px 0; border: 0; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    .org-cell:hover .org-name { color: var(--brand-text); text-decoration: underline; }
    .org-avatar {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; background: var(--brand-light); color: var(--brand-text);
      font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center;
    }
    .org-name { display: block; font-weight: 600; font-size: 13px; color: var(--text-1); }
    .org-sub { display: block; font-size: 11px; color: var(--text-2); }
    .pending-chip { background: #ffedd5; color: #c2410c; padding: 2px 8px; border-radius: 99px; font-size: 12px; font-weight: 700; }
    .tat-badge { padding: 2px 8px; border-radius: 99px; font-size: 12px; font-weight: 700; }
    .tat-ok { background: #f0fdf4; color: #166534; }
    .tat-warn { background: #ffedd5; color: #c2410c; }
  `],
})
export class ZopaDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);

  readonly inr = inr;
  readonly periods = PERIODS;
  readonly tenantCols = ['name', 'pos', 'prs', 'pending', 'value', 'tat'];

  tenants = signal<TenantSummary[]>([]);
  stats = signal<any>(null);
  loading = signal(true);
  exporting = signal(false);

  selectedTenantId = signal(0);
  selectedPeriod = signal<string>('all');
  fromDate = signal<string>('');
  toDate = signal<string>('');

  selectedTenantName = computed(() => {
    if (this.selectedTenantId() === 0) return 'All Organizations';
    return this.tenants().find(t => t.id === this.selectedTenantId())?.name ?? 'Selected Organization';
  });

  /** Follows the response, not the buttons, so it always names the period the figures are for. */
  periodLabel = computed(() => {
    const s = this.stats();
    if (s?.period === 'custom' && s.from_date && s.to_date) {
      return `${formatDate(s.from_date, 'd MMM yy', 'en-US')} to ${formatDate(s.to_date, 'd MMM yy', 'en-US')}`;
    }
    return PERIODS.find(p => p.key === s?.period)?.label ?? 'All Time';
  });

  canApplyRange = computed(() => !!this.fromDate() && !!this.toDate() && this.fromDate() <= this.toDate());

  stages = computed(() => {
    const t = this.stats()?.tat_summary;
    if (!t) return [];
    const rows = [
      { label: 'PO approval',    days: t.avg_approval_days as number | null, sub: 'PO created to approved' },
      { label: 'Vendor release', days: t.avg_release_days as number | null,  sub: 'PO approved to released' },
      { label: 'Delivery',       days: t.avg_delivery_days as number | null, sub: 'PO released to delivered' },
    ];
    const max = Math.max(0, ...rows.map(r => r.days ?? 0));
    return rows.map(r => ({ ...r, pct: max ? (r.days ?? 0) / max * 100 : 0, slowest: max > 0 && r.days === max }));
  });

  valueBars = computed(() => {
    const s = this.stats();
    if (!s) return [];
    const rows = [
      { label: 'All POs',       sub: 'Including drafts and cancelled', value: s.po.total_value as number },
      { label: 'PR estimates',  sub: 'Depends on estimates being entered', value: s.pr.total_value as number },
      { label: 'Invoices',      sub: 'Invoiced amount', value: s.invoice.total_value as number },
    ];
    const max = Math.max(0, ...rows.map(r => r.value));
    return rows.map(r => ({ ...r, pct: max ? r.value / max * 100 : 0 }));
  });

  poStages = computed(() => {
    const po = this.stats()?.po;
    if (!po) return [];
    const rows = [
      { label: 'Draft',     count: po.draft as number },
      { label: 'Pending',   count: po.pending_approvals as number },
      { label: 'Approved',  count: po.approved as number },
      { label: 'Released',  count: po.released as number },
      { label: 'Delivered', count: po.delivered as number },
      { label: 'Invoiced',  count: po.invoiced as number },
      { label: 'Paid',      count: po.payment_released as number },
      { label: 'Cancelled', count: po.cancelled as number },
    ];
    const max = Math.max(0, ...rows.map(r => r.count));
    return rows.map(r => ({ ...r, pct: max ? r.count / max * 100 : 0 }));
  });

  ngOnInit() {
    this.loadData();
  }

  setPeriod(p: string) {
    this.selectedPeriod.set(p);
    if (p !== 'custom') {
      this.fromDate.set('');
      this.toDate.set('');
      this.loadData();
    }
  }

  onFromDateChange(e: Event) {
    this.fromDate.set((e.target as HTMLInputElement).value);
  }

  onToDateChange(e: Event) {
    this.toDate.set((e.target as HTMLInputElement).value);
  }

  selectTenant(id: number) {
    this.selectedTenantId.set(id);
    this.loadData();
  }

  private queryString(): string {
    const queryParams: string[] = [];
    if (this.selectedTenantId() > 0) queryParams.push(`tenant_id=${this.selectedTenantId()}`);
    if (this.selectedPeriod()) queryParams.push(`period=${this.selectedPeriod()}`);
    if (this.fromDate()) queryParams.push(`from_date=${this.fromDate()}`);
    if (this.toDate()) queryParams.push(`to_date=${this.toDate()}`);
    return queryParams.length ? '?' + queryParams.join('&') : '';
  }

  loadData() {
    this.loading.set(true);
    const query = this.queryString();

    this.http.get<TenantSummary[]>(`${environment.apiUrl}/admin/dashboard/tenants${query}`).subscribe({
      next: t => this.tenants.set(t),
      error: () => {},
    });

    this.http.get<any>(`${environment.apiUrl}/admin/dashboard/stats${query}`).subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  exportCsv() {
    this.exporting.set(true);
    const url = `${environment.apiUrl}/admin/dashboard/export${this.queryString()}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `zopa_admin_dashboard_report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
      }
    });
  }

  openOrgPicker() {
    const options: SearchSelectOption[] = [
      { id: 0, name: 'All Organizations', badge: 'All', badgeAccent: 'gray' },
      ...this.tenants().map(t => ({
        id: t.id,
        name: t.name,
        sub: t.plan,
        badge: t.is_active ? 'Active' : 'Inactive',
        badgeAccent: (t.is_active ? 'green' : 'gray') as SearchSelectOption['badgeAccent'],
      })),
    ];
    const ref = this.dialog.open(SearchSelectDialogComponent, {
      width: '460px',
      maxWidth: '92vw',
      autoFocus: 'input',
      position: { top: '12vh' },
      data: {
        title: 'Select organization',
        options,
        currentId: this.selectedTenantId(),
        searchPlaceholder: 'Search organizations…',
      },
    });
    ref.afterClosed().subscribe((id?: number) => {
      if (id !== undefined && id !== null && id !== this.selectedTenantId()) {
        this.selectedTenantId.set(id);
        this.loadData();
      }
    });
  }
}
