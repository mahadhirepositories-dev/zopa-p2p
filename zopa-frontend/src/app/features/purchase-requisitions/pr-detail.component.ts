import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { ActivityTimelineComponent } from '../../shared/components/activity-timeline.component';
import { AuthService } from '../../core/auth/auth.service';
import { ShortClosePrDialogComponent } from './short-close-pr-dialog.component';

@Component({
  selector: 'app-pr-detail',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TitleCasePipe, RouterLink,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatCardModule, MatDividerModule, MatDialogModule,
    ActivityTimelineComponent,
  ],
  template: `
    <div class="page-wrapper">
      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:80px;">
          <mat-spinner diameter="40" />
        </div>
      } @else if (pr()) {

        <!-- Header -->
        <div class="page-header">
          <div>
            <h2>{{ pr()!.pr_number ?? ('PR #' + pr()!.id) }}</h2>
            <p>{{ pr()!.title }} · Created {{ pr()!.created_at | date:'dd MMM yyyy' }}</p>
          </div>
          <div class="header-actions">
            @if (pr()!.status === 'draft' && auth.canTransact()) {
              <button mat-stroked-button color="primary" [routerLink]="['/purchase-requisitions', pr()!.id, 'edit']" [disabled]="acting()">
                <mat-icon>edit</mat-icon> Edit PR
              </button>
              <button mat-stroked-button (click)="submit()" [disabled]="acting()">
                <mat-icon>send</mat-icon> Submit for Procurement
              </button>
            }
            @if (pr()!.status === 'submitted') {
              @if (auth.canTransact()) {
                <button mat-raised-button color="primary" (click)="rfqCreate()" [disabled]="acting()">
                  <mat-icon>request_quote</mat-icon> Create RFQ
                </button>
                <button mat-raised-button color="primary" (click)="convertToPo()" style="margin-left:4px;">
                  <mat-icon>receipt_long</mat-icon> Convert to PO
                </button>
              }
              @if (auth.isAdmin()) {
                <button mat-stroked-button (click)="reject()" style="color:#dc2626;border-color:#dc2626;margin-left:4px;">
                  <mat-icon>close</mat-icon> Reject
                </button>
              }
            }
            @if (pr()!.status === 'rfq_created' && auth.canTransact()) {
              <button mat-raised-button color="primary" (click)="rfqApprove()" [disabled]="acting()">
                <mat-icon>verified</mat-icon> Approve RFQ
              </button>
              <button mat-raised-button color="accent" (click)="convertToPo()" style="margin-left:4px;">
                <mat-icon>receipt_long</mat-icon> Convert to PO
              </button>
            }
            @if (pr()!.status === 'rfq_approved' && auth.canTransact()) {
              <button mat-raised-button color="primary" (click)="convertToPo()">
                <mat-icon>receipt_long</mat-icon> Convert to PO
              </button>
            }
            @if (pr()!.status === 'partially_converted' && auth.canTransact()) {
              <button mat-raised-button color="accent" (click)="convertToPo()">
                <mat-icon>add_shopping_cart</mat-icon> Create Additional PO
              </button>
            }            @if (!['draft', 'short_closed', 'rejected'].includes(pr()!.status ?? '') && !pr()!.status?.startsWith('short_close_pending') && auth.canTransact()) {
              <button mat-stroked-button color="warn" (click)="shortClose()" [disabled]="acting()" style="margin-left:4px;">
                <mat-icon>do_not_disturb_on</mat-icon> Short Close PR
              </button>
            }
            @if (['converted', 'partially_converted'].includes(pr()!.status ?? '')) {
              <button mat-stroked-button [routerLink]="['/purchase-orders']" [queryParams]="{pr_id: pr()!.id}">
                <mat-icon>receipt_long</mat-icon> View POs
              </button>
            }
          </div>
        </div>

        <!-- Status banner -->
        <div class="status-banner status-banner--{{ pr()!.status }}">
          <mat-icon>{{ statusIcon(pr()!.status) }}</mat-icon>
          <span>{{ statusLabel(pr()!.status) }}</span>
        </div>

        <div class="detail-grid">

          <!-- Left: Info + activity -->
          <div class="left-col">

            <mat-card class="info-card">
              <mat-card-header><mat-card-title>Requisition Info</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="info-grid">
                  <div class="info-item"><span class="info-label">PR Number</span><span>{{ pr()!.pr_number ?? '—' }}</span></div>
                  <div class="info-item"><span class="info-label">Status</span>
                    <mat-chip [class]="'status-' + pr()!.status" [highlighted]="true">{{ formatStatus(pr()!.status) }}</mat-chip>
                  </div>
                  <div class="info-item"><span class="info-label">Priority</span>
                    <span class="priority-badge priority-{{ pr()!.priority }}">{{ pr()!.priority | titlecase }}</span>
                  </div>
                  @if (pr()!.short_close_reason) {
                    <div class="info-item" style="grid-column:1/-1;background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px solid #e2e8f0;margin-top:8px;">
                      <span class="info-label" style="color:#64748b;">Short Close Reason</span>
                      <span style="font-size:13px;color:#334155;">{{ pr()!.short_close_reason }}</span>
                    </div>
                  }
                  <div class="info-item"><span class="info-label">Required By Date</span><span>{{ pr()!.required_by_date | date:'dd MMM yyyy' }}</span></div>
                  <div class="info-item"><span class="info-label">Required By Person</span><span>{{ pr()!.required_by_person ?? '—' }}</span></div>
                  <div class="info-item"><span class="info-label">Cost Center</span><span>{{ pr()!.cost_center?.name ?? '—' }}</span></div>
                  <div class="info-item"><span class="info-label">Project</span><span>{{ pr()!.project?.name ?? '—' }}</span></div>
                  <div class="info-item"><span class="info-label">Location</span><span>{{ pr()!.location?.name ?? '—' }}</span></div>
                  <div class="info-item"><span class="info-label">Requested By</span><span>{{ pr()!.requested_by?.name ?? '—' }}</span></div>
                  <div class="info-item"><span class="info-label">Submitted</span><span>{{ pr()!.submitted_at | date:'dd MMM yyyy HH:mm' }}</span></div>
                </div>

                @if (pr()!.description) {
                  <mat-divider style="margin:14px 0;" />
                  <div style="font-size:13px;color:var(--text-2);white-space:pre-line;">{{ pr()!.description }}</div>
                }
              </mat-card-content>
            </mat-card>

            <!-- Linked POs -->
            @if (allLinkedPos().length > 0) {
              <mat-card class="info-card">
                <mat-card-header>
                  <mat-card-title>Linked Purchase Orders ({{ allLinkedPos().length }})</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  @for (po of allLinkedPos(); track po.id) {
                    <div class="po-row" [routerLink]="['/purchase-orders', po.id]">
                      <mat-icon style="font-size:16px;color:var(--brand);">receipt_long</mat-icon>
                      <div>
                        <div style="font-size:13px;font-weight:600;">{{ po.po_number ?? ('PO #' + po.id) }}</div>
                        @if (po.vendor?.name) {
                          <div style="font-size:11px;color:var(--text-3);">{{ po.vendor.name }}</div>
                        }
                      </div>
                      <mat-chip [class]="'status-' + po.status" [highlighted]="true" style="margin-left:auto;font-size:10px;">{{ po.status }}</mat-chip>
                      <mat-icon style="font-size:16px;color:var(--text-3);">chevron_right</mat-icon>
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            }

            <!-- Activity Timeline -->
            <mat-card class="info-card">
              <mat-card-header><mat-card-title>Activity Log</mat-card-title></mat-card-header>
              <mat-card-content>
                <app-activity-timeline entityType="PR" [entityId]="pr()!.id" />
              </mat-card-content>
            </mat-card>

          </div>

          <!-- Right: Line Items -->
          <div class="right-col">
            <mat-card class="items-card">
              <mat-card-header><mat-card-title>Line Items</mat-card-title></mat-card-header>
              <mat-card-content style="padding:0!important;">
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>Qty Requested</th>
                      <th>Qty Converted</th>
                      <th>Conversion</th>
                      <th>Unit</th>
                      <th>Est. Price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of pr()!.items; track item.id) {
                      <tr>
                        <td>{{ item.sno }}</td>
                        <td>
                          <div style="font-weight:500;">{{ item.description }}</div>
                          @if (item.remarks) { <div style="font-size:11px;color:var(--text-3);">{{ item.remarks }}</div> }
                        </td>
                        <td>{{ item.qty }}</td>
                        <td>{{ item.converted_qty ?? 0 }}</td>
                        <td>
                          @if (+(item.converted_qty ?? 0) === 0) {
                            <span class="conv-badge conv-none">Not converted</span>
                          } @else if (+(item.converted_qty ?? 0) >= +item.qty) {
                            <span class="conv-badge conv-full">Fully converted</span>
                          } @else {
                            <span class="conv-badge conv-partial">Partial ({{ (+(item.converted_qty ?? 0) / +item.qty * 100) | number:'1.0-0' }}%)</span>
                          }
                        </td>
                        <td>{{ item.unit }}</td>
                        <td>₹{{ item.estimated_price | number:'1.0-0' }}</td>
                        <td><strong>₹{{ item.qty * item.estimated_price | number:'1.0-0' }}</strong></td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr class="total-row">
                      <td colspan="7">Estimated Total</td>
                      <td><strong>₹{{ pr()!.estimated_amount | number:'1.0-0' }}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </mat-card-content>
            </mat-card>
          </div>

        </div>
      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding:28px; }
    .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px; }
    .page-header h2 { margin:0;font-size:20px;font-weight:700; }
    .page-header p  { margin:3px 0 0;font-size:13px;color:var(--text-3); }
    .header-actions { display:flex;gap:8px;flex-wrap:wrap; }
    .status-banner { display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;margin-bottom:20px;font-size:13px;font-weight:500; }
    .status-banner mat-icon { font-size:18px;width:18px;height:18px; }
    .status-banner--draft        { background:#f1f5f9;color:#64748b; }
    .status-banner--submitted    { background:#fff7ed;color:#d97706; }
    .status-banner--rfq_created  { background:#eff6ff;color:#2563eb; }
    .status-banner--rfq_approved { background:#ecfdf5;color:#059669; }
    .status-banner--converted           { background:#f0fdf4;color:#16a34a; }
    .status-banner--partially_converted { background:#ecfdf5;color:#059669; }
    .status-banner--rejected            { background:#fff1f2;color:#dc2626; }
    .conv-badge { display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700; }
    .conv-none    { background:#f1f5f9;color:#64748b; }
    .conv-partial { background:#fff7ed;color:#d97706; }
    .conv-full    { background:#dcfce7;color:#15803d; }
    .detail-grid { display:grid;grid-template-columns:380px 1fr;gap:20px;align-items:start; }
    @media (max-width:1024px) { .detail-grid { grid-template-columns:1fr; } }
    .left-col, .right-col { display:flex;flex-direction:column;gap:16px; }
    .info-card mat-card-content { padding-top:12px!important; }
    .info-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px 16px; }
    .info-item { display:flex;flex-direction:column;gap:2px; }
    .info-label { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3); }
    .info-item span:last-child { font-size:13px;color:var(--text-1); }
    .priority-badge { display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600; }
    .priority-low    { background:#f1f5f9;color:#64748b; }
    .priority-normal { background:#eff6ff;color:#2563eb; }
    .priority-high   { background:#fff7ed;color:#d97706; }
    .priority-urgent { background:#fff1f2;color:#dc2626; }
    .po-row { display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;cursor:pointer;transition:background .15s;border-bottom:1px solid var(--border); }
    .po-row:last-child { border-bottom:none; }
    .po-row:hover { background:var(--brand-light); }
    .items-table { width:100%;border-collapse:collapse; }
    .items-table th { background:#f8fafc;color:var(--text-3);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:8px 16px;border-bottom:1px solid var(--border);text-align:left; }
    .items-table td { padding:10px 16px;font-size:13px;color:var(--text-1);border-bottom:1px solid var(--border); }
    .items-table tbody tr:last-child td { border-bottom:none; }
    .total-row td { font-size:13px;font-weight:600;color:var(--text-1);background:#f8fafc;padding:10px 16px;border-top:2px solid var(--border); }
  `],
})
export class PrDetailComponent implements OnInit {
  private http   = inject(HttpClient);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotificationService);
  readonly auth  = inject(AuthService);
  private dialog = inject(MatDialog);

  pr      = signal<any>(null);
  loading = signal(true);
  acting  = signal(false);

  /** Merged de-duplicated list of all POs linked to this PR
   *  Laravel serialises relation names as snake_case in JSON:
   *  purchaseOrders → purchase_orders, linkedPurchaseOrders → linked_purchase_orders
   */
  allLinkedPos = computed(() => {
    const p = this.pr();
    if (!p) return [];
    const direct  : any[] = p['purchase_orders']        ?? p['purchaseOrders']        ?? [];
    const pivoted  : any[] = p['linked_purchase_orders'] ?? p['linkedPurchaseOrders'] ?? [];
    const seen = new Set<number>();
    return [...direct, ...pivoted].filter(po => {
      if (seen.has(po.id)) return false;
      seen.add(po.id);
      return true;
    });
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<any>(`${environment.apiUrl}/purchase-requisitions/${id}`).subscribe({
      next: r => { this.pr.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  submit() {
    this.acting.set(true);
    this.http.post(`${environment.apiUrl}/purchase-requisitions/${this.pr()!.id}/submit`, {}).subscribe({
      next: r => { this.pr.set(r); this.acting.set(false); this.notify.success('PR submitted'); },
      error: e => { this.notify.error(e.error?.error ?? 'Submit failed'); this.acting.set(false); },
    });
  }

  rfqCreate() {
    this.acting.set(true);
    this.http.post(`${environment.apiUrl}/purchase-requisitions/${this.pr()!.id}/rfq-create`, {}).subscribe({
      next: r => { this.pr.set(r); this.acting.set(false); this.notify.success('RFQ Created'); },
      error: e => { this.notify.error(e.error?.error ?? 'Action failed'); this.acting.set(false); },
    });
  }

  rfqApprove() {
    this.acting.set(true);
    this.http.post(`${environment.apiUrl}/purchase-requisitions/${this.pr()!.id}/rfq-approve`, {}).subscribe({
      next: r => { this.pr.set(r); this.acting.set(false); this.notify.success('RFQ Approved'); },
      error: e => { this.notify.error(e.error?.error ?? 'Action failed'); this.acting.set(false); },
    });
  }

  convertToPo() {
    this.router.navigate(['/purchase-orders/create'], {
      queryParams: { pr_id: this.pr()!.id },
    });
  }

  reject() {
    this.acting.set(true);
    this.http.post(`${environment.apiUrl}/purchase-requisitions/${this.pr()!.id}/reject`, {}).subscribe({
      next: r => { this.pr.set(r); this.acting.set(false); this.notify.success('PR rejected'); },
      error: e => { this.notify.error(e.error?.error ?? 'Action failed'); this.acting.set(false); },
    });
  }

  shortClose() {
    const ref = this.dialog.open(ShortClosePrDialogComponent, {
      width: '480px',
    });

    ref.afterClosed().subscribe(res => {
      if (!res?.reason) return;
      this.acting.set(true);
      this.http.post<any>(`${environment.apiUrl}/purchase-requisitions/${this.pr()!.id}/short-close`, { reason: res.reason }).subscribe({
        next: r => {
          this.pr.set(r);
          this.acting.set(false);
          this.notify.success(r.status === 'short_closed' ? 'PR short-closed.' : 'Short close request submitted for approval.');
        },
        error: e => {
          this.notify.error(e.error?.error ?? 'Short close failed.');
          this.acting.set(false);
        }
      });
    });
  }

  statusIcon(s: string): string {
    const map: Record<string, string> = {
      draft: 'edit_note', submitted: 'pending_actions',
      rfq_created: 'request_quote', rfq_approved: 'verified',
      converted: 'check_circle', partially_converted: 'incomplete_circle', rejected: 'cancel',
      short_closed: 'do_not_disturb_on',
    };
    if (s?.startsWith('short_close_pending')) return 'pending_actions';
    return map[s] ?? 'info';
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      draft: 'Draft — not yet submitted',
      submitted: 'Submitted — awaiting buyer action',
      rfq_created: 'RFQ Created — quotation sent to vendors',
      rfq_approved: 'RFQ Approved — ready for PO conversion',
      converted: 'Converted to Purchase Order',
      partially_converted: 'Partially Converted — some items still pending PO',
      rejected: 'Rejected',
      short_closed: 'Short Closed — remaining quantities closed',
    };
    if (s?.startsWith('short_close_pending')) return 'Short Close Pending Approval';
    return map[s] ?? s;
  }

  formatStatus(s: string): string {
    const map: Record<string, string> = {
      draft: 'Draft', submitted: 'Submitted',
      partially_converted: 'Partial',
      rfq_created: 'RFQ Created', rfq_approved: 'RFQ Approved',
      converted: 'Converted', rejected: 'Rejected',
      short_closed: 'Short Closed',
    };
    if (s?.startsWith('short_close_pending')) return 'Short Close Pending';
    return map[s] ?? s;
  }
}
