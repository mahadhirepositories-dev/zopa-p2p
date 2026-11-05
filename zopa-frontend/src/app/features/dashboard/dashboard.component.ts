import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, NgTemplateOutlet, formatDate } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subscription, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { inr } from '../../shared/inr';

interface PoItem { sno: number; description: string; code: string|null; uom: string|null; qty: number; net_rate: number; gst_rate: number; amount: number; required_by: string|null; warranty_months: number; }
interface PoKpi  { id: number; po_number: string; status: string; vendor: string; cost_center: string; grand_total: number; net_total: number; tax_amount: number; items_count: number; created_at: string; approved_at: string|null; released_at: string|null; days_to_approve: number|null; days_to_release: number|null; total_cycle_days: number|null; items: PoItem[]; tat_badge?: string; badge_color?: string; }
interface PrKpi {
  id: number; pr_number: string; title: string; status: string; cost_center: string;
  estimated_amount: number; created_at: string;
  submitted_at: string|null; rfq_created_at: string|null; rfq_approved_at: string|null; converted_at: string|null;
  days_to_submit: number|null; days_rfq_create: number|null; days_rfq_approve: number|null;
  days_to_convert: number|null; total_cycle_days: number|null;
}
interface DashboardStats {
  filter?: { period: string; from_date?: string|null; to_date?: string|null };
  tat_summary: {
    avg_total_days: number|null;
    avg_pr_tat_days: number|null;
    avg_pr_tat_net_days: number|null;
    avg_approval_days: number|null;
    avg_release_days: number|null;
    avg_delivery_days: number|null;
  };
  spend: { value: number; count: number; previous_value: number|null; trend: Array<{ month: string; value: number }> };
  attention: {
    pos_returned: number;
    pos_ready_to_release: number;
    deliveries_delayed: number;
    prs_needing_clarification: number;
    prs_ageing: number;
  };
  po_counts: Record<string, number>;
  pending_approvals: number;
  budget_summary: Array<{ id: number; name: string; annual: number; frozen: number; consumed: number; available: number }>;
  po_kpi: PoKpi[];
  pr_counts: Record<string, number>;
  pr_kpi: PrKpi[];
  pending_pr_tracking?: any[];
  po_delivery_tracking?: any[];
  latest_operational_report?: any;
}

type TabKey = 'pos' | 'prs' | 'open_prs' | 'deliveries';

interface AttentionItem {
  key: string;
  count: number;
  label: string;
  hint: string;
  severity: 'critical' | 'warning' | 'info';
  show: boolean;
  link?: string;
  status?: string;
  tab?: TabKey;
}

const PERIODS = [
  { key: 'all',        label: 'All Time' },
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year',  label: 'This Year' },
  { key: 'custom',     label: 'Custom Range' },
];

const DELTA_LABEL: Record<string, string> = {
  today: 'vs this time yesterday',
  this_week: 'vs this point last week',
  this_month: 'vs this point last month',
  this_year: 'vs this point last year',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PR_STAGES = [
  { label: 'Draft',         status: 'draft',               from: ['draft'] },
  { label: 'Submitted',     status: 'submitted',           from: ['submitted', 'pending_l1', 'pending_l2', 'pending_l3'] },
  { label: 'Clarification', status: 'needs_clarification', from: ['needs_clarification'] },
  { label: 'In RFQ',        status: 'rfq_created',         from: ['rfq_created', 'rfq_approved'] },
  { label: 'Converted',     status: 'converted',           from: ['converted', 'partially_converted'] },
];
const PO_STAGES = [
  { label: 'Draft',     status: 'draft',            from: ['draft'] },
  { label: 'Returned',  status: 'returned',         from: ['returned'] },
  { label: 'Pending',   status: 'pending',          from: ['pending_l1', 'pending_l2', 'pending_l3'] },
  { label: 'Approved',  status: 'approved',         from: ['approved'] },
  { label: 'Released',  status: 'released',         from: ['released', 'partially_delivered'] },
  { label: 'Delivered', status: 'delivered',        from: ['delivered'] },
  { label: 'Invoiced',  status: 'invoiced',         from: ['invoiced'] },
  { label: 'Paid',      status: 'payment_released', from: ['payment_released'] },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, NgTemplateOutlet, RouterLink,
    MatIconModule, MatButtonModule, MatTableModule, MatTabsModule, MatProgressBarModule, MatTooltipModule,
  ],
  animations: [
    trigger('expandCollapse', [
      state('collapsed', style({ height: '0px', minHeight: '0', opacity: 0 })),
      state('expanded',  style({ height: '*', opacity: 1 })),
      transition('expanded <=> collapsed', animate('220ms cubic-bezier(0.4,0,0.2,1)')),
    ]),
  ],
  template: `
    <div class="page-wrapper ui-page">

      <div class="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Good {{ greeting() }}, {{ auth.user()?.name || 'there' }}</p>
        </div>
        <div class="head-actions">
          @if (auth.canDo('purchase_requisitions', 'create')) {
            <a mat-stroked-button routerLink="/purchase-requisitions/create"><mat-icon>add</mat-icon> New Requisition</a>
          }
          @if (auth.canDo('purchase_orders', 'create')) {
            <a mat-raised-button color="primary" routerLink="/purchase-orders/create"><mat-icon>add</mat-icon> New Purchase Order</a>
          }
        </div>
      </div>

      <div class="filters">
        <!-- Live lists ignore the period, so a role that only sees those has nothing to filter. -->
        @if (canSeePos() || canSeePrs()) {
          <div class="period-pills" role="group" aria-label="Period">
            @for (p of periods; track p.key) {
              <button class="pill-btn" [class.active]="selectedPeriod() === p.key" [attr.aria-pressed]="selectedPeriod() === p.key"
                      (click)="setPeriod(p.key)">{{ p.label }}</button>
            }
          </div>
        }

        @if (selectedPeriod() === 'custom') {
          <div class="custom-date-inputs">
            <label class="date-input-group">From
              <input type="date" class="date-picker-input" [value]="fromDate()" (change)="onFromDateChange($event)">
            </label>
            <label class="date-input-group">To
              <input type="date" class="date-picker-input" [value]="toDate()" (change)="onToDateChange($event)">
            </label>
            <button mat-stroked-button color="primary" [disabled]="!canApplyRange()" (click)="reload()">Apply Range</button>
          </div>
        }

        @if (stats()?.latest_operational_report; as op) {
          @if (auth.canDo('reports', 'view')) {
            <a class="report-link" routerLink="/reports" [matTooltip]="op.sent_at ? 'Sent ' + (op.sent_at | date:'dd MMM yyyy, HH:mm') : 'Status: ' + op.status">
              <mat-icon>assignment</mat-icon>
              <span>Latest report: {{ op.title }}</span>
            </a>
          }
        }
      </div>

      @if (loadFailed() && stats()) {
        <div class="refresh-error" role="alert">
          <mat-icon>error_outline</mat-icon>
          <span>Couldn't refresh the dashboard. These are the last figures loaded.</span>
          <button mat-button (click)="reload()">Try again</button>
        </div>
      }

      @if (stats(); as s) {
        <div class="ui-stack" [class.refreshing]="loading()" [attr.aria-busy]="loading()">

          <div class="ui-grid-lead dash-top">
            <!-- First in the DOM so phones lead with what needs doing; wide layouts move it beside the hero. -->
            <section class="ui-panel attention" aria-labelledby="attention-title">
              <div class="ui-panel-head">
                <h3 id="attention-title">Needs attention</h3>
                <span class="ui-panel-note">Right now</span>
              </div>
              @if (attention().length) {
                <ul class="attn-list">
                  @for (a of attention(); track a.key) {
                    <li>
                      @if (a.link) {
                        <a class="attn-row" [routerLink]="a.link" [queryParams]="a.status ? { status: a.status } : null">
                          <ng-container [ngTemplateOutlet]="attnRow" [ngTemplateOutletContext]="{ $implicit: a }" />
                        </a>
                      } @else {
                        <button class="attn-row" (click)="openTab(a.tab!)">
                          <ng-container [ngTemplateOutlet]="attnRow" [ngTemplateOutletContext]="{ $implicit: a }" />
                        </button>
                      }
                    </li>
                  }
                </ul>
              } @else {
                <div class="all-clear">
                  <mat-icon>check_circle</mat-icon>
                  <div>
                    <strong>Nothing needs attention</strong>
                    <span>Approvals, late deliveries and budget alerts will show here.</span>
                  </div>
                </div>
              }
            </section>

            @if (canSeePos()) {
              <section class="ui-hero" aria-labelledby="hero-title">
                <div class="ui-hero-head">
                  <h3 id="hero-title">PO value</h3>
                  <span>{{ periodLabel() }}</span>
                </div>
                <div class="ui-hero-figure" tabindex="0" [matTooltip]="'₹' + (s.spend.value | number:'1.0-0')">{{ inr(s.spend.value) }}</div>
                <p class="ui-hero-meta">
                  @if (spendDelta(); as d) {
                    <span class="delta"><mat-icon>{{ d.up ? 'north' : 'south' }}</mat-icon>{{ d.pct }}% {{ d.label }}</span>
                  }
                  <span>
                    @if (s.spend.count) {
                      {{ s.spend.count | number }} {{ s.spend.count === 1 ? 'PO' : 'POs' }}, excluding drafts and cancelled
                    } @else {
                      No POs raised in this period
                    }
                  </span>
                </p>
                @if (hasTrend()) {
                  <ol class="trend" aria-label="PO value for each of the last 6 months">
                    @for (m of trend(); track m.month) {
                      <li class="trend-col" [class.trend-col--now]="$last">
                        <span class="trend-plot">
                          <span class="trend-bar" [style.height.%]="m.pct">
                            <span class="trend-val">{{ m.value ? inr(m.value) : '' }}</span>
                          </span>
                        </span>
                        <span class="trend-month">{{ m.label }}</span>
                      </li>
                    }
                  </ol>
                } @else {
                  <p class="trend-empty">The monthly trend appears once POs are raised.</p>
                }
              </section>
            }
          </div>

          <div class="ui-grid-even">
            @if (canSeePos()) {
              <section class="ui-panel" aria-labelledby="tat-title">
                <div class="ui-panel-head">
                  <h3 id="tat-title">Turnaround time</h3>
                  <span class="ui-panel-note">{{ periodLabel() }}</span>
                </div>
                <div class="ui-stat dash-stat">
                  @if (s.tat_summary.avg_total_days !== null) {
                    <span class="ui-stat-value">{{ s.tat_summary.avg_total_days }} <small>days</small></span>
                  } @else {
                    <span class="ui-stat-value ui-stat-value--none">No data</span>
                  }
                  <span class="ui-stat-sub">Total fulfilment, submitted PR to delivery. Delivered orders only.</span>
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
            }

            @if (auth.canDo('cost_centers', 'view')) {
              <section class="ui-panel" aria-labelledby="budget-title">
                <div class="ui-panel-head">
                  <h3 id="budget-title">Budget used</h3>
                  <span class="ui-panel-note">This fiscal year</span>
                </div>
                @if (budgets().length === 0) {
                  <div class="empty-state dash-empty-sm">
                    <mat-icon>account_balance_wallet</mat-icon>
                    <p>No cost centers yet.</p>
                    @if (auth.canDo('cost_centers', 'create')) {
                      <a mat-stroked-button routerLink="/cost-centers">Add a cost center</a>
                    }
                  </div>
                } @else {
                  <div class="ui-stat dash-stat">
                    @if (budgetTotal().used !== null) {
                      <span class="ui-stat-value">{{ budgetTotal().used | number:'1.0-0' }}%</span>
                      <span class="ui-stat-sub">{{ inr(budgetTotal().committed) }} committed of {{ inr(budgetTotal().annual) }}</span>
                    } @else {
                      <span class="ui-stat-value ui-stat-value--none">No budget set</span>
                      <span class="ui-stat-sub">An admin funds a cost center through Adjust Budget.</span>
                    }
                  </div>
                  <ul class="budget-list">
                    @for (b of topBudgets(); track b.id) {
                      <li>
                        <a class="budget-row" [routerLink]="['/cost-centers', b.id]">
                          <span class="budget-line">
                            <span class="budget-name">{{ b.name }}</span>
                            <span class="budget-pct">{{ b.used === null ? 'No budget set' : (b.used | number:'1.0-0') + '%' }}</span>
                          </span>
                          @if (b.used !== null) {
                            <mat-progress-bar mode="determinate" [value]="b.used" [attr.aria-label]="b.name + ' budget used'"
                                              [class.meter--warn]="b.used > 90 && b.used <= 100" [class.meter--over]="b.used > 100" />
                            <span class="budget-left">{{ b.available < 0 ? inr(-b.available) + ' over budget' : inr(b.available) + ' left' }}</span>
                          }
                        </a>
                      </li>
                    }
                  </ul>
                  @if (budgets().length > topBudgets().length) {
                    <a class="ui-panel-link" routerLink="/cost-centers">All {{ budgets().length }} cost centers <mat-icon>arrow_forward</mat-icon></a>
                  }
                }
              </section>
            }
          </div>

          @if (lanes().length) {
            <section class="ui-panel" aria-labelledby="pipeline-title">
              <div class="ui-panel-head">
                <h3 id="pipeline-title">Pipeline</h3>
                <span class="ui-panel-note">{{ periodLabel() }}</span>
              </div>
              @for (lane of lanes(); track lane.title) {
                <div class="ui-lane">
                  <div class="ui-lane-head">
                    <span class="ui-lane-title">{{ lane.title }}</span>
                    <span class="ui-lane-total">{{ lane.total | number }} total</span>
                    @if (lane.closed) { <span class="ui-lane-total">{{ lane.closed }}</span> }
                  </div>
                  <div class="ui-lane-stages">
                    @for (st of lane.stages; track st.label) {
                      <a class="ui-lane-stage" [class.ui-lane-stage--empty]="!st.count" [routerLink]="lane.route" [queryParams]="{ status: st.status }">
                        <span class="ui-lane-count">{{ st.count | number }}</span>
                        <span class="ui-lane-label">{{ st.label }}</span>
                        <span class="ui-lane-bar"><span [style.width.%]="st.pct"></span></span>
                      </a>
                    }
                  </div>
                </div>
              }
            </section>
          }

          @if (tabs().length) {
            <section class="ui-panel tables" [class.tables--phone]="phone()" aria-label="Documents">
              <mat-tab-group [selectedIndex]="tabIndex()" (selectedIndexChange)="tabIndex.set($event)" animationDuration="0ms">

                @if (tabs().includes('pos')) {
                  <mat-tab label="Purchase orders">
                    <ng-template matTabContent>
                      @if (s.po_kpi.length) {
                        <div class="table-responsive">
                          <table mat-table [dataSource]="s.po_kpi" class="kpi-table" multiTemplateDataRows>
                            <ng-container matColumnDef="expand">
                              <th mat-header-cell *matHeaderCellDef></th>
                              <td mat-cell *matCellDef="let po">
                                <button mat-icon-button class="expand-btn" (click)="toggleKpi(po); $event.stopPropagation()"
                                        [attr.aria-expanded]="expandedKpi() === po.id"
                                        [matTooltip]="expandedKpi() === po.id ? 'Collapse items' : 'Expand items'"
                                        [attr.aria-label]="(expandedKpi() === po.id ? 'Collapse' : 'Expand') + ' items for ' + (po.po_number ?? 'draft')">
                                  <mat-icon>{{ expandedKpi() === po.id ? 'expand_less' : 'expand_more' }}</mat-icon>
                                </button>
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="po_number">
                              <th mat-header-cell *matHeaderCellDef>PO Number</th>
                              <td mat-cell *matCellDef="let po">
                                <a class="doc-link" [routerLink]="['/purchase-orders', po.id]" (click)="$event.stopPropagation()">{{ po.po_number ?? 'Draft' }}</a>
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="vendor">
                              <th mat-header-cell *matHeaderCellDef>Vendor</th>
                              <td mat-cell *matCellDef="let po">
                                <div class="vendor-cell">
                                  <div class="vendor-avatar">{{ po.vendor?.[0] }}</div>
                                  <span>{{ po.vendor ?? '—' }}</span>
                                </div>
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="cost_center">
                              <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                              <td mat-cell *matCellDef="let po" class="cell-sub">{{ po.cost_center ?? '—' }}</td>
                            </ng-container>
                            <ng-container matColumnDef="status">
                              <th mat-header-cell *matHeaderCellDef>Status</th>
                              <td mat-cell *matCellDef="let po"><span [class]="'status-pill status-' + po.status">{{ formatStatus(po.status) }}</span></td>
                            </ng-container>
                            <ng-container matColumnDef="items_count">
                              <th mat-header-cell *matHeaderCellDef class="center">Items</th>
                              <td mat-cell *matCellDef="let po" class="center"><span class="items-badge">{{ po.items_count }}</span></td>
                            </ng-container>
                            <ng-container matColumnDef="grand_total">
                              <th mat-header-cell *matHeaderCellDef class="num">Amount</th>
                              <td mat-cell *matCellDef="let po" class="num"><strong>₹{{ po.grand_total | number:'1.0-0' }}</strong></td>
                            </ng-container>
                            <ng-container matColumnDef="created_at">
                              <th mat-header-cell *matHeaderCellDef>Created</th>
                              <td mat-cell *matCellDef="let po" class="cell-sub">{{ po.created_at | date:'dd MMM yy' }}</td>
                            </ng-container>
                            <ng-container matColumnDef="days_to_approve">
                              <th mat-header-cell *matHeaderCellDef class="center"><span matTooltip="Days from creation to approval">Approve TAT</span></th>
                              <td mat-cell *matCellDef="let po" class="center">
                                @if (po.days_to_approve !== null) { <span [class]="tatClass(po.days_to_approve)">{{ po.days_to_approve }}d</span> } @else { <span class="tat-na">—</span> }
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="days_to_release">
                              <th mat-header-cell *matHeaderCellDef class="center"><span matTooltip="Days from approval to release">Release TAT</span></th>
                              <td mat-cell *matCellDef="let po" class="center">
                                @if (po.days_to_release !== null) { <span [class]="tatClass(po.days_to_release)">{{ po.days_to_release }}d</span> } @else { <span class="tat-na">—</span> }
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="total_cycle">
                              <th mat-header-cell *matHeaderCellDef class="center"><span matTooltip="Total days from creation to release or delivery">Total Cycle</span></th>
                              <td mat-cell *matCellDef="let po" class="center">
                                @if (po.total_cycle_days !== null) { <span [class]="tatClass(po.total_cycle_days)">{{ po.total_cycle_days }}d</span> } @else { <span class="tat-pending">In Progress</span> }
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="expandedDetail">
                              <td mat-cell *matCellDef="let po" [attr.colspan]="poCols().length" class="detail-cell">
                                <div [@expandCollapse]="expandedKpi() === po.id ? 'expanded' : 'collapsed'" class="item-detail-wrap">
                                  @if (expandedKpi() === po.id) {
                                    @if (po.items?.length) {
                                      <table class="item-detail-table">
                                        <thead>
                                          <tr>
                                            <th>#</th><th>Item Description</th><th>Code</th><th>UOM</th>
                                            <th class="num">Qty</th><th class="num">Unit Price</th><th class="num">GST %</th><th class="num">Net Amount</th>
                                            <th>Required By</th><th>Warranty</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          @for (item of po.items; track item.sno) {
                                            <tr [class.overdue-row]="isOverdue(item.required_by)">
                                              <td>{{ item.sno }}</td>
                                              <td><strong>{{ item.description }}</strong></td>
                                              <td>{{ item.code ?? '—' }}</td>
                                              <td>{{ item.uom ?? '—' }}</td>
                                              <td class="num">{{ item.qty | number:'1.0-3' }}</td>
                                              <td class="num">₹{{ item.net_rate | number:'1.2-2' }}</td>
                                              <td class="num">{{ item.gst_rate }}%</td>
                                              <td class="num"><strong>₹{{ item.amount | number:'1.2-2' }}</strong></td>
                                              <td>
                                                @if (item.required_by) {
                                                  <span [class]="isOverdue(item.required_by) ? 'req-overdue' : 'req-ok'">
                                                    {{ item.required_by | date:'dd MMM yy' }}
                                                    @if (isOverdue(item.required_by)) { <mat-icon>warning</mat-icon> }
                                                  </span>
                                                } @else { — }
                                              </td>
                                              <td>{{ item.warranty_months > 0 ? item.warranty_months + ' mo' : '—' }}</td>
                                            </tr>
                                          }
                                        </tbody>
                                      </table>
                                    } @else {
                                      <p class="detail-empty">No items found.</p>
                                    }
                                  }
                                </div>
                              </td>
                            </ng-container>
                            <tr mat-header-row *matHeaderRowDef="poCols()"></tr>
                            <tr mat-row *matRowDef="let row; columns: poCols();" (click)="router.navigate(['/purchase-orders', row.id])"></tr>
                            <tr mat-row *matRowDef="let row; columns: ['expandedDetail']" class="detail-row"></tr>
                          </table>
                        </div>
                      } @else {
                        <div class="empty-state">
                          <mat-icon>receipt_long</mat-icon>
                          <p>No purchase orders in this period.</p>
                          @if (auth.canDo('purchase_orders', 'create')) {
                            <a mat-stroked-button routerLink="/purchase-orders/create">Create a purchase order</a>
                          }
                        </div>
                      }
                    </ng-template>
                  </mat-tab>
                }

                @if (tabs().includes('prs')) {
                  <mat-tab label="Requisitions">
                    <ng-template matTabContent>
                      @if (s.pr_kpi.length) {
                        <div class="table-responsive">
                          <table mat-table [dataSource]="s.pr_kpi" class="kpi-table">
                            <ng-container matColumnDef="pr_kpi_number">
                              <th mat-header-cell *matHeaderCellDef>PR Number</th>
                              <td mat-cell *matCellDef="let pr">
                                <a class="doc-link" [routerLink]="['/purchase-requisitions', pr.id]" (click)="$event.stopPropagation()">{{ pr.pr_number ?? 'Draft' }}</a>
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="pr_kpi_title">
                              <th mat-header-cell *matHeaderCellDef>Title</th>
                              <td mat-cell *matCellDef="let pr" class="pr-title-cell">{{ pr.title }}</td>
                            </ng-container>
                            <ng-container matColumnDef="pr_kpi_cc">
                              <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                              <td mat-cell *matCellDef="let pr" class="cell-sub">{{ pr.cost_center ?? '—' }}</td>
                            </ng-container>
                            <ng-container matColumnDef="pr_kpi_status">
                              <th mat-header-cell *matHeaderCellDef>Status</th>
                              <td mat-cell *matCellDef="let pr"><span [class]="'status-pill status-' + pr.status">{{ formatStatus(pr.status) }}</span></td>
                            </ng-container>
                            <ng-container matColumnDef="pr_kpi_amount">
                              <th mat-header-cell *matHeaderCellDef class="num">Est. Value</th>
                              <td mat-cell *matCellDef="let pr" class="num">
                                @if (pr.estimated_amount) { <strong>₹{{ pr.estimated_amount | number:'1.0-0' }}</strong> } @else { <span class="tat-na">—</span> }
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="pr_kpi_date">
                              <th mat-header-cell *matHeaderCellDef>Created</th>
                              <td mat-cell *matCellDef="let pr" class="cell-sub">{{ pr.created_at | date:'dd MMM yy' }}</td>
                            </ng-container>
                            <ng-container matColumnDef="pr_days_submit">
                              <th mat-header-cell *matHeaderCellDef class="center"><span matTooltip="Days from creation to submission">Submit TAT</span></th>
                              <td mat-cell *matCellDef="let pr" class="center">
                                @if (pr.days_to_submit !== null) { <span [class]="tatClass(pr.days_to_submit)">{{ pr.days_to_submit }}d</span> } @else { <span class="tat-na">—</span> }
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="pr_days_rfq">
                              <th mat-header-cell *matHeaderCellDef class="center"><span matTooltip="Days from submission to RFQ creation">RFQ Create TAT</span></th>
                              <td mat-cell *matCellDef="let pr" class="center">
                                @if (pr.days_rfq_create !== null) { <span [class]="tatClass(pr.days_rfq_create)">{{ pr.days_rfq_create }}d</span> } @else { <span class="tat-na">—</span> }
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="pr_days_approve">
                              <th mat-header-cell *matHeaderCellDef class="center"><span matTooltip="Days from RFQ created to RFQ approved">RFQ Approve TAT</span></th>
                              <td mat-cell *matCellDef="let pr" class="center">
                                @if (pr.days_rfq_approve !== null) { <span [class]="tatClass(pr.days_rfq_approve)">{{ pr.days_rfq_approve }}d</span> } @else { <span class="tat-na">—</span> }
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="pr_total_cycle">
                              <th mat-header-cell *matHeaderCellDef class="center"><span matTooltip="Total days from PR creation to PO conversion, or so far if still open">Total Cycle</span></th>
                              <td mat-cell *matCellDef="let pr" class="center">
                                @if (pr.total_cycle_days !== null) { <span [class]="tatClass(pr.total_cycle_days)">{{ pr.total_cycle_days }}d</span> } @else { <span class="tat-pending">In Progress</span> }
                              </td>
                            </ng-container>
                            <tr mat-header-row *matHeaderRowDef="prCols()"></tr>
                            <tr mat-row *matRowDef="let row; columns: prCols();" (click)="router.navigate(['/purchase-requisitions', row.id])"></tr>
                          </table>
                        </div>
                      } @else {
                        <div class="empty-state">
                          <mat-icon>description</mat-icon>
                          <p>No requisitions in this period.</p>
                          @if (auth.canDo('purchase_requisitions', 'create')) {
                            <a mat-stroked-button routerLink="/purchase-requisitions/create">Create a requisition</a>
                          }
                        </div>
                      }
                    </ng-template>
                  </mat-tab>
                }

                @if (tabs().includes('open_prs')) {
                  <mat-tab label="Open requisitions">
                    <ng-template matTabContent>
                      <p class="tab-note">Longest waiting first, drafts last. Shows today's position, whatever period is selected.</p>
                      @if (s.pending_pr_tracking?.length) {
                        <div class="table-responsive">
                          <table mat-table [dataSource]="s.pending_pr_tracking!" class="kpi-table">
                            <ng-container matColumnDef="pr_number">
                              <th mat-header-cell *matHeaderCellDef>PR Number</th>
                              <td mat-cell *matCellDef="let pr">
                                <a class="doc-link" [routerLink]="['/purchase-requisitions', pr.id]" (click)="$event.stopPropagation()">{{ pr.pr_number }}</a>
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="title">
                              <th mat-header-cell *matHeaderCellDef>Title</th>
                              <td mat-cell *matCellDef="let pr" class="pr-title-cell">{{ pr.title }}</td>
                            </ng-container>
                            <ng-container matColumnDef="pr_raiser">
                              <th mat-header-cell *matHeaderCellDef>PR Raiser</th>
                              <td mat-cell *matCellDef="let pr"><strong>{{ pr.pr_raiser_name }}</strong></td>
                            </ng-container>
                            <ng-container matColumnDef="buyer">
                              <th mat-header-cell *matHeaderCellDef>Buyer Name</th>
                              <td mat-cell *matCellDef="let pr">{{ pr.buyer_name }}</td>
                            </ng-container>
                            <ng-container matColumnDef="cost_center">
                              <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                              <td mat-cell *matCellDef="let pr" class="cell-sub">{{ pr.cost_center }}</td>
                            </ng-container>
                            <ng-container matColumnDef="status">
                              <th mat-header-cell *matHeaderCellDef>Status</th>
                              <td mat-cell *matCellDef="let pr"><span [class]="'status-pill status-' + pr.status">{{ formatStatus(pr.status) }}</span></td>
                            </ng-container>
                            <ng-container matColumnDef="tat_days">
                              <th mat-header-cell *matHeaderCellDef class="center">TAT Days</th>
                              <td mat-cell *matCellDef="let pr" class="center"><span [class]="tatClass(pr.tat_days)">{{ pr.tat_days }} days</span></td>
                            </ng-container>
                            <tr mat-header-row *matHeaderRowDef="openPrCols()"></tr>
                            <tr mat-row *matRowDef="let row; columns: openPrCols();" (click)="router.navigate(['/purchase-requisitions', row.id])"></tr>
                          </table>
                        </div>
                      } @else {
                        <div class="empty-state">
                          <mat-icon>task_alt</mat-icon>
                          <p>No open requisitions.</p>
                        </div>
                      }
                    </ng-template>
                  </mat-tab>
                }

                @if (tabs().includes('deliveries')) {
                  <mat-tab label="Awaiting delivery">
                    <ng-template matTabContent>
                      <p class="tab-note">Longest waiting first. Shows today's position, whatever period is selected.</p>
                      @if (s.po_delivery_tracking?.length) {
                        <div class="table-responsive">
                          <table mat-table [dataSource]="s.po_delivery_tracking!" class="kpi-table">
                            <ng-container matColumnDef="po_number">
                              <th mat-header-cell *matHeaderCellDef>PO Number</th>
                              <td mat-cell *matCellDef="let po">
                                @if (canSeePos()) {
                                  <a class="doc-link" [routerLink]="['/purchase-orders', po.id]" (click)="$event.stopPropagation()">{{ po.po_number }}</a>
                                } @else {
                                  <span class="doc-plain">{{ po.po_number }}</span>
                                }
                              </td>
                            </ng-container>
                            <ng-container matColumnDef="buyer">
                              <th mat-header-cell *matHeaderCellDef>Buyer Name</th>
                              <td mat-cell *matCellDef="let po"><strong>{{ po.buyer_name }}</strong></td>
                            </ng-container>
                            <ng-container matColumnDef="vendor">
                              <th mat-header-cell *matHeaderCellDef>Vendor Name</th>
                              <td mat-cell *matCellDef="let po">{{ po.vendor_name }}</td>
                            </ng-container>
                            <ng-container matColumnDef="cost_center">
                              <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                              <td mat-cell *matCellDef="let po" class="cell-sub">{{ po.cost_center }}</td>
                            </ng-container>
                            <ng-container matColumnDef="released_at">
                              <th mat-header-cell *matHeaderCellDef>Released Date</th>
                              <td mat-cell *matCellDef="let po" class="cell-sub">{{ po.released_at | date:'dd MMM yyyy' }}</td>
                            </ng-container>
                            <ng-container matColumnDef="status">
                              <th mat-header-cell *matHeaderCellDef>Status</th>
                              <td mat-cell *matCellDef="let po"><span [class]="'status-pill status-' + po.status">{{ formatStatus(po.status) }}</span></td>
                            </ng-container>
                            <ng-container matColumnDef="tat_days">
                              <th mat-header-cell *matHeaderCellDef class="center">Days Since Release</th>
                              <td mat-cell *matCellDef="let po" class="center"><span [class]="tatClass(po.tat_days_since_release)">{{ po.tat_days_since_release }} days</span></td>
                            </ng-container>
                            <ng-container matColumnDef="tat_badge">
                              <th mat-header-cell *matHeaderCellDef class="center">TAT Status</th>
                              <td mat-cell *matCellDef="let po" class="center"><span [class]="'tat-badge tat-badge--' + po.badge_color">{{ po.tat_badge }}</span></td>
                            </ng-container>
                            <tr mat-header-row *matHeaderRowDef="deliveryCols()"></tr>
                            <tr mat-row *matRowDef="let row; columns: deliveryCols();" (click)="canSeePos() && router.navigate(['/purchase-orders', row.id])"></tr>
                          </table>
                        </div>
                      } @else {
                        <div class="empty-state">
                          <mat-icon>local_shipping</mat-icon>
                          <p>Nothing is waiting on delivery.</p>
                        </div>
                      }
                    </ng-template>
                  </mat-tab>
                }

              </mat-tab-group>
            </section>
          }

        </div>
      } @else if (loading()) {
        <div class="skeleton" aria-busy="true" aria-label="Loading dashboard">
          <div class="skel skel--hero"></div>
          <div class="skel skel--side"></div>
          <div class="skel skel--half"></div>
          <div class="skel skel--half"></div>
        </div>
      } @else {
        <div class="empty-state" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>Unable to load dashboard data.</p>
          <button mat-stroked-button (click)="reload()">Try again</button>
        </div>
      }

    </div>

    <ng-template #attnRow let-a>
      <span [class]="'attn-count attn-count--' + a.severity">{{ a.count | number }}</span>
      <span class="attn-text">
        <span class="attn-label">{{ a.label }}</span>
        <span class="attn-hint">{{ a.hint }}</span>
      </span>
      <mat-icon class="attn-chevron">chevron_right</mat-icon>
    </ng-template>
  `,
  styles: [`
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    /* ── Filters ── */
    .report-link {
      display: inline-flex; align-items: center; gap: 6px; margin-left: auto; min-width: 0; max-width: 100%;
      font-size: 12px; font-weight: 500; color: var(--text-2); text-decoration: none;
    }
    .report-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .report-link mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    .report-link:hover { color: var(--brand-hover); text-decoration: underline; }

    .refresh-error {
      display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 8px 14px;
      background: #fff1f2; border: 1px solid #fecdd3; border-radius: var(--r); color: #9f1239; font-size: 13px;
    }
    .refresh-error mat-icon { flex-shrink: 0; font-size: 18px; width: 18px; height: 18px; }
    .refresh-error span { flex: 1; min-width: 0; }
    .refresh-error button { flex-shrink: 0; }


    /* Phones lead with what needs doing; wide layouts move it beside the hero */
    @container (min-width: 860px) {
      .dash-top .attention { order: 2; }
      .dash-top .attention:only-child { grid-column: 1 / -1; }
    }

    /* ── Needs attention ── */
    .attn-list { list-style: none; margin: 0 -8px; padding: 0; }
    .attn-row {
      display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; padding: 8px; border: 0; border-radius: 10px;
      background: transparent; text-align: left; font: inherit; color: inherit; text-decoration: none; cursor: pointer;
      transition: background .12s ease;
    }
    .attn-row:hover { background: var(--bg); }
    .attn-count {
      flex-shrink: 0; min-width: 44px; height: 40px; padding: 0 8px; box-sizing: border-box; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700;
    }
    .attn-count--critical { background: #fee2e2; color: #b91c1c; }
    .attn-count--warning  { background: #ffedd5; color: #c2410c; }
    .attn-count--info     { background: #dbeafe; color: #1d4ed8; }
    .attn-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .attn-label { font-size: 13px; font-weight: 600; color: var(--text-1); }
    .attn-hint { font-size: 12px; color: var(--text-2); }
    .attn-chevron { flex-shrink: 0; color: var(--text-3); font-size: 20px; width: 20px; height: 20px; }
    .all-clear { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
    .all-clear mat-icon { flex-shrink: 0; color: #16a34a; font-size: 28px; width: 28px; height: 28px; }
    .all-clear strong { display: block; font-size: 14px; color: var(--text-1); }
    .all-clear span { font-size: 12px; color: var(--text-2); }

    /* ── Hero ── */
    .delta { display: inline-flex; align-items: center; gap: 3px; font-weight: 600; color: #fff; }
    .delta mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* The value label rides on the bar, so it sits inside the plot and the column height stays the bar's alone. */
    .trend { list-style: none; flex: 1; min-height: 130px; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
    .trend-col { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
    .trend-plot { flex: 1; width: 100%; padding-top: 20px; box-sizing: border-box; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid rgba(255,255,255,.2); }
    .trend-bar { position: relative; display: block; width: 100%; max-width: 24px; min-height: 2px; border-radius: 4px 4px 0 0; background: rgba(255,255,255,.28); }
    .trend-val { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); padding-bottom: 4px; font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.72); white-space: nowrap; }
    .trend-month { font-size: 11px; color: rgba(255,255,255,.72); }
    .trend-col--now .trend-bar { background: var(--brand); }
    .trend-col--now .trend-val, .trend-col--now .trend-month { color: #fff; font-weight: 700; }
    .trend-empty { margin: auto 0 0; font-size: 13px; color: rgba(255,255,255,.72); }

    .dash-stat { margin-bottom: 16px; }
    .ui-hero-meta { margin-bottom: 20px; }



    /* ── Budget ── */
    .budget-list { list-style: none; margin: 0 -8px; padding: 0; }
    .budget-row { display: block; padding: 8px; border-radius: 10px; color: inherit; text-decoration: none; transition: background .12s ease; }
    .budget-row:hover { background: var(--bg); }
    .budget-line { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 13px; }
    .budget-name { font-weight: 600; color: var(--text-1); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .budget-pct { flex-shrink: 0; font-weight: 700; color: var(--text-2); font-variant-numeric: tabular-nums; }
    .budget-left { display: block; margin-top: 4px; font-size: 11px; color: var(--text-2); }
    mat-progress-bar {
      --mat-progress-bar-active-indicator-color: var(--brand);
      --mat-progress-bar-track-color: #eef2f6;
      --mat-progress-bar-active-indicator-height: 6px;
      --mat-progress-bar-track-height: 6px;
    }
    mat-progress-bar.meter--warn { --mat-progress-bar-active-indicator-color: #d97706; }
    mat-progress-bar.meter--over { --mat-progress-bar-active-indicator-color: #dc2626; }


    /* ── Document tables ── */
    .tables { padding: 0; overflow: hidden; scroll-margin-top: 16px; }
    .tab-note { margin: 0; padding: 12px 16px 8px; font-size: 12px; color: var(--text-2); }
    .kpi-table { min-width: 940px; }
    .tables--phone .kpi-table { min-width: 0; }
    .kpi-table tr.mat-mdc-row { cursor: pointer; }
    th.num, td.num { text-align: right; }
    th.center, td.center { text-align: center; }
    .cell-sub { color: var(--text-2) !important; font-size: 12px !important; }
    .doc-link { color: var(--brand-hover); font-weight: 600; font-size: 13px; text-decoration: none; white-space: nowrap; }
    .doc-link:hover { text-decoration: underline; }
    .doc-plain { font-weight: 600; white-space: nowrap; }
    .vendor-cell { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .vendor-avatar { width: 28px; height: 28px; border-radius: 8px; background: var(--brand-light); color: var(--brand-hover); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .expand-btn { width: 28px; height: 28px; }
    .expand-btn mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-2); }
    .pr-title-cell { font-size: 12px; color: var(--text-2) !important; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .items-badge { background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
    .tat-ok      { color: #15803d; font-weight: 700; font-size: 12px; background: #f0fdf4; padding: 2px 7px; border-radius: 99px; white-space: nowrap; }
    .tat-warn    { color: #b45309; font-weight: 700; font-size: 12px; background: #fefce8; padding: 2px 7px; border-radius: 99px; white-space: nowrap; }
    .tat-bad     { color: #dc2626; font-weight: 700; font-size: 12px; background: #fff1f2; padding: 2px 7px; border-radius: 99px; white-space: nowrap; }
    .tat-na      { color: var(--text-2); font-size: 12px; }
    .tat-pending { background: #fff7ed; color: #c2410c; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; white-space: nowrap; }
    .tat-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; white-space: nowrap; }
    .tat-badge--red    { background: #fee2e2; color: #b91c1c; }
    .tat-badge--orange { background: #ffedd5; color: #c2410c; }
    .tat-badge--green  { background: #dcfce7; color: #15803d; }

    .detail-row { height: 0; }
    .detail-cell { padding: 0 !important; border: none !important; }
    .item-detail-wrap { overflow: hidden; background: #f8faff; }
    .item-detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .item-detail-table thead tr { background: #eef2ff; }
    .item-detail-table th { padding: 8px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #475569; border-bottom: 1px solid #dbeafe; text-align: left; white-space: nowrap; }
    .item-detail-table th.num { text-align: right; }
    .item-detail-table td { padding: 8px 14px; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: middle; }
    .item-detail-table tbody tr:last-child td { border-bottom: none; }
    .overdue-row td { background: #fff7ed !important; }
    .req-ok { color: #15803d; font-weight: 600; font-size: 11px; }
    .req-overdue { color: #dc2626; font-weight: 700; font-size: 11px; display: flex; align-items: center; gap: 3px; }
    .req-overdue mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .detail-empty { margin: 0; padding: 16px 24px; font-size: 12px; color: var(--text-2); }

    /* ── Empty and loading ── */
    .dash-empty-sm { padding: 24px 16px; }

    .skeleton { display: grid; gap: 16px; grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .skel { border-radius: var(--r-lg); background: #e2e8f0; animation: skel-pulse 1.4s ease-in-out infinite; }
    .skel--hero { grid-column: span 3; height: 300px; }
    .skel--side { grid-column: span 2; height: 300px; }
    .skel--half { grid-column: span 5; height: 200px; }
    @container (min-width: 860px) { .skel--half:nth-child(3) { grid-column: span 3; } .skel--half:nth-child(4) { grid-column: span 2; } }
    @keyframes skel-pulse { 50% { opacity: .55; } }


    @media (prefers-reduced-motion: reduce) { .skel { animation: none; } }

    @media (max-width: 768px) {
      .report-link { margin-left: 0; }
    }
    @media (max-width: 600px) {
      .head-actions { width: 100%; }
      .skel--hero, .skel--side { grid-column: span 5; }
    }
  `],
})
export class DashboardComponent {
  auth    = inject(AuthService);
  router  = inject(Router);
  private http = inject(HttpClient);
  private request?: Subscription;

  readonly periods = PERIODS;
  readonly inr = inr;

  phone = toSignal(
    inject(BreakpointObserver).observe('(max-width: 600px)').pipe(map(r => r.matches)),
    { initialValue: false },
  );

  stats       = signal<DashboardStats | null>(null);
  loading     = signal(true);
  loadFailed  = signal(false);
  expandedKpi = signal<number | null>(null);
  tabIndex    = signal(0);

  selectedPeriod = signal<string>('all');
  fromDate = signal<string>('');
  toDate   = signal<string>('');

  constructor() {
    // Load on creation AND whenever the active organization changes. Using an
    // effect (instead of ngOnInit) means an org switch performed while already
    // on the dashboard — where router navigation is a no-op — still refetches
    // tenant-scoped data. The tenant interceptor reads currentTenantId() live,
    // so the request carries the new X-Tenant-ID.
    effect(() => {
      this.auth.currentTenantId();   // track the active org
      untracked(() => {
        this.stats.set(null);        // never show one org's figures under another's name
        this.reload();
      });
    });
  }

  canSeePos = computed(() => this.auth.canDo('purchase_orders', 'view'));
  canSeePrs = computed(() => this.auth.canDo('purchase_requisitions', 'view'));

  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  });

  /** Follows the response, not the buttons, so it always names the period the figures are for. */
  periodLabel = computed(() => {
    const f = this.stats()?.filter;
    if (f?.period === 'custom' && f.from_date && f.to_date) {
      return `${formatDate(f.from_date, 'd MMM yy', 'en-US')} to ${formatDate(f.to_date, 'd MMM yy', 'en-US')}`;
    }
    return PERIODS.find(p => p.key === f?.period)?.label ?? 'All Time';
  });

  canApplyRange = computed(() => !!this.fromDate() && !!this.toDate() && this.fromDate() <= this.toDate());

  attention = computed<AttentionItem[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const can = (module: string, action: 'view' | 'edit') => this.auth.canDo(module, action);
    const items: AttentionItem[] = [
      { key: 'approvals', count: s.pending_approvals, label: 'Waiting on your approval', hint: 'POs, PRs and invoices assigned to you',
        severity: 'warning', show: can('approvals', 'edit'), link: '/approvals' },
      { key: 'deliveries', count: s.attention.deliveries_delayed, label: 'Delivery delayed', hint: 'Released over 7 days ago, not yet delivered',
        severity: 'critical', show: can('purchase_orders', 'view') || can('grns', 'view'), tab: 'deliveries' },
      { key: 'budgets', count: this.budgets().filter(b => (b.used ?? 0) > 90).length, label: 'Above 90% of budget', hint: 'Cost centers close to or over budget',
        severity: 'critical', show: can('cost_centers', 'view'), link: '/cost-centers' },
      { key: 'returned', count: s.attention.pos_returned, label: 'Returned for changes', hint: 'POs sent back by an approver',
        severity: 'warning', show: can('purchase_orders', 'edit'), link: '/purchase-orders', status: 'returned' },
      { key: 'clarification', count: s.attention.prs_needing_clarification, label: 'Clarification requested', hint: 'PRs waiting on an answer',
        severity: 'warning', show: can('purchase_requisitions', 'edit'), link: '/purchase-requisitions', status: 'needs_clarification' },
      { key: 'ageing', count: s.attention.prs_ageing, label: 'Open over 7 days', hint: 'Submitted PRs not yet converted to a PO',
        severity: 'warning', show: can('purchase_requisitions', 'view'), tab: 'open_prs' },
      { key: 'release', count: s.attention.pos_ready_to_release, label: 'Approved, not released', hint: 'POs ready to send to the vendor',
        severity: 'info', show: can('purchase_orders', 'edit'), link: '/purchase-orders', status: 'approved' },
    ];
    return items.filter(i => i.show && i.count > 0);
  });

  spendDelta = computed(() => {
    const spend = this.stats()?.spend;
    const label = DELTA_LABEL[this.stats()?.filter?.period ?? ''];
    // No percentage against nothing: it would read as infinite growth.
    if (!spend || !label || !spend.previous_value) return null;
    const change = (spend.value - spend.previous_value) / spend.previous_value * 100;
    return { pct: Math.abs(Math.round(change)), up: change >= 0, label };
  });

  trend = computed(() => {
    const months = this.stats()?.spend.trend ?? [];
    const max = Math.max(0, ...months.map(m => m.value));
    return months.map(m => ({
      ...m,
      label: MONTHS[+m.month.slice(5) - 1],
      pct: max ? m.value / max * 100 : 0,
    }));
  });
  hasTrend = computed(() => this.trend().some(m => m.value > 0));

  stages = computed(() => {
    const t = this.stats()?.tat_summary;
    if (!t) return [];
    const net = t.avg_pr_tat_net_days;
    const rows = [
      { label: 'PR to PO',       days: t.avg_pr_tat_days,
        sub: net !== null && net !== t.avg_pr_tat_days ? `Submitted PR to PO, ${net} d net of clarification` : 'Submitted PR to PO' },
      { label: 'PO approval',    days: t.avg_approval_days, sub: 'PO created to approved' },
      { label: 'Vendor release', days: t.avg_release_days,  sub: 'PO approved to released' },
      { label: 'Delivery',       days: t.avg_delivery_days, sub: 'PO approved to delivered' },
    ];
    const max = Math.max(0, ...rows.map(r => r.days ?? 0));
    return rows.map(r => ({ ...r, pct: max ? (r.days ?? 0) / max * 100 : 0, slowest: max > 0 && r.days === max }));
  });

  budgets = computed(() =>
    (this.stats()?.budget_summary ?? [])
      .map(b => ({ ...b, used: b.annual > 0 ? (b.consumed + b.frozen) / b.annual * 100 : null }))
      .sort((a, b) => (b.used ?? -1) - (a.used ?? -1))
  );
  topBudgets = computed(() => this.budgets().slice(0, 4));
  budgetTotal = computed(() => {
    const annual = this.budgets().reduce((sum, b) => sum + b.annual, 0);
    const committed = this.budgets().reduce((sum, b) => sum + b.consumed + b.frozen, 0);
    return { annual, committed, used: annual > 0 ? committed / annual * 100 : null };
  });

  lanes = computed(() => {
    const s = this.stats();
    if (!s) return [];
    const lanes = [];
    if (this.canSeePrs()) lanes.push(this.lane('Requisitions', '/purchase-requisitions', s.pr_counts, PR_STAGES));
    if (this.canSeePos()) lanes.push(this.lane('Purchase orders', '/purchase-orders', s.po_counts, PO_STAGES));
    return lanes;
  });

  private lane(title: string, route: string, counts: Record<string, number>, stages: typeof PR_STAGES) {
    const shown = stages.map(st => ({
      label: st.label,
      status: st.status,
      count: st.from.reduce((sum, key) => sum + (counts[key] ?? 0), 0),
    }));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const closed = total - shown.reduce((sum, st) => sum + st.count, 0);
    const max = Math.max(0, ...shown.map(st => st.count));
    return {
      title, route, total,
      closed: closed > 0 ? `${closed} rejected or closed` : '',
      stages: shown.map(st => ({ ...st, pct: max ? st.count / max * 100 : 0 })),
    };
  }

  tabs = computed<TabKey[]>(() => {
    const tabs: TabKey[] = [];
    if (this.canSeePos()) tabs.push('pos');
    if (this.canSeePrs()) tabs.push('prs', 'open_prs');
    if (this.canSeePos() || this.auth.canDo('grns', 'view')) tabs.push('deliveries');
    return tabs;
  });

  poCols = computed(() => this.phone()
    ? ['po_number', 'status', 'grand_total']
    : ['expand', 'po_number', 'vendor', 'cost_center', 'status', 'items_count', 'grand_total', 'created_at', 'days_to_approve', 'days_to_release', 'total_cycle']);
  prCols = computed(() => this.phone()
    ? ['pr_kpi_number', 'pr_kpi_status', 'pr_total_cycle']
    : ['pr_kpi_number', 'pr_kpi_title', 'pr_kpi_cc', 'pr_kpi_status', 'pr_kpi_amount', 'pr_kpi_date', 'pr_days_submit', 'pr_days_rfq', 'pr_days_approve', 'pr_total_cycle']);
  openPrCols = computed(() => this.phone()
    ? ['pr_number', 'status', 'tat_days']
    : ['pr_number', 'title', 'pr_raiser', 'buyer', 'cost_center', 'status', 'tat_days']);
  deliveryCols = computed(() => this.phone()
    ? ['po_number', 'tat_days', 'tat_badge']
    : ['po_number', 'buyer', 'vendor', 'cost_center', 'released_at', 'status', 'tat_days', 'tat_badge']);

  setPeriod(p: string) {
    this.selectedPeriod.set(p);
    if (p !== 'custom') {
      this.fromDate.set('');
      this.toDate.set('');
      this.reload();
    }
  }

  onFromDateChange(e: Event) {
    this.fromDate.set((e.target as HTMLInputElement).value);
  }

  onToDateChange(e: Event) {
    this.toDate.set((e.target as HTMLInputElement).value);
  }

  reload() {
    this.loading.set(true);
    this.loadFailed.set(false);

    let params = new HttpParams().set('period', this.selectedPeriod());
    if (this.fromDate()) params = params.set('from_date', this.fromDate());
    if (this.toDate()) params = params.set('to_date', this.toDate());

    this.request?.unsubscribe();   // a slow earlier response must not overwrite a newer one
    this.request = this.http.get<DashboardStats>(`${environment.apiUrl}/dashboard/stats`, { params }).subscribe({
      next: s  => { this.stats.set(s); this.loading.set(false); },
      error: () => { this.loading.set(false); this.loadFailed.set(true); },
    });
  }

  /** Attention items with no list of their own open the matching table on this page. */
  openTab(key: TabKey) {
    this.tabIndex.set(this.tabs().indexOf(key));
    document.querySelector('.tables')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleKpi(po: PoKpi) {
    this.expandedKpi.update(cur => cur === po.id ? null : po.id);
  }

  tatClass(days: number): string {
    if (days <= 1)  return 'tat-ok';
    if (days <= 3)  return 'tat-warn';
    return 'tat-bad';
  }

  isOverdue(requiredBy: string | null): boolean {
    if (!requiredBy) return false;
    return new Date(requiredBy) < new Date();
  }

  formatStatus(s: string): string {
    const map: Record<string, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      needs_clarification: 'Needs Clarification',
      rfq_created: 'RFQ Created',
      rfq_approved: 'RFQ Approved',
      partially_converted: 'Partly Converted',
      converted: 'Converted to PO',
      short_closed: 'Short Closed',
      rejected: 'Rejected',
      returned: 'Returned',
      pending_l1: 'Pending L1',
      pending_l2: 'Pending L2',
      pending_l3: 'Pending L3',
      approved: 'Approved',
      released: 'Released',
      partially_delivered: 'Partly Delivered',
      delivered: 'Delivered',
      invoiced: 'Invoiced',
      payment_released: 'Payment Released',
      closed: 'Closed',
      cancelled: 'Cancelled',
    };
    return map[s] ?? s;
  }
}
