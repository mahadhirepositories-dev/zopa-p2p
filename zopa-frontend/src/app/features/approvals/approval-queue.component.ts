import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DecimalPipe, LowerCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { ExportService } from '../../core/services/export.service';
import { ApprovalActionDialogComponent } from './approval-action-dialog.component';

@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [
    DecimalPipe, LowerCasePipe,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatDialogModule, MatTooltipModule, MatCardModule,
  ],
  template: `
    <div class="page-wrapper">

      <div class="page-header">
        <div>
          <h2>Pending Approvals</h2>
          <p>{{ approvals().length }} item{{ approvals().length !== 1 ? 's' : '' }} awaiting your decision</p>
        </div>
        <button mat-stroked-button (click)="exportData()">
          <mat-icon>download</mat-icon> Export
        </button>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="36" />
          <span>Loading approvals…</span>
        </div>

      } @else if (approvals().length === 0) {
        <div class="empty-card">
          <div class="empty-icon">
            <mat-icon>task_alt</mat-icon>
          </div>
          <h3>All caught up!</h3>
          <p>There are no pending approvals for you at this time.</p>
        </div>

      } @else {
        <div class="approval-list">
          @for (a of approvals(); track a.id) {
            <div class="approval-card">
              <!-- Left: entity info -->
              <div class="approval-info">
                <div class="approval-po-ref">
                  <div class="po-icon-wrap" [style.background]="entityBg(a)">
                    <mat-icon [style.color]="entityColor(a)">{{ entityIcon(a) }}</mat-icon>
                  </div>
                  <div>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span class="type-badge type-badge--{{ a.entity_type | lowercase }}">{{ a.entity_type }}</span>
                      <a class="po-link" (click)="viewEntity(a)">{{ entityRef(a) }}</a>
                    </div>
                    <div class="po-meta">{{ entityMeta(a) }}</div>
                  </div>
                </div>
              </div>

              <!-- Center: Amount + Level -->
              <div class="approval-metrics">
                <div class="metric">
                  <div class="metric-label">Amount</div>
                  <div class="metric-value">₹{{ entityAmount(a) | number:'1.0-0' }}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">Level</div>
                  <div class="level-badge">L{{ a.level }}</div>
                </div>
              </div>

              <!-- Right: Actions -->
              <div class="approval-actions">
                <button mat-raised-button color="primary" class="approve-btn"
                        [disabled]="!!acting().get(a.id)"
                        (click)="approve(a)">
                  @if (acting().get(a.id) === 'approve') {
                    <mat-spinner diameter="16" />
                  } @else {
                    <ng-container>
                      <mat-icon>check</mat-icon>&nbsp;Approve
                    </ng-container>
                  }
                </button>
                <button mat-stroked-button class="return-btn"
                        [disabled]="!!acting().get(a.id)"
                        (click)="openDialog(a, 'return')"
                        matTooltip="Return for revision">
                  <mat-icon>undo</mat-icon> Return
                </button>
                <button mat-stroked-button color="warn" class="reject-btn"
                        [disabled]="!!acting().get(a.id)"
                        (click)="openDialog(a, 'reject')"
                        matTooltip="Reject">
                  <mat-icon>close</mat-icon> Reject
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Admin oversight: all pending approvals across the org (read-only) -->
      @if (auth.isAdmin() && !loading()) {
        <div class="admin-section">
          <div class="admin-header">
            <div>
              <h3>Organisation-wide pending approvals</h3>
              <p>Read-only oversight — {{ allPending().length }} awaiting across all approvers</p>
            </div>
            <span class="oversight-badge"><mat-icon>visibility</mat-icon> Oversight</span>
          </div>

          @if (loadingAll()) {
            <div class="loading-state"><mat-spinner diameter="28" /></div>
          } @else if (allPending().length === 0) {
            <div class="admin-empty">No pending approvals anywhere in the organisation.</div>
          } @else {
            <div class="approval-list">
              @for (a of allPending(); track a.id) {
                <div class="approval-card readonly">
                  <div class="approval-info">
                    <div class="approval-po-ref">
                      <div class="po-icon-wrap" [style.background]="entityBg(a)">
                        <mat-icon [style.color]="entityColor(a)">{{ entityIcon(a) }}</mat-icon>
                      </div>
                      <div>
                        <div style="display:flex;align-items:center;gap:6px;">
                          <span class="type-badge type-badge--{{ a.entity_type | lowercase }}">{{ a.entity_type }}</span>
                          <a class="po-link" (click)="viewEntity(a)">{{ entityRef(a) }}</a>
                        </div>
                        <div class="po-meta">{{ entityMeta(a) }}</div>
                      </div>
                    </div>
                  </div>
                  <div class="approval-metrics">
                    <div class="metric">
                      <div class="metric-label">Amount</div>
                      <div class="metric-value">₹{{ entityAmount(a) | number:'1.0-0' }}</div>
                    </div>
                    <div class="metric">
                      <div class="metric-label">Level</div>
                      <div class="level-badge">L{{ a.level }}</div>
                    </div>
                  </div>
                  <div class="awaiting-col" style="display:flex;align-items:center;gap:12px;">
                    <div>
                      <div class="metric-label">Awaiting</div>
                      <div class="awaiting-name">
                        <span class="approver-chip">{{ a.assigned_to?.name?.[0] ?? '?' }}</span>
                        {{ a.assigned_to?.name ?? '—' }}
                      </div>
                    </div>
                    <button mat-stroked-button color="primary" type="button" (click)="resendEmail(a, $event)" style="font-size:11px;height:30px;line-height:28px;padding:0 8px;margin-left:auto;">
                      <mat-icon style="font-size:14px;width:14px;height:14px;margin-right:2px;">mail</mat-icon> Resend Email
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .page-header h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .page-header p  { margin: 3px 0 0; font-size: 13px; color: var(--text-3); }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 80px;
      color: var(--text-3);
    }

    .empty-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 60px 24px;
      text-align: center;
    }
    .empty-icon {
      width: 64px;
      height: 64px;
      background: #f0fdf4;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .empty-icon mat-icon { font-size: 32px; width: 32px; height: 32px; color: #16a34a; }
    .empty-card h3 { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: var(--text-1); }
    .empty-card p  { margin: 0; font-size: 13px; color: var(--text-3); }

    .approval-list { display: flex; flex-direction: column; gap: 12px; }

    .approval-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 24px;
      box-shadow: var(--shadow-xs);
      transition: box-shadow 0.2s ease, transform 0.15s ease;
    }
    .approval-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }

    .approval-info { flex: 1; min-width: 0; }
    .approval-po-ref { display: flex; align-items: center; gap: 12px; }
    .po-icon-wrap {
      width: 40px;
      height: 40px;
      background: var(--brand-light);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .po-icon-wrap mat-icon { color: var(--brand); font-size: 20px; width: 20px; height: 20px; }
    .po-link {
      font-size: 14px;
      font-weight: 700;
      color: var(--brand);
      cursor: pointer;
    }
    .po-link:hover { text-decoration: underline; }
    .po-meta { font-size: 12px; color: var(--text-3); margin-top: 2px; }

    .approval-metrics { display: flex; gap: 28px; flex-shrink: 0; }
    .metric { text-align: center; }
    .metric-label { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; margin-bottom: 4px; }
    .metric-value { font-size: 16px; font-weight: 700; color: var(--text-1); }
    .level-badge {
      background: var(--brand-light);
      color: var(--brand);
      font-size: 13px;
      font-weight: 700;
      padding: 3px 12px;
      border-radius: 99px;
      display: inline-block;
    }

    .approval-actions { display: flex; gap: 8px; flex-shrink: 0; align-items: center; }
    .approve-btn {
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      height: 36px !important;
    }
    .approve-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .return-btn, .reject-btn {
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      height: 36px !important;
      font-size: 12px !important;
    }
    .return-btn mat-icon, .reject-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .type-badge { display:inline-block;padding:1px 6px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.04em; }
    .type-badge--po { background:var(--brand-light);color:var(--brand); }
    .type-badge--invoice { background:#f0fdf4;color:#16a34a; }
    .type-badge--pr { background:#eff6ff;color:#2563eb; }

    .admin-section { margin-top: 40px; padding-top: 24px; border-top: 1px dashed var(--border); }
    .admin-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .admin-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-1); }
    .admin-header p  { margin: 3px 0 0; font-size: 12px; color: var(--text-3); }
    .oversight-badge { display: inline-flex; align-items: center; gap: 4px; background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; }
    .oversight-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .admin-empty { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 28px; text-align: center; font-size: 13px; color: var(--text-3); }
    .approval-card.readonly { cursor: default; }
    .approval-card.readonly:hover { box-shadow: var(--shadow-xs); transform: none; }
    .awaiting-col { flex-shrink: 0; text-align: right; min-width: 140px; }
    .awaiting-name { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--text-2); margin-top: 4px; }
    .approver-chip { width: 24px; height: 24px; border-radius: 6px; background: var(--brand-light); color: var(--brand); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; text-transform: uppercase; }

    /* ── Mobile responsiveness for approvals ── */
    @media (max-width: 768px) {
      .page-wrapper {
        padding: 16px !important;
      }
      .page-header {
        flex-direction: column;
        gap: 12px;
        align-items: stretch !important;
      }
      .approval-card {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
        padding: 16px;
      }
      .approval-po-ref {
        align-items: flex-start;
      }
      .approval-metrics {
        justify-content: space-between;
        border-top: 1px dashed var(--border);
        border-bottom: 1px dashed var(--border);
        padding: 12px 0;
        gap: 16px;
      }
      .metric {
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .metric-label {
        margin-bottom: 0;
      }
      .awaiting-col {
        text-align: left;
        min-width: 0;
      }
      .awaiting-name {
        margin-top: 2px;
      }
      .approval-actions {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .approval-actions button {
        width: 100%;
        margin: 0 !important;
      }
    }
  `],
})
export class ApprovalQueueComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  private exportService = inject(ExportService);
  readonly auth = inject(AuthService);

  approvals = signal<any[]>([]);
  allPending = signal<any[]>([]);
  loading = signal(true);
  loadingAll = signal(false);
  acting = signal<Map<number, string>>(new Map());

  ngOnInit() {
    this.load();
    if (this.auth.isAdmin()) this.loadAllPending();
  }

  load() {
    this.loading.set(true);
    this.http.get<any>(`${environment.apiUrl}/approvals/pending?per_page=500`).subscribe({
      next: res => { this.approvals.set(res.data ?? res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /** Admin-only: all pending approvals across the org (read-only oversight). */
  loadAllPending() {
    this.loadingAll.set(true);
    this.http.get<any>(`${environment.apiUrl}/approvals/all-pending?per_page=500`).subscribe({
      next: res => { this.allPending.set(res.data ?? res); this.loadingAll.set(false); },
      error: () => this.loadingAll.set(false),
    });
  }

  viewEntity(a: any) {
    if (a.entity_type === 'INVOICE') {
      this.router.navigate(['/invoices', a.entity_id]);
    } else if (a.entity_type === 'PR') {
      this.router.navigate(['/purchase-requisitions', a.entity_id]);
    } else {
      this.router.navigate(['/purchase-orders', a.entity_id]);
    }
  }

  entityRef(a: any): string {
    if (a.entity_type === 'INVOICE') return a.invoice?.invoice_number ?? ('Invoice #' + a.entity_id);
    if (a.entity_type === 'PR') return a.purchaseRequisition?.pr_number ?? a.purchase_requisition?.pr_number ?? ('PR #' + a.entity_id);
    return a.purchase_order?.po_number ?? ('PO #' + a.entity_id);
  }

  entityMeta(a: any): string {
    if (a.entity_type === 'INVOICE') {
      const po = a.invoice?.purchase_order;
      return [po?.po_number, po?.vendor?.name].filter(Boolean).join(' · ') || '—';
    }
    if (a.entity_type === 'PR') {
      return a.purchaseRequisition?.title ?? a.purchase_requisition?.title ?? '—';
    }
    return [a.purchase_order?.vendor?.name, a.purchase_order?.cost_center?.name].filter(Boolean).join(' · ') || '—';
  }

  entityAmount(a: any): number {
    if (a.entity_type === 'INVOICE') return a.invoice?.amount ?? 0;
    if (a.entity_type === 'PR') return a.purchaseRequisition?.estimated_amount ?? a.purchase_requisition?.estimated_amount ?? 0;
    return a.purchase_order?.grand_total ?? 0;
  }

  entityIcon(a: any): string {
    if (a.entity_type === 'INVOICE') return 'request_quote';
    if (a.entity_type === 'PR') return 'description';
    return 'receipt_long';
  }

  entityBg(a: any): string {
    if (a.entity_type === 'INVOICE') return '#f0fdf4';
    if (a.entity_type === 'PR') return '#eff6ff';
    return 'var(--brand-light)';
  }

  entityColor(a: any): string {
    if (a.entity_type === 'INVOICE') return '#16a34a';
    if (a.entity_type === 'PR') return '#2563eb';
    return 'var(--brand)';
  }

  resendEmail(a: any, event?: Event) {
    if (event) event.stopPropagation();
    this.http.post<any>(`${environment.apiUrl}/approvals/${a.id}/resend-email`, {}).subscribe({
      next: (res) => this.notify.success(res.message || 'Approval email resent successfully.'),
      error: (err) => this.notify.error(err.error?.error || 'Could not resend approval email.'),
    });
  }

  viewPo(entityId: number) {
    this.router.navigate(['/purchase-orders', entityId]);
  }

  setActing(id: number, action: string | null) {
    const map = new Map(this.acting());
    if (action) map.set(id, action); else map.delete(id);
    this.acting.set(map);
  }

  approve(a: any) {
    this.setActing(a.id, 'approve');
    this.http.post(`${environment.apiUrl}/approvals/${a.id}/approve`, {}).subscribe({
      next: () => {
        this.notify.success('PO approved successfully.');
        this.approvals.update(list => list.filter(x => x.id !== a.id));
        this.setActing(a.id, null);
        if (this.auth.isAdmin()) this.loadAllPending();
      },
      error: err => {
        this.notify.error(err.error?.message ?? 'Approval failed.');
        this.setActing(a.id, null);
      },
    });
  }

  openDialog(a: any, action: 'return' | 'reject') {
    const label = action === 'return' ? 'Return for Revision' : 'Reject PO';
    const ref = this.dialog.open(ApprovalActionDialogComponent, {
      width: '460px',
      data: { label, action },
    });
    ref.afterClosed().subscribe((comments: string | undefined) => {
      if (comments === undefined) return;
      this.setActing(a.id, action);
      const endpoint = action === 'return' ? 'return' : 'reject';
      this.http.post(`${environment.apiUrl}/approvals/${a.id}/${endpoint}`, { comments }).subscribe({
        next: () => {
          this.notify.success(`PO ${action === 'return' ? 'returned for revision' : 'rejected'}.`);
          this.approvals.update(list => list.filter(x => x.id !== a.id));
          this.setActing(a.id, null);
          if (this.auth.isAdmin()) this.loadAllPending();
        },
        error: err => {
          this.notify.error(err.error?.message ?? 'Action failed.');
          this.setActing(a.id, null);
        },
      });
    });
  }

  exportData() {
    this.exportService.export('approvals/export');
  }
}
