import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ExportService } from '../../core/services/export.service';

@Component({
  selector: 'app-grn-list',
  standalone: true,
  imports: [
    DatePipe, RouterLink,
    MatTableModule, MatButtonModule, MatChipsModule,
    MatIconModule, MatProgressSpinnerModule, MatCardModule,
    MatPaginatorModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h2>Goods Received Notes</h2>
          <p>{{ grns().length }} receipt{{ grns().length !== 1 ? 's' : '' }}</p>
        </div>
        <div style="display: flex; gap: 12px;">
          <button mat-stroked-button (click)="exportData()">
            <mat-icon>download</mat-icon> Export
          </button>
          @if (auth.canDo('grns','create')) {
            <button mat-raised-button color="primary" routerLink="create" class="cta-btn">
              <mat-icon>add</mat-icon> New GRN
            </button>
          }
        </div>
      </div>

      <mat-card style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (grns().length === 0) {
            <div class="empty-state">
              <mat-icon>inventory_2</mat-icon>
              <h3>No GRNs yet</h3>
              <p>Create a GRN when goods arrive against a released PO.</p>
              @if (auth.canDo('grns','create')) {
                <button mat-raised-button color="primary" routerLink="create">
                  <mat-icon>add</mat-icon> Create GRN
                </button>
              }
            </div>
          } @else {
            <div class="table-responsive">
              <table mat-table [dataSource]="paginatedGrns()" class="full-width">

              <ng-container matColumnDef="grn_number">
                <th mat-header-cell *matHeaderCellDef>GRN Number</th>
                <td mat-cell *matCellDef="let g">
                  <div class="ref-cell">
                    <div class="ref-icon"><mat-icon>inventory_2</mat-icon></div>
                    <strong>{{ g.grn_number }}</strong>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="po">
                <th mat-header-cell *matHeaderCellDef>PO Reference</th>
                <td mat-cell *matCellDef="let g" style="color:var(--brand);font-weight:600;">
                  {{ g.purchase_order?.po_number ?? '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="received_date">
                <th mat-header-cell *matHeaderCellDef>Received Date</th>
                <td mat-cell *matCellDef="let g">{{ g.received_date | date:'dd MMM yyyy' }}</td>
              </ng-container>

              <ng-container matColumnDef="received_by">
                <th mat-header-cell *matHeaderCellDef>Received By</th>
                <td mat-cell *matCellDef="let g">
                  <div class="user-cell">
                    <div class="user-chip">{{ g.received_by?.name?.[0] }}</div>
                    {{ g.received_by?.name ?? '—' }}
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let g">
                  <span class="status-badge" [class]="'badge-' + (g.status || 'confirmed')">
                    {{ getStatusLabel(g) }}
                  </span>

                </td>
              </ng-container>


              <ng-container matColumnDef="arrow">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef><mat-icon class="row-arrow">chevron_right</mat-icon></td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"
                  class="clickable-row" (click)="view(row.id)"></tr>
              </table>
            </div>

            <mat-paginator [length]="grns().length"
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
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .page-header h2 { margin:0; font-size:20px; font-weight:700; }
    .page-header p  { margin:3px 0 0; font-size:13px; color:var(--text-3); }
    .cta-btn { height:40px!important; }
    .full-width { width:100%; }
    .clickable-row { cursor:pointer; }
    .ref-cell { display:flex; align-items:center; gap:10px; }
    .ref-icon {
      width:32px; height:32px;
      background:#f0fdf4; border-radius:8px;
      display:flex; align-items:center; justify-content:center;
    }
    .ref-icon mat-icon { font-size:16px; width:16px; height:16px; color:#16a34a; }
    .user-cell { display:flex; align-items:center; gap:8px; font-size:13px; }
    .user-chip {
      width:26px; height:26px; border-radius:6px;
      background:#eff6ff; color:#2563eb;
      font-size:11px; font-weight:700;
      display:flex; align-items:center; justify-content:center;
    }
    .row-arrow { color:var(--text-3); font-size:18px; }
    .empty-state {
      display:flex; flex-direction:column; align-items:center;
      gap:8px; padding:60px 24px; text-align:center;
    }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; color:var(--border); }
    .empty-state h3 { margin:0; font-size:16px; font-weight:600; color:var(--text-2); }
    .status-badge {
      display: inline-flex; align-items: center;
      padding: 3px 10px; border-radius: 99px;
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .badge-confirmed { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-pending   { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-rejected  { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
    .badge-draft     { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

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
    }
  `],
})
export class GrnListComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  private exportService = inject(ExportService);
  columns = ['grn_number', 'po', 'received_date', 'received_by', 'status', 'arrow'];
  grns = signal<any[]>([]);
  loading = signal(true);

  pageIndex = signal(0);
  pageSize = signal(20);

  paginatedGrns = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.grns().slice(start, start + this.pageSize());
  });

  getStatusLabel(g: any): string {
    const status = typeof g === 'string' ? g : g?.status;
    if (status === 'confirmed') {
      const isPartial = (g.items || []).some((i: any) => +i.accepted_qty < +(i.po_item?.qty || 0));
      return isPartial ? 'Partial GRN Captured' : 'GRN Captured';
    }
    if (status === 'pending') return 'Pending GRN';
    if (status === 'rejected') return 'Rejected';
    if (status === 'draft') return 'Draft GRN';
    return status ? String(status).toUpperCase() : 'UNKNOWN';
  }


  ngOnInit() {

    this.http.get<any>(`${environment.apiUrl}/grns?per_page=500`).subscribe({
      next: res => { this.grns.set(res.data ?? res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
  view(id: number) { this.router.navigate(['/grns', id]); }

  exportData() {
    this.exportService.export('grns/export');
  }
}
