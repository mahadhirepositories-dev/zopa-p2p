import { Component, OnInit, inject, signal, input, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { PurchaseOrder } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-po-detail',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, UpperCasePipe, RouterLink,
    MatButtonModule, MatIconModule, MatCardModule, MatTableModule,
    MatChipsModule, MatDividerModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">
      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:80px;"><mat-spinner diameter="48" /></div>
      } @else if (po()) {
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <button mat-icon-button routerLink="/purchase-orders"><mat-icon>arrow_back</mat-icon></button>
            <div>
              <h2 style="margin:0;">{{ po()!.po_number ?? ('PO #' + po()!.id) }}</h2>
              <div style="font-size:12px;color:#888;display:flex;align-items:center;gap:6px;">
                Created {{ po()!.created_at | date:'dd MMM yyyy' }}
                @if (po()!.status?.startsWith('pending')) {
                  <span style="background:#fff7ed;color:#c2410c;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;">
                    Awaiting {{ pendingApproverName() }}
                  </span>
                }
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <mat-chip [class]="'status-' + po()!.status" [highlighted]="true">{{ po()!.status | uppercase }}</mat-chip>

            @if (po()!.status === 'draft' && auth.canTransact()) {
              <button mat-stroked-button [routerLink]="['/purchase-orders', po()!.id, 'edit']">
                <mat-icon>edit</mat-icon> Edit
              </button>
              <button mat-raised-button color="primary" [disabled]="acting()" (click)="submitPo()">
                @if (acting() === 'submit') { <mat-spinner diameter="18" /> } @else { Submit for Approval }
              </button>
            }

            @if (po()!.status === 'approved' && auth.canTransact()) {
              <button mat-raised-button color="primary" [disabled]="acting()" (click)="releasePo()">
                @if (acting() === 'release') { <mat-spinner diameter="18" /> }
                @else { <mat-icon>send</mat-icon> Release PO }
              </button>
            }

            @if (po()!.status === 'released' && auth.canTransact()) {
              <button mat-raised-button color="primary" [disabled]="acting()" (click)="deliverPo()"
                style="background:linear-gradient(135deg,#10b981,#059669);">
                @if (acting() === 'deliver') { <mat-spinner diameter="18" /> }
                @else { <mat-icon>local_shipping</mat-icon> Mark Delivered }
              </button>
            }

            @if (po()!.status === 'delivered' && auth.canTransact()) {
              <button mat-raised-button routerLink="/invoices/create"
                style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;">
                <mat-icon>receipt</mat-icon> Raise Invoice
              </button>
            }

            @if (po()!.status === 'invoiced' && auth.isAdmin()) {
              <button mat-raised-button color="primary" [disabled]="acting()" (click)="releasePaymentPo()"
                style="background:linear-gradient(135deg,#6366f1,#4f46e5);">
                @if (acting() === 'payment') { <mat-spinner diameter="18" /> }
                @else { <mat-icon>payments</mat-icon> Release Payment }
              </button>
            }

            @if (['released','delivered','invoiced','payment_released'].includes(po()!.status) && auth.canTransact()) {
              <button mat-stroked-button [disabled]="acting()" (click)="sendToVendor()"
                      matTooltip="Email this PO (with the PDF) to the vendor">
                @if (acting() === 'sendVendor') { <mat-spinner diameter="18" /> }
                @else { <mat-icon>forward_to_inbox</mat-icon> }
                Send to Vendor
              </button>
            }

            @if (auth.isSuperAdmin() && po()!.status !== 'draft') {
              <button mat-stroked-button color="warn" [disabled]="acting()" (click)="resetToDraft()"
                      matTooltip="Revert this PO to draft — reverses the budget freeze and removes goods receipts, invoices & approvals so the approval flow can be re-run">
                @if (acting() === 'reset') { <mat-spinner diameter="18" /> }
                @else { <mat-icon>restart_alt</mat-icon> }
                Reset to Draft
              </button>
            }

            <button mat-stroked-button [disabled]="downloading()" (click)="downloadPdf()"
                    matTooltip="Opens PDF in a new tab — use browser controls to save">
              @if (downloading()) { <mat-spinner diameter="18" /> }
              @else { <mat-icon>picture_as_pdf</mat-icon> }
              View / Download PDF
            </button>
          </div>
        </div>

        <div class="detail-layout">
          <!-- Left: Header Info + Items -->
          <div class="main-col">
            <mat-card style="margin-bottom:16px;">
              <mat-card-header><mat-card-title>PO Details</mat-card-title></mat-card-header>
              <mat-card-content style="padding-top:16px;">
                <div class="detail-grid">
                  <div class="field"><span class="label">Vendor</span><strong>{{ po()!.vendor?.name }}</strong></div>
                  <div class="field"><span class="label">Valid Till</span>{{ po()!.po_valid_till | date:'dd MMM yyyy' }}</div>
                  @if (po()!.vendor_address) {
                    <div class="field full-span">
                      <span class="label">Vendor Address</span>
                      {{ po()!.vendor_address?.label }} — {{ po()!.vendor_address?.state }}
                      @if (po()!.vendor_address?.gstin) { | GSTIN: {{ po()!.vendor_address?.gstin }} }
                    </div>
                  }
                </div>

                <!-- Cost Center Details -->
                <div class="section-divider">
                  <span class="section-label">Cost Center</span>
                </div>
                <div class="detail-grid">
                  <div class="field"><span class="label">Cost Center</span><strong>{{ po()!.cost_center?.name }}</strong></div>
                  @if (po()!.cost_center?.department) {
                    <div class="field"><span class="label">Department</span>{{ po()!.cost_center?.department?.name }}</div>
                  }
                  @if (po()!.cost_center?.project) {
                    <div class="field"><span class="label">Project</span>{{ po()!.cost_center?.project?.name }}</div>
                  }
                  @if (po()!.cost_center?.location) {
                    <div class="field"><span class="label">Location</span>{{ po()!.cost_center?.location?.name }}</div>
                  }
                </div>

                <!-- Linked PRs -->
                @if ((po()!.prs?.length ?? 0) > 0 || po()!.pr) {
                  <div class="section-divider">
                    <span class="section-label">Source Requisition{{ (po()!.prs?.length ?? 0) > 1 ? 's' : '' }}</span>
                  </div>
                  <div class="pr-links-list">
                    @for (pr of (po()!.prs?.length ? po()!.prs! : (po()!.pr ? [po()!.pr!] : [])); track pr.id) {
                      <div class="pr-link-row">
                        <a class="pr-ref-link" [routerLink]="['/purchase-requisitions', pr.id]">
                          <mat-icon style="font-size:14px;vertical-align:middle;margin-right:3px;">description</mat-icon>
                          {{ pr.pr_number ?? 'PR #' + pr.id }}
                        </a>
                        <span style="font-size:12px;color:var(--text-2);">{{ pr.title ?? '' }}</span>
                        <span [class]="'status-pr status-pr--' + pr.status">{{ formatPrStatus(pr.status) }}</span>
                      </div>
                    }
                  </div>
                }
              </mat-card-content>
            </mat-card>

            <mat-card style="margin-bottom:16px;">
              <mat-card-header><mat-card-title>Line Items</mat-card-title></mat-card-header>
              <mat-card-content style="padding-top:8px;overflow-x:auto;">
                <table mat-table [dataSource]="po()!.items ?? []" class="full-width">
                  <ng-container matColumnDef="sno">
                    <th mat-header-cell *matHeaderCellDef>#</th>
                    <td mat-cell *matCellDef="let i">{{ i.sno }}</td>
                  </ng-container>
                  <ng-container matColumnDef="description">
                    <th mat-header-cell *matHeaderCellDef>Description / Specification</th>
                    <td mat-cell *matCellDef="let i">
                      <div style="font-weight:600;font-size:13px;color:var(--text-1);white-space:pre-wrap;">{{ i.description }}</div>
                      @if ((i.product_name || i.product?.name) && (i.product_name || i.product?.name) !== i.description) {
                        <div style="font-size:11px;color:var(--text-3);margin-top:2px;">
                          Product: {{ i.product_name || i.product?.name }}
                        </div>
                      }
                      @if (i.product_code || i.product?.code) {
                        <div style="font-size:11px;color:var(--text-3);">
                          Code: {{ i.product_code || i.product?.code }}
                        </div>
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="hsn">
                    <th mat-header-cell *matHeaderCellDef>HSN</th>
                    <td mat-cell *matCellDef="let i">
                      @if (i.hsn_code || i.product?.hsn_code) {
                        <span class="hsn-tag">{{ i.hsn_code || i.product?.hsn_code }}</span>
                      } @else { <span style="color:#ccc;">—</span> }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="qty">
                    <th mat-header-cell *matHeaderCellDef>Qty</th>
                    <td mat-cell *matCellDef="let i">{{ i.qty }}</td>
                  </ng-container>
                  <ng-container matColumnDef="unit">
                    <th mat-header-cell *matHeaderCellDef>UOM</th>
                    <td mat-cell *matCellDef="let i">{{ i.unit || i.product?.unit || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="net_rate">
                    <th mat-header-cell *matHeaderCellDef>Net Rate</th>
                    <td mat-cell *matCellDef="let i">₹{{ i.net_rate | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="gst_rate">
                    <th mat-header-cell *matHeaderCellDef>GST</th>
                    <td mat-cell *matCellDef="let i">{{ i.gst_rate }}%</td>
                  </ng-container>
                  <ng-container matColumnDef="warranty">
                    <th mat-header-cell *matHeaderCellDef>Warranty</th>
                    <td mat-cell *matCellDef="let i">
                      @if (i.warranty_months) { {{ i.warranty_months }} mo } @else { — }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="amount">
                    <th mat-header-cell *matHeaderCellDef>Amount</th>
                    <td mat-cell *matCellDef="let i"><strong>₹{{ i.amount | number:'1.2-2' }}</strong></td>
                  </ng-container>
                  <ng-container matColumnDef="required_by">
                    <th mat-header-cell *matHeaderCellDef>Required By</th>
                    <td mat-cell *matCellDef="let i">{{ i.required_by ? (i.required_by | date:'dd MMM yy') : '—' }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="itemCols"></tr>
                  <tr mat-row *matRowDef="let row; columns: itemCols;"></tr>
                </table>
              </mat-card-content>
            </mat-card>

            @if (po()!.terms_conditions) {
              <mat-card style="margin-bottom:16px;">
                <mat-card-header><mat-card-title>Terms &amp; Conditions</mat-card-title></mat-card-header>
                <mat-card-content style="padding:16px;white-space:pre-wrap;font-size:13px;color:#555;" [innerHTML]="po()!.terms_conditions"></mat-card-content>
              </mat-card>
            }
          </div>

          <!-- Right: Totals + Approvals + Attachments -->
          <div class="side-col">
            <mat-card style="margin-bottom:16px;">
              <mat-card-header><mat-card-title>Financial Summary</mat-card-title></mat-card-header>
              <mat-card-content style="padding-top:16px;">
                <div class="totals">
                  <div class="total-row"><span>Net Total</span><span>₹{{ po()!.net_total | number:'1.2-2' }}</span></div>
                  @if (po()!.freight && po()!.freight! > 0) {
                    <div class="total-row">
                      <span>Freight{{ po()!.freight_gst_rate ? ' (+' + po()!.freight_gst_rate + '% GST)' : '' }}</span>
                      <span>₹{{ po()!.freight | number:'1.2-2' }}</span>
                    </div>
                  }
                  <div class="total-row"><span>Tax Amount</span><span>₹{{ po()!.tax_amount | number:'1.2-2' }}</span></div>
                  <div class="total-row grand"><span>Grand Total</span><span>₹{{ po()!.grand_total | number:'1.2-2' }}</span></div>
                </div>
                @if (po()!.payment_terms_json?.length) {
                  <mat-divider style="margin:16px 0;" />
                  <div style="font-size:12px;font-weight:600;color:#666;margin-bottom:8px;">Payment Terms</div>
                  @for (t of po()!.payment_terms_json; track t.stage) {
                    <div class="payment-term">
                      <span>{{ t.stage }}</span>
                      <span>{{ t.percentage }}% — {{ t.credit_days }}d</span>
                    </div>
                  }
                }
              </mat-card-content>
            </mat-card>

            <mat-card style="margin-bottom:16px;">
              <mat-card-header><mat-card-title>Approval Timeline</mat-card-title></mat-card-header>
              <mat-card-content style="padding-top:16px;">
                @if (!po()!.approvals?.length) {
                  <p style="color:#aaa;font-size:13px;">No approvals yet.</p>
                }
                @for (a of po()!.approvals; track a.id) {
                  <div class="approval-item">
                    <div class="approval-icon" [class]="'approval-' + a.action">
                      <mat-icon>{{ a.action === 'approved' ? 'check_circle' : a.action === 'pending' ? 'schedule' : a.action === 'rejected' ? 'cancel' : 'undo' }}</mat-icon>
                    </div>
                    <div class="approval-body">
                      <strong>L{{ a.level }}: {{ a.assigned_to?.name }}</strong>
                      <div class="approval-meta">
                        <mat-chip [class]="'status-' + a.action" [highlighted]="true" style="font-size:10px;">{{ a.action }}</mat-chip>
                        @if (a.acted_at) { <span style="font-size:11px;color:#888;">{{ a.acted_at | date:'dd MMM, HH:mm' }}</span> }
                      </div>
                      @if (a.comments) {
                        <div class="approval-comment">"{{ a.comments }}"</div>
                      }
                    </div>
                  </div>
                }
              </mat-card-content>
            </mat-card>

            <!-- Approval routing diagnostic (super admin only) -->
            @if (auth.isSuperAdmin() && diag()) {
              <mat-card style="margin-bottom:16px;border:1px solid #fed7aa;">
                <mat-card-header>
                  <mat-card-title style="font-size:14px;display:flex;align-items:center;gap:6px;">
                    <mat-icon style="color:#c2410c;font-size:18px;">policy</mat-icon>
                    Approval Routing (diagnostic)
                  </mat-card-title>
                </mat-card-header>
                <mat-card-content style="padding-top:12px;font-size:12px;">
                  <div style="padding:8px 10px;border-radius:6px;margin-bottom:10px;line-height:1.5;"
                       [style.background]="diag().would_route_to?.length ? '#ecfdf5' : '#fef2f2'"
                       [style.color]="diag().would_route_to?.length ? '#065f46' : '#b91c1c'">
                    {{ diag().VERDICT }}
                  </div>
                  <div class="diag-row"><span>Cost Center</span><strong>{{ diag().cost_center_name }} (#{{ diag().cost_center_id }})</strong></div>
                  <div class="diag-row"><span>Grand Total</span><strong>₹{{ diag().grand_total | number:'1.2-2' }}</strong></div>
                  <div class="diag-row"><span>Would route to</span>
                    <strong>{{ diag().would_route_to?.length ? diag().would_route_to.join(' → ') : 'Auto-approve (no config)' }}</strong>
                  </div>
                  <div style="margin-top:10px;font-weight:600;color:#666;">Configs on this cost center:</div>
                  @if (!diag().configs_for_this_cost_center?.length) {
                    <div style="color:#b91c1c;padding:4px 0;">None — this is why it auto-approves.</div>
                  }
                  @for (c of diag().configs_for_this_cost_center; track c.id) {
                    <div class="diag-cfg">
                      <span class="diag-type" [class.diag-po]="c.type === 'po'">{{ c.type | uppercase }}</span>
                      L{{ c.level }} ·
                      {{ c.resolved_user_ids?.length ? (c.resolved_user_ids.length + ' approver(s)') : 'NO approver' }} ·
                      {{ c.is_active ? 'active' : 'INACTIVE' }} ·
                      {{ c.amount_limit ? ('≤ ₹' + (c.amount_limit | number:'1.0-0')) : 'unlimited' }}
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            }

            <!-- Invoices panel -->
            @if (po()!.invoices?.length) {
              <mat-card style="margin-bottom:16px;">
                <mat-card-header><mat-card-title>Invoices</mat-card-title></mat-card-header>
                <mat-card-content style="padding-top:12px;">
                  @for (inv of po()!.invoices; track inv.id) {
                    <div class="invoice-row" [routerLink]="['/invoices', inv.id]">
                      <div>
                        <strong style="font-size:13px;">{{ inv.invoice_number }}</strong>
                        <div style="font-size:11px;color:#888;">{{ inv.invoice_date | date:'dd MMM yyyy' }}</div>
                      </div>
                      <div style="text-align:right;">
                        <strong style="font-size:13px;">₹{{ inv.amount | number:'1.0-0' }}</strong>
                        <div>
                          <span [class]="'inv-status inv-status--' + inv.status">{{ inv.status }}</span>
                        </div>
                      </div>
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            } @else if (['delivered','invoiced','payment_released'].includes(po()!.status)) {
              <mat-card style="margin-bottom:16px;">
                <mat-card-header><mat-card-title>Invoices</mat-card-title></mat-card-header>
                <mat-card-content style="padding:16px;">
                  <div style="font-size:13px;color:#aaa;margin-bottom:10px;">No invoices raised yet.</div>
                  @if (po()!.status === 'delivered') {
                    <button mat-stroked-button routerLink="/invoices/create" style="width:100%;">
                      <mat-icon>add</mat-icon> Raise Invoice
                    </button>
                  }
                </mat-card-content>
              </mat-card>
            }

            @if (po()!.attachments?.length) {
              <mat-card>
                <mat-card-header><mat-card-title>Attachments</mat-card-title></mat-card-header>
                <mat-card-content style="padding-top:16px;">
                  @for (att of po()!.attachments; track att.id) {
                    <div class="attachment-row">
                      <mat-icon style="color:#888;">attach_file</mat-icon>
                      <span>{{ att.original_name }}</span>
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-layout { display: grid; grid-template-columns: 1fr 360px; gap: 16px; }
    .main-col { min-width: 0; }
    .side-col { min-width: 0; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full-span { grid-column: 1 / -1; }
    .field { }
    .label { font-size: 10px; color: #888; text-transform: uppercase; display: block; margin-bottom: 2px; }
    .section-divider { display: flex; align-items: center; gap: 8px; margin: 16px 0 12px; }
    .section-divider::before { content: ''; flex: 1; height: 1px; background: #e0e0e0; }
    .section-divider::after { content: ''; flex: 3; height: 1px; background: #e0e0e0; }
    .pr-ref-link { color:var(--brand); font-weight:600; font-size:13px; display:flex; align-items:center; cursor:pointer; }
    .pr-ref-link:hover { text-decoration:underline; }
    .pr-links-list { display:flex;flex-direction:column;gap:6px; }
    .pr-link-row { display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:4px 0; }
    .status-pr { display:inline-block; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:600; }
    .status-pr--converted    { background:#dcfce7; color:#15803d; }
    .status-pr--rfq_approved { background:#ecfdf5; color:#059669; }
    .status-pr--rfq_created  { background:#eff6ff; color:#2563eb; }
    .status-pr--submitted    { background:#fffbeb; color:#d97706; }
    .status-pr--draft        { background:#f1f5f9; color:#475569; }
    .status-pr--rejected     { background:#fee2e2; color:#b91c1c; }
    .section-label { font-size: 10px; font-weight: 700; color: #1976d2; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
    .full-width { width: 100%; }
    .hsn-tag { display: inline-block; background: #f0f4ff; color: #3730a3; font-size: 10px; font-family: monospace; padding: 1px 5px; border-radius: 3px; margin-left: 6px; }
    .totals { display: flex; flex-direction: column; gap: 6px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
    .total-row.grand { font-weight: 700; font-size: 16px; border-bottom: none; border-top: 2px solid #1976d2; padding-top: 10px; margin-top: 4px; }
    .payment-term { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #f5f5f5; }
    .approval-item { display: flex; gap: 12px; margin-bottom: 16px; }
    .approval-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .approval-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    /* Status pill overrides for chips */
    .status-delivered        { background: #ecfdf5 !important; color: #065f46 !important; }
    .status-payment_released { background: #eef2ff !important; color: #3730a3 !important; }

    .approval-approved { background: #e8f5e9; color: #2e7d32; }
    .approval-pending  { background: #fff3e0; color: #e65100; }
    .approval-rejected { background: #ffebee; color: #c62828; }
    .approval-returned { background: #fff8e1; color: #f57f17; }
    .approval-body { flex: 1; }
    .approval-meta { display: flex; gap: 8px; align-items: center; margin: 4px 0; }
    .approval-comment { font-size: 12px; color: #555; font-style: italic; background: #f5f5f5; padding: 6px 10px; border-radius: 4px; margin-top: 4px; }
    .attachment-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f5f5f5; }
    .invoice-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f0f0f0; cursor:pointer; transition:background .12s; border-radius:6px; }
    .invoice-row:last-child { border-bottom:none; }
    .invoice-row:hover { background:#f8faff; padding-left:6px; }
    .inv-status { display:inline-block; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; text-transform:capitalize; }
    .inv-status--pending  { background:#fff7ed; color:#c2410c; }
    .inv-status--approved { background:#ecfdf5; color:#065f46; }
    .inv-status--rejected { background:#fef2f2; color:#b91c1c; }
    .status-invoiced { background:#fef9c3 !important; color:#92400e !important; }
    .diag-row { display:flex; justify-content:space-between; gap:8px; padding:3px 0; border-bottom:1px solid #f5f5f5; }
    .diag-cfg { padding:4px 0; color:#475569; border-bottom:1px solid #f8f8f8; }
    .diag-type { display:inline-block; font-size:9px; font-weight:700; padding:1px 5px; border-radius:3px; background:#e2e8f0; color:#475569; margin-right:4px; }
    .diag-type.diag-po { background:#c2410c; color:#fff; }
  `],
})
export class PoDetailComponent implements OnInit {
  id = input.required<string>();
  private http = inject(HttpClient);
  private router = inject(Router);
  private notify = inject(NotificationService);
  readonly auth = inject(AuthService);

  po = signal<PurchaseOrder | null>(null);
  loading = signal(true);
  acting = signal<string | false>(false);
  downloading = signal(false);
  diag = signal<any>(null);   // super-admin approval-routing diagnostic

  pendingApproverName = computed(() => {
    const po = this.po();
    if (!po?.approvals?.length) return 'approval';
    const pending = po.approvals.find(a => a.action === 'pending');
    return pending?.assigned_to?.name ? `${pending.assigned_to.name}` : 'approval';
  });

  itemCols = ['sno', 'description', 'hsn', 'qty', 'unit', 'net_rate', 'gst_rate', 'warranty', 'amount', 'required_by'];

  ngOnInit() {
    this.http.get<PurchaseOrder>(`${environment.apiUrl}/purchase-orders/${this.id()}`).subscribe({
      next: po => { this.po.set(po); this.loading.set(false); },
      error: () => { this.notify.error('Could not load PO.'); this.loading.set(false); },
    });
    if (this.auth.isSuperAdmin()) this.loadDiagnostic();
  }

  /** Super-admin: fetch why this PO routed the way it did (config state + verdict). */
  private loadDiagnostic() {
    this.http.get<any>(`${environment.apiUrl}/purchase-orders/${this.id()}/approval-diagnostic`)
      .subscribe({ next: d => this.diag.set(d), error: () => {} });
  }

  submitPo() {
    this.acting.set('submit');
    this.http.post<any>(`${environment.apiUrl}/purchase-orders/${this.id()}/submit`, {}).subscribe({
      next: po => { this.po.set(po); this.acting.set(false); this.notify.success('PO submitted for approval.'); if (this.auth.isSuperAdmin()) this.loadDiagnostic(); },
      error: err => { this.notify.error(err.error?.error ?? 'Submit failed.'); this.acting.set(false); },
    });
  }

  releasePo() {
    this.acting.set('release');
    this.http.post<any>(`${environment.apiUrl}/purchase-orders/${this.id()}/release`, {}).subscribe({
      next: po => {
        this.po.set(po);
        this.acting.set(false);
        this.notify.success(po?.emailed_to_vendor
          ? 'PO released and emailed to the vendor.'
          : 'PO released. No vendor email on file — add one, then use “Send to Vendor”.');
      },
      error: err => { this.notify.error(err.error?.error ?? 'Release failed.'); this.acting.set(false); },
    });
  }

  sendToVendor() {
    this.acting.set('sendVendor');
    this.http.post<{ message: string }>(`${environment.apiUrl}/purchase-orders/${this.id()}/send-to-vendor`, {}).subscribe({
      next: res => { this.acting.set(false); this.notify.success(res?.message ?? 'PO emailed to vendor.'); },
      error: err => { this.notify.error(err.error?.error ?? 'Could not email the vendor.'); this.acting.set(false); },
    });
  }

  deliverPo() {
    this.acting.set('deliver');
    this.http.post<any>(`${environment.apiUrl}/purchase-orders/${this.id()}/deliver`, {}).subscribe({
      next: po => { this.po.set(po); this.acting.set(false); this.notify.success('PO marked as delivered.'); },
      error: err => { this.notify.error(err.error?.error ?? 'Could not mark delivered.'); this.acting.set(false); },
    });
  }

  releasePaymentPo() {
    this.acting.set('payment');
    this.http.post<any>(`${environment.apiUrl}/purchase-orders/${this.id()}/release-payment`, {}).subscribe({
      next: po => { this.po.set(po); this.acting.set(false); this.notify.success('Payment released.'); },
      error: err => { this.notify.error(err.error?.error ?? 'Payment release failed.'); this.acting.set(false); },
    });
  }

  /** Super-admin only: revert a non-draft PO to draft, reversing all side effects. */
  resetToDraft() {
    if (!confirm(
      'Reset this PO back to draft?\n\nThis reverses the budget freeze and removes any goods receipts, '
      + 'invoices and approvals for this PO so you can re-run the approval flow. The PO number is cleared '
      + 'and regenerated on the next submit.\n\nContinue?'
    )) return;
    this.acting.set('reset');
    this.http.post<any>(`${environment.apiUrl}/purchase-orders/${this.id()}/reset-to-draft`, {}).subscribe({
      next: po => { this.po.set(po); this.acting.set(false); this.notify.success('PO reset to draft. Configure approvers, then Submit for Approval.'); if (this.auth.isSuperAdmin()) this.loadDiagnostic(); },
      error: err => { this.notify.error(err.error?.error ?? 'Reset failed.'); this.acting.set(false); },
    });
  }

  formatPrStatus(s: string): string {
    const map: Record<string, string> = {
      draft: 'Draft', submitted: 'Submitted',
      rfq_created: 'RFQ Created', rfq_approved: 'RFQ Approved',
      converted: 'Converted', rejected: 'Rejected',
    };
    return map[s] ?? s;
  }

  downloadPdf() {
    this.downloading.set(true);

    // Open the new tab SYNCHRONOUSLY here — in the same user-gesture tick.
    // Browsers allow window.open() when it's called directly from a click handler.
    // If we wait for the async HTTP response first, popup blockers will kill it.
    const pdfWin = window.open('', '_blank');
    if (pdfWin) {
      pdfWin.document.write(
        '<html><head><title>Loading PDF…</title></head>' +
        '<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5;">' +
        '<div style="text-align:center;color:#555;">' +
        '<div style="font-size:32px;margin-bottom:16px;">📄</div>' +
        '<div style="font-size:18px;font-weight:600;">Generating PDF…</div>' +
        '<div style="font-size:13px;margin-top:8px;color:#888;">Please wait, this may take a few seconds.</div>' +
        '</div></body></html>'
      );
    }

    // Step 1: authenticated request for a short-lived one-time download token URL.
    this.http.get<{ url: string }>(`${environment.apiUrl}/purchase-orders/${this.id()}/pdf-url`).subscribe({
      next: ({ url }) => {
        if (pdfWin && !pdfWin.closed) {
          // Redirect the already-open tab to the PDF — no Authorization header required.
          pdfWin.location.href = url;
        } else {
          // Popup was blocked — fall back to same-tab download link.
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        this.downloading.set(false);
      },
      error: err => {
        if (pdfWin && !pdfWin.closed) pdfWin.close();
        const msg = err.status === 401
          ? 'Session expired — please log out and log back in.'
          : 'Could not generate PDF. Please try again.';
        this.notify.error(msg);
        this.downloading.set(false);
      },
    });
  }
}
