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
import { environment } from '../../../environments/environment';
import { SearchSelectDialogComponent, SearchSelectOption } from '../../shared/components/search-select-dialog.component';

interface TenantOption {
  id: number;
  name: string;
  plan: string;
  is_active: boolean;
}

@Component({
  selector: 'app-executive-dashboard',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, UpperCasePipe, RouterLink, FormsModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatProgressSpinnerModule, MatTableModule, MatChipsModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">
      <!-- ── Page Header ────────────────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <div class="header-badge">EXECUTIVE SUITE</div>
          <h2>Executive Dashboard</h2>
          <p>Key Performance Indicators, Savings Analysis, TAT Distribution & Risk Metrics</p>
        </div>

        <div class="header-actions-group">
          <!-- Org Switcher (Visible ONLY for ZOPA Super Admin) -->
          @if (userScope()?.is_zopa_admin) {
            <button class="org-filter-btn" (click)="openOrgPicker()" matTooltip="Switch organization scope">
              <mat-icon class="ofb-lead">corporate_fare</mat-icon>
              <span class="ofb-col">
                <span class="ofb-cap">Organization Scope</span>
                <span class="ofb-name">{{ selectedTenantName() }}</span>
              </span>
              <mat-icon class="ofb-caret">expand_more</mat-icon>
            </button>
          } @else {
            <div class="client-entity-chip" matTooltip="Your Organization Scope">
              <mat-icon>business</mat-icon>
              <span>{{ userScope()?.tenant_name }}</span>
            </div>
          }

          <!-- CSV Export Button -->
          <button mat-raised-button color="primary" class="export-btn" (click)="exportCsv()" [disabled]="exporting()">
            @if (exporting()) {
              <mat-spinner diameter="18" class="inline-spinner" />
            } @else {
              <mat-icon>download</mat-icon>
            }
            Export Report (CSV)
          </button>
        </div>
      </div>

      <!-- ── Date Filter Toolbar ────────────────────────────────────────── -->
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
          <span>Loading Executive Intelligence…</span>
        </div>
      } @else if (kpis()) {

        <!-- ── 6 Primary Executive KPI Cards ──────────────────────────────── -->
        <div class="kpi-grid">
          <!-- 1. Orders Processed -->
          <div class="kpi-card">
            <div class="kpi-icon icon-blue"><mat-icon>receipt_long</mat-icon></div>
            <div class="kpi-details">
              <span class="kpi-title">Orders Processed</span>
              <span class="kpi-number">{{ kpis()!.orders_processed | number }}</span>
              <span class="kpi-sub">Purchase Orders Issued</span>
            </div>
          </div>

          <!-- 2. Total Value Managed -->
          <div class="kpi-card">
            <div class="kpi-icon icon-teal"><mat-icon>currency_rupee</mat-icon></div>
            <div class="kpi-details">
              <span class="kpi-title">Total Value Managed</span>
              <span class="kpi-number">₹{{ (kpis()!.total_value_managed / 100000) | number:'1.1-2' }}L</span>
              <span class="kpi-sub">Total PO Spend</span>
            </div>
          </div>

          <!-- 3. Total Savings Realized -->
          <div class="kpi-card">
            <div class="kpi-icon icon-green"><mat-icon>savings</mat-icon></div>
            <div class="kpi-details">
              <span class="kpi-title">Total Savings Realized</span>
              <span class="kpi-number text-green-600">₹{{ (kpis()!.total_savings_realized / 100000) | number:'1.1-2' }}L</span>
              <span class="kpi-sub">PR Est. vs PO Actual</span>
            </div>
          </div>

          <!-- 4. Average Savings % -->
          <div class="kpi-card">
            <div class="kpi-icon icon-emerald"><mat-icon>percent</mat-icon></div>
            <div class="kpi-details">
              <span class="kpi-title">Average Savings %</span>
              <span class="kpi-number text-emerald-600">{{ kpis()!.avg_savings_percentage }}%</span>
              <span class="kpi-sub">Negotiated Price Savings</span>
            </div>
          </div>

          <!-- 5. Vendors Managed -->
          <div class="kpi-card">
            <div class="kpi-icon icon-purple"><mat-icon>business</mat-icon></div>
            <div class="kpi-details">
              <span class="kpi-title">Vendors Managed</span>
              <span class="kpi-number">{{ kpis()!.vendors_managed | number }}</span>
              <span class="kpi-sub">Active Vendor Network</span>
            </div>
          </div>

          <!-- 6. Categories Handled -->
          <div class="kpi-card">
            <div class="kpi-icon icon-indigo"><mat-icon>category</mat-icon></div>
            <div class="kpi-details">
              <span class="kpi-title">Categories Handled</span>
              <span class="kpi-number">{{ kpis()!.categories_handled | number }}</span>
              <span class="kpi-sub">Product Categories</span>
            </div>
          </div>
        </div>

        <!-- ── Operations & Scope Secondary Cards ────────────────────────── -->
        <div class="scope-grid mb-6">
          <!-- 7. Projects Served -->
          <div class="scope-card">
            <mat-icon class="scope-icon text-blue-600">folder_special</mat-icon>
            <div>
              <div class="scope-val">{{ kpis()!.projects_served }}</div>
              <div class="scope-lbl">Projects Served</div>
            </div>
          </div>

          <!-- 8. Project Locations Managed -->
          <div class="scope-card">
            <mat-icon class="scope-icon text-indigo-600">place</mat-icon>
            <div>
              <div class="scope-val">{{ kpis()!.project_locations_managed }}</div>
              <div class="scope-lbl">Project Locations</div>
            </div>
          </div>

          <!-- 17. Medicine & Lab Stock Outage Rate -->
          <div class="scope-card">
            <mat-icon class="scope-icon text-rose-600">local_hospital</mat-icon>
            <div>
              <div class="scope-val" [class.text-rose-600]="kpis()!.medicine_lab_outage_rate > 5">
                {{ kpis()!.medicine_lab_outage_rate }}%
              </div>
              <div class="scope-lbl">Med / Lab Outage Rate</div>
            </div>
          </div>

          <!-- 18. Local Procurement Volume -->
          <div class="scope-card">
            <mat-icon class="scope-icon text-teal-600">storefront</mat-icon>
            <div>
              <div class="scope-val">₹{{ (kpis()!.local_procurement_spend / 100000) | number:'1.1-1' }}L</div>
              <div class="scope-lbl">Local Spend ({{ kpis()!.local_procurement_pct }}%)</div>
            </div>
          </div>
        </div>

        <!-- ── TAT & Delay Performance Section ─────────────────────────── -->
        <div class="tat-section mb-6">
          <div class="section-title">
            <mat-icon color="primary">timer</mat-icon>
            <span>Turnaround Time (TAT) & Delay Analysis</span>
          </div>

          <div class="tat-grid">
            <!-- Avg PR & PO TAT Summary Box -->
            <mat-card class="tat-summary-box">
              <mat-card-header><mat-card-title>Avg Turnaround Times</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="tat-metric-row">
                  <div class="tm-left">
                    <span class="tm-label">11. Average PR TAT</span>
                    <span class="tm-sub">PR Submission to Conversion</span>
                  </div>
                  <span class="tm-val tat-ok-badge">{{ kpis()!.avg_pr_tat_days }} days</span>
                </div>
                <div class="tm-divider"></div>
                <div class="tat-metric-row">
                  <div class="tm-left">
                    <span class="tm-label">12. Average PO Issue TAT</span>
                    <span class="tm-sub">PO Creation to Vendor Release</span>
                  </div>
                  <span class="tm-val tat-ok-badge">{{ kpis()!.avg_po_issue_tat_days }} days</span>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- 13. PR TAT Distribution -->
            <mat-card class="tat-dist-box">
              <mat-card-header><mat-card-title>13. PR TAT Distribution</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="dist-bars">
                  @for (entry of prDistributionEntries(); track entry.range) {
                    <div class="dist-row">
                      <div class="dist-lbl">{{ entry.range }}</div>
                      <div class="dist-bar-track">
                        <div class="dist-bar-fill" [style.width]="entry.pct + '%'" [style.background]="entry.color"></div>
                      </div>
                      <div class="dist-count">{{ entry.count }} ({{ entry.pct }}%)</div>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          </div>

          <!-- 14. Max TAT Case Banner -->
          @if (kpis()!.max_tat_case) {
            <div class="max-tat-banner mt-4">
              <div class="mtb-left">
                <span class="mtb-tag"><mat-icon>warning</mat-icon> 14. MAXIMUM TAT DELAY CASE</span>
                <span class="mtb-doc">{{ kpis()!.max_tat_case.number }} ({{ kpis()!.max_tat_case.type }})</span>
                <span class="mtb-cause">Root Cause: {{ kpis()!.max_tat_case.root_cause }}</span>
              </div>
              <div class="mtb-right">
                <span class="mtb-days">{{ kpis()!.max_tat_case.tat_days }} DAYS DELAY</span>
              </div>
            </div>
          }

          <!-- 15. Delay & Root Cause Mapping Table -->
          <mat-card class="delay-card mt-4">
            <mat-card-header><mat-card-title>15. Delay & Root Cause Mapping</mat-card-title></mat-card-header>
            <mat-card-content style="padding:0!important;">
              <table mat-table [dataSource]="kpis()!.delay_mapping" class="delay-table">
                <ng-container matColumnDef="stage">
                  <th mat-header-cell *matHeaderCellDef>WORKFLOW STAGE</th>
                  <td mat-cell *matCellDef="let row"><strong>{{ row.stage }}</strong></td>
                </ng-container>

                <ng-container matColumnDef="count">
                  <th mat-header-cell *matHeaderCellDef style="text-align:center;">PENDING COUNT</th>
                  <td mat-cell *matCellDef="let row" style="text-align:center;">
                    <span class="count-badge">{{ row.count }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="root_cause">
                  <th mat-header-cell *matHeaderCellDef>IDENTIFIED ROOT CAUSE</th>
                  <td mat-cell *matCellDef="let row" style="color:#475569;">{{ row.root_cause }}</td>
                </ng-container>

                <ng-container matColumnDef="impact">
                  <th mat-header-cell *matHeaderCellDef style="text-align:right;">IMPACT LEVEL</th>
                  <td mat-cell *matCellDef="let row" style="text-align:right;">
                    <span class="impact-chip" [class.impact-high]="row.impact === 'High'" [class.impact-med]="row.impact === 'Moderate'">
                      {{ row.impact }}
                    </span>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="['stage', 'count', 'root_cause', 'impact']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['stage', 'count', 'root_cause', 'impact'];"></tr>
              </table>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- ── 9 & 10. Value Share & Negotiated Savings by Category ─────── -->
        <mat-card class="category-card mb-6">
          <mat-card-header>
            <div class="cat-card-header">
              <mat-icon color="primary">pie_chart</mat-icon>
              <span>9 & 10. Value Share & Negotiated Savings by Category</span>
            </div>
          </mat-card-header>
          <mat-card-content style="padding:0!important;">
            <table mat-table [dataSource]="kpis()!.category_spend" class="cat-table">
              <ng-container matColumnDef="category_name">
                <th mat-header-cell *matHeaderCellDef>CATEGORY NAME</th>
                <td mat-cell *matCellDef="let cat">
                  <div class="cat-name-cell">
                    <mat-icon style="font-size:18px;color:#3b82f6;">label</mat-icon>
                    <strong>{{ cat.category_name }}</strong>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="spend">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">SPEND (PO ACTUAL)</th>
                <td mat-cell *matCellDef="let cat" style="text-align:right;">
                  <strong>₹{{ cat.spend | number:'1.0-0' }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="share_pct">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">VALUE SHARE %</th>
                <td mat-cell *matCellDef="let cat" style="text-align:center;">
                  <span class="share-chip">{{ cat.share_pct }}%</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="estimated_budget">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">ESTIMATED PR BUDGET</th>
                <td mat-cell *matCellDef="let cat" style="text-align:right;color:#64748b;">
                  ₹{{ cat.estimated_budget | number:'1.0-0' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="savings">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">NEGOTIATED SAVINGS</th>
                <td mat-cell *matCellDef="let cat" style="text-align:right;" class="text-green-600">
                  <strong>₹{{ cat.savings | number:'1.0-0' }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="savings_pct">
                <th mat-header-cell *matHeaderCellDef style="text-align:center;">SAVINGS %</th>
                <td mat-cell *matCellDef="let cat" style="text-align:center;">
                  <span class="sav-badge">{{ cat.savings_pct }}%</span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="['category_name', 'spend', 'share_pct', 'estimated_budget', 'savings', 'savings_pct']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['category_name', 'spend', 'share_pct', 'estimated_budget', 'savings', 'savings_pct'];" class="cat-row"></tr>
            </table>
          </mat-card-content>
        </mat-card>

      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; max-width: 1240px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 20px; }
    .header-badge { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; color: #2563eb; background: #eff6ff; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
    .page-header p { margin: 4px 0 0; font-size: 13px; color: #64748b; }

    .header-actions-group { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }

    .org-filter-btn {
      display: inline-flex; align-items: center; gap: 10px;
      background: white; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 6px 14px; cursor: pointer; transition: all 0.15s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04); text-align: left;
    }
    .org-filter-btn:hover { border-color: #94a3b8; background: #f8fafc; }
    .ofb-lead { font-size: 20px; width: 20px; height: 20px; color: #2563eb; }
    .ofb-col { display: flex; flex-direction: column; }
    .ofb-cap { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
    .ofb-name { font-size: 13px; font-weight: 700; color: #0f172a; }
    .ofb-caret { font-size: 18px; width: 18px; height: 18px; color: #64748b; }

    .client-entity-chip {
      display: inline-flex; align-items: center; gap: 8px; background: #f8fafc;
      border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 10px;
      font-size: 13px; font-weight: 700; color: #0f172a;
    }
    .client-entity-chip mat-icon { font-size: 18px; width: 18px; height: 18px; color: #16a34a; }

    .export-btn { height: 42px; border-radius: 8px; font-weight: 600; padding: 0 18px; }
    .inline-spinner { display: inline-block; vertical-align: middle; margin-right: 6px; }

    /* ── Date Filter Toolbar ── */
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

    .loading-state { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 80px; color: #64748b; }

    /* ── 6 Primary Executive KPI Cards ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;
      display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .kpi-icon {
      width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
      color: white; flex-shrink: 0;
    }
    .kpi-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .icon-blue { background: #2563eb; }
    .icon-teal { background: #0d9488; }
    .icon-green { background: #16a34a; }
    .icon-emerald { background: #059669; }
    .icon-purple { background: #8b5cf6; }
    .icon-indigo { background: #4f46e5; }

    .kpi-details { display: flex; flex-direction: column; }
    .kpi-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi-number { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 2px; line-height: 1.2; }
    .kpi-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }

    /* ── Scope Cards ── */
    .scope-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .scope-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;
      display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .scope-icon { font-size: 24px; width: 24px; height: 24px; }
    .scope-val { font-size: 17px; font-weight: 800; color: #0f172a; }
    .scope-lbl { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 1px; }

    /* ── TAT & Delay Section ── */
    .tat-section { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 16px; }

    .tat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .tat-summary-box, .tat-dist-box { border: 1px solid #e2e8f0; border-radius: 10px; }
    .tat-metric-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; }
    .tm-left { display: flex; flex-direction: column; }
    .tm-label { font-size: 13px; font-weight: 700; color: #0f172a; }
    .tm-sub { font-size: 11px; color: #64748b; }
    .tm-val { font-size: 14px; font-weight: 800; padding: 4px 10px; border-radius: 6px; }
    .tat-ok-badge { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .tm-divider { height: 1px; background: #f1f5f9; }

    .dist-bars { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
    .dist-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
    .dist-lbl { width: 85px; font-weight: 600; color: #475569; }
    .dist-bar-track { flex: 1; height: 10px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
    .dist-bar-fill { height: 100%; border-radius: 99px; transition: width 0.4s ease; }
    .dist-count { width: 85px; font-weight: 700; color: #0f172a; text-align: right; }

    .max-tat-banner {
      background: #fff7ed; border: 1px solid #ffedd5; border-radius: 10px; padding: 14px 18px;
      display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
    }
    .mtb-left { display: flex; flex-direction: column; gap: 2px; }
    .mtb-tag { font-size: 11px; font-weight: 800; color: #c2410c; display: flex; align-items: center; gap: 4px; }
    .mtb-tag mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .mtb-doc { font-size: 14px; font-weight: 700; color: #9a3412; }
    .mtb-cause { font-size: 12px; color: #c2410c; }
    .mtb-right { background: #c2410c; color: white; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 13px; }

    .delay-card { border: 1px solid #e2e8f0; border-radius: 10px; }
    .delay-table { width: 100%; }
    .count-badge { background: #f1f5f9; color: #0f172a; padding: 2px 8px; border-radius: 99px; font-weight: 700; font-size: 12px; }
    .impact-chip { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #f1f5f9; color: #475569; }
    .impact-high { background: #fee2e2; color: #991b1b; }
    .impact-med { background: #fff7ed; color: #c2410c; }

    /* ── Category Table ── */
    .category-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .cat-card-header { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 15px; }
    .cat-table { width: 100%; }
    .cat-row:hover { background: #f8fafc; }
    .cat-name-cell { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #0f172a; }
    .share-chip { background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; }
    .sav-badge { background: #f0fdf4; color: #15803d; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #bbf7d0; }

    @media (max-width: 900px) {
      .tat-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ExecutiveDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);

  tenants = signal<TenantOption[]>([]);
  kpis = signal<any>(null);
  userScope = signal<any>(null);
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

  prDistributionEntries = computed(() => {
    const dist = this.kpis()?.pr_tat_distribution;
    if (!dist) return [];
    const colors: Record<string, string> = {
      '< 1 Day': '#22c55e',
      '1 - 3 Days': '#3b82f6',
      '3 - 7 Days': '#f97316',
      '> 7 Days': '#ef4444',
    };
    return Object.entries(dist).map(([range, val]: [string, any]) => ({
      range,
      count: val.count,
      pct: val.pct,
      color: colors[range] ?? '#3b82f6',
    }));
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

  applyCustomFilter() {
    if (this.fromDate() && this.toDate()) {
      this.loadData();
    }
  }

  loadTenants() {
    this.http.get<TenantOption[]>(`${environment.apiUrl}/admin/dashboard/tenants`).subscribe({
      next: t => this.tenants.set(t),
      error: () => {},
    });
  }

  loadData() {
    this.loading.set(true);
    const queryParams: string[] = [];

    if (this.selectedTenantId > 0) queryParams.push(`tenant_id=${this.selectedTenantId}`);
    if (this.selectedPeriod()) queryParams.push(`period=${this.selectedPeriod()}`);
    if (this.fromDate()) queryParams.push(`from_date=${this.fromDate()}`);
    if (this.toDate()) queryParams.push(`to_date=${this.toDate()}`);

    const queryStr = queryParams.length ? '?' + queryParams.join('&') : '';

    this.http.get<any>(`${environment.apiUrl}/executive-dashboard/stats${queryStr}`).subscribe({
      next: (res) => {
        this.kpis.set(res);
        this.userScope.set(res.user_scope);
        this.loading.set(false);
      },
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
    const url = `${environment.apiUrl}/executive-dashboard/export${queryStr}`;

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
}
