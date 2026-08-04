import { Component, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

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
  filter?: { period: string; from_date?: string; to_date?: string };
  tat_summary?: { avg_approval_days: number; avg_release_days: number; avg_delivery_days: number; avg_total_days: number };
  po_counts: Record<string, number>;
  pending_approvals: number;
  recent_pos: any[];
  budget_summary: Array<{ id: number; name: string; annual: number; frozen: number; consumed: number; available: number }>;
  po_kpi: PoKpi[];
  pr_counts: Record<string, number>;
  recent_prs: any[];
  pr_kpi: PrKpi[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, RouterLink, FormsModule,
    MatCardModule, MatIconModule, MatButtonModule, MatChipsModule,
    MatTableModule, MatProgressBarModule, MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  animations: [
    trigger('expandCollapse', [
      state('collapsed', style({ height: '0px', minHeight: '0', opacity: 0 })),
      state('expanded',  style({ height: '*', opacity: 1 })),
      transition('expanded <=> collapsed', animate('220ms cubic-bezier(0.4,0,0.2,1)')),
    ]),
  ],
  template: `
    <div class="page-wrapper">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Good {{ greeting() }}, {{ auth.user()?.name || 'there' }}</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/purchase-orders/create" class="cta-btn">
          <mat-icon>add</mat-icon> New Purchase Order
        </button>
      </div>

      <!-- ── Date Filter Bar ─────────────────────────────────────────────── -->
      <div class="filter-toolbar mb-6">
        <div class="period-pills">
          <button class="pill-btn" [class.active]="selectedPeriod() === 'all'" (click)="setPeriod('all')">All Time</button>
          <button class="pill-btn" [class.active]="selectedPeriod() === 'today'" (click)="setPeriod('today')">Today</button>
          <button class="pill-btn" [class.active]="selectedPeriod() === 'this_week'" (click)="setPeriod('this_week')">This Week</button>
          <button class="pill-btn" [class.active]="selectedPeriod() === 'this_month'" (click)="setPeriod('this_month')">This Month</button>
          <button class="pill-btn" [class.active]="selectedPeriod() === 'this_year'" (click)="setPeriod('this_year')">This Year</button>
          <button class="pill-btn" [class.active]="selectedPeriod() === 'custom'" (click)="setPeriod('custom')">Custom Range</button>
        </div>

        @if (selectedPeriod() === 'custom') {
          <div class="custom-date-inputs">
            <div class="date-input-group">
              <label>From</label>
              <input type="date" class="date-picker-input" [value]="fromDate()" (change)="onFromDateChange($event)">
            </div>
            <div class="date-input-group">
              <label>To</label>
              <input type="date" class="date-picker-input" [value]="toDate()" (change)="onToDateChange($event)">
            </div>
            <button mat-stroked-button color="primary" (click)="applyCustomFilter()">Apply Range</button>
          </div>
        }
      </div>

      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="44" />
          <span>Loading dashboard…</span>
        </div>

      } @else if (stats()) {

        <!-- ── Stat cards ──────────────────────────────────── -->
        <div class="stat-grid">

          <div class="stat-card anim-1">
            <div class="stat-card-body">
              <div class="stat-label">Total POs</div>
              <div class="stat-value">{{ totalPos() }}</div>
              <div class="stat-trend">
                <span class="trend-dot" style="background:#f97316;"></span>
                All purchase orders
              </div>
            </div>
            <div class="stat-card-icon" style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);">
              <mat-icon>receipt_long</mat-icon>
            </div>
          </div>

          <div class="stat-card anim-2 clickable" (click)="router.navigate(['/approvals'])">
            <div class="stat-card-body">
              <div class="stat-label">Pending Approvals</div>
              <div class="stat-value"
                [style.color]="pendingPos() > 0 ? '#d97706' : '#16a34a'">
                {{ pendingPos() }}
              </div>
              <div class="stat-trend">
                @if (pendingPos() > 0) {
                  <span class="trend-badge warn">Needs action</span>
                } @else {
                  <span class="trend-badge ok">All clear</span>
                }
              </div>
            </div>
            <div class="stat-card-icon"
              [style.background]="pendingPos() > 0
                ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                : 'linear-gradient(135deg,#22c55e,#16a34a)'">
              <mat-icon>{{ pendingPos() > 0 ? 'pending_actions' : 'check_circle' }}</mat-icon>
            </div>
          </div>

          <div class="stat-card anim-3">
            <div class="stat-card-body">
              <div class="stat-label">Approved</div>
              <div class="stat-value" style="color:#16a34a;">{{ stats()!.po_counts['approved'] ?? 0 }}</div>
              <div class="stat-trend">
                <span class="trend-dot" style="background:#16a34a;"></span>
                Ready for release
              </div>
            </div>
            <div class="stat-card-icon" style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);">
              <mat-icon>verified</mat-icon>
            </div>
          </div>

          <div class="stat-card anim-4">
            <div class="stat-card-body">
              <div class="stat-label">Released</div>
              <div class="stat-value" style="color:#2563eb;">{{ stats()!.po_counts['released'] ?? 0 }}</div>
              <div class="stat-trend">
                <span class="trend-dot" style="background:#2563eb;"></span>
                Sent to vendor
              </div>
            </div>
            <div class="stat-card-icon" style="background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);">
              <mat-icon>local_shipping</mat-icon>
            </div>
          </div>

        </div>

        <!-- ── Intuitive TAT Summary Performance Pipeline ──────────────────────── -->
        <mat-card class="tat-summary-card mb-6">
          <mat-card-header>
            <div class="tat-card-title">
              <mat-icon color="primary">speed</mat-icon>
              <span>Turnaround Time (TAT) Pipeline Performance</span>
            </div>
          </mat-card-header>
          <mat-card-content>
            <div class="tat-pipeline">
              <div class="tat-step">
                <div class="tat-step-num">1</div>
                <div class="tat-step-info">
                  <div class="tat-step-label">PO Approval TAT</div>
                  <div class="tat-step-val">{{ stats()?.tat_summary?.avg_approval_days ?? 0 }} days</div>
                  <div class="tat-step-sub">Created → Approved</div>
                </div>
              </div>
              <div class="tat-arrow"><mat-icon>east</mat-icon></div>

              <div class="tat-step">
                <div class="tat-step-num">2</div>
                <div class="tat-step-info">
                  <div class="tat-step-label">Vendor Release TAT</div>
                  <div class="tat-step-val">{{ stats()?.tat_summary?.avg_release_days ?? 0 }} days</div>
                  <div class="tat-step-sub">Approved → Released</div>
                </div>
              </div>
              <div class="tat-arrow"><mat-icon>east</mat-icon></div>

              <div class="tat-step">
                <div class="tat-step-num">3</div>
                <div class="tat-step-info">
                  <div class="tat-step-label">GRN / Delivery TAT</div>
                  <div class="tat-step-val">{{ stats()?.tat_summary?.avg_delivery_days ?? 0 }} days</div>
                  <div class="tat-step-sub">Released → Delivered</div>
                </div>
              </div>
              <div class="tat-arrow"><mat-icon>east</mat-icon></div>

              <div class="tat-step tat-step--total">
                <div class="tat-step-num"><mat-icon>flag</mat-icon></div>
                <div class="tat-step-info">
                  <div class="tat-step-label">Total Cycle TAT</div>
                  <div class="tat-step-val text-primary">{{ stats()?.tat_summary?.avg_total_days ?? 0 }} days</div>
                  <div class="tat-step-sub">End to End Cycle</div>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- ── Charts row ───────────────────────────────────── -->
        <div class="charts-row">

          <!-- PO Status Donut -->
          <mat-card class="chart-card anim-1">
            <mat-card-header><mat-card-title>PO Status Distribution</mat-card-title></mat-card-header>
            <mat-card-content style="padding-top:12px!important;">
              <div class="donut-wrap">
                <svg viewBox="0 0 120 120" style="width:130px;height:130px;flex-shrink:0;">
                  <circle cx="60" cy="60" r="46" fill="none" stroke="#f1f5f9" stroke-width="14"/>
                  @for (seg of poDonutSegments(); track seg.status) {
                    @if (seg.count > 0) {
                      <circle cx="60" cy="60" r="46" fill="none" stroke-width="14"
                        [attr.stroke]="seg.color"
                        [attr.stroke-dasharray]="seg.dash + ' ' + seg.gap"
                        [attr.stroke-dashoffset]="seg.offset" />
                    }
                  }
                  <text x="60" y="56" text-anchor="middle"
                        style="font-size:17px;font-weight:800;fill:#1e293b;">{{ totalPos() }}</text>
                  <text x="60" y="70" text-anchor="middle"
                        style="font-size:8px;font-weight:600;fill:#94a3b8;letter-spacing:0.5px;">TOTAL POs</text>
                </svg>
                <div class="donut-legend">
                  @for (seg of poDonutSegments(); track seg.status) {
                    @if (seg.count > 0) {
                      <div class="d-legend-row">
                        <span class="d-legend-dot" [style.background]="seg.color"></span>
                        <span class="d-legend-label">{{ seg.label }}</span>
                        <span class="d-legend-count">{{ seg.count }}</span>
                      </div>
                    }
                  }
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- PR Pipeline Funnel -->
          <mat-card class="chart-card anim-2">
            <mat-card-header><mat-card-title>PR Pipeline</mat-card-title></mat-card-header>
            <mat-card-content style="padding-top:12px!important;">
              <div class="pipeline-wrap">
                @for (stage of prPipelineStages(); track stage.label) {
                  <div class="pipeline-stage">
                    <div class="ps-header">
                      <span class="ps-label">{{ stage.label }}</span>
                      <span class="ps-count" [style.color]="stage.color">{{ stage.count }}</span>
                    </div>
                    <div class="ps-track">
                      <div class="ps-fill"
                           [style.width]="stage.pct + '%'"
                           [style.background]="stage.color"></div>
                    </div>
                  </div>
                }
                <div class="ps-total-row">
                  <span>Total Requisitions</span>
                  <strong>{{ totalPrs() }}</strong>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

        </div>

        <!-- ── PR Section header ──────────────────────────── -->
        <div class="section-divider">
          <mat-icon style="color:#7c3aed;">description</mat-icon>
          <span>Purchase Requisitions</span>
          <button mat-button color="primary" routerLink="/purchase-requisitions" class="view-all-btn">
            View all <mat-icon style="font-size:14px;vertical-align:middle;">arrow_forward</mat-icon>
          </button>
        </div>

        <!-- ── PR Stat cards ───────────────────────────────── -->
        <div class="stat-grid" style="margin-bottom:24px;">

          <div class="stat-card">
            <div class="stat-card-body">
              <div class="stat-label">Total PRs</div>
              <div class="stat-value">{{ totalPrs() }}</div>
              <div class="stat-trend">
                <span class="trend-dot" style="background:#7c3aed;"></span>
                All requisitions
              </div>
            </div>
            <div class="stat-card-icon" style="background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);">
              <mat-icon>description</mat-icon>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card-body">
              <div class="stat-label">Submitted</div>
              <div class="stat-value" [style.color]="submittedPrs() > 0 ? '#d97706' : 'var(--text-1)'">
                {{ submittedPrs() }}
              </div>
              <div class="stat-trend">
                <span class="trend-dot" style="background:#d97706;"></span>
                Awaiting procurement action
              </div>
            </div>
            <div class="stat-card-icon" style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);">
              <mat-icon>send</mat-icon>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card-body">
              <div class="stat-label">In RFQ Process</div>
              <div class="stat-value" style="color:#2563eb;">{{ inRfqPrs() }}</div>
              <div class="stat-trend">
                <span class="trend-dot" style="background:#2563eb;"></span>
                RFQ created / approved
              </div>
            </div>
            <div class="stat-card-icon" style="background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);">
              <mat-icon>request_quote</mat-icon>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card-body">
              <div class="stat-label">Converted to PO</div>
              <div class="stat-value" style="color:#16a34a;">{{ convertedPrs() }}</div>
              <div class="stat-trend">
                <span class="trend-dot" style="background:#16a34a;"></span>
                Successfully processed
              </div>
            </div>
            <div class="stat-card-icon" style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);">
              <mat-icon>transform</mat-icon>
            </div>
          </div>

        </div>

        <!-- ── Recent PRs table ────────────────────────────── -->
        <mat-card class="table-card recent-card" style="margin-bottom:24px;">
          <mat-card-header style="padding:20px 20px 0;">
            <mat-card-title>Recent Purchase Requisitions</mat-card-title>
            <div style="flex:1"></div>
            <button mat-button color="primary" routerLink="/purchase-requisitions" class="view-all-btn">
              View all <mat-icon style="font-size:14px;vertical-align:middle;">arrow_forward</mat-icon>
            </button>
          </mat-card-header>
          <mat-card-content style="padding:0 !important;">
            @if (!stats()!.recent_prs?.length) {
              <div class="empty-state">
                <mat-icon>description</mat-icon>
                <p>No requisitions yet.</p>
                <button mat-stroked-button routerLink="/purchase-requisitions/create">Create first PR</button>
              </div>
            } @else {
              <div class="table-responsive">
                <table mat-table [dataSource]="stats()!.recent_prs" class="full-width">
                <ng-container matColumnDef="pr_number">
                  <th mat-header-cell *matHeaderCellDef>PR Number</th>
                  <td mat-cell *matCellDef="let pr">
                    <a (click)="router.navigate(['/purchase-requisitions', pr.id])" class="po-link">
                      {{ pr.pr_number ?? 'Draft' }}
                    </a>
                  </td>
                </ng-container>
                <ng-container matColumnDef="pr_title">
                  <th mat-header-cell *matHeaderCellDef>Title</th>
                  <td mat-cell *matCellDef="let pr" style="font-size:13px;color:var(--text-2);">{{ pr.title }}</td>
                </ng-container>
                <ng-container matColumnDef="pr_cost_center">
                  <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                  <td mat-cell *matCellDef="let pr" style="font-size:12px;color:var(--text-3);">{{ pr.cost_center?.name ?? '—' }}</td>
                </ng-container>
                <ng-container matColumnDef="pr_amount">
                  <th mat-header-cell *matHeaderCellDef>Est. Amount</th>
                  <td mat-cell *matCellDef="let pr"><strong>₹{{ (pr.estimated_amount ?? 0) | number:'1.0-0' }}</strong></td>
                </ng-container>
                <ng-container matColumnDef="pr_date">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let pr" style="color:var(--text-3);font-size:12px;">{{ pr.created_at | date:'dd MMM yy' }}</td>
                </ng-container>
                <ng-container matColumnDef="pr_status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let pr">
                    <span [class]="'status-pill status-' + pr.status">{{ formatStatus(pr.status) }}</span>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="recentPrCols"></tr>
                <tr mat-row *matRowDef="let row; columns: recentPrCols;" class="clickable-row"
                    (click)="router.navigate(['/purchase-requisitions', row.id])"></tr>
                </table>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- ── Main grid (recent POs + right col) ─────────── -->
        <div class="dashboard-grid">

          <mat-card class="table-card recent-card anim-5">
            <mat-card-header style="padding:20px 20px 0;">
              <mat-card-title>Recent Purchase Orders</mat-card-title>
              <div style="flex:1"></div>
              <button mat-button color="primary" routerLink="/purchase-orders" class="view-all-btn">
                View all <mat-icon style="font-size:14px;vertical-align:middle;">arrow_forward</mat-icon>
              </button>
            </mat-card-header>
            <mat-card-content style="padding:0 !important;">
              @if (stats()!.recent_pos.length === 0) {
                <div class="empty-state">
                  <mat-icon>receipt_long</mat-icon>
                  <p>No purchase orders yet.</p>
                  <button mat-stroked-button routerLink="/purchase-orders/create">Create first PO</button>
                </div>
              } @else {
                <div class="table-responsive">
                  <table mat-table [dataSource]="stats()!.recent_pos" class="full-width">
                  <ng-container matColumnDef="po_number">
                    <th mat-header-cell *matHeaderCellDef>PO Number</th>
                    <td mat-cell *matCellDef="let po">
                      <a (click)="router.navigate(['/purchase-orders', po.id])" class="po-link">
                        {{ po.po_number ?? 'Draft' }}
                      </a>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="vendor">
                    <th mat-header-cell *matHeaderCellDef>Vendor</th>
                    <td mat-cell *matCellDef="let po">
                      <div class="vendor-cell">
                        <div class="vendor-avatar">{{ po.vendor?.name?.[0] }}</div>
                        {{ po.vendor?.name }}
                      </div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="grand_total">
                    <th mat-header-cell *matHeaderCellDef>Amount</th>
                    <td mat-cell *matCellDef="let po"><strong>₹{{ po.grand_total | number:'1.0-0' }}</strong></td>
                  </ng-container>
                  <ng-container matColumnDef="created_at">
                    <th mat-header-cell *matHeaderCellDef>Date</th>
                    <td mat-cell *matCellDef="let po" style="color:var(--text-3);">{{ po.created_at | date:'dd MMM yy' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let po">
                      <span [class]="'status-pill status-' + po.status">{{ formatStatus(po.status) }}</span>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="recentCols"></tr>
                  <tr mat-row *matRowDef="let row; columns: recentCols;" class="clickable-row"
                      (click)="router.navigate(['/purchase-orders', row.id])"></tr>
                  </table>
                </div>
              }
            </mat-card-content>
          </mat-card>

          <div class="right-col anim-6">
            <mat-card class="budget-card">
              <mat-card-header>
                <mat-card-title>Budget Utilisation</mat-card-title>
                <div style="flex:1"></div>
                <button mat-button color="primary" routerLink="/cost-centers" class="view-all-btn">Manage</button>
              </mat-card-header>
              <mat-card-content style="padding-top:12px;">
                @if (stats()!.budget_summary.length === 0) {
                  <div class="empty-state-sm">
                    <mat-icon>account_balance_wallet</mat-icon>
                    <span>No cost centers configured.</span>
                  </div>
                }
                @for (b of stats()!.budget_summary; track b.id) {
                  @let used = b.annual > 0 ? ((b.consumed + b.frozen) / b.annual * 100) : 0;
                  <div class="budget-row" (click)="router.navigate(['/cost-centers', b.id])">
                    <div class="budget-header">
                      <span class="budget-name">{{ b.name }}</span>
                      <span class="budget-pct" [class.over-budget]="used > 90">{{ used | number:'1.0-0' }}%</span>
                    </div>
                    <mat-progress-bar mode="determinate" [value]="used" [color]="used > 90 ? 'warn' : 'primary'" />
                    <div class="budget-footer">
                      <span class="budget-available">₹{{ b.available | number:'1.0-0' }} available</span>
                      <span class="budget-total">of ₹{{ b.annual | number:'1.0-0' }}</span>
                    </div>
                  </div>
                }
              </mat-card-content>
            </mat-card>

            <mat-card class="status-card">
              <mat-card-header><mat-card-title>PO Status Overview</mat-card-title></mat-card-header>
              <mat-card-content style="padding-top:12px;">
                <div class="status-grid">
                  @for (entry of statusEntries(); track entry.status) {
                    @if (entry.count > 0) {
                      <div class="status-item" [class]="'status-item--' + entry.status">
                        <div class="status-count">{{ entry.count }}</div>
                        <div class="status-name">{{ formatStatus(entry.status) }}</div>
                      </div>
                    }
                  }
                </div>
              </mat-card-content>
            </mat-card>
          </div>

        </div>

        <!-- ══════════════════════════════════════════════════════
             KPI / TAT TABLE
             ══════════════════════════════════════════════════════ -->
        @if (stats()!.po_kpi?.length) {
        <mat-card class="kpi-card">
          <mat-card-header style="padding:20px 20px 0;">
            <mat-card-title>
              <mat-icon style="vertical-align:middle;margin-right:6px;color:var(--brand);">analytics</mat-icon>
              PO Performance &amp; TAT
            </mat-card-title>
            <div style="flex:1"></div>
            <div class="kpi-legend">
              <span class="legend-dot" style="background:#16a34a;"></span> Released
              <span class="legend-dot" style="background:#2563eb;margin-left:10px;"></span> Approved
              <span class="legend-dot" style="background:#f59e0b;margin-left:10px;"></span> Pending
              <span class="legend-dot" style="background:#94a3b8;margin-left:10px;"></span> Draft
            </div>
          </mat-card-header>
          <mat-card-content style="padding:0 !important;">

            <!-- PO-level KPI table -->
            <div class="table-responsive">
              <table mat-table [dataSource]="stats()!.po_kpi" class="kpi-table full-width"
                     multiTemplateDataRows>

              <!-- Expand toggle -->
              <ng-container matColumnDef="expand">
                <th mat-header-cell *matHeaderCellDef style="width:40px;"></th>
                <td mat-cell *matCellDef="let po" style="width:40px;">
                  <button mat-icon-button style="width:28px;height:28px;"
                          (click)="toggleKpi(po); $event.stopPropagation()"
                          [matTooltip]="expandedKpi() === po.id ? 'Collapse items' : 'Expand items'">
                    <mat-icon style="font-size:16px;color:var(--text-3);">
                      {{ expandedKpi() === po.id ? 'expand_less' : 'expand_more' }}
                    </mat-icon>
                  </button>
                </td>
              </ng-container>

              <!-- PO Number -->
              <ng-container matColumnDef="po_number">
                <th mat-header-cell *matHeaderCellDef>PO Number</th>
                <td mat-cell *matCellDef="let po">
                  <a class="po-link" (click)="router.navigate(['/purchase-orders', po.id]);$event.stopPropagation()">
                    {{ po.po_number ?? 'Draft' }}
                  </a>
                </td>
              </ng-container>

              <!-- Vendor -->
              <ng-container matColumnDef="vendor">
                <th mat-header-cell *matHeaderCellDef>Vendor</th>
                <td mat-cell *matCellDef="let po">
                  <div class="vendor-cell">
                    <div class="vendor-avatar">{{ po.vendor?.[0] }}</div>
                    <span style="font-size:12px;">{{ po.vendor ?? '—' }}</span>
                  </div>
                </td>
              </ng-container>

              <!-- Cost Center -->
              <ng-container matColumnDef="cost_center">
                <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                <td mat-cell *matCellDef="let po" style="font-size:12px;color:var(--text-2);">{{ po.cost_center ?? '—' }}</td>
              </ng-container>

              <!-- Status -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let po">
                  <span [class]="'status-pill status-' + po.status">{{ formatStatus(po.status) }}</span>
                </td>
              </ng-container>

              <!-- Items count -->
              <ng-container matColumnDef="items_count">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">Items</th>
                <td mat-cell *matCellDef="let po" style="text-align:center;">
                  <span class="items-badge">{{ po.items_count }}</span>
                </td>
              </ng-container>

              <!-- Amount -->
              <ng-container matColumnDef="grand_total">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Amount</th>
                <td mat-cell *matCellDef="let po" style="text-align:right;">
                  <strong style="font-size:12px;">₹{{ po.grand_total | number:'1.0-0' }}</strong>
                </td>
              </ng-container>

              <!-- Created -->
              <ng-container matColumnDef="created_at">
                <th mat-header-cell *matHeaderCellDef>Created</th>
                <td mat-cell *matCellDef="let po" style="font-size:12px;color:var(--text-3);">
                  {{ po.created_at | date:'dd MMM yy' }}
                </td>
              </ng-container>

              <!-- Days to approve -->
              <ng-container matColumnDef="days_to_approve">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">
                  <span matTooltip="Days from creation to approval">Approve TAT</span>
                </th>
                <td mat-cell *matCellDef="let po" style="text-align:center;">
                  @if (po.days_to_approve !== null) {
                    <span [class]="tatClass(po.days_to_approve)">{{ po.days_to_approve }}d</span>
                  } @else {
                    <span class="tat-na">—</span>
                  }
                </td>
              </ng-container>

              <!-- Days to release -->
              <ng-container matColumnDef="days_to_release">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">
                  <span matTooltip="Days from approval to release">Release TAT</span>
                </th>
                <td mat-cell *matCellDef="let po" style="text-align:center;">
                  @if (po.days_to_release !== null) {
                    <span [class]="tatClass(po.days_to_release)">{{ po.days_to_release }}d</span>
                  } @else {
                    <span class="tat-na">—</span>
                  }
                </td>
              </ng-container>

              <!-- Total cycle -->
              <ng-container matColumnDef="total_cycle">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">
                  <span matTooltip="Total days from creation to release">Total Cycle</span>
                </th>
                <td mat-cell *matCellDef="let po" style="text-align:center;">
                  @if (po.total_cycle_days !== null) {
                    <span [class]="tatClass(po.total_cycle_days)" style="font-weight:700;">{{ po.total_cycle_days }}d</span>
                  } @else {
                    <span class="tat-pending">In Progress</span>
                  }
                </td>
              </ng-container>

              <!-- ── Expanded items row ─────────────────────── -->
              <ng-container matColumnDef="expandedDetail">
                <td mat-cell *matCellDef="let po"
                    [attr.colspan]="kpiCols.length"
                    style="padding:0;">
                  <div [@expandCollapse]="expandedKpi() === po.id ? 'expanded' : 'collapsed'"
                       class="item-detail-wrap">
                    @if (po.items?.length) {
                      <table class="item-detail-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Item Description</th>
                            <th>Code</th>
                            <th>UOM</th>
                            <th style="text-align:right;">Qty</th>
                            <th style="text-align:right;">Unit Price</th>
                            <th style="text-align:right;">GST %</th>
                            <th style="text-align:right;">Net Amount</th>
                            <th>Required By</th>
                            <th>Warranty</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of po.items; track item.sno) {
                            <tr [class.overdue-row]="isOverdue(item.required_by)">
                              <td style="color:#94a3b8;text-align:center;">{{ item.sno }}</td>
                              <td><strong>{{ item.description }}</strong></td>
                              <td style="color:#64748b;font-size:11px;">{{ item.code ?? '—' }}</td>
                              <td style="color:#64748b;">{{ item.uom ?? '—' }}</td>
                              <td style="text-align:right;">{{ item.qty | number:'1.0-3' }}</td>
                              <td style="text-align:right;">₹{{ item.net_rate | number:'1.2-2' }}</td>
                              <td style="text-align:right;color:#64748b;">{{ item.gst_rate }}%</td>
                              <td style="text-align:right;font-weight:700;">₹{{ item.amount | number:'1.2-2' }}</td>
                              <td>
                                @if (item.required_by) {
                                  <span [class]="isOverdue(item.required_by) ? 'req-overdue' : 'req-ok'">
                                    {{ item.required_by | date:'dd MMM yy' }}
                                    @if (isOverdue(item.required_by)) { <mat-icon style="font-size:12px;vertical-align:middle;">warning</mat-icon> }
                                  </span>
                                } @else { <span style="color:#cbd5e1;">—</span> }
                              </td>
                              <td style="color:#64748b;">
                                {{ item.warranty_months > 0 ? item.warranty_months + ' mo' : '—' }}
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    } @else {
                      <div style="padding:16px 24px;font-size:12px;color:#94a3b8;">No items found.</div>
                    }
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="kpiCols"></tr>
              <tr mat-row *matRowDef="let row; columns: kpiCols;" class="kpi-row"
                  (click)="router.navigate(['/purchase-orders', row.id])"></tr>
              <tr mat-row *matRowDef="let row; columns: ['expandedDetail']" class="detail-row"></tr>

            </table>
          </div>
        </mat-card-content>
        </mat-card>
        }

        <!-- ══════════════════════════════════════════════════════
             PR PIPELINE & TAT TABLE
             ══════════════════════════════════════════════════════ -->
        @if (stats()!.pr_kpi?.length) {
        <mat-card class="kpi-card" style="margin-top:20px;">
          <mat-card-header style="padding:20px 20px 0;">
            <mat-card-title>
              <mat-icon style="vertical-align:middle;margin-right:6px;color:#7c3aed;">analytics</mat-icon>
              PR Pipeline &amp; TAT
            </mat-card-title>
            <div style="flex:1"></div>
            <div class="kpi-legend">
              <span class="legend-dot" style="background:#16a34a;"></span> Converted
              <span class="legend-dot" style="background:#059669;margin-left:10px;"></span> RFQ Approved
              <span class="legend-dot" style="background:#2563eb;margin-left:10px;"></span> RFQ Created
              <span class="legend-dot" style="background:#f59e0b;margin-left:10px;"></span> Submitted
              <span class="legend-dot" style="background:#94a3b8;margin-left:10px;"></span> Draft
            </div>
          </mat-card-header>
          <mat-card-content style="padding:0 !important;">
            <div class="table-responsive">
              <table mat-table [dataSource]="stats()!.pr_kpi" class="kpi-table full-width">

              <!-- PR Number -->
              <ng-container matColumnDef="pr_kpi_number">
                <th mat-header-cell *matHeaderCellDef>PR Number</th>
                <td mat-cell *matCellDef="let pr">
                  <a class="po-link" (click)="router.navigate(['/purchase-requisitions', pr.id]);$event.stopPropagation()">
                    {{ pr.pr_number ?? 'Draft' }}
                  </a>
                </td>
              </ng-container>

              <!-- Title -->
              <ng-container matColumnDef="pr_kpi_title">
                <th mat-header-cell *matHeaderCellDef>Title</th>
                <td mat-cell *matCellDef="let pr" class="pr-title-cell">{{ pr.title }}</td>
              </ng-container>

              <!-- Cost Center -->
              <ng-container matColumnDef="pr_kpi_cc">
                <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                <td mat-cell *matCellDef="let pr" style="font-size:12px;color:var(--text-2);">{{ pr.cost_center ?? '—' }}</td>
              </ng-container>

              <!-- Status -->
              <ng-container matColumnDef="pr_kpi_status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let pr">
                  <span [class]="'status-pill status-' + pr.status">{{ formatStatus(pr.status) }}</span>
                </td>
              </ng-container>

              <!-- Est. Value -->
              <ng-container matColumnDef="pr_kpi_amount">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Est. Value</th>
                <td mat-cell *matCellDef="let pr" style="text-align:right;">
                  <strong style="font-size:12px;">₹{{ (pr.estimated_amount ?? 0) | number:'1.0-0' }}</strong>
                </td>
              </ng-container>

              <!-- Created -->
              <ng-container matColumnDef="pr_kpi_date">
                <th mat-header-cell *matHeaderCellDef>Created</th>
                <td mat-cell *matCellDef="let pr" style="font-size:12px;color:var(--text-3);">
                  {{ pr.created_at | date:'dd MMM yy' }}
                </td>
              </ng-container>

              <!-- Submit TAT -->
              <ng-container matColumnDef="pr_days_submit">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">
                  <span matTooltip="Days from creation to submission">Submit TAT</span>
                </th>
                <td mat-cell *matCellDef="let pr" style="text-align:center;">
                  @if (pr.days_to_submit !== null) {
                    <span [class]="tatClass(pr.days_to_submit)">{{ pr.days_to_submit }}d</span>
                  } @else { <span class="tat-na">—</span> }
                </td>
              </ng-container>

              <!-- RFQ Create TAT -->
              <ng-container matColumnDef="pr_days_rfq">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">
                  <span matTooltip="Days from submission to RFQ creation">RFQ Create TAT</span>
                </th>
                <td mat-cell *matCellDef="let pr" style="text-align:center;">
                  @if (pr.days_rfq_create !== null) {
                    <span [class]="tatClass(pr.days_rfq_create)">{{ pr.days_rfq_create }}d</span>
                  } @else { <span class="tat-na">—</span> }
                </td>
              </ng-container>

              <!-- RFQ Approve TAT -->
              <ng-container matColumnDef="pr_days_approve">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">
                  <span matTooltip="Days from RFQ created to RFQ approved">RFQ Approve TAT</span>
                </th>
                <td mat-cell *matCellDef="let pr" style="text-align:center;">
                  @if (pr.days_rfq_approve !== null) {
                    <span [class]="tatClass(pr.days_rfq_approve)">{{ pr.days_rfq_approve }}d</span>
                  } @else { <span class="tat-na">—</span> }
                </td>
              </ng-container>

              <!-- Total Cycle -->
              <ng-container matColumnDef="pr_total_cycle">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">
                  <span matTooltip="Total days from PR creation to PO conversion">Total Cycle</span>
                </th>
                <td mat-cell *matCellDef="let pr" style="text-align:center;">
                  @if (pr.total_cycle_days !== null) {
                    <span [class]="tatClass(pr.total_cycle_days)" style="font-weight:700;">{{ pr.total_cycle_days }}d</span>
                  } @else {
                    <span class="tat-pending">In Progress</span>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="prKpiCols"></tr>
              <tr mat-row *matRowDef="let row; columns: prKpiCols;" class="kpi-row"
                  (click)="router.navigate(['/purchase-requisitions', row.id])"></tr>
              </table>
            </div>
          </mat-card-content>
        </mat-card>
        }

      } @else {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <p>Unable to load dashboard data.</p>
          <button mat-stroked-button (click)="reload()">Try again</button>
        </div>
      }

    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; }
    .page-header h2 { margin:0; font-size:22px; font-weight:800; color:var(--text-1); letter-spacing:-.3px; }
    .page-header p  { margin:4px 0 0; font-size:13px; color:var(--text-3); }
    .cta-btn { height:42px !important; font-size:13px !important; gap:4px; padding:0 18px !important; }

    .loading-state { display:flex; flex-direction:column; align-items:center; gap:16px; padding:80px; color:var(--text-3); }

    /* ── Stat grid — Purity UI style: value left, icon right ── */
    .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; margin-bottom:24px; }
    .stat-card {
      background:#ffffff;
      border:1px solid var(--border);
      border-radius:16px;
      padding:22px 20px;
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      box-shadow: 0 2px 12px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04);
      position:relative;
      overflow:hidden;
      transition:box-shadow .22s ease, transform .22s ease;
    }
    .stat-card::before {
      content:'';
      position:absolute;
      bottom:0; left:0; right:0;
      height:3px;
      background:linear-gradient(90deg, var(--brand), var(--brand-hover));
      opacity:0;
      transition:opacity .22s ease;
      border-radius:0 0 16px 16px;
    }
    .stat-card:hover {
      box-shadow: 0 8px 24px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.06);
      transform:translateY(-2px);
    }
    .stat-card:hover::before { opacity:1; }
    .stat-card.clickable { cursor:pointer; }
    .stat-card-body { flex:1; min-width:0; }
    .stat-label { font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.07em; margin-bottom:8px; }
    .stat-value { font-size:30px; font-weight:800; color:var(--text-1); line-height:1; letter-spacing:-.5px; margin-bottom:10px; }
    .stat-trend { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-3); }
    .trend-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
    .trend-badge { padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; }
    .trend-badge.warn { background:#fff7ed; color:#ea580c; }
    .trend-badge.ok   { background:#f0fdf4; color:#16a34a; }
    .stat-card-icon {
      width:50px;
      height:50px;
      border-radius:14px;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      box-shadow:0 4px 14px rgba(0,0,0,.18);
      transition:transform .22s ease;
    }
    .stat-card:hover .stat-card-icon { transform:scale(1.06); }
    .stat-card-icon mat-icon { color:white; font-size:22px; width:22px; height:22px; }

    /* ── Dashboard grid ── */
    .dashboard-grid { display:grid; grid-template-columns:1fr 340px; gap:20px; margin-bottom:24px; }
    .table-card mat-card-content { padding:0 !important; }
    .full-width { width:100%; }

    /* Status pills */
    .status-pill { display:inline-block; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; }
    .status-draft     { background:#f1f5f9; color:#475569; }
    .status-approved  { background:#dcfce7; color:#15803d; }
    .status-released  { background:#dbeafe; color:#1d4ed8; }
    .status-rejected  { background:#fee2e2; color:#b91c1c; }
    .status-pending_l1,.status-pending_l2,.status-pending_l3 { background:#fff7ed; color:#c2410c; }
    .status-delivered         { background:#ecfdf5; color:#065f46; }
    .status-invoiced          { background:#fef9c3; color:#92400e; }
    .status-payment_released  { background:#eef2ff; color:#3730a3; }
    .status-closed    { background:#f1f5f9; color:#475569; }
    .status-cancelled { background:#fef2f2; color:#b91c1c; }

    .po-link { color:var(--brand); cursor:pointer; font-weight:600; font-size:13px; }
    .po-link:hover { text-decoration:underline; }
    .vendor-cell { display:flex; align-items:center; gap:8px; font-size:13px; }
    .vendor-avatar { width:28px; height:28px; border-radius:8px; background:var(--brand-light); color:var(--brand); font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .view-all-btn { font-size:12px !important; font-weight:600 !important; }
    .clickable-row { cursor:pointer; transition:background .12s; }

    .empty-state { display:flex; flex-direction:column; align-items:center; gap:8px; padding:48px; color:var(--text-3); }
    .empty-state mat-icon { font-size:40px; width:40px; height:40px; opacity:.4; }
    .empty-state p { margin:0; font-size:13px; }

    .right-col { display:flex; flex-direction:column; gap:20px; }
    .budget-row { padding:12px 0; border-bottom:1px solid var(--border); cursor:pointer; transition:background .12s; }
    .budget-row:last-child { border-bottom:none; }
    .budget-row:hover { background:#f8faff; border-radius:8px; padding-left:6px; }
    .budget-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; }
    .budget-name { font-size:13px; font-weight:600; color:var(--text-1); }
    .budget-pct  { font-size:12px; font-weight:700; color:var(--text-2); }
    .budget-pct.over-budget { color:#dc2626; }
    .budget-footer { display:flex; justify-content:space-between; margin-top:6px; }
    .budget-available,.budget-total { font-size:11px; color:var(--text-3); }
    .empty-state-sm { display:flex; align-items:center; gap:8px; color:var(--text-3); font-size:13px; padding:16px 0; }

    .status-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
    .status-item { padding:14px; border-radius:12px; border:1px solid var(--border); text-align:center; transition:transform .15s ease; cursor:default; }
    .status-item:hover { transform:translateY(-1px); }
    .status-count { font-size:24px; font-weight:800; color:var(--text-1); }
    .status-name  { font-size:11px; color:var(--text-3); font-weight:600; margin-top:3px; text-transform:capitalize; }
    .status-item--approved  { background:#f0fdf4; border-color:#bbf7d0; }
    .status-item--approved .status-count { color:#16a34a; }
    .status-item--released  { background:#eff6ff; border-color:#bfdbfe; }
    .status-item--released .status-count { color:#2563eb; }
    .status-item--draft     { background:#f8fafc; }
    .status-item--pending_l1,.status-item--pending_l2,.status-item--pending_l3
                            { background:#fff7ed; border-color:#fed7aa; }
    .status-item--pending_l1 .status-count,
    .status-item--pending_l2 .status-count,
    .status-item--pending_l3 .status-count { color:#ea580c; }
    .status-item--rejected  { background:#fff1f2; border-color:#fecdd3; }
    .status-item--rejected .status-count { color:#e11d48; }
    .status-item--delivered { background:#ecfdf5; border-color:#a7f3d0; }
    .status-item--delivered .status-count { color:#065f46; }
    .status-item--invoiced  { background:#fef9c3; border-color:#fde68a; }
    .status-item--invoiced .status-count  { color:#92400e; }
    .status-item--payment_released { background:#eef2ff; border-color:#c7d2fe; }
    .status-item--payment_released .status-count { color:#3730a3; }
    .status-item--closed    { background:#f8fafc; }
    .status-item--cancelled { background:#fff1f2; border-color:#fecdd3; }
    .status-item--cancelled .status-count { color:#e11d48; }

    /* ── KPI / TAT card ── */
    .kpi-card { border-radius:16px !important; margin-top:4px; }
    .kpi-table { width:100%; }
    .kpi-row { cursor:pointer; transition:background .12s; }
    .kpi-row:hover td { background:#f8faff !important; }
    .detail-row { height:0; }
    .detail-row td { padding:0 !important; border:none !important; }

    /* KPI legend */
    .kpi-legend { display:flex; align-items:center; font-size:11px; color:var(--text-3); gap:4px; }
    .legend-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }

    /* Items badge */
    .items-badge { background:#eff6ff; color:#1565c0; font-size:11px; font-weight:700; padding:2px 8px; border-radius:99px; }

    /* TAT colour classes */
    .tat-ok      { color:#15803d; font-weight:700; font-size:12px; background:#f0fdf4; padding:2px 7px; border-radius:99px; }
    .tat-warn    { color:#d97706; font-weight:700; font-size:12px; background:#fefce8; padding:2px 7px; border-radius:99px; }
    .tat-bad     { color:#dc2626; font-weight:700; font-size:12px; background:#fff1f2; padding:2px 7px; border-radius:99px; }
    .tat-na      { color:#cbd5e1; font-size:12px; }
    .tat-pending { background:#fff7ed; color:#c2410c; font-size:11px; font-weight:600; padding:2px 8px; border-radius:99px; }

    /* Expanded item detail */
    .item-detail-wrap {
      overflow: hidden;
      background: #f8faff;
      border-left: 3px solid var(--brand);
    }
    .item-detail-table { width:100%; border-collapse:collapse; font-size:12px; }
    .item-detail-table thead tr { background:#eef2ff; }
    .item-detail-table th {
      padding:8px 14px;
      font-size:10px;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:.5px;
      color:#475569;
      border-bottom:1px solid #dbeafe;
      text-align:left;
      white-space:nowrap;
    }
    .item-detail-table td { padding:8px 14px; border-bottom:1px solid #e2e8f0; color:#334155; vertical-align:middle; }
    .item-detail-table tbody tr:last-child td { border-bottom:none; }
    .item-detail-table tbody tr:hover td { background:#eff6ff; }
    .overdue-row td { background:#fff7ed !important; }
    .req-ok      { color:#15803d; font-weight:600; font-size:11px; }
    .req-overdue { color:#dc2626; font-weight:700; font-size:11px; display:flex; align-items:center; gap:3px; }

    /* ── Charts row ── */
    .charts-row { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
    @media (max-width:900px) { .charts-row { grid-template-columns:1fr; } }
    .chart-card { border-radius:16px !important; }
    /* Donut chart */
    .donut-wrap { display:flex; align-items:center; gap:20px; }
    .donut-legend { flex:1; display:flex; flex-direction:column; gap:7px; }
    .d-legend-row { display:flex; align-items:center; gap:7px; font-size:12px; }
    .d-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .d-legend-label { flex:1; color:var(--text-2); }
    .d-legend-count { font-weight:700; color:var(--text-1); min-width:20px; text-align:right; }
    /* Pipeline funnel */
    .pipeline-wrap { display:flex; flex-direction:column; gap:12px; }
    .pipeline-stage { display:flex; flex-direction:column; gap:4px; }
    .ps-header { display:flex; justify-content:space-between; align-items:center; }
    .ps-label { font-size:12px; color:var(--text-2); font-weight:500; }
    .ps-count { font-size:13px; font-weight:700; }
    .ps-track { height:9px; background:#f1f5f9; border-radius:99px; overflow:hidden; }
    .ps-fill { height:100%; border-radius:99px; transition:width .5s cubic-bezier(.4,0,.2,1); }
    .ps-total-row { display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border); font-size:13px; color:var(--text-2); }
    .ps-total-row strong { font-size:15px; color:var(--text-1); }

    /* ── PR Section divider ── */
    .section-divider {
      display:flex; align-items:center; gap:8px;
      margin:28px 0 16px; padding-bottom:12px;
      border-bottom:1px solid var(--border);
    }
    .section-divider span { font-size:15px; font-weight:700; color:var(--text-1); flex:1; }

    /* PR status pills */
    .status-submitted    { background:#fffbeb; color:#d97706; }
    .status-rfq_created  { background:#eff6ff; color:#2563eb; }
    .status-rfq_approved { background:#ecfdf5; color:#059669; }
    .status-converted    { background:#f0fdf4; color:#15803d; }
    .status-rejected     { background:#fee2e2; color:#b91c1c; }

    /* PR title truncation in KPI table */
    .pr-title-cell { font-size:12px; color:var(--text-2); max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* Error state */
    .error-state { display:flex; flex-direction:column; align-items:center; gap:12px; padding:80px; color:var(--text-3); }
    .error-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.4; }

    /* ── Filter Toolbar ── */
    .filter-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      background: white; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 10px 16px; margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .period-pills { display: flex; gap: 6px; flex-wrap: wrap; }
    .pill-btn {
      background: #f1f5f9; border: none; padding: 6px 14px; border-radius: 99px;
      font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;
      transition: all 0.15s ease;
    }
    .pill-btn:hover { background: #e2e8f0; color: #0f172a; }
    .pill-btn.active { background: #2563eb; color: white; }

    .custom-date-inputs { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .date-input-group { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; font-weight: 500; }
    .date-picker-input {
      border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px;
      font-size: 12px; color: #0f172a; outline: none;
    }

    /* ── TAT Summary Card ── */
    .tat-summary-card {
      border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;
      margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .tat-card-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
    .tat-pipeline { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 4px; flex-wrap: wrap; }
    .tat-step {
      flex: 1; min-width: 140px; background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;
    }
    .tat-step--total { background: #f0fdf4; border-color: #bbf7d0; }
    .tat-step-num {
      width: 28px; height: 28px; border-radius: 50%; background: #e2e8f0; color: #475569;
      font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .tat-step--total .tat-step-num { background: #16a34a; color: white; }
    .tat-step-num mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .tat-step-info { display: flex; flex-direction: column; }
    .tat-step-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .tat-step-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 1px; }
    .tat-step-sub { font-size: 10px; color: #94a3b8; margin-top: 1px; }
    .tat-arrow { color: #cbd5e1; display: flex; align-items: center; }

    /* Table responsive wrapper */
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .table-responsive table {
      min-width: 800px;
    }
    .kpi-table {
      min-width: 1100px !important;
    }

    /* ── Mobile responsiveness ── */
    @media (max-width: 992px) {
      .stat-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      .dashboard-grid {
        grid-template-columns: 1fr !important;
      }
      .page-wrapper {
        padding: 16px !important;
      }
      .filter-toolbar {
        flex-direction: column;
        align-items: stretch !important;
        padding: 12px !important;
      }
      .period-pills {
        justify-content: center;
      }
      .custom-date-inputs {
        justify-content: center;
      }
    }

    @media (max-width: 576px) {
      .stat-grid {
        grid-template-columns: 1fr !important;
      }
      .page-header {
        flex-direction: column;
        gap: 12px;
        align-items: stretch !important;
      }
      .cta-btn {
        width: 100%;
      }
    }
  `],
})
export class DashboardComponent {
  auth    = inject(AuthService);
  router  = inject(Router);
  private http = inject(HttpClient);

  constructor() {
    // Load on creation AND whenever the active organization changes. Using an
    // effect (instead of ngOnInit) means an org switch performed while already
    // on the dashboard — where router navigation is a no-op — still refetches
    // tenant-scoped data. The tenant interceptor reads currentTenantId() live,
    // so the request carries the new X-Tenant-ID.
    effect(() => {
      this.auth.currentTenantId();   // track the active org
      this.reload();
    });
  }

  stats        = signal<DashboardStats | null>(null);
  loading      = signal(true);
  expandedKpi  = signal<number | null>(null);
  expandedPrKpi = signal<number | null>(null);

  recentCols   = ['po_number', 'vendor', 'grand_total', 'created_at', 'status'];
  kpiCols      = ['expand', 'po_number', 'vendor', 'cost_center', 'status',
                  'items_count', 'grand_total', 'created_at',
                  'days_to_approve', 'days_to_release', 'total_cycle'];
  recentPrCols = ['pr_number', 'pr_title', 'pr_cost_center', 'pr_amount', 'pr_date', 'pr_status'];
  prKpiCols    = ['pr_kpi_number', 'pr_kpi_title', 'pr_kpi_cc', 'pr_kpi_status', 'pr_kpi_amount',
                  'pr_kpi_date', 'pr_days_submit', 'pr_days_rfq', 'pr_days_approve', 'pr_total_cycle'];

  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  });

  totalPos = computed(() =>
    Object.values(this.stats()?.po_counts ?? {}).reduce((a, b) => a + b, 0)
  );

  pendingPos = computed(() => {
    const counts = this.stats()?.po_counts ?? {};
    return (counts['pending_l1'] ?? 0) + (counts['pending_l2'] ?? 0) + (counts['pending_l3'] ?? 0);
  });

  statusEntries = computed(() =>
    Object.entries(this.stats()?.po_counts ?? {})
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)
  );

  totalPrs    = computed(() => Object.values(this.stats()?.pr_counts ?? {}).reduce((a, b) => a + b, 0));
  submittedPrs = computed(() => this.stats()?.pr_counts?.['submitted'] ?? 0);
  inRfqPrs    = computed(() =>
    (this.stats()?.pr_counts?.['rfq_created'] ?? 0) + (this.stats()?.pr_counts?.['rfq_approved'] ?? 0)
  );
  convertedPrs = computed(() => this.stats()?.pr_counts?.['converted'] ?? 0);

  poDonutSegments = computed(() => {
    const counts = this.stats()?.po_counts ?? {};
    const totalCount = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0));
    const r = 46; const circ = 2 * Math.PI * r; const init = circ * 0.25;
    const pending = (counts['pending_l1'] ?? 0) + (counts['pending_l2'] ?? 0) + (counts['pending_l3'] ?? 0);
    const items = [
      { status: 'draft',            label: 'Draft',            color: '#94a3b8', count: counts['draft'] ?? 0 },
      { status: 'pending',          label: 'Pending Approval', color: '#f97316', count: pending },
      { status: 'approved',         label: 'Approved',         color: '#22c55e', count: counts['approved'] ?? 0 },
      { status: 'released',         label: 'Released',         color: '#3b82f6', count: counts['released'] ?? 0 },
      { status: 'delivered',        label: 'Delivered',        color: '#10b981', count: counts['delivered'] ?? 0 },
      { status: 'invoiced',         label: 'Invoiced',         color: '#8b5cf6', count: counts['invoiced'] ?? 0 },
      { status: 'payment_released', label: 'Pmt. Released',    color: '#0891b2', count: counts['payment_released'] ?? 0 },
      { status: 'cancelled',        label: 'Cancelled',        color: '#ef4444', count: counts['cancelled'] ?? 0 },
    ];
    let accumulated = 0;
    return items.map(item => {
      const dash = (item.count / totalCount) * circ;
      const offset = init - accumulated;
      accumulated += dash;
      return { ...item, dash, gap: circ - dash, offset };
    });
  });

  prPipelineStages = computed(() => {
    const counts = this.stats()?.pr_counts ?? {};
    const inRfq = (counts['rfq_created'] ?? 0) + (counts['rfq_approved'] ?? 0);
    const items = [
      { label: 'Draft',     count: counts['draft'] ?? 0,     color: '#94a3b8' },
      { label: 'Submitted', count: counts['submitted'] ?? 0, color: '#f97316' },
      { label: 'In RFQ',    count: inRfq,                    color: '#3b82f6' },
      { label: 'Converted', count: counts['converted'] ?? 0, color: '#22c55e' },
      { label: 'Rejected',  count: counts['rejected'] ?? 0,  color: '#ef4444' },
    ];
    const maxVal = Math.max(1, ...items.map(i => i.count));
    return items.map(s => ({ ...s, pct: Math.min(100, (s.count / maxVal) * 100) }));
  });

  selectedPeriod = signal<string>('all');
  fromDate = signal<string>('');
  toDate = signal<string>('');

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

  applyCustomFilter() {
    if (this.fromDate() && this.toDate()) {
      this.reload();
    }
  }

  reload() {
    this.loading.set(true);

    const queryParams: string[] = [];
    if (this.selectedPeriod()) queryParams.push(`period=${this.selectedPeriod()}`);
    if (this.fromDate()) queryParams.push(`from_date=${this.fromDate()}`);
    if (this.toDate()) queryParams.push(`to_date=${this.toDate()}`);

    const queryStr = queryParams.length ? '?' + queryParams.join('&') : '';

    this.http.get<DashboardStats>(`${environment.apiUrl}/dashboard/stats${queryStr}`).subscribe({
      next: s  => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleKpi(po: PoKpi) {
    this.expandedKpi.update(cur => cur === po.id ? null : po.id);
  }

  togglePrKpi(pr: PrKpi) {
    this.expandedPrKpi.update(cur => cur === pr.id ? null : pr.id);
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
      rfq_created: 'RFQ Created',
      rfq_approved: 'RFQ Approved',
      converted: 'Converted to PO',
      rejected: 'Rejected',
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
}
