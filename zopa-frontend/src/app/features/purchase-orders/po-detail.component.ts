import { Component, OnInit, inject, signal, input, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../../environments/environment';
import { PurchaseOrder } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { ReleasePoDialogComponent } from './release-po-dialog.component';
import { DeliveryStatusDialogComponent } from './delivery-status-dialog.component';
import { ActivityTimelineComponent } from '../../shared/components/activity-timeline.component';

@Component({
  selector: 'app-po-detail',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, UpperCasePipe, RouterLink, FormsModule,
    MatButtonModule, MatIconModule, MatCardModule, MatTableModule,
    MatChipsModule, MatDividerModule, MatProgressSpinnerModule, MatTooltipModule,
    MatInputModule, MatFormFieldModule, MatDialogModule, ActivityTimelineComponent,
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
            @if (po()!.delivery_status === 'partially_delivered') {
              <mat-chip class="status-partially_delivered" [highlighted]="true">PARTIALLY DELIVERED</mat-chip>
            } @else {
              <mat-chip [class]="'status-' + po()!.status" [highlighted]="true">{{ po()!.status | uppercase }}</mat-chip>
            }

            @if ((po()!.status === 'draft' || po()!.status === 'returned') && auth.canTransact()) {
              @if (po()!.status === 'returned') {
                <div style="background:#fff3e0;border:1px solid #ffb74d;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#e65100;display:flex;align-items:center;gap:8px;">
                  <mat-icon style="font-size:18px;width:18px;height:18px;">undo</mat-icon>
                  <strong>Returned:</strong>&nbsp;{{ returnComment() }}
                </div>
              }
              <button mat-stroked-button [routerLink]="['/purchase-orders', po()!.id, 'edit']">
                <mat-icon>edit</mat-icon> Edit
              </button>
              <button mat-raised-button color="primary" [disabled]="acting()" (click)="submitPo()">
                @if (acting() === 'submit') { <mat-spinner diameter="18" /> } @else { Submit for Approval }
              </button>
            }

            @if (myApproval() && po()!.status?.startsWith('pending')) {
              <button mat-raised-button style="background:#22c55e;color:#fff;" [disabled]="acting()" (click)="openApprovalAction('approve')">
                @if (acting() === 'approve') { <mat-spinner diameter="18" /> }
                @else { <ng-container><mat-icon>check_circle</mat-icon> Approve</ng-container> }
              </button>
              <button mat-stroked-button color="warn" [disabled]="acting()" (click)="openApprovalAction('return')">
                <mat-icon>undo</mat-icon> Return
              </button>
              <button mat-raised-button color="warn" [disabled]="acting()" (click)="openApprovalAction('reject')">
                @if (acting() === 'reject') { <mat-spinner diameter="18" /> }
                @else { <ng-container><mat-icon>cancel</mat-icon> Reject</ng-container> }
              </button>
            }

            @if (po()!.status === 'approved' && auth.canTransact()) {
              <button mat-raised-button color="primary" [disabled]="acting()" (click)="releasePo()">
                @if (acting() === 'release') { <mat-spinner diameter="18" /> }
                @else { <ng-container><mat-icon>send</mat-icon> Release PO</ng-container> }
              </button>
            }

            @if (isFullyDelivered) {
              <span style="font-size:12px;font-weight:700;color:#15803d;background:#dcfce7;border:1px solid #bbf7d0;padding:6px 14px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;">
                <mat-icon style="font-size:18px;width:18px;height:18px;color:#15803d;">check_circle</mat-icon>
                Delivered &amp; GRN Captured
              </span>
            } @else {
              @if (['released', 'partially_delivered'].includes(po()!.status ?? '') && auth.canTransact()) {
                <button mat-stroked-button color="accent" [disabled]="acting()" (click)="markDelivery('partially_delivered')">
                  <mat-icon>local_shipping</mat-icon> Partially Delivered
                </button>
                <button mat-raised-button color="primary" [disabled]="acting()" (click)="markDelivery('delivered')"
                  style="background:linear-gradient(135deg,#10b981,#059669);">
                  @if (acting() === 'deliver') { <mat-spinner diameter="18" /> }
                  @else { <ng-container><mat-icon>verified</mat-icon> Mark Delivered</ng-container> }
                </button>
              }

              @if (auth.canDo('grns', 'create') && ['partially_delivered', 'delivered'].includes(po()!.delivery_status ?? '')) {
                <button mat-raised-button [routerLink]="['/grns/create']" [queryParams]="{ po_id: po()!.id }"
                        style="background:linear-gradient(135deg, #0284c7, #0369a1);color:#ffffff;">
                  <mat-icon>inventory_2</mat-icon> Mark GRN
                </button>
              }
            }

            @if (isFullyDelivered && !['invoiced', 'payment_released'].includes(po()!.status ?? '') && auth.canTransact()) {
              <button mat-raised-button routerLink="/invoices/create" [queryParams]="{ po_id: po()!.id }"
                style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;">
                <mat-icon>receipt</mat-icon> Raise Invoice
              </button>
            }


            @if (po()!.status === 'invoiced' && auth.isAdmin()) {
              <button mat-raised-button color="primary" [disabled]="acting()" (click)="releasePaymentPo()"
                style="background:linear-gradient(135deg,#6366f1,#4f46e5);">
                @if (acting() === 'payment') { <mat-spinner diameter="18" /> }
                @else { <ng-container><mat-icon>payments</mat-icon> Release Payment</ng-container> }
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

                <!-- Billing & Shipping Details -->
                @if (po()!.bill_to_location || po()!.ship_to_location) {
                  <div class="section-divider">
                    <span class="section-label">Billing &amp; Shipping</span>
                  </div>
                  <div class="detail-grid">
                    @if (po()!.bill_to_location) {
                      <div class="field">
                        <span class="label">Bill To</span>
                        <strong>{{ po()!.bill_to_location?.name }}</strong>
                        @if (po()!.bill_to_location?.gstin) { <div style="font-size:11px;color:#666;">GSTIN: {{ po()!.bill_to_location?.gstin }}</div> }
                      </div>
                    }
                    @if (po()!.ship_to_location) {
                      <div class="field">
                        <span class="label">Ship To</span>
                        <strong>{{ po()!.ship_to_location?.name }}</strong>
                        @if (po()!.ship_to_location?.gstin) { <div style="font-size:11px;color:#666;">GSTIN: {{ po()!.ship_to_location?.gstin }}</div> }
                        @if (po()!.ship_to_location?.receiver_name || po()!.ship_to_location?.receiver_phone) {
                          <div style="font-size:11px;color:#c2410c;margin-top:2px;">
                            Receiver: {{ po()!.ship_to_location?.receiver_name || '—' }}
                            {{ po()!.ship_to_location?.receiver_phone ? '(' + po()!.ship_to_location?.receiver_phone + ')' : '' }}
                          </div>
                        }
                      </div>
                    }
                  </div>
                }

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
                        <span [class]="'status-pr status-pr--' + pr.status">{{ formatPrStatus(pr) }}</span>
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

            <!-- GRN Table Card -->
            @if (['released', 'partially_delivered', 'delivered', 'invoiced', 'payment_released'].includes(po()!.status ?? '') || ['partially_delivered', 'delivered'].includes(po()!.delivery_status ?? '')) {
              <mat-card style="margin-bottom:16px;">
                <mat-card-header style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;">
                  <mat-card-title style="font-size:15px;display:flex;align-items:center;gap:8px;margin:0;">
                    <mat-icon style="color:var(--brand);">inventory_2</mat-icon>
                    Goods Receipt Notes (GRNs)
                    <span style="font-size:11px;background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:99px;font-weight:700;">{{ grns().length }}</span>
                  </mat-card-title>
                  @if (!isGrnFullyCaptured && auth.canDo('grns', 'create') && ['partially_delivered', 'delivered'].includes(po()!.delivery_status ?? '')) {
                    <button mat-stroked-button color="primary" [routerLink]="['/grns/create']" [queryParams]="{ po_id: po()!.id }">
                      <mat-icon>add</mat-icon> Mark GRN
                    </button>
                  } @else if (isGrnFullyCaptured) {
                    <span style="font-size:11.5px;font-weight:700;color:#15803d;background:#dcfce7;border:1px solid #bbf7d0;padding:4px 12px;border-radius:99px;display:inline-flex;align-items:center;gap:4px;">
                      <mat-icon style="font-size:15px;width:15px;height:15px;color:#15803d;">check_circle</mat-icon>
                      All Items Received &amp; Captured
                    </span>
                  }

                </mat-card-header>
                <mat-card-content style="padding:0!important;">
                  @if (loadingGrns()) {
                    <div style="display:flex;justify-content:center;padding:24px;">
                      <mat-spinner diameter="28" />
                    </div>
                  } @else if (grns().length === 0) {
                    <div style="padding:24px;text-align:center;color:#64748b;">
                      <mat-icon style="font-size:36px;width:36px;height:36px;color:#cbd5e1;margin-bottom:6px;">inventory_2</mat-icon>
                      <div style="font-size:13px;font-weight:600;color:#334155;">No GRNs Recorded Yet</div>
                      <p style="font-size:12px;color:#64748b;margin:4px 0 12px;">Record a Goods Receipt Note when goods arrive against this PO.</p>
                      @if (auth.canDo('grns', 'create')) {
                        <button mat-raised-button color="primary" [routerLink]="['/grns/create']" [queryParams]="{ po_id: po()!.id }">
                          <mat-icon>add</mat-icon> Create GRN
                        </button>
                      }
                    </div>
                  } @else {
                    <table mat-table [dataSource]="grns()" class="full-width">
                      <ng-container matColumnDef="grn_number">
                        <th mat-header-cell *matHeaderCellDef>GRN Number</th>
                        <td mat-cell *matCellDef="let g">
                          <a [routerLink]="['/grns', g.id]" style="font-weight:600;color:var(--brand);text-decoration:none;">
                            {{ g.grn_number }}
                          </a>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef>Status</th>
                        <td mat-cell *matCellDef="let g">
                          <span class="status-badge" [class]="'badge-' + (g.status || 'confirmed')">
                            {{ getGrnStatusLabel(g.status) }}
                          </span>
                        </td>
                      </ng-container>


                      <ng-container matColumnDef="received_date">
                        <th mat-header-cell *matHeaderCellDef>Received Date</th>
                        <td mat-cell *matCellDef="let g">{{ g.received_date | date:'dd MMM yyyy' }}</td>
                      </ng-container>
                      <ng-container matColumnDef="received_by">
                        <th mat-header-cell *matHeaderCellDef>Received By</th>
                        <td mat-cell *matCellDef="let g">{{ g.received_by?.name ?? '—' }}</td>
                      </ng-container>
                      <ng-container matColumnDef="dc_number">
                        <th mat-header-cell *matHeaderCellDef>DC / Inv Ref</th>
                        <td mat-cell *matCellDef="let g">
                          <span style="font-family:monospace;font-size:11px;">{{ g.dc_number || g.invoice_number || '—' }}</span>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="items_count">
                        <th mat-header-cell *matHeaderCellDef>Accepted Qty</th>
                        <td mat-cell *matCellDef="let g">
                          <span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;">
                            {{ getGrnTotalAccepted(g) }} units ({{ g.items?.length || 0 }} items)
                          </span>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef style="width:80px;text-align:right;">Actions</th>
                        <td mat-cell *matCellDef="let g" style="text-align:right;">
                          <button mat-icon-button color="primary" [routerLink]="['/grns', g.id]" matTooltip="View GRN">
                            <mat-icon>visibility</mat-icon>
                          </button>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="grnTableCols"></tr>
                      <tr mat-row *matRowDef="let row; columns: grnTableCols;"></tr>
                    </table>
                  }
                </mat-card-content>
              </mat-card>
            }

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
                  @if (po()!.round_off && po()!.round_off !== 0) {
                    <div class="total-row"><span>Round Off</span><span>{{ po()!.round_off! > 0 ? '+' : '' }}₹{{ po()!.round_off | number:'1.2-2' }}</span></div>
                  }
                  <div class="total-row grand"><span>Grand Total</span><span>₹{{ po()!.grand_total | number:'1.2-2' }}</span></div>
                </div>
                <mat-divider style="margin:16px 0;" />
                <div style="font-size:12px;font-weight:600;color:#666;margin-bottom:8px;">Payment Terms</div>
                @if (po()!.payment_terms_json?.length) {
                  @for (t of po()!.payment_terms_json; track t.stage) {
                    <div class="payment-term">
                      <span>{{ t.stage }}</span>
                      <span>{{ t.percentage }}% — {{ t.credit_days }}d</span>
                    </div>
                  }
                } @else {
                  <div class="payment-term">
                    <span>Advance</span>
                    <span>80% — 0d</span>
                  </div>
                  <div class="payment-term">
                    <span>Delivery</span>
                    <span>20% — 30d</span>
                  </div>
                }
              </mat-card-content>
            </mat-card>

            @if (budget()) {
              <mat-card style="margin-bottom:16px;">
                <mat-card-header>
                  <mat-card-title style="font-size:14px;display:flex;align-items:center;gap:6px;">
                    <mat-icon style="color:var(--brand);font-size:18px;">account_balance_wallet</mat-icon>
                    Budget Availability
                  </mat-card-title>
                </mat-card-header>
                <mat-card-content style="padding-top:12px;">
                  <div class="diag-row">
                    <span>Annual Budget</span>
                    <strong>₹{{ budget()!.annual | number:'1.0-0' }}</strong>
                  </div>
                  <div class="diag-row">
                    <span>Frozen (Pending POs)</span>
                    <strong>₹{{ budget()!.frozen | number:'1.0-0' }}</strong>
                  </div>
                  <div class="diag-row">
                    <span>Consumed (Released POs)</span>
                    <strong>₹{{ budget()!.consumed | number:'1.0-0' }}</strong>
                  </div>
                  <mat-divider style="margin:8px 0;" />
                  <div class="diag-row" style="font-size:13px;font-weight:700;">
                    <span>Available Budget</span>
                    <span [style.color]="(budget()?.available ?? 0) < (po()?.grand_total ?? 0) ? '#dc2626' : '#16a34a'">
                      ₹{{ budget()!.available | number:'1.0-0' }}
                    </span>
                  </div>
                  @if ((budget()?.available ?? 0) < (po()?.grand_total ?? 0) && po()?.status === 'draft') {
                    <div style="background:#fef2f2;color:#b91c1c;padding:8px 10px;border-radius:6px;margin-top:10px;font-size:12px;display:flex;align-items:center;gap:6px;">
                      <mat-icon style="font-size:16px;width:16px;height:16px;">warning</mat-icon>
                      PO total exceeds available budget!
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            }

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

            <!-- Activity Log Card -->
            <mat-card style="margin-bottom:16px;">
              <mat-card-header>
                <mat-card-title style="font-size:14px;display:flex;align-items:center;gap:6px;">
                  <mat-icon style="color:var(--brand);font-size:18px;">history</mat-icon>
                  Activity Log
                </mat-card-title>
              </mat-card-header>
              <mat-card-content style="padding-top:12px;">
                @if (po()?.id) {
                  <app-activity-timeline entityType="PO" [entityId]="po()!.id!" />
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

    <!-- ── Approval Action Dialog ──────────────────────────────── -->
    @if (approvalAction()) {
      <div class="modal-overlay" (click)="approvalAction.set(null)">
        <mat-card class="modal-card" style="width:420px;" (click)="$event.stopPropagation()">
          <mat-card-header>
            <mat-card-title style="font-size:16px;">
              @if (approvalAction() === 'approve') { ✅ Approve PO }
              @if (approvalAction() === 'return') { ↩ Return with Query }
              @if (approvalAction() === 'reject') { ❌ Reject PO }
            </mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top:16px;">
            <mat-form-field appearance="outline" style="width:100%;">
              <mat-label>{{ approvalAction() === 'approve' ? 'Comments (optional)' : 'Reason (required)' }}</mat-label>
              <textarea matInput [(ngModel)]="approvalComments" rows="3"></textarea>
            </mat-form-field>
          </mat-card-content>
          <mat-card-actions style="display:flex;gap:8px;justify-content:flex-end;padding:0 16px 16px;">
            <button mat-button (click)="approvalAction.set(null)">Cancel</button>
            <button mat-raised-button
              [color]="approvalAction() === 'approve' ? 'primary' : 'warn'"
              [disabled]="acting() || (approvalAction() !== 'approve' && !approvalComments.trim())"
              (click)="submitApprovalAction()">
              @if (acting()) { <mat-spinner diameter="18" /> }
              @else {
                @if (approvalAction() === 'approve') { Approve }
                @if (approvalAction() === 'return') { Return }
                @if (approvalAction() === 'reject') { Reject }
              }
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }
  `,
  styles: [`
    /* Approval action modal */
    .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000; }
    .modal-card { min-width:320px; }
    .status-returned { background:#fff3e0 !important; color:#e65100 !important; }
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
    .status-partially_delivered { background: #fef3c7 !important; color: #b45309 !important; font-weight: 700 !important; }
    .status-delivered        { background: #ecfdf5 !important; color: #065f46 !important; }
    .status-payment_released { background: #eef2ff !important; color: #3730a3 !important; }

    .delivery-status-chip {
      display: inline-flex; align-items: center; gap: 6px; background: #f0fdf4;
      border: 1px solid #bbf7d0; color: #166534; padding: 4px 12px; border-radius: 99px;
      font-size: 12px; font-weight: 700;
    }
    .delivery-status-chip.partial {
      background: #fff7ed; border-color: #fed7aa; color: #c2410c;
    }

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
  private dialog = inject(MatDialog);

  po = signal<PurchaseOrder | null>(null);
  loading = signal(true);
  acting = signal<string | false>(false);
  downloading = signal(false);
  diag = signal<any>(null);   // super-admin approval-routing diagnostic
  myApproval = signal<any>(null);  // pending approval record for the current user
  approvalAction = signal<'approve'|'return'|'reject'|null>(null);
  approvalComments = '';
  budget = signal<any>(null);

  returnComment = computed(() => {
    const po = this.po();
    if (!po?.approvals?.length) return '';
    const ret = [...(po.approvals ?? [])].reverse().find((a: any) => a.action === 'returned');
    return ret?.comments ?? '';
  });

  pendingApproverName = computed(() => {
    const po = this.po();
    if (!po?.approvals?.length) return 'approval';
    const pending = po.approvals.find(a => a.action === 'pending');
    return pending?.assigned_to?.name ? `${pending.assigned_to.name}` : 'approval';
  });

  itemCols = ['sno', 'description', 'hsn', 'qty', 'unit', 'net_rate', 'gst_rate', 'warranty', 'amount', 'required_by'];

  ngOnInit() {
    this.loadPo();
    if (this.auth.isSuperAdmin()) this.loadDiagnostic();
  }

  loadingGrns = signal(false);
  grns = signal<any[]>([]);
  grnTableCols = ['grn_number', 'status', 'received_date', 'received_by', 'dc_number', 'items_count', 'actions'];


  loadGrns(poId: number) {
    this.loadingGrns.set(true);
    this.http.get<any>(`${environment.apiUrl}/purchase-orders/${poId}/grns`).subscribe({
      next: res => {
        const list = Array.isArray(res) ? res : (res.data ?? []);
        this.grns.set(list);
        this.loadingGrns.set(false);
      },
      error: () => this.loadingGrns.set(false),
    });
  }

  getGrnStatusLabel(status: string): string {
    switch (status) {
      case 'confirmed': return 'GRN Captured';
      case 'pending':   return 'Pending GRN';
      case 'rejected':  return 'Rejected';
      case 'draft':     return 'Draft GRN';
      default:          return status ? status.toUpperCase() : 'UNKNOWN';
    }
  }

  get totalPoOrderedQty(): number {
    return (this.po()?.items || []).reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0);
  }

  get totalGrnAcceptedQty(): number {
    return this.grns().reduce((sum: number, grn: any) => {
      if (grn.status === 'confirmed' || !grn.status) {
        return sum + this.getGrnTotalAccepted(grn);
      }
      return sum;
    }, 0);
  }

  get isGrnFullyCaptured(): boolean {
    const ordered = this.totalPoOrderedQty;
    if (ordered <= 0) return false;
    return this.totalGrnAcceptedQty >= ordered;
  }

  get isFullyDelivered(): boolean {
    const p = this.po();
    if (!p) return false;
    if (p.status === 'delivered' || p.delivery_status === 'delivered') return true;
    if (this.isGrnFullyCaptured) return true;
    return false;
  }



  getGrnTotalAccepted(grn: any): number {

    if (!grn.items?.length) return 0;
    return grn.items.reduce((acc: number, item: any) => acc + Number(item.accepted_qty ?? 0), 0);
  }

  loadPo() {
    this.http.get<PurchaseOrder>(`${environment.apiUrl}/purchase-orders/${this.id()}`).subscribe({
      next: po => {
        this.po.set(po);
        this.loading.set(false);
        if (po.id) this.loadGrns(po.id);
        // Check if the current user has a pending approval for this PO
        this.http.get<any>(`${environment.apiUrl}/purchase-orders/${this.id()}/my-approval`)
          .subscribe({ next: a => this.myApproval.set(a), error: () => {} });
        // Fetch budget for the selected cost center
        if (po.cost_center_id) {
          this.http.get<any>(`${environment.apiUrl}/cost-centers/${po.cost_center_id}/budget`)
            .subscribe({ next: b => this.budget.set(b), error: () => {} });
        }
      },
      error: () => { this.notify.error('Could not load PO.'); this.loading.set(false); },
    });
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
    const ref = this.dialog.open(ReleasePoDialogComponent, {
      width: '480px',
      data: {
        poNumber: this.po()?.po_number,
        vendorName: this.po()?.vendor?.name,
        vendorEmail: this.po()?.vendor?.email,
        title: 'Release Purchase Order',
        confirmText: 'Release & Send PO',
      }
    });

    ref.afterClosed().subscribe(res => {
      if (!res) return;
      this.acting.set('release');
      this.http.post<any>(`${environment.apiUrl}/purchase-orders/${this.id()}/release`, { cc_emails: res.ccEmails }).subscribe({
        next: po => {
          this.po.set(po);
          this.acting.set(false);
          this.notify.success(po?.emailed_to_vendor
            ? 'PO released and emailed to the vendor.'
            : 'PO released. No vendor email on file — add one, then use “Send to Vendor”.');
        },
        error: err => { this.notify.error(err.error?.error ?? 'Release failed.'); this.acting.set(false); },
      });
    });
  }

  sendToVendor() {
    const ref = this.dialog.open(ReleasePoDialogComponent, {
      width: '480px',
      data: {
        poNumber: this.po()?.po_number,
        vendorName: this.po()?.vendor?.name,
        vendorEmail: this.po()?.vendor?.email,
        title: 'Send PO to Vendor',
        confirmText: 'Email PO Document',
      }
    });

    ref.afterClosed().subscribe(res => {
      if (!res) return;
      this.acting.set('sendVendor');
      this.http.post<{ message: string }>(`${environment.apiUrl}/purchase-orders/${this.id()}/send-to-vendor`, { cc_emails: res.ccEmails }).subscribe({
        next: res => { this.acting.set(false); this.notify.success(res?.message ?? 'PO emailed to vendor.'); },
        error: err => { this.notify.error(err.error?.error ?? 'Could not email the vendor.'); this.acting.set(false); },
      });
    });
  }

  deliverPo() {
    this.markDelivery('delivered');
  }

  markDelivery(status: 'partially_delivered' | 'delivered') {
    const ref = this.dialog.open(DeliveryStatusDialogComponent, {
      width: '480px',
      data: { status, notes: this.po()?.delivery_notes }
    });

    ref.afterClosed().subscribe(res => {
      if (!res) return;
      if (res.action === 'create_grn') {
        this.router.navigate(['/grns/create'], { queryParams: { po_id: this.id() } });
        return;
      }
      this.acting.set('deliver');
      this.http.post<any>(`${environment.apiUrl}/purchase-orders/${this.id()}/delivery-status`, { status: res.status, notes: res.notes }).subscribe({
        next: po => {
          this.po.set(po);
          this.loadPo();
          this.acting.set(false);
          const label = res.status === 'partially_delivered' ? 'Partially Delivered' : 'Delivered';
          this.notify.success(`PO marked as ${label}.`);
        },
        error: err => { this.notify.error(err.error?.error ?? 'Could not update delivery status.'); this.acting.set(false); },
      });
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

  openApprovalAction(action: 'approve'|'return'|'reject') {
    this.approvalComments = '';
    this.approvalAction.set(action);
  }

  submitApprovalAction() {
    const action = this.approvalAction();
    if (!action) return;
    if (action !== 'approve' && !this.approvalComments.trim()) {
      this.notify.error('Please provide a reason.');
      return;
    }
    this.acting.set(action);
    const url = action === 'approve'
      ? `${environment.apiUrl}/purchase-orders/${this.id()}/approve`
      : action === 'return'
        ? `${environment.apiUrl}/purchase-orders/${this.id()}/return`
        : `${environment.apiUrl}/purchase-orders/${this.id()}/reject-approval`;

    this.http.post<any>(url, { comments: this.approvalComments }).subscribe({
      next: () => {
        this.acting.set(false);
        this.approvalAction.set(null);
        this.myApproval.set(null);
        const msg = action === 'approve' ? 'PO approved.' : action === 'return' ? 'PO returned to buyer.' : 'PO rejected.';
        this.notify.success(msg);
        // Reload PO to reflect new status
        this.http.get<PurchaseOrder>(`${environment.apiUrl}/purchase-orders/${this.id()}`)
          .subscribe({ next: po => this.po.set(po), error: () => {} });
      },
      error: err => {
        this.notify.error(err.error?.error ?? err.error?.message ?? 'Action failed.');
        this.acting.set(false);
      },
    });
  }

  formatPrStatus(pr: any): string {
    const s = typeof pr === 'string' ? pr : pr?.status;
    const isConverted = typeof pr === 'string' ? false : (!!pr?.converted_at || pr?.status === 'converted' || pr?.status === 'partially_converted');
    if (s === 'short_closed' && isConverted) {
      return 'Converted & Short Closed';
    }
    if (s?.startsWith('short_close_pending') && isConverted) {
      return 'Converted & Short Close Pending';
    }
    const map: Record<string, string> = {
      draft: 'Draft', submitted: 'Submitted',
      rfq_created: 'RFQ Created', rfq_approved: 'RFQ Approved',
      converted: 'Converted', rejected: 'Rejected', short_closed: 'Short Closed',
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
