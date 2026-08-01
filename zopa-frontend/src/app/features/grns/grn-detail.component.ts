import { Component, OnInit, inject, signal, input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { GrnStatusDialogComponent } from './grn-status-dialog.component';

@Component({
  selector: 'app-grn-detail',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink,
    MatButtonModule, MatIconModule, MatCardModule,
    MatTableModule, MatChipsModule, MatProgressSpinnerModule, MatTooltipModule, MatDialogModule],

  template: `
    <div class="page-wrapper">
      @if (loading()) {
        <div style="display:flex;justify-content:center;align-items:center;min-height:300px;">
          <mat-spinner diameter="44" />
        </div>
      } @else if (grn()) {

        <!-- ── Top Action Header ── -->
        <div class="header-container">
          <div class="header-left">
            <button mat-icon-button routerLink="/grns" class="back-btn" matTooltip="Back to GRN List">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div>
              <div style="display:flex;align-items:center;gap:10px;">
                <h1 class="page-title">{{ grn()!.grn_number }}</h1>
                <span class="status-badge" [class]="'badge-' + (grn()!.status || 'confirmed')">
                  {{ getStatusLabel(grn()!.status) }}
                </span>

              </div>
              <div class="po-subtext">
                <mat-icon class="sub-icon">description</mat-icon>
                Against Purchase Order:
                <a [routerLink]="['/purchase-orders', grn()!.purchase_order?.id]" class="po-link">
                  {{ grn()!.purchase_order?.po_number ?? '—' }}
                </a>
              </div>
            </div>
          </div>

          <div class="header-actions">
            <button mat-raised-button color="primary" class="primary-btn" (click)="openStatusDialog()">
              <mat-icon>edit_note</mat-icon> Update Status / Vendor Doc
            </button>
            <button mat-stroked-button (click)="downloadPdf()" [disabled]="pdfLoading()" class="secondary-btn">
              @if (pdfLoading()) { <mat-spinner diameter="16" /> }
              @else { <mat-icon>picture_as_pdf</mat-icon> }
              Download GRN PDF
            </button>
          </div>
        </div>

        <!-- ── Pending Alert Banner ── -->
        @if (grn()!.status === 'pending' || grn()!.status === 'draft') {
          <div class="pending-alert-banner">
            <mat-icon class="alert-icon">warning</mat-icon>
            <div class="alert-content">
              <strong>Pending Physical Verification &amp; Vendor Document</strong>
              <p>Delivery status logged from vendor info. Store receiver must verify physical items, record GRN/DC number, and upload vendor photo/PDF.</p>
            </div>
            <button mat-raised-button (click)="openStatusDialog()" class="complete-btn">
              <mat-icon>task_alt</mat-icon> Complete GRN &amp; Upload PDF
            </button>
          </div>
        }

        <!-- ── Overview Grid (2 Columns) ── -->
        <div class="overview-grid">
          <!-- Card 1: Receipt Info -->
          <div class="info-card">
            <div class="card-header-bar">
              <mat-icon class="card-icon">local_shipping</mat-icon>
              <span>Receipt &amp; Vendor Details</span>
            </div>
            <div class="card-body">
              <div class="field-grid-2">
                <div class="field-item">
                  <span class="field-label">PO NUMBER</span>
                  <span class="field-value highlight">
                    {{ grn()!.purchase_order?.po_number ?? '—' }}
                  </span>
                </div>
                <div class="field-item">
                  <span class="field-label">VENDOR</span>
                  <span class="field-value">
                    {{ grn()!.purchase_order?.vendor?.name ?? '—' }}
                  </span>
                </div>
                <div class="field-item">
                  <span class="field-label">RECEIVED DATE</span>
                  <span class="field-value">
                    {{ grn()!.received_date | date:'dd MMM yyyy' }}
                  </span>
                </div>
                <div class="field-item">
                  <span class="field-label">RECEIVED BY</span>
                  <span class="field-value">
                    {{ grn()!.received_by?.name ?? '—' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: DC & Invoice References -->
          <div class="info-card">
            <div class="card-header-bar">
              <mat-icon class="card-icon">receipt_long</mat-icon>
              <span>Delivery References &amp; Docs</span>
            </div>
            <div class="card-body">
              <div class="field-grid-2">
                <div class="field-item">
                  <span class="field-label">DC NUMBER</span>
                  <span class="field-value">
                    {{ grn()!.dc_number || '—' }}
                    @if (grn()!.dc_date) {
                      <span class="sub-date">({{ grn()!.dc_date | date:'dd MMM yyyy' }})</span>
                    }
                  </span>
                </div>
                <div class="field-item">
                  <span class="field-label">INVOICE NUMBER</span>
                  <span class="field-value">
                    {{ grn()!.invoice_number || '—' }}
                    @if (grn()!.invoice_date) {
                      <span class="sub-date">({{ grn()!.invoice_date | date:'dd MMM yyyy' }})</span>
                    }
                  </span>
                </div>
              </div>

              @if (grn()!.remarks) {
                <div class="remarks-box">
                  <span class="field-label">RECEIPT REMARKS</span>
                  <p>{{ grn()!.remarks }}</p>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- ── Vendor Attachments Section ── -->
        <div class="info-card style-attachments">
          <div class="card-header-bar flex-between">
            <div style="display:flex;align-items:center;gap:8px;">
              <mat-icon class="card-icon">folder_zip</mat-icon>
              <span>Vendor Documents &amp; Attachments</span>
              <span class="count-pill">{{ grn()!.attachments?.length || 0 }}</span>
            </div>
            <label class="upload-btn">
              <mat-icon style="font-size:16px;width:16px;height:16px;">cloud_upload</mat-icon>
              Upload Vendor Doc / Photo / PDF
              <input type="file" (change)="onUploadFile($event)" accept="image/*,application/pdf" style="display:none;" />
            </label>
          </div>
          <div class="card-body">
            @if (grn()!.attachments?.length > 0) {
              <div class="attachments-flex">
                @for (a of grn()!.attachments; track a.id) {
                  <div class="file-chip" (click)="downloadAttachment(a)" [title]="'Click to view/download ' + a.original_name">
                    <mat-icon class="file-icon">description</mat-icon>
                    <span class="file-name">{{ a.original_name }}</span>
                    <mat-icon class="download-icon">download</mat-icon>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-docs">
                <mat-icon>cloud_off</mat-icon>
                <span>No vendor GRN photo / PDF uploaded yet. Click upload button above to attach delivery document.</span>
              </div>
            }
          </div>
        </div>

        <!-- ── Line Items Table ── -->
        <div class="items-card">
          <div class="card-header-bar">
            <mat-icon class="card-icon">inventory_2</mat-icon>
            <span>Goods Receipt Line Items</span>
            <span class="count-pill">{{ grn()!.items?.length ?? 0 }}</span>
          </div>

          <div style="overflow-x:auto;">
            <table class="grn-items-table">
              <thead>
                <tr>
                  <th style="width:40px;text-align:center;">#</th>
                  <th>Item Description</th>
                  <th style="text-align:center;width:110px;">Ordered</th>
                  <th style="text-align:center;width:110px;">Received</th>
                  <th style="text-align:center;width:110px;">Accepted</th>
                  <th style="text-align:center;width:110px;">Rejected</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                @for (item of grn()!.items; track item.id; let i = $index) {
                  <tr>
                    <td style="text-align:center;" class="sno">{{ i + 1 }}</td>
                    <td>
                      <div class="item-name">{{ item.po_item?.description }}</div>
                      <div class="item-meta-row">
                        @if (item.po_item?.product?.code) {
                          <span class="item-meta">Code: {{ item.po_item.product.code }}</span>
                        }
                        @if (item.po_item?.product?.hsn_code) {
                          <span class="item-meta">HSN: {{ item.po_item.product.hsn_code }}</span>
                        }
                      </div>
                    </td>
                    <td style="text-align:center;">
                      <span class="qty-badge ordered">{{ item.po_item?.qty | number:'1.0-3' }}</span>
                    </td>
                    <td style="text-align:center;">
                      <span class="qty-badge received">{{ item.received_qty | number:'1.0-3' }}</span>
                    </td>
                    <td style="text-align:center;">
                      <span class="qty-badge accepted">{{ item.accepted_qty | number:'1.0-3' }}</span>
                    </td>
                    <td style="text-align:center;">
                      @if (+item.rejected_qty > 0) {
                        <span class="qty-badge rejected">{{ item.rejected_qty | number:'1.0-3' }}</span>
                      } @else {
                        <span style="color:#cbd5e1;">—</span>
                      }
                    </td>
                    <td class="remarks-cell">{{ item.remarks || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

      }
    </div>
  `,
  styles: [`
    .page-wrapper {
      padding: 24px;
      max-width: 1320px;
      margin: 0 auto;
    }

    /* Header */
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      gap: 16px;
    }
    .header-left {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .back-btn {
      color: #64748b;
      margin-top: 2px;
    }
    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .po-subtext {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .sub-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #94a3b8;
    }
    .po-link {
      color: #2563eb;
      font-weight: 600;
      text-decoration: none;
    }
    .po-link:hover {
      text-decoration: underline;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .primary-btn {
      padding: 0 18px;
      height: 40px;
      border-radius: 8px;
      font-weight: 600;
    }
    .secondary-btn {
      height: 40px;
      border-radius: 8px;
      font-weight: 600;
    }

    /* Status Badges */
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-confirmed { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-pending   { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-rejected  { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
    .badge-draft     { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    /* Pending Alert Banner */
    .pending-alert-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 12px;
      padding: 14px 20px;
      margin-bottom: 20px;
    }
    .alert-icon {
      color: #d97706;
      font-size: 26px;
      width: 26px;
      height: 26px;
      flex-shrink: 0;
    }
    .alert-content strong {
      color: #92400e;
      font-size: 14px;
      display: block;
    }
    .alert-content p {
      margin: 2px 0 0 0;
      font-size: 12.5px;
      color: #b45309;
    }
    .complete-btn {
      margin-left: auto;
      white-space: nowrap;
      background: #d97706 !important;
      color: #ffffff !important;
      font-weight: 600;
      padding: 0 16px;
      border-radius: 8px;
    }

    /* Cards & Grids */
    .overview-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .info-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .style-attachments {
      margin-bottom: 16px;
    }
    .items-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .card-header-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      padding: 12px 18px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13.5px;
      font-weight: 700;
      color: #1e293b;
    }
    .flex-between {
      justify-content: space-between;
    }
    .card-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--brand);
    }
    .count-pill {
      background: #e2e8f0;
      color: #334155;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 99px;
    }

    .card-body {
      padding: 16px 18px;
    }

    .field-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .field-item {
      display: flex;
      flex-direction: column;
    }
    .field-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .field-value {
      font-size: 13.5px;
      font-weight: 600;
      color: #0f172a;
    }
    .field-value.highlight {
      color: var(--brand);
    }
    .sub-date {
      font-size: 11px;
      color: #64748b;
      font-weight: normal;
      margin-left: 4px;
    }

    .remarks-box {
      margin-top: 14px;
      padding: 10px 12px;
      background: #f8fafc;
      border-left: 3px solid var(--brand);
      border-radius: 6px;
    }
    .remarks-box p {
      margin: 2px 0 0 0;
      font-size: 12.5px;
      color: #334155;
    }

    /* Attachments */
    .upload-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .upload-btn:hover {
      background: #dbeafe;
      border-color: #93c5fd;
    }
    .attachments-flex {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .file-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      font-size: 12.5px;
      font-weight: 600;
      color: #1e293b;
      cursor: pointer;
      transition: all 0.2s;
    }
    .file-chip:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      color: var(--brand);
    }
    .file-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #0284c7;
    }
    .download-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #64748b;
      margin-left: 4px;
    }
    .empty-docs {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #94a3b8;
      font-size: 12.5px;
      font-style: italic;
    }

    /* Items Table */
    .grn-items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .grn-items-table thead tr {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .grn-items-table th {
      padding: 11px 16px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      text-align: left;
    }
    .grn-items-table tbody tr {
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.15s;
    }
    .grn-items-table tbody tr:hover {
      background: #f8fafc;
    }
    .grn-items-table td {
      padding: 12px 16px;
      vertical-align: middle;
    }
    .sno {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
    }
    .item-name {
      font-weight: 600;
      color: #0f172a;
      font-size: 13px;
    }
    .item-meta-row {
      display: flex;
      gap: 10px;
      margin-top: 2px;
    }
    .item-meta {
      font-size: 11px;
      color: #64748b;
    }
    .remarks-cell {
      font-size: 12px;
      color: #475569;
    }

    .qty-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
      min-width: 44px;
      text-align: center;
    }
    .qty-badge.ordered  { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .qty-badge.received { background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; }
    .qty-badge.accepted { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .qty-badge.rejected { background: #fff1f2; color: #dc2626; border: 1px solid #fecdd3; }
  `],
})
export class GrnDetailComponent implements OnInit {
  id = input.required<string>();
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);

  grn = signal<any>(null);
  loading = signal(true);
  pdfLoading = signal(false);

  getStatusLabel(status: string): string {
    switch (status) {
      case 'confirmed': return 'GRN Captured';
      case 'pending':   return 'Pending GRN';
      case 'rejected':  return 'Rejected';
      case 'draft':     return 'Draft GRN';
      default:          return status ? status.toUpperCase() : 'UNKNOWN';
    }
  }

  ngOnInit() {

    this.loadGrn();
  }

  openStatusDialog() {
    const ref = this.dialog.open(GrnStatusDialogComponent, {
      width: '560px',
      data: { grn: this.grn() },
    });

    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.notify.success('GRN status & details updated.');
        this.loadGrn();
      }
    });
  }

  loadGrn() {
    this.http.get<any>(`${environment.apiUrl}/grns/${this.id()}`).subscribe({
      next: g => { this.grn.set(g); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onUploadFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const formData = new FormData();
      formData.append('file', file);

      this.http.post(`${environment.apiUrl}/grns/${this.id()}/upload`, formData).subscribe({
        next: () => {
          this.notify.success('Vendor document / photo attached successfully.');
          this.loadGrn();
        },
        error: () => this.notify.error('Could not upload vendor document.')
      });
    }
  }

  downloadPdf() {
    this.pdfLoading.set(true);
    this.http.get<any>(`${environment.apiUrl}/grns/${this.id()}/pdf-url`).subscribe({
      next: res => {
        this.pdfLoading.set(false);
        window.open(res.url, '_blank');
      },
      error: () => {
        this.pdfLoading.set(false);
        this.notify.error('Could not generate GRN PDF.');
      },
    });
  }

  downloadAttachment(attachment: any) {
    this.http.get(`${environment.apiUrl}/grns/${this.grn().id}/attachments/${attachment.id}`, { responseType: 'blob' })
      .subscribe(blob => {
        const url = window.URL.createObjectURL(new Blob([blob], { type: blob.type }));
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      });
  }
}
