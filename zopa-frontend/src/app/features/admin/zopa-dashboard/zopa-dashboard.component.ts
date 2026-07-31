import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';
import { SearchSelectDialogComponent, SearchSelectOption } from '../../../shared/components/search-select-dialog.component';

interface TenantSummary {
  id: number; name: string; code?: string; plan: string; is_active: boolean; created_at: string;
  kpi: { total_pos: number; total_pr: number; po_value: number; pending_approvals: number; avg_tat_days?: number; };
}

@Component({
  selector: 'app-zopa-dashboard',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, UpperCasePipe, RouterLink, FormsModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatProgressSpinnerModule, MatTableModule, MatChipsModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">
      <!-- ── Header ────────────────────────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h2>ZOPA Admin Dashboard</h2>
          <p>Consolidated procurement intelligence & performance analytics across all organizations</p>
        </div>
        <div class="header-actions-group">
          <!-- Org Filter Button -->
          <button class="org-filter-btn" (click)="openOrgPicker()"
                  matTooltip="Filter by organization — searchable">
            <mat-icon class="ofb-lead">corporate_fare</mat-icon>
            <span class="ofb-col">
              <span class="ofb-cap">Organization</span>
              <span class="ofb-name">{{ selectedTenantName() }}</span>
            </span>
            <mat-icon class="ofb-caret">expand_more</mat-icon>
          </button>

          <!-- Export CSV Button -->
          <button mat-raised-button color="primary" class="export-btn" (click)="exportCsv()" [disabled]="exporting()">
            @if (exporting()) {
              <mat-spinner diameter="18" class="inline-spinner" />
            } @else {
              <mat-icon>download</mat-icon>
            }
            Export CSV
          </button>
        </div>
      </div>

      <!-- ── Date Filter Bar ────────────────────────────────────────────────── -->
      <div class="filter-toolbar">
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
        <div style="display:flex;justify-content:center;padding:80px;">
          <mat-spinner diameter="40" />
        </div>
      } @else if (stats()) {

        <!-- ── Header KPI band ──────────────────────────────────────────────── -->
        <div class="kpi-band">
          <div class="kpi-block">
            <div class="kpi-icon kpi-icon--blue"><mat-icon>receipt_long</mat-icon></div>
            <div>
              <div class="kpi-val">{{ stats()!.po.total | number }}</div>
              <div class="kpi-label">Total POs</div>
            </div>
          </div>
          <div class="kpi-block">
            <div class="kpi-icon kpi-icon--orange"><mat-icon>description</mat-icon></div>
            <div>
              <div class="kpi-val">{{ stats()!.pr.total | number }}</div>
              <div class="kpi-label">Total PRs</div>
            </div>
          </div>
          <div class="kpi-block">
            <div class="kpi-icon kpi-icon--green"><mat-icon>inventory_2</mat-icon></div>
            <div>
              <div class="kpi-val">{{ stats()!.grn.total | number }}</div>
              <div class="kpi-label">GRNs</div>
            </div>
          </div>
          <div class="kpi-block">
            <div class="kpi-icon kpi-icon--purple"><mat-icon>request_quote</mat-icon></div>
            <div>
              <div class="kpi-val">{{ stats()!.invoice.total | number }}</div>
              <div class="kpi-label">Invoices</div>
            </div>
          </div>
          <div class="kpi-block">
            <div class="kpi-icon kpi-icon--red"><mat-icon>pending_actions</mat-icon></div>
            <div>
              <div class="kpi-val">{{ stats()!.po.pending_approvals | number }}</div>
              <div class="kpi-label">Pending Approvals</div>
            </div>
          </div>
          <div class="kpi-block">
            <div class="kpi-icon kpi-icon--teal"><mat-icon>currency_rupee</mat-icon></div>
            <div>
              <div class="kpi-val">₹{{ (stats()!.po.total_value / 100000) | number:'1.1-1' }}L</div>
              <div class="kpi-label">Total PO Value</div>
            </div>
          </div>
        </div>

        <!-- ── Intuitive TAT Summary Performance Pipeline ──────────────────────── -->
        <mat-card class="tat-summary-card mb-6">
          <mat-card-header>
            <div class="tat-card-title">
              <mat-icon color="primary">speed</mat-icon>
              <span>Turnaround Time (TAT) Pipeline Summary</span>
              <span class="tat-scope-badge">{{ selectedTenantName() }}</span>
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

        <!-- ── Charts band ──────────────────────────────────────────────────── -->
        <div class="charts-band">

          <!-- PO Status Donut -->
          <mat-card class="chart-card">
            <mat-card-header><mat-card-title>PO Status Distribution</mat-card-title></mat-card-header>
            <mat-card-content style="padding-top:12px!important;">
              <div class="donut-wrap">
                <svg viewBox="0 0 120 120" style="width:130px;height:130px;flex-shrink:0;">
                  <circle cx="60" cy="60" r="46" fill="none" stroke="#f1f5f9" stroke-width="14"/>
                  @for (seg of poDonutSegments(); track seg.label) {
                    @if (seg.count > 0) {
                      <circle cx="60" cy="60" r="46" fill="none" stroke-width="14"
                        [attr.stroke]="seg.color"
                        [attr.stroke-dasharray]="seg.dash + ' ' + seg.gap"
                        [attr.stroke-dashoffset]="seg.offset" />
                    }
                  }
                  <text x="60" y="56" text-anchor="middle"
                        style="font-size:17px;font-weight:800;fill:#1e293b;">{{ stats()!.po.total | number }}</text>
                  <text x="60" y="70" text-anchor="middle"
                        style="font-size:8px;font-weight:600;fill:#94a3b8;letter-spacing:0.5px;">TOTAL POs</text>
                </svg>
                <div class="donut-legend">
                  @for (seg of poDonutSegments(); track seg.label) {
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

          <!-- Value overview: PO vs Invoice vs PR -->
          <mat-card class="chart-card">
            <mat-card-header><mat-card-title>Value at a Glance</mat-card-title></mat-card-header>
            <mat-card-content style="padding-top:12px!important;">
              <div class="value-bars">
                <div class="vbar-row">
                  <div class="vbar-label"><mat-icon style="font-size:14px;color:#2563eb;vertical-align:middle;">receipt_long</mat-icon> PO Value</div>
                  <div class="vbar-track">
                    <div class="vbar-fill" style="background:#2563eb;"
                         [style.width]="valueBarPct(stats()!.po.total_value ?? 0) + '%'"></div>
                  </div>
                  <div class="vbar-val">₹{{ (stats()!.po.total_value / 100000) | number:'1.1-1' }}L</div>
                </div>

                <div class="vbar-row">
                  <div class="vbar-label"><mat-icon style="font-size:14px;color:#f97316;vertical-align:middle;">description</mat-icon> PR Value</div>
                  <div class="vbar-track">
                    <div class="vbar-fill" style="background:#f97316;"
                         [style.width]="valueBarPct(stats()!.pr.total_value ?? 0) + '%'"></div>
                  </div>
                  <div class="vbar-val">₹{{ (stats()!.pr.total_value / 100000) | number:'1.1-1' }}L</div>
                </div>

                <div class="vbar-row">
                  <div class="vbar-label"><mat-icon style="font-size:14px;color:#8b5cf6;vertical-align:middle;">request_quote</mat-icon> Invoice Value</div>
                  <div class="vbar-track">
                    <div class="vbar-fill" style="background:#8b5cf6;"
                         [style.width]="valueBarPct(stats()!.invoice.total_value ?? 0) + '%'"></div>
                  </div>
                  <div class="vbar-val">₹{{ (stats()!.invoice.total_value / 100000) | number:'1.1-1' }}L</div>
                </div>

                <div class="vbar-row">
                  <div class="vbar-label"><mat-icon style="font-size:14px;color:#16a34a;vertical-align:middle;">verified</mat-icon> Approved POs</div>
                  <div class="vbar-track">
                    <div class="vbar-fill" style="background:#16a34a;"
                         [style.width]="valueBarPct(stats()!.po.approved_value ?? 0) + '%'"></div>
                  </div>
                  <div class="vbar-val">₹{{ (stats()!.po.approved_value / 100000) | number:'1.1-1' }}L</div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

        </div>

        <!-- ── Tenant Breakdown Table ────────────────────────────────────── -->
        <mat-card class="tenants-card">
          <mat-card-header>
            <mat-card-title>Organization Performance Breakdown</mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding:0!important;">
            <table mat-table [dataSource]="tenants()" class="tenants-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>ORGANIZATION</th>
                <td mat-cell *matCellDef="let t">
                  <div class="org-cell" (click)="selectTenant(t.id)">
                    <div class="org-avatar">{{ t.name.substring(0, 2).toUpperCase() }}</div>
                    <div>
                      <div class="org-name">{{ t.name }}</div>
                      <div class="org-sub">Plan: {{ t.plan | uppercase }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="pos">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">TOTAL POs</th>
                <td mat-cell *matCellDef="let t" style="text-align:center;">
                  <strong style="font-size:14px;">{{ t.kpi.total_pos }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="prs">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">TOTAL PRs</th>
                <td mat-cell *matCellDef="let t" style="text-align:center;">
                  <span style="font-size:13px;color:#475569;">{{ t.kpi.total_pr }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="pending">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">PENDING APPR.</th>
                <td mat-cell *matCellDef="let t" style="text-align:center;">
                  @if (t.kpi.pending_approvals > 0) {
                    <span class="pending-chip">{{ t.kpi.pending_approvals }}</span>
                  } @else {
                    <span class="clear-chip">0</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="value">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">PO VALUE</th>
                <td mat-cell *matCellDef="let t" style="text-align:right;">
                  <strong style="font-size:14px;color:#1e293b;">₹{{ (t.kpi.po_value / 100000) | number:'1.1-1' }}L</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="tat">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">AVG TAT</th>
                <td mat-cell *matCellDef="let t" style="text-align:center;">
                  <span class="tat-badge" [class.tat-ok]="(t.kpi.avg_tat_days ?? 0) <= 3" [class.tat-warn]="(t.kpi.avg_tat_days ?? 0) > 3">
                    {{ t.kpi.avg_tat_days ?? 0 }}d
                  </span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="['name', 'pos', 'prs', 'pending', 'value', 'tat']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['name', 'pos', 'prs', 'pending', 'value', 'tat'];" class="tenant-row"></tr>
            </table>
          </mat-card-content>
        </mat-card>

      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 20px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; color: #1e293b; }
    .page-header p { margin: 6px 0 0; font-size: 13px; color: #64748b; }

    .header-actions-group { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }

    .org-filter-btn {
      display: inline-flex; align-items: center; gap: 10px;
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 6px 14px; cursor: pointer; transition: all 0.15s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04); text-align: left;
    }
    .org-filter-btn:hover { border-color: #cbd5e1; background: #f8fafc; }
    .ofb-lead { font-size: 20px; width: 20px; height: 20px; color: #3b82f6; }
    .ofb-col { display: flex; flex-direction: column; }
    .ofb-cap { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
    .ofb-name { font-size: 13px; font-weight: 700; color: #0f172a; }
    .ofb-caret { font-size: 18px; width: 18px; height: 18px; color: #64748b; }

    .export-btn { height: 42px; border-radius: 8px; font-weight: 600; padding: 0 18px; }
    .inline-spinner { display: inline-block; vertical-align: middle; margin-right: 6px; }

    /* ── Date Filter Toolbar ───────────────────────────────────────── */
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

    /* ── KPI Band ──────────────────────────────────────────────────── */
    .kpi-band { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-block {
      background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;
      display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .kpi-icon {
      width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
      color: white; flex-shrink: 0;
    }
    .kpi-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .kpi-icon--blue { background: #2563eb; }
    .kpi-icon--orange { background: #f97316; }
    .kpi-icon--green { background: #16a34a; }
    .kpi-icon--purple { background: #8b5cf6; }
    .kpi-icon--red { background: #dc2626; }
    .kpi-icon--teal { background: #0d9488; }

    .kpi-val { font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.2; }
    .kpi-label { font-size: 12px; color: #64748b; font-weight: 500; margin-top: 2px; }

    /* ── TAT Summary Card ───────────────────────────────────────────── */
    .tat-summary-card {
      border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;
      margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .tat-card-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
    .tat-scope-badge {
      font-size: 11px; background: #eff6ff; color: #2563eb; padding: 2px 8px;
      border-radius: 99px; font-weight: 600; margin-left: 8px; border: 1px solid #bfdbfe;
    }
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

    /* ── Charts band ───────────────────────────────────────────────── */
    .charts-band { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .chart-card { border: 1px solid #e2e8f0; border-radius: 12px; }

    .donut-wrap { display: flex; align-items: center; gap: 20px; }
    .donut-legend { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .d-legend-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .d-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .d-legend-label { color: #64748b; flex: 1; }
    .d-legend-count { font-weight: 700; color: #0f172a; }

    .value-bars { display: flex; flex-direction: column; gap: 14px; }
    .vbar-row { display: flex; align-items: center; gap: 12px; font-size: 12px; }
    .vbar-label { width: 110px; font-weight: 600; color: #475569; flex-shrink: 0; }
    .vbar-track { flex: 1; height: 10px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
    .vbar-fill { height: 100%; border-radius: 99px; transition: width 0.4s ease; }
    .vbar-val { width: 60px; font-weight: 700; color: #0f172a; text-align: right; flex-shrink: 0; }

    /* ── Tenants table ─────────────────────────────────────────────── */
    .tenants-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .tenants-table { width: 100%; }
    .tenant-row:hover { background: #f8fafc; }
    .org-cell { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .org-avatar {
      width: 32px; height: 32px; border-radius: 8px; background: #3b82f6; color: white;
      font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .org-name { font-weight: 600; color: #0f172a; font-size: 13px; }
    .org-sub { font-size: 11px; color: #94a3b8; }

    .pending-chip { background: #fff7ed; color: #c2410c; padding: 2px 8px; border-radius: 99px; font-size: 12px; font-weight: 700; border: 1px solid #ffedd5; }
    .clear-chip { color: #94a3b8; font-size: 12px; }

    .tat-badge { padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; }
    .tat-ok { background: #f0fdf4; color: #166534; }
    .tat-warn { background: #fff7ed; color: #c2410c; }

    @media (max-width: 900px) {
      .charts-band { grid-template-columns: 1fr; }
    }
  `]
})
export class ZopaDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);

  tenants = signal<TenantSummary[]>([]);
  stats = signal<any>(null);
  loading = signal(true);
  exporting = signal(false);

  selectedTenantId = 0;
  selectedPeriod = signal<string>('all');
  fromDate = signal<string>('');
  toDate = signal<string>('');

  selectedTenantName = computed(() => {
    if (this.selectedTenantId === 0) return 'All Organizations';
    return this.tenants().find(t => t.id === this.selectedTenantId)?.name ?? 'Selected Organization';
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

  applyCustomFilter() {
    if (this.fromDate() && this.toDate()) {
      this.loadData();
    }
  }

  selectTenant(id: number) {
    this.selectedTenantId = id;
    this.loadData();
  }

  loadData() {
    this.loading.set(true);

    const queryParams: string[] = [];
    if (this.selectedTenantId > 0) queryParams.push(`tenant_id=${this.selectedTenantId}`);
    if (this.selectedPeriod()) queryParams.push(`period=${this.selectedPeriod()}`);
    if (this.fromDate()) queryParams.push(`from_date=${this.fromDate()}`);
    if (this.toDate()) queryParams.push(`to_date=${this.toDate()}`);

    const queryStr = queryParams.length ? '?' + queryParams.join('&') : '';

    // Load tenant KPIs list
    this.http.get<TenantSummary[]>(`${environment.apiUrl}/admin/dashboard/tenants${queryStr}`).subscribe({
      next: t => this.tenants.set(t),
      error: () => {},
    });

    // Load main stats
    this.http.get<any>(`${environment.apiUrl}/admin/dashboard/stats${queryStr}`).subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  exportCsv() {
    this.exporting.set(true);
    const queryParams: string[] = [];
    if (this.selectedTenantId > 0) queryParams.push(`tenant_id=${this.selectedTenantId}`);
    if (this.selectedPeriod()) queryParams.push(`period=${this.selectedPeriod()}`);
    if (this.fromDate()) queryParams.push(`from_date=${this.fromDate()}`);
    if (this.toDate()) queryParams.push(`to_date=${this.toDate()}`);

    const queryStr = queryParams.length ? '?' + queryParams.join('&') : '';
    const url = `${environment.apiUrl}/admin/dashboard/export${queryStr}`;

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
        currentId: this.selectedTenantId,
        searchPlaceholder: 'Search organizations…',
      },
    });
    ref.afterClosed().subscribe((id?: number) => {
      if (id !== undefined && id !== null && id !== this.selectedTenantId) {
        this.selectedTenantId = id;
        this.loadData();
      }
    });
  }

  poDonutSegments = computed(() => {
    const po = this.stats()?.po;
    if (!po) return [];
    const total = Math.max(1, po.total ?? 0);
    const r = 46; const circ = 2 * Math.PI * r; const init = circ * 0.25;
    const items = [
      { label: 'Draft',       color: '#94a3b8', count: po.draft ?? 0 },
      { label: 'Pending',     color: '#f97316', count: po.pending_approvals ?? 0 },
      { label: 'Approved',    color: '#22c55e', count: po.approved ?? 0 },
      { label: 'Released',    color: '#3b82f6', count: po.released ?? 0 },
      { label: 'Delivered',   color: '#10b981', count: po.delivered ?? 0 },
      { label: 'Invoiced',    color: '#8b5cf6', count: po.invoiced ?? 0 },
      { label: 'Pmt. Rel.',   color: '#0891b2', count: po.payment_released ?? 0 },
      { label: 'Cancelled',   color: '#ef4444', count: po.cancelled ?? 0 },
    ];
    let accumulated = 0;
    return items.map(item => {
      const dash = (item.count / total) * circ;
      const offset = init - accumulated;
      accumulated += dash;
      return { ...item, dash, gap: circ - dash, offset };
    });
  });

  valueBarPct(val: number): number {
    const s = this.stats();
    if (!s) return 0;
    const max = Math.max(1, s.po.total_value ?? 0, s.pr.total_value ?? 0, s.invoice.total_value ?? 0);
    return Math.min(100, (val / max) * 100);
  }
}
