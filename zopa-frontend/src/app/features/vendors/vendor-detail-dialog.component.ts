import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-vendor-detail-dialog',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TitleCasePipe, UpperCasePipe, RouterLink,
    MatDialogModule, MatButtonModule, MatIconModule, MatTabsModule,
    MatChipsModule, MatCardModule, MatTableModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="dialog-container">
      @if (loading()) {
        <div style="display:flex;justify-content:center;align-items:center;height:300px;">
          <mat-spinner diameter="36" />
        </div>
      } @else if (vendor()) {
        <!-- Header -->
        <div class="dialog-header">
          <div class="v-title-box">
            <div class="avatar">{{ vendor()!.name[0]?.toUpperCase() }}</div>
            <div>
              <h2 class="v-name">{{ vendor()!.name }}</h2>
              <div class="v-sub">
                <span class="mono-code">{{ vendor()!.global_vendor_code ?? 'NO CODE' }}</span>
                <span class="v-dot">•</span>
                <span [class]="vendor()!.is_active ? 'badge-active' : 'badge-inactive'">
                  {{ vendor()!.is_active ? 'Active Vendor' : 'Inactive Vendor' }}
                </span>
              </div>
            </div>
          </div>

          <div class="dialog-header-actions">
            <!-- Download Vendor PDF (Available even on View rights) -->
            <button mat-raised-button color="primary" (click)="downloadPdf()" [disabled]="downloading()">
              @if (downloading()) { <mat-spinner diameter="18" /> }
              @else { <mat-icon>picture_as_pdf</mat-icon> Download Vendor PDF }
            </button>

            @if (auth.canDo('vendors', 'edit')) {
              <button mat-stroked-button color="primary" (click)="editVendor()">
                <mat-icon>edit</mat-icon> Edit Vendor
              </button>
            }

            <button mat-icon-button mat-dialog-close matTooltip="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <mat-dialog-content class="dialog-content">
          <mat-tab-group animationDuration="150ms">
            <!-- TAB 1: Vendor Profile & Compliance -->
            <mat-tab label="Vendor Profile &amp; Compliance">
              <div class="tab-padding">

                <!-- General Info -->
                <div class="card-section">
                  <div class="sec-title">General Information</div>
                  <div class="info-grid">
                    <div><span class="lbl">Vendor Name</span><strong>{{ vendor()!.name }}</strong></div>
                    <div><span class="lbl">Global Vendor Code</span><span class="mono">{{ vendor()!.global_vendor_code ?? '—' }}</span></div>
                    <div><span class="lbl">Entity Code</span><span>{{ vendor()!.entity_code ?? '—' }}</span></div>
                    <div><span class="lbl">Email</span><span>{{ vendor()!.email ?? '—' }}</span></div>
                    <div><span class="lbl">Phone</span><span>{{ vendor()!.phone ?? '—' }}</span></div>
                    <div><span class="lbl">Currency</span><span>{{ vendor()!.currency ?? 'INR' }}</span></div>
                    <div><span class="lbl">Vendor Type</span><span>{{ vendor()!.vendor_type ? (vendor()!.vendor_type | titlecase) : '—' }}</span></div>
                    <div><span class="lbl">Entity Type</span><span>{{ vendor()!.entity_type ? (vendor()!.entity_type | titlecase) : '—' }}</span></div>
                    <div><span class="lbl">Primary Category</span><span>{{ vendor()!.category?.name ?? '—' }}</span></div>
                  </div>
                </div>

                <!-- Tax & Compliance -->
                <div class="card-section">
                  <div class="sec-title">Tax &amp; Compliance Details</div>
                  <div class="info-grid">
                    <div>
                      <span class="lbl">PAN Number</span>
                      <strong class="mono">{{ vendor()!.pan_not_available ? 'PAN Not Available' : (vendor()!.pan ?? '—') }}</strong>
                    </div>
                    <div><span class="lbl">GST Status</span><span>{{ vendor()!.gst_status ? (vendor()!.gst_status | titlecase) : '—' }}</span></div>
                    <div><span class="lbl">GSTIN</span><strong class="mono">{{ vendor()!.gstin ?? '—' }}</strong></div>
                    <div><span class="lbl">Special Status</span><span>{{ vendor()!.special_status ? (vendor()!.special_status | uppercase) : 'None' }}</span></div>
                    <div><span class="lbl">Registration No</span><span>{{ vendor()!.special_status_reg_no ?? '—' }}</span></div>
                    <div>
                      <span class="lbl">Special Status Validity</span>
                      <span>
                        {{ vendor()!.special_status_start_date ? (vendor()!.special_status_start_date | date:'dd MMM yyyy') : '' }}
                        {{ vendor()!.special_status_end_date ? (' to ' + (vendor()!.special_status_end_date | date:'dd MMM yyyy')) : '—' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Attached Compliance Documents (GST, PAN, Cheque, etc.) -->
                <div class="card-section">
                  <div class="sec-title" style="display:flex;align-items:center;justify-content:space-between;">
                    <span>Attached Compliance &amp; Registration Documents</span>
                    <span class="count-badge">{{ vendor()!.documents?.length ?? 0 }} document(s)</span>
                  </div>

                  @if (!vendor()!.documents?.length) {
                    <div class="empty-docs">
                      <mat-icon style="color:#94a3b8;">attach_file</mat-icon>
                      <span>No registration documents attached.</span>
                    </div>
                  } @else {
                    <div class="doc-list">
                      @for (doc of vendor()!.documents; track doc.id) {
                        <div class="doc-card">
                          <div class="doc-icon">
                            <mat-icon style="color:#2563eb;">description</mat-icon>
                          </div>
                          <div class="doc-info">
                            <div class="doc-type">{{ formatDocType(doc.document_type) }}</div>
                            <div class="doc-name">{{ doc.original_name }}</div>
                          </div>
                          <a class="doc-link-btn" [href]="getDocUrl(doc.file_path)" target="_blank" matTooltip="View / Download Document">
                            <mat-icon>open_in_new</mat-icon> View
                          </a>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Bank Details -->
                @if (vendor()!.account_no || vendor()!.bank_name) {
                  <div class="card-section">
                    <div class="sec-title">Bank Account Details</div>
                    <div class="info-grid">
                      <div><span class="lbl">Account Number</span><strong class="mono">{{ vendor()!.account_no ?? '—' }}</strong></div>
                      <div><span class="lbl">IFSC Code</span><strong class="mono">{{ vendor()!.ifsc ?? '—' }}</strong></div>
                      <div><span class="lbl">MICR</span><span>{{ vendor()!.micr ?? '—' }}</span></div>
                      <div><span class="lbl">Bank Name</span><span>{{ vendor()!.bank_name ?? '—' }}</span></div>
                      <div><span class="lbl">Branch</span><span>{{ vendor()!.branch_name ?? '—' }}</span></div>
                    </div>
                  </div>
                }

                <!-- Registered Addresses -->
                <div class="card-section">
                  <div class="sec-title">Registered Addresses ({{ vendor()!.addresses?.length ?? 0 }})</div>
                  @if (!vendor()!.addresses?.length) {
                    <div class="empty-docs">
                      <mat-icon style="color:#94a3b8;">location_off</mat-icon>
                      <span>No addresses recorded.</span>
                    </div>
                  } @else {
                    <div class="address-grid">
                      @for (addr of vendor()!.addresses; track addr.id) {
                        <div class="addr-card">
                          <div class="addr-head">
                            <strong>{{ addr.label }}</strong>
                            @if (addr.is_default) {
                              <span class="def-badge">DEFAULT</span>
                            }
                          </div>
                          <div class="addr-body">
                            {{ addr.address }}<br>
                            {{ addr.city ? addr.city + ', ' : '' }}{{ addr.state }} {{ addr.pincode }}<br>
                            @if (addr.gstin) { <span class="mono" style="font-size:11px;color:#475569;">GSTIN: {{ addr.gstin }}</span> }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

              </div>
            </mat-tab>

            <!-- TAB 2: Associated Purchase Orders -->
            <mat-tab [label]="'Associated Purchase Orders (' + (vendor()!.purchase_orders?.length ?? 0) + ')'">
              <div class="tab-padding">
                @if (!vendor()!.purchase_orders?.length) {
                  <div class="empty-docs" style="padding:48px 0;">
                    <mat-icon style="font-size:36px;width:36px;height:36px;color:#cbd5e1;">receipt_long</mat-icon>
                    <span style="font-size:14px;color:#64748b;">No Purchase Orders issued to this vendor yet.</span>
                  </div>
                } @else {
                  <table mat-table [dataSource]="vendor()!.purchase_orders!" class="full-width">
                    <ng-container matColumnDef="po_number">
                      <th mat-header-cell *matHeaderCellDef>PO Number</th>
                      <td mat-cell *matCellDef="let po">
                        <strong style="color:var(--brand);cursor:pointer;" (click)="openPo(po.id)">
                          {{ po.po_number ?? ('PO #' + po.id) }}
                        </strong>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef>Date</th>
                      <td mat-cell *matCellDef="let po">{{ po.created_at | date:'dd MMM yyyy' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Status</th>
                      <td mat-cell *matCellDef="let po">
                        <mat-chip [class]="'status-' + po.status" [highlighted]="true" style="font-size:11px;">
                          {{ po.status | uppercase }}
                        </mat-chip>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="delivery">
                      <th mat-header-cell *matHeaderCellDef>Delivery</th>
                      <td mat-cell *matCellDef="let po">
                        @if (po.delivery_status) {
                          <span [style.color]="po.delivery_status === 'partially_delivered' ? '#d97706' : '#16a34a'" style="font-weight:600;font-size:12px;">
                            {{ po.delivery_status === 'partially_delivered' ? 'Partially Delivered' : 'Delivered' }}
                          </span>
                        } @else { <span style="color:#94a3b8;">Pending</span> }
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="amount">
                      <th mat-header-cell *matHeaderCellDef>Grand Total</th>
                      <td mat-cell *matCellDef="let po">
                        <strong>₹{{ po.grand_total | number:'1.2-2' }}</strong>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="action">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let po" style="text-align:right;">
                        <button mat-stroked-button color="primary" (click)="openPo(po.id)" style="height:32px;line-height:30px;font-size:12px;">
                          <mat-icon style="font-size:16px;width:16px;height:16px;">visibility</mat-icon> View PO
                        </button>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="poColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: poColumns;"></tr>
                  </table>
                }
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-dialog-content>
      }
    </div>
  `,
  styles: [`
    .dialog-container { box-sizing: border-box; width: 100%; max-width: 100%; overflow-x: hidden; }
    .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 12px; background: #ffffff; }
    .v-title-box { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 240px; }
    .avatar { width: 44px; height: 44px; border-radius: 10px; background: #e0e7ff; color: #3730a3; font-weight: 700; font-size: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .v-name { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.2; }
    .v-sub { display: flex; align-items: center; gap: 8px; margin-top: 3px; font-size: 12px; flex-wrap: wrap; }
    .mono-code { font-family: monospace; font-weight: 600; color: #475569; background: #f1f5f9; padding: 1px 6px; border-radius: 4px; }
    .v-dot { color: #cbd5e1; }
    .badge-active { background: #dcfce7; color: #166534; font-weight: 700; padding: 2px 8px; border-radius: 99px; font-size: 11px; }
    .badge-inactive { background: #fef2f2; color: #991b1b; font-weight: 700; padding: 2px 8px; border-radius: 99px; font-size: 11px; }
    .dialog-header-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-wrap: wrap; }
    
    .dialog-content { padding: 0 !important; max-height: 75vh; }
    .tab-padding { padding: 16px 20px 24px; }
    .card-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
    .sec-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--brand); margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
    
    .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px 18px; }
    .lbl { font-size: 10px; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 3px; letter-spacing: 0.5px; }
    .mono { font-family: monospace; }
    .count-badge { font-size: 11px; background: #e2e8f0; color: #334155; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
    
    .empty-docs { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 13px; padding: 12px 0; justify-content: center; }
    .doc-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
    .doc-card { display: flex; align-items: center; gap: 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; }
    .doc-icon { width: 34px; height: 34px; border-radius: 6px; background: #eff6ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .doc-info { flex: 1; min-width: 0; }
    .doc-type { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #2563eb; letter-spacing: 0.5px; }
    .doc-name { font-size: 12px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .doc-link-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--brand); text-decoration: none; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); }
    .doc-link-btn:hover { background: #f1f5f9; }
    
    .address-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
    .addr-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
    .addr-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 4px; }
    .def-badge { font-size: 9px; font-weight: 700; background: #dcfce7; color: #166534; padding: 1px 6px; border-radius: 4px; }
    .addr-body { font-size: 12px; color: #475569; line-height: 1.45; }
    .full-width { width: 100%; }
  `],
})
export class VendorDetailDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  private notify = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<VendorDetailDialogComponent>);

  constructor(@Inject(MAT_DIALOG_DATA) public data: { vendorId: number }) {}

  loading = signal(true);
  downloading = signal(false);
  vendor = signal<any>(null);

  poColumns = ['po_number', 'date', 'status', 'delivery', 'amount', 'action'];

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/vendors/${this.data.vendorId}`).subscribe({
      next: res => {
        this.vendor.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  formatDocType(type: string): string {
    const map: Record<string, string> = {
      gst: 'GST Certificate',
      pan: 'PAN Card Copy',
      cancelled_cheque: 'Cancelled Cheque',
      additional: 'Additional Attachment',
    };
    return map[type] ?? type.replace(/_/g, ' ');
  }

  getDocUrl(filePath: string): string {
    if (filePath.startsWith('http')) return filePath;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}/storage/${filePath}`;
  }

  downloadPdf() {
    this.downloading.set(true);

    const pdfWin = window.open('', '_blank');
    if (pdfWin) {
      pdfWin.document.write(
        '<html><head><title>Loading Vendor PDF…</title></head>' +
        '<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5;">' +
        '<div style="text-align:center;color:#555;">' +
        '<div style="font-size:32px;margin-bottom:16px;">📄</div>' +
        '<div style="font-size:18px;font-weight:600;">Generating Vendor Profile PDF…</div>' +
        '</div></body></html>'
      );
    }

    this.http.get<{ url: string }>(`${environment.apiUrl}/vendors/${this.data.vendorId}/pdf-url`).subscribe({
      next: ({ url }) => {
        if (pdfWin && !pdfWin.closed) {
          pdfWin.location.href = url;
        } else {
          window.open(url, '_blank');
        }
        this.downloading.set(false);
      },
      error: () => {
        if (pdfWin && !pdfWin.closed) pdfWin.close();
        this.notify.error('Failed to generate Vendor PDF.');
        this.downloading.set(false);
      },
    });
  }

  editVendor() {
    this.dialogRef.close();
    this.router.navigate(['/vendors', this.data.vendorId, 'edit']);
  }

  openPo(poId: number) {
    this.dialogRef.close();
    this.router.navigate(['/purchase-orders', poId]);
  }
}
