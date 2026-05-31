import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../../../environments/environment';

interface TenantSummary {
  id: number; name: string; plan: string; is_active: boolean; created_at: string;
  kpi: { total_pos: number; total_pr: number; po_value: number; pending_approvals: number; };
}

@Component({
  selector: 'app-zopa-dashboard',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatCardModule, MatSelectModule,
    MatFormFieldModule, MatProgressSpinnerModule, MatTableModule, MatChipsModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h2>ZOPA Admin Dashboard</h2>
          <p>Consolidated procurement intelligence across all organizations</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <mat-form-field appearance="outline" style="min-width:220px;margin:0;">
            <mat-label>Organization</mat-label>
            <mat-select [(ngModel)]="selectedTenantId" (ngModelChange)="onTenantChange()">
              <mat-option [value]="0">All Organizations</mat-option>
              @for (t of tenants(); track t.id) {
                <mat-option [value]="t.id">{{ t.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:80px;">
          <mat-spinner diameter="40" />
        </div>
      } @else if (stats()) {

        <!-- Header KPI band -->
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

        <!-- ── Charts band ──────────────────────────────── -->
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
                  <div class="vbar-amount">₹{{ ((stats()!.po.total_value ?? 0)/100000) | number:'1.1-1' }}L</div>
                </div>
                <div class="vbar-row">
                  <div class="vbar-label"><mat-icon style="font-size:14px;color:#7c3aed;vertical-align:middle;">description</mat-icon> PR Est. Value</div>
                  <div class="vbar-track">
                    <div class="vbar-fill" style="background:#7c3aed;"
                         [style.width]="valueBarPct(stats()!.pr.total_value ?? 0) + '%'"></div>
                  </div>
                  <div class="vbar-amount">₹{{ ((stats()!.pr.total_value ?? 0)/100000) | number:'1.1-1' }}L</div>
                </div>
                <div class="vbar-row">
                  <div class="vbar-label"><mat-icon style="font-size:14px;color:#d97706;vertical-align:middle;">request_quote</mat-icon> Invoice Total</div>
                  <div class="vbar-track">
                    <div class="vbar-fill" style="background:#d97706;"
                         [style.width]="valueBarPct(stats()!.invoice.total_value ?? 0) + '%'"></div>
                  </div>
                  <div class="vbar-amount">₹{{ ((stats()!.invoice.total_value ?? 0)/100000) | number:'1.1-1' }}L</div>
                </div>
                <div class="vbar-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px;">
                  <div class="vbar-label"><mat-icon style="font-size:14px;color:#16a34a;vertical-align:middle;">verified</mat-icon> Approved PO Val.</div>
                  <div class="vbar-track">
                    <div class="vbar-fill" style="background:#16a34a;"
                         [style.width]="valueBarPct(stats()!.po.approved_value ?? 0) + '%'"></div>
                  </div>
                  <div class="vbar-amount">₹{{ ((stats()!.po.approved_value ?? 0)/100000) | number:'1.1-1' }}L</div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Tenant value chart (consolidated only) -->
          @if (!selectedTenantId && tenantValueBars().length) {
            <mat-card class="chart-card org-chart-card">
              <mat-card-header><mat-card-title>PO Value by Organization</mat-card-title></mat-card-header>
              <mat-card-content style="padding-top:12px!important;">
                <div class="org-bars">
                  @for (t of tenantValueBars(); track t.name) {
                    <div class="org-bar-row" (click)="selectedTenantId = t.id; onTenantChange()">
                      <div class="org-bar-name">
                        <span class="org-avatar-sm">{{ t.name[0] }}</span>{{ t.name }}
                      </div>
                      <div class="org-bar-track">
                        <div class="org-bar-fill" [style.width]="t.pct + '%'"></div>
                      </div>
                      <div class="org-bar-val">₹{{ (t.value/100000) | number:'1.1-1' }}L</div>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          }

        </div>

        <!-- Two-column detail -->
        <div class="detail-grid">

          <!-- PO Status Breakdown -->
          <mat-card class="anim-1">
            <mat-card-header><mat-card-title>Purchase Orders by Status</mat-card-title></mat-card-header>
            <mat-card-content style="padding-top:12px!important;">
              <div class="status-bars">
                @for (row of poStatusRows(); track row.label) {
                  <div class="status-bar-row">
                    <div class="sb-label">{{ row.label }}</div>
                    <div class="sb-track">
                      <div class="sb-fill" [style.width]="row.pct + '%'" [style.background]="row.color"></div>
                    </div>
                    <div class="sb-count">{{ row.count }}</div>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>

          <!-- PR Pipeline -->
          <mat-card class="anim-2">
            <mat-card-header><mat-card-title>PR Pipeline</mat-card-title></mat-card-header>
            <mat-card-content style="padding-top:12px!important;">
              <div class="pipeline-steps">
                <div class="step">
                  <div class="step-count">{{ stats()!.pr.draft ?? 0 }}</div>
                  <div class="step-label">Draft</div>
                </div>
                <mat-icon class="step-arrow">chevron_right</mat-icon>
                <div class="step">
                  <div class="step-count accent">{{ stats()!.pr.submitted ?? 0 }}</div>
                  <div class="step-label">Submitted</div>
                </div>
                <mat-icon class="step-arrow">chevron_right</mat-icon>
                <div class="step">
                  <div class="step-count blue">{{ (stats()!.pr.rfq_created ?? 0) + (stats()!.pr.rfq_approved ?? 0) }}</div>
                  <div class="step-label">In RFQ</div>
                </div>
                <mat-icon class="step-arrow">chevron_right</mat-icon>
                <div class="step">
                  <div class="step-count green">{{ stats()!.pr.converted ?? 0 }}</div>
                  <div class="step-label">Converted</div>
                </div>
                <mat-icon class="step-arrow">chevron_right</mat-icon>
                <div class="step">
                  <div class="step-count red">{{ stats()!.pr.rejected ?? 0 }}</div>
                  <div class="step-label">Rejected</div>
                </div>
              </div>
              <div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12px;color:var(--text-3);">Total Requisition Value</span>
                <strong style="font-size:16px;color:var(--text-1);">₹{{ (stats()!.pr.total_value ?? 0) | number:'1.0-0' }}</strong>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Invoice + GRN Summary -->
          <mat-card class="anim-3">
            <mat-card-header><mat-card-title>Invoice Summary</mat-card-title></mat-card-header>
            <mat-card-content style="padding-top:12px!important;">
              <div class="summary-rows">
                <div class="summary-row">
                  <span>Total Invoices</span><strong>{{ stats()!.invoice.total | number }}</strong>
                </div>
                <div class="summary-row">
                  <span>Pending Approval</span>
                  <strong style="color:#d97706;">{{ stats()!.invoice.pending | number }}</strong>
                </div>
                <div class="summary-row">
                  <span>Approved</span>
                  <strong style="color:#16a34a;">{{ stats()!.invoice.approved | number }}</strong>
                </div>
                <div class="summary-row">
                  <span>Rejected</span>
                  <strong style="color:#dc2626;">{{ stats()!.invoice.rejected | number }}</strong>
                </div>
                <div class="summary-row" style="border-top:2px solid var(--border);margin-top:4px;padding-top:8px;">
                  <span>Total Invoice Value</span>
                  <strong>₹{{ (stats()!.invoice.total_value ?? 0) | number:'1.0-0' }}</strong>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- GRN Summary -->
          <mat-card class="anim-4">
            <mat-card-header><mat-card-title>GRN Summary</mat-card-title></mat-card-header>
            <mat-card-content style="padding-top:12px!important;">
              <div class="summary-rows">
                <div class="summary-row">
                  <span>Total GRNs</span><strong>{{ stats()!.grn.total | number }}</strong>
                </div>
                <div class="summary-row">
                  <span>Pending</span>
                  <strong style="color:#d97706;">{{ stats()!.grn.pending | number }}</strong>
                </div>
                <div class="summary-row">
                  <span>Confirmed</span>
                  <strong style="color:#16a34a;">{{ stats()!.grn.confirmed | number }}</strong>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

        </div>

        <!-- Organization Table (consolidated only) -->
        @if (!selectedTenantId && tenants().length) {
          <mat-card style="margin-top:20px;">
            <mat-card-header><mat-card-title>Organization Overview</mat-card-title></mat-card-header>
            <mat-card-content style="padding:0!important;">
              <table mat-table [dataSource]="tenants()" class="full-width">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Organization</th>
                  <td mat-cell *matCellDef="let t">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="org-avatar">{{ t.name[0] }}</div>
                      <div>
                        <a class="org-link" [routerLink]="['/admin/clients', t.id]">{{ t.name }}</a>
                        <div style="font-size:11px;color:var(--text-3);">{{ t.plan }}</div>
                      </div>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="pos">
                  <th mat-header-cell *matHeaderCellDef>POs</th>
                  <td mat-cell *matCellDef="let t"><strong>{{ t.kpi.total_pos }}</strong></td>
                </ng-container>
                <ng-container matColumnDef="prs">
                  <th mat-header-cell *matHeaderCellDef>PRs</th>
                  <td mat-cell *matCellDef="let t">{{ t.kpi.total_pr }}</td>
                </ng-container>
                <ng-container matColumnDef="value">
                  <th mat-header-cell *matHeaderCellDef>PO Value</th>
                  <td mat-cell *matCellDef="let t"><strong>₹{{ t.kpi.po_value | number:'1.0-0' }}</strong></td>
                </ng-container>
                <ng-container matColumnDef="pending">
                  <th mat-header-cell *matHeaderCellDef>Pending Approvals</th>
                  <td mat-cell *matCellDef="let t">
                    @if (t.kpi.pending_approvals > 0) {
                      <span class="pending-badge">{{ t.kpi.pending_approvals }}</span>
                    } @else {
                      <span style="color:var(--text-3);">—</span>
                    }
                  </td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let t">
                    <span class="status-chip" [class.active]="t.is_active">{{ t.is_active ? 'Active' : 'Inactive' }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let t">
                    <button mat-icon-button (click)="selectedTenantId = t.id; onTenantChange()">
                      <mat-icon>bar_chart</mat-icon>
                    </button>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="tenantCols"></tr>
                <tr mat-row *matRowDef="let row; columns: tenantCols;" style="cursor:pointer;"
                    (click)="selectedTenantId = row.id; onTenantChange()"></tr>
              </table>
            </mat-card-content>
          </mat-card>
        }

      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding:28px;max-width:1400px; }
    .page-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:24px; }
    .page-header h2 { margin:0;font-size:20px;font-weight:700; }
    .page-header p  { margin:3px 0 0;font-size:13px;color:var(--text-3); }
    ::ng-deep .page-wrapper .mat-mdc-form-field-infix { padding-top:8px!important;padding-bottom:8px!important; }

    .kpi-band { display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:24px; }
    @media (max-width:1200px) { .kpi-band { grid-template-columns:repeat(3,1fr); } }
    .kpi-block { background:white;border:1px solid var(--border);border-radius:12px;padding:16px;box-shadow:var(--shadow-xs);display:flex;align-items:center;gap:12px; }
    .kpi-icon { width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .kpi-icon mat-icon { font-size:20px;width:20px;height:20px;color:white; }
    .kpi-icon--blue   { background:#2563eb; }
    .kpi-icon--orange { background:#f97316; }
    .kpi-icon--green  { background:#16a34a; }
    .kpi-icon--purple { background:#7c3aed; }
    .kpi-icon--red    { background:#dc2626; }
    .kpi-icon--teal   { background:#0891b2; }
    .kpi-val { font-size:20px;font-weight:800;color:var(--text-1);line-height:1.1; }
    .kpi-label { font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-top:2px; }

    /* ── Charts band ── */
    .charts-band { display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px; }
    @media (max-width:1024px) { .charts-band { grid-template-columns:1fr; } }
    .org-chart-card { grid-column:span 2; }
    @media (max-width:1024px) { .org-chart-card { grid-column:span 1; } }
    .chart-card { border-radius:12px !important; }
    /* Donut */
    .donut-wrap { display:flex;align-items:center;gap:20px; }
    .donut-legend { flex:1;display:flex;flex-direction:column;gap:7px; }
    .d-legend-row { display:flex;align-items:center;gap:7px;font-size:12px; }
    .d-legend-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0; }
    .d-legend-label { flex:1;color:var(--text-2); }
    .d-legend-count { font-weight:700;color:var(--text-1);min-width:20px;text-align:right; }
    /* Value bars */
    .value-bars { display:flex;flex-direction:column;gap:14px; }
    .vbar-row { display:flex;align-items:center;gap:10px; }
    .vbar-label { width:130px;font-size:12px;color:var(--text-2);display:flex;align-items:center;gap:4px;flex-shrink:0; }
    .vbar-track { flex:1;height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden; }
    .vbar-fill { height:100%;border-radius:99px;transition:width .5s cubic-bezier(.4,0,.2,1); }
    .vbar-amount { width:60px;font-size:12px;font-weight:700;color:var(--text-1);text-align:right;flex-shrink:0; }
    /* Org bars */
    .org-bars { display:flex;flex-direction:column;gap:10px; }
    .org-bar-row { display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 6px;border-radius:8px;transition:background .12s; }
    .org-bar-row:hover { background:#f8faff; }
    .org-bar-name { width:160px;font-size:12px;color:var(--text-2);display:flex;align-items:center;gap:6px;flex-shrink:0;font-weight:500; }
    .org-avatar-sm { width:20px;height:20px;border-radius:5px;background:var(--brand-light);color:var(--brand);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .org-bar-track { flex:1;height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden; }
    .org-bar-fill { height:100%;border-radius:99px;background:linear-gradient(90deg,#2563eb,#3b82f6);transition:width .5s cubic-bezier(.4,0,.2,1); }
    .org-bar-val { width:55px;font-size:12px;font-weight:700;color:#2563eb;text-align:right;flex-shrink:0; }

    .detail-grid { display:grid;grid-template-columns:1fr 1fr;gap:20px; }
    @media (max-width:1024px) { .detail-grid { grid-template-columns:1fr; } }

    /* Status bars */
    .status-bars { display:flex;flex-direction:column;gap:10px; }
    .status-bar-row { display:flex;align-items:center;gap:10px; }
    .sb-label { width:120px;font-size:12px;color:var(--text-2);flex-shrink:0; }
    .sb-track { flex:1;height:8px;background:#f1f5f9;border-radius:99px;overflow:hidden; }
    .sb-fill { height:100%;border-radius:99px;transition:width .4s ease; }
    .sb-count { width:36px;font-size:12px;font-weight:600;color:var(--text-1);text-align:right; }

    /* PR Pipeline */
    .pipeline-steps { display:flex;align-items:center;justify-content:space-between;gap:4px; }
    .step { display:flex;flex-direction:column;align-items:center;gap:4px; }
    .step-count { font-size:22px;font-weight:800;color:var(--text-1); }
    .step-count.accent { color:#d97706; }
    .step-count.blue   { color:#2563eb; }
    .step-count.green  { color:#16a34a; }
    .step-count.red    { color:#dc2626; }
    .step-label { font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em; }
    .step-arrow { font-size:20px;width:20px;height:20px;color:var(--border); }

    /* Summary rows */
    .summary-rows { display:flex;flex-direction:column;gap:10px; }
    .summary-row { display:flex;justify-content:space-between;align-items:center;font-size:13px; }
    .summary-row span { color:var(--text-2); }

    /* Org table */
    .full-width { width:100%; }
    .org-avatar { width:28px;height:28px;border-radius:7px;background:var(--brand-light);color:var(--brand);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center; }
    .org-link { font-size:13px;font-weight:600;color:var(--brand);cursor:pointer; }
    .org-link:hover { text-decoration:underline; }
    .pending-badge { background:#fee2e2;color:#dc2626;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px; }
    .status-chip { font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;background:#f1f5f9;color:#64748b; }
    .status-chip.active { background:#dcfce7;color:#16a34a; }
  `],
})
export class ZopaDashboardComponent implements OnInit {
  private http = inject(HttpClient);

  loading         = signal(true);
  stats           = signal<any>(null);
  tenants         = signal<TenantSummary[]>([]);
  selectedTenantId = 0;
  tenantCols      = ['name', 'pos', 'prs', 'value', 'pending', 'status', 'actions'];

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

  tenantValueBars = computed(() => {
    const list = this.tenants();
    if (!list.length) return [];
    const maxVal = Math.max(1, ...list.map(t => t.kpi.po_value));
    return list.map(t => ({
      id: t.id,
      name: t.name,
      value: t.kpi.po_value,
      pos: t.kpi.total_pos,
      pct: Math.min(100, (t.kpi.po_value / maxVal) * 100),
    }));
  });

  valueBarPct(val: number): number {
    const s = this.stats();
    if (!s) return 0;
    const max = Math.max(1, s.po.total_value ?? 0, s.pr.total_value ?? 0, s.invoice.total_value ?? 0);
    return Math.min(100, (val / max) * 100);
  }

  ngOnInit() {
    this.http.get<TenantSummary[]>(`${environment.apiUrl}/admin/dashboard/tenants`).subscribe({
      next: t => this.tenants.set(t),
      error: () => {},
    });
    this.loadStats();
  }

  onTenantChange() {
    this.loadStats();
  }

  loadStats() {
    this.loading.set(true);
    const url = this.selectedTenantId
      ? `${environment.apiUrl}/admin/dashboard/stats?tenant_id=${this.selectedTenantId}`
      : `${environment.apiUrl}/admin/dashboard/stats`;

    this.http.get<any>(url).subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  poStatusRows() {
    const po = this.stats()?.po;
    if (!po) return [];
    const total = po.total || 1;
    const rows = [
      { label: 'Draft',       count: po.draft ?? 0,            color: '#94a3b8' },
      { label: 'Pending Appr', count: po.pending_approvals ?? 0, color: '#f97316' },
      { label: 'Approved',    count: po.approved ?? 0,          color: '#22c55e' },
      { label: 'Released',    count: po.released ?? 0,          color: '#3b82f6' },
      { label: 'Delivered',   count: po.delivered ?? 0,         color: '#10b981' },
      { label: 'Invoiced',    count: po.invoiced ?? 0,          color: '#8b5cf6' },
      { label: 'Pmt Released', count: po.payment_released ?? 0, color: '#0891b2' },
      { label: 'Cancelled',   count: po.cancelled ?? 0,         color: '#ef4444' },
    ];
    return rows.map(r => ({ ...r, pct: Math.min(100, (r.count / total) * 100) }));
  }
}
