import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    DecimalPipe, NgTemplateOutlet, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCardModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule, MatTableModule, MatChipsModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h2>TAT Reports</h2>
          <p>Purchase order turnaround time analytics</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button mat-stroked-button (click)="export('csv')" [disabled]="loading()">
            <mat-icon>download</mat-icon> Export CSV
          </button>
          <button mat-raised-button color="primary" (click)="export('pdf')" [disabled]="loading()">
            <mat-icon>picture_as_pdf</mat-icon> Export PDF
          </button>
        </div>
      </div>

      <!-- Filters -->
      <mat-card class="filter-card no-hover" style="margin-bottom:20px;">
        <mat-card-content>
          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>From Date</mat-label>
              <input matInput [matDatepicker]="fromPicker" [(ngModel)]="fromDate" />
              <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
              <mat-datepicker #fromPicker />
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>To Date</mat-label>
              <input matInput [matDatepicker]="toPicker" [(ngModel)]="toDate" />
              <mat-datepicker-toggle matIconSuffix [for]="toPicker" />
              <mat-datepicker #toPicker />
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Cost Center</mat-label>
              <mat-select [(ngModel)]="costCenterId">
                <mat-option [value]="null">All Cost Centers</mat-option>
                @for (cc of costCenters(); track cc.id) {
                  <mat-option [value]="cc.id">{{ cc.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <button mat-raised-button color="primary" (click)="load()" [disabled]="loading()"
                    style="height:56px;margin-top:0;">
              @if (loading()) { <mat-spinner diameter="16" style="margin-right:6px;" /> }
              Apply Filter
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Summary KPIs -->
      @if (rows().length > 0) {
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Total POs</div>
            <div class="kpi-value">{{ rows().length }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg PR→PO Draft</div>
            <div class="kpi-value">{{ avg('tat_pr_to_po') }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg PR→Approval</div>
            <div class="kpi-value">{{ avg('tat_pr_to_approval') }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg PR→Release</div>
            <div class="kpi-value">{{ avg('tat_pr_to_release') }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg PR→Delivery</div>
            <div class="kpi-value">{{ avg('tat_pr_to_delivery') }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg PR→Invoice</div>
            <div class="kpi-value">{{ avg('tat_pr_to_invoice') }}</div>
          </div>
        </div>
      }

      <!-- Table -->
      <mat-card class="table-card" style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (rows().length === 0) {
            <div class="empty-state">
              <mat-icon>bar_chart</mat-icon>
              <h3>No TAT data found</h3>
              <p>Apply filters and click Apply Filter to load data.</p>
            </div>
          } @else {
            <div style="overflow-x:auto;">
              <table mat-table [dataSource]="rows()" class="full-width tat-table">

                <ng-container matColumnDef="po_number">
                  <th mat-header-cell *matHeaderCellDef>PO Number</th>
                  <td mat-cell *matCellDef="let r">
                    <strong>{{ r.po_number }}</strong>
                    <div style="font-size:11px;color:var(--text-3);">{{ r.vendor }}</div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="pr_number">
                  <th mat-header-cell *matHeaderCellDef>PR Number</th>
                  <td mat-cell *matCellDef="let r">{{ r.pr_number }}</td>
                </ng-container>

                <ng-container matColumnDef="cost_center">
                  <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                  <td mat-cell *matCellDef="let r" style="color:var(--text-2);">{{ r.cost_center }}</td>
                </ng-container>

                <ng-container matColumnDef="grand_total">
                  <th mat-header-cell *matHeaderCellDef>Amount</th>
                  <td mat-cell *matCellDef="let r"><strong>₹{{ r.grand_total | number:'1.0-0' }}</strong></td>
                </ng-container>

                <ng-container matColumnDef="tat_pr_to_po">
                  <th mat-header-cell *matHeaderCellDef>PR→PO</th>
                  <td mat-cell *matCellDef="let r">
                    <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_po}" />
                  </td>
                </ng-container>

                <ng-container matColumnDef="tat_pr_to_approval">
                  <th mat-header-cell *matHeaderCellDef>PR→Approval</th>
                  <td mat-cell *matCellDef="let r">
                    <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_approval}" />
                  </td>
                </ng-container>

                <ng-container matColumnDef="tat_pr_to_release">
                  <th mat-header-cell *matHeaderCellDef>PR→Release</th>
                  <td mat-cell *matCellDef="let r">
                    <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_release}" />
                  </td>
                </ng-container>

                <ng-container matColumnDef="tat_pr_to_delivery">
                  <th mat-header-cell *matHeaderCellDef>PR→Delivery</th>
                  <td mat-cell *matCellDef="let r">
                    <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_delivery}" />
                  </td>
                </ng-container>

                <ng-container matColumnDef="tat_pr_to_invoice">
                  <th mat-header-cell *matHeaderCellDef>PR→Invoice</th>
                  <td mat-cell *matCellDef="let r">
                    <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_invoice}" />
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let row; columns: columns;"></tr>
              </table>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <!-- TAT badge template -->
      <ng-template #tatBadge let-v="v">
        @if (v === null || v === undefined) {
          <span class="tat-na">—</span>
        } @else if (v <= 2) {
          <span class="tat-badge tat-good">{{ v }}d</span>
        } @else if (v <= 7) {
          <span class="tat-badge tat-medium">{{ v }}d</span>
        } @else {
          <span class="tat-badge tat-bad">{{ v }}d</span>
        }
      </ng-template>

    </div>
  `,
  styles: [`
    .page-wrapper { padding:28px; }
    .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px; }
    .page-header h2 { margin:0;font-size:20px;font-weight:700; }
    .page-header p  { margin:3px 0 0;font-size:13px;color:var(--text-3); }
    .filter-card { overflow:visible; }
    ::ng-deep .filter-card .mat-mdc-card-content { padding:16px 18px !important; }
    /* Filters have no hints/errors — reclaim the reserved subscript space that
       was leaving a large empty gap at the bottom of the card. */
    ::ng-deep .filter-card .mat-mdc-form-field-subscript-wrapper { display:none; }
    .filter-row { display:flex;align-items:center;gap:12px;flex-wrap:wrap; }
    .filter-field { flex:1 1 200px; min-width:180px; }
    .kpi-row { display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:20px; }
    @media (max-width:1200px) { .kpi-row { grid-template-columns:repeat(3,1fr); } }
    .kpi-card { background:white;border:1px solid var(--border);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow-xs); }
    .kpi-label { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:4px; }
    .kpi-value { font-size:20px;font-weight:800;color:var(--text-1); }
    .full-width { width:100%; }
    .tat-table .mat-mdc-cell { font-size:12px; }
    .tat-badge { display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700; }
    .tat-good   { background:#dcfce7;color:#166534; }
    .tat-medium { background:#fef9c3;color:#854d0e; }
    .tat-bad    { background:#fee2e2;color:#991b1b; }
    .tat-na     { color:var(--text-3);font-size:12px; }
    .empty-state { display:flex;flex-direction:column;align-items:center;gap:8px;padding:60px 24px;color:var(--text-3);text-align:center; }
    .empty-state mat-icon { font-size:48px;width:48px;height:48px;color:var(--border); }
    .empty-state h3 { margin:0;font-size:16px;font-weight:600;color:var(--text-2); }
    .empty-state p { margin:0;font-size:13px; }
  `],
})
export class ReportsComponent implements OnInit {
  private http = inject(HttpClient);

  columns = ['po_number', 'pr_number', 'cost_center', 'grand_total',
    'tat_pr_to_po', 'tat_pr_to_approval', 'tat_pr_to_release',
    'tat_pr_to_delivery', 'tat_pr_to_invoice'];

  costCenters = signal<any[]>([]);
  rows = signal<any[]>([]);
  loading = signal(false);

  fromDate: Date | null = null;
  toDate: Date | null = null;
  costCenterId: number | null = null;

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/cost-centers`).subscribe(r => this.costCenters.set(r.data ?? r));
    this.load();
  }

  load() {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.fromDate) params['from'] = this.fromDate.toISOString().split('T')[0];
    if (this.toDate)   params['to']   = this.toDate.toISOString().split('T')[0];
    if (this.costCenterId) params['cost_center_id'] = String(this.costCenterId);

    this.http.get<any[]>(`${environment.apiUrl}/reports/po-tat`, { params }).subscribe({
      next: r => { this.rows.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  export(type: 'csv' | 'pdf') {
    const params: Record<string, string> = { export: type };
    if (this.fromDate) params['from'] = this.fromDate.toISOString().split('T')[0];
    if (this.toDate)   params['to']   = this.toDate.toISOString().split('T')[0];
    if (this.costCenterId) params['cost_center_id'] = String(this.costCenterId);

    const qs = new URLSearchParams(params).toString();
    const token = localStorage.getItem('auth_token') ?? '';
    const url = `${environment.apiUrl}/reports/po-tat?${qs}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `tat-report.${type}`;
        a.click();
      });
  }

  avg(field: string): string {
    const vals = this.rows()
      .map(r => r[field])
      .filter((v): v is number => v !== null && v !== undefined);
    if (!vals.length) return '—';
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) + 'd';
  }
}
