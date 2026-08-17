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
import { MatMenuModule } from '@angular/material/menu';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { ActivityTimelineComponent } from '../../shared/components/activity-timeline.component';
import { AuthService } from '../../core/auth/auth.service';
import { ShortClosePrDialogComponent } from './short-close-pr-dialog.component';
import { RequestClarificationDialogComponent } from './request-clarification-dialog.component';
import { ProvideClarificationDialogComponent } from './provide-clarification-dialog.component';

@Component({
  selector: 'app-pr-detail',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TitleCasePipe, RouterLink,
    MatButtonModule, MatIconModule, MatChipsModule, MatMenuModule,
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
          <div class="header-left">
            <button mat-icon-button routerLink="/purchase-requisitions" class="back-btn" matTooltip="Back to Requisitions"><mat-icon>arrow_back</mat-icon></button>
            <div>
              <div class="title-row">
                <h2>{{ pr()!.pr_number ?? ('PR #' + pr()!.id) }}</h2>
                <span class="status-pill" [class]="'status-pill--' + (pr()!.status || 'draft')">
                  <mat-icon>{{ statusIcon(pr()!.status) }}</mat-icon>
                  {{ formatStatus(pr()!) }}
                </span>
              </div>
              <p class="subtitle">{{ pr()!.title }} · Created {{ pr()!.created_at | date:'dd MMM yyyy' }}</p>
            </div>
          </div>

          <div class="header-actions">
            @if (['converted', 'partially_converted'].includes(pr()!.status ?? '') || isPrConverted(pr()!)) {
              <button mat-stroked-button class="btn-compact" [routerLink]="['/purchase-orders']" [queryParams]="{pr_id: pr()!.id}">
                <mat-icon>receipt_long</mat-icon> View POs
              </button>
            }

            @if (pr()!.status === 'draft' && auth.canTransact()) {
              <button mat-stroked-button class="btn-compact" [routerLink]="['/purchase-requisitions', pr()!.id, 'edit']" [disabled]="acting()">
                <mat-icon>edit</mat-icon> Edit PR
              </button>
              <button mat-raised-button color="primary" class="btn-compact" (click)="submit()" [disabled]="acting()">
                <mat-icon>send</mat-icon> Submit for Procurement
              </button>
            }

            @if (pr()!.status === 'submitted' && auth.canTransact()) {
              <button mat-stroked-button class="btn-compact" (click)="rfqCreate()" [disabled]="acting()">
                <mat-icon>request_quote</mat-icon> Create RFQ
              </button>
              <button mat-raised-button color="primary" class="btn-compact" (click)="convertToPo()">
                <mat-icon>receipt_long</mat-icon> Convert to PO
              </button>
            }

            @if (pr()!.status === 'rfq_created' && auth.canTransact()) {
              <button mat-stroked-button class="btn-compact" (click)="rfqApprove()" [disabled]="acting()">
                <mat-icon>verified</mat-icon> Approve RFQ
              </button>
              <button mat-raised-button color="primary" class="btn-compact" (click)="convertToPo()">
                <mat-icon>receipt_long</mat-icon> Convert to PO
              </button>
            }

            @if (pr()!.status === 'rfq_approved' && auth.canTransact()) {
              <button mat-raised-button color="primary" class="btn-compact" (click)="convertToPo()">
                <mat-icon>receipt_long</mat-icon> Convert to PO
              </button>
            }

            @if (pr()!.status === 'partially_converted' && auth.canTransact()) {
              <button mat-raised-button color="primary" class="btn-compact" (click)="convertToPo()">
                <mat-icon>add_shopping_cart</mat-icon> Create Additional PO
              </button>
            }

            @if (pr()!.status === 'needs_clarification') {
              <button mat-raised-button color="primary" class="btn-compact" (click)="provideClarification()" style="background:linear-gradient(135deg, #0284c7, #0369a1);color:#ffffff;">
                <mat-icon>mark_chat_read</mat-icon> Provide Clarification
              </button>
              <button mat-stroked-button class="btn-compact" [routerLink]="['/purchase-requisitions', pr()!.id, 'edit']">
                <mat-icon>edit</mat-icon> Edit PR
              </button>
            }

            @if (hasMoreActions()) {
              <button mat-icon-button [matMenuTriggerFor]="moreMenu" matTooltip="More Actions" class="more-btn">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #moreMenu="matMenu">
                @if (!['draft', 'short_closed', 'rejected', 'needs_clarification'].includes(pr()!.status ?? '') && !pr()!.status?.startsWith('short_close_pending') && auth.canTransact()) {
                  <button mat-menu-item (click)="requestClarification()" [disabled]="acting()">
                    <mat-icon>help_outline</mat-icon>
                    <span>Request Clarification</span>
                  </button>
                  <button mat-menu-item (click)="shortClose()" [disabled]="acting()">
                    <mat-icon>do_not_disturb_on</mat-icon>
                    <span>Short Close PR</span>
                  </button>
                }
                @if (pr()!.status === 'submitted' && auth.isAdmin()) {
                  <button mat-menu-item (click)="reject()">
                    <mat-icon style="color:#dc2626;">close</mat-icon>
                    <span style="color:#dc2626;">Reject PR</span>
                  </button>
                }
                @if (pr()!.status === 'draft' && (auth.canTransact() || auth.canDo('purchase_requisitions', 'delete'))) {
                  <button mat-menu-item (click)="deletePr()" [disabled]="acting()">
                    <mat-icon style="color:#dc2626;">delete</mat-icon>
                    <span style="color:#dc2626;">Delete Draft</span>
                  </button>
                }
              </mat-menu>
            }
          </div>
        </div>

        <!-- Needs Clarification Alert Banner -->
        @if (pr()!.status === 'needs_clarification') {
          <div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 2px 8px rgba(217,119,6,0.08);">
            <div style="display:flex;align-items:center;gap:12px;">
              <mat-icon style="color:#d97706;font-size:28px;width:28px;height:28px;">warning_amber</mat-icon>
              <div>
                <strong style="color:#92400e;font-size:14px;display:block;">Action Required: Clarification Requested by Buyer</strong>
                <span style="color:#78350f;font-size:13px;">
                  "{{ pr()!.clarifications?.[0]?.request_notes || 'Please provide updated specifications or details requested by procurement.' }}"
                </span>
              </div>
            </div>
            <button mat-raised-button (click)="provideClarification()" style="background:#d97706;color:#ffffff;font-weight:600;white-space:nowrap;">
              <mat-icon style="margin-right:4px;">mark_chat_read</mat-icon> Respond &amp; Provide Clarification
            </button>
          </div>
        }

        <!-- Status banner -->
        <div class="status-banner status-banner--{{ pr()!.status }}" [class.converted-short-closed]="isPrConverted(pr()!) && (pr()!.status === 'short_closed' || pr()!.status?.startsWith('short_close_pending'))">
          <mat-icon>{{ statusIcon(pr()!.status) }}</mat-icon>
          <span>{{ statusLabel(pr()!) }}</span>
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
                    <mat-chip [class]="'status-' + (isPrConverted(pr()!) && pr()!.status === 'short_closed' ? 'converted_short_closed' : pr()!.status)" [highlighted]="true">{{ formatStatus(pr()!) }}</mat-chip>
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


            <!-- Clarification History Log -->
            @if (pr()!.clarifications?.length) {
              <mat-card class="info-card" style="border-left:4px solid #d97706;">
                <mat-card-header>
                  <mat-card-title style="display:flex;align-items:center;gap:8px;color:#92400e;">
                    <mat-icon style="color:#d97706;font-size:20px;width:20px;height:20px;">chat_bubble_outline</mat-icon>
                    Clarification History Log ({{ pr()!.clarifications!.length }})
                  </mat-card-title>
                </mat-card-header>
                <mat-card-content style="padding-top:8px!important;">
                  @for (c of pr()!.clarifications; track c.id; let i = $index) {
                    <div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:12px;margin-bottom:12px;">
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:12px;font-weight:700;color:#d97706;">
                          Query #{{ pr()!.clarifications!.length - i }} by {{ c.requester?.name || 'Buyer' }}
                        </span>
                        <span style="font-size:11px;color:#92400e;">
                          {{ c.requested_at | date:'dd MMM yyyy HH:mm' }}
                        </span>
                      </div>
                      <div style="font-size:13px;color:#1e293b;margin-bottom:8px;white-space:pre-line;">
                        "{{ c.request_notes }}"
                      </div>

                      @if (c.request_attachments?.length) {
                        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;margin-bottom:8px;">
                          @for (att of c.request_attachments; track att.file_path) {
                            <a (click)="downloadClarificationAttachment(att)" style="display:inline-flex;align-items:center;gap:4px;background:#fff;border:1px solid #fed7aa;border-radius:6px;padding:3px 8px;font-size:11.5px;color:#c2410c;cursor:pointer;text-decoration:none;">
                              <mat-icon style="font-size:14px;width:14px;height:14px;">attach_file</mat-icon>
                              {{ att.original_name || att.name }}
                              @if (att.size) { <span style="color:#94a3b8;font-size:10px;">({{ att.size / 1024 | number:'1.0-0' }} KB)</span> }
                            </a>
                          }
                        </div>
                      }

                      @if (c.status === 'resolved' && c.response_notes) {
                        <div style="background:#ffffff;border-left:3px solid #0284c7;padding:8px 12px;border-radius:4px;margin-top:8px;">
                          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                            <span style="font-size:11.5px;font-weight:700;color:#0284c7;">
                              ✓ Response by {{ c.responder?.name || 'Requester' }}
                            </span>
                            <span style="font-size:11px;color:#64748b;">
                              {{ c.provided_at | date:'dd MMM yyyy HH:mm' }}
                            </span>
                          </div>
                          <div style="font-size:12.5px;color:#334155;white-space:pre-line;">
                            {{ c.response_notes }}
                          </div>

                          @if (c.response_attachments?.length) {
                            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                              @for (att of c.response_attachments; track att.file_path) {
                                <a (click)="downloadClarificationAttachment(att)" style="display:inline-flex;align-items:center;gap:4px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:3px 8px;font-size:11.5px;color:#0369a1;cursor:pointer;text-decoration:none;">
                                  <mat-icon style="font-size:14px;width:14px;height:14px;">attach_file</mat-icon>
                                  {{ att.original_name || att.name }}
                                  @if (att.size) { <span style="color:#94a3b8;font-size:10px;">({{ att.size / 1024 | number:'1.0-0' }} KB)</span> }
                                </a>
                              }
                            </div>
                          }
                        </div>
                      } @else {
                        <span style="font-size:11px;font-weight:700;color:#d97706;background:#fef3c7;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:4px;">
                          ⏳ Awaiting Response
                        </span>
                      }
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            }

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
                      <th>UOM</th>
                      <th>Est. Price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of pr()!.items; track item.id) {
                      <tr>
                        <td>{{ item.sno }}</td>
                        <td>
                          @if (item.product?.name) {
                            <div style="font-weight:700;font-size:13.5px;color:var(--text-1);margin-bottom:2px;">{{ item.product.name }}</div>
                          }
                          @if (item.description && item.description.trim() !== (item.product?.name || '').trim()) {
                            <div style="font-size:12px;color:var(--text-2);white-space:pre-wrap;">{{ item.description }}</div>
                          } @else if (!item.product?.name) {
                            <div style="font-weight:500;">{{ item.description }}</div>
                          }
                          @if (item.remarks) { <div style="font-size:11px;color:var(--text-3);margin-top:2px;">{{ item.remarks }}</div> }
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
    .page-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--border); }
    .header-left { display:flex;align-items:center;gap:12px; }
    .title-row { display:flex;align-items:center;gap:10px; }
    .title-row h2 { margin:0;font-size:22px;font-weight:800;color:var(--text-1);letter-spacing:-0.02em; }
    .subtitle { margin:3px 0 0;font-size:13px;color:var(--text-3); }
    .status-pill { display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;text-transform:uppercase;letter-spacing:0.04em; }
    .status-pill mat-icon { font-size:14px;width:14px;height:14px; }
    .status-pill--converted { background:#dcfce7;color:#15803d; }
    .status-pill--draft { background:#f1f5f9;color:#475569; }
    .status-pill--submitted { background:#fff7ed;color:#c2410c; }
    .status-pill--needs_clarification { background:#fef3c7;color:#b45309; }
    .header-actions { display:flex;align-items:center;gap:8px; }
    .btn-compact { height:36px!important;line-height:36px!important;padding:0 14px!important;font-size:12.5px!important;font-weight:600!important;border-radius:8px!important; }
    .btn-compact mat-icon { font-size:18px;width:18px;height:18px;margin-right:4px; }
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
    @media (max-width:768px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
      .header-actions { flex-wrap: wrap; width: 100%; gap: 8px; justify-content: flex-start; }
      .header-actions button { flex: 1 1 auto; min-width: 110px; justify-content: center; }
    }
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

  hasMoreActions(): boolean {
    const pr = this.pr();
    if (!pr) return false;
    const canClarifyOrShortClose = !['draft', 'short_closed', 'rejected', 'needs_clarification'].includes(pr.status ?? '') && !pr.status?.startsWith('short_close_pending') && this.auth.canTransact();
    const canReject = pr.status === 'submitted' && this.auth.isAdmin();
    const canDelete = pr.status === 'draft' && (this.auth.canTransact() || this.auth.canDo('purchase_requisitions', 'delete'));
    return canClarifyOrShortClose || canReject || canDelete;
  }

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

  downloadClarificationAttachment(att: any) {
    if (!att || !att.file_path) return;
    const url = `${environment.apiUrl}/purchase-requisitions/${this.pr()!.id}/clarification-attachments/download?path=${encodeURIComponent(att.file_path)}`;
    window.open(url, '_blank');
  }

  requestClarification() {
    const ref = this.dialog.open(RequestClarificationDialogComponent, {
      width: '520px',
      data: { prId: this.pr()!.id, prNumber: this.pr()!.pr_number },
    });

    ref.afterClosed().subscribe(res => {
      if (res?.pr) {
        this.pr.set(res.pr);
      } else if (res) {
        this.loadPr();
      }
    });
  }

  provideClarification() {
    const ref = this.dialog.open(ProvideClarificationDialogComponent, {
      width: '560px',
      data: {
        prId: this.pr()!.id,
        requestNotes: this.pr()!.clarifications?.[0]?.request_notes,
      },
    });

    ref.afterClosed().subscribe(res => {
      if (res?.pr) {
        this.pr.set(res.pr);
      } else if (res) {
        this.loadPr();
      }
    });
  }

  private loadPr() {
    this.http.get<any>(`${environment.apiUrl}/purchase-requisitions/${this.pr()!.id}`).subscribe({
      next: r => this.pr.set(r),
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


  isPrConverted(pr: any): boolean {
    if (!pr) return false;
    return !!pr.converted_at
      || pr.status === 'converted'
      || pr.status === 'partially_converted'
      || (pr.purchase_orders_count ?? pr.purchase_orders?.length ?? 0) > 0;
  }

  statusIcon(s: string): string {
    const map: Record<string, string> = {
      draft: 'edit_note', submitted: 'pending_actions',
      needs_clarification: 'warning_amber',
      rfq_created: 'request_quote', rfq_approved: 'verified',
      converted: 'check_circle', partially_converted: 'incomplete_circle', rejected: 'cancel',
      short_closed: 'do_not_disturb_on',
    };
    if (s?.startsWith('short_close_pending')) return 'pending_actions';
    return map[s] ?? 'info';
  }

  statusLabel(prArg: any): string {
    const s = typeof prArg === 'string' ? prArg : prArg?.status;
    const isConverted = typeof prArg === 'string' ? false : this.isPrConverted(prArg);

    if (s === 'needs_clarification') return 'Needs Clarification — Awaiting Requester Response';
    if (s === 'short_closed' && isConverted) {
      return 'Converted & Short Closed — converted to PO and remaining quantities short-closed';
    }
    if (s?.startsWith('short_close_pending') && isConverted) {
      return 'Converted & Short Close Pending Approval';
    }
    const map: Record<string, string> = {
      draft: 'Draft — not yet submitted',
      submitted: 'Submitted — awaiting buyer action',
      needs_clarification: 'Needs Clarification — awaiting requester response',
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

  formatStatus(prArg: any): string {
    const s = typeof prArg === 'string' ? prArg : prArg?.status;
    const isConverted = typeof prArg === 'string' ? false : this.isPrConverted(prArg);

    if (s === 'needs_clarification') return 'Needs Clarification';
    if (s === 'short_closed' && isConverted) {
      return 'Converted & Short Closed';
    }
    if (s?.startsWith('short_close_pending') && isConverted) {
      return 'Converted & Short Close Pending';
    }
    const map: Record<string, string> = {
      draft: 'Draft', submitted: 'Submitted',
      needs_clarification: 'Needs Clarification',
      partially_converted: 'Partial',
      rfq_created: 'RFQ Created', rfq_approved: 'RFQ Approved',
      converted: 'Converted', rejected: 'Rejected',
      short_closed: 'Short Closed',
    };
    if (s?.startsWith('short_close_pending')) return 'Short Close Pending';
    return map[s] ?? s;
  }


  deletePr() {
    if (!confirm('Are you sure you want to delete this draft PR? This action cannot be undone.')) return;
    this.acting.set(true);
    this.http.delete(`${environment.apiUrl}/purchase-requisitions/${this.pr()!.id}`).subscribe({
      next: () => {
        this.notify.success('Draft PR deleted successfully.');
        this.router.navigate(['/purchase-requisitions']);
      },
      error: err => {
        this.notify.error(err.error?.error || 'Failed to delete PR.');
        this.acting.set(false);
      }
    });
  }
}
