import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, formatDate } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { SearchSelectDialogComponent, SearchSelectOption } from '../../shared/components/search-select-dialog.component';
import { inr } from '../../shared/inr';

interface TenantOption {
  id: number;
  name: string;
  plan: string;
  is_active: boolean;
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
  selector: 'app-executive-dashboard',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTableModule, MatTooltipModule],
  template: `
    <div class="page-wrapper ui-page">
      <div class="page-header">
        <div>
          <h2>Executive Dashboard</h2>
          <p>Spend, savings, turnaround and delay across procurement</p>
        </div>

        <div class="header-actions">
          <!-- Org switcher, visible only to ZOPA Super Admin -->
          @if (userScope()?.is_zopa_admin) {
            <button class="org-filter-btn" (click)="openOrgPicker()" matTooltip="Switch organization scope">
              <mat-icon class="ofb-lead">corporate_fare</mat-icon>
              <span class="ofb-col">
                <span class="ofb-cap">Organization Scope</span>
                <span class="ofb-name">{{ selectedTenantName() }}</span>
              </span>
              <mat-icon class="ofb-caret">expand_more</mat-icon>
            </button>
          } @else if (userScope()?.tenant_name) {
            <div class="client-entity-chip" matTooltip="Your Organization Scope">
              <mat-icon>business</mat-icon>
              <span>{{ userScope()?.tenant_name }}</span>
            </div>
          }

          <button mat-raised-button color="primary" (click)="exportCsv()" [disabled]="exporting()">
            @if (exporting()) {
              <mat-spinner diameter="18" />
            } @else {
              <mat-icon>download</mat-icon>
            }
            Export Report (CSV)
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

      @if (kpis(); as k) {
        <div class="ui-stack" [class.refreshing]="loading()" [attr.aria-busy]="loading()">

          <div class="ui-grid-lead">
            <section class="ui-hero" aria-labelledby="exec-value-title">
              <div class="ui-hero-head">
                <h3 id="exec-value-title">Total value managed</h3>
                <span>{{ periodLabel() }}</span>
              </div>
              <div class="ui-hero-figure" tabindex="0" [matTooltip]="'₹' + (k.total_value_managed | number:'1.0-0')">{{ inr(k.total_value_managed) }}</div>
              <p class="ui-hero-meta">{{ k.orders_processed | number }} {{ k.orders_processed === 1 ? 'PO' : 'POs' }} processed, excluding drafts and cancelled</p>
            </section>

            <section class="ui-panel" aria-labelledby="exec-savings-title">
              <div class="ui-panel-head">
                <h3 id="exec-savings-title">Savings</h3>
                <span class="ui-panel-note">Before GST</span>
              </div>
              <div class="ui-stat-band">
                <div class="ui-stat">
                  <span class="ui-stat-label">Total savings</span>
                  @if (k.total_savings_realized !== null) {
                    <span class="ui-stat-value" [matTooltip]="'₹' + (k.total_savings_realized | number:'1.0-0')">{{ inr(k.total_savings_realized) }}</span>
                  } @else {
                    <span class="ui-stat-value ui-stat-value--none">No data</span>
                  }
                </div>
                <div class="ui-stat">
                  <span class="ui-stat-label">Average savings</span>
                  @if (k.avg_savings_percentage !== null) {
                    <span class="ui-stat-value">{{ k.avg_savings_percentage }}%</span>
                  } @else {
                    <span class="ui-stat-value ui-stat-value--none">No data</span>
                  }
                </div>
              </div>
              <p class="exec-note">PO rates against PR estimates, only on lines with an estimated price.</p>
            </section>
          </div>

          <section class="ui-panel ui-stat-band" aria-label="Scope of procurement">
            <div class="ui-stat">
              <span class="ui-stat-label">Vendors managed</span>
              <span class="ui-stat-value ui-stat-value--sm">{{ k.vendors_managed | number }}</span>
            </div>
            <div class="ui-stat">
              <span class="ui-stat-label">Categories handled</span>
              <span class="ui-stat-value ui-stat-value--sm">{{ k.categories_handled | number }}</span>
            </div>
            <div class="ui-stat">
              <span class="ui-stat-label">Projects served</span>
              <span class="ui-stat-value ui-stat-value--sm">{{ k.projects_served | number }}</span>
            </div>
            <div class="ui-stat">
              <span class="ui-stat-label">Project locations</span>
              <span class="ui-stat-value ui-stat-value--sm">{{ k.project_locations_managed | number }}</span>
            </div>
            <div class="ui-stat" matTooltip="POs where the vendor and the bill-to location are in the same state">
              <span class="ui-stat-label">Local spend</span>
              @if (k.local_procurement_spend !== null) {
                <span class="ui-stat-value ui-stat-value--sm">{{ inr(k.local_procurement_spend) }}</span>
                <span class="ui-stat-sub">{{ k.local_procurement_pct }}% of value</span>
              } @else {
                <span class="ui-stat-value ui-stat-value--none">No data</span>
              }
            </div>
            <div class="ui-stat">
              <span class="ui-stat-label">Med / lab outage rate</span>
              <span class="ui-stat-value ui-stat-value--sm" [class.exec-over]="k.medicine_lab_outage_rate > 5">{{ k.medicine_lab_outage_rate }}%</span>
            </div>
          </section>

          <div class="ui-grid-even">
            <section class="ui-panel" aria-labelledby="exec-tat-title">
              <div class="ui-panel-head">
                <h3 id="exec-tat-title">Turnaround time</h3>
                <span class="ui-panel-note">{{ periodLabel() }}</span>
              </div>
              <div class="ui-stat-band exec-gap">
                <div class="ui-stat">
                  <span class="ui-stat-label">Average PR TAT</span>
                  @if (k.avg_pr_tat_days !== null) {
                    <span class="ui-stat-value ui-stat-value--sm">{{ k.avg_pr_tat_days }} <small>days</small></span>
                  } @else {
                    <span class="ui-stat-value ui-stat-value--none">No data</span>
                  }
                  <span class="ui-stat-sub">PR submission to PO creation, net of clarification</span>
                </div>
                <div class="ui-stat">
                  <span class="ui-stat-label">Average PO issue TAT</span>
                  @if (k.avg_po_issue_tat_days !== null) {
                    <span class="ui-stat-value ui-stat-value--sm">{{ k.avg_po_issue_tat_days }} <small>days</small></span>
                  } @else {
                    <span class="ui-stat-value ui-stat-value--none">No data</span>
                  }
                  <span class="ui-stat-sub">PO creation to vendor release</span>
                </div>
              </div>
              <h4 class="exec-subhead">PR TAT distribution</h4>
              <ul class="ui-bars">
                @for (entry of prDistributionEntries(); track entry.range) {
                  <li class="ui-bar">
                    <span class="ui-bar-label">{{ entry.range }}</span>
                    <span class="ui-bar-track"><span class="ui-bar-fill" [style.width.%]="entry.pct"></span></span>
                    <span class="ui-bar-value">{{ entry.count }} ({{ entry.pct }}%)</span>
                  </li>
                }
              </ul>
            </section>

            <section class="ui-panel" aria-labelledby="exec-delay-title">
              <div class="ui-panel-head">
                <h3 id="exec-delay-title">Delay by workflow stage</h3>
                <span class="ui-panel-note">Right now</span>
              </div>
              @if (k.max_tat_case; as c) {
                <div class="exec-callout">
                  <div>
                    <strong>Longest turnaround: {{ c.number }}</strong>
                    <span>{{ c.type }}. Slowest stage: {{ c.slowest_stage }}</span>
                  </div>
                  <span class="exec-callout-days">{{ c.tat_days }} days</span>
                </div>
              }
              <div class="table-responsive">
                <table mat-table [dataSource]="k.delay_mapping">
                  <ng-container matColumnDef="stage">
                    <th mat-header-cell *matHeaderCellDef>Workflow stage</th>
                    <td mat-cell *matCellDef="let row"><strong>{{ row.stage }}</strong></td>
                  </ng-container>
                  <ng-container matColumnDef="count">
                    <th mat-header-cell *matHeaderCellDef class="center">Pending</th>
                    <td mat-cell *matCellDef="let row" class="center"><span class="count-badge">{{ row.count }}</span></td>
                  </ng-container>
                  <ng-container matColumnDef="oldest_days">
                    <th mat-header-cell *matHeaderCellDef>Oldest</th>
                    <td mat-cell *matCellDef="let row">{{ row.oldest_days === null ? '—' : row.oldest_days + ' days' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="impact">
                    <th mat-header-cell *matHeaderCellDef class="num">Impact</th>
                    <td mat-cell *matCellDef="let row" class="num">
                      <span class="impact-chip" [class.impact-high]="row.impact === 'High'" [class.impact-med]="row.impact === 'Moderate'">{{ row.impact }}</span>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="delayCols"></tr>
                  <tr mat-row *matRowDef="let row; columns: delayCols;" class="plain-row"></tr>
                </table>
              </div>
            </section>
          </div>

          <section class="ui-panel ui-panel--flush" aria-labelledby="exec-cat-title">
            <div class="ui-panel-head">
              <h3 id="exec-cat-title">Value share and savings by category</h3>
              <span class="ui-panel-note">{{ periodLabel() }}</span>
            </div>
            @if (k.category_spend?.length) {
              <div class="table-responsive">
                <table mat-table [dataSource]="k.category_spend" class="cat-table">
                  <ng-container matColumnDef="category_name">
                    <th mat-header-cell *matHeaderCellDef>Category</th>
                    <td mat-cell *matCellDef="let cat"><strong>{{ cat.category_name }}</strong></td>
                  </ng-container>
                  <ng-container matColumnDef="spend">
                    <th mat-header-cell *matHeaderCellDef class="num">Spend (incl. GST)</th>
                    <td mat-cell *matCellDef="let cat" class="num"><strong>₹{{ cat.spend | number:'1.0-0' }}</strong></td>
                  </ng-container>
                  <ng-container matColumnDef="share_pct">
                    <th mat-header-cell *matHeaderCellDef class="center">Value share</th>
                    <td mat-cell *matCellDef="let cat" class="center">{{ cat.share_pct }}%</td>
                  </ng-container>
                  <ng-container matColumnDef="estimated_budget">
                    <th mat-header-cell *matHeaderCellDef class="num">PR estimate (before GST)</th>
                    <td mat-cell *matCellDef="let cat" class="num">
                      @if (cat.estimated_budget !== null) { ₹{{ cat.estimated_budget | number:'1.0-0' }} } @else { — }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="savings">
                    <th mat-header-cell *matHeaderCellDef class="num">Savings (before GST)</th>
                    <td mat-cell *matCellDef="let cat" class="num">
                      @if (cat.savings !== null) { <strong>₹{{ cat.savings | number:'1.0-0' }}</strong> } @else { — }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="savings_pct">
                    <th mat-header-cell *matHeaderCellDef class="center">Savings %</th>
                    <td mat-cell *matCellDef="let cat" class="center">
                      @if (cat.savings_pct !== null) { {{ cat.savings_pct }}% } @else { — }
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="categoryCols"></tr>
                  <tr mat-row *matRowDef="let row; columns: categoryCols;" class="plain-row"></tr>
                </table>
              </div>
              <p class="exec-note exec-note--pad">Savings compare PO rates with PR estimates before GST, only on lines that came from a PR with an estimated price.</p>
            } @else {
              <div class="empty-state">
                <mat-icon>pie_chart</mat-icon>
                <p>No category spend in this period.</p>
              </div>
            }
          </section>

        </div>
      } @else if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="44" />
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
    .client-entity-chip {
      display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 10px;
      background: var(--surface); border: 1px solid var(--border); font-size: 13px; font-weight: 600; color: var(--text-1);
    }
    .client-entity-chip mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-2); }

    .exec-note { margin: 14px 0 0; font-size: 12px; color: var(--text-2); }
    .exec-note--pad { margin: 0; padding: 10px 20px 14px; }
    .exec-over { color: #b91c1c; }
    .exec-gap { margin-bottom: 18px; }
    .exec-subhead { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--text-1); }

    .exec-callout {
      display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
      margin-bottom: 14px; padding: 10px 14px; border-radius: var(--r); background: var(--brand-light); font-size: 12px; color: #9a3412;
    }
    .exec-callout strong { display: block; font-size: 13px; }
    .exec-callout-days { font-size: 18px; font-weight: 700; white-space: nowrap; }

    th.num, td.num { text-align: right; }
    th.center, td.center { text-align: center; }
    .plain-row, .plain-row:hover .mat-mdc-cell { cursor: default !important; }
    .cat-table { min-width: 700px; }
    @media (max-width: 600px) { .cat-table { min-width: 0; } .mat-column-share_pct, .mat-column-estimated_budget, .mat-column-savings { display: none; } }
    .count-badge { background: #f3f2ed; color: var(--text-1); padding: 2px 8px; border-radius: 99px; font-weight: 700; font-size: 12px; }
    .impact-chip { padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; background: #f3f2ed; color: var(--text-2); white-space: nowrap; }
    .impact-high { background: #fee2e2; color: #991b1b; }
    .impact-med { background: #ffedd5; color: #c2410c; }
  `],
})
export class ExecutiveDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);

  readonly inr = inr;
  readonly periods = PERIODS;
  readonly delayCols = ['stage', 'count', 'oldest_days', 'impact'];
  readonly categoryCols = ['category_name', 'spend', 'share_pct', 'estimated_budget', 'savings', 'savings_pct'];

  tenants = signal<TenantOption[]>([]);
  kpis = signal<any>(null);
  userScope = signal<any>(null);
  loading = signal(true);
  exporting = signal(false);

  selectedTenantId = signal<number>(0);
  selectedPeriod = signal<string>('all');
  fromDate = signal<string>('');
  toDate = signal<string>('');

  selectedTenantName = computed(() => {
    const id = this.selectedTenantId();
    if (id === 0) return 'All Organizations';
    const found = this.tenants().find(t => t.id === id);
    if (found) return found.name;
    const scopeName = this.userScope()?.tenant_name;
    if (scopeName && this.userScope()?.tenant_id === id) return scopeName;
    return `Organization #${id}`;
  });

  /** Follows the response, not the buttons, so it always names the period the figures are for. */
  periodLabel = computed(() => {
    const k = this.kpis();
    if (k?.period === 'custom' && k.from_date && k.to_date) {
      return `${formatDate(k.from_date, 'd MMM yy', 'en-US')} to ${formatDate(k.to_date, 'd MMM yy', 'en-US')}`;
    }
    return PERIODS.find(p => p.key === k?.period)?.label ?? 'All Time';
  });

  canApplyRange = computed(() => !!this.fromDate() && !!this.toDate() && this.fromDate() <= this.toDate());

  prDistributionEntries = computed(() => {
    const dist = this.kpis()?.pr_tat_distribution;
    if (!dist) return [];
    return Object.entries(dist).map(([range, val]: [string, any]) => ({ range, count: val.count, pct: val.pct }));
  });

  ngOnInit() {
    this.loadTenants();
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

  loadTenants() {
    this.http.get<TenantOption[]>(`${environment.apiUrl}/admin/dashboard/tenants`).subscribe({
      next: t => this.tenants.set(t),
      error: () => {},
    });
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
    this.http.get<any>(`${environment.apiUrl}/executive-dashboard/stats${this.queryString()}`).subscribe({
      next: (res) => {
        this.kpis.set(res);
        this.userScope.set(res.user_scope);
        if (!res.user_scope?.is_zopa_admin && res.user_scope?.tenant_id) {
          this.selectedTenantId.set(res.user_scope.tenant_id);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  exportCsv() {
    this.exporting.set(true);
    const url = `${environment.apiUrl}/executive-dashboard/export${this.queryString()}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `executive_dashboard_kpi_report_${new Date().toISOString().slice(0, 10)}.csv`;
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
        title: 'Select organization scope',
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
